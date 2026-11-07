import { defineConfig } from "prisma/config";
// Generate is an offline build step. Database commands still require an explicit URL.
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  ...(url === undefined ? {} : { datasource: { url } }),
});
