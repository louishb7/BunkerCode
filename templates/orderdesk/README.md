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
