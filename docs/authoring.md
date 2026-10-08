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

Salve o Markdown e recarregue a página. O backend lê o arquivo sob demanda; não precisa reiniciar a API nem rebuild. Mudanças no manifesto e novos cursos também aparecem após refresh. Preview automático ao salvar fica para uma necessidade posterior.

Os testes/smokes usam BUNKERCODE_CONTENT_DIR para uma cópia descartável do diretório content, sem alterar o conteúdo canônico. Normalmente você não precisa configurar essa variável.

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

## Exercício opcional

Uma entrada pode conter:

    { "slug": "conditions", "title": "Condições", "activityId": "reserve-stock" }

O leitor mostra um link para a atividade; abrir a lição não executa nada. IDs disponíveis nesta rodada: order-acceptance e reserve-stock. Um ID desconhecido apresenta o estado de atividade inexistente. Não se cria uma atividade executável apenas para publicar texto.

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
