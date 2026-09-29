import type { InvestigationView, RunDetail } from "@backendlab/protocol";

export interface InvestigationDefinition {
  id: string;
  systemId: string;
  experimentId: string;
  inspect(detail: RunDetail): InvestigationView | null;
}
