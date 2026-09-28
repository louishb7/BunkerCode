import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RunsService } from './runs.service';
import type { AddressInfo } from 'node:net';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '127.0.0.1');
  app.get(RunsService).setApiPort((app.getHttpServer().address() as AddressInfo).port);
}

void bootstrap();
