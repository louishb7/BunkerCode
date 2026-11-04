import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { dirname } from "node:path";
import type { OperationalConfig } from "../operational-profile";
import { publicationCourse, publicationCourseId } from "../publication";
import {
  validSlug,
  listCourses,
  loadCourse,
  loadLesson,
  type CourseSummary,
} from "./courses";
import { loadExercise } from "./exercise";

@Injectable()
export class ContentReader {
  constructor(private readonly config: OperationalConfig) {}
  list(editorial = false): CourseSummary[] {
    if (this.config.profile === "authoring" && editorial)
      return listCourses(this.config.root);
    const ids =
      this.config.profile === "public"
        ? this.config.published
        : (this.config.selection ?? []).map(publicationCourseId);
    return [...ids]
      .sort((a, b) => a.localeCompare(b))
      .flatMap((id) => {
        try {
          const { title, description, shortDescription, lessons } =
            this.course(id);
          return [
            {
              id,
              title,
              description,
              ...(shortDescription === undefined ? {} : { shortDescription }),
              lessonCount: lessons.length,
            },
          ];
        } catch (error) {
          // An authoring selection can refer to a course not present in this checkout.
          // Omit only missing courses; malformed content is still an explicit error.
          if (
            this.config.profile === "authoring" &&
            error instanceof NotFoundException
          )
            return [];
          throw error;
        }
      });
  }
  course(id: string, editorial = false) {
    if (this.config.profile === "authoring") {
      if (editorial) return loadCourse(id, this.config.root);
      const selection = this.config.selection?.find(
        (entry) => publicationCourseId(entry) === id,
      );
      if (!selection) throw new NotFoundException("Curso não encontrado.");
      return publicationCourse(dirname(this.config.root), selection);
    }
    if (!this.config.published.includes(id))
      throw new NotFoundException("Curso não encontrado.");
    return loadCourse(id, this.config.root);
  }
  lesson(id: string, slug: string, editorial = false) {
    if (!validSlug(slug))
      throw new BadRequestException("Slug de lição inválido.");
    const course = this.course(id, editorial);
    const index = course.lessons.findIndex((entry) => entry.slug === slug);
    if (index < 0) throw new NotFoundException("Lição não encontrada.");
    return {
      ...loadLesson(id, slug, this.config.root),
      course,
      previous: course.lessons[index - 1] ?? null,
      next: course.lessons[index + 1] ?? null,
    };
  }
  exercise(id: string, slug: string, editorial = false) {
    if (!validSlug(slug))
      throw new BadRequestException("Slug de lição inválido.");
    const course = this.course(id, editorial);
    if (!course.lessons.some((entry) => entry.slug === slug))
      throw new NotFoundException("Lição não encontrada.");
    return { exercise: loadExercise(id, slug, this.config.root) };
  }
}
