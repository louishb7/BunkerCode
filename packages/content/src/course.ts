export interface LessonEntry {
  slug: string;
  title: string;
  moduleId?: string;
}
export interface CourseModule {
  id: string;
  title: string;
  description?: string;
  number?: number;
}
export interface Course {
  id: string;
  title: string;
  description: string;
  shortDescription?: string;
  lessons: LessonEntry[];
  modules?: CourseModule[];
}
export interface CourseSummary {
  id: string;
  title: string;
  description: string;
  shortDescription?: string;
  lessonCount: number;
}
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function validSlug(value: unknown): value is string {
  return (
    typeof value === "string" && value.length <= 80 && slugPattern.test(value)
  );
}

function invalidCourse(message: string): never {
  throw new Error(`Conteúdo inválido: ${message}`);
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalidCourse("o manifesto deve conter objetos.");
  return value as Record<string, unknown>;
}
function text(value: unknown, limit: number, field: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > limit)
    invalidCourse(`campo ${field} ausente, vazio ou muito longo.`);
  return value;
}
function fields(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    invalidCourse("campo desconhecido no manifesto.");
}
export function parseCourse(value: unknown, id: string): Course {
  const course = object(value);
  fields(course, [
    "id",
    "title",
    "description",
    "shortDescription",
    "lessons",
    "modules",
  ]);
  if (course.id !== id || !validSlug(course.id))
    invalidCourse("id não corresponde à pasta do curso.");
  if (!Array.isArray(course.lessons))
    invalidCourse("lessons deve ser uma lista ordenada.");
  const moduleIds = new Set<string>();
  let modules: CourseModule[] | undefined;
  if (course.modules !== undefined) {
    if (!Array.isArray(course.modules) || course.modules.length === 0)
      invalidCourse("modules deve ser uma lista ordenada e não vazia.");
    modules = course.modules.map((value): CourseModule => {
      const module = object(value);
      fields(module, ["id", "title", "description", "number"]);
      if (!validSlug(module.id)) invalidCourse("id de módulo inválido.");
      if (moduleIds.has(module.id))
        invalidCourse(`módulo duplicado: ${module.id}.`);
      moduleIds.add(module.id);
      if (
        module.number !== undefined &&
        (typeof module.number !== "number" ||
          !Number.isInteger(module.number) ||
          module.number < 0 ||
          module.number > 999)
      )
        invalidCourse(
          "número editorial de módulo deve ser inteiro entre 0 e 999.",
        );
      return {
        id: module.id,
        title: text(module.title, 160, "title"),
        ...(module.description === undefined
          ? {}
          : { description: text(module.description, 400, "description") }),
        ...(module.number === undefined ? {} : { number: module.number }),
      };
    });
  }
  const seen = new Set<string>();
  const lessons = course.lessons.map((value): LessonEntry => {
    const lesson = object(value);
    fields(lesson, modules ? ["slug", "title", "moduleId"] : ["slug", "title"]);
    if (!validSlug(lesson.slug)) invalidCourse("slug de lição inválido.");
    if (seen.has(lesson.slug)) invalidCourse(`slug duplicado: ${lesson.slug}.`);
    seen.add(lesson.slug);
    if (!modules)
      return {
        slug: lesson.slug,
        title: text(lesson.title, 160, "title"),
      };
    if (!validSlug(lesson.moduleId) || !moduleIds.has(lesson.moduleId))
      invalidCourse(`módulo de lição inexistente: ${String(lesson.moduleId)}.`);
    return {
      slug: lesson.slug,
      title: text(lesson.title, 160, "title"),
      moduleId: lesson.moduleId,
    };
  });
  if (modules && lessons.length === 0 && modules.length !== 1)
    invalidCourse("curso vazio pode preparar somente o módulo inicial.");
  if (modules && lessons.length > 0) {
    const used = new Set(lessons.map((lesson) => lesson.moduleId));
    for (const module of modules)
      if (!used.has(module.id))
        invalidCourse(`módulo sem lições: ${module.id}.`);
    const sequence: string[] = [];
    for (const lesson of lessons) {
      if (sequence.at(-1) === lesson.moduleId) continue;
      if (sequence.includes(lesson.moduleId!))
        invalidCourse(
          `lições do módulo ${lesson.moduleId} devem ser contíguas.`,
        );
      sequence.push(lesson.moduleId!);
    }
    if (
      sequence.length !== modules.length ||
      sequence.some((id, index) => id !== modules![index]!.id)
    )
      invalidCourse("a ordem das lições deve seguir a ordem dos módulos.");
  }
  return {
    id,
    title: text(course.title, 160, "title"),
    description: text(course.description, 800, "description"),
    ...(course.shortDescription === undefined
      ? {}
      : {
          shortDescription: text(
            course.shortDescription,
            160,
            "shortDescription",
          ),
        }),
    lessons,
    ...(modules ? { modules } : {}),
  };
}

export function isLessonTitle(value: unknown): value is string {
  return (
    typeof value === "string" &&
    !!value.trim() &&
    value.length <= 160 &&
    ![...value].some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    ) &&
    !/[\ud800-\udfff]/u.test(value)
  );
}
export function parseNewLesson(value: unknown): LessonEntry {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Informe título e slug em um objeto JSON.");
  const body = value as Record<string, unknown>;
  if (
    Object.keys(body).some((key) => !["title", "slug"].includes(key)) ||
    !validSlug(body.slug) ||
    !isLessonTitle(body.title)
  )
    throw new Error(
      "Informe título de uma linha (até 160 caracteres) e slug com letras minúsculas, números e hífens (até 80).",
    );
  return { slug: body.slug, title: body.title.trim() };
}
export function suggestLessonSlug(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .replace(/-$/, "");
}
