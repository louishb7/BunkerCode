import { useCallback, useEffect, useState } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
} from "react-router";
import {
  Box,
  ChevronRight,
  FlaskConical,
  GitCommitHorizontal,
  Layers3,
  X,
} from "lucide-react";
import type { ExperimentConfig, Run, Workbench } from "@backendlab/protocol";
import { Empty } from "./components/shared";
import { api } from "./api";
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
  const navigate = useNavigate();
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
  }, []);
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
  async function start(config: ExperimentConfig) {
    await action(async () => {
      const run = await api.start(bench!.experiments[0]!.id, config);
      navigate(`/runs/${run.id}`);
    }, "Experimento iniciado. O resultado será salvo automaticamente.");
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/">
          <span className="brand-mark">
            <Layers3 size={21} />
          </span>
          BunkerLab<span className="local-tag">LOCAL</span>
        </Link>
        <div className="workspace-label">WORKSPACE</div>
        <div className="workspace-switch">
          <span className="avatar">H</span>
          <div>
            Laboratório local<small>Seu espaço de investigação</small>
          </div>
        </div>
        <nav aria-label="Navegação principal">
          <NavLink to="/" end>
            <FlaskConical size={18} />
            Workbench
          </NavLink>
          <NavLink to="/systems">
            <Box size={18} />
            Sistemas
          </NavLink>
          <NavLink to="/runs">
            <Layers3 size={18} />
            Runs
          </NavLink>
          <NavLink to="/checkpoints">
            <GitCommitHorizontal size={18} />
            Checkpoints
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <span className="small-dot" /> Ambiente local
          <small>
            Código no VS Code.
            <br />
            Evidência no laboratório.
          </small>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            Workspace local <ChevronRight size={14} />{" "}
            <strong>OrderDesk</strong>
          </span>
          <span className="subtle">Backend engineering lab</span>
        </header>
        <main>
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
                    runs={runs}
                    busy={busy}
                    start={start}
                  />
                }
              />
              <Route
                path="systems"
                element={
                  <SystemPage bench={bench} busy={busy} action={action} />
                }
              />
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
        <footer>
          BUILD <span>→</span> RUN <span>→</span> OBSERVE <span>→</span> MODIFY{" "}
          <span>→</span> COMPARE
        </footer>
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
