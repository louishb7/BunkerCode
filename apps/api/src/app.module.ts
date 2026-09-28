import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { LabsController } from './labs.controller';
import { RunsService } from './runs.service';
import { RequestLifecycleMiddleware } from './request-lifecycle.middleware';
import { OrdersController } from './system/orders.controller';
import { OrdersService } from './system/orders.service';
import { SystemController } from './system/system.controller';

@Module({
  controllers: [LabsController, OrdersController, SystemController],
  providers: [RunsService, OrdersService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLifecycleMiddleware).forRoutes({ path: 'system/orders', method: RequestMethod.POST });
  }
}
