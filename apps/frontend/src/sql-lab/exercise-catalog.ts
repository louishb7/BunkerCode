import type { SqlPlacement } from "@bunkercode/content";
import type { SqlExercise } from "./exercise";
import { updateExercise } from "./update-exercise";
import { storeExercise } from "./store-exercise";

// Trusted author definitions, never arbitrary setup SQL from Markdown or visitors.
export const sqlExercises: readonly SqlExercise[] = [
  storeExercise,
  {
    ...storeExercise,
    id: "store-select-columns",
    title: "Escolher colunas dos clientes",
    objective: "Selecionar apenas as informações necessárias de uma tabela.",
    instructions:
      "Retorne id e name de todos os clientes, nessa ordem de colunas. A ordem das linhas não importa.",
    expectedQuery: "SELECT id, name FROM customers",
  },
  {
    ...storeExercise,
    id: "store-filter-sort",
    title: "Filtrar e ordenar clientes",
    objective: "Combinar WHERE e ORDER BY para recortar e organizar registros.",
    instructions:
      "Retorne name e city dos clientes que não moram em Recife. Ordene pelo nome em ordem decrescente (Z a A).",
    expectedQuery:
      "SELECT name, city FROM customers WHERE city <> 'Recife' ORDER BY name DESC",
    orderMatters: true,
  },
  {
    ...storeExercise,
    id: "store-customer-orders",
    title: "Relacionar clientes e pedidos",
    objective:
      "Usar JOIN para identificar a pessoa responsável por cada pedido.",
    instructions:
      "Retorne name do cliente e total de cada pedido, nessa ordem de colunas. Inclua todos os pedidos; um cliente pode aparecer mais de uma vez. A ordem das linhas não importa.",
    starterSql: "SELECT * FROM orders;",
    expectedQuery:
      "SELECT c.name, o.total FROM customers c JOIN orders o ON o.customer_id = c.id",
  },
  {
    ...storeExercise,
    id: "store-order-summary",
    title: "Resumir pedidos por cliente",
    objective: "Agrupar pedidos e calcular quantidade e soma por cliente.",
    instructions:
      "Para cada customer_id com pedidos, retorne customer_id, COUNT(*) com o nome purchases e SUM(total) com o nome total. A ordem das linhas não importa.",
    starterSql: "SELECT * FROM orders;",
    expectedQuery:
      "SELECT customer_id, COUNT(*) AS purchases, SUM(total) AS total FROM orders GROUP BY customer_id",
  },
  updateExercise,
];
export function resolveSqlExercise(reference: SqlPlacement): SqlExercise {
  const exercise = sqlExercises.find(
    (item) =>
      item.id === reference.exerciseId && item.version === reference.version,
  );
  if (!exercise)
    throw new Error(
      "Atividade SQL ou versão não disponível. Revise a referência da lição.",
    );
  return exercise;
}
