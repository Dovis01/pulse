# Personal Global Intelligence Feed
## 全球实时个人新闻情报聚合系统 — 产品 / UI / 架构 / Agent 开发规格

Version: v1.0  
Project Codename: `Pulse`  
Type: Personal News Intelligence Dashboard  
Primary User: Single user / Personal deployment  
Primary Language: English + Chinese bilingual  
Theme: Minimal / Editorial / Technical / Intelligence

---

# 1. 产品目标

构建一个个人部署的全球实时信息聚合网站。

它不是简单的 RSS Reader，也不是普通新闻门户。

目标是：

> 将全球每天不断产生的新闻、科技动态、AI、金融、开源、地缘政治、商业、科研等信息，自动抓取、去重、分类、聚类、总结、评分，再以一个极简、高信息密度、优雅的个人 Dashboard 展示。

系统应该让我每天打开一次，就可以快速知道：

- 世界今天发生了什么
- AI / LLM / Open Source 今天发生了什么
- GitHub / Hugging Face / AI Infra 有什么值得关注
- 全球科技公司有什么重要变化
- 全球市场有什么重要新闻
- 哪些事件正在快速升温
- 哪些新闻是多个媒体同时报道的重要事件
- 哪些事情与我的兴趣高度相关
- 今天相比昨天“新增了什么”

整个系统必须具备：

- Near-real-time 数据获取
- AI Summary
- Topic clustering
- Deduplication
- Importance scoring
- Personal relevance ranking
- Translation
- Search
- Daily digest
- Push notification
- Historical archive

---

# 2. 产品定位

产品不是：

- CNN Clone
- Google News Clone
- RSS 阅读器
- 信息瀑布流
- 社交媒体 Feed

产品更接近：

```text
Bloomberg Terminal
      ×
Google News
      ×
Techmeme
      ×
Perplexity
      ×
Linear
      ×
Vercel Docs
```

但是服务于个人。

核心理念：

```text
Less Noise.
More Signal.
```

所有设计和工程决策都应该围绕：

1. Signal-to-noise ratio
2. Information density
3. Readability
4. Speed
5. Source transparency
6. Personal relevance

展开。

---

# 3. 项目名称建议

默认项目名称：

# PULSE

副标题：

```text
Global Intelligence Feed
```

也可以预留配置：

```env
NEXT_PUBLIC_SITE_NAME=Pulse
NEXT_PUBLIC_SITE_TAGLINE=Global Intelligence Feed
```

首页 Logo 建议：

```text
PULSE /
```

或：

```text
PULSE
Global Intelligence
```

不要设计复杂 logo。

纯 typography 即可。

---

# 4. 网站整体视觉方向

视觉关键词：

```text
Minimal
Editorial
Technical
Premium
Quiet
Dense
Precise
Neutral
Timeless
```

不要：

- 大面积渐变
- Neon Cyberpunk
- 大量卡片阴影
- 圆角过度
- Glassmorphism
- 彩色 Dashboard
- 大量图标
- 新闻门户式 Banner
- Bootstrap 风格
- Material UI 风格

页面应该像：

```text
一本现代科技杂志
+
Developer Documentation
+
Research Dashboard
```

---

# 5. Design System

## 5.1 Color

Light Theme：

```css
--background: #FAFAF9;
--surface: #FFFFFF;

--text-primary: #181817;
--text-secondary: #686866;
--text-muted: #9B9B96;

--border: #E8E8E4;
--border-strong: #D8D8D2;

--hover: #F3F3F0;

--accent: #181817;
```

Dark Theme：

```css
--background: #0D0D0C;
--surface: #121211;

--text-primary: #F2F2EF;
--text-secondary: #A3A39D;
--text-muted: #6F6F69;

--border: #262624;
--border-strong: #353532;

--hover: #181817;
```

新闻类型颜色只能作为非常微弱的辅助色。

例如：

```text
AI           violet
Technology   blue
Markets      emerald
World        orange
Science      cyan
Security     red
```

但是不要让 UI 变彩色。

颜色只用于：

```text
tiny dot
category indicator
small badge
chart line
```

---

# 6. Typography

字体优先：

```text
Inter
Geist Sans
Geist Mono
```

推荐：

```css
font-family:
  "Geist",
  "Inter",
  system-ui,
  sans-serif;
```

代码 / Metadata：

```css
font-family:
  "Geist Mono",
  monospace;
```

标题不要粗到 800。

推荐：

```text
400
500
600
```

大量使用：

```text
font-weight: 450 / 500
```

Headline：

```text
font-size: 30–42px
letter-spacing: -0.03em
line-height: 1.1
```

正文：

```text
15–16px
line-height: 1.65
```

Metadata：

```text
11–13px
```

---

# 7. Layout

Desktop 最大宽度：

```text
1440px
```

主体：

```text
Sidebar        220px
Main           flexible
Right Rail     280px
```

结构：

```text
┌───────────────────────────────────────────────────────────┐
│ PULSE                              Search       20:42 JST │
├──────────────┬──────────────────────────────┬─────────────┤
│              │                              │             │
│ Sidebar      │ Main News Feed               │ Intelligence│
│              │                              │ Rail        │
│              │                              │             │
└──────────────┴──────────────────────────────┴─────────────┘
```

页面不要到处使用 Card。

主要依靠：

```text
spacing
typography
1px borders
section separators
```

组织信息。

---

# 8. Sidebar

左侧固定 Sidebar。

内容：

```text
PULSE /
```

---

Navigation：

```text
Today

Overview
For You
Breaking
Latest
Trending
```

---

Topics：

```text
AI
Technology
Open Source
Markets
Business
World
Science
Cybersecurity
```

---

Intelligence：

```text
Daily Brief
Topics
Sources
Timeline
Saved
```

---

System：

```text
Settings
```

Sidebar 底部：

```text
Last sync
20:42:18

● Live
```

---

# 9. 首页 / Today 页面

Route：

```text
/
```

或：

```text
/today
```

页面顶部：

```text
Friday
September 4, 2026

Good evening.
Here is what matters today.
```

右侧：

```text
142 sources
1,284 stories
63 clusters

Updated 32s ago
```

---

# 10. Global Brief

首页第一模块：

```text
GLOBAL BRIEF
```

由 AI 自动生成：

```text
Today is dominated by renewed AI infrastructure competition,
a sharp move in semiconductor stocks, and several major
geopolitical developments across Asia and Europe.

Three developments deserve particular attention...
```

控制在：

```text
150–300 words
```

支持：

```text
Brief
Detailed
中文
English
```

---

# 11. Top Stories

核心区域：

```text
TOP STORIES
```

每条 Story 使用非常克制的布局。

示例：

```text
01

OpenAI introduces ...
Major changes to ...

AI · 12 min ago · Reuters + 18 sources

The announcement introduces...
AI generated summary ...

↑ 92 Importance
```

最多 5–10 条。

---

# 12. Story Cluster

非常重要。

不要把：

```text
Reuters
Bloomberg
CNN
BBC
The Verge
```

针对同一个事件的报道显示成 5 条新闻。

应该聚合成：

```text
EVENT CLUSTER
```

例如：

```text
NVIDIA announces new architecture

21 sources

Reuters
Bloomberg
The Verge
CNBC
TechCrunch
...
```

AI 生成：

```text
What happened
Why it matters
Key details
Different perspectives
```

---

# 13. Story Card 数据

每一个 Story 至少包含：

```ts
interface Story {
  id: string

  title: string
  subtitle?: string

  summary: string

  source: Source

  sourceUrl: string

  publishedAt: Date

  category: Category

  tags: string[]

  language: string

  country?: string

  importanceScore: number

  relevanceScore: number

  velocityScore: number

  confidenceScore: number

  clusterId?: string

  image?: string

  entities: Entity[]
}
```

---

# 14. News Detail Page

Route：

```text
/story/[slug]
```

结构：

```text
Category

Headline

AI generated subtitle

SOURCE · TIME · COUNTRY

--------------------------------

AI SUMMARY

3–5 paragraphs

--------------------------------

KEY POINTS

• ...
• ...
• ...

--------------------------------

WHY IT MATTERS

...

--------------------------------

TIMELINE

18:21 Reuters
18:34 Bloomberg
18:41 CNBC

--------------------------------

COVERAGE

21 sources

--------------------------------

RELATED STORIES
```

---

# 15. Source Transparency

任何 AI Summary 必须显示原始来源。

绝对不能制造“AI 自己就是新闻源”的感觉。

例如：

```text
Based on 17 reports
```

展开：

```text
Reuters
Bloomberg
AP
Financial Times
BBC
...
```

每一个 source 都应该可以点击跳回原文。

---

# 16. Breaking News

Breaking News 判断不要单纯依赖 source 字段。

算法综合：

```text
publication velocity
source diversity
source authority
recency
entity importance
cross-region coverage
```

Breaking Score：

```text
0–100
```

超过：

```text
85
```

进入 Breaking。

---

# 17. Importance Score

核心算法：

```text
importance =
    0.25 * sourceAuthority
  + 0.25 * sourceCount
  + 0.20 * velocity
  + 0.15 * entityImportance
  + 0.10 * geographicSpread
  + 0.05 * recency
```

最终：

```text
0–100
```

---

# 18. Personal Relevance Score

这是本系统区别于 Google News 的重要功能。

建立：

```text
User Interest Profile
```

例如：

```yaml
high:
  - artificial intelligence
  - large language models
  - transformers
  - sglang
  - inference
  - NVIDIA
  - AMD
  - AI infrastructure
  - GitHub
  - Hugging Face

medium:
  - global technology
  - semiconductor
  - cybersecurity
  - startups
  - financial markets

low:
  - entertainment
  - sports
```

计算：

```text
semantic similarity
+
keyword affinity
+
previous reading behavior
+
saved stories
+
manually followed topics
```

生成：

```text
relevance_score
```

---

# 19. For You

Route：

```text
/for-you
```

这里只显示：

```text
relevance_score > threshold
```

排序：

```text
final_score =
importance_score * 0.55
+
relevance_score * 0.45
```

---

# 20. AI 分类

标准 Category：

```ts
type Category =
  | "AI"
  | "Technology"
  | "OpenSource"
  | "Markets"
  | "Business"
  | "World"
  | "Science"
  | "Cybersecurity"
  | "Other"
```

另外单独维护：

```text
Topics
Entities
Keywords
```

例如：

```json
{
  "category": "AI",
  "topics": [
    "LLM",
    "AI Infrastructure",
    "Open Source"
  ],
  "entities": [
    "OpenAI",
    "NVIDIA",
    "SGLang"
  ]
}
```

---

# 21. 数据获取 Sources

系统不能依赖单一新闻 API。

应该做：

```text
Source Adapter Architecture
```

---

## Layer 1

RSS / Atom feeds

首选。

例如：

```text
Reuters
BBC
TechCrunch
The Verge
Ars Technica
Hacker News
company blogs
AI labs
GitHub
Hugging Face
research blogs
```

---

## Layer 2

GDELT

用于：

```text
global event discovery
international media
cross-country coverage
story discovery
```

GDELT DOC API 可以作为全球新闻发现层。

---

## Layer 3

News API providers

实现接口：

```ts
interface NewsProvider {
  fetchLatest(): Promise<RawArticle[]>
}
```

适配器：

```text
GDELTProvider
RSSProvider
NewsAPIProvider
GithubProvider
HackerNewsProvider
ArxivProvider
CustomProvider
```

注意：

NewsAPI 免费 Developer 套餐目前明确只允许开发/测试，且新闻有 24 小时延迟，不应该作为个人生产部署的核心实时数据源。

---

# 22. Specialized Sources

除了传统新闻，要单独增加科技情报源。

## GitHub

抓取：

```text
Trending repositories
New releases
Important issues
Important PR
Star growth
Repositories followed by user
```

例如：

```text
sglang
transformers
vllm
pytorch
flashinfer
triton
cuda related projects
```

---

## Hugging Face

抓取：

```text
Trending Models
New Models
Trending Papers
Spaces
Library releases
```

---

## Hacker News

抓取：

```text
Top
Best
New
Show HN
```

---

## arXiv

抓取：

```text
cs.AI
cs.CL
cs.LG
cs.DC
```

---

# 23. Ingestion Pipeline

完整数据流：

```text
Sources
   ↓
Collectors
   ↓
Normalize
   ↓
URL canonicalization
   ↓
Content extraction
   ↓
Language detection
   ↓
Deduplication
   ↓
Embedding
   ↓
Story clustering
   ↓
Classification
   ↓
Entity extraction
   ↓
Importance scoring
   ↓
LLM summarization
   ↓
Database
   ↓
API
   ↓
Frontend
```

---

# 24. Fetch Frequency

建议：

Breaking sources：

```text
2–5 minutes
```

Normal news：

```text
10 minutes
```

Blogs：

```text
15–30 minutes
```

GitHub：

```text
10–30 minutes
```

arXiv：

```text
1 hour
```

Daily Brief：

```text
07:30
12:00
18:00
23:00
```

允许 Settings 修改。

---

# 25. 数据库

推荐：

```text
PostgreSQL
```

个人部署可以：

```text
Supabase Postgres
```

或：

```text
self-host PostgreSQL
```

---

# 26. Tables

核心表：

```text
sources
articles
story_clusters
article_cluster_links
categories
topics
article_topics
entities
article_entities
daily_briefs
user_interests
saved_articles
read_history
notifications
ingestion_jobs
```

---

# 27. articles

```sql
articles

id uuid

source_id uuid

external_id text

url text

canonical_url text

title text

description text

content text

language text

country text

published_at timestamptz
fetched_at timestamptz

author text

image_url text

category text

importance_score float
relevance_score float
velocity_score float

embedding vector

metadata jsonb

created_at timestamptz
```

Unique：

```text
canonical_url
```

---

# 28. story_clusters

```sql
story_clusters

id uuid

canonical_title text

summary_short text

summary_full text

why_it_matters text

category text

importance_score float

first_seen_at timestamptz
last_updated_at timestamptz

source_count int

embedding vector

metadata jsonb
```

---

# 29. Semantic Deduplication

新闻重复检测分三级。

### Level 1

URL：

```text
canonical_url
```

### Level 2

Title similarity：

```text
normalized title
Levenshtein
token similarity
```

### Level 3

Embedding similarity：

```text
cosine_similarity > threshold
```

例如：

```text
> 0.88
```

再结合：

```text
same entity
same time window
same topic
```

判断 Story Cluster。

不要只用标题。

---

# 30. Embeddings

使用 pgvector 保存：

```text
article embedding
cluster embedding
interest embedding
```

用途：

```text
semantic search
deduplication
clustering
recommendation
related stories
```

---

# 31. AI Processing Pipeline

不要每篇文章调用一次昂贵大模型。

采用两级 AI。

## Level 1

Cheap model / small model：

```text
classification
keywords
entities
language
importance hints
```

## Level 2

Strong model：

只有当：

```text
cluster importance > threshold
```

才进行：

```text
high-quality summary
why it matters
daily brief
cross-source synthesis
```

---

# 32. AI Structured Output

所有 AI 请求尽可能 JSON Schema。

例如：

```json
{
  "category": "AI",
  "topics": [],
  "entities": [],
  "summary": "",
  "why_it_matters": "",
  "importance": 0,
  "confidence": 0
}
```

禁止依赖自由格式文本解析。

---

# 33. Daily Brief

Route：

```text
/brief
```

每天生成：

# Morning Brief

模块：

```text
Global
AI
Technology
Markets
Open Source
Science
Watchlist
```

---

格式：

```text
SEPTEMBER 4

THE DAILY BRIEF

7 stories worth knowing today.

01
...

02
...

03
...
```

最后：

```text
WATCH TODAY

• NVIDIA ...
• Fed ...
• OpenAI ...
```

---

# 34. “What Changed”

非常重要的特色功能。

每天都应该支持：

```text
What changed since morning?
What changed since yesterday?
```

例如：

```text
SINCE 08:00

+ 14 major stories
+ 3 breaking developments
+ 2 stories escalated
+ 1 previous report corrected
```

---

# 35. Trending

Route：

```text
/trending
```

Trending 不等于 Importance。

计算：

```text
current source count
/
historical baseline
```

例如：

```text
AI Agents
↑ 340%

NVIDIA
↑ 185%

Taiwan
↑ 124%
```

---

# 36. Topic Page

Route：

```text
/topic/[slug]
```

例如：

```text
/topic/artificial-intelligence
```

页面：

```text
Artificial Intelligence

124 stories · last 24h

Overview
Latest
Trending
Entities
Timeline
```

展示：

```text
Topic velocity chart
Top entities
Top stories
Related topics
```

---

# 37. Search

全局：

```text
⌘ K
```

或：

```text
Ctrl K
```

Search Modal：

```text
Search stories, topics, sources...
```

支持：

```text
keyword search
semantic search
entity search
source search
```

例如：

```text
"GLM 5"
```

返回：

```text
Stories
Topics
Entities
Sources
```

---

# 38. Command Palette

除了 Search，也提供：

```text
Go to AI
Go to Latest
Open Daily Brief
Switch Theme
Mark all read
Refresh feeds
Generate brief
```

设计参考开发者工具，而非新闻网站。

---

# 39. Right Intelligence Rail

首页右栏：

## Trending

```text
01 AI Agents        +42%
02 NVIDIA           +31%
03 OpenAI           +28%
04 Taiwan           +19%
```

---

## Markets

可以后续接行情。

```text
NASDAQ
BTC
NVDA
AMD
```

不是 v1 强制。

---

## Live

```text
20:42 Reuters
20:40 GitHub
20:38 Bloomberg
```

---

# 40. Timeline

Route：

```text
/timeline
```

严格时间排序。

例如：

```text
20:42
Reuters
...

20:39
GitHub
...

20:32
BBC
...
```

用于查看真正 realtime feed。

---

# 41. Saved

Route：

```text
/saved
```

支持：

```text
save
archive
tag
note
```

未来可以作为个人 Knowledge Base。

---

# 42. Read State

文章：

```text
unread
read
saved
archived
```

read 后：

```text
opacity slightly reduced
```

不要隐藏。

---

# 43. Push / Digest

至少实现：

## Email Digest

每天：

```text
08:00
```

发送：

```text
Daily Brief
```

可以使用 Email Provider Adapter。

接口：

```ts
interface NotificationProvider {
  send(message: Digest): Promise<void>
}
```

实现：

```text
Resend
Telegram
Discord
Slack
Webhook
```

Resend 当前支持 REST API、SDK 和定时邮件，因此可以作为默认 email provider。

---

# 44. Telegram

非常推荐支持。

环境变量：

```text
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

Breaking News：

```text
⚡ BREAKING

NVIDIA ...

92 Importance
21 sources

Why it matters:
...
```

点击：

```text
Open in Pulse
```

---

# 45. Notification Rules

Settings：

```text
Breaking News
[ON]

Minimum importance
[90]

AI
[ON]

Technology
[ON]

Markets
[OFF]

Quiet Hours
23:00 → 08:00
```

---

# 46. Settings

Route：

```text
/settings
```

Sections：

```text
General
Appearance
Sources
Topics
AI
Notifications
Data
System
```

---

# 47. Source Management

Route：

```text
/settings/sources
```

显示：

```text
Reuters        ● Active
BBC            ● Active
TechCrunch     ● Active
Hacker News    ● Active
arXiv          ● Active

+ Add RSS Source
```

支持：

```text
enable
disable
weight
category
language
refresh interval
```

---

# 48. Interest Management

Settings：

```text
Your interests
```

例如：

```text
Artificial Intelligence       HIGH
LLM                           HIGH
Open Source                   HIGH
SGLang                        HIGH
Semiconductors                MEDIUM
Finance                       MEDIUM
Sports                        LOW
```

可以拖动排序。

---

# 49. Tech Stack

推荐固定：

```text
Next.js 16
TypeScript
React
Tailwind CSS
shadcn/ui selectively
Lucide Icons
PostgreSQL
Supabase
pgvector
Zod
Drizzle ORM
```

不要为了 UI 全面依赖 shadcn 默认样式。

shadcn 只作为：

```text
Dialog
Popover
Command
Dropdown
Tooltip
Sheet
```

等 primitives。

所有视觉 style 自己实现。

---

# 50. Backend

Next.js 负责：

```text
UI
API
Server Components
Server Actions
Authentication
```

News ingestion 不建议完全和 Web 请求绑定。

建立：

```text
/workers
```

或：

```text
/src/jobs
```

---

# 51. 推荐 Monorepo

```text
pulse/

apps/
  web/

packages/
  db/
  news/
  ai/
  shared/
  config/

workers/
  ingestion/
  processing/

scripts/

docs/
```

如果 Agent 希望保持简单，也可以第一版：

```text
src/
  app/
  components/
  lib/
    ai/
    news/
    db/
    scoring/
    clustering/
  jobs/
```

---

# 52. 推荐目录

```text
src/

app/
  (dashboard)/
    page.tsx

    latest/
    trending/
    for-you/
    brief/
    saved/
    timeline/

    topic/[slug]/
    story/[slug]/

  settings/

  api/
    ingest/
    search/
    stories/
    brief/
    cron/

components/

  layout/
    sidebar.tsx
    header.tsx
    intelligence-rail.tsx

  news/
    story-row.tsx
    story-cluster.tsx
    story-meta.tsx
    source-list.tsx

  brief/
    daily-brief.tsx

  search/
    command-menu.tsx

  ui/

lib/

  db/
  ai/

  news/
    providers/

  ranking/
  clustering/
  deduplication/
  notifications/

jobs/
```

---

# 53. News Provider Interface

必须先抽象接口。

```ts
export interface RawArticle {
  externalId?: string
  url: string
  title: string
  description?: string
  content?: string
  publishedAt: Date
  source: string
  author?: string
  image?: string
  language?: string
}

export interface NewsProvider {
  id: string

  fetchLatest(
    since?: Date
  ): Promise<RawArticle[]>
}
```

---

# 54. RSS Adapter

实现：

```text
RSSProvider
```

输入：

```ts
{
  name:
  url:
  category:
  country:
  authority:
}
```

统一 normalize 成 RawArticle。

---

# 55. Scheduler

个人部署第一版可以：

```text
Supabase Cron
```

触发 HTTP Edge Function / API endpoint。

Supabase Cron 当前底层使用 pg_cron，可执行 SQL、Database Function、HTTP 请求或 Edge Function，因此很适合这个场景。

Cron 不应该承担大型 AI pipeline。

Cron 负责：

```text
enqueue work
```

Worker 负责：

```text
actual processing
```

---

# 56. Queue

MVP：

```text
Postgres jobs table
```

后期：

```text
Redis
BullMQ
Upstash
```

第一版避免引入过多基础设施。

---

# 57. API

核心 endpoints：

```text
GET /api/stories

GET /api/stories/:id

GET /api/topics

GET /api/trending

GET /api/search

GET /api/brief

POST /api/save

POST /api/read

POST /api/admin/refresh
```

---

# 58. Authentication

因为个人网站：

第一版支持：

```text
single-user authentication
```

方案：

```text
Supabase Auth
```

可以：

```text
GitHub Login
```

并通过 allowlist：

```env
ALLOWED_EMAIL=
```

阻止其他人使用。

---

# 59. SEO

该网站默认个人服务。

因此：

```text
robots noindex
```

如果未来公开：

再开启 SEO。

---

# 60. Performance

首页不要一次返回 1000 条。

Initial：

```text
30 stories
```

Infinite pagination：

```text
cursor based pagination
```

Image：

```text
lazy loading
```

Server Components 优先。

不要每条 story 都产生 client component。

---

# 61. Loading

不要 spinner 海。

使用 skeleton。

例如：

```text
──────────────
████████████
████████
──────────────
```

---

# 62. Interaction

Hover：

```text
background #F5F5F2
```

100–150ms。

不要：

```text
scale
bounce
large shadow
```

---

# 63. Motion

只允许：

```text
opacity
translateY 2–4px
```

duration：

```text
120–180ms
```

---

# 64. Mobile

Mobile 不做缩小版 Desktop。

底部 navigation：

```text
Today
Latest
For You
Search
Menu
```

Right Rail 隐藏。

Sidebar 进入 Drawer。

---

# 65. Desktop Keyboard UX

必须支持：

```text
j        next story
k        previous story
o        open
s        save
r        refresh
/        search
g t      today
g l      latest
```

可以后续实现。

---

# 66. AI Summary Safety

摘要必须明确：

```text
AI-generated summary
```

数据库保存：

```text
summary_model
summary_generated_at
summary_version
```

这样模型升级后可以重新生成。

---

# 67. Prompt Versioning

建立：

```text
prompts/
```

例如：

```text
classification-v1.ts
story-summary-v1.ts
daily-brief-v1.ts
importance-v1.ts
```

绝对不要把大型 Prompt 散落在代码里。

---

# 68. Observability

Settings → System：

```text
SYSTEM STATUS

Database        Healthy
Crawler         Healthy
AI Pipeline     Healthy
Email           Healthy

Last ingestion
32 sec ago

Last AI batch
2 min ago
```

---

# 69. Ingestion Logs

数据库：

```text
ingestion_runs
```

保存：

```text
provider
started_at
finished_at

received
created
duplicate
failed

error
```

---

# 70. Failure Strategy

任何 Source 报错不能导致 pipeline 失败。

例如：

```ts
Promise.allSettled()
```

每个 Provider：

```text
isolated
retryable
observable
```

---

# 71. Rate Limits

每个 provider 设置：

```text
requests_per_minute
retry_after
backoff
```

指数退避：

```text
1s
2s
4s
8s
```

---

# 72. Content Extraction

RSS 没有正文时：

```text
article URL
        ↓
metadata extraction
        ↓
readability extraction
```

但务必尊重：

```text
robots
publisher policies
copyright
API terms
```

系统默认展示：

```text
title
short excerpt
AI summary
source link
```

不要公开重新发布完整版权文章。

---

# 73. Global Language

新闻保存：

```text
original_title
original_summary
language
```

额外生成：

```text
title_en
title_zh
summary_en
summary_zh
```

UI 设置：

```text
Display Language

English
中文
Original
```

---

# 74. Timezone

数据库：

```text
UTC
```

Frontend：

```text
User timezone
```

默认：

```text
Asia/Tokyo
```

设置可修改。

Metadata 示例：

```text
18 min ago
```

Hover：

```text
2026-09-04 20:31 JST
```

---

# 75. 首页信息层级

严格按照：

```text
1 GLOBAL BRIEF

2 BREAKING

3 TOP STORIES

4 FOR YOU

5 AI & TECHNOLOGY

6 WORLD

7 OPEN SOURCE

8 MORE
```

不能只是时间排序。

---

# 76. AI / Technology 特别区

因为该系统是个人技术情报系统，AI 页面应该比一般新闻系统更专业。

Route：

```text
/ai
```

Tabs：

```text
News
Models
Research
GitHub
Companies
Infrastructure
```

Entities：

```text
OpenAI
Anthropic
Google DeepMind
Meta
NVIDIA
AMD
Hugging Face
PyTorch
SGLang
vLLM
Transformers
```

---

# 77. Open Source Intelligence

Route：

```text
/open-source
```

模块：

```text
Trending Repositories
Hot Issues
Major Releases
Model Releases
Research Code
```

仓库 Story 例如：

```text
SGLang

v0.x.x released

+1.2k stars this week
18 active PRs

Key changes:
...
```

---

# 78. GitHub Personal Watchlist

配置：

```yaml
github:
  repositories:
    - sgl-project/sglang
    - huggingface/transformers
    - vllm-project/vllm
    - pytorch/pytorch
```

显示：

```text
12 new issues
4 merged PR
2 releases
```

AI 只总结：

```text
high-impact changes
```

---

# 79. Homepage Wireframe

```text
PULSE /                                         Search ⌘K

TODAY
Friday, September 4

Good evening.
Here is what matters today.

──────────────────────────────────────────────────────────

GLOBAL BRIEF

AI infrastructure competition intensified today as...
Markets reacted...
Three developments deserve particular attention...

──────────────────────────────────────────────────────────

BREAKING

● 20:41

Major event headline...

Reuters · Bloomberg · AP +14

Short synthesis...

──────────────────────────────────────────────────────────

TOP STORIES

01  AI
    Headline
    Summary
    Reuters +12                       92

02  WORLD
    Headline
    Summary
    AP +8                            87

03  TECHNOLOGY
    ...

──────────────────────────────────────────────────────────

FOR YOU

SGLang ...
Transformers ...
NVIDIA ...

──────────────────────────────────────────────────────────
```

---

# 80. Story Row 视觉

不要传统 Card。

使用：

```text
border-top
padding-y 20
```

结构：

```text
CATEGORY · TIME

HEADLINE

summary summary summary

SOURCE + N SOURCES                        SCORE
```

---

# 81. 图片策略

不要每条新闻大图。

首页图片比例：

```text
10–30%
```

只：

```text
Top Story
Feature Story
Major event
```

使用图片。

其余 typography first。

这样页面更像 intelligence dashboard。

---

# 82. Skeleton UI

每一个 section 首次加载：

```text
4–6 行灰色 skeleton
```

不要全屏 Loading。

---

# 83. Empty State

例如 Saved：

```text
Nothing saved yet.

Stories you save will appear here.
```

简单即可。

---

# 84. Environment Variables

```env
DATABASE_URL=

NEXT_PUBLIC_APP_URL=

AUTH_SECRET=

ALLOWED_EMAIL=

OPENAI_API_KEY=
AI_MODEL_FAST=
AI_MODEL_STRONG=
EMBEDDING_MODEL=

TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

RESEND_API_KEY=

GITHUB_TOKEN=

NEWS_API_KEY=

CRON_SECRET=
```

任何 provider 都应该 Optional。

没有 key 也不能导致应用启动失败。

---

# 85. Config File

建立：

```text
config/pulse.config.ts
```

例如：

```ts
export const config = {
  timezone: "Asia/Tokyo",

  refresh: {
    breaking: 2,
    default: 10
  },

  ai: {
    enabled: true
  },

  categories: [...]
}
```

---

# 86. Docker

必须提供：

```text
Dockerfile
docker-compose.yml
```

Self-host：

```text
web
postgres
worker
```

可选：

```text
redis
```

---

# 87. Deployment Mode A

最简单：

```text
Vercel
+
Supabase
```

用于个人部署。

---

# 88. Deployment Mode B

完整 Self-host：

```text
Docker Compose

Next.js
Postgres
Worker
Redis optional
```

支持：

```bash
docker compose up -d
```

---

# 89. README

README 必须包含：

```text
What is Pulse
Screenshots
Architecture
Quick Start
Environment Variables
News Providers
AI Setup
Docker Deployment
Vercel Deployment
Adding Sources
Development
```

---

# 90. Documentation

创建：

```text
docs/

ARCHITECTURE.md
NEWS_PIPELINE.md
AI_PIPELINE.md
DATABASE.md
DESIGN_SYSTEM.md
DEPLOYMENT.md
PROVIDERS.md
```

保证未来 coding agent 能快速理解项目。

---

# 91. Development Phase 1

## Foundation

Agent 先实现：

```text
Next.js
Tailwind
layout
sidebar
theme
database
auth
```

创建 mock data。

首先把视觉做正确。

不要一开始就写爬虫。

验收：

```text
Today page
Latest page
Story page
Settings
Dark mode
Responsive
```

---

# 92. Development Phase 2

News pipeline：

```text
RSS Provider
normalization
database
deduplication
scheduler
```

先让真实新闻进入网站。

---

# 93. Development Phase 3

AI：

```text
classification
summary
topics
entities
importance
```

---

# 94. Development Phase 4

Clustering：

```text
embeddings
pgvector
similarity
story cluster
```

---

# 95. Development Phase 5

Personalization：

```text
interest profile
For You
semantic score
```

---

# 96. Development Phase 6

Push：

```text
Daily Brief
Email
Telegram
Breaking Alert
```

---

# 97. Development Phase 7

Advanced Intelligence：

```text
Trending
Velocity
What Changed
Timeline
Entity intelligence
Topic trend graph
```

---

# 98. Agent 开发原则

Agent 必须遵守：

### 1

不要一次实现所有功能。

逐阶段完成并运行。

### 2

每个阶段必须：

```text
build
lint
typecheck
test
```

### 3

不要使用 placeholder UI 作为最终 UI。

### 4

不要为了速度引入大量 UI library 默认样式。

### 5

抽象 Provider。

禁止把新闻源逻辑直接写进 page。

### 6

所有 API 输入：

```text
Zod validate
```

### 7

所有失败外部请求：

```text
timeout
retry
logging
```

### 8

所有数据库变更：

```text
migration
```

### 9

所有 AI 返回：

```text
structured output
```

### 10

不要在前端暴露 API key。

---

# 99. Code Quality

启用：

```text
eslint
prettier
typescript strict
```

禁止：

```ts
any
```

除非明确说明原因。

所有 service 应该有明确 type。

---

# 100. Testing

至少：

## Unit

```text
URL normalization
deduplication
score calculation
RSS parsing
cluster matching
```

## Integration

```text
provider → database
AI → article
```

## E2E

```text
homepage loads
search
story open
save
settings
```

---

# 101. Seed Data

创建：

```bash
pnpm db:seed
```

生成：

```text
50 articles
10 clusters
multiple categories
multiple timestamps
```

方便没有 API 的情况下开发 UI。

---

# 102. Agent 首个任务

Agent 收到此文档以后，不要立即写所有代码。

第一步：

1. 初始化 Next.js + TypeScript 项目。
2. 配置 Tailwind。
3. 创建上述目录结构。
4. 创建 Design Tokens。
5. 创建完整 Desktop Dashboard shell。
6. 实现 Sidebar。
7. 实现 Today 页面 mock UI。
8. 实现 Dark / Light theme。
9. 实现 Responsive。
10. 使用 mock stories 还原目标视觉。

视觉通过后再进入 backend。

---

# 103. 第一阶段 UI 验收

打开 `/` 后必须第一眼体现：

```text
高级
克制
清晰
专业
高信息密度
```

不能体现：

```text
模板感
AI generated website
普通 SaaS Dashboard
传统新闻网站
```

---

# 104. 最重要的 UI 原则

当不确定时：

```text
remove something
```

而不是：

```text
add something
```

优先使用：

```text
spacing
type
alignment
hierarchy
```

而不是：

```text
shadow
gradient
rounded card
color
```

---

# 105. Final UX Goal

用户每天访问 Pulse，30 秒以内应该能够回答：

```text
What happened?

What matters?

What changed?

What should I watch?

What matters specifically to me?
```

如果页面不能快速回答这五个问题，则产品设计失败。

---

# 106. 最终架构

```text
                         ┌──────────────────────┐
                         │      RSS Feeds       │
                         ├──────────────────────┤
                         │       GDELT          │
                         ├──────────────────────┤
                         │      GitHub          │
                         ├──────────────────────┤
                         │   Hacker News        │
                         ├──────────────────────┤
                         │      arXiv           │
                         └──────────┬───────────┘
                                    │
                                    ▼

                            ┌───────────────┐
                            │  Collectors   │
                            └───────┬───────┘
                                    │
                                    ▼
                            ┌───────────────┐
                            │  Normalizer   │
                            └───────┬───────┘
                                    │
                                    ▼
                            ┌───────────────┐
                            │ Deduplication │
                            └───────┬───────┘
                                    │
                                    ▼
                            ┌───────────────┐
                            │  Embeddings   │
                            └───────┬───────┘
                                    │
                                    ▼
                            ┌───────────────┐
                            │  Clustering   │
                            └───────┬───────┘
                                    │
                                    ▼
                   ┌─────────────────────────────────┐
                   │         AI Intelligence          │
                   │                                 │
                   │ Classification                  │
                   │ Entity Extraction               │
                   │ Summary                         │
                   │ Importance                      │
                   │ Personal Relevance              │
                   └───────────────┬─────────────────┘
                                   │
                                   ▼

                         ┌───────────────────┐
                         │ PostgreSQL        │
                         │ + pgvector        │
                         └─────────┬─────────┘
                                   │
                 ┌─────────────────┼─────────────────┐
                 │                 │                 │
                 ▼                 ▼                 ▼

          ┌────────────┐    ┌────────────┐    ┌────────────┐
          │ Next.js UI │    │ Daily Brief│    │   Alerts   │
          └────────────┘    └────────────┘    └────────────┘

                                                    │
                                      ┌─────────────┼────────────┐
                                      ▼             ▼            ▼

                                   Email         Telegram      Webhook
```

---

# 107. MVP Definition

第一版真正需要完成的不是上面所有 Feature。

MVP 必须包含：

```text
✓ Today
✓ Latest
✓ AI category
✓ Story page
✓ RSS ingestion
✓ GDELT discovery
✓ PostgreSQL
✓ Deduplication
✓ Basic clustering
✓ AI summaries
✓ Importance score
✓ Semantic search
✓ Daily Brief
✓ Telegram / Email Digest
✓ Dark mode
✓ Settings
```

完成以上功能后，系统就已经可以每天实际使用。

---

# 108. V2

随后增加：

```text
For You
GitHub intelligence
Hugging Face
arXiv
Trending velocity
What Changed
Entity pages
Topic graphs
Mobile PWA
Browser notifications
Advanced recommendation model
```

---

# 109. 最终产品哲学

Pulse 的价值不是：

> 收集最多的新闻。

而是：

> 从大量信息中压缩出最值得知道的事情。

因此整个系统应该不断围绕：

```text
Collect
Filter
Cluster
Understand
Prioritize
Present
```

这六个动作设计。

最终体验应该让它更像：

```text
Personal Intelligence System
```

而不是：

```text
News Reader
```

---

# 110. Agent Execution Instruction

Coding Agent：

Treat this document as the authoritative product and engineering specification.

Before implementation:

1. Read the entire specification.
2. Create `docs/IMPLEMENTATION_PLAN.md`.
3. Convert the project into executable milestones.
4. Do not reduce the design into a generic SaaS dashboard.
5. Implement the frontend visual system before building the full ingestion backend.
6. Maintain strict separation between provider, ingestion, intelligence, persistence and presentation layers.
7. Keep the system runnable after every milestone.
8. Prefer simple, maintainable abstractions over premature distributed architecture.
9. Optimize first for a single-user deployment while preserving the ability to scale later.
10. Do not consider the project complete until real news can flow automatically from external sources through ingestion, deduplication, clustering, AI processing and finally appear in the user interface.

The implementation order should be:

```text
DESIGN
   ↓
UI SHELL
   ↓
DATABASE
   ↓
RSS INGESTION
   ↓
REAL DATA
   ↓
AI PIPELINE
   ↓
CLUSTERING
   ↓
SEARCH
   ↓
DAILY BRIEF
   ↓
NOTIFICATIONS
   ↓
PERSONALIZATION
   ↓
ADVANCED INTELLIGENCE
```

Do not invert this order.

The first milestone should produce a visually complete working prototype using seeded data.

The second milestone should replace seed data with real data.

The third milestone should transform the application from a news reader into an intelligence system.