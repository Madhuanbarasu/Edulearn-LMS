const test = require("node:test");
const assert = require("node:assert/strict");
const { startServer, seedWorld, models, hours } = require("./helpers/world");
const { Assignment, Submission, ForumPost } = models;

let srv, w;
test.before(async () => { srv = await startServer(); });
test.after(async () => { await srv.close(); });
test.beforeEach(async () => { w = await seedWorld(); });

test("forum: only course members read/post/comment; authors and moderators delete", async () => {
  const mkPost = (token, course = w.c1._id) => srv.call("POST", "/api/forum", { token, body: { course: String(course), title: "Hello", body: "World" } });
  assert.equal((await mkPost(w.s3.token)).status, 403);
  assert.equal((await mkPost(w.facB.token)).status, 403);
  assert.equal((await srv.call("POST", "/api/forum", { token: w.s1.token, body: { course: String(w.c1._id), title: { a: 1 }, body: "x" } })).status, 400);
  const p = await mkPost(w.s1.token);
  assert.equal(p.status, 201);
  assert.equal((await srv.call("GET", `/api/forum/course/${w.c1._id}`, { token: w.s3.token })).status, 403);
  assert.equal((await srv.call("GET", `/api/forum/course/${w.c1._id}`, { token: w.s2.token })).body.length, 1);
  const c = (token, text) => srv.call("POST", `/api/forum/${p.body._id}/comments`, { token, body: { text } });
  assert.equal((await c(w.s3.token, "hi")).status, 403);
  assert.equal((await c(w.s2.token, "   ")).status, 400);
  assert.equal((await c(w.s2.token, "nice")).status, 201);
  const posts = await srv.call("GET", `/api/forum/course/${w.c1._id}`, { token: w.s1.token });
  const commentId = posts.body[0].comments[0]._id;
  assert.equal((await srv.call("DELETE", `/api/forum/${p.body._id}`, { token: w.s2.token })).status, 403, "other student cannot delete post");
  assert.equal((await srv.call("DELETE", `/api/forum/${p.body._id}/comments/${commentId}`, { token: w.s1.token })).status, 403, "post author is not comment author");
  assert.equal((await srv.call("DELETE", `/api/forum/${p.body._id}/comments/${commentId}`, { token: w.facB.token })).status, 403);
  assert.equal((await srv.call("DELETE", `/api/forum/${p.body._id}/comments/${commentId}`, { token: w.facA.token })).status, 200, "course faculty moderates");
  assert.equal((await srv.call("DELETE", `/api/forum/${p.body._id}`, { token: w.s1.token })).status, 200, "author deletes own");
});

test("analytics: students cannot read course-wide data or other students' performance", async () => {
  assert.equal((await srv.call("GET", `/api/analytics/course/${w.c1._id}`, { token: w.s1.token })).status, 403);
  assert.equal((await srv.call("GET", `/api/analytics/course/${w.c1._id}`, { token: w.facB.token })).status, 403);
  const ok = await srv.call("GET", `/api/analytics/course/${w.c1._id}`, { token: w.facA.token });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.length, 2);
  assert.equal(JSON.stringify(ok.body).includes("@test.edu"), false, "no emails in analytics rows");
  const perf = (c, s, t) => srv.call("GET", `/api/analytics/course/${c._id}/student/${s._id}`, { token: t });
  assert.equal((await perf(w.c1, w.s1, w.s1.token)).status, 200);
  assert.equal((await perf(w.c1, w.s2, w.s1.token)).status, 403);
  assert.equal((await perf(w.c1, w.s3, w.s3.token)).status, 403, "not enrolled in that course");
  assert.equal((await perf(w.c1, w.s1, w.facB.token)).status, 403);
  assert.equal((await perf(w.c1, w.s1, w.facA.token)).status, 200);
  assert.equal((await perf(w.c1, w.s3, w.facA.token)).status, 404, "student not in this course");
});

test("student dashboard: overdue first, upcoming next, only own data", async () => {
  await Assignment.create({ course: w.c1._id, title: "Overdue HW", dueDate: hours(-5), createdBy: w.facA._id });
  await Assignment.create({ course: w.c1._id, title: "Soon HW", dueDate: hours(5), createdBy: w.facA._id });
  await Assignment.create({ course: w.c2._id, title: "Other course HW", dueDate: hours(5), createdBy: w.facB._id });
  const d = await srv.call("GET", "/api/analytics/dashboard", { token: w.s1.token });
  assert.equal(d.status, 200);
  assert.deepEqual(d.body.overdueAssignments.map((a) => a.title), ["Overdue HW"]);
  assert.deepEqual(d.body.upcomingAssignments.map((a) => a.title), ["Soon HW"]);
  assert.equal(d.body.enrolledCourses, 1);
  assert.equal(d.body.pendingAssignments, 2);
});

test("faculty dashboard: submissions awaiting grading only from own courses", async () => {
  const a1 = await Assignment.create({ course: w.c1._id, title: "A1", dueDate: hours(-5), createdBy: w.facA._id });
  const a2 = await Assignment.create({ course: w.c2._id, title: "A2", dueDate: hours(-5), createdBy: w.facB._id });
  await Submission.create({ assignment: a1._id, student: w.s1._id, textAnswer: "x", status: "late", isLate: true });
  await Submission.create({ assignment: a2._id, student: w.s3._id, textAnswer: "y", status: "submitted" });
  const d = await srv.call("GET", "/api/analytics/dashboard", { token: w.facA.token });
  assert.equal(d.status, 200);
  assert.equal(d.body.pendingGrading, 1);
  assert.deepEqual(d.body.awaitingGrading.map((x) => x.assignmentTitle), ["A1"]);
  assert.equal(d.body.awaitingGrading[0].isLate, true);
  assert.equal(d.body.coursesSummary.length, 1);
});
