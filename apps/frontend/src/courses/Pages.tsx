import { Link, NavLink, useParams } from "react-router";
import {
  lessonPath,
  useContent,
  type Course,
  type CourseSummary,
  type Lesson,
} from "./api";
import { Markdown } from "./Markdown";

function Status({ error }: { error: string }) {
  return (
    <main className="page-width content-status">
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
    </main>
  );
}
export function CoursesPage() {
  const { data, error } = useContent<CourseSummary[]>("");
  if (!data) return <Status error={error} />;
  return (
    <main className="page-width catalog-page">
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
    </main>
  );
}
export function CoursePage() {
  const { id = "" } = useParams();
  const { data: course, error } = useContent<Course>(
    "/" + encodeURIComponent(id),
  );
  if (!course) return <Status error={error} />;
  return (
    <main className="page-width course-page">
      <Link className="back-link" to="/courses">
        ← Todos os cursos
      </Link>
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
    </main>
  );
}
export function LessonPage() {
  const { id = "", slug = "" } = useParams();
  const { data: lesson, error } = useContent<Lesson>(
    "/" + encodeURIComponent(id) + "/lessons/" + encodeURIComponent(slug),
  );
  if (!lesson) return <Status error={error} />;
  const lines = lesson.markdown.split("\n");
  // Keep the standalone Markdown title, but avoid displaying it twice in the reader.
  const body =
    lines[0]?.trim() === "# " + lesson.title
      ? lines.slice(1).join("\n")
      : lesson.markdown;
  return (
    <div className="reader-layout">
      <aside className="course-sidebar">
        <Link className="back-link" to={"/courses/" + encodeURIComponent(id)}>
          ← Voltar ao curso
        </Link>
        <h2>{lesson.course.title}</h2>
        <nav aria-label="Lições do curso">
          <ol>
            {lesson.course.lessons.map((entry, index) => (
              <li key={entry.slug}>
                <NavLink to={lessonPath(id, entry.slug)}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {entry.title}
                </NavLink>
              </li>
            ))}
          </ol>
        </nav>
      </aside>
      <main className="lesson-reader">
        <article>
          <header className="lesson-heading">
            <p className="eyebrow">{lesson.course.title} · lição</p>
            <h1>{lesson.title}</h1>
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
        {lesson.activityId && (
          <section className="optional-practice">
            <h2>Exercício relacionado</h2>
            <p>
              Abra o exercício quando quiser confrontar uma ideia com código. A
              leitura não inicia nenhuma execução.
            </p>
            <Link to={"/learn/" + encodeURIComponent(lesson.activityId)}>
              Abrir exercício →
            </Link>
          </section>
        )}
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
      </main>
    </div>
  );
}
