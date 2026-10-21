const test = require("node:test");
const assert = require("node:assert/strict");
const { startServer, seedWorld, mem } = require("./helpers/world");

let srv, w;
test.before(async () => { srv = await startServer(); });
test.after(async () => { await srv.close(); });
test.beforeEach(async () => { w = await seedWorld(); });

const today = () => new Date().toISOString().slice(0, 10);
const mark = (token, body) => srv.call("POST", "/api/attendance", { token, body });
const recs = (...pairs) => pairs.map(([s, status]) => ({ student: String(s._id), status }));

test("only the allocated faculty can record attendance", async () => {
  const body = { course: String(w.c1._id), date: today(), records: recs([w.s1, "present"], [w.s2, "absent"]) };
  assert.equal((await mark(w.facB.token, body)).status, 403);
  assert.equal((await mark(w.s1.token, body)).status, 403);
  assert.equal(mem.dump("Attendance").length, 0);
  assert.equal((await mark(w.facA.token, body)).status, 201);
  assert.equal((await mark(w.admin.token, { ...body, date: "2026-01-02" })).status, 201);
});

test("validation: student must be enrolled, status valid, date valid/not future, no duplicates", async () => {
  const c = String(w.c1._id);
  assert.equal((await mark(w.facA.token, { course: c, date: today(), records: recs([w.s3, "present"]) })).status, 400, "unenrolled student");
  assert.equal((await mark(w.facA.token, { course: c, date: today(), records: recs([w.s1, "excused"]) })).status, 400);
  assert.equal((await mark(w.facA.token, { course: c, date: "not-a-date", records: recs([w.s1, "present"]) })).status, 400);
  const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  assert.equal((await mark(w.facA.token, { course: c, date: future, records: recs([w.s1, "present"]) })).status, 400);
  assert.equal((await mark(w.facA.token, { course: c, date: today(), records: recs([w.s1, "present"], [w.s1, "absent"]) })).status, 400, "duplicate student");
  assert.equal((await mark(w.facA.token, { course: c, date: today(), records: [] })).status, 400);
  assert.equal((await mark(w.facA.token, { course: c, date: today(), records: [{ student: { $ne: 1 }, status: "present" }] })).status, 400);
  assert.equal((await mark(w.facA.token, { course: { $ne: 1 }, date: today(), records: recs([w.s1, "present"]) })).status, 400);
  assert.equal(mem.dump("Attendance").length, 0, "nothing persisted from invalid requests");
});

test("same course + same day never creates a duplicate document (re-save updates)", async () => {
  const c = String(w.c1._id);
  assert.equal((await mark(w.facA.token, { course: c, date: today(), records: recs([w.s1, "absent"], [w.s2, "present"]) })).status, 201);
  assert.equal((await mark(w.facA.token, { course: c, date: today(), records: recs([w.s1, "present"], [w.s2, "present"]) })).status, 201);
  const docs = mem.dump("Attendance");
  assert.equal(docs.length, 1);
  assert.equal(docs[0].records.find((r) => r.student === String(w.s1._id)).status, "present");
});

async function seedSessions() {
  const c = String(w.c1._id);
  await mark(w.facA.token, { course: c, date: "2026-01-05", records: recs([w.s1, "present"], [w.s2, "absent"]) });
  await mark(w.facA.token, { course: c, date: "2026-01-06", records: recs([w.s1, "late"], [w.s2, "absent"]) });
}

test("students see only their own attendance rows; never classmates'", async () => {
  await seedSessions();
  const r = await srv.call("GET", `/api/attendance/course/${w.c1._id}`, { token: w.s1.token });
  assert.equal(r.status, 200);
  assert.equal(r.body.length, 2);
  r.body.forEach((s) => { assert.equal(s.records.length, 1); assert.equal(String(s.records[0].student._id || s.records[0].student), String(w.s1._id)); });
  assert.equal(JSON.stringify(r.body).includes("Student Two"), false);
  const fac = await srv.call("GET", `/api/attendance/course/${w.c1._id}`, { token: w.facA.token });
  assert.equal(fac.body[0].records.length, 2);
});

test("attendance reads are scoped: non-members and other faculty denied", async () => {
  await seedSessions();
  assert.equal((await srv.call("GET", `/api/attendance/course/${w.c1._id}`, { token: w.s3.token })).status, 403);
  assert.equal((await srv.call("GET", `/api/attendance/course/${w.c1._id}`, { token: w.facB.token })).status, 403);
});

test("summary: own only for students; faculty only for their course; correct percentage", async () => {
  await seedSessions();
  const p = (c, s) => `/api/attendance/course/${c._id}/student/${s._id}`;
  const own = await srv.call("GET", p(w.c1, w.s1), { token: w.s1.token });
  assert.equal(own.status, 200);
  assert.deepEqual({ present: own.body.present, total: own.body.total, percentage: own.body.percentage }, { present: 2, total: 2, percentage: "100.00" });
  assert.equal((await srv.call("GET", p(w.c1, w.s2), { token: w.s1.token })).status, 403, "other student");
  assert.equal((await srv.call("GET", p(w.c1, w.s2), { token: w.s3.token })).status, 403);
  assert.equal((await srv.call("GET", p(w.c1, w.s1), { token: w.facB.token })).status, 403);
  assert.equal((await srv.call("GET", p(w.c1, w.s2), { token: w.facA.token })).body.percentage, "0.00");
  assert.equal((await srv.call("GET", p(w.c2, w.s3), { token: w.s1.token })).status, 403);
});
