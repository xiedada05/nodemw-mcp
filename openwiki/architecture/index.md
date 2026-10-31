# 文件

- [Bot 运行时：共享状态、配置与 promisified 客户端](bot-runtime.md) - src/common/nodemwBot.ts 的模块级运行时：ServerConfig 到 Bot 单例的构造、authenticated 标志与登录心跳、MediaWiki 版本与命名空间缓存，以及 promisifyBotMethod 与 callApi 两个回调转 Promise 助手如何被工具消费。
- [架构总览：五个域与依赖方向](overview.md) - 把仓库划成五个自有域——进程引导、MCP 表面、工具实现、共享运行时与依赖加固——并固定它们的依赖方向、可变状态归属、注册期工具门控、一次工具调用的端到端路径，以及"每个 .ts 都带 BSD-2-Clause 头、没有依赖注入层"这两条写进代码的硬约定。
- [启动生命周期：从 argv 到可用的 MCP 会话](startup-lifecycle.md) - 按顺序跟踪 src/index.ts 中 main() 的引导过程 —— CLI 与环境解析、uncaughtException 抑制器、autoDetectPath 探测、initBot 与可选登录、站点信息/命名空间/统计抓取（致命）、版本缓存、whoami 自省、Agent 描述拼装、createServer 与 registerAllTools、stdio 连接、仅已认证会话的 60 秒登录心跳与 stderr 横幅，并区分四处致命失败与只静默降级的步骤。
- [工具注册表与工具模块契约](tool-registry.md) - 解释 src/tools/index.ts 如何用 readToolRegistrars/writeToolRegistrars 两个静态数组和 registerAllTools(server, includeWriteTools) 的布尔 gating 决定可用工具全集（37 只读 + 17 写 = 54），逐 registrar try/catch 吞掉注册异常后的排障语义，以及每个工具模块共享的契约——位置参数 server.tool 注册、四键 ToolAnnotations、tool.update 的 outputSchema、jsonResult/errorResult 结果成形，还有 annotations/smoke/readGuard 三个测试如何把这份契约变成 CI 断言。
