import { useState } from "react";
import { Link } from "react-router";
import { Page } from "../courses/Page";
import {
  lessonPath,
  parseCourse,
  parseCourses,
  useContent,
} from "../courses/api";
import { recentLesson, type RecentLesson } from "./recent";
import { CourseCard } from "./CourseCard";
import { ActivityDashboard } from "./ActivityDashboard";
import { discoverableCourses } from "./course-visibility";
function ContinueStudy({ recent }: { recent: RecentLesson }) {
  const { data } = useContent(
    "/" + encodeURIComponent(recent.course),
    parseCourse,
  );
  const lesson =
    data?.id === recent.course
      ? data.lessons.find((item) => item.slug === recent.slug)
      : undefined;
  return lesson ? (
    <Link
      className="product-link text-sm"
      to={lessonPath(recent.course, lesson.slug)}
    >
      Continuar estudando →
    </Link>
  ) : (
    <Link className="product-link text-sm" to="/courses">
      Explorar cursos →
    </Link>
  );
}
export function HomePage() {
  const { data, error } = useContent("", parseCourses);
  const [recent] = useState(recentLesson);
  const courses = data ? discoverableCourses(data) : undefined;
  return (
    <Page title="Início" className="product-page dashboard-page">
      <h1 className="sr-only">Início</h1>
      <ActivityDashboard />
      <section aria-labelledby="home-courses" className="mt-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 id="home-courses" className="m-0 text-xl">
            Cursos
          </h2>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {recent ? (
              <>
                <ContinueStudy recent={recent} />
                <Link to="/courses">Ver catálogo →</Link>
              </>
            ) : (
              <Link className="product-link text-sm" to="/courses">
                Explorar cursos →
              </Link>
            )}
          </div>
        </div>
        {error ? (
          <div role="alert">
            <p>{error}</p>
            <button onClick={() => window.location.reload()}>
              Tentar novamente
            </button>
          </div>
        ) : !courses ? (
          <p role="status">Carregando cursos…</p>
        ) : !courses.length ? (
          <p className="text-subtle">Nenhum curso disponível nesta seleção.</p>
        ) : (
          <div className="course-list grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </section>
    </Page>
  );
}
