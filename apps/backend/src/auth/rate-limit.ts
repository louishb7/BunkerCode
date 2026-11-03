import { createHash } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
// Single-process deployment. Do not trust forwarding headers without a verified proxy.
export function authRateLimit() {
  const buckets = new Map<string, { count: number; expires: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "POST") return next();
    const now = Date.now();
    for (const [key, value] of buckets)
      if (value.expires <= now) buckets.delete(key);
    const action = req.path.toLowerCase().replace(/\/+$/, "");
    const expensive = action === "/login" || action === "/register";
    const limits: [string, number, number][] = [
      [
        `ip:${req.ip}:${expensive ? "password" : "session"}`,
        expensive ? 30 : 120,
        expensive ? 900000 : 60000,
      ],
    ];
    const body: unknown = req.body;
    if (
      expensive &&
      body &&
      typeof body === "object" &&
      "email" in body &&
      typeof body.email === "string"
    ) {
      const key = createHash("sha256")
        .update(body.email.trim().toLowerCase())
        .digest("hex");
      limits.push([`email:${key}`, 10, 900000]);
    }
    for (const [key, limit, duration] of limits) {
      const bucket = buckets.get(key) ?? { count: 0, expires: now + duration };
      if (
        bucket.count >= limit ||
        (!buckets.has(key) && buckets.size >= 20000)
      ) {
        res.setHeader("Retry-After", "60");
        res.status(429).json({
          message: "Muitas tentativas. Aguarde antes de tentar novamente.",
        });
        return;
      }
      bucket.count++;
      buckets.set(key, bucket);
    }
    next();
  };
}
