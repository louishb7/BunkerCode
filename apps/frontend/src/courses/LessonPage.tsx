import { useLearning } from "../learning/Learning";
import { learningRequest, learningLessonPath } from "../learning/api";
import { useAuth } from "../auth/Auth";
import { FilePenLine } from "lucide-react";
import { capabilities } from "../capabilities";
import {
  validateEditorial,
  lessonSqlPlacement,
  type SqlLessonPlacement,
} from "@bunkercode/content";
import { LessonAppearance, ReadingArticle, StudySplit } from "./ReadingTools";
import { recordActivity } from "../product/activity-store";
import { memo, lazy, Suspense, useEffect, useMemo, useState } from "react";
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

import { useSqlActivity } from "../sql-lab/api";
import type { SqlExercise } from "../sql-lab/exercise";
const SqlInteraction = lazy(() =>
  import("../sql-lab/SqlInteraction").then((module) => ({
    default: module.SqlInteraction,
  })),
);
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
  const { user } = useAuth();
  useLessonNavigation(lesson);
  const id = lesson.course.id,
    slug = lesson.slug;
  const [activityError, setActivityError] = useState("");
  const { summary, refresh, error: learningError } = useLearning();
  const eligible = summary?.courses.find((c) => c.courseId === id);
  const published = eligible?.lessons.includes(slug) ?? false;
  const completed = eligible?.completed.includes(slug) ?? false;
  const [syncError, setSyncError] = useState("");
  const [completing, setCompleting] = useState(false);
  useEffect(() => {
    if (!user || !published) return;
    const controller = new AbortController();
    // Defer to coalesce Strict Mode's repeated effect setup before sending a visit.
    const timer = setTimeout(() => {
      void learningRequest(
        learningLessonPath(id, slug) + "/visit",
        controller.signal,
        "POST",
        {},
      )
        .then(() => refresh())
        .catch(() => {
          if (!controller.signal.aborted)
            setSyncError(
              "Última visita não sincronizada. Recarregue para tentar novamente.",
            );
        });
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [user?.id, id, slug, published, refresh]);
  async function complete() {
    if (completing) return;
    setCompleting(true);
    setSyncError("");
    try {
      await learningRequest(
        learningLessonPath(id, slug) + "/complete",
        AbortSignal.timeout(10000),
        "POST",
        {},
      );
      refresh();
    } catch {
      setSyncError("Conclusão não salva. Tente novamente.");
    } finally {
      setCompleting(false);
    }
  }

  const [mobileView, setMobileView] = useState<"reading" | "code">("reading");
  const [sqlTaskTarget, setSqlTaskTarget] = useState<HTMLDivElement | null>(
    null,
  );
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
  let sqlReference: SqlLessonPlacement | null = null;
  let sqlError = "";
  let hasSql = false;
  try {
    const reference = lessonSqlPlacement(body);
    hasSql = !!reference;
    if (reference) {
      if (exercise)
        throw new Error(
          "Uma lição não pode misturar atividades SQL e JavaScript.",
        );
      // Recreated configuration is safe: session identity is explicit.
      sqlReference = reference;
    }
  } catch (error) {
    sqlError =
      error instanceof Error ? error.message : "Atividade SQL inválida.";
  }
  const sqlContent = useSqlActivity(sqlReference);
  const sqlExercise: SqlExercise | undefined = sqlContent.data?.exercise;
  const sqlSequence = sqlReference?.kind === "sql-task-sequence";
  sqlError ||= sqlContent.error ?? "";
  const interactive = !!exercise || hasSql;
  const lessonNumber =
    lesson.course.lessons.findIndex((item) => item.slug === slug) + 1;
  const moduleIndex =
    lesson.course.modules?.findIndex(
      (module) => module.id === lesson.moduleId,
    ) ?? -1;
  const module = lesson.course.modules?.[moduleIndex];
  let placedExercise = false;
  try {
    placedExercise = validateEditorial(body);
  } catch {
    /* Invalid blocks are displayed explicitly by the renderer. */
  }
  const exercisePrompt = useMemo(
    () =>
      exercise && (
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
          <p className="text-sm leading-relaxed text-subtle">
            {exercise.expected}
          </p>
        </section>
      ),
    [exercise],
  );
  return (
    <LessonAppearance practice={interactive} stacked={hasSql}>
      <LessonNavigation lesson={lesson} />
      <Page
        title={`${lesson.title} · ${lesson.course.title}`}
        className={`lesson-reader ${interactive ? "practice-workspace" : ""}`}
      >
        {interactive && !hasSql && (
          <div
            className="mobile-workspace-switch"
            role="group"
            aria-label="Visualização da aprendizagem"
          >
            <button
              aria-pressed={mobileView === "reading"}
              onClick={() => setMobileView("reading")}
            >
              Lição
            </button>
            <button
              aria-pressed={mobileView === "code"}
              onClick={() => setMobileView("code")}
            >
              Código
            </button>
            <div id="mobile-lesson-appearance" />
          </div>
        )}
        <StudySplit
          key={interactive ? "practice" : "reading"}
          practice={interactive}
          stacked={hasSql}
          mobileView={mobileView}
          left={
            <ReadingArticle
              codeView={mobileView === "code"}
              tools={
                capabilities.authoring &&
                user?.role === "ADMIN" && (
                  <Link
                    className="edit-lesson-link"
                    aria-label="Editar lição"
                    title="Editar lição"
                    to={lessonPath(id, slug) + "/edit"}
                  >
                    <FilePenLine size={19} aria-hidden="true" />
                  </Link>
                )
              }
            >
              {activityError && (
                <p role="status" className="text-xs text-subtle">
                  Acesso não registrado: {activityError}
                </p>
              )}
              <header className="lesson-heading">
                <p className="eyebrow">
                  {module &&
                    `Módulo ${String(module.number ?? moduleIndex + 1).padStart(2, "0")} · `}
                  Lição {String(lessonNumber).padStart(2, "0")}
                </p>
                <h1>{lesson.title}</h1>
              </header>
              <div className="prose">
                {body.trim() ? (
                  <LessonMarkdown
                    source={body}
                    exercise={exercisePrompt}
                    sqlExercise={
                      sqlError ? (
                        <p role="alert">{sqlError}</p>
                      ) : sqlExercise ? (
                        <></>
                      ) : hasSql ? (
                        <p role="status">Carregando atividade SQL…</p>
                      ) : undefined
                    }
                  />
                ) : (
                  <p>
                    Esta lição ainda está vazia. Escreva seu conteúdo no arquivo
                    Markdown.
                  </p>
                )}
              </div>
              {sqlExercise && (
                <div className="sql-lesson-tasks" ref={setSqlTaskTarget} />
              )}
              {!placedExercise && exercisePrompt}
              {user && learningError && (
                <p role="status">
                  {learningError}{" "}
                  <button type="button" onClick={refresh}>
                    Tentar sincronizar
                  </button>
                </p>
              )}
              {user && published && hasSql && completed && (
                <p className="text-sm text-subtle" role="status">
                  {sqlSequence
                    ? "Conclusão histórica registrada · a sequência atual é formativa"
                    : "Lição concluída"}
                </p>
              )}
              {user && hasSql && syncError && <p role="alert">{syncError}</p>}
              {user && published && !hasSql && (
                <div className="lesson-progress">
                  {completed ? (
                    <p role="status">
                      {sqlSequence
                        ? "Conclusão histórica registrada · a sequência atual é formativa"
                        : "Lição concluída"}
                    </p>
                  ) : practice &&
                    !exercise &&
                    !hasSql &&
                    !sqlError &&
                    !practiceError ? (
                    <button
                      type="button"
                      disabled={completing}
                      onClick={() => void complete()}
                    >
                      {completing ? "Salvando…" : "Marcar como concluída"}
                    </button>
                  ) : (
                    <p className="text-sm text-subtle">
                      Em andamento
                      {hasSql
                        ? sqlSequence
                          ? " · tarefas formativas; conclusão verificada ainda indisponível"
                          : " · conclusão por Submit SQL aprovado"
                        : exercise
                          ? " · conclusão por Submit aprovado"
                          : ""}
                    </p>
                  )}
                  {syncError && <p role="alert">{syncError}</p>}
                </div>
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
            </ReadingArticle>
          }
          right={
            sqlExercise ? (
              <div
                className="sql-lesson-workspace"
                aria-label="Área de código SQL"
              >
                <Suspense
                  fallback={<p role="status">Carregando atividade SQL…</p>}
                >
                  <SqlInteraction
                    exercise={sqlExercise}
                    tasks={sqlContent.data?.tasks}
                    continuation={
                      sqlSequence
                        ? lesson.next
                          ? {
                              to: lessonPath(id, lesson.next.slug),
                              label: "Continuar para a próxima lição",
                            }
                          : { to: `/courses/${id}`, label: "Voltar ao curso" }
                        : undefined
                    }
                    lessonAppearance
                    taskTarget={sqlTaskTarget}
                    lesson={
                      sqlSequence || (user?.role === "ADMIN" && !published)
                        ? undefined
                        : {
                            courseId: id,
                            lessonSlug: slug,
                            onCompleted: refresh,
                          }
                    }
                  />
                </Suspense>
              </div>
            ) : exercise ? (
              <div
                aria-label="Área de código"
                className="programming-workspace min-w-0"
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
            ) : undefined
          }
        />
      </Page>
    </LessonAppearance>
  );
}
