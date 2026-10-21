const test = require("node:test");
const assert = require("node:assert/strict");
const { startServer, seedWorld, mkUser, PASSWORD, models, mem } = require("./helpers/world");

let srv, w;
test.before(async () => { srv = await startServer(); });
test.after(async () => { await srv.close(); });
test.beforeEach(async () => { w = await seedWorld(); });
const reg = (body) => srv.call("POST", "/api/auth/register", { body });
const good = { name: "New Student", email: "new@test.edu", password: "Str0ngPass1", role: "student" };

test("registration: validates required fields, email format and password strength", async () => {
  assert.equal((await reg({})).status, 400);
  assert.equal((await reg({ ...good, email: "not-an-email" })).status, 400);
  assert.equal((await reg({ ...good, password: "short" })).status, 400);
  assert.equal((await reg({ ...good, password: "alllowercase1" })).status, 400);
  assert.match((await reg({ ...good, password: "alllowercase1" })).body.message, /uppercase/);
  assert.equal((await reg({ ...good, email: { $ne: null } })).status, 400, "operator injection in email");
});

test("registration: success returns token for student, never exposes password", async () => {
  const r = await reg(good);
  assert.equal(r.status, 201);
  assert.ok(r.body.token);
  assert.equal(r.body.role, "student");
  assert.equal(r.body.password, undefined);
});

test("registration: duplicate email rejected (case-insensitive)", async () => {
  assert.equal((await reg(good)).status, 201);
  const dup = await reg({ ...good, email: "NEW@test.edu" });
  assert.equal(dup.status, 409);
});

test("registration: cannot self-register as admin (role silently downgraded to student)", async () => {
  const r = await reg({ ...good, email: "evil@test.edu", role: "admin" });
  assert.equal(r.status, 201);
  assert.equal(r.body.role, "student");
  const stored = mem.dump("User").find((u) => u.email === "evil@test.edu");
  assert.equal(stored.role, "student");
});

test("registration: client cannot set status", async () => {
  const r = await reg({ ...good, email: "x@test.edu", role: "faculty", status: "active" });
  assert.equal(r.status, 201);
  assert.equal(r.body.status, "pending");
  assert.equal(mem.dump("User").find((u) => u.email === "x@test.edu").status, "pending");
});

test("faculty registration is pending: no token, cannot log in until approved", async () => {
  const r = await reg({ ...good, email: "fac@test.edu", role: "faculty" });
  assert.equal(r.status, 201);
  assert.equal(r.body.token, undefined);
  assert.equal(r.body.status, "pending");
  const login = await srv.call("POST", "/api/auth/login", { body: { email: "fac@test.edu", password: good.password } });
  assert.equal(login.status, 403);
  assert.equal(login.body.code, "ACCOUNT_PENDING");
  // admin approves → can log in
  const id = r.body._id;
  assert.equal((await srv.call("POST", `/api/admin/faculty/${id}/approve`, { token: w.admin.token })).status, 200);
  const ok = await srv.call("POST", "/api/auth/login", { body: { email: "fac@test.edu", password: good.password } });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
});

test("pending/disabled/rejected accounts cannot use existing tokens on protected routes", async () => {
  for (const status of ["pending", "disabled", "rejected"]) {
    const u = await mkUser({ role: "faculty", status });
    const r = await srv.call("GET", "/api/courses", { token: u.token });
    assert.equal(r.status, 403, status);
    assert.equal(r.body.code, `ACCOUNT_${status.toUpperCase()}`);
  }
});

test("login: success, wrong password, unknown user share the same message", async () => {
  const ok = await srv.call("POST", "/api/auth/login", { body: { email: w.s1.email, password: PASSWORD } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.role, "student");
  assert.equal(ok.body.password, undefined);
  const bad = await srv.call("POST", "/api/auth/login", { body: { email: w.s1.email, password: "WrongPass1" } });
  const none = await srv.call("POST", "/api/auth/login", { body: { email: "ghost@test.edu", password: "WrongPass1" } });
  assert.equal(bad.status, 401); assert.equal(none.status, 401);
  assert.equal(bad.body.message, none.body.message);
});

test("login: NoSQL operator injection is rejected", async () => {
  const r = await srv.call("POST", "/api/auth/login", { body: { email: { $ne: null }, password: { $ne: null } } });
  assert.equal(r.status, 400);
});

test("legacy accounts without a status field still work (treated as active)", async () => {
  const legacy = await mkUser({ role: "faculty" });
  mem.mutate("User", (d) => { if (d._id === String(legacy._id)) delete d.status; });
  assert.equal(mem.dump("User").find((u) => u._id === String(legacy._id)).status, undefined);
  const { effectiveStatus } = require("../middleware/auth");
  assert.equal(effectiveStatus({}), "active");
  assert.equal(effectiveStatus({ status: "disabled" }), "disabled");
  assert.equal((await srv.call("GET", "/api/auth/me", { token: legacy.token })).status, 200);
  assert.equal((await srv.call("GET", "/api/courses", { token: legacy.token })).status, 200);
  const login = await srv.call("POST", "/api/auth/login", { body: { email: legacy.email, password: PASSWORD } });
  assert.equal(login.status, 200);
});

test("protected routes need a valid token; tampered/odd tokens rejected", async () => {
  assert.equal((await srv.call("GET", "/api/courses")).status, 401);
  assert.equal((await srv.call("GET", "/api/courses", { token: "garbage" })).status, 401);
  assert.equal((await srv.call("GET", "/api/courses", { headers: { Authorization: "Bearer" } })).status, 401);
  const forged = require("jsonwebtoken").sign({ id: String(w.admin._id) }, "some-other-secret-value-0123456789abcdef");
  assert.equal((await srv.call("GET", "/api/admin/overview", { token: forged })).status, 401);
  // a short-lived *file* token must not work as a session token
  const { signFileToken } = require("../utils/fileTokens");
  assert.equal((await srv.call("GET", "/api/courses", { token: signFileToken(w.s1._id, "x.pdf") })).status, 401);
});

test("profile: editable fields only; role/status/email are never changed", async () => {
  const r = await srv.call("PUT", "/api/auth/profile", { token: w.s1.token, body: { name: "Renamed", department: "CSE", role: "admin", status: "pending", email: "hijack@test.edu" } });
  assert.equal(r.status, 200);
  assert.equal(r.body.name, "Renamed");
  assert.equal(r.body.role, "student");
  assert.equal(r.body.status, "active");
  assert.equal(r.body.email, w.s1.email);
  assert.equal(r.body.password, undefined);
  assert.equal((await srv.call("PUT", "/api/auth/profile", { token: w.s1.token, body: { name: "" } })).status, 400);
  assert.equal((await srv.call("PUT", "/api/auth/profile", { token: w.s1.token, body: { name: { $gt: "" } } })).status, 400);
});

test("password change: requires correct current password, strong new one, invalidates old tokens", async () => {
  const path = "/api/auth/password";
  assert.equal((await srv.call("PUT", path, { token: w.s1.token, body: { newPassword: "NewPass123" } })).status, 400);
  const wrong = await srv.call("PUT", path, { token: w.s1.token, body: { currentPassword: "Nope12345", newPassword: "NewPass123" } });
  assert.equal(wrong.status, 400); assert.match(wrong.body.message, /incorrect/i);
  const weak = await srv.call("PUT", path, { token: w.s1.token, body: { currentPassword: PASSWORD, newPassword: "weak" } });
  assert.equal(weak.status, 400);
  assert.equal((await srv.call("PUT", path, { token: w.s1.token, body: { currentPassword: PASSWORD, newPassword: PASSWORD } })).status, 400, "same password");

  await new Promise((r) => setTimeout(r, 2100)); // tokens are second-granular
  const ok = await srv.call("PUT", path, { token: w.s1.token, body: { currentPassword: PASSWORD, newPassword: "BrandNew123" } });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
  assert.equal((await srv.call("GET", "/api/auth/me", { token: w.s1.token })).status, 401, "old token revoked");
  assert.equal((await srv.call("GET", "/api/auth/me", { token: ok.body.token })).status, 200, "new token works");
  assert.equal((await srv.call("POST", "/api/auth/login", { body: { email: w.s1.email, password: "BrandNew123" } })).status, 200);
  assert.equal((await srv.call("POST", "/api/auth/login", { body: { email: w.s1.email, password: PASSWORD } })).status, 401);
  assert.notEqual(mem.dump("User").find((u) => u.email === w.s1.email).password, "BrandNew123", "stored hashed");
});

test("login/register are rate limited", async () => {
  process.env.RATE_LIMIT_DISABLED = "false";
  process.env.AUTH_RATE_LIMIT_MAX; // default 20 per window
  try {
    let limited = false;
    for (let i = 0; i < 30 && !limited; i++) {
      const r = await srv.call("POST", "/api/auth/login", { body: { email: "x@test.edu", password: "Whatever1" } });
      if (r.status === 429) limited = true;
    }
    assert.equal(limited, true, "expected a 429 after repeated attempts");
  } finally { process.env.RATE_LIMIT_DISABLED = "true"; }
});

test("public academic options endpoint exposes only active names", async () => {
  const { AcademicOption } = models;
  await AcademicOption.create({ type: "department", name: "CSE" });
  await AcademicOption.create({ type: "department", name: "Closed", active: false });
  const r = await srv.call("GET", "/api/auth/options");
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.department, ["CSE"]);
});
