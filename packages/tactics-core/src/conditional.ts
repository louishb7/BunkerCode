import { nextRandom } from "./random";
import { OPERATORS, type Operator, type Validation } from "./comparison";
import {
  applyStep,
  renderStep,
  STEP_CHOICES,
  type ArithmeticStep,
} from "./arithmetic";
import {
  readSeed,
  readVersion,
  record,
  matchesCanonical,
  requireCanonical,
  errorReason,
} from "./validation";

export const CONDITIONAL_GENERATOR_VERSION = 1;
export type ConditionalKind = "complete-condition" | "repair-condition";
export interface ConditionalIdentity {
  readonly family: "conditional-branch";
  readonly generatorVersion: typeof CONDITIONAL_GENERATOR_VERSION;
  readonly seed: number;
  readonly kind: ConditionalKind;
}
export interface ConditionalTrace {
  readonly input: number;
  readonly afterPreparation: number;
  readonly comparison: boolean;
  readonly branch: "if" | "else";
  readonly afterBranch: number;
  readonly result: number;
}
export interface ConditionalProgram {
  readonly family: "conditional-branch";
  readonly generatorVersion: typeof CONDITIONAL_GENERATOR_VERSION;
  readonly seed: number;
  readonly preparation: ArithmeticStep;
  readonly threshold: number;
  readonly operator: Operator;
  readonly ifStep: ArithmeticStep;
  readonly elseStep: ArithmeticStep;
  readonly inputs: readonly [number, number, number];
  readonly traces: readonly ConditionalTrace[];
  readonly results: readonly number[];
  readonly code: string;
}
export interface ConditionalTactic {
  readonly identity: ConditionalIdentity;
  readonly reference: ConditionalProgram;
  readonly presentedOperator: Operator | null;
}
export interface PublicConditionalTactic {
  readonly identity: ConditionalIdentity;
  readonly code: string;
  readonly objective: string;
  readonly inputs: readonly number[];
  readonly expectedResults: readonly number[];
  readonly allowedOperators: readonly Operator[];
}
export type ConditionalEvaluation =
  | {
      readonly status: "valid";
      readonly achieved: boolean;
      readonly produced: readonly number[];
      readonly expected: readonly number[];
      readonly traces: readonly ConditionalTrace[];
    }
  | {
      readonly status: "invalid-answer";
      readonly achieved: false;
      readonly produced: null;
      readonly expected: readonly number[];
      readonly traces: null;
    }
  | {
      readonly status: "invalid-tactic";
      readonly achieved: false;
      readonly produced: null;
      readonly expected: null;
      readonly traces: null;
      readonly reason: string;
    };

function compare(
  value: number,
  threshold: number,
  operator: Operator,
): boolean {
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
}
type ConditionalBody = Pick<
  ConditionalProgram,
  "preparation" | "threshold" | "ifStep" | "elseStep"
>;
function traceConditional(
  program: ConditionalBody,
  input: number,
  operator: Operator,
): ConditionalTrace {
  const afterPreparation = applyStep(input, program.preparation);
  const comparison = compare(afterPreparation, program.threshold, operator);
  const afterBranch = applyStep(
    afterPreparation,
    comparison ? program.ifStep : program.elseStep,
  );
  return Object.freeze({
    input,
    afterPreparation,
    comparison,
    branch: comparison ? "if" : "else",
    afterBranch,
    result: afterBranch,
  });
}
function render(program: ConditionalBody, operator: Operator | "___"): string {
  return `function calculate(start) {\n  let value = start;\n\n  ${renderStep(program.preparation)}\n\n  if (value ${operator} ${program.threshold}) {\n    ${renderStep(program.ifStep)}\n  } else {\n    ${renderStep(program.elseStep)}\n  }\n\n  return value;\n}\n`;
}

export function generateConditionalReference(
  seed: unknown,
  generatorVersion: unknown = CONDITIONAL_GENERATOR_VERSION,
): ConditionalProgram {
  const validatedSeed = readSeed(seed);
  readVersion(generatorVersion, CONDITIONAL_GENERATOR_VERSION);
  let state = validatedSeed;
  const draw = (size: number) => {
    const [next, word] = nextRandom(state);
    state = next;
    return word % size;
  };
  const middle = draw(11) - 5;
  const preparation = STEP_CHOICES[draw(STEP_CHOICES.length)]!;
  const inputs: [number, number, number] = [middle - 1, middle, middle + 1];
  const prepared = inputs.map((input) => applyStep(input, preparation));
  const threshold = prepared[1]!;
  const operator = OPERATORS[draw(OPERATORS.length)]!;
  const activeSteps = STEP_CHOICES.filter((step) =>
    prepared.every((value) => applyStep(value, step) !== value),
  );
  const ifStep = activeSteps[draw(activeSteps.length)]!;
  const alternatives = activeSteps.filter((step) =>
    prepared.every(
      (value) => applyStep(value, step) !== applyStep(value, ifStep),
    ),
  );
  // Six translations ensure a discriminating alternative exists, even if one
  // multiplication intersects a translation at one of the three input values.
  if (alternatives.length === 0)
    throw new Error("Não foi possível construir ramos discriminantes.");
  const elseStep = alternatives[draw(alternatives.length)]!;
  for (let index = 2; index > 0; index--) {
    const other = draw(index + 1);
    [inputs[index], inputs[other]] = [inputs[other]!, inputs[index]!];
  }
  const body = { preparation, threshold, ifStep, elseStep };
  const traces = Object.freeze(
    inputs.map((input) => traceConditional(body, input, operator)),
  );
  return Object.freeze({
    family: "conditional-branch",
    generatorVersion: CONDITIONAL_GENERATOR_VERSION,
    seed: validatedSeed,
    ...body,
    operator,
    inputs: Object.freeze(inputs),
    traces,
    results: Object.freeze(traces.map((trace) => trace.result)),
    code: render(body, operator),
  });
}

function readKind(kind: unknown): ConditionalKind {
  if (kind !== "complete-condition" && kind !== "repair-condition")
    throw new TypeError("Modalidade condicional inválida.");
  return kind;
}
function readProgram(value: unknown): ConditionalProgram {
  const item = record(value);
  readVersion(item.generatorVersion, CONDITIONAL_GENERATOR_VERSION);
  return requireCanonical(
    value,
    generateConditionalReference(item.seed, item.generatorVersion),
  );
}
function makeTactic(
  reference: ConditionalProgram,
  kind: ConditionalKind,
): ConditionalTactic {
  let presentedOperator: Operator | null = null;
  if (kind === "repair-condition") {
    const [, word] = nextRandom((reference.seed ^ 0xc6bc2796) >>> 0);
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
export function transformConditionalProgram(
  program: ConditionalProgram,
  kind: unknown,
): ConditionalTactic {
  return makeTactic(readProgram(program), readKind(kind));
}
function readTactic(value: unknown): ConditionalTactic {
  const item = record(value);
  const reference = readProgram(item.reference);
  const tactic = requireCanonical(
    value,
    makeTactic(reference, readKind(record(item.identity).kind)),
  );
  const signatures = OPERATORS.map((operator) =>
    reference.inputs.map(
      (input) => traceConditional(reference, input, operator).result,
    ),
  );
  if (
    signatures.some((signature, index) =>
      signatures
        .slice(0, index)
        .some((previous) => matchesCanonical(signature, previous)),
    ) ||
    (tactic.presentedOperator !== null &&
      matchesCanonical(
        reference.inputs.map(
          (input) =>
            traceConditional(reference, input, tactic.presentedOperator!)
              .result,
        ),
        reference.results,
      ))
  )
    throw new Error("Tática condicional ambígua ou reparo ineficaz.");
  return tactic;
}
export function verifyConditionalTactic(tactic: unknown): Validation {
  try {
    readTactic(tactic);
    return { valid: true };
  } catch (error) {
    return { valid: false, reason: errorReason(error) };
  }
}
export function getPublicConditionalTactic(
  tactic: ConditionalTactic,
): PublicConditionalTactic {
  const model = readTactic(tactic);
  const action =
    model.identity.kind === "complete-condition"
      ? "Preencha a condição"
      : "Substitua o operador da condição";
  return Object.freeze({
    identity: model.identity,
    code: render(model.reference, model.presentedOperator ?? "___"),
    objective: `${action} para que calculate produza [${model.reference.results.join(", ")}] para as entradas [${model.reference.inputs.join(", ")}], nesta ordem.`,
    inputs: model.reference.inputs,
    expectedResults: model.reference.results,
    allowedOperators: OPERATORS,
  });
}
export function evaluateConditionalAnswer(
  tactic: unknown,
  answer: unknown,
): ConditionalEvaluation {
  let model: ConditionalTactic;
  try {
    model = readTactic(tactic);
  } catch (error) {
    return {
      status: "invalid-tactic",
      achieved: false,
      produced: null,
      expected: null,
      traces: null,
      reason: errorReason(error),
    };
  }
  const expected = model.reference.results;
  const operator = OPERATORS.find((candidate) => candidate === answer);
  if (!operator)
    return {
      status: "invalid-answer",
      achieved: false,
      produced: null,
      expected,
      traces: null,
    };
  const traces = Object.freeze(
    model.reference.inputs.map((input) =>
      traceConditional(model.reference, input, operator),
    ),
  );
  const produced = Object.freeze(traces.map((trace) => trace.result));
  return {
    status: "valid",
    achieved: matchesCanonical(produced, expected),
    produced,
    expected,
    traces,
  };
}
