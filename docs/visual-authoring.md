# Studio visual e blocos editoriais

O Studio usa Tiptap 3 com a extensão oficial Markdown, carregados somente na rota de autoria. Os documentos continuam em `lesson.md`; abrir, selecionar texto ou mudar de vista não grava nem normaliza o arquivo. Apenas uma edição efetiva atualiza o rascunho, e somente **Salvar alterações** escreve no disco com a versão original.

## Escrever

Use a toolbar compacta para parágrafos/títulos, negrito, itálico, listas agrupadas, links, código inline e desfazer/refazer. Ícones têm labels e tooltips. O popover de link preserva a seleção, permite URL, confirmação, cancelamento e remoção; aceita http/https/mailto, paths locais e âncoras, recusando protocolos inseguros. Sem seleção, confirmar insere a URL como texto vinculado. Escape cancela e devolve o foco ao documento. Posicione o cursor no bloco anterior e acione **Inserir após o bloco selecionado**: parágrafo, código, nota, quiz ou enunciado do exercício. O + fica na margem esquerda do bloco atual, inclusive parágrafos vazios, acompanha a geometria/rolagem do ProseMirror e permanece fechado até clique explícito. Inserir, clicar fora, Escape ou mudar a seleção fecha o menu. Os blocos selecionados oferecem **Ações do bloco** para mover para cima/baixo, excluir e continuar abaixo. Continuar insere um parágrafo e define caret/foco numa transação síncrona. Desfazer/refazer integra as operações ao documento. Os exemplos de programação usam CodeMirror, separados dos rascunhos do estudante, sem executar código. Tab indenta; Escape seguido de Tab sai do código. O editor oferece sintaxe e autocomplete para JS/TS; outros fences mantêm linguagem e texto, com edição sem gramática específica. O cabeçalho do exemplo contém o seletor discreto de linguagem; o conteúdo fica contido, com scroll horizontal/vertical interno em blocos extensos. O NodeView declara contentDOM oculto para que o ProseMirror mantenha o texto sem criar uma segunda cópia visível fora da caixa. As mutações DOM do CodeMirror ficam isoladas. Trocar a linguagem reconfigura o CodeMirror sem remontagem e preserva texto, seleção e undo; a transação também preserva a NodeSelection do bloco. O leitor continua destacando as linguagens suportadas pelo Highlight.js.

Sem seleção, o quiz mostra pergunta e alternativas como parte do documento, sem campos administrativos ou UUID. Clique no quiz ou use **Editar quiz** para editar pergunta, alternativas e resposta correta. **Feedback e tentativas** expande as configurações secundárias; os identificadores permanecem estáveis internamente. **Testar como estudante** usa o mesmo componente do leitor. As respostas são formativas, em memória; não certificam aprendizagem e não concluem a lição. O leitor aceita vários quizzes intercalados com texto.

**Editar fonte Markdown** permanece disponível para ajustes avançados. A prévia é secundária. O protocolo de rascunho em sessionStorage, conflitos HTTP 409, revisão de arquivo, limite UTF-8 e escrita por temporário/rename permanece o mesmo descrito em [autoria](authoring.md).

## Formato versionável

Elementos especiais são fences JSON no nível principal do documento. O Studio produz o JSON; o autor não precisa digitá-lo. Texto de pergunta, alternativas, feedbacks e notas é texto simples, nunca HTML executável. Campos extras são recusados. Use identificadores únicos e estáveis; não altere o identificador apenas para revisar uma pergunta.

```bunker-quiz
{
  "id": "tipo-de-valor",
  "question": "Qual é o tipo de 42?",
  "options": [
    { "id": "number", "text": "number" },
    { "id": "string", "text": "string" }
  ],
  "correct": "number",
  "feedbackCorrect": "42 é um valor numérico.",
  "feedbackIncorrect": "Uma string precisaria estar entre aspas.",
  "retry": true
}
```

De 2 a 12 alternativas, uma correta, IDs de até 80 caracteres em minúsculas/números/hífens. Pergunta e cada feedback: até 4000 caracteres; alternativa: 2000. Nota: até 12000 caracteres. Cada bloco: até 32768 caracteres, dentro do limite global de 256 KiB do arquivo.

```bunker-note
{
  "kind": "tip",
  "text": "Compare o valor escrito com o tipo inferido."
}
```

Variantes: `info`, `tip`, `warning`.

```bunker-exercise
{
  "kind": "exercise"
}
```

Esse marcador posiciona o enunciado de `exercise.json`; não duplica nem edita sua definição. Só pode aparecer uma vez. Na ausência dele, o enunciado fica após o texto. O editor de prática permanece na coluna direita, ou abaixo da leitura em telas estreitas.

## Preservação e fallback

Antes de abrir visualmente, a conversão é comparada pela estrutura dos tokens Markdown: títulos, parágrafos, marcas, listas, links, quotes e código. HTML bruto, imagens, tabelas e construções sem equivalência comprovada permanecem na fonte com aviso. Nunca se elimina um elemento desconhecido para tornar a conversão possível. Sem edição, mantêm-se os bytes originais. Com edição visual, delimitadores e espaços editoriais podem ser normalizados, preservando a semântica suportada; CRLF uniforme é mantido. O histórico de undo é da sessão visual montada; mudar para a fonte ou recarregar recupera o texto, não o histórico de undo.

O pacote pequeno `@bunkercode/content` centraliza validação de quizzes, notas, marcadores e testes públicos no frontend/backend. Ele é compilado antes dos comandos raiz. Tiptap não é carregado na Home ou no leitor. Sanitização e Highlight.js continuam no leitor; CodeMirror usa o tema Darcula nos editores.

## Avaliação pública de exercícios

`exercise.json` mantém `tests` opcional. O formato legado `{"kind":"stdout","expected":"42\n"}` compara stdout exato, incluindo quebras de linha, após execução bem-sucedida. Use-o quando a saída for o objetivo. Para comportamento de uma função JS/TS, use a extensão versionada:

```json
"tests": {
  "kind": "function",
  "version": 1,
  "function": "isAvailable",
  "cases": [
    { "name": "Estoque positivo", "args": [3], "expected": true },
    { "name": "Estoque zero", "args": [0], "expected": false },
    { "name": "Estoque negativo", "args": [-2], "expected": false }
  ]
}
```

A função deve estar no escopo superior, como declaração ou variável, sem `export`/imports, e retornar um valor JSON síncrono. São admitidos 1–16 casos com nomes únicos de até 200 caracteres, até oito argumentos por caso, valores JSON finitos, até oito níveis de estruturas, 2.000 valores e 16.000 caracteres para a suíte. Campos extras e chaves de protótipo são recusados. A comparação é estrutural e exata; não há tolerância numérica implícita. `expected` editorial permanece orientação; apenas `tests` define aprovação. A aba real `testes.json` é somente leitura. Não há testes privados.

Run captura o código, compila e executa explicitamente. Submit repete tudo para o snapshot atual, mesmo sem Run anterior. Para exercícios avaliáveis, o backend recompila a fonte em worker e ignora o JavaScript do cliente. Esse worker só compila: não executa o programa. Compilação admite até 64 KiB, 15 segundos, dois workers e 128 MiB de heap por worker. A função e o harness público executam exclusivamente no Docker restrito, mantendo timeout/cancelamento/rede/recursos existentes. Dentro do container, `node:vm` separa o escopo da solução do controle dos casos; **Docker é a fronteira de segurança**, não o VM. Não há execução de fonte no NestJS nem no navegador.

O harness chama a função com argumentos e devolve valores reais/erros por protocolo identificado aleatoriamente. O backend valida o protocolo e compara os retornos aos critérios lidos do arquivo; imprimir a resposta esperada sem implementar a função falha. O resultado inclui UUID, hash SHA-256 da fonte, revisão do exercício, contagem e feedback por caso. O frontend verifica identidade/revisão e mostra esperado/recebido ou erro. Interrupção, erro ou protocolo incompleto nunca aprovam.

Os registros continuam `passed`, `failed` ou `unassessed`, no mesmo IndexedDB. Somente todos os critérios aprovados concluem localmente; código com falha de compilação ou runner indisponível é `unassessed`. Uma edição posterior marca o resultado como antigo, e Submit sempre revalida. Registros anteriores `unassessed` não são migrados nem reinterpretados. O histórico guarda fonte/revisão/timestamp, não duplica todo o relatório de execução.

Inventário deste refinamento: existia apenas `typescript/values-and-types/exercise.json`, sem critérios automatizados. Ele agora avalia `isAvailable`, preservando o ID `product-values`, com estoque positivo/zero/negativo/uma unidade. Foi acrescentado `javascript/functions/exercise.json`, ID `total-price`, com compras distintas, quantidade zero e preço decimal. Todos os exercícios ativos possuem quatro casos públicos. Não foram removidos cursos ou lições.

O modelo verifica comportamento público, não estilo, técnica específica ou compreensão. Os casos são visíveis e permitem uma função que codifique suas entradas; isso não é certificação nem prevenção de fraude. Funções assíncronas, módulos, dependências e dezenas de linguagens estão fora do escopo. O limite de 64 KiB do programa também inclui o harness; fontes próximas do limite podem ser recusadas com erro explícito.

### Workspace e histórico

O painel **Resultado — Aguardando execução** existe desde a abertura. Código, barra única e resultados compõem uma área estável. O divisor horizontal ajusta alturas medidas do container, reservando espaço às abas/barra; mantém pelo menos 140 px de código e 120 px de resultado na composição normal. ↑/↓ ajustam, Home/End levam aos limites, Enter ou duplo clique restauram 60%; a preferência é local. A largura artigo/workspace continua independente. O CodeMirror permanece montado durante o redimensionamento e a consulta do histórico.

**Histórico do código** alterna o painel inferior, com scroll interno, snapshots somente leitura e metadados. Não usa modal nem restaura automaticamente versões antigas. Restaurar o starter continua exigindo confirmação e preserva submissões. Recuperação de falhas/quota e conflitos continua contextual.

As tonalidades **Padrão BunkerCode**, **Azul profundo** e **Alto contraste** usam superfícies e foregrounds coerentes. Os antigos índices locais 0/1/2 passam às novas paletas sem perder tamanho do texto. O tema Darcula dos editores permanece independente.

### Composição do Studio

A barra compacta reúne voltar, slug da lição, estado, Mais opções e Salvar. O documento possui seu título editorial uma vez. A sidebar contém inserção, formatação acessível por teclado e estrutura real dos headings; a estrutura abre sob demanda e leva ao trecho escolhido. Seleção de texto mostra a toolbar, que também pode permanecer aberta explicitamente. O + segue a geometria do bloco e nunca abre sozinho. Quizzes não selecionados mostram a apresentação do aluno; seus campos e configurações aparecem apenas ao selecionar/editar. Em mobile, as ferramentas formam uma faixa curta, sem três colunas permanentes. Em janela de até 500 px de altura os controles deixam de ser sticky. Fonte, prévia, journal, CRLF, undo e protocolo de salvamento físico/conflito continuam preservados.
