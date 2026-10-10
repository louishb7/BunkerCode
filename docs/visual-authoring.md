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

## Avaliação mínima de exercícios

`exercise.json` pode acrescentar um campo opcional:

```json
"tests": { "kind": "stdout", "expected": "42\n" }
```

O teste compara exatamente stdout UTF-8, incluindo quebras de linha, após um processo encerrado com sucesso. A aba `testes.json` mostra essa definição real, somente leitura. Não há testes privados neste recorte. `expected` continua sendo orientação editorial; somente `tests` define avaliação automatizada.

Run compila o snapshot e, se disponível, executa no Docker restrito. Submit repete a verificação da solução atual antes de registrar o resultado. Para exercícios com teste, o backend recompila a fonte em um worker de compilação, ignora o JavaScript fornecido pelo navegador e compara a saída no servidor. O worker só analisa TypeScript/JavaScript: não executa o programa. Compilação tem limite de 64 KiB, 15 segundos, dois workers simultâneos e 128 MiB de heap por worker. O Docker mantém seus próprios limites de execução.

Os novos registros locais podem ser `passed`, `failed` ou `unassessed`. Envios antigos `unassessed` não são migrados nem reinterpretados. Compilação sem erro e exit code zero, isoladamente, não aprovam. Runner indisponível ou exercício sem testes suficientes não concluem a atividade. Editar torna o resultado anterior obsoleto; o histórico continua associado à fonte exata enviada.

Esse modelo verifica apenas a saída definida. Não avalia estilo, processo de raciocínio ou uso de uma técnica específica e pode ser satisfeito por saída fixa. Não é avaliação certificadora nem prevenção de fraude. Conclusão é progresso local, com dados locais modificáveis pelo dono do navegador; não há certificado nem autoridade remota de progresso. Atividades de leitura e quizzes não ganham conclusão automática.


### Revisões da prática

**Revisões salvas** abre sob demanda as submissões e a solução de uma revisão editorial anterior. Ao fechar ou pressionar Escape, o foco volta ao controle. A contagem de envios e os avisos editoriais antigos não ocupam a interface principal; os dados permanecem no mesmo IndexedDB. Compilação, execução e avaliação aparecem somente após uma ação, com detalhes expansíveis; falhas de gravação/conflitos mantêm recuperação contextual.
