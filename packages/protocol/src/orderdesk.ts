// Contrato do primeiro sistema. O host e o runner não dependem deste domínio.
export interface OrderDeskState {
  product: { id: string; name: string; stock: number };
  orders: {
    id: string;
    productId: string;
    quantity: number;
    createdAt: number;
  }[];
}
