# Módulos e responsabilidades

> Conteúdo introdutório demonstrativo. Amplie com suas próprias explicações. Comandos e exemplos desta lição não são executados pelo site.

## Objetivo
Separar um cálculo de sua apresentação usando export e import.

## Um módulo por responsabilidade
Um módulo pode exportar valores que outros módulos consomem. Usar arquivos `.mjs` torna explícito que estes exemplos usam ECMAScript modules, sem depender da configuração de um projeto existente.

```javascript
// pricing.mjs
export function totalPrice(unitPrice, quantity) {
  return unitPrice * quantity;
}
```

```javascript
// main.mjs
import { totalPrice } from "./pricing.mjs";
console.log(totalPrice(9, 4));
```

Para experimentar fora do site, crie os dois arquivos numa pasta demonstrativa e use `node main.mjs`. A saída será 36. O caminho relativo inclui a extensão do arquivo; isso evita depender de resolução implícita.

`pricing.mjs` não imprime nada: oferece uma operação. `main.mjs` decide como apresentar seu resultado. A separação permite reutilizar o cálculo sem duplicar comportamento.

## Para revisar
O nome exportado comunica uma responsabilidade? Importar este arquivo provoca efeitos que o consumidor não esperava?

## Referência
[Node.js — ECMAScript modules](https://nodejs.org/api/esm.html)
