# CRM Sales Management API

Backend REST API for the sales lifecycle: lead generation, qualification, conversion, customer management, deal management, and closure.

## Architecture

Requests pass through security middleware, Zod validation, authentication, and role checks. Controllers stay thin. Services own business rules, resource scope, and MongoDB transactions. Audit entries are written in the same transaction as the change they describe.

```text
src/
  app.js              Express application
  server.js           Process entry, bootstrap, graceful shutdown
  config/             Environment, database, Swagger
  models/             Mongoose schemas and indexes
  routes/             HTTP routes
  controllers/        Response mapping
  services/           Business logic
  middleware/         Auth, validation, errors, logging, rate limits
  validators/         Zod schemas
  utils/              Errors, pagination, scope, tokens, transactions
  constants/          Roles, statuses, stages, audit actions
```

## Technology stack

- Node.js 20+ with ES modules
- Express 4
- MongoDB and Mongoose
- JWT access tokens and rotating refresh tokens
- bcrypt password hashing
- Zod request validation
- Swagger UI at `/api-docs`
- Vitest and Supertest
- Helmet, CORS, express-rate-limit
- pino structured logging with auth header redaction

## Prerequisites

- Node.js 20 or newer
- npm
- MongoDB 5+ running as a replica set, or a compatible sharded cluster

Transactions are required for conversion and for audited writes. A standalone `mongod` without a replica set will return `503` for those operations. The API does not fall back to partial writes.

## Installation

```bash
npm install
cp .env.example .env
```

Generate two different secrets of at least 32 characters and put them in `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`. Do not commit `.env`.

## MongoDB setup

Local replica set example:

```bash
mongod --replSet rs0 --port 27017 --dbpath /data/db
mongosh --eval "rs.initiate()"
```

Point `MONGODB_URI` at that deployment, for example `mongodb://127.0.0.1:27017/crm_sales`.

## Environment

See [.env.example](.env.example). The process validates required variables on startup and exits if they are missing or invalid.

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Database connection |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Separate signing secrets |
| `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | Token lifetimes (`15m`, `7d`) |
| `CORS_ORIGINS` | Comma-separated browser origins |
| `COOKIE_SECURE` | `true` in production so the refresh cookie is Secure |
| `ALLOW_PUBLIC_REGISTRATION` | `false` by default |
| `API_BASE_URL` | Optional public origin. When set, Swagger selects it by default and still lists `http://localhost:5000`. When empty, Swagger uses the host of the current request. |
| `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | Optional first admin |
| `RATE_LIMIT_*`, `AUTH_RATE_LIMIT_*` | General and login/refresh limits |

These settings are **not** editable through the API: secrets, CORS, rate limits, cookie flags, registration policy, and the database URI.

Admin-editable CRM settings are only:

- `companyName`
- `defaultLeadSource`
- `defaultLeadPriority`
- `defaultDealStage`
- `defaultDealProbability`

## Run locally

```bash
npm run dev
```

Production start:

```bash
npm start
```

Health check: `GET /api/v1/health`

API docs: [http://localhost:5000/api-docs](http://localhost:5000/api-docs)

## Tests

```bash
npm test
npm run test:watch
npm run test:coverage
npm run lint
```

Integration tests start an in-memory MongoDB replica set. They do not use `MONGODB_URI` from your `.env` and they do not touch a production database. The first run downloads the MongoDB binary used by `mongodb-memory-server`.

## Authentication

1. `POST /api/v1/auth/login` with email and password.
2. The response body contains a short-lived access token. Send it as `Authorization: Bearer <token>`.
3. The refresh token is set only as an `HttpOnly`, `SameSite=Strict` cookie named `refreshToken`. It is not returned in JSON.
4. `POST /api/v1/auth/refresh` rotates that cookie. The previous token is revoked. Presenting a revoked token revokes the whole token family.
5. Logout and password changes revoke refresh tokens.
6. Inactive users cannot log in, refresh, or call protected routes.
7. Every protected request loads the user from the database. Role and team claims in the token are not trusted for authorization.

### Registration policy

`POST /api/v1/auth/register` is available only when `ALLOW_PUBLIC_REGISTRATION=true`. It always creates an active Sales Executive. The body cannot set `role`, `team`, or `isActive`. An admin must assign a team before that user can create leads or other team-scoped records.

When the flag is `false`, registration returns `403`.

### Initial admin

On startup, if `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` are both set and no Admin exists, the API creates one Admin. It never overwrites an existing Admin. Leave both values empty to skip bootstrap. User management after that is done through the admin user APIs.

## Permission matrix

Identity comes from the verified access token. A caller cannot widen access by sending a role, user id, or team id.

Resources outside the caller's scope return **404**. A caller who can see a resource but cannot perform the action receives **403**.

| Action | Admin | Sales Manager | Sales Executive |
| --- | --- | --- | --- |
| Manage users and CRM settings | Yes | No | No |
| View records | All | Own team | Assigned to self |
| Create leads, customers, deals, activities | Yes | Team members | Assigned to self |
| Assign or reassign leads and deals | Any active Sales Executive | Active Sales Executive on their team | No |
| Convert a qualified lead | In scope | In scope | Own leads |
| Reopen a closed deal | Yes | No | No |
| Delete an open deal | Yes | Own team | No |
| Analytics | Global | Own team | Own assignments |
| Change another user's role | Yes | No | No |
| Change own role or deactivate self | No | No | No |

Sales Managers and Sales Executives belong to a Team. Admin users do not. Lead, customer, deal, and activity documents store the assignee's team so team queries do not scan every user.

## Database relationships

- A Team has many Users.
- A User owns Leads, Customers, Deals, and Activities through `assignedTo`.
- A Lead may point to one Customer through `convertedCustomer`.
- A Customer may point back through unique `originalLead`.
- A Deal references a Customer and, when it came from conversion, the Lead.
- An Activity references a Lead, Customer, Deal, or User.
- AuditLog is append-only and stores the actor, entity, and non-sensitive before/after values.
- RefreshToken stores a SHA-256 hash, family id, expiry, and revocation time. The raw token is never stored.

## Indexing

Indexes follow the filters the API actually runs:

- User email is unique and normalized. Role, active status, and team are indexed together.
- Leads are queried by team, assignee, status, priority, source, and creation date.
- Customer `originalLead` is unique and sparse so manual customers are not forced through that key.
- Deals are queried by team, assignee, stage, value, expected close date, and creation date.
- Activities are queried by team, assignee, stored status, due date, and related entity.
- Audit logs are queried by entity type, entity id, and creation time.
- Refresh tokens are unique by hash and indexed by family. Expired token documents are removed with a TTL index on `expiresAt`. Revoked tokens remain until that expiry so reuse can still be detected.

Soft-deactivated users keep their email uniqueness so the address cannot be registered again while history still points at the account.

## Endpoint inventory

| Method | Path |
| --- | --- |
| GET | `/api/v1/health` |
| POST | `/api/v1/auth/register` |
| POST | `/api/v1/auth/login` |
| POST | `/api/v1/auth/refresh` |
| POST | `/api/v1/auth/logout` |
| POST | `/api/v1/auth/logout-all` |
| GET | `/api/v1/auth/me` |
| PATCH | `/api/v1/auth/me/password` |
| POST, GET | `/api/v1/users` |
| GET, PATCH, DELETE | `/api/v1/users/:id` |
| PATCH | `/api/v1/users/:id/status` |
| POST, GET | `/api/v1/leads` |
| GET, PATCH, DELETE | `/api/v1/leads/:id` |
| PATCH | `/api/v1/leads/:id/status` |
| PATCH | `/api/v1/leads/:id/assignment` |
| POST | `/api/v1/leads/:id/convert` |
| POST, GET | `/api/v1/customers` |
| GET, PATCH, DELETE | `/api/v1/customers/:id` |
| POST, GET | `/api/v1/deals` |
| GET, PATCH, DELETE | `/api/v1/deals/:id` |
| PATCH | `/api/v1/deals/:id/stage` |
| PATCH | `/api/v1/deals/:id/assignment` |
| POST | `/api/v1/deals/:id/reopen` |
| POST, GET | `/api/v1/activities` |
| GET, PATCH, DELETE | `/api/v1/activities/:id` |
| PATCH | `/api/v1/activities/:id/complete` |
| GET | `/api/v1/timeline/leads/:id` |
| GET | `/api/v1/timeline/customers/:id` |
| GET | `/api/v1/timeline/deals/:id` |
| GET | `/api/v1/analytics/overview` |
| GET | `/api/v1/analytics/pipeline` |
| GET | `/api/v1/analytics/team-performance` |
| GET, PATCH | `/api/v1/config` |

Successful responses:

```json
{
  "success": true,
  "message": "Lead fetched successfully",
  "data": {},
  "meta": {}
}
```

List endpoints put the records in `data` and pagination in `meta`:

```json
{
  "page": 1,
  "limit": 10,
  "totalRecords": 100,
  "totalPages": 10
}
```

Errors:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": []
}
```

## Example requests

Login:

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "email": "admin@example.com", "password": "your-password" }
```

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { "email": "admin@example.com", "role": "Admin" },
    "accessToken": "<jwt>"
  },
  "meta": {}
}
```

Convert a qualified lead:

```http
POST /api/v1/leads/:id/convert
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "deal": {
    "name": "Enterprise CRM Subscription",
    "value": 100000,
    "probability": 30,
    "expectedClosingDate": "2026-12-31T00:00:00.000Z",
    "stage": "Qualification",
    "description": "Initial opportunity"
  }
}
```

Expected revenue is calculated by the server: `100000 * 30 / 100 = 30000`.

## Business rules

### Leads

Sources: Website, Referral, Social Media, Email, Phone, Other.

Priorities: Low, Medium, High.

Statuses: New, Contacted, Qualified, Unqualified, Converted, Lost.

Transitions:

- New → Contacted
- Contacted → Qualified, Unqualified, or Lost
- Qualified → Lost
- Converted is set only by conversion
- Converted, Unqualified, and Lost cannot be edited or moved back to an active status

New leads start as New. Sales Executives are the assignee. Assignment changes use a conditional update so a concurrent reassignment returns `409` instead of dropping history.

A lead can be deleted only when it is not converted and has no activities or deals.

### Conversion

Only a Qualified lead can be converted, and only once. The customer is built from the lead's name, email, phone, company, assignee, and team. The request may supply deal fields only. Customer, deal, lead update, and audit rows commit in one transaction. If the server cannot start a transaction, the API returns `503`.

### Deals

Value must be greater than zero. Probability is an integer from 0 through 100 and can be changed only while the deal is open. Expected revenue is always `round(value * probability) / 100`. Clients cannot send `expectedRevenue`.

Open stages are Qualification, Discovery, Proposal, and Negotiation. Any open stage may move to any other open stage, or to Won or Lost.

- Won sets probability to 100, sets `closedAt`, and clears `lostReason`.
- Lost requires a non-empty reason, sets probability to 0, and sets `closedAt`.
- Ordinary updates cannot reopen a closed deal.
- `POST /api/v1/deals/:id/reopen` is Admin-only. It requires a reason, an open stage, and a new probability, and it writes an audit event.
- Won and Lost deals cannot be deleted.

### Activities

Types: Call, Email, Meeting, Demo, Follow-up, Reminder, Note.

The database stores Pending or Completed. A pending activity whose due date is before the current time is returned as Overdue. Completed activities never become overdue. This avoids a background job that rewrites every pending row.

Notes may omit a due date. Other types require one. Clients cannot set `status`, `completedAt`, or `createdBy`.

### Analytics

Optional `from` and `to` filter `createdAt`.

Conversion rate is `converted leads / total leads * 100` inside the caller's scope. It is `0` when there are no leads.

Won revenue is the sum of `value` on Won deals only. Open expected revenue sums `expectedRevenue` on open stages only. Won revenue is not also counted as open expected revenue.

Team performance counts a lead as qualified when its current status is Qualified or Converted, so conversion does not erase the qualification.

### Users

Emails are stored in lowercase and are unique. Deleting a user deactivates the account. Deactivation is rejected while the user still has a New, Contacted, or Qualified lead, an open deal, or a pending activity. The last active Admin cannot be removed. A user cannot deactivate their own account or change their own role.

### Audit

Clients cannot update or delete audit entries. Passwords, tokens, and authorization headers are stripped before an entry is stored.

## Deployment

Run `npm start` behind a TLS-terminating proxy. Set `NODE_ENV=production`, `COOKIE_SECURE=true`, a replica-set `MONGODB_URI`, distinct JWT secrets, and an explicit `CORS_ORIGINS` list. Set `API_BASE_URL` to the public origin, such as `https://crm-sales-management-system-bo1l.onrender.com`, so the Swagger server dropdown defaults to that deployment. The process closes the HTTP server and the MongoDB connection on `SIGINT` and `SIGTERM`.

This repository does not deploy the API and does not contain hosting credentials.

## Assumptions and limitations

- Public registration cannot place a user on a team. An admin assigns the team afterward.
- Customer statuses are Active and Inactive.
- There is no separate team-management API. Admins create a team by sending `teamName` or `teamId` when they create or update a user.
- Overdue is a read-time status, not a stored value.
- User deletion is always a deactivation when it is allowed. Historical audit references stay intact.
- The API is not deployed by this project.
