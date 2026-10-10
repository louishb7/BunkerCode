import { closeHistory } from "@tiptap/pm/history";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { CodeView, EditorialView } from "./StudioBlocks";
import { VisualToolbar } from "./VisualToolbar";
import { useEffect, useRef, useState } from "react";
import {
  EditorContent,
  ReactNodeViewRenderer,
  useEditor,
  type JSONContent,
} from "@tiptap/react";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { Plus } from "lucide-react";
import { EditorialBlock, VisualCode, openVisual } from "./visual-markdown";
function insertionPoint(editor: Editor) {
  const { selection } = editor.state;
  if (selection.$from.depth)
    return {
      start: selection.$from.before(1),
      after: selection.$from.after(1),
    };
  const node = editor.state.doc.nodeAt(selection.from);
  return {
    start: selection.from,
    after: selection.from + (node?.nodeSize ?? 0),
  };
}

const extensions = [
  StarterKit.configure({
    codeBlock: false,
    underline: false,
    trailingNode: false,
    link: { openOnClick: false },
  }),
  VisualCode.extend({
    addNodeView() {
      return ReactNodeViewRenderer(CodeView, {
        ignoreMutation: () => true,
        stopEvent: () => true,
      });
    },
  }),
  EditorialBlock.extend({
    addNodeView() {
      return ReactNodeViewRenderer(EditorialView);
    },
  }),
  Markdown,
];
export default function VisualEditor({
  source,
  disabled,
  onChange,
}: {
  source: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const [initial] = useState(() => openVisual(source));
  const callback = useRef(onChange);
  callback.current = onChange;
  const last = useRef(source);
  const [error, setError] = useState(initial.error ?? "");
  const [menu, setMenu] = useState(false);
  const [insertTop, setInsertTop] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const insertion = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const position = useRef<number | null>(null);
  const editor = useEditor(
    {
      extensions,
      content: initial.document ?? {
        type: "doc",
        content: [{ type: "paragraph" }],
      },
      editable: !disabled && !initial.error,
      editorProps: {
        attributes: {
          class: "prose visual-document",
          "aria-label": "Conteúdo visual da lição",
        },
      },
      onUpdate: ({ editor, transaction }) => {
        if (!transaction.docChanged) return;
        const markdown = editor.getMarkdown();
        last.current = markdown;
        callback.current(markdown);
      },
    },
    [],
  );
  useEffect(() => {
    editor?.setEditable(!disabled && !error, false);
  }, [editor, disabled, error]);
  useEffect(() => {
    if (
      !editor ||
      source.replaceAll("\r\n", "\n") === last.current.replaceAll("\r\n", "\n")
    )
      return;
    const result = openVisual(source);
    setError(result.error ?? "");
    if (result.document) {
      editor.commands.setContent(result.document, { emitUpdate: false });
      last.current = source;
    }
  }, [editor, source]);
  useEffect(() => {
    if (!editor) return;
    let frame = 0;
    function refresh() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (
          !root.current ||
          !editor ||
          !editor.isInitialized ||
          editor.isDestroyed
        )
          return;
        const point = insertionPoint(editor);
        position.current = point.after;
        const block = editor.view.nodeDOM(point.start);
        const top =
          block instanceof Element
            ? block.getBoundingClientRect().top
            : editor.view.coordsAtPos(point.start).top;
        setInsertTop(top - root.current.getBoundingClientRect().top);
      });
    }
    function context() {
      setMenu(false);
      refresh();
    }
    function outside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !insertion.current?.contains(event.target)
      )
        setMenu(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenu(false);
        if (
          event.target instanceof Node &&
          insertion.current?.contains(event.target)
        )
          trigger.current?.focus();
      }
    }
    editor.on("create", refresh);
    editor.on("selectionUpdate", context);
    editor.on("transaction", refresh);
    document.addEventListener("scroll", refresh, true);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    const observer = new ResizeObserver(refresh);
    if (root.current) observer.observe(root.current);
    refresh();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      editor.off("create", refresh);
      editor.off("selectionUpdate", context);
      editor.off("transaction", refresh);
      document.removeEventListener("scroll", refresh, true);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [editor]);
  if (error)
    return (
      <p role="alert" className="studio-error">
        {error}
      </p>
    );
  if (!editor) return <p role="status">Abrindo editor visual…</p>;
  function insert(type: string) {
    if (!editor) return;
    let block: JSONContent = { type: "paragraph" };
    if (type === "code")
      block = { type: "codeBlock", attrs: { language: "typescript" } };
    if (type === "exercise")
      block = {
        type: "editorialBlock",
        attrs: { language: "bunker-exercise", data: { kind: "exercise" } },
      };
    if (type === "note")
      block = {
        type: "editorialBlock",
        attrs: {
          language: "bunker-note",
          data: { kind: "info", text: "Escreva sua observação." },
        },
      };
    if (type === "quiz")
      block = {
        type: "editorialBlock",
        attrs: {
          language: "bunker-quiz",
          data: {
            id: `quiz-${crypto.randomUUID()}`,
            question: "Escreva sua pergunta.",
            options: [
              { id: "a", text: "Alternativa A" },
              { id: "b", text: "Alternativa B" },
            ],
            correct: "a",
            feedbackCorrect: "Resposta correta.",
            feedbackIncorrect: "Revise a explicação e tente novamente.",
            retry: true,
          },
        },
      };
    const pos = position.current ?? insertionPoint(editor).after;
    const newNode = editor.schema.nodeFromJSON(block);
    const tr = closeHistory(editor.state.tr).insert(pos, [
      newNode,
      editor.schema.nodes.paragraph!.create(),
    ]);
    tr.setSelection(
      type === "paragraph"
        ? TextSelection.create(tr.doc, pos + 1)
        : NodeSelection.create(tr.doc, pos),
    );
    editor.view.dispatch(tr);
    editor.view.focus();
    setMenu(false);
  }
  return (
    <div className="visual-studio" ref={root}>
      <VisualToolbar editor={editor} disabled={disabled} />
      <EditorContent editor={editor} />
      {insertTop !== null && (
        <div
          ref={insertion}
          className="insertion-control"
          style={{ top: insertTop }}
        >
          <button
            ref={trigger}
            type="button"
            aria-label="Inserir após o bloco selecionado"
            title="Inserir após o bloco selecionado"
            aria-expanded={menu}
            disabled={disabled}
            onMouseDown={(event) => {
              event.preventDefault();
              position.current = insertionPoint(editor).after;
            }}
            onClick={() => setMenu(!menu)}
          >
            <Plus size={18} />
          </button>
          {menu && (
            <div role="group" aria-label="Inserir bloco">
              {[
                ["paragraph", "Parágrafo"],
                ["code", "Bloco de código"],
                ["note", "Nota"],
                ["quiz", "Quiz"],
                ["exercise", "Enunciado do exercício"],
              ].map(([type, label]) => (
                <button key={type} onClick={() => insert(type!)}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
