import { describe, expect, it } from "vitest";
import { parseFeed } from "./rss";

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>Example News</title>
  <item>
    <title>First story about NVIDIA Rubin</title>
    <link>https://example.com/first?utm_source=rss</link>
    <description><![CDATA[Short description of the first story.]]></description>
    <pubDate>Fri, 04 Sep 2026 10:00:00 GMT</pubDate>
    <dc:creator>Jane Doe</dc:creator>
    <guid>https://example.com/first</guid>
    <media:content url="https://example.com/img.jpg" />
  </item>
  <item>
    <title>Second story about the Fed</title>
    <link>https://example.com/second</link>
    <description>Rate cut hints.</description>
    <pubDate>Fri, 04 Sep 2026 09:00:00 GMT</pubDate>
  </item>
</channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Example Research</title>
  <entry>
    <title>Efficient KV-Cache Compression</title>
    <link href="http://arxiv.example/abs/2609.01234" rel="alternate"/>
    <id>http://arxiv.example/abs/2609.01234</id>
    <published>2026-09-03T18:00:00Z</published>
    <summary>We study compression of KV caches for long context.</summary>
    <author><name>Alpha Author</name></author>
  </entry>
</feed>`;

describe("RSS / Atom parsing", () => {
  it("parses RSS 2.0 items with metadata", () => {
    const items = parseFeed(RSS);
    expect(items).toHaveLength(2);
    const first = items[0]!;
    expect(first.title).toBe("First story about NVIDIA Rubin");
    expect(first.link).toBe("https://example.com/first?utm_source=rss");
    expect(first.author).toBe("Jane Doe");
    expect(first.image).toBe("https://example.com/img.jpg");
    expect(first.publishedAt.toISOString()).toBe("2026-09-04T10:00:00.000Z");
  });

  it("parses Atom entries with alternate links", () => {
    const items = parseFeed(ATOM);
    expect(items).toHaveLength(1);
    const entry = items[0]!;
    expect(entry.title).toContain("KV-Cache");
    expect(entry.link).toBe("http://arxiv.example/abs/2609.01234");
    expect(entry.author).toBe("Alpha Author");
  });

  it("returns an empty array for garbage input without throwing", () => {
    expect(parseFeed("this is not xml <")).toEqual([]);
  });
});
