import { basename, dirname } from "node:path";
import {
  Body,
  Controller,
  Header,
  Param,
  Put,
  Post,
  HttpException,
} from "@nestjs/common";
import {
  createLesson,
  LessonCreationError,
} from "@bunkercode/content/authoring";
import { coursesRoot, loadLesson } from "./courses";
import { saveLesson } from "./studio";

@Controller("content/courses")
export class AuthoringController {
  @Post(":id/lessons")
  @Header("Cache-Control", "no-store")
  create(@Param("id") id: string, @Body() body: unknown) {
    let file: string;
    try {
      file = createLesson(id, body, coursesRoot());
    } catch (error) {
      if (error instanceof LessonCreationError)
        throw new HttpException(error.message, error.status);
      throw error;
    }
    const slug = basename(dirname(file));
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
