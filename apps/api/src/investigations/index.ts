import type { RunDetail } from "@backendlab/protocol";
import { inventoryInvestigation } from "./orderdesk";
import type { InvestigationDefinition } from "./definition";

const definitions: InvestigationDefinition[] = [inventoryInvestigation];
export function investigationsFor(detail: RunDetail) {
  return definitions
    .filter(
      (definition) =>
        definition.systemId === detail.run.systemId &&
        definition.experimentId === detail.run.experimentId,
    )
    .flatMap((definition) => {
      const view = definition.inspect(detail);
      return view ? [view] : [];
    });
}
