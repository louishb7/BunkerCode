import { expect, test } from "@playwright/test";
for (const width of [390, 1280, 1440, 1920])
  test(`integrated workspace navigation and horizontal dimensions at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/courses/typescript/lessons/values-and-types");
    const switcher = page.getByRole("button", { name: "Código", exact: true });
    await expect(page.locator(".cm-editor")).toHaveCount(1);
    if (await switcher.isVisible()) await switcher.click();
    await expect(
      page.getByRole("textbox", { name: "Código da solução", exact: true }),
    ).toBeVisible();
    const header = page.locator(".site-header");
    await expect(
      header.getByRole("link", { name: "Início", exact: true }),
    ).toBeVisible();
    await expect(
      header.getByRole("link", { name: "Abrir curso TypeScript", exact: true }),
    ).toHaveCount(0);
    await expect(
      header.getByRole("button", { name: "Lições", exact: true }),
    ).toHaveCount(0);
    const navigation = page.locator(
      ".lesson-navigation-bar .workspace-navigation",
    );
    await expect(navigation).toBeVisible();
    await expect(
      navigation.getByRole("button", { name: "Lição anterior", exact: true }),
    ).toBeDisabled();
    await expect(
      page.locator(".lesson-pagination,.lesson-context"),
    ).toHaveCount(0);
    expect(
      await page
        .locator(".programming-split")
        .evaluate((e) => getComputedStyle(e).columnGap),
    ).toBe("0px");
    const divider = page.getByRole("separator", {
      name: "Largura do artigo e editor",
      exact: true,
    });
    if (width >= 1000) {
      const before = await page.locator(".study-explanation").boundingBox();
      const box = await divider.boundingBox();
      await page.mouse.move(box!.x + box!.width / 2, box!.y + 80);
      await page.mouse.down();
      await page.mouse.move(box!.x + box!.width / 2 - 70, box!.y + 80, {
        steps: 12,
      });
      await page.mouse.up();
      expect(
        before!.width -
          (await page.locator(".study-explanation").boundingBox())!.width,
      ).toBeCloseTo(70, 0);
      const saved = await divider.getAttribute("aria-valuenow");
      await page.reload();
      await expect(divider).toHaveAttribute("aria-valuenow", saved!);
      await divider.focus();
      await page.keyboard.press("Enter");
      await expect(divider).toHaveAttribute("aria-valuenow", "55");
    } else await expect(divider).not.toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await navigation
      .getByRole("link", { name: "Próxima lição", exact: true })
      .click();
    await expect(page.locator(".lesson-heading h1")).toHaveText("Union types");
    await expect(
      page.getByRole("navigation", {
        name: "Navegação entre lições",
        exact: true,
      }),
    ).toHaveCount(1);
    await page.screenshot({
      path: info.outputPath(`phase-a-${width}.png`),
      fullPage: true,
    });
  });

test("workspace width defaults safely and preserves valid stored proportions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/courses/typescript/lessons/values-and-types");
  const divider = page.getByRole("separator", {
    name: "Largura do artigo e editor",
    exact: true,
  });
  for (const saved of [null, "", "invalid", "-1", "101", "0", "100", "65"]) {
    await page.evaluate((value) => {
      if (value === null) localStorage.removeItem("bunkercode:practice-width");
      else localStorage.setItem("bunkercode:practice-width", value);
    }, saved);
    await page.reload();
    const expected = saved === "65" ? 65 : 55;
    await expect(divider).toHaveAttribute("aria-valuenow", String(expected));
    const reading = (await page.locator(".study-explanation").boundingBox())!;
    const code = (await page.locator(".study-code").boundingBox())!;
    expect(reading.width / (reading.width + code.width)).toBeCloseTo(
      expected / 100,
      3,
    );
    expect(
      await page.evaluate(() =>
        localStorage.getItem("bunkercode:practice-width"),
      ),
    ).toBe(saved);
  }
});
