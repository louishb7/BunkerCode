import { validateEditorial } from "@bunkercode/content";
import {
  ReadingArticle,
  StudySplit,
  LessonOutline,
  outlineHeadings,
} from "./ReadingTools";
import { recordActivity } from "../product/activity-store";
import { memo, lazy, Suspense, useEffect, useState } from "react";
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
import { useLessonNavigation } from "../product/SiteHeader";
import { LessonNavigation } from "./LessonNavigation";
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
  useLessonNavigation(lesson);
  const id = lesson.course.id,
    slug = lesson.slug;
  const [activityError, setActivityError] = useState("");
  const { data: practice, error: practiceError } = useContent(
    "/" +
      encodeURIComponent(id) +
      "/lessons/" +
      encodeURIComponent(slug) +
      "/exercise",
    parseExercise,
  );
  const exercise = practice?.exercise;
  useEffect(() => {
    rememberLesson(id, slug);
    let alive = true;
    void recordActivity("visit", JSON.stringify([id, slug])).catch(
      (failure: unknown) => {
        if (alive)
          setActivityError(
            failure instanceof Error
              ? failure.message
              : "Atividade não registrada.",
          );
      },
    );
    return () => {
      alive = false;
    };
  }, [id, slug]);
  const body = lessonBody(lesson.markdown, lesson.title);
  const headings = outlineHeadings(body);
  let placedExercise = false;
  try {
    placedExercise = validateEditorial(body);
  } catch {
    /* Invalid blocks are displayed explicitly by the renderer. */
  }
  const exercisePrompt = exercise && (
    <section aria-labelledby="exercise-title" className="inline-exercise">
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
      <p className="text-sm leading-relaxed text-subtle">{exercise.expected}</p>
    </section>
  );
  return (
    <div className={`reader-layout ${exercise ? "practice-layout" : ""}`}>
      <Page
        title={`${lesson.title} · ${lesson.course.title}`}
        className={`lesson-reader ${exercise ? "practice-workspace" : ""}`}
      >
        {activityError && (
          <p role="status" className="text-xs text-subtle">
            Acesso não registrado: {activityError}
          </p>
        )}
        {!exercise && <LessonNavigation lesson={lesson} />}
        <StudySplit
          key={exercise ? "practice" : "reading"}
          practice={!!exercise}
          left={
            <ReadingArticle>
              <header className="lesson-heading">
                <p className="eyebrow">
                  {lesson.course.title} · lição{" "}
                  {lesson.course.lessons.findIndex(
                    (item) => item.slug === slug,
                  ) + 1}
                </p>
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
                  <LessonMarkdown source={body} exercise={exercisePrompt} />
                ) : (
                  <p>
                    Esta lição ainda está vazia. Escreva seu conteúdo no arquivo
                    Markdown.
                  </p>
                )}
              </div>
              {!placedExercise && exercisePrompt}
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
            </ReadingArticle>
          }
          right={
            exercise ? (
              <div
                aria-label="Área de código"
                className="programming-workspace min-w-0"
              >
                <LessonNavigation lesson={lesson} />
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
            ) : headings.length > 0 ? (
              <LessonOutline headings={headings} />
            ) : undefined
          }
        />
      </Page>
    </div>
  );
}
