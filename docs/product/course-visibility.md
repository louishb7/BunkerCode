# Visibilidade editorial dos cursos

Decisão temporária do Refinamento 02, em 2026-10-09. Home e catálogo apresentam somente:

1. JavaScript Essencial — preparação introdutória para TypeScript; não é uma formação completa de JavaScript.
2. TypeScript.
3. Node.js.
4. NestJS.

PostgreSQL, Git, Linux e Docker ficam ocultos da descoberta inicial, porque a prioridade editorial é uma sequência backend curta e publicar lições gradualmente conforme os estudos do autor. Seus manifestos, lições, figuras e testes permanecem; backend e rotas diretas continuam disponíveis. Ocultar não remove conteúdo nem controla acesso ou segurança.

A lista ordenada `visibleCourseIds` em `apps/frontend/src/product/course-visibility.ts` é a única regra de descoberta. Home e catálogo usam `discoverableCourses` após validar a resposta da API. Um ID ausente na API é omitido; cursos novos não entram automaticamente nesta seleção. Identidade, título, descrição e lições continuam vindo dos manifestos. Nenhum estado draft/published, novo contrato de API ou CMS foi criado.

Para restaurar a visibilidade, inserir os IDs desejados na lista, na posição editorial escolhida, e atualizar os testes de descoberta. Isso requer rebuild do frontend; conteúdo e rotas não precisam ser recriados. Adicionar uma lição a um curso já visível continua exigindo somente Markdown e manifesto, sem alteração em React/Nest. A decisão pode ser revertida ou ampliada quando o conteúdo estiver pronto; não deve apagar registros de atividade, rascunhos ou submissões dos cursos ocultos. A visibilidade dos cards não filtra o heatmap: atividades de cursos ocultos continuam no total do período.
