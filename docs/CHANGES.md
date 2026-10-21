# Summary of changes

## Backend
* `app.js` / `server.js` split (testable app). Fail-fast env validation. Helmet, explicit CORS, rate limits (login/register/password: 20 per 15 min per IP; API: 300/min), 1 MB body limit, operator-injection rejection (`$`/dotted keys), malformed-ID → 400, safe error handler (no stack traces).
* Auth: validated registration, no admin self-registration, faculty pending flow, status gating on every request, token revocation on password change, profile and password-change endpoints, public academic options endpoint.
* Authorization on every read and write: course membership, allocated-faculty checks, student data scoping (attendance, submissions, quizzes, analytics, forum, rosters).
* Files: removed public static serving; `/api/files/access` + short-lived signed download; extension allow-list, content-signature check, server-generated names, no client file URLs.
* Admin API (`/api/admin/*`, admin-only): overview, users and status, faculty approval, academic options, allocation, enrollment, reports (summary, courses, attendance, assignments), audit log. Audit entries for sensitive actions.
* `npm run create-admin` secure bootstrap.
* Bug found by tests and fixed: populated `faculty` broke the allocated-faculty check in `getCourseById`.

## Frontend
Theme (persistent, no flash), app shell with role-aware nav, Login/Register with inline validation, password checklist and pending-approval screen, Profile & Settings, role dashboards (overdue/upcoming first), full Admin module, protected file downloads, late/locked/overdue indicators, quiz start screen with countdown + auto-submit, skip link, labelled controls.

## Dependencies
* Added backend: `helmet@^7` (security headers), `express-rate-limit@^7` (rate limiting). Lockfile regenerated with npm. `npm audit`: 0 vulnerabilities.
* Frontend: no new packages. `react-router-dom` updated within `^6` to 6.30.6.

## Data / schema (additive only)
`User`: status, academicYear, studyYear, section, passwordChangedAt. `Course`: department, academicYear, studyYear, section. `Submission`: isLate, gradedAt, gradedBy. New: `AcademicOption`, `AuditLog`, `QuizStart`.

## API compatibility notes
Response shapes are preserved except: students receive `studentCount` and only their own id in `students` (no roster); quiz lists for students carry question stubs; duplicate email now 409 (was 400); `POST /auth/register` for faculty returns no token; direct `/uploads/*` URLs return 403.
