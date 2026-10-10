import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const lesson = "/courses/typescript/lessons/values-and-types";
const editor = (page: Page) =>
  page.getByRole("textbox", { name: "Código da solução", exact: true });
async function code(page: Page, value: string) {
  await expect(editor(page)).toBeVisible();
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(value);
  await expect(
    page.getByText("Rascunho salvo neste navegador.", { exact: true }),
  ).toBeVisible();
}
async function open(page: Page) {
  await page.goto(lesson);
  await expect(page.locator(".cm-editor")).toHaveCount(1);
  const switcher = page.getByRole("button", { name: "Código", exact: true });
  if (await switcher.isVisible()) await switcher.click();
  await expect(editor(page)).toBeVisible();
}
async function records(page: Page, store: string) {
  return page.evaluate(
    (name) =>
      new Promise<unknown[]>((resolve, reject) => {
        const request = indexedDB.open("bunkercode-practice", 2);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(name);
          const read = tx.objectStore(name).getAll();
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
    store,
  );
}
test("empty dashboard has exactly 365 real calendar days, zeros, months and contextual courses", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".heatmap-day")).toHaveCount(365);
  await expect(page.locator(".activity-stats dd")).toHaveText([
    "0",
    "0",
    "0",
    "0",
  ]);
  await expect(
    page.getByText("Retome de onde parou", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Aprender fazendo", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("link", { name: /Começar um curso/ }),
  ).toBeVisible();
  expect(await page.locator(".heatmap-months span").allTextContents()).toEqual(
    expect.arrayContaining(["jan.", "jul."]),
  );
  expect(
    await page
      .locator(".activity-dashboard")
      .evaluate((node) => node.getBoundingClientRect().bottom),
  ).toBeLessThan(
    await page
      .locator("#home-courses")
      .evaluate((node) => node.getBoundingClientRect().top),
  );
  expect((await records(page, "activity")).length).toBe(0);
});
test("real accesses deduplicate reloads and simultaneous tabs, persist, and change at local midnight", async ({
  page,
  context,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-09T23:58:00-03:00"));
  // Use the browser's actual local day, independently of the machine running Node.
  await page.goto("/");
  const day = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  await page.goto(lesson);
  await expect(
    page.getByRole("heading", { name: "Valores e tipos", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => (await records(page, "activity")).length)
    .toBe(1);
  await page.reload();
  await expect(page.locator(".cm-editor")).toHaveCount(1);
  const other = await context.newPage();
  await other.clock.setFixedTime(new Date("2026-10-09T23:58:00-03:00"));
  await other.goto(lesson);
  await expect(other.locator(".cm-editor")).toHaveCount(1);
  expect(await records(page, "activity")).toHaveLength(1);
  expect(await records(page, "activity")).toEqual([
    expect.objectContaining({
      day,
      kind: "visit",
      timezone: expect.any(String),
    }),
  ]);
  await page.goto("/");
  await expect(page.locator(".activity-stats dd")).toHaveText([
    "1",
    "1",
    "0",
    "0",
  ]);
  await expect(
    page.getByRole("link", { name: /Continuar estudando/ }),
  ).toHaveAttribute("href", lesson);
  await page.clock.setFixedTime(new Date("2026-10-11T03:02:00Z"));
  await page.goto(lesson);
  await expect(page.locator(".cm-editor")).toHaveCount(1);
  await expect
    .poll(async () => (await records(page, "activity")).length)
    .toBe(2);
  await page.goto("/");
  await expect(page.locator(".activity-stats dd")).toHaveText([
    "2",
    "1",
    "0",
    "0",
  ]);
});
test("calendar crosses leap year and DST without duplicate or missing days", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2025-02-28T12:00:00Z"));
  await page.goto("/");
  await expect(page.locator(".heatmap-day")).toHaveCount(365);
  await expect(page.locator('.heatmap-day[data-day="2024-03-01"]')).toHaveCount(
    1,
  );
  await expect(page.locator('.heatmap-day[data-day="2025-02-28"]')).toHaveCount(
    1,
  );
  const days = await page
    .locator(".heatmap-day")
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-day")));
  expect(new Set(days).size).toBe(365);
  await page.locator(".heatmap-day[tabindex='0']").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".heatmap-day:focus")).toHaveAttribute(
    "data-day",
    "2025-02-21",
  );
});
test("edits and submissions produce distinct genuine activity, with historical output and drafts independent", async ({
  page,
}) => {
  await open(page);
  await code(page, 'const productName = "Livro";');
  await code(page, 'const productName = "Caderno";');
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByText(/Solução registrada em/)).toBeVisible();
  await code(page, 'const productName = "Rascunho posterior";');
  expect(await records(page, "submissions")).toEqual([
    expect.objectContaining({
      code: 'const productName = "Caderno";',
      state: "unassessed",
      revision: expect.stringMatching(/^[a-f0-9]{64}$/),
      at: expect.any(Number),
      id: expect.any(String),
    }),
  ]);
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(
    page.getByText("Envios locais (2)", { exact: true }),
  ).toBeVisible();
  expect(await records(page, "submissions")).toHaveLength(2);
  await page.reload();
  await expect(editor(page)).toContainText("Rascunho posterior");
  await expect(
    page.getByText("Envios locais (2)", { exact: true }),
  ).toBeVisible();
  await page.goto("/");
  await expect(page.locator(".activity-stats dd")).toHaveText([
    "1",
    "1",
    "1",
    "2",
  ]);
  expect((await records(page, "activity")).length).toBe(4);
  await expect(page.locator(".heat-4[data-day]")).toHaveCount(1);
});
test("schema-one drafts upgrade intact and submitted versions survive a new editorial revision", async ({
  page,
  request,
}) => {
  const response = await request.get(
    "/api/content/courses/typescript/lessons/values-and-types/exercise",
  );
  const { exercise } = (await response.json()) as {
    exercise: { id: string; revision: string };
  };
  await page.goto("/brand/bunker.png");
  await page.evaluate(
    ({ id, revision }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("bunkercode-practice", 1);
        open.onupgradeneeded = () =>
          open.result
            .createObjectStore("drafts", { keyPath: "key" })
            .createIndex("scope", "scope");
        open.onsuccess = () => {
          const db = open.result,
            scope = JSON.stringify([
              "bunkercode",
              "typescript",
              "values-and-types",
              id,
            ]);
          const tx = db.transaction("drafts", "readwrite");
          tx.objectStore("drafts").put({
            schema: 1,
            key: JSON.stringify([scope, revision]),
            scope,
            revision,
            code: "// schema-one preserved",
            version: 1,
            updatedAt: Date.now(),
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onabort = () => reject(tx.error);
        };
      }),
    exercise,
  );
  await open(page);
  await expect(editor(page)).toContainText("schema-one preserved");
  expect(await records(page, "drafts")).toHaveLength(1);
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByText(/Solução registrada em/)).toBeVisible();
  await page.route("**/exercise", (route) =>
    route.fulfill({
      json: {
        exercise: {
          ...exercise,
          title: "Changed",
          objective: "New",
          instructions: "New",
          expected: "New",
          language: "typescript",
          starterCode: "",
          revision: "a".repeat(64),
        },
      },
    }),
  );
  await page.reload();
  await expect(
    page.getByText("A definição mudou. Revisão anterior preservada."),
  ).toBeVisible();
  await page.getByText("Envios locais (1)", { exact: true }).click();
  await expect(page.getByText(/não avaliada · revisão anterior/)).toBeVisible();
  expect(await records(page, "submissions")).toHaveLength(1);
});
test("submit storage failures never claim success and expose recovery without losing code", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const add = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
      if (this.name === "submissions")
        throw new DOMException("Submission quota", "QuotaExceededError");
      return add.apply(this, args);
    };
  });
  await open(page);
  await code(page, "// retained submission");
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Submission quota");
  await expect(page.getByText(/Solução registrada em/)).toHaveCount(0);
  await expect(editor(page)).toContainText("retained submission");
  expect(await records(page, "submissions")).toHaveLength(0);
  expect(await records(page, "activity")).toEqual(
    expect.not.arrayContaining([expect.objectContaining({ kind: "submit" })]),
  );
  await expect(
    page.getByRole("button", { name: "Baixar código" }),
  ).toBeVisible();
});
test("autocomplete identifies local variables and functions and accepts via keyboard", async ({
  page,
}) => {
  await open(page);
  await code(
    page,
    'const produto = "Livro";\nfunction calcularTotal() { return 2; }\npro',
  );
  await page.keyboard.press("Control+Space");
  await expect(page.getByRole("option", { name: /produto/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(editor(page)).toContainText("\nproduto");
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Enter");
  await page.keyboard.insertText("cal");
  await page.keyboard.press("Control+Space");
  await expect(
    page.getByRole("option", { name: /calcularTotal/ }),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(editor(page)).toContainText("\ncalcularTotal");
});
test("formatter applies actual Prettier output, undo and syntax-error recovery without loading tools on Home", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/");
  await expect(page.locator(".heatmap-day")).toHaveCount(365);
  expect(
    requests.some((url) =>
      /compiler.worker|formatter.worker|code-editor-core/.test(url),
    ),
  ).toBe(false);
  await open(page);
  expect(
    requests.some((url) => /compiler.worker|formatter.worker/.test(url)),
  ).toBe(false);
  const original = 'const produto={title:"Livro",quantity:2}';
  await code(page, original);
  await page
    .getByRole("button", { name: "Formatar código", exact: true })
    .click();
  await expect(
    page.getByText("Código formatado.", { exact: true }),
  ).toBeVisible();
  await expect(editor(page)).toContainText(
    'const produto = { title: "Livro", quantity: 2 };',
  );
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(editor(page)).toHaveText(original);
  const invalid = "const broken = {";
  await code(page, invalid);
  await page
    .getByRole("button", { name: "Formatar código", exact: true })
    .click();
  await expect(page.getByText(/Não foi possível formatar:/)).toBeVisible();
  await expect(editor(page)).toHaveText(invalid);
  expect(requests.some((url) => /formatter.worker/.test(url))).toBe(true);
  expect(requests.some((url) => /compiler.worker/.test(url))).toBe(false);
});
test("actual semantic and syntax diagnostics are shown and become stale after edits", async ({
  page,
}) => {
  await open(page);
  await code(page, "const product: string = 3;");
  await page.getByRole("button", { name: "Compilar", exact: true }).click();
  await expect(page.getByText(/TS2322 · semantic · 1:/)).toBeVisible();
  await expect(
    page.getByText(/Type 'number' is not assignable to type 'string'/),
  ).toBeVisible();
  await code(page, 'const product: string = "Livro";');
  await expect(
    page.getByText(/O código foi editado após esta análise/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Compilar", exact: true }).click();
  await expect(
    page.getByText("Compilação concluída sem diagnósticos neste ambiente.", {
      exact: true,
    }),
  ).toBeVisible();
  await code(page, "const broken = ;");
  await page.getByRole("button", { name: "Compilar", exact: true }).click();
  await expect(page.locator(".diagnostics")).toContainText("syntax");
});
test("Run captures genuine console, errors and cancellation without modifying editorial Markdown", async ({
  page,
}) => {
  const before = await readFile(
    resolve(
      "../../content/courses/typescript/lessons/values-and-types/lesson.md",
    ),
    "utf8",
  );
  await open(page);
  await code(page, 'console.log("actual output", 2 + 3);');
  await expect(
    page.getByRole("button", { name: "Run", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(
    page.getByText("Execução encerrada.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".result-output").last()).toContainText(
    "actual output 5",
  );
  await code(page, 'throw new Error("real exception");');
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(
    page.getByText("Erro de execução.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".results-panel")).toContainText("real exception");
  await code(page, "while (true) {}");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(
    page.getByText("Executando em container isolado…", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancelar operação" }).click();
  await expect(
    page.getByText("Operação cancelada.", { exact: true }),
  ).toBeVisible();
  expect(
    await readFile(
      resolve(
        "../../content/courses/typescript/lessons/values-and-types/lesson.md",
      ),
      "utf8",
    ),
  ).toBe(before);
});
test("JavaScript compile and run work, and unavailable Run remains explicit with functioning Submit", async ({
  page,
}) => {
  await page.route("**/exercise", async (route) => {
    const original = (await (await route.fetch()).json()) as {
      exercise: Record<string, unknown>;
    };
    await route.fulfill({
      json: { exercise: { ...original.exercise, language: "javascript" } },
    });
  });
  await open(page);
  await code(page, 'console.log("JavaScript real");');
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(
    page.getByText("Execução encerrada.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".result-output").last()).toContainText(
    "JavaScript real",
  );
  await page.route("**/practice/runtime", (route) =>
    route.fulfill({
      json: {
        available: false,
        reason: "Run intentionally unavailable in isolated test",
      },
    }),
  );
  await page.reload();
  await expect(
    page.getByText("Run intentionally unavailable in isolated test"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Run", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByText(/Solução registrada em/)).toBeVisible();
});
test("all seven new courses have two referenced lessons, correct local figures and manifest navigation", async ({
  page,
  request,
}) => {
  const ids = [
    "javascript",
    "nodejs",
    "nestjs",
    "postgresql",
    "git",
    "linux",
    "docker",
  ];
  for (const id of ids) {
    const response = await request.get("/api/content/courses/" + id);
    expect(response.ok()).toBe(true);
    const course = (await response.json()) as {
      title: string;
      lessons: { slug: string; title: string }[];
    };
    expect(course.lessons).toHaveLength(2);
    await page.goto("/courses/" + id);
    await expect(page.locator(".lesson-list a")).toHaveCount(2);
    const figure = page.locator(".technology-logo");
    await expect(figure).toHaveAttribute("src", `/technologies/${id}.svg`);
    expect(
      await figure.evaluate((node) => (node as HTMLImageElement).naturalWidth),
    ).toBeGreaterThan(0);
    for (const entry of course.lessons) {
      await page.goto(`/courses/${id}/lessons/${entry.slug}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        entry.title,
      );
      await expect(page.locator(".prose")).toContainText("demonstrativo");
      expect(
        await page.locator('.prose a[href^="https://"]').count(),
      ).toBeGreaterThan(0);
      await expect(page.locator(".cm-editor")).toHaveCount(0);
    }
  }
});
for (const width of [390, 768, 1024, 1280, 1440, 1920])
  test(`integrated desktop and responsive visual evidence at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/");
    await expect(page.locator(".heatmap-day")).toHaveCount(365);
    await page.screenshot({
      path: info.outputPath(`home-empty-${width}.png`),
      fullPage: true,
    });
    await open(page);
    await code(
      page,
      'const produto = "Livro";\nfunction total(quantity: number) { return quantity * 2; }\nconsole.log(total(3));',
    );
    await page.getByRole("button", { name: "Run", exact: true }).click();
    await expect(
      page.getByText("Execução encerrada.", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(page.getByText(/Solução registrada em/)).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`workspace-results-${width}.png`),
      fullPage: true,
    });
    await editor(page).click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.press("Enter");
    await page.keyboard.insertText("pro");
    await page.keyboard.press("Control+Space");
    await expect(page.getByRole("option", { name: /produto/ })).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`autocomplete-${width}.png`),
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    for (const [name, url] of [
      ["home-activity", "/"],
      ["catalog", "/courses"],
      ["course-nodejs", "/courses/nodejs"],
      ["course-postgresql", "/courses/postgresql"],
      ["reader", "/courses/javascript/lessons/functions"],
      ["studio", lesson + "/edit"],
    ] as const) {
      await page.goto(url);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      if (name === "home-activity")
        await expect(page.locator(".activity-stats dd")).toHaveText([
          "1",
          "1",
          "1",
          "1",
        ]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath(`${name}-${width}.png`),
        fullPage: true,
      });
    }
  });
test("formatting stale work cannot replace newer text", async ({ page }) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/formatter.worker-*.js", async (route) => {
    await gate;
    await route.continue();
  });
  await open(page);
  await code(page, "const original={a:1}");
  await page
    .getByRole("button", { name: "Formatar código", exact: true })
    .click();
  await expect(page.getByText("Formatando…", { exact: true })).toBeVisible();
  await code(page, 'const newer = "preserved";');
  release();
  await expect(
    page.getByText(/O código mudou durante a formatação/),
  ).toBeVisible();
  await expect(editor(page)).toHaveText('const newer = "preserved";');
});
test("program output is rendered as text and module imports receive real diagnostics", async ({
  page,
}) => {
  await open(page);
  await code(page, 'console.log("<img src=x onerror=alert(1)>");');
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(
    page.getByText("Execução encerrada.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".results-panel")).toContainText(
    "<img src=x onerror=alert(1)>",
  );
  await expect(page.locator(".results-panel img")).toHaveCount(0);
  await code(page, 'import fs from "node:fs";');
  await page.getByRole("button", { name: "Compilar", exact: true }).click();
  await expect(page.locator(".diagnostics")).toContainText("Cannot find module 'node:fs'");
});
test.describe("local timezone calendar", () => {
  test.use({ timezoneId: "America/New_York" });
  test("DST repeated hour does not duplicate visits and next local day stays distinct", async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date("2026-11-01T05:30:00Z"));
    await open(page);
    await expect
      .poll(async () => (await records(page, "activity")).length)
      .toBe(1);
    await page.clock.setFixedTime(new Date("2026-11-01T06:30:00Z"));
    await page.reload();
    await expect(page.locator(".cm-editor")).toHaveCount(1);
    expect(await records(page, "activity")).toHaveLength(1);
    await page.clock.setFixedTime(new Date("2026-11-02T05:01:00Z"));
    await page.reload();
    await expect
      .poll(async () => (await records(page, "activity")).length)
      .toBe(2);
    await page.goto("/");
    await expect(page.locator(".heatmap-day")).toHaveCount(365);
    await expect(page.locator(".activity-stats dd")).toHaveText([
      "2",
      "1",
      "0",
      "0",
    ]);
    expect(await records(page, "activity")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          day: "2026-11-01",
          timezone: "America/New_York",
        }),
        expect.objectContaining({
          day: "2026-11-02",
          timezone: "America/New_York",
        }),
      ]),
    );
  });
});
test("late cancellation cannot overwrite a newer compilation result", async ({
  page,
}) => {
  await open(page);
  await code(page, "while (true) {}");
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/practice/runs/*", async (route) => {
    if (route.request().method() === "DELETE") await gate;
    await route.continue();
  });
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(
    page.getByText("Executando em container isolado…", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancelar operação" }).click();
  await expect(
    page.getByRole("button", { name: "Compilar", exact: true }),
  ).toBeVisible();
  await code(page, 'console.log("new compilation");');
  await page.getByRole("button", { name: "Compilar", exact: true }).click();
  await expect(
    page.getByText("Compilação concluída sem diagnósticos neste ambiente.", {
      exact: true,
    }),
  ).toBeVisible();
  release();
  await page.waitForResponse(
    (r) =>
      r.request().method() === "DELETE" && r.url().includes("/practice/runs/"),
  );
  await expect(
    page.getByText("Compilação concluída sem diagnósticos neste ambiente.", {
      exact: true,
    }),
  ).toBeVisible();
});
