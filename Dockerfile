# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Carpoolio frontend.
# This is a TanStack Start app: it renders on the server and runs its server
# functions in a Node process. Business data is served by the ASP.NET API.
# So we build with Nitro's node-server preset and let nginx proxy to it.
# ---------------------------------------------------------------------------

FROM oven/bun:1.2-alpine AS deps
WORKDIR /app
COPY package.json bunfig.toml* bun.lock* bun.lockb* ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.2-alpine AS build
WORKDIR /app
ENV NODE_ENV=production
# Nitro must emit a plain Node server instead of the Cloudflare Worker default.
ENV NITRO_PRESET=node-server
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.output ./.output
USER app
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
