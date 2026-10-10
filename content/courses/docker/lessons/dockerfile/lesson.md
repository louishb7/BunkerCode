# Um Dockerfile pequeno

> Conteúdo introdutório demonstrativo. Amplie com suas próprias explicações. Comandos e exemplos desta lição não são executados pelo site.

## Objetivo
Ler as instruções que constroem uma imagem para uma aplicação Node.js.

## Construir uma imagem
Um Dockerfile declara etapas de construção. O contexto de build fornece os arquivos copiados para a imagem.

```dockerfile
FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.mjs ./
USER node
CMD ["node", "server.mjs"]
```

Exemplo demonstrativo: pressupõe uma aplicação com esses arquivos e um lockfile npm coerente. `RUN` instala dependências durante o build. `CMD` define o comando padrão do container. Copiar os metadados antes do código permite reutilizar a camada de dependências quando só a aplicação muda.

`USER node` evita executar a aplicação como root dentro do container. Isso não substitui limites de recursos, bloqueio de rede ou revisão das dependências. Nunca copie credenciais para a imagem.

## Para revisar
Quais arquivos entram no contexto? O lockfile é válido? O comando final inicia o processo pretendido?

## Referência
[Docker — Writing a Dockerfile](https://docs.docker.com/get-started/docker-concepts/building-images/writing-a-dockerfile/)
