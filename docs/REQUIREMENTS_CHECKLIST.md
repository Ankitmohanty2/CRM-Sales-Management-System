# Requirements checklist

Statuses:

- **PASS** — implemented, and this pass executed a test or a live request that checked the behavior.
- **FAIL** — tested and broken, or confirmed missing.
- **BLOCKED** — could not be verified because of an external limit.
- **NOT APPLICABLE** — the assignment does not require it.

Test database: in-memory replica set from `npm test` (47 passed, 0 failed, 0 skipped). Production-mode process: port 58741, database name `crm_startup_test` on that same replica set. The `.env` database was not used.

| Requirement | Location | Verification | Result | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| Node.js ES modules, Express, Mongoose, Zod, Helmet, CORS, rate limit, dotenv, structured logs | `package.json`, `src/app.js` | `npm test` and production process | PASS | Suite and production health both started | None |
| Environment validation fails fast | `src/config/env.js`, `src/server.js` | Production startup test | PASS | Empty `MONGODB_URI` exits non-zero with `Invalid environment configuration` | None |
| JWT access token plus rotating refresh token stored as a hash | `src/services/auth.service.js`, `src/models/RefreshToken.js` | Auth integration tests | PASS | Login, rotation, reuse, logout | None |
| bcrypt passwords never returned | `src/models/User.js` | Login, user create, and bootstrap tests | PASS | Response and stored hash are not the plain password | None |
| Public registration cannot choose Admin | `src/validators/auth.validators.js`, `src/services/auth.service.js` | Auth test | PASS | `role: Admin` returns 400; disabled registration returns 403 | None |
| Initial admin bootstrap, including an existing admin | `src/services/bootstrap.service.js` | Bootstrap tests on the in-memory database | PASS | Creates once; second call and an existing admin both leave the current admin unchanged | Not run against the developer database, on purpose |
| Inactive users rejected | `src/services/auth.service.js`, `src/middleware/authenticate.js` | Auth and security tests | PASS | Login 403; old access token 401 after deactivation | None |
| Wrong, expired, and wrong-audience tokens rejected | `src/utils/token.js` | Security regression | PASS | Three 401 responses; verify allows only HS256 | None |
| Login rate limit returns 429 | `src/middleware/rateLimiter.js` | Rate-limit test | PASS | Third attempt was 429; limit restored to 10000 and the next attempt was 401 | None |
| HttpOnly refresh cookie | `src/utils/token.js` | Auth test | PASS | `HttpOnly` asserted; path `/api/v1/auth`; `SameSite=strict`; `Secure` follows `COOKIE_SECURE` | None |
| Admin, Sales Manager, Sales Executive | `src/constants/roles.js`, `src/utils/scope.js` | Authorization tests | PASS | Cross-team and cross-executive reads return 404 | None |
| Authorization inside queries | Service scope filters | Authorization, analytics, and security tests | PASS | Out-of-scope id is not updated; team performance hides other users | None |
| Admin user management, unique email, no password hash | `src/services/user.service.js` | Authorization and error tests | PASS | Duplicate email 409; manager list 403 | None |
| Last active admin and self-deactivation blocked | `src/services/user.service.js` | Authorization test | PASS | 409 for the last admin; 403 for self when another admin exists | None |
| Users with active work are not removed | `src/services/user.service.js` | Authorization test | PASS | Delete returns 409 while a lead is active | None |
| Lead CRUD, filters, pagination, status graph | `src/services/lead.service.js` | Leads tests | PASS | Search, page size, invalid sort, illegal status | None |
| Assignment limited to active sales executives on the manager's team | `src/services/assignment.service.js` | Authorization and security tests | PASS | Other team 403; inactive 422; manager role 422 and assignee unchanged | None |
| Qualified lead converts once inside a transaction | `src/services/lead.service.js` | Conversion tests | PASS | Links match; second call 409; forced failure rolls back | None |
| Customer update keeps partial address fields | `src/services/customer.service.js` | Security regression | PASS | Street remains when only city is patched | None |
| Customer delete blocked when deals or a conversion exist | `src/services/customer.service.js` | Customer tests | PASS | Deal or `originalLead` returns 409 and the customer remains; a customer with neither is deleted | None |
| Deal value, probability, server expected revenue | `src/services/deal.service.js` | Deals tests | PASS | 0 and 140 rejected; client `expectedRevenue` rejected; 30% of 100000 is 30000 | None |
| Stage rules, lost reason, closed-deal lock, admin reopen | `src/services/deal.service.js` | Deals tests | PASS | Lost without reason 422; executive reopen 403; admin reopen 200 | None |
| Activities, computed overdue, no forged completion | `src/services/activity.service.js` | Activities and security tests | PASS | Past due date is Overdue; completed work leaves that filter; forged `status` and `completedAt` return 400 | None |
| Append-only timeline | `src/routes/timeline.routes.js` | Leads test and route list | PASS | Timeline contains created, status, and assignment events. No update or delete route is registered | None |
| Analytics overview, pipeline, team performance, scoped | `src/services/analytics.service.js` | Analytics and security tests | PASS | Empty zeros; executive revenue isolated; outside creator hidden | None |
| Conversion rate | `src/services/analytics.service.js` | Analytics test | PASS | Converted divided by total leads in scope, times 100; 0 when there are no leads | None |
| Pagination max 100, allowlisted sort, escaped search | `src/utils/pagination.js`, `src/utils/queryFilters.js` | Leads test and unit test | PASS | `$where` sort is 400; regex metacharacters are escaped | None |
| Consistent errors and no production stack | `src/middleware/errorHandler.js` | Error tests and production process | PASS | 400, 404, and 409 shapes; production 400/404 bodies have no `stack` | None |
| Health without infrastructure secrets | `src/controllers/health.controller.js` | Production process on port 58741 | PASS | `status: ok`, `database: connected`, body has no `mongodb` | None |
| Security headers | `src/app.js` | Production process | PASS | `nosniff`, `SAMEORIGIN`, HSTS, and a content-security policy were present | `/api-docs` omits the content-security policy so Swagger UI can run |
| Graceful shutdown | `src/server.js` | `stopServer('SIGTERM')` | PASS | Port 58742 stopped accepting requests and Mongoose `readyState` was 0 | Windows `child.kill('SIGTERM')` does not enter the Node handler; the handler calls this same function |
| Unique and query indexes | Model files | Index assertions after `Model.init()` | PASS | Unique email, unique `originalLead`, unique refresh hash, and the lead, deal, activity, and audit compounds used by list queries | No explain-plan timing was collected |
| `.gitignore` excludes `.env`; example uses placeholders | `.gitignore`, `.env.example` | File inspection | PASS | `.env` is named in `.gitignore`; example secrets are placeholder text | None |
| Git history contains no secrets | Not available | Not run | BLOCKED | There is no `.git` directory | Cannot search past commits |
| OpenAPI 3.0 document | `docs/openapi.yaml` | `@apidevtools/swagger-parser` validate | PASS | Document validated. Required operations, bearer auth, and write request bodies are asserted | None |
| Postman collection for the sales workflow | `docs/postman_collection.json` | JSON parse and folder review | PASS | Assignment workflow uses placeholder credentials and walks lead, qualification, conversion, deal, and analytics | The collection was not executed inside Postman in this pass |
| README setup, roles, and rules | `README.md` | Inspection against the running behavior | PASS | Replica set, bootstrap, and auth flow match the code | None |
| Automated tests on an isolated database | `tests/` | `npm test` | PASS | 15 files, 47 passed, 0 failed, 0 skipped | None |
| Deployed API URL and remote health check | Not deployed | Not run | BLOCKED | No host, URL, or remote health response exists | Do not treat local health as deployment |
| Frontend | Not present | Assignment is backend-only | NOT APPLICABLE | No UI was added | None |
