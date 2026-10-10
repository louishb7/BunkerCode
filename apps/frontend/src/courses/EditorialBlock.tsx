import { useId, useState } from "react";
import { parseEditorial, type Quiz, type Note } from "@bunkercode/content";
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
          <p role="status">
            {answer === quiz.correct
              ? quiz.feedbackCorrect
              : quiz.feedbackIncorrect}
          </p>
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
      <p>{note.text}</p>
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
