import { evaluateSql } from "./runner";
import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Put,
} from "@nestjs/common";
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
  ) {
    return this.validate(id, body, false);
  }
  private async validate(id: string, body: unknown, publish: boolean) {
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
    if (
      !(await evaluateSql(
        draft.definition,
        dataset,
        draft.definition.assessment.reference,
      ))
    )
      throw new Error("Referência inválida.");
    return publish
      ? this.sql.content.publish(id, draft.revision)
      : { valid: true };
  }
  @Post("drafts/:id/publish") async publish(
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.validate(id, body, true);
  }
}
