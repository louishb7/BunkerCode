import { expect, type Page } from "@playwright/test";

// Broad checks shared by integration flows; fixed boundary cases live in refinement06.
export async function expectSixMonthCalendar(page: Page) {
  const cells = page.locator(".heatmap-day");
  await expect(cells.last()).toBeVisible();
  const days = await cells.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-day")!),
  );
  expect(days.length).toBeGreaterThanOrEqual(182);
  expect(days.length).toBeLessThanOrEqual(185);
  expect(new Set(days).size).toBe(days.length);
  const today = await page.evaluate(() => {
    const date = new Date();
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  });
  expect(days.at(-1)).toBe(today);
  for (let index = 1; index < days.length; index++)
    expect(Date.parse(days[index]!) - Date.parse(days[index - 1]!)).toBe(
      86_400_000,
    );
}
