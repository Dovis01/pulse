import { XMLParser } from "fast-xml-parser";
import type { NewsSource, RawArticle } from "@/lib/news/types";
import { fetchWithRetry } from "./fetcher";

/**
 * RSS / Atom adapter (Tier 1, cost spec §8–13). Supports conditional
 * requests (ETag / Last-Modified → 304) to respect bandwidth budgets.
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

type XmlNode = Record<string, unknown>;

function asArray(value: unknown): XmlNode[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value as XmlNode[];
  return [value as XmlNode];
}

function textOf(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    const node = value as XmlNode;
    if (typeof node["#text"] === "string") return node["#text"];
    if (typeof node["@_href"] === "string") return node["@_href"];
  }
  return undefined;
}

export interface FeedItem {
  title: string;
  link: string;
  description?: string;
  publishedAt: Date;
  author?: string;
  image?: string;
  externalId?: string;
}

/** Parse an RSS 2.0 or Atom document into feed items. Never throws. */
export function parseFeed(xml: string): FeedItem[] {
  let doc: XmlNode;
  try {
    doc = parser.parse(xml) as XmlNode;
  } catch {
    return [];
  }
  const items: FeedItem[] = [];

  const rssChannel = (doc.rss as XmlNode | undefined)?.channel as XmlNode | undefined;
  if (rssChannel) {
    for (const item of asArray(rssChannel.item)) {
      const title = textOf(item.title);
      const link = textOf(item.link) ?? textOf(item.guid);
      if (!title || !link) continue;
      const mediaNode = item["media:content"] as XmlNode | undefined;
      const enclosureNode = asArray(item.enclosure).find((e) =>
        String(e["@_type"] ?? "").startsWith("image"),
      );
      const image =
        (mediaNode?.["@_url"] as string | undefined) ??
        (enclosureNode?.["@_url"] as string | undefined);
      items.push({
        title,
        link,
        description: textOf(item.description),
        publishedAt: parseDate(textOf(item.pubDate) ?? textOf(item["dc:date"])) ?? new Date(),
        author: textOf(item["dc:creator"]) ?? textOf(item.author),
        image,
        externalId: textOf(item.guid),
      });
    }
    return items;
  }

  const atomFeed = doc.feed as XmlNode | undefined;
  if (atomFeed) {
    for (const entry of asArray(atomFeed.entry)) {
      const title = textOf(entry.title);
      const links = asArray(entry.link);
      const link =
        (links.find((l) => l["@_rel"] === "alternate" || l["@_rel"] == null)?.["@_href"] as string | undefined) ??
        textOf(entry.id);
      if (!title || !link) continue;
      items.push({
        title,
        link,
        description: textOf(entry.summary) ?? textOf(entry.content),
        publishedAt:
          parseDate(textOf(entry.published) ?? textOf(entry.updated)) ?? new Date(),
        author: textOf((entry.author as XmlNode | undefined)?.name),
        externalId: textOf(entry.id),
      });
    }
  }
  return items;
}

export function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export interface RssFetchResult {
  articles: RawArticle[];
  notModified: boolean;
  conditional?: { etag?: string; lastModified?: string };
}

export async function fetchRssSource(source: NewsSource): Promise<RssFetchResult> {
  const cached = source.metadata ?? {};
  const headers: Record<string, string> = {};
  if (typeof cached.etag === "string") headers["if-none-match"] = cached.etag;
  if (typeof cached.lastModified === "string") headers["if-modified-since"] = cached.lastModified;

  const res = await fetchWithConditional(source.url, headers);
  if (res.status === 304) return { articles: [], notModified: true };

  const xml = res.body;
  const items = parseFeed(xml);
  const articles: RawArticle[] = items.map((item) => ({
    externalId: item.externalId,
    url: item.link,
    title: item.title,
    description: item.description,
    image: item.image,
    publishedAt: item.publishedAt,
    sourceId: source.id,
    sourceName: source.name,
    author: item.author,
    language: source.language,
    country: source.country,
  }));

  return {
    articles,
    notModified: false,
    conditional: { etag: res.etag, lastModified: res.lastModified },
  };
}

async function fetchWithConditional(
  url: string,
  headers: Record<string, string>,
): Promise<{ status: number; body: string; etag?: string; lastModified?: string }> {
  const response = await fetchWithRetry(url, { headers, timeoutMs: 12_000, retries: 1 });
  if (response.status === 304) {
    return { status: 304, body: "" };
  }
  return {
    status: response.status,
    body: await response.text(),
    etag: response.headers.get("etag") ?? undefined,
    lastModified: response.headers.get("last-modified") ?? undefined,
  };
}
