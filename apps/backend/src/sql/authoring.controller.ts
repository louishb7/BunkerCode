import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Put,
  Req,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { RequireIdentity } from "../auth/auth.guard";
import { SqlService, sqlInput } from "./sql.service";
import { sqlObject } from "@bunkercode/content/sql";
@RequireIdentity("ADMIN")
@Controller("content/sql/authoring")
export class SqlAuthoringController {
  constructor(@Inject(SqlService) private readonly sql: SqlService) {}
  @Get() @Header("Cache-Control", "no-store") inventory() {
    return sqlInput(() => ({
      drafts: this.sql.content.drafts(),
      published: this.sql.content
        .versions()
        .map((r) => this.sql.content.definition(r.id, r.version)),
      datasets: this.sql.content.datasets(),
    }));
  }
  @Put("datasets") dataset(@Body() body: unknown) {
    return sqlInput(() => this.sql.content.saveDataset(body));
  }
  @Put("drafts") save(@Body() body: unknown) {
    return sqlInput(() => {
      const b = sqlObject(body, ["definition", "revision"]);
      return this.sql.content.saveDraft(b.definition, b.revision);
    });
  }
  @Post("drafts/:id/test") async test(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.validate(id, body, false, request, response);
  }
  private async validate(
    id: string,
    body: unknown,
    publish: boolean,
    request: AuthenticatedRequest,
    response: Response,
  ) {
    const draft = sqlInput(() => {
      const b = sqlObject(body, ["revision"]);
      const d = this.sql.content.draft(id);
      if (b.revision !== d.revision)
        throw new Error("Rascunho mudou. Recarregue antes de testar.");
      return d;
    });
    const dataset = this.sql.content.dataset(
      draft.definition.dataset.id,
      draft.definition.dataset.version,
    );
    const abort = new AbortController();
    const cancel = () => {
      if (!response.writableFinished) abort.abort();
    };
    response.on("close", cancel);
    try {
      if (
        !(await this.sql.authoring(
          request.identity.id,
          draft.definition,
          dataset,
          abort.signal,
        ))
      )
        throw new Error("Referência inválida.");
    } finally {
      response.off("close", cancel);
    }
    return publish
      ? this.sql.content.publish(id, draft.revision)
      : { valid: true };
  }
  @Post("drafts/:id/publish") async publish(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.validate(id, body, true, request, response);
  }
}
