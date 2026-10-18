import "server-only";
import postgres from "postgres";

/**
 * Privileged server-side Postgres connection (bypasses RLS). Only ever used from
 * server code after our own authorization checks, or for public write paths
 * (registrations, inquiries) that must not be exposed through anon RLS.
 */
const globalForDb = globalThis as unknown as { __icetSql?: ReturnType<typeof postgres> };

function connectionString() {
  const url = process.env.DATABASE_POOL_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  return url;
}

export const sql =
  globalForDb.__icetSql ??
  postgres(connectionString(), {
    // Keep build-time concurrency low: `next build` runs several workers, each with its own pool,
    // and the Supabase pooler has a small connection budget.
    max: process.env.NEXT_PHASE === "phase-production-build" ? 3 : process.env.DATABASE_POOL_URL ? 6 : 4,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: !process.env.DATABASE_POOL_URL, // transaction pooler does not support prepared statements
    ssl: "require",
    transform: { undefined: null },
  });

if (process.env.NODE_ENV !== "production") globalForDb.__icetSql = sql;

export type Sql = typeof sql;
