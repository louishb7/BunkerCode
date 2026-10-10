# JavaScript fora do navegador

> Conteúdo introdutório demonstrativo. Amplie com suas próprias explicações. Comandos e exemplos desta lição não são executados pelo site.

## Objetivo
Reconhecer o papel do runtime Node.js e diferenciar operações síncronas e assíncronas.

## Runtime e APIs
Node.js executa JavaScript fora do navegador e oferece APIs próprias. Não há uma página HTML nem `document` por padrão. Ler um arquivo, por exemplo, exige uma API do ambiente.

```javascript
import { readFile } from "node:fs/promises";
const text = await readFile(new URL("./notes.txt", import.meta.url), "utf8");
console.log(text.length);
```

Exemplo demonstrativo para um arquivo `.mjs` e um `notes.txt` criado por você. A URL relativa parte do módulo, não do diretório em que o terminal foi aberto. `await` aguarda a Promise resolver; uma falha de leitura rejeita a operação e deve ser tratada no programa real.

I/O assíncrono permite ao ambiente atender outros trabalhos enquanto aguarda uma operação. Isso não torna um cálculo pesado automaticamente paralelo: um loop longo ainda pode ocupar a thread JavaScript.

## Para revisar
Quais APIs pertencem à linguagem e quais pertencem ao runtime? Uma operação demorada está aguardando I/O ou usando CPU?

## Referências
[Node.js — Blocking vs Non-Blocking](https://nodejs.org/en/learn/asynchronous-work/overview-of-blocking-vs-non-blocking)

[Node.js — ECMAScript modules](https://nodejs.org/api/esm.html)
