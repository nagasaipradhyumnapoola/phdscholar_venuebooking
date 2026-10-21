import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { resolve } from "node:path";
const evidence = process.env.EVIDENCE_DIR || resolve("test-results/evidence");
async function login(page, role) {
  await page.goto("/");
  const consent = page.getByRole("button", {
    name: "Necessary only",
    exact: true,
  });
  if (await consent.isVisible()) await consent.click();
  await page.getByRole("button", { name: role, exact: true }).click();
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Pre-talk overview" }),
  ).toBeVisible();
}
async function logout(page) {
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
}
async function nav(page, name) {
  const menuButton = page.getByRole("button", {
    name: "Open menu",
    exact: true,
  });
  if (await menuButton.isVisible()) await menuButton.click();
  await page
    .getByRole("navigation")
    .getByRole("link", {
      name: new RegExp("^" + name.replace(/ [0-9]+$/, "") + "(?: [0-9]+)?$"),
    })
    .click();
}
async function decide(page, action, note) {
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Action", { exact: true }).selectOption(action);
  if (note) await dialog.getByLabel(/Review note/).fill(note);
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm decision", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}
test("supervisor submission → coordinator → HOD → panel confirmation → coordinator cancellation", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await login(page, "Supervisor");
  await page
    .getByRole("button", { name: "Schedule a pre-talk", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog
    .getByLabel("Research scholar", { exact: true })
    .selectOption({ label: "Aditya Rajan · DEMO-PHD-2022-031" });
  await dialog
    .getByLabel("Venue · enter manually")
    .fill("Fictional Open Forum Hall");
  await dialog
    .getByLabel("Research title", { exact: true })
    .fill("Browser-verified research on resilient academic scheduling");
  await dialog
    .getByLabel("Research summary (optional)")
    .fill("This fictional request is created by the browser workflow test.");
  await dialog
    .getByRole("button", { name: "Submit for coordinator review" })
    .click();
  await expect(dialog).not.toBeVisible();
  await nav(page, "My pre-talks");
  await expect(
    page.getByRole("button").filter({ hasText: "Browser-verified research" }),
  ).toBeVisible();
  await logout(page);
  await login(page, "Research coordinator");
  await nav(page, "Approval queue 2");
  await page
    .getByRole("button")
    .filter({ hasText: "Browser-verified research" })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByText("Fictional Open Forum Hall", { exact: true }),
  ).toBeVisible();
  await decide(
    page,
    "approve",
    "Mapping, venue and panel verified in browser test.",
  );
  await logout(page);
  await login(page, "Head of department");
  await nav(page, "Approval queue 2");
  await page
    .getByRole("button")
    .filter({ hasText: "Browser-verified research" })
    .click();
  await decide(page, "approve", "Approved for the open forum.");
  await logout(page);
  await login(page, "Panel member");
  await nav(page, "Notifications");
  await expect(
    page
      .getByRole("button")
      .filter({ hasText: "Pre-talk confirmed: Aditya Rajan" }),
  ).toBeVisible();
  await page
    .getByRole("button")
    .filter({ hasText: "Pre-talk confirmed: Aditya Rajan" })
    .click();
  await expect(
    page.getByRole("dialog").getByText("Confirmed", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page
      .getByRole("dialog")
      .getByText("Fictional Open Forum Hall", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Action", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await logout(page);
  await login(page, "Research coordinator");
  await nav(page, "All pre-talks");
  await page
    .getByRole("button")
    .filter({ hasText: "Browser-verified research" })
    .click();
  await decide(
    page,
    "cancel",
    "Panel availability changed; rescheduling requested.",
  );
  await nav(page, "Email outbox");
  await expect(
    page
      .getByRole("heading", { name: "Pre-talk cancelled: Aditya Rajan" })
      .first(),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("coordinator enables a day, adds scholar, changes mapping and provisions a panel account", async ({
  page,
}) => {
  await login(page, "Research coordinator");
  await nav(page, "Manage dates");
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  const day = page.locator(".calendar-day.unavailable:not(:disabled)").first();
  await day.click();
  await page
    .getByRole("dialog")
    .getByLabel("Booking availability")
    .selectOption("true");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save date", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await nav(page, "Scholars & mapping");
  await page
    .getByRole("button", { name: "Add research scholar", exact: true })
    .click();
  const form = page.getByRole("dialog");
  await form
    .getByLabel("Full name", { exact: true })
    .fill("Fictional Browser Scholar");
  await form
    .getByLabel("Registration ID", { exact: true })
    .fill("DEMO-BROWSER-001");
  await form
    .getByLabel("Scholar email", { exact: true })
    .fill("browser-scholar@demo.example");
  await form.getByRole("button", { name: "Add scholar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Fictional Browser Scholar" }),
  ).toBeVisible();
  const row = page
    .getByRole("article")
    .filter({ hasText: "Fictional Browser Scholar" });
  await row.getByRole("button", { name: "Change mapping" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Supervisor", { exact: true })
    .selectOption({ label: "Dr. Kavya Iyer" });
  await page.getByRole("button", { name: "Save mapping" }).click();
  await expect(row).toContainText("Dr. Kavya Iyer");
  await nav(page, "Faculty & access");
  await page.getByRole("button", { name: "Add faculty account" }).click();
  await form
    .getByLabel("Full name", { exact: true })
    .fill("Dr. Fictional Browser Panel");
  await form.getByLabel("Faculty ID", { exact: true }).fill("DEMO-BROWSER-F");
  await form
    .getByLabel("Email address", { exact: true })
    .fill("browser-panel@demo.example");
  await form.getByLabel("Role", { exact: true }).selectOption("panel");
  await form.getByLabel(/Initial password/).fill("BrowserDemo!2026");
  await form.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByRole("heading", { name: "Dr. Fictional Browser Panel" }),
  ).toBeVisible();
});
test("desktop, tablet, mobile, keyboard dialog focus, no overflow, accessible main screens", async ({
  page,
}) => {
  await page.goto("/");
  await page.screenshot({
    path: resolve(evidence, "login-desktop.png"),
    fullPage: true,
  });
  let result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await login(page, "Research coordinator");
  await expect(page).toHaveTitle("Overview · PhD Pre-talks | SRMIST Demo");
  await page.screenshot({
    path: resolve(evidence, "dashboard-desktop.png"),
    fullPage: true,
  });
  for (const width of [1440, 1024, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: resolve(evidence, "dashboard-mobile.png"),
    fullPage: true,
  });
  result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await nav(page, "Approval queue 1");
  const open = page
    .getByRole("button")
    .filter({ hasText: "Federated learning" });
  await open.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(open).toBeFocused();
  await nav(page, "Manage dates");
  await page.screenshot({
    path: resolve(evidence, "calendar-desktop.png"),
    fullPage: true,
  });
  result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: resolve(evidence, "calendar-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("mobile sign-in recovers after a lost connection; reduced motion and long text remain usable", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Necessary only", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.screenshot({
    path: resolve(evidence, "login-mobile.png"),
    fullPage: true,
  });
  await page.locator(".demo-access > summary").click();
  await page
    .getByRole("button", { name: "Research coordinator", exact: true })
    .click();
  await context.setOffline(true);
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(page.getByRole("alert")).toContainText("Connection lost");
  await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(
    "coordinator@demo.example",
  );
  await expect(
    page.getByRole("button", { name: "Sign in to workspace" }),
  ).toBeEnabled();
  await context.setOffline(false);
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Pre-talk overview" }),
  ).toBeVisible();
  await nav(page, "Approval queue");
  await page
    .getByRole("button")
    .filter({ hasText: "Federated learning" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: resolve(evidence, "request-mobile.png"),
    fullPage: true,
  });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
