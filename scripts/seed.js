import { openDatabase } from "../server/db.js";
import { seedDemo } from "../server/seed-data.js";
import { processOutbox } from "../server/mailer.js";
const db = openDatabase();
console.log(
  (await seedDemo(db))
    ? "Fictional demo data created. See README for demo credentials."
    : "Database already contains users; no changes made.",
);
await processOutbox(db);
db.close();
