import { expect, test } from "@playwright/test";

const practice = "/courses/typescript/lessons/values-and-types";
const reading = "/courses/typescript/lessons/union-types";

for (const width of [390, 1280, 1440, 1920]) {
  test(`header, appearance and panel geometry at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 960 });
    for (const [url, programming] of [
      [reading, false],
      [practice, true],
    ] as const) {
      await page.goto(url);
      await expect(page.locator(".lesson-heading h1")).toBeVisible();
      if (programming)
        await expect(page.locator(".practice-panel")).toBeVisible();
      const header = page.locator(".site-header");
      const home = header.getByRole("link", {
        name: "BunkerCode — Início",
        exact: true,
      });
      await expect(home.locator("img")).toBeVisible();
      const homeBox = await home.boundingBox();
      expect(homeBox!.width).toBeGreaterThanOrEqual(44);
      expect(homeBox!.height).toBeGreaterThanOrEqual(44);
      await expect(
        header.getByRole("button", { name: "Lições", exact: true }),
      ).toBeVisible();
      await expect(header.locator(".header-course")).toHaveAttribute(
        "href",
        "/courses/typescript",
      );
      await expect(
        page.locator(".lesson-context, .lesson-pagination"),
      ).toHaveCount(0);
      await expect(
        page.getByRole("navigation", { name: "Navegação entre lições" }),
      ).toHaveCount(1);
      const appearance = page.getByRole("button", {
        name: "Aparência da leitura",
        exact: true,
      });
      await appearance.click();
      await page.getByLabel("Tonalidade", { exact: true }).selectOption("2");
      await page.keyboard.press("Escape");
      await expect(appearance).toBeFocused();
      await expect(appearance).toHaveAttribute("aria-expanded", "false");
      await page.reload();
      await expect(page.locator(".study-explanation")).toHaveClass(
        /reading-tone-2/,
      );
      const divider = page.getByRole("separator");
      if (width >= 1000) {
        await expect(divider).toBeVisible();
        const panel = page.locator(".study-explanation");
        const initial = await panel.boundingBox();
        const handle = await divider.boundingBox();
        await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + 30);
        await page.mouse.down();
        // The handle must remain captured, even outside its original hitbox.
        await page.mouse.move(
          handle!.x + handle!.width / 2 - 80,
          handle!.y + 30,
          { steps: 20 },
        );
        await page.mouse.up();
        expect(initial!.width - (await panel.boundingBox())!.width).toBeCloseTo(
          80,
          0,
        );
        const saved = await divider.getAttribute("aria-valuenow");
        await page.reload();
        await expect(divider).toHaveAttribute("aria-valuenow", saved!);
        await divider.focus();
        await page.keyboard.press("End");
        const right = await page
          .locator(programming ? ".study-code" : ".study-outline")
          .boundingBox();
        expect(right!.width).toBeGreaterThanOrEqual(programming ? 359 : 179);
        await page.keyboard.press("Home");
        expect((await panel.boundingBox())!.width).toBeGreaterThanOrEqual(
          programming ? 359 : 419,
        );
        await page.keyboard.press("Enter");
        await expect(divider).toHaveAttribute(
          "aria-valuenow",
          programming ? "46" : "74",
        );
      } else await expect(divider).not.toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width === 1440 || (width === 390 && programming))
        await page.screenshot({
          path: info.outputPath(
            programming ? `programming-${width}.png` : `reader-${width}.png`,
          ),
          fullPage: true,
        });
    }
  });
}
