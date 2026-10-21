import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.js";
import { processOutbox } from "../server/mailer.js";
test("demo capture stores messages durably without claiming delivery", async () => {
  const { db } = await fixture();
  try {
    const n = await processOutbox(db, { mode: "capture" });
    assert.equal(n, 7);
    assert.equal(
      db
        .prepare("SELECT count(*) n FROM mail_outbox WHERE state='captured'")
        .get().n,
      7,
    );
    assert.equal(await processOutbox(db, { mode: "capture" }), 0);
  } finally {
    db.close();
  }
});
test("SMTP failure retains a retry and next worker recovers expired lease", async () => {
  const { db } = await fixture();
  try {
    const transport = {
      sendMail: async () => {
        throw new Error("provider unavailable");
      },
    };
    await processOutbox(db, { mode: "smtp", transport });
    assert.equal(
      db
        .prepare(
          "SELECT count(*) n FROM mail_outbox WHERE state='pending' AND attempts=1 AND last_error IS NOT NULL",
        )
        .get().n,
      7,
    );
    db.prepare("UPDATE mail_outbox SET state='sending',lease_until=0").run();
    const sent = [];
    await processOutbox(db, {
      mode: "smtp",
      transport: { sendMail: async (m) => sent.push(m) },
    });
    assert.equal(sent.length, 7);
    assert.ok(
      sent.every((m) => m.messageId.endsWith("@research-office.invalid>")),
    );
    assert.equal(
      db.prepare("SELECT count(*) n FROM mail_outbox WHERE state='sent'").get()
        .n,
      7,
    );
  } finally {
    db.close();
  }
});
