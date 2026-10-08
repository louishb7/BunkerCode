import { Body, Controller, Get, Header, Param, Put } from "@nestjs/common";
import { listCourses, loadCourse, loadLesson } from "./courses";
import { saveLesson } from "./studio";

@Controller("content/courses")
export class ContentController {
  @Get()
  @Header("Cache-Control", "no-store")
  list() {
    return listCourses();
  }

  @Get(":id")
  @Header("Cache-Control", "no-store")
  course(@Param("id") id: string) {
    return loadCourse(id);
  }

  @Get(":id/lessons/:slug")
  @Header("Cache-Control", "no-store")
  lesson(@Param("id") id: string, @Param("slug") slug: string) {
    return loadLesson(id, slug);
  }
  @Put(":id/lessons/:slug/markdown")
  @Header("Cache-Control", "no-store")
  save(
    @Param("id") id: string,
    @Param("slug") slug: string,
    @Body() body: unknown,
  ) {
    return saveLesson(id, slug, body);
  }
}
