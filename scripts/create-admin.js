import { openDatabase, transaction } from "../server/db.js";
import { hashPassword } from "../server/security.js";
import { randomUUID } from "node:crypto";
// Password is supplied through stdin, never through command-line arguments or a checked-in file.
const [name, email, facultyId, department] = process.argv.slice(2);
if (!name || !email?.includes("@") || !facultyId || !department)
  throw new Error(
    'Usage: node scripts/create-admin.js "Name" email "Faculty ID" "Department" < password-input',
  );
let password = "";
for await (const chunk of process.stdin) password += chunk;
password = password.trim();
if (password.length < 12 || password.length > 128)
  throw new Error("Password must be 12–128 characters.");
const hash = await hashPassword(password);
password = "";
const db = openDatabase();
transaction(db, () => {
  const existing = db
    .prepare("SELECT id FROM departments WHERE name=?")
    .get(department);
  const dep = existing?.id || randomUUID();
  if (!existing)
    db.prepare("INSERT INTO departments VALUES (?,?)").run(dep, department);
  db.prepare(
    "INSERT INTO users(id,department_id,name,email,faculty_id,role,password_hash) VALUES (?,?,?,?,?,?,?)",
  ).run(randomUUID(), dep, name, email.toLowerCase(), facultyId, "admin", hash);
});
db.close();
console.log("Administrator created.");
