# Evolução do Reference System

Referência interna do laboratório. A hipótese atual é aprofundar um único sistema pequeno de pedidos e estoque conforme problemas backend aparecerem, em vez de construir uma mini aplicação por conceito. Não é uma sequência de aulas visível na interface.

Hoje o sistema usa memória e executa a criação de pedido de forma síncrona em uma API NestJS. Request Lifecycle pode ser investigado ao usar essa operação real.

| Problema a investigar | Conceito | Possível evolução |
| --- | --- | --- |
| Reiniciar a API perde os pedidos | Persistent State | Armazenamento em PostgreSQL |
| Pedido e estoque precisam permanecer consistentes | Transactions | Relacionar as duas mudanças atomicamente |
| Duas requests tentam comprar o último item | Race Condition | Observar a concorrência real quando a execução permitir intercalamento |
| Operações concorrentes disputam estoque | Locks / concurrency control | Avaliar uma estratégia de coordenação |
| Muitas criações tornam requests lentas | Load | Medir carga antes de alterar a implementação |
| Parte da operação precisa continuar depois da resposta | Queue / Worker | Processamento assíncrono de confirmação ou fulfillment |
| Worker ou dependência falha | Retry | Investigar tentativas e consequências |
| A mesma operação é enviada ou executada duas vezes | Idempotency | Evitar efeitos duplicados |
| Leituras de produto ficam custosas | Cache | Comparar leitura direta e cache |
| Mais de uma API atende o sistema | Multiple Instances | Observar estado, coordenação e falhas entre instâncias |

Estas possibilidades não estão implementadas. Não há banco, queue, worker, cache ou locks nesta fase. Não introduzir infraestrutura antes de existir um comportamento concreto a investigar.

O domínio comercial deve permanecer mínimo. Para uma nova feature, perguntar: **ela cria ou demonstra um problema de engenharia backend relevante?** Se não, deixá-la fora do Reference System. Observability acompanha a evolução como instrumento de investigação, sem dominar a experiência de uso.
