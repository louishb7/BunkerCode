# Jornada persistente do estudante — Sprint 2

Progresso, retomada e preferências pertencem à conta autenticada em PostgreSQL. O conteúdo continua em Markdown/JSON; nada do conteúdo editorial migra para o banco. As APIs exigem a identidade verificada pelo guard existente. Não há `userId` aceito nos corpos, impersonação administrativa, dashboard ou sincronização de rascunhos.

## Persistência e contratos

A migration `20261106020000_learning_journey` acrescenta quatro tabelas sem modificar dados de autenticação. Todas têm FK para `User` com `ON DELETE CASCADE`. Não há FK para arquivos editoriais: retirar uma lição da publicação preserva o histórico.

- `LessonCompletion`: chave `(userId, courseId, lessonSlug)`, data da primeira conclusão. Conclusão repetida/concomitante usa inserção com conflito ignorado.
- `LastLessonVisit`: uma linha por conta. O relógio do PostgreSQL registra a visita; em concorrência vence a última escrita serializada nessa linha. Não existe relógio do cliente, telemetria de scroll ou log de navegação.
- `ApprovedSolution`: chave `(userId, courseId, lessonSlug, exerciseId, revision)`. Conserva a última solução aprovada na mesma revisão. `revision` já é o SHA-256 dos bytes de `exercise.json`, incluindo testes e enunciado. Até mudanças só de formatação do JSON alteram essa revisão, por escolha conservadora. Revisões antigas permanecem armazenadas e não são restauradas como aprovação da revisão atual. A conclusão é um registro histórico por lição: mudar a revisão não a desfaz nem certifica aprovação na avaliação nova. Source tem limite de 64 KiB na API e CHECK em SQL.
- `LearningPreferences`: uma linha por conta, com tema `bunkercode|light`, tonalidade `null|0..5` e tamanho inteiro `16..21`. `null` significa acompanhar o tema global. API e CHECK em SQL validam os valores.

APIs com `Cache-Control: no-store`, disponíveis em authoring e public:

| Método e rota                                             | Contrato                                                                                                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /learning`                                           | Cursos publicados com `courseId`, `lessons`, `total`, `completed`, além de `resume: {course, slug}` ou `null`. Não lista registros ocultos. |
| `POST /learning/courses/:course/lessons/:lesson/visit`    | Corpo `{}`. Valida/carrega a lição publicada antes de registrar. Não conclui.                                                               |
| `POST /learning/courses/:course/lessons/:lesson/complete` | Corpo `{}`. Conclusão explícita de lição sem exercício de código. Recusa exercício com 409.                                                 |
| `GET /learning/courses/:course/lessons/:lesson/solution`  | `{solution: {source, revision, approvedAt}}` ou `{solution: null}`, somente revisão atual publicada e usuário autenticado.                  |
| `GET /learning/preferences`                               | `{preferences: valores}` ou `{preferences: null}`.                                                                                          |
| `POST /learning/preferences`                              | Inicializa se ausente, sem sobrescrever registro existente; devolve valores efetivos.                                                       |
| `PUT /learning/preferences`                               | Substitui os três valores validados.                                                                                                        |

Os três valores de preferência são `siteTheme`, `readingTone`, `readingSize`, sem campos adicionais. Escritas de `/learning` exigem Origin permitido e JSON de até 4 KiB, recusam `Sec-Fetch-Site: cross-site` e não dependem de cookies como identidade da API. Usam bearer em memória e recuperação de sessão existente.

O resumo conta exclusivamente as lições publicadas no momento. Zero lições produz total zero, sem percentagem fictícia. Uma última visita retirada da publicação aponta para a primeira lição ainda publicada do mesmo curso; sem curso/lição elegível, `resume` é nulo. Não apaga o registro anterior. Administradores usam a mesma projeção publicada para dados de estudante; prévias editoriais não contam como visitas nem conclusões.

## Run e Submit

A seleção canônica atual publica somente `fundamentos-programacao-javascript/o-que-significa-programar`, sem exercício de código. Esta sprint não amplia essa seleção. Aprovação/recuperação de código são verificadas com exercícios existentes publicados apenas nas cópias descartáveis dos testes; disponibilizar esses exercícios no conteúdo canônico é uma decisão editorial separada.

`POST /practice/runs` continua compilando/avaliando sem persistir solução aprovada. O novo `POST /practice/submissions` usa exatamente o mesmo payload, validação de revisão, recompilação do source pelo backend e runner Docker restrito. Não aceita `passed`, `approved`, `userId`, score ou campos livres. JavaScript enviado pelo cliente não é usado para aprovar um exercício: a avaliação recompila o source capturado.

Somente quando o backend obtém `assessment: passed` e execução bem-sucedida, revalida a sessão e a revisão publicada, e grava em uma transação a solução exata e a conclusão da lição. Hoje cada lição tem no máximo um `exercise.json`, portanto a aprovação desse exercício justifica a conclusão. Um novo Submit aprovado substitui apenas a solução da mesma conta/exercício/revisão. Concorrência é resolvida pela ordem de escrita no banco. Falha, ausência de testes, compilação inválida, cancelamento ou runner indisponível não criam aprovação. O resultado de Submit acrescenta `approved: boolean`, que informa se houve persistência na conta.

A execução continua exclusivamente no perfil authoring, com os controles locais, autenticação, limite de código, timeout, cgroups, seccomp, imagem fixada, rede bloqueada e quotas já existentes. O perfil público continua recusando comandos de prática; estudantes no serviço público podem recuperar uma solução anteriormente aprovada, mas não executar/avaliar por essa instalação. Não se declara avaliação pública de código implementada. Prévia administrativa pode ser avaliada localmente, com feedback explícito de que não houve progresso na conta.

Edição e salvamento de rascunhos continuam exclusivamente no IndexedDB, separados por identidade/revisão. O histórico local de Submit conserva também resultados não avaliados/falhos; isso nunca é prova de aprovação remota. Recuperar a solução aprovada exige escolha explícita e diálogo de confirmação antes de substituir o editor. Nenhum fetch ou Submit altera automaticamente o rascunho, inclusive quando há edições durante a avaliação. Uma aprovação é relativa aos testes configurados, sem alegação de domínio geral do assunto.

## Interface e preferências

O leitor oferece **Marcar como concluída** após carregar uma lição publicada sem exercício. Estado concluído aparece após confirmação do servidor. Lições com código exibem conclusão por Submit aprovado; quizzes editoriais permanecem leitura, sem resultado cliente tratado como avaliação confiável. A página do curso mostra contagem e indicador por lição. A Home reutiliza **Continuar estudando**, consultando a conta; o histórico local de visitante não é importado.

O provider existente de aparência mantém controles, seis tonalidades e escala. Visitantes preservam as chaves locais anteriores. Contas inicializam preferências uma vez a partir do contexto de visitante; havendo registro remoto, ele vence. Escolhas feitas durante a carga inicial são aplicadas somente aos campos alterados, preservando os demais valores remotos. Trocas são imediatas na UI, enviadas sequencialmente; escolhas discretas são enviadas imediatamente, e o tamanho é agrupado por 400 ms, sem aplicar respostas antigas sobre valores novos. PUT de preferências usa keepalive, e pagehide tenta despachar tamanho ainda pendente quando não há gravação em curso. Fechamento abrupto durante uma gravação ou sem rede ainda pode interromper alterações não confirmadas. Falha mantém a escolha na sessão e informa que não foi sincronizada. Uma nova alteração tenta salvar novamente. Não há broadcast em tempo real entre dispositivos: a conta carrega as preferências na inicialização/login/reload.

Preferências de conta não são escritas nas chaves do visitante. Logout restaura o contexto local de visitante; troca de conta aborta pedidos e descarta o estado anterior. A recuperação de API recusa retry se a identidade ou geração mudou. Os tamanhos dos painéis continuam locais por dependerem da geometria da tela; não foram adicionados ao contrato remoto. Rascunhos e dados locais nunca são apagados ou importados no login.

## Operação e validação

Execute `pnpm --filter @bunkercode/backend db:generate`, confira `db:status:local` e aplique `db:deploy:local` no banco intencionalmente configurado. Não use db push/reset. Os testes exigem PostgreSQL exclusivo de testes com as quatro migrations aplicadas e as variáveis descritas em [authentication.md](authentication.md). Nunca rode fixtures em `bunkercode_dev`.

`apps/backend/test/learning.test.ts` exercita HTTP real, PostgreSQL e Docker quando disponível: isolamento, idempotência concorrente, publicação, reinício do backend, preferências, código exato, Run sem persistência, falha de avaliação, revisão obsoleta e sessões inválidas. Os arquivos de testes backend rodam sequencialmente (`--test-concurrency=1`) para evitar competição entre fixtures no banco compartilhado e entre testes de estresse do Docker; a concorrência intencional dentro dos testes de segurança e Submit é preservada. Os cenários de contas/dispositivos e restauração foram ampliados em `e2e/auth.spec.ts`. Os grupos existentes de avaliação/readiness preservam sua cobertura com a nova rota de Submit; os testes de armazenamento de visitante usam contexto anônimo. O pacote de evidências da execução registra resultados reais, falhas e reruns.

## Aprovação SQL

SQL reutiliza `ApprovedSolution` e `LessonCompletion`. Check é sempre não persistente; a avaliação anônima permanece bloqueada nesta etapa de estabilização e as rotas exigem sessão. Somente Submit autenticado e aprovado pode salvar progresso, com autenticação explícita também no serviço; ausência de credencial não degrada Submit para Check. `/sql/check` avalia sem persistir; `/sql/submit` autentica, confere exercício/versão da lição publicada, avalia em container isolado e revalida sessão e conteúdo antes da transação do serviço de aprendizagem. A conclusão editorial por leitura recusa lições com `bunker-sql`. Não há flag de aprovação, identidade ou snapshot aceito do navegador.

A revisão SQL é SHA-256 da definição e do dataset normalizados, incluindo a referência privada. `source` conserva JSON `{format:1, steps:string[]}`; até vinte comandos, 16 KiB de SQL e representação serializada de até 64 KiB. O GET de solução existente retorna somente a própria aprovação da revisão atual. O leitor oferece carregar a consulta ou reproduzir explicitamente os passos aprovados; não executa mutações de forma automática ao reabrir. Digitar, executar e verificar não salvam rascunhos na conta. A conclusão continua sendo histórica por lição, como no contrato existente: editar SQL, cancelar ou reiniciar não a apaga. O feedback da mutação distingue os comandos executados do texto ainda não executado, inclusive quando o editor muda durante a avaliação. [Autoria, segurança, operação e testes](sql-practice.md).
