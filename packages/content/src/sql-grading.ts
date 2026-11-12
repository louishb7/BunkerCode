import { createPracticeEngine } from "./sql-engine";
import {
  publicSqlExercise,
  type SqlDefinition,
  type SqlDataset,
  type PublicSqlExercise,
  parseSqlFormativeOracle,
  sqlFormativeSource,
} from "./sql";
import type { SqlResult } from "./sql-engine";
import { canonicalResult, equivalentResults } from "./sql-comparison";
export { equivalentResults } from "./sql-comparison";
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
    createPracticeEngine(
      publicSqlExercise(definition, dataset),
      (phase, ms) =>
        phase !== "datasetMs" &&
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
    createPracticeEngine(
      publicSqlExercise(definition, dataset),
      (phase, ms) =>
        phase !== "datasetMs" &&
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

// Called only by the isolated publication runner, never by the HTTP process.
export async function generateFormativeOracle(
  definition: SqlDefinition,
  dataset: SqlDataset,
) {
  if (
    definition.mode !== "query" ||
    definition.formative?.kind !== "public-result"
  )
    throw new Error("Atividade sem autorização para resultado público.");
  const first = canonicalResult(
    (await referenceResult(definition, dataset)) as SqlResult,
    definition.assessment.orderMatters,
  );
  (globalThis as { gc?: () => void }).gc?.();
  const second = canonicalResult(
    (await referenceResult(definition, dataset)) as SqlResult,
    definition.assessment.orderMatters,
  );
  if (JSON.stringify(first) !== JSON.stringify(second))
    throw new Error("Referência formativa não determinística.");
  return parseSqlFormativeOracle({
    format: 1,
    kind: "public-result",
    sourceDigest: Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(sqlFormativeSource(definition, dataset)),
        ),
      ),
    )
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join(""),
    exercise: { id: definition.id, version: definition.version },
    dataset: definition.dataset,
    orderMatters: definition.assessment.orderMatters,
    expected: first,
  });
}
