# Diretórios e caminhos

> Conteúdo introdutório demonstrativo. Amplie com suas próprias explicações. Comandos e exemplos desta lição não são executados pelo site.

## Objetivo
Reconhecer o diretório atual e distinguir caminhos relativos e absolutos.

## Onde o comando começa
O terminal mantém um diretório de trabalho. Um caminho relativo é interpretado a partir dele; um caminho absoluto começa na raiz `/`.

```bash
pwd
ls
ls -l .
```

Exemplo demonstrativo somente de leitura. `pwd` apresenta o diretório atual, `ls` lista entradas e `ls -l .` mostra detalhes do diretório indicado por `.`. `..` representa o diretório pai.

Um nome com espaços precisa de aspas para ser passado como um único argumento, como `ls "anotações de estudo"`, caso essa pasta exista. O shell interpreta os argumentos antes de iniciar o programa.

## Para revisar
O caminho depende do diretório atual? Você está listando a pasta pretendida? Antes de qualquer comando que escreva arquivos, confira sua localização.

## Referências
[GNU Coreutils — pwd, manual](https://man7.org/linux/man-pages/man1/pwd.1.html)

[GNU Coreutils — ls, manual](https://man7.org/linux/man-pages/man1/ls.1.html)
