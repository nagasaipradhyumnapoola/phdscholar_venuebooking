import request from "supertest";
import { openDatabase } from "../server/db.js";
import { createApp } from "../server/app.js";
import { seedDemo, DEMO_PASSWORD, dayAfter } from "../server/seed-data.js";
export const ORIGIN = "http://127.0.0.1:4173";
export async function fixture() {
  const db = openDatabase(":memory:");
  await seedDemo(db);
  const app = await createApp(db, { origin: ORIGIN, production: false });
  return { db, app };
}
export async function login(app, role = "coordinator") {
  const r = await request(app)
    .post("/api/login")
    .set("Origin", ORIGIN)
    .send({ email: `${role}@demo.example`, password: DEMO_PASSWORD });
  if (r.status !== 200) throw new Error(JSON.stringify(r.body));
  return {
    user: r.body.user,
    csrf: r.body.csrf,
    cookie: r.headers["set-cookie"][0].split(";")[0],
  };
}
export function call(app, session, method, path, body) {
  return request(app)
    [method](path)
    .set("Origin", ORIGIN)
    .set("Cookie", session.cookie)
    .set("x-csrf-token", session.csrf)
    .send(body);
}
export function freshBooking(
  db,
  supervisorEmail = "supervisor@demo.example",
  n = 15,
) {
  const u = db
    .prepare("SELECT * FROM users WHERE email=?")
    .get(supervisorEmail);
  const scholar = db
    .prepare(
      "SELECT * FROM scholars s WHERE supervisor_id=? AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.scholar_id=s.id AND status IN ('pending_coordinator','pending_hod','approved'))",
    )
    .get(u.id);
  return {
    scholar_id: scholar.id,
    date: dayAfter(n),
    time: "10:00",
    venue: "Fictional Research Hall",
    title: "Robust scheduling for distributed research systems",
    abstract: "A fictional research abstract.",
    panel_ids: db
      .prepare("SELECT id FROM users WHERE role='panel' AND department_id=?")
      .all(u.department_id)
      .map((p) => p.id),
  };
}
