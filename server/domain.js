import { randomUUID } from "node:crypto";
import { transaction } from "./db.js";
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const fail = (status, message) => {
  throw new HttpError(status, message);
};
export const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(),
  );
export const isManager = (u) => ["admin", "coordinator"].includes(u.role);
export const live = (s) =>
  ["pending_coordinator", "pending_hod", "approved"].includes(s);
export function assertRoles(user, ...roles) {
  if (!roles.includes(user.role))
    fail(403, "Your role cannot perform this action.");
}
export function audit(db, user, action, details) {
  db.prepare(
    "INSERT INTO audit(id,actor_id,action,details) VALUES (?,?,?,?)",
  ).run(randomUUID(), user.id, action, JSON.stringify(details));
}
export function canRead(db, user, booking) {
  if (user.department_id !== booking.department_id) return false;
  if (["admin", "coordinator", "hod"].includes(user.role)) return true;
  if (user.role === "supervisor") return booking.supervisor_id === user.id;
  if (user.role === "panel")
    return !!db
      .prepare("SELECT 1 FROM booking_panel WHERE booking_id=? AND user_id=?")
      .get(booking.id, user.id);
  return !!db
    .prepare("SELECT 1 FROM scholars WHERE id=? AND user_id=?")
    .get(booking.scholar_id, user.id);
}
export function getBooking(db, user, id) {
  const b = db
    .prepare(
      `SELECT b.*, s.name scholar_name, s.registration_id, s.email scholar_email,
    u.name supervisor_name FROM bookings b JOIN scholars s ON s.id=b.scholar_id JOIN users u ON u.id=b.supervisor_id WHERE b.id=?`,
    )
    .get(id);
  if (!b || !canRead(db, user, b)) fail(404, "Pre-talk not found.");
  return b;
}
export function history(db, id, user, action, note = "") {
  db.prepare(
    "INSERT INTO history(id,booking_id,actor_id,action,note) VALUES (?,?,?,?,?)",
  ).run(randomUUID(), id, user.id, action, note);
}
export function queueNotifications(db, booking, kind) {
  const scholar = db
    .prepare("SELECT * FROM scholars WHERE id=?")
    .get(booking.scholar_id);
  const recipients =
    kind === "cancelled"
      ? db
          .prepare(
            `SELECT u.id,u.email FROM notifications n JOIN users u ON u.id=n.recipient_id
    WHERE n.booking_id=? AND n.kind='approved'`,
          )
          .all(booking.id)
      : db
          .prepare(
            `SELECT DISTINCT u.id,u.email FROM users u WHERE u.active=1 AND u.department_id=? AND
    (u.id=? OR u.role='hod' OR u.id=? OR u.id IN (SELECT user_id FROM booking_panel WHERE booking_id=?))`,
          )
          .all(
            booking.department_id,
            booking.supervisor_id,
            scholar.user_id,
            booking.id,
          );
  const subject = `${kind === "approved" ? "Pre-talk confirmed" : "Pre-talk cancelled"}: ${scholar.name}`;
  const body = `${subject}\n\n${booking.title}\nScholar: ${scholar.name} (${scholar.registration_id})\nDate: ${booking.date}\nTime: ${booking.time} IST\nVenue: ${booking.venue}\nStatus: ${kind}\n\nResearch Office | Independent demonstration application.`;
  const emails = new Set();
  for (const r of recipients) {
    db.prepare(
      "INSERT INTO notifications(id,booking_id,recipient_id,kind,subject,body) VALUES (?,?,?,?,?,?)",
    ).run(randomUUID(), booking.id, r.id, kind, subject, body);
    emails.add(r.email.toLowerCase());
  }
  if (kind === "cancelled") {
    emails.clear();
    for (const row of db
      .prepare(
        "SELECT recipient FROM mail_outbox WHERE booking_id=? AND kind='approved'",
      )
      .all(booking.id))
      emails.add(row.recipient);
  } else emails.add(scholar.email.toLowerCase());
  for (const email of emails)
    db.prepare(
      "INSERT INTO mail_outbox(id,booking_id,recipient,kind,subject,body) VALUES (?,?,?,?,?,?)",
    ).run(randomUUID(), booking.id, email, kind, subject, body);
}
export function createBooking(db, user, data) {
  assertRoles(user, "supervisor");
  try {
    return transaction(db, () => {
      const scholar = db
        .prepare(
          "SELECT * FROM scholars WHERE id=? AND supervisor_id=? AND department_id=?",
        )
        .get(data.scholar_id, user.id, user.department_id);
      if (!scholar) fail(403, "Choose a scholar mapped to you.");
      if (data.date <= today()) fail(422, "Choose a future date in IST.");
      const available = db
        .prepare(
          "SELECT enabled FROM available_dates WHERE department_id=? AND date=?",
        )
        .get(user.department_id, data.date);
      if (!available?.enabled)
        fail(409, "The coordinator has not enabled this date.");
      for (const id of data.panel_ids) {
        if (
          !db
            .prepare(
              "SELECT 1 FROM users WHERE id=? AND department_id=? AND role='panel' AND active=1",
            )
            .get(id, user.department_id)
        )
          fail(422, "Choose active panel members from your department.");
      }
      const id = randomUUID();
      db.prepare(
        `INSERT INTO bookings(id,department_id,scholar_id,supervisor_id,date,time,venue,title,abstract,status) VALUES (?,?,?,?,?,?,?,?,?,'pending_coordinator')`,
      ).run(
        id,
        user.department_id,
        data.scholar_id,
        user.id,
        data.date,
        data.time,
        data.venue,
        data.title,
        data.abstract,
      );
      for (const pid of new Set(data.panel_ids))
        db.prepare("INSERT INTO booking_panel VALUES (?,?)").run(id, pid);
      history(
        db,
        id,
        user,
        "submitted",
        "Day reserved; awaiting coordinator review.",
      );
      audit(db, user, "booking_created", { id });
      return { id };
    });
  } catch (e) {
    if (String(e.message).includes("UNIQUE constraint failed: bookings"))
      fail(
        409,
        "This date or scholar already has an active pre-talk. Refresh and choose another date.",
      );
    throw e;
  }
}
export function transition(db, user, id, { action, note, version }) {
  return transaction(db, () => {
    const b = getBooking(db, user, id);
    if (b.version !== version)
      fail(409, "This request has changed. Refresh before reviewing it.");
    if (!live(b.status)) fail(409, "This pre-talk is already closed.");
    let status;
    if (action === "cancel") {
      if (!(
        isManager(user) ||
        (user.role === "supervisor" &&
          b.supervisor_id === user.id &&
          b.status !== "approved")
      ))
        fail(403, "Only the coordinator can cancel a confirmed pre-talk.");
      if (b.date < today()) fail(409, "Past pre-talks cannot be cancelled.");
      status = "cancelled";
    } else {
      if (b.date <= today())
        fail(
          409,
          "Past or current-day requests cannot be approved or rejected. Cancel and rebook if needed.",
        );
      const coordinatorStep =
        b.status === "pending_coordinator" && isManager(user);
      const hodStep = b.status === "pending_hod" && user.role === "hod";
      if (!coordinatorStep && !hodStep)
        fail(403, "This approval step belongs to a different role.");
      status =
        action === "reject"
          ? "rejected"
          : coordinatorStep
            ? "pending_hod"
            : "approved";
    }
    if (["cancel", "reject"].includes(action) && note.trim().length < 5)
      fail(422, "Provide a reason of at least 5 characters.");
    db.prepare(
      "UPDATE bookings SET status=?,version=version+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",
    ).run(status, id);
    history(db, id, user, status, note);
    audit(db, user, `booking_${status}`, { id, previous: b.status });
    if (
      status === "approved" ||
      (status === "cancelled" && b.status === "approved")
    )
      queueNotifications(db, b, status);
    return { id, status };
  });
}
