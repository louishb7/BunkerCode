# SELECT, filtros e ordem

> Conteúdo introdutório demonstrativo. Amplie com suas próprias explicações. Comandos e exemplos desta lição não são executados pelo site.

## Objetivo
Escolher colunas, filtrar linhas e definir uma ordem explícita.

## Consultar com intenção
`SELECT` descreve o resultado desejado. `WHERE` seleciona linhas; `ORDER BY` determina a sequência da saída.

```sql
SELECT title, price
FROM demo_books
WHERE price <= 25.00
ORDER BY price ASC, title ASC;
```

Este exemplo demonstrativo usa a tabela da lição anterior. Retorna somente título e preço dos livros até 25. A ordem considera primeiro o preço e depois o título, resolvendo empates de preço.

Sem `ORDER BY`, não dependa da ordem observada numa execução. A seleção de colunas também evita acoplar o consumidor a todos os campos da tabela.

Uma consulta não altera os registros. Para entender o resultado, separe mentalmente a tabela de origem, o filtro e a projeção de colunas.

## Para revisar
O filtro inclui o limite ou o exclui? A ordem é suficiente para o uso pretendido? Quais colunas o consumidor precisa?

## Referência
[PostgreSQL — Querying a Table](https://www.postgresql.org/docs/current/tutorial-select.html)
