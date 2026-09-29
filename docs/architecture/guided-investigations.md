# Investigação guiada, sem transformar a bancada em curso

## Responsabilidades e relações

| Conceito | Responsabilidade | Retenção |
| --- | --- | --- |
| Activity | Interação comum da surface com HTTP real e evidências correlacionadas | Buffer da API, até 50 interações |
| Run | Execução deliberada: configuração, estado inicial/final, requests, evidências e versão efetivamente executada | SQLite do Lab; snapshot no disco |
| Investigation | Contexto de raciocínio que referencia uma baseline e várias tentativas; ajuda opcional | localStorage por workspace/system |
| Checkpoint | Ponto do código salvo no Git isolado; não salva banco | Git do workspace e metadados no SQLite |
| Workspace code | Arquivos editáveis no VS Code | Diretório do workspace |
| Runtime code | Snapshot que o processo separado está executando | Snapshot identificado na Run/Activity |

Fluxo: usar a surface → Testar → observar uma Run → abrir investigação → inspecionar evidência → localizar código → pedir ajuda se necessário → salvar checkpoint opcional → editar → aplicar → repetir as condições → comparar Runs reais.

Investigation não é uma Run nem altera resultados. `InvestigationContext` guarda `definitionId`, `baselineRunId`, `comparisonRunIds`, `revealed` e `checkpointId` opcional. Versões de código são obtidas das próprias Runs, evitando duplicação. Fechar o drawer, navegar e recarregar preservam as pistas abertas. Há um contexto ativo por workspace/system nesse navegador, sem progresso curricular. Iniciar outra baseline substitui esse contexto; as Runs continuam no histórico. Limpar localStorage perde apenas o contexto, não as evidências. Não há sincronização entre abas.

## Contrato pequeno, conteúdo fora do React

`apps/api/src/investigations/definition.ts` define identificação, escopo de sistema/experimento e `inspect(RunDetail)`. O registry `index.ts` aplica somente definições compatíveis. A resposta adicional `RunDetail.investigations` contém views derivadas, não regrava evidências nem resultados históricos.

`apps/api/src/investigations/orderdesk.ts` pertence ao conhecimento do OrderDesk: título, disponibilidade, seleção de eventos, fatos, perguntas, arquivos e ajuda. Fica na API porque interpreta evidência do experimento e não deve acompanhar o código editável do aluno. O React só apresenta o contrato genérico. Não há framework de plugins, LLM ou chamadas externas.

A definição v1 é aplicável a Runs completas da ferramenta Concorrência com resultado. Oferece investigação quando o estado final ou um evento real `stock.written` registrou estoque negativo. Runs com erro/interrupção não geram uma conclusão sobre a propriedade. Uma Run sem estoque negativo informa apenas essa ausência; não afirma que toda regra de negócio foi preservada. O convite fica discreto e pode ser dispensado para aquela Run.

A seleção procura duas leituras positivas do mesmo valor por requests diferentes, seguidas por escritas correlacionadas na ordem coletada. Inclui uma escrita negativa, prioriza o menor estoque lido para reduzir ruído e mostra até quatro eventos. O recorte avisa que outras requests ocorreram entre esses eventos. Se esse padrão não está registrado, apresenta a leitura/escrita da request negativa disponível e explica que a sequência dupla não foi encontrada. Não completa lacunas. Labels referenciam `sequence` existente na Run; IDs e payloads permanecem inspecionáveis. Ordem IPC recebida não é um relógio global das operações SQLite.

## Ajuda progressiva

1. Fatos medidos: estoque inicial/final, pedidos persistidos e requests executadas.
2. Evidência selecionada e pergunta sobre o conhecimento de cada request.
3. Arquivo `inventory.mjs`, símbolo `createOrder`, link VS Code e caminho alternativo. Não fixamos números de linha que ficariam incorretos após edição.
4. Pista sobre operações separadas.
5. Pista sobre duas requests e uma unidade.
6. Conceito de check-then-act, interleaving e atomicidade; famílias de solução e limites de uma transação apenas na escrita.
7. Direção para `order-store.mjs`, SQL parametrizado e `result.changes`, sem código corrigido.

Não existe botão de solução. Repetir a Run não depende de abrir pistas. O checkpoint antes da tentativa é opcional e captura o workspace atual, que pode já diferir da baseline.

## Código editável e Apply

O template não exporta `strategy` e não possui `atomicOrder`. `inventory.mjs` mantém uma leitura, uma decisão e uma chamada assíncrona de persistência. `order-store.mjs` contém a implementação pequena de escrita; `database.mjs` mantém driver, worker e emissão de eventos. A versão inicial continua problemática. Alterar sua propriedade exige editar a implementação, não selecionar outra pronta. A referência corrigida está apenas em `apps/api/test/fixtures/conditional-order-store.txt`.

O polling existente (~1,8 s) calcula o digest dos arquivos do workspace e o compara ao digest do snapshot carregado. `workingCode.dirty` indica diferença em relação ao Git; é **outra** propriedade. Salvar checkpoint pode limpar Git e ainda deixar alterações não aplicadas no runtime.

“Aplicar e reiniciar” reutiliza `runtime/restart`: captura snapshot consistente, para/inicia o processo e preserva o banco. Não existe hot reload. Falhas de sintaxe deixam o Lab acessível. O usuário precisa salvar no editor antes da captura. Edições simultâneas à captura são rejeitadas pela verificação de digest existente. A próxima Run registra exatamente o snapshot executado.

A reexecução utiliza `baseline.experimentId` e uma cópia de `baseline.config`; prepara novamente o estado inicial pelo setup real existente. Não usa parâmetros atuais da ferramenta Testar. O drawer bloqueia sua reexecução enquanto houver alterações pendentes, para evitar confundir tentativa com código antigo. A comparação mostra baseline versus a última tentativa, links para os detalhes e se o código mudou. Tentativas anteriores continuam referenciadas no contexto e disponíveis no histórico. Um teste sem estoque negativo não prova correção universal.

Testar começa com Clientes simultâneos, que preenche requests e concorrência com o mesmo valor. Configurações avançadas preservam os três controles. Ao voltar ao modo simples sem editar seu número, configurações avançadas existentes são preservadas.

## Checkpoints e compatibilidade

Migration `002-checkpoint-kind.sql` distingue `user`, `backup`, `restore` e `system`. A classificação de registros antigos usa os nomes históricos conhecidos uma única vez. Novas operações gravam o tipo explicitamente. Nomes de usuário novos não determinam o tipo. Backups e registros de restore ficam recolhidos juntos; ambos permanecem restauráveis. A ordem segura continua: checkpoint completo do estado atual → Git restore → registro da restauração. Não houve remoção de arquivos de segurança nem commits no Git principal.

O upgrade do workspace antigo reconhece, byte por byte, `inventory.mjs`, `database.mjs` e README da versão canônica anterior, cria backup e instala os arquivos novos. `order-store.mjs` preexistente ou arquivos customizados impedem sobrescrita automática. Um marcador no Git isolado evita reaplicar a migração depois de restore. Código customizado precisa de adaptação manual; restaurar um checkpoint antigo também pode reintroduzir a versão com toggle. O backup mantém deliberadamente essa versão histórica, sem oferecê-la como solução na investigação. Git, filesystem e SQLite não compõem uma única transação; interrupção no meio do upgrade ainda pode exigir intervenção manual.

## Invariantes: direção futura

Hoje as assertions do experimento continuam funcionando. A investigação interpreta uma propriedade observada; não copia o ciclo de execução do runner. Se houver um caso concreto de preservar descobertas, extrair uma definição de regra do sistema (id estável, descrição, avaliador sobre estado/evidências) permitirá que experimentos e investigações a referenciem. `stock >= 0` poderá ser uma regra preservada pelo usuário, independente de uma configuração de carga. Não introduzimos DSL, schema de regras, botão de conclusão nem uma abstração sem esse caso implementado.

## Limites e confiança

Concorrência é não determinística; não há sleeps/barreiras para produzir a falha. A orientação v1 conhece a instrumentação e os símbolos do template; edições que removem eventos ou renomeiam arquivos podem reduzir sua utilidade, sem invalidar os registros já salvos. A comparação não executa teste estatístico nem demonstra universalidade. Polling de digest é proporcional ao workspace pequeno (limite existente de 5 MiB), não foi medido para grandes repositórios. A eficácia pedagógica precisa de observação com um iniciante real; o ensaio no navegador verifica fluxo e divulgação gradual, não mede aprendizado humano.
