# CocaCars Admin

A responsive internal operations dashboard built with React, TypeScript, Vite, Tailwind CSS, Express, and MySQL. This is an independently implemented application based on the workflows visible in the authorized CocaCars admin reference. It uses original UI styling and synthetic local fixtures only; it does not connect to or import data from the production site.

## Feature inventory

- Secure sign-in, sign-out, profile updates, and password changes.
- Dashboard metrics derived from persisted records.
- Searchable, sortable, paginated vehicle listings, dealers, buyers, sellers, quick listings, inspections, quality checks, and repair/maintenance records.
- Create and edit workflows for operational records; administrator-only deletion.
- Inspector and operations roles with resource-level access restrictions.
- Inspection, quality-check, and quick-listing inspection status changes submitted to an administrator approval queue.
- Responsive navigation, accessible forms and dialogs, loading/error/empty states, and success feedback.

**Intentionally omitted:** deal management. The reference showed a dashboard deal count without a discoverable destination or deal workflow, and the requested scope explicitly omitted deals.

## Architecture and dependency choices

- `src/`: React 18/TypeScript single-page application; Vite 6 development server and production bundler; Tailwind CSS 3 utility styling.
- `server/`: Express 4 REST API, strict runtime validation with Zod, MySQL connection pool with `mysql2`, password hashing with `bcryptjs`, security headers with Helmet, origin-restricted CORS, and authentication rate limiting.
- `shared/`: API-facing role and resource contracts.
- `database/migrations/`: versioned MySQL DDL; `database/schema.sql` is the repeatable standalone schema creation script.
- `tests/`: Vitest/Testing Library frontend and API integration tests, optional isolated-MySQL persistence tests, and a Playwright primary workflow test.

Runtime and development dependency ranges are pinned in `package.json` and use maintained packages. Node.js 20.19+ and MySQL 8.0+ are required.

## Local setup

1. Install Node.js 20+ and MySQL 8.0+.
2. Install project dependencies:

   ```sh
   npm install
   ```

3. Create a local environment file and replace placeholders with local-only values:

   ```powershell
   Copy-Item .env.example .env
   ```

   Keep `.env` private; it is ignored by Git. Use a long, unique password for the local administrator and database account. Never use a production account or password in tests.

4. Create the database using **one** schema workflow:

   **Standalone script:** run the MySQL client, then source the script:

   ```sh
   mysql -u root -p
   ```

   ```sql
   SOURCE database/schema.sql;
   ```

   **Versioned migration:** first create the configured database and a migration account with DDL privileges, set that account in `.env`, then run:

   ```sh
   npm run db:migrate
   ```

   The migration command is version-tracked and safe to repeat. It expects the configured database to exist. Do not use a production application account with schema-owner privileges.

5. Configure `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `.env`, then load **synthetic local-only** records:

   ```sh
   npm run db:seed
   ```

   Seeding is repeatable. It creates/updates the configured administrator and inserts only fictitious `example.test` contacts, placeholder vehicle identifiers, and synthetic operational records. The seed password is read from the environment and is never included in source or logs.

6. Start the API and web app:

   ```sh
   npm run dev
   ```

   Open <http://localhost:5173>. The Vite development server proxies `/api` to the API at `http://localhost:4000`.

## Environment variables

| Variable                                                                                              | Purpose                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                                                            | `development`, `test`, or `production`.                                                                                                 |
| `PORT`                                                                                                | Express API port; defaults to `4000`.                                                                                                   |
| `WEB_ORIGIN`                                                                                          | Exact permitted browser origin; local default is `http://localhost:5173`.                                                               |
| `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`                          | MySQL connection settings. Keep the runtime user least-privileged.                                                                      |
| `COOKIE_SECURE`                                                                                       | Set `true` in HTTPS production deployments; `false` is for local HTTP only.                                                             |
| `LOG_LEVEL`                                                                                           | Structured log level. Request paths are logged without query strings; passwords, cookies, and CSRF values are redacted.                 |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`                                                             | Required only for the local synthetic seed task. Password must be at least 12 characters.                                               |
| `NEW_USER_NAME`, `NEW_USER_EMAIL`, `NEW_USER_PASSWORD`, `NEW_USER_ROLE`                               | Environment-only inputs for the `db:create-user` account provisioning task. Roles: `admin`, `operations`, `inspector`.                  |
| `MYSQL_TEST_DATABASE`, `MYSQL_TEST_HOST`, `MYSQL_TEST_PORT`, `MYSQL_TEST_USER`, `MYSQL_TEST_PASSWORD` | Optional dedicated database test connection. The database name must match `cocacars_*test*`; never point this at a production database. |
| `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`                                                               | Optional administrator credentials for the Playwright workflow; use only with a dedicated seeded test database.                         |

## Database operations

### Least privilege and migrations

Use separate database identities for schema creation/migrations and runtime access. The migration identity needs DDL privileges on the configured database. The application identity needs only `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on the application tables. Set the migration credentials for `npm run db:migrate`, then restore the restricted runtime account in `.env` before starting the server. Create the database itself through a DBA/admin account.

The schema has foreign keys, uniqueness constraints, indexes, role/status constraints, and a `schema_migrations` ledger. The standalone SQL creation file and initial versioned migration are kept in sync.

### Account provisioning

Create or update a team account without putting its password in command history by setting `NEW_USER_NAME`, `NEW_USER_EMAIL`, `NEW_USER_PASSWORD`, and `NEW_USER_ROLE` in the protected local environment, then run:

```sh
npm run db:create-user
```

This operation stores a bcrypt password hash and prints no password. Remove the temporary password from the environment when provisioning is complete.

### Backup and reset

Back up before migrations or resets:

```sh
mysqldump --single-transaction --routines --triggers cocacars_admin > cocacars_admin-backup.sql
```

**Destructive, opt-in reset — local/test databases only:** verify the selected connection/database name before executing any drop or recreation. The following permanently removes all data in that database:

```sql
DROP DATABASE cocacars_admin;
```

Re-run the standalone schema or migrations and seed commands after an intentional reset. Never use this reset procedure against production.

## API reference

All endpoints are under `/api`. Except login, every endpoint requires an active session cookie. JSON responses use `{ "error": { "code": "...", "message": "...", "requestId": "..." } }` on errors. Error responses do not include stack traces or submitted secrets.

### Authentication and profile

| Method and path     | Request                                                                                                | Success                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `POST /auth/login`  | `{ "email": "admin@example.test", "password": "...", "rememberMe": false }`; trusted `Origin` required | `200 { "user": { "id", "name", "email", "role" }, "csrfToken": "..." }`; sets HttpOnly session and readable CSRF cookies |
| `GET /auth/me`      | —                                                                                                      | `200 { "user": { "id", "name", "email", "role" } }`                                                                      |
| `PUT /auth/profile` | `{ "name", "email" }`; include `currentPassword` and `newPassword` together for password changes       | `200 { "user": ... }`                                                                                                    |
| `POST /auth/logout` | `X-CSRF-Token` header                                                                                  | `204`; revokes the current session                                                                                       |

Authenticated state-changing requests require the CSRF cookie and matching `X-CSRF-Token` header. Cookies are `SameSite=Strict`; configure `COOKIE_SECURE=true` and HTTPS in production. Login is origin checked and rate limited.

### Records and dashboard

| Method and path                                                               | Behavior                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /dashboard`                                                              | Persisted listing, buyer/seller, dealer, intake, inspection, repair, and pending-approval metrics.                                                                                                                                                                |
| `GET /staff`                                                                  | Administrator/operations-only list of active inspectors for assignment forms.                                                                                                                                                                                     |
| `GET /:resource?q=&status=&page=1&pageSize=10&sort=created_at&direction=desc` | Allow-listed paginated/filterable list. `pageSize` is capped at 100; sort fields and SQL identifiers are allow-listed.                                                                                                                                            |
| `GET /:resource/:id`                                                          | Fetch one resource record.                                                                                                                                                                                                                                        |
| `POST /:resource`                                                             | Validate and create a record; returns `201 { "id": number }`.                                                                                                                                                                                                     |
| `PUT /:resource/:id`                                                          | Validate and update allow-listed fields; returns `204`.                                                                                                                                                                                                           |
| `DELETE /:resource/:id`                                                       | Administrator-only removal; returns `204`.                                                                                                                                                                                                                        |
| `POST /status-requests`                                                       | Submit an inspection, quality-check, or quick-listing inspection status request: `{ "resource": "inspections" \| "quality-checks" \| "quick-listings", "resourceId": number, "toStatus": string, "note"?: string }`; returns `201 { "id", "status": "pending" }`. |
| `GET /status-requests`                                                        | Administrator-only approval history, newest first.                                                                                                                                                                                                                |
| `PATCH /status-requests/:id`                                                  | Administrator review: `{ "decision": "approved" \| "rejected" }`. Approved updates are transactionally applied only if the record still has its original status.                                                                                                  |

Resource path values: `listings`, `dealers`, `buyers`, `sellers`, `quick-listings`, `inspections`, `quality-checks`, `repairs`.

Create/update bodies accept only resource fields shown in their UI forms; unknown fields and invalid values are rejected. Inspection and quick-listing statuses are `pending`, `inspecting`, `completed`. Quality statuses are `pending`, `completed`, `in_correction`. Status updates cannot bypass the administrator review queue. Dates use ISO date strings; date-times use ISO 8601 strings. Role policy: administrators have full access and review permissions; operations can manage operational records; inspectors can view only inspections and quality checks assigned to them and edit only their assigned work notes/findings. Only administrators can delete records or approve/reject status requests.

## Test, lint, type-check, and build

```sh
npm test                 # Vitest frontend + REST API integration tests
npm run test:e2e          # Playwright primary workflow (test DB/admin env required)
npm run lint
npm run format:check
npm run typecheck
npm run build
```

The MySQL persistence tests are skipped unless `MYSQL_TEST_DATABASE` names a dedicated `cocacars_*test*` database and test connection variables are supplied. They apply the idempotent schema to that explicitly named test database and perform a rollback-only parameterized persistence check. Never supply production database credentials. The Playwright workflow requires a running/accessible isolated MySQL database, applied schema, synthetic seed, and `E2E_ADMIN_*` values.

## Production and security notes

- Terminate TLS at the production reverse proxy; set `COOKIE_SECURE=true` and the exact `WEB_ORIGIN`.
- `npm run build` emits the client to `dist/client` and the API to `build/server`; `npm start` serves the production client and REST API from the Express process.
- Use distinct, random database credentials and grant the runtime user only necessary DML privileges. Keep DDL and provisioning credentials out of the running app.
- Set `NODE_ENV=production`; store secrets in a managed secrets provider or protected environment variables, not in Git.
- Restrict network access to MySQL, back up encrypted database data, monitor structured logs, and rotate session/account credentials under your incident policy.
- Session tokens are high-entropy, opaque, stored hashed in MySQL, expire after eight hours by default (or 30 days when the explicit Remember me choice is selected), and are revoked at logout. Passwords are bcrypt-hashed; no default account is created unless the seed task is intentionally configured and run.
- Do not expose this internal dashboard publicly without adding deployment-specific access controls, monitoring, and operational review.

## Assumptions and known limitations

- Sellers and buyers are separate records, as confirmed. Deals are omitted as requested because the reference did not expose a deal workflow.
- Inspection, quality-check, and quick-listing inspection status changes require administrator review. The visible reference did not define additional approval transitions, so all valid status values are selectable and server-validated.
- Dashboard metrics are derived from the new app database; reference-site values and customer data are not copied.
- The reference listing form exposed a media/file control, but no asset storage contract was discoverable. This implementation does not upload/store vehicle photos or video. Add an approved object-storage provider and retention policy before enabling media.
- Team roles are provisioned through the protected database CLI rather than a web-based user/role management page.
- Automated test behavior and execution results are reported separately; a MySQL-backed test requires an explicitly isolated test database.
