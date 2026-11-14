import {
  expectRenderedContrast,
  selectReadingTone,
  selectSiteTheme,
} from "./reading-theme-checks";
import { test as authenticatedTest } from "./auth-fixture";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { studioView } from "./studio-controls";
import { expect, test } from "@playwright/test";
import {
  setLessonSqlPlacement,
  parseCourse as parseCourseManifest,
} from "@bunkercode/content";

const sqlLessonPath =
  "/courses/sql-na-pratica/lessons/seu-primeiro-contato-com-um-banco-de-dados";
let lessonBeforeMigration: string | undefined;
const migratedLessonFile = () =>
  join(
    process.env.BUNKERCODE_BROWSER_CONTENT_DIR!,
    "courses/sql-na-pratica/lessons/seu-primeiro-contato-com-um-banco-de-dados/lesson.md",
  );
// Only the supervisor-owned content fixture is changed; canonical lessons stay untouched.
async function openSqlLesson(
  page: import("@playwright/test").Page,
  exerciseId = "store-customers-recife",
  version = 2,
  workerFailure = false,
) {
  lessonBeforeMigration ??= await readFile(migratedLessonFile(), "utf8");
  await writeFile(
    migratedLessonFile(),
    setLessonSqlPlacement(lessonBeforeMigration, {
      kind: "sql",
      exerciseId,
      version,
    }),
  );
  await page.goto(sqlLessonPath);
  await expect(
    page.getByRole("textbox", { name: "Consulta SQL" }),
  ).toBeVisible();
  if (!workerFailure)
    await expect(
      page.getByRole("region", { name: "Registros de customers", exact: true }),
    ).toBeVisible({ timeout: 65000 });
  await page.getByText("Opções da prática", { exact: true }).click();
}
test.afterEach(async () => {
  if (lessonBeforeMigration !== undefined) {
    await writeFile(migratedLessonFile(), lessonBeforeMigration);
    lessonBeforeMigration = undefined;
  }
});

test("SQL lesson executes, verifies, recovers and resets without application SQL requests", async ({
  page,
}) => {
  test.setTimeout(150000);
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/")) apiRequests.push(request.url());
  });
  await openSqlLesson(page);
  const editor = page.getByRole("textbox", { name: "Consulta SQL" });
  const status = page.locator(".sql-workspace [role=status]");
  const execute = page.getByRole("button", { name: "Executar consulta" });
  await expect(
    page.getByRole("button", { name: "Verificar resposta" }),
  ).toHaveCount(0);
  const write = async (sql: string) => editor.fill(sql);
  await expect(editor).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Entrar", exact: true }),
  ).toBeVisible();
  apiRequests.length = 0;
  await execute.click();
  await expect(status).toContainText("Ainda não corresponde", {
    timeout: 65000,
  });
  await expect(page.getByRole("cell", { name: "Ana Lima" })).toBeVisible();
  await write(
    "SELECT * FROM customers WHERE city = 'Recife' ORDER BY name DESC;",
  );
  await execute.click();
  await expect(
    page.locator(".sql-data-caption").filter({ hasText: "2 linhas" }),
  ).toBeVisible();
  await expect(page.locator("tbody tr").first()).toContainText("Carla Souza");
  await expect(status).toContainText("Consulta correta.");
  await write(
    "SELECT c.name, count(*)::int AS purchases FROM customers c JOIN orders o ON c.id = o.customer_id GROUP BY c.id, c.name ORDER BY c.id;",
  );
  await execute.click();
  await expect(
    page.getByRole("columnheader", { name: "purchases" }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(3);
  for (const sql of [
    "SELECT missing FROM customers;",
    "SELECT 1; SELECT 2",
    "EXPLAIN SELECT * FROM customers",
  ]) {
    await write(sql);
    await execute.click();
    await expect(status).toContainText("Erro SQL");
  }
  await write("SELECT note FROM orders WHERE id = 102;");
  await execute.click();
  await expect(page.getByRole("cell", { name: "NULL" })).toBeVisible();
  await write("SELECT * FROM customers WHERE city = 'Manaus';");
  await execute.click();
  await expect(
    page.locator(".sql-data-caption").filter({ hasText: "0 linhas" }),
  ).toBeVisible();
  await expect(page.getByRole("columnheader")).toHaveText([
    "id",
    "name",
    "city",
  ]);
  await expect(
    page.getByText("Nenhuma linha corresponde à consulta."),
  ).toBeVisible();
  await write("SELECT * FROM generate_series(1, 200) AS n;");
  await execute.click();
  await expect(page.getByText(/limite de 100/)).toBeVisible();
  await write("SELECT pg_sleep(1), 'old result' AS stale;");
  await execute.click();
  await expect(execute).toHaveAttribute("aria-disabled", "true");
  await write("SELECT * FROM customers;");
  await expect(status).toContainText("A consulta mudou durante", {
    timeout: 5000,
  });
  await expect(page.getByRole("columnheader", { name: "stale" })).toHaveCount(
    0,
  );
  await execute.click();
  await expect(
    page.locator(".sql-data-caption").filter({ hasText: "4 linhas" }),
  ).toBeVisible();
  await write("SELECT pg_sleep(30);");
  await execute.click();
  await expect(status).toContainText("O tempo limite terminou", {
    timeout: 25000,
  });
  await write("SELECT * FROM customers;");
  await execute.click();
  await expect(
    page.locator(".sql-data-caption").filter({ hasText: "4 linhas" }),
  ).toBeVisible({
    timeout: 65000,
  });
  await write("SELECT pg_sleep(30);");
  await execute.click();
  await page.getByRole("button", { name: "Cancelar e descartar" }).click();
  await expect(status).toContainText(
    "Consulta cancelada e ambiente descartado",
  );
  await page.getByRole("button", { name: "Reiniciar banco" }).click();
  await expect(status).toContainText("Banco descartado");
  await write("SELECT * FROM customers;");
  await execute.click();
  await expect(
    page.locator(".sql-data-caption").filter({ hasText: "4 linhas" }),
  ).toBeVisible({
    timeout: 65000,
  });
  expect(apiRequests.filter((url) => !url.includes("/content/sql/"))).toEqual(
    [],
  );
  await write("SELECT pg_sleep(30);");
  await execute.click();
  // Stay in the same document so this exercises React unmount/Worker disposal.
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Táticas", exact: true })
    .click();
  await expect(page).toHaveURL(/\/tactics$/);
  await page.goBack();
  await expect(editor).toHaveText("SELECT * FROM customers;");
  await expect(
    page.getByRole("region", { name: "Registros de customers", exact: true }),
  ).toBeVisible({ timeout: 65000 });
  await execute.click();
  await expect(
    page.locator(".sql-data-caption").filter({ hasText: "4 linhas" }),
  ).toBeVisible({
    timeout: 65000,
  });
  await page.getByRole("heading", { level: 1 }).click();
  await page.screenshot({
    path: test.info().outputPath("sql-desktop-dark.png"),
    fullPage: true,
  });
});

test("SQL interaction keeps readable themes, keyboard focus, empty schemas and mobile layout", async ({
  page,
}) => {
  test.setTimeout(90000);
  await openSqlLesson(page);
  const editor = page.getByRole("textbox", { name: "Consulta SQL" });
  await editor.fill("SELECT * FROM customers WHERE false;");
  await page.getByRole("button", { name: "Executar consulta" }).click();
  await expect(
    page.locator(".sql-data-caption").filter({ hasText: "0 linhas" }),
  ).toBeVisible({
    timeout: 65000,
  });
  for (const theme of ["Light", "Dark"]) {
    await page
      .getByRole("button", { name: "Tema do site", exact: true })
      .click();
    await page.getByRole("button", { name: theme, exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator("html")).toHaveAttribute(
      "data-site-theme",
      theme === "Light" ? "light" : "bunkercode",
    );
    await selectReadingTone(page, theme === "Light" ? 3 : 0);
    await page
      .getByRole("button", { name: "Ajustar lição", exact: true })
      .click();
    await expect(page.locator(".cm-editor")).toHaveCSS(
      "background-color",
      await page
        .locator(".study-explanation")
        .evaluate((node) => getComputedStyle(node).backgroundColor),
    );
    await expectRenderedContrast(
      page.locator(
        ".sql-notice, .sql-challenge p, .sql-schema li, .sql-workspace [role=status], .cm-content",
      ),
    );
    await expect(page.getByRole("columnheader")).toHaveText([
      "id",
      "name",
      "city",
    ]);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await editor.click();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Executar consulta" }),
    ).toBeFocused();
    await page.screenshot({
      path: test.info().outputPath(`sql-mobile-${theme.toLowerCase()}.png`),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1280, height: 960 });
    if (theme === "Light")
      await page.screenshot({
        path: test.info().outputPath("sql-desktop-light.png"),
        fullPage: true,
      });
  }
});

authenticatedTest(
  "table explorer keeps the editor and valid feedback while reading real rows",
  async ({ page }) => {
    test.setTimeout(90000);
    await openSqlLesson(page);
    const editor = page.getByRole("textbox", { name: "Consulta SQL" });
    const sql = "SELECT * FROM customers WHERE city = 'Recife'";
    await editor.fill(sql);
    await page.getByRole("button", { name: "Executar consulta" }).click();
    const status = page.locator(".sql-workspace [role=status]");
    await expect(status).toContainText("Consulta correta.", {
      timeout: 45000,
    });
    await page.getByRole("button", { name: "Dados", exact: true }).click();
    await page.getByLabel("Tabela", { exact: true }).selectOption("orders");
    const records = page.getByRole("region", { name: "Registros de orders" });
    await expect(
      records.getByRole("cell", { name: "Livros", exact: true }),
    ).toBeVisible();
    await expect(
      records.getByRole("columnheader", { name: "customer_id", exact: true }),
    ).toBeVisible();
    await expect(editor).toHaveText(sql);
    await expect(status).toContainText("Consulta correta.", {
      timeout: 45000,
    });
    await page.setViewportSize({ width: 375, height: 812 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Resultado", exact: true }).click();
    await expect(page.getByLabel("Tabela", { exact: true })).not.toBeVisible();
    await expect(editor).toHaveText(sql);
    await page.setViewportSize({ width: 812, height: 375 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(editor).toHaveText(sql);
  },
);

authenticatedTest.describe("SQL lesson integration", () => {
  const root = () =>
    join(process.env.BUNKERCODE_BROWSER_CONTENT_DIR!, "courses", "sql-pilot");
  const path = "/courses/sql-pilot/lessons/choose-data";
  authenticatedTest.beforeAll(async () => {
    await mkdir(join(root(), "lessons", "choose-data"), { recursive: true });
    await mkdir(join(root(), "lessons", "next-step"), { recursive: true });
    await writeFile(
      join(root(), "course.json"),
      JSON.stringify({
        id: "sql-pilot",
        title: "Amostra SQL não publicada",
        description: "Fixture técnica isolada.",
        lessons: [
          { slug: "choose-data", title: "Escolher dados de uma tabela" },
          { slug: "next-step", title: "Próxima etapa" },
        ],
      }),
    );
    await writeFile(
      join(root(), "lessons", "choose-data", "lesson.md"),
      await readFile(
        resolve("../../docs/examples/sql-select-pilot.md"),
        "utf8",
      ),
    );
    await writeFile(
      join(root(), "lessons", "next-step", "lesson.md"),
      "# Próxima etapa\n\nExplique sua consulta.",
    );
  });
  authenticatedTest(
    "real reader and Studio preview execute SQL without submitting progress",
    async ({ page }) => {
      authenticatedTest.setTimeout(90000);
      const forbidden: string[] = [];
      page.on("request", (request) => {
        if (
          /\/api\/(practice|learning).*\/(complete|submit|run)/.test(
            request.url(),
          )
        )
          forbidden.push(request.url());
      });
      await page.goto(path);
      await expect(page.locator(".lesson-heading h1")).toHaveText(
        "Escolher dados de uma tabela",
      );
      const editor = page.getByRole("textbox", { name: "Consulta SQL" });
      const sql = "SELECT * FROM customers WHERE city = 'Recife'";
      await editor.fill(sql);
      await page.getByRole("button", { name: "Executar consulta" }).click();
      await expect(page.locator(".sql-workspace [role=status]")).toContainText(
        "Consulta concluída.",
        { timeout: 65000 },
      );
      await expect(
        page.getByRole("button", { name: "Marcar como concluída" }),
      ).toHaveCount(0);
      // Resizing preserves the same SQL session and editor.
      await page.setViewportSize({ width: 375, height: 812 });
      await expect(
        page.getByRole("button", { name: "Código", exact: true }),
      ).toHaveCount(0);
      await expect(editor).toHaveText(sql);
      await expect(page.locator(".sql-workspace [role=status]")).toContainText(
        "Consulta concluída.",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: test.info().outputPath("sql-lesson-mobile.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 1440, height: 960 });
      for (const tone of [0, 1, 2, 3, 4, 5]) {
        await selectReadingTone(page, tone);
        await expect(editor).toHaveText(sql);
        await expect(
          page.locator(".sql-workspace [role=status]"),
        ).toContainText("Consulta concluída.");
        await expectRenderedContrast(
          page.locator(
            ".sql-notice, .sql-challenge p, .sql-workspace [role=status], .cm-content",
          ),
        );
        const backgrounds = await page
          .locator(".cm-editor")
          .evaluate((node) => ({
            editor: getComputedStyle(node).backgroundColor,
            reader: getComputedStyle(
              document.querySelector(".study-explanation")!,
            ).backgroundColor,
          }));
        expect(backgrounds.editor).toBe(backgrounds.reader);
      }
      await page.keyboard.press("Escape");
      await page.screenshot({
        path: test.info().outputPath("sql-lesson-desktop.png"),
        fullPage: true,
      });
      await page
        .getByRole("link", { name: "Editar lição", exact: true })
        .click();
      await studioView(page, "Prévia");
      await expect(editor).toHaveText("SELECT * FROM customers;");
      await page.getByRole("button", { name: "Executar consulta" }).click();
      await expect(page.locator(".sql-workspace [role=status]")).toHaveText(
        "Consulta concluída.",
        { timeout: 65000 },
      );
      await expect(page.locator(".sql-workspace tbody tr")).toHaveCount(4);
      await studioView(page, "Editar fonte Markdown");
      const source = page.getByRole("textbox", {
        name: "Markdown completo",
        exact: true,
      });
      const saved =
        (await source.inputValue()) + "\n\nObservação técnica da prévia SQL.\n";
      await source.fill(saved);
      await page.getByRole("button", { name: "Salvar alterações" }).click();
      await expect(page.getByRole("status")).toHaveText("Salvo no arquivo.");
      expect(
        await readFile(
          join(root(), "lessons", "choose-data", "lesson.md"),
          "utf8",
        ),
      ).toBe(saved);

      await page
        .getByRole("link", { name: "Voltar à lição", exact: true })
        .click();
      await expect(editor).toHaveText("SELECT * FROM customers;");
      await editor.fill("SELECT pg_sleep(30)");
      await page.getByRole("button", { name: "Executar consulta" }).click();
      await openSqlLesson(page);
      await expect(editor).toHaveText("SELECT * FROM customers;");
      expect(forbidden).toEqual([]);
    },
  );
});

authenticatedTest(
  "mutation execution accumulates disposable changes and verification never repeats them",
  async ({ page }) => {
    test.setTimeout(150000);
    await openSqlLesson(page, "store-update-city", 1);
    const editor = page.getByRole("textbox", { name: "Consulta SQL" });
    const status = page.locator(".sql-workspace [role=status]");
    const execute = page.getByRole("button", { name: "Executar comando" });
    const verify = page.getByRole("button", { name: "Verificar estado" });
    const correct =
      "UPDATE customers SET city = CASE WHEN city = 'Olinda' THEN 'Recife' ELSE 'Corrompido' END WHERE id = 2";
    await editor.fill(correct);
    await verify.click();
    await expect(status).toContainText("Envie de 1 a 20 comandos SQL");
    await editor.fill("UPDATE customers SET missing = 1");
    await execute.click();
    await expect(status).toContainText("Erro SQL");
    await editor.fill(correct);
    await execute.click();
    await expect(status).toContainText("1 linha afetada");
    await verify.click();
    await expect(status).toContainText("Resposta correta!", {
      timeout: 45000,
    });
    await editor.fill("DELETE FROM customers");
    await expect(status).toContainText("Texto alterado e ainda não executado");
    await expect(status).not.toContainText("Resposta correta!");
    await page.screenshot({
      path: test.info().outputPath("sql-mutation-unexecuted-edit.png"),
      fullPage: true,
    });

    // Hold the second real check, preserving the original repeated-check coverage
    // while testing an edit during verification without another Docker evaluation.
    let arrived!: () => void, release!: () => void;
    const ready = new Promise<void>((r) => (arrived = r));
    const hold = new Promise<void>((r) => (release = r));
    await page.route("**/api/sql/check", async (route) => {
      const response = await route.fetch();
      arrived();
      await hold;
      await route.fulfill({ response });
    });
    await verify.click();
    await ready;
    await editor.fill("UPDATE customers SET city = 'Unexecuted'");
    release();
    await expect(status).toContainText("Resposta correta!", {
      timeout: 45000,
    });
    await expect(status).toContainText(
      "somente o estado dos comandos executados",
    );
    await expect(status).toContainText(
      "O texto do editor mudou e ainda não foi executado",
    );
    await page.unroute("**/api/sql/check");
    await page.getByRole("button", { name: "Dados", exact: true }).click();
    const records = page.getByRole("region", {
      name: "Registros de customers",
    });
    await expect(
      records.locator("tbody tr").filter({ hasText: "Bruno Alves" }),
    ).toContainText("Recife");
    await expect(status).toContainText("Resposta correta!");
    await editor.fill("UPDATE customers SET city = 'Recife'");
    await execute.click();
    await verify.click();
    await expect(status).toContainText("O estado ainda não corresponde", {
      timeout: 45000,
    });
    await page.getByRole("button", { name: "Reiniciar banco" }).click();
    await page.getByRole("button", { name: "Dados", exact: true }).click();
    await expect(
      records.locator("tbody tr").filter({ hasText: "Bruno Alves" }),
    ).toContainText("Olinda", { timeout: 65000 });
    await expect(editor).toHaveText("UPDATE customers SET city = 'Recife'");
    await page.screenshot({
      path: test.info().outputPath("sql-mutation-preview.png"),
      fullPage: true,
    });
    await openSqlLesson(page);
    await expect(editor).toHaveText("SELECT * FROM customers;");
    await page.getByRole("button", { name: "Executar consulta" }).click();
    await expect(status).toContainText("Ainda não corresponde", {
      timeout: 65000,
    });
  },
);

authenticatedTest(
  "mutation cancellation ignores late checks and restores deterministic table previews",
  async ({ page }) => {
    test.setTimeout(90000);
    await openSqlLesson(page, "store-update-city", 1);
    const editor = page.getByRole("textbox", { name: "Consulta SQL" });
    const status = page.locator(".sql-workspace [role=status]");
    const execute = page.getByRole("button", { name: "Executar comando" });
    const verify = page.getByRole("button", { name: "Verificar estado" });
    await editor.fill("UPDATE customers SET city = 'Recife' WHERE id = 2");
    await execute.click();
    await expect(status).toContainText("Comando concluído", { timeout: 65000 });
    let arrived!: () => void, release!: () => void, delivered!: () => void;
    const ready = new Promise<void>((r) => (arrived = r));
    const hold = new Promise<void>((r) => (release = r));
    const done = new Promise<void>((r) => (delivered = r));
    await page.route("**/api/sql/check", async (route) => {
      const response = await route.fetch();
      arrived();
      await hold;
      try {
        await route.fulfill({ response });
      } catch (error) {
        if (!route.request().failure()) throw error;
      } finally {
        delivered();
      }
    });
    await verify.click();
    await ready;
    await page.getByRole("button", { name: "Cancelar e descartar" }).click();
    release();
    await done;
    await page.unroute("**/api/sql/check");
    await expect(status).toContainText(
      "Consulta cancelada e ambiente descartado",
    );
    await expect(status).not.toContainText("Consulta correta.");
    await verify.click();
    await expect(status).toContainText("Envie de 1 a 20 comandos SQL");
    await page.getByRole("button", { name: "Dados", exact: true }).click();
    await expect(
      page
        .getByRole("region", { name: "Registros de customers" })
        .locator("tbody tr")
        .filter({ hasText: "Bruno Alves" }),
    ).toContainText("Olinda", { timeout: 65000 });
    await editor.fill("DELETE FROM orders");
    await execute.click();
    await expect(status).toContainText("Comando concluído");
    await page.getByRole("button", { name: "Dados", exact: true }).click();
    await page.getByLabel("Tabela", { exact: true }).selectOption("orders");
    await expect(
      page.getByText("Esta tabela não contém registros."),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Registros de orders" })
        .getByRole("columnheader"),
    ).toHaveText(["id", "customer_id", "total", "note"]);
    await expect(
      page.getByText("Nenhuma linha corresponde à consulta."),
    ).toHaveCount(0);
    await page.screenshot({
      path: test.info().outputPath("sql-empty-table-preview.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Reiniciar banco" }).click();
    await page.getByRole("button", { name: "Dados", exact: true }).click();
    await expect(
      page
        .getByRole("region", { name: "Registros de orders" })
        .locator("tbody tr"),
    ).toHaveCount(4);
  },
);

authenticatedTest(
  "SQL lessons switch published activities and grade progressive real queries",
  async ({ page }) => {
    test.setTimeout(220000);
    const { laboratoryExercises } = await import("./sql-fixtures");
    for (const exercise of laboratoryExercises) {
      if (exercise.mode !== "query") continue;
      await openSqlLesson(page, exercise.id, 2);
      const editor = page.getByRole("textbox", { name: "Consulta SQL" });
      await expect(editor).toHaveText(exercise.starterSql);
      await editor.fill(exercise.expectedQuery);
      await page.getByRole("button", { name: "Executar consulta" }).click();
      await expect(page.locator(".sql-workspace [role=status]")).toContainText(
        "Consulta correta.",
        { timeout: 65000 },
      );
      if (exercise.orderMatters) {
        await editor.fill(exercise.expectedQuery.replace("DESC", "ASC"));
        await page.getByRole("button", { name: "Executar consulta" }).click();
        await expect(
          page.locator(".sql-workspace [role=status]"),
        ).toContainText("Ainda não corresponde", { timeout: 45000 });
      }
    }
  },
);

test("real Worker failure discards the session and the next action recovers", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    const OriginalWorker = window.Worker;
    let failed = false;
    window.Worker = class extends OriginalWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        const inject = !failed && String(url).includes("sql.worker");
        const fault = inject
          ? URL.createObjectURL(
              new Blob(["throw new Error('SQL Worker test failure')"], {
                type: "text/javascript",
              }),
            )
          : null;
        super(fault ?? url, options);
        if (inject) failed = true;
      }
    };
  });
  await openSqlLesson(page, "store-customers-recife", 2, true);
  await expect(page.locator(".sql-workspace [role=status]")).toContainText(
    "O laboratório falhou",
  );
  await page.getByRole("button", { name: "Executar consulta" }).click();
  await expect(page.locator(".sql-workspace [role=status]")).toContainText(
    "Ainda não corresponde",
    { timeout: 65000 },
  );
});

authenticatedTest(
  "legacy single SQL lessons verify, submit, reopen approved source and navigate lessons",
  async ({ page, context }) => {
    authenticatedTest.setTimeout(180000);
    const content = process.env.BUNKERCODE_BROWSER_CONTENT_DIR;
    if (!content) throw new Error("Missing supervisor-owned content fixture");
    const fixtures = [
      ["seu-primeiro-contato-com-um-banco-de-dados", "store-select-columns"],
      ["encontrando-o-que-importa", "store-filter-sort"],
    ].map(([slug, exerciseId]) => ({
      path: join(content, "courses/sql-na-pratica/lessons", slug!, "lesson.md"),
      exerciseId: exerciseId!,
    }));
    const originals = await Promise.all(
      fixtures.map((fixture) => readFile(fixture.path, "utf8")),
    );
    try {
      for (const [index, fixture] of fixtures.entries()) {
        await writeFile(
          fixture.path,
          setLessonSqlPlacement(originals[index]!, {
            kind: "sql",
            exerciseId: fixture.exerciseId,
            version: 2,
          }),
        );
      }
      await page.goto("/courses");
      await page.getByRole("link", { name: /SQL na Prática/ }).click();
      await page
        .getByRole("link", {
          name: /Seu primeiro contato com um banco de dados/,
        })
        .first()
        .click();
      const editor = page.getByRole("textbox", { name: "Consulta SQL" });
      const status = page.locator(".sql-workspace [role=status]");
      await expect(editor).toBeVisible();
      await page.getByText("Opções da prática", { exact: true }).click();
      await editor.fill("SELECT name FROM customers");
      await page
        .getByRole("button", { name: "Submit · concluir lição" })
        .click();
      await expect(status).toContainText("Ainda não corresponde", {
        timeout: 45000,
      });
      await expect(
        page.getByText("Lição concluída", { exact: true }),
      ).toHaveCount(0);
      await editor.fill("SELECT id,name FROM customers ORDER BY id DESC");
      await page.getByRole("button", { name: "Executar consulta" }).click();
      await expect(status).toContainText("Consulta correta.", {
        timeout: 45000,
      });
      await expect(
        page.getByText("Lição concluída", { exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Submit · concluir lição" })
        .click();
      await expect(status).toContainText("Conclusão da lição registrada", {
        timeout: 45000,
      });
      await expect(
        page.getByText("Lição concluída", { exact: true }),
      ).toBeVisible();
      await editor.fill("SELECT 1");
      await expect(
        page.getByText("Lição concluída", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Carregar solução aprovada" }),
      ).toBeVisible();
      await page.reload();
      await page.getByText("Opções da prática", { exact: true }).click();
      await page
        .getByRole("button", { name: "Carregar solução aprovada" })
        .click();
      await expect(editor).toHaveText(
        "SELECT id,name FROM customers ORDER BY id DESC",
      );
      await page.screenshot({
        path: test.info().outputPath("sql-course-approved-dark.png"),
        fullPage: true,
      });
      await page.goto(
        "/courses/sql-na-pratica/lessons/encontrando-o-que-importa",
      );
      await expect(page.locator(".lesson-heading h1")).toHaveText(
        "Encontrando o que importa",
      );
      await page.getByText("Opções da prática", { exact: true }).click();
      await editor.fill(
        "SELECT name,city FROM customers WHERE city <> 'Recife' ORDER BY name DESC",
      );
      await page
        .getByRole("button", { name: "Submit · concluir lição" })
        .click();
      await expect(status).toContainText("Conclusão da lição registrada", {
        timeout: 45000,
      });

      let release!: () => void, arrived!: () => void, finished!: () => void;
      const hold = new Promise<void>((resolve) => (release = resolve)),
        ready = new Promise<void>((resolve) => (arrived = resolve)),
        delivered = new Promise<void>((resolve) => (finished = resolve));
      await page.route(
        "**/api/learning/courses/sql-na-pratica/lessons/encontrando-o-que-importa/solution",
        async (route) => {
          const response = await route.fetch();
          arrived();
          await hold;
          try {
            await route.fulfill({ response });
          } catch (error) {
            if (!route.request().failure()) throw error;
          } finally {
            finished();
          }
        },
      );
      await page.reload();
      await ready;
      const other = await context.newPage();
      await other.goto("/");
      await other.getByRole("button", { name: "Sair", exact: true }).click();
      await expect(
        page.getByRole("link", { name: "Entrar", exact: true }),
      ).toBeVisible();
      release();
      await delivered;
      await expect(
        page.getByRole("button", { name: "Carregar solução aprovada" }),
      ).toHaveCount(0);
      await other.close();
    } finally {
      await Promise.all(
        fixtures.map((fixture, index) =>
          writeFile(fixture.path, originals[index]!),
        ),
      );
    }
  },
);

authenticatedTest(
  "Studio creates dataset and exercise, tests and publishes reference, attaches and opens the real lesson",
  async ({ page, request }) => {
    authenticatedTest.setTimeout(220000);
    const suffix = Date.now().toString(36),
      exerciseId = "browser-authored-" + suffix,
      datasetId = "browser-data-" + suffix;
    const first =
      "/courses/sql-na-pratica/lessons/seu-primeiro-contato-com-um-banco-de-dados";
    await page.goto(first + "/edit");
    await page
      .getByText("Biblioteca e vínculos avançados", { exact: true })
      .click();
    await page
      .getByRole("link", {
        name: "Abrir biblioteca de exercícios e dados",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", { name: "Atividades SQL" }),
    ).toBeVisible();
    await page.getByText("Datasets reutilizáveis", { exact: true }).click();
    const dataset = {
      format: 1,
      id: datasetId,
      version: 1,
      title: "Dados fictícios criados no Studio",
      tables: [
        {
          name: "items",
          columns: [
            {
              name: "id",
              type: "integer",
              nullable: false,
              primaryKey: true,
              references: null,
            },
            {
              name: "name",
              type: "text",
              nullable: false,
              primaryKey: false,
              references: null,
            },
          ],
          rows: [
            [1, "Caderno"],
            [2, "Caneta"],
          ],
        },
      ],
    };
    await page
      .getByLabel("Definição do dataset", { exact: true })
      .fill(JSON.stringify(dataset, null, 2));
    await page.getByRole("button", { name: "Salvar dataset" }).click();
    await expect(page.getByRole("status")).toContainText("Dataset publicado");
    await page.getByRole("button", { name: "Novo exercício" }).click();
    await page.getByLabel("ID do exercício").fill(exerciseId);
    await page
      .getByLabel("Publicar resultado esperado", { exact: false })
      .check();
    await page
      .getByLabel("Título", { exact: true })
      .fill("Listar materiais — criação pelo Studio");
    await page
      .getByLabel("Objetivo", { exact: true })
      .fill("Selecionar nomes de materiais fictícios.");
    await page
      .getByLabel("Instruções públicas")
      .fill(
        "Retorne name de todos os materiais. A ordem das linhas não importa.",
      );
    await page
      .getByLabel("Dataset do exercício")
      .selectOption(datasetId + "/1");
    await page.getByLabel("SQL inicial público").fill("SELECT * FROM items;");
    await page
      .getByLabel("Referência 1", { exact: true })
      .fill("SELECT name FROM items");
    await page
      .getByLabel("Publicar resultado esperado", { exact: false })
      .uncheck();
    await page
      .getByRole("button", { name: "Prévia do exercício", exact: true })
      .click();
    const preview = page.locator('[aria-label="Prévia do exercício SQL"]'); // section with aria-label has region semantics.
    await preview.getByRole("button", { name: "Executar consulta" }).click();
    await expect(preview.locator(".sql-workspace [role=status]")).toHaveText(
      "Consulta concluída.",
      { timeout: 65000 },
    );
    await expect(preview.getByRole("cell", { name: "Caderno" })).toBeVisible();
    await page
      .getByLabel("Publicar resultado esperado", { exact: false })
      .check();
    await page.getByRole("button", { name: "Salvar rascunho" }).click();
    await expect(page.locator(".sql-authoring > [role=status]")).toContainText(
      "Rascunho salvo",
    );
    await page.getByRole("button", { name: "Testar referência" }).click();
    await expect(page.locator(".sql-authoring > [role=status]")).toContainText(
      "Referência aprovada",
      { timeout: 45000 },
    );
    await preview
      .getByRole("textbox", { name: "Consulta SQL" })
      .fill("SELECT name FROM items");
    await preview.getByRole("button", { name: "Executar consulta" }).click();
    await expect(preview.locator(".sql-workspace [role=status]")).toContainText(
      "Resposta correta nesta prática!",
      { timeout: 65000 },
    );
    await page.getByRole("button", { name: "Publicar versão" }).click();
    await expect(page.locator(".sql-authoring > [role=status]")).toContainText(
      "Publicado:",
      { timeout: 45000 },
    );
    const physical = JSON.parse(
      await readFile(
        join(
          process.env.BUNKERCODE_BROWSER_CONTENT_DIR!,
          "sql/exercises",
          exerciseId,
          "1.json",
        ),
        "utf8",
      ),
    ) as { status: string };
    expect(physical.status).toBe("published");
    const lab = await request.get("/api/content/sql/exercises");
    expect(lab.ok()).toBe(true);
    expect(await lab.text()).not.toContain(exerciseId);
    const references = await request.get("/api/content/sql/references");
    expect(references.ok()).toBe(true);
    expect(await references.text()).toContain(exerciseId);
    await page.screenshot({
      path: test.info().outputPath("sql-studio-published-dark.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Tema do site", exact: true })
      .click();
    await page.getByRole("button", { name: "Light", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator("html")).toHaveAttribute(
      "data-site-theme",
      "light",
    );
    await page.screenshot({
      path: test.info().outputPath("sql-studio-published-light.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = await page.evaluate(() => ({
      viewport: innerWidth,
      width: document.documentElement.scrollWidth,
      overflow: [
        ...document.querySelectorAll(".sql-authoring, .sql-authoring *"),
      ]
        .filter((node) => node.getBoundingClientRect().right > innerWidth + 1)
        .map((node) => ({
          tag: node.tagName,
          className: node.className,
          width: node.getBoundingClientRect().width,
        }))
        .slice(0, 20),
    }));
    console.log("SQL authoring mobile bounds:", JSON.stringify(mobile));
    expect(mobile.width).toBeLessThanOrEqual(mobile.viewport);
    await page.screenshot({
      path: test.info().outputPath("sql-studio-mobile.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1280, height: 960 });
    await page.goto(first + "/edit");
    await studioView(page, "Editar fonte Markdown");
    const source = page.getByRole("textbox", {
      name: "Markdown completo",
      exact: true,
    });
    const original = await source.inputValue();
    // This existing scenario covers single-exercise replacement and publication.
    // Canonical lessons now start as sequences, whose selector adds a task.
    await source.fill(
      setLessonSqlPlacement(original, {
        kind: "sql",
        exerciseId: "store-select-columns",
        version: 2,
      }),
    );
    await page
      .getByText("Biblioteca e vínculos avançados", { exact: true })
      .click();
    await page
      .getByLabel("Atividade SQL publicada", { exact: true })
      .selectOption(exerciseId + "/1");
    await expect(source).toContainText(exerciseId);
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByRole("status")).toHaveText("Salvo no arquivo.");
    try {
      await page
        .getByRole("link", { name: "Voltar à lição", exact: true })
        .click();
      await expect(
        page.getByRole("heading", {
          name: "Listar materiais — criação pelo Studio",
        }),
      ).toBeVisible();
      await page
        .getByRole("textbox", { name: "Consulta SQL" })
        .fill("SELECT name FROM items");
      await page.getByRole("button", { name: "Executar consulta" }).click();
      await expect(page.locator(".sql-workspace [role=status]")).toContainText(
        "Consulta correta.",
        { timeout: 45000 },
      );
    } finally {
      await page.goto(first + "/edit");
      await studioView(page, "Editar fonte Markdown");
      await source.fill(original);
      await page.getByRole("button", { name: "Salvar alterações" }).click();
      await expect(page.getByRole("status")).toHaveText("Salvo no arquivo.");
    }
  },
);

// Diagnostic capture is opt-in, local to this test, and never sent to an API.
async function captureSqlTimings(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const Original = window.Worker;
    const samples: Record<string, unknown>[] = [];
    Object.defineProperty(window, "__sqlMeasurements", { value: samples });
    window.Worker = class extends Original {
      private measured: boolean;
      private created = performance.timeOrigin + performance.now();
      private requests = new Map<
        number,
        { started: number; operation: unknown; sql?: string }
      >();
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.measured = String(url).includes("sql.worker");
        if (this.measured)
          this.addEventListener("message", (event) => {
            const received = performance.timeOrigin + performance.now();
            samples.push({
              type: event.data.type,
              created: this.created,
              started: this.requests.get(event.data.id)?.started,
              operation: this.requests.get(event.data.id)?.operation,
              sql: this.requests.get(event.data.id)?.sql,
              received,
              diagnostics: event.data.diagnostics,
            });
          });
      }
      override postMessage(
        message: unknown,
        transfer?: Transferable[] | StructuredSerializeOptions,
      ) {
        const transferable = Array.isArray(transfer)
          ? transfer
          : (transfer?.transfer ?? []);
        if (
          this.measured &&
          message &&
          typeof message === "object" &&
          "id" in message &&
          typeof message.id === "number"
        ) {
          this.requests.set(message.id, {
            started: performance.timeOrigin + performance.now(),
            operation: "type" in message ? message.type : "unknown",
            ...("sql" in message && typeof message.sql === "string"
              ? { sql: message.sql }
              : {}),
          });
          super.postMessage({ ...message, measure: true }, transferable);
        } else super.postMessage(message, transferable);
      }
    };
    document.addEventListener(
      "click",
      (event) => {
        if (!(event.target instanceof Element)) return;
        const button = event.target.closest("button");
        if (
          button?.closest(".sql-task-list") &&
          button.getAttribute("aria-current") !== "step"
        ) {
          const started = performance.now();
          requestAnimationFrame(() =>
            samples.push({
              type: "transition",
              frameMs: performance.now() - started,
            }),
          );
        }
        if (!button?.textContent?.includes("Executar consulta")) return;
        const started = performance.now();
        const sql = document.querySelector(".cm-content")?.textContent;
        const status = document.querySelector(".sql-workspace [role=status]");
        if (!status) return;
        const observer = new MutationObserver(() => {
          const message = status.textContent ?? "";
          if (
            /A consulta mudou durante|cancelada|Banco descartado|tempo limite/.test(
              message,
            )
          ) {
            observer.disconnect();
            return;
          }
          if (
            !/Resposta correta nesta prática|Consulta correta|Consulta executada|Ainda não corresponde|Erro SQL|Tarefa \d+ concluída|Todas as tarefas foram concluídas/.test(
              message,
            )
          )
            return;
          observer.disconnect();
          const committed = performance.now() - started;
          requestAnimationFrame(() =>
            samples.push({
              type: "visible",
              sql,
              committedMs: committed,
              frameMs: performance.now() - started,
              message,
            }),
          );
        });
        observer.observe(status, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      },
      true,
    );
  });
}

for (const loggedIn of [false, true]) {
  const practiceTest = loggedIn ? authenticatedTest : test;
  practiceTest(
    `canonical SQL task sequences are local for ${loggedIn ? "authenticated" : "anonymous"} learners, with recoverable errors and measured feedback`,
    async ({ page }) => {
      practiceTest.setTimeout(180000);
      await captureSqlTimings(page);
      const writes: string[] = [];
      page.on("request", (request) => {
        if (
          request.method() === "POST" &&
          /\/api\/(sql\/(check|submit)|learning\/.*\/(complete|submit))/.test(
            request.url(),
          )
        )
          writes.push(request.url());
      });
      const manifest = parseCourseManifest(
        JSON.parse(
          await readFile(
            join(
              process.env.BUNKERCODE_BROWSER_CONTENT_DIR!,
              "courses/sql-na-pratica/course.json",
            ),
            "utf8",
          ),
        ),
        "sql-na-pratica",
      );
      const lessons = [
        {
          slug: "seu-primeiro-contato-com-um-banco-de-dados",
          tasks: [
            {
              correct: "SELECT * FROM customers",
              equivalent: "SELECT id,name,city FROM customers ORDER BY id DESC",
              wrong: "SELECT name FROM customers",
            },
            {
              correct: "SELECT name FROM customers",
              equivalent: "SELECT c.name FROM customers AS c ORDER BY id DESC",
              wrong: "SELECT name,id FROM customers",
            },
            {
              correct: "SELECT id,name FROM customers ORDER BY id DESC",
              equivalent: "SELECT id,name FROM customers WHERE true",
              wrong: "SELECT name,id FROM customers",
            },
          ],
        },
        {
          slug: "encontrando-o-que-importa",
          tasks: [
            {
              correct: "SELECT * FROM customers WHERE city = 'Recife'",
              equivalent:
                "SELECT id,name,city FROM customers WHERE city IN ('Recife') ORDER BY id DESC",
              wrong: "SELECT * FROM customers WHERE city = 'Olinda'",
            },
            {
              correct: "SELECT id,name,city FROM customers ORDER BY name ASC",
              equivalent: "SELECT id,name,city FROM customers ORDER BY 2",
              wrong: "SELECT id,name,city FROM customers ORDER BY name DESC",
            },
            {
              correct:
                "SELECT name,city FROM customers WHERE city <> 'Recife' ORDER BY name DESC",
              equivalent:
                "SELECT name,city FROM customers WHERE NOT(city = 'Recife') ORDER BY name DESC",
              wrong:
                "SELECT name,city FROM customers WHERE city <> 'Recife' ORDER BY name ASC",
            },
          ],
        },
      ];
      for (const [index, lesson] of lessons.entries()) {
        await page.goto(`/courses/sql-na-pratica/lessons/${lesson.slug}`);
        const editor = page.getByRole("textbox", { name: "Consulta SQL" });
        const execute = page.getByRole("button", { name: "Executar consulta" });
        const status = page.locator(".sql-workspace [role=status]");
        const list = page.getByRole("region", { name: "Tarefas da lição" });
        const rows = list.locator(".sql-task-list button");
        await expect(rows).toHaveCount(3);
        await expect(list).toContainText("0 de 3 concluídas");
        await expect(
          page.getByRole("button", {
            name: /Verificar resposta|Submit · concluir lição/,
          }),
        ).toHaveCount(0);
        // Initial sample data and learner queries use the same real PGlite session.
        await editor.fill(lesson.tasks[0]!.correct);
        await execute.click();
        await expect(list).toContainText("1 de 3 concluídas", {
          timeout: 65000,
        });
        await expect(status).toContainText("Tarefa 1 concluída");
        await page.getByRole("button", { name: "Dados", exact: true }).click();
        await expect(
          page.getByRole("region", { name: "Registros de customers" }),
        ).toBeVisible();
        for (const [position, task] of lesson.tasks.entries()) {
          await rows.nth(position).click();
          if (lesson.slug === "encontrando-o-que-importa" && position === 1) {
            await editor.fill("SELECT * FROM customers");
            await execute.click();
            await expect(status).toContainText("Ainda não corresponde");
            await expect(rows.nth(position)).toHaveAttribute(
              "aria-current",
              "step",
            );
            await editor.fill("SELECT FROM");
            await execute.click();
            await expect(status).toContainText("Confira a sintaxe");
            await expect(status).not.toContainText("at or near");
          }
          await editor.fill(task.wrong);
          await execute.click();
          await expect(status).toContainText("Ainda não corresponde");
          await expect(rows.nth(position)).toHaveAttribute(
            "aria-current",
            "step",
          );
          await expect(list).toContainText(
            `${Math.max(1, position)} de 3 concluídas`,
          );
          await editor.fill("SELECT missing FROM customers");
          await execute.click();
          await expect(status).toContainText("Erro SQL");
          await editor.fill(task.correct);
          await execute.click();
          await expect(list).toContainText(
            `${Math.max(1, position + 1)} de 3 concluídas`,
          );
          await expect(status).toContainText(
            position === 2
              ? "Todas as tarefas foram concluídas"
              : `Tarefa ${position + 1} concluída`,
          );
          await rows.nth(position).click();
          await editor.fill(task.equivalent);
          await execute.click();
          await expect(status).toContainText(
            position === 2
              ? "Todas as tarefas foram concluídas"
              : `Tarefa ${position + 1} concluída`,
          );
          await expect(list).toContainText(
            `${Math.max(1, position + 1)} de 3 concluídas`,
          );
        }
        for (let visit = 0; visit < 12; visit += 1) {
          await rows.nth(visit % 3).click();
          await expect(rows.nth(visit % 3)).toHaveAttribute(
            "aria-current",
            "step",
          );
        }
        const final = lesson.tasks[2]!;
        const attempts = [
          final.wrong,
          "SELECT * FROM customers WHERE false",
          "SELECT * FROM customers",
          "SELECT c.name,o.total FROM customers c JOIN orders o ON c.id=o.customer_id",
          "SELECT count(*) FROM orders",
          ...(index === 0
            ? [
                "SELECT id,name FROM customers UNION ALL SELECT id,name FROM customers",
                "SELECT id,NULL::text AS name FROM customers",
              ]
            : [
                "SELECT name,NULL::text AS city FROM customers WHERE city <> 'Recife' ORDER BY name DESC",
              ]),
          ...Array<string>(20).fill(final.correct),
        ];
        for (const [attempt, sql] of attempts.entries()) {
          const previous = await editor.textContent();
          await editor.fill(sql);
          if (previous !== sql)
            await expect(status).toContainText("Consulta alterada");
          await execute.click();
          await expect(status).toContainText(
            attempt >= attempts.length - 20
              ? "Todas as tarefas foram concluídas"
              : "Ainda não corresponde",
          );
          await expect(list).toContainText("3 de 3 concluídas");
          await expect(
            page.getByText("Lição concluída", { exact: true }),
          ).toHaveCount(0);
        }
        await editor.fill(
          final.correct.replace(
            "FROM customers",
            "FROM customers CROSS JOIN (SELECT pg_sleep(0.3)) AS delay",
          ),
        );
        await execute.click();
        await editor.fill(final.wrong);
        await expect(status).toContainText("A consulta mudou durante", {
          timeout: 10000,
        });
        await execute.click();
        await expect(status).toContainText("Ainda não corresponde");
        expect(
          await page.evaluate(
            () =>
              (
                (window as Window & { __sqlMeasurements?: { type: string }[] })
                  .__sqlMeasurements ?? []
              ).filter((sample) => sample.type === "ready").length,
          ),
        ).toBe(1);
        await page.getByText("Opções da prática", { exact: true }).click();
        await page
          .getByRole("button", { name: "Reiniciar banco", exact: true })
          .click();
        await expect(status).toContainText("Banco descartado");
        await expect(list).toContainText("3 de 3 concluídas");
        await editor.fill(final.correct);
        await execute.click();
        await expect(status).toContainText(
          "Todas as tarefas foram concluídas",
          { timeout: 65000 },
        );
        await page.getByRole("button", { name: "Dados", exact: true }).click();
        await page.locator(".sql-lesson-workspace").evaluate((element) => {
          element.scrollTop = 0;
        });
        await page.screenshot({
          path: practiceTest
            .info()
            .outputPath(
              `canonical-${loggedIn ? "account" : "anonymous"}-${index + 1}.png`,
            ),
          fullPage: true,
        });
        expect(
          await page.evaluate(
            () =>
              (
                (window as Window & { __sqlMeasurements?: { type: string }[] })
                  .__sqlMeasurements ?? []
              ).filter((sample) => sample.type === "ready").length,
          ),
        ).toBe(2);
        await page.waitForTimeout(30);
        const timingFile = practiceTest
          .info()
          .outputPath(`sql-task-timings-${index + 1}.json`);
        await writeFile(
          timingFile,
          JSON.stringify(
            await page.evaluate(() => ({
              samples: (window as Window & { __sqlMeasurements?: unknown })
                .__sqlMeasurements,
              resources: performance
                .getEntriesByType("resource")
                .filter((entry) =>
                  /\.(js|css|wasm|data)(\?|$)/.test(entry.name),
                )
                .map((entry) => ({
                  name: entry.name.split("/").pop(),
                  startTime: entry.startTime,
                  duration: entry.duration,
                  bytes: (entry as PerformanceResourceTiming).transferSize,
                })),
            })),
            null,
            2,
          ),
        );
        await practiceTest.info().attach(`sql-task-timings-${index + 1}.json`, {
          path: timingFile,
          contentType: "application/json",
        });
        // The browser fixture publishes these two lessons; ADMIN sees the full authoring manifest.
        const navigationLessons = loggedIn ? manifest.lessons : lessons;
        const next =
          navigationLessons[
            navigationLessons.findIndex((entry) => entry.slug === lesson.slug) +
              1
          ];
        const continueLink = list.getByRole("link", {
          name: next ? "Continuar para a próxima lição" : "Voltar ao curso",
        });
        await continueLink.click();
        await expect(page).toHaveURL(
          new URL(
            next
              ? `/courses/sql-na-pratica/lessons/${next.slug}`
              : "/courses/sql-na-pratica",
            page.url(),
          ).href,
        );
      }
      expect(writes).toEqual([]);
    },
  );
}

test("SQL sequence advances three tasks locally, preserves historical success and separates database, editor and sequence reset", async ({
  page,
}) => {
  test.setTimeout(90000);
  await captureSqlTimings(page);
  const file = join(
    process.env.BUNKERCODE_BROWSER_CONTENT_DIR!,
    "courses/sql-na-pratica/lessons/seu-primeiro-contato-com-um-banco-de-dados/lesson.md",
  );
  const original = await readFile(file, "utf8");
  const tasks = [
    { taskId: "columns", exerciseId: "store-select-columns", version: 2 },
    { taskId: "customers", exerciseId: "store-customers-recife", version: 2 },
    { taskId: "filtered-order", exerciseId: "store-filter-sort", version: 2 },
  ];
  await writeFile(
    file,
    setLessonSqlPlacement(original, { kind: "sql-task-sequence", tasks }),
  );
  const grading: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/sql\/(check|submit)|\/api\/learning\//.test(request.url()))
      grading.push(request.method() + " " + request.url());
  });
  try {
    await page.goto(
      "/courses/sql-na-pratica/lessons/seu-primeiro-contato-com-um-banco-de-dados",
    );
    const editor = page.getByRole("textbox", { name: "Consulta SQL" });
    const execute = page.getByRole("button", { name: "Executar consulta" });
    const status = page.locator(".sql-workspace [role=status]");
    const list = page.getByRole("region", { name: "Tarefas da lição" });
    const active = list.locator('[aria-current="step"]');
    await expect(active).toContainText("Escolher colunas dos clientes");
    await expect(list).toContainText("0 de 3 concluídas");
    await expect(
      page.getByRole("button", { name: /Verificar resposta|Submit/ }),
    ).toHaveCount(0);
    await editor.fill("SELECT id,name FROM customers");
    await execute.click();
    await expect(active).toContainText("Clientes de Recife", {
      timeout: 65000,
    });
    await expect(status).toContainText("Tarefa 1 concluída");
    await expect(execute).toBeFocused();
    await expect(list).toContainText("1 de 3 concluídas");
    await expect(page.locator(".sql-executed-task")).toContainText(
      "Resultado da tarefa 1",
    );
    await editor.fill("SELECT * FROM customers");
    await execute.click();
    await expect(status).toContainText("Ainda não corresponde");
    await expect(active).toContainText("Clientes de Recife");
    await editor.fill("SELECT missing FROM customers");
    await execute.click();
    await expect(status).toContainText("Erro SQL");
    await expect(list).toContainText("1 de 3 concluídas");
    await editor.fill("SELECT * FROM customers WHERE city = 'Recife'");
    await execute.click();
    await expect(status).toContainText("Tarefa 2 concluída");
    await expect(list).toContainText("2 de 3 concluídas");
    await editor.fill(
      "SELECT name,city FROM customers WHERE city <> 'Recife' ORDER BY name DESC",
    );
    await execute.click();
    await expect(status).toContainText("Todas as tarefas foram concluídas");
    await expect(list).toContainText("3 de 3 concluídas");
    await expect(
      list.getByRole("link", { name: "Continuar para a próxima lição" }),
    ).toBeVisible();
    await list
      .getByRole("button", { name: /Escolher colunas dos clientes/ })
      .click();
    await expect(editor).toHaveText("SELECT id,name FROM customers");
    await editor.fill("SELECT 1");
    await expect(status).toContainText("Consulta alterada");
    await expect(list).toContainText("3 de 3 concluídas");
    await page.getByText("Opções da prática", { exact: true }).click();
    await page
      .getByRole("button", { name: "Limpar consulta", exact: true })
      .click();
    await expect(editor).toHaveText("");
    await expect(status).toContainText("acertos anteriores foram preservados");
    const beforeReset = await page.evaluate(
      () =>
        (
          window as Window & { __sqlMeasurements?: { type: string }[] }
        ).__sqlMeasurements?.filter((item) => item.type === "ready").length,
    );
    expect(beforeReset).toBe(1);
    await page
      .getByRole("button", { name: "Reiniciar banco", exact: true })
      .click();
    await expect(list).toContainText("3 de 3 concluídas");
    await expect(editor).toHaveText("");
    await page.getByRole("button", { name: "Recomeçar tarefas" }).click();
    await expect(list).toContainText("0 de 3 concluídas");
    await expect(
      list.getByRole("link", { name: "Continuar para a próxima lição" }),
    ).toHaveCount(0);
    await expect(active).toContainText("Escolher colunas dos clientes");
    expect(grading).toEqual([]);
  } finally {
    await writeFile(file, original);
  }
});

declare global {
  interface Window {
    __sqlTaskRace: {
      holdNext: boolean;
      held: boolean;
      queries: number;
      release?: () => void;
    };
  }
}

test("SQL sequence ignores real late results after task switches, edits, reset and a published version change", async ({
  page,
}) => {
  test.setTimeout(100000);
  await page.addInitScript(() => {
    const Original = window.Worker;
    window.__sqlTaskRace = { holdNext: false, held: false, queries: 0 };
    window.Worker = class extends Original {
      private sqlWorker: boolean;
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.sqlWorker = String(url).includes("sql.worker");
      }
      override get onmessage() {
        return super.onmessage;
      }
      override set onmessage(handler: Worker["onmessage"]) {
        super.onmessage = (event) => {
          const state = window.__sqlTaskRace;
          const data: unknown = event.data;
          if (
            this.sqlWorker &&
            data &&
            typeof data === "object" &&
            "type" in data &&
            data.type === "result" &&
            state.holdNext
          ) {
            state.holdNext = false;
            state.held = true;
            state.release = () => {
              state.held = false;
              handler?.call(this, event);
            };
          } else handler?.call(this, event);
        };
      }
      override postMessage(
        message: unknown,
        transfer?: Transferable[] | StructuredSerializeOptions,
      ) {
        if (
          this.sqlWorker &&
          message &&
          typeof message === "object" &&
          "type" in message &&
          message.type === "query"
        )
          window.__sqlTaskRace.queries++;
        super.postMessage(
          message,
          Array.isArray(transfer) ? transfer : (transfer?.transfer ?? []),
        );
      }
    };
  });
  const file = join(
    process.env.BUNKERCODE_BROWSER_CONTENT_DIR!,
    "courses/sql-na-pratica/lessons/seu-primeiro-contato-com-um-banco-de-dados/lesson.md",
  );
  const original = await readFile(file, "utf8");
  const tasks = [
    { taskId: "columns", exerciseId: "store-select-columns", version: 2 },
    { taskId: "customers", exerciseId: "store-customers-recife", version: 2 },
    { taskId: "filtered-order", exerciseId: "store-filter-sort", version: 2 },
  ];
  await writeFile(
    file,
    setLessonSqlPlacement(original, { kind: "sql-task-sequence", tasks }),
  );
  const holdNext = async () =>
    page.evaluate(() => {
      window.__sqlTaskRace.holdNext = true;
    });
  const awaitHeld = async () =>
    expect
      .poll(() => page.evaluate(() => window.__sqlTaskRace.held))
      .toBe(true);
  const release = async () =>
    page.evaluate(() => window.__sqlTaskRace.release?.());
  try {
    const url =
      "/courses/sql-na-pratica/lessons/seu-primeiro-contato-com-um-banco-de-dados";
    await page.goto(url);
    const editor = page.getByRole("textbox", { name: "Consulta SQL" });
    const execute = page.getByRole("button", { name: "Executar consulta" });
    const status = page.locator(".sql-workspace [role=status]");
    const list = page.getByRole("region", { name: "Tarefas da lição" });
    await expect(
      page.getByRole("region", { name: "Registros de customers", exact: true }),
    ).toBeVisible({ timeout: 65000 });
    await expect(execute).toBeEnabled();
    const initialQueries = await page.evaluate(
      () => window.__sqlTaskRace.queries,
    );
    await editor.fill("SELECT id,name FROM customers");
    await holdNext();
    await execute.evaluate((button) => {
      if (!(button instanceof HTMLButtonElement))
        throw new Error("Expected Execute button");
      button.click();
      button.click();
    });
    await awaitHeld();
    expect(await page.evaluate(() => window.__sqlTaskRace.queries)).toBe(
      initialQueries + 1,
    );
    await list.getByRole("button", { name: /Clientes de Recife/ }).click();
    await release();
    await expect(execute).toBeEnabled();
    await expect(list).toContainText("0 de 3 concluídas");
    await expect(list.locator('[aria-current="step"]')).toContainText(
      "Clientes de Recife",
    );
    await expect(status).toContainText("Tarefa selecionada");
    await list
      .getByRole("button", { name: /Escolher colunas dos clientes/ })
      .click();
    await execute.click();
    await expect(list).toContainText("1 de 3 concluídas");
    await editor.fill("SELECT * FROM customers WHERE city = 'Recife'");
    await holdNext();
    await execute.click();
    await awaitHeld();
    await editor.fill("SELECT 1");
    await release();
    await expect(status).toContainText("A consulta mudou durante");
    await expect(list).toContainText("1 de 3 concluídas");
    await editor.fill("SELECT * FROM customers WHERE city = 'Recife'");
    await execute.click();
    await expect(list).toContainText("2 de 3 concluídas");
    await editor.fill(
      "SELECT name,city FROM customers WHERE city <> 'Recife' ORDER BY name DESC",
    );
    await holdNext();
    await execute.click();
    await awaitHeld();
    await page.getByText("Opções da prática", { exact: true }).click();
    await page
      .getByRole("button", { name: "Reiniciar banco", exact: true })
      .click();
    await release();
    await expect(list).toContainText("2 de 3 concluídas");
    await expect(status).toContainText("Banco descartado");
    await execute.click();
    await expect(list).toContainText("3 de 3 concluídas", { timeout: 65000 });
    await holdNext();
    await execute.click();
    await awaitHeld();
    await list
      .getByRole("link", { name: "Continuar para a próxima lição" })
      .click();
    await expect(page.locator(".lesson-heading h1")).toHaveText(
      "Encontrando o que importa",
    );
    await release();
    await expect(status).toContainText("Escreva uma consulta");
    await page
      .getByRole("link", { name: "Lição anterior", exact: true })
      .click();
    await expect(list).toContainText("0 de 3 concluídas");
    await editor.fill("SELECT id,name FROM customers");
    await execute.click();
    await expect(list).toContainText("1 de 3 concluídas", { timeout: 65000 });
    // Publish a real immutable new version only inside this supervisor-owned fixture.
    const { SqlContent } = await import("../../backend/src/sql/content");
    const { generateFormativeOracle } =
      await import("@bunkercode/content/sql-grading");
    const store = new SqlContent(
      join(process.env.BUNKERCODE_BROWSER_CONTENT_DIR!, "sql"),
    );
    const definition = {
      ...store.definition("store-select-columns", 2),
      version: 3,
      status: "draft" as const,
      formative: { kind: "public-result" as const },
    };
    const saved = store.saveDraft(definition, null);
    const oracle = await generateFormativeOracle(
      definition,
      store.dataset("store", 1),
    );
    store.publish(definition.id, saved.revision, oracle);
    await writeFile(
      file,
      setLessonSqlPlacement(original, {
        kind: "sql-task-sequence",
        tasks: [{ ...tasks[0]!, version: 3 }, ...tasks.slice(1)],
      }),
    );
    const loaded = page.waitForResponse(
      (response) =>
        response
          .url()
          .endsWith("/content/sql/exercises/store-select-columns/3") &&
        response.ok(),
    );
    await page.reload();
    await loaded;
    await expect(list).toContainText("0 de 3 concluídas");
    await expect(list.locator('[aria-current="step"]')).toContainText(
      "Escolher colunas dos clientes",
    );
    await expect(status).not.toContainText("Todas as tarefas");
    await editor.fill("SELECT id,name FROM customers");
    await execute.click();
    await expect(list).toContainText("1 de 3 concluídas", { timeout: 65000 });
  } finally {
    await writeFile(file, original);
  }
});

test("SQL task list preserves reading themes, keyboard controls and narrow viewport layout", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const file = join(
    process.env.BUNKERCODE_BROWSER_CONTENT_DIR!,
    "courses/sql-na-pratica/lessons/seu-primeiro-contato-com-um-banco-de-dados/lesson.md",
  );
  const original = await readFile(file, "utf8");
  await writeFile(
    file,
    setLessonSqlPlacement(original, {
      kind: "sql-task-sequence",
      tasks: [
        { taskId: "columns", exerciseId: "store-select-columns", version: 2 },
        {
          taskId: "customers",
          exerciseId: "store-customers-recife",
          version: 2,
        },
        {
          taskId: "filtered-order",
          exerciseId: "store-filter-sort",
          version: 2,
        },
      ],
    }),
  );
  try {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(
      "/courses/sql-na-pratica/lessons/seu-primeiro-contato-com-um-banco-de-dados",
    );
    const list = page.getByRole("region", { name: "Tarefas da lição" });
    const editor = page.getByRole("textbox", { name: "Consulta SQL" });
    await editor.fill("SELECT id,name FROM customers");
    await page.getByRole("button", { name: "Executar consulta" }).click();
    await expect(list).toContainText("1 de 3 concluídas", { timeout: 65000 });
    for (const [theme, tone] of [
      ["dark", 0],
      ["light", 3],
    ] as const) {
      await selectSiteTheme(page, theme);
      await selectReadingTone(page, tone);
      const settings = page.getByRole("button", {
        name: "Ajustar lição",
        exact: true,
      });
      if ((await settings.getAttribute("aria-expanded")) === "true")
        await settings.click();
      await expectRenderedContrast(
        list.locator(
          "button, .sql-task-state, .sql-local-feedback, .sql-task-notice",
        ),
      );
      await page.locator(".sql-lesson-workspace").evaluate((element) => {
        element.scrollTop = 0;
      });
      await page.screenshot({
        path: info.outputPath(`tasks-desktop-${theme}.png`),
        fullPage: true,
      });
    }
    const task = list.getByRole("button", {
      name: /Escolher colunas dos clientes/,
    });
    await task.focus();
    await page.keyboard.press("Enter");
    await expect(task).toHaveAttribute("aria-current", "step");
    await expect(task).toBeFocused();
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const viewport of [
      { width: 375, height: 812 },
      { width: 812, height: 375 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(editor).toBeVisible();
      await expect(list).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      const targets = await list
        .locator("button")
        .evaluateAll((elements) =>
          elements.map((element) => element.getBoundingClientRect().height),
        );
      expect(targets.every((height) => height >= 44)).toBe(true);
      await page.locator(".sql-lesson-workspace").evaluate((element) => {
        element.scrollTop = 0;
      });
      await page.screenshot({
        path: info.outputPath(`tasks-${viewport.width}x${viewport.height}.png`),
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole("button", { name: "Dados", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Registros de customers" }),
    ).toBeVisible();
    await editor.fill(
      "SELECT name, city, id, city AS another_city FROM customers",
    );
    await page.getByRole("button", { name: "Executar consulta" }).click();
    const table = page.getByRole("region", { name: "Resultado da consulta" });
    await expect(table).toBeVisible();
    await table.focus();
    await expect(table).toBeFocused();
    await page.keyboard.press("ArrowRight");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await expect(list).toContainText("1 de 3 concluídas");
  } finally {
    await writeFile(file, original);
  }
});

authenticatedTest(
  "Studio assembles, validates, reorders, previews and saves SQL task sequences without authorizing progress",
  async ({ page }) => {
    authenticatedTest.setTimeout(150000);
    const root = process.env.BUNKERCODE_BROWSER_CONTENT_DIR!;
    const file = join(
      root,
      "courses/sql-na-pratica/lessons/seu-primeiro-contato-com-um-banco-de-dados/lesson.md",
    );
    const original = await readFile(file, "utf8");
    const { SqlContent } = await import("../../backend/src/sql/content");
    const { generateFormativeOracle } =
      await import("@bunkercode/content/sql-grading");
    const store = new SqlContent(join(root, "sql"));
    const dataset = {
      ...store.dataset("store", 1),
      id: "incompatible-dataset",
    };
    store.saveDataset(dataset);
    const definition = {
      ...store.definition("store-select-columns", 2),
      id: "incompatible-exercise",
      version: 1,
      status: "draft" as const,
      dataset: { id: dataset.id, version: 1 },
      formative: { kind: "public-result" as const },
    };
    const draft = store.saveDraft(definition, null);
    store.publish(
      definition.id,
      draft.revision,
      await generateFormativeOracle(definition, dataset),
    );
    const writes: string[] = [];
    page.on("request", (request) => {
      if (
        /\/api\/sql\/(check|submit)|\/api\/learning\/.*\/(complete|solution)/.test(
          request.url(),
        )
      )
        writes.push(request.url());
    });
    try {
      const initialMarkdown = setLessonSqlPlacement(original, {
        kind: "sql",
        exerciseId: "store-select-columns",
        version: 2,
      });
      await writeFile(file, initialMarkdown);
      await page.goto(
        "/courses/sql-na-pratica/lessons/seu-primeiro-contato-com-um-banco-de-dados/edit",
      );
      await studioView(page, "Editar fonte Markdown");
      await page
        .getByText("Biblioteca e vínculos avançados", { exact: true })
        .click();
      const picker = page.getByRole("region", {
        name: "Vincular atividade SQL",
      });
      await picker
        .getByRole("button", { name: "Criar sequência de tarefas" })
        .click();
      await picker
        .getByLabel("ID da tarefa 1", { exact: true })
        .fill("identify-customers");
      await picker
        .getByLabel("Atividade SQL publicada", { exact: true })
        .selectOption("store-customers-recife/2");
      await picker
        .getByLabel("ID da tarefa 2", { exact: true })
        .fill("identify-customers");
      await picker
        .getByLabel("Atividade SQL publicada", { exact: true })
        .selectOption("store-filter-sort/2");
      await picker
        .getByLabel("ID da tarefa 3", { exact: true })
        .fill("combined-report");
      const apply = picker.getByRole("button", {
        name: "Aplicar tarefas ao rascunho",
      });
      const save = page.getByRole("button", {
        name: "Salvar alterações",
        exact: true,
      });
      await expect(save).toBeDisabled();
      await apply.click();
      await expect(picker.getByRole("alert")).toContainText(
        "IDs de tarefa SQL duplicados",
      );
      expect(await readFile(file, "utf8")).toBe(initialMarkdown);
      await picker
        .getByLabel("ID da tarefa 2", { exact: true })
        .fill("customers-in-recife");
      await picker
        .getByLabel("Exercício da tarefa 3", { exact: true })
        .selectOption("incompatible-exercise/1");
      await apply.click();
      await expect(picker.getByRole("alert")).toContainText("mesmo dataset");
      await expect(save).toBeDisabled();
      await picker
        .getByLabel("Exercício da tarefa 3", { exact: true })
        .selectOption("store-filter-sort/2");
      await picker
        .getByRole("button", { name: "Subir tarefa 3", exact: true })
        .click();
      await expect(
        picker.getByLabel("ID da tarefa 2", { exact: true }),
      ).toHaveValue("combined-report");
      await picker
        .getByRole("button", { name: "Remover tarefa 2", exact: true })
        .click();
      await expect(
        picker.getByLabel("ID da tarefa 3", { exact: true }),
      ).toHaveCount(0);
      await picker
        .getByLabel("Atividade SQL publicada", { exact: true })
        .selectOption("store-filter-sort/2");
      await picker
        .getByLabel("ID da tarefa 3", { exact: true })
        .fill("combined-report");
      await picker
        .getByRole("button", { name: "Subir tarefa 3", exact: true })
        .click();
      let releaseValidation!: () => void;
      let validationArrived!: () => void;
      const heldValidation = new Promise<void>(
        (resolve) => (releaseValidation = resolve),
      );
      const arrivedValidation = new Promise<void>(
        (resolve) => (validationArrived = resolve),
      );
      await page.route(
        "**/api/content/sql/exercises/store-select-columns/2",
        async (route) => {
          const response = await route.fetch();
          validationArrived();
          await heldValidation;
          await route.fulfill({ response });
        },
      );
      await apply.click();
      await arrivedValidation;
      const editedMarkdown =
        initialMarkdown + "\nTexto editorial preservado durante a validação.\n";
      await page.getByLabel("Markdown completo").fill(editedMarkdown);
      releaseValidation();
      await expect(picker.getByRole("alert")).toContainText(
        "O Markdown mudou durante a validação",
      );
      await expect(page.getByLabel("Markdown completo")).toHaveValue(
        editedMarkdown,
      );
      await page.unroute("**/api/content/sql/exercises/store-select-columns/2");
      await apply.click();
      await expect(save).toBeEnabled();
      await studioView(page, "Prévia");
      const preview = page.getByRole("region", { name: "Prévia da lição" });
      const tasks = preview.locator(".sql-task-list button");
      await expect(tasks.nth(0)).toContainText("Escolher colunas dos clientes");
      await expect(tasks.nth(1)).toContainText("Filtrar e ordenar clientes");
      await expect(tasks.nth(2)).toContainText("Clientes de Recife");
      await preview
        .getByRole("textbox", { name: "Consulta SQL" })
        .fill("SELECT id,name FROM customers");
      await preview.getByRole("button", { name: "Executar consulta" }).click();
      await expect(preview.locator(".sql-task-summary")).toContainText(
        "1 de 3 concluídas",
        { timeout: 65000 },
      );
      await expect(preview.locator('[aria-current="step"]')).toContainText(
        "Filtrar e ordenar clientes",
      );
      await expect(preview.getByRole("button", { name: /Submit/ })).toHaveCount(
        0,
      );
      await page.screenshot({
        path: authenticatedTest
          .info()
          .outputPath("studio-sql-sequence-preview.png"),
        fullPage: true,
      });
      await save.click();
      await expect(page.locator(".studio-status")).toContainText(
        "Salvo no arquivo",
      );
      const savedMarkdown = await readFile(file, "utf8");
      expect(savedMarkdown).toContain(
        "Texto editorial preservado durante a validação.",
      );
      const { lessonSqlPlacement } = await import("@bunkercode/content");
      const savedPlacement = lessonSqlPlacement(savedMarkdown);
      expect(savedPlacement).toEqual({
        kind: "sql-task-sequence",
        tasks: [
          {
            taskId: "identify-customers",
            exerciseId: "store-select-columns",
            version: 2,
          },
          {
            taskId: "combined-report",
            exerciseId: "store-filter-sort",
            version: 2,
          },
          {
            taskId: "customers-in-recife",
            exerciseId: "store-customers-recife",
            version: 2,
          },
        ],
      });
      await page.reload();
      await page
        .getByText("Biblioteca e vínculos avançados", { exact: true })
        .click();
      await expect(
        picker.getByLabel("ID da tarefa 1", { exact: true }),
      ).toHaveValue("identify-customers");
      await expect(
        picker.getByLabel("ID da tarefa 2", { exact: true }),
      ).toHaveValue("combined-report");
      await expect(
        picker.getByLabel("ID da tarefa 3", { exact: true }),
      ).toHaveValue("customers-in-recife");
      for (const position of [3, 2, 1])
        await picker
          .getByRole("button", {
            name: `Remover tarefa ${position}`,
            exact: true,
          })
          .click();
      await apply.click();
      await expect(picker.getByRole("alert")).toContainText(
        "de 1 a 12 tarefas",
      );
      await picker
        .getByRole("button", { name: "Descartar mudanças nas tarefas" })
        .click();
      await expect(
        picker.getByLabel("ID da tarefa 3", { exact: true }),
      ).toHaveValue("customers-in-recife");
      await studioView(page, "Editar fonte Markdown");
      const source = page.getByLabel("Markdown completo");
      await source.fill(
        setLessonSqlPlacement(savedMarkdown, {
          kind: "sql-task-sequence",
          tasks: [
            {
              taskId: "unknown-version",
              exerciseId: "store-select-columns",
              version: 999,
            },
          ],
        }),
      );
      await save.click();
      await expect(page.locator(".studio-error")).toContainText(
        "não encontrada",
      );
      expect(await readFile(file, "utf8")).toBe(savedMarkdown);
      await source.fill(savedMarkdown);
      expect(writes).toEqual([]);
    } finally {
      await writeFile(file, original);
    }
  },
);

authenticatedTest(
  "Studio prose editing preserves SQL practice through save reload and preview",
  async ({ page }) => {
    authenticatedTest.setTimeout(90000);
    const path =
      "/courses/sql-na-pratica/lessons/seu-primeiro-contato-com-um-banco-de-dados";
    const file = join(
      process.env.BUNKERCODE_BROWSER_CONTENT_DIR!,
      "courses/sql-na-pratica/lessons/seu-primeiro-contato-com-um-banco-de-dados/lesson.md",
    );
    const original = await readFile(file, "utf8");
    try {
      await page.goto(path + "/edit");
      const visual = page.getByRole("textbox", {
        name: "Conteúdo visual da lição",
      });
      await expect(visual).toBeVisible();
      await visual.fill("Uma explicação curta para investigar clientes.");
      await page
        .getByRole("button", { name: "Salvar alterações", exact: true })
        .click();
      await expect(page.getByRole("status")).toHaveText("Salvo no arquivo.");
      await page.reload();
      await expect(visual).toContainText("Uma explicação curta");
      await studioView(page, "Editar fonte Markdown");
      const source = page.getByRole("textbox", {
        name: "Markdown completo",
        exact: true,
      });
      await expect(source).toHaveValue(/bunker-sql/);
      await source.fill("Explicação em edição.\n```bunker-note\n{");
      await source.fill("Explicação ainda menor.");
      await expect(source).toHaveValue(/bunker-sql/);
      await page
        .getByRole("button", { name: "Salvar alterações", exact: true })
        .click();
      await expect(page.getByRole("status")).toHaveText("Salvo no arquivo.");
      await studioView(page, "Prévia");
      await expect(
        page.getByRole("region", { name: "Tarefas da lição" }),
      ).toContainText("0 de 3 concluídas");
      await page.goto(path);
      await expect(
        page.getByRole("region", { name: "Tarefas da lição" }),
      ).toContainText("0 de 3 concluídas");
      await page
        .getByRole("button", { name: "Executar consulta", exact: true })
        .click();
      await expect(
        page.getByRole("region", { name: "Tarefas da lição" }),
      ).toContainText("1 de 3 concluídas", { timeout: 65000 });
      await page.screenshot({
        path: authenticatedTest
          .info()
          .outputPath("sql-preserved-after-prose-edit.png"),
        fullPage: true,
      });
    } finally {
      await writeFile(file, original);
    }
  },
);

authenticatedTest(
  "Studio authors durable lesson task drafts and validates real publication and linking recovery",
  async ({ page }) => {
    authenticatedTest.setTimeout(240000);
    const path = "/courses/sql-na-pratica/lessons/encontrando-o-que-importa";
    const { SqlContent } = await import("../../backend/src/sql/content");
    const { lessonSqlPlacement } = await import("@bunkercode/content");
    const store = new SqlContent(
      join(process.env.BUNKERCODE_BROWSER_CONTENT_DIR!, "sql"),
    );
    const file = join(
      process.env.BUNKERCODE_BROWSER_CONTENT_DIR!,
      "courses/sql-na-pratica/lessons/encontrando-o-que-importa/lesson.md",
    );
    const original = await readFile(file, "utf8");
    const historical = store.versions().map(({ id, version }) => ({
      id,
      version,
      bytes: JSON.stringify(store.definition(id, version)),
    }));
    await page.goto(path + "/edit");
    const section = page.getByRole("region", {
      name: "Prática SQL da lição",
      exact: true,
    });
    await section
      .locator("summary")
      .filter({ hasText: /^Tarefa 1:/ })
      .click();
    const firstTitle = section.getByRole("textbox", {
      name: "Título da tarefa 1",
      exact: true,
    });
    await firstTitle.fill("Filtrar clientes — rascunho editorial");
    await section
      .getByRole("button", { name: "Salvar tarefa", exact: true })
      .first()
      .click();
    await expect(section.getByRole("status")).toContainText(
      "Tarefa salva como rascunho",
    );
    await firstTitle.fill("Uma edição que será descartada");
    page.once("dialog", (dialog) => dialog.accept());
    await section
      .getByRole("button", { name: "Descartar edição", exact: true })
      .first()
      .click();
    await expect(firstTitle).toHaveValue(
      "Filtrar clientes — rascunho editorial",
    );
    await section
      .locator("summary")
      .filter({ hasText: /^Tarefa 1:/ })
      .click();
    await section
      .getByRole("button", { name: "Adicionar tarefa SQL", exact: true })
      .click();
    await section
      .getByRole("textbox", { name: "Título da tarefa 4", exact: true })
      .fill("Clientes por nome no Studio");
    await section
      .getByRole("textbox", { name: "Instrução da tarefa 4", exact: true })
      .fill("Mostre os nomes dos clientes em ordem crescente.");
    await section
      .getByRole("textbox", { name: "SQL inicial da tarefa 4", exact: true })
      .fill("SELECT name FROM customers;");
    await section
      .getByRole("textbox", {
        name: "Consulta esperada da tarefa 4",
        exact: true,
      })
      .fill("SELECT name FROM customers ORDER BY name ASC;");
    await section
      .getByRole("checkbox", {
        name: "Ordem das linhas da tarefa 4",
        exact: true,
      })
      .check();
    const consent = section.getByRole("checkbox", {
      name: "Publicar resultado esperado da tarefa 4",
      exact: true,
    });
    await expect(consent).not.toBeChecked();
    await consent.check();
    await section
      .getByRole("button", { name: "Salvar tarefa", exact: true })
      .last()
      .click();
    await expect(section.getByRole("status")).toContainText(
      "Tarefa salva como rascunho",
    );
    await page.reload();
    await section
      .getByText("Rascunhos e publicações desta lição", { exact: true })
      .click();
    await section
      .getByRole("button", {
        name: "Continuar “Clientes por nome no Studio”",
        exact: true,
      })
      .click();
    await expect(
      section.getByRole("textbox", {
        name: "Consulta esperada da tarefa 4",
        exact: true,
      }),
    ).toHaveValue("SELECT name FROM customers ORDER BY name ASC;");
    await section
      .getByRole("button", { name: "Testar consultas", exact: true })
      .click();
    const preview = section.getByRole("region", {
      name: "Teste local da tarefa SQL",
      exact: true,
    });
    await preview
      .getByRole("button", { name: "Testar consulta esperada", exact: true })
      .click();
    await expect(preview.getByRole("status")).toContainText(
      "executada com sucesso",
      { timeout: 65000 },
    );
    await expect(
      preview.getByRole("cell", { name: "Ana Lima", exact: true }),
    ).toBeVisible();
    await preview
      .getByRole("textbox", { name: "Consulta candidata", exact: true })
      .fill("SELECT name FROM customers WHERE false;");
    await preview
      .getByRole("button", {
        name: "Comparar com resultado esperado",
        exact: true,
      })
      .click();
    await expect(preview.getByRole("status")).toContainText(
      "resultado difere",
      { timeout: 65000 },
    );
    await preview
      .getByRole("textbox", { name: "Consulta candidata", exact: true })
      .fill("SELECT name FROM customers ORDER BY name ASC;");
    await preview
      .getByRole("button", {
        name: "Comparar com resultado esperado",
        exact: true,
      })
      .click();
    await expect(preview.getByRole("status")).toContainText(
      "retornou o resultado esperado",
      { timeout: 65000 },
    );
    await preview
      .getByRole("textbox", { name: "Consulta candidata", exact: true })
      .fill("DELETE FROM customers;");
    await preview
      .getByRole("button", {
        name: "Comparar com resultado esperado",
        exact: true,
      })
      .click();
    await expect(preview.getByRole("alert")).toContainText("Erro SQL", {
      timeout: 65000,
    });
    await preview
      .getByRole("textbox", { name: "Consulta candidata", exact: true })
      .fill("SELECT pg_sleep(3);");
    await preview
      .getByRole("button", {
        name: "Comparar com resultado esperado",
        exact: true,
      })
      .click();
    await preview
      .getByRole("button", { name: "Cancelar teste", exact: true })
      .click();
    await expect(preview.getByRole("status")).toContainText("Teste cancelado");
    await preview
      .getByRole("textbox", { name: "Consulta candidata", exact: true })
      .fill("SELECT name FROM customers ORDER BY name ASC;");
    await preview
      .getByRole("button", {
        name: "Comparar com resultado esperado",
        exact: true,
      })
      .click();
    await expect(preview.getByRole("status")).toContainText(
      "retornou o resultado esperado",
      { timeout: 65000 },
    );
    await section
      .getByRole("button", { name: "Fechar teste local", exact: true })
      .click();
    const publish = section
      .getByRole("button", { name: "Publicar tarefa", exact: true })
      .last();
    if (process.env.BUNKERCODE_SQL_RUNNER_ENABLED !== "1") {
      // Genuine unavailable-runner path; never a substitute for publication evidence.
      await publish.click();
      await expect(section.getByRole("alert")).toContainText(
        /indisponível|desabilitad|runner|isolado/i,
      );
      await expect(
        section.getByRole("textbox", {
          name: "Título da tarefa 4",
          exact: true,
        }),
      ).toHaveValue("Clientes por nome no Studio");
      await page.goto(path);
      await expect(
        page.getByRole("region", { name: "Tarefas da lição", exact: true }),
      ).toContainText("0 de 3 concluídas");
      return;
    }
    const reference = section.getByRole("textbox", {
      name: "Consulta esperada da tarefa 4",
      exact: true,
    });
    const save = section
      .getByRole("button", { name: "Salvar tarefa", exact: true })
      .last();
    const publishedResponse = () =>
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          /\/authoring\/drafts\/[^/]+\/publish$/.test(response.url()),
        { timeout: 45000 },
      );
    let publications = 0;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().endsWith("/publish"))
        publications++;
    });
    await reference.fill("SELECT missing_column FROM customers;");
    await save.click();
    await expect(section.getByRole("status")).toContainText(
      "Tarefa salva como rascunho",
    );
    const rejected = publishedResponse();
    await publish.click();
    expect((await rejected).status()).toBe(422);
    await expect(section.getByRole("alert")).toContainText(
      "rascunho foi preservado",
    );
    expect(store.versions()).toHaveLength(historical.length);
    await reference.fill("SELECT name FROM customers ORDER BY name ASC;");
    await save.click();
    await expect(section.getByRole("status")).toContainText(
      "Tarefa salva como rascunho",
    );
    // Publication is real; only the subsequent public-projection fetch fails.
    await page.route("**/api/content/sql/exercises/*/*", (route) =>
      route.abort(),
    );
    const confirmed = publishedResponse();
    await publish.click();
    const response = await confirmed;
    expect(response.ok()).toBe(true);
    const { parseSqlDefinition, parsePublicSqlExercise } =
      await import("@bunkercode/content/sql");
    const definition = parseSqlDefinition(await response.json());
    expect(definition.status).toBe("published");
    expect(definition.version).toBe(1);
    expect(definition.dataset).toEqual({ id: "store", version: 2 });
    expect(definition.formative?.oracle).toBeDefined();
    expect(store.definition(definition.id, 1)).toEqual(definition);
    await expect(section.getByRole("alert")).toContainText(
      /publicada|vínculo/i,
    );
    expect(await readFile(file, "utf8")).toBe(original);
    await page.unroute("**/api/content/sql/exercises/*/*");
    // Reload discovers the canonical version, rather than publishing it again.
    await page.reload();
    await section
      .getByText("Rascunhos e publicações desta lição", { exact: true })
      .click();
    await section
      .getByRole("button", {
        name: "Continuar “Clientes por nome no Studio”",
        exact: true,
      })
      .click();
    await section
      .getByRole("button", { name: "Vincular publicação à lição", exact: true })
      .click();
    await expect(section.getByRole("status")).toContainText(
      "aplicada ao rascunho da lição",
    );
    expect(publications).toBe(2); // One rejected reference and one durable publication.
    await page
      .getByRole("button", { name: "Salvar alterações", exact: true })
      .click();
    await expect(page.getByRole("status").first()).toHaveText(
      "Salvo no arquivo.",
    );
    try {
      const markdown = await readFile(file, "utf8");
      const placement = lessonSqlPlacement(markdown);
      expect(placement?.kind).toBe("sql-task-sequence");
      expect(
        placement?.kind === "sql-task-sequence" && placement.tasks.at(-1),
      ).toMatchObject({ exerciseId: definition.id, version: 1 });
      expect(markdown.replace(/```bunker-sql[\s\S]*?```/, "")).toBe(
        original.replace(/```bunker-sql[\s\S]*?```/, ""),
      );
      const publicResponse = await page.request.get(
        `/api/content/sql/exercises/${definition.id}/1`,
      );
      expect(publicResponse.ok()).toBe(true);
      const publicBody: unknown = await publicResponse.json();
      expect(publicBody).not.toHaveProperty("assessment");
      expect(JSON.stringify(publicBody)).not.toContain(
        definition.assessment.reference[0],
      );
      expect(parsePublicSqlExercise(publicBody).version).toBe(1);
      for (const entry of historical)
        expect(JSON.stringify(store.definition(entry.id, entry.version))).toBe(
          entry.bytes,
        );
      await page.goto(path);
      await page
        .getByRole("region", { name: "Tarefas da lição", exact: true })
        .getByRole("button", { name: /Clientes por nome no Studio/ })
        .click();
      await page
        .getByRole("textbox", { name: "Consulta SQL" })
        .fill("SELECT name FROM customers ORDER BY name ASC;");
      await page
        .getByRole("button", { name: "Executar consulta", exact: true })
        .click();
      await expect(page.locator(".sql-workspace [role=status]")).toContainText(
        /Tarefa 4 concluída|Todas as tarefas foram concluídas/,
        { timeout: 65000 },
      );
    } finally {
      await writeFile(file, original);
    }
  },
);

test("SQL lesson uses one visualization and stacked mobile practice with concise honest feedback", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await page.goto(
    "/courses/sql-na-pratica/lessons/seu-primeiro-contato-com-um-banco-de-dados",
  );
  const list = page.getByRole("region", {
    name: "Tarefas da lição",
    exact: true,
  });
  const visualization = page.getByRole("region", {
    name: "Visualização do banco",
    exact: true,
  });
  const editor = page.getByRole("textbox", {
    name: "Consulta SQL",
    exact: true,
  });
  const execute = page.getByRole("button", {
    name: "Executar consulta",
    exact: true,
  });
  const status = page.locator(".sql-feedback");
  await expect(
    visualization.getByRole("cell", { name: "Ana Lima", exact: true }),
  ).toBeVisible({ timeout: 65000 });
  expect(
    await list.evaluate((node) => !!node.closest(".study-explanation")),
  ).toBe(true);
  await expect(page.locator(".sql-current-task")).toHaveCount(1);
  await editor.fill("SELECT * FROM customers WHERE false;");
  await execute.click();
  await expect(visualization).toContainText("0 linhas");
  await expect(visualization).toContainText("Nenhuma linha corresponde");
  await expect(status).toContainText("Ainda não corresponde");
  await editor.fill("SELECT missing FROM customers;");
  await execute.click();
  await expect(status).toContainText("Erro SQL");
  await editor.fill("SELECT * FROM customers;");
  await execute.click();
  await expect(list).toContainText("1 de 3 concluídas");
  await expect(status).toContainText("Tarefa 1 concluída");
  await editor.fill("SELECT 1;");
  await expect(status).toHaveText("Consulta alterada. Execute para atualizar.");
  await expect(visualization).toContainText("Resultado da tarefa 1");
  await visualization
    .getByRole("button", { name: "Dados", exact: true })
    .click();
  await expect(
    visualization.getByRole("region", {
      name: "Registros de customers",
      exact: true,
    }),
  ).toBeVisible();
  await visualization
    .getByRole("button", { name: "Resultado", exact: true })
    .click();
  await expect(
    visualization.getByRole("region", {
      name: "Resultado da consulta",
      exact: true,
    }),
  ).toBeVisible();
  await expect(visualization.locator("table")).toHaveCount(1);
  await page.screenshot({
    path: info.outputPath("sql-minimal-desktop.png"),
    fullPage: true,
  });
  for (const tone of [0, 3]) {
    await selectReadingTone(page, tone);
    await expectRenderedContrast(
      page.locator(
        ".sql-feedback, .sql-current-task p, .sql-practice-scope, .sql-task-state",
      ),
    );
  }
  const readingSettings = page.getByRole("button", {
    name: "Ajustar lição",
    exact: true,
  });
  if ((await readingSettings.getAttribute("aria-expanded")) === "true")
    await readingSettings.click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(list).toBeVisible();
  await expect(editor).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Código", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  const positions = await page.evaluate(() => ({
    tasks: document
      .querySelector(".sql-learning-tasks")!
      .getBoundingClientRect().bottom,
    data: document.querySelector(".sql-visualization")!.getBoundingClientRect()
      .top,
  }));
  expect(positions.data).toBeGreaterThan(positions.tasks);
  await list
    .getByRole("button", { name: /Consultar todos os clientes/ })
    .click();
  await expect(editor).toBeInViewport();
  await editor.fill("SELECT pg_sleep(30);");
  await execute.click();
  await page
    .getByRole("button", { name: "Cancelar e descartar", exact: true })
    .click();
  await expect(status).toContainText("Consulta cancelada");
  await page.getByText("Opções da prática", { exact: true }).click();
  await page
    .getByRole("button", { name: "Reiniciar banco", exact: true })
    .click();
  await expect(list).toContainText("1 de 3 concluídas");
  await page
    .getByRole("button", { name: "Recomeçar tarefas", exact: true })
    .click();
  await expect(list).toContainText("0 de 3 concluídas");
  await editor.fill("SELECT * FROM customers;");
  await execute.click();
  await expect(list).toContainText("1 de 3 concluídas", { timeout: 65000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: info.outputPath("sql-minimal-mobile.png"),
    fullPage: true,
  });
});

authenticatedTest(
  "Studio explicitly removes practice without deleting reusable SQL content",
  async ({ page, request }) => {
    const path = "/courses/sql-na-pratica/lessons/encontrando-o-que-importa";
    const file = join(
      process.env.BUNKERCODE_BROWSER_CONTENT_DIR!,
      "courses/sql-na-pratica/lessons/encontrando-o-que-importa/lesson.md",
    );
    const original = await readFile(file, "utf8");
    try {
      await page.goto(path + "/edit");
      await expect(
        page.getByRole("button", { name: "Remover prática SQL", exact: true }),
      ).toBeEnabled();
      page.once("dialog", (dialog) => dialog.accept());
      await page
        .getByRole("button", { name: "Remover prática SQL", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Salvar alterações", exact: true })
        .click();
      await expect(page.locator(".studio-status")).toHaveText(
        "Salvo no arquivo.",
      );
      await page.reload();
      await studioView(page, "Editar fonte Markdown");
      await expect(
        page.getByRole("textbox", { name: "Markdown completo", exact: true }),
      ).not.toHaveValue(/bunker-sql/);
      // A subsequent prose edit must not resurrect the intentionally removed placement.
      await page
        .getByRole("textbox", { name: "Markdown completo", exact: true })
        .fill("Explicação sem prática, por escolha explícita.");
      await page
        .getByRole("button", { name: "Salvar alterações", exact: true })
        .click();
      await expect(page.locator(".studio-status")).toHaveText(
        "Salvo no arquivo.",
      );
      await page.goto(path);
      await expect(page.locator(".lesson-heading h1")).toBeVisible();
      await expect(
        page.getByRole("region", { name: "Tarefas da lição", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("textbox", { name: "Consulta SQL", exact: true }),
      ).toHaveCount(0);
      const canonical = await request.get(
        "/api/content/sql/exercises/store-customers-recife/3",
      );
      expect(canonical.ok()).toBe(true);
    } finally {
      await writeFile(file, original);
    }
  },
);

authenticatedTest(
  "Studio starts SQL practice in a lesson and retains the selected data when recovering drafts",
  async ({ page }) => {
    authenticatedTest.setTimeout(90000);
    const file = join(
      process.env.BUNKERCODE_BROWSER_CONTENT_DIR!,
      "courses/sql-na-pratica/lessons/encontrando-o-que-importa/lesson.md",
    );
    const original = await readFile(file, "utf8");
    await writeFile(file, setLessonSqlPlacement(original, null));
    try {
      await page.goto(
        "/courses/sql-na-pratica/lessons/encontrando-o-que-importa/edit",
      );
      const section = page.getByRole("region", {
        name: "Prática SQL da lição",
        exact: true,
      });
      const dataset = section.getByRole("combobox", {
        name: "Dados da prática",
        exact: true,
      });
      await expect(dataset).toBeEnabled();
      await dataset.selectOption("store/1");
      await section
        .getByRole("button", { name: "Adicionar tarefa SQL", exact: true })
        .click();
      await section
        .getByRole("button", { name: "Salvar tarefa", exact: true })
        .click();
      await expect(section.getByRole("alert")).toContainText(
        "vazio, inválido ou excessivo",
      );
      const fillTask = async (index: number, title: string) => {
        await section
          .getByRole("textbox", {
            name: `Título da tarefa ${index}`,
            exact: true,
          })
          .fill(title);
        await section
          .getByRole("textbox", {
            name: `Instrução da tarefa ${index}`,
            exact: true,
          })
          .fill("Mostre todos os clientes.");
        await section
          .getByRole("textbox", {
            name: `Consulta esperada da tarefa ${index}`,
            exact: true,
          })
          .fill("SELECT * FROM customers;");
      };
      await fillTask(1, "Primeira tarefa de uma prática nova");
      await section
        .getByRole("button", { name: "Salvar tarefa", exact: true })
        .click();
      await expect(section.getByRole("status")).toContainText(
        "Tarefa salva como rascunho",
      );
      await expect(dataset).toHaveValue("store/1");
      await page.reload();
      await section
        .getByText("Rascunhos e publicações desta lição", { exact: true })
        .click();
      await section
        .getByRole("button", {
          name: "Continuar “Primeira tarefa de uma prática nova”",
          exact: true,
        })
        .click();
      await expect(dataset).toHaveValue("store/1");
      await expect(
        section.getByRole("checkbox", {
          name: "Publicar resultado esperado da tarefa 1",
          exact: true,
        }),
      ).not.toBeChecked();
      await section
        .getByRole("button", { name: "Publicar tarefa", exact: true })
        .click();
      await expect(section.getByRole("alert")).toContainText(
        "autorize explicitamente",
      );
      await section
        .getByRole("button", { name: "Adicionar tarefa SQL", exact: true })
        .click();
      await fillTask(2, "Segunda tarefa com os mesmos dados");
      const saved = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/content/sql/authoring/drafts") &&
          response.request().method() === "PUT",
      );
      await section
        .getByRole("button", { name: "Salvar tarefa", exact: true })
        .last()
        .click();
      const response = await saved;
      expect(response.ok()).toBe(true);
      const { sqlObject, parseSqlDefinition } =
        await import("@bunkercode/content/sql");
      const body = sqlObject(await response.json());
      expect(parseSqlDefinition(body.definition).dataset).toEqual({
        id: "store",
        version: 1,
      });
      await expect(dataset).toHaveValue("store/1");
    } finally {
      await writeFile(file, original);
    }
  },
);

authenticatedTest(
  "Studio previews the actual task sequence and canonical tables, preserves identity when reordering and explicitly unlinks",
  async ({ page }) => {
    authenticatedTest.setTimeout(120000);
    const { lessonSqlPlacement } = await import("@bunkercode/content");
    const path =
      "/courses/sql-na-pratica/lessons/seu-primeiro-contato-com-um-banco-de-dados";
    const file = join(
      process.env.BUNKERCODE_BROWSER_CONTENT_DIR!,
      "courses/sql-na-pratica/lessons/seu-primeiro-contato-com-um-banco-de-dados/lesson.md",
    );
    const original = await readFile(file, "utf8");
    const initial = lessonSqlPlacement(original);
    expect(initial?.kind).toBe("sql-task-sequence");
    if (initial?.kind !== "sql-task-sequence")
      throw new Error("Sequence fixture required");
    const { SqlContent } = await import("../../backend/src/sql/content");
    const store = new SqlContent(
      join(process.env.BUNKERCODE_BROWSER_CONTENT_DIR!, "sql"),
    );
    const before = store.definition(
      initial.tasks[0]!.exerciseId,
      initial.tasks[0]!.version,
    );
    try {
      await page.goto(path + "/edit");
      const section = page.getByRole("region", {
        name: "Prática SQL da lição",
        exact: true,
      });
      await expect(section.locator(".studio-sql-task-editor > li")).toHaveCount(
        3,
      );
      await expect(
        section.getByRole("textbox", {
          name: "Título da tarefa 1",
          exact: true,
        }),
      ).toBeHidden();
      await section
        .getByRole("button", { name: "Inspecionar dados", exact: true })
        .click();
      const data = section.getByRole("region", {
        name: "Dados da prática SQL",
        exact: true,
      });
      await expect(
        data
          .getByRole("region", { name: "Tabela customers", exact: true })
          .getByRole("cell", { name: "Ana Lima", exact: true }),
      ).toBeVisible({ timeout: 65000 });
      await expect(
        data
          .getByRole("region", { name: "Tabela orders", exact: true })
          .getByRole("columnheader", { name: "customer_id", exact: true }),
      ).toBeVisible({ timeout: 65000 });
      await expect(data).toContainText("customer_id → customers.id");
      await section
        .getByRole("button", { name: "Fechar dados", exact: true })
        .click();
      await section
        .getByRole("button", { name: "Prévia da sequência", exact: true })
        .click();
      const preview = section.getByRole("region", {
        name: "Prévia da sequência SQL",
        exact: true,
      });
      const tasks = preview.getByRole("region", {
        name: "Tarefas da lição",
        exact: true,
      });
      await expect(tasks).toContainText("0 de 3 concluídas");
      await preview
        .getByRole("checkbox", {
          name: "Simular tarefa ativa concluída",
          exact: true,
        })
        .check();
      await expect(tasks).toContainText("1 de 3 concluídas");
      await expect(tasks.locator("[data-completed]")).toHaveCount(1);
      await tasks.getByRole("button").nth(1).click();
      await expect(tasks.locator('[aria-current="step"]')).toContainText(
        "Ativa",
      );
      await expect(tasks).toContainText("Pendente");
      await expect(preview.locator(".sql-current-task p")).not.toBeEmpty();
      await selectSiteTheme(page, "light");
      await section.evaluate((node) =>
        window.scrollTo(
          0,
          window.scrollY + node.getBoundingClientRect().top - 120,
        ),
      );
      await page.screenshot({
        path: authenticatedTest.info().outputPath("studio-sql-desktop.png"),
        fullPage: false,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await section
        .locator("summary")
        .filter({ hasText: /^Tarefa 1:/ })
        .click();
      const title = section.getByRole("textbox", {
        name: "Título da tarefa 1",
        exact: true,
      });
      await title.focus();
      await title.press("End");
      await expect(title).toBeFocused();
      await selectSiteTheme(page, "dark");
      await section
        .locator(".studio-sql-task-editor")
        .evaluate((node) =>
          window.scrollTo(
            0,
            window.scrollY + node.getBoundingClientRect().top - 230,
          ),
        );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: authenticatedTest.info().outputPath("studio-sql-mobile.png"),
        fullPage: false,
      });
      await section
        .getByRole("button", { name: "Descer tarefa 1", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Salvar alterações", exact: true })
        .click();
      await expect(page.getByRole("status").first()).toHaveText(
        "Salvo no arquivo.",
      );
      const reordered = lessonSqlPlacement(await readFile(file, "utf8"));
      expect(reordered).toEqual({
        ...initial,
        tasks: [initial.tasks[1], initial.tasks[0], initial.tasks[2]],
      });
      await page.reload();
      await expect(
        section.locator(".studio-sql-task-editor > li").first(),
      ).toContainText("Selecionar os nomes dos clientes");
      await section
        .locator("summary")
        .filter({ hasText: /^Tarefa 2:/ })
        .click();
      page.once("dialog", (dialog) => dialog.dismiss());
      await section
        .getByRole("button", { name: "Retirar tarefa", exact: true })
        .click();
      await expect(section.locator(".studio-sql-task-editor > li")).toHaveCount(
        3,
      );
      page.once("dialog", (dialog) => dialog.accept());
      await section
        .getByRole("button", { name: "Retirar tarefa", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Salvar alterações", exact: true })
        .click();
      await expect(page.getByRole("status").first()).toHaveText(
        "Salvo no arquivo.",
      );
      expect(store.definition(before.id, before.version)).toEqual(before);
      await page.goto(path);
      await expect(
        page.getByRole("region", { name: "Tarefas da lição", exact: true }),
      ).toContainText("0 de 2 concluídas");
      // Simulated completion in Studio never becomes learner progress.
    } finally {
      await writeFile(file, original);
    }
  },
);

authenticatedTest(
  "Studio recovers an existing immutable publication without republishing and rejects stale task drafts",
  async ({ page, request }) => {
    authenticatedTest.setTimeout(90000);
    const { lessonSqlPlacement } = await import("@bunkercode/content");
    const { SqlContent } = await import("../../backend/src/sql/content");
    const { generateFormativeOracle } =
      await import("@bunkercode/content/sql-grading");
    const root = process.env.BUNKERCODE_BROWSER_CONTENT_DIR!;
    const store = new SqlContent(join(root, "sql"));
    const path =
      "/courses/sql-na-pratica/lessons/seu-primeiro-contato-com-um-banco-de-dados";
    const file = join(
      root,
      "courses/sql-na-pratica/lessons/seu-primeiro-contato-com-um-banco-de-dados/lesson.md",
    );
    const original = await readFile(file, "utf8");
    const definition = store.definition("store-all-customers", 1);
    const oldBytes = JSON.stringify(definition);
    const nextVersion =
      Math.max(
        ...store
          .versions()
          .map((entry) => store.definition(entry.id, entry.version))
          .filter((entry) => entry.id === definition.id)
          .map((entry) => entry.version),
      ) + 1;
    const next = {
      ...definition,
      version: nextVersion,
      status: "draft" as const,
      title: "Clientes com publicação recuperável",
      formative: { kind: "public-result" as const },
    };
    // Canonical file fixture, not proof of remote runner publication.
    const previousDraft = store
      .drafts()
      .find((entry) => entry.definition.id === next.id);
    const saved = store.saveDraft(next, previousDraft?.revision ?? null);
    store.publish(
      next.id,
      saved.revision,
      await generateFormativeOracle(next, store.dataset("store", 1)),
    );
    let publishRequests = 0;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/publish"))
        publishRequests++;
    });
    try {
      await page.goto(path + "/edit");
      await studioView(page, "Editar fonte Markdown");
      const section = page.getByRole("region", {
        name: "Prática SQL da lição",
        exact: true,
      });
      await section
        .locator("summary")
        .filter({ hasText: /^Tarefa 1:/ })
        .click();
      await expect(
        section.locator(".studio-sql-task-editor > li").first(),
      ).toContainText("vínculo pendente");
      // First linking attempt fails after publication, without losing the durable version.
      await page.route(
        `**/api/content/sql/exercises/${next.id}/${next.version}`,
        (route) => route.abort(),
      );
      await section
        .getByRole("button", {
          name: "Vincular publicação à lição",
          exact: true,
        })
        .click();
      await expect(section.getByRole("alert")).toBeVisible();
      await expect(
        section.getByRole("button", {
          name: "Vincular publicação à lição",
          exact: true,
        }),
      ).toBeEnabled();
      await page.unroute(
        `**/api/content/sql/exercises/${next.id}/${next.version}`,
      );
      let resume: (() => void) | undefined;
      const held = new Promise<void>((resolve) => {
        resume = resolve;
      });
      let requested: (() => void) | undefined;
      const started = new Promise<void>((resolve) => {
        requested = resolve;
      });
      await page.route(
        `**/api/content/sql/exercises/${next.id}/${next.version}`,
        async (route) => {
          requested?.();
          await held;
          await route.continue();
        },
      );
      await section
        .getByRole("button", {
          name: "Vincular publicação à lição",
          exact: true,
        })
        .click();
      await started;
      const markdown = page.getByRole("textbox", {
        name: "Markdown completo",
        exact: true,
      });
      await markdown.fill(
        (await markdown.inputValue()) +
          "\n\nTexto escrito durante o vínculo.\n",
      );
      resume?.();
      await expect(section.getByRole("alert")).toContainText("lição mudou");
      await expect(markdown).toHaveValue(/Texto escrito durante o vínculo/);
      await page.unroute(
        `**/api/content/sql/exercises/${next.id}/${next.version}`,
      );
      await section
        .getByRole("button", {
          name: "Vincular publicação à lição",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Salvar alterações", exact: true })
        .click();
      await expect(page.getByRole("status").first()).toHaveText(
        "Salvo no arquivo.",
      );
      expect(await readFile(file, "utf8")).toContain(
        "Texto escrito durante o vínculo.",
      );
      const linked = lessonSqlPlacement(await readFile(file, "utf8"));
      expect(
        linked?.kind === "sql-task-sequence" && linked.tasks[0]?.version,
      ).toBe(nextVersion);
      expect(publishRequests).toBe(0);
      expect(
        JSON.stringify(store.definition(definition.id, definition.version)),
      ).toBe(oldBytes);
      const title = section.getByRole("textbox", {
        name: "Título da tarefa 1",
        exact: true,
      });
      await title.fill("Minha edição local");
      await section
        .getByRole("button", { name: "Salvar tarefa", exact: true })
        .click();
      const durable = store.draft(definition.id);
      // Another ADMIN saves the same canonical draft first.
      const concurrent = await request.put(
        "/api/content/sql/authoring/drafts",
        {
          headers: {
            Origin: "http://127.0.0.1:5184",
            "X-Bunkercode-Client": "local",
          },
          data: {
            definition: {
              ...durable.definition,
              instructions: "Alteração concorrente preservada",
            },
            revision: durable.revision,
          },
        },
      );
      expect(concurrent.ok()).toBe(true);
      await title.fill("Edição com revisão obsoleta");
      await section
        .getByRole("button", { name: "Salvar tarefa", exact: true })
        .click();
      await expect(section.getByRole("alert")).toContainText(
        /revisão|rascunho|mudou|outro/i,
      );
      await expect(title).toHaveValue("Edição com revisão obsoleta");
      expect(store.draft(definition.id).definition.instructions).toBe(
        "Alteração concorrente preservada",
      );
      expect(store.draft(definition.id).definition.version).toBe(
        nextVersion + 1,
      );
      page.once("dialog", (dialog) => dialog.accept());
      await section
        .getByRole("button", { name: "Descartar edição", exact: true })
        .click();
      await page.goto(path);
      await expect(page.locator(".sql-current-task")).toContainText(next.title);
      await expect(
        page.getByRole("region", { name: "Tarefas da lição", exact: true }),
      ).toContainText("0 de 3 concluídas");
    } finally {
      await writeFile(file, original);
    }
  },
);
