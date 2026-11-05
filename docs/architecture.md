# 架构与关键代码

> 本文档是 [README](../README.md) 的扩展说明，面向二次开发与代码评审。

[← 返回 README](../README.md) · [开发与测试](./development.md) · [已知限制](./limitations.md) · [验证记录](./verification-log.md)

## 目录结构

```text
dsh-todo-time-log/
├── package.json            # 包清单：bundle patch + dsh.client + exports/files
├── cordis.patch.yml        # Loader patch：插入一条 Host 行（id = 包名）
├── icon.svg                # 插件图标（Plugin Manager / 设置页展示）
├── locale/
│   ├── zh.json             # 显示名与描述（中文）
│   └── en.json             # 显示名与描述（英文）
├── src/client/             # ★ Client 半源码（ES 模块，npm run build 用 esbuild 打包）
│   ├── index.js            # 入口：window.__ModuleLoader__.load({ id, factory })
│   ├── app.js              # 模块对象：main + sidebar.panellist 槽位注册
│   ├── panel.js            # 面板主体：状态 / 请求 / 交互（不含四个视图实现）
│   ├── views/              # table / board / gantt / calendar 四视图
│   ├── widgets.js          # 小组件 / 图标 / 对话录入等
│   ├── detail.js           # 详情区
│   ├── helpers.js          # 时间 / 格式化 / 甘特几何等纯函数
│   ├── i18n.js             # zh / en 文案字典
│   ├── styles.js           # CSS（--dsw-alias-* 主题 token）
│   ├── sources.js          # /todo 输入触发来源（@ 菜单）
│   └── runtime.js          # React 注入层（factory 里 setReact）
├── scripts/
│   └── build-client.mjs    # esbuild 打包脚本：src/client/ → lib/client.js
├── lib/
│   ├── index.js            # ★ Host 半：apply / inject / 单一业务入口 / HTTP 路由 / 智能体工具
│   ├── store.js            # ★ 数据模型 + 持久化 + 修复兜底 + 跨进程写入保护（纯 Node ESM，无 dsh 依赖）
│   ├── time.js             # ★ 时间解析 / 本地格式化 YYYY-MM-DD HH:mm:ss / 空值
│   ├── parse.js            # ★ 统一自然语言解析（对话面板 / /todo 命令共用）
│   ├── files.js            # ★ 工作区文件索引（ctx.fs 只读遍历 + 缓存，供 @ 补全）
│   └── client.js           # 构建产物（勿手改；由 src/client/ 打包生成，仍是单文件模块表）
├── test/
│   ├── parse.test.mjs      # 自然语言解析 / 文件路径 / 分类派生（79 用例，node:test）
│   ├── smoke.test.mjs      # 数据层 / 时间 / 修复 / 分类 / 文件 / 迁移 / 持久化（174 用例）
│   ├── http.test.mjs       # 真实 HTTP 路由端到端（77 用例，含宿主认证 401/403）
│   ├── store-concurrency.test.mjs  # 跨进程写入：mtime 合并 + 文件锁（8 用例）
│   ├── ui/                 # jsdom + 真实 React 渲染 lib/client.js 的验收 harness（4 用例）
│   ├── live-utf8.py        # 对运行中实例的真实 UTF-8 往返检查（需 DSH_WEB_URL）
│   ├── live-projects.py    # 对运行中实例的分类/迁移/筛选真实往返检查
│   └── client-audit.mjs    # client.js 静态审计（i18n 成对/死键、require、token、四视图）
├── docs/
│   ├── architecture.md     # 架构与关键代码：目录结构 / 数据模型 / 双调用方入口 / 四视图（本文档）
│   ├── development.md      # 测试（自动化 + 手工验证清单）与 npm 发布流程
│   ├── limitations.md      # 已知限制与 TODO（10 条，含不确定处与适配层）
│   ├── verification-log.md # 本机验证记录（按阶段累积的自验证据表）
│   ├── verification.md     # 独立验证报告（另一个 agent 产出，含 PASS/FAIL/盲区）
│   ├── publishing.md       # npm 发布流程：bootstrap / Trusted Publisher / 版本策略 / 排错
│   ├── images/             # README 落地页配图（banner / hero / 四视图 / 操作示范）+ 生成说明见其 README
│   ├── research/           # 看板设计调研 + 现状审计（六期改版的依据）
│   │   ├── kanban-design-research.md   # 15 个可借鉴模式 + 差距 + P0/P1/P2 + 反模式（带来源）
│   │   └── kanban-current-state.md     # 代码/数据/门禁现状、风险 R1–R12、快速改进点 Q1–Q8
│   ├── design/kanban-plan.md           # 看板改版方案与后续路线（P0 已实现 / P1 / P2）
│   └── preview/            # 面板渲染预览图（真实 client.js + 主题 token 的静态渲染，见其 README）
├── eslint.config.js        # ESLint flat config（产物 lib/client.js 不直接 lint）
├── tsconfig.json           # tsc --checkJs：Host 模块的 JSDoc 类型检查
├── .github/workflows/
│   ├── ci.yml              # push/PR：check / lint / typecheck / build / test / audit（Node 20·22·24 × Linux·Windows）
│   └── publish.yml         # 打 tag 自动发布 npm（OIDC 可信发布 + 校验 + GitHub Release）
├── LICENSE                 # MIT
└── README.md
```

依赖关系：`index.js → store.js → time.js`；`client.js` 只经 HTTP 与 Host 通信，不共享任何模块。这样 Host 与 Client 可以是任意构建产物形态，互不牵连。Client 的源码在 `src/client/`，`npm run build` 打包成单文件 `lib/client.js` 后才是发布物（不打包 react，仍由 factory 的 `require('react')` 注入）。

---

## 数据模型

### 2.1 待办记录

```json
{
  "id": "ttl_mvzykkvl010p50sy",
  "title": "写插件文档",
  "project": "工作",
  "files": ["src/auth/login.ts"],
  "priority": "high",
  "type": "bug",
  "status": "pending",
  "createdAt": "2026-11-03T00:37:49.000Z",
  "completedAt": null,
  "updatedAt": "2026-11-03T00:37:49.000Z"
}
```

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 必填、唯一 | `ttl_` + 时间 base36 + 计数器 + 随机盐；缺失时自动重建 |
| `title` | string | 1–200 字符 | 连续空白折叠为一个空格；空标题/超长拒绝 |
| `project` | string | 0–40 字符 | 项目分类名；`''` 表示**未分类**（UI 显示「未分类」）；控制字符/连续空白会归一化；超长或非字符串拒绝 |
| `files` | string[] | 0–20 个 | **工作区相对路径**（POSIX 分隔符）；绝对路径、盘符、`..` 一律拒绝；重复项自动去重；只给 `files` 不给 `project` 时分类取首个文件所在目录 |
| `priority` | `'' \| 'high' \| 'medium' \| 'low'` | 默认 `''` | 优先级；`''` = 未设置；UI 显示「高/中/低」；非法值拒绝（HTTP 400 `PRIORITY_INVALID`）；排序 high > medium > low > 未设置（未设置始终置尾） |
| `type` | `'' \| 'bug' \| 'feature' \| 'improvement' \| 'question' \| 'chore' \| 'other'` | 默认 `''` | 类型；UI 显示「缺陷/新功能/改进/疑问/杂项/其他」；`''` = 未设置；非法值拒绝（HTTP 400 `TYPE_INVALID`）；支持类型筛选与搜索命中 |
| `status` | `'pending' \| 'completed'` | 必填 | 未完成 / 已完成；非法值按 `pending` 兜底 |
| `createdAt` | ISO-8601 UTC string | 必填 | 创建时自动写入；缺失/非法按「当前时间」补齐并提示 |
| `completedAt` | ISO-8601 UTC string \| null | 完成时必填 | **未完成时恒为 `null`**（UI 显示 `-`）；完成时间早于创建时间时修正为创建时间 |
| `updatedAt` | ISO-8601 UTC string | 必填 | 任何修改（改名/完成/取消完成）刷新 |

### 2.2 磁盘信封

```json
{
  "version": 5,
  "updatedAt": "2026-11-03T00:37:56.011Z",
  "todos": [ /* Todo[] */ ]
}
```

版本迁移：`version: 1`（无 `project`）、`version: 2`（无 `files`）、`version: 3`（无 `priority`）、`version: 4`（无 `type`）都会自动迁移为内存中的 v5 记录，各自给出一次提示，下一次写入即落盘为 v5；不支持的版本号（例如 99）不会被猜测，而是归档备份后重建空列表。**注意**：v5 文件对旧版插件属于「不支持版本」（旧版会归档重建），升级前确认没有旧 Host 与本插件并存。

写入策略：**临时文件 + rename 原子替换**（Windows 下 rename 失败时回退为覆盖写），全部写操作串行化在一条 Promise 链上，保证落盘顺序与内存顺序一致。读取时逐条用 `normalizeTodo()` 校验修复；JSON 损坏备份为 `todos.json.corrupt-json-<ts>`、结构异常备份为 `.corrupt-shape-<ts>`、版本不支持备份为 `.corrupt-version-<n>-<ts>`，然后重建空列表。

### 2.3 状态机

```text
(新建) --create--> pending --complete--> completed
                     ^                        |
                     +------ uncomplete ------+   （清空 completedAt，并提示）
```

重复操作（对已完成再 complete / 对未完成再 uncomplete）**不写盘**，返回结构化错误码 `ALREADY_COMPLETED` / `ALREADY_PENDING` 与中文说明。

### 2.4 时间约定

- 存储：ISO-8601 UTC（跨时区、跨 DST 无歧义）。
- 展示：本地时间 `YYYY-MM-DD HH:mm:ss`；`null` / 空串 / 非法值一律 `-`。
- 排序：按绝对时间比较；`completedAt` 排序时未完成项（空值）**始终排在最后**，升降序都一样。

---

## 关键代码

### 3.1 一个操作，两个调用方

dsh 的实践要求「同一操作只实现一次」。本插件的唯一实现在 `lib/index.js` 的 `executeTodoAction(store, action, payload)`：

```js
export async function executeTodoAction(store, action, payload = {}) {
  const body = payload && typeof payload === 'object' ? payload : {};
  switch (action) {
    case 'list':   /* …返回 { ok, todos, stats, notices, timeFormat } */ break;
    case 'create': return store.create({ title: body.title });
    case 'complete': return store.complete(body.id, { at: body.at });
    // get / uncomplete / update / delete / health …
  }
}
```

- **Web UI** 走 `createHttpHandler(store)`（注册在 `webServer` 的 `prefix` 路由 `/api/dsh-todo-time-log`）；
- **智能体** 走 `createTodoTool(store)`（注册在 `tools`，工具名 `todo_time_log`）。

两条路径都只是包壳：HTTP 把结果映射成 `{ok,value}` / `{ok,error}` 与状态码，工具把结果加上本地时间字段再交给 `output.render()` 生成文本。因此不存在「UI 能做的工具做不到」或两边行为漂移的问题。

### 3.2 Host 入口

```js
export const name = 'dsh-todo-time-log';
export const inject = ['webServer', 'tools'];   // 缺任一服务时保持 pending，而不是崩溃

export function apply(ctx, config = {}) {
  const dataFile = resolveDataFile(config);
  const store = new TodoStore({ dataFile, logger: createLogger(ctx) });

  ctx.effect(() => {                              // 载入数据 + 卸载时收尾
    store.load();
    return () => { store.dispose(); };
  });

  mountOn(ctx, ['webServer'], (scope) => {        // 路由：供 UI 调用
    scope.effect(() => scope.webServer.register({
      kind: 'prefix', path: ROUTE_PREFIX,
      handler: createHttpHandler(store, {
        // 宿主认证：connection 缺失或抛错一律拒绝，不退回到 Host/Origin 自检
        authorize: (req) => {
          const connection = ctx.get('connection');
          if (!connection) return 403;
          return connection.requestRejection(req) ?? undefined;
        },
      }),
    }));
  });

  mountOn(ctx, ['tools'], (scope) => {            // 工具：供智能体调用
    scope.effect(() => scope.tools.register(createTodoTool(store)));
  });
}
```

### 3.3 异常兜底矩阵

| 场景 | 行为 |
| --- | --- |
| 创建时间缺失 / 非法 | 用当前时间补齐，列表返回一次性提示「创建时间缺失或非法，已按当前时间补齐」 |
| 完成时间早于创建时间 | 修正为创建时间，提示「完成时间早于创建时间，已修正为创建时间」 |
| 已完成但没有完成时间 | 回退为创建时间，并提示 |
| 未完成却带完成时间 | 清空完成时间，并提示 |
| 重复标记完成 / 重复取消完成 | 不落盘，返回 `ALREADY_COMPLETED` / `ALREADY_PENDING` + 中文说明 |
| 标题为空 / 全空白 / 超 200 字符 | 返回 `TITLE_REQUIRED` / `TITLE_TOO_LONG`（HTTP 400） |
| 待办不存在 / 已删除 | 返回 `NOT_FOUND`（HTTP 404） |
| 数据文件 JSON 损坏 / 结构异常 / 版本不支持 | 分别备份为 `.corrupt-json-<ts>` / `.corrupt-shape-<ts>` / `.corrupt-version-<n>-<ts>`，重建空列表并提示 |
| 分类非字符串 / 超 40 字符 | 返回 `PROJECT_INVALID` / `PROJECT_TOO_LONG`（HTTP 400） |
| 旧版本 v1 数据 | 自动迁移为 v2（`project: ''`）并提示，下次写入落盘 |
| 磁盘写入失败 | 内存变更保留、提示「数据已更新但写入磁盘失败，将在下次写入时重试」，并在 `/health` 的 `lastPersistError` 暴露 |
| 待办数量超上限（5000） | 返回 `TOO_MANY_TODOS`（HTTP 409） |

> 修复/异常提示只投递一次：`TodoStore` 用「pending 队列」把载入期修复提示交给下一次 `list()`，诊断历史仍保留在 `describe().loadNotices`，避免每次刷新都刷提示。

### 3.4 Client 半（槽位注册）

```js
window.__ModuleLoader__.load({
  id: 'dsh-todo-time-log',
  factory(require) {
    const React = require('react');
    // …组件、i18n、HTTP helper…
    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('main', () => ctx.slots.register(
          { name: 'main', key: 'dsh-todo-time-log' }, Panel));           // 中央面板
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
          { name: 'sidebar.panellist', id: 'dsh-todo-time-log', order: 30,
            label: () => '待办时间日志' }, Icon));                         // 侧边栏入口
      },
    };
  },
});
```

侧边栏 list 槽的 id 与 `main` keyed 槽的 key 相同，宿主据此把点击事件路由到本面板（与官方 `dsh-context` 插件一致的模式）。面板样式只用 `--dsw-alias-*` 主题 token、类名统一 `ttl-` 前缀，随宿主明暗主题切换。

**源码与产物**：上图的单文件模块表是构建产物 `lib/client.js`，源码在 `src/client/`（入口 / 面板 / 四视图 / 小组件 / i18n / 样式等 ES 模块）。`npm run build` 用 esbuild 打包回同一形态（IIFE、`charset=utf8`、不 minify、不打包 react），发布物与加载方式都不变；`lib/client.js` 不要手改。

### 3.5 甘特图视图（纯前端计算，不新增接口）

数据仍来自 `POST /list`（固定 `filter=all`、`sortBy=createdAt`、`direction=asc`，并带上当前分类筛选），客户端自己算几何：

| 规则 | 实现 |
| --- | --- |
| 条形区间 | `start = createdAt`，`end = completedAt ?? now`；未完成条形延伸到「现在」，右缘虚线 + 「进行中」标记 |
| 时间域 | 所有条形 `[min(start), max(end)]`，两端各留 5% 余量；零跨度（全部同一时刻）自动左右各扩展 30 分钟，避免除零 |
| 刻度 | 依据总跨度自动选步长（分钟 → 小时 → 天），目标 6–10 个刻度；标签 `MM-DD HH:mm`，跨度 > 30 天时用 `MM-DD` |
| 「现在」线 | 时间域包含当前时刻时绘制竖线 + 标签 |
| 范围筛选 | 全部 / 近 7 天 / 近 30 天：保留 `[start, end]` 与窗口相交的条目 |
| 分组 | 按项目分组，组标题显示分类名/未分类与条数 |
| 兜底 | `createdAt` 不可解析 → 跳过该条；`completedAt` 非法或早于 start → 按「现在」兜底 |
| 无障碍 | 条形 `role="img"` + `aria-label`（分类/标题/创建/完成或进行中）+ `title` 悬浮提示 |
| 行内操作 | 左侧标签是 `<button>`（`aria-expanded`/`aria-controls`），点击标签或整行展开行内详情：分类/状态/创建/完成/用时/id + 完成/取消完成、编辑（标题+分类）、删除（二次确认）；展开状态按 id 记录并与表格视图独立 |

### 3.6 项目分类（项目字段，v2 起）

- 分类存储在每条待办的 `project` 字段（`''` = 未分类），随记录持久化；`/list` 额外返回 `projects: [{name, count, pending, completed}]` 汇总（**按全量数据统计**，不受当前筛选影响，未分类排最后）。
- HTTP / 工具契约（与 UI 共用同一实现 `executeTodoAction`）：

| 操作 | HTTP body | 工具参数 | 说明 |
| --- | --- | --- | --- |
| 列表 | `{filter?, sortBy?, direction?, project?}` | `action=list` + 同名字段 | `project` 省略 = 全部；`''` = 只看未分类；`sortBy` 支持 `createdAt/completedAt/updatedAt/title/project/priority`（`project` 未分类置尾、`priority` 未设置置尾） |
| 新建 | `{title, project?, files?, priority?, type?}` | `action=create` | 分类 / 优先级 / 类型可选；`files` 为工作区相对路径数组，只给 files 时自动派生分类 |
| 快速添加 | `{text, workspace?, priority?, type?}` | `action=quick_add` + `text` | 自然语言解析（与面板、`/todo` 命令同一实现），`!优先级` / `^类型` 标记优先、否则回退 `body.priority` / `body.type`；返回 `created/skipped/errors` |
| 文件列表 | `{query?, limit?, workspace?}` | — | `@` 补全用；`workspace` 只接受 `/workspaces` 给出的候选路径 |
| 项目建议 | `{workspace?}` | — | 分类选择器 / `#` 补全用；返回已用分类、工作区名、顶层文件夹（`used`/`workspace`/`folder`） |
| 编辑 | `{id, title?, project?, files?, priority?, type?}` | `action=update` | **部分更新**：只传 `project` / `priority` / `type` / `files` 也能改；都没变化返回 `ok:true` + `unchanged:true` |
| 校验失败 | `PROJECT_INVALID` / `PROJECT_TOO_LONG` / `PRIORITY_INVALID` / `TYPE_INVALID` → HTTP 400 | 同 | 分类必须是字符串且 ≤ 40 字符；优先级必须是 `''/high/medium/low`；类型必须是 `''/bug/feature/improvement/question/chore/other` |

UI 侧：**分类是可选的选择器，不用手打**——

- 新建表单与行内编辑用同一个项目选择器：`未分类` → 已用分类（带使用次数，排最前）→ **已注册工作区名**（就是左侧工作区/项目，如 `dsh-todo-time-log`、`File_Manager_Legacy`）→ **当前工作区顶层文件夹**（如 `lib`、`docs`、`test`）→ `自定义…`（切到文本框，仍可自由输入）。
- 对话里输入 `#` 会出现分类补全下拉（同 `@` 的操作方式），名称含空格时自动用 `[名称]` 形式插入。
- 工具栏分类筛选（含各分类计数与「未分类」），行内分类徽标，详情显示分类，`sortBy=project` 时列表也按分类分组。

建议来源由 `POST /projects` 提供（`{workspace?}` → `{workspace, suggestions:[{name, source:'used'|'workspace'|'folder', count}]}`）：名称去重（大小写不敏感）、长度 ≤40，未知工作区返回 400 `WORKSPACE_UNKNOWN`。

### 3.7 四视图：表格 / 看板 / 甘特图 / 日历

工具栏分段控件切换视图（`button` + `aria-pressed`），默认表格；**切换视图不丢状态**（筛选/排序/方向/分类筛选全部保留）。取数策略：表格与看板使用工具栏的筛选（看板在客户端分列，但状态筛选照常透传，不会「切到看板就静默失效」），甘特/日历取全量（`filter=all`），排序方向只影响表格；分类筛选在所有视图都透传。搜索是纯客户端过滤（标题 / 分类 / 文件路径），对四个视图同时生效。

| 视图 | 布局与语义 | 专属控件 | 每项可做的操作 |
| --- | --- | --- | --- |
| **表格** | 表头「标题 / 分类 / 状态 / 创建时间 / 完成时间 / 操作」，窄屏横向滚动；标题点击展开详情行；`排序=分类` 时按分类分组（方向生效，未分类最后） | 筛选（全部/未完成/已完成）、排序字段、方向；点表头也可排序（与工具栏单一状态源，`th` 带 `aria-sort`） | 完成/取消完成、编辑（标题+分类行内输入）、删除（二次确认）、详情 |
| **看板** | 列式看板：列头 = 状态点 + 名称 + 计数 + 「＋」列内新建；卡片 = 24×24 完成 checkbox + 标题（2 行）+ 一行元信息（**类型徽标 / 优先级徽标** / 分类点或状态徽标 + **已进行 / 用时**）+ 文件 chips（1 个 + N）+ 「⋯」更多操作（编辑 / 优先级 / 类型 / 移到分类 / 删除，删除二次确认）；已完成列默认最近 10 条 + 「显示全部/只看最近」；列宽 `clamp()` + 横向 scroll-snap，≤560px 单列堆叠；**状态 × 分类泳道**（两列固定、行 = 分类、可折叠、未完成泳道带「＋」）；**密度** 舒适/紧凑（紧凑 = 标题 1 行、隐藏文件 chip 与分类名）。**不做指针拖拽**：两列板上拖拽≈点完成；移动改走「⋯ → 移到分类」（单指针替代，WCAG 2.5.7） | 分组方式：**按状态**（默认）/ **按分类** / **状态 × 分类**（泳道）；密度（舒适/紧凑）；类型筛选；面板内快捷键：`/` 搜索、`n` 新建、`f` 循环筛选 | 完成/取消完成（checkbox）、编辑/删除（更多操作）、设优先级/类型、移到分类（带撤销 toast）、列头/泳道快捷新建、列内滚动、状态筛选 |
| **甘特图** | 时间轴条形，见 §3.5；按分类分组 | 时间范围（全部/近 7 天/近 30 天） | 展开行内详情后可完成/编辑/删除 |
| **日历** | 月视图，周一起始 42 格（前后月补格弱化、今天标记）；每格最多 3 条 + 「+N」；点某天在下方展开当天全部条目；**按本地时区**落格 | 上一月 / 今天 / 下一月；落格依据：**按创建时间**（默认）或 **按完成时间**（按完成时未完成条目不出现） | 当天面板内完成/编辑/删除 |

任何视图的空数据都显示空态，非法/缺失时间一律跳过或兜底，不会抛错（面板还有错误边界）。

### 3.8 对话式录入 / `@文件` / `/todo` 命令（Host 统一解析）

**解析只有一份实现**：`lib/parse.js` 的 `parseQuickAdd()`，三个入口共用 —— 面板「对话录入」（`POST /quick-add`）、Harness 主输入框的 `/todo` 命令（注册在 `ctx.commands`）、智能体工具的 `action=quick_add`。UI 不再本地解析，避免两边规则漂移。

```text
新任务 写周报 #工作 @src/auth/login.ts
修复登录缺陷 #工作 !high ^bug
买牛奶 @生活；回邮件 [工作]
项目：学习 整理笔记，读完第三章
```

| 规则 | 说明 |
| --- | --- |
| 多条 | 换行、`；`、`;` 拆成多条 |
| 分类标记 | `#名称` / `@名称` / `[名称]` / `项目：名称` / `分类：名称`；**取最左的非空值**，所有标记从标题中剥离 |
| 优先级标记 | `!high` / `!medium` / `!low`（别名 `!h` / `!m` / `!l`、中文 `!高` / `!中` / `!低`）；取最左非空值、从标题剥离；`!important` 不会被误判 |
| 类型标记 | `^bug` / `^feature` / `^improvement` / `^question` / `^chore` / `^other`（中文 `^缺陷` / `^新功能` / `^改进` / `^疑问` / `^杂项` / `^其他`），也支持 `类型：bug` / `type:bug`；取最左非空值、从标题剥离；`^foo` 等未知值保留原文 |
| 文件引用 | `@路径/文件`、`@file.ts` 或命中工作区文件索引的 `@名称` → 记入 `files`；**没有显式分类时，分类自动取该文件所在目录**（`src/auth/login.ts` → `src/auth`；根目录文件用文件名） |
| 含空格的路径 | 用引号形式 `@"docs/My File.md"`（补全下拉选中含空格/`#` 的路径时会自动加引号） |
| 填充词 | 「帮我/请/麻烦/新增/新建/添加/记一下/记录/待办：/新任务/任务/提醒我/todo/task/add」循环剥离 |
| 边界 | 首尾标点与空白去除；只有填充词的行记入 `skipped`（`NO_CONTENT`），不会创建空待办 |
| 结果 | `created`（已创建待办）/ `skipped`（跳过原因）/ `errors`（后端校验失败，如标题超长） |

**`@` 文件补全**：对话输入框里输入 `@` 会显示工作区文件下拉（防抖 150ms，最多 12 条，↑↓/Enter/Tab 选择、Esc 关闭），选中后插入 `@相对路径`。文件列表来自 `POST /files`，由 Host 通过 `ctx.fs` 只读遍历工作区（深度 ≤ 4、最多 2000 条、忽略 `node_modules`/`.git`/`dist` 等、20s 缓存），客户端**不能**指定任意磁盘路径。

**工作区如何确定**：`config.workspaceRoot` > 最近活跃 Live Session 的工作目录（按最后事件时间排序，忽略子代理会话）> `workspaceRegistry` > 进程目录。因为「最近活跃会话」可能漂移，**面板标题行有一个工作区选择器**（来自 `POST /workspaces` 的候选，默认选 active，选中后 `/files` 与 `/quick-add` 都带上该 `workspace`，@ 补全缓存也按工作区隔离）。`/files` 与 `/quick-add` 的 `workspace` 只接受候选路径，未知路径返回 400 `WORKSPACE_UNKNOWN`。

**三个可输入的地方**都支持同一套标记：

1. **顶部新建框**（「输入待办内容，按 Enter 创建」）：输入 `测试 #lib` 或 `@lib/store.js 写文档`，按 Enter 后自动拆出分类/文件，**标题里不会残留 `#lib`**；输入时敲 `#`/`@` 会弹出补全下拉。含标记时走 Host 的 `/quick-add`（多条/跳过/错误汇总进浮层提示 toast），不含标记时按当前选择器创建。
2. **对话录入面板**：同上，另有逐条气泡与撤销。
3. **Harness 主输入框的 `/todo` 命令**：`/todo 写周报 #工作 lib/store.js`，回执列出新建条目。
   - **分类 / 优先级 / 类型都可以点选**：**仅当草稿以 `/todo` 开头时**，在行里输入 `@` 会在平台的 `@` 菜单里追加三组候选——「待办分类」（已用分类 / 工作区；工作区文件夹如 `docs`、`lib`、`test` 属于目录噪音，不会出现）、「待办优先级」（高/中/低）、「待办类型」（缺陷/新功能/改进/疑问/杂项/其他）；选中后自动插入 `#分类 ` / `!high ` / `^bug `，不需要手打标记。普通消息里输入 `@` 不会出现这些分组。平台的触发字符写死为 `/` 和 `@`，**`#` 本身不会弹出菜单**（插件无法新增触发字符），所以点选入口是 `@`。平台菜单会同时展示它自己的文件/会话来源，插件无法移除它们（只能追加自己的分组）。
   - 命令输入框只支持「命令名补全 + 附件」，插件无法注入 `#`/`@` 的行内补全；因此 `/todo` 同时支持手打：`#分类`、**裸写工作区相对路径**（`lib/store.js`，不需要 `@`）、多条用换行或 `；` 分隔。
   - 该命令声明了 `input.attachments`，主输入框里附加/`@` 引用的文件会被接收，并按文件名在工作区索引里解析成相对路径记入 `files`。
   - 命令输入框由 Harness 提供，只支持「命令名补全 + 附件」，**插件无法在那里注入 `#`/`@` 补全**；因此 `/todo` 特意做成「不用补全也好用」：`#分类` 手打即可、**文件直接写工作区相对路径**（`lib/store.js`，不需要 `@`；写法含空格时用 `@"docs/My File.md"`）、多条用换行或 `；` 分隔。
   - 该命令声明了 `input.attachments`，所以在主输入框里**用 `@` 引用/附加的文件**会被接收：插件按文件名在工作区索引里解析成相对路径并记入 `files`。
   - 需要下拉选择/补全时用插件面板（分类选择器 + `#`/`@` 补全）。

服务端兜底：即使调用方把带标记的文本直接发给 `POST /create`（例如旧版界面或工具调用），Host 也会自动解析拆分，不会把 `#分类`/`@文件`/`!优先级`/`^类型` 记进标题。分类优先级：标题里的显式标记 > 表单选择器 > （都不给时）由文件目录派生；优先级与类型同理：显式标记 > 表单选择器 > 未设置。

### 3.9 界面层级与完成反馈（视觉重构）

面板只有三层信息，按「第一眼该看什么」排序：

```text
① 页头        标题（20/600）+ 一行本地时间说明   ── 右侧只放一个次要入口「对话录入」
② 新建待办    输入框 + 分类选择器 + 添加        ── 页面级唯一的主操作（实心按钮）
③ 数据卡片    视图分段 · 筛选分段（带计数）     ── 视图控制与列表同属一张卡片
               分类筛选 / 排序 / 方向 · 列表
```

规则（对应 `test/client-audit.mjs` 的静态门禁）：

- **一张卡片**：工具栏与表格/看板/甘特/日历同属 `.ttl-data`，四视图不再各自叠一层边框；`.ttl-data` 只保留 0.5px 微边框。
- **唯一主操作**：页面级 `.ttl-button-primary` 只有「添加」一个；其余按钮一律 ghost / outline / 文本链接（对话录入展开后，其卡片内的「发送」也是 primary —— 属于该卡片自己的操作区，不是页面级主操作）。
- **统计并入筛选**：`全部/未完成/已完成` 分段上直接显示计数（`stats.*` 不再单独渲染成一张卡），标签与筛选文案是同一套 key；**分类筛选生效时计数换成该分类的口径**（`/list` 的 `projects[]` 汇总），该分类一条待办都没有时显示 0，不会出现「计数 4、行数 0」。
- **分段控件**：视图（4 项）与筛选（3 项）用 `.ttl-seg` + `aria-pressed`，选中态是「浅底 + 阴影」而不是和 hover 相同的底色；方向（2 项）收成 28×28 的 ↑/↓ 按钮，不再占一个 select。
- **状态徽标**：未完成 = 中性浅底深字，已完成 = 成功色浅底深字（`.ttl-badge`，圆角胶囊），分类徽标降级为弱化文本，避免与状态抢注意力。
- **看板卡片摘要化**：状态/分类徽标只在「列没有表达该字段」时出现（按状态分组 → 分类点 + 名称；按分类分组 → 状态徽标）；创建/完成时间不再常驻，改为「已进行 X / 用时 X」（完整时间进 `<time aria-label>` 与详情）；文件 chip 最多 1 个 +「+N」；编辑/删除收进「⋯」更多操作，卡片正面只留一个 24×24 完成 checkbox（每卡 tab stop 从 3+ 降到 2）。
- **看板列头与收纳**：状态点 + 名称 + 计数（`aria-label` 整句「未完成，共 3 条待办」）+「＋」列内新建（分类列预填分类）；已完成列默认最近 10 条 +「显示全部（N）/只看最近 10 条」；列体是可聚焦滚动区域（`role="group"` + `tabIndex` + `aria-label`）；≤560px 单列堆叠，避免横向 + 纵向双轴滚动。
- **搜索**：工具栏搜索框匹配标题/分类/文件路径（客户端过滤，与状态/分类筛选 AND），实时显示「N 条匹配」，无结果空态带「清除搜索」，`Escape` 清空。
- **泳道（状态 × 分类）**：两列固定（未完成/已完成），列内按分类分泳道；泳道头 = 折叠按钮（`aria-expanded`）+ 名称 + 计数 + 未完成泳道的「＋」；未分类泳道最后；窄屏单列堆叠时泳道自然退化为小节。
- **移动与优先级**：按分类分组/泳道时，「⋯」里有「移到分类」select（未分类 + 现有分类），写回 `project` 并给带撤销的 toast；卡片与新建/行内编辑都有优先级 select（高/中/低/未设置），卡片元信息显示优先级徽标（颜色只是辅助，始终带文字）。
- **类型（bug / 新功能 / 改进 / 疑问 / 杂项 / 其他）**：卡片/表格/详情显示类型徽标（缺陷红、新功能蓝、改进绿、疑问橙、杂项/其他中性，均带文字）；「⋯」与新建/行内编辑可改；工具栏「类型筛选」客户端过滤（全部/未设置/六类），搜索也能命中类型名（如搜「缺陷」）；快捷添加用 `^bug` 等标记。
- **密度**：看板工具栏「密度（舒适/紧凑）」；紧凑 = 标题 1 行、隐藏文件 chip 与分类名文字（保留状态点）、内边距收紧，状态跨视图保留。
- **面板内快捷键**：`/` 聚焦搜索、`n` 聚焦新建、`f` 循环切换筛选；只在面板根节点 `onKeyDown` 处理（焦点在输入类元素或带修饰键时忽略），不注册 document 监听。
- **时间列右对齐** + `font-variant-numeric: tabular-nums`；表格行高 44px、表头 36px。
- **圆角同心**：新建卡片外层 16 = 内层 8 + 内边距 8；数据卡片 12，控件 8，分段轨道 8 / 分段 6（8 = 6 + 2）。
- **全部颜色走 token**：`--dsw-alias-*` + `color-mix()` 调透明度，无硬编码 hex/rgb；明暗主题都可用。
- **五态齐全**：理想 / 空（原因 + 一个出口按钮）/ 骨架屏（行高列宽对齐真实表格）/ 错误（重试）/ 窄屏（工具栏换行、表格内部横向滚动）。

**完成反馈改成 toast（不改变布局高度）**：

- 旧实现把提示条插在新建框与对话录入之间（正常文档流），每次「完成」都会把整张表向下推 ~49px、3.5s 后再弹回。
- 现在提示挂在 `.ttl-root` 下的 `.ttl-toast-host`（`position: absolute; bottom: 44px`，与 `.ttl-scroll` 同级；44px = lv3 阴影偏移 12 + 模糊 32，正好不被 `overflow: hidden` 裁掉），因此**出现/消失都不会新增或移除文档流节点**；面板滚动时它固定在面板底部。
- 视觉沿用宿主系统 toast 的 token（`--dsw-alias-toast-bg` / `--dsw-alias-toast-label` / `--dsw-shadow-lv3`），成功/失败/中性各一个 14px 图标（成功绿、失败红）。
- 完成后 toast 里带「撤销」：直接调用 `uncomplete` 并刷新，和行内「取消完成」走同一条 `handleToggle`；带撤销时停留 6s，普通提示 3.5s，错误 6s。
- 无障碍：宿主容器常驻 `aria-live="polite"` + `aria-atomic="false"`，成功/中性节点 `role="status"`，错误节点 `role="alert"`；关闭按钮有 `aria-label`；`prefers-reduced-motion` 下关闭入场动画，且不把焦点移到 toast。

渲染预览见 [`docs/preview/`](./preview/README.md)（真实 `client.js` + 宿主主题 token 的静态渲染）。
