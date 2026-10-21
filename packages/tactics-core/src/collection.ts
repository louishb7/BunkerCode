import { nextRandom } from "./random";
import {
  readSeed,
  readVersion,
  record,
  requireCanonical,
  errorReason,
} from "./validation";
import type { Validation } from "./comparison";

export const COLLECTION_GENERATOR_VERSION = 1;
export const COLLECTION_STRUCTURES = Object.freeze([
  "filter-map-join",
  "find-fallback-uppercase",
  "filter-map-reverse-join",
  "declare-find-fallback-uppercase",
] as const);
export type CollectionStructure = (typeof COLLECTION_STRUCTURES)[number];
export interface CollectionUser {
  readonly name: string;
  readonly active: boolean;
}
type Operation =
  | "filter"
  | "map"
  | "reverse"
  | "join"
  | "target"
  | "fallback"
  | "find"
  | "resolve"
  | "uppercase";
export interface CollectionBlock {
  readonly id: Operation;
  readonly code: string;
  readonly requires: readonly string[];
  readonly declares: string | null;
}
export type CollectionValue =
  | string
  | readonly string[]
  | readonly CollectionUser[]
  | CollectionUser
  | null;
export interface CollectionTrace {
  readonly blockId: string;
  readonly code: string;
  readonly value: CollectionValue;
}
export interface CollectionProgram {
  readonly family: "collection-flow";
  readonly generatorVersion: typeof COLLECTION_GENERATOR_VERSION;
  readonly seed: number;
  readonly structure: CollectionStructure;
  readonly pattern: "select-transform" | "find-fallback";
  readonly users: readonly CollectionUser[];
  readonly active: boolean;
  readonly target: string;
  readonly fallback: string;
  readonly separator: string;
  readonly prelude: string;
  readonly blocks: readonly CollectionBlock[];
  readonly expectedResult: string;
  readonly code: string;
}
export interface CollectionIdentity {
  readonly family: "collection-flow";
  readonly generatorVersion: typeof COLLECTION_GENERATOR_VERSION;
  readonly seed: number;
  readonly structure: CollectionStructure;
  readonly kind: "order-program";
}
export interface CollectionTactic {
  readonly identity: CollectionIdentity;
  readonly reference: CollectionProgram;
  readonly initialOrder: readonly string[];
}
export interface PublicCollectionTactic {
  readonly identity: CollectionIdentity;
  readonly pattern: CollectionProgram["pattern"];
  readonly prelude: string;
  readonly blocks: readonly CollectionBlock[];
  readonly objective: string;
  readonly expectedResult: string;
}
export type CollectionEvaluation =
  | {
      readonly status: "valid";
      readonly achieved: boolean;
      readonly produced: string;
      readonly expected: string;
      readonly trace: readonly CollectionTrace[];
    }
  | {
      readonly status: "invalid-order";
      readonly achieved: false;
      readonly produced: null;
      readonly expected: string;
      readonly trace: readonly CollectionTrace[];
      readonly blockId: string;
      readonly missing: readonly string[];
    }
  | {
      readonly status: "invalid-answer";
      readonly achieved: false;
      readonly produced: null;
      readonly expected: string;
      readonly trace: readonly [];
    }
  | {
      readonly status: "invalid-tactic";
      readonly achieved: false;
      readonly produced: null;
      readonly expected: null;
      readonly trace: readonly [];
      readonly reason: string;
    };

function readStructure(value: unknown): CollectionStructure {
  const structure = COLLECTION_STRUCTURES.find((item) => item === value);
  if (!structure) throw new TypeError("Estrutura de coleção inválida.");
  return structure;
}

export function generateCollectionReference(
  seed: unknown,
  generatorVersion: unknown = COLLECTION_GENERATOR_VERSION,
  structure?: unknown,
): CollectionProgram {
  const validatedSeed = readSeed(seed);
  readVersion(generatorVersion, COLLECTION_GENERATOR_VERSION);
  let state = validatedSeed;
  const draw = (size: number) => {
    const [next, word] = nextRandom(state);
    state = next;
    return word % size;
  };
  const generated = COLLECTION_STRUCTURES[draw(4)]!;
  const chosen = structure === undefined ? generated : readStructure(structure);
  const pool = [
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
  for (let i = pool.length - 1; i > 0; i--) {
    const other = draw(i + 1);
    [pool[i], pool[other]] = [pool[other]!, pool[i]!];
  }
  const count = 3 + draw(3);
  const active = draw(2) === 1;
  const users = Array.from({ length: count }, (_, i) =>
    Object.freeze({
      name: pool[i]!,
      active: i < 2 ? active : i === 2 ? !active : draw(2) === 1,
    }),
  );
  for (let i = users.length - 1; i > 0; i--) {
    const other = draw(i + 1);
    [users[i], users[other]] = [users[other]!, users[i]!];
  }
  const target = draw(2) === 1 ? users[draw(count)]!.name : pool[count]!;
  const fallback = ["Não encontrado", "Sem cadastro", "Ausente"][draw(3)]!;
  const separator = [", ", " / ", " · "][draw(3)]!;
  const pattern = chosen.startsWith("filter-")
    ? "select-transform"
    : "find-fallback";
  const blocks: CollectionBlock[] = [];
  const add = (
    id: Operation,
    code: string,
    requires: string[],
    declares: string | null,
  ) =>
    blocks.push(
      Object.freeze({ id, code, requires: Object.freeze(requires), declares }),
    );
  const literal = JSON.stringify;
  if (pattern === "select-transform") {
    add(
      "filter",
      `const selected = users.filter(user => ${active ? "user.active" : "!user.active"});`,
      ["users"],
      "selected",
    );
    add(
      "map",
      "const names = selected.map(user => user.name);",
      ["selected"],
      "names",
    );
    if (chosen === "filter-map-reverse-join")
      add("reverse", "names.reverse();", ["names"], null);
    add(
      "join",
      `const result = names.join(${literal(separator)});`,
      ["names"],
      "result",
    );
  } else {
    const declarations = chosen === "declare-find-fallback-uppercase";
    if (declarations) {
      add("target", `const target = ${literal(target)};`, [], "target");
      add("fallback", `const fallback = ${literal(fallback)};`, [], "fallback");
    }
    add(
      "find",
      `const found = users.find(user => user.name === ${declarations ? "target" : literal(target)});`,
      declarations ? ["users", "target"] : ["users"],
      "found",
    );
    add(
      "resolve",
      `const name = found ? found.name : ${declarations ? "fallback" : literal(fallback)};`,
      declarations ? ["found", "fallback"] : ["found"],
      "name",
    );
    add("uppercase", "const result = name.toUpperCase();", ["name"], "result");
  }
  const selected = users
    .filter((user) => user.active === active)
    .map((user) => user.name);
  const expectedResult =
    pattern === "select-transform"
      ? (chosen === "filter-map-reverse-join"
          ? selected.reverse()
          : selected
        ).join(separator)
      : (
          users.find((user) => user.name === target)?.name ?? fallback
        ).toUpperCase();
  const prelude = `const users = [\n${users.map((user) => `  { name: ${literal(user.name)}, active: ${user.active} }`).join(",\n")}\n];`;
  return Object.freeze({
    family: "collection-flow",
    generatorVersion: COLLECTION_GENERATOR_VERSION,
    seed: validatedSeed,
    structure: chosen,
    pattern,
    users: Object.freeze(users),
    active,
    target,
    fallback,
    separator,
    prelude,
    blocks: Object.freeze(blocks),
    expectedResult,
    code: `${prelude}\n\n${blocks.map((block) => block.code).join("\n")}\n`,
  });
}

function readProgram(value: unknown): CollectionProgram {
  const item = record(value);
  return requireCanonical(
    value,
    generateCollectionReference(
      item.seed,
      item.generatorVersion,
      readStructure(item.structure),
    ),
  );
}
function makeTactic(reference: CollectionProgram): CollectionTactic {
  const initialOrder = reference.blocks.map((block) => block.id);
  let state = (reference.seed ^ 0x67be91d3) >>> 0;
  for (let i = initialOrder.length - 1; i > 0; i--) {
    const [next, word] = nextRandom(state);
    state = next;
    const other = word % (i + 1);
    [initialOrder[i], initialOrder[other]] = [
      initialOrder[other]!,
      initialOrder[i]!,
    ];
  }
  // A shuffle can be a different but semantically correct topological order.
  // Put the consumer before its prerequisite to guarantee a genuine challenge.
  const ordered = initialOrder.map((id) =>
    reference.blocks.find((block) => block.id === id)!,
  );
  if (evaluateOrder(reference, ordered).achieved) {
    const consumer = reference.blocks.find((block) =>
      block.requires.some((name) => name !== "users"),
    )!;
    initialOrder.splice(initialOrder.indexOf(consumer.id), 1);
    initialOrder.unshift(consumer.id);
  }
  return Object.freeze({
    identity: Object.freeze({
      family: reference.family,
      generatorVersion: reference.generatorVersion,
      seed: reference.seed,
      structure: reference.structure,
      kind: "order-program",
    }),
    reference,
    initialOrder: Object.freeze(initialOrder),
  });
}
export function transformCollectionProgram(
  program: CollectionProgram,
  kind: unknown = "order-program",
): CollectionTactic {
  if (kind !== "order-program")
    throw new TypeError("Modalidade de coleção inválida.");
  return makeTactic(readProgram(program));
}
function readTactic(value: unknown): CollectionTactic {
  const item = record(value);
  return requireCanonical(value, makeTactic(readProgram(item.reference)));
}
export function verifyCollectionTactic(value: unknown): Validation {
  try {
    readTactic(value);
    return { valid: true };
  } catch (error) {
    return { valid: false, reason: errorReason(error) };
  }
}
export function getPublicCollectionTactic(
  value: CollectionTactic,
): PublicCollectionTactic {
  const model = readTactic(value);
  const reference = model.reference;
  return Object.freeze({
    identity: model.identity,
    pattern: reference.pattern,
    prelude: reference.prelude,
    blocks: Object.freeze(
      model.initialOrder.map((id) =>
        reference.blocks.find((block) => block.id === id)!,
      ),
    ),
    objective:
      reference.pattern === "select-transform"
        ? `Organize o programa para listar as pessoas ${reference.active ? "ativas" : "inativas"}${reference.structure === "filter-map-reverse-join" ? " em ordem inversa" : ""} e obter ${JSON.stringify(reference.expectedResult)}.`
        : `Organize a busca por ${JSON.stringify(reference.target)} para obter ${JSON.stringify(reference.expectedResult)}.`,
    expectedResult: reference.expectedResult,
  });
}

/** A finite collection data-flow evaluator. It never parses or executes source. */
function evaluateOrder(
  program: CollectionProgram,
  blocks: readonly CollectionBlock[],
): Extract<CollectionEvaluation, { status: "valid" | "invalid-order" }> {
  const defined = new Set(["users"]);
  const trace: CollectionTrace[] = [];
  let selected: readonly CollectionUser[] = [];
  let names: readonly string[] = [];
  let found: CollectionUser | null = null;
  let name = "";
  let result = "";
  for (const block of blocks) {
    const missing = block.requires.filter((binding) => {
      // The ternary reads fallback only when find returned no record.
      if (block.id === "resolve" && binding === "fallback" && found !== null)
        return false;
      return !defined.has(binding);
    });
    if (missing.length > 0)
      return {
        status: "invalid-order",
        achieved: false,
        produced: null,
        expected: program.expectedResult,
        trace: Object.freeze(trace),
        blockId: block.id,
        missing: Object.freeze(missing),
      };
    let value: CollectionValue;
    switch (block.id) {
      case "filter":
        selected = Object.freeze(
          program.users.filter((user) => user.active === program.active),
        );
        value = selected;
        break;
      case "map":
        names = Object.freeze(selected.map((user) => user.name));
        value = names;
        break;
      case "reverse":
        names = Object.freeze([...names].reverse());
        value = names;
        break;
      case "join":
        result = names.join(program.separator);
        value = result;
        break;
      case "target":
        value = program.target;
        break;
      case "fallback":
        value = program.fallback;
        break;
      case "find":
        found =
          program.users.find((user) => user.name === program.target) ?? null;
        value = found;
        break;
      case "resolve":
        name = found?.name ?? program.fallback;
        value = name;
        break;
      case "uppercase":
        result = name.toUpperCase();
        value = result;
        break;
    }
    if (block.declares) defined.add(block.declares);
    trace.push(Object.freeze({ blockId: block.id, code: block.code, value }));
  }
  return {
    status: "valid",
    achieved: result === program.expectedResult,
    produced: result,
    expected: program.expectedResult,
    trace: Object.freeze(trace),
  };
}
export function evaluateCollectionAnswer(
  tactic: unknown,
  answer: unknown,
): CollectionEvaluation {
  let model: CollectionTactic;
  try {
    model = readTactic(tactic);
  } catch (error) {
    return {
      status: "invalid-tactic",
      achieved: false,
      produced: null,
      expected: null,
      trace: [],
      reason: errorReason(error),
    };
  }
  const blocks = model.reference.blocks;
  if (
    !Array.isArray(answer) ||
    answer.length !== blocks.length ||
    Object.keys(answer).length !== blocks.length ||
    !blocks.every((_block, index) => Object.hasOwn(answer, index)) ||
    !answer.every(
      (id: unknown) =>
        typeof id === "string" && blocks.some((block) => block.id === id),
    ) ||
    new Set(answer).size !== blocks.length
  )
    return {
      status: "invalid-answer",
      achieved: false,
      produced: null,
      expected: model.reference.expectedResult,
      trace: [],
    };
  return evaluateOrder(
    model.reference,
    answer.map((id: unknown) => blocks.find((block) => block.id === id)!),
  );
}
