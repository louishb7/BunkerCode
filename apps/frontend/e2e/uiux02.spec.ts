import { checkReadingThemes, readingViewports } from "./reading-theme-checks";
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
        await expect(page.locator(".practice-panel")).toHaveCount(1);
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
        page
          .locator(".workspace-navigation")
          .getByRole("button", { name: "Lições", exact: true }),
      ).toBeVisible();
      await expect(page.locator(".footer-course")).toHaveAttribute(
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
      const divider = page.getByRole("separator", {
        name: "Largura do artigo e editor",
        exact: true,
      });
      if (programming && width >= 1000) {
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
        const right = await page.locator(".study-code").boundingBox();
        expect(right!.width).toBeGreaterThanOrEqual(359);
        await page.keyboard.press("Home");
        expect((await panel.boundingBox())!.width).toBeGreaterThanOrEqual(359);
        await page.keyboard.press("Enter");
        await expect(divider).toHaveAttribute("aria-valuenow", "46");
      } else {
        await expect(divider).not.toBeVisible();
        if (!programming) {
          await expect(
            page.locator(".study-outline, .study-divider"),
          ).toHaveCount(0);
          const article = await page
            .locator(".study-explanation")
            .boundingBox();
          const split = await page.locator(".study-split").boundingBox();
          // Scrollbars consume clientWidth inside the full-width panel.
          expect(article!.width).toBeCloseTo(split!.width, 1);
        }
      }
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

for (const viewport of readingViewports) {
  test(`six reading themes, contrast and persistence at ${viewport.width}x${viewport.height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport);
    await checkReadingThemes(page, info);
  });
}

test("legacy and invalid reading preferences remain safe without rewriting storage", async ({
  page,
}) => {
  await page.goto(reading);
  for (const saved of ["0", "1", "2", "invalid", "1.5", "99", "-1"]) {
    await page.evaluate(
      (value) => localStorage.setItem("bunkercode:reading-tone", value),
      saved,
    );
    await page.reload();
    const expected = ["0", "1", "2"].includes(saved) ? saved : "0";
    await expect(page.locator(".study-explanation")).toHaveClass(
      new RegExp(`reading-tone-${expected}\\b`),
    );
    expect(
      await page.evaluate(() =>
        localStorage.getItem("bunkercode:reading-tone"),
      ),
    ).toBe(saved);
  }
});

test("reading appearance stays usable when local storage is denied", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, "getItem", {
      value() {
        throw new Error("Storage denied");
      },
    });
    Object.defineProperty(Storage.prototype, "setItem", {
      value() {
        throw new Error("Storage denied");
      },
    });
  });
  await page.goto(reading);
  await expect(page.locator(".study-explanation")).toHaveClass(
    /reading-tone-0/,
  );
  await page
    .getByRole("button", { name: "Aparência da leitura", exact: true })
    .click();
  await page.getByLabel("Tonalidade", { exact: true }).selectOption("3");
  await expect(page.locator(".study-explanation")).toHaveClass(
    /reading-tone-3/,
  );
  await expect(
    page.locator("#reading-appearance").getByRole("status"),
  ).toContainText("armazenamento indisponível");
  await page.reload();
  await expect(page.locator(".study-explanation")).toHaveClass(
    /reading-tone-0/,
  );
});
