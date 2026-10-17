# Escrever e revisar conteúdo

## Criar uma lição

Com Node 24+ e dependências instaladas:

    pnpm lesson:new --course typescript --slug narrowing --title "Narrowing"

O comando cria content/courses/typescript/lessons/narrowing/lesson.md vazio e acrescenta a entrada ao final de course.json. São dois arquivos de conteúdo. Não modifica React/Nest e não faz commit.

`pnpm lesson:new` compila previamente o pacote compartilhado de conteúdo. A invocação direta de `node scripts/new-lesson.mjs` exige que esse pacote já tenha sido compilado.

Edite o Markdown com suas palavras. Uma lição pode ter apenas explicação e exemplo; nenhuma seção é obrigatória. O título do manifesto é usado na navegação. Um primeiro heading Markdown idêntico ao título é omitido apenas na apresentação para não repetir o cabeçalho; o arquivo continua independente.

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

1. Inicie `pnpm dev` e abra a lição em `http://127.0.0.1:5173`. O Vite resolve apenas o entry point público `@bunkercode/content` para sua fonte TypeScript em ESM, no desenvolvimento e no build do frontend. Assim, mudanças e novos exports locais não ficam presos ao cache de pré-bundling; as outras dependências mantêm seu cache entre inicializações, sem `--force`. Backend e CLI continuam consumindo o pacote compilado em CommonJS, incluindo o subpath Node `authoring`. Antes, esse CommonJS local exigia reotimização após mudanças porque o cache do Vite considera lockfile/configuração, sem acompanhar seu código ([documentação do Vite 7](https://v7.vite.dev/guide/dep-pre-bundling#monorepos-and-linked-dependencies)).
2. Clique em **Editar lição**. O Studio identifica discretamente a lição e carrega o Markdown completo, inclusive o primeiro heading e os fences.
3. Escreva no **Editor visual**. Use a sidebar para inserir conteúdo, abrir a estrutura ou acessar formatação por teclado. Selecionar texto também mostra a formatação. O + acompanha o bloco selecionado e abre apenas por clique. **Visual**, **Prévia** e **Markdown** ficam diretamente na barra superior, com o modo ativo indicado. Consulte [Studio visual e blocos editoriais](visual-authoring.md).
4. Clique em **Salvar alterações**. Aguarde **Salvo no arquivo.**; a resposta confirma a gravação física. Durante a gravação o texto fica bloqueado para a confirmação corresponder exatamente ao que foi enviado.
5. Use **Voltar à lição**. A leitura atualizada não depende de rebuild. Abra `content/courses/<id>/lessons/<slug>/lesson.md` no VS Code e confira `git diff`/`git status` no checkout principal antes de fazer seu commit.

A opção de fonte Markdown usa quebra **visual** de linha (`wrap="soft"`), inclusive em código longo, mantendo fonte monoespaçada e indentação. Não insere quebras no Markdown por largura da tela. Na alternância entre Editar e Prévia, mantém seleção/caret e scroll interno do textarea e registra uma posição de página para cada vista. O foco permanece no botão acionado; Tab permite voltar ao campo. Essas posições duram enquanto a página de edição estiver montada; navegação/reload recupera o texto pelo rascunho, sem prometer restauração do caret.

Salvar, os controles de vista e o estado ficam juntos numa toolbar persistente durante a rolagem da página. Em viewports com altura de até 500 px, ela permanece no fluxo do documento para não ocupar a área curta de edição. O arquivo continua mudando somente por **Salvar alterações**, depois da confirmação física; não há autosave canônico.

O seletor **Lições do curso** navega na ordem do manifesto, identificando curso e lição. **Nova lição** pede título e sugere um slug editável; **Criar lição** acrescenta a entrada ao final do curso e abre o Markdown vazio. Cancelar não grava. Erros preservam os campos e a operação pendente bloqueia envios duplicados. CLI e interface usam a mesma operação de criação. Não há criação de cursos nem operação Git na interface. A edição não usa SQLite.

### Rascunho e erros

**Alterações não salvas.** significa que o editor difere da versão usada como base. Cada edição atualiza sincronicamente um buffer por curso/lição em memória e em `sessionStorage`, antes de qualquer desmontagem por navegação. Alternar vistas, acessar outra lição ou criar uma nova preserva o buffer anterior. O retorno informa **Rascunho recuperado**, sem alegar salvamento no arquivo. Se o armazenamento for negado, a memória ainda protege a navegação interna, com aviso que permanece ao retornar. Reload depende do `sessionStorage`; fechar a aba, limpar o armazenamento ou impedir sua gravação pode perder o rascunho. Não é backup durável. Copie seu texto antes de recarregar/fechar em caso de falha. O aviso padrão de saída também protege buffers pendentes já visitados nesta sessão, quando suportado pelo navegador.

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

## Proteções da criação pelo Studio e pelo comando

`lesson:new` e `POST /content/courses/:id/lessons` usam a operação Node de `@bunkercode/content/authoring`. A validação integral do manifesto é compartilhada com a leitura do backend. O POST recebe somente `{ "title": "Título", "slug": "slug" }`: retorna 201 com a lição, 400 para payload/identificadores inválidos, 404 para curso inexistente, 409 para duplicação/lock/conflito, 422 para estrutura editorial inválida e 500 para falha de persistência ou confirmação. As proteções HTTP locais são as mesmas do salvamento (403/415); GET e PUT mantêm seus contratos.

Um `.lesson-new.lock` exclusivo por curso coordena CLI e API. Seu JSON registra PID, início, slug, título e paths antes da primeira alteração editorial. A criação exclusiva recusa slugs duplicados e pastas já existentes, inclusive fora do manifesto, sem sobrescrita. Raiz e ancestrais, manifesto e diretórios internos recusam symlinks. O Markdown existe e recebe flush antes de publicar o manifesto por temporário, flush e rename. A versão original do manifesto é relida imediatamente antes da substituição para detectar alterações externas. Salvamentos de lições existentes usam seus locks próprios: não escrevem os mesmos arquivos da criação.

Isso **não é uma transação atômica entre arquivos**, nem garantia durável contra queda de energia. Editores externos não participam dos locks e ainda podem disputar a pequena janela entre a verificação final e o rename. Em falha tratada antes da publicação, a limpeza só remove arquivo/pasta da operação com identidade e bytes conferidos. Texto modificado externamente, arquivo substituído e arquivos adicionais são preservados. Falha de recuperação retém o journal e responde sem sucesso confirmado. Depois da publicação, falha de limpeza também pode gerar resposta incerta: confira o curso antes de repetir.

Uma interrupção abrupta pode deixar lock, temporário e pasta ainda não listada. Não há expiração nem remoção automática. Para recuperar: confirme que o PID/processo não está ativo; leia `.lesson-new.lock`; compare seus paths com `course.json` e `lesson.md`. Se a entrada já estiver publicada e o arquivo existir, preserve ambos. Se não estiver listada, revise o Markdown e incorpore a entrada manualmente ou preserve uma cópia antes de qualquer limpeza comprovadamente restrita à operação. Remova lock/temporário somente após essa inspeção. Nunca apague notas autorais nem substitua o manifesto inteiro para liberar um lock. Os testes simulam morte do processo antes e depois da publicação; conteúdo interrompido não é apagado automaticamente.

## Revisar e versionar

1. Confira conteúdo, código e referências no site.
2. Teste anterior/próxima e a ordem desejada.
3. Confira git diff e git status; dados .bunkercode não devem entrar no commit.
4. Faça seu commit normalmente.

Sugestão para uma lição: docs: add TypeScript narrowing notes.

O site não avalia sua redação nem certifica compreensão. Seu Git é o histórico autoral. Não existe progresso editorial automático.

## Exercício de prática opcional

Crie `content/courses/<curso>/lessons/<lição>/exercise.json` junto ao Markdown. Não é preciso alterar o manifesto nem React/Nest. O exemplo em Valores e tipos está explicitamente identificado como editorial demonstrativo. Ele pede nome, quantidade e disponibilidade de um produto, anotações/inferência e comentário sobre atribuição incompatível.

Campos obrigatórios; o campo opcional `tests` está documentado em [avaliação pública](visual-authoring.md#avaliação-pública-de-exercícios):

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

O aluno escreve em CodeMirror; o texto só é compilado ou executado após comando explícito, com Run condicionado ao isolamento Docker documentado. Fences Markdown continuam inertes. Tab indenta e Escape seguido de Tab sai do editor. Ctrl+Space sugere nomes locais e palavras-chave; **Formatar** usa Prettier sob demanda para organizar apresentação sem alterar a lógica. **Restaurar código inicial** substitui o rascunho pelo `starterCode` somente após confirmação. A barra única entre código e resultados mostra Run/Submit à esquerda e Formatar/Restaurar/Histórico como ícones à direita. O painel inferior existe antes da execução e alterna resultados e histórico sem modal; consultar uma versão anterior não substitui o código. No Leitor, header e footer permanecem visíveis, e lição, código e resultados têm rolagens independentes. A navegação de curso/lições fica no footer. Abaixo de 1000px, **Lição / Código** alterna os painéis sem substituir o editor ou o rascunho. Dois divisores independentes ajustam largura artigo/workspace e altura código/resultados, com teclado, cancelamento e preferência local. O divisor de altura fica entre os grupos da toolbar: ↑/↓ ajustam, Shift amplia o passo, Home/End alcançam os mínimos e Enter restaura a proporção. Formatar aplica alterações pontuais na instância existente, mapeia a seleção e a posição de leitura, preserva foco e histórico de undo/redo e recusa um resultado se houve qualquer edição durante a operação. Não exige confirmação nem recarrega a página; um código já formatado não adiciona um passo vazio ao histórico. Submit revalida a versão e registra o resultado local. Sem teste configurado ou runner disponível, continua não avaliada. Copiar e Baixar código aparecem em falhas para recuperação. O rascunho é salvo no IndexedDB deste navegador, até 64 KiB de código, somente com confirmação de transação. Não grava `lesson.md` nem `exercise.json`. A troca entre arquivos de prática mantém o editor/undo; reload recupera texto, não promete recuperar seleção/undo.

Se o enunciado mudar, a solução anterior continua guardada e pode ser consultada em **Histórico do código**, junto ao histórico de submissões, sem um banner permanente. Restaurar código inicial exige confirmação, salva a nova versão pelo mesmo fluxo do rascunho e limpa a análise exibida da versão anterior; submissões e revisões editoriais armazenadas permanecem intactas. Duas abas são protegidas por revisão transacional: uma edição obsoleta abre comparação, sem sobrescrever silenciosamente. Em caso de erro, copie ou baixe antes de fechar/recarregar. Armazenamento local pode ser negado, atingir quota ou ser removido; não é backup. Não há sincronização nem entrega remota. A avaliação local compara stdout ou retornos de função conforme os casos públicos configurados.

Os sete cursos novos são introdutórios demonstrativos, com duas lições por tecnologia e referências consultadas. Não exigem dependências de runtime da tecnologia para leitura. Compilação/Run só se aplicam a exercícios explícitos TypeScript/JavaScript; nenhum exercício foi adicionado automaticamente às novas lições.
