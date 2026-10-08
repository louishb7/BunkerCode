import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import type { RunDetail } from "@backendlab/protocol";

const apiPath = "/api/workspaces/local/systems/orderdesk";
const headers = { "x-bunkerlab-client": "local" };

test("guided investigation reveals real evidence progressively and compares an explicit code change", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const bench = await (await page.request.get(apiPath)).json();
  const inventoryPath = join(bench.codePath, "inventory.mjs");
  const storePath = join(bench.codePath, "order-store.mjs");
  const originalInventory = await readFile(inventoryPath, "utf8");
  const originalStore = await readFile(storePath, "utf8");
  try {
    await writeFile(
      inventoryPath,
      await readFile(resolve("../../templates/orderdesk/inventory.mjs")),
    );
    await writeFile(
      storePath,
      await readFile(resolve("../../templates/orderdesk/order-store.mjs")),
    );
    await page.request.post(`${apiPath}/runtime/restart`, {
      headers,
      data: {},
    });
    await page.reload();
    await expect(
      page.frameLocator("iframe").getByRole("button", { name: "Criar pedido" }),
    ).toBeEnabled();
    await page
      .frameLocator("iframe")
      .getByRole("button", { name: "Criar pedido" })
      .click();
    await expect(page.locator(".activity-bar")).toContainText("POST /orders");
    let baseline!: RunDetail;
    for (let attempt = 0; attempt < 5; attempt++) {
      await page.getByRole("button", { name: "Testar", exact: true }).click();
      const tool = page.getByRole("dialog");
      await expect(tool.getByLabel("Clientes simultâneos")).toBeVisible();
      await expect(tool.getByLabel("Quantidade de requests")).toBeHidden();
      await tool.getByLabel("Clientes simultâneos").fill("12");
      await tool.getByText("Configurações avançadas", { exact: true }).click();
      await tool.getByLabel("Estoque antes do teste").fill("3");
      await tool.getByLabel("Concorrência", { exact: true }).fill("7");
      await tool
        .getByRole("button", { name: "Executar teste", exact: true })
        .click();
      await expect(
        tool.getByRole("heading", { name: "Observado nesta execução" }),
      ).toBeVisible();
      const id = (await tool
        .getByRole("link", { name: /Inspecionar Run/ })
        .getAttribute("href"))!
        .split("/")
        .at(-1)!;
      baseline = await (await page.request.get(`${apiPath}/runs/${id}`)).json();
      if (baseline.investigations?.[0]?.available) {
        await tool
          .getByRole("button", { name: "Investigar", exact: true })
          .click();
        break;
      }
      await expect(tool).toContainText("Não foi observado estoque negativo");
      await page.getByRole("button", { name: "Fechar painel" }).click();
    }
    expect(baseline.investigations![0]!.available).toBe(true);
    const drawer = page.getByRole("dialog", { name: "Investigar o estoque" });
    await expect(drawer).toBeVisible();
    await expect(drawer).not.toContainText(
      /race condition|transaction|atomicidade|update condicional|Pista 1/i,
    );
    await expect(drawer).toContainText("Estoque inicial");
    await expect(drawer.locator(".investigation-facts")).toContainText(
      String(baseline.run.result!.finalStock),
    );
    await page.screenshot({
      path: "../../.bunkerlab/browser-results/investigation-observation.png",
    });
    await drawer
      .getByRole("button", { name: "Ver como isso aconteceu" })
      .click();
    const selected = baseline.investigations![0]!.evidence;
    for (const item of selected) {
      await expect(
        drawer.locator(`[data-sequence="${item.sequence}"]`),
      ).toContainText(item.label);
      expect(
        baseline.evidence.some((event) => event.sequence === item.sequence),
      ).toBe(true);
    }
    await expect(drawer.locator(".evidence-comparison")).toBeVisible();
    await expect(drawer).toContainText("O que cada request sabia");
    await expect(drawer).not.toContainText(
      /race condition|transaction|atomicidade/i,
    );
    await page.screenshot({
      path: "../../.bunkerlab/browser-results/investigation-evidence.png",
    });
    await drawer.getByRole("button", { name: "Localizar no código" }).click();
    await expect(
      drawer.getByRole("link", { name: "Abrir código no VS Code" }),
    ).toHaveAttribute("href", /inventory.mjs$/);
    await expect(drawer).not.toContainText("Compare o estoque lido");
    await drawer.getByRole("button", { name: "Pedir pista 1" }).click();
    await expect(drawer).toContainText("Ele permaneceu igual?");
    await expect(drawer).not.toContainText("outra pode avançar");
    await page.getByRole("button", { name: "Fechar painel" }).click();
    await page.reload();
    await expect(
      page.frameLocator("iframe").getByRole("button", { name: "Criar pedido" }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Retomar investigação" }).click();
    await expect(drawer).toContainText("Ele permaneceu igual?");
    await expect(drawer).not.toContainText("outra pode avançar");
    await drawer.getByRole("button", { name: "Pedir pista 2" }).click();
    await expect(drawer).toContainText("outra pode avançar");
    await expect(drawer).not.toContainText(
      "Verificar uma condição e agir depois",
    );
    await drawer
      .getByRole("button", { name: "Salvar checkpoint antes da tentativa" })
      .click();
    await expect(drawer).toContainText("Checkpoint da tentativa salvo.");
    const checkpointBench = await (await page.request.get(apiPath)).json();
    expect(checkpointBench.checkpoints[0].kind).toBe("user");
    expect(await readFile(inventoryPath, "utf8")).not.toMatch(
      /strategy|atomicOrder/,
    );
    expect(await readFile(storePath, "utf8")).not.toMatch(/stock >= \?/);
    await drawer.getByRole("button", { name: "Entender o conceito" }).click();
    await expect(drawer).toContainText("check-then-act");
    await expect(drawer).not.toContainText("Você pode fazer o banco");
    await drawer.getByRole("button", { name: "Explorar estratégias" }).click();
    await expect(drawer.locator(".investigation-hint[open]")).toContainText(
      "update condicional",
    );
    await expect(drawer.locator(".investigation-hint[open]")).not.toContainText(
      "order-store.mjs",
    );
    await drawer
      .getByRole("button", { name: "Direção de implementação" })
      .click();
    await expect(drawer).toContainText("order-store.mjs");
    await page.screenshot({
      path: "../../.bunkerlab/browser-results/investigation-guidance.png",
    });
    await page.getByRole("button", { name: "Fechar painel" }).click();
    const loaded = (await (await page.request.get(apiPath)).json()).runtime;
    // A real implementation change in two workspace files, never a strategy toggle.
    await writeFile(
      inventoryPath,
      (await readFile(inventoryPath, "utf8")).replace(
        "  if (product.stock < input.quantity) return null;\n",
        "",
      ),
    );
    await writeFile(
      storePath,
      await readFile(
        resolve("../api/test/fixtures/conditional-order-store.txt"),
      ),
    );
    await expect(page.locator(".code-change")).toContainText(
      "Alterações ainda não aplicadas",
    );
    const dirty = await (await page.request.get(apiPath)).json();
    expect(dirty.runtime.code.digest).toBe(loaded.code.digest);
    expect(dirty.workingCode.digest).not.toBe(loaded.code.digest);
    await page
      .locator(".workbench-tools")
      .getByRole("button", { name: "Aplicar e reiniciar" })
      .click();
    await expect(page.locator(".code-change")).toHaveCount(0);
    const applied = await (await page.request.get(apiPath)).json();
    expect(applied.runtime.pid).not.toBe(loaded.pid);
    expect(applied.runtime.code.digest).toBe(applied.workingCode.digest);
    await page.getByRole("button", { name: "Retomar investigação" }).click();
    await drawer
      .getByRole("button", { name: "Executar novamente", exact: true })
      .click();
    const comparison = drawer.getByRole("region", {
      name: "Comparação da investigação",
    });
    await expect(comparison).toContainText(
      "Não foi observado estoque negativo nesta execução",
    );
    await expect(comparison).not.toContainText(/corrigido|concluído/i);
    const afterId = (await comparison
      .getByRole("link", { name: "Inspecionar nova Run" })
      .getAttribute("href"))!
      .split("/")
      .at(-1)!;
    const after: RunDetail = await (
      await page.request.get(`${apiPath}/runs/${afterId}`)
    ).json();
    expect(after.run.config).toEqual(baseline.run.config);
    expect(baseline.run.config).toEqual({
      clients: 12,
      concurrency: 7,
      stock: 3,
    });
    expect(after.run.result!.accepted).toBe(3);
    expect(after.run.result!.finalStock).toBe(0);
    expect(after.run.code.digest).not.toBe(baseline.run.code.digest);
    expect(
      await (
        await page.request.get(`${apiPath}/runs/${baseline.run.id}`)
      ).json(),
    ).toEqual(baseline);
    await comparison.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "../../.bunkerlab/browser-results/investigation-comparison.png",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await drawer.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "../../.bunkerlab/browser-results/investigation-mobile.png",
    });
    await page.getByRole("button", { name: "Fechar painel" }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("link", { name: "Checkpoints", exact: true }).click();
    const checkpoint = page
      .locator(".checkpoint-item")
      .filter({
        has: page.getByRole("heading", {
          name: /^Antes de investigar concorrência/,
        }),
      })
      .first();
    await checkpoint
      .getByRole("button", { name: "Restaurar", exact: true })
      .click();
    await checkpoint
      .getByRole("button", { name: "Restaurar com cópia de segurança" })
      .click();
    await expect(page.getByRole("status")).toContainText("Código restaurado");
    await expect(page.locator(".automatic-checkpoints")).not.toHaveAttribute(
      "open",
    );
    await expect(
      page.getByText("Backup automático", { exact: true }).first(),
    ).toBeHidden();
    await page.locator(".automatic-checkpoints > summary").click();
    await expect(
      page.getByText("Backup automático", { exact: true }).first(),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await writeFile(inventoryPath, originalInventory);
    await writeFile(storePath, originalStore);
    await page.request.post(`${apiPath}/runtime/restart`, {
      headers,
      data: {},
    });
  }
});

test("wrong attempts, partial fixes and an alternative implementation remain inspectable", async ({
  page,
}) => {
  await page.goto("/");
  const bench = await (await page.request.get(apiPath)).json();
  const inventoryPath = join(bench.codePath, "inventory.mjs");
  const storePath = join(bench.codePath, "order-store.mjs");
  const originalInventory = await readFile(inventoryPath, "utf8");
  const originalStore = await readFile(storePath, "utf8");
  const naive = await readFile(
    resolve("../../templates/orderdesk/inventory.mjs"),
    "utf8",
  );
  const store = await readFile(
    resolve("../../templates/orderdesk/order-store.mjs"),
    "utf8",
  );
  const drawer = page.getByRole("dialog");
  const comparison = page.getByRole("region", {
    name: "Comparação da investigação",
  });
  const apply = async () => {
    await expect(page.locator(".code-change")).toBeVisible();
    await page
      .locator(".workbench-tools")
      .getByRole("button", { name: "Aplicar e reiniciar" })
      .click();
    await expect(page.locator(".code-change")).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText(
      "Código salvo carregado",
    );
  };
  const rerun = async () => {
    await page.getByRole("button", { name: "Retomar investigação" }).click();
    const response = page.waitForResponse(
      (response) =>
        response.url().includes("/experiments/") &&
        response.request().method() === "POST",
    );
    await drawer
      .getByRole("button", { name: "Executar novamente", exact: true })
      .click();
    const created = await (await response).json();
    await expect(comparison).toContainText(`Run #${created.number}`);
    return (await (
      await page.request.get(`${apiPath}/runs/${created.id}`)
    ).json()) as RunDetail;
  };
  try {
    await writeFile(inventoryPath, naive);
    await writeFile(storePath, store);
    await page.request.post(`${apiPath}/runtime/restart`, {
      headers,
      data: {},
    });
    await page.reload();
    await expect(
      page.frameLocator("iframe").getByRole("button", { name: "Criar pedido" }),
    ).toBeEnabled();
    await page.screenshot({
      path: "../../.bunkerlab/browser-results/audit-workbench.png",
    });
    let baseline!: RunDetail;
    for (let attempt = 0; attempt < 5; attempt++) {
      await page.getByRole("button", { name: "Testar", exact: true }).click();
      await drawer
        .getByRole("button", { name: "Executar teste", exact: true })
        .click();
      await expect(
        drawer.getByRole("heading", { name: "Observado nesta execução" }),
      ).toBeVisible();
      const id = (await drawer
        .getByRole("link", { name: /Inspecionar Run/ })
        .getAttribute("href"))!
        .split("/")
        .at(-1)!;
      baseline = await (await page.request.get(`${apiPath}/runs/${id}`)).json();
      if (baseline.investigations?.[0]?.available) {
        await drawer
          .getByRole("button", { name: "Investigar", exact: true })
          .click();
        break;
      }
      await page.getByRole("button", { name: "Fechar painel" }).click();
    }
    expect(baseline.investigations![0]!.available).toBe(true);
    await page.screenshot({
      path: "../../.bunkerlab/browser-results/audit-observation.png",
    });
    await drawer
      .getByRole("button", { name: "Ver como isso aconteceu" })
      .click();
    await expect(drawer.locator(".evidence-comparison")).toBeVisible();
    await page.screenshot({
      path: "../../.bunkerlab/browser-results/audit-evidence.png",
    });
    await drawer.getByRole("button", { name: "Localizar no código" }).click();
    await drawer.getByRole("button", { name: "Pedir pista 1" }).click();
    await drawer.locator(".investigation-hint[open]").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "../../.bunkerlab/browser-results/audit-hint.png",
    });
    await page.getByRole("button", { name: "Fechar painel" }).click();
    await page.getByRole("link", { name: "Checkpoints", exact: true }).click();
    const label = `Antes das tentativas ${Date.now()}`;
    await page.getByLabel("O que mudou nesta versão?").fill(label);
    await page
      .getByRole("button", { name: "Salvar checkpoint", exact: true })
      .click();
    await expect(page.getByRole("heading", { name: label })).toBeVisible();
    await page.getByRole("link", { name: "Workbench", exact: true }).click();
    const loaded = (await (await page.request.get(apiPath)).json()).runtime;
    await writeFile(
      inventoryPath,
      naive.replace(
        "product.stock < input.quantity",
        "product.stock <= input.quantity",
      ),
    );
    await expect(page.locator(".code-change")).toContainText(
      "ainda não está executando",
    );
    expect(
      (await (await page.request.get(apiPath)).json()).runtime.code.digest,
    ).toBe(loaded.code.digest);
    await page.screenshot({
      path: "../../.bunkerlab/browser-results/audit-dirty.png",
    });
    await apply();
    const wrong = await rerun();
    expect(wrong.run.config).toEqual(baseline.run.config);
    await expect(comparison).toContainText(
      String(wrong.run.result!.finalStock),
    );
    await page.getByRole("button", { name: "Fechar painel" }).click();
    await writeFile(
      inventoryPath,
      'export async function createOrder(database, input) { return database.call("insertOrder", input); }',
    );
    await writeFile(
      storePath,
      store.replace("stock = stock - ?", "stock = MAX(0, stock - ?)"),
    );
    await apply();
    const partial = await rerun();
    expect(partial.run.result!.finalStock).toBe(0);
    expect(partial.run.result!.orderCount).toBe(20);
    await expect(comparison).toContainText("20 unidades em pedidos");
    await expect(comparison).toContainText("não conservam o estoque inicial");
    await expect(comparison).not.toContainText(
      /resolvido|corrigido|concluído/i,
    );
    await comparison.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "../../.bunkerlab/browser-results/audit-comparison.png",
    });
    await page.getByRole("button", { name: "Fechar painel" }).click();
    await writeFile(storePath, store);
    await writeFile(
      inventoryPath,
      naive.replace(
        "export async function createOrder",
        "async function performOrder",
      ) +
        "\nlet queue = Promise.resolve();\nexport async function createOrder(database, input, emit) { const next = queue.then(() => performOrder(database, input, emit)); queue = next.catch(() => {}); return next; }\n",
    );
    await apply();
    const alternate = await rerun();
    expect(alternate.run.result!.accepted).toBe(5);
    expect(alternate.run.result!.finalStock).toBe(0);
    expect(alternate.investigations![0]!.concerns).toEqual([]);
    await expect(comparison).not.toContainText(
      /resolvido|corrigido|concluído/i,
    );
    await page.getByRole("button", { name: "Fechar painel" }).click();
    await writeFile(inventoryPath, "invalid javascript !!!");
    await expect(page.locator(".code-change")).toBeVisible();
    await page
      .locator(".workbench-tools")
      .getByRole("button", { name: "Aplicar e reiniciar" })
      .click();
    await expect(page.locator(".surface-unavailable")).toContainText(
      "SyntaxError",
    );
    await page.getByRole("link", { name: "Checkpoints", exact: true }).click();
    const checkpoint = page
      .locator(".checkpoint-item")
      .filter({ has: page.getByRole("heading", { name: label, exact: true }) });
    await checkpoint
      .getByRole("button", { name: "Restaurar", exact: true })
      .click();
    await checkpoint
      .getByRole("button", { name: "Restaurar com cópia de segurança" })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Código restaurado no workspace",
    );
    await page.screenshot({
      path: "../../.bunkerlab/browser-results/audit-checkpoints.png",
    });
    await page.getByRole("link", { name: "Workbench", exact: true }).click();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Aplicar código restaurado" }),
    ).toBeVisible();
    expect(
      (await (await page.request.get(apiPath)).json()).runtime.status,
    ).toBe("stopped");
    await page
      .getByRole("button", { name: "Aplicar código restaurado" })
      .click();
    await expect(
      page.frameLocator("iframe").getByRole("button", { name: "Criar pedido" }),
    ).toBeEnabled();
    const restored = await rerun();
    expect(restored.run.code.digest).toBe(baseline.run.code.digest);
    await expect(comparison).toContainText(
      "Mesmo código da referência inicial",
    );
  } finally {
    await writeFile(inventoryPath, originalInventory);
    await writeFile(storePath, originalStore);
    await page.request.post(`${apiPath}/runtime/restart`, {
      headers,
      data: {},
    });
  }
});
