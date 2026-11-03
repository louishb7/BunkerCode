import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Link } from "react-router";
import { lessonPath, type Course } from "./api";

type Menu = {
  kind: "modules" | "lessons";
  left: number;
  top: number;
  width: number;
};

export function LessonIndex({
  course,
  slug,
}: {
  course: Course;
  slug: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const moduleTrigger = useRef<HTMLButtonElement>(null);
  const lessonTrigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState<Menu | null>(null);
  const current = course.lessons.find((entry) => entry.slug === slug)!;
  const moduleIndex =
    course.modules?.findIndex((entry) => entry.id === current.moduleId) ?? -1;
  const module = course.modules?.[moduleIndex];
  const moduleNumber = String(module?.number ?? moduleIndex + 1).padStart(
    2,
    "0",
  );
  const lessons = module
    ? course.lessons.filter((entry) => entry.moduleId === module.id)
    : course.lessons;
  const lessonNumber = String(
    lessons.findIndex((entry) => entry.slug === slug) + 1,
  ).padStart(2, "0");
  const moduleLabel = module
    ? `Módulo ${moduleNumber} · ${module.title}`
    : course.title;

  function toggle(kind: Menu["kind"], button: HTMLButtonElement) {
    if (open?.kind === kind) {
      setOpen(null);
      return;
    }
    const bounds = button.getBoundingClientRect();
    const width = Math.min(440, innerWidth - 24);
    setOpen({
      kind,
      width,
      left: Math.max(12, Math.min(bounds.left, innerWidth - width - 12)),
      top: bounds.bottom + 6,
    });
  }
  useEffect(() => {
    if (!open) return;
    const trigger =
      open.kind === "modules" ? moduleTrigger.current : lessonTrigger.current;
    (
      panel.current?.querySelector<HTMLElement>("[aria-current]") ??
      panel.current?.querySelector<HTMLElement>("[data-lesson-choice]")
    )?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(null);
    };
    const close = () => {
      setOpen(null);
      trigger?.focus();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", close);
    };
  }, [open]);
  function choose() {
    (open?.kind === "modules" ? moduleTrigger : lessonTrigger).current?.focus();
    setOpen(null);
  }
  return (
    <div
      ref={root}
      className="lesson-index"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(null);
      }}
    >
      {module && course.modules!.length > 1 ? (
        <button
          ref={moduleTrigger}
          className="lesson-module-trigger lesson-context-trigger"
          type="button"
          aria-label="Módulos"
          aria-describedby="module-selection-label"
          aria-expanded={open?.kind === "modules"}
          aria-controls="module-index"
          title={moduleLabel}
          onClick={(event) => toggle("modules", event.currentTarget)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              toggle("modules", event.currentTarget);
            }
          }}
        >
          <span id="module-selection-label" className="sr-only">
            {moduleLabel}
          </span>
          <span aria-hidden="true">
            <span className="module-label-long">{moduleLabel}</span>
            <span className="module-label-short" aria-hidden="true">
              M{moduleNumber}
            </span>
          </span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      ) : (
        <span
          className={`lesson-course-context ${module ? "has-module" : ""}`}
          title={moduleLabel}
        >
          <span className="module-label-long">{moduleLabel}</span>
          {module && (
            <span className="module-label-short">M{moduleNumber}</span>
          )}
        </span>
      )}
      <button
        ref={lessonTrigger}
        className="lesson-index-trigger lesson-context-trigger"
        type="button"
        aria-label="Lições"
        aria-describedby="lesson-selection-label"
        aria-expanded={open?.kind === "lessons"}
        aria-controls="lesson-index"
        title={`Lição ${lessonNumber} · ${current.title}`}
        onClick={(event) => toggle("lessons", event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            toggle("lessons", event.currentTarget);
          }
        }}
      >
        <span id="lesson-selection-label">
          {lessonNumber} · {current.title}
        </span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <nav
          ref={panel}
          className="lesson-selector-panel"
          id={open.kind === "modules" ? "module-index" : "lesson-index"}
          aria-label={
            open.kind === "modules" ? "Módulos do curso" : "Lições do curso"
          }
          style={{
            left: open.left,
            top: open.top,
            width: open.width,
            maxHeight: `min(480px, calc(100dvh - ${open.top + 12}px))`,
          }}
          onKeyDown={(event) => {
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            const choices = Array.from(
              event.currentTarget.querySelectorAll<HTMLAnchorElement>(
                "[data-lesson-choice]",
              ),
            );
            const currentIndex = choices.findIndex(
              (entry) => entry === document.activeElement,
            );
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? choices.length - 1
                  : (currentIndex +
                      (event.key === "ArrowDown" ? 1 : -1) +
                      choices.length) %
                    choices.length;
            choices[next]?.focus();
          }}
        >
          <div className="lesson-selector-heading">
            <Link
              to={"/courses/" + encodeURIComponent(course.id)}
              aria-label={`Abrir curso ${course.title}`}
              onClick={choose}
            >
              {course.title}
            </Link>
            <span>
              {open.kind === "modules"
                ? "Módulos"
                : module
                  ? moduleLabel
                  : "Lições"}
            </span>
          </div>
          <ol>
            {open.kind === "modules"
              ? course.modules!.map((entry, index) => {
                  const first = course.lessons.find(
                    (lesson) => lesson.moduleId === entry.id,
                  )!;
                  return (
                    <li key={entry.id}>
                      <Link
                        data-lesson-choice
                        to={lessonPath(course.id, first.slug)}
                        aria-current={
                          entry.id === module?.id ? "true" : undefined
                        }
                        onClick={choose}
                      >
                        <span className="lesson-choice-number">
                          {String(entry.number ?? index + 1).padStart(2, "0")}
                        </span>
                        <span>{entry.title}</span>
                        {entry.id === module?.id && (
                          <Check size={15} aria-hidden="true" />
                        )}
                      </Link>
                    </li>
                  );
                })
              : lessons.map((entry, index) => (
                  <li key={entry.slug}>
                    <Link
                      data-lesson-choice
                      to={lessonPath(course.id, entry.slug)}
                      aria-current={entry.slug === slug ? "page" : undefined}
                      onClick={choose}
                    >
                      <span className="lesson-choice-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>{entry.title}</span>
                      {entry.slug === slug && (
                        <Check size={15} aria-hidden="true" />
                      )}
                    </Link>
                  </li>
                ))}
          </ol>
        </nav>
      )}
    </div>
  );
}
