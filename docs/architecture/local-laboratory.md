# Limites, dívida técnica e revisão da vertical slice

## Limites assumidos

- Apenas workspace `local` e OrderDesk estão provisionados. As chaves relacionais e rotas incluem workspace/system; não há API de criação, autenticação ou usuários.
- Processo filho separa crashes e event loops, **não é sandbox de segurança**. Código é do desenvolvedor local e pode acessar recursos do mesmo usuário. Não há cgroups, quotas, controle de rede ou proteção contra código malicioso.
- Em Linux, o manager encerra o grupo do processo com SIGTERM e fallback SIGKILL. O template encerra ao perder IPC com o pai. Código que remove esse comportamento ou cria sessões independentes pode escapar do cleanup após morte abrupta do pai.
- Reinício explícito, sem file watching. Isso evita reiniciar no meio de um experimento ou carregar salvamento parcial silenciosamente.
- Templates e workspaces são Node sem instalação automática de dependências. `node_modules`, `.env*` e arquivos SQLite não entram nos snapshots. Workspace de código limitado a 5 MiB; symlinks são recusados.
- Snapshots são preservados pelo manager, sem deduplicação, garbage collection ou proteção contra alteração deliberada pelo mesmo usuário.
- Metadata síncrona via `node:sqlite`; adequado ao volume local atual, não validado para carga grande ou múltiplos control planes.
- Sem migração do histórico anterior: antes desta rodada ele só existia na memória de outro processo.
- A evidência declarada pelo sistema é confiável somente tanto quanto o código instrumentalizado. Respostas HTTP e estado final são medidos independentemente pelo runner. Alterar/remover instrumentação reduz a explicação disponível.

## Pontos provisórios

1. **SQLite em worker para o OrderDesk.** Reproduz uma race real entre operações de banco, mas não modela latência/locks/isolation levels de PostgreSQL ou múltiplas réplicas. Confiança alta para investigar check-then-act; menor para extrapolar a sistemas distribuídos.
2. **Contratos de ferramenta.** O estado agora é opaco ao núcleo e a definição valida seu domínio. Configuração ainda aceita somente campos numéricos; novos tipos de investigação devem orientar a extensão. A ponte de surface suporta somente GET/POST JSON.
3. **Git + metadata.** Um commit pode existir sem linha de checkpoint se houver crash/falha de disco nesse intervalo. Não há reconciliador automático; Git permite recuperação manual. Restore salva backup e não reescreve histórico, mas evite edição simultânea no VS Code durante a operação.
4. **Lock de processo local por PID.** Evita duas APIs no mesmo diretório em operação normal; recuperação de lock stale é voltada ao uso local, não a uma eleição distribuída. Um PID reutilizado pode exigir inspeção manual.
5. **Comparação de observações.** A tabela não calcula significância estatística, não compara patches de código e não prova ausência de races. Condições diferentes têm aviso explícito.
6. **Histórico e disco.** API pagina 100 Runs por vez; não há retenção automática. Evidências, snapshots e Git crescem até o usuário gerenciar os dados.

## Decisões de menor confiança

- O worker SQLite é suficiente para avaliar a primeira hipótese de produto, mas a experiência de editar um backend sem NestJS deve ser validada com uso real. A escolha privilegia um sistema estudável e sem dependências de instalação.
- A frequência da falha ingênua depende da máquina e do escalonamento. O teste tenta até cinco workloads reais; não introduz sincronização artificial para garantir overselling.
- O limiar local de 5 MiB de código e os limites de workload são operacionais, não derivados de medições de capacidade. Rever quando surgir um segundo sistema concreto.

## Review sugerido

Observe se cada Run referencia o código **carregado**, se o primeiro estoque negativo está ligado à leitura anterior da mesma request, se reset não modifica histórico, se restore conserva arquivos novos no checkpoint de segurança e se o laboratório continua acessível após syntax error/crash do OrderDesk. Compare duas Runs sob as mesmas condições antes de concluir que uma mudança corrigiu o fenômeno.

A segunda rodada está detalhada em [Surfaces e Activities](system-surfaces.md), incluindo upgrade conservador e decisões de menor confiança.
