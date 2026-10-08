const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { inspect } = require("node:util");
const { reserveStock } = require("./solution.js");
const cases = [];
for (const [name, stock, quantity, expected] of [
  ["quantity below stock", 5, 2, { accepted: true, stock: 3 }],
  ["quantity equal to stock", 2, 2, { accepted: true, stock: 0 }],
  ["quantity above stock", 2, 3, { accepted: false, stock: 2 }],
]) {
  test(name, () => {
    let received;
    try {
      received = reserveStock(stock, quantity);
      assert.deepEqual(received, expected);
      cases.push({ name, passed: true });
    } catch (error) {
      cases.push({
        name,
        passed: false,
        expected: JSON.stringify(expected),
        received: inspect(received, { depth: 2, maxStringLength: 300 }).slice(
          0,
          1000,
        ),
        message: String(error.message ?? error).slice(0, 1000),
      });
      throw error;
    }
  });
}
after(() => process.send({ kind: "tests", cases }));
