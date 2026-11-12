# Deploy, migrations e recuperação

O deploy usa as migrations SQL versionadas de `apps/backend/prisma/migrations`. `pnpm start` e `pnpm start:public`, na raiz, passam pelo launcher `scripts/deploy-backend.mjs`: ele verifica o banco configurado, executa **`prisma migrate deploy`** e só inicia o backend após sucesso. Uma falha encerra com código não zero, sem abrir HTTP. Reiniciar reaplica somente migrations pendentes, sem duplicar as já registradas.

O fluxo local `pnpm dev`, `start:authoring` e a entrada de baixo nível `node apps/backend/dist/main.js` continuam sem aplicar migrations. Use os comandos de deploy acima na hospedagem; apontar o provedor diretamente para `dist/main.js` contorna deliberadamente o launcher e não executa essa etapa.

## Build, release e inicialização

Configure no ambiente protegido da hospedagem, sem versionar valores:

- `DATABASE_URL`: conexão PostgreSQL usada pela aplicação, com TLS e credenciais fornecidas pelo provedor.
- `DIRECT_URL` opcional: conexão direta para Prisma CLI e migrations quando a conexão da aplicação usa pooler. Deve corresponder ao mesmo banco lógico. Sem ela, a CLI usa `DATABASE_URL`; o backend sempre usa `DATABASE_URL`.
- As variáveis de autenticação existentes, incluindo segredo estável, issuer, audience e origens HTTPS exatas, conforme [authentication.md](authentication.md).
- `NODE_ENV=production`, `PORT` e `BUNKERCODE_CONTENT_DIR` absoluto apontando para o snapshot público imutável, conforme [publication.md](publication.md).

Sequência comum para uma plataforma que executa o repositório PNPM:

```sh
pnpm install --frozen-lockfile
pnpm build:public
# Preparar/incluir o snapshot autorizado antes de iniciar o serviço.
pnpm start
```

`build:public` também compila o backend, cujo build executa `prisma generate`. A geração não conecta ao banco e pode ocorrer sem URLs/segredos de banco disponíveis no builder. `migrate deploy` não gera o client: o artefato do build deve conservar o Prisma Client gerado. Prisma CLI 7.10.1 é dependência de runtime, com versão fixada, para que `install --prod`/pruning não remova a ferramenta exigida pela inicialização. O deploy não usa `npx` nem instala ferramentas pela rede durante o start.

O artefato de execução precisa incluir as dependências de produção com client gerado, `apps/backend/dist`, `apps/backend/prisma.config.ts`, `apps/backend/prisma/schema.prisma`, **todo o histórico** de `apps/backend/prisma/migrations` e `scripts/deploy-backend.mjs`, mantendo sua estrutura relativa. Também precisa do snapshot e do frontend público nos locais de hospedagem apropriados; não inclua `.env` local, conteúdo de autoria, bancos locais ou secrets na imagem.

Se a plataforma oferecer um release/pre-deploy job, prefira executar uma vez por versão:

```sh
pnpm deploy:migrate
```

Esse job usa `DIRECT_URL` quando configurada. O start continua fazendo a verificação idempotente antes de servir. Em uma topologia com credenciais separadas, conceda DDL ao job e valide também os privilégios exigidos por `migrate deploy` no usuário do start; o launcher sempre executa a CLI, e uma migration pendente sem privilégios impede o start. Não há opção que ignore uma falha para abrir o servidor.

## Segurança e concorrência

O launcher verifica uma conexão real com o banco já provisionado antes de chamar a CLI, evitando criação implícita de um banco por erro no nome. Não provisiona serviço, usuário ou volume, não lê `.env` e não gera/rotaciona secrets. URLs, credenciais, SQL e saída bruta da CLI não entram nos logs do launcher. Falhas de migration mostram somente código Prisma quando disponível e orientação operacional. Para diagnosticar em um terminal privado do ambiente correto, use `prisma migrate status` e os logs de operação com acesso restrito.

Prisma usa advisory locking ao aplicar migrations. Duas inicializações simultâneas são seguras para o histórico, mas o timeout desse lock é de 10 segundos: uma migração longa pode fazer outra réplica falhar e exigir retry pelo supervisor. Não desative o lock. Um release job único reduz essa competição. O launcher encaminha SIGINT/SIGTERM para o processo ativo e não abre o backend após cancelamento da etapa de migration.

Não se executa `migrate dev`, `db push`, reset, seed, down migration nem correção automática de histórico em produção. Novas mudanças são geradas e revisadas no desenvolvimento, testadas em banco descartável e incluídas no Git. Os arquivos já aplicados são imutáveis; uma correção requer nova migration versionada. Em rollout com réplicas antigas, mantenha compatibilidade de schema entre versões; rollback do código não desfaz automaticamente o banco. Migration falha ou banco preexistente sem histórico Prisma exige análise/baseline explícita, sem `resolve` automático.

## Limites e validação

Essa estrutura automatiza a etapa de migrations para PostgreSQL local ou hospedado, sem escolher ou configurar um provedor de nuvem. A URL real, TLS/CA, permissões, backups, job de release, snapshot e proxy continuam sendo configuração do ambiente de hospedagem. O backend preserva seu bind em loopback; a publicação externa depende da topologia de proxy já documentada. O runner JavaScript público continua desabilitado. A avaliação SQL é uma capacidade separada e opcional: exige imagem isolada, habilitação explícita e acervo privado fora do snapshot/host estático, conforme [configuração e recuperação SQL](sql-practice.md). O launcher de migrations não provisiona Docker nem habilita essa avaliação.

Os testes de startup cobrem duas inicializações concorrentes com migrations já aplicadas, falha real da CLI sem abertura HTTP, ausência de URL e proteção dos logs. O pacote de evidências da sprint complementa com bancos descartáveis vazios, upgrade com usuário/sessão existentes, repetição idempotente e histórico de migration falha. Nenhum teste deve usar `bunkercode_dev` como fixture.

Referências oficiais: [migrate deploy e advisory locking](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/development-and-production), [conexão direta e pooler](https://www.prisma.io/docs/postgres/database/connecting-to-your-database). O primeiro descreve também os limites: deploy aplica arquivos versionados, não detecta todo drift e não gera o client.

## Recuperação e backups

O Git recupera o código, conteúdo editorial e migrations que receberam commit. Um remoto como GitHub só guarda o que foi enviado para ele; não inclui alterações locais, `.env`, PostgreSQL ou rascunhos do navegador. Migrations recriam a estrutura do banco, não seus usuários, progresso e soluções.

| Material                                                         | Onde preservar                                                        | Como recuperar                                                                                     |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Código, Markdown/JSON, docs, lockfile e migrations               | Git e remoto do autor; cópia separada de trabalho ainda não commitado | Obter a revisão desejada e conferir `git status` antes de sobrepor qualquer arquivo                |
| `node_modules`, `.venv`, `dist`, `dist-public` e caches          | Normalmente não precisam de backup                                    | Reinstalar dependências e gerar os builds pelos comandos versionados                               |
| `.env`, `.env.local` e segredos de hospedagem                    | Cofre ou backup privado, separado do Git                              | Reconfigurar a partir de `.env.example` e dos valores privados preservados                         |
| PostgreSQL ativo                                                 | Backup privado do banco e procedimento de restauração testado         | Restaurar em banco separado, validar versão e histórico de migrations antes de apontar a aplicação |
| Rascunhos IndexedDB, journal de Studio e dados locais históricos | Cópia/exportação privada quando necessário                            | Recuperar o perfil/origem correta ou o texto exportado; a conta não sincroniza todos os rascunhos  |

Sequência recomendada após perda do ambiente:

1. Obtenha uma cópia do repositório e a revisão correspondente ao backup. Preserve qualquer trabalho local sobrevivente antes de restaurar por cima.
2. Reinstale Node/PNPM nas versões suportadas, execute `pnpm install --frozen-lockfile` e gere o Prisma Client. Reconstitua a configuração privada seguindo [configuração local](authentication.md). Não copie credenciais de produção para testes.
3. Para PostgreSQL, use um backup consistente, como um dump lógico em formato custom (`pg_dump -Fc`) ou o mecanismo de snapshots/PITR do provedor. Guarde também as informações necessárias para reconstruir permissões e extensões. Um dump de banco não preserva automaticamente papéis globais do cluster. Não copie o diretório de um servidor ativo como se fosse um backup válido.
4. Restaure primeiro em uma instância ou banco separado, sem sobrescrever o único exemplar. Valide acesso, contagens e fluxos de conta/progresso, além de conferir o histórico Prisma. Só depois decida quais migrations pendentes aplicar e faça a troca de conexão. Rollback do código não desfaz migrations.
5. Execute os builds e valide leitura, autenticação e uma recuperação de solução. Para publicação, reconstrua o snapshot autorizado e configure novamente proxy/origens. Um ensaio de restauração é o que demonstra a utilidade do backup.

Defina frequência, retenção, criptografia e cópia fora da máquina conforme a perda de trabalho aceitável. O repositório não automatiza backups nem garante recuperação pontual. `.bunkercode`, `.bunkerlab` e `.backendlab` permanecem ignorados e preservados; seus bancos aposentados não devem ser abertos ou migrados durante manutenção corrente. Dados pessoais, dumps e segredos não entram em ZIPs de evidências.

## Runner SQL após a Stabilization 01

Execução local em Worker não exige Docker. Check e Submit no servidor exigem sessão, `BUNKERCODE_SQL_RUNNER_ENABLED=1`, modo `BUNKERCODE_SQL_RUNNER_MODE` explícito, imagem compatível e acervo privado separado. A verificação anônima está bloqueada: o ambiente revisado tem daemon rootful controlado pelo usuário do backend via grupo Docker. UID sem privilégios dentro do container não reduz a autoridade do controlador. Não conceda esse acesso ao serviço público como configuração implícita.

Antes de produção ou abertura anônima, verificar identidade dedicada do serviço, fronteira de acesso ao runtime, cgroups efetivamente delegados, integridade da imagem, limites de entrada/tempo/conexões no proxy, capacidade, recuperação e cotas por instalação. A cota de seis avaliações/conta/minuto e o máximo de um container são locais ao processo; réplicas multiplicam a capacidade. O projeto não implementa proteção distribuída nem cotas anônimas. `BUNKERCODE_TRUSTED_PROXIES` aceita somente IPs/CIDRs explícitos; não confiar em `X-Forwarded-For` arbitrário. NAT exige política proporcional de orçamento por cliente. Detalhes e pendências da próxima etapa estão em [prática SQL](sql-practice.md). Nenhuma alteração do daemon, deploy ou declaração de prontidão foi realizada nesta etapa.

A avaliação SQL exige também as migrations `SqlQuota`/`SqlRunnerSlot`, o mesmo banco/segredo/socket/daemon nos processos do mesmo host (topologia suportada) e configuração explícita de modo/socket. Rootful é restrito a desenvolvimento; produção requer rootless e comprovação de identidade/delegação/limites no host. Reinício não apaga claims retidas: siga a [recuperação SQL](sql-practice.md#falha-e-recuperação), com todos os consumidores parados. Habilitar a flag não comprova prontidão e não libera avaliação anônima.
