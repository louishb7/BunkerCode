import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, BookOpen, Code2, Clock3 } from "lucide-react";
import { Page } from "../courses/Page";
import {
  useContent,
  parseCourses,
  parseCourse,
  lessonPath,
} from "../courses/api";
import { CourseCard } from "./CourseCard";
import { Insignia } from "./Brand";
import { recentLesson, type RecentLesson } from "./recent";
function ContinueStudy({ recent }: { recent: RecentLesson }) {
  const { data } = useContent(
    "/" + encodeURIComponent(recent.course),
    parseCourse,
  );
  const lesson =
    data?.id === recent.course
      ? data.lessons.find((item) => item.slug === recent.slug)
      : undefined;
  if (!lesson || !data)
    return (
      <p className="m-0 text-sm leading-relaxed text-subtle">
        Escolha uma lição nos cursos para retomar seu estudo por aqui.
      </p>
    );
  return (
    <>
      <p className="mt-0 mb-2 text-xs text-subtle">
        Última lição acessada · {data.title}
      </p>
      <h3 className="m-0 mb-5 text-xl">{lesson.title}</h3>
      <Link className="product-link" to={lessonPath(data.id, lesson.slug)}>
        Continuar estudando{" "}
        <ArrowRight className="product-icon" aria-hidden="true" />
      </Link>
    </>
  );
}
export function HomePage() {
  const { data, error } = useContent("", parseCourses);
  const [recent] = useState(recentLesson);
  return (
    <Page title="Início" className="product-page">
      <section className="grid items-center gap-8 border-b border-line pb-9 md:grid-cols-[1fr_auto] md:pb-12">
        <div>
          <p className="eyebrow mb-4">Oficina de aprendizagem</p>
          <h1 className="product-title max-w-2xl leading-[1.12]">
            Entenda o código.
            <br />
            <span className="text-gold">Construa seu conhecimento.</span>
          </h1>
          <p className="mt-5 mb-6 max-w-xl text-base leading-relaxed text-subtle">
            Um espaço para estudar programação, escrever soluções e transformar
            suas descobertas em explicações próprias.
          </p>
          <Link className="product-link product-primary" to="/courses">
            Explorar cursos{" "}
            <ArrowRight className="product-icon" aria-hidden="true" />
          </Link>
        </div>
        <div className="hidden md:flex md:justify-center md:px-9">
          <Insignia large />
        </div>
      </section>
      <div className="mt-9 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <section aria-labelledby="home-courses">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 id="home-courses" className="m-0 text-xl">
              Seu próximo ponto de partida
            </h2>
            <Link to="/courses" className="shrink-0 text-sm">
              Ver cursos
            </Link>
          </div>
          {error ? (
            <div role="alert" className="rounded-xl border border-line p-5">
              <p>{error}</p>
              <button onClick={() => window.location.reload()}>
                Tentar novamente
              </button>
            </div>
          ) : !data ? (
            <p role="status">Carregando cursos…</p>
          ) : data.length === 0 ? (
            <p className="text-subtle">
              Nenhum curso publicado. Seus cursos aparecerão aqui quando você
              adicionar conteúdo.
            </p>
          ) : (
            <div className="grid gap-5">
              {data.slice(0, 2).map((course) => (
                <CourseCard key={course.id} course={course} compact />
              ))}
            </div>
          )}
        </section>
        <aside className="space-y-7">
          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="mt-0 mb-5 flex items-center gap-2 text-base">
              <Clock3 className="product-icon text-gold" aria-hidden="true" />
              Retome de onde parou
            </h2>
            {recent ? (
              <ContinueStudy recent={recent} />
            ) : (
              <p className="m-0 text-sm leading-relaxed text-subtle">
                Abra sua primeira lição. Seu último acesso ficará disponível
                aqui, neste navegador.
              </p>
            )}
          </section>
          <section className="px-1">
            <h2 className="mt-0 text-base">Aprender fazendo</h2>
            <div className="flex gap-3">
              <BookOpen
                className="mt-1 size-5 shrink-0 text-subtle"
                aria-hidden="true"
              />
              <p className="mt-0 text-sm leading-relaxed text-subtle">
                Leia no seu ritmo. A sequência do curso é um caminho, e você
                pode revisitar qualquer lição.
              </p>
            </div>
            <div className="flex gap-3">
              <Code2
                className="mt-1 size-5 shrink-0 text-subtle"
                aria-hidden="true"
              />
              <p className="mt-0 text-sm leading-relaxed text-subtle">
                Nas lições com prática, escreva código e guarde seu rascunho
                localmente.
              </p>
            </div>
            {data && (
              <p className="mt-5 border-t border-line pt-5 text-sm text-subtle">
                {data.length}{" "}
                {data.length === 1 ? "curso disponível" : "cursos disponíveis"}{" "}
                · {data.reduce((sum, course) => sum + course.lessonCount, 0)}{" "}
                lições
              </p>
            )}
          </section>
        </aside>
      </div>
    </Page>
  );
}
