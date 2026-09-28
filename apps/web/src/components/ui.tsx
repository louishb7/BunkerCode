import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { RunStatus } from '@backendlab/protocol';
import { AlertCircle } from 'lucide-react';

export function Button({ tone = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'secondary' }) {
  return <button type="button" className={'inline-flex items-center justify-center gap-2 rounded-md border px-3.5 py-2 text-xs font-medium transition-colors ' +
    (tone === 'primary' ? 'border-accent bg-accent text-shell hover:bg-accent/90 ' : 'border-border bg-surface text-text-primary hover:bg-surface-elevated ') + className} {...props} />;
}
export function ErrorMessage({ children }: { children: ReactNode }) {
  return <div role="alert" className="flex items-start gap-2 rounded-md border border-danger/25 bg-danger/5 px-4 py-3 text-xs leading-relaxed text-danger"><AlertCircle size={16} className="mt-0.5 shrink-0" /><div>{children}</div></div>;
}
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="px-6 py-12 text-center"><p className="font-medium text-text-primary">{title}</p><div className="mt-2 text-xs leading-relaxed text-text-muted">{children}</div></div>;
}
const statusStyles: Record<RunStatus, string> = {
  completed: 'text-success bg-success/8 border-success/20',
  failed: 'text-danger bg-danger/8 border-danger/20',
  abandoned: 'text-text-muted bg-surface-elevated border-border',
  pending: 'text-warning bg-warning/8 border-warning/20',
  running: 'text-accent bg-accent/8 border-accent/20',
};
export function StatusBadge({ status }: { status: RunStatus }) {
  return <span className={'inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] ' + statusStyles[status]}><span className="size-1 rounded-full bg-current" />{status}</span>;
}
