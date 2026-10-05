# MediNexus

MediNexus is an early hospital workflow prototype built with React, TypeScript, Vite, a Node.js HTTP API, and SQLite. It demonstrates role-aware dashboards and a small authenticated API. It is not a clinical system and must not be used with real patient information.

## Current capabilities and limits

- The responsive dashboard, role switching, many module screens, and much of the patient view use synthetic demo content in the frontend.
- The API supports registration, login, logout, session lookup, limited patient and appointment reads, notifications, and patient health-metric writes.
- Production mode does not seed sample patient records or generate sample appointments and health metrics for new accounts.
- The application does not yet provide a complete clinical workflow, verified identity, email verification, password recovery, MFA, authentication rate limiting, a managed database adapter, or a compliance program.

Do not store protected health information or make care decisions from this prototype. Security improvements in this repository do not establish HIPAA, GDPR, or other regulatory compliance.

## Architecture

```text
Browser
  └─ HTTPS static frontend (Vite build in dist/)
       └─ HTTPS API (Node.js, /api/*)
            └─ SQLite file on persistent storage
```

The frontend and API can share an origin or run on separate HTTPS origins. `VITE_API_URL` selects the API base at frontend build time. SQLite is suitable only for a single API instance on storage that persists across restarts and deployments. Use a database migration before scaling to multiple API instances or using ephemeral filesystems.

## Requirements

- Node.js 22.12 or later. The server uses Node's built-in `node:sqlite` module.
- npm, included with Node.js.

## Local development

```bash
npm ci
```

Optionally copy `.env.example` to `.env`. The frontend reads Vite variables from `.env`; `npm run server:dev` also loads that file using Node's environment-file support.

Start the frontend and API in separate terminals:

```bash
npm run dev
npm run server:dev
```

The frontend is served by Vite, normally at `http://localhost:5173`. The API defaults to `http://127.0.0.1:8787`; Vite proxies `/api` to it. Local SQLite data defaults to `data/medinexus.sqlite`.

## Environment variables

| Variable | Used by | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | Frontend build | API origin, such as `https://api.example.com`. Leave blank to call `/api` on the frontend's origin. This value is public in the generated browser code; never put secrets in a `VITE_` variable. |
| `PORT` | API | Port to listen on. Defaults to `8787` locally; production hosting should provide it. |
| `HOST` | API | Optional bind host. Defaults to `127.0.0.1` in development and `0.0.0.0` in production. |
| `NODE_ENV` | API | Set to `production` on the deployed API to enable production checks and secure cookies. |
| `MEDINEXUS_CORS_ORIGIN` | API | Exact frontend origin(s). Separate multiple origins with commas; production entries must use HTTPS. Wildcards are rejected. |
| `MEDINEXUS_DB_PATH` | API | SQLite path. The local default is `data/medinexus.sqlite`. Production requires an absolute path on persistent storage. |
| `MEDINEXUS_ADMIN_EMAIL`, `MEDINEXUS_ADMIN_PASSWORD`, `MEDINEXUS_ADMIN_NAME` | API | Optional first-start Admin account provisioning. Keep credentials in the host's secret settings. |
| `MEDINEXUS_DOCTOR_EMAIL`, `MEDINEXUS_DOCTOR_PASSWORD`, `MEDINEXUS_DOCTOR_NAME` | API | Optional first-start Doctor account provisioning. |
| `MEDINEXUS_STAFF_EMAIL`, `MEDINEXUS_STAFF_PASSWORD`, `MEDINEXUS_STAFF_NAME` | API | Optional first-start Staff account provisioning. |

The API reads `.env` when started by the provided server scripts. Hosting platforms should set backend variables in their private environment settings. `VITE_API_URL` is read while building the frontend, so changing it requires a new frontend build.

## Database and persistence

SQLite is initialized automatically when the API starts. The path is resolved from the process working directory when relative. In production, startup fails unless `MEDINEXUS_DB_PATH` is set to an absolute path; point it at a persistent disk or volume mounted by the API host. A container's writable layer or a static frontend host is not persistent storage.

Run one API instance against a SQLite file. Back up the database and verify restores before using persistent data. For multiple API instances, high availability, or a host without persistent volumes, migrate the database layer to a managed database such as PostgreSQL; `DATABASE_URL` is not currently supported and changing the environment variable alone will not migrate the application.

## Tests and builds

```bash
npm run server:check
npm run test:server
npm run build
npm run server:build
```

`npm run build` type-checks the frontend, Vite configuration, and server, then creates the static site in `dist/`. `npm run server:build` compiles the API to `dist-server/`. The compiled API starts with `npm run server:start` (or `npm start`); it does not use the Vite server or `tsx watch`.

## Deployment

No provider-specific deployment file is included. Deploy the frontend to an HTTPS static hosting service and the API to a Node.js service that supports Node 22.12+, a dynamic `PORT`, and persistent storage for SQLite.

### API service

1. Set the runtime to Node.js 22.12 or later.
2. Build with `npm ci && npm run server:build`.
3. Start with `npm run server:start` or `npm start`.
4. Set `NODE_ENV=production`, the platform-provided `PORT`, and `MEDINEXUS_DB_PATH` to an absolute filename on a persistent volume, such as `/var/lib/medinexus/medinexus.sqlite`.
5. Set `MEDINEXUS_CORS_ORIGIN` to the exact HTTPS frontend origin, for example `https://app.example.com`. Comma-separated HTTPS origins are supported.
6. Add provisioned account credentials only through the host's secret settings, if those roles are required.
7. Configure the host's health probe to request `GET /api/health`.

### Frontend service

1. Build with `npm ci && npm run build`.
2. Publish the `dist/` directory at the site's root.
3. For a separate API service, set the build-time variable `VITE_API_URL` to its HTTPS origin, for example `https://api.example.com`, then rebuild. Keep it blank only when `/api` is routed to the API on the same origin.
4. Open the deployed site's root URL and check that the API status indicator reports a connection.

Production cookies are `HttpOnly`, `Secure`, and `SameSite=None`. For reliable browser session behavior, use one site with an API path reverse-proxied to the backend, or use frontend and API subdomains under the same registrable domain (for example `app.example.com` and `api.example.com`). Browsers may block cookies when the frontend and API use unrelated hosting domains even with `SameSite=None`.

The current app has no client-side URL router: it serves its workspace at `/`. A root deployment therefore needs no SPA route rewrite. The Vite build emits the favicon and bundled assets under the site root; deploying under a subpath requires a separate Vite base-path configuration.

## Health check

`GET /api/health` returns a minimal service status, database connectivity state, timestamp, and application version. It responds with HTTP 200 when SQLite is reachable and HTTP 503 when the check fails. It does not include database paths, environment values, or credentials.

## Security considerations

- Credentialed CORS uses an explicit origin allowlist. In production, configure HTTPS origins; `*` and localhost are not production defaults.
- Production session cookies require HTTPS and use `HttpOnly`, `Secure`, and `SameSite=None`. The API rejects requests carrying an origin outside its allowlist.
- Passwords are scrypt-hashed, SQL queries use bound parameters, and API role checks run on the server.
- Authentication endpoints do not have application-level rate limiting. Add rate limiting at the API host or edge before opening registration to the public.
- The repository has not had a formal security or privacy assessment. Do not use it to process real patient data, and do not describe it as compliant with a healthcare or privacy regulation.

See [SECURITY.md](SECURITY.md) for vulnerability reporting guidance.

