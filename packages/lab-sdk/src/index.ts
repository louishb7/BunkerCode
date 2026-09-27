import type { LabEvent } from '@backendlab/protocol';

export type LabEventInput = Pick<LabEvent, 'source' | 'type' | 'payload'>;

export interface LabContext {
  readonly labId: string;
  readonly runId: string;
  emit(event: LabEventInput): void;
}
