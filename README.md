# MediNexus

MediNexus is a premium, role-aware hospital management platform concept built around one connected care workspace. The current first slice establishes the visual system and the primary operations workflow in a responsive React + Vite app.

## Live Demo

**GitHub Pages:** https://deepnayan832.github.io/MediNexus/

The live deployment is the frontend demo. The Node/SQLite API remains a local/backend service, so authentication and API-backed features require the backend to be running locally until a production backend is deployed.

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
