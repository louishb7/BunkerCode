import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
  { width: 320, height: 800 },
  { width: 720, height: 450 },
])
  test(`panel presets preserve the editor and preferences at ${viewport.width}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    if (viewport.width === 720) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        ...viewport,
        deviceScaleFactor: 2,
        mobile: false,
      });
      console.log("REFLOW_200", {
        cssViewport: viewport,
        deviceScaleFactor: 2,
        nativeBrowserZoom: false,
      });
    }
    await page.goto("/courses/typescript/lessons/values-and-types");
    await expect(page.locator(".cm-editor")).toHaveCount(1);
    const switcher = page.getByRole("button", { name: "Código", exact: true });
    if (await switcher.isVisible()) await switcher.click();
    const editor = page.getByRole("textbox", {
      name: "Código da solução",
      exact: true,
    });
    await editor.fill("const preservedPreset = 42;");
    await editor.press("ControlOrMeta+a");
    const selection = await page.evaluate(() => getSelection()?.toString());
    await editor.evaluate((node) =>
      node.setAttribute("data-preserved-preset", "yes"),
    );
    await page.screenshot({
      path: info.outputPath(`panels-before-${viewport.width}.png`),
    });
    const trigger = page.getByRole("button", {
      name: "Ajustar painéis",
      exact: true,
    });
    await trigger.click();
    const settings = page.getByRole("group", {
      name: "Proporções dos painéis",
      exact: true,
    });
    await expect(settings).toBeVisible();
    const height = settings.getByRole("group", { name: "Altura", exact: true });
    await height
      .getByRole("button", { name: "Mais resultados", exact: true })
      .click();
    await expect(
      height.getByRole("button", { name: "Mais resultados", exact: true }),
    ).toBeFocused();
    const divider = page.getByRole("separator", {
      name: "Altura do editor e resultados",
      exact: true,
    });
    const expectedRatio = String(
      Math.max(
        Number(await divider.getAttribute("aria-valuemin")),
        Math.min(Number(await divider.getAttribute("aria-valuemax")), 35),
      ),
    );
    await expect(divider).toHaveAttribute("aria-valuenow", expectedRatio);
    await expect(editor).toHaveAttribute("data-preserved-preset", "yes");
    await expect(editor).toContainText("preservedPreset");
    if (viewport.width >= 1000) {
      await settings
        .getByRole("group", { name: "Largura", exact: true })
        .getByRole("button", { name: "Mais leitura", exact: true })
        .click();
      await expect(
        page.getByRole("separator", {
          name: "Largura do artigo e editor",
          exact: true,
        }),
      ).toHaveAttribute("aria-valuenow", "65");
    } else
      await expect(
        settings.getByRole("group", { name: "Largura", exact: true }),
      ).not.toBeVisible();
    await page.screenshot({
      path: info.outputPath(`panels-presets-${viewport.width}.png`),
    });
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(settings).toHaveCount(0);
    await editor.focus();
    expect(await page.evaluate(() => getSelection()?.toString())).toBe(
      selection,
    );
    await page.keyboard.press("ControlOrMeta+z");
    await expect(editor).not.toContainText("preservedPreset");
    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+Shift+z" : "Control+y",
    );
    await expect(editor).toContainText("preservedPreset");
    await page.reload();
    await expect(page.locator(".cm-editor")).toHaveCount(1);
    if (await switcher.isVisible()) await switcher.click();
    await expect(editor).toContainText("preservedPreset");
    await expect(divider).toHaveAttribute("aria-valuenow", expectedRatio);
    if (viewport.width >= 1000)
      await expect(
        page.getByRole("separator", {
          name: "Largura do artigo e editor",
          exact: true,
        }),
      ).toHaveAttribute("aria-valuenow", "65");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(viewport.width);
  });
for (const width of [390, 1280, 1440, 1920])
  test(`results, independent vertical dimensions and reading theme at ${width}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/courses/typescript/lessons/values-and-types");
    const editor = page.getByRole("textbox", {
      name: "Código da solução",
      exact: true,
    });
    await expect(page.locator(".cm-editor")).toHaveCount(1);
    const switcher = page.getByRole("button", { name: "Código", exact: true });
    if (await switcher.isVisible()) await switcher.click();
    await expect(editor).toBeVisible();
    await expect(
      page.getByText("Aguardando execução", { exact: true }),
    ).toBeVisible();
    const buttons = page
      .getByRole("group", { name: "Ações do código" })
      .getByRole("button");
    const boxes = await buttons.evaluateAll((nodes) =>
      nodes.map(
        (node) =>
          node.getBoundingClientRect().y +
          node.getBoundingClientRect().height / 2,
      ),
    );
    expect(Math.max(...boxes) - Math.min(...boxes)).toBeLessThan(2);
    const actionBar = page.getByRole("group", { name: "Ações do código" });
    const runBox = (await actionBar
      .getByRole("button", { name: "Run", exact: true })
      .boundingBox())!;
    const barBox = (await actionBar.boundingBox())!;
    expect(runBox.x - barBox.x).toBeLessThan(16);
    const submitBox = (await actionBar
      .getByRole("button", { name: "Submit", exact: true })
      .boundingBox())!;
    const formatBox = (await actionBar
      .getByRole("button", { name: "Formatar código", exact: true })
      .boundingBox())!;
    const restoreBox = (await actionBar
      .getByRole("button", { name: "Restaurar código inicial", exact: true })
      .boundingBox())!;
    expect(formatBox.x).toBeGreaterThan(submitBox.x);
    expect(restoreBox.x).toBeGreaterThan(formatBox.x);
    await editor.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.insertText("const marker = 42;");
    await editor.evaluate((node) => {
      node.setAttribute("data-same-editor", "yes");
    });
    const divider = page.getByRole("separator", {
      name: "Altura do editor e resultados",
    });
    const before = (await page.locator(".workspace-editor").boundingBox())!;
    await divider.scrollIntoViewIfNeeded();
    const visibleBox = (await divider.boundingBox())!;
    await page.mouse.move(visibleBox.x + 30, visibleBox.y + 4);
    await page.mouse.down();
    await page.mouse.move(visibleBox.x + 30, visibleBox.y - 36, { steps: 10 });
    await page.mouse.up();
    expect(
      before.height -
        (await page.locator(".workspace-editor").boundingBox())!.height,
    ).toBeCloseTo(40, 0);
    await expect(editor).toHaveAttribute("data-same-editor", "yes");
    await expect(editor).toContainText("marker");
    const saved = await divider.getAttribute("aria-valuenow");
    await page
      .getByRole("button", { name: "Histórico do código", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Histórico do código" }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await editor.fill("const stillEditable = true;");
    await page
      .getByRole("button", { name: "Histórico do código", exact: true })
      .click();
    await expect(
      page.getByText("Aguardando execução", { exact: true }),
    ).toBeVisible();
    const reading = page.getByRole("button", { name: "Lição", exact: true });
    if (await reading.isVisible()) await reading.click();
    await page.getByRole("button", { name: "Aparência da leitura" }).click();
    await page.getByRole("combobox", { name: "Tonalidade" }).selectOption("1");
    expect(
      await page
        .locator(".study-explanation")
        .evaluate((node) => getComputedStyle(node).backgroundColor),
    ).toBe("rgb(17, 27, 42)");
    expect(
      await page
        .locator(".workspace-code-slot .cm-editor")
        .first()
        .evaluate((node) => getComputedStyle(node).backgroundColor),
    ).toBe("rgb(35, 39, 44)");
    await page.reload();
    await expect(page.locator(".cm-editor")).toHaveCount(1);
    if (await switcher.isVisible()) await switcher.click();
    await expect(divider).toHaveAttribute("aria-valuenow", saved!);
    await divider.focus();
    await divider.press("Enter");
    await expect(divider).toHaveAttribute("aria-valuenow", "60");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`phase-b-${width}.png`),
      fullPage: true,
    });
  });

test("vertical resize preserves selection and undo, rolls back cancellation, and enforces real keyboard limits", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/courses/typescript/lessons/values-and-types");
  const editor = page.getByRole("textbox", {
    name: "Código da solução",
    exact: true,
  });
  await expect(editor).toBeVisible();
  const initial = await editor.innerText();
  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText("const resizable = 1;");
  await page.keyboard.press("ControlOrMeta+a");
  const selected = await page.evaluate(() => getSelection()?.toString());
  const divider = page.getByRole("separator", {
    name: "Altura do editor e resultados",
    exact: true,
  });
  const width = await page
    .getByRole("separator", { name: "Largura do artigo e editor", exact: true })
    .getAttribute("aria-valuenow");
  await divider.scrollIntoViewIfNeeded();
  await divider.evaluate((node) =>
    node.addEventListener(
      "pointerdown",
      (event) =>
        node.setAttribute(
          "data-pointer",
          String((event as PointerEvent).pointerId),
        ),
      { once: true },
    ),
  );
  const before = await divider.getAttribute("aria-valuenow");
  const box = (await divider.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 4);
  await page.mouse.down();
  await page.mouse.move(box.x + 20, box.y - 40, { steps: 8 });
  expect(await page.evaluate(() => getSelection()?.toString())).toBe(selected);
  await divider.dispatchEvent("pointercancel", {
    pointerId: Number(await divider.getAttribute("data-pointer")),
  });
  await page.mouse.up();
  await expect(divider).toHaveAttribute("aria-valuenow", before!);
  await expect(
    page.getByRole("separator", {
      name: "Largura do artigo e editor",
      exact: true,
    }),
  ).toHaveAttribute("aria-valuenow", width!);
  await editor.focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(editor).toHaveText(initial, { useInnerText: true });
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+Shift+z" : "Control+y",
  );
  await expect(editor).toHaveText("const resizable = 1;");
  await divider.focus();
  await divider.press("Home");
  expect(
    (await page.locator(".workspace-editor").boundingBox())!.height,
  ).toBeGreaterThanOrEqual(139);
  await divider.press("End");
  expect(
    (await page.locator(".workspace-results").boundingBox())!.height,
  ).toBeGreaterThanOrEqual(119);
  const end = Number(await divider.getAttribute("aria-valuenow"));
  await divider.press("ArrowUp");
  expect(Number(await divider.getAttribute("aria-valuenow"))).toBeLessThan(end);
  await divider.press("Enter");
  await expect(divider).toHaveAttribute("aria-valuenow", "60");
});
