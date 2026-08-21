using System.Globalization;
using System.Net;
using System.Text;
using Carpoolio.Api.Observability;
using Carpoolio.Api.Repositories;
using Carpoolio.Api.Security;

namespace Carpoolio.Api.Endpoints;

public static class DashboardEndpoints
{
    public static WebApplication MapDashboardEndpoints(this WebApplication app)
    {
        app.MapGet("/dashboard", async (
            HttpContext context,
            DashboardCredentials credentials,
            DashboardRepository repository,
            RecentLogStore logs,
            CancellationToken cancellationToken) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            context.Response.Headers.XFrameOptions = "DENY";
            context.Response.Headers.ContentSecurityPolicy = "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
            if (!credentials.Authorizes(context.Request))
            {
                context.Response.Headers.WWWAuthenticate = "Basic realm=\"Carpoolio dashboard\", charset=\"UTF-8\"";
                return Results.Text("Authentication required.", statusCode: StatusCodes.Status401Unauthorized);
            }

            var snapshot = await repository.GetSnapshot(cancellationToken);
            return Results.Content(Render(snapshot, logs.GetRecent()), "text/html; charset=utf-8");
        }).RequireRateLimiting("dashboard").ExcludeFromDescription();

        return app;
    }

    private static string Render(DashboardSnapshot snapshot, IReadOnlyList<RecentLogEntry> logs)
    {
        var culture = CultureInfo.GetCultureInfo("nb-NO");
        var dailyRows = new StringBuilder();
        foreach (var metric in snapshot.Daily)
        {
            dailyRows.Append("<tr><td>")
                .Append(metric.Day.ToString("dd.MM.yyyy", culture))
                .Append("</td><td>").Append(metric.Users.ToString("N0", culture))
                .Append("</td><td>").Append(metric.Carpools.ToString("N0", culture))
                .Append("</td></tr>");
        }

        var logRows = new StringBuilder();
        if (logs.Count == 0)
        {
            logRows.Append("<p class=\"empty\">Ingen loggoppføringer ennå.</p>");
        }
        else
        {
            foreach (var entry in logs)
            {
                logRows.Append("<article class=\"log-entry\"><header><time>")
                    .Append(Html(OsloTime(entry.Timestamp).ToString("dd.MM.yyyy HH:mm:ss", culture)))
                    .Append("</time><span class=\"level ").Append(entry.Level.ToString().ToLowerInvariant()).Append("\">")
                    .Append(Html(entry.Level.ToString())).Append("</span><span class=\"category\">")
                    .Append(Html(entry.Category)).Append("</span></header><pre>")
                    .Append(Html(entry.Message));
                if (!string.IsNullOrWhiteSpace(entry.Exception))
                    logRows.Append('\n').Append(Html(entry.Exception));
                logRows.Append("</pre></article>");
            }
        }

        return $$"""
            <!doctype html>
            <html lang="nb">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <meta name="robots" content="noindex,nofollow">
              <title>Carpoolio dashboard</title>
              <style>
                :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; background: #0b0d12; color: #f4f5f7; }
                * { box-sizing: border-box; }
                body { margin: 0; background: radial-gradient(circle at top left, #1e2940 0, #0b0d12 36rem); }
                main { width: min(1120px, calc(100% - 2rem)); margin: 0 auto; padding: 2.5rem 0 4rem; }
                h1, h2, p { margin-top: 0; }
                h1 { margin-bottom: .35rem; font-size: clamp(1.9rem, 5vw, 3rem); }
                .subtitle { color: #9ca5b7; margin-bottom: 2rem; }
                .cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
                .card, .panel { border: 1px solid #293246; background: rgba(17, 22, 31, .92); border-radius: 1rem; box-shadow: 0 18px 60px rgba(0,0,0,.22); }
                .card { padding: 1.25rem; }
                .card span { display: block; color: #9ca5b7; font-size: .85rem; }
                .card strong { display: block; margin-top: .35rem; font-size: 2rem; }
                .grid { display: grid; grid-template-columns: minmax(270px, .8fr) minmax(0, 1.4fr); gap: 1rem; margin-top: 1rem; align-items: start; }
                .panel { overflow: hidden; }
                .panel > h2 { padding: 1.15rem 1.25rem; margin: 0; border-bottom: 1px solid #293246; font-size: 1rem; }
                .table-wrap { max-height: 34rem; overflow-y: auto; }
                table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
                th, td { padding: .7rem 1rem; text-align: right; border-bottom: 1px solid #20283a; }
                th:first-child, td:first-child { text-align: left; }
                th { position: sticky; top: 0; background: #151b27; color: #aeb7c8; font-size: .75rem; text-transform: uppercase; letter-spacing: .05em; }
                .logs { max-height: 34rem; overflow-y: auto; }
                .log-entry { padding: .85rem 1rem; border-bottom: 1px solid #20283a; }
                .log-entry header { display: flex; gap: .55rem; align-items: center; min-width: 0; font-size: .72rem; }
                time, .category { color: #929cad; }
                .category { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .level { padding: .15rem .4rem; border-radius: 999px; background: #2a3447; color: #d9deea; font-weight: 700; }
                .level.error, .level.critical { background: #652d3a; color: #ffd9e0; }
                .level.warning { background: #60471e; color: #ffe6aa; }
                pre { margin: .55rem 0 0; white-space: pre-wrap; overflow-wrap: anywhere; color: #d8deea; font: .75rem/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
                .empty { padding: 1rem; color: #9ca5b7; }
                @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } .cards { grid-template-columns: 1fr; } }
              </style>
            </head>
            <body>
              <main>
                <h1>Carpoolio dashboard</h1>
                <p class="subtitle">Driftsoversikt · dagstall vises i Europe/Oslo · logger er sortert nyest først</p>
                <section class="cards" aria-label="Totaltall">
                  <div class="card"><span>Brukere totalt</span><strong>{{snapshot.TotalUsers.ToString("N0", culture)}}</strong></div>
                  <div class="card"><span>Samkjøringer totalt</span><strong>{{snapshot.TotalCarpools.ToString("N0", culture)}}</strong></div>
                </section>
                <div class="grid">
                  <section class="panel">
                    <h2>Siste 30 dager</h2>
                    <div class="table-wrap"><table><thead><tr><th>Dato</th><th>Brukere</th><th>Samkjøringer</th></tr></thead><tbody>{{dailyRows}}</tbody></table></div>
                  </section>
                  <section class="panel">
                    <h2>Siste 100 loggoppføringer</h2>
                    <div class="logs">{{logRows}}</div>
                  </section>
                </div>
              </main>
            </body>
            </html>
            """;
    }

    private static string Html(string? value) => WebUtility.HtmlEncode(value ?? string.Empty);

    private static DateTimeOffset OsloTime(DateTimeOffset timestamp)
    {
        try { return TimeZoneInfo.ConvertTime(timestamp, TimeZoneInfo.FindSystemTimeZoneById("Europe/Oslo")); }
        catch (TimeZoneNotFoundException) { return timestamp; }
    }
}
