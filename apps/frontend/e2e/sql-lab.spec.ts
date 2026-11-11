import {
  expectRenderedContrast,
  selectReadingTone,
} from "./reading-theme-checks";
import { test as authenticatedTest } from "./auth-fixture";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { studioView } from "./studio-controls";
import { expect, test } from "@playwright/test";

test("SQL laboratory executes, verifies, recovers and resets without application SQL requests", async ({
  page,
}) => {
  test.setTimeout(150000);
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/")) apiRequests.push(request.url());
  });
  await page.goto("/sql");
  const editor = page.getByRole("textbox", { name: "Consulta SQL" });
  const status = page.locator(".sql-workspace [role=status]");
  const execute = page.getByRole("button", { name: "Executar consulta" });
  const verify = page.getByRole("button", { name: "Verificar resposta" });
  const write = async (sql: string) => editor.fill(sql);
  await expect(editor).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Entrar", exact: true }),
  ).toBeVisible();
  apiRequests.length = 0;
  await execute.click();
  await expect(status).toHaveText("Consulta concluída.", { timeout: 65000 });
  await expect(page.getByRole("cell", { name: "Ana Lima" })).toBeVisible();
  await write(
    "SELECT * FROM customers WHERE city = 'Recife' ORDER BY name DESC;",
  );
  await execute.click();
  await expect(page.getByText("2 linhas exibidas.")).toBeVisible();
  await expect(page.locator("tbody tr").first()).toContainText("Carla Souza");
  await verify.click();
  await expect(status).toHaveText("Resposta correta!");
  await write("SELECT id, name, city FROM customers WHERE city IN ('Recife');");
  await expect(status).not.toHaveText("Resposta correta!");
  await verify.click();
  await expect(status).toHaveText("Resposta correta!");
  for (const sql of [
    "SELECT * FROM customers WHERE name = 'Ana Lima';",
    "SELECT * FROM customers;",
    "SELECT name, city FROM customers WHERE city = 'Recife';",
    "SELECT * FROM customers WHERE city = 'Recife' UNION ALL SELECT * FROM customers WHERE id = 1;",
  ]) {
    await write(sql);
    await verify.click();
    await expect(status).toContainText("Ainda não corresponde");
  }
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
    await verify.click();
    await expect(status).toContainText("Erro SQL");
  }
  await write("SELECT note FROM orders WHERE id = 102;");
  await execute.click();
  await expect(page.getByRole("cell", { name: "NULL" })).toBeVisible();
  await write("SELECT * FROM customers WHERE city = 'Manaus';");
  await execute.click();
  await expect(page.getByText("0 linhas exibidas.")).toBeVisible();
  await expect(page.getByRole("columnheader")).toHaveText([
    "id",
    "name",
    "city",
  ]);
  await expect(
    page.getByText("Nenhuma linha corresponde à consulta."),
  ).toBeVisible();
  await write("SELECT * FROM generate_series(1, 200) AS n;");
  await verify.click();
  await expect(page.getByText(/limite de 100/)).toBeVisible();
  await expect(status).toContainText("Ainda não corresponde");
  await write("SELECT pg_sleep(1), 'old result' AS stale;");
  await execute.click();
  await expect(execute).toBeDisabled();
  await write("SELECT * FROM customers;");
  await expect(status).toContainText("A consulta mudou durante", {
    timeout: 5000,
  });
  await expect(page.getByRole("columnheader", { name: "stale" })).toHaveCount(
    0,
  );
  await execute.click();
  await expect(page.getByText("4 linhas exibidas.")).toBeVisible();
  await write("SELECT pg_sleep(30);");
  await execute.click();
  await expect(status).toContainText("O tempo limite terminou", {
    timeout: 25000,
  });
  await write("SELECT * FROM customers;");
  await execute.click();
  await expect(page.getByText("4 linhas exibidas.")).toBeVisible({
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
  await expect(page.getByText("4 linhas exibidas.")).toBeVisible({
    timeout: 65000,
  });
  expect(apiRequests).toEqual([]);
  await write("SELECT pg_sleep(30);");
  await execute.click();
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Táticas", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "SQL", exact: true })
    .click();
  await expect(editor).toHaveText("SELECT * FROM customers;");
  await execute.click();
  await expect(page.getByText("4 linhas exibidas.")).toBeVisible({
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
  await page.goto("/sql");
  const editor = page.getByRole("textbox", { name: "Consulta SQL" });
  await editor.fill("SELECT * FROM customers WHERE false;");
  await page.getByRole("button", { name: "Executar consulta" }).click();
  await expect(page.getByText("0 linhas exibidas.")).toBeVisible({
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
    await expect(page.locator(".cm-editor")).toHaveCSS(
      "background-color",
      theme === "Light" ? "rgb(244, 244, 245)" : "rgb(32, 35, 40)",
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

test("table explorer keeps the editor and valid feedback while reading real rows", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/sql");
  const editor = page.getByRole("textbox", { name: "Consulta SQL" });
  const sql = "SELECT * FROM customers WHERE city = 'Recife'";
  await editor.fill(sql);
  await page.getByRole("button", { name: "Verificar resposta" }).click();
  const status = page.locator(".sql-workspace [role=status]");
  await expect(status).toHaveText("Resposta correta!", { timeout: 65000 });
  await page.getByLabel("Tabela", { exact: true }).selectOption("orders");
  await page.getByRole("button", { name: "Ver registros" }).click();
  const records = page.getByRole("region", { name: "Registros de orders" });
  await expect(
    records.getByRole("cell", { name: "Livros", exact: true }),
  ).toBeVisible();
  await expect(
    records.getByRole("columnheader", { name: "customer_id", exact: true }),
  ).toBeVisible();
  await expect(editor).toHaveText(sql);
  await expect(status).toHaveText("Resposta correta!");
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByText("Dados disponíveis", { exact: true }).click();
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
});

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
      await page.getByRole("button", { name: "Verificar resposta" }).click();
      await expect(page.locator(".sql-workspace [role=status]")).toHaveText(
        "Resposta correta!",
        { timeout: 65000 },
      );
      await expect(
        page.getByRole("button", { name: "Marcar como concluída" }),
      ).toHaveCount(0);
      // mobileView rerenders LessonWorkspace and recreates its configuration object.
      await page.setViewportSize({ width: 375, height: 812 });
      await page.getByRole("button", { name: "Código", exact: true }).click();
      await expect(editor).toHaveText(sql);
      await expect(page.locator(".sql-workspace [role=status]")).toHaveText(
        "Resposta correta!",
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
        await expect(page.locator(".sql-workspace [role=status]")).toHaveText(
          "Resposta correta!",
        );
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
      await page
        .getByRole("navigation", { name: "Navegação principal" })
        .getByRole("link", { name: "SQL", exact: true })
        .click();
      await expect(editor).toHaveText("SELECT * FROM customers;");
      expect(forbidden).toEqual([]);
    },
  );
});

test("mutation execution accumulates disposable changes and verification never repeats them", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/sql");
  await page
    .getByLabel("Atividade demonstrativa")
    .selectOption("store-update-city");
  const editor = page.getByRole("textbox", { name: "Consulta SQL" });
  const status = page.locator(".sql-workspace [role=status]");
  const execute = page.getByRole("button", { name: "Executar comando" });
  const verify = page.getByRole("button", { name: "Verificar estado" });
  await editor.fill("UPDATE customers SET city = 'Recife' WHERE id = 2");
  await verify.click();
  await expect(status).toContainText("O estado ainda não corresponde", {
    timeout: 65000,
  });
  await execute.click();
  await expect(status).toContainText("1 linha afetada");
  await verify.click();
  await expect(status).toHaveText("Resposta correta!");
  await verify.click();
  await expect(status).toHaveText("Resposta correta!");
  await page.getByRole("button", { name: "Ver registros" }).click();
  const records = page.getByRole("region", { name: "Registros de customers" });
  await expect(
    records.locator("tbody tr").filter({ hasText: "Bruno Alves" }),
  ).toContainText("Recife");
  await expect(status).toHaveText("Resposta correta!");
  await editor.fill("UPDATE customers SET city = 'Recife'");
  await execute.click();
  await verify.click();
  await expect(status).toContainText("O estado ainda não corresponde");
  await page.getByRole("button", { name: "Reiniciar banco" }).click();
  await page.getByRole("button", { name: "Ver registros" }).click();
  await expect(
    records.locator("tbody tr").filter({ hasText: "Bruno Alves" }),
  ).toContainText("Olinda", { timeout: 65000 });
  await expect(editor).toHaveText("UPDATE customers SET city = 'Recife'");
  await page.screenshot({
    path: test.info().outputPath("sql-mutation-preview.png"),
    fullPage: true,
  });
  await page
    .getByLabel("Atividade demonstrativa")
    .selectOption("store-customers-recife");
  await expect(editor).toHaveText("SELECT * FROM customers;");
  await page.getByRole("button", { name: "Executar consulta" }).click();
  await expect(status).toHaveText("Consulta concluída.", { timeout: 65000 });
});

test("read-only demonstration collection switches activities and grades progressive real queries", async ({
  page,
}) => {
  test.setTimeout(90000);
  const { sqlExercises } = await import("../src/sql-lab/exercise-catalog");
  await page.goto("/sql");
  for (const exercise of sqlExercises) {
    if (exercise.mode !== "query") continue;
    await page.getByLabel("Atividade demonstrativa").selectOption(exercise.id);
    const editor = page.getByRole("textbox", { name: "Consulta SQL" });
    await expect(editor).toHaveText(exercise.starterSql);
    await editor.fill(exercise.expectedQuery);
    await page.getByRole("button", { name: "Verificar resposta" }).click();
    await expect(page.locator(".sql-workspace [role=status]")).toHaveText(
      "Resposta correta!",
      { timeout: 65000 },
    );
    if (exercise.orderMatters) {
      await editor.fill(exercise.expectedQuery.replace("DESC", "ASC"));
      await page.getByRole("button", { name: "Verificar resposta" }).click();
      await expect(page.locator(".sql-workspace [role=status]")).toContainText(
        "Ainda não corresponde",
      );
    }
  }
});

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
  await page.goto("/sql");
  await page.getByRole("button", { name: "Executar consulta" }).click();
  await expect(page.locator(".sql-workspace [role=status]")).toContainText(
    "O laboratório falhou",
  );
  await page.getByRole("button", { name: "Executar consulta" }).click();
  await expect(page.locator(".sql-workspace [role=status]")).toHaveText(
    "Consulta concluída.",
    { timeout: 65000 },
  );
});
