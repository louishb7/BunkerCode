import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { NestFactory, type INestApplication } from '@nestjs/core';
import type { LabEvent, Order, PreparedRun, Product, RunDetail, SystemState } from '@backendlab/protocol';
import { AppModule } from '../src/app.module';
import { RunsService } from '../src/runs.service';

const labId = '001-request-lifecycle';
const input = { productId: 'mechanical-keyboard', quantity: 1 };
let app: INestApplication;
let baseUrl: string;

before(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
  app.get(RunsService).setApiPort(address.port);
});
after(async () => { await app.close(); });
beforeEach(async () => { await fetch(`${baseUrl}/system/reset`, { method: 'POST' }); });

async function product(): Promise<Product> { return (await fetch(`${baseUrl}/system/product`)).json() as Promise<Product>; }
async function orders(): Promise<Order[]> { return (await fetch(`${baseUrl}/system/orders`)).json() as Promise<Order[]>; }
async function prepare(): Promise<PreparedRun> {
  return (await fetch(`${baseUrl}/labs/${labId}/runs`, { method: 'POST' })).json() as Promise<PreparedRun>;
}
function createOrder(body: unknown = input, prepared?: PreparedRun): Promise<Response> {
  return fetch(`${baseUrl}/system/orders`, {
    method: 'POST', body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      ...(prepared ? { 'x-bunkerlab-run-id': prepared.run.id, 'x-bunkerlab-run-token': prepared.requestToken } : {}),
    },
  });
}
async function detail(runId: string): Promise<RunDetail> {
  return (await fetch(`${baseUrl}/labs/${labId}/runs/${runId}`)).json() as Promise<RunDetail>;
}

const successOrder = [
  'run.started', 'request.received', 'controller.entered', 'service.entered',
  'order.created', 'stock.updated', 'service.completed', 'controller.completed', 'response.sent', 'run.completed',
];

test('the system starts with one product and no orders', async () => {
  assert.deepEqual(await product(), { id: input.productId, name: 'Mechanical Keyboard', stock: 3 });
  assert.deepEqual(await orders(), []);
});

test('a real POST creates an order, decrements stock and returns a correlated run', async () => {
  const response = await createOrder();
  assert.equal(response.status, 201);
  const order = await response.json() as Order;
  assert.equal(order.productId, input.productId);
  assert.equal(order.quantity, 1);
  assert.ok(order.id && Number.isInteger(order.createdAt));
  assert.equal((await product()).stock, 2);
  assert.deepEqual(await orders(), [order]);
  const runId = response.headers.get('x-bunkerlab-run-id')!;
  const snapshot = await detail(runId);
  assert.equal(snapshot.run.status, 'completed');
  assert.equal(snapshot.run.httpStatus, 201);
  assert.equal(snapshot.run.action, 'create-order');
  assert.deepEqual(snapshot.events.map((event) => event.type), successOrder);
  assert.deepEqual(snapshot.events.find((event) => event.type === 'order.created')?.payload?.order, order);
  assert.deepEqual(snapshot.events.find((event) => event.type === 'stock.updated')?.payload,
    { productId: input.productId, previousStock: 3, stock: 2, quantity: 1 });
});

test('SSE opened before the domain request transports real lifecycle events and supports replay', async () => {
  const prepared = await prepare();
  assert.equal(prepared.run.status, 'pending');
  const stream = await fetch(`${baseUrl}/labs/${labId}/runs/${prepared.run.id}/events`, { signal: AbortSignal.timeout(5000) });
  assert.equal(stream.status, 200);
  assert.match(stream.headers.get('content-type') ?? '', /text\/event-stream/);
  const created = await createOrder(input, prepared);
  assert.equal(created.status, 201);
  assert.equal(created.headers.get('x-bunkerlab-run-id'), prepared.run.id);
  const streamed = (await stream.text()).split('\n').filter((line) => line.startsWith('data: ')).map((line) => JSON.parse(line.slice(6)) as LabEvent);
  const { run, events, runtime } = await detail(prepared.run.id);
  assert.deepEqual(streamed, events);
  assert.deepEqual(events.map((event) => event.type), successOrder);
  assert.equal(run.eventCount, events.length);
  assert.ok(events.every((event) => event.runId === run.id && event.labId === labId));
  assert.equal(new Set(events.map((event) => event.id)).size, events.length);
  assert.ok(events.every((event, index) => Number.isInteger(event.timestamp)
    && event.timestamp >= run.startedAt!
    && (index === 0 || event.timestamp >= events[index - 1]!.timestamp)));
  assert.equal(run.durationMs, run.completedAt! - run.startedAt!);
  assert.ok(run.durationMs! >= 0);
  const request = events.find((event) => event.type === 'request.received')!;
  assert.equal(request.payload?.method, 'POST');
  assert.equal(request.payload?.path, '/system/orders');
  assert.equal(request.payload?.destination, baseUrl);
  assert.equal(events.find((event) => event.type === 'response.sent')?.payload?.statusCode, 201);
  assert.equal(events.find((event) => event.type === 'controller.entered')?.payload?.handler, 'OrdersController.create()');
  assert.equal(events.find((event) => event.type === 'service.entered')?.payload?.operation, 'OrdersService.create()');
  assert.deepEqual(runtime, { engine: 'Node.js', nodeVersion: process.version, pid: process.pid, apiPort: Number(new URL(baseUrl).port) });
  assert.ok(!JSON.stringify(events).includes(prepared.requestToken));
  const replay = await fetch(`${baseUrl}/labs/${labId}/runs/${run.id}/events`, { signal: AbortSignal.timeout(5000) });
  const replayed = (await replay.text()).split('\n').filter((line) => line.startsWith('data: ')).map((line) => JSON.parse(line.slice(6)) as LabEvent);
  assert.deepEqual(replayed, events);
});

test('reset restores stock and clears orders without rewriting previous run evidence', async () => {
  const created = await createOrder();
  const runId = created.headers.get('x-bunkerlab-run-id')!;
  const snapshot = await detail(runId);
  const response = await fetch(`${baseUrl}/system/reset`, { method: 'POST' });
  assert.equal(response.status, 200);
  const reset = await response.json() as SystemState;
  assert.equal(reset.product.stock, 3);
  assert.deepEqual(reset.orders, []);
  assert.deepEqual(await orders(), []);
  assert.equal((await product()).stock, 3);
  assert.deepEqual((await detail(runId)).events, snapshot.events);
});

test('invalid quantities and unknown products do not mutate state', async () => {
  for (const quantity of [0, -1, 1.5, '1', null]) {
    const response = await createOrder({ ...input, quantity });
    assert.equal(response.status, 400);
    assert.equal((await detail(response.headers.get('x-bunkerlab-run-id')!)).run.status, 'failed');
  }
  assert.equal((await createOrder({ ...input, productId: 'missing' })).status, 404);
  assert.equal((await product()).stock, 3);
  assert.deepEqual(await orders(), []);
});

test('insufficient stock returns 409 and records failure without a partial order', async () => {
  assert.equal((await createOrder({ ...input, quantity: 3 })).status, 201);
  const failed = await createOrder();
  assert.equal(failed.status, 409);
  const { run, events } = await detail(failed.headers.get('x-bunkerlab-run-id')!);
  assert.equal(run.status, 'failed');
  assert.equal(run.httpStatus, 409);
  assert.deepEqual(events.map((event) => event.type), [
    'run.started', 'request.received', 'controller.entered', 'service.entered',
    'service.failed', 'controller.failed', 'response.sent', 'run.failed',
  ]);
  assert.equal((await product()).stock, 0);
  assert.equal((await orders()).length, 1);
});

test('independent concurrent HTTP actions keep runs isolated and do not oversell the synchronous stock', async () => {
  const responses = await Promise.all(Array.from({ length: 4 }, () => createOrder()));
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 201, 201, 409]);
  const ids = responses.map((response) => response.headers.get('x-bunkerlab-run-id')!);
  assert.equal(new Set(ids).size, 4);
  for (const id of ids) assert.ok((await detail(id)).events.every((event) => event.runId === id));
  assert.equal((await product()).stock, 0);
  assert.equal((await orders()).length, 3);
});

test('a prepared run is claimed only once and invalid capabilities cannot create orders', async () => {
  const prepared = await prepare();
  assert.equal((await product()).stock, 3);
  assert.deepEqual(await orders(), []);
  const invalid = { ...prepared, requestToken: 'invalid' };
  assert.equal((await createOrder(input, invalid)).status, 401);
  assert.equal((await detail(prepared.run.id)).run.status, 'pending');
  assert.equal((await createOrder(input, prepared)).status, 201);
  assert.equal((await createOrder(input, prepared)).status, 409);
  assert.equal((await orders()).length, 1);
  const abandoned = await prepare();
  const result = await fetch(`${baseUrl}/labs/${labId}/runs/${abandoned.run.id}/abandon`, { method: 'POST' });
  assert.equal((await result.json() as { status: string }).status, 'abandoned');
  assert.equal((await createOrder(input, abandoned)).status, 409);
  assert.equal((await orders()).length, 1);
});
