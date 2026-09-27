import { Controller, Get, Headers, Inject, Injectable } from '@nestjs/common';
import type { LabDefinition } from '@backendlab/protocol';
import type { LabContext } from '@backendlab/lab-sdk';

export const lab001Definition: LabDefinition = {
  id: '001-request-lifecycle',
  number: '001',
  title: 'Request Lifecycle',
  area: 'Execution',
  mode: 'observe',
  status: 'available',
  question: 'O que realmente acontece entre um cliente enviar uma request HTTP e receber a resposta?',
  description: 'Acompanhe uma request real através da camada HTTP, controller e service até a resposta.',
  concept: 'Ordem de execução e fronteiras de uma request HTTP no NestJS',
};

export const LAB_CONTEXT_LOOKUP = 'LAB_CONTEXT_LOOKUP';

export interface LabContextLookup {
  getContext(runId: string, token: string): LabContext;
}

@Injectable()
export class RequestLifecycleService {
  process(ctx: LabContext): { message: string; processed: boolean } {
    ctx.emit({ source: 'service', type: 'service.entered', payload: { operation: 'process' } });
    const result = { message: 'Hello from the real service', processed: true };
    ctx.emit({ source: 'service', type: 'service.completed', payload: { output: result } });
    return result;
  }
}

@Controller('experiments/001-request-lifecycle')
export class RequestLifecycleController {
  constructor(
    @Inject(LAB_CONTEXT_LOOKUP) private readonly contexts: LabContextLookup,
    @Inject(RequestLifecycleService) private readonly service: RequestLifecycleService,
  ) {}

  @Get('request')
  execute(
    @Headers('x-backendlab-run-id') runId: string,
    @Headers('x-backendlab-run-token') token: string,
  ): { message: string; processed: boolean } {
    const ctx = this.contexts.getContext(runId, token);
    ctx.emit({ source: 'controller', type: 'controller.entered', payload: { handler: 'execute' } });
    const result = this.service.process(ctx);
    ctx.emit({ source: 'controller', type: 'controller.completed', payload: { statusCode: 200 } });
    return result;
  }
}
