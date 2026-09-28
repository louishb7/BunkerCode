# BunkerLab

Laboratório visual para usar, inspecionar e evoluir sistemas backend reais. A entrada agora é um **Reference System** mínimo de pedidos e estoque: um Mechanical Keyboard, estoque inicial de 3 e criação de pedidos de uma unidade. Estado e operações vivem no backend NestJS.

O **Workbench** é a interface onde o sistema é usado. Após criar um pedido, **Inspecionar última execução** revela a request, as chamadas de funções, os eventos e o runtime. Request Lifecycle é observado como consequência da ação; não há uma etapa separada de demonstração.

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

O navegador prepara uma run, abre SSE e envia a criação de pedido diretamente à API. A API também aceita `POST /system/orders` sem preparação e devolve o ID da run no header `x-bunkerlab-run-id`. O inspector mostra eventos dessa operação real, sem loopback.

Produto, pedidos, estoque, runs e eventos ficam em memória. Reiniciar a API restaura o estado inicial e perde pedidos e telemetria. Reset limpa o domínio e a última inspeção na UI, mas conserva runs anteriores no backend até o restart. Ainda não há persistência ou workspace de edição.

## Estrutura

- `apps/api/src/system`: domínio mínimo do Reference System.
- `apps/api`: infraestrutura do laboratório, correlação, runs e SSE.
- `apps/web`: Workbench e inspector secundário.
- `packages/protocol`: contratos compartilhados de domínio e telemetria.
- `packages/lab-sdk`: contexto mínimo para emitir evidências.
- `labs/001-request-lifecycle`: identidade interna da observação; não contém mais a request de demonstração.

O aprendizado acompanha a evolução deste sistema, conforme problemas reais surgirem. Veja [arquitetura](docs/architecture/overview.md) e [direção de evolução](docs/curriculum/core.md).
