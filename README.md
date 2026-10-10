# BunkerCode

Plataforma pessoal e aberta para estudar programação, praticar e transformar entendimento em conteúdo autoral. O autor é o primeiro usuário: estuda em outra fonte, escreve uma lição Markdown, revisa no site e faz commit.

Stack da plataforma: React/Vite, Tailwind CSS v4, CodeMirror 6, NestJS, Node.js e PNPM. TypeScript, Node.js, NestJS e PostgreSQL são a trilha de estudo; PostgreSQL ainda não é necessário para iniciar o MVP.

## Iniciar

Requisitos: Node.js 24+ e pnpm 11.

    pnpm install
    pnpm dev

Abra [BunkerCode](http://127.0.0.1:5173). Um único comando inicia frontend e backend; API local em 127.0.0.1:3001.

## Escrever uma lição

    pnpm lesson:new --course typescript --slug narrowing --title "Narrowing"

Abra a lição no site e clique em **Editar lição** para escrever no Studio visual com Tiptap, inserir código, notas e quizzes e salvar no próprio lesson.md. A fonte Markdown permanece acessível como opção avançada. Você também pode editar o arquivo no VS Code. Confira git diff e faça seu commit manualmente; não há rebuild nem commit automático. Também é possível criar o Markdown e inserir a entrada no course.json manualmente. A ordem do manifesto define a navegação. No Leitor, **Lições** e anterior/próxima ficam juntos acima do workspace; em lições sem prática aparecem no topo da leitura. O leitor organiza artigo, sumário e prática conforme o conteúdo, com preferências de leitura e divisores acessíveis. Veja [autoria visual e avaliação](docs/visual-authoring.md).

Para outro curso, crie content/courses/<id>/course.json com id, title, description e lessons. O catálogo descobre a pasta automaticamente. Veja o [guia de autoria](docs/authoring.md) para formato, exemplos e limites.

A descoberta inicial mostra JavaScript Essencial, TypeScript, Node.js e NestJS, nesta ordem. PostgreSQL, Git, Linux e Docker permanecem no conteúdo/API e nas rotas diretas, temporariamente ocultos da Home e do catálogo. Os sete cursos introdutórios têm duas lições demonstrativas fundamentadas em documentação. Amplie com suas palavras; referências ficam nas lições. [Política de visibilidade](docs/product/course-visibility.md).

## Organização

- apps/frontend: Home, catálogo, leitor Markdown, editor de prática e Studio local.
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

Os testes do backend compilam e iniciam o servidor real sem herdar NODE_PATH, com conteúdo isolado. E2E requer Chromium instalado; cenários de Run também requerem o Docker e a imagem fixada abaixo. Para usar outro Chromium existente: BROWSER_PATH=/caminho/do/navegador pnpm test:browser. Os testes usam o build de produção com Vite preview, portas 3012/5184 e cópias descartáveis de conteúdo. Cada rodada de navegador grava capturas em um novo diretório .bunkercode/browser-results-*, preservando as anteriores.

O MVP 03 oferece Home, Cursos, percurso de lições, Leitor, prática de escrita com CodeMirror e Studio. A Home começa com um calendário verde compacto e o total real de atividades dos últimos 365 dias, seguido dos quatro cursos da seleção editorial e uma ação discreta para o último acesso válido; visitas não representam conclusão. Exercícios explícitos preservam rascunhos no IndexedDB deste navegador, separados do Markdown editorial. O editor oferece autocomplete local, Prettier sob demanda, compilação TypeScript/JavaScript com análise sintática e semântica ES2022, Run isolado quando Docker estiver disponível e Submit com avaliação local quando há teste público definido. Blocos Markdown continuam inertes. Não há banco editorial.

Dados anteriores em .bunkercode/, .bunkerlab/ e .backendlab/, incluindo SQLite e capturas, permanecem no disco e ignorados pelo Git. O produto não abre nem migra os bancos dos exercícios aposentados; o código anterior pode ser recuperado pelo histórico Git.

## Run local

Run requer Docker Linux acessível ao processo do backend, cgroup v2 e seccomp. Instale previamente a imagem oficial fixada (o backend não baixa imagens):

    docker pull node@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1

Reinicie/abra a prática com Docker ativo. `BUNKERCODE_RUNNER_ENABLED=0` desativa Run. Sem os requisitos, Run e Submit compilam e explicam a indisponibilidade, sem afirmar avaliação completa. Não altere permissões do socket Docker apenas para contornar um erro.

Cada execução usa um container novo: sem rede, sem volumes do produto/socket Docker, filesystem da imagem somente de leitura, usuário 65534, capabilities removidas, no-new-privileges, 96 MiB de memória sem swap extra, 0,5 CPU, 32 processos, timeout de 5 s e saída até 32 KiB. `/tmp` é efêmero e limitado a 1 MiB. Run compila um arquivo ES2022 sem imports, DOM ou tipos Node; não é uma IDE de projeto. Submit preserva código/revisão/timestamp; com teste público recompila a fonte no backend, compara stdout ou chama a função com casos JSON e registra passed/failed. Sem critério ou execução completa, registra unassessed. [Contratos e limites](docs/architecture/overview.md#refinamento-01-atividade-editor-e-execução).
