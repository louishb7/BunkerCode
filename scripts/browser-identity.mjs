// Test fixture only: uses the real identity service and database, outside HTTP.
// No application switch or privileged HTTP endpoint is introduced.
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
const require = createRequire(
  new URL("../apps/backend/package.json", import.meta.url),
);
const { PrismaService } = require("./dist/auth/prisma.service.js");
const { AuthService } = require("./dist/auth/auth.service.js");
const db = new PrismaService();
try {
  const auth = new AuthService(db);
  const result = await auth.register({
    email: `browser-${randomUUID()}@example.test`,
    username: `browser_${randomUUID().replaceAll("-", "").slice(0, 20)}`,
    password: randomUUID(),
  });
  await db.user.update({
    where: { id: result.user.id },
    data: { role: process.argv[2] === "STUDENT" ? "STUDENT" : "ADMIN" },
  });
  process.stdout.write(JSON.stringify(result));
} finally {
  await db.$disconnect();
}
