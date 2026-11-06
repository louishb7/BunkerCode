import {
  Injectable,
  type OnModuleInit,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { authConfig } from "./config";
import { databaseStartupError } from "../startup-error";
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnApplicationShutdown
{
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: authConfig().databaseUrl,
        connectionTimeoutMillis: 5000,
        max: 10,
      }),
      log: [],
    });
  }
  async onModuleInit() {
    try {
      await this.$connect();
      // The driver adapter creates its pool lazily; $connect alone is not readiness.
      await this.user.findFirst({ select: { id: true, username: true } });
      await this.session.findFirst({ select: { id: true } });
    } catch (error) {
      await this.$disconnect();
      throw databaseStartupError(error);
    }
  }
  async onApplicationShutdown() {
    await this.$disconnect();
  }
}
