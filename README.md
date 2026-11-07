# MediNexus

MediNexus is a role-aware hospital management platform prototype built around one connected care workspace. It combines clinical and operational workflows in a responsive React + Vite frontend with a Node.js + SQLite API.

## Live Demo

**GitHub Pages:** https://deepnayan832.github.io/MediNexus/

GitHub Pages hosts a static frontend preview; it does not connect to the separately hosted Node.js + SQLite API. The self-hosted Docker deployment below serves the frontend and API from one origin so session cookies remain same-site.

## Key Features & Capabilities

- **Role-aware workspaces:** Admin, Doctor, Staff, and Patient views with server-side role-based access control (RBAC).
- **Patient management:** Demographics, medical history, allergies, emergency contacts, search, and status filtering.
- **Appointment lifecycle:** Scheduling, confirmation, completion, and cancellation, with clinician and room assignments.
- **Beds and admissions:** Ward and bed inventory, availability and occupancy status, inpatient admissions, and discharge workflows.
- **Emergency triage:** Five-level Emergency Severity Index (ESI), vital signs, acuity prioritization, and clinical team assignment.
- **Pharmacy and prescriptions:** Medication stock, prescribing, and dispensing workflows.
- **Diagnostic labs:** Test ordering, priority tracking, and result recording.
- **Billing and insurance:** Invoice creation, insurance coverage and patient-due calculations, claims, and payment settlement.
- **Clinical notes:** Structured SOAP notes (Subjective, Objective, Assessment, Plan) linked to patients and providers.
- **Live operational dashboards:** API-backed KPIs for patient activity, appointments, emergency cases, bed occupancy, lab orders, and revenue.
- **Reports and exports:** Authorized server-side CSV exports for supported database tables.
- **Patient health tracker:** Steps, heart rate, sleep, hydration, blood oxygen (SpO₂), and weight, with trend visualizations.
- **Accessible interaction patterns:** Responsive navigation, keyboard-visible focus, Escape-to-close dialogs and menus, Ctrl/⌘+K search focus, and reduced-motion support.
- **Security foundations:** HTTP-only session cookies, RBAC enforcement, security headers, origin checks, and authentication/registration rate limits.

## Automated Verification

The server test suite covers health and session endpoints, registration and login, privileged-account provisioning, patient and appointment workflows, admissions, emergency triage, pharmacy, diagnostics, billing, exports, and access-control boundaries.

Run the server tests:

```bash
npm run test:server
```

Run TypeScript checks and the production frontend build:

```bash
npm run build
```

## Run Locally

Install dependencies and start the frontend:

```bash
npm install
npm run dev
```

In a second terminal, start the API:

```bash
npm run server:start
```

The API listens at `http://127.0.0.1:8787` by default and creates its SQLite database at `data/medinexus.sqlite`. Copy `.env.example` to `.env` to configure the port, database path, CORS origin, and optional provisioned staff accounts. The `server:dev` and `server:start` scripts load `.env` before initializing the API and database.

Never commit `.env`, production credentials, or real patient data. In production, `MEDINEXUS_DB_PATH` must be an absolute path on persistent storage; production mode does not seed synthetic patient records, sample appointments, or baseline health metrics.

## Self-hosted Deployment

The repository includes a Dockerfile and Docker Compose setup that host the frontend and API on one origin. Caddy provisions and renews HTTPS certificates after the domain's DNS points to the server. SQLite data is stored in a named Docker volume, so rebuilding the application image does not replace the database.

### Before you start

- Point an A/AAAA DNS record for your domain at the server.
- Allow inbound TCP ports 80 and 443 (and optionally UDP 443) through the server firewall.
- Install Docker Engine and the Docker Compose plugin.

### Configure and start

1. Copy `.env.example` to `.env`.
2. Set `DOMAIN` to the real DNS name and `MEDINEXUS_PUBLIC_ORIGIN` to its matching HTTPS origin, for example `https://hospital.example.com`. Replace all example values before starting.
3. If you want an initial administrator, set the administrator email/name and a strong `MEDINEXUS_ADMIN_PASSWORD` of at least 16 characters. Keep secrets in `.env`; never commit that file.
4. Build and start the services:

```sh
docker compose up -d --build
docker compose ps
docker compose logs -f app
```

Open `https://your-domain.example.com`. Check `https://your-domain.example.com/api/health` for the API health response. The app container is not published directly to the internet; Caddy exposes ports 80 and 443.

Production mode requires `MEDINEXUS_PUBLIC_ORIGIN` to be an HTTPS origin, enables Secure session cookies, and rejects API writes without an allowed Origin. If you intentionally use a separate frontend origin, add it to `MEDINEXUS_CORS_ORIGINS`; production accepts only HTTPS origins without paths or credentials.

### Maintenance and backups

Useful commands:

```sh
docker compose logs --tail=200 app
docker compose pull caddy
docker compose up -d --build
docker compose down
```

The named `medinexus_data` volume persists the SQLite database across container recreation. Back it up regularly and test restoring a backup before updating the app. Do not run `docker compose down -v` unless you intentionally want to delete persistent volumes.

### Authentication and security guardrails

The API limits login attempts (10 per client per minute by default) and registrations (5 per client per hour by default). Compose enables `MEDINEXUS_TRUST_PROXY=true` only behind Caddy, which overwrites `X-Forwarded-For` with the connecting client address. Do not enable trusted-proxy mode unless your reverse proxy does the same. These in-memory limits are for a single instance and do not replace account-lockout policy, monitoring, multi-factor authentication, or a managed identity service.

**Data and clinical-safety boundary:** MediNexus is a portfolio/demo project, not a validated hospital information system. Its authorization and workflows have not been validated for real patient records, clinical decisions, or regulated healthcare use. Use synthetic data only until the application has undergone comprehensive security, privacy, operational, and clinical-safety review.
