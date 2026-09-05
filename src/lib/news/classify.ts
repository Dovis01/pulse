import type { Category } from "./types";

/**
 * Rule-based classification + entity extraction (cost spec §55–57).
 * AI is only a fallback for uncertain cases; these rules handle the bulk.
 */

const CATEGORY_KEYWORDS: Record<Exclude<Category, "Other">, string[]> = {
  AI: [
    "openai","anthropic","claude","chatgpt","gpt","gemini","llm","llms","large language",
    "model","ai model","inference","transformer","transformers","deepseek","mistral",
    "copilot","neural","diffusion","foundation model","multimodal","chatbot","ai agent",
    "agents","rag","fine-tuning","alignment","token","weights","grok","midjourney",
    "artificial intelligence","machine learning","deep learning","reasoning model",
  ],
  OpenSource: [
    "open source","opensource","github","repository","repo","apache","mit license",
    "pull request","release notes","self-host","framework","library","fork",
    "hugging face","pytorch","kubernetes","linux","crate","npm","monorepo",
  ],
  Technology: [
    "chip","semiconductor","gpu","cpu","tSMC","apple","google","microsoft","amazon",
    "meta","tesla","smartphone","battery","cloud","data center","datacenter","5g",
    "quantum","robot","robotics","software","hardware","startup","app","api",
    "operating system","browser","internet","satellite","spacex","nvidia","amd","intel",
  ],
  Markets: [
    "stocks","stock market","nasdaq","dow","s&p","market","markets","investor",
    "investors","ipo","earnings","revenue guidance","fed","federal reserve",
    "interest rate","inflation","bond","yield","bitcoin","crypto","ethereum",
    "hedge fund","recession","tariff","currency","dollar","yuan","euro",
  ],
  Business: [
    "merger","acquisition","acquires","lawsuit","antitrust","ceo","layoffs",
    "revenue","quarterly results","partnership","deal","enterprise","funding",
    "venture capital","regulation","regulator","ftc","doj","eu commission",
  ],
  World: [
    "president","prime minister","government","election","parliament","war",
    "military","ukraine","gaza","israel","china","russia","north korea","japan",
    "taiwan","india","europe","united nations","sanctions","treaty","summit",
    "border","protest","earthquake","flood","hurricane","typhoon","climate",
  ],
  Science: [
    "researchers","study finds","scientists","research","university","physics",
    "biology","genome","space","nasa","telescope","arxiv","paper","nobel",
    "clinical trial","vaccine","fusion","chemistry","astronomy","mars","protein",
  ],
  Cybersecurity: [
    "hack","hacked","hacker","breach","data breach","ransomware","malware",
    "phishing","zero-day","exploit","vulnerability","cve","cyberattack",
    "cyber attack","botnet","spyware","leak","credentials","ddos","backdoor",
  ],
};

/** Curated entity dictionary with importance weights (0–100). */
export const ENTITY_WEIGHTS: Record<string, number> = {
  openai: 95, anthropic: 95, "google deepmind": 92, deepmind: 92, gemini: 85,
  nvidia: 95, amd: 82, intel: 78, apple: 90, microsoft: 88, google: 88,
  meta: 85, amazon: 85, tesla: 80, "tesla ": 80, tsmc: 85, samsung: 75,
  "hugging face": 85, pytorch: 82, sglang: 95, vllm: 90, transformers: 85,
  "flashinfer": 80, triton: 72, deepseek: 88, mistral: 78, xai: 80, grok: 78,
  claude: 88, chatgpt: 88, gpt: 85, copilot: 72, cursor: 70,
  "fed": 88, "federal reserve": 90, "world bank": 75, imf: 75,
  spacex: 82, nasa: 82, boeing: 75, openbsd: 60,
  "china": 80, "russia": 78, "ukraine": 78, "taiwan": 82, "north korea": 70,
  "eu": 70, "european union": 72, "united nations": 70, "japan": 70, "india": 75,
  bitcoin: 78, ethereum: 72, stripe: 65, shopify: 60, cloudflare: 78,
  vercel: 68, supabase: 62, docker: 65, kubernetes: 72, react: 65,
};

export interface Classified {
  category: Category;
  topics: string[];
  entities: string[];
  /** How confident the rule engine is (0–1). Low confidence → AI fallback. */
  confidence: number;
}

export function extractEntities(text: string): { entities: string[]; importance: number } {
  const lower = ` ${text.toLowerCase()} `;
  const found = new Map<string, number>();
  for (const [entity, weight] of Object.entries(ENTITY_WEIGHTS)) {
    const needle = entity.trim();
    if (needle.length < 2) continue;
    const idx = lower.indexOf(needle);
    if (idx > 0) found.set(needle, weight);
  }
  const entities = [...found.keys()];
  const importance = entities.length > 0 ? Math.max(...found.values()) : 0;
  return { entities, importance };
}

/** Keyword-rule classification with source category hint. */
export function classifyRules(
  text: string,
  sourceCategory?: Category,
): Classified {
  const lower = text.toLowerCase();

  let best: { category: Category; hits: number } = { category: "Other", hits: 0 };
  let totalHits = 0;
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let hits = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) hits += 1;
    }
    totalHits += hits;
    if (hits > best.hits) best = { category: category as Category, hits };
  }

  const { entities } = extractEntities(text);

  // Entity signals can tip an ambiguous item (e.g. "claude" → AI).
  if (best.hits === 0 && entities.length > 0) {
    const entityCategory = inferCategoryFromEntities(entities);
    if (entityCategory) {
      return { category: entityCategory, topics: topTopics(entityCategory, entities), entities, confidence: 0.55 };
    }
  }

  let category: Category = best.hits > 0 ? best.category : "Other";
  let confidence = totalHits === 0 ? 0.2 : Math.min(0.9, 0.35 + best.hits * 0.12);

  // Source hint wins only when rules are undecided.
  if (category === "Other" && sourceCategory && sourceCategory !== "Other") {
    category = sourceCategory;
    confidence = 0.5;
  }

  return { category, topics: topTopics(category, entities), entities, confidence };
}

function inferCategoryFromEntities(entities: string[]): Category | null {
  const AI_ENTITIES = new Set(["openai","anthropic","claude","chatgpt","gpt","deepseek","mistral","sglang","vllm","transformers","hugging face","gemini","grok","xai"]);
  const SECURITY = new Set(["cve"]);
  if (entities.some((e) => AI_ENTITIES.has(e))) return "AI";
  if (entities.some((e) => SECURITY.has(e))) return "Cybersecurity";
  return null;
}

function topTopics(category: Category, entities: string[]): string[] {
  const topics = new Set<string>();
  switch (category) {
    case "AI":
      topics.add("Artificial Intelligence");
      topics.add("LLM");
      break;
    case "OpenSource":
      topics.add("Open Source");
      break;
    case "Technology":
      topics.add("Semiconductors");
      break;
    case "Markets":
      topics.add("Markets");
      break;
    case "Cybersecurity":
      topics.add("Cybersecurity");
      break;
    default:
      break;
  }
  for (const e of entities.slice(0, 4)) {
    topics.add(e.replace(/\b\w/g, (c) => c.toUpperCase()));
  }
  return [...topics].slice(0, 6);
}
