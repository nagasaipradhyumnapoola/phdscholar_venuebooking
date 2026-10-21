import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, login, call, freshBooking } from "./helpers.js";
import { dayAfter, DEMO_PASSWORD } from "../server/seed-data.js";
for (const role of [
  "admin",
  "coordinator",
  "supervisor",
  "hod",
  "panel",
  "scholar",
])
  test(`${role}: API permission matrix and data scope`, async () => {
    const { db, app } = await fixture();
    try {
      const session = await login(app, role),
        manager = ["admin", "coordinator"].includes(role);
      for (const path of ["/api/me", "/api/bootstrap", "/api/outbox"])
        assert.equal(
          (await call(app, session, "get", path)).status,
          200,
          `${role} ${path}`,
        );
      assert.equal(
        (await call(app, session, "get", "/api/audit")).status,
        manager ? 200 : 403,
      );
      assert.equal(
        (
          await call(app, session, "put", "/api/dates/" + dayAfter(17), {
            enabled: true,
            note: "Role test",
          })
        ).status,
        manager ? 200 : 403,
      );
      const supervisor = db
        .prepare("SELECT id FROM users WHERE email='supervisor@demo.example'")
        .get();
      assert.equal(
        (
          await call(app, session, "post", "/api/scholars", {
            name: "Permission Test Scholar",
            registration_id: "DEMO-PERMISSION",
            email: "permission@demo.example",
            supervisor_id: supervisor.id,
          })
        ).status,
        manager ? 201 : 403,
      );
      assert.equal(
        (
          await call(app, session, "post", "/api/users", {
            name: "Permission Test Panel",
            email: "permission-panel@demo.example",
            faculty_id: "DEMO-PERMISSION-F",
            role: "panel",
            password: DEMO_PASSWORD,
          })
        ).status,
        manager ? 201 : 403,
      );
      assert.equal(
        (await call(app, session, "post", "/api/bookings", freshBooking(db)))
          .status,
        role === "supervisor" ? 201 : 403,
      );
      const boot = (await call(app, session, "get", "/api/bootstrap")).body;
      if (role === "supervisor")
        assert.ok(
          boot.bookings.every((b) => b.supervisor_id === session.user.id),
        );
      if (role === "scholar")
        assert.ok(
          boot.bookings.every(
            (b) =>
              db
                .prepare("SELECT user_id FROM scholars WHERE id=?")
                .get(b.scholar_id).user_id === session.user.id,
          ),
        );
      if (role === "panel")
        assert.ok(
          boot.bookings.every((b) =>
            db
              .prepare(
                "SELECT 1 FROM booking_panel WHERE booking_id=? AND user_id=?",
              )
              .get(b.id, session.user.id),
          ),
        );
      for (const b of boot.bookings)
        assert.equal(b.department_id, session.user.department_id);
    } finally {
      db.close();
    }
  });
test("final approval and outbox fail atomically, and a safe retry succeeds", async () => {
  const { db, app } = await fixture();
  try {
    const hod = await login(app, "hod");
    const b = db
      .prepare("SELECT * FROM bookings WHERE status='pending_hod'")
      .get();
    db.exec(
      `CREATE TRIGGER test_mail_failure BEFORE INSERT ON mail_outbox WHEN NEW.booking_id='${b.id}' BEGIN SELECT RAISE(ABORT,'Test delivery storage failure'); END;`,
    );
    assert.equal(
      (
        await call(app, hod, "post", `/api/bookings/${b.id}/action`, {
          action: "approve",
          version: b.version,
        })
      ).status,
      500,
    );
    assert.equal(
      db.prepare("SELECT status FROM bookings WHERE id=?").get(b.id).status,
      "pending_hod",
    );
    assert.equal(
      db.prepare("SELECT count(*) n FROM history WHERE booking_id=?").get(b.id)
        .n,
      2,
    );
    assert.equal(
      db
        .prepare("SELECT count(*) n FROM notifications WHERE booking_id=?")
        .get(b.id).n,
      0,
    );
    db.exec("DROP TRIGGER test_mail_failure");
    assert.equal(
      (
        await call(app, hod, "post", `/api/bookings/${b.id}/action`, {
          action: "approve",
          version: b.version,
        })
      ).status,
      200,
    );
    assert.equal(
      db
        .prepare("SELECT count(*) n FROM mail_outbox WHERE booking_id=?")
        .get(b.id).n,
      7,
    );
  } finally {
    db.close();
  }
});
test("cancellation uses the original recipient snapshot after faculty membership changes", async () => {
  const { db, app } = await fixture();
  try {
    const co = await login(app);
    const b = db
      .prepare("SELECT * FROM bookings WHERE status='approved'")
      .get();
    const original = db
      .prepare(
        "SELECT recipient FROM mail_outbox WHERE booking_id=? AND kind='approved' ORDER BY recipient",
      )
      .all(b.id)
      .map((r) => r.recipient);
    await call(app, co, "post", "/api/users", {
      name: "New HOD after approval",
      email: "new-hod@demo.example",
      faculty_id: "DEMO-NEW-HOD",
      role: "hod",
      password: DEMO_PASSWORD,
    });
    assert.equal(
      (
        await call(app, co, "post", `/api/bookings/${b.id}/action`, {
          action: "cancel",
          version: b.version,
          note: "Original panel requested another date.",
        })
      ).status,
      200,
    );
    assert.deepEqual(
      db
        .prepare(
          "SELECT recipient FROM mail_outbox WHERE booking_id=? AND kind='cancelled' ORDER BY recipient",
        )
        .all(b.id)
        .map((r) => r.recipient),
      original,
    );
    assert.equal(
      db
        .prepare(
          "SELECT count(*) n FROM notifications n JOIN users u ON u.id=n.recipient_id WHERE n.booking_id=? AND n.kind='cancelled' AND u.email='new-hod@demo.example'",
        )
        .get(b.id).n,
      0,
    );
  } finally {
    db.close();
  }
});
