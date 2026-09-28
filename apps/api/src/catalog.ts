import type { SystemSummary } from "@backendlab/protocol";
import { overselling } from "./experiments/overselling";
export const systems: SystemSummary[] = [
  {
    id: "orderdesk",
    name: "OrderDesk",
    description:
      "Um backend de pedidos para investigar concorrência e consistência de estoque.",
  },
];
export const experiments = [overselling];
