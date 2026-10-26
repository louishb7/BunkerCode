# Autoria privada e leitura pública

O produto mantém dois perfis explícitos, sem autenticação. A candidata local da Lição 01 possui seleção editorial restritiva. Hospedagem, isolamento do usuário de serviço, proxy e validação externa continuam pendentes antes de qualquer deploy.

## Autoria local

`pnpm dev` seleciona `BUNKERCODE_PROFILE=authoring` nos dois processos e mantém frontend em `127.0.0.1:5173` e backend em `127.0.0.1:3001`. Studio, prévia visual, criação, gravação física, revisão, locks, escrita atômica, Run e Submit continuam locais. O backend preserva a checagem de Host loopback, Origin exata, `Sec-Fetch-Site`, JSON e `x-bunkercode-client: local` nas mutações. Essas checagens são proteções do ambiente local, não autenticação: **nunca exponha o perfil de autoria à internet ou por um proxy público**.

`pnpm build` produz o frontend privado em `apps/frontend/dist`. Para revisar esse build localmente, inicie `pnpm --filter @bunkercode/backend start:authoring` e `pnpm --filter @bunkercode/frontend preview:authoring --port 5173`. O frontend faz proxy de `/api` para `BUNKERCODE_API_URL` (default `http://127.0.0.1:3001`). A origem do preview precisa coincidir com `BUNKERCODE_STUDIO_ORIGIN`, cujo default é `http://127.0.0.1:5173`.

O backend direto (`node apps/backend/dist/main.js`) exige `BUNKERCODE_PROFILE=authoring` ou `public`. Ausência, valor desconhecido ou configuração pública incompleta encerram o processo antes de abrir a porta. `NODE_ENV` não escolhe capacidades. O Vite também rejeita perfil ausente/inválido. Os scripts locais declaram o perfil para preservar o fluxo habitual; não há fallback administrativo de produção.

## Seleção e snapshot público

A única seleção editorial para publicação é `config/publication.json`, atualmente:

```json
{ "courses": [{ "id": "fundamentos-programacao-javascript", "lessons": ["o-que-significa-programar"] }] }
```

A Integração Editorial 01 autoriza somente a primeira lição autoral do novo curso, no Módulo 00. Essa seleção prepara uma candidata local, sem deploy. Para selecionar outros conteúdos revisados, o proprietário altera explicitamente os slugs:

```json
{ "courses": [{ "id": "curso-autorizado", "lessons": ["licao-autorizada"] }] }
```

Os nomes acima são ilustrativos e não correspondem a conteúdo autorizado. Entradas string continuam significando autorização do **curso inteiro**, incluindo todas as lições e exercícios: use-as apenas após revisão integral. Objetos exigem `id` e uma lista `lessons` não vazia, sem duplicatas, curingas, paths ou slugs desconhecidos. A seleção vazia no topo continua válida para suspender toda a publicação.

O snapshot deriva seu manifesto da fonte canônica: mantém metadados do curso, filtra lições na ordem original (independente da ordem da seleção) e elimina módulos que ficaram sem lições. Títulos e descrições do curso e dos módulos mantidos também precisam de revisão editorial. Markdown e exercícios selecionados são copiados sem alteração; anterior/próxima e acesso direto usam somente o manifesto filtrado. O bootstrap recusa manifestos ampliados em desacordo com a seleção congelada. O Studio local continua lendo o manifesto integral; não há cópia editorial mantida manualmente. Uma seleção vazia produz catálogo vazio e nega qualquer ID direto.

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

O painel público afirma explicitamente que o código não é executado, enviado nem avaliado. Escrever e formatar não representam avaliação ou entrega. Nos dois perfis, o heatmap permite consultar data e contagem local por mouse, foco/teclado ou toque, sem registrar outra atividade: Escape ou interação fora fecha o detalhe contextual. Em dispositivos com ponteiro impreciso, os quadrados visuais mantêm 11px dentro de alvos separados de 24px; a rolagem horizontal fica no calendário e a janela permanece limitada aos últimos seis meses.

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

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` e `pnpm build:public` verificam os contratos e os dois builds. `pnpm test:browser:public` inicia backend público real, snapshot read-only descartável e preview público nas portas 3014/5186. Somente a fixture seleciona TypeScript e PostgreSQL completos e a lição `pipes` de Linux; a seleção canônica autoriza somente a Lição 01 de Fundamentos de Programação com JavaScript, validada separadamente em snapshot real. Verifica leitura direta/reload, acesso privado negado, headers forjados, inexistência de Studio e artefatos privados, persistência local, responsividade e Táticas. `pnpm test:browser` mantém a suíte completa privada nas portas 3012/5184, incluindo criar/editar/pré-visualizar/salvar/reabrir no Studio em fixture. Só o supervisor do navegador cria e limpa suas cópias temporárias; `--list` não cria conteúdo. Saídas de cada rodada usam UUID novo e são preservadas.

Os testes backend iniciam processos públicos reais, verificam ausência de módulos privados no cache de módulos, catálogo vazio, seleção e negativas de startup (perfil ausente/inválido, diretório ausente/gravável, manifesto inválido, UTF-8 inválido, symlink, arquivo extra). Leitura de conteúdo privado é negada também com GET/HEAD, headers locais forjados e query de perfil; o catálogo público mantém `Cache-Control: no-store`. Comparações SHA-256 demonstram que tentativas negadas não alteram snapshot nem fonte editorial.

Os testes de scripts também iniciam o Vite real para comprovar que perfil ausente, vazio ou desconhecido falha antes de ouvir HTTP, mesmo com `NODE_ENV=production` e `VITE_BUNKERCODE_PROFILE=authoring`. O servidor de desenvolvimento recusa o perfil público; use o build público e seu preview. O E2E público percorre apresentação do curso, leitor, próxima/anterior e reload pelos links reais.

O lançamento público deste ciclo não requer Docker porque não disponibiliza Run. Eventual exposição futura exigirá nova decisão de produto e segurança: testes reais de limites de CPU/memória/PIDs/saída/timeout, filesystem read-only, usuário sem privilégios, rede bloqueada, capabilities/seccomp/cgroup v2, ausência de mounts/segredos/socket, compilação confiável no backend, cancelamento, concorrência e abuso de recursos. Skips por Docker ausente não são aprovação desse isolamento, e a validação local atual não autoriza Run público.


## Checklist de implantação da versão candidata

- Preparação local não equivale a deploy. Identificar e revisar a lição autoral, seus metadados, referências e exercícios; preencher a seleção apenas por decisão do proprietário. Recriar snapshot exclusivo e repetir leitura real nas quatro resoluções antes do lançamento.
- Executar serviço sem privilégios com `BUNKERCODE_PROFILE=public`, `BUNKERCODE_CONTENT_DIR` absoluto, `PORT` definido, snapshot montado read-only e acesso restrito ao runtime compilado. Não conceder socket Docker nem filesystem de autoria. `BUNKERCODE_RUNNER_ENABLED` não habilita runner público.
- Supervisionar o processo, capturar stderr de falhas de bootstrap e testar restart/rollback. O backend ouve loopback; somente o reverse proxy recebe tráfego externo.
- Publicar exclusivamente `dist-public`; negar dotfiles, `.vite/`, source maps, diretórios de conteúdo, arquivos de backend e aliases para o checkout. Aplicar fallback SPA apenas às rotas da UI, preservando 403/404 da API e 404 de assets ausentes.
- Configurar HTTPS e redirecionamento HTTP, proxy `/api/` sem prefixo para a API, limites de corpo/tempo e firewall. No host/proxy, definir e verificar `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, bloqueio de frames (`frame-ancestors 'none'` na CSP), HSTS após HTTPS validado e política CSP compatível com os workers de compilação e recursos efetivamente usados. Os previews Vite não comprovam esses controles da hospedagem.
- Não registrar corpos de requisições, rascunhos nem headers sensíveis; limitar retenção/permissões de access/error logs. Definir responsável operacional por alertas e atualização das dependências.
- Conferir externamente home, catálogo, leitor, deep link/reload, assets, headers TLS/HTTP, erros e negativas de escrita/runner/conteúdo omitido. Esses gates dependem do ambiente real; nenhum provedor foi escolhido ou configurado.
