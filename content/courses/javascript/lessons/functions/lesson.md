# Funções e escopo

> Conteúdo introdutório demonstrativo. Amplie com suas próprias explicações. Comandos e exemplos desta lição não são executados pelo site.

## Objetivo
Extrair um cálculo para uma função e reconhecer seus parâmetros e variáveis locais.

## Uma operação com entrada e saída
Uma função reúne instruções que podem ser chamadas com argumentos. O parâmetro nomeia a entrada dentro da função; `return` entrega o resultado ao ponto que fez a chamada.

```javascript
function totalPrice(unitPrice, quantity) {
  const subtotal = unitPrice * quantity;
  return subtotal;
}
const firstTotal = totalPrice(12, 3);
const secondTotal = totalPrice(8, 2);
console.log(firstTotal, secondTotal);
```

O exemplo demonstrativo calcula 36 e 16 em chamadas independentes. `subtotal` só existe no escopo da função. O código que chama a função não precisa conhecer essa variável intermediária.

Uma função também pode ser um valor atribuído a uma variável: `const double = (value) => value * 2;`. A forma de seta não exige um corpo com chaves para uma expressão simples. Ao usar chaves, escreva `return` quando precisar entregar um valor.

## Pratique com entradas diferentes

No workspace ao lado, implemente `totalPrice`. Run chama a função com os casos públicos; Submit reavalia e registra uma solução local. Os exemplos desta página continuam texto inerte.

```bunker-exercise
{"kind":"exercise"}
```

## Para revisar
O cálculo depende somente dos parâmetros ou consulta variáveis externas? Separar entradas explícitas facilita explicar e testar a operação.

## Referência
[MDN — Functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions)
