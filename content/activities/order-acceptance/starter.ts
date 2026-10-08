export function createOrder(stock: number, quantity: number) {
  if (stock < quantity) {
    return { accepted: false, stock };
  }
  return { accepted: true, stock: stock - quantity };
}
