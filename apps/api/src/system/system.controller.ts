import { Controller, Get, HttpCode, Inject, Post } from '@nestjs/common';
import type { Product, SystemState } from '@backendlab/protocol';
import { OrdersService } from './orders.service';

@Controller('system')
export class SystemController {
  constructor(@Inject(OrdersService) private readonly orders: OrdersService) {}

  @Get('product')
  product(): Product { return this.orders.getProduct(); }

  @Post('reset')
  @HttpCode(200)
  reset(): SystemState { return this.orders.reset(); }
}
