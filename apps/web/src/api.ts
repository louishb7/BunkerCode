import type { CreateOrderInput, LabRun, Order, PreparedRun, Product, RunDetail, SystemState } from '@backendlab/protocol';

export const lifecycleId = '001-request-lifecycle';

export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

async function getJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    const messages: Record<string, string> = {
      'Insufficient stock': 'Estoque insuficiente para criar o pedido.',
      'Product not found': 'Produto não encontrado.',
      'Quantity must be a positive integer': 'A quantidade deve ser um inteiro positivo.',
    };
    throw new ApiError(response.status, messages[body.message ?? ''] ?? `A operação retornou HTTP ${response.status}.`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  state: async (): Promise<SystemState> => {
    const [product, orders] = await Promise.all([
      getJson<Product>('/system/product'), getJson<Order[]>('/system/orders'),
    ]);
    return { product, orders };
  },
  reset: () => getJson<SystemState>('/system/reset', { method: 'POST' }),
  prepareRun: () => getJson<PreparedRun>(`/labs/${lifecycleId}/runs`, { method: 'POST' }),
  createOrder: (input: CreateOrderInput, prepared: PreparedRun) => getJson<Order>('/system/orders', {
    method: 'POST', body: JSON.stringify(input),
    headers: {
      'content-type': 'application/json',
      'x-bunkerlab-run-id': prepared.run.id,
      'x-bunkerlab-run-token': prepared.requestToken,
    },
  }),
  abandonRun: (id: string) => getJson<LabRun>(`/labs/${lifecycleId}/runs/${id}/abandon`, { method: 'POST' }),
  run: (id: string) => getJson<RunDetail>(`/labs/${lifecycleId}/runs/${id}`),
  eventsUrl: (id: string) => `/api/labs/${lifecycleId}/runs/${id}/events`,
};
