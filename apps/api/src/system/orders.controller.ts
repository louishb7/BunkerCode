import { Body, Controller, Get, Inject, Post, Req } from '@nestjs/common';
import type { Order } from '@backendlab/protocol';
import type { ObservedRequest } from '../request-lifecycle.middleware';
import { OrdersService } from './orders.service';

@Controller('system/orders')
export class OrdersController {
  constructor(@Inject(OrdersService) private readonly orders: OrdersService) {}

  @Get()
  list(): Order[] { return this.orders.getOrders(); }

  @Post()
  create(@Body() input: unknown, @Req() req: ObservedRequest): Order {
    const ctx = req.labContext;
    ctx.emit({ source: 'controller', type: 'controller.entered', payload: { handler: 'OrdersController.create()' } });
    try {
      const order = this.orders.create(input, ctx);
      ctx.emit({ source: 'controller', type: 'controller.completed', payload: { orderId: order.id } });
      return order;
    } catch (error) {
      ctx.emit({ source: 'controller', type: 'controller.failed', payload: { error: error instanceof Error ? error.message : 'Unknown error' } });
      throw error;
    }
  }
}
