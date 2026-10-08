# Arquitetura atual do BunkerCode

Data: 2026-10-08. Esta é a referência ativa. A consolidação e o Studio Fase 1 substituem as decisões anteriores incompatíveis.

BunkerCode é uma plataforma pessoal e aberta para estudar backend e transformar entendimento em conteúdo autoral. O fluxo principal é estudar fora, praticar, escrever uma lição no repositório, revisar no site e fazer commit manualmente.

## Estrutura

- apps/frontend: React, React Router e Vite; cursos, leitor Markdown, Studio local e exercícios opcionais.
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
- PUT /content/courses/:id/lessons/:slug/markdown

Pastas de curso são descobertas por leitura do diretório. Manifestos são validados; IDs/slugs são restritos e symlinks internos recusados. Erros de scope retornam 400/404; conteúdo inválido/ausente retorna 422. A raiz autorizada e seus ancestrais também não podem ser symlinks. Um manifesto inválido interrompe o catálogo com diagnóstico explícito, em vez de esconder um curso quebrado.

Arquivos são lidos sob demanda, com Cache-Control: no-store. Salvar e recarregar basta; não há watcher, cache editorial, fila ou sincronização. Limites iniciais: 64 KiB por manifesto e 256 KiB por Markdown. O conteúdo completo não cabe nos resultados de execução nem no SQLite.

O frontend usa react-markdown, ignora HTML bruto, sanitiza a árvore e aplica highlighting somente à linguagem declarada no fence. Blocos são texto: nunca passam pelo executor. Links inseguros são removidos. O highlighter é um plugin confiável aplicado após a sanitização, conforme sua documentação; não existe rehype-raw, MDX ou dangerouslySetInnerHTML. Referências podem abrir outra aba com noopener/noreferrer.

## Studio Fase 1: editar e salvar

A rota `/courses/:id/lessons/:slug/edit` usa um textarea e o renderer Markdown existente. Ela edita apenas o Markdown de uma lição existente; não altera curso/manifesto nem cria arquivos. O estado do editor contém rascunho, Markdown de base e versão de base. A prévia usa o rascunho, enquanto leitor/disco continuam com a última gravação confirmada. Durante o PUT, a edição fica bloqueada; erros/confirmação inválida não limpam o rascunho. Um journal em sessionStorage por aba permite retomar navegação/reload, com aviso de falha; não substitui backup e desaparece ao fechar a aba.

### Contrato e escrita

GET de lição preserva seus campos e acrescenta `version`: SHA-256 hexadecimal de 64 caracteres dos bytes UTF-8 do Markdown. PUT recebe somente `{ markdown: string, version: string }`, e responde 200 com `{ markdown, version }` após a gravação e cleanup confirmados. O novo hash corresponde ao texto enviado. Erros: 400 formato/IDs; 403 origem/comando; 404 curso/lição inexistente; 409 versão obsoleta ou lock; 413 Markdown maior que 256 KiB; 415 Content-Type; 422 manifesto/path/arquivo inválido; 500 falha de filesystem ou confirmação. O parser JSON editorial admite até 1600 KiB para comportar escapes JSON de um Markdown válido; os limites dos exercícios ficam intactos.

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

Nenhuma dependência, módulo editorial genérico, banco, watcher ou integração Git foi adicionada. Controller existente delega à função específica de escrita; o LearningModule e executor permanecem intactos. Testes usam cópias de conteúdo/dados e um índice Git descartável; não fazem commit nem editam conteúdo autoral canônico.

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

Usar o Studio para escrever e revisar uma lição real de TypeScript; conferir o arquivo no VS Code e o diff antes do commit manual. Registrar dificuldades antes de ampliar autoria para criação de cursos/lições pela interface. Editor inteligente, analyzer, progresso sofisticado, CMS, auth e execução remota permanecem fora desta rodada.
