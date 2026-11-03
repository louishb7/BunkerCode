import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AppearanceControl, useAppearance } from "../appearance/Appearance";
function preference(key: string, fallback: number, min: number, max: number) {
  try {
    const raw = localStorage.getItem(key);
    const value = raw === null ? fallback : Number(raw);
    return raw?.trim() && Number.isFinite(value) && value > min && value < max
      ? value
      : fallback;
  } catch {
    return fallback;
  }
}
export function ReadingArticle({
  children,
  tools,
}: {
  children: ReactNode;
  tools?: ReactNode;
}) {
  const [toolbar, setToolbar] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setToolbar(document.getElementById("reading-tools"));
  }, []);
  const { size, effectiveTone: tone } = useAppearance();
  return (
    <article
      className={`study-explanation reading-theme reading-tone-${tone}`}
      style={{ "--prose-size": `${size}px` } as CSSProperties}
    >
      {toolbar && tools && createPortal(tools, toolbar)}
      <AppearanceControl reading />
      {children}
    </article>
  );
}
export function StudySplit({
  left,
  right,
  practice = false,
  mobileView = "reading",
}: {
  left: ReactNode;
  right?: ReactNode;
  practice?: boolean;
  mobileView?: "reading" | "code";
}) {
  const key = "bunkercode:practice-width";
  const initial = 55;
  const container = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number } | null>(null);
  const [available, setAvailable] = useState(0);
  const [width, setWidth] = useState(() => preference(key, initial, 0, 100));
  const [error, setError] = useState("");
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      const style = getComputedStyle(node);
      const gap = parseFloat(style.columnGap) || 0;
      const divider = node.querySelector<HTMLElement>(".study-divider");
      setAvailable(
        divider?.offsetWidth
          ? node.clientWidth - gap * 2 - divider.offsetWidth
          : 0,
      );
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  // Both fractional tracks share exactly the space left after the gutter and handle.
  const min = available ? Math.min(50, (360 / available) * 100) : 0;
  const max = available ? 100 - Math.min(50, (360 / available) * 100) : 100;
  const effective = Math.max(min, Math.min(max, width));
  function update(value: number) {
    const next = Math.max(min, Math.min(max, value));
    setWidth(next);
    try {
      localStorage.setItem(key, String(next));
      setError("");
    } catch {
      setError("Largura aplicada; preferência não pôde ser guardada.");
    }
  }
  return (
    <div
      ref={container}
      data-mobile-view={mobileView}
      className={`study-split ${practice ? "programming-split" : "reading-split"} ${right ? "" : "without-sidebar"}`}
      style={
        {
          "--article-weight": `${effective}fr`,
          "--sidebar-weight": `${100 - effective}fr`,
        } as CSSProperties
      }
    >
      {left}
      {right && (
        <>
          <div
            role="separator"
            aria-label="Largura do artigo e editor"
            aria-orientation="vertical"
            aria-valuemin={Math.round(min)}
            aria-valuemax={Math.round(max)}
            aria-valuenow={Math.round(effective)}
            aria-valuetext={`${Math.round(effective)}% para a leitura`}
            title="Arraste ou use ← e →. Enter restaura 55%."
            tabIndex={0}
            className="study-divider"
            onDoubleClick={() => update(initial)}
            onKeyDown={(e) => {
              if (
                ["ArrowLeft", "ArrowRight", "Home", "End", "Enter"].includes(
                  e.key,
                )
              ) {
                e.preventDefault();
                update(
                  e.key === "Home"
                    ? min
                    : e.key === "End"
                      ? max
                      : e.key === "Enter"
                        ? initial
                        : effective + (e.key === "ArrowLeft" ? -2 : 2),
                );
              }
            }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              drag.current = {
                x: e.clientX,
                left: (available * effective) / 100,
              };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (
                drag.current &&
                available &&
                e.currentTarget.hasPointerCapture(e.pointerId)
              )
                update(
                  ((drag.current.left + e.clientX - drag.current.x) /
                    available) *
                    100,
                );
            }}
            onPointerUp={(e) => {
              drag.current = null;
              if (e.currentTarget.hasPointerCapture(e.pointerId))
                e.currentTarget.releasePointerCapture(e.pointerId);
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onLostPointerCapture={() => {
              drag.current = null;
            }}
          />
          <div className="study-code">{right}</div>
        </>
      )}
      {error && <p role="status">{error}</p>}
    </div>
  );
}
