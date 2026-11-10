import {
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { NodeViewProps } from "@tiptap/react";
import { closeHistory } from "@tiptap/pm/history";
import { parseNote, ottoComment, type Note } from "@bunkercode/content";
import { Bold, Italic, Code2, List, Link2 } from "lucide-react";
import { NoteBlock } from "../courses/EditorialBlock";
import { NoteEditingContext } from "./note-editing";
import { safeAuthoringLink } from "./authoring-links";
import {
  wrapNoteText,
  listNoteText,
  linkNoteText,
  type TextEdit,
  type TextSelection,
} from "./note-formatting";

type NoteType = Note["kind"] | "otto";
function editableNote(note: Note): { type: NoteType; text: string } {
  const comment = ottoComment(note.text);
  return {
    type: comment === null ? note.kind : "otto",
    text: comment ?? note.text,
  };
}
export function StudioNote({
  note,
  selected,
  editor,
  getPos,
  onPendingChange,
}: Pick<NodeViewProps, "selected" | "editor" | "getPos"> & {
  note: Note;
  onPendingChange: (pending: boolean) => void;
}) {
  const [editing, setEditing] = useState(selected);
  const [draft, setDraft] = useState(() => editableNote(note));
  const [error, setError] = useState("");
  const [link, setLink] = useState(false);
  const [href, setHref] = useState("");
  const id = useId();
  const reportPending = useContext(NoteEditingContext);
  const text = useRef<HTMLTextAreaElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const selection = useRef<TextSelection>({ start: 0, end: 0 });
  const restore = useRef<TextSelection | null>(null);
  const focusClosed = useRef(false);
  const composing = useRef(false);
  const original = editableNote(note);
  const pending =
    editing && (original.type !== draft.type || original.text !== draft.text);
  useEffect(() => {
    if (selected && !editing) {
      setDraft(editableNote(note));
      setEditing(true);
    }
  }, [selected]);
  useEffect(() => {
    reportPending(id, pending);
    onPendingChange(pending);
    return () => reportPending(id, false);
  }, [reportPending, id, pending, onPendingChange]);
  useLayoutEffect(() => {
    if (restore.current && text.current) {
      text.current.focus();
      text.current.setSelectionRange(
        restore.current.start,
        restore.current.end,
      );
      selection.current = restore.current;
      restore.current = null;
    }
    if (!editing && focusClosed.current) {
      editButton.current?.focus();
      focusClosed.current = false;
    }
  });
  function open() {
    setDraft(editableNote(note));
    setError("");
    setLink(false);
    setEditing(true);
  }
  function change(edit: TextEdit) {
    if (composing.current) return;
    restore.current = edit;
    setDraft({ ...draft, text: edit.text });
    setError("");
  }
  function format(kind: "bold" | "italic" | "code" | "list") {
    if (kind === "list") change(listNoteText(draft.text, selection.current));
    else {
      const selectedText = draft.text.slice(
        selection.current.start,
        selection.current.end,
      );
      const marker =
        kind === "bold"
          ? "**"
          : kind === "italic"
            ? "*"
            : "`".repeat(
                Math.max(
                  0,
                  ...[...selectedText.matchAll(/`+/g)].map(
                    (match) => match[0].length,
                  ),
                ) + 1,
              );
      change(
        wrapNoteText(
          draft.text,
          selection.current,
          marker,
          kind === "code" ? "código" : "texto",
        ),
      );
    }
  }
  function close() {
    setEditing(false);
    setLink(false);
    setError("");
    focusClosed.current = true;
  }
  if (!editing)
    return (
      <>
        <NoteBlock note={note} />
        <button
          ref={editButton}
          type="button"
          className="note-edit-trigger"
          onClick={open}
        >
          Editar nota
        </button>
      </>
    );
  return (
    <div className="note-author">
      <label>
        Tipo de nota
        <select
          value={draft.type}
          onChange={(event) =>
            setDraft({ ...draft, type: event.target.value as NoteType })
          }
        >
          <option value="info">Informação</option>
          <option value="tip">Dica</option>
          <option value="warning">Aviso</option>
          <option value="otto">Otto</option>
        </select>
      </label>
      <div
        className="note-formatting"
        role="group"
        aria-label="Formatação da nota"
      >
        {(
          [
            ["bold", "Negrito", Bold],
            ["italic", "Itálico", Italic],
            ["code", "Código inline", Code2],
            ["list", "Lista com marcadores", List],
          ] as const
        ).map(([kind, label, Icon]) => (
          <button
            key={kind}
            type="button"
            title={label}
            aria-label={label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => format(kind)}
          >
            <Icon size={18} aria-hidden="true" />
          </button>
        ))}
        <button
          type="button"
          title="Link"
          aria-label="Link"
          aria-expanded={link}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setLink(!link);
            setHref("");
            setError("");
          }}
        >
          <Link2 size={18} aria-hidden="true" />
        </button>
      </div>
      {link && (
        <div className="note-link" role="group" aria-label="Link da nota">
          <label>
            URL
            <input
              autoFocus
              value={href}
              onChange={(event) => {
                setHref(event.target.value);
                setError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.stopPropagation();
                  setLink(false);
                  text.current?.focus();
                }
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              if (!safeAuthoringLink(href.trim())) {
                setError(
                  "Use uma URL http, https, mailto, caminho local ou âncora segura.",
                );
                return;
              }
              change(linkNoteText(draft.text, selection.current, href.trim()));
              setLink(false);
            }}
          >
            Inserir link
          </button>
          <button
            type="button"
            onClick={() => {
              setLink(false);
              text.current?.focus();
            }}
          >
            Cancelar link
          </button>
        </div>
      )}
      <label htmlFor={`${id}-text`}>Texto da nota</label>
      <textarea
        id={`${id}-text`}
        ref={text}
        value={draft.text}
        aria-describedby={`${id}-help`}
        onChange={(event) => {
          setDraft({ ...draft, text: event.target.value });
          setError("");
        }}
        onSelect={(event) => {
          selection.current = {
            start: event.currentTarget.selectionStart,
            end: event.currentTarget.selectionEnd,
          };
        }}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || composing.current) return;
          if (
            (event.ctrlKey || event.metaKey) &&
            !event.altKey &&
            ["b", "i"].includes(event.key.toLowerCase())
          ) {
            event.preventDefault();
            event.stopPropagation();
            format(event.key.toLowerCase() === "b" ? "bold" : "italic");
          } else if (event.shiftKey && event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            const { start, end } = selection.current;
            change({
              text: draft.text.slice(0, start) + "\\\n" + draft.text.slice(end),
              start: start + 2,
              end: start + 2,
            });
          }
        }}
      />
      <p id={`${id}-help`} className="studio-caption">
        Linha vazia: novo parágrafo · Shift+Enter: quebra de linha. Aplique a
        nota antes de salvar a lição.
      </p>
      {error && (
        <p role="alert" className="note-error">
          {error}
        </p>
      )}
      <div className="note-actions">
        <button
          type="button"
          onClick={() => {
            setDraft(editableNote(note));
            close();
          }}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="note-apply"
          onClick={() => {
            try {
              const data = parseNote({
                kind: draft.type === "otto" ? note.kind : draft.type,
                text:
                  draft.type === "otto"
                    ? "**Otto**\n\n" + draft.text
                    : draft.text,
              });
              if (!draft.text.trim())
                throw new Error("Escreva o texto da nota antes de aplicar.");
              const pos = getPos();
              if (typeof pos !== "number") return;
              editor.view.dispatch(
                closeHistory(editor.state.tr).setNodeMarkup(pos, undefined, {
                  ...editor.state.doc.nodeAt(pos)!.attrs,
                  data,
                }),
              );
              close();
            } catch (failure) {
              setError(
                failure instanceof Error
                  ? failure.message
                  : "Não foi possível aplicar a nota.",
              );
            }
          }}
        >
          Aplicar nota
        </button>
      </div>
    </div>
  );
}
