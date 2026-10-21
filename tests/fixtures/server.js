import { openDatabase } from "../../server/db.js";
import { createApp } from "../../server/app.js";
const db = openDatabase(process.env.TEST_DB);
const app = await createApp(db, {
  production: false,
  origin: "http://127.0.0.1:4173",
});
const server = app.listen(0, "127.0.0.1", () =>
  process.send({ port: server.address().port }),
);
process.on("SIGTERM", () =>
  server.close(() => {
    db.close();
    process.exit();
  }),
);
