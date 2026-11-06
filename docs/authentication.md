# Identidade, sessões e leitura pública

Esta sprint adiciona PostgreSQL/Prisma e autenticação à plataforma existente. Conteúdo continua canônico em Markdown/JSON; gratuidade não atribui licença open source. Não há progresso, preferências remotas, soluções persistidas ou dashboard individual. Não houve deploy público.

## Configuração local

Requisitos: Node **24.11+ na linha 24 ou 26+**, PNPM 11, PostgreSQL (validado com 16 e 17). Prisma Client, CLI e adapter-pg estão fixados em **7.10.1**; a escolha mantém NestJS CommonJS, sem migrar o monorepo para ESM ou adotar uma versão candidata do Prisma 8. A versão de Node efetivamente validada é 26.5.0.

1. `pnpm install`. A allowlist do PNPM permite os scripts oficiais de Prisma/engines e esbuild.
2. Reutilize o PostgreSQL e o banco persistente de desenvolvimento se já existirem. Confira `pg_isready` e a configuração local sem imprimir credenciais. Se não houver banco próprio, siga o procedimento abaixo; Docker é opcional. Nunca reutilize bancos SQLite históricos ou o banco descartável de testes.
3. Na raiz, execute `test -e .env || cp .env.example .env` e `chmod 600 .env`. Preencha `DATABASE_URL=postgresql://USUARIO:SENHA_URL_ENCODED@127.0.0.1:PORTA/BANCO` no editor com o banco correto. Caracteres especiais em usuário/senha devem usar percent-encoding. Gere e salve `BUNKERCODE_JWT_SECRET` uma vez com o comando abaixo, sem imprimir o segredo. Não copie credenciais para relatórios ou comandos compartilhados.
4. O backend de `pnpm dev` usa os flags nativos do Node `--env-file-if-exists`: `.env` e depois `.env.local`, sempre da raiz mesmo com `pnpm --filter`. A precedência é **shell/CI > .env.local > .env**, inclusive valor vazio explícito no shell. Os arquivos são opcionais quando o ambiente já está completo. Não execute `source`; os arquivos seguem o formato dotenv do Node, sem expansão de shell. Alterações nos arquivos exigem reiniciar `pnpm dev`.
5. `pnpm --filter @bunkercode/backend db:generate` gera o client. É necessário antes de compilar em instalação limpa.
6. `pnpm --filter @bunkercode/backend db:status:local` confere conexão e migrations. Se houver pendentes, revise o SQL em `apps/backend/prisma/migrations/` e execute `pnpm --filter @bunkercode/backend db:deploy:local`. Não usa `db push`, reset nem descarte de dados; migrations futuras ainda precisam de revisão.
7. `pnpm dev`, abra `http://127.0.0.1:5173` e crie sua conta.
8. Para conceder ADMIN a uma identidade já cadastrada: `pnpm --filter @bunkercode/backend admin:grant:local email-cadastrado`. O comando local usa acesso direto ao banco, não recebe senha, não cria conta e não tem equivalente HTTP. Recarregue a sessão para atualizar os controles visuais.

Geração inicial do segredo na raiz (recusa substituir um valor existente em qualquer arquivo local ou no shell):

```bash
node <<'NODE'
const fs = require('node:fs');
const { parseEnv } = require('node:util');
if (process.env.BUNKERCODE_JWT_SECRET || ['.env', '.env.local'].some(file =>
  fs.existsSync(file) && parseEnv(fs.readFileSync(file, 'utf8')).BUNKERCODE_JWT_SECRET))
  throw new Error('Segredo já configurado; preserve o valor existente.');
const source = fs.readFileSync('.env', 'utf8');
if (!/^BUNKERCODE_JWT_SECRET=.*$/m.test(source))
  throw new Error('Copie .env.example e mantenha o campo BUNKERCODE_JWT_SECRET.');
fs.writeFileSync('.env', source.replace(/^BUNKERCODE_JWT_SECRET=.*$/m,
  'BUNKERCODE_JWT_SECRET=' + require('node:crypto').randomBytes(48).toString('base64url')));
NODE
```

### PostgreSQL local: instalação inicial

Se o serviço já está instalado, use-o. `pg_lsclusters` (Debian/Ubuntu) e `pg_isready -h 127.0.0.1 -p 5432` verificam o estado. Se estiver parado, o proprietário deve iniciá-lo pelo mecanismo do sistema; o projeto não executa `sudo`, instala PostgreSQL nem muda serviços globais. Se ausente, instale PostgreSQL pelo gerenciador do sistema com um administrador antes de continuar.

Somente se ainda não existir banco BunkerCode, um administrador pode abrir `sudo -u postgres psql -X`. Confira `\du` e `\l` antes de criar; não duplique banco/usuário existente nem altere credenciais em uso. Para uma instalação nova:

```sql
CREATE ROLE bunkercode_dev LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
\password bunkercode_dev
CREATE DATABASE bunkercode_dev OWNER bunkercode_dev;
REVOKE ALL ON DATABASE bunkercode_dev FROM PUBLIC;
\q
```

`\password` solicita a senha sem colocá-la no histórico ou SQL compartilhado. O papel não precisa de SUPERUSER, CREATEDB ou CREATEROLE para executar a aplicação ou as migrations versionadas atuais. Preencha a URL local no editor e valide com `db:status:local`; a senha do sistema usada pelo `sudo` é diferente da senha PostgreSQL. Nenhum comando deve apagar bancos/volumes ou reutilizar banco de outro projeto. O servidor instalado é suficiente; não é necessário iniciar outra instância Docker.

### Separação de desenvolvimento, testes e produção

`dev`, `db:generate`, `db:migrate`, `db:deploy:local`, `db:status:local` e `admin:grant:local` carregam os arquivos locais explicitamente pelos scripts. `db:deploy`, `admin:grant`, `start`, `start:authoring` e `start:public` preservam a configuração exclusivamente fornecida pelo ambiente do operador; use um gerenciador de segredos no deploy. Não use comandos `*:local` em produção. A configuração Prisma 7 recebe `DATABASE_URL` do processo, sem loader implícito adicional.

`pnpm test` e E2E não carregam arquivos locais. Forneça explicitamente as cinco variáveis de autenticação apontando para **PostgreSQL exclusivo de testes**, com migrations aplicadas, e inclua as origens de teste. Nunca exporte a URL de desenvolvimento para rodar a suíte: as fixtures gravam contas/sessões. Não há geração automática de segredos ou aplicação de migrations no startup.

`db:migrate --name descricao` é reservado ao desenvolvimento do schema e exige shadow database/permissões correspondentes. Deploy usa `db:deploy` com ambiente explícito; desenvolvimento local usa `db:deploy:local`; migrations devem ser revistas antes de aplicação. `db:generate` não aplica migrations. O Prisma conecta no ciclo de inicialização do Nest e desconecta no encerramento; falhas impedem o servidor de ficar pronto. O banco precisa estar disponível também para autorizar requests privados.

Variáveis obrigatórias: `DATABASE_URL`, `BUNKERCODE_JWT_SECRET`, `BUNKERCODE_JWT_ISSUER`, `BUNKERCODE_JWT_AUDIENCE`, `BUNKERCODE_AUTH_ORIGINS` (origens exatas separadas por vírgula). Sem defaults secretos. `BUNKERCODE_PROFILE` continua obrigatório e definido pelos scripts. `NODE_ENV=production` exige origens HTTPS; origens HTTPS também ativam cookies Secure fora de produção. HTTP é aceito somente em loopback para desenvolvimento. `BUNKERCODE_STUDIO_ORIGIN` conserva as restrições locais anteriores.

## Modelos e contratos

`User`: UUID, e-mail único normalizado (trim/lowercase; check no PostgreSQL), hash de senha, papel `STUDENT | ADMIN`, data de criação. Cadastro aceita somente e-mail e senha, com validação explícita de objeto desconhecido; campos extras são rejeitados. No cadastro, senhas exigem pelo menos 6 caracteres e ao menos um número de 0 a 9. O formulário mostra os dois requisitos desde o início e atualiza cada item com verde e ícone de confirmação; o estado também é informado em texto para leitores de tela. O login continua aceitando senhas de contas anteriores sem exigir a nova composição. O limite técnico permanece em 128 caracteres e 512 bytes, sem truncamento/normalização silenciosa. Scrypt do Node usa N=131072, r=8, p=1, salt aleatório de 16 bytes e comparação em tempo constante. Foi escolhido como mecanismo consolidado equivalente a Argon2id, evitando addon nativo adicional. Login de conta inexistente executa o mesmo custo de hash.

`Session`: UUID, FK do usuário com cascade, hash SHA-256 único do refresh aleatório de 256 bits, hash anterior único, timestamps de criação/rotação, expiração absoluta em 30 dias e revogação. Índices por usuário/expiração. Há somente esses dois modelos e o enum Role; não há tabelas editoriais ou de aprendizagem.

`@OptionalIdentity()` é usado apenas nas leituras de conteúdo: sem Bearer, entrega a seleção publicada; com Bearer, valida assinatura e sessão antes de considerar o papel. Token inválido/expirado recebe 401, sem fallback administrativo. Os guards obrigatórios de Studio e execução permanecem ativos.

Identidade pública: `{ id, email, role }`. `AuthenticatedRequest.identity` contém essa projeção após `@RequireIdentity()`; `@RequireIdentity("ADMIN")` exige o papel atual. O backend deriva o UUID do JWT verificado e da sessão no banco. Nunca aceita `userId` do cliente como autorização.

## Fluxo HTTP

O navegador usa **mesma origem com proxy `/api`**. O proxy remove esse prefixo antes de encaminhar ao Nest. A tabela usa os caminhos diretos do backend:

| Endpoint                                                     | Resultado e autorização                                                       |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `POST /auth/register`                                        | 201; cria STUDENT e sessão; 400 inválido, 409 duplicado                       |
| `POST /auth/login`                                           | 200; credenciais válidas; 401 uniforme para credenciais incorretas            |
| `POST /auth/refresh`                                         | 200; cookie válido, rotação e novo access; 401 inválido                       |
| `POST /auth/logout`                                          | 204; revoga sessão correspondente e limpa cookie                              |
| `GET /auth/me`                                               | Bearer obrigatório; retorna `{ user }`                                        |
| `GET/HEAD /content/courses[/:id]`                            | Catálogo/metadados públicos conforme seleção do perfil                        |
| `GET/HEAD .../:id/lessons/:slug[/exercise]`                  | Sem conta ou STUDENT: seleção publicada; ADMIN: editorial apenas em authoring                         |
| `POST .../:id/lessons`, `PUT .../:id/lessons/:slug/markdown` | ADMIN atual e todas as proteções locais anteriores; ausentes no perfil public |
| `/practice/*`                                                | Sessão válida mais restrições anteriores; ausente no perfil public            |

JWT HS256 dura 10 minutos; payload é `sub`, `sid`, `iat`, `exp`, `iss`, `aud`. Assinatura, algoritmo, expiração, idade, emissor e audiência são conferidos. O access fica exclusivamente em memória e segue em Authorization Bearer. Não é salvo em localStorage, sessionStorage ou IndexedDB. O refresh nunca aparece no JSON HTTP: cookie host-only, HttpOnly, SameSite=Strict, Path=/api/auth, Secure em produção/HTTPS, expiração absoluta. O acesso direto a `/auth` com cookie automático de navegador não faz parte da topologia: o caminho externo é `/api/auth`.

Em refresh, uma transação PostgreSQL bloqueia a linha, troca o hash atual e guarda o imediatamente anterior. Reuso do anterior nos primeiros 10 segundos devolve o **mesmo sucessor**, sem nova rotação nem revogação. O sucessor é pseudorrandômico por HMAC-SHA256 com o segredo de configuração, domínio próprio, UUID da sessão e token anterior; a primeira emissão usa 32 bytes aleatórios. O servidor consegue rederivar o sucessor e conferir seu hash, sem armazenar texto puro ou cifra reversível. Isso recupera também respostas perdidas após commit no banco. Após essa janela, reuso do anterior revoga a sessão. Tokens mais antigos/desconhecidos são rejeitados; não há histórico ilimitado de famílias. O frontend compartilha uma promise por aba e usa Web Locks entre abas, para serializar refresh, entrada e saída. Uma resposta atrasada pode ser recuperada durante a janela; após 10 segundos com cookie anterior pode ser necessário novo login. A janela não prolonga a expiração absoluta. Essa política é uma decisão explícita de disponibilidade versus detecção de replay, não uma garantia contra roubo de cookie.

Após reload, uma tentativa de refresh recupera identidade; falha leva ao estado anônimo. Requests privados recebem no máximo um refresh e uma repetição, sem loop. BroadcastChannel comunica troca/logout às outras abas. Logout confirmado remove o token e desmonta o estado privado. Falha de rede no logout é apresentada e exige nova tentativa, sem alegar revogação. JWTs já emitidos permanecem criptograficamente válidos até expirar, mas **este backend consulta a sessão em cada request**, recusando imediatamente logout/revogação e alterações de papel. Não existe bypass administrativo por ambiente/header.

## Entrada e navegação

Login e cadastro usam o mesmo cabeçalho público, sem duplicar a marca pequena no topo. O visitante não recebe Entrar no cabeçalho dessas duas rotas; o link de alternância permanece junto ao formulário e conserva o destino validado. Nas outras rotas públicas, Entrar continua no local compartilhado. A composição reúne insígnia e wordmark lado a lado, exemplo de código e formulário. No celular, o exemplo é ocultado e a marca principal permanece acima dos campos. O cadastro mostra os requisitos de senha com confirmação individual em tempo real; ambos permitem revelar/ocultar a senha, colagem e autocomplete. Erros de campo recebem associação acessível e foco; erro de conexão preserva os valores. Recuperação de senha não é oferecida, pois não existe esse fluxo.

Entrar voluntariamente pelo leitor preserva `next` válido de curso/lição/Studio sob `/courses`; URLs externas e segmentos como `..` caem no catálogo; alternar login/cadastro conserva esse destino. Studio continua exigindo conta ADMIN. Logout troca o namespace local e mantém outras abas em leitura pública, sem expor o rascunho da conta anterior. Falha de refresh no reload mantém o visitante na lição publicada, sem loop para login.

A conta identifica a sessão. Rascunhos e atividade permanecem neste navegador, separados por identidade ou namespace anônimo; não são progresso sincronizado. Sem conta, a prática oferece escrita e formatação locais, sem consultar ou executar `/practice/*`. Em authoring, execução por STUDENT usa somente exercícios da seleção publicada; ADMIN pode usar exercícios editoriais. O perfil public continua sem runner para qualquer papel.

## Segurança e limites

Operações de autenticação por cookie exigem Origin exata autorizada, JSON e rejeitam Sec-Fetch-Site cross-site. CORS usa allowlist com credentials, nunca `*`. A topologia suporta aplicação e API na mesma origem; implantação cross-site exigiria redesenho explícito da política de cookie/CSRF. Erros JSON e exceções internas não retornam SQL, parâmetros, hashes ou credenciais. Conteúdo e auth usam no-store.

Login/cadastro: 30 tentativas por IP/15 minutos e 10 por e-mail/15 minutos, inclusive falhas; no máximo quatro hashes em andamento por processo, com a vaga retida até o cálculo terminar mesmo que a conexão HTTP seja encerrada. Refresh/logout: 120/IP/minuto. Contadores em memória são limitados a 20 mil chaves, expiram e não confiam em X-Forwarded-For. Reiniciar o processo reinicia os contadores. Antes de escala horizontal, use limitador compartilhado/gateway; atrás de proxy todos podem compartilhar o IP observado, exigindo configuração validada de proxy confiável e limites externos. Não há banimento permanente de conta.

Curso e lição não entram no bundle; filesystem não é servido estaticamente. Anônimos e estudantes recebem somente Markdown/exercícios publicados. A seleção filtra também catálogo, contagem, módulos e navegação anterior/próxima; conteúdo omitido retorna 404 em GET/HEAD. Em authoring, ADMIN pode ler o acervo editorial integral. No perfil public, nem ADMIN amplia o snapshot. Esconder controles React é conveniência, e o guard continua obrigatório. Conteúdo legitimamente exibido pode ser copiado; não há DRM, pagamento ou licenciamento implementado.

Dados locais existentes de prática, atividade, retomada e Studio passam a usar namespace por UUID para evitar exibição cruzada na UI. Dados antigos sem namespace permanecem intactos, sem importação automática. Isso não é sincronização nem uma barreira contra quem controla o navegador/DevTools. Temas e dimensões continuam preferências locais do navegador; não foram transformados em preferências de conta. Não há limpeza de bancos históricos.

Antes de publicação: validar HTTPS/proxy/cookies em host real, provisionar PostgreSQL com mínimo privilégio, backups/restauração, política de retenção de sessões e operação de segredos; revisar MFA obrigatório para administradores, recuperação de conta, confirmação de e-mail e limitação distribuída. Sem confirmação de e-mail, o cadastro não comprova propriedade do endereço. Studio permanece local; autenticação não autoriza sua exposição remota nem altera o isolamento do runner. Não se afirma prontidão para produção.

## Validação e Sprint 2

Execute com **banco exclusivo de testes**, nunca com identidades reais: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:browser` e `pnpm test:browser:public`. Gere o client/aplique migrations primeiro e forneça as variáveis explicitamente. As origens de E2E são 5184 e 5186; cada rodada usa um novo diretório de evidências. As fixtures criam contas aleatórias, não possuem credenciais fixas nem autenticam por mocks; o cenário `auth.spec.ts` começa anônimo. Contas de teste permanecem no banco dedicado até sua política externa de descarte; não existe limpeza destrutiva automática.

Na Sprint 2, cada tabela individual deverá ter FK `userId`; toda leitura/escrita deve filtrar pelo `request.identity.id`, incluindo constraints compostas adequadas por lição/exercício. Progresso, última lição, solução aprovada pelo Submit e preferências deverão ter contratos próprios e testes A/B de isolamento. Não aceite UUID arbitrário do corpo/query para selecionar proprietário. A presente sprint fornece identidade e sessão, sem antecipar essas tabelas ou afirmar que os rascunhos locais são persistência de conta.

Referências: [Prisma 7 e adapter PostgreSQL](https://docs.prisma.io/docs/orm/v7), [configuração Prisma](https://docs.prisma.io/docs/orm/reference/prisma-config-reference), [sessões OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet), [CSRF OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [hash de senha no NestJS](https://docs.nestjs.com/security/encryption-and-hashing).

## Diagnóstico de cursos com HTTP 500 no desenvolvimento

O Vite em `5173` encaminha `/api` ao backend em `3001`. Se somente o frontend estiver ativo, o proxy pode retornar 500 mesmo com manifestos válidos. Confira `curl -i http://127.0.0.1:3001/content/courses` e compare com `curl -i http://127.0.0.1:5173/api/content/courses`. Conexão recusada na primeira chamada indica API ausente, não erro de leitura do curso. Preencha os arquivos locais uma vez conforme os passos acima e inicie o backend (`pnpm --filter @bunkercode/backend dev`) se o frontend já estiver ativo; para iniciar ambos use `pnpm dev` na raiz. Nenhum comando de startup cria banco, aplica migrations ou concede acesso automaticamente. Não use a configuração efêmera de testes como configuração permanente de desenvolvimento.

O diagnóstico de startup informa a categoria sem imprimir erros brutos, SQL, stack ou valores: variáveis ausentes/inválidas, conteúdo/perfil, Studio, PostgreSQL (conexão, credenciais, banco inexistente, permissões ou tabelas/colunas ausentes) e porta ocupada. Uma falha desconhecida continua encerrando com código não zero e indica a documentação; detalhes sensíveis do driver ficam fora dos logs. Verifique `db:status:local` em terminal privado: o CLI Prisma pode mostrar nomes/host do banco configurado.

Se `3001` estiver ocupada, identifique o processo antes de encerrá-lo. Se escolher outra porta, forneça também `BUNKERCODE_API_URL=http://127.0.0.1:NOVA_PORTA` ao processo Vite pelo shell; o arquivo local do backend não é carregado no frontend. A porta de desenvolvimento do frontend continua `5173`.
