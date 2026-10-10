# Providers e dependências

> Conteúdo introdutório demonstrativo. Amplie com suas próprias explicações. Comandos e exemplos desta lição não são executados pelo site.

## Objetivo
Injetar uma dependência e separar a regra da entrada HTTP.

## Colaboração entre classes
Um provider registrado no módulo pode ser oferecido a outras classes pelo container de injeção do NestJS.

```typescript
import { Controller, Get, Injectable, Module } from "@nestjs/common";

@Injectable()
class BooksService {
  list() { return [{ title: "Livro demonstrativo" }]; }
}
@Controller("books")
class BooksController {
  constructor(private readonly books: BooksService) {}
  @Get()
  list() { return this.books.list(); }
}
@Module({ controllers: [BooksController], providers: [BooksService] })
export class BooksModule {}
```

Exemplo demonstrativo de um módulo que pode ser importado pelo módulo raiz. O constructor declara uma dependência; NestJS cria e fornece o serviço registrado. Não é preciso instanciá-lo manualmente no controller.

O serviço contém a operação e o controller adapta sua chamada à rota. Criar um provider é útil quando existe uma responsabilidade concreta; não transforme cada pequena expressão em uma camada.

## Para revisar
A dependência foi registrada? O consumidor depende de uma operação clara ou precisa conhecer detalhes internos?

## Referência
[NestJS — Providers](https://docs.nestjs.com/providers)
