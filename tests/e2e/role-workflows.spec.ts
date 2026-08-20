import { expect, test } from "@playwright/test";

const capture = async (page: import("@playwright/test").Page, name: string) => {
  if (process.env.E2E_SCREENSHOTS === "true") {
    await page.screenshot({ path: `test-results/visual/${name}.png`, fullPage: true });
  }
};

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Local issues deserve a clear public trail." })).toBeVisible();
});

test("citizen can enter the demo and support an issue on a narrow screen", async ({ page }) => {
  const viewportFits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(viewportFits).toBe(true);

  await page.getByRole("button", { name: "Open NagarSakhi" }).click();
  await expect(page.getByRole("heading", { name: /Ward 12/ })).toBeVisible();
  await page.getByRole("button", { name: "Issues", exact: true }).click();
  await page.getByRole("button", { name: /^Support/ }).first().click();
  await expect(page.getByRole("button", { name: /^Support/ }).first()).toHaveAttribute("aria-pressed", "true");
  await capture(page, "citizen-mobile");
});

test("parshad can record an explicit issue status", async ({ page }) => {
  await page.getByRole("radio", { name: /Parshad · Ward 12/ }).click();
  await page.getByRole("button", { name: "Open NagarSakhi" }).click();
  await expect(page.getByRole("heading", { name: "Decide the next clear step" })).toBeVisible();

  const issueRows = page.getByRole("button", { name: /ISSUE-/ });
  await issueRows.first().click();
  await page.getByRole("button", { name: "In progress / कार्य जारी", exact: true }).click();
  await expect(page.getByText(/marked “In progress/)).toBeVisible();
  await capture(page, "parshad-mobile");
});

test("corporation official can review ward and escalation records", async ({ page }) => {
  await page.getByRole("radio", { name: /Corporation official/ }).click();
  await page.getByRole("button", { name: "Open NagarSakhi" }).click();
  await expect(page.getByRole("heading", { name: "Where intervention is needed" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Assign a visible outcome" })).toBeVisible();
  await expect(page.getByText("Nehru Nagar", { exact: true }).first()).toBeVisible();
  await capture(page, "corporation-mobile");
});

test("citizen issue detail adapts to a wide desktop workspace", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await page.getByRole("button", { name: "Open NagarSakhi" }).click();
  await page.getByRole("button", { name: "Issues", exact: true }).click();
  await page.getByRole("button", { name: /^Open issue:/ }).first().click();

  const detail = page.locator('aside[aria-live="polite"]');
  await expect(detail.getByRole("heading").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await capture(page, "citizen-desktop");
});
