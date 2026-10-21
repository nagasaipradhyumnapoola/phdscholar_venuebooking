import { expect } from "@playwright/test";
export const password = "DemoOnly!2026";
export async function signIn(page, email = "coordinator@demo.example") {
  await page.goto("/");
  const consent = page.getByRole("button", {
    name: "Necessary only",
    exact: true,
  });
  if (await consent.isVisible()) await consent.click();
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Pre-talk overview", exact: true }),
  ).toBeVisible();
}
export async function signOut(page) {
  const menuButton = page.getByRole("button", {
    name: "Open menu",
    exact: true,
  });
  if (await menuButton.isVisible()) await menuButton.click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
}
export async function navigate(page, hash) {
  if (hash === "guide")
    await page.locator('.footer-links a[href="#guide"]').click();
  else {
    const menuButton = page.getByRole("button", {
      name: "Open menu",
      exact: true,
    });
    if (await menuButton.isVisible()) await menuButton.click();
    await page.getByRole("navigation").locator(`a[href="#${hash}"]`).click();
  }
  await expect(page.locator(".loading")).toHaveCount(0);
}
export async function api(page, path, method = "GET", body) {
  const session = await (await page.request.get("/api/me")).json();
  const response = await page.request.fetch("/api" + path, {
    method,
    headers: { Origin: "http://127.0.0.1:4174", "x-csrf-token": session.csrf },
    ...(body ? { data: body } : {}),
  });
  const data = await response.json();
  expect(response.ok(), JSON.stringify(data)).toBe(true);
  return data;
}
export async function scenario(page, key, offset) {
  await signIn(page);
  const boot = await api(page, "/bootstrap");
  const supervisor = boot.faculty.find(
    (p) => p.email === "supervisor@demo.example",
  );
  const day = new Date(boot.today + "T12:00:00Z");
  day.setUTCDate(day.getUTCDate() + offset);
  const date = day.toISOString().slice(0, 10);
  await api(page, "/dates/" + date, "PUT", { enabled: true });
  const name = "Test Scholar " + key;
  const scholar = await api(page, "/scholars", "POST", {
    name,
    registration_id: "DEMO-E2E-" + key,
    email: `${key.toLowerCase()}@demo.example`,
    supervisor_id: supervisor.id,
  });
  await signOut(page);
  await signIn(page, "supervisor@demo.example");
  await page
    .getByRole("button", { name: "Schedule a pre-talk", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d
    .getByLabel("Research scholar", { exact: true })
    .selectOption(scholar.id);
  await d.getByLabel("Pre-talk date · IST", { exact: true }).selectOption(date);
  await d
    .getByLabel("Venue · enter manually", { exact: true })
    .fill("Test Seminar Hall " + key);
  await d
    .getByLabel("Research title", { exact: true })
    .fill("Research verification scenario " + key);
  await d
    .getByRole("button", { name: "Submit for coordinator review" })
    .click();
  await expect(d).not.toBeVisible();
  return {
    name,
    date,
    title: "Research verification scenario " + key,
    scholarId: scholar.id,
  };
}
export async function openRequest(page, title) {
  await navigate(page, "requests");
  await page.getByRole("button").filter({ hasText: title }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
export async function decision(
  page,
  action,
  reason = "Verified during end-to-end testing.",
) {
  const d = page.getByRole("dialog");
  await d.getByLabel("Action", { exact: true }).selectOption(action);
  await d.getByLabel(/Review note/).fill(reason);
  await d.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm decision", exact: true })
    .click();
  await expect(d).not.toBeVisible();
}
