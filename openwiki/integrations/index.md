# 文件

- [MCP 传输、服务器身份与客户端接线](mcp-transport-and-clients.md) - nodemw-mcp-server 的 MCP 面：McpServer 工厂装配的身份与 instructions、唯一可用的 StdioServerTransport 与 stdout 只承载 JSON-RPC 的不变量、capabilities 的合并规则、operating-principles prompt 回退、.mcp.json 与 npx 与 dist/index.js 三种接线形态，以及"一个进程等于一次连接"带来的重连语义（新进程、新读状态、重新登录）。
- [nodemw 客户端集成：调用面、补丁加固与升级复核](nodemw-client.md) - 服务器如何选择 nodemw 的高层方法与裸 api.call（何时用 promisifyBotMethod、何时必须降级到 callApi），以及 patches/nodemw+0.26.0.patch 通过 postinstall patch-package 加固的四类缺陷、应用层的对冲手段与依赖升级规则。
