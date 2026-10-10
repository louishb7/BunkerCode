import { expect, test, type Page } from "@playwright/test";

const lesson = "/courses/typescript/lessons/values-and-types";
const solution = (page: Page) =>
  page.getByRole("textbox", { name: "Código da solução", exact: true });
const format = (page: Page) =>
  page.getByRole("button", { name: "Formatar código", exact: true });

async function open(page: Page) {
  await page.goto(lesson);
  const switcher = page.getByRole("button", { name: "Código", exact: true });
  if (await switcher.isVisible()) await switcher.click();
  await expect(solution(page)).toBeVisible();
}
async function replace(page: Page, code: string) {
  await solution(page).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(code);
}
async function submissions(page: Page) {
  return page.evaluate(
    () =>
      new Promise<unknown[]>((resolve, reject) => {
        const open = indexedDB.open("bunkercode-practice", 2);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result,
            tx = db.transaction("submissions");
          const read = tx.objectStore("submissions").getAll();
          tx.oncomplete = () => {
            db.close();
            resolve(read.result);
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
  );
}
async function savedCodes(page: Page) {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open("bunkercode-practice", 2);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("drafts");
          const read = tx.objectStore("drafts").getAll();
          tx.oncomplete = () => {
            db.close();
            resolve(read.result.map((item: { code: string }) => item.code));
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
  );
}

test("formatting preserves the editor, selected text, focus and independent undo/redo steps", async ({
  page,
}) => {
  await open(page);
  const initial = (
    (await (
      await page.request.get(
        "/api/content/courses/typescript/lessons/values-and-types/exercise",
      )
    ).json()) as { exercise: { starterCode: string } }
  ).exercise.starterCode;
  const original = "const box={a:1}\nconst produto=box";
  await replace(page, original);
  await page.keyboard.press("ControlOrMeta+End");
  for (let i = 0; i < 3; i++) await page.keyboard.press("Shift+ArrowLeft");
  await expect
    .poll(() => page.evaluate(() => getSelection()?.toString()))
    .toBe("box");
  const node = await page.locator(".cm-editor").elementHandle();
  let navigations = 0;
  page.on("framenavigated", () => navigations++);
  await format(page).click();
  await expect(
    page.getByText("Código formatado.", { exact: true }),
  ).toBeVisible();
  await expect(solution(page)).toBeFocused();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => getSelection()?.toString()))
    .toBe("box");
  expect(
    await node!.evaluate(
      (element) => element === document.querySelector(".cm-editor"),
    ),
  ).toBe(true);
  expect(navigations).toBe(0);
  const formatted = "const box = { a: 1 };\nconst produto = box;\n";
  await expect(solution(page)).toHaveText(formatted, { useInnerText: true });
  await expect.poll(() => savedCodes(page)).toContain(formatted);
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.insertText("// recent");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(solution(page)).toHaveText(formatted, { useInnerText: true });
  await page.keyboard.press("ControlOrMeta+z");
  await expect(solution(page)).toHaveText(original, { useInnerText: true });
  await page.keyboard.press("ControlOrMeta+z");
  await expect(solution(page)).toHaveText(initial, { useInnerText: true });
  for (const value of [original, formatted, formatted + "// recent"]) {
    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+Shift+z" : "Control+y",
    );
    await expect(solution(page)).toHaveText(value, { useInnerText: true });
  }
});

test("restore needs confirmation, persists starter code, preserves submissions and can be undone", async ({
  page,
}) => {
  await open(page);
  const initial = (
    (await (
      await page.request.get(
        "/api/content/courses/typescript/lessons/values-and-types/exercise",
      )
    ).json()) as { exercise: { starterCode: string } }
  ).exercise.starterCode;
  await replace(page, 'const own = "preserved";');
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByText(/Solução registrada em/)).toBeVisible({
    timeout: 20000,
  });
  const history = await submissions(page);
  const restore = page.getByRole("button", {
    name: "Restaurar código inicial",
    exact: true,
  });
  await restore.click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cancelar", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(restore).toBeFocused();
  await expect(solution(page)).toHaveText('const own = "preserved";', {
    useInnerText: true,
  });
  await expect
    .poll(() => savedCodes(page))
    .toContain('const own = "preserved";');
  await restore.click();
  await page
    .getByRole("button", { name: "Restaurar código", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(solution(page)).toHaveText(initial, { useInnerText: true });
  await expect.poll(() => savedCodes(page)).toContain(initial);
  await expect(page.locator(".results-panel")).toContainText(
    "Aguardando execução",
  );
  expect(await submissions(page)).toEqual(history);
  await solution(page).focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(solution(page)).toHaveText('const own = "preserved";', {
    useInnerText: true,
  });
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+Shift+z" : "Control+y",
  );
  await expect(solution(page)).toHaveText(initial, { useInnerText: true });
  await expect.poll(() => savedCodes(page)).toContain(initial);
  await page.reload();
  await expect(solution(page)).toHaveText(initial, { useInnerText: true });
  expect(await submissions(page)).toEqual(history);
});

test("formatting keeps the viewport of long code and leaves redo intact for a no-op", async ({
  page,
}) => {
  await open(page);
  const original = Array.from(
    { length: 100 },
    (_, i) => `const value${i}={a:${i}}`,
  ).join("\n");
  await replace(page, original);
  await page.keyboard.press("ControlOrMeta+Home");
  for (let i = 0; i < 45; i++) await page.keyboard.press("ArrowDown");
  const scroller = page.locator(".cm-scroller");
  const before = await scroller.evaluate((element) => element.scrollTop);
  expect(before).toBeGreaterThan(300);
  await format(page).click();
  await expect(
    page.getByText("Código formatado.", { exact: true }),
  ).toBeVisible();
  await expect(solution(page)).toBeFocused();
  await expect
    .poll(async () =>
      Math.abs(
        (await scroller.evaluate((element) => element.scrollTop)) - before,
      ),
    )
    .toBeLessThan(30);
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.insertText("// next");
  await page.keyboard.press("ControlOrMeta+z");
  await format(page).click();
  await expect(
    page.getByText("Código formatado.", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+Shift+z" : "Control+y",
  );
  await expect(solution(page)).toContainText("// next");
});

test("selection changes during formatting are kept", async ({ page }) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/formatter.worker-*.js", async (route) => {
    await gate;
    await route.continue();
  });
  await open(page);
  await replace(page, "const box={a:1}\nconst produto=box");
  await format(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Formatando…", { exact: true })).toBeVisible();
  await solution(page).focus();
  await page.keyboard.press("ControlOrMeta+End");
  for (let i = 0; i < 3; i++) await page.keyboard.press("Shift+ArrowLeft");
  release();
  await expect(
    page.getByText("Código formatado.", { exact: true }),
  ).toBeVisible();
  await expect(solution(page)).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => getSelection()?.toString()))
    .toBe("box");
});

test("formatting rejects a stale result even when undo returns to the original text", async ({
  page,
}) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/formatter.worker-*.js", async (route) => {
    await gate;
    await route.continue();
  });
  await open(page);
  const original = "const original={a:1}";
  await replace(page, original);
  await format(page).click();
  await expect(page.getByText("Formatando…", { exact: true })).toBeVisible();
  await solution(page).focus();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.insertText("// edited");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(solution(page)).toHaveText(original, { useInnerText: true });
  release();
  await expect(
    page.getByText(/O código mudou durante a formatação/),
  ).toBeVisible();
  await expect(solution(page)).toHaveText(original, { useInnerText: true });
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+Shift+z" : "Control+y",
  );
  await expect(solution(page)).toHaveText(original + "// edited", {
    useInnerText: true,
  });
});

for (const width of [390, 1280, 1440, 1920]) {
  test(`both actions have distinct icons and live below the editor at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 960 });
    await open(page);
    const actions = page.getByRole("group", { name: "Ações do código" });
    const restore = page.getByRole("button", {
      name: "Restaurar código inicial",
      exact: true,
    });
    await expect(actions.getByRole("button")).toHaveCount(5);
    await expect(format(page)).toHaveAttribute("title", "Formatar código");
    await expect(restore).toHaveAttribute("title", "Restaurar código inicial");
    await expect(format(page).locator("svg")).toHaveClass(
      /lucide-wand-sparkles/,
    );
    await expect(restore.locator("svg")).toHaveClass(/lucide-rotate-ccw/);
    await expect(page.locator(".editor-toolbar button")).toHaveCount(2);
    await expect(
      page.getByText("Opções do exercício", { exact: true }),
    ).toHaveCount(0);
    const editorBox = await page.locator(".cm-editor").boundingBox();
    const actionBox = await actions.boundingBox();
    expect(actionBox!.y).toBeGreaterThanOrEqual(
      editorBox!.y + editorBox!.height,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`workspace-actions-${width}.png`),
      fullPage: true,
    });
    await restore.click();
    await page.screenshot({
      path: info.outputPath(`restore-confirmation-${width}.png`),
      fullPage: true,
    });
  });
}

test("keyboard formatting returns focus, but a newly focused file tab keeps focus", async ({
  page,
}) => {
  await open(page);
  await replace(page, "const product={a:1}");
  await format(page).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Código formatado.", { exact: true }),
  ).toBeVisible();
  await expect(solution(page)).toBeFocused();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/formatter.worker-*.js", async (route) => {
    await gate;
    await route.continue();
  });
  await replace(page, "const product={a:2}");
  await format(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Formatando…", { exact: true })).toBeVisible();
  const tab = page.getByRole("button", { name: "solucao.ts", exact: true });
  await tab.focus();
  release();
  await expect(
    page.getByText("Código formatado.", { exact: true }),
  ).toBeVisible();
  await expect(tab).toBeFocused();
});

test("read-only public tests disable formatting and restoring without replacing the solution editor", async ({
  page,
}) => {
  await page.route(
    "**/api/content/courses/typescript/lessons/values-and-types/exercise",
    async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.exercise.tests = { kind: "stdout", expected: "1\n" };
      await route.fulfill({ json: body });
    },
  );
  await open(page);
  await replace(page, "const mine={a:1}");
  await format(page).click();
  await expect(
    page.getByText("Código formatado.", { exact: true }),
  ).toBeVisible();
  const node = await solution(page).elementHandle();
  await page.getByRole("button", { name: "testes.json", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Testes públicos, somente leitura" }),
  ).toHaveAttribute("aria-readonly", "true");
  await expect(format(page)).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Restaurar código inicial", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "solucao.ts", exact: true }).click();
  expect(await node!.evaluate((element) => element.isConnected)).toBe(true);
  await solution(page).focus();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(solution(page)).toHaveText("const mine={a:1}", {
    useInnerText: true,
  });
});
