# Imagens e containers

> Conteúdo introdutório demonstrativo. Amplie com suas próprias explicações. Comandos e exemplos desta lição não são executados pelo site.

## Objetivo
Distinguir uma imagem de um container em execução.

## Receita e instância
Uma imagem reúne arquivos e metadados usados para criar containers. O container é uma instância com processos e seu estado de execução.

```bash
docker image ls
docker container ls
```

Exemplo demonstrativo de inspeção de uma instalação Docker. A primeira lista imagens locais; a segunda lista containers em execução. Uma imagem pode existir sem nenhum container ativo, e a mesma imagem pode originar várias instâncias.

Camadas de imagem podem ser compartilhadas. Alterações feitas no container não reescrevem a imagem original. Para dados duráveis, uma aplicação precisa de uma estratégia explícita de armazenamento.

## Para revisar
Você está observando a imagem ou a instância? O estado precisa sobreviver ao fim do processo? Isolamento depende da configuração: a simples presença de Docker não garante segurança para código não confiável.

## Referência
[Docker — What is an image?](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-an-image/)
