import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  HttpCode,
  Inject,
} from "@nestjs/common";
import { Attempts } from "./attempts";
import { activities, activity } from "../content/activities";
@Controller("learning")
export class LearningController {
  constructor(@Inject(Attempts) private readonly attempts: Attempts) {}
  @Get("activities") list() {
    return activities();
  }
  @Get("activities/:id") activity(@Param("id") id: string) {
    return activity(id);
  }
  @Post("attempts") create(@Body() body: unknown) {
    return this.attempts.create(body);
  }
  @Get("attempts/:id") get(@Param("id") id: string) {
    return this.attempts.get(id);
  }
  @Post("attempts/:id/draft") @HttpCode(200) save(
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.attempts.save(id, body);
  }
  @Post("attempts/:id/submissions") @HttpCode(200) submit(
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.attempts.submit(id, body);
  }
  @Post("attempts/:id/completion") @HttpCode(200) complete(
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.attempts.complete(id, body);
  }
}
