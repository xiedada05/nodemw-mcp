# 文件

- [构建、发布与 CI 流水线](build-and-release.md) - 说明 src/index.ts 如何由 esbuild 打成唯一产物 dist/index.js（bundle 选项、三个外部依赖、license banner、--watch），安装期 postinstall patch-package 与 prepare 重建的顺序，tsc/ESLint/vitest 的定位，files:["dist"] 构成的发布面，release created 触发的 npm-publish 工作流（Node 24、provenance）与 OpenWiki 定时更新工作流的失败语义。
- [配置与连接：CLI 参数、环境变量与优先级](configuration.md) - 以 parseCliArgs 与 createBotFromConfig 为依据，逐项列出 nodemw-mcp-server 决定"连哪个 wiki、怎么连"的全部旋钮 —— CLI 参数与位置参数、NODEMW_MCP_* 环境变量的完整映射与优先级、站点 URL 拆成 hostname/protocol/port 的规则、`/w` 与根挂载的自动探测及其致命失败、User-Agent 的替换与追加、debug 落到 stdout 的风险、只覆盖部分工具的 `--dry-run`，以及 README 与代码之间已核实的落差（`--token` 被解析却不转发、`NODEMW_MCP_MW_TOKEN` 从未被读取）。
