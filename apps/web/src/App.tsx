import { useEffect, useState } from 'react';
import type { SystemState } from '@backendlab/protocol';
import { api } from './api';
import { useOrderExecution } from './useOrderExecution';
import { ExecutionInspector } from './ExecutionInspector';

export function App() {
  const [state, setState] = useState<SystemState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const execution = useOrderExecution();

  useEffect(() => {
    let active = true;
    api.state().then((next) => { if (active) setState(next); }).catch(() => {
      if (active) setError('Não foi possível carregar o sistema. Verifique a API e recarregue a página.');
    });
    return () => { active = false; };
  }, []);

  async function createOrder() {
    if (!state || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    setInspectorOpen(false);
    try {
      await execution.createOrder({ productId: state.product.id, quantity: 1 });
      setNotice('Pedido criado.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível confirmar o pedido.');
    } finally {
      try { setState(await api.state()); }
      catch { setError('Não foi possível atualizar o estado. Recarregue antes de tentar novamente.'); }
      setBusy(false);
    }
  }

  async function reset() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setState(await api.reset());
      execution.clear();
      setInspectorOpen(false);
      setNotice('Ambiente resetado.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível resetar o ambiente.');
    } finally { setBusy(false); }
  }

  return (
    <div className="app-shell">
      <header className="site-header"><strong className="brand">Bunker<span>Lab</span></strong><span>Ambiente local</span></header>
      <main className="workbench">
        <div className="workbench-heading"><h1>Pedidos e estoque</h1>
          <button className="text-button" disabled={busy || !state} onClick={reset}>Resetar ambiente</button>
        </div>
        {error && <p className="error-message" role="alert">{error}</p>}
        {!state ? <p className="muted">Carregando sistema…</p> : <>
          <section className="product-row" aria-label="Produto">
            <div><h2>{state.product.name}</h2><p>Estoque disponível: <strong>{state.product.stock}</strong></p></div>
            <button className="primary-button" onClick={createOrder} disabled={busy || state.product.stock === 0}>
              {busy ? 'Aguarde…' : state.product.stock === 0 ? 'Sem estoque' : 'Criar pedido'}
            </button>
          </section>
          <div className="action-feedback" aria-live="polite">{notice}</div>
          <section className="orders-section">
            <div className="orders-heading"><h2>Pedidos</h2><span>{state.orders.length}</span></div>
            {state.orders.length === 0 ? <p className="empty-orders">Nenhum pedido criado.</p> :
              <table className="orders-table"><thead><tr><th>Pedido</th><th>Produto</th><th>Quantidade</th></tr></thead>
                <tbody>{state.orders.map((order, index) => <tr key={order.id}>
                  <td>#{String(index + 1).padStart(3, '0')}</td><td>{state.product.name}</td>
                  <td>{order.quantity} {order.quantity === 1 ? 'unidade' : 'unidades'}</td>
                </tr>)}</tbody>
              </table>}
          </section>
          <div className="inspection-action">
            {execution.detail && <button className="text-button inspect-toggle" disabled={busy}
              aria-expanded={inspectorOpen} aria-controls="execution-inspector" onClick={() => setInspectorOpen(!inspectorOpen)}>
              {inspectorOpen ? 'Fechar inspeção' : 'Inspecionar última execução'} <span aria-hidden="true">{inspectorOpen ? '−' : '+'}</span>
            </button>}
            {execution.inspectionError && <p className="muted">{execution.inspectionError}</p>}
          </div>
          {inspectorOpen && execution.detail && <ExecutionInspector detail={execution.detail} />}
        </>}
      </main>
    </div>
  );
}
