# Encontrando o que importa

## WHERE escolhe linhas

`SELECT` escolhe colunas; `WHERE` acrescenta uma condição para selecionar linhas. Esta consulta procura os nomes e as cidades dos clientes de Olinda:

```sql
SELECT name, city FROM customers WHERE city = 'Olinda';
```

## ORDER BY organiza o resultado

`ORDER BY` ordena as linhas pela coluna indicada. `ASC` segue a ordem crescente; `DESC`, a decrescente:

```sql
SELECT name, city FROM customers ORDER BY name ASC;
```

Você pode combinar os dois: escreva `WHERE` antes de `ORDER BY`. Nas tarefas, filtre por Recife, ordene por nome e depois combine as duas operações.

```bunker-sql
{"kind":"sql-task-sequence","tasks":[{"taskId":"filter-customers-by-city","exerciseId":"store-customers-recife","version":3},{"taskId":"sort-customer-records","exerciseId":"store-sort-customers","version":2},{"taskId":"combine-filter-and-sort","exerciseId":"store-filter-sort","version":3}]}
```
