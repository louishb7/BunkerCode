export interface Quiz {
  id: string;
  question: string;
  options: { id: string; text: string }[];
  correct: string;
  feedbackCorrect: string;
  feedbackIncorrect: string;
  retry: boolean;
}
export interface Note {
  kind: "info" | "tip" | "warning";
  text: string;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Bloco editorial inválido.");
  return value as Record<string, unknown>;
}
function fields(value: Record<string, unknown>, keys: string[]) {
  if (
    Object.keys(value).length !== keys.length ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    throw new Error("Campos editoriais desconhecidos ou ausentes.");
}
function text(value: unknown, max: number): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    [...value].some(
      (char) => char.charCodeAt(0) < 32 && !"\t\n\r".includes(char),
    )
  )
    throw new Error("Texto editorial vazio ou inválido.");
  return value;
}
function id(value: unknown): string {
  const result = text(value, 80);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result))
    throw new Error("Identificador editorial inválido.");
  return result;
}
export function parseQuiz(value: unknown): Quiz {
  const q = object(value);
  fields(q, [
    "id",
    "question",
    "options",
    "correct",
    "feedbackCorrect",
    "feedbackIncorrect",
    "retry",
  ]);
  if (
    !Array.isArray(q.options) ||
    q.options.length < 2 ||
    q.options.length > 12 ||
    typeof q.retry !== "boolean"
  )
    throw new Error(
      "Quiz requer de 2 a 12 alternativas e configuração de nova tentativa.",
    );
  const options = q.options.map((value) => {
    const o = object(value);
    fields(o, ["id", "text"]);
    return { id: id(o.id), text: text(o.text, 2000) };
  });
  const correct = id(q.correct);
  if (
    new Set(options.map((o) => o.id)).size !== options.length ||
    !options.some((o) => o.id === correct)
  )
    throw new Error("Alternativas duplicadas ou resposta correta ausente.");
  return {
    id: id(q.id),
    question: text(q.question, 4000),
    options,
    correct,
    feedbackCorrect: text(q.feedbackCorrect, 4000),
    feedbackIncorrect: text(q.feedbackIncorrect, 4000),
    retry: q.retry,
  };
}
export function parseNote(value: unknown): Note {
  const n = object(value);
  fields(n, ["kind", "text"]);
  if (n.kind !== "info" && n.kind !== "tip" && n.kind !== "warning")
    throw new Error("Tipo de nota inválido.");
  return { kind: n.kind, text: text(n.text, 12000) };
}
export interface ExercisePlacement {
  kind: "exercise";
}
export function parseEditorial(
  language: string,
  source: string,
): Quiz | Note | ExercisePlacement {
  if (source.length > 32768)
    throw new Error("Bloco editorial excede o limite.");
  const value: unknown = JSON.parse(source);
  if (language === "bunker-quiz") return parseQuiz(value);
  if (language === "bunker-note") return parseNote(value);
  if (language === "bunker-exercise") {
    fields(object(value), ["kind"]);
    if (object(value).kind !== "exercise")
      throw new Error("Marcador de exercício inválido.");
    return { kind: "exercise" };
  }
  throw new Error("Tipo editorial desconhecido.");
}
/** Special blocks are top-level fenced JSON; ordinary code fences remain inert. */
export function validateEditorial(source: string): boolean {
  let exercise = false;
  let fence:
    | { marker: string; size: number; language: string; body: string[] }
    | undefined;
  const ids = new Set<string>();
  for (const line of source.replaceAll("\r\n", "\n").split("\n")) {
    if (!fence) {
      const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (opening)
        fence = {
          marker: opening[1]![0]!,
          size: opening[1]!.length,
          language: opening[2]!.trim().split(/\s+/)[0]!,
          body: [],
        };
    } else if (
      new RegExp(`^ {0,3}${fence.marker}{${fence.size},}\\s*$`).test(line)
    ) {
      if (
        fence.language === "bunker-quiz" ||
        fence.language === "bunker-note" ||
        fence.language === "bunker-exercise"
      ) {
        const block = parseEditorial(fence.language, fence.body.join("\n"));
        if ("kind" in block && block.kind === "exercise") {
          if (exercise) throw new Error("Marcador de exercício duplicado.");
          exercise = true;
        }
        if ("id" in block) {
          if (ids.has(block.id))
            throw new Error("Identificador de quiz duplicado.");
          ids.add(block.id);
        }
      }
      fence = undefined;
    } else fence.body.push(line);
  }
  if (fence?.language.startsWith("bunker-"))
    throw new Error("Bloco editorial sem fechamento.");
  return exercise;
}

export interface OutputTest {
  kind: "stdout";
  expected: string;
}
export function parseOutputTest(value: unknown): OutputTest {
  const t = object(value);
  fields(t, ["kind", "expected"]);
  if (
    t.kind !== "stdout" ||
    typeof t.expected !== "string" ||
    t.expected.length > 16000
  )
    throw new Error(
      "Teste inválido: use stdout e expected de até 16000 caracteres.",
    );
  return { kind: "stdout", expected: t.expected };
}

export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export interface FunctionTests {
  kind: "function";
  version: 1;
  function: string;
  cases: { name: string; args: JsonValue[]; expected: JsonValue }[];
}
export type ExerciseTests = OutputTest | FunctionTests;
/** Public synchronous JSON cases, deliberately limited to one JS/TS function. */
export function parseExerciseTests(value: unknown): ExerciseTests {
  const suite = object(value);
  if (suite.kind === "stdout") return parseOutputTest(value);
  fields(suite, ["kind", "version", "function", "cases"]);
  if (
    suite.kind !== "function" ||
    suite.version !== 1 ||
    typeof suite.function !== "string" ||
    !/^[A-Za-z_$][\w$]{0,79}$/.test(suite.function) ||
    !Array.isArray(suite.cases) ||
    suite.cases.length < 1 ||
    suite.cases.length > 16
  )
    throw new Error(
      "Suíte inválida: use function, version 1 e de 1 a 16 casos públicos.",
    );
  let nodes = 0;
  function json(item: unknown, depth = 0): JsonValue {
    if (++nodes > 2000 || depth > 8)
      throw new Error("Casos de teste excedem os limites de tamanho.");
    if (item === null || typeof item === "boolean" || typeof item === "string")
      return item;
    if (typeof item === "number" && Number.isFinite(item)) return item;
    if (Array.isArray(item)) return item.map((value) => json(value, depth + 1));
    if (
      item &&
      typeof item === "object" &&
      Object.getPrototypeOf(item) === Object.prototype
    ) {
      const entries = Object.entries(item);
      if (
        entries.some(([key]) =>
          ["__proto__", "constructor", "prototype"].includes(key),
        )
      )
        throw new Error("Chave de teste inválida.");
      return Object.fromEntries(
        entries.map(([key, value]) => [key, json(value, depth + 1)]),
      );
    }
    throw new Error("Entradas e resultados precisam ser valores JSON finitos.");
  }
  const cases = suite.cases.map((value) => {
    const item = object(value);
    fields(item, ["name", "args", "expected"]);
    if (!Array.isArray(item.args) || item.args.length > 8)
      throw new Error("Caso requer até oito argumentos.");
    return {
      name: text(item.name, 200),
      args: item.args.map((value) => json(value)),
      expected: json(item.expected),
    };
  });
  if (
    new Set(cases.map((item) => item.name)).size !== cases.length ||
    JSON.stringify(cases).length > 16000
  )
    throw new Error("Casos duplicados ou muito extensos.");
  return { kind: "function", version: 1, function: suite.function, cases };
}
export interface TestReport {
  passed: number;
  total: number;
  cases: {
    name: string;
    passed: boolean;
    expected: string;
    actual?: string;
    error?: string;
  }[];
}
