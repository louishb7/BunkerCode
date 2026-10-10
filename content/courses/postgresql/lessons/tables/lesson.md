# Tabelas e tipos

> Conteúdo introdutório demonstrativo. Amplie com suas próprias explicações. Comandos e exemplos desta lição não são executados pelo site.

## Objetivo
Modelar registros com colunas e tipos explícitos.

## Estrutura antes dos dados
Uma tabela agrupa linhas com a mesma estrutura. Cada coluna define um tipo; restrições podem impedir estados inválidos.

```sql
CREATE TABLE demo_books (
  id integer PRIMARY KEY,
  title text NOT NULL,
  price numeric(8, 2) NOT NULL CHECK (price >= 0)
);
INSERT INTO demo_books (id, title, price)
VALUES (1, 'Caderno de estudo', 18.50);
```

Exemplo demonstrativo para um banco de estudo separado, fora do site. `PRIMARY KEY` identifica cada linha sem duplicidade. `NOT NULL` exige um valor. `numeric(8, 2)` define precisão e escala decimal; o `CHECK` recusa preços negativos.

Escolher tipos faz parte da modelagem. Texto, número e data têm operações distintas. A existência de uma tabela não determina a interface da aplicação nem exige um ORM.

## Para revisar
Qual campo identifica o registro? Que estados precisam ser recusados pelo banco? Evite experimentar no banco de produção.

## Referência
[PostgreSQL — Creating a New Table](https://www.postgresql.org/docs/current/tutorial-table.html)
