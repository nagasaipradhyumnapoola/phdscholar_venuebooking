import { randomUUID } from "node:crypto";
import { transaction } from "./db.js";
import { hashPassword, verifyPassword } from "./security.js";
import { DEMO_PASSWORD, dayAfter } from "./seed-data.js";
import { createBooking, transition } from "./domain.js";

const departments = {
  CSE: "Computer Science & Engineering",
  ECE: "Electronics & Communication",
};
const baseEmails = [
  "admin",
  "coordinator",
  "supervisor",
  "supervisor2",
  "hod",
  "panel",
  "panel2",
  "panel3",
  "panel4",
  "scholar",
  "other-supervisor",
].map((name) => name + "@demo.example");
export const extraDemoAccounts = [
  ["CSE", "admin", "Dr. Rhea Nair", "admin2", "DEMO-CSE-F101"],
  ["CSE", "admin", "Dr. Manoj Krishnan", "admin3", "DEMO-CSE-F102"],
  ["CSE", "coordinator", "Dr. Sahana Reddy", "coordinator2", "DEMO-CSE-F103"],
  ["CSE", "coordinator", "Dr. Prakash Balan", "coordinator3", "DEMO-CSE-F104"],
  ["CSE", "supervisor", "Dr. Sanjay Kulkarni", "supervisor3", "DEMO-CSE-F105"],
  ["CSE", "hod", "Dr. Asha Menon", "hod2", "DEMO-CSE-F106"],
  ["CSE", "hod", "Dr. Dev Iyer", "hod3", "DEMO-CSE-F107"],
  ["CSE", "scholar", "Rithika Suresh", "scholar2", "DEMO-CSE-S102"],
  ["CSE", "scholar", "Naveen Kumar", "scholar3", "DEMO-CSE-S103"],
  ["ECE", "admin", "Dr. Anita Varma", "ece-admin1", "DEMO-ECE-F201"],
  ["ECE", "admin", "Dr. Mohan Sethi", "ece-admin2", "DEMO-ECE-F202"],
  [
    "ECE",
    "coordinator",
    "Dr. Renu Pillai",
    "ece-coordinator1",
    "DEMO-ECE-F203",
  ],
  [
    "ECE",
    "coordinator",
    "Dr. Kiran Malhotra",
    "ece-coordinator2",
    "DEMO-ECE-F204",
  ],
  ["ECE", "supervisor", "Dr. Neelima Rao", "ece-supervisor2", "DEMO-ECE-F205"],
  ["ECE", "hod", "Dr. Sridhar Raman", "ece-hod1", "DEMO-ECE-F206"],
  ["ECE", "hod", "Dr. Malini Das", "ece-hod2", "DEMO-ECE-F207"],
  ["ECE", "panel", "Dr. Devika Joshi", "ece-panel1", "DEMO-ECE-F208"],
  ["ECE", "panel", "Dr. Harish Bhat", "ece-panel2", "DEMO-ECE-F209"],
  ["ECE", "scholar", "Ishita Raman", "ece-scholar1", "DEMO-ECE-S201"],
  ["ECE", "scholar", "Rahul Nair", "ece-scholar2", "DEMO-ECE-S202"],
].map(([department, role, name, email, faculty_id]) => ({
  department,
  role,
  name,
  email: email + "@demo.example",
  faculty_id,
}));

const scholarSpecs = [
  [
    "CSE",
    "Rithika Suresh",
    "DEMO-CSE-PHD-101",
    "scholar2",
    "supervisor3",
    "Trustworthy edge intelligence",
    "pending_coordinator",
  ],
  [
    "CSE",
    "Naveen Kumar",
    "DEMO-CSE-PHD-102",
    "scholar3",
    "supervisor2",
    "Robust language models",
    "pending_hod",
  ],
  [
    "CSE",
    "Aarav Desai",
    "DEMO-CSE-PHD-103",
    null,
    "supervisor3",
    "Efficient graph learning",
    null,
  ],
  [
    "ECE",
    "Ishita Raman",
    "DEMO-ECE-PHD-101",
    "ece-scholar1",
    "other-supervisor",
    "Low-power biomedical sensors",
    "pending_coordinator",
  ],
  [
    "ECE",
    "Rahul Nair",
    "DEMO-ECE-PHD-102",
    "ece-scholar2",
    "ece-supervisor2",
    "Reconfigurable antenna systems",
    "pending_hod",
  ],
  [
    "ECE",
    "Akshay Mohan",
    "DEMO-ECE-PHD-103",
    null,
    "other-supervisor",
    "Wireless sensor networks",
    null,
  ],
  [
    "ECE",
    "Maya Thomas",
    "DEMO-ECE-PHD-104",
    null,
    "ece-supervisor2",
    "Energy-efficient communication",
    null,
  ],
].map(
  ([
    department,
    name,
    registration_id,
    login,
    supervisor,
    research_area,
    status,
  ]) => ({
    department,
    name,
    registration_id,
    login,
    supervisor,
    research_area,
    status,
  }),
);
const emailOf = (name) => name + "@demo.example";

export async function addDemoAccounts(db) {
  if (process.env.NODE_ENV === "production")
    throw new Error("Demo accounts are disabled in production.");
  const departmentRows = Object.fromEntries(
    Object.entries(departments).map(([code, name]) => {
      const row = db
        .prepare("SELECT * FROM departments WHERE name=?")
        .get(name);
      if (!row)
        throw new Error(
          "Run the base demo seed before adding sample accounts.",
        );
      return [code, row];
    }),
  );
  const base = db
    .prepare(
      "SELECT role,department_id FROM users WHERE email='admin@demo.example'",
    )
    .get();
  if (base?.role !== "admin" || base.department_id !== departmentRows.CSE.id)
    throw new Error("The expected development demo was not found.");
  const existingUser = db.prepare("SELECT * FROM users WHERE email=?");
  const assertIdentity = (found, spec) => {
    if (
      found &&
      (found.role !== spec.role ||
        found.department_id !== departmentRows[spec.department].id ||
        found.faculty_id !== spec.faculty_id)
    )
      throw new Error(
        `Existing account conflicts with the sample identity: ${spec.email}. No account was reset.`,
      );
  };
  // Validate the entire plan before adding users; never overwrite a matching account.
  for (const spec of extraDemoAccounts)
    assertIdentity(existingUser.get(spec.email), spec);
  const hashes = new Map();
  for (const spec of extraDemoAccounts)
    if (!existingUser.get(spec.email))
      hashes.set(spec.email, await hashPassword(DEMO_PASSWORD));
  const result = { users: 0, scholars: 0, bookings: 0 };
  transaction(db, () => {
    for (const spec of extraDemoAccounts) {
      const found = existingUser.get(spec.email);
      assertIdentity(found, spec);
      if (found) continue;
      db.prepare(
        "INSERT INTO users(id,department_id,name,email,faculty_id,role,password_hash) VALUES (?,?,?,?,?,?,?)",
      ).run(
        randomUUID(),
        departmentRows[spec.department].id,
        spec.name,
        spec.email,
        spec.faculty_id,
        spec.role,
        hashes.get(spec.email),
      );
      result.users++;
    }
    for (const spec of scholarSpecs) {
      const supervisor = existingUser.get(emailOf(spec.supervisor));
      const user = spec.login ? existingUser.get(emailOf(spec.login)) : null;
      const existingScholar = db
        .prepare("SELECT * FROM scholars WHERE registration_id=?")
        .get(spec.registration_id);
      if (existingScholar) {
        if (
          existingScholar.department_id !==
            departmentRows[spec.department].id ||
          existingScholar.user_id !== (user?.id || null)
        )
          throw new Error(
            "An existing scholar conflicts with the sample identity. No mapping was overwritten.",
          );
        continue;
      }
      if (
        supervisor?.role !== "supervisor" ||
        supervisor.department_id !== departmentRows[spec.department].id ||
        (user &&
          (user.role !== "scholar" ||
            user.department_id !== supervisor.department_id))
      )
        throw new Error(
          "The sample scholar mapping does not match its department and roles.",
        );
      db.prepare(
        "INSERT INTO scholars(id,department_id,name,registration_id,email,supervisor_id,user_id,research_area) VALUES (?,?,?,?,?,?,?,?)",
      ).run(
        randomUUID(),
        supervisor.department_id,
        spec.name,
        spec.registration_id,
        user?.email ||
          `directory-${spec.registration_id.toLowerCase()}@demo.example`,
        supervisor.id,
        user?.id || null,
        spec.research_area,
      );
      result.scholars++;
    }
  });
  // These requests stop at review; no confirmation emails are generated.
  for (const spec of scholarSpecs.filter((s) => s.status)) {
    const scholar = db
      .prepare("SELECT * FROM scholars WHERE registration_id=?")
      .get(spec.registration_id);
    if (db.prepare("SELECT 1 FROM bookings WHERE scholar_id=?").get(scholar.id))
      continue;
    const supervisor = db
      .prepare("SELECT * FROM users WHERE id=?")
      .get(scholar.supervisor_id);
    const coordinator = existingUser.get(
      emailOf(spec.department === "CSE" ? "coordinator2" : "ece-coordinator1"),
    );
    if (!supervisor.active || !coordinator.active) continue;
    const panel = db
      .prepare(
        "SELECT id FROM users WHERE department_id=? AND role='panel' AND active=1",
      )
      .all(scholar.department_id);
    if (!panel.length) continue;
    let booked = false;
    for (let offset = 1; offset <= 120 && !booked; offset++) {
      const day = dayAfter(offset);
      const date = db
        .prepare(
          "SELECT enabled FROM available_dates WHERE department_id=? AND date=?",
        )
        .get(scholar.department_id, day);
      if (
        (date && !date.enabled) ||
        db
          .prepare(
            "SELECT 1 FROM bookings WHERE department_id=? AND date=? AND status IN ('pending_coordinator','pending_hod','approved')",
          )
          .get(scholar.department_id, day)
      )
        continue;
      if (!date)
        db.prepare("INSERT INTO available_dates VALUES (?,?,?,?,?)").run(
          scholar.department_id,
          day,
          1,
          "Fictional demo scheduling date",
          coordinator.id,
        );
      try {
        const booking = createBooking(db, supervisor, {
          scholar_id: scholar.id,
          date: day,
          time: "11:00",
          venue: `Demo ${spec.department} Research Seminar Hall`,
          title: `${spec.research_area} for resilient research systems`,
          abstract:
            "Fictional sample request for testing role access and sequential approvals.",
          panel_ids: panel.map((p) => p.id),
        });
        if (spec.status === "pending_hod")
          transition(db, coordinator, booking.id, {
            action: "approve",
            version: 1,
            note: "Sample request verified by the demo coordinator; awaiting HOD approval.",
          });
        result.bookings++;
        booked = true;
      } catch (error) {
        if (error.status !== 409) throw error;
        if (
          db
            .prepare(
              "SELECT 1 FROM bookings WHERE scholar_id=? AND status IN ('pending_coordinator','pending_hod','approved')",
            )
            .get(scholar.id)
        )
          break;
      }
    }
  }
  return result;
}

export function sampleAccounts(db) {
  const emails = [...baseEmails, ...extraDemoAccounts.map((s) => s.email)];
  const roleOrder = [
    "admin",
    "coordinator",
    "supervisor",
    "hod",
    "panel",
    "scholar",
  ];
  return db
    .prepare(
      `SELECT u.*,d.name department FROM users u JOIN departments d ON d.id=u.department_id WHERE u.email IN (${emails.map(() => "?").join(",")})`,
    )
    .all(...emails)
    .map((row) => ({
      ...row,
      departmentCode:
        Object.entries(departments).find(
          ([, name]) => name === row.department,
        )?.[0] || row.department,
    }))
    .sort(
      (a, b) =>
        a.departmentCode.localeCompare(b.departmentCode) ||
        roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role) ||
        a.email.localeCompare(b.email),
    );
}

export async function credentialsTable(db) {
  const roles = {
    admin: "Admin",
    coordinator: "Coordinator",
    supervisor: "Supervisor",
    hod: "HOD",
    panel: "Panel",
    scholar: "Scholar",
  };
  const safe = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("|", "\\|")
      .replace(/[\r\n]/g, " ");
  const lines = [
    "# DEMO account table",
    "",
    "Portal: http://127.0.0.1:4173/",
    "",
    "Fictional sample accounts only. Use the email address to sign in.",
    "",
    "CSE = Computer Science & Engineering. ECE = Electronics & Communication.",
    "",
    "| Department | Role | Name | Account ID | Login email | Password | Status |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const account of sampleAccounts(db)) {
    const password = (await verifyPassword(
      DEMO_PASSWORD,
      account.password_hash,
    ))
      ? DEMO_PASSWORD
      : "Changed; not exported";
    lines.push(
      "| " +
        [
          account.departmentCode,
          roles[account.role],
          account.name,
          account.faculty_id,
          account.email,
          password,
          account.active ? "Active" : "Disabled",
        ]
          .map(safe)
          .join(" | ") +
        " |",
    );
  }
  return lines.join("\n") + "\n";
}
