import type { Feedback, Submission } from "./models";
import type { ExecutionResult } from "../execution/results";
export function feedbackFor(
  submission: Submission,
  result: ExecutionResult,
): Feedback {
  if (result.status !== "completed")
    return {
      comparisons: [],
      message:
        "Não há resultado completo para comparar. Examine o erro técnico e tente novamente; ele não avalia sua compreensão.",
    };
  if (result.kind === "order" && result.observation && submission.prediction) {
    const actual = result.observation;
    const comparisons = [
      {
        label: "Status HTTP",
        expected: submission.prediction.status,
        actual: actual.response.status,
      },
      {
        label: "Estoque final",
        expected: submission.prediction.stock,
        actual: actual.finalState.stock,
      },
      {
        label: "Pedidos",
        expected: submission.prediction.orders,
        actual: actual.finalState.orders,
      },
    ].map((item) => ({ ...item, matches: item.expected === item.actual }));
    return {
      comparisons,
      message: comparisons.every((c) => c.matches)
        ? "A evidência coincide com sua previsão neste caso. Explique como a condição se comporta quando stock === quantity; altere-a e faça uma nova previsão."
        : "Compare os fatos acima com sua previsão e sua justificativa. Revise o caso stock === quantity no código submetido e sua tradução para HTTP.",
    };
  }
  if (result.kind === "tests")
    return {
      comparisons: [],
      message: result.cases.every((c) => c.passed)
        ? "Os três casos declarados passaram nesta revisão. Explique por que a igualdade permite reservar e experimente outras entradas dentro das regras da tarefa."
        : result.cases.find((c) => c.name === "quantity equal to stock")
              ?.passed === false
          ? "O caso de igualdade falhou. Compare esperado e recebido e revise o limite da condição; os casos acima mostram quais comportamentos já funcionam."
          : "Localize o primeiro caso que falhou. Compare esperado e recebido com a regra correspondente antes de alterar a função inteira.",
    };
  return {
    comparisons: [],
    message: "Observe o resultado específico desta submissão.",
  };
}
