# Consolidação e primeiro MVP editorial

Data: 2026-10-08. Relatório desta rodada, com decisões, integridade e evidências. A implementação começou no worktree; por pedido posterior do autor, o estado final foi transferido ao checkout principal na main, sem commit.

## Integridade inicial — Gate A concluído

Checkout de trabalho: `/home/henrique/.codex/worktrees/6cd5/BunkerCode`, detached em `46633e1`. Contém as duas atividades recentes, ainda não versionadas. O principal está limpo em `2d285bd`, com mudanças em subsistemas históricos; não foi mesclado nem modificado.

Antes das mudanças, foram preservados os 111 arquivos rastreados/untracked em `/tmp/bunkercode-consolidation-2026-10-08/source-before.tar.gz`, status Git e hashes dos dados locais. Esse snapshot é apoio temporário local, não substitui Git. Os dois exercícios e documentos recentes foram movidos/adaptados, não descartados.

Dados identificados: `.bunkercode` (1,7 MiB, tentativas e artefatos da rodada anterior), `.bunkerlab` (5,9 MiB, dados/smoke do legado) e `.backendlab` (20 KiB, placeholders históricos). Bancos/workspaces/checkpoints ignorados foram mantidos no disco. Foram removidos somente `.backendlab/state/.gitkeep` e `.backendlab/workspaces/.gitkeep`, placeholders versionados sem dados pessoais.

Conferência final dos hashes: os 19 arquivos preexistentes de `.bunkercode` e os 151 de `.bunkerlab` continuam idênticos; nenhum ausente ou alterado. Novos smokes/E2E foram para diretórios distintos. As auditorias também continuam idênticas:

- bunkercode-legacy-demolition.md: `885c5015274d3faa2976d1e8c1558b03d3ac35597571c4796417d85f1857902b`.
- bunkerlab-reconstruction-audit.md: `685a765fc9be677674b6d78c40c5ed6a2288b86575647b4f8a4d0be4aa15cc75`.

## Decisões atuais

- Duas aplicações PNPM: `apps/frontend` e `apps/backend`; sem package de protocolo histórico.
- Um bootstrap Nest modular para conteúdo e aprendizagem. Ler curso/lição não executa código nem cria Attempt.
- `course.json` ordena lições; `lesson.md` contém redação e exemplos. Sem MDX ou HTML executável.
- Backend lê arquivos sob demanda; reload apresenta conteúdo salvo sem rebuild.
- Dois exercícios continuam opcionais em `/learn`, com contratos/dados próprios existentes.
- README/AGENTS e arquitetura atual são normativos; auditorias/arquiteturas anteriores ficam como história.

## Inventário da mudança

Realocados/adaptados: apps/api → apps/backend; apps/web → apps/frontend. Bootstrap learning-main/application virou o bootstrap único main/application/AppModule. Conteúdo de atividades saiu de learning/content.ts para content/activities.ts, com imports próximos dos produtores. LearningModule, store, migrations de aprendizagem, instrumentos, supervisor, testes e UI dos dois exercícios recentes foram preservados. Removido o header duplicado da UI de exercícios, agora atendido pelo shell comum.

Retirados do caminho versionado: apps/api/src de laboratório (LaboratoryService/Controller, runtime, runner, repository, workspace, paths, catalog, experiments/investigations, migrate), migrations 001-laboratory/002-checkpoint-kind; componentes e páginas Workbench/System/Surface/Inspector/Compare/Checkpoints/Runs/TestTool/Investigation; cliente HTTP e CSS antigos; packages/protocol; templates/orderdesk; fixtures e testes exclusivos desses subsistemas. Não existe wrapper de compatibilidade. O código retirado permanece recuperável no Git/snapshot inicial.

Criados: backend content/courses.ts e ContentController; frontend courses/Pages, Markdown, api e reader.css; duas lições demonstrativas e course.json; scripts/new-lesson.mjs e testes; testes de conteúdo e cursos; guia de autoria e este relatório. README, AGENTS, configs raiz/aplicações e lockfile atualizados. Documentação anterior selecionada realocada para docs/history, com aviso histórico e links ajustados; proposta de reconstrução e first-learning-flows identificados como históricos.

Configurações específicas permanecem nas aplicações: Vite, Playwright, tsconfigs de aplicação/testes. tsconfig.learning-tests.json virou tsconfig.tests.json nas duas aplicações. Não há config Nest CLI, aliases universais, Nx, Turborepo ou package vazio. ESLint/strictness da raiz têm dois consumidores reais; lib DOM foi retirada do base e declarada somente no frontend.

Nomes ativos: bunkercode, @bunkercode/backend, @bunkercode/frontend, BUNKERCODE_API_URL e createApplication. build:packages e o bootstrap/comandos separados de aprendizagem foram retirados. Nomes históricos só aparecem em documentação/proveniência e regras de ignore para proteger dados preservados.

## Estratégia e fluxo

Primeiro isolamos o trabalho recente e os dados; depois retiramos os subsistemas sem consumidor, unificamos a aplicação Nest e instalamos dependências locais. O MVP adiciona somente funções concretas de leitura, um controller, páginas e o gerador de duas alterações de conteúdo. Não há framework editorial.

O backend descobre pastas, valida o manifesto e deriva o caminho de Markdown. GET devolve conteúdo e anterior/próxima, sem cache. React apresenta Markdown seguro; código fenced é texto com highlighting. Salvar e recarregar consulta os arquivos novamente. Uma Lesson pode referenciar activityId, mas não depende dele nem cria Attempt ao abrir.

course.json é a fonte de identidade, títulos e ordem. lesson.md é a redação independente; o primeiro heading idêntico ao título é omitido somente na apresentação. O gerador acrescenta uma entrada, recusa sobreposição e usa lock/rename local, com rollback da nova lição em falha comum. Author Mode continua sendo edição do repositório; Student Mode conserva cópias/submissões e revisão otimista dos exercícios.

## Validações executadas

| Verificação | Resultado |
| --- | --- |
| pnpm install --store-dir node_modules/.pnpm-store --ignore-scripts | Concluído; dependências locais, sem symlinks para outro checkout |
| pnpm -r list --depth -1 | Raiz e duas aplicações reconhecidas |
| pnpm lint | Passou |
| pnpm typecheck | Passou; aplicações e testes |
| pnpm test | 17 testes backend + 4 de autoria passaram; zero skips/cancelamentos |
| pnpm build | Passou nas duas aplicações |
| pnpm test:browser | Falha ambiental anterior à execução: Chromium headless esperado não instalado |
| BROWSER_PATH=/opt/brave.com/brave/brave pnpm test:browser | 5 E2E passaram em 24,9 s; zero skips/retries |
| Smoke manual com pnpm dev | Concluído: curso, duas lições, edição/reload, comando de autoria, anterior/próxima e viewport 390×844 |
| Hashes dos dados e auditorias | Preservação confirmada |
| Git status/diff/diff --check | Conferidos; sem whitespace inválido, stage, commit ou push |

O smoke manual usou `.bunkercode/consolidation-smoke-content` e `consolidation-smoke-data`, sem editar arquivos canônicos. O texto salvo apareceu sem reiniciar/rebuild; o comando documentado criou Nota de smoke, e a navegação se atualizou após refresh. Em 390 pixels, o documento não excedeu a viewport. Dev foi encerrado deliberadamente ao terminar; exit 130/143 nesse encerramento não é falha do aplicativo.

Capturas desktop/mobile dos E2E foram inspecionadas visualmente em `.bunkercode/consolidation-browser-results/courses-authored-courses-r-4fe43-and-refresh-without-rebuild/lesson-{desktop,mobile}.png`. A terceira lição mostrada nessas capturas pertence somente à cópia de teste. Tipografia, hierarquia, exemplos e navegação estão legíveis; linhas longas ficam no scroll interno do bloco. Ao terminar, nenhuma das portas 3001/5173/3012/5184 permanecia ouvindo.

Testes novos: quatro HTTP/IO de conteúdo (ordem/reload/curso novo/nenhuma Attempt ou execução; erros/traversal/manifesto/arquivo ausente; symlinks; limite de tamanho); quatro de autoria (criação/duplicação; arquivo existente/slug; symlink/lock; rollback); dois E2E (percurso editorial/novo curso/mobile; Markdown inerte/URLs inseguras/erro/vazio). Os treze testes de aprendizagem e três E2E recentes continuam exercitando persistência, fonte congelada, revisão obsoleta, submissão antes do resultado, testes reais, timeout/crash/cleanup e retomada.

Testes aposentados na árvore inicial do worktree: laboratory.integration.test.ts (17 casos) e workspace-upgrade.test.ts (3); laboratory.spec.ts (2) e investigation.spec.ts (1), com suas fixtures. Ao transferir para a main, a mesma aposentadoria também retirou os casos adicionais presentes no HEAD mais recente: total de 24 casos backend e 4 E2E históricos na main. Foram removidos porque as funcionalidades correspondentes foram deliberadamente retiradas, não porque falharam ou para adaptar sua cobertura superficialmente.

Falhas/reruns desta rodada: lint inicialmente apontou retorno/throw em finally do gerador; cleanup foi reestruturado e lint passou. O E2E editorial inicialmente usava letras/setas decorativas no nome acessível; seletores corrigidos após leitura do error-context, e o percurso focado passou. A execução padrão final dos cinco E2E não chegou a abrir páginas por ausência do browser esperado; foi repetida com o executável existente. Não houve skips ou retries automáticos configurados.

Warnings/ambiente: ESLint 9.39.5 foi marcado deprecated no install; um retry de registry resolveu normalmente. Aviso de atualização PNPM foi apenas informativo. Vite sinaliza chunk de 585,61 kB minificado (182,62 kB gzip); não há alegação de ganho de performance. NO_COLOR/FORCE_COLOR gera warning no runner de navegador. Mover dependências antigas por rename entre mounts falhou EXDEV; foi repetido como movimentação entre filesystems preservando symlinks para o snapshot temporário. Servidores/processos/E2E precisam de permissão local de sockets fora do sandbox restrito; nenhum pedido foi rejeitado.

## Dependências e limites

Novas dependências diretas: [react-markdown](https://github.com/remarkjs/react-markdown) para parsing/rendering consolidado; [rehype-sanitize](https://github.com/rehypejs/rehype-sanitize) para sanear a árvore antes de plugins confiáveis; [rehype-highlight](https://github.com/rehypejs/rehype-highlight) para distinguir sintaxe da linguagem declarada. Sem rehype-raw/MDX/HTML executável. A sanitização precede o highlighter confiável, conforme documentação. URLs perigosas também são filtradas; E2E usa script, onerror, javascript: e data: como sentinelas inertes.

@backendlab/protocol e lucide-react foram retirados por falta de consumidor. TypeScript/@types/node foram declarados no backend, que realmente compila e usa Node; não são tecnologia nova do produto. A reinstalação resolveu versões compatíveis com ranges existentes (Nest 11.2.6, React 19.3.0, TS 5.9.3, Vite 7.3.6); PNPM 11.20.0 e Node 26.5.0 usados nesta máquina. Requisitos documentados: Node 24+ / PNPM 11.

Limites: refresh explícito, sem preview ao salvar; catálogo inteiro mostra erro se um manifesto quebra; manifesto 64 KiB/Markdown 256 KiB; HTML bruto e MDX não suportados; sem progresso editorial, auth/CMS/cloud ou editor inteligente. DTOs simples são espelhados junto aos consumidores, sem package compartilhado. Conteúdo/CLI são locais para o autor; checagens de symlink não são sandbox contra processo hostil substituindo arquivos simultaneamente. Lock/rename não é transação durável contra crash/queda de energia e não coordena edição manual de manifesto. Leitura não exige executar exercício; o bootstrap atual ainda inicializa o armazenamento do LearningModule.

O executor opcional continua restrito a código confiável local, com isolamento técnico de processos/estado e limites; não serve para código hostil/multiusuário. Linux é a plataforma efetivamente validada. Testes verdes não certificam compreensão nem avaliam semanticamente a redação do aluno.

## Gates

Gates A–J concluídos. Não há gate pendente; a ausência do Chromium padrão foi contornada pelo browser instalado e registrada, sem mascarar o comando que falhou.

| Gate | Evidência |
| --- | --- |
| A — integridade | Trabalho recente inventariado, snapshot e hashes preservados; transferência posterior ao principal explicitamente autorizada |
| B — demolição | Árvore ativa sem imports/scripts/contratos aposentados |
| C — monorepo | PNPM reconhece frontend/backend separados |
| D — build | lint/typecheck/build passam com dependências próprias |
| E — autoria | CLI/manual alteram Markdown+manifesto; nenhum React/Nest |
| F — leitura | Markdown, TypeScript e referências observados no navegador |
| G — navegação | Ordem do manifesto, anterior/próxima/retorno e mobile verificados |
| H — configurações | Raiz do monorepo; configs específicas por aplicação; nenhum package vazio |
| I — documentação | README/AGENTS/autoria/overview refletem o código; história separada |
| J — escopo | Sem analyzer, Monaco, CMS, auth, social ou gamificação |

## Revisão final — 25 respostas

1. **Arquitetura:** monólito modular Nest e frontend React/Vite independentes, com conteúdo versionado em arquivos. LearningActivity/Attempt sustentam somente exercícios opcionais.
2. **Monorepo PNPM:** sim; workspace apps/*, lockfile único e comandos raiz.
3. **Aplicações:** apps/frontend e apps/backend. Nenhuma terceira aplicação ou segundo bootstrap Nest.
4. **Separação:** frontend renderiza/navega e chama API; backend valida/lê conteúdo e persiste/executa aprendizagem. Nenhum import frontend de serviços backend.
5. **Raiz:** package.json coordena scripts/dependências de ferramentas; workspace/lock coordenam projetos; ESLint/tsconfig.base compartilham regras reais; .gitignore protege derivados/dados; README/AGENTS orientam uso/trabalho. Conteúdo/docs/scripts têm diretórios próprios.
6. **Configs:** configs API/web movidas para backend/frontend; tsconfig de testes generalizado; DOM transferido do base ao frontend; configs do protocolo e imports/scripts de build do package removidos; Vite/Playwright atualizados.
7. **Packages eliminados:** @backendlab/protocol e a árvore packages sem consumidor. Não foram criados core/shared ou substitutos universais.
8. **Histórico removido:** Workbench/System/Surface, laboratório/runner/runtime/workspace/repository, experimentos/investigações, protocolo, templates OrderDesk e testes/fixtures exclusivos, listados no inventário.
9. **Nomes substituídos:** backendlab → bunkercode; api/web → backend/frontend; pacotes @bunkercode; BUNKERCODE_API_URL; createApplication único.
10. **Referência ativa a BunkerLab/backendlab:** nenhuma em imports/endpoints/scripts do produto. Exceções intencionais: ignores de dados históricos e documentação/proveniência, sem consumidor runtime.
11. **Dados preservados:** todos os arquivos preexistentes de .bunkercode/.bunkerlab, incluindo SQLite, resultados e workspaces/checkpoints; não é necessário apagá-los ou migrá-los para consolidar código. .backendlab tinha somente dois placeholders versionados removidos, sem dados pessoais.
12. **Nova lição TypeScript:** pnpm lesson:new --course typescript --slug narrowing --title "Narrowing"; editar Markdown e recarregar. Também pode criar arquivo/entrada manualmente.
13. **Arquivos por lição:** dois: novo lessons/<slug>/lesson.md e alteração de course.json. Zero arquivos React/Nest.
14. **Conteúdo até frontend:** backend lê e valida manifesto/Markdown sob demanda; API JSON entrega título/texto e vizinhos; ReactMarkdown renderiza a resposta sanitizada.
15. **Manifesto:** id coincide com pasta; title/description e lessons ordenada com slug/title/activityId opcional. Paths são derivados; não existe outra lista de ordem.
16. **Atualização:** salvar e reload explícito. API/fetch no-store; sem rebuild/restart para Markdown/manifesto/curso novo.
17. **Blocos de código:** fence declara linguagem, highlighter aplica spans confiáveis; tema, monospace, padding e scroll interno mantêm legibilidade e contêm linhas longas no mobile.
18. **Sem analyzer/executor:** sim, a leitura não chama endpoints de aprendizagem nem inicia instrumentos. Analyzer não existe na aplicação; SQLite é inicializado pelo módulo opcional no bootstrap, sem criar Attempt.
19. **Exercícios anteriores:** mantidos/adaptados aos novos paths/shell por já estarem isolados e cobrirem interações reais; seus contratos/IDs/revisões/store permanecem.
20. **Testes excluídos:** na árvore inicial, 20 casos backend e 3 E2E; no HEAD mais recente da main, 24 backend e 4 E2E laboratory/investigation. Aposentadoria explícita da funcionalidade, não desativação de testes do MVP.
21. **Testes novos:** quatro de conteúdo, quatro CLI e dois E2E, cobrindo comportamento real; treze backend/três E2E recentes preservados.
22. **Dependências novas:** renderer, sanitizer e highlighter consolidados; permitem leitura segura e exemplos legíveis sem DSL/MDX. Dependências aposentadas removidas; versões/final install descritos acima.
23. **Limitações:** refresh manual, conteúdo local/limites de tamanho, sem conteúdo HTML/MDX, manifesto inválido bloqueia catálogo, lock não durável e executor confiável/Linux; sem CMS/progresso/editor inteligente.
24. **Uso hoje:** criar cursos/lições, escrever entendimento próprio, ler/revisar código/referências, navegar/editar/recarregar sem tocar UI/controller e praticar opcionalmente nos dois exercícios. Commit é manual.
25. **Próxima melhoria de valor:** escrever uma lição real de TypeScript sobre uma dificuldade recente e usar o fluxo diariamente. Depois, priorizar problemas de autoria/leitura observados; editor inteligente pode ser uma rodada própria para prática.

## Review e Git

Review sugerido: conferir demolição e nomes/configs, leitura/path/sanitização, ordem/refresh/autoria de dois arquivos, e preservação das fronteiras Submission/Execution dos exercícios. Revisar manualmente o texto demonstrativo e substituí-lo pelo entendimento do autor. Manifesto da lição union-types referencia reserve-stock como prática relacionada, sem afirmar que testa domínio de unions.

A implementação começou em um checkout detached. Por pedido explícito posterior, o estado final foi transferido a `/home/henrique/Projetos/BunkerCode`, branch main, preservando o HEAD `2d285bd0ed23489c534efb85afc660115117ca87`. Nenhuma alteração foi staged/commitada. Nenhum commit/push/rebase/reset/clean foi executado. A diferença Git inclui remoções nos paths antigos e arquivos novos ainda untracked; revisar ambos antes de stage. Próximo comando de uso: pnpm dev. Mensagem única sugerida: `feat: rebuild BunkerCode around authored learning content`.

## Transferência ao checkout principal

Preferência do autor salva em `~/.codex/AGENTS.md` e no AGENTS do projeto: editar diretamente o principal, sem branch/worktree por padrão; isolar somente por pedido explícito ou risco concreto, como produção. A partir desta transferência, comandos e alterações devem usar o principal.

Antes da transferência, o principal estava limpo. Comparação de três estados (base 46633e1, main 2d285bd e arquivos finais do worktree) identificou 12 diferenças modify/delete, todas em subsistemas deliberadamente aposentados: investigações, laboratório, workspace, respectivas páginas/componentes/CSS/testes e protocolo. Resolução: manter a retirada autorizada, sem reintroduzir compatibilidade. As versões da main permanecem no histórico e em `/tmp/bunkercode-transfer-main-2026-10-08/main-source-before.tar.gz`. Nenhum merge/cherry-pick ou commit temporário foi necessário; não há entradas unmerged no índice.

Foram transferidos os 75 arquivos de fonte/conteúdo/documentação atuais e aplicadas 67 remoções de paths antigos. `.bunkercode` foi copiado integralmente para o principal, que não tinha esse diretório; a origem foi mantida como segurança. Dados `.bunkerlab` do principal foram preservados. Dependências/builds antigos foram guardados no backup temporário, sem apagar dados pessoais; dependências novas instaladas localmente a partir do lockfile congelado. Worktrees existentes não foram removidos e não são o destino das próximas edições.

Validação no principal concluída: pnpm install --frozen-lockfile --store-dir node_modules/.pnpm-store --ignore-scripts, pnpm lint, pnpm typecheck, pnpm test (17 backend + 4 autoria), pnpm build e BROWSER_PATH=/opt/brave.com/brave/brave pnpm test:browser (5 passaram em 49,1 s). Zero skips/cancelamentos/retries. Permanecem os warnings de chunk Vite e NO_COLOR/FORCE_COLOR já descritos. Nenhuma falha nova de código ou ambiente nesta transferência.

Conferência de integridade: os 885 arquivos de dados legados preexistentes na main continuam idênticos; as únicas remoções em .backendlab foram os dois placeholders versionados. Os 102 arquivos de .bunkercode foram copiados byte a byte antes da validação; os testes acrescentam seus próprios dados/artifacts descartáveis. Arquivos de fonte transferidos são idênticos à origem, exceto este relatório atualizado. HEAD/main não mudou, nenhuma entrada staged/unmerged, git diff --check e verificação de whitespace nos arquivos novos passaram. Próximas alterações usam o principal. Backup e worktrees foram mantidos, sem commit/push.

