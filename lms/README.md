# EduLearn LMS (MERN)

React 18 + Vite frontend, Node/Express 4 + Mongoose 8 backend, MongoDB, JWT auth, bcryptjs, Multer.
Roles: **student**, **faculty**, **admin**. See `../docs/` for the PRD, Design Document, Tech-Stack document,
`POLICIES.md` (business rules), `CHANGES.md` and `TEST-REPORT.md`.

## 1. Prerequisites
Node.js 18+ (tested on Node 22) and a MongoDB database that **you** control (local MongoDB, or your own Atlas cluster).

## 2. Configure the backend
```bash
cd lms/backend
cp .env.example .env        # then edit .env
npm ci
```
Set these in `backend/.env` (never commit this file):

| Variable | Required | Notes |
|---|---|---|
| `MONGO_URI` | yes | Your database. Use a **separate disposable database** for experiments. |
| `JWT_SECRET` | yes | 32+ random chars. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `CLIENT_URL` | yes | Exact browser origin(s), comma-separated, e.g. `http://localhost:5173`. `*` is rejected. |
| `PORT` | no | default 5000 |
| `JWT_EXPIRE` | no | default `7d` |
| `TRUST_PROXY` | no | set (e.g. `1`) behind a reverse proxy so rate limiting sees real client IPs |
| `DNS_SERVERS` | no | The original project forced Google/Cloudflare DNS for Atlas SRV lookups. Kept as default; set empty to disable. |

The server refuses to start if `JWT_SECRET`, `MONGO_URI` or `CLIENT_URL` are missing or weak.

## 3. Create the first admin (there is no public admin sign-up)
```bash
cd lms/backend
npm run create-admin
```
It prompts for name, email and a hidden password, **prints the target database host/name**, and asks you to type `yes`.
It only ever *creates* a new admin: it never edits, promotes or deletes an existing account. For non-interactive use
set `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_CONFIRM=yes` in the environment (never as CLI arguments).

## 4. Run
```bash
# terminal 1
cd lms/backend && npm run dev        # or: npm start
# terminal 2
cd lms/frontend && cp .env.example .env && npm ci && npm run dev
```
Open http://localhost:5173. Faculty who register stay **pending** until an admin approves them
(Admin → Faculty approvals).

## 5. Checks
```bash
cd lms/backend  && npm run check && npm test     # syntax + 99 database-free tests
cd lms/frontend && npm run build                 # production build
```
The backend tests use an in-memory stand-in for MongoDB and cannot touch any real database (see `docs/TEST-REPORT.md`).
To run integration tests against a real MongoDB, point a copy of the suite at a **disposable local database**
(`mongodb://127.0.0.1/...`) and confirm the URI is not your Atlas URI first.

## 6. Existing data
All schema changes are additive (new optional fields, new collections `academicoptions`, `auditlogs`, `quizstarts`).
Existing documents keep working: users without `status` are treated as `active`. No migration is required and
none is run. **Back up your database before first use anyway.**

## 7. Uploaded files
Files in `backend/uploads/` are no longer publicly served. The app requests a 2-minute, user-bound download link after
checking course membership. Existing files and their `/uploads/<name>` references in your records keep working.
Keep `backend/uploads/` with your database backup, because the DB only stores references.
