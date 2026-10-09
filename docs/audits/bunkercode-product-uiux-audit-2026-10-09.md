# BunkerCode — Auditoria de produto, UI/UX e arquitetura

Data: **09/10/2026**, America/Recife. Missão exclusivamente de diagnóstico e planejamento; nenhuma proposta abaixo está implementada ou constitui autorização de implementação.

Checkout auditado: `/home/henrique/Projetos/BunkerCode`, branch `main`, HEAD `e9b15d35d8618ac12f298a112234d983b680a608`. Referências normativas: [AGENTS.md](/home/henrique/Projetos/BunkerCode/AGENTS.md), [README](/home/henrique/Projetos/BunkerCode/README.md), [arquitetura ativa](/home/henrique/Projetos/BunkerCode/docs/architecture/overview.md) e [autoria](/home/henrique/Projetos/BunkerCode/docs/authoring.md). A implementação foi examinada independentemente dos documentos históricos.

## 1. Resumo executivo — resultado e direção

**O MVP possui uma base coerente para leitura e autoria local, mas ainda não está validado como ambiente durável de aprendizagem pessoal. Recomendo a alternativa B: manter o header, tornar o índice de lições recolhível e preservar uma coluna de leitura confortável.** Painéis de anotações podem evoluir sobre essa base; prática com execução exige uma decisão arquitetural separada.

A navegação global **já está no header**. A sidebar atual é um índice contextual do curso, exclusivo do Leitor. Assim, a mudança desejada é menor do que uma substituição integral do shell. Cursos e Studio já funcionam sem sidebar permanente. A identidade escura/âmbar e o renderer Darcula devem permanecer.

Há **um problema P1 reproduzido de inicialização**: `pnpm --filter @bunkercode/backend start` falha com `Cannot find module 'express'`. O código importa Express diretamente, mas o pacote só o recebe transitivamente. Os testes passam porque os launchers de `tsx`/Playwright exportam `NODE_PATH`, mascarando a dependência. Não é falha do compilador nem simples falta de instalação do Chromium.

Os demais achados prioritários são de qualidade da experiência: índice que antecede todo o conteúdo no mobile; largura consumida pela navegação no tablet; comentários e regex abaixo do contraste mínimo; pergunta didática sem correspondência no exemplo; edição Markdown sem quebra visual de linhas; prévia mais larga que o Leitor; ausência de orientação de foco/título na troca de rota. Não foi demonstrada falha P0, execução de Markdown, exposição de arquivos por traversal ou perda de conteúdo canônico pelo protocolo de salvamento.

Os cinco comandos solicitados passaram: lint, typecheck, 18 testes de backend/autoria, build e 10 E2E. **Isso não aprova integralmente o produto:** o smoke de inicialização adicional falhou, há warning de bundle e limitações de acessibilidade/usabilidade que a suíte não mede.

## 2. Escopo, estratégia e preservação

### O que foi feito e por quê

Leitura de código e contratos; revisão dos testes e suas fixtures antes de executá-los; execução dos gates; inspeção visual de catálogo, curso, Leitor, Studio e prévia em 390, 768, 1024 e 1440 px; medição de layout; prova controlada de tabelas/âncoras e índice longo; benchmark público; planejamento incremental de anotações e prática. O objetivo foi separar falhas reproduzíveis, limites conhecidos e decisões de produto.

Estado inicial: somente `?? repomix-output.xml`, preservado e não usado como substituto do código. Worktrees existentes: principal em `main`; `57fc` no mesmo HEAD destacado; `6cd5` e `ce17` em `46633e1`, também destacados. Nenhum criado, removido ou alterado pela auditoria.

Inventário por diretório dos ignorados: `.bunkercode/`, `.bunkerlab/`, `.backendlab/`, `node_modules/`, `apps/*/node_modules/`, `apps/*/dist/`, além de resíduos `labs/001-request-lifecycle/{dist,node_modules}` e `packages/lab-sdk/{dist,node_modules}`. São dados/saídas locais, não evidência de módulos ativos. Nenhum banco aposentado foi aberto, migrado ou removido. Builds atualizam saídas geradas ignoradas; testes geram somente fixtures e evidências novas.

Único novo documento autorizado no repositório: este relatório. Scripts de diagnóstico, cópia de conteúdo, logs, capturas e resumo portátil ficam em [pasta temporária da auditoria](/tmp/codex-handoff/2026-10-09-bunkercode-audit-79ylcL). Não houve alteração de código, testes versionados, manifestos canônicos, dependências, configuração ou documentos normativos. Não houve commit, push ou operação destrutiva de Git.

### Grau das evidências

- **Comprovado:** leitura direta de implementação e/ou reprodução desta rodada.
- **Risco potencial:** mecanismo plausível, sem ocorrência demonstrada.
- **Limitação conhecida:** comportamento existente compatível com o escopo, mas relevante para uso/evolução.
- **Decisão aceitável:** trade-off adequado ao MVP local.
- **Melhoria opcional:** benefício possível, sem defeito demonstrado.

P0: perda grave/segurança demonstrada; P1: impacto alto; P2: relevante não bloqueante; P3: refinamento. Custos são estimativas de esforço, não prazos: pequeno até aproximadamente um dia; médio alguns dias; grande uma iniciativa com provas e integração. Não incluem descoberta extensa ou certificação de acessibilidade.

## 3. Pontos fortes a preservar

1. **Conteúdo independente da interface:** manifesto único para identidade e ordem; Markdown físico por lição. Novo curso/lição é descoberto sem editar React/Nest. [courses.ts:64](/home/henrique/Projetos/BunkerCode/apps/backend/src/content/courses.ts:64), [courses.ts:150](/home/henrique/Projetos/BunkerCode/apps/backend/src/content/courses.ts:150).
2. **Renderer consolidado e inerte:** `skipHtml`, sanitização e highlighting da linguagem explícita; ausência de `rehype-raw`, MDX e execução. Leitor e Studio usam o mesmo componente. [Markdown.tsx:6](/home/henrique/Projetos/BunkerCode/apps/frontend/src/courses/Markdown.tsx:6).
3. **Salvamento honesto:** versão por hash, lock exclusivo, temporário no mesmo diretório, flush, revalidação, rename e cleanup antes da confirmação. Não trata erro de comunicação como sucesso. [studio.ts:64](/home/henrique/Projetos/BunkerCode/apps/backend/src/content/studio.ts:64).
4. **Recuperação e conflito explícitos:** texto perdedor continua no editor; usuário revisa o arquivo e escolhe a nova base; descartar pede confirmação. Journal por aba e proteção contra resposta tardia de editor desmontado. [Studio.tsx:95](/home/henrique/Projetos/BunkerCode/apps/frontend/src/courses/Studio.tsx:95), [Studio.tsx:148](/home/henrique/Projetos/BunkerCode/apps/frontend/src/courses/Studio.tsx:148).
5. **Segurança proporcional ao uso local:** loopback, paths derivados, symlinks recusados, limite de bytes e proteções HTTP antes de parsing. [main.ts:4](/home/henrique/Projetos/BunkerCode/apps/backend/src/main.ts:4), [application.ts:28](/home/henrique/Projetos/BunkerCode/apps/backend/src/application.ts:28).
6. **Pouca infraestrutura:** um AppModule, controller fino e funções específicas. Não é necessário criar repositórios genéricos, uma camada universal ou design system para três áreas.
7. **Bons testes de comportamento:** arquivo físico, conflito entre abas, refresh, UTF-8/CRLF, falha de flush, limites, origem e inércia de Markdown; não só snapshots ou mocks de implementação.
8. **Identidade e linguagem:** visual discreto, bom contraste da prosa, hierarquia clara, links reconhecíveis e exemplos identificados como demonstrativos. Não atribuem experiência inventada ao autor.

## 4. Achados priorizados

### AUD-01 — P1 — Backend compilado depende de Express não declarado

**Categoria/natureza:** backend, distribuição e validação; problema comprovado. **Confiança:** alta.

**Evidência:** import em [application.ts:3](/home/henrique/Projetos/BunkerCode/apps/backend/src/application.ts:3), script `start` e dependências em [package.json:8](/home/henrique/Projetos/BunkerCode/apps/backend/package.json:8). `express` não consta em `dependencies`; `@types/express` não fornece runtime. `pnpm --filter @bunkercode/backend start`, com conteúdo descartável e porta 3013, encerrou com código 1. [Log reproduzido](/tmp/codex-handoff/2026-10-09-bunkercode-audit-79ylcL/start-smoke.log). Os wrappers locais `.bin/playwright` e `.bin/tsx`, linhas 27–30, exportam o diretório transitivo `.pnpm/node_modules` em `NODE_PATH`.

**Impacto:** o servidor compilado não inicia em ambiente normal, apesar de build/E2E verdes. **Recomendação:** declarar a dependência de runtime efetivamente importada e incluir smoke de `start` sem `NODE_PATH` herdado. Não usar variável global ou hoisting como correção definitiva. **Custo/risco:** pequeno; mudança de lockfile e verificação de versão compatível. **Dependências:** nenhuma decisão de layout. Correção não realizada nesta missão.

### AUD-02 — P2 — Índice permanente penaliza tablet e cresce antes da leitura no mobile

**Categoria/natureza:** Leitor/navegação; limitação comprovada, agravamento futuro demonstrado por fixture. **Confiança:** alta nas medidas, média na preferência individual.

**Evidência:** [reader.css:125](/home/henrique/Projetos/BunkerCode/apps/frontend/src/courses/reader.css:125), [reader.css:375](/home/henrique/Projetos/BunkerCode/apps/frontend/src/courses/reader.css:375). Em 768 px, sidebar de 185 px + gap de 32 px deixam 495 px para prosa. Em 390 px o título começa em y≈339 com apenas duas lições. Fixture com 30 entradas, criada somente em `/tmp`, levou o título a y≈1479. Desktop não limita a altura do índice nem lhe oferece rolagem própria; índice alto cresce junto do documento.

**Impacto:** leitura começa mais abaixo e código exige mais rolagem horizontal; navegar por um curso grande prejudica chegar ao conteúdo. **Recomendação:** índice recolhível acessível com botão textual e indicação da lição atual; manter largura confortável da prosa ao fechá-lo. **Custo/risco:** médio; foco, overlay, histórico e posição de leitura. **Dependências:** decisão de layout B. Não é alegação de que sidebar seja sempre ruim: dois links visíveis são úteis no desktop atual.

### AUD-03 — P2 — Contraste insuficiente em dois grupos de tokens

**Categoria/natureza:** acessibilidade do código; problema comprovado por CSS e cálculo. **Confiança:** alta.

**Evidência:** [reader.css:278](/home/henrique/Projetos/BunkerCode/apps/frontend/src/courses/reader.css:278), [reader.css:325](/home/henrique/Projetos/BunkerCode/apps/frontend/src/courses/reader.css:325). Texto de 14 px sobre `#23272C`: comentários `#808080` ≈ **3,80:1**; regex `#646695` ≈ **2,77:1**. Tokens confirmados no DOM de fixture JavaScript. São inferiores a 4,5:1 para texto normal; não se trata de texto grande. Referência: [WCAG 2.2, contraste mínimo](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

**Impacto:** comentários didáticos e expressões regulares ficam menos legíveis. **Recomendação:** elevar luminância desses tons mantendo suas famílias e a identidade Darcula; verificar todas as cores em leitor/prévia. **Custo/risco:** pequeno; testes que hoje exigem cores exatas precisarão acompanhar a decisão. **Dependências:** aceite de ajuste pontual de paleta. A prosa `#E8E5DE` sobre `#111417` mede ≈14,69:1; não há motivo para trocar o tema inteiro.

### AUD-04 — P2 — Pergunta de revisão desconectada do exemplo de Union types

**Categoria/natureza:** conteúdo/UX de aprendizagem; problema comprovado. **Confiança:** alta.

**Evidência:** [lesson.md:84](/home/henrique/Projetos/BunkerCode/content/courses/typescript/lessons/union-types/lesson.md:84) pergunta sobre `toFixed` e uma condição que não aparecem no bloco. O exemplo mistura enum, generics, decorator, classe, async e iterador; é útil como amostra de highlighting, mas sobrecarrega uma introdução a unions.

**Impacto:** o estudante não consegue responder à revisão a partir do exemplo e pode atribuir a dificuldade a si. **Recomendação:** o autor decidir se a lição demonstrativa deve voltar a um exemplo mínimo de union/narrowing ou se a amostra de tokens deve ficar em fixture de apresentação. Não escrever conclusão autoral automaticamente. **Custo/risco:** pequeno; revisão pedagógica humana. **Dependências:** intenção editorial. Não exige editor executável.

### AUD-05 — P2 — Textarea sem quebra visual dificulta escrever prosa

**Categoria/natureza:** Studio; limitação comprovada. **Confiança:** alta.

**Evidência:** `wrap="off"` em [Studio.tsx:286](/home/henrique/Projetos/BunkerCode/apps/frontend/src/courses/Studio.tsx:286), `white-space: pre` e overflow em [studio.css:97](/home/henrique/Projetos/BunkerCode/apps/frontend/src/courses/studio.css:97). Na captura de 390 px, parágrafos ficam cortados dentro do textarea e exigem deslocamento horizontal. O campo começa em y≈514 numa viewport de 900 px; o teclado virtual não foi simulado.

**Impacto:** revisão de parágrafos e edição pelo celular exigem duas direções de rolagem. **Recomendação:** testar soft wrap visual preservando bytes/quebras do arquivo; reduzir espaço introdutório recorrente se o autor sentir atrito. Não substituir o textarea por editor sofisticado por aparência. **Custo/risco:** pequeno a médio; verificar CRLF, caret e fences. **Dependências:** decisão de experiência de autoria, independente do editor de exercícios.

### AUD-06 — P2 — Prévia compartilha renderer, mas não a largura efetiva do Leitor

**Categoria/natureza:** autoria/consistência; limitação comprovada. **Confiança:** alta.

**Evidência:** [studio.css:107](/home/henrique/Projetos/BunkerCode/apps/frontend/src/courses/studio.css:107), [reader.css:127](/home/henrique/Projetos/BunkerCode/apps/frontend/src/courses/reader.css:127). Em 1440 px: prosa do Leitor 750 px, prévia 930 px; em 390 px: 350 e 312 px. A diferença muda quebras de linha e altura mesmo com tokens e renderer idênticos. Medidas completas no apêndice.

**Impacto:** prévia não reproduz exatamente a leitura final; o autor pode revisar densidade em uma medida diferente. **Recomendação:** compartilhar a medida de leitura ou oferecer uma prévia explicitamente no tamanho do leitor. **Custo/risco:** pequeno; verificar containers e cascata, não só `.prose`. **Dependências:** largura escolhida para B. Não é falha de sanitização nem de consistência das cores.

### AUD-07 — P2 — Trocas de rota sem orientação explícita de foco e título

**Categoria/natureza:** acessibilidade/navegação; lacuna comprovada, impacto com leitor de tela ainda não testado. **Confiança:** alta no código/DOM; média no impacto assistivo.

**Evidência:** [App.tsx:14](/home/henrique/Projetos/BunkerCode/apps/frontend/src/App.tsx:14), [index.html:7](/home/henrique/Projetos/BunkerCode/apps/frontend/index.html:7). Não há skip link ou gestão de foco/título por página. Na navegação Próxima, foco terminou em `BODY` e título continuou `BunkerCode`. O scroll nessa reprodução voltou a zero; **não foi demonstrado bug de permanecer no meio da lição**. Loading desmonta conteúdo em [api.ts:32](/home/henrique/Projetos/BunkerCode/apps/frontend/src/courses/api.ts:32), logo não há contrato robusto de restauração.

**Impacto:** orientação pior para teclado/leitor de tela e abas indistinguíveis. **Recomendação:** skip link, título por curso/lição/Studio, foco previsível no heading após navegação e política explícita para Back. **Custo/risco:** médio; não roubar foco durante digitação ou hash links. **Dependências:** coordenar com drawer do índice e painéis futuros; não depende de autenticação.

### AUD-08 — P2 — Erro de API não JSON expõe mensagem técnica em inglês

**Categoria/natureza:** frontend/estados assíncronos; problema comprovado. **Confiança:** alta.

**Evidência:** [api.ts:38](/home/henrique/Projetos/BunkerCode/apps/frontend/src/courses/api.ts:38) chama `response.json()` antes de tratar falha de HTTP. Com backend indisponível, proxy respondeu sem JSON e a tela mostrou `Failed to execute 'json' ... Unexpected end of JSON input`. [Captura da tentativa inicial](/tmp/codex-handoff/2026-10-09-bunkercode-audit-79ylcL/reader-390.png).

**Impacto:** existe recuperação por “Tentar novamente”, mas o diagnóstico não ajuda o autor a perceber que a API não iniciou. **Recomendação:** fallback em português para rede, payload inesperado e erro HTTP, mantendo detalhes técnicos em diagnóstico. **Custo/risco:** pequeno; preservar mensagens válidas do backend. **Dependências:** nenhuma. Não confundir com a falha de startup AUD-01: são comportamentos diferentes.

### AUD-09 — P2 condicional — Tabelas GFM e âncoras de headings não são suportadas

**Categoria/natureza:** contrato Markdown; limitação comprovada, não regressão do contrato documentado. **Confiança:** alta.

**Evidência:** [Markdown.tsx:8](/home/henrique/Projetos/BunkerCode/apps/frontend/src/courses/Markdown.tsx:8) não registra parser GFM nem IDs de headings. Fixture `| Tipo | Uso |` produziu parágrafo com pipes, zero elementos `table`; `## Seção` produziu `h2` sem ID, logo o link `#secao` não encontra destino. HTML bruto não é alternativa, pois é ignorado. [Captura](/tmp/codex-handoff/2026-10-09-bunkercode-audit-79ylcL/fixture-desktop.png).

**Impacto:** comparações tabulares e links internos de estudo não funcionam como alguns autores esperariam. **Recomendação:** decidir o dialeto; documentar o atual ou adicionar suporte restrito a tabelas/âncoras quando houver conteúdo real que necessite. **Custo/risco:** médio; semântica de cabeçalho, overflow, IDs repetidos e sanitização. **Dependências:** decisão editorial; estabilizar antes de anchors pessoais. A ausência de GFM não é vulnerabilidade.

### AUD-10 — P3 — Bundle inicial inclui recursos de leitura/autoria para o catálogo

**Categoria/natureza:** performance; warning comprovado, lentidão não demonstrada. **Confiança:** alta no tamanho; média no benefício de otimização.

**Evidência:** imports estáticos em [App.tsx:9](/home/henrique/Projetos/BunkerCode/apps/frontend/src/App.tsx:9); build gerou JS de **580,88 kB / 180,92 kB gzip**, CSS 10,45 kB. Há warning Vite >500 kB. O arquivo único inclui o caminho de Markdown/highlighting/Studio.

**Impacto:** custo inicial desnecessário cresce se adicionar um editor de código. **Recomendação:** medir carregamento e interação; considerar lazy loading de Studio e, futuramente, editor de exercícios; restringir linguagens do highlighter só com evidência e contrato. **Custo/risco:** pequeno a médio; fallback de loading, CSS e preservação dos rascunhos. **Dependências:** prioridade real de performance. Não recomendar apenas aumentar o limite do warning.

### AUD-11 — P3 — Catálogo tem apresentação de entrada longa para uso recorrente

**Categoria/natureza:** refinamento opcional de produto. **Confiança:** alta na observação; média no benefício.

**Evidência:** [Pages.tsx:34](/home/henrique/Projetos/BunkerCode/apps/frontend/src/courses/Pages.tsx:34), [reader.css:17](/home/henrique/Projetos/BunkerCode/apps/frontend/src/courses/reader.css:17). Em 390 px o primeiro card começa por volta de y=507; iniciais de TypeScript aparecem como “TY”, derivadas das duas primeiras letras. A descrição explica a natureza demonstrativa e é relativamente longa. Não há CTA separado “Começar”; o percurso catálogo → curso → primeira lição funciona em dois cliques.

**Impacto:** mais rolagem recorrente; não impede descoberta com um curso. **Recomendação:** avaliar intro mais compacta e “Abrir primeira lição” apenas se o uso repetido justificar. Não adicionar busca, filtros, progresso ou módulos vazios para dois itens. **Custo/risco:** pequeno; evitar links aninhados no card. **Dependências:** feedback do autor após uso de conteúdo real.

### AUD-12 — P2 condicional — Respostas de leitura são assumidas, não validadas

**Categoria/natureza:** frontend/contratos; risco potencial demonstrável no desenho, sem crash real de produção observado. **Confiança:** alta na ausência de validação.

**Evidência:** [api.ts:50](/home/henrique/Projetos/BunkerCode/apps/frontend/src/courses/api.ts:50) usa `value as T` quando não recebe parser; Cursos/Leitor não passam parser. Studio valida sua resposta em [studio-api.ts:33](/home/henrique/Projetos/BunkerCode/apps/frontend/src/courses/studio-api.ts:33). Não há error boundary em App.

**Impacto:** resposta 200 incompatível pode resultar em erro de renderização em vez de estado recuperável. O produtor atual valida conteúdo, então não é motivo para reescrever contratos ou instalar schema framework agora. **Recomendação:** validar fronteiras consumidas com pequenas funções próximas ao cliente ao ampliar a API; testar um payload incompatível. **Custo/risco:** pequeno a médio; evitar duplicação extensa de schemas. **Dependências:** evolução de contratos ou hardening do frontend.

## 5. Auditoria de Cursos e navegação global

O catálogo atual tem um curso e duas lições. Card inteiro clicável, título, descrição e contagem tornam a descoberta simples. Não há filtros ou busca; isso é adequado ao volume atual. Curso vazio e catálogo vazio possuem instrução de autoria. O catálogo ordena cursos pelo nome da pasta; lições seguem a ordem do manifesto. Não existe conceito ativo de módulo/seção no modelo: `lessons` é uma lista plana. Agrupamento futuro exige proposta de schema, preservação da ordem e necessidade editorial real; não deve ser simulado por componentes vazios.

A página do curso oferece retorno, título, descrição e lista numerada. Primeira lição está evidente; um botão “Começar” seria conveniência. A referência a arquivos e Git na UI é compatível com o primeiro usuário autor, mas poderá ficar no Studio/guia se o foco de leitura crescer. O ícone diagonal do card sugere saída externa visualmente, embora navegue internamente; é refinamento P3, não erro funcional.

Header de 76 px (68 no mobile), marca e “Cursos” formam o shell. O link usa `NavLink`, portanto há estado ativo sem inventar caminho de navegação adicional. Sidebar oferece curso e lição ativa; paginação mostra títulos de anterior/próxima e retorno na última. Studio tem breadcrumb visual curso/retorno, mas não um landmark de breadcrumb. “Editar lição” é contextual e evita uma página Studio sem lição selecionada. Preservar esse vínculo; colocar “Studio” genérico no header exigiria definir seu destino.

Links/botões são nativos, foco visível âmbar e landmarks de navegação têm nomes. Falta skip link, título dinâmico e política de foco/restauração (AUD-07). Não inferir acessibilidade completa a partir desses elementos. Sem ensaio com leitor de tela, teclado virtual ou zoom assistivo nesta rodada.

## 6. Auditoria do Leitor

### Medidas observadas

Capturas de conteúdo canônico copiado, viewport de altura 900 px, Brave/Chromium desktop com largura ajustada. Não é teste em aparelho físico.

| Viewport | Prosa Leitor | Prosa prévia | Índice | Título da lição, y |
| --- | ---: | ---: | --- | ---: |
| 390 px | 350 px | 312 px | Antes do conteúdo, sem recolher | 338,6 px |
| 768 px | 495 px | 658 px | 185 px + gap 32 px | 165 px |
| 1024 px | 679 px | 914 px | 225 px + gap 64 px | 165 px |
| 1440 px | 750 px | 930 px | 225 px + gap 64 px | 165 px |

Não houve overflow horizontal **do documento** nas 16 telas de catálogo/curso/leitor/editor. Isso não elimina o scroll interno de código/textarea. A medição da prévia foi separada; screenshots abrangem também essa visualização. [Dados JSON](/tmp/codex-handoff/2026-10-09-bunkercode-audit-79ylcL/visual-round-2/measurements.json).

### Tipografia e conteúdo

Prosa 17 px, line-height 1,85 (31,45 px), 16 px abaixo de 700 px. Headings principais têm peso 650; `h2` 25 px, `h3` 20 px. Parágrafos com 18 px de margem e `h2` com 44 px antes criam leitura espaçada e clara. Não encontrei evidência para diminuir globalmente a tipografia ou preencher toda a largura de 1440 px com linhas de texto. Ganhar espaço útil significa acomodar contextos sem esmagar a leitura, não alongar todas as linhas.

Listas e citações são legíveis; blockquotes de 15 px distinguem observações. Links na prosa têm cor e sublinhado. Links HTTP externos abrem nova aba com `noopener noreferrer`; considerar aviso acessível de nova aba como refinamento. Headings profundos dependem mais do estilo nativo; não foram encontrados no conteúdo atual e não justificam uma taxonomia obrigatória. Tabelas/âncoras têm o limite descrito em AUD-09. Imagens têm max-width, mas não há entrega de assets relativos de lição pelo backend; um fluxo de imagens locais precisará de contrato próprio antes de ser prometido.

Blocos de código: 14 px/21 px, padding 16×18 px, linguagem explícita, boa separação da prosa e scroll interno. Sem autodetecção ou execução. A paleta tem um problema de contraste localizado (AUD-03). O bloco extenso de Union types torna a lição longa por conteúdo, não por um defeito de layout; reduzir margens não resolve a incoerência pedagógica.

A sidebar ajuda na orientação em 1440 px e mantém a ordem visível; com duas lições sobra espaço vertical. Em tablet tem custo mais visível. Em mobile o índice transforma-se em introdução obrigatória antes de cada lição. B permite escolher seu uso, mantendo a ordem acessível com um clique adicional. Capturas: [390](/tmp/codex-handoff/2026-10-09-bunkercode-audit-79ylcL/visual-round-2/reader-390.png), [768](/tmp/codex-handoff/2026-10-09-bunkercode-audit-79ylcL/visual-round-2/reader-768.png), [1024](/tmp/codex-handoff/2026-10-09-bunkercode-audit-79ylcL/visual-round-2/reader-1024.png), [1440](/tmp/codex-handoff/2026-10-09-bunkercode-audit-79ylcL/visual-round-2/reader-1440.png).

## 7. Auditoria do Studio

O textarea é uma escolha adequada ao escopo. Não há motivo demonstrado para transformá-lo em IDE. Edição e prévia são alternadas por botões com `aria-pressed`, em grupo nomeado; isso é um padrão simples aceitável, sem necessidade de fingir tabs ARIA incompletas. Estado sem alterações, pendente, salvando e salvo é anunciado com `role=status`; erros têm `role=alert`.

Salvar bloqueia o campo, compara confirmação textual e só limpa o buffer após retorno válido. Falha de rede preserva texto. O fluxo de conflito exige reler a versão física; manter texto muda a base, mas não salva automaticamente; carregar arquivo pede confirmação. Resposta tardia não deve limpar uma edição de uma nova montagem, coberto pelo E2E. LF e CRLF uniformes são preservados; quebra mista é normalizada pelo textarea, limitação documentada.

O journal guarda Markdown, base e versão em `sessionStorage` por curso/slug. Funciona na aba, inclusive após navegação/refresh, mas **não é armazenamento de notas pessoais nem backup**. Fechar a aba ou impedir o armazenamento pode perder rascunho; há aviso. A falta de banco/auth não é defeito. Há escrita síncrona de JSON no storage a cada alteração; possível custo perto de 256 KiB, sem medição de atraso nesta rodada. Não trocar o mecanismo preventivamente sem preservar a recuperação atual.

Atritos: wrap desligado (AUD-05), largura de prévia (AUD-06), toolbar fora da viewport durante longas edições e comparação textual manual sem diff. Comparação manual é aceitável no MVP; diff é opcional se conflitos forem frequentes. A alternância desmonta textarea/prévia ([Studio.tsx:283](/home/henrique/Projetos/BunkerCode/apps/frontend/src/courses/Studio.tsx:283)); caret/scroll não têm estado explícito de restauração. É um risco de continuidade a verificar em uso prolongado, não perda de texto comprovada.

Não recomendo salvamento automático no Markdown canônico: o botão explícito e a revisão posterior do Git dão controle ao autor. Anotações e exercícios não devem usar esse buffer nem o endpoint editorial.

## 8. Auditoria técnica do frontend

`App.tsx` tem 44 linhas e concentra shell/rotas. `Pages.tsx` tem 205 linhas com catálogo/curso/leitor e estado comum; `Markdown.tsx`, 48; `Studio.tsx`, 331. Não há mega framework de componentes. Crescimento futuro deve separar responsabilidades concretas: índice de lições reutilizado por drawer, estado de carregamento em arquivo próprio quando deixar de pertencer a Pages, journal/conflito do Studio somente quando sua manutenção pedir. Não extrair dezenas de componentes de uma só utilização por tamanho de arquivo.

`useContent` cancela requisições na mudança de caminho/desmontagem e evita publicar resposta cancelada. Loading e erro são explícitos, sem cache que esconda edição física. Problemas: parsing antes de status (AUD-08), cast sem validação (AUD-12), título/foco (AUD-07). Não há polling nem gerenciamento global de estado desnecessário. Curso completo dentro da resposta da lição fornece ordem e navegação com uma consulta, aceitável no volume atual.

CSS próprio dividido em global, reader e studio é suficiente. Há acoplamento concreto: estilo de “Editar lição” pertence a `studio.css` importado por Studio, mas usado pelo Leitor; lazy loading precisa preservá-lo. Classes globais `.page-width` e `.studio-page` têm a mesma especificidade; a ordem de imports faz a largura observada prevalecer sobre intenções locais. Não confundir nomes separados de arquivos com encapsulamento. Uma pequena regra compartilhada de medida e tokens de cores resolveria necessidades reais sem design system.

Performance: renderizar Markdown só na prévia/leitor evita parse em cada tecla na visão de edição. UI tem um bundle inicial grande (AUD-10), mas não foi feito perfil de CPU, rede lenta, INP/LCP ou Markdown máximo. Não afirmar que ela é lenta. Editor especializado futuro deve entrar sob demanda e não encarecer a leitura.

Segurança: sanitizer seguido por plugin confiável de highlighting, sem raw HTML; links `javascript:`/`data:` recusados pelos testes. Imagens Markdown remotas ainda podem gerar requisições externas; isso não é XSS, mas deve ser política consciente se houver conteúdo de terceiros. Não há alegação de exfiltração demonstrada. Futuras notas devem permanecer texto escapado ou passar pelo mesmo pipeline seguro, nunca HTML recebido do storage.

### Cobertura e lacunas

A suíte cobre ordem, descoberta de curso/lição, refresh, conteúdo ausente/inválido/vazio, inércia, links perigosos, aparência dos tokens, duas abas, falhas de rede e escrita, perda de confirmação, CRLF e rotas aposentadas. Capturas/overflow atuais focam 1280/390; a auditoria adicionou observação em 768/1024/1440 sem editar a suíte.

Lacunas relevantes para próximo incremento: startup compilado sem ambiente herdado, foco/skip/title/Back, contraste em vez de só igualdade de hex, índice longo, preview com mesma medida, edição mobile com teclado real, falha/quota de storage em navegador real, HTTP não JSON, Unicode/seleção para futuras notas. Não prometer cobertura de Safari/Firefox, leitor de tela, 200–400% zoom ou desempenho máximo: não executados aqui.

## 9. Auditoria técnica do backend

### Organização, contratos e integridade

AppModule registra apenas ContentController. Controller delega a leitura/escrita; funções de conteúdo validam manifesto e derivam paths. É um monólito pequeno com separação por arquivos, não uma divisão completa em módulos Nest por domínio. Isso é aceitável com um domínio ativo. Um futuro módulo de dados pessoais pode nascer quando existir consumidor; não criar agora interfaces de repositório sem uso.

GETs de catálogo, curso e lição leem disco sob demanda e usam `Cache-Control: no-store`. PUT recebe somente Markdown e versão. Há recusa de campos desconhecidos, slugs inválidos/duplicados, tamanhos e arquivos inesperados. O retorno inclui SHA-256 dos bytes UTF-8; serve como revisão de conteúdo, não como ID permanente da lição.

| Situação | Contrato observado | Avaliação |
| --- | --- | --- |
| ID/payload inválido | 400 | Explícito e adequado |
| Origem/Host/comando inadequados | 403 | Proteção de escrita local |
| Curso/lição desconhecidos | 404 | Distinto de arquivo editorial inconsistente |
| Base obsoleta/lock | 409 | Evita sobrescrita silenciosa entre Studios |
| Markdown >256 KiB | 413 | Verificado em bytes, não caracteres |
| Content-Type de escrita incorreto | 415 | Parser protegido |
| Manifesto/path/Markdown inválido | 422 | Diagnóstico de conteúdo |
| Filesystem/cleanup sem confirmação | 500 | Pode exigir releitura para determinar resultado |

Manifesto limitado a 64 KiB por `stat`; Markdown limitado a 256 KiB também durante a leitura. Parser JSON de 1600 KiB comporta expansão por escapes e é registrado só na área de conteúdo, após as proteções. Nenhum parser/executor aposentado foi reintroduzido.

### Caminhos e segurança local

IDs/slugs restritos, caminho derivado, pertencimento ao manifesto, `realpath` da raiz e `lstat` por componente recusam traversal e symlinks comuns. Leitura Markdown abre com `O_NOFOLLOW`, exige arquivo regular, limita bytes efetivos e valida UTF-8. O servidor não recebe path arbitrário.

Há diferença de robustez entre leitura do manifesto e Markdown: manifesto usa `lstat` seguido de `readFileSync` ([courses.ts:123](/home/henrique/Projetos/BunkerCode/apps/backend/src/content/courses.ts:123)); não tem o mesmo descriptor com limite de leitura efetiva/UTF-8 estrito. Um escritor externo pode modificar o arquivo entre verificação e leitura. **Risco potencial de baixa prioridade no modelo local confiável**, não bypass demonstrado nem razão para classificar como P0. Reavaliar se houver importação não confiável, automação concorrente ou exposição remota.

Bind em loopback e validação de Origin/Host/Fetch Metadata/comando dificultam escrita por outra página web. Cabeçalho estático não é autenticação, e programas locais podem imitá-lo. Essa limitação é aceitável para o MVP; não publicar o Studio nem reaproveitar esse mecanismo como proteção de execução hostil. Ausência de auth/banco não aparece como defeito nesta auditoria.

### Concorrência e durabilidade

Lock por lição usa criação exclusiva e não remove lock preexistente. Hash é comparado antes e imediatamente antes de rename. Temporário fica no mesmo diretório; permissões simples são preservadas; flush precede rename; erros de cleanup invalidam confirmação. Testes desta rodada cobriram salva concorrente, edição externa durante flush, falha de flush e lock existente.

Limites conhecidos e aceitáveis com comunicação clara: VS Code não participa do lock; permanece corrida mínima entre última leitura e rename; rename evita truncamento pelo Studio, mas não garante durabilidade de diretório contra queda de energia; inode muda; ACL/xattrs/metadata especial não são preservados; crash pode deixar lock/temporário. Não foi provocado crash real nem corte de energia. Não recomendar expiração automática de lock sem protocolo de propriedade: pode liberar escritor vivo. Recuperação manual deve continuar preservando os arquivos.

I/O síncrono bloqueia event loop, mas é limitado e simplifica a janela crítica num usuário local. Não há evidência para trocar tudo por banco/async agora. Um catálogo enorme e execução de código mudariam esse perfil; então medir e separar carga.

**Conclusão de evolução:** após corrigir AUD-01, o backend é uma base razoável para novos endpoints locais pequenos com os mesmos cuidados. **Ele não é um sandbox de execução.** Aproveitar Nest para contratos e coordenação não autoriza executar código submetido dentro do processo da API.

## 10. Benchmark público e comparação de layouts

### Referências observadas em 09/10/2026

Amostra de páginas públicas, sem login, submissão, execução ou investigação de infraestrutura interna. Acesso web disponível; páginas dinâmicas de Codédex/freeCodeCamp ficaram vazias na extração textual inicial, mas carregaram no navegador. Não generalizar estas telas para todas as experiências/mobile dessas plataformas.

| Plataforma / evidência | Padrão observado ou documentado | Aplicação possível no BunkerCode | Limite / o que não importar |
| --- | --- | --- | --- |
| [Boot.dev — lição TypeScript](https://www.boot.dev/lessons/e70b9105-aa89-4ccd-8623-cc483b5b9a48) | Header global, seletores recolhidos de capítulo/lição numa barra superior; leitura à esquerda, editor à direita; ação Next | Índice acessível sob demanda e contexto atual sempre identificável | Run/Submit bloqueados sem login; não executados. Não importar XP, quest board, streak ou duas barras densas |
| [Codédex — Setting Up](https://www.codedex.io/python/01-setting-up) | Header com curso/capítulo; explicação à esquerda, código à direita e terminal abaixo; controle de índice e Back/Next no rodapé | Separar instrução, edição e resultado; índice não precisa ocupar coluna permanente | Sem submissão; não inferir persistência ou sandbox. Tipografia pixel, comunidade e XP não combinam com identidade atual |
| [Exercism — documentação do editor](https://exercism.org/docs/using/solving-exercises/using-the-online-editor/) | Documenta editor à esquerda e instruções/resultados à direita, com Run Tests e posterior submissão | Resultado verificável separado de enunciado e solução | Evidência documental, não sessão autenticada; posição esquerda/direita é escolha, não regra universal |
| [freeCodeCamp — lab de JavaScript](https://www.freecodecamp.org/learn/javascript-v9/lab-javascript-trivia-bot/lab-javascript-trivia-bot) | Header, skip link, breadcrumb, controles de visibilidade de Instructions/editor/Console, três áreas; anúncio de navegação observado no DOM | Painéis contextuais com estado exposto e orientação de foco | Sem executar testes; não copiar três colunas para mobile nem certificações/progresso |

Capturas próprias: [Boot.dev](/tmp/codex-handoff/2026-10-09-bunkercode-audit-79ylcL/benchmark-boot.png), [Codédex](/tmp/codex-handoff/2026-10-09-bunkercode-audit-79ylcL/benchmark-codedex.png), [freeCodeCamp](/tmp/codex-handoff/2026-10-09-bunkercode-audit-79ylcL/benchmark-freecodecamp.png). Exercism: fonte oficial textual. Não há evidência aqui de painel de anotações pessoais dessas quatro plataformas; essa proposta decorre da necessidade do BunkerCode.

### A, B e C

| Critério | A — Atual refinado | B — Header + índice recolhível | C — Ambiente contextual de aprendizagem |
| --- | --- | --- | --- |
| Espaço útil | Bom desktop; tablet continua pagando pela coluna | Recupera espaço em tablet e para contextos, sem obrigar prosa larga | Divide espaço por tarefa; pode ficar apertado com painéis simultâneos |
| Navegação | Índice imediatamente visível | Botão textual “Lições”, curso/lição atual e paginação persistem | Mesma base de B + alternância leitura/notas/prática |
| Descoberta | Alta para lições; limitada para novas funções | Boa com rótulos/estado; não usar ícone isolado | Exige explicar o que está aberto, salvo e disponível |
| Interações | Um clique para outra lição no índice | Abrir + selecionar, ou um clique por anterior/próxima | Mais ações de abrir/fechar/trocar contexto |
| Acessibilidade | Corrigir foco/skip/contraste; menor novidade | Drawer exige Escape, foco de retorno, estado e controle de background quando modal | Soma gestão de seleção, painéis, editor, resultados e foco |
| Responsividade | Pode melhorar, mas índice acima de tudo escala mal | Overlay no mobile; opção de fixar apenas onde couber | Uma tarefa principal por vez em telas pequenas; evitar três panes |
| Complexidade | Baixa | Média, localizada no shell do Leitor | Alta se notas, prática e execução entrarem juntas |
| Manutenção | Menor hoje | Moderada e compatível com estrutura atual | Estados persistentes, revisões e conflitos de mais domínios |
| Regressões | Contraste/spacing e navegação | Scroll, foco, acesso ao curso, prévia, índice ativo | Rascunhos, âncoras, resize, teclado virtual, desempenho |
| Adequação atual | Aceitável para duas lições | **Melhor próximo passo** após correções | Excessiva como primeira entrega |
| Adequação futura | Espaço lateral disputado | Base suficiente para anotações gerais | Destino possível se prática e notas forem usadas de fato |

**Recomendação:** B como alteração localizada e C como possibilidade composta por incrementos independentes. A continua uma opção legítima se o autor preferir o índice sempre visível; nesse caso, corrigir mobile e acessibilidade ainda é necessário.

Direção proposta, sem mockup ou implementação: manter marca/Cursos no header; expor “Lições” com nome do curso e contexto atual; reservar a maior área contínua ao artigo. Prosa pode permanecer próxima dos atuais 750 px em desktop; código/contextos podem usar espaço adicional. Índice e notas não devem, por padrão, comprimir a prosa ao mesmo tempo. Em desktop largo, permitir um painel de notas ao lado quando a largura mínima de leitura for preservada; em 390/768 px, usar painel sobreposto ou visão alternada com retorno ao ponto de leitura. Os breakpoints finais precisam ser validados pelo conteúdo, não por um número arbitrário de dispositivo.

Drawer modal: foco inicial no título/controle apropriado, Escape fecha, retorno ao disparador, fundo inerte e fechamento após selecionar lição. Painel lateral não modal: não prender foco; ordem de tabulação clara e botão de fechar. Usar semântica nativa quando possível. `aria-expanded`, nome acessível e indicação de lição atual devem refletir estado real. Não construir um gerenciador universal de painéis.

## 11. Proposta mínima de anotações e highlights

### Separação essencial e experiência

Três fluxos distintos: **ler** consulta Markdown canônico; **anotar** grava dados pessoais; **autoria** altera Markdown somente pelo Studio. Um botão “Anotações” abre a coleção da lição; nota geral independe de seleção. Fechar o painel mantém scroll e não dispara navegação. Editar/remover afeta somente a nota; remoção deve permitir desfazer ou confirmar conforme a implementação futura.

Primeiro incremento funcional: notas gerais por lição, criar/consultar/editar/remover, indicador real de persistência e exportação/importação. Highlights entram depois: seleção válida oferece “Destacar” e “Comentar trecho”; o painel mostra citação e comentário e permite voltar à passagem. Um highlight sem comentário também é um registro, não uma alteração editorial. Começar com uma cor acessível; tags, pesquisa global, sync, colaboração e revisão espaçada não são necessários.

### Persistência local sem autenticação

| Opção | Benefícios | Limites / custo | Decisão proposta |
| --- | --- | --- | --- |
| `localStorage` | API pequena, persiste entre sessões, suficiente para preferências | Síncrono, strings, cota/limpeza por origem, concorrência de read-modify-write entre abas | Usar para preferência de painel, não como coleção crescente inteira |
| IndexedDB | Assíncrono, registros/indexes/transações, cabe bem a notas e rascunhos por chave | Migrações de schema, falhas/quota, dados ainda dependem de navegador/origem e podem ser apagados | **Preferência para v1 pessoal em um navegador**, com export/import obrigatório e confirmação de gravação |
| Backend local | Dados podem sobreviver à troca de navegador/porta e ser incluídos em backup explícito | Novos endpoints, path seguro, concorrência, formato/revisão e recuperação; não oferece sync remoto por si | Preferir já no início somente se independência do navegador for requisito do autor |

Base técnica: [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API), [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API). Nenhuma dessas opções exige autenticação no escopo estritamente local; nenhuma é backup automaticamente. `sessionStorage` atual do Studio não atende notas de longo prazo. Trocar `127.0.0.1` por `localhost`, porta ou perfil troca a origem e o conjunto de dados do navegador; explicar isso e suportar transporte por exportação.

Se a decisão for backend, criar armazenamento novo e dedicado, por exemplo dados pessoais em diretório próprio sob `.bunkercode`, sem abrir os bancos históricos e sem misturar com `content/courses`. Arquivo por lição com substituição atômica e revisão otimista é opção inicial; SQLite novo só se consultas/transações o justificarem. Não reaproveitar PUT editorial nem inventar um serviço genérico de persistência. Diretório final e política de backup exigem decisão posterior.

### Menor modelo funcional proposto

Registro versionado com: `schemaVersion`, `id` opaco da anotação, `lessonKey` (`courseId` + `lessonSlug`), `sourceVersion` do Markdown, `body` textual, `createdAt`, `updatedAt`, `revision` para concorrência e `target` opcional. `target` ausente indica nota geral; presente contém `exact`, `prefix`, `suffix`, `start`, `end` e `textProjectionVersion`. Highlight é target presente com body vazio. Cor única inicial dispensa paleta persistida. Guardar os registros por lição, sem duplicar todo o Markdown em cada nota.

A chave curso/slug é a identidade disponível hoje, estável **enquanto não houver renomeação/reuso**; nunca usar posição na lista ou título. Hash identifica revisão, não identidade. Para v1, estabelecer contrato de slugs estáveis e remapeamento explícito em renomeação. Se renomear/mover lições se tornar rotina, introduzir ID imutável no manifesto com migração deliberada; o validador atual rejeitaria campo novo. Não adicionar UUIDs silenciosamente na auditoria. Separar também o escopo do acervo ao importar notas de outro repositório, evitando colisões de `typescript/union-types` entre instalações.

Em múltiplas abas, salvar registro usando revisão esperada numa transação; edição stale deve conservar texto local e oferecer revisão. Uma notificação entre abas melhora atualização, mas não substitui controle transacional. Exportação inclui schema e identificação do acervo; importação valida estrutura, limites, strings e colisões de IDs, sem sobrescrever automaticamente notas divergentes. Limite inicial de tamanho por nota/coleção deve ser explícito e testado, não presumido pelo espaço do navegador.

### Vinculação de trechos e reconciliação

O princípio é inspirar-se em citação exata com contexto e posição, como os seletores de texto do [W3C Web Annotation Data Model](https://www.w3.org/TR/annotation-model/#text-quote-selector), sem implementar JSON-LD/protocolo universal. Não persistir apenas XPath, seletor CSS ou índices dos filhos do DOM: React/Markdown podem mudar a árvore sem mudar a frase.

Proposta específica para o produto:

1. Gerar uma projeção determinística do texto didático **renderizado**, excluindo header, índice, botões, etiquetas de linguagem e `pre`. Pode incluir `strong`, `em`, links e código inline. Definir separadores entre blocos, whitespace e unidade de offsets (por exemplo UTF-16 com conversão explícita dos offsets de nós); versionar essa regra. A retirada do primeiro H1 por `lessonBody` deve fazer parte da projeção. Offsets de Markdown bruto não correspondem ao texto selecionado.
2. Converter o `Range` selecionado em offsets dessa projeção usando mapa de nós textuais. Aceitar seleção através de elementos inline e, se aprovada para v1, de parágrafos consecutivos; rejeitar seleção fora do artigo ou que atravesse blocos excluídos com orientação clara. Testar emojis, acentos, espaços, direção inversa da seleção e links.
3. Persistir citação, prefixo/sufixo curtos, posição e hash da revisão. Não salvar HTML selecionado. No reaparecimento, conferir posição + citação na mesma revisão.
4. Se a revisão mudar, procurar citação exata e comparar contexto. Só religar automaticamente quando houver correspondência inequívoca; frase repetida exige contexto suficiente. Proximidade numérica é pista, não prova. Nunca escolher simplesmente a primeira ocorrência.
5. Se faltar trecho ou houver ambiguidade, conservar a nota e a citação como **“trecho não localizado / requer revisão”**. Não destacar passagem aproximada como certa. Oferecer nova seleção manual e atualização da âncora; editar corpo da nota não deve descartá-la. Curso/lição ausente mantém nota órfã exportável.

Estado de resolução (`attached`, `ambiguous`, `orphaned`) pode ser derivado/cacheado; não precisa ser segunda fonte canônica. Busca fuzzy, histórico integral de texto e reconciliação automática complexa ficam fora do mínimo. Mudança de renderer/dialeto também pode alterar a projeção; `textProjectionVersion` evita tratar offsets antigos como corretos.

### Renderização, XSS e acessibilidade

Manter `ReactMarkdown` e a sanitização. Inserir marcas controladas no pipeline de apresentação dividindo nós de texto sem alterar os elementos semânticos; nunca concatenar citação em `innerHTML` nem aplicar `surroundContents` indiscriminadamente a seleção que atravessa elementos. Um pequeno adaptador específico de leitura pode mapear trechos sanitizados para marks. CSS Custom Highlight API é alternativa a avaliar por compatibilidade, mas não deve ser pré-requisito sem teste e fallback; não foi prototipada nesta missão.

Overlaps precisam de regra determinística: união visual de intervalos da mesma cor, registros separados no painel. Não gerar links/botões dentro de links Markdown nem centenas de tab stops em cada fragmento. A lista de notas oferece controles de editar/excluir/ir ao trecho; ao saltar, colocar foco num destino compreensível e preservar retorno. Cor não deve ser a única pista de existência de comentário. Texto de nota deve ser escapado como conteúdo comum; se aceitar Markdown depois, usar o mesmo renderer e limites.

No mobile, preservar os controles nativos de seleção; o painel não pode apagar a seleção antes da criação. Guardar a âncora proposta antes da troca de foco, mas só persistir após a ação do usuário. Criar nota geral deve funcionar inteiramente por teclado; vínculo de trecho precisa de fluxo acessível alternativo no painel, por exemplo localizar/selecionar passagem com confirmação. Leitor de tela, teclado virtual e seleção entre elementos são gates próprios desta fase, não benefícios presumidos.

**Limitação central:** v1 não garante que toda anotação sobreviva vinculada a qualquer reescrita; garante que a observação pessoal não desapareça e que vínculos incertos sejam explícitos. Criar, editar ou remover notas deve manter idêntico o hash do Markdown canônico.

## 12. Editor de código e exercícios futuros

### Três caminhos avaliados

| Caminho | Uso adequado | Benefícios | Custo/riscos e critério de adoção |
| --- | --- | --- | --- |
| A — Textarea sem execução | Escrever uma função curta, prever resultado, copiar para ambiente externo | Sem dependência nova; simples, acessível e leve | Indentação/seleção limitadas; dizer “rascunho salvo”, nunca “resposta correta”. Bom primeiro experimento se houver exercício real |
| B — Editor especializado sem execução | Exercícios com edição frequente em que highlighting/indentação reduzem esforço | Melhor manipulação de código e produtividade | Carregamento sob demanda, estado/undo, acessibilidade, mobile e integração exigem validação |
| C — Execução e testes | Objetivo pedagógico verificável que precisa de feedback no site | Resultado concreto relacionado à revisão enviada | Grande aumento de escopo, segurança operacional, processos, recursos e resultados; iniciativa posterior separada |

**CodeMirror 6** é candidato inicial para B por sua composição em pacotes, documentada no [repositório oficial](https://github.com/codemirror/dev); validar ergonomia, acessibilidade e peso com as extensões realmente usadas. Não houve instalação/benchmark local. O acesso a `codemirror.net` falhou na ferramenta web; não atribuo métricas ou garantias de mobile não verificadas.

**Monaco** faz sentido se serviços de linguagem TypeScript, diagnósticos e múltiplos arquivos virtuais se tornarem necessários. Modelos, providers, workers e descarte exigem integração; o [README oficial](https://github.com/microsoft/monaco-editor) afirma que navegadores mobile não são suportados. Isso é uma restrição relevante para 390 px, e não apenas uma preferência de bundle. Não escolher porque se parece com VS Code. Bibliotecas de highlighting estático atuais não são editores. Para necessidades menores, textarea continua sendo a alternativa de referência.

### Espaço e continuidade

Em leitura, manter artigo central. Em prática, abrir enunciado e editor lado a lado apenas se cada um conservar largura útil; em tablet/mobile, alternar “Explicação” e “Código” ou empilhar com links de retorno ao enunciado. Não manter índice + notas + editor + leitura simultaneamente. Resultado só aparece quando existir execução ou validação real. Evitar placeholders de terminal na etapa sem execução.

Redimensionamento não é requisito inicial: proporções fixas bem escolhidas e toggle de foco resolvem primeiro. Se usado depois, oferecer equivalente por teclado, mínimo/máximo de largura, reset e persistência de preferência; não reduzir leitura a uma faixa estreita. Preservar documento, seleção/undo e posição ao alternar painéis. Carregar editor sob demanda sem remontar seu modelo a cada clique.

### Dados separados

Enunciado/arquivo inicial/linguagem/ID/revisão de exercício pertencem a definição editorial própria, vinculada explicitamente à lição; não extrair todo fence Markdown como exercício. O contrato exato (arquivo JSON + enunciado Markdown, por exemplo) depende do primeiro exercício real. Não modificar `course.json` nem reintroduzir `activityId` nesta missão; qualquer novo campo exigirá decisão/migração compatível com o validador atual.

Rascunho pessoal é identificado por acervo, lição, exercício e revisão inicial. Se a definição mudar, preservar a solução e oferecer revisão, sem reset silencioso. Exportar/copiar e apagar rascunho são ações diferentes de salvar conteúdo canônico. Compartilhar apenas conceitos e padrões de revisão com Studio, não seu endpoint ou seu buffer.

### Requisitos para eventual execução

O monólito pode validar pedidos e coordenar resultados. O código do estudante precisa de uma fronteira separada do processo Nest, sem acesso ao repositório, dados pessoais, secrets, sockets do host ou rede por padrão. Um processo filho comum limita falhas acidentais, mas não basta contra código hostil. `node:vm` não é mecanismo de segurança, conforme [documentação oficial](https://nodejs.org/api/vm.html); [permissões do Node](https://nodejs.org/api/permissions.html) também não devem ser tratadas como substituto universal de isolamento hostil.

Antes de implementar C, especificar e validar:

- Linguagem/runtime e dependências permitidas, um exercício/arquivo primeiro; sem instalação arbitrária de pacotes durante tentativa.
- Snapshot imutável do código enviado e revisões de exercício, testes e runtime; resultado identifica exatamente o que executou. Se o editor mudar, marcar resultado como referente a versão anterior.
- Diretório temporário exclusivo, usuário sem privilégios, mounts mínimos/readonly, acesso à rede negado, sem variáveis de ambiente herdadas sensíveis.
- Limites de tempo de parede/CPU, memória, processos, tamanho de arquivos e saída; truncamento de output comunicado; concorrência local limitada.
- Timeout/cancelamento que encerre toda a árvore/grupo de processos, aguarde término e faça limpeza somente dos recursos próprios. Nenhuma limpeza genérica de diretórios históricos.
- Estados tipados distintos: compilação inválida, testes falharam, erro do programa, timeout/limite, cancelado, falha da infraestrutura e resultado indeterminado. Um runner indisponível não equivale a “você errou”.
- Testes adversariais para loop infinito, subprocessos, flood de stdout, leitura/escrita indevida e falha do runner/cleanup. Output exibido como texto inerte.

Container bem configurado ou mecanismo mais forte pode compor a solução; não escolher tecnologia nem afirmar segurança sem threat model e prova. Web Worker/iframe não fornecem runtime Node completo nem equivalem a isolamento do host. Não expor esse serviço remotamente por consequência da interface.

Do histórico, reutilizar conceitualmente revisão imutável, separação entre erro de código/infraestrutura, limites, cancelamento e evidências. Não recuperar automaticamente LearningModule, tentativas/submissões, runtime manager, supervisor genérico ou SQLite aposentado. O histórico é referência, não biblioteca obrigatória nem backlog autorizado.

## 13. Riscos, dependências e roadmap incremental

As fases abaixo são opções de trabalho, **não compromisso de execução**. Custos são relativos. A intenção é terminar unidades pequenas e verificáveis, mantendo o autor estudando entre elas.

| Fase | Escopo e motivação | Dependências / custo | Critérios de aceite verificáveis |
| --- | --- | --- | --- |
| 0 — Confiabilidade atual | AUD-01, mensagem de API e revisão pedagógica de Union types; ajuste pontual de contraste | Aprovação do autor; pequeno | `start` funciona sem `NODE_PATH`; API pronta em fixture; rede/JSON inválido mostram erro útil; pergunta aponta para exemplo real; tokens ≥4,5:1; gates preservados |
| 1 — Navegação B e leitura | Índice recolhível, foco/skip/title e largura coerente da prévia; avaliar soft wrap no Studio | Escolha B; médio | 390/768/1024/1440 sem overflow da página; índice de 30 itens não antecede compulsoriamente o artigo; abrir/fechar por teclado, Escape/retorno de foco; lição ativa e anterior/próxima corretos; refresh/deep link/Back previsíveis; Studio não perde rascunho; mesmo renderer/medida de leitura |
| 2 — Notas gerais | CRUD pessoal por lição, persistência escolhida e export/import | Decisão de identidade/armazenamento; médio | Nota sobrevive a fechar/reabrir; erro de gravação conserva texto; edição concorrente não sobrescreve silenciosamente; import/export round-trip; apagar nota não altera Markdown; nenhuma chamada PUT editorial ao anotar |
| 3 — Highlights e comentários por trecho | Seleção, projeção textual, citação/contexto e reconciliação conservadora | Fase 2; dialeto Markdown estabilizado; médio a grande | Seleção atravessa `strong`/links sem quebrá-los; frases repetidas não religam à ocorrência errada; Unicode/CRLF e alterações de parágrafo cobertos; órfãos editáveis/exportáveis; painel fecha sem perder lugar; teclado/mobile/leitor de tela verificados; comentário HTML fica inerte |
| 4 — Prática sem execução | Um exercício real, textarea ou prova comparativa de CodeMirror, rascunho separado | Necessidade pedagógica e modelo de exercício; médio | Nenhum código roda; copiar/exportar funciona; rascunho sobrevive a mudança de visão/reload; troca de revisão do exercício não apaga solução; 390 px utilizável; bundle do leitor não incorpora editor antecipadamente |
| 5 — Decisão de execução | Threat model e prova de um runner isolado somente se benefício justificar | Aceite específico; grande | Revisões de código/testes/runtime identificadas; erros de infra separados; timeout mata descendentes; limites e ausência de acesso a conteúdo/dados/rede demonstrados; cleanup próprio testado; gate de segurança antes de integrar à UI |

Sequência de dependências: confiabilidade → navegação/leitura; identidade/persistência → notas gerais → highlights. Prática pode ser avaliada independentemente de highlights; execução depende de requisitos próprios, não de parecer pronta visualmente. Não tornar usuário refém da conclusão de um “workspace” completo.

Riscos principais: misturar anotação com autoria; vincular nota à frase errada após edição; perder rascunho em remontagem; encobrir contrato quebrado com testes que herdam ambiente; aumentar bundle e complexidade antes de haver exercícios; expor serviço local sem rever segurança. Mitigar com fronteiras de dados, revisão explícita, fixtures isoladas e aceites por comportamento. Atualizar documentação normativa **apenas numa futura implementação aprovada**, quando o comportamento realmente mudar.

## 14. Decisões abertas e revisão manual do autor

1. **Próximo recorte:** autorizar correções de confiabilidade/legibilidade e escolher B como evolução localizada; decidir se índice fica recolhido por padrão ou se há preferência de fixação no desktop. Recomendação: recolhido em telas estreitas, opção explícita no desktop, sem alterar identidade.
2. **Propriedade das anotações:** um navegador com IndexedDB + export/import é suficiente ou a durabilidade independente do navegador exige backend já no início? Fixar também política de slugs/renomeação e exportação. A decisão determina o primeiro incremento, não a aparência do painel.
3. **Prática:** confirmar que primeiro será um exercício sem execução, com rascunho separado, e definir qual exercício pedagógico real justifica o editor. Execução precisa de aprovação futura própria. Recomendação: A primeiro ou pequena prova de B quando a edição justificar; C adiado.

Outras decisões que podem esperar: dialeto GFM/âncoras, prioridade de imagens locais, agrupamento em módulos, editor especializado, resize e migração para IDs imutáveis. Não precisam bloquear usar o Studio hoje.

Revisar manualmente: conforto da coluna de 750 px; frequência de uso do índice; escrever um parágrafo longo no celular; comparar leitor/prévia; coerência de Union types; manter versus carregar arquivo em conflito. Para acessibilidade, reservar uma rodada com leitor de tela, zoom e teclado virtual; em especial testar anúncio de estado e retorno de foco de painéis. Não houve pesquisa com usuários externos nem medição de aprendizagem; preferências de layout são recomendações fundamentadas, não resultado de teste de satisfação.

## 15. Review final, validações e handoff

### Gates executados nesta auditoria

Ambiente: Linux, Node **v26.5.0**, PNPM **11.20.0**; Chromium via Brave instalado em `/opt/brave.com/brave/brave`. Não foi instalado navegador/dependência. O requisito README é Node 24+; não houve matriz específica em Node 24.

| Comando / verificação | Resultado desta rodada | Evidência / ressalva |
| --- | --- | --- |
| `pnpm lint` | Passou, exit 0 | [lint.log](/tmp/codex-handoff/2026-10-09-bunkercode-audit-79ylcL/lint.log) |
| `pnpm typecheck` | Passou, exit 0 | Apps e tsconfigs de testes; [typecheck.log](/tmp/codex-handoff/2026-10-09-bunkercode-audit-79ylcL/typecheck.log) |
| `pnpm test` | **14 backend + 4 autoria**, todos passaram; zero skips/cancelados | [test.log](/tmp/codex-handoff/2026-10-09-bunkercode-audit-79ylcL/test.log) |
| `pnpm build` | Passou, exit 0, com warning | JS 580,88 kB / gzip 180,92 kB; [build.log](/tmp/codex-handoff/2026-10-09-bunkercode-audit-79ylcL/build.log) |
| `BROWSER_PATH=/opt/brave.com/brave/brave pnpm test:browser` | **10 passaram, 33,1 s**, sem retries/skips/falhas | Comando inclui novo build; [browser.log](/tmp/codex-handoff/2026-10-09-bunkercode-audit-79ylcL/browser.log) |
| Smoke adicional `pnpm --filter @bunkercode/backend start` | **Falhou**, exit 1, `Cannot find module 'express'` | AUD-01; não corrigido |
| Inspeção visual isolada | Concluída na segunda tentativa com workaround só de processo | Primeira falhou porque API não iniciou; capturas de erro preservadas. Segunda usa `NODE_PATH` transitivo explicitamente; não valida correção do startup |
| Matriz visual | Catálogo, curso, leitor, editor e prévia nas quatro larguras | 20 capturas + navegação; zero `pageerror` na rodada concluída |
| Fixture Markdown/índice | Zero tabelas; heading sem ID; 30 entradas deslocam título no mobile | Fora do conteúdo canônico; não é novo curso do produto |
| `git diff --check`, status e diff | Sem alterações em arquivos rastreados preexistentes | Novo relatório não rastreado conferido separadamente; estado final abaixo |

Segurança dos testes: backend/autoria criam diretórios `mkdtemp`; teste do Studio usa Git descartável, sem commit. Playwright copia `content`, usa portas 3012/5184 e novas saídas: [capturas browser-results-0eaUY3](/home/henrique/Projetos/BunkerCode/.bunkercode/browser-results-0eaUY3) e [status browser-results-KXoBwy](/home/henrique/Projetos/BunkerCode/.bunkercode/browser-results-KXoBwy). A configuração cria `outputDir` via `mkdtempSync` durante sua avaliação; nesta rodada, runner e worker deixaram status/capturas em diretórios distintos. Isso preserva evidências, mas dificulta encontrá-las; consolidar o identificador da rodada é refinamento opcional, sem impacto no produto. Inspeção visual usa cópia própria em `/tmp`, portas 3013/5185. Nada escreve nas lições canônicas. A fixture de 30 entradas foi usada somente para layout da primeira lição, não para validar navegação/conteúdo das outras 29.

Warnings: bundle >500 kB nos builds; mensagens de `NO_COLOR` ignorado por `FORCE_COLOR` nos subprocessos do E2E. Não houve flaky/retry na suíte. A repetição de build faz parte de `test:browser`, não tentativa de esconder falha. Houve rerun **do diagnóstico visual**, mantendo as primeiras evidências, após aplicar workaround temporário de resolução. A falha de startup permanece uma falha do contrato de dependências, não um teste aprovado por esse rerun.

Não executados: runner aposentado e seus testes removidos; nenhum foi recriado. Também não foram feitos pentest completo, fuzzing, processo local hostil, testes de crash/queda de energia, carga, WebKit/Firefox, dispositivo físico, leitor de tela ou protótipos de anotações/exercícios. Resultados históricos não foram contados como testes desta missão.

### Arquivos importantes e como o sistema funciona

Fluxo atual: `App` resolve rota → `useContent` busca API → controller delega às funções de conteúdo → manifesto define identidade/ordem e Markdown fornece texto → renderer seguro apresenta. Studio mantém buffer/base/versão → PUT validado → escrita física com lock/hash/rename → confirmação → revisão manual do Git.

- [App.tsx](/home/henrique/Projetos/BunkerCode/apps/frontend/src/App.tsx): shell e rotas.
- [Pages.tsx](/home/henrique/Projetos/BunkerCode/apps/frontend/src/courses/Pages.tsx): Cursos e Leitor.
- [Markdown.tsx](/home/henrique/Projetos/BunkerCode/apps/frontend/src/courses/Markdown.tsx) e [reader.css](/home/henrique/Projetos/BunkerCode/apps/frontend/src/courses/reader.css): apresentação compartilhada.
- [Studio.tsx](/home/henrique/Projetos/BunkerCode/apps/frontend/src/courses/Studio.tsx) e [studio-api.ts](/home/henrique/Projetos/BunkerCode/apps/frontend/src/courses/studio-api.ts): rascunho, revisão e confirmação.
- [courses.ts](/home/henrique/Projetos/BunkerCode/apps/backend/src/content/courses.ts), [markdown-file.ts](/home/henrique/Projetos/BunkerCode/apps/backend/src/content/markdown-file.ts), [studio.ts](/home/henrique/Projetos/BunkerCode/apps/backend/src/content/studio.ts): validação, leitura e escrita.
- [application.ts](/home/henrique/Projetos/BunkerCode/apps/backend/src/application.ts): proteções HTTP e parser.
- [playwright.config.ts](/home/henrique/Projetos/BunkerCode/apps/frontend/playwright.config.ts): isolamento de testes/evidências.

Conceitos a preservar: identidade editorial diferente de hash de revisão; dado pessoal diferente de conteúdo canônico; confirmação de gravação diferente de rascunho; editor diferente de executor; teste automatizado diferente de validação de usabilidade; processo local confiável diferente de sandbox hostil.

### Git e unidade entregue

Estado esperado ao entregar, conferido após criar o documento:

```text
branch: main
HEAD: e9b15d35d8618ac12f298a112234d983b680a608
?? docs/audits/bunkercode-product-uiux-audit-2026-10-09.md
?? repomix-output.xml  (preexistente)
```

Nenhum arquivo versionado anterior modificado, removido ou movido; nenhum commit/push; nenhum worktree criado/removido. Saídas ignoradas de build e novas fixtures/capturas são efeitos dos comandos autorizados de validação. Dados históricos permanecem preservados. Os processos temporários da inspeção foram encerrados ao fim; os sinais de término desses servidores não são falhas adicionais do produto. Este relatório é a unidade atômica concluída; o próximo passo exato é **o autor revisar as três decisões da seção 14 e escolher o primeiro recorte**, sem iniciar automaticamente a implementação.

**Review sugerido:** a base editorial é simples e possui boas proteções de escrita; corrigir a dependência de runtime e o contraste antes de expandir. O índice recolhível resolve o problema de espaço mais diretamente que reconstruir a interface. Dados pessoais devem nascer separados do Markdown; execução tem fronteira e custo próprios.

**Commit sugerido, somente para revisão/commit manual do autor:** `docs(audit): assess BunkerCode product UX and architecture`

Checklist final: evidências e limitações explicitadas; achados separados de preferências; backend examinado e startup testado; identidade preservada; leitura/autoria/notas/prática separados; roadmap com aceites; nenhuma proposta implementada; testes e falhas relatados sem transformar gates verdes em aprovação geral. O resumo portátil acompanha a entrega fora do repositório.
