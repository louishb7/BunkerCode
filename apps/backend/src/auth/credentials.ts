import { BadRequestException, HttpException } from "@nestjs/common";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
interface LoginCredentials {
  email: string;
  password: string;
}
interface RegistrationCredentials extends LoginCredentials {
  username: string;
}
export function credentials(
  body: unknown,
  action?: "register",
): RegistrationCredentials;
export function credentials(body: unknown, action: "login"): LoginCredentials;
export function credentials(
  body: unknown,
  action: "register" | "login" = "register",
): RegistrationCredentials | LoginCredentials {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new BadRequestException("Informe e-mail e senha.");
  const value = body as Record<string, unknown>;
  const allowed =
    action === "register"
      ? ["email", "username", "password"]
      : ["email", "password"];
  if (
    Object.keys(value).some((key) => !allowed.includes(key)) ||
    !Object.hasOwn(value, "email") ||
    !Object.hasOwn(value, "password") ||
    typeof value.email !== "string" ||
    typeof value.password !== "string"
  )
    throw new BadRequestException("Dados de autenticação inválidos.");
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
    domain.split(".").some((label) => label.length > 63)
  )
    throw new BadRequestException({
      statusCode: 400,
      code: "INVALID_EMAIL",
      message: "Informe um e-mail válido.",
    });
  if (
    value.password.length === 0 ||
    [...value.password].length > 128 ||
    Buffer.byteLength(value.password) > 512
  )
    throw new BadRequestException({
      statusCode: 400,
      code: "INVALID_PASSWORD",
      message: "Use uma senha de até 128 caracteres.",
    });
  if (action === "register") {
    if (!Object.hasOwn(value, "username") || typeof value.username !== "string")
      throw new BadRequestException({
        statusCode: 400,
        code: "INVALID_USERNAME",
        message: "Informe um usuário válido.",
      });
    const username = value.username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(username))
      throw new BadRequestException({
        statusCode: 400,
        code: "INVALID_USERNAME",
        message: "Use de 3 a 30 letras, números ou _ no usuário.",
      });
    if (
      [...value.password].length < 6 ||
      !/[A-Za-z]/.test(value.password) ||
      !/[0-9]/.test(value.password)
    )
      throw new BadRequestException({
        statusCode: 400,
        code: "INVALID_PASSWORD",
        message:
          "A senha precisa ter pelo menos 6 caracteres, 1 letra e 1 número.",
      });
    return { email, username, password: value.password };
  }
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
