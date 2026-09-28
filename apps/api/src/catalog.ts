import type { SystemSummary } from "@backendlab/protocol";
import { overselling } from "./experiments/overselling";
export const systems: (SystemSummary & {
  statePath: string;
  reset: { path: string; body: unknown };
})[] = [
  {
    id: "orderdesk",
    statePath: "/state",
    reset: { path: "/reset", body: { stock: 5 } },
    surface: {
      title: "OrderDesk",
      path: "/surface",
      operations: [
        { method: "GET", path: "/state" },
        { method: "POST", path: "/orders" },
      ],
    },
    name: "OrderDesk",
    description: "Backend de pedidos",
  },
];
export const experiments = [overselling];
