# MediNexus

MediNexus is a premium, role-aware hospital management platform concept built around one connected care workspace. The current first slice establishes the visual system and the primary operations workflow in a responsive React + Vite app.

## Live Demo

**GitHub Pages:** https://deepnayan832.github.io/MediNexus/

The GitHub Pages site is a static frontend preview. The Node.js + SQLite API is a separate backend today. The Docker deployment described below serves the built frontend and API from one origin, keeping session cookies same-site; the existing GitHub Pages preview does not use that hosted backend.

## Current slice

- Role-aware Admin, Doctor, Staff, and Patient workspaces
- Responsive app shell with mobile navigation
- Operations dashboard with KPI cards, schedule, patient flow chart, team activity, and emergency status
- Searchable module views for patients, appointments, beds, emergency, pharmacy, labs, billing, reports, and settings
- Working appointment and emergency dialogs, role switching, notifications, chart range controls, row selection, detail drawers, toasts, and empty search state
- Patient health tracker with steps, heart rate, sleep, hydration, blood oxygen, weight, trend visualization, daily goals, and metric detail panels
- Light/dark theme switching with device persistence, sound feedback, supported vibration cues, and a preferences panel
- Accessible semantic controls, keyboard-visible focus, Escape-to-close dialogs/menus, ⌘/Ctrl+K search focus, and reduced-motion support
- Node/SQLite API foundation with schema bootstrapping, registration/login/logout sessions, server-side role checks, audit logging, patient/appointment queries, notifications, and health-metric writes
- Live API connection indicator with a graceful demo-data fallback when the API is not running
- Authenticated Patient flow in the UI, session restoration, sign-out, RBAC-aware workspace switching, and API-backed health tracker values

## Self-hosted deployment

The repository includes a Dockerfile and Docker Compose setup for hosting the **frontend and API on one origin**. Caddy handles HTTPS automatically after your domain's DNS points to the server. SQLite data is stored in a named Docker volume so app image rebuilds do not replace the database.

**Before starting:** point an A/AAAA record for your domain at the server, allow inbound TCP ports 80 and 443 (and optionally UDP 443), and install Docker Engine with the Compose plugin.

1. Copy `.env.example` to `.env`.
2. Set `DOMAIN` to the real DNS name and `MEDINEXUS_PUBLIC_ORIGIN` to the matching `https://...` origin. Change the example values before running Compose.
3. Set a strong password for the provisioned `MEDINEXUS_ADMIN_PASSWORD` and its email/name fields if you want an initial administrator. Keep all passwords in `.env`; never commit that file or use real patient credentials for a demo.
4. Start the app:

```sh
docker compose up -d --build
docker compose ps
docker compose logs -f app
```

Open `https://your-domain.example.com`. Check `https://your-domain.example.com/api/health` for the API health response. The app container is not published directly to the internet; only Caddy exposes ports 80 and 443. Production mode requires `MEDINEXUS_PUBLIC_ORIGIN` to be an HTTPS origin, enables Secure session cookies, and rejects API writes without an allowed Origin.

Useful maintenance commands:

```sh
docker compose logs --tail=200 app
docker compose pull caddy
docker compose up -d --build
docker compose down
```

The named `medinexus_data` volume persists the SQLite file across container recreation. Back it up regularly and test restoring a backup before updating the app. Do not run `docker compose down -v` unless you intentionally want to delete persistent volumes.

**Data and security boundary:** this is a portfolio/demo project, not a validated hospital information system. The current authorization and workflows are not sufficient for real patient records, clinical decisions, or regulated healthcare use. Use synthetic data only until the app has undergone a comprehensive security, privacy, operational, and clinical-safety review.

## Run locally

```bash
npm install
npm run dev
```

In a second terminal, start the API:

```bash
npm run server:start
```

The API listens on `http://127.0.0.1:8787` by default and creates its local SQLite file at `data/medinexus.sqlite`. Copy `.env.example` to `.env` to configure the port, database path, CORS origin, or provisioned staff accounts. Never commit `.env` or production credentials.

Production build:

```bash
npm run build
```

Server workflow tests:

```bash
npm run test:server
```

## Design direction

The product uses a midnight navy navigation rail, a true-white and pale blue-gray workspace, electric cyan / violet accents, mint success states, and coral emergency signaling. The generated desktop concept used for the first implementation reference is saved at `public/concepts/medinexus-dashboard-concept.png`.

## Roadmap

1. Connect the role-aware UI to authenticated API sessions and replace remaining demo dashboard fixtures with API data.
2. Expand appointments, patient records, clinical notes, admissions, pharmacy, lab, billing, and insurance workflows.
3. Add automated API/UI tests, migrations, production observability, and a managed relational database deployment.
