# Tactics Core

`@bunkercode/tactics-core` é uma biblioteca independente de funções determinísticas para gerar programas pequenos e derivar táticas. O Core 01 contém `comparison-boundaries`; o Core 02 acrescenta `assignment-sequence` e `conditional-branch`. Cada família possui gerador **versão 1**, com contrato próprio. Ainda não existe modo de táticas na interface, endpoint, persistência ou integração com exercícios editoriais.

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

Além de fixtures calculadas para zero e seed máxima, a suíte recusa seeds/versões/respostas/modelos inválidos, compara processos independentes em fusos diferentes e confere diversidade de valores, limites, operadores, seis permutações e ao menos mil programas distintos. `pnpm test` da raiz inclui explicitamente a suíte. E2E de navegador não é necessário para este pacote sem integração à interface.

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

O script existente `test/*.test.cjs` inclui as novas suítes tanto no pacote quanto na chamada raiz. Não foram adicionadas dependências nem alterados scripts, lockfile ou configurações. Os números podem colidir em um domínio finito e a seleção por módulo não promete uniformidade perfeita. A separação pública/interna continua arquitetural, sem proteção contra inspeção no navegador. Não há avaliação de código livre, linguagem genérica, sessão, adaptação de dificuldade, persistência ou integração ao produto nesta entrega.
