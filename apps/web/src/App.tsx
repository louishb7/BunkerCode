import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { WorkspaceProvider } from './workspace/WorkspaceProvider';
import { AppShell } from './components/shell/AppShell';
import { WorkbenchPage } from './pages/WorkbenchPage';
import { RunsPage } from './pages/RunsPage';
import { InspectorPage } from './pages/InspectorPage';
import { ExperimentsPage } from './pages/ExperimentsPage';
import { EmptyState } from './components/ui';

export function App() {
  return <BrowserRouter><WorkspaceProvider><Routes><Route element={<AppShell />}>
    <Route index element={<WorkbenchPage />} />
    <Route path="runs" element={<RunsPage />} />
    <Route path="runs/:runId" element={<InspectorPage />} />
    <Route path="inspector" element={<InspectorPage />} />
    <Route path="experiments" element={<ExperimentsPage />} />
    <Route path="*" element={<EmptyState title="Página não encontrada."><Link className="text-accent" to="/">Abrir Workbench</Link></EmptyState>} />
  </Route></Routes></WorkspaceProvider></BrowserRouter>;
}
