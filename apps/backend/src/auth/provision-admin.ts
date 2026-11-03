import { PrismaService } from "./prisma.service";
import { normalizeEmail } from "./credentials";
// Promotes an existing registered identity; never accepts a password or creates a default account.
async function main() {
  const email = process.argv[2];
  if (!email || process.argv.length !== 3)
    throw new Error("Usage: pnpm admin:grant <registered-email>");
  const db = new PrismaService();
  try {
    await db.$connect();
    await db.user.update({
      where: { email: normalizeEmail(email) },
      data: { role: "ADMIN" },
    });
    process.stdout.write(
      "Administrative privilege granted to the registered identity.\n",
    );
  } finally {
    await db.$disconnect();
  }
}
void main().catch(() => {
  process.stderr.write(
    "Provisioning failed. Check configuration and registered identity.\n",
  );
  process.exitCode = 1;
});
