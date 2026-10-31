# 文件

- [新增或修改一个工具](adding-a-tool.md) - 在本仓库新增或修改一个 MCP 工具的端到端清单：按统一模板在 src/tools/ro 或 src/tools/editing 下建文件、在两个 registrar 数组里登记、用 tool.update 补 outputSchema、声明四个 annotation hint 并按风险等级写 description、按需接上读前写守卫与冲突参数，最后同步 README 与三个工具级测试再跑类型检查、测试、lint 与构建。
- [编辑、验证与治理 wiki 内容的工作流](editing-content.md) - 从读取证据、diff-preview 预览、edit 与 write 的取舍、doEdit 携带的 basetimestamp/starttimestamp 冲突守卫，到 newrevid 回传、parse 验证与 markAsWritten 续期的完整改动流程，以及摘要前缀、dry-run、编辑冲突与登录过期的处置，和 12 个管理动作对读状态与审计的影响。
- [读取与检查 wiki 内容：意图选型、分页语义与读证据](reading-content.md) - 按"要回答什么问题"给 37 件只读工具建立意图到工具的映射，说明三种结果信封（31 件声明 outputSchema 的 jsonResult、2 件无 schema 的 jsonResult、4 件裸文本）、交付正文的五条通道、maxlen 与 offset/limit 的截断与续读标记、批量与 rvlimit/批次上限、命名空间缓存解析、total 的四种含义，以及只有四件工具的整页读取才留下写前必读证据、diff-preview/diff-revisions/parse 构成的验证回路。
