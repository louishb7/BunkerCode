import {
  memo,
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { parseExercise } from "../practice/exercise-api";
import { rememberLesson } from "../product/recent";
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

const LessonMarkdown = memo(Markdown);
const PracticePanel = lazy(() => import("../practice/PracticePanel"));

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
  return <LessonWorkspace key={id + "/" + slug} lesson={lesson} />;
}

function LessonWorkspace({ lesson }: { lesson: import("./api").Lesson }) {
  const id = lesson.course.id,
    slug = lesson.slug;
  const focusCode = useRef(false);
  const codePanel = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"explanation" | "code">("explanation");
  const { data: practice, error: practiceError } = useContent(
    "/" +
      encodeURIComponent(id) +
      "/lessons/" +
      encodeURIComponent(slug) +
      "/exercise",
    parseExercise,
  );
  const exercise = practice?.exercise;
  useLayoutEffect(() => {
    if (view === "code" && focusCode.current) {
      focusCode.current = false;
      codePanel.current?.focus({ preventScroll: true });
      codePanel.current?.scrollIntoView({ block: "start" });
    }
  }, [view]);
  useEffect(() => rememberLesson(id, slug), [id, slug]);
  const body = lessonBody(lesson.markdown, lesson.title);
  return (
    <div className={`reader-layout ${exercise ? "practice-layout" : ""}`}>
      <Page
        title={`${lesson.title} · ${lesson.course.title}`}
        className={`lesson-reader ${exercise ? "practice-workspace" : ""}`}
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
        {exercise && (
          <div
            className="workspace-switch mb-5 flex gap-2"
            role="group"
            aria-label="Vista de estudo"
          >
            <button
              aria-pressed={view === "explanation"}
              onClick={() => setView("explanation")}
            >
              Explicação
            </button>
            <button
              aria-pressed={view === "code"}
              onClick={() => setView("code")}
            >
              Código
            </button>
          </div>
        )}
        <div className={exercise ? "study-panels" : ""} data-view={view}>
          <article className="study-explanation">
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
                <LessonMarkdown source={body} />
              ) : (
                <p>
                  Esta lição ainda está vazia. Escreva seu conteúdo no arquivo
                  Markdown.
                </p>
              )}
            </div>
            {exercise && (
              <section
                aria-labelledby="exercise-title"
                className="mt-8 rounded-xl border border-gold/30 bg-surface p-5"
              >
                <p className="eyebrow mt-0">Prática de escrita</p>
                <h2 id="exercise-title" className="text-xl">
                  {exercise.title}
                </h2>
                <p className="text-sm leading-relaxed text-subtle">
                  {exercise.objective}
                </p>
                <p className="whitespace-pre-wrap text-base leading-relaxed">
                  {exercise.instructions}
                </p>
                <h3 className="text-base">O que observar</h3>
                <p className="text-sm leading-relaxed text-subtle">
                  {exercise.expected}
                </p>
                <button
                  className="workspace-switch"
                  onClick={() => {
                    focusCode.current = true;
                    setView("code");
                  }}
                >
                  Escrever solução
                </button>
              </section>
            )}
            {practiceError && (
              <div
                role="alert"
                className="mt-6 rounded-xl border border-line p-4 text-sm"
              >
                <p>
                  A prática não pôde ser carregada. A leitura continua
                  disponível.
                </p>
                <p>{practiceError}</p>
                <button onClick={() => window.location.reload()}>
                  Tentar novamente
                </button>
              </div>
            )}
          </article>
          {exercise && (
            <div
              ref={codePanel}
              tabIndex={-1}
              aria-label="Área de código"
              className="study-code min-w-0"
            >
              <Suspense
                fallback={<p role="status">Carregando editor de código…</p>}
              >
                <PracticePanel
                  key={exercise.id + exercise.revision}
                  course={id}
                  lesson={slug}
                  exercise={exercise}
                />
              </Suspense>
            </div>
          )}
        </div>
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
