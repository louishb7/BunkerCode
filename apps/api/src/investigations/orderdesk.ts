import type { Evidence, OrderDeskState } from "@backendlab/protocol";
import type { InvestigationDefinition } from "./definition";

export const inventoryInvestigation: InvestigationDefinition = {
  id: "inventory-decisions-v1",
  systemId: "orderdesk",
  experimentId: "overselling",
  inspect({ run, requests, evidence }) {
    if (!run.result || !["passed", "failed"].includes(run.status)) return null;
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
    let focus: Evidence[] = [];
    for (const first of [...reads].sort(
      (a, b) => Number(a.payload.stock) - Number(b.payload.stock),
    )) {
      const candidates = reads.filter(
        (event) =>
          event.requestId !== first.requestId &&
          event.payload.stock === first.payload.stock &&
          event.sequence > first.sequence,
      );
      for (const second of candidates) {
        const firstWrite = writes.find(
          (event) =>
            event.requestId === first.requestId &&
            event.sequence > second.sequence,
        );
        const secondWrite = writes.find(
          (event) =>
            event.requestId === second.requestId &&
            event.sequence > second.sequence,
        );
        if (
          firstWrite &&
          secondWrite &&
          (Number(firstWrite.payload.stock) < 0 ||
            Number(secondWrite.payload.stock) < 0)
        ) {
          focus = [first, second, firstWrite, secondWrite].sort(
            (a, b) => a.sequence - b.sequence,
          );
          break;
        }
      }
      if (focus.length) break;
    }
    const paired = focus.length > 0;
    if (!paired) {
      const negative = writes.find((event) => Number(event.payload.stock) < 0);
      if (negative)
        focus = evidence.filter(
          (event) =>
            event.requestId === negative.requestId &&
            ["stock.read", "stock.written"].includes(event.type),
        );
    }
    const ids = [...new Set(focus.map((event) => event.requestId))];
    return {
      id: this.id,
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
      evidenceNote: paired
        ? "Recorte de duas requests desta Run, na ordem recebida. Outras requests também executaram entre estes eventos; abra o Inspector para a sequência completa. A ordem recebida não é um relógio global do banco."
        : "Não foi possível selecionar duas leituras sobrepostas. Os eventos disponíveis da escrita negativa estão abaixo; não inferimos uma sequência ausente.",
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
          text: "Observe que a leitura do estoque e a criação do pedido são operações separadas. O que pode acontecer entre essas duas chamadas?",
        },
        {
          title: "Pista 2",
          text: "Imagine duas requests executando esse trecho quando existe apenas 1 unidade. As duas podem ler stock = 1 antes que qualquer uma altere o estado? Volte aos eventos: o que eles permitem afirmar nesta Run?",
        },
        {
          title: "Entender o conceito",
          text: "Esse padrão é chamado check-then-act: verificar e agir em operações separadas permite interleaving entre requests (uma race condition). Falta atomicidade entre a condição e a alteração. Famílias de solução incluem update condicional, transaction com isolamento adequado ou lock compartilhado. Uma transação apenas na escrita não protege uma decisão tomada antes dela.",
        },
        {
          title: "Direção de implementação",
          text: "Siga insertOrder até order-store.mjs. Ali db.prepare executa SQL com parâmetros e result.changes informa quantas linhas foram alteradas. O UPDATE e o INSERT já compartilham uma transação. Que condição a escrita precisa verificar para que o pedido só seja persistido quando houver estoque? Você pode mudar essa operação e a decisão em inventory.mjs; não precisa editar o driver em database.mjs.",
        },
      ],
      checkpointName: "Antes de investigar concorrência",
    };
  },
};
