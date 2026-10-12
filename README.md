# MediNexus

MediNexus is a premium, role-aware hospital management platform concept built around one connected care workspace. The current first slice establishes the visual system and the primary operations workflow in a responsive React + Vite app.

## Live Demo

**GitHub Pages:** https://deepnayan832.github.io/MediNexus/

The GitHub Pages site is a static frontend preview. The Node.js + SQLite API is a separate backend today. The Docker deployment described below serves the built frontend and API from one origin, keeping session cookies same-site; the existing GitHub Pages preview does not use that hosted backend.

## Key Features & Capabilities

- **Role-Aware Workspaces:** Tailored views and controls for Admin, Doctor, Staff, and Patient roles with server-side Role-Based Access Control (RBAC).
- **Comprehensive Clinical & Operational Modules:**
  - **Patients Management:** Demographics, medical history, allergies, emergency contacts, real-time search & status filtering.
  - **Appointments Lifecycle:** Full appointment scheduling, confirmation, clinical consultation completion, and cancellation with room and doctor assignments.
  - **Inpatient Beds & Admissions:** Ward bed inventory management across Ward A, B, C and ICU with status transitions (`Available`, `Occupied`, `Cleaning`, `Maintenance`), inpatient admissions, and safe discharges.
  - **Emergency Triage Queue:** 5-tier Emergency Severity Index (ESI) triage system (Resuscitation, Emergent, Urgent, Less Urgent, Non-Urgent) with vital signs tracking and rapid clinical team assignments.
  - **Pharmacy & Prescriptions:** Medication stock tracking, unit pricing, doctor prescribing, and pharmacist dispensing workflows.
  - **Diagnostic Labs:** Lab test orders catalog (CBC, Troponin, MRI, Lipid Panel, etc.) with priority levels (`routine`, `urgent`, `stat`), sample collection tracking, and clinical result recording.
  - **Billing & Invoices:** Patient billing generation, insurance coverage calculations, patient copay tracking, and direct payment processing.
  - **Clinical Notes (SOAP):** Structured Subjective, Objective, Assessment, and Plan documentation linked to patients and providers.
- **Real-Time KPI Dashboards:** Live operational KPI aggregation calculating active patients, today's appointments, emergency cases, bed occupancy rates, pending lab orders, and monthly revenue.
- **Interactive Action Modals & Drawers:**
  - Rapid booking modal for appointments
  - Emergency triage intake modal
  - Patient registration modal
  - Inpatient bed admission modal
  - Doctor prescription ordering modal
  - Diagnostic lab requisition modal
  - Invoice billing creation modal
  - Actionable side drawer for discharging patients, dispensing medications, recording lab results, and settling invoices.
- **Data Export & Reporting:** Direct server-side sanitized CSV export for all database tables (`/api/export/:table`).
- **Patient Health Tracking:** Real-time metrics tracking for steps, heart rate, sleep, hydration, SpO2, and weight with trend visualizations.
- **Deep Security Hardening:**
  - Robust session management with HTTP-only, SameSite cookies.
  - Role-Based Access Control (RBAC) enforced on every API route.
  - Secure HTTP headers (CSP, HSTS, X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy).
  - Configured CORS origins with safe localhost/127.0.0.1 development fallback.
  - In-memory rate limiting against brute-force authentication and registration spam.

## Automated Verification & Test Suite

The test suite includes 12 comprehensive end-to-end integration and RBAC verification tests covering:
1. Public health check
2. Secure session restoration
3. Patient registration, login, and session cookie validation
4. Admin provisioning and operational dashboard aggregation
5. Full patient lifecycle (create, query, update)
6. Complete appointment lifecycle (request, confirm, complete, cancel)
7. Bed management, inpatient admission, and discharge workflows
8. Emergency triage queue intake and prioritization
9. Pharmacy medication stock and prescription dispensing
10. Diagnostic lab requisition, prioritization, and result recording
11. Billing invoice creation, insurance copay, and payment settlement
12. Strict Role-Based Access Control enforcement (forbidden operations blocked)

Run tests locally:

```bash
npm run test:server
```

Run TypeScript compilation and production bundle build:

```bash
npm run build
```

## Run Locally

```bash
npm install
npm run dev
```

In a second terminal, start the API:

```bash
npm run server:start
```

The API listens on `http://127.0.0.1:8787` by default and creates its local SQLite file at `data/medinexus.sqlite`.

## Self-hosted Deployment

The repository includes a Dockerfile and Docker Compose setup for hosting the frontend and API on one origin with Caddy handling HTTPS automatically.

```sh
docker compose up -d --build
docker compose ps
docker compose logs -f app
```
