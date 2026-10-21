import { Link, useParams } from "react-router";
import { BookOpen } from "lucide-react";
import {
  lessonPath,
  useContent,
  parseCourse,
  parseCourses,
  incompatibleContent,
} from "./api";
import { Page } from "./Page";
import { ContentStatus } from "./ContentStatus";
import { CourseCard } from "../product/CourseCard";
import { CourseArtwork } from "../product/CourseArtwork";
import { discoverableCourses } from "../product/course-visibility";

export function CoursesPage() {
  const { data, error } = useContent("", parseCourses);
  if (!data) return <ContentStatus error={error} />;
  const courses = discoverableCourses(data);
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
        <section aria-labelledby="lessons-title" className="course-lessons">
          <h2 id="lessons-title">Lições</h2>
          {course.lessons.length === 0 ? (
            <p className="empty-content text-subtle">
              Este curso ainda não tem lições. Elas aparecerão aqui quando você
              adicionar conteúdo ao curso.
            </p>
          ) : (
            <ol className="lesson-list">
              {course.lessons.map((lesson, index) => (
                <li key={lesson.slug}>
                  <Link
                    className="course-lesson"
                    to={lessonPath(id, lesson.slug)}
                  >
                    <span className="lesson-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="course-lesson-title">{lesson.title}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </Page>
  );
}
