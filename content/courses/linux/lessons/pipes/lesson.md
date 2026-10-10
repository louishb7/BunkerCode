# Pipes e fluxo de texto

> Conteúdo introdutório demonstrativo. Amplie com suas próprias explicações. Comandos e exemplos desta lição não são executados pelo site.

## Objetivo
Conectar a saída de um programa à entrada de outro.

## Pequenas operações combinadas
Programas podem ler pela entrada padrão e escrever na saída padrão. Um pipe conecta esses fluxos sem exigir um arquivo intermediário.

```bash
printf 'typescript\nnodejs\nnestjs\n' | wc -l
```

O exemplo demonstrativo produz três linhas e entrega esse texto a `wc -l`, que conta as quebras de linha. Nenhum arquivo é criado ou alterado.

Erros usam um fluxo separado, a saída de erro padrão. Por padrão, um pipe transporta a saída padrão, não todos os textos emitidos pelo processo. Essa distinção ajuda a investigar comandos que mostram mensagens no terminal, mas não entregam o texto esperado à próxima etapa.

## Para revisar
O primeiro programa realmente produziu linhas? O seguinte está lendo pela entrada padrão? Construir uma composição aos poucos facilita compreender o fluxo.

## Referência
[Linux man-pages — pipe(7)](https://man7.org/linux/man-pages/man7/pipe.7.html)
