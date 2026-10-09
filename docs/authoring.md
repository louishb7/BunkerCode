# Escrever e revisar conteúdo

## Criar uma lição

Com Node 24+ e dependências instaladas:

    pnpm lesson:new --course typescript --slug narrowing --title "Narrowing"

O comando cria content/courses/typescript/lessons/narrowing/lesson.md e acrescenta a entrada ao final de course.json. São dois arquivos de conteúdo. Não modifica React/Nest e não faz commit.

Edite o Markdown com suas palavras. O template contém sugestões, não requisitos. Uma lição pode ter apenas explicação e exemplo; nenhuma seção é obrigatória. O título do manifesto é usado na navegação. Um primeiro heading Markdown idêntico ao título é omitido apenas na apresentação para não repetir o cabeçalho; o arquivo continua independente.

Você pode criar os mesmos dois arquivos manualmente. Exemplo de entrada na lista lessons:

    { "slug": "narrowing", "title": "Narrowing" }

A ordem da lista é a ordem do curso. Não depende de nome de arquivo, timestamp, contador ou componente. Mova uma entrada no manifesto para reordenar.

## Escrever Markdown

Use títulos, parágrafos, listas, links e fences com a linguagem (typescript, javascript, sql etc.). Observações e dicas podem ser blockquotes. HTML bruto é ignorado; MDX, scripts e componentes React não são conteúdo suportado.

Mantenha pequenos exemplos que expliquem a dúvida. Referências externas ajudam a retornar à fonte de estudo. Não copiar materiais completos de outras plataformas; registrar seu entendimento e atribuir a fonte.

Os dois exemplos iniciais do curso TypeScript estão identificados como demonstrativos. Não são relatos pessoais do autor. Substitua-os ou expanda-os conforme seu estudo.

## Visualizar

    pnpm dev

Abra http://127.0.0.1:5173, selecione TypeScript e a lição. A API fica em 127.0.0.1:3001.

Se você editou no VS Code, salve o Markdown e recarregue a página. O backend lê o arquivo sob demanda; não precisa reiniciar a API nem rebuild. Mudanças no manifesto e novos cursos também aparecem após refresh. No Studio, a prévia usa o rascunho; somente o botão de salvamento escreve no disco.

Os testes/smokes usam BUNKERCODE_CONTENT_DIR para uma cópia descartável do diretório content, sem alterar o conteúdo canônico. Normalmente você não precisa configurar essa variável.

## Editar no Studio local

1. Inicie `pnpm dev` e abra a lição em `http://127.0.0.1:5173`.
2. Clique em **Editar lição**. O Studio mantém o curso/título e carrega o Markdown completo, inclusive o primeiro heading e os fences.
3. Edite na área **Markdown completo** e alterne para **Prévia**. O renderer é o mesmo do leitor; HTML bruto e links inseguros continuam filtrados. Blocos de código não são executados.
4. Clique em **Salvar alterações**. Aguarde **Salvo no arquivo.**; a resposta confirma a gravação física. Durante a gravação o texto fica bloqueado para a confirmação corresponder exatamente ao que foi enviado.
5. Use **Voltar à lição**. A leitura atualizada não depende de rebuild. Abra `content/courses/<id>/lessons/<slug>/lesson.md` no VS Code e confira `git diff`/`git status` no checkout principal antes de fazer seu commit.

O Studio edita apenas lições existentes e listadas no manifesto. Criação continua pelo CLI ou por arquivos; não há criação de cursos, alteração de manifesto nem operação Git na interface. A edição não usa SQLite.

### Rascunho e erros

**Alterações não salvas.** significa que o texto do editor difere da versão usada como base. O rascunho é guardado em `sessionStorage`, apenas nesta aba, para retomada depois de navegação ou reload. Isso não é gravação no arquivo nem backup durável: fechar a aba, limpar o armazenamento ou seu navegador impedir a gravação pode perder o rascunho. Falhas no armazenamento da aba têm aviso explícito; copie seu texto antes de sair nesse caso. Recarregar/sair com edição pendente também aciona o aviso padrão do navegador quando suportado.

Uma falha de rede/disco mantém o texto, sem apresentar sucesso. Se a conexão cair depois de o servidor gravar, o resultado pode ser incerto: use **Revisar arquivo atual** antes de tentar novamente. A versão do rascunho é preservada; retornar ao editor detecta se o arquivo mudou.

O texto completo é preservado pelo backend em UTF-8, até **256 KiB em bytes**. Arquivos inválidos são recusados; o texto nunca é truncado. O editor preserva LF e arquivos uniformes em CRLF; um arquivo com estilos de quebra misturados será normalizado pelo textarea para LF ao editar. Conteúdo vazio é permitido.

### Conflitos

Cada leitura inclui uma versão baseada em hash do conteúdo. O salvamento envia a versão carregada. Uma mudança no VS Code ou em outra aba provoca **409 / Conflito de edição**, mantém os dois textos e bloqueia a nova gravação até revisão.

Clique em **Revisar arquivo atual** para ler o Markdown físico numa área separada. Você pode comparar/copiar trechos para seu texto e escolher:

- **Manter meu texto e usar esta versão como base**: preserva seu rascunho. O próximo **Salvar alterações** substituirá a versão que você acabou de revisar; outra mudança ainda será verificada.
- **Carregar arquivo no editor**: pede confirmação antes de descartar o rascunho. Apenas carrega o arquivo; não grava nada.

A combinação não é automática. Um lock também pode gerar 409 quando outra instância está salvando ou quando um processo foi interrompido. Nesse caso, reler não libera o lock; confira se há processo ativo antes de resolver o arquivo `.studio-save.lock` manualmente. Nunca apague sua lição para recuperar um lock.

### Limites locais

Frontend e API permanecem em loopback. Use a URL exata `http://127.0.0.1:5173`; `localhost` é uma origem diferente. Para mudar a origem/porta da interface, configure `BUNKERCODE_STUDIO_ORIGIN` no backend com a origem HTTP loopback exata e a mesma URL no navegador. Não exponha o Studio com `--host 0.0.0.0`, proxy público ou túnel; esta fase não oferece autenticação/publicação remota.

A escrita exige Host loopback, Origin correspondente, JSON, o cabeçalho de comando local e `Sec-Fetch-Site: same-origin` quando presente. Não há CORS aberto. Essas verificações reduzem CSRF no navegador; **o cabeçalho estático não é autenticação** e um programa local pode forjar os cabeçalhos. O usuário, filesystem e processos locais são considerados confiáveis.

O lock serializa instâncias do Studio, mas o VS Code não participa dele. Uma mudança externa é verificada novamente imediatamente antes do rename; ainda existe uma pequena corrida entre essa leitura e a substituição. Escrita por temporário e rename evita arquivo parcialmente escrito, sem oferecer transação durável contra queda de energia. Crash pode deixar lock/temporário no diretório da lição; eles são ignorados pelo Git, sem expiração/remoção automática. Raiz de conteúdo e seus ancestrais não podem ser symlinks. Linux é a plataforma validada.

## Criar outro curso

Crie content/courses/software-architecture/course.json:

    {
      "id": "software-architecture",
      "title": "Arquitetura de software",
      "description": "Minhas revisões e exemplos de organização de sistemas.",
      "lessons": []
    }

Use o comando de autoria com --course software-architecture ou crie Markdown e entrada manualmente. Nenhuma mudança de controller, rota ou componente é necessária.

IDs/slugs: letras minúsculas, números e hífens, até 80 caracteres. O id precisa coincidir com a pasta. Títulos: até 160 caracteres; descrição do curso: até 800. Slugs duplicados, campos desconhecidos, JSON malformado, arquivos ausentes e symlinks geram erro explícito. Não use paths relativos no manifesto. Manifesto até 64 KiB, Markdown até 256 KiB.

## Escopo do MVP 02

Cursos, Leitor e Studio organizam, apresentam e salvam conteúdo autoral. A entrada de uma lição possui apenas slug e title; activityId foi removido e é recusado pelo validador. Exemplos de código continuam em fences Markdown, com o mesmo tema Darcula no leitor e na prévia, sem execução no site.

Dados locais anteriores, incluindo bancos e capturas em .bunkercode, .bunkerlab e .backendlab, permanecem preservados e não são usados para editar lições. Não é necessário migrar ou apagar nenhum banco para iniciar a plataforma. Testes de navegador escrevem em cópias descartáveis e geram um diretório novo de capturas por execução.

## Proteções do comando

lesson:new recusa slug duplicado e pasta existente, mesmo que ela ainda não esteja no manifesto. Não sobrescreve notas. Um lock por curso impede dois comandos de autoria de gravarem simultaneamente; o manifesto é substituído por rename de um arquivo temporário no mesmo diretório.

Se a atualização do manifesto falhar, o comando tenta remover somente a lição recém-criada e liberar lock/temporário, mantendo o erro original e relatando falha de cleanup. Isso não é uma transação durável contra queda de energia. Uma interrupção abrupta pode deixar .lesson-new.lock ou um rascunho ainda não listado; inspecione o curso e confirme que nenhum comando está ativo antes de resolver manualmente. Não apague texto próprio para recuperar o gerador.

## Revisar e versionar

1. Confira conteúdo, código e referências no site.
2. Teste anterior/próxima e a ordem desejada.
3. Confira git diff e git status; dados .bunkercode não devem entrar no commit.
4. Faça seu commit normalmente.

Sugestão para uma lição: docs: add TypeScript narrowing notes.

O site não avalia sua redação nem certifica compreensão. Seu Git é o histórico autoral. Não existe progresso editorial automático nesta rodada.
