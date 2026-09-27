import {
  Activity,
  Database,
  GitBranch,
  Layers3,
  ShieldCheck,
  Waves,
  Zap,
} from "lucide-react";

export const areas = [
  {
    name: "Execution",
    icon: Zap,
    description: "Como uma request atravessa um sistema.",
  },
  {
    name: "State",
    icon: Database,
    description: "Onde dados vivem e como mudam.",
  },
  {
    name: "Concurrency",
    icon: GitBranch,
    description: "O que acontece ao mesmo tempo.",
  },
  {
    name: "Asynchronous Work",
    icon: Layers3,
    description: "Trabalho que continua depois da request.",
  },
  {
    name: "Load & Performance",
    icon: Activity,
    description: "Comportamento sob pressão.",
  },
  {
    name: "Failure & Reliability",
    icon: ShieldCheck,
    description: "Falhas, recuperação e limites.",
  },
  {
    name: "Distribution",
    icon: Waves,
    description: "Quando um sistema vira muitos.",
  },
];
