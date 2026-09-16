# Nodemw MCP Server（中文）

一个为 [nodemw](https://github.com/macbre/nodemw)（Node.js MediaWiki API 客户端）构建的 [Model Context Protocol (MCP)](https://modelcontextprotocol.org) 服务器。

> [English](README.md)

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
| `--endpoint` | | `--path` 的别名 |
| `--user` | `-u` | 登录用户名 |
| `--pass` | `-p` | 登录密码 |
| `--token` | | 机器人令牌（替代用户名/密码） |
| `--user-agent` | `-A` | 自定义 User-Agent 字符串（替换默认值） |
| `--user-agent-append` | | 将自定义 User-Agent 追加到默认值之后 |
| `--debug` | | 启用调试日志 |
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

# 自定义 User-Agent（替换默认值）
nodemw-mcp-server -A "MyBot/1.0" mywiki.example.com

# 追加到默认 User-Agent
nodemw-mcp-server --user-agent-append -A "MyBot/1.0" mywiki.example.com

# 调试模式
nodemw-mcp-server --debug mywiki.example.com
```

## 环境变量

所有设置都可以通过环境变量配置，CLI 参数优先级更高。

| 变量 | 等效参数 |
|----------|------------|
| `NODEMW_MCP_SERVER` | `--server` / 位置参数 |
| `NODEMW_MCP_ENDPOINT_PATH` | `--path` |
| `NODEMW_MCP_MW_USER` | `--user` / `-u` |
| `NODEMW_MCP_MW_PASS` | `--pass` / `-p` |
| `NODEMW_MCP_MW_TOKEN` | `--token` |
| `NODEMW_MCP_USER_AGENT` | `--user-agent` / `-A` |
| `NODEMW_MCP_USER_AGENT_APPEND` | `--user-agent-append`（设为 `1`） |
| `NODEMW_MCP_DEBUG` | `--debug`（设为 `1`） |

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

### 读取操作（37 个工具）

`get-article`、`get-article-with-lineno`、`get-article-by-revision`、`search`、`diff-revisions`、`diff-preview`、`get-pages-in-category`、`get-categories`、`get-users`、`get-all-pages`、`get-pages-in-namespace`、`get-pages-by-prefix`、`get-pages-transcluding`、`get-article-revisions`、`get-article-categories`、`get-article-properties`、`get-article-info`、`get-user-contribs`、`whoami`、`whois`、`whoare`、`get-images`、`get-images-from-article`、`get-image-usage`、`get-image-info`、`get-log`、`expand-templates`、`parse`、`get-recent-changes`、`get-site-info`、`get-site-stats`、`get-mediawiki-version`、`get-external-links`、`get-backlinks`、`get-query-page`、`get-module-source`、`get-articles`

### 写入操作（17 个工具，需要认证）

`edit`、`write`、`revert`、`append`、`prepend`、`move`、`delete`、`undelete`、`protect`、`block`、`unblock`、`purge`、`send-email`、`upload`、`upload-by-url`、`add-flow-topic`、`create-account`

### 预览与验证渲染 HTML（parse）

`parse` 工具是 WikiText 与渲染 HTML 之间的桥梁：

- **写前预览**：`parse(text="...", title="目标页面")` 在页面上下文中渲染未保存的 wikitext，`pst=true` 可展开 `~~~~` 签名等预保存转换。
- **写后验证**：`parse(page="目标页面")` 直接渲染页面当前已保存的内容——推荐作为任何编辑工作流的收尾步骤。
- **损坏输出会被标记而非静默**：HTML 中内嵌的错误元素（如渲染失败的 `{{#widget:...}}` 或模板）会被检测并以警告形式报告，因为 API 调用本身仍是成功的。
- **复杂 HTML 的渲染上下文**：`include=["modules","jsconfigvars","headhtml"]` 返回渲染页面所需的 ResourceLoader 模块、JS 配置变量和 `<head>` HTML——把 HTML 交给浏览器做视觉检查或开发 Widget 时必不可少。`limit_report=true` 额外返回结构化解析器性能报告。带 `include`/`limit_report` 时返回结构化 JSON，否则保持纯 HTML 输出格式。

### 编辑冲突防护

`write`、`edit`、`append`、`prepend` 会跟踪当前会话读取过的页面（读状态按会话隔离——重连后必须重新 `get-article`）。保存请求携带 `basetimestamp`/`starttimestamp`；此外 `write` 会拒绝覆盖在你读取之后被他人修改过的页面——保存失败时会给出「重读、重改、再保存」的指引。

两个 diff 工具帮你提前看到变化：`diff-revisions` 对比任意两个版本（缺省为「本会话上次读取 → 当前最新」），`diff-preview` 展示拟保存内容会改动什么——两者都走服务端 diff 引擎，不会写入任何内容。

### 搜索

`search` 是全文搜索（MediaWiki `list=search`）：关键字原样传给搜索后端，CirrusSearch 站点支持查询语法，如 `insource:"{{#widget:Bilibili"`（查找调用某 Widget 的页面）、`intitle:"..."`。使用默认 MySQL/MariaDB 后端的站点不支持这些语法——可用 `mode="title"` 做仅标题匹配。

### 编辑 Lua 模块（推荐工作流）

1. 使用 `get-article "Module:XXX"` 下载模块原始源码
2. 在本地用你喜欢的编辑器修改
3. 大模块建议通过 nodemw Bot 脚本上传：

```js
const Bot = require("nodemw");
const fs = require("fs");
const bot = new Bot({...});
bot.logIn(username, password, () => {
    bot.edit("Module:XXX", fs.readFileSync("Module-XXX.lua", "utf-8"),
        "你的编辑摘要", (err) => { ... });
});
```

这样可以避免通过 MCP `write` 上传大模块时的 token 开销。

对于小改动，可以直接用 `edit` 和 `write` 工具操作。

> **提示：** 使用 `search(keyword, namespace=828, mode="title")` 按名称查找 Lua 模块
> （仅匹配标题；默认 `mode="text"` 为全文搜索页面内容，支持 CirrusSearch 语法如 `intitle:"..."`），
> 使用 `get-pages-by-prefix(prefix="QR", namespace=828)` 按命名规则发现模块（指定 namespace 后前缀不含命名空间前缀）。

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
