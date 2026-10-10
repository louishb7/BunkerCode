import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { NavLink } from "react-router";
import { lessonPath, type Course } from "./api";

export function LessonIndex({ course }: { course: Course }) {
  const panel = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="lesson-index-trigger"
        title="Selecionar lição"
        aria-expanded={open}
        aria-controls="lesson-index"
        onClick={() => {
          panel.current?.showModal();
          setOpen(true);
        }}
      >
        Lições <ChevronDown size={16} aria-hidden="true" />
      </button>
      <dialog
        ref={panel}
        id="lesson-index"
        className="lesson-index"
        aria-labelledby="lesson-index-title"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.target === event.currentTarget &&
            (event.clientX < bounds.left ||
              event.clientX > bounds.right ||
              event.clientY < bounds.top ||
              event.clientY > bounds.bottom)
          )
            panel.current?.close();
        }}
      >
        <div className="lesson-index-heading">
          <h2 id="lesson-index-title">Lições · {course.title}</h2>
          <button autoFocus onClick={() => panel.current?.close()}>
            Fechar
          </button>
        </div>
        <nav aria-label="Lições do curso">
          <ol>
            {course.lessons.map((entry, index) => (
              <li key={entry.slug}>
                <NavLink
                  to={lessonPath(course.id, entry.slug)}
                  onClick={() => panel.current?.close()}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {entry.title}
                </NavLink>
              </li>
            ))}
          </ol>
        </nav>
      </dialog>
    </>
  );
}
