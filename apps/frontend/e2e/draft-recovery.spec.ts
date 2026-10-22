import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const content = process.env.BUNKERCODE_BROWSER_CONTENT_DIR!;
const fixture = "/courses/stabilization01/lessons/first";
let definition: string;
test.beforeAll(async () => {
  definition = await readFile(
    resolve(
      "../../content/courses/typescript/lessons/values-and-types/exercise.json",
    ),
    "utf8",
  );
  for (const course of ["stabilization01", "stabilization02"]) {
    const lessons = ["first", "second", "third"].map((slug) => ({
      slug,
      title: slug,
    }));
    const root = join(content, "courses", course);
    for (const lesson of lessons) {
      const dir = join(root, "lessons", lesson.slug);
      await mkdir(dir, { recursive: true });
      await writeFile(
        join(dir, "lesson.md"),
        `# ${lesson.title}\n\nFixture de recuperação de rascunhos.`,
      );
      await writeFile(
        join(dir, "exercise.json"),
        lesson.slug === "third"
          ? JSON.stringify({ ...JSON.parse(definition), id: "other-exercise" })
          : definition,
      );
    }
    await writeFile(
      join(root, "course.json"),
      JSON.stringify({
        id: course,
        title: "Fixture de recuperação",
        description: "Conteúdo sintético para testar pendências locais.",
        lessons,
      }),
    );
  }
});

const url = "/courses/typescript/lessons/values-and-types";
const editor = (page: Page) =>
  page.getByRole("textbox", { name: "Código da solução", exact: true });
async function openCode(page: Page) {
  await expect(page.locator(".cm-editor")).toHaveCount(1);
  const switcher = page.getByRole("button", { name: "Código", exact: true });
  if (await switcher.isVisible()) await switcher.click();
  await expect(editor(page)).toBeVisible();
}
async function codes(page: Page) {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const request = indexedDB.open("bunkercode-practice", 2);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("drafts");
          const get = tx.objectStore("drafts").getAll();
          tx.oncomplete = () => {
            db.close();
            resolve(get.result.map((value: { code: string }) => value.code));
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
  );
}
async function protectedExit(page: Page) {
  return page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
}
async function copies(page: Page) {
  return page.evaluate(() =>
    Object.keys(sessionStorage).filter((key) =>
      key.startsWith("bunkercode:practice-recovery:v1:"),
    ),
  );
}
for (const width of [1440, 390]) {
  test(`conflicting text survives Home, history and reload at ${width}px`, async ({
    page,
    context,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url);
    await openCode(page);
    const other = await context.newPage();
    await other.setViewportSize({ width, height: 900 });
    other.on("dialog", (dialog) => void dialog.accept());
    await other.goto(url);
    await openCode(other);
    await editor(page).fill("// confirmed in A");
    await expect.poll(() => codes(page)).toEqual(["// confirmed in A"]);
    await editor(other).fill("// pending in B 🧱");
    await expect(
      other.getByRole("region", { name: "Revisão de conflito" }),
    ).toBeVisible();
    await expect.poll(() => codes(other)).toEqual(["// confirmed in A"]);
    expect(await protectedExit(other)).toBe(true);
    await other.getByRole("link", { name: "Início", exact: true }).click();
    await expect(other).toHaveURL("/");
    expect(await protectedExit(other)).toBe(true);
    await other.goBack();
    await openCode(other);
    await expect(editor(other)).toHaveText("// pending in B 🧱");
    await other.goForward();
    await other.reload();
    await other.goto(url);
    await openCode(other);
    await expect(editor(other)).toHaveText("// pending in B 🧱");
    await expect(
      other.getByRole("region", { name: "Revisão de conflito" }),
    ).toBeVisible();
    await expect(other.locator(".save-status")).toContainText("recuperada");
    expect(await codes(other)).toEqual(["// confirmed in A"]);
    await other.screenshot({ path: info.outputPath(`recovered-${width}.png`) });
    const downloadPromise = other.waitForEvent("download");
    await other
      .getByRole("button", { name: "Baixar código", exact: true })
      .click();
    expect(
      await readFile((await (await downloadPromise).path())!, "utf8"),
    ).toBe("// pending in B 🧱");
    await other
      .getByRole("button", { name: "Manter meu código e salvar" })
      .focus();
    await expect(
      other.getByRole("button", { name: "Manter meu código e salvar" }),
    ).toBeFocused();
    await other
      .getByRole("button", { name: "Manter meu código e salvar" })
      .click();
    await expect(
      other.getByRole("region", { name: "Revisão de conflito" }),
    ).toHaveCount(0);
    await expect.poll(() => copies(other)).toEqual([]);
    expect(await copies(other)).toEqual([]);
    expect(await protectedExit(other)).toBe(false);
    expect(await codes(page)).toEqual(["// pending in B 🧱"]);
    await other.reload();
    await openCode(other);
    await expect(editor(other)).toHaveText("// pending in B 🧱");
    expect(await copies(other)).toEqual([]);
    expect(await protectedExit(other)).toBe(false);
  });
}

async function denyDraftWrites(page: Page) {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === "drafts" && localStorage.getItem("deny-drafts") === "1")
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      return put.apply(this, args);
    };
  });
}
async function failEdit(page: Page, code: string) {
  await editor(page).fill(code);
  await expect(page.locator(".save-status")).toContainText("Quota exceeded");
}

test("discarding a recovered conflict preserves A and removes stale recovery and protection", async ({
  page,
  context,
}) => {
  await page.goto(url);
  await openCode(page);
  const other = await context.newPage();
  other.on("dialog", (dialog) => void dialog.accept());
  await other.goto(url);
  await openCode(other);
  await editor(page).fill("// A remains confirmed");
  await expect.poll(() => codes(page)).toEqual(["// A remains confirmed"]);
  await editor(other).fill("// B explicitly discarded");
  await expect(
    other.getByRole("region", { name: "Revisão de conflito" }),
  ).toBeVisible();
  await other.reload();
  await openCode(other);
  await other
    .getByRole("button", { name: "Carregar código da outra aba" })
    .click();
  await expect(editor(other)).toHaveText("// A remains confirmed");
  expect(await copies(other)).toEqual([]);
  expect(await protectedExit(other)).toBe(false);
  await other.getByRole("link", { name: "Início", exact: true }).click();
  expect(await protectedExit(other)).toBe(false);
  await other.reload();
  await other.goto(url);
  await openCode(other);
  await expect(editor(other)).toHaveText("// A remains confirmed");
  await expect(
    other.getByRole("region", { name: "Revisão de conflito" }),
  ).toHaveCount(0);
  expect(await codes(other)).toEqual(["// A remains confirmed"]);
});

test("quota failure survives reload away from practice and only explicit retry confirms it", async ({
  page,
}) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await denyDraftWrites(page);
  await page.goto(url);
  await openCode(page);
  await page.evaluate(() => localStorage.setItem("deny-drafts", "1"));
  await failEdit(page, "// recovered after quota 🧱");
  await page.getByRole("link", { name: "Início", exact: true }).click();
  await page.reload();
  await page.goto(url);
  await openCode(page);
  await expect(editor(page)).toHaveText("// recovered after quota 🧱");
  await expect(page.locator(".save-status")).toContainText("recuperada");
  expect(await codes(page)).toEqual([]);
  await page.evaluate(() => localStorage.removeItem("deny-drafts"));
  await page.getByRole("button", { name: "Tentar salvar novamente" }).click();
  await expect.poll(() => codes(page)).toEqual(["// recovered after quota 🧱"]);
  await expect.poll(() => copies(page)).toEqual([]);
  expect(await protectedExit(page)).toBe(false);
  await page.reload();
  await openCode(page);
  await expect(editor(page)).toHaveText("// recovered after quota 🧱");
  expect(await protectedExit(page)).toBe(false);
});

test("pending copies stay separate by course, lesson and exercise and explicit discard clears each", async ({
  page,
}) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await denyDraftWrites(page);
  const paths = [
    fixture,
    "/courses/stabilization01/lessons/second",
    "/courses/stabilization01/lessons/third",
    "/courses/stabilization02/lessons/first",
  ];
  for (const [index, path] of paths.entries()) {
    await page.goto(path);
    await openCode(page);
    await expect(editor(page)).not.toContainText("pending scope");
    await page.evaluate(() => localStorage.setItem("deny-drafts", "1"));
    await failEdit(page, `// pending scope ${index}`);
  }
  expect(await copies(page)).toHaveLength(4);
  for (const [index, path] of paths.entries()) {
    await page.goto(path);
    await openCode(page);
    await expect(editor(page)).toHaveText(`// pending scope ${index}`);
    await page
      .getByRole("button", { name: "Descartar edição pendente" })
      .click();
    await expect.poll(() => copies(page)).toHaveLength(3 - index);
    expect(await protectedExit(page)).toBe(false);
  }
  await page.reload();
  await openCode(page);
  await expect(editor(page)).not.toContainText("pending scope");
  expect(await copies(page)).toEqual([]);
});

test("an editorial revision recovers pending text without rewriting the earlier confirmed record", async ({
  page,
  context,
}) => {
  const file = join(
    content,
    "courses/stabilization01/lessons/first/exercise.json",
  );
  await page.goto(fixture);
  await openCode(page);
  const other = await context.newPage();
  other.on("dialog", (dialog) => void dialog.accept());
  await other.goto(fixture);
  await openCode(other);
  await editor(page).fill("// confirmed old revision");
  await expect.poll(() => codes(page)).toEqual(["// confirmed old revision"]);
  await editor(other).fill("// pending across editorial revision");
  await expect(
    other.getByRole("region", { name: "Revisão de conflito" }),
  ).toBeVisible();
  try {
    await writeFile(
      file,
      JSON.stringify({
        ...JSON.parse(definition),
        starterCode: "// revised starter",
      }),
    );
    await other.reload();
    await openCode(other);
    await expect(editor(other)).toHaveText(
      "// pending across editorial revision",
    );
    await expect(other.locator(".save-status")).toContainText(
      "revisão anterior",
    );
    expect(await codes(other)).toEqual(["// confirmed old revision"]);
    await editor(other).fill("// pending across editorial revision — revised");
    await other.reload();
    await openCode(other);
    await expect(editor(other)).toHaveText(
      "// pending across editorial revision — revised",
    );
    await other
      .getByRole("button", { name: "Tentar salvar novamente" })
      .click();
    await expect
      .poll(() => codes(other))
      .toEqual(
        expect.arrayContaining([
          "// confirmed old revision",
          "// pending across editorial revision — revised",
        ]),
      );
    await expect.poll(() => copies(other)).toEqual([]);
    expect(await protectedExit(other)).toBe(false);
    await other.reload();
    await openCode(other);
    await expect(editor(other)).toHaveText(
      "// pending across editorial revision — revised",
    );
    expect(await copies(other)).toEqual([]);
  } finally {
    await writeFile(file, definition);
  }
});

test("unavailable IndexedDB still recovers this tab's text through sessionStorage", async ({
  page,
}) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await page.addInitScript(() =>
    Object.defineProperty(window, "indexedDB", {
      get() {
        throw new DOMException("Storage denied", "SecurityError");
      },
    }),
  );
  await page.goto(url);
  await openCode(page);
  await editor(page).fill("// offline storage recovery");
  await page.getByRole("link", { name: "Início", exact: true }).click();
  expect(await protectedExit(page)).toBe(true);
  await page.reload();
  await page.goto(url);
  await openCode(page);
  await expect(editor(page)).toHaveText("// offline storage recovery");
  await expect(page.locator(".save-status")).toContainText("recuperada");
  await expect(page.locator(".save-status")).toContainText("Storage denied");
});

test("recovery storage failure is explicit and confirmed saving removes unnecessary protection", async ({
  page,
}) => {
  await denyDraftWrites(page);
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("bunkercode:practice-recovery:v1:"))
        throw new DOMException("Recovery quota", "QuotaExceededError");
      set.call(this, key, value);
    };
  });
  await page.goto(url);
  await openCode(page);
  await page.evaluate(() => localStorage.setItem("deny-drafts", "1"));
  await failEdit(page, "// in-memory fallback");
  await expect(
    page.getByText(/Não foi possível atualizar a cópia/),
  ).toBeVisible();
  await page.getByRole("link", { name: "Início", exact: true }).click();
  expect(await protectedExit(page)).toBe(true);
  await page.goBack();
  await openCode(page);
  await expect(editor(page)).toHaveText("// in-memory fallback");
  await page.evaluate(() => localStorage.removeItem("deny-drafts"));
  await page.getByRole("button", { name: "Tentar salvar novamente" }).click();
  await expect.poll(() => codes(page)).toEqual(["// in-memory fallback"]);
  await expect(
    page.getByText(/Não foi possível atualizar a cópia/),
  ).toHaveCount(0);
  expect(await protectedExit(page)).toBe(false);
});

test("resolving one pending exercise keeps protection until the other exercise is resolved", async ({
  page,
}) => {
  await denyDraftWrites(page);
  await page.goto(fixture);
  await openCode(page);
  await page.evaluate(() => localStorage.setItem("deny-drafts", "1"));
  await failEdit(page, "// pending first lesson");
  await page.getByRole("link", { name: "Próxima lição", exact: true }).click();
  await openCode(page);
  await failEdit(page, "// pending second lesson");
  await page.goBack();
  await openCode(page);
  await expect(editor(page)).toHaveText("// pending first lesson");
  await page.getByRole("button", { name: "Descartar edição pendente" }).click();
  await expect.poll(() => copies(page)).toHaveLength(1);
  expect(await protectedExit(page)).toBe(true);
  await page.goForward();
  await openCode(page);
  await expect(editor(page)).toHaveText("// pending second lesson");
  await page.getByRole("button", { name: "Descartar edição pendente" }).click();
  await expect.poll(() => copies(page)).toEqual([]);
  expect(await protectedExit(page)).toBe(false);
});

test("failed recovery cleanup is explicit and retry removes the last protection without resurrecting text", async ({
  page,
}) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await page.addInitScript(() => {
    const remove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
      if (
        key.startsWith("bunkercode:practice-recovery:v1:") &&
        localStorage.getItem("deny-recovery-cleanup") === "1"
      )
        throw new DOMException("Cleanup denied", "SecurityError");
      remove.call(this, key);
    };
  });
  await page.goto(url);
  await openCode(page);
  await page.evaluate(() => localStorage.setItem("deny-recovery-cleanup", "1"));
  await editor(page).fill("// confirmed despite recovery cleanup failure");
  await expect
    .poll(() => codes(page))
    .toEqual(["// confirmed despite recovery cleanup failure"]);
  await expect(
    page.getByText(/Não foi possível remover a cópia/),
  ).toBeVisible();
  expect(await protectedExit(page)).toBe(true);
  await page.reload();
  await openCode(page);
  await expect(editor(page)).toHaveText(
    "// confirmed despite recovery cleanup failure",
  );
  await page.evaluate(() => localStorage.removeItem("deny-recovery-cleanup"));
  await page.getByRole("button", { name: "Tentar salvar novamente" }).click();
  await expect.poll(() => copies(page)).toEqual([]);
  expect(await protectedExit(page)).toBe(false);
  await page.reload();
  await openCode(page);
  expect(await protectedExit(page)).toBe(false);
});

test("a third save during conflict review is not overwritten by an outdated explicit choice", async ({
  page,
  context,
}) => {
  await page.goto(url);
  await openCode(page);
  const other = await context.newPage();
  await other.goto(url);
  await openCode(other);
  await editor(page).fill("// confirmed A first");
  await expect.poll(() => codes(page)).toEqual(["// confirmed A first"]);
  await editor(other).fill("// B awaiting review");
  await expect(
    other.getByRole("region", { name: "Revisão de conflito" }),
  ).toContainText("// confirmed A first");
  await editor(page).fill("// confirmed A latest");
  await expect.poll(() => codes(page)).toEqual(["// confirmed A latest"]);
  await other
    .getByRole("button", { name: "Manter meu código e salvar" })
    .click();
  await expect(
    other.getByRole("region", { name: "Revisão de conflito" }),
  ).toContainText("// confirmed A latest");
  await expect(editor(other)).toHaveText("// B awaiting review");
  expect(await codes(other)).toEqual(["// confirmed A latest"]);
  expect(await copies(other)).toHaveLength(1);
});
