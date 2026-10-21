import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { resolve } from "node:path";
import { signIn, navigate } from "./support.js";
import { currentYear, institutionEmail } from "../../public/site.js";
const evidence = process.env.EVIDENCE_DIR || resolve("test-results/evidence");
test("mobile menu opens, traps focus, closes with Escape, navigates, and shows only permitted links", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  const trigger = page.getByRole("button", { name: "Open menu", exact: true });
  await trigger.click();
  const menu = page.getByRole("dialog", { name: "Menu", exact: true });
  await expect(menu).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.screenshot({
    path: resolve(evidence, "mobile-menu.png"),
    fullPage: true,
  });
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    scan.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(menu).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await navigate(page, "approvals");
  await expect(page).toHaveURL(/#approvals$/);
  await expect(menu).not.toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Approval queue",
  );
  await expect(page.locator("#main")).toBeFocused();
  await page
    .getByRole("link", {
      name: "SRM Institute of Science and Technology",
      exact: false,
    })
    .first()
    .click();
  await expect(page).toHaveURL(/#overview$/);
  await trigger.click();
  await menu.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(menu).not.toBeVisible();
  await expect(page.locator("body")).not.toHaveClass(/menu-open/);
});
test("footer links, institutional email, copyright, metadata and every local asset resolve", async ({
  page,
}) => {
  await signIn(page);
  const descriptions = [];
  for (const hash of [
    "overview",
    "calendar",
    "requests",
    "approvals",
    "scholars",
    "people",
    "notifications",
    "outbox",
    "audit",
    "guide",
  ]) {
    await navigate(page, hash);
    await expect(page).toHaveTitle(/ · PhD Pre-talks \| SRMIST Demo$/);
    descriptions.push(
      await page.locator('meta[name="description"]').getAttribute("content"),
    );
    await expect(page.locator(".page-footer")).toContainText(
      `© ${currentYear()} Research Office`,
    );
    await expect(
      page.locator('.page-footer a[href^="mailto:"]'),
    ).toHaveAttribute("href", `mailto:${institutionEmail}`);
    for (const href of await page
      .locator('link[href^="/"],script[src^="/"],img[src^="/"]')
      .evaluateAll((es) =>
        es.map((e) => e.getAttribute("href") || e.getAttribute("src")),
      )) {
      const r = await page.request.get(href);
      expect(r.status(), href).toBe(200);
    }
  }
  expect(new Set(descriptions).size).toBe(10);
  await expect(page.locator("[placeholder]")).toHaveCount(0);
  await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
  await page.locator('.footer-links a[href="#overview"]').click();
  await expect(page).toHaveURL(/#overview$/);
});
test("unknown paths and hash routes show custom errors with working return links", async ({
  page,
}) => {
  let r = await page.goto("/this-page-does-not-exist");
  expect(r.status()).toBe(404);
  await expect(page).toHaveTitle(
    "Page not found · PhD Pre-talks | SRMIST Demo",
  );
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 700 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: resolve(evidence, "404-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Return to portal" }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto("/#unknown-route");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await expect(page).toHaveTitle(
    "Page not found · PhD Pre-talks | SRMIST Demo",
  );
  await page.getByRole("button", { name: "Return to overview" }).click();
  await expect(
    page.getByRole("heading", { name: "Pre-talk overview" }),
  ).toBeVisible();
});
test("success and error messages are visible and inputs use labels without filler placeholders", async ({
  page,
}) => {
  await signIn(page);
  await expect(page.getByRole("status")).toHaveText("Signed in.");
  await navigate(page, "people");
  await page.getByRole("button", { name: "Add faculty account" }).click();
  const d = page.getByRole("dialog");
  await expect(d.locator("[placeholder]")).toHaveCount(0);
  await d
    .getByLabel("Full name", { exact: true })
    .fill("Duplicate Account Test");
  await d.getByLabel("Faculty ID", { exact: true }).fill("DEMO-DUPLICATE-NEW");
  await d
    .getByLabel("Email address", { exact: true })
    .fill("panel@demo.example");
  await d.getByLabel("Role", { exact: true }).selectOption("panel");
  await d.getByLabel(/Initial password/).fill("DemoOnly!2026");
  await d.getByRole("button", { name: "Create account" }).click();
  await expect(d.getByRole("alert")).toContainText("already registered");
  await expect(d.getByRole("button", { name: "Create account" })).toBeEnabled();
  await expect(d.getByLabel("Full name", { exact: true })).toHaveValue(
    "Duplicate Account Test",
  );
});
