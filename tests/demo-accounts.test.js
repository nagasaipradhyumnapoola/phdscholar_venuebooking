import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, login, call } from "./helpers.js";
import {
  addDemoAccounts,
  sampleAccounts,
  credentialsTable,
} from "../server/demo-accounts.js";
import { hashPassword } from "../server/security.js";

test("31 sample accounts authenticate in the correct department and role, with mapped scholars and assigned panels", async () => {
  const { db, app } = await fixture();
  try {
    assert.deepEqual(await addDemoAccounts(db), {
      users: 20,
      scholars: 7,
      bookings: 4,
    });
    const accounts = sampleAccounts(db);
    assert.equal(accounts.length, 31);
    for (const departmentCode of ["CSE", "ECE"]) {
      for (const role of [
        "admin",
        "coordinator",
        "supervisor",
        "hod",
        "panel",
        "scholar",
      ]) {
        assert.ok(
          accounts.filter(
            (a) => a.departmentCode === departmentCode && a.role === role,
          ).length >= 2,
          `${departmentCode}/${role}`,
        );
      }
    }
    for (const account of accounts) {
      const session = await login(app, account.email.split("@")[0]);
      const boot = await call(app, session, "get", "/api/bootstrap");
      assert.equal(boot.status, 200, account.email);
      assert.equal(boot.body.user.role, account.role);
      assert.equal(boot.body.department.id, account.department_id);
      assert.ok(
        boot.body.bookings.every(
          (b) => b.department_id === account.department_id,
        ),
      );
      if (account.role === "scholar") {
        assert.ok(
          boot.body.scholars.some((s) => s.user_id === account.id),
          account.email,
        );
        assert.ok(boot.body.bookings.length > 0, account.email);
      }
      if (account.role === "panel")
        assert.ok(boot.body.bookings.length > 0, account.email);
      const logout = await call(app, session, "post", "/api/logout", {});
      assert.equal(logout.status, 200);
    }
    assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
    assert.equal(
      db
        .prepare(
          "SELECT count(DISTINCT password_hash) n FROM users WHERE faculty_id LIKE 'DEMO-CSE-%' OR faculty_id LIKE 'DEMO-ECE-%'",
        )
        .get().n,
      20,
    );
  } finally {
    db.close();
  }
});

test("the additive sample pack is idempotent and never resets passwords, disabled accounts, or request history", async () => {
  const { db } = await fixture();
  try {
    await addDemoAccounts(db);
    const hash = await hashPassword("ChangedForTest!2026");
    db.prepare(
      "UPDATE users SET password_hash=?,active=0 WHERE email='admin2@demo.example'",
    ).run(hash);
    const before = db.prepare("SELECT count(*) n FROM history").get().n;
    assert.deepEqual(await addDemoAccounts(db), {
      users: 0,
      scholars: 0,
      bookings: 0,
    });
    assert.equal(sampleAccounts(db).length, 31);
    const changed = db
      .prepare(
        "SELECT password_hash,active FROM users WHERE email='admin2@demo.example'",
      )
      .get();
    assert.equal(changed.password_hash, hash);
    assert.equal(changed.active, 0);
    assert.equal(db.prepare("SELECT count(*) n FROM history").get().n, before);
    const table = await credentialsTable(db);
    assert.match(
      table,
      /admin2@demo\.example \| Changed; not exported \| Disabled/,
    );
    assert.equal(
      table.split("\n").filter((line) => /^\| (CSE|ECE) \|/.test(line)).length,
      31,
    );
    assert.ok(
      !table.includes("scrypt$") && !table.includes("ChangedForTest!2026"),
    );
  } finally {
    db.close();
  }
});

test("new ECE accounts follow coordinator then HOD review, protect department scope, and prevent repeat final decisions", async () => {
  const { db, app } = await fixture();
  try {
    await addDemoAccounts(db);
    const co = await login(app, "ece-coordinator2");
    const hod1 = await login(app, "ece-hod1");
    const hod2 = await login(app, "ece-hod2");
    const cse = await login(app, "admin2");
    const booking = db
      .prepare(
        "SELECT b.* FROM bookings b JOIN scholars s ON s.id=b.scholar_id WHERE s.registration_id='DEMO-ECE-PHD-101'",
      )
      .get();
    assert.equal(
      (await call(app, cse, "get", `/api/bookings/${booking.id}`)).status,
      404,
    );
    assert.equal(
      (
        await call(app, hod1, "post", `/api/bookings/${booking.id}/action`, {
          action: "approve",
          version: 1,
          note: "Attempt final review before coordinator.",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await call(app, co, "post", `/api/bookings/${booking.id}/action`, {
          action: "approve",
          version: 1,
          note: "Sample supervisor mapping and schedule checked.",
        })
      ).body.status,
      "pending_hod",
    );
    assert.equal(
      db
        .prepare("SELECT count(*) n FROM notifications WHERE booking_id=?")
        .get(booking.id).n,
      0,
    );
    assert.equal(
      (
        await call(app, hod1, "post", `/api/bookings/${booking.id}/action`, {
          action: "approve",
          version: 2,
          note: "Final review completed.",
        })
      ).body.status,
      "approved",
    );
    const recipients = db
      .prepare("SELECT count(*) n FROM notifications WHERE booking_id=?")
      .get(booking.id).n;
    assert.equal(recipients, 6);
    assert.equal(
      (
        await call(app, hod2, "post", `/api/bookings/${booking.id}/action`, {
          action: "approve",
          version: 2,
          note: "Stale second decision.",
        })
      ).status,
      409,
    );
    assert.equal(
      db
        .prepare("SELECT count(*) n FROM notifications WHERE booking_id=?")
        .get(booking.id).n,
      recipients,
    );
    assert.equal(
      db
        .prepare("SELECT count(*) n FROM mail_outbox WHERE booking_id=?")
        .get(booking.id).n,
      recipients,
    );
  } finally {
    db.close();
  }
});

test("production and conflicting account identities stop sample provisioning without overwriting users", async () => {
  const { db } = await fixture();
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    await assert.rejects(addDemoAccounts(db), /disabled in production/);
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
    db.prepare(
      "UPDATE users SET email='admin2@demo.example' WHERE email='panel4@demo.example'",
    ).run();
    await assert.rejects(
      addDemoAccounts(db),
      /conflicts with the sample identity/,
    );
    assert.equal(db.prepare("SELECT count(*) n FROM users").get().n, 11);
    assert.equal(
      db
        .prepare("SELECT role FROM users WHERE email='admin2@demo.example'")
        .get().role,
      "panel",
    );
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
    db.close();
  }
});
