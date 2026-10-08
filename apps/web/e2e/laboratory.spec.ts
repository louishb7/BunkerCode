import { test, expect, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
const workspace = resolve(
  process.env.BUNKERLAB_BROWSER_DATA_DIR ??
    "../../.bunkerlab/browser-system-first",
  "workspaces/local/systems/orderdesk",
);
const inventory = join(workspace, "inventory.mjs");
const apiPath = "/api/workspaces/local/systems/orderdesk";
const headers = {
  "x-bunkerlab-client": "local",
  "content-type": "application/json",
};
async function restart(page: Page) {
  await page
    .locator(".workbench-tools")
    .getByRole("button", { name: /^(Reiniciar|Aplicar e reiniciar)$/ })
    .click();
  await expect(page.getByRole("status")).toContainText("Runtime reiniciado", {
    timeout: 15000,
  });
  await expect(
    page.frameLocator("iframe").getByRole("button", { name: "Criar pedido" }),
  ).toBeEnabled();
}
async function reset(page: Page) {
  await page.getByLabel("Mais opções").click();
  await page
    .getByRole("button", { name: "Resetar estado", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Código, checkpoints e histórico não serão alterados",
  );
  await page.getByRole("button", { name: "Confirmar reset" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.frameLocator("iframe").locator("#stock")).toHaveText("5");
}
async function save(page: Page, message: string) {
  await page.getByRole("link", { name: "Checkpoints", exact: true }).click();
  await page.getByLabel("O que mudou nesta versão?").fill(message);
  await page.getByRole("button", { name: "Salvar checkpoint" }).click();
  await expect(page.getByRole("status")).toContainText("Checkpoint salvo");
}
async function concurrent(page: Page) {
  await page.getByRole("button", { name: "Testar", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Testar OrderDesk" });
  await expect(drawer).not.toContainText(
    /resultado esperado|stock >= 0|5 aceitos|15 rejeitados/i,
  );
  await drawer.getByText("Configurações avançadas", { exact: true }).click();
  await drawer.getByLabel("Quantidade de requests").fill("20");
  await drawer.getByLabel("Concorrência", { exact: true }).fill("20");
  await drawer.getByLabel("Estoque antes do teste").fill("5");
  await drawer
    .getByRole("button", { name: "Executar teste", exact: true })
    .click();
  await expect(
    drawer.getByRole("heading", { name: "Observado nesta execução" }),
  ).toBeVisible();
  const link = drawer.getByRole("link", { name: /Inspecionar Run/ });
  const id = (await link.getAttribute("href"))!.split("/").at(-1)!;
  await link.click();
  await expect(page.getByRole("heading", { name: /Run #/ })).toBeVisible();
  return id;
}

test("the real system is the workbench; activities, testing, evolution and failures remain contextual", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  const surface = page.frameLocator("iframe");
  await expect(
    surface.getByRole("button", { name: "Criar pedido" }),
  ).toBeEnabled();
  await expect(page.locator(".topbar")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(
    /Workspace local|Backend engineering lab|Últimas investigações|SUA BANCADA|RESULTADO ESPERADO|stock >= 0/,
  );
  await writeFile(
    inventory,
    await readFile(resolve("../../templates/orderdesk/inventory.mjs")),
  );
  await writeFile(
    join(workspace, "order-store.mjs"),
    await readFile(resolve("../../templates/orderdesk/order-store.mjs")),
  );
  await restart(page);
  await reset(page);
  const baselineCount = (
    await (await page.request.get(`${apiPath}/runs`)).json()
  ).length;
  await expect(surface.locator("#stock")).toHaveText("5");
  await surface.getByRole("button", { name: "Criar pedido" }).click();
  await expect(surface.locator("#stock")).toHaveText("4");
  await expect(surface.locator("#rows tr")).toHaveCount(1);
  await expect(surface.locator("#rows")).toContainText("Mechanical Keyboard");
  await expect(page.locator(".activity-bar")).toContainText("POST /orders");
  await expect(page.locator(".activity-bar")).toContainText("201");
  await page
    .locator(".activity-bar")
    .getByRole("button", { name: "Inspecionar" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("stock.read");
  await expect(page.getByRole("dialog")).toContainText("stock.written");
  await expect(page.getByRole("dialog")).toContainText('"quantity": 1');
  await page.getByRole("button", { name: "Fechar painel" }).click();
  await surface.getByRole("button", { name: "Criar pedido" }).click();
  await expect(surface.locator("#rows tr")).toHaveCount(2);
  expect(
    (await (await page.request.get(`${apiPath}/runs`)).json()).length,
  ).toBe(baselineCount);
  await page.getByRole("button", { name: "Recolher navegação" }).click();
  await expect(page.locator(".app-shell")).toHaveClass(/sidebar-collapsed/);
  await page.reload();
  await expect(page.locator(".app-shell")).toHaveClass(/sidebar-collapsed/);
  await expect(
    surface.getByRole("button", { name: "Criar pedido" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Expandir navegação" }).click();
  await expect(page.locator(".app-shell")).toHaveClass(/sidebar-expanded/);
  await page.getByRole("button", { name: "Ocultar navegação" }).click();
  await expect(page.locator(".sidebar")).toBeHidden();
  await page.getByRole("button", { name: "Mostrar navegação" }).click();
  await page.screenshot({
    path: "../../.bunkerlab/browser-results/system-first-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Abrir código" }).click();
  await expect(page.getByRole("dialog")).toContainText("/systems/orderdesk");
  await expect(
    page.getByRole("button", { name: "Copiar caminho" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fechar painel" }).click();
  const checkpointLabel = `Surface baseline ${Date.now()}`;
  await save(page, checkpointLabel);
  await page.getByRole("link", { name: "Workbench", exact: true }).click();
  let baselineId = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    baselineId = await concurrent(page);
    if ((await page.locator(".page-heading .badge").textContent()) === "Falhou")
      break;
    await page.getByRole("link", { name: "Workbench", exact: true }).click();
  }
  await expect(page.locator(".page-heading .badge")).toHaveText("Falhou");
  await expect(
    page.getByText("Estoque terminou negativo.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Esperado", { exact: false }).first(),
  ).toBeHidden();
  await page
    .getByRole("button", { name: "Inspecionar request", exact: true })
    .click();
  await expect(page.getByText("stock.read", { exact: true })).toBeVisible();
  await writeFile(
    join(workspace, "order-store.mjs"),
    await readFile(resolve("../api/test/fixtures/conditional-order-store.txt")),
  );
  await page.getByRole("link", { name: "Workbench", exact: true }).click();
  await restart(page);
  await save(page, "Atomic inventory — surface validation");
  await page.getByRole("link", { name: "Workbench", exact: true }).click();
  const fixedId = await concurrent(page);
  await expect(page.locator(".page-heading .badge")).toHaveText("Passou");
  await expect(page.locator(".run-metrics")).toContainText("15");
  const fixed = await (
    await page.request.get(`${apiPath}/runs/${fixedId}`)
  ).json();
  expect(fixed.run.result.accepted).toBe(5);
  expect(fixed.run.result.finalStock).toBe(0);
  expect(fixed.requests).toHaveLength(20);
  await page.getByRole("link", { name: "Histórico", exact: true }).click();
  for (const id of [baselineId, fixedId])
    await page
      .locator("tbody tr")
      .filter({ has: page.locator(`a[href="/runs/${id}"]`) })
      .getByRole("checkbox")
      .check();
  await page.getByRole("link", { name: "Comparar selecionadas" }).click();
  await expect(page.locator(".compare-table")).toContainText("Falhou");
  await expect(page.locator(".compare-table")).toContainText("Passou");
  await expect(page.locator(".compare-table")).toContainText("5 → 0");
  await page.screenshot({
    path: "../../.bunkerlab/browser-results/system-first-compare.png",
    fullPage: true,
  });
  const codeBeforeReset = await readFile(inventory, "utf8");
  const checkpointsBeforeReset = (
    await (await page.request.get(apiPath)).json()
  ).checkpoints;
  await page.getByRole("link", { name: "Workbench", exact: true }).click();
  await reset(page);
  expect(await readFile(inventory, "utf8")).toBe(codeBeforeReset);
  expect((await (await page.request.get(apiPath)).json()).checkpoints).toEqual(
    checkpointsBeforeReset,
  );
  expect(
    await (await page.request.get(`${apiPath}/runs/${fixedId}`)).json(),
  ).toEqual(fixed);
  await page.getByRole("link", { name: "Checkpoints", exact: true }).click();
  const checkpoint = page.locator(".checkpoint-item").filter({
    has: page.getByRole("heading", { name: checkpointLabel, exact: true }),
  });
  await checkpoint
    .getByRole("button", { name: "Restaurar", exact: true })
    .click();
  await checkpoint
    .getByRole("button", { name: "Restaurar com cópia de segurança" })
    .click();
  await expect(page.getByRole("status")).toContainText("Código restaurado");
  expect(await readFile(inventory, "utf8")).toMatch(
    /database.call\("insertOrder", input\)/,
  );
  await page.getByRole("link", { name: "Sistemas", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sistemas", exact: true }),
  ).toBeVisible();
  await expect(page.locator("main")).not.toContainText(
    /PID|Porta|SHA-256|Código carregado/,
  );
  await page.getByRole("link", { name: "Abrir", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Aplicar código restaurado" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Aplicar código restaurado" }).click();
  await expect(
    surface.getByRole("button", { name: "Criar pedido" }),
  ).toBeEnabled();
  // Falha HTTP permanece na surface, com Activity inspecionável.
  const restored = await readFile(inventory, "utf8");
  try {
    await writeFile(
      inventory,
      restored.replace(
        "export async function createOrder(database, input, emit) {",
        'export async function createOrder(database, input, emit) { throw new Error("Surface failure");',
      ),
    );
    await restart(page);
    await surface.getByRole("button", { name: "Criar pedido" }).click();
    await expect(surface.locator("#notice")).toContainText("HTTP 500");
    await expect(page.locator(".activity-bar")).toContainText("500");
    await page
      .locator(".activity-bar")
      .getByRole("button", { name: "Inspecionar" })
      .click();
    await expect(page.getByRole("dialog")).toContainText("Surface failure");
    await page.getByRole("button", { name: "Fechar painel" }).click();
    // Syntax error aparece na área do sistema e mantém navegação, logs e restart.
    await writeFile(inventory, "invalid javascript !!!");
    await page
      .locator(".workbench-tools")
      .getByRole("button", { name: /^(Reiniciar|Aplicar e reiniciar)$/ })
      .click();
    await expect(page.locator(".surface-unavailable")).toContainText(
      "não está disponível",
    );
    await expect(page.locator(".surface-unavailable")).toContainText(
      "SyntaxError",
    );
    await page.getByRole("button", { name: "Ver logs" }).click();
    await expect(page.getByRole("dialog")).toContainText("SyntaxError");
    await page.getByRole("button", { name: "Fechar painel" }).click();
    await page.screenshot({
      path: "../../.bunkerlab/browser-results/system-first-failure.png",
      fullPage: true,
    });
    await page.getByRole("link", { name: "Histórico", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Histórico", exact: true }),
    ).toBeVisible();
    await writeFile(
      inventory,
      restored.replace(
        "export async function createOrder(database, input, emit) {",
        "export async function createOrder(database, input, emit) { process.exit(7);",
      ),
    );
    await page.getByRole("link", { name: "Workbench", exact: true }).click();
    await restart(page);
    await surface.getByRole("button", { name: "Criar pedido" }).click();
    await expect(page.locator(".surface-unavailable")).toContainText(
      "não está disponível",
    );
    await expect(page.locator(".activity-bar")).toContainText("Sem resposta");
    await page
      .locator(".activity-bar")
      .getByRole("button", { name: "Inspecionar" })
      .click();
    await expect(page.getByRole("dialog")).toContainText("runtime.exited");
    await page.getByRole("button", { name: "Fechar painel" }).click();
  } finally {
    await writeFile(inventory, restored);
    await page.request.post(`${apiPath}/runtime/restart`, {
      headers,
      data: {},
    });
  }
  await page.reload();
  await expect(
    surface.getByRole("button", { name: "Criar pedido" }),
  ).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Recolher navegação" }).click();
  await expect(
    surface.getByRole("button", { name: "Criar pedido" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../../.bunkerlab/browser-results/system-first-mobile.png",
    fullPage: true,
  });
  expect(pageErrors).toEqual([]);
});

test("surface code lives in the workspace and cannot access the host DOM or dispatch unauthorized operations", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.frameLocator("iframe").getByRole("button", { name: "Criar pedido" }),
  ).toBeEnabled();
  const path = join(workspace, "surface.html");
  const original = await readFile(path, "utf8");
  try {
    await writeFile(
      path,
      original.replace("<h1>Pedidos</h1>", "<h1>Minha surface editada</h1>"),
    );
    await restart(page);
    await expect(
      page
        .frameLocator("iframe")
        .getByRole("heading", { name: "Minha surface editada" }),
    ).toBeVisible();
    const frame = page.frames().find((item) => item.parentFrame());
    expect(
      await frame!.evaluate(() => {
        try {
          void parent.document.body;
          return false;
        } catch {
          return true;
        }
      }),
    ).toBe(true);
    const count = (
      await (await page.request.get(`${apiPath}/activities`)).json()
    ).length;
    await page.evaluate(() =>
      window.postMessage(
        {
          type: "bunkerlab:request",
          id: "forged",
          method: "POST",
          path: "/orders",
          body: { productId: "keyboard", quantity: 1 },
        },
        "*",
      ),
    );
    await page.waitForTimeout(100);
    expect(
      (await (await page.request.get(`${apiPath}/activities`)).json()).length,
    ).toBe(count);
    const denied = await page.request.post(`${apiPath}/activities`, {
      headers,
      data: { method: "POST", path: "/runtime/reset" },
    });
    expect(denied.status()).toBe(400);
    const before = await (await page.request.get(apiPath)).json();
    await page.reload();
    await expect(
      page
        .frameLocator("iframe")
        .getByRole("heading", { name: "Minha surface editada" }),
    ).toBeVisible();
    expect(
      (await (await page.request.get(apiPath)).json()).runtime.code.digest,
    ).toBe(before.runtime.code.digest);
  } finally {
    await writeFile(path, original);
    await page.request.post(`${apiPath}/runtime/restart`, {
      headers,
      data: {},
    });
  }
});
