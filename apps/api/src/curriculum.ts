import type { LabDefinition, LabSummary } from '@backendlab/protocol';
import { lab001Definition } from '@backendlab/lab-001';

const planned: Array<[string, string, string]> = [
  ['002', 'Blocking vs Non-blocking', 'Execution'],
  ['003', 'Persistent State', 'State'],
  ['004', 'Database Query', 'State'],
  ['005', 'Transaction', 'State'],
  ['006', 'Race Condition', 'Concurrency'],
  ['007', 'Locks', 'Concurrency'],
  ['008', 'Connection Pool', 'Concurrency'],
  ['009', 'Load', 'Load & Performance'],
  ['010', 'Queue & Worker', 'Asynchronous Work'],
  ['011', 'Worker Crash', 'Asynchronous Work'],
  ['012', 'Retry', 'Failure & Reliability'],
  ['013', 'Idempotency', 'Failure & Reliability'],
  ['014', 'Cache', 'Load & Performance'],
  ['015', 'Cache Invalidation', 'Load & Performance'],
  ['016', 'Backpressure', 'Load & Performance'],
  ['017', 'Timeout', 'Failure & Reliability'],
  ['018', 'Circuit Breaker', 'Failure & Reliability'],
  ['019', 'Multiple Instances', 'Distribution'],
  ['020', 'Partial Failure', 'Distribution'],
];

export const labDefinitions: LabDefinition[] = [lab001Definition];

export const labSummaries: LabSummary[] = [
  lab001Definition,
  ...planned.map(([number, title, area]) => ({
    id: `${number}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')}`,
    number,
    title,
    area,
    mode: 'observe' as const,
    status: 'planned' as const,
  })),
];
