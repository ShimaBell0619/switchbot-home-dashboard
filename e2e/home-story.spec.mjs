import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const widths = [
  { name: "narrow", width: 320, height: 800 },
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 1000 },
];

for (const viewport of widths) {
  test(`Home Story and trends render at ${viewport.width}px without horizontal overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    for (const path of ["/", "/trends"]) {
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBe(200);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.getByRole("navigation", { name: "表示期間" })).toBeVisible();
      await expect(page.locator("main h1")).toBeVisible();

      const overflow = await page.evaluate(() => ({
        document: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }));
      expect(overflow.document, `${viewport.width}px: ${path} overflow`).toBeLessThanOrEqual(
        overflow.viewport,
      );
      mkdirSync("screenshots", { recursive: true });
      await page.screenshot({
        path: `screenshots/${viewport.name}-${path === "/" ? "today" : "trends"}.png`,
        fullPage: true,
      });
    }
  });
}

test("trends show stored observations and support keyboard navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto("/trends");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "この7日間の記録" })).toBeVisible();
  await expect(page.getByText(/7日間のうち\d日で観測/)).toBeVisible();
  await expect(page.getByRole("status")).not.toContainText("$");
  await expect(page.locator("main ol > li")).toHaveCount(7);

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "今日" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "7日間" })).toBeVisible();

  await page.getByRole("link", { name: "7日間" }).click();
  await expect(page).toHaveURL(/\/trends$/);
});
