import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { LabRun, SystemState } from '@backendlab/protocol';
import { api } from '../api';
import { useOrderExecution } from '../useOrderExecution';

type Workspace = {
  state: SystemState | null;
  busy: 'order' | 'reset' | null;
  systemLoading: boolean;
  systemError: string | null;
  orderNotice: string | null;
  environmentNotice: string | null;
  environmentError: string | null;
  runs: LabRun[];
  runsLoading: boolean;
  runsError: string | null;
  selectedRunId: string | null;
  selectRun: (id: string) => void;
  refreshSystem: () => Promise<void>;
  refreshRuns: () => Promise<void>;
  createOrder: () => Promise<void>;
  reset: () => Promise<void>;
};
const WorkspaceContext = createContext<Workspace | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SystemState | null>(null);
  const [busy, setBusy] = useState<Workspace['busy']>(null);
  const actionLock = useRef(false);
  const systemGeneration = useRef(0);
  const runsGeneration = useRef(0);
  const [systemLoading, setSystemLoading] = useState(true);
  const [systemError, setSystemError] = useState<string | null>(null);
  const [orderNotice, setOrderNotice] = useState<string | null>(null);
  const [environmentNotice, setEnvironmentNotice] = useState<string | null>(null);
  const [environmentError, setEnvironmentError] = useState<string | null>(null);
  const [runs, setRuns] = useState<LabRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [selectedRunId, selectRun] = useState<string | null>(null);
  const execution = useOrderExecution();

  const refreshSystem = useCallback(async () => {
    const generation = ++systemGeneration.current;
    setSystemLoading(true);
    try {
      const next = await api.state();
      if (generation === systemGeneration.current) { setState(next); setSystemError(null); }
    } catch {
      if (generation === systemGeneration.current) setSystemError('Não foi possível atualizar o OrderDesk. Verifique a API e tente novamente.');
    } finally { if (generation === systemGeneration.current) setSystemLoading(false); }
  }, []);
  const refreshRuns = useCallback(async () => {
    const generation = ++runsGeneration.current;
    setRunsLoading(true);
    try {
      const next = await api.runs();
      if (generation === runsGeneration.current) { setRuns(next); setRunsError(null); }
    } catch {
      if (generation === runsGeneration.current) setRunsError('Não foi possível carregar as execuções. Verifique a API e tente novamente.');
    } finally { if (generation === runsGeneration.current) setRunsLoading(false); }
  }, []);

  useEffect(() => { void refreshRuns(); }, [refreshRuns]);
  useEffect(() => {
    if (execution.detail) selectRun(execution.detail.run.id);
  }, [execution.detail]);

  async function createOrder() {
    if (!state || actionLock.current) return;
    actionLock.current = true;
    setBusy('order'); setOrderNotice(null); setSystemError(null); setEnvironmentNotice(null);
    let failure: string | null = null;
    try {
      await execution.createOrder({ productId: state.product.id, quantity: 1 });
      setOrderNotice('Pedido criado. Estoque atualizado.');
    } catch (cause) {
      failure = cause instanceof Error ? cause.message : 'Não foi possível confirmar o pedido.';
    } finally {
      await Promise.all([refreshSystem(), refreshRuns()]);
      if (failure) setSystemError(failure);
      actionLock.current = false; setBusy(null);
    }
  }
  async function reset() {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy('reset'); setEnvironmentError(null); setEnvironmentNotice(null);
    ++systemGeneration.current;
    try {
      setState(await api.reset());
      setSystemError(null); setOrderNotice(null);
      setEnvironmentNotice('OrderDesk restaurado. As execuções anteriores foram preservadas.');
      await refreshRuns();
    } catch {
      setEnvironmentError('Não foi possível resetar o ambiente. Tente novamente.');
    } finally { actionLock.current = false; setBusy(null); setSystemLoading(false); }
  }
  return <WorkspaceContext value={{ state, busy, systemLoading, systemError, orderNotice,
    environmentNotice, environmentError: environmentError ?? execution.inspectionError,
    runs, runsLoading, runsError, selectedRunId, selectRun, refreshSystem, refreshRuns, createOrder, reset }}>
    {children}
  </WorkspaceContext>;
}

export function useWorkspace(): Workspace {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('WorkspaceProvider is required');
  return context;
}
