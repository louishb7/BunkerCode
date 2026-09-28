import type {
  Evidence,
  ExperimentConfig,
  ExperimentResult,
  ExperimentSummary,
  RequestResult,
  SystemState,
} from "@backendlab/protocol";
export interface ExperimentDefinition {
  id: string;
  systemId: string;
  summary: ExperimentSummary;
  statePath: string;
  validateState(value: unknown): SystemState;
  validateInitial(config: ExperimentConfig, state: SystemState): void;
  observations(
    initial: SystemState,
    result: import("@backendlab/protocol").ExperimentResult,
  ): import("@backendlab/protocol").Observation[];
  setup(config: ExperimentConfig): { path: string; body: unknown };
  operation(index: number): { path: string; body: unknown };
  assert(
    config: ExperimentConfig,
    initial: SystemState,
    final: SystemState,
    requests: RequestResult[],
    evidence: Evidence[],
  ): ExperimentResult;
}
