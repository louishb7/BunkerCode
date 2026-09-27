import { useEffect, useState } from "react";
import { BookOpen, ChevronRight } from "lucide-react";
import type { LabDefinition, LabSummary } from "@backendlab/protocol";
import { api } from "./api";
import { areas } from "./areas";
import { Curriculum } from "./Curriculum";
import { LabScreen } from "./LabScreen";

function useRoute(): [string | null, (labId: string | null) => void] {
  const read = () =>
    window.location.hash.startsWith("#/labs/")
      ? window.location.hash.slice(7)
      : null;
  const [labId, setLabId] = useState<string | null>(read);
  useEffect(() => {
    const onHash = () => setLabId(read());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return [
    labId,
    (id) => {
      window.location.hash = id ? `/labs/${id}` : "/";
      setLabId(id);
    },
  ];
}

export function App() {
  const [labId, navigate] = useRoute();
  const [labs, setLabs] = useState<LabSummary[]>([]);
  const [lab, setLab] = useState<LabDefinition | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .labs()
      .then(setLabs)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Falha ao carregar currículo",
        ),
      );
  }, []);
  useEffect(() => {
    if (!labId) {
      setLab(null);
      return;
    }
    api
      .lab(labId)
      .then(setLab)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Falha ao carregar laboratório",
        ),
      );
  }, [labId]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => navigate(null)}
          aria-label="Ir para o currículo"
        >
          <span className="brand-mark">
            <span />
            <span />
            <span />
            <span />
          </span>
          <span>
            Backend<span className="brand-light">Lab</span>
            <small>ENGINEERING OBSERVATORY</small>
          </span>
        </button>
        <div className="sidebar-section-label">WORKSPACE</div>
        <button
          className={`sidebar-link ${!labId ? "selected" : ""}`}
          onClick={() => navigate(null)}
        >
          <BookOpen size={17} /> Curriculum <ChevronRight size={15} />
        </button>
        <div className="sidebar-section-label sidebar-core-label">
          BACKEND ENGINEERING CORE
        </div>
        <nav className="sidebar-areas" aria-label="Áreas do currículo">
          {areas.map((area, index) => (
            <button
              key={area.name}
              className={`sidebar-area ${labId && area.name === "Execution" ? "area-current" : ""}`}
              onClick={() => navigate(null)}
            >
              <span className="area-index">0{index}</span>
              <span>{area.name}</span>
              {index === 0 && <span className="area-live-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="status-dot" /> SYSTEM READY <span>V0.1</span>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="topbar-path">
            <span>BACKENDLAB</span>
            <ChevronRight size={13} />
            <span>{labId ? "EXECUTION" : "CURRICULUM"}</span>
            {labId && (
              <>
                <ChevronRight size={13} />
                <strong>LAB 001</strong>
              </>
            )}
          </div>
          <div className="topbar-right">
            <span className="topbar-live">
              <span className="status-dot" /> LOCAL ENVIRONMENT
            </span>
            <span className="topbar-separator" />
            <span>AUTHOR MODE</span>
          </div>
        </header>
        <main className="content">
          {error && (
            <div className="error-banner">
              {error}
              <button onClick={() => setError(null)}>Fechar</button>
            </div>
          )}
          {labId ? (
            lab ? (
              <LabScreen key={lab.id} lab={lab} onBack={() => navigate(null)} />
            ) : (
              <div className="loading">Carregando laboratório...</div>
            )
          ) : (
            <Curriculum
              labs={labs}
              openLab={() => navigate("001-request-lifecycle")}
            />
          )}
        </main>
      </div>
    </div>
  );
}
