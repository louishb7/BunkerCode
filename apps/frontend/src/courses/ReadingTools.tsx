import { useState, type CSSProperties, type ReactNode } from "react";
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
      <details className="reading-settings">
        <summary aria-label="Configurações de leitura">Aa</summary>
        <div>
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
              <option value="0">Grafite</option>
              <option value="1">Suave</option>
              <option value="2">Quente</option>
            </select>
          </label>
          <button onClick={() => save(17, 0)}>Restaurar padrões</button>
          {error && <p role="status">{error}</p>}
        </div>
      </details>
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
  const initial = practice ? 46 : 74,
    min = practice ? 38 : 65,
    max = practice ? 60 : 78;
  const [width, setWidth] = useState(() => preference(key, initial, min, max));
  const [error, setError] = useState("");
  function update(value: number) {
    const next = Math.max(min, Math.min(max, value));
    setWidth(next);
    try {
      localStorage.setItem(key, String(next));
    } catch {
      setError("Largura aplicada; preferência não pôde ser guardada.");
    }
  }
  return (
    <div
      className={`study-split ${practice ? "programming-split" : "reading-split"} ${right ? "" : "without-sidebar"}`}
      style={{ "--article-share": `${width}%` } as CSSProperties}
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
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={Math.round(width)}
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
                        : width + (e.key === "ArrowLeft" ? -2 : 2),
                );
              }
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                const rect =
                  e.currentTarget.parentElement!.getBoundingClientRect();
                update(((e.clientX - rect.left) / rect.width) * 100);
              }
            }}
            onPointerUp={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId))
                e.currentTarget.releasePointerCapture(e.pointerId);
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
