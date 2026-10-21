import { openDatabase } from "../server/db.js";
import { seedDemo } from "../server/seed-data.js";
import { createApp } from "../server/app.js";
import { processOutbox } from "../server/mailer.js";
const db = openDatabase(":memory:");
await seedDemo(db);
await processOutbox(db);
const app = await createApp(db, {
  origin: "http://127.0.0.1:4174",
  production: false,
});
app.listen(4174, "127.0.0.1", () =>
  console.log("Isolated browser-test server ready."),
);
setInterval(() => processOutbox(db, { mode: "capture" }), 1000);
