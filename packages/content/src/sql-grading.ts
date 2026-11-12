import { createPracticeEngine } from "./sql-engine";
import {
  publicSqlExercise,
  type SqlDefinition,
  type SqlDataset,
  type PublicSqlExercise,
} from "./sql";
import type { SqlResult } from "./sql-engine";
// Preserve SQL NULL versus non-finite floats, and normalize JSON object key order.
function canonicalCell(value: unknown): unknown {
  if (value === null) return ["null"];
  if (value instanceof Date) return ["date", value.toISOString()];
  if (Array.isArray(value)) return ["array", value.map(canonicalCell)];
  if (typeof value === "object")
    return [
      "object",
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalCell(item)]),
    ];
  if (["string", "boolean", "number", "bigint"].includes(typeof value))
    return [typeof value, String(value)];
  throw new Error("Tipo de valor SQL não suportado para comparação.");
}

export function equivalentResults(
  actual: SqlResult,
  expected: SqlResult,
  orderMatters = false,
): boolean {
  if (actual.truncated || expected.truncated) return false;
  const canonical = (rows: unknown[][]) => {
    const serialized = rows.map((row) =>
      JSON.stringify(row.map(canonicalCell)),
    );
    return orderMatters ? serialized : serialized.sort();
  };
  return (
    JSON.stringify(actual.fields) === JSON.stringify(expected.fields) &&
    JSON.stringify(actual.types) === JSON.stringify(expected.types) &&
    JSON.stringify(canonical(actual.rows)) ===
      JSON.stringify(canonical(expected.rows))
  );
}

export type TrustedSqlExercise = PublicSqlExercise &
  (
    | { mode: "query"; expectedQuery: string; orderMatters?: boolean }
    | { mode: "mutation"; expectedSql: string }
  );
export function assessmentExercise(
  definition: SqlDefinition,
  dataset: SqlDataset,
): TrustedSqlExercise {
  const exercise = publicSqlExercise(definition, dataset);
  return definition.mode === "query"
    ? {
        ...exercise,
        mode: "query",
        expectedQuery: definition.assessment.reference[0]!,
        orderMatters: definition.assessment.orderMatters,
      }
    : {
        ...exercise,
        mode: "mutation",
        expectedSql: definition.assessment.reference.join(";\n"),
      };
}
export async function createSqlEngine(exercise: TrustedSqlExercise) {
  const reference = await createPracticeEngine(exercise);
  let expected: SqlResult | SqlResult[];
  try {
    if (exercise.mode === "query")
      expected = await reference.execute(exercise.expectedQuery);
    else {
      for (const step of exercise.expectedSql.split(
        /;\s*(?=UPDATE|INSERT|DELETE)/i,
      ))
        await reference.execute(step);
      expected = await reference.snapshot();
    }
    if (
      (Array.isArray(expected) ? expected : [expected]).some((r) => r.truncated)
    )
      throw new Error(
        "O estado esperado excede o limite de linhas da atividade.",
      );
  } finally {
    await reference.close();
  }
  const student = await createPracticeEngine(exercise);
  return {
    ...student,
    async execute(sql: string, verify = false): Promise<SqlResult> {
      if (exercise.mode === "mutation" && verify)
        throw new Error("Verifique o estado separadamente.");
      const result = await student.execute(sql);
      return verify
        ? {
            ...result,
            correct: equivalentResults(
              result,
              expected as SqlResult,
              exercise.mode === "query" && exercise.orderMatters,
            ),
          }
        : result;
    },
    async verifyState(): Promise<SqlResult> {
      if (!Array.isArray(expected))
        throw new Error("Esta atividade verifica uma consulta.");
      const actual = await student.snapshot();
      return {
        fields: [],
        rows: [],
        truncated: false,
        correct: actual.every((r, i) => equivalentResults(r, expected[i]!)),
      };
    },
  };
}
export type SqlGradePhase =
  | "referencePgliteMs"
  | "referenceSetupMs"
  | "studentPgliteMs"
  | "studentSetupMs"
  | "referenceInitMs"
  | "referenceQueryMs"
  | "referenceCloseMs"
  | "studentInitMs"
  | "studentQueryMs"
  | "gradingMs"
  | "studentCloseMs";
export type SqlGradeObserver = (
  phase: SqlGradePhase,
  milliseconds: number,
) => void;
async function measured<T>(
  phase: SqlGradePhase,
  observer: SqlGradeObserver | undefined,
  work: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  try {
    return await work();
  } finally {
    observer?.(phase, Math.round(performance.now() - start));
  }
}
async function referenceResult(
  definition: SqlDefinition,
  dataset: SqlDataset,
  observer?: SqlGradeObserver,
): Promise<SqlResult | SqlResult[]> {
  const reference = await measured("referenceInitMs", observer, () =>
    createPracticeEngine(publicSqlExercise(definition, dataset), (phase, ms) =>
      observer?.(
        phase === "pgliteMs" ? "referencePgliteMs" : "referenceSetupMs",
        ms,
      ),
    ),
  );
  try {
    return await measured("referenceQueryMs", observer, async () => {
      let expected: SqlResult | SqlResult[];
      if (definition.mode === "query")
        expected = await reference.execute(definition.assessment.reference[0]!);
      else {
        for (const sql of definition.assessment.reference)
          await reference.execute(sql);
        expected = await reference.snapshot();
      }
      if (
        (Array.isArray(expected) ? expected : [expected]).some(
          (r) => r.truncated,
        )
      )
        throw new Error("Referência excede limites.");
      return expected;
    });
  } finally {
    await measured("referenceCloseMs", observer, () => reference.close());
  }
}
export async function gradeSql(
  definition: SqlDefinition,
  dataset: SqlDataset,
  steps: string[],
  observer?: SqlGradeObserver,
): Promise<boolean> {
  if (definition.mode === "query" && steps.length !== 1)
    throw new Error("Consulta requer um comando.");
  const expected = await referenceResult(definition, dataset, observer);
  (globalThis as { gc?: () => void }).gc?.();
  const student = await measured("studentInitMs", observer, () =>
    createPracticeEngine(publicSqlExercise(definition, dataset), (phase, ms) =>
      observer?.(
        phase === "pgliteMs" ? "studentPgliteMs" : "studentSetupMs",
        ms,
      ),
    ),
  );
  try {
    const actual = await measured("studentQueryMs", observer, async () => {
      if (definition.mode === "query") return student.execute(steps[0]!);
      for (const sql of steps) await student.execute(sql);
      return student.snapshot();
    });
    return await measured("gradingMs", observer, async () =>
      definition.mode === "query"
        ? equivalentResults(
            actual as SqlResult,
            expected as SqlResult,
            definition.assessment.orderMatters,
          )
        : (actual as SqlResult[]).every((r, i) =>
            equivalentResults(r, (expected as SqlResult[])[i]!),
          ),
    );
  } finally {
    await measured("studentCloseMs", observer, () => student.close());
  }
}
