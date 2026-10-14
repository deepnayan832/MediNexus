# MediNexus

MediNexus is a full-stack, role-aware hospital management platform built around a unified React + TypeScript frontend and a Node.js + SQLite backend API.

## Live Demo

**GitHub Pages:** https://deepnayan832.github.io/MediNexus/

The GitHub Pages site is a static frontend preview. The Node.js + SQLite API is a server backend that can be run locally or self-hosted via Docker Compose + Caddy on a single HTTPS origin so session cookies remain `SameSite=Lax`.

## Key Features & Capabilities

- **Role-Aware Workspaces:** Tailored views and controls for `Admin`, `Doctor`, `Staff`, and `Patient` roles with strict server-side Role-Based Access Control (RBAC) and resource-level ownership verification (IDOR protection).
- **Comprehensive Clinical & Operational Modules:**
  - **Patients Management:** Demographics, medical history, blood group, allergies, real-time search, and status filtering.
  - **Appointments Lifecycle:** Full appointment scheduling, confirmation, clinical consultation completion, and patient-scoped cancellation with room and clinician assignments.
  - **Inpatient Beds & Admissions:** Ward bed inventory management across Ward A, B, C, and ICU with status transitions (`Available`, `Occupied`, `Cleaning`, `Maintenance`), bed availability enforcement (`409 Conflict` against double occupancy), active admission linking, and safe patient discharges.
  - **Emergency Triage Queue:** 5-tier Emergency Severity Index (ESI) triage system (`1` Resuscitation through `5` Non-Urgent) with vital signs tracking, team assignment, treatment progression, and discharge.
  - **Pharmacy & Prescriptions:** Medication catalog, stock & reorder tracking, restocking (`PATCH /api/medications/:id`), doctor prescribing (`POST /api/prescriptions`), and pharmacist dispensing (`PATCH /api/prescriptions/:id/dispense`) with atomic stock decrement and double-dispense prevention.
  - **Diagnostic Labs:** Lab test orders catalog (CBC, Troponin, MRI, Lipid Panel, etc.) with priority levels (`Routine`, `Urgent`, `Stat`) and diagnostic result recording.
  - **Billing, Invoices & Insurance Claims:** Patient billing generation, insurance coverage calculations, patient copay tracking, direct payment settlement (`POST /api/billing/:id/pay` with double-payment protection), and verified insurance claim submission (`POST /api/insurance`).
  - **Clinical Notes & Care Messages (SOAP):** Structured Subjective, Objective, Assessment, and Plan documentation (`GET /api/clinical-notes`, `POST /api/clinical-notes`) accessible in the **Messages** workspace module.
  - **Hospital Reports & Audit Trail:** Formula-safe CSV exports across 11 hospital domains (`/api/export/:table`) and live server security audit log inspection (`GET /api/audit-logs`).
  - **Workspace Settings:** Live account profile editing (`PATCH /api/auth/profile`), password rotation with automatic revocation of other active sessions (`POST /api/auth/change-password`), and persistent theme/audio/haptic accessibility preferences.
- **Patient Health Tracking:** Real-time metrics tracking for steps, heart rate, sleep, hydration, SpO2, and weight (`GET /api/health-metrics`, `POST /api/health-metrics`).
- **Security Hardening:**
  - `scrypt` password hashing with per-user random 16-byte salts and constant-time (`timingSafeEqual`) verification.
  - Server-backed sessions (`medinexus_session`) in `HttpOnly`, `SameSite=Lax` cookies (`Secure` in production), with expired session pruning and session revocation on password change.
  - Resource-level ownership checks preventing cross-patient IDOR on appointments, clinical notes, invoices, and insurance claims.
  - Formula-injection neutralization (`CWE-1236`) on all CSV exports.
  - Strict Origin validation on state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`) and sliding-window rate limiting on login and registration.

## Automated Verification & Test Suite

The test suite (`tests/server.test.ts`) includes 15 end-to-end integration, business-logic, and security regression tests:
1. Patient registration, RBAC enforcement, health metric logging, and session logout
2. Cross-origin write rejection (`403 Forbidden`)
3. Unsafe registration and malformed health metric rejection (`422`)
4. Sliding-window rate limiting on repeated login attempts (`429`)
5. Per-user private notification read-state isolation
6. Weak bootstrap password rejection for privileged accounts
7. Staff and doctor patient, appointment, and clinical SOAP note lifecycle
8. Inpatient bed creation, admission, occupancy transition, and discharge flow
9. Emergency triage queue intake and status/vitals updates
10. Pharmacy catalog, prescribing, dispensing, lab diagnostics, billing, and insurance claims
11. Authorized CSV export and patient export denial (`403`)
12. User profile update and password change
13. Cross-patient IDOR protection on appointments (`GET`/`PATCH`), clinical notes (`GET`), insurance claims (`POST`), pharmacy inventory (`GET`), and audit logs (`GET`)
14. Bed double-occupancy prevention (`409`), double-discharge prevention (`409`), prescription stock decrement & double-dispense prevention (`409`), CSV formula injection sanitization, and admin audit log verification
15. Automatic revocation of other active sessions upon password change

Run tests locally:

```bash
npm run test:server
```

Run TypeScript compilation and production bundle build:

```bash
npm run build
```

## Run Locally

Copy `.env.example` to `.env` if you want to customize ports, database paths, or bootstrap accounts, then run:

```bash
npm install
npm run dev
```

In a second terminal, start the API:

```bash
npm run server:start
```

The API listens on `http://127.0.0.1:8787` by default and creates its local SQLite database at `data/medinexus.sqlite` with WAL mode and foreign keys enabled.

## Self-Hosted Deployment (Non-Oracle)

The repository includes a multi-stage `Dockerfile`, `compose.yaml`, and `deploy/Caddyfile` for self-hosting the built frontend and Node.js + SQLite API on a single HTTPS origin with Caddy managing TLS certificates automatically:

```sh
docker compose up -d --build
docker compose ps
docker compose logs -f app
```
