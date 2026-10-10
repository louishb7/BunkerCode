import { studioView } from "./studio-controls";
import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const file = join(
  process.env.BUNKERCODE_BROWSER_CONTENT_DIR!,
  "courses/typescript/lessons/values-and-types/lesson.md",
);
const reader = "/courses/typescript/lessons/values-and-types";
const editor = reader + "/edit";
const putPath =
  "**/api/content/courses/typescript/lessons/values-and-types/markdown";
let original: string;
test.beforeEach(async () => {
  original = await readFile(file, "utf8");
});
test.afterEach(async () => {
  await writeFile(file, original);
});

test("Studio previews inert Markdown, waits for real disk confirmation and works on desktop/mobile", async ({
  page,
}, info) => {
  const executions: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/learning")) executions.push(request.url());
  });
  await page.goto(reader);
  await page.getByRole("link", { name: "Editar lição" }).click();
  await studioView(page, "Editar fonte Markdown");
  const input = page.getByRole("textbox", {
    name: "Markdown completo",
    exact: true,
  });
  await expect(input).toHaveValue(original);
  await expect(page.getByRole("status")).toHaveText("Sem alterações.");
  await expect(
    page.getByRole("button", { name: "Salvar alterações" }),
  ).toBeDisabled();
  const markdown =
    '# Valores e tipos\n\n## Minha revisão no Studio\n\nExplicação autoral com ação e acentos.\n\n~~~typescript\nconst count: number = 3;\n~~~\n\n<script>window.__studioExecuted=true</script>\n<img src=x onerror="window.__studioExecuted=true">\n\n[Link inseguro](javascript:alert(1))\n\n[Data URL](data:text/html,attack)\n';
  await input.fill(markdown);
  await expect(page.getByRole("status")).toHaveText("Alterações não salvas.");
  await studioView(page, "Prévia");
  await expect(
    page.getByRole("heading", { name: "Minha revisão no Studio" }),
  ).toBeVisible();
  await expect(
    page.locator(".studio-preview pre .hljs-keyword").first(),
  ).toBeVisible();
  await expect(
    page.locator(
      ".studio-preview script, .studio-preview img, .studio-preview iframe",
    ),
  ).toHaveCount(0);
  await expect(
    page.locator(".studio-preview").getByText("Link inseguro", { exact: true }),
  ).not.toHaveAttribute("href", /^javascript:/i);
  await expect(
    page.locator(".studio-preview").getByText("Data URL", { exact: true }),
  ).not.toHaveAttribute("href", /^data:/i);
  expect(await page.evaluate(() => "__studioExecuted" in window)).toBe(false);
  expect(await readFile(file, "utf8")).toBe(original);
  await page.screenshot({
    path: info.outputPath("studio-preview-desktop.png"),
    fullPage: true,
  });
  await studioView(page, "Editar fonte Markdown");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(input).toHaveValue(markdown);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("studio-editor-mobile.png"),
    fullPage: true,
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(putPath, async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByRole("status")).toHaveText("Salvando…");
    await expect(input).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Salvando…" }),
    ).toBeDisabled();
    expect(await readFile(file, "utf8")).toBe(original);
    release();
    await expect(page.getByRole("status")).toHaveText("Salvo no arquivo.");
    expect(await readFile(file, "utf8")).toBe(markdown);
  } finally {
    release();
  }
  await page.getByRole("link", { name: "Voltar à lição" }).click();
  await expect(
    page.getByRole("heading", { name: "Minha revisão no Studio" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Minha revisão no Studio" }),
  ).toBeVisible();
  expect(executions).toEqual([]);
});

test("two tabs keep the losing draft and require reviewing the current version before overwriting", async ({
  page,
  context,
}) => {
  const second = await context.newPage();
  await Promise.all([page.goto(editor), second.goto(editor)]);
  await studioView(page, "Editar fonte Markdown");
  await studioView(second, "Editar fonte Markdown");
  const firstInput = page.getByRole("textbox", {
    name: "Markdown completo",
    exact: true,
  });
  const secondInput = second.getByRole("textbox", {
    name: "Markdown completo",
    exact: true,
  });
  await expect(firstInput).toHaveValue(original);
  await expect(secondInput).toHaveValue(original);
  const firstText = original + "\n\nPrimeira aba salvou.\n";
  const secondText = original + "\n\nSegunda aba mantém seu texto.\n";
  await firstInput.fill(firstText);
  await secondInput.fill(secondText);
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("status")).toHaveText("Salvo no arquivo.");
  await second.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(
    second.getByRole("heading", { name: "Conflito de edição" }),
  ).toBeVisible();
  await expect(secondInput).toHaveValue(secondText);
  expect(await readFile(file, "utf8")).toBe(firstText);
  await expect(
    second.getByRole("button", { name: "Salvar alterações" }),
  ).toBeDisabled();
  await second.getByRole("button", { name: "Revisar arquivo atual" }).click();
  await expect(
    second.getByRole("textbox", { name: "Markdown atual no arquivo" }),
  ).toHaveValue(firstText);
  await second
    .getByRole("button", {
      name: "Manter meu texto e usar esta versão como base",
    })
    .click();
  await expect(secondInput).toHaveValue(secondText);
  await second.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(second.getByRole("status")).toHaveText("Salvo no arquivo.");
  expect(await readFile(file, "utf8")).toBe(secondText);
  await second.close();
});

test("network failures preserve drafts across navigation and a lost success response stays unconfirmed", async ({
  page,
}) => {
  await page.goto(editor);
  await studioView(page, "Editar fonte Markdown");
  const input = page.getByRole("textbox", {
    name: "Markdown completo",
    exact: true,
  });
  const draft = original + "\n\nRascunho preservado mesmo sem resposta.\n";
  await input.fill(draft);
  await page.route(putPath, (route) => route.abort("failed"));
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Seu texto foi preservado",
  );
  await expect(input).toHaveValue(draft);
  await expect(page.getByRole("status")).toHaveText("Alterações não salvas.");
  expect(await readFile(file, "utf8")).toBe(original);
  await page.getByRole("link", { name: "Voltar à lição" }).click();
  await page.getByRole("link", { name: "Editar lição" }).click();
  await studioView(page, "Editar fonte Markdown");
  await expect(input).toHaveValue(draft);
  await expect(page.getByText(/Rascunho recuperado nesta aba/)).toBeVisible();
  await page.unroute(putPath);
  await page.route(putPath, async (route) => {
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    await route.abort("failed");
  });
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Alterações não salvas.");
  await expect(input).toHaveValue(draft);
  expect(await readFile(file, "utf8")).toBe(draft);
  await page.getByRole("link", { name: "Voltar à lição" }).click();
  await page.getByRole("link", { name: "Editar lição" }).click();
  await studioView(page, "Editar fonte Markdown");
  await expect(input).toHaveValue(draft);
  await expect(
    page.getByRole("heading", { name: "Conflito de edição" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Revisar arquivo atual" }).click();
  await expect(
    page.getByRole("textbox", { name: "Markdown atual no arquivo" }),
  ).toHaveValue(draft);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Carregar arquivo no editor" })
    .click();
  await expect(page.getByRole("status")).toHaveText("Sem alterações.");
  await expect(
    page.getByRole("button", { name: "Salvar alterações" }),
  ).toBeDisabled();
});

test("unavailable content and write errors are explicit while preview remains usable", async ({
  page,
}) => {
  await page.goto("/courses/typescript/lessons/unknown/edit");
  await expect(page.getByRole("alert")).toContainText("Lição não encontrada");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const getPath = "**/api/content/courses/typescript/lessons/values-and-types";
  await page.route(getPath, async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto(editor);
    await expect(page.getByText("Carregando conteúdo…")).toBeVisible();
    release();
    await studioView(page, "Editar fonte Markdown");
    await expect(
      page.getByRole("textbox", { name: "Markdown completo", exact: true }),
    ).toHaveValue(original);
  } finally {
    release();
  }
  const draft =
    "# Valores e tipos\n\n## Texto sem confirmação\n\nMeu texto continua aqui.\n";
  await page
    .getByRole("textbox", { name: "Markdown completo", exact: true })
    .fill(draft);
  await page.route(putPath, (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "Falha de escrita no disco." }),
    }),
  );
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Falha de escrita no disco",
  );
  await expect(page.getByRole("status")).toHaveText("Alterações não salvas.");
  await expect(
    page.getByRole("textbox", { name: "Markdown completo", exact: true }),
  ).toHaveValue(draft);
  expect(await readFile(file, "utf8")).toBe(original);
  await studioView(page, "Prévia");
  await expect(
    page.getByRole("heading", { name: "Texto sem confirmação" }),
  ).toBeVisible();
});

test("leaving during a save cannot clear a newer tab draft, and CRLF survives browser editing", async ({
  page,
}) => {
  const crlf = original.replace(/\r?\n/g, "\r\n");
  await writeFile(file, crlf);
  await page.goto(editor);
  await studioView(page, "Editar fonte Markdown");
  const input = page.getByRole("textbox", {
    name: "Markdown completo",
    exact: true,
  });
  await expect(input).toHaveValue(crlf.replaceAll("\r\n", "\n"));
  const pending =
    original.replaceAll("\r\n", "\n") +
    "\n\nTexto enviado pela primeira montagem.\n";
  const newer =
    original.replaceAll("\r\n", "\n") + "\n\nRascunho novo depois de voltar.\n";
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(putPath, async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await input.fill(pending);
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByRole("status")).toHaveText("Salvando…");
    await page.getByRole("link", { name: "Voltar à lição" }).click();
    await page.getByRole("link", { name: "Editar lição" }).click();
    await studioView(page, "Editar fonte Markdown");
    await expect(input).toHaveValue(pending);
    await input.fill(newer);
    const confirmation = page.waitForResponse(
      (response) =>
        response.url().endsWith("/markdown") &&
        response.request().method() === "PUT",
    );
    release();
    expect((await confirmation).status()).toBe(200);
    expect(await readFile(file, "utf8")).toBe(pending.replaceAll("\n", "\r\n"));
    await expect(input).toHaveValue(newer);
    await expect(page.getByRole("status")).toHaveText("Alterações não salvas.");
    await page.getByRole("link", { name: "Voltar à lição" }).click();
    await page.getByRole("link", { name: "Editar lição" }).click();
    await studioView(page, "Editar fonte Markdown");
    await expect(input).toHaveValue(newer);
    await expect(
      page.getByRole("heading", { name: "Conflito de edição" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Revisar arquivo atual" }).click();
    await expect(
      page.getByRole("textbox", { name: "Markdown atual no arquivo" }),
    ).toHaveValue(pending);
    await page
      .getByRole("button", {
        name: "Manter meu texto e usar esta versão como base",
      })
      .click();
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByRole("status")).toHaveText("Salvo no arquivo.");
    expect(await readFile(file, "utf8")).toBe(newer.replaceAll("\n", "\r\n"));
  } finally {
    release();
  }
});
