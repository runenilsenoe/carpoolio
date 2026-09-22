# Carpoolio

Carpoolio is a small, account-free tool for organising rides to an event. Create
a carpool, share its link, and let people offer or reserve seats.

## Stack

- React and TanStack Start (SSR), TypeScript and Tailwind CSS
- ASP.NET Core API in `backend/`
- PostgreSQL, with nginx as the single public entrypoint

## Run locally

```sh
git clone <repository-url>
cd carpoolio
cp .env.example .env
# Set POSTGRES_PASSWORD, dashboard credentials, and generate the phone keys
# with: openssl rand -base64 32
docker-compose up --build
```

Open <http://localhost:8080>. See [SELF_HOSTING.md](SELF_HOSTING.md) for a
complete deployment and backup guide.

## Development commands

```sh
bun install
bun run check
bun test
dotnet test
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.
Security issues should follow [SECURITY.md](SECURITY.md).
