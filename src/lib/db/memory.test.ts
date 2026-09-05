import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "./memory";
import { buildSeedData, seedRepository } from "@/lib/seed/seed";
import { runIngestion, selectDueSources } from "@/lib/news/ingest";
import { recomputeCluster } from "@/lib/news/ingest";
import { DEFAULT_SOURCES } from "@/lib/news/registry";

/**
 * Integration tests over the in-memory repository — the same port the
 * Postgres implementation exposes, so pipeline behavior is verified
 * without a database (and without network: providers are not called).
 */

describe("MemoryRepository", () => {
  let repo: MemoryRepository;
  beforeEach(async () => {
    repo = new MemoryRepository();
    await repo.init();
  });

  it("seeds 50 articles with ≥10 clusters through the real pipeline", async () => {
    await seedRepository(repo);
    const articles = await repo.countArticles();
    const clusters = await repo.countClusters();
    expect(articles).toBeGreaterThanOrEqual(45);
    expect(clusters).toBeGreaterThanOrEqual(10);
  });

  it("deduplicates articles by canonical URL", async () => {
    const { articles } = buildSeedData();
    const first = articles[0]!;
    expect(await repo.insertArticle(first)).toBe(true);
    expect(await repo.insertArticle({ ...first, id: "other-id" })).toBe(false);
  });

  it("tracks saved + read state", async () => {
    const { articles } = buildSeedData();
    const a = articles[0]!;
    await repo.insertArticle(a);
    expect(await repo.setSaved(a.id, true)).toBe(true);
    expect((await repo.savedIds()).has(a.id)).toBe(true);
    await repo.markRead([a.id]);
    expect((await repo.readIds([a.id])).has(a.id)).toBe(true);
    expect((await repo.listSaved()).map((x) => x.id)).toContain(a.id);
  });

  it("claims and finishes jobs in bounded batches", async () => {
    for (let i = 0; i < 25; i += 1) {
      await repo.enqueueJob("summarize-cluster", { clusterId: `c-${i}` });
    }
    const batch = await repo.claimJobs(20);
    expect(batch).toHaveLength(20);
    await repo.finishJob(batch[0]!.id);
    const again = await repo.claimJobs(20);
    expect(again).toHaveLength(5); // 25 enqueued − 20 claimed (first is completed)
  });

  it("recomputes cluster aggregates from member articles", async () => {
    await seedRepository(repo);
    const clusters = await repo.listClusters({ limit: 1 });
    const cluster = clusters[0]!;
    const updated = await recomputeCluster(repo, cluster.id, new Date());
    expect(updated.sourceCount).toBeGreaterThan(0);
    expect(updated.importanceScore).toBeGreaterThanOrEqual(0);
    expect(updated.importanceScore).toBeLessThanOrEqual(100);
  });

  it("prunes old data during cleanup but keeps saved stories", async () => {
    await seedRepository(repo);
    const articles = [...(await repo.listArticles({ limit: 200 }))];
    const keep = articles[0]!;
    await repo.setSaved(keep.id, true);
    const result = await repo.cleanup({
      rawContentDays: 0,
      articleDays: 0,
      runDays: 30,
      jobDays: 7,
    });
    expect(result.articlesPruned).toBeGreaterThan(0);
    const remaining = await repo.listArticles({ limit: 500 });
    expect(remaining.map((a) => a.id)).toContain(keep.id);
  });
});

describe("ingestion orchestration", () => {
  it("selects only due sources for a group", () => {
    const now = new Date();
    const due = selectDueSources(
      DEFAULT_SOURCES.map((s, i) => ({
        ...s,
        lastFetchedAt: i % 2 === 0 ? new Date(now.getTime() - 120 * 60_000).toISOString() : undefined,
      })),
      "fast",
      now,
    );
    expect(due.length).toBeGreaterThan(0);
    expect(due.every((s) => s.group === "fast")).toBe(true);
  });

  it("completes gracefully with no due sources (no network calls)", async () => {
    const repo = new MemoryRepository();
    await repo.init();
    const summary = await runIngestion("fast", { repo });
    expect(summary.fetched).toBe(0);
    expect(summary.created).toBe(0);
    expect(summary.runIds).toHaveLength(0);
  }, 10_000);

  it("records ingestion runs for observability", async () => {
    const repo = new MemoryRepository();
    await repo.init();
    const runId = crypto.randomUUID();
    await repo.startRun({
      id: runId,
      provider: "rss",
      group: "fast",
      startedAt: new Date().toISOString(),
      fetched: 10,
      created: 8,
      duplicates: 2,
      failed: 0,
    });
    await repo.finishRun(runId, { finishedAt: new Date().toISOString(), created: 8 });
    const runs = await repo.recentRuns(5);
    expect(runs[0]?.id).toBe(runId);
    expect(runs[0]?.created).toBe(8);
  });
});
