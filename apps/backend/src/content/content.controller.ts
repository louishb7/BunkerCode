import { Controller, Get, Header, Param, Inject } from "@nestjs/common";
import { ContentReader } from "./content-reader";

@Controller("content/courses")
export class ContentController {
  constructor(@Inject(ContentReader) private readonly reader: ContentReader) {}
  @Get()
  @Header("Cache-Control", "no-store")
  list() {
    return this.reader.list();
  }
  @Get(":id")
  @Header("Cache-Control", "no-store")
  course(@Param("id") id: string) {
    return this.reader.course(id);
  }
  @Get(":id/lessons/:slug")
  @Header("Cache-Control", "no-store")
  lesson(@Param("id") id: string, @Param("slug") slug: string) {
    return this.reader.lesson(id, slug);
  }
  @Get(":id/lessons/:slug/exercise")
  @Header("Cache-Control", "no-store")
  exercise(@Param("id") id: string, @Param("slug") slug: string) {
    return this.reader.exercise(id, slug);
  }
}
