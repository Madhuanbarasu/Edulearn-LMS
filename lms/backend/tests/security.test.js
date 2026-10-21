const test = require("node:test");
const assert = require("node:assert/strict");
const { startServer, seedWorld } = require("./helpers/world");
const { validateEnv, allowedOrigins } = require("../config/env");

let srv, w;
test.before(async () => { srv = await startServer(); w = await seedWorld(); });
test.after(async () => { await srv.close(); });

test("security headers present (helmet), no X-Powered-By", async () => {
  const r = await srv.call("GET", "/api/health");
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("x-powered-by"), null);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.ok(r.headers.get("content-security-policy"));
  assert.ok(r.headers.get("x-frame-options") || /frame-ancestors/.test(r.headers.get("content-security-policy")));
});

test("CORS: only the explicit origin is echoed; never a wildcard; credentials allowed only for it", async () => {
  const ok = await srv.call("GET", "/api/health", { headers: { Origin: "http://localhost:5173" } });
  assert.equal(ok.headers.get("access-control-allow-origin"), "http://localhost:5173");
  assert.equal(ok.headers.get("access-control-allow-credentials"), "true");
  const bad = await srv.call("GET", "/api/health", { headers: { Origin: "https://evil.example" } });
  assert.equal(bad.headers.get("access-control-allow-origin"), null);
  const pre = await fetch(srv.base + "/api/courses", { method: "OPTIONS", headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "GET" } });
  assert.equal(pre.headers.get("access-control-allow-origin"), null);
});

test("environment validation: missing/weak JWT secret, wildcard origin, placeholders", () => {
  const save = { ...process.env };
  try {
    process.env.MONGO_URI = "mongodb://127.0.0.1/x"; process.env.CLIENT_URL = "http://localhost:5173";
    process.env.JWT_SECRET = "x".repeat(40);
    assert.deepEqual(validateEnv(), []);
    process.env.JWT_SECRET = "short"; assert.ok(validateEnv().some((p) => /JWT_SECRET/.test(p)));
    process.env.JWT_SECRET = "change_this_to_a_long_random_secret_value"; assert.ok(validateEnv().some((p) => /placeholder/.test(p)));
    process.env.JWT_SECRET = "y".repeat(40); process.env.CLIENT_URL = "*"; assert.ok(validateEnv().some((p) => /CLIENT_URL/.test(p)));
    process.env.CLIENT_URL = "http://a.com/, http://b.com"; assert.deepEqual(allowedOrigins(), ["http://a.com", "http://b.com"]);
    delete process.env.MONGO_URI; assert.ok(validateEnv().some((p) => /MONGO_URI/.test(p)));
  } finally { Object.keys(process.env).forEach((k) => { if (!(k in save)) delete process.env[k]; }); Object.assign(process.env, save); }
});

test("errors are safe: malformed JSON, unknown routes, oversized bodies; no stack traces", async () => {
  const bad = await fetch(srv.base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{not json" });
  assert.equal(bad.status, 400);
  const body = await bad.text();
  assert.equal(/at .*\.js|node_modules|SyntaxError/.test(body), false);
  assert.equal((await srv.call("GET", "/api/nope")).status, 404);
  const huge = await fetch(srv.base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "a@b.co", password: "x".repeat(2 * 1024 * 1024) }) });
  assert.equal(huge.status, 413);
});

test("operator-injection keys ($, dotted) are rejected in body, query and nested objects", async () => {
  assert.equal((await srv.call("POST", "/api/auth/register", { body: { name: "a", email: "a@b.co", password: "Passw0rdX", "$where": "1" } })).status, 400);
  assert.equal((await srv.call("POST", "/api/auth/login", { body: { email: "a@b.co", password: { nested: { "$gt": "" } } } })).status, 400);
  assert.equal((await srv.call("GET", "/api/admin/users?role[$ne]=x", { token: w.admin.token })).status, 400);
  assert.equal((await srv.call("PUT", "/api/auth/profile", { token: w.s1.token, body: { "a.b": 1 } })).status, 400);
});

test("responses never include password hashes anywhere", async () => {
  const checks = [
    srv.call("GET", "/api/auth/me", { token: w.s1.token }),
    srv.call("GET", `/api/courses/${w.c1._id}`, { token: w.facA.token }),
    srv.call("GET", "/api/admin/users", { token: w.admin.token }),
    srv.call("GET", `/api/courses`, { token: w.admin.token }),
  ];
  for (const r of await Promise.all(checks)) assert.equal(JSON.stringify(r.body).includes("$2"), false);
});
