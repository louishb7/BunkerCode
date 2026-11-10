import {
  wrapNoteText,
  listNoteText,
  linkNoteText,
} from "../src/studio/note-formatting";
import { safeAuthoringLink } from "../src/studio/authoring-links";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { openVisual, markdownManager } from "../src/studio/visual-markdown";
import { parseQuiz, validateEditorial, ottoComment } from "@bunkercode/content";
const quiz = {
  id: "example-question",
  question: "Qual valor?",
  options: [
    { id: "a", text: "Um", feedback: "Correto" },
    { id: "b", text: "Dois", feedback: "Revise" },
  ],
  correct: "a",
};
const special = "```bunker-quiz\n" + JSON.stringify(quiz, null, 2) + "\n```";
for (const [name, source] of Object.entries({
  empty: "",
  headings: "# Título\n\nTexto **forte** e *ênfase*.\n\n## Parte",
  lists: "- Primeiro\n- Segundo\n\n1. Um\n2. Dois",
  links: '[Referência](https://example.com "Título")',
  quote: "> Observação\n>\n> Outro parágrafo",
  code: '```typescript\nconst code = "<script> & ` !";\n  console.log(code);\n```',
  crlf: "# Título\r\n\r\nTexto\r\n",
  quiz: "Antes\n\n" + special + "\n\nDepois",
  note: '```bunker-note\n{"kind":"tip","text":"Uma dica"}\n```',
})) {
  test(`visual conversion preserves ${name}`, () => {
    const result = openVisual(source);
    assert.ok(result.document, result.error);
    assert.ok(openVisual(markdownManager.serialize(result.document)).document);
  });
}
test("unsupported HTML, images and tables are source-only", () => {
  for (const source of [
    "<script>alert(1)</script>",
    "![alt](https://example.com/image.png)",
    "| a | b |\n|---|---|\n| 1 | 2 |",
  ])
    assert.ok(openVisual(source).error);
});
test("malformed and duplicate quizzes cannot be saved", () => {
  assert.throws(() => validateEditorial(special + "\n\n" + special));
  assert.throws(() => validateEditorial("```bunker-quiz\n{}\n```"));
  assert.throws(() =>
    validateEditorial(
      special.replace('"correct": "a"', '"correct": "missing"'),
    ),
  );
});
test("every existing lesson converts safely or explicitly falls back", () => {
  const root = resolve("../../content/courses");
  const files = readdirSync(root, { recursive: true })
    .map(String)
    .filter((p) => p.endsWith("/lesson.md"));
  assert.ok(files.length);
  for (const file of files) {
    const original = readFileSync(resolve(root, file), "utf8");
    const result = openVisual(original);
    assert.ok(result.document || result.error);
    if (result.document)
      assert.ok(
        openVisual(markdownManager.serialize(result.document)).document,
        file,
      );
  }
});

test("option feedback is validated and preserved through visual Markdown round trips", () => {
  const modern = {
    ...quiz,
    options: quiz.options.map((option) => ({
      ...option,
      feedback: `Feedback **${option.id}**.`,
    })),
  };
  assert.deepEqual(parseQuiz(modern), modern);
  assert.deepEqual(parseQuiz(quiz), quiz);
  const source = "```bunker-quiz\n" + JSON.stringify(modern) + "\n```";
  const result = openVisual(source);
  assert.ok(result.document, result.error);
  const restored = markdownManager.serialize(result.document);
  assert.deepEqual(openVisual(restored).document, result.document);
  for (const feedback of [null, 42, "", " ", "x".repeat(4001), "a\u0000b"]) {
    assert.throws(() =>
      parseQuiz({
        ...quiz,
        options: [{ ...quiz.options[0], feedback }, quiz.options[1]],
      }),
    );
  }
  assert.throws(() =>
    parseQuiz({
      ...quiz,
      options: [
        { ...quiz.options[0], feedback: "Ok", extra: true },
        quiz.options[1],
      ],
    }),
  );
});

test("quizzes reject removed settings and missing option feedback", () => {
  for (const setting of [
    { retry: true },
    { retry: false },
    { feedbackCorrect: "Old" },
    { feedbackIncorrect: "Old" },
  ])
    assert.throws(() => parseQuiz({ ...quiz, ...setting }));
  assert.throws(() =>
    parseQuiz({ ...quiz, options: [{ id: "a", text: "Um" }, quiz.options[1]] }),
  );
});

test("every tracked lesson quiz uses the canonical format", () => {
  for (const root of [
    resolve("../../content/courses"),
    resolve("../frontend/e2e/fixtures/legacy-courses"),
  ]) {
    for (const file of readdirSync(root, { recursive: true })
      .map(String)
      .filter((p) => p.endsWith("/lesson.md")))
      validateEditorial(readFileSync(resolve(root, file), "utf8"));
  }
});

test("visual line breaks preserve paragraphs, consecutive breaks and legacy space syntax", () => {
  for (const source of [
    "Primeira  \nSegunda  \nTerceira\n\nOutro parágrafo.",
    "Primeira\\\n\\\nTerceira\n\nOutro parágrafo.",
  ]) {
    const opened = openVisual(source);
    assert.ok(opened.document, opened.error);
    const paragraphs = opened.document.content!;
    assert.equal(paragraphs.length, 2);
    assert.equal(
      paragraphs[0]!.content!.filter((node) => node.type === "hardBreak")
        .length,
      2,
    );
    const serialized = markdownManager.serialize(opened.document);
    assert.match(serialized, /\\\n/);
    assert.deepEqual(openVisual(serialized).document, opened.document);
    assert.ok(serialized.includes("\n\nOutro parágrafo."));
  }
});

test("Otto signatures expose only the comment and keep ordinary notes intact", () => {
  assert.equal(ottoComment("**Otto**\n\nJá pensou nisso?"), "Já pensou nisso?");
  assert.equal(ottoComment("**Otto**\r\n\r\nÉ isso."), "É isso.");
  assert.equal(ottoComment("Otto apareceu no texto."), null);
  assert.equal(ottoComment("Antes\n\n**Otto**\n\nDepois"), null);
});

test("note formatting preserves selected text and validates authoring links", () => {
  const source = "É uma ideia.";
  const selection = { start: 6, end: 11 };
  const bold = wrapNoteText(source, selection, "**", "texto");
  assert.equal(bold.text, "É uma **ideia**.");
  assert.equal(bold.text.slice(bold.start, bold.end), "ideia");
  assert.equal(wrapNoteText(bold.text, bold, "**", "texto").text, source);
  assert.equal(
    wrapNoteText("", { start: 0, end: 0 }, "*", "texto").text,
    "*texto*",
  );
  const list = listNoteText("Um\nDois", { start: 0, end: 7 });
  assert.equal(list.text, "- Um\n- Dois");
  assert.equal(listNoteText(list.text, list).text, "Um\nDois");
  assert.equal(
    linkNoteText(source, selection, "https://example.com/a(b)").text,
    "É uma [ideia](https://example.com/a%28b%29).",
  );
  for (const value of [
    "https://example.com",
    "mailto:autor@example.test",
    "/courses/example",
    "#parte",
  ])
    assert.ok(safeAuthoringLink(value));
  for (const value of [
    "javascript:alert(1)",
    "//evil.test",
    "https://example.com\n",
    "https:\\evil.test",
    "data:text/html,x",
  ])
    assert.equal(safeAuthoringLink(value), false);
});
