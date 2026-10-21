# EduLearn LMS --- Product Requirements Document (PRD)

**Document status:** Draft for review\
**Product:** EduLearn LMS

## 1. Product overview

EduLearn LMS is a web-based learning management system for an
educational institution. It supports student learning and faculty
teaching workflows, including courses, learning materials, assignments,
quizzes, attendance, discussions, and analytics.

This project must evolve from the existing working application. Existing
student/faculty workflows and stored records must be preserved. New work
must be developed and verified in a separate development copy before it
is considered for the original working project.

## 2. Goals

1.  Preserve existing working LMS features.
2.  Provide clear workflows for students, faculty, and administrators.
3.  Improve authentication, authorization, validation, and file access.
4.  Manage academic information by department, academic year, study
    year, and section.
5.  Provide a consistent responsive interface with persistent light/dark
    theme preference.
6.  Verify changes with automated tests and an isolated test database
    before deployment.

## 3. Roles and permissions

### Student

Students can register/sign in, view enrolled courses and materials, view
assignment deadlines and submission status, submit assignments, view
released grades/feedback, attempt available quizzes, view their own
attendance, participate in permitted course discussions, update their
profile, and change their password after verifying the current password.

Students must not access other students' private information, mark
attendance, manage courses, approve accounts, or use administrator
functions.

### Faculty

Faculty can sign in after approval, view allocated courses/classes and
enrolled students, manage materials, create assignments/quizzes, record
attendance for enrolled students, review and grade submissions, provide
feedback, review course analytics, participate in course discussions,
and manage their profile/password.

Faculty must only manage allocated courses/classes.

### Administrator --- planned, not yet available in the current running app

The admin module is planned scope, not a claim that it is already
implemented. It should support user/status management, faculty approval,
academic options (departments, academic years, study years, sections),
faculty/course allocation, enrollment management, summary reports, and
audit-log review. Admin account creation must use a secure controlled
setup process; public registration must not allow users to choose the
admin role. All admin endpoints must enforce server-side role checks.

## 4. Functional requirements

### Authentication and registration

-   Validate required fields and email format; reject duplicate emails.
-   Enforce minimum password length and complexity; show useful
    validation feedback.
-   Support student and faculty registration.
-   Faculty accounts remain pending until approved.
-   Pending/disabled accounts cannot use normal authenticated features.
-   Admin accounts cannot be created through public self-registration.
-   Rate-limit repeated login/registration attempts.

### Courses

-   Restrict course details, rosters, and operations to authorized
    users.
-   Keep enrollment and faculty allocation consistent.
-   Prevent unauthorized users from reading or modifying course data.

### Learning materials and uploads

-   Authorized faculty can add materials to assigned courses; enrolled
    students can access them.
-   Validate upload type and size.
-   Reject arbitrary untrusted file URLs.
-   Restrict downloads to authorized users; use short-lived links where
    appropriate.
-   Do not rewrite or delete existing material records as a code-only
    update.

### Assignments and submissions

-   Faculty can create/manage assignments for authorized courses.
-   Students see deadlines and submission status.
-   Late submissions may be accepted and clearly flagged as late,
    subject to the configured policy.
-   Faculty can grade submissions and provide feedback.
-   Validate marks against the allowed range.
-   Prevent replacing a graded submission unless a deliberate
    regrade/resubmission policy is implemented.
-   Preserve existing assignment/submission records.

### Quizzes

-   Faculty can configure quizzes for authorized courses.
-   Enforce availability windows and attempt duration server-side.
-   Validate submitted answers and attempt ownership.
-   Associate attempts with the correct student and quiz.

### Attendance

-   Only authorized faculty can record attendance for enrolled students.
-   Validate student/course association, status, and date.
-   Prevent duplicate records for the same student/course/session where
    applicable.
-   Students can view their own attendance, not others' histories.
-   Preserve existing attendance documents.

### Discussions and analytics

-   Restrict discussion access to authorized course members.
-   Validate ownership before editing/deleting posts.
-   Restrict analytics to authorized users and avoid unnecessary
    personal-data exposure.
-   Add improved metrics compatibly where possible.

### Profile and settings

-   Users can update permitted profile fields.
-   Require current-password verification before password changes.
-   Persist light/dark theme preference.
-   Profile edits must not change role or account status.

### Admin workflows --- planned

Implement user/status management, faculty approval, academic-option
management, faculty/course allocation, enrollment, reports, and audit
logs. All operations must be role-protected and tested before being
presented as available.

## 5. UI and experience

-   Professional, consistent college ERP/LMS design rather than generic
    generated-dashboard styling.
-   Consistent navigation, typography, spacing, forms, tables, alerts,
    and status labels.
-   Responsive desktop, tablet, and mobile layouts.
-   Persistent light/dark theme.
-   Clear loading, empty, success, and error states.
-   Make overdue/upcoming deadlines easy to identify.
-   Keyboard-accessible controls and clear labels.
-   Preserve existing working interactions while improving
    incrementally.

## 6. Technology constraints

Current stack: - Frontend: React 18, Vite, React Router, Axios. -
Backend: Node.js, Express 4, CommonJS. - Database/ODM: MongoDB with
Mongoose. - Authentication: JWT. - Password hashing: bcryptjs. - Upload
handling: Multer.

Do not switch frameworks or rewrite the application without explicit
approval. Add dependencies only when justified, update lockfiles, and
document security-relevant dependency changes.

## 7. Data safety and compatibility

-   Never run development tests against the real MongoDB Atlas database.
-   Use a separate disposable test database and test-only credentials.
-   Never include real `.env` files, database URIs, API keys, JWT
    secrets, or passwords in deliverables.
-   Do not delete or rewrite existing user, course, submission,
    attendance, quiz, or other records.
-   Prefer additive model changes and backward-compatible APIs.
-   Avoid destructive migrations and cascading deletes unless explicitly
    approved and backed up.
-   Keep the original working project untouched; develop and test in a
    separate copy.
-   Do not deploy while required tests or security checks fail.

## 8. Non-functional requirements

### Security

Enforce server-side authentication and role/course authorization;
validate request bodies, query parameters, route IDs, and uploaded
files; use explicit CORS origins; apply security headers and rate
limiting; avoid leaking stack traces/secrets; keep secrets in
environment variables.

### Reliability and maintainability

Return consistent status codes and safe errors, handle invalid IDs and
missing resources, validate required configuration, avoid logging
secrets, document requirements/design/stack/test instructions, and add
automated tests for critical rules.

## 9. Acceptance criteria

The project is not complete until these are verified: 1. Existing
student/faculty login and core workflows still function. 2. Registration
validation, duplicate-email handling, and faculty approval work. 3.
Students cannot access other students' private attendance/data. 4.
Faculty cannot manage unallocated courses/classes. 5. Assignment
deadlines, submissions, grading, and late status behave correctly. 6.
Quiz timing, attempt ownership, and answer validation are enforced
server-side. 7. Attendance validation and duplicate handling are
correct. 8. Material access is authorized and uploads are validated. 9.
Profile updates and password changes are secure. 10. Admin workflows are
implemented, role-protected, and tested before being presented as
available. 11. Frontend production build succeeds. 12. Backend automated
and authorization tests pass. 13. Integration tests pass against a
separate test database. 14. Seeded test records remain readable and
unchanged by unrelated tests. 15. Responsive UI and light/dark theme are
checked. 16. Environment and CORS settings are reviewed. 17. No real
secrets are included in deliverables. 18. Deployment occurs only after
release checks pass.

## 10. Delivery phases

-   **Phase 0 --- Audit and baseline:** document routes, models,
    workflows, and baseline tests.
-   **Phase 1 --- Security and correctness:** harden authentication,
    authorization, validation, uploads, attendance, assignments, and
    quizzes.
-   **Phase 2 --- ERP workflows:** implement and test admin management,
    academic options, allocations, enrollment, reports, and audit logs.
-   **Phase 3 --- UI and profiles:** finish profiles/settings, theme,
    role-specific dashboards, responsive behavior, and workflow polish.
-   **Phase 4 --- Verification and release:** install dependencies,
    update lockfiles, run tests/build, use isolated test DB, review data
    safety, and validate staging before deployment.

## 11. Current known status

Based on the status shared so far: - The existing student/faculty LMS
has been observed running locally. - The current running app does not
yet have a complete admin feature. - Phase 1 changes were prepared, but
dependency installation and test execution were blocked in the previous
environment. - Phase 2 and Phase 3 are partial and need end-to-end
verification. - Phase 4 is not complete. - Do not claim production
readiness until acceptance criteria are verified.

## 12. Open decisions

Confirm if the current code does not already define the policy: - Can
students resubmit before/after grading? - Are late assignments accepted
or blocked? - Are multiple quiz attempts allowed? - Who can edit
attendance after submission? - Should course deletion be blocked when
records exist, or use an approved archival process? - Which
academic-year/date conventions does the institution use?
