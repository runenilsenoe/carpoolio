# Contributing

Keep changes focused, readable, and covered by the relevant checks.

Before opening a pull request, run:

```sh
bun run check
bun test
dotnet test
```

Do not commit `.env`, generated build output, or credentials. Add UI primitives
only when they are used by the application.
