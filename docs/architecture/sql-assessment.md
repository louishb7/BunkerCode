# Decisão e política da infraestrutura SQL

## Decisão da Evolution 04

**DECIDIDO:** conteúdo canônico em arquivos JSON versionados em `content/sql`, geridos pelo Studio existente. Datasets estruturados são reutilizados por identidade/versão. Cada atividade tem instruções públicas e uma avaliação privada. O snapshot público contém apenas projeções explícitas, nunca a definição privada. O backend público recebe o acervo privado separadamente para avaliar; sua ausência mantém a execução local, mas impede avaliação/conclusão.

Alternativas: **DESCARTADO** armazenar todas as definições no Prisma (migrations e outra autoria sem necessidade); **DESCARTADO** colocar oráculos no Markdown/browser. A solução é híbrida na distribuição, com uma única fonte editorial: JSON canônico, projeção pública derivada e referência privada protegida. Nenhuma cópia deve ser editada como fonte paralela.

## Regras normativas

1. IDs são slugs validados; versões são inteiros positivos. Publicação cria arquivo exclusivo; versões publicadas nunca são sobrescritas. Mudar dataset, instrução relevante, modo, referência ou comparação exige nova versão. Rascunhos exigem revisão otimista; conflito preserva os dois textos.
2. O navegador recebe apenas identidade, versão, instruções, início, modo, dataset/schema públicos e limites locais. Referências e configuração privada nunca pertencem a bundles, manifests públicos ou respostas de estudante.
3. Datasets pequenos usam tabelas/colunas/tipos/linhas validados. O backend gera inicialização com identificadores e literais escapados. SQL de fixture arbitrário não é aceito no Studio; dados inválidos não devem ser publicados.
4. PGlite no Worker é experimentação local. Não prova aprovação. Verificar e Submit usam avaliação independente quando disponível; só Submit autenticado aprovado pode persistir no modelo de progresso existente. POST de conclusão de leitura deve recusar lições SQL.
5. SQL de aluno nunca usa Prisma, credenciais da aplicação ou o PostgreSQL principal. O runner separado deve ser descartável, sem rede/volumes/secrets, não root, com filesystem restrito, seccomp/cgroup, limites de memória/CPU/processos/tempo/entrada/saída e concorrência. Papel SQL e rollback são defesas adicionais, não a fronteira inteira.
6. Mutação é uma sequência ordenada e limitada de comandos executados desde reset. Avaliação reconstrói o dataset e reproduz a sequência; nunca aceita snapshot, passed, identidade de usuário ou oráculo do cliente. Verificar não reaplica a sequência na sessão do navegador.
7. Autoria exige ADMIN e proteções locais existentes; publicação exige validação e teste da referência no runner isolado. Versões/datasets ausentes ou não publicados falham explicitamente; não há fallback para oráculo no cliente.
8. Falhas de infraestrutura não aprovam exercício. Cleanup deve terminar somente containers pertencentes à avaliação e bloquear o runner se a remoção falhar. Não registrar SQL completo, respostas privadas, credenciais ou cookies nos logs normais.
9. Mudanças SQL exigem testes de projeção, validação, correção, isolamento, recuperação e autorização. Usar banco de teste dedicado; nunca migrar o banco do autor para validar uma mudança.

## Evidência e estado

Este documento define a decisão e as regras. As capacidades implementadas e comandos operacionais são registrados em `docs/sql-practice.md` à medida que os gates forem verificados. Não equivale a atestado de segurança de produção. Publicação/deploy requer revisão da configuração, host/kernel/Docker, usuário de serviço, imagem fixada, capacidade, proxy e recuperação; nenhum deploy é autorizado por esta tarefa.

## Referências primárias

- [PGlite API](https://pglite.dev/docs/api): instâncias em memória, consulta única e transações.
- [Privilégios PostgreSQL](https://www.postgresql.org/docs/current/ddl-priv.html), [SET ROLE](https://www.postgresql.org/docs/current/sql-set-role.html), [timeouts](https://www.postgresql.org/docs/current/runtime-config-client.html): permissões e limites são camadas, não isolamento de processo.
- [OWASP autorização](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) e [validação](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html): negar por padrão, verificar cada requisição, validar estruturas no lado confiável.
- [Segurança Docker](https://docs.docker.com/engine/security/) e [recursos](https://docs.docker.com/engine/containers/resource_constraints/): containers compartilham kernel; limites precisam de configuração e prova, não apenas existência de container.
