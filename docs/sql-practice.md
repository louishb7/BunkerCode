# Prática SQL nas lições

## Estado e fronteira de confiança

**IMPLEMENTADO:** PGlite em um Web Worker por interação, com dados fictícios descartáveis em memória. Estudantes exploram tabelas, escrevem SQL, executam e pedem feedback local. Consultas nunca são enviadas ao PostgreSQL da aplicação. Não há endpoint SQL, nova autenticação ou persistência SQL.

**DECIDIDO:** `/sql` e o link SQL do cabeçalho continuam públicos como vitrine temporária para testar a capacidade das lições. Não são um novo produto de treinamento.

Uma resposta correta no navegador **não autoriza conclusão persistente**. A interação SQL não chama Run/Submit nem recebe callback de conclusão. O leitor conserva visitas e preferências existentes, mas não oferece conclusão de uma atividade SQL pelo fluxo editorial sem exercício. O futuro progresso SQL exige uma decisão explícita de validação no servidor; não basta enviar `correct: true` do navegador.

## Configuração e autoria

As definições confiáveis ficam em `apps/frontend/src/sql-lab/exercise-catalog.ts` e nos arquivos de atividades. Cada `SqlExercise` tem `id`, `version`, título, objetivo, instruções, SQL inicial, preparação determinística, metadados das tabelas e limites. A preparação pertence ao código revisado do autor, nunca ao visitante.

Uma lição referencia uma definição registrada usando um bloco JSON de topo:

````markdown
```bunker-sql
{"kind":"sql","exerciseId":"store-customers-recife","version":1}
```
````

`packages/content` valida estrutura, identificador, versão positiva e unicidade; campos adicionais são recusados. SQL e marcador de prática JavaScript não podem compartilhar a mesma lição. O frontend resolve identidade e versão no catálogo confiável e informa referências indisponíveis. Um exercício JavaScript externo associado à mesma lição também impede montar SQL.

O leitor apresenta contexto no artigo e `SqlInteraction` no `StudySplit` existente, incluindo alternância Lição/Código no celular. O editor SQL acompanha as seis tonalidades do leitor. O Studio permite editar a referência na fonte Markdown, preserva o bloco no roundtrip visual e executa a mesma interação na Prévia. Não há formulário visual para criar datasets/oráculos: novas definições ainda exigem código revisado e build. Markdown SQL comum permanece texto inerte; carregar a lição não inicializa o banco. Apenas executar, verificar ou abrir registros inicia o Worker.

A amostra `docs/examples/sql-select-pilot.md` é original, técnica e não publicada. Os testes a copiam somente para a fixture temporária supervisionada. Nenhum curso SQL é acrescentado ao catálogo nem ao manifesto de publicação; o Módulo 00 JavaScript permanece intacto.

## Sessão e exploração

A sessão usa `id + version`. Objetos recriados pelo React não apagam editor, dados ou feedback. A configuração é capturada uma vez por sessão; **qualquer alteração real da definição deve incrementar `version`**. Trocar identidade/versão ou sair da interação desmonta e descarta o Worker. Alterar tema mantém a sessão. Consultas e alterações não são salvas: sair ou recarregar perde a sessão.

**Ver registros** usa o mesmo motor e somente nomes de tabelas presentes nos metadados confiáveis. Mostra até dez linhas reais, nomes de colunas, tipos e chaves configuradas. Não altera a consulta, não verifica resposta nem limpa feedback válido. A região tem rolagem horizontal e foco de teclado; a seção pode ser recolhida no celular. Tabelas vazias preservam cabeçalhos. Os metadados são fornecidos pelo autor, não inferidos como uma ferramenta de administração.

**Cancelar e descartar** e **Reiniciar banco** terminam o Worker. A próxima ação recria o dataset original; reiniciar preserva o texto do editor. Erros SQL comuns permitem correção na mesma sessão. Falha do Worker, mensagem inválida ou prazo excedido descartam o banco e permitem nova inicialização. IDs de solicitações e gerações da interface impedem respostas obsoletas de sobrescrever o estado atual.

Os exemplos concedem 60 segundos à inicialização e 15 segundos a cada operação posterior. O limite de linhas limita a transferência, não custo de consulta, tamanho de célula, CPU ou memória. O primeiro uso baixa arquivos WebAssembly consideráveis. Worker e PGlite local **não são um sandbox geral de segurança**, nem garantem cotas rígidas. Não use dados reais ou segredos nos datasets.

## Referências que orientaram as decisões

- [SQLBolt — SELECT](https://sqlbolt.com/lesson/select_queries_introduction) e [UPDATE](https://sqlbolt.com/lesson/updating_rows): explicação curta seguida de tarefa. A aplicação aqui separa explicitamente executar de verificar.
- [SQLZoo — SELECT básico](https://sqlzoo.net/wiki/SELECT_basics): dados visíveis antes das perguntas. Fundamenta a prévia de registros reais, sem copiar dados ou enunciados.
- [PostgreSQL Exercises](https://www.pgexercises.com/questions/basic/): categorias práticas sobre um dataset compartilhado, incluindo modificações. Orienta reaproveitar a loja fictícia em desafios progressivos.
- [Select Star SQL](https://selectstarsql.com/): continuidade entre capítulos e investigação sobre dados. Orienta manter contexto editorial e prática juntos.
- [DataLemur](https://datalemur.com/sql-tutorial/intro-to-sql): distingue níveis básico, intermediário e avançado e inclui exercícios executáveis. A progressão abaixo é uma proposta própria.
- [SQL Practice](https://www.sql-practice.com/): endereço consultado, mas sem conteúdo legível pela ferramenta; nenhuma conclusão de comportamento foi derivada dele.
- [PGlite API](https://pglite.dev/docs/api), [início](https://pglite.dev/docs/) e [Vite/bundler](https://pglite.dev/docs/bundler-support): instância em memória, protocolo de consulta única, fechamento e configuração de build. A integração Vite existente foi preservada.

**HIPÓTESE:** prática livre separada, contínua ou com exercícios gerados pode ser avaliada futuramente. Não foi implementada nem aprovada.

## Modos e verificação

`mode: "query"` declara `expectedQuery` e, opcionalmente, `orderMatters`. Executar apenas consulta; verificar executa a consulta atual e compara nomes/ordem de colunas e valores de todas as linhas. Duplicatas contam, NULL é preservado e qualquer truncamento reprova. A ordem das linhas só importa quando a atividade a exige. As consultas são envolvidas em uma subconsulta SELECT e executadas com transação somente leitura. Há limite de 100 linhas nos exemplos.

`mode: "mutation"` declara `expectedSql`, composto por operações confiáveis do autor sobre o dataset inicial. A inicialização cria uma referência independente, aplica essas operações, captura todas as tabelas declaradas e fecha a referência. Só então cria a sessão do aluno, com o dataset original. Não mantém dois bancos simultâneos nem coloca o oráculo no banco do estudante. Configurações com tabelas públicas não declaradas ou estado esperado maior que o limite são recusadas.

**Executar comando** aceita um único SELECT, INSERT, UPDATE ou DELETE. **Verificar estado** recebe uma mensagem própria, lê o estado atual e o compara à referência, sem executar o texto do editor. Todas as linhas e tabelas do dataset são comparadas, incluindo registros que deveriam permanecer iguais. Modificações se acumulam; executar INSERT outra vez pode adicionar outra linha ou gerar erro de chave, e verificar nunca repete esse INSERT. Reiniciar restaura os dados iniciais e preserva o texto do editor. A prévia é invalidada depois de uma execução; **Ver registros** atualiza os dados reais sem alterar o feedback.

O protocolo estendido de `query()` do PGlite recusa múltiplos comandos. Para modificações, PostgreSQL primeiro planeja a instrução com EXPLAIN sem ANALYZE, dentro da transação, evitando comandos de controle transacional. Um papel local sem propriedade das tabelas e sem CREATE/TEMP recebe somente SELECT/INSERT/UPDATE/DELETE nas tabelas declaradas. Tags não suportadas causam rollback. Isso corrige inclusive CREATE TABLE AS, cuja tag pode ser SELECT: apenas inspecionar a tag não seria suficiente. Não há parser por regex. [EXPLAIN no PostgreSQL](https://www.postgresql.org/docs/current/sql-explain.html) documenta a diferença entre planejar e executar com ANALYZE.

Essas são restrições funcionais para prática descartável, **não uma garantia contra SQL hostil ou funções arbitrárias do PostgreSQL**. O processo é local, sem dados reais, credenciais ou acesso ao banco do backend. Resultados com RETURNING são limitados antes da transferência ao componente, mas o motor pode materializar mais dados; tamanho de célula e memória não possuem cotas garantidas. Sequências, triggers, alterações de schema e administração não fazem parte do contrato didático atual; exemplos usam IDs explícitos e tabelas pequenas determinísticas.

## Coleção de demonstração e proposta pedagógica

O seletor temporário de `/sql` oferece seis configurações sobre a mesma loja fictícia, sem duplicar o motor:

| Atividade          | Objetivo observável               | Oráculo                                   |
| ------------------ | --------------------------------- | ----------------------------------------- |
| Clientes de Recife | Filtrar as linhas de uma cidade   | Resultado completo, sem ordem obrigatória |
| Escolher colunas   | Retornar somente id e nome        | Nomes/ordem de colunas e todas as linhas  |
| Filtrar e ordenar  | WHERE e ordem Z a A               | Resultado completo com ordem das linhas   |
| Clientes e pedidos | Investigar relação com JOIN       | Resultado com duplicatas preservadas      |
| Resumir pedidos    | COUNT, SUM e GROUP BY             | Quantidade e total por cliente            |
| Corrigir cidade    | UPDATE apenas no cliente indicado | Estado de todas as tabelas                |

**DECIDIDO — proposta para revisão editorial:** trabalhar com explicação breve → demonstração → exploração livre → desafio → feedback → aplicação independente e justificativa escrita. Uma lição pode reutilizar o dataset anterior, mas cada sessão começa de uma preparação determinística; não há continuidade implícita dos dados alterados entre lições.

- **Fundamentos básicos:** reconhecer tabelas, linhas, colunas e chaves; selecionar informações; filtrar e ordenar; investigar NULL; resumir um conjunto simples; praticar INSERT/UPDATE/DELETE com inspeção antes/depois e reset. Exercícios pedem resultados observáveis e explicação das escolhas, sem depender de quizzes.
- **SQL intermediário:** resolver perguntas entre tabelas com JOIN; agrupamento e HAVING; subconsultas, CTEs e CASE; compreender relacionamentos, modelagem básica e constraints; construir pequenos relatórios e detectar alterações indevidas nos dados.
- **HIPÓTESE de trilha avançada:** funções de janela, consultas complexas, planos, índices, transações, desempenho e concorrência. Exigiriam objetivos e limites de execução próprios; este trabalho não implementa essas aulas nem autoriza um curso adicional.

**PENDENTE:** curadoria autoral de uma trilha SQL real, interface visual de definição de atividades e decisão de confiança para progresso. A amostra e a coleção provam capacidades técnicas; não constituem um currículo publicado ou aprovação pedagógica definitiva. **DESCARTADO neste escopo:** curso completo automático, geração ilimitada, CMS SQL paralelo e execução SQL no backend. **INCERTO:** custo de inicialização em dispositivos mais fracos; os testes locais não representam todos os navegadores e hardwares.
