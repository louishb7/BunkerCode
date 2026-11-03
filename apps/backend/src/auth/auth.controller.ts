import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response, CookieOptions } from "express";
import { AuthService } from "./auth.service";
import { authConfig } from "./config";
import { RequireIdentity, type AuthenticatedRequest } from "./auth.guard";
const cookieName = "bunkercode_refresh";
function cookie(request: Request) {
  const parts = request.headers.cookie
    ?.split(";")
    .map((value) => value.trim())
    .filter((value) => value.startsWith(cookieName + "="));
  return parts?.length === 1
    ? parts[0]!.slice(cookieName.length + 1)
    : undefined;
}
@Controller("auth")
export class AuthController {
  private readonly options: CookieOptions = {
    httpOnly: true,
    secure: authConfig().secure,
    sameSite: "strict",
    path: "/api/auth",
  };
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  private respond(
    response: Response,
    result: Awaited<ReturnType<AuthService["login"]>>,
  ) {
    response.cookie(cookieName, result.token, {
      ...this.options,
      expires: result.expiresAt,
    });
    return { accessToken: result.accessToken, user: result.user };
  }
  @Post("register")
  async register(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.respond(response, await this.auth.register(body));
  }
  @Post("login")
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.respond(response, await this.auth.login(body));
  }
  @Post("refresh")
  @HttpCode(200)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.respond(response, await this.auth.refresh(cookie(request)));
  }
  @Post("logout")
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(cookie(request));
    response.clearCookie(cookieName, this.options);
  }
  @Get("me")
  @RequireIdentity()
  me(@Req() request: AuthenticatedRequest) {
    return { user: request.identity };
  }
}
