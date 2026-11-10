import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("home page works on a phone and has no accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Tummy Time" })).toBeVisible();
  await expect(page.getByText("Server is reachable")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  expect(results.violations).toEqual([]);
});
