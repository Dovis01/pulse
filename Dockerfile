# syntax=docker/dockerfile:1

# ── Pulse — Deployment Mode B (self-host) ────────────────────────────
# Mode A (default) is Vercel + Supabase; this image serves the standalone
# Next.js build behind a long-running Node process (spec §86/§88).

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# DATABASE_URL is optional at build time; demo mode keeps the build hermetic.
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S pulse && adduser -S pulse -G pulse
COPY --from=builder --chown=pulse:pulse /app/.next/standalone ./
COPY --from=builder --chown=pulse:pulse /app/.next/static ./.next/static
COPY --from=builder --chown=pulse:pulse /app/public ./public
USER pulse
EXPOSE 3000
CMD ["node", "server.js"]
