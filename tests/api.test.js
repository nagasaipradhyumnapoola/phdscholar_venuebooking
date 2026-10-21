import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { fixture, login, call, freshBooking, ORIGIN } from "./helpers.js";
import { dayAfter, DEMO_PASSWORD } from "../server/seed-data.js";
import { hashPassword } from "../server/security.js";
import { createApp } from "../server/app.js";
let db, app;
beforeEach(async () => ({ db, app } = await fixture()));
afterEach(() => db.close());
test("email login normalizes case, uses hashed passwords, and issues protected opaque session", async () => {
  const r = await request(app)
    .post("/api/login")
    .set("Origin", ORIGIN)
    .send({ email: "SUPERVISOR@DEMO.EXAMPLE", password: DEMO_PASSWORD });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.role, "supervisor");
  assert.ok(!JSON.stringify(r.body).includes("password_hash"));
  assert.match(r.headers["set-cookie"][0], /HttpOnly/);
  assert.match(r.headers["set-cookie"][0], /SameSite=Strict/);
  const row = db.prepare("SELECT * FROM sessions LIMIT 1").get();
  assert.ok(!r.headers["set-cookie"][0].includes(row.token_hash));
  assert.match(
    db.prepare("SELECT password_hash FROM users LIMIT 1").get().password_hash,
    /^scrypt\$/,
  );
  const bad = await request(app)
    .post("/api/login")
    .set("Origin", ORIGIN)
    .send({ email: "supervisor@demo.example", password: "wrong" });
  assert.equal(bad.status, 401);
});
test("authentication, origin and CSRF are enforced on the server", async () => {
  assert.equal((await request(app).get("/api/bootstrap")).status, 401);
  const co = await login(app);
  const path = "/api/dates/" + dayAfter(16);
  assert.equal(
    (
      await request(app)
        .put(path)
        .set("Origin", ORIGIN)
        .set("Cookie", co.cookie)
        .send({ enabled: true })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(app)
        .put(path)
        .set("Origin", "https://attacker.invalid")
        .set("Cookie", co.cookie)
        .set("x-csrf-token", co.csrf)
        .send({ enabled: true })
    ).status,
    403,
  );
  assert.equal(
    (await call(app, co, "put", path, { enabled: true })).status,
    200,
  );
  const r = await request(app).get("/");
  assert.match(r.headers["content-security-policy"], /script-src 'self'/);
  assert.ok(!r.headers["x-powered-by"]);
});
test("role escalation and unauthorized date or user management are rejected", async () => {
  const sup = await login(app, "supervisor");
  assert.equal(
    (
      await call(app, sup, "put", "/api/dates/" + dayAfter(16), {
        enabled: true,
      })
    ).status,
    403,
  );
  assert.equal(
    (await call(app, sup, "post", "/api/users", { name: "Fake Admin" })).status,
    403,
  );
  const co = await login(app);
  assert.equal(
    (
      await call(app, co, "post", "/api/users", {
        name: "Fake Admin",
        email: "fake@demo.example",
        faculty_id: "FAKE-1",
        role: "admin",
        password: "ValidOnly!2026",
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await call(app, co, "post", "/api/users", {
        name: "Extra Coordinator",
        email: "extra@demo.example",
        faculty_id: "FAKE-2",
        role: "coordinator",
        password: "ValidOnly!2026",
      })
    ).status,
    403,
  );
});
test("supervisors can book only mapped scholars and enabled future dates", async () => {
  const sup = await login(app, "supervisor"),
    payload = freshBooking(db);
  const foreign = db
    .prepare(
      "SELECT id FROM scholars WHERE supervisor_id=(SELECT id FROM users WHERE email='supervisor2@demo.example')",
    )
    .get();
  assert.equal(
    (
      await call(app, sup, "post", "/api/bookings", {
        ...payload,
        scholar_id: foreign.id,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call(app, sup, "post", "/api/bookings", {
        ...payload,
        date: dayAfter(6),
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call(app, sup, "post", "/api/bookings", {
        ...payload,
        date: dayAfter(-1),
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await call(app, sup, "post", "/api/bookings", {
        ...payload,
        time: "25:61",
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await call(app, sup, "post", "/api/bookings", {
        ...payload,
        role: "admin",
      })
    ).status,
    422,
  );
  assert.equal(
    (await call(app, sup, "post", "/api/bookings", payload)).status,
    201,
  );
});
test("HOD cannot skip coordinator; supervisor cannot approve; final approval notifies once", async () => {
  const sup = await login(app, "supervisor"),
    co = await login(app),
    hod = await login(app, "hod");
  const before = db.prepare("SELECT count(*) n FROM mail_outbox").get().n;
  const r = await call(app, sup, "post", "/api/bookings", freshBooking(db));
  const id = r.body.id;
  const action = { action: "approve", version: 1 };
  assert.equal(
    (await call(app, hod, "post", `/api/bookings/${id}/action`, action)).status,
    403,
  );
  assert.equal(
    (await call(app, sup, "post", `/api/bookings/${id}/action`, action)).status,
    403,
  );
  assert.equal(
    (await call(app, co, "post", `/api/bookings/${id}/action`, action)).body
      .status,
    "pending_hod",
  );
  assert.equal(
    db.prepare("SELECT count(*) n FROM mail_outbox").get().n,
    before,
  );
  assert.equal(
    (
      await call(app, co, "post", `/api/bookings/${id}/action`, {
        ...action,
        version: 2,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call(app, hod, "post", `/api/bookings/${id}/action`, {
        ...action,
        version: 2,
      })
    ).body.status,
    "approved",
  );
  const mails = db
    .prepare("SELECT * FROM mail_outbox WHERE booking_id=?")
    .all(id);
  assert.equal(mails.length, 7);
  assert.ok(mails.some((m) => m.recipient === "aditya@demo.example"));
  assert.ok(mails.some((m) => m.recipient === "hod@demo.example"));
  assert.equal(
    (
      await call(app, hod, "post", `/api/bookings/${id}/action`, {
        ...action,
        version: 2,
      })
    ).status,
    409,
  );
  assert.equal(
    db.prepare("SELECT count(*) n FROM mail_outbox WHERE booking_id=?").get(id)
      .n,
    7,
  );
  const detail = await call(app, sup, "get", `/api/bookings/${id}`);
  assert.deepEqual(
    detail.body.history.map((h) => h.action),
    ["submitted", "pending_hod", "approved"],
  );
});
test("rejection needs reason, releases department day and keeps immutable history", async () => {
  const sup = await login(app, "supervisor"),
    co = await login(app);
  const payload = freshBooking(db);
  const r = await call(app, sup, "post", "/api/bookings", payload);
  const path = `/api/bookings/${r.body.id}/action`;
  assert.equal(
    (
      await call(app, co, "post", path, {
        action: "reject",
        version: 1,
        note: "no",
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await call(app, co, "post", path, {
        action: "reject",
        version: 1,
        note: "Please revise the abstract.",
      })
    ).body.status,
    "rejected",
  );
  const again = await call(app, sup, "post", "/api/bookings", payload);
  assert.equal(again.status, 201);
  assert.notEqual(again.body.id, r.body.id);
  assert.equal(
    db
      .prepare("SELECT count(*) n FROM history WHERE booking_id=?")
      .get(r.body.id).n,
    2,
  );
  assert.equal(
    db
      .prepare("SELECT count(*) n FROM mail_outbox WHERE booking_id=?")
      .get(r.body.id).n,
    0,
  );
});
test("stale reviews fail and HOD rejection releases day without final email", async () => {
  const sup = await login(app, "supervisor"),
    co = await login(app),
    hod = await login(app, "hod");
  const r = await call(app, sup, "post", "/api/bookings", freshBooking(db));
  const path = `/api/bookings/${r.body.id}/action`;
  await call(app, co, "post", path, { action: "approve", version: 1 });
  assert.equal(
    (
      await call(app, hod, "post", path, {
        action: "reject",
        version: 1,
        note: "Please revise scope.",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call(app, hod, "post", path, {
        action: "reject",
        version: 2,
        note: "Please revise scope.",
      })
    ).body.status,
    "rejected",
  );
  assert.equal(
    db
      .prepare("SELECT count(*) n FROM mail_outbox WHERE booking_id=?")
      .get(r.body.id).n,
    0,
  );
});
test("supervisor can withdraw pending; only coordinator can cancel confirmed and queue updates", async () => {
  const sup = await login(app, "supervisor"),
    sup2 = await login(app, "supervisor2"),
    co = await login(app);
  const pending = db
    .prepare("SELECT * FROM bookings WHERE status='pending_coordinator'")
    .get();
  assert.equal(
    (
      await call(app, sup, "post", `/api/bookings/${pending.id}/action`, {
        action: "cancel",
        version: 1,
        note: "Need a revised date.",
      })
    ).body.status,
    "cancelled",
  );
  const approved = db
    .prepare("SELECT * FROM bookings WHERE status='approved'")
    .get();
  assert.equal(
    (
      await call(app, sup2, "post", `/api/bookings/${approved.id}/action`, {
        action: "cancel",
        version: 1,
        note: "Need a revised date.",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call(app, co, "post", `/api/bookings/${approved.id}/action`, {
        action: "cancel",
        version: 1,
        note: "Panel requested a revised date.",
      })
    ).body.status,
    "cancelled",
  );
  assert.equal(
    db
      .prepare(
        "SELECT count(*) n FROM mail_outbox WHERE booking_id=? AND kind='cancelled'",
      )
      .get(approved.id).n,
    7,
  );
});
test("panel, scholar, other supervisor and other department cannot access unassigned requests", async () => {
  const sup = await login(app, "supervisor"),
    other = await login(app, "supervisor2"),
    cross = await login(app, "other-supervisor"),
    panel = await login(app, "panel"),
    scholar = await login(app, "scholar");
  const payload = freshBooking(db);
  payload.panel_ids = [
    db.prepare("SELECT id FROM users WHERE email='panel2@demo.example'").get()
      .id,
  ];
  const r = await call(app, sup, "post", "/api/bookings", payload),
    path = "/api/bookings/" + r.body.id;
  for (const s of [other, cross, panel, scholar])
    assert.equal((await call(app, s, "get", path)).status, 404);
  assert.equal(
    (
      await call(app, panel, "post", path + "/action", {
        action: "approve",
        version: 1,
      })
    ).status,
    404,
  );
  const b = await call(app, cross, "get", "/api/bootstrap");
  assert.equal(b.body.bookings.length, 0);
  assert.equal(b.body.scholars.length, 0);
  const b2 = await call(app, other, "get", "/api/bootstrap");
  const booked = b2.body.dates.find((d) => d.date === payload.date);
  assert.equal(booked.reserved, true);
  assert.equal(booked.booking_id, undefined);
});
test("active day cannot be disabled; scholar cannot be remapped while active", async () => {
  const co = await login(app);
  const pending = db
    .prepare("SELECT * FROM bookings WHERE status='pending_coordinator'")
    .get();
  assert.equal(
    (
      await call(app, co, "put", "/api/dates/" + pending.date, {
        enabled: false,
      })
    ).status,
    409,
  );
  const sup2 = db
    .prepare("SELECT id FROM users WHERE email='supervisor2@demo.example'")
    .get();
  assert.equal(
    (
      await call(app, co, "patch", "/api/scholars/" + pending.scholar_id, {
        supervisor_id: sup2.id,
      })
    ).status,
    409,
  );
  const fresh = freshBooking(db);
  assert.equal(
    (
      await call(app, co, "patch", "/api/scholars/" + fresh.scholar_id, {
        supervisor_id: sup2.id,
      })
    ).status,
    200,
  );
});
test("coordinator provisions faculty and scholar mappings; disabled sessions are revoked", async () => {
  const co = await login(app);
  const r = await call(app, co, "post", "/api/users", {
    name: "Fictional Faculty",
    email: "new@demo.example",
    faculty_id: "DEMO-NEW",
    role: "supervisor",
    password: DEMO_PASSWORD,
  });
  assert.equal(r.status, 201);
  const raw = await request(app)
    .post("/api/login")
    .set("Origin", ORIGIN)
    .send({ email: "new@demo.example", password: DEMO_PASSWORD });
  const s = {
    cookie: raw.headers["set-cookie"][0].split(";")[0],
    csrf: raw.body.csrf,
  };
  assert.equal(
    (
      await call(app, co, "post", "/api/scholars", {
        name: "Fictional Scholar",
        email: "new-scholar@demo.example",
        registration_id: "DEMO-NEW-S",
        supervisor_id: r.body.id,
      })
    ).status,
    201,
  );
  assert.equal(
    (await call(app, co, "patch", "/api/users/" + r.body.id, { active: false }))
      .status,
    200,
  );
  assert.equal((await call(app, s, "get", "/api/me")).status, 401);
  assert.equal((await call(app, co, "post", "/api/logout", {})).status, 200);
  assert.equal((await call(app, co, "get", "/api/me")).status, 401);
});
test("expired sessions, invalid identifiers, malformed input and duplicate records fail safely", async () => {
  const co = await login(app);
  assert.equal(
    (await call(app, co, "get", "/api/bookings/not-an-id")).status,
    422,
  );
  assert.equal(
    (await call(app, co, "put", "/api/dates/2026-02-30", { enabled: true }))
      .status,
    422,
  );
  assert.equal(
    (
      await call(app, co, "post", "/api/users", {
        name: "Duplicate User",
        email: "panel@demo.example",
        faculty_id: "DEMO-DUP",
        role: "panel",
        password: DEMO_PASSWORD,
      })
    ).status,
    409,
  );
  db.prepare("UPDATE sessions SET expires_at=0").run();
  assert.equal((await call(app, co, "get", "/api/me")).status, 401);
});
test("persistent email and IP sign-in limits prevent repeated attempts", async () => {
  for (let n = 0; n < 10; n++) {
    const r = await request(app)
      .post("/api/login")
      .set("Origin", ORIGIN)
      .send({ email: "nonexistent@demo.example", password: "bad" });
    assert.equal(r.status, 401);
  }
  const r = await request(app)
    .post("/api/login")
    .set("Origin", ORIGIN)
    .send({ email: "nonexistent@demo.example", password: "bad" });
  assert.equal(r.status, 429);
});
test("production startup rejects demo accounts and insecure origin", async () => {
  await assert.rejects(
    createApp(db, { production: true, origin: ORIGIN }),
    /HTTPS/,
  );
  await assert.rejects(
    createApp(db, { production: true, origin: "https://example.invalid" }),
    /demo accounts/,
  );
});
test("one active request per scholar holds across different dates; bad panels leave no orphan rows", async () => {
  const sup = await login(app, "supervisor"),
    payload = freshBooking(db);
  const before = db.prepare("SELECT count(*) n FROM bookings").get().n;
  const foreign = db
    .prepare("SELECT id FROM users WHERE email='other-supervisor@demo.example'")
    .get();
  assert.equal(
    (
      await call(app, sup, "post", "/api/bookings", {
        ...payload,
        panel_ids: [foreign.id],
      })
    ).status,
    422,
  );
  assert.equal(db.prepare("SELECT count(*) n FROM bookings").get().n, before);
  assert.equal(
    (await call(app, sup, "post", "/api/bookings", payload)).status,
    201,
  );
  const co = await login(app);
  await call(app, co, "put", "/api/dates/" + dayAfter(16), { enabled: true });
  assert.equal(
    (
      await call(app, sup, "post", "/api/bookings", {
        ...payload,
        date: dayAfter(16),
      })
    ).status,
    409,
  );
});
test("different departments can reserve the same date independently", async () => {
  const sup = await login(app, "supervisor"),
    other = await login(app, "other-supervisor");
  const payload = freshBooking(db);
  const { randomUUID } = await import("node:crypto");
  const sid = randomUUID(),
    pid = randomUUID();
  db.prepare(
    "INSERT INTO scholars(id,department_id,name,registration_id,email,supervisor_id) VALUES (?,?,?,?,?,?)",
  ).run(
    sid,
    other.user.department_id,
    "Fictional ECE Scholar",
    "DEMO-ECE-S",
    "ece@demo.example",
    other.user.id,
  );
  db.prepare(
    "INSERT INTO users(id,department_id,name,email,faculty_id,role,password_hash) VALUES (?,?,?,?,?,?,?)",
  ).run(
    pid,
    other.user.department_id,
    "Fictional ECE Panel",
    "ece-panel@demo.example",
    "DEMO-ECE-P",
    "panel",
    await hashPassword(DEMO_PASSWORD),
  );
  assert.equal(
    (await call(app, sup, "post", "/api/bookings", payload)).status,
    201,
  );
  assert.equal(
    (
      await call(app, other, "post", "/api/bookings", {
        ...payload,
        scholar_id: sid,
        panel_ids: [pid],
      })
    ).status,
    201,
  );
  assert.equal(
    db
      .prepare(
        "SELECT count(*) n FROM bookings WHERE date=? AND status='pending_coordinator'",
      )
      .get(payload.date).n,
    2,
  );
});
test("notification reads and email outbox are recipient-scoped, with department manager inspection", async () => {
  const panel = await login(app, "panel"),
    supervisor = await login(app, "supervisor"),
    co = await login(app),
    cross = await login(app, "other-supervisor");
  const mine = await call(app, panel, "get", "/api/outbox");
  assert.ok(mine.body.length > 0);
  assert.ok(mine.body.every((n) => n.recipient === "panel@demo.example"));
  assert.equal((await call(app, cross, "get", "/api/outbox")).body.length, 0);
  assert.equal((await call(app, co, "get", "/api/outbox")).body.length, 7);
  assert.equal((await call(app, supervisor, "get", "/api/audit")).status, 403);
  const before = db
    .prepare(
      "SELECT count(*) n FROM notifications WHERE recipient_id!=? AND read_at IS NULL",
    )
    .get(panel.user.id).n;
  await call(app, panel, "post", "/api/notifications/read", {});
  assert.equal(
    db
      .prepare(
        "SELECT count(*) n FROM notifications WHERE recipient_id=? AND read_at IS NULL",
      )
      .get(panel.user.id).n,
    0,
  );
  assert.equal(
    db
      .prepare(
        "SELECT count(*) n FROM notifications WHERE recipient_id!=? AND read_at IS NULL",
      )
      .get(panel.user.id).n,
    before,
  );
});
