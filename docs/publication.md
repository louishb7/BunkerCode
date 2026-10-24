# Autoria privada e leitura pública

A Estabilização 05 prepara dois perfis explícitos, sem autenticação. Isto não constitui autorização para um deploy: seleção editorial, hospedagem, isolamento do usuário de serviço, proxy e validação externa continuam pendentes.

## Autoria local

`pnpm dev` seleciona `BUNKERCODE_PROFILE=authoring` nos dois processos e mantém frontend em `127.0.0.1:5173` e backend em `127.0.0.1:3001`. Studio, prévia visual, criação, gravação física, revisão, locks, escrita atômica, Run e Submit continuam locais. O backend preserva a checagem de Host loopback, Origin exata, `Sec-Fetch-Site`, JSON e `x-bunkercode-client: local` nas mutações. Essas checagens são proteções do ambiente local, não autenticação: **nunca exponha o perfil de autoria à internet ou por um proxy público**.

`pnpm build` produz o frontend privado em `apps/frontend/dist`. Para revisar esse build localmente, inicie `pnpm --filter @bunkercode/backend start:authoring` e `pnpm --filter @bunkercode/frontend preview:authoring --port 5173`. O frontend faz proxy de `/api` para `BUNKERCODE_API_URL` (default `http://127.0.0.1:3001`). A origem do preview precisa coincidir com `BUNKERCODE_STUDIO_ORIGIN`, cujo default é `http://127.0.0.1:5173`.

O backend direto (`node apps/backend/dist/main.js`) exige `BUNKERCODE_PROFILE=authoring` ou `public`. Ausência, valor desconhecido ou configuração pública incompleta encerram o processo antes de abrir a porta. `NODE_ENV` não escolhe capacidades. O Vite também rejeita perfil ausente/inválido. Os scripts locais declaram o perfil para preservar o fluxo habitual; não há fallback administrativo de produção.

## Seleção e snapshot público

A única seleção editorial para publicação é `config/publication.json`, inicialmente:

```json
{ "courses": [] }
```

Nenhum curso foi autorizado nesta tarefa. O proprietário deve preencher `courses` com IDs reais depois de revisar **todas as lições e exercícios** dos cursos escolhidos. A unidade de publicação é o curso inteiro, incluindo títulos, descrição, módulos, ordem, Markdown e exercícios declarados. Não há publicação independente de lições. IDs desconhecidos, repetidos, inválidos, curingas e campos extras são recusados. Uma seleção vazia produz catálogo vazio e nega qualquer ID direto.

Gere um diretório novo, fora do checkout, cujo pai já exista:

```sh
pnpm publication:prepare /tmp/bunkercode-public-launch-01
```

Argumentos opcionais: `pnpm publication:prepare <novo-destino> [selecao.json] [diretorio-content]`. Não reutiliza, sobrescreve ou remove diretórios existentes. Valida com os mesmos contratos do leitor e copia somente `course.json`, cada `lesson.md` declarado e o `exercise.json` opcional. Notas extras, cursos não selecionados, arquivos internos, locks, `.env`, bancos e assets arbitrários não entram. Symlinks nos caminhos de conteúdo selecionado são recusados. Uma falha não publica nem inicia servidor; um eventual diretório parcial deve ser inspecionado pelo autor, sem limpeza automática.

O snapshot tem apenas `publication.json` e `courses/`. Seu `publication.json` é a cópia congelada da seleção, não outra lista mantida manualmente. O servidor usa essa decisão tanto na descoberta quanto antes do acesso direto e das respostas auxiliares. O catálogo público mostra a resposta autorizada inteira: a lista visual de quatro cursos usada na autoria não controla publicação. A ordem pública atual é a ordenação de IDs da API, enquanto módulos e lições mantêm a ordem do manifesto.

Os arquivos gerados têm modo `0444` e diretórios `0555`. O bootstrap público verifica que nenhum item é gravável pelo usuário efetivo do processo, que não há symlinks/tipos especiais e que o inventário corresponde exatamente aos arquivos selecionados. Apontar para conteúdo de autoria, diretório gravável, snapshot malformado ou com arquivos extras falha antes de ouvir HTTP. Rodar como root não satisfaz essa proteção em um filesystem gravável: use usuário sem privilégios. O servidor não vigia alterações externas após o bootstrap; publique snapshots imutáveis e reinicie ao trocar a versão.

## Build e revisão pública local

```sh
pnpm build:public
BUNKERCODE_CONTENT_DIR=/tmp/bunkercode-public-launch-01 pnpm start:public
pnpm preview:public --port 5174
```

O build público fica em `apps/frontend/dist-public`, separado de `dist`. O backend continua ouvindo somente `127.0.0.1:3001`. O preview é uma ferramenta de revisão local, não o servidor de hospedagem recomendado. O build público impede Studio/Tiptap no grafo dos chunks, não registra a rota `/courses/:id/lessons/:slug/edit` e remove o link de edição. Acesso direto ou reload dessa rota mostra página inexistente. O backend mantém a fronteira de segurança mesmo se um cliente usar o build errado ou enviar requisições manualmente.

O leitor mantém Markdown sanitizado, navegação contextual, lições/módulos, responsividade, CodeMirror, formatação e rascunhos IndexedDB locais. Não oferece Run, cancelamento ou Submit que acionaria análise/execução remota; explica a limitação no painel existente, sem mudar seu layout. O painel público não consulta `/practice/runtime`. Não houve migração nem alteração dos contratos de rascunhos, submissões ou atividade. Registros antigos do mesmo navegador continuam locais. Táticas usa seu avaliador estruturado no navegador, sem executar o texto apresentado e sem backend.

## HTTP

| Caminho | Público | Autoria |
| --- | --- | --- |
| `GET/HEAD /content/courses` | Somente seleção do snapshot | Todos os cursos locais |
| `GET/HEAD /content/courses/:id` | 200 selecionado; 404 restante | Leitura local |
| `GET/HEAD /content/courses/:id/lessons/:slug` | Somente curso selecionado e lição declarada | Leitura local |
| `GET/HEAD /content/courses/:id/lessons/:slug/exercise` | Mesma fronteira; exercício opcional | Leitura local |
| `POST /content/courses/:id/lessons` | 403, controller ausente | Criação protegida |
| `PUT /content/courses/:id/lessons/:slug/markdown` | 403, controller ausente | Gravação protegida |
| `GET /practice/runtime` | 404, controller ausente | Disponibilidade local |
| `POST /practice/runs` | 403, controller ausente | Execução protegida |
| `DELETE /practice/runs/:id` | 403, controller ausente | Cancelamento protegido |
| Outras mutações sob `/content/courses*` ou `/practice*` | 403 pela defesa central | Proteção local e/ou 404 |
| Rotas aposentadas, arquivos internos e outras rotas | 404 | 404 |

Respostas de conteúdo continuam `Cache-Control: no-store`. Headers Host, Origin, `x-bunkercode-client`, `x-bunkercode-profile`, query e body não alteram o perfil capturado no bootstrap. O processo público não importa controllers de autoria/prática, Studio server-side ou runner; `BUNKERCODE_RUNNER_ENABLED=1` não os habilita. Não há rotas administrativas alternativas, login ou sessão.

## Fronteira do filesystem e hospedagem futura

Na hospedagem real, use um usuário de serviço diferente do proprietário/editor e monte **somente o snapshot** como read-only. O proprietário deve pertencer ao processo de preparação, não ao processo HTTP: arquivos `0444` pertencentes ao próprio usuário ainda podem ter permissões alteradas por ele. Prefira mount read-only e raiz do container imutável, além da verificação de acesso feita na inicialização. Não monte o checkout, conteúdo original, diretório pessoal, `.env`, dados locais, credenciais, socket Docker nem volumes de autoria no processo público. Não basta copiar variáveis de ambiente mantendo o usuário de desenvolvimento e todo seu disco acessível. O backend não escreve no snapshot nem serve seus arquivos como diretório estático; lê pelo contrato de conteúdo.

O host estático deve publicar exclusivamente `apps/frontend/dist-public`. Nunca publique raiz do monorepo, `content/`, `apps/frontend/public/` inteira, `dist` privado, source maps, resultados de testes ou arquivos do backend. O build público desliga a cópia automática de `public/` e emite somente favicons, marca, oito ícones genéricos de tecnologias e respectivas licenças explicitamente listados no Vite. Os ícones não declaram cursos publicados. Novos assets exigem revisão dessa lista; imagens locais arbitrárias referenciadas no Markdown não são copiadas automaticamente. Assets editoriais novos precisarão de política explícita antes da publicação.

O provedor ainda deve definir: TLS/domínio, proxy que encaminha `/api` à API loopback removendo esse prefixo, rewrites de SPA para navegação direta, separação das origens pública e privada, usuário/mounts, firewall sem porta de autoria, retenção de logs sem dados privados, limites de requisição, atualização/reversão de snapshots e política de cache. Bloqueie o acesso estático a metadados de build que não precisem ser publicados, como `.vite/`. Valide externamente que rotas internas, Markdown original, `.git`, arquivos privados e conteúdo não selecionado não são servidos pelo host nem por aliases do proxy. Não houve escolha de provedor nem deploy nesta etapa.

## Validação

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` e `pnpm build:public` verificam os contratos e os dois builds. `pnpm test:browser:public` inicia backend público real, snapshot read-only descartável e preview público nas portas 3014/5186. Somente a fixture seleciona TypeScript e PostgreSQL; a seleção canônica permanece vazia. Verifica leitura direta/reload, acesso privado negado, headers forjados, inexistência de Studio e artefatos privados, persistência local, responsividade e Táticas. `pnpm test:browser` mantém a suíte completa privada nas portas 3012/5184, incluindo criar/editar/pré-visualizar/salvar/reabrir no Studio em fixture. Só o supervisor do navegador cria e limpa suas cópias temporárias; `--list` não cria conteúdo. Saídas de cada rodada usam UUID novo e são preservadas.

Os testes backend iniciam processos públicos reais, verificam ausência de módulos privados no cache de módulos, catálogo vazio, seleção e negativas de startup (perfil ausente/inválido, diretório ausente/gravável, manifesto inválido, UTF-8 inválido, symlink, arquivo extra). Comparações SHA-256 demonstram que tentativas negadas não alteram snapshot nem fonte editorial.

O lançamento público deste ciclo não requer Docker porque não disponibiliza Run. Eventual exposição futura exigirá nova decisão de produto e segurança: testes reais de limites de CPU/memória/PIDs/saída/timeout, filesystem read-only, usuário sem privilégios, rede bloqueada, capabilities/seccomp/cgroup v2, ausência de mounts/segredos/socket, compilação confiável no backend, cancelamento, concorrência e abuso de recursos. Skips por Docker ausente não são aprovação desse isolamento, e a validação local atual não autoriza Run público.
