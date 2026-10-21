"use strict";
/**
 * DATABASE-FREE TEST LAYER
 * ------------------------
 * Replaces the *storage* beneath the real Mongoose models with plain in-memory arrays. Real schemas, real
 * validation, real pre-save hooks and real unique-index (E11000) semantics are used, so the real controllers,
 * routes and middleware run unchanged. It NEVER opens a network connection and refuses to run if a MONGO_URI
 * that looks real is present in the environment.
 *
 * Supported subset (everything the app uses): find/findOne/findById (+select/sort/skip/limit/populate/lean),
 * countDocuments, create/save, findOneAndUpdate (upsert), findByIdAndUpdate, findByIdAndDelete, updateMany,
 * deleteMany; operators $in $ne $gte $lte $gt $lt $or $each $set $unset $setOnInsert $addToSet $pull.
 * It is NOT a MongoDB emulator: aggregate pipelines and transactions are unsupported (the app uses neither).
 */
const mongoose = require("mongoose");

if (process.env.MONGO_URI && /mongodb(\+srv)?:\/\/(?!(127\.0\.0\.1|localhost))/.test(process.env.MONGO_URI)) {
  throw new Error("Refusing to run database-free tests with a non-local MONGO_URI in the environment");
}

const ObjectId = mongoose.Types.ObjectId;
const stores = new Map(); // modelName -> plain[]
const models = () => Object.values(mongoose.models);

// ---------- normalisation: ObjectId -> hex string, keep Date/RegExp/primitives
function norm(v) {
  if (v === null || v === undefined) return v;
  if (v instanceof ObjectId) return v.toHexString();
  if (v instanceof Date || v instanceof RegExp) return v;
  if (Array.isArray(v)) return v.map(norm);
  if (v && v._bsontype === "ObjectId") return String(v);
  if (typeof v === "object") {
    if (typeof v.toObject === "function") return norm(v.toObject({ depopulate: true }));
    const o = {};
    for (const k of Object.keys(v)) o[k] = norm(v[k]);
    return o;
  }
  return v;
}

// ---------- query matching
function valuesAt(doc, path) {
  let cur = [doc];
  for (const key of path.split(".")) {
    const next = [];
    for (const c of cur) {
      if (c === null || c === undefined) continue;
      const v = c[key];
      if (Array.isArray(v)) next.push(v, ...v); else next.push(v);
    }
    cur = next;
  }
  return cur;
}
const same = (a, b) => (a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : String(a) === String(b));
const cmp = (a, b) => (a instanceof Date || b instanceof Date ? new Date(a).getTime() - new Date(b).getTime() : a - b);

function matchField(vals, cond) {
  if (cond instanceof RegExp) return vals.some((v) => typeof v === "string" && cond.test(v));
  if (cond && typeof cond === "object" && !(cond instanceof Date) && Object.keys(cond).some((k) => k.startsWith("$"))) {
    return Object.entries(cond).every(([op, arg]) => {
      switch (op) {
        case "$in": return vals.some((v) => arg.some((a) => (a instanceof RegExp ? a.test(v) : same(v, a))));
        case "$ne": return !vals.some((v) => same(v, arg));
        case "$gte": return vals.some((v) => v !== undefined && cmp(v, arg) >= 0);
        case "$gt": return vals.some((v) => v !== undefined && cmp(v, arg) > 0);
        case "$lte": return vals.some((v) => v !== undefined && cmp(v, arg) <= 0);
        case "$lt": return vals.some((v) => v !== undefined && cmp(v, arg) < 0);
        case "$exists": return arg ? vals.some((v) => v !== undefined) : vals.every((v) => v === undefined);
        default: throw new Error(`memoryDb: unsupported operator ${op}`);
      }
    });
  }
  if (cond === null) return vals.every((v) => v === null || v === undefined);
  return vals.some((v) => same(v, cond));
}
function matches(doc, filter) {
  return Object.entries(norm(filter) || {}).every(([k, cond]) => {
    if (k === "$or") return cond.some((f) => matches(doc, f));
    if (k === "$and") return cond.every((f) => matches(doc, f));
    return matchField(valuesAt(doc, k), cond);
  });
}

// ---------- updates
function setPath(obj, path, val) {
  const parts = path.split(".");
  let o = obj;
  parts.slice(0, -1).forEach((p) => { o[p] = o[p] ?? {}; o = o[p]; });
  o[parts[parts.length - 1]] = val;
}
function applyUpdate(plain, update, inserting) {
  const u = norm(update);
  const ops = Object.keys(u).some((k) => k.startsWith("$")) ? u : { $set: u };
  for (const [op, body] of Object.entries(ops)) {
    for (const [path, val] of Object.entries(body)) {
      const cur = path.split(".").reduce((o, p) => (o ? o[p] : undefined), plain);
      switch (op) {
        case "$set": setPath(plain, path, val); break;
        case "$setOnInsert": if (inserting) setPath(plain, path, val); break;
        case "$unset": setPath(plain, path, undefined); break;
        case "$addToSet": { const arr = Array.isArray(cur) ? cur : []; (val && val.$each ? val.$each : [val]).forEach((x) => { if (!arr.some((y) => same(y, x))) arr.push(x); }); setPath(plain, path, arr); break; }
        case "$pull": setPath(plain, path, (Array.isArray(cur) ? cur : []).filter((y) => !same(y && y._id ? y._id : y, val))); break;
        default: throw new Error(`memoryDb: unsupported update operator ${op}`);
      }
    }
  }
}

// ---------- unique indexes
function assertUnique(Model, plain, selfId) {
  for (const [fields, opts] of Model.schema.indexes()) {
    if (!opts || !opts.unique) continue;
    const keys = Object.keys(fields);
    const dup = (stores.get(Model.modelName) || []).find((d) => d._id !== selfId && keys.every((k) => {
      const a = d[k], b = plain[k];
      return a !== undefined && b !== undefined && same(a, b);
    }));
    if (dup) throw Object.assign(new Error(`E11000 duplicate key ${JSON.stringify(Object.fromEntries(keys.map((k) => [k, plain[k]])))}`), { code: 11000, name: "MongoServerError" });
  }
  // field-level unique:true (e.g. email, code)
  for (const [name, p] of Object.entries(Model.schema.paths)) {
    if (p.options && p.options.unique && name !== "_id") {
      const dup = (stores.get(Model.modelName) || []).find((d) => d._id !== selfId && d[name] !== undefined && plain[name] !== undefined && same(d[name], plain[name]));
      if (dup) throw Object.assign(new Error(`E11000 duplicate key ${name}`), { code: 11000, name: "MongoServerError" });
    }
  }
}

// ---------- select
function applySelect(Model, plain, selectSpec) {
  const tokens = [];
  if (typeof selectSpec === "string") tokens.push(...selectSpec.split(/\s+/).filter(Boolean));
  else if (selectSpec && typeof selectSpec === "object") Object.entries(selectSpec).forEach(([k, v]) => tokens.push(v ? k : `-${k}`));
  const out = JSON.parse(JSON.stringify(plain), (k, v) => (typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(v) : v));
  const forced = tokens.filter((t) => t.startsWith("+")).map((t) => t.slice(1));
  // schema-level select:false (password) hidden unless forced
  for (const [name, p] of Object.entries(Model.schema.paths)) if (p.options && p.options.select === false && !forced.includes(name)) delete out[name];
  const includes = tokens.filter((t) => !t.startsWith("-") && !t.startsWith("+"));
  const excludes = tokens.filter((t) => t.startsWith("-")).map((t) => t.slice(1));
  if (includes.length) {
    const keep = {};
    ["_id", ...includes].forEach((p) => {
      const [head, ...rest] = p.split(".");
      if (!rest.length) { if (out[head] !== undefined) keep[head] = out[head]; return; }
      if (Array.isArray(out[head])) {
        keep[head] = (keep[head] || out[head].map(() => ({}))).map((el, i) => { const v = valuesAt(out[head][i], rest.join("."))[0]; if (v !== undefined) setPath(el, rest.join("."), v); return el; });
      } else if (out[head] !== undefined) { const v = valuesAt(out, p)[0]; if (v !== undefined) setPath(keep, p, v); }
    });
    return keep;
  }
  excludes.forEach((p) => {
    const parts = p.split(".");
    if (parts.length === 1) { delete out[p]; return; }
    const strip = (node, rest) => { if (Array.isArray(node)) node.forEach((n) => strip(n, rest)); else if (node && rest.length === 1) delete node[rest[0]]; else if (node) strip(node[rest[0]], rest.slice(1)); };
    strip(out[parts[0]], parts.slice(1));
  });
  return out;
}

function projectionFor(Model, selectSpec) {
  const tokens = typeof selectSpec === "string" ? selectSpec.split(/\s+/).filter(Boolean) : [];
  const forced = tokens.filter((t) => t.startsWith("+")).map((t) => t.slice(1));
  const proj = {};
  for (const [name, p] of Object.entries(Model.schema.paths)) if (p.options && p.options.select === false && !forced.includes(name)) proj[name] = 0;
  tokens.filter((t) => t.startsWith("-")).forEach((t) => { if (!t.includes(".")) proj[t.slice(1)] = 0; });
  const inc = tokens.filter((t) => !t.startsWith("-") && !t.startsWith("+"));
  if (inc.length) { Object.keys(proj).forEach((k) => delete proj[k]); inc.forEach((t) => { proj[t.split(".")[0]] = 1; }); proj._id = 1; }
  return Object.keys(proj).length ? proj : undefined;
}

// ---------- chainable thenable query
class FakeQuery {
  constructor(Model, filter, { one = false } = {}) { this.Model = Model; this.filter = filter || {}; this.one = one; this.opts = { populate: [] }; }
  select(s) {
    if (s && typeof s === "object") s = Object.entries(s).map(([k, v]) => (v ? k : `-${k}`)).join(" "); this.opts.select = this.opts.select ? `${typeof this.opts.select === "string" ? this.opts.select : ""} ${typeof s === "string" ? s : ""}` : s; return this; }
  sort(s) { this.opts.sort = s; return this; }
  skip(n) { this.opts.skip = n; return this; }
  limit(n) { this.opts.limit = n; return this; }
  lean() { this.opts.lean = true; return this; }
  populate(...args) { this.opts.populate.push(args.length === 1 && typeof args[0] === "object" ? args[0] : { path: args[0], select: args[1] }); return this; }
  async exec() {
    let rows = (stores.get(this.Model.modelName) || []).filter((d) => matches(d, this.filter));
    if (this.opts.sort) {
      const spec = typeof this.opts.sort === "string" ? Object.fromEntries(this.opts.sort.split(/\s+/).filter(Boolean).map((k) => (k.startsWith("-") ? [k.slice(1), -1] : [k, 1]))) : this.opts.sort;
      rows = [...rows].sort((a, b) => { for (const [k, dir] of Object.entries(spec)) { const av = a[k], bv = b[k]; if (av === bv) continue; if (av === undefined) return -dir; if (bv === undefined) return dir; const c = cmp(av, bv); if (c) return c * dir; } return 0; });
    }
    if (this.opts.skip) rows = rows.slice(this.opts.skip);
    if (this.opts.limit) rows = rows.slice(0, this.opts.limit);
    if (this.one) rows = rows.slice(0, 1);
    const shaped = rows.map((r) => applySelect(this.Model, r, this.opts.select));
    const proj = projectionFor(this.Model, this.opts.select);
    let docs = shaped.map((p) => this.Model.hydrate(p, proj));
    for (const pop of this.opts.populate) docs = await this.Model.populate(docs, pop);
    if (this.opts.lean) docs = docs.map((d) => d.toObject());
    return this.one ? docs[0] || null : docs;
  }
  then(res, rej) { return this.exec().then(res, rej); }
  catch(rej) { return this.exec().catch(rej); }
}

// ---------- persistence
async function persist(doc) {
  const Model = doc.constructor;
  await doc.validate();
  await new Promise((resolve, reject) => Model.schema.s.hooks.execPre("save", doc, [], (e) => (e ? reject(e) : resolve())));
  const plain = norm(doc.toObject({ depopulate: true }));
  const store = stores.get(Model.modelName) || stores.set(Model.modelName, []).get(Model.modelName);
  const idx = store.findIndex((d) => d._id === plain._id);
  assertUnique(Model, plain, plain._id);
  if (idx >= 0) store[idx] = { ...store[idx], ...plain }; else store.push(plain);
  doc.isNew = false;
  return doc;
}

function install() {
  for (const Model of models()) {
    const name = () => Model.modelName;
    Model.find = (f, proj) => { const q = new FakeQuery(Model, f); return proj ? q.select(proj) : q; };
    Model.findOne = (f) => new FakeQuery(Model, f, { one: true });
    Model.findById = (id) => new FakeQuery(Model, { _id: id }, { one: true });
    Model.countDocuments = async (f) => (stores.get(name()) || []).filter((d) => matches(d, f || {})).length;
    Model.deleteMany = async (f) => { const s = stores.get(name()) || []; const keep = s.filter((d) => !matches(d, f || {})); stores.set(name(), keep); return { deletedCount: s.length - keep.length }; };
    Model.findByIdAndDelete = async (id) => { const s = stores.get(name()) || []; const hit = s.find((d) => d._id === String(id)); stores.set(name(), s.filter((d) => d !== hit)); return hit ? Model.hydrate(hit) : null; };
    Model.updateMany = async (f, u) => { const s = stores.get(name()) || []; let n = 0; s.forEach((d) => { if (matches(d, f)) { applyUpdate(d, u, false); n++; } }); return { modifiedCount: n }; };
    Model.findOneAndUpdate = async (f, u, opts = {}) => {
      const s = stores.get(name()) || stores.set(name(), []).get(name());
      let hit = s.find((d) => matches(d, f));
      let inserting = false;
      if (!hit) {
        if (!opts.upsert) return null;
        inserting = true;
        hit = { _id: new ObjectId().toHexString() };
        Object.entries(norm(f)).forEach(([k, v]) => { if (!k.startsWith("$") && !(v && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v))) hit[k] = v; });
      }
      const draft = JSON.parse(JSON.stringify(hit), (k, v) => (typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(v) : v));
      applyUpdate(draft, u, inserting);
      const doc = Model.hydrate(draft); // applies schema defaults for inserts
      const plain = norm(doc.toObject({ depopulate: true }));
      assertUnique(Model, plain, hit._id);
      if (inserting) s.push(plain); else s[s.indexOf(hit)] = { ...hit, ...plain };
      return opts.new === false ? Model.hydrate(hit) : doc;
    };
    Model.findByIdAndUpdate = (id, u, opts) => Model.findOneAndUpdate({ _id: id }, u, opts);
    Model.create = async (data) => persist(new Model(data));
    Model.prototype.save = function save() { return persist(this); };
  }
}

const reset = () => stores.clear();
/** Test helper: mutate raw stored documents (e.g. to simulate legacy records that lack newer fields). */
const mutate = (modelName, fn) => (stores.get(modelName) || []).forEach(fn);
const dump = (modelName) => (stores.get(modelName) || []).map((d) => ({ ...d }));

module.exports = { install, reset, dump, mutate, norm };
