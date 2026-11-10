# 开发与测试

> 本文档是 [README](../README.md) 的扩展说明，覆盖测试矩阵（自动化 + 手工验证清单）与 npm 发布流程。

[← 返回 README](../README.md) · [架构与关键代码](./architecture.md) · [已知限制](./limitations.md) · [验证记录](./verification-log.md)

## 测试

### 5.1 自动化

```bash
npm run build     # esbuild：src/client/ → lib/client.js（单文件产物）
npm run check     # 八个 lib 文件（time/parse/files/store/transfer/settings/index/client）的 node --check
npm run lint      # ESLint（flat config；构建产物 lib/client.js 不直接 lint，lint src/client/）
npm run typecheck # tsc --checkJs：Host 模块的 JSDoc 类型检查
npm test          # node:test：解析 / 数据层 / HTTP / 设置偏好 / 导入导出 / UI 渲染 / 并发写入（497 用例）
npm run test:coverage  # 同上 + Node 内置覆盖率（--experimental-test-coverage）
npm run audit     # client.js 静态审计（37 项）
npm run verify    # 以上全套（build + check + lint + typecheck + test + audit；prepublishOnly 同）
```

覆盖内容：

- `test/parse.test.mjs`（79 用例）：多条拆分、分类标记最左优先且全部剥离、`@文件` 与 `@分类` 判定、文件路径归一化/拒绝绝对与穿越路径、分类派生规则、**优先级标记**（`!high/!medium/!low`、别名与中文、最左优先、`!important` 不误判）、**类型标记**（`^bug/^feature/...`、中文别名、`类型：bug`/`type:bug`、未知值不误判）、工具 `quick_add` 路径。
- `test/smoke.test.mjs`（174 用例）：创建/校验/完成/重复完成/取消完成/重复取消/改名/删除/筛选/排序（含空值置尾）/stats、时间格式与空值、损坏 JSON 备份重建、结构异常 JSON 归档、重复 id 拆分、记录修复（缺 createdAt、完成早于创建、非法状态、非法 priority/type）、修复提示只投递一次、持久化重载、`resolveDataFile` 优先级、分类校验/归一化/筛选/统计/按分类排序（未分类置尾）、**priority/type 校验/归一化/部分更新**、按优先级排序（未设置置尾）、`files` 校验与派生分类、v1–v4→v5 迁移落盘、不支持版本归档。
- `test/http.test.mjs`（77 用例）：真实 HTTP 服务上的 prefix 路由、GET health、错误码映射（400/404/405/409）、非法 JSON、数组 body、「HTTP 写入后重新加载可读」，分类/优先级/类型的非法值 400、`sortBy=priority`、只改 priority/type，以及 `/quick-add`（多条 + `#分类` + `@文件` + `!优先级` + `^类型` 标记与表单回退）、`/create` 带 `files`/`priority`/`type`、`/files` 无文件服务时 501；宿主认证（`authorize` 返回 401 → 所有路由 401 + `UNAUTHORIZED` 信封、403 → 403、admission 抛错 → 403、放行 → 正常）。
- `test/settings.test.mjs`（15 用例）：偏好存储的纯函数与文件语义 —— 默认 `quickEntry: true`、`resolveSettingsFile()` 与数据文件同目录同主名、`normalizeSettings()` 在缺失/非法类型时回落默认且同时接受扁平与信封两种形态、`normalizeSettingsPatch()` 只收已知键且类型必须是布尔、文件不存在时读默认且不写盘、`update()` 落盘为带 `version` / `updatedAt` 的信封且 `read()` 能读回、新实例从磁盘读到同一偏好（跨浏览器语义）、非法补丁不写盘、空补丁是无害 no-op、损坏 JSON 回落默认 + warn 且下一次写入覆盖它、**并发写入串行化且 last-write-wins（30 轮确定性）**、**并发交替读写后磁盘与缓存一致**、写入失败返回 `SETTINGS_WRITE_FAILED`（目标路径被目录占用）、`describe()` 暴露文件路径与最近一次写入错误。
- `test/http-settings.test.mjs`（9 用例）：真实 HTTP 服务上的偏好路由 —— 偏好文件与数据文件同目录同主名、`GET /settings` 落到 health 的 GET 分支返回 405（偏好只支持 POST）、没有偏好文件时 `POST /settings` 返回默认开、`POST /settings/update` 写 `false` 并落盘到 `todos.settings.json`、非法类型 400 `SETTINGS_INVALID` 且不改磁盘、写回 `true`、未知键被忽略而已知键照常写入、宿主没有设置存储时 501 `SETTINGS_UNAVAILABLE`、设置路由不影响待办路由（`/health` 与 `/create` 仍正常）。
- `test/transfer.test.mjs`（42 用例）：JSON 信封的导出/回导、CSV 的 BOM/CRLF/逗号与引号转义、`files` 分号分隔、耗时派生列、本地时间解析、中英文表头别名、v1 迁移、裸数组、重复 id 取新、非法行计数与行号、空内容/坏 JSON/版本不支持/缺标题列/未知格式拒绝。
- `test/store-import.test.mjs`（36 用例）：`dryRun` 不写盘、合并（新者胜/旧者跳过）、仅新增、覆盖全部 + 备份文件、撤销恢复 + 安全备份、`refresh()` 合并另一实例写入、备份名与路径穿越校验、5000 条上限。
- `test/http-transfer.test.mjs`（35 用例）：`/export` JSON/CSV 内容与元信息、非法格式 400、`/import` dryRun/正式导入/重复导入/CSV/错误码/未知模式回退、`/restore` 回滚与非法文件名 400。
- `test/store-concurrency.test.mjs`（8 用例）：两个实例交错写同一数据文件时 mtime 合并、同 id 取 `updatedAt` 较新者、`Promise.all` 并发写不损坏不丢、tombstone 防删除复活、陈旧锁清理、锁占用超时后下次写入补齐、写前发现损坏数据不重复归档。
- `test/ui/panel.test.mjs`（10 用例）：jsdom + 真实 React 18 渲染构建产物 `lib/client.js`；覆盖页头/新建框/四视图分段/筛选计数、表格行与时间格式、固定两行工具栏、空态、错误态与重试恢复、看板切换与两列、甘特四档范围与「现在」标记、**「数据」对话框的打开 / 文件预览 / 策略切换 / 确认导入 / 撤销**、行尾「⋯」删除二次确认 + 撤销、「对话录入并入 composer」的批量模式、导入对话框有文件时遮罩与 `Esc` 不关闭。jsdom 无布局/绘制，视觉回归仍需真机或 Playwright（本轮未接入）。
- `test/ui/quick.test.mjs`（12 用例）：jsdom 渲染构建产物，同时渲染 main 面板与 `conversation.composer.dock` 的胶囊、`conversation.input.overlay` 的清单卡片；覆盖胶囊计数与 `aria-expanded`、点开清单（行 / 已进行时长 / 勾选圈 / 「打开完整面板」）、勾掉完成 + 撤销（`/complete` → 行即时移除、计数回落；撤销走 `/uncomplete` 并刷新）、快速新建（Enter → `/quick-add` → 刷新 + 撤销走 `/delete`）、空态（无计数、给出出口）、错误态与重试、`Esc` 关闭并回焦胶囊、`layout.selectPanel('dsh-todo-time-log')`；**开关**：面板页头「设置」默认收起、点开出现设置卡（标题/`Host` 提示/开关行），`role="switch"` + `aria-checked`，关掉写 `/settings/update {quickEntry:false}` 且两个槽位一起卸载（`aria-checked` 回落），重开写回 `true` 并恢复胶囊；偏好为关时首屏不挂载；读取失败 fail-open（按默认开挂载 + 设置卡里 `role="alert"` 显示原因）；写入失败不翻转开关、胶囊保留并显示保存失败原因。
- `test/client-audit.mjs`（37 项，`npm run audit`）：i18n zh/en 成对与占位符一致、无死键/未声明键、只 `require('react')`、无 `document`/DOM 查询、无硬编码颜色、类名 `ttl-` 前缀、四视图与各渲染器存在、6×7 日历、模块加载器格式与双槽位注册、**快速入口两槽位 + `ttl-quick-*` 样式 + 复用既有 `/quick-add` `/complete` `/uncomplete` 路由**、**面板页头设置入口（`ttl-settings-trigger`）+ 设置卡（`.ttl-settings`）+ `ttl-pref-switch` 样式 + 复用 `/settings` `/settings/update` 路由**。当前口径：**317 键/语言、28 个 alias token、291 个 `ttl-` className**。
- `test/live-utf8.py` / `test/live-projects.py`：对**运行中实例**的真实往返（中文标题、分类筛选、迁移版本落盘、清理测试数据），需设置 `DSH_WEB_URL`（默认 `http://127.0.0.1:52283`）。

**CI（`.github/workflows/ci.yml`）**：push / PR 触发，矩阵 Node 20 / 22 / 24 × Ubuntu / Windows，依次跑 `check`、`lint`、`typecheck`、`build`、`test`、`audit`；Linux 上额外用 `git diff --exit-code -- lib/client.js` 校验构建产物与源码同步，另有 Node 24 覆盖率 job。发布工作流同样先 `npm ci` 再跑 `build` + 测试 + 审计。

### 5.2 手工验证（智能体工具）

工具注册后可直接在会话里调用：

```text
todo_time_log { "action": "create", "title": "写插件文档" }
todo_time_log { "action": "create", "title": "写周报", "priority": "high" }
todo_time_log { "action": "create", "title": "修复登录", "priority": "high", "type": "bug" }
todo_time_log { "action": "update", "id": "ttl_…", "type": "feature" }
todo_time_log { "action": "update", "id": "ttl_…", "priority": "low" }
todo_time_log { "action": "complete", "id": "ttl_…" }
todo_time_log { "action": "complete", "id": "ttl_…" }   # 期望：ALREADY_COMPLETED 提示
todo_time_log { "action": "uncomplete", "id": "ttl_…" }
todo_time_log { "action": "list", "filter": "pending", "sortBy": "createdAt", "direction": "asc" }
todo_time_log { "action": "list", "sortBy": "priority", "direction": "asc" }
todo_time_log { "action": "delete", "id": "ttl_…" }
```

实际输出示例：

```text
[已完成] 写插件文档：目录结构与数据模型｜创建 2026-11-03 08:37:49｜完成 2026-11-03 08:37:50｜id ttl_mvzyl2w302jtfbqu
操作失败（ALREADY_COMPLETED）：该待办已完成（完成时间 2026-11-03 08:37:50），无需重复操作
```

### 5.3 手工验证（HTTP / UI）

```bash
curl -s http://127.0.0.1:<port>/api/dsh-todo-time-log/health
curl -s -X POST http://127.0.0.1:<port>/api/dsh-todo-time-log/create \
     -H 'content-type: application/json' -d '{"title":"验证"}'
```

> Windows 终端直接 `curl -d "中文"` 可能按 GBK 发送造成乱码；用 `python`/`node` 发 UTF-8 JSON。

UI 手测清单（阶段一）：

新建（Enter 与按钮）→ 列表出现且「完成」列为 `-` → 标记完成 → 完成时间出现 → 取消完成 → 完成时间回到 `-` → 行内编辑（Enter 保存 / Esc 取消）→ 删除（行内二次确认）→ 筛选三态 → 排序（创建/完成 × 升降序）→ 刷新页面数据仍在。

UI 手测清单（二期，**需先刷新页面**加载新 client.js）：

1. **甘特图**：切到「甘特图」→ 每行一根条（创建 → 完成 / 现在），右侧「用时」列常显，进行中为蓝点 + 已进行时长；时间轴自适应面板宽度，右侧「现在」红线与标签始终可见；分类组头可点击折叠，并显示「N 条 · 进行中 M · 已完成用时 X」；范围支持今天 / 近 7 天 / 近 30 天 / 全部（按本地自然日 00:00 对齐）；行尾 › 展开详情；无数据时显示空态。
2. **分类**：新建时填分类（或用 datalist 选已有分类）→ 行上出现分类徽标；工具栏分类筛选选「工作」只剩该分类，选「未分类」只剩 `project=''`；行内编辑同时改标题与分类并保存；`排序=分类` 时列表按分类分组；详情里能看到分类。
3. **对话录入**：展开「对话录入」→ 输入 `帮我记一下 写周报 #工作；买牛奶 @生活` 发送 → 助手气泡列出两条（带分类与创建时间）→ 点「撤销」两条消失并提示「已撤销 2 条」；输入只有填充词（如「帮我记一下」）→ 提示示例；输入 `[] 空分类测试` → 标题为「空分类测试」且归入未分类。

UI 手测清单（三期四视图，**需先刷新页面**）：

1. **视图切换**：四个按钮「表格/看板/甘特图/日历」切换正常，默认表格；先设好筛选=未完成、排序=创建时间、分类=工作，再逐个切换视图，回到表格后这些条件仍在。
2. **表格**：点「创建时间」表头 → `aria-sort` 与箭头/方向变化，工具栏排序 select 同步；再点一次方向反转；窄屏下表格横向滚动且不撑破页面；行内编辑改标题与分类能保存；删除需二次确认；展开详情能看到分类/创建/完成/更新/用时/id。
3. **看板**：切「按状态」→ 未完成/已完成两列且计数正确；切「按分类」→ 各分类列 + 未分类列（未分类在最后）；卡片上点完成/编辑/删除都能生效；列内条目多时列内滚动。
4. **甘特图**：点某行标签或行尾 › → 展开行内详情并可完成/编辑/删除；切范围后条、组头聚合与用时列同步变化；折叠的分类在切换视图再回来时保持折叠。
5. **日历**：月标题正确、周一起始、前后月补格弱化、今天有标记；点「上一月/下一月」翻月、「今天」回到当月；切「按完成时间」→ 未完成条目不再出现在格子里；每格最多 3 条且有「+N」；点某天在下方看到该天全部条目并可直接完成/编辑/删除。

UI 手测清单（视觉重构：层级 + toast，**需先刷新页面**）：

1. **层级**：打开面板第一眼应是「标题 → 新建待办 → 数据卡片」三层；页面级只有一个实心按钮「添加」（对话录入展开后，其卡片内的「发送」属于该卡片自己的操作区）；统计数在 `全部/未完成/已完成` 分段上，不再有单独的统计小卡片。
2. **完成反馈（重点）**：点任意一行的「完成」→ 面板底部浮出深色 toast（勾 + 「已标记为完成。」+「撤销」）→ **表格与页头不应上下跳动**（可观察表格第一行的纵坐标）；点「撤销」→ 该行回到未完成、toast 变为「已取消完成。」；点 × 或等待 3.5s 自动消失。
3. **错误反馈**：断开 Host（或让 `/list` 失败）→ 卡片内显示「加载失败 + 重试」，同时底部出现红色图标的错误 toast；两者都不改变布局高度。
4. **分段控件**：视图与筛选都是分段控件，选中态有浅底+阴影；方向按钮点一次在 ↑/↓ 间切换，`aria-label` 里写明当前方向；窄面板下工具栏换行、表格在卡片内部横向滚动。
5. **空态**：删光待办 → 卡片内显示「还没有待办」+「新建第一条待办」，点按钮焦点跳到新建输入框；筛选到没有结果时按钮变为「查看全部待办」，一次点击同时清掉状态筛选与分类筛选；四个视图（表格/看板/甘特图/日历）的空态都有这个出口按钮。
6. **明暗主题**：切换宿主明暗主题，卡片边框、分段控件、状态徽标、toast 都要有足够对比度。

UI 手测清单（四期 @文件 + 对话添加，**需先刷新页面**）：

0. **工作区**：打开「对话录入」→ 标题行应显示工作区选择器（默认当前会话工作区，可下拉切换）→ 切换后 `@` 补全的文件列表随之变化。
1. **@ 补全**：输入框敲 `@` → 出现工作区文件下拉（显示本仓库文件）→ 继续输入 `lib/s` 过滤 → ↑↓ 移动、Enter 选中 → 文本变成 `@lib/store.js `；Esc 可关闭；无匹配时显示「无匹配文件」；含空格的文件选中后应插入 `@"…"` 引号形式。
2. **@文件自动分类**：发送「新任务 写周报 #工作 @lib/store.js」→ 助手气泡显示 `[工作] 写周报 · 创建 …` + 文件 chip；再发送「修复甘特图 @lib/client.js」（不带 #分类）→ 分类自动为 `lib`。
2b. **分类点选**：新建表单的分类下拉应能直接看到「已用 / 工作区 / 文件夹」三组（工作区组里是 `dsh-todo-time-log`、`File_Manager_Legacy` 等），选一个即可创建，不用手打；选「自定义…」才出现文本框；行内编辑用同一个下拉；对话里输入 `#` 会弹出同样的分类补全。
3. **多条与跳过**：发送「买牛奶 @生活；回邮件 [工作]」→ 一次添加 2 条；只发送「帮我记一下」→ 提示没有可添加内容。
4. **撤销**：点气泡里的「撤销」→ 刚添加的条目消失并提示「已撤销 N 条」。
5. **文件 chips**：表格行标题旁有紧凑附件标识、展开详情能看到完整文件列表；看板卡片显示 1 个文件 chip +「+N」；甘特行内详情、日历当天条目详情都能看到完整文件；点击 chip 会复制完整路径（提示「已复制路径」）。
6. **`/todo` 命令**：在 Harness 主输入框输入 `/todo 新任务 写周报 #工作 @lib/store.js` → 回执列出新建待办（不进入模型对话）。
7. **兼容**：既有旧待办（无 files）在各视图正常显示，不出现空 chip；分类筛选/排序/四视图切换不受影响。

UI 手测清单（六期：看板改版，**需先刷新页面**；预览见 [`docs/preview/04-board.png`](./preview/04-board.png) / `12`–`15`）：

1. **卡片摘要化**：切到看板 → 每张卡只有一个完成 checkbox + 标题 + 一行元信息（分类点 + 「已进行 / 用时」）+ 最多 1 个文件 chip；状态徽标只在「按分类」分组时出现。用时核对：已完成卡 = 完成时间 − 创建时间；未完成卡 = 现在 − 创建时间（约 60s 刷新一次）。
2. **操作收敛**：点卡片右上「⋯」→ 展开「编辑 / 优先级 / 删除」（按分类分组时还有「移到分类」）；点编辑进入标题 + 分类 + 优先级行内编辑（Enter 保存 / Esc 取消）；点删除出现「删除后无法恢复。」二次确认；`Escape` 可关闭更多操作与删除确认。
3. **列头与收纳**：未完成/已完成列头有状态点、名称、计数；「＋」在未完成列/分类列点击后聚焦顶部新建框（分类列会预填该分类）；已完成列默认最近 10 条，滚到底显示「显示全部（N）」，展开后可「只看最近 10 条」。
4. **筛选不再静默失效**：先在表格选「已完成」再切看板 → 工具栏仍显示同一筛选且看板只剩已完成列有内容；空列显示「没有符合筛选的待办」；点「全部」恢复。
5. **搜索**：输入「部署」→ 只剩匹配卡片并显示「1 条匹配」；输入不存在的词 → 「没有匹配「…」的待办」+「清除搜索」；按 `Escape` 清空搜索。
6. **窄屏**：把面板拖窄到 <560px → 看板从两列变为单列纵向堆叠，列头置顶，不再需要横向滚动。

UI 手测清单（七期 A/B/C：泳道 / 移动 / 优先级 / 密度 / 快捷键 / v4 迁移，**需刷新页面**；预览见 [`docs/preview/16`](./preview/16-board-swimlanes.png)–[`18`](./preview/18-board-move.png)）：

1. **泳道**：分组选「状态 × 分类」→ 两列固定，列内按分类分泳道；点泳道头折叠/展开（`aria-expanded`），未完成泳道「＋」会预填该分类并聚焦顶部新建框；未分类泳道排最后。
2. **移到分类**：按分类分组或泳道模式 → 卡片「⋯」→「移到分类…」选另一个分类 → 卡片换列，toast「已移到「x」」带「撤销」；撤销后回到原分类。
3. **优先级**：新建框的「优先级」下拉选「高/中/低」→ 创建后卡片显示对应徽标（高红 / 中橙 / 低灰，均带文字）；「⋯」里的优先级 select 可直接改并 toast 撤销；展开详情能看到优先级；表格状态列显示徽标；表格排序下拉有「优先级」；快捷添加 `写周报 !high` / `!h` / `!高` 生效且标题不残留标记。
4. **密度**：看板工具栏「密度」选「紧凑」→ 标题 1 行、文件 chip 与分类名隐藏、卡片变矮；切回「舒适」恢复；切到其它视图再回来密度仍保持。
5. **快捷键**：焦点在面板空白处按 `/` 聚焦搜索、`n` 聚焦新建、`f` 循环切换筛选；焦点在输入框/下拉里时这些键不触发。
6. **v4 迁移**：旧 `version: 3` 数据文件加载后首次写入变为 `version: 4`，旧待办 `priority` 为空且无报错；`/list?sortBy=priority` 未设置项始终排最后；`update {priority:"urgent"}` 返回 400 `PRIORITY_INVALID`。

UI 手测清单（八期：类型标签，**需刷新页面 + 重启插件**）：

1. **快捷标记**：`/todo 修复登录 #工作 !high ^bug` → 回执与面板卡片都显示「缺陷 + 高」徽标，标题不含标记；也可写 `类型：bug` / `type:bug` / `^新功能` / `^缺陷`。
2. **类型 UI**：新建框「类型」下拉选「新功能」→ 创建后卡片/表格/详情显示蓝色「新功能」徽标；「⋯」里的类型 select 直接改并 toast 撤销；行内编辑也能改。
3. **筛选与搜索**：工具栏「类型筛选」选「缺陷」→ 只剩类型为缺陷的条目（清空筛选恢复）；搜索「缺陷」也能命中类型名。
4. **`@` 菜单点选（不用手打标记）**：在主输入框草稿以 `/todo ` 开头时输入 `@` → 菜单出现「待办分类 / 待办优先级 / 待办类型」三组；选中「高」插入 `!high `、选中「缺陷」插入 `^bug `，继续输入标题即可。
5. **v5 迁移**：v4 数据文件首次写入后变 `version: 5`，旧待办 `type` 为空；`update {type:"urgent"}` 返回 400 `TYPE_INVALID`。

UI 手测清单（九期：导入 / 导出，**需重启插件 + 刷新页面**）：

1. **导出**：点页头「数据」→ 分别导出 JSON / CSV；JSON 能被文本编辑器打开且 `version: 5`；CSV 用 Excel/WPS 直接打开，中文不乱码、`耗时(分钟)` 列有值、未完成项的完成时间与耗时为空白。
2. **预览**：导出的 JSON 原样再导入 → 预览应显示「新增 0 / 更新 0 / 跳过 N」，说明无损回导；手工改一条标题或 `updatedAt` 后再导入 → 预览显示「更新 1」。
3. **策略**：把策略切到「仅新增」→ 预览「跳过 N」；切到「覆盖全部」→ 预览出现「移除」计数；确认后列表只剩文件里的记录，数据目录出现 `<dataFile>.bak-<时间戳>`。
4. **撤销**：导入结果 toast 点「撤销」→ 列表恢复到导入前，并再生成一份安全备份。
5. **CSV 导入**：用 Excel 新增一行（标题、分类、状态「未完成/已完成」、优先级「高/中/低」、类型「缺陷/新功能…」、创建时间 `YYYY-MM-DD HH:mm:ss`），另存为 CSV 后导入 → 预览与列表都能正确识别中文值。
6. **异常**：导入空文件 / 坏 JSON / 版本 99 / 缺少标题列的 CSV → 对话框内给出明确错误且不写盘；恢复不存在的 `.bak-*` 返回「备份文件名不合法」提示。
7. **并发**：打开第二个 DSH 窗口写入一条待办后，在第一个窗口直接导出 → 导出内容应包含第二条（导出前会先合并磁盘写入）。

UI 手测清单（十四期：快速入口胶囊 + 清单，**需刷新页面**；设计基线见 [`docs/design/quick-entry.md`](./design/quick-entry.md)）：

1. **胶囊计数**：主输入框下方应有常驻「待办」胶囊，右侧数字 = 未完成条数；在面板里勾掉 / 新建一条后，60s 内胶囊计数跟随（或点开清单一次即刷新）；未完成 0 条时胶囊只剩「待办」、不显示数字，但仍在（还能用它记一条）。
2. **展开**：点胶囊 → 清单在输入框**上方**弹出（`role="dialog"`），只列未完成、按创建时间升序，每行有勾选圈、标题、已进行时长与分类点；`aria-expanded` 变 `true`，焦点落到清单里的新建输入框。
3. **勾掉 + 撤销**：勾一行 → 该行立即消失、胶囊计数 -1、卡片底部提示「已完成 · 用时 X」并带「撤销」；点「撤销」→ 该行回到列表（走 `/uncomplete`），提示不推动列表高度。
4. **新建 + 撤销**：清单输入框输入 `买牛奶 #生活` 按 Enter → 列表出现该条、提示「已添加 1 条待办」；点「撤销」→ 刚建的那条被删掉；空输入时「添加」按钮禁用；`#分类 !优先级 ^类型` 与面板同一套解析。
5. **空态**：把未完成全部勾掉 → 清单显示「没有进行中的待办」+「在上面记一条，或打开完整面板。」，不渲染列表。
6. **错误态与重试**：让 `/list` 失败（断开 Host）→ 清单显示「加载失败」+ 原因 + 「重试」；胶囊计数保持上一个值、不清零；恢复后点「重试」→ 列表回来。
7. **Esc**：焦点在清单里按 `Esc` → 清单关闭且焦点回到胶囊（再按 Enter / 空格能重新打开）；点 × 也关闭。
8. **打开完整面板**：点清单底部「打开完整面板」→ 切到待办面板，清单同时关闭。
9. **明暗主题**：切换宿主明暗主题 → 胶囊、卡片、提示条、勾选圈的边框与文字对比度正常，无硬编码颜色。
10. **窄屏**：窗口拖到 ~560px → 胶囊不挤出、清单宽度不超过视口（`min(420px, 100%)` + `max-width: calc(100vw - 32px)`）、不被 docked composer 裁切。
11. **静默刷新**：另一个窗口新建一条待办 → 本窗口清单在 60s 内出现该条（打开清单时也会立即刷新一次）；「进行中 X」每 30s 走本地时钟，不发请求。

UI 手测清单（十五 / 十六期：快速入口开关 —— 在**待办面板页头 → 设置**里；**需先重启插件**加载 `/settings` 路由 + **刷新页面**）：

1. **设置入口与开关**：打开待办面板 → 页头右侧有「设置」按钮（`aria-controls="ttl-settings-panel"`，默认 `aria-expanded="false"`，点开为 `true`）→ 展开的设置卡里是「主输入框下方的待办快捷入口」+ 说明 + 右侧开关，**默认开**（`aria-checked="true"`）；卡头右侧显示「保存在本机，换浏览器也一样」。
2. **关掉**：点开关 → 胶囊与清单立即消失（两个槽位都卸载），`aria-checked` 变 `false`；打开 DevTools Network，60s 内不再有 `/list` 请求；面板、`/todo` 命令、待办数据都正常。
3. **重开与 Esc**：再点一次开关 → 胶囊立即回来、计数与清单内容正确，60s 轮询恢复；焦点在面板空白处按 `Esc` → 设置卡收起（`aria-expanded` 回落），偏好状态保持不变；刷新页面后状态保持（偏好已落盘 `todos.settings.json`）。
4. **偏好跨窗口共享**：在窗口 A 关掉开关 → 窗口 B 刷新后同样不显示胶囊（偏好存在 Host 侧，不是 localStorage）；再在 B 打开 → A 刷新后也恢复。
5. **容错**：把 `todos.settings.json` 改成坏 JSON（或删掉）→ 打开设置卡不崩、按默认开；读取失败（`/settings` 不可用、网络错误）时设置卡里显示「读取设置失败，暂按默认（开）处理：…」且胶囊照常挂载；写入失败时开关不翻转、胶囊保留，并显示「保存失败，已保持原状态：…」。

---

## 发布 npm 版本

发布由 GitHub Actions 工作流 [`.github/workflows/publish.yml`](../.github/workflows/publish.yml) 自动完成：
推送形如 `v0.5.2` 的 tag 时，工作流会校验 tag 与 `package.json` 版本一致、先 `npm ci`，再跑 `npm run check`、`npm run build`（并用 `git diff` 校验产物与源码同步）/ `npm test` / `npm run audit`、打包预演，
再通过 **npm 可信发布（OIDC，无需 NPM_TOKEN）** 发布并自动创建 GitHub Release。

```bash
# 日常发版：改版本 → 打 tag → 推送
npm version patch -m "chore: release v%s"   # 或 minor / major
git push origin main --follow-tags
```

> npm 2026 起已限制 bypass-2FA token「直接发布」（`EOTP`），自动化发布必须走 **staged publishing + OIDC**。

首次建包：npmjs.com 生成 granular token 存为仓库 secret `NPM_TOKEN` → Actions → Publish to npm → Run workflow（mode=`stage`）
→ 到 npmjs.com 包页 **Staged Packages → Approve**（2FA）→ 配 Trusted Publisher（工作流文件名 `publish.yml`，勾选允许 `npm publish`）→ 删除 token。
之后 tag 推送即全自动；工作流还支持 mode=`publish`（OIDC 直接发布）与 mode=`dry-run`（只预演）。
完整步骤、版本策略、回滚与排错见 [`publishing.md`](./publishing.md)。

[![Publish to npm](https://github.com/FantasyStarry/dsh-todo-time-log/actions/workflows/publish.yml/badge.svg)](https://github.com/FantasyStarry/dsh-todo-time-log/actions/workflows/publish.yml)
