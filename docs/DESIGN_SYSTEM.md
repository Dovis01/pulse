# Design System

Keywords: **Minimal · Editorial · Technical · Premium · Quiet · Dense ·
Precise · Neutral · Timeless.** The reference is a modern tech magazine ×
developer documentation × research dashboard — never a SaaS admin template.

## Tokens (spec §5.1, exact)

| Token | Light | Dark |
|---|---|---|
| background | `#FAFAF9` | `#0D0D0C` |
| surface | `#FFFFFF` | `#121211` |
| text-primary | `#181817` | `#F2F2EF` |
| text-secondary | `#686866` | `#A3A39D` |
| text-muted | `#9B9B96` | `#6F6F69` |
| border | `#E8E8E4` | `#262624` |
| border-strong | `#D8D8D2` | `#353532` |
| hover | `#F3F3F0` | `#181817` |

Category hints (dots/badges only — the UI never turns colorful):
AI violet · Technology blue · Markets emerald · World orange · Science cyan ·
Security red.

## Typography

Geist Sans (UI) + Geist Mono (metadata). Weights 400–600, never 800.
Headline 30–42px / `letter-spacing: -0.03em` / `line-height: 1.1`; body
15–16px / 1.65; metadata 11–13px mono with `0.10–0.14em` tracking and
UPPERCASE labels.

## Layout

Desktop max-width 1440px: sidebar 220px (fixed) · main (fluid) · right
intelligence rail 280px (xl+ only). Information is organized with **spacing,
typography and 1px rules** — not cards, shadows, gradients, glassmorphism or
heavy rounding. Story rows are `border-top` + `20px` vertical padding with
the fixed anatomy:

```
CATEGORY · TIME                SCORE
HEADLINE
summary …
SOURCE + N MORE            ○ SAVE
```

## Motion

Only opacity and 2–4px translateY, 120–180ms. Hover = background swap, no
scale/bounce/shadow.

## States

- **Skeletons**: 4–6 shimmering gray lines per section — never spinners, never
  full-screen loading.
- **Read** items: opacity 0.55 — never hidden.
- **Empty**: one quiet sentence ("Nothing saved yet. Stories you save will
  appear here.").
- **Breaking**: a red dot + label in metadata; never a red banner.

## Mobile

Not a shrunken desktop: bottom nav (Today/Latest/For You/Search/Menu),
sidebar becomes a drawer, right rail hidden.

## Hard don'ts

No gradient washes, no neon/cyberpunk, no icon walls, no rounded-card grids,
no Bootstrap/Material look, no portal banners. When in doubt: **remove
something** (spec §104).
