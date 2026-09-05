import type { Category } from "@/lib/news/types";

const CATEGORY_COLOR: Record<string, string> = {
  AI: "bg-cat-ai",
  Technology: "bg-cat-technology",
  Markets: "bg-cat-markets",
  Business: "bg-cat-neutral",
  World: "bg-cat-world",
  Science: "bg-cat-science",
  Cybersecurity: "bg-cat-security",
  OpenSource: "bg-cat-markets",
  Other: "bg-cat-neutral",
};

export function CategoryDot({ category }: { category: Category | string }) {
  return <span className={`cat-dot ${CATEGORY_COLOR[category] ?? "bg-cat-neutral"}`} aria-hidden />;
}

export function categoryLabel(category: Category | string): string {
  switch (category) {
    case "OpenSource":
      return "Open Source";
    case "AI":
      return "AI";
    default:
      return String(category);
  }
}
