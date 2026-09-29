// Edite no workspace, salve e aplique as alterações no BunkerLab.
export async function createOrder(database, input, emit) {
  const product = await database.call("product");
  emit("stock.read", { stock: product.stock, quantity: input.quantity });
  if (product.stock < input.quantity) return null;

  return database.call("insertOrder", input);
}
