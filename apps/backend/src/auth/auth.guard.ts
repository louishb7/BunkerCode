import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { AuthService, type Identity } from "./auth.service";
export const RequireIdentity = (role: "STUDENT" | "ADMIN" = "STUDENT") =>
  SetMetadata("identity", role);
export type AuthenticatedRequest = Request & { identity: Identity };
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const role = this.reflector.getAllAndOverride<
      "STUDENT" | "ADMIN" | undefined
    >("identity", [context.getHandler(), context.getClass()]);
    if (!role) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.identity = await this.auth.authenticate(
      request.headers.authorization,
    );
    if (role === "ADMIN" && request.identity.role !== "ADMIN")
      throw new ForbiddenException("Acesso restrito à administração.");
    return true;
  }
}
