import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const lesson = "/courses/typescript/lessons/values-and-types";
const fixture = "/courses/workspace-fixture/lessons/long-lesson";
const code = (page: Page) =>
  page.getByRole("textbox", { name: "Código da solução", exact: true });
async function openCode(page: Page) {
  await expect(page.locator(".practice-panel")).toHaveCount(1);
  const switcher = page.getByRole("button", { name: "Código", exact: true });
  if (await switcher.isVisible()) await switcher.click();
  await expect(code(page)).toBeVisible();
}
async function contained(page: Page) {
  expect(
    await page.evaluate(() => ({
      height: document.documentElement.scrollHeight,
      width: document.documentElement.scrollWidth,
      viewportHeight: innerHeight,
      viewportWidth: innerWidth,
      scroll: scrollY,
    })),
  ).toEqual(
    expect.objectContaining({
      height: (await page.viewportSize())!.height,
      width: (await page.viewportSize())!.width,
      scroll: 0,
    }),
  );
  const footer = (await page.locator(".learning-footer").boundingBox())!;
  expect(footer.y + footer.height).toBe((await page.viewportSize())!.height);
}

test.beforeAll(async () => {
  const content = process.env.BUNKERCODE_BROWSER_CONTENT_DIR!;
  const root = join(content, "courses/workspace-fixture");
  await mkdir(join(root, "lessons/long-lesson"), { recursive: true });
  await mkdir(join(root, "lessons/last-lesson"), { recursive: true });
  await writeFile(
    join(root, "course.json"),
    JSON.stringify({
      id: "workspace-fixture",
      title: "Curso de workspace com um nome editorial extenso",
      description: "Fixture isolada.",
      lessons: [
        { slug: "long-lesson", title: "Lição extensa" },
        { slug: "last-lesson", title: "Última lição" },
      ],
    }),
  );
  const paragraphs = Array.from(
    { length: 90 },
    (_, i) =>
      `Parágrafo ${i + 1}: conteúdo extenso para verificar a rolagem independente da leitura.`,
  ).join("\n\n");
  await writeFile(
    join(root, "lessons/long-lesson/lesson.md"),
    `# Lição extensa\n\n[Referência de navegação](/courses/typescript)\n\n${paragraphs}\n\n\`\`\`javascript\nconst longLine = "${"x".repeat(400)}";\n\`\`\`\n\nFim da lição extensa.\n`,
  );
  await writeFile(
    join(root, "lessons/last-lesson/lesson.md"),
    `# Última lição\n\n${paragraphs}\n\nFim da última lição.\n`,
  );
  await writeFile(
    join(root, "lessons/long-lesson/exercise.json"),
    await readFile(
      join(
        content,
        "courses/typescript/lessons/values-and-types/exercise.json",
      ),
    ),
  );
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
])
  test(`keyboard reaches and scrolls long reading, code and results at ${viewport.width}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport);
    await page.goto(fixture);
    await openCode(page);
    await code(page).fill(
      Array.from(
        { length: 80 },
        (_, i) => `const error${i}: number = "wrong";`,
      ).join("\n"),
    );
    await page.getByRole("button", { name: "Run", exact: true }).click();
    await expect(page.locator(".diagnostics li")).toHaveCount(80, {
      timeout: 30000,
    });
    const reading = page.getByRole("button", { name: "Lição", exact: true });
    if (await reading.isVisible()) {
      await reading.focus();
      await page.keyboard.press("Enter");
    }
    const stops: string[] = [];
    async function tabTo(selector: string) {
      for (let step = 0; step < 40; step++) {
        await page.keyboard.press("Tab");
        const result = await page.evaluate((selector) => {
          const node = document.activeElement;
          return {
            match: !!node?.matches(selector),
            label: `${node?.tagName}:${node?.getAttribute("aria-label") ?? node?.textContent?.slice(0, 45)}`,
            editor: !!node?.closest(".cm-editor"),
          };
        }, selector);
        stops.push(result.label);
        if (result.match) return;
        if (result.editor) await page.keyboard.press("Escape");
      }
      throw new Error(
        `Keyboard target not reached: ${selector}; ${stops.join(" -> ")}`,
      );
    }
    await page
      .getByRole("link", { name: "BunkerCode — Início", exact: true })
      .focus();
    await tabTo(".study-explanation a");
    const article = page.locator(".study-explanation");
    await page.keyboard.press("PageDown");
    await expect
      .poll(() => article.evaluate((node) => node.scrollTop))
      .toBeGreaterThan(0);
    await tabTo(".code-block pre");
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(() =>
        page.locator(".code-block pre").evaluate((node) => node.scrollLeft),
      )
      .toBeGreaterThan(0);
    if (await reading.isVisible()) {
      await page.getByRole("button", { name: "Código", exact: true }).focus();
      await page.keyboard.press("Enter");
    }
    await tabTo('.cm-content[contenteditable="true"]');
    await page.keyboard.press("ControlOrMeta+End");
    await expect
      .poll(() =>
        page
          .locator(".workspace-code-slot .cm-scroller")
          .evaluate((node) => node.scrollTop),
      )
      .toBeGreaterThan(0);
    await page.keyboard.press("Escape");
    await tabTo(".workspace-results summary");
    await page.keyboard.press("PageDown");
    await expect
      .poll(() =>
        page.locator(".workspace-results").evaluate((node) => node.scrollTop),
      )
      .toBeGreaterThan(0);
    await tabTo(".learning-footer a");
    console.log("KEYBOARD_SCROLL_STOPS", JSON.stringify({ viewport, stops }));
    await page.screenshot({
      path: info.outputPath(`keyboard-scroll-${viewport.width}.png`),
    });
    await contained(page);
  });

for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1280, 720],
  [390, 844],
]) {
  test(`viewport shell, compact controls and footer navigation at ${width}x${height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: width!, height: height! });
    await page.goto(lesson);
    await expect(page.locator(".lesson-heading h1")).toHaveText(
      "Valores e tipos",
    );
    await openCode(page);
    await contained(page);
    const header = page.locator(".site-header");
    await expect(header).not.toContainText("TypeScript");
    await expect(
      header.getByRole("link", { name: "Início", exact: true }),
    ).toBeVisible();
    const footer = page.locator(".learning-footer");
    await expect(
      footer.getByRole("link", { name: "Abrir curso TypeScript", exact: true }),
    ).toBeVisible();
    await expect(
      footer.getByRole("button", { name: "Lição anterior", exact: true }),
    ).toBeDisabled();
    expect(
      (await page.locator(".editor-toolbar").boundingBox())!.height,
    ).toBeLessThanOrEqual(width! < 1000 ? 45 : 34);
    expect(
      (await page.locator(".editor-actions").boundingBox())!.height,
    ).toBeLessThanOrEqual(width! < 1000 ? 52 : 38);
    if (width! < 1000)
      for (const button of await page
        .locator(".editor-actions button, .editor-toolbar button")
        .all())
        expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await footer.boundingBox())!.height).toBeGreaterThanOrEqual(56);
    expect((await footer.boundingBox())!.height).toBeLessThanOrEqual(60);
    if (width! >= 1000) {
      const article = (await page.locator(".study-explanation").boundingBox())!;
      const editor = (await page.locator(".study-code").boundingBox())!;
      expect(editor.x - article.x - article.width).toBe(1);
      expect(editor.y).toBe(article.y);
      expect(editor.y).toBe((await header.boundingBox())!.height);
      expect(article.y + article.height).toBe((await footer.boundingBox())!.y);
    }
    await page.screenshot({
      path: info.outputPath(`workspace-${width}x${height}.png`),
    });
    const positions = await footer.boundingBox();
    await footer.getByRole("button", { name: "Lições", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Lições · TypeScript" }),
    ).toBeVisible();
    await contained(page);
    expect(await footer.boundingBox()).toEqual(positions);
    if (width === 1440)
      await page.screenshot({ path: info.outputPath("lesson-menu.png") });
    await page.keyboard.press("Escape");
    await expect(
      footer.getByRole("button", { name: "Lições", exact: true }),
    ).toBeFocused();
    await footer
      .getByRole("link", { name: "Próxima lição", exact: true })
      .click();
    await expect(page.locator(".lesson-heading h1")).toHaveText("Union types");
    await contained(page);
    // Other authoring tests can append a real lesson to this disposable course.
    await footer.getByRole("button", { name: "Lições", exact: true }).click();
    const lastLesson = page.getByRole("dialog").locator("nav a").last();
    const lastPath = await lastLesson.getAttribute("href");
    await lastLesson.click();
    await expect(page).toHaveURL(lastPath!);
    await expect(
      footer.getByRole("button", { name: "Próxima lição", exact: true }),
    ).toBeDisabled();
  });
}

test("real long content, code and diagnostics scroll independently through their final lines", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(fixture);
  await openCode(page);
  const article = page.locator(".study-explanation");
  const results = page.locator(".workspace-results");
  const editorScroll = page.locator(".workspace-code-slot .cm-scroller");
  const controls = await page.locator(".editor-actions").boundingBox();
  await article.hover();
  await page.mouse.wheel(0, 400);
  await expect
    .poll(() => article.evaluate((node) => node.scrollTop))
    .toBeGreaterThan(0);
  expect(await editorScroll.evaluate((node) => node.scrollTop)).toBe(0);
  expect(await results.evaluate((node) => node.scrollTop)).toBe(0);
  const source = Array.from(
    { length: 80 },
    (_, i) => `const diagnostic${i}: number = "incompatible";`,
  ).join("\n");
  await code(page).fill(source);
  await editorScroll.evaluate((node) => {
    node.scrollTop = 0;
  });
  const readerPosition = await article.evaluate((node) => node.scrollTop);
  await editorScroll.hover();
  await page.mouse.wheel(0, 600);
  await expect
    .poll(() => editorScroll.evaluate((node) => node.scrollTop))
    .toBeGreaterThan(0);
  expect(await article.evaluate((node) => node.scrollTop)).toBe(readerPosition);
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(results).toContainText("Erros de compilação", {
    timeout: 30000,
  });
  await expect(results.locator(".diagnostics li")).toHaveCount(80);
  const editorPosition = await editorScroll.evaluate((node) => node.scrollTop);
  await results.hover();
  await page.mouse.wheel(0, 500);
  await expect
    .poll(() => results.evaluate((node) => node.scrollTop))
    .toBeGreaterThan(0);
  expect(await article.evaluate((node) => node.scrollTop)).toBe(readerPosition);
  expect(await editorScroll.evaluate((node) => node.scrollTop)).toBe(
    editorPosition,
  );
  await article.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect(
    article.getByText("Fim da lição extensa.", { exact: true }),
  ).toBeInViewport();
  await results.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect(results.locator(".diagnostics li").last()).toBeInViewport();
  expect(await page.locator(".editor-actions").boundingBox()).toEqual(controls);
  await contained(page);
  await page.getByRole("link", { name: "Próxima lição", exact: true }).click();
  await expect(page.locator(".lesson-heading h1")).toHaveText("Última lição");
  await article.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect(
    article.getByText("Fim da última lição.", { exact: true }),
  ).toBeInViewport();
  await contained(page);
});

test("divider moves both ways, limits expansion and reclamps after viewport resize without remounting", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(lesson);
  await openCode(page);
  await code(page).fill("const preserved = 42;");
  await code(page).evaluate((node) =>
    node.setAttribute("data-preserved", "yes"),
  );
  const divider = page.getByRole("separator", {
    name: "Altura do editor e resultados",
    exact: true,
  });
  const editor = page.locator(".workspace-editor");
  const results = page.locator(".workspace-results");
  for (const shift of [-100, 150]) {
    const before = (await editor.boundingBox())!.height;
    const box = (await divider.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2,
      box.y + box.height / 2 + shift,
      { steps: 10 },
    );
    await page.mouse.up();
    expect((await editor.boundingBox())!.height - before).toBeCloseTo(shift, 0);
    await expect(code(page)).toHaveAttribute("data-preserved", "yes");
    await contained(page);
  }
  const ratio = await divider.getAttribute("aria-valuenow");
  await page
    .getByRole("button", { name: "Histórico do código", exact: true })
    .click();
  await expect(divider).toHaveAttribute("aria-valuenow", ratio!);
  await page
    .getByRole("button", { name: "Histórico do código", exact: true })
    .click();
  await divider.focus();
  await divider.press("Home");
  expect((await editor.boundingBox())!.height).toBeGreaterThanOrEqual(139);
  expect((await editor.boundingBox())!.height).toBeLessThan(141);
  await page.screenshot({ path: info.outputPath("terminal-expanded.png") });
  await divider.press("End");
  expect((await results.boundingBox())!.height).toBeGreaterThanOrEqual(119);
  expect((await results.boundingBox())!.height).toBeLessThan(121);
  await page.screenshot({ path: info.outputPath("editor-expanded.png") });
  await page.setViewportSize({ width: 1280, height: 400 });
  // At 400px high, the larger footer reduces the space shared by code/results.
  // Both panes must split the actual remaining space, without hiding controls.
  const shortHalf = await page.locator(".workspace-panels").evaluate((node) => {
    const tabs = node.querySelector(".editor-toolbar")!;
    const actions = node.querySelector(".editor-actions")!;
    return (
      (node.getBoundingClientRect().height -
        tabs.getBoundingClientRect().height -
        actions.getBoundingClientRect().height) /
      2
    );
  });
  expect(shortHalf).toBeGreaterThan(100);
  await expect
    .poll(async () =>
      Math.abs((await results.boundingBox())!.height - shortHalf),
    )
    .toBeLessThan(1);
  expect((await editor.boundingBox())!.height).toBeCloseTo(shortHalf, 0);
  await expect(
    page.getByRole("button", { name: "Run", exact: true }),
  ).toBeInViewport();
  await contained(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openCode(page);
  await expect(code(page)).toHaveAttribute("data-preserved", "yes");
  await expect(code(page)).toContainText("preserved");
  await contained(page);
});

test("long course labels and busy actions remain contained on a short mobile viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 500 });
  await page.goto(fixture);
  await expect(page.locator(".lesson-heading h1")).toHaveText("Lição extensa");
  await contained(page);
  await openCode(page);
  await code(page).fill(
    "function isAvailable(stock: number): boolean { return stock > 0; }",
  );
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Registrando…", exact: true }),
  ).toBeVisible();
  await contained(page);
  const buttons = await page
    .locator(".editor-actions button")
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        left: node.getBoundingClientRect().left,
        right: node.getBoundingClientRect().right,
      })),
    );
  for (const box of buttons) {
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(360);
  }
  await expect(page.getByText(/Solução registrada em/)).toBeVisible({
    timeout: 30000,
  });
  await contained(page);
});

test("browser Back restores the lesson's internal scroll after the practice loads again", async ({
  page,
}) => {
  await page.goto(fixture);
  await openCode(page);
  const article = page.locator(".study-explanation");
  await article.evaluate((node) => {
    node.scrollTop = 600;
  });
  await expect.poll(() => article.evaluate((node) => node.scrollTop)).toBe(600);
  await page.getByRole("link", { name: "Próxima lição", exact: true }).click();
  await expect(page.locator(".lesson-heading h1")).toHaveText("Última lição");
  await expect.poll(() => article.evaluate((node) => node.scrollTop)).toBe(0);
  await page.goBack();
  await openCode(page);
  await expect.poll(() => article.evaluate((node) => node.scrollTop)).toBe(600);
  await expect(page.locator(".lesson-heading h1")).toBeFocused();
  await contained(page);
});
