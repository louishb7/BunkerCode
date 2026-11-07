import { useLearning } from "../learning/Learning";
import { useAuth } from "../auth/Auth";
import { Link, useNavigate, useParams } from "react-router";
import { lazy, Suspense, useState } from "react";
import { BookOpen } from "lucide-react";
import {
  courseSections,
  lessonPath,
  useContent,
  parseCourse,
  parseCourses,
  incompatibleContent,
  type LessonEntry,
  type CourseModule,
} from "./api";
import { Page } from "./Page";
import { ContentStatus } from "./ContentStatus";
import { CourseCard } from "../product/CourseCard";
import { CourseArtwork } from "../product/CourseArtwork";
import { discoverableCourses } from "../product/course-visibility";

const NewLessonDialog = __BUNKERCODE_AUTHORING__
  ? lazy(() =>
      import("./NewLessonDialog").then((module) => ({
        default: module.NewLessonDialog,
      })),
    )
  : undefined;

function LessonLink({
  courseId,
  lesson,
  index,
}: {
  courseId: string;
  lesson: LessonEntry;
  index: number;
}) {
  const { summary } = useLearning();
  const completed = summary?.courses
    .find((c) => c.courseId === courseId)
    ?.completed.includes(lesson.slug);
  return (
    <li>
      <Link className="course-lesson" to={lessonPath(courseId, lesson.slug)}>
        <span className="lesson-number">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="course-lesson-title">
          {lesson.title}
          {completed && (
            <span className="text-sm text-subtle"> · Concluída</span>
          )}
        </span>
      </Link>
    </li>
  );
}

function ModuleHeading({
  module,
  index,
}: {
  module: CourseModule;
  index: number;
}) {
  return (
    <header className="course-module-header">
      <h3 className="course-module-heading" id={`course-module-${module.id}`}>
        <span className="course-module-label">
          Módulo {String(module.number ?? index + 1).padStart(2, "0")}
        </span>{" "}
        <span className="course-module-title">{module.title}</span>
      </h3>
      {module.description && (
        <p className="course-module-description">{module.description}</p>
      )}
    </header>
  );
}

export function CoursesPage() {
  const { user } = useAuth();
  const { data, error } = useContent("", parseCourses);
  if (!data) return <ContentStatus error={error} />;
  const courses = discoverableCourses(data, user?.role === "ADMIN");
  return (
    <Page title="Cursos" className="product-page catalog-page">
      <h1 className="catalog-heading">Cursos</h1>
      {courses.length === 0 ? (
        <p className="empty-content text-subtle">
          Nenhum curso disponível nesta seleção.
        </p>
      ) : (
        <div className="course-list">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} headingLevel="h2" />
          ))}
        </div>
      )}
    </Page>
  );
}
export function CoursePage() {
  const { user } = useAuth();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { summary, error: progressError } = useLearning();
  const progress = summary?.courses.find((c) => c.courseId === id);
  const [creating, setCreating] = useState(false);
  const { data: course, error } = useContent(
    "/" + encodeURIComponent(id),
    parseCourse,
  );
  if (!course || course.id !== id)
    return (
      <ContentStatus error={error || (course ? incompatibleContent : "")} />
    );
  return (
    <Page title={course.title} className="product-page course-page">
      <div className="course-column">
        <header className="course-introduction">
          <div className="course-identity">
            <CourseArtwork id={id} />
            <h1>{course.title}</h1>
          </div>
          <p className="course-full-description">{course.description}</p>
          <p className="course-metadata">
            <BookOpen className="product-icon" aria-hidden="true" />
            {course.lessons.length}{" "}
            {course.lessons.length === 1 ? "lição" : "lições"}
          </p>
        </header>
        {progress && (
          <p className="text-sm text-subtle">
            {progress.completed.length} de {progress.total} lições publicadas
            concluídas
          </p>
        )}
        {user && progressError && <p role="status">{progressError}</p>}
        <section aria-labelledby="lessons-title" className="course-lessons">
          <h2 id="lessons-title">Lições</h2>
          {course.lessons.length === 0 ? (
            <div className="empty-content">
              {course.modules?.map((module, index) => (
                <section
                  className="course-module"
                  key={module.id}
                  aria-labelledby={`course-module-${module.id}`}
                >
                  <ModuleHeading module={module} index={index} />
                </section>
              ))}
              <p className="text-subtle">Este curso ainda não tem lições.</p>
              {NewLessonDialog && user?.role === "ADMIN" && (
                <button type="button" onClick={() => setCreating(true)}>
                  Criar primeira lição
                </button>
              )}
            </div>
          ) : course.modules ? (
            <div className="course-modules">
              {courseSections(course).map(({ module, lessons }, moduleIndex) =>
                module ? (
                  <section
                    className="course-module"
                    key={module.id}
                    aria-labelledby={`course-module-${module.id}`}
                  >
                    <ModuleHeading module={module} index={moduleIndex} />
                    <ol
                      className="lesson-list"
                      start={(lessons[0]?.index ?? 0) + 1}
                    >
                      {lessons.map(({ lesson, index }) => (
                        <LessonLink
                          key={lesson.slug}
                          courseId={id}
                          lesson={lesson}
                          index={index}
                        />
                      ))}
                    </ol>
                  </section>
                ) : null,
              )}
            </div>
          ) : (
            <ol className="lesson-list">
              {course.lessons.map((lesson, index) => (
                <LessonLink
                  key={lesson.slug}
                  courseId={id}
                  lesson={lesson}
                  index={index}
                />
              ))}
            </ol>
          )}
        </section>
      </div>
      {creating && NewLessonDialog && user?.role === "ADMIN" && (
        <Suspense fallback={<p role="status">Abrindo criação de lição…</p>}>
          <NewLessonDialog
            courseId={id}
            onClose={() => setCreating(false)}
            onCreated={(lesson) =>
              navigate(lessonPath(id, lesson.slug) + "/edit")
            }
          />
        </Suspense>
      )}
    </Page>
  );
}
