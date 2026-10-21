import { test } from "node:test";
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { mkdtempSync, readdirSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { openDatabase } from "../server/db.js";
import { seedDemo, DEMO_PASSWORD } from "../server/seed-data.js";
import { ORIGIN } from "./helpers.js";
test(
  "two HOD sessions on independent processes race final approval: one decision and one notification set",
  { timeout: 30000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "pretalk-approval-")),
      path = join(dir, "race.sqlite");
    let db = openDatabase(path);
    await seedDemo(db);
    const booking = db
      .prepare("SELECT * FROM bookings WHERE status='pending_hod'")
      .get();
    db.close();
    const children = [];
    try {
      const servers = await Promise.all(
        [1, 2].map(async () => {
          const c = fork(new URL("./fixtures/server.js", import.meta.url), [], {
            env: { ...process.env, TEST_DB: path },
            silent: true,
          });
          children.push(c);
          c.stderr.on("data", () => {});
          const [m] = await once(c, "message");
          return "http://127.0.0.1:" + m.port;
        }),
      );
      const sessions = await Promise.all(
        servers.map(async (base) => {
          const r = await fetch(base + "/api/login", {
            method: "POST",
            headers: { Origin: ORIGIN, "Content-Type": "application/json" },
            body: JSON.stringify({
              email: "hod@demo.example",
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
          fetch(`${base}/api/bookings/${booking.id}/action`, {
            method: "POST",
            headers: {
              Origin: ORIGIN,
              "Content-Type": "application/json",
              Cookie: sessions[i].cookie,
              "x-csrf-token": sessions[i].csrf,
            },
            body: JSON.stringify({
              action: "approve",
              version: booking.version,
            }),
          }),
        ),
      );
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
      db = openDatabase(path);
      assert.equal(
        db
          .prepare(
            "SELECT count(*) n FROM history WHERE booking_id=? AND action='approved'",
          )
          .get(booking.id).n,
        1,
      );
      assert.equal(
        db
          .prepare("SELECT count(*) n FROM mail_outbox WHERE booking_id=?")
          .get(booking.id).n,
        7,
      );
      db.close();
    } finally {
      await Promise.all(
        children.map(async (c) => {
          const stopped = once(c, "exit");
          c.kill();
          await stopped;
        }),
      );
      for (const name of readdirSync(dir)) unlinkSync(join(dir, name));
      rmdirSync(dir);
    }
  },
);
