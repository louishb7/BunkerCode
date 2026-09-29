import {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} from "node:worker_threads";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";

export function connectDatabase(path, emit) {
  const worker = new Worker(new URL(import.meta.url), { workerData: { path } });
  let sequence = 0;
  const pending = new Map();
  worker.on("message", ({ id, value, error, events }) => {
    const request = pending.get(id);
    if (!request) return;
    pending.delete(id);
    for (const event of events ?? [])
      emit(request.context, event.type, event.payload);
    if (error) request.reject(new Error(error));
    else request.resolve(value);
  });
  worker.on("error", (error) => {
    for (const item of pending.values()) item.reject(error);
    pending.clear();
  });
  worker.on("exit", (code) => {
    for (const item of pending.values())
      item.reject(new Error(`Database worker exited: ${code}`));
    pending.clear();
    process.exit(code || 1);
  });
  return {
    scoped: (context) => ({
      call: (operation, args) =>
        new Promise((resolve, reject) => {
          const id = ++sequence;
          pending.set(id, { resolve, reject, context });
          worker.postMessage({ id, operation, args });
        }),
    }),
  };
}

if (!isMainThread) {
  const db = new DatabaseSync(workerData.path);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, stock INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, productId TEXT NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL, createdAt INTEGER NOT NULL);
    INSERT OR IGNORE INTO products VALUES ('keyboard', 'Mechanical Keyboard', 5);`);
  const product = () =>
    db.prepare("SELECT * FROM products WHERE id = ?").get("keyboard");
  const state = () => ({
    product: product(),
    orders: db.prepare("SELECT * FROM orders ORDER BY rowid").all(),
  });
  parentPort.on("message", ({ id, operation, args }) => {
    const events = [];
    try {
      let value;
      if (operation === "product") value = product();
      else if (operation === "state") value = state();
      else if (operation === "reset") {
        db.exec("BEGIN IMMEDIATE");
        db.exec("DELETE FROM orders");
        db.prepare("UPDATE products SET stock = ? WHERE id = ?").run(
          args.stock,
          "keyboard",
        );
        db.exec("COMMIT");
        value = state();
      } else if (
        operation === "uncheckedOrder" ||
        operation === "atomicOrder"
      ) {
        db.exec("BEGIN IMMEDIATE");
        const before = product().stock;
        const query =
          operation === "atomicOrder"
            ? "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?"
            : "UPDATE products SET stock = stock - ? WHERE id = ?";
        const result =
          operation === "atomicOrder"
            ? db
                .prepare(query)
                .run(args.quantity, args.productId, args.quantity)
            : db.prepare(query).run(args.quantity, args.productId);
        if (result.changes === 0) {
          db.exec("ROLLBACK");
          value = null;
          events.push({
            type: "stock.rejected",
            payload: { stock: before, quantity: args.quantity },
          });
        } else {
          value = { id: randomUUID(), ...args, createdAt: Date.now() };
          db.prepare("INSERT INTO orders VALUES (?, ?, ?, ?)").run(
            value.id,
            value.productId,
            value.quantity,
            value.createdAt,
          );
          const after = product().stock;
          db.exec("COMMIT");
          events.push({
            type: "stock.written",
            payload: {
              before,
              stock: after,
              quantity: args.quantity,
              orderId: value.id,
            },
          });
          if (after < 0)
            events.push({
              type: "invariant.violated",
              payload: { invariant: "stock >= 0", stock: after },
            });
        }
      } else throw new Error("Unknown database operation");
      parentPort.postMessage({ id, value, events });
    } catch (error) {
      try {
        db.exec("ROLLBACK");
      } catch {
        /* A operação pode não ter aberto uma transação. */
      }
      parentPort.postMessage({ id, error: error.message, events });
    }
  });
}
