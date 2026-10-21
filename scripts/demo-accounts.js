import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { openDatabase, root } from "../server/db.js";
import { seedDemo } from "../server/seed-data.js";
import {
  addDemoAccounts,
  credentialsTable,
  sampleAccounts,
} from "../server/demo-accounts.js";

if (process.env.NODE_ENV === "production")
  throw new Error("Demo accounts are disabled in production.");
const db = openDatabase();
try {
  await seedDemo(db);
  const added = await addDemoAccounts(db);
  const output = resolve(root, "table");
  writeFileSync(output, await credentialsTable(db), "utf8");
  console.log(
    `Added ${added.users} fictional accounts, ${added.scholars} scholar mappings, and ${added.bookings} sample requests.`,
  );
  console.log(
    `Saved ${sampleAccounts(db).length} demo account rows to ${output}. Existing accounts and passwords were preserved.`,
  );
} finally {
  db.close();
}
