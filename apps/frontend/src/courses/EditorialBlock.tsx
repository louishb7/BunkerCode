import { useId, useState } from "react";
import { CircleCheck, CircleX, MessageSquareText } from "lucide-react";
import { parseEditorial, type Quiz, type Note } from "@bunkercode/content";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

// Editorial text keeps paragraphs and inline emphasis without allowing nested
// components, executable HTML, or a second document inside a note/feedback.
function EditorialText({ text }: { text: string }) {
  return (
    <ReactMarkdown
      skipHtml
      rehypePlugins={[rehypeSanitize]}
      allowedElements={["p", "em", "strong", "code", "br"]}
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
  const canRetry = !!answer && !correct && quiz.retry;
  const feedback =
    quiz.options.find((option) => option.id === answer)?.feedback ??
    (correct ? quiz.feedbackCorrect : quiz.feedbackIncorrect);
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
                disabled={!!answer && !canRetry}
                onChange={() => {
                  setChoice(option.id);
                  setAnswer("");
                }}
              />
              <span>{option.text}</span>
              {answer === option.id && (
                <ResultIcon size={19} aria-hidden="true" />
              )}
            </label>
          ))}
        </div>
        {(!answer || canRetry) && (
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
        )}
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
        {answer && correct && quiz.retry && (
          <button
            type="button"
            onClick={() => {
              setAnswer("");
              setChoice("");
            }}
          >
            Tentar novamente
          </button>
        )}
      </fieldset>
    </section>
  );
}
export function NoteBlock({ note }: { note: Note }) {
  // An explicit editorial signature, not every note or mention of the character.
  const otto = /^\*\*Otto\*\*(?:\r?\n){2}/.exec(note.text);
  const text = otto ? note.text.slice(otto[0].length) : note.text;
  return (
    <aside
      className={`editorial-note editorial-comment note-${note.kind}`}
      aria-label={otto ? "Otto" : "Nota"}
    >
      {otto ? (
        <img
          className="otto-avatar"
          src="/characters/otto.svg"
          width="56"
          height="56"
          alt=""
        />
      ) : (
        <MessageSquareText
          className="note-symbol"
          size={18}
          aria-hidden="true"
        />
      )}
      <div className="editorial-note-content">
        <EditorialText text={text} />
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
    if ("kind" in block && block.kind === "exercise") return null;
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
