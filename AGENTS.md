# AGENTS.md — BunkerCode

## Produto e referências ativas

BunkerCode é uma plataforma pessoal e aberta para estudar programação e construir conhecimento autoral. O autor é seu primeiro usuário. Prioridade atual: estudar, praticar, escrever entendimento próprio em Markdown, revisar no site e fazer commit manualmente.

Arquitetura ativa: docs/architecture/overview.md. Autoria: docs/authoring.md. Home com atividade local, Cursos, Leitor, prática CodeMirror e Studio compõem o MVP 03 refinado. Relatórios em docs/implementation, auditorias, arquitetura de reconstrução anterior e primeiros fluxos são documentos históricos; não reautorizam backlog nem obrigam compatibilidade.

## Arquitetura e simplicidade

Monorepo PNPM, apps/frontend (React/Vite), apps/backend (um monólito modular NestJS), content/courses. Configs da raiz configuram o repo; Vite/Playwright/tsconfigs específicos ficam nas aplicações. Compartilhar opções/package somente com necessidade real.

Não reintroduzir Workbench, System, Surface, LaboratoryService, protocolo universal, runtime manager genérico ou wrappers do legado. Não construir microservices, CMS, analyzer vazio, editor universal, auth, social ou gamificação por antecipação.

Conteúdo existe fora da UI. course.json é a fonte de identidade, título e ordem; cada lição é Markdown independente. Adicionar curso/lição não deve exigir edição de React/Nest. Seções editoriais são sugestões, nunca schema obrigatório.

## Aprendizagem e escopo

Não atribuir texto demonstrativo ou experiências inventadas ao autor. Identificar exemplos iniciais; incentivar autoria própria e referências. O fluxo é estudar, praticar fora do site, escrever em Markdown, revisar no leitor/Studio e fazer commit manualmente.

Exercícios executáveis, tentativas, submissões, previsões, feedback automatizado, persistência de aprendizagem e executores foram aposentados no MVP 02. Não reintroduzir essa infraestrutura, placeholders ou alternativas sem uma nova necessidade explicitamente autorizada. O MVP 03 autoriza exercícios editoriais de escrita com CodeMirror e rascunhos locais no IndexedDB, separados do Studio. O Refinamento 01 autoriza atividade local, compilação TypeScript/JavaScript, Run em containers restritos e Submit local não avaliado. Estes módulos novos não reintroduzem os contratos/executores aposentados. Fences Markdown continuam texto inerte; prática só executa por ação explícita com isolamento demonstrado.

## Implementação e segurança

TypeScript estrito, tipos próximos dos produtores, unknown validado, erros explícitos. Evitar any, catch vazio, mega classes e abstrações sem consumidor concreto.

IDs/slugs conhecidos e paths derivados/validados. Recusar traversal e symlinks inesperados. Markdown não executa HTML/JavaScript. Manter renderer consolidado, sanitização e highlighting como apresentação.

Não modificar projetos irmãos, expor secrets/credenciais/.env ou destruir dados não versionados. Demolição de código versionado pode ocorrer quando autorizada e sem consumidor; preservar mudanças recentes e inventariar dados ignorados antes de exclusões. .bunkercode, .bunkerlab e .backendlab são dados locais preservados, incluindo SQLite e capturas. Não abrir, migrar ou apagar bancos aposentados; não limpar arquivos ignorados. Testes de navegador devem usar diretórios de saída novos por rodada para preservar evidências anteriores.

## Idioma e documentação

Código, identificadores, nomes técnicos e testes em inglês. Documentação e explicações em português brasileiro; termos técnicos usuais podem permanecer em inglês. Não criar i18n sem necessidade.

README conciso e verdadeiro. Atualizar docs quando mudar comportamento, contratos, estrutura ou comandos. Não gerar documentos redundantes; distinguir estado atual de história e fatos de interpretação.

## Gate de relevância documental

Ao concluir uma mudança, avaliar se ela torna a documentação existente materialmente incorreta, incompleta ou enganosa para quem usa, desenvolve ou opera o projeto. Este é um gate de avaliação, não uma obrigação de editar documentos em toda tarefa.

Atualizar quando houver mudança relevante de experiência educacional, identidade do produto, arquitetura, segurança, autenticação, persistência, recuperação ou instruções essenciais de desenvolvimento/operação. O README apresenta o produto e sua direção; uma vez correto, não deve ser reescrito por nova lição, componente, endpoint, ajuste visual ou refactor interno. Preferir corrigir o guia existente, explicando o motivo da decisão e suas consequências práticas, sem duplicar relatórios.

README, guias humanos em docs, decisões arquiteturais e explicações devem usar português brasileiro acessível a quem está aprendendo desenvolvimento. Preservar precisão, detalhes de segurança, comandos, contratos e termos técnicos. Código, identificadores e Conventional Commits permanecem em inglês. Distinguir capacidade implementada, plano e registro histórico; IA auxilia engenharia, não substitui a autoria educacional do criador.

Registrar brevemente na entrega: **Atualização necessária e concluída**, **Atualização necessária, adiada com justificativa** ou **Nenhuma atualização necessária**. Quando o acervo exigir revisão maior, delimitar o que foi corrigido e o que foi adiado, sem reescrita geral nem exclusão de decisões históricas.

## Validação e entrega

Novos testes E2E devem preferencialmente ampliar os grupos funcionais existentes. Criar outro arquivo somente com razão objetiva de organização, isolamento ou manutenção; não criar automaticamente um arquivo numerado por refinamento. Excluir ou consolidar testes exige demonstrar equivalência integral da cobertura e conferir descoberta e execução nos runners correspondentes.

Preferência persistente do autor: trabalhar diretamente no checkout principal do repositório, atualmente `/home/henrique/Projetos/BunkerCode`, na branch main. Antes de editar, conferir git status e git worktree list; não assumir que o worktree aberto pela ferramenta é o local desejado. Não criar branch/worktree ou isolar mudanças por padrão. Usar isolamento somente por pedido explícito ou risco concreto, como produção ou operação perigosa, explicando o motivo. Preservar mudanças existentes, reconciliar conflitos e deixar alterações locais prontas para o commit manual do autor.

Executar os testes justificados pelo escopo e risco; nunca reduzir ou enfraquecer validação significativa para gerar menos evidências. Testar autoria, renderização segura, ordem/navegação, refresh, salvamento físico, revisão obsoleta, proteções HTTP e ausência de rotas aposentadas quando forem pertinentes. Usar comportamento real barato antes de mocks; não criar testes que apenas reproduzam implementação.

Distinguir falha ambiental, falha de código, teste não executado e teste removido com funcionalidade aposentada. Registrar warnings, skips, flakes, falhas e reruns. Não declarar sucesso com check relevante falhando nem tratar testes aprovados como prova de que todo o produto funciona. Relatar com precisão validação automatizada, comportamento realmente exercitado no navegador/runtime, cobertura não testada, bloqueios ambientais, regressões e trabalho incompleto. Não declarar uma suíte aprovada se a execução original falhou, mesmo quando reruns selecionados passam.

Normalmente, resumir cada validação bem-sucedida no relatório com comando/suíte, resultado e código de saída, contagens relevantes (incluindo falhas e skips) e limitações ambientais. Executar um comando não exige preservar sua saída completa como artefato. Não criar logs permanentes separados para cada lint, typecheck, formatação, build ou rerun bem-sucedido. Logs temporários de diagnóstico são permitidos durante o trabalho. Reruns não exigem arquivos de evidência separados; ao corrigir uma falha, resumir a falha inicial e a resolução. Preservar detalhes suficientes para reproduzir ou entender falhas não resolvidas, regressões, riscos de integridade/segurança, defeitos de concorrência, bloqueios de infraestrutura e decisões sobre operações destrutivas: comando, trecho de erro, comportamento observado e validação posterior. Manter logs/traces completos somente quando necessários ao diagnóstico ou à demonstração.

Para mudanças visuais, guardar poucas capturas do comportamento final relevante; normalmente uma de desktop e uma de mobile bastam. Capturas adicionais devem demonstrar estado, regressão, acessibilidade ou comportamento distinto. Evitar capturas equivalentes; tarefas sem UI não precisam delas salvo motivo específico.

Dimensionar a entrega à complexidade e ao risco. Para tarefas substanciais, preferir um relatório conciso em português, diff unificado quando útil para revisão externa, uma evidência focada de falha quando necessária e poucas capturas para mudanças visuais. São opções, não arquivos obrigatórios: não criar placeholders vazios nem repetir saídas de comando ou detalhes já claros no diff. Relatar o que mudou, validações e resultados reais, bloqueios/pendências/incertezas, riscos relevantes, estado Git e próxima ação exata. Usar, quando aplicável, IMPLEMENTADO, VALIDADO, PARCIAL, BLOQUEADO, PENDENTE e INCERTO.

Não gerar ZIP/TAR, manifestos extensos, inventários de checksums, diffs duplicados, utilitários de verificação ou exportações integrais do repositório automaticamente. Preferir arquivos UTF-8 Markdown, texto, diff e PNG independentes quando for necessário entregar evidências para revisão no ChatGPT. Criar arquivos compactados ou pacotes abrangentes somente quando pedidos explicitamente ou justificados por requisito técnico concreto. Nenhum artefato deve ser criado apenas para verificar outro artefato desnecessário.

Antes de criar cada artefato, definir qual pergunta de revisão ele responde e selecionar o menor conjunto de evidências suficiente. Guardar diagnósticos temporários fora do repositório quando possível. Não adicionar logs, capturas, traces ou pacotes gerados ao Git salvo se forem assets mantidos explicitamente. Nunca apagar nem sobrescrever arquivos, logs ou evidências preexistentes do usuário sem autorização. Artefatos temporários próprios podem ser geridos quando sua origem e necessidade estiverem verificadas; a limpeza não pode atingir processos, bancos, containers ou worktrees alheios.

Não fazer commit, push, rebase, reset destrutivo ou remover worktrees automaticamente. Conferir status/diff/diff --check ao final e sugerir uma única mensagem de commit em inglês no formato Conventional Commits.

Em HANDOFF ou interrupção, registrar o objetivo original, concluído/incompleto, arquivos relevantes, gates/erros, motivo e próxima operação exata. Encerrar somente unidade atômica e conferir o estado existente antes de retomar; não substituir comportamento real por simulação para satisfazer aceitação.

## Fixtures do navegador

Apenas o supervisor `scripts/browser-backend.mjs` cria e limpa a fixture de conteúdo pertencente à execução, em diretório temporário nativo fora do checkout. Configuração e `--list` não copiam conteúdo. Encerramento normal, falhas controladas e SIGINT/SIGTERM limpam a cópia; SIGKILL pode deixar resíduo somente no temporário do sistema. Diretórios fornecidos explicitamente por ambiente nunca são removidos; sobreposição com conteúdo canônico é recusada. Exclusão não acompanha symlinks nem adota diretórios de outras execuções. Preservar resultados, traces, capturas e dados locais. Resíduos antigos exigem inventário, dry-run, comprovação de origem e ausência de consumidores ativos antes de limpeza direcionada. `.bunkerlab` permanece intocado; bancos históricos não são abertos nem migrados.

## Infraestrutura SQL

- SQL de aluno nunca executa no PostgreSQL principal nem no processo HTTP NestJS. Usar somente runner SQL descartável e isolado, sem credenciais do produto, com limites explícitos e recuperação verificada.
- Check SQL nunca persiste progresso; somente Submit autenticado e avaliado independentemente pode concluir. Avaliação anônima exige fronteira operacional e cotas por cliente/instalação verificadas; permanece bloqueada enquanto isso não for demonstrado. Isolamento e autorização nunca dependem só da UI.
- Publicar exercício não o seleciona na vitrine `/sql`: usar curadoria explícita em `content/sql/laboratory.json`. Não confundir ausência na lista com confidencialidade de uma projeção pública.
- Feedback/snapshot/hash do cliente nunca autoriza progresso. Submit SQL deve ser avaliado independentemente e usar autorização e progresso existentes.
- Oráculos e casos privados nunca entram em bundles, sourcemaps, manifests ou respostas públicas. Resultado esperado formativo só pode ser público por adesão editorial explícita, gerado no runner e vinculado à versão; é material didático inspecionável, sem autoridade sobre progresso. Projeções públicas devem ser explícitas e testadas.
- Definições/datasets usam validação canônica e versões publicadas imutáveis. Não manter catálogo TypeScript paralelo nem substituir versões históricas; mudanças de comportamento exigem nova versão.
- Studio exige ADMIN, revisão de rascunho e contratos locais de publicação. Reutilizar cursos, leitor e Studio existentes.
- Mudanças SQL exigem evidência de correção, isolamento, limites, autorização e recuperação antes de declarar a fronteira completa. Política detalhada: `docs/architecture/sql-assessment.md`.

- A admissão SQL usa cotas e uma vaga persistente próprias no PostgreSQL, sem consumir AuthThrottle ou executar SQL de aluno no produto. Todas as réplicas da instalação compartilham banco, segredo e daemon. Claim não expira automaticamente; falha de cleanup exige recuperação explícita com consumidores parados e inventário comprovado. Rootful fica restrito a desenvolvimento; implantação rootless exige prova de identidade sem acesso rootful e limites efetivos.
