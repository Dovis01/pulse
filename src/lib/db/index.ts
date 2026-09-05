import { pulseConfig } from "@config/pulse.config";
import { MemoryRepository } from "./memory";
import { PgRepository } from "./pg";
import type { Repository } from "./repository";
import { seedRepository } from "@/lib/seed/seed";

/**
 * Repository resolver. DATABASE_URL present → Postgres (Supabase default).
 * Absent → in-memory demo store seeded with sample intelligence so the app
 * remains fully functional without any key (cost spec §32).
 *
 * The promise is cached on globalThis: Next.js bundles server code per
 * route, so a plain module-level singleton would give pages and API routes
 * two different stores in demo mode.
 */

const globalForPulse = globalThis as unknown as {
  __pulseRepository?: Promise<Repository>;
};

async function createRepository(): Promise<Repository> {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const pg = new PgRepository(url);
    await pg.init();
    return pg;
  }
  const memory = new MemoryRepository();
  await memory.init();
  await seedRepository(memory);
  return memory;
}

export function getRepository(): Promise<Repository> {
  if (!globalForPulse.__pulseRepository) {
    globalForPulse.__pulseRepository = createRepository().catch((err) => {
      globalForPulse.__pulseRepository = undefined;
      throw err;
    });
  }
  return globalForPulse.__pulseRepository;
}

/** Test/seed helper — builds a fresh memory repository. */
export async function createMemoryRepository(withSeed = true): Promise<MemoryRepository> {
  const repo = new MemoryRepository();
  await repo.init();
  if (withSeed) await seedRepository(repo);
  return repo;
}

export { pulseConfig };
