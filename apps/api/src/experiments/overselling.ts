import type { OrderDeskState, ExperimentConfig } from "@backendlab/protocol";
import type { ExperimentDefinition } from "./definition";
function stock(config: ExperimentConfig) {
  return config.stock ?? 5;
}
function state(value: unknown): OrderDeskState {
  const result = value as OrderDeskState;
  if (
    !result?.product ||
    !Number.isSafeInteger(result.product.stock) ||
    !Array.isArray(result.orders) ||
    result.orders.some(
      (order) => !order || !Number.isSafeInteger(order.quantity),
    )
  )
    throw new Error("Contrato de estado inválido retornado pelo sistema.");
  return result;
}
export const overselling: ExperimentDefinition = {
  id: "overselling",
  systemId: "orderdesk",
  summary: {
    id: "overselling",
    systemId: "orderdesk",
    name: "Concorrência",
    operationLabel: "Criar pedido",
    fields: [
      { key: "clients", label: "Quantidade de requests", min: 1, max: 100 },
      { key: "concurrency", label: "Concorrência", min: 1, max: 100 },
      { key: "stock", label: "Estoque antes do teste", min: 0, max: 100 },
    ],
    description:
      "Compradores simultâneos disputam um estoque limitado. O backend consegue preservar o limite?",
    defaults: { stock: 5, clients: 20, concurrency: 20 },
  },
  statePath: "/state",
  validateState: state,
  validateInitial(config, value) {
    const initial = state(value);
    if (initial.product.stock !== stock(config) || initial.orders.length !== 0)
      throw new Error("Setup não produziu o estado inicial solicitado.");
  },
  observations(initial, result) {
    return [
      {
        key: "stock",
        label: "Estoque",
        before: state(initial).product.stock,
        value: Number(result.finalStock),
        ...(Number(result.finalStock) < 0
          ? { note: "Estoque terminou negativo." }
          : {}),
      },
      {
        key: "orders",
        label: "Pedidos persistidos",
        value: Number(result.orderCount),
      },
    ];
  },
  setup: (config) => ({ path: "/reset", body: { stock: stock(config) } }),
  operation: () => ({
    path: "/orders",
    body: { productId: "keyboard", quantity: 1 },
  }),
  assert(config, initialValue, finalValue, requests, evidence) {
    const initial = state(initialValue);
    const final = state(finalValue);
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
    const expectedAccepted = Math.min(stock(config), config.clients);
    return {
      accepted,
      rejected,
      errors,
      finalStock: final.product.stock,
      orderCount: final.orders.length,
      assertions: [
        {
          name: "Estado inicial preparado",
          expected: { stock: stock(config), orders: 0 },
          actual: {
            stock: initial.product.stock,
            orders: initial.orders.length,
          },
          passed:
            initial.product.stock === stock(config) &&
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
          expected: stock(config) - expectedAccepted,
          actual: final.product.stock,
          passed: final.product.stock === stock(config) - expectedAccepted,
        },
        {
          name: "Conservação do estoque",
          expected: stock(config),
          actual:
            final.product.stock +
            final.orders.reduce((sum, order) => sum + order.quantity, 0),
          passed:
            final.product.stock +
              final.orders.reduce((sum, order) => sum + order.quantity, 0) ===
            stock(config),
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
