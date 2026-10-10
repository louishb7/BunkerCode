# Controllers e rotas

> Conteúdo introdutório demonstrativo. Amplie com suas próprias explicações. Comandos e exemplos desta lição não são executados pelo site.

## Objetivo
Relacionar uma requisição HTTP a um método de controller.

## Uma entrada explícita
Um controller recebe requisições e define como respondê-las. Decorators associam prefixos e métodos HTTP às funções da classe.

```typescript
import { Controller, Get } from "@nestjs/common";

@Controller("books")
export class BooksController {
  @Get()
  list() {
    return [{ title: "Livro demonstrativo" }];
  }
}
```

Em uma aplicação NestJS configurada, registre `BooksController` no array `controllers` de um módulo. O método responderá a `GET /books`; o adaptador transforma a estrutura retornada em JSON. Este exemplo demonstrativo não constitui uma aplicação inteira e não possui persistência.

O prefixo organiza o recurso; o decorator `Get` define a operação. Deixar o controller concentrado no contrato HTTP evita misturar leitura de arquivos, regras de negócio e resposta em uma classe única.

## Para revisar
Qual URL corresponde ao método? O retorno é um dado serializável? Onde você colocaria uma regra usada por várias rotas?

## Referência
[NestJS — Controllers](https://docs.nestjs.com/controllers)
