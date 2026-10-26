import { useEffect, useRef, useState } from "react";
import {
  parseNewLesson,
  suggestLessonSlug,
  type LessonEntry,
} from "@bunkercode/content";
import { createLesson, type EditableLesson } from "./studio-api";
import "./studio.css";

export function NewLessonDialog({
  courseId,
  onClose,
  onCreated,
}: {
  courseId: string;
  onClose: () => void;
  onCreated: (lesson: EditableLesson) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [customSlug, setCustomSlug] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const pending = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const node = dialog.current;
    node?.showModal();
    return () => {
      alive.current = false;
      node?.close();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="studio-create-dialog"
      aria-labelledby="new-lesson-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending.current) onClose();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (pending.current) return;
          let entry: LessonEntry;
          try {
            entry = parseNewLesson({ title, slug });
          } catch (failure) {
            setError(
              failure instanceof Error ? failure.message : "Dados inválidos.",
            );
            return;
          }
          pending.current = true;
          setCreating(true);
          setError("");
          void createLesson(courseId, entry)
            .then((lesson) => {
              if (alive.current) onCreated(lesson);
            })
            .catch((failure: unknown) => {
              if (!alive.current) return;
              setError(
                failure instanceof Error
                  ? failure.message
                  : "Não foi possível confirmar a criação. Confira as lições do curso antes de repetir.",
              );
            })
            .finally(() => {
              pending.current = false;
              if (alive.current) setCreating(false);
            });
        }}
      >
        <h2 id="new-lesson-title">Nova lição</h2>
        <p>
          A lição será acrescentada ao final deste curso e aberta no Studio.
        </p>
        <fieldset disabled={creating}>
          <label>
            Título
            <input
              autoFocus
              required
              maxLength={160}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (!customSlug) setSlug(suggestLessonSlug(event.target.value));
              }}
            />
          </label>
          <label>
            Slug
            <input
              required
              maxLength={80}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={slug}
              onChange={(event) => {
                setCustomSlug(true);
                setSlug(event.target.value);
              }}
            />
          </label>
        </fieldset>
        {error && <p role="alert">{error}</p>}
        <div className="studio-review-actions">
          <button type="button" disabled={creating} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" disabled={creating}>
            {creating ? "Criando…" : "Criar lição"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
