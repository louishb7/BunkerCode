# OrderDesk

Backend experimental local. O BunkerLab copia este template para um workspace com Git próprio.
Edite `inventory.mjs` **no workspace**, não no template, e reinicie o runtime pela interface.

`strategy = 'naive'` faz SELECT → validação → UPDATE sem revalidar o estoque.
O banco executa em um worker: cada chamada atravessa uma fronteira assíncrona real.
Requests podem ler o mesmo estoque antes de escrever. Não há atraso artificial nem garantia de falha em toda run.

`strategy = 'atomic'` executa UPDATE condicional e INSERT na mesma transação.
É uma referência funcional para comparar, não uma solução para todos os problemas de concorrência.

O servidor oferece `GET /state`, `POST /orders` e `POST /reset`, em porta loopback efêmera.
O manager fornece o caminho do banco e uma capacidade de acesso via ambiente. Não há dependências npm.
A evidência enviada por IPC descreve operações reais; a versão do código e a ordem observada são preservadas pelo laboratório.

## Surface

`surface.html` é a interface do OrderDesk. É servida pelo próprio runtime em `GET /surface` e carregada no BunkerLab em um iframe isolado. Edite este arquivo no workspace e reinicie para mudar a interface, sem editar `apps/web`.

A surface usa a ponte `bunkerlab:request`/`bunkerlab:response` via postMessage para chamar GET `/state` e POST `/orders`. O host encaminha HTTP real, mantém a credencial no servidor e coleta Activities transitórias. O estoque e os pedidos não são mantidos como uma simulação no host.

HTML/JS/CSS são autocontidos. Assets externos, acesso ao DOM do pai e chamadas diretas às APIs do laboratório são bloqueados pelo frame. Isso não transforma o backend local em uma sandbox para código não confiável.
