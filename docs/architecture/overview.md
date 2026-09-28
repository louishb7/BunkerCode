# Arquitetura do laboratório local

## Decisão

A aplicação anterior executava um domínio síncrono em memória dentro do NestJS e tratava cada POST como uma Run. Mantivemos React/Vite, React Router, NestJS, TypeScript e o pacote de contratos. Substituímos o domínio acoplado, o currículo, o SDK sem consumidores e o SSE por um runner experimental com persistência e polling.

Uma Run aplica condições, executa workload, coleta evidências e verifica invariantes. A versão de código é parte do resultado. Na direção atual, o usuário começa usando a surface real do sistema e abre Testar quando precisar de uma investigação reproduzível. Veja [Surfaces e Activities](system-surfaces.md).

```text
React → HTTP / NestJS control plane → ExperimentRunner
                   │                       │
                   ├─ LabRepository        ├─ HTTP concorrente
                   │  └─ lab.sqlite        ↓
                   ├─ WorkspaceManager   OrderDesk (processo filho)
                   │  ├─ filesystem        ├─ HTTP server
                   │  └─ Git próprio       └─ worker de banco → state.sqlite
                   └─ RuntimeManager              │
                          ↑ IPC ← evidências reais┘
```

## Três responsabilidades

| Estado | Onde vive | O que altera |
| --- | --- | --- |
| Code state | Workspace Git e snapshots no filesystem | VS Code, checkpoint, restore |
| Runtime state | SQLite exclusivo do OrderDesk | Pedidos e reset |
| Lab metadata | SQLite do BunkerLab | Runs, configurações, resultados, evidências, checkpoints |

Código-fonte nunca é armazenado no banco do laboratório. O runtime recebe um snapshot, não executa diretamente arquivos que podem mudar durante a Run. O snapshot possui SHA-256 calculado sobre nomes e conteúdo; a captura verifica mudanças durante a cópia. `commit`, `dirty` e digest identificam o código carregado. Uma edição posterior aparece como divergência e exige restart explícito.

## Persistência

Escolhemos SQLite em vez de PostgreSQL nesta rodada porque o repositório não tinha banco nem infraestrutura de serviços. Precisamos preservar histórico local e separar transações do sistema de metadata, não estudar propriedades específicas do PostgreSQL. Dois arquivos independentes oferecem essa separação sem um daemon adicional.

`LabRepository` concentra SQL e mapeamento. Migrations SQL versionadas são aplicadas transacionalmente e registradas em `migrations`. Workspaces, systems, experiments, runs, requests, evidence e checkpoints possuem tabelas, chaves e índices. JSON é usado somente para documentos variáveis: payloads, config, snapshots de estado observado e resultados. Não existe um JSON global emulando banco, código e runtime.

Uma futura migração para PostgreSQL precisará de adapter assíncrono/revisão do repositório e migrations próprias. A interface HTTP e os sistemas não dependem de SQLite do laboratório. Esta separação reduz o alcance da migração, mas não a torna automática.

Cada request e evento é persistido à medida que chega. Runs ainda `running` após reinício da API viram `interrupted`, preservando evidência parcial. O banco não reexecuta uma Run automaticamente.

## OrderDesk e a concorrência

O servidor experimental é pequeno e não depende do NestJS ou de pacotes npm. Usa HTTP do Node e um worker para executar SQLite. A fronteira assíncrona do worker permite múltiplas requests em andamento, mesmo que cada operação SQL seja síncrona no worker.

- `naive`: SELECT → validação no handler → UPDATE sem condição + INSERT em transação. A transação mantém pedido e decremento juntos, mas a decisão de estoque ocorreu antes dela. Duas requests podem validar a mesma disponibilidade.
- `atomic`: UPDATE com `stock >= quantity` + INSERT na mesma transação. Só cria pedido se a reserva alterou uma linha.

Não há sleeps, barreiras de experimento ou números aleatórios decidindo resultados. A race é de check-then-act real. Não é garantido que toda Run da versão ingênua falhe. O número de aceitações depende do escalonamento.

O banco deliberadamente não possui CHECK `stock >= 0`, pois queremos observar a falha da lógica e compará-la com a escrita condicional. Isso não é uma recomendação para produção. A versão atomic é referência limitada a uma instância/worker e este domínio.

## Runner

`catalog.ts` registra sistemas e definições. `experiments/overselling.ts` contém setup, operação e assertions. Não há switches por nome de experimento espalhados pelo control plane.

Fluxo:

1. Adquire exclusividade por workspace/system e captura a versão carregada.
2. Persiste a Run `running` antes de iniciar o processo, permitindo registrar até erro de sintaxe.
3. Prepara e verifica o estado inicial.
4. Workers assíncronos do runner disparam requests HTTP reais, respeitando o limite de concorrência e o total de compradores.
5. Persiste status, corpo, erro, correlation ID, início e duração de cada request.
6. Lê o estado final e aguarda um fence IPC para terminar a coleta anterior.
7. Verifica estoque mínimo observado/final, aceitos, rejeitados, conservação de unidades, pedidos persistidos e erros.
8. Salva resultado; preserva estado para inspeção. Uma falha de transporte encerra o runtime para impedir escrita tardia contaminando a próxima Run.

Resultados: `passed` (assertions satisfeitas), `failed` (hipótese violada), `error` (execução/setup/transporte/servidor), `interrupted` (control plane encerrou antes de concluir).

Reset, restart, checkpoint, restore e outra Run são rejeitados com 409 durante execução. Não existe fila escondida. O workload aceita no máximo 100 compradores, 100 de concorrência e estoque entre 0 e 100; requests têm timeout de 3 s e o experimento tem deadline de 15 s. Respostas são lidas com limite de 1 MiB. O lock é por sistema e existe um lock de processo para o diretório local de metadata.

## Evidência e limites das medições

O OrderDesk emite entrada de request, leitura, escrita confirmada, rejeição, violação e resposta via IPC. O runner emite setup/workload/assertions/teardown e resultados HTTP. Eventos possuem sequência de coleta monotônica e timestamps reais de emissão. O `systemSequence` preserva a ordem no emissor.

A sequência global é ordem de **coleta**, não uma alegação de causalidade total entre HTTP e IPC. Duração de request usa relógio monotônico no runner e inclui transporte local. Evidência do banco é emitida após a resposta do worker à operação concluída. Não há instrumentação de cada função nem tracing distribuído.

Persistir cada evidência tem overhead. Os números não são um benchmark de performance do backend sem instrumentação. Logs são limitados a 40 blocos de 4 KiB; eventos emitidos pelo runtime por Run têm limite de 10 mil, com truncamento explícito.

## Checkpoints

O workspace é um repositório Git independente. Comandos usam `execFile` com argumentos separados, sem interpolação shell; identidade local explícita, sem hooks globais ou signing. O repositório principal não recebe commits.

Salvar checkpoint cria um commit e depois metadata com hash/digest/descrição. Runs associam o checkpoint cujo conteúdo coincide com o código carregado. O hash do commit carregado continua preservado mesmo se o checkpoint foi salvo depois do restart.

Restore recebe um ID de checkpoint conhecido, salva antes um checkpoint de segurança (incluindo arquivos novos), restaura a árvore e cria um novo checkpoint de restauração. O histórico Git não é reescrito, o runtime fica parado e o runtime state não muda. A UI exige confirmação concreta e explica a cópia de segurança.

Git e SQLite não formam uma transação distribuída. Se o commit funcionar e a gravação de metadata falhar, o commit permanece recuperável no Git; a UI informa erro. Não existe navegação/diff de código como em um cliente Git.

## Interface

Workbench é um host genérico para a surface do sistema. OrderDesk serve HTML/JS do seu próprio snapshot. Uso comum gera Activities transitórias; Testar é um drawer que usa o runner persistente existente. Histórico preserva Runs deliberadas, Inspector pertence à atividade/Run e Compare apresenta condições/observações.

A sidebar é recolhível e pode ser ocultada. Não existe header global ou resultado esperado na bancada. Sistemas lista o catálogo; código, logs, hashes e runtime aparecem sob demanda. O tema claro com laranja foi preservado.

O runner delega validação de estado e observações à definição do teste; produto, pedido e estoque não são pressupostos do host. O adapter do OrderDesk mantém as avaliações existentes.
