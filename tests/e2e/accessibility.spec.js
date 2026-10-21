import { test, expect } from "@playwright/test";
import { signIn, navigate } from "./support.js";
test("skip link keeps the current page and moves keyboard focus to main content", async ({
  page,
}) => {
  await signIn(page);
  await navigate(page, "requests");
  const heading = await page.getByRole("heading", { level: 1 }).textContent();
  await page.getByRole("link", { name: "Skip to main content" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
  await expect(page).toHaveURL(/#requests$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
});
