import type { LabEvent, LabRun } from '@backendlab/protocol';

export const runLabel = (id: string) => 'Run ' + id.slice(0, 8).toUpperCase();
export const actionLabel = (action: LabRun['action']) => action === 'create-order' ? 'Criar pedido' : action;
export const duration = (ms?: number) => ms === undefined ? '—' : ms + ' ms';
export const requestLabel = (run: LabRun) => run.request ? `${run.request.method} ${run.request.path}` : 'Request não recebida';
export function clock(timestamp?: number): string {
  return timestamp === undefined ? '—' : new Date(timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, fractionalSecondDigits: 3,
  });
}
export function eventValue(event: LabEvent | undefined, key: string): string {
  const value = event?.payload?.[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '—';
}
