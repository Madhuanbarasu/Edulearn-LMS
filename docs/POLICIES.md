# EduLearn business rules (decisions for the PRD "Open decisions")

| Question | Implemented policy |
|---|---|
| Late assignments | **Accepted and flagged late** (`isLate`, status `late`). Shown to student and faculty. |
| Resubmission | Allowed **until graded**; a new submission replaces the old one. Once graded it is **locked** (409). Faculty may regrade. Enforced atomically in the database query. |
| Grades visible to students | A grade is visible as soon as faculty save it (existing behaviour, preserved). |
| Marks | Number, 0 ≤ marks ≤ assignment `maxMarks`. |
| Quiz attempts | **One attempt per student** (existing unique index). Opening the quiz starts a server-side clock (`QuizStart`); submission must arrive within `min(duration, window end)` + 15 s grace, else rejected. Questions are not shown to students before they start; correct answers are never sent to students. |
| Attendance edits | The allocated faculty (or admin) may re-save a day; one document per course per day. Future dates rejected. Late counts as attended. |
| Course deletion | Blocked (409) once a course has assignments, quizzes, attendance or forum posts. No cascades. Empty courses can be deleted. |
| Assignment / quiz deletion | Blocked once submissions / attempts exist. |
| Enrollment | Students may still self-enroll (existing behaviour). Admin can also enroll/remove students; removing keeps all past records. |
| Course creation | Faculty create courses allocated to themselves (existing behaviour). Admin creates a course only with an active faculty allocated. Admin can reassign. |
| Faculty approval | Registration → `pending` → admin approves (`active`) or rejects (`rejected`). Disabled/pending/rejected accounts get 403 on every protected route, including with existing tokens. |
| Passwords | Min 8 chars with upper, lower and digit (new passwords only: existing 6-char passwords still log in). Changing password revokes older tokens. |
| Dates | Attendance keeps the original convention (server-local midnight) so existing records stay compatible. Academic-year labels are free-form admin-managed options (e.g. `2026-27`). |
