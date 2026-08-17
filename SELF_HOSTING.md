# Self-hosting Carpoolio

Carpoolio now runs as a small four-container stack: the React/TanStack web app,
an ASP.NET Core API, PostgreSQL, and nginx.

```sh
cp .env.example .env
# Set a strong POSTGRES_PASSWORD in .env.
docker-compose up -d --build
```

Open <http://localhost:8080>. The API is intentionally exposed only through
nginx at `/api`; the browser and API share the same origin, so identity cookies
remain HttpOnly and no CORS configuration is required.

The database schema is created from `backend/db/init.sql` on an empty database
volume. To start fresh during development:

```sh
docker-compose down -v
docker-compose up -d --build
```

Back up the database with:

```sh
docker-compose exec -T db pg_dump -U carpoolio carpoolio > backup.sql
```
