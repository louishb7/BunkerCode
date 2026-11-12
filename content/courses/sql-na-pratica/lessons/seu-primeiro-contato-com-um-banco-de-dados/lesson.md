# Seu primeiro contato com um banco de dados

Uma loja precisa consultar quem são seus clientes. Vamos investigar seus dados antes de aprender mais termos. Esta loja e seus registros são fictícios: este é um exemplo inicial para estudo.

Na área de código, clique em **Executar consulta** com o SQL inicial. No celular, use **Código** para abrir a prática e **Lição** para voltar à leitura.

## O que você está vendo?

`customers` é uma **tabela**: um conjunto de registros com a mesma estrutura. Cada **linha** representa um cliente, também chamado de registro. Cada **coluna** descreve uma informação:

- `id`: identificador do cliente; diferencia registros.
- `name`: nome da pessoa.
- `city`: cidade cadastrada.

Abra **Dados disponíveis → Ver registros** para conferir os nomes e valores. Quatro linhas não significam quatro tabelas; são quatro clientes na mesma tabela.

## Pedir informações com SELECT

SQL é uma linguagem para trabalhar com dados. Nesta primeira consulta:

```sql
SELECT * FROM customers;
```

`SELECT` indica o que queremos ver. `FROM` indica a tabela de origem. O `*` pede todas as colunas. O ponto e vírgula encerra a instrução. Executar essa consulta não altera os registros.

Se a pergunta pedir só as cidades, podemos escolher uma coluna:

```sql
SELECT city FROM customers;
```

Experimente essa consulta no editor. Recife aparece mais de uma vez porque há clientes diferentes cadastrados na mesma cidade. O resultado mantém uma linha por registro; ele não junta valores repetidos automaticamente.

Para escolher várias colunas, separe os nomes com vírgula. A ordem que você escreve depois de `SELECT` define a ordem das colunas no resultado. Você não precisa pedir todas as informações para responder uma pergunta específica.

## Desafio: identificar os clientes

Prepare uma lista de todos os clientes com **identificador e nome**, nessa ordem de colunas. A equipe não precisa da cidade nesse relatório. Nenhum cliente deve ficar de fora; a ordem das linhas ainda não importa.

Use os nomes reais das colunas da tabela. **Executar consulta** mostra o resultado e oferece feedback automático neste navegador, mesmo sem conta. O resultado esperado é material didático público. Esse feedback não salva progresso; **Submit · concluir lição**, disponível em sua conta, avalia independentemente no servidor e registra a conclusão quando aprovada.

```bunker-sql
{"kind":"sql","exerciseId":"store-select-columns","version":2}
```

Antes de avançar, explique com suas palavras: qual parte da sua consulta escolhe as informações e qual parte indica sua origem? Escreva seu entendimento próprio no material de estudo; este texto inicial não substitui essa autoria.

## Para consultar depois

[Documentação do PostgreSQL: consultar uma tabela](https://www.postgresql.org/docs/current/tutorial-select.html). A prática usa PGlite, baseado em PostgreSQL, com um subconjunto limitado e dados descartáveis. Recarregar ou reiniciar restaura os registros iniciais.
