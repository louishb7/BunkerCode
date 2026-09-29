// Edite este arquivo no workspace e clique em Reiniciar runtime no BunkerLab.
// 'naive': SELECT e UPDATE em operações separadas. 'atomic': reserva condicional em transação.
export const strategy = "naive";

export async function createOrder(database, input, emit) {
  if (strategy === "atomic") return database.call("atomicOrder", input);

  const product = await database.call("product");
  emit("stock.read", { stock: product.stock, quantity: input.quantity });
  if (product.stock < input.quantity) return null;

  // A decisão acima usa uma leitura que pode estar obsoleta quando esta escrita executar.
  // Não há sleep, barreira de teste ou atraso de animação entre as operações reais no banco.
  return database.call("uncheckedOrder", input);
}
