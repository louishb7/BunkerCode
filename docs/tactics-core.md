# Tactics Core

`@bunkercode/tactics-core` é uma biblioteca independente de funções determinísticas para gerar programas pequenos e derivar táticas. O Core 01 contém `comparison-boundaries`; o Core 02 acrescenta `assignment-sequence` e `conditional-branch`. Cada família possui gerador **versão 1**, com contrato próprio. A área `/tactics` (alias legado `/lab/tactics`) consome o pacote no frontend, sem endpoint, persistência ou integração com exercícios editoriais.

## Core 01: uso e API

```typescript
import {
  generateReference,
  transformProgram,
  getPublicTactic,
  evaluateAnswer,
  verifyTactic,
} from "@bunkercode/tactics-core";

const program = generateReference(4812, 1);
const tactic = transformProgram(program, "complete-operator");
const publicView = getPublicTactic(tactic);
const validation = verifyTactic(tactic); // { valid: true }
const evaluation = evaluateAnswer(tactic, ">=");
// { status: "valid", achieved: true, produced: [3, 5], expected: [3, 5] }
```

| Export                                          | Responsabilidade                                                                                                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generateReference(seed, generatorVersion = 1)` | Valida seed/versão e gera `ComparisonProgram`: identidade da família, trio, limite, operador, resultado e código de referência.                                        |
| `transformProgram(program, kind)`               | Confere o programa contra seed/versão e cria o modelo interno `Tactic`.                                                                                                |
| `getPublicTactic(tactic)`                       | Confere o modelo e retorna `PublicTactic`: identidade, código de apresentação, objetivo, operadores permitidos e resultado esperado.                                   |
| `evaluateAnswer(tactic, answer)`                | Retorna `Evaluation`, sem executar texto JavaScript.                                                                                                                   |
| `verifyTactic(tactic)`                          | Retorna `Validation`: `valid` e, se inválida, `reason`. Confere reprodução canônica, identidade, transformação, resposta única e alteração de comportamento no reparo. |
| `OPERATORS`, `GENERATOR_VERSION`                | Domínio ordenado `>`, `>=`, `<`, `<=`, `===`, `!==` e versão atual `1`.                                                                                                |

Tipos exportados: `Operator`, `TacticKind`, `TacticIdentity`, `ComparisonProgram`, `Tactic`, `PublicTactic`, `Evaluation` e `Validation`. Modelos e listas gerados são readonly e congelados; não existe estado compartilhado mutável. A API de geração/transformação/apresentação lança erros explícitos para entradas incompatíveis; verificação e avaliação retornam estados estruturados.

`Evaluation.status` distingue `valid` (operador reconhecido, com `achieved` verdadeiro ou falso), `invalid-answer` (sem resultado produzido, com esperado disponível) e `invalid-tactic` (sem resultados confiáveis, com motivo). Nenhum estado inválido aprova uma resposta. Strings não são aparadas ou convertidas: somente os seis tokens exatos são aceitos. Objetos públicos não substituem modelos internos na avaliação; a identidade pública permite reproduzi-los pela geração e transformação.

## Comparison-boundaries: contrato de reprodução da versão 1

Seed é um número inteiro entre **0 e 4294967295**, inclusive. Não há coerção de strings, truncamento de frações ou wrap de seeds fora do intervalo. `-0` é normalizado para `0`. Versões diferentes de `1` são recusadas. A identidade da rodada combina `family`, `generatorVersion`, `seed` e `kind`.

O PRNG é **Mulberry32**, implementado com estado explícito de entrada/saída em `src/random.ts`. A cada passo, soma-se `0x6d2b79f5` com wrap uint32; o mixer usa `Math.imul`, XOR e shifts de 15, 7 e 14 bits, retornando uma palavra uint32. O gerador usa seis palavras em ordem fixa:

1. `word % 21 - 10`: limite inteiro em `[-10, 10]`.
2. `1 + word % 5`: distância do valor abaixo do limite.
3. `1 + word % 5`: distância do valor acima do limite.
4. `word % 6`: índice no domínio ordenado de operadores.
5. `word % 3`: troca da posição 2 no Fisher–Yates.
6. `word % 2`: troca da posição 1 no Fisher–Yates.

Assim, os valores pertencem a `[-15, 15]`, são distintos e têm exatamente um representante abaixo, igual e acima do limite. `filter` mantém a ordem do trio. Os seis operadores selecionam seis subconjuntos distintos dessas categorias, garantindo exatamente uma resposta correta. O domínio é finito: seeds diferentes podem produzir programas iguais. O PRNG não é criptográfico e a redução por módulo tem um pequeno viés; não se promete amostragem perfeitamente uniforme.

`complete-operator` apresenta `___` no lugar do operador. `repair-operator` usa um passo separado do PRNG, inicializado com `(seed ^ 0xa5a5a5a5) >>> 0`, e escolhe `word % 5` dentre os operadores diferentes do original, preservando sua ordem. Pelas três categorias obrigatórias, qualquer alternativa produz outro resultado. A transformação não consome palavras da sequência do programa-base.

Alterar algoritmo, domínio, ordem de sorteios, operadores, shuffle ou transformação exige uma nova versão do gerador; não se deve reinterpretar silenciosamente identidades da versão 1. Fixtures do PRNG, programas e transformações fixam o comportamento atual. Não há armazenamento de versões antigas ou migração nesta entrega.

## Comparison-boundaries: limites e separação

O modelo interno contém o operador de referência; a representação pública contém somente identidade, código apresentado, objetivo, domínio e resultado esperado. Essa separação organiza responsabilidades e permite reprodução futura no backend. **Não é proteção contra inspeção**: com seed/versão e biblioteca no navegador, o usuário pode reconstruir o programa e sua resposta.

O avaliador filtra os números estruturados usando um switch dos operadores conhecidos. O texto JavaScript serve à apresentação; não é a fonte da verdade. A validação exige dados e texto coerentes com a geração canônica, recusando modelos alterados. Não se aceita código livre nem se usa `eval`, `Function`, VM, filesystem, DOM, IndexedDB, relógio, aleatoriedade global ou IA. O runtime não tem dependências externas. A validação pressupõe dados comuns; não constitui sandbox contra getters/Proxies hostis no mesmo processo.

Não há feedback pedagógico genérico, dificuldade adaptativa, histórico de aprendizagem, runner ou contratos aposentados. A compilação/execução da prática atual continua independente e não foi modificada. A família cobre apenas inteiros pequenos e comparação numérica; não avalia soluções arbitrárias nem equivalência geral de programas.

## Build e validação

```bash
pnpm --filter @bunkercode/tactics-core build
pnpm --filter @bunkercode/tactics-core typecheck
pnpm --filter @bunkercode/tactics-core test
pnpm test
```

Os testes importam o pacote compilado pelo próprio export público CommonJS; `typecheck` compila primeiro para conferir também os tipos desse consumo. O núcleo usa `lib: ES2022` e `types: []`, sem DOM ou tipos Node. Os testes usam `node:test`, tipos Node e TypeScript de desenvolvimento. O compilador não integra o runtime.

A bateria percorre seeds de 0 a 9999 **em cada modalidade**. Confere identidade, reprodução, AST/sintaxe dos programas completos, categorias, domínio, resultados por oráculo de categorias independente, seis resultados distintos, aprovação única, rejeição das cinco alternativas e coerência pública/interna. O reparo também tem sintaxe e mudança de comportamento verificadas. Lacunas intencionais não são submetidas ao parser. Falhas incluem família, versão, seed e modalidade.

Além de fixtures calculadas para zero e seed máxima, a suíte recusa seeds/versões/respostas/modelos inválidos, compara processos independentes em fusos diferentes e confere diversidade de valores, limites, operadores, seis permutações e ao menos mil programas distintos. `pnpm test` da raiz inclui explicitamente a suíte. Os testes do núcleo não dependem de navegador; o consumidor Tactics Lab possui a suíte E2E descrita abaixo.

## Core 02: API e responsabilidades

O Core 02 preserva os exports, resultados, avaliações, fixtures e código do Core 01. Reutiliza `nextRandom` sem modificá-lo. Não há AST universal, interpretador JavaScript, registry, classes ou plugins. As famílias novas compartilham somente o domínio de instruções aritméticas e validação de dados; não alteram a validação da primeira família.

| Família               | Geração                                           | Transformação                                | Apresentação                         | Avaliação                                   | Verificação                       |
| --------------------- | ------------------------------------------------- | -------------------------------------------- | ------------------------------------ | ------------------------------------------- | --------------------------------- |
| `assignment-sequence` | `generateAssignmentReference(seed, version = 1)`  | `transformAssignmentProgram(program, kind)`  | `getPublicAssignmentTactic(tactic)`  | `evaluateAssignmentAnswer(tactic, answer)`  | `verifyAssignmentTactic(tactic)`  |
| `conditional-branch`  | `generateConditionalReference(seed, version = 1)` | `transformConditionalProgram(program, kind)` | `getPublicConditionalTactic(tactic)` | `evaluateConditionalAnswer(tactic, answer)` | `verifyConditionalTactic(tactic)` |

Constantes novas: `ASSIGNMENT_GENERATOR_VERSION`, `CONDITIONAL_GENERATOR_VERSION` e `STEP_OPERATORS`. Tipos novos: `ArithmeticStep`; `AssignmentKind`, `AssignmentIdentity`, `AssignmentProgram`, `AssignmentTrace`, `AssignmentTactic`, `PublicAssignmentTactic`, `AssignmentEvaluation`; `ConditionalKind`, `ConditionalIdentity`, `ConditionalProgram`, `ConditionalTrace`, `ConditionalTactic`, `PublicConditionalTactic`, `ConditionalEvaluation`. As verificações retornam o tipo `Validation` existente.

As identidades mantêm `family`, `generatorVersion`, `seed` e `kind`. Seed uint32 e normalização de `-0` seguem o contrato anterior; cada família valida sua própria versão, e modelos recebidos precisam declarar a versão explicitamente. Geração, transformação e apresentação lançam erros em entradas incompatíveis. Verificação e avaliação retornam estados estruturados, sem aprovar dados inválidos.

O domínio aritmético contém oito instruções, nesta ordem: `+= 1`, `+= 2`, `+= 3`, `-= 1`, `-= 2`, `-= 3`, `*= 2`, `*= 3`. `ArithmeticStep` usa `{ operator, operand }`. Operações desconhecidas, multiplicação por zero/um e instruções fora das alternativas da rodada não são respostas aceitas. Não há coerção de strings nem campos extras permitidos.

## Assignment-sequence, versão 1

Gera um `let value`, de duas a quatro instruções e `const result = value`. As duas primeiras palavras do Mulberry32 escolhem o estado inicial (`word % 19 - 9`) e a quantidade (`2 + word % 3`). Cada palavra seguinte escolhe uma instrução do domínio ordenado, filtrando operações que manteriam o estado inalterado. Isso exclui multiplicação quando o estado é zero. Não são gerados arrays, funções, coerção ou loops no programa apresentado.

Estados são inteiros: inicial em `[-9, 9]`, no máximo quatro operações com operandos até 3. Os estados das referências e alternativas ficam em `[-729, 729]`; o cálculo ainda verifica explicitamente inteiro seguro e limite absoluto de **1000**. Não há divisão, módulo ou multiplicação por zero. O rastreamento registra `initial`, `transitions` com `step`, `before`, `after`, e `result`.

A transformação inicializa uma sequência separada com `(seed ^ 0x93d765dd) >>> 0`. O primeiro sorteio escolhe `stepIndex` dentre todas as posições. São avaliadas as oito instruções no programa inteiro, incluindo o sufixo posterior à posição escolhida. O pool incorreto exclui operações neutras e resultados iguais ao objetivo. Retiram-se candidatos deterministicamente desse pool até obter dois resultados distintos, no máximo oito retiradas; junto da instrução original, formam três alternativas embaralhadas por Fisher–Yates. Essa enumeração é limitada; não há regeneração de programas, tentativas ilimitadas ou fallback aleatório. Falta de alternativas lança erro, sem devolver uma tática inválida.

A existência das alternativas decorre das seis translações `±1`, `±2`, `±3`: geram estados diferentes, e o sufixo usa somente transformações afins com fator positivo não nulo, preservando suas diferenças. A implementação também verifica três resultados distintos e uma única aprovação.

`complete-step` apresenta `___;` na posição selecionada. `repair-step` consome um sorteio adicional para apresentar uma das duas alternativas incorretas. As duas modalidades têm exatamente o mesmo programa-base, posição e alternativas. A correção considera **o resultado final**, não apenas a transição local nem a semelhança textual da instrução.

Exemplo real, seed **0**:

```javascript
let value = -6;

value += 1;
value -= 2;
value -= 2;

const result = value;
```

Rastreamento interno: `-6 → -5 → -7 → -9`. Ambas as modalidades desafiam a primeira instrução. Alternativas, na ordem pública: `+= 2`, `+= 1`, `-= 1`; seus resultados finais são `-8`, `-9`, `-11`. O reparo apresenta `-= 1`. O payload público oferece posição, código, alternativas e objetivo `-9`, sem incluir referência ou rastreamento da solução.

```typescript
const program = generateAssignmentReference(0, 1);
const tactic = transformAssignmentProgram(program, "complete-step");
const view = getPublicAssignmentTactic(tactic);
const evaluation = evaluateAssignmentAnswer(tactic, view.alternatives[0]);
// status: "valid", achieved: false, produced: -8, expected: -9;
// trace contém os estados da escolha += 2, não os da solução de referência.
```

`AssignmentEvaluation` distingue `valid`, `invalid-answer` e `invalid-tactic`; apenas escolhas reconhecidas retornam `trace`. Uma instrução aritmética válida fora das três alternativas é `invalid-answer`. A resposta deve ser o objeto estruturado completo, sem campos adicionais.

## Conditional-branch, versão 1

Gera `calculate(start)` com estado local, preparação aritmética, comparação, `if`, `else` e retorno. As sete palavras da geração escolhem, em ordem: entrada central (`word % 11 - 5`), preparação no domínio de oito instruções, operador no domínio anterior de seis comparações, operação do `if`, operação do `else` e duas trocas Fisher–Yates das entradas.

As entradas iniciais são centro−1, centro e centro+1. O limite é o estado preparado da entrada central. Como a preparação é estritamente crescente, os três casos cobrem abaixo, igual e acima do limite, inclusive quando a preparação multiplica. Entradas pertencem a `[-6, 6]`, estados preparados a `[-18, 18]`, limites a `[-15, 15]` e resultados a `[-54, 54]`.

As operações de ramo vêm do domínio ordenado, filtrado para mudar o estado nos três casos. O `else` também precisa produzir um resultado diferente do `if` em **cada** estado preparado. As seis translações garantem opções discriminantes; o pool é enumerado uma vez, sem retries de geração. Se estiver vazio, o gerador lança erro. Os seis operadores produzem seis assinaturas distintas de resultados, e os casos executam os dois ramos.

`complete-condition` oculta o operador. `repair-condition` usa um passo independente iniciado com `(seed ^ 0xc6bc2796) >>> 0`, escolhendo `word % 5` dentre as comparações diferentes da original. Pelo menos um dos três resultados muda. A modalidade não interfere nos sorteios do programa-base.

Exemplo real, seed **0**:

```javascript
function calculate(start) {
  let value = start;

  value *= 3;

  if (value === 0) {
    value += 1;
  } else {
    value += 3;
  }

  return value;
}
```

| Entrada | Após preparação | Comparação | Ramo | Após ramo / resultado |
| ------- | --------------- | ---------- | ---- | --------------------- |
| -1      | -3              | false      | else | 0                     |
| 0       | 0               | true       | if   | 1                     |
| 1       | 3               | false      | else | 6                     |

As duas modalidades têm entradas `[-1, 0, 1]` e objetivo `[0, 1, 6]`. O reparo apresenta `<`, que produz `[-2, 3, 6]`. O público recebe entradas, objetivos, comparações permitidas e código, sem operador de referência ou traces. `ConditionalEvaluation` devolve `produced`, `expected` e, para respostas reconhecidas, `traces` com `input`, `afterPreparation`, `comparison`, `branch`, `afterBranch` e `result`. A aprovação exige correspondência dos **três resultados na ordem original**.

## Validação e limites do Core 02

Cada referência, identidade, transformação, alternativa, rastreamento e texto recebido é comparado ao modelo canônico regenerado. Objetos com campos extras, arrays esparsos, versões ausentes, traces adulterados ou transformações diferentes são recusados. Modelos e listas gerados são readonly e congelados. Texto nunca decide a semântica e não é executado, inclusive nos testes.

Os dois novos testes de propriedades percorrem **10.000 seeds por família**, verificando as duas modalidades: **40.000 táticas novas**, além das **20.000** do Core 01. Oráculos por composição afim e tabelas de categorias verificam os estados independentemente da implementação; o parser TypeScript confere sintaxe e estrutura das referências e reparos. Há fixtures manuais, entradas inválidas, modelos adulterados e reprodução em processos independentes. A diversidade mede quantidades/ordens de operações, posições da lacuna, comparações e padrões de ramos; não exige unicidade textual por seed.

O script existente `test/*.test.cjs` inclui as novas suítes tanto no pacote quanto na chamada raiz. O pacote mantém suas dependências, scripts e configurações. Os números podem colidir em um domínio finito e a seleção por módulo não promete uniformidade perfeita. A separação pública/interna continua arquitetural, sem proteção contra inspeção no navegador. Não há avaliação de código livre, linguagem genérica, adaptação de dificuldade ou persistência no núcleo. A sessão pertence exclusivamente ao consumidor frontend abaixo.

## Collection-flow — organização de código, gerador versão 1

O Bloco 02 acrescenta uma família independente. `generateCollectionReference(seed, generatorVersion = 1, structure?)` gera registros sintéticos e compõe instruções de coleção; `transformCollectionProgram(program, "order-program")` embaralha blocos inteiros; `getPublicCollectionTactic` apresenta dados, objetivo e blocos; `evaluateCollectionAnswer(tactic, order)` recebe somente uma permutação dos IDs conhecidos; `verifyCollectionTactic` confere a reprodução canônica. `COLLECTION_STRUCTURES` enumera as quatro composições. Não há execução do JavaScript de apresentação.

| Estrutura | Padrão | Blocos | Semântica |
| --- | --- | --- | --- |
| `filter-map-join` | Selecionar e transformar | 3 | Filtrar pessoas ativas/inativas, projetar nomes e juntar. |
| `find-fallback-uppercase` | Buscar e tratar ausência | 3 | Buscar por nome, escolher nome/fallback e converter para maiúsculas. |
| `filter-map-reverse-join` | Selecionar e transformar | 4 | Inverter a coleção de nomes antes de materializar o resultado. |
| `declare-find-fallback-uppercase` | Buscar e tratar ausência | 5 | Acrescentar declarações independentes de target/fallback, com dependências parciais. |

A identidade inclui **família, seed uint32, generatorVersion, structure e kind**. Sem estrutura explícita, o primeiro sorteio escolhe uma das quatro; esse sorteio também é consumido quando a estrutura é explícita. Reproduzir uma identidade exige passar sua estrutura. Dados e código são regenerados e comparados integralmente antes da avaliação; modelos adulterados e arrays esparsos são recusados.

Mulberry32 permanece inalterado. A família sorteia estrutura, embaralha uma pequena fonte de nomes, escolhe três a cinco registros, estados booleanos e ordem dos dados, busca presente/ausente, fallback e separador. Há pelo menos duas pessoas no estado filtrado e uma no estado oposto. Os nomes são únicos; inverter os nomes selecionados sempre muda o resultado. São dados sintéticos, sem atribuição de experiências ao autor. O domínio é finito e a redução por módulo não promete uniformidade perfeita.

Cada bloco é uma declaração completa ou uma chamada de coleção coerente. Seu ID identifica uma das nove operações específicas desta família, com dependências e declaração produzida; isso não constitui AST universal nem interpretador JavaScript. O embaralhamento tem sequência própria, derivada de `seed ^ 0x67be91d3`, usando Fisher–Yates. Se produzir uma ordem semanticamente correta, um consumidor é movido antes de sua dependência. Não há tentativas aleatórias ilimitadas.

A avaliação distingue `valid` (com `achieved` verdadeiro ou falso), `invalid-order` (primeira dependência ausente, sem resultado final), `invalid-answer` (IDs incompatíveis, duplicados, ausentes ou extras) e `invalid-tactic`. Traces registram somente as instruções efetivamente avaliadas, com valores estruturados e snapshots imutáveis.

Não se compara a resposta à ordem textual de referência. As declarações independentes admitem três ordens corretas quando a busca não encontra o registro e cinco quando encontra: nesse caso, o ternário não lê fallback, que pode ser declarado depois do resultado. A avaliação respeita esse curto-circuito, sem transformar uma referência lexical não utilizada em erro de dependência. Na composição com `reverse`, juntar antes de inverter é estruturalmente válido, mas produz outro resultado: `valid` com `achieved: false`. Isso permite diferenciar erro de dependência de erro de comportamento. Nenhuma dependência, função ou propriedade arbitrária fornecida pelo navegador é interpretada.

A suíte nova percorre 10.000 seeds, extrai dependências da representação JavaScript com o parser TypeScript, confere sintaxe e enumera todas as permutações dos três a cinco blocos contra um oráculo independente de comportamento. Também verifica imutabilidade, dados inválidos, reprodução em processos/fusos distintos, equivalências, resultados incorretos válidos e variedade estrutural. As suítes e os algoritmos das três famílias anteriores não foram modificados.

## Tactics Lab 02 — Blocos 01 e 02

Abra `/tactics` pela Home ou Header; `/lab/tactics` é o alias compatível. A rota usa shell, foco e boundary existentes, com carregamento lazy. Esta seção descreve Intervenção e Organização; Investigação tem composição própria descrita adiante. O frontend declara `@bunkercode/tactics-core` como dependência workspace; um alias Vite resolve apenas seu entrypoint público para o fonte TypeScript, seguindo o padrão de `content`. Typecheck e consumidores Node continuam usando as declarações CommonJS compiladas. A nova família estende o núcleo sem alterar os contratos e algoritmos das três famílias anteriores.

O ciclo é observar, selecionar uma operação, executar, inspecionar e avançar. Intervenção e Organização usam uma coluna centralizada de até 800px: objetivo, programa, resultado quando disponível e ações. Nas seis modalidades pontuais, um select nativo é a única superfície de resposta, integrado à região manipulável do programa, com foco visível e altura de toque de 44px. Em `order-program`, dados fixos aparecem acima de uma lista de instruções, com Subir/Descer no próprio código. Mouse, toque e teclado usam esses controles de 44px; Alt+↑/↓ também move o bloco. O foco acompanha o mesmo bloco, inclusive nos limites. Movimentar limpa o feedback, sem avaliar; Executar avalia explicitamente a ordem atual, inclusive a inicial. Completar mantém a lacuna; reparar mantém a operação incorreta inicial, sem contar como seleção até uma escolha explícita. O restante do código permanece somente leitura, com numeração e rolagem horizontal própria. Adaptadores específicos dos templates v1 encontram um único slot validado no texto público; não há parser genérico, substituição global ou leitura da solução interna para montar a apresentação. Não se usa CodeMirror, HTML bruto ou execução do texto.

O objetivo aparece uma única vez, antes do programa; condicionais preservam as três entradas e resultados esperados na ordem do núcleo, em uma tabela compacta. Não há coluna lateral nem painel vazio de execução. Após **Executar**, o resultado aparece antes das ações: organização mostra produzido/esperado ou a primeira dependência pendente, com trace sob demanda; comparações e atribuições mostram produzido/esperado; o `AssignmentTrace` fica em **Ver execução passo a passo**. Condicionais mostram produzido/esperado e **Confere/Diverge** para cada entrada, com preparação, condição e ramo expansíveis individualmente. Todos os rastreamentos começam recolhidos. Os valores vêm exclusivamente do avaliador, sem recalcular o programa na interface. O resultado é anunciado por uma região acessível, sem repetir instruções visualmente. Selecionar não avalia; mudar uma tentativa incorreta remove o resultado obsoleto. Uma resposta correta é concluída uma única vez, mantém o resultado visível e substitui Executar/Pular por **Próxima** como ação principal. Após sucesso, o foco acompanha **Próxima**; ao avançar, passa para o objetivo da nova rodada. A proteção contra duplo clique do Lab 01 permanece, com cancelamento de pointerdown sobre ações desabilitadas para impedir perda de foco quando o segundo clique cai no novo Executar. **Pular** avança imediatamente, sem revelar a solução ou contar sucesso. Eventos obsoletos e cliques repetidos não duplicam conclusão/avanço.

### Sessão reproduzível

`/lab/tactics?seed=4812&version=2` inicia a sessão nova reproduzível. No Bloco 02, a rota sem parâmetros iniciava a versão 2; a evolução abaixo passa o default a v3. Para preservar links antigos, uma URL com seed e sem versão continua usando a versão 1; `version=1` também a seleciona explicitamente. Versão duplicada, não canônica ou diferente de 1/2/3 é recusada. Opções da sessão mostra a seed, versão e link Reproduzir sessão; Nova sessão agora cria uma URL explícita de versão 3. O parâmetro aceita uma única representação decimal canônica de inteiro uint32, de `0` a `4294967295`; sinais, espaços, frações, zeros à esquerda, campos duplicados e valores fora do intervalo são recusados. Sem parâmetro, a seed vem de `crypto.getRandomValues`.

As versões do controlador local são independentes das versões dos geradores. A **v1** preserva integralmente o contrato anterior. Para índice começando em zero, a seed da rodada é `(sessionSeed + Math.imul(index, 0x9e3779b9)) >>> 0`. O passo ímpar percorre o domínio uint32 sem repetir seeds antes de completar seu ciclo; o índice aceito é de 0 a 4294967295. Programas textualmente iguais ainda podem ocorrer no domínio finito do núcleo.

Na versão 1, o ciclo de modalidades é: `complete-operator`, `complete-step`, `complete-condition`, `repair-operator`, `repair-step`, `repair-condition`. As famílias nunca se repetem consecutivamente. Todas usam gerador versão 1, explicitamente. Assim, as seis modalidades aparecem nas primeiras seis rodadas e continuam com novas seeds. A sessão 4812 começa com seeds de rodada `4812`, `2654440581` e `1013909054`.

Na **v2**, índices pares (começando em zero) são organização; índices ímpares percorrem as seis modalidades pontuais na ordem v1. A seed de cada rodada continua derivada do índice real pela fórmula acima. A estrutura de organização é `COLLECTION_STRUCTURES[(sessionSeed % 4 + floor(index / 2)) % 4]`: uma rotação determinística de quatro composições, alternando os dois padrões. A janela antirrepetição contém as três organizações anteriores; a composição atual não repete nenhuma delas enquanto existe a quarta alternativa. Essa política não utiliza estado persistido, Math.random, adaptação ou recomendação.

As primeiras 12 rodadas contêm seis organizações e as seis modalidades antigas, sem duas intervenções pontuais consecutivas. A organização já aparece na primeira rodada. Em 24 rodadas, são 12 organizações (três de cada estrutura) e 12 intervenções pontuais (duas de cada modalidade). Mesmo seed, versão e índice reproduzem família, padrão, dados, ordem inicial e objetivo. Os defaults programáticos antigos de `createRound`/`startSession` permanecem v1; a UI passa a versão explicitamente.

O cabeçalho indica discretamente a rodada atual e o marco de 12. Seed, contadores reais e **Nova sessão** ficam em **Opções da sessão**, um expansível nativo acessível por teclado. Doze rodadas realizadas formam apenas um marco: é possível continuar ou iniciar outra sessão. **Nova sessão** obtém outra seed criptográfica e atualiza a URL com replace; uma colisão com a seed anterior é desempatada incrementando uint32. Os únicos números temporários são posição, realizadas, resolvidas e puladas. Realizadas é a soma de resolvidas e puladas; tentativas não contam como rodadas. Não há vidas, ranking, cronômetro ou penalidades.

Todo o estado fica no reducer do componente. Reload com seed explícita reinicia a sequência e zera os contadores; sem seed explícita, sorteia outra sessão. Não há IndexedDB, localStorage, heatmap, submissões ou histórico de Táticas. Geração e avaliação funcionam sem backend e não fazem chamadas HTTP. O código do programa é apresentação inerte; apenas as operações estruturadas do avaliador calculam os resultados.

### Testar o laboratório

```bash
pnpm build
pnpm --filter @bunkercode/frontend exec playwright test e2e/tactics-lab.spec.ts
pnpm --filter @bunkercode/frontend test:browser
```

Playwright usa Vite Preview e exige build prévio. A configuração padrão também inicia o backend para testar as demais páginas; o laboratório não o utiliza. Cada execução real cria uma cópia temporária fora do checkout, pertencente ao supervisor do backend, e um diretório exclusivo de resultados preservados. Configuração/--list não criam cópias; SIGINT/SIGTERM, término normal e falhas controladas limpam apenas a fixture própria. SIGKILL pode deixar resíduo no temporário do sistema, sem acumular conteúdo no checkout. Diretórios de conteúdo fornecidos explicitamente por ambiente nunca são removidos, e sobreposição com conteúdo canônico é recusada; `BUNKERCODE_BROWSER_OUTPUT_DIR` funciona como pai de uma nova pasta de resultados por execução, preservando arquivos anteriores. A suíte específica preserva as seis modalidades e acrescenta organização por mouse, teclado e toque, ordens equivalentes, erro de dependência, erro de comportamento, correção, replay versionado, distribuição e uma sessão real de 24 rodadas registrada como evidência. Cobre ainda seleção única dentro do programa, ausência de alternativas duplicadas/painel vazio, erros/acertos reais, traces conhecidos e expansão, seed/refresh, contadores, marco de 12, teclado/foco e duplo clique, erros de chunk, quatro viewports (1440×900, 1280×720, 390×844 e 360×640), objetivo/programa/ações sem rolagem prévia no desktop e execução com API, persistência, workers e compilação dinâmica indisponíveis. As capturas vêm do navegador real.

## Iteration Flow — gerador v1 e investigação

A área oficial é `/tactics`, acessível pela Home e pelo Header, inclusive com a API indisponível. `/lab/tactics` redireciona com replace preservando query string e hash. O carregamento continua lazy, sob a barreira de erros existente. Táticas não é curso, não escreve conteúdo nem registra atividade de aprendizagem.

`iteration-flow` é uma família especializada em arrays sintéticos de 3–6 registros `{ name, active, category }`. Os padrões `collect-matching`, `count-matching`, `first-match` e `partition-by-flag` produzem, respectivamente, lista projetada, contagem, primeira projeção ou null e objeto `{ matching, other }`. A projeção varia entre nome e categoria; a condição usa igualdade estrita de flag ou categoria. Partição sempre usa flag. Há no máximo um loop, seis iterações, uma condição por iteração, dois níveis de fluxo e 28 eventos; grupos somados têm no máximo seis valores. Strings vêm de doze nomes e três categorias fixos; não há entrada livre, objetos aninhados ou execução do código exibido.

### Contrato canônico

A versão 1 valida seed uint32 e utiliza o Mulberry32 existente, sem alterar as famílias anteriores. Consome uma palavra para o padrão natural (também quando o padrão é solicitado), onze para Fisher–Yates dos nomes, depois quantidade, projeção, flag e categoria. A condição sorteia flag/categoria exceto na partição. First Match sorteia ausência em um quarto dos casos. Cada registro consome palavras somente nas propriedades não determinadas pelas garantias: o primeiro atende ao critério e o segundo diverge, salvo a busca sem correspondência; os demais variam. Por fim, Fisher–Yates embaralha os registros. A ordem exata e os ramos estão em `src/iteration.ts`; mudança exige nova versão. Redução por módulo tem viés e seeds podem colidir em domínio finito.

A fonte da verdade contém instruções com IDs estáveis: inicialização, iteração, condição, ação específica, break na busca e resultado. `lines` associa cada instrução a uma linha do JavaScript derivado; dados e delimitadores não são respostas selecionáveis. Referências, instruções, operações, registros, estados e arrays públicos são congelados recursivamente. Cada evento tem `instructionId`, índice de iteração, registro, estado antes/depois e resultado booleano da condição quando aplicável. Inicialização e resultado usam índice/registro null. O trace da busca termina imediatamente após a primeira correspondência. Não há interpretador genérico, AST executável, eval, Function, serviço ou runner.

| Operação pública | Uso |
| --- | --- |
| `generateIterationReference(seed, version = 1, pattern?)` | Gera referência, código derivado, objetivo, resultado e trace correto. |
| `transformIterationProgram(reference, "locate-fault")` | Confere a referência e deriva exatamente uma instrução defeituosa. |
| `getPublicIterationTactic(tactic)` | Retorna objetivo, entradas, esperado, código mutante, IDs selecionáveis e trace mutante. |
| `getIterationTrace(tactic)` | Confere e devolve trace mutante estruturado. |
| `evaluateIterationAnswer(tactic, instructionId)` | Avalia ID conhecido; apenas o diagnóstico correto recebe explicação e trecho corrigido. |
| `verifyIterationTactic(tactic)` | Reconstrói canonicamente referência, mutação, código e trace. |

As mutações são: inversão da seleção, projeção de propriedade errada, decremento de contagem e destino incorreto na partição. Collect/First escolhem a prioridade das duas primeiras por um passo independente com seed XOR `0x3c6ef372`. Count usa decremento; Partition alterna a instrução de destino pela paridade da seed. São no máximo duas tentativas; uma mutação só é aceita quando o resultado completo diverge do esperado. A ausência de correspondência pode rejeitar a projeção errada e usar a inversão. A referência correta, arquétipo e ID do defeito ficam fora da visão pública. Essa separação não protege contra inspeção do pacote no navegador.

A verificação rejeita campos extras, modelos, identidades, instruções e traces adulterados. Respostas aceitam somente string exata de ID canônico. Avaliação distingue `valid`, `invalid-answer` e `invalid-tactic`; erro nunca aprova. A biblioteca pressupõe objetos de dados comuns, sem promessa de sandbox contra Proxies/getters hostis.

### Experiência de investigação

A Investigação usa uma área mais larga que as táticas simples. A partir de 900px, Programa e Execução ficam lado a lado; abaixo disso, seguem em uma coluna. O programa inteiro permanece na rolagem do documento, com rolagem horizontal local para linhas longas. Instruções selecionáveis são botões nativos de pelo menos 44px. Marcadores textuais **▶ Atual**, **? Suspeita** e **✓ Defeito** distinguem os estados, inclusive quando atual e suspeita coincidem. A origem só é marcada após acerto ou pulo.

Iniciar, avançar, voltar e ir ao resultado final consultam eventos já calculados pelo núcleo. A UI mostra somente o evento atual: registro, condição quando presente e estado com rótulo específico (elementos selecionados, quantidade, primeiro valor ou grupos). Não recalcula o programa nem inventa dados ausentes. Selecionar uma suspeita não avalia; **Confirmar diagnóstico** avalia explicitamente. Um erro mostra uma mensagem curta; escolher outra linha limpa o feedback anterior.

Acerto e pulo substituem execução e feedback transitórios por uma conclusão única: esperado, produzido, linha responsável, explicação e instrução correta legível, antes de **Próxima**. Pular limpa resultado, suspeita e erro no reducer, contabiliza apenas pulo e aguarda Próxima. Acerto contabiliza apenas sucesso. Ações obsoletas/repetidas são recusadas. A troca de rodada desmonta o trace local, e a nova rodada começa sem seleção ou feedback. Organização e Intervenção mantêm seus layouts e pulo imediato; o resultado também precede os controles de continuidade. No mobile, Organização quebra linhas nos espaços, preservando palavras e rolagem horizontal quando um token não cabe. O foco acompanha Próxima e depois o objetivo da nova rodada; nenhum código exibido é executado.

### Sessão v3

A rota sem parâmetros e Nova sessão usam v3. URLs com seed sem versão continuam **v1**; `version=1` e `version=2` mantêm seus contratos. Defaults programáticos de `createRound` e `startSession` continuam v1. Replay contém seed e versão explícitas.

A v3 usa a mesma derivação de seed por índice real. Cada bloco de doze contém quatro trios; cada trio contém uma intervenção, uma organização e uma investigação. Permutações são escolhidas por mixer uint32 puro, dependente de seed, bloco e ciclo, filtrando a repetição na fronteira anterior. O bloco começa numa âncora dependente da seed e termina em outra mecânica para proteger a fronteira entre blocos. São no máximo quatro escolhas por consulta, inclusive em índices grandes. Isso varia as ordens dos trios, sem sequência tripla fixa ou reconstrução de todo o histórico.

As quatro estruturas de Collection Flow e os quatro padrões de Iteration Flow usam rotações independentes dependentes da seed, sem repetição nas três ocorrências anteriores da mesma mecânica. As seis modalidades pontuais usam rotação própria, evitando começar sempre pela mesma. Doze rodadas têm distribuição 4/4/4; 24 têm 8/8/8; 60 têm 20/20/20. A sequência continua após esses marcos, sem persistência ou adaptação. A rotação de padrões ainda é perceptível em sessões longas; não se promete novidade ilimitada.

### Validação da evolução

A suíte do núcleo verifica 10.000 seeds agregadas (2.500 por padrão), oráculos declarativos independentes, estados por prefixo, diferença real da mutação, alteração de uma única instrução, sintaxe de referência/mutante via TypeScript, limites, ausência, encerramento antecipado, congelamento e entradas adulteradas. Fixtures manuais fixam resultados da seed zero e busca ausente. Os testes de sessão fixam hashes de 192 rodadas v1/v2 capturados antes da alteração e auditam 12/24/60 rodadas para seeds 0, 1, 4812 e máxima. E2E mantém as mecânicas anteriores e acrescenta navegação oficial/legada, API offline, investigação com erro/acerto/pulo, trace, quatro viewports, toque, teclado e 24 rodadas v3 realmente resolvidas no navegador.
