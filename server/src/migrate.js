import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "./db.js";

const MIGRATIONS_DIR = fileURLToPath(new URL("../migrations/", import.meta.url));

// Applies migrations/*.sql in name order, once each. The migrations are written to be
// idempotent, so a database created before this runner existed can safely replay them.
export async function runMigrations() {
  await query(`create table if not exists schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`);
  const applied = new Set((await query("select name from schema_migrations")).rows.map((row) => row.name));
  const files = (await readdir(MIGRATIONS_DIR)).filter((name) => name.endsWith(".sql")).sort();

  for (const name of files) {
    if (applied.has(name)) {
      continue;
    }
    const sql = await readFile(join(MIGRATIONS_DIR, name), "utf8");
    await query(sql);
    await query("insert into schema_migrations (name) values ($1)", [name]);
    console.log(`Applied migration ${name}`);
  }
}
