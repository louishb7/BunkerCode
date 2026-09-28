import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable } from 'rxjs';
import type { LabContext, LabEventInput } from '@backendlab/lab-sdk';
import type { LabEvent, LabRun, PreparedRun, RunDetail, RunRuntime } from '@backendlab/protocol';
import { lab001Definition } from '@backendlab/lab-001';

type StoredRun = {
  run: LabRun;
  events: LabEvent[];
  token: string;
  listeners: Set<(event: LabEvent) => void>;
};

@Injectable()
export class RunsService {
  private readonly runs = new Map<string, StoredRun>();
  private apiPort?: number;

  setApiPort(port: number): void { this.apiPort = port; }

  createRun(labId: string): PreparedRun {
    if (labId !== lab001Definition.id) throw new NotFoundException('Lab unavailable');
    const run: LabRun = {
      id: randomUUID(), labId, action: 'create-order', status: 'pending', createdAt: Date.now(), eventCount: 0,
    };
    const stored: StoredRun = { run, events: [], token: randomUUID(), listeners: new Set() };
    this.runs.set(run.id, stored);
    return { run: { ...run }, requestToken: stored.token };
  }

  beginRequest(runId: string, token: string): LabContext {
    const stored = this.runs.get(runId);
    if (!stored || stored.token !== token) throw new UnauthorizedException('Invalid run context');
    if (stored.run.status !== 'pending') throw new ConflictException('Run has already started or ended');
    stored.run.status = 'running';
    stored.run.startedAt = Date.now();
    this.emit(runId, { source: 'control', type: 'run.started', payload: { action: 'create-order' } });
    return { labId: stored.run.labId, runId, emit: (event) => this.emit(runId, event) };
  }

  completeRequest(runId: string, statusCode: number): void {
    const stored = this.runs.get(runId);
    if (!stored || stored.run.status !== 'running') return;
    stored.run.status = statusCode < 400 ? 'completed' : 'failed';
    stored.run.httpStatus = statusCode;
    stored.run.completedAt = Date.now();
    stored.run.durationMs = stored.run.completedAt - stored.run.startedAt!;
    this.emit(runId, {
      source: 'control', type: stored.run.status === 'completed' ? 'run.completed' : 'run.failed',
      payload: { statusCode, durationMs: stored.run.durationMs },
    });
  }

  abandonRun(labId: string, runId: string): LabRun {
    const stored = this.find(labId, runId);
    if (stored.run.status === 'pending' || stored.run.status === 'running') {
      stored.run.status = 'abandoned';
      stored.run.completedAt = Date.now();
      if (stored.run.startedAt !== undefined) stored.run.durationMs = stored.run.completedAt - stored.run.startedAt;
      this.emit(runId, { source: 'control', type: 'run.abandoned' });
    }
    return { ...stored.run };
  }

  getDetail(labId: string, runId: string): RunDetail {
    const stored = this.find(labId, runId);
    return { run: { ...stored.run }, events: [...stored.events], runtime: this.getRuntime() };
  }

  listRuns(labId: string): LabRun[] {
    if (labId !== lab001Definition.id) throw new NotFoundException('Lab unavailable');
    return [...this.runs.values()]
      .filter((stored) => stored.run.labId === labId)
      .reverse()
      .map(({ run }) => ({ ...run, ...(run.request ? { request: { ...run.request } } : {}) }));
  }

  private getRuntime(): RunRuntime {
    if (this.apiPort === undefined) throw new Error('HTTP address is not configured');
    return { engine: 'Node.js', nodeVersion: process.version, pid: process.pid, apiPort: this.apiPort };
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
        if (['run.completed', 'run.failed', 'run.abandoned'].includes(event.type)) subscriber.complete();
      };
      stored.listeners.add(listener);
      return () => stored.listeners.delete(listener);
    });
  }

  private find(labId: string, runId: string): StoredRun {
    const stored = this.runs.get(runId);
    if (!stored || stored.run.labId !== labId) throw new NotFoundException('Run not found');
    return stored;
  }

  private emit(runId: string, input: LabEventInput): void {
    const stored = this.runs.get(runId);
    if (!stored) throw new Error('Run not found');
    if (stored.run.status === 'abandoned' && input.type !== 'run.abandoned') return;
    if (input.type === 'request.received' && typeof input.payload?.method === 'string' && typeof input.payload.path === 'string') {
      stored.run.request = { method: input.payload.method, path: input.payload.path };
    }
    const event: LabEvent = {
      id: randomUUID(), labId: stored.run.labId, runId,
      timestamp: Date.now(), source: input.source, type: input.type,
      ...(input.payload ? { payload: input.payload } : {}),
    };
    stored.events.push(event);
    stored.run.eventCount = stored.events.length;
    for (const listener of stored.listeners) listener(event);
  }
}
