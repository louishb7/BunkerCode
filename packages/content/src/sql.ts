export type SqlCell = string | number | boolean | null;
export interface SqlDataset {
  format: 1;
  id: string;
  version: number;
  title: string;
  tables: {
    name: string;
    columns: {
      name: string;
      type: "integer" | "text" | "numeric(8,2)" | "boolean";
      nullable: boolean;
      primaryKey: boolean;
      references: { table: string; column: string } | null;
    }[];
    rows: SqlCell[][];
  }[];
}
export interface SqlDefinition {
  format: 1;
  id: string;
  version: number;
  status: "draft" | "published";
  title: string;
  objective: string;
  instructions: string;
  starterSql: string;
  mode: "query" | "mutation";
  dataset: { id: string; version: number };
  assessment: { reference: string[]; orderMatters: boolean };
}
export interface PublicSqlExercise {
  id: string;
  version: number;
  title: string;
  objective: string;
  instructions: string;
  starterSql: string;
  mode: "query" | "mutation";
  dataset: { id: string; version: number };
  setupSql: string;
  schemaNote: string;
  schema: {
    name: string;
    columns: {
      name: string;
      type: string;
      primaryKey?: boolean;
      references?: string;
    }[];
  }[];
  limits: { maxRows: number; initializationMs: number; queryMs: number };
}
export const SQL_LIMITS = {
  maxRows: 100,
  initializationMs: 60000,
  queryMs: 5000,
  steps: 20,
  sqlBytes: 16384,
  datasetBytes: 131072,
} as const;
function fail(message: string): never {
  throw new Error(message);
}
export function sqlObject(
  value: unknown,
  keys?: string[],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail("Objeto SQL inválido.");
  const object = value as Record<string, unknown>;
  if (keys) fields(object, keys);
  return object;
}
function fields(value: Record<string, unknown>, keys: string[]) {
  if (
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    fail("Campos SQL desconhecidos ou ausentes.");
}
function text(value: unknown, max: number, empty = false): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (!empty && !value.trim()) ||
    value.includes("\0")
  )
    fail("Texto SQL vazio, inválido ou excessivo.");
  return value;
}
export function sqlId(value: unknown): string {
  const id = text(value, 80);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))
    fail("Identificador SQL inválido.");
  return id;
}
export function sqlVersion(value: unknown): number {
  if (
    !Number.isSafeInteger(value) ||
    Number(value) < 1 ||
    Number(value) > 1000000
  )
    fail("Versão SQL inválida.");
  return Number(value);
}
function identifier(value: unknown): string {
  const name = text(value, 63);
  if (!/^[a-z][a-z0-9_]*$/.test(name)) fail("Nome de tabela/coluna inválido.");
  return name;
}
function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") fail("Booleano SQL inválido.");
  return value;
}
export function parseSqlDataset(value: unknown): SqlDataset {
  const d = sqlObject(value);
  fields(d, ["format", "id", "version", "title", "tables"]);
  if (
    d.format !== 1 ||
    !Array.isArray(d.tables) ||
    !d.tables.length ||
    d.tables.length > 8 ||
    new TextEncoder().encode(JSON.stringify(value)).length >
      SQL_LIMITS.datasetBytes
  )
    fail("Dataset SQL excede o formato/limites.");
  const tables = d.tables.map((item) => {
    const t = sqlObject(item);
    fields(t, ["name", "columns", "rows"]);
    if (
      !Array.isArray(t.columns) ||
      !t.columns.length ||
      t.columns.length > 16 ||
      !Array.isArray(t.rows) ||
      t.rows.length > 100
    )
      fail("Tabela SQL inválida ou excessiva.");
    const columns = t.columns.map((item) => {
      const c = sqlObject(item);
      fields(c, ["name", "type", "nullable", "primaryKey", "references"]);
      if (
        !["integer", "text", "numeric(8,2)", "boolean"].includes(String(c.type))
      )
        fail("Tipo SQL não suportado.");
      let references = null;
      if (c.references !== null) {
        const r = sqlObject(c.references);
        fields(r, ["table", "column"]);
        references = {
          table: identifier(r.table),
          column: identifier(r.column),
        };
      }
      return {
        name: identifier(c.name),
        type: c.type as SqlDataset["tables"][number]["columns"][number]["type"],
        nullable: boolean(c.nullable),
        primaryKey: boolean(c.primaryKey),
        references,
      };
    });
    if (
      new Set(columns.map((c) => c.name)).size !== columns.length ||
      columns.filter((c) => c.primaryKey).length > 1 ||
      columns.some((c) => c.primaryKey && c.nullable)
    )
      fail("Colunas/chave primária inválidas.");
    const rows = t.rows.map((row) => {
      if (!Array.isArray(row) || row.length !== columns.length)
        fail("Linha SQL inválida.");
      return row.map((v: unknown, index: number): SqlCell => {
        const c = columns[index]!;
        if (v === null) {
          if (!c.nullable) fail("NULL em coluna obrigatória.");
          return null;
        }
        if (c.type === "text") return text(v, 2000, true);
        if (c.type === "boolean") return boolean(v);
        if (
          typeof v !== "number" ||
          !Number.isFinite(v) ||
          (c.type === "integer" &&
            (!Number.isSafeInteger(v) || v < -2147483648 || v > 2147483647)) ||
          (c.type === "numeric(8,2)" &&
            (Math.abs(v) > 999999.99 ||
              Math.abs(v * 100 - Math.round(v * 100)) > 0.00001))
        )
          fail("Valor incompatível com tipo SQL.");
        return v;
      });
    });
    const pk = columns.findIndex((c) => c.primaryKey);
    if (
      pk >= 0 &&
      new Set(rows.map((row) => JSON.stringify(row[pk]))).size !== rows.length
    )
      fail("Chave primária duplicada.");
    return { name: identifier(t.name), columns, rows };
  });
  if (new Set(tables.map((t) => t.name)).size !== tables.length)
    fail("Tabela SQL duplicada.");
  for (const table of tables)
    for (const c of table.columns)
      if (c.references) {
        const target = tables.find((t) => t.name === c.references!.table);
        const targetColumn = target?.columns.find(
          (x) => x.name === c.references!.column,
        );
        if (
          !target ||
          !targetColumn?.primaryKey ||
          targetColumn.type !== c.type
        )
          fail("Referência SQL inválida.");
        for (const row of table.rows) {
          const value = row[table.columns.indexOf(c)];
          if (
            value !== null &&
            !target.rows.some(
              (r) => r[target.columns.indexOf(targetColumn)] === value,
            )
          )
            fail("Linha viola referência SQL.");
        }
      }
  return {
    format: 1,
    id: sqlId(d.id),
    version: sqlVersion(d.version),
    title: text(d.title, 160),
    tables,
  };
}
export function parseSqlDefinition(value: unknown): SqlDefinition {
  const d = sqlObject(value);
  fields(d, [
    "format",
    "id",
    "version",
    "status",
    "title",
    "objective",
    "instructions",
    "starterSql",
    "mode",
    "dataset",
    "assessment",
  ]);
  if (
    d.format !== 1 ||
    (d.status !== "draft" && d.status !== "published") ||
    (d.mode !== "query" && d.mode !== "mutation")
  )
    fail("Formato, estado ou modo SQL inválido.");
  const dataset = sqlObject(d.dataset);
  fields(dataset, ["id", "version"]);
  const a = sqlObject(d.assessment);
  fields(a, ["reference", "orderMatters"]);
  const reference = parseSqlSteps(a.reference);
  if (d.mode === "query" && reference.length !== 1)
    fail("Consulta requer uma única referência.");
  return {
    format: 1,
    id: sqlId(d.id),
    version: sqlVersion(d.version),
    status: d.status,
    title: text(d.title, 160),
    objective: text(d.objective, 1000),
    instructions: text(d.instructions, 8000),
    starterSql: text(d.starterSql, SQL_LIMITS.sqlBytes, true),
    mode: d.mode,
    dataset: { id: sqlId(dataset.id), version: sqlVersion(dataset.version) },
    assessment: { reference, orderMatters: boolean(a.orderMatters) },
  };
}
export function parseSqlSteps(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.length > SQL_LIMITS.steps)
    fail("Envie de 1 a 20 comandos SQL.");
  const steps = value.map((item) => text(item, SQL_LIMITS.sqlBytes));
  if (
    steps.reduce((n, s) => n + new TextEncoder().encode(s).length, 0) >
    SQL_LIMITS.sqlBytes
  )
    fail("SQL enviado excede 16 KiB.");
  return steps;
}
const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"';
export function datasetSql(dataset: SqlDataset): string {
  const create = dataset.tables.map(
    (t) =>
      `CREATE TABLE ${quote(t.name)} (${t.columns.map((c) => `${quote(c.name)} ${c.type}${c.nullable ? "" : " NOT NULL"}${c.primaryKey ? " PRIMARY KEY" : ""}`).join(", ")});`,
  );
  const insert = dataset.tables
    .filter((t) => t.rows.length)
    .map(
      (t) =>
        `INSERT INTO ${quote(t.name)} VALUES ${t.rows.map((row) => "(" + row.map((v) => (v === null ? "NULL" : typeof v === "string" ? "'" + v.replaceAll("'", "''") + "'" : String(v))).join(",") + ")").join(",")};`,
    );
  const references = dataset.tables.flatMap((t) =>
    t.columns
      .filter((c) => c.references)
      .map(
        (c) =>
          `ALTER TABLE ${quote(t.name)} ADD FOREIGN KEY (${quote(c.name)}) REFERENCES ${quote(c.references!.table)} (${quote(c.references!.column)});`,
      ),
  );
  return [...create, ...insert, ...references].join("\n");
}
export function publicSqlExercise(
  definition: SqlDefinition,
  dataset: SqlDataset,
): PublicSqlExercise {
  if (
    definition.dataset.id !== dataset.id ||
    definition.dataset.version !== dataset.version
  )
    fail("Dataset não corresponde à atividade.");
  return {
    id: definition.id,
    version: definition.version,
    title: definition.title,
    objective: definition.objective,
    instructions: definition.instructions,
    starterSql: definition.starterSql,
    mode: definition.mode,
    dataset: { id: dataset.id, version: dataset.version },
    setupSql: datasetSql(dataset),
    schema: dataset.tables.map((t) => ({
      name: t.name,
      columns: t.columns.map((c) => ({
        name: c.name,
        type: c.type,
        primaryKey: c.primaryKey,
        ...(c.references
          ? { references: c.references.table + "." + c.references.column }
          : {}),
      })),
    })),
    schemaNote: dataset.title,
    limits: { maxRows: 100, initializationMs: 60000, queryMs: 5000 },
  };
}
export function parsePublicSqlExercise(value: unknown): PublicSqlExercise {
  const p = sqlObject(value);
  fields(p, [
    "id",
    "version",
    "title",
    "objective",
    "instructions",
    "starterSql",
    "mode",
    "dataset",
    "setupSql",
    "schema",
    "schemaNote",
    "limits",
  ]);
  if (p.mode !== "query" && p.mode !== "mutation")
    fail("Modo público inválido.");
  // Public content is constructed only by the trusted projection. Reject extra
  // fields recursively instead of trusting TypeScript erasure for privacy.
  const dataset = sqlObject(p.dataset);
  fields(dataset, ["id", "version"]);
  const limits = sqlObject(p.limits);
  fields(limits, ["maxRows", "initializationMs", "queryMs"]);
  if (
    limits.maxRows !== 100 ||
    limits.initializationMs !== 60000 ||
    limits.queryMs !== 5000 ||
    !Array.isArray(p.schema) ||
    !p.schema.length ||
    p.schema.length > 8
  )
    fail("Limites/schema públicos inválidos.");
  const schema = p.schema.map((item) => {
    const t = sqlObject(item);
    fields(t, ["name", "columns"]);
    if (!Array.isArray(t.columns) || !t.columns.length || t.columns.length > 16)
      fail("Colunas públicas inválidas.");
    return {
      name: identifier(t.name),
      columns: t.columns.map((item) => {
        const c = sqlObject(item);
        const keys =
          c.references === undefined
            ? ["name", "type", "primaryKey"]
            : ["name", "type", "primaryKey", "references"];
        fields(c, keys);
        return {
          name: identifier(c.name),
          type: text(c.type, 80),
          primaryKey: boolean(c.primaryKey),
          ...(c.references === undefined
            ? {}
            : { references: text(c.references, 130) }),
        };
      }),
    };
  });
  return {
    id: sqlId(p.id),
    version: sqlVersion(p.version),
    title: text(p.title, 160),
    objective: text(p.objective, 1000),
    instructions: text(p.instructions, 8000),
    starterSql: text(p.starterSql, SQL_LIMITS.sqlBytes, true),
    mode: p.mode,
    dataset: { id: sqlId(dataset.id), version: sqlVersion(dataset.version) },
    setupSql: text(p.setupSql, 200000),
    schema,
    schemaNote: text(p.schemaNote, 1000),
    limits: { maxRows: 100, initializationMs: 60000, queryMs: 5000 },
  };
}
