# Research Office — PhD Pre-talk Scheduling & Approval

A working, independent demonstration of departmental PhD pre-talk scheduling. All seeded people, IDs, topics, and accounts are fictional. The SRMIST logo and favicon are included at the user's request, sourced from the official website and credited in `public/assets/ATTRIBUTION.md`. This is **not an official SRMIST application**, and no endorsement is claimed.

The project lives at **`D:\SCHOLAR VENUE`**. The local preview is **http://127.0.0.1:4173**. Use that exact address; `APP_ORIGIN` intentionally permits one origin.

Mobile navigation uses a role-aware menu drawer. Help is in the footer and drawer. Every application page has its own title and description; unknown server paths return a branded HTTP 404. Footer links include the published institutional email `infodesk@srmist.edu.in`, with no phone number. Text responses are compressed, and the SVG logo assets have been reduced by approximately 54%.

The interface now follows SRMIST's current blue `#0c4da2`, yellow `#e4b316`, institutional masthead, horizontal desktop navigation and formal heading hierarchy. Source Sans 3 is self-hosted with its open-font license. Dark mode, permitted-record search (Ctrl/Cmd + K), copy/print, sticky headers, scroll progress, contact/help, FAQ, loading feedback, and consent-controlled local UTM attribution are included. All 20 requested controls are mapped in [docs/PORTAL_TOOLS.md](docs/PORTAL_TOOLS.md).

## Run locally

Requires Node.js **24.14 or newer** and npm. Tested with Node 24.14.1 on Windows. Node 24's built-in SQLite module emits an experimental-feature warning; the warning does not prevent operation.

```powershell
Set-Location 'D:\SCHOLAR VENUE'
npm ci
Copy-Item .env.example .env
npm run migrate
npm run seed
npm run demo:accounts
npm start
```

Open http://127.0.0.1:4173. The login screen has role buttons that fill fictional demo credentials; click **Sign in to workspace** afterward. The app is already installed, seeded, and running in the delivered workspace.

`npm run dev` restarts the server when source files change. There is no frontend build step: the app serves local HTML, CSS, JavaScript, logo assets and its bundled font without a runtime CDN dependency.

## DEMO credentials

**Password for every account below: `DemoOnly!2026`**. These intentionally public demo credentials are not secrets. Never reuse them or enter a real SRM password.

| Role | Fictional email | Main abilities |
|---|---|---|
| Department admin | `admin@demo.example` | Maintain department accounts and mappings, dates, first approval, cancellations, audit |
| Research coordinator | `coordinator@demo.example` | Maintain faculty, scholars, mappings and dates; first approval; cancellation |
| Supervisor | `supervisor@demo.example` | Book for mapped scholars and withdraw pending requests |
| Second supervisor | `supervisor2@demo.example` | Separate scholar portfolio in the same department |
| HOD | `hod@demo.example` | Final approval or rejection after coordinator approval |
| Panel | `panel@demo.example` | Read assigned requests, history, and final notifications |
| Additional panel | `panel2@demo.example`, `panel3@demo.example`, `panel4@demo.example` | Same panel permissions |
| Scholar (optional, read-only) | `scholar@demo.example` | View Ananya's own request/history and notifications |
| Other department supervisor | `other-supervisor@demo.example` | Department-isolation demo; no scholars initially mapped |

The initial CSE dataset has five scholars, four panel members, two supervisors, enabled/disabled dates over the next 65 days, and requests in all five states. Dates are generated relative to the day of initial seeding in IST. Seeding is non-destructive and refuses to add duplicate demo data to a populated database. It is prohibited in production.

### Additional sample accounts and credential table

Run `npm run demo:accounts` to add the extended sample set and regenerate the project-root [table](table) file. The extended set contains **31 fictional accounts** across CSE and ECE: three admins, coordinators, supervisors, HODs and scholars in CSE, four CSE panel accounts, and two accounts for every role in ECE. All use `DemoOnly!2026` unless a password was subsequently changed. The command adds seven scholar mappings and four requests awaiting coordinator/HOD review; each supervisor has a free mapped scholar available for a new booking.

This additive command preserves existing accounts, passwords, disabled states and request history, and can be re-run without duplicating rows. Changed passwords are marked **Changed; not exported** in the table. It refuses production use and conflicting account identities. Only known fictional demo accounts are included in the file. The live workspace already has this extended set installed; the base seed and original automated browser fixtures remain unchanged.

## Try the complete workflow

1. Sign in as coordinator. Open **Manage dates** and enable a future day. **Scholars & mapping** shows who belongs to each supervisor; **Faculty & access** manages department accounts.
2. Sign out and sign in as supervisor. **Schedule a pre-talk** for Aditya, enter a venue and start time, and choose a panel. Existing active scholars are unavailable for another simultaneous request.
3. Submit. The department day is reserved immediately, regardless of hall or time. The status is **Coordinator review**.
4. Coordinator opens **Approval queue**, reviews the details, chooses **Approve & forward to HOD**, and confirms the decision.
5. HOD opens their own **Approval queue**, gives final approval, and confirms. The status becomes **Confirmed**.
6. The supervisor, scholar, assigned panel members, and HOD receive in-app notifications (if they have accounts) and email records. **Email outbox** shows **Demo captured**, which means no external message was sent.
7. Coordinator can cancel a confirmed future pre-talk with a reason. This releases the day and queues cancellation updates. History remains visible.

## Implemented features

- Responsive dashboard, date calendar, request register and search/status filters, approval queue, detail/history dialog, faculty accounts, scholar mapping, notifications, email outbox, and activity log.
- Email/password login; scrypt password hashes; random server-side sessions stored as SHA-256 digests; 8-hour expiry; HttpOnly/SameSite=Strict cookies; secure cookies in production; session revocation on logout/deactivation.
- Server-enforced role, department, scholar ownership and assigned-panel checks. No public self-registration or client-provided role escalation.
- Origin validation, session-bound CSRF tokens for mutations, persistent login throttling by IP and email, bounded request bodies and strict Zod schemas, parameterized SQL, CSP and security headers.
- SQL migrations, persistent SQLite WAL database, atomic reservations, optimistic version checks for reviews, immutable request history through the API and management audit records.
- Transactional final-notification outbox, deduplicated recipients, capture and SMTP transports, recovery leases, durable exponential retries, and a manual worker command.

## Workflow assumptions and boundaries

The transcript's unresolved details are explicitly resolved in [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md). In particular:

- Day reservation starts at submission, not final approval. Only one live request per department/day and one live request per scholar.
- Rejection/cancellation needs a reason (5–1500 characters), preserves history, and releases the day. Rebooking starts the approvals again.
- Supervisors can withdraw pending requests; only coordinator/admin can cancel confirmed talks. Past talks cannot be cancelled. Reviews require a future date in IST.
- Submitted title, venue, time, scholar, and panel are immutable. Cancel and create a fresh request to change them.
- Coordinator/admin manages the scholar directory. Remapping and disabling assigned supervisors/panel are blocked while an active request exists. HOD access cannot be disabled through the normal UI.
- At least one panel member is required; four or five is recommended, rather than enforced, because the transcript does not establish a fixed count.
- Admin and coordinator have the first review step; HOD is always a separate account and step. Admin does not bypass final HOD approval.
- Scholar login is optional/read-only. Creating a scholar directory entry does not automatically create a login. Scholar email still receives final notices.
- No coursework, publication eligibility, academic evaluation, hall inventory, duration/room booking, or thesis approval is inferred or implemented.

## Email

The default `MAIL_MODE=capture` stores each email as **captured**. It does **not** send real email. The server checks the durable outbox every five seconds; refresh the outbox page for current delivery states. `npm run mail` performs a manual batch.

To deliver real email later, supply your own SMTP configuration in `.env` or an environment secret store: `MAIL_MODE=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`. Use implicit TLS on port 465 with `SMTP_SECURE=true`, or mandatory STARTTLS on port 587 with `SMTP_SECURE=false`. Certificates are validated. Captured demo messages are not silently resent when switching modes; only pending messages are processed.

Notifications and recipients are recorded in the same transaction as final approval. Uniqueness prevents repeated approvals from creating duplicate outbox records. SMTP delivery is **at least once**: a worker crash after provider acceptance but before the local sent record could resend a message. Stable message IDs help providers deduplicate, but exactly-once delivery is not claimed. Failed mail remains queued with bounded retry delay and a visible generic failure indicator. Operators should monitor pending mail and provider health.

## Database and migrations

Default file: `data/pretalk.sqlite`, ignored by Git. Set `DATABASE_PATH` to change it. Migrations are in `migrations/` and tracked in `schema_migrations`; startup applies missing migrations automatically, inside a transaction.

The central database invariant is a partial unique index on `(department_id,date)` for statuses `pending_coordinator`, `pending_hod`, and `approved`. `BEGIN IMMEDIATE` serializes the eligibility check, insert or decision, history and outbox changes. Thus different browser tabs and independent application processes cannot reserve the same department day. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Keep SQLite on a persistent **local filesystem on one host**. Do not put the WAL database on a network share or use separately copied databases across replicas. Back up a live database using SQLite's backup mechanism, or stop the app and copy the database consistently with its WAL files. A separately managed PostgreSQL deployment would need an equivalent partial unique index and transactional workflow.

For a fresh demo later, stop the server and **rename** the whole `data` folder to a backup, then run `npm run seed`. Do not reset a database containing records you need.

## Tests and verification

```powershell
npm run check
npm run test:e2e
npm audit
```

Backend tests use isolated in-memory databases. The concurrency test starts two real independent Node processes sharing a temporary file database. Browser tests start an isolated in-memory test app on port 4174; they do not mutate the demo data you use on port 4173. Browser tests use Microsoft Edge; it must be installed. To use another installed Playwright browser, change the `channel` setting in `playwright.config.js`.

The browser suite covers booking through both approvals, panel confirmation, cancellation, date enablement, scholar creation/remapping, faculty provisioning, all-role navigation, filters, keyboard focus, mobile overflow, and automated axe checks. See [docs/TESTING_REPORT.md](docs/TESTING_REPORT.md) for the recorded results and limitations.

## Deployment preparation

This delivery is a local working implementation; no public hosting or official SRM infrastructure is configured.

For real use, create a new empty database, set `NODE_ENV=production` and an HTTPS `APP_ORIGIN`, and provision real accounts under your institution's policies. Production startup refuses a database containing `@demo.example` users, and refuses a non-HTTPS origin. It also disables demo seeding. Keep the app bound to loopback behind a maintained HTTPS reverse proxy; set request/time/rate limits at that proxy. The app deliberately does not trust arbitrary forwarded IP headers. Choose proxy trust only for your exact deployment topology.

An initial real admin can be created with `scripts/create-admin.js`. It takes name, email, faculty ID, and department as arguments, and reads a password from stdin (not command-line arguments). Example without embedding a password in shell history:

```powershell
$adminPasswordInput = Read-Host 'Initial administrator password' -MaskInput
$adminPasswordInput | node scripts/create-admin.js 'Administrator Name' 'admin@your-institution.example' 'FACULTY-ID' 'Department Name'
Remove-Variable adminPasswordInput
```

Use your own real address in that command. The `.example` domain shown is a placeholder, not an account. Do not carry the demo database or demo credentials into a real deployment. Keep `data`, environment secrets and backups outside web-accessible folders and restrict their filesystem permissions to the service account.

Before real institutional rollout: integrate institutional identity/SSO or a reviewed account invitation/password reset flow, establish backups and monitoring, validate mail delivery, agree academic scheduling and retention policies, and perform a deployment-specific security and accessibility assessment. There is no self-service password recovery, MFA, verified-email signup, public calendar, external calendar integration, or completed-talk lifecycle in this scoped build. Neither a penetration test nor full WCAG certification is claimed.

## Project map

| Location | Purpose |
|---|---|
| `public/` | Local frontend, original SVG icon, responsive design system |
| `server/app.js` | HTTP routes, schemas, authentication and authorization |
| `server/domain.js` | Booking, approval, cancellation, visibility, notification transactions |
| `server/db.js`, `migrations/` | SQLite connection and versioned schema |
| `server/security.js` | Password and session cryptographic primitives |
| `server/mailer.js` | Durable capture/SMTP worker and retries |
| `server/seed-data.js`, `scripts/` | Fictional data, migration, seed, mail, first admin |
| `tests/` | API, authorization, email, process concurrency, and browser tests |
| `docs/` | Requirement traceability, design research, architecture, testing report |

