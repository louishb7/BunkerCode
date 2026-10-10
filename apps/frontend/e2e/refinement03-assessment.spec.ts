import { expect, test, type Page } from "@playwright/test";
const textbox = (page: Page) =>
  page.getByRole("textbox", { name: "Código da solução", exact: true });
async function code(page: Page, source: string) {
  await textbox(page).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(source);
}
for (const language of ["javascript", "typescript"] as const)
  test(`real ${language} function Run, fresh Submit, history, format and restore`, async ({
    page,
  }, info) => {
    test.setTimeout(150000);
    const ts = language === "typescript";
    await page.goto(
      ts
        ? "/courses/typescript/lessons/values-and-types"
        : "/courses/javascript/lessons/functions",
    );
    await expect(textbox(page)).toBeVisible();
    await expect(
      page.getByText("Aguardando execução", { exact: true }),
    ).toBeVisible();
    const runtime = await page.request.get("/api/practice/runtime");
    const status = (await runtime.json()) as {
      available: boolean;
      reason: string;
    };
    test.skip(!status.available, status.reason);
    await page
      .getByRole("button", { name: "testes.json", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "Testes públicos, somente leitura" }),
    ).toContainText("function");
    await page
      .getByRole("button", {
        name: ts ? "solucao.ts" : "solucao.js",
        exact: true,
      })
      .click();
    const results = page.getByRole("region", {
      name: "Compilação e resultados",
    });
    await code(page, ts ? 'const n: number = "bad";' : "function broken( {");
    await page.getByRole("button", { name: "Run", exact: true }).click();
    await expect(results).toContainText("Erros de compilação", {
      timeout: 30000,
    });
    await code(page, 'console.log("36");');
    await page.getByRole("button", { name: "Run", exact: true }).click();
    await expect(results).toContainText("0 de 4 testes aprovados", {
      timeout: 30000,
    });
    await expect(results).toContainText("não encontrada");
    const partial = ts
      ? "function isAvailable(stock: number): boolean { return stock >= 0; }"
      : "/** @param {number} price @param {number} quantity */\nfunction totalPrice(price, quantity) { return quantity === 0 ? 1 : price * quantity; }";
    await code(page, partial);
    await page.getByRole("button", { name: "Run", exact: true }).click();
    await expect(results).toContainText("3 de 4 testes aprovados", {
      timeout: 30000,
    });
    await expect(results).toContainText(
      ts ? "Falhou: Estoque igual a zero" : "Falhou: Quantidade zero",
    );
    const correct = ts
      ? "function isAvailable(stock:number):boolean{return stock>0}"
      : "/** @param {number} price @param {number} quantity */\nfunction totalPrice(price,quantity){return price*quantity}";
    await code(page, correct);
    await expect(results).toContainText("versão anterior");
    await page
      .getByRole("button", { name: "Formatar código", exact: true })
      .click();
    await expect(
      page.getByText("Código formatado.", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Run", exact: true }).click();
    await expect(results).toContainText("4 de 4 testes aprovados", {
      timeout: 30000,
    });
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(results).toContainText("Concluída pelos testes configurados", {
      timeout: 30000,
    });
    await code(page, partial);
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(results).toContainText("atividade não concluída", {
      timeout: 30000,
    });
    await code(page, correct);
    // Submit without an intervening Run must compile and test this new snapshot.
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(results).toContainText("Concluída pelos testes configurados", {
      timeout: 30000,
    });
    await page
      .getByRole("button", { name: "Histórico do código", exact: true })
      .click();
    const history = page.getByRole("region", { name: "Histórico do código" });
    await expect(history.locator("details")).toHaveCount(3);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(history).toContainText("testes falharam");
    await page
      .getByRole("button", { name: "Histórico do código", exact: true })
      .click();
    await page.screenshot({
      path: info.outputPath(`phase-c-${language}.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Restaurar código inicial", exact: true })
      .click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Cancelar", exact: true })
      .click();
    await expect(textbox(page)).toContainText(ts ? "stock" : "price");
    await page
      .getByRole("button", { name: "Restaurar código inicial", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Restaurar código", exact: true })
      .click();
    await expect(textbox(page)).toContainText(
      ts ? "remainingStock" : "unitPrice",
    );
    await expect(results).toContainText("Aguardando execução");
  });

test("existing unassessed submission remains read-only, with its old revision and unchanged code", async ({
  page,
}) => {
  await page.goto("/courses/typescript/lessons/values-and-types");
  await expect(textbox(page)).toBeVisible();
  const starter = await textbox(page).innerText();
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("bunkercode-practice", 2);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction("submissions", "readwrite");
          tx.objectStore("submissions").add({
            schema: 1,
            id: "legacy-record",
            scope: JSON.stringify([
              "bunkercode",
              "typescript",
              "values-and-types",
              "product-values",
            ]),
            course: "typescript",
            lesson: "values-and-types",
            exercise: "product-values",
            revision: "a".repeat(64),
            code: "// versão antiga preservada",
            at: Date.UTC(2026, 0, 1),
            state: "unassessed",
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
  );
  await page.reload();
  await expect(textbox(page)).toBeVisible();
  await page
    .getByRole("button", { name: "Histórico do código", exact: true })
    .click();
  const history = page.getByRole("region", { name: "Histórico do código" });
  await expect(history).toContainText("não avaliada · revisão anterior");
  await history.locator("summary").click();
  await expect(history.locator("pre")).toHaveText(
    "// versão antiga preservada",
  );
  await expect(textbox(page)).toHaveText(starter, { useInnerText: true });
});
