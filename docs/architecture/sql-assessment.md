# Decisão e política da infraestrutura SQL

## Decisão da Evolution 04

**DECIDIDO:** conteúdo canônico em arquivos JSON versionados em `content/sql`, geridos pelo Studio existente. Datasets estruturados são reutilizados por identidade/versão. Cada atividade tem instruções públicas e uma avaliação privada. O snapshot público contém apenas projeções explícitas, nunca a definição privada. O backend público recebe o acervo privado separadamente para avaliar; sua ausência mantém a execução local, mas impede avaliação/conclusão.

Alternativas: **DESCARTADO** armazenar todas as definições no Prisma (migrations e outra autoria sem necessidade); **DESCARTADO na Evolution 04** colocar oráculos no Markdown/browser; a Evolution 05 abaixo autoriza somente resultados formativos explicitamente públicos. A solução é híbrida na distribuição, com uma única fonte editorial: JSON canônico, projeção pública derivada e referência privada protegida. Nenhuma cópia deve ser editada como fonte paralela.

## Regras normativas

1. IDs são slugs validados; versões são inteiros positivos. Publicação cria arquivo exclusivo; versões publicadas nunca são sobrescritas. Mudar dataset, instrução relevante, modo, referência ou comparação exige nova versão. Rascunhos exigem revisão otimista; conflito preserva os dois textos.
2. O navegador recebe identidade, versão, instruções, início, modo, dataset/schema públicos e limites locais. Consultas com adesão editorial explícita podem incluir resultado esperado formativo público, gerado e validado na publicação. Referências SQL e casos privados nunca pertencem a bundles, manifests públicos ou respostas de estudante.
3. Datasets pequenos usam tabelas/colunas/tipos/linhas validados. O backend gera inicialização com identificadores e literais escapados. SQL de fixture arbitrário não é aceito no Studio; dados inválidos não devem ser publicados.
4. PGlite no Worker executa e, quando há contrato formativo público, compara automaticamente o resultado. Acerto local não prova conclusão persistente. Verificar remoto e Submit usam avaliação independente quando disponível; só Submit autenticado aprovado pode persistir no modelo de progresso existente. POST de conclusão de leitura deve recusar lições SQL.
5. SQL de aluno nunca usa Prisma, credenciais da aplicação ou o PostgreSQL principal. O runner separado deve ser descartável, sem rede/volumes/secrets, não root, com filesystem restrito, seccomp/cgroup, limites de memória/CPU/processos/tempo/entrada/saída e concorrência. Papel SQL e rollback são defesas adicionais, não a fronteira inteira.
6. Mutação é uma sequência ordenada e limitada de comandos executados desde reset. Avaliação reconstrói o dataset e reproduz a sequência; nunca aceita snapshot, passed, identidade de usuário ou oráculo do cliente. Verificar não reaplica a sequência na sessão do navegador.
7. Autoria exige ADMIN e proteções locais existentes; publicação exige validação e teste da referência no runner isolado. Versões/datasets ausentes ou não publicados falham explicitamente; não há fallback que substitua avaliação autoritativa por resultado do cliente.
8. Falhas de infraestrutura não aprovam exercício. Cleanup deve terminar somente containers pertencentes à avaliação e bloquear o runner se a remoção falhar. Não registrar SQL completo, respostas privadas, credenciais ou cookies nos logs normais.
9. Check nunca persiste, mesmo autenticado. Submit exige identidade válida também na fronteira do serviço e revalida sessão/conteúdo antes de gravar. Avaliação anônima permanece bloqueada na Stabilization 01 pelo daemon privilegiado e pela ausência de cotas públicas verificadas; sua abertura depende de nova evidência operacional e controles limitados por cliente/instalação, sem fila ilimitada ou confiança em headers arbitrários.
10. Publicar não seleciona a vitrine: `sql/laboratory.json` fixa IDs/versões e ordem. Projeções públicas continuam acessíveis diretamente; curadoria não é confidencialidade. Inventário editorial exige ADMIN.
11. Mudanças SQL exigem testes de projeção, validação, correção, isolamento, recuperação e autorização. Usar banco de teste dedicado; nunca migrar o banco do autor para validar uma mudança.

## Evidência e estado

Este documento define a decisão e as regras. As capacidades implementadas e comandos operacionais são registrados em `docs/sql-practice.md` à medida que os gates forem verificados. Não equivale a atestado de segurança de produção. Publicação/deploy requer revisão da configuração, host/kernel/Docker, usuário de serviço, imagem fixada, capacidade, proxy e recuperação; nenhum deploy é autorizado por esta tarefa.

## Referências primárias

- [PGlite API](https://pglite.dev/docs/api): instâncias em memória, consulta única e transações.
- [Privilégios PostgreSQL](https://www.postgresql.org/docs/current/ddl-priv.html), [SET ROLE](https://www.postgresql.org/docs/current/sql-set-role.html), [timeouts](https://www.postgresql.org/docs/current/runtime-config-client.html): permissões e limites são camadas, não isolamento de processo.
- [OWASP autorização](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) e [validação](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html): negar por padrão, verificar cada requisição, validar estruturas no lado confiável.
- [Segurança Docker](https://docs.docker.com/engine/security/) e [recursos](https://docs.docker.com/engine/containers/resource_constraints/): containers compartilham kernel; limites precisam de configuração e prova, não apenas existência de container.

A revisão local da Stabilization 01 encontrou UID 1000 no grupo Docker, socket `/var/run/docker.sock` de root:docker e daemon UID 0. Limites reais de cgroup/seccomp foram exercitados, mas não removem a autoridade do controlador sobre o host. A imagem é resolvida por ID imutável e revisão de módulos; isso não é assinatura/proveniência nem auditoria do kernel. A próxima etapa deve tratar identidade de serviço, daemon, topologia, cotas por instalação e recuperação antes da auditoria independente final. [Rootless Docker](https://docs.docker.com/engine/security/rootless/) reduz autoridade do daemon; [limites rootless](https://docs.docker.com/engine/security/rootless/tips/#limiting-resources) dependem de cgroup v2 e delegação efetiva. Nenhuma dessas alternativas foi instalada nesta tarefa.

## ADR — Stabilization 02: controle e admissão (2026-11-11)

**DECIDIDO, antes da implementação:** manter containers PGlite descartáveis e selecionar Docker rootless por socket Unix explícito como fronteira mínima pretendida. O processo HTTP deve usar identidade sem acesso ao daemon rootful. Um serviço RPC adicional apenas transferiria a autoridade e exigiria protocolo, autenticação e operação ainda sem consumidor distinto. Nenhum outro isolamento suportado está disponível no projeto. Redis e bancos de aluno persistentes foram descartados neste escopo.

O host observado possui daemon rootful e grupo `docker`; não possui socket rootless. Portanto a execução local rootful será explicitamente de desenvolvimento, recusada em `NODE_ENV=production`. A configuração rootless será fail-closed, mas **sua implantação permanece pendente de comprovação**. Não serão alterados usuários, grupos, systemd ou kernel. A aplicação verificará cgroup v2/seccomp e o entrypoint verificará limites efetivos; parâmetros da CLI sozinhos não comprovam isolamento.

**DECIDIDO:** reaproveitar o padrão do AuthRateLimiter (HMAC, relógio PostgreSQL, transação curta e limpeza limitada), com tabelas, lock e pool SQL separados. Check, Submit e Studio terão cotas independentes; autenticação conserva seus contadores e conexões. Uma única vaga persistente por banco de aplicação limita todas as instâncias, sem fila. Falha/crash conserva a vaga; nenhuma expiração autoriza outro container enquanto o anterior pode existir. Recuperação exige parada dos consumidores, inventário e confirmação explícita do operador. A topologia suportada usa um mesmo daemon e banco para todas as réplicas.

**DECIDIDO:** instrumentar inicialização, execução, comparação e cleanup antes de otimizar. Manter instâncias independentes de referência e aluno. Avaliação anônima continua bloqueada até comprovar privilégio, limites efetivos, identidade do proxy, orçamento público e recuperação na implantação real.

Base primária: [Docker rootless](https://docs.docker.com/engine/security/rootless/), [limites e delegação](https://docs.docker.com/engine/security/rootless/tips/#limiting-resources) e [OWASP DoS](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html). Rootless reduz autoridade sobre o host; ainda requer cgroup v2, systemd com delegação de CPU/memória/pids e proteção da identidade do serviço. Cotas de aplicação não substituem proteção de borda nem garantem disponibilidade do PostgreSQL.


## ADR — Evolution 05 / Sprint 01: feedback formativo público (2026-11-12)

**DECIDIDO/IMPLEMENTADO:** consultas podem aderir a `formative: {kind: "public-result"}` no rascunho. Testar/publicar gera duas execuções da referência em bancos independentes no runner isolado existente, com a mesma admissão, cleanup e limites de recursos. Divergências observadas, truncamento ou resultado excessivo impedem publicação. Executar duas vezes não demonstra determinismo absoluto: o autor continua responsável por evitar aleatoriedade, relógio e empates sem desempate.

A versão publicada armazena o oráculo derivado no mesmo arquivo exclusivo da definição; a projeção pública inclui somente esse material, sem SQL de referência. O contrato tem formato 1, identidades/versões da atividade e dataset, política pública de ordem, campos, OIDs PostgreSQL e linhas com valores canônicos tipados. Até 100 linhas, 64 colunas e 64 KiB de oráculo. A geração usa saída de até 68.000 bytes; Check/Submit preservam 2 KiB. SHA-256 da fonte canônica privada e dataset detecta reutilização após edição externa; não protege respostas por segredo, não assina conteúdo e não autoriza progresso. Rascunhos recusam oráculo pré-preenchido; mudar fonte exige regeração e nova versão.

**DECIDIDO:** resultados esperados entregues ao aluno são material didático público e inspecionável. Se o exercício precisa ocultá-los, não deve aderir. Hashes, strings canônicas e minificação não são proteção de resposta. Versões 1 continuam imutáveis e com seu comportamento remoto; as cinco demonstrações de consulta e as duas referências de lição passam a versões 2. A mutação continua na versão 1, com Check explícito autenticado.

O Worker reutiliza o comparador semântico da avaliação privada, sem importar o módulo de avaliação/referências. Executar retorna dados reais e `correct` formativo, sem HTTP de avaliação, sem Docker por tentativa e sem exigir conta. Editar invalida feedback; geração/revisão da sessão e IDs de requests descartam respostas obsoletas. Read-only, permissões e sessões por identidade/versão conservam o dataset de consulta. Submit permanece explícito, autenticado e independente; corpo do cliente nunca pode conter passed/oráculo como prova.

**DESCARTADO:** expor SQL privado, duplicar respostas editadas à mão, trocar PGlite, comparar texto SQL, criar pool de runner ou tarefas múltiplas neste sprint. **PENDENTE:** sistema de tarefas e eventual envio em lote; orientações limitadas estão em `docs/sql-practice.md`. A indisponibilidade de Check remoto anônimo continua distinta da prática formativa anônima, que não consome infraestrutura do servidor por execução.

## ADR — Evolution 05 / Sprint 02: tarefas progressivas (2026-11-12)

**DECIDIDO/IMPLEMENTADO:** uma lição compõe 1–12 referências `{taskId, exerciseId, version}` em um único bloco `sql-task-sequence`. A ordem é editorial, identidade é estável e versões publicadas são exatas. Não há registry paralelo nem cópia de definições. Salvamento, publicação e leitor resolvem referências e exigem consultas com resultado esperado explicitamente público e dataset/versão/preparação/schema/limites iguais. O runtime é compartilhado somente para leitura; mutações em sequência são recusadas.

Acertos, consultas e tarefa ativa são locais em memória. Navegação e continuação não autorizam progresso. A guarda de vínculo do backend recusa Submit individual para sequência, inclusive na revalidação anterior à transação existente; recuperação de solução única retorna null. Conclusões históricas permanecem, sem aprovar a nova sequência. Autenticação, cotas, admissão e runner não mudam. **PENDENTE:** contrato confiável de envio da lição inteira e avaliação atômica, descritos como handoff em [prática SQL](../sql-practice.md). A pendência de tarefas registrada na ADR da Sprint 01 acima é histórica; apenas avaliação em lote continua pendente.

**DESCARTADO neste escopo:** novas tabelas de progresso, comparação por palavras SQL, recriar PGlite a cada SELECT compatível e estado de mutação compartilhado.
