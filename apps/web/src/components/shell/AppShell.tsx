import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Sidebar } from './Sidebar';
import { WorkspaceHeader } from './WorkspaceHeader';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { ErrorMessage } from '../ui';

export function AppShell() {
  const { pathname } = useLocation();
  const { environmentNotice, environmentError } = useWorkspace();
  const title = pathname === '/' ? 'Workbench' : pathname === '/runs' ? 'Execuções' : pathname === '/experiments' ? 'Experimentos' : pathname === '/inspector' || pathname.startsWith('/runs/') ? 'Inspector' : 'Página não encontrada';
  useEffect(() => { document.title = title + ' · BunkerLab'; }, [title]);
  return <div className="flex min-h-dvh">
    <a href="#workspace-content" className="sr-only focus:not-sr-only focus:fixed focus:left-20 focus:top-3 focus:z-50 focus:bg-accent focus:p-3 focus:text-shell">Ir para o conteúdo</a>
    <Sidebar />
    <div className="min-w-0 flex-1"><WorkspaceHeader title={title} />
      <main id="workspace-content" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {environmentNotice && <p role="status" className="mb-5 border-l-2 border-success/50 pl-3 text-xs text-success">{environmentNotice}</p>}
        {environmentError && <div className="mb-5"><ErrorMessage>{environmentError}</ErrorMessage></div>}
        <Outlet />
      </main>
    </div>
  </div>;
}
