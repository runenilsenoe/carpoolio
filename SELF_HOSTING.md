# Self-hosting Carpoolio

Carpoolio now runs as a small four-container stack: the React/TanStack web app,
an ASP.NET Core API, PostgreSQL, and nginx.

```sh
cp .env.example .env
# Set a strong POSTGRES_PASSWORD plus generated PHONE_ENCRYPTION_KEY and PHONE_HASH_KEY values.
docker-compose up -d --build
```

Open <http://localhost:8080>. The API is intentionally exposed only through
nginx at `/api`; the browser and API share the same origin, so identity cookies
remain HttpOnly and no CORS configuration is required.

## GitHub Actions on a self-hosted runner

Create the ignored production env file in the fixed deployment clone. It is not
removed by the workflow's `git reset --hard`:

```sh
cd /Users/Mediafrasor/carpoolio
cp .env.example .env
chmod 600 .env
```

Set strong values for `POSTGRES_PASSWORD`, `PHONE_ENCRYPTION_KEY`, and
`PHONE_HASH_KEY`. Generate each phone key with:

```sh
openssl rand -base64 32
```

The deploy workflow uses `/Users/Mediafrasor/carpoolio/.env` by default. To use
another location, set the repository Actions variable
`CARPOOLIO_DEPLOY_ENV_FILE` to its absolute path.
The runner account only needs Git, Docker, `docker-compose`, and `curl`; the
.NET build runs inside Docker.

The database schema is created from `backend/db/init.sql` on an empty database
volume. This deployment is intentionally configured as a fresh installation;
there is no legacy-data conversion step. Phone numbers are stored only as an
HMAC-SHA-256 lookup hash and AES-GCM ciphertext from the first inserted row.

If the server already has a discarded Carpoolio volume from an earlier test,
remove it once before the first production deployment:

```sh
docker-compose down -v
```

Do not use that command after production data has been created.

Back up the database with:

```sh
docker-compose exec -T db pg_dump -U carpoolio carpoolio > backup.sql
```
