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
  await expect(page.getByText("2 linhas exibidas.")).toBeVisible();
  await expect(page.locator("tbody tr").first()).toContainText("Carla Souza");
  await expect(status).toContainText("Resposta correta nesta prática!");
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
  await execute.click();
  await expect(page.getByText(/limite de 100/)).toBeVisible();
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
  expect(apiRequests.filter((url) => !url.includes("/content/sql/"))).toEqual(
    [],
  );
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

authenticatedTest(
  "table explorer keeps the editor and valid feedback while reading real rows",
  async ({ page }) => {
    test.setTimeout(90000);
    await page.goto("/sql");
    const editor = page.getByRole("textbox", { name: "Consulta SQL" });
    const sql = "SELECT * FROM customers WHERE city = 'Recife'";
    await editor.fill(sql);
    await page.getByRole("button", { name: "Executar consulta" }).click();
    const status = page.locator(".sql-workspace [role=status]");
    await expect(status).toContainText("Resposta correta nesta prática!", {
      timeout: 45000,
    });
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
    await expect(status).toContainText("Resposta correta nesta prática!", {
      timeout: 45000,
    });
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
      // mobileView rerenders LessonWorkspace and recreates its configuration object.
      await page.setViewportSize({ width: 375, height: 812 });
      await page.getByRole("button", { name: "Código", exact: true }).click();
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
      await page
        .getByRole("navigation", { name: "Navegação principal" })
        .getByRole("link", { name: "SQL", exact: true })
        .click();
      await expect(editor).toHaveText("SELECT * FROM customers;");
      expect(forbidden).toEqual([]);
    },
  );
});

authenticatedTest(
  "mutation execution accumulates disposable changes and verification never repeats them",
  async ({ page }) => {
    test.setTimeout(150000);
    await page.goto("/sql");
    await page
      .getByLabel("Atividade demonstrativa")
      .selectOption("store-update-city");
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
    await page.getByRole("button", { name: "Ver registros" }).click();
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
    await expect(status).toContainText("Ainda não corresponde", {
      timeout: 65000,
    });
  },
);

authenticatedTest(
  "mutation cancellation ignores late checks and restores deterministic table previews",
  async ({ page }) => {
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
    await expect(status).not.toContainText("Resposta correta nesta prática!");
    await verify.click();
    await expect(status).toContainText("Envie de 1 a 20 comandos SQL");
    await page.getByRole("button", { name: "Ver registros" }).click();
    await expect(
      page
        .getByRole("region", { name: "Registros de customers" })
        .locator("tbody tr")
        .filter({ hasText: "Bruno Alves" }),
    ).toContainText("Olinda", { timeout: 65000 });
    await editor.fill("DELETE FROM orders");
    await execute.click();
    await expect(status).toContainText("Comando concluído");
    await page.getByLabel("Tabela", { exact: true }).selectOption("orders");
    await page.getByRole("button", { name: "Ver registros" }).click();
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
    await page.getByRole("button", { name: "Ver registros" }).click();
    await expect(
      page
        .getByRole("region", { name: "Registros de orders" })
        .locator("tbody tr"),
    ).toHaveCount(4);
  },
);

authenticatedTest(
  "read-only demonstration collection switches activities and grades progressive real queries",
  async ({ page }) => {
    test.setTimeout(220000);
    const { sqlExercises } = await import("./sql-fixtures");
    await page.goto("/sql");
    for (const exercise of sqlExercises) {
      if (exercise.mode !== "query") continue;
      await page
        .getByLabel("Atividade demonstrativa")
        .selectOption(exercise.id);
      const editor = page.getByRole("textbox", { name: "Consulta SQL" });
      await expect(editor).toHaveText(exercise.starterSql);
      await editor.fill(exercise.expectedQuery);
      await page.getByRole("button", { name: "Executar consulta" }).click();
      await expect(page.locator(".sql-workspace [role=status]")).toContainText(
        "Resposta correta nesta prática!",
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
  await page.goto("/sql");
  await page.getByRole("button", { name: "Executar consulta" }).click();
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
  "canonical SQL course verifies, submits, reopens approved source and navigates lessons",
  async ({ page, context }) => {
    authenticatedTest.setTimeout(180000);
    await page.goto("/courses");
    await page.getByRole("link", { name: /SQL na Prática/ }).click();
    await page
      .getByRole("link", { name: /Seu primeiro contato com um banco de dados/ })
      .first()
      .click();
    const editor = page.getByRole("textbox", { name: "Consulta SQL" });
    const status = page.locator(".sql-workspace [role=status]");
    await expect(editor).toBeVisible();
    await editor.fill("SELECT name FROM customers");
    await page.getByRole("button", { name: "Submit · concluir lição" }).click();
    await expect(status).toContainText("Ainda não corresponde", {
      timeout: 45000,
    });
    await expect(
      page.getByText("Lição concluída", { exact: true }),
    ).toHaveCount(0);
    await editor.fill("SELECT id,name FROM customers ORDER BY id DESC");
    await page.getByRole("button", { name: "Executar consulta" }).click();
    await expect(status).toContainText("Resposta correta nesta prática!", {
      timeout: 45000,
    });
    await expect(
      page.getByText("Lição concluída", { exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Submit · concluir lição" }).click();
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
    await editor.fill(
      "SELECT name,city FROM customers WHERE city <> 'Recife' ORDER BY name DESC",
    );
    await page.getByRole("button", { name: "Submit · concluir lição" }).click();
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
    await page.getByRole("link", { name: "Atividades SQL" }).click();
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
        "Resposta correta nesta prática!",
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
      private requests = new Map<number, number>();
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.measured = String(url).includes("sql.worker");
        if (this.measured)
          this.addEventListener("message", (event) => {
            const received = performance.timeOrigin + performance.now();
            samples.push({
              type: event.data.type,
              created: this.created,
              started: this.requests.get(event.data.id),
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
          this.requests.set(
            message.id,
            performance.timeOrigin + performance.now(),
          );
          super.postMessage({ ...message, measure: true }, transferable);
        } else super.postMessage(message, transferable);
      }
    };
    document.addEventListener(
      "click",
      (event) => {
        if (
          !(event.target instanceof Element) ||
          !event.target
            .closest("button")
            ?.textContent?.includes("Executar consulta")
        )
          return;
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
            !/Resposta correta nesta prática|Consulta executada|Erro SQL/.test(
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
    `canonical formative loop is local for ${loggedIn ? "authenticated" : "anonymous"} learners, with recoverable errors and measured feedback`,
    async ({ page }) => {
      practiceTest.setTimeout(150000);
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
      const lessons = [
        {
          slug: "seu-primeiro-contato-com-um-banco-de-dados",
          correct: "SELECT id,name FROM customers ORDER BY id DESC",
          wrong: "SELECT name FROM customers",
          equivalent: "SELECT id,name FROM customers WHERE true",
          secondWrong: "SELECT name,id FROM customers",
        },
        {
          slug: "encontrando-o-que-importa",
          correct:
            "SELECT name,city FROM customers WHERE city <> 'Recife' ORDER BY name DESC",
          wrong:
            "SELECT name,city FROM customers WHERE city = 'Recife' ORDER BY name DESC",
          equivalent:
            "SELECT name,city FROM customers WHERE NOT(city = 'Recife') ORDER BY name DESC",
          secondWrong:
            "SELECT name,city FROM customers WHERE city <> 'Recife' ORDER BY name ASC",
        },
      ];
      for (const [index, lesson] of lessons.entries()) {
        await page.goto(`/courses/sql-na-pratica/lessons/${lesson.slug}`);
        const editor = page.getByRole("textbox", { name: "Consulta SQL" }),
          execute = page.getByRole("button", { name: "Executar consulta" }),
          status = page.locator(".sql-workspace [role=status]");
        await expect(editor).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Verificar resposta" }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("button", { name: "Submit · concluir lição" }),
        ).toHaveCount(loggedIn ? 1 : 0);
        // First action initializes the actual Worker and PGlite, including real data exploration.
        await page.locator(".sql-schema summary").click();
        await page.getByRole("button", { name: "Ver registros" }).click();
        await expect(
          page.getByRole("region", { name: "Registros de customers" }),
        ).toBeVisible({ timeout: 65000 });
        const queries = [
          lesson.wrong,
          lesson.correct,
          lesson.secondWrong,
          "SELECT missing FROM customers",
          lesson.equivalent,
          "SELECT * FROM customers WHERE false",
          "SELECT * FROM customers",
          "SELECT c.name,o.total FROM customers c JOIN orders o ON c.id=o.customer_id",
          "SELECT count(*) FROM orders",
          ...Array<string>(12).fill(lesson.correct),
        ];
        for (const [queryIndex, sql] of queries.entries()) {
          const previous = await editor.textContent();
          await editor.fill(sql);
          if (previous !== sql)
            await expect(status).not.toContainText(
              "Resposta correta nesta prática!",
            );
          await execute.click();
          await expect(execute).toBeEnabled();
          await expect(status).toContainText(
            sql === "SELECT missing FROM customers"
              ? "Erro SQL"
              : [1, 4].includes(queryIndex) || queryIndex >= 9
                ? "Resposta correta nesta prática!"
                : "Ainda não corresponde",
            { timeout: 65000 },
          );
          await expect(
            page.getByText("Lição concluída", { exact: true }),
          ).toHaveCount(0);
        }
        // An obsolete result is discarded even when it would have matched the oracle.
        await editor.fill(
          lesson.correct.replace(
            "FROM customers",
            "FROM customers CROSS JOIN (SELECT pg_sleep(0.3)) AS delay",
          ),
        );
        await execute.click();
        await editor.fill(lesson.wrong);
        await expect(status).toContainText("A consulta mudou durante", {
          timeout: 10000,
        });
        await expect(status).not.toContainText(
          "Resposta correta nesta prática!",
        );
        await execute.click();
        await expect(status).toContainText("Ainda não corresponde");
        await page.getByRole("button", { name: "Reiniciar banco" }).click();
        await expect(status).toContainText("Banco descartado");
        await editor.fill(lesson.correct);
        await execute.click();
        await expect(status).toContainText("Resposta correta nesta prática!", {
          timeout: 65000,
        });
        await status.scrollIntoViewIfNeeded();
        await page.screenshot({
          path: test
            .info()
            .outputPath(
              `canonical-${loggedIn ? "account" : "anonymous"}-${index + 1}.png`,
            ),
          fullPage: true,
        });
        await page.waitForTimeout(30); // allow the diagnostic frame callback to complete
        const timingFile = test
          .info()
          .outputPath(`sql-timings-${index + 1}.json`);
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
              navigation: performance
                .getEntriesByType("navigation")
                .map((entry) => entry.toJSON()),
            })),
            null,
            2,
          ),
        );
        await test
          .info()
          .attach(`sql-timings-${index + 1}.json`, {
            path: timingFile,
            contentType: "application/json",
          });
      }
      expect(writes).toEqual([]);
    },
  );
}
