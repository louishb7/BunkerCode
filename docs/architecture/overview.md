# Architecture

BackendLab is an interactive laboratory for backend engineering. Its basic unit is a **lab / experiment**: ask a question, predict, run a system, inspect evidence, and explain what happened. A visual state should come from execution whenever practical. Lab 001 uses only real execution; a future simulated lab must identify itself as simulated.

## Planes and observation

- **Control Plane** lists labs, creates runs, assigns IDs, stores temporary events, exposes REST commands and SSE telemetry, and will later manage workspaces. In V0 it lives in `apps/api`.
- **Experiment Plane** runs the studied behavior. Lab 001's NestJS controller and service live in `labs/001-request-lifecycle`. The Control Plane sends an actual HTTP request to that endpoint; middleware, controller, service, and response completion emit events.
- **Observatory** in `apps/web` derives the map, timeline, inspector, and summary from those events. It never imports experiment implementation classes.

Both planes share one NestJS process in V0. This keeps the first experiment easy to run while preserving separate responsibilities in code. The server side HTTP client is the observed client; it makes a loopback request through NestJS. `runId` and a private per-run token associate instrumentation with that request. Runs and events are held in memory and disappear when the API restarts.

Events are the observation unit: each has identity, lab/run IDs, a real timestamp, source, type, and small payload. Explicit `lab-sdk` calls make the order inspectable. The intended evolution is **manual educational events → structured instrumentation → OpenTelemetry**. SSE carries one-way telemetry from backend to browser; REST handles commands and snapshots. The browser creates a pending run, opens SSE, then issues the REST start command. This lets it observe short requests as they happen. A snapshot endpoint and replay on SSE connection recover events after a brief disconnection. Reset abandons an active run and clears visual state.

## Modes

- **Author Mode:** develop `apps/`, `packages/`, `labs/`, and `docs/`. This repository is currently operated in Author Mode.
- **Student Mode:** study an immutable canonical lab. A future `modify` lab will give the student a disposable workspace instead of editing `labs/`.

`observe` shows real behavior without a code change. `experiment` will vary conditions through controls. `modify` will allow code changes in a disposable workspace. Only `observe` is functional in V0.

BackendLab is the observatory and experiment controller. VS Code remains the editing bench. A future modify lab may contain `starter/` and `harness/` under `labs/006-race-condition/`. BackendLab will copy the canonical starter to `.backendlab/workspaces/006-race-condition/attempt-001/`. The student edits that copy in VS Code; a runner executes it against a harness kept outside normal student control and emits telemetry. This workspace, runner, and checkpoint flow is a direction, not a V0 implementation. `.backendlab/workspaces/` and `.backendlab/state/` are reserved for generated local state and are ignored by Git.
