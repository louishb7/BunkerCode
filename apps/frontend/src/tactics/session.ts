import {
  generateReference,
  transformProgram,
  getPublicTactic,
  evaluateAnswer,
  generateAssignmentReference,
  transformAssignmentProgram,
  getPublicAssignmentTactic,
  evaluateAssignmentAnswer,
  generateConditionalReference,
  transformConditionalProgram,
  getPublicConditionalTactic,
  evaluateConditionalAnswer,
  type Tactic,
  type PublicTactic,
  type Evaluation,
  type AssignmentTactic,
  type PublicAssignmentTactic,
  type AssignmentEvaluation,
  type ConditionalTactic,
  type PublicConditionalTactic,
  type ConditionalEvaluation,
} from "@bunkercode/tactics-core";

export type Round =
  | { family: "comparison"; model: Tactic; view: PublicTactic }
  | {
      family: "assignment";
      model: AssignmentTactic;
      view: PublicAssignmentTactic;
    }
  | {
      family: "conditional";
      model: ConditionalTactic;
      view: PublicConditionalTactic;
    };
export type Execution =
  | { family: "comparison"; value: Extract<Evaluation, { status: "valid" }> }
  | {
      family: "assignment";
      value: Extract<AssignmentEvaluation, { status: "valid" }>;
    }
  | {
      family: "conditional";
      value: Extract<ConditionalEvaluation, { status: "valid" }>;
    };

export function readSessionSeed(
  search: URLSearchParams,
): { valid: true; seed: number | null } | { valid: false } {
  const values = search.getAll("seed");
  if (values.length === 0) return { valid: true, seed: null };
  const value = values[0]!;
  if (
    values.length !== 1 ||
    !/^(0|[1-9]\d{0,9})$/.test(value) ||
    Number(value) > 0xffffffff
  )
    return { valid: false };
  return { valid: true, seed: Number(value) };
}
export function randomSessionSeed(previous?: number): number {
  const value = crypto.getRandomValues(new Uint32Array(1))[0]!;
  return value === previous ? (value + 1) >>> 0 : value;
}

/** Session v1: a six-mode cycle; odd uint32 stride gives distinct round seeds
 * until the 32-bit cycle wraps. Core generators and their PRNG remain untouched. */
export function createRound(seed: number, index: number): Round {
  if (
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 0xffffffff ||
    !Number.isSafeInteger(index) ||
    index < 0 ||
    index >= 0x100000000
  )
    throw new RangeError("Identidade de sessão inválida.");
  const roundSeed = (seed + Math.imul(index, 0x9e3779b9)) >>> 0;
  const mode = index % 6;
  if (mode === 0 || mode === 3) {
    const model = transformProgram(
      generateReference(roundSeed, 1),
      mode === 0 ? "complete-operator" : "repair-operator",
    );
    return { family: "comparison", model, view: getPublicTactic(model) };
  }
  if (mode === 1 || mode === 4) {
    const model = transformAssignmentProgram(
      generateAssignmentReference(roundSeed, 1),
      mode === 1 ? "complete-step" : "repair-step",
    );
    return {
      family: "assignment",
      model,
      view: getPublicAssignmentTactic(model),
    };
  }
  const model = transformConditionalProgram(
    generateConditionalReference(roundSeed, 1),
    mode === 2 ? "complete-condition" : "repair-condition",
  );
  return {
    family: "conditional",
    model,
    view: getPublicConditionalTactic(model),
  };
}
export function choices(round: Round): readonly string[] {
  return round.family === "assignment"
    ? round.view.alternatives.map((step) => `${step.operator} ${step.operand}`)
    : round.view.allowedOperators;
}
export function executeRound(round: Round, selection: number): Execution {
  if (
    !Number.isInteger(selection) ||
    selection < 0 ||
    selection >= choices(round).length
  )
    throw new Error("Selecione uma operação permitida.");
  if (round.family === "comparison") {
    const value = evaluateAnswer(
      round.model,
      round.view.allowedOperators[selection],
    );
    if (value.status === "valid") return { family: "comparison", value };
  } else if (round.family === "assignment") {
    const value = evaluateAssignmentAnswer(
      round.model,
      round.view.alternatives[selection],
    );
    if (value.status === "valid") return { family: "assignment", value };
  } else {
    const value = evaluateConditionalAnswer(
      round.model,
      round.view.allowedOperators[selection],
    );
    if (value.status === "valid") return { family: "conditional", value };
  }
  throw new Error(
    "Não foi possível avaliar esta rodada. Inicie uma nova sessão.",
  );
}

export interface Session {
  seed: number;
  index: number;
  round: Round;
  selection: number | null;
  result: Execution | null;
  completed: boolean;
  solved: number;
  skipped: number;
  error: string | null;
}
export type Action = { index: number; seed: number } & (
  { type: "select"; selection: number } | { type: "run" | "next" | "skip" }
);
export function startSession(seed: number): Session {
  return {
    seed,
    index: 0,
    round: createRound(seed, 0),
    selection: null,
    result: null,
    completed: false,
    solved: 0,
    skipped: 0,
    error: null,
  };
}
export function sessionReducer(state: Session, action: Action): Session {
  if (action.index !== state.index || action.seed !== state.seed) return state;
  if (action.type === "select") {
    if (
      state.completed ||
      !Number.isInteger(action.selection) ||
      action.selection < 0 ||
      action.selection >= choices(state.round).length
    )
      return state;
    return { ...state, selection: action.selection, result: null, error: null };
  }
  if (action.type === "run") {
    if (state.completed || state.selection === null) return state;
    try {
      const result = executeRound(state.round, state.selection);
      return {
        ...state,
        result,
        completed: result.value.achieved,
        solved: state.solved + (result.value.achieved ? 1 : 0),
        error: null,
      };
    } catch (error) {
      return {
        ...state,
        result: null,
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível executar a escolha.",
      };
    }
  }
  if (
    (action.type === "next" && !state.completed) ||
    (action.type === "skip" && state.completed)
  )
    return state;
  const index = state.index + 1;
  return {
    ...state,
    index,
    round: createRound(state.seed, index),
    selection: null,
    result: null,
    completed: false,
    skipped: state.skipped + (action.type === "skip" ? 1 : 0),
    error: null,
  };
}
