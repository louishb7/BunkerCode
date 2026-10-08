import { expect, test, type Page } from "@playwright/test";
const valid =
  "export function reserveStock(stock: number, quantity: number) { if (quantity > stock) return { accepted: false, stock }; return { accepted: true, stock: stock - quantity }; }";
async function prediction(
  page: Page,
  status: string,
  stock: string,
  orders: string,
  justification: string,
) {
  await page.getByLabel("Status HTTP previsto").fill(status);
  await page.getByLabel("Estoque final previsto").fill(stock);
  await page.getByLabel("Pedidos previstos").fill(orders);
  await page.getByLabel("Justificativa", { exact: true }).fill(justification);
}

test("order acceptance requires a prediction, preserves submissions and resumes the draft on reload", async ({
  page,
}, testInfo) => {
  await page.goto("/learn/order-acceptance");
  await expect(
    page.getByRole("heading", { name: "Este pedido será aceito?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Suas submissões" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Iniciar tentativa" }).click();
  const source = await page.getByLabel("Código TypeScript").inputValue();
  await expect(page.getByLabel("Código TypeScript")).toBeDisabled();
  await page
    .getByRole("button", { name: "Submeter previsão e executar" })
    .click();
  await expect(page.getByRole("alert")).toContainText("Preencha previsão");
  await expect(page.getByTestId("submission-1")).toHaveCount(0);
  await prediction(
    page,
    "409",
    "1",
    "0",
    "Acho que a igualdade será recusada.",
  );
  await page
    .getByRole("button", { name: "Salvar rascunho", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Rascunho salvo");
  await page.reload();
  await expect(page.getByLabel("Justificativa", { exact: true })).toHaveValue(
    "Acho que a igualdade será recusada.",
  );
  await expect(page.getByTestId("submission-1")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Submeter previsão e executar" })
    .click();
  const first = page.getByTestId("submission-1");
  await expect(
    first.getByRole("region", { name: "Evidência HTTP" }),
  ).toContainText("HTTP 201");
  await expect(first).toContainText("Difere");
  await page
    .getByLabel("Código TypeScript")
    .fill(source.replace("stock < quantity", "stock <= quantity"));
  await expect(page.getByLabel("Status HTTP previsto")).toHaveValue("");
  await prediction(
    page,
    "409",
    "1",
    "0",
    "A nova condição inclui a igualdade.",
  );
  await page
    .getByRole("button", { name: "Submeter previsão e executar" })
    .click();
  const second = page.getByTestId("submission-2");
  await expect(
    second.getByRole("region", { name: "Evidência HTTP" }),
  ).toContainText("HTTP 409");
  await expect(second).toContainText("Coincide");
  await first.getByText("Código desta submissão", { exact: true }).click();
  await expect(first.locator("pre").first()).toHaveText(source);
  await second.getByText("Código desta submissão", { exact: true }).click();
  await expect(second.locator("pre").first()).toContainText(
    "stock <= quantity",
  );
  await page
    .getByLabel("Reflexão final")
    .fill("A igualdade deixou de passar quando alterei a condição.");
  await page.getByRole("button", { name: "Concluir com reflexão" }).click();
  await expect(
    page.getByText("Tentativa concluída · reflexão registrada"),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("submission-2")).toContainText("HTTP 409");
  await page.screenshot({
    path: testInfo.outputPath("order-acceptance.png"),
    fullPage: true,
  });
});

test("reserve stock reports compile errors separately, locates failing cases and accepts correction", async ({
  page,
}, testInfo) => {
  await page.goto("/learn/reserve-stock");
  await page.getByRole("button", { name: "Iniciar tentativa" }).click();
  await expect(page.getByTestId("submission-1")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Submeter código e rodar testes" })
    .click();
  await expect(page.getByTestId("submission-1")).toContainText(
    "Função ainda não implementada.",
  );
  await page
    .getByLabel("Código TypeScript")
    .fill(
      'export function reserveStock() { const value: number = "bad"; return value; }',
    );
  await page
    .getByRole("button", { name: "Submeter código e rodar testes" })
    .click();
  const compilation = page.getByTestId("submission-2");
  await expect(compilation).toContainText(
    "Erro de compilação — testes não executados",
  );
  await expect(compilation).toContainText("Linha 1");
  await expect(
    compilation.getByRole("heading", { name: "Casos executados" }),
  ).toHaveCount(0);
  await page
    .getByLabel("Código TypeScript")
    .fill(valid.replace("quantity > stock", "quantity >= stock"));
  await page
    .getByRole("button", { name: "Submeter código e rodar testes" })
    .click();
  const failing = page.getByTestId("submission-3");
  await expect(failing).toContainText("✗ quantity equal to stock");
  await expect(failing).toContainText("Esperado:");
  await expect(failing).toContainText("✓ quantity below stock");
  await page.getByLabel("Código TypeScript").fill(valid);
  await page
    .getByRole("button", { name: "Salvar rascunho", exact: true })
    .click();
  await page.reload();
  await expect(page.getByLabel("Código TypeScript")).toHaveValue(valid);
  await page
    .getByRole("button", { name: "Submeter código e rodar testes" })
    .click();
  const passed = page.getByTestId("submission-4");
  await expect(passed).toContainText("✓ quantity equal to stock");
  await expect(passed.locator(".case-pass")).toHaveCount(3);
  await expect(failing).toContainText("✗ quantity equal to stock");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("Código TypeScript")).toBeVisible();
  const overflowing = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflowing).toBe(false);
  await page.screenshot({
    path: testInfo.outputPath("reserve-stock-mobile.png"),
    fullPage: true,
  });
});

test("local draft journal survives immediate reload and a stale tab cannot silently overwrite server code", async ({
  page,
  context,
}) => {
  await page.goto("/learn/reserve-stock");
  await page.getByRole("button", { name: "Iniciar tentativa" }).click();
  await expect(page.getByLabel("Código TypeScript")).toBeEnabled();
  const second = await context.newPage();
  await second.goto("/learn/reserve-stock");
  await expect(second.getByLabel("Código TypeScript")).toBeEnabled();
  await page.getByLabel("Código TypeScript").fill(valid);
  await page.reload();
  await expect(page.getByLabel("Código TypeScript")).toHaveValue(valid);
  await page
    .getByRole("button", { name: "Salvar rascunho", exact: true })
    .click();
  await second
    .getByLabel("Código TypeScript")
    .fill(valid.replace("quantity > stock", "quantity >= stock"));
  await second
    .getByRole("button", { name: "Salvar rascunho", exact: true })
    .click();
  await expect(second.getByRole("alert")).toContainText("outra aba");
  await page.reload();
  await expect(page.getByLabel("Código TypeScript")).toHaveValue(valid);
});
