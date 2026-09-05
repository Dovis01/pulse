import type { NewsSource, RawArticle } from "@/lib/news/types";
import { fetchJson } from "./fetcher";

/**
 * Hugging Face adapter (Tier 6, cost spec §26–27) — OPTIONAL by default.
 * Works anonymously; HF_TOKEN raises rate limits when present. Rate-limit
 * responses propagate to the provider isolation layer (retry later).
 */

interface HfModel {
  id?: string;
  modelId?: string;
  createdAt?: string;
  likes?: number;
  downloads?: number;
  pipeline_tag?: string;
}

function headers(): Record<string, string> {
  const token = process.env.HF_TOKEN?.trim();
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function fetchHuggingFace(source: NewsSource): Promise<RawArticle[]> {
  const common = {
    headers: headers(),
    label: "huggingface",
    timeoutMs: 12_000,
    retries: 1,
  };

  const [trending, fresh] = await Promise.allSettled([
    fetchJson<HfModel[]>(
      `https://huggingface.co/api/models?sort=likes7d&direction=-1&limit=15`,
      common,
    ),
    fetchJson<HfModel[]>(
      `https://huggingface.co/api/models?sort=createdAt&direction=-1&limit=15`,
      common,
    ),
  ]);

  const articles: RawArticle[] = [];
  const seen = new Set<string>();

  const push = (model: HfModel, kind: "trending" | "new") => {
    const id = model.modelId ?? model.id;
    if (!id || seen.has(id)) return;
    seen.add(id);
    articles.push({
      externalId: `hf-${id}`,
      url: `https://huggingface.co/${id}`,
      title:
        kind === "trending"
          ? `Trending on Hugging Face: ${id}`
          : `New model on Hugging Face: ${id}`,
      description: [
        model.pipeline_tag ? `Task: ${model.pipeline_tag}.` : "",
        model.likes != null ? `${model.likes} likes.` : "",
        model.downloads != null ? `${model.downloads} downloads.` : "",
      ]
        .filter(Boolean)
        .join(" "),
      publishedAt: model.createdAt ? new Date(model.createdAt) : new Date(),
      sourceId: source.id,
      sourceName: "Hugging Face",
      language: "en",
      metadata: { kind, modelId: id },
    });
  };

  if (trending.status === "fulfilled") for (const m of trending.value ?? []) push(m, "trending");
  if (fresh.status === "fulfilled") for (const m of fresh.value ?? []) push(m, "new");
  return articles;
}
