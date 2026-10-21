const test = require("node:test");
const assert = require("node:assert/strict");
const { startServer, seedWorld, models, mem, hours } = require("./helpers/world");
const { Quiz, QuizStart, QuizAttempt } = models;

let srv, w;
test.before(async () => { srv = await startServer(); });
test.after(async () => { await srv.close(); });
test.beforeEach(async () => { w = await seedWorld(); });

const questions = [
  { questionText: "2+2?", options: ["3", "4", "5"], correctOptionIndex: 1, marks: 2 },
  { questionText: "Capital?", options: ["A", "B"], correctOptionIndex: 0, marks: 3 },
];
const mk = (over = {}) => Quiz.create({ course: w.c1._id, title: "Q1", duration: 30, startTime: hours(-1), endTime: hours(1), questions, createdBy: w.facA._id, ...over });
const open = (token, id) => srv.call("GET", `/api/quizzes/${id}/attempt`, { token });
const submit = (token, id, answers) => srv.call("POST", `/api/quizzes/${id}/attempt`, { token, body: { answers } });

test("creation: validated and limited to the allocated faculty", async () => {
  const body = { course: String(w.c1._id), title: "T", duration: 10, startTime: hours(1).toISOString(), endTime: hours(2).toISOString(), questions };
  assert.equal((await srv.call("POST", "/api/quizzes", { token: w.facB.token, body })).status, 403);
  assert.equal((await srv.call("POST", "/api/quizzes", { token: w.s1.token, body })).status, 403);
  assert.equal((await srv.call("POST", "/api/quizzes", { token: w.facA.token, body: { ...body, duration: -5 } })).status, 400);
  assert.equal((await srv.call("POST", "/api/quizzes", { token: w.facA.token, body: { ...body, endTime: body.startTime } })).status, 400);
  assert.equal((await srv.call("POST", "/api/quizzes", { token: w.facA.token, body: { ...body, questions: [{ questionText: "x", options: ["a", "b"], correctOptionIndex: 9 }] } })).status, 400);
  assert.equal((await srv.call("POST", "/api/quizzes", { token: w.facA.token, body })).status, 201);
});

test("correct answers are never sent to students; question text hidden in lists", async () => {
  const q = await mk();
  const list = await srv.call("GET", `/api/quizzes/course/${w.c1._id}`, { token: w.s1.token });
  assert.equal(list.status, 200);
  assert.equal(JSON.stringify(list.body).includes("correctOptionIndex"), false);
  assert.equal(JSON.stringify(list.body).includes("2+2?"), false, "question text hidden before start");
  assert.equal(list.body[0].questions.length, 2, "count still available");
  assert.equal(list.body[0].windowState, "open");
  const attempt = await open(w.s1.token, q._id);
  assert.equal(attempt.status, 200);
  assert.equal(JSON.stringify(attempt.body).includes("correctOptionIndex"), false);
  assert.ok(attempt.body.questions[0].questionText);
  assert.ok(attempt.body.remainingSeconds > 0 && attempt.body.remainingSeconds <= 1800);
  assert.equal((await srv.call("GET", `/api/quizzes/${q._id}/full`, { token: w.s1.token })).status, 403);
  assert.equal((await srv.call("GET", `/api/quizzes/${q._id}/full`, { token: w.facB.token })).status, 403);
  assert.equal((await srv.call("GET", `/api/quizzes/${q._id}/full`, { token: w.facA.token })).body.questions[0].correctOptionIndex, 1);
});

test("non-members cannot list, open, or submit a quiz", async () => {
  const q = await mk();
  assert.equal((await srv.call("GET", `/api/quizzes/course/${w.c1._id}`, { token: w.s3.token })).status, 403);
  assert.equal((await open(w.s3.token, q._id)).status, 403);
  assert.equal((await submit(w.s3.token, q._id, [1, 0])).status, 403);
  assert.equal(mem.dump("QuizAttempt").length, 0);
});

test("availability window enforced: not yet open / closed", async () => {
  const future = await mk({ startTime: hours(1), endTime: hours(2) });
  const past = await mk({ title: "old", startTime: hours(-3), endTime: hours(-1) });
  assert.equal((await open(w.s1.token, future._id)).status, 403);
  assert.equal((await open(w.s1.token, past._id)).status, 403);
  assert.equal((await submit(w.s1.token, future._id, [1, 0])).status, 400, "cannot submit without having opened");
  assert.equal(mem.dump("QuizStart").length, 0);
});

test("submission requires opening first; scoring is server-side; one attempt only", async () => {
  const q = await mk();
  assert.equal((await submit(w.s1.token, q._id, [1, 0])).status, 400);
  await open(w.s1.token, q._id);
  const r = await submit(w.s1.token, q._id, [1, 0]);
  assert.equal(r.status, 201);
  assert.equal(r.body.score, 5);
  assert.equal(r.body.totalMarks, 5);
  assert.equal(String(r.body.student), String(w.s1._id));
  assert.equal((await submit(w.s1.token, q._id, [0, 1])).status, 400, "second attempt");
  assert.equal(mem.dump("QuizAttempt").length, 1);
  assert.equal(mem.dump("QuizAttempt")[0].score, 5, "original score preserved");
});

test("client cannot inject score or student", async () => {
  const q = await mk();
  await open(w.s1.token, q._id);
  const r = await srv.call("POST", `/api/quizzes/${q._id}/attempt`, { token: w.s1.token, body: { answers: [0, 1], score: 999, student: String(w.s2._id), totalMarks: 999 } });
  assert.equal(r.status, 201);
  assert.equal(r.body.score, 0);
  assert.equal(String(r.body.student), String(w.s1._id));
});

test("answers validated: wrong length, out-of-range, non-array, wrong types", async () => {
  const q = await mk();
  await open(w.s1.token, q._id);
  for (const bad of [[1], [1, 0, 1], [1, 7], [1.5, 0], "1,0", { 0: 1 }, [1, "0"]]) {
    assert.equal((await submit(w.s1.token, q._id, bad)).status, 400, JSON.stringify(bad));
  }
  assert.equal(mem.dump("QuizAttempt").length, 0);
  assert.equal((await submit(w.s1.token, q._id, [-1, -1])).status, 201, "unanswered allowed");
});

test("duration enforced server-side (even if the window is still open)", async () => {
  const q = await mk({ duration: 10 });
  await open(w.s1.token, q._id);
  // simulate that the student opened the quiz 11 minutes ago
  mem.mutate("QuizStart", (d) => { d.startedAt = new Date(Date.now() - 11 * 60 * 1000); });
  const late = await submit(w.s1.token, q._id, [1, 0]);
  assert.equal(late.status, 400);
  assert.match(late.body.message, /time is up/i);
  assert.equal(mem.dump("QuizAttempt").length, 0);
  // within duration is fine
  await open(w.s2.token, q._id);
  mem.mutate("QuizStart", (d) => { if (d.student === String(w.s2._id)) d.startedAt = new Date(Date.now() - 9 * 60 * 1000); });
  assert.equal((await submit(w.s2.token, q._id, [1, 0])).status, 201);
});

test("window end also caps the attempt even if duration remains", async () => {
  const q = await mk({ duration: 60, startTime: hours(-1), endTime: new Date(Date.now() + 2 * 60 * 1000) });
  await open(w.s1.token, q._id);
  mem.mutate("QuizStart", (d) => { d.startedAt = new Date(Date.now() - 5 * 60 * 1000); });
  mem.mutate("Quiz", (d) => { d.endTime = new Date(Date.now() - 60 * 1000); });
  assert.equal((await submit(w.s1.token, q._id, [1, 0])).status, 400);
});

test("reopening does not reset the clock", async () => {
  const q = await mk();
  const a = await open(w.s1.token, q._id);
  await new Promise((r) => setTimeout(r, 20));
  const b = await open(w.s1.token, q._id);
  assert.equal(a.body.startedAt, b.body.startedAt);
  assert.equal(mem.dump("QuizStart").length, 1);
});

test("attempt ownership: students only read their own attempt; faculty results scoped to allocated course", async () => {
  const q = await mk();
  await open(w.s1.token, q._id);
  await submit(w.s1.token, q._id, [1, 0]);
  assert.equal((await srv.call("GET", `/api/quizzes/${q._id}/my-attempt`, { token: w.s1.token })).body.score, 5);
  assert.equal((await srv.call("GET", `/api/quizzes/${q._id}/my-attempt`, { token: w.s2.token })).body, null);
  assert.equal((await srv.call("GET", `/api/quizzes/${q._id}/my-attempt`, { token: w.s3.token })).status, 403);
  assert.equal((await srv.call("GET", `/api/quizzes/${q._id}/results`, { token: w.s1.token })).status, 403);
  assert.equal((await srv.call("GET", `/api/quizzes/${q._id}/results`, { token: w.facB.token })).status, 403);
  const res = await srv.call("GET", `/api/quizzes/${q._id}/results`, { token: w.facA.token });
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
});

test("quizzes with attempts cannot be deleted", async () => {
  const a = await mk(), b = await mk({ title: "none" });
  await open(w.s1.token, a._id); await submit(w.s1.token, a._id, [1, 0]);
  assert.equal((await srv.call("DELETE", `/api/quizzes/${a._id}`, { token: w.facA.token })).status, 409);
  assert.equal(mem.dump("QuizAttempt").length, 1);
  assert.equal((await srv.call("DELETE", `/api/quizzes/${b._id}`, { token: w.facB.token })).status, 403);
  assert.equal((await srv.call("DELETE", `/api/quizzes/${b._id}`, { token: w.facA.token })).status, 200);
});
