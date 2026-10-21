const test = require("node:test");
const assert = require("node:assert/strict");
const { startServer, seedWorld, models, mem, hours } = require("./helpers/world");
const { Assignment, Submission } = models;

let srv, w;
test.before(async () => { srv = await startServer(); });
test.after(async () => { await srv.close(); });
test.beforeEach(async () => { w = await seedWorld(); });

const mk = (over = {}) => Assignment.create({ course: w.c1._id, title: "HW1", dueDate: hours(48), maxMarks: 50, createdBy: w.facA._id, ...over });
const textSubmit = (token, id, textAnswer) => srv.call("POST", `/api/assignments/${id}/submit`, { token, body: { textAnswer } });

test("create: validation + only allocated faculty", async () => {
  const body = { course: String(w.c1._id), title: "HW", dueDate: hours(24).toISOString(), maxMarks: 20 };
  const mkForm = (b) => { const f = new FormData(); Object.entries(b).forEach(([k, v]) => f.append(k, v)); return f; };
  const post = (token, b) => srv.call("POST", "/api/assignments", { token, form: mkForm(b) });
  assert.equal((await post(w.facA.token, { ...body, dueDate: "nonsense" })).status, 400);
  assert.equal((await post(w.facA.token, { ...body, maxMarks: "-5" })).status, 400);
  assert.equal((await post(w.facA.token, { ...body, maxMarks: "abc" })).status, 400);
  assert.equal((await post(w.facA.token, { ...body, course: "bad" })).status, 400);
  assert.equal((await post(w.facB.token, body)).status, 403);
  assert.equal((await post(w.s1.token, body)).status, 403);
  const ok = await post(w.facA.token, body);
  assert.equal(ok.status, 201);
  assert.equal(ok.body.maxMarks, 20);
});

test("reading assignments requires course membership", async () => {
  await mk();
  assert.equal((await srv.call("GET", `/api/assignments/course/${w.c1._id}`, { token: w.s1.token })).body.length, 1);
  assert.equal((await srv.call("GET", `/api/assignments/course/${w.c1._id}`, { token: w.s3.token })).status, 403);
  assert.equal((await srv.call("GET", `/api/assignments/course/${w.c1._id}`, { token: w.facB.token })).status, 403);
});

test("on-time submission is 'submitted' and not late", async () => {
  const a = await mk();
  const r = await textSubmit(w.s1.token, a._id, "my answer");
  assert.equal(r.status, 201);
  assert.equal(r.body.status, "submitted");
  assert.equal(r.body.isLate, false);
});

test("late submissions are accepted and flagged late", async () => {
  const a = await mk({ dueDate: hours(-2) });
  const r = await textSubmit(w.s1.token, a._id, "late answer");
  assert.equal(r.status, 201);
  assert.equal(r.body.status, "late");
  assert.equal(r.body.isLate, true);
  const mine = await srv.call("GET", `/api/assignments/${a._id}/my-submission`, { token: w.s1.token });
  assert.equal(mine.body.isLate, true);
});

test("submission requires enrolment and content", async () => {
  const a = await mk();
  assert.equal((await textSubmit(w.s3.token, a._id, "x")).status, 403, "not enrolled");
  assert.equal((await textSubmit(w.facA.token, a._id, "x")).status, 403, "faculty cannot submit");
  assert.equal((await srv.call("POST", `/api/assignments/${a._id}/submit`, { token: w.s1.token, body: {} })).status, 400);
  assert.equal((await srv.call("POST", `/api/assignments/${a._id}/submit`, { token: w.s1.token, body: { textAnswer: { $ne: 1 } } })).status, 400);
  assert.equal(mem.dump("Submission").length, 0);
});

test("resubmission before grading replaces; after grading it is locked (409) and the grade is preserved", async () => {
  const a = await mk();
  assert.equal((await textSubmit(w.s1.token, a._id, "v1")).status, 201);
  assert.equal((await textSubmit(w.s1.token, a._id, "v2")).status, 201);
  assert.equal(mem.dump("Submission").length, 1, "still one submission");
  assert.equal(mem.dump("Submission")[0].textAnswer, "v2");

  const sub = mem.dump("Submission")[0];
  const g = await srv.call("PUT", `/api/assignments/submissions/${sub._id}/grade`, { token: w.facA.token, body: { marksObtained: 40, feedback: "Good" } });
  assert.equal(g.status, 200);
  assert.equal(g.body.status, "graded");

  const again = await textSubmit(w.s1.token, a._id, "sneaky v3");
  assert.equal(again.status, 409);
  const after = mem.dump("Submission")[0];
  assert.equal(after.textAnswer, "v2", "text not replaced");
  assert.equal(after.marksObtained, 40, "grade preserved");
  assert.equal(after.status, "graded");
});

test("grading: marks range enforced against assignment max; faculty may regrade", async () => {
  const a = await mk({ maxMarks: 50 });
  await textSubmit(w.s1.token, a._id, "x");
  const sub = mem.dump("Submission")[0];
  const grade = (marksObtained, token = w.facA.token, extra = {}) => srv.call("PUT", `/api/assignments/submissions/${sub._id}/grade`, { token, body: { marksObtained, ...extra } });
  assert.equal((await grade(51)).status, 400);
  assert.equal((await grade(-1)).status, 400);
  assert.equal((await grade("abc")).status, 400);
  assert.equal((await grade(null)).status, 400);
  assert.equal((await grade({ $gt: 0 })).status, 400);
  assert.equal((await grade(10, w.facA.token, { feedback: { a: 1 } })).status, 400);
  assert.equal(mem.dump("Submission")[0].marksObtained ?? null, null, "nothing saved for invalid grades");
  assert.equal((await grade(50)).status, 200);
  assert.equal((await grade(45, w.facA.token, { feedback: "regraded" })).body.marksObtained, 45);
});

test("grading/viewing submissions is limited to the allocated faculty", async () => {
  const a = await mk();
  await textSubmit(w.s1.token, a._id, "x");
  const sub = mem.dump("Submission")[0];
  assert.equal((await srv.call("PUT", `/api/assignments/submissions/${sub._id}/grade`, { token: w.facB.token, body: { marksObtained: 1 } })).status, 403);
  assert.equal((await srv.call("PUT", `/api/assignments/submissions/${sub._id}/grade`, { token: w.s1.token, body: { marksObtained: 50 } })).status, 403, "student cannot self-grade");
  assert.equal((await srv.call("GET", `/api/assignments/${a._id}/submissions`, { token: w.facB.token })).status, 403);
  assert.equal((await srv.call("GET", `/api/assignments/${a._id}/submissions`, { token: w.s2.token })).status, 403);
  const ok = await srv.call("GET", `/api/assignments/${a._id}/submissions`, { token: w.facA.token });
  assert.equal(ok.status, 200);
  assert.equal(ok.body[0].student.name, "Student One");
});

test("students only read their own submission", async () => {
  const a = await mk();
  await textSubmit(w.s1.token, a._id, "mine");
  assert.equal((await srv.call("GET", `/api/assignments/${a._id}/my-submission`, { token: w.s2.token })).body, null);
  assert.equal((await srv.call("GET", `/api/assignments/${a._id}/my-submission`, { token: w.s3.token })).status, 403);
  assert.equal((await srv.call("GET", `/api/assignments/${a._id}/my-submission`, { token: w.s1.token })).body.textAnswer, "mine");
});

test("assignments with submissions cannot be deleted; empty ones can, by the right faculty only", async () => {
  const a = await mk(), b = await mk({ title: "empty" });
  await textSubmit(w.s1.token, a._id, "x");
  assert.equal((await srv.call("DELETE", `/api/assignments/${a._id}`, { token: w.facA.token })).status, 409);
  assert.equal(mem.dump("Submission").length, 1);
  assert.equal((await srv.call("DELETE", `/api/assignments/${b._id}`, { token: w.facB.token })).status, 403);
  assert.equal((await srv.call("DELETE", `/api/assignments/${b._id}`, { token: w.facA.token })).status, 200);
});

test("legacy submissions (no isLate field) get lateness derived from dates", async () => {
  const a = await mk({ dueDate: new Date("2026-01-01T00:00:00Z") });
  await Submission.create({ assignment: a._id, student: w.s1._id, textAnswer: "old", submittedAt: new Date("2026-01-05T00:00:00Z"), status: "graded", marksObtained: 10 });
  mem.mutate("Submission", (d) => delete d.isLate);
  const r = await srv.call("GET", `/api/assignments/${a._id}/my-submission`, { token: w.s1.token });
  assert.equal(r.body.isLate, true);
  assert.equal(r.body.marksObtained, 10);
});
