import { HttpException } from "@nestjs/common";
import { createHmac, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { authConfig } from "../auth/config";

export type SqlAction = "check" | "submit" | "authoring";
export class SqlLimited extends HttpException {
  constructor(readonly retryAfter = 2) {
    super("Capacidade SQL atingida. Aguarde antes de tentar novamente.", 429);
  }
}
const unavailable = () =>
  new HttpException(
    "Admissão SQL indisponível ou suspensa. Consulte a recuperação operacional.",
    503,
  );
// Metadata only. Never execute student SQL through this pool.
export class SqlAdmission {
  private readonly config = authConfig();
  private readonly pool = new Pool({
    connectionString: this.config.databaseUrl,
    max: 2,
    connectionTimeoutMillis: 1000,
    statement_timeout: 1000,
    idleTimeoutMillis: 1000,
  });
  private pending = 0;
  private finishing = false;
  constructor() {
    // A dead idle connection must not terminate the HTTP process.
    this.pool.on("error", () =>
      console.error(
        JSON.stringify({ event: "sql_admission_connection_failure" }),
      ),
    );
  }
  async close() {
    await this.pool.end();
  }
  private async transaction<T>(
    work: (client: PoolClient) => Promise<T>,
    maintenance = false,
  ): Promise<T> {
    if (maintenance ? this.finishing : this.pending >= 1)
      throw new SqlLimited();
    if (maintenance) this.finishing = true;
    else this.pending++;
    let client: PoolClient | undefined;
    try {
      client = await this.pool.connect();
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout = '200ms'");
      if (maintenance)
        await client.query("SELECT pg_advisory_xact_lock(1699007722)");
      else {
        const locked = await client.query<{ locked: boolean }>(
          "SELECT pg_try_advisory_xact_lock(1699007722) AS locked",
        );
        if (!locked.rows[0]?.locked) throw new SqlLimited();
      }
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      if (client) await client.query("ROLLBACK").catch(() => undefined);
      if (error instanceof HttpException) throw error;
      console.error(
        JSON.stringify({
          event: "sql_admission_failure",
          phase: maintenance ? "release" : "admit",
        }),
      );
      throw unavailable();
    } finally {
      client?.release();
      if (maintenance) this.finishing = false;
      else this.pending--;
    }
  }
  async consume(userId: string, action: SqlAction) {
    const digest = (value: string) =>
      createHmac("sha256", this.config.secret)
        .update("bunkercode-sql-limit-v1\0")
        .update(value)
        .digest("hex");
    return this.transaction(async (db) => {
      await db.query(`DELETE FROM "SqlQuota" WHERE "key" IN
        (SELECT "key" FROM "SqlQuota" WHERE "expiresAt" <= clock_timestamp() ORDER BY "expiresAt" LIMIT 100)`);
      const limits = [
        { key: digest(action + ":" + userId), max: 6 },
        { key: digest("installation"), max: 60 },
      ];
      const rows = await db.query<{
        key: string;
        count: number;
        retry: number;
      }>(
        `SELECT "key", "count", GREATEST(0,ceil(extract(epoch FROM ("expiresAt"-clock_timestamp()))))::int AS retry FROM "SqlQuota" WHERE "key" = ANY($1::text[])`,
        [limits.map((l) => l.key)],
      );
      const retry = Math.max(
        0,
        ...limits.map((l) => {
          const row = rows.rows.find((r) => r.key.trim() === l.key);
          return row && row.retry > 0 && row.count >= l.max ? row.retry : 0;
        }),
      );
      if (retry) throw new SqlLimited(retry);
      const count = await db.query<{ count: number }>(
        'SELECT count(*)::int AS count FROM "SqlQuota"',
      );
      const missing = limits.filter(
        (l) => !rows.rows.some((r) => r.key.trim() === l.key),
      ).length;
      if ((count.rows[0]?.count ?? 4096) + missing > 4096)
        throw new SqlLimited(60);
      for (const l of limits)
        await db.query(
          `INSERT INTO "SqlQuota" ("key","count","expiresAt") VALUES ($1,1,clock_timestamp()+interval '60 seconds')
        ON CONFLICT ("key") DO UPDATE SET "count"=CASE WHEN "SqlQuota"."expiresAt">clock_timestamp() THEN "SqlQuota"."count"+1 ELSE 1 END,
        "expiresAt"=CASE WHEN "SqlQuota"."expiresAt">clock_timestamp() THEN "SqlQuota"."expiresAt" ELSE clock_timestamp()+interval '60 seconds' END`,
          [l.key],
        );
    });
  }
  async claim() {
    return this.transaction(async (db) => {
      const state = await db.query<{
        owner: string | null;
        suspended: boolean;
        stale: boolean;
      }>(
        `SELECT "owner", "suspended", "claimedAt" < clock_timestamp()-interval '90 seconds' AS stale FROM "SqlRunnerSlot" WHERE "id"=1 FOR UPDATE`,
      );
      const row = state.rows[0];
      if (!row || row.suspended || row.stale) throw unavailable();
      if (row.owner) throw new SqlLimited();
      const owner = randomUUID();
      await db.query(
        'UPDATE "SqlRunnerSlot" SET "owner"=$1,"claimedAt"=clock_timestamp() WHERE "id"=1',
        [owner],
      );
      return owner;
    });
  }
  async finish(owner: string, suspended: boolean) {
    // A bounded connection attempt; failure preserves the claim and prevents progress.
    await this.transaction(async (db) => {
      const result = await db.query(
        `UPDATE "SqlRunnerSlot" SET "owner"=CASE WHEN $2 THEN "owner" ELSE NULL END,
        "claimedAt"=CASE WHEN $2 THEN "claimedAt" ELSE NULL END,"suspended"=$2 WHERE "id"=1 AND "owner"=$1`,
        [owner, suspended],
      );
      if (result.rowCount !== 1) throw unavailable();
    }, true);
  }
}
