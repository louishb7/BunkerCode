import { BadRequestException } from "@nestjs/common";
import { blockedPasswords } from "./password-blocklist";

export function validateRegistrationPassword(
  password: string,
  email: string,
): void {
  if ([...password].length < 15)
    throw new BadRequestException({
      statusCode: 400,
      code: "PASSWORD_TOO_SHORT",
      message:
        "Use pelo menos 15 caracteres na senha. Você pode usar uma frase, sem precisar de números ou símbolos.",
    });
  // Compare the whole value only. Do not reject words contained in a passphrase.
  const candidate = password.normalize("NFC").toLowerCase();
  const contextual = [
    email,
    email.split("@")[0],
    "bunkercode123456",
    "bunkercode123456789",
    "bunkercodepassword",
    "bunkercodebunkercode",
    "correct horse battery staple",
    "correcthorsebatterystaple",
    "minha senha secreta",
    "minhasenhasecreta",
  ];
  if (blockedPasswords.has(candidate) || contextual.includes(candidate))
    throw new BadRequestException({
      statusCode: 400,
      code: "PASSWORD_BLOCKED",
      message:
        "Esta senha é comum, previsível ou consta da lista de senhas vazadas. Escolha uma frase única e mais longa; evite pequenas variações da mesma senha.",
    });
}
