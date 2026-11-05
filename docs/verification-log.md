# 本机验证记录

> 本文档是 [README](../README.md) 的扩展说明，记录项目自验证据（2026-11-03，desktop profile；按阶段累积，最新一轮见表格末尾「九期」相关记录）。

本记录是项目**自验**结果，按阶段累积，不是独立第三方结论；独立第三方 QA 报告见 [verification.md](./verification.md)，相关预览图见 [preview/](./preview/README.md)。

[← 返回 README](../README.md) · [架构与关键代码](./architecture.md) · [开发与测试](./development.md) · [已知限制](./limitations.md)

---

| 项目 | 证据 | 结论 |
| --- | --- | --- |
| bundle 安装 | `install_bundle` 返回包安装成功，`plugin_manager` 中 `include:dsh-todo-time-log` `enabled: true` | PASS |
| Host 激活 | 关闭再开启后返回 `application: "applied"`、`fiberPhase: "active"` | PASS |
| 智能体工具注册 | 工具表出现 `todo_time_log`，参数/枚举与设计一致 | PASS |
| 工具实际执行 | 依次 create → complete → 重复 complete(失败提示) → uncomplete → update → delete，输出本地时间 `2026-11-03 08:37:49`、未完成显示 `-` | PASS |
| 双调用方一致 | 用 HTTP curl 创建的行，随后被工具 `list` 读到（同一 store）；工具删除后 HTTP `list` 归零 | PASS |
| HTTP 路由 | 运行中实例上 `/health`、`/create`、`/list`、`/complete`（重复 409）、`/uncomplete`、`/delete` 全部符合契约 | PASS |
| UTF-8 往返 | `python test/live-utf8.py` 全通过（中文标题原样返回，无乱码） | PASS |
| 持久化 | `~/.dsh/todo-time-log/todos.json` 内容为 `{version, updatedAt, todos[]}`，重载后数据仍在 | PASS |
| Client 槽位注册 | Client Slots：`main` occupant `key=dsh-todo-time-log active=true`；`sidebar.panellist` occupant `id=dsh-todo-time-log order=30 active=true` | PASS |
| 分类（v2） | `python test/live-projects.py` 全通过：分类归一化、按分类筛选（含未分类）、`projects` 统计、只改分类、no-op、超长/非字符串 400、`sortBy=project` 未分类置尾 | PASS |
| 数据迁移 | 真机数据文件已写为 `version: 2`；v1 信封加载→提示→下次写入落盘 v2（`test/smoke.mjs` 断言） | PASS |
| 工具带分类 | `todo_time_log create project=演示` → 列表输出 `[未完成] [演示] …` 且含「分类：演示(1)」行 | PASS |
| 甘特图 / 项目分类 UI / 对话录入 | 独立 QA 用 Node 沙箱真实求值 client.js（53/53：甘特几何、对话解析、撤销路径、i18n 成对、主题 token）+ 真机 HTTP 契约 46/46 与补充 6/6；**页面需刷新后才加载新 client.js** | PASS（静态/契约）；外观与真实交互 NOT VERIFIED |
| 迁移复核（QA） | 临时目录 52/52：v1→v2（加载不改写、下次写入落 v2）、v99 归档字节保留、分类修复、乱序时间不崩、shape 归档、duplicate-id/remove 失败语义 | PASS |
| 分类筛选类型校验 | 重载后真机 `/list {"project": 42}` → `400 PROJECT_INVALID`；正常 `/list` 仍 200 | PASS |
| 四视图静态审计 | `npm run audit` 28 项全通过：i18n 163 键/语言成对无死键、只 `require('react')`、无 document/DOM、无硬编码颜色、`ttl-` 前缀、四视图与渲染器齐备、6×7 日历、模块格式/双槽位 | PASS |
| 四视图代码审查 | 实现方自测 shim 169 条断言 + 独立 QA 在 Node 沙箱真实求值 client.js 77 条断言（四视图切换与状态保持、表头排序单一状态源、看板两种分组与计数、日历本地时区落格/跨月/补格/+N、甘特行内操作与表格展开独立、i18n 163 键成对） | PASS（静态） |
| 工作区 / 安装副本一致性 | `lib/client.js` 字节级一致（141,254 B，3,948 行） | PASS |
| 四期 @文件 / quick-add | 真机：`/files` 按 `workspace` 返回对应仓库文件（`query=lib/s` 命中 `lib/store.js`）；`/quick-add`「新任务 写周报 #工作 @lib/store.js；修复甘特图 @lib/client.js」→ 显式分类 `工作` 优先、仅 @文件 时派生 `lib`；工具 `quick_add` 同路径实测通过；`@"含 空格 路径"` 解析通过 | PASS |
| 显式「未分类」持久化（QA FAIL-1） | 已修：仅当 `project` 字段缺失时才由文件派生分类。真机 create `project:''` + `files` → 重载插件 → 仍为 `''`、无提示 | PASS |
| 四期静态审计 | `npm test` **49 + 99 + 47**；`npm run audit` **28 项**（i18n 191 键/语言、22 tokens、147 类名）；`npm run check` 覆盖 6 个 lib 文件 | PASS（以本节为最新；上方阶段三/四行保留为历史记录） |
| 五期分类点选 | 真机：`/projects {workspace: 本仓库}` → 4 个工作区名 + `docs/lib/locale/test` 文件夹；用建议项 `lib` 创建 → `/list` 的 projects 出现 `lib(1)`；`update` 到 `docs` 生效；未知 workspace → 400；无 `fs` 时仍 200（仅缺 folder 来源） | PASS（选择器 UI 外观待刷新后人工确认） |
| 五期项目选择器 | 真机 `POST /projects {workspace: 本仓库}` → 200，建议含 4 个工作区名（`dsh-todo-time-log`/`feiyu-archive`/`File_Manager_Legacy`/`default-workspace`）与 4 个顶层文件夹（`docs`/`lib`/`locale`/`test`）；已用分类按次数排最前（单测覆盖合并/去重/超长过滤） | PASS（选择器 UI 外观待刷新后人工确认） |
| 页面视觉外观 | 本会话无浏览器截图能力；四视图 + @ 补全下拉 + 文件 chips 需刷新后人工确认 | NOT VERIFIED（需人工看一眼） |
| 视觉重构静态审计 | `npm run audit` 28 项全通过（i18n **194 键/语言**成对无死键、24 个 alias token、160 个 `ttl-` className 字面量）；`npm test` **49 + 99 + 47** 全通过；`node --check` 覆盖 6 个 lib 文件 | PASS |
| 视觉重构渲染验收 | jsdom 真实挂载 `main` 槽组件后跑 **26 条**交互断言 + **8 条**空态断言 + **2 条**未分类断言，全部通过：唯一主操作、两组分段控件、数据卡片包裹工具栏、toast 不在文档流且不新增 `.ttl-page` 子节点、撤销/关闭、**分类筛选下分段计数与行数一致（命名分类 3/1/2、未分类 1/1/0、无条目的分类 0/0/0）**、方向 `aria-label` 翻转、四视图渲染、对话开关；四个视图的空态都有出口按钮，一次点击清掉全部筛选，无筛选时点击聚焦新建框 | PASS（渲染/结构） |
| 视觉外观（本次） | [`docs/preview/`](./preview/README.md)：用真实 `client.js` + 宿主真实主题 token 渲染的 **18 张**静态预览（默认/完成 toast/对话/看板/甘特/日历/空/骨架/错误/暗色/窄屏 + 看板更多操作/按分类/窄屏/暗色/泳道/紧凑/移动）+ 改版前对照 | 真机需刷新页面后人工确认 |
| 六期看板静态审计 | `node --check lib/client.js`、`npm test` **49 + 99 + 47**、`npm run audit` **28 项**（i18n **216 键/语言**、24 tokens、177 类名）全通过 | PASS |
| 六期看板渲染验收 | 仓库外 jsdom + 真实 `client.js` + 宿主主题 token：**22 条**交互断言全通过（两列/计数、已完成默认 10 条 + 显示全部、每卡 checkbox/更多/`<time>`、更多操作展开、按分类分组 4 列 + 状态徽标、切回状态分组、看板状态筛选生效/重置、搜索 1 条命中/无结果/Escape 清空、勾选完成后跨列移动与计数）；同一渲染结果产出 `04` 与 `12`–`15` 预览 | PASS（渲染/结构）；真机交互需刷新后人工确认 |
| 七期 Host 契约（priority v4） | `node --check` 3 个 Host 模块通过；`npm test` **61 + 139 + 58** 全绿；v1/v2/v3→v4 迁移、priority 校验/排序/未设置置尾、工具 schema、quick-add 优先级均有断言覆盖 | PASS |
| 七期 A/B/C 静态审计 | `node --check lib/client.js`；`npm run audit` **28 项**（i18n **239 键/语言**、24 tokens、188 类名）；`npm test` **61 + 139 + 58** | PASS |
| 七期 A/B/C 渲染验收 | 同一套 jsdom harness 扩到 **42 条**断言：泳道（≥6 个、折叠/展开）、紧凑密度 class、移到分类写回 + toast + 撤销、`/`/`n`/`f` 快捷键、优先级徽标/卡片 select 写回 + 撤销、新建表单携带优先级、表格排序含优先级；产出 `04`、`12`–`18` 共 11 张看板预览 | PASS（渲染/结构）；真机交互需刷新后人工确认 |
| 八期 Host 契约（type v5） | `node --check` 3 个 Host 模块通过；`npm test` **79 + 174 + 66** 全绿；v1–v4→v5 迁移、type 校验/归一化/部分更新、quick-add 标记与表单回退均有断言覆盖 | PASS |
| 八期类型 UI + @ 菜单渲染验收 | jsdom harness **58 条**断言全绿（类型徽标、类型 select 写回 + 撤销、新建表单携带类型、类型筛选、搜索命中类型名、表格类型徽标；`/todo` 草稿的 `@` 菜单含「待办优先级 / 待办类型」候选，选中分别插入 `!high ` / `^bug `，分类候选行为不变）；`npm run audit` **28/28**（i18n **253 键/语言**、24 token、189 类名）；预览 `04`、`12`–`18` 已按类型徽标重拍 | PASS（渲染/结构）；真机需重启插件 + 刷新页面确认 |
| 九期 DSH 0.2.2-rc.1 兼容性（0.5.2） | 旧 `engines.dsh` 上界 `<0.2.2-0` 会排除预发布 `0.2.2-rc.1`（DSH preflight 用 `semver.satisfies(..., {includePrerelease:true})`），导致插件被禁用；已改为 `>=0.2.0-rc.2 <0.2.3-0` 并升 0.5.2。独立复核：Host 9 个集成点 **0 BREAK / 1 RISK(低) / 8 PASS**（真实 DSH JSON-Schema/工具管线探针 **47/47**）；Client **6/6 PASS**（117 槽目录含 `main`/`sidebar.panellist`、`inputTriggers` 契约 0.2.1→0.2.2 仅 i18n 差异、29/29 主题 token 有定义）；隔离 `DSH_HOME` 真实 0.2.2-rc.1 端到端 **27/27**（安装放行、路由/工具/命令注册、HTTP CRUD 25/25、重启持久化 6/6、client 注入）；反证旧范围被 install preflight 拒绝 + 启动 skip + 路由 404；运行中 desktop 重装 0.5.2 后 live 复验通过（`todo_time_log` 可调用、`/health` loaded 12 条、`main`/`sidebar.panellist` 槽位 active）。详见 [`docs/verification.md` §24](./verification.md) | PASS（契约 + 真机端到端）；浏览器像素级 UI 与真实模型回合调用工具未覆盖 |
