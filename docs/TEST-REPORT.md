# Test report

Environment: Node 22, npm registry reachable, **no MongoDB server available** (binary download blocked; no distro package).
Real Atlas database: **never contacted**: no connection string was present in the environment, and the harness refuses to run if a
non-local `MONGO_URI` is set.

## Executed and PASSED
| Check | Result |
|---|---|
| Backend syntax check (`npm run check`, 58 files) | 0 failures |
| Backend automated tests (`npm test`) | **99 / 99 passed**, repeated runs stable |
| Frontend production build (`vite build`) | succeeds (120 modules) |
| `npm audit --omit=dev` backend | 0 vulnerabilities |
| Secret scan of the deliverable (URIs with credentials, key patterns, JWT literals) | clean; no `.env` shipped |
| Destructive-operation review | only guarded single-record deletes; no drops, no bulk deletes of records, no migrations |

Test files and what they cover: `auth` (15: validation, duplicate email, role-escalation, faculty pending, disabled/pending/rejected
blocked incl. existing tokens, NoSQL injection, legacy no-`status` users, token tampering, profile immutability, password change +
revocation, rate limiting), `courses.authz` (10), `assignments` (11: late flag, resubmit/lock, marks range, ownership, no-delete-with-submissions),
`quiz` (12: window, duration, ownership, answer validation, hidden answers, single attempt), `attendance` (6), `isolation` (4: forum,
analytics, dashboards), `files` (9: type/signature/size, no public serving, signed links, expiry, traversal, per-record authorization),
`admin` (13: every admin endpoint denied to anonymous/student/faculty/pending with no state change; approval, status, options,
allocation, enrollment, reports, audit), `security` (6: headers, CORS, env validation, safe errors, injection keys), `policies.unit` (13).

## How the tests avoid a database
`tests/helpers/memoryDb.js` replaces only the storage layer beneath the *real* Mongoose models: real schemas, validation, pre-save hooks
(bcrypt) and unique-index (E11000) behaviour; the real Express app, routes, middleware and controllers run over HTTP.
Limits: it is not MongoDB. Aggregation pipelines and transactions are unsupported (the app uses neither), and index/atomicity behaviour is
emulated. **Passing here does not prove behaviour against real MongoDB.**

## NOT executed (blocked or out of scope here)
* **Integration tests against a real MongoDB**: blocked (no server). Run the suite's flows against a disposable local MongoDB before release.
* **Staging smoke test / deployment**: not done; not deployed anywhere.
* **Manual browser acceptance** (student / faculty / admin flows), **responsive layout at mobile/tablet widths**, **light/dark visual check**,
  and **keyboard-navigation walkthrough**: *not performed* (no browser in this environment). The UI compiles and was written to the
  Design Document, but has not been looked at by a human or an automated browser. Please do this pass.
* Frontend automated tests: none exist in the project; none added.
* `npm audit` frontend: 2 moderate runtime findings remain (`react-router` open-redirect advisory; fix requires the v7 major upgrade, not
  applied) plus dev-tooling advisories (vite/esbuild/tailwind transitive), which do not ship to browsers. They predate this work.
