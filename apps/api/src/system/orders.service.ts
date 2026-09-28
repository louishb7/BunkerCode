import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { LabContext } from '@backendlab/lab-sdk';
import type { CreateOrderInput, Order, OrderCreatedPayload, Product, SystemState } from '@backendlab/protocol';

@Injectable()
export class OrdersService {
  private product: Product = this.initialProduct();
  private orders: Order[] = [];

  getProduct(): Product { return { ...this.product }; }
  getOrders(): Order[] { return this.orders.map((order) => ({ ...order })); }

  reset(): SystemState {
    this.product = this.initialProduct();
    this.orders = [];
    return { product: this.getProduct(), orders: this.getOrders() };
  }

  create(input: unknown, ctx: LabContext): Order {
    ctx.emit({ source: 'service', type: 'service.entered', payload: { operation: 'OrdersService.create()' } });
    try {
      const { productId, quantity } = this.validate(input);
      if (productId !== this.product.id) throw new NotFoundException('Product not found');
      if (quantity > this.product.stock) throw new ConflictException('Insufficient stock');
      const order: Order = { id: randomUUID(), productId, quantity, createdAt: Date.now() };
      const previousOrderCount = this.orders.length;
      this.orders.push(order);
      ctx.emit({
        source: 'domain', type: 'order.created',
        payload: { order, previousOrderCount, orderCount: this.orders.length } satisfies OrderCreatedPayload,
      });
      const previousStock = this.product.stock;
      this.product.stock -= quantity;
      ctx.emit({
        source: 'domain', type: 'stock.updated',
        payload: { productId, previousStock, stock: this.product.stock, quantity },
      });
      ctx.emit({ source: 'service', type: 'service.completed', payload: { orderId: order.id } });
      return { ...order };
    } catch (error) {
      ctx.emit({ source: 'service', type: 'service.failed', payload: { error: error instanceof Error ? error.message : 'Unknown error' } });
      throw error;
    }
  }

  private initialProduct(): Product { return { id: 'mechanical-keyboard', name: 'Mechanical Keyboard', stock: 3 }; }

  private validate(input: unknown): CreateOrderInput {
    if (!input || typeof input !== 'object') throw new BadRequestException('Invalid order');
    const { productId, quantity } = input as Record<string, unknown>;
    if (typeof productId !== 'string' || !productId) throw new BadRequestException('Product ID is required');
    if (typeof quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity < 1)
      throw new BadRequestException('Quantity must be a positive integer');
    return { productId, quantity };
  }
}
