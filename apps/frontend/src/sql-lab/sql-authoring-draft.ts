import type { SqlDefinition } from "@bunkercode/content/sql";

// Recovery is idempotent: a saved unpublished draft keeps its version.
// A draft retained by publication needs a new version, but keeps its storage revision.
export function editableSqlDraft(
  definition: SqlDefinition,
  published: readonly SqlDefinition[],
): SqlDefinition {
  return {
    ...definition,
    status: "draft",
    version: Math.max(
      definition.version,
      Math.max(
        0,
        ...published
          .filter((entry) => entry.id === definition.id)
          .map((entry) => entry.version),
      ) + 1,
    ),
    ...(definition.formative ? { formative: { kind: "public-result" } } : {}),
  };
}

export function hasSavedSqlDraft(
  definition: SqlDefinition,
  drafts: readonly { definition: SqlDefinition; revision: string }[],
): boolean {
  return drafts.some(
    (entry) =>
      entry.definition.id === definition.id &&
      entry.definition.version === definition.version,
  );
}
