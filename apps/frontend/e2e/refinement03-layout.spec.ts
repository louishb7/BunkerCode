import { expect, test } from "@playwright/test";
for (const width of [390, 1280, 1440, 1920])
  test(`integrated workspace navigation and horizontal dimensions at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/courses/typescript/lessons/values-and-types");
    await expect(
      page.getByRole("textbox", { name: "Código da solução", exact: true }),
    ).toBeVisible();
    const header = page.locator(".site-header");
    await expect(
      header.getByRole("link", { name: "Início", exact: true }),
    ).toBeVisible();
    await expect(
      header.getByRole("link", { name: "Abrir curso TypeScript", exact: true }),
    ).toBeVisible();
    await expect(
      header.getByRole("button", { name: "Lições", exact: true }),
    ).toHaveCount(0);
    const navigation = page.locator(
      ".programming-workspace .workspace-navigation",
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
      await expect(divider).toHaveAttribute("aria-valuenow", "46");
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
