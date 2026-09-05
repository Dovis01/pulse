# PULSE — Cost & Information Source Strategy
## Serverless 免费优先的数据源、AI、存储与部署选型规范

Version: v2.0  
Project: Pulse — Global Intelligence Feed  
Purpose: Companion specification for the main Pulse product and engineering document

---

# 1. 文档目标

本文档定义 Pulse 在“无自建服务器、无 GPU、仅 Vercel 托管”的情况下，应该如何选择：

- 新闻数据源
- AI 服务
- 数据库
- 定时任务
- 推送服务
- 邮件服务
- 搜索能力
- Embedding
- 缓存
- 存储
- 第三方 SaaS
- 免费额度
- 付费升级路径

核心目标：

> Pulse 第一版必须能够在没有 GPU、没有长期运行服务器的情况下，以 Serverless 架构运行，并尽可能保持 $0/月。

系统必须：

```text
Free-first
Serverless-first
Low-maintenance
Provider-agnostic
Gracefully degradable
```

---

# 2. 当前基础设施约束

当前部署条件：

```text
NO GPU

NO SGLang

NO vLLM

NO persistent backend server

NO self-host PostgreSQL

NO Docker server

Frontend hosted on Vercel
```

因此以下方案不得作为默认架构：

```text
Self-host PostgreSQL

Self-host Redis

Self-host SGLang

Self-host Ollama

Self-host embedding server

Docker Compose production stack

Persistent worker daemon
```

它们可以作为未来 Advanced Deployment Option。

但：

```text
NOT MVP DEFAULT
```

---

# 3. 默认生产架构

Pulse v1 默认使用：

```text
                     PUBLIC DATA

RSS / Atom
GDELT
GitHub
Hacker News
Hugging Face
arXiv
Official Blogs
        │
        ▼

               SCHEDULED INGESTION

                 Vercel Cron
                      │
                      ▼

                 Next.js API
                      │
                      ▼

                 Supabase
                 PostgreSQL
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼

       Articles    Clusters     Briefs
          │
          ▼

                 AI Provider

              Gemini Free Tier
                      │
                      ▼

                   Vercel
                   Next.js
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼

       Website     Telegram      Email

                                 Resend
```

未来当定时采集负载增加：

```text
Vercel Cron
```

可以替换或补充：

```text
Cloudflare Worker Cron
```

但第一版不要提前增加复杂度。

---

# 4. 总成本原则

所有工程决策遵循：

```text
1. Public free data
2. Free SaaS tier
3. Serverless free tier
4. Existing platform capability
5. Cheap pay-as-you-go
6. Paid service
```

任何收费产品都必须回答：

```text
Does Pulse absolutely need this?
```

如果答案是：

```text
No
```

则不得作为默认依赖。

---

# 5. 月成本目标

MVP 的目标：

```text
Additional Monthly Cost ≈ $0
```

目标成本结构：

```text
News Sources        $0
Frontend            $0
Database            $0
AI                  $0
Cron                $0
Telegram            $0
Email               $0
Search              $0
Vector Search       $0 / optional
Analytics           $0
```

注意：

“免费”表示：

```text
within free-tier quotas
```

而不是：

```text
unlimited free usage
```

系统必须始终具备 quota awareness。

---

# 6. 新闻源总原则

Pulse 不使用一个万能新闻 API。

采用：

```text
Multi-Source Intelligence Architecture
```

由不同免费来源分别负责：

```text
Global Discovery

Official Announcements

Technology News

AI News

Open Source

Research

Developer Community

Trending Signals
```

---

# 7. 免费数据源默认组合

MVP 默认：

```text
RSS / Atom

GDELT

GitHub

Hacker News

arXiv

Hugging Face

Official Blogs
```

可选：

```text
Other public RSS

Open APIs

Public JSON feeds
```

默认禁止：

```text
Paid News API
Commercial News Feed
Premium Scraping API
```

---

# 8. Tier 1 — RSS / Atom

推荐级别：

```text
★★★★★
```

成本：

```text
$0
```

RSS 是 Pulse 新闻内容获取的第一核心来源。

---

# 9. RSS 的角色

RSS 用来获取：

```text
headline

description

publication time

source

article URL

author

image metadata
```

部分 Feed 还会提供正文。

优先使用：

```text
publisher-provided RSS
```

而不是抓 HTML。

---

# 10. RSS 类型

推荐维护以下类型：

```text
World

Technology

AI

Business

Markets

Cybersecurity

Science

Official Company

Open Source

Research
```

---

# 11. Source Registry

所有 RSS 必须统一管理。

例如：

```ts
interface NewsSource {
  id: string
  name: string
  type: "rss" | "api" | "official"
  url: string

  category: string

  language?: string
  country?: string

  authorityScore: number

  enabled: boolean

  refreshIntervalMinutes: number
}
```

禁止在 Page Component 中直接硬编码 feed。

---

# 12. RSS 刷新频率

默认：

```text
Fast News

5–10 min


Normal News

10–20 min


Company Blogs

30 min


Research

60–180 min
```

避免：

```text
1 minute polling
```

因为对个人站没有必要。

---

# 13. RSS 缓存策略

实现：

```text
ETag

Last-Modified

If-None-Match

If-Modified-Since
```

如果 Source 支持：

```text
304 Not Modified
```

则无需重新处理。

---

# 14. Tier 2 — GDELT

推荐：

```text
★★★★★
```

成本：

```text
$0
```

角色：

```text
Global News Discovery
```

---

# 15. GDELT 的职责

GDELT 不作为 Pulse 唯一正文来源。

它负责：

```text
What is happening globally?

Which events are gaining coverage?

Which countries are reporting something?

Which entities are appearing rapidly?

Which stories are being reported by many sources?
```

因此：

```text
GDELT = Global Radar
```

---

# 16. RSS + GDELT

推荐逻辑：

```text
GDELT
   │
   ▼
discover important event
   │
   ▼
RSS / Official sources
   │
   ▼
confirm / enrich
   │
   ▼
Story Cluster
```

---

# 17. Tier 3 — GitHub

推荐：

```text
★★★★★
```

对于：

```text
AI
LLM
Open Source
AI Infrastructure
Developer Tools
```

非常重要。

使用：

```text
GitHub REST API
```

并配置：

```env
GITHUB_TOKEN=
```

---

# 18. GitHub Watchlist

默认配置允许用户指定：

```yaml
github:
  repositories:
    - sgl-project/sglang
    - huggingface/transformers
    - vllm-project/vllm
    - pytorch/pytorch
    - flashinfer-ai/flashinfer
```

---

# 19. GitHub 关注内容

推荐获取：

```text
Releases

Major merged PRs

High engagement issues

High engagement PRs

Tags

Star growth

Repository activity
```

不要抓：

```text
every commit

every comment

every issue
```

---

# 20. GitHub Intelligence

GitHub 数据不是普通新闻。

最终展示为：

```text
Developer Intelligence
```

例如：

```text
SGLang

Major release published

3 important merged PRs

2 high-impact issues

GitHub activity increased 43%
```

---

# 21. Tier 4 — Hacker News

推荐：

```text
★★★★★
```

成本：

```text
$0
```

重点：

```text
AI

Programming

Infrastructure

Startups

Developer Tools

Security
```

---

# 22. HN 抓取范围

第一版：

```text
Top Stories

Best Stories

Show HN
```

无需获取所有评论。

可以记录：

```text
points

comments

rank

age
```

用于：

```text
community_velocity
```

---

# 23. Tier 5 — arXiv

推荐：

```text
★★★★★
```

成本：

```text
$0
```

重点分类：

```text
cs.AI

cs.CL

cs.LG

cs.DC

cs.CR
```

---

# 24. arXiv 刷新频率

不需要实时。

推荐：

```text
1–3 hours
```

Research 不属于 Breaking News。

---

# 25. arXiv 排序

不要展示全部论文。

Ranking：

```text
topic relevance

author relevance

keyword match

GitHub discussion

HN discussion

cross-source references
```

---

# 26. Tier 6 — Hugging Face

推荐：

```text
★★★★☆
```

用于：

```text
Trending Models

New Models

Spaces

Model Releases

Important Model Updates
```

使用免费公共 Hub 能力。

---

# 27. Hugging Face 策略

环境变量：

```env
HF_TOKEN=
```

有 Token：

```text
authenticated
```

无 Token：

```text
anonymous mode
```

Rate limit 时：

```text
retry later
```

不能：

```text
upgrade automatically
```

---

# 28. Tier 7 — Official Sources

推荐：

```text
★★★★★
```

这是非常高价值的来源。

包括：

```text
OpenAI Blog

Anthropic News

Google DeepMind Blog

Meta AI

Microsoft Research

NVIDIA Blog

AMD Blog

Apple Newsroom

Cloudflare Blog

GitHub Blog

Hugging Face Blog

official project release feeds
```

---

# 29. 官方来源 Authority

默认：

```text
Official first-party source
95

Official GitHub Release
95

Major wire/news agency
90

Major publication
80–90

Tech media
70–80

Community
50–70

Unknown source
20–50
```

用于：

```text
importance_score
```

---

# 30. 商业 News API

所有商业 News API：

```text
Optional
```

默认：

```text
Disabled
```

例如：

```env
ENABLE_PAID_NEWS=false
```

---

# 31. NewsAPI 等服务

Agent 可以实现 Provider Adapter：

```text
NewsAPIProvider
```

但是：

```text
must not be required
```

没有：

```env
NEWS_API_KEY
```

Pulse 必须完整运行。

---

# 32. 新闻数据成本原则

最终：

```text
RSS              $0

GDELT            $0

GitHub           $0

HN               $0

arXiv            $0

HF               $0 within limits

Official Blogs   $0
```

因此：

```text
News Acquisition ≈ $0
```

---

# 33. Frontend Hosting

默认：

```text
Vercel
```

项目：

```text
Next.js
```

第一版优先使用 Vercel Hobby / Free plan。

---

# 34. Vercel 的职责

Vercel 负责：

```text
Frontend

Server Components

API Routes

Server Actions

Cron entrypoints

Authentication callback

Light processing
```

不要让 Vercel 承担：

```text
long-running worker

permanent daemon

massive crawler

continuous process
```

---

# 35. 数据库

由于没有自建服务器：

默认：

```text
Supabase
```

使用：

```text
Supabase PostgreSQL
```

---

# 36. 为什么使用 Supabase

原因：

```text
Free tier

PostgreSQL

Serverless-friendly

Good Next.js integration

Auth optional

pgvector support

Database UI

No server maintenance
```

---

# 37. 数据库抽象

业务代码仍然优先：

```text
Postgres-compatible
```

不要将所有数据库逻辑深度绑定 Supabase SDK。

推荐：

```text
DATABASE_URL
```

作为核心连接方式。

这样未来可以切换：

```text
Supabase

Neon

Railway

Self-hosted Postgres
```

---

# 38. 数据库存储原则

免费数据库空间有限。

因此：

```text
DO NOT archive entire internet
```

只保存有价值数据。

---

# 39. Article 存储

推荐长期保存：

```text
id

title

url

canonical_url

source

published_at

category

language

short_description

AI summary

cluster_id

importance_score

relevance_score

metadata
```

---

# 40. 不建议永久保存

默认不要长期保存：

```text
full raw HTML

large article body

remote images

duplicate articles

crawler snapshots
```

---

# 41. Article Body Retention

如果为了 AI summary 临时抓取正文：

```text
fetch
↓
process
↓
summary
↓
discard / truncate
```

默认不永久保存。

---

# 42. 数据保留策略

建议：

```text
Raw fetched content

1–7 days


Article metadata

6–12 months


Important story clusters

long-term


Daily briefs

long-term


Saved stories

long-term
```

---

# 43. Dedup

免费架构必须先依赖传统算法。

第一版：

```text
canonical URL

normalized title

source match

time window

token overlap

entity overlap
```

---

# 44. 第一版不强制 Embedding

MVP：

```text
NO mandatory vector embedding
```

因为每篇文章做云端 embedding 会增加：

```text
API usage

latency

complexity
```

---

# 45. MVP 聚类方式

优先：

```text
normalized title
+
token similarity
+
entity similarity
+
publication time
```

例如：

```text
NVIDIA launches Rubin Ultra

Nvidia announces new Rubin Ultra AI system

NVIDIA unveils Rubin Ultra platform
```

通过：

```text
NVIDIA
Rubin
Ultra
```

即可检测高相似。

---

# 46. Embedding V2

后期再增加：

```text
embedding
+
pgvector
```

用于：

```text
semantic clustering

semantic search

related stories

personal relevance
```

但不是第一阶段 blocker。

---

# 47. AI Strategy

由于没有 GPU：

Pulse 默认使用：

```text
Hosted AI API
```

但是必须：

```text
Free-tier first
```

---

# 48. Default AI Provider

推荐默认：

```text
Gemini API
```

原因：

```text
has free-tier options

structured output support

good multilingual capability

good summarization

serverless friendly
```

---

# 49. AI Provider Abstraction

绝对不能把业务写死 Gemini。

实现：

```ts
interface AIProvider {
  classify()
  summarize()
  synthesize()
  translate()
}
```

Provider：

```text
GeminiProvider

OpenAIProvider

AnthropicProvider

OpenAICompatibleProvider
```

默认：

```text
GeminiProvider
```

---

# 50. AI Config

例如：

```env
AI_PROVIDER=gemini

AI_MODEL=

GEMINI_API_KEY=
```

具体 model 名称必须 configurable。

禁止把模型名称深度写死。

---

# 51. AI 免费额度原则

任何 AI 免费额度都有变化可能。

因此系统：

```text
must not assume infinite requests
```

应该提供：

```text
daily AI request budget

AI request counter

fallback mode
```

---

# 52. AI Budget

配置：

```ts
ai: {
  enabled: true,

  maxCallsPerHour: 50,

  maxCallsPerDay: 500
}
```

实际默认值应根据 provider 当前 quota 调整。

---

# 53. AI Pipeline

禁止：

```text
Every article
↓
Strong LLM
```

正确：

```text
Raw articles
      │
      ▼
URL dedup
      │
      ▼
Title dedup
      │
      ▼
Rule classification
      │
      ▼
Story clustering
      │
      ▼
Importance scoring
      │
      ▼
Only important clusters
      │
      ▼
AI summary
```

---

# 54. AI 使用优先级

LLM 优先用于：

```text
Story synthesis

Daily Brief

Why it matters

Cross-source summary

Translation of important stories
```

---

# 55. 不应该使用 AI 的任务

以下优先代码处理：

```text
URL normalization

time parsing

RSS parsing

language hint

keyword classification

duplicate detection

source authority

sorting

basic scoring
```

---

# 56. AI Classify

第一版 category 可以采用：

```text
source category
+
keyword rules
```

然后只对难分类内容使用 AI。

---

# 57. 关键词分类

例如：

```text
OpenAI
Anthropic
LLM
GPU
CUDA
inference
transformers
model
```

映射：

```text
AI
```

这样减少大量 API 调用。

---

# 58. Story Summary

AI summary 的单位：

```text
Story Cluster
```

不是：

```text
Article
```

例如：

```text
12 articles
↓
1 cluster
↓
1 summary
```

---

# 59. AI Cache

必须保存：

```text
cluster_hash

prompt_version

model

summary

generated_at
```

如果 cluster 未发生实质变化：

```text
DO NOT regenerate
```

---

# 60. AI Re-generation

只有：

```text
major source added

important factual change

summary stale

prompt updated

manual refresh
```

才重新调用。

---

# 61. AI Failure

如果 AI quota exhausted：

Pulse 仍然必须可以工作。

降级为：

```text
title

description

source

metadata

rule category
```

而不是：

```text
app broken
```

---

# 62. AI Graceful Degradation

```text
AI available

→ Full intelligence mode


AI unavailable

→ Aggregator mode
```

---

# 63. Translation

中文翻译：

```text
important stories only
```

不要：

```text
translate every article automatically
```

建议：

```text
Top Stories

Daily Brief

Breaking News
```

优先翻译。

---

# 64. Search

第一版：

```text
Postgres Full Text Search
```

成本：

```text
$0
```

---

# 65. Search V1

支持：

```text
title

summary

source

category

tags
```

---

# 66. Search V2

以后再增加：

```text
pgvector
```

支持：

```text
semantic search
```

仍不需要外部搜索 SaaS。

---

# 67. 禁止搜索 SaaS

MVP 不使用：

```text
Algolia

Elastic Cloud

Meilisearch Cloud

Typesense Cloud
```

因为没有必要。

---

# 68. Scheduler

第一版：

```text
Vercel Cron
```

定时调用：

```text
/api/cron/ingest
```

---

# 69. Cron 分组

不要创建很多 Cron。

推荐：

```text
/api/cron/fast

/api/cron/normal

/api/cron/daily
```

---

# 70. Fast Cron

职责：

```text
breaking RSS

GDELT

HN

GitHub watchlist
```

---

# 71. Normal Cron

职责：

```text
normal RSS

company blogs

HF

arXiv
```

---

# 72. Daily Cron

职责：

```text
Daily Brief

cleanup

retention

metrics

digest
```

---

# 73. Cron Security

所有 cron route：

```env
CRON_SECRET=
```

验证：

```text
Authorization
```

禁止公共调用。

---

# 74. Cron Timeout

Vercel Function 不适合巨大 batch。

因此每次：

```text
small incremental batch
```

不要：

```text
process 10,000 stories in one request
```

---

# 75. Incremental Processing

每次 Cron：

```text
fetch limited sources

process limited articles

save checkpoint
```

下一次继续。

---

# 76. 如果 Vercel Cron 不够

第二阶段：

```text
Cloudflare Worker Cron
```

职责：

```text
fetch public feeds

normalize

push to Supabase
```

Vercel 继续只负责 UI/API。

---

# 77. Cloudflare Worker

属于：

```text
optional scaling layer
```

MVP 不必须。

---

# 78. Queue

第一版不要：

```text
Redis

Kafka

RabbitMQ

BullMQ Cloud
```

---

# 79. Serverless Queue

使用数据库表：

```text
jobs
```

字段：

```text
id

type

payload

status

attempts

created_at

scheduled_at

completed_at
```

---

# 80. Job Batch

Cron：

```text
select pending jobs
limit 20
```

逐批处理。

---

# 81. Email

推荐：

```text
Resend
```

使用：

```text
Free Tier
```

用途：

```text
Morning Brief

Evening Brief

Optional alert
```

---

# 82. Email 不是 Breaking 首选

Breaking News 首选：

```text
Telegram
```

Email 用：

```text
Digest
```

---

# 83. Telegram

推荐：

```text
★★★★★
```

用于：

```text
Breaking News

Daily Brief

Important AI/Open Source alerts
```

配置：

```env
TELEGRAM_BOT_TOKEN=

TELEGRAM_CHAT_ID=
```

---

# 84. Notification Priority

```text
1. Telegram

2. Web UI

3. Email

4. Webhook
```

---

# 85. Push 限流

例如：

```text
Breaking threshold >= 90

max 10 alerts/day
```

避免变成通知轰炸。

---

# 86. Images

不使用：

```text
paid image API
```

---

# 87. 新闻图片

优先：

```text
OpenGraph image

RSS image metadata

official source image
```

直接 remote reference。

---

# 88. 不缓存图片

第一版：

```text
DO NOT download image into Supabase Storage
```

除非必要。

---

# 89. UI 图片比例

Pulse 以 typography 为主。

因此：

```text
most stories:

no image
```

只有：

```text
top story

feature story

major breaking event
```

使用图片。

---

# 90. Storage

Supabase Storage：

```text
not required for MVP
```

数据库即可。

---

# 91. Authentication

个人站：

默认：

```text
GitHub OAuth
```

或者：

```text
simple secret login
```

---

# 92. Login Allowlist

环境变量：

```env
ALLOWED_EMAIL=
```

只有指定用户可以进入。

---

# 93. 不使用付费 Auth

不要使用：

```text
Auth0 paid

Clerk paid features
```

MVP 无必要。

---

# 94. Analytics

第一版：

```text
No analytics provider
```

如果需要：

```text
Vercel built-in
```

或以后使用免费 analytics。

---

# 95. 用户行为数据

个人推荐只需要记录：

```text
read

saved

clicked

topic followed
```

存在 Supabase。

---

# 96. Monitoring

不引入：

```text
Datadog

New Relic

paid observability
```

---

# 97. System Status

Pulse 自己实现：

```text
Settings
→ System
```

显示：

```text
Last cron

Last successful fetch

Sources healthy

AI available

Database available

Last Daily Brief
```

---

# 98. Logs

简单保存：

```text
ingestion_runs
```

字段：

```text
source

started_at

finished_at

fetched

created

duplicates

failed

error
```

---

# 99. Rate Limits

每个 Provider 必须具有：

```text
rate limit awareness

retry

backoff

cache
```

---

# 100. Provider Interface

```ts
interface DataProvider {
  id: string

  costType:
    | "free"
    | "free-tier"
    | "paid"

  enabledByDefault: boolean

  fetch(): Promise<RawItem[]>
}
```

---

# 101. Paid Provider

任何 Paid Provider：

```text
enabledByDefault = false
```

---

# 102. Paid Toggle

配置：

```env
ALLOW_PAID_PROVIDERS=false
```

---

# 103. Paid AI Toggle

```env
ALLOW_PAID_AI=false
```

如果免费 AI quota 用尽：

```text
degrade
```

不要自动扣费。

---

# 104. 成本保护

配置：

```ts
cost: {
  paidProvidersAllowed: false,

  estimatedMonthlyBudgetUsd: 0
}
```

---

# 105. System Cost UI

Settings：

```text
COST & USAGE

News APIs
Free

AI
Free tier

Database
Free tier

Email
Free tier

Estimated paid usage
$0.00
```

---

# 106. Usage UI

显示：

```text
Articles fetched today

AI calls today

AI calls this month

GitHub requests

HF requests

Emails sent

Telegram alerts

Database articles

Database storage estimate
```

---

# 107. Free Tier Exhaustion

任何免费额度不足：

系统处理顺序：

```text
1. Reduce frequency

2. Reduce data volume

3. Cache more

4. Skip low priority items

5. Disable optional feature

6. Inform user

7. Consider paid upgrade
```

---

# 108. 永远不要自动升级

禁止：

```text
automatic billing

automatic plan upgrade

automatic paid provider activation
```

---

# 109. 免费额度不足示例

例如 Gemini quota 用完：

```text
Stop non-critical summaries
```

但继续：

```text
RSS ingestion

display original descriptions

show breaking metadata
```

---

# 110. Supabase 空间不足

优先：

```text
delete old raw content

delete duplicate metadata

shorten excerpts

cleanup logs

archive only important stories
```

不要第一反应：

```text
pay
```

---

# 111. Vercel 额度不足

优先：

```text
reduce cron

move crawler to Cloudflare Worker

reduce server-side rendering work

cache responses
```

---

# 112. AI 免费架构

推荐：

```text
Rule Engine
       │
       ▼

Basic Dedup
       │
       ▼

Importance Filter
       │
       ▼

Gemini Free
       │
       ▼

High Value Story Summary
```

核心：

```text
AI only after filtering
```

---

# 113. 推荐处理例子

每天：

```text
1500 raw articles
```

通过：

```text
URL duplicate
title duplicate
time filter
source filter
```

减少：

```text
~700
```

通过 Story clustering：

```text
~200 events
```

通过 importance：

```text
Top 30–60
```

AI 真正处理：

```text
30–60 events/day
```

而不是：

```text
1500 calls/day
```

---

# 114. Daily Brief

每天生成：

```text
Morning

Evening
```

默认：

```text
2 AI calls
```

或少量分区 calls。

---

# 115. Personal Recommendation

V1 不使用复杂 ML。

使用：

```text
topic weights

keywords

saved articles

read history
```

例如：

```text
AI                1.0

Open Source       1.0

LLM               1.0

Semiconductor     0.8

Markets           0.5

Sports            0.1
```

---

# 116. Relevance Score

可以完全代码实现：

```text
keyword match

topic match

entity match

source match
```

不需要 AI API。

---

# 117. Phase 1 Cost Architecture

第一阶段：

```text
Vercel

Supabase

RSS

GDELT

GitHub

HN

arXiv

Rule Engine
```

甚至：

```text
AI optional
```

先把新闻系统跑起来。

---

# 118. Phase 2

增加：

```text
Gemini

AI Summary

Daily Brief

Translation
```

---

# 119. Phase 3

增加：

```text
pgvector

Semantic Search

Semantic Clustering

Personal Relevance
```

前提是确实需要。

---

# 120. 推荐环境变量

```env
# App

NEXT_PUBLIC_APP_URL=

APP_TIMEZONE=Asia/Tokyo


# Supabase

DATABASE_URL=

NEXT_PUBLIC_SUPABASE_URL=

NEXT_PUBLIC_SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=


# AI

AI_ENABLED=true

AI_PROVIDER=gemini

AI_MODEL=

GEMINI_API_KEY=


# GitHub

GITHUB_TOKEN=


# Hugging Face

HF_TOKEN=


# Cron

CRON_SECRET=


# Telegram

TELEGRAM_BOT_TOKEN=

TELEGRAM_CHAT_ID=


# Email

RESEND_API_KEY=

EMAIL_FROM=

EMAIL_TO=


# Cost

ALLOW_PAID_PROVIDERS=false

ALLOW_PAID_AI=false
```

---

# 121. 推荐默认 Providers

启用：

```text
RSS

GDELT

GitHub

Hacker News

arXiv

Official Blogs
```

可选：

```text
Hugging Face
```

禁用：

```text
Paid News APIs
```

---

# 122. 最推荐的最终组合

当前基础设施下：

```text
Frontend

Vercel


Database

Supabase Free


News

RSS
GDELT
GitHub
HN
arXiv
HF
Official Sources


AI

Gemini Free Tier


Search

PostgreSQL FTS


Semantic Search

pgvector later


Cron

Vercel Cron


Scale-out Cron

Cloudflare Worker later


Alert

Telegram


Email

Resend Free
```

---

# 123. 当前目标月成本

在个人正常使用量情况下：

```text
Vercel              $0

Supabase            $0

RSS                 $0

GDELT               $0

GitHub              $0

HN                  $0

arXiv               $0

HF                  $0

Gemini              $0 within free quota

Telegram            $0

Resend              $0 within free quota
```

目标：

```text
TOTAL ≈ $0/month
```

---

# 124. 最可能先遇到的限制

按风险排序：

```text
1. AI free quota

2. Database storage

3. Serverless cron/function execution

4. API provider rate limits

5. Email limit
```

新闻数据本身反而通常不是第一成本来源。

---

# 125. 成本优化顺序

出现问题后：

```text
FILTER MORE
     ↓

CACHE MORE
     ↓

STORE LESS
     ↓

CALL AI LESS
     ↓

RUN CRON LESS
     ↓

MOVE OPTIONAL JOB
     ↓

ONLY THEN CONSIDER PAYING
```

---

# 126. Agent 强制实现规则

Coding Agent MUST follow:

1. The default production deployment is Vercel.

2. Do not assume any GPU exists.

3. Do not assume SGLang, vLLM or Ollama exists.

4. Do not require a permanent backend server.

5. Use a serverless-first architecture.

6. Supabase is the default database provider.

7. Pulse must function without a paid news API.

8. RSS, GDELT, GitHub, HN, arXiv and official sources form the primary free data stack.

9. Hugging Face is optional and free-tier aware.

10. Gemini should be the default hosted AI provider.

11. The AI provider must remain abstract and replaceable.

12. The application must still function if the AI provider is unavailable.

13. Do not use AI for deterministic parsing or filtering tasks.

14. Do not summarize every article.

15. Summarize story clusters.

16. Use non-AI deduplication first.

17. Embeddings are not mandatory for MVP.

18. PostgreSQL Full Text Search should be used before paid search SaaS.

19. pgvector should be added only when semantic functionality is needed.

20. Vercel Cron should be the initial scheduler.

21. Cron jobs must be incremental and small.

22. Cloudflare Worker may be introduced later for ingestion scaling.

23. Do not introduce Redis, Kafka or a paid queue in MVP.

24. Use PostgreSQL jobs if async jobs are needed.

25. Telegram is the primary realtime notification channel.

26. Email is primarily for digests.

27. Resend Free may be used for email.

28. Do not store full articles indefinitely.

29. Do not mirror remote news images.

30. Respect source terms and copyright.

31. Every paid provider must be disabled by default.

32. The absence of a paid API key must never break the application.

33. Free-tier exhaustion must trigger graceful degradation.

34. Never automatically enable billing.

35. Never automatically upgrade a plan.

36. Maintain cost and usage counters.

37. Optimize data retention before purchasing database capacity.

38. Optimize AI calls before purchasing AI capacity.

39. Optimize scheduling before purchasing compute.

40. The MVP must target approximately zero additional monthly cost.

---

# 127. Authoritative Architecture

```text
                     PUBLIC INTERNET

      RSS ─────────────┐
                       │
      GDELT ───────────┤
                       │
      GitHub ──────────┤
                       │
      HN ──────────────┤
                       ├──────► VERCEL CRON
      arXiv ───────────┤              │
                       │              ▼
      HF ──────────────┤       INGEST API ROUTE
                       │              │
      Official ────────┘              ▼
                                  NORMALIZE
                                      │
                                      ▼
                                     DEDUP
                                      │
                                      ▼
                                   CLUSTER
                                      │
                                      ▼
                              IMPORTANCE FILTER
                                      │
                              ┌───────┴────────┐
                              │                │
                              ▼                ▼
                           GEMINI          NO-AI PATH
                        FREE TIER
                              │                │
                              └───────┬────────┘
                                      ▼

                                  SUPABASE
                                  POSTGRES
                                      │
                  ┌───────────────────┼───────────────────┐
                  │                   │                   │
                  ▼                   ▼                   ▼

               STORIES             BRIEFS              USERS
                  │
                  ▼

                                VERCEL NEXT.JS
                                      │
                   ┌──────────────────┼──────────────────┐
                   │                  │                  │
                   ▼                  ▼                  ▼

                 WEB              TELEGRAM            RESEND
                                                     EMAIL
```

---

# 128. 核心产品理念

Pulse 不应该成为：

> 一个依靠大量昂贵 SaaS 才能运行的新闻 Dashboard。

而应该成为：

> 一个利用开放信息源、Serverless 免费额度和少量 AI 调用，将全球信息压缩成个人高价值情报的系统。

默认策略：

```text
FREE DATA

SERVERLESS INFRASTRUCTURE

MINIMAL STORAGE

AI AFTER FILTERING

GRACEFUL DEGRADATION

OPTIONAL PAID SERVICES
```

最终工程原则：

```text
Collect cheaply.

Filter aggressively.

Store selectively.

Call AI intelligently.

Pay only when value is proven.
```

这套原则是 Pulse 成本架构的最终权威规范。