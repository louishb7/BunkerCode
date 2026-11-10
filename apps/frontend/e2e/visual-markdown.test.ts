import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { openVisual, markdownManager } from "../src/studio/visual-markdown";
import { parseQuiz, validateEditorial } from "@bunkercode/content";
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
