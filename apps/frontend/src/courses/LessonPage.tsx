import { Link, useParams } from "react-router";
import {
  lessonPath,
  useContent,
  parseLesson,
  incompatibleContent,
} from "./api";
import { Page } from "./Page";
import { ContentStatus } from "./ContentStatus";
import { LessonIndex } from "./LessonIndex";
import { Markdown, lessonBody } from "./Markdown";

export function LessonPage() {
  const { id = "", slug = "" } = useParams();
  const { data: lesson, error } = useContent(
    "/" + encodeURIComponent(id) + "/lessons/" + encodeURIComponent(slug),
    parseLesson,
  );
  if (!lesson || lesson.course.id !== id || lesson.slug !== slug)
    return (
      <ContentStatus error={error || (lesson ? incompatibleContent : "")} />
    );
  const body = lessonBody(lesson.markdown, lesson.title);
  return (
    <div className="reader-layout">
      <Page
        title={`${lesson.title} · ${lesson.course.title}`}
        className="lesson-reader"
      >
        <div className="lesson-context">
          <nav aria-label="Caminho da página">
            <Link
              className="back-link"
              to={"/courses/" + encodeURIComponent(id)}
            >
              ← Voltar ao curso
            </Link>
            <span aria-current="page" className="breadcrumb-current">
              {lesson.title}
            </span>
          </nav>
          <LessonIndex course={lesson.course} />
        </div>
        <article>
          <header className="lesson-heading">
            <p className="eyebrow">{lesson.course.title} · lição</p>
            <h1>{lesson.title}</h1>
            <Link
              className="edit-lesson-link"
              to={lessonPath(id, slug) + "/edit"}
            >
              Editar lição
            </Link>
          </header>
          <div className="prose">
            {body.trim() ? (
              <Markdown source={body} />
            ) : (
              <p>
                Esta lição ainda está vazia. Escreva seu conteúdo no arquivo
                Markdown.
              </p>
            )}
          </div>
        </article>
        <nav className="lesson-pagination" aria-label="Navegação entre lições">
          {lesson.previous ? (
            <Link to={lessonPath(id, lesson.previous.slug)}>
              <span>← Anterior</span>
              <strong>{lesson.previous.title}</strong>
            </Link>
          ) : (
            <span />
          )}
          {lesson.next ? (
            <Link to={lessonPath(id, lesson.next.slug)}>
              <span>Próxima →</span>
              <strong>{lesson.next.title}</strong>
            </Link>
          ) : (
            <Link to={"/courses/" + encodeURIComponent(id)}>
              <span>Voltar ao curso →</span>
              <strong>{lesson.course.title}</strong>
            </Link>
          )}
        </nav>
      </Page>
    </div>
  );
}
