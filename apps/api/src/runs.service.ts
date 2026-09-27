import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable } from 'rxjs';
import type { LabContext } from '@backendlab/lab-sdk';
import type { LabEvent, LabRun, RunDetail } from '@backendlab/protocol';
import type { LabContextLookup } from '@backendlab/lab-001';
import { lab001Definition } from '@backendlab/lab-001';

type StoredRun = {
  run: LabRun;
  events: LabEvent[];
  token: string;
  listeners: Set<(event: LabEvent) => void>;
  abort?: AbortController;
};

@Injectable()
export class RunsService implements LabContextLookup {
  private readonly runs = new Map<string, StoredRun>();
  private activeRunId?: string;
  private baseUrl?: string;

  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  createRun(labId: string): LabRun {
    if (labId !== lab001Definition.id) throw new NotFoundException('Lab unavailable');
    if (this.activeRunId) throw new ConflictException('A run is already active');
    if (!this.baseUrl) throw new Error('HTTP address is not configured');

    const run: LabRun = {
      id: randomUUID(), labId, status: 'pending', createdAt: Date.now(), eventCount: 0,
    };
    const stored: StoredRun = { run, events: [], token: randomUUID(), listeners: new Set() };
    this.runs.set(run.id, stored);
    this.activeRunId = run.id;
    return { ...run };
  }

  startRun(labId: string, runId: string): LabRun {
    const stored = this.find(labId, runId);
    if (stored.run.status !== 'pending') throw new ConflictException('Run has already started or ended');
    stored.run.status = 'running';
    stored.run.startedAt = Date.now();
    this.emit(runId, { source: 'control', type: 'run.started', payload: { mode: 'observe' } });
    setImmediate(() => { void this.execute(runId); });
    return { ...stored.run };
  }

  abandonRun(labId: string, runId: string): LabRun {
    const stored = this.find(labId, runId);
    if (stored.run.status === 'pending' || stored.run.status === 'running') {
      stored.run.status = 'abandoned';
      stored.run.completedAt = Date.now();
      if (stored.run.startedAt) stored.run.durationMs = stored.run.completedAt - stored.run.startedAt;
      if (this.activeRunId === runId) this.activeRunId = undefined;
      stored.abort?.abort();
      this.emit(runId, { source: 'control', type: 'run.abandoned' });
    }
    return { ...stored.run };
  }

  getDetail(labId: string, runId: string): RunDetail {
    const stored = this.find(labId, runId);
    return { run: { ...stored.run }, events: [...stored.events] };
  }

  stream(labId: string, runId: string): Observable<LabEvent> {
    const stored = this.find(labId, runId);
    return new Observable<LabEvent>((subscriber) => {
      for (const event of stored.events) subscriber.next(event);
      if (stored.run.status !== 'pending' && stored.run.status !== 'running') {
        subscriber.complete();
        return;
      }
      const listener = (event: LabEvent): void => {
        subscriber.next(event);
        if (event.type === 'run.completed' || event.type === 'run.failed' || event.type === 'run.abandoned') subscriber.complete();
      };
      stored.listeners.add(listener);
      return () => stored.listeners.delete(listener);
    });
  }

  getContext(runId: string, token: string): LabContext {
    const stored = this.runs.get(runId);
    if (!stored || stored.token !== token || stored.run.status !== 'running') {
      throw new UnauthorizedException('Invalid run context');
    }
    return {
      labId: stored.run.labId,
      runId,
      emit: (event) => this.emit(runId, event),
    };
  }

  private find(labId: string, runId: string): StoredRun {
    const stored = this.runs.get(runId);
    if (!stored || stored.run.labId !== labId) throw new NotFoundException('Run not found');
    return stored;
  }

  private emit(runId: string, input: Pick<LabEvent, 'source' | 'type' | 'payload'>): void {
    const stored = this.runs.get(runId);
    if (!stored) throw new Error('Run not found');
    if (stored.run.status === 'abandoned' && input.type !== 'run.abandoned') return;
    const event: LabEvent = {
      id: randomUUID(), labId: stored.run.labId, runId,
      timestamp: Date.now(), source: input.source, type: input.type,
      ...(input.payload ? { payload: input.payload } : {}),
    };
    stored.events.push(event);
    stored.run.eventCount = stored.events.length;
    for (const listener of stored.listeners) listener(event);
  }

  private async execute(runId: string): Promise<void> {
    const stored = this.runs.get(runId);
    if (!stored || !this.baseUrl || stored.run.status !== 'running' || stored.run.startedAt === undefined) return;
    const startedAt = stored.run.startedAt;
    const abort = new AbortController();
    stored.abort = abort;
    const path = '/experiments/001-request-lifecycle/request';
    this.emit(runId, { source: 'client', type: 'client.request.started', payload: { method: 'GET', path } });
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        headers: { 'x-backendlab-run-id': runId, 'x-backendlab-run-token': stored.token },
        signal: abort.signal,
      });
      const body: unknown = await response.json();
      if (this.isAbandoned(runId)) return;
      this.emit(runId, {
        source: 'client', type: 'client.response.received',
        payload: { statusCode: response.status, body },
      });
      stored.run.status = response.ok ? 'completed' : 'failed';
      stored.run.httpStatus = response.status;
      stored.run.completedAt = Date.now();
      stored.run.durationMs = stored.run.completedAt - startedAt;
      this.activeRunId = undefined;
      this.emit(runId, {
        source: 'control', type: response.ok ? 'run.completed' : 'run.failed',
        payload: { statusCode: response.status, durationMs: stored.run.durationMs },
      });
    } catch (error) {
      if (this.isAbandoned(runId)) return;
      stored.run.status = 'failed';
      stored.run.error = error instanceof Error ? error.message : 'Unknown request error';
      stored.run.completedAt = Date.now();
      stored.run.durationMs = stored.run.completedAt - startedAt;
      this.activeRunId = undefined;
      this.emit(runId, { source: 'control', type: 'run.failed', payload: { error: stored.run.error } });
    }
  }

  private isAbandoned(runId: string): boolean {
    return this.runs.get(runId)?.run.status === 'abandoned';
  }
}
