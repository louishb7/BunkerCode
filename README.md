# BunkerCode

Plataforma pessoal e aberta para estudar programação, praticar e transformar entendimento em conteúdo autoral. O autor é o primeiro usuário: estuda em outra fonte, escreve uma lição Markdown, revisa no site e faz commit.

Stack da plataforma: React/Vite, NestJS, Node.js e PNPM. TypeScript, Node.js, NestJS e PostgreSQL são a trilha de estudo; PostgreSQL ainda não é necessário para iniciar o MVP.

## Iniciar

Requisitos: Node.js 24+ e pnpm 11.

    pnpm install
    pnpm dev

Abra [BunkerCode](http://127.0.0.1:5173). Um único comando inicia frontend e backend; API local em 127.0.0.1:3001.

## Escrever uma lição

    pnpm lesson:new --course typescript --slug narrowing --title "Narrowing"

Abra a lição no site e clique em **Editar lição** para escrever no Studio, conferir a prévia e salvar no próprio lesson.md. Você também pode editar o arquivo no VS Code. Confira git diff e faça seu commit manualmente; não há rebuild nem commit automático. Também é possível criar o Markdown e inserir a entrada no course.json manualmente. A ordem do manifesto define a navegação. No Leitor, **Lições** abre o índice recolhível; anterior/próxima continuam no final da aula. A prévia do Studio usa a mesma largura de leitura. A quebra visual do editor preserva as quebras do arquivo; alternar Editar/Prévia mantém seleção e posição durante a edição.

Para outro curso, crie content/courses/<id>/course.json com id, title, description e lessons. O catálogo descobre a pasta automaticamente. Veja o [guia de autoria](docs/authoring.md) para formato, exemplos e limites.

O curso TypeScript começa com duas lições **demonstrativas**, prontas para serem substituídas ou ampliadas com suas palavras.

## Organização

- apps/frontend: catálogo de cursos, leitor Markdown e Studio local.
- apps/backend: um monólito NestJS para leitura de cursos e escrita editorial segura.
- content/courses: manifestos ordenados e lições Markdown.
- scripts: ferramentas de autoria; docs: arquitetura atual e histórico.

[Arquitetura atual](docs/architecture/overview.md) · [Histórico da consolidação](docs/implementation/consolidation-mvp.md)

## Validar

    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm build
    pnpm test:browser

Os testes do backend compilam e iniciam o servidor real sem herdar NODE_PATH, com conteúdo isolado. E2E requer Chromium instalado. Para usar outro Chromium existente: BROWSER_PATH=/caminho/do/navegador pnpm test:browser. Os testes usam o build de produção com Vite preview, portas 3012/5184 e cópias descartáveis de conteúdo. Cada rodada de navegador grava capturas em um novo diretório .bunkercode/browser-results-*, preservando as anteriores.

O MVP 02 contém Cursos, Leitor e Studio. Exemplos de código são texto com syntax highlighting; o site não executa código nem registra tentativas. Não há banco editorial.

Dados anteriores em .bunkercode/, .bunkerlab/ e .backendlab/, incluindo SQLite e capturas, permanecem no disco e ignorados pelo Git. O produto não abre nem migra os bancos dos exercícios aposentados; o código anterior pode ser recuperado pelo histórico Git.
