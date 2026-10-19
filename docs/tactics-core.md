# Tactics Core 01

`@bunkercode/tactics-core` é uma biblioteca independente de funções determinísticas para gerar programas pequenos e derivar táticas. A primeira família é `comparison-boundaries`, versão de gerador **1**. Ainda não existe modo de táticas na interface, endpoint, persistência ou integração com exercícios editoriais.

## Uso e API

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

## Contrato de reprodução da versão 1

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

## Limites e separação

O modelo interno contém o operador de referência; a representação pública contém somente identidade, código apresentado, objetivo, domínio e resultado esperado. Essa separação organiza responsabilidades e permite reprodução futura no backend. **Não é proteção contra inspeção**: com seed/versão e biblioteca no navegador, o usuário pode reconstruir o programa e sua resposta.

O avaliador filtra os números estruturados usando um switch dos operadores conhecidos. O texto JavaScript serve à apresentação; não é a fonte da verdade. A validação exige dados e texto coerentes com a geração canônica, recusando modelos alterados. Não se aceita código livre nem se usa `eval`, `Function`, VM, filesystem, DOM, IndexedDB, relógio, aleatoriedade global ou IA. O runtime não tem dependências externas. A validação pressupõe dados comuns; não constitui sandbox contra getters/Proxies hostis no mesmo processo.

Não há feedback pedagógico genérico, dificuldade adaptativa, histórico de aprendizagem, runner ou contratos aposentados. A compilação/execução da prática atual continua independente e não foi modificada. A família cobre apenas inteiros pequenos e comparação numérica; não avalia soluções arbitrárias nem equivalência geral de programas.

## Validação

```bash
pnpm --filter @bunkercode/tactics-core build
pnpm --filter @bunkercode/tactics-core typecheck
pnpm --filter @bunkercode/tactics-core test
pnpm test
```

Os testes importam o pacote compilado pelo próprio export público CommonJS; `typecheck` compila primeiro para conferir também os tipos desse consumo. O núcleo usa `lib: ES2022` e `types: []`, sem DOM ou tipos Node. Os testes usam `node:test`, tipos Node e TypeScript de desenvolvimento. O compilador não integra o runtime.

A bateria percorre seeds de 0 a 9999 **em cada modalidade**. Confere identidade, reprodução, AST/sintaxe dos programas completos, categorias, domínio, resultados por oráculo de categorias independente, seis resultados distintos, aprovação única, rejeição das cinco alternativas e coerência pública/interna. O reparo também tem sintaxe e mudança de comportamento verificadas. Lacunas intencionais não são submetidas ao parser. Falhas incluem família, versão, seed e modalidade.

Além de fixtures calculadas para zero e seed máxima, a suíte recusa seeds/versões/respostas/modelos inválidos, compara processos independentes em fusos diferentes e confere diversidade de valores, limites, operadores, seis permutações e ao menos mil programas distintos. `pnpm test` da raiz inclui explicitamente a suíte. E2E de navegador não é necessário para este pacote sem integração à interface.
