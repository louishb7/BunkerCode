# BunkerLab

Laboratório local para **construir, quebrar, executar e comparar pequenos backends reais**. O primeiro sistema é o OrderDesk: compradores concorrentes disputam as últimas unidades de estoque.

## Executar

Requisitos: **Node.js 24+**, pnpm 11 e Git no PATH. Não precisa de Docker ou PostgreSQL.

```bash
pnpm install
pnpm dev
```

Abra <http://127.0.0.1:5173>. A API fica em `127.0.0.1:3001`. As migrations e o workspace local são criados automaticamente. O OrderDesk só inicia ao executar um experimento ou reiniciar o runtime.

## Um ciclo completo

1. No **Workbench**, execute o experimento: 20 compradores disputam 5 unidades.
2. Abra a Run e observe aceitos, rejeitados, estoque e invariantes. A implementação inicial pode vender além do estoque; o resultado depende do intercalamento real.
3. Inspecione o primeiro evento de violação e a leitura anterior daquela request.
4. Em **Sistemas**, copie o caminho do workspace e abra no VS Code:
   `.bunkerlab/workspaces/local/systems/orderdesk/`.
5. Edite `inventory.mjs`. Investigue uma correção própria ou troque `strategy` de `"naive"` para `"atomic"` para observar a referência transacional.
6. Clique em **Reiniciar runtime** para carregar o código salvo. Execute novamente.
7. Em **Runs**, selecione duas execuções e clique em **Comparar selecionadas**.
8. Em **Checkpoints**, salve uma descrição. Isso cria um commit no Git **do workspace**, sem alterar o histórico do BunkerLab.

**Resetar estado** limpa pedidos e restaura 5 unidades, preservando código e histórico. Cada experimento prepara seu próprio estado inicial. **Restaurar checkpoint** substitui código após criar um checkpoint de segurança, para o runtime e preserva o banco; depois reinicie ou execute novamente.

## Estado e código separados

```text
templates/orderdesk/                    base canônica
.bunkerlab/workspaces/local/systems/    código editável + Git independente
.bunkerlab/snapshots/                   código capturado ao carregar o runtime
.bunkerlab/runtime/local/orderdesk/     banco do sistema experimental
.bunkerlab/lab.sqlite                   metadata, Runs, requests e evidências
```

A pasta `.bunkerlab` é ignorada pelo Git principal. Não a apague se quiser preservar sua evolução. `BUNKERLAB_DATA_DIR` permite escolher outro diretório; o caminho padrão é relativo à raiz do projeto, independentemente do diretório de execução.

## Validar

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @backendlab/api migrate
```

O teste de integração abre portas locais, cria workspace descartável e executa os dois comportamentos, crashes, resets, checkpoints, restauração e restart do control plane.

Para validar no navegador:

```bash
pnpm --filter @backendlab/web exec playwright install chromium
pnpm test:browser
```

Ou use um Chromium já instalado: `BROWSER_PATH=/caminho/do/navegador pnpm test:browser`. O teste usa portas 3002/5174 e dados isolados em `.bunkerlab/browser-test`; capturas ficam em `.bunkerlab/browser-results`.

## Escopo

Execução **local e confiável**, não uma sandbox para código remoto. Processos separados preservam o control plane frente a erros do sistema, mas não impõem cotas de CPU/memória. Edição externa + restart explícito; sem IDE web, autenticação ou nuvem.

Detalhes: [arquitetura e decisões](docs/architecture/overview.md), [limites e revisão](docs/architecture/local-laboratory.md).
