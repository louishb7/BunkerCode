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

## Validação e entrega

Preferência persistente do autor: trabalhar diretamente no checkout principal do repositório, atualmente `/home/henrique/Projetos/BunkerCode`, na branch main. Antes de editar, conferir git status e git worktree list; não assumir que o worktree aberto pela ferramenta é o local desejado. Não criar branch/worktree ou isolar mudanças por padrão. Usar isolamento somente por pedido explícito ou risco concreto, como produção ou operação perigosa, explicando o motivo. Preservar mudanças existentes, reconciliar conflitos e deixar alterações locais prontas para o commit manual do autor.

Executar pnpm lint, pnpm typecheck, pnpm test, pnpm build e E2E pertinentes. Testar autoria, renderização segura, ordem/navegação, refresh, salvamento físico, revisão obsoleta, proteções HTTP e ausência de rotas aposentadas. Usar comportamento real barato antes de mocks; não criar testes que apenas reproduzam implementação.

Distinguir falha ambiental, falha de código, teste não executado e teste removido com funcionalidade aposentada. Registrar warnings, skips, flakes, falhas e reruns. Não declarar sucesso com check relevante falhando.

Não fazer commit, push, rebase, reset destrutivo ou remover worktrees automaticamente. Conferir status/diff/diff --check ao final e sugerir uma única mensagem de commit em inglês no formato Conventional Commits.

## Relatório e entrega — preferência permanente atualizada em 2026-10-10

Ao concluir qualquer tarefa, entregar relatório completo, autocontido e copiável diretamente na conversa, sem aguardar pedido de resumo. Precisão e densidade têm prioridade sobre volume; normalmente 800–1400 palavras, ajustadas à complexidade. Usar sempre:

A. Resultado: pedido, implementação real, conclusão parcial/completa/bloqueio e pendências.
B. Arquivos alterados: inventário completo de caminhos relativos, incluindo novos não rastreados; separar criados/modificados/removidos, com descrição curta.
C. Principais alterações de código: quando houver código, 3–6 trechos pequenos reais, preferencialmente diff, com caminho e explicação; nunca pseudocódigo ou arquivos completos.
D. Testes e validações: comandos/resultados reais, falhas corrigidas/reruns, falhas ambientais, não executados, skips/flakes; não confundir E2E parcial com suíte completa.
E. Problemas encontrados: causas comprovadas diferenciadas de hipóteses e soluções relevantes.
F. Pendências e riscos: limitações, regressões possíveis, revisão manual e decisões do autor.
G. Estado Git: branch, HEAD curto, contagem de criados/modificados/removidos, alterações preexistentes e confirmação de ausência de commit/push.
H. Commit sugerido: Conventional Commit em inglês correspondente ao trabalho; não executar commit. Preferir uma única mensagem para unidade atômica.
I. Próximo passo recomendado: uma ação objetiva, sem conclusão genérica.

Sem imagens relevantes, entregar somente texto: não criar ZIP, PDF, Markdown de relatório, pacote de transferência ou diff integral por padrão. Com imagens relevantes, manter o relatório na conversa e gerar um único ZIP pequeno, preferencialmente com 2–5 capturas de nomes descritivos, em `/tmp/codex-handoff/`; fornecer seu caminho/link. Não incluir código, repositório, patches, logs, dist, node_modules ou cópias redundantes. Pedido explícito de outro formato prevalece.

Evitar pacotes extensos automáticos, relatórios repetidos, buscas redundantes e reruns caros sem motivo concreto. Economia não justifica omitir falha, mudança importante ou risco de perda de dados. Preservar evidências anteriores; não remover dados ignorados ou não rastreados.

HANDOFF ou interrupção: usar a mesma estrutura, registrar objetivo original, concluído/incompleto, arquivos, gates/erros, motivo e próxima operação exata. Terminar somente unidade atômica; não reiniciar implementação/auditoria sem conferir estado existente. Não substituir comportamentos reais por simulações para satisfazer aceitação.
