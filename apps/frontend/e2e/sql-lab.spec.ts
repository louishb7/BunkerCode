import { expect, test } from "@playwright/test";

test("SQL laboratory executes, verifies, recovers and resets in the browser", async ({
  page,
}) => {
  test.setTimeout(150000);
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/")) apiRequests.push(request.url());
  });
  await page.goto("/sql");
  const editor = page.getByRole("textbox", { name: "Consulta SQL" });
  const status = page.getByRole("status");
  const execute = page.getByRole("button", { name: "Executar consulta" });
  const verify = page.getByRole("button", { name: "Verificar resposta" });
  const write = async (sql: string) => {
    await editor.fill(sql);
  };
  await expect(editor).toBeVisible();
  apiRequests.length = 0;
  await execute.click();
  await expect(status).toHaveText("Consulta concluída.", { timeout: 65000 });
  await expect(page.getByRole("cell", { name: "Ana Lima" })).toBeVisible();
  await write(
    "SELECT * FROM customers WHERE city = 'Recife' ORDER BY name DESC;",
  );
  await execute.click();
  await expect(page.getByText("2 linhas exibidas.")).toBeVisible();
  await verify.click();
  await expect(status).toHaveText("Resposta correta!");
  await write("SELECT id, name, city FROM customers WHERE city IN ('Recife');");
  await verify.click();
  await expect(status).toHaveText("Resposta correta!");
  await write("SELECT * FROM customers WHERE name = 'Ana Lima';");
  await verify.click();
  await expect(status).toContainText("Ainda não corresponde");
  await write("SELECT missing FROM customers;");
  await execute.click();
  await expect(status).toContainText("Erro SQL:");
  await write("SELECT note FROM orders WHERE id = 102;");
  await execute.click();
  await expect(page.getByRole("cell", { name: "NULL" })).toBeVisible();
  await write("SELECT * FROM customers WHERE city = 'Manaus';");
  await execute.click();
  await expect(page.getByText("0 linhas exibidas.")).toBeVisible();
  await write("SELECT * FROM generate_series(1, 200) AS n;");
  await execute.click();
  await expect(page.getByText(/limite de 100/)).toBeVisible();
  await page.getByRole("button", { name: "Reiniciar banco" }).click();
  await write("SELECT * FROM customers;");
  await execute.click();
  await expect(page.getByText("4 linhas exibidas.")).toBeVisible({
    timeout: 65000,
  });
  await page.screenshot({
    path: test.info().outputPath("sql-laboratory.png"),
    fullPage: true,
  });
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
  expect(apiRequests).toEqual([]);
});
