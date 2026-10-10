# Diretório, staging e commit

> Conteúdo introdutório demonstrativo. Amplie com suas próprias explicações. Comandos e exemplos desta lição não são executados pelo site.

## Objetivo
Distinguir o arquivo em edição, o conteúdo preparado e o snapshot commitado.

## Três estados úteis
O diretório de trabalho contém seus arquivos atuais. O índice, ou staging, guarda o conteúdo preparado para o próximo commit. O commit registra um snapshot desse índice.

```bash
git status
git diff
git diff --cached
```

Os comandos demonstrativos acima são de inspeção. `status` resume os estados. `diff` compara o diretório de trabalho com o índice; `diff --cached` compara o índice com o commit atual.

É possível preparar um arquivo e editá-lo novamente. Nesse caso, o índice contém a versão preparada anteriormente, e a nova edição ainda não faz parte dela. Revisar os dois diffs evita incluir uma versão diferente da pretendida.

## Para revisar
O que está preparado? Há arquivos novos que um diff comum não inclui? Um commit só deve ser feito quando você decidiu o conjunto de alterações.

## Referência
[Pro Git — Recording Changes](https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository)
