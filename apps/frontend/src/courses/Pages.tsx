import { Link, useParams } from "react-router";
import {
  lessonPath,
  useContent,
  parseCourse,
  parseCourses,
  parseLesson,
} from "./api";
import { Page } from "./Page";
import { LessonIndex } from "./LessonIndex";
import { Markdown, lessonBody } from "./Markdown";

export function ContentStatus({ error }: { error: string }) {
  return (
    <Page
      title={error ? "Conteúdo indisponível" : "Carregando conteúdo"}
      ready={!!error}
      className="page-width content-status"
    >
      {error ? (
        <>
          <p className="eyebrow">Conteúdo indisponível</p>
          <h1>Não foi possível abrir esta página</h1>
          <p role="alert">{error}</p>
          <Link to="/courses">Voltar aos cursos</Link>
          <button onClick={() => window.location.reload()}>
            Tentar novamente
          </button>
        </>
      ) : (
        <p role="status">Carregando conteúdo…</p>
      )}
    </Page>
  );
}
export function CoursesPage() {
  const { data, error } = useContent("", parseCourses);
  if (!data) return <ContentStatus error={error} />;
  return (
    <Page title="Cursos" className="page-width catalog-page">
      <p className="eyebrow">Seu acervo de aprendizagem</p>
      <h1>
        Seu estudo,
        <br />
        <span>em suas palavras.</span>
      </h1>
      <p className="catalog-intro">
        Estude, experimente e transforme o que entendeu em uma explicação que
        vale a pena revisitar.
      </p>
      <section aria-labelledby="courses-title">
        <div className="section-heading">
          <h2 id="courses-title">Cursos</h2>
          <span>Conteúdo versionado · autoria em Markdown</span>
        </div>
        {data.length === 0 ? (
          <p>
            Nenhum curso publicado. Crie um manifesto em content/courses para
            começar.
          </p>
        ) : (
          <div className="course-list">
            {data.map((course) => (
              <Link
                className="course-card"
                key={course.id}
                to={"/courses/" + encodeURIComponent(course.id)}
              >
                <span className="course-initial" aria-hidden="true">
                  {course.title.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <h3>{course.title}</h3>
                  <p>{course.description}</p>
                  <span className="muted">
                    {course.lessonCount}{" "}
                    {course.lessonCount === 1 ? "lição" : "lições"}
                  </span>
                </div>
                <span className="course-arrow" aria-hidden="true">
                  ↗
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
      <p className="author-note">
        Este é um espaço para construir seu entendimento. As lições iniciais
        estão identificadas como exemplos demonstrativos.
      </p>
    </Page>
  );
}
export function CoursePage() {
  const { id = "" } = useParams();
  const { data: course, error } = useContent(
    "/" + encodeURIComponent(id),
    parseCourse,
  );
  if (!course) return <ContentStatus error={error} />;
  return (
    <Page title={course.title} className="page-width course-page">
      <nav aria-label="Caminho da página">
        <Link className="back-link" to="/courses">
          ← Todos os cursos
        </Link>
        <span aria-current="page" className="breadcrumb-current">
          {course.title}
        </span>
      </nav>
      <p className="eyebrow">Curso · {course.lessons.length} lições</p>
      <h1>{course.title}</h1>
      <p className="course-description">{course.description}</p>
      <h2>Suas lições</h2>
      {course.lessons.length === 0 ? (
        <p>
          Este curso ainda não tem lições. Adicione um Markdown e uma entrada no
          manifesto.
        </p>
      ) : (
        <ol className="lesson-list">
          {course.lessons.map((lesson, index) => (
            <li key={lesson.slug}>
              <Link to={lessonPath(course.id, lesson.slug)}>
                <span className="lesson-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{lesson.title}</span>
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
      <p className="author-note">
        Cada lição é um arquivo Markdown independente. Salve sua edição e
        recarregue a página para revisar o conteúdo.
      </p>
    </Page>
  );
}
export function LessonPage() {
  const { id = "", slug = "" } = useParams();
  const { data: lesson, error } = useContent(
    "/" + encodeURIComponent(id) + "/lessons/" + encodeURIComponent(slug),
    parseLesson,
  );
  if (!lesson) return <ContentStatus error={error} />;
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
