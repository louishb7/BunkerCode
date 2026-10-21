import { useEffect, useLayoutEffect, useReducer, useRef } from "react";
import { useSearchParams } from "react-router";
import { ArrowRight, Play, RotateCcw, SkipForward } from "lucide-react";
import { Page } from "../courses/Page";
import {
  readSessionSeed,
  readSessionVersion,
  type SessionVersion,
  randomSessionSeed,
  sessionReducer,
  startSession,
} from "./session";
import { evaluateIterationAnswer } from "@bunkercode/tactics-core";
import { TacticInvestigation, iterationValue } from "./TacticInvestigation";
import { TacticOrdering } from "./TacticOrdering";
import { TacticCode } from "./TacticCode";
import { TacticExecution, TacticGoal } from "./TacticExecution";
import "./tactics.css";

function SessionView({
  initialSeed,
  version,
  onNewSession,
}: {
  initialSeed: number | null;
  version: SessionVersion;
  onNewSession: (previous: number) => void;
}) {
  const [state, dispatch] = useReducer(sessionReducer, initialSeed, (seed) =>
    startSession(seed ?? randomSessionSeed(), version),
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
    if (state.completed || state.revealed) {
      nextButton.current?.focus({ preventScroll: true });
      return;
    }
    if (state.index === 0) return;
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "nearest" });
  }, [state.index, state.completed, state.revealed]);
  const send = (type: "run" | "next" | "skip") =>
    dispatch({
      type,
      index: state.index,
      seed: state.seed,
      version: state.version,
    });
  const advance = (type: "next" | "skip", clickCount: number) => {
    if (clickCount > 1) return;
    navigationGesture.current = clickCount === 1;
    send(type);
  };
  const select = (selection: number) =>
    dispatch({
      version: state.version,
      type: "select",
      selection,
      index: state.index,
      seed: state.seed,
    });
  const performed = state.solved + state.skipped;
  const identity = state.round.view.identity;
  const investigation = state.round.family === "iteration" ? state.round : null;
  const conclusion =
    investigation && (state.completed || state.revealed)
      ? evaluateIterationAnswer(
          investigation.model,
          investigation.model.faultId,
        )
      : null;
  const feedback =
    conclusion?.status === "valid" && investigation ? (
      <section
        className={`tactic-execution ${state.revealed ? "investigation-reveal" : ""}`}
        aria-label="Origem do defeito"
      >
        <p
          className={`tactic-verdict ${state.revealed ? "skipped" : "success"}`}
        >
          {state.revealed
            ? "Pulada. Solução revelada."
            : "Diagnóstico correto."}
        </p>
        <dl className="investigation-results">
          <div>
            <dt>Esperado</dt>
            <dd>{iterationValue(conclusion.expected)}</dd>
          </div>
          <div>
            <dt>Produzido</dt>
            <dd>{iterationValue(conclusion.produced)}</dd>
          </div>
        </dl>
        <p>
          <strong>
            Linha{" "}
            {investigation.view.lines.findIndex(
              (line) => line.instructionId === investigation.model.faultId,
            ) + 1}{" "}
            · Origem do defeito
          </strong>
        </p>
        <p>{conclusion.explanation}</p>
        <p className="investigation-correction-label">Instrução correta</p>
        <pre className="investigation-correction" tabIndex={0}>
          <code>{conclusion.correctedCode}</code>
        </pre>
      </section>
    ) : state.result?.family === "iteration" ? (
      <p className="tactic-verdict retry" role="status">
        O diagnóstico não corresponde à origem do problema. Continue
        investigando.
      </p>
    ) : null;
  const actions = (
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
      {state.completed || state.revealed ? (
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
            disabled={
              state.round.family === "iteration"
                ? state.suspect === null
                : state.order === null && state.selection === null
            }
            onClick={() => send("run")}
          >
            <Play size={16} aria-hidden="true" />
            {state.round.family === "iteration"
              ? "Confirmar diagnóstico"
              : "Executar"}
          </button>
        </>
      )}
    </div>
  );
  return (
    <Page
      title="Táticas"
      className={`tactics-lab ${investigation ? "tactics-lab-investigation" : ""}`}
    >
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
            {state.round.family === "collection" ||
            state.round.family === "iteration"
              ? state.round.view.objective
              : state.round.family === "conditional"
                ? "Faça a função produzir os resultados esperados."
                : state.round.family === "assignment"
                  ? `Faça value terminar com ${state.round.view.expectedResult}.`
                  : `Filtre os valores para obter [${state.round.view.expectedResult.join(", ")}].`}
          </h2>
          <TacticGoal round={state.round} />
        </header>
        {state.round.family === "iteration" ? (
          <TacticInvestigation
            key={state.index}
            round={state.round}
            suspect={state.suspect}
            disabled={state.completed || state.revealed}
            revealedInstruction={
              state.completed || state.revealed
                ? state.round.model.faultId
                : null
            }
            feedback={feedback}
            actions={actions}
            onSelect={(instructionId) =>
              dispatch({
                type: "suspect",
                instructionId,
                index: state.index,
                seed: state.seed,
                version: state.version,
              })
            }
          />
        ) : state.round.family === "collection" && state.order ? (
          <TacticOrdering
            round={state.round}
            order={state.order}
            disabled={state.completed}
            onMove={(blockId, direction) =>
              dispatch({
                type: "move",
                blockId,
                direction,
                index: state.index,
                seed: state.seed,
                version: state.version,
              })
            }
          />
        ) : state.round.family !== "collection" ? (
          <TacticCode
            round={state.round}
            selection={state.selection}
            disabled={state.completed}
            onSelect={select}
          />
        ) : null}
        <p
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {state.revealed
            ? "Investigação pulada. Origem do defeito revelada. Próxima rodada disponível."
            : state.round.family === "iteration"
              ? state.result
                ? state.result.value.achieved
                  ? "Diagnóstico correto. Próxima rodada disponível."
                  : "O diagnóstico não corresponde à origem do problema. Continue investigando."
                : state.suspect
                  ? "Instrução selecionada. Confirme o diagnóstico para avaliar."
                  : "Observe a execução e selecione uma instrução suspeita."
              : state.result
                ? state.result.value.achieved
                  ? "Objetivo atingido. Próxima rodada disponível."
                  : "Objetivo ainda não atingido. Você pode ajustar o programa."
                : state.order
                  ? "Organize as instruções e execute para verificar o resultado."
                  : state.selection === null
                    ? "Selecione uma operação para começar."
                    : "Escolha aplicada ao código. Execute para observar o resultado."}
        </p>
        {state.error && <p role="alert">{state.error}</p>}
        {state.round.family !== "iteration" && (
          <>
            <TacticExecution
              key={`${state.index}:${state.selection}:${state.order?.join(",")}`}
              result={state.result}
            />
            {actions}
          </>
        )}
      </section>
      <details className="tactics-session-options">
        <summary>Opções da sessão</summary>
        <div className="tactics-session-info">
          <p>
            Seed da sessão <code>{state.seed}</code> · Versão {state.version} ·
            Progresso somente nesta sessão
          </p>
          <p>
            <a href={`?seed=${state.seed}&version=${state.version}`}>
              Reproduzir sessão
            </a>
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
  const version = readSessionVersion(search);
  const start = (previous?: number) =>
    setSearch(
      { seed: String(randomSessionSeed(previous)), version: "3" },
      { replace: true },
    );
  if (!parsed.valid || version === null)
    return (
      <Page title="Táticas" className="tactics-lab">
        <h1>Táticas</h1>
        <p role="alert">
          {version === null
            ? "Versão de sessão inválida. Use 1, 2 ou 3."
            : "Seed inválida. Use um único inteiro de 0 a 4294967295."}
        </p>
        <button onClick={() => start()}>Nova sessão</button>
      </Page>
    );
  return (
    <SessionView
      key={`${version}:${parsed.seed ?? "random"}`}
      initialSeed={parsed.seed}
      version={version}
      onNewSession={start}
    />
  );
}
