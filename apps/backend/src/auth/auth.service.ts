import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma, type User } from "@prisma/client";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { PrismaService } from "./prisma.service";
import { authConfig } from "./config";
import {
  credentials,
  dummyHash,
  hashPassword,
  verifyPassword,
} from "./credentials";
export const refreshLifetime = 30 * 24 * 60 * 60 * 1000;
export const publicUser = (user: User) => ({
  id: user.id,
  email: user.email,
  role: user.role,
});
export type Identity = ReturnType<typeof publicUser>;
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const opaque = () => randomBytes(32).toString("base64url");
const validToken = (token: string | undefined): token is string =>
  !!token && /^[A-Za-z0-9_-]{43}$/.test(token);
@Injectable()
export class AuthService {
  private readonly config = authConfig();
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  async register(body: unknown) {
    const { email, username, password } = credentials(body);
    try {
      const user = await this.db.user.create({
        data: {
          email,
          username,
          passwordHash: await hashPassword(password),
          role: "STUDENT",
        },
      });
      return this.start(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        // The PostgreSQL adapter does not always provide meta.target. Resolve
        // the field after the database rejects the insert, without a racy precheck.
        const usernameExists = await this.db.user.findUnique({
          where: { username },
          select: { id: true },
        });
        if (usernameExists)
          throw new ConflictException({
            statusCode: 409,
            code: "USERNAME_TAKEN",
            message: "Este usuário já está em uso.",
          });
        throw new ConflictException({
          statusCode: 409,
          code: "EMAIL_TAKEN",
          message: "Este e-mail já está cadastrado.",
        });
      }
      throw error;
    }
  }
  async login(body: unknown) {
    const { email, password } = credentials(body, "login");
    const user = await this.db.user.findUnique({ where: { email } });
    const valid = await verifyPassword(
      password,
      user?.passwordHash ?? dummyHash,
    );
    if (!user || !valid)
      throw new UnauthorizedException("E-mail ou senha inválidos.");
    return this.start(user);
  }
  private async access(user: User, sessionId: string) {
    const accessToken = await new SignJWT({ sid: sessionId })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(user.id)
      .setIssuer(this.config.issuer)
      .setAudience(this.config.audience)
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(this.config.secret);
    return { accessToken, user: publicUser(user) };
  }
  private async start(user: User) {
    const token = opaque();
    const session = await this.db.session.create({
      data: {
        userId: user.id,
        tokenHash: hash(token),
        expiresAt: new Date(Date.now() + refreshLifetime),
      },
    });
    return {
      ...(await this.access(user, session.id)),
      token,
      expiresAt: session.expiresAt,
    };
  }
  private successor(token: string, sessionId: string) {
    // A keyed PRF makes the random token's successor reproducible only by the server.
    // This permits idempotent recovery of a lost response without storing plaintext.
    return createHmac("sha256", this.config.secret)
      .update("bunkercode-refresh-v1\0")
      .update(sessionId)
      .update("\0")
      .update(token)
      .digest("base64url");
  }
  async refresh(token: string | undefined) {
    if (!validToken(token)) throw new UnauthorizedException("Sessão inválida.");
    const tokenHash = hash(token);
    const outcome = await this.db.$transaction(async (tx) => {
      // Row lock serializes rotation and logout across backend processes.
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT "id" FROM "Session" WHERE "tokenHash" = ${tokenHash} OR "previousHash" = ${tokenHash} FOR UPDATE`;
      if (!rows[0]) return { kind: "invalid" as const };
      const session = await tx.session.findUniqueOrThrow({
        where: { id: rows[0].id },
        include: { user: true },
      });
      if (session.revokedAt || session.expiresAt.getTime() <= Date.now())
        return { kind: "invalid" as const };
      if (session.tokenHash !== tokenHash) {
        const successor = this.successor(token, session.id);
        if (
          Date.now() - session.rotatedAt.getTime() <= 10000 &&
          hash(successor) === session.tokenHash
        )
          return { kind: "ok" as const, token: successor, session };
        await tx.session.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
        return { kind: "invalid" as const };
      }
      const next = this.successor(token, session.id);
      await tx.session.update({
        where: { id: session.id },
        data: {
          previousHash: tokenHash,
          tokenHash: hash(next),
          rotatedAt: new Date(),
        },
      });
      return { kind: "ok" as const, token: next, session };
    });
    if (outcome.kind !== "ok")
      throw new UnauthorizedException("Sessão inválida.");
    return {
      ...(await this.access(outcome.session.user, outcome.session.id)),
      token: outcome.token,
      expiresAt: outcome.session.expiresAt,
    };
  }
  async logout(token: string | undefined) {
    if (validToken(token))
      await this.db.session.updateMany({
        where: {
          OR: [{ tokenHash: hash(token) }, { previousHash: hash(token) }],
        },
        data: { revokedAt: new Date() },
      });
  }
  async authenticate(authorization: string | undefined): Promise<Identity> {
    if (!authorization?.startsWith("Bearer ") || authorization.length > 2048)
      throw new UnauthorizedException("Entre para continuar.");
    let subject: string, sessionId: string;
    try {
      const { payload } = await jwtVerify(
        authorization.slice(7),
        this.config.secret,
        {
          algorithms: ["HS256"],
          issuer: this.config.issuer,
          audience: this.config.audience,
          requiredClaims: ["sub", "sid", "exp", "iat"],
          maxTokenAge: "10m",
        },
      );
      if (
        typeof payload.sub !== "string" ||
        typeof payload.sid !== "string" ||
        !/^[0-9a-f-]{36}$/.test(payload.sid)
      )
        throw new Error("Invalid claims");
      subject = payload.sub;
      sessionId = payload.sid;
    } catch {
      throw new UnauthorizedException("Sessão inválida.");
    }
    const session = await this.db.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });
    if (
      !session ||
      session.userId !== subject ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now()
    )
      throw new UnauthorizedException("Sessão inválida.");
    return publicUser(session.user);
  }
}
