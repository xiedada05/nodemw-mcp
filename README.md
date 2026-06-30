# Nodemw MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.org) server for [nodemw](https://github.com/macbre/nodemw), the Node.js MediaWiki API client.

> [简体中文](README.zh-hans.md)

## Quick Start

```bash
# Install
npm install
npm run build

# Connect as guest
node dist/index.js zh.minecraft.wiki

# Connect with credentials
node dist/index.js -u myuser -p mypass mywiki.example.com
```

## CLI Usage

```
nodemw-mcp-server [options] [server]
```

**Arguments**:

| Option | Short | Description |
|--------|-------|-------------|
| `[server]` | (positional) | Target MediaWiki server, e.g. `en.wikipedia.org` |
| `--server` | `-s` | Same as positional, explicit form |
| `--path` | | API script path (default: auto-detect; tries `/w` then root) |
| `--endpoint` | | Alias for `--path` |
| `--user` | `-u` | Login username |
| `--pass` | `-p` | Login password |
| `--token` | | Bot token (alternative to username/password) |
| `--user-agent` | `-A` | Custom User-Agent string (replaces default) |
| `--user-agent-append` | | Append custom User-Agent to default instead of replacing |
| `--debug` | | Enable debug logging |
| `--dry-run` | | Dry-run mode (no actual edits) |

**Examples**:

```bash
# Guest access, auto-detect API path
nodemw-mcp-server zh.minecraft.wiki

# Authenticated, explicit API path
nodemw-mcp-server -u editor -p secret --path /w mywiki.example.com

# With full URL
nodemw-mcp-server -s https://en.wikipedia.org

# Dry-run mode for safe testing
nodemw-mcp-server --dry-run -u editor -p secret mywiki.example.com

# Custom User-Agent (replace default)
nodemw-mcp-server -A "MyBot/1.0" mywiki.example.com

# Append to default User-Agent
nodemw-mcp-server --user-agent-append -A "MyBot/1.0" mywiki.example.com

# Debug mode
nodemw-mcp-server --debug mywiki.example.com
```

## Environment Variables

All settings can be configured via environment variables. CLI arguments take precedence.

| Variable | Equivalent |
|----------|------------|
| `NODEMW_MCP_SERVER` | `--server` / positional |
| `NODEMW_MCP_ENDPOINT_PATH` | `--path` |
| `NODEMW_MCP_MW_USER` | `--user` / `-u` |
| `NODEMW_MCP_MW_PASS` | `--pass` / `-p` |
| `NODEMW_MCP_MW_TOKEN` | `--token` |
| `NODEMW_MCP_USER_AGENT` | `--user-agent` / `-A` |
| `NODEMW_MCP_USER_AGENT_APPEND` | `--user-agent-append` (set to `1`) |
| `NODEMW_MCP_DEBUG` | `--debug` (set to `1`) |

## Usage with config files

```json
{
  "mcpServers": {
    "nodemw": {
      "command": "npx",
      "args": ["@xiedada/nodemw-mcp-server"],
      "env": {
        "NODEMW_MCP_SERVER": "mywiki.example.com",
        "NODEMW_MCP_MW_USER": "editor",
        "NODEMW_MCP_MW_PASS": "secret"
      }
    }
  }
}
```

## Available Tools

### Read Operations (33 tools)

`get-article`, `get-article-with-lineno`, `get-article-by-revision`, `search`, `get-pages-in-category`, `get-categories`, `get-users`, `get-all-pages`, `get-pages-in-namespace`, `get-pages-by-prefix`, `get-pages-transcluding`, `get-article-revisions`, `get-article-categories`, `get-article-properties`, `get-article-info`, `get-user-contribs`, `whoami`, `whois`, `whoare`, `get-images`, `get-images-from-article`, `get-image-usage`, `get-image-info`, `get-log`, `expand-templates`, `parse`, `get-recent-changes`, `get-site-info`, `get-site-stats`, `get-mediawiki-version`, `get-external-links`, `get-backlinks`, `get-query-page`

### Write Operations (16 tools, require authentication)

`edit`, `write`, `append`, `prepend`, `move`, `delete`, `undelete`, `protect`, `block`, `unblock`, `purge`, `send-email`, `upload`, `upload-by-url`, `add-flow-topic`, `create-account`

### Editing Lua Modules (Recommended Workflow)

1. Use `get-article "Module:XXX"` to download the module's raw source
2. Edit locally with your preferred editor
3. Upload using a nodemw Bot script for large modules:

```js
const Bot = require("nodemw");
const fs = require("fs");
const bot = new Bot({...});
bot.logIn(username, password, () => {
    bot.edit("Module:XXX", fs.readFileSync("Module-XXX.lua", "utf-8"),
        "your edit summary", (err) => { ... });
});
```

This avoids token overhead on large module uploads via MCP `write`.

For small edits, `edit` and `write` tools work directly from the agent.

> **Tip:** Use `search(keyword, namespace=828)` to find Lua modules, and
> `get-pages-by-prefix(prefix="QR", namespace=828)` to discover
> modules by naming convention (when namespace is set, the prefix omits the namespace prefix).

## Development

```bash
npm run build        # Build dist/index.js
npm run dev          # Watch mode
npm run clean        # Remove dist/
npm test             # Run tests
```

## License

    Copyright (c) 2026 Xie Youtian

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions are met:

    1. Redistributions of source code must retain the above copyright notice, this
      list of conditions and the following disclaimer.

    2. Redistributions in binary form must reproduce the above copyright notice,
      this list of conditions and the following disclaimer in the documentation
      and/or other materials provided with the distribution.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
    AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
    DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
    FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
    DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
    SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
    CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
    OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
    OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
