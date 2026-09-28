import { useEffect, useState } from 'react';
import type { RunDetail } from '@backendlab/protocol';
import { Link, Navigate, useParams } from 'react-router';
import { api, ApiError } from '../api';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { RunInspector } from '../components/inspector/RunInspector';
import { Button, EmptyState, ErrorMessage } from '../components/ui';

export function InspectorPage() {
  const { runId } = useParams();
  const { selectedRunId, selectRun, runs, runsLoading, runsError } = useWorkspace();
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!runId) return;
    let active = true;
    setDetail(null); setError(null); selectRun(runId);
    api.run(runId).then((next) => { if (active) setDetail(next); }).catch((cause: unknown) => {
      if (active) setError(cause instanceof ApiError && cause.status === 404
        ? 'Esta execução não está disponível. A API pode ter sido reiniciada.'
        : 'Não foi possível carregar a execução. Verifique a API e tente novamente.');
    });
    return () => { active = false; };
  }, [runId, attempt, selectRun]);
  const latestId = selectedRunId ?? runs[0]?.id;
  if (!runId && latestId) return <Navigate to={'/runs/' + latestId} replace />;
  if (!runId) return <div className="rounded-lg border border-border bg-surface"><EmptyState title={runsLoading ? 'Carregando execuções…' : 'Nenhuma execução selecionada.'}>{runsError ?? 'Execute uma ação no Workbench ou selecione uma execução.'}<div className="mt-4"><Link to="/" className="text-accent hover:underline">Abrir Workbench</Link></div></EmptyState></div>;
  if (error) return <div className="space-y-4"><ErrorMessage>{error}</ErrorMessage><div className="flex items-center gap-4"><Button onClick={() => setAttempt(attempt + 1)}>Tentar novamente</Button><Link to="/runs" className="text-xs text-accent hover:underline">Ver execuções</Link></div></div>;
  if (!detail || detail.run.id !== runId) return <p role="status" className="py-12 text-center text-xs text-text-muted">Carregando execução…</p>;
  return <RunInspector key={detail.run.id} detail={detail} refresh={() => setAttempt(attempt + 1)} />;
}
