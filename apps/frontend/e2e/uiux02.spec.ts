import { selectSiteTheme } from "./reading-theme-checks";
import {
  checkGlobalAppearance,
  checkThemeHierarchy,
} from "./reading-theme-checks";
import { selectReadingTone } from "./reading-theme-checks";
import { checkReadingThemes, readingViewports } from "./reading-theme-checks";
import { expect, test } from "./auth-fixture";

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
      await expect(page.locator(".lesson-nav-course")).toHaveCount(0);
      await expect(header.locator(".header-global-nav a")).toHaveText([
        "Início",
        "Cursos",
        "Táticas",
      ]);
      await expect(
        page.locator(".lesson-context, .lesson-pagination"),
      ).toHaveCount(0);
      await expect(
        page.getByRole("navigation", { name: "Navegação entre lições" }),
      ).toHaveCount(1);
      const appearance = page.getByRole("button", {
        name: "Ajustar leitura",
        exact: true,
      });
      await appearance.click();
      await selectReadingTone(page, 2);
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
        await expect(divider).toHaveAttribute("aria-valuenow", "55");
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
  await page.evaluate(() =>
    localStorage.setItem("bunkercode:site-theme", "light"),
  );
  for (const saved of [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "invalid",
    "1.5",
    "99",
    "-1",
  ]) {
    await page.evaluate(
      (value) => localStorage.setItem("bunkercode:reading-tone", value),
      saved,
    );
    await page.reload();
    const expected = ["0", "1", "2", "3", "4", "5"].includes(saved)
      ? saved
      : "3";
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
    .getByRole("button", { name: "Ajustar leitura", exact: true })
    .click();
  await selectSiteTheme(page, "light");
  await expect(page.locator("html")).toHaveCSS(
    "background-color",
    "rgb(244, 244, 245)",
  );
  await selectReadingTone(page, 3);
  await expect(page.locator(".study-explanation")).toHaveClass(
    /reading-tone-3/,
  );
  await expect(
    page.locator("#reading-appearance-panel").getByRole("status"),
  ).toHaveCount(1);
  await expect(
    page.locator("#reading-appearance-panel").getByRole("status").first(),
  ).toContainText("armazenamento indisponível");
  await page.getByRole("button", { name: "Tema do site", exact: true }).click();
  await expect(
    page.locator("#site-appearance-panel").getByRole("status"),
  ).toContainText("armazenamento indisponível");
  await page.reload();
  await expect(page.locator(".study-explanation")).toHaveClass(
    /reading-tone-0/,
  );
});

for (const viewport of readingViewports) {
  test(`global appearance across routes at ${viewport.width}x${viewport.height}`, async ({
    page,
  }, info) => {
    test.setTimeout(90000);
    await page.setViewportSize(viewport);
    await checkGlobalAppearance(page, info, true);
  });
  test(`global and reading inheritance preserve drafts at ${viewport.width}x${viewport.height}`, async ({
    page,
  }, info) => {
    test.setTimeout(90000);
    await page.setViewportSize(viewport);
    await checkThemeHierarchy(page, info, true);
  });
}

test("invalid global preferences use the historical default without deleting data", async ({
  page,
}) => {
  await page.goto("/");
  for (const saved of ["invalid", "0", "LIGHT", ""]) {
    await page.evaluate(
      (value) => localStorage.setItem("bunkercode:site-theme", value),
      saved,
    );
    await page.reload();
    await expect(page.locator("html")).toHaveCSS(
      "background-color",
      "rgb(32, 35, 40)",
    );
    expect(
      await page.evaluate(() => localStorage.getItem("bunkercode:site-theme")),
    ).toBe(saved);
  }
});

test("lesson arrival preserves focus inside the appearance panel", async ({
  page,
}) => {
  let release: () => void = () => undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested = false;
  await page.route(
    /\/api\/content\/courses\/typescript\/lessons\/union-types$/,
    async (route) => {
      requested = true;
      await pending;
      await route.continue();
    },
  );
  await page.goto(reading);
  await expect.poll(() => requested).toBe(true);
  const appearance = page.getByRole("button", {
    name: "Tema do site",
    exact: true,
  });
  await appearance.click();
  await page.getByRole("button", { name: "Light", exact: true }).click();
  const choice = page
    .getByRole("group", { name: "Tema do site", exact: true })
    .getByRole("button", { name: "Light", exact: true });
  await expect(choice).toBeFocused();
  release();
  await expect(page.locator(".lesson-heading h1")).toHaveText("Union types");
  await expect(choice).toBeFocused();
  await expect(appearance).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(appearance).toBeFocused();
});
