# 文件

- [MediaWiki 版本兼容性与回退](api-compatibility.md) - 逐条列出按目标 wiki 的 MediaWiki 版本分流的每一个位置——1.24 的 token 边界、diff-preview 的 totext 与 topst 门控、compare 的富 prop 回退、parse 的 generatexml 移除——并说明版本未知时的取舍、为什么回退判定只能匹配错误文案，以及新增直连调用点必须遵守的规则。
- [写前必读守卫与编辑冲突保护](read-before-write-guard.md) - src/common/pageState.ts 中进程级 readState 与 writeCache 的结构、四个会留下读证据的读取工具与明确不留证据的局部/旧版读取、requireRead 借助 getArticleInfo 的判定顺序与标题重绑检查，以及 basetimestamp/starttimestamp 与显式 revid CAS 构成的两层编辑冲突保护及其 fail-open 语义。
- [安全模型：能力门控、会话层、体量守卫与出站边界](safety-model.md) - 沿一次调用的路径梳理 nodemw-mcp 的分层防护——凭据如何决定门控输入、注册期如何让 guest 会话根本看不到 17 个写工具、单进程一会话与登录心跳、风险前缀与 ToolAnnotations、instructions/prompt 行为契约、handler 内的写前必读与体量启发式与 XOR 校验、upload-by-url 的 safeFetch 出站边界、审计标签，以及每一层能否真正拒绝调用、新增防护应落在哪一层。
- [工具结果与输出整形](tool-results-and-output-shaping.md) - nodemw-mcp 每个工具交回 agent 的结果契约——jsonResult 的双通道与 errorResult 的 isError 形状、outputSchema 与纯文本工具的取舍、登录过期与编辑冲突的故障气味注解、siteinfo 压缩与 parse 错误元素警告、compare HTML 到行文本 diff 的转换，以及 maxlen/offset/批次上限的截断标记与它们和写前必读证据的耦合。
