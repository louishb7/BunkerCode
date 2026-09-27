import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { ConflictException } from '@nestjs/common';
import { NestFactory, type INestApplication } from '@nestjs/core';
import type { LabEvent, LabRun, RunDetail } from '@backendlab/protocol';
import { AppModule } from '../src/app.module';
import { RunsService } from '../src/runs.service';

const labId = '001-request-lifecycle';
let app: INestApplication;
let baseUrl: string;

before(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
  app.get(RunsService).setBaseUrl(baseUrl);
});

after(async () => { await app.close(); });

async function waitForCompletion(runId: string): Promise<RunDetail> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const response = await fetch(`${baseUrl}/labs/${labId}/runs/${runId}`);
    assert.equal(response.status, 200);
    const detail = await response.json() as RunDetail;
    if (detail.run.status !== 'running') return detail;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Run did not finish');
}

test('a run crosses real HTTP, controller, and service and replays all events via SSE', async () => {
  const create = await fetch(`${baseUrl}/labs/${labId}/runs`, { method: 'POST' });
  assert.equal(create.status, 201);
  const created = await create.json() as LabRun;
  assert.equal(created.labId, labId);
  assert.equal(created.status, 'pending');

  const sseResponse = await fetch(`${baseUrl}/labs/${labId}/runs/${created.id}/events`, {
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(sseResponse.status, 200);
  assert.match(sseResponse.headers.get('content-type') ?? '', /text\/event-stream/);
  const start = await fetch(`${baseUrl}/labs/${labId}/runs/${created.id}/start`, { method: 'POST' });
  assert.equal(start.status, 201);
  const streamText = await sseResponse.text();
  const streamed = streamText.split('\n').filter((line) => line.startsWith('data: ')).map((line) => JSON.parse(line.slice(6)) as LabEvent);
  const { run, events } = await waitForCompletion(created.id);

  assert.equal(run.status, 'completed');
  assert.equal(run.httpStatus, 200);
  assert.equal(run.eventCount, events.length);
  assert.equal(streamed.length, events.length);
  assert.deepEqual(streamed.map((event) => event.id), events.map((event) => event.id));
  assert.ok(events.every((event) => event.runId === created.id && event.labId === labId));
  assert.ok(run.startedAt);
  assert.ok(events.every((event) => Number.isInteger(event.timestamp) && event.timestamp >= run.startedAt!));
  assert.equal(new Set(events.map((event) => event.id)).size, events.length);
  assert.ok(events.every((event, index) => index === 0 || event.timestamp >= events[index - 1]!.timestamp));

  const expectedOrder = [
    'run.started', 'client.request.started', 'request.received', 'controller.entered',
    'service.entered', 'service.completed', 'controller.completed', 'response.sent',
    'client.response.received', 'run.completed',
  ];
  assert.deepEqual(events.map((event) => event.type), expectedOrder);
  assert.equal(events.find((event) => event.type === 'client.response.received')?.payload?.statusCode, 200);
  assert.equal((events.find((event) => event.type === 'client.response.received')?.payload?.body as { processed: boolean }).processed, true);
  assert.ok(run.completedAt && run.completedAt >= run.startedAt!);
});

test('a second concurrent run is rejected while the first is active', async () => {
  const runs = app.get(RunsService);
  const first = runs.createRun(labId);
  assert.throws(() => runs.createRun(labId), ConflictException);
  runs.startRun(labId, first.id);
  const completed = await waitForCompletion(first.id);
  assert.equal(completed.run.status, 'completed');
});

test('abandoning a pending run releases the active slot', () => {
  const runs = app.get(RunsService);
  const first = runs.createRun(labId);
  assert.equal(runs.abandonRun(labId, first.id).status, 'abandoned');
  const next = runs.createRun(labId);
  assert.equal(next.status, 'pending');
  runs.abandonRun(labId, next.id);
});
