# Valores e tipos

> **Exemplo inicial.** Esta lição demonstra o formato de autoria do BunkerCode. Não representa uma reflexão pessoal do autor. Substitua-a por sua explicação depois de estudar e praticar.

## Uma ideia para investigar

Um valor existe durante a execução do programa. Um tipo ajuda a descrever quais valores e operações esperamos no código.

O TypeScript pode inferir um tipo a partir da atribuição. Uma anotação também pode deixar a intenção explícita:

```typescript
let remainingStock: number = 3;
const productName = "Notebook";
const available: boolean = remainingStock > 0;
```

As anotações de tipo não são validações automáticas dos dados recebidos por uma API. Esse comportamento precisa ser implementado no programa.

## Experimente antes de escrever sua conclusão

1. Troque a atribuição de `remainingStock` por uma string no seu ambiente de estudo.
2. Observe o diagnóstico do compilador.
3. Explique, com suas palavras, qual expectativa foi violada.

> **Dica de autoria:** registre uma dúvida concreta e um exemplo pequeno que ajudou a investigá-la. Você não precisa preencher seções padronizadas.

## Referência

- [TypeScript Handbook: Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html)

O próximo exemplo explora um valor que pode assumir mais de um tipo.
