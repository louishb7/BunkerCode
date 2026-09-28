import { createServer } from "node:http";
import { connectDatabase } from "./database.mjs";
import { createOrder } from "./inventory.mjs";

let sequence = 0;
const emit = (context, type, payload) => {
  if (process.connected)
    process.send({
      kind: "evidence",
      runId: context.runId,
      requestId: context.requestId,
      sequence: ++sequence,
      timestamp: Date.now(),
      type,
      payload,
    });
};
const database = connectDatabase(process.env.RUNTIME_DATABASE, emit);
const server = createServer(async (req, res) => {
  const respond = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.headers.authorization !== `Bearer ${process.env.RUNTIME_TOKEN}`)
    return respond(401, { error: "Unauthorized" });
  const context = {
    runId: req.headers["x-run-id"],
    requestId: req.headers["x-request-id"],
  };
  const db = database.scoped(context);
  try {
    if (req.method === "GET" && req.url === "/state")
      return respond(200, await db.call("state"));
    if (req.method !== "POST") return respond(404, { error: "Not found" });
    let text = "";
    for await (const chunk of req) {
      text += chunk;
      if (text.length > 4096) return respond(413, { error: "Body too large" });
    }
    let input;
    try {
      input = JSON.parse(text);
    } catch {
      return respond(400, { error: "Invalid JSON" });
    }
    if (req.url === "/reset") {
      if (
        !Number.isSafeInteger(input.stock) ||
        input.stock < 0 ||
        input.stock > 1000
      )
        return respond(400, { error: "Invalid stock" });
      return respond(200, await db.call("reset", { stock: input.stock }));
    }
    if (req.url !== "/orders") return respond(404, { error: "Not found" });
    if (input.productId !== "keyboard")
      return respond(404, { error: "Product not found" });
    if (!Number.isSafeInteger(input.quantity) || input.quantity < 1)
      return respond(400, { error: "Invalid quantity" });
    emit(context, "request.received", { method: req.method, path: req.url });
    const order = await createOrder(
      db,
      { productId: input.productId, quantity: input.quantity },
      (type, payload) => emit(context, type, payload),
    );
    emit(context, "response.sent", { status: order ? 201 : 409 });
    respond(order ? 201 : 409, order ?? { error: "Insufficient stock" });
  } catch (error) {
    emit(context, "request.error", { message: error.message });
    respond(500, { error: error.message });
  }
});
server.listen(0, "127.0.0.1", () => {
  process.send?.({ kind: "ready", port: server.address().port });
});
// O canal é também o vínculo de vida com o control plane, inclusive quando ele termina abruptamente.
process.on("disconnect", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
process.on("message", (message) => {
  if (message.kind === "flush")
    process.send?.({ kind: "flushed", id: message.id });
});
