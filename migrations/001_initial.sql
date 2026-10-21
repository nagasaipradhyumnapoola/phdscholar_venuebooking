CREATE TABLE departments (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE users (
 id TEXT PRIMARY KEY, department_id TEXT NOT NULL REFERENCES departments(id),
 name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, faculty_id TEXT NOT NULL UNIQUE,
 role TEXT NOT NULL CHECK(role IN ('admin','coordinator','supervisor','hod','panel','scholar')),
 password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE scholars (
 id TEXT PRIMARY KEY, department_id TEXT NOT NULL REFERENCES departments(id),
 name TEXT NOT NULL, registration_id TEXT NOT NULL UNIQUE, email TEXT NOT NULL,
 supervisor_id TEXT NOT NULL REFERENCES users(id), user_id TEXT UNIQUE REFERENCES users(id),
 research_area TEXT NOT NULL DEFAULT ''
);
CREATE TABLE available_dates (
 department_id TEXT NOT NULL REFERENCES departments(id), date TEXT NOT NULL,
 enabled INTEGER NOT NULL CHECK(enabled IN (0,1)), note TEXT NOT NULL DEFAULT '',
 updated_by TEXT NOT NULL REFERENCES users(id), PRIMARY KEY(department_id,date)
);
CREATE TABLE bookings (
 id TEXT PRIMARY KEY, department_id TEXT NOT NULL REFERENCES departments(id),
 scholar_id TEXT NOT NULL REFERENCES scholars(id), supervisor_id TEXT NOT NULL REFERENCES users(id),
 date TEXT NOT NULL, time TEXT NOT NULL, venue TEXT NOT NULL, title TEXT NOT NULL, abstract TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL CHECK(status IN ('pending_coordinator','pending_hod','approved','rejected','cancelled')),
 version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 FOREIGN KEY(department_id,date) REFERENCES available_dates(department_id,date)
);
-- Reservation begins on submission. Applies across all venues, times and processes.
CREATE UNIQUE INDEX one_live_booking_per_department_day ON bookings(department_id,date)
 WHERE status IN ('pending_coordinator','pending_hod','approved');
CREATE UNIQUE INDEX one_live_booking_per_scholar ON bookings(scholar_id)
 WHERE status IN ('pending_coordinator','pending_hod','approved');
CREATE TABLE booking_panel (
 booking_id TEXT NOT NULL REFERENCES bookings(id), user_id TEXT NOT NULL REFERENCES users(id),
 PRIMARY KEY(booking_id,user_id)
);
CREATE TABLE history (
 id TEXT PRIMARY KEY, booking_id TEXT NOT NULL REFERENCES bookings(id), actor_id TEXT NOT NULL REFERENCES users(id),
 action TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE audit (
 id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, details TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), csrf_token TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE login_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL);
CREATE TABLE notifications (
 id TEXT PRIMARY KEY, booking_id TEXT NOT NULL REFERENCES bookings(id), recipient_id TEXT NOT NULL REFERENCES users(id),
 kind TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, read_at TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(booking_id,recipient_id,kind)
);
CREATE TABLE mail_outbox (
 id TEXT PRIMARY KEY, booking_id TEXT NOT NULL REFERENCES bookings(id), recipient TEXT NOT NULL, kind TEXT NOT NULL,
 subject TEXT NOT NULL, body TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','captured','sent')),
 attempts INTEGER NOT NULL DEFAULT 0, available_at INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0,
 last_error TEXT, sent_at TEXT, UNIQUE(booking_id,recipient,kind)
);
CREATE INDEX bookings_department ON bookings(department_id,date);
CREATE INDEX notifications_recipient ON notifications(recipient_id,created_at);
CREATE INDEX outbox_pending ON mail_outbox(state,available_at);
