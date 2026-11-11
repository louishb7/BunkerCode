import type { SqlExercise } from "./exercise";

export const storeExercise: SqlExercise = {
  id: "store-customers-recife",
  title: "Clientes de Recife",
  instructions:
    "Retorne todas as colunas dos clientes de Recife. A ordem das linhas não importa; mantenha as colunas id, name e city, nessa ordem.",
  starterSql: "SELECT * FROM customers;",
  setupSql: `
    CREATE TABLE customers (id integer PRIMARY KEY, name text NOT NULL, city text NOT NULL);
    CREATE TABLE orders (id integer PRIMARY KEY, customer_id integer NOT NULL REFERENCES customers(id), total numeric(8,2) NOT NULL, note text);
    INSERT INTO customers VALUES (1, 'Ana Lima', 'Recife'), (2, 'Bruno Alves', 'Olinda'), (3, 'Carla Souza', 'Recife'), (4, 'Daniel Costa', 'Natal');
    INSERT INTO orders VALUES (101, 1, 59.90, 'Livros'), (102, 2, 120.00, NULL), (103, 1, 35.50, 'Caderno'), (104, 3, 89.00, NULL);
  `,
  schema: [
    {
      name: "customers",
      columns: [
        { name: "id", type: "integer · chave primária" },
        { name: "name", type: "text" },
        { name: "city", type: "text" },
      ],
    },
    {
      name: "orders",
      columns: [
        { name: "id", type: "integer · chave primária" },
        { name: "customer_id", type: "integer" },
        { name: "total", type: "numeric(8,2)" },
        { name: "note", type: "text ou NULL" },
      ],
    },
  ],
  schemaNote:
    "As tabelas são relacionadas por orders.customer_id e customers.id.",
  expectedQuery: "SELECT * FROM customers WHERE city = 'Recife'",
  limits: { maxRows: 100, initializationMs: 60000, queryMs: 15000 },
};
