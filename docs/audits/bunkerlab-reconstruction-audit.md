# Auditoria de reconstrução do BunkerLab

Data: 2026-10-07. Base auditada: `46633e1a6b542b61a35e85a9b20e343cf2aa9866`, checkout detached em `/home/henrique/.codex/worktrees/ce17/BunkerCode`. Escopo autorizado: leitura, validação e **um único relatório**. Nenhum reparo, migração, integração, demolição ou commit autorizado.

A nova tese de aprendizado substitui, nesta auditoria, a regra histórica “laboratório, não curso”. Learn/Practice/Lab/Build/Analyze não são módulos aprovados. Capacidade, implementação, representação e produto são avaliados separadamente. KEEP é excepcional; REMOVE LATER significa sair do produto ativo futuramente, não apagar agora nem perder conhecimento preservado no Git.

## Registro de continuidade

Concluído. Todas as unidades solicitadas foram auditadas e estão registradas abaixo. Há recomendações e Unknowns, sem implementação autorizada. Validação: lint/typecheck/build e 21 testes API aprovados; E2E completo teve 2 passes/1 falha, e a repetição isolada dessa falha passou; prova de mutação tardia de Reset confirmou um bug não corrigido.

## 1. Executive summary

**Não escolheria o BunkerLab inteiro como base arquitetural. Escolheria reconstruir um ciclo pequeno de execução identificável, operação real, evidência inspecionável e comparação controlada.** O acervo demonstra esse ciclo num único sistema Node/SQLite, com falhas reais e versões de código distintas. Não demonstra executor geral Nest/PostgreSQL nem plataforma de aprendizado.

O menor núcleo forte é: (1) execução separada do control plane com diagnóstico e encerramento; (2) identidade do código executado, distinta do código editado; (3) requests/respostas/estado e eventos correlacionados; (4) setup e avaliação específicos da atividade; (5) comparação de evidência sob condições explícitas. Mesmo aqui, predominam **REFACTOR de responsabilidades**, não KEEP de classes. SQLite local, transações pequenas de migrations, formato simples de assertion e partes do buffer efêmero têm candidatos KEEP, com limites abaixo.

Workbench universal, Surface obrigatória, navegação por sistemas, Git/checkpoints em toda prática, upgrades históricos e o mega-contrato não passam o gate de necessidade para o primeiro fluxo curto. Funcionam e têm testes; isso não lhes dá direito de sobrevivência. OrderDesk vale como fixture e possível atividade de concorrência, sem ser o domínio central.

A capacidade estática do legado permanece preservada, inclusive PNPM, estrutura, Prisma e invocations sem consumidor imediato. Não há integração aprovada. A experiência de prever impacto e confrontá-lo com uma request real é viável como hipótese, mas **é mais simples começar sem integrar os dois**. Escolher uma atividade antes de novas fronteiras/packages.

## 2. Repository map

Inventário da base: 76 arquivos versionados; um workspace PNPM, três packages executáveis/compiláveis e raiz privada chamada backendlab. Nomes BunkerCode/BunkerLab/backendlab coexistem historicamente; não renomeados. Este relatório avalia exclusivamente o checkout indicado no cabeçalho. A árvore principal do mesmo Git possui edições locais adicionais: não são parte desta base, não foram copiadas nem auditadas como se fossem o HEAD.

| Área | Responsabilidade / dependências |
|---|---|
| `apps/api/src/main.ts`, `app.module.ts`, `laboratory.controller.ts` | Bootstrap Nest/Express, rotas locais, um service injetado. Loopback 3001; mutações exigem JSON + header local no bootstrap |
| `laboratory.service.ts` (473 linhas) | Lifecycle/lock, provisionamento, exclusividade, runtime, workspace, runs, Activities, Surface, apresentação e investigação |
| `runtime.ts` (273), `workspace.ts` (320), `runner.ts` (174), `repository.ts` (250), `activities.ts` (64) | Infra concreta de processo, código, workload e retenção |
| `experiments/{definition,overselling}.ts`, `catalog.ts` | Um experimento e um sistema; avaliadores de domínio |
| `investigations/{definition,index,orderdesk}.ts` | Registry pequeno e interpretação específica de evidências |
| `paths.ts`, `migrate.ts`, `migrations/*.sql` | Raiz por PNPM, diretório de dados, preparação de metadata |
| `packages/protocol/src/{index,orderdesk}.ts` | 179 linhas de tipos: transporte, execução, UI, conteúdo e domínio |
| `apps/web/src` | React/Router, cliente HTTP, seis páginas, seis componentes, CSS (1.400 linhas); superfície HTML fica no sistema |
| `templates/orderdesk` | server/inventory/order-store/database/surface/README; Node nativo, worker e SQLite, sem pacote Nest ou dependências npm |
| `apps/api/test`, `apps/web/e2e` | Integração de comportamento e browser; fixtures atuais/canônicas antigas |
| `docs/architecture`, `docs/curriculum`, README/AGENTS | Decisões e tese antigas; classificação na seção 13 |
| Manifests, lockfile, `pnpm-workspace.yaml`, tsconfigs, `eslint.config.mjs`, Vite/Playwright configs | Ferramentas de desenvolvimento; manter rigor, não topologia por inércia |
| `.gitignore`, `.backendlab/{state,workspaces}/.gitkeep` | Dados gerados ignorados; placeholders antigos fora do caminho `.bunkerlab` atual |

Dependências: API → protocol (tipos), Nest/reflect-metadata/rxjs; web → protocol (tipos), React/Router/lucide; protocol sem dependência runtime. Templates → Node nativo. O banco do produto não é o banco estudado. Não há analyzer ativo, filas, containers, editor web, terminal web, aprendizagem avaliada, autenticação ou deploy de produção neste repositório. Build da API não empacota templates/migrations; `projectRoot()` depende de layout fonte.

### LaboratoryService: application service grande, não arquitetura inevitável

Pelo menos dez responsabilidades coexistem: lock de processo, provisionamento/upgrades, teardown de tasks, resolução de escopo, exclusividade, leitura de Workbench, execução/reset/restart, workspace/checkpoint/restore, launch/histórico/presentação de Runs, Surface/Activities/Investigations. Os managers já concentram mecanismos; o service concentra orquestração e apresentação demais. Chamá-lo só de god object ocultaria que parte é coordenação legítima de um único sistema.

`exclusive` (`:120`) marca busy antes do primeiro await; `launch` (`:385`) transfere o lock para a Run antes do 202 e registra task assíncrona. Rejeita conflito com 409, sem fila implícita. Shutdown para runtimes, espera tasks e para novamente para cobrir restart em preparação. Lock `control.lock` usa criação exclusiva + PID; stale lock só é removido após ESRCH. Não há lease, proteção contra reutilização de PID ou eleição distribuída; arquivo de lock + SQLite não garantem exclusão por múltiplos hosts.

Classificação: REFACTOR coordenação/lifecycle/exclusividade; KEEP somente a ideia simples de recusa imediata (implementação acoplada não ganha KEEP inteiro); RETHINK provisioning global e PID lock conforme destino; REMOVE LATER montagem obrigatória de Workbench e branches de upgrades. **Não dividir agora em muitos services**: primeiro retirar responsabilidades da tese abandonada; separar só fronteiras ainda necessárias no primeiro fluxo. CQRS, event bus ou microservices não resolvem esse problema.

## 3. Runtime architecture

Fluxo observado (`runtime.ts:60–163`): snapshot → `fork(<snapshot>/server.mjs)` → cwd no snapshot → Node filho → HTTP loopback em porta efêmera escolhida pelo servidor → mensagem IPC `{kind:'ready',port}` → runtime ready. Um manager controla um processo principal/porta por workspace/system; OrderDesk cria um worker interno. `execArgv: []` evita herdar loaders/debug; environment reduzido a PATH, RUNTIME_DATABASE e RUNTIME_TOKEN. Não transmite configuração de instalação/build/serviços externos.

Dados do sistema ficam em `runtime/<workspace>/<system>/state.sqlite`, fora do snapshot. Reiniciar troca processo/código e preserva banco. Não existe reexecução idêntica completa por preservar código apenas: runtime, configuração, escalonamento e infraestrutura também importam. Snapshot é cópia consistente verificada, **não immutable filesystem**; código confiável pode alterá-lo depois ou acessar disco/rede como o usuário.

| Responsabilidade | Fato / classificação / consequência |
|---|---|
| Lifecycle (`:60`, `:241`) | REFACTOR. start para anterior; erros viram crashed; stop SIGTERM→SIGKILL em 1 s e mata grupo Unix, inclusive descendentes do grupo. Windows usa child.kill. Preservar comportamento com teste, não promessa de sandbox |
| Readiness (`:119`) | REFACTOR. Timeout 5 s, ready IPC valida porta numérica; não faz healthcheck e não prova prontidão do worker/database. Protocolo cooperativo da fixture |
| stdout/stderr (`:49–85`) | REFACTOR. Mesma string sem distinguir stream; 40 blocos de até 4.000 caracteres e redação do token do runtime. Não é log durável completo nem redação geral de secrets |
| HTTP bridge (`:165`) | REFACTOR. URL loopback/porta, bearer e run/request IDs, timeout 3 s combinado com sinal externo, corpo até 1 MiB. Método inferido pelo body; JSON esperado salvo Surface text. Falha de parse é erro de transporte no chamador |
| IPC evidence (`:86`) | REFACTOR. Aceita kind/type/timestamp, preserva sequence do emissor em payload.systemSequence. Sem schema por evento, revisão de instrumentação ou cota de bytes por evento de Run |
| Flush (`:217`) | REFACTOR. Identificador/ack com 1 s de espera; confirma mensagens anteriores do emissor cooperativo, não drena causalmente qualquer job/banco/background task |
| Estado/logs em memória | RETHINK. Um sink de Run + um de Activity, sem multiplexação geral; eventos sem runId podem entrar na Run ativa. Serve exclusividade atual |
| server.mjs/state.sqlite/uma porta | REMOVE LATER como obrigação geral; manter local à fixture até substituição. Nada prova adequação para Nest/PostgreSQL |
| Isolamento de falhas | REFACTOR. Processo preserva event loop do host contra loop síncrono do filho; sem quotas/segurança contra código hostil. Worker do OrderDesk é outra fronteira, não processo independente com DB remoto |

**Decisão futura: reduzir a fronteira; substituir o adaptador de lançamento quando o primeiro sistema exigir.** Para uma atividade HTTP Nest concreta, a menor fronteira provavelmente precisa de comando/cwd/env explícitos, readiness adequada àquele app, URL acessível, operação e encerramento. Essa é descrição da necessidade, não schema/DSL aprovado. Dependência PostgreSQL pertence ao sistema estudado; não exige plataforma universal de containers nem generalização de todos os hooks hoje.

## 4. Workspace architecture

`WorkspaceManager.ensure` (`workspace.ts:62`) copia template em pasta descartável, cria .gitignore, init main e baseline. Git é obrigatório até para `version()`, usado no polling. O wrapper (`:27`) exige `.git` diretório independente, recusa symlink/commondir, usa git-dir/work-tree explícitos, hooks desativados, configurações globais/sistema neutralizadas, timeout 10 s e buffer 1 MiB. Isso evita descobrir o Git pai nas operações gerenciadas; não confinar toda edição/código arbitrário.

`files/digest` (`:173–204`) ordenam nomes e conteúdo separados por NUL, SHA-256, limite acumulado 5 MiB. Ignoram .git/node_modules/.env* e qualquer nome com `.sqlite`; rejeitam symlinks restantes. Digest não inclui permissions, ambiente, build toolchain, versão Node, dependências externas ou estado do banco. Diretórios vazios não aparecem.

`snapshot` (`:221`) lê versão antes, copia árvore e confere versão depois + digest da cópia. É um cuidado concreto contra salvamento concorrente, sem snapshot atômico do filesystem. Falha deixa diretório parcial; não há GC/deduplicação nem read-only. `workingCode.dirty` compara com Git; diferença entre digest salvo/carregado indica Apply requerido — fazer checkpoint não aplica código.

`checkpoint` (`:241`) rejeita código ignorado, mede digest, git add/commit e verifica clean/digest, só então salva metadata. Git e SQLite podem divergir se falhar depois do commit. Código que passou a rastrear artefatos sensíveis/excluídos e configs Git locais não são cenário adversarial coberto. `restore` (`:295`) cria backup completo incluindo novos arquivos, usa git restore e cria novo checkpoint; preserva histórico e banco, para runtime no service. Não há atomicidade contra editor simultâneo nem restore de banco.

| Responsabilidade | Classificação / decisão |
|---|---|
| Cópia descartável / proteção de canônico | REFACTOR: vale para escrever/modificar; uma atividade só de leitura pode dispensar workspace |
| Digest / versão efetivamente executada | REFACTOR: preservar proveniência; retirar Git obrigatório se snapshot simples basta |
| Frozen snapshot e divergência/Apply | REFACTOR: propriedade útil em comparação; não chamar cópia de imutável nem exigir Apply para script de uma execução |
| Git independente / proteção do parent | REFACTOR **condicional a manter Git**; conhecimento/teste preservados mesmo fora da base ativa |
| Checkpoints/restore/backups | RETHINK: plausível em Build/Lab prolongado; para prática curta cópia/reset de fixture custa menos. Git local não precisa ser obrigatório para todo código do aluno |
| `upgradeSurface` (`:95`), `upgradeGuidance` (`:129`) | REMOVE LATER do gerenciador central: hashes de server/inventory/database/README, markers em .git e compatibilidade histórica; preservar código/testes como referência de não sobrescrever edições |
| Limites/exclusões/sem instalação npm | RETHINK conforme atividade. Não generalizar o filtro SQLite nem capturar projeto Nest inteiro sem definir build/deps |

Restore compensa custo somente se o usuário precisa preservar múltiplas linhas de investigação longa. Ainda não há evidência de frequência para a nova tese. Preservar código excelente e fazê-lo requisito são decisões distintas.

## 5. Runner architecture

`ExperimentRunner.execute`: setup HTTP → validar estado inicial → persistir → pool de promises por clients/concurrency → requests HTTP e evidence incremental → ler estado final → flush IPC → assert da definição → observations → status/teardown e persistir. O pool é concorrência assíncrona no pai, não worker_threads. O worker de DB pertence ao filho.

UUID correlaciona request/response/eventos. Request duration usa performance.now (monotônico); Run duration usa Date.now (relógio civil). `request.dispatched` guarda requestId **no payload**, `request.completed` e eventos do sistema no campo próprio; Inspector conhece as duas formas. A sequência da Run é incrementada pelo coletor, independente de timestamp. Evento sem runId é aceito; evento de outra runId é ignorado. Limite 10.000 vale para eventos observados do runtime, não todos os eventos/fases; truncamento é explícito, mas falta cota de payload de Run.

Timeout nominal 15 s (`runner.ts:14`) aborta workload; setup/final usam seus 3 s individuais sem sinal global e assert é síncrono. Portanto não é prazo máximo rígido de execute nem preempção de evaluator travado. Erro/timeout de request gera status null; todos os workers assentam antes de avaliar. Erro de transporte para processo para impedir escrita tardia. HTTP não-201/409 é contado como erro pela definição. Falha de propriedade é `failed`; erro de execução é `error`; recovery produz `interrupted`.

A persistência inicial ocorre **antes de iniciar runtime**, no service, mas observe() só é ligado depois de start; erro de sintaxe pode virar Run error sem ter todos os logs/startup events persistidos como Evidence. Logs permanecem no status do runtime e mensagem de erro. Não confundir “Run existe” com “toda evidência de startup foi capturada”.

`ExperimentDefinition` (não existe tipo `TestDefinition` nesta base) delega validateState/validateInitial/assert/observations. Boa separação do conhecimento de estoque. Entretanto clients/concurrency, HTTP setup/operação com body, estado inicial/final e accepted/rejected continuam obrigatórios. **REFACTOR a ideia de sequência técnica, RETHINK executor universal.** Uma função síncrona, exercício de sintaxe ou previsão sem execução não precisa dessa Run.

Assertions pertencem ao critério da atividade; runner apenas executa e registra. Observations são projeções explicativas de resultado, não responsabilidade do executor de processo. Snapshot de resultado e evidência não devem se confundir com hints. `present()` calcula observations faltantes de Runs históricas usando definição atual; investigação também é recalculada na leitura. Histórico factual permanece, interpretação pode mudar sem versão do avaliador.

**Run ≠ LearningAttempt.** Run é uma execução técnica de experimento, com config/código/dados/resultados; não é sessão de runtime (um runtime serve várias Runs) nem resposta do estudante. Uma tentativa futura pode conter previsão, texto/código, várias Runs, ajuda consultada e revisão da hipótese; pode também não executar nada. Não implementar LearningAttempt agora nem equiparar passed a compreensão.

## 6. Repository/persistence

`LabRepository` usa `node:sqlite` DatabaseSync; `lab.sqlite` com WAL, foreign_keys e busy_timeout 5 s. Migrations SQL ordenadas por nome rodam com BEGIN IMMEDIATE/COMMIT/ROLLBACK e tabela migrations. `001` cria workspaces/systems/experiments/checkpoints/runs/evidence/requests e índices; `002` introduz kind com backfill por mensagens históricas. Sem checksum de migration, versionamento/validação de JSON salvo ou downgrade.

Repository importa catálogo e faz seed local; systems INSERT OR IGNORE pode conservar nome antigo; experiments INSERT OR REPLACE guarda summary atual. Run não versiona implementação do evaluator. Code/config/states/results/payloads são JSON; metadados relacionais delimitam escopo. Consultas detalhadas filtram workspace/system/id. Runs paginam por number em lotes de 100; evidence completa e checkpoints não têm paginação/retention. Run.number é sequência global do banco.

Requests/evidence persistem incrementalmente; initialState é salvo após setup, final/result/status no fechamento. Não há transação única de execução inteira (e nem seria desejável prender banco durante HTTP). Erro de coleta é guardado para falhar execução após flush; falhas de disco durante emissão de fases/finalização podem ainda interromper cleanup normal. Recovery (`:53`) marca running→interrupted, preserva linhas já gravadas e não reexecuta; não recupera processo externo, snapshot parcial, commit sem metadata ou estado intermediário do sistema. Duração de interrupted não é recalculada; mapper converte duration_ms null em Number(null)=0 quando completed_at existe — limite de fidelidade, não tempo medido.

Classificação: **KEEP candidato** SQLite local e transações pequenas de migrations, se houver histórico útil; **REFACTOR** repository/schema/ownership/versionamento e recovery explícito; **RETHINK** persistir toda execução; **REMOVE LATER** seeds/migration de nomes de OrderDesk como requisito do núcleo novo. Não migrar metadata a PostgreSQL por simetria com a stack estudada. SQLite é solução simples adequada ao volume local observado; não há validação para multiusuário/carga intensa. Escrita síncrona por evento aumenta overhead, não benchmark sem instrumentação.

## 7. Activities

`ActivityBuffer` (`activities.ts`) é histórico efêmero de requests humanas via Surface: method/path/body/status/response/error/código/eventos. Guarda 50 interações por sistema, até 200 eventos por interação e substitui payload JSON acima de 8192 caracteres (não bytes) por truncated. List omite bodies/evidence. Reiniciar API perde buffer; restart do sistema mantém. Não cria Run/tabelas SQLite. Resposta HTTP tem teto de 1 MiB no manager.

Service valida operação pela allowlist e body até 4096 caracteres, serializa interação, atribui requestId=activity.id, captura duração/flush e para runtime após falha de transporte. HTTP 500 continua resposta inspecionável. Filtra runId e requestId divergente, mas eventos sem requestId são atribuídos à interação ativa: correlação explícita parcial, não prova causal de todo log. Há somente uma active por buffer, suficiente com exclusividade atual.

KEEP candidato ao buffer pequeno **se preservar exploração manual HTTP**; REFACTOR integração e nome; RETHINK necessidade de histórico manual num exercício curto sem Surface. **Colisão terminológica real:** Activity atual é observação técnica transitória, LearningActivity futura seria proposta de aprendizado e seus critérios. Não renomear agora. A existência de Activities já demonstra que execução observável não exige persistir toda Run.

## 8. Investigations

`investigations/definition.ts` tem 8 linhas e o registry 17: uma função `inspect(RunDetail)` filtrada por system/experiment. É uma extensão pequena, não um motor pedagógico demonstradamente genérico. `orderdesk.ts` escolhe leituras do mesmo estoque por requests distintas e escritas posteriores na **sequência coletada**, com fallback explícito quando falta o par. Availability deriva de estoque negativo observado; nenhuma verificação de compreensão, resposta, previsão ou domínio conceitual do aluno existe.

As quatro pistas são **conteúdo hardcoded**, inclusive nomes de arquivos/símbolos e direção de implementação SQL. Fatos e seleção vêm da Run; pistas não são inferidas do código atual. Contexto e contador de revelação vivem em localStorage por workspace/system no Workbench; comparam baseline e Runs posteriores usando a configuração da baseline. A progressão é divulgação da interface, não avaliação pedagógica. REFACTOR seleção rastreável/divulgação progressiva; RETHINK contexto/framework universal; REMOVE LATER conteúdo OrderDesk como orientação global (preservável na atividade específica).

## 9. Protocol audit

`SystemState = unknown` reduz dependência nominal de estoque, mas não demonstra generalidade. Não há parâmetros de tipo ligando estado/config/resultado de uma definição; casts repetem validação e `ExperimentResult` permite qualquer measurement. O pacote contém código apenas de tipos, mas sua conveniência junta propriedade de domínios distintos.

| Grupo (`packages/protocol/src/index.ts`) | Produz → consome | Ownership real / destino |
|---|---|---|
| SystemSummary (120), SurfaceDefinition (146) | catálogo → service, UI/bridge | Catálogo + apresentação; separar da obrigação de surface; RETHINK |
| RuntimeStatus (126) | RuntimeManager → service/UI | Lifecycle de execução; REFACTOR, porta/PID/logs não definem todo executor |
| CodeVersion (29), Checkpoint (35) | workspace/repository → Run/runtime/UI | Proveniência versus Git/histórico; REFACTOR identidade de código, RETHINK Git obrigatório |
| Workbench (134) | service → shell e páginas | DTO da tela antiga, não domínio central; REMOVE LATER |
| ExperimentConfig/Summary (3/15) | definição + input UI → service/runner | Workload numérico e schema de formulário misturados; REFACTOR por caso |
| RequestResult (52) | runner → repository/definição/Inspector | Observação HTTP; REFACTOR, falta método/path no registro direto (estão em evento separado) |
| Evidence (44) | runner/runtime → repository/buffer/definição/UI | Registro dinâmico coletado; REFACTOR, não usar como envelope estático universal |
| Assertion (60) | definição → runner/Inspector | Comparação expected/actual; KEEP candidato para avaliação técnica simples, não nota do aluno |
| ExperimentResult (66) | definição → runner/repository/UI | accepted/rejected/errors obrigatórios vazam workload; REFACTOR |
| Observation (8) | definição → service/UI | Dado medido + label/note de apresentação; REFACTOR, propriedade da atividade e sua apresentação |
| Run (74), RunDetail (92) | service/runner/repository → UI/investigation | Execução técnica persistida + view derivada; REFACTOR; nenhuma LearningAttempt implementada |
| InvestigationView (99) | inspect → drawer | Conteúdo pedagógico e projeção de Run; RETHINK como contrato universal |
| InvestigationContext (113) | React/localStorage → React | Estado exclusivo de UI, apesar de exportado pelo protocolo compartilhado; REMOVE LATER como contrato central |
| Activity/Summary (151/166) | buffer/service → UI | Request manual efêmera; REFACTOR capacidade, evitar colisão com LearningActivity |
| OrderDeskState (`orderdesk.ts`, reexport linha 1) | sistema conceitualmente; validador/casts API → investigação/testes | Pertence à fixture/atividade OrderDesk; REMOVE LATER do protocolo central, preservar contrato local |

## 10. UI audit

A hipótese de reescrita majoritária é sustentada pelos consumidores: navegação, estado e métricas estão organizados em torno de sistema sempre ativo e uma ferramenta de concorrência. Não há UI de previsão, resposta, prática curta, avaliação de compreensão ou autoria de atividade.

| Área / arquivos em `apps/web/src` | Conceito útil | Classificação da implementação atual |
|---|---|---|
| `App.tsx`, `main.tsx`, `api.ts` | Navegação e execução explícita | REMOVE LATER shell/rotas; REFACTOR pequeno cliente quando necessário. API usa selectedSystem global, local fixo e default orderdesk |
| `pages/WorkbenchPage.tsx` | Mostrar código salvo versus carregado, preservar acesso após crash | REMOVE LATER página universal e seu estado agregado; REFACTOR conceito de divergência |
| `components/SystemSurface.tsx` | Separar UI estudada do host, validar bridge | RETHINK requisito Surface; REMOVE LATER implementação se nenhuma atividade exigir app embutido |
| `components/TestTool.tsx` | Disparar operação e revelar observações | REMOVE LATER formulário atual: experiments[0], “Concorrência”, clients/concurrency 1–100 |
| `components/ActivityInspector.tsx` | Inspeção de request/resposta/eventos | REFACTOR conceito; não transplantar drawer/componente por conveniência |
| `pages/Inspector.tsx` | Evidência filtrável, estado inicial/final, versão | REFACTOR experiência específica; REMOVE LATER layout/contadores fixos accepted/rejected |
| `pages/RunsPage.tsx`, `components/shared.tsx` | Histórico paginado e seleção de pares | RETHINK histórico universal; REMOVE LATER tabelas/labels atuais |
| `pages/Compare.tsx` | Comparar condições antes de atribuir resultado ao código | REFACTOR conceito; tabela tem “Compradores”, métricas fixas, igualdade via JSON.stringify; não compara patch nem significância |
| `pages/Checkpoints.tsx` | Explicitar backup e escopo de restore | RETHINK necessidade; REMOVE LATER navegação própria como padrão |
| `components/Investigation.tsx` | Pistas opcionais e baseline real | REFACTOR disclosure/ligação à evidência; RETHINK contexto persistido e protocolo de etapas |
| `pages/SystemPage.tsx`, `components/Drawer.tsx`, `styles.css`, `index.html` | Catálogo, diálogo acessível, legibilidade | REMOVE LATER como estoque visual da tese antiga; dialog nativo pode ser refeito quando necessário |

Polling global (1,8 s) pede workbench + histórico e recalcula Git/digest; painéis de Run consultam a cada 0,5–0,6 s enquanto executando. Não há SSE atual. Não é alegação de gargalo medido, mas trabalho desnecessário para atividades sem workspace/runtime. Guards locais não equivalem a coordenação entre abas. Surface é HTML autocontido em iframe `allow-scripts`, sem same-origin, CSP e allowlist em host/API; não suporta aplicação web arbitrária, uploads/bundle ou recuperação de loop infinito de UI. Preservar testes de fronteira, não tornar bridge obrigatória.

## 11. OrderDesk leakage

Vazamentos/assumptions identificados, distinguindo domínio legítimo de falsa generalidade:

1. `catalog.ts:8–23`: único orderdesk, `/state`, reset stock=5, `/surface`, `/orders`, único overselling. Legítimo catálogo da fixture; indevido centro obrigatório do produto.
2. `laboratory.service.ts:75–80`: provisioning local de todos os sistemas e branch explícito `system.id === "orderdesk"` para upgradeGuidance; surface implica upgrade de server.mjs.
3. `runtime.ts:71–79`: entrada server.mjs e RUNTIME_DATABASE/state.sqlite; readiness/flush IPC Node e HTTP obrigatório. Um processo gerenciado pode ter worker/descendentes; “um processo” não significa ausência destes.
4. `runtime.ts:165–214`: GET/POST decidido pelo body, JSON por padrão, bearer/header específico; sem método explícito, status/body como único resultado.
5. `workspace.ts:95–172`: hashes, markers v1, inventory/database/order-store/README, server/surface e mensagens de upgrade. Migrations de sistema dentro do gerenciador genérico.
6. `workspace.ts:18,178–182`: filtro `.sqlite` em qualquer nome e `.env*`; adequado à fixture atual, não fronteira universal de fontes. Node_modules excluído e ausência de preparação de build/dependências inviabilizam transposição direta para Nest.
7. `protocol`: clients/concurrency, accepted/rejected e reexport OrderDeskState. `unknown` não desfaz as outras premissas.
8. `ExperimentDefinition` exige setup/operação HTTP com body, statePath e estado; runner exige número fixo de clientes/concorrência. Não é executor genérico de exercícios/syntax/tests.
9. `overselling.ts`: produto keyboard, quantity=1, stock.read/written, 201/409, conservação de estoque. **Domínio corretamente localizado**, não motivo para generalizar assertions para todos.
10. `investigations/orderdesk.ts`: disponibilidade por estoque negativo, seleção check-then-act, hints SQL, inventory/createOrder. Legítimo conteúdo da atividade; não framework validado por segundo caso.
11. `repository.ts:37–51`: seed acoplado a catálogo importado; `002-checkpoint-kind.sql`: nomes históricos como Base do OrderDesk classificam metadata. Histórico de migration não é domínio futuro.
12. `api.ts`/`App.tsx`: local/default orderdesk; `TestTool`: só primeiro experimento/concorrência; `Compare`: “Compradores”; `Inspector`/`shared`: aceitos/rejeitados. Surface afastou produto/estoque do React, não afastou semântica de workload.
13. `paths.ts`: descoberta de root pelo pnpm-workspace.yaml; distribuição assume layout do monorepo, inclusive SQL/templates no fonte.
14. Toda suíte real usa OrderDesk/local. Nenhum segundo executor, segundo sistema ou PostgreSQL valida as alegações de extensibilidade.
15. `templates/orderdesk/*` e fixtures de teste: estoque/pedidos são esperados e devem permanecer locais se a atividade sobreviver; não confundir especialização correta com vazamento.

## 12. Tests and fixtures

Inventário: dois arquivos de testes da API (17 casos de integração + 4 casos de upgrades), três casos Playwright em dois arquivos. Não há suíte unitária independente de runtime/runner/buffer nem coverage numérico; não chamar o estoque inteiro de unit tests. Integração monta AppModule e porta loopback; **não passa pelo bootstrap de `main.ts`**, portanto não testa o middleware do header local. Testes sequenciais compartilham estado/baseline e dependem da ordem; falha inicial pode contaminar casos seguintes.

| Fonte / comportamento | Destino do comportamento | Evidência e limite |
|---|---|---|
| `laboratory.integration.test.ts:83` Git independente/baseline | REFERENCE se Git sair; REFACTOR se Build exigir Git | Verifica HEAD local e código limpo; não exercita todas as recusas parent/symlink/commondir |
| `:96` overselling, IDs, sequência, concorrência real | REFACTOR fixture/harness | Até cinco tentativas reais; nondeterminismo não eliminado por sleeps |
| `:140` edição, digest, restart, checkpoint/comparação | REFACTOR comportamento | Mostra working digest diferente e carregamento explícito; não testa corrida durante a própria captura |
| `:172` reset e Runs consecutivas | REFACTOR | Estado reinicializado, IDs distintos e histórico inalterado |
| `:186` runs/reset/restart/checkpoint concorrentes | REFACTOR | 202 único e 409 concorrentes; lock por sistema, não fila |
| `:217` restore com backup de arquivo novo | REFERENCE/RETHINK requisito | Recupera notes.txt e código; título cita banco, mas este caso não mede explicitamente estado do banco após restore |
| `:243` config/scope inválidos | REFACTOR | Valores, campos desconhecidos, ids; não cobertura exaustiva de transporte |
| `:262` syntax error/crash | REFACTOR | Run error, runtime.exited, API viva e execução seguinte |
| `:286` restart API/cleanup/persistência | REFACTOR | Fecha API graciosamente, PID desaparece, histórico e dados do sistema sobrevivem |
| `:300` interrupted/repeatable migrations | REFACTOR | Insere running e abre repository; simula metadata interrompida, não mata control plane durante escrita |
| `:317` blocked event loop/timeout | REFACTOR | while(true) real no filho, API responde, runtime para e próxima run passa |
| `:342` surface/Activity sem Run, allowlist | REFACTOR observação; REFERENCE surface | HTTP e evidence reais; usos manuais não persistem Runs |
| `:391` manual versus automatizado | REFACTOR | 409 impede mutação manual durante Run |
| `:416` Activity HTTP 500 versus crash | REFACTOR | 500 mantém runtime; crash guarda saída/erro sem Run |
| `:468` buffer 50/expiração | KEEP candidato à capacidade efêmera | Reinício da API perde Activities e mantém Runs; não testa limite de 200/8192 |
| `:485` investigação baseada em baseline | REFACTOR ideia; REFERENCE fixture | Seleção aponta eventos/requests existentes, sem spoiler inicial; não mede compreensão |
| `:526` template sem solução/toggle | KEEP restrição de conteúdo | Corrigida fica na fixture de teste; não entregar solução automaticamente ao estudante |
| `workspace-upgrade.test.ts` (4 casos) | REFERENCE | Upgrade canônico, edição preservada, marker impede reaplicação após restore; implementação histórica REMOVE LATER |
| `e2e/investigation.spec.ts` | REFACTOR invariantes de experiência; REFERENCE seletores | Pistas progressivas, localStorage, aplicação real, mesmas condições, sem declarar correção universal, mobile |
| `e2e/laboratory.spec.ts` (2 casos) | REFACTOR fronteiras; REMOVE LATER expectativas estéticas | Uso real, inspector, comparação, reset, restore, crash, DOM isolado, mensagem forjada recusada; layout/labels não são novo produto |
| `fixtures/conditional-order-store.txt` | KEEP como referência específica de experimento | Escrita condicional + INSERT transacional real; não solução universal PostgreSQL |
| `fixtures/legacy-orderdesk-server.txt`, `legacy-guidance/{inventory.txt,database.txt,README.md}` | REFERENCE histórico | Preservam versões reconhecidas por hash; não levar ao caminho ativo sem obrigação de compatibilidade |

Lacunas confirmadas por leitura: segundo sistema/stack; reset lento e mutação tardia; recuperação de órfão após SIGKILL do pai; grupos de descendentes adversariais/Windows; falha de disco entre commit/metadata; truncamento IPC/payload de Run; timeout/readiness malformada; symlink/digest capturado sob edição concorrente; lock stale disputado; erro em flush; migration parcialmente aplicada; mutação de snapshot por backend; troca rápida de sistema com resposta obsoleta; multiabas; ausência de eventos; efetividade pedagógica. Não há teste marcando esses casos como skip: **não cobertos** é diferente de **skipped**.

## 13. Documentation audit

Todos os Markdown versionados existentes foram lidos; não há roadmap/ADR adicionais nesta base. A tabela separa conteúdo histórico de orientação normativa. Nenhum documento existente foi alterado.

| Documento | Classificação | Justificativa / ação futura |
|---|---|---|
| `README.md` | REWRITE | Fluxo system-first, surface/checkpoints no centro; reconstruir conforme outline abaixo, conservar comandos ainda válidos |
| `AGENTS.md` | REWRITE | “não curso”/restrição de plataforma revogada explicitamente pela tarefa; preservar inglês no código, evidência real, segurança, validação e review; não manter proibições de experiência por inércia |
| `docs/architecture/overview.md` | HISTORICAL | Retrato útil do control plane, três estados e decisões; texto naive/atomic descreve referência, mas não toggle atual. Não tratar host/runner como genericamente comprovados |
| `docs/architecture/local-laboratory.md` | KEEP + UPDATE | Limites honestos de processo, Git/SQLite, escala e instrumentação; revalidar contra runtime futuro; não impor migração interna PostgreSQL |
| `docs/architecture/system-surfaces.md` | HISTORICAL | Decisão system-first e contrato bridge ligados à UI antiga; manter lições de fronteira em referência |
| `docs/architecture/guided-investigations.md` | HISTORICAL | Evidência/pistas/apply são conhecimento; título “sem transformar ... em curso” não normativo; futura regra/invariante não aprovada |
| `docs/curriculum/core.md` | REWRITE | Nega currículo/metas/avaliação antecipada; tese agora admite formas de aprendizado pequenas |
| `templates/orderdesk/README.md` | KEEP + UPDATE (se fixture permanecer) | Instrução localizada de edição, worker e diferença código/banco; explicar que é laboratório histórico opcional |
| `apps/api/test/fixtures/legacy-guidance/README.md` | HISTORICAL | **Não editar como documentação viva**: bytes compõem hash de upgrade/teste; move-se junto da fixture apenas se futura decisão autorizar |
| Este relatório | KEEP + UPDATE | Decisões, proveniência, limites e estado de continuidade |

DELETE documental: nenhum arquivo inteiro precisa ser apagado nesta rodada. Candidatos futuros são instruções normativas antigas e documentação de compatibilidade de upgrades, depois de selecionar registro histórico; não apagar fixture cujo hash é comportamento ainda testado. HISTORICAL significa fora da autoridade sobre a arquitetura nova.

Outline futuro do README (não implementado): (1) aprender backend seriamente e compartilhar o caminho; (2) origem no BunkerLab e lição da execução real; (3) origem no BunkerCode visual/analyzer e abandono das representações; (4) mudança de tese; (5) plataforma de aprendizado em reconstrução; (6) stack TS/Node/Nest/PostgreSQL; (7) único fluxo demonstrável e comandos reais; (8) arsenal de análise preservado para experimentação, sem mapa/Explorer nem integração obrigatória. Distinguir infraestrutura estudada de metadata interna.

## 14. Demolition map

As tabelas anteriores detalham contratos/UI/testes/docs. Aqui a seleção é por responsabilidade; nenhum diretório inteiro ganha KEEP. “Uso” é consumidor concreto candidato, não feature aprovada. T=integração API, U=upgrade, B=browser; ausência de teste é declarada.

| Path / responsibility | Classification | Why | Concrete new-product use | Dependencies | Tests | Recommended action |
|---|---|---|---|---|---|---|
| `main.ts` loopback/header/teardown | REFACTOR | Fronteira local pequena, não auth de plataforma aberta | Rodar exercício confiável no computador do autor | Nest/Express | B usa bootstrap; T não valida middleware | Preservar intenção local, reavaliar só se modo de distribuição mudar |
| `laboratory.controller.ts`, `app.module.ts` rotas/wiring | RETHINK | Taxonomia inteira reproduz laboratório | Comandos necessários ao primeiro exercício | service/Nest | T HTTP | Reconstruir só endpoints necessários, não framework novo |
| `laboratory.service.ts` exclusividade/task ownership | REFACTOR | Impede contaminação entre operações; reset tem lacuna | Executar/comparar workload no mesmo sistema | runtime/workspace/repo | T conflitos/timeout + prova Reset | Manter invariantes, reduzir orquestração após escolher fluxo |
| Mesmo arquivo lock PID/provisioning todos os systems | RETHINK | Um local e um sistema, custo sem frequência comprovada | Sessão persistente opcional | fs/PID/catalog | T boot; stale concorrente ausente | Não promover a serviço multiusuário |
| Mesmo arquivo Workbench/present/surface/investigation aggregation | REMOVE LATER | Forma do produto antigo misturada a lifecycle | Sem consumidor universal aprovado | views/catalog/React | T/B | Tirar da arquitetura ativa; preservar interpretação específica separadamente |
| `runtime.ts` start/stop/crash/timeout | REFACTOR | Execução real é forte, contrato não universal | Rodar Node/Nest sob condições conhecidas | child_process/HTTP/IPC | T crash/loop/restart | Reduzir boundary e substituir adapter quando necessário |
| `runtime.ts` logs/evidence/flush | REFACTOR | Correlação útil, origem/limites incompletos | Investigar por que request falhou | emissores/coletores | T evidence/crash | Separar observado/declarado; não universalizar IPC |
| `runtime.ts` server.mjs/database/porta e método implícito | REMOVE LATER | Assumptions da fixture | Só OrderDesk | template | T/B só fixture | Localizar na fixture; não estender DSL |
| `workspace.ts` cópia, digest, snapshot | REFACTOR | Proveniência e edição separadas da execução | Alterar função e executar de novo | fs/crypto/Git hoje | T divergência; corrida não testada | Desvincular identidade de código de checkpoint obrigatório |
| `workspace.ts` Git independente | REFACTOR condicional | Proteção importante somente se houver Git | Investigação longa/Build | Git local | T baseline | Preservar comportamento e contraexemplos, ativar só quando usado |
| `workspace.ts` checkpoint/restore/backup | RETHINK | Complexidade multi-store sem demanda para prática curta | Voltar a duas versões úteis | Git/SQLite/runtime stop | T restore/U/B | Não default; snapshot simples pode bastar |
| `workspace.ts` upgradeGuidance/upgradeSurface | REMOVE LATER | Compatibilidade de uma história específica | Nenhum fluxo novo | hashes/markers/template | U quatro casos | Guardar referência/testes e retirar quando compatibilidade deixar de ser suportada |
| `runner.ts` setup→operação→observação | REFACTOR | Sequência valiosa para experimento, não todo exercício | Prever/responder/modificar request | definition/runtime/repo | T | Manter mecanismo mínimo pedido pela atividade |
| `runner.ts` workload clients/concurrency | REFACTOR condicional | Útil para concorrência; excesso para sintaxe | OrderDesk ou carga curta concreta | HTTP/pool async | T concorrência | Não forçar em Learn/Practice inteira |
| `experiments/definition.ts` evaluator/observations hooks | REFACTOR | Ownership de domínio correto, contrato vazado | Validação específica e feedback factual | protocolo | T só overselling | Separar resultado técnico de texto/feedback; sem framework preventivo |
| `repository.ts` SQLite local/WAL/prepared SQL | KEEP candidato | Simples, dois DBs separados, histórico funciona | Comparar execuções que precisa guardar | Node SQLite | T persistência | Pode permanecer; não é decisão de usar PostgreSQL internamente |
| `repository.ts` transaction + migration por arquivo | KEEP candidato | Mecanismo pequeno adequado ao uso local | Evoluir metadata selecionada | fs/SQL | T reabertura; rollback não injetado | Reter pequeno, não importar backfills antigos |
| `repository.ts` schema/mapping/recovery/seed | REFACTOR | Histórico útil; mistura catálogo, versões e representação | Recuperar execução interrompida | Run/checkpoints/catalog | T recovery | Não persistir tudo; separar lifecycle técnico de aprendizagem |
| `migrations/002-checkpoint-kind.sql` backfill nomes | REMOVE LATER | Compatibilidade histórica | Nenhum dado novo depende de heurística | schema antigo | U/T indiretos | Preservar somente para migração explicitamente suportada |
| `activities.ts` buffer limitado sem Run | KEEP candidato | Pequeno e útil para exploração sem histórico eterno | Inspecionar request manual | types/UUID | T buffer/erro; quotas parciais | Pode continuar com outro nome/fronteira quando houver consumidor |
| `laboratory.service.ts` Activity bridge | REFACTOR | Transporte e allowlist valem para caso real | Request manual observável | runtime/surface | T/B | Não exigir Surface para observar request |
| `investigations/orderdesk.ts` seleção rastreável | REFACTOR | Perguntas se apoiam em eventos existentes | Investigar concorrência | Run/estoque/event types | T/B | Manter curadoria localizada, limites claros |
| `investigations/definition.ts/index.ts` registry universal | RETHINK | Um exemplo só não prova framework | Possível segundo conteúdo | RunDetail | T só caso único | Função direta pode bastar |
| `protocol` Assertion expected/actual | KEEP candidato | Comparação mínima compreensível | Resultado de teste técnico | valores serializáveis | T avaliações | Não confundir com avaliação do aluno |
| `protocol` CodeVersion/Evidence/Run/Result | REFACTOR | Dados úteis com obrigações históricas | Proveniência/evidência de execução | producers/consumers seção 9 | T/B | Preservar semântica mínima, não pacote completo |
| `protocol` Workbench/Surface/InvestigationContext centrais | REMOVE LATER | Contratos da apresentação velha | Nenhum domínio novo aprovado | UI | B | Retirar da fronteira central quando UI for substituída |
| `templates/orderdesk` fenômeno real e fixture | REFACTOR conteúdo/harness | Caso forte de check-then-act, stack limitada | Atividade de concorrência | Node worker/SQLite | T/U/B | Manter opcional em exemplos/testes; não base de todo runtime |
| `apps/web` componentes/layout/estilos | REMOVE LATER | Navegação e estado centrados na bancada | Reimplementar apenas interação necessária | React/protocol | B | Zero transplante obrigatório de componente; preservar propriedades de UX |
| Config TS strict/noUncheckedIndexedAccess | KEEP candidato | Rigor técnico útil sem produto antigo | Contratos de atividade confiáveis | TS | typecheck/build | Rever moduleResolution por destino; não preservar manifests inteiros |
| Manifests/lockfile/scripts/Vite/Playwright/eslint | REFACTOR | Ferramentas úteis, dependências seguem recorte | Validar primeiro fluxo | toolchain | checks | Recriar grafo de deps quando seleção for aprovada, sem update agora |
| `.backendlab/*/.gitkeep` | REMOVE LATER | Placeholders de caminho anterior | Nenhum consumidor em paths atual | Git | sem teste | Deletar futuramente junto da estrutura obsoleta |

### Gates A–H nos KEEP/REFACTOR importantes

A=necessidade; B=frequência; C=menor solução; D=acoplamento histórico; E=pedagogia; F=observabilidade; G=stack; H=preservação sem ativação. Frequência é expectativa da atividade, não telemetria de uso comprovada.

| Peça | A / B | C / D | E / F | G / H |
|---|---|---|---|---|
| Processo + cleanup + exclusividade | Rodar alteração/crash; toda execução com servidor compartilhado | Script filho + fim pode bastar; controle global nasceu do OrderDesk | Investigar falha sem derrubar bancada; exit/HTTP são observáveis, reset precisa correção futura | Adaptador concreto Nest possível; não prova gestão PG; preservar testes fora da arquitetura ativa |
| Cópia/digest/código carregado | Comparar versão; toda reexecução após editar | Hash/cópia sem Git; 5 MiB/.sqlite são históricos | Saber qual código testou; digest de fontes não identifica ambiente inteiro | Nest exige build/deps específicos; preservar algoritmo e casos mesmo sem copiar manager |
| Git independente quando selecionado | Recuperar edições de sessão longa; eventual | Reset da fixture ou backup de pasta é menor; não precisa para Practice | Experimentar sem perder código; commit identifica árvore, não banco/causa | Independente de Node/DB, custo de Git não some; guardar como referência se não ativo |
| Request/evidence/estado/flush | Confrontar previsão com comportamento; frequente em HTTP | Uma operação e retorno podem bastar; IPC e /state pertencem ao OrderDesk | Filtrar fatos e inferências; ordem coletada não causalidade | HTTP Nest aplicável; evento SQL precisa instrumentação concreta; preservar princípio/fixtures |
| Runner/evaluator/observations | Repetir condições/avaliar propriedade; por exercício experimental | Função setup→run→check menor que motor universal; accepted/rejected histórico | Corrigir e explicar resultado; avaliação do sistema não compreensão | HTTP útil, workload PG não demonstrado; guardar receitas sem Run universal |
| SQLite metadata/migration/recovery | Guardar baseline/histórico; só quando comparar entre sessões | Memória/arquivo curto pode bastar; schema velho não obrigatório | Revisitar evidência; interrupted explicita ausência de conclusão | Produto local independe de PostgreSQL estudado; conhecimento SQL preservado |
| Buffer Activity limitado | Inspecionar uso manual; frequente se houver exploração | Última request basta no primeiro exercício; Surface não requisito | Ver request/resposta antes de concluir; logs sem ID são contexto | HTTP reaproveitável, buffers múltiplos não necessários; preservar capacidade caso adiada |
| Assertion simples | Mostrar esperado/observado; cada teste técnico | Objeto simples basta; sem accepted/rejected imposto | Feedback verificável, não nota de aprendizagem | Agnóstico à stack, depende de evaluator correto; manter técnica mesmo sem package |
| Investigação/disclosure | Pedir pista após tentar; frequência depende de usuário real | Conteúdo curado e poucos links bastam; estoque é específico | Pensar→inspecionar→pedir ajuda; selecionar só evento existente | Nest/PG exigem novas perguntas; preservar conteúdo como experimento, não framework |
| Comparação/inspector | Rever antes/depois; duas execuções úteis | Tabela mínima ou saída CLI, sem Workbench | Controlar condições, ler limites; não prova universalidade | Estado não precisa SQLite; guardar interação/testes, descartar React antigo |
| TS estrito/harness de testes | Evitar contratos inválidos; toda alteração | Config curta e testes de comportamento; topologia não essencial | Sustenta feedback correto; passar testes não mede aprendizado | Configs concretas TS/Nest; preservar casos e conhecimento fora do runtime ativo |

Nenhuma linha passa H autorizando destruição de conhecimento por ausência de consumidor. KEEP é hipótese de retenção técnica pequena, não decisão irrevogável de arquitetura.

## 15. Simplification opportunities

- Retirar Workbench como raiz permite atividade sem provisionar Git, iniciar servidor, buscar histórico e calcular digest periodicamente antes da primeira pergunta.
- Uma prática de função/import não precisa de DB experimental, readiness HTTP, flush IPC, catálogo de systems, /surface, checkpoints ou Run persistida. Um processo curto e resposta verificável podem bastar.
- Manter identidade de fonte não implica commit: hash + cópia de fixture evita grande parte do WorkspaceManager e schema de checkpoints em práticas descartáveis.
- Se não houver compatibilidade com workspaces históricos, 78 linhas de upgradeGuidance/Surface e seus fluxos auxiliares não têm consumidor novo; toda a implementação dos dois métodos ocupa linhas 95–172. Preservar referência de backup, não migrador central.
- Não persistir interação manual já é estratégia existente; estender a ideia de retenção seletiva custa menos que transformar toda execução em histórico curricular.
- Runner pequeno da primeira operação pode dispensar clients/concurrency, state endpoint obrigatório e observations universais. Uma definição especializada não precisa se chamar Experiment para sobreviver.
- Protocol pode perder DTOs de Workbench/localStorage/domínio sem perder request/evidence/assertion. Dividir em vários packages não é requisito; ownership explícito em poucos arquivos pode bastar.
- `LaboratoryService` pode diminuir eliminando produto antigo antes de fragmentar classes; separar por operação sobrevivente só se simplificar testes e lifecycle.
- Não repetir o passado visual: nenhum componente React é aprovado por existir; CSS/layout/shell podem sair juntos. Não há promessa de percentual de redução ou desempenho sem implementação/medição.

## 16. Preserved analyzer capability inventory

Fonte desta seção: relatório legado `/home/henrique/Projetos/bunker-code-legacy/docs/audits/bunkercode-legacy-demolition.md`, especialmente §§5–7, 9, 12 e 14, base `2810761948da038a0c2007cc6bde0e25b988a167`. **Não reauditei nem executei o legado nesta rodada**; fatos de implementação/bugs/testes do analyzer abaixo são atribuídos àquela auditoria. Não foi necessário ler seu fonte para estabelecer estas interseções.

NOW = utilidade imediata numa atividade candidata; LIKELY LATER = plausível conforme o estudo; EXPERIMENTAL = técnica com limites relevantes; UNKNOWN = consumidor ainda desconhecido. Estes níveis expressam utilidade/urgência relativa, **não autorização para integrar**. UNKNOWN nunca é candidato automático à exclusão. Ação comum: preservar fonte, testes, fixtures, limitações, SHA e conhecimento; integrar só após atividade concreta. Nenhum package inteiro recebe passe livre.

| Capability | Current usefulness | Possible pedagogical use | Integration urgency | Preservation recommendation |
|---|---|---|---|---|
| Carregar TS/tsconfig e sessão AST ts-morph | NOW para alvo TS real | Investigar configuração e sintaxe de um projeto curto | NOW somente se análise variável for escolhida | Preservar session/loading; política multi-tsconfig precisa revisão |
| Descobrir projeto/alvo explícito, erro de ambiguidade | LIKELY LATER | Selecionar corretamente projeto/exercício externo | LIKELY LATER; alvo curado dispensa descoberta | Guardar project-discovery e negativos de symlinks/ambiguidade |
| Imports estáticos com ocorrência localizada | NOW | Corrigir import ou justificar dependência | NOW condicionado ao puzzle | Preservar extração e localização; não declara require/import dinâmico suportados |
| Reexports/barrels/export declarations | NOW | Descobrir caminho indireto até símbolo/módulo | LIKELY LATER | Preservar ocorrências e fixtures; não precisar de Parts |
| Paths aliases/baseUrl/resolução TS | NOW | Resolver alias quebrado e explicar configuração | NOW se atividade escolhida | Guardar resolver/testes; compilador/runtime também precisam configuração coerente |
| Unresolved com motivo/localização | NOW | Distinguir caminho ausente de package externo | NOW se usado para feedback | Preservar motivo; bare não resolvido pode virar external/inferred, não prova validade |
| Contextos TS sobrepostos | EXPERIMENTAL | Mostrar como tsconfig altera interpretação | EXPERIMENTAL | Preservar contraexemplo: último contexto vence; não transformar em regra do aluno |
| Grafo e múltiplas ocorrências por relação | NOW | Sustentar “A depende de B” com vários imports | LIKELY LATER; consulta pequena basta | Reter relações/evidências, não nó visual/projeção |
| Dependências diretas | NOW | Identificar o que um arquivo usa | NOW por atividade | Preservar query e direção |
| Dependentes diretos | NOW | Prever quem pode ser afetado | NOW por atividade | Preservar query inversa, não sinônimo de chamada |
| SCC/Tarjan | NOW | Encontrar grupo circular e explicar arestas | LIKELY LATER | Preservar algoritmo/testes; distinguir componente de ciclo representante |
| Caminho de ciclo representante | NOW com limite | Escrever um ciclo concreto, sem exigir todos | LIKELY LATER | Guardar caminho/evidência; não usar representante como membership da SCC |
| BFS/dependentes transitivos/caminho mínimo | NOW | Prever alcance de alteração e um caminho justificável | LIKELY LATER | Preservar determinismo/deduplicação; alcance estático potencial |
| Relatório de impacto/circularity | EXPERIMENTAL até correção | Comparar previsão com dependentes/ciclo | EXPERIMENTAL | Preservar fonte/bug: a↔b↔c omite c no ciclo representante; não usar gabarito intacto |
| Índices/cache por grafo | LIKELY LATER | Consultas repetidas de autoria | UNKNOWN para primeiro exercício | Preservar técnica/limite: mutação pós-indexação deixa cache stale; não carregar automaticamente |
| Fan-in/fan-out | LIKELY LATER | Contar ocorrências versus arquivos distintos | LIKELY LATER | Preservar contagem factual; descartar thresholds como nota/qualidade |
| Arquivos isolados | UNKNOWN | Investigar por que ausência de imports não prova código morto | UNKNOWN | Preservar query simples/contraexemplo; não ligar warning universal |
| PNPM workspace discovery | LIKELY LATER | Explorar fronteiras app/library | LIKELY LATER | Preservar pnpm-workspace.ts, parsers, fixtures; produto não precisa depender de PNPM |
| Package membership por manifesto/config | LIKELY LATER | Explicar arquivo dentro/fora de package | LIKELY LATER | Guardar fatos/proveniência; mapa file→package pode substituir árvore antiga |
| Project structure/diretórios/normalização de paths | UNKNOWN | Inspecionar estrutura e rejeitar caminhos inconsistentes | UNKNOWN | Preservar capacidade/edge cases; árvores Units/Containments/SourceReports não obrigatórias |
| Package dependencies agregadas | LIKELY LATER | Comparar fronteiras reais de imports entre packages | LIKELY LATER | Preservar agregação/evidências; não equivale a dependencies do manifest |
| Identidade de imports/decorators Nest, aliases/namespace | NOW | Pedir evidência antes de classificar anotação | LIKELY LATER | Guardar nestjs-common e negativos; binding textual não é framework completo |
| Nest HTTP Controller + decorator de método | NOW | Localizar rota declarada e comparar com HTTP | LIKELY LATER | Preservar detector/regra/testes; não resolve URL efetiva/global prefix/registro |
| Nest UseGuards | LIKELY LATER | Prever intenção e depois testar request autorizada/negada | LIKELY LATER | Preservar sinal; não afirma guard eficaz nem execução |
| Nest Module/wiring annotation | LIKELY LATER | Identificar declaração e inspecionar providers manualmente | LIKELY LATER | Preservar detector; não existe grafo completo de DI |
| Prisma binding proof/operações enumeradas | LIKELY LATER se estudo adotar ORM | Distinguir chamada Prisma real de método homônimo | UNKNOWN; PostgreSQL não implica Prisma | Preservar detector/subclasse/negativos, sem instalar Prisma no produto |
| Invocation relations estáticas | EXPERIMENTAL | Declaração resolvida versus chamada realmente executada | EXPERIMENTAL | Guardar módulo não exportado e limites optional/overload/instância/herança; não prometer call trace |
| Source location/evidence localizada | NOW | Revelar linha/coluna que sustenta resposta | NOW em consumidor estático | Preservar dados mínimos; revisão/range precisam tratamento, não links atemporais |
| Findings/subject e identidade por snapshot | NOW | Associar interpretação a sinal específico | LIKELY LATER | Preservar mecanismo necessário; IDs por posição não são estáveis entre edições |
| Confidence exact/inferred | NOW | Separar resolução de hipótese | NOW quando feedback depender | Preservar semântica explícita; exact estático não prova runtime |
| Coverage/execution outcomes/limitations | NOW | Não punir aluno por regra sem suporte/falha | NOW quando avaliador automático existir | Preservar distinção sem achado/unsupported/failed; evaluated não é cobertura total |
| Provenance detector/regra/versão/origem | NOW | Auditar “como sabemos disso?” | NOW quando resultado for usado | Preservar dados mínimos, sem wrappers OBSERVE |
| Diagnostics/facts e erros de análise | NOW | Distinguir fato, warning heurístico e falha de ferramenta | NOW em atividade com analyzer | Guardar motivos/estados; relatório universal e thresholds podem sair |
| Fronteira AST interna versus dados serializáveis | NOW | Explicação inspecionável sem expor objetos do parser | LIKELY LATER | Preservar restrição técnica; não obriga contracts como package |
| CLI/harness determinístico/stdout-stderr/exit | NOW para autoria | Testar fixture e explicar falha localmente | NOW se experimentar análise | Preservar mecanismo e testes; reduzir dump de cinco representações |
| Validação de referências/proveniência e dados inválidos | LIKELY LATER | Detectar mistura de revisões/resultado inválido | LIKELY LATER | Guardar contraexemplos, não Units/Claims como domínio novo |
| Fixtures e testes TS/Nest/Prisma/workspace/graph | NOW como conhecimento | Gerar variantes e contraexemplos de atividades | NOW para preservar; uso ativo seletivo | Conservar inclusive REFERENCE; fixture simple-import deve ficar autocontida se extraída |
| Agrupamento de múltiplos imports/fontes externas | UNKNOWN | Explicação compacta após previsão | UNKNOWN | Guardar pequena técnica de UI antiga como referência; não transportar mapa |

Não presentes: executor seguro do aluno, aprendizagem/tentativas avaliadas, análise SQL/PostgreSQL, prova de guard/DI completo, causalidade runtime, call graph completo. Taxonomia de 14 responsabilidades não significa 14 detectores: a auditoria registra quatro capacidades implementadas. Browser-engine e protótipos visuais são referências de técnica/distribuição, não urgência de integração.

**Representações descartáveis sem perda dessas capacidades:** Explorer, OBSERVE como produto, DESIGN, Studio, mapas/geografia/frontiers/projections, Units, Parts, Claims, PlannedSystem, ObservedStaticCode e ObservedResponsibility. É possível preservar extração de fatos e algoritmos mantendo o código em referência, ainda que as implementações preservadas mencionem tipos antigos. Desacoplar futuramente não exige destruir antes o acervo.

Proveniência útil herdada do relatório legado: imports/aliases `9c03b59`, `064ed8a`, `4237f6f`, `1e49b1d`, `504a297`; graph `0d29252`, `3a59e4b`; Nest/session `0775648`, `753a84b`, `d1ad893`; Prisma `10aff46`; invocations `446413b`, `e50c3e1`, `d3603d7`, `2b668f3`, `6277c2e`; workspace `48c97f1`, `1d96926`. São referências documentadas anteriormente, não commits revalidados aqui. O relatório legado é ignorado por Markdown no repo de origem segundo sua própria auditoria; preservar também esse documento explicitamente numa futura etapa de versionamento, não confiar que Git já o guardou.

## 17. Capability intersections

```text
fonte + configuração TS → AST/resolução → fato estrutural → evidência localizada
código executado + condições → HTTP/evento/estado → observação → evidência dinâmica
```

Compartilham a pergunta **“como sabemos disso?”**, não necessariamente um contrato. No primeiro caso origem é declaração/configuração e versão do detector; no segundo é medição no host ou declaração do sistema instrumentalizado. Correlation ID liga operações runtime; location liga trecho de fonte. Sequence ordena coleta; confidence qualifica inferência estática. Nenhum desses campos substitui os outros.

| Dimensão | Estática (relatório legado) | Dinâmica (BunkerLab) | Consequência |
|---|---|---|---|
| Origem/source | Import/decorator/AST/config | runner, system, runtime | Não usar source de três valores como taxonomia universal |
| Identidade/revisão | Arquivo/local/identidade no snapshot; fingerprint ausente em SourceLocation | Run.code digest/snapshot, requestId; emitter version ausente | Comparar **mesma revisão** e declarar o que não identifica |
| Ordering | Ordem determinística de extração | Ordem de recebimento; systemSequence no emissor | Nem ordenação de AST nem coleta HTTP/IPC prova causalidade total |
| Causalidade | Dependência/import é relação estrutural | Eventos correlacionados + efeitos observados | Static reach não garante execução; response.sent emitido antes de res.end não prova entrega ao cliente |
| Confiança/cobertura | exact/inferred e outcomes com limites | Não há confidence/coverage formal; instrumento editável | Ausência de evento não é ausência de comportamento; não inventar certeza |
| Persistência | Resultado serializável de uma análise | Evidence/request incrementais; estado/result final | Vincular resultados pode bastar; não unificar tabelas/contratos antecipadamente |
| Interpretação | Detector e diagnóstico | Assertion/observation/hint | Fato deve continuar inspecionável mesmo quando interpretação muda |

A evidência dinâmica de banco é emitida no processo HTTP **depois** de resposta do worker, com timestamp naquele momento; não é timestamp de cada SQL dentro do banco. systemSequence pertence ao processo emissor inteiro e atravessa Runs no mesmo runtime; sequence da Run recomeça. Um flush de IPC não prova que background work de qualquer aplicação terminou. Resposta/estado são lidos via HTTP pelo runner, mas estado continua sendo uma representação fornecida pelo sistema; não verificação independente do conteúdo do arquivo SQLite.

Interseções promissoras, ainda hipóteses: previsão de dependentes → escrever hipótese → executar request → confrontar; localizar rota/guard estático → testar resposta real; modificar arquivo → calcular novo alcance → comparar observações; pistas primeiro de fonte, depois de evento; validar solução com teste e explicar limite de cada instrumento. O aluno deve responder/escrever antes de receber alcance ou diagnóstico completo.

O valor singular possível é juntar código real, pergunta concreta, análise verificável e efeito observado. Isso vai além de texto/quiz/chatbot **se** o usuário realmente precisar testar hipótese no seu código. Os materiais tornam essa experiência realisticamente possível, mas faltam captura de previsão, avaliação pedagógica, revisão comum de fonte, executor TS/Nest concreto e evidência da utilidade humana. Não transformar potencial em arquitetura obrigatória.

## 18. Candidate first activities

Candidatas a experimentos de produto, não roadmap. Duração e valor são hipóteses qualitativas para testar com o autor; nenhuma foi implementada aqui.

### A. “Este pedido será aceito?” — menor uso do BunkerLab

- **Vê:** função curta `createOrder`, estoque observado e quantidade solicitada; sem resultado antecipado.
- **Descobre:** relação entre condição, status HTTP e persistência.
- **Escreve:** previsão de status/estoque/pedidos e uma justificativa curta; numa segunda rodada altera uma condição no workspace.
- **Executa:** uma request sequencial sobre estado conhecido, depois consulta estado.
- **BunkerLab necessário:** processo, request/response, setup localizado e inspeção do estado; pode ser Activity efêmera, sem Run/checkpoint/Surface obrigatórios.
- **Analyzer:** nenhum; leitura de poucos arquivos basta.
- **Validação:** confrontar previsão e resposta/estado; teste curado valida efeito da edição, sem tratar entendimento como status passed.
- **Evidence:** request/body/status e estoque/pedidos antes/depois; eventos opcionais da operação.
- **Revelação posterior:** ramo tomado e evidência correspondente; só depois relação condição→efeito.
- **Duração:** curta, cerca de 5–10 min como hipótese. **Risco:** baixo no harness atual; reset lento deve ser tratado se permitir esse tipo de edição. **Valor hipotético:** praticar leitura/condicionais com consequência real.

### B. “Duas requests, uma unidade”

- **Vê:** estado inicial e código sem implementação alternativa pronta.
- **Descobre:** por que duas decisões podem se apoiar em leitura anterior; concorrência sem garantir falha em toda execução.
- **Escreve:** previsão, hipótese a partir dos eventos e pequena modificação depois de investigar.
- **Executa:** workloads sequencial/concorrente e repete condições após edição.
- **BunkerLab necessário:** runner restrito, IDs/eventos/estado, versão de código e comparação; checkpoint opcional.
- **Analyzer:** nenhum inicialmente; imports não explicam atomicidade.
- **Validação:** conservação, estoque e respostas sob conjunto curado de condições; repetir não prova correção universal.
- **Evidence:** leituras/escritas correlacionadas, HTTP, estado inicial/final e digest.
- **Revelação posterior:** recorte rastreável e pistas graduais sobre fronteira de decisão/escrita, sem botão de solução.
- **Duração:** média, 15–30 min. **Risco:** médio por escalonamento/fixture SQLite. **Valor hipotético:** separar interleaving real de animação e aprender a justificar conclusão.

### C. “Alias quebrado”

- **Vê:** projeto TS mínimo, tsconfig e import que falha.
- **Descobre:** diferença entre caminho escrito, resolução do compilador e resolução ao executar.
- **Escreve:** correção em import/config e explicação do motivo.
- **Executa:** typecheck e teste curto no harness TS escolhido; não usar runtime OrderDesk sem adaptação.
- **BunkerLab necessário:** apenas ideia de código editável + execução/diagnóstico; classe RuntimeManager atual é desnecessária.
- **Analyzer:** imports/aliases/unresolved com linha e motivo; gabarito curado pode dispensá-lo na primeira variante.
- **Validação:** compilação + teste de saída; não aceitar só “unresolved desapareceu” como prova runtime.
- **Evidence:** diagnóstico do compilador, localização/resolução e resultado do teste.
- **Revelação posterior:** caminho efetivo e diferença entre alias TS e suporte do executor.
- **Duração:** curta, 5–10 min. **Risco:** médio de configuração enganosa. **Valor hipotético:** recuperar sintaxe e investigar ferramenta sem chatbot como produto.

### D. “Ciclo não é trace”

- **Vê:** três arquivos pequenos com imports e possíveis efeitos de inicialização.
- **Descobre:** grupo circular, um caminho que o demonstra e o que isso não permite afirmar sobre runtime.
- **Escreve:** sequência de arquivos/arestas, previsão de saída e pequena alteração para desfazer uma relação.
- **Executa:** análise e programa curado (ou teste), compara antes/depois.
- **BunkerLab necessário:** execução curta/resultado, sem servidor/banco/Git obrigatório.
- **Analyzer:** imports + SCC; não usar circularity do relatório antigo sem corrigir bug documentado na futura extração.
- **Validação:** arestas do ciclo e resultado real separado; aceitar caminhos corretos distintos.
- **Evidence:** imports localizados e stdout/resultado, nunca “ciclo implica crash”.
- **Revelação posterior:** SCC inteira versus ciclo representante e limite da inferência.
- **Duração:** curta/média, 10–15 min. **Risco:** médio pelas diferenças de módulos/engine. **Valor hipotético:** pensamento estrutural com contraexemplo executável.

### E. “A rota declarada responde?”

- **Vê:** pequeno controller Nest e configuração de bootstrap/registro; primeiro apenas fonte.
- **Descobre:** decorator não basta para provar URL alcançável ou registro do controller.
- **Escreve:** URL/status previsto, evidência no fonte e ajuste pequeno em rota/registro conforme fixture.
- **Executa:** Nest local e request, depois teste de contrato.
- **BunkerLab necessário:** lifecycle/readiness/HTTP/logs adaptados a um único app Nest; gerenciamento Postgres dispensável.
- **Analyzer:** detector Controller+decorator como pista localizada; não fabricar URL efetiva.
- **Validação:** resposta real e registro/configuração curados; separar limitação do detector de erro do aluno.
- **Evidence:** decorator/import, bootstrap e HTTP/status, versão da fonte.
- **Revelação posterior:** quais partes da previsão eram sinais estáticos e quais exigiram execução.
- **Duração:** curta/média, 10–20 min. **Risco:** médio porque launcher/build Nest não existe no runtime atual. **Valor hipotético:** conectar configuração framework ao comportamento verificável.

### F. “Alterar esta função muda qual resposta?” — candidato combinado

- **Vê:** três arquivos TypeScript de um servidor HTTP mínimo: handler, service e consumidor alternativo não exercitado pela request.
- **Descobre:** alcance estático potencial versus caminho exercitado num teste concreto.
- **Escreve:** previsão dos dependentes/uma justificativa por import e altera uma função do service.
- **Executa:** analisa revisão congelada e dispara duas requests curadas antes/depois da modificação.
- **BunkerLab necessário:** identidade do código executado, processo, HTTP e comparação; adaptar lançamento/build TS explicitamente, sem runtime universal.
- **Analyzer:** imports/dependentes, BFS só se caminho transitivo necessário; invocation relations dispensáveis.
- **Validação:** comparar conjunto previsto com grafo conhecido e resultados HTTP separadamente. Arquivo alcançável estaticamente não precisa mudar toda resposta.
- **Evidence:** import + linha/coluna da mesma revisão, digest, request/response; não alegar trace interno sem instrumentação.
- **Revelação posterior:** alcance estático e resultados concretos, incluindo dependente que não foi exercitado.
- **Duração:** média, 10–20 min. **Risco:** médio, preparação TS/revisão conjunta ainda ausentes. **Valor hipotético:** formar modelo de impacto sem equivaler dependência a execução.

**Primeiro vertical slice combinado:** F é pequeno o suficiente para justificar uma capacidade excelente de cada acervo: análise localizada de dependentes e execução identificada com consequência HTTP. Nenhum dos dois precisa ser transplantado inteiro. A fixture atual OrderDesk é `.mjs`, não o projeto TS alvo principal do analyzer; sua análise não foi demonstrada. Não alegar integração pronta por ambos usarem Node.

**Seria mais simples começar sem integração? Sim.** A permite validar previsão→execução→observação usando materiais do BunkerLab com menos variáveis. Alternativamente C pode validar prática estática com compilador/gabarito e sem runtime de servidor. Só escolher F se a diferença entre alcance estrutural e efeito observado for a pergunta pedagógica central, não para provar a fusão dos prédios.

## 19. Keep candidates

KEEP raro e localizado: SQLite local para metadata que realmente precisa durar; helper transacional/migrations simples; buffer de interação efêmera limitado; formato expected/actual de assertion técnica; rigor TS; fixture corrigida exclusiva dos testes. Cada um depende de consumidor e das ressalvas dos gates. Não há KEEP de RuntimeManager, WorkspaceManager, LaboratoryService, runner, protocolo ou UI como unidades inteiras.

As capacidades mais fortes — ciclo real, proveniência, correlação, cleanup e comparação — são majoritariamente REFACTOR. Isso não diminui seu valor: significa que o comportamento merece sobreviver e sua forma atual não merece ser obrigatória.

## 20. Rethink/refactor candidates

Reduzir runtime para o sistema escolhido, identificar código sem Git mandatório, separar resultado técnico de feedback pedagógico, preservar evidência com limites explícitos, limitar persistência ao que será revisitado. Reavaliar Git/restore, Surface, framework Investigation, provisioning universal e schema de Run após escolher atividade.

Não dividir o service agora só para melhorar aparência. Não unificar evidência estática/dinâmica por nome. Não converter Run em Attempt ou Activity em LearningActivity sem examinar dados/ações realmente necessários. Nenhum novo bounded context, package, DSL, fila ou orquestrador é aprovado aqui.

## 21. Deletion candidates

Para futura remoção da arquitetura ativa, após autorização: shell/layout/componentes/estilos do Workbench e navegação universal; Surface e bridge quando a atividade não exigir app embutido; DTO Workbench/contexto de localStorage centrais; upgrades e markers da história OrderDesk; backfill por nomes históricos para bases novas; placeholders `.backendlab`; métricas accepted/rejected e clientes como obrigação universal; provisioning de Git/sistema para cada exercício; proibição normativa de curso/currículo.

Do legado: Explorer/Studio/DESIGN/OBSERVE como produtos, geografia/projeções e Units/Parts/Claims/PlannedSystem/ObservedStaticCode/ObservedResponsibility. Não carregar essas representações para preservar capacidade de extrair imports ou detectar Prisma.

**Não apagar nesta rodada.** Não confundir candidato à remoção ativa com limpeza de dados pessoais, snapshots, histórico, workspaces customizados ou destruição do arsenal. Código funcional e testes de upgrade podem morrer como obrigação de manutenção do produto e continuar referência no histórico.

## 22. Technical quarantine assessment

Faz sentido **como política futura**, não diretório/package implementado. Arsenal experimental separado evita obrigar o app a depender de ts-morph/PNPM/Prisma/invocations, permite testar atividades e retém conhecimento já adquirido.

Critérios mínimos antes de retirar uma capacidade dessa preservação experimental: atividade e pergunta concretas, escopo de suporte documentado, fonte/fixture revisionada, evidência verificável, testes de contraexemplos e custo de execução conhecido no fluxo. Não precisa de catálogo sofisticado nem sistema de plugins. Pode permanecer no repo legado com referências precisas até a arquitetura de destino ser escolhida. Se for copiado depois, guardar origem/SHA/testes/limitações e verificar licença antes de publicação quando necessário; auditoria anterior não encontrou LICENSE no legado.

O Git preserva código versionado; não preserva automaticamente relatório Markdown ignorado e notas locais. Quarentena não significa abandono sem inventário, nem promessa de usar tudo. UNKNOWN permanece preservado; obsolescência de representação é decisão diferente de utilidade técnica.

## 23. Unknowns

- Primeira atividade real, duração observada e se a experiência melhora aprendizagem versus ler código/testar no editor. Não há medição pedagógica.
- Distribuição local versus execução remota de código de terceiros; processo filho atual não atende segurança multiusuário. Não projetar solução cloud nesta auditoria.
- Build/dependências/readiness do primeiro Nest, ciclo de vida/isolamento do primeiro PostgreSQL e necessidade real de containers.
- Granularidade de proveniência: fonte, artefato compilado, deps/toolchain/config, estado inicial e versão do avaliador. Digest atual cobre apenas árvore filtrada.
- Quais execuções merecem histórico durável, quais respostas/previsões compõem LearningAttempt e qual retenção o usuário deseja.
- Necessidade/frequência de Git checkpoint/restore em sessões curtas e obrigação de preservar workspaces históricos existentes. Nenhuma política de destruição de dados foi aprovada.
- Contrato de event types/limites da instrumentação, tratamento de ausência/truncamento e associação confiável entre arquivo analisado e código executado.
- Robustez de restore/snapshot diante de edição adversarial, falha de disco ou config Git customizada; timeout global rígido e coleta de startup.
- Frequência e causa concorrente específica do conflito E2E de restart: erro ocupado foi observado; repetição isolada com trace passou, mas não identifica qual operação venceu na falha original.
- Analyzer: correção de circularity, invalidation/imutabilidade dos índices, contextos TS sobrepostos, coverage incompleta, resolução Node/TS e ausência de SQL. Resultados do legado são evidência anterior, não validação nesta base.
- Node 24, Windows, outros browsers, escala e multiabas não foram validados aqui; passar no host atual não prova portabilidade nem genericidade.

## Achados confirmados e hipóteses separadas

### R1 — Reset pode continuar mutando após timeout (confirmado por execução)

`laboratory.service.ts:286–300` usa exclusive, mas não para runtime quando `runtime.request` dá timeout. Diferentemente de Run (`runner.ts:151–156`) e Activity (`service:259–263`), libera busy enquanto o servidor ainda pode finalizar operação. Em cópia descartável do template, inseri **apenas para a prova** espera de 3.800 ms no handler `/reset`, acima do timeout HTTP de 3.000 ms. Após timeout, uma compra recebeu 201; o reset atrasado apagou o pedido. A latência artificial foi instrumento de reprodução, não parte do cenário canônico, e nenhum fonte foi corrigido.

Saída real:

```json
{"resetError":"TimeoutError","runtimeAfterTimeout":"ready","busyAfterTimeout":null,"purchaseStatus":201,"ordersBeforeLateReset":1,"ordersAfterLateReset":0,"stockAfterLateReset":5}
```

Impacto: exclusividade controla promessa no host, não término do efeito remoto. Isso pode contaminar observação/próxima operação quando estudante introduz lentidão no reset. Não afirmar que reset canônico rápido falha sempre. Recomendação de futura correção, não implementação nesta rodada: definir encerramento/recuperação de mutações pendentes antes de liberar sistema.

### R2 — Restart da UI pode ser recusado apesar de botão disponível (falha observada; causa concorrente específica não provada)

Suíte Playwright completa: `laboratory.spec.ts:160` clicou Reiniciar e esperou “Runtime reiniciado”; erro-context mostra “O sistema está ocupado. Aguarde a operação atual.” após 15 s. O texto corresponde à recusa por exclusividade (`service:125`), não a browser indisponível. A UI usa estado de busy por polling; a surface pode disparar leitura ao montar. **Inferência provável:** operação transitória e ação de restart disputaram lock antes do próximo polling. Não há trace da primeira execução para identificar qual operação ganhou; não apresentar essa inferência como causa demonstrada.

Uma única repetição desse caso, em outro diretório de dados, com trace, passou. Portanto instabilidade de coordenação/expectativa E2E foi observada; rerun verde não apaga a falha nem certifica confiabilidade. Não foram adicionados retry/sleep nem correção à suíte. O trace da repetição documenta o caso que passou; não foi usado para atribuir causa à falha anterior.

### Outros limites confirmados por leitura, não novas provas dinâmicas

- Duração de interrupted pode aparecer como 0 sem medição (`repository.ts:56,201–204`).
- Evento request.dispatched usa requestId no payload e exige consumidor especial (`runner.ts:68`, `Inspector.tsx:50–55`).
- Startup error pode existir como Run.error sem Evidence/logs completos daquela fase, pois observe só começa depois de start.
- Sem GC de snapshots/histórico, sem versão de evaluator/hints, sem schema de IPC além de poucos campos; mais testes seriam necessários antes de promover a runtime geral.
- Proteção de `.git` evita Git pai nas operações gerenciadas; não prova segurança de fontes/código/configuração hostis. Não foram realizados testes destrutivos adversariais.

## Validação reproduzível

Ambiente observado: Linux, Node `v26.5.0`, pnpm `11.20.0`, Git `2.43.0`; projeto exige Node >=24 e pnpm 11. Validação não demonstra Node 24/Windows. Lockfile registra TypeScript 5.9.3, tsx 4.23.15 e versões instaladas usadas; nenhum manifest/lockfile/dependência foi atualizado.

O worktree inicialmente não tinha node_modules. `pnpm typecheck` tentou install automático (`verify-deps-before-run`) e falhou no SQLite interno do pnpm (`ERR_SQLITE_ERROR unable to open database file`), **antes do typecheck**. Tentativa via `npm_config_verify_deps_before_run=false` não desativou esse comportamento neste host; os comandos de lint/typecheck/build:packages afetados não avaliaram código. A opção explícita de CLI funcionou.

Para validar sem instalação/rede/update, foram criados somente links temporários de dependências em node_modules ignorados neste checkout, apontando para pacotes já instalados da árvore principal **do mesmo repositório**, cujo lockfile foi comparado byte a byte e era idêntico. O link `@backendlab/protocol` foi direcionado para **este** checkout e reconstruído aqui, evitando incorporar os fontes modificados da árvore principal. Vite/builds/dados de teste ficaram no worktree. A árvore principal tem alterações prévias, preservadas; o legado só foi consultado pelo relatório.

| Comando real / condição | Resultado | Interpretação |
|---|---|---|
| `node --version`, `pnpm --version`, `git --version` | 26.5.0 / 11.20.0 / 2.43.0 | Ambiente efetivamente usado |
| `pnpm typecheck` (primeira tentativa) | exit 1 antes do script | Falha ambiental do gerenciador, não erro TS |
| `pnpm --config.verify-deps-before-run=false --filter @backendlab/protocol build` | exit 0 | Prepara declarations/runtime types locais |
| `pnpm --config.verify-deps-before-run=false lint` | exit 0 | ESLint sem diagnósticos |
| `pnpm --config.verify-deps-before-run=false typecheck` | exit 0 | Três packages; tsconfigs não incluem testes/e2e nem JS de templates |
| `pnpm --config.verify-deps-before-run=false --filter @backendlab/api test` dentro do sandbox | exit 1, EPERM no socket `/tmp/tsx-1000/...pipe` | Bloqueio ambiental antes dos casos |
| `pnpm --config.verify-deps-before-run=false test` com sockets locais permitidos | exit 0; **21 pass, 0 fail, 0 skip**, ~23,7 s | 17 integrações + 4 upgrades; processos/HTTP/Git/SQLite reais |
| `pnpm --config.verify-deps-before-run=false build` | exit 0 | protocol/API/web compilados; saída em dist ignorado |
| `BROWSER_PATH=/opt/brave.com/brave/brave BUNKERLAB_BROWSER_DATA_DIR=<checkout>/.bunkerlab/audit-browser pnpm --config.verify-deps-before-run=false --filter @backendlab/web test:browser` | exit 1; **2 pass / 1 fail**, ~1 min | Investigação e isolamento de surface passam; fluxo longo falha no restart (R2); nenhum skip |
| Mesmo comando, DATA_DIR `audit-browser-retry`, `--grep 'the real system is the workbench' --trace on --output ../../.bunkerlab/audit-browser-retry-results` | exit 0; **1 pass**, ~46,4 s total | Repetição única para diagnosticar instabilidade; não substitui resultado original |
| Prova Reset abaixo | exit 0, mutação tardia reproduzida | Bug comportamental fora da cobertura existente; nenhum reparo |
| Inspeção visual de `investigation-evidence.png` e `system-first-mobile.png` | Duas capturas vistas | Confirma apresentação de eventos reais e superfície predominante; não auditoria visual completa/acessibilidade |

E2E usou Brave instalado via BROWSER_PATH, não houve download de browser. Os testes abrem API 3002/Vite 5174 em loopback, um worker e dados separados. Aprovação automática de execução com sockets foi concedida; não houve rejeição pendente. Warning observado no browser: `NO_COLOR` ignorado porque `FORCE_COLOR` está definido. É de formatação do harness, não erro de aplicação. Não foram observados warnings de código em lint/typecheck; logs completos estão em `/tmp/bunkerlab-audit-*.log`.

**Estado de saúde: não declarar “todos os checks passaram”.** Verificação estática/build e integração passaram; E2E completo apresentou uma falha intermitente. Nenhum teste foi skipped. Casos não existentes na suíte estão listados na seção 12; nenhum teste novo foi incorporado ao código.

### Prova efêmera do timeout de Reset

Executada na raiz após build, com sockets loopback autorizados. Só modifica uma cópia descartável do template e a remove após shutdown. Não executar sobre diretório de dados pessoal. O código abaixo registra comportamento, não corrige o problema:

```bash
node <<'JS'
const {mkdtemp,readFile,writeFile,rm}=require('node:fs/promises');
const {join}=require('node:path');
const {LaboratoryService}=require('./apps/api/dist/laboratory.service.js');
(async()=>{
 const root=await mkdtemp(join(process.cwd(),'.bunkerlab/audit-reset-'));
 process.env.BUNKERLAB_DATA_DIR=root;
 const lab=new LaboratoryService();
 try {
  await lab.onModuleInit();
  const bench=await lab.workbench('local','orderdesk');
  const file=join(bench.codePath,'server.mjs');
  const source=await readFile(file,'utf8');
  const needle='if (req.url === "/reset") {';
  if(!source.includes(needle)) throw new Error('Probe anchor missing');
  await writeFile(file,source.replace(needle,
    needle+' await new Promise(resolve => setTimeout(resolve, 3800));'));
  await lab.restart('local','orderdesk');
  let resetError;
  try { await lab.reset('local','orderdesk'); }
  catch(error) {resetError=error.name;}
  const afterTimeout=await lab.workbench('local','orderdesk');
  const purchase=await lab.interact('local','orderdesk',{
    method:'POST',path:'/orders',body:{productId:'keyboard',quantity:1}});
  const beforeLate=await lab.workbench('local','orderdesk');
  await new Promise(resolve=>setTimeout(resolve,1000));
  const afterLate=await lab.workbench('local','orderdesk');
  console.log(JSON.stringify({resetError,
    runtimeAfterTimeout:afterTimeout.runtime.status,
    busyAfterTimeout:afterTimeout.busy,purchaseStatus:purchase.status,
    ordersBeforeLateReset:beforeLate.state.orders.length,
    ordersAfterLateReset:afterLate.state.orders.length,
    stockAfterLateReset:afterLate.state.product.stock}));
 } finally {
  await lab.onModuleDestroy();
  await rm(root,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
JS
```

## Respostas à review obrigatória

1. **Menor núcleo que merece sobreviver:** execução real isolada do host, identidade do código, observação de request/estado/eventos, avaliação específica e comparação controlada. Em capacidades, não managers inteiros.
2. **Funcional e testado que deve morrer como produto ativo:** Workbench/Surface universais, navegação do laboratório e upgrades históricos de OrderDesk; testes continuam conhecimento de fronteira/backup.
3. **RuntimeManager:** reduzir primeiro, substituir adaptação de lançamento quando atividade real pedir; não generalizar um protocolo server.mjs/SQLite/IPC para fingir suporte universal.
4. **Git checkpoints:** justificáveis em sessões longas de Build/Lab, ainda sem frequência comprovada na nova tese; não necessários para toda prática ou tentativa.
5. **ExperimentRunner além de overselling:** a sequência setup→operação→observação→avaliação é útil; implementação atual de carga HTTP e métricas de pedidos não é abstração universal comprovada.
6. **Run e LearningAttempt:** diferentes. Uma tentativa pode incluir previsão e várias Runs ou nenhuma; passed não significa aprendizado.
7. **Evidência dinâmica/estática:** manter semânticas/contratos distintos inicialmente; ligar revisão e referências conforme atividade, não fundir sequence com confidence/source location.
8. **Activities:** sim, o termo colide; hoje é request humana efêmera, não atividade pedagógica. Não renomeada nesta rodada.
9. **Investigations:** ideia forte de disclosure/evidência, implementação e conteúdo específicos de overselling; sem avaliação de compreensão e sem segundo caso que prove framework.
10. **SQLite interno:** sim para metadata local selecionada; não confundir com PostgreSQL estudado, nem trocar por simetria.
11. **Atividade mais simples usando BunkerLab:** prever aceitação/status/estado de um pedido sequencial e confrontar com HTTP real (A).
12. **Atividade que justifica analyzer também:** prever dependentes de alteração numa função e comparar respostas HTTP da mesma revisão (F); Nest rota declarada versus efetiva (E) é outra hipótese.
13. **Começar sem integração:** sim, reduz escopo e testa valor pedagógico antes de resolver preparação TS/revisão entre instrumentos.
14. **Preservar sem consumidor imediato:** PNPM/workspace/estrutura/packages, Prisma, invocations, índices/queries e seus testes, além de imports/Nest/SCC/BFS/evidence/coverage/confidence/provenance. Inventário da seção 16 não autoriza descarte por UNKNOWN.
15. **Representações que podem morrer:** produtos visuais Explorer/Studio/DESIGN/OBSERVE, mapas/geografia/projeções e Units/Parts/Claims/PlannedSystem/ObservedStaticCode/ObservedResponsibility; Workbench universal do BunkerLab também não preserva capacidade por si só.
16. **Quarentena:** sim como política de preservação e experimentação desacoplada, sem nova estrutura implementada ou dependência obrigatória do app.
17. **O que não recriaria hoje:** provisionamento universal de Git, migrations específicas de OrderDesk em manager genérico, Surface em todo exercício, protocolo agregando estado de UI/domínio/executor, histórico persistente de toda execução, contexto Investigation universal e UI inteira antes de escolher pergunta real.

## Fechamento e continuidade

Unidades concluídas: inventário/configuração/control plane; runtime; workspace; runner; repository; Activities; Investigations; protocol; UI/Surface; OrderDesk/templates/fixtures; testes/validação; documentação; comparação com relatório legado; gates e recomendações. A cobertura é arquitetural e comportamental: fontes centrais, fluxos React, contratos, testes, fixtures e documentos; CSS/layout foram classificados por responsabilidade e conferidos em duas capturas, sem revisão pixel a pixel. Não há unidade de auditoria pendente. Os Unknowns são decisões/evidências futuras, não áreas preenchidas com suposição.

Revisão manual recomendada: começar nas seções 1, 14 e 18; conferir se cada retenção tem consumidor concreto; reproduzir R1 só em dados descartáveis; confrontar a falha E2E original com a repetição verde; ler as fontes runtime/service/runner para distinguir encerramento de request e término da mutação; conferir que analyzer experimental ficou preservado sem compromisso arquitetural. A inspeção de UI deve avaliar se a pergunta/previsão guia a experiência, não somente se os painéis funcionam.

Único documento autoral criado: `docs/audits/bunkerlab-reconstruction-audit.md`, **não ignorado**. Fontes, README, AGENTS, manifests, lockfile e legado preservados. Artefatos de validação ignorados: node_modules com vínculos temporários, dist de protocol/API/web, `.bunkerlab` com bases descartáveis de browser, capturas/trace/error-context; logs em `/tmp`. São saídas auxiliares, não novos componentes do produto. Os testes criam commits somente nos workspaces descartáveis que exercitam; nenhum commit no repositório principal nem push foi realizado.

Review sugerido: verificar a fronteira entre capacidade preservada e obrigação do produto, a reprodução de mutação após timeout de Reset e a distinção entre evidência coletada, interpretação e causalidade. Não aceitar KEEP de classe inteira nem integrar analyzer antes de escolher atividade.

Commit sugerido: `docs: audit BunkerLab architecture for BunkerCode reconstruction`.

Para continuidade em outra sessão: ler este arquivo e o relatório legado indicado na seção 16; manter a nova tese de aprendizado TS/Node/Nest/PostgreSQL e preservar arsenal técnico sem transplantar packages/representações. Esta rodada concluiu apenas auditoria. Próxima arquitetura, correções de R1/R2, extração, atualização de README e qualquer demolição exigem tarefa própria; não executar essas mudanças a partir de recomendações deste documento. Se a próxima rodada for revisão desta auditoria, editar somente este relatório. Base/SHA, comandos, limitações e prova estão registrados acima; não presumir contexto de chat.

### Verificação final de Git

`git status --short --branch`: HEAD detached preservado; somente `?? docs/audits/` como saída autoral não versionada. `git diff` e `git diff --check`: vazios, sem alteração de arquivo previamente versionado. Como o relatório é novo, também foi verificado por `git diff --no-index --check /dev/null docs/audits/bunkerlab-reconstruction-audit.md`: nenhum diagnóstico de whitespace (exit 1 esperado pela comparação de arquivo novo com vazio). `git check-ignore` não encontrou regra para este relatório; não é necessário force-add. Nada staged. A lista de alterações preexistentes da árvore principal permaneceu a mesma na conferência final; nenhum comando de build/teste foi executado com cwd nela.
