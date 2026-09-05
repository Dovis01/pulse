import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Run SQL migrations from db/migrations against DATABASE_URL.
 * Usage: npm run db:migrate
 */

async function main(): Promise<void> {
  config();
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);
  console.log("Running migrations…");
  await migrate(db, { migrationsFolder: "./db/migrations" });
  console.log("Migrations applied.");
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
