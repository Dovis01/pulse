import type { Article, UserInterest } from "@/lib/news/types";

/**
 * Personal relevance, fully code-implemented (cost spec §115–116):
 * keyword + topic + entity + source affinity against the interest profile.
 */

export interface RelevanceInput {
  title: string;
  description?: string;
  topics: string[];
  entities: string[];
  category: string;
  interests: UserInterest[];
}

export function computeRelevance(input: RelevanceInput): number {
  if (input.interests.length === 0) return 40; // neutral
  const haystack = `${input.title} ${input.description ?? ""}`.toLowerCase();
  const topicsLower = new Set(input.topics.map((t) => t.toLowerCase()));
  const entitiesLower = new Set(input.entities.map((e) => e.toLowerCase()));

  let bestTopic = 0;
  for (const interest of input.interests) {
    const weight = interest.weight;
    const name = interest.topic.toLowerCase();

    let signal = 0;
    if (topicsLower.has(name) || entitiesLower.has(name)) signal = 1;
    else if (haystack.includes(name)) signal = 0.8;
    else if (name.length > 3 && haystack.includes(name.slice(0, Math.max(4, name.length - 2)))) {
      signal = 0.5;
    }
    const score = signal * weight;
    if (score > bestTopic) bestTopic = score;
  }

  // Category affinity as a soft floor.
  const categoryInterest = input.interests.find(
    (i) => i.topic.toLowerCase() === input.category.toLowerCase(),
  );
  const categoryFloor = categoryInterest ? categoryInterest.weight * 70 : 0;

  return Math.round(Math.max(bestTopic * 100, categoryFloor));
}

export function computeForYouScore(
  importanceScore: number,
  relevanceScore: number,
): number {
  // Spec §19: final = importance*0.55 + relevance*0.45.
  return Math.round(importanceScore * 0.55 + relevanceScore * 0.45);
}

export function scoreArticleRelevance(
  article: Article,
  interests: UserInterest[],
): number {
  return computeRelevance({
    title: article.title,
    description: article.description,
    topics: article.topics,
    entities: article.entities,
    category: article.category,
    interests,
  });
}
