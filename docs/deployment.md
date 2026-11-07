# Migrations automáticas no deploy

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

Essa estrutura automatiza a etapa de migrations para PostgreSQL local ou hospedado, sem escolher ou configurar um provedor de nuvem. A URL real, TLS/CA, permissões, backups, job de release, snapshot e proxy continuam sendo configuração do ambiente de hospedagem. O backend preserva seu bind em loopback; a publicação externa depende da topologia de proxy já documentada. O runner público continua desabilitado.

Os testes de startup cobrem duas inicializações concorrentes com migrations já aplicadas, falha real da CLI sem abertura HTTP, ausência de URL e proteção dos logs. O pacote de evidências da sprint complementa com bancos descartáveis vazios, upgrade com usuário/sessão existentes, repetição idempotente e histórico de migration falha. Nenhum teste deve usar `bunkercode_dev` como fixture.

Referências oficiais: [migrate deploy e advisory locking](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/development-and-production), [conexão direta e pooler](https://www.prisma.io/docs/postgres/database/connecting-to-your-database). O primeiro descreve também os limites: deploy aplica arquivos versionados, não detecta todo drift e não gera o client.
