import { useCallback, useEffect, useState } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useSearchParams,
  useLocation,
} from "react-router";
import {
  Box,
  PanelLeftClose,
  PanelLeftOpen,
  Maximize2,
  FlaskConical,
  GitCommitHorizontal,
  Layers3,
  X,
} from "lucide-react";
import type { Run, Workbench } from "@backendlab/protocol";
import { Empty } from "./components/shared";
import { api, selectSystem } from "./api";
import { WorkbenchPage } from "./pages/WorkbenchPage";
import { RunsPage } from "./pages/RunsPage";
import { SystemPage } from "./pages/SystemPage";
import { Checkpoints } from "./pages/Checkpoints";
import { Inspector } from "./pages/Inspector";
import { Compare } from "./pages/Compare";
function Laboratory() {
  const [bench, setBench] = useState<Workbench | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [acting, setActing] = useState(false);
  const [params] = useSearchParams();
  const location = useLocation();
  const [systemId, setSystemId] = useState(
    () =>
      params.get("system") ??
      localStorage.getItem("bunkerlab.system") ??
      "orderdesk",
  );
  const [sidebar, setSidebar] = useState(
    () =>
      localStorage.getItem("bunkerlab.sidebar") ??
      (window.innerWidth < 800 ? "collapsed" : "expanded"),
  );
  selectSystem(systemId);
  useEffect(() => {
    const id = params.get("system");
    if (id && id !== systemId) {
      setBench(null);
      setSystemId(id);
      localStorage.setItem("bunkerlab.system", id);
    }
  }, [params, systemId]);
  function changeSidebar(value: string) {
    setSidebar(value);
    localStorage.setItem("bunkerlab.sidebar", value);
  }

  const refresh = useCallback(async () => {
    try {
      const [workbench, history] = await Promise.all([
        api.workbench(),
        api.runs(),
      ]);
      setBench(workbench);
      setRuns(history);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível conectar ao laboratório.",
      );
    }
  }, [systemId]);
  useEffect(() => {
    let disposed = false;
    async function poll() {
      if (!disposed) {
        await refresh();
        if (!disposed) timer = window.setTimeout(poll, 1800);
      }
    }
    let timer = window.setTimeout(poll, 0);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [refresh]);
  async function action(operation: () => Promise<unknown>, success: string) {
    if (acting) return;
    setActing(true);
    setError("");
    setNotice("");
    try {
      await operation();
      setNotice(success);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "A operação falhou.");
    } finally {
      setActing(false);
    }
  }
  const busy = acting || !!bench?.busy;
  return (
    <div className={`app-shell sidebar-${sidebar}`}>
      {sidebar === "hidden" && (
        <button
          className="restore-sidebar"
          aria-label="Mostrar navegação"
          onClick={() => changeSidebar("expanded")}
        >
          <PanelLeftOpen size={18} />
        </button>
      )}
      <aside className="sidebar">
        <Link className="brand" to="/">
          <span className="brand-mark">
            <Layers3 size={21} />
          </span>
          <span className="brand-name">BunkerLab</span>
        </Link>
        <button
          className="sidebar-collapse"
          aria-label={
            sidebar === "expanded" ? "Recolher navegação" : "Expandir navegação"
          }
          onClick={() =>
            changeSidebar(sidebar === "expanded" ? "collapsed" : "expanded")
          }
        >
          {sidebar === "expanded" ? (
            <PanelLeftClose size={18} />
          ) : (
            <PanelLeftOpen size={18} />
          )}
        </button>
        <nav aria-label="Navegação principal">
          <NavLink to="/" end aria-label="Workbench" title="Workbench">
            <FlaskConical size={18} />
            <span>Workbench</span>
          </NavLink>
          <NavLink to="/systems" aria-label="Sistemas" title="Sistemas">
            <Box size={18} />
            <span>Sistemas</span>
          </NavLink>
          <NavLink to="/runs" aria-label="Histórico" title="Histórico">
            <Layers3 size={18} />
            <span>Histórico</span>
          </NavLink>
          <NavLink
            to="/checkpoints"
            aria-label="Checkpoints"
            title="Checkpoints"
          >
            <GitCommitHorizontal size={18} />
            <span>Checkpoints</span>
          </NavLink>
        </nav>
        <button
          className="sidebar-focus"
          aria-label="Ocultar navegação"
          onClick={() => changeSidebar("hidden")}
        >
          <Maximize2 size={16} />
          <span>Mais espaço</span>
        </button>
      </aside>
      <div className="main-shell">
        <main className={location.pathname === "/" ? "workbench-main" : ""}>
          {error && (
            <div className="alert error" role="alert">
              {error}
              <button
                className="icon-button"
                aria-label="Fechar erro"
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="alert notice" role="status">
              {notice}
              <button
                className="icon-button"
                aria-label="Fechar mensagem"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {!bench ? (
            <Empty>
              Conectando ao control plane…{" "}
              <button onClick={() => void refresh()}>Tentar novamente</button>
            </Empty>
          ) : (
            <Routes>
              <Route
                index
                element={
                  <WorkbenchPage
                    bench={bench}
                    busy={busy}
                    action={action}
                    refresh={refresh}
                    key={systemId}
                  />
                }
              />
              <Route path="systems" element={<SystemPage />} />
              <Route path="runs" element={<RunsPage runs={runs} />} />
              <Route path="runs/:id" element={<Inspector />} />
              <Route path="compare" element={<Compare />} />
              <Route
                path="checkpoints"
                element={
                  <Checkpoints bench={bench} busy={busy} action={action} />
                }
              />
              <Route
                path="*"
                element={
                  <Empty>
                    Página não encontrada. <Link to="/">Abrir Workbench</Link>
                  </Empty>
                }
              />
            </Routes>
          )}
        </main>
      </div>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Laboratory />
    </BrowserRouter>
  );
}
