import { randomUUID } from "node:crypto";
import { hashPassword } from "./security.js";
import { transaction } from "./db.js";
import { history, queueNotifications, today } from "./domain.js";

export const DEMO_PASSWORD = "DemoOnly!2026";
export function dayAfter(n) {
  const d = new Date(today() + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export async function seedDemo(db) {
  if (process.env.NODE_ENV === "production")
    throw new Error("Demo seeding is disabled in production.");
  if (db.prepare("SELECT 1 FROM users LIMIT 1").get()) return false;
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  transaction(db, () => {
    const dep = randomUUID(),
      other = randomUUID();
    db.prepare("INSERT INTO departments VALUES (?,?)").run(
      dep,
      "Computer Science & Engineering",
    );
    db.prepare("INSERT INTO departments VALUES (?,?)").run(
      other,
      "Electronics & Communication",
    );
    const makeUser = (name, email, role, faculty, department = dep) => {
      const u = {
        id: randomUUID(),
        name,
        email,
        role,
        department_id: department,
      };
      db.prepare(
        "INSERT INTO users(id,department_id,name,email,faculty_id,role,password_hash) VALUES (?,?,?,?,?,?,?)",
      ).run(u.id, department, name, email, faculty, role, passwordHash);
      return u;
    };
    const admin = makeUser(
      "Dr. Meera Raman",
      "admin@demo.example",
      "admin",
      "DEMO-F001",
    );
    const co = makeUser(
      "Dr. Nandini Rao",
      "coordinator@demo.example",
      "coordinator",
      "DEMO-F002",
    );
    const sup = makeUser(
      "Dr. Arjun Menon",
      "supervisor@demo.example",
      "supervisor",
      "DEMO-F003",
    );
    const sup2 = makeUser(
      "Dr. Kavya Iyer",
      "supervisor2@demo.example",
      "supervisor",
      "DEMO-F004",
    );
    const hod = makeUser(
      "Dr. Vikram Sen",
      "hod@demo.example",
      "hod",
      "DEMO-F005",
    );
    const panels = [
      makeUser(
        "Dr. Leela Krishnan",
        "panel@demo.example",
        "panel",
        "DEMO-F006",
      ),
      makeUser("Dr. Rohan Das", "panel2@demo.example", "panel", "DEMO-F007"),
      makeUser("Dr. Priya Nair", "panel3@demo.example", "panel", "DEMO-F008"),
      makeUser("Dr. Ishaan Bose", "panel4@demo.example", "panel", "DEMO-F009"),
    ];
    const scholarUser = makeUser(
      "Ananya Narayanan",
      "scholar@demo.example",
      "scholar",
      "DEMO-S001",
    );
    makeUser(
      "Dr. Tara Shah",
      "other-supervisor@demo.example",
      "supervisor",
      "DEMO-F010",
      other,
    );
    const makeScholar = (name, reg, email, supervisor, area, user = null) => {
      const sid = randomUUID();
      db.prepare("INSERT INTO scholars VALUES (?,?,?,?,?,?,?,?)").run(
        sid,
        dep,
        name,
        reg,
        email,
        supervisor.id,
        user?.id || null,
        area,
      );
      return sid;
    };
    const s1 = makeScholar(
      "Ananya Narayanan",
      "DEMO-PHD-2022-014",
      "scholar@demo.example",
      sup,
      "Privacy-preserving machine learning",
      scholarUser,
    );
    const s2 = makeScholar(
      "Karthik Subramanian",
      "DEMO-PHD-2021-028",
      "karthik@demo.example",
      sup,
      "Distributed systems",
    );
    const s3 = makeScholar(
      "Diya Prakash",
      "DEMO-PHD-2023-009",
      "diya@demo.example",
      sup2,
      "Computer vision",
    );
    makeScholar(
      "Aditya Rajan",
      "DEMO-PHD-2022-031",
      "aditya@demo.example",
      sup,
      "Edge computing",
    );
    makeScholar(
      "Sara Ahmed",
      "DEMO-PHD-2023-017",
      "sara@demo.example",
      sup2,
      "Natural language processing",
    );
    for (let n = 1; n <= 65; n++) {
      const day = dayAfter(n),
        weekday = new Date(day + "T12:00:00Z").getUTCDay();
      if ((weekday !== 0 && weekday !== 6) || [2, 4, 7, 9, 12, 15].includes(n))
        db.prepare("INSERT INTO available_dates VALUES (?,?,?,?,?)").run(
          dep,
          day,
          Number(n % 6 !== 0),
          "",
          co.id,
        );
      db.prepare("INSERT INTO available_dates VALUES (?,?,?,?,?)").run(
        other,
        day,
        1,
        "",
        admin.id,
      );
    }
    const makeBooking = (sid, supervisor, n, title, status, venue, time) => {
      const b = {
        id: randomUUID(),
        department_id: dep,
        scholar_id: sid,
        supervisor_id: supervisor.id,
        date: dayAfter(n),
        time,
        venue,
        title,
      };
      db.prepare(
        "INSERT INTO bookings(id,department_id,scholar_id,supervisor_id,date,time,venue,title,abstract,status) VALUES (?,?,?,?,?,?,?,?,?,?)",
      ).run(
        b.id,
        dep,
        sid,
        supervisor.id,
        b.date,
        time,
        venue,
        title,
        "A departmental open forum to present research findings, discuss methodology, and gather feedback before the synopsis meeting.",
        status,
      );
      for (const p of panels)
        db.prepare("INSERT INTO booking_panel VALUES (?,?)").run(b.id, p.id);
      history(db, b.id, supervisor, "submitted", "Demo request submitted.");
      if (["pending_hod", "approved"].includes(status))
        history(
          db,
          b.id,
          co,
          "pending_hod",
          "Scholar mapping and schedule verified.",
        );
      if (status === "approved") {
        history(
          db,
          b.id,
          hod,
          "approved",
          "Approved for the departmental open forum.",
        );
        queueNotifications(db, b, "approved");
      }
      if (status === "rejected")
        history(
          db,
          b.id,
          co,
          "rejected",
          "Please revise the research summary and submit a fresh request.",
        );
      if (status === "cancelled")
        history(
          db,
          b.id,
          co,
          "cancelled",
          "Supervisor requested a change of date. The day is available again.",
        );
    };
    makeBooking(
      s1,
      sup,
      2,
      "Federated learning for privacy-aware healthcare analytics",
      "pending_coordinator",
      "Research Seminar Hall · Block A",
      "10:00",
    );
    makeBooking(
      s2,
      sup,
      7,
      "Reliable consensus in large-scale distributed systems",
      "pending_hod",
      "Computing Research Auditorium",
      "10:30",
    );
    makeBooking(
      s3,
      sup2,
      4,
      "Explainable vision models for sustainable agriculture",
      "approved",
      "Seminar Hall 02 · Research Block",
      "14:00",
    );
    makeBooking(
      s2,
      sup,
      12,
      "Fault-tolerant distributed computing architectures",
      "rejected",
      "Research Seminar Hall · Block A",
      "11:00",
    );
    makeBooking(
      s3,
      sup2,
      9,
      "Interpretable deep learning for field crop monitoring",
      "cancelled",
      "Seminar Hall 02 · Research Block",
      "10:00",
    );
  });
  return true;
}
