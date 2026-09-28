import { FlaskConical } from 'lucide-react';
import { Link } from 'react-router';

export function ExperimentsPage() {
  return <section className="max-w-3xl rounded-lg border border-border bg-surface p-7">
    <div className="mb-5 flex items-center gap-3 text-text-muted"><FlaskConical size={22} strokeWidth={1.5} /><span className="rounded border border-border px-2 py-1 text-[10px] uppercase tracking-wider">Indisponível nesta versão</span></div>
    <h2 className="text-lg font-medium">Experimentos controlados</h2>
    <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-muted">Esta área será introduzida quando o OrderDesk tiver fenômenos reais para manipular. Por enquanto, use o sistema e investigue as execuções que ele produz.</p>
    <Link to="/" className="mt-6 inline-block text-xs font-medium text-accent hover:underline">Voltar ao Workbench →</Link>
  </section>;
}
