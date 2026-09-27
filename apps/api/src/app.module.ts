import { Inject, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { LAB_CONTEXT_LOOKUP, RequestLifecycleController, RequestLifecycleService } from '@backendlab/lab-001';
import { LabsController } from './labs.controller';
import { RunsService } from './runs.service';

@Module({
  controllers: [LabsController, RequestLifecycleController],
  providers: [RunsService, RequestLifecycleService, { provide: LAB_CONTEXT_LOOKUP, useExisting: RunsService }],
})
export class AppModule implements NestModule {
  constructor(@Inject(RunsService) private readonly runs: RunsService) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply((req: Request, res: Response, next: NextFunction) => {
      const runId = req.header('x-backendlab-run-id') ?? '';
      const token = req.header('x-backendlab-run-token') ?? '';
      const ctx = this.runs.getContext(runId, token);
      const started = Date.now();
      ctx.emit({
        source: 'http', type: 'request.received',
        payload: { method: req.method, path: req.path },
      });
      res.once('finish', () => {
        ctx.emit({
          source: 'http', type: 'response.sent',
          payload: { statusCode: res.statusCode, durationMs: Date.now() - started },
        });
      });
      next();
    }).forRoutes({ path: 'experiments/001-request-lifecycle/request', method: RequestMethod.GET });
  }
}
