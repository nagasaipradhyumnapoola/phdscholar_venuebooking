import { openDatabase } from "../server/db.js";
const db = openDatabase();
console.log(
  "Migrations applied:",
  db
    .prepare("SELECT name FROM schema_migrations")
    .all()
    .map((r) => r.name)
    .join(", "),
);
db.close();
