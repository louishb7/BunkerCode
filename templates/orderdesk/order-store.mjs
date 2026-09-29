import { randomUUID } from "node:crypto";

// Executado pelo worker de banco. Retorna null quando nenhuma linha é alterada.
export function insertOrder(db, input) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const before = db
      .prepare("SELECT stock FROM products WHERE id = ?")
      .get(input.productId).stock;
    const result = db
      .prepare("UPDATE products SET stock = stock - ? WHERE id = ?")
      .run(input.quantity, input.productId);
    if (result.changes === 0) {
      db.exec("ROLLBACK");
      return { order: null, before };
    }
    const order = { id: randomUUID(), ...input, createdAt: Date.now() };
    db.prepare("INSERT INTO orders VALUES (?, ?, ?, ?)").run(
      order.id,
      order.productId,
      order.quantity,
      order.createdAt,
    );
    const stock = db
      .prepare("SELECT stock FROM products WHERE id = ?")
      .get(input.productId).stock;
    db.exec("COMMIT");
    return { order, before, stock };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
