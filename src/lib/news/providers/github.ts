import { pulseConfig } from "@config/pulse.config";
import type { NewsSource, RawArticle } from "@/lib/news/types";
import { fetchJson } from "./fetcher";

/**
 * GitHub adapter (Tier 3, cost spec §17–20). Watchlist releases + recently
 * merged PRs. Deliberately NOT every commit/issue (cost spec §19).
 */

interface GhRelease {
  id: number;
  tag_name?: string;
  name?: string;
  html_url?: string;
  published_at?: string;
  body?: string;
}

interface GhPull {
  id: number;
  number: number;
  title?: string;
  html_url?: string;
  merged_at?: string | null;
  created_at?: string;
  user?: { login?: string };
}

function headers(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN?.trim();
  const base: Record<string, string> = { accept: "application/vnd.github+json" };
  if (token) base.authorization = `Bearer ${token}`;
  return base;
}

export async function fetchGithub(source: NewsSource, now = new Date()): Promise<RawArticle[]> {
  const repos = pulseConfig.github.repositories;
  const cutoff = now.getTime() - 48 * 3_600_000;
  const articles: RawArticle[] = [];

  const repoResults = await Promise.allSettled(
    repos.map(async (repo) => {
      const out: RawArticle[] = [];
      const releases = await fetchJson<GhRelease[]>(`https://api.github.com/repos/${repo}/releases?per_page=3`, {
        headers: headers(),
        label: `github:${repo}`,
        retries: 0,
      }).catch(() => [] as GhRelease[]);
      for (const release of releases) {
        const publishedAt = release.published_at ? new Date(release.published_at) : now;
        if (publishedAt.getTime() < cutoff) continue;
        out.push({
          externalId: `gh-release-${release.id}`,
          url: release.html_url ?? `https://github.com/${repo}/releases`,
          title: `${repo} released ${release.name ?? release.tag_name ?? "a new version"}`,
          description: release.body?.replace(/<[^>]+>/g, " ").slice(0, 400),
          publishedAt,
          sourceId: source.id,
          sourceName: "GitHub",
          language: "en",
          metadata: { kind: "release", repo, tag: release.tag_name },
        });
      }

      const pulls = await fetchJson<GhPull[]>(`https://api.github.com/repos/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=10`, {
        headers: headers(),
        label: `github:${repo}`,
        retries: 0,
      }).catch(() => [] as GhPull[]);
      for (const pr of pulls) {
        if (!pr.merged_at) continue;
        const mergedAt = new Date(pr.merged_at);
        if (mergedAt.getTime() < cutoff) continue;
        out.push({
          externalId: `gh-pr-${pr.id}`,
          url: pr.html_url ?? `https://github.com/${repo}/pulls`,
          title: `${repo} merged PR #${pr.number}: ${pr.title ?? "untitled"}`,
          publishedAt: mergedAt,
          sourceId: source.id,
          sourceName: "GitHub",
          author: pr.user?.login,
          language: "en",
          metadata: { kind: "merged_pr", repo, prNumber: pr.number },
        });
      }
      return out;
    }),
  );
  // Per-repo isolation: one failing repo must not break the batch.
  for (const r of repoResults) {
    if (r.status === "fulfilled") articles.push(...r.value);
  }

  return articles;
}
