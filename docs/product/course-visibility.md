# Catálogo editorial ativo

A Integração Editorial 01 substitui a decisão visual anterior. No perfil privado, Home e catálogo apresentam, nesta ordem:

1. Fundamentos de Programação com JavaScript — identidade nova `fundamentos-programacao-javascript`, com a Lição 01 autoral integrada no Módulo 00.
2. TypeScript — em preparação.
3. Node.js — em preparação.
4. NestJS — em preparação.

A API normal contém esses quatro cursos. JavaScript Essencial, PostgreSQL, Git, Linux e Docker foram removidos do diretório editorial ativo após inventário de seus arquivos demonstrativos versionados. A recuperação editorial desses arquivos é possível pelo histórico Git. Dados locais, rascunhos, atividade e submissões não foram apagados.

Cópias dos cinco cursos em `apps/frontend/e2e/fixtures/legacy-courses/` atendem somente testes legítimos existentes. Apenas o supervisor as acrescenta à cópia temporária própria do navegador, sem sobrescrever cursos canônicos ou modificar diretórios externos. Essas fixtures não entram no backend habitual nem na preparação de snapshots reais.

A lista ordenada `visibleCourseIds` em `apps/frontend/src/product/course-visibility.ts` controla a descoberta privada; metadados vêm dos manifestos. O identificador autoral reutiliza o SVG JavaScript existente. Adicionar lições a um curso já visível continua exigindo apenas Markdown e manifesto.

No perfil público, API e catálogo seguem exclusivamente a seleção congelada no snapshot. A seleção canônica autoriza explicitamente somente `fundamentos-programacao-javascript/o-que-significa-programar`, no Módulo 00. Trata-se de uma candidata local; não há deploy. Cursos omitidos retornam 404 também por URL direta. [Publicação](../publication.md) e [planejamento editorial](../editorial/fundamentos-programacao-javascript.md).
