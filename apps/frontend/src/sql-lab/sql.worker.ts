import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const ready = db.exec(`
  CREATE TABLE customers (id integer PRIMARY KEY, name text NOT NULL, city text NOT NULL);
  CREATE TABLE orders (id integer PRIMARY KEY, customer_id integer NOT NULL REFERENCES customers(id), total numeric(8,2) NOT NULL, note text);
  INSERT INTO customers VALUES (1, 'Ana Lima', 'Recife'), (2, 'Bruno Alves', 'Olinda'), (3, 'Carla Souza', 'Recife'), (4, 'Daniel Costa', 'Natal');
  INSERT INTO orders VALUES (101, 1, 59.90, 'Livros'), (102, 2, 120.00, NULL), (103, 1, 35.50, 'Caderno'), (104, 3, 89.00, NULL);
  SET default_transaction_read_only = on;
`);

self.onmessage = async (
  event: MessageEvent<{ id: number; sql: string; submit: boolean }>,
) => {
  const { id, sql, submit } = event.data;
  try {
    await ready;
    // A single SELECT in a subquery permits limiting transferred rows. This is
    // a workflow constraint, not a security boundary or a memory quota.
    const statement = sql.trim().replace(/;\s*$/, "");
    const result = await db.query(
      `SELECT * FROM (\n${statement}\n) AS student_query LIMIT 101`,
      [],
      { rowMode: "array" },
    );
    const fields = result.fields.map((field) => field.name);
    const rows = result.rows as unknown as unknown[][];
    let correct: boolean | undefined;
    if (submit) {
      const expected = await db.query(
        "SELECT * FROM customers WHERE city = 'Recife'",
        [],
        { rowMode: "array" },
      );
      const canonical = (values: unknown[][]) =>
        values.map((row) => JSON.stringify(row)).sort();
      correct =
        JSON.stringify(fields) ===
          JSON.stringify(expected.fields.map((field) => field.name)) &&
        JSON.stringify(canonical(rows)) ===
          JSON.stringify(canonical(expected.rows as unknown as unknown[][]));
    }
    self.postMessage({
      id,
      fields,
      rows: rows.slice(0, 100),
      truncated: rows.length > 100,
      correct,
    });
  } catch (error: unknown) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
