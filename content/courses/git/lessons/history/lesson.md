# Histórico e diferenças

> Conteúdo introdutório demonstrativo. Amplie com suas próprias explicações. Comandos e exemplos desta lição não são executados pelo site.

## Objetivo
Consultar commits e comparar alterações sem modificar o checkout.

## Investigar uma mudança
O histórico ajuda a localizar quando uma decisão foi registrada. Um diff mostra como os arquivos mudaram entre estados.

```bash
git log -5 --oneline
git show --stat HEAD
git diff HEAD~1 HEAD
```

Exemplo demonstrativo de inspeção: o primeiro comando lista até cinco commits; o segundo resume o commit atual; o terceiro compara o pai imediato com o commit atual. A última expressão precisa que exista um commit pai.

Um hash identifica um commit; mensagens ajudam a compreender sua intenção. A interpretação ainda depende do código e do contexto: uma descrição curta não substitui a revisão do diff.

## Para revisar
Você quer comparar commits, staging ou arquivos atuais? Escolha os dois estados antes de interpretar o resultado. Estes comandos não fazem checkout, reset ou integração de branches.

## Referência
[Pro Git — Viewing the Commit History](https://git-scm.com/book/en/v2/Git-Basics-Viewing-the-Commit-History)
