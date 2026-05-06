# Nodemw MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.org) server for [nodemw](https://github.com/macbre/nodemw), the Node.js MediaWiki API client.

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
| `--user` | `-u` | Login username |
| `--pass` | `-p` | Login password |
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
```

## Environment Variables

All settings can be configured via environment variables. CLI arguments take precedence.

| Variable | Equivalent |
|----------|------------|
| `NODEMW_MCP_SERVER` | `--server` / positional |
| `NODEMW_MCP_ENDPOINT_PATH` | `--path` |
| `NODEMW_MCP_MW_USER` | `--user` / `-u` |
| `NODEMW_MCP_MW_PASS` | `--pass` / `-p` |

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

### Read Operations (29 tools)

`get-article`, `search`, `get-pages-in-category`, `get-categories`, `get-users`, `get-all-pages`, `get-pages-in-namespace`, `get-pages-by-prefix`, `get-pages-transcluding`, `get-article-revisions`, `get-article-categories`, `get-article-properties`, `get-article-info`, `get-user-contribs`, `whoami`, `whois`, `whoare`, `get-images`, `get-images-from-article`, `get-image-usage`, `get-image-info`, `get-log`, `expand-templates`, `parse`, `get-recent-changes`, `get-site-info`, `get-site-stats`, `get-mediawiki-version`, `get-external-links`, `get-backlinks`, `get-query-page`

### Write Operations (12 tools, require authentication)

`edit`, `append`, `prepend`, `move`, `delete`, `protect`, `purge`, `send-email`, `upload`, `upload-by-url`, `add-flow-topic`, `create-account`

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

---

# Nodemw MCP Server（中文）

一个为 [nodemw](https://github.com/macbre/nodemw)（Node.js MediaWiki API 客户端）构建的 [Model Context Protocol (MCP)](https://modelcontextprotocol.org) 服务器。

## 快速开始

```bash
# 安装
npm install
npm run build

# 以游客身份连接
node dist/index.js zh.minecraft.wiki

# 使用账号密码连接
node dist/index.js -u myuser -p mypass mywiki.example.com
```

## CLI 用法

```
nodemw-mcp-server [options] [server]
```

**参数说明**：

| 参数 | 简写 | 说明 |
|--------|-------|-------------|
| `[server]` | (位置参数) | 目标 MediaWiki 服务器，如 `en.wikipedia.org` |
| `--server` | `-s` | 同上，显式形式 |
| `--path` | | API 脚本路径（默认：自动检测；先尝试 `/w`，再尝试根路径） |
| `--user` | `-u` | 登录用户名 |
| `--pass` | `-p` | 登录密码 |
| `--dry-run` | | 干运行模式（不执行实际编辑） |

**示例**：

```bash
# 游客访问，自动检测 API 路径
nodemw-mcp-server zh.minecraft.wiki

# 认证访问，手动指定 API 路径
nodemw-mcp-server -u editor -p secret --path /w mywiki.example.com

# 使用完整 URL
nodemw-mcp-server -s https://en.wikipedia.org

# 干运行模式，安全测试
nodemw-mcp-server --dry-run -u editor -p secret mywiki.example.com
```

## 环境变量

所有设置都可以通过环境变量配置，CLI 参数优先级更高。

| 变量 | 等效参数 |
|----------|------------|
| `NODEMW_MCP_SERVER` | `--server` / 位置参数 |
| `NODEMW_MCP_ENDPOINT_PATH` | `--path` |
| `NODEMW_MCP_MW_USER` | `--user` / `-u` |
| `NODEMW_MCP_MW_PASS` | `--pass` / `-p` |

## 配合配置文件使用

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

## 可用工具

### 读取操作（29 个工具）

`get-article`、`search`、`get-pages-in-category`、`get-categories`、`get-users`、`get-all-pages`、`get-pages-in-namespace`、`get-pages-by-prefix`、`get-pages-transcluding`、`get-article-revisions`、`get-article-categories`、`get-article-properties`、`get-article-info`、`get-user-contribs`、`whoami`、`whois`、`whoare`、`get-images`、`get-images-from-article`、`get-image-usage`、`get-image-info`、`get-log`、`expand-templates`、`parse`、`get-recent-changes`、`get-site-info`、`get-site-stats`、`get-mediawiki-version`、`get-external-links`、`get-backlinks`、`get-query-page`

### 写入操作（12 个工具，需要认证）

`edit`、`append`、`prepend`、`move`、`delete`、`protect`、`purge`、`send-email`、`upload`、`upload-by-url`、`add-flow-topic`、`create-account`

## 开发

```bash
npm run build        # 构建 dist/index.js
npm run dev          # 监视模式
npm run clean        # 删除 dist/
npm test             # 运行测试
```

## 许可协议

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
