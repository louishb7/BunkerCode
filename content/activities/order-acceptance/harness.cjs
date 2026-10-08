const http = require("node:http");
const { createOrder } = require("./solution.js");
const state = { stock: 1, orders: 0 };
const server = http.createServer(async (request, response) => {
  response.setHeader("content-type", "application/json");
  if (request.method === "GET" && request.url === "/state") {
    response.end(JSON.stringify(state));
    return;
  }
  if (request.method !== "POST" || request.url !== "/orders") {
    response.statusCode = 404;
    response.end("{}");
    return;
  }
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 1024)
        throw new Error("Request excedeu o limite do exercício.");
      chunks.push(chunk);
    }
    const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (input.quantity !== 1)
      throw new Error("Esta atividade executa apenas quantity: 1.");
    const decision = await createOrder(state.stock, input.quantity);
    if (
      !decision ||
      typeof decision.accepted !== "boolean" ||
      !Number.isFinite(decision.stock)
    ) {
      throw new Error(
        "createOrder deve retornar accepted: boolean e stock: number.",
      );
    }
    if (decision.accepted) {
      state.stock = decision.stock;
      state.orders += 1;
    }
    response.statusCode = decision.accepted ? 201 : 409;
    response.end(JSON.stringify({ accepted: decision.accepted }));
  } catch (error) {
    response.statusCode = 500;
    response.end(
      JSON.stringify({ error: String(error.message ?? error).slice(0, 1000) }),
    );
  }
});
server.listen(0, "127.0.0.1", () => {
  process.send({ kind: "ready", port: server.address().port });
});
