// Explicit operator tool; never called by HTTP or process startup.
import { Pool } from "pg";
import { authConfig } from "../auth/config";
import { assertNoSqlContainers } from "./docker";
async function main() {
  const [owner, acknowledgement] = process.argv.slice(2);
  if (
    !owner ||
    !/^[a-f0-9-]{36}$/.test(owner) ||
    acknowledgement !== "--consumers-stopped"
  )
    throw new Error(
      "Usage: sql:recover <expected-owner-uuid> --consumers-stopped",
    );
  await assertNoSqlContainers();
  const pool = new Pool({
    connectionString: authConfig().databaseUrl,
    max: 1,
    connectionTimeoutMillis: 1000,
    statement_timeout: 1000,
  });
  try {
    const result = await pool.query(
      `UPDATE "SqlRunnerSlot" SET "owner"=NULL,"claimedAt"=NULL,"suspended"=false WHERE "id"=1 AND "owner"=$1`,
      [owner],
    );
    if (result.rowCount !== 1)
      throw new Error("Claim changed or is absent; recovery refused");
    console.info(JSON.stringify({ event: "sql_runner_recovered", owner }));
  } finally {
    await pool.end();
  }
}
void main().catch(() => {
  console.error(
    "Recuperação recusada. Pare todos os consumidores, confira banco/daemon, UUID e inventário. Consulte docs/sql-practice.md.",
  );
  process.exitCode = 1;
});
