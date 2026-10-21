import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { resolve } from "node:path";
import { signIn, navigate, api } from "./support.js";
const evidence = process.env.EVIDENCE_DIR || resolve("test-results/evidence");
const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const scan = async (page) => {
  const result = await new AxeBuilder({ page }).withTags(tags).analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
};

test("cookie choices gate local first-touch UTM attribution, survive reload, and can be withdrawn", async ({
  page,
  context,
}) => {
  await page.goto(
    "/?utm_source=research-office&utm_medium=email&utm_campaign=pre-talk&token=must-not-be-kept",
  );
  await expect(
    page.getByRole("region", { name: "Cookie preferences" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem("pretalk.campaign.v1")),
  ).toBeNull();
  await scan(page);
  await page
    .getByRole("button", { name: "Allow campaign tracking", exact: true })
    .click();
  let attribution = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("pretalk.campaign.v1")),
  );
  expect(attribution.parameters).toEqual({
    utm_source: "research-office",
    utm_medium: "email",
    utm_campaign: "pre-talk",
  });
  expect(await context.cookies()).toEqual([]);
  await page.goto("/?utm_source=later");
  await expect(
    page.getByRole("region", { name: "Cookie preferences" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem("pretalk.campaign.v1")),
    ),
  ).toEqual(attribution);
  await page
    .getByRole("button", { name: "Cookie preferences", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Cookies & preferences" });
  await dialog.getByText("View campaign details", { exact: true }).click();
  await expect(dialog).toContainText("research-office");
  await dialog
    .getByRole("button", { name: "Necessary only", exact: true })
    .click();
  expect(
    await page.evaluate(() => sessionStorage.getItem("pretalk.campaign.v1")),
  ).toBeNull();
  await page.reload();
  expect(
    await page.evaluate(() => sessionStorage.getItem("pretalk.campaign.v1")),
  ).toBeNull();
});

test("public dark mode persists, password visibility, FAQ, search, contact, copy recovery and 404 controls work on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Necessary only", exact: true })
    .click();
  await page.getByRole("button", { name: "Supervisor", exact: true }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await page.getByLabel("Show password", { exact: true }).check();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByLabel("Show password", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await scan(page);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const faq = page.locator("#login-faq details").first();
  await faq.locator("summary").click();
  await expect(faq).toHaveAttribute("open", "");
  await expect(faq.locator("p")).toContainText("mapped supervisor");
  await page
    .getByRole("button", { name: "Search portal", exact: true })
    .click();
  await page
    .getByRole("searchbox", { name: "Search portal", exact: true })
    .fill("frequently");
  await page
    .getByRole("button", { name: "Frequently asked questions", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Contact", exact: true }).click();
  const contact = page.getByRole("dialog", { name: "Contact & help" });
  await expect(
    contact.getByRole("link", { name: "infodesk@srmist.edu.in", exact: true }),
  ).toHaveAttribute("href", "mailto:infodesk@srmist.edu.in");
  await expect(contact.locator('a[href^="tel:"]')).toHaveCount(0);
  await scan(page);
  await page.keyboard.press("Escape");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw Error("Permission denied");
        },
      },
    }),
  );
  await page
    .getByRole("button", { name: "Copy demo password", exact: true })
    .click();
  const fallback = page.getByRole("dialog", { name: "Copy text", exact: true });
  await expect(
    fallback.getByLabel("Text to copy", { exact: true }),
  ).toHaveValue("DemoOnly!2026");
  await expect(
    fallback.getByLabel("Text to copy", { exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await page.goto("/no-such-page");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await scan(page);
  await page.getByRole("button", { name: "Light mode", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Contact", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Contact & help" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("loading and error states announce a delayed failure, retain values, and honor reduced motion", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Necessary only", exact: true })
    .click();
  await page.getByRole("button", { name: "Supervisor", exact: true }).click();
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/api/login", async (route) => {
    await pending;
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "Email or password is incorrect." }),
    });
  });
  const submit = page.getByRole("button", {
    name: "Sign in to workspace",
    exact: true,
  });
  await submit.click();
  await expect(submit).toBeDisabled();
  await expect(submit).toHaveAttribute("aria-busy", "true");
  await expect(page.locator("#request-progress")).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await submit.evaluate((e) => getComputedStyle(e, "::before").animationName),
  ).toBe("none");
  release();
  await expect(page.getByRole("alert")).toContainText(
    "Email or password is incorrect",
  );
  await expect(submit).toBeEnabled();
  await expect(submit).not.toHaveAttribute("aria-busy");
  await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(
    "supervisor@demo.example",
  );
  await expect(page.locator("#request-progress")).not.toBeVisible();
});

test("authenticated tools: dark page audit, search, copy, printing, sticky header, progress, back-to-top and data freshness", async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    window.print = () => {
      window.__printed = true;
    };
  });
  await signIn(page);
  const boot = await api(page, "/bootstrap");
  await expect(page.locator(".last-updated time")).toHaveAttribute(
    "datetime",
    /T/,
  );
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
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
    await scan(page);
    await page.setViewportSize({ width: 320, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      hash,
    ).toBe(true);
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.getByRole("button", { name: "Light mode", exact: true }).click();
  await page.evaluate(() => scrollTo(0, 500));
  await expect(page.locator(".portal-header")).toHaveCSS("position", "sticky");
  expect((await page.locator(".portal-header").boundingBox()).y).toBe(0);
  await expect
    .poll(() => page.locator("#scroll-progress").evaluate((e) => e.value))
    .toBeGreaterThan(0);
  await expect(
    page.getByRole("button", { name: "Back to top", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to top", exact: true }).click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await page.keyboard.press("Control+k");
  const b =
    boot.bookings.find((b) => b.status === "approved") || boot.bookings[0];
  await page
    .getByRole("searchbox", { name: "Search portal", exact: true })
    .fill(b.title);
  await page
    .locator(".search-result")
    .filter({ hasText: b.scholar_name })
    .click();
  const detail = page.getByRole("dialog", {
    name: "Pre-talk details",
    exact: true,
  });
  await detail
    .getByRole("button", { name: "Copy schedule", exact: true })
    .click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain(b.title);
  expect(copied).toContain(b.venue);
  expect(copied).toContain(b.time + " IST");
  await detail
    .getByRole("button", { name: "Print pre-talk", exact: true })
    .click();
  expect(await page.evaluate(() => window.__printed)).toBe(true);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#app")).not.toBeVisible();
  await expect(detail.locator(".research-title")).toHaveText(b.title);
  await expect(detail.locator(".decision-form")).not.toBeVisible();
  await expect(page.locator(".floating-tools")).not.toBeVisible();
  await page.screenshot({
    path: resolve(evidence, "print-pre-talk.png"),
    fullPage: true,
  });
  const pdf = await page.pdf({
    path: resolve(evidence, "sample-pre-talk.pdf"),
    format: "A4",
    printBackground: true,
  });
  expect(pdf.length).toBeGreaterThan(10000);
  expect([
    ...pdf.toString("latin1").matchAll(/\/Type\s*\/Page\b/g),
  ]).toHaveLength(1);
  await page.emulateMedia({ media: "screen" });
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Search portal", exact: true })
    .click();
  await page
    .getByRole("searchbox", { name: "Search portal", exact: true })
    .fill("no-such-scholar-xyz");
  await expect(
    page.getByRole("heading", { name: "No matching results" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await scan(page);
  await page.screenshot({ path: resolve(evidence, "dark-mobile-menu.png") });
});
