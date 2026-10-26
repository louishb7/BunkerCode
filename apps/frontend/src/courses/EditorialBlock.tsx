import { useId, useState } from "react";
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
  return (
    <fieldset className="inline-quiz">
      <legend>{quiz.question}</legend>
      {quiz.options.map((option) => (
        <label key={option.id} className="quiz-option">
          <input
            type="radio"
            name={name}
            value={option.id}
            checked={choice === option.id}
            disabled={!!answer}
            onChange={() => setChoice(option.id)}
          />
          <span>{option.text}</span>
        </label>
      ))}
      {!answer ? (
        <button disabled={!choice} onClick={() => setAnswer(choice)}>
          Verificar resposta
        </button>
      ) : (
        <>
          <div role="status">
            <EditorialText
              text={
                answer === quiz.correct
                  ? quiz.feedbackCorrect
                  : quiz.feedbackIncorrect
              }
            />
          </div>
          {quiz.retry && (
            <button
              onClick={() => {
                setAnswer("");
                setChoice("");
              }}
            >
              Tentar novamente
            </button>
          )}
        </>
      )}
    </fieldset>
  );
}
export function NoteBlock({ note }: { note: Note }) {
  const labels = { info: "Informação", tip: "Dica", warning: "Atenção" };
  return (
    <aside className={`editorial-note note-${note.kind}`}>
      <strong>{labels[note.kind]}</strong>
      <EditorialText text={note.text} />
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
