# Arquitetura

BunkerLab é o ambiente de engenharia, organizado por uma application shell permanente. **OrderDesk** é o nome provisório do Reference System / System Under Test: uma aplicação mínima de pedidos e estoque dentro do laboratório. O **Workbench** permite usá-la; **Execuções** lista ações observadas; o **Inspector** investiga uma run selecionada. **Experimentos** reserva espaço para manipulação controlada futura, sem simular funcionalidades.

A experiência começa em uso → consequência → inspeção. O usuário cria um pedido, vê estoque e pedidos mudarem e então pode investigar a execução que produziu essas mudanças.

## Responsabilidades

- `apps/api/src/system`: `OrdersService` mantém um produto e pedidos em memória. `OrdersController.create()` atende `POST /system/orders`; `SystemController` expõe produto e reset. A quantidade precisa ser inteira, positiva e caber no estoque. Produto desconhecido retorna 404; quantidade inválida, 400; falta de estoque, 409.
- `RunsService`: prepara runs, valida a correlação, registra timestamps e eventos, encerra a run e oferece snapshot e SSE com replay.
- `RequestLifecycleMiddleware`: correlaciona a request de criação, registra entrada e resposta e fornece o `LabContext` ao controller. O service depende apenas desse contexto de emissão, sem conhecer transporte SSE ou armazenamento de runs.
- `apps/web`: shell com sidebar e header de ambiente; o OrderDesk ocupa uma superfície própria. Reset fica no header do laboratório. IDs completos, eventos e runtime aparecem apenas na inspeção.

O sistema observado e a infraestrutura do laboratório compartilham um processo NestJS, mas têm responsabilidades separadas. O navegador é o client da operação. A API não executa um `fetch` loopback nem inicia uma request de demonstração.

## Correlação da ação

Ao clicar em Criar pedido, o Workbench:

1. prepara uma run `pending` por `POST /labs/001-request-lifecycle/runs`, recebendo `{ run, requestToken }`;
2. abre o SSE da run;
3. envia `POST /system/orders` com o produto, quantidade e headers de correlação;
4. atualiza produto e pedidos a partir da API;
5. atualiza a lista de runs e oferece um link para inspecionar a última execução.

O middleware valida `x-bunkerlab-run-id` e `x-bunkerlab-run-token`, aceita a preparação uma única vez e muda a run para `running`. O token é uma capacidade de correlação local, não autenticação. Ele não aparece nos eventos. Uma request direta sem esses headers recebe uma run automaticamente; seu ID volta em `x-bunkerlab-run-id`. Assim, a API de domínio também funciona sem o Workbench. Headers incompletos ou inválidos são rejeitados antes de alterar o domínio.

A resposta HTTP encerra a run como `completed` ou `failed`. Uma conexão encerrada antes de terminar a resposta pode marcá-la `abandoned`. Abandonar observação não desfaz um pedido já criado. Runs independentes podem coexistir; não há mais a restrição artificial de uma única run ativa.

## Evidências

Na criação bem-sucedida:

```text
run.started
request.received
controller.entered
service.entered
order.created
stock.updated
service.completed
controller.completed
response.sent
run.completed
```

O controller chama `OrdersService.create()`. O service valida, armazena o pedido e decrementa o estoque; os eventos de domínio são emitidos após cada mudança efetiva. Eles são evidências, não event sourcing. Em falha de validação, `service.failed` e `controller.failed` substituem os eventos de conclusão; a resposta e `run.failed` registram o status real.

REST transporta comandos e snapshots; SSE entrega os eventos. O Workbench abre SSE antes da criação, recebe telemetria mesmo com o inspector fechado e reconcilia o resultado final com o snapshot. SSE também reproduz eventos de runs encerradas. As funções do call flow vêm dos payloads de entrada. Request metadata vem do middleware; runtime informa Node.js, PID e porta reais.

Os intervalos são diferenças entre timestamps do backend, com resolução de 1 ms. Handler inclui service; esses intervalos não devem ser somados. A duração apresentada não mede a rede ou o tempo percebido pelo navegador. Não há eventos de client fabricados pelo servidor.

## Shell, navegação e estado

React Router organiza `/` (Workbench), `/runs` (Execuções), `/runs/:runId` (Inspector), `/inspector` (seleção atual ou última run) e `/experiments`. Links diretos carregam o snapshot pelo UUID; a apresentação usa somente seus primeiros oito caracteres. O UUID completo permanece nos detalhes. Hospedagem do frontend precisa encaminhar essas rotas para `index.html`, como o Vite faz em desenvolvimento.

`WorkspaceProvider` fica acima das rotas. Ele mantém a operação e a assinatura SSE durante a navegação, compartilha o estado do ambiente e reconcilia domínio e histórico após a ação. Não há biblioteca de estado global. A lista atualiza ao entrar em Execuções, após ações e por comando manual; não há polling contínuo. O Inspector consulta a run indicada pela URL, com atualização manual para snapshots ainda ativos.

`GET /labs/001-request-lifecycle/runs` retorna resumos em ordem de criação decrescente, sem tokens ou listeners. A ação `create-order` já identifica o significado da run. O campo opcional `request` registra método/path efetivamente recebidos; runs ainda pendentes não fingem ter executado HTTP.

No Inspector, Visão geral reúne fluxo e mudanças de estado. Eventos oferece timeline e detalhe; Runtime e Raw ficam em abas secundárias. `stock.updated` registra estoque anterior/atual; `order.created` registra pedido e contagens anterior/atual. Esses valores vêm da mutação real e permanecem válidos como evidência histórica após reset. Não são um diff genérico nem uma leitura do estado atual.

Tailwind CSS 4 com plugin Vite substitui a stylesheet legada. CSS global contém apenas tokens semânticos e regras de base. React Router 7 resolve navegação e links diretos; Lucide já existente fornece ícones. Não foi necessária biblioteca de animação ou componentes pesados.

## Limites atuais

O estado é transitório: restart perde pedidos, runs e eventos e recria produto e estoque inicial. Reset restaura o domínio e preserva a seleção do Inspector e as runs anteriores. O histórico não possui persistência, paginação ou limite de retenção nesta fase local.

A validação e a mutação do estoque são síncronas, sem `await`, dentro de um único processo. Hoje requests concorrentes não intercalam esse trecho; isso não oferece uma transação persistente nem proteção entre múltiplas instâncias. Reads e reset não são instrumentados nesta rodada. Cada Workbench atualiza seu estado após suas ações; mudanças de outros clients aparecem ao recarregar.

Runs preparadas têm cleanup de melhor esforço no frontend, sem expiração ou persistência. O ambiente continua local, sem autenticação. Student workspaces e os modos de ajuste ou edição ainda não estão implementados. VS Code permanece a bancada externa de edição.
