// Private canonical fixtures are read only by Node tests, never bundled for browsers.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { parseSqlDataset, parseSqlDefinition } from "@bunkercode/content/sql";
import {
  assessmentExercise,
  type TrustedSqlExercise,
} from "@bunkercode/content/sql-grading";
const root = fileURLToPath(new URL("../../../content/sql/", import.meta.url));
const read = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
export const dataset = parseSqlDataset(
  read(join(root, "datasets", "store", "1.json")),
);
export const sqlExercises = readdirSync(join(root, "exercises")).map((id) =>
  assessmentExercise(
    parseSqlDefinition(read(join(root, "exercises", id, "1.json"))),
    dataset,
  ),
);
export const storeExercise = sqlExercises.find(
  (e): e is Extract<TrustedSqlExercise, { mode: "query" }> =>
    e.id === "store-customers-recife" && e.mode === "query",
)!;
export const updateExercise = sqlExercises.find(
  (e): e is Extract<TrustedSqlExercise, { mode: "mutation" }> =>
    e.id === "store-update-city" && e.mode === "mutation",
)!;
export function resolveSqlExercise(ref: {
  kind?: "sql";
  exerciseId: string;
  version: number;
}) {
  const e = sqlExercises.find(
    (e) => e.id === ref.exerciseId && e.version === ref.version,
  );
  if (!e) throw new Error("Atividade SQL ou versão não disponível.");
  return e;
}
