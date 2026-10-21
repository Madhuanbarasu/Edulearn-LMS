# EduLearn LMS --- Tech-Stack and Architecture Document

**Status:** Stack lock for implementation\
**Rule:** Keep the current stack. Do not migrate frameworks or rewrite
the app without explicit approval.

## 1. Locked stack

### Frontend

-   React 18
-   Vite 5
-   React Router 6
-   Axios
-   Existing CSS/Tailwind setup as found in the repository

### Backend

-   Node.js
-   Express 4
-   CommonJS modules
-   Mongoose 8
-   MongoDB
-   JWT authentication
-   bcryptjs password hashing
-   Multer for uploads

### Development and verification

-   npm scripts and lockfiles maintained per package.
-   Node built-in test runner where suitable, plus focused integration
    tests where the isolated test database is available.
-   Git for version control and review.
-   Local development first; staging verification before any production
    deployment.

## 2. Architecture

-   Frontend communicates with backend through documented `/api/...`
    routes.
-   Backend routes apply authentication, role checks, course membership
    checks, request validation, and safe error handling.
-   Controllers implement business rules; models define persisted
    document structure.
-   Shared middleware/helpers should be used for repeated security and
    validation behavior.
-   File access must be authorized; do not rely on public static serving
    for private course materials.
-   Keep API response shapes backward-compatible where practical.

## 3. Environment configuration

Use `.env.example` with placeholder values only. Do not commit a real
`.env`.

Expected configuration should be verified against the actual code before
finalizing: - `PORT` - `CLIENT_URL` or explicit allowed-origin
configuration - `MONGO_URI` for the local/disposable test database -
`JWT_SECRET` - upload/signing configuration if required by the chosen
file-access implementation

The developer must supply real values locally. Never print or paste
secrets into logs, source control, deliverables, or chat.

## 4. Database safety

-   Never point automated tests at the user's production/real Atlas
    database.
-   Use a dedicated disposable test database with separate credentials.
-   Before any integration test, confirm the configured test URI is not
    the real Atlas URI.
-   Never run destructive seed/cleanup/migration commands against
    unknown database configuration.
-   Preserve collection names and existing document paths.
-   Prefer additive schema changes and backward-compatible reads.
-   Any migration that could alter/delete records requires explicit
    approval and a verified backup.

## 5. Security requirements

-   Hash passwords using bcryptjs.
-   Validate email, password, IDs, request payloads, marks, attendance,
    quiz attempts, and uploads.
-   Reject client-supplied role escalation and arbitrary file URLs.
-   Use explicit CORS origins; do not combine wildcard origin with
    credentials.
-   Apply security headers and rate limiting.
-   Enforce authentication, role authorization, and course membership on
    the server.
-   Avoid returning private user fields in roster/course responses.
-   Keep secrets out of errors and logs.
-   Faculty approval and admin provisioning must be secure.

## 6. Dependency management

-   Inspect existing package.json and lockfiles before changing
    dependencies.
-   Add dependencies only when justified; document the reason.
-   Keep backend and frontend dependencies in their respective package
    folders.
-   Regenerate lockfiles after package changes using a working npm
    registry.
-   Do not delete lockfiles to hide installation issues.
-   Report exact dependency installation failures and do not claim
    builds/tests passed if they did not run.

## 7. Testing strategy

1.  Static/syntax checks.
2.  Unit tests for validation and business rules.
3.  Authorization tests for role and course access.
4.  API integration tests against a separate disposable database.
5.  Frontend production build.
6.  Manual acceptance testing for student, faculty, and admin workflows.
7.  Responsive UI and light/dark theme checks.
8.  Final secret scan and diff review.

If the environment cannot access the npm registry or test database,
complete all checks possible and list blocked checks explicitly.

## 8. Local run procedure

Follow the final README and `.env.example`. Install dependencies
separately in `lms/backend` and `lms/frontend`, configure environment
variables locally, then start backend and frontend in separate
terminals. Do not use the real Atlas URI for automated tests. The exact
commands must be confirmed against the final package scripts.

## 9. Release gates

Do not deploy until: - Backend tests pass. - Frontend production build
passes. - Critical authorization tests pass. - Integration tests pass
against an isolated test database, or blockers are clearly recorded. -
Existing workflows and records are verified. - No secrets are
included. - CORS and environment settings are reviewed. - Staging smoke
tests pass.

## 10. Architecture decision log

-   Keep React/Vite + Express/Mongoose; no framework migration.
-   Preserve existing app behavior and data compatibility.
-   Implement new admin features within the existing architecture.
-   Use additive, reviewable changes and test before copying changes
    into the original project.
