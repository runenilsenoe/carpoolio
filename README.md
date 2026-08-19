# Carpoolio

Carpoolio is a small, account-free tool for organising rides to an event. Create
a carpool, share its link, and let people offer or reserve seats.

## Stack

- React and TanStack Start
- TypeScript and Tailwind CSS
- Supabase services running locally in Docker

## Run locally

Carpoolio uses Bun for development and Docker Compose for its local Supabase
stack.

```sh
git clone <repository-url>
cd carpoolio
cp .env.example .env
node scripts/generate-secrets.mjs
# Paste the generated values into .env, then:
docker compose up --build
```

Open <http://localhost:8080>. See [SELF_HOSTING.md](SELF_HOSTING.md) for a
complete deployment and backup guide.

## Development commands

```sh
bun install
bun run dev
bun run check
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.
Security issues should follow [SECURITY.md](SECURITY.md).
