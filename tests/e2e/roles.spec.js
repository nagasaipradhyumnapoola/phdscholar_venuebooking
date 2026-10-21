import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { resolve } from "node:path";
import { signIn, navigate, api } from "./support.js";
const evidence = process.env.EVIDENCE_DIR || resolve("test-results/evidence");
const roles = [
  ["admin", "admin@demo.example", ["approvals", "people", "scholars", "audit"]],
  [
    "coordinator",
    "coordinator@demo.example",
    ["approvals", "people", "scholars", "audit"],
  ],
  ["supervisor", "supervisor@demo.example", ["scholars"]],
  ["supervisor2", "supervisor2@demo.example", ["scholars"]],
  ["hod", "hod@demo.example", ["approvals", "scholars"]],
  ["panel", "panel@demo.example", []],
  ["panel2", "panel2@demo.example", []],
  ["panel3", "panel3@demo.example", []],
  ["panel4", "panel4@demo.example", []],
  ["scholar", "scholar@demo.example", ["scholars"]],
  ["other-department", "other-supervisor@demo.example", ["scholars"]],
];
for (const [role, email, extras] of roles)
  test(`${role}: every permitted page, forbidden controls, desktop/mobile UI and accessibility`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await signIn(page, email);
    const logo = page.getByRole("img", {
      name: "SRM Institute of Science and Technology",
      exact: true,
    });
    await expect(logo).toBeVisible();
    expect(await logo.evaluate((e) => e.complete && e.naturalWidth > 0)).toBe(
      true,
    );
    const manager = ["admin", "coordinator"].includes(role),
      supervisor = role.startsWith("supervisor") || role === "other-department";
    const boot = await api(page, "/bootstrap");
    expect(boot.user.email).toBe(email);
    await page
      .getByRole("button", { name: "Search portal", exact: true })
      .click();
    await page
      .getByRole("searchbox", { name: "Search portal", exact: true })
      .fill("DEMO-PHD");
    const matching = boot.bookings.filter((b) =>
      b.registration_id.includes("DEMO-PHD"),
    );
    const talkResults = page
      .locator(".search-results section")
      .filter({
        has: page.getByRole("heading", { name: "Pre-talks", exact: true }),
      })
      .locator(".search-result");
    await expect(talkResults).toHaveCount(matching.length);
    for (const booking of matching)
      await expect(talkResults.filter({ hasText: booking.title })).toHaveCount(
        1,
      );
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    const expected = [
      "overview",
      "calendar",
      "requests",
      ...extras.filter(
        (x) => x === "approvals" || x === "scholars" || x === "people",
      ),
      "notifications",
      "outbox",
      ...extras.filter((x) => x === "audit"),
      "guide",
    ];
    const actual = await page
      .getByRole("navigation")
      .locator("a")
      .evaluateAll((es) => es.map((e) => e.getAttribute("href").slice(1)));
    expect(new Set(actual)).toEqual(
      new Set(expected.filter((x) => x !== "guide")),
    );
    const violations = [];
    for (const hash of expected) {
      await navigate(page, hash);
      if (hash === "calendar" && !manager && !supervisor)
        await expect(page.locator(".calendar-day:not(:disabled)")).toHaveCount(
          0,
        );
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page).toHaveURL(new RegExp("#" + hash + "$"));
      await expect(page).toHaveTitle(/ · PhD Pre-talks \| SRMIST Demo$/);
      expect(
        (await page.locator('meta[name="description"]').getAttribute("content"))
          .length,
      ).toBeGreaterThan(30);
      if (hash === "overview")
        await expect(
          page.getByRole("button", {
            name: "Schedule a pre-talk",
            exact: true,
          }),
        ).toHaveCount(supervisor ? 1 : 0);
      if (!manager) {
        await expect(
          page.getByRole("button", {
            name: "Add faculty account",
            exact: true,
          }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("button", {
            name: "Add research scholar",
            exact: true,
          }),
        ).toHaveCount(0);
      }
      if (hash === "scholars" && !manager)
        await expect(
          page.getByRole("button", { name: "Change mapping" }),
        ).toHaveCount(0);
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      violations.push(
        ...result.violations.map((v) => ({
          page: hash,
          id: v.id,
          targets: v.nodes.map((n) => n.target),
        })),
      );
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${role}/${hash}/${width} overflow`,
        ).toBe(true);
        expect(
          await page.evaluate(() =>
            Array.from(document.querySelectorAll("body *"))
              .filter((e) => {
                const r = e.getBoundingClientRect(),
                  s = getComputedStyle(e);
                return (
                  r.width > 0 &&
                  e.scrollWidth > e.clientWidth + 1 &&
                  ["auto", "scroll"].includes(s.overflowX)
                );
              })
              .map((e) => e.className),
          ),
          `${role}/${hash}/${width} horizontal scroller`,
        ).toEqual([]);
        // Secondary duplicate demo accounts exercise the same UI; retain evidence for each primary role.
        if (
          [
            "admin",
            "coordinator",
            "supervisor",
            "hod",
            "panel",
            "scholar",
            "other-department",
          ].includes(role)
        )
          await page.screenshot({
            path: resolve(evidence, `${role}-${hash}-${width}.png`),
            fullPage: true,
          });
      }
      await page.setViewportSize({ width: 1440, height: 900 });
    }
    await navigate(page, "requests");
    await page.getByRole("button", { name: "Closed", exact: true }).click();
    await page.getByRole("searchbox").fill("not-a-real-scholar-000");
    await expect(
      page.getByRole("heading", { name: "No pre-talks found" }),
    ).toBeVisible();
    if (["panel", "panel2", "panel3", "panel4", "scholar"].includes(role)) {
      await page
        .getByRole("button", { name: "All requests", exact: true })
        .click();
      await page.getByRole("searchbox").fill("");
      const first = page.locator(".booking-row").first();
      if (await first.count()) {
        await first.click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await expect(page.getByLabel("Action", { exact: true })).toHaveCount(0);
        await expect(
          page.getByRole("heading", { name: "Request history" }),
        ).toBeVisible();
        await page.keyboard.press("Escape");
      }
    }
    await navigate(page, "notifications");
    const markRead = page.getByRole("button", {
      name: "Mark all as read",
      exact: true,
    });
    if (await markRead.count()) {
      await markRead.click();
      await expect(markRead).toHaveCount(0);
      expect(
        (await api(page, "/bootstrap")).notifications.every((n) => n.read_at),
      ).toBe(true);
    }
    await navigate(page, "outbox");
    const summary = page.locator(".mail-row details summary").first();
    if (await summary.count()) {
      await summary.click();
      await expect(page.locator(".mail-row pre").first()).toBeVisible();
    }
    expect(violations).toEqual([]);
    expect(errors).toEqual([]);
  });
