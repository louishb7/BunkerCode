# Arquitetura atual do BunkerCode

Data: 2026-10-10. Esta é a referência ativa. O MVP 03 contém Home, Cursos, Leitor, prática de escrita e Studio. O Refinamento 01 adiciona atividade local, compilação, execução isolada e submissão não avaliada, com módulos específicos; a infraestrutura aposentada no MVP 02 permanece removida.

BunkerCode é uma plataforma pessoal e aberta para estudar programação e transformar entendimento em conteúdo autoral. O fluxo principal é estudar fora, praticar, escrever uma lição no repositório, revisar no site e fazer commit manualmente.

## Estrutura

- apps/frontend: React, React Router, Vite e Tailwind v4; Home, cursos, leitor Markdown, prática CodeMirror e Studio local.
- apps/backend: um monólito NestJS; leitura de cursos e escrita editorial segura.
- content/courses: manifestos de cursos e lições Markdown.
- scripts: comando de autoria e seus testes.
- docs: documentação atual, implementação e histórico selecionado.

A raiz configura o monorepo: package.json, pnpm-workspace.yaml, lockfile, ESLint, tsconfig.base.json e .gitignore. O tsconfig base compartilha strictness/target realmente usados pelas duas aplicações; DOM pertence ao frontend, Node e decorators ao backend. Vite, Playwright e tsconfigs específicos ficam nas aplicações. `packages/content` compartilha somente a validação editorial com consumidores reais nas duas aplicações. Não há Turborepo ou Nx.

## Conteúdo e leitura

course.json define id, título, descrição e ordem das lições. Cada entrada possui somente slug e título; campos obsoletos como activityId são recusados como desconhecidos. O caminho do Markdown é derivado: content/courses/<id>/lessons/<slug>/lesson.md. Não existe path livre vindo do navegador nem um índice duplicado em React/Nest.

O Leitor usa prosa de até 75ch, com sumário próximo e divisão redimensionável a partir de 1000 px; no mobile, empilha o conteúdo. O botão **Aparência da leitura** (ícone Type) abre um popover e persiste tamanho/tonalidade localmente, sem alterar a fonte do código. Escape devolve o foco ao botão; clicar fora fecha o popover. BunkerCode, curso atual e Início ficam no header; **Lições** e anterior/próxima formam um grupo acima do workspace, ou no topo da composição de leitura; não há breadcrumbs nem paginação no rodapé das lições. O índice usa `dialog` modal nativo com a ordem real do manifesto e a lição ativa; selecionar fecha o índice. Escape e Fechar devolvem o foco ao botão, o fundo fica inerte e a rolagem do documento é bloqueada. No mobile, o curso usa truncamento quando necessário e as setas mantêm ícones e labels acessíveis. A prévia do Studio compartilha a medida efetiva da prosa e a tipografia do título, sem a navegação do leitor.

A divisão usa dois tracks fracionários sobre o espaço restante após os dois gaps e a alça de 12px. ResizeObserver mede esse espaço; mínimos de 360px/360px na prática e 420px/180px no leitor limitam o movimento. A alça mantém pointer capture e calcula o deslocamento desde o início do gesto, evitando salto no clique. Teclado: setas ajustam dois pontos percentuais, Home/End atingem os mínimos e Enter ou duplo clique restaura a proporção. A preferência continua nas mesmas chaves locais; uma viewport menor limita a apresentação sem apagar a proporção guardada.

Todas as rotas têm conteúdo principal identificado para o skip link e título de documento contextual. Ao concluir o carregamento de uma rota, o foco vai para o título; navegação comum começa no topo, enquanto Voltar/Avançar restaura a posição registrada por entrada do histórico durante a sessão. Digitação não move o foco da edição. A alternância Fonte/Prévia mantém o foco no controle acionado e restaura a posição de cada vista e a seleção/scroll interno do textarea. Reload/deep link carrega o conteúdo diretamente e começa no topo; não há suporte novo a âncoras Markdown.

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
| Strings, números, comentários                                                                                                         | `hljs-string`, `hljs-number`, `hljs-comment`   | #7CB961, #6897BB, #808080                                           | Strings e números correspondem diretamente; comentários usam #909090 para contraste AA sobre #23272C.                                                           |
| Template literal com `${id}`                                                                                                          | `hljs-string` contendo `hljs-subst`            | String verde e interpolação #A9B7C6                                 | Interpolação neutra; spans internos continuam com suas cores.                                                                                                   |
| `{}`, `()`, `[]`, `<T>`, `=`, `\|`, `;`, `.`                                                                                          | Em geral texto sem span em TS                  | Pontuação/operadores e bracket pair colorization do editor          | Foreground base neutro #D4D4D4; sem cores por profundidade. Classes de operador/pontuação existentes em outras linguagens usam #A9B7C6.                         |

O bloco define sua própria fonte de 14px e line-height de 1.5 (21px), inclusive no `pre`, para não herdar as caixas de linha de 1.85 da prosa. Padding de 16px × 18px, margem vertical de 22px e cabeçalho de 8px × 18px reduzem a densidade excedente. Não removemos linhas em branco, indentação nem seleção; linhas longas mantêm scroll horizontal interno. Leitor e prévia compartilham renderer e regras. Fences sem linguagem, `plaintext` e tokens não reconhecidos mantêm #D4D4D4 e não usam detecção automática.

Os dois prints de VS Code enviados pelo autor orientam a densidade e a revisão visual: keywords alaranjadas, propriedades violetas, funções amarelas, strings verdes e comentários cinza. O resultado aproxima essa aparência, mas a classificação lexical não permite reproduzir integralmente semantic tokens, itálicos contextuais ou bracket pair colorization do editor.

## Carregamento do frontend

Cursos e a página de curso carregam no bundle inicial. Leitor e Studio usam React.lazy por rota; ambos compartilham um chunk de Markdown/highlighting que só é solicitado ao abrir leitura/autoria. ContentStatus permanece independente dessas páginas e oferece loading com role=status e erro recuperável para falha de chunk. O header e o skip link permanecem disponíveis. O CSS comum é importado pela entrada global; somente CSS específico do Studio acompanha seu chunk. Estados básicos dos controles e medidas de página/leitura usam variáveis pequenas, sem biblioteca de componentes.

O build gera manifest.json em dist/.vite para verificar o grafo de assets nos testes. A suíte E2E usa Vite preview do build de produção, com proxy local /api, para exercitar o carregamento real dos chunks e do CSS. `pnpm test:browser` continua compilando antes da suíte. O comando frontend isolado exige build prévio.

## Studio visual: editar e salvar

A rota `/courses/:id/lessons/:slug/edit` usa Tiptap como editor principal, CodeMirror nos exemplos e o renderer Markdown na prévia secundária. A fonte permanece em textarea como fallback. Ela edita apenas o Markdown de uma lição existente; não altera curso/manifesto nem cria arquivos. O estado do editor contém rascunho, Markdown de base e versão de base. O textarea usa soft wrap visual, preserva LF/CRLF conforme o contrato existente e permanece montado/oculto ao entrar na prévia. A prévia só é renderizada quando aberta, evitando highlighting a cada digitação. Seleção e posições de edição/prévia são locais à página, sem reimplementar o journal. A prévia usa o rascunho, enquanto leitor/disco continuam com a última gravação confirmada. Durante o PUT, a edição fica bloqueada; erros/confirmação inválida não limpam o rascunho. Um journal em sessionStorage por aba permite retomar navegação/reload, com aviso de falha; não substitui backup e desaparece ao fechar a aba.

A barra superior do Studio reúne voltar, slug, save e estado; fonte e prévia ficam em Mais opções. Sidebar e estrutura são específicas do documento, e a formatação aparece por seleção ou abertura explícita; em altura de viewport ≤500 px permanece no fluxo para não cobrir a edição. O título editável do próprio documento aparece uma vez no modo visual. A formatação usa ícones Lucide com tooltips, listas agrupadas e popover de links. Inserção usa posições de blocos de primeiro nível e geometria do DOM do ProseMirror; o menu + abre somente por clique. Quizzes e ações de blocos tornam-se contextuais à seleção. Exemplos CodeMirror têm altura pelo conteúdo com scroll interno e troca de linguagem por Compartment, preservando a instância e seu histórico.

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

A implementação editorial não introduz módulo genérico, banco, watcher ou integração Git. O controller delega à função específica de escrita; ContentController e PracticeController têm responsabilidades separadas. Testes usam cópias de conteúdo/dados e um índice Git descartável; não fazem commit nem editam conteúdo autoral canônico.

## Histórico: remoções do MVP 02

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

Home/Cursos ficam no bundle inicial. Leitor, Markdown e Studio continuam lazy; `PracticePanel` só é importado para uma definição de exercício válida. CodeMirror também é compartilhado com o Studio visual lazy para exemplos didáticos. A falha de chunk tem recuperação pela boundary de rota. `useContent` cancela respostas obsoletas. Sem exercício, a leitura combina artigo e sumário. Com prática, duas colunas redimensionáveis começam em 46%/54% a partir de 1000 px; abaixo disso, leitura e código permanecem empilhados e visíveis. Não há alternância Explicação/Código. O editor gerencia seleção e undo/redo durante sua montagem. Tab indenta, Escape seguido de Tab permite sair.

### Contrato editorial

`exercise.json` é opcional, ao lado de `lesson.md`. Sua identidade é explícita, independente do título; a revisão é SHA-256 dos bytes editoriais. A API de exercício é separada para que uma definição inválida não impeça leitura ou autoria. O path é derivado de curso/lição validados e pertencentes ao manifesto. O arquivo é aberto com O_NOFOLLOW, tipo regular, UTF-8 e limite de 64 KiB; campos desconhecidos e linguagens fora de TypeScript/JavaScript são recusados. Não há escrita desse arquivo pela interface nem interpretação de blocos Markdown como exercícios.

### Rascunhos de prática

`bunkercode-practice` é um IndexedDB novo e específico do navegador. Store `drafts`, registros schema 1, dentro do banco versão 2. O upgrade cria `activity` e `submissions` sem reescrever rascunhos existentes. A chave contém produto, curso, lição, ID de exercício e revisão editorial. Cada registro armazena texto, versão inteira e timestamp; limite de 64 KiB por código. A conclusão da transação confirma o estado salvo, nunca apenas o estado React. Escritas são serializadas e coalescem digitação ocorrida durante uma gravação.

Cada gravação lê a revisão esperada e faz o put na mesma transação readwrite. Uma aba obsoleta entra em conflito e mantém seu código, mostrando a versão salva separadamente. A escolha explícita de manter ou carregar ainda é protegida por nova comparação na gravação. Eventos de storage não são usados como trava.

Uma revisão editorial nova pode iniciar com a solução anterior, que permanece em seu registro original; a interface informa a mudança e permite inspecionar a versão anterior. Restauração pede confirmação. Copiar/download exportam somente texto. Revisões antigas não são apagadas automaticamente. A quantidade total depende da quota do navegador; armazenamento local não é backup, não sincroniza dispositivos e pode ser removido pelo navegador/usuário.

Falhas de abertura/leitura/quota/validação mantêm o texto em memória e oferecem retry, cópia e download. Sessões pendentes/com falha sobrevivem à navegação SPA em um mapa específico; sessões gravadas são liberadas. Há aviso beforeunload durante trabalho não confirmado, quando suportado. Sair/recarregar sem armazenamento funcionando ainda pode perder texto: baixar é a recuperação independente. IndexedDB não tem relação com SQLite legado ou journal do Studio. O Studio continua usando seu protocolo editorial e sessionStorage próprios.

O último acesso usa uma chave separada `bunkercode:last-lesson:v1` no localStorage. IDs são validados e o destino é conferido no manifesto atual antes de oferecer retorno. Falha desse histórico opcional não impede leitura. Não existe progresso ou conclusão implícita.

## Próximo passo

Revisar a Home com atividade real, os cursos introdutórios e o workspace do Refinamento 01; conferir a disponibilidade/limites de Docker e os registros locais. Revisões pedagógicas das lições autorais continuam a critério do autor. Revisar manualmente os novos fluxos do Studio e revisar os casos públicos de função e usar stdout apenas para objetivos de saída. Autenticação, sincronização e avaliação certificadora continuam fora do produto.

## Refinamento 01: atividade, editor e execução

A Home compacta apresenta atividade antes do grid de cursos. Continuar estudando é um link, validado pelo manifesto. Os cards de apresentação/retomada e a contagem isolada foram removidos. O conteúdo tem oito tecnologias; sete cursos introdutórios contêm duas lições cada, com fontes técnicas nas referências. A descoberta inicial da Home/catálogo é limitada a JavaScript Essencial, TypeScript, Node.js e NestJS, conforme a [política editorial](../product/course-visibility.md). IDs/rotas dos demais continuam disponíveis. Figuras são SVGs locais: sete da coleção Simple Icons com origem fixada e o Slonik de três cores da wiki PostgreSQL. Licença CC0 da coleção, atribuição CC BY 3.0 de Git, MIT de JavaScript e diretrizes de marcas estão registradas em `public/technologies/README.md`; não implicam afiliação ou endosso. Não há molduras duplas.

### Atividade local

IndexedDB `bunkercode-practice`, versão 2, mantém `drafts` e adiciona `activity` e `submissions`. A abertura fecha conexões em versionchange e informa bloqueio por abas antigas; nada é descartado. SQLite legado continua intocado.

`activity` registra schema, chave, tipo, scope, dia local, timestamp real e timezone de origem. Acesso: só após receber lição válida, uma vez por curso/lição/dia. Edição: mudança real do documento, uma vez por exercício/dia; abrir/recuperar sem editar não conta. A comparação de existência e o add ficam na mesma transação readwrite, evitando duplicidade entre abas. Cada Submit confirmado cria um evento próprio na mesma transação de sua solução. Eventos antigos são mantidos; somente a apresentação filtra 365 dias inclusivos. Dias avançam por calendário local, sem somar blocos fixos de 24 horas; timezone e dia do evento são preservados se o perfil mudar de fuso. BroadcastChannel, evento local, foco e atualização por minuto recarregam a Home, sem telemetria externa.

Intensidade verde representa a soma de eventos no dia (0, 1, 2, 3, 4+), com células fixas de 11 px e 3 px de intervalo. O cabeçalho mostra somente a quantidade total de eventos no período; indicadores adicionais não são exibidos. O refinamento visual não altera os critérios, stores ou registros existentes. Não há XP, ranking, streak ou conclusão. Falha de leitura é explícita; não se mostra zero como sucesso após falha. O heatmap tem meses, legenda, informação por dia via nome acessível/title e navegação por setas com um único dia na ordem de Tab.

### Editor e ferramentas

CodeMirror mantém Darcula e acrescenta autocomplete por árvore sintática/escopo local do pacote JavaScript, palavras-chave, fechamento de delimitadores e busca. Sugestões não oferecem IntelliSense semântico ou LSP. Ctrl+Space abre, Enter aceita, Ctrl+F busca; Tab/Escape e undo/redo permanecem.

Formatter Prettier standalone com plugins TypeScript/Babel/ESTree roda em worker iniciado somente por **Formatar** (`WandSparkles`). O worker calcula mudanças pontuais com `diff` de `@codemirror/merge`; a instância existente do CodeMirror aplica uma única transação com seleção e scroll mapeados e histórico isolado. Código já formatado não cria transação nem elimina redo. Erro de sintaxe mantém o código. Um contador de alterações recusa resultados antigos, inclusive após editar e desfazer; movimentos de seleção durante a espera são respeitados. Clique com mouse preserva foco; conclusão não toma foco de outro controle escolhido durante a espera. **Restaurar código inicial** (`RotateCcw`) exige confirmação Radix e substitui o rascunho pelo `starterCode` usando a persistência existente, sem apagar submissões/revisões anteriores; limpa resultados exibidos da versão substituída. Ambos ficam na barra inferior, junto a Run e Submit; não existe duplicação em Opções do exercício. Copiar/Baixar aparecem somente em falha de armazenamento/envio.

Run e Submit capturam um snapshot explícito e usam compilação interna. A API oficial TypeScript 5.9 gera diagnósticos sintáticos e semânticos com strict e bibliotecas ECMAScript ES2022 locais; console possui uma declaração mínima. Não há DOM, tipos Node, imports externos, resolução de projeto ou acesso ao disco. JavaScript usa allowJs/checkJs. Emissão só ocorre sem diagnósticos. Compilação não aprova exercícios; a execução ocorre somente no runner. O worker de compilação nasce sob demanda, possui limite de entrada de 64 KiB e timeout/cancelamento de 15 s. Não há análise a cada tecla. Resultados exibem versão antiga quando o editor muda; troca de rota aborta a ferramenta.

### Run e fronteira de isolamento

Endpoints: GET `/practice/runtime`, POST `/practice/runs`, DELETE `/practice/runs/:id`. Comandos exigem o mesmo Host local, Origin exato, JSON, cabeçalho local e metadata same-origin do Studio. A API valida campos, tamanho, UUID, curso/lição/exercício conhecido e revisão editorial atual. Não há path, imagem, comando Docker ou opções livres no payload. Respostas associam UUID, SHA-256 do source e revisão do exercício; o cliente verifica essa identidade. Exercícios avaliáveis são recompilados no backend; casos de função e a solução executam exclusivamente no Docker. O backend compara os retornos reais e entrega contagem/feedback por caso. [Contrato público](../visual-authoring.md#avaliação-pública-de-exercícios).

O backend chama Docker CLI com argumentos fixos, sem shell, apenas para criar/iniciar/encerrar um container. Código via stdin é executado dentro da imagem oficial Node.js fixada por digest. O processo NestJS nunca executa o código. Exercícios com testes são recompilados em worker limitado antes do runner. Cada execução usa imagem readonly, UID/GID 65534, capabilities ALL removidas, no-new-privileges, seccomp padrão, rede none, nenhum volume/socket/arquivo/env do servidor, cgroup v2: 96 MiB, swap igual à memória, 0,5 CPU, 32 PIDs e 64 descritores. Há apenas tmpfs /tmp de 1 MiB, noexec/nosuid. Arquivos públicos da imagem são legíveis; não há filesystem editorial. O runtime Node dentro do container dispõe das suas APIs, sujeitas à fronteira do container; isso não é um simulador de APIs.

Timeout de execução 5 s, saída stdout/stderr conjunta até 32 KiB, duas execuções simultâneas e até 60 iniciações/minuto por processo backend. Exceções/exit status são reais. Limite de saída, cancelamento, desconexão e shutdown interrompem o container; a resposta só confirma término após remoção. Falha de limpeza suspende Run até reiniciar/verificar Docker. Não se herdam credenciais do backend no ambiente do container. Não existem processos de estudante no host. A imagem precisa estar instalada; não há pull automático. Ausência dos requisitos mantém a compilação interna de Run/Submit, mas informa a indisponibilidade de execução e não aprova a solução.

Containers compartilham o kernel do host: esta fronteira é destinada à instalação pessoal local, com Docker/kernel atualizados. Não equivale a isolamento de microVM nem autoriza expor o runner à internet ou a usuários hostis. Acesso ao daemon Docker é uma capacidade administrativa do backend; não há socket montado no container. [Segurança Docker](https://docs.docker.com/engine/security/) e [limites de recursos](https://docs.docker.com/engine/containers/resource_constraints/). Worker de análise é uma separação de desempenho; nunca foi usado como sandbox para executar estudante.

### Submit local

Submit revalida a solução atual e só registra conclusão local após aprovação do teste pelo backend. Sem teste configurado, sem runner ou com compilação inválida, o snapshot pode ser registrado como `unassessed`. Falha de teste registra `failed`; aprovação registra `passed`. A store mantém schema 1 e lê os envios antigos sem reinterpretação. Solução e evento submit continuam na mesma transação IndexedDB. Histórico é append-only; edição posterior sinaliza resultado antigo. Cancelamento interrompe o envio antes da persistência.

## Studio visual e avaliação

[Studio visual e blocos editoriais](../visual-authoring.md) documenta o Tiptap lazy, a barreira de conversão, fallback de fonte, sintaxe versionável e avaliação pública por stdout ou casos de função JSON versionados. Salvamento, rascunhos, revisão e fronteiras HTTP anteriores são preservados. Os exemplos didáticos usam CodeMirror separado da prática. O pacote compartilhado valida blocos antes de salvar e antes de renderizar. Não há contas nem serviços novos.


## Refinamento 03: workspace e autoria

Artigo e workspace usam um container compartilhado sem gap. O divisor vertical mede a largura útil real e preserva mínimos, preferência e teclado. O workspace possui abas, código, barra única, divisor horizontal e resultados. Run/Submit ficam à esquerda, utilitários de ícone à direita. A altura útil é medida descontando abas/barra/divisor; a proporção local não remonta o CodeMirror. O resultado inicial é discreto e o histórico alterna o painel inferior sem modal ou substituição do rascunho.

As tonalidades 0/1/2 mantêm a preferência antiga, agora com paletas Padrão BunkerCode/Azul profundo/Alto contraste, independentes do Darcula. Studio usa topo mínimo, menu de modos, sidebar estreita, estrutura real e formatação contextual. Não há novo store, executor genérico ou plataforma de avaliação; identidade, esquema IndexedDB e protocolos de autoria existentes permanecem. Os dois exercícios ativos possuem casos públicos de função e passam por compilação no backend e execução Docker. [Detalhes de uso, contrato e limites](../visual-authoring.md).
