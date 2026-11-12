# Identidade, sessões e leitura pública

Esta sprint adiciona PostgreSQL/Prisma e autenticação à plataforma existente. Conteúdo continua canônico em Markdown/JSON; gratuidade não atribui licença open source. A Sprint 2 acrescenta progresso, preferências e soluções aprovadas por conta; veja [jornada persistente](learning-state.md). Não houve deploy público.

## Configuração local

Requisitos: Node **24.11+ na linha 24 ou 26+**, PNPM 11, PostgreSQL (validado com 16 e 17). Prisma Client, CLI e adapter-pg estão fixados em **7.10.1**; a escolha mantém NestJS CommonJS, sem migrar o monorepo para ESM ou adotar uma versão candidata do Prisma 8. A versão de Node efetivamente validada é 26.5.0.

1. `pnpm install`. A allowlist do PNPM permite os scripts oficiais de Prisma/engines e esbuild.
2. Reutilize o PostgreSQL e o banco persistente de desenvolvimento se já existirem. Confira `pg_isready` e a configuração local sem imprimir credenciais. Se não houver banco próprio, siga o procedimento abaixo; Docker é opcional. Nunca reutilize bancos SQLite históricos ou o banco descartável de testes.
3. Na raiz, execute `test -e .env || cp .env.example .env` e `chmod 600 .env`. Preencha `DATABASE_URL=postgresql://USUARIO:SENHA_URL_ENCODED@127.0.0.1:PORTA/BANCO` no editor com o banco correto. Caracteres especiais em usuário/senha devem usar percent-encoding. Gere e salve `BUNKERCODE_JWT_SECRET` uma vez com o comando abaixo, sem imprimir o segredo. Não copie credenciais para relatórios ou comandos compartilhados.
4. O backend de `pnpm dev` usa os flags nativos do Node `--env-file-if-exists`: `.env` e depois `.env.local`, sempre da raiz mesmo com `pnpm --filter`. A precedência é **shell/CI > .env.local > .env**, inclusive valor vazio explícito no shell. Os arquivos são opcionais quando o ambiente já está completo. Não execute `source`; os arquivos seguem o formato dotenv do Node, sem expansão de shell. Alterações nos arquivos exigem reiniciar `pnpm dev`.
5. `pnpm --filter @bunkercode/backend db:generate` gera o client. É necessário antes de compilar em instalação limpa.
6. Confira o banco com `pnpm --filter @bunkercode/backend db:status:local` e revise novas migrations em `apps/backend/prisma/migrations/`. Ao iniciar, `pnpm dev` aplica automaticamente as migrations versionadas pendentes com `prisma migrate deploy`, antes de abrir a API. Para antecipar essa etapa sem iniciar o site, use `pnpm --filter @bunkercode/backend db:deploy:local`. Não usa `db push`, reset, seed ou correção automática de histórico.
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

`dev`, `db:generate`, `db:migrate`, `db:deploy:local`, `db:status:local` e `admin:grant:local` carregam os arquivos locais explicitamente pelos scripts. `db:deploy`, `admin:grant`, `start`, `start:authoring` e `start:public` preservam a configuração exclusivamente fornecida pelo ambiente do operador; use um gerenciador de segredos no deploy. Não use comandos `*:local` em produção. A configuração Prisma 7 recebe `DIRECT_URL`, quando fornecida, ou `DATABASE_URL` do processo, sem loader implícito adicional; a aplicação usa `DATABASE_URL`.

`pnpm test` e E2E não carregam arquivos locais. Forneça explicitamente as cinco variáveis de autenticação apontando para **PostgreSQL exclusivo de testes**, com migrations aplicadas, e inclua as origens de teste. Nunca exporte a URL de desenvolvimento para rodar a suíte: as fixtures gravam contas/sessões. Não há geração automática de segredos. Os launchers de desenvolvimento e deploy aplicam migrations antes de abrir HTTP; somente as entradas diretas, como `start:authoring` e `dist/main.js`, ficam sem essa etapa. Veja [deployment.md](deployment.md).

`db:migrate --name descricao` é reservado ao desenvolvimento do schema e exige shadow database/permissões correspondentes. Deploy usa `db:deploy` com ambiente explícito; desenvolvimento local usa `db:deploy:local`; migrations devem ser revistas antes de aplicação. `db:generate` não aplica migrations. O Prisma conecta no ciclo de inicialização do Nest e desconecta no encerramento; falhas impedem o servidor de ficar pronto. O banco precisa estar disponível também para autorizar requests privados.

Variáveis obrigatórias: `DATABASE_URL`, `BUNKERCODE_JWT_SECRET`, `BUNKERCODE_JWT_ISSUER`, `BUNKERCODE_JWT_AUDIENCE`, `BUNKERCODE_AUTH_ORIGINS` (origens exatas separadas por vírgula). Sem defaults secretos. `BUNKERCODE_PROFILE` continua obrigatório e definido pelos scripts. `NODE_ENV=production` exige origens HTTPS; origens HTTPS também ativam cookies Secure fora de produção. HTTP é aceito somente em loopback para desenvolvimento. `BUNKERCODE_STUDIO_ORIGIN` conserva as restrições locais anteriores.

## Modelos e contratos

`User`: UUID, e-mail único normalizado, `username` opcional no banco e único quando presente, hash de senha, papel `STUDENT | ADMIN` e data de criação. Novos cadastros exigem e-mail, usuário e senha; campos extras são rejeitados. O usuário é normalizado com trim/minúsculas e aceita de 3 a 30 caracteres ASCII `a–z`, `0–9` ou `_`. A unicidade e a forma canônica são garantidas também no PostgreSQL. Login aceita e-mail ou usuário; a identidade pública continua `{ id, email, role }`.

A senha de cadastro exige exatamente três mínimos: 6 pontos de código Unicode, uma letra ASCII `A–Z/a–z` e um número ASCII `0–9`. Outros caracteres são aceitos, mas não substituem letra/número. Mantêm-se os limites de 128 pontos de código/512 bytes, sem truncamento ou normalização silenciosa. Senhas antigas continuam aceitas no login, independentemente dos novos mínimos. Scrypt mantém N=131072, r=8, p=1, salt aleatório de 16 bytes e comparação em tempo constante. Login de conta inexistente executa o mesmo custo de hash.

`Session`: UUID, FK do usuário com cascade, hash SHA-256 único do refresh aleatório de 256 bits, hash anterior único, timestamps de criação/rotação, expiração absoluta em 30 dias e revogação. Índices por usuário/expiração. Esses são os modelos de identidade. `AuthThrottle` mantém os limites de tentativas de autenticação. A jornada acrescenta `LearningPreferences`, `LessonCompletion`, `LastLessonVisit` e `ApprovedSolution`; veja os nomes e campos atuais em `apps/backend/prisma/schema.prisma` e o [guia de aprendizagem](learning-state.md). Não há tabelas editoriais.

`@OptionalIdentity()` é usado apenas nas leituras de conteúdo: sem Bearer, entrega a seleção publicada; com Bearer, valida assinatura e sessão antes de considerar o papel. Token inválido/expirado recebe 401, sem fallback administrativo. Os guards obrigatórios de Studio e execução permanecem ativos.

Identidade pública: `{ id, email, role }`. `AuthenticatedRequest.identity` contém essa projeção após `@RequireIdentity()`; `@RequireIdentity("ADMIN")` exige o papel atual. O backend deriva o UUID do JWT verificado e da sessão no banco. Nunca aceita `userId` do cliente como autorização.

## Cadastro, confirmação e migração de usuário

O formulário contém exatamente quatro campos, nesta ordem: **E-mail**, **Usuário**, **Senha**, **Confirmar senha**. A única orientação permanente abaixo de Senha é a lista “Pelo menos 6 caracteres”, “Pelo menos 1 letra” e “Pelo menos 1 número”. Os estados são independentes e imediatos, com verde/ícone e texto acessível para cumprimento; remover um requisito devolve o estado neutro. Login mostra somente “E-mail ou usuário” e “Senha”, sem lista ou confirmação. Não há conselhos, medidor de força ou tooltip de senha.

A confirmação deve ser idêntica à senha e é validada no cliente, sem envio à API, logs ou persistência. Falta/divergência impede a requisição, mantém o foco no campo correto e é corrigida conforme a edição. Os dois campos de senha começam mascarados e oferecem controles próprios de visibilidade. Um bloqueio síncrono evita submissões duplicadas.

`POST /auth/register` recebe somente `{ email, username, password }`. O backend valida os três mínimos da senha e o formato do usuário. HTTP 400 usa códigos `INVALID_EMAIL`, `INVALID_USERNAME` ou `INVALID_PASSWORD`; HTTP 409 usa `EMAIL_TAKEN` ou `USERNAME_TAKEN`. O cliente apresenta mensagens controladas no campo correspondente, sem exibir erros brutos. Hash, tokens e permissões anteriores permanecem iguais; os limites compartilhados são descritos abaixo. A lista de bloqueio e seu gerador da política anterior foram aposentados por decisão expressa do produto; esta regra não afirma conformidade NIST.

A migration `20261106000000_username` acrescenta somente a coluna nullable `User.username`, o índice único e um CHECK de formato/minúsculas. Ela preserva todos os registros e não atribui nomes arbitrários: contas anteriores permanecem com `NULL` e continuam autenticando por e-mail. Vários valores NULL são permitidos. Novos cadastros exigem o campo pela validação do serviço. Não é necessário backfill para compatibilidade; eventual escolha de nome por contas antigas exige uma necessidade futura e não faz parte desta entrega. Não existe edição de perfil; contas sem usuário continuam entrando por e-mail.

Revise o SQL e aplique `pnpm --filter @bunkercode/backend db:deploy:local` no desenvolvimento e `db:deploy` com ambiente explícito no deploy. Gere novamente o client com `db:generate`. Não use reset, db push ou recriação de banco. A migration é transacional e falha sem aplicar o DDL se não conseguir o lock em 5 segundos; investigue o consumidor antes de repetir.

## Login por e-mail ou usuário

O contrato canônico de `POST /auth/login` é `{ identifier, password }`. O campo da interface chama-se **E-mail ou usuário**, é texto com autocomplete `username` e preserva o controle de visibilidade da senha. `identifier` recebe o mesmo trim/minúsculas do cadastro; presença de `@` seleciona e-mail, ausência seleciona username. Não há alteração do nome armazenado. A API mantém `{ email, password }` para clientes anteriores; ambos os campos juntos, campos extras, tipos incorretos e limites excedidos são recusados. A chave legada é somente um alias do identificador, não uma segunda tentativa de autenticação.

Existe um único verificador de senha. Conta ausente executa scrypt dummy com os mesmos parâmetros. Falhas de credenciais válidas como entrada retornam sempre 401 e **“Não foi possível entrar. Confira seus dados.”**, sem informar existência ou formato do identificador. Payload estruturalmente inválido retorna 400; limite retorna 429. Não há endpoint público de descoberta. O cliente usa a mensagem genérica, mostra o prazo de Retry-After em 429 e desabilita reenvio durante a espera, sem tentativas automáticas.

A migration `20261106010000_auth_throttle` acrescenta apenas `AuthThrottle` para contadores compartilhados. Login por username, por si, não exige mudança em User/Session: a coluna e o índice anteriores são reutilizados. Aplique a migration antes de iniciar o código atualizado; a prontidão verifica a tabela. Registros de usuários, senhas e sessões não são regravados.

## Fluxo HTTP

O navegador usa **mesma origem com proxy `/api`**. O proxy remove esse prefixo antes de encaminhar ao Nest. A tabela usa os caminhos diretos do backend:

| Endpoint                                                     | Resultado e autorização                                                                        |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `POST /auth/register`                                        | 201; recebe e-mail/usuário/senha, cria STUDENT e sessão; 400 inválido, 409 duplicado           |
| `POST /auth/login`                                           | 200; identificador/senha válidos; 401 uniforme para credenciais incorretas, 429 para limitação |
| `POST /auth/refresh`                                         | 200; cookie válido, rotação e novo access; 401 inválido                                        |
| `POST /auth/logout`                                          | 204; revoga sessão correspondente e limpa cookie                                               |
| `GET /auth/me`                                               | Bearer obrigatório; retorna `{ user }`                                                         |
| `GET/HEAD /content/courses[/:id]`                            | Catálogo/metadados públicos conforme seleção do perfil                                         |
| `GET/HEAD .../:id/lessons/:slug[/exercise]`                  | Sem conta ou STUDENT: seleção publicada; ADMIN: editorial apenas em authoring                  |
| `POST .../:id/lessons`, `PUT .../:id/lessons/:slug/markdown` | ADMIN atual e todas as proteções locais anteriores; ausentes no perfil public                  |
| `/practice/*`                                                | Sessão válida mais restrições anteriores; ausente no perfil public                             |

JWT HS256 dura 10 minutos; payload é `sub`, `sid`, `iat`, `exp`, `iss`, `aud`. Assinatura, algoritmo, expiração, idade, emissor e audiência são conferidos. O access fica exclusivamente em memória e segue em Authorization Bearer. Não é salvo em localStorage, sessionStorage ou IndexedDB. O refresh nunca aparece no JSON HTTP: cookie host-only, HttpOnly, SameSite=Strict, Path=/api/auth, Secure em produção/HTTPS, expiração absoluta. O acesso direto a `/auth` com cookie automático de navegador não faz parte da topologia: o caminho externo é `/api/auth`.

Em refresh, uma transação PostgreSQL bloqueia a linha, troca o hash atual e guarda o imediatamente anterior. Reuso do anterior nos primeiros 10 segundos devolve o **mesmo sucessor**, sem nova rotação nem revogação. O sucessor é pseudorrandômico por HMAC-SHA256 com o segredo de configuração, domínio próprio, UUID da sessão e token anterior; a primeira emissão usa 32 bytes aleatórios. O servidor consegue rederivar o sucessor e conferir seu hash, sem armazenar texto puro ou cifra reversível. Isso recupera também respostas perdidas após commit no banco. Após essa janela, reuso do anterior revoga a sessão. Tokens mais antigos/desconhecidos são rejeitados; não há histórico ilimitado de famílias. O frontend compartilha uma promise por aba e usa Web Locks entre abas, para serializar refresh, entrada e saída. Uma resposta atrasada pode ser recuperada durante a janela; após 10 segundos com cookie anterior pode ser necessário novo login. A janela não prolonga a expiração absoluta. Essa política é uma decisão explícita de disponibilidade versus detecção de replay, não uma garantia contra roubo de cookie.

Após reload, uma tentativa de refresh recupera identidade; falha leva ao estado anônimo. Requests privados recebem no máximo um refresh e uma repetição, sem loop. BroadcastChannel comunica troca/logout às outras abas. Logout confirmado remove o token e desmonta o estado privado. Falha de rede no logout é apresentada e exige nova tentativa, sem alegar revogação. JWTs já emitidos permanecem criptograficamente válidos até expirar, mas **este backend consulta a sessão em cada request**, recusando imediatamente logout/revogação e alterações de papel. Não existe bypass administrativo por ambiente/header.

## Entrada e navegação

Login e cadastro usam o mesmo cabeçalho público, sem duplicar a marca pequena no topo. O visitante não recebe Entrar no cabeçalho dessas duas rotas; o link de alternância permanece junto ao formulário e conserva o destino validado. Nas outras rotas públicas, Entrar continua no local compartilhado. A composição reúne insígnia e wordmark lado a lado, exemplo de código e formulário. No celular, o exemplo é ocultado e a marca principal permanece acima dos campos. O cadastro mostra os três requisitos de senha em tempo real e exige confirmação; ambos permitem revelar/ocultar a senha, colagem e autocomplete. Erros de campo recebem associação acessível e foco; erro de conexão preserva os valores. Recuperação de senha não é oferecida, pois não existe esse fluxo.

Entrar voluntariamente pelo leitor preserva `next` válido de curso/lição/Studio sob `/courses`; URLs externas e segmentos como `..` caem no catálogo; alternar login/cadastro conserva esse destino. Studio continua exigindo conta ADMIN. Logout troca o namespace local e mantém outras abas em leitura pública, sem expor o rascunho da conta anterior. Falha de refresh no reload mantém o visitante na lição publicada, sem loop para login.

A conta identifica a sessão. Rascunhos e atividade permanecem neste navegador, separados por identidade ou namespace anônimo; não são progresso sincronizado. Sem conta, a prática oferece escrita e formatação locais, sem consultar ou executar `/practice/*`. Em authoring, execução por STUDENT usa somente exercícios da seleção publicada; ADMIN pode usar exercícios editoriais. O perfil public continua sem runner para qualquer papel.

## Segurança e limites

Operações de autenticação por cookie exigem Origin exata autorizada, JSON e rejeitam Sec-Fetch-Site cross-site. CORS usa allowlist com credentials, nunca `*`. A topologia suporta aplicação e API na mesma origem; implantação cross-site exigiria redesenho explícito da política de cookie/CSRF. Erros JSON e exceções internas não retornam SQL, parâmetros, hashes ou credenciais. Conteúdo e auth usam no-store.

Os limites são independentes e compartilhados no PostgreSQL, inclusive entre processos e reinícios, desde que usem o mesmo banco e segredo. Contam tentativas admitidas, inclusive sucessos, para proteger também o trabalho caro de credenciais válidas; não há reset por sucesso nem bloqueio permanente. A janela fixa começa na primeira tentativa. Requisições já bloqueadas não prolongam o prazo.

| Dimensão                                                 | Limite inicial | Janela     |
| -------------------------------------------------------- | -------------- | ---------- |
| Login por IP                                             | 120            | 15 minutos |
| Login por identificador normalizado                      | 10             | 15 minutos |
| Login por UUID de conta, comum aos aliases               | 10             | 15 minutos |
| Cadastro por IP                                          | 60             | 1 hora     |
| Cadastro por e-mail e por usuário, independentemente     | 5              | 1 hora     |
| Refresh por IP                                           | 600            | 1 minuto   |
| Refresh por sessão, comum às rotações                    | 120            | 1 minuto   |
| Logout, me e demais caminhos de auth, por IP e categoria | 300            | 1 minuto   |

IP é verificado antes da consulta de identidade/hash; os limites por identificador/conta/cadastro são anteriores ao hash, e refresh por sessão antecede rotação. Contas ausentes também possuem contador de identificador. `BUNKERCODE_AUTH_LOGIN_IP_LIMIT` e `BUNKERCODE_AUTH_REGISTER_IP_LIMIT` permitem ajustar os limites de IP entre 1 e 10000, mantendo os demais independentes. Os valores padrão dão mais espaço a NATs; ainda podem exigir ajuste conforme uso real.

`AuthThrottle` armazena somente chave HMAC-SHA256 com domínio próprio, contagem e expiração. Uma transação curta com advisory lock atualiza as dimensões atomicamente; hashes ficam fora desse lock. O tempo vem do epoch do banco, sem depender do fuso do driver/relógio do host. Há teto de 20 mil chaves, limpeza de até 100 expiradas por operação e falha fechada em capacidade esgotada. Não existe job ou infraestrutura adicional. Espera de transação/lock é limitada; contenção controlada responde 429. O lock global é uma escolha simples para este volume: precisa de medição/revisão antes de carga alta, não é promessa de escala ilimitada.

Em cada processo, no máximo 32 verificações de contadores e 16 fluxos de login/cadastro ficam em andamento, sem fila própria. A vaga de fluxo só é liberada quando a operação termina, mesmo com desconexão HTTP. Mantém-se o teto de quatro hashes scrypt simultâneos, sem reduzir N=131072/r=8/p=1; a vaga do hash permanece ocupada até o cálculo terminar. Corpos auth são limitados a 4 KiB. Sobrecarga retorna erro controlado e permite recuperação. Não há garantia de memória do processo contra todo tráfego de rede: limites de conexões, TLS e volume bruto continuam responsabilidades do proxy/host.

Por padrão Express ignora X-Forwarded-For. `BUNKERCODE_TRUSTED_PROXIES` aceita apenas IPs/CIDRs explícitos separados por vírgula, sem contagem de saltos/wildcards. Configure somente proxies administrados que limpam cabeçalhos externos e impeça acesso direto que os contorne. Express percorre a cadeia a partir do socket até o primeiro endereço não confiável; um prefixo forjado antes desse endereço não muda o cliente. Vite local pode compartilhar o loopback observado; não habilite confiança global para corrigir isso. Valide a topologia HTTPS real antes da publicação.

Limites por conta podem ser usados para causar indisponibilidade temporária à vítima; a janela finita evita lockout permanente. Limites correlacionados entre aliases podem revelar correlação de identificadores sob ataque ativo, apesar de mensagens genéricas e trabalho de hash equivalente. Cadastro mantém EMAIL_TAKEN/USERNAME_TAKEN por decisão de UX e portanto permite enumeração limitada; quotas por IP/alvo reduzem automação sem eliminá-la. Não há garantia estatística de indistinguibilidade temporal, proteção contra botnet ilimitada ou conformidade integral de segurança. Nenhum payload, senha ou token foi adicionado a logs; contadores genéricos/Retry-After evitam logs de alto volume controlados por atacante.

Curso e lição não entram no bundle; filesystem não é servido estaticamente. Anônimos e estudantes recebem somente Markdown/exercícios publicados. A seleção filtra também catálogo, contagem, módulos e navegação anterior/próxima; conteúdo omitido retorna 404 em GET/HEAD. Em authoring, ADMIN pode ler o acervo editorial integral. No perfil public, nem ADMIN amplia o snapshot. Esconder controles React é conveniência, e o guard continua obrigatório. Conteúdo legitimamente exibido pode ser copiado; não há DRM, pagamento ou licenciamento implementado.

Dados locais existentes de prática, atividade, retomada e Studio passam a usar namespace por UUID para evitar exibição cruzada na UI. Dados antigos sem namespace permanecem intactos, sem importação automática. Isso não é sincronização nem uma barreira contra quem controla o navegador/DevTools. Temas e dimensões continuam preferências locais do navegador; não foram transformados em preferências de conta. Não há limpeza de bancos históricos.

Antes de publicação: validar HTTPS/proxy/cookies em host real, provisionar PostgreSQL com mínimo privilégio, backups/restauração, política de retenção de sessões e operação de segredos; revisar MFA obrigatório para administradores, recuperação de conta, confirmação de e-mail e limites de borda para volume alto. Sem confirmação de e-mail, o cadastro não comprova propriedade do endereço. Studio permanece local; autenticação não autoriza sua exposição remota nem altera o isolamento do runner. Não se afirma prontidão para produção.

## Validação e Sprint 2

Execute com **banco exclusivo de testes**, nunca com identidades reais: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:browser` e `pnpm test:browser:public`. Gere o client/aplique migrations primeiro e forneça as variáveis explicitamente. As origens de E2E são 5184 e 5186; cada rodada usa um novo diretório de evidências. As fixtures criam contas aleatórias, não possuem credenciais fixas nem autenticam por mocks; o cenário `auth.spec.ts` começa anônimo. Contas de teste permanecem no banco dedicado até sua política externa de descarte; não existe limpeza destrutiva automática.

Na Sprint 2, cada tabela individual deverá ter FK `userId`; toda leitura/escrita deve filtrar pelo `request.identity.id`, incluindo constraints compostas adequadas por lição/exercício. Progresso, última lição, solução aprovada pelo Submit e preferências deverão ter contratos próprios e testes A/B de isolamento. Não aceite UUID arbitrário do corpo/query para selecionar proprietário. A presente sprint fornece identidade e sessão, sem antecipar essas tabelas ou afirmar que os rascunhos locais são persistência de conta.

Referências: [Prisma 7 e adapter PostgreSQL](https://docs.prisma.io/docs/orm/v7), [configuração Prisma](https://docs.prisma.io/docs/orm/reference/prisma-config-reference), [sessões OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet), [CSRF OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [hash de senha no NestJS](https://docs.nestjs.com/security/encryption-and-hashing).

## Diagnóstico de cursos com HTTP 500 no desenvolvimento

O Vite em `5173` encaminha `/api` ao backend em `3001`. Se somente o frontend estiver ativo, o proxy pode retornar 500 mesmo com manifestos válidos. Confira `curl -i http://127.0.0.1:3001/content/courses` e compare com `curl -i http://127.0.0.1:5173/api/content/courses`. Conexão recusada na primeira chamada indica API ausente, não erro de leitura do curso. Preencha os arquivos locais uma vez conforme os passos acima e inicie o backend (`pnpm --filter @bunkercode/backend dev`) se o frontend já estiver ativo; para iniciar ambos use `pnpm dev` na raiz.

`pnpm dev` (e `pnpm --filter @bunkercode/backend dev`) verifica a conexão com o banco existente, aplica migrations versionadas pendentes e só então inicia o watcher TypeScript. Falha de conexão ou migration encerra o launcher; pela raiz, o frontend também é encerrado. Os comandos não criam banco nem concedem acesso. Reiniciar com o histórico atualizado não reaplica migrations concluídas. Se adicionar uma migration durante uma sessão, reinicie `pnpm dev`; o watcher não acompanha mudanças do schema ou do histórico. Criar novas migrations a partir do schema continua sendo uma ação explícita com `db:migrate`, seguida de revisão. Não use a configuração efêmera de testes como configuração permanente de desenvolvimento.

O diagnóstico de startup informa a categoria sem imprimir erros brutos, SQL, stack ou valores: variáveis ausentes/inválidas, conteúdo/perfil, Studio, PostgreSQL (conexão, credenciais, banco inexistente, permissões ou tabelas/colunas ausentes) e porta ocupada. Uma falha desconhecida continua encerrando com código não zero e indica a documentação; detalhes sensíveis do driver ficam fora dos logs. Verifique `db:status:local` em terminal privado: o CLI Prisma pode mostrar nomes/host do banco configurado.

Se `3001` estiver ocupada, identifique o processo antes de encerrá-lo. Se escolher outra porta, forneça também `BUNKERCODE_API_URL=http://127.0.0.1:NOVA_PORTA` ao processo Vite pelo shell; o arquivo local do backend não é carregado no frontend. A porta de desenvolvimento do frontend continua `5173`.
