# Union types

> **Exemplo inicial.** Conteúdo demonstrativo para provar leitura, exemplos e navegação. Escreva aqui seu próprio entendimento quando estudar o tema.

Uma union descreve alternativas possíveis. Antes de usar uma operação específica, o programa pode precisar distinguir qual alternativa recebeu.

```typescript
function formatIdentifier(value: string | number): string {
  if (typeof value === "number") {
    return value.toFixed(0);
  }
  return value.trim();
}
```

## Uma pergunta para a revisão

Por que chamar `toFixed` antes da condição não serve para todos os valores aceitos pela função?

## Prática opcional

O exercício de reserva de estoque está disponível ao fim da lição. Ele usa decisões e retornos tipados; não avalia domínio de union types. Você pode ler esta lição sem abrir ou executar o exercício.

## Referência

- [TypeScript Handbook: Union Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#union-types)
