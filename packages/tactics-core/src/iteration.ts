import { nextRandom } from "./random";
import {
  readSeed,
  readVersion,
  record,
  requireCanonical,
  errorReason,
} from "./validation";
import type { Validation } from "./comparison";

export const ITERATION_GENERATOR_VERSION = 1;
export const ITERATION_PATTERNS = Object.freeze([
  "collect-matching",
  "count-matching",
  "first-match",
  "partition-by-flag",
] as const);
export type IterationPattern = (typeof ITERATION_PATTERNS)[number];
export interface IterationRecord {
  readonly name: string;
  readonly active: boolean;
  readonly category: string;
}
export type IterationResult =
  | number
  | string
  | null
  | readonly string[]
  | {
      readonly matching: readonly string[];
      readonly other: readonly string[];
    };
type Projection = "name" | "category";
type Predicate =
  | { readonly property: "active"; readonly equals: boolean }
  | { readonly property: "category"; readonly equals: string };
export type IterationOperation =
  | { readonly type: "initialize" }
  | { readonly type: "iterate" }
  | {
      readonly type: "condition";
      readonly predicate: Predicate;
      readonly inverted: boolean;
    }
  | {
      readonly type: "append";
      readonly property: Projection;
      readonly destination: "selected" | "matching" | "other";
    }
  | { readonly type: "count"; readonly delta: 1 | -1 }
  | { readonly type: "assign"; readonly property: Projection }
  | { readonly type: "break" }
  | { readonly type: "finish" };
export interface IterationInstruction {
  readonly id: string;
  readonly operation: IterationOperation;
}
export interface IterationLine {
  readonly instructionId: string | null;
  readonly text: string;
}
export interface IterationTraceEvent {
  readonly instructionId: string;
  readonly iteration: number | null;
  readonly record: IterationRecord | null;
  readonly before: IterationResult;
  readonly after: IterationResult;
  readonly condition: boolean | null;
}
export interface IterationTrace {
  readonly events: readonly IterationTraceEvent[];
  readonly result: IterationResult;
  readonly iterations: number;
}
export interface IterationProgram {
  readonly family: "iteration-flow";
  readonly generatorVersion: typeof ITERATION_GENERATOR_VERSION;
  readonly seed: number;
  readonly pattern: IterationPattern;
  readonly records: readonly IterationRecord[];
  readonly instructions: readonly IterationInstruction[];
  readonly objective: string;
  readonly lines: readonly IterationLine[];
  readonly code: string;
  readonly trace: IterationTrace;
  readonly expectedResult: IterationResult;
}
export interface IterationIdentity {
  readonly family: "iteration-flow";
  readonly generatorVersion: typeof ITERATION_GENERATOR_VERSION;
  readonly seed: number;
  readonly pattern: IterationPattern;
  readonly kind: "locate-fault";
}
export type IterationDefect =
  | "inverted-selection"
  | "wrong-property"
  | "decrement-count"
  | "wrong-destination";
export interface IterationTactic {
  readonly identity: IterationIdentity;
  readonly reference: IterationProgram;
  readonly instructions: readonly IterationInstruction[];
  readonly faultId: string;
  readonly defect: IterationDefect;
  readonly lines: readonly IterationLine[];
  readonly code: string;
  readonly trace: IterationTrace;
}
export interface PublicIterationTactic {
  readonly identity: IterationIdentity;
  readonly objective: string;
  readonly records: readonly IterationRecord[];
  readonly expectedResult: IterationResult;
  readonly lines: readonly IterationLine[];
  readonly code: string;
  readonly instructionIds: readonly string[];
  readonly trace: IterationTrace;
}
export type IterationEvaluation =
  | {
      readonly status: "valid";
      readonly achieved: boolean;
      readonly produced: IterationResult;
      readonly expected: IterationResult;
      readonly explanation: string | null;
      readonly correctedCode: string | null;
    }
  | {
      readonly status: "invalid-answer" | "invalid-tactic";
      readonly achieved: false;
      readonly reason: string;
    };

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function readPattern(value: unknown): IterationPattern {
  const pattern = ITERATION_PATTERNS.find((item) => item === value);
  if (!pattern) throw new TypeError("Padrão de iteração inválido.");
  return pattern;
}
function instruction(
  id: string,
  operation: IterationOperation,
): IterationInstruction {
  return { id, operation };
}
function conditionCode(
  operation: Extract<IterationOperation, { type: "condition" }>,
): string {
  const base = `item.${operation.predicate.property} === ${JSON.stringify(operation.predicate.equals)}`;
  return operation.inverted ? `!(${base})` : base;
}
function source(
  pattern: IterationPattern,
  records: readonly IterationRecord[],
  instructions: readonly IterationInstruction[],
): readonly IterationLine[] {
  const lines: IterationLine[] = [];
  const add = (instructionId: string | null, text: string) =>
    lines.push({ instructionId, text });
  add(null, "const items = [");
  records.forEach((item) =>
    add(
      null,
      `  { name: ${JSON.stringify(item.name)}, active: ${item.active}, category: ${JSON.stringify(item.category)} },`,
    ),
  );
  add(null, "];");
  add(null, "");
  for (const { id, operation: op } of instructions) {
    switch (op.type) {
      case "initialize":
        add(
          id,
          pattern === "collect-matching"
            ? "const selected = [];"
            : pattern === "count-matching"
              ? "let count = 0;"
              : pattern === "first-match"
                ? "let found = null;"
                : "const groups = { matching: [], other: [] };",
        );
        break;
      case "iterate":
        add(id, "for (const item of items) {");
        break;
      case "condition":
        add(id, `  if (${conditionCode(op)}) {`);
        break;
      case "append":
        if (id === "append-other") add(null, "  } else {");
        add(
          id,
          `    ${op.destination === "selected" ? "selected" : `groups.${op.destination}`}.push(item.${op.property});`,
        );
        break;
      case "count":
        add(id, `    count ${op.delta === 1 ? "+=" : "-="} 1;`);
        break;
      case "assign":
        add(id, `    found = item.${op.property};`);
        break;
      case "break":
        add(id, "    break;");
        break;
      case "finish":
        add(null, "  }");
        add(null, "}");
        add(
          id,
          `const result = ${pattern === "collect-matching" ? "selected" : pattern === "count-matching" ? "count" : pattern === "first-match" ? "found" : "groups"};`,
        );
        break;
    }
  }
  return lines;
}

/** Specialized finite loop, over 3–6 generated records, one condition, no recursion.
 * Source is only a projection. No source parsing or dynamic execution. */
function traceProgram(
  pattern: IterationPattern,
  records: readonly IterationRecord[],
  instructions: readonly IterationInstruction[],
): IterationTrace {
  let selected: string[] = [],
    matching: string[] = [],
    other: string[] = [];
  let count = 0,
    found: string | null = null;
  const snapshot = (): IterationResult =>
    pattern === "collect-matching"
      ? [...selected]
      : pattern === "count-matching"
        ? count
        : pattern === "first-match"
          ? found
          : { matching: [...matching], other: [...other] };
  const events: IterationTraceEvent[] = [];
  const emit = (
    id: string,
    iteration: number | null,
    item: IterationRecord | null,
    before: IterationResult,
    condition: boolean | null = null,
  ) => {
    events.push({
      instructionId: id,
      iteration,
      record: item,
      before,
      after: snapshot(),
      condition,
    });
  };
  emit("initialize", null, null, snapshot());
  const test = instructions.find((i) => i.operation.type === "condition")!;
  const op = test.operation;
  if (op.type !== "condition") throw new Error("Condição ausente.");
  let iterations = 0;
  for (let index = 0; index < records.length; index++) {
    if (index >= 6) throw new Error("Limite de iteração excedido.");
    const item = records[index]!;
    iterations++;
    emit("iterate", index, item, snapshot());
    const match =
      (item[op.predicate.property] === op.predicate.equals) !== op.inverted;
    emit(test.id, index, item, snapshot(), match);
    const ids = match
      ? pattern === "partition-by-flag"
        ? ["append-matching"]
        : pattern === "first-match"
          ? ["assign", "break"]
          : pattern === "count-matching"
            ? ["count"]
            : ["append"]
      : pattern === "partition-by-flag"
        ? ["append-other"]
        : [];
    let stopped = false;
    for (const id of ids) {
      const operation = instructions.find((i) => i.id === id)!.operation;
      const before = snapshot();
      if (operation.type === "append") {
        const value = item[operation.property];
        if (operation.destination === "selected")
          selected = [...selected, value];
        else if (operation.destination === "matching")
          matching = [...matching, value];
        else other = [...other, value];
      } else if (operation.type === "count") count += operation.delta;
      else if (operation.type === "assign") found = item[operation.property];
      else if (operation.type === "break") stopped = true;
      emit(id, index, item, before);
    }
    if (stopped) break;
  }
  emit("finish", null, null, snapshot());
  if (events.length > 28) throw new Error("Limite de trace excedido.");
  return freeze({ events, result: snapshot(), iterations });
}

export function generateIterationReference(
  seed: unknown,
  generatorVersion: unknown = ITERATION_GENERATOR_VERSION,
  pattern?: unknown,
): IterationProgram {
  const validSeed = readSeed(seed);
  readVersion(generatorVersion, ITERATION_GENERATOR_VERSION);
  let state = validSeed;
  const draw = (size: number) => {
    const [next, word] = nextRandom(state);
    state = next;
    return word % size;
  };
  const generated = ITERATION_PATTERNS[draw(4)]!;
  const chosen = pattern === undefined ? generated : readPattern(pattern);
  const names = [
    "Ana",
    "Bruno",
    "Carla",
    "Davi",
    "Eva",
    "Iara",
    "Lia",
    "Ravi",
    "Caio",
    "Nina",
    "Bia",
    "Noa",
  ];
  for (let i = names.length - 1; i > 0; i--) {
    const j = draw(i + 1);
    [names[i], names[j]] = [names[j]!, names[i]!];
  }
  const categories = ["azul", "verde", "âmbar"];
  const count = 3 + draw(4);
  const property: Projection = draw(2) === 0 ? "name" : "category";
  const flag = draw(2) === 1;
  const category = categories[draw(3)]!;
  const useFlag = chosen === "partition-by-flag" || draw(2) === 0;
  const absent = chosen === "first-match" && draw(4) === 0;
  const predicate: Predicate = useFlag
    ? { property: "active", equals: flag }
    : { property: "category", equals: category };
  const records = Array.from({ length: count }, (_, i) => ({
    name: names[i]!,
    active:
      absent && useFlag
        ? !flag
        : i === 0
          ? flag
          : i === 1
            ? !flag
            : draw(2) === 1,
    category:
      absent && !useFlag
        ? categories[(categories.indexOf(category) + 1) % 3]!
        : i === 0
          ? category
          : i === 1
            ? categories[(categories.indexOf(category) + 1) % 3]!
            : categories[draw(3)]!,
  }));
  for (let i = count - 1; i > 0; i--) {
    const j = draw(i + 1);
    [records[i], records[j]] = [records[j]!, records[i]!];
  }
  const instructions: IterationInstruction[] = [
    instruction("initialize", { type: "initialize" }),
    instruction("iterate", { type: "iterate" }),
    instruction("condition", { type: "condition", predicate, inverted: false }),
  ];
  if (chosen === "collect-matching")
    instructions.push(
      instruction("append", {
        type: "append",
        property,
        destination: "selected",
      }),
    );
  if (chosen === "count-matching")
    instructions.push(instruction("count", { type: "count", delta: 1 }));
  if (chosen === "first-match")
    instructions.push(
      instruction("assign", { type: "assign", property }),
      instruction("break", { type: "break" }),
    );
  if (chosen === "partition-by-flag")
    instructions.push(
      instruction("append-matching", {
        type: "append",
        property,
        destination: "matching",
      }),
      instruction("append-other", {
        type: "append",
        property,
        destination: "other",
      }),
    );
  instructions.push(instruction("finish", { type: "finish" }));
  const criteria = useFlag
    ? `active igual a ${flag}`
    : `category igual a ${JSON.stringify(category)}`;
  const label = property === "name" ? "os nomes" : "as categorias";
  const objective =
    chosen === "collect-matching"
      ? `Reunir ${label} dos registros com ${criteria}.`
      : chosen === "count-matching"
        ? `Contar os registros com ${criteria}.`
        : chosen === "first-match"
          ? `Encontrar ${property === "name" ? "o nome" : "a categoria"} do primeiro registro com ${criteria}; retornar null se ausente.`
          : `Separar ${label} por ${criteria}: matching para correspondentes e other para os demais.`;
  const lines = source(chosen, records, instructions);
  const trace = traceProgram(chosen, records, instructions);
  return freeze({
    family: "iteration-flow",
    generatorVersion: ITERATION_GENERATOR_VERSION,
    seed: validSeed,
    pattern: chosen,
    records,
    instructions,
    objective,
    lines,
    code: lines.map((l) => l.text).join("\n"),
    trace,
    expectedResult: trace.result,
  });
}
function readProgram(value: unknown): IterationProgram {
  const item = record(value);
  return requireCanonical(
    value,
    generateIterationReference(
      item.seed,
      item.generatorVersion,
      readPattern(item.pattern),
    ),
  );
}
function makeTactic(reference: IterationProgram): IterationTactic {
  const condition = reference.instructions.find(
    (i) => i.operation.type === "condition",
  )!;
  const project = reference.instructions.find(
    (i) => i.operation.type === "append" || i.operation.type === "assign",
  );
  const candidates: {
    id: string;
    defect: IterationDefect;
    operation: IterationOperation;
  }[] = [];
  if (reference.pattern === "count-matching")
    candidates.push({
      id: "count",
      defect: "decrement-count",
      operation: { type: "count", delta: -1 },
    });
  else if (reference.pattern === "partition-by-flag") {
    const id = reference.seed % 2 === 0 ? "append-matching" : "append-other";
    const original = reference.instructions.find((i) => i.id === id)!.operation;
    if (original.type !== "append") throw new Error("Destino ausente.");
    candidates.push({
      id,
      defect: "wrong-destination",
      operation: {
        ...original,
        destination: original.destination === "matching" ? "other" : "matching",
      },
    });
  } else {
    if (condition.operation.type !== "condition" || !project)
      throw new Error("Programa incompatível.");
    candidates.push({
      id: condition.id,
      defect: "inverted-selection",
      operation: { ...condition.operation, inverted: true },
    });
    if (
      project.operation.type === "append" ||
      project.operation.type === "assign"
    )
      candidates.push({
        id: project.id,
        defect: "wrong-property",
        operation: {
          ...project.operation,
          property: project.operation.property === "name" ? "category" : "name",
        },
      });
    const [, word] = nextRandom((reference.seed ^ 0x3c6ef372) >>> 0);
    if (word % 2 === 1) candidates.reverse();
  }
  // At most two candidates. The no-match first-search may reject wrong-property.
  for (const candidate of candidates) {
    const instructions = reference.instructions.map((i) =>
      i.id === candidate.id ? instruction(i.id, candidate.operation) : i,
    );
    const trace = traceProgram(
      reference.pattern,
      reference.records,
      instructions,
    );
    if (
      JSON.stringify(trace.result) === JSON.stringify(reference.expectedResult)
    )
      continue;
    const lines = source(reference.pattern, reference.records, instructions);
    return freeze({
      identity: {
        family: reference.family,
        generatorVersion: reference.generatorVersion,
        seed: reference.seed,
        pattern: reference.pattern,
        kind: "locate-fault",
      },
      reference,
      instructions,
      faultId: candidate.id,
      defect: candidate.defect,
      lines,
      code: lines.map((l) => l.text).join("\n"),
      trace,
    });
  }
  throw new Error("Nenhuma mutação discriminante no domínio limitado.");
}
export function transformIterationProgram(
  program: IterationProgram,
  kind: unknown = "locate-fault",
): IterationTactic {
  if (kind !== "locate-fault")
    throw new TypeError("Modalidade de iteração inválida.");
  return makeTactic(readProgram(program));
}
function readTactic(value: unknown): IterationTactic {
  const item = record(value);
  return requireCanonical(value, makeTactic(readProgram(item.reference)));
}
export function verifyIterationTactic(value: unknown): Validation {
  try {
    readTactic(value);
    return { valid: true };
  } catch (error) {
    return { valid: false, reason: errorReason(error) };
  }
}
export function getPublicIterationTactic(
  value: unknown,
): PublicIterationTactic {
  const model = readTactic(value);
  return freeze({
    identity: model.identity,
    objective: model.reference.objective,
    records: model.reference.records,
    expectedResult: model.reference.expectedResult,
    lines: model.lines,
    code: model.code,
    instructionIds: model.instructions.map((i) => i.id),
    trace: model.trace,
  });
}
export function getIterationTrace(value: IterationTactic): IterationTrace {
  return readTactic(value).trace;
}
export function evaluateIterationAnswer(
  tactic: unknown,
  answer: unknown,
): IterationEvaluation {
  let model: IterationTactic;
  try {
    model = readTactic(tactic);
  } catch (error) {
    return {
      status: "invalid-tactic",
      achieved: false,
      reason: errorReason(error),
    };
  }
  if (
    typeof answer !== "string" ||
    !model.instructions.some((i) => i.id === answer)
  )
    return {
      status: "invalid-answer",
      achieved: false,
      reason: "Selecione uma instrução do programa.",
    };
  const achieved = answer === model.faultId;
  const explanations: Record<IterationDefect, string> = {
    "inverted-selection":
      "A condição está invertida e processa os registros que deveriam ficar de fora.",
    "wrong-property":
      "A instrução usa a propriedade errada do registro ao construir o resultado.",
    "decrement-count":
      "A contagem diminui a cada correspondência, quando deveria aumentar.",
    "wrong-destination":
      "A instrução envia o registro para o grupo oposto ao objetivo.",
  };
  return freeze({
    status: "valid",
    achieved,
    produced: model.trace.result,
    expected: model.reference.expectedResult,
    explanation: achieved ? explanations[model.defect] : null,
    correctedCode: achieved
      ? model.reference.lines
          .find((l) => l.instructionId === model.faultId)!
          .text.trim()
      : null,
  });
}
