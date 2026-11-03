# 看板视图现状审计（kanban current state）

> 审计对象：`dsh-todo-time-log@0.3.1`（当前工作区，**无 git**、无第三方依赖、纯 ESM + 注入 React）。
> 审计日期：2026-11-03。方法：逐段读取 + `grep -n` 定位 + 实际运行静态门禁。
> 所有行号均指当前工作区文件内容；标「推断」的结论没有直接代码证据，需要实现前再确认。

## 0. 基线与复核方法

| 项目 | 值 | 证据 |
| --- | --- | --- |
| `lib/client.js` | 5548 行 | `wc -l` |
| i18n key 数 | 194 / 语言（zh、en 各 194） | `node test/client-audit.mjs` 输出 |
| 静态门禁 | 28 项全部 PASS | 同上，退出码 0 |
| 已用 `--dsw-alias-*` token | 24 个（去重） | audit 输出 `alias tokens: 24` |
| CSS 类名 | 160 个，全部 `ttl-` 前缀 | audit 输出 `class names: 160` |
| 宿主可用 alias token | 107 个（从本机 `app.asar` 的 `@deepseek-ai/dsh-client-ui-theme/lib/client.js` 抽取，随宿主版本可能变化） | 见 §3.2 |
| 数据模型 | v3（`version: 3`） | `lib/store.js:44-47`、`README.md:87-99` |

复核命令（不修改任何文件）：

```bash
node test/client-audit.mjs     # 28 项静态门禁
npm run check                  # 六个 lib 文件的 node --check
grep -n "ttl-board" lib/client.js
```

---

## 1. 现有看板：结构、交互、数据流

### 1.1 入口与工具栏

- 四视图常量：`lib/client.js:1078-1083`（`table / board / gantt / calendar`，`labelKey` 走 `view.*`）。
- 视图切换控件 `viewToggle`：`lib/client.js:4948-4964`，`.ttl-seg` + `aria-pressed`，无路由、无 URL 状态。
- 视图状态 `const [view, setView] = React.useState('table')`：`lib/client.js:3372`；看板分组状态 `boardGroupBy`（默认 `'status'`）：`lib/client.js:3383`。两者都**只在内存**，刷新页面回到默认（无 localStorage/sessionStorage，`grep localStorage` 命中 0 次）。
- 看板专属工具栏控件：`boardGroupSelect`（`lib/client.js:5012-5027`），选项来自 `BOARD_GROUPS`（`lib/client.js:1084-1087`：`status` / `project`）。
- 工具栏挂载逻辑：`view === 'table' ? filterTabs : view === 'board' ? boardGroupSelect : …`（`lib/client.js:5231-5237`）。**看板下状态筛选分段（全部/未完成/已完成）不渲染**，排序字段选择器与方向按钮也只在表格出现（`lib/client.js:5243-5244`）。
- 分类筛选下拉在**所有视图**都渲染：`lib/client.js:5242`（`projectFilterSelect`，定义 `lib/client.js:4966-4993`）。

### 1.2 分组模型 `boardColumns`

`lib/client.js:994-1012`：

| 分组方式 | 列来源 | 列顺序 | 列 key |
| --- | --- | --- | --- |
| `status`（默认） | 按 `todo.status === 'completed'` 二分（`1004-1007`） | 固定「未完成」→「已完成」（`1008-1011`） | `status:pending` / `status:completed` |
| `project` | `groupByProject(todos, t => t.project)`（`996`） | 分类名升序、未分类（`''`）最后（`886-905` + `compareProjectNames` `844-853`，`localeCompare(…, 'zh')`） | `project:${name}`（未分类是 `project:`） |

- 列标签：状态列直接用 `t('row.pending')` / `t('row.completed')`；分类列用 `projectLabel()`（`lib/client.js:838-841`，未分类 → `t('project.none')`）。
- **没有排序/方向入参**：列内顺序完全等于 `/list` 返回顺序，而看板固定请求 `sortBy=createdAt, direction=desc`（见 §1.6），因此列内恒为「新建的在前」。
- 没有折叠/收起、没有 WIP 上限、没有泳道（swimlane，即「状态 × 分类」二维矩阵）能力。

### 1.3 卡片 `renderBoardCard`（`lib/client.js:4623-4667`）

DOM 结构（自上而下）：

| 区块 | 代码 | 说明 |
| --- | --- | --- |
| 根节点 | `4626-4637` | `<article class="ttl-board-card" data-status=… aria-label=…>`；`aria-label` 由 `t('board.cardAria', {title, project, status})` 合成（`4632-4636`） |
| 编辑态 | `4638-4639` | `editingId === todo.id` 时用 `.ttl-board-edit` 包裹 `titleInput()` + `projectInput()`（`lib/client.js:4221-4243`），**不显示**徽标/时间/文件/操作（操作区改为保存/取消，`4273-4297`） |
| 标题 | `4640-4644` | `.ttl-board-card-title`，2 行截断（CSS `2234-2244`，`-webkit-line-clamp: 2`），`title=` 属性带全文 |
| 徽标行 | `4645-4650` | `ProjectBadge`（`lib/client.js:2634-2638`）+ `statusBadge()`（`lib/client.js:4214-4219`） |
| 时间行 | `4651-4661` | `.ttl-board-card-meta`：`创建 <formatTime>`、`完成 <formatTime 或 '-'>`；`formatTime` 见 `lib/client.js:467-475` |
| 文件 chips | `4662-4664` | 有文件才渲染 `.ttl-board-card-files`，`renderFileChips(todo, { max: 2 })`（`lib/client.js:4397-4414`）→ 第 3 个起折叠为 `+N`（`files.more`），点击 chip 复制相对路径（`4375-4394`） |
| 操作区 | `4665` | `renderActionButtons(todo, { showDetail: false })`：完成/取消完成、编辑、删除（二次确认）、编辑态保存/取消（`4266-4372`） |

补充事实：

- `data-status` 属性（`4631`）**没有对应的 CSS 选择器**（只有 `.ttl-row[data-status]` 在 `1586`、`.ttl-gantt-dot[data-status]` 在 `1942`）。属于「看起来能用、实际未使用」的属性（日历条目 `4796` 同理）。
- 卡片不是可聚焦元素（无 `tabIndex`，全文件仅甘特图滚动区有 1 处 `2741`），键盘用户只能通过卡内 3 个按钮操作，**无法选中/移动卡片**。

### 1.4 容器 `renderBoardView`（`lib/client.js:4669-4701`）

```
.ttl-board[role=list][aria-label=board.aria]               4678-4680
└─ section.ttl-board-column[role=listitem] × N             4682-4699
   ├─ header.ttl-board-column-head                         4685-4690
   │  ├─ span.ttl-board-column-title  ← column.label       4688   ★无 CSS 规则
   │  └─ span.ttl-board-column-count  ← String(length)     4689
   └─ div.ttl-board-column-body                            4691-4697
      ├─ p.ttl-board-column-empty（空列）                   4694-4695
      └─ article.ttl-board-card × M                        4696
```

- 全量空态：`todos.length === 0` → `TextPlaceholder`（`lib/client.js:4670-4676`，组件在 `1015-1033`），标题 key `board.empty`，出口按钮 key 由 `emptyActionKey` 决定（`lib/client.js:3585-3598`：有筛选时「查看全部待办」，否则「新建第一条待办」并聚焦顶部输入框）。
- `.ttl-board-column-title`（`4688`）**在 CSS 里没有定义**（`grep -n "ttl-board-column-title"` 只有这一处命中）——列头文字实际继承 `.ttl-board-column-head` 的 `12px/500/label-secondary`（`2197-2208`）。这是死类名，不是 bug 但不该被误当成已有样式钩子。
- 布局：`display:flex; gap:12px; overflow-x:auto`（`2180-2186`）；每列 `flex:1 0 240px; min-width:240px; max-width:380px`（`2187-2196`）；列体 `max-height:56vh; overflow-y:auto`（`2210-2217`）。
- 挂载点：`listBody` 的 `view === 'board'` 分支（`lib/client.js:4883-4884`）→ `.ttl-list`（`5253`）→ `.ttl-data` 卡片（`5221-5254`）；看板在数据卡内额外有 `padding: 12px 12px 16px`（`1347`）。

### 1.5 交互（全部走 Host HTTP，无本地状态变更）

| 交互 | 实现 | 关键行 |
| --- | --- | --- |
| 完成 / 取消完成 | `handleToggle`：`POST /complete` 或 `/uncomplete` → 成功 toast（完成带「撤销」，回调用 uncomplete 再切回）→ `reload(true)` | `3664-3686`；撤销回调 `3672-3676` |
| 开始编辑 | `startEdit`：设 `editingId/editTitle/editingProject`，并清掉删除确认 | `3695-3702` |
| 保存编辑 | `saveEdit`：前端先按服务端规则归一化（`normalizeTitleInput/normalizeProjectInput` `832-835`/`823-829`），校验空标题与 40 字上限 → `POST /update`（**只传 id/title/project，不传 files**）→ `reload(true)` | `3704-3735` |
| 键盘 | `Enter` 保存、`Esc` 取消（`handleEditKeyDown`） | `3737-3748` |
| 取消编辑 | `cancelEdit` 清三个 state | `3688-3693` |
| 删除 | 两段式：先 `setConfirmId(id)` → 出现「确认删除 / 取消」→ `POST /delete` → `reload(true)` | `4329-4370` + `3750-3765` |
| 忙碌门 | 全局单值 `busyId`（+ `creating`），一次只有一条待办在忙；所有按钮 `disabled={isBusy}` | `3582`、`4281`/`4292`/`4306`/`4322` |
| 复制文件路径 | `navigator.clipboard.writeText`，不可用时静默 | `4375-4394` |
| 刷新 | `reload(quiet=true)` 静默全量重取，不置 loading 态 | `3536-3544`、`3465-3484` |

看板**不存在**的能力（逐项 grep 确认）：

- 拖拽：`grep "onDrag\|draggable"` 命中 0；README `258` 明确写了「不做拖拽，避免可访问性问题」。
- 列内手动排序 / WIP 上限 / 行内快速添加 / 搜索框 / 列折叠 / 泳道 / 卡片详情展开（`showDetail:false`，`4665`）。
- 看板不使用 `expandedIds`（只有表格与甘特图用，`3369-3370`、`3389`）。

### 1.6 数据流（看板链路）

```text
[React 挂载] useEffect(view/filter/sortBy/direction/projectFilter)       3526-3534
   └─ queryForView(view,…)  看板 → {filter:'all', sortBy:'createdAt', direction:'desc'}   1117-1122 / 1119
        └─ loadList(filter,sort,direction,project)                        3465-3522
             ├─ request('/list', body)  POST JSON                        536-587（apiUrl 523）
             │    body = {filter,sortBy,direction[, project]}             3474-3483
             └─ normalizeTodos / normalizeStats / normalizeProjects       773-781 / 784-797 / 856-883
                  └─ setTodos(…) → renderBoardView() → boardColumns()      3485-3492 → 4669 → 994
[用户操作] handleToggle / saveEdit / handleDelete
   └─ POST /complete|/uncomplete|/update|/delete → reload(true) → 回到 /list
```

Host 侧：

- 路由分发：`lib/index.js:794-813`（`CRUD_ACTIONS` 从 `49` 起，`EXTRA_PATHS` 在 `803`；全部 POST，GET 只允许 `/health`，`771-792`）。
- `executeTodoAction('list')`：`lib/index.js:235-244` → `store.list({filter,sortBy,direction,project})` 并追加 `timeFormat`。
- `store.list`：`lib/store.js:586-612`，返回 `{ ok, todos, stats, projects, filter, sortBy, direction, project, notices }`，`stats/projects` 始终按**全量**计算（`604-605`），与筛选无关。
- 客户端刷新竞态用单增序号丢弃旧响应：`requestSeq`（`3407`）、`seq !== requestSeq.current`（`3484`、`3512`）。
- 分类筛选透传：`/list` 的 `project` 省略=全部、`''`=只看未分类（`lib/store.js:592-599`，客户端 `3481-3482`）。
- 加载/失败/空：`4861-4869`（骨架屏 / 错误卡+重试 / 视图内容），错误同时进 toast（`3511-3516`）。

**关键结论**：看板是 `todos`（服务端已过滤+排序的扁平数组）的纯展示投影，**客户端没有任何独立数据缓存**；每个写操作都触发一次全量 `/list`（无乐观更新）。卡片 `key={todo.id}`（`4629`）且列节点复用，所以刷新后列内滚动位置通常保留（推断：仅当列数/顺序变化导致节点重排时才会重置）。

---

## 2. 数据能力与字段缺口

### 2.1 当前可用字段（Todo v3）

来源：`lib/store.js:4-17`（模型注释）、`lib/store.js:212-296`（`normalizeTodo` 校验修复）、`README.md:76-85`。

| 字段 | 类型 | 约束 / 归一化 | 看板是否展示 | 证据 |
| --- | --- | --- | --- | --- |
| `id` | string | `ttl_` 前缀、唯一；缺失/重复时重建 | 否（仅作 key） | `store.js:82`、`510-527` |
| `title` | string | 1–200，连续空白折叠、trim；空标题拒绝 | 是（2 行截断） | `store.js:53,95-111`；`client.js:4640-4644` |
| `project` | string | 0–40，控制字符/空白归一化；`''`=未分类；可由首个 `files` 目录派生 | 是（徽标；按分类分组时是列名） | `store.js:54,116-137,191-210` |
| `files` | string[] | 0–20，工作区相对路径（拒绝绝对/盘符/`..`），去重 | 是（最多 2 个 + `+N`） | `store.js:55-56,145-187`；`client.js:4662-4664` |
| `status` | `pending｜completed` | 非法值按 `pending` 兜底并提示 | 是（徽标 + 分组维度） | `store.js:47-50,219-225` |
| `createdAt` | ISO-8601 string | 缺失/非法按 now 补齐并提示 | 是 | `store.js:261-266` |
| `completedAt` | ISO-8601 \| null | 未完成恒 null；早于创建时间则钳到 createdAt | 是（未完成显示 `-`） | `store.js:271-285` |
| `updatedAt` | ISO-8601 string | 任何修改刷新 | 否（详情里有） | `store.js:287-290` |

**重要**：`normalizeTodo` 返回的是**新构造的对象字面量**（`lib/store.js:292-295`），磁盘上多出来的未知字段会在加载时被静默丢弃，并在下一次写入时永久消失。这是「先加字段、后改代码」不可行的根本原因（见 §2.4）。

### 2.2 接口能力

| 接口 | 能力 | 位置 |
| --- | --- | --- |
| `POST /list` | `filter`(all/pending/completed)、`sortBy`(createdAt/completedAt/updatedAt/title/project)、`direction`(asc/desc)、`project`(省略/`''`/名称)；返回 `todos/stats/projects/notices/timeFormat` | `index.js:49-59,235-244`；`store.js:52,586-612` |
| `POST /get` `/create` `/update` `/delete` `/complete` `/uncomplete` | CRUD；`update` 部分更新（title/project/files 均可选，`undefined` 表示不改） | `index.js:245-286`；`store.js:620-730` |
| `POST /projects` | 分类建议（已用分类 + 工作区 + 顶层文件夹合并去重） | `index.js:833-859`、`332-360` |
| `POST /files` | 工作区文件索引（只读；Host 侧深度 ≤4、≤2000 条、20s 缓存；无文件服务时 501） | `index.js:887-917`；`files.js:43-45` |
| `POST /workspaces` | 工作区候选列表 | `index.js:817-831` |
| `POST /quick-add` | 自然语言批量创建（`created/skipped/errors`） | `index.js:862-886`、`363-433` |
| 智能体工具 `todo_time_log` | action = CRUD + `quick_add`；`list` 的入参就是上述 filter/sortBy/direction/project | `index.js:64,516-570` |

没有「按列聚合」「按状态分组计数」「批量重排」类接口；分组/落格/几何全部在客户端算（`README.md:214`、`253`）。

### 2.3 字段缺口清单

| 能力 | 现状 | 影响看板的点 |
| --- | --- | --- |
| `dueDate`（截止时间） | 不存在 | 无法做「逾期/今天到期」列、卡片死线标记、按截止日排序 |
| `priority` | 不存在 | 无法做优先级列/泳道、卡片色条、WIP 之外的紧急度 |
| `tags`（多标签） | 不存在（只有单值 `project`） | 无法做多选筛选、多标签 chips |
| `order` / `position`（手动排序） | 不存在；排序字段固定 5 个（`store.js:52`），无位置概念 | 无法做列内拖拽排序（即使加拖拽也没有可写回的字段） |
| 泳道 `swimlane` | 不存在（只有一维 `boardColumns`） | 只能「状态」或「分类」二选一，无法二维矩阵 |
| WIP 限制 | 不存在 | 列头只有计数（`4689`），无上限/超限警示 |
| 看板内状态筛选 | 工具控件不渲染（`5231-5237`），且请求强制 `filter=all`（`1119`） | 看板永远展示全部状态 |
| 搜索 | 不存在（`grep 搜索/search` 只命中对话补全文案 `184`/`382`） | 无法按标题过滤；大数据量只能靠滚动 |
| 指派/协作者、估算、附件 | 不存在 | — |

### 2.4 「加一个字段」要动哪些文件（含迁移与测试影响）

以最常见的 `priority`（`'low'|'normal'|'high'`）为例，分三档说明改动面。

**A. 只做前端派生/展示（不改存储）** —— 例如「按 `project + status` 做泳道」这种纯组合：

- 只改 `lib/client.js`：`boardColumns`（`994-1012`）、`BOARD_GROUPS`（`1084-1087`）、`renderBoardView`（`4669-4701`）、看板 CSS（`2180-2257`）；若新增下拉选项要加 i18n key（两字典成对）。
- 影响面：单文件；但受「看板取全量 + 客户端计算」限制（`1119`），5000 条上限下（`store.js:58`）渲染成本会被放大。

**B. 新增持久字段（推荐路径，但必须一次改全）**

| 文件 | 必须改的位置 | 原因 |
| --- | --- | --- |
| `lib/store.js` | 头注释 `4-17`（模型文档） | 文档与实现同源，否则下一个维护者按注释理解会错 |
| `lib/store.js` | `STORE_VERSION` `44`、`SUPPORTED_STORE_VERSIONS` `46` | 版本号是磁盘信封契约（`552-562`） |
| `lib/store.js` | `normalizeTodo` `212-296`（新增校验 + 兜底 + notices） | 不写这里，字段会被 `292-295` 丢弃 |
| `lib/store.js` | `create` `627-655`、`update` `694-730` | 写入路径；`update` 需新增 `input.xxx !== undefined` 分支并刷新 `updatedAt` |
| `lib/store.js` | 迁移提示 `490-499` | v3→v4 需要一条一次性提示（现有 v1/v2 提示即此模式） |
| `lib/store.js` | `SORT_FIELDS` `52` + `sortTodos`/`sortKeyOf` `309-347` | 仅当字段参与服务端排序 |
| `lib/index.js` | `executeTodoAction` 的 `create` `247-272` / `update` `277-284` 透传 | 否则 HTTP/工具两条路径都拿不到新字段 |
| `lib/index.js` | `decorateTodo` `295-309`（本地化展示字段） | 工具输出/对话回执可读性 |
| `lib/index.js` | 工具入/出 schema `534-569`、`571-613`、`renderTodoResult` `436-513` | 模型侧契约，漏改会导致「工具无法设置新字段」 |
| `lib/client.js` | `normalizeTodo` `590-606` | 客户端只保留白名单字段（与 store 的 292-295 同理） |
| `lib/client.js` | i18n 两段 `26-221` / `222-417` | **成对 + 无死键**（audit，见 §4.1） |
| `lib/client.js` | 卡片 DOM `4623-4667` + CSS `2225-2257` | 展示 |
| `lib/parse.js` | `parseQuickAddLine` `194-211` / `parseQuickAdd` `213-227` | 仅当 quick-add 要识别新标记（如 `!high`） |
| `README.md` | §2.1 字段表 `76-85`、§2.2 信封 `87-99` | 文档一致性 |

**迁移风险（高）**：

1. `SUPPORTED_STORE_VERSIONS` 之外的信封会被**归档 + 重建空列表**（`lib/store.js:490-494`，`#archiveCorrupt` `538-550`）。因此一旦某个用户的数据文件写成 v4，**旧版插件（只认 1–3）打开时会清空视图数据**（原文件被重命名为 `.corrupt-version-4-<ts>`，数据可人工找回但用户感知为「全没了」）。
2. 反向兼容做法（推断，需实测）：升版时保留「读 v4 写 v4 + 不认识字段原样透传」，或先只加**可选字段且不升版本号**（`normalizeTodo` 白名单会丢弃未知字段，所以必须同时改白名单）。两条路都要改 §2.4 表里的 store 行。
3. 测试影响：
   - `test/smoke.mjs`（99 断言）断言 `v1/v2 落盘为 version 3`（`273-274`、`299`）—— 一旦 `STORE_VERSION` 变 4，这些断言必须同步改；
   - `normalizeTodo` 相关修复断言（`106-120`、`237-254`）需要为新字段补兜底用例；
   - `test/http.mjs`（47 断言）走真实路由，新字段的 create/update/非法值需要补；
   - `test/client-audit.mjs`：新增 i18n key 必须 zh/en 成对、占位符一致、且**被源码引用**（否则 `no unused declared key` FAIL）；
   - `docs/preview/` 只有 PNG + README（`docs/preview/README.md`），生成脚本不在仓库，**26+8+2 条断言当前无法在仓库里重跑** —— 改卡片结构时没有回归保护（风险，见 §5 R1）。

**C. 需要新接口**（例如服务端聚合分组、批量重排）：

- `lib/index.js` 路由白名单 `803`（`EXTRA_PATHS`）+ `lib/store.js` 新方法 + `test/http.mjs` 新用例；
- 或复用 `POST /update` 携带新字段（若要「批量」则要新路由或数组语义，`MAX_BODY_BYTES` 1MB，`index.js:91`）。

---

## 3. 样式系统与 i18n

### 3.1 样式载体

- 全部 CSS 在一个模板字符串 `CSS_TEXT`（`lib/client.js:1134-2496`）里；`StyleSheet()` 渲染成 `<style data-dsh-todo-time-log="styles">`（`2499-2501`），在面板根（`5080`）与错误边界（`5318`）各挂一次。
- 这是**全局 `<style>`，不是 CSS Modules/scoped**：所有选择器必须自带 `ttl-` 前缀做隔离（audit 强制，`test/client-audit.mjs:90-92`）。
- 类名总量 160（audit 输出）；新增类名必须 `ttl-` 开头，否则 audit FAIL。
- 已知格式坑：`1586` 行是一条超长单行（`.ttl-row[data-status…] {…}.ttl-badge {`），`1657`、`1601`、`1615`、`1781` 附近也有压缩写法的规则；改动时不要按「一行一条规则」假设。

### 3.2 可用 token 清单

**A. 当前已用（24 个，去重；括号内为出现次数）**

| 族 | token |
| --- | --- |
| 文字 | `--dsw-alias-label-primary`(27)、`label-secondary`(22)、`label-tertiary`(35)、`label-caption`(3)、`label-primary-foreground`(4) |
| 背景 | `--dsw-alias-bg-base`(9)、`bg-layer-1`(7)、`bg-module-platform`(17)、`bg-skeleton`(1)、`bg-mask-1`(1) |
| 描边 | `--dsw-alias-border-l1`(11)、`border-l2`(16)、`border-l3`(9) |
| 交互 | `--dsw-alias-interactive-bg-hover`(16) |
| 状态 | `--dsw-alias-state-success-primary`(3)、`state-success-secondary`(2)、`state-error-primary`(5)、`state-error-secondary`(1)、`state-warn-primary`(1)、`state-business-primary`(12) |
| 按钮/toast | `--dsw-alias-button-primary-fill`(2)、`button-primary-hover`(1)、`toast-bg`(1)、`toast-label`(7) |

结构性 token：`--dsw-radius-sm/md/lg`（`styles` 里共 9/2/1 次）、`--dsw-shadow-lv1`(2)、`--dsw-shadow-lv3`(1)。`--dsw-static-*`、`--dsw-font-*` **一次都没用**。

**B. 宿主可用（107 个 alias，来自本机 `@deepseek-ai/dsh-client-ui-theme/lib/client.js`；版本变化时以宿主题包为准）**

| 族 | 数量 | token（省略公共前缀 `--dsw-alias-`） |
| --- | --- | --- |
| label | 13 | `label-primary`、`label-primary-bluish`、`label-primary-dimmed`、`label-primary-foreground`、`label-primary-inverted`、`label-secondary`、`label-tertiary`、`label-caption`、`label-dimmed`、`label-deep-diving`、`label-deep-diving-shimmer`、`label-shimmer`、`label-document-preview` |
| bg | 15 | `bg-base`、`bg-layer-1/2/3`、`bg-module-platform`、`bg-skeleton`、`bg-overlay`、`bg-mask-1/2/3`、`bg-mask-drop`、`bg-mask-photo`、`bg-multi-select`、`bg-document-preview`、`bg-document-selection` |
| border | 7 | `border-l1/l2/l3/l4`、`border-l2-darkmode-thin`、`border-inverted`、`border-inverted2` |
| state | 12 | `state-success-primary/secondary/tertiary`、`state-error-primary/secondary`、`state-warn-primary/secondary/tertiary`、`state-warn-label`、`state-business-primary/tertiary`、`state-idle-primary` |
| button | 15 | `button-primary-fill/hover/dimmed`、`button-info-fill/hover`、`button-contrast-fill`、`button-elevated-fill`、`button-floating-fill/hover`、`button-tool-bar-fill`、`button-tool-bar-fill-invisible`、`button-tool-bar-hover`、`button-ghost-active-fill/border/hover` |
| interactive | 5 | `interactive-bg-hover`、`interactive-bg-hover-solid`、`interactive-bg-hover-accent`、`interactive-bg-hover-danger`、`interactive-bg-active` |
| 其他 | — | `toast-bg`、`toast-label`、`tooltip-bg`、`tooltip-key-bg`、`link`、`brand-primary`、`brand-text`、`scrollbar-bg-l1/l2`、`scrollbar-hover-l1/l2`、`menu-icon`、`menu-group-header-fill`、`settings-card-fill/stroke`、`switch-thumb`、`code-diff-added/deleted`、`file-diff-*`(6)、`markdown-*`(8)、`onboarding-*`(4)、`turn-trigger-bg(-hover)` |

结构 token 实际取值（宿主 `:root` 定义）：`--dsw-radius-xs:4px`、`sm:8px`、`md:12px`、`lg:16px`、`xl:20px`、`panel:28px`；`--dsw-shadow-lv1/lv2/lv3`；`--dsw-font-family` + 语义字号族（`--dsw-font-xs-13`、`xxs-12`、`xxxs-11`、`s-14`、`m-18`、`l-20`、`xl-24`，每族含 `-font-size/-line-height/-font-weight` 子变量）。

**明暗主题机制**：宿主在 `body` 上定义一套、在 `body[data-ds-dark-theme]` 下重定义同一批 alias（实测两处 `--dsw-alias-bg-base` 定义）。因此**插件不需要写任何暗色分支**，只要颜色全部走 `var(--dsw-alias-*)`，切换主题自动生效。`docs/preview/10-dark.png` 是这条路径的视觉证据。

### 3.3 颜色用法与惯例

- **禁止硬编码颜色**：audit 用 `#[0-9a-fA-F]{3,8}\b` 和 `rgba?()|hsla?()` 两条正则硬拦（`test/client-audit.mjs:85-86`），当前 0 命中。
- 透明度统一用 `color-mix(in srgb, var(--dsw-alias-*) N%, transparent)`，全文件 8 处；典型是徽标：`.ttl-badge` 9% `label-secondary`、`.ttl-badge-completed` 14% `state-success-primary`（`1586-1604`）。
- 三级文字（primary/secondary/tertiary）、三级描边（l1/l2/l3）、三级底色（base / layer-1 / module-platform）是现有层级语汇：看板列 = `bg-module-platform` + `border-l2`（`2193-2195`），卡片 = `bg-base` + `border-l2`（`2230-2232`），卡片 meta = `label-tertiary`（`2250`）。
- `0.5px` 细边框惯例：`1332`、`2193`、`2203`、`2230`、`2259`、`2453` 等（与 README `315`/`321` 的「微边框 + 同心圆角」一致）。

### 3.4 圆角 / 间距 / 字号惯例

| 维度 | 惯例 | 证据 |
| --- | --- | --- |
| 圆角 | 数据卡/看板列 `12px`；控件与分段 `8px`/`6px`；看板卡片 `10px`；chip `6px`；徽标胶囊 `9999px`；toast 用 `--dsw-radius-sm` | `1332-1334`、`2194`、`2231`、`2454`、`1593`、`1398-1407`、`1460-1467` |
| 同心 | 外层 = 内层 + 内边距（README `321`：16=8+8、12、8/6=8-2） | `README.md:321` |
| gap | 常用 2/4/6/8/12；看板列间 `12`、列内卡片 `8`、卡片内块 `6`、徽标间 `6`、chip 间 `4` | `2183`、`2213`、`2228`、`2245`、`2445` |
| padding | 列头 `8px 10px`、列体 `8px`、卡片 `8px 10px`、工具栏 `8px 12px`、数据卡内看板 `12px 12px 16px` | `2202`、`2215`、`2229`、`1337`、`1347` |
| 字号 | 标题 13/14、正文 12、元信息 11；行高 16/18/20/22 | `2237-2239`、`2251-2252`、`2205-2207` |
| 数字 | 时间/计数一律 `font-variant-numeric: tabular-nums` | `2209`、`2253` |
| 高度 | 分段项 26、下拉 28、方向按钮 28×28 | `1372`、`1405-1406`、`1420-1421` |

### 3.5 响应式与动效

- 断点仅两个：`@media (max-width: 720px)`（详情网格，`2483-2485`）、`@media (max-width: 560px)`（页内边距、工具栏、行布局、项目输入、日历格，`2486-2495`）。
- **看板没有专属断点**：靠 `.ttl-board { overflow-x: auto }` + 列 `min-width: 240px` 横向滚动（`2180-2196`）；列体 `max-height: 56vh` 竖向滚动（`2210-2217`），窄面板下形成「页面滚动 + 列内滚动 + 横向滚动」三层（见 §5 R3）。
- `prefers-reduced-motion: reduce` 关闭输入框/按钮/箭头过渡与骨架/toast 动画（`2473-2482`）。看板本身无动画，因此不受影响。

### 3.6 i18n 机制

- 字典内联在 `client.js`：`const I18N = { zh: {…}, en: {…} }`（`lib/client.js:25`；zh `26-221`，en `222-417`，字典结束 `418`）。**194 个 key/语言**。
- `t(key, vars)`（`lib/client.js:428-439`）：默认 `zh`（`DEFAULT_LOCALE` `420`），缺失回退 `en`，再缺失原样返回 key；占位符语法 `{name}`，`undefined/null` 保留原文。
- 不支持复数、日期/数字本地化、RTL；时间格式硬编码在 `formatTime`（`467-475`，`YYYY-MM-DD HH:mm:ss` 本地时区），`/list` 返回的 `timeFormat` 只用于页头副标题（`5095` ← `3502-3504`）。
- `locale/zh.json` / `locale/en.json` **只有 `meta.title` 与 `meta.description` 两个字段**（各 6 行，如 `locale/zh.json`），是 Host 插件市场元数据，**不驱动 UI 文案**（README `458-459` 亦说明未接入宿主 locale 服务）。
- 看板相关 key（zh `130-136` / en `326-332`）：`board.groupBy`、`board.groupStatus`、`board.groupProject`、`board.emptyColumn`、`board.empty`、`board.aria`、`board.cardAria`；卡片复用 `list.created` `55`、`list.completed` `56`、`row.*`、`project.none`、`files.more`、`view.board`(`105`/`301`)。

---

## 4. 硬约束清单

### 4.1 `test/client-audit.mjs` 的 28 项门禁 → 反推的硬规则

实际运行：28 项全部 PASS（`i18n keys per language: 194; alias tokens: 24; class names: 160`）。按检查顺序归类为 9 + 7 + 2 + 6 + 4 = 28 项：

**A. i18n（9 项，`test/client-audit.mjs:11-67`）**

| 检查 | 硬规则 | 违规后果 |
| --- | --- | --- |
| I18N object found / literal terminated | 源码里必须有 `const I18N = ` 且紧跟**纯对象字面量**（用 `new Function` 求值） | 不能 `import`、不能拼接、不能引用变量；写错直接 FAIL |
| languages are zh+en | 恰好两个语言键 | 加 ja/ko 会 FAIL |
| key counts equal / no missing in en / no missing in zh | zh/en key 集合完全一致 | 单边加 key 必 FAIL |
| placeholders match | 同一 key 的 `{xxx}` 集合在两语言必须相同 | 例如 zh 写 `{count}` 而 en 漏了 → FAIL |
| no undeclared key used | 任何 `t('key')` 字面量必须在 zh 字典里 | 拼错 key 名 → FAIL（好消息） |
| no unused declared key | 每个 key 必须在「字典之外」以 `'key'`/`"key"` 形式出现 | **只加 key 不落地使用 → FAIL**；数据驱动写法 `labelKey: 'x'` 也算使用 |

**B. API/运行时（7 项，`69-86`）**

| 检查 | 硬规则 |
| --- | --- |
| only require('react') | 全文件只允许 `require('react')`，别无其它模块/依赖 |
| only the documented read-only document access | 全文件 `document.` 出现**恰好 1 次**且必须是 `document.activeElement`（`5376`） |
| single composer draft reader | `document.activeElement` 也只允许 1 次 |
| no direct DOM query | 禁 `querySelectorAll｜getElementById｜appendChild｜innerHTML｜setAttribute` |
| no DOM writes | 禁 `.textContent =` / `.innerText =` 赋值（读 `textContent` 允许，见 `5384`） |
| no hardcoded hex colors | 禁任意 `#rgb`/`#rrggbb(aa)` **文本**——注意正则也会误伤注释/字符串里的 `#abc` 形式 |
| no rgb()/hsl() colors | 禁 `rgb()`/`rgba()`/`hsl()`/`hsla()` |

**C. 样式（2 项，`88-92`）**

| 检查 | 硬规则 |
| --- | --- |
| uses theme alias tokens | `var(--dsw-alias-*)` 去重后 **≥18 个**（当前 24，余量 6）——删掉主题化写法会跌破阈值 |
| all class names use ttl- prefix | 所有 `className: '<字面量>'` 逐个 token 必须以 `ttl-` 开头 |

> 门禁盲区（不是许可）：类名检查只扫 `className: '...'` **字符串字面量**。`ProjectBadge` 用变量传 className（`lib/client.js:2636-2637`），这类写法不会被检查，也不会被保护。

**D. 视图结构（6 项，`test/client-audit.mjs:94-108`）**

| 检查 | 硬规则 |
| --- | --- |
| view "table/board/gantt/calendar" wired（4 项） | 源码里必须出现 `'board'` 等四个字面量 |
| renderers defined | 必须同时匹配 `/const renderTableView\s*=/`、`/const pushTableRow\s*=/`、`/const renderBoardView\s*=/`、`/const renderCalendarView\s*=/`、`/function boardColumns\(/`、`/function buildCalendarCells\(/`、`/function GanttView\(/` |
| calendar uses a 6x7 grid | 源码含 `42` 且 `buildCalendarCells` 存在 |

> **改名即挂**：把 `const renderBoardView = …` 改成 `function renderBoardView()`、或把 `boardColumns` 改成 `const boardColumns =`，audit 会 FAIL。重命名必须同步改 `test/client-audit.mjs`。

**E. 模块/槽位（4 项，`110-114`）**

| 检查 | 硬规则 |
| --- | --- |
| module loader wrapper | 必须有 `window.__ModuleLoader__.load({`（全文件唯一 `window.` 使用处 `17`） |
| factory declares id | `id: 'dsh-todo-time-log'`（`18`） |
| registers main slot | 源码含 `slots.inject('main'`（`5512`） |
| registers sidebar.panellist slot | 源码含 `slots.inject('sidebar.panellist'`（`5522`） |

### 4.2 不在 audit 里、但同样会让你「判定失败」的约束

1. **预览断言（仓库外）**：`docs/preview/README.md:36-48` 描述了 26+8+2 条渲染期断言，其中包含「页面级 `.ttl-button-primary` 只有 1 个」「toast 不新增 `.ttl-page` 子节点」「空态都有出口按钮」等**产品级**约束。生成脚本不在仓库，只有 PNG —— 因此这些断言**当前不可重跑**，只能人工核对截图（风险 R1）。
2. **`npm test` 不含 audit**：`package.json` 的 `test` = `parse.mjs && smoke.mjs && http.mjs`；`audit` 是独立脚本（`npm run audit`）。所以「门禁通过」目前依赖人工记得跑。
3. **唯一主操作**：页面级只允许一个实心 `.ttl-button-primary`（新建的「添加」，`5183`）；卡片/对话卡片内的按钮要用 ghost/outline/link（`README.md:316`）。在看板卡片里加实心主按钮会违反这条产品约束（audit 不查，但预览断言查）。
4. **槽位 key/id 一致**：`main` 的 `key: 'dsh-todo-time-log'` 必须等于 `sidebar.panellist` 的 `id`（`5508-5531`），否则点侧栏打不开面板。
5. **无 git**：没有 diff/回滚基线，任何大改都要自己留副本（本仓库只有 `.refs-*` 参考包）。

### 4.3 浏览器端能力边界

| 能力 | 边界 | 证据 |
| --- | --- | --- |
| 依赖 | 只有宿主注入的 `react`；`h = React.createElement`，无 JSX/TS/构建/第三方 UI 库 | `lib/client.js:17-21`、`package.json` 无 `dependencies` |
| 数据 | 全部经 `POST /api/dsh-todo-time-log/<action>`，JSON、`{ok:true,value}` / `{ok:false,error:{code,message}}` | `444`、`523-587`；`index.js:46,680-727` |
| 本地存储 | **不用** `localStorage`/`sessionStorage`/IndexedDB（grep 命中 0）；一切状态以 Host store 为准，视图/分组状态刷新即丢 | `3360-3405` |
| 文件系统 | 不能指定任意磁盘路径：`/files`/`/projects`/`/quick-add` 的 `workspace` 必须是 Host 候选之一，否则 400 `WORKSPACE_UNKNOWN`；索引只读、深度 ≤4 / ≤2000 条 / 20s 缓存 | `index.js:738-755,833-917`；`files.js:43-45` |
| DOM | 只能建 React 树；不许查询/写入 DOM；唯一读点是 `readComposerDraftText`（`5373-5388`，`document.activeElement` + `closest('[contenteditable]')`） | audit B 组 |
| 剪贴板 | `navigator.clipboard` 可选；非安全上下文/无权限时静默降级，不报错 | `4374-4394` |
| 拖拽 | **技术上可行**（React 的 `onDragStart/onDragOver/onDrop` 不违反任何 audit 规则）；`README.md:258` 的「不做拖拽」是产品与可访问性决策，不是门禁限制 | 反证：`grep onDrag\|draggable` 命中 0，audit 无相关检查 |
| 路由/窗口 | 无；只能在 `main` 槽内绘制一块面板，宽度由宿主决定（中央面板，可窄可宽） | `5508-5531`、`README.md:188-210` |
| 主题 | 只能用 `--dsw-alias-*`（+结构 token）；不能假设具体色值，不能写暗色分支 | §3.2 |
| 焦点 | 只用 `createInputRef` 主动聚焦新建输入框（`3595-3597`）；不允许把焦点抢进 toast（README `331`） | — |

---

## 5. 差距与风险清单

### 5.1 风险表

| # | 风险 | 证据 | 影响 | 严重度 |
| --- | --- | --- | --- | --- |
| R1 | **门禁/预览断言不在 `npm test`，且预览生成脚本缺失** | `package.json` `scripts`；`docs/preview/README.md:36-48`；仓库只有 PNG | 卡片结构回归无自动化保护，只能靠 audit 的弱结构检查 + 人工看图 | 高 |
| R2 | **全量渲染 + 无虚拟化** | `renderBoardView` `4669-4701` 一次性 map 所有列×卡片；`MAX_TODOS = 5000`（`store.js:58`）；看板固定 `filter=all`（`1119`） | 待办上千时首屏/完成操作后重渲染卡顿；每次写操作都全量刷新（`3680`/`3729`/`3759`） | 高 |
| R3 | **三层滚动嵌套** | `.ttl-scroll`（`1146-1151`）+ 列体 `max-height:56vh`（`2210-2217`）+ `.ttl-board` 横向（`2180-2186`） | 窄面板（560px 以下，`2486-2495`）操作时容易丢上下文；滚轮在列内被劫持 | 中 |
| R4 | **看板隐藏状态筛选，但筛选状态仍保留** | 工具栏 `5231-5237` 不渲染 `filterTabs`；`queryForView` 强制 `filter:'all'`（`1119`）；`filter` state 仍在（`3359`） | 用户在表格选「已完成」再切看板：筛选静默失效；若此时列表为空，空态按钮会去清一个**看不见的**筛选（`3585-3598`）→「点了没反应」 | 中 |
| R5 | **可访问性缺口** | 列 `section[role=listitem]` 无 `aria-label`/`aria-labelledby`（`4682-4690`，`column.label` 只是普通 span）；卡片不可聚焦（无 `tabIndex`）；无键盘列间移动；`role=list` 的直接子节点是 `section`（合法）+ 卡片 `article` 无 role（可接受但语义弱） | 屏幕阅读器无法把「列名 + 计数」关联到列内容；键盘用户无法移动/重排 | 中 |
| R6 | **死类名 / 死属性** | `.ttl-board-column-title` 无 CSS（`4688` 唯一命中）；`article[data-status]` 无选择器（`4631`，CSS 只有 `.ttl-row`/`.ttl-gantt-dot`） | 后续改动容易误以为「已有样式钩子/状态样式」，改 CSS 后看不到效果 | 低 |
| R7 | **空标题的兜底文案错位** | `4633`/`4642-4643` 用 `t('list.empty')`（=「还没有待办」）当作空标题占位 | 空标题卡片读出/显示「还没有待办」，语义矛盾 | 低 |
| R8 | **全局单值忙碌门** | `isBusy = busyId !== null \|\| creating`（`3582`）；`handleToggle` 直接 return 如果 `busyId !== null`（`3665`） | 看板上连续完成 3 条要点 3 次等 3 个往返；无排队/乐观更新 | 低 |
| R9 | **版本迁移是破坏性的** | 未知版本 → 归档 + 重建空列表（`store.js:490-494`）；字段白名单丢弃未知字段（`292-295`） | 升 v4 后旧版客户端打开会「数据消失」；手工改数据文件加字段无效 | 高（仅在实际加字段时触发） |
| R10 | **时间格式双源** | `formatTime` 硬编码 `YYYY-MM-DD HH:mm:ss`（`467-475`）；`timeFormat` 只进页头（`3502-3504`、`5095`） | 若 Host 改格式常量，卡片时间不跟随（推断：目前两者一致，无可见问题） | 低 |
| R11 | **看板变化无 live 播报** | toast host 有 `aria-live`（`5258-5260`），列计数/列内容刷新无播报 | 完成操作后屏幕阅读器只知道 toast，不知道卡片移动到了哪一列（推断） | 低 |
| R12 | **卡片 `aria-label` 与内部文本可能重复播报** | `board.cardAria` 合成「标题/分类/状态」（`4632-4636`），而卡内又有徽标/时间/文件名（`4645-4664`） | 读屏可能先读 aria-label 再读内部文本，信息重复（推断，需实测 NVDA/VoiceOver） | 低 |

### 5.2 当前架构下的安全快速改进点（8 条）

均只改 `lib/client.js`（除非注明），不触碰数据模型、接口与 `client-audit` 的硬匹配点。

| # | 改进 | 改哪里 | 影响面 |
| --- | --- | --- | --- |
| Q1 | 给 `.ttl-board-column-title` 补上真实样式（如 `flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap`），并把计数改为 `flex:none` | CSS `2197-2209` | 纯样式，单文件；无 audit 影响；长分类名不再挤掉计数 |
| Q2 | 列头语义补全：给标题 span 一个稳定 id（如 `ttl-board-col-<key>`）并把 `section` 的 `aria-label` 设为 `column.label`，`aria-describedby` 指向计数 | `4669-4701` | 纯 a11y；满足「列名+计数」关联；无需新 i18n key（label 已存在） |
| Q3 | 看板下也渲染状态筛选分段（`filterTabs`），并让 `queryForView` 对 board 透传 `filter` | `5231-5237` + `1117-1122` | 一处三元 + 一个返回分支；行为变更需同步 `README.md:253/258`；**不动** audit 匹配点；空态出口按钮的语义随之自洽（R4 一起解决） |
| Q4 | 按分类分组时不再重复显示分类徽标（列名已经说明了分类），只保留状态徽标 | `4645-4650` 加条件 `boardGroupBy === 'project' ? null : h(ProjectBadge…)` | 卡片密度提升、减少噪音；单函数内改动；不影响其它视图 |
| Q5 | 空标题改用专用占位 key（如新增 `board.untitled` = 「无标题」/「Untitled」），替换 `4633`/`4643` 的 `t('list.empty')` | i18n zh `130-136` 区 + en `326-332` 区成对新增；卡片 2 处 | 受 i18n 门禁约束：必须**两边同加且被使用**（否则 `no unused declared key`）；风险低、收益明确 |
| Q6 | 收掉三层滚动中的一层：列体 `max-height: 56vh` → 例如 `max-height: min(56vh, 640px)`，或窄屏（`≤560px`）下取消列内滚动改为页面滚动 | CSS `2210-2217`（可加在 `2486-2495` 断点里） | 纯样式；`docs/preview/04-board.png` 需重拍；无行为/接口影响 |
| Q7 | 卡片时间改成 `<time datetime={toIso}>` + `title` 带完整本地时间（当前只有文本） | `4651-4661` | 语义/可复制性；不新增依赖；`formatTime` 输出可直接当 `title`；无 audit 影响 |
| Q8 | 列头加「＋」快捷新建：点击后聚焦顶部输入框并把该列的分类预填进 `newProject`（状态列则只是聚焦） | `4685-4690` + 复用 `createInputRef`（`3595-3597`）/`setNewProject` | 纯前端、无接口改动；注意按钮必须是 `.ttl-ghost-button`/`.ttl-link`（不能新增页面级 primary）；`aria-label` 需新 i18n key（成对） |

> 可选第 9 条（不做拖拽也能提升效率）：看板下显示排序方向切换（`direction` 对 board 生效），把 `1119` 的 `direction:'desc'` 改为透传工具栏方向 —— 但需同时把 `sortSelect/directionToggle` 在 board 显示（`5243-5244`），属于 Q3 的同类改动。

---

## 6. 附：看板相关关键代码位置索引（行号表）

> 全部为 `lib/client.js`，除非另注文件。

### 6.1 数据与分组

| 位置 | 内容 |
| --- | --- |
| `994-1012` | `boardColumns(todos, groupBy)`：状态二分 / 分类分组 |
| `1084-1087` | `BOARD_GROUPS`（status / project） |
| `886-905` | `groupByProject`（组内保序、按名排序、未分类最后） |
| `838-841` / `844-853` / `856-883` | `projectLabel` / `compareProjectNames` / `normalizeProjects` |
| `590-606` | `normalizeTodo`（客户端字段白名单） |
| `773-781` / `784-797` | `normalizeTodos` / `normalizeStats` |
| `467-475` | `formatTime`（本地 `YYYY-MM-DD HH:mm:ss`，空值 `-`） |
| `445-446` | `TIME_FORMAT` / `EMPTY_TIME` |
| `1117-1122` | `queryForView`（看板固定 `filter=all / createdAt / desc`） |

### 6.2 渲染

| 位置 | 内容 |
| --- | --- |
| `4623-4667` | `renderBoardCard`（卡片全结构） |
| `4669-4701` | `renderBoardView`（空态 / 列 / 列头 / 列体） |
| `1015-1033` | `TextPlaceholder`（看板与日历共用空态） |
| `4214-4219` | `statusBadge` |
| `4221-4231` / `4233-4243` | `titleInput` / `projectInput`（编辑态） |
| `4266-4372` | `renderActionButtons`（完成/编辑/删除/二次确认/保存取消） |
| `4374-4394` / `4397-4414` | `copyFilePath` / `renderFileChips`（`max:2` → `+N`） |
| `2634-2638` | `ProjectBadge` |
| `4860-4889` | `listBody` 分派（board 分支 `4883-4884`） |
| `5080` / `5318` | `h(StyleSheet)` 两个挂载点 |
| `5221-5254` | `.ttl-data` 卡片：工具栏 + `.ttl-list` |
| `5253` | `.ttl-list` 容器（看板渲染结果挂载处） |

### 6.3 交互与状态

| 位置 | 内容 |
| --- | --- |
| `3352-3405` | `TodoPanel` 全部 state（`view` `3372`、`boardGroupBy` `3383`） |
| `3407-3426` | refs（`requestSeq` / `filterRef` / `createInputRef` …） |
| `3465-3522` | `loadList`（请求 + 规整 + 竞态丢弃 + notices） |
| `3526-3534` | view/filter/sort/direction/project 变化触发重新取数 |
| `3536-3544` | `reload(quiet)` |
| `3582` | `isBusy`（全局忙碌门） |
| `3585-3598` | 空态出口逻辑（`emptyActionKey` / `handleEmptyAction`） |
| `3664-3686` | `handleToggle`（完成/取消完成 + 撤销 toast） |
| `3695-3702` / `3704-3735` / `3737-3748` | 编辑开始 / 保存 / Enter-Esc |
| `3750-3765` | `handleDelete` |
| `4899-4916` | `filterTabs`（看板不渲染） |
| `4918-4946` | `sortSelect` / `directionToggle`（仅表格） |
| `4948-4964` | `viewToggle`（四视图分段） |
| `4966-4993` | `projectFilterSelect`（全视图） |
| `5012-5027` | `boardGroupSelect`（看板专属） |
| `5231-5237` | 工具栏按视图二选一（看板只出分组 select） |

### 6.4 样式

| 位置 | 内容 |
| --- | --- |
| `1134-2496` | `CSS_TEXT`（全部样式） |
| `2499-2501` | `StyleSheet` 组件 |
| `1330-1347` | `.ttl-data`（数据卡）/ 工具栏内边距 / 看板内边距 |
| `1348-1360` / `1361-1397` | `.ttl-toolbar` / `.ttl-seg` 分段 |
| `1398-1415` | `.ttl-select`（下拉） |
| `1586-1604` | `.ttl-badge` / `.ttl-badge-completed`（`color-mix`） |
| `1615-1618` | `.ttl-time-label` |
| `1657-1674` | `.ttl-link`（看板操作按钮用的类） |
| `2180-2186` | `.ttl-board`（flex + 横向滚动） |
| `2187-2196` | `.ttl-board-column`（`flex:1 0 240px`、`max-width:380px`、12px 圆角） |
| `2197-2209` | `.ttl-board-column-head` + `-count` |
| `2210-2217` | `.ttl-board-column-body`（`max-height:56vh` 列内滚动） |
| `2218-2224` | `.ttl-board-column-empty` |
| `2225-2233` | `.ttl-board-card`（10px 圆角、`bg-base`） |
| `2234-2244` | `.ttl-board-card-title`（2 行截断） |
| `2245` / `2246-2254` / `2255` | `.ttl-board-card-badges` / `-meta` / `-actions` |
| `2256-2257` | `.ttl-board-edit`（编辑态） |
| `2445-2468` | `.ttl-file-chips` / `.ttl-file-chip` / `.ttl-file-more` |
| `2470` | `.ttl-board-card-files` |
| `2473-2482` | `prefers-reduced-motion` |
| `2483-2495` | 720 / 560 断点（无看板专属规则） |

### 6.5 i18n / 门禁 / Host

| 位置 | 内容 |
| --- | --- |
| `client.js:25-418` | `I18N` 字典（zh `26-221`，en `222-417`） |
| `client.js:130-136` / `326-332` | 看板 7 个 key（zh / en） |
| `client.js:420` / `428-439` | `DEFAULT_LOCALE` / `t()` |
| `client.js:17-21` | 模块加载器入口 + `require('react')` + `h` |
| `client.js:5508-5531` | `inject: ['slots']` + 双槽位注册 |
| `test/client-audit.mjs:11-67` | i18n 九项门禁 |
| `test/client-audit.mjs:69-86` | API/运行时七项门禁 |
| `test/client-audit.mjs:88-92` | 样式两项门禁（token 数、类名前缀） |
| `test/client-audit.mjs:94-108` | 视图/渲染器六项门禁（含改名即挂的正则） |
| `test/client-audit.mjs:110-114` | 模块/槽位四项门禁 |
| `lib/index.js:235-244` / `lib/store.js:586-612` | `/list` 契约（含 `timeFormat`） |
| `lib/index.js:49-59` / `64` | `CRUD_ACTIONS` / `ACTIONS` |
| `lib/index.js:794-813` | 路由分发 + `EXTRA_PATHS` |
| `lib/store.js:44-58` | 版本号 / 支持版本 / 上限常量 |
| `lib/store.js:212-296` | `normalizeTodo`（修复、notices、字段白名单 `292-295`） |
| `lib/store.js:490-499` / `552-562` | 版本迁移提示 / 落盘信封 |
| `README.md:251-262` | §3.7 四视图（看板行为的产品口径） |
| `README.md:302-333` | §3.9 视觉层级与约束（同心圆角、唯一主操作、toast） |
| `README.md:360-376` | §5 测试门禁说明 |
| `docs/preview/README.md:36-48` | 预览断言（26+8+2，脚本不在仓库） |
| `docs/preview/04-board.png` | 当前看板视觉基线（1280×820：状态两列、列头名称+计数、卡片标题/徽标/时间/行内操作链接） |

---

## 7. 一句话总结

看板是「服务端全量 + 客户端投影」的纯展示视图：两维分组（状态/分类）、状态模式两列固定顺序、卡片信息完整但无排序/泳道/WIP/搜索/拖拽；数据模型 v3 只有 8 个字段，任何新维度（截止日/优先级/标签/手动顺序）都要同时改 `store.js`（含版本迁移，破坏性）、`index.js`（接口与工具契约）、`client.js`（白名单 + i18n 成对 + 卡片）与 `test/smoke.mjs`＋`README`；样式与 i18n 的硬约束集中在 `client-audit.mjs` 的 28 项检查里，而最危险的缺口是「`npm test` 不跑 audit、预览断言无法重跑、以及看板自身的可访问性与全量渲染成本」。
