import { nextRandom } from "./random";
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
import type { Validation } from "./comparison";

export const ASSIGNMENT_GENERATOR_VERSION = 1;
export type AssignmentKind = "complete-step" | "repair-step";
export interface AssignmentIdentity {
  readonly family: "assignment-sequence";
  readonly generatorVersion: typeof ASSIGNMENT_GENERATOR_VERSION;
  readonly seed: number;
  readonly kind: AssignmentKind;
}
export interface AssignmentTrace {
  readonly initial: number;
  readonly transitions: readonly {
    readonly step: ArithmeticStep;
    readonly before: number;
    readonly after: number;
  }[];
  readonly result: number;
}
export interface AssignmentProgram {
  readonly family: "assignment-sequence";
  readonly generatorVersion: typeof ASSIGNMENT_GENERATOR_VERSION;
  readonly seed: number;
  readonly initial: number;
  readonly steps: readonly ArithmeticStep[];
  readonly trace: AssignmentTrace;
  readonly code: string;
}
export interface AssignmentTactic {
  readonly identity: AssignmentIdentity;
  readonly reference: AssignmentProgram;
  readonly stepIndex: number;
  readonly alternatives: readonly ArithmeticStep[];
  readonly presentedStep: ArithmeticStep | null;
}
export interface PublicAssignmentTactic {
  readonly identity: AssignmentIdentity;
  readonly code: string;
  readonly objective: string;
  readonly stepIndex: number;
  readonly alternatives: readonly ArithmeticStep[];
  readonly expectedResult: number;
}
export type AssignmentEvaluation =
  | {
      readonly status: "valid";
      readonly achieved: boolean;
      readonly produced: number;
      readonly expected: number;
      readonly trace: AssignmentTrace;
    }
  | {
      readonly status: "invalid-answer";
      readonly achieved: false;
      readonly produced: null;
      readonly expected: number;
      readonly trace: null;
    }
  | {
      readonly status: "invalid-tactic";
      readonly achieved: false;
      readonly produced: null;
      readonly expected: null;
      readonly trace: null;
      readonly reason: string;
    };

function traceAssignment(
  initial: number,
  steps: readonly ArithmeticStep[],
): AssignmentTrace {
  let value = initial;
  const transitions = steps.map((step) => {
    const before = value;
    value = applyStep(value, step);
    return Object.freeze({ step, before, after: value });
  });
  return Object.freeze({
    initial,
    transitions: Object.freeze(transitions),
    result: value,
  });
}

function render(
  program: Pick<AssignmentProgram, "initial" | "steps">,
  stepIndex = -1,
  replacement: ArithmeticStep | null = null,
): string {
  const lines = program.steps.map((step, index) =>
    index === stepIndex
      ? replacement === null
        ? "___;"
        : renderStep(replacement)
      : renderStep(step),
  );
  return `let value = ${program.initial};\n\n${lines.join("\n")}\n\nconst result = value;\n`;
}

export function generateAssignmentReference(
  seed: unknown,
  generatorVersion: unknown = ASSIGNMENT_GENERATOR_VERSION,
): AssignmentProgram {
  const validatedSeed = readSeed(seed);
  readVersion(generatorVersion, ASSIGNMENT_GENERATOR_VERSION);
  let state = validatedSeed;
  const draw = (size: number) => {
    const [next, word] = nextRandom(state);
    state = next;
    return word % size;
  };
  const initial = draw(19) - 9;
  const count = 2 + draw(3);
  const steps: ArithmeticStep[] = [];
  let value = initial;
  for (let index = 0; index < count; index++) {
    const candidates = STEP_CHOICES.filter(
      (step) => applyStep(value, step) !== value,
    );
    const step = candidates[draw(candidates.length)]!;
    steps.push(step);
    value = applyStep(value, step);
  }
  return Object.freeze({
    family: "assignment-sequence",
    generatorVersion: ASSIGNMENT_GENERATOR_VERSION,
    seed: validatedSeed,
    initial,
    steps: Object.freeze(steps),
    trace: traceAssignment(initial, steps),
    code: render({ initial, steps }),
  });
}

function readKind(kind: unknown): AssignmentKind {
  if (kind !== "complete-step" && kind !== "repair-step")
    throw new TypeError("Modalidade de atribuição inválida.");
  return kind;
}
function readProgram(value: unknown): AssignmentProgram {
  const item = record(value);
  readVersion(item.generatorVersion, ASSIGNMENT_GENERATOR_VERSION);
  return requireCanonical(
    value,
    generateAssignmentReference(item.seed, item.generatorVersion),
  );
}
function replaceStep(
  reference: AssignmentProgram,
  index: number,
  step: ArithmeticStep,
): AssignmentTrace {
  return traceAssignment(
    reference.initial,
    reference.steps.map((original, position) =>
      position === index ? step : original,
    ),
  );
}
function makeTactic(
  reference: AssignmentProgram,
  kind: AssignmentKind,
): AssignmentTactic {
  let state = (reference.seed ^ 0x93d765dd) >>> 0;
  const draw = (size: number) => {
    const [next, word] = nextRandom(state);
    state = next;
    return word % size;
  };
  const stepIndex = draw(reference.steps.length);
  const solution = reference.steps[stepIndex]!;
  const before = reference.trace.transitions[stepIndex]!.before;
  const pool = STEP_CHOICES.filter(
    (step) =>
      applyStep(before, step) !== before &&
      replaceStep(reference, stepIndex, step).result !== reference.trace.result,
  );
  // Exhaustive, bounded enumeration of eight instructions; no candidate retries.
  const wrong: ArithmeticStep[] = [];
  const results = new Set<number>();
  while (pool.length > 0 && wrong.length < 2) {
    const [step] = pool.splice(draw(pool.length), 1);
    const result = replaceStep(reference, stepIndex, step!).result;
    if (!results.has(result)) {
      results.add(result);
      wrong.push(step!);
    }
  }
  if (wrong.length !== 2)
    throw new Error("Não foi possível construir alternativas distintas.");
  const alternatives = [solution, ...wrong];
  for (let index = 2; index > 0; index--) {
    const other = draw(index + 1);
    [alternatives[index], alternatives[other]] = [
      alternatives[other]!,
      alternatives[index]!,
    ];
  }
  const presentedStep =
    kind === "complete-step" ? null : wrong[draw(wrong.length)]!;
  return Object.freeze({
    identity: Object.freeze({
      family: reference.family,
      generatorVersion: reference.generatorVersion,
      seed: reference.seed,
      kind,
    }),
    reference,
    stepIndex,
    alternatives: Object.freeze(alternatives),
    presentedStep,
  });
}

export function transformAssignmentProgram(
  program: AssignmentProgram,
  kind: unknown,
): AssignmentTactic {
  return makeTactic(readProgram(program), readKind(kind));
}
function readTactic(value: unknown): AssignmentTactic {
  const item = record(value);
  const reference = readProgram(item.reference);
  const tactic = requireCanonical(
    value,
    makeTactic(reference, readKind(record(item.identity).kind)),
  );
  const outputs = tactic.alternatives.map(
    (step) => replaceStep(reference, tactic.stepIndex, step).result,
  );
  if (
    new Set(outputs).size !== 3 ||
    outputs.filter((result) => result === reference.trace.result).length !==
      1 ||
    (tactic.presentedStep !== null &&
      replaceStep(reference, tactic.stepIndex, tactic.presentedStep).result ===
        reference.trace.result)
  )
    throw new Error("Tática de atribuição ambígua ou reparo ineficaz.");
  return tactic;
}
export function verifyAssignmentTactic(tactic: unknown): Validation {
  try {
    readTactic(tactic);
    return { valid: true };
  } catch (error) {
    return { valid: false, reason: errorReason(error) };
  }
}
export function getPublicAssignmentTactic(
  tactic: AssignmentTactic,
): PublicAssignmentTactic {
  const model = readTactic(tactic);
  const action =
    model.identity.kind === "complete-step"
      ? "Preencha a instrução"
      : "Substitua a instrução indicada";
  return Object.freeze({
    identity: model.identity,
    code: render(model.reference, model.stepIndex, model.presentedStep),
    objective: `${action} na posição ${model.stepIndex + 1} para que result seja ${model.reference.trace.result}.`,
    stepIndex: model.stepIndex,
    alternatives: model.alternatives,
    expectedResult: model.reference.trace.result,
  });
}
export function evaluateAssignmentAnswer(
  tactic: unknown,
  answer: unknown,
): AssignmentEvaluation {
  let model: AssignmentTactic;
  try {
    model = readTactic(tactic);
  } catch (error) {
    return {
      status: "invalid-tactic",
      achieved: false,
      produced: null,
      expected: null,
      trace: null,
      reason: errorReason(error),
    };
  }
  const expected = model.reference.trace.result;
  const step = model.alternatives.find((candidate) =>
    matchesCanonical(answer, candidate),
  );
  if (!step)
    return {
      status: "invalid-answer",
      achieved: false,
      produced: null,
      expected,
      trace: null,
    };
  const trace = replaceStep(model.reference, model.stepIndex, step);
  return {
    status: "valid",
    achieved: trace.result === expected,
    produced: trace.result,
    expected,
    trace,
  };
}
