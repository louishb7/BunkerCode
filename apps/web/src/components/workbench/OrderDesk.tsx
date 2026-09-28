import { Keyboard, PackageOpen, Plus } from 'lucide-react';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { Button, ErrorMessage } from '../ui';

export function OrderDesk() {
  const { state, busy, systemLoading, systemError, orderNotice, createOrder, refreshSystem } = useWorkspace();
  return <section aria-label="OrderDesk · Sistema sob teste" className="overflow-hidden rounded-lg border border-border bg-surface">
    <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-5">
      <div><p className="mb-1.5 text-[10px] font-medium tracking-[0.15em] text-text-muted">SISTEMA SOB TESTE</p><h2 className="text-xl font-semibold tracking-tight">OrderDesk</h2></div>
      <span className="text-xs text-text-muted">Pedidos e estoque</span>
    </header>
    <div className="px-5 pb-6 sm:px-6">
      {systemError && <div className="mt-5"><ErrorMessage>{systemError} <button className="ml-2 underline underline-offset-4" onClick={refreshSystem} disabled={busy !== null}>Atualizar</button></ErrorMessage></div>}
      {!state ? <p className="py-12 text-center text-xs text-text-muted">{systemLoading ? 'Carregando OrderDesk…' : 'Estado do sistema indisponível.'}</p> : <>
        <div className="flex flex-col justify-between gap-6 border-b border-border py-7 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4"><div className="hidden size-14 items-center justify-center rounded-md border border-border bg-background/50 text-text-muted sm:flex"><Keyboard size={28} strokeWidth={1.3} /></div>
            <div><p className="mb-1.5 text-[10px] uppercase tracking-widest text-text-muted">Produto</p><h3 className="text-base font-medium">{state.product.name}</h3>
              <p className="mt-2 text-xs text-text-muted">Estoque disponível <strong data-testid="stock" className="ml-2 font-mono text-sm font-medium text-text-primary">{state.product.stock}</strong></p></div></div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end"><Button tone="primary" onClick={createOrder} disabled={busy !== null || systemLoading || state.product.stock === 0}><Plus size={15} />{busy === 'order' ? 'Criando pedido…' : state.product.stock === 0 ? 'Sem estoque' : 'Criar pedido'}</Button><span className="text-right text-[10px] text-text-muted">1 unidade por pedido</span></div>
        </div>
        <div aria-live="polite" className="flex min-h-11 items-center text-xs text-success">{orderNotice}</div>
        <div className="mb-4 flex items-center gap-2"><h3 className="text-sm font-medium">Pedidos</h3><span className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-[10px] text-text-muted">{state.orders.length}</span></div>
        {state.orders.length === 0 ? <div className="flex min-h-40 flex-col items-center justify-center border-y border-border/70 py-8 text-text-muted"><PackageOpen size={25} strokeWidth={1.3} /><p className="mt-3 text-xs">Nenhum pedido criado.</p><p className="mt-1 text-[11px] text-text-muted/70">O próximo pedido aparecerá aqui.</p></div> :
          <div className="overflow-x-auto"><table className="w-full text-left text-xs"><caption className="sr-only">Pedidos criados no OrderDesk</caption><thead className="border-b border-border text-[10px] uppercase tracking-wider text-text-muted"><tr><th className="py-3 font-normal">Pedido</th><th className="py-3 font-normal">Produto</th><th className="py-3 text-right font-normal">Quantidade</th></tr></thead>
            <tbody>{state.orders.map((order, index) => <tr key={order.id} className="border-b border-border/60"><td className="py-4 pr-4 font-mono text-text-muted">#{String(index + 1).padStart(3, '0')}</td><td className="py-4 pr-4">{state.product.name}</td><td className="whitespace-nowrap py-4 text-right text-text-muted">{order.quantity} {order.quantity === 1 ? 'unidade' : 'unidades'}</td></tr>)}</tbody>
          </table></div>}
      </>}
    </div>
  </section>;
}
