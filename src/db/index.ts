import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Utilise une valeur de secours factice pendant le build si la variable est absente
const databaseUrl = process.env.DATABASE_URL || "postgres://dummy:dummy@localhost:5432/dummy";

if (!process.env.DATABASE_URL && process.env.NODE_ENV === "production") {
  console.warn("⚠️ Avertissement : DATABASE_URL n'est pas définie. Les requêtes base de données échoueront à l'exécution.");
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);