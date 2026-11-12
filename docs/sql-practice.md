# Prática, autoria e avaliação SQL

## O que existe e quem decide a aprovação

**IMPLEMENTADO:** o leitor e a prévia do Studio usam PGlite em um Web Worker descartável. É possível explorar tabelas e executar SQL sem conta. Nenhum SQL do aluno é enviado ao PostgreSQL da aplicação. Esse banco continua reservado à autenticação e ao estado de aprendizagem pelo Prisma.

As três ações têm significados diferentes:

- **Executar** usa o banco do navegador. Não consulta avaliação nem salva progresso.
- **Verificar resposta/estado** exige sessão, avalia em container independente e retorna feedback sem concluir a lição.
- **Submit · concluir lição** exige sessão, vínculo com a lição publicada e nova avaliação. Somente aprovação confirmada permite gravar `ApprovedSolution` e `LessonCompletion`, na mesma transação do serviço de aprendizagem existente.

O servidor recusa campos adicionais como `passed`, identidade de usuário e resultado esperado. Busca referência e dataset por ID/versão, confere o vínculo com a lição e reconstrói o estado sem confiar no Worker. A conclusão editorial por leitura é recusada para lições SQL. Falhas de rede, runner ou persistência não são apresentadas como conclusão confirmada. **BLOQUEADO — Stabilization 02:** a verificação anônima não foi habilitada. O ambiente revisado usa daemon Docker rootful, acessível pelo grupo `docker`; o backend controla esse daemon com privilégio elevado. Restrições do container não eliminam essa autoridade no host. A UI informa a indisponibilidade sem classificar a tentativa como incorreta e não oferece Submit a visitantes. As duas rotas continuam exigindo identidade, inclusive em requisições forjadas; não há fallback local de correção nem flag nova que libere a avaliação anônima. A experimentação local permanece acessível.

`/sql` continua como vitrine temporária das seis demonstrações migradas. O curso **SQL na Prática: Do Zero aos Bancos de Dados** usa o catálogo, módulos, leitor e Studio normais; não depende dessa rota. As duas lições são exemplos iniciais para revisão e desenvolvimento da autoria do criador, sem lhe atribuir relatos pessoais inventados. O Módulo 00 JavaScript não foi modificado.

## Fonte canônica, datasets e versões

A fonte editorial única é `content/sql`:

```text
sql/datasets/<id>/<version>.json
sql/exercises/<id>/<version>.json
sql/exercises/<id>/draft.json
sql/laboratory.json
```

Uma definição tem `format: 1`, `id`, `version`, `status`, `title`, `objective`, `instructions`, `starterSql`, `mode`, `dataset: {id, version}` e `assessment: {reference: string[], orderMatters: boolean}`. `reference` é privada: uma consulta ou uma sequência ordenada de comandos de alteração. Os seis exemplos anteriores mantêm IDs/versão 1; os arquivos TypeScript do catálogo foram removidos.

Dataset é estrutura, não script arbitrário: título, tabelas, colunas e linhas. Cada coluna declara nome, tipo (`integer`, `text`, `numeric(8,2)` ou `boolean`), nulabilidade, chave primária e referência opcional `{table, column}`. Linhas são arrays na ordem das colunas. O validador verifica nomes, tipos, duplicação de chave, referências, valores nulos e limites. A preparação SQL é gerada com identificadores e literais escapados. Dados são fictícios e públicos; nunca inclua dados pessoais, segredos ou credenciais.

Limites do formato: até oito tabelas, dezesseis colunas e cem linhas iniciais por tabela; dataset de até 128 KiB; até vinte comandos e 16 KiB de SQL no total. IDs são slugs, paths não são entradas da API. Publicação cria arquivo exclusivo: não sobrescreve versões existentes. Dataset reutilizado também é imutável. Alterar instrução relevante, preparação, referência ou comparação exige nova versão. Rascunhos usam revisão SHA-256 e lock exclusivo; conflito exige releitura e preservação do texto antes de nova gravação.

Essas garantias coordenam os escritores da aplicação, não impedem um editor externo ou administrador do filesystem de alterar arquivos. Revise o diff antes do commit e preserve as versões antigas. Um lock deixado por interrupção exige inspeção do processo e dos arquivos; não tem expiração ou limpeza automática.

## Studio: criar a terceira atividade e lição

1. Entre como ADMIN na interface local autorizada. Abra uma lição em **Editar lição** e siga **Atividades SQL**, ou abra `/studio/sql`.
2. Em **Datasets reutilizáveis**, reutilize `store` v1 ou configure outro JSON estruturado e clique **Salvar dataset**. Uma nova revisão usa o próximo número, sem editar versões publicadas.
3. Clique **Novo exercício**, escolha ID estável, título, objetivo, instruções públicas, modo, dataset e SQL inicial. Escreva a referência privada; alterações podem ter vários passos. Marque exigência de ordem somente quando fizer parte do desafio.
4. Use **Prévia do exercício** para experimentar a projeção pública. Ela não publica nem grava conclusão. **Salvar rascunho** grava explicitamente; digitar não envia alterações ao backend.
5. **Testar referência** executa a referência no runner isolado, com os mesmos limites. **Publicar versão** testa novamente e só depois cria a versão imutável, rechecando a revisão. Runner indisponível ou referência inválida impede publicação; não há avaliação local substituta.
6. Crie a próxima lição com o diálogo já existente e use **Atividade SQL publicada** para selecionar título, ID e versão. O seletor insere ou substitui somente o bloco SQL reconhecido no rascunho, preservando o restante do Markdown. A referência apresentada na autoria também pode ser copiada; escreva a explicação ao redor do bloco abaixo. Salvar Markdown resolve o vínculo e recusa referências ausentes.
7. Revise a prévia, salve fisicamente, abra o leitor, confira `git diff` e faça o commit manualmente. Se a nova lição deva ser pública, revise a seleção em `config/publication.json` e gere novo snapshot. Reinicie o backend após mudar a seleção.

````markdown
```bunker-sql
{"kind":"sql","exerciseId":"store-select-columns","version":1}
```
````

Não é preciso editar React ou Nest para acrescentar a terceira atividade. O manifesto do curso continua controlando identidade, ordem, módulos e lições. Cada lição admite uma referência SQL de topo; misturar prática JavaScript na mesma lição é recusado. Markdown comum permanece texto inerte, e a prévia não executa fences automaticamente. O rascunho SQL só existe no editor até o salvamento explícito; antes de sair, salve ou copie suas alterações.

## Projeção pública e distribuição privada

`GET /content/sql/exercises` lista somente as referências explícitas de `content/sql/laboratory.json`, na ordem declarada. Cada entrada em `exercises` tem `{id, version}`; a versão fica fixada até uma edição intencional da seleção. Ausência de seleção resulta em vitrine vazia; referências inválidas ou duplicadas falham explicitamente. `GET /content/sql/exercises/:id/:version` continua resolvendo qualquer versão publicada. As respostas contêm instruções, início, schema, preparação pública gerada e limites. Não contêm `assessment`, SQL de referência ou metadados de comparação privada. Rascunhos não são resolvidos por essas rotas. Publicar uma versão não a inclui na vitrine. Uma lição publicada pode usar uma atividade não listada, e o Studio continua mostrando todas as versões publicadas. `GET /content/sql/references`, usado pelo seletor do Studio, exige ADMIN. O acesso direto à projeção pública e o Check autenticado de versões publicadas permanecem disponíveis: retirar da vitrine não torna uma atividade confidencial. A futura verificação anônima deverá validar vínculo com lição publicada ou seleção da vitrine no servidor antes de usar o runner. Submit só pode concluir uma lição quando o vínculo também estiver publicado. `/content/sql/authoring` e suas mutações exigem ADMIN, perfil authoring e as proteções locais de Host/origem/JSON/header existentes.

`publication:prepare` gera `sql/public/<id>/<version>.json` a partir do acervo canônico, além dos cursos selecionados. Inclui as projeções das versões publicadas e a seleção `sql/laboratory.json`; não copia datasets canônicos, rascunhos ou definições privadas. A projeção é derivada, nunca outra fonte a editar. A validação de startup confere inventário, formato e somente leitura. O build público exclui o editor SQL do Studio e não importa o módulo de avaliação nem seus oráculos.

No perfil público, `BUNKERCODE_SQL_ASSESSMENT_DIR` aponta separadamente para a raiz privada `sql`, com `datasets` e `exercises`, fora do host estático e do snapshot público. O backend compara a projeção privada derivada com a publicada antes de avaliar. Configuração ausente ou divergente impede avaliação; leitura e execução local continuam. Nenhum acervo privado deve ser copiado para `dist-public`, servido estaticamente ou incluído em logs. “Privado” aqui descreve a distribuição pela aplicação: se o repositório e seu histórico forem públicos, as definições canônicas também serão públicas. Confidencialidade fora da aplicação exige controle de acesso ao repositório/artefato; esta avaliação verifica resultado/estado, não certifica raciocínio nem funciona como sistema de prova contra consulta de respostas.

## Semântica da prática e avaliação

Consulta aceita um único SELECT, incluindo WHERE, ORDER BY, JOIN, agregação e CTEs compatíveis. A preparação é determinística. O papel de estudante não possui tabelas, criação, temporários ou privilégios administrativos. O modo consulta é somente leitura. Protocolo estendido recusa múltiplas instruções; a subconsulta usada para limitar resultados também rejeita comandos não incorporáveis.

Alteração aceita um único SELECT, INSERT, UPDATE ou DELETE por execução, planejado com EXPLAIN sem ANALYZE antes da execução transacional. Restrições do PostgreSQL e permissões complementam o isolamento; não há allowlist de palavras por regex como garantia de segurança. DDL, administração, controle de transações, sequências e triggers não fazem parte do contrato educacional.

A sequência de alteração submetida é a dos comandos executados com sucesso desde o último reinício, incluindo consultas, em ordem. O texto ainda não executado não participa da solução. Ao editar, o feedback deixa claro que o banco mantém os passos anteriores; se a edição ocorrer durante execução ou avaliação, a resposta também identifica o texto não executado. Uma conclusão já persistida continua histórica, mesmo após editar, cancelar ou reiniciar. Verificar e Submit reproduzem esses passos em outro banco; não os reaplicam no navegador. Erros comuns fazem rollback do passo. Reiniciar, cancelar ou perder o Worker elimina banco e sequência, preservando o texto. Falhas em explorar dados que descartem o Worker também limpam a sequência.

A referência e a submissão usam motores independentes, iniciados do mesmo dataset. Consultas comparam nomes/ordem de colunas e valores, preservando NULL, duplicatas e tipos. Ordem de linhas só importa quando configurada. Qualquer resultado truncado reprova. Alterações comparam todas as linhas de todas as tabelas, detectando mudanças não solicitadas. Limite é de cem linhas por resultado/tabela; referências que excedam o limite não podem ser publicadas. O limite de linhas não limita o custo de uma célula; a fronteira de recursos é o container.

O autor deve escolher referências determinísticas: evite horário atual, aleatoriedade e ordenação com empates sem critério de desempate quando a ordem for exigida. O teste de publicação confirma execução e limites, mas não demonstra determinismo nem correção em qualquer conjunto de dados. A avaliação usa o dataset versionado declarado; não há geração de casos privados adicionais.

**Ver registros** lê até dez registros reais da tabela selecionada, sem alterar texto ou avaliação. Uma prévia vazia informa que a tabela não contém registros; uma consulta sem linhas mantém a mensagem de resultado vazio. Os cabeçalhos permanecem visíveis em ambos os casos. Tema e rerenders mantêm a sessão `id + version`; trocar atividade ou sair descarta o Worker. O navegador tem 60 s para inicialização e 5 s por operação posterior. Esses timers descartam o Worker, mas não constituem cotas rígidas de memória do navegador. Dispositivos lentos e custo de baixar WebAssembly continuam limitações reais.

## Runner isolado: configuração e recuperação

**DECIDIDO:** um único runner PGlite separado do processo HTTP, mantendo o dialeto da prática. Alternativa PostgreSQL dedicado foi descartada neste escopo pelo custo de criar e limpar bancos/serviços e pela superfície adicional de operação. Papel SQL ou rollback isoladamente não seriam suficientes. A [decisão de arquitetura](architecture/sql-assessment.md) registra alternativas e referências primárias.

Prepare a imagem depois de compilar o pacote de conteúdo:

```bash
pnpm --filter @bunkercode/content build
node scripts/build-sql-runner.mjs
```

O build usa a imagem Node fixada por digest, a dependência PGlite do lockfile, módulos compilados e um programa fixo que recebe JSON pelo stdin. Não recebe código JavaScript do aluno. O contexto é temporário, fora do checkout, sem `.env` ou arquivos do produto, e fica preservado para inspeção. A tag local é `bunkercode-sql:local`; antes de executar, o backend verifica Linux/cgroup v2/seccomp e revisão dos módulos. Executa pelo ID imutável resolvido da imagem. Recompile/reconstrua quando mudar o motor ou dependência; imagem antiga falha fechada.

Habilite explicitamente `BUNKERCODE_SQL_RUNNER_ENABLED=1` e escolha `BUNKERCODE_SQL_RUNNER_MODE`. Sem configuração válida, a prática local continua e a avaliação responde 503. Nenhuma configuração habilita Check anônimo ou Submit sem sessão.

- `development`: socket fixo `/var/run/docker.sock`, somente com `NODE_ENV` diferente de `production` e origens HTTP de loopback. É o modo comprovado neste host rootful; **não é uma fronteira adequada para exposição pública**.
- `rootless`: exige `BUNKERCODE_SQL_DOCKER_SOCKET=/run/user/<uid>/docker.sock`, UID não root, diretório privado e socket pertencentes à identidade do processo, sem acesso de leitura/escrita ao socket rootful padrão. O daemon deve declarar rootless, cgroup v2, driver systemd e seccomp. Contextos Docker, endpoints TCP e credenciais herdadas não são usados. A CLI recebe somente PATH, locale e configuração vazia temporária, além do socket explícito; não recebe DATABASE_URL, JWT ou proxy.

**PENDENTE no host de destino:** identidade dedicada sem grupo `docker`/sudo/ACL que permita daemon rootful ou outros sockets privilegiados; uidmap e intervalos subuid/subgid; Docker rootless e diretório runtime privado; cgroup v2 e delegação systemd de cpu, memory e pids; imagem construída/carregada nesse mesmo daemon; rede `none` efetiva. Esses requisitos são operações do operador: esta tarefa não instala runtime nem modifica o host. Os checks da aplicação não auditam todas as formas de escalar privilégio de uma identidade. A implantação rootless precisa ser exercitada no destino antes de exposição pública.

Cada avaliação usa container novo: UID/GID 65534, rede `none`, sem volumes ou variáveis da aplicação, raiz somente leitura, capabilities removidas, `no-new-privileges`, seccomp padrão, tmpfs de 1 MiB com noexec/nosuid/nodev, 1 GiB de memória sem swap adicional, 0,75 CPU, 32 processos e 64 descritores. O entrypoint confere UID, capabilities, seccomp, NoNewPrivs, interfaces e limites efetivos de cgroup antes de ler/executar SQL. Entrada até 300 KB, saída combinada até 2 KiB, execução até 30 s, além dos prazos de Docker. Referência e aluno são PGlites novos, independentes e fechados, sem pooling de estado.

### Cotas e concorrência compartilhadas

`SqlQuota` contém somente chaves HMAC, contagem e expiração. Por conta autenticada, cada política Check, Submit e Studio permite seis tentativas/minuto; payloads inválidos de Check/Submit também contam. O teto agregado é 60 tentativas/minuto por instalação. As janelas fixas de 60 segundos começam no primeiro consumo aceito, usando o relógio do banco; podem permitir rajadas na transição. A vaga única continua limitando execuções, independentemente dessa frequência. Isso limita frequência; não reserva uma vaga de execução para Submit. Anônimos não têm orçamento e continuam recusados pela autenticação. Identidade vem da sessão validada, nunca do corpo ou de X-Forwarded-For. A topologia suportada é de vários processos NestJS no mesmo host e identidade de serviço, compartilhando o mesmo socket Unix/daemon, banco e segredo HMAC. Réplicas em hosts ou daemons distintos não foram homologadas; mudar segredo ou usar bancos separados invalida a garantia das cotas agregadas.

Uma transação curta usa relógio do PostgreSQL, lock próprio sem espera na admissão, limpeza de até 100 registros expirados e teto de 4.096 chaves. Identidades conhecidas preservam saldo quando a tabela está cheia. O pool SQL tem duas conexões por processo: uma operação de admissão por vez e capacidade reservada para finalizar a vaga (lock de até 200 ms). A admissão não usa AuthThrottle, lock ou pool de autenticação; a validação de sessão da requisição continua usando o serviço de autenticação existente. Esse isolamento de contadores/conexões não reserva CPU, I/O ou conexões físicas no servidor PostgreSQL; não executa SQL do aluno no produto. Banco indisponível falha fechado; contenção/cota/vaga ocupada retorna 429 com Retry-After. Não faça retry automático: aguarde o prazo ou ação do usuário. A proteção de borda e o dimensionamento do PostgreSQL continuam necessários.

`SqlRunnerSlot` limita **uma avaliação global por banco**, incluindo Studio, entre processos. Guarda somente UUID, horário e suspensão, sem SQL nem identidade pessoal. Nenhuma transação/conexão fica aberta enquanto o container executa. A vaga só é liberada depois de confirmar cleanup. Falha na gravação da liberação impede sucesso e pode exigir recuperação conservadora mesmo sem container residual.

### Falha e recuperação

Sinal já cancelado recusa execução; desconexão e shutdown cancelam. Timeout tenta kill limitado e encerra também a CLI. Cleanup tenta remover somente o nome UUID da avaliação, inclusive após create parcial. Falha de remoção suspende o processo e conserva a vaga suspensa no PostgreSQL. Após create incerto, até a resposta de remoção “container inexistente” exige reconciliação operacional; ela não libera a vaga automaticamente. Reinício não limpa a vaga; após 90 segundos uma claim retida responde 503 em vez de apenas ocupado. Não há expiração que autorize executar sobre um container possivelmente vivo. Readiness recusa qualquer container com label SQL já existente e suspende o processo, sem apagá-lo automaticamente.

Eventos JSON `sql_runner` registram UUID, fase, resultado operacional e durações de readiness/create/execução/cleanup; métricas privadas separam inicialização, consulta, comparação e fechamento dos motores, além de maxRSS. Não registram SQL, referência, resultado esperado ou credenciais e não entram na resposta HTTP. `maxRSS` é do processo, não um histórico completo do cgroup. Falhas de conexão de admissão também têm evento genérico; a vaga no banco é o estado durável.

Para recuperar, em janela operacional:

1. Pare **todos** os consumidores HTTP da instalação e confirme banco e daemon corretos. Use o socket explícito do modo configurado também nos comandos manuais (`docker --host unix:///...`).
2. Leia `SELECT "owner", "claimedAt", "suspended" FROM "SqlRunnerSlot" WHERE "id"=1` no banco correto e inventarie `docker ps -a --filter label=bunkercode.sql.runner=1`. Correlacione UUID dos eventos/claim, nome, label e origem; não remova containers de outras instalações ou sem propriedade comprovada.
3. Se houver resíduo comprovado, remova **somente seu ID exato**, após inspeção. Não use prune, filtros globais de remoção nem limpeza de diretórios/bancos locais. Corrija daemon/imagem/capacidade.
4. Com inventário SQL vazio, configuração explícita do mesmo banco/socket e autenticação carregada pelo ambiente seguro, após o build do backend, execute `pnpm --filter @bunkercode/backend sql:recover <owner-uuid> --consumers-stopped`. O comando usa o artefato compilado em `dist` (não exige tsx nem fontes em produção), não lê `.env`, não apaga containers, exige a claim esperada e recusa inventário não vazio. A declaração de consumidores parados é responsabilidade do operador; não é descoberta automática de processos remotos.
5. Reinicie o backend (o processo suspenso não é reabilitado pela limpeza do banco), teste referência, cancelamento e Submit antes de reabrir. Claim ausente, UUID divergente, banco/daemon incerto ou inventário inexplicado exige investigação, não reset manual amplo.

Cancelar não desfaz uma conclusão já confirmada. Se a conexão cair nessa janela, recarregue o progresso.

## Testes seguros e limites de prontidão

Use um PostgreSQL de teste dedicado, `DATABASE_URL` explícita e segredos JWT efêmeros, sem carregar `.env` do autor. Aplique migrations somente nesse banco. As fixtures de browser continuam pertencendo ao supervisor temporário; saídas e evidências usam novo diretório por rodada. Não abra nem migre SQLite histórico.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm build:public
# Com a imagem pronta, ambiente de teste e runner habilitado:
pnpm --filter @bunkercode/backend exec tsx --test test/sql-runner.test.ts
pnpm --filter @bunkercode/frontend exec playwright test sql-lab.spec.ts
pnpm --filter @bunkercode/frontend test:browser:public
```

Os testes reais de Docker usam `BUNKERCODE_SQL_RUNNER_ENABLED=1`; sem essa variável, são explicitamente marcados como skip. Não confunda uma suíte sem esses testes com prova de isolamento. As validações cobrem projeção, arquivos, revisão obsoleta, avaliação sem estado compartilhado, privilégios, limites do kernel, cancelamento/timeout/recuperação e APIs autorizadas. Rode tarefas caras em sequência e Playwright com um worker nesta máquina.

## Prontidão e verificação anônima

**IMPLEMENTADO:** configuração explícita, verificação de limites no entrypoint, cotas persistentes próprias, vaga global, eventos e recuperação conservadora. **DECIDIDO:** rootless como fronteira mínima pretendida. **PENDENTE:** demonstrar essa implantação com identidade sem privilégio rootful, kernel/delegação, imagem e recuperação reais. O ambiente local continua de desenvolvimento. Container compartilha kernel; não equivale a VM ou atestado de produção.

Antes de Check anônimo, comprovar conjuntamente: identidade/daemon sem autoridade rootful; limites efetivos e exaustão segura; mesma vaga/cotas em toda a topologia; orçamento por cliente e proteção de borda; proxy validado com IP apenas de request.ip e BUNKERCODE_TRUSTED_PROXIES explícito; elegibilidade por vínculo de lição publicada ou seleção da vitrine; orçamento reservado a Submit; falhas/recuperação no destino; ausência de persistência anônima e vazamento de referência. NAT, cadastro abusivo e múltiplas instalações exigem avaliação operacional. **BLOQUEADO:** esses controles públicos não foram todos comprovados, portanto não existe flag para liberar avaliação anônima.

HTTP permanece: 401 sem sessão, 403 para autorização/origem, 400 para payload inválido, 404 para versão ausente/não publicada, 409 para vínculo/revisão/cancelamento, 413 para corpo excessivo, 415 para tipo incorreto, 422 para erro SQL/limite, 429 com Retry-After para cota/capacidade e 503 para runner/admissão indisponível ou suspenso. Timeout usa 408. `{passed:false}` é feedback de correção; falha operacional nunca é aprovação. Não há transação distribuída entre conexão HTTP e PostgreSQL.

**INCERTO:** capacidade pública, segurança do host de destino e comportamento sob carga externa. **DESCARTADO:** avaliar no banco principal, oráculo no frontend, Redis sem necessidade, serviço RPC genérico, pooling de bancos de aluno ou mudanças no currículo/UI. Não houve deploy.
