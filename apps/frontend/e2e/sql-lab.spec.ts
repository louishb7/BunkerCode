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
  const status = page.locator(".sql-interaction [role=status]");
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
