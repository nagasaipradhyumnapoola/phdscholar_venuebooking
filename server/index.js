import { openDatabase } from "./db.js";
import { createApp } from "./app.js";
import { processOutbox } from "./mailer.js";
const db = openDatabase();
const app = await createApp(db);
const port = Number(process.env.PORT || 4173),
  host = process.env.HOST || "127.0.0.1";
const server = app.listen(port, host, () =>
  console.log(
    `Research Office running at ${process.env.APP_ORIGIN || `http://${host}:${port}`}`,
  ),
);
let busy = false;
async function deliver() {
  if (busy) return;
  busy = true;
  try {
    await processOutbox(db);
  } catch (e) {
    console.error("Mail worker:", e.message);
  } finally {
    busy = false;
  }
}
await deliver();
const timer = setInterval(deliver, 5000);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    clearInterval(timer);
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
