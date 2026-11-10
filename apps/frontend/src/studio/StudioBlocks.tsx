import { continueAfter } from "./continuation";
import { closeHistory } from "@tiptap/pm/history";
import { NodeSelection } from "@tiptap/pm/state";
import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import {
  ArrowDown,
  ArrowUp,
  CornerDownLeft,
  Ellipsis,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import type { Quiz, Note } from "@bunkercode/content";
import { QuizBlock } from "../courses/EditorialBlock";
import { StudioNote } from "./StudioNote";
import { CodeEditor } from "../practice/CodeEditor";

// Keep native composition local: document transactions during pre-edit can reset
// the browser's IME range inside an atomic ProseMirror node view.
function AuthoringText({
  value,
  onChange,
  multiline = false,
  ...props
}: {
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
} & Pick<
  ComponentProps<"textarea">,
  "aria-label" | "className" | "placeholder"
>) {
  const [draft, setDraft] = useState(value);
  const composing = useRef(false);
  useEffect(() => {
    if (!composing.current) setDraft(value);
  }, [value]);
  const Component = multiline ? "textarea" : "input";
  return (
    <Component
      {...props}
      value={draft}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={(event) => {
        composing.current = false;
        setDraft(event.currentTarget.value);
        onChange(event.currentTarget.value);
      }}
      onChange={(event) => {
        setDraft(event.currentTarget.value);
        if (!composing.current) onChange(event.currentTarget.value);
      }}
    />
  );
}

function selectBlock({ editor, getPos, selected }: NodeViewProps) {
  const pos = getPos();
  if (!selected && editor.isEditable && typeof pos === "number")
    editor.commands.setNodeSelection(pos);
}

function BlockActions({ editor, getPos, node, selected }: NodeViewProps) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!selected) setOpen(false);
  }, [selected]);
  if (!selected) return null;
  function move(direction: number) {
    const pos = getPos();
    if (typeof pos !== "number") return;
    const $pos = editor.state.doc.resolve(pos);
    const index = $pos.index(),
      parent = $pos.parent;
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
    tr.setSelection(NodeSelection.create(tr.doc, target));
    editor.view.dispatch(tr);
    editor.view.focus();
    setOpen(false);
  }
  return (
    <div
      className="block-actions"
      contentEditable={false}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          event.stopPropagation();
          event.currentTarget
            .querySelector<HTMLButtonElement>("button")
            ?.focus();
        }
      }}
    >
      <button
        type="button"
        aria-label="Ações do bloco"
        title="Ações do bloco"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Ellipsis size={18} aria-hidden="true" />
      </button>
      {open && (
        <div
          className="block-action-menu"
          role="group"
          aria-label="Organizar bloco"
        >
          <button
            type="button"
            onClick={() => move(-1)}
            aria-label="Mover bloco para cima"
          >
            <ArrowUp size={16} />
            Mover para cima
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            aria-label="Mover bloco para baixo"
          >
            <ArrowDown size={16} />
            Mover para baixo
          </button>
          <button
            type="button"
            onClick={() => {
              const pos = getPos();
              if (typeof pos !== "number") return;
              const after = pos + node.nodeSize;
              continueAfter(editor.view, after);
              setOpen(false);
            }}
          >
            <CornerDownLeft size={16} />
            Continuar abaixo
          </button>
          <button
            type="button"
            onClick={() => {
              const pos = getPos();
              if (typeof pos !== "number") return;
              editor.view.dispatch(
                closeHistory(editor.state.tr).delete(pos, pos + node.nodeSize),
              );
              editor.view.focus();
              setOpen(false);
            }}
          >
            <Trash2 size={16} />
            Excluir bloco
          </button>
        </div>
      )}
    </div>
  );
}

export function EditorialView(props: NodeViewProps) {
  const { node, updateAttributes, selected } = props;
  const [preview, setPreview] = useState(false);
  const [notePending, setNotePending] = useState(false);
  const data = node.attrs.data as Quiz | Note;
  const events = {
    onPointerDownCapture: () => selectBlock(props),
    onFocusCapture: () => selectBlock(props),
  };
  if (node.attrs.language === "bunker-exercise")
    return (
      <NodeViewWrapper
        className="editorial-note"
        role="group"
        aria-label={
          node.attrs.language === "bunker-note"
            ? "Nota editorial"
            : "Enunciado do exercício"
        }
        contentEditable={false}
        tabIndex={0}
        {...events}
      >
        <strong>Enunciado do exercício</strong>
        <p>O leitor apresenta aqui o exercício definido em exercise.json.</p>
        <BlockActions {...props} />
      </NodeViewWrapper>
    );
  if (node.attrs.language === "bunker-note") {
    const note = data as Note;
    return (
      <NodeViewWrapper
        className="editorial-note"
        role="group"
        aria-label={
          node.attrs.language === "bunker-note"
            ? "Nota editorial"
            : "Enunciado do exercício"
        }
        contentEditable={false}
        tabIndex={0}
        {...events}
      >
        <StudioNote
          note={note}
          selected={selected}
          editor={props.editor}
          getPos={props.getPos}
          onPendingChange={setNotePending}
        />
        {!notePending && <BlockActions {...props} />}
      </NodeViewWrapper>
    );
  }
  const q = data as Quiz;
  const change = (patch: Partial<Quiz>) =>
    updateAttributes({ data: { ...q, ...patch } });
  return (
    <NodeViewWrapper
      className="quiz-author"
      role="group"
      aria-label="Quiz editorial"
      contentEditable={false}
      tabIndex={0}
      {...events}
    >
      {!selected ? (
        <div className="quiz-document">
          <strong>{q.question}</strong>
          {q.options.map((o) => (
            <div className="quiz-document-option" key={o.id}>
              <span className="quiz-radio" aria-hidden="true" />
              {o.text}
            </div>
          ))}
          <button
            type="button"
            className="quiz-edit-trigger"
            onClick={() => selectBlock(props)}
          >
            Editar quiz
          </button>
        </div>
      ) : (
        <>
          <div className="quiz-context">
            <span>Quiz</span>
            <button type="button" onClick={() => setPreview(!preview)}>
              {preview ? "Editar quiz" : "Testar como estudante"}
            </button>
            <BlockActions {...props} />
          </div>
          {preview ? (
            <QuizBlock key={JSON.stringify(q)} quiz={q} />
          ) : (
            <>
              <label className="quiz-question">
                Pergunta
                <AuthoringText
                  multiline
                  value={q.question}
                  onChange={(question) => change({ question })}
                />
              </label>
              <fieldset>
                <legend>Alternativas · marque a correta</legend>
                {q.options.map((o, i) => (
                  <div
                    className="quiz-author-option"
                    key={o.id}
                    data-correct={q.correct === o.id}
                  >
                    <label className="quiz-option-answer">
                      Alternativa {i + 1}
                      <AuthoringText
                        aria-label={`Alternativa ${i + 1}`}
                        value={o.text}
                        onChange={(text) =>
                          change({
                            options: q.options.map((v) =>
                              v.id === o.id ? { ...v, text } : v,
                            ),
                          })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      title={`Remover alternativa ${i + 1}`}
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
                      <X size={16} />
                    </button>
                    <label className="quiz-option-correct">
                      <input
                        type="radio"
                        name={`correct-${q.id}`}
                        aria-label={`Alternativa correta ${i + 1}`}
                        checked={q.correct === o.id}
                        onChange={() => change({ correct: o.id })}
                      />
                      {q.correct === o.id ? "Correta" : "Marcar como correta"}
                    </label>
                    <label className="quiz-option-feedback">
                      Feedback da alternativa {i + 1}
                      <AuthoringText
                        multiline
                        value={o.feedback}
                        onChange={(feedback) =>
                          change({
                            options: q.options.map((option) =>
                              option.id === o.id
                                ? { ...option, feedback }
                                : option,
                            ),
                          })
                        }
                      />
                    </label>
                  </div>
                ))}
                <button
                  type="button"
                  disabled={q.options.length >= 12}
                  onClick={() =>
                    change({
                      options: [
                        ...q.options,
                        {
                          id: `option-${crypto.randomUUID()}`,
                          text: "Nova alternativa",
                          feedback: "Escreva o feedback desta alternativa.",
                        },
                      ],
                    })
                  }
                >
                  Adicionar alternativa
                </button>
              </fieldset>
            </>
          )}
        </>
      )}
    </NodeViewWrapper>
  );
}

export function CodeView(props: NodeViewProps) {
  return (
    <NodeViewWrapper
      className="code-block studio-code-block"
      role="group"
      aria-label="Bloco de código"
      tabIndex={0}
      contentEditable={false}
      onPointerDownCapture={() => selectBlock(props)}
      onFocusCapture={() => selectBlock(props)}
    >
      <div className="code-language">
        <label>
          <span className="sr-only">Linguagem</span>
          <select
            aria-label="Linguagem"
            value={String(props.node.attrs.language ?? "")}
            onChange={(e) => {
              const pos = props.getPos();
              if (typeof pos !== "number") return;
              const tr = closeHistory(props.editor.state.tr).setNodeMarkup(
                pos,
                undefined,
                { ...props.node.attrs, language: e.target.value },
              );
              // setNodeMarkup maps a textblock NodeSelection to a caret; keep this block's context.
              tr.setSelection(NodeSelection.create(tr.doc, pos));
              props.editor.view.dispatch(tr);
            }}
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
        <BlockActions {...props} />
      </div>
      <CodeEditor
        code={props.node.textContent}
        language={String(props.node.attrs.language ?? "")}
        label="Código do exemplo"
        variant="example"
        readOnly={!props.editor.isEditable}
        formatRequest={0}
        onFormatState={() => undefined}
        onChange={(code) => {
          const pos = props.getPos();
          if (typeof pos !== "number" || !props.editor.isEditable) return;
          const current = props.editor.state.doc.nodeAt(pos);
          if (
            !current ||
            current.type.name !== "codeBlock" ||
            code === current.textContent
          )
            return;
          props.editor.view.dispatch(
            props.editor.state.tr.replaceWith(
              pos + 1,
              pos + current.nodeSize - 1,
              code ? props.editor.schema.text(code) : [],
            ),
          );
        }}
      />
      <NodeViewContent hidden aria-hidden="true" />
    </NodeViewWrapper>
  );
}
