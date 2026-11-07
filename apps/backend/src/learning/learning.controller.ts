import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Req,
} from "@nestjs/common";
import { RequireIdentity, type AuthenticatedRequest } from "../auth/auth.guard";
import { emptyInput, LearningService } from "./learning.service";
@RequireIdentity()
@Controller("learning")
export class LearningController {
  constructor(
    @Inject(LearningService) private readonly learning: LearningService,
  ) {}
  @Get()
  summary(@Req() req: AuthenticatedRequest) {
    return this.learning.summary(req.identity.id);
  }
  @Post("courses/:course/lessons/:lesson/visit")
  visit(
    @Req() req: AuthenticatedRequest,
    @Param("course") course: string,
    @Param("lesson") lesson: string,
    @Body() body: unknown,
  ) {
    emptyInput(body);
    return this.learning.visit(req.identity.id, course, lesson);
  }
  @Post("courses/:course/lessons/:lesson/complete")
  complete(
    @Req() req: AuthenticatedRequest,
    @Param("course") course: string,
    @Param("lesson") lesson: string,
    @Body() body: unknown,
  ) {
    emptyInput(body);
    return this.learning.complete(req.identity.id, course, lesson);
  }
  @Get("courses/:course/lessons/:lesson/solution")
  solution(
    @Req() req: AuthenticatedRequest,
    @Param("course") course: string,
    @Param("lesson") lesson: string,
  ) {
    return this.learning.solution(req.identity.id, course, lesson);
  }
  @Get("preferences")
  async preferences(@Req() req: AuthenticatedRequest) {
    return { preferences: await this.learning.preferences(req.identity.id) };
  }
  @Post("preferences")
  initialize(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.learning.savePreferences(req.identity.id, body, true);
  }
  @Put("preferences")
  preferencesUpdate(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.learning.savePreferences(req.identity.id, body, false);
  }
}
