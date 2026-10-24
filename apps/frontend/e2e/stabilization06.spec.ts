import { expect, test, type Page } from "@playwright/test";
import { selectStudioText } from "./studio-controls";
import { expectActivityTotal } from "./calendar-period";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const course = "stabilization06";
const base = `/courses/${course}/lessons`;

test("heatmap consultation displays a real visit without recording another activity", async ({
  page,
}) => {
  await page.goto(`${base}/reading`);
  await expect(page.locator(".lesson-heading h1")).toHaveText(
    "Lição de verificação",
  );
  await page
    .getByRole("link", { name: "BunkerCode — Início", exact: true })
    .click();
  await expectActivityTotal(page, 1);
  const today = page.locator(".heatmap-day").last();
  await today.click();
  await expect(page.getByRole("tooltip")).toContainText("1 atividade em");
  await expect(page.getByRole("tooltip")).not.toContainText("Sem atividade");
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("tooltip")).toContainText("0 atividades em");
  await page.keyboard.press("Escape");
  await expectActivityTotal(page, 1);
});

test.beforeAll(async () => {
  const content = process.env.BUNKERCODE_BROWSER_CONTENT_DIR!;
  const root = join(content, "courses", course);
  for (const slug of ["reading", "practice", "selection"]) {
    await mkdir(join(root, "lessons", slug), { recursive: true });
    await writeFile(
      join(root, "lessons", slug, "lesson.md"),
      "# Lição de verificação\n\n## Contexto\n\n" +
        "Texto de fixture para verificar leitura e rolagem independente.\n\n".repeat(
          50,
        ) +
        "```javascript\n" +
        "const long = '" +
        "x".repeat(300) +
        "';\n```\n",
    );
  }
  await writeFile(
    join(root, "lessons/selection/lesson.md"),
    "# Seleção\n\nUma explicação com referência e autoria.\n",
  );
  await writeFile(
    join(root, "course.json"),
    JSON.stringify({
      id: course,
      title: "Curso de verificação com título editorial extenso",
      description: "Fixture temporária de geometria.",
      lessons: [
        { slug: "reading", title: "Lição de verificação" },
        { slug: "practice", title: "Prática de verificação" },
        { slug: "selection", title: "Seleção" },
      ],
    }),
  );
  await writeFile(
    join(root, "lessons/practice/exercise.json"),
    await readFile(
      join(
        content,
        "courses/typescript/lessons/values-and-types/exercise.json",
      ),
    ),
  );
});

async function geometry(page: Page) {
  return page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    document: {
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    },
    candidates: [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((node) => {
        const r = node.getBoundingClientRect();
        return r.width > 0 && (r.right > innerWidth + 0.5 || r.left < -0.5);
      })
      .slice(0, 15)
      .map((node) => ({
        tag: node.tagName,
        class: node.className,
        left: node.getBoundingClientRect().left,
        right: node.getBoundingClientRect().right,
      })),
  }));
}

test("360px routes expose their actual overflow geometry", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const observations = [];
  for (const path of [
    "/",
    "/courses",
    `/courses/${course}`,
    `${base}/reading`,
    `${base}/practice`,
    "/tactics",
    `${base}/reading/edit`,
  ]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    if (path.includes("/lessons/"))
      await expect(
        page
          .getByRole("heading", { name: "Lição de verificação", exact: true })
          .first(),
      ).toBeAttached();
    if (path.endsWith("/practice")) {
      await page.getByRole("button", { name: "Código", exact: true }).click();
      await expect(
        page.getByRole("textbox", { name: "Código da solução", exact: true }),
      ).toBeVisible();
    }
    const value = await geometry(page);
    observations.push({ path, ...value });
    await info.attach(`geometry-${observations.length}`, {
      body: JSON.stringify(observations.at(-1), null, 2),
      contentType: "application/json",
    });
    expect(value.document.width, JSON.stringify(observations.at(-1))).toBe(360);
  }
  console.log("MOBILE_GEOMETRY", JSON.stringify(observations));
});

test("reader measure follows the approved 75 character contract across fonts, panes and resize", async ({
  page,
}, info) => {
  const measurements = [];
  for (const practice of [false, true]) {
    await page.goto(`${base}/${practice ? "practice" : "reading"}`);
    await expect(page.locator(".study-explanation > .prose")).toBeVisible();
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [390, 844],
      [360, 800],
      [1440, 900],
    ]) {
      await page.setViewportSize({ width: width!, height: height! });
      for (const font of ["system-ui", "monospace"]) {
        await page.locator(".study-explanation").evaluate((node, font) => {
          node.style.fontFamily = font;
        }, font);
        await page
          .locator(".study-explanation")
          .evaluate((node) => node.style.setProperty("--prose-size", "21px"));
        const value = await page
          .locator(".study-explanation > .prose")
          .evaluate((node) => {
            const style = getComputedStyle(node);
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d")!;
            context.font = `${style.fontSize} ${style.fontFamily}`;
            const parent = node.parentElement!;
            const padding = getComputedStyle(parent);
            return {
              width: node.getBoundingClientRect().width,
              limit: context.measureText("0").width * 75,
              font: style.font,
              available:
                parent.clientWidth -
                parseFloat(padding.paddingLeft) -
                parseFloat(padding.paddingRight),
              documentWidth: document.documentElement.scrollWidth,
              documentHeight: document.documentElement.scrollHeight,
            };
          });
        measurements.push({ practice, viewport: { width, height }, ...value });
        expect(value.width).toBeLessThanOrEqual(
          Math.min(value.limit, value.available) + 1,
        );
        expect(value.documentWidth).toBe(width);
        expect(value.documentHeight).toBe(height);
      }
    }
  }
  console.log("READER_MEASURE", JSON.stringify(measurements));
  await info.attach("reader-measure.json", {
    body: JSON.stringify(measurements, null, 2),
    contentType: "application/json",
  });
});

test("logical selection stays exact when the old visual-line setup chooses a wrapped line", async ({
  page,
}) => {
  const observations = [];
  for (const width of [1440, 1280, 390, 360]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`${base}/selection/edit`);
    const paragraph = page.locator(".visual-document p").first();
    await expect(paragraph).toHaveText(
      "Uma explicação com referência e autoria.",
    );
    await paragraph.click();
    await page.keyboard.press("Home");
    for (let i = 0; i < 19; i++) await page.keyboard.press("ArrowRight");
    for (let i = 0; i < 10; i++) await page.keyboard.press("Shift+ArrowRight");
    const legacy = await page.evaluate(() => ({
      text: getSelection()?.toString(),
      anchor: getSelection()?.anchorOffset,
      focus: getSelection()?.focusOffset,
    }));
    await selectStudioText(paragraph, "referência");
    observations.push({
      width,
      legacy,
      logical: await page.evaluate(() => getSelection()?.toString()),
    });
  }
  console.log("SELECTION_DIAGNOSIS", JSON.stringify(observations));
});

for (const [width, height] of [
  [1440, 900],
  [1280, 800],
  [390, 844],
  [360, 800],
])
  test(`heatmap contextual mouse and keyboard details at ${width}x${height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: width!, height: height! });
    await page.goto("/");
    const current = page.locator('.heatmap-day[tabindex="0"]');
    await expect(current).toBeVisible();
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await current.hover();
    await expect(page.getByRole("tooltip")).toContainText(
      "Sem atividade registrada.",
    );
    const hoverCell = (await current.boundingBox())!;
    await page.mouse.move(
      hoverCell.x + hoverCell.width / 2,
      hoverCell.y + hoverCell.height + 4,
    );
    await page.getByRole("tooltip").hover();
    await expect(page.getByRole("tooltip")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await current.focus();
    await expect(page.getByRole("tooltip")).toContainText("0 atividades");
    const firstDay = await current.getAttribute("data-day");
    await page.keyboard.press("ArrowLeft");
    const focused = page.locator(".heatmap-day:focus");
    expect(await focused.getAttribute("data-day")).not.toBe(firstDay);
    await expect(page.getByRole("tooltip")).toHaveText(
      (await focused.getAttribute("aria-label"))! + "Sem atividade registrada.",
    );
    await page.screenshot({ path: info.outputPath(`heatmap-${width}.png`) });
    await page.getByRole("heading", { name: "Cursos disponíveis" }).click();
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    await page.goto(`${base}/selection/edit`);
    await expect(page.locator(".visual-document")).toBeVisible();
    await selectStudioText(
      page.locator(".visual-document p").first(),
      "referência",
    );
    await page.getByRole("button", { name: "Link", exact: true }).click();
    await expect(page.getByRole("form", { name: "Editar link" })).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`studio-selection-${width}.png`),
    });
  });

for (const width of [390, 360])
  test(`touch heatmap has separate targets and contextual data at ${width}px`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 800 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    try {
      await page.goto("http://127.0.0.1:5184/");
      const day = page.locator(".heatmap-day").first();
      await expect(day).toBeVisible();
      const box = (await day.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(24);
      expect(box.height).toBeGreaterThanOrEqual(24);
      await day.tap();
      await expect(page.getByRole("tooltip")).toContainText(
        "Sem atividade registrada.",
      );
      const tooltip = (await page.getByRole("tooltip").boundingBox())!;
      expect(tooltip.x).toBeGreaterThanOrEqual(0);
      expect(tooltip.x + tooltip.width).toBeLessThanOrEqual(width);
      const neighbor = page.locator(".heatmap-day").nth(1);
      const neighborBox = (await neighbor.boundingBox())!;
      expect(neighborBox.y).toBeGreaterThanOrEqual(box.y + box.height);
      await neighbor.tap();
      await expect(neighbor).toHaveAttribute(
        "aria-describedby",
        "activity-day-details",
      );
      await page.locator(".heatmap-day").last().focus();
      await expect(page.getByRole("tooltip")).toContainText("0 atividades");
      await page.keyboard.press("ArrowLeft");
      await expect(page.getByRole("tooltip")).toContainText("0 atividades");
      expect(
        await page
          .locator(".activity-dashboard")
          .evaluate((node) => node.getBoundingClientRect().height),
      ).toBeLessThan(230);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(page.getByRole("tooltip")).toContainText("0 atividades");
      // Scroll events reposition the fixed detail; capture only its settled geometry.
      await expect
        .poll(async () => {
          const cell = (await page
            .locator(".heatmap-day:focus")
            .boundingBox())!;
          const detail = (await page.getByRole("tooltip").boundingBox())!;
          return Math.abs(detail.y - cell.y - cell.height);
        })
        .toBeLessThan(24);
      await page.screenshot({
        path: info.outputPath(`heatmap-touch-${width}.png`),
      });
      await page.getByRole("heading", { name: "Cursos disponíveis" }).tap();
      await expect(page.getByRole("tooltip")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
