const test = require("node:test");
const assert = require("node:assert/strict");
const { startServer, seedWorld, mkUser, models, mem, hours } = require("./helpers/world");
const { Assignment, Quiz, Course } = models;

let srv, w;
test.before(async () => { srv = await startServer(); });
test.after(async () => { await srv.close(); });
test.beforeEach(async () => { w = await seedWorld(); });

test("students only see enrolled courses; faculty only allocated ones; admin all", async () => {
  assert.deepEqual((await srv.call("GET", "/api/courses", { token: w.s1.token })).body.map((c) => c.code), ["MA101"]);
  assert.deepEqual((await srv.call("GET", "/api/courses", { token: w.s3.token })).body.map((c) => c.code), ["PH101"]);
  assert.deepEqual((await srv.call("GET", "/api/courses", { token: w.facB.token })).body.map((c) => c.code), ["PH101"]);
  assert.equal((await srv.call("GET", "/api/courses", { token: w.admin.token })).body.length, 2);
});

test("course detail: non-members and other faculty are denied", async () => {
  assert.equal((await srv.call("GET", `/api/courses/${w.c1._id}`, { token: w.s3.token })).status, 403);
  assert.equal((await srv.call("GET", `/api/courses/${w.c1._id}`, { token: w.facB.token })).status, 403);
  assert.equal((await srv.call("GET", `/api/courses/${w.c1._id}`, { token: w.facA.token })).status, 200);
  assert.equal((await srv.call("GET", `/api/courses/${w.c1._id}`, { token: w.admin.token })).status, 200);
});

test("students never receive the class roster or other students' emails", async () => {
  const r = await srv.call("GET", `/api/courses/${w.c1._id}`, { token: w.s1.token });
  assert.equal(r.status, 200);
  assert.equal(r.body.studentCount, 2);
  assert.deepEqual(r.body.students.map(String), [String(w.s1._id)], "only own id");
  assert.equal(JSON.stringify(r.body).includes(w.s2.email), false);
  const list = await srv.call("GET", "/api/courses", { token: w.s1.token });
  assert.equal(JSON.stringify(list.body).includes(w.s2.email), false);
  const fac = await srv.call("GET", `/api/courses/${w.c1._id}`, { token: w.facA.token });
  assert.equal(fac.body.students.length, 2);
  assert.ok(fac.body.students[0].name, "faculty gets populated roster");
});

test("catalogue (/courses/all) hides materials and roster", async () => {
  await srv.call("POST", `/api/courses/${w.c1._id}/materials`, { token: w.facA.token, form: pdfForm({ title: "Notes" }) });
  const r = await srv.call("GET", "/api/courses/all", { token: w.s3.token });
  assert.equal(r.status, 200);
  const c1 = r.body.find((c) => c.code === "MA101");
  assert.equal(c1.materials, undefined);
  assert.deepEqual(c1.students, []);
  assert.equal(c1.studentCount, 2);
  assert.equal(c1.faculty.email, undefined);
});

function pdfForm(fields = {}, content = "%PDF-1.4\nhello", name = "n.pdf") {
  const f = new FormData();
  Object.entries(fields).forEach(([k, v]) => f.append(k, v));
  f.append("file", new Blob([content]), name);
  return f;
}

test("only the allocated faculty (or admin) can update/delete a course or manage materials", async () => {
  const id = w.c1._id;
  assert.equal((await srv.call("PUT", `/api/courses/${id}`, { token: w.facB.token, body: { title: "Hacked" } })).status, 403);
  assert.equal((await srv.call("DELETE", `/api/courses/${id}`, { token: w.facB.token })).status, 403);
  assert.equal((await srv.call("POST", `/api/courses/${id}/materials`, { token: w.facB.token, form: pdfForm({ title: "x" }) })).status, 403);
  assert.equal((await srv.call("PUT", `/api/courses/${id}`, { token: w.s1.token, body: { title: "Hacked" } })).status, 403);
  assert.equal((await srv.call("PUT", `/api/courses/${id}`, { token: w.facA.token, body: { title: "Maths II" } })).body.title, "Maths II");
  assert.equal(mem.dump("Course").find((c) => c._id === String(id)).title, "Maths II");
});

test("materials: server-side upload required; client-supplied fileUrl is rejected", async () => {
  const id = w.c1._id;
  const r = await srv.call("POST", `/api/courses/${id}/materials`, { token: w.facA.token, body: { title: "Evil", fileUrl: "http://evil.example/x.exe" } });
  assert.equal(r.status, 400);
  const f = new FormData(); f.append("title", "Evil"); f.append("fileUrl", "https://evil.example/malware");
  assert.equal((await srv.call("POST", `/api/courses/${id}/materials`, { token: w.facA.token, form: f })).status, 400);
  const ok = await srv.call("POST", `/api/courses/${id}/materials`, { token: w.facA.token, form: pdfForm({ title: "Syllabus" }) });
  assert.equal(ok.status, 201);
  const m = ok.body.materials[0];
  assert.match(m.fileUrl, /^\/uploads\/[A-Za-z0-9._-]+\.pdf$/);
  const stored = JSON.stringify(mem.dump("Course"));
  assert.equal(stored.includes("evil.example"), false);
});

test("self-enrolment: students only; no duplicates; unknown/invalid ids handled", async () => {
  assert.equal((await srv.call("POST", `/api/courses/${w.c2._id}/enroll`, { token: w.facA.token })).status, 403);
  const r = await srv.call("POST", `/api/courses/${w.c2._id}/enroll`, { token: w.s1.token });
  assert.equal(r.status, 200);
  assert.equal((await srv.call("POST", `/api/courses/${w.c2._id}/enroll`, { token: w.s1.token })).status, 400);
  assert.equal(mem.dump("Course").find((c) => c._id === String(w.c2._id)).students.filter((s) => s === String(w.s1._id)).length, 1);
  assert.equal((await srv.call("POST", `/api/courses/not-an-id/enroll`, { token: w.s1.token })).status, 400);
  assert.equal((await srv.call("POST", `/api/courses/507f1f77bcf86cd799439099/enroll`, { token: w.s1.token })).status, 404);
});

test("course creation validates input; duplicate codes rejected; admin must allocate faculty", async () => {
  assert.equal((await srv.call("POST", "/api/courses", { token: w.facA.token, body: { title: "", code: "X" } })).status, 400);
  assert.equal((await srv.call("POST", "/api/courses", { token: w.facA.token, body: { title: { $gt: "" }, code: "X" } })).status, 400);
  assert.equal((await srv.call("POST", "/api/courses", { token: w.s1.token, body: { title: "T", code: "T1" } })).status, 403);
  assert.equal((await srv.call("POST", "/api/courses", { token: w.facA.token, body: { title: "Chem", code: "MA101" } })).status, 400);
  const ok = await srv.call("POST", "/api/courses", { token: w.facA.token, body: { title: "Chem", code: "CH101" } });
  assert.equal(ok.status, 201);
  assert.equal(String(ok.body.faculty), String(w.facA._id));
  assert.equal((await srv.call("POST", "/api/courses", { token: w.admin.token, body: { title: "Bio", code: "BI1" } })).status, 400, "admin must pick faculty");
  assert.equal((await srv.call("POST", "/api/courses", { token: w.admin.token, body: { title: "Bio", code: "BI1", faculty: String(w.facPending._id) } })).status, 400, "pending faculty not allocatable");
  const adm = await srv.call("POST", "/api/courses", { token: w.admin.token, body: { title: "Bio", code: "BI1", faculty: String(w.facB._id) } });
  assert.equal(adm.status, 201);
  assert.equal(String(adm.body.faculty), String(w.facB._id));
});

test("a course with academic records cannot be deleted (no cascade); an empty one can", async () => {
  await Assignment.create({ course: w.c1._id, title: "HW", dueDate: hours(24), createdBy: w.facA._id });
  const blocked = await srv.call("DELETE", `/api/courses/${w.c1._id}`, { token: w.facA.token });
  assert.equal(blocked.status, 409);
  assert.ok(mem.dump("Course").find((c) => c._id === String(w.c1._id)), "course still exists");
  assert.equal(mem.dump("Assignment").length, 1, "assignment untouched");
  const del = await srv.call("DELETE", `/api/courses/${w.c2._id}`, { token: w.facB.token });
  assert.equal(del.status, 200);
  assert.equal(mem.dump("Course").some((c) => c._id === String(w.c2._id)), false);
  assert.equal(mem.dump("User").find((u) => u._id === String(w.s3._id)).enrolledCourses.length, 0);
});

test("malformed ids return 400, not 500", async () => {
  for (const [m, p] of [["GET", "/api/courses/xyz"], ["GET", "/api/assignments/course/xyz"], ["GET", "/api/quizzes/course/xyz"], ["GET", "/api/attendance/course/xyz"], ["GET", "/api/forum/course/xyz"], ["GET", "/api/analytics/course/xyz"], ["DELETE", "/api/assignments/xyz"], ["GET", "/api/quizzes/xyz/attempt"]]) {
    const r = await srv.call(m, p, { token: w.admin.token });
    assert.equal(r.status, 400, `${m} ${p}`);
  }
});
