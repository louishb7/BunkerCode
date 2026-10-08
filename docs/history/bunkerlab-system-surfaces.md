> Histórico: descreve o laboratório anterior à consolidação de 2026-10-08. Não é arquitetura ativa nem backlog. Paths e comandos do corpo registram a árvore antiga.

# Systems primeiro: surface, uso comum e testes

## Decisão de produto

A bancada anterior começava por uma hipótese pronta, parâmetros e resultado esperado. A superfície de trabalho agora é o sistema funcionando. Testes são ferramentas opcionais, não missões.

Workbench hospeda a interface do sistema; a toolbar oferece código, teste e restart. Detalhes de runtime, logs e reset ficam sob demanda. Não há header global, breadcrumb de workspace, sequência de aulas ou histórico na Home. Sidebar pode ser recolhida a ícones ou ocultada; a preferência fica no navegador. Sistemas lista o catálogo e abre a seleção. Histórico contém apenas Runs deliberadas. Checkpoints mantém a evolução do código e seu restore seguro.

## Surface pertence ao sistema

O catálogo de `SystemSummary` declara `surface` opcional com `title`, `path` e operações permitidas. OrderDesk serve `surface.html` por `GET /surface`, no próprio processo autenticado do runtime. O documento está no template, na cópia editável, nos snapshots e nos checkpoints.

O BunkerLab consulta esse endpoint e hospeda o HTML em `iframe srcdoc`, com `sandbox="allow-scripts"`, **sem** `allow-same-origin`. Isso separa DOM/origem da surface do host. A CSP bloqueia conexões, assets externos, forms e base URL; CSS/JS inline e imagens data são permitidos. Este é isolamento da interface no navegador, não uma sandbox do backend. [Comportamento de iframe sandbox na MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe).

Não existe componente React `OrderDesk`, condicional por nome de produto, teclado ou estoque no Workbench. A ilustração, catálogo, formulário, renderização de pedidos e mensagens HTTP são do `surface.html`.

A surface usa uma ponte mínima de transporte:

```text
surface: postMessage { type: 'bunkerlab:request', id, method, path, body }
  → host valida event.source e a operação declarada
  → POST /workspaces/:workspaceId/systems/:systemId/activities
  → control plane valida allowlist, exclusividade e tamanho
  → HTTP real contra o runtime, com credencial mantida no servidor
  → coleta de Activity e flush IPC
  → host devolve { type: 'bunkerlab:response', id, response: { status, body } }
```

A resposta de transporte pode conter `error` quando não houve resposta HTTP. HTTP 400/409/500 são respostas do sistema, não exceções inventadas pelo host. A surface renderiza os dados reais e trata esses códigos.

O canal usa target origin `*` porque o frame tem origem opaca; o host aceita somente mensagens do `contentWindow` do frame atual. IDs correlacionam chamadas e respostas; o token do runtime nunca é enviado ao frame. O host não transforma o corpo de pedidos e não executa lógica de estoque.

O protocolo atual é intencionalmente pequeno: GET/POST JSON e um documento HTML autocontido. Não há bundler, instalação npm ou framework separado para cada sistema. Um segundo sistema pode fornecer outra interface e outras operações sem alterar o host.

## Activity não é Run

Activity é uma chamada normal encaminhada pela surface. Possui método, path, corpo enviado, status/corpo recebido, timestamps, duração, versão de código e eventos reais correlacionados. A leitura automática inicial e a atualização da lista também são Activities; polling operacional do laboratório não é.

Um `ActivityBuffer` por workspace/system guarda até 50 interações em memória. Cada interação retém no máximo 200 eventos de até 8 KiB por payload; truncamento é explícito. Respostas HTTP têm limite de 1 MiB no runtime manager. A listagem não inclui corpos ou eventos. Detalhes expirados retornam 404 com explicação.

Não há migrations ou tabelas novas para Activities: uso comum, inspeção e erros HTTP não criam Runs e não acumulam telemetry eterna. Reiniciar a API perde Activities; reiniciar/resetar só o sistema preserva o buffer da sessão. Essa escolha privilegia observação imediata; exportar/promover uma Activity a investigação ainda não existe.

O coletor de Activity e o coletor de Run têm assinaturas independentes no runtime manager. Events de Run têm `runId` e não entram em Activity. Ambos recebem eventos IPC reais. Um crash pode fechar a conexão HTTP antes do evento `exit`; o cleanup preserva o evento de saída antes de encerrar a Activity.

## Testar reutiliza o motor

`ExperimentRunner` e suas Runs persistidas foram preservados. A ferramenta Concorrência usa a definição existente, com parâmetros editáveis. A configuração informa o reset necessário à reprodutibilidade; não mostra resultado esperado nem invariante antecipadamente.

Depois da execução o painel mostra respostas de sucesso, rejeições e observações mensuradas. OrderDesk fornece a observação de estoque inicial → final e informa se terminou negativo. O usuário pode abrir o Inspector ou a [investigação guiada opcional](bunkerlab-guided-investigations.md), quando a evidência oferecer esse contexto.

O runner não valida mais `product`/`orders` diretamente. A definição fornece `validateState`, `validateInitial`, `statePath` e observações. `SystemState` é opaco ao núcleo; o contrato tipado `OrderDeskState` é específico do sistema. Configurações usam campos declarados pela ferramenta. A UI renderiza essas definições e observações, sem conhecer estoque. Resultados antigos recebem observações pelo adapter da definição na leitura, sem regravar evidências antigas.

Invariantes permanecem implementadas na definição e visíveis sob detalhes no Inspector. Não foi criado DSL de regras. Compare mostra condições, versão e observações antes/depois.

## Exclusividade e falha

Surface, restart, reset, checkpoints e runner usam a mesma exclusividade por sistema. Enquanto uma Run está em andamento, interação manual recebe 409 e a surface fica bloqueada para evitar contaminar o teste. Chamadas manuais são serializadas; concorrência deliberada pertence ao runner.

Ao abrir uma bancada parada, `runtime/open` inicia o sistema sem criar Run. Chamadas repetidas são idempotentes; runtime em estado `crashed` não entra em loop automático de restart. Erro de inicialização é apresentado como estado do runtime.

HTTP 500 mantém a surface, mostra erro e permite inspecionar a Activity. Syntax error/crash/timeout substitui a surface por diagnóstico e ações de logs/restart. Timeout encerra o processo para impedir mutações tardias. Histórico e checkpoints seguem utilizáveis. Reset exige confirmação curta e não altera código/histórico.

## Upgrade de workspace existente

A integração não pode sobrescrever código evoluído pelo usuário. O upgrade identifica o hash exato de `server.mjs` da versão canônica anterior, salva checkpoint de segurança, adiciona `surface.html`, atualiza só o servidor conhecido e salva checkpoint do upgrade. `inventory.mjs` e outros arquivos permanecem.

Se o servidor tiver sido customizado, o upgrade não altera nada. Para integrar manualmente: compare `templates/orderdesk/server.mjs` e adicione o handler autenticado `GET /surface` que lê `surface.html`; copie/edite o HTML do template, salve checkpoint e reinicie. A UI informa que a surface está indisponível quando o endpoint não existir; o teste de backend continua disponível.

Um marcador em `.git/bunkerlab-surface-v1` impede reaplicar o upgrade após restore de um checkpoint anterior. Isso preserva a intenção do restore. Esse marcador não é código nem runtime state: é estado local de migração do workspace.

## Limitações e decisões de menor confiança

- A ponte postMessage exige surfaces adaptadas ao pequeno contrato; não hospeda qualquer aplicação web existente sem integração. Isso é suficiente para os sistemas pequenos atuais, mas deve ser revisto diante de assets, uploads ou navegação própria.
- Isolamento do frame não garante recuperação de JavaScript da surface que deliberadamente bloquear a thread do navegador. Não há watchdog de UI ou recuperação automática de HTML/JS inválido. O tratamento de falhas validado cobre o backend.
- Os limites do buffer são escolhas operacionais para uso local; não foram dimensionados para tráfego contínuo. Inspecionar não torna uma Activity persistente.
- O lock serializa uso humano entre abas. Não há sessões isoladas por navegador ou suporte multiusuário.
- Configuração de tool ainda é numérica; o segundo tipo concreto de investigação deverá orientar outros tipos, sem DSL preventivo.
- Upgrade Git/filesystem/metadata não é uma transação única. O backup protege a evolução anterior, mas interrupção durante upgrade pode demandar intervenção manual. Servidor customizado exige integração manual.
- Snapshots, SQLite síncrono, retenção de disco e execução local confiável mantêm os limites da arquitetura anterior.
