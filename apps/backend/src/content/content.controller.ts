import { OptionalIdentity, type PublicRequest } from "../auth/auth.guard";
import { Controller, Get, Header, Param, Inject, Req } from "@nestjs/common";
import { ContentReader } from "./content-reader";

@OptionalIdentity()
@Controller("content/courses")
export class ContentController {
  constructor(@Inject(ContentReader) private readonly reader: ContentReader) {}
  @Get()
  @Header("Cache-Control", "no-store")
  list(@Req() request: PublicRequest) {
    return this.reader.list(request.identity?.role === "ADMIN");
  }
  @Get(":id")
  @Header("Cache-Control", "no-store")
  course(@Param("id") id: string, @Req() request: PublicRequest) {
    return this.reader.course(id, request.identity?.role === "ADMIN");
  }
  @Get(":id/lessons/:slug")
  @Header("Cache-Control", "no-store")
  lesson(
    @Param("id") id: string,
    @Param("slug") slug: string,
    @Req() request: PublicRequest,
  ) {
    return this.reader.lesson(id, slug, request.identity?.role === "ADMIN");
  }
  @Get(":id/lessons/:slug/exercise")
  @Header("Cache-Control", "no-store")
  exercise(
    @Param("id") id: string,
    @Param("slug") slug: string,
    @Req() request: PublicRequest,
  ) {
    return this.reader.exercise(id, slug, request.identity?.role === "ADMIN");
  }
}
