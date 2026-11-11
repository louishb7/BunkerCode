import { Controller, Get, Header, Inject, Param } from "@nestjs/common";
import { SqlService, sqlInput } from "./sql.service";
@Controller("content/sql")
export class SqlController {
  constructor(@Inject(SqlService) private readonly sql: SqlService) {}
  @Get("exercises") @Header("Cache-Control", "no-store") list() {
    return sqlInput(() => this.sql.content.list());
  }
  @Get("references") @Header("Cache-Control", "no-store") references() {
    return sqlInput(() =>
      this.sql.content
        .versions()
        .map(({ id, version }) => ({
          id,
          version,
          title: this.sql.content.public(id, version).title,
        })),
    );
  }
  @Get("exercises/:id/:version") @Header("Cache-Control", "no-store") get(
    @Param("id") id: string,
    @Param("version") version: string,
  ) {
    return sqlInput(() => this.sql.content.public(id, Number(version)));
  }
}
