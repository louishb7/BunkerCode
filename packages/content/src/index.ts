import { SQL_TASK_LIMIT } from "./sql";
export { SQL_TASK_LIMIT } from "./sql";
export {
  parseCourse,
  validSlug,
  isLessonTitle,
  parseNewLesson,
  suggestLessonSlug,
  type Course,
  type CourseModule,
  type LessonEntry,
  type CourseSummary,
} from "./course";
export interface Quiz {
  id: string;
  question: string;
  options: { id: string; text: string; feedback: string }[];
  correct: string;
}
export interface Note {
  kind: "info" | "tip" | "warning";
  text: string;
}
/** Existing Otto signature; the authoring UI edits only its comment body. */
export function ottoComment(text: string): string | null {
  const signature = /^\*\*Otto\*\*(?:\r?\n){2}/.exec(text);
  return signature ? text.slice(signature[0].length) : null;
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
  fields(q, ["id", "question", "options", "correct"]);
  if (
    !Array.isArray(q.options) ||
    q.options.length < 2 ||
    q.options.length > 12
  )
    throw new Error("Quiz requer de 2 a 12 alternativas.");
  const options = q.options.map((value) => {
    const o = object(value);
    fields(o, ["id", "text", "feedback"]);
    return {
      id: id(o.id),
      text: text(o.text, 2000),
      feedback: text(o.feedback, 4000),
    };
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
export interface SqlPlacement {
  kind: "sql";
  exerciseId: string;
  version: number;
}
export interface SqlTaskReference {
  taskId: string;
  exerciseId: string;
  version: number;
}
export interface SqlTaskSequence {
  kind: "sql-task-sequence";
  tasks: SqlTaskReference[];
}
export type SqlLessonPlacement = SqlPlacement | SqlTaskSequence;
export function parseSqlPlacement(value: unknown): SqlLessonPlacement {
  const block = object(value);
  if (block.kind === "sql-task-sequence") {
    fields(block, ["kind", "tasks"]);
    if (
      !Array.isArray(block.tasks) ||
      !block.tasks.length ||
      block.tasks.length > SQL_TASK_LIMIT
    )
      throw new Error(
        `Uma sequência SQL deve ter de 1 a ${SQL_TASK_LIMIT} tarefas.`,
      );
    const tasks = block.tasks.map((value): SqlTaskReference => {
      const task = object(value);
      fields(task, ["taskId", "exerciseId", "version"]);
      const reference = parseSqlPlacement({
        kind: "sql",
        exerciseId: task.exerciseId,
        version: task.version,
      });
      if (reference.kind !== "sql") throw new Error("Referência SQL inválida.");
      return {
        taskId: id(task.taskId),
        exerciseId: reference.exerciseId,
        version: reference.version,
      };
    });
    if (new Set(tasks.map((task) => task.taskId)).size !== tasks.length)
      throw new Error(
        "IDs de tarefa SQL duplicados. Escolha um ID estável para cada tarefa.",
      );
    if (
      new Set(
        tasks.map((task) => JSON.stringify([task.exerciseId, task.version])),
      ).size !== tasks.length
    )
      throw new Error("Exercício e versão repetidos na sequência SQL.");
    return { kind: "sql-task-sequence", tasks };
  }
  fields(block, ["kind", "exerciseId", "version"]);
  if (
    block.kind !== "sql" ||
    !Number.isSafeInteger(block.version) ||
    Number(block.version) < 1 ||
    Number(block.version) > 1000000
  )
    throw new Error(
      "Referência SQL inválida: use kind sql e versão inteira positiva.",
    );
  return {
    kind: "sql",
    exerciseId: id(block.exerciseId),
    version: Number(block.version),
  };
}
export function sqlExerciseReferences(placement: SqlLessonPlacement) {
  return placement.kind === "sql" ? [placement] : placement.tasks;
}
export function parseEditorial(
  language: string,
  source: string,
): Quiz | Note | ExercisePlacement | SqlLessonPlacement {
  if (source.length > 32768)
    throw new Error("Bloco editorial excede o limite.");
  const value: unknown = JSON.parse(source);
  if (language === "bunker-sql") return parseSqlPlacement(value);
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
function scanEditorial(source: string) {
  let exercise = false;
  let sql: SqlLessonPlacement | null = null;
  let sqlRange: { start: number; end: number } | null = null;
  let offset = 0;
  let fence:
    | {
        marker: string;
        size: number;
        language: string;
        body: string[];
        start: number;
      }
    | undefined;
  const ids = new Set<string>();
  for (const raw of source.split(/(?<=\n)/)) {
    const line = raw.replace(/\r?\n$/, "");
    const start = offset;
    offset += raw.length;
    if (!fence) {
      const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (opening)
        fence = {
          marker: opening[1]![0]!,
          size: opening[1]!.length,
          language: opening[2]!.trim().split(/\s+/)[0]!,
          body: [],
          start,
        };
    } else if (
      new RegExp(`^ {0,3}${fence.marker}{${fence.size},}\\s*$`).test(line)
    ) {
      if (
        fence.language === "bunker-quiz" ||
        fence.language === "bunker-note" ||
        fence.language === "bunker-exercise" ||
        fence.language === "bunker-sql"
      ) {
        const block = parseEditorial(fence.language, fence.body.join("\n"));
        if ("kind" in block && block.kind === "exercise") {
          if (exercise) throw new Error("Marcador de exercício duplicado.");
          exercise = true;
        }
        if (
          "kind" in block &&
          (block.kind === "sql" || block.kind === "sql-task-sequence")
        ) {
          if (sql) throw new Error("Atividade SQL duplicada.");
          sql = block;
          sqlRange = { start: fence.start, end: offset };
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
  if (sql && exercise)
    throw new Error("Uma lição não pode misturar atividades SQL e JavaScript.");
  return { exercise, sql, sqlRange };
}
export function validateEditorial(source: string): boolean {
  return scanEditorial(source).exercise;
}
export function lessonSqlPlacement(source: string): SqlLessonPlacement | null {
  return scanEditorial(source).sql;
}

/** Replace only a recognized top-level SQL fence, preserving surrounding Markdown. */
export function setLessonSqlPlacement(
  source: string,
  value: SqlLessonPlacement | null,
): string {
  const reference = value === null ? null : parseSqlPlacement(value);
  const { exercise, sqlRange } = scanEditorial(source);
  if (!reference)
    return sqlRange
      ? source.slice(0, sqlRange.start) + source.slice(sqlRange.end)
      : source;
  if (exercise)
    throw new Error("Uma lição não pode misturar atividades SQL e JavaScript.");
  const newline =
    source.includes("\r\n") && !source.replaceAll("\r\n", "").includes("\n")
      ? "\r\n"
      : "\n";
  const block =
    "```bunker-sql" +
    newline +
    JSON.stringify(reference) +
    newline +
    "```" +
    newline;
  const result = sqlRange
    ? source.slice(0, sqlRange.start) + block + source.slice(sqlRange.end)
    : source +
      (source.trim()
        ? source.endsWith(newline)
          ? newline
          : newline + newline
        : "") +
      block;
  validateEditorial(result);
  return result;
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
