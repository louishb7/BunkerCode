import { studioView } from "./studio-controls";
import { expect, test } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(
  process.env.BUNKERCODE_BROWSER_CONTENT_DIR!,
  "courses/studio-refinement",
);
const file = join(root, "lessons/continuity/lesson.md");
const url = "/courses/studio-refinement/lessons/continuity/edit";
const source =
  "# Continuidade\n\n" +
  Array.from(
    { length: 25 },
    (_, i) =>
      `Parágrafo ${i + 1}. ${"Escrever uma explicação longa em Markdown preserva o entendimento e as quebras do arquivo. ".repeat(12)}\n\n`,
  ).join("") +
  '~~~typescript\nfunction explain() {\n  const label = "' +
  "texto".repeat(80) +
  '";\n  return label;\n}\n~~~\n';
test.beforeAll(async () => {
  await mkdir(join(root, "lessons/continuity"), { recursive: true });
  await writeFile(
    join(root, "course.json"),
    JSON.stringify({
      id: "studio-refinement",
      title: "Studio de teste",
      description: "Fixture de continuidade.",
      lessons: [{ slug: "continuity", title: "Continuidade" }],
    }),
  );
});

for (const width of [390, 1280])
  for (const ending of ["LF", "CRLF"])
    test(`soft wrap and edit/preview continuity preserve ${ending} at ${width}px`, async ({
      page,
    }, info) => {
      const encode = (text: string) =>
        ending === "CRLF" ? text.replaceAll("\n", "\r\n") : text;
      await writeFile(file, encode(source));
      await page.setViewportSize({ width, height: 900 });
      await page.goto(url);
      await studioView(page, "Editar fonte Markdown");
      const input = page.locator("#lesson-markdown");
      await expect(input).toHaveValue(source);
      await expect(input).toHaveAttribute("wrap", "soft");
      expect(
        await input.evaluate(
          (node: HTMLTextAreaElement) =>
            node.scrollWidth <= node.clientWidth + 1,
        ),
      ).toBe(true);
      const draft = source + "\nRascunho que ainda não está no disco.\n";
      await input.fill(draft);
      const start = draft.indexOf("Parágrafo 12");
      await input.evaluate((node: HTMLTextAreaElement, start) => {
        node.setSelectionRange(start, start + 12, "backward");
        node.scrollTop = node.scrollHeight / 2;
      }, start);
      await page.evaluate(() => window.scrollTo(0, 280));
      const editingScroll = await page.evaluate(() => window.scrollY);
      const snapshot = await input.evaluate((node: HTMLTextAreaElement) => ({
        start: node.selectionStart,
        end: node.selectionEnd,
        direction: node.selectionDirection,
        top: node.scrollTop,
      }));
      await expect(
        page.getByRole("button", { name: "Salvar alterações" }),
      ).toBeInViewport();
      await page.screenshot({
        path: info.outputPath(`editor-wrap-${ending}-${width}.png`),
      });
      await studioView(page, "Prévia");
      await expect(input).not.toBeVisible();
      await expect(page.locator(".studio-options > summary")).toBeFocused();
      await expect(page.locator(".studio-preview pre code")).toContainText(
        "function explain()",
      );
      expect(await readFile(file, "utf8")).toBe(encode(source));
      await page.evaluate(() => window.scrollTo(0, 1200));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1200);
      await expect(
        page.getByRole("button", { name: "Salvar alterações" }),
      ).toBeInViewport();
      await page.screenshot({
        path: info.outputPath(`preview-sticky-${ending}-${width}.png`),
      });
      await studioView(page, "Editar fonte Markdown");
      await expect(input).toBeVisible();
      await expect(page.locator(".studio-options > summary")).toBeFocused();
      expect(
        await input.evaluate((node: HTMLTextAreaElement) => ({
          start: node.selectionStart,
          end: node.selectionEnd,
          direction: node.selectionDirection,
          top: node.scrollTop,
        })),
      ).toEqual(snapshot);
      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBe(editingScroll);
      await studioView(page, "Prévia");
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1200);
      await studioView(page, "Editar fonte Markdown");
      await input.focus();
      await page.keyboard.type("Revisão 12. ");
      const expected =
        draft.slice(0, snapshot.start) +
        "Revisão 12. " +
        draft.slice(snapshot.end);
      await expect(input).toHaveValue(expected);
      expect(
        await input.evaluate(
          (node: HTMLTextAreaElement) => node.selectionStart,
        ),
      ).toBe(snapshot.start + "Revisão 12. ".length);
      await page.getByRole("button", { name: "Salvar alterações" }).click();
      await expect(page.getByRole("status")).toHaveText("Salvo no arquivo.");
      expect(await readFile(file, "utf8")).toBe(encode(expected));
      expect(await readFile(file, "utf8")).toContain(
        encode(
          '~~~typescript\nfunction explain() {\n  const label = "' +
            "texto".repeat(80) +
            '";\n  return label;\n}\n~~~',
        ),
      );
    });

test("short viewport leaves Studio controls in document flow", async ({
  page,
}, info) => {
  await writeFile(file, source);
  await page.setViewportSize({ width: 390, height: 420 });
  await page.goto(url);
  await studioView(page, "Editar fonte Markdown");
  await expect(page.locator("#lesson-markdown")).toHaveValue(source);
  expect(
    await page
      .locator(".studio-controls")
      .evaluate((node) => getComputedStyle(node).position),
  ).toBe("static");
  await page.locator("#lesson-markdown").focus();
  await expect(page.locator("#lesson-markdown")).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: info.outputPath("studio-short-viewport.png") });
});
