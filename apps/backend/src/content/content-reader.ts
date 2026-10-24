import { Injectable, NotFoundException } from "@nestjs/common";
import type { OperationalConfig } from "../operational-profile";
import { listCourses, loadCourse, loadLesson } from "./courses";
import { loadExercise } from "./exercise";

@Injectable()
export class ContentReader {
  constructor(private readonly config: OperationalConfig) {}
  private authorize(id: string) {
    if (this.config.profile === "public" && !this.config.published.includes(id))
      throw new NotFoundException("Curso não encontrado.");
  }
  list() {
    const courses = listCourses(this.config.root);
    const published =
      this.config.profile === "public" ? this.config.published : undefined;
    return published
      ? courses.filter((course) => published.includes(course.id))
      : courses;
  }
  course(id: string) {
    this.authorize(id);
    return loadCourse(id, this.config.root);
  }
  lesson(id: string, slug: string) {
    this.authorize(id);
    return loadLesson(id, slug, this.config.root);
  }
  exercise(id: string, slug: string) {
    this.authorize(id);
    return { exercise: loadExercise(id, slug, this.config.root) };
  }
}
