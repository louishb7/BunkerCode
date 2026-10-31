import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Type } from "lucide-react";
import { createPortal } from "react-dom";
function preference(key: string, fallback: number, min: number, max: number) {
  try {
    const raw = localStorage.getItem(key);
    const value = raw === null ? fallback : Number(raw);
    return Number.isFinite(value)
      ? Math.max(min, Math.min(max, value))
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
  const [size, setSize] = useState(() =>
    preference("bunkercode:reading-size", 17, 16, 21),
  );
  const [tone, setTone] = useState(() =>
    preference("bunkercode:reading-tone", 0, 0, 2),
  );
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const settings = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !settings.current?.contains(event.target)
      )
        setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  function save(font: number, color: number) {
    setSize(font);
    setTone(color);
    try {
      localStorage.setItem("bunkercode:reading-size", String(font));
      localStorage.setItem("bunkercode:reading-tone", String(color));
      setError("");
    } catch {
      setError(
        "Preferência aplicada nesta página; armazenamento indisponível.",
      );
    }
  }
  return (
    <article
      className={`study-explanation reading-tone-${tone}`}
      style={{ "--prose-size": `${size}px` } as CSSProperties}
    >
      {toolbar &&
        createPortal(
          <>
            {tools}
            <div className="reading-settings" ref={settings}>
              <button
                ref={trigger}
                type="button"
                aria-label="Aparência da leitura"
                title="Aparência da leitura"
                aria-expanded={open}
                aria-controls="reading-appearance"
                onClick={() => setOpen(!open)}
              >
                <Type size={21} aria-hidden="true" />
                <span>Aparência</span>
              </button>
              {open && (
                <div
                  id="reading-appearance"
                  role="group"
                  aria-label="Preferências de leitura"
                >
                  <label>
                    Tamanho do texto
                    <input
                      type="range"
                      min="16"
                      max="21"
                      value={size}
                      onChange={(e) => save(Number(e.target.value), tone)}
                    />
                  </label>
                  <label>
                    Tonalidade
                    <select
                      aria-label="Tonalidade"
                      value={tone}
                      onChange={(e) => save(size, Number(e.target.value))}
                    >
                      <option value="0">Padrão BunkerCode</option>
                      <option value="1">Azul profundo</option>
                      <option value="2">Alto contraste</option>
                    </select>
                  </label>
                  <button onClick={() => save(17, 0)}>Restaurar padrões</button>
                  {error && <p role="status">{error}</p>}
                </div>
              )}
            </div>
          </>,
          toolbar,
        )}
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
  right?: (widthControls: ReactNode) => ReactNode;
  practice?: boolean;
  mobileView?: "reading" | "code";
}) {
  const key = "bunkercode:practice-width";
  const initial = 46;
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
          <div className="study-code">
            {right(
              <fieldset className="panel-width-options">
                <legend>Largura</legend>
                <p>{Math.round(effective)}% para a lição</p>
                <div className="panel-preset-buttons">
                  {[
                    { value: 35, label: "Mais código" },
                    { value: initial, label: "Padrão" },
                    { value: 65, label: "Mais leitura" },
                  ].map(({ value, label }) => (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={Math.abs(effective - value) < 0.5}
                      onClick={() => update(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>,
            )}
          </div>
        </>
      )}
      {error && <p role="status">{error}</p>}
    </div>
  );
}
