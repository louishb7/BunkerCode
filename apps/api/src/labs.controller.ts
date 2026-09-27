import { Controller, Get, Inject, MessageEvent, Param, Post, Sse, NotFoundException } from '@nestjs/common';
import { Observable, concat, map, of } from 'rxjs';
import type { LabDefinition, LabRun, LabSummary, RunDetail } from '@backendlab/protocol';
import { labDefinitions, labSummaries } from './curriculum';
import { RunsService } from './runs.service';

@Controller('labs')
export class LabsController {
  constructor(@Inject(RunsService) private readonly runs: RunsService) {}

  @Get()
  list(): LabSummary[] {
    return labSummaries;
  }

  @Get(':labId')
  getLab(@Param('labId') labId: string): LabDefinition {
    const lab = labDefinitions.find((item) => item.id === labId);
    if (!lab) throw new NotFoundException('Lab unavailable');
    return lab;
  }

  @Post(':labId/runs')
  createRun(@Param('labId') labId: string): LabRun {
    return this.runs.createRun(labId);
  }

  @Post(':labId/runs/:runId/start')
  startRun(@Param('labId') labId: string, @Param('runId') runId: string): LabRun {
    return this.runs.startRun(labId, runId);
  }

  @Post(':labId/runs/:runId/abandon')
  abandonRun(@Param('labId') labId: string, @Param('runId') runId: string): LabRun {
    return this.runs.abandonRun(labId, runId);
  }

  @Get(':labId/runs/:runId')
  getRun(@Param('labId') labId: string, @Param('runId') runId: string): RunDetail {
    return this.runs.getDetail(labId, runId);
  }

  @Sse(':labId/runs/:runId/events')
  events(@Param('labId') labId: string, @Param('runId') runId: string): Observable<MessageEvent> {
    return concat(of({ comment: 'connected' }), this.runs.stream(labId, runId).pipe(map((event) => ({ id: event.id, data: event }))));
  }
}
