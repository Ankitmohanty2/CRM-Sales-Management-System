# QA audit report

Updated: 9 October 2026, India Standard Time, after the verification gap pass.

The API is not deployed. Deployment stays blocked until a real host is running and its health endpoint has been checked. This report does not claim production readiness.

## Commands

| Command | Result |
| --- | --- |
| `npm run lint` | Passed, no findings |
| `npm test` | 15 files passed, **47 passed**, 0 failed, 0 skipped |

MongoDB integration tests, including conversion rollback, ran on the in-memory replica set from `mongodb-memory-server`. They did not use the database in `.env`.

A separate production process was started with `node src/server.js` on port 58741, pointed at database `crm_startup_test` on that same in-memory replica set. Its health response was `success: true` and `database: connected`, with no MongoDB URI in the body.

## What this pass closed

| Gap | Evidence |
| --- | --- |
| Login rate limit returns 429 | `tests/integration/rate-limit.test.js`. The limit was set to 2 for that test, the third login returned 429, then the limit was restored to 10000 and the counter was cleared. A later login returned 401, not 429. |
| Initial admin bootstrap | `tests/integration/bootstrap.test.js` on the in-memory database. Creates one admin, refuses a second call, and does not replace an existing admin. |
| Production startup | `tests/integration/production-startup.test.js`. Missing `MONGODB_URI` exits non-zero with `Invalid environment configuration` and does not print the test signing secret. The production process returned Helmet headers and 400/404 bodies without a stack. |
| Graceful shutdown | `stopServer('SIGTERM')` closed port 58742 and left `mongoose.connection.readyState` at 0. On Windows, `child.kill('SIGTERM')` terminates the process without running Node signal handlers, so the handler was called directly. That function is what `SIGINT` and `SIGTERM` invoke when the process is started as the main module. |
| OpenAPI 3.0 | `@apidevtools/swagger-parser` `validate()` passed. The test also checks that every required operation exists, protected operations declare bearer auth, and write operations declare a request body. |
| Postman workflow | `docs/postman_collection.json` folder "Assignment workflow": login, create executive, create lead, contact, qualify, convert, move the deal, read the deal, overview, pipeline, lead timeline. The password is `replace-with-bootstrap-password`. |
| Customer delete | `tests/integration/customers.test.js`. A customer with a deal returns 409 and stays in the database. A converted customer returns 409. A customer with no deals is deleted. |
| Indexes | The OpenAPI test file asserts unique user email, unique customer `originalLead`, unique refresh-token hash, and the main lead, deal, activity, and audit compound indexes. |
| `src/server.js` and bootstrap | Covered by the startup and bootstrap tests above. |

## Earlier defects, still fixed

| Severity | Issue | Status |
| --- | --- | --- |
| HIGH | Team performance leaked a user outside the caller scope | Fixed, regression test still passing |
| HIGH | Customer update returned 500 and could drop address fields | Fixed, regression test still passing |
| MEDIUM | JWT algorithm was not pinned to HS256 | Fixed |
| MEDIUM | Helmet's content-security policy blocked Swagger UI | Fixed for `/api-docs` only |
| LOW | Unknown-user login skipped bcrypt | Fixed |
| LOW | Password change and refresh revocation were separate writes | Fixed |

No new critical or high defects were found in this pass.

## Checklist correction

Deployment is an assignment deliverable. It is **BLOCKED**, not out of scope. No public URL was verified.

## Remaining risks and blockers

- **Deployment is blocked.** There is no deployed URL, and no remote health check was performed.
- **Git history is blocked.** This folder is not a Git repository, so old commits were not searched for secrets. `.env` is listed in `.gitignore` and was not opened.
- **Windows signal delivery.** A child process killed with `SIGTERM` does not run the Node handler. Shutdown was verified by calling `stopServer`, which the handler uses.
- **Coverage is not complete.** The suite is the evidence. A coverage percentage was not used as a pass condition in this pass.
- **Login limiter in normal tests** stays at 10000 so the rest of the suite can authenticate. The 429 test restores that value before it finishes.
