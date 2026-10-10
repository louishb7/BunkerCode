import { closeHistory } from "@tiptap/pm/history";
import { CodeEditor } from "../practice/CodeEditor";
import { useEffect, useRef, useState } from "react";
import {
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
  type NodeViewProps,
  type JSONContent,
} from "@tiptap/react";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, Code2, Plus, Undo2, Redo2, Link2 } from "lucide-react";
import type { Quiz, Note } from "@bunkercode/content";
import { EditorialBlock, VisualCode, openVisual } from "./visual-markdown";
import { QuizBlock } from "../courses/EditorialBlock";

function BlockActions({ editor, getPos, node }: NodeViewProps) {
  function move(direction: number) {
    const pos = getPos();
    if (typeof pos !== "number") return;
    const $pos = editor.state.doc.resolve(pos);
    const index = $pos.index();
    const parent = $pos.parent;
    if (
      (direction < 0 && index === 0) ||
      (direction > 0 && index >= parent.childCount - 1)
    )
      return;
    const target =
      direction < 0
        ? pos - parent.child(index - 1).nodeSize
        : pos + parent.child(index + 1).nodeSize;
    const tr = closeHistory(editor.state.tr)
      .delete(pos, pos + node.nodeSize)
      .insert(target, node);
    editor.view.dispatch(tr);
    editor.commands.focus();
  }
  return (
    <div className="block-actions" contentEditable={false}>
      <button onClick={() => move(-1)} aria-label="Mover bloco para cima">
        ↑
      </button>
      <button onClick={() => move(1)} aria-label="Mover bloco para baixo">
        ↓
      </button>
      <button
        onClick={() => {
          const pos = getPos();
          if (typeof pos === "number") {
            editor.view.dispatch(closeHistory(editor.state.tr));
            editor
              .chain()
              .focus()
              .insertContentAt(pos + node.nodeSize, { type: "paragraph" })
              .run();
          }
        }}
      >
        Continuar abaixo
      </button>
      <button
        onClick={() => {
          const pos = getPos();
          if (typeof pos !== "number") return;
          editor.view.dispatch(
            closeHistory(editor.state.tr).delete(pos, pos + node.nodeSize),
          );
          editor.commands.focus();
        }}
      >
        Excluir bloco
      </button>
    </div>
  );
}
function EditorialView(props: NodeViewProps) {
  const { node, updateAttributes } = props;
  const [preview, setPreview] = useState(false);
  const data = node.attrs.data as Quiz | Note;
  if (node.attrs.language === "bunker-exercise")
    return (
      <NodeViewWrapper className="editorial-note" contentEditable={false}>
        <strong>Enunciado do exercício</strong>
        <p>O leitor apresenta aqui o exercício definido em exercise.json.</p>
        <BlockActions {...props} />
      </NodeViewWrapper>
    );
  if (node.attrs.language === "bunker-note") {
    const note = data as Note;
    return (
      <NodeViewWrapper className="editorial-note" contentEditable={false}>
        <label>
          Tipo de nota
          <select
            value={note.kind}
            onChange={(e) =>
              updateAttributes({ data: { ...note, kind: e.target.value } })
            }
          >
            <option value="info">Informação</option>
            <option value="tip">Dica</option>
            <option value="warning">Atenção</option>
          </select>
        </label>
        <label>
          Texto da nota
          <textarea
            value={note.text}
            onChange={(e) =>
              updateAttributes({ data: { ...note, text: e.target.value } })
            }
          />
        </label>
        <BlockActions {...props} />
      </NodeViewWrapper>
    );
  }
  const q = data as Quiz;
  const change = (patch: Partial<Quiz>) =>
    updateAttributes({ data: { ...q, ...patch } });
  return (
    <NodeViewWrapper className="quiz-author" contentEditable={false}>
      <div className="block-actions">
        <strong>Quiz · alternativa única</strong>
        <button onClick={() => setPreview(!preview)}>
          {preview ? "Editar quiz" : "Testar como estudante"}
        </button>
      </div>
      {preview ? (
        <QuizBlock key={JSON.stringify(q)} quiz={q} />
      ) : (
        <>
          <label>
            Identificador da questão
            <input
              value={q.id}
              onChange={(e) => change({ id: e.target.value })}
            />
          </label>
          <label>
            Pergunta
            <textarea
              value={q.question}
              onChange={(e) => change({ question: e.target.value })}
            />
          </label>
          <fieldset>
            <legend>Alternativas · marque a correta</legend>
            {q.options.map((o, i) => (
              <div className="quiz-author-option" key={o.id}>
                <input
                  type="radio"
                  name={`correct-${q.id}`}
                  aria-label={`Alternativa correta ${i + 1}`}
                  checked={q.correct === o.id}
                  onChange={() => change({ correct: o.id })}
                />
                <input
                  aria-label={`Alternativa ${i + 1}`}
                  value={o.text}
                  onChange={(e) =>
                    change({
                      options: q.options.map((v) =>
                        v.id === o.id ? { ...v, text: e.target.value } : v,
                      ),
                    })
                  }
                />
                <button
                  aria-label={`Remover alternativa ${i + 1}`}
                  disabled={q.options.length <= 2}
                  onClick={() =>
                    change({
                      options: q.options.filter((v) => v.id !== o.id),
                      correct:
                        q.correct === o.id
                          ? q.options.find((v) => v.id !== o.id)!.id
                          : q.correct,
                    })
                  }
                >
                  ×
                </button>
              </div>
            ))}
            <button
              disabled={q.options.length >= 12}
              onClick={() =>
                change({
                  options: [
                    ...q.options,
                    {
                      id: `option-${crypto.randomUUID()}`,
                      text: "Nova alternativa",
                    },
                  ],
                })
              }
            >
              Adicionar alternativa
            </button>
          </fieldset>
          <label>
            Feedback correto
            <textarea
              value={q.feedbackCorrect}
              onChange={(e) => change({ feedbackCorrect: e.target.value })}
            />
          </label>
          <label>
            Feedback incorreto
            <textarea
              value={q.feedbackIncorrect}
              onChange={(e) => change({ feedbackIncorrect: e.target.value })}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={q.retry}
              onChange={(e) => change({ retry: e.target.checked })}
            />{" "}
            Permitir nova tentativa
          </label>
        </>
      )}
      <BlockActions {...props} />
    </NodeViewWrapper>
  );
}
function CodeView(props: NodeViewProps) {
  return (
    <NodeViewWrapper className="code-block">
      <div className="code-language" contentEditable={false}>
        <label>
          Linguagem{" "}
          <select
            value={String(props.node.attrs.language ?? "")}
            onChange={(e) =>
              props.updateAttributes({ language: e.target.value })
            }
          >
            {[
              "",
              "typescript",
              "javascript",
              "python",
              "java",
              "sql",
              "bash",
              "json",
              "css",
              "html",
              "rust",
              "go",
              "c",
              "cpp",
            ].map((lang) => (
              <option key={lang} value={lang}>
                {lang || "texto"}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div contentEditable={false}>
        <CodeEditor
          code={props.node.textContent}
          language={String(props.node.attrs.language ?? "")}
          label="Código do exemplo"
          formatRequest={0}
          onFormatState={() => undefined}
          onChange={(code) => {
            const pos = props.getPos();
            if (
              typeof pos !== "number" ||
              !props.editor.isEditable ||
              code === props.node.textContent
            )
              return;
            props.editor.view.dispatch(
              props.editor.state.tr.replaceWith(
                pos + 1,
                pos + props.node.nodeSize - 1,
                code ? props.editor.schema.text(code) : [],
              ),
            );
          }}
        />
      </div>
      <BlockActions {...props} />
    </NodeViewWrapper>
  );
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
      return ReactNodeViewRenderer(CodeView);
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
  const [insertTop, setInsertTop] = useState(100);
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
      onSelectionUpdate: ({ editor }) => {
        const selection = editor.state.selection;
        position.current = selection.$from.depth
          ? selection.$from.after(1)
          : selection.to;
        const root = editor.view.dom.closest(".visual-studio");
        if (root)
          setInsertTop(
            editor.view.coordsAtPos(position.current).top -
              root.getBoundingClientRect().top,
          );
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
    const pos = position.current ?? editor.state.selection.$from.end();
    editor.view.dispatch(closeHistory(editor.state.tr));
    editor
      .chain()
      .focus()
      .insertContentAt(pos, [block, { type: "paragraph" }])
      .run();
    setMenu(false);
  }
  return (
    <div className="visual-studio">
      <div
        className="visual-toolbar"
        role="group"
        aria-label="Formatação do conteúdo"
      >
        <select
          aria-label="Estilo do texto"
          defaultValue="paragraph"
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
          aria-label="Negrito"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={18} />
        </button>
        <button
          aria-label="Itálico"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={18} />
        </button>
        <button
          aria-label="Lista"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          • Lista
        </button>
        <button
          aria-label="Lista numerada"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. Lista
        </button>
        <button
          aria-label="Link"
          disabled={disabled}
          onClick={() => {
            const href = window.prompt("Endereço do link (https://…)");
            if (href && /^(https?:\/\/|mailto:|\/[^/]|#)/i.test(href))
              editor.chain().focus().setLink({ href }).run();
          }}
        >
          <Link2 size={18} />
        </button>
        <button
          aria-label="Código inline"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code2 size={18} />
        </button>
        <button
          aria-label="Desfazer"
          disabled={disabled}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 size={18} />
        </button>
        <button
          aria-label="Refazer"
          disabled={disabled}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 size={18} />
        </button>
      </div>
      <EditorContent editor={editor} />
      <div className="insertion-control" style={{ top: insertTop }}>
        <button
          aria-label="Inserir após o bloco selecionado"
          title="Inserir após o bloco selecionado"
          aria-expanded={menu}
          disabled={disabled}
          onMouseDown={(event) => {
            event.preventDefault();
            position.current = editor.state.selection.$from.depth
              ? editor.state.selection.$from.after(1)
              : editor.state.selection.to;
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
    </div>
  );
}
