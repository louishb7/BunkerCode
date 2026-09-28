# BunkerLab

Workspace local para construir, usar, investigar e evoluir pequenos sistemas backend. **O sistema fica no centro; ferramentas do laboratório ficam ao redor.**

## Executar

Requisitos: **Node.js 24+**, pnpm 11 e Git no PATH.

```bash
pnpm install
pnpm dev
```

Abra <http://127.0.0.1:5173>. A API fica em `127.0.0.1:3001`. Migrations e workspace são preparados automaticamente. Ao abrir o Workbench, o OrderDesk inicia e apresenta sua própria interface.

## Trabalhar no sistema

- **Criar pedido** usa o backend real. Estoque e pedidos vêm do banco do OrderDesk.
- **Atividade → Inspecionar** mostra request, resposta e evidências daquela interação. Uso comum não cria Runs.
- **Abrir código → Copiar caminho** localiza a pasta editável no VS Code. `inventory.mjs` contém a operação de estoque; `surface.html` contém a interface do sistema.
- **Reiniciar** carrega um snapshot dos arquivos salvos, preservando o banco.
- **Testar** abre a ferramenta opcional de concorrência. Configure requests, concorrência e estado inicial; a execução deliberada é salva como Run.
- **Histórico** permite inspecionar Runs e selecionar duas para comparação.
- **Checkpoints** salva pontos da evolução no Git independente do workspace. Restore cria backup do código atual antes de substituir arquivos.
- **… → Resetar estado** restaura o banco experimental após confirmação; código, checkpoints e histórico permanecem.

Erros de sintaxe, crash ou indisponibilidade aparecem na área do sistema. Logs e restart continuam acessíveis pelo BunkerLab.

## Responsabilidades

```text
templates/orderdesk/                    base canônica: backend + surface
.bunkerlab/workspaces/local/systems/    código editável + Git próprio
.bunkerlab/snapshots/                   código carregado pelo runtime
.bunkerlab/runtime/local/orderdesk/     banco experimental
.bunkerlab/lab.sqlite                   Runs, resultados, evidências, checkpoints
```

Activities ficam num buffer de até 50 interações por sistema durante a sessão do control plane. Reiniciar a API descarta esse buffer; Runs e checkpoints permanecem no SQLite/Git.

`.bunkerlab` é ignorada pelo Git principal. Não a apague se quiser preservar sua evolução. `BUNKERLAB_DATA_DIR` seleciona outro diretório de dados.

## Workspaces anteriores à surface

Se `server.mjs` ainda for idêntico à versão canônica anterior, o primeiro boot adiciona a surface após salvar um checkpoint de segurança. Edições em `inventory.mjs` são preservadas. Servidores customizados não são sobrescritos: veja [a integração e os limites](docs/architecture/system-surfaces.md). Restaurar um checkpoint anterior à surface pode deixá-la indisponível; o runtime e o histórico continuam acessíveis.

## Validar

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @backendlab/api migrate
```

Integração cobre concorrência real, versão transacional, isolamento de Runs, Activities, crashes, timeouts, persistência, restart, checkpoints, restore e upgrade conservador de workspace.

```bash
pnpm --filter @backendlab/web exec playwright install chromium
pnpm test:browser
```

Também é possível usar Chromium instalado: `BROWSER_PATH=/caminho/do/navegador pnpm test:browser`. Os testes usam portas 3002/5174 e workspace separado em `.bunkerlab/browser-system-first`. Capturas desktop/mobile ficam em `.bunkerlab/browser-results`.

Execução local com código confiável, sem IDE web, autenticação ou infraestrutura cloud. Processos separados não constituem sandbox de execução de código não confiável.

[Arquitetura](docs/architecture/overview.md) · [Surfaces e Activities](docs/architecture/system-surfaces.md) · [Limites e dívida técnica](docs/architecture/local-laboratory.md)
