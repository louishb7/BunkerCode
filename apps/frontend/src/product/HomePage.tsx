import { ArrowRight, BookOpen } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Page } from "../courses/Page";
import {
  lessonPath,
  parseLesson,
  parseCourses,
  useContent,
  type CourseSummary,
} from "../courses/api";
import { recentLesson, type RecentLesson } from "./recent";
import { CourseCard } from "./CourseCard";
import { discoverableCourses } from "./course-visibility";

function StartStudy({ course }: { course?: CourseSummary }) {
  if (!course) return null;
  return (
    <section className="continue-study" aria-labelledby="start-title">
      <h2 id="start-title">Começar a estudar</h2>
      <Link
        to={"/courses/" + encodeURIComponent(course.id)}
        aria-label="Começar a estudar →"
        aria-describedby="start-course"
        className="continue-link"
      >
        <BookOpen size={22} aria-hidden="true" />
        <span id="start-course">
          <strong>{course.title}</strong>
        </span>
        <ArrowRight size={20} aria-hidden="true" />
      </Link>
    </section>
  );
}
function ContinueStudy({
  recent,
  fallback,
}: {
  recent: RecentLesson;
  fallback?: CourseSummary;
}) {
  const { data } = useContent(
    "/" +
      encodeURIComponent(recent.course) +
      "/lessons/" +
      encodeURIComponent(recent.slug),
    parseLesson,
  );
  const lesson =
    data?.course.id === recent.course && data.slug === recent.slug
      ? data
      : undefined;
  if (!lesson || !data) return <StartStudy course={fallback} />;
  return (
    <section className="continue-study" aria-labelledby="continue-title">
      <h2 id="continue-title">Continuar estudando</h2>
      <Link
        to={lessonPath(recent.course, lesson.slug)}
        aria-label="Continuar estudando →"
        aria-describedby="continue-lesson"
        className="continue-link"
      >
        <BookOpen size={22} aria-hidden="true" />
        <span id="continue-lesson">
          <span className="continue-course">{data.course.title}</span>
          <strong>{lesson.title}</strong>
        </span>
        <ArrowRight size={20} aria-hidden="true" />
      </Link>
    </section>
  );
}
export function HomePage() {
  const { data, error } = useContent("", parseCourses);
  const [recent] = useState(recentLesson);
  const courses = data ? discoverableCourses(data) : undefined;
  const firstCourse = courses?.find((course) => course.lessonCount > 0);
  return (
    <Page title="Início" className="product-page dashboard-page">
      <h1 className="sr-only">Início</h1>
      <div className="home-study-overview">
        {recent ? (
          <ContinueStudy recent={recent} fallback={firstCourse} />
        ) : (
          <StartStudy course={firstCourse} />
        )}
      </div>
      <section aria-labelledby="home-courses" className="home-courses">
        <div className="collection-heading">
          <h2 id="home-courses">Cursos disponíveis</h2>
          <Link className="collection-link" to="/courses">
            Explorar cursos →
          </Link>
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
          <div className="course-list">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </section>
    </Page>
  );
}
