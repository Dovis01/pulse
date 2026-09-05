import { config } from "dotenv";
import { seedRepository } from "../src/lib/seed/seed";
import { PgRepository } from "../src/lib/db/pg";

/**
 * Seed the Postgres database (product spec §101): sources + interests +
 * 50 sample articles across ≥10 clusters. Safe to re-run.
 * Usage: npm run db:seed [-- --reset]  (requires DATABASE_URL)
 */

async function main(): Promise<void> {
  config();
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL is not set — nothing to seed. Postgres is required for seeding.");
    process.exit(1);
  }
  console.log("Seeding Postgres…");
  const repo = new PgRepository(url);
  await repo.init();
  if (process.argv.includes("--reset")) {
    console.log("Resetting corpus (keeping sources)…");
    await repo.resetCorpusForReseed();
  }
  await seedRepository(repo);
  const articles = await repo.countArticles();
  const clusters = await repo.countClusters();
  console.log(`Done. articles=${articles} clusters=${clusters}`);
  await repo.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
