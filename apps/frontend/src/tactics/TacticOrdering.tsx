import { useLayoutEffect, useRef, useId } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import type { Round } from "./session";
import { CodeTokens } from "./TacticCode";

export function TacticOrdering({
  round,
  order,
  disabled,
  onMove,
}: {
  round: Extract<Round, { family: "collection" }>;
  order: readonly string[];
  disabled: boolean;
  onMove: (blockId: string, direction: -1 | 1) => void;
}) {
  const instructions = useId();
  const list = useRef<HTMLOListElement>(null);
  const pending = useRef<{ id: string; direction: -1 | 1 } | null>(null);
  const move = (id: string, direction: -1 | 1) => {
    pending.current = { id, direction };
    onMove(id, direction);
  };
  useLayoutEffect(() => {
    const target = pending.current;
    pending.current = null;
    if (!target) return;
    const row = list.current?.querySelector(`[data-block-id="${target.id}"]`);
    const control =
      row?.querySelector<HTMLButtonElement>(
        `button[data-direction="${target.direction}"]:not(:disabled)`,
      ) ?? row?.querySelector<HTMLButtonElement>("button:not(:disabled)");
    control?.focus({ preventScroll: true });
  }, [order]);
  return (
    <section
      className="tactic-program tactic-ordering"
      aria-label="Programa JavaScript para organizar"
    >
      <div className="tactic-file">
        <span className="tactic-file-dot" aria-hidden="true" />
        programa.js<span>Organizar código</span>
      </div>
      <p className="sr-only" id={instructions}>
        Mova as instruções com Subir e Descer. No botão, Alt e seta para cima ou
        para baixo também movem a instrução. Execute para verificar a
        organização.
      </p>
      <div
        className="tactic-order-data"
        tabIndex={0}
        aria-label="Dados de entrada com rolagem horizontal"
      >
        <pre>
          <code>
            <CodeTokens text={round.view.prelude} />
          </code>
        </pre>
      </div>
      <ol
        ref={list}
        className="tactic-order-blocks"
        aria-label="Instruções na ordem atual"
        aria-describedby={instructions}
      >
        {order.map((id, index) => {
          const block = round.view.blocks.find((item) => item.id === id)!;
          return (
            <li
              key={id}
              data-block-id={id}
              onKeyDown={(event) => {
                if (
                  disabled ||
                  !event.altKey ||
                  !["ArrowUp", "ArrowDown"].includes(event.key)
                )
                  return;
                event.preventDefault();
                move(id, event.key === "ArrowUp" ? -1 : 1);
              }}
            >
              <span className="tactic-order-position" aria-hidden="true">
                {index + 1}
              </span>
              <div
                className="tactic-order-source"
                tabIndex={0}
                aria-label={`Instrução ${index + 1}, código com rolagem horizontal`}
              >
                <code>
                  <CodeTokens text={block.code} />
                </code>
              </div>
              <div className="tactic-order-controls">
                <button
                  type="button"
                  data-direction="-1"
                  aria-label={`Subir instrução ${index + 1}`}
                  aria-keyshortcuts="Alt+ArrowUp"
                  disabled={disabled || index === 0}
                  onClick={() => move(id, -1)}
                >
                  <ArrowUp size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  data-direction="1"
                  aria-label={`Descer instrução ${index + 1}`}
                  aria-keyshortcuts="Alt+ArrowDown"
                  disabled={disabled || index === order.length - 1}
                  onClick={() => move(id, 1)}
                >
                  <ArrowDown size={16} aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
