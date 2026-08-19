# Self-hosting Carpoolio on your Mac

Everything — app, database, auth, storage, realtime — runs in Docker on your
machine. It does not depend on a hosted application platform at runtime.

## What runs

| Service    | Image                           | Role                                                                                       |
| ---------- | ------------------------------- | ------------------------------------------------------------------------------------------ |
| `db`       | supabase/postgres               | PostgreSQL, initialized from `supabase/migrations`                                         |
| `auth`     | supabase/gotrue                 | Supabase Auth                                                                              |
| `rest`     | postgrest                       | Data API                                                                                   |
| `realtime` | supabase/realtime               | Realtime                                                                                   |
| `storage`  | supabase/storage-api + imgproxy | Storage                                                                                    |
| `kong`     | kong                            | Single Supabase API gateway (`/auth/v1`, `/rest/v1`, `/storage/v1`, `/realtime/v1`) + CORS |
| `app`      | built from `Dockerfile`         | Carpoolio (TanStack Start SSR + server functions)                                          |
| `nginx`    | nginx                           | Public entrypoint for both hostnames                                                       |

**Edge Functions:** this project has none — all backend logic runs as TanStack
server functions inside the `app` container, so no `functions` service is
included. If you later add `supabase/functions/*`, add a `supabase/edge-runtime`
service and route `/functions/v1` to it in `docker/kong/kong.yml`.

**Why nginx doesn't just serve static files:** Carpoolio renders server-side and
its server functions use the service-role key (sessions, event/car writes). The
`app` container runs the built Node server; nginx reverse-proxies to it and
serves as the single ingress for Cloudflare Tunnel.

## 1. Secrets to generate

Never commit these. Generate all of them at once:

```sh
cp .env.example .env
node scripts/generate-secrets.mjs
```

Paste the output into `.env`. It produces:

- **`POSTGRES_PASSWORD`** — Postgres superuser + all Supabase service roles.
  Manual alternative: `openssl rand -hex 24`.
- **`JWT_SECRET`** — HS256 signing secret shared by Auth, PostgREST, Storage and
  Realtime. Manual: `openssl rand -hex 32`.
- **`ANON_KEY`** — JWT with `{"role":"anon"}` signed by `JWT_SECRET`. Public,
  baked into the browser bundle.
- **`SERVICE_ROLE_KEY`** — JWT with `{"role":"service_role"}` signed by
  `JWT_SECRET`. **Server-side only, bypasses RLS.**
- **`REALTIME_ENC_KEY`** (exactly 16 chars) and **`REALTIME_SECRET_KEY_BASE`**.

`ANON_KEY` / `SERVICE_ROLE_KEY` must be signed with the _same_ `JWT_SECRET` in
the same `.env`, or every API call returns 401. Changing `JWT_SECRET` later means
regenerating both keys and rebuilding the frontend.

## 2. Start

```sh
docker compose up -d
```

First boot creates the roles/schemas and applies every file in
`supabase/migrations` in order. App: <http://localhost:8080>.

Reset everything (destroys all data, re-runs migrations):

```sh
docker compose down -v && docker compose up -d --build
```

New migration file added later? Apply it to the running DB:

```sh
docker compose exec -T db psql -U postgres -d postgres < supabase/migrations/<file>.sql
```

## 3. Cloudflare Tunnel

Both hostnames point at the single nginx port; nginx routes by `Host`.

```yaml
# ~/.cloudflared/config.yml
tunnel: <tunnel-id>
credentials-file: /Users/<you>/.cloudflared/<tunnel-id>.json
ingress:
  - hostname: carpoolio.example.com
    service: http://localhost:8080
  - hostname: api.carpoolio.example.com
    service: http://localhost:8080
  - service: http_status:404
```

Then in `.env`:

```
FRONTEND_HOST=carpoolio.example.com
API_HOST=api.carpoolio.example.com
SUPABASE_PUBLIC_URL=https://api.carpoolio.example.com
SITE_URL=https://carpoolio.example.com
CORS_ALLOWED_ORIGINS=https://carpoolio.example.com
ADDITIONAL_REDIRECT_URLS=https://carpoolio.example.com/**
```

Rebuild after changing `SUPABASE_PUBLIC_URL` — Vite inlines it at build time:

```sh
docker compose up -d --build app
```

## 4. How the URLs are wired

- Browser → `VITE_SUPABASE_URL` = `SUPABASE_PUBLIC_URL` (build arg, public).
- SSR/server functions → `SUPABASE_URL=http://kong:8000` (in-network, never
  leaves the host).
- Auth `API_EXTERNAL_URL` = `SUPABASE_PUBLIC_URL`; `SITE_URL` and
  `ADDITIONAL_REDIRECT_URLS` control allowed post-login redirects.
- CORS: Kong allows exactly `CORS_ALLOWED_ORIGINS`, with credentials, on all
  four API prefixes.

## 5. Backups

```sh
docker compose exec -T db pg_dump -U postgres postgres > backup.sql
```

Storage objects live in the `storage-data` volume; database in `db-data`.
