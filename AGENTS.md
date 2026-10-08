# AGENTS.md — BunkerCode

## Produto e referências ativas

BunkerCode é uma plataforma pessoal e aberta de aprendizagem de backend. O autor é seu primeiro usuário. Prioridade atual: estudar, praticar, escrever entendimento próprio em Markdown, revisar no site e fazer commit manualmente.

Arquitetura ativa: docs/architecture/overview.md. Autoria: docs/authoring.md. Implementação atual: docs/implementation/consolidation-mvp.md. Auditorias, arquitetura de reconstrução anterior e primeiros fluxos são documentos históricos; não reautorizam backlog nem obrigam compatibilidade.

## Arquitetura e simplicidade

Monorepo PNPM, apps/frontend (React/Vite), apps/backend (um monólito modular NestJS), content/courses e content/activities. Configs da raiz configuram o repo; Vite/Playwright/tsconfigs específicos ficam nas aplicações. Compartilhar opções/package somente com necessidade real.

Não reintroduzir Workbench, System, Surface, LaboratoryService, protocolo universal, runtime manager genérico ou wrappers do legado. Não construir microservices, CMS, analyzer vazio, editor universal, auth, social ou gamificação por antecipação.

Conteúdo existe fora da UI. course.json é a fonte de identidade, título e ordem; cada lição é Markdown independente. Adicionar curso/lição não deve exigir edição de React/Nest. Seções editoriais são sugestões, nunca schema obrigatório.

## Pedagogia e evidência

Não atribuir texto demonstrativo ou experiências inventadas ao autor. Identificar exemplos iniciais; incentivar autoria própria e referências. Leitura não exige Activity, Attempt ou executor.

Exercícios: contexto -> ação do aluno -> submissão -> execução/teste -> evidência -> comparação -> feedback -> nova tentativa. Não revelar resultado automaticamente nem resolver Student Mode sem pedido explícito. Teste verde não prova compreensão.

LearningActivity/Attempt permanecem domínio dos exercícios. Congelar fonte/revisão/entradas antes de executar; resultado pertence à Submission, não ao draft atual. Preservar revisão otimista e recuperação sem reexecutar pendências.

Preferir execução real, instrumentação e observação. Identificar simulações; não confundir coleta com causalidade ou ausência de evento com ausência de comportamento. Instrumento relata; feedback interpreta evidência sem avaliar semanticamente justificativa livre.

## Implementação e segurança

TypeScript estrito, tipos próximos dos produtores, unknown validado, erros explícitos. Evitar any, catch vazio, mega classes e abstrações sem consumidor concreto.

IDs/slugs conhecidos e paths derivados/validados. Recusar traversal e symlinks inesperados. Markdown não executa HTML/JavaScript. Manter renderer consolidado, sanitização e highlighting como apresentação.

Código local do aluno é confiável; filho não é sandbox hostil. Comandos, flags e arquivos permitidos são definidos no servidor; output e prazo limitados. Confirmar encerramento/cleanup antes de liberar execução e isolar processos/estado. Código canônico não é modificado pelo aluno.

Não modificar projetos irmãos, expor secrets/credenciais/.env ou destruir dados não versionados. Demolição de código versionado pode ocorrer quando autorizada e sem consumidor; preservar mudanças recentes e inventariar dados ignorados antes de exclusões. .bunkercode é armazenamento ativo; dados históricos preservados não exigem compatibilidade ou migração.

## Idioma e documentação

Código, identificadores, nomes técnicos e testes em inglês. Documentação e explicações em português brasileiro; termos técnicos usuais podem permanecer em inglês. Não criar i18n sem necessidade.

README conciso e verdadeiro. Atualizar docs quando mudar comportamento, contratos, estrutura ou comandos. Não gerar documentos redundantes; distinguir estado atual de história e fatos de interpretação.

## Validação e entrega

Preferência persistente do autor: trabalhar diretamente no checkout principal do repositório, atualmente `/home/henrique/Projetos/BunkerCode`, na branch main. Antes de editar, conferir git status e git worktree list; não assumir que o worktree aberto pela ferramenta é o local desejado. Não criar branch/worktree ou isolar mudanças por padrão. Usar isolamento somente por pedido explícito ou risco concreto, como produção ou operação perigosa, explicando o motivo. Preservar mudanças existentes, reconciliar conflitos e deixar alterações locais prontas para o commit manual do autor.

Executar pnpm lint, pnpm typecheck, pnpm test, pnpm build e E2E pertinentes. Testar autoria, renderização segura, ordem/navegação, refresh, persistência, revisão obsoleta e lifecycle dos exercícios. Usar comportamento real barato antes de mocks; não criar testes que apenas reproduzam implementação.

Distinguir falha ambiental, falha de código, teste não executado e teste removido com funcionalidade aposentada. Registrar warnings, skips, flakes, falhas e reruns. Não declarar sucesso com check relevante falhando.

Não fazer commit, push, rebase, reset destrutivo ou remover worktrees automaticamente. Conferir status/diff/diff --check ao final e sugerir uma única mensagem de commit em inglês no formato Conventional Commits.

Relatório: Resultado; O que foi feito; Por que; Estratégia; Como funciona; Conceitos importantes; Trade-offs/limitações; O que revisar manualmente; Arquivos importantes; Validações executadas; Review sugerido; Commit sugerido. Review curto em português deve destacar propriedades concretas.

HANDOFF: terminar somente unidade atômica, registrar Git, estrutura, arquivos removidos/movidos/novos, gates, erros, comandos e próximo passo exato. Não reiniciar a auditoria inteira.
