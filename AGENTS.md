# AGENTS.md

Nodemw MCP Server — MediaWiki API bridge for AI agents via the Model Context Protocol.

## Quick Commands

```bash
npm run build      # esbuild bundle → dist/index.js
npm run lint       # ESLint on src/**/*.ts
npm test           # vitest
```

Build uses **esbuild** (not tsc). `tsc --noEmit` is clean; esbuild performs the actual bundle for Node 18+ ESM output. External packages (`nodemw`, `@modelcontextprotocol/*`, `zod`) are not bundled.

## Architecture at a Glance

```
src/index.ts        CLI entry → parse args → init Bot → create Server → stdio transport
src/server.ts       McpServer factory (thin)
src/tools/index.ts  Central registry: readToolRegistrars + writeToolRegistrars
src/tools/ro/       ~33 read-only tools
src/tools/editing/  ~15 write tools (all gated by read-before-write guard)
src/common/         Bot singleton, pageState guard, result helpers
```

Tool pattern: each file exports `(server: McpServer) => RegisteredTool`, registers with Zod schema + `outputSchema.update()`, and returns `jsonResult()` or `errorResult()`.

## Key Conventions

- **BSD-2-Clause license header** required in every `.ts` file — copy from any existing file.
- **Commit messages** in English, follow [conventional commits](https://www.conventionalcommits.org/).
- **Read-before-write guard**: write tools must call `requireRead()` which fails unless the target page was read via `get-article` or `get-article-with-lineno` first.
- **Version-aware tokens**: MediaWiki <1.24 uses action-specific tokens; ≥1.24 uses unified `csrf`. Check `getMediaWikiVersion()` before low-level `api.call`.
- **Write tool risk levels**: HIGH (block/unblock/delete/undelete/protect) / MEDIUM (move/write/upload) / LOW (edit/append/prepend/purge) — prefixed in tool descriptions.

## Adding a New Tool

1. Create `src/tools/{ro,editing}/name.ts` with the license header
2. Export a `(server: McpServer) => RegisteredTool` function
3. Register in `src/tools/index.ts` import + array
4. Write tools: add `requireRead(title)` before any edit action

For detailed architecture, Bot API usage, and tool patterns, see [CLAUDE.md](./CLAUDE.md). For usage and configuration, see [README.md](./README.md).
