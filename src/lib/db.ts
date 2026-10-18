import "server-only";
import postgres from "postgres";

/**
 * Privileged server-side Postgres connection (bypasses RLS). Only ever used from
 * server code after our own authorization checks, or for public write paths
 * (registrations, inquiries) that must not be exposed through anon RLS.
 *
 * Connection budget (Supabase Supavisor):
 * - Session pooler (DATABASE_URL, :5432) allows only `pool_size` clients (15) in total.
 *   `next dev` renders in several worker threads and each thread gets its own pool,
 *   so the session pooler is exhausted quickly. It is used for `next build` only.
 * - Transaction pooler (DATABASE_POOL_URL, :6543) multiplexes many clients and is the
 *   runtime default. It supports neither prepared statements nor query pipelining.
 */
const isBuild = process.env.NEXT_PHASE === "phase-production-build";

function connectionString() {
  const url = isBuild
    ? process.env.DATABASE_URL || process.env.DATABASE_POOL_URL
    : process.env.DATABASE_POOL_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  return url;
}

const url = connectionString();
const usesTransactionPooler = url.includes(":6543");

type Pool = ReturnType<typeof postgres>;
const globalForDb = globalThis as unknown as { __icetDb?: { url: string; pool: Pool }; __icetSql?: Pool };

// Close a pool left behind by an earlier version of this module (it stored the pool directly).
if (typeof globalForDb.__icetSql === "function") {
  globalForDb.__icetSql.end({ timeout: 5 }).catch(() => {});
  globalForDb.__icetSql = undefined;
}

// `max_pipeline` is a real postgres.js option (src/index.js) that its type definitions omit.
type PoolOptions = postgres.Options<Record<string, never>> & { max_pipeline?: number };

function createPool(): Pool {
  const options: PoolOptions = {
    // Small per-process pools: several may exist at once (dev worker threads, build workers).
    max: isBuild ? 3 : usesTransactionPooler ? 5 : 2,
    idle_timeout: 10, // release idle connections quickly so pooler slots are freed
    max_lifetime: 60 * 5,
    connect_timeout: 15,
    prepare: !usesTransactionPooler,
    // Supavisor transaction mode stalls when postgres.js pipelines several queries on one
    // connection (the default). 0 = one query in flight per connection; extra queries wait.
    max_pipeline: usesTransactionPooler ? 0 : 100,
    ssl: "require",
    transform: { undefined: null },
  };
  return postgres(url, options as postgres.Options<Record<string, never>>);
}

// Reuse one pool per thread across hot reloads. Bump POOL_VERSION when pool options change so a
// running dev server swaps in a fresh pool; a changed connection string does the same.
const POOL_VERSION = 2;
const poolKey = `${POOL_VERSION}|${url}`;
const cached = globalForDb.__icetDb;
if (cached?.pool && cached.url !== poolKey) {
  cached.pool.end({ timeout: 5 }).catch(() => {});
}
export const sql: Pool = cached?.pool && cached.url === poolKey ? cached.pool : createPool();
globalForDb.__icetDb = { url: poolKey, pool: sql };

export type Sql = typeof sql;
