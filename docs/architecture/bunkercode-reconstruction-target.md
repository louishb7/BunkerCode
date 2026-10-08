# BunkerCode — arquitetura de destino para reconstrução

> Documento histórico. A consolidação de 2026-10-08 substitui decisões incompatíveis. Referências ativas: [arquitetura atual](overview.md) e [autoria](../authoring.md). Paths/comandos abaixo descrevem a rodada original, não a árvore atual.

Data: 2026-10-07. Estado: **direção adotada pela missão de implementação das fases 0–4; resultados em [first-learning-flows.md](../implementation/first-learning-flows.md)**.

Recomendação: manter o repositório físico do BunkerLab, reconstruir o produto em torno de **atividades e tentativas de aprendizagem**, começar com uma previsão confrontada com uma request real e provar a fronteira com uma segunda atividade de código + testes. Duas aplicações, conteúdo versionado e SQLite local bastam inicialmente. Analyzer, Git e execução de sistemas maiores entram por consumidor concreto.

A rodada de arquitetura que originou este documento alterou somente este documento. Não altera código, README, AGENTS, dependências ou dados; não corrige bugs, remove arquivos, faz commit ou push. A tese específica do pedido substitui, para esta proposta, as restrições antigas “não curso” e “edição apenas externa”. Permanecem evidência real, simplicidade, proteção do cenário canônico e separação entre autoria e estudo.

## Base documental e proveniência

Os dois relatórios foram lidos integralmente antes das decisões. Nesta rodada, resultados de testes e bugs são **evidência das auditorias**, não revalidação do código. A inspeção local adicional limitou-se à localização/proveniência, inventário físico e trecho da fixture para orientar o mapeamento; não é uma terceira auditoria.

| Referência | Documento utilizado | Base auditada | Situação verificada nesta rodada |
|---|---|---|---|
| L | [Auditoria do legado](/home/henrique/.codex/worktrees/6cd5/BunkerCode/docs/audits/bunkercode-legacy-demolition.md) | `2810761948da038a0c2007cc6bde0e25b988a167` | Única cópia encontrada; arquivo ignorado, fora do histórico atual |
| B | [Auditoria do BunkerLab](/home/henrique/.codex/worktrees/6cd5/BunkerCode/docs/audits/bunkerlab-reconstruction-audit.md) | `46633e1a6b542b61a35e85a9b20e343cf2aa9866` | Única cópia encontrada; arquivo não versionado no worktree `ce17` |

A busca incluiu `/home/henrique/Projetos` e `/home/henrique/.codex/worktrees`, arquivos ignorados e ocultos, excluindo dependências e `.git`; também foram conferidos os worktrees registrados e o histórico Git disponível para o relatório B. Não foi encontrada cópia preservada mais recente no checkout principal ou em outro worktree. Portanto B é a fonte de trabalho atual, **ainda sem preservação canônica em Git**. Não se presume busca em backups externos ou refs remotas não disponíveis.

Hashes SHA-256 dos documentos efetivamente lidos:

```text
L  885c5015274d3faa2976d1e8c1558b03d3ac35597571c4796417d85f1857902b
B  685a765fc9be677674b6d78c40c5ed6a2288b86575647b4f8a4d0be4aa15cc75
```

Destino desta proposta: `/home/henrique/.codex/worktrees/6cd5/BunkerCode`, HEAD `46633e1a6b542b61a35e85a9b20e343cf2aa9866`, detached e inicialmente limpo. O checkout principal do mesmo Git é `/home/henrique/Projetos/BunkerCode`. Manter esse Git não significa herdar sua arquitetura. Os links locais acima precisam ganhar equivalentes versionados na fase 0; apagar/arquivar `ce17` antes disso pode perder o relatório B.

Nas referências seguintes, `L §6` e `B §5` apontam às seções desses documentos. Recomendações aqui são decisões propostas; hipóteses pedagógicas permanecem sujeitas a uso real.

## 1. Tese do produto

> Estou aprendendo backend seriamente e transformando meu caminho numa plataforma aberta para outras pessoas desenvolverem junto comigo.

O autor é o primeiro usuário. TypeScript, Node.js, NestJS e PostgreSQL delimitam o estudo inicial. O produto deve ajudar a recuperar sintaxe, ler código, prever, escrever, depurar, testar e construir, com explicação sustentada por evidência.

A abertura inicial significa conteúdo e código compartilháveis. Não implica executar código de terceiros em um servidor público. A primeira distribuição é local, para exercícios confiáveis e modificações do próprio autor.

Prática curta, revisão, cursos, investigações e projetos podem compartilhar atividades. Learn/Practice/Lab/Build/Analyze são formas de encontrar e usar conteúdo, sem corresponder a cinco subsistemas.

## 2. Norte da experiência

A experiência recorrente é:

```text
contexto curto / pergunta
          |
          v
resposta, previsão ou código do aluno
          |
          v
execução, teste, análise ou comparação curada
          |
          v
evidência -> comparação -> explicação -> nova tentativa
```

Nem todo percurso executa código; nem toda execução exige previsão textual. Num exercício de sintaxe, escrever antes de testar satisfaz a ação inicial. Leitura pode terminar em comparação com comentário curado. Um projeto pode envolver muitos testes, análises e revisões.

Cursos, lições, código editável e testes são **direção concreta**, embora não sejam todos implementados no primeiro incremento. O diferencial provável é conseguir aprofundar uma dúvida até fonte, resultado de teste, request, estado e análise relevante, sem tornar a instrumentação a tela inicial de todo exercício.

O critério de produto não será quantidade de painéis nem quantidade de testes verdes. Será observar o autor formular uma ideia, agir, confrontar evidência e modificar sua resposta ou código com justificativa.

## 3. Lições das plataformas de referência

Consulta restrita a fontes oficiais em 2026-10-07, sem avaliar eficácia educacional nem auditar sua arquitetura. A coluna de aplicação é **inferência de design para BunkerCode**, não descrição dos sistemas internos dessas plataformas.

| Referência observada | Lição aplicada aqui | O que não decorre dela |
|---|---|---|
| Boot.dev apresenta trilhas, cursos, prática de código e projetos ([página oficial](https://www.boot.dev/)). | Dar sequência ao estudo e fazer a ação ocupar o centro da lição. | Não copiar sua gamificação, métricas comerciais ou tutor. |
| Codédex apresenta cursos interativos, tutoriais de projetos e editor na plataforma ([página oficial](https://www.codedex.io/?trk=article-ssr-frontend-pulse_little-text-block)). | Aproximar conteúdo curto e escrita de código; permitir crescer até projetos. | Não reproduzir sua estética nem comunidade como requisito. |
| Exercism documenta resolução por editor online ou ferramentas locais e distingue exercícios práticos ([resolução](https://exercism.org/docs/using/solving-exercises), [prática](https://exercism.org/docs/building/tracks/practice-exercises)). | A atividade e seus critérios podem sobreviver à troca do editor; testes sustentam iteração. | Não adotar sua infraestrutura de runners ou progressão inteira. |
| freeCodeCamp mantém conteúdo curricular em arquivos do repositório ([guia de contribuição](https://contribute.freecodecamp.org/how-to-work-on-coding-challenges/)). | Conteúdo estruturado pode existir antes de um CMS visual. | Não importar seu schema, taxonomia ou escala de plataforma. |

A home de Codédex e a página `/learn` de freeCodeCamp tiveram extração limitada; os links específicos acima sustentam apenas as observações registradas. Não foram feitos testes de uso nessas plataformas. A escolha arquitetural principal vem da experiência desejada e dos dois relatórios locais.

## 4. Síntese das auditorias

| Evidência histórica | Consequência para a arquitetura nova |
|---|---|
| L §§5–7: imports, resolução TS, consultas, SCC/BFS e detectores têm valor independente de Explorer/OBSERVE. | Preservar capacidades e contraexemplos, extrair apenas operações consumidas por uma atividade. |
| L §6: ciclo representante não contém necessariamente toda SCC; cache fica desatualizado após mutação. | Resultado de ferramenta não é gabarito infalível; correção e regressão precedem seu uso avaliativo. |
| L §§5, 9: resolução tem limites; fixtures e testes sustentam o conhecimento melhor que representações visuais. | Retirar gramática antiga sem perder fixture, proveniência, confidence e coverage. |
| B §§3–5: processo separado, identidade do código e request/estado reais são capacidades fortes. | Reimplementar a menor execução necessária preservando esses comportamentos. |
| B §§5, 7–9: Run é técnica; Activity atual é request transitória; hints não avaliam compreensão. | Introduzir semântica pedagógica própria e separar resultado técnico de feedback. |
| B §§2, 10–11: Workbench, HTTP concorrente, Git e OrderDesk atravessam UI e protocolo. | Reescrever experiência e fronteiras, sem reorganizar os mesmos contratos em novos nomes. |
| B §6: SQLite local funciona para metadata selecionada; persistência mistura conteúdo e execução. | Manter tecnologia candidata, substituir ownership/schema, reter somente dados úteis. |
| B, achados R1/R2: timeout não encerra mutação; um E2E de restart falhou por conflito, rerun passou. | Não reutilizar lifecycle problemático por conveniência; aplicar gates condicionais explícitos. |

**Saúde histórica:** L registra 136 testes aprovados e cinco skips, com execução direta após falha ambiental do pnpm. B registra lint/typecheck/build e 21 testes API aprovados, mas E2E completo com uma falha intermitente. Nada aqui transforma esses resultados em validação da arquitetura proposta.

## 5. Princípios arquiteturais

1. **Conteúdo pede uma ação; instrumentos respondem a uma pergunta concreta.** Não iniciar processo/analyzer ao simplesmente abrir toda lição.
2. **Pensar ou escrever antes de revelar.** Guardar a submissão antes de produzir resultado; disponibilizar hints por solicitação.
3. **Resultado real e origem identificável.** Associar resultado à fonte submetida, à fixture, às condições e ao avaliador utilizado.
4. **Fronteiras sem cerimônia.** Funções e arquivos com ownership claro antes de packages, registries, interfaces universais ou motores.
5. **Complexidade local ao exercício.** HTTP, SQL, worker, concorrência e estado de estoque não pertencem ao modelo comum de tentativa.
6. **Conteúdo canônico protegido.** O aluno edita cópia; executar não altera o template original nem o control plane por fluxo normal.
7. **Falha da ferramenta não é erro conceitual do aluno.** Timeout, unsupported, resultado incompleto e falha de teste são estados distintos.
8. **Preservar conhecimento não ativa dependência.** Histórico, fixtures e relatórios sobrevivem mesmo sem imports no novo app.
9. **Instrumentação tem limites.** Não inventar eventos, causalidade ou entendimento para preencher lacunas.
10. **O segundo exercício testa o desenho.** Uma função TS com testes deve caber sem inventar servidor, Git ou Run histórica.

## 6. Modelo pedagógico e de conteúdo

### O que é domínio, organização e hipótese

| Conceito | Natureza | Decisão inicial |
|---|---|---|
| LearningActivity | Proposta de ação com critério e feedback possíveis | Definição versionada em arquivos; não tabela mutável de catálogo. |
| Attempt | Interação do aluno com essa proposta | Registro durável mínimo; contém ação submetida e retorno recebido. |
| Lesson | Unidade editorial: contexto, exemplos e atividades | Distinguir semanticamente; primeiro contexto pode morar no próprio arquivo da atividade. Separar arquivo quando houver sequência de curso. |
| Course | Percurso pedagógico ordenado | Introduzir manifesto de lições na primeira sequência real, sem serviço/CMS. |
| Track | Agrupamento orientado a objetivo entre cursos | Adiar até haver mais de um curso que precise dessa organização. |
| Module / Chapter | Agrupamento editorial dentro do curso | Cabeçalhos/seções do manifesto inicialmente; identidade própria só com uso real. |
| Prompt / Task | Enunciado da ação | Campo/conteúdo, não entidade. |
| Submission | Fotografia do que foi enviado em um momento | Valor dentro da Attempt; congela previsão/código para não comparar resultado antigo com rascunho novo. |
| Step | Possível roteiro | Sem entidade ou state machine de aulas; o fluxo inicial é explícito na atividade. |
| Evaluation / Feedback | Interpretação do resultado segundo critérios | Valor produzido por função específica e versionada; sem serviço universal. |
| Hint usage | Ajuda solicitada | IDs das pistas vistas na tentativa quando houver pistas; não engine de ajuda. |
| Evidence reference | Ligação entre interpretação e suporte | Referências pequenas ao resultado pertencente ao instrumento. |
| Progress | Visão sobre interações/conclusões | Derivada das tentativas; posição de retomada só ao existir curso. |

**Lesson e LearningActivity não são sinônimos.** Uma lição pode explicar algo sem teste ou conter várias atividades. A mesma atividade pode ser aberta diretamente para revisão. Por isso Attempt referencia atividade + versão; sua identidade não depende de pertencer a Course. Contexto de navegação por lição poderá ser opcional, sem duplicar a atividade.

Menor conteúdo do slice: `id`, versão, título, enunciado/contexto curto, estado/request declarados, fonte inicial, critérios e textos de feedback/pistas. O que tem significado para o exercício fica junto dele. Setup, harness e avaliação são código de autoria confiável, sem uma linguagem declarativa de workflow.

Não definir agora grafo de pré-requisitos, taxonomia de competências ou tabelas Track/Course/Module/Lesson. A primeira sequência usará Course -> lista de Lessons -> referências de Activities. IDs estáveis permitem que reorganizar uma lição não apague as tentativas; mudanças substantivas de enunciado/critério mudam a versão.

## 7. Modelo conceitual e responsabilidades

### Nível 1 — relações, sem obrigação de persistir cada caixa

Diagrama A — estrutura pedagógica provável:

```text
Track                       [depois: objetivo entre cursos]
  |
  v
Course                      [primeira sequência real]
  |
  +-- Chapter / Module      [agrupamento editorial opcional]
  |       |
  +-------+--> Lesson       [conteúdo e ordem]
                 |
                 +--> LearningActivity <--- prática independente
                            |
                            +--> Attempt
                                   |
                                   +-- submissões / respostas
                                   +-- código editável, se necessário
                                   +-- 0..N execuções/testes
                                   +-- 0..N análises
                                   +-- pistas e feedback
```

No primeiro incremento materializam-se definição da atividade, tentativa e valores que sustentam suas submissões. Não se criam objetos vazios para todo o horizonte acima. Attempt não herda de Execution; Execution não conhece Course.

### Nível 2 — responsabilidades de software

| Responsabilidade | Dono proposto | Uso inicial / gatilho de crescimento |
|---|---|---|
| Conteúdo, curso e lição | Arquivos de autoria + carregador pequeno da API | Atividade inicial; manifesto Course/Lesson entra na fase 5. |
| Attempt e submissão | Casos de uso da API | Abrir/retomar, salvar resposta, submeter, receber resultado e encerrar. |
| Progresso | Consulta às tentativas + manifesto de conteúdo | Só tentada/concluída; navegação de curso posteriormente. |
| Código editável | Rascunho da tentativa + funções de cópia/captura | Um arquivo permitido no slice; lista de arquivos quando necessário. |
| Execução | Função concreta do exercício na API e harness filho | HTTP de uma request; processo novo por execução. |
| Testes | Segunda função concreta usando runner conhecido | Comando fixo, resultado e erros; sem plataforma universal. |
| Análise | Função concreta introduzida junto da primeira atividade consumidora | Nenhum código ativo no slice inicial. |
| Evidência | Instrumento que produz o resultado | Request/response/estado no primeiro; resultado de testes no segundo. |
| Feedback | Avaliador/texto do conteúdo da atividade | Compara previsão/critério com evidência; não mora no processo launcher. |
| Persistência | Pequeno acesso SQLite da API | Tentativas, submissões e resumos selecionados; sem catálogo de sistemas. |
| Apresentação | Web | Conteúdo, entrada, resultado e feedback; detalhe sob demanda. |

Esses donos não são onze services Nest nem onze packages. Um controller de aprendizagem, funções de caso de uso, acesso SQLite e duas funções concretas de instrumento são suficientes para os dois primeiros exercícios. Só separar nova unidade quando houver responsabilidade efetivamente independente.

## 8. Primeiro vertical slice: “Este pedido será aceito?”

### Escolha e recorte

Escolher a candidata A de B §18, reduzida a uma request sequencial. A pergunta já força previsão verificável; a edição posterior testa identidade da fonte e repetição. Integrar analyzer não melhora a leitura de uma condição curta.

**Escolha de implementação futura:** fixture nova e pequena em TypeScript/Node, com handler HTTP e estoque/pedidos em memória dentro do processo filho. Reaproveitar o comportamento estudado no OrderDesk, não seu servidor/worker/banco/lifecycle completos. A fixture deve declarar “estado em memória; reinicializado a cada execução”. Nenhuma alegação de persistência, transação ou concorrência decorre desse exercício.

Isso reduz o custo do slice e evita herdar `/reset` remoto. É uma decisão reversível: uma atividade posterior pode estudar SQLite/PostgreSQL real. “Estado em memória” continua sendo estado real do programa; não uma animação/simulação de banco. Não apresentar queries ou locks que não ocorreram.

### Experiência e critério concreto

1. Abrir contexto curto, função de decisão e regra do handler que converte resultado em status. Mostrar estado inicial configurado, por exemplo estoque 1/pedidos 0, e `POST /orders` com quantidade 1.
2. Solicitar status previsto, estoque final, quantidade de pedidos e uma justificativa curta. Não oferecer execução automática na abertura.
3. Congelar a resposta e a revisão da fonte ao executar. O botão não envia texto de comando nem caminho arbitrário.
4. Preparar cópia e processo novos; inicializar o estado; confirmar o estado inicial observado; disparar exatamente uma request real.
5. Capturar response e estado final; comparar com os campos previstos. Expor os fatos primeiro e a explicação curada em seguida.
6. Liberar edição do único arquivo de solução dentro da página, inicialmente com editor textual pequeno. O harness e os critérios não são editáveis por esse fluxo.
7. Solicitar nova previsão para a nova revisão, executar em estado inicial equivalente e comparar as duas submissões dentro da mesma tentativa.
8. Pedir uma frase de conclusão antes de marcar a atividade concluída. A conclusão registra o percurso, não certifica compreensão.

Caso de autoria para validar o exercício: com guarda `stock < quantity`, o caso de igualdade pode aceitar (201, estoque 0, um pedido); com `stock <= quantity`, pode recusar (409, estoque 1, zero pedidos). **É critério de validação deste documento, não solução a mostrar antecipadamente ao aluno.** O aluno deve enxergar também a regra de tradução para HTTP: pedir que adivinhe um status sem contrato visível seria um enunciado insuficiente.

Não exigir um trace para dizer que a condição explica o resultado. Se não houver instrumentação do ramo, o feedback deve separar “essa leitura do código é compatível com o resultado” de “observamos o ramo X”. Request e estado sustentam o que efetivamente foi medido.

Diagrama B — fluxo completo:

```text
LearningActivity + fonte + estado/request declarados
                         |
                         v
                 Attempt / rascunho
                         |
                         v
        Submission: previsão + justificativa + revisão
                         |
                         v
     Execution: cópia -> filho -> HTTP real -> encerramento
                         |
                         v
        Dynamic Evidence: request / response / estado
                         |
                         v
       comparação factual -> feedback específico
                         |
                         v
        editar -> nova previsão -> nova Submission
```

### O mínimo que realmente precisa existir

Definição de atividade; captura de tentativa/previsão; um arquivo editável; identificação da revisão; processo com prazo/cleanup; HTTP do exercício; comparação; armazenamento pequeno para retomar. Sem Course/Track materializados, analyzer, Git, Surface, Workbench, serviço PostgreSQL, carga concorrente ou tabela de Runs.

Há Nest na **API de controle**, por ser a aplicação pequena já disponível e compatível com a stack escolhida. O **programa estudado** não precisa usar Nest ainda. Esta distinção evita ensinar bootstrap de framework antes da pergunta sobre condicionais.

## 9. Próximo exercício: editor e testes dentro de uma lição

Escolha: **“Complete a função `reserveStock`”**. Recebe estoque e quantidade inteiros positivos dentro do domínio declarado e retorna uma decisão de reserva com estoque restante, sem HTTP, banco ou analyzer. A tarefa explicita comportamento para quantidade menor, igual e maior que o estoque. Validações de entradas inválidas só entram se ensinadas e declaradas; não surpreender o aluno com critérios secretos.

O aluno completa o corpo em TypeScript, roda testes visíveis, inspeciona esperado/obtido e tenta novamente. O programa não vem com toggle de solução nem preenchimento automático. Uma pista pode apontar o caso de igualdade sem entregar a expressão final. A primeira implementação pode usar runner nativo do Node e preparação TS fixa do projeto; versão/comando exatos são selecionados e validados na fase 4.

Diagrama C — exercício típico de curso:

```text
Lesson: enunciado + exemplo curto
                  |
                  v
       LearningActivity / Attempt
                  |
                  v
       Editable Code: solution.ts
                  |
                  v
     Submission: fonte congelada -> Run Tests
                                      |
                                      v
                   Technical Result: casos / exit / diagnostics
                                      |
                                      v
                      Pedagogical Feedback ligado aos casos
                                      |
                                      v
                           editar -> testar de novo
```

`TestExecution` não nasce como entidade, tabela ou subclasse. Testar é uma operação concreta que produz Execution e resultado de testes. Se mais tarde suites/shards/retries precisarem de lifecycle independente, a necessidade justificará um novo conceito.

**Teste de arquitetura:** trocar o executor HTTP pelo de testes deve conservar Attempt, armazenamento da submissão e componentes de entrada/feedback. Não deve exigir inventar `System`, endpoint `/state`, `accepted/rejected`, Git ou fila. Resultado HTTP e resultado de testes têm renderers distintos; não precisam ser comprimidos num mega-JSON universal.

A primeira Lesson separada pode ser pequena e introduzida aqui para testar composição editorial; a sequência Course inteira só entra na fase 5. Não construir catálogo de cursos antes de ter duas ou três lições que se conectem.

## 10. Analysis como capability

Não criar package nem adapter vazio agora. A primeira consumidora recomendada é **“Quem depende deste arquivo?”**, com pequena fixture TS editável e pedido de justificar uma dependência antes da resposta. É mais direta para validar extração localizada do que ligar o analyzer ao OrderDesk `.mjs`.

Quando essa atividade existir, uma função como `dependentsOf(snapshot, file)` pode carregar um alvo TS conhecido, extrair imports/reexports e responder dependentes diretos com localização, motivo de resolução e limitações. A função pertence ao instrumento concreto. O caso de uso da atividade conhece a pergunta e recebe dados serializáveis; Attempt não importa ts-morph, AST, PNPM, Prisma ou tipos de grafo.

Não criar `analyzeAnything`, registry de plugins, taxonomia universal ou interface para capacidades ainda sem consumidor. Se compiler diagnostics bastarem para “Alias quebrado”, usar o compilador; integrar analyzer só quando ele acrescentar evidência relevante de resolução/dependência.

Diagrama D — instrumentos opcionais e independentes:

```text
              LearningActivity
                     |
                     v
        caso de uso da Attempt / Submission
              |                         |
       quando necessário         quando necessário
              v                         v
    dependentsOf(snapshot, file)   execute/test(snapshot)
              |                         |
        Static Result              Dynamic Result
              |                         |
              +---- referências -------+
                         |
                         v
              feedback da atividade
```

Análise pode existir sem execução e vice-versa. Quando ambas forem comparadas, devem apontar à mesma fonte congelada ou declarar revisões diferentes. Não há obrigação de rodá-las sempre juntas.

Antes de extrair: fixar suporte a um tsconfig explícito; declarar limites de resolução e coverage; testar código incompleto e falhas; não converter unsupported em resposta errada. SCC/BFS, PNPM, Nest, Prisma e invocations seguem preservados até suas próprias perguntas. Corrigir membership da SCC antes de usar circularity; não reutilizar grafo mutado com índice antigo.

## 11. Execution e testing como capabilities

### Menor fronteira

A primeira fronteira é uma **função de aplicação específica**, não um executor universal. Recebe fonte submetida e condições validadas daquela atividade; produz resultado técnico com identidade e estado terminal. O dono da Attempt decide quando chamá-la e como interpretar o resultado.

Para os dois primeiros exercícios, conceitualmente:

```text
executeOrderRequest(submittedSource, declaredRequest, initialState)
testStockFunction(submittedSource)
```

São nomes ilustrativos, não contratos publicados nesta rodada. O primeiro prepara um servidor curto e faz HTTP; o segundo chama comando de teste conhecido. Ambos podem usar helpers de captura/encerramento se a duplicação real justificar. O helper não precisa conhecer LearningActivity, avaliação ou Course.

A operação de teste deve capturar separadamente stdout e stderr, exit code ou sinal, duração, diagnostics e casos estruturados quando o runner os fornecer. Não inferir “3 passed” de um exit 0 sem relatório correspondente. Guardar identificação da revisão submetida e versão do harness/toolchain. Comando e argumentos são definidos pelo autor; o navegador não escolhe shell command.

### Lifecycle mínimo e invariantes

- Persistir submissão antes de executar; marcar sua operação como em andamento antes de qualquer ponto de concorrência. Uma operação ativa por tentativa basta; conflito explícito, sem fila implícita.
- Cada execução dos primeiros slices recebe diretório e processo próprios. Preparar estado do zero, executar, capturar e encerrar; não reutilizar servidor/banco entre tentativas.
- Prazo cobre preparação operacional, readiness, operação e coleta. Encerrar processo/grupo sob timeout ou crash; só liberar o escopo após confirmar término ou marcar cleanup falho e recusar sua reutilização.
- Cancelamento/fechamento da aba não prova cancelamento do trabalho remoto. A API continua responsável por finalizar/encerrar e permitir recuperar o resultado pela Attempt.
- Capturar falhas de compilação/startup desde o começo. Manter separadas falha de teste, erro de infraestrutura, timeout, cancelamento e interrupção.
- Limitar bytes de saída e tamanho dos arquivos; indicar truncamento explicitamente. Um relatório inválido/incompleto não vira conclusão “passed”. Os limites exatos são parâmetros da implementação concreta, ver §24.
- Preservar o resultado da submissão antiga se o aluno editar enquanto ela executa. Identificar revisão atual versus submetida; nunca repintar o resultado como se fosse da revisão nova.
- Depois de reiniciar a API, operação sem final confirmado fica interrompida, nunca reexecutada automaticamente. O harness deve encerrar ao perder o pai e o teste de lifecycle deve verificar órfãos; falha desse requisito bloqueia aceitação do executor.

Processo filho protege a disponibilidade do control plane contra parte das falhas do exercício; **não constitui sandbox para código hostil**. O escopo local confiável é condição desta arquitetura. Distribuição com execução remota de terceiros exigirá outro desenho de isolamento antes de ser habilitada.

O contrato técnico mínimo não exige HTTP, `server.mjs`, banco, Git, Nest ou container. Um resultado concreto pode ser stdout de um script; outro, casos de teste; outro, request/response. Somente o adaptador HTTP necessita readiness de servidor e captura de estado.

### R1 e R2: decisão sobre os mecanismos históricos

| Achado | Decisão desta proposta | Gate se o recorte mudar |
|---|---|---|
| R1: `/reset` termina no host por timeout, mas segue mutando no filho | Eliminar reset remoto compartilhado dos primeiros slices. Recriar estado em processo novo; não reparar a operação antiga sem consumidor. Guardar prova e lição de cancelamento. | Se qualquer fluxo reutilizar reset/lifecycle histórico, corrigir **e adicionar regressão de mutação após timeout antes do uso**. O teste deve demonstrar que uma nova operação não é contaminada. |
| R2: botão de restart disponível, mas ação recusada; causa concorrente específica não comprovada | Eliminar Surface/polling/restart compartilhado da nova experiência inicial. Não corrigir E2E da UI a ser retirada. | Se preservar esse fluxo, reproduzir conflito, ajustar coordenação/estado e adicionar regressão antes de aceitar. Rerun verde, retry ou sleep não fecham o achado. |

Mesmo eliminando esses mecanismos, testar no novo executor timeout, cleanup, execução seguinte isolada, duplo clique e retorno tardio após edição. Preservar o aprendizado do bug não significa preservar seu código. Timeout/cancelamento pode virar conteúdo futuro sem justificar manutenção da implementação defeituosa.

## 12. Semântica de evidência

**Escolha C: referências comuns no domínio pedagógico; contratos estáticos e dinâmicos separados nos instrumentos.** A é suficiente tecnicamente, mas sozinha não especifica como o feedback aponta seu suporte; B introduziria envelope de metadados comuns antes de conhecer o consumidor estático. C dá a ligação necessária sem superclass `Evidence`.

No primeiro slice, uma referência pode apontar a “submissão S, resultado HTTP, campo status” ou “estado final, estoque”. Na futura análise, apontará a análise, revisão e ocorrência. Isso pode começar como campos locais de valores de feedback; não se cria agora protocolo extensível com todas as famílias possíveis.

| Família | Dados e significado próprios | Limitação obrigatória |
|---|---|---|
| StaticEvidence | Arquivo/linha/range, specifier/decorator, resolução, detector/versão, confidence, coverage, revisão | Descreve fonte e inferência restrita; import não demonstra chamada executada. |
| DynamicEvidence | Request/response, estado observado, caso de teste, exit/sinal, stdout/stderr e eventos quando existirem | Explicitar observado pelo host versus declarado pelo programa; ausência/truncamento não prova ausência de comportamento. |
| Referência pedagógica | Aponta para o fato usado na comparação/explicação | Não carrega AST, não converte payloads em mesma ontologia e não aumenta a certeza do instrumento. |

Regras de leitura e apresentação:

- `sequence` ordena coleta; não estabelece causalidade entre threads/processos. Um timestamp também não basta.
- Import/reexport indica dependência estática; um caminho de dependentes é alcance potencial, não trace.
- Teste verde confirma casos e condições daquela suíte/revisão; não comprova compreensão nem correção universal.
- `evaluated` significa regra executada, não cobertura completa; zero findings não significa inexistência da responsabilidade.
- Sem evento pode significar falta de instrumentação, perda, truncamento ou caminho não observado.
- Estado retornado pelo sistema deve ser identificado como tal, sem afirmar inspeção independente do banco.
- Explicação baseada na leitura do código pode ser curada; não fabricar evento de ramo para torná-la “observada”.

Resultados retidos devem preservar o trecho factual citado. Se um artefato bruto expirar, mostrar indisponibilidade; não manter link com aparência de evidência recuperável. Reavaliar uma submissão com regra nova deve produzir interpretação nova identificada, sem substituir silenciosamente o feedback recebido no passado (limite encontrado em B §5).

## 13. Resultado técnico e feedback pedagógico

O instrumento responde “o que aconteceu?”. O avaliador da atividade responde “como isso se relaciona com a tarefa e o que investigar em seguida?”. Não há passagem automática de exit 0 para aprendizagem concluída.

| Resultado técnico | Comparação/feedback permitido | Afirmação que deve ser evitada |
|---|---|---|
| HTTP 409, estoque 1, zero pedidos | “Você previu 201. Compare a condição no caso de igualdade com o estado observado.” | “Você não entende condicionais.” |
| Três casos passam, igualdade falha | “As reservas menores funcionaram nos casos testados; revise o limite que o teste nomeado exercita.” | “Sua solução está quase correta em qualquer entrada.” |
| Código não compila | Mostrar diagnóstico localizado e uma orientação compatível com a tarefa | Tratar falha de preparação como falha de todos os testes. |
| Analyzer retorna unsupported | Explicar o limite e permitir leitura/teste alternativo | Marcar resposta do aluno como errada. |
| Timeout/resultado incompleto | Informar ausência de conclusão e orientar inspeção do erro | Mostrar comparação definitiva ou progresso aprovado. |

No primeiro slice, comparar automaticamente apenas status/estoque/contagem. A justificativa textual fica disponível para autorreflexão, sem correção semântica automática. Uma rubrica curta mostra o que observar depois da execução. Feedback curado pode ser uma função pequena junto da atividade; não requer IA, ranking ou engine de competências.

Pistas são opcionais e graduais: apontar dado relevante, apontar relação e só depois uma explicação mais direta, se prevista pelo conteúdo. Consultar pista não apaga a tentativa nem altera o fato técnico. Guardar quais foram consultadas ajuda o autor a revisar sua experiência, sem pontuação punitiva.

## 14. Persistência e retenção

**SQLite local permanece como escolha inicial para aprendizagem.** Motivo concreto: fechar/reabrir a atividade deve preservar previsão anterior, código escrito e retorno recebido. Só memória seria menor para demo descartável, mas impediria retomar e comparar a experiência entre sessões. Arquivos JSON também serviriam; SQLite facilita gravar submissão e conclusão de forma consistente sem coordenar vários arquivos mutáveis.

Não reutilizar schema de `lab.sqlite`, seeds de sistemas nem migrations históricas. Criar armazenamento novo e isolado, por exemplo `.bunkercode/learning.sqlite`, preservando `.bunkerlab` existente. O exemplo de path não autoriza mover/apagar dados. SQL pequeno e migrations transacionais bastam, sem ORM obrigatório.

Diagrama E — quatro naturezas de dados:

```text
REPOSITÓRIO VERSIONADO
  content/
    enunciados, versões, ordem de lições/cursos
    templates, harnesses, testes e feedback curado
                  |
                  | inicia / referencia por id + versão
                  v
APRENDIZAGEM — SQLite local
  Attempt, resposta/previsão, submissões, conclusão/reflexão
  pistas vistas, revisão da fonte, feedback recebido
  resumo técnico + fatos necessários à comparação
                  |
                  | captura fonte submetida
                  v
WORKSPACE CURTO
  rascunho de um arquivo: salvo com a Attempt
  cópia para executar: diretório temporário por execução
                  |
                  v
EXECUÇÃO — predominantemente efêmera
  processo, porta, arquivos gerados, streams/eventos brutos
  devolve resultado à tentativa; encerra e limpa o temporário

FUTURO PROJETO LONGO
  diretório durável de fontes + Git opcional
  referências na Attempt, sem colocar o repositório no SQLite
```

| Dado | Política inicial |
|---|---|
| Conteúdo/template/harness/testes | Arquivos versionados; id + versão. Mudança de critério ou programa canônico muda versão. Sem conteúdo inteiro duplicado em tabelas. |
| Attempt | Durável; atividade/versão, rascunho, submissões, ajuda consultada e encerramento/reflexão. Sem identidade multiusuário neste estágio. |
| Submission | Durável; previsão/justificativa, fonte de um arquivo submetido e revisão, condições, referência/estado da operação, resumo técnico e feedback recebido. Valor subordinado à tentativa, sem API CRUD própria. |
| Execution | Objeto técnico durante operação; não entidade pedagógica nem tabela histórica universal. Guardar com a submissão o mínimo para explicar sucesso, erro ou interrupção. |
| Evidência selecionada | Primeiro slice: request, response e estados pequenos. Segundo: casos/diagnósticos relevantes. Persistir com revisão e versão de critério; limitar payloads. |
| stdout/stderr/eventos brutos | Limitados e efêmeros; trecho diagnóstico retido quando necessário. Informar truncamento/expiração, sem prometer replay integral. |
| Working copy | Rascunho de fonte pequena durável com a tentativa; materialização temporária independente para cada execução. |
| Progresso | Derivado; marcador de retomada de lição somente quando houver navegação de curso. |

Essa é política de dados, **não schema final de tabelas**. A implementação pode iniciar com um registro de tentativa e valores JSON pequenos; promover submissões a linhas separadas se o acesso e o tamanho exigirem. Não criar tabelas só porque o modelo conceitual admite 0..N. Tampouco permitir JSON sem limites crescer indefinidamente: tamanho/retention entram no gate de implementação.

Guardar fonte submetida no slice é barato porque há um arquivo curto e evita depender de temporário já limpo para mostrar a comparação. Um hash sozinho não permite reconstruir o código. Para projetos longos a retenção muda para snapshots/revisões selecionados; essa decisão não é antecipada aqui.

Operação pendente encontrada após restart vira interrompida. Gravação do resultado deve ocorrer depois de coletá-lo, sem transação aberta durante processo/HTTP. Falha ao persistir não pode aparecer como “salvo”; cleanup deve continuar em `finally` e o usuário deve receber estado de erro. Não prometer atomicidade entre SQLite, filesystem e processo.

PostgreSQL futuro pertence à fixture estudada quando a pergunta envolver SQL/concorrência/transações. Não substituir o SQLite interno por simetria de stack.

## 15. Progresso mínimo

No primeiro slice, basta distinguir “sem tentativa”, “tentada” e “concluída segundo o percurso da atividade”. Attempt aberta/encerrada é estado de interação. Caso de teste aprovado/reprovado é estado técnico. Não misturar os dois.

Para a atividade de previsão, conclusão exige ao menos uma submissão com evidência utilizável e uma comparação/reflexão registrada; acertar a primeira previsão não é obrigatório. Para código + testes, a atividade pode exigir os casos declarados aprovados e encerramento explícito, sem inferir domínio conceitual.

Na primeira sequência, derivar atividades tentadas/concluídas e guardar a lição de retomada. Course mostra ordem e continuidade; não precisa bloquear a próxima lição nem calcular nota global. Conclusão fica ligada à versão do conteúdo: uma revisão substantiva pode aparecer como conteúdo atualizado, sem apagar o histórico nem declarar que a versão nova foi concluída.

Uma futura revisão espaçada poderá usar essas interações, mas não há agenda automática, XP, streak ou engine de domínio de conceitos agora.

## 16. Código editável e estratégia de workspace

| Operação | Responsável | Comportamento inicial |
|---|---|---|
| Fornecer fonte inicial | Conteúdo da atividade | Arquivo canônico versionado e separado de testes/harness. |
| Criar working copy | Caso de uso da Attempt | Copiar texto inicial para rascunho associado à tentativa. Sem Git init. |
| Ler/salvar | API de rascunho e editor web | Um arquivo permitido; salvar com revisão esperada para recusar sobrescrita obsoleta. |
| Resetar exercício | Caso de uso da Attempt | Restaurar **rascunho** a partir do template; não apagar submissões/feedback nem resetar servidor ativo. |
| Identificar revisão | Captura da submissão | Digest dos bytes efetivamente enviados/materializados, com versão do conteúdo/harness. Não usar HEAD como sinônimo. |
| Entregar para instrumentos | Captura + adaptador concreto | Materializar snapshot independente e passar essa cópia a execução/testes/análise. |
| Limpar | Dono da execução | Encerrar processo antes de remover temporário; nunca remover rascunho/canônico. |

Uma working copy é conceito de código em edição, não obrigação de filesystem virtual. Começar com um arquivo em texto permite editor simples. Quando houver vários arquivos, ampliar o rascunho para mapa de caminhos permitidos sem expor filesystem arbitrário. Validar tamanho/caminhos, recusar traversal e symlinks na materialização; testes/harness não entram nos caminhos editáveis.

A revisão identifica fonte, não ambiente completo. Registrar também versão do Node/preparador TS, fixture/harness e condições para interpretar diferenças. A mesma fonte não garante repetição idêntica de escalonamento ou efeitos externos. Comparação entre execuções deve tornar visíveis as condições diferentes.

Salvar usa controle otimista de revisão: duas abas não podem silenciosamente sobrescrever código ou previsão. Isso resolve uma necessidade concreta do editor, sem edição colaborativa. A fonte da submissão fica congelada; o rascunho pode continuar mudando.

Git entra quando projeto longo pedir histórico, branches ou recuperação de linhas de investigação. Nesse caso reaproveitar lições do WorkspaceManager sobre repositório independente, hooks e backups (B §4), sem fingir que checkpoint de fonte restaura banco. VS Code continua opção adequada para projetos; editor web atende atividades curtas. Nenhum dos dois precisa ser a única bancada do produto.

## 17. Quarentena do analyzer

**Recomendação A: manter o arsenal no repositório legado até cada extração, preso a SHA e acompanhado de inventário/documentação preservados.** Não criar pasta experimental ativa nem packages sem consumidores no destino.

| Opção | Benefício | Custo / decisão |
|---|---|---|
| A — permanecer no legado | Preserva histórico/testes, evita deps no app e duplicação | Exige referência confiável e preservação dos relatórios locais; escolhida. |
| B — pasta experimental no destino | Facilita navegar e experimentar no mesmo checkout | Duplica manutenção e pode virar segunda arquitetura; rejeitada inicialmente. |
| C — packages preservados sem consumo | Facilita import posterior | API pública/build/deps antes de consumidor; rejeitada. |
| D — somente export/tarball de código | Arquivo compacto | Perde navegabilidade histórica se usado sozinho; backup pode complementar A, não substituí-la. |

Preservar integralmente como acervo: TS project loading, imports/reexports/aliases/unresolved, dependencies/dependents, SCC/BFS/impact, PNPM/workspaces, estrutura/package dependencies, Nest, Prisma, invocations, evidence/confidence/coverage/provenance, fixtures e testes. “Sem consumidor” não significa “apagar capacidade”.

Na fase 0, preservar os dois relatórios e confirmar que o commit legado é recuperável. Experimentos futuros podem usar cópia descartável fixada naquele SHA, sem dependência de runtime do produto ou alterações no projeto irmão. Este documento não cria essa cópia nem backup.

Cada extração deve registrar origem, SHA, caminhos, testes/fixtures usados, mudanças de contrato, bugs corrigidos e limitações restantes. Congelar a origem como referência, evitando manter simultaneamente duas implementações “canônicas”. O novo recorte passa a ser mantido no destino; o legado continua histórico.

Gates de saída da quarentena: pergunta pedagógica concreta; alternativa menor insuficiente; fixture autocontida; resultado explicável e revisionado; negativos/regressões pertinentes; custo aceitável para o uso; licença/proveniência esclarecidas antes de distribuição do recorte. L §14 não encontrou LICENSE no legado; não atribuir licença presumida.

## 18. Estrutura física inicial e UI

### Nível 3 — destino pequeno

Árvore **proposta**, não criada nesta rodada. `[2]` entra no exercício de testes; `[3]` na primeira sequência de curso. Arquivos dentro de diretórios podem ser fundidos se isso simplificar o primeiro incremento.

```text
apps/
  api/
    src/
      main.ts                    bootstrap local Nest
      app.module.ts              composição explícita
      learning/
        learning.controller.ts   comandos/leitura de tentativas
        attempts.ts              casos de uso, submissão e comparação
        store.ts                 SQLite selecionado
        editable-code.ts         rascunho, revisão e materialização
        content.ts               carregamento de conteúdo conhecido
      execution/
        order-request.ts         adaptador concreto HTTP/processo
        stock-function-tests.ts  [2] comando/resultado dos testes
    migrations/                  apenas novo armazenamento
    test/                        comportamento dos novos fluxos
  web/
    src/
      App.tsx                    rotas mínimas de atividade/lição
      api.ts                     transporte dos endpoints novos
      activity/                  conteúdo, resposta/editor, retorno
      course/                    [3] navegação simples de lições
    e2e/                         fluxo pensar/escrever antes do resultado
content/
  activities/
    order-acceptance/             definição, enunciado, starter, harness, feedback
    reserve-stock/                [2] definição, starter, testes, feedback
  lessons/                        [2/3] contexto e referências de atividades
  courses/                        [3] manifesto ordenado de lições
  tracks/                         NÃO criar inicialmente
docs/
  audits/                         preservação futura dos dois relatórios
  architecture/
    bunkercode-reconstruction-target.md
```

API Nest e web React são duas unidades com responsabilidades reais distintas: execução/acesso local a fontes e persistência de um lado, edição/apresentação do outro. Reutilizar toolchain/bootstrap seletivamente custa menos que introduzir terceiro app. Conteúdo fica em arquivos, não vira package. A resolução da raiz de conteúdo deve ser explícita e funcionar no comando local escolhido; se a distribuição passar a depender de build, copiar/incluir esses recursos e testar esse comando. Não repetir dependência silenciosa do layout fonte observada em B §2.

Não há `packages/domain`, `application`, `infrastructure`, `shared`, `core`, `common` ou `capabilities`. Tipos pertencem aos produtores; DTOs HTTP são pequenos e específicos, testados na fronteira. Evitar imports web de módulos executáveis da API. Inicialmente tipos do cliente podem espelhar apenas os campos consumidos; extrair um package de transporte **somente** se repetição e divergência reais justificarem, sem reexportar domínio de fixture.

A árvore descreve o alvo após transição, não uma ordem de exclusão. Durante a convivência, adicionar uma rota web nova e um controller novo sem fazer o fluxo depender de LaboratoryService/protocol antigo. Se nomes colidirem, escolher arquivo novo local; não criar `apps/bunkercode-v2` ou terceiro repositório só para coexistir. Retirar o caminho antigo após os gates de demolição.

### Responsabilidades da UI

A UI nova organiza contexto curto, entrada do aluno, ação explícita e retorno. Previsão e revisão submetida permanecem visíveis ao lado da comparação. Código editável começa com texto de um arquivo; diagnostics e resultado de testes têm painel próprio. Feedback e hints têm divulgação progressiva e não substituem fatos.

Navegação de curso e posição de retomada entram ao haver sequência. Inspector de evidência, estado runtime, resultado de análise e comparação detalhada aparecem quando a pergunta exigir. Não construir layout final, IDE, terminal, árvore universal de arquivos ou catálogo de sistemas.

Reescrever shell/páginas/estilos atuais segundo esses fluxos. Acessibilidade, foco do editor e estados de carregamento/erro são requisitos de uso; não justificam preservar o Workbench. UI não deve habilitar operação com base apenas em polling antigo; servidor decide conflitos e a tela mostra qual submissão recebeu retorno.

## 19. Naming recomendado

| Nome | Significado recomendado | Tratamento do nome histórico |
|---|---|---|
| LearningActivity | Ação pedagógica definida por conteúdo/critério | Preferir nome explícito na fronteira durante transição; Activity antiga não migra como isso. |
| Activity | Pode ser abreviação local depois da retirada do conflito | Hoje representa request efêmera; se a capacidade sobreviver, usar HttpInteraction. |
| Lesson | Unidade editorial com conteúdo e referências de atividades | Não impor 1:1 com atividade permanentemente. |
| Attempt | Interação do aluno, possivelmente com várias submissões/instrumentos | Não renomear Run para Attempt. LearningAttempt pode ser usado onde houver ambiguidade. |
| Submission | Entrada congelada dentro da tentativa | Valor, sem subsistema próprio inicialmente. |
| Run / Execution | Recomendar Execution para trabalho técnico novo | Run fica apenas no histórico/compatibilidade existente até retirada. |
| TestExecution | Operação de teste que produz resultado de Execution | Sem nova hierarquia ou tabela por enquanto. |
| Experiment | Procedimento concreto de experimento | Não tipo universal de atividade/teste. |
| Investigation | Forma de atividade com hipóteses/evidência | Não registry/framework obrigatório. |
| Evidence | Termo humano amplo | Tipos Static/Dynamic separados; referência comum mínima. |
| WorkingCopy / Workspace | Rascunho curto / ambiente de projeto quando necessário | Workspace não implica Git, servidor ou curso. |
| System | Aplicação estudada quando houver uma | Não raiz de navegação ou pré-requisito de Attempt. |
| Course / Track | Percurso / agrupamento entre percursos | Conteúdo organizado, sem CMS obrigatório. |
| Chapter / Module | Agrupamento editorial opcional | Preferir Chapter no conteúdo para não confundir com módulo Nest/TS. |
| Feedback / Evaluation | Orientação / interpretação segundo critério | Test result não equivale a learning evaluation. |

Nenhum rename é realizado nesta rodada.

## 20. Tabela de decisões arquiteturais

“Agora” indica decisão do desenho, não autorização para implementar todas as linhas imediatamente. Evidência de auditoria informa a escolha; onde há decisão de produto nova, isso é declarado.

| Decisão | Escolha | Alternativas rejeitadas | Por que agora | O que permanece reversível | Evidência das auditorias |
|---|---|---|---|---|---|
| Repositório de destino | Git atual do BunkerLab/BunkerCode; demolição interna posterior | Terceiro repo; elevar legado visual a base | Preserva continuidade sem vincular domínio antigo | Nomes/estrutura/distribuição | B §§1–2: capacidades locais e histórico; nenhuma barreira técnica ao repo atual identificada |
| Domínio pedagógico | LearningActivity + Attempt | System/Workbench; analyzer como produto | Ação do aluno é a unidade de valor | Campos e organização interna | B §§5, 7–8: domínio ainda ausente |
| Courses/tracks | Direção de conteúdo; manifesto quando houver sequência | LMS completo; puzzles sem possibilidade de sequência | Evitar beco sem saída editorial | Hierarquia e nomenclatura | L §12 e B §18 oferecem atividades, não currículo; direção vem do pedido |
| Lesson vs Activity | Separação semântica, arquivos separados quando útil | Sinônimos permanentes; tabelas de ambos desde o início | Permitir várias ações por lição e revisão independente | Materialização inicial 1:1 | B §§7–8: Activity histórica não tem semântica pedagógica |
| Attempt | Durável desde o slice; submissões subordinadas | Reusar Run; apenas estado de componente React | Comparar previsão anterior com evidência real | Schema e retenção detalhada | B §5: Run ≠ LearningAttempt |
| Run vs Execution | Execution para novo trabalho técnico | Rename mecânico; Run como progresso | Evitar mistura execução/aprendizagem | Nome interno, preservando distinção | B §§5–6, 9 |
| Editor/editable code | Um rascunho de arquivo + snapshot por submissão | Git obrigatório; IDE/Monaco obrigatório; parâmetro fingindo código editado | O primeiro slice já inclui alteração real de condição | Widget e armazenamento futuro de vários arquivos | B §4: cópia/digest independem conceitualmente de Git |
| Testing boundary | Operação concreta com comando conhecido | Framework universal; novo domínio TestExecution | Próximo exercício precisa testar código sem HTTP | Runner/reporter/helper de processo | B §5: workload atual não é executor geral; L §12: capacidade ausente |
| Analyzer boundary | Operação concreta, ex. dependentsOf | Analyzer Platform; AST no domínio | Definir ownership sem dependência ativa | Implementação e escopo das operações | L §§5–7; B §§16–17 |
| Runtime boundary | Adaptador concreto + processo descartável | RuntimeManager intacto; generic runtime DSL | Observar efeitos sem contaminar control plane | Adaptadores e isolamento futuro | B §§3–5, R1 |
| Evidence strategy | C: referências pedagógicas; payloads separados | Superclasse/envelope universal B; ausência de vínculo de suporte | Comparação precisa apontar fato | Forma da referência à medida que surgir análise | B §17; L §§5–7 |
| Resultado vs feedback | Instrumento mede; conteúdo interpreta | Analyzer/test runner produz “aprendeu” | Feedback não pode exagerar alcance dos fatos | Texto/rubricas versionadas | B §§5, 8; L §§5–6 |
| Persistência | Conteúdo em Git; aprendizagem durável; execução seletiva | Persistir tudo; só memória; herdar schema do lab | Retomar código/previsão e preservar comparação | Modelo SQL/JSON e seleção de históricos | B §§6–7 |
| Progresso | Tentada/concluída por atividade/versão; retomada depois | XP, nota universal, engine de domínio | Mostrar continuidade sem falsa certificação | Critérios editoriais de conclusão | B §8: disclosure não mede compreensão; nova necessidade de produto |
| Git | Opcional em projetos longos | Init/checkpoint em toda atividade | Evitar custo do WorkspaceManager em exercício curto | Ativação por tipo concreto de projeto | B §4 |
| SQLite | Sim, banco novo de aprendizagem local | PostgreSQL interno por simetria; reutilizar lab.sqlite | Pequena persistência transacional útil | Tecnologia sob acesso local pequeno | B §6: tecnologia candidata, schema acoplado |
| UI rewrite | Novas páginas/fluxos centrados em atividade | Workbench + drawer pedagógico; migrar componentes por estoque | Navegação antiga dita modelo errado | Layout/componentização | B §§10–11; L §8 |
| Quarentena | A, legado fixado em SHA + relatórios preservados | Pasta experimental duplicada; packages ociosos | Preservar arsenal sem ativação | Extração por necessidade | L §§9, 14, 16; B §§16, 22 |
| Primeiro vertical slice | “Este pedido será aceito?”, HTTP real e estado em memória novo | OrderDesk inteiro; integração analyzer+runtime inaugural | Valida previsão/evidência/edição com menos variáveis | Fixture/estado persistente em atividade posterior | B §18 A; redução é decisão desta proposta |
| Segundo slice | reserveStock em TS + testes, sem HTTP | Concorrência/analyzer antes de comprovar editor/testes | Ataca o acoplamento ao primeiro exemplo | Enunciado exato e runner | B §15 e L §12 evidenciam ausência do fluxo; pedido define direção |
| R1/R2 | Não herdar mecanismos; gates se reutilizados | Corrigir código sem futuro; ignorar falha por rerun | Evita legitimar lifecycle conhecido como inseguro para comparação | Reuso futuro condicionado a correção/testes | B, achados confirmados R1/R2 |

## 21. Mapeamento de reconstrução e demolição

Somente após definir a arquitetura acima. `B/` indica a base BunkerLab no SHA registrado; `L/` indica o repositório legado no SHA registrado. Ações se referem ao trabalho futuro, **não executadas aqui**. EXTRACT é seleção de comportamento/código/testes, nunca migração automática de package.

| Nova responsabilidade | Capacidade existente necessária | Repositório/caminho de origem | Ação |
|---|---|---|---|
| Controle local mínimo | Bootstrap Nest, loopback, validação local de mutações | B/`apps/api/src/main.ts`, `app.module.ts` | REUSE BEHAVIOR; recompor apenas rotas novas, sem carregar LaboratoryService no fluxo |
| Conteúdo e tentativa | Não há modelo equivalente pronto | B/`investigations/orderdesk.ts` e `experiments/overselling.ts` só como referência de conteúdo | REIMPLEMENT; registrar resposta/submissão antes de resultado |
| Request real do slice | HTTP, estado e regra de aceitação | B/`templates/orderdesk/{server,inventory,order-store}.mjs` | REUSE BEHAVIOR; fixture TS reduzida, sem worker/DB/reset compartilhado |
| Lifecycle do novo processo | start/erro/timeout/encerramento | B/`apps/api/src/runtime.ts` | REIMPLEMENT fronteira concreta; preservar casos de crash/cleanup, não assumptions server.mjs/SQLite |
| Revisão efetivamente testada | Cópia/digest/proteção de canônico | B/`apps/api/src/workspace.ts` | EXTRACT apenas técnicas/casos pertinentes; retirar dependência de Git e filtros históricos |
| Resultado de uma operação | Correlação request/response; erro distinto de HTTP 500 | B/`activities.ts`, `runtime.ts`, `laboratory.service.ts` | REUSE BEHAVIOR; retorno específico, sem buffer universal ou Surface |
| Aprendizagem durável | SQLite e migrations transacionais pequenas | B/`repository.ts`, `migrate.ts` | EXTRACT técnica seletiva; REIMPLEMENT schema/ownership sem seed de catálogo |
| Feedback factual | expected/actual e seleção de evidência | B/`packages/protocol/src/index.ts`, `investigations/orderdesk.ts` | REUSE BEHAVIOR; REIMPLEMENT comparação específica e feedback versionado |
| Experiência web | Disclosure, legibilidade de evidência e revisão | B/`apps/web/src/components/{Investigation,ActivityInspector}.tsx` | KEEP AS REFERENCE; REIMPLEMENT nova UI |
| Testes de função TS | Nenhum executor pedagógico pronto | B/`apps/api/test/laboratory.integration.test.ts` demonstra propriedades de processo, não runner de exercícios | REIMPLEMENT operação concreta na fase 4 |
| Primeira análise de dependentes | Loading/imports e consulta inversa | L/`packages/analyzer-typescript/src/{typescript-analysis-session,analyze-project}.ts`; L/`packages/graph-engine/src/project-graph.ts` | EXTRACT quando a atividade existir; novo recorte sem OBSERVE |
| Calibração de análise | Resolução, aliases, negativos e fixture mínima | L/`test/{analyze-simple-import,project-discovery,project-graph}.test.ts`; L/`fixtures/simple-import` | EXTRACT casos relevantes e tornar fixture autocontida |
| Análise Nest futura | Identidade de decorators e limites | L/`packages/analyzer-typescript/src/responsibility-detectors/{nestjs,nestjs-common}.ts`; `test/responsibility-runtime.test.ts` | KEEP AS REFERENCE; EXTRACT só com atividade consumidora |
| SCC/BFS/impacto futuro | Algoritmos e contraexemplos | L/`packages/graph-engine/src/{project-graph,project-impact}.ts` | KEEP AS REFERENCE; corrigir bugs e adicionar regressões na extração pertinente |
| Arsenal sem consumidor atual | PNPM, estrutura, package dependencies, Prisma, invocations | L/`pnpm-workspace.ts` no analyzer; `project-structure.ts`, `package-dependencies.ts` no engine; `prisma-persistence.ts`, `invocation-relations.ts` no analyzer | KEEP AS REFERENCE com testes/fixtures/SHA; não apagar nem ativar |
| Projeto longo futuro | Git independente, backup/restore | B/`workspace.ts`; `test/workspace-upgrade.test.ts` | KEEP AS REFERENCE; EXTRACT somente comportamento necessário, sem upgrades históricos como núcleo |
| Caso futuro de concorrência | Fenômeno OrderDesk real, observações e fixture de correção | B/`templates/orderdesk`, `experiments/overselling.ts`, `test/fixtures/conditional-order-store.txt` | KEEP AS REFERENCE; solução permanece fixture de teste, não botão do aluno |
| Retirada da UI antiga | Nenhuma dependência nova necessária | B/`pages/{WorkbenchPage,SystemPage,RunsPage,Compare,Checkpoints,Inspector}.tsx`, Surface/TestTool e estilos associados | DELETE AFTER TRANSITION e após validar referências remanescentes |
| Retirada de contratos antigos | DTOs de Workbench/Surface, workload universal | B/`packages/protocol/src/{index,orderdesk}.ts` | DELETE AFTER TRANSITION, export a export conforme consumidores saírem |
| Retirada de orquestração antiga | Nenhum consumidor no novo fluxo | B/`laboratory.service.ts`, controller/catalog/runner antigos, upgrades em workspace | DELETE AFTER TRANSITION após preservar referência e retirar rotas/consumidores |
| Produtos visuais do legado | Nenhuma capacidade visual necessária | L/`apps/{explorer-web,studio-web}`, `packages/{planned-system,design-model}`, wrappers `observed-*` | KEEP AS REFERENCE histórico; exclusão ativa apenas em tarefa própria no legado, fora do escopo deste repo |
| Documentação da tese anterior | Conhecimento histórico, não política nova | B/README, AGENTS e docs arquiteturais/currículo antigos | KEEP AS REFERENCE; atualização seletiva futura, sem alterações nesta rodada |

### Ordem segura de demolição

1. **Preservar antes de depender:** relatórios não versionados/ignorados, SHAs, fontes/fixtures relevantes e inventário de dados locais. Selecionar artefatos únicos; Git não guarda tudo que existe no disco.
2. Aprovar esta arquitetura e atualizar orientação ativa conflitante em tarefa posterior. Não fazer rename geral como marco de progresso.
3. Construir rota nova completa para o primeiro slice, sem depender do shell/protocol antigo. Antigo continua acessível durante verificação; isso é coexistência temporária, não arquitetura paralela permanente.
4. Validar comportamento técnico e usar a atividade de verdade; registrar fricções e ajustar apenas o que o uso demonstrar.
5. Construir o exercício de função + testes e comprovar que não precisou de System/HTTP/Git. Esse é o gate para a nova arquitetura ser referência suficiente.
6. Retirar primeiro a navegação/páginas do Workbench e componentes Surface/TestTool sem consumidor novo. Remover testes exclusivos da apresentação aposentada na mesma rodada, mantendo novos testes de invariantes.
7. Retirar endpoints, agregações e orquestração antiga sem consumidor. Remover upgrades do workspace e runner concorrente do caminho ativo quando nenhuma atividade vigente os usar; preservar conhecimento da concorrência para atividade futura.
8. Remover exports/contratos antigos e, se ficar vazio, `packages/protocol`; ajustar imports, scripts e manifests juntos. Não criar um novo mega-contracts para substituí-lo.
9. Retirar dependências, placeholders e docs normativas obsoletas; manter registro histórico selecionado. Atualizar README com o fluxo realmente existente.
10. Só tratar dados antigos mediante política explícita de preservação/migração. Demolição de código não autoriza apagar workspaces, checkpoints, `.bunkerlab`, localStorage ou projetos irmãos.

Cada rodada de retirada precisa de busca de consumidores e checks aplicáveis. Se uma capacidade antiga ainda tiver consumidor legítimo, a retirada desse trecho espera ou ganha substituição específica; não usar greenfield para perder dados em silêncio.

## 22. Fases pequenas e critérios de saída

| Fase | Entrega concreta | Critério de saída | O que ainda fica de fora |
|---|---|---|---|
| 0 — preservação | Relatórios em local durável do repo, provenance e confirmação dos SHAs; registrar esta proposta aprovada e orientação nova | Nenhuma dependência exclusiva de arquivo ignorado/worktree temporário; estado Git revisado pelo autor | Extração de código e reparos históricos |
| 1 — menor núcleo | Uma definição, página de enunciado/previsão, criação/retomada da Attempt em SQLite | Previsão salva antes de qualquer resultado; recarregar conserva resposta; nenhum runtime/analyzer necessário para abrir | Catálogo, cursos completos, editor genérico |
| 2 — primeiro fluxo completo | HTTP real, revisão/cópia, estado novo, comparação, edição de um arquivo e reexecução | Dois resultados associados às fontes e condições corretas; crash/timeout não contamina próxima execução; E2E sem solução antecipada | Carga, banco experimental, Git, análise |
| 3 — uso real | Autor faz exercício e registra fricções/justificativas | Consegue explicar diferença entre previsão e evidência sem assistência entregando resposta; falhas de UX registradas | Analytics, telemetria de produto, conclusão sobre eficácia geral |
| 4 — primeiro code-first | reserveStock TS, editor simples, testes reais, diagnostics e feedback | Corrigir solução usando casos/feedback; não introduzir HTTP/System/Git para rodar testes | Framework de testes, LSP, IDE |
| 5 — primeira sequência | Duas ou três Lessons e manifesto Course; ordem e retomada | Atividade seguinte usa habilidade anterior; uma atividade continua acessível como prática independente | CMS, Track obrigatório, engine de pré-requisitos |
| 6 — primeira análise | Pergunta de dependentes; extração mínima com proveniência | Evidência da mesma revisão, negativos/limites explícitos, falha do analyzer não pune aluno | Nest/Prisma/PNPM/SCC sem uso nessa pergunta |
| 7 — stack real | Uma atividade Nest **ou** PostgreSQL conforme estudo | Novo adaptador específico com setup/teste/cleanup e pergunta pedagógica clara | Orquestração genérica, suporte simultâneo a toda stack |

A fase 1 não é autorização para um sprint de modelagem sem experiência. Seu recorte é uma tela e uma tentativa recuperável, preparando imediatamente a fase 2. A primeira implementação concreta após aprovação e preservação é: **abrir `order-acceptance`, salvar previsão/justificativa e retomá-las após reload, sem revelar resultado**. Em seguida conectar a execução real; não construir runtime/analyzer antes desse consumidor.

As fases 6 e 7 podem trocar de ordem se o estudo pedir Nest/SQL antes de dependentes. A sequência de curso não deve esperar um analyzer para existir. A demolição é intercalada após os dois slices, não adiada até concluir todos os instrumentos futuros.

### Como avaliar manualmente, sendo o autor o primeiro usuário

| Experiência | Procedimento | Evidência útil de valor / limite |
|---|---|---|
| Primeiro slice | Escrever previsão sem rodar; justificar; confrontar response/estado; alterar condição; prever novamente. | Registrar o que mudou na hipótese e qual fato provocou a mudança. Se só clicar até acertar, revisar enunciado/feedback. Conhecer o gabarito limita a avaliação do próprio autor; usar uma variante ou retomar depois. |
| Code-first | Escrever a função sem copiar solução; rodar casos; explicar uma falha; corrigir; experimentar entrada nova coerente com o enunciado. | Verificar se teste/diagnóstico orientou a correção ou se só a solução revelada permitiu avançar. Teste verde não basta para concluir compreensão. |
| Sequência de curso | Fazer lição de previsão, função e pequeno uso da função; no início de cada uma, dizer qual habilidade anterior será necessária. | Próxima tarefa deve reutilizar e ampliar o que veio antes, sem apenas desbloquear um card. Registrar pontos de salto/descontinuidade. |

Registro manual simples em nota de uso: versão da atividade, previsão/solução inicial, pista usada, fato que alterou a decisão, conclusão e fricção. Sem tempos inventados, analytics SaaS ou alegação causal de ganho de aprendizagem.

### Como a arquitetura admite os exercícios seguintes

| Atividade | Incremento concreto permitido | O que não precisa mudar |
|---|---|---|
| Alias quebrado | Fixture TS com config editável, compiler diagnostics; analyzer se a pergunta exigir razão de resolução | Attempt, submissão, feedback e navegação |
| Ciclo não é trace | Imports + SCC corrigida e programa curto; resultados separados | Não fundir evidência estática/dinâmica |
| Rota declarada responde? | Detector Nest restrito + preparação/runtime/teste Nest concreto | Course não conhece decorators nem lifecycle |
| Concorrência OrderDesk | Fixture real e workload concorrente, condições registradas e comparação | HTTP concorrente não passa a ser obrigatório nas demais atividades |
| Dependentes versus efeitos reais | Análise e execução da mesma revisão | Nenhuma promessa de causalidade pelo grafo |
| Query PostgreSQL | SQL editável, banco de fixture, testes e cleanup próprios | PostgreSQL estudado não substitui metadata SQLite |
| Projeto guiado | Vários arquivos duráveis, milestones editoriais e Git opcional | Attempt não vira commit; Course não vira workspace |

“Admite” significa fronteira conceitual compatível, não suporte já implementado. Nest build/readiness, PostgreSQL e isolamento ainda precisam ser resolvidos no primeiro consumidor concreto.

## 23. Não objetivos explícitos

Não construir agora:

- autenticação, execução cloud, multiusuário, feed/comunidade/social ou infraestrutura SaaS;
- plugin framework, generic runtime DSL, generic analyzer API ou orquestração de containers;
- visual course CMS, authoring platform, workflow editorial multi-autor ou versionamento editorial sofisticado;
- complex progression engine, spaced repetition engine sofisticado, XP, streaks, leaderboard, moedas, achievements, quests ou ranking;
- universal graph, universal workspace ou gerenciamento genérico de PostgreSQL;
- plataforma de execução multilíngue, terminal universal, LSP universal, debugger completo ou editor colaborativo;
- tutor de IA automático em toda interação, avaliação automática de justificativa livre ou geração indiscriminada de respostas;
- Explorer/Studio/OBSERVE/Workbench como novo shell; mapas/geografia/projeções como caminho obrigatório para aprender;
- migração completa de dados/compatibilidade dos produtos antigos sem consumidor identificado.

**Cursos, lições, editor e testes não são não objetivos.** São parte do horizonte e entram nos incrementos definidos. O que fica fora é sua infraestrutura genérica/sofisticada, não a experiência de aprender escrevendo e testando.

## 24. Incertezas, riscos e decisões que exigem evidência

| Incerteza | Decisão provisória | Como resolver / quando |
|---|---|---|
| O primeiro slice será valioso além de uma previsão trivial? | Usar caso de igualdade e edição, sem decorar toda a UI | Uso real na fase 3; se não alterar raciocínio, mudar atividade antes de expandir infraestrutura |
| Quanto deve durar uma Attempt? | Uma sessão de resolução com várias submissões; encerrar explicitamente, nova tentativa ao recomeçar depois | Observar uso dos dois primeiros exercícios; alterar sem depender de identidade de Execution |
| Memória é suficiente para o contexto “pedido”? | Sim para condicionais/status/efeito; não ensina persistência | Texto explícito da fixture; se o objetivo exigir transação, escolher atividade com DB real |
| Qual executor/preparador TS? | Comando fixo e runner conhecido, sem instalar deps por tentativa | Confirmar toolchain existente e reporter na fase 2/4; documentar versões usadas |
| Quais limites concretos de execução/saída/rascunho? | Limites pequenos e declarados, um arquivo e uma operação por tentativa | Fixar e testar antes de aceitar executor; evitar prazo que mate preparação normal e aceite loop infinito |
| SQLite com valores JSON ficará grande? | Resumos e fontes pequenas, sem streams integrais | Definir retenção/teto de tentativa na implementação; extrair linhas de submissão se consulta/tamanho pedir |
| Qual widget de editor? | Entrada textual simples, acessível, sem LSP | Medir fricção de indentação/diagnostics no uso; trocar widget sem mudar modelo |
| Origem e licença do código extraído | Proveniência obrigatória; não presumir licença ausente | Esclarecer antes de distribuir recorte legado |
| Plataforma aberta requer segurança remota? | Distribuição local confiável primeiro | Nova decisão antes de receber código de terceiros no servidor; processo filho não resolve |
| Como preservar projetos/histórico BunkerLab pessoais? | Não migrar nem apagar automaticamente | Inventário e política específica antes de demolição que afete acesso aos dados |
| Conclusão automática da atividade é adequada? | Critério explícito + encerramento do aluno; não avaliação de domínio | Primeira sequência e revisão posterior, sem inferir eficácia de pass/fail |

**Maior risco de decisão:** a semântica de Attempt com várias submissões se tornar um histórico técnico pesado, em vez de apoiar a reflexão. A mitigação é manter valores pequenos, feedback específico e validar o percurso antes de construir progresso/retention sofisticados. O risco pedagógico associado é o slice de previsão virar adivinhação de status; mostrar contrato, pedir justificativa e testar transferência para código é mais importante que enriquecer o inspector.

Os nomes Course/Chapter/Lesson e as fronteiras físicas são reversíveis. A distinção entre ação do aluno, execução técnica e evidência é a restrição que merece estabilidade. Não impor camadas extras para proteger hipóteses editoriais.

## 25. Gates antes da implementação

Esta seção permite aprovar/rejeitar a proposta com evidência concreta. “Atendido no desenho” não significa validado em código ou aprovado pelo autor.

| Gate | Pergunta | Resposta proposta / evidência para aceitação |
|---|---|---|
| A — produto | Serve à aprendizagem ou aos produtos antigos? | Atendido no desenho: entrada é atividade/resposta/código; nenhum Workbench, mapa ou catálogo de sistemas obrigatório. Confirmar no fluxo da fase 2. |
| B — first slice | Cada abstração criada agora é necessária? | Atividade, tentativa, submissão, revisão, resultado e feedback têm consumidor explícito (§8). Track/Course/Chapter/analyzer/registry não são criados no slice. |
| C — course future | Course -> Lesson -> código -> testes -> feedback cabe? | Sim conceitualmente (§§6, 9, 22); fase 4/5 precisa prová-lo sem HTTP/System/Git artificiais. |
| D — reversibilidade | Hipótese virou contrato cedo demais? | Sem schema de todo currículo, interface universal ou package comum. Versionar conteúdo/feedback não congela sua estrutura para sempre. |
| E — instruments | Runtime/analyzer/test runner são opcionais? | Attempt não depende de seus tipos internos; fase 1 e futura leitura sem execução precisam funcionar. |
| F — pedagogy | O aluno age antes do resultado? | Submissão persistida antes de executar; testes recebem código escrito; E2E deve verificar ausência de resultado automático/spoiler. |
| G — evidence | Feedback aponta suporte sem exagero? | Referências para fatos retidos; revisão e limites explícitos (§12). Timeout/truncamento/unsupported não produzem certeza. |
| H — feedback | Técnico e pedagógico estão separados? | Resultado do instrumento é entrada do avaliador específico; justificativa livre não recebe nota automática (§13). |
| I — simplicity | É possível remover camada/package sem perder os dois fluxos? | Já removidos domain/shared/core packages, universal workspace, TestExecution entity e Investigation framework. Funções locais bastam; revisar qualquer nova camada na implementação. |
| J — stack future | TS/Node/Nest/PG/analyzer permanecem possíveis? | Sim por adaptadores concretos e conteúdo independente (§22), sem alegar que suporte futuro já existe. |

Condições operacionais antes do primeiro executor: preservar relatórios; aprovar escopo local; fixar comando/limites/preparação TS; escolher schema mínimo de tentativa; testar revisão, isolamento, timeout e cleanup. Se reaproveitar reset/restart históricos, seus gates de correção entram antes do uso (§11). Não abrir tarefa de bugs mortos para “limpar pendências” sem consumidor.

Para a rodada que implementar código, executar `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` e E2E pertinentes ao fluxo, explicitando falhas ambientais, skips e limitações. Aprovação deste desenho não autoriza declarar esses checks aprovados antecipadamente.

## 26. Review final — respostas às 27 perguntas

1. **Domínio central:** prática de aprendizagem, expressa por LearningActivity e Attempt, com submissão e feedback verificáveis. Runtime/analyzer são instrumentos.
2. **Todos os níveis desde o início?** Não. Track e Chapter esperam necessidade editorial; Course/Lesson entram na primeira sequência, com separação semântica preservada desde já.
3. **Menor conteúdo sem beco sem saída:** atividade versionada e independente; posteriormente manifesto de curso ordena lições que referenciam essas atividades.
4. **Menores conceitos:** definição de atividade, Attempt, submissão congelada, resultado específico e feedback. Código/revisão existem nos exercícios editáveis; execução é opcional.
5. **Attempt no primeiro slice?** Sim. Guarda a previsão anterior e conecta as reexecuções/edições sem fingir que cada processo é nova aprendizagem.
6. **Run ou Execution?** Execution para novo código técnico. Run histórico não vira Attempt nem é renomeado nesta rodada.
7. **Código sem Git?** Rascunho de um arquivo, template canônico e snapshot materializado por submissão; digest e revisão independem de commit.
8. **Menor execução:** função concreta que prepara a fonte submetida, executa operação conhecida fora do host, coleta resultado e encerra o processo.
9. **Conceito próprio de TestExecution?** Não inicialmente. Testar é operação concreta de execução com resultados de casos/diagnostics.
10. **Menor análise futura:** uma consulta consumida por atividade, como dependentsOf, com fonte/revisão/evidência/limites; nenhum Analyzer Platform.
11. **Static/Dynamic Evidence:** payloads separados, ligados por referências pequenas no feedback e pela revisão da fonte quando comparados.
12. **Técnico/pedagógico:** instrumento relata; critério da atividade compara/interpreta e propõe próximo passo. Passar não significa aprender.
13. **SQLite?** Sim para aprendizagem local selecionada, em banco/schema novos. Não é obrigação do programa estudado.
14. **Progresso persistido:** tentativas e conclusão por atividade/versão; posição de retomada quando existir curso. Não persistir nota de domínio inferida.
15. **Quando Git?** Projeto/investigação longa que realmente precise de histórico/branches/checkpoints; nunca para abrir toda atividade.
16. **Repo definitivo:** o Git atual BunkerLab, cujo checkout principal já se chama BunkerCode. Não há razão técnica demonstrada para terceiro repo.
17. **UI atual:** reescrita, retirada após os dois novos fluxos estarem funcionais; preservar propriedades úteis, não componentes por disponibilidade.
18. **Arsenal analyzer:** legado fixado no SHA, com relatórios/testes/fixtures preservados e extração seletiva futura.
19. **Primeiro slice:** “Este pedido será aceito?”, uma request real com estado em memória e edição de condição, para testar previsão/evidência com poucas variáveis.
20. **Primeiro editor + testes:** completar reserveStock em TS, sem HTTP ou analyzer; casos abaixo/no/acima do limite declarado.
21. **Cursos sem CMS:** arquivos versionados de lição e manifesto ordenado de curso; autoria pelo repositório.
22. **O que não construir:** cloud/auth/multiuser/social, CMS/IDE universais, frameworks genéricos de plugins/runtime/análise, gamificação e tutor automático (§23).
23. **Primeiro código a desaparecer:** navegação/páginas do Workbench e Surface/TestTool que não tenham consumidor no fluxo novo, após o gate dos dois slices.
24. **Primeira capacidade reaproveitada:** execução de request real fora do control plane, com fonte identificada, resposta/estado e cleanup. Reuso de comportamento, não RuntimeManager inteiro.
25. **Decisão mais arriscada:** granularidade e retenção de Attempt; validar que várias submissões ajudam reflexão e não recriam uma Run gigante (§24).
26. **LMS/IDE ou prática?** Centrado na prática enquanto organização/editor/testes servirem a uma ação curta e verificável. Shell de progresso, curso sem ação ou editor com infraestrutura própria seriam sinais de desvio.
27. **Primeira implementação após aprovação:** fase 0 de preservação, depois enunciado/previsão de order-acceptance com Attempt salva e retomável; conectar execução real na fase 2, sem analyzer nem reforma geral do repo.

## 27. Continuidade, validação desta rodada e review

Decisões fechadas **como recomendação deste documento**: repo atual, domínio LearningActivity/Attempt, Execution técnica, dois slices definidos, fonte/revisão sem Git, SQLite selecionado, evidência por referências com payloads separados, reescrita de UI e quarentena A. Nenhuma foi marcada como aprovação humana ou implementação concluída.

Decisões abertas para trabalho posterior: eficácia/fricções de uso, duração de Attempt, limites concretos, comando TS/reporter, widget de edição após uso, política de dados antigos e preparação do primeiro Nest/PostgreSQL. Não precisam de abstrações vazias agora.

Protocolo HANDOFF: se solicitado, finalizar apenas a unidade em andamento, atualizar esta seção, verificar Git e entregar prompt com caminhos/SHAs/hashes dos relatórios, tese/north star, decisões acima, dúvidas abertas, arquitetura parcial, próximo passo exato, arquivos alterados e Git status. Não iniciar nova decisão durante handoff.

Validação desta rodada documental: leitura integral das auditorias, localização da fonte atual, verificação dos SHAs/hashes, conferência dos caminhos de mapeamento, revisão de cobertura dos requisitos e checks de Git/whitespace. Lint/typecheck/test/build da aplicação **não são aplicáveis a esta alteração exclusivamente Markdown** e não foram executados; resultados históricos estão identificados como históricos, inclusive R1 e E2E R2 ainda não corrigidos.

Conferência final: Git mostra somente este Markdown novo e não versionado, sem alterações staged. `git diff` e `git diff --check` não apontam alterações em arquivos já rastreados. Como o arquivo é novo, também foi conferido com `git diff --no-index --check /dev/null docs/architecture/bunkercode-reconstruction-target.md`: sem diagnósticos de whitespace; exit 1 decorre da diferença contra o arquivo vazio. Foram conferidos os cinco diagramas, as 27 respostas, fechamento de blocos de código e existência dos links locais. Nenhum commit/push realizado.

Review sugerido: conferir se a Attempt preserva o que foi respondido antes da evidência, se reserveStock cabe sem HTTP/System/Git e se cada remoção depende de um fluxo novo validado. Revisar especialmente a escolha de estado em memória no slice, a retenção de fonte/evidência e o gate que impede reutilizar reset/restart defeituosos.

Commit sugerido: `docs: define BunkerCode reconstruction target architecture`.

## Implementação inicial — atualização de estado

A missão posterior autorizou fases 0–4. Os dois relatórios foram preservados byte a byte em `docs/audits` neste checkout, com hashes iguais aos registrados acima; os links passaram a apontar a essas cópias canônicas. Fontes originais continuam nos caminhos da proveniência histórica. AGENTS foi atualizado para a nova tese.

As duas atividades foram implementadas com API de aprendizagem própria, SQLite novo, submissões separadas e supervisor para proteger cleanup/perda do pai. A arquitetura conceitual permanece; detalhes físicos, limites, verificações, bugs corrigidos e reviews estão em [primeiros fluxos](../implementation/first-learning-flows.md). Cursos/analyzer/demolição continuam fora desta missão. Os parágrafos anteriores descrevem a rodada arquitetural e seus gates, não substituem o estado real da implementação.
