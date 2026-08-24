import postgres from "postgres";

let sql: ReturnType<typeof postgres> | undefined;

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
      connect_timeout: 5,
      prepare: false,
      fetch_types: false,
      connection: {
        application_name: "personal-website-bff",
        statement_timeout: 4000,
      },
    });
  }
  return sql;
}

/** Drop a wedged pool (timeout / hung checkout) so the next read can reconnect. */
export function resetBffPostgres(): void {
  const current = sql;
  sql = undefined;
  if (!current) {
    return;
  }
  void current.end({ timeout: 1 }).catch(() => undefined);
}
