import { HttpException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHmac } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import type { PrismaService } from "./prisma.service";
import { authConfig } from "./config";

let activeChecks = 0;
const minute = 60000;
export const loginWindow = 15 * minute;
export const loginTargetLimit = 10;
export class AuthLimited extends HttpException {
  constructor(readonly retryAfter: number) {
    super("Muitas tentativas. Aguarde antes de tentar novamente.", 429);
  }
}
interface Limit {
  key: string;
  max: number;
  window: number;
}

// All instances use the existing PostgreSQL. The short transaction serializes
// counters, never password computation or session issuance. No request queue here.
export class AuthRateLimiter {
  private readonly secret = authConfig().secret;
  constructor(private readonly db: PrismaService) {}
  async consume(limits: Limit[], transaction?: Prisma.TransactionClient) {
    if (activeChecks >= 32) throw new AuthLimited(2);
    activeChecks++;
    const run = async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SET LOCAL lock_timeout = '2s'`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(1699007721)::text`;
      const clock = await tx.$queryRaw<
        { now: bigint }[]
      >`SELECT (extract(epoch FROM clock_timestamp()) * 1000)::bigint AS now`;
      const time = Number(clock[0]?.now);
      if (!Number.isFinite(time)) throw new Error("Database clock unavailable");
      const now = new Date(time);
      // Bounded cleanup and a hard cardinality ceiling prevent identifier floods
      // from creating unbounded retained state. Never delete account/session data.
      await tx.$executeRaw`DELETE FROM "AuthThrottle" WHERE "key" IN
        (SELECT "key" FROM "AuthThrottle" WHERE "expiresAt" <= ${now} ORDER BY "expiresAt" LIMIT 100)`;
      const keyed = limits.map((limit) => ({
        ...limit,
        key: createHmac("sha256", this.secret)
          .update("bunkercode-auth-limit-v1\0")
          .update(limit.key)
          .digest("hex"),
      }));
      const rows = await tx.authThrottle.findMany({
        where: { key: { in: keyed.map((limit) => limit.key) } },
      });
      let retry = 0;
      for (const limit of keyed) {
        const row = rows.find((item) => item.key === limit.key);
        if (row && row.expiresAt.getTime() > time && row.count >= limit.max)
          retry = Math.max(
            retry,
            Math.ceil((row.expiresAt.getTime() - time) / 1000),
          );
      }
      if (retry) return retry;
      const missing = keyed.filter(
        (limit) => !rows.some((row) => row.key === limit.key),
      ).length;
      if (missing && (await tx.authThrottle.count()) + missing > 20000)
        return 60;
      for (const limit of keyed) {
        const row = rows.find((item) => item.key === limit.key);
        await tx.authThrottle.upsert({
          where: { key: limit.key },
          create: {
            key: limit.key,
            count: 1,
            expiresAt: new Date(time + limit.window),
          },
          update:
            row && row.expiresAt.getTime() > time
              ? { count: { increment: 1 } }
              : { count: 1, expiresAt: new Date(time + limit.window) },
        });
      }
      return 0;
    };
    let retry: number;
    try {
      retry = transaction
        ? await run(transaction)
        : await this.db.$transaction(run, { maxWait: 1000, timeout: 4000 });
    } catch (error) {
      // Contention/connection capacity is controlled overload, never fail open.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (["P2024", "P2028"].includes(error.code) ||
          (error.code === "P2010" && error.meta?.code === "55P03"))
      )
        throw new AuthLimited(2);
      throw error;
    } finally {
      activeChecks--;
    }
    if (retry) throw new AuthLimited(retry);
  }
}

export function authRateLimit(db: PrismaService) {
  const limiter = new AuthRateLimiter(db);
  const config = authConfig();
  return (req: Request, res: Response, next: NextFunction) => {
    const path = req.path.toLowerCase().replace(/\/+$/, "");
    const action = [
      "/login",
      "/register",
      "/refresh",
      "/logout",
      "/me",
    ].includes(path)
      ? path
      : "/other";
    const max =
      action === "/login"
        ? config.loginIpLimit
        : action === "/register"
          ? config.registerIpLimit
          : action === "/refresh"
            ? 600
            : 300;
    const window =
      action === "/login"
        ? loginWindow
        : action === "/register"
          ? 60 * minute
          : minute;
    void limiter.consume([{ key: `ip:${req.ip}:${action}`, max, window }]).then(
      () => next(),
      (error: unknown) => {
        if (error instanceof AuthLimited) {
          res.setHeader("Retry-After", String(error.retryAfter));
          res.status(429).json({ message: error.message });
        } else next(error);
      },
    );
  };
}
