# Arquitetura atual do BunkerCode

Data: 2026-10-08. Esta é a referência ativa. A missão de consolidação substitui as decisões anteriores incompatíveis.

BunkerCode é uma plataforma pessoal e aberta para estudar backend e transformar entendimento em conteúdo autoral. O fluxo principal é estudar fora, praticar, escrever uma lição no repositório, revisar no site e fazer commit manualmente.

## Estrutura

- apps/frontend: React, React Router e Vite; cursos, leitor Markdown e exercícios opcionais.
- apps/backend: um monólito modular NestJS; conteúdo, tentativas locais e instrumentos concretos.
- content/courses: manifestos de cursos e lições Markdown.
- content/activities: duas atividades executáveis, com starters e harnesses confiáveis.
- scripts: comando de autoria e seus testes.
- docs: documentação atual, implementação e histórico selecionado.

A raiz configura o monorepo: package.json, pnpm-workspace.yaml, lockfile, ESLint, tsconfig.base.json e .gitignore. O tsconfig base compartilha strictness/target realmente usados pelas duas aplicações; DOM pertence ao frontend, Node e decorators ao backend. Vite, Playwright e tsconfigs específicos ficam nas aplicações. Não há packages compartilhados, Turborepo ou Nx.

## Conteúdo e leitura

course.json define id, título, descrição e ordem das lições. Cada entrada possui slug, título e opcionalmente activityId. O caminho do Markdown é derivado: content/courses/<id>/lessons/<slug>/lesson.md. Não existe path livre vindo do navegador nem um índice duplicado em React/Nest.

A API oferece:
- GET /content/courses
- GET /content/courses/:id
- GET /content/courses/:id/lessons/:slug

Pastas de curso são descobertas por leitura do diretório. Manifestos são validados; IDs/slugs são restritos e symlinks internos recusados. Erros de scope retornam 400/404; conteúdo inválido/ausente retorna 422. Um manifesto inválido interrompe o catálogo com diagnóstico explícito, em vez de esconder um curso quebrado.

Arquivos são lidos sob demanda, com Cache-Control: no-store. Salvar e recarregar basta; não há watcher, cache editorial, fila ou sincronização. Limites iniciais: 64 KiB por manifesto e 256 KiB por Markdown. O conteúdo completo não cabe nos resultados de execução nem no SQLite.

O frontend usa react-markdown, ignora HTML bruto, sanitiza a árvore e aplica highlighting somente à linguagem declarada no fence. Blocos são texto: nunca passam pelo executor. Links inseguros são removidos. O highlighter é um plugin confiável aplicado após a sanitização, conforme sua documentação; não existe rehype-raw, MDX ou dangerouslySetInnerHTML. Referências podem abrir outra aba com noopener/noreferrer.

## Aprendizagem opcional

LearningActivity + Attempt continuam sendo o domínio dos exercícios. A Lesson pode ter somente texto; leitura não cria Attempt, não inicia processo e não faz request aos endpoints de aprendizagem.

Os exercícios anteriores foram mantidos porque suas fronteiras já são pequenas e independentes:
- order-acceptance: previsão, código congelado e uma request de negócio HTTP real;
- reserve-stock: código congelado e três casos reais do node:test, sem servidor.

O LearningModule faz parte do único AppModule. Não há outro bootstrap/aplicação Nest para aprendizagem. A implementação mantém os endpoints /learning existentes, os IDs/revisões e o SQLite .bunkercode/learning.sqlite. Não ocorreu migração de dados.

Instrumentos continuam concretos, com temporário/processo/estado novos e prazo/cleanup. Eles servem somente a submissões explícitas. Execução local é para código confiável; filho não é sandbox hostil. Linux é a plataforma efetivamente validada.

## Demolição e dados

Workbench, System, Surface, catálogo/runner/orchestration históricos, protocolo @backendlab, templates OrderDesk, migrations lab e seus testes exclusivos foram retirados. Não existem wrappers de compatibilidade.

.bunkerlab e .backendlab permanecem ignorados e sem consumidor no produto novo; dados pessoais históricos não foram migrados nem apagados. .bunkercode existente foi preservado. Dependências locais foram instaladas neste checkout, sem vínculos de aplicação com outro checkout.

Auditorias em docs/audits, a proposta anterior e a rodada first-learning-flows são históricas. Não definem backlog ou obrigação de preservar código. Veja [consolidação](../implementation/consolidation-mvp.md) e [autoria](../authoring.md).

## Próximo incremento

Usar o fluxo editorial para escrever uma lição real de TypeScript. Registrar dificuldades de autoria/leitura antes de adicionar funcionalidades. Editor inteligente, analyzer, progresso sofisticado, CMS, auth e execução remota permanecem fora desta rodada.
