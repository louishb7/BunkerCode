# Identidade, sessões e leitura pública

Esta sprint adiciona PostgreSQL/Prisma e autenticação à plataforma existente. Conteúdo continua canônico em Markdown/JSON; gratuidade não atribui licença open source. Não há progresso, preferências remotas, soluções persistidas ou dashboard individual. Não houve deploy público.

## Configuração local

Requisitos: Node **24.11+ na linha 24 ou 26+**, PNPM 11, PostgreSQL (validado com 17). Prisma Client, CLI e adapter-pg estão fixados em **7.10.1**; a escolha mantém NestJS CommonJS, sem migrar o monorepo para ESM ou adotar uma versão candidata do Prisma 8. A versão de Node efetivamente validada é 26.5.0.

1. `pnpm install`. A allowlist do PNPM permite os scripts oficiais de Prisma/engines e esbuild.
2. Provisione um PostgreSQL local próprio, com usuário/senha únicos e banco exclusivo. Para desenvolvimento pode usar Docker, expondo a porta somente em `127.0.0.1`; mantenha dados persistentes em volume próprio se quiser conservar contas. Nunca reutilize os bancos SQLite históricos.
3. Copie `.env.example` para `.env`, preencha `DATABASE_URL=postgresql://USUARIO:SENHA@127.0.0.1:PORTA/BANCO` com valores reais e gere `BUNKERCODE_JWT_SECRET` com pelo menos 32 bytes aleatórios (`node -e 'console.log(require("node:crypto").randomBytes(48).toString("base64url"))'`). Não copie segredos para relatórios ou comandos compartilhados. A aplicação não carrega `.env` implicitamente.
4. Exporte a configuração na sessão Bash: `set -a; source .env; set +a`. O arquivo deve conter valores devidamente escapados para shell. Use um gerenciador de segredos no deploy.
5. `pnpm --filter @bunkercode/backend db:generate` gera o client. É necessário antes de compilar em instalação limpa.
6. `pnpm --filter @bunkercode/backend db:deploy` aplica migrations versionadas a um banco novo/existente. Não usa `db push`.
7. `pnpm dev`, abra `http://127.0.0.1:5173` e crie sua conta.
8. Para conceder ADMIN a uma identidade já cadastrada: `pnpm --filter @bunkercode/backend admin:grant email-cadastrado`. O comando local usa acesso direto ao banco, não recebe senha, não cria conta e não tem equivalente HTTP. Recarregue a sessão para atualizar os controles visuais.

`db:migrate --name descricao` é reservado ao desenvolvimento do schema e exige shadow database/permissões correspondentes. Deploy usa somente `db:deploy`; migrations devem ser revistas antes de aplicação. `db:generate` não aplica migrations. O Prisma conecta no ciclo de inicialização do Nest e desconecta no encerramento; falhas impedem o servidor de ficar pronto. O banco precisa estar disponível também para autorizar requests privados.

Variáveis obrigatórias: `DATABASE_URL`, `BUNKERCODE_JWT_SECRET`, `BUNKERCODE_JWT_ISSUER`, `BUNKERCODE_JWT_AUDIENCE`, `BUNKERCODE_AUTH_ORIGINS` (origens exatas separadas por vírgula). Sem defaults secretos. `BUNKERCODE_PROFILE` continua obrigatório e definido pelos scripts. `NODE_ENV=production` exige origens HTTPS; origens HTTPS também ativam cookies Secure fora de produção. HTTP é aceito somente em loopback para desenvolvimento. `BUNKERCODE_STUDIO_ORIGIN` conserva as restrições locais anteriores.

## Modelos e contratos

`User`: UUID, e-mail único normalizado (trim/lowercase; check no PostgreSQL), hash de senha, papel `STUDENT | ADMIN`, data de criação. Cadastro aceita somente e-mail e senha, com validação explícita de objeto desconhecido; campos extras são rejeitados. Senhas têm 12–128 caracteres, até 512 bytes, sem truncamento/normalização silenciosa. Scrypt do Node usa N=131072, r=8, p=1, salt aleatório de 16 bytes e comparação em tempo constante. Foi escolhido como mecanismo consolidado equivalente a Argon2id, evitando addon nativo adicional. Login de conta inexistente executa o mesmo custo de hash.

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

Login e cadastro têm composição própria com a insígnia existente, área editorial e formulário. No celular, a área editorial é ocultada para priorizar os campos. Apenas cadastro apresenta requisitos de criação de senha; ambos permitem revelar/ocultar a senha, colagem e autocomplete. Erros de campo recebem associação acessível e foco; erro de conexão preserva os valores. Recuperação de senha não é oferecida, pois não existe esse fluxo.

Entrar voluntariamente pelo leitor preserva `next` válido de curso/lição/Studio sob `/courses`; URLs externas e segmentos como `..` caem no catálogo; alternar login/cadastro conserva esse destino. Studio continua exigindo conta ADMIN. Logout troca o namespace local e mantém outras abas em leitura pública, sem expor o rascunho da conta anterior. Falha de refresh no reload mantém o visitante na lição publicada, sem loop para login.

A conta identifica a sessão. Rascunhos e atividade permanecem neste navegador, separados por identidade ou namespace anônimo; não são progresso sincronizado. Sem conta, a prática oferece escrita e formatação locais, sem consultar ou executar `/practice/*`. Em authoring, execução por STUDENT usa somente exercícios da seleção publicada; ADMIN pode usar exercícios editoriais. O perfil public continua sem runner para qualquer papel.

## Segurança e limites

Operações de autenticação por cookie exigem Origin exata autorizada, JSON e rejeitam Sec-Fetch-Site cross-site. CORS usa allowlist com credentials, nunca `*`. A topologia suporta aplicação e API na mesma origem; implantação cross-site exigiria redesenho explícito da política de cookie/CSRF. Erros JSON e exceções internas não retornam SQL, parâmetros, hashes ou credenciais. Conteúdo e auth usam no-store.

Login/cadastro: 30 tentativas por IP/15 minutos e 10 por e-mail/15 minutos, inclusive falhas; no máximo quatro hashes em andamento por processo, com a vaga retida até o cálculo terminar mesmo que a conexão HTTP seja encerrada. Refresh/logout: 120/IP/minuto. Contadores em memória são limitados a 20 mil chaves, expiram e não confiam em X-Forwarded-For. Reiniciar o processo reinicia os contadores. Antes de escala horizontal, use limitador compartilhado/gateway; atrás de proxy todos podem compartilhar o IP observado, exigindo configuração validada de proxy confiável e limites externos. Não há banimento permanente de conta.

Curso e lição não entram no bundle; filesystem não é servido estaticamente. Anônimos e estudantes recebem somente Markdown/exercícios publicados. A seleção filtra também catálogo, contagem, módulos e navegação anterior/próxima; conteúdo omitido retorna 404 em GET/HEAD. Em authoring, ADMIN pode ler o acervo editorial integral. No perfil public, nem ADMIN amplia o snapshot. Esconder controles React é conveniência, e o guard continua obrigatório. Conteúdo legitimamente exibido pode ser copiado; não há DRM, pagamento ou licenciamento implementado.

Dados locais existentes de prática, atividade, retomada e Studio passam a usar namespace por UUID para evitar exibição cruzada na UI. Dados antigos sem namespace permanecem intactos, sem importação automática. Isso não é sincronização nem uma barreira contra quem controla o navegador/DevTools. Temas e dimensões continuam preferências locais do navegador; não foram transformados em preferências de conta. Não há limpeza de bancos históricos.

Antes de publicação: validar HTTPS/proxy/cookies em host real, provisionar PostgreSQL com mínimo privilégio, backups/restauração, política de retenção de sessões e operação de segredos; revisar MFA obrigatório para administradores, recuperação de conta, confirmação de e-mail e limitação distribuída. Sem confirmação de e-mail, o cadastro não comprova propriedade do endereço. Studio permanece local; autenticação não autoriza sua exposição remota nem altera o isolamento do runner. Não se afirma prontidão para produção.

## Validação e Sprint 2

Execute com **banco exclusivo de testes**, nunca com identidades reais: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:browser` e `pnpm test:browser:public`. Gere o client/aplique migrations primeiro e exporte as variáveis. As origens de E2E são 5184 e 5186; cada rodada usa um novo diretório de evidências. As fixtures criam contas aleatórias, não possuem credenciais fixas nem autenticam por mocks; o cenário `auth.spec.ts` começa anônimo. Contas de teste permanecem no banco dedicado até sua política externa de descarte; não existe limpeza destrutiva automática.

Na Sprint 2, cada tabela individual deverá ter FK `userId`; toda leitura/escrita deve filtrar pelo `request.identity.id`, incluindo constraints compostas adequadas por lição/exercício. Progresso, última lição, solução aprovada pelo Submit e preferências deverão ter contratos próprios e testes A/B de isolamento. Não aceite UUID arbitrário do corpo/query para selecionar proprietário. A presente sprint fornece identidade e sessão, sem antecipar essas tabelas ou afirmar que os rascunhos locais são persistência de conta.

Referências: [Prisma 7 e adapter PostgreSQL](https://docs.prisma.io/docs/orm/v7), [configuração Prisma](https://docs.prisma.io/docs/orm/reference/prisma-config-reference), [sessões OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet), [CSRF OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [hash de senha no NestJS](https://docs.nestjs.com/security/encryption-and-hashing).
