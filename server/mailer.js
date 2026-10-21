import nodemailer from "nodemailer";
import { transaction } from "./db.js";
export async function processOutbox(
  db,
  { mode = process.env.MAIL_MODE || "capture", transport } = {},
) {
  if (!["capture", "smtp"].includes(mode))
    throw new Error("MAIL_MODE must be capture or smtp");
  if (mode === "smtp" && !transport) {
    if (!process.env.SMTP_HOST || !process.env.MAIL_FROM)
      throw new Error("SMTP_HOST and MAIL_FROM are required.");
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      requireTLS: process.env.SMTP_SECURE !== "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
      connectionTimeout: 10000,
      socketTimeout: 20000,
    });
  }
  let count = 0;
  for (let i = 0; i < 50; i++) {
    const row = transaction(db, () => {
      const now = Date.now();
      const r = db
        .prepare(
          "SELECT * FROM mail_outbox WHERE (state='pending' AND available_at<=?) OR (state='sending' AND lease_until<?) ORDER BY rowid LIMIT 1",
        )
        .get(now, now);
      if (r)
        db.prepare(
          "UPDATE mail_outbox SET state='sending',attempts=attempts+1,lease_until=? WHERE id=?",
        ).run(now + 60000, r.id);
      return r;
    });
    if (!row) break;
    try {
      if (mode === "smtp")
        await transport.sendMail({
          from: process.env.MAIL_FROM,
          to: row.recipient,
          subject: row.subject,
          text: row.body,
          messageId: `<${row.id}@research-office.invalid>`,
        });
      db.prepare(
        "UPDATE mail_outbox SET state=?,sent_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),last_error=NULL WHERE id=?",
      ).run(mode === "capture" ? "captured" : "sent", row.id);
      count++;
    } catch {
      db.prepare(
        "UPDATE mail_outbox SET state='pending',available_at=?,last_error='Delivery failed; queued for retry' WHERE id=?",
      ).run(
        Date.now() + Math.min(3600000, 30000 * 2 ** Math.min(row.attempts, 7)),
        row.id,
      );
    }
  }
  return count;
}
