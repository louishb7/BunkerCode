import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
const content = process.env.BUNKERCODE_BROWSER_CONTENT_DIR!;
const root = join(content, "courses/mvp03");
const url = "/courses/mvp03/lessons/lesson-1";
const exerciseFile = join(root, "lessons/lesson-1/exercise.json");
let definition: string;
test.beforeAll(async () => {
  const lessons = Array.from({ length: 30 }, (_, i) => ({
    slug: `lesson-${i + 1}`,
    title: `Conceito ${i + 1} — uma etapa do percurso`,
  }));
  for (const lesson of lessons) {
    const dir = join(root, "lessons", lesson.slug);
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "lesson.md"),
      `# ${lesson.title}\n\nUma explicação de estudo.\n\n~~~typescript\nconst value: number = 3;\n~~~`.replaceAll(
        "\\n",
        "\n",
      ),
    );
  }
  await writeFile(
    join(root, "course.json"),
    JSON.stringify({
      id: "mvp03",
      title: "Oficina de teste",
      description: "Fixture isolada com trinta lições em ordem editorial.",
      lessons,
    }),
  );
  definition = await readFile(
    resolve(
      "../../content/courses/typescript/lessons/values-and-types/exercise.json",
    ),
    "utf8",
  );
  await writeFile(exerciseFile, definition);
});
const editor = (page: Page) =>
  page.getByRole("textbox", { name: "Código da solução", exact: true });
async function openCode(page: Page) {
  await expect(page.locator(".cm-editor")).toHaveCount(1);
  const switcher = page.getByRole("button", { name: "Código", exact: true });
  if (await switcher.isVisible()) await switcher.click();
  await expect(editor(page)).toBeVisible();
}
async function replaceCode(page: Page, text: string) {
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(text);
}
async function saved(page: Page, expected?: string) {
  const code = expected ?? (await editor(page).innerText());
  await expect
    .poll(async () =>
      (await records(page)).some((value) => value.code === code),
    )
    .toBe(true);
}
async function records(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ code: string; revision: string; version: number }[]>(
        (resolve, reject) => {
          const request = indexedDB.open("bunkercode-practice", 2);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction("drafts");
            const get = tx.objectStore("drafts").getAll();
            tx.oncomplete = () => {
              db.close();
              resolve(get.result);
            };
          };
        },
      ),
  );
}
test("real editor persists inert Unicode code, indentation, undo, copy, restore and navigation without editorial writes", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const mutations: string[] = [];
  page.on("request", (req) => {
    if (req.method() !== "GET" && req.url().includes("/api/"))
      mutations.push(req.url());
  });
  await page.goto(url);
  await openCode(page);
  await expect(editor(page)).toContainText("remainingStock");
  expect(
    await editor(page).locator("span[style], span[class]").count(),
  ).toBeGreaterThan(0);
  const code =
    '// solução 🧱\nconst nome: string = "ação";\nglobalThis.__practiceExecuted = true;';
  await replaceCode(page, code);
  await saved(page);
  expect((await records(page))[0]?.code).toBe(code);
  expect(await page.evaluate(() => "__practiceExecuted" in window)).toBe(false);
  await expect(
    page.getByRole("button", { name: "Copiar código", exact: true }),
  ).toHaveCount(0);
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+c");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.insertText("// indent");
  await saved(page);
  expect((await records(page))[0]?.code).toMatch(/\n\s+\/\/ indent$/);
  await page.keyboard.press("ControlOrMeta+z");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  await expect(editor(page)).not.toBeFocused();
  await replaceCode(page, code);
  await saved(page);
  await page.getByText("Opções do exercício", { exact: true }).click();
  await page.getByRole("button", { name: "Restaurar inicial" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cancelar", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(editor(page)).toContainText("ação");
  await page.reload();
  await openCode(page);
  await expect(editor(page)).toContainText("ação");
  await page.getByRole("link", { name: /^Próxima →/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Código da solução" }),
  ).toHaveCount(0);
  await page.goBack();
  await openCode(page);
  await expect(editor(page)).toContainText("ação");
  await page.getByText("Opções do exercício", { exact: true }).click();
  await page.getByRole("button", { name: "Restaurar inicial" }).click();
  await page
    .getByRole("button", { name: "Restaurar código", exact: true })
    .click();
  await saved(page, JSON.parse(definition).starterCode as string);
  expect((await records(page))[0]?.code).toBe(
    JSON.parse(definition).starterCode,
  );
  expect(mutations).toEqual([]);
});
test("two tabs compare revisions transactionally and retain the losing text", async ({
  page,
  context,
}) => {
  await page.goto(url);
  await openCode(page);
  const other = await context.newPage();
  await other.goto(url);
  await openCode(other);
  await replaceCode(page, "// primeira aba");
  await saved(page);
  await replaceCode(other, "// segunda aba");
  await expect(
    other.getByRole("region", { name: "Revisão de conflito" }),
  ).toBeVisible();
  await expect(editor(other)).toContainText("segunda aba");
  expect((await records(other))[0]?.code).toBe("// primeira aba");
  await other
    .getByRole("button", { name: "Manter meu código e salvar" })
    .click();
  await saved(other);
  expect((await records(page))[0]?.code).toBe("// segunda aba");
  await replaceCode(page, "// nova edição obsoleta");
  await expect(
    page.getByRole("region", { name: "Revisão de conflito" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Carregar código da outra aba" })
    .click();
  await expect(editor(page)).toContainText("segunda aba");
});
test("new editorial revision preserves the old solution in a separate record", async ({
  page,
}) => {
  await page.goto(url);
  await openCode(page);
  await replaceCode(page, "// minha solução anterior");
  await saved(page);
  try {
    await writeFile(
      exerciseFile,
      JSON.stringify({
        ...JSON.parse(definition),
        starterCode: "// Novo início",
      }),
    );
    await page.reload();
    await openCode(page);
    await expect(editor(page)).toContainText("minha solução anterior");
    await expect(
      page.getByText("A definição mudou. Revisão anterior preservada."),
    ).toBeVisible();
    await replaceCode(page, "// solução revisada");
    await saved(page);
    const values = await records(page);
    expect(values).toHaveLength(2);
    expect(values.map((v) => v.code)).toEqual(
      expect.arrayContaining([
        "// minha solução anterior",
        "// solução revisada",
      ]),
    );
  } finally {
    await writeFile(exerciseFile, definition);
  }
});
test("storage denial and quota keep code available and downloadable across SPA navigation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      get() {
        throw new DOMException("Storage denied", "SecurityError");
      },
    });
  });
  await page.goto(url);
  await openCode(page);
  await replaceCode(page, "// código sem storage 🧱");
  await expect(page.locator(".save-status")).toContainText("Copie ou baixe");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar código" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("solucao.ts");
  expect(await readFile((await download.path())!, "utf8")).toBe(
    "// código sem storage 🧱",
  );
  await page.getByRole("link", { name: /^Próxima →/ }).click();
  await page.goBack();
  await openCode(page);
  await expect(editor(page)).toContainText("código sem storage");
});
test("transaction failure keeps unsaved code and retry reports actual completion", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (localStorage.getItem("deny-write") === "1")
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      return put.apply(this, args);
    };
  });
  await page.goto(url);
  await openCode(page);
  await page.evaluate(() => localStorage.setItem("deny-write", "1"));
  await replaceCode(page, "// quota retains this");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(editor(page)).toContainText("quota retains this");
  await page.evaluate(() => localStorage.removeItem("deny-write"));
  await page.getByRole("button", { name: "Tentar salvar novamente" }).click();
  await saved(page);
  expect((await records(page))[0]?.code).toBe("// quota retains this");
});
test("home validates actual recent destinations and handles unavailable, empty and malformed history", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Início");
  await expect(
    page.getByRole("link", { name: /Explorar cursos/ }),
  ).toBeVisible();
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Conceito 1",
  );
  await page.getByRole("link", { name: "Início", exact: true }).click();
  await expect(
    page.getByRole("link", { name: /Continuar estudando/ }),
  ).toHaveAttribute("href", url);
  await page.evaluate(() =>
    localStorage.setItem(
      "bunkercode:last-lesson:v1",
      JSON.stringify({ course: "mvp03", slug: "removed" }),
    ),
  );
  await page.reload();
  await expect(
    page.getByRole("link", { name: /Continuar estudando/ }),
  ).toHaveCount(0);
  await page.evaluate(() =>
    localStorage.setItem("bunkercode:last-lesson:v1", "{invalid"),
  );
  await page.reload();
  await expect(
    page.getByRole("link", { name: /Explorar cursos/ }),
  ).toBeVisible();
  await page.route("**/api/content/courses", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.reload();
  await expect(page.getByText(/Nenhum curso disponível/)).toBeVisible();
  await page.unroute("**/api/content/courses");
  await page.route("**/api/content/courses", (route) =>
    route.fulfill({ status: 503, body: "Offline" }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("503");
});
test("malformed optional exercise remains recoverable without blocking reading or Studio", async ({
  page,
}) => {
  await page.route("**/exercise", (route) =>
    route.fulfill({ json: { language: "shell" } }),
  );
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Conceito 1",
  );
  await expect(page.getByRole("alert")).toContainText(
    "A leitura continua disponível",
  );
  await page.getByRole("link", { name: "Editar lição", exact: true }).click();
  await page
    .getByRole("button", { name: "Editar fonte Markdown", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Markdown completo", exact: true }),
  ).toBeVisible();
});
for (const width of [390, 768, 1024, 1440])
  test(`product journey and visual evidence at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 960 });
    await page.route("**/api/content/courses", async (route) => {
      const response = await route.fetch();
      const courses = (await response.json()) as { id: string }[];
      await route.fulfill({
        json: courses.filter((c) => c.id === "typescript"),
      });
    });
    for (const [name, path] of [
      ["home", "/"],
      ["catalog", "/courses"],
      ["course", "/courses/typescript"],
      ["reading", "/courses/typescript/lessons/union-types"],
      ["practice", url],
      ["studio", url + "/edit"],
    ]) {
      await page.goto(path!);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      if (name === "home")
        await expect(page.locator(".course-card")).toHaveCount(1);
      if (name === "reading") {
        await expect(page.getByRole("alert")).toHaveCount(0);
      }
      if (name === "practice") {
        await expect(page.locator(".cm-editor")).toHaveCount(1);
        await expect(
          page.getByRole("heading", { name: "Descreva um produto com tipos" }),
        ).toBeVisible();
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath(`${name}-${width}.png`),
        fullPage: true,
      });
      if (name === "practice") {
        await openCode(page);
        await replaceCode(page, 'const produto: string = "Livro";');
        await saved(page);
        await page.screenshot({
          path: info.outputPath(`editor-${width}.png`),
          fullPage: true,
        });
        await expect(editor(page)).toContainText("Livro");
        await expect(
          page.getByRole("button", { name: "Explicação", exact: true }),
        ).toHaveCount(0);
        await page.getByText("Opções do exercício", { exact: true }).click();
        await page.getByRole("button", { name: "Restaurar inicial" }).click();
        await page.screenshot({
          path: info.outputPath(`restore-${width}.png`),
        });
        await page
          .getByRole("button", { name: "Cancelar", exact: true })
          .click();
        await page.getByRole("button", { name: "Lições", exact: true }).click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.screenshot({ path: info.outputPath(`index-${width}.png`) });
        await page.keyboard.press("Escape");
      }
    }
    await page.goto("/courses/mvp03");
    await expect(page.locator(".lesson-list a")).toHaveCount(30);
    await expect(page.locator(".lesson-list a").last()).toContainText(
      "Conceito 30",
    );
  });
test("catalog defers CodeMirror and practice dependencies", async ({
  page,
}) => {
  const manifest = JSON.parse(
    await readFile(resolve("dist/.vite/manifest.json"), "utf8"),
  ) as Record<string, { file: string }>;
  const practice = manifest["src/practice/PracticePanel.tsx"]!;
  const requests: string[] = [];
  page.on("request", (r) => requests.push(new URL(r.url()).pathname));
  await page.goto("/courses");
  await expect(
    page.getByRole("heading", { name: "Cursos", exact: true }),
  ).toBeVisible();
  expect(requests).not.toContain("/" + practice.file);
  await page.goto("/courses/typescript/lessons/union-types");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(requests).not.toContain("/" + practice.file);
  await page.goto(url);
  await openCode(page);
  expect(requests).toContain("/" + practice.file);
});

test("corrupt local records are preserved and cannot be overwritten by retry", async ({
  page,
}) => {
  await page.goto(url);
  await openCode(page);
  await replaceCode(page, "// original");
  await saved(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const open = indexedDB.open("bunkercode-practice", 2);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("drafts", "readwrite");
          const store = tx.objectStore("drafts");
          const get = store.getAll();
          get.onsuccess = () => store.put({ ...get.result[0], schema: 99 });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      }),
  );
  await page.reload();
  await openCode(page);
  await expect(page.locator(".save-status")).toContainText("incompatível");
  await replaceCode(page, "// recovery in memory");
  await page.getByRole("button", { name: "Tentar salvar novamente" }).click();
  await expect(page.locator(".save-status")).toContainText("incompatível");
  expect((await records(page))[0]?.code).toBe("// original");
});
test("oversized code stays available without truncation or false saved state", async ({
  page,
}) => {
  await page.goto(url);
  await openCode(page);
  const code = "//" + "á".repeat(33000);
  await replaceCode(page, code);
  await expect(page.locator(".save-status")).toContainText("64 KiB");
  expect(await records(page)).toHaveLength(0);
  const promised = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar código" }).click();
  const download = await promised;
  expect(await readFile((await download.path())!, "utf8")).toBe(code);
});
test("360px, short viewport and reduced motion retain usable controls and internal code scrolling", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 360, height: 500 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(url);
  await openCode(page);
  await replaceCode(page, "const longLine = '" + "x".repeat(300) + "';");
  await saved(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator(".cm-scroller")
      .evaluate((node) => node.scrollWidth > node.clientWidth),
  ).toBe(true);
  await page.getByText("Opções do exercício", { exact: true }).click();
  await page.getByRole("button", { name: "Restaurar inicial" }).click();
  await expect(
    page.getByRole("button", { name: "Cancelar", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("short-360.png") });
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.setViewportSize({ width: 720, height: 450 });
  await expect(page.locator(".study-explanation")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("reflow-half-desktop-width.png"),
    fullPage: true,
  });
});

test("mobile reading and code remain visible without view toggles", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  await expect(page.locator(".study-explanation")).toBeVisible();
  await expect(editor(page)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Código", exact: true }),
  ).toHaveCount(0);
  expect(
    await page
      .locator(".study-code")
      .evaluate((node) => node.getBoundingClientRect().top),
  ).toBeGreaterThan(
    await page
      .locator(".study-explanation")
      .evaluate((node) => node.getBoundingClientRect().bottom),
  );
});

test("200 percent CSS zoom preserves product controls and study reflow", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const path of ["/", "/courses", "/courses/typescript", url]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (path === url) await expect(page.locator(".cm-editor")).toHaveCount(1);
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("link", { name: "Cursos", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath(
        `zoom-200-${path === url ? "practice" : path.replaceAll("/", "-") || "home"}.png`,
      ),
      fullPage: true,
    });
  }
});
