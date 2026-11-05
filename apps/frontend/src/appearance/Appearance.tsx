import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Check,
  Moon,
  Sun,
  RotateCcw,
  Undo2,
  SlidersHorizontal,
} from "lucide-react";
import "./appearance.css";

export const readingTones = [
  "BunkerCode",
  "Azul profundo",
  "Alto contraste",
  "Claro suave",
  "Neutro",
  "Névoa azul",
];
type SiteTheme = "bunkercode" | "light";
const siteKey = "bunkercode:site-theme";
const toneKey = "bunkercode:reading-tone";
const sizeKey = "bunkercode:reading-size";
function savedTone() {
  try {
    const raw = localStorage.getItem(toneKey);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isInteger(value) && value >= 0 && value < readingTones.length
      ? value
      : null;
  } catch {
    return null;
  }
}
function savedSize() {
  try {
    const value = Number(localStorage.getItem(sizeKey) ?? 17);
    return Number.isFinite(value) ? Math.max(16, Math.min(21, value)) : 17;
  } catch {
    return 17;
  }
}
type Appearance = {
  site: SiteTheme;
  tone: number | null;
  effectiveTone: number;
  size: number;
  siteError: string;
  readingError: string;
  setSite: (theme: SiteTheme) => void;
  setTone: (tone: number | null) => void;
  setSize: (size: number) => void;
  resetReading: () => void;
};
const AppearanceContext = createContext<Appearance | null>(null);
export function useAppearance() {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error("AppearanceProvider is required");
  return value;
}
export function AppearanceProvider({ children }: { children: ReactNode }) {
  // The head bootstrap applies the saved global choice before React/CSS paint.
  const [site, updateSite] = useState<SiteTheme>(() =>
    document.documentElement.dataset.siteTheme === "light"
      ? "light"
      : "bunkercode",
  );
  const [tone, updateTone] = useState(savedTone);
  const [size, updateSize] = useState(savedSize);
  const [siteError, setSiteError] = useState("");
  const [readingError, setReadingError] = useState("");
  function persist(action: () => void, report: (error: string) => void) {
    try {
      action();
      report("");
    } catch {
      report("Preferência aplicada nesta sessão; armazenamento indisponível.");
    }
  }
  function setSite(theme: SiteTheme) {
    updateSite(theme);
    document.documentElement.dataset.siteTheme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "light" ? "#f4f4f5" : "#111417");
    persist(() => localStorage.setItem(siteKey, theme), setSiteError);
  }
  function setTone(value: number | null) {
    updateTone(value);
    persist(
      () =>
        value === null
          ? localStorage.removeItem(toneKey)
          : localStorage.setItem(toneKey, String(value)),
      setReadingError,
    );
  }
  function setSize(value: number) {
    updateSize(value);
    persist(
      () => localStorage.setItem(sizeKey, String(value)),
      setReadingError,
    );
  }
  function resetReading() {
    updateTone(null);
    updateSize(17);
    persist(() => {
      localStorage.removeItem(toneKey);
      localStorage.setItem(sizeKey, "17");
    }, setReadingError);
  }
  return (
    <AppearanceContext.Provider
      value={{
        site,
        tone,
        effectiveTone: tone ?? (site === "light" ? 3 : 0),
        size,
        siteError,
        readingError,
        setSite,
        setTone,
        setSize,
        resetReading,
      }}
    >
      {children}
    </AppearanceContext.Provider>
  );
}

export function AppearanceControl({ reading }: { reading: boolean }) {
  const appearance = useAppearance();
  const [open, setOpen] = useState(false);
  const settings = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !settings.current?.contains(event.target)
      ) {
        // A click on another control retains that control's normal focus.
        if (settings.current?.contains(document.activeElement))
          trigger.current?.focus();
        setOpen(false);
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
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
  // A route change cannot leave reading-only controls open on another page.
  useEffect(() => {
    setOpen(false);
  }, [reading]);
  return (
    <>
      <div
        className={`appearance-control ${reading ? "reading-appearance" : "site-appearance"}`}
        ref={settings}
        onBlur={(event) => {
          if (
            event.relatedTarget instanceof Node &&
            !event.currentTarget.contains(event.relatedTarget)
          )
            setOpen(false);
        }}
      >
        <button
          ref={trigger}
          type="button"
          className="appearance-trigger"
          aria-label={reading ? "Ajustar leitura" : "Tema do site"}
          aria-expanded={open}
          aria-controls={
            reading ? "reading-appearance-panel" : "site-appearance-panel"
          }
          onClick={() => setOpen(!open)}
        >
          {reading ? (
            <SlidersHorizontal size={18} aria-hidden="true" />
          ) : appearance.site === "light" ? (
            <Sun size={18} aria-hidden="true" />
          ) : (
            <Moon size={18} aria-hidden="true" />
          )}
          <span>{reading ? "Ajustar leitura" : "Tema"}</span>
        </button>
        {open && (
          <div
            id={reading ? "reading-appearance-panel" : "site-appearance-panel"}
            className="appearance-panel"
            role="group"
            aria-label={reading ? "Preferências de leitura" : "Tema global"}
          >
            {!reading && (
              <div
                className="site-theme-options"
                role="group"
                aria-label="Tema do site"
              >
                {(["bunkercode", "light"] as const).map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    aria-pressed={appearance.site === theme}
                    onClick={() => appearance.setSite(theme)}
                  >
                    {theme === "light" ? (
                      <Sun size={17} aria-hidden="true" />
                    ) : (
                      <Moon size={17} aria-hidden="true" />
                    )}
                    <span>{theme === "light" ? "Light" : "Dark"}</span>
                    {appearance.site === theme && (
                      <Check size={16} aria-hidden="true" />
                    )}
                  </button>
                ))}
              </div>
            )}
            {!reading && appearance.siteError && (
              <p role="status">Tema do site: {appearance.siteError}</p>
            )}
            {reading && (
              <fieldset>
                <legend>Tonalidade da leitura</legend>
                <div className="reading-tone-options">
                  {readingTones.map((label, value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={appearance.effectiveTone === value}
                      onClick={() => appearance.setTone(value)}
                    >
                      {appearance.effectiveTone === value && (
                        <Check size={14} aria-hidden="true" />
                      )}
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                <button
                  className="reading-inherit"
                  type="button"
                  disabled={appearance.tone === null}
                  onClick={() => appearance.setTone(null)}
                >
                  <Undo2 size={14} aria-hidden="true" /> Usar tema do site
                </button>
                <label>
                  Tamanho do texto
                  <input
                    type="range"
                    min="16"
                    max="21"
                    value={appearance.size}
                    onChange={(event) =>
                      appearance.setSize(Number(event.target.value))
                    }
                  />
                </label>
                <button
                  className="reading-reset"
                  type="button"
                  aria-label="Restaurar leitura"
                  title="Restaurar leitura"
                  onClick={appearance.resetReading}
                >
                  <RotateCcw size={16} aria-hidden="true" />
                </button>
                {appearance.readingError && (
                  <p role="status">Leitura: {appearance.readingError}</p>
                )}
              </fieldset>
            )}
          </div>
        )}
      </div>
    </>
  );
}
