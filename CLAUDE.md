
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test

```bash
npm run build    # esbuild bundle → dist/index.js (not tsc)
npm run lint     # ESLint on src/**/*.ts
npm test         # vitest
```

## Commit conventions

- Write commit messages in **English** — while this is an in-house tool, the repo has third-party downloads and English commits are more accessible.
- Follow [conventional commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `docs:`).
- Use `git push --follow-tags` to push tags alongside commits.
- If SSH is blocked, fall back to HTTPS: `git push https://github.com/xiedada05/nodemw-mcp.git main`.

TypeScript compilation (`tsc --noEmit`) is clean; esbuild performs the actual build.

## Architecture

```
src/index.ts          CLI entry: parseArgs → autoDetectPath → initBot → fetch site info
                      → build Agent description → createServer(description)
                      → registerAllTools → stdio transport
                      → stderr banner (version/site/stats/auth/tools)

src/server.ts         createServer(description: string): McpServer — thin factory,
                      just sets name/version/description, no longer site-aware

src/tools/index.ts    Central registry: exports readToolRegistrars[] and writeToolRegistrars[]
                      registerAllTools(server, includeWriteTools) picks which to register

src/common/
  nodemwBot.ts        Bot singleton (initBot/getBot), promisifyBotMethod (callback→Promise),
                      ServerConfig, autoDetectPath, setMediaWikiVersion/getMediaWikiVersion
  utils.ts            jsonResult() (sets content + structuredContent), errorResult()
  pageState.ts        Read-before-write guard: markAsRead() / requireRead()

src/tools/ro/         Read-only tools (~33)
src/tools/editing/    Write tools (~15), all call requireRead() before any edit
```

**Key: the Agent description is generated in `index.ts`** (not server.ts). It contains site info, stats, user rights, safety principles, language — everything the LLM needs to know upfront.

## Bot API: high-level vs low-level

- **`promisifyBotMethod(bot, 'methodName', ...args)`** — wraps nodemw's callback-based Bot methods. Used for most operations where nodemw has a matching method.
- **`(bot as any).api.call(params, callback, 'GET'|'POST')`** — low-level MediaWiki API access. Used when:
  - nodemw's method doesn't accept page IDs (`pageids`) or revision IDs (`revids`)
  - nodemw's method passes wrong params (e.g. `auwitheditsonly=0` bug in `getUsers`)
  - nodemw's method hardcodes wrong token type (e.g. `protect` hardcodes `csrf`)
  - The tool needs a custom action nodemw doesn't wrap (e.g. `block`, `unblock`, `undelete`)

## Tool pattern

Every tool file exports a single function `(server: McpServer) => RegisteredTool`:

1. `server.tool(name, description, paramsSchema, annotations, handler)` registers the tool
2. `tool.update({ outputSchema: {...} })` adds Zod-based structured output validation
3. XOR validation for `title`/`id` or `username`/`id` dual params
4. Return `jsonResult(data)` or `errorResult(message, error)`

**Naming convention for write tools:**
- `edit` — line-based exact-match replacement (old_lines → new_lines), paired with `get-article-with-lineno`
- `write` — full-page overwrite (replaces everything)

## Version-aware token fetching

MediaWiki 1.24+ uses unified `csrf` tokens. MW 1.23 uses action-specific tokens (e.g. `block`, `protect`, `undelete`). Tools that call the API directly (block, protect, undelete) must check the cached version:

```ts
const mwVersion = getMediaWikiVersion();
const tokenType = (mwVersion !== null && mwVersion >= 1.24) ? 'csrf' : 'block';
```

The version is cached once at startup via `getMediaWikiVersion()` → `setMediaWikiVersion()`. If the call fails, the tool falls back gracefully — the token fetch error from the API will give a clear permission/type message.

## Read-before-write guard

Write tools must not edit a page whose current content hasn't been read first. Enforced by `pageState.ts`:

- Content-reading tools (`get-article`, `get-article-with-lineno`) call `markAsRead(pageid, lastrevid)`
- Write tools call `requireRead(title)` which throws if the page hasn't been read
- Error message names both `get-article` and `get-article-with-lineno` as valid readers
- `requireRead` also resolves the title to a pageid

## Write tool risk levels

Every write tool description is prefixed with a risk level, matching the system prompt's safety principles:

- **HIGH RISK** — block, unblock, delete, undelete, protect, send-email, create-account (affects real people/content; admin-only)
- **MEDIUM RISK** — move, upload, upload-by-url, write, add-flow-topic (can disrupt structure; recoverable)
- **LOW RISK** — edit, append, prepend, purge (additive or guarded; trivial to undo)

## License header

Every source file must carry the BSD-2-Clause license header. Copy it verbatim from any existing `.ts` file.
