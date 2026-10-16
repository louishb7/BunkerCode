export interface LessonEntry {
  slug: string;
  title: string;
}
export interface Course {
  id: string;
  title: string;
  description: string;
  lessons: LessonEntry[];
}
export interface CourseSummary {
  id: string;
  title: string;
  description: string;
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
  fields(course, ["id", "title", "description", "lessons"]);
  if (course.id !== id || !validSlug(course.id))
    invalidCourse("id não corresponde à pasta do curso.");
  if (!Array.isArray(course.lessons))
    invalidCourse("lessons deve ser uma lista ordenada.");
  const seen = new Set<string>();
  const lessons = course.lessons.map((value): LessonEntry => {
    const lesson = object(value);
    fields(lesson, ["slug", "title"]);
    if (!validSlug(lesson.slug)) invalidCourse("slug de lição inválido.");
    if (seen.has(lesson.slug)) invalidCourse(`slug duplicado: ${lesson.slug}.`);
    seen.add(lesson.slug);
    return {
      slug: lesson.slug,
      title: text(lesson.title, 160, "title"),
    };
  });
  return {
    id,
    title: text(course.title, 160, "title"),
    description: text(course.description, 800, "description"),
    lessons,
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
