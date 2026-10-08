# BunkerCode

Plataforma pessoal e aberta para aprender backend, praticar e transformar entendimento em conteúdo autoral. O autor é o primeiro usuário: estuda em outra fonte, escreve uma lição Markdown, revisa no site e faz commit.

Stack da plataforma: React/Vite, NestJS, Node.js e PNPM. TypeScript, Node.js, NestJS e PostgreSQL são a trilha de estudo; PostgreSQL ainda não é necessário para iniciar o MVP.

## Iniciar

Requisitos: Node.js 24+ e pnpm 11.

    pnpm install
    pnpm dev

Abra [BunkerCode](http://127.0.0.1:5173). Um único comando inicia frontend e backend; API local em 127.0.0.1:3001.

## Escrever uma lição

    pnpm lesson:new --course typescript --slug narrowing --title "Narrowing"

Abra a lição no site e clique em **Editar lição** para escrever no Studio, conferir a prévia e salvar no próprio lesson.md. Você também pode editar o arquivo no VS Code. Confira git diff e faça seu commit manualmente; não há rebuild nem commit automático. Também é possível criar o Markdown e inserir a entrada no course.json manualmente. A ordem do manifesto define a navegação.

Para outro curso, crie content/courses/<id>/course.json com id, title, description e lessons. O catálogo descobre a pasta automaticamente. Veja o [guia de autoria](docs/authoring.md) para formato, exemplos e limites.

O curso TypeScript começa com duas lições **demonstrativas**, prontas para serem substituídas ou ampliadas com suas palavras. Os exercícios anteriores continuam opcionais em /learn.

## Organização

- apps/frontend: navegação, leitor Markdown, Studio local e interface dos exercícios.
- apps/backend: um monólito modular Nest para conteúdo, tentativas e instrumentos.
- content/courses: cursos e lições; content/activities: exercícios executáveis.
- scripts: ferramentas de autoria; docs: arquitetura atual e histórico.

[Arquitetura atual](docs/architecture/overview.md) · [Relatório de consolidação](docs/implementation/consolidation-mvp.md)

## Validar

    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm build
    pnpm test:browser

E2E requer Chromium instalado. Para usar outro Chromium existente: BROWSER_PATH=/caminho/do/navegador pnpm test:browser. Os testes usam portas 3012/5184 e cópias descartáveis de conteúdo/dados. Capturas desta rodada: .bunkercode/studio-browser-results. As capturas anteriores foram preservadas.

Tentativas continuam em .bunkercode/learning.sqlite; BUNKERCODE_DATA_DIR escolhe outro diretório. Dados históricos ignorados do laboratório permanecem no disco sem consumidor; não foram migrados ou apagados.

Execução de exercícios é local e para código confiável. Ler Markdown não inicia processos, cria tentativas nem executa seus blocos de código.
