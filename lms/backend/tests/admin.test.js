const test = require("node:test");
const assert = require("node:assert/strict");
const { startServer, seedWorld, mkUser, models, mem, hours } = require("./helpers/world");
const { Assignment, Submission, Attendance } = models;

let srv, w;
test.before(async () => { srv = await startServer(); });
test.after(async () => { await srv.close(); });
test.beforeEach(async () => { w = await seedWorld(); });

const A = (m, p, body) => srv.call(m, `/api/admin${p}`, { token: w.admin.token, body });
const id = (u) => String(u._id);

const ENDPOINTS = [
  ["GET", "/overview"], ["GET", "/users"], ["GET", "/users/{u}"], ["PATCH", "/users/{u}"], ["PATCH", "/users/{u}/status"],
  ["GET", "/faculty/pending"], ["POST", "/faculty/{u}/approve"], ["POST", "/faculty/{u}/reject"],
  ["GET", "/options"], ["POST", "/options"], ["PATCH", "/options/{u}"], ["DELETE", "/options/{u}"],
  ["GET", "/courses"], ["GET", "/courses/{c}/roster"], ["POST", "/courses/{c}/allocate"], ["POST", "/courses/{c}/students"], ["DELETE", "/courses/{c}/students/{u}"],
  ["GET", "/reports/summary"], ["GET", "/reports/courses"], ["GET", "/reports/attendance"], ["GET", "/reports/assignments"], ["GET", "/audit-logs"],
];

test("EVERY admin endpoint rejects anonymous, student, faculty and pending users", async () => {
  const fill = (p) => p.replace("{u}", id(w.s1)).replace("{c}", id(w.c1));
  const body = { status: "disabled", facultyId: id(w.facB), studentIds: [id(w.s3)], type: "department", name: "X" };
  const before = JSON.stringify([mem.dump("User"), mem.dump("Course"), mem.dump("AcademicOption")]);
  for (const [m, p] of ENDPOINTS) {
    const url = `/api/admin${fill(p)}`;
    assert.equal((await srv.call(m, url, { body: ["GET", "HEAD"].includes(m) ? undefined : body })).status, 401, `anon ${m} ${p}`);
    for (const [label, tok] of [["student", w.s1.token], ["faculty", w.facA.token], ["pending faculty", w.facPending.token]]) {
      const r = await srv.call(m, url, { token: tok, body: ["GET", "HEAD"].includes(m) ? undefined : body });
      assert.equal(r.status, 403, `${label} ${m} ${p} -> ${r.status}`);
    }
  }
  assert.equal(JSON.stringify([mem.dump("User"), mem.dump("Course"), mem.dump("AcademicOption")]), before, "no state changed by forbidden calls");
  assert.equal(mem.dump("AuditLog").length, 0);
});

test("overview returns counts, pending faculty and recent activity", async () => {
  const r = await A("GET", "/overview");
  assert.equal(r.status, 200);
  assert.equal(r.body.counts.students, 3);
  assert.equal(r.body.counts.pendingFaculty, 1);
  assert.equal(r.body.pendingFaculty.length, 1);
  assert.equal(r.body.pendingFaculty[0].password, undefined);
});

test("user list: filters, search, pagination; never returns passwords", async () => {
  const all = await A("GET", "/users");
  assert.equal(all.body.total, 7);
  assert.equal(JSON.stringify(all.body).includes("$2"), false, "no bcrypt hashes");
  assert.equal((await A("GET", "/users?role=faculty")).body.total, 3);
  assert.equal((await A("GET", "/users?status=pending")).body.total, 1);
  assert.equal((await A("GET", "/users?q=student%20two")).body.users[0].name, "Student Two");
  const page = await A("GET", "/users?limit=3&page=2");
  assert.equal(page.body.users.length, 3); assert.equal(page.body.pages, 3);
  assert.equal((await A("GET", "/users?q=.*")).body.total, 0, "regex metacharacters are escaped");
});

test("faculty approval: approve and reject flow, idempotency guard, audit trail", async () => {
  const appr = await A("POST", `/faculty/${id(w.facPending)}/approve`);
  assert.equal(appr.status, 200); assert.equal(appr.body.status, "active");
  assert.equal((await A("POST", `/faculty/${id(w.facPending)}/approve`)).status, 409);
  assert.equal((await A("POST", `/faculty/${id(w.facPending)}/reject`)).status, 409, "cannot reject an active user via this route");
  const other = await mkUser({ role: "faculty", status: "pending" });
  assert.equal((await A("POST", `/faculty/${id(other)}/reject`)).body.status, "rejected");
  assert.equal((await A("POST", `/faculty/${id(w.s1)}/approve`)).status, 404, "students are not faculty registrations");
  const logs = mem.dump("AuditLog").map((l) => l.action).sort();
  assert.deepEqual(logs, ["faculty.approve", "faculty.reject"]);
  const rejectedLogin = await srv.call("POST", "/api/auth/login", { body: { email: other.email, password: "Test1234pass" } });
  assert.equal(rejectedLogin.status, 403);
});

test("enable/disable users: blocks access immediately; cannot change self; pending needs approval route", async () => {
  assert.equal((await A("PATCH", `/users/${id(w.s1)}/status`, { status: "disabled" })).body.status, "disabled");
  assert.equal((await srv.call("GET", "/api/courses", { token: w.s1.token })).status, 403, "existing token stops working");
  assert.equal((await srv.call("POST", "/api/auth/login", { body: { email: w.s1.email, password: "Test1234pass" } })).status, 403);
  assert.equal((await A("PATCH", `/users/${id(w.s1)}/status`, { status: "active" })).status, 200);
  assert.equal((await srv.call("GET", "/api/courses", { token: w.s1.token })).status, 200);
  assert.equal((await A("PATCH", `/users/${id(w.admin)}/status`, { status: "disabled" })).status, 400, "self");
  assert.equal((await A("PATCH", `/users/${id(w.s1)}/status`, { status: "admin" })).status, 400);
  assert.equal((await A("PATCH", `/users/${id(w.facPending)}/status`, { status: "active" })).status, 400);
  assert.equal(mem.dump("AuditLog").filter((l) => l.action === "user.disable").length, 1);
});

test("admin cannot change role/email/status through the profile-update route", async () => {
  const r = await A("PATCH", `/users/${id(w.s1)}`, { department: "Mech", section: "B", role: "admin", email: "x@y.zz", status: "disabled", password: "Hacked1234" });
  assert.equal(r.status, 200);
  assert.equal(r.body.department, "Mech");
  const stored = mem.dump("User").find((u) => u._id === id(w.s1));
  assert.equal(stored.role, "student"); assert.equal(stored.email, w.s1.email); assert.equal(stored.status, "active");
  assert.notEqual(stored.password, "Hacked1234");
});

test("academic options: CRUD, uniqueness, validation, in-use protection", async () => {
  assert.equal((await A("POST", "/options", { type: "bogus", name: "X" })).status, 400);
  assert.equal((await A("POST", "/options", { type: "department", name: "  " })).status, 400);
  const dept = await A("POST", "/options", { type: "department", name: "Computer Science" });
  assert.equal(dept.status, 201);
  assert.equal((await A("POST", "/options", { type: "department", name: "Computer Science" })).status, 409);
  assert.equal((await A("POST", "/options", { type: "section", name: "Computer Science" })).status, 201, "same name allowed for different type");
  assert.equal((await A("GET", "/options?type=department")).body.length, 1);
  assert.equal((await A("GET", "/options?type=zzz")).status, 400);
  const rename = await A("PATCH", `/options/${dept.body._id}`, { name: "CSE" });
  assert.equal(rename.body.name, "CSE");
  await A("PATCH", `/users/${id(w.s1)}`, { department: "CSE" });
  assert.equal((await A("DELETE", `/options/${dept.body._id}`)).status, 409, "in use");
  assert.equal((await A("PATCH", `/options/${dept.body._id}`, { name: "Renamed" })).status, 409, "in use: no rename");
  const off = await A("PATCH", `/options/${dept.body._id}`, { active: false });
  assert.equal(off.body.active, false);
  assert.deepEqual((await srv.call("GET", "/api/auth/options")).body.department, []);
  const unused = await A("POST", "/options", { type: "studyYear", name: "Year 1" });
  assert.equal((await A("DELETE", `/options/${unused.body._id}`)).status, 200);
  assert.ok(mem.dump("AuditLog").some((l) => l.action === "option.create"));
});

test("allocation: moves a course between faculty and keeps both sides consistent", async () => {
  const r = await A("POST", `/courses/${id(w.c1)}/allocate`, { facultyId: id(w.facB) });
  assert.equal(r.status, 200);
  const users = mem.dump("User");
  assert.equal(users.find((u) => u._id === id(w.facA)).teachingCourses.includes(id(w.c1)), false);
  assert.equal(users.find((u) => u._id === id(w.facB)).teachingCourses.includes(id(w.c1)), true);
  // new faculty now manages it; old faculty lost access (server-side)
  assert.equal((await srv.call("PUT", `/api/courses/${w.c1._id}`, { token: w.facB.token, body: { title: "B's now" } })).status, 200);
  assert.equal((await srv.call("PUT", `/api/courses/${w.c1._id}`, { token: w.facA.token, body: { title: "nope" } })).status, 403);
  assert.equal((await srv.call("GET", "/api/courses", { token: w.facA.token })).body.length, 0);
  // invalid targets
  assert.equal((await A("POST", `/courses/${id(w.c1)}/allocate`, { facultyId: id(w.s1) })).status, 400, "student");
  assert.equal((await A("POST", `/courses/${id(w.c1)}/allocate`, { facultyId: id(w.facPending) })).status, 400, "pending faculty");
  assert.equal((await A("POST", `/courses/${id(w.c1)}/allocate`, { facultyId: "bad" })).status, 400);
  assert.equal((await A("POST", `/courses/507f1f77bcf86cd799439099/allocate`, { facultyId: id(w.facA) })).status, 404);
  assert.ok(mem.dump("AuditLog").some((l) => l.action === "course.allocate"));
});

test("enrollment management: add (students only, active only), remove, kept in sync, student gains access", async () => {
  const dis = await mkUser({ status: "disabled" });
  const r = await A("POST", `/courses/${id(w.c1)}/students`, { studentIds: [id(w.s3), id(w.facA), id(dis)] });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { enrolled: 1, skipped: 2 });
  assert.equal((await srv.call("GET", `/api/courses/${w.c1._id}`, { token: w.s3.token })).status, 200, "s3 can now open the course");
  assert.equal(mem.dump("User").find((u) => u._id === id(w.s3)).enrolledCourses.includes(id(w.c1)), true);
  await A("POST", `/courses/${id(w.c1)}/students`, { studentIds: [id(w.s3)] });
  assert.equal(mem.dump("Course").find((c) => c._id === id(w.c1)).students.filter((s) => s === id(w.s3)).length, 1, "no duplicate enrolment");
  assert.equal((await A("POST", `/courses/${id(w.c1)}/students`, { studentIds: [] })).status, 400);
  assert.equal((await A("POST", `/courses/${id(w.c1)}/students`, { studentIds: ["bad"] })).status, 400);
  assert.equal((await A("DELETE", `/courses/${id(w.c1)}/students/${id(w.s3)}`)).status, 200);
  assert.equal((await srv.call("GET", `/api/courses/${w.c1._id}`, { token: w.s3.token })).status, 403, "access removed");
  const roster = await A("GET", `/courses/${id(w.c1)}/roster`);
  assert.equal(roster.body.students.length, 2);
  assert.equal(roster.body.materials, undefined);
});

test("course list filtering/pagination for allocation screen", async () => {
  const r = await A("GET", "/courses");
  assert.equal(r.body.total, 2);
  assert.equal(r.body.courses[0].faculty.name.startsWith("Faculty"), true);
  assert.equal(r.body.courses[0].studentCount >= 1, true);
  assert.equal((await A("GET", "/courses?q=phys")).body.total, 1);
  assert.equal((await A("GET", `/courses?faculty=${id(w.facA)}`)).body.courses[0].code, "MA101");
});

test("reports: summary, courses, attendance (with low-attendance list), assignments", async () => {
  const a = await Assignment.create({ course: w.c1._id, title: "HW", dueDate: hours(-5), maxMarks: 10, createdBy: w.facA._id });
  await Submission.create({ assignment: a._id, student: w.s1._id, textAnswer: "x", status: "graded", marksObtained: 8, isLate: true });
  await Submission.create({ assignment: a._id, student: w.s2._id, textAnswer: "y", status: "submitted" });
  const day = (d) => new Date(`2026-02-0${d}T00:00:00`);
  await Attendance.create({ course: w.c1._id, date: day(1), markedBy: w.facA._id, records: [{ student: w.s1._id, status: "present" }, { student: w.s2._id, status: "absent" }] });
  await Attendance.create({ course: w.c1._id, date: day(2), markedBy: w.facA._id, records: [{ student: w.s1._id, status: "present" }, { student: w.s2._id, status: "absent" }] });

  const sum = await A("GET", "/reports/summary");
  assert.equal(sum.status, 200);
  assert.equal(sum.body.usersByRole.student, 3);
  assert.equal(sum.body.usersByStatus.pending, 1);
  assert.equal(sum.body.totalEnrollments, 3);
  assert.equal(sum.body.attendance.percentage, 50);

  const courses = await A("GET", "/reports/courses");
  const ma = courses.body.find((c) => c.code === "MA101");
  assert.deepEqual({ s: ma.students, a: ma.assignments, ses: ma.attendanceSessions, p: ma.attendancePercentage, f: ma.faculty }, { s: 2, a: 1, ses: 2, p: 50, f: "Faculty A" });

  const att = await A("GET", `/reports/attendance?courseId=${id(w.c1)}&threshold=75`);
  assert.equal(att.body.belowThreshold.length, 1);
  assert.equal(att.body.belowThreshold[0].student.name, "Student Two");
  assert.equal((await A("GET", "/reports/attendance?courseId=bad")).status, 400);
  assert.equal((await A("GET", "/reports/attendance?from=zzz")).status, 400);

  const asg = await A("GET", "/reports/assignments");
  const row = asg.body.find((r) => r.course.code === "MA101");
  assert.deepEqual({ n: row.assignments, s: row.submissions, l: row.late, g: row.graded, w: row.awaitingGrading, p: row.avgPercentage }, { n: 1, s: 2, l: 1, g: 1, w: 1, p: 80 });
});

test("audit log: lists sensitive actions with actor; filterable; paginated; read-only", async () => {
  await A("POST", `/faculty/${id(w.facPending)}/approve`);
  await A("PATCH", `/users/${id(w.s1)}/status`, { status: "disabled" });
  await A("POST", "/options", { type: "department", name: "ECE" });
  const r = await A("GET", "/audit-logs");
  assert.equal(r.status, 200);
  assert.equal(r.body.total, 3);
  assert.equal(r.body.logs[0].actorName, "Admin");
  assert.equal(String(r.body.logs[0].actor), id(w.admin));
  assert.equal((await A("GET", "/audit-logs?action=faculty.approve")).body.total, 1);
  assert.equal((await A("GET", "/audit-logs?limit=1")).body.logs.length, 1);
  assert.equal((await srv.call("DELETE", "/api/admin/audit-logs", { token: w.admin.token })).status, 404, "no delete route exists");
  assert.equal((await srv.call("PUT", "/api/admin/audit-logs", { token: w.admin.token, body: {} })).status, 404);
});

test("invalid admin route ids → 400", async () => {
  for (const p of ["/users/xyz", "/courses/xyz/roster", "/options/xyz"]) assert.equal((await A("GET", p)).status === 400 || (await A("PATCH", p, {})).status === 400, true, p);
});
