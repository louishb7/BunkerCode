import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
const workspace = resolve(
  "../../.bunkerlab/browser-test/workspaces/local/systems/orderdesk",
);
const inventory = join(workspace, "inventory.mjs");
const apiPath = "/api/workspaces/local/systems/orderdesk";

test("build, run, inspect, modify, checkpoint, compare and restore a real backend", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Construa. Quebre. Investigue." }),
  ).toBeVisible();
  const original = await readFile(inventory, "utf8");
  await writeFile(
    inventory,
    original.replace(/strategy = ["']atomic["']/, 'strategy = "naive"'),
  );
  await page.getByRole("link", { name: "Sistemas", exact: true }).click();
  await page.getByRole("button", { name: "Reiniciar runtime" }).click();
  await expect(page.getByRole("status")).toContainText("Runtime reiniciado");
  await page.getByRole("link", { name: "Workbench", exact: true }).click();
  await page.screenshot({
    path: "../../.bunkerlab/browser-results/workbench-desktop.png",
    fullPage: true,
  });
  let baselineId = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    await page
      .getByRole("button", { name: "Executar experimento", exact: true })
      .click();
    await expect(page.getByRole("heading", { name: /Run #/ })).toBeVisible();
    await expect(page.locator(".page-heading .badge")).not.toHaveText(
      "Em execução",
    );
    baselineId = page.url().split("/").at(-1)!;
    if ((await page.locator(".page-heading .badge").textContent()) === "Falhou")
      break;
    await page.getByRole("link", { name: "Executar novamente" }).click();
  }
  await expect(page.locator(".page-heading .badge")).toHaveText("Falhou");
  await expect(
    page.getByText("Primeira violação observada", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Inspecionar request", exact: true })
    .click();
  await expect(page.getByText("stock.read", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "../../.bunkerlab/browser-results/inspector-desktop.png",
    fullPage: true,
  });
  await writeFile(
    inventory,
    (await readFile(inventory, "utf8")).replace(
      /strategy = ["']naive["']/,
      'strategy = "atomic"',
    ),
  );
  await page.getByRole("link", { name: "Sistemas", exact: true }).click();
  await page.getByRole("button", { name: "Reiniciar runtime" }).click();
  await expect(page.getByRole("status")).toContainText("Runtime reiniciado");
  await page.getByRole("link", { name: "Checkpoints", exact: true }).click();
  await page
    .getByLabel("O que mudou nesta versão?")
    .fill("Atomic inventory — browser validation");
  await page.getByRole("button", { name: "Salvar checkpoint" }).click();
  await expect(page.getByRole("status")).toContainText("Checkpoint salvo");
  await page.getByRole("link", { name: "Workbench", exact: true }).click();
  await page
    .getByRole("button", { name: "Executar experimento", exact: true })
    .click();
  await expect(page.locator(".page-heading .badge")).toHaveText("Passou");
  const fixedId = page.url().split("/").at(-1)!;
  await expect(page.locator(".run-metrics")).toContainText("15");
  await page.getByRole("link", { name: "Runs", exact: true }).click();
  const rows = page.locator("tbody tr");
  for (const id of [baselineId, fixedId])
    await rows
      .filter({ has: page.locator(`a[href="/runs/${id}"]`) })
      .getByRole("checkbox")
      .check();
  await page.getByRole("link", { name: "Comparar selecionadas" }).click();
  await expect(
    page.getByRole("heading", { name: "Comparar Runs" }),
  ).toBeVisible();
  await expect(page.locator(".compare-table")).toContainText("Falhou");
  await expect(page.locator(".compare-table")).toContainText("Passou");
  await page.screenshot({
    path: "../../.bunkerlab/browser-results/compare-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Sistemas", exact: true }).click();
  await page.getByRole("button", { name: "Resetar estado" }).click();
  await expect(page.getByRole("status")).toContainText("Estado resetado");
  await expect(page.locator(".state-numbers")).toHaveText("5unidades0pedidos");
  await page.getByRole("link", { name: "Checkpoints", exact: true }).click();
  const baseline = page
    .locator(".checkpoint-item")
    .filter({
      has: page.getByRole("heading", {
        name: "Base do OrderDesk",
        exact: true,
      }),
    });
  await baseline
    .getByRole("button", { name: "Restaurar", exact: true })
    .click();
  await baseline
    .getByRole("button", { name: "Restaurar com cópia de segurança" })
    .click();
  await expect(page.getByRole("status")).toContainText("Código restaurado");
  await expect
    .poll(async () => readFile(inventory, "utf8"))
    .toMatch(/strategy = ["']naive["']/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "Workbench", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Executar experimento", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../../.bunkerlab/browser-results/workbench-mobile.png",
    fullPage: true,
  });
  const history = await page.request.get(`${apiPath}/runs`);
  expect(history.ok()).toBe(true);
  expect(errors).toEqual([]);
});
