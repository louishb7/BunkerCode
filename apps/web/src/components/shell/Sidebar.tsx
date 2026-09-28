import { FlaskConical, History, LayoutDashboard, ScanSearch, SquareStack, HardDrive } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { useWorkspace } from '../../workspace/WorkspaceProvider';

export function Sidebar() {
  const { pathname } = useLocation();
  const { selectedRunId, runs } = useWorkspace();
  const inspectorId = selectedRunId ?? runs[0]?.id;
  const items = [
    { label: 'Workbench', to: '/', icon: LayoutDashboard, active: pathname === '/' },
    { label: 'Execuções', to: '/runs', icon: History, active: pathname === '/runs' },
    { label: 'Inspector', to: inspectorId ? '/runs/' + inspectorId : '/inspector', icon: ScanSearch, active: pathname === '/inspector' || pathname.startsWith('/runs/') },
    { label: 'Experimentos', to: '/experiments', icon: FlaskConical, active: pathname === '/experiments' },
  ];
  return <aside className="sticky top-0 flex h-dvh w-16 shrink-0 flex-col border-r border-border bg-shell md:w-56" aria-label="BunkerLab">
    <Link to="/" aria-label="BunkerLab · Workbench" className="flex h-20 shrink-0 items-center justify-center gap-3 px-4 md:justify-start md:px-6">
      <SquareStack size={23} strokeWidth={1.6} className="text-accent" /><span className="hidden text-lg font-semibold tracking-tight md:block">Bunker<span className="text-accent">Lab</span></span>
    </Link>
    <nav aria-label="Ferramentas do BunkerLab" className="flex-1 pt-5">
      <p className="mb-3 hidden px-6 text-[10px] font-medium tracking-[0.16em] text-text-muted md:block">WORKSPACE</p>
      {items.map((item, index) => <div key={item.to}>
        {index === 3 && <p className="mb-3 mt-9 hidden px-6 text-[10px] font-medium tracking-[0.16em] text-text-muted md:block">LAB</p>}
        <Link to={item.to} aria-label={item.label} aria-current={item.active ? 'page' : undefined} title={item.label}
          className={'mx-2 mb-1 flex min-h-11 items-center justify-center gap-3 rounded-r-md border-l-2 px-2 text-xs transition-colors md:mx-3 md:justify-start md:px-3 ' +
            (item.active ? 'border-accent bg-accent/10 font-medium text-accent' : 'border-transparent text-text-muted hover:bg-surface hover:text-text-primary') + (index === 3 ? ' max-md:mt-8' : '')}>
          <item.icon size={17} strokeWidth={1.7} /><span className="hidden md:block">{item.label}</span>
        </Link>
      </div>)}
    </nav>
    <div className="mx-3 border-t border-border py-5 md:mx-5"><div className="flex items-center justify-center gap-2 text-xs text-text-muted md:justify-start"><HardDrive size={15} /><span className="hidden md:inline">Ambiente local</span></div><p className="mt-2 hidden text-[10px] text-text-muted/70 md:block">Sessão em memória</p></div>
  </aside>;
}
