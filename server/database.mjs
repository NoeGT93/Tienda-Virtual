import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const context = new AsyncLocalStorage();
const connectionString = process.env.DATABASE_URL || process.env.STORAGE_DATABASE_URL || process.env.POSTGRES_URL || process.env.STORAGE_POSTGRES_URL;
const embeddedPostgres =
  process.env.DB_DRIVER === "pglite" && !process.env.VERCEL;
const postgres = Boolean(connectionString) || embeddedPostgres;
let sqlite, pool, lite;
let queue = Promise.resolve();
async function exclusive(fn) {
  const previous = queue;
  let release;
  queue = new Promise((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}
if (embeddedPostgres) {
  const { PGlite } = await import("@electric-sql/pglite");
  lite = new PGlite(process.env.PGLITE_PATH || "memory://");
} else if (connectionString) {
  const { default: pg } = await import("pg");
  pool = new pg.Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
    allowExitOnIdle: true,
  });
  pool.on("error", () => console.error("Database connection interrupted"));
} else {
  if (process.env.VERCEL)
    throw new Error(
      "Connect PostgreSQL and configure DATABASE_URL before deploying.",
    );
  const { DatabaseSync } = await import("node:sqlite");
  const path = resolve(process.env.DATABASE_PATH || "data/lulos.sqlite");
  mkdirSync(dirname(path), { recursive: true });
  sqlite = new DatabaseSync(path);
  sqlite.exec(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
  );
}
function sqlForPostgres(sql) {
  let index = 0;
  sql = sql.replace(/'([^']|'')*'|\?/g, (match) =>
    match === "?" ? `$${++index}` : match,
  );
  if (/INSERT OR IGNORE/i.test(sql))
    sql =
      sql.replace(/INSERT OR IGNORE/i, "INSERT") + " ON CONFLICT DO NOTHING";
  return sql;
}
async function query(sql, args = []) {
  const client = context.getStore();
  const execute = async () => {
    if (postgres)
      return (client || pool || lite).query(sqlForPostgres(sql), args);
    const statement = sqlite.prepare(sql);
    if (/^\s*(SELECT|WITH)/i.test(sql) || /\bRETURNING\b/i.test(sql))
      return { rows: statement.all(...args) };
    return { rows: [], rowCount: statement.run(...args).changes };
  };
  return client || pool ? execute() : exclusive(execute);
}
export async function all(sql, ...args) {
  return (await query(sql, args)).rows;
}
export async function one(sql, ...args) {
  return (await all(sql, ...args))[0];
}
export async function run(sql, ...args) {
  const r = await query(sql, args);
  return { changes: r.rowCount ?? r.affectedRows ?? 0 };
}
export async function transaction(fn) {
  if (context.getStore()) return fn();
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Serialize commerce writes across function instances, including idempotency and cancellations.
      await client.query("SELECT pg_advisory_xact_lock(71482001)");
      const result = await context.run(client, fn);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  return exclusive(async () => {
    if (lite) return lite.transaction((client) => context.run(client, fn));
    sqlite.exec("BEGIN IMMEDIATE");
    try {
      const result = await context.run({ sqlite: true }, fn);
      sqlite.exec("COMMIT");
      return result;
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  });
}
export async function close() {
  if (pool) await pool.end();
  if (lite) await lite.close();
  if (sqlite) sqlite.close();
}

let schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
schema += `\nCREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires BIGINT NOT NULL);\nCREATE INDEX IF NOT EXISTS rate_limits_expiry ON rate_limits(expires);`;
if (postgres)
  schema = schema
    .replace("expires INTEGER NOT NULL", "expires BIGINT NOT NULL")
    .replace(
      "INSERT OR IGNORE INTO settings(id) VALUES(1)",
      "INSERT INTO settings(id) VALUES(1) ON CONFLICT DO NOTHING",
    );
await transaction(async () => {
  if (postgres) {
    for (const sql of schema
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await context.getStore().query(sql);
  } else sqlite.exec(schema);
  const additions = {
    users: { disabled: 'INTEGER NOT NULL DEFAULT 0' },
    products: { swatch: "TEXT NOT NULL DEFAULT ''", filter: "TEXT NOT NULL DEFAULT 'none'", badge: "TEXT NOT NULL DEFAULT ''" },
    media: { data: "TEXT NOT NULL DEFAULT ''", mime: "TEXT NOT NULL DEFAULT ''" },
  };
  for (const [table, columns] of Object.entries(additions)) {
    for (const [column, definition] of Object.entries(columns)) {
      if (postgres) await run(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
      else if (!sqlite.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column)) sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
  const seed = JSON.parse(
    readFileSync(new URL("./seed.json", import.meta.url), "utf8"),
  );
  for (const p of seed) {
    if (await one('SELECT id FROM products WHERE id=?', p.id)) {
      await run("UPDATE products SET swatch=?,filter=?,badge=? WHERE id=? AND swatch=''", p.swatch, p.filter || 'none', p.badge || '', p.id);
      continue;
    }
    await run(
      "INSERT INTO products(id,name,description,category,gender,color,price,old_price,cell,created) VALUES(?,?,?,?,?,?,?,?,?,?)",
      p.id,
      p.name,
      p.description,
      p.category,
      p.gender,
      p.color,
      Math.round(p.price * 100),
      p.oldPrice ? Math.round(p.oldPrice * 100) : null,
      p.cell,
      new Date().toISOString(),
    );
    await run('UPDATE products SET swatch=?,filter=?,badge=? WHERE id=?', p.swatch, p.filter || 'none', p.badge || '', p.id);
    for (const size of p.sizes)
      await run(
        "INSERT INTO variants VALUES(?,?,?,?,?)",
        `${p.id}-${size}`,
        p.id,
        size,
        `${p.id}-${size}`,
        0,
      );
  }
  for (const [id, name, gender, image] of [
    ["female", "Dama · estándar", "Damas", "/assets/mannequin-female.png"],
    [
      "male",
      "Caballero · estándar",
      "Caballeros",
      "/assets/mannequin-male.png",
    ],
  ])
    await run(
      "INSERT OR IGNORE INTO mannequins(id,name,gender,image) VALUES(?,?,?,?)",
      id,
      name,
      gender,
      image,
    );
});
