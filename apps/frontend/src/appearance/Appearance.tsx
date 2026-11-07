import { useAuth } from "../auth/Auth";
import {
  learningRequest,
  parsePreferences,
  type Preferences,
} from "../learning/api";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
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
function guestPreferences(): Preferences {
  let siteTheme: SiteTheme = "bunkercode";
  try {
    if (localStorage.getItem(siteKey) === "light") siteTheme = "light";
  } catch {
    /* Keep defaults when storage is unavailable. */
  }
  return {
    siteTheme,
    readingTone: savedTone(),
    readingSize: Math.round(savedSize()),
  };
}
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [values, setValues] = useState<Preferences>(guestPreferences);
  const [siteError, setSiteError] = useState("");
  const [readingError, setReadingError] = useState("");
  const current = useRef(values);
  const dirty = useRef<Partial<Preferences>>({});
  const owner = useRef<string | undefined>(undefined);
  const active = useRef<AbortController | undefined>(undefined);
  const ready = useRef(false);
  const version = useRef(0);
  const savedVersion = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saving = useRef(false);
  function apply(value: Preferences) {
    current.current = value;
    setValues(value);
    document.documentElement.dataset.siteTheme = value.siteTheme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute(
        "content",
        value.siteTheme === "light" ? "#f4f4f5" : "#202328",
      );
  }
  function syncError(message: string) {
    setSiteError(message);
    setReadingError(message);
  }
  async function flush(controller: AbortController) {
    if (
      controller.signal.aborted ||
      saving.current ||
      !ready.current ||
      version.current === savedVersion.current
    )
      return;
    saving.current = true;
    const revision = version.current;
    try {
      await learningRequest(
        "/preferences",
        controller.signal,
        "PUT",
        current.current,
      );
      if (!controller.signal.aborted) {
        savedVersion.current = revision;
        syncError("");
      }
    } catch {
      if (!controller.signal.aborted)
        syncError(
          "Aplicada nesta sessão; não sincronizada. Altere novamente para tentar salvar.",
        );
      return;
    } finally {
      if (!controller.signal.aborted) saving.current = false;
    }
    if (!controller.signal.aborted && version.current !== savedVersion.current)
      void flush(controller);
  }
  useLayoutEffect(() => {
    if (loading) return;
    const controller = new AbortController();
    active.current = controller;
    owner.current = user?.id;
    ready.current = false;
    saving.current = false;
    version.current = 0;
    dirty.current = {};
    savedVersion.current = 0;
    syncError("");
    const guest = guestPreferences();
    apply(guest);
    if (user) {
      // POST initializes only if absent; an existing account always wins over guest defaults.
      void learningRequest("/preferences", controller.signal, "POST", guest)
        .then(parsePreferences)
        .then((value) => {
          if (controller.signal.aborted) return;
          ready.current = true;
          apply({ ...value, ...dirty.current });
          if (version.current > 0) void flush(controller);
        })
        .catch(() => {
          if (!controller.signal.aborted)
            syncError(
              "Preferências da conta indisponíveis; alterações nesta sessão não serão sincronizadas.",
            );
        });
    }
    const leaving = () => {
      clearTimeout(timer.current);
      void flush(controller);
    };
    window.addEventListener("pagehide", leaving);
    return () => {
      window.removeEventListener("pagehide", leaving);
      controller.abort();
      clearTimeout(timer.current);
    };
  }, [user?.id, loading]);
  function change(next: Preferences, reading: boolean) {
    const previous = current.current;
    if (user) {
      if (previous.siteTheme !== next.siteTheme)
        dirty.current.siteTheme = next.siteTheme;
      if (previous.readingTone !== next.readingTone)
        dirty.current.readingTone = next.readingTone;
      if (previous.readingSize !== next.readingSize)
        dirty.current.readingSize = next.readingSize;
    }
    apply(next);
    if (user) {
      if (owner.current !== user.id) return;
      version.current++;
      clearTimeout(timer.current);
      const controller = active.current;
      if (controller && ready.current) {
        // Discrete choices persist immediately; only the continuous size control is debounced.
        if (previous.readingSize !== next.readingSize)
          timer.current = setTimeout(() => void flush(controller), 400);
        else void flush(controller);
      }
      return;
    }
    try {
      localStorage.setItem(siteKey, next.siteTheme);
      if (next.readingTone === null) localStorage.removeItem(toneKey);
      else localStorage.setItem(toneKey, String(next.readingTone));
      localStorage.setItem(sizeKey, String(next.readingSize));
      (reading ? setReadingError : setSiteError)("");
    } catch {
      (reading ? setReadingError : setSiteError)(
        "Preferência aplicada nesta sessão; armazenamento indisponível.",
      );
    }
  }
  return (
    <AppearanceContext.Provider
      value={{
        site: values.siteTheme,
        tone: values.readingTone,
        size: values.readingSize,
        effectiveTone:
          values.readingTone ?? (values.siteTheme === "light" ? 3 : 0),
        siteError,
        readingError,
        setSite: (theme) =>
          change({ ...current.current, siteTheme: theme }, false),
        setTone: (tone) =>
          change({ ...current.current, readingTone: tone }, true),
        setSize: (size) =>
          change({ ...current.current, readingSize: size }, true),
        resetReading: () =>
          change(
            { ...current.current, readingTone: null, readingSize: 17 },
            true,
          ),
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
