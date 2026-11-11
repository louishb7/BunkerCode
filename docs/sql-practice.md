# Prática, autoria e avaliação SQL

## O que existe e quem decide a aprovação

**IMPLEMENTADO:** o leitor e a prévia do Studio usam PGlite em um Web Worker descartável. É possível explorar tabelas e executar SQL sem conta. Nenhum SQL do aluno é enviado ao PostgreSQL da aplicação. Esse banco continua reservado à autenticação e ao estado de aprendizagem pelo Prisma.

As três ações têm significados diferentes:

- **Executar** usa o banco do navegador. Não consulta avaliação nem salva progresso.
- **Verificar resposta/estado** exige sessão, avalia em container independente e retorna feedback sem concluir a lição.
- **Submit · concluir lição** exige sessão, vínculo com a lição publicada e nova avaliação. Somente aprovação confirmada permite gravar `ApprovedSolution` e `LessonCompletion`, na mesma transação do serviço de aprendizagem existente.

O servidor recusa campos adicionais como `passed`, identidade de usuário e resultado esperado. Busca referência e dataset por ID/versão, confere o vínculo com a lição e reconstrói o estado sem confiar no Worker. A conclusão editorial por leitura é recusada para lições SQL. Falhas de rede, runner ou persistência não são apresentadas como conclusão confirmada. A verificação pública sem login não é oferecida; a experimentação local permanece acessível.

`/sql` continua como vitrine temporária das seis demonstrações migradas. O curso **SQL na Prática: Do Zero aos Bancos de Dados** usa o catálogo, módulos, leitor e Studio normais; não depende dessa rota. As duas lições são exemplos iniciais para revisão e desenvolvimento da autoria do criador, sem lhe atribuir relatos pessoais inventados. O Módulo 00 JavaScript não foi modificado.

## Fonte canônica, datasets e versões

A fonte editorial única é `content/sql`:

```text
sql/datasets/<id>/<version>.json
sql/exercises/<id>/<version>.json
sql/exercises/<id>/draft.json
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

`GET /content/sql/exercises` lista as últimas versões publicadas; `GET /content/sql/exercises/:id/:version` resolve uma versão. As respostas contêm instruções, início, schema, preparação pública gerada e limites. Não contêm `assessment`, SQL de referência ou metadados de comparação privada. Rascunhos não são resolvidos por essas rotas. Publicar uma versão torna suas instruções/dados públicos também na vitrine, independentemente de a lição já ter sido incluída na seleção de cursos. Submit só pode concluir uma lição quando o vínculo também estiver publicado. `/content/sql/authoring` e suas mutações exigem ADMIN, perfil authoring e as proteções locais de Host/origem/JSON/header existentes.

`publication:prepare` gera `sql/public/<id>/<version>.json` a partir do acervo canônico, além dos cursos selecionados. Inclui as demonstrações SQL publicadas para a vitrine; não copia datasets canônicos, rascunhos ou definições privadas. A projeção é derivada, nunca outra fonte a editar. A validação de startup confere inventário, formato e somente leitura. O build público exclui o editor SQL do Studio e não importa o módulo de avaliação nem seus oráculos.

No perfil público, `BUNKERCODE_SQL_ASSESSMENT_DIR` aponta separadamente para a raiz privada `sql`, com `datasets` e `exercises`, fora do host estático e do snapshot público. O backend compara a projeção privada derivada com a publicada antes de avaliar. Configuração ausente ou divergente impede avaliação; leitura e execução local continuam. Nenhum acervo privado deve ser copiado para `dist-public`, servido estaticamente ou incluído em logs. “Privado” aqui descreve a distribuição pela aplicação: se o repositório e seu histórico forem públicos, as definições canônicas também serão públicas. Confidencialidade fora da aplicação exige controle de acesso ao repositório/artefato; esta avaliação verifica resultado/estado, não certifica raciocínio nem funciona como sistema de prova contra consulta de respostas.

## Semântica da prática e avaliação

Consulta aceita um único SELECT, incluindo WHERE, ORDER BY, JOIN, agregação e CTEs compatíveis. A preparação é determinística. O papel de estudante não possui tabelas, criação, temporários ou privilégios administrativos. O modo consulta é somente leitura. Protocolo estendido recusa múltiplas instruções; a subconsulta usada para limitar resultados também rejeita comandos não incorporáveis.

Alteração aceita um único SELECT, INSERT, UPDATE ou DELETE por execução, planejado com EXPLAIN sem ANALYZE antes da execução transacional. Restrições do PostgreSQL e permissões complementam o isolamento; não há allowlist de palavras por regex como garantia de segurança. DDL, administração, controle de transações, sequências e triggers não fazem parte do contrato educacional.

A sequência de alteração submetida é a dos comandos executados com sucesso desde o último reinício, incluindo consultas, em ordem. O texto ainda não executado não participa da solução. Verificar e Submit reproduzem esses passos em outro banco; não os reaplicam no navegador. Erros comuns fazem rollback do passo. Reiniciar, cancelar ou perder o Worker elimina banco e sequência, preservando o texto. Falhas em explorar dados que descartem o Worker também limpam a sequência.

A referência e a submissão usam motores independentes, iniciados do mesmo dataset. Consultas comparam nomes/ordem de colunas e valores, preservando NULL, duplicatas e tipos. Ordem de linhas só importa quando configurada. Qualquer resultado truncado reprova. Alterações comparam todas as linhas de todas as tabelas, detectando mudanças não solicitadas. Limite é de cem linhas por resultado/tabela; referências que excedam o limite não podem ser publicadas. O limite de linhas não limita o custo de uma célula; a fronteira de recursos é o container.

O autor deve escolher referências determinísticas: evite horário atual, aleatoriedade e ordenação com empates sem critério de desempate quando a ordem for exigida. O teste de publicação confirma execução e limites, mas não demonstra determinismo nem correção em qualquer conjunto de dados. A avaliação usa o dataset versionado declarado; não há geração de casos privados adicionais.

**Ver registros** lê até dez registros reais da tabela selecionada, sem alterar texto ou avaliação. Tema e rerenders mantêm a sessão `id + version`; trocar atividade ou sair descarta o Worker. O navegador tem 60 s para inicialização e 5 s por operação posterior. Esses timers descartam o Worker, mas não constituem cotas rígidas de memória do navegador. Dispositivos lentos e custo de baixar WebAssembly continuam limitações reais.

## Runner isolado: configuração e recuperação

**DECIDIDO:** um único runner PGlite separado do processo HTTP, mantendo o dialeto da prática. Alternativa PostgreSQL dedicado foi descartada neste escopo pelo custo de criar e limpar bancos/serviços e pela superfície adicional de operação. Papel SQL ou rollback isoladamente não seriam suficientes. A [decisão de arquitetura](architecture/sql-assessment.md) registra alternativas e referências primárias.

Prepare a imagem depois de compilar o pacote de conteúdo:

```bash
pnpm --filter @bunkercode/content build
node scripts/build-sql-runner.mjs
```

O build usa a imagem Node fixada por digest, a dependência PGlite do lockfile, módulos compilados e um programa fixo que recebe JSON pelo stdin. Não recebe código JavaScript do aluno. O contexto é temporário, fora do checkout, sem `.env` ou arquivos do produto, e fica preservado para inspeção. A tag local é `bunkercode-sql:local`; antes de executar, o backend verifica Linux/cgroup v2/seccomp e revisão dos módulos. Executa pelo ID imutável resolvido da imagem. Recompile/reconstrua quando mudar o motor ou dependência; imagem antiga falha fechada.

Habilite explicitamente `BUNKERCODE_SQL_RUNNER_ENABLED=1` no backend. Sem isso, a prática local funciona e a avaliação responde indisponível. Não exponha Docker via HTTP ou mount de socket ao aluno. O serviço que controla Docker possui um privilégio operacional elevado; sua separação e endurecimento no host devem fazer parte da implantação.

Cada avaliação usa container novo: UID/GID 65534, rede `none`, sem volumes ou variáveis da aplicação, raiz somente leitura, capabilities removidas, `no-new-privileges`, seccomp padrão, tmpfs de 1 MiB com noexec/nosuid/nodev, 1 GiB de memória sem swap adicional, 0,75 CPU, 32 processos e 64 descritores. Só uma avaliação por processo; não há fila sem limite. Entrada até 300 KB, saída combinada até 2 KiB, execução até 30 s, além de prazos curtos para operações Docker. O PGlite de referência e o do aluno exigiram mais de 512 MiB nos testes; falta de memória encerra o container e nunca aprova.

Há seis solicitações de avaliação por conta/minuto, mapa limitado e concorrência global por processo; a criação/login de contas conserva os limites persistentes de autenticação existentes. Não é uma cota distribuída para vários servidores. Proxy, capacidade, proteção de entrada e política multi-instância precisam de validação operacional antes de produção. SQL completo e respostas privadas não são registrados pelo fluxo normal.

Cancelamento da conexão ou shutdown sinaliza término. Timeout encerra o container; cleanup remove somente o nome gerado pela avaliação. Falha de remoção suspende o runner até reiniciar o processo, sem fallback. Para recuperar: inspecione `docker ps -a --filter label=bunkercode.sql.runner=1`, confirme ausência de consumidores ativos e remova somente resíduos comprovados dessa execução. Não faça limpeza ampla do Docker nem de diretórios ignorados. Após corrigir Docker/imagem/capacidade, reinicie o backend e teste referência e submissão antes de reabrir o serviço. Cancelar não desfaz uma conclusão que já tenha sido confirmada pelo servidor; recarregue o progresso se a conexão cair nessa janela.

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
pnpm --filter @bunkercode/frontend test:browser -- sql-lab.spec.ts
pnpm --filter @bunkercode/frontend test:browser:public
```

Os testes reais de Docker usam `BUNKERCODE_SQL_RUNNER_ENABLED=1`; sem essa variável, são explicitamente marcados como skip. Não confunda uma suíte sem esses testes com prova de isolamento. As validações cobrem projeção, arquivos, revisão obsoleta, avaliação sem estado compartilhado, privilégios, limites do kernel, cancelamento/timeout/recuperação e APIs autorizadas. Rode tarefas caras em sequência e Playwright com um worker nesta máquina.

**Estado de prontidão:** capacidade local implementada, com validação em ambiente isolado de desenvolvimento registrada na entrega. **PENDENTE:** revisão do host/kernel e runtime de hospedagem, atualização e integridade da imagem, capacidade real, quotas distribuídas/proxy, observabilidade, operação e recuperação no ambiente de destino. Container compartilha kernel; não equivale a uma VM nem a um atestado de produção. Nenhum deploy foi realizado. **HIPÓTESE:** baixo custo em hardware fraco e capacidade para muitas avaliações simultâneas não foram comprovados. **DESCARTADO:** executor no banco principal, oráculo no frontend, plataforma SQL paralela, microserviço genérico e currículo avançado antecipado.
