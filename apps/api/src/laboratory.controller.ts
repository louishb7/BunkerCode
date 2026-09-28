import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { LaboratoryService } from "./laboratory.service";
@Controller("workspaces/:workspaceId/systems/:systemId")
export class LaboratoryController {
  constructor(
    @Inject(LaboratoryService) private readonly lab: LaboratoryService,
  ) {}
  @Post("runtime/open") @HttpCode(200) open(
    @Param("workspaceId") w: string,
    @Param("systemId") s: string,
  ) {
    return this.lab.open(w, s);
  }
  @Get("surface") surface(
    @Param("workspaceId") w: string,
    @Param("systemId") s: string,
  ) {
    return this.lab.surface(w, s);
  }
  @Get("activities") activities(
    @Param("workspaceId") w: string,
    @Param("systemId") s: string,
  ) {
    return this.lab.activityList(w, s);
  }
  @Get("activities/:id") activity(
    @Param("workspaceId") w: string,
    @Param("systemId") s: string,
    @Param("id") id: string,
  ) {
    return this.lab.activityDetail(w, s, id);
  }
  @Post("activities") @HttpCode(200) interact(
    @Param("workspaceId") w: string,
    @Param("systemId") s: string,
    @Body() body: unknown,
  ) {
    return this.lab.interact(w, s, body);
  }
  @Get() workbench(
    @Param("workspaceId") w: string,
    @Param("systemId") s: string,
  ) {
    return this.lab.workbench(w, s);
  }
  @Post("runtime/restart") @HttpCode(200) restart(
    @Param("workspaceId") w: string,
    @Param("systemId") s: string,
  ) {
    return this.lab.restart(w, s);
  }
  @Post("runtime/reset") @HttpCode(200) reset(
    @Param("workspaceId") w: string,
    @Param("systemId") s: string,
  ) {
    return this.lab.reset(w, s);
  }
  @Post("checkpoints") checkpoint(
    @Param("workspaceId") w: string,
    @Param("systemId") s: string,
    @Body() body: unknown,
  ) {
    return this.lab.checkpoint(w, s, body);
  }
  @Post("checkpoints/:id/restore") @HttpCode(200) restore(
    @Param("workspaceId") w: string,
    @Param("systemId") s: string,
    @Param("id") id: string,
  ) {
    return this.lab.restore(w, s, id);
  }
  @Post("experiments/:id/runs") @HttpCode(202) start(
    @Param("workspaceId") w: string,
    @Param("systemId") s: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.lab.startRun(w, s, id, body);
  }
  @Get("runs") runs(
    @Param("workspaceId") w: string,
    @Param("systemId") s: string,
    @Query("before") before?: string,
  ) {
    return this.lab.runs(w, s, before);
  }
  @Get("runs/:id") detail(
    @Param("workspaceId") w: string,
    @Param("systemId") s: string,
    @Param("id") id: string,
  ) {
    return this.lab.detail(w, s, id);
  }
}

@Controller("workspaces/:workspaceId/systems")
export class SystemsController {
  constructor(
    @Inject(LaboratoryService) private readonly lab: LaboratoryService,
  ) {}
  @Get() systems(@Param("workspaceId") w: string) {
    return this.lab.systems(w);
  }
}
