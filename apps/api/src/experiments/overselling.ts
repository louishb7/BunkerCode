import type { ExperimentDefinition } from "./definition";
export const overselling: ExperimentDefinition = {
  id: "overselling",
  systemId: "orderdesk",
  summary: {
    id: "overselling",
    systemId: "orderdesk",
    name: "Disputa pelas últimas unidades",
    description:
      "Compradores simultâneos disputam um estoque limitado. O backend consegue preservar o limite?",
    defaults: { stock: 5, clients: 20, concurrency: 20 },
  },
  setup: (config) => ({ path: "/reset", body: { stock: config.stock } }),
  operation: () => ({
    path: "/orders",
    body: { productId: "keyboard", quantity: 1 },
  }),
  assert(config, initial, final, requests, evidence) {
    const minimumStock = Math.min(
      final.product.stock,
      initial.product.stock,
      ...evidence
        .filter(
          (event) =>
            event.type === "stock.written" &&
            typeof event.payload.stock === "number",
        )
        .map((event) => event.payload.stock as number),
    );
    const accepted = requests.filter(
      (request) => request.status === 201,
    ).length;
    const rejected = requests.filter(
      (request) => request.status === 409,
    ).length;
    const errors = requests.length - accepted - rejected;
    const expectedAccepted = Math.min(config.stock, config.clients);
    return {
      accepted,
      rejected,
      errors,
      finalStock: final.product.stock,
      orderCount: final.orders.length,
      assertions: [
        {
          name: "Estado inicial preparado",
          expected: { stock: config.stock, orders: 0 },
          actual: {
            stock: initial.product.stock,
            orders: initial.orders.length,
          },
          passed:
            initial.product.stock === config.stock &&
            initial.orders.length === 0,
        },
        {
          name: "stock >= 0",
          expected: ">= 0",
          actual: minimumStock,
          passed: minimumStock >= 0,
        },
        {
          name: "Pedidos aceitos",
          expected: expectedAccepted,
          actual: accepted,
          passed: accepted === expectedAccepted,
        },
        {
          name: "Pedidos rejeitados",
          expected: config.clients - expectedAccepted,
          actual: rejected,
          passed: rejected === config.clients - expectedAccepted,
        },
        {
          name: "Estoque final",
          expected: config.stock - expectedAccepted,
          actual: final.product.stock,
          passed: final.product.stock === config.stock - expectedAccepted,
        },
        {
          name: "Conservação do estoque",
          expected: config.stock,
          actual:
            final.product.stock +
            final.orders.reduce((sum, order) => sum + order.quantity, 0),
          passed:
            final.product.stock +
              final.orders.reduce((sum, order) => sum + order.quantity, 0) ===
            config.stock,
        },
        {
          name: "Pedidos persistidos correspondem às respostas",
          expected: accepted,
          actual: final.orders.length,
          passed: final.orders.length === accepted,
        },
        {
          name: "Sem erros de transporte ou servidor",
          expected: 0,
          actual: errors,
          passed: errors === 0,
        },
      ],
    };
  },
};
