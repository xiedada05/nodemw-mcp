# nodemw patch: upstream contribution notes

The bundled patch `nodemw+0.26.0.patch` hardens nodemw 0.26.0 against four
classes of defects found during a security audit of a downstream MCP server.
Everything here is meant to be upstreamed to macbre/nodemw — the changes are
deliberately minimal, behavior-preserving for well-formed wikis, and grouped
by topic so they can be split into separate PRs.

## 1. Malformed API responses must not crash the host (CWE-754 / CWE-248)

`Api.prototype.call` validates only the HTTP status, JSON parseability and the
MediaWiki `error` key. Two consequences when the configured wiki (or any
middlebox in front of it) answers 200 with unexpected JSON:

- `lib/api.js` — a body of `null` (valid JSON, 4 bytes) skips
  `if (data && !data.error)` and throws `TypeError` on `else if (data.error)`.
  The callback runs inside `@cypress/request`'s `complete` EventEmitter
  listener, so the throw surfaces as an **uncaughtException** and kills the
  host process — no caller try/catch can intercept it.
  *Fix:* guard the deref and route falsy bodies (`null/false/0/""`) to
  `callback(new Error("MediaWiki API returned an empty response"))` instead
  (falsy-but-not-null bodies previously never called back at all, wedging
  the caller's promise forever).

- `lib/bot.js` — several convenience-method callbacks dereference response
  fields unguarded, including on **error** paths where api.js delivers no
  data at all:
  - `getFirstItem(obj)` → `Object.keys(undefined)` (used by `getArticle`,
    `getToken` legacy path, `getArticleInfo`, …)
  - `getToken`: `data.tokens.csrftoken.toString()`,
    `getFirstItem(data.pages)[action+"token"]`, and
    `raw.warnings.info["*"]` when the token is falsy; also the
    `getMediaWikiVersion` callback's `err` argument was ignored, silently
    selecting the legacy `intoken` path on modern wikis
  - `doEdit` (`data.result`), `addFlowTopic`, `delete`, `purge`
    (`data.forEach`), `sendEmail`, `move`, `upload`
    (`data.imageinfo.descriptionurl`) — each throws on a 200 body without
    the action key (e.g. `{"batchcomplete":""}`)
  - `createAccount`: first callback ignores `err` entirely and dereferences
    `data.tokens.createaccounttoken` (any API-error response kills the host)
  - `logIn`: first callback handles `err` but dereferences `data.result` on
    a 200 body that has neither `login` nor `error` keys
  - `getMediaWikiVersion`: `version.match(/[\d.]+/)[0]` throws for a missing
    or non-string `query.general.generator`
  *Fix:* guard each deref and route through the normal error callback.

## 2. Every request needs a timeout (CWE-400)

`doRequest` and `fetchUrl` pass no `timeout` to `@cypress/request`, so all
of the library's connect/response-header/inter-byte timeout machinery stays
off. A stalled api.php (or a stalled `fetchUrl` source) holds the request
open forever — and, because every request occupies a slot in the shared
`async.queue` (default concurrency 3), three stalled requests permanently
freeze **all** library traffic.

*Fix:* `timeout: 30000` in both option objects.

## 3. `fetchUrl` must not leak the session cookie jar (CWE-200 / CWE-384)

`fetchUrl` attached the bot's shared `RequestJar` — populated by `logIn()`
with the authenticated session cookies — to an arbitrary URL. Cookie scoping
is hostname-based and port-agnostic (RFC 6265), and `Domain=` cookies match
sibling subdomains, so the fetch both replays the session cookie to any
same-hostname service and lets the fetch target overwrite session cookies
used by later API calls.

*Fix:* only reuse the shared jar when the target is the wiki's own origin
(same protocol/hostname/port); every other target gets a fresh throwaway jar.

## 4. Never log `process.argv` (CWE-532)

The `Api` constructor logged the full command line at info level on every
construction. Downstream CLIs commonly pass credentials on argv
(`-p <password>`, `--token`), so debug mode (and the conditional `log/` File
transport, which logs at info even without debug) wrote the wiki bot
password to stdout and to disk.

*Fix:* drop the `process.argv` echo; the User-Agent and referer info lines
remain.

## Suggested PR split

1. `fix(api): treat empty JSON bodies as API errors instead of crashing` (api.js)
2. `fix(bot): guard response-shape dereferences in convenience methods` (bot.js)
3. `fix: bound all requests with a 30s timeout` (api.js)
4. `fix(api): do not attach the session cookie jar to external fetches` (api.js)
5. `fix(api): stop logging process.argv (credentials)` (api.js)
