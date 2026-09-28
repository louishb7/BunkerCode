# BunkerLab

Laboratório visual para usar, inspecionar e evoluir sistemas backend reais. **BunkerLab é o ambiente de engenharia; OrderDesk é o sistema sob teste dentro dele.** O domínio permanece mínimo: um Mechanical Keyboard, estoque inicial de 3 e pedidos de uma unidade, executados pelo backend NestJS.

A application shell organiza quatro superfícies:

- **Workbench** (`/`): uso do OrderDesk e resumo da última execução.
- **Execuções** (`/runs`): histórico real em memória.
- **Inspector** (`/runs/:runId`): request, fluxo, mudanças de estado, eventos e runtime da execução selecionada.
- **Experimentos** (`/experiments`): espaço explicitamente indisponível nesta versão.

Criar pedido pertence ao OrderDesk. Resetar ambiente pertence ao BunkerLab. A investigação começa na consequência de uma ação real.

## Executar

Requisitos: Node.js 22+ e pnpm 11.

```bash
pnpm install
pnpm dev
```

Abra <http://127.0.0.1:5173>. O Vite encaminha `/api` para a API em `127.0.0.1:3001`. Após editar `packages/` ou `labs/`, reinicie `pnpm dev` para reconstruí-los.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Sistema e laboratório

- `GET /system/product`: produto e estoque atual.
- `GET /system/orders`: pedidos criados.
- `POST /system/orders`: cria pedido com `{ "productId": "mechanical-keyboard", "quantity": 1 }`.
- `POST /system/reset`: limpa pedidos e restaura estoque inicial.

A lista de runs está em `GET /labs/001-request-lifecycle/runs`; snapshots e SSE mantêm os endpoints existentes. O navegador prepara uma run, abre SSE e envia a criação de pedido diretamente à API. A API também aceita `POST /system/orders` sem preparação e devolve o ID da run no header `x-bunkerlab-run-id`. O inspector mostra eventos dessa operação real, sem loopback.

Produto, pedidos, estoque, runs e eventos ficam em memória. Reiniciar a API restaura o estado inicial e perde pedidos e telemetria. Reset restaura o domínio e preserva o histórico e a inspeção selecionada até o restart. Mudanças de estado exibidas no Inspector são evidências históricas da ação. Ainda não há persistência ou workspace de edição.

## Estrutura

- `apps/api/src/system`: domínio mínimo do Reference System.
- `apps/api`: infraestrutura do laboratório, correlação, runs e SSE.
- `apps/web`: shell React Router, Workbench, Execuções e Inspector; estilos em Tailwind CSS.
- `packages/protocol`: contratos compartilhados de domínio e telemetria.
- `packages/lab-sdk`: contexto mínimo para emitir evidências.
- `labs/001-request-lifecycle`: identidade interna da observação; não contém mais a request de demonstração.

O aprendizado acompanha a evolução deste sistema, conforme problemas reais surgirem. Veja [arquitetura](docs/architecture/overview.md) e [direção de evolução](docs/curriculum/core.md).
