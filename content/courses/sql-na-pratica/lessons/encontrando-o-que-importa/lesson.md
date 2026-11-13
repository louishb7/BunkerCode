# Encontrando o que importa

Você já consegue escolher colunas. Agora a equipe da loja precisa encontrar certos clientes e organizar os registros. Vamos acrescentar condições e ordenação às consultas.

O dataset é o mesmo da lição anterior, carregado do início. Abra **Dados disponíveis** para investigar `customers`. Ainda não vamos relacionar tabelas nem alterar registros.

## WHERE escolhe linhas

`SELECT` escolhe colunas; `WHERE` acrescenta uma condição para selecionar linhas. Esta consulta procura os nomes e as cidades dos clientes de Olinda:

```sql
SELECT name, city FROM customers WHERE city = 'Olinda';
```

Textos usam aspas simples. O valor deve corresponder ao cadastro: `'Recife'` e `'recife'` são textos diferentes nessa comparação. Números, como em `WHERE id > 2`, não precisam de aspas.

- `=`: igual ao valor.
- `<>`: diferente do valor.
- `>` e `<`: maior ou menor.
- `>=` e `<=`: maior/menor ou igual.

Uma consulta sem linhas pode estar correta como SQL: significa que nenhum registro satisfez a condição. Confira a pergunta da tarefa antes de interpretar esse resultado como resposta certa.

## ORDER BY organiza as linhas

Sem `ORDER BY`, a ordem das linhas não é uma promessa do banco. Podemos pedir uma ordem explicitamente:

```sql
SELECT city FROM customers ORDER BY city DESC;
```

`ASC` pede ordem crescente; `DESC`, decrescente. Para os nomes deste dataset, isso corresponde a A–Z e Z–A. A ordenação muda a apresentação, não os registros armazenados.

Para combinar os conceitos, coloque `WHERE` depois da tabela e `ORDER BY` depois da condição. Primeiro escolha as linhas necessárias; depois defina como apresentá-las.

## Três tarefas para investigar

Filtre os clientes de uma cidade, organize todos os registros por nome e, por fim, combine um filtro com ordem decrescente. Na última tarefa, as pessoas certas na ordem errada ainda não atendem ao pedido.

```bunker-sql
{"kind":"sql-task-sequence","tasks":[{"taskId":"filter-customers-by-city","exerciseId":"store-customers-recife","version":2},{"taskId":"sort-customer-records","exerciseId":"store-sort-customers","version":1},{"taskId":"combine-filter-and-sort","exerciseId":"store-filter-sort","version":2}]}
```

**Executar consulta** verifica a tarefa ativa neste navegador. Não é preciso entrar na conta nem esperar uma avaliação remota. Acertar mantém a tarefa concluída nesta sessão e prepara a próxima; esses acertos não registram conclusão verificada da lição. Ao terminar, volte ao curso para revisar seu percurso.

Depois, explique: o que muda ao remover `WHERE`? E ao trocar somente `DESC` por `ASC`? Registre sua justificativa, além da consulta que funcionou.

## Para consultar depois

[Consulta e filtro no PostgreSQL](https://www.postgresql.org/docs/current/tutorial-select.html) e [ordenação de linhas](https://www.postgresql.org/docs/current/queries-order.html). Aqui trabalhamos com cidades preenchidas. Comparações com `NULL` exigem outro raciocínio e não devem ser presumidas a partir de `<>`.
