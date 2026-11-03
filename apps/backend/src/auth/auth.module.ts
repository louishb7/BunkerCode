import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthGuard } from "./auth.guard";
import { PrismaService } from "./prisma.service";
@Global()
@Module({
  controllers: [AuthController],
  providers: [
    PrismaService,
    AuthService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [PrismaService, AuthService],
})
export class AuthModule {}
