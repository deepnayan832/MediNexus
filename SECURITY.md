# Security Policy

## Project status

MediNexus is a full-stack hospital management reference application, not a certified clinical medical device. Do not use it in unvalidated environments to store real protected health information (PHI) or to make autonomous clinical decisions.

## Implemented security controls

- **Authentication & Password Storage:** Passwords (minimum 12 characters) are hashed with Node.js `crypto.scryptSync` using a unique 16-byte random salt per user and verified with `crypto.timingSafeEqual`. Environment-provisioned privileged accounts (`Admin`, `Doctor`, `Staff`) reject weak or predictable passwords at startup.
- **Session Management:** Sessions use 32-byte cryptographically random tokens stored as SHA-256 hashes in SQLite (`sessions` table) and transmitted via `HttpOnly`, `SameSite=Lax` cookies (`Secure` in production). Expired sessions are pruned automatically, and changing a password (`POST /api/auth/change-password`) revokes all other active sessions for that user.
- **Role-Based & Resource-Level Access Control:** Server endpoints enforce both role checks (`Admin`, `Doctor`, `Staff`, `Patient`) and patient-ownership checks (preventing cross-patient IDOR on appointments, clinical notes, invoices, and insurance claims).
- **CSRF & Origin Enforcement:** All mutating API requests (`POST`, `PUT`, `PATCH`, `DELETE`) require an explicit `Origin` header matching the configured allowlist (`MEDINEXUS_PUBLIC_ORIGIN` / `MEDINEXUS_CORS_ORIGINS`).
- **CSV Formula Injection Mitigation:** Tabular CSV exports (`/api/export/:table`) neutralize leading formula characters (`=`, `+`, `-`, `@`, `\t`, `\r`) before quoting.
- **Rate Limiting & Payload Bounds:** Authentication and registration endpoints enforce sliding-window rate limits per client IP, and JSON request bodies are capped at 64 KB.
- **Security Headers:** Responses include `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and `Strict-Transport-Security` (in production).

## Supported versions

Security fixes are applied to the `main` branch.

## Reporting a vulnerability

For a sensitive report, use GitHub's **Report a vulnerability** feature in the repository's Security tab if private vulnerability reporting is enabled. If it is not available, contact the maintainer through their GitHub profile to request a private reporting channel.

Please include the affected commit or branch, the impact, and concise reproduction steps. Do not include real patient data, credentials, access tokens, or other secrets in a public issue.
