# Seu primeiro contato com um banco de dados

Uma loja guarda seus clientes em uma tabela chamada `customers`. Vamos consultar esses dados antes de aprender mais termos. A loja e os registros são fictícios: este é um exemplo inicial para estudo.

Na área **Código**, há três tarefas. Comece executando o SQL inicial:

```sql
SELECT * FROM customers;
```

O resultado mostra os clientes cadastrados. `SELECT` indica o que queremos ver; `FROM` indica a tabela de origem. O `*` pede todas as colunas. O ponto e vírgula encerra a instrução. Essa consulta não altera os registros.

## Ler uma tabela

Cada **linha** representa um cliente, também chamado de registro. Cada **coluna** descreve uma informação:

- `id`: identificador do cliente.
- `name`: nome da pessoa.
- `city`: cidade cadastrada.

Abra **Dados disponíveis → Ver registros** para conferir a tabela. Quatro linhas representam quatro clientes, não quatro tabelas. No celular, use **Código** para praticar e **Lição** para voltar à leitura.

## Escolher as informações

Nem sempre precisamos de todas as colunas. Por exemplo, para consultar apenas as cidades:

```sql
SELECT city FROM customers;
```

Recife aparece mais de uma vez porque clientes diferentes moram na mesma cidade. Selecionar uma coluna não junta valores repetidos automaticamente.

Para escolher várias colunas, separe seus nomes com vírgulas. A ordem escrita depois de `SELECT` define a ordem das colunas no resultado. A tabela continua a mesma; muda o que pedimos para ver.

## Três tarefas para praticar

Na área de código, consulte a tabela inteira, selecione apenas os nomes e depois prepare uma lista com identificadores e nomes. As instruções de cada tarefa aparecem ao lado do editor.

```bunker-sql
{"kind":"sql-task-sequence","tasks":[{"taskId":"inspect-all-customers","exerciseId":"store-all-customers","version":1},{"taskId":"select-customer-names","exerciseId":"store-customer-names","version":1},{"taskId":"select-customer-identifiers","exerciseId":"store-select-columns","version":2}]}
```

**Executar consulta** mostra o resultado e verifica a tarefa automaticamente neste navegador, mesmo sem conta. Ao acertar, a próxima tarefa fica ativa; as anteriores continuam acessíveis. Ao terminar as três, use **Continuar para a próxima lição**. Esses acertos são formativos e não registram conclusão verificada na conta.

Antes de seguir, explique com suas palavras: o que escolhe as colunas e o que indica a tabela? Qual é a diferença entre selecionar duas colunas e obter duas linhas? Registre seu entendimento próprio no material de estudo.

## Para consultar depois

[Documentação do PostgreSQL: consultar uma tabela](https://www.postgresql.org/docs/current/tutorial-select.html). A prática usa PGlite, baseado em PostgreSQL, com dados descartáveis. Reabrir a lição inicia uma nova sessão de tarefas.
