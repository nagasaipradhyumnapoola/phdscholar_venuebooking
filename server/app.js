import express from "express";
import compression from "compression";
import { readFileSync } from "node:fs";
import helmet from "helmet";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { root, transaction } from "./db.js";
import { currentYear } from "../public/site.js";
import {
  hashPassword,
  verifyPassword,
  publicUser,
  token,
  digest,
} from "./security.js";
import {
  HttpError,
  fail,
  today,
  isManager,
  canRead,
  getBooking,
  assertRoles,
  audit,
  createBooking,
  transition,
} from "./domain.js";

const text = (min, max) => z.string().trim().min(min).max(max);
const email = z
  .email()
  .max(254)
  .transform((e) => e.toLowerCase());
const id = z.uuid();
const date = z.iso.date();
const bookingSchema = z.strictObject({
  scholar_id: id,
  date,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  venue: text(3, 160),
  title: text(10, 240),
  abstract: text(0, 3000).default(""),
  panel_ids: z
    .array(id)
    .min(1)
    .max(10)
    .refine((v) => new Set(v).size === v.length),
});
const actionSchema = z.strictObject({
  action: z.enum(["approve", "reject", "cancel"]),
  note: text(0, 1500).default(""),
  version: z.number().int().positive(),
});
const cookieName = "research_session";

export async function createApp(
  db,
  {
    origin = process.env.APP_ORIGIN || "http://127.0.0.1:4173",
    production = process.env.NODE_ENV === "production",
  } = {},
) {
  if (production && !origin.startsWith("https://"))
    throw new Error("Production requires an HTTPS APP_ORIGIN.");
  if (
    production &&
    db.prepare("SELECT 1 FROM users WHERE email LIKE '%@demo.example'").get()
  )
    throw new Error("Remove demo accounts before running in production.");
  const dummyHash = await hashPassword(token());
  const app = express();
  app.disable("x-powered-by");
  app.use(compression());
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", "data:"],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: production ? [] : null,
        },
      },
      strictTransportSecurity: false,
    }),
  );
  app.use(express.json({ limit: "32kb" }));
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
      req.get("origin") !== origin
    )
      return res.status(403).json({ error: "Request origin is not allowed." });
    next();
  });
  app.get("/api/health", (req, res) => res.json({ status: "ok" }));
  app.post("/api/login", async (req, res) => {
    const data = z
      .strictObject({ email, password: z.string().min(1).max(200) })
      .parse(req.body);
    const now = Date.now();
    const keys = [`ip:${req.ip}`, `email:${digest(data.email)}`];
    transaction(db, () => {
      db.prepare("DELETE FROM login_limits WHERE reset_at<?").run(now);
      for (const key of keys) {
        const r = db.prepare("SELECT * FROM login_limits WHERE key=?").get(key);
        if (r && r.attempts >= (key.startsWith("ip:") ? 40 : 10))
          fail(429, "Too many sign-in attempts. Try again in 15 minutes.");
      }
      for (const key of keys)
        db.prepare(
          "INSERT INTO login_limits(key,attempts,reset_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1",
        ).run(key, now + 900000);
    });
    const user = db
      .prepare("SELECT * FROM users WHERE email=? AND active=1")
      .get(data.email);
    const valid = await verifyPassword(
      data.password,
      user?.password_hash || dummyHash,
    );
    if (!user || !valid) fail(401, "Email or password is incorrect.");
    db.prepare("DELETE FROM login_limits WHERE key=?").run(keys[1]);
    db.prepare("DELETE FROM sessions WHERE expires_at<?").run(now);
    const raw = token(),
      csrf = token();
    db.prepare("INSERT INTO sessions VALUES (?,?,?,?)").run(
      digest(raw),
      user.id,
      csrf,
      now + 8 * 60 * 60 * 1000,
    );
    res.cookie(cookieName, raw, {
      httpOnly: true,
      secure: production,
      sameSite: "strict",
      maxAge: 8 * 60 * 60 * 1000,
      path: "/",
    });
    res.json({ user: publicUser(user), csrf });
  });
  app.use("/api", (req, res, next) => {
    const raw = (req.headers.cookie || "")
      .split(";")
      .map((p) => p.trim())
      .find((p) => p.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1);
    const session =
      raw &&
      db
        .prepare("SELECT * FROM sessions WHERE token_hash=? AND expires_at>?")
        .get(digest(raw), Date.now());
    const user =
      session &&
      db
        .prepare("SELECT * FROM users WHERE id=? AND active=1")
        .get(session.user_id);
    if (!user) {
      if (req.method === "GET" && req.path === "/session")
        return res.json({ authenticated: false });
      return res.status(401).json({ error: "Sign in to continue." });
    }
    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
      req.get("x-csrf-token") !== session.csrf_token
    )
      return res.status(403).json({
        error: "Your security token has expired. Refresh and try again.",
      });
    req.user = publicUser(user);
    req.session = session;
    next();
  });
  app.get("/api/me", (req, res) =>
    res.json({ user: req.user, csrf: req.session.csrf_token }),
  );
  app.get("/api/session", (req, res) =>
    res.json({
      authenticated: true,
      user: req.user,
      csrf: req.session.csrf_token,
    }),
  );
  app.post("/api/logout", (req, res) => {
    db.prepare("DELETE FROM sessions WHERE token_hash=?").run(
      req.session.token_hash,
    );
    res.clearCookie(cookieName, {
      path: "/",
      httpOnly: true,
      secure: production,
      sameSite: "strict",
    });
    res.json({ ok: true });
  });
  app.get("/api/bootstrap", (req, res) => {
    const u = req.user;
    const bookings = db
      .prepare(
        `SELECT b.*,s.name scholar_name,s.registration_id,u.name supervisor_name FROM bookings b
      JOIN scholars s ON s.id=b.scholar_id JOIN users u ON u.id=b.supervisor_id WHERE b.department_id=? ORDER BY b.date`,
      )
      .all(u.department_id)
      .filter((b) => canRead(db, u, b));
    const scholars = db
      .prepare(
        `SELECT s.*,u.name supervisor_name FROM scholars s JOIN users u ON u.id=s.supervisor_id WHERE s.department_id=? ORDER BY s.name`,
      )
      .all(u.department_id)
      .filter(
        (s) =>
          ["admin", "coordinator", "hod"].includes(u.role) ||
          s.supervisor_id === u.id ||
          s.user_id === u.id,
      );
    // Availability exposes reservation state without another supervisor's scholar or title.
    const dates = db
      .prepare(
        `SELECT d.*,b.id booking_id,b.status FROM available_dates d LEFT JOIN bookings b ON b.department_id=d.department_id
      AND b.date=d.date AND b.status IN ('pending_coordinator','pending_hod','approved') WHERE d.department_id=? ORDER BY d.date`,
      )
      .all(u.department_id)
      .map((d) => ({
        date: d.date,
        enabled: !!d.enabled,
        note: d.note,
        reserved: !!d.booking_id,
        own: bookings.some((b) => b.id === d.booking_id),
      }));
    const faculty = db
      .prepare(
        "SELECT id,name,role,faculty_id,email,active FROM users WHERE department_id=? AND role!='scholar' ORDER BY name",
      )
      .all(u.department_id);
    res.json({
      user: u,
      department: db
        .prepare("SELECT * FROM departments WHERE id=?")
        .get(u.department_id),
      bookings,
      scholars,
      dates,
      faculty,
      notifications: db
        .prepare(
          "SELECT * FROM notifications WHERE recipient_id=? ORDER BY created_at DESC",
        )
        .all(u.id),
      mailMode: process.env.MAIL_MODE || "capture",
      today: today(),
    });
  });
  app.get("/api/bookings/:id", (req, res) => {
    const b = getBooking(db, req.user, id.parse(req.params.id));
    res.json({
      ...b,
      panel: db
        .prepare(
          "SELECT u.id,u.name,u.email FROM booking_panel p JOIN users u ON u.id=p.user_id WHERE p.booking_id=?",
        )
        .all(b.id),
      history: db
        .prepare(
          "SELECT h.*,u.name actor_name,u.role actor_role FROM history h JOIN users u ON u.id=h.actor_id WHERE booking_id=? ORDER BY h.rowid",
        )
        .all(b.id),
    });
  });
  app.post("/api/bookings", (req, res) =>
    res
      .status(201)
      .json(createBooking(db, req.user, bookingSchema.parse(req.body))),
  );
  app.post("/api/bookings/:id/action", (req, res) =>
    res.json(
      transition(
        db,
        req.user,
        id.parse(req.params.id),
        actionSchema.parse(req.body),
      ),
    ),
  );
  app.put("/api/dates/:date", (req, res) => {
    assertRoles(req.user, "admin", "coordinator");
    const day = date.parse(req.params.date);
    const data = z
      .strictObject({ enabled: z.boolean(), note: text(0, 200).default("") })
      .parse(req.body);
    if (day <= today()) fail(422, "Only future dates can be changed.");
    transaction(db, () => {
      if (
        !data.enabled &&
        db
          .prepare(
            "SELECT 1 FROM bookings WHERE department_id=? AND date=? AND status IN ('pending_coordinator','pending_hod','approved')",
          )
          .get(req.user.department_id, day)
      )
        fail(409, "Cancel the active pre-talk before disabling this date.");
      db.prepare(
        "INSERT INTO available_dates VALUES (?,?,?,?,?) ON CONFLICT(department_id,date) DO UPDATE SET enabled=excluded.enabled,note=excluded.note,updated_by=excluded.updated_by",
      ).run(
        req.user.department_id,
        day,
        Number(data.enabled),
        data.note,
        req.user.id,
      );
      audit(db, req.user, "date_updated", { date: day, ...data });
    });
    res.json({ ok: true });
  });
  app.post("/api/scholars", (req, res) => {
    assertRoles(req.user, "admin", "coordinator");
    const d = z
      .strictObject({
        name: text(2, 100),
        registration_id: text(3, 40),
        email,
        supervisor_id: id,
        research_area: text(0, 160).default(""),
      })
      .parse(req.body);
    const newId = randomUUID();
    transaction(db, () => {
      if (
        !db
          .prepare(
            "SELECT 1 FROM users WHERE id=? AND department_id=? AND role='supervisor' AND active=1",
          )
          .get(d.supervisor_id, req.user.department_id)
      )
        fail(422, "Select an active supervisor from this department.");
      db.prepare(
        "INSERT INTO scholars(id,department_id,name,registration_id,email,supervisor_id,research_area) VALUES (?,?,?,?,?,?,?)",
      ).run(
        newId,
        req.user.department_id,
        d.name,
        d.registration_id,
        d.email,
        d.supervisor_id,
        d.research_area,
      );
      audit(db, req.user, "scholar_created", { id: newId });
    });
    res.status(201).json({ id: newId });
  });
  app.patch("/api/scholars/:id", (req, res) => {
    assertRoles(req.user, "admin", "coordinator");
    const scholarId = id.parse(req.params.id),
      d = z.strictObject({ supervisor_id: id }).parse(req.body);
    transaction(db, () => {
      if (
        !db
          .prepare("SELECT 1 FROM scholars WHERE id=? AND department_id=?")
          .get(scholarId, req.user.department_id)
      )
        fail(404, "Scholar not found.");
      if (
        db
          .prepare(
            "SELECT 1 FROM bookings WHERE scholar_id=? AND status IN ('pending_coordinator','pending_hod','approved')",
          )
          .get(scholarId)
      )
        fail(409, "Close the active pre-talk before remapping this scholar.");
      if (
        !db
          .prepare(
            "SELECT 1 FROM users WHERE id=? AND department_id=? AND role='supervisor' AND active=1",
          )
          .get(d.supervisor_id, req.user.department_id)
      )
        fail(422, "Select an active supervisor.");
      db.prepare("UPDATE scholars SET supervisor_id=? WHERE id=?").run(
        d.supervisor_id,
        scholarId,
      );
      audit(db, req.user, "scholar_remapped", { id: scholarId, ...d });
    });
    res.json({ ok: true });
  });
  app.post("/api/users", async (req, res) => {
    assertRoles(req.user, "admin", "coordinator");
    const d = z
      .strictObject({
        name: text(2, 100),
        email,
        faculty_id: text(3, 40),
        role: z.enum(["coordinator", "supervisor", "hod", "panel"]),
        password: z.string().min(12).max(128),
      })
      .parse(req.body);
    if (req.user.role === "coordinator" && d.role === "coordinator")
      fail(403, "Only an admin can add coordinators.");
    const passwordHash = await hashPassword(d.password),
      newId = randomUUID();
    transaction(db, () => {
      db.prepare(
        "INSERT INTO users(id,department_id,name,email,faculty_id,role,password_hash) VALUES (?,?,?,?,?,?,?)",
      ).run(
        newId,
        req.user.department_id,
        d.name,
        d.email,
        d.faculty_id,
        d.role,
        passwordHash,
      );
      audit(db, req.user, "user_created", { id: newId, role: d.role });
    });
    res.status(201).json({ id: newId });
  });
  app.patch("/api/users/:id", (req, res) => {
    assertRoles(req.user, "admin", "coordinator");
    const userId = id.parse(req.params.id),
      d = z.strictObject({ active: z.boolean() }).parse(req.body);
    transaction(db, () => {
      const target = db
        .prepare("SELECT * FROM users WHERE id=? AND department_id=?")
        .get(userId, req.user.department_id);
      if (!target) fail(404, "Account not found.");
      if (
        target.id === req.user.id ||
        target.role === "admin" ||
        (req.user.role === "coordinator" && target.role === "coordinator")
      )
        fail(403, "This account cannot be changed by your role.");
      if (
        !d.active &&
        db
          .prepare(
            `SELECT 1 FROM bookings b WHERE b.status IN ('pending_coordinator','pending_hod','approved') AND
        (b.supervisor_id=? OR b.id IN (SELECT booking_id FROM booking_panel WHERE user_id=?))`,
          )
          .get(userId, userId)
      )
        fail(
          409,
          "This person is assigned to an active pre-talk. Close it before disabling their account.",
        );
      if (!d.active && target.role === "hod")
        fail(409, "Keep the HOD account active for department approvals.");
      db.prepare("UPDATE users SET active=? WHERE id=?").run(
        Number(d.active),
        userId,
      );
      if (!d.active)
        db.prepare("DELETE FROM sessions WHERE user_id=?").run(userId);
      audit(db, req.user, "user_active_updated", { id: userId, ...d });
    });
    res.json({ ok: true });
  });
  app.post("/api/notifications/read", (req, res) => {
    db.prepare(
      "UPDATE notifications SET read_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE recipient_id=? AND read_at IS NULL",
    ).run(req.user.id);
    res.json({ ok: true });
  });
  app.get("/api/outbox", (req, res) => {
    const manager = isManager(req.user);
    res.json(
      db
        .prepare(
          `SELECT m.* FROM mail_outbox m JOIN bookings b ON b.id=m.booking_id WHERE b.department_id=? ${manager ? "" : "AND m.recipient=?"} ORDER BY m.rowid DESC`,
        )
        .all(
          ...(manager
            ? [req.user.department_id]
            : [req.user.department_id, req.user.email]),
        ),
    );
  });
  app.get("/api/audit", (req, res) => {
    assertRoles(req.user, "admin", "coordinator");
    res.json(
      db
        .prepare(
          "SELECT a.*,u.name actor_name FROM audit a JOIN users u ON u.id=a.actor_id WHERE u.department_id=? ORDER BY a.rowid DESC LIMIT 300",
        )
        .all(req.user.department_id),
    );
  });
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "Endpoint not found." }),
  );
  app.use(express.static(resolve(root, "public"), { etag: true, maxAge: 0 }));
  const notFoundTemplate = readFileSync(
    resolve(root, "public/404.html"),
    "utf8",
  );
  app.use((req, res) =>
    res
      .status(404)
      .type("html")
      .send(
        notFoundTemplate.replace(
          /<time class="copyright-year">\d{4}<\/time>/,
          `<time class="copyright-year">${currentYear()}</time>`,
        ),
      ),
  );
  app.use((err, req, res, next) => {
    if (err instanceof z.ZodError)
      return res.status(422).json({
        error: "Check the form fields.",
        fields: err.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      });
    if (err instanceof HttpError)
      return res.status(err.status).json({ error: err.message });
    if (String(err.message).includes("UNIQUE constraint failed"))
      return res
        .status(409)
        .json({ error: "This email or identifier is already registered." });
    if (err.type === "entity.parse.failed")
      return res.status(400).json({ error: "Invalid JSON." });
    if (err.type === "entity.too.large")
      return res.status(413).json({ error: "Request is too large." });
    console.error("Request failed:", err.code || err.name);
    res
      .status(500)
      .json({ error: "The request could not be completed. Please try again." });
  });
  return app;
}
