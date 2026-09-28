import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { LabContext } from '@backendlab/lab-sdk';
import { lab001Definition } from '@backendlab/lab-001';
import { RunsService } from './runs.service';

export interface ObservedRequest extends Request { labContext: LabContext; }

@Injectable()
export class RequestLifecycleMiddleware implements NestMiddleware {
  constructor(@Inject(RunsService) private readonly runs: RunsService) {}

  use(req: ObservedRequest, res: Response, next: NextFunction): void {
    const runId = req.header('x-bunkerlab-run-id');
    const token = req.header('x-bunkerlab-run-token');
    const prepared = runId || token ? undefined : this.runs.createRun(lab001Definition.id);
    const ctx = this.runs.beginRequest(runId ?? prepared?.run.id ?? '', token ?? prepared?.requestToken ?? '');
    req.labContext = ctx;
    res.setHeader('x-bunkerlab-run-id', ctx.runId);
    ctx.emit({
      source: 'http', type: 'request.received',
      payload: {
        method: req.method, path: req.originalUrl,
        origin: req.header('origin') ?? 'External HTTP client',
        destination: 'http://127.0.0.1:' + req.socket.localPort,
      },
    });
    res.once('finish', () => {
      ctx.emit({ source: 'http', type: 'response.sent', payload: { statusCode: res.statusCode } });
      this.runs.completeRequest(ctx.runId, res.statusCode);
    });
    res.once('close', () => {
      if (!res.writableFinished) this.runs.abandonRun(ctx.labId, ctx.runId);
    });
    next();
  }
}
