# Arquitetura atual do BunkerCode

Data: 2026-10-09. Esta é a referência ativa. O MVP 03 contém Home, Cursos, Leitor, prática de escrita e Studio. A prática não reativa a execução aposentada no MVP 02.

BunkerCode é uma plataforma pessoal e aberta para estudar programação e transformar entendimento em conteúdo autoral. O fluxo principal é estudar fora, praticar, escrever uma lição no repositório, revisar no site e fazer commit manualmente.

## Estrutura

- apps/frontend: React, React Router, Vite e Tailwind v4; Home, cursos, leitor Markdown, prática CodeMirror e Studio local.
- apps/backend: um monólito NestJS; leitura de cursos e escrita editorial segura.
- content/courses: manifestos de cursos e lições Markdown.
- scripts: comando de autoria e seus testes.
- docs: documentação atual, implementação e histórico selecionado.

A raiz configura o monorepo: package.json, pnpm-workspace.yaml, lockfile, ESLint, tsconfig.base.json e .gitignore. O tsconfig base compartilha strictness/target realmente usados pelas duas aplicações; DOM pertence ao frontend, Node e decorators ao backend. Vite, Playwright e tsconfigs específicos ficam nas aplicações. Não há packages compartilhados, Turborepo ou Nx.

## Conteúdo e leitura

course.json define id, título, descrição e ordem das lições. Cada entrada possui somente slug e título; campos obsoletos como activityId são recusados como desconhecidos. O caminho do Markdown é derivado: content/courses/<id>/lessons/<slug>/lesson.md. Não existe path livre vindo do navegador nem um índice duplicado em React/Nest.

O Leitor usa uma coluna de até 750 px, com margens menores no mobile. O botão **Lições** abre um `dialog` modal nativo com a ordem do manifesto e a lição ativa; selecionar uma lição fecha o índice. Escape e Fechar devolvem o foco ao botão, o fundo fica inerte e a rolagem do documento é bloqueada enquanto o índice está aberto. Anterior/próxima e retorno ao curso continuam disponíveis. A prévia do Studio compartilha a medida efetiva da prosa e a tipografia do título, sem a navegação do leitor.

Todas as rotas têm conteúdo principal identificado para o skip link e título de documento contextual. Ao concluir o carregamento de uma rota, o foco vai para o título; navegação comum começa no topo, enquanto Voltar/Avançar restaura a posição registrada por entrada do histórico durante a sessão. Digitação não move o foco da edição. A alternância Editar/Prévia mantém o foco no controle acionado e restaura a posição de cada vista e a seleção/scroll interno do textarea. Reload/deep link carrega o conteúdo diretamente e começa no topo; não há suporte novo a âncoras Markdown.

Catálogo usa um link por card. A apresentação de curso inclui CTA para a primeira lição e percurso plano com links independentes na ordem editorial; não há capítulos ou conclusão inventados.

O cliente valida o formato do conteúdo e distingue falha de rede, erro HTTP e resposta incompatível (incluindo vazia/HTML/JSON inválido), com mensagens em português e tentativa novamente. Diagnósticos válidos do backend são preservados. IDs/slugs, textos, listas sem identidades duplicadas, versão e vizinhos na ordem do manifesto são validados no consumo. Uma resposta de outro curso/lição é recusada como incompatível, incluindo a entrada do Studio, em vez de carregar indefinidamente.

A API oferece:

- GET /content/courses
- GET /content/courses/:id
- GET /content/courses/:id/lessons/:slug
- GET /content/courses/:id/lessons/:slug/exercise (`{ exercise: objeto validado | null }`)
- PUT /content/courses/:id/lessons/:slug/markdown

Pastas de curso são descobertas por leitura do diretório. Manifestos são validados; IDs/slugs são restritos e symlinks internos recusados. Erros de scope retornam 400/404; conteúdo inválido/ausente retorna 422. A raiz autorizada e seus ancestrais também não podem ser symlinks. Um manifesto inválido interrompe o catálogo com diagnóstico explícito, em vez de esconder um curso quebrado.

Arquivos são lidos sob demanda, com Cache-Control: no-store. Salvar e recarregar basta; não há watcher, cache editorial, fila ou sincronização. Limites iniciais: 64 KiB por manifesto e 256 KiB por Markdown. O conteúdo permanece em arquivos; não há banco editorial.

O frontend usa react-markdown, ignora HTML bruto, sanitiza a árvore e aplica highlighting somente à linguagem declarada no fence. Blocos são texto e não são executados. Links inseguros são removidos. O highlighter é um plugin confiável aplicado após a sanitização, conforme sua documentação; não existe rehype-raw, MDX ou dangerouslySetInnerHTML. Referências podem abrir outra aba com noopener/noreferrer.

As cores dos tokens nos blocos de código seguem uma adaptação do [IntelliJ-ish Darcula Theme](https://github.com/csantiago132/intellij-ish-darcula-theme/blob/develop/themes/IntelliJ-ish%20Darcula-color-theme.json), de Carlos Santiago, distribuído sob MIT ([licença](https://github.com/csantiago132/intellij-ish-darcula-theme/blob/develop/LICENSE.md)). O fundo de código usa #23272C e o foreground base #D4D4D4; palavras-chave são laranja, strings verdes, números azuis, comentários cinza, propriedades violetas e funções/classes amarelo/âmbar. As regras ficam limitadas a `.prose .code-block`. O leitor e a prévia usam o mesmo componente e CSS.

Comentários/quotes usam #909090 (4,71:1) e expressões regulares #9395C6 (5,26:1) sobre #23272C. Somente estes tokens foram clareados para superar 4,5:1, mantendo cinza e violeta azulado e as demais cores. Testes verificam as cores e o contraste no mesmo renderer do Leitor e da prévia.

A adaptação usa as classes realmente emitidas pelo Highlight.js 11.11.2, sem reproduzir a classificação TextMate ou a análise semântica do VS Code. O fonte original contém regras repetidas: por exemplo, a regra posterior de classes/tipos usa #EBB662. O mapeamento considera essas distinções e mantém as cores da primeira implementação onde já correspondem ao original.

| Construção TypeScript                                                                                                                 | HTML do Highlight.js                           | Intenção do tema original                                           | Correspondência nesta adaptação                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`, `interface`, `enum`, `class`, `function`, `async`, `await`, `return`, `const`, `let`, `new`, `extends`, `readonly`, `private` | `hljs-keyword`                                 | `keyword`, `storage.type` e `storage.modifier`: #DB7E32             | Laranja; já correto na primeira implementação.                                                                                                                  |
| `string`, `number`, `boolean`, `unknown`                                                                                              | `hljs-built_in`                                | Tipos primitivos/keywords: laranja, conforme escopo da gramática    | Laranja em `typescript` e seu alias `ts`. A mesma classe inclui alguns built-ins como `parseInt`: não é possível dar outra cor a eles apenas com CSS.           |
| `User`, `Repository`, `Promise`, `Map`                                                                                                | `hljs-title class_`                            | `entity.name.type`, `entity.name.class`, `support.class`: #EBB662   | Âmbar. `T` pode ficar sem span; nomes iniciados com maiúscula não garantem tipo semântico.                                                                      |
| `Status.Pending`, `Status.Active` e membros no `enum`                                                                                 | Frequentemente `hljs-title class_`             | Membros aparecem violetas nos prints do VS Code                     | Mantêm âmbar porque compartilham a classe de nomes de tipos; não há distinção semântica segura por CSS.                                                         |
| `fetchUser`, `log`, `find`, `add`, `apply`, `set`                                                                                     | `hljs-title function_` em declaração e chamada | Declarações/support functions: #F7D064; alguns calls: #A9B7C6       | Amarelo para a classe comum; CSS não distingue definição, função global e método chamado.                                                                       |
| `items` em `this.items`                                                                                                               | `hljs-property`                                | `variable.other.property`: #BF93D8                                  | Violeta quando o token existe.                                                                                                                                  |
| `id: T`, `name: string`, `count: number`                                                                                              | `hljs-attr`                                    | Propriedade de objeto: violeta; variável/parâmetro: #A9B7C6/#BDC9D6 | Violeta fora de `hljs-params`; neutro dentro do grupo. A classe mistura propriedades e identificadores tipados, incluindo parâmetros de métodos sem esse grupo. |
| Parâmetros de `function fetchUser(...)`                                                                                               | `hljs-params`, com spans internos              | `variable.parameter.ts`: #BDC9D6                                    | Grupo claro; spans internos mantêm suas cores de tipos/keywords. Pontuação não recebe classificação individual.                                                 |
| `this`, `console`, `window`, `super`                                                                                                  | `hljs-variable language_` compartilhado        | `this`: laranja/itálico; objetos/globals: claros, normalmente retos | Neutro #A9B7C6, sem itálico. A regra anterior aplicava o estilo de `this` também a `console`. Não existe distinção segura por CSS.                              |
| `@sealed`                                                                                                                             | `hljs-meta`                                    | Escopos de metadados/annotations dependentes da gramática           | Laranja aproximado; não há identificação semântica do decorator.                                                                                                |
| Strings, números, comentários                                                                                                         | `hljs-string`, `hljs-number`, `hljs-comment`   | #7CB961, #6897BB, #808080                                           | Strings e números correspondem diretamente; comentários usam #909090 para contraste AA sobre #23272C.                                                                                                                     |
| Template literal com `${id}`                                                                                                          | `hljs-string` contendo `hljs-subst`            | String verde e interpolação #A9B7C6                                 | Interpolação neutra; spans internos continuam com suas cores.                                                                                                   |
| `{}`, `()`, `[]`, `<T>`, `=`, `\|`, `;`, `.`                                                                                          | Em geral texto sem span em TS                  | Pontuação/operadores e bracket pair colorization do editor          | Foreground base neutro #D4D4D4; sem cores por profundidade. Classes de operador/pontuação existentes em outras linguagens usam #A9B7C6.                         |

O bloco define sua própria fonte de 14px e line-height de 1.5 (21px), inclusive no `pre`, para não herdar as caixas de linha de 1.85 da prosa. Padding de 16px × 18px, margem vertical de 22px e cabeçalho de 8px × 18px reduzem a densidade excedente. Não removemos linhas em branco, indentação nem seleção; linhas longas mantêm scroll horizontal interno. Leitor e prévia compartilham renderer e regras. Fences sem linguagem, `plaintext` e tokens não reconhecidos mantêm #D4D4D4 e não usam detecção automática.

Os dois prints de VS Code enviados pelo autor orientam a densidade e a revisão visual: keywords alaranjadas, propriedades violetas, funções amarelas, strings verdes e comentários cinza. O resultado aproxima essa aparência, mas a classificação lexical não permite reproduzir integralmente semantic tokens, itálicos contextuais ou bracket pair colorization do editor.

## Carregamento do frontend

Cursos e a página de curso carregam no bundle inicial. Leitor e Studio usam React.lazy por rota; ambos compartilham um chunk de Markdown/highlighting que só é solicitado ao abrir leitura/autoria. ContentStatus permanece independente dessas páginas e oferece loading com role=status e erro recuperável para falha de chunk. O header e o skip link permanecem disponíveis. O CSS comum é importado pela entrada global; somente CSS específico do Studio acompanha seu chunk. Estados básicos dos controles e medidas de página/leitura usam variáveis pequenas, sem biblioteca de componentes.

O build gera manifest.json em dist/.vite para verificar o grafo de assets nos testes. A suíte E2E usa Vite preview do build de produção, com proxy local /api, para exercitar o carregamento real dos chunks e do CSS. `pnpm test:browser` continua compilando antes da suíte. O comando frontend isolado exige build prévio.

## Studio Fase 1: editar e salvar

A rota `/courses/:id/lessons/:slug/edit` usa um textarea e o renderer Markdown existente. Ela edita apenas o Markdown de uma lição existente; não altera curso/manifesto nem cria arquivos. O estado do editor contém rascunho, Markdown de base e versão de base. O textarea usa soft wrap visual, preserva LF/CRLF conforme o contrato existente e permanece montado/oculto ao entrar na prévia. A prévia só é renderizada quando aberta, evitando highlighting a cada digitação. Seleção e posições de edição/prévia são locais à página, sem reimplementar o journal. A prévia usa o rascunho, enquanto leitor/disco continuam com a última gravação confirmada. Durante o PUT, a edição fica bloqueada; erros/confirmação inválida não limpam o rascunho. Um journal em sessionStorage por aba permite retomar navegação/reload, com aviso de falha; não substitui backup e desaparece ao fechar a aba.

A toolbar do Studio é persistente, com save, vistas e estado juntos; em altura de viewport ≤500 px permanece no fluxo para não cobrir a edição.

### Contrato e escrita

GET de lição preserva seus campos e acrescenta `version`: SHA-256 hexadecimal de 64 caracteres dos bytes UTF-8 do Markdown. PUT recebe somente `{ markdown: string, version: string }`, e responde 200 com `{ markdown, version }` após a gravação e cleanup confirmados. O novo hash corresponde ao texto enviado. Erros: 400 formato/IDs; 403 origem/comando; 404 curso/lição inexistente; 409 versão obsoleta ou lock; 413 Markdown maior que 256 KiB; 415 Content-Type; 422 manifesto/path/arquivo inválido; 500 falha de filesystem ou confirmação. O parser JSON editorial admite até 1600 KiB para comportar escapes JSON de um Markdown válido; o parser padrão do Nest está desativado e há um único parser JSON explícito em /content/courses, registrado depois das proteções HTTP. Não há parsing para endpoints aposentados.

`content/courses.ts` continua sendo a fonte da validação de manifestos e derivação de paths. `markdown-file.ts` lê somente arquivo regular com O_NOFOLLOW, limite tanto no stat como na leitura, valida UTF-8 e produz a versão. `studio.ts` valida a entrada e executa o protocolo:

1. Validar IDs, manifesto, pertencimento da lição e cada componente do path.
2. Adquirir `.studio-save.lock` exclusivo por lição (não remover lock preexistente).
3. Comparar o hash atual com a versão enviada.
4. Escrever temporário exclusivo no mesmo diretório, preservar permissões, flush e fechar.
5. Revalidar manifesto, paths e hash imediatamente antes de substituir por rename.
6. Liberar temporário/lock próprios; somente então confirmar o resultado.

I/O síncrono limitado a 256 KiB evita awaits na janela de checagem/substituição, com bloqueio breve do event loop como trade-off local. O lock coordena processos Studio e o hash impede gravações obsoletas. O VS Code não usa esse lock: a corrida entre a última leitura e rename não é eliminada. Atomicidade do rename evita truncamento pelo Studio. O arquivo substituído recebe outro inode; metadata especial não é preservada. O protocolo não protege contra processo local hostil nem garante durabilidade de diretório após queda de energia. Interrupção abrupta pode deixar lock/temporário; inspeção manual, sem remoção automática. Limitações e recuperação estão no [guia de autoria](../authoring.md).

### Exposição

O bind do backend continua 127.0.0.1. Escrita editorial exige Host loopback, Origin exatamente igual a `BUNKERCODE_STUDIO_ORIGIN` (padrão `http://127.0.0.1:5173`), Fetch Metadata same-origin quando disponível, JSON e cabeçalho de comando local. A proteção cobre a mesma insensibilidade a maiúsculas das rotas Express. Não há CORS permissivo. Essas camadas seguem as orientações de origem/Fetch Metadata da [OWASP sobre CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html); não são autenticação. Programas locais podem forjar cabeçalhos. Não existe auth, exposição pública, sandbox de filesystem ou publicação remota nesta fase.

A implementação editorial não introduz módulo genérico, banco, watcher ou integração Git. O controller delega à função específica de escrita; o AppModule contém apenas ContentController. Testes usam cópias de conteúdo/dados e um índice Git descartável; não fazem commit nem editam conteúdo autoral canônico.

## MVP 02: escopo e remoção

O produto apresenta Cursos, Leitor e Studio. Foram retirados catálogo/páginas de exercícios, rotas /learn, cliente /learning, LearningModule, tentativas/submissões/feedback, store SQLite, executores TypeScript, supervisor/harnesses, atividades e migration versionada. GET/POST dos endpoints /learning retornam 404; URLs /learn caem no estado normal de página inexistente. Não há placeholder ou executor alternativo.

Nenhuma dependência de package.json era exclusiva dos exercícios: TypeScript continua necessário no build, tsx no desenvolvimento/testes, NestJS/Express no servidor e React/Markdown/highlighting no leitor/Studio. O build do backend agora é somente tsc, sem copiar recursos de execução. Express está declarado diretamente como dependência de runtime, pois application.ts importa o parser JSON. O lockfile registra essa ligação sem hoisting ou NODE_PATH.

O comando de testes do backend compila antes de executar a suíte. Um teste inicia dist/main.js em subprocesso com ambiente restrito, sem herdar NODE_PATH/NODE_OPTIONS, usando conteúdo isolado e exercitando leitura e escrita protegida por HTTP. Testes de conteúdo e Studio usam filesystem descartável. O navegador copia content e usa portas 3012/5184; sua readiness consulta /content/courses. Cada rodada recebe diretório de resultados exclusivo .bunkercode/browser-results-*, evitando a limpeza das capturas anteriores pelo Playwright.

## Demolição e dados

Workbench, System, Surface, catálogo/runner/orchestration históricos, protocolo @backendlab, templates OrderDesk, migrations lab e seus testes exclusivos foram retirados. Não existem wrappers de compatibilidade.

.bunkercode, .bunkerlab e .backendlab permanecem ignorados. Bancos SQLite, workspaces, arquivos não versionados e capturas anteriores foram preservados; o bootstrap não abre nem migra os bancos aposentados. A remoção alcança somente arquivos versionados sem consumidores. Saídas antigas ignoradas de build podem permanecer no disco; não são importadas pelo AppModule atual. Não há script de limpeza ou migração destrutiva.

Auditorias em docs/audits, a proposta anterior e os relatórios em docs/implementation são históricos. Não definem backlog ou obrigação de preservar código. Veja [consolidação](../implementation/consolidation-mvp.md) e [autoria](../authoring.md).

## Interface e prática no MVP 03

A rota `/` é uma Home independente; a marca aponta para ela e Início/Cursos ficam juntos à esquerda. As demais rotas continuam iguais. `product/` contém os componentes usados pela Home e Cursos, incluindo figura por tecnologia com fallback neutro. O PNG oficial Bunker vem de `BunkerMode/frontend/public/faviconbg.png`, copiado sem alteração para `public/brand/bunker.png`; também é o favicon. BunkerMode não é dependência de runtime nem recebe alterações.

Tailwind v4 usa o plugin de Vite, tokens em `styles.css` e utilities na nova interface. Preflight não é importado: resets globais alterariam o Markdown e o Studio. Defaults ficam na camada base, classes compartilhadas na camada components e utilities têm precedência explícita. `reader.css` e `studio.css` mantêm suas regras especializadas; `catalog.css` contém apenas geometria do percurso e quebra de textos. Darcula e o renderer não foram substituídos. Lucide fornece os ícones usados. Radix AlertDialog dá foco, semântica e confirmação acessível à restauração do código. Não há biblioteca de animação; transições CSS respeitam reduced-motion.

Home/Cursos ficam no bundle inicial. Leitor, Markdown e Studio continuam lazy; `PracticePanel` e CodeMirror só são importados para uma definição de exercício válida. A falha de chunk tem recuperação pela boundary de rota. `useContent` cancela respostas obsoletas. Sem exercício, a leitura mantém largura de 750 px. Com prática, duas colunas aparecem a partir de 1200 px; abaixo disso Explicação/Código alternam visibilidade sem desmontar CodeMirror. O editor gerencia seleção e undo/redo durante sua montagem. Tab indenta, Escape seguido de Tab permite sair.

### Contrato editorial

`exercise.json` é opcional, ao lado de `lesson.md`. Sua identidade é explícita, independente do título; a revisão é SHA-256 dos bytes editoriais. A API de exercício é separada para que uma definição inválida não impeça leitura ou autoria. O path é derivado de curso/lição validados e pertencentes ao manifesto. O arquivo é aberto com O_NOFOLLOW, tipo regular, UTF-8 e limite de 64 KiB; campos desconhecidos e linguagens fora de TypeScript/JavaScript são recusados. Não há escrita desse arquivo pela interface nem interpretação de blocos Markdown como exercícios.

### Rascunhos de prática

`bunkercode-practice` é um IndexedDB novo e específico do navegador. Store `drafts`, schema 1. A chave contém produto, curso, lição, ID de exercício e revisão editorial. Cada registro armazena texto, versão inteira e timestamp; limite de 64 KiB por código. A conclusão da transação confirma o estado salvo, nunca apenas o estado React. Escritas são serializadas e coalescem digitação ocorrida durante uma gravação.

Cada gravação lê a revisão esperada e faz o put na mesma transação readwrite. Uma aba obsoleta entra em conflito e mantém seu código, mostrando a versão salva separadamente. A escolha explícita de manter ou carregar ainda é protegida por nova comparação na gravação. Eventos de storage não são usados como trava.

Uma revisão editorial nova pode iniciar com a solução anterior, que permanece em seu registro original; a interface informa a mudança e permite inspecionar a versão anterior. Restauração pede confirmação. Copiar/download exportam somente texto. Revisões antigas não são apagadas automaticamente. A quantidade total depende da quota do navegador; armazenamento local não é backup, não sincroniza dispositivos e pode ser removido pelo navegador/usuário.

Falhas de abertura/leitura/quota/validação mantêm o texto em memória e oferecem retry, cópia e download. Sessões pendentes/com falha sobrevivem à navegação SPA em um mapa específico; sessões gravadas são liberadas. Há aviso beforeunload durante trabalho não confirmado, quando suportado. Sair/recarregar sem armazenamento funcionando ainda pode perder texto: baixar é a recuperação independente. IndexedDB não tem relação com SQLite legado ou journal do Studio. O Studio continua usando seu protocolo editorial e sessionStorage próprios.

O último acesso usa uma chave separada `bunkercode:last-lesson:v1` no localStorage. IDs são validados e o destino é conferido no manifesto atual antes de oferecer retorno. Falha desse histórico opcional não impede leitura. Não existe progresso ou conclusão implícita.

## Próximo passo

Revisar visualmente o MVP 03 e o exemplo editorial de Valores e tipos; decidir a revisão didática de Union types. Execução, avaliação automática, autenticação, sincronização e métricas de conclusão continuam fora do produto.
