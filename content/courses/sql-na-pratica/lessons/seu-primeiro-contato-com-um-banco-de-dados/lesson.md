# Seu primeiro contato com um banco de dados

Uma loja guarda seus clientes em uma tabela chamada `customers`. Vamos consultar esses dados antes de aprender mais termos. A loja e os registros são fictícios: este é um exemplo inicial para estudo.

As tarefas abaixo começam com esta consulta:

```sql
SELECT * FROM customers;
```

O resultado mostra os clientes cadastrados. `SELECT` indica o que queremos ver; `FROM` indica a tabela de origem. O `*` pede todas as colunas. O ponto e vírgula encerra a instrução. Essa consulta não altera os registros.

Para escolher uma coluna, troque `*` por seu nome: `SELECT name FROM customers;`. Para escolher duas, separe-as por vírgula: `SELECT id, name FROM customers;`.

```bunker-sql
{"kind":"sql-task-sequence","tasks":[{"taskId":"inspect-all-customers","exerciseId":"store-all-customers","version":1},{"taskId":"select-customer-names","exerciseId":"store-customer-names","version":1},{"taskId":"select-customer-identifiers","exerciseId":"store-select-columns","version":2}]}
```
