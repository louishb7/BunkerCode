import { isContentSlug, isContentTitle } from "./api";
export interface MarkdownRevision {
  markdown: string;
  version: string;
}
export interface EditableLesson extends MarkdownRevision {
  slug: string;
  title: string;
  course: { id: string; title: string };
}
export class StudioError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Resposta de conteúdo inválida.");
  return value as Record<string, unknown>;
}
function revision(value: unknown): MarkdownRevision {
  const data = object(value);
  if (
    typeof data.markdown !== "string" ||
    typeof data.version !== "string" ||
    !/^[a-f0-9]{64}$/.test(data.version)
  )
    throw new Error("Resposta de versão inválida.");
  return { markdown: data.markdown, version: data.version };
}
export function parseEditableLesson(value: unknown): EditableLesson {
  const data = object(value),
    course = object(data.course);
  if (
    !isContentSlug(data.slug) ||
    !isContentTitle(data.title) ||
    !isContentSlug(course.id) ||
    !isContentTitle(course.title)
  )
    throw new Error("Resposta de lição inválida.");
  return {
    ...revision(data),
    slug: data.slug,
    title: data.title,
    course: { id: course.id, title: course.title },
  };
}
export const editorialPath = (id: string, slug: string) =>
  "/" + encodeURIComponent(id) + "/lessons/" + encodeURIComponent(slug);
async function responseValue(response: Response): Promise<unknown> {
  const value: unknown = await response.json();
  if (!response.ok) {
    const error = object(value);
    throw new StudioError(
      typeof error.message === "string"
        ? error.message
        : "Não foi possível salvar ou consultar a lição.",
      response.status,
    );
  }
  return value;
}
export async function readEditableLesson(id: string, slug: string) {
  return parseEditableLesson(
    await responseValue(
      await fetch("/api/content/courses" + editorialPath(id, slug), {
        cache: "no-store",
      }),
    ),
  );
}
export async function saveMarkdown(
  id: string,
  slug: string,
  value: MarkdownRevision,
) {
  const saved = revision(
    await responseValue(
      await fetch(
        "/api/content/courses" + editorialPath(id, slug) + "/markdown",
        {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            "x-bunkercode-client": "local",
          },
          body: JSON.stringify(value),
        },
      ),
    ),
  );
  if (saved.markdown !== value.markdown)
    throw new Error("O servidor não confirmou o texto enviado.");
  return saved;
}
