import { useId, useState } from "react";
import { CircleCheck, CircleX, MessageSquareText } from "lucide-react";
import {
  parseEditorial,
  ottoComment,
  type Quiz,
  type Note,
} from "@bunkercode/content";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

// Editorial text keeps paragraphs and inline emphasis without allowing nested
// components, executable HTML, or a second document inside a note/feedback.
function EditorialText({
  text,
  note = false,
}: {
  text: string;
  note?: boolean;
}) {
  return (
    <ReactMarkdown
      skipHtml
      rehypePlugins={[rehypeSanitize]}
      allowedElements={
        note
          ? ["p", "em", "strong", "code", "br", "ul", "li", "a"]
          : ["p", "em", "strong", "code", "br"]
      }
      components={{
        a: ({ href, children }) => (
          <a
            href={href}
            target={/^https?:\/\//.test(href ?? "") ? "_blank" : undefined}
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
      }}
      unwrapDisallowed
    >
      {text}
    </ReactMarkdown>
  );
}
export function QuizBlock({ quiz }: { quiz: Quiz }) {
  const name = useId();
  const [choice, setChoice] = useState("");
  const [answer, setAnswer] = useState("");
  const [attempt, setAttempt] = useState(0);
  const correct = answer === quiz.correct;
  const feedback =
    quiz.options.find((option) => option.id === answer)?.feedback ?? "";
  const ResultIcon = correct ? CircleCheck : CircleX;
  return (
    <section className="inline-quiz" aria-labelledby={`${name}-question`}>
      <fieldset>
        <legend id={`${name}-question`}>{quiz.question}</legend>
        <div className="quiz-options">
          {quiz.options.map((option) => (
            <label
              key={option.id}
              className="quiz-option"
              data-result={
                answer === option.id
                  ? correct
                    ? "correct"
                    : "incorrect"
                  : undefined
              }
            >
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={choice === option.id}
                onChange={() => setChoice(option.id)}
              />
              <span>{option.text}</span>
              {answer === option.id && (
                <ResultIcon size={19} aria-hidden="true" />
              )}
            </label>
          ))}
        </div>
        <button
          type="button"
          disabled={!choice}
          onClick={() => {
            setAnswer(choice);
            setAttempt((value) => value + 1);
          }}
        >
          Verificar resposta
        </button>
        <div role="status" aria-atomic="true">
          {answer && (
            <div
              className="quiz-feedback"
              key={attempt}
              data-result={correct ? "correct" : "incorrect"}
            >
              <p className="quiz-result">
                <ResultIcon size={20} aria-hidden="true" />
                <strong>
                  {correct ? "Resposta correta" : "Resposta incorreta"}
                </strong>
              </p>
              <div className="quiz-feedback-text">
                <EditorialText text={feedback} />
              </div>
            </div>
          )}
        </div>
      </fieldset>
    </section>
  );
}
export function NoteBlock({ note }: { note: Note }) {
  // An explicit editorial signature, not every note or mention of the character.
  const comment = ottoComment(note.text);
  const otto = comment !== null;
  const text = comment ?? note.text;
  return (
    <aside
      className={`editorial-note editorial-comment note-${note.kind}`}
      aria-label={otto ? "Otto" : "Nota"}
    >
      {otto ? (
        <span className="otto-avatar" aria-hidden="true">
          <img src="/characters/otto.svg" width="56" height="56" alt="" />
        </span>
      ) : (
        <MessageSquareText
          className="note-symbol"
          size={18}
          aria-hidden="true"
        />
      )}
      <div className="editorial-note-content">
        <EditorialText text={text} note />
      </div>
    </aside>
  );
}

export function EditorialBlock({
  language,
  source,
}: {
  language: string;
  source: string;
}) {
  try {
    const block = parseEditorial(language, source);
    if (
      "kind" in block &&
      (block.kind === "exercise" ||
        block.kind === "sql" ||
        block.kind === "sql-task-sequence")
    )
      return null;
    return "question" in block ? (
      <QuizBlock key={source} quiz={block} />
    ) : (
      <NoteBlock note={block} />
    );
  } catch (error) {
    return (
      <p role="alert">
        Bloco editorial inválido:{" "}
        {error instanceof Error ? error.message : "revise a fonte."}
      </p>
    );
  }
}
