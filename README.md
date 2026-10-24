# CocaCars Admin

The application is split into two independent packages:

- [`carfrontend`](./carfrontend): React, TypeScript, and Vite single-page app.
- [`carbackend`](./carbackend): Express API, MySQL access, migrations, and account tools.

Use Node.js 20.19 or newer. Install dependencies separately in each folder. Never commit `.env` files or put database credentials in frontend environment variables.

## Run locally

### Backend

In a terminal:

```powershell
Set-Location carbackend
Copy-Item .env.example .env
npm install
npm run db:migrate
npm run dev
```

Set the MySQL connection values in `carbackend/.env` before running migrations. The configured database must already exist and the migration user needs schema privileges. Create an administrator using the protected `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` variables with `npm run db:seed`, or use the documented account-provisioning tool.

### Frontend

In a second terminal:

```powershell
Set-Location carfrontend
Copy-Item .env.example .env
npm install
npm run dev
```

Open <http://localhost:5173>. For local development, `VITE_API_URL` points to `http://localhost:4000`. Vite also proxies `/api` to the local backend when no API URL is configured.

## Deploy as separate Render services

Deploy the backend as a **Web Service** and the frontend as a **Static Site**. Each service must use its own folder as its Root Directory.

### Backend Web Service

- **Root Directory:** `carbackend`
- **Build Command:** `npm ci && npm run build`
- **Start Command:** `npm start`
- **Health Check Path:** `/health`

Set these environment variables in Render (use the real values for your database and deployed frontend):

```text
NODE_ENV=production
WEB_ORIGIN=https://<your-frontend>.onrender.com
MYSQL_HOST=<database-host>
MYSQL_PORT=3306
MYSQL_DATABASE=<database-name>
MYSQL_USER=<database-user>
MYSQL_PASSWORD=<new-database-password>
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
```

The database must be reachable from Render, and the migration must be applied before trying to sign in. Use `npm run db:migrate` from the backend package with an appropriately privileged migration identity. Do not use the application's restricted runtime database user for schema changes unless it has the required migration privileges.

### Frontend Static Site

- **Root Directory:** `carfrontend`
- **Build Command:** `npm ci && npm run build`
- **Publish Directory:** `dist`
- **Environment Variable:** `VITE_API_URL=https://<your-backend>.onrender.com`

`VITE_API_URL` is embedded at frontend build time. Set it before deploying or redeploy after changing it. Set backend `WEB_ORIGIN` to the exact public frontend URL (no path or trailing slash).

The separate services use credentialed cross-origin requests. The backend enables cookies and restricts CORS to `WEB_ORIGIN`; `COOKIE_SAME_SITE=none` requires `COOKIE_SECURE=true` and HTTPS. For reliable browser cookie behavior, prefer frontend and backend custom domains under the same site where possible; some browsers restrict third-party cookies across unrelated domains.

## Tests and database tasks

Run each package's checks from its folder:

```powershell
Set-Location carfrontend
npm test
npm run build
```

```powershell
Set-Location carbackend
npm test
npm run build
```

Frontend end-to-end tests additionally require the backend and a prepared isolated test database. Backend MySQL integration tests are skipped unless explicitly configured with a dedicated test database.

Database schema and migrations live under `carbackend/database`. Use a least-privileged database account at runtime, keep secrets in Render's environment settings, and rotate any credential that has been shared or exposed.
