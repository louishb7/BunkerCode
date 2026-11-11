# BunkerCode

BunkerCode é uma plataforma educacional independente para aprender programação com explicações, exemplos e prática. É construída por um desenvolvedor que também está aprendendo: estudar, organizar o próprio raciocínio e transformar esse entendimento em lições faz parte do projeto.

A proposta é ajudar adultos iniciantes a entender o que um programa faz e por que ele funciona. O conteúdo nasce dos estudos e das decisões pedagógicas do criador. Ferramentas de IA auxiliam implementação, análise, testes e revisão técnica; a responsabilidade pela autoria educacional permanece com ele.

## Como se aprende aqui

As lições combinam texto, exemplos de código, perguntas com feedback e, quando previsto, um editor para experimentar. Otto, o robô que aparece em algumas notas, participa dos exemplos para chamar atenção ao que uma instrução realmente diz. Não é um assistente de conversa.

O leitor pode ajustar a aparência da lição e o tamanho do texto. Nos exercícios, o rascunho fica neste navegador. A leitura publicada é aberta; uma conta permite guardar progresso, retomar estudos e sincronizar preferências. A conclusão de uma lição com exercício depende de uma solução aprovada pelos testes configurados, não apenas de abrir a página ou responder um quiz.

O ambiente local de autoria também oferece compilação, execução isolada quando disponível e avaliação dos exercícios configurados. No perfil público, a prática JavaScript permite escrever e formatar, sem execução remota. SQL oferece experimentação local sem conta e, quando o runner isolado está configurado, verificação e Submit autenticados. Essas diferenças e os limites da recuperação de soluções estão no [guia da jornada de aprendizagem](docs/learning-state.md).

## Estado e direção

O projeto está em desenvolvimento. O curso autoral de Fundamentos de Programação com JavaScript está em produção editorial. SQL na Prática tem duas lições iniciais com dados fictícios e desafios; outros cursos permanecem em preparação ou com exemplos demonstrativos identificados. A seleção pública versionada inclui a primeira lição JavaScript e essas duas lições SQL. Não há deploy público confirmado neste repositório.

Já existem catálogo, leitura, prática, Studio de autoria, identidade e progresso por conta. A área experimental **Táticas** trabalha raciocínio sobre programas pequenos com atividades estruturadas. A direção é consolidar a experiência e produzir conteúdo progressivamente, apoiados por um backend seguro e compreensível. Isso não representa um catálogo de cursos completo nem uma promessa de calendário.

## Desenvolver e escrever

O frontend usa React/Vite e CodeMirror; o backend é um monólito NestJS com PostgreSQL/Prisma. Lições e ordem dos cursos ficam em Markdown/JSON versionados. Contas e progresso ficam no banco; rascunhos locais não são substituídos por essa persistência.

Para iniciar, siga [instalação e configuração local](docs/authentication.md). São necessários Node.js 24.11+ na linha 24 ou 26+, PNPM 11 e PostgreSQL. Depois de configurar o ambiente, `pnpm dev` inicia o site em `http://127.0.0.1:5173` e a API em `127.0.0.1:3001`. O perfil de autoria é local e não deve ser exposto à internet.

O conteúdo pode ser escrito no editor de sua preferência ou no Studio com uma conta ADMIN. Salvar no Studio altera o arquivo; o commit continua manual. Comece pelo [guia de autoria](docs/authoring.md) e pelos [blocos editoriais](docs/visual-authoring.md).

## Guias do projeto

- [Arquitetura atual](docs/architecture/overview.md): responsabilidades e decisões técnicas.
- [Publicação](docs/publication.md): seleção de conteúdo e separação dos perfis.
- [Deploy e recuperação](docs/deployment.md): migrations, configuração e o que precisa de backup além do Git.
- [SQL](docs/sql-practice.md): definições versionadas, autoria no Studio e avaliação isolada.
- [Táticas](docs/tactics-core.md): mecânicas, avaliação e limites do experimento.
- [História selecionada](docs/history/README.md): decisões anteriores, sem valor de backlog ou arquitetura vigente.

Para validar alterações: `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build`. Os testes de backend e navegador exigem PostgreSQL exclusivo de testes e configuração explícita; nunca use o banco de desenvolvimento como fixture. E2E usa `pnpm test:browser` e `pnpm test:browser:public`; veja [requisitos e isolamento](docs/authentication.md#separação-de-desenvolvimento-testes-e-produção) e [validação dos perfis](docs/publication.md#validação).

Git preserva apenas o que foi versionado. Segredos, banco de dados e rascunhos no navegador exigem cuidados próprios de recuperação. Gratuidade inicial não define uma licença open source.
