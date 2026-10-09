import { Link, useParams } from "react-router";
import {
  lessonPath,
  useContent,
  parseCourse,
  parseCourses,
  incompatibleContent,
} from "./api";
import { Page } from "./Page";
import { ContentStatus } from "./ContentStatus";

export function CoursesPage() {
  const { data, error } = useContent("", parseCourses);
  if (!data) return <ContentStatus error={error} />;
  return (
    <Page title="Cursos" className="page-width catalog-page">
      <header className="catalog-heading">
        <p className="eyebrow">Seu estudo, em suas palavras.</p>
        <h1>Cursos</h1>
        <p className="catalog-intro">
          Escolha um curso para ler, escrever e revisar suas lições.
        </p>
      </header>
      <section aria-labelledby="courses-title">
        <div className="section-heading">
          <h2 id="courses-title">Disponíveis</h2>
          <span>
            {data.length} {data.length === 1 ? "curso" : "cursos"}
          </span>
        </div>
        {data.length === 0 ? (
          <p className="empty-content">
            Nenhum curso publicado. Seus cursos aparecerão aqui quando você
            adicionar conteúdo.
          </p>
        ) : (
          <div className="course-list">
            {data.map((course) => (
              <Link
                className="course-card"
                key={course.id}
                to={"/courses/" + encodeURIComponent(course.id)}
              >
                <h3>{course.title}</h3>
                <p>{course.description}</p>
                <div className="course-card-footer">
                  <span className="muted">
                    {course.lessonCount}{" "}
                    {course.lessonCount === 1 ? "lição" : "lições"}
                  </span>
                  <span className="course-action">
                    Abrir curso <span aria-hidden="true">→</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      <p className="author-note">
        As lições iniciais são exemplos demonstrativos. Amplie ou substitua o
        conteúdo com seu próprio entendimento.
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
  if (!course || course.id !== id)
    return (
      <ContentStatus error={error || (course ? incompatibleContent : "")} />
    );
  return (
    <Page title={course.title} className="page-width reading-page course-page">
      <nav aria-label="Caminho da página">
        <Link className="back-link" to="/courses">
          ← Todos os cursos
        </Link>
        <span aria-current="page" className="breadcrumb-current">
          {course.title}
        </span>
      </nav>
      <header className="course-heading">
        <p className="eyebrow">
          Curso · {course.lessons.length}{" "}
          {course.lessons.length === 1 ? "lição" : "lições"}
        </p>
        <h1>{course.title}</h1>
        <p className="course-description">{course.description}</p>
      </header>
      <section aria-labelledby="lessons-title">
        <h2 id="lessons-title">Lições</h2>
        {course.lessons.length === 0 ? (
          <p className="empty-content">
            Este curso ainda não tem lições. Elas aparecerão aqui quando você
            adicionar conteúdo ao curso.
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
                  <span className="lesson-action" aria-hidden="true">
                    {index === 0 ? "Começar" : "Ler"} →
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
      <p className="author-note">
        Siga a ordem das lições ou escolha o tema que deseja revisar.
      </p>
    </Page>
  );
}
