# BunkerCode legado — auditoria para reconstrução

Data: 2026-10-07. Base: `2810761948da038a0c2007cc6bde0e25b988a167`, branch `main`, acompanhando `origin/main`. Estado inicial: `git status --short` vazio. Auditoria local; nenhum código do alvo enviado a serviços externos.

## Protocolo, escopo e continuidade

Objetivo: decidir quais materiais do legado merecem sobreviver ao produto novo, sem migrar, refatorar, apagar, mover ou alterar comportamento. Nova tese: aprender backend seriamente e abrir o caminho para outras pessoas estudarem junto; prática manual curta em TypeScript, Node.js, NestJS e PostgreSQL. “Ver ≠ entender”; análise estrutural pode ser infraestrutura pedagógica invisível. Learn/Practice/Lab/Build/Analyze são modos possíveis, não packages aprovados. A arquitetura de destino depende também da auditoria do BunkerLab.

Classificações: **MIGRATE** = material quase certamente necessário, com ação explicitada; **ADAPT** = capacidade útil, implementação/contrato atual não deve migrar intacto; **REFERENCE** = conhecimento útil sem consumidor atual que justifique código na base nova; **LEAVE LEGACY** = não pertence ao produto novo, candidato à demolição posterior. Funcionamento, quantidade de testes e esforço passado não justificam preservação. Gates: consumidor pedagógico concreto; solução menor; dependência da tese visual antiga; aluno pensar antes de receber resposta; evidência explicável.

Somente este documento pode ser criado/alterado nesta rodada. Essa autorização específica prevalece sobre a atualização habitual de ENGINEERING_LOG, DECISIONS, LEARNING_CHECKPOINT e checklist. A tese antiga do AGENTS não rege a seleção de produto nesta auditoria; suas regras de segurança, preservação de trabalho e verificação continuam aplicáveis. Nenhum commit/push autorizado.

O caminho solicitado foi mantido para facilitar continuidade. `.gitignore:19` ignora `*.md`, exceto README e info_legado: este relatório é **local e ignorado**, não ficará no próximo commit automaticamente. Não alteramos a política nem o índice. Inclusão futura pode usar `git add -f docs/audits/bunkercode-legacy-demolition.md`, somente na etapa de versionamento autorizada. Arquivos locais ignorados preexistentes não estão protegidos pelo histórico Git atual.

### Unidades de trabalho e estado persistido

- [x] U1 — inventário inicial, manifests, instruções, README, checklist atual, proveniência do marco histórico.
- [x] U2 — analyzer, contratos de entrada/saída e detectores.
- [x] U3 — graph-engine e contratos produzidos pelo próprio engine.
- [x] U4 — UI, modelos de autoria, CLI, scripts e infraestrutura auxiliar.
- [x] U5 — testes, fixtures e saúde atual.
- [x] U6 — documentação completa, artefatos locais e recomendações finais.
- [x] U7 — gates, revisão do relatório e Git.

Ao receber HANDOFF: não iniciar nova unidade; terminar apenas a unidade ativa se seguro; registrar fatos confirmados; verificar Git; entregar prompt autocontido com este caminho, tese, critérios, decisões, comandos/resultados e próximo passo. Nunca preencher áreas pendentes com conclusões presumidas.

## 1. Executive summary

**O material valioso é pequeno: extração de imports/reexports com localização e motivos de resolução, consultas dirigidas de dependência, SCC/BFS e um subconjunto de regras NestJS sustentadas por evidência. Não migrar nenhum package inteiro.** O núcleo candidato precisa adaptar contratos e limites antes de alimentar gabaritos.

Explorer, os dois DESIGNs, Studio, geografia/fronteiras/overlays, storage dessas experiências e protótipos 2D/3D devem ficar no legado. A sofisticação dessas camadas não resolve escrever, prever, corrigir ou testar código. Prisma, invocations e PNPM avançado ficam como referência até existir uma atividade concreta que os exija. A nova stack não implica Prisma nem análise SQL existente: não há motor PostgreSQL neste repositório.

O analyzer está superdimensionado sobretudo na gramática OBSERVE, na taxonomia de 14 responsabilidades para quatro capacidades implementadas e nas múltiplas representações dos mesmos fatos. A separação de AST interna e dados serializáveis merece sobreviver; Units/Parts/Claims não.

A auditoria confirmou um bug de impacto: membro de componente circular pode receber `participatesInCycle:false` por não aparecer no ciclo representante. Também reproduziu índice desatualizado após mutação do grafo; o uso atual documenta premissa de imutabilidade, não a impõe. São razões concretas para impedir migração intacta.

Validação direta: typecheck aprovado e 136 testes aprovados, cinco browser-gated não executados. `pnpm typecheck`/`pnpm test` falharam antes dos scripts por SQLite do gerenciador; isso não é falha dos testes. Nenhum código foi corrigido ou removido. Eficácia pedagógica continua hipótese, não consequência de testes verdes.

## 2. Repository map

| Caminho | Responsabilidade existente |
|---|---|
| packages/analyzer-typescript | ts-morph; descoberta de alvos; extração de dependências e responsabilidades; wrappers OBSERVE |
| packages/graph-engine | índices/consultas de arquivos, ciclos, impacto, diagnósticos, estrutura e agregação por package |
| packages/contracts | cinco famílias serializáveis: analysis, responsibility, observed-static-code, observed-responsibility, planned-system |
| packages/planned-system | criação, validação e autoria do DESIGN antigo integrado ao Explorer |
| packages/design-model | modelo semântico independente usado pelo Studio V1 e histórico de edição |
| apps/cli | analyze e impact via Node/tsx |
| apps/explorer-web | OBSERVE e DESIGN antigo; snapshots, projeções, React Flow/ELK, estilos e navegação |
| apps/studio-web | DESIGN V1 independente; React Flow, documentos semânticos/layout, storage local |
| test / fixtures | 14 arquivos de teste; duas árvores de fixtures versionadas; projetos adicionais construídos em testes |
| spatial-prototypes (ignorado) | experimentos 2D/3D, snapshots e capturas locais; não são entrega do workspace |
| .superpowers (ignorado) | briefs, reviews e diffs históricos de implementação de estrutura |

168 arquivos versionados no início. Node observado: v26.5.0; pnpm 11.20.0. README pede Node 24/PNPM 11; validação neste host não demonstrará compatibilidade com Node 24.

## 3. Dependency map

A seta significa “depende de”, conforme manifests e imports detalhados nas unidades abaixo. Importers do lockfile confirmam links de workspace e ts-morph 26.0.0, TypeScript 5.9.3, tsx 4.23.9, fast-glob 3.3.3 e yaml 2.9.0; nenhuma dependência foi atualizada.

```text
CLI -> analyzer-typescript, graph-engine
Explorer -> analyzer-typescript, graph-engine, contracts, planned-system
Studio -> design-model
analyzer-typescript -> contracts, ts-morph, fast-glob, yaml
graph-engine -> contracts
planned-system -> contracts
design-model -> nenhuma dependência de package
contracts -> nenhuma dependência de runtime
```

Explorer/Studio carregam React/React DOM/React Flow; somente Explorer declara ELK. Raiz contém TypeScript, tsx, esbuild, puppeteer-core e dependências de workspace usadas por testes. Todos os packages exportam fonte TS; não há biblioteca compilada/publicada a preservar por compatibilidade. tsconfig base é estrito, ES2022, ESNext/Bundler, noEmit e noUncheckedIndexedAccess.

## 4. Demolition map

A tabela abaixo cobre apps/modelos/infraestrutura. As tabelas das seções 5–7 e 9–10 completam o mapa granular do núcleo, contratos, testes e documentação. Caminhos abreviados no bloco Explorer são relativos a `apps/explorer-web/src`, salvo indicação contrária.

Foram examinados fluxos de inicialização, imports, exports, contratos de projeção, algoritmos de agregação, storage, modelos e scripts. Para renderers/CSS, a auditoria é de responsabilidade/acoplamento, não revisão visual nem prova de cada interação. Nenhuma UI apresenta justificativa concreta para migrar código.

| Caminho / responsabilidade | Classe | Por quê / uso novo | Dependências / testes que importam | Ação recomendada |
|---|---|---|---|---|
| apps/cli/src/main.ts: parsing, stdout/stderr, exit code | ADAPT | Harness local pequeno para inspecionar gabarito/evidência durante autoria de exercício | analyzer/engine; investigate-cli | Manter fluxo simples e erros; reduzir analyze que hoje despeja cinco representações |
| apps/cli/src/main.ts: compatibilidade positional, diagnostics/structure/package output | LEAVE LEGACY | Convenção de ferramenta de análise antiga, não requisito do novo produto | CLI antiga | Não manter compatibilidade por inércia |
| packages/planned-system/src/create-planned-system-model.ts | LEAVE LEGACY | Factory de intenção humana e gramática de sistema completo | PlannedSystemModel; planned-system.test | Descartar |
| packages/planned-system/src/author-planned-system.ts | LEAVE LEGACY | CRUD transacional/cascade de Parts, Predicates, Claims e Questions | validator; planned-system.test | Não transformar em autor de exercícios sem necessidade demonstrada |
| packages/planned-system/src/validate-planned-system-model.ts | REFERENCE | Técnicas de validação de unknown, referências e objetos sem getters são conhecimento útil; schema não é útil | contracts; negativos de planned-system.test | Consultar técnicas/testes, não extrair framework de validação |
| packages/planned-system/src/index.ts + manifest/tsconfig | LEAVE LEGACY | Empacotamento do domínio removido | DESIGN antigo | Descartar junto do domínio |
| packages/design-model/src/index.ts: entidades/relações/context/layout/parser | LEAVE LEGACY | Segundo modelo de autoria de sistemas; não análise de código nem modelo de atividades | Studio; design-model.test | Não fundir com PlannedSystem; ambos saem |
| packages/design-model/src/index.ts: CONSIDERATIONS | REFERENCE | Perguntas sobre validação, dependências, timeout e dados podem inspirar conteúdo | catálogo fixo por SemanticKind | Reaproveitar perguntas somente em situação concreta; não motor de avaliações |
| packages/design-model/src/history.ts | REFERENCE | Undo/redo de snapshots, limite de 100; técnica trivial reaplicável | DesignSnapshot; teste de histórico | Não preservar abstração sem editor novo aprovado |
| packages/design-model manifest/tsconfig | LEAVE LEGACY | Package de Studio | Studio | Descartar |
| apps/explorer-web/src/main.tsx, workspace-app.tsx, observe-app.tsx | LEAVE LEGACY | Boot DESIGN/OBSERVE, hash navigation, snapshot opcional | React/import.meta.glob | Remover dualidade e carregador visual |
| explorer-app.tsx, explorer-shell.tsx, explorer-surface-control.tsx | LEAVE LEGACY | Orquestra Overview/Responsibility/Territory, busca, seleção, fitView | todas as projeções; explorer/browser tests | Não usar como shell do novo aprendizado |
| explorer-runtime.ts | REFERENCE | Validação de snapshot de proveniência antiga; checker de analysis é superficial (arrays sem itens) | contracts/engine; runtime em explorer-web.test | Reter casos de erro como aprendizado; não adotá-lo como fronteira JSON confiável |
| explorer-projection.ts, explorer-model.ts, explorer-graph.tsx | LEAVE LEGACY | Focus, nós contextuais, agregação visual e layout ELK/React Flow | engine, territory, UI | Descartar projeção/layout; consulta direta já existe no engine |
| explorer-territory-projection.ts, explorer-spatial-territory-map.tsx | LEAVE LEGACY | Comprime diretórios transparentes e cria territórios/composições espaciais | ProjectStructure | Não converter em pedagogia invisível; são apresentação |
| explorer-state.ts, explorer-view-state.ts, explorer-orientation.ts, explorer-search.ts, explorer-attention.ts | LEAVE LEGACY | Seleção, expansão, navegação, destaque e busca contextual | Map/Set/territories | Comportamento antigo; reescrever UX de exercício quando existir |
| explorer-details.tsx | LEAVE LEGACY | Painéis de relações/território e evidência | FileExploration/React | Preservar necessidade de explicar evidência, não componentes |
| file-exploration.ts: groupRelationships | REFERENCE | Distingue relação por vizinho de múltiplas ocorrências, útil ao formular perguntas | getDependencies/getDependents; testes de direção/evidência | Extrair conceitualmente agrupamento, sem ownership/focus/labels |
| file-exploration.ts restante | LEAVE LEGACY | canFocus/canExpand, owned/contextual, messages | navigation/projection | Descartar |
| relationship-language.ts, explorer-vocabulary.ts | REFERENCE | Semântica “A usa B”, direção e glossário podem evitar gabarito invertido | UI; testes de direção/vocabulário | Reescrever linguagem para exercício; não preservar placements |
| vocabulary-help.tsx | LEAVE LEGACY | Tooltip de conceitos do Explorer | vocabulary | Descartar renderer |
| explorer-responsibility-projection.ts | LEAVE LEGACY | Família/território/contagem e elegibilidade da superfície | taxonomy + territories | Findings diretos dispensam árvore e elegibilidade |
| explorer-responsibility-spatial-model.ts, explorer-responsibility-map.tsx | LEAVE LEGACY | Composições solo/duo/constellation e subject previews | projection/React | Descartar |
| explorer-responsibility-details.tsx, explorer-responsibility-coverage.tsx, explorer-responsibility-language.ts | LEAVE LEGACY | Filtros, disclosure e rótulos da UI antiga | findings/coverage | Manter distinção sem achado/sem suporte no novo texto, não o código |
| explorer-system-map-geography.ts | LEAVE LEGACY | Segunda árvore de regiões, fronteira inicial, refinamento/collapse | ProjectStructure | Não levar geografia para perguntas pequenas |
| explorer-system-map-frontier-projection.ts | LEAVE LEGACY | Partição dos arquivos na fronteira visual e agregação de arestas | geography + graph | Relevância matemática não basta; consultas menores preservam evidência |
| explorer-system-map-field-model.ts, explorer-system-map-field.tsx | LEAVE LEGACY | Packing, frames, handles, rotas, câmera e canvas multinível | frontier/geography/React Flow | Abandonar mesmo sofisticado |
| explorer-system-map-projection.ts, explorer-system-map-context.ts, explorer-system-map-responsibility-overlay.ts, explorer-system-map-unavailable.tsx | LEAVE LEGACY | Outras projeções, contexto, overlays e estados do System Map | territory/orientation/responsibility | Não migrar múltiplas representações do mesmo sistema |
| explorer-system-orientation.ts | REFERENCE | Agrupa uso externo com fontes únicas e arestas; restante repete queries do engine | graph/structure | Se necessário, reproduzir agrupamento simples sem relatório geral |
| src/styles.css e src/styles/{tokens,shell,graph,details,responsibility,responsive,system-map,system-map-field,territory}.css | LEAVE LEGACY | Estética/layout ligados ao mapa; 3.330 linhas nos nove styles (medição local) | UI antiga | Não salvar design system por disponibilidade |
| src/design/design-app.tsx, designer-canvas.tsx, designer-inspector.tsx, design.css | LEAVE LEGACY | Designer anterior com library, formulários, canvas e undo | planned-system/React Flow | Descartar |
| src/design/designer-implementation.ts e designer-implementation-panel.tsx | LEAVE LEGACY | Tecnologias atribuídas manualmente às Parts, não fatos detectados | PlannedSystemModel | Não confundir intenção com stack comprovada |
| src/design/designer-layout.ts, designer-scene.ts, designer-visual-export.ts | LEAVE LEGACY | Posições, lanes, SVG e badges | semantic model/presentation | Algoritmos visuais sem consumidor novo |
| src/design/designer-storage.ts | REFERENCE | Validação/versionamento, conflitos entre abas, import/export e preservação de raw inválido são casos úteis | planned validator + implementation; designer-storage.test | Não migrar namespace/modelo/storage; exclusão de código não autoriza apagar dados pessoais do navegador |
| scripts/explorer-development-target.ts, generate-snapshot.ts, develop.ts | LEAVE LEGACY | Produção do snapshot e servidor que abre DESIGN mesmo com OBSERVE falho | analyzer, fs, Vite | Testes de alvo/erros servem como referência; remover pipeline visual |
| scripts/capture-system-map.ts | LEAVE LEGACY | Bundle esbuild, servidor loopback e Puppeteer para fotos do mapa | UI, snapshot | Remover quando UI sair |
| Explorer package.json/tsconfig.json/vite.config.ts/index.html/src/vite-env.d.ts | LEAVE LEGACY | Build/tooling exclusivo do app | Vite/React/ELK | Descartar com app; não executar geração de snapshots agora |
| apps/studio-web/src/{main.tsx,studio.tsx,studio-projection.tsx,studio-panels.tsx,studio.css} | LEAVE LEGACY | Canvas semântico, edição, menus e painéis; não prática de código | design-model/React Flow | Nenhum componente migra |
| apps/studio-web/src/studio-language.ts | REFERENCE | Formulações em PT-BR antes do termo técnico; técnica editorial útil | SemanticKind/Considerations | Reaproveitar aprendizado, não catálogo de arquitetura |
| apps/studio-web/src/storage.ts | LEAVE LEGACY | localStorage em bunkercode:studio:v1, documento e layout | design-model parser | Não herdar schema/chave; preservar dados existentes fora da demolição de código |
| Studio package.json/tsconfig.json/vite.config.ts/index.html | LEAVE LEGACY | Tooling do produto abandonado | Vite/React | Descartar |
| package.json raiz | ADAPT | Comandos locais de verificação continuam necessários | workspace/scripts | Reconstruir scripts só com peças aprovadas; não conservar pnpm explorer/design |
| pnpm-workspace.yaml e lockfile | ADAPT | Reprodutibilidade útil, mas topologia/deps serão outras | gerenciador | Regenerar lockfile pelo gerenciador apenas na futura migração; não copiar estoque inteiro |
| tsconfig.base.json | MIGRATE (revisar destino) | strict/noUncheckedIndexedAccess protegem exercício/engine | TypeScript | Preservar rigor; ESNext/Bundler/Node 24 são escolhas a confirmar no destino, não padrão universal Nest |
| apps/cli/package.json e tsconfig.json; manifests/tsconfigs analyzer, graph, contracts | ADAPT | Wiring técnico deve acompanhar somente capacidades aceitas | workspace/exports TS | Sem obrigação de manter nomes/package count ou export de fonte TS |
| .gitignore | ADAPT | Separar generated/deps/dados locais é útil; ignorar todo Markdown impede transferir auditoria/notas sem ação explícita | Git | Rever política no destino; nenhuma mudança agora |

Acoplamento relevante: graph-engine continua independente de parser/UI, mas contém estrutura geral demandada pela navegação. Contratos OBSERVE não alimentam a UI corrente; Explorer monta seu próprio conjunto de projeções a partir de `analysis + responsibilities`. Há duplicação conceitual em dois eixos: raw facts → OBSERVE units e raw facts → graph/structure → territory/geography/frontier; e PlannedSystem versus DesignDocument independentes. Não há razão para unificar essas camadas durante demolição: ambas podem simplesmente deixar de existir.

O catálogo de considerations levanta perguntas úteis, porém é seleção fixa pelo tipo de entidade, não motor de inferência contextual nem avaliador pedagógico. Não preservar DESIGN sob o argumento de que “já faz perguntas”.

## 5. Analyzer deep audit

Leitura dos 19 arquivos de fonte do analyzer (incluindo seis em responsibility-detectors), contratos e chamadas em apps/testes. **Nenhum package recebe passe livre.** Os wrappers OBSERVE exportados não são o caminho da UI atual: `explorer-development-target.ts` chama `analyzeTypeScriptTarget`; CLI chama `analyzeProject`. Buscas por produtores OBSERVE encontram implementação e testes, sem consumidor de app. Logo não se justifica preservar esses wrappers nem por compatibilidade com a própria UI.

| Arquivo/responsabilidade em packages/analyzer-typescript/src | Classe | Por quê / uso novo concreto | Dependências / testes relevantes | Ação recomendada |
|---|---|---|---|---|
| project-discovery.ts: validação de alvo explícito e ambiguidade | ADAPT | Abrir projeto de exercício sem escolher pasta errada; descoberta recursiva é opcional, dispensável com alvo curado | fs/path; project-discovery.test | Preservar erros e recusa de ambiguidades; reduzir descoberta ao uso demonstrado |
| typescript-analysis-session.ts | ADAPT | Carregar AST uma vez para perguntas de imports/decorators | ts-morph, AnalyzedFile/SourceLocation; analyze-simple-import | Manter sessão interna; definir política explícita para arquivo em múltiplos tsconfigs |
| analyze-project.ts: import/export, aliases, unresolved e evidência | ADAPT | “Quem usa?”, “qual import quebrou?”, revelar linha após tentativa | sessão/contracts; analyze-simple-import, investigate-cli | Extrair fluxo pequeno, contrato reduzido; preservar ocorrência e motivo; não carregar orquestração OBSERVE |
| analyze-project.ts: loadTarget, withWorkspaceStructure | ADAPT | Usar pequenos projetos TS; associação de packages apenas em exercícios de fronteiras | pnpm-workspace; project-graph, project-discovery | Separar necessidade de alvo TS da descoberta de workspace; não pressupor workspace na primeira atividade |
| pnpm-workspace.ts | REFERENCE | Cenários de limites de packages são possíveis, mas não necessários ao primeiro exercício backend | fast-glob/yaml/manifests; fixture pnpm-workspace-structure | Não levar automaticamente dois parsers auxiliares; reavaliar quando houver exercício de workspace |
| analysis-result.ts e index.ts | ADAPT | Exportar apenas capacidade selecionada | contratos e produtores | Eliminar reexports OBSERVE; não manter barrel histórico como API de compatibilidade |
| responsibility-detectors/nestjs.ts | ADAPT | Pedir identificação de método anotado como rota, uso de UseGuards e declaração Module | nestjs-common/runtime; responsibility-runtime | Manter regras específicas, diminuir taxonomia e limitar semântica das afirmações |
| responsibility-detectors/nestjs-common.ts | ADAPT | Evidência de import/alias + decorator evita classificar por nome de arquivo | AST/contracts/identities; testes alias, namespace e negativos | Resolver identidade com cuidado; texto do decorator não equivale a vínculo semântico completo |
| responsibility-detectors/identities.ts | ADAPT | Localizar evidência na mesma revisão do exercício | funções puras; testes determinísticos | Reduzir IDs; posições são locais ao snapshot, não identidade estável entre edições |
| responsibility-detectors/detector.ts e runtime.ts | ADAPT | Distinguir sem achado, não suportado e falha antes de avaliar aluno | taxonomy/contracts; testes outcomes e falhas | Manter estados necessários; remover grade universal de capacidades sem detector; definir propagação de exceção |
| responsibility-detectors/prisma-persistence.ts | REFERENCE | Técnica de provar binding de cliente antes de chamar algo de persistência; futuro puzzle se estudo adotar Prisma | ts-morph/identities/runtime; seis grupos Prisma em responsibility-runtime | 246 linhas, sem Prisma instalado como dependência; custo maior que detector Nest. PostgreSQL não implica Prisma; não migrar agora |
| invocation-relations.ts | REFERENCE | Futuro exercício de leitura de chamada estática e limitações | sessão/ts-morph; analyze-simple-import casos de chamadas | Experimento não exportado; não recriar call graph completo nem prometer trace de execução |
| observed-responsibility-model.ts | LEAVE LEGACY | Parts duplicam files; claims agrupam findings para gramática antiga | observed-responsibility contracts; testes de claims | Descartar implementação; reter como referência a exigência de evidência válida |
| observed-responsibility-unit.ts | LEAVE LEGACY | Wrapper valida outra representação dos mesmos fatos, sem consumidor novo | analysis/responsibility/claims | Descartar unit/context/support lookup; não confundir validação referencial com prova de origem |
| observed-static-dependency-model.ts | LEAVE LEGACY | Agrupa pares e recria endereços de evidência já disponíveis na análise/grafo | observed-static-code; testes supports | Usar ocorrências diretas quando necessário; preservar lição sobre múltiplas evidências, não encoding em JSON tuple |
| observed-static-code-unit.ts | LEAVE LEGACY | Compõe perspectiva adicional com mesmos sources/parts | responsibility-unit/dependency-model | Remover da base nova |
| analyze-observed-responsibility-target.ts e analyze-observed-static-code-target.ts | LEAVE LEGACY | Produtores para contratos antigos; chamadas de apps ausentes | analyzeTypeScriptTarget/builders; responsibility-runtime | Nenhum adaptador de compatibilidade necessário |

#### Limites demonstrados pela leitura e testes existentes

1. `analyze-project.ts` extrai **ImportDeclaration/ExportDeclaration com módulo**; não extrai `require`, `import()` dinâmico ou todas as chamadas. Não registra diferença entre import de tipos, import de valor e reexport no contrato. Isso serve a dependência estática; não prova fluxo de execução.
2. Módulo bare sem resolução é classificado `external/inferred`. Portanto “externo” não prova instalação, existência ou validade; pode ser erro de digitação. Alias configurado não encontrado fica unresolved. O contrato `ResolvedDependency` dá nome excessivamente forte a parte dos registros.
3. `SourceLocation` preserva arquivo/linha/coluna (1-based), mas não intervalo/fingerprint da revisão. Findings adicionam detector/regra/versão e sinal textual. Essa capacidade merece **MIGRATE como princípio e dados mínimos**, não todos os tipos atuais.
4. Sessão cria um `Project` por tsconfig e sobrescreve mapa por caminho: último contexto ganha. `analyze-simple-import.test.ts:475` demonstra destinos diferentes ao inverter dois tsconfigs. Ordenação torna a escolha repetível, não semanticamente universal. Não migrar silenciosamente esta política.
5. Alvo TS direto usa filtro `() => true`; workspace usa fronteira lexical `isPathInsideProject`. Assim não há sandbox geral de leituras: imports/config podem conduzir o compilador fora da raiz, embora o código analisado não seja executado. Descoberta não percorre diretórios symlink (teste específico), o que não prova confinamento de todas as fases. Não afirmar segurança de sandbox sem auditoria específica.
6. `loadTarget` prioriza tsconfig raiz quando também existe workspace; não segue automaticamente todo project-reference como solução universal. Workspace considera tsconfig padrão de membros declarados e mantém packages sem arquivos. Política adequada depende do exercício.
7. Nest HTTP exige classe com Controller e método com um decorator HTTP reconhecido. Access-control significa presença de UseGuards; wiring significa Module. Não há resolução de providers/imports/exports/injeção; não há prova de guard implementado ou eficaz; não computa rota completa com prefixos globais.
8. Alias Nest é mapa textual dos imports de `@nestjs/common`; namespace é suportado. Testes trabalham sem instalar Nest. Ausência de achado não prova ausência de responsabilidade: wrappers, reexports e padrões não examinados não aparecem automaticamente como limitações. `evaluated` significa que a regra rodou, não cobertura completa do framework.
9. Prisma aceita operações enumeradas com binding local/tipado ou subclasse direta resolvida. Não valida schema SQL, modelo real gerado, efeitos de transação ou PostgreSQL; formas indiretas e inferência arbitrária ficam fora. Evidência de chamada não prova I/O executado.
10. Runtime agrega outcomes explícitos, mas chama `detector.analyze(session)` sem catch: exceção inesperada propaga e não vira automaticamente `failed`. Testes de falha retornam outcomes; não demonstram isolamento contra throws.
11. Taxonomia tem 14 responsabilidades e quatro detectores cobrindo quatro delas. GraphQL, WebSocket, RPC, cache, integração externa, filas, eventos e scheduled jobs são categorias sem implementação; devem sair da primeira base.
12. OBSERVE units retêm referências a sources, sem clone/freeze. Coerência de metadados não comprova que dois JSON vieram da mesma produção. Contrato documenta obrigação do chamador. Não carregar essa responsabilidade para um sistema de exercícios por inércia.
13. Invocations reconhece funções nomeadas e métodos estáticos diretamente pertencentes à classe, com callers em funções nomeadas; recusa overloads, optional calls, métodos de instância, herança e outros casos. `exact` significa declaração estática única no contexto, não execução observada.

## 6. Graph-engine deep audit

Leitura integral dos seis arquivos do engine; ele não depende de ts-morph/Node/UI, apenas de contratos próprios. A separação parser/algoritmo é útil. A pureza de dependências não significa que todo contrato ou todo algoritmo esteja pronto para migrar.

| Arquivo/responsabilidade em packages/graph-engine/src | Classe | Por quê / uso novo | Dependências e testes | Ação |
|---|---|---|---|---|
| project-graph.ts: construção e serialização | ADAPT | Base de perguntas “A usa B”; mantém cada ocorrência e unresolved | AnalysisResult; project-graph, analyze-simple-import | Índices sobre contrato menor; evitar duplicar grafo inteiro só para apresentar nós externos |
| project-graph.ts: getDependencies/getDependents | MIGRATE (algoritmo, novo contrato) | Perguntas diretas de dependência e justificativa por import | índices internos; project-graph | Levar consultas pequenas e ordenação; sem obrigar consumidor a adotar toda a API antiga |
| project-graph.ts: WeakMap graphIndexes | ADAPT | Consultas repetidas podem usar índice, mas identidade do objeto não invalida dados | grafo mutável; prova abaixo | Definir imutabilidade efetiva ou construir índice explícito; não preservar cache incidental |
| project-graph.ts: SCC/Tarjan e detectCycles | MIGRATE algoritmo; ADAPT resultado | Exercício “encontre um ciclo e mostre as arestas” | adjacência; teste componentes densos | Preservar SCC e evidência de caminho; distinguir componente circular de um ciclo representante |
| project-graph.ts: getIsolatedFileNodes | REFERENCE | Isolamento de imports não prova código morto; não selecionado para primeira atividade | índice connected; project-graph | Reimplementar consulta trivial se surgir pergunta legítima |
| project-graph.ts: unresolvedDependencies | ADAPT | Investigar caminho quebrado sem ocultar ocorrência | análise; project-graph | Consumir unresolved direto; não criar identidade adicional obrigatória |
| project-impact.ts: transitiveDependents/BFS | MIGRATE algoritmo; novo contrato | “Quais arquivos revisar?” e caminho mais curto de propagação inversa | getDependents; testes profundidade/caminho/desempate | Preservar busca determinística e deduplicação; resultado sempre impacto estático potencial |
| project-impact.ts: createImpactReport/circularity | ADAPT | Relatório útil, mas erro concreto de membership circular impede migrar intacto | detectCycles; prova abaixo | Corrigir semântica na futura extração, usando SCC; não usar como gabarito agora |
| project-diagnostics.ts: fan-in/fan-out | ADAPT | Contar ocorrências pode alimentar pergunta explícita sobre acoplamento | grafo; testes diagnóstico | Consulta pequena; declarar contagem de **arestas**, não número de arquivos únicos |
| project-diagnostics.ts: cycles/unresolved wrappers | REFERENCE | Dados já estão em consultas/contrato | grafo | Não duplicar diagnósticos/evidências/mensagens sem consumidor |
| project-diagnostics.ts: manyDependents/manyDependencies | LEAVE LEGACY | Thresholds 2/3 não são regra pedagógica de código certo/errado | heurísticas com threshold configurável | Não carregar warning automático de qualidade |
| project-diagnostics.ts: relatório geral e isolated-file | LEAVE LEGACY | Catálogo de observações do sistema inteiro, foco antigo | CLI/Overview | Exercício escolhe pergunta e evidência necessária, não relatório universal |
| project-structure.ts: units/containments/sourceReports | LEAVE LEGACY | Modela três eixos sobrepostos para navegação estrutural; excesso para exercício curto | AnalysisResult; vários testes de estrutura | Reter lições sobre fonte de evidência; não carregar hierarquia multi-eixo |
| project-structure.ts: normalização e rejeição de caminhos | REFERENCE | Casos válidos/inválidos úteis se houver árvore de projetos | testes de caminhos fora da raiz/malformados | Especificação técnica reutilizável, sem migrar módulo de 318 linhas |
| project-structure.ts: membership e queries de packages | REFERENCE | Exercício de package boundaries ainda condicional | pnpm facts/WeakMap | Mapa file→package bastaria em cenário futuro |
| package-dependencies.ts | REFERENCE | Agrega somente imports internos entre packages e preserva arestas | structure + graph; fixture PNPM | Se houver atividade, adaptar para receber membership simples; não equivale a dependencies do manifest |
| index.ts | ADAPT | API enxuta das consultas selecionadas | exports locais | Eliminar exports de projeção/diagnóstico abandonados |

#### Fatos, heurísticas e limites

- SCC detecta componentes fortemente conexos e devolve **um ciclo representante por componente**, não todos os ciclos nem todos os membros. Em `project-impact.ts`, procurar target dentro desse representante é insuficiente.
- Prova executada em memória com a↔b↔c: `detectCycles` devolveu `[a.ts,b.ts,a.ts]`, e `createImpactReport(graph,'c.ts').circularity` devolveu `{participatesInCycle:false}` apesar de b↔c. **Bug confirmado**, não apenas hipótese. Teste existente de impacto usa ciclo cujos membros aparecem no representante; teste de componente denso não verifica membership de todos os alvos.
- Prova de cache: após consultar a.ts (1 aresta), substituir `graph.edges=[]` deixa nova consulta retornando 1. `ProjectGraph` usa arrays mutáveis e WeakMap sem invalidação. A falha exige mutação após indexação; não foi demonstrado que apps atuais a façam. Para exercícios que alteram código, não reutilizar grafo mutado como gabarito.
- `buildProjectGraph` confia no contrato TS: não rejeita source ausente ou duplicate file ID; target ausente pode virar nó external mesmo que dependency diga internal. Isso é limite de fronteira JSON, não prova de falha com saída normal do analyzer.
- `getDependencies/getDependents` devolvem cópia de arrays, mas objetos/arestas continuam compartilhados. Estrutura usa cache com a mesma premissa de identidade/imutabilidade.
- `buildProjectStructure` não lê filesystem: deriva ancestrais dos caminhos e das raízes dos packages. `source:'filesystem'` é descrição da base dos caminhos, não inventário independente do disco; pastas vazias fora dos packages não aparecem.
- Membership inválido é filtrado silenciosamente no builder de estrutura e o teste `keeps containment queries tolerant...` legitima essa tolerância. Não transferir para contrato de avaliação sem decidir se erro deve ser explícito.
- Fan-in/fan-out contam ocorrências; dois imports do mesmo arquivo podem contar duas vezes. “Many” é heurístico mesmo quando confidence das arestas é exact. `basis:'fact'` é útil, mas fato de ciclo não prova falha em runtime; `isolated` não prova arquivo inútil e ignora unresolved como aresta resolvida.
- Impact paths caminham no sentido inverso às dependências (alvo → dependente); são caminhos mínimos escolhidos deterministicamente, não todos os caminhos nem trace de execução. Import de tipos também pode ampliar o alcance estático.
- Tarjan/representante são recursivos; não houve teste de profundidade extrema nem benchmark. Não alegar limites de escala quantificados.

Provas foram executadas com `node --import tsx --input-type=module` sem arquivos novos no repositório. Código preservado por restrição explícita da auditoria.
## 7. Contracts audit

#### Contratos: produtores, consumidores e destino

| Família em packages/contracts/src | Produz / consome hoje | Natureza e consumidor novo legítimo | Classe / redução recomendada |
|---|---|---|---|
| analysis.ts: files, dependências e unresolved | analyzer / graph-engine, CLI, snapshot Explorer | Fatos de sintaxe/resolução + inferência de externos; perguntas sobre imports | ADAPT; pertencer ao produtor ou fronteira mínima escolhida depois; discriminar melhor interno/externo sem target opcional ambíguo |
| analysis.ts: SourceLocation, Confidence, evidência | analyzer / engine e UI | Explicar por que resposta foi aceita e em qual código | MIGRATE conceitos e dados mínimos; significado de exact deve ficar explícito; incorporar revisão/range apenas se requerido |
| analysis.ts: packages/memberships/evidence | pnpm detector/analyzer / structure, UI | Fato de configuração; exercício de fronteira ainda não selecionado | REFERENCE; não levar junto com análise simples |
| analysis.ts: metadata, diagnostics e schema | analyzer / CLI e UI | Origem/erros úteis; metadata fixa e mensagens duplicam parte de unresolved | ADAPT; manter falha e origem, reduzir envelope |
| responsibility.ts: findings, subject, evidence, provenance | detectores / Explorer e testes | Interpretação técnica restrita sustentada por sinal; pistas Nest concretas | ADAPT; manter conteúdo explicável; cortar sinonímia id/symbolId e estabilidade além do snapshot |
| responsibility.ts: coverage, executions, limitations | runtime / Explorer e units/testes | Estado da avaliação protege contra marcar aluno errado por falta de suporte | ADAPT; conjunto menor por regra efetivamente usada, sem taxonomia universal |
| responsibility.ts: taxonomia sem detector, famílias e displayName | catálogo fixo / runtime e apresentação | Classificação organizacional; não fato sobre programa | LEAVE LEGACY para categorias sem necessidade; texto de apresentação fora do núcleo |
| observed-responsibility.ts | builders / outros builders e testes, sem chamada de app encontrada | Modelo derivado OBSERVE de Parts/Claims/Supports | LEAVE LEGACY |
| observed-static-code.ts | builders / testes | Composição OBSERVE e relações duplicadas | LEAVE LEGACY |
| planned-system.ts | planned-system/autoria DESIGN / Explorer DESIGN | Intenção humana, não extração; não existe consumidor pedagógico aprovado | LEAVE LEGACY |
| index.ts | barrel / consumidores citados | Acoplamento de exportação, não lógica de domínio | ADAPT à fronteira mínima; não preservar mega-package |

Os contratos atuais são objetos serializáveis, não AST. Isso é bom e reaproveitável como restrição. Já a sessão interna contém Map/SourceFile/função e permanece fora do index público. A presença de um barrel compartilhado não cria dependência de runtime entre todos os domínios, mas aumenta superfície pública e custo conceitual. Não é necessário migrar `contracts` como package para preservar essas restrições.

## 8. UI demolition

A seção 4 classifica cada arquivo/grupo coeso de Explorer, DESIGN e Studio, incluindo CSS, storage, scripts e configurações. **Nenhum componente UI é MIGRATE/ADAPT.** REFERENCE significa consultar técnica/conteúdo, sem copiar UI para a nova base.

Fluxo existente: snapshot `analysis + responsibilities` → `ProjectGraph + ProjectStructure` → Territory/Responsibility/Geography/Frontier → layout/React Flow. Algumas outras projeções estão preservadas em módulos e testes; não são automaticamente o caminho principal do Explorer atual. O boot carrega DESIGN sem snapshot e OBSERVE de forma lazy. Studio usa outro modelo/storage e não consulta analyzer.

O agrupamento de múltiplos imports em uma relação legível (`file-exploration.ts`), contagem de fontes de módulos externos (`explorer-system-orientation.ts`) e tratamento explícito de dados inválidos/conflitos (`designer-storage.ts`) são referências pequenas. Nada exige salvar a árvore de navegação, geografia ou storage para reutilizar essas ideias.

## 9. Tests and fixtures

A classificação é por comportamento, não pela quantidade de assertions ou pelo destino do arquivo de produção. A suíte atual tem uma dependência local relevante: `test/explorer-web.test.ts:1471` lê diretamente `apps/explorer-web/src/generated/analyzer-typescript.snapshot.json`, ignorado pelo Git. Os passes desta máquina não garantem que um clone limpo execute a suíte sem preparar esse snapshot. Ele já existia; não foi regenerado nesta auditoria. Nenhum teste novo foi criado: alterações permitidas são exclusivamente neste relatório. As duas provas de grafo são comandos efêmeros; devem virar regressões **se e quando** essas capacidades forem extraídas/corrigidas.

| Teste/fixture | Classe | Comportamento/conhecimento a preservar | O que não acompanha |
|---|---|---|---|
| test/analyze-simple-import.test.ts: análise determinística, externos/unresolved, aliases, baseUrl, barrel, reexport, import type, erro de config | MIGRATE cenários / ADAPT harness | Resolução real pode quebrar por configuração, não por nome; mesmas entradas preservam evidência | Assertions do envelope legado devem acompanhar contrato reduzido |
| mesmo arquivo: Parts (primeiros três testes) | LEAVE LEGACY | Duplicação de files em Parts sem consumidor novo | Gramática OBSERVE |
| mesmo arquivo: invocation experiments, optional/overload/nested constructor/contexts | REFERENCE | Contraexemplos a “AST resolvida = execução exata”; contexto vencedor muda destino | Não habilitar call graph por existirem testes |
| test/project-discovery.test.ts | ADAPT | Alvo explícito, ambiguidade determinística, não descer em symlinks/excluídos | Busca recursiva completa se exercícios tiverem alvo curado |
| test/project-graph.test.ts: construção, direção, ciclos densos, BFS, erros de alvo | MIGRATE cenários / ADAPT API | Preservar arestas/evidência, caminho mínimo e deduplicação | Acrescentar futuramente regression do membro de SCC omitido no representante |
| mesmo arquivo: structure/paths/package membership | REFERENCE | Paths malformados, fora da raiz, package vazio/sem nome, memberships inconsistentes | Árvores multi-eixo e tolerância antiga não são requisitos novos |
| mesmo arquivo: thresholds heurísticos | LEAVE LEGACY | Não é gabarito pedagógico | Valores 2/3 e catálogo warnings |
| test/investigate-cli.test.ts | ADAPT | JSON parseável/determinístico; stderr/exit != 0; erro de alvo | Dump de graph+analysis+diagnostics+structure, positional antigo |
| test/responsibility-contract.test.ts | ADAPT | Serialização e separação entre finding e cobertura; proveniência | Taxonomia universal e exemplos de capacidades sem detector |
| test/responsibility-runtime.test.ts: Nest aliases/namespace/negativos/zero findings/outcomes | MIGRATE cenários / ADAPT modelo | Não inferir por nomes; preservar múltiplos sinais, motivo e estado da avaliação | Reescrever expectativas dos units; resultado evaluated não significa framework completo |
| mesmo arquivo: Prisma bindings e negativos | REFERENCE | Provar receiver e subclasse, evitar falso positivo por método homônimo | Não torna Prisma requisito |
| mesmo arquivo: claims/units/supports/composição de arquivo/real BunkerCode Relations | REFERENCE para corrupção/proveniência; LEAVE LEGACY para representação | Saber que referências quebradas e mistura de snapshots invalidam evidência | Parts/Claims/Units e tuple keys não devem sobreviver só para manter testes |
| test/explorer-web.test.ts: direção, múltiplas ocorrências, coverage≠ausência, preservar evidência | REFERENCE | Especificação para futura explicação e agrupamento menor | Projeções visuais da suíte não viram invariantes do aprendizado |
| mesmo arquivo: geografia/frontier/layout/territory/state/search | LEAVE LEGACY | Testes do produto abandonado | Bounded rows, previews, ownership visual, focus e labels |
| test/browser-graph-engine.test.ts | REFERENCE | Demonstra técnica de contrato serializável e bundle sem Node; execução browser não requisito aprovado | Harness Firefox/snapshot antigo |
| test/explorer-web-browser.test.ts (dois smokes), designer-browser.test.ts, studio-web-browser.test.ts | LEAVE LEGACY | Fonte histórica de fluxos; não contrato novo | Browser automation dos três produtos |
| test/planned-system.test.ts | REFERENCE para atomicidade/JSON inválido; LEAVE LEGACY para gramática | Detached output, rejeição de getters/unknowns, referências e cascade são casos instrutivos | SaaS de exemplo, IDs/modelo/predicates antigos |
| test/design-model.test.ts | REFERENCE para integridade/undo; LEAVE LEGACY para Studio | Restaurar semântica e posição conjuntamente era necessário ao whiteboard | Não carregar editor nem considerations state |
| test/designer-storage.test.ts | REFERENCE para erro/conflito/escaping; LEAVE LEGACY para layout/SVG | Falha de gravação não apaga anterior; stale save; __proto__/texto especial/versão inválida | Chave de storage, implementação tecnológica, câmera e curvas |
| fixtures/simple-import/src/main.ts, service.ts | MIGRATE (como cenário mínimo) | A chama/importa B; duas funções fáceis de ler/modificar manualmente | Não apresentar como backend Nest/PostgreSQL |
| fixtures/simple-import/tsconfig.json | ADAPT | Hoje estende ../../tsconfig.base.json: recebe configuração do próprio repo, não projeto externo independente | Tornar fixture autocontida na extração; não carregar vínculo com workspace |
| fixtures/pnpm-workspace-structure/** | REFERENCE | application→library, isolated/empty, excluído, no-manifest e orphan exercitam membership real | Não transformar em package da nova plataforma nem manter só para mapa |
| Projetos temporários criados por testes de analyzer/Nest/Prisma/CLI | ADAPT ou REFERENCE conforme capacidade acima | Pequenos arquivos de entrada representam edge cases melhor que snapshots gigantes | Não copiar factories/harness indiscriminadamente |
| Snapshot gerado Explorer e snapshots/capturas espaciais locais | LEAVE LEGACY para runtime; REFERENCE seletiva para história | Dados externos congelados foram usados na investigação visual | Não são fixture pedagógica aprovada nem conteúdo para publicar |

## 10. Documentation demolition

Inventário completo de Markdown próprios encontrados (excluídos node_modules/.git/dist): dois versionados; seis notas na raiz ignoradas (AGENTS, checklist, decisions, log, learning, spatial audit); quatro documentos espaciais; treze documentos de execução em `.superpowers`. A classificação documental abaixo não é endosso das antigas recomendações. Foram lidos documentos de produto/estado, seções técnicas relevantes e índices/seções de decisões; logs extensos são fonte histórica, não repetição dos testes desta sessão. Não foi reexecutado cada experimento histórico nem inspecionado visualmente cada PNG.

| Documento / seção | Destino documental | Classe | Motivo e ação futura |
|---|---|---|---|
| README.md | REWRITE | ADAPT | Explica DESIGN/OBSERVE como produto atual; precisa comunicar reconstrução. Outline abaixo; não reescrito nesta rodada |
| info_legado.md | HISTORICAL | REFERENCE | Marco real de descontinuação; ver seção 11, não arquitetura futura |
| AGENTS.md | KEEP + UPDATE | ADAPT | Preservar evidência, falhas explícitas, não executar alvo, testes significativos e Git; reescrever finalidade, stack/limites e fluxo para nova tese. Hoje impede partes da stack nova por regra antiga; esta auditoria segue pedido específico |
| AI_PROJECT_CHECKLIST.md | HISTORICAL seletivo + REWRITE do ativo | LEAVE LEGACY para backlog antigo | Não reautorizar Fases 1–10, DESIGN/OBSERVE ou experiências por checkbox pendente. Preservar pequeno marco de encerramento; histórico extenso local pode ser arquivado antes da limpeza |
| ENGINEERING_LOG.md | HISTORICAL | REFERENCE | Valor em causas e fracassos, não obrigação de manter implementações. Selecionar análise estática, fontes/IDs, erros de resolução, SCC/BFS e conclusões visuais; não copiar 4.241 linhas para log ativo novo |
| DECISIONS.md: ADR-001/002/003/005/006/017/019/020/021/035–039 | KEEP conceitos + UPDATE | ADAPT/REFERENCE | Alias unresolved, índices, ciclos, impacto, evidência e limites de dispatch valem estudo; decisões não migram intactas. ADR-002 documenta premissa de imutabilidade; ADR-003 explica representante; correção circularity é necessária |
| DECISIONS.md: ADR-004/008 e decisões de schema/browser | HISTORICAL / REFERENCE | REFERENCE | Versionar fronteira quando há consumidor; não herdar premissa de persistência futura ou browser |
| DECISIONS.md: demais ADRs de Explorer/Territory/Map/OBSERVE/Planned/Studio e política local | HISTORICAL seletivo | LEAVE LEGACY para arquitetura ativa | Numerosas decisões visuais são coerentes com tese abandonada. Política local precisa revisão para não perder documentação entre sessões |
| LEARNING_CHECKPOINT.md | KEEP + REWRITE seleção | ADAPT | Exercícios possíveis sobre aliases, índices, SCC, BFS e inferência têm valor. Remover roteiro de aula do mapa; não gerar aula/PDF agora |
| SPATIAL_INTERFACE_AUDIT.md | HISTORICAL (síntese curta) | REFERENCE | Documenta que exatidão estrutural não resolveu orientação/interação; não demonstra empiricamente aprendizagem nem todas as propostas aprovadas |
| spatial-prototypes/README.md | HISTORICAL seletivo | REFERENCE | Peneira 1, Atlas/Icicle rejeitados, H0 insuficiente; conservar resultados/limites, não manual operacional como doc ativo |
| spatial-prototypes/PENEIRA_2.md | HISTORICAL seletivo | REFERENCE | H1/H2/H3, medições e limites. Subseção de próxima avaliação foi superada por README 3D/checklist; não tratar como tarefa pendente autorizada |
| spatial-prototypes/3d/README.md | HISTORICAL seletivo | REFERENCE | J1/J1.1, oclusão e falha de navegação em case; preserve resultado negativo, não obrigação de retomar |
| spatial-prototypes/3d/HYPOTHESIS.md | DELETE após síntese | LEAVE LEGACY | Hipótese anterior à implementação, redundante com relato do resultado; sem consumidor novo |
| .superpowers/.../progress.md | HISTORICAL apenas lição selecionada | REFERENCE | Registro explica por que self-analysis muda quando o próprio código muda e por que a comparação correta usa entrada congelada |
| .superpowers/.../task-1-report.md, task-2-report.md, task-3-report.md, task-4-report.md | DELETE após extrair lição acima | REFERENCE técnica, sem migração | Histórico de gates/commits redundante; nada autoriza reviver suas tarefas |
| .superpowers/.../task-{1,2,3,4}-brief.md | DELETE | LEAVE LEGACY | Planos de implementação encerrados para estrutura antiga |
| .superpowers/.../task-{1,2,3,4}-review-constraints.md | DELETE | LEAVE LEGACY | Restrições de reviews específicos, não política atual |
| docs/audits/bunkercode-legacy-demolition.md | KEEP | MIGRATE como registro de decisão/proveniência | Único documento novo; atualizar somente com revisões desta auditoria e decisão de reconstrução |

Duas inconsistências documentais concretas reforçam a necessidade de seleção, não cópia: `LEARNING_CHECKPOINT.md` ainda afirma nas notas finais que a raiz não é analisável sem tsconfig, embora suporte PNPM exista e seja exercitado; ADR-020 diz “failed beats partial”, mas runtime atual com resultado válido e failure retorna partially-evaluated. Não reescrever fatos históricos em silêncio: distinguir decisão da época e comportamento atual.

#### Outline recomendado para o README futuro (não implementado)

1. BunkerCode em reconstrução; autor aprendendo backend e compartilhando prática.
2. O que a geração anterior tentou: visualizar estrutura, dependências e intenção arquitetural.
3. O aprendizado: ver todos os elementos não desenvolve por si só fluência para escrever, depurar e modificar código; apresentar como mudança de tese do autor, não resultado de estudo pedagógico controlado.
4. O que pode sobreviver: análise estática com evidências como infraestrutura de perguntas/pistas/feedback, sem prometer migração integral.
5. Nova experiência: atividades pequenas e projetos reais, aluno prevê/resolve antes da explicação; Learn/Practice/Lab/Build/Analyze sem definir arquitetura.
6. Stack inicial: TypeScript, Node.js, NestJS, PostgreSQL; autor como primeiro usuário; sem prometer SaaS/IA/línguas extras.
7. Estado verificável, link ao relatório e ao marco legado; arquitetura ainda depende do BunkerLab. Comandos de uso só após existir base nova funcional.

#### Artefatos auxiliares fora do Git ativo

| Grupo local | Classe | Decisão / limite |
|---|---|---|
| spatial-prototypes/{atlas,hyperbolic,icicle}/{model,view}.ts | LEAVE LEGACY | Algoritmos visuais corretos não respondem prática backend; nenhum renderer migra |
| spatial-prototypes/peneira2/{context,foveated,main,panorama,skeleton,view}.ts e style.css | LEAVE LEGACY | Variantes de contexto/slots/paginação da tese espacial |
| spatial-prototypes/{main,facts,snapshots,bench,freeze,serve,capture,capture-peneira2,verify,verify-peneira2}.ts; style.css/tsconfig/.gitignore | LEAVE LEGACY; REFERENCE para invariantes de conservação | facts importa geografia/frontier da própria UI, portanto não é novo núcleo independente. Harness e benchmarks apenas desse laboratório |
| spatial-prototypes/3d/{main,world,semantic,serve,verify,smoke,smoke-semantic}.ts, style.css, package.json/package-lock.json | LEAVE LEGACY | Three.js 0.186.0 local fora do workspace; LOD, raycast, semântica visual não pertencem ao novo produto |
| spatial-prototypes/3d/j2/{main,world,serve,verify,smoke}.ts e style.css | LEAVE LEGACY | Polígonos/terraços/LOD preservam geografia, não ensinam backend por si só. J2 consta do log local, não da nova arquitetura |
| spatial-prototypes/.snapshots/{bc,bm,cadisk}.json | LEAVE LEGACY na base nova | Dados congelados de projetos externos; não publicar nem presumir que Git os guarda |
| spatial-prototypes/captures/** (PNG/measurements JSON) | REFERENCE seletiva, restante DELETE futuro | Selecionar poucas evidências históricas se necessário; não transportar todas as capturas |
| .superpowers/.../*.diff e .superpowers/sdd/.gitignore | LEAVE LEGACY | Diffs/infra de execução antiga, não código necessário; confirmar histórico antes de apagar únicos artefatos locais |
| node_modules, dist, generated, caches | LEAVE LEGACY como artefato | Derivados reinstaláveis/regeneráveis; não são materiais de migração. Nada apagado nesta rodada |
| .editorconfig | LEAVE LEGACY | Arquivo vazio (0 linhas); não fornece convenção real a preservar |

A frase “Git preserva o passado” vale para arquivos commitados, **não para todo conteúdo local**: J2 e notas ignoradas podem existir só nesta máquina. Antes de uma demolição futura, selecionar o mínimo histórico realmente valioso desses itens. Isso não exige manter o laboratório no working tree ativo.

## 11. Historical artifact

`info_legado.md`, dez linhas, foi adicionado no commit `2810761948da038a0c2007cc6bde0e25b988a167` (`docs: backup pre legacy`, 2026-10-07 13:43:13 -0300), juntamente com sua exceção no `.gitignore`. Commit anterior: `3ab7d0a` (`feat: improve design studio`, 2026-09-26).

Seu conteúdo não é uma especificação detalhada do último produto: é um **marco de descontinuação e intenção de auditar/extrair valor para estudos**. O README no commit anterior e os fontes são o registro técnico mais substancial do estágio congelado. Não atribuir ao pequeno arquivo detalhes que ele não contém.

Recomendação: **REFERENCE / historical**; após decisão de demolição, movê-lo para `legacy/2026-10-07-retirement-note.md` com referência ao commit; acompanhá-lo no máximo por uma síntese da tese antiga/README congelado e resultados relevantes da investigação visual. Não mover agora. Preservar Git como fonte completa, sem copiar todos os roadmaps e notas para a arquitetura ativa.

## 12. Pedagogical opportunities

Possibilidades concretas, **não requisitos nem arquitetura aprovada**. Em todas, solicitar resposta/previsão antes de revelar evidência. O analyzer fornece fatos ao autor/gabarito; não precisa exibir o sistema inteiro.

| Família / pequena atividade | Capacidade existente que ajuda | Evidência/feedback possível | Limite e peça ausente |
|---|---|---|---|
| Dependências: dado main.ts/service.ts, escrever quem usa quem | imports + queries diretas | linha do import; aresta A→B | Import não prova chamada executada; atividade não precisa grafo visual |
| Debugging: corrigir alias quebrado em paths | unresolved configurado + resolução TS | moduleSpecifier, tsconfig e motivo; reanalisar após edição | Externo inferido pode não existir; não usar ausência de unresolved como sucesso geral |
| Ciclos: encontrar sequência fechada e escolher uma mudança | SCC/ciclo representante | sequência e imports que fecham caminho | Não diz se runtime quebra nem qual refactor é melhor; corrigir circularity antes de usá-la |
| Impacto: prever arquivos que merecem revisão após mudar service.ts | BFS reversa com menor caminho | caminho alvo→dependentes e profundidade | Alcance estático, não garantia semântica; não atribuir risco/nota pelo tamanho |
| Comparação: qual arquivo alcança mais dependentes nesta fixture pequena? | chamar BFS para cada candidato | conjuntos de arquivos distintos | Resultado sobre grafo conhecido, não importância universal; não pré-calcular projeto inteiro sem necessidade |
| Leitura Nest: localizar método anotado como rota e explicar os sinais | Controller + decorator HTTP importado | trecho/linha dos dois decorators | Não resolve URL efetiva nem registro real do controller |
| Nest guards: localizar onde UseGuards foi declarado e prever sua intenção | detector de annotation | annotation e subject; pedir ao aluno inspecionar guard | Não comprova bloqueio de request; execução/teste de comportamento é outra capacidade |
| Nest modules: identificar classe anotada Module e investigar seu conteúdo | detector de wiring | decorator e fonte para abrir | Não há grafo de DI, validação providers/imports/exports ou resolução de Module dinâmica |
| Investigação: “sem finding” significa “não existe”? | coverage + limitações + exemplos negativos | comparar sem sinais, unsupported e evaluated-zero | Cobertura atual é por regra, não prova de ausência; ótima atividade sobre limites de ferramentas |
| Estrutura: explicar por que arquivo ficou fora de um package | fixture PNPM e evidência de membership | padrão YAML/manifest/tsconfig | Condicional a estudo de workspace; REFERENCE, não primeira dependência obrigatória |
| Persistência: provar que findMany pertence a um PrismaClient | detector Prisma e binding chain | import, tipo/subclasse e chamada | Somente se autor estudar Prisma; não valida SQL, transação ou PostgreSQL |
| Leitura de chamadas: distinguir declaração resolvida de execução | experimento invocations | ranges + unclassified reasons | REFERENCE; não cobrir dispatch de instância com promessa inexata |

Não existem aqui avaliação de sintaxe digitada pelo aluno, executor seguro, gestão de exercícios/tentativas, progressão, critérios de correção de solução, testes de comportamento Nest/SQL ou sistema de pistas. Não converter necessidades possíveis em componentes antes de auditar BunkerLab. Para um puzzle fixo de dois arquivos, um gabarito curado pode ser mais simples que carregar analyzer: só usar análise quando a variação de código e a evidência dinâmica justificarem.

## 13. Simplification opportunities

Medição local dos fontes atuais: analyzer **19 arquivos / 1.854 linhas**; graph-engine **6 / 1.223**; contracts **6 / 425**. Explorer ocupa **66 arquivos / 10.133 linhas** incluindo estilos/config; Studio **11 / 690**. Isso mede estoque, não valor nem porcentagem comprovada de reaproveitamento.

- Analyzer: os arquivos analyze-project, session, discovery, nestjs/common, identities, detector/runtime somam **838 linhas (~45%)** do fonte atual. Esse recorte ainda exige retirar PNPM/contratos antigos da orquestração e adicionar fronteira adequada; é estimativa de seleção, não código extraível por cópia. Sem descoberta recursiva/runtime universal pode diminuir mais. Eliminar todos os wrappers OBSERVE; Prisma/invocations ficam fora do primeiro candidato.
- Engine: project-graph + project-impact têm **552 linhas (~45%)**. Consultas de adjacência, SCC e BFS são a parte útil; normalizar fronteira, revisar cache e corrigir membership circular requer adaptação. Não há necessidade de manter 318 linhas de estrutura e 250 de diagnóstico universal junto delas.
- Contratos: retirar os três arquivos de Planned/Observed elimina **164 das 425 linhas** antes de reduzir responsabilidade e workspace. Uma fronteira de fatos/evidência pode ser muito menor; um alvo de 20–50% é plausível como hipótese de escopo, **não promessa validada**. Não definir agora o novo schema apenas para atingir percentual.
- UI: não selecionar 20–50%; selecionar **zero código de componentes**. Poucas funções/conceitos de agrupamento podem ser reimplementados em poucas linhas quando uma atividade pedir. Eliminar projeção não elimina os fatos originais.
- CLI: comando de desenvolvimento para um exercício pode retornar só extração ou uma consulta; não duplicar `analysis/graph/diagnostics/structure/packageDependencies` em toda execução.
- Testes: dividir cenários úteis das expectativas da representação removida; preservar casos de resolução e contraexemplos. Não manter suítes gigantes de UI para defender código que não será migrado.

Nenhuma estimativa demonstra que 45% atual terá poder equivalente em todos os projetos. O objetivo é preservar o valor das perguntas selecionadas, não a abrangência do produto antigo.

## 14. Migration candidates

Candidatos em ordem de força, sem definir packages de destino:

1. Evidência localizada, motivo de irresolução, resultados determinísticos e separação de AST interna/dado público (**MIGRATE princípios/dados mínimos**).
2. Consultas de dependência/dependentes, SCC e BFS (**MIGRATE algoritmos**, novo contrato; relatório de impacto **ADAPT** após correção).
3. Extração de imports/reexports e carregamento de projeto TS (**ADAPT**); resolver escopo, contextos sobrepostos e significado de externo.
4. Regras Nest pequenas e explicáveis (**ADAPT**) para atividades de decorators, sem generalizar para toda a arquitetura backend.
5. Casos de teste e fixture simple-import (**MIGRATE cenários / ADAPT configuração**) e harness local/CLI (**ADAPT**).
6. TypeScript estrito (**MIGRATE rigor / revisar moduleResolution no destino**).

Nenhum destes implica manter analyzer-typescript, graph-engine ou contracts como packages separados. PNPM amplo, Prisma, invocations, armazenamento visual e editor são excluídos do núcleo mínimo proposto.

#### Proveniência que merece registro na eventual extração

Base exata de seleção: `2810761948da038a0c2007cc6bde0e25b988a167`. Registrar no destino repositório de origem, SHA, caminhos e quais simplificações/correções foram feitas; não inventar que o código foi escrito do zero.

| Material | Commits identificados em git log | Justificativa |
|---|---|---|
| AST/imports/contrato e aliases | 9c03b59, 064ed8a, 4237f6f, 1e49b1d; correção 504a297 | Casos de resolução e analyzed-file membership explicam decisões não óbvias |
| SCC/índices/impacto | 0d29252, 1e49b1d, 3a59e4b | Preservar origem de algoritmos e registrar correção de circularity, não transportar bug como contrato |
| Sessão/responsabilidades/Nest | 0775648, 753a84b, d1ad893 | Regras e evidência versionadas, limite de inferência |
| Prisma (somente referência agora) | 10aff46 | Técnica de binding proof, não capacidade PostgreSQL genérica |
| Invocations (somente referência) | 446413b, e50c3e1, d3603d7, 2b668f3, 6277c2e | Limites de identidade, optional calls e contextos; evitar reabrir promessa de dispatch |
| Workspace/estrutura (referência) | 48c97f1, 1d96926; 50fcd68 e 4e2fc60 citados nos reports locais | Se voltar a ser necessário, conhecer separação entre membership e paths |
| Marco de encerramento/Studio | 2810761, 3ab7d0a, 4445788, 029b2a4 | Explica ruptura de tese, não candidato de implementação |

Não há LICENSE entre os 168 arquivos versionados atuais. Licenças transitivas não foram auditadas nesta rodada.


## 15. Deletion candidates

Após aprovação da demolição, alta confiança para deixar fora da nova base:

- `apps/explorer-web/**` e `apps/studio-web/**`, estilos, imagens/artefatos gerados, Vite/React Flow/ELK e automação browser associada.
- `packages/planned-system/**` e `packages/design-model/**`; consultar apenas os poucos testes/técnicas classificados REFERENCE.
- Contratos `planned-system.ts`, `observed-responsibility.ts`, `observed-static-code.ts` e os seis arquivos de implementação/produtores `observed-*` / `analyze-observed-*` no analyzer.
- Taxonomia sem detector, heurísticas many-dependents/many-dependencies e relatório universal de diagnóstico; geografia/containment para navegação integral.
- `spatial-prototypes/**` como código ativo; snapshots externos/capturas não migram. Selecionar primeiro eventuais registros históricos locais únicos.
- Testes exclusivos de UI/gramática antiga, scripts explorer/design/build visual, dependências específicas e docs de planos encerrados.

**Não apagar agora.** “REFERENCE” também fica fora da base nova, mas descreve conhecimento a consultar. Deletar código não autoriza limpar localStorage do autor, publicar snapshots de outros projetos ou apagar notas locais únicas sem seleção histórica. A remoção futura deve ajustar consumidores/manifests/test scripts conjuntamente, não deixar imports quebrados.

## 16. Unknowns

- **Dependem da auditoria BunkerLab:** qual ciclo pedagógico já existe, como são criadas/avaliadas atividades, que editor/executor/test harness já há, sobreposição de contratos, onde integrar capacidades e qual será o menor primeiro fluxo completo. Não importar arquitetura BunkerCode para preencher essas respostas.
- **Dependem de decisão de produto:** primeiro exercício real; gabarito curado versus análise; suporte a workspace; Prisma versus SQL/Nest sem ORM; quanto de descoberta automática o autor precisa. Learn/Practice/Lab/Build/Analyze continuam modos possíveis.
- **Antes de usar como avaliador:** escopo da exatidão estática, suporte a código malformado, lacunas de wrappers/reexports Nest, revisionamento de evidência e política para contextos TS sobrepostos. Falha no suporte não pode virar erro do aluno.
- **Antes de extrair engine:** corrigir membership circular e decidir imutabilidade/índices; confirmar validação na fronteira para JSON não confiável. Nenhuma correção autorizada nesta rodada.
- **Não demonstrado:** runtime completo, segurança de execução de código do aluno, análise SQL/PostgreSQL, desempenho extremo, portabilidade Windows e Node 24, qualidade pedagógica ou ganho de aprendizagem. Browser/build não foram revalidados.
- **Persistência do relatório:** ignorado por regra Markdown; sua inclusão no Git exige ação explícita posterior. Histórico Git e este documento são complementares às notas locais selecionadas.

Próxima decisão precisa: auditar BunkerLab sob a mesma tese, comparar materiais candidatos e escolher uma única atividade de ponta a ponta. Só então definir a fronteira mínima e aprovar extração/demolição. Não iniciar nova arquitetura nem reparos no legado a partir deste relatório.

## Validação reproduzível e registro de fechamento

| Comando / verificação | Resultado atual | Interpretação |
|---|---|---|
| `pnpm typecheck` e `pnpm test` | exit 1, ERR_SQLITE_ERROR: unable to open database file | PNPM acionou install automático antes do script; não atribuir falha ao código; não instalar/alterar dependências nesta rodada |
| Script exato de typecheck do manifest via Node/spawnSync | exit 0 | Todos os oito tsconfigs do workspace passam no Node 26.5.0/deps locais |
| Script exato de test do manifest via Node/spawnSync | exit 0, 14 arquivos aprovados, ~80,4s | Reporter resumiu por arquivo, não alegar apenas 14 casos |
| Mesmos 14 módulos de teste importados diretamente com tsx | exit 0, 141 casos: 136 pass / 5 skip / 0 fail, ~78,4s | Confirma detalhes ocultos pelo reporter; browser gated não executado |
| `node --import tsx --test --test-reporter=tap test/project-graph.test.ts` | exit 0, um arquivo aprovado | Mesmo resumo do runner, investigação do detalhe |
| `node --import tsx test/project-graph.test.ts` | exit 0, 18 casos pass | Confirma execução explícita dos casos do engine |
| Prova mínima SCC/circularity e mutação/cache | exit 0; resultados inadequados reproduzidos | Bug circularity e premissa de cache confirmados; não são novos testes permanentes |
| `git status --short`, `git diff --check` | vazio / exit 0 | Arquivos versionados preservados; relatório continua ignorado |
| `git diff --no-index --check /dev/null docs/audits/bunkercode-legacy-demolition.md` | whitespace detectado na primeira revisão; corrigido; rerun sem diagnósticos, exit 1 por diferença contra /dev/null | Verificação inclui o documento ignorado, que diff normal não cobre |

Reproduzir scripts sem acionar instalação PNPM (com dependências já presentes):

```bash
node --input-type=module -e 'import fs from "node:fs"; import {spawnSync} from "node:child_process"; const p=JSON.parse(fs.readFileSync("package.json","utf8")); process.exitCode=spawnSync(p.scripts.typecheck,{shell:true,stdio:"inherit"}).status ?? 1;'
node --input-type=module -e 'import fs from "node:fs"; import {spawnSync} from "node:child_process"; const p=JSON.parse(fs.readFileSync("package.json","utf8")); process.exitCode=spawnSync(p.scripts.test,{shell:true,stdio:"inherit"}).status ?? 1;'
node --import tsx --input-type=module <<'JS'
import fs from 'node:fs';
const script=JSON.parse(fs.readFileSync('package.json','utf8')).scripts.test;
for (const file of script.split(' ').filter(p=>p.startsWith('test/') && p.endsWith('.test.ts'))) await import('./'+file);
JS
```

Logs desta sessão: `/tmp/bunkercode-audit-typecheck.log`, `test.log` com mesmo prefixo; `typecheck-direct.log`, `test-direct.log`, `graph-tap.log`, `graph-direct-file.log`, `tests-detailed.log`. São apoio temporário; os resultados importantes estão neste relatório. Não há warning na execução direta observada. Node observado difere do Node 24 indicado no README. Não existem scripts raiz build/lint; builds dos apps e browser foram dispensados por não acrescentarem evidência à decisão de demolição.

### Reprodução das duas observações do grafo

```bash
node --import tsx --input-type=module <<'JS'
import {buildProjectGraph, detectCycles, getDependencies, createImpactReport}
  from './packages/graph-engine/src/index.ts';
const files=['a.ts','b.ts','c.ts'].map(id=>({id,path:id}));
const pairs=[['a.ts','b.ts'],['b.ts','a.ts'],['b.ts','c.ts'],['c.ts','b.ts']];
const analysis={schemaVersion:1,analyzer:{name:'audit',language:'typescript'},
  projectPath:'.',files,unresolvedDependencies:[],diagnostics:[],
  dependencies:pairs.map(([sourceFileId,targetFileId],i)=>({sourceFileId,targetFileId,
    moduleSpecifier:'./'+targetFileId,kind:'internal',confidence:'exact',
    evidence:{location:{filePath:sourceFileId,line:i+1,column:1}}}))};
const graph=buildProjectGraph(analysis);
console.log(JSON.stringify({cycles:detectCycles(graph),
  cCircularity:createImpactReport(graph,'c.ts').circularity}));
const mutable=buildProjectGraph(analysis);
const before=getDependencies(mutable,'a.ts').length;
mutable.edges=[];
console.log(JSON.stringify({cacheProbe:{before,edgesNow:mutable.edges.length,
  queryAfter:getDependencies(mutable,'a.ts').length}}));
JS
```

Saída observada: ciclo `a.ts,b.ts,a.ts`; cCircularity `false`; cacheProbe `{before:1,edgesNow:0,queryAfter:1}`. Sem escrita de fixture nem execução de projeto analisado.

### Gates A–E aplicados ao núcleo candidato

| Peça importante | A: problema concreto | B: menor solução | C: vínculo com tese antiga | D: faz aluno pensar | E: justificativa verificável |
|---|---|---|---|---|---|
| Imports/aliases/unresolved | Localizar dependência quebrada | ADAPT análise por alvo, sem Units; gabarito manual se fixture fixa | Fatos independem do mapa | Resposta antes do import destacado | specifier + linha/coluna + motivo |
| Queries/SCC/BFS | Prever dependentes/ciclo/caminho | MIGRATE algoritmos, ADAPT contratos; sem diagnóstico geral | Relações independem de visualização | Pedir caminho antes de revelar | Arestas rastreáveis; corrigir membership |
| Regras Nest | Identificar declaração de rota/guard/module | ADAPT regras específicas, sem 14 categorias | Findings independem da lens | Perguntar pelo sinal, não entregar rótulo | Import + decorator + detector/regra; limite estático |
| Evidência/confiança/estado | Não avaliar ausência de suporte como erro do aluno | Contrato mínimo por regra | Remover camada supports duplicada | Revelar pista em passos | Fonte e limitação explícitas |
| CLI/harness/fixtures | Autor verificar exercício localmente | ADAPT saída pequena, fixture autocontida | Sem comandos de mapa | Infra invisível para construir exercício | JSON determinístico e testes de erro |
| Rigor TypeScript | Manter contratos/invariantes confiáveis | Config pequena e compatível com destino | Sem dependência de produto visual | Suporta implementação dos exercícios | Typecheck estrito; não substitui testes |

Prisma, workspace amplo e invocations ficam REFERENCE porque não passaram o gate de consumidor imediato; UI/gramática completa falham principalmente A/B/C. Nenhuma capacidade existe no novo produto só por ser tecnicamente interessante.

### Síntese de aprendizagem e verificação

Investigamos quais materiais sustentam prática backend. Como desmontar um painel de laboratório, vale reaproveitar instrumentos de medição e suas calibrações, sem transportar toda a sala de controle. Tecnicamente, foram separados fatos extraídos, consultas, interpretações e apresentação, rastreados consumidores e executados testes/provas pequenas.

A evidência demonstra mecanismos úteis e dois limites concretos no engine; não demonstra que visualizar código ensina nem que o analyzer consegue corrigir qualquer solução. A hipótese de migrar analyzer/graph-engine intactos foi rejeitada. Agora sabemos que o valor está na ligação entre pergunta pequena e evidência verificável. A próxima decisão é comparar BunkerLab e escolher o exercício; não implementar outro mapa.

Relevância didática: HIGH. O registro fica somente aqui por autorização específica de um único documento, sem atualizar logs/checkpoint antigos. Mensagem de commit sugerida: `docs: audit legacy BunkerCode architecture for reconstruction`. Nenhum commit/push realizado.

### Estado final para continuidade

Todas as unidades U1–U7 foram concluídas e registradas. Nenhuma área do núcleo ficou com classificação pendente; os limites de profundidade da revisão visual/histórica estão declarados nas seções correspondentes. Este relatório cobre os 19 fontes do analyzer, seis do engine, seis de contracts, os 14 arquivos de testes e grupos arquiteturais de todos os apps/configs/fixtures, além do inventário documental/local. A revisão de cobertura confirmou que todos os nomes desses fontes e testes estão no mapa.

Único arquivo criado no repositório: `docs/audits/bunkercode-legacy-demolition.md` (ignorado). Nenhum arquivo versionado modificado/staged; branch/base preservadas, nenhum commit/push. Logs auxiliares temporários ficaram em `/tmp`, fora do repositório. Typecheck/testes não emitiram build e o snapshot preexistente foi apenas lido. A arquitetura ativa, README, AGENTS e notas históricas permanecem intactos por restrição explícita desta rodada.

Para continuar: ler este relatório e o pedido de reconstrução nele resumido; não retomar fases do checklist antigo. O próximo trabalho recomendado é a auditoria do BunkerLab, mediante pedido próprio, para comparar capacidades e decidir um primeiro exercício. Correções do engine, migração e exclusões ainda não foram autorizadas. Se a próxima sessão for só revisão deste relatório, alterar exclusivamente este arquivo e manter a distinção entre evidência observada, inferência e proposta.
