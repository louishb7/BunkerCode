import { useEffect, useLayoutEffect, useReducer, useRef } from "react";
import { useSearchParams } from "react-router";
import { ArrowRight, Play, RotateCcw, SkipForward } from "lucide-react";
import { Page } from "../courses/Page";
import {
  readSessionSeed,
  randomSessionSeed,
  sessionReducer,
  startSession,
} from "./session";
import { TacticCode } from "./TacticCode";
import { TacticExecution, TacticGoal } from "./TacticExecution";
import "./tactics.css";

function SessionView({
  initialSeed,
  onNewSession,
}: {
  initialSeed: number | null;
  onNewSession: (previous: number) => void;
}) {
  const [state, dispatch] = useReducer(sessionReducer, initialSeed, (seed) =>
    startSession(seed ?? randomSessionSeed()),
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const navigationGesture = useRef(false);
  useEffect(() => {
    // A second press can land elsewhere after a shorter program replaces the
    // round. Preserve the new heading's focus only for that navigation gesture.
    const preserveFocus = (event: MouseEvent) => {
      if (event.detail === 1) navigationGesture.current = false;
      else if (navigationGesture.current) event.preventDefault();
    };
    document.addEventListener("mousedown", preserveFocus, true);
    return () => document.removeEventListener("mousedown", preserveFocus, true);
  }, []);
  useLayoutEffect(() => {
    if (state.completed) {
      nextButton.current?.focus({ preventScroll: true });
      return;
    }
    if (state.index === 0) return;
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "nearest" });
  }, [state.index, state.completed]);
  const send = (type: "run" | "next" | "skip") =>
    dispatch({ type, index: state.index, seed: state.seed });
  const advance = (type: "next" | "skip", clickCount: number) => {
    if (clickCount > 1) return;
    navigationGesture.current = clickCount === 1;
    send(type);
  };
  const select = (selection: number) =>
    dispatch({
      type: "select",
      selection,
      index: state.index,
      seed: state.seed,
    });
  const performed = state.solved + state.skipped;
  const identity = state.round.view.identity;
  return (
    <Page title="Táticas" className="tactics-lab">
      <header className="tactics-heading">
        <h1>Táticas</h1>
        <span
          className="tactics-progress"
          aria-label={`Rodada ${state.index + 1}, marco de 12 rodadas`}
        >
          {String(state.index + 1).padStart(2, "0")} <span>/ 12</span>
        </span>
      </header>
      {performed >= 12 && (
        <p className="tactics-milestone">
          Marco de 12 rodadas alcançado. Continue no seu ritmo ou comece uma
          nova sessão.
        </p>
      )}
      <section
        className="tactic-round"
        data-kind={identity.kind}
        data-family={identity.family}
        data-seed={identity.seed}
        data-index={state.index}
      >
        <header className="tactic-round-heading">
          <h2 ref={heading} tabIndex={-1} className="tactic-objective">
            {state.round.family === "conditional"
              ? "Faça a função produzir os resultados esperados."
              : state.round.family === "assignment"
                ? `Faça value terminar com ${state.round.view.expectedResult}.`
                : `Filtre os valores para obter [${state.round.view.expectedResult.join(", ")}].`}
          </h2>
          <TacticGoal round={state.round} />
        </header>
        <TacticCode
          round={state.round}
          selection={state.selection}
          disabled={state.completed}
          onSelect={select}
        />
        <div
          className="tactic-actions"
          onPointerDownCapture={(event) => {
            // Disabled buttons emit pointerdown but suppress mousedown in Chromium.
            // Keep the round heading focused if a second press lands on Run.
            if (
              event.target instanceof Element &&
              event.target.closest("button:disabled")
            )
              event.preventDefault();
          }}
        >
          {state.completed ? (
            <button
              ref={nextButton}
              className="tactic-primary"
              onClick={(event) => advance("next", event.detail)}
            >
              {state.index === 11 ? "Continuar praticando" : "Próxima"}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          ) : (
            <>
              <button
                className="tactic-skip"
                onClick={(event) => advance("skip", event.detail)}
              >
                <SkipForward size={16} aria-hidden="true" />
                Pular
              </button>
              <button
                className="tactic-primary"
                disabled={state.selection === null}
                onClick={() => send("run")}
              >
                <Play size={16} aria-hidden="true" />
                Executar
              </button>
            </>
          )}
        </div>
        <p
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {state.result
            ? state.result.value.achieved
              ? "Objetivo atingido. Próxima rodada disponível."
              : "Objetivo ainda não atingido. Você pode tentar outra operação."
            : state.selection === null
              ? "Selecione uma operação para começar."
              : "Escolha aplicada ao código. Execute para observar o resultado."}
        </p>
        {state.error && <p role="alert">{state.error}</p>}
        <TacticExecution
          key={`${state.index}:${state.selection}`}
          result={state.result}
        />
      </section>
      <details className="tactics-session-options">
        <summary>Opções da sessão</summary>
        <div className="tactics-session-info">
          <p>
            Seed da sessão <code>{state.seed}</code> · Progresso somente nesta
            sessão
          </p>
          <dl className="tactics-stats" aria-label="Estatísticas da sessão">
            <div>
              <dt>Realizadas</dt>
              <dd data-stat="performed">{performed}</dd>
            </div>
            <div>
              <dt>Resolvidas</dt>
              <dd data-stat="solved">{state.solved}</dd>
            </div>
            <div>
              <dt>Puladas</dt>
              <dd data-stat="skipped">{state.skipped}</dd>
            </div>
          </dl>
          <button onClick={() => onNewSession(state.seed)}>
            <RotateCcw size={15} aria-hidden="true" />
            Nova sessão
          </button>
        </div>
      </details>
    </Page>
  );
}

export default function TacticsLab() {
  const [search, setSearch] = useSearchParams();
  const parsed = readSessionSeed(search);
  const start = (previous?: number) =>
    setSearch({ seed: String(randomSessionSeed(previous)) }, { replace: true });
  if (!parsed.valid)
    return (
      <Page title="Táticas" className="tactics-lab">
        <h1>Táticas</h1>
        <p role="alert">
          Seed inválida. Use um único inteiro de 0 a 4294967295.
        </p>
        <button onClick={() => start()}>Nova sessão</button>
      </Page>
    );
  return (
    <SessionView
      key={parsed.seed ?? "random"}
      initialSeed={parsed.seed}
      onNewSession={start}
    />
  );
}
