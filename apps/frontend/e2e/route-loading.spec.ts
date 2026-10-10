import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

interface Asset {
  file: string;
  imports?: string[];
  css?: string[];
}
const manifest = JSON.parse(
  await readFile(resolve("dist/.vite/manifest.json"), "utf8"),
) as Record<string, Asset>;
const studio = manifest["src/courses/Studio.tsx"]!;
const reader = manifest["src/courses/LessonPage.tsx"]!;
const markdown = Object.values(manifest).find((asset) =>
  /\/Markdown-.*\.js$/.test(asset.file),
)!;
const lesson = "/courses/typescript/lessons/values-and-types";

test("catalog defers reader, Markdown and Studio chunks; pending routes remain accessible and drafts survive", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) =>
    requests.push(new URL(request.url()).pathname),
  );
  await page.goto("/courses");
  await expect(page.getByRole("link", { name: /^TypeScript/ })).toBeVisible();
  for (const asset of [studio, reader, markdown])
    expect(requests).not.toContain("/" + asset.file);
  await page.getByRole("link", { name: /^TypeScript/ }).click();
  await page
    .getByRole("link", { name: "01 Valores e tipos", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Valores e tipos", exact: true }),
  ).toBeFocused();
  expect(requests).toContain("/" + reader.file);
  expect(requests).toContain("/" + markdown.file);
  expect(requests).not.toContain("/" + studio.file);
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/" + studio.file, async (route) => {
    await ready;
    await route.continue();
  });
  try {
    await page.getByRole("link", { name: "Editar lição", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Carregando conteúdo…");
    await expect(
      page.getByRole("navigation", { name: "Navegação principal" }),
    ).toBeVisible();
    release();
    await page
      .getByRole("button", { name: "Editar fonte Markdown", exact: true })
      .click();
    const input = page.getByRole("textbox", {
      name: "Markdown completo",
      exact: true,
    });
    await expect(input).toBeVisible();
    const draft =
      (await input.inputValue()) + "\nRascunho continua entre chunks.\n";
    await input.fill(draft);
    for (const css of studio.css ?? []) expect(requests).toContain("/" + css);
    await page
      .getByRole("link", { name: "Voltar à lição", exact: true })
      .click();
    await page.getByRole("link", { name: "Editar lição", exact: true }).click();
    await page
      .getByRole("button", { name: "Editar fonte Markdown", exact: true })
      .click();
    await expect(input).toHaveValue(draft);
    await expect(page.getByText(/Rascunho recuperado nesta aba/)).toBeVisible();
  } finally {
    release();
  }
});

test("failed route chunk exposes recovery and reload preserves the existing draft", async ({
  page,
}) => {
  await page.goto(lesson + "/edit");
  await page
    .getByRole("button", { name: "Editar fonte Markdown", exact: true })
    .click();
  const input = page.getByRole("textbox", {
    name: "Markdown completo",
    exact: true,
  });
  await expect(input).toBeVisible();
  const draft =
    (await input.inputValue()) + "\nRascunho antes da falha do chunk.\n";
  await input.fill(draft);
  await page.goto("/courses");
  await page.route("**/" + studio.file, (route) =>
    route.fulfill({
      status: 503,
      body: "Temporarily unavailable",
      contentType: "text/javascript",
    }),
  );
  await page.getByRole("link", { name: /^TypeScript/ }).click();
  await page
    .getByRole("link", { name: "01 Valores e tipos", exact: true })
    .click();
  await page.getByRole("link", { name: "Editar lição", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível carregar esta página",
  );
  await page.unroute("**/" + studio.file);
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await page
    .getByRole("button", { name: "Editar fonte Markdown", exact: true })
    .click();
  await expect(input).toHaveValue(draft);
  await expect(page.getByText(/Rascunho recuperado nesta aba/)).toBeVisible();
});
