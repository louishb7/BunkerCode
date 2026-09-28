import type { LabDefinition } from '@backendlab/protocol';

export const lab001Definition: LabDefinition = {
  id: '001-request-lifecycle',
  number: '001',
  title: 'Request Lifecycle',
  area: 'Execution',
  mode: 'observe',
  status: 'available',
  question: 'Como uma request cria um pedido e altera o estoque?',
  description: 'Observe o lifecycle da criação de um pedido no Reference System.',
  concept: 'Request HTTP, chamada de funções e mudanças de estado no NestJS',
};
