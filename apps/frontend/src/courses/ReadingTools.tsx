import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Type } from "lucide-react";
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
export function ReadingArticle({ children }: { children: ReactNode }) {
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
      {children}
    </article>
  );
}
export function StudySplit({
  left,
  right,
  practice = false,
}: {
  left: ReactNode;
  right?: ReactNode;
  practice?: boolean;
}) {
  const key = practice
    ? "bunkercode:practice-width"
    : "bunkercode:reading-width";
  const initial = practice ? 46 : 74;
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
  const min = available
    ? Math.min(50, ((practice ? 360 : 420) / available) * 100)
    : 0;
  const max = available
    ? 100 - Math.min(50, ((practice ? 360 : 180) / available) * 100)
    : 100;
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
            aria-label={
              practice
                ? "Largura do artigo e editor"
                : "Largura do artigo e sumário"
            }
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
          <div className={practice ? "study-code" : "study-outline"}>
            {right}
          </div>
        </>
      )}
      {error && <p role="status">{error}</p>}
    </div>
  );
}
export function outlineHeadings(source: string) {
  let fence: { marker: string; size: number } | undefined;
  const headings: { label: string; line: number }[] = [];
  source.split("\n").forEach((line, index) => {
    const match = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (match) {
      if (!fence) fence = { marker: match[1]![0]!, size: match[1]!.length };
      else if (
        match[1]![0] === fence.marker &&
        match[1]!.length >= fence.size &&
        !line.slice(match[0].length).trim()
      )
        fence = undefined;
      return;
    }
    if (!fence && /^#{2,3} /.test(line))
      headings.push({
        label: line.replace(/^#+\s+/, "").replace(/[*`_]/g, ""),
        line: index + 1,
      });
  });
  return headings;
}
export function LessonOutline({
  headings,
}: {
  headings: ReturnType<typeof outlineHeadings>;
}) {
  if (!headings.length) return null;
  return (
    <details open className="lesson-outline">
      <summary>Nesta lição</summary>
      <nav aria-label="Sumário da lição">
        {headings.map((h) => (
          <a key={h.line} href={`#section-line-${h.line}`}>
            {h.label}
          </a>
        ))}
      </nav>
    </details>
  );
}
