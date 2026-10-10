import { useEffect, useRef, useState, type ReactNode } from "react";

const preferenceKey = "bunkercode:practice-height";
const defaultRatio = 60;
function initialRatio() {
  try {
    const stored = localStorage.getItem(preferenceKey);
    const ratio = stored === null ? defaultRatio : Number(stored);
    return Number.isFinite(ratio)
      ? Math.max(15, Math.min(85, ratio))
      : defaultRatio;
  } catch {
    return defaultRatio;
  }
}
/** Measures the space left after tabs, actions and the divider; preserves the editor node. */
export function WorkspacePanels({
  tabs,
  editor,
  actions,
  results,
}: {
  tabs: ReactNode;
  editor: ReactNode;
  actions: ReactNode;
  results: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(initialRatio);
  const [available, setAvailable] = useState(400);
  const [error, setError] = useState("");
  const drag = useRef<{
    id: number;
    y: number;
    height: number;
    ratio: number;
  } | null>(null);
  const minimum = Math.min(140, available / 2);
  const maximum = Math.max(minimum, available - Math.min(120, available / 2));
  const height = Math.max(
    minimum,
    Math.min(maximum, (available * ratio) / 100),
  );
  const effective = (height / available) * 100;
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      const reserved = [0, 2, 3].reduce(
        (sum, index) =>
          sum + (node.children[index] as HTMLElement).offsetHeight,
        0,
      );
      setAvailable(Math.max(1, node.clientHeight - reserved));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  function save(next: number) {
    const value = Math.max(
      (minimum / available) * 100,
      Math.min((maximum / available) * 100, next),
    );
    setRatio(value);
    try {
      localStorage.setItem(preferenceKey, String(value));
    } catch {
      setError("Não foi possível guardar a altura preferida.");
    }
  }
  function finish(node: HTMLElement, id: number, cancelled = false) {
    if (drag.current?.id !== id) return;
    if (cancelled) save(drag.current.ratio);
    drag.current = null;
    if (node.hasPointerCapture(id)) node.releasePointerCapture(id);
  }
  return (
    <div
      ref={root}
      className="workspace-panels"
      style={{
        gridTemplateRows: `auto minmax(0, ${effective}fr) auto 8px minmax(0, ${100 - effective}fr)`,
      }}
    >
      <div>{tabs}</div>
      <div className="workspace-editor">{editor}</div>
      <div>{actions}</div>
      <div
        className="workspace-height-divider"
        role="separator"
        tabIndex={0}
        aria-label="Altura do editor e resultados"
        aria-orientation="horizontal"
        aria-valuemin={Math.round((minimum / available) * 100)}
        aria-valuemax={Math.round((maximum / available) * 100)}
        aria-valuenow={Math.round(effective)}
        aria-valuetext={`${Math.round(effective)}% para o editor`}
        title="Arraste ou use ↑ e ↓. Enter restaura a altura."
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          drag.current = {
            id: event.pointerId,
            y: event.clientY,
            height,
            ratio,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (start?.id === event.pointerId)
            save(((start.height + event.clientY - start.y) / available) * 100);
        }}
        onPointerUp={(event) => finish(event.currentTarget, event.pointerId)}
        onPointerCancel={(event) =>
          finish(event.currentTarget, event.pointerId, true)
        }
        onLostPointerCapture={() => {
          if (drag.current) save(drag.current.ratio);
          drag.current = null;
        }}
        onDoubleClick={() => save(defaultRatio)}
        onKeyDown={(event) => {
          const values: Record<string, number> = {
            ArrowUp: effective - (event.shiftKey ? 10 : 2),
            ArrowDown: effective + (event.shiftKey ? 10 : 2),
            Home: (minimum / available) * 100,
            End: (maximum / available) * 100,
            Enter: defaultRatio,
          };
          if (event.key in values) {
            event.preventDefault();
            save(values[event.key]!);
          }
        }}
      />
      <div className="workspace-results">
        {error && <p role="status">{error}</p>}
        {results}
      </div>
    </div>
  );
}
