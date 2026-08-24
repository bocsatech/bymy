/**
 * Helyi Bocsatech admin pótlása (bocsatechadmin).
 * Futtatás: node scripts/ensure-local-admin.mjs
 */
process.env.LEVEL1_DB_PATH ??= new URL("../data/level1.db", import.meta.url).pathname;
process.env.LEVEL1_BOOTSTRAP_USERNAME = "bocsatechadmin";
process.env.LEVEL1_BOOTSTRAP_PASSWORD = "bymyadmin";
process.env.LEVEL1_BOOTSTRAP_EMAIL = "admin@localhost.local";

const { initLevel1 } = await import("../lib/level1.mjs");
await initLevel1();
console.log("OK: bocsatechadmin / bymyadmin");
