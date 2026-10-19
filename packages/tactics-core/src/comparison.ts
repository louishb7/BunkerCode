import { nextRandom } from "./random";

export const GENERATOR_VERSION = 1;
export const OPERATORS = Object.freeze([
  ">",
  ">=",
  "<",
  "<=",
  "===",
  "!==",
] as const);
export type Operator = (typeof OPERATORS)[number];
export type TacticKind = "complete-operator" | "repair-operator";

interface ProgramIdentity {
  readonly family: "comparison-boundaries";
  readonly generatorVersion: typeof GENERATOR_VERSION;
  readonly seed: number;
}
export interface TacticIdentity extends ProgramIdentity {
  readonly kind: TacticKind;
}
export interface ComparisonProgram extends ProgramIdentity {
  readonly values: readonly [number, number, number];
  readonly threshold: number;
  readonly operator: Operator;
  readonly result: readonly number[];
  readonly code: string;
}
/** Internal model, never the UI payload. */
export interface Tactic {
  readonly identity: TacticIdentity;
  readonly reference: ComparisonProgram;
  readonly presentedOperator: Operator | null;
}
export interface PublicTactic {
  readonly identity: TacticIdentity;
  readonly code: string;
  readonly objective: string;
  readonly allowedOperators: readonly Operator[];
  readonly expectedResult: readonly number[];
}
export type Validation =
  { readonly valid: true } | { readonly valid: false; readonly reason: string };
export type Evaluation =
  | {
      readonly status: "valid";
      readonly achieved: boolean;
      readonly produced: readonly number[];
      readonly expected: readonly number[];
    }
  | {
      readonly status: "invalid-answer";
      readonly achieved: false;
      readonly produced: null;
      readonly expected: readonly number[];
    }
  | {
      readonly status: "invalid-tactic";
      readonly achieved: false;
      readonly produced: null;
      readonly expected: null;
      readonly reason: string;
    };

function isOperator(value: unknown): value is Operator {
  return OPERATORS.some((operator) => operator === value);
}
function readKind(value: unknown): TacticKind {
  if (value !== "complete-operator" && value !== "repair-operator")
    throw new TypeError("Modalidade de tática inválida.");
  return value;
}
function readSeed(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 0xffffffff
  )
    throw new RangeError("Seed deve ser um inteiro entre 0 e 4294967295.");
  return value === 0 ? 0 : value;
}
function readVersion(value: unknown): typeof GENERATOR_VERSION {
  if (value !== GENERATOR_VERSION)
    throw new RangeError(
      "Versão do gerador incompatível; somente versão 1 é suportada.",
    );
  return value;
}
function select(
  values: readonly number[],
  threshold: number,
  operator: Operator,
): number[] {
  return values.filter((value) => {
    switch (operator) {
      case ">":
        return value > threshold;
      case ">=":
        return value >= threshold;
      case "<":
        return value < threshold;
      case "<=":
        return value <= threshold;
      case "===":
        return value === threshold;
      case "!==":
        return value !== threshold;
    }
  });
}
function sameNumbers(value: unknown, expected: readonly number[]): boolean {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    expected.every((number, index) => value[index] === number)
  );
}
function render(
  program: Pick<ComparisonProgram, "values" | "threshold">,
  operator: Operator | "___",
): string {
  return `const values = [${program.values.join(", ")}];\n\nconst result = values.filter(\n  value => value ${operator} ${program.threshold}\n);\n`;
}

/** Version 1 consumes six Mulberry32 words: threshold, distances, operator, shuffle.
 * All numeric values are finite integers in [-15, 15]; threshold is in [-10, 10]. */
export function generateReference(
  seed: unknown,
  generatorVersion: unknown = GENERATOR_VERSION,
): ComparisonProgram {
  const validatedSeed = readSeed(seed);
  const version = readVersion(generatorVersion);
  let state = validatedSeed;
  const draw = (size: number): number => {
    const [next, word] = nextRandom(state);
    state = next;
    return word % size;
  };
  const threshold = draw(21) - 10;
  const values: [number, number, number] = [
    threshold - 1 - draw(5),
    threshold,
    threshold + 1 + draw(5),
  ];
  const operator = OPERATORS[draw(OPERATORS.length)]!;
  for (let index = 2; index > 0; index--) {
    const other = draw(index + 1);
    [values[index], values[other]] = [values[other]!, values[index]!];
  }
  return Object.freeze({
    family: "comparison-boundaries",
    generatorVersion: version,
    seed: validatedSeed,
    values: Object.freeze(values),
    threshold,
    operator,
    result: Object.freeze(select(values, threshold, operator)),
    code: render({ values, threshold }, operator),
  });
}

function record(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("Modelo de tática inválido.");
  const object = value as Record<string, unknown>;
  if (
    Object.keys(object).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(object, key))
  )
    throw new TypeError("Campos do modelo desconhecidos ou ausentes.");
  return object;
}
function readReference(value: unknown): ComparisonProgram {
  const item = record(value, [
    "family",
    "generatorVersion",
    "seed",
    "values",
    "threshold",
    "operator",
    "result",
    "code",
  ]);
  const reference = generateReference(
    item.seed,
    readVersion(item.generatorVersion),
  );
  if (
    item.family !== reference.family ||
    item.threshold !== reference.threshold ||
    item.operator !== reference.operator ||
    item.code !== reference.code ||
    !sameNumbers(item.values, reference.values) ||
    !sameNumbers(item.result, reference.result)
  )
    throw new TypeError("Programa diverge da seed e versão declaradas.");
  return reference;
}
function makeTactic(reference: ComparisonProgram, kind: TacticKind): Tactic {
  let presentedOperator: Operator | null = null;
  if (kind === "repair-operator") {
    // Separate stream: transformations cannot change base-program draws.
    const [, word] = nextRandom((reference.seed ^ 0xa5a5a5a5) >>> 0);
    const alternatives = OPERATORS.filter(
      (operator) => operator !== reference.operator,
    );
    presentedOperator = alternatives[word % alternatives.length]!;
  }
  return Object.freeze({
    identity: Object.freeze({
      family: reference.family,
      generatorVersion: reference.generatorVersion,
      seed: reference.seed,
      kind,
    }),
    reference,
    presentedOperator,
  });
}

export function transformProgram(
  program: ComparisonProgram,
  kind: unknown,
): Tactic {
  return makeTactic(readReference(program), readKind(kind));
}

function readTactic(value: unknown): Tactic {
  const item = record(value, ["identity", "reference", "presentedOperator"]);
  const identity = record(item.identity, [
    "family",
    "generatorVersion",
    "seed",
    "kind",
  ]);
  const reference = readReference(item.reference);
  const expected = makeTactic(reference, readKind(identity.kind));
  if (
    identity.family !== reference.family ||
    identity.generatorVersion !== reference.generatorVersion ||
    identity.seed !== reference.seed ||
    item.presentedOperator !== expected.presentedOperator
  )
    throw new TypeError("Identidade ou transformação inconsistente.");
  const solutions = OPERATORS.filter((operator) =>
    sameNumbers(
      select(reference.values, reference.threshold, operator),
      reference.result,
    ),
  );
  if (
    solutions.length !== 1 ||
    (expected.presentedOperator !== null &&
      sameNumbers(
        select(
          reference.values,
          reference.threshold,
          expected.presentedOperator,
        ),
        reference.result,
      ))
  )
    throw new TypeError(
      "Tática sem resposta única ou reparo sem mudança de comportamento.",
    );
  return expected;
}

export function verifyTactic(tactic: unknown): Validation {
  try {
    readTactic(tactic);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      reason: error instanceof Error ? error.message : "Modelo inválido.",
    };
  }
}

export function getPublicTactic(tactic: Tactic): PublicTactic {
  const { reference, identity, presentedOperator } = readTactic(tactic);
  const action =
    identity.kind === "complete-operator"
      ? "Preencha a lacuna"
      : "Substitua o operador de comparação";
  return Object.freeze({
    identity,
    code: render(reference, presentedOperator ?? "___"),
    objective: `${action} para que result seja exatamente [${reference.result.join(", ")}], na ordem indicada.`,
    allowedOperators: OPERATORS,
    expectedResult: reference.result,
  });
}

/** Known operators over structured data only; source text is never executed. */
export function evaluateAnswer(tactic: unknown, answer: unknown): Evaluation {
  let model: Tactic;
  try {
    model = readTactic(tactic);
  } catch (error) {
    return {
      status: "invalid-tactic",
      achieved: false,
      produced: null,
      expected: null,
      reason: error instanceof Error ? error.message : "Modelo inválido.",
    };
  }
  const expected = model.reference.result;
  if (!isOperator(answer))
    return {
      status: "invalid-answer",
      achieved: false,
      produced: null,
      expected,
    };
  const produced = Object.freeze(
    select(model.reference.values, model.reference.threshold, answer),
  );
  return {
    status: "valid",
    achieved: sameNumbers(produced, expected),
    produced,
    expected,
  };
}
