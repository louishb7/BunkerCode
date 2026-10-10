import { useEffect, useRef, useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import type { SelectionBookmark, Transaction } from "@tiptap/pm/state";
import {
  Bold,
  Italic,
  Code2,
  Undo2,
  Redo2,
  Link2,
  List,
  ListOrdered,
} from "lucide-react";

function safeLink(value: string) {
  if (
    !value ||
    /[\\\s]/.test(value) ||
    [...value].some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    ) ||
    !/^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(value)
  )
    return false;
  try {
    const url = new URL(value, location.origin);
    return ["http:", "https:", "mailto:"].includes(url.protocol);
  } catch {
    return false;
  }
}

export function VisualToolbar({
  editor,
  disabled,
}: {
  editor: Editor;
  disabled: boolean;
}) {
  const [link, setLink] = useState(false);
  const [lists, setLists] = useState(false);
  const [href, setHref] = useState("");
  const [error, setError] = useState("");
  const bookmark = useRef<SelectionBookmark | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const linkButton = useRef<HTMLButtonElement>(null);
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      code: e.isActive("code"),
      link: e.isActive("link"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      heading: e.isActive("heading")
        ? String(e.getAttributes("heading").level)
        : "paragraph",
    }),
  });
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !root.current?.contains(event.target)
      ) {
        setLink(false);
        setLists(false);
      }
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  useEffect(() => {
    if (!link) return;
    const map = ({ transaction }: { transaction: Transaction }) => {
      if (bookmark.current)
        bookmark.current = bookmark.current.map(transaction.mapping);
    };
    editor.on("transaction", map);
    return () => {
      editor.off("transaction", map);
    };
  }, [editor, link]);
  function restore() {
    if (bookmark.current)
      editor.commands.setTextSelection(
        bookmark.current.resolve(editor.state.doc),
      );
    editor.view.focus();
  }
  function cancel() {
    setLink(false);
    setLists(false);
    restore();
  }
  return (
    <div
      ref={root}
      className="visual-toolbar"
      role="group"
      aria-label="Formatação do conteúdo"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        }
      }}
    >
      <select
        aria-label="Estilo do texto"
        value={state.heading}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value === "paragraph")
            editor.chain().focus().setParagraph().run();
          else
            editor
              .chain()
              .focus()
              .toggleHeading({ level: Number(e.target.value) as 1 | 2 | 3 })
              .run();
        }}
      >
        <option value="paragraph">Parágrafo</option>
        <option value="1">Título 1</option>
        <option value="2">Título 2</option>
        <option value="3">Título 3</option>
      </select>
      <button
        type="button"
        title="Negrito"
        aria-label="Negrito"
        aria-pressed={state.bold}
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={18} />
      </button>
      <button
        type="button"
        title="Itálico"
        aria-label="Itálico"
        aria-pressed={state.italic}
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={18} />
      </button>
      <div className="toolbar-popover-anchor">
        <button
          type="button"
          title="Listas"
          aria-label="Listas"
          aria-expanded={lists}
          aria-pressed={state.bullet || state.ordered}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setLists(!lists);
            setLink(false);
          }}
        >
          <List size={18} />
        </button>
        {lists && (
          <div
            className="toolbar-popover list-popover"
            role="group"
            aria-label="Tipo de lista"
          >
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                editor.chain().focus().toggleBulletList().run();
                setLists(false);
              }}
            >
              <List size={18} />
              Lista com marcadores
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                editor.chain().focus().toggleOrderedList().run();
                setLists(false);
              }}
            >
              <ListOrdered size={18} />
              Lista numerada
            </button>
          </div>
        )}
      </div>
      <div className="toolbar-popover-anchor">
        <button
          ref={linkButton}
          type="button"
          title="Adicionar ou editar link"
          aria-label="Link"
          aria-expanded={link}
          aria-pressed={state.link}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (link) {
              cancel();
              return;
            }
            editor.commands.extendMarkRange("link");
            bookmark.current = editor.state.selection.getBookmark();
            setHref(String(editor.getAttributes("link").href ?? ""));
            setError("");
            setLists(false);
            setLink(true);
          }}
        >
          <Link2 size={18} />
        </button>
        {link && (
          <form
            className="toolbar-popover link-popover"
            aria-label="Editar link"
            onSubmit={(event) => {
              event.preventDefault();
              const value = href.trim();
              if (!safeLink(value)) {
                setError(
                  "Use uma URL http, https, mailto, caminho local ou âncora segura.",
                );
                return;
              }
              restore();
              if (editor.state.selection.empty)
                editor
                  .chain()
                  .insertContent({
                    type: "text",
                    text: value,
                    marks: [{ type: "link", attrs: { href: value } }],
                  })
                  .run();
              else editor.chain().setLink({ href: value }).run();
              setLink(false);
            }}
          >
            <label>
              URL
              <input
                autoFocus
                type="text"
                value={href}
                onChange={(e) => {
                  setHref(e.target.value);
                  setError("");
                }}
                placeholder="https://…"
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <div>
              <button type="submit">Confirmar</button>
              <button type="button" onClick={cancel}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  restore();
                  editor.chain().unsetLink().run();
                  setLink(false);
                }}
              >
                Remover link
              </button>
            </div>
          </form>
        )}
      </div>
      <button
        type="button"
        title="Código inline · trecho no texto"
        aria-label="Código inline"
        aria-pressed={state.code}
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code2 size={18} />
      </button>
      <span className="toolbar-separator" aria-hidden="true" />
      <button
        type="button"
        title="Desfazer"
        aria-label="Desfazer"
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 size={18} />
      </button>
      <button
        type="button"
        title="Refazer"
        aria-label="Refazer"
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 size={18} />
      </button>
    </div>
  );
}
