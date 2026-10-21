import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { fixture } from "./helpers.js";
import { currentYear } from "../public/site.js";
test("missing paths return a branded HTTP 404 with metadata, favicon, email and current year", async () => {
  const { db, app } = await fixture();
  try {
    const r = await request(app).get("/missing-page");
    assert.equal(r.status, 404);
    assert.match(r.headers["content-type"], /text\/html/);
    assert.match(r.text, /<h1>Page not found<\/h1>/);
    assert.match(r.text, /Page not found · PhD Pre-talks \| SRMIST Demo/);
    assert.ok(
      r.text.includes(`<time class="copyright-year">${currentYear()}</time>`),
    );
    assert.ok(r.text.includes("mailto:infodesk@srmist.edu.in"));
    for (const p of [
      "/",
      "/styles.css",
      "/site.js",
      "/app.js",
      "/assets/srm-favicon.png",
      "/assets/srm-logo-white.svg",
    ])
      assert.equal((await request(app).get(p)).status, 200, p);
  } finally {
    db.close();
  }
});
test("static SVG and JavaScript responses are compressed for accepting browsers", async () => {
  const { db, app } = await fixture();
  try {
    for (const p of ["/assets/srm-logo-white.svg", "/app.js"]) {
      const r = await request(app).get(p).set("Accept-Encoding", "gzip");
      assert.equal(r.status, 200);
      assert.equal(r.headers["content-encoding"], "gzip");
      assert.match(r.headers.vary, /Accept-Encoding/);
    }
  } finally {
    db.close();
  }
});
