/* global module */
const assert = require("node:assert/strict");
const ts = require("typescript");
const { OPERATORS, STEP_OPERATORS } = require("@bunkercode/tactics-core");

/** Independent arithmetic oracle: composition of affine maps, not production's switch.
 * @param {import("../dist").ArithmeticStep} step
 * @returns {[number, number]} */
function affine(step) {
  const coefficients = {
    "+=": [1, step.operand],
    "-=": [1, -step.operand],
    "*=": [step.operand, 0],
  };
  const pair = coefficients[step.operator];
  return [pair[0] ?? NaN, pair[1] ?? NaN];
}
/** @param {number} initial @param {readonly import("../dist").ArithmeticStep[]} steps */
function oracleAssignment(initial, steps) {
  let scale = 1;
  let offset = 0;
  let before = initial;
  const transitions = steps.map((step) => {
    const [factor, delta] = affine(step);
    scale *= factor;
    offset = offset * factor + delta;
    const after = initial * scale + offset;
    const transition = { step, before, after };
    before = after;
    return transition;
  });
  return { initial, transitions, result: before };
}
/** @param {number} value @param {import("../dist").ArithmeticStep} step */
function oracleStep(value, step) {
  const [factor, offset] = affine(step);
  return factor * value + offset;
}
/** @param {import("../dist").ConditionalProgram} program @param {import("../dist").Operator} operator */
function oracleConditional(program, operator) {
  const categories = [[1], [0, 1], [-1], [-1, 0], [0], [-1, 1]][
    OPERATORS.indexOf(operator)
  ];
  assert.ok(categories);
  return program.inputs.map((input) => {
    const afterPreparation = oracleStep(input, program.preparation);
    const comparison = categories.includes(
      Math.sign(afterPreparation - program.threshold),
    );
    const afterBranch = oracleStep(
      afterPreparation,
      comparison ? program.ifStep : program.elseStep,
    );
    return {
      input,
      afterPreparation,
      comparison,
      branch: comparison ? "if" : "else",
      afterBranch,
      result: afterBranch,
    };
  });
}

/** @param {string} code */
function parse(code) {
  const name = "/generated.js";
  const file = ts.createSourceFile(
    name,
    code,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.JS,
  );
  /** @type {import("typescript").CompilerHost} */
  const host = {
    getSourceFile: (path) => (path === name ? file : undefined),
    getDefaultLibFileName: () => "",
    writeFile: () => {
      throw new Error("Parsing must not emit");
    },
    getCurrentDirectory: () => "/",
    getDirectories: () => [],
    fileExists: (path) => path === name,
    readFile: (path) => (path === name ? code : undefined),
    getCanonicalFileName: (path) => path,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
  };
  const program = ts.createProgram(
    [name],
    { allowJs: true, noLib: true, noResolve: true, types: [] },
    host,
  );
  assert.deepEqual(
    program.getSyntacticDiagnostics(file).map((item) => item.messageText),
    [],
  );
  return file;
}
/** @param {import("typescript").Expression} expression */
function numeric(expression) {
  if (ts.isNumericLiteral(expression)) return Number(expression.text);
  assert.ok(ts.isPrefixUnaryExpression(expression));
  assert.equal(expression.operator, ts.SyntaxKind.MinusToken);
  assert.ok(ts.isNumericLiteral(expression.operand));
  return -Number(expression.operand.text);
}
/** @param {import("typescript").Statement | undefined} statement @param {import("typescript").SourceFile} file */
function parsedStep(statement, file) {
  assert.ok(statement && ts.isExpressionStatement(statement));
  assert.ok(ts.isBinaryExpression(statement.expression));
  const expression = statement.expression;
  assert.equal(expression.left.getText(file), "value");
  const operator = STEP_OPERATORS.find(
    (candidate) => candidate === expression.operatorToken.getText(file),
  );
  assert.ok(operator);
  return { operator, operand: numeric(expression.right) };
}
/** @param {import("typescript").Statement | undefined} statement @param {string} name @param {import("typescript").SourceFile} file @param {boolean} constant */
function declaration(statement, name, file, constant) {
  assert.ok(statement && ts.isVariableStatement(statement));
  assert.equal(
    statement.declarationList.flags & ts.NodeFlags.Const,
    constant ? ts.NodeFlags.Const : 0,
  );
  assert.equal(statement.declarationList.declarations.length, 1);
  const item = statement.declarationList.declarations[0];
  assert.ok(item?.initializer);
  assert.equal(item.name.getText(file), name);
  return item.initializer;
}
/** @param {string} code */
function parseAssignment(code) {
  const file = parse(code);
  const statements = file.statements;
  assert.ok(statements.length >= 4 && statements.length <= 6);
  const initial = numeric(declaration(statements[0], "value", file, false));
  assert.equal(
    declaration(statements.at(-1), "result", file, true).getText(file),
    "value",
  );
  return {
    initial,
    steps: statements
      .slice(1, -1)
      .map((statement) => parsedStep(statement, file)),
  };
}
/** @param {string} code */
function parseConditional(code) {
  const file = parse(code);
  assert.equal(file.statements.length, 1);
  const functionNode = file.statements[0];
  assert.ok(
    functionNode && ts.isFunctionDeclaration(functionNode) && functionNode.body,
  );
  assert.equal(functionNode.name?.text, "calculate");
  assert.equal(functionNode.parameters.length, 1);
  assert.equal(functionNode.parameters[0]?.name.getText(file), "start");
  const statements = functionNode.body.statements;
  assert.equal(statements.length, 4);
  assert.equal(
    declaration(statements[0], "value", file, false).getText(file),
    "start",
  );
  const condition = statements[2];
  assert.ok(
    condition &&
      ts.isIfStatement(condition) &&
      ts.isBinaryExpression(condition.expression),
  );
  const expression = condition.expression;
  assert.equal(expression.left.getText(file), "value");
  const operator = OPERATORS.find(
    (candidate) => candidate === expression.operatorToken.getText(file),
  );
  assert.ok(operator);
  assert.ok(ts.isBlock(condition.thenStatement));
  assert.ok(condition.elseStatement && ts.isBlock(condition.elseStatement));
  assert.equal(condition.thenStatement.statements.length, 1);
  assert.equal(condition.elseStatement.statements.length, 1);
  const returned = statements[3];
  assert.ok(returned && ts.isReturnStatement(returned));
  assert.equal(returned.expression?.getText(file), "value");
  return {
    preparation: parsedStep(statements[1], file),
    threshold: numeric(expression.right),
    operator,
    ifStep: parsedStep(condition.thenStatement.statements[0], file),
    elseStep: parsedStep(condition.elseStatement.statements[0], file),
  };
}

module.exports = {
  oracleAssignment,
  oracleStep,
  oracleConditional,
  parseAssignment,
  parseConditional,
};
