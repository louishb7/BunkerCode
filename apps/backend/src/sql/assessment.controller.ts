import {
  Body,
  Controller,
  Header,
  Inject,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { RequireIdentity, type AuthenticatedRequest } from "../auth/auth.guard";
import { SqlService } from "./sql.service";
@RequireIdentity()
@Controller("sql")
export class SqlAssessmentController {
  constructor(@Inject(SqlService) private readonly sql: SqlService) {}
  @Post("check") @Header("Cache-Control", "no-store") check(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Body() body: unknown,
  ) {
    return this.evaluate(request, response, body, false);
  }
  @Post("submit") @Header("Cache-Control", "no-store") submit(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Body() body: unknown,
  ) {
    return this.evaluate(request, response, body, true);
  }
  private async evaluate(
    request: AuthenticatedRequest,
    response: Response,
    body: unknown,
    submit: boolean,
  ) {
    const abort = new AbortController();
    const cancel = () => {
      if (!response.writableFinished) abort.abort();
    };
    response.on("close", cancel);
    try {
      return await this.sql.check(
        request.identity.id,
        body,
        abort.signal,
        submit ? request.headers.authorization : undefined,
      );
    } finally {
      response.off("close", cancel);
    }
  }
}
