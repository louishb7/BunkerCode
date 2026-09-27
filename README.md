# BackendLab

> Interactive backend engineering laboratory for observing, experimenting with and understanding real system behavior.

BackendLab turns backend execution into evidence a student can inspect. The first experiment, **001 — Request Lifecycle**, observes a real HTTP request passing through NestJS middleware, controller, service, and response. The map, timeline, and inspector are driven by events from that execution.

This is an early V0. Lab 001 is available in `observe` mode; Labs 002–020 are curriculum plans only. Runs are kept in memory. There is no persistent student progress, code editor, or student workspace yet.

## Stack and setup

TypeScript, Node.js, pnpm workspaces, NestJS, React, and Vite. Use Node.js 22+ and pnpm 11.

```bash
pnpm install
pnpm dev
```

Open <http://127.0.0.1:5173>. Vite serves the web app on **5173** and proxies `/api` to the NestJS API on **127.0.0.1:3001**. The API's direct REST root is <http://127.0.0.1:3001/labs>. `pnpm dev` builds the shared packages first, then starts both applications. After editing `packages/` or `labs/`, restart `pnpm dev` to rebuild them.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Structure

- `apps/api` — Control API, temporary run/event state, SSE, and HTTP orchestration.
- `apps/web` — curriculum and observatory UI.
- `packages/protocol` — shared TypeScript contracts.
- `packages/lab-sdk` — minimal event emission context.
- `labs/001-request-lifecycle` — canonical lab identity and NestJS experiment implementation.
- `docs/architecture` — boundaries and future workspace model.
- `docs/curriculum` — Backend Engineering Core plan.
- `.backendlab/` — reserved generated local state; contents are ignored by Git.

The Control Plane uses a server side HTTP client to call the experiment endpoint in the same NestJS process. This is a genuine loopback HTTP request, not a direct method call. The browser opens SSE before sending the REST start command so short runs can be seen live. See [architecture](docs/architecture/overview.md) for the intentional V0 simplifications.
