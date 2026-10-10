import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
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
      className="product-link product-primary text-sm"
      to={lessonPath(recent.course, lesson.slug)}
    >
      Continuar estudando{" "}
      <ArrowRight className="product-icon" aria-hidden="true" />
    </Link>
  ) : (
    <Link className="product-link text-sm" to="/courses">
      Escolher um curso →
    </Link>
  );
}
export function HomePage() {
  const { data, error } = useContent("", parseCourses);
  const [recent] = useState(recentLesson);
  return (
    <Page title="Início" className="product-page dashboard-page">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="eyebrow mt-0 mb-2">BunkerCode · seu espaço de estudo</p>
          <h1 className="m-0 text-3xl font-semibold tracking-tight sm:text-4xl">
            Aprenda. Escreva. Explore.
          </h1>
          <p className="mb-0 mt-3 text-sm text-subtle">
            Sua atividade e seus cursos, em um só lugar.
          </p>
        </div>
        {recent ? (
          <ContinueStudy recent={recent} />
        ) : (
          <Link className="product-link product-primary text-sm" to="/courses">
            Começar um curso{" "}
            <ArrowRight className="product-icon" aria-hidden="true" />
          </Link>
        )}
      </header>
      <ActivityDashboard />
      <section aria-labelledby="home-courses" className="mt-9">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id="home-courses" className="m-0 text-xl">
            Explore os cursos
          </h2>
          <Link to="/courses" className="shrink-0 text-sm">
            Ver catálogo →
          </Link>
        </div>
        {error ? (
          <div role="alert">
            <p>{error}</p>
            <button onClick={() => window.location.reload()}>
              Tentar novamente
            </button>
          </div>
        ) : !data ? (
          <p role="status">Carregando cursos…</p>
        ) : !data.length ? (
          <p className="text-subtle">
            Nenhum curso publicado. Seus cursos aparecerão aqui quando você
            adicionar conteúdo.
          </p>
        ) : (
          <div className="course-list grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {data.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </section>
    </Page>
  );
}
