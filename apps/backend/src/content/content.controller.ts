import { Controller, Get, Header, Param } from "@nestjs/common";
import { listCourses, loadCourse, loadLesson } from "./courses";

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
}
