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

O dialeto atual não inclui tabelas GFM nem IDs/âncoras automáticas de headings. Tabelas com pipes aparecem como texto e links para headings não têm destino gerado. O conteúdo atual usa os elementos suportados; eventual ampliação depende de uma necessidade editorial concreta.

Mantenha pequenos exemplos que expliquem a dúvida. Referências externas ajudam a retornar à fonte de estudo. Não copiar materiais completos de outras plataformas; registrar seu entendimento e atribuir a fonte.

Os dois exemplos iniciais do curso TypeScript estão identificados como demonstrativos. Não são relatos pessoais do autor. Substitua-os ou expanda-os conforme seu estudo.

## Visualizar

    pnpm dev

Abra http://127.0.0.1:5173, selecione TypeScript e a lição. A API fica em 127.0.0.1:3001.

Se você editou no VS Code, salve o Markdown e recarregue a página. O backend lê o arquivo sob demanda; não precisa reiniciar a API nem rebuild. Mudanças no manifesto aparecem após refresh. Cursos novos ficam disponíveis pela API e rota direta; a seleção da Home/catálogo segue a [política editorial de visibilidade](product/course-visibility.md). No Studio, a prévia usa o rascunho; somente o botão de salvamento escreve no disco.

Os testes/smokes usam BUNKERCODE_CONTENT_DIR para uma cópia descartável do diretório content, sem alterar o conteúdo canônico. Normalmente você não precisa configurar essa variável.

## Editar no Studio local

1. Inicie `pnpm dev` e abra a lição em `http://127.0.0.1:5173`.
2. Clique em **Editar lição**. O Studio mantém o curso/título e carrega o Markdown completo, inclusive o primeiro heading e os fences.
3. Escreva no **Editor visual**. Use a toolbar e o controle de inserção para código, notas e quizzes. **Editar fonte Markdown** é a opção avançada/fallback; **Prévia** é secundária. Consulte [Studio visual e blocos editoriais](visual-authoring.md).
4. Clique em **Salvar alterações**. Aguarde **Salvo no arquivo.**; a resposta confirma a gravação física. Durante a gravação o texto fica bloqueado para a confirmação corresponder exatamente ao que foi enviado.
5. Use **Voltar à lição**. A leitura atualizada não depende de rebuild. Abra `content/courses/<id>/lessons/<slug>/lesson.md` no VS Code e confira `git diff`/`git status` no checkout principal antes de fazer seu commit.

A opção de fonte Markdown usa quebra **visual** de linha (`wrap="soft"`), inclusive em código longo, mantendo fonte monoespaçada e indentação. Não insere quebras no Markdown por largura da tela. Na alternância entre Editar e Prévia, mantém seleção/caret e scroll interno do textarea e registra uma posição de página para cada vista. O foco permanece no botão acionado; Tab permite voltar ao campo. Essas posições duram enquanto a página de edição estiver montada; navegação/reload recupera o texto pelo rascunho, sem prometer restauração do caret.

Salvar, os controles de vista e o estado ficam juntos numa toolbar persistente durante a rolagem da página. Em viewports com altura de até 500 px, ela permanece no fluxo do documento para não ocupar a área curta de edição. O arquivo continua mudando somente por **Salvar alterações**, depois da confirmação física; não há autosave canônico.

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

## Escopo atual

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

O site não avalia sua redação nem certifica compreensão. Seu Git é o histórico autoral. Não existe progresso editorial automático.

## Exercício de prática opcional

Crie `content/courses/<curso>/lessons/<lição>/exercise.json` junto ao Markdown. Não é preciso alterar o manifesto nem React/Nest. O exemplo em Valores e tipos está explicitamente identificado como editorial demonstrativo. Ele pede nome, quantidade e disponibilidade de um produto, anotações/inferência e comentário sobre atribuição incompatível.

Campos obrigatórios; o campo opcional `tests` está documentado em [avaliação mínima](visual-authoring.md#avaliação-mínima-de-exercícios):

```json
{
  "id": "product-values",
  "title": "Descreva um produto com tipos",
  "objective": "Praticar anotações e inferência.",
  "instructions": "Escreva declarações de nome, quantidade e disponibilidade.",
  "language": "typescript",
  "starterCode": "const productName: string = \"\";\n",
  "expected": "Tipos coerentes. Compare os diagnósticos; envio não significa avaliação automática."
}
```

`id` segue as regras de slug e deve permanecer estável quando o texto mudar. Linguagem: `typescript` ou `javascript`. Título até 160 caracteres; objetivo até 2000 bytes, instruções até 12000, código inicial até 32768 e resultado esperado até 4000; arquivo completo até 64 KiB, UTF-8 e sem symlink. Código inicial pode ser vazio, os outros textos não. Enunciados são texto simples; não aceitam HTML executável, comandos ou paths. O hash dos bytes identifica a revisão, inclusive mudanças de formatação do JSON.

O aluno escreve em CodeMirror; o texto só é compilado ou executado após comando explícito, com Run condicionado ao isolamento Docker documentado. Fences Markdown continuam inertes. Tab indenta e Escape seguido de Tab sai do editor. Ctrl+Space sugere nomes locais e palavras-chave; **Formatar** usa Prettier sob demanda para organizar apresentação sem alterar a lógica. **Restaurar código inicial** substitui o rascunho pelo `starterCode` somente após confirmação. As duas ações ficam na barra inferior do CodeMirror, junto a Run e Submit, com ícones e tooltips distintos. Formatar aplica alterações pontuais na instância existente, mapeia a seleção e a posição de leitura, preserva foco e histórico de undo/redo e recusa um resultado se houve qualquer edição durante a operação. Não exige confirmação nem recarrega a página; um código já formatado não adiciona um passo vazio ao histórico. Submit revalida a versão e registra o resultado local. Sem teste configurado ou runner disponível, continua não avaliada. Copiar e Baixar código aparecem em falhas para recuperação. O rascunho é salvo no IndexedDB deste navegador, até 64 KiB de código, somente com confirmação de transação. Não grava `lesson.md` nem `exercise.json`. A troca entre arquivos de prática mantém o editor/undo; reload recupera texto, não promete recuperar seleção/undo.

Se o enunciado mudar, a solução anterior continua guardada e aparece para revisão. Restaurar código inicial exige confirmação, salva a nova versão pelo mesmo fluxo do rascunho e limpa a análise exibida da versão anterior; submissões e revisões editoriais armazenadas permanecem intactas. Duas abas são protegidas por revisão transacional: uma edição obsoleta abre comparação, sem sobrescrever silenciosamente. Em caso de erro, copie ou baixe antes de fechar/recarregar. Armazenamento local pode ser negado, atingir quota ou ser removido; não é backup. Não há sincronização nem entrega remota. A avaliação local opcional compara somente a saída configurada.

Os sete cursos novos são introdutórios demonstrativos, com duas lições por tecnologia e referências consultadas. Não exigem dependências de runtime da tecnologia para leitura. Compilação/Run só se aplicam a exercícios explícitos TypeScript/JavaScript; nenhum exercício foi adicionado automaticamente às novas lições.
