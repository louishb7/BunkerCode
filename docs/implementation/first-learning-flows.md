# Primeiros fluxos de aprendizagem

> Documento histórico. A consolidação de 2026-10-08 substitui decisões incompatíveis. Referências ativas: [arquitetura atual](../architecture/overview.md) e [autoria](../authoring.md). Paths/comandos abaixo descrevem a rodada original, não a árvore atual.

Data: 2026-10-07. Escopo: fases 0–4 da arquitetura de reconstrução. Duas atividades locais, sem integração de analyzer, curso completo ou demolição do BunkerLab.

## Resultado e decisões

O novo fluxo é independente do Workbench: uma aplicação Nest pequena (`learning-main.ts`/LearningModule) e `/learn` na web existente. O bootstrap antigo continua disponível. Abrir atividade lê conteúdo; iniciar tentativa grava dados; executar é ação explícita posterior.

Conteúdo: JSON pequeno para contexto/regras, starter TS e harness/testes ao lado. Attempt é sessão de resolução. Submission guarda fonte, previsão/justificativa, revisão, digest, condições, versão de atividade e digest do harness. Resultado e feedback são gravados uma vez, sem recomputá-los na leitura.

SQLite novo: `.bunkercode/learning.sqlite`. Tabelas `attempts` e `submissions`, mais metadata de migration/ownership. As submissões são linhas separadas porque resultado assíncrono e rascunho mutável precisam de gravações independentes. Não há tabelas de Course, Track ou Execution.

A proteção de ownership apareceu numa restrição concreta: recuperação de pendências só pode acontecer quando a API anterior acabou. `learning_owner`, adquirido em transação, recusa outro PID vivo; após crash, um novo owner pode recuperar pendências como interrompidas. Não é coordenação distribuída. Reutilização de PID pode causar recusa conservadora; não há eleição/lease multi-host.

O controle de revisão recusa stale save com 409. Fonte/previsão de Submission não mudam quando o rascunho avança. Há no máximo uma submissão pendente por tentativa; outras tentativas têm estado/processos próprios.

## Fluxos reais

```text
order-acceptance
conteúdo -> previsão/justificativa -> salvar revisão
-> congelar Submission no SQLite
-> compilar TS em processo filho
-> processo novo com HTTP e estado { stock: 1, orders: 0 }
-> GET estado inicial -> POST /orders quantity: 1 -> GET estado final
-> encerrar grupo -> comparar fatos -> feedback -> editar/prever novamente
```

Existe uma única request de negócio POST; as leituras GET são instrumentação de estado. O harness lê o JSON da request real. A função do aluno decide; o handler confiável traduz accepted para 201/409. Estado em memória não simula banco, transação ou lock.

```text
reserve-stock
enunciado/casos -> escrever TS -> salvar revisão
-> congelar Submission -> compilar
-> node:test + assert nos três casos declarados
-> relatório de casos/exit -> cleanup -> feedback -> corrigir/repetir
```

Esse executor não inicia servidor, faz HTTP, provisiona System, usa Git, Surface ou analyzer. Testes abaixo/igual/acima do estoque são visíveis no conteúdo. Falha de compilação tem diagnostics e zero casos executados; assertion failure tem casos efetivamente executados e exit 1.

Os casos structured são produzidos pelo harness confiável ao envolver assertions do runner nativo. Exigimos três nomes esperados e exit compatível com o relatório. Um exit code isolado não inventa contagem de testes. Isso cobre esta suíte concreta; não é reporter universal.

## Lifecycle e limites implementados

- Prazo padrão de 8 segundos inclui compilação, readiness, operação e coleta.
- Fonte: um arquivo `solution.ts`, até 16 KiB. Justificativa/reflexão: até 2.000 bytes. Nenhuma path/flag/comando vem do navegador.
- Até 100 submissões por tentativa; para continuar, iniciar nova tentativa. Não existe limite global de histórico ou GC de tentativas nesta rodada.
- Cada execução materializa fonte e harness em um diretório novo no tmpdir; nenhum symlink de fonte do aluno é copiado.
- `tsc` instalado no projeto verifica tipos e emite CommonJS. Runtime e TypeScript efetivos são registrados no resultado.
- Harness roda sob supervisor responsivo; se o aluno bloquear o event loop, o pai continua podendo matar o grupo.
- No Linux, timeout encerra o grupo antes do retorno. Perda abrupta do pai faz o supervisor encerrar o próprio grupo, inclusive exercício bloqueado.
- Windows tem fallback de kill, mas encerramento de árvores e teste de perda do pai foram validados somente no Linux; não afirmar equivalência.
- stdout/stderr são capturados separadamente, até 8 KiB por stream. Persistem fatos/casos e trechos diagnósticos de até 2.000 caracteres. Truncamento é explícito. stdout de sucesso é descartado; stderr diagnóstico pode ser retido.
- Response HTTP é limitada a 8 KiB. Resultado inválido, crash, timeout, preparação e cleanup são erros distintos de comparação pedagógica.
- Shutdown aborta operações, espera seus callbacks e fecha SQLite. Pendências de crash são recuperadas como interrompidas, sem reexecutar. Duração/versões não observadas ficam indisponíveis; não inventamos duração zero medida.
- Falha de cleanup bloqueia reuso daquela tentativa no processo atual. Temporários não são removidos antes de encerrar os filhos.

Processo separado não é sandbox de filesystem/rede/memória. Código é confiável do próprio autor. Não há proteção contra execução hostil, subprocessos que deliberadamente escapem do grupo ou quotas de memória; execução remota de terceiros permanece fora do escopo.

## Editor, reload e conflito

Editor é textarea monoespaçada com Tab de dois espaços, teclado e estado de gravação. A primeira atividade mantém fonte só para leitura até receber uma primeira submissão; depois permite editar e limpa previsão/justificativa para exigir nova resposta.

Autosave usa revisão esperada, serializa saves na aba e preserva uma cópia do rascunho em sessionStorage a cada edição. Isso permite recuperar reload imediato antes do debounce. SQLite é a fonte durável; sessionStorage é um journal por aba, não histórico pedagógico. Fechar a aba antes de confirmar save pode perder a cópia local; a UI oferece confirmação de gravação.

localStorage guarda apenas o ID da tentativa atual por atividade. **Nova tentativa** cria outra sessão sem apagar a anterior. Navegação de tentativas antigas ainda não tem tela própria; elas continuam no banco e no endpoint por ID.

Uma aba obsoleta recebe erro visível e mantém seu texto local. Não há merge automático ou colaboração realtime. A atualização de revisão/recuperação local exige ação explícita do usuário.

Conclusão exige reflexão curta. Para previsão, uma execução completa basta, mesmo que previsão estivesse errada. Para função, os três casos declarados precisam ter passado. Esses critérios registram percurso, não certificam domínio conceitual.

## Estrutura e arquivos

| Área | Arquivos principais / papel |
|---|---|
| Conteúdo novo | `content/activities/order-acceptance/{activity.json,starter.ts,harness.cjs}`; `reserve-stock/{activity.json,starter.ts,tests.cjs}` |
| Novo domínio/casos de uso | `apps/api/src/learning/{models,content,attempts,feedback,store}.ts` |
| API nova | `learning-main.ts`; `learning/{application,learning.module,learning.controller}.ts` |
| Instrumentos | `execution/{results,process,order-request,stock-function-tests}.ts`, `supervisor.cjs` |
| Armazenamento/build | `apps/api/migrations/learning/001-attempts.sql`; `scripts/copy-learning-resources.cjs` |
| UI/transporte novos | `apps/web/src/learning/{Learning.tsx,api.ts,types.ts,learning.css}` |
| Testes novos | `apps/api/test/learning.test.ts`; `apps/web/e2e/learning.spec.ts`; config Playwright dedicada; tsconfigs para checar os testes novos |
| Preservação | Dois relatórios em `docs/audits`, arquitetura de destino e AGENTS atualizado |

Modificados: AGENTS, README, `.gitignore`, scripts dos três manifests raiz/API/web, ESLint, roteamento de App e config Playwright antiga (apenas separação dos testes novos). Arquitetura de destino ganhou estado/proveniência canônica e link desta implementação. Nenhum fonte de manager/service/protocol/template/teste antigo foi removido ou transplantado.

## Comandos

```bash
pnpm dev:learning
# http://127.0.0.1:5173/learn
pnpm lint
pnpm typecheck
pnpm test
pnpm build
BROWSER_PATH=/caminho/do/chromium pnpm test:learning:browser
```

API de aprendizagem: `/learning/activities`, `/learning/attempts`, `/learning/attempts/:id`, e comandos `draft`, `submissions`, `completion`. Mutações exigem JSON e `x-bunkercode-client: local`, no bootstrap também exercitado pelos testes. A web utiliza o proxy `/api`; o cliente novo não usa selectedSystem nem o protocolo antigo.

`BUNKERCODE_DATA_DIR` muda apenas aprendizagem. Os E2E novos usam 3012/5184 e um diretório isolado novo por invocação. Os antigos usam a configuração antiga e são executados separadamente.

Neste worktree, não havia dependências. Foi comparado o lockfile com o checkout principal do mesmo Git (idêntico) e criados vínculos ignorados para dependências existentes, com protocol apontando ao **worktree atual**. Cache Vite é local; não compartilhar diretórios mutáveis de cache com o checkout principal. Não houve install, download ou mudança de dependency/lockfile.

A CLI usada foi `pnpm --config.verify-deps-before-run=false <script>`, conforme estratégia da auditoria. Sockets de tsx/HTTP/browser precisaram de execução fora do sandbox restritivo; o primeiro teste dentro dele falhou com EPERM antes dos casos. Não confundir esse erro com teste reprovado.

O build copia supervisor CJS para dist. Conteúdo/migrations continuam recursos versionados resolvidos em relação ao layout do repositório; o modo validado é execução local deste checkout. Não prometer bundle portátil só com dist.

## Como adicionar uma terceira atividade simples

1. Definir pergunta/ação, starter, critérios visíveis e feedback na pasta de conteúdo.
2. Acrescentar ID em `learning/content.ts`. IDs são allowlist; não ler path recebido do navegador.
3. Escolher se usa instrumento existente ou escrever uma função concreta nova. Ajustar explicitamente despacho em `attempts.ts`; não tratar todo novo kind como HTTP/teste por inércia.
4. Acrescentar feedback específico em `feedback.ts`. Alterações substantivas de tarefa/critério/feedback exigem nova versão de atividade; feedback recebido já salvo não é recalculado.
5. Reusar editor/tentativa quando servirem ao exercício. Novo resultado técnico pode ganhar renderer próprio; não aumentar os resultados atuais com campos vazios de outra atividade.
6. Testar fonte congelada, falha relevante e percurso antes de adicionar estrutura de curso/framework.

Uma futura análise poderá produzir dados/referências para a submissão, sem importar AST no modelo de Attempt. Nenhuma interface/pasta de analysis foi criada agora.

## Proveniência e desvios do target

As auditorias foram copiadas sem alteração. Hashes SHA-256 conferidos:

```text
legado    885c5015274d3faa2976d1e8c1558b03d3ac35597571c4796417d85f1857902b
BunkerLab 685a765fc9be677674b6d78c40c5ed6a2288b86575647b4f8a4d0be4aa15cc75
```

Comportamentos/técnicas aprendidos em BunkerLab SHA `46633e1a6b542b61a35e85a9b20e343cf2aa9866`: processo fora do host e cleanup (`runtime.ts`), fonte identificada/canônico protegido (`workspace.ts`), SQLite/migration pequena (`repository.ts`/`migrate.ts`), comparação expected/actual (`protocol`/experimento). As implementações novas foram escritas para os dois exercícios; não foram copiados managers ou packages inteiros. A regra de aceitação do OrderDesk é referência comportamental da nova fixture em memória.

A árvore inicial mudou em detalhes para coexistência: entrypoint próprio de aprendizagem, duas tabelas em vez de um documento JSON e supervisor de processo responsivo. Ownership local surgiu para tornar recovery correto. Isso não muda o domínio nem introduz runtime universal. HTTP boundedJson pertence apenas ao adaptador HTTP; preparação/lifecycle são compartilhados por compilação e os dois instrumentos.

A arquitetura conceitual permanece. Não houve analyzer, Git/checkpoint, Course, Track, PostgreSQL, auth ou demolição. AGENTS aponta agora à arquitetura e às auditorias canônicas; os relatórios históricos mantêm seus fatos originais de localização/estado de Git.

## Bugs encontrados e correções desta rodada

- Reload do campo justificativa expôs ambiguidade do locator de label com texto restaurado. Nome acessível explícito corrigiu o caso; E2E inicial falhou e repetição passou. Não foi usado sleep/retry para esconder o problema.
- Recovery precisava impedir segundo owner vivo do mesmo banco. Agora aquisição SQLite transacional recusa a segunda API; regressão preserva submissão pendente.
- Estilos globais do legado afetavam contraste/tamanho dos novos campos/tabela/textos. Overrides limitados a `.learning-shell` corrigem a superfície sem refatorar CSS antigo.
- O smoke identificou título da aba ainda herdado do Workbench e mensagem de compilação mencionando testes no exercício HTTP. A rota nova define/restaura seu título e distingue request não executada de testes não executados.
- Recovery de resultado HTTP carregava um campo vazio de casos de teste. Foi removido; a regressão confere que o resultado recuperado continua específico do instrumento.
- Uma execução final encontrou corrida no teste de perda do pai: `/proc/<pid>/stat` desapareceu entre open/read e retornou ESRCH. O teste reconhecia apenas ENOENT. As duas verificações de processo morto agora aceitam ambos, sem aceitar erro arbitrário nem enfraquecer a exigência de encerramento. Houve repetição focada e da suíte completa após a correção.
- Cache Vite inicialmente apontava ao checkout principal e build foi recusado por filesystem read-only. Removidos somente os links de cache criados nesta tarefa; cache passou a ser local. Não foi necessário atualizar dependências.

R1/reset tardio e R2/restart histórico não foram corrigidos. Novo fluxo não reutiliza reset/restart compartilhados. Código antigo continua com seus limites documentados.

## Review arquitetural após os dois slices

1. LearningActivity contém conteúdo e tipo de ação, sem lifecycle/child_process; HTTP está na fixture/instrumento específico.
2. Modelo Attempt conhece dados submetidos/resultados, não child_process. Casos de uso chamam instrumentos explicitamente.
3. reserveStock não introduziu System, servidor, HTTP, Surface ou Git.
4. Resultado de teste tem cases; resultado HTTP tem observation. União discriminada pequena, sem payload universal.
5. Fonte e entradas são salvas em transação antes de preparar o processo.
6. Editar depois não altera linha input_json nem result_json anterior; finish só preenche resultado ainda vazio.
7. Persistem fatos/casos e pequenos diagnostics, não streams completos de toda execução.
8. Helpers compartilhados têm consumidores reais: compilação e dois instrumentos. Nenhum framework/package sem consumidor.
9. Tipos do cliente foram espelhados localmente de propósito; nenhum package compartilhado novo.
10. Análise futura cabe como operação concreta e resultado próprio, sem AST no domínio; não implementada.

## Review pedagógica

1. O aluno escreve previsão ou código antes da execução; abrir/iniciar não revela resultado.
2. Request/estado/regra de status ou regras/casos da função deixam explícita a pergunta.
3. Execução fornece fatos da pergunta; PID/portas/digest/logs não dominam a tela.
4. Fatos/casos aparecem antes do feedback; previsão/justificativa anterior ficam junto deles.
5. Não há hints ou solução automática. Feedback aponta limite de igualdade sem escrever a correção.
6. Casos nomeados e esperado/recebido ajudam localizar falha; compile error não se disfarça de teste falhado.
7. Submissões sucessivas e novas tentativas são ações naturais, sem apagar histórico.
8. Ainda é possível editar aleatoriamente até passar. Testes não demonstram compreensão; reflexão textual não tem avaliação semântica.
9. Próximo ajuste pedagógico pequeno: pedir um exemplo novo e previsão antes da conclusão, somente se uso real mostrar valor; não criar fricção automática agora.

## Review técnica — 25 respostas

1. Novos arquivos estão agrupados na tabela Estrutura: learning/execution, conteúdo, UI, migration, recurso CJS, testes/configs e docs.
2. Modificações existentes estão listadas na mesma seção; nenhum manager/protocol antigo foi alterado.
3. LearningActivity é definição JSON versionada + starter TS, carregada de allowlist.
4. Attempt usa SQLite novo; draft JSON com revisão, status/reflexão e submissões relacionadas.
5. Submission congela fonte/previsão/justificativa em transação antes de qualquer await de execução.
6. Digest é SHA-256 dos bytes UTF-8 submetidos; versão de atividade e digest do harness são guardados. Não identifica ambiente inteiro.
7. Save com expected revision divergente recebe 409; texto local é preservado.
8. Executor HTTP compila, materializa harness/processo novo, observa estado, faz um POST real e encerra.
9. Abort/deadline mata grupo; supervisor permanece responsivo ao loop do aluno; close é aguardado antes do cleanup.
10. Temporário/processo/estado novos a cada execução, mais regressões de timeout, PID morto e execução seguinte limpa.
11. reserveStock usa tsc + node:test/assert e relatório específico da suíte.
12. Compilação falha antes dos testes e informa linha/coluna; assertion failure traz casos reais, esperado/recebido e exit 1.
13. Nenhuma nova dependency: Node/SQLite/crypto/test e TypeScript/Nest/React/Playwright já disponíveis.
14. Segundo exercício funcionou sem HTTP/System/Git/Surface/analyzer.
15. Nenhum módulo novo depende do protocol antigo; App ainda importa legado apenas para suas rotas antigas.
16. Nenhum módulo novo depende de LaboratoryService; LearningModule é independente.
17. Deliberadamente espelhados DTOs web pequenos e feedback/renderers específicos; isso evita package/abstração universal.
18. Compartilhados Attempt/Submission/store/editor/transporte e preparação/lifecycle com consumidores concretos.
19. Limites locais/confiáveis, um arquivo, três casos, sem LSP/hints, histórico global sem GC, Linux efetivamente validado.
20. Próximo trabalho: autor usar os dois exercícios e registrar fricções; depois primeira sequência pequena de Lessons/Course.
21. Shell/rotas de Workbench/Surface/TestTool têm menor justificativa para servir ao produto novo; demolição permanece tarefa posterior.
22. Target só ganhou notas de implementação/proveniência; ajustes físicos e ownership são explicados, sem alterar a tese.
23. Prazo de 8 s, teto de 100 submissões e editor simples são limites iniciais de engenharia, não números calibrados por estudo de UX.
24. Testes de processo/browser dependem de sockets locais e Chromium instalado; perda do pai é Linux-specific. Reruns/falhas estão registrados acima e na validação.
25. Os dois fluxos são utilizáveis localmente pelo autor via `/learn`; eficácia de aprendizagem não foi medida.

## Gates e validação

Gates 0–7 concluídos: preservação, salvar sem runtime, submissão congelada, lifecycle/isolamento, segundo instrumento independente, ação antes do resultado, cobertura real e ausência de dependência nova do núcleo legado.

Checks executados com `pnpm --config.verify-deps-before-run=false` neste host:

| Check | Resultado |
|---|---|
| lint | Passou |
| typecheck | Passou, incluindo testes/configs novos |
| test | 34 passaram: 21 existentes + 13 novos; nenhum skip |
| build | Passou, incluindo cópia do supervisor CJS |
| E2E aprendizagem | 3 passaram; navegador Brave/Chromium instalado |
| E2E legado | 3 passaram; dados exclusivos de smoke |
| Auditorias | SHA-256 idênticos às fontes preservadas |
| Diff | `git diff --check` sem erros; manifests sem mudança de dependencies e lockfile intacto |

Os E2E novos foram executados novamente após correção do locator inicial e após ajustes encontrados nas capturas/smoke. A execução inicial reprovada, a corrida observada no teste de processo e suas correções estão descritas acima. Não houve retry automático nem skip na suíte completa; o comando focado selecionou somente o teste de perda do pai. Não foram corrigidos os bugs históricos R1/R2; a passagem dos testes antigos não invalida as reproduções das auditorias. O warning `NO_COLOR` ignorado por `FORCE_COLOR` apareceu nos servidores/browser e afeta apenas cores do output.

Smoke adicional pela interface no browser in-app, com `pnpm ... dev:learning`, API de desenvolvimento e `.bunkercode/manual-smoke` separado:

- Pedido: previsão errada 409/1/0 observou 201/0/1; previsão correta confirmou 201/0/1; edição do limite produziu 409/1/0; reload preservou as três submissões e a fonte editada.
- Função: starter incompleto falhou nos três casos; fonte com tipo de retorno declarado incompatível produziu TS2322 na linha 2 sem executar testes; condição incorreta falhou somente na igualdade; código corrigido passou os três casos; reload preservou cinco submissões. Uma fonte sem anotação explícita inferiu retorno string e chegou aos testes, onde foi rejeitada: compilação valida TypeScript, testes validam o contrato observado.
- Durante edição da própria plataforma, HMR coincidiu com restart da API e uma leitura exibiu `Unexpected end of JSON input`. Reload após restart recuperou rascunho/histórico; não houve perda de dados. A UI não faz retry automático de comandos nessa situação.
- Capturas desktop/mobile dos E2E estão em `.bunkercode/browser-results`; inspecionadas visualmente. Mobile também verifica ausência de overflow horizontal. Diretórios de dados, capturas, builds e vínculos de dependências são ignorados; nenhum dado preexistente foi removido.
- Os servidores e a aba temporária de smoke foram encerrados ao final; as seis portas de desenvolvimento/E2E usadas nesta rodada ficaram livres. A última suíte completa terminou com 34/34, sem skip; a última suíte de aprendizagem no navegador terminou com 3/3, após os ajustes finais de produto.

As revisões arquitetural, pedagógica e técnica acima respondem às 10, 9 e 25 perguntas da missão. Nenhum commit/push/rebase nem worktree removido.

Review sugerido: fazer previsão errada/correta, editar e verificar o código preservado em cada submissão; provocar compile error no reserveStock; conferir conflito entre abas e isolamento após timeout. Revisar também limites de retenção e a separação entre diagnóstico técnico e interpretação pedagógica.

Commit sugerido: `feat: build initial BunkerCode learning flows`.
