import { RotateCcw } from 'lucide-react';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { Button } from '../ui';

export function WorkspaceHeader({ title }: { title: string }) {
  const { busy, reset } = useWorkspace();
  return <header className="flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-5 py-4 lg:px-8">
    <div><p className="mb-1 text-[10px] tracking-widest text-text-muted">BUNKERLAB / WORKSPACE</p><h1 className="text-lg font-semibold tracking-tight">{title}</h1></div>
    <div className="flex flex-wrap items-center gap-4 sm:gap-6">
      <div className="hidden border-r border-border pr-6 text-xs sm:block"><span className="mr-2 text-text-muted">Sistema</span><span>OrderDesk</span><span className="mx-2 text-border">/</span><span className="text-text-muted">Local</span></div>
      <Button onClick={reset} disabled={busy !== null} title="Restaura pedidos e estoque; preserva execuções"><RotateCcw size={14} />{busy === 'reset' ? 'Resetando…' : 'Resetar ambiente'}</Button>
    </div>
  </header>;
}
