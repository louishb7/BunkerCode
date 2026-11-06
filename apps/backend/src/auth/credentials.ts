import { BadRequestException, HttpException } from "@nestjs/common";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
export function credentials(
  body: unknown,
  action: "register" | "login" = "register",
): {
  email: string;
  password: string;
} {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new BadRequestException("Informe e-mail e senha.");
  const value = body as Record<string, unknown>;
  if (
    Object.keys(value).length !== 2 ||
    typeof value.email !== "string" ||
    typeof value.password !== "string"
  )
    throw new BadRequestException("Informe somente e-mail e senha.");
  const email = normalizeEmail(value.email);
  const [local = "", domain = ""] = email.split("@");
  if (
    value.email.length > 254 ||
    email.length > 254 ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(
      email,
    ) ||
    local.length > 64 ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    domain.split(".").some((label) => label.length > 63) ||
    value.password.length === 0 ||
    value.password.length > 128 ||
    Buffer.byteLength(value.password) > 512
  )
    throw new BadRequestException(
      "Use e-mail válido e senha de até 128 caracteres.",
    );
  if (
    action === "register" &&
    (value.password.length < 6 || !/[0-9]/.test(value.password))
  )
    throw new BadRequestException(
      "Use pelo menos 6 caracteres e 1 número na senha.",
    );
  return { email, password: value.password };
}
let activeHashes = 0;
async function derive(password: string, salt: string): Promise<Buffer> {
  if (activeHashes >= 4)
    throw new HttpException(
      "Muitas tentativas. Aguarde antes de tentar novamente.",
      429,
    );
  activeHashes++;
  try {
    return await new Promise<Buffer>((resolve, reject) =>
      scrypt(
        password,
        salt,
        64,
        { N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024 },
        (error, key) => (error ? reject(error) : resolve(key)),
      ),
    );
  } finally {
    activeHashes--;
  }
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$131072$8$1$${salt}$${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const parts = encoded.split("$");
  if (
    parts.length !== 6 ||
    parts.slice(0, 4).join("$") !== "scrypt$131072$8$1" ||
    !/^[0-9a-f]{32}$/.test(parts[4]!) ||
    !/^[0-9a-f]{128}$/.test(parts[5]!)
  )
    return false;
  return timingSafeEqual(
    await derive(password, parts[4]!),
    Buffer.from(parts[5]!, "hex"),
  );
}
// Same work factor for a missing identity; no real account or reusable password.
export const dummyHash = `scrypt$131072$8$1$${"0".repeat(32)}$${"0".repeat(128)}`;
