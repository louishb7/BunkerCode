import { expect, test } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const content = process.env.BUNKERCODE_BROWSER_CONTENT_DIR!;
const courseRoot = join(content, "courses/typescript");
let originalExample: string;
test.beforeAll(async () => {
  const file = join(courseRoot, "lessons/values-and-types/lesson.md");
  originalExample = await readFile(file, "utf8");
  await writeFile(
    file,
    "# Valores e tipos\n\n~~~typescript\nconst remainingStock: number = 3;\n~~~\n\n[TypeScript Handbook: Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html)\n",
  );
});
test.afterAll(async () => {
  await writeFile(
    join(courseRoot, "lessons/values-and-types/lesson.md"),
    originalExample,
  );
});

test("authored courses render Markdown, highlight code, navigate in manifest order and refresh without rebuild", async ({
  page,
}, testInfo) => {
  const executionRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/learning"))
      executionRequests.push(request.url());
  });
  await page.goto("/courses");
  await page.getByRole("link", { name: /^TypeScript/ }).click();
  await expect(
    page.getByRole("heading", { name: "TypeScript", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".lesson-list a")).toHaveText([
    "01Valores e tiposComeçar →",
    "02Union typesLer →",
  ]);
  await page.getByRole("link", { name: "01 Valores e tipos" }).click();
  await expect(
    page.getByRole("heading", { name: "Valores e tipos", exact: true }),
  ).toBeVisible();
  await expect(page.locator("pre code.language-typescript")).toContainText(
    "remainingStock",
  );
  await expect(page.locator("pre .hljs-keyword").first()).toBeVisible();
  await expect(
    page.getByRole("link", { name: "TypeScript Handbook: Everyday Types" }),
  ).toHaveAttribute("href", /^https:\/\/www.typescriptlang.org/);
  await page
    .getByRole("link", { name: "Próxima → Union types", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Union types", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "← Anterior Valores e tipos", exact: true })
    .click();
  const file = join(courseRoot, "lessons/values-and-types/lesson.md");
  const before = await readFile(file, "utf8");
  try {
    await writeFile(
      file,
      before +
        "\n\n## Revisão salva no disco\n\nNova explicação disponível sem rebuild.\n",
    );
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Revisão salva no disco" }),
    ).toBeVisible();
  } finally {
    await writeFile(file, before);
  }
  execFileSync(
    process.execPath,
    [
      resolve("../../scripts/new-lesson.mjs"),
      "--course",
      "typescript",
      "--slug",
      "browser-authored",
      "--title",
      "Nota criada pelo fluxo de autoria",
    ],
    { env: { ...process.env, BUNKERCODE_CONTENT_DIR: content } },
  );
  await page
    .getByRole("link", { name: "← Voltar ao curso", exact: true })
    .click();
  await page
    .getByRole("link", { name: "03 Nota criada pelo fluxo de autoria" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Nota criada pelo fluxo de autoria",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "← Anterior Union types", exact: true }),
  ).toBeVisible();
  const newCourse = join(content, "courses/architecture");
  await mkdir(join(newCourse, "lessons/first-note"), { recursive: true });
  await writeFile(
    join(newCourse, "course.json"),
    JSON.stringify({
      id: "architecture",
      title: "Arquitetura",
      description: "Segundo curso de teste",
      lessons: [{ slug: "first-note", title: "Primeira nota" }],
    }),
  );
  await writeFile(
    join(newCourse, "lessons/first-note/lesson.md"),
    "# Primeira nota\n\nCurso novo sem alteração em React ou Nest.",
  );
  await page.goto("/courses");
  await page.getByRole("link", { name: /^Arquitetura/ }).click();
  await page.getByRole("link", { name: "01 Primeira nota" }).click();
  await expect(
    page.getByText("Curso novo sem alteração em React ou Nest."),
  ).toBeVisible();
  expect(executionRequests).toEqual([]);
  await page.goto("/courses/typescript/lessons/union-types");
  await page.screenshot({
    path: testInfo.outputPath("lesson-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Union types", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "← Anterior Valores e tipos", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("lesson-mobile.png"),
    fullPage: true,
  });
});

test("Markdown stays inert and missing/invalid/empty content has readable states", async ({
  page,
}) => {
  const file = join(courseRoot, "lessons/values-and-types/lesson.md");
  const before = await readFile(file, "utf8");
  try {
    await writeFile(
      file,
      '# Valores e tipos\n\n<script>window.__lessonExecuted=true</script>\n<img src=x onerror="window.__lessonExecuted=true">\n\n[Link inseguro](javascript:alert(1))\n\n[Data URL](data:text/html,attack)\n\n~~~javascript\nwindow.__lessonExecuted = true;\n' +
        "a".repeat(400) +
        "\n~~~\n",
    );
    await page.goto("/courses/typescript/lessons/values-and-types");
    await expect(page.locator("pre code")).toContainText(
      "window.__lessonExecuted",
    );
    await expect(
      page.locator(".prose script, .prose img, .prose iframe"),
    ).toHaveCount(0);
    await expect(page.getByText("Link inseguro")).not.toHaveAttribute(
      "href",
      /^javascript:/i,
    );
    await expect(page.getByText("Data URL")).not.toHaveAttribute(
      "href",
      /^data:/i,
    );
    expect(await page.evaluate(() => "__lessonExecuted" in window)).toBe(false);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await writeFile(file, "");
    await page.reload();
    await expect(page.getByText(/Esta lição ainda está vazia/)).toBeVisible();
  } finally {
    await writeFile(file, before);
  }
  await page.goto("/courses/unknown");
  await expect(page.getByRole("alert")).toContainText("Curso não encontrado");
  await page.goto("/courses/typescript/lessons/unknown");
  await expect(page.getByRole("alert")).toContainText("Lição não encontrada");
  const manifest = join(courseRoot, "course.json"),
    saved = await readFile(manifest, "utf8");
  try {
    await writeFile(manifest, "{ broken");
    await page.goto("/courses/typescript");
    await expect(page.getByRole("alert")).toContainText("JSON válido");
  } finally {
    await writeFile(manifest, saved);
  }
});

test("navigation exposes Home and Courses while retired execution routes remain absent", async ({
  page,
}) => {
  await page.goto("/courses/typescript/lessons/union-types");
  await expect(
    page.getByRole("heading", { name: "Union types", exact: true }),
  ).toBeVisible();
  await expect(page.locator('a[href^="/learn"]')).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation", { name: "Navegação principal" })
      .getByRole("link"),
  ).toHaveText(["Início", "Cursos"]);
  await expect(page.locator(".optional-practice")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Prática opcional", exact: true }),
  ).toHaveCount(0);
  for (const route of ["/learn", "/learn/reserve-stock"]) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: "Página não encontrada" }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Voltar aos cursos", exact: true })
      .click();
    await expect(page).toHaveURL(/\/courses$/);
    await expect(
      page.getByRole("heading", { name: "Cursos", exact: true }),
    ).toBeVisible();
  }
});
