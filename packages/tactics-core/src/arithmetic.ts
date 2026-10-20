export const STEP_OPERATORS = Object.freeze(["+=", "-=", "*="] as const);
export interface ArithmeticStep {
  readonly operator: (typeof STEP_OPERATORS)[number];
  readonly operand: number;
}

// Finite instruction domain, not a collection of exercises or fixed answers.
export const STEP_CHOICES: readonly ArithmeticStep[] = Object.freeze(
  STEP_OPERATORS.flatMap((operator) =>
    (operator === "*=" ? [2, 3] : [1, 2, 3]).map((operand) =>
      Object.freeze({ operator, operand }),
    ),
  ),
);

export function applyStep(value: number, step: ArithmeticStep): number {
  let result: number;
  switch (step.operator) {
    case "+=":
      result = value + step.operand;
      break;
    case "-=":
      result = value - step.operand;
      break;
    case "*=":
      result = value * step.operand;
      break;
  }
  if (!Number.isSafeInteger(result) || Math.abs(result) > 1000)
    throw new RangeError(
      "Estado aritmético fora do domínio seguro [-1000, 1000].",
    );
  return result;
}

export function renderStep(step: ArithmeticStep): string {
  return `value ${step.operator} ${step.operand};`;
}
