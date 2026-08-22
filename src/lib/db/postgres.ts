import postgres from "postgres";

let sql: ReturnType<typeof postgres> | null | undefined;

/** Read-only Postgres client for ``BFF_DATABASE_URL`` (transaction pooler). */
export function getBffPostgres(): ReturnType<typeof postgres> | null {
  const url = process.env.BFF_DATABASE_URL?.trim();
  if (!url) {
    return null;
  }
  if (sql === undefined) {
    sql = postgres(url, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }
  return sql;
}
