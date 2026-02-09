import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/shell/db/schema/postgres";

export function createDb(connectionString: string) {
  const pool = new pg.Pool({ connectionString, max: 3 });
  return drizzle(pool, { schema });
}

export type Db = ReturnType<typeof createDb>;
