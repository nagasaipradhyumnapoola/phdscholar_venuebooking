import { test, expect } from "@playwright/test";
import {
  signIn,
  signOut,
  navigate,
  api,
  scenario,
  openRequest,
  decision,
  password,
} from "./support.js";
test("coordinator rejection requires a reason, preserves history, releases the day and permits rebooking", async ({
  page,
}) => {
  const s = await scenario(page, "CO-REJECT", 80);
  await signOut(page);
  await signIn(page);
  await openRequest(page, s.title);
  const d = page.getByRole("dialog");
  await d.getByLabel("Action", { exact: true }).selectOption("reject");
  await d.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(d.getByRole("alert")).toContainText("Provide a reason");
  await decision(page, "reject", "Research summary needs revision.");
  await openRequest(page, s.title);
  await expect(d.getByText("Rejected", { exact: true }).first()).toBeVisible();
  await expect(
    d.getByText("Research summary needs revision.", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  const boot = await api(page, "/bootstrap");
  expect(boot.dates.find((x) => x.date === s.date).reserved).toBe(false);
  expect(
    (await api(page, "/outbox")).filter((m) => m.body.includes(s.title)),
  ).toEqual([]);
  await signOut(page);
  await signIn(page, "supervisor@demo.example");
  await page
    .getByRole("button", { name: "Schedule a pre-talk", exact: true })
    .click();
  await d
    .getByLabel("Research scholar", { exact: true })
    .selectOption(s.scholarId);
  await d
    .getByLabel("Pre-talk date · IST", { exact: true })
    .selectOption(s.date);
  await d
    .getByLabel("Venue · enter manually", { exact: true })
    .fill("Rebooked Seminar Hall");
  await d
    .getByLabel("Research title", { exact: true })
    .fill("Revised research verification CO-REJECT");
  await d
    .getByRole("button", { name: "Submit for coordinator review" })
    .click();
  await expect(d).not.toBeVisible();
});
test("HOD rejects only after coordinator approval; supervisor sees the recorded decision", async ({
  page,
}) => {
  const s = await scenario(page, "HOD-REJECT", 81);
  await signOut(page);
  await signIn(page);
  await openRequest(page, s.title);
  await decision(page, "approve");
  await signOut(page);
  await signIn(page, "hod@demo.example");
  await openRequest(page, s.title);
  await decision(page, "reject", "Please narrow the presentation scope.");
  await signOut(page);
  await signIn(page, "supervisor@demo.example");
  await openRequest(page, s.title);
  const d = page.getByRole("dialog");
  await expect(d.getByText("Rejected", { exact: true }).first()).toBeVisible();
  await expect(
    d.getByText("Please narrow the presentation scope.", { exact: true }),
  ).toBeVisible();
  await expect(d.getByLabel("Action", { exact: true })).toHaveCount(0);
});
test("supervisor withdrawal needs a reason and releases only their pending reservation", async ({
  page,
}) => {
  const s = await scenario(page, "WITHDRAW", 82);
  await openRequest(page, s.title);
  await decision(page, "cancel", "Supervisor requested a different day.");
  const b = await api(page, "/bootstrap");
  expect(b.dates.find((d) => d.date === s.date).reserved).toBe(false);
  await openRequest(page, s.title);
  await expect(
    page.getByRole("dialog").getByText("Cancelled", { exact: true }).first(),
  ).toBeVisible();
});
test("admin provisions a coordinator; new account signs in with coordinator permissions", async ({
  page,
}) => {
  await signIn(page, "admin@demo.example");
  await navigate(page, "people");
  await page.getByRole("button", { name: "Add faculty account" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Full name", { exact: true }).fill("Dr. Test Coordinator");
  await d.getByLabel("Faculty ID", { exact: true }).fill("DEMO-TEST-CO");
  await d
    .getByLabel("Email address", { exact: true })
    .fill("test-co@demo.example");
  await d.getByLabel("Role", { exact: true }).selectOption("coordinator");
  await d.getByLabel(/Initial password/).fill(password);
  await d.getByRole("button", { name: "Create account" }).click();
  await expect(d).not.toBeVisible();
  await signOut(page);
  await signIn(page, "test-co@demo.example");
  await navigate(page, "people");
  await page.getByRole("button", { name: "Add faculty account" }).click();
  await expect(
    d.getByLabel("Role", { exact: true }).locator("option"),
  ).toHaveCount(3);
  await page.keyboard.press("Escape");
});
test("account errors recover; an unassigned faculty account can be disabled and enabled", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await signIn(page);
  await navigate(page, "people");
  const assigned = page
    .getByRole("article")
    .filter({ hasText: "panel@demo.example" });
  await assigned.getByRole("button", { name: "Disable", exact: true }).click();
  const d = page.getByRole("dialog");
  await d.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(d.getByRole("alert")).toContainText("active pre-talk");
  await expect(
    d.getByRole("button", { name: "Confirm", exact: true }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  const account = await api(page, "/users", "POST", {
    name: "Dr. Access Test",
    email: "access-test@demo.example",
    faculty_id: "DEMO-ACCESS",
    role: "panel",
    password,
  });
  await navigate(page, "overview");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Pre-talk overview" }),
  ).toBeVisible();
  await navigate(page, "people");
  let row = page
    .getByRole("article")
    .filter({ hasText: "access-test@demo.example" });
  await row.getByRole("button", { name: "Disable", exact: true }).click();
  await d.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(d).not.toBeVisible();
  await expect(row.getByText("Inactive", { exact: true })).toBeVisible();
  await row.getByRole("button", { name: "Enable", exact: true }).click();
  await d.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(d).not.toBeVisible();
  await expect(row.getByText("Active", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test("second supervisor books only their scholar and can withdraw the request", async ({
  page,
}) => {
  await signIn(page, "supervisor2@demo.example");
  const boot = await api(page, "/bootstrap");
  const sara = boot.scholars.find((s) => s.name === "Sara Ahmed");
  await page
    .getByRole("button", { name: "Schedule a pre-talk", exact: true })
    .click();
  const d = page.getByRole("dialog");
  const options = await d
    .getByLabel("Research scholar", { exact: true })
    .locator("option")
    .allTextContents();
  expect(options.every((x) => x.includes("Sara Ahmed"))).toBe(true);
  await d.getByLabel("Research scholar", { exact: true }).selectOption(sara.id);
  await d
    .getByLabel("Venue · enter manually", { exact: true })
    .fill("Supervisor Two Research Hall");
  await d
    .getByLabel("Research title", { exact: true })
    .fill("Research request for the second supervisor");
  await d
    .getByRole("button", { name: "Submit for coordinator review" })
    .click();
  await expect(d).not.toBeVisible();
  await openRequest(page, "Research request for the second supervisor");
  await expect(d.getByText("Dr. Kavya Iyer", { exact: true })).toBeVisible();
  await decision(page, "cancel", "Withdrawal verified for second supervisor.");
});
