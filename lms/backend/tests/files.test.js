const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { startServer, seedWorld, models, mem, hours, jwt } = require("./helpers/world");
const { uploadDir } = require("../middleware/upload");
const { Assignment } = models;

let srv, w;
const created = [];
test.before(async () => { srv = await startServer(); });
test.after(async () => { await srv.close(); created.forEach((f) => fs.rmSync(path.join(uploadDir, f), { force: true })); });
test.beforeEach(async () => { w = await seedWorld(); });

const form = (fields, content, name) => { const f = new FormData(); Object.entries(fields).forEach(([k, v]) => f.append(k, v)); f.append("file", new Blob([content]), name); return f; };
const PDF = "%PDF-1.4\n%test";
const track = (res) => { const m = JSON.stringify(res.body).match(/\/uploads\/([A-Za-z0-9._-]+)/g); (m || []).forEach((x) => created.push(x.replace("/uploads/", ""))); return res; };
const nameOf = (fileUrl) => fileUrl.replace("/uploads/", "");

async function addMaterial() {
  const r = track(await srv.call("POST", `/api/courses/${w.c1._id}/materials`, { token: w.facA.token, form: form({ title: "Notes" }, PDF, "notes.pdf") }));
  assert.equal(r.status, 201);
  return nameOf(r.body.materials[0].fileUrl);
}

test("upload validation: disallowed extensions rejected", async () => {
  const bad = await srv.call("POST", `/api/courses/${w.c1._id}/materials`, { token: w.facA.token, form: form({ title: "x" }, "MZ...", "virus.exe") });
  assert.equal(bad.status, 400);
  assert.match(bad.body.message, /not allowed/i);
  const html = await srv.call("POST", `/api/courses/${w.c1._id}/materials`, { token: w.facA.token, form: form({ title: "x" }, "<script>1</script>", "page.html") });
  assert.equal(html.status, 400);
});

test("upload validation: content must match the extension; rejected files are not left on disk", async () => {
  const before = fs.readdirSync(uploadDir).length;
  const fake = await srv.call("POST", `/api/courses/${w.c1._id}/materials`, { token: w.facA.token, form: form({ title: "x" }, "this is not a pdf", "fake.pdf") });
  assert.equal(fake.status, 400);
  assert.match(fake.body.message, /does not match/i);
  const png = await srv.call("POST", `/api/courses/${w.c1._id}/materials`, { token: w.facA.token, form: form({ title: "x" }, "%PDF-1.4", "img.png") });
  assert.equal(png.status, 400);
  assert.equal(fs.readdirSync(uploadDir).length, before, "no orphaned files");
  assert.equal(mem.dump("Course").find((c) => c._id === String(w.c1._id)).materials.length, 0);
});

test("upload validation: size limit enforced", async () => {
  const big = "%PDF" + "a".repeat(11 * 1024 * 1024);
  const r = await srv.call("POST", `/api/courses/${w.c1._id}/materials`, { token: w.facA.token, form: form({ title: "big" }, big, "big.pdf") });
  assert.equal(r.status, 400);
  assert.match(r.body.message, /10MB/);
});

test("uploads are not publicly served", async () => {
  const name = await addMaterial();
  const direct = await srv.call("GET", `/uploads/${name}`);
  assert.equal(direct.status, 403);
  assert.equal((await srv.call("GET", `/uploads/${name}`, { token: w.s1.token })).status, 403, "even with a token: must use signed link");
  assert.notEqual((await srv.call("GET", "/uploads/%2e%2e/server.js")).status, 200);
  assert.equal((await srv.call("GET", "/uploads/%2e%2e%2fserver.js")).status, 403);
});

test("material access: enrolled students, allocated faculty and admin get a link; others do not", async () => {
  const name = await addMaterial();
  const access = (t) => srv.call("GET", `/api/files/access?name=${name}`, { token: t });
  assert.equal((await srv.call("GET", `/api/files/access?name=${name}`)).status, 401);
  assert.equal((await access(w.s3.token)).status, 403, "student of another course");
  assert.equal((await access(w.facB.token)).status, 403, "other faculty");
  for (const t of [w.s1.token, w.s2.token, w.facA.token, w.admin.token]) {
    const r = await access(t);
    assert.equal(r.status, 200);
    const dl = await fetch(srv.base + r.body.url);
    assert.equal(dl.status, 200);
    assert.match(dl.headers.get("content-disposition"), /attachment/);
    assert.equal(dl.headers.get("x-content-type-options"), "nosniff");
    assert.equal((await dl.text()).startsWith("%PDF"), true);
  }
});

test("download links expire, cannot be forged, and are single-purpose", async () => {
  const name = await addMaterial();
  const link = (await srv.call("GET", `/api/files/access?name=${name}`, { token: w.s1.token })).body.url;
  const token = link.split("/").pop();
  const claims = jwt.decode(token);
  assert.ok(claims.exp - claims.iat <= 120, "short-lived");
  const expired = jwt.sign({ purpose: "file", uid: String(w.s1._id), f: name }, process.env.JWT_SECRET, { expiresIn: -10 });
  assert.equal((await fetch(`${srv.base}/api/files/download/${expired}`)).status, 401);
  const forged = jwt.sign({ purpose: "file", uid: "x", f: name }, "wrong-secret-wrong-secret-wrong-secret");
  assert.equal((await fetch(`${srv.base}/api/files/download/${forged}`)).status, 401);
  const session = jwt.sign({ id: String(w.s1._id) }, process.env.JWT_SECRET);
  assert.equal((await fetch(`${srv.base}/api/files/download/${session}`)).status, 401, "session token is not a file token");
  const traversal = jwt.sign({ purpose: "file", uid: "x", f: "../server.js" }, process.env.JWT_SECRET, { expiresIn: 60 });
  const t = await fetch(`${srv.base}/api/files/download/${traversal}`);
  assert.notEqual(t.status, 200);
  assert.equal((await t.text()).includes("require("), false);
});

test("access requests reject traversal and unknown files", async () => {
  for (const n of ["../server.js", "..%2Fserver.js", "a/b.pdf", ".env", ""]) {
    const r = await srv.call("GET", `/api/files/access?name=${n}`, { token: w.admin.token });
    assert.ok([400, 404].includes(r.status), `${n} -> ${r.status}`);
  }
  assert.equal((await srv.call("GET", "/api/files/access?name=nonexistent.pdf", { token: w.admin.token })).status, 404);
  assert.equal((await srv.call("GET", "/api/files/access?name[$ne]=1", { token: w.admin.token })).status, 400);
});

test("submission files are visible only to the submitter, allocated faculty and admin", async () => {
  const a = await Assignment.create({ course: w.c1._id, title: "HW", dueDate: hours(5), createdBy: w.facA._id });
  const sub = track(await srv.call("POST", `/api/assignments/${a._id}/submit`, { token: w.s1.token, form: form({}, PDF, "answer.pdf") }));
  assert.equal(sub.status, 201);
  const name = nameOf(sub.body.fileUrl);
  const access = (t) => srv.call("GET", `/api/files/access?name=${name}`, { token: t });
  assert.equal((await access(w.s1.token)).status, 200);
  assert.equal((await access(w.facA.token)).status, 200);
  assert.equal((await access(w.admin.token)).status, 200);
  assert.equal((await access(w.s2.token)).status, 403, "classmate cannot read another student's submission");
  assert.equal((await access(w.s3.token)).status, 403);
  assert.equal((await access(w.facB.token)).status, 403);
});

test("assignment attachments follow course membership", async () => {
  const f = form({ course: String(w.c1._id), title: "With file", dueDate: hours(24).toISOString() }, PDF, "brief.pdf");
  const r = track(await srv.call("POST", "/api/assignments", { token: w.facA.token, form: f }));
  assert.equal(r.status, 201);
  const name = nameOf(r.body.attachmentUrl);
  assert.equal((await srv.call("GET", `/api/files/access?name=${name}`, { token: w.s1.token })).status, 200);
  assert.equal((await srv.call("GET", `/api/files/access?name=${name}`, { token: w.s3.token })).status, 403);
});
