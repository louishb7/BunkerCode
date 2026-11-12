# Encontrando o que importa

A lista completa ajuda a conhecer a loja. Agora a equipe quer investigar os clientes de outras cidades para preparar uma ação de atendimento. Como procurar só as linhas necessárias e apresentá-las em uma ordem útil?

Abra **Dados disponíveis** e veja os registros de `customers`. O dataset é o mesmo da lição anterior, recriado do início nesta sessão. Ainda não vamos relacionar tabelas nem alterar dados.

## WHERE escolhe linhas

`SELECT` escolhe colunas; `WHERE` acrescenta uma condição para selecionar linhas. Por exemplo, esta consulta procura o registro de um identificador específico:

```sql
SELECT name, city FROM customers WHERE id = 3;
```

Experimente trocar o identificador. Se nenhuma linha satisfizer a condição, o resultado fica vazio, mas mantém suas colunas: isso não significa que ocorreu um erro SQL.

A comparação depende do tipo do valor. Números, como `3`, não precisam de aspas. Textos, como `'Olinda'`, usam aspas simples. Nomes de cidades precisam corresponder ao cadastro; `'recife'` e `'Recife'` são textos diferentes nesta comparação.

- `=`: é igual a esse valor?
- `<>`: é diferente desse valor?
- `>` e `<`: é maior ou menor?
- `>=` e `<=`: é maior/menor ou igual?

Por exemplo, `WHERE id > 2` procura identificadores maiores que dois. A condição vem depois do nome da tabela. Investigue o resultado antes de mudar a pergunta.

## ORDER BY organiza o resultado

A ordem de linhas sem `ORDER BY` não é uma promessa do banco. Para pedir nomes em ordem crescente:

```sql
SELECT name FROM customers ORDER BY name ASC;
```

`ASC` significa ordem crescente: de A a Z para esses nomes. `DESC` inverte a direção: de Z a A. A ordenação não muda os dados armazenados, só a apresentação do resultado.

É possível combinar um filtro com uma ordenação. A estrutura fica: `SELECT` com as colunas, `FROM` com a tabela, `WHERE` com a condição e `ORDER BY` com a coluna e a direção. Uma condição reduz as linhas; uma ordenação organiza as que restaram.

## Desafio: olhar para fora de Recife

A equipe quer uma lista de clientes que **não moram em Recife**. Retorne apenas **nome e cidade**, nessa ordem de colunas, e organize pelo **nome em ordem decrescente**, de Z a A.

Observe as cidades reais no explorador. Monte sua condição de diferença e escolha a direção da ordenação. Um resultado com as pessoas certas, mas sem a ordem solicitada, ainda não atende ao relatório.

```bunker-sql
{"kind":"sql","exerciseId":"store-filter-sort","version":2}
```

**Executar consulta** mostra os dados e compara automaticamente o resultado neste navegador, mesmo sem conta. Confira tanto o filtro quanto a ordem das linhas. O resultado esperado é material didático público; acertar localmente não salva progresso. **Submit · concluir lição** avalia independentemente no servidor e registra a conclusão quando aprovada. Se esse serviço estiver indisponível, a prática local continua disponível.

Depois do desafio, explique: o que mudaria se você removesse `WHERE`? E se trocasse apenas `DESC` por `ASC`? Registre sua justificativa, em vez de guardar somente uma consulta que passou.

## Para consultar depois

[Consulta e filtro no PostgreSQL](https://www.postgresql.org/docs/current/tutorial-select.html) e [ordenação de linhas](https://www.postgresql.org/docs/current/queries-order.html). Esta lição trabalha com valores preenchidos; comparações com `NULL` serão outro assunto, e não devem ser presumidas a partir do operador de diferença.
