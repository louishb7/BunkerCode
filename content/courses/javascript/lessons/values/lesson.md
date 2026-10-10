# Valores e variáveis

> Conteúdo introdutório demonstrativo. Amplie com suas próprias explicações. Comandos e exemplos desta lição não são executados pelo site.

## Objetivo
Distinguir um valor, sua variável e o tipo observado em JavaScript.

## Valores em movimento
Uma variável guarda uma referência a um valor. `const` impede reatribuir a variável; `let` permite atribuir outro valor. JavaScript não exige uma anotação de tipo na declaração: o tipo pertence ao valor em tempo de execução.

```javascript
const productName = "Caderno";
let quantity = 3;
quantity = quantity + 2;
const available = quantity > 0;
console.log(productName, quantity, available);
console.log(typeof quantity);
```

Neste exemplo demonstrativo, `quantity` passa de 3 para 5. A comparação produz um booleano; `typeof quantity` produz a string `"number"`. Trocar o valor por `"5"` cria uma string, sem converter automaticamente o significado de todos os operadores.

`const` também não congela um objeto. É possível alterar uma propriedade do objeto sem reatribuir a variável que o referencia. Prefira nomes que comuniquem intenção e só use `let` quando a reatribuição fizer parte do raciocínio.

## Para revisar
Qual valor cada expressão produz? Há alguma reatribuição que poderia ser eliminada?

## Referência
[MDN — Grammar and types](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Grammar_and_types)
