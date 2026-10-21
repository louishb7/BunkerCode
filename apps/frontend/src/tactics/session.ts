import {
  ITERATION_PATTERNS,
  generateIterationReference,
  transformIterationProgram,
  getPublicIterationTactic,
  evaluateIterationAnswer,
  type IterationTactic,
  type PublicIterationTactic,
  type IterationEvaluation,
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
  COLLECTION_STRUCTURES,
  generateCollectionReference,
  transformCollectionProgram,
  getPublicCollectionTactic,
  evaluateCollectionAnswer,
  type CollectionTactic,
  type PublicCollectionTactic,
  type CollectionEvaluation,
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

export type PointRound =
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
export type Round =
  | { family: "iteration"; model: IterationTactic; view: PublicIterationTactic }
  | PointRound
  | {
      family: "collection";
      model: CollectionTactic;
      view: PublicCollectionTactic;
    };
export type SessionVersion = 1 | 2 | 3;
export function readSessionVersion(
  search: URLSearchParams,
): SessionVersion | null {
  const values = search.getAll("version");
  if (values.length === 0) return search.has("seed") ? 1 : 3;
  if (values.length !== 1) return null;
  return values[0] === "1"
    ? 1
    : values[0] === "2"
      ? 2
      : values[0] === "3"
        ? 3
        : null;
}
export type Execution =
  | {
      family: "iteration";
      value: Extract<IterationEvaluation, { status: "valid" }>;
    }
  | {
      family: "collection";
      value: Extract<
        CollectionEvaluation,
        { status: "valid" | "invalid-order" }
      >;
    }
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

// Stateless, bounded schedule: four shuffled triples per 12-round block.
// The block starts with a seed-dependent anchor and ends with another mechanic;
// internal permutations respect the previous boundary. No historical replay loop.
function mix(value: number): number {
  let word = value >>> 0;
  word = Math.imul(word ^ (word >>> 16), 0x21f0aaad);
  word = Math.imul(word ^ (word >>> 15), 0x735a2d97);
  return (word ^ (word >>> 15)) >>> 0;
}
function scheduleV3(
  seed: number,
  index: number,
): { interaction: number; ordinal: number } {
  const anchor = mix(seed) % 3;
  const permutations = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ];
  const block = Math.floor(index / 12);
  const slot = index % 12;
  let last = -1;
  for (let cycle = 0; cycle < 4; cycle++) {
    const pool = permutations.filter(
      (p) =>
        (cycle !== 0 || p[0] === anchor) &&
        p[0] !== last &&
        (cycle !== 3 || p[2] !== anchor),
    );
    const chosen =
      pool[
        mix(
          seed ^
            Math.imul(block, 0x9e3779b9) ^
            Math.imul(cycle + 1, 0x85ebca6b),
        ) % pool.length
      ]!;
    if (Math.floor(slot / 3) === cycle)
      return { interaction: chosen[slot % 3]!, ordinal: block * 4 + cycle };
    last = chosen[2]!;
  }
  throw new Error("Índice de distribuição inválido.");
}

/** Session v1: a six-mode cycle; odd uint32 stride gives distinct round seeds
 * until the 32-bit cycle wraps. Core generators and their PRNG remain untouched. */
export function createRound(
  seed: number,
  index: number,
  version?: 1,
): PointRound;
export function createRound(
  seed: number,
  index: number,
  version: SessionVersion,
): Round;
export function createRound(
  seed: number,
  index: number,
  version: SessionVersion = 1,
): Round {
  if (
    (version !== 1 && version !== 2 && version !== 3) ||
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 0xffffffff ||
    !Number.isSafeInteger(index) ||
    index < 0 ||
    index >= 0x100000000
  )
    throw new RangeError("Identidade de sessão inválida.");
  const roundSeed = (seed + Math.imul(index, 0x9e3779b9)) >>> 0;
  if (version === 3) {
    const { interaction, ordinal } = scheduleV3(seed, index);
    if (interaction === 2) {
      const pattern =
        ITERATION_PATTERNS[((mix(seed ^ 0x75bcd15) % 4) + ordinal) % 4]!;
      const model = transformIterationProgram(
        generateIterationReference(roundSeed, 1, pattern),
      );
      return {
        family: "iteration",
        model,
        view: getPublicIterationTactic(model),
      };
    }
    if (interaction === 1) {
      const structure =
        COLLECTION_STRUCTURES[((mix(seed ^ 0xabc98388) % 4) + ordinal) % 4]!;
      const model = transformCollectionProgram(
        generateCollectionReference(roundSeed, 1, structure),
      );
      return {
        family: "collection",
        model,
        view: getPublicCollectionTactic(model),
      };
    }
  }
  // v2 alternates structural and point interventions. Four structural variants
  // cycle with a seed-dependent rotation: no repeat in the last three order rounds.
  if (version === 2 && index % 2 === 0) {
    const structure =
      COLLECTION_STRUCTURES[((seed % 4) + Math.floor(index / 2)) % 4]!;
    const model = transformCollectionProgram(
      generateCollectionReference(roundSeed, 1, structure),
    );
    return {
      family: "collection",
      model,
      view: getPublicCollectionTactic(model),
    };
  }
  const mode =
    (version === 1
      ? index
      : version === 2
        ? Math.floor(index / 2)
        : (mix(seed ^ 0xdeadbeef) % 6) + Math.floor(index / 3)) % 6;
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
  if (round.family === "collection" || round.family === "iteration")
    throw new Error("Esta rodada utiliza organização, não alternativas.");
  return round.family === "assignment"
    ? round.view.alternatives.map((step) => `${step.operator} ${step.operand}`)
    : round.view.allowedOperators;
}
export function executeRound(
  round: Round,
  selection: number | readonly string[] | string,
): Execution {
  if (round.family === "iteration") {
    const value = evaluateIterationAnswer(round.model, selection);
    if (value.status === "valid") return { family: "iteration", value };
    throw new Error("Diagnóstico incompatível com esta rodada.");
  }
  if (round.family === "collection") {
    const value = evaluateCollectionAnswer(round.model, selection);
    if (value.status === "valid" || value.status === "invalid-order")
      return { family: "collection", value };
    throw new Error("Organização incompatível com esta rodada.");
  }
  if (
    typeof selection !== "number" ||
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
  version: SessionVersion;
  order: readonly string[] | null;
  index: number;
  round: Round;
  selection: number | null;
  suspect: string | null;
  revealed: boolean;
  result: Execution | null;
  completed: boolean;
  solved: number;
  skipped: number;
  error: string | null;
}
export type Action = {
  index: number;
  seed: number;
  version?: SessionVersion;
} & (
  | { type: "select"; selection: number }
  | { type: "suspect"; instructionId: string }
  | { type: "move"; blockId: string; direction: -1 | 1 }
  | { type: "run" | "next" | "skip" }
);
export function startSession(
  seed: number,
  version: SessionVersion = 1,
): Session {
  const round = createRound(seed, 0, version);
  return {
    version,
    order:
      round.family === "collection"
        ? round.view.blocks.map((block) => block.id)
        : null,
    seed,
    index: 0,
    round,
    selection: null,
    suspect: null,
    revealed: false,
    result: null,
    completed: false,
    solved: 0,
    skipped: 0,
    error: null,
  };
}
export function sessionReducer(state: Session, action: Action): Session {
  if (
    action.index !== state.index ||
    action.seed !== state.seed ||
    (action.version ?? 1) !== state.version
  )
    return state;
  if (action.type === "suspect") {
    if (
      state.completed ||
      state.revealed ||
      state.round.family !== "iteration" ||
      !state.round.view.instructionIds.includes(action.instructionId)
    )
      return state;
    return {
      ...state,
      suspect: action.instructionId,
      result: null,
      error: null,
    };
  }
  if (action.type === "move") {
    if (
      state.completed ||
      !state.order ||
      (action.direction !== -1 && action.direction !== 1)
    )
      return state;
    const index = state.order.indexOf(action.blockId);
    const target = index + action.direction;
    if (index < 0 || target < 0 || target >= state.order.length) return state;
    const order = [...state.order];
    [order[index], order[target]] = [order[target]!, order[index]!];
    return { ...state, order, result: null, error: null };
  }
  if (action.type === "select") {
    if (
      state.completed ||
      state.round.family === "collection" ||
      state.round.family === "iteration" ||
      !Number.isInteger(action.selection) ||
      action.selection < 0 ||
      action.selection >= choices(state.round).length
    )
      return state;
    return { ...state, selection: action.selection, result: null, error: null };
  }
  if (action.type === "run") {
    const answer =
      state.round.family === "iteration"
        ? state.suspect
        : (state.order ?? state.selection);
    if (state.completed || state.revealed || answer === null) return state;
    try {
      const result = executeRound(state.round, answer);
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
    action.type === "skip" &&
    state.round.family === "iteration" &&
    !state.completed &&
    !state.revealed
  ) {
    return { ...state, revealed: true, skipped: state.skipped + 1 };
  }
  if (
    (action.type === "next" && !state.completed && !state.revealed) ||
    (action.type === "skip" && (state.completed || state.revealed))
  )
    return state;
  const index = state.index + 1;
  const round = createRound(state.seed, index, state.version);
  return {
    ...state,
    index,
    round,
    order:
      round.family === "collection"
        ? round.view.blocks.map((block) => block.id)
        : null,
    selection: null,
    suspect: null,
    revealed: false,
    result: null,
    completed: false,
    skipped:
      state.skipped + (action.type === "skip" && !state.revealed ? 1 : 0),
    error: null,
  };
}
