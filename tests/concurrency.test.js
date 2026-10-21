import { test } from "node:test";
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { openDatabase } from "../server/db.js";
import { seedDemo, DEMO_PASSWORD } from "../server/seed-data.js";
import { freshBooking, ORIGIN } from "./helpers.js";
test("two independent server processes race: exactly one department booking wins, regardless of venue/time", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pretalk-race-")),
    path = join(dir, "race.sqlite");
  let db = openDatabase(path);
  await seedDemo(db);
  const payload = freshBooking(db),
    second = freshBooking(db, "supervisor2@demo.example");
  db.close();
  const children = [];
  try {
    const servers = await Promise.all(
      [1, 2].map(async () => {
        const child = fork(
          new URL("./fixtures/server.js", import.meta.url),
          [],
          { env: { ...process.env, TEST_DB: path }, silent: true },
        );
        children.push(child);
        child.stderr.on("data", () => {});
        const [message] = await once(child, "message");
        return "http://127.0.0.1:" + message.port;
      }),
    );
    const sessions = await Promise.all(
      servers.map(async (base, i) => {
        const r = await fetch(base + "/api/login", {
          method: "POST",
          headers: { Origin: ORIGIN, "Content-Type": "application/json" },
          body: JSON.stringify({
            email: i ? "supervisor2@demo.example" : "supervisor@demo.example",
            password: DEMO_PASSWORD,
          }),
        });
        return {
          cookie: r.headers.get("set-cookie").split(";")[0],
          ...(await r.json()),
        };
      }),
    );
    const results = await Promise.all(
      servers.map((base, i) =>
        fetch(base + "/api/bookings", {
          method: "POST",
          headers: {
            Origin: ORIGIN,
            "Content-Type": "application/json",
            Cookie: sessions[i].cookie,
            "x-csrf-token": sessions[i].csrf,
          },
          body: JSON.stringify(
            i
              ? {
                  ...second,
                  date: payload.date,
                  venue: "Entirely different hall",
                  time: "16:30",
                }
              : payload,
          ),
        }),
      ),
    );
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    db = openDatabase(path);
    assert.equal(
      db
        .prepare(
          "SELECT count(*) n FROM bookings WHERE date=? AND status IN ('pending_coordinator','pending_hod','approved')",
        )
        .get(payload.date).n,
      1,
    );
    db.close();
  } finally {
    await Promise.all(
      children.map(async (c) => {
        c.kill();
        await once(c, "exit");
      }),
    );
    rmSync(dir, { recursive: true, force: true });
  }
});
