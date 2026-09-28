# AGENTS.md — BunkerLab

Este arquivo define regras permanentes para agentes de programação trabalhando no BunkerLab.

Leia estas instruções antes de modificar o projeto.

As instruções deste arquivo são válidas para todo o repositório, salvo quando uma tarefa específica declarar explicitamente uma exceção.

---

# 1. Propósito do projeto

BunkerLab é um laboratório pessoal de engenharia de backend.

Seu objetivo principal NÃO é:

- ser um produto comercial;
- maximizar valor de portfólio;
- parecer uma plataforma educacional;
- funcionar como curso;
- ensinar através de gamificação;
- acumular features.

Seu objetivo é fornecer uma infraestrutura visual e técnica para:

- executar sistemas backend reais;
- observar comportamento;
- inspecionar eventos e estado;
- provocar falhas;
- alterar parâmetros;
- modificar código;
- repetir experimentos;
- comparar resultados;
- formar modelos mentais sobre engenharia de backend.

Princípio central:

> BunkerLab é um laboratório, não um curso.

O aprendizado deve surgir da investigação do sistema.

---

# 2. Filosofia de implementação

Sempre prefira:

**execução real → instrumentação → observação**

em vez de:

**simulação visual → explicação artificial**

Se a interface afirmar que algo aconteceu no backend, isso deve, sempre que razoavelmente possível, ter realmente acontecido.

Exemplos:

- uma request visualizada deve ser uma request real;
- uma query exibida deve corresponder a uma query executada;
- um lock mostrado deve representar um lock real;
- uma falha deve, quando seguro e adequado, ser reproduzida de verdade;
- métricas devem derivar de medições reais.

Simulação é permitida quando execução real for desnecessariamente perigosa, impraticável ou incapaz de contribuir para o aprendizado.

Quando houver simulação, ela deve ser identificada explicitamente.

---

# 3. Menos curso, mais laboratório

Evite transformar a interface em uma plataforma didática tradicional.

Não priorize:

- progresso percentual;
- achievements;
- ranking;
- níveis artificiais;
- mensagens de parabéns;
- grandes explicações introdutórias;
- cards excessivos;
- fluxos obrigatórios de aula;
- linguagem como "agora você aprendeu X";
- decoração que não contribui para investigação.

Prefira:

- scenarios;
- runs;
- events;
- state;
- traces;
- logs;
- metrics;
- inspector;
- configuration;
- attempts;
- baselines;
- comparisons;
- workspaces.

A interface deve se parecer mais com uma bancada técnica ou instrumento de observabilidade do que com uma plataforma de cursos.

---

# 4. Progressive disclosure

Profundidade técnica é desejada.

Poluição visual não.

Não esconda informações importantes apenas porque o usuário ainda é iniciante.

Em vez disso, organize a informação em níveis de inspeção.

Exemplo:

System
→ Process
→ Request
→ Handler
→ Function
→ Event
→ Payload

A superfície principal deve permanecer legível.

Detalhes devem estar disponíveis através de inspeção.

Regra:

> Simplifique a apresentação, não a realidade.

---

# 5. Idioma

## Código

Todo código deve usar inglês.

Isso inclui:

- nomes de variáveis;
- funções;
- métodos;
- classes;
- interfaces;
- tipos;
- enums;
- arquivos técnicos;
- diretórios técnicos;
- eventos;
- endpoints;
- contratos;
- nomes de testes;
- identificadores internos.

Exemplo correto:

```ts
interface LabEvent {
  runId: string;
  timestamp: number;
}
```

Evite identificadores em português.

---

## Documentação

Documentação voltada ao autor do projeto deve ser escrita em português brasileiro.

Isso inclui:

- README;
- `docs/`;
- documentos arquiteturais;
- decisões técnicas;
- ADRs;
- anotações;
- explicações de cenários;
- comentários extensos destinados a explicar arquitetura;
- documentação de experimentos.

Termos técnicos amplamente utilizados não precisam ser artificialmente traduzidos.

Exemplos aceitáveis:

- event loop;
- race condition;
- deadlock;
- backpressure;
- throughput;
- trace;
- worker;
- retry;
- lock;
- connection pool;
- cache.

Priorize clareza técnica em português.

---

# 6. Interface

A interface pode usar português para textos destinados ao usuário.

Termos técnicos podem permanecer em inglês quando sua tradução reduzir clareza ou se afastar da terminologia utilizada na engenharia de software.

Não implemente internacionalização sem necessidade explícita.

Este é prioritariamente um projeto pessoal.

---

# 7. Author Mode e Student Mode

Mantenha a distinção conceitual.

## Author Mode

Usado ao desenvolver o próprio BunkerLab.

Pode modificar:

- `apps/`;
- `packages/`;
- `labs/`;
- `docs/`;
- infraestrutura interna.

## Student Mode

Usado ao estudar um cenário.

O estudante deve trabalhar sobre ambientes descartáveis e não alterar diretamente o cenário canônico.

Para futuros cenários `modify`:

canonical scenario
→ student workspace
→ edição externa
→ execução
→ observação
→ comparação

VS Code permanece a bancada de edição.

BunkerLab não deve se transformar em uma IDE.

Não introduza editor web ou terminal web sem uma necessidade arquitetural muito forte e explicitamente aprovada.

---

# 8. Modos de cenário

Preserve conceitualmente três formas principais de interação.

## observe

Executar e inspecionar comportamento sem modificar condições importantes.

## tune

Alterar parâmetros do cenário através do laboratório.

Exemplos:

- concurrency;
- quantidade de requests;
- latency;
- tamanho de connection pool;
- número de workers.

O nome interno pode continuar sendo `experiment` enquanto houver compatibilidade, mas novas decisões devem preferir a semântica de "tune" quando isso melhorar a clareza.

## modify

Modificar código em workspace descartável usando ferramentas externas como VS Code e Codex.

Não implemente infraestrutura para esses modos antes de existir um cenário concreto que precise dela.

---

# 9. Evitar overengineering

Não implemente infraestrutura porque ela "provavelmente será necessária".

Implemente quando um cenário criar a necessidade.

Exemplos:

Não adicionar Redis porque sistemas backend usam Redis.

Adicionar Redis quando existir um experimento em que cache, coordination ou outra propriedade justifique seu uso.

Não adicionar Kafka porque sistemas distribuídos usam Kafka.

Adicionar Kafka quando houver uma propriedade concreta a investigar.

Não adicionar containers por padrão.

Adicionar isolamento quando crashes, CPU starvation, memory pressure ou outros cenários justificarem.

Pergunta obrigatória antes de introduzir uma tecnologia:

> Que comportamento ou propriedade este componente permitirá observar?

Se não houver resposta clara, provavelmente não deve ser introduzido ainda.

---

# 10. Preservar o núcleo

O BunkerLab deve evoluir adicionando cenários e capacidades sem transformar cada experimento em uma alteração arquitetural global.

Ao implementar novas funcionalidades:

- preserve contratos existentes quando razoável;
- evite acoplamento entre cenário e interface;
- mantenha cenários isoláveis;
- não permita que um cenário dependa de detalhes internos desnecessários de outro;
- prefira composição a condicionais globais específicas para cada cenário.

Porém:

não crie abstrações genéricas antes de existir pelo menos uma necessidade concreta.

---

# 11. Observabilidade

Eventos são uma unidade central do projeto.

Sempre que implementar um fenômeno novo, considere quais evidências permitem ao usuário compreender o que ocorreu.

Possíveis evidências:

- events;
- logs;
- state transitions;
- timings;
- traces;
- queries;
- connection state;
- queue depth;
- CPU;
- memory;
- locks;
- retries;
- failures.

Não exponha tudo automaticamente.

Escolha aquilo que ajuda a investigar o fenômeno em questão.

---

# 12. Instrumentação não deve alterar o fenômeno desnecessariamente

Instrumentação pode interferir no comportamento observado.

Ao adicionar medições:

- mantenha overhead razoável;
- evite delays artificiais sem identificação;
- não use timers apenas para produzir animações;
- diferencie timestamps reais de delays introduzidos para visualização;
- documente limitações relevantes da instrumentação.

---

# 13. Segurança do repositório

Não altere projetos irmãos.

Todo trabalho deve permanecer dentro do repositório BunkerLab.

Não execute operações destrutivas fora do projeto.

Não exponha:

- tokens;
- secrets;
- credenciais;
- chaves privadas;
- arquivos `.env`.

Antes de operações destrutivas relevantes, avalie o impacto.

Mudanças locais, reversíveis e de baixo risco podem ser executadas autonomamente.

---

# 14. Git

Não faça commits automaticamente salvo quando a tarefa solicitar explicitamente.

Ao terminar uma rodada de implementação, sempre sugira uma única mensagem de commit em inglês.

Formato preferencial:

```text
type: objective description
```

Exemplos:

```text
feat: add interactive order system
```

```text
fix: preserve run state after reset
```

```text
refactor: simplify execution inspector
```

```text
test: cover concurrent order creation
```

Use Conventional Commits quando fizer sentido:

- `feat`
- `fix`
- `refactor`
- `test`
- `docs`
- `chore`
- `perf`

O type e a descrição devem estar em inglês. Use Conventional Commits quando aplicável e não faça commit automaticamente sem ordem explícita.

---

# 15. Review ao final de cada implementação

Toda rodada substancial deve terminar com uma sugestão curta de review em português.

Essa mensagem deve explicar o que deveria ser observado antes de aceitar a alteração.

Exemplo:

> Review sugerido: verificar se a timeline representa exclusivamente eventos reais, se selecionar uma request expõe seus detalhes sem aumentar a poluição visual da tela principal e se Reset continua isolando corretamente uma execução da seguinte.

Não use review genérico como:

> "Verificar se está tudo funcionando."

O review deve destacar riscos e propriedades específicas da rodada.

---

# 16. A implementação também deve funcionar como uma aula resumida

O usuário utiliza IA intensivamente para implementar o projeto.

Por isso, o relatório final não deve apenas dizer quais arquivos foram alterados.

Toda implementação substancial deve produzir uma explicação curta que ajude o usuário a entender o trabalho realizado.

Não transforme o relatório em tutorial extenso.

Use o seguinte formato.

## O que foi feito

Resumo concreto da alteração.

## Por que foi feito

Problema ou necessidade que motivou a mudança.

## Estratégia adotada

Como o problema foi resolvido.

Explique a decisão arquitetural principal.

## Como funciona

Explique o fluxo em linguagem técnica acessível.

Quando útil, use um pequeno fluxo textual.

Exemplo:

request
→ controller
→ event collector
→ SSE
→ observatory

## Conceitos importantes

Liste somente os conceitos de engenharia diretamente presentes na implementação.

Exemplo:

- Server-Sent Events;
- event ordering;
- correlation ID;
- lifecycle de request.

Não transforme essa seção em glossário de conceitos não utilizados.

## Trade-offs e limitações

Explique:

- simplificações intencionais;
- decisões temporárias;
- comportamento que ainda não está coberto;
- custo relevante da estratégia escolhida.

## O que observar manualmente

Informe ao usuário o que vale a pena abrir, executar ou inspecionar para compreender a implementação.

Exemplo:

1. execute o cenário;
2. abra um evento;
3. compare os timestamps;
4. observe a ordem controller → service → response.

## Arquivos importantes

Liste somente os arquivos mais úteis para o usuário explorar.

Explique em uma frase o papel de cada um.

---

# 17. Quantidade da explicação

O relatório final deve ensinar sem se tornar cansativo.

Regra geral:

- seja concreto;
- explique decisões, não cada linha de código;
- use exemplos pequenos;
- evite repetir o prompt;
- evite documentação enciclopédica;
- não descreva trivialidades.

Para uma alteração comum, aproximadamente 5–10 minutos de leitura devem ser mais do que suficientes.

Para alterações pequenas, use menos.

Para decisões arquiteturais importantes, use mais quando necessário.

---

# 18. Diferenciar fatos de interpretação

Ao explicar uma implementação:

Fato:

> O `RunService` mantém as execuções em memória.

Interpretação:

> Isso é suficiente neste estágio porque ainda não precisamos preservar runs após restart.

Não apresente decisões temporárias como verdades universais de engenharia.

Quando houver múltiplas estratégias válidas, mencione brevemente o trade-off relevante.

---

# 19. Ensinar através da implementação

Quando surgir um conceito importante durante o trabalho, explique por que ele apareceu naquele contexto.

Prefira:

> A run ganhou um estado `pending` porque o navegador precisava abrir o SSE antes que a request curta começasse.

em vez de:

> Sistemas geralmente possuem state machines.

Primeiro o problema concreto.

Depois o conceito.

Isso ajuda o conhecimento a criar raízes no contexto real do projeto.

---

# 20. Não resolver automaticamente exercícios de estudo

Quando estiver trabalhando em um cenário no qual o objetivo é o usuário investigar e resolver um problema, não entregue imediatamente a resposta final.

Se a tarefa estiver explicitamente em Student Mode:

- ajude a reproduzir;
- instrumente;
- apresente evidências;
- valide hipóteses;
- explique resultados observados;
- não implemente automaticamente a solução do exercício sem solicitação explícita.

Se estiver em Author Mode construindo a infraestrutura do cenário, implemente normalmente.

---

# 21. Validação obrigatória

Após mudanças relevantes, execute quando aplicável:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Não declare sucesso se algum check relevante estiver falhando.

Se um comando não puder ser executado, explique por quê.

Não esconda warnings relevantes.

---

# 22. Testes

Priorize testes de comportamento e contratos relevantes.

Evite testes que apenas reproduzam a implementação.

Para BunkerLab, são especialmente importantes:

- lifecycle de runs;
- isolamento entre runs;
- ordenação de eventos;
- correlation IDs;
- reset;
- cleanup;
- comportamento concorrente;
- falhas controladas;
- contratos entre cenário e observatório.

Quando um bug for encontrado, considere adicionar um teste que impeça regressão.

---

# 23. Performance

Não otimize prematuramente.

Quando performance for o objeto do experimento, meça antes de alterar.

Prefira:

baseline
→ alteração
→ nova medição
→ comparação

Não faça alegações de ganho sem dados quando a diferença puder ser medida.

---

# 24. Mudanças arquiteturais

Para mudanças arquiteturais relevantes:

1. identifique o problema;
2. descreva a restrição;
3. escolha uma estratégia;
4. implemente;
5. valide;
6. documente a decisão em português quando ela tiver valor duradouro.

Evite grandes refactors motivados apenas por preferência estética.

---

# 25. Documentação viva

Atualize documentação quando uma mudança alterar:

- arquitetura;
- fluxo de execução;
- contratos;
- estrutura de diretórios;
- comandos;
- comportamento de cenários;
- decisões que serão importantes em futuras implementações.

Não atualize documentação apenas para gerar volume.

README deve permanecer conciso.

Detalhes arquiteturais pertencem a `docs/`.

---

# 26. Relatório obrigatório ao final

Ao concluir uma implementação relevante, responda nesta ordem:

### Resultado

Estado objetivo da tarefa.

### O que foi feito

Resumo das alterações.

### Por que

Motivação.

### Estratégia

Decisão principal tomada.

### Como funciona

Fluxo técnico resumido.

### Conceitos importantes

Somente conceitos diretamente envolvidos.

### Trade-offs / limitações

O que permanece simplificado ou incompleto.

### O que revisar manualmente

Passos concretos para validação humana.

### Arquivos importantes

Somente os principais.

### Validações executadas

Exemplo:

```text
lint ✅
typecheck ✅
tests ✅
build ✅
```

### Review sugerido

Uma mensagem curta em português descrevendo exatamente o que deve ser revisado antes de aceitar a alteração.

### Commit sugerido

Uma única mensagem de commit em inglês utilizando Conventional Commits quando aplicável; type e descrição em inglês. Não faça commit automaticamente sem ordem explícita.

Exemplo:

```text
feat: introduce interactive reference system
```

---

# 27. Regra final

Antes de adicionar qualquer feature, abstração ou tecnologia, pergunte:

> Isso aumenta nossa capacidade de executar, observar, modificar ou compreender comportamento real de backend?

Se a resposta for não, provavelmente está fora do escopo do BunkerLab.

Em especial:

- explique resumidamente o que foi feito, por que e qual estratégia foi adotada;
- destaque os conceitos de engenharia realmente envolvidos;
- informe trade-offs e limitações;
- diga exatamente o que devo observar manualmente para compreender e revisar a mudança;
- sugira uma mensagem de review em português;
- sugira uma única mensagem de commit em inglês, com type e descrição em inglês, usando Conventional Commits quando aplicável;
- não faça o commit automaticamente, salvo instrução explícita.