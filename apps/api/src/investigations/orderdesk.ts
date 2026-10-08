import type { Evidence, OrderDeskState } from "@backendlab/protocol";
import type { InvestigationDefinition } from "./definition";

export const inventoryInvestigation: InvestigationDefinition = {
  id: "inventory-decisions-v1",
  systemId: "orderdesk",
  experimentId: "overselling",
  inspect({ run, requests, evidence }) {
    if (
      !run.result ||
      !run.initialState ||
      !run.finalState ||
      run.status === "running"
    )
      return null;
    const initial = run.initialState as OrderDeskState;
    const final = run.finalState as OrderDeskState;
    const writes = evidence.filter((event) => event.type === "stock.written");
    const available =
      final.product.stock < 0 ||
      writes.some((event) => Number(event.payload.stock) < 0);
    const reads = evidence.filter(
      (event) =>
        event.type === "stock.read" &&
        typeof event.payload.stock === "number" &&
        event.payload.stock > 0 &&
        event.requestId,
    );
    const negative = writes.find(
      (event) =>
        typeof event.payload.stock === "number" && event.payload.stock < 0,
    );
    const reading = (write: Evidence) =>
      [...reads]
        .reverse()
        .find(
          (event) =>
            event.requestId === write.requestId &&
            event.sequence < write.sequence,
        );
    const negativeRead = negative?.requestId ? reading(negative) : undefined;
    const partner =
      negative && negativeRead
        ? [...writes].reverse().find((write) => {
            const read = reading(write);
            return (
              write.requestId &&
              write.requestId !== negative.requestId &&
              write.sequence < negative.sequence &&
              write.sequence > negativeRead.sequence &&
              read &&
              read.sequence < negative.sequence &&
              read.payload.stock === negativeRead.payload.stock
            );
          })
        : undefined;
    const pairs = [partner, negative]
      .filter((event): event is Evidence => !!event)
      .flatMap((write) => {
        const read = write.requestId ? reading(write) : undefined;
        return read ? [{ read, write }] : [];
      });
    const focus = (
      pairs.length
        ? pairs.flatMap(({ read, write }) => [read, write])
        : negative
          ? [negative]
          : []
    ).sort((a, b) => a.sequence - b.sequence);
    const ids = [...new Set(focus.map((event) => event.requestId))];
    const omittedWrites = focus.length
      ? writes.filter(
          (event) =>
            event.sequence > focus[0]!.sequence &&
            event.sequence < focus.at(-1)!.sequence &&
            !focus.includes(event),
        ).length
      : 0;
    const units = final.orders.reduce((sum, order) => sum + order.quantity, 0);
    const concerns: string[] = [];
    if (final.product.stock + units !== initial.product.stock)
      concerns.push(
        `O estado final registra ${units} unidades em pedidos e ${final.product.stock} em estoque, partindo de ${initial.product.stock}. Esses valores não conservam o estoque inicial.`,
      );
    if (run.result.accepted !== final.orders.length)
      concerns.push(
        `${run.result.accepted} respostas de sucesso, mas ${final.orders.length} pedidos persistidos.`,
      );
    if (run.result.rejected > 0 && final.product.stock > 0)
      concerns.push(
        `${run.result.rejected} requests foram rejeitadas e restaram ${final.product.stock} unidades. Cada request desta execução pediu uma unidade.`,
      );
    if (run.result.errors > 0)
      concerns.push(`${run.result.errors} requests terminaram com erro.`);
    return {
      id: this.id,
      guidanceRevision: 2,
      concerns,
      title: "Investigar o estoque",
      available,
      observation: available
        ? "O estoque ficou abaixo de zero nesta execução."
        : "Não foi observado estoque negativo nesta execução. Resultados concorrentes podem variar.",
      facts: [
        {
          key: "initialStock",
          label: "Estoque inicial",
          value: initial.product.stock,
        },
        { key: "orders", label: "Pedidos criados", value: final.orders.length },
        {
          key: "finalStock",
          label: "Estoque final",
          value: final.product.stock,
        },
        {
          key: "requests",
          label: "Requests executadas",
          value: requests.length,
        },
      ],
      evidence: focus.map((event) => ({
        sequence: event.sequence,
        label: `Request ${String.fromCharCode(65 + ids.indexOf(event.requestId))} · ${event.type === "stock.read" ? "leu estoque" : "criou pedido; estoque após escrita"} = ${event.payload.stock}`,
      })),
      evidenceTable: pairs.length
        ? {
            columns: ["Na leitura", "Antes da escrita", "Após a escrita"],
            rows: pairs.map(({ read, write }) => ({
              label: `Request ${String.fromCharCode(65 + ids.indexOf(write.requestId))}`,
              cells: [
                { value: Number(read.payload.stock), sequence: read.sequence },
                {
                  value:
                    typeof write.payload.before === "number"
                      ? write.payload.before
                      : "Não registrado",
                  sequence: write.sequence,
                },
                {
                  value: Number(write.payload.stock),
                  sequence: write.sequence,
                },
              ],
            })),
          }
        : undefined,
      evidenceNote:
        pairs.length === 2
          ? `Estoque registrado para duas requests que criaram pedidos. Entre a primeira leitura e a última escrita do recorte, houve ${omittedWrites} escrita(s) de outras requests. Compare o que cada uma leu com o valor registrado imediatamente antes de sua escrita.`
          : "Não há eventos suficientes para comparar duas requests. Mostramos somente o que foi registrado, sem reconstruir etapas ausentes.",
      question:
        "O que cada request sabia sobre o estoque quando decidiu criar o pedido? Onde essa decisão aparece no código?",
      files: [
        {
          path: "inventory.mjs",
          symbol: "createOrder",
          description:
            "Esta operação lê o estoque antes de decidir se cria o pedido.",
        },
      ],
      hints: [
        {
          title: "Pista 1",
          text: "Compare o estoque lido por uma request com o estoque antes de sua escrita. Ele permaneceu igual? O que as outras requests fizeram nesse intervalo?",
        },
        {
          title: "Pista 2",
          text: "No código, ler o estoque e criar o pedido são operações separadas. Enquanto uma request aguarda uma chamada com await, outra pode avançar. Que informação a primeira continua usando quando volta a executar?",
        },
        {
          title: "Entender o conceito",
          text: "Verificar uma condição e agir depois é o padrão check-then-act. Se outra request altera o estado nesse intervalo, a decisão pode ficar desatualizada. Quando o resultado depende dessa ordem, chamamos isso de race condition. Atomicidade é a propriedade de tratar a decisão e a mudança como uma única operação, sem outra alteração entre elas.",
        },
        {
          title: "Explorar estratégias",
          text: "Você pode fazer o banco verificar a condição na própria escrita (update condicional), ou impedir que outra operação altere o estado entre a leitura e a escrita (lock ou transação com isolamento adequado). Uma transação agrupa operações; sozinha, não protege uma decisão tomada fora dela. Compare também pedidos, rejeições e estado final: impedir um número negativo não basta.",
        },
        {
          title: "Direção de implementação",
          text: "inventory.mjs coordena chamadas assíncronas; order-store.mjs executa a escrita. Escolha em qual desses lugares sua hipótese precisa atuar. No segundo, db.prepare executa SQL com parâmetros e result.changes informa linhas alteradas. Se controlar a ordem das chamadas no Node, considere quem compartilha esse controle. Preserve a evidência e use a próxima Run para observar o efeito, inclusive novas falhas.",
        },
      ],
      checkpointName: "Antes de investigar concorrência",
    };
  },
};
