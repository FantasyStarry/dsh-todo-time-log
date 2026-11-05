# 待办时间日志 · dsh-todo-time-log

一个 [DeepSeek Harness](https://github.com/deepseek-ai)（dsh）插件：查看待办事项，并**自动记录、清晰展示**每个待办的创建时间与完成时间。

| 项 | 值 |
| --- | --- |
| 插件 ID / 包名 | `dsh-todo-time-log` |
| 兼容性 | DSH `>=0.2.0-rc.2 <0.2.3-0`（`engines.dsh` 声明；已在 DSH **0.2.2-rc.1** 真机验证，见 §7 九期记录） |
| 中文显示名 | 待办时间日志 |
| 短别名 | `todo-time-log`、`ttl`（文档与工具前缀用；dsh 的 Entry / Slot / Tool 标识统一用包名） |
| 数据文件 | `<DSH_PROFILE_DIR 或 ~/.dsh>/todo-time-log/todos.json`（可用环境变量或行配置覆盖） |
| HTTP 接口 | `POST /api/dsh-todo-time-log/*`（**经宿主认证**：每条请求先过 `connection.requestRejection()`，无登录 cookie 返回 401、跨站/不可信来源返回 403） |
| 智能体工具 | `todo_time_log`（action = list / get / create / complete / uncomplete / update / delete / health） |
| UI 位置 | 中央面板 `main`（key = `dsh-todo-time-log`）+ 侧边栏图标 `sidebar.panellist`（id 同名，点击打开面板） |
| 视图 | 四视图：**表格 / 看板 / 甘特图 / 日历**（甘特条 = 创建 → 完成，未完成延伸到「现在」；四视图内均可完成/编辑/删除） |
| 项目分类 | 每条待办可带 `project` 分类；支持分类筛选、分类分组、分类统计；**`@文件` 时自动取该文件所在目录作为分类** |
| 界面层级 | 页头（标题 + 本地时间）→ **新建待办**（整页唯一主操作）→ **数据卡片**（四位视图分段控件 + 筛选计数 + 列表）；统计数并入筛选分段，不再单独占一张卡片 |
| 完成反馈 | **浮层 toast**：绝对定位、不占文档流，出现/消失都不改变页面高度；成功/失败/中性三种图标，完成后可「撤销」，可手动关闭，3.5–6 秒自动消失 |
| 文件引用 | 每条待办可带 `files: string[]`（工作区相对路径）；对话里输入 `@` 有文件补全下拉 |
| 录入方式 | 表单新建、对话式录入（面板内「对话录入」：`新任务 xxx #分类 @工作区文件`）、`/todo` 斜杠命令、智能体工具 `todo_time_log`（含 `quick_add`） |

> 命名说明：dsh **不会**自动加命名空间前缀——现有插件的 Entry id、Slot id 都等于包名（例如 `dsh-context`、`dsh-cost-meter`）。因此本插件保留 `dsh-todo-time-log` 作为 ID，`todo-time-log` / `ttl` 只作为短别名。

---

## 1. 目录结构

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
│   ├── parse.test.mjs      # 自然语言解析 / 文件路径 / 分类派生（79 断言，node:test）
│   ├── smoke.test.mjs      # 数据层 / 时间 / 修复 / 分类 / 文件 / 迁移 / 持久化（174 断言）
│   ├── http.test.mjs       # 真实 HTTP 路由端到端（66 断言）
│   ├── store-concurrency.test.mjs  # 跨进程写入：mtime 合并 + 文件锁（8 用例）
│   ├── ui/                 # jsdom + 真实 React 渲染 lib/client.js 的验收 harness（4 用例）
│   ├── live-utf8.py        # 对运行中实例的真实 UTF-8 往返检查（需 DSH_WEB_URL）
│   ├── live-projects.py    # 对运行中实例的分类/迁移/筛选真实往返检查
│   └── client-audit.mjs    # client.js 静态审计（i18n 成对/死键、require、token、四视图）
├── docs/
│   ├── verification.md     # 独立验证报告（另一个 agent 产出，含 PASS/FAIL/盲区）
│   ├── publishing.md       # npm 发布流程：bootstrap / Trusted Publisher / 版本策略 / 排错
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

## 2. 数据模型

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

## 3. 架构与关键代码

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

渲染预览见 [`docs/preview/`](./docs/preview/README.md)（真实 `client.js` + 宿主主题 token 的静态渲染）。

---

## 4. 安装

```text
plugin_manager action=install_bundle target=D:\code\dsh-todo-time-log
```

- 安装会做包安装（pnpm）、写入 `dsh.bundle.patch` 声明的行并启用 bundle；返回 `application: "applied"` 才算生效。
- **兼容性门禁**：包清单用 `engines.dsh` 声明支持的 DSH 版本范围（当前 `>=0.2.0-rc.2 <0.2.3-0`）。DSH 在 profile 启动时按「已安装版本的 `engines.dsh`」做 preflight，不满足的插件会被禁用并在 `plugin_manager` 里显示 `incompatible-version`；升级 DSH 后若出现该提示，请安装声明范围覆盖新 DSH 的插件版本（本仓库的兼容性复核与发版流程见 §7 / §8）。
- 本插件是**本地目录**安装（link 方式），修改 `lib/*.js` 后需要在 Plugin Manager 里把该插件 **关闭再开启**，或重启桌面端，才能让 Host 半加载新的模块实例；Client 半在同一次页面刷新后生效（`dsh.client.immediately`）。
- 验证入口：Plugin Manager 搜索「待办时间日志」应看到中文标题、描述与图标；左侧导航出现同名入口。
- 卸载：`plugin_manager action=remove_bundle target=dsh-todo-time-log`（数据文件保留，手动删除即可清空）。

### 配置

| 来源 | 优先级 | 示例 |
| --- | --- | --- |
| `cordis.patch.yml` 行配置 `config.dataFile` | 最高 | `config: { dataFile: 'D:/data/todos.json' }` |
| 环境变量 `DSH_TODO_TIME_LOG_DATA` | 中 | `DSH_TODO_TIME_LOG_DATA=D:\data\todos.json` |
| 默认 | 最低 | `<DSH_PROFILE_DIR 或 ~/.dsh>/todo-time-log/todos.json` |

相对路径会解析到配置目录下。当前构建**未导出 `Config` schema**（见 §6 TODO），所以插件详情页不会出现配置表单，配置通过上述两种外部方式提供。

---

## 5. 测试

### 5.1 自动化

```bash
npm run build     # esbuild：src/client/ → lib/client.js（单文件产物）
npm run check     # 六个 lib 文件（time/parse/files/store/index/client）的 node --check
npm run lint      # ESLint（flat config；构建产物 lib/client.js 不直接 lint，lint src/client/）
npm run typecheck # tsc --checkJs：Host 模块的 JSDoc 类型检查
npm test          # node:test：解析 / 数据层 / HTTP / UI 渲染 / 并发写入（331 用例）
npm run test:coverage  # 同上 + Node 内置覆盖率（--experimental-test-coverage）
npm run audit     # client.js 静态审计（28 项）
npm run verify    # 以上全套（build + check + lint + typecheck + test + audit；prepublishOnly 同）
```

覆盖内容：

- `test/parse.test.mjs`（79 用例）：多条拆分、分类标记最左优先且全部剥离、`@文件` 与 `@分类` 判定、文件路径归一化/拒绝绝对与穿越路径、分类派生规则、**优先级标记**（`!high/!medium/!low`、别名与中文、最左优先、`!important` 不误判）、**类型标记**（`^bug/^feature/...`、中文别名、`类型：bug`/`type:bug`、未知值不误判）、工具 `quick_add` 路径。
- `test/smoke.test.mjs`（174 用例）：创建/校验/完成/重复完成/取消完成/重复取消/改名/删除/筛选/排序（含空值置尾）/stats、时间格式与空值、损坏 JSON 备份重建、结构异常 JSON 归档、重复 id 拆分、记录修复（缺 createdAt、完成早于创建、非法状态、非法 priority/type）、修复提示只投递一次、持久化重载、`resolveDataFile` 优先级、分类校验/归一化/筛选/统计/按分类排序（未分类置尾）、**priority/type 校验/归一化/部分更新**、按优先级排序（未设置置尾）、`files` 校验与派生分类、v1–v4→v5 迁移落盘、不支持版本归档。
- `test/http.test.mjs`（66 用例）：真实 HTTP 服务上的 prefix 路由、GET health、错误码映射（400/404/405/409）、非法 JSON、数组 body、「HTTP 写入后重新加载可读」，分类/优先级/类型的非法值 400、`sortBy=priority`、只改 priority/type，以及 `/quick-add`（多条 + `#分类` + `@文件` + `!优先级` + `^类型` 标记与表单回退）、`/create` 带 `files`/`priority`/`type`、`/files` 无文件服务时 501。
- `test/store-concurrency.test.mjs`（8 用例）：两个实例交错写同一数据文件时 mtime 合并、同 id 取 `updatedAt` 较新者、`Promise.all` 并发写不损坏不丢、tombstone 防删除复活、陈旧锁清理、锁占用超时后下次写入补齐、写前发现损坏数据不重复归档。
- `test/ui/panel.test.mjs`（4 用例）：jsdom + 真实 React 18 渲染构建产物 `lib/client.js`；覆盖页头/新建框/四视图分段/筛选计数、表格行与时间格式、空态、错误态与重试恢复、看板切换与两列。jsdom 无布局/绘制，视觉回归仍需真机或 Playwright（本轮未接入）。
- `test/client-audit.mjs`（28 项，`npm run audit`）：i18n zh/en 成对与占位符一致、无死键/未声明键、只 `require('react')`、无 `document`/DOM 查询、无硬编码颜色、类名 `ttl-` 前缀、四视图与各渲染器存在、6×7 日历、模块加载器格式与双槽位注册。当前口径：**253 键/语言、24 个 alias token、189 个 `ttl-` className**。
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

1. **甘特图**：切到「甘特图」→ 每条待办一根条形（创建 → 完成）；未完成条形延伸到「现在」并标「进行中」；有刻度、「现在」竖线、按分类分组标题；切「近 7 天 / 近 30 天」条形随之变化；悬停有条目标题提示；无数据时显示空态。
2. **分类**：新建时填分类（或用 datalist 选已有分类）→ 行上出现分类徽标；工具栏分类筛选选「工作」只剩该分类，选「未分类」只剩 `project=''`；行内编辑同时改标题与分类并保存；`排序=分类` 时列表按分类分组；详情里能看到分类。
3. **对话录入**：展开「对话录入」→ 输入 `帮我记一下 写周报 #工作；买牛奶 @生活` 发送 → 助手气泡列出两条（带分类与创建时间）→ 点「撤销」两条消失并提示「已撤销 2 条」；输入只有填充词（如「帮我记一下」）→ 提示示例；输入 `[] 空分类测试` → 标题为「空分类测试」且归入未分类。

UI 手测清单（三期四视图，**需先刷新页面**）：

1. **视图切换**：四个按钮「表格/看板/甘特图/日历」切换正常，默认表格；先设好筛选=未完成、排序=创建时间、分类=工作，再逐个切换视图，回到表格后这些条件仍在。
2. **表格**：点「创建时间」表头 → `aria-sort` 与箭头/方向变化，工具栏排序 select 同步；再点一次方向反转；窄屏下表格横向滚动且不撑破页面；行内编辑改标题与分类能保存；删除需二次确认；展开详情能看到分类/创建/完成/更新/用时/id。
3. **看板**：切「按状态」→ 未完成/已完成两列且计数正确；切「按分类」→ 各分类列 + 未分类列（未分类在最后）；卡片上点完成/编辑/删除都能生效；列内条目多时列内滚动。
4. **甘特图**：点某行标签 → 展开行内详情并可完成/编辑/删除；展开状态与表格视图的展开互不影响；切「近 7 天」条形随之过滤。
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

UI 手测清单（六期：看板改版，**需先刷新页面**；预览见 `docs/preview/04-board.png` / `12`–`15`）：

1. **卡片摘要化**：切到看板 → 每张卡只有一个完成 checkbox + 标题 + 一行元信息（分类点 + 「已进行 / 用时」）+ 最多 1 个文件 chip；状态徽标只在「按分类」分组时出现。用时核对：已完成卡 = 完成时间 − 创建时间；未完成卡 = 现在 − 创建时间（约 60s 刷新一次）。
2. **操作收敛**：点卡片右上「⋯」→ 展开「编辑 / 优先级 / 删除」（按分类分组时还有「移到分类」）；点编辑进入标题 + 分类 + 优先级行内编辑（Enter 保存 / Esc 取消）；点删除出现「删除后无法恢复。」二次确认；`Escape` 可关闭更多操作与删除确认。
3. **列头与收纳**：未完成/已完成列头有状态点、名称、计数；「＋」在未完成列/分类列点击后聚焦顶部新建框（分类列会预填该分类）；已完成列默认最近 10 条，滚到底显示「显示全部（N）」，展开后可「只看最近 10 条」。
4. **筛选不再静默失效**：先在表格选「已完成」再切看板 → 工具栏仍显示同一筛选且看板只剩已完成列有内容；空列显示「没有符合筛选的待办」；点「全部」恢复。
5. **搜索**：输入「部署」→ 只剩匹配卡片并显示「1 条匹配」；输入不存在的词 → 「没有匹配「…」的待办」+「清除搜索」；按 `Escape` 清空搜索。
6. **窄屏**：把面板拖窄到 <560px → 看板从两列变为单列纵向堆叠，列头置顶，不再需要横向滚动。

UI 手测清单（七期 A/B/C：泳道 / 移动 / 优先级 / 密度 / 快捷键 / v4 迁移，**需刷新页面**；预览见 `docs/preview/16`–`18`）：

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

---

## 6. 已知限制与 TODO（不确定处及适配层）

1. **`Config` schema 形态（TODO config-schema）**
   本构建把「导出普通 JSON Schema 对象」视为非法：行状态曾为 `status: "unsupported"`，激活报 `Cannot read properties of undefined (reading 'validate')`。当前**不导出 `Config`**（`lib/index.js` 导出 `DEFAULT_CONFIG` 常量用于文档化默认值），`Config.listConfigs` 对该行报告 `status: "absent"`，`apply()` 仍防御式读取 `config.dataFile`。
   适配层：把 `DEFAULT_CONFIG` 处注释里的 zod 片段复原并加 `zod` 依赖即可恢复配置表单，插件其余代码无需改动。
2. **`inject` 的对象形式（TODO cordis-inject）**
   `export const inject = { optional: [...] }` 会被当前 Loader 当作依赖名为 `optional` 的服务，导致行永久 `pending`。已改为数组形式 `inject = ['webServer', 'tools']`（缺服务时保持 pending 而非崩溃）。`mountOn()` 仍保留 `ctx.inject([...], cb)` 优先、`ctx.get()` 兜底的适配逻辑。
3. **时区（TODO time-zone）**
   展示固定使用 Host/浏览器本地时区。若将来需要「指定 IANA 时区展示」，只需替换 `lib/time.js` 的 `formatLocalDateTime()` 内部实现（`TODO(time-zone)` 已标注），存储格式无需变更。
4. **Client 文案与 locale 服务（TODO client-locale）**
   UI 文案集中在 `src/client/i18n.js` 的 `I18N` 字典（构建后进入 `lib/client.js`；zh 默认 / en 兜底），暂未接入宿主 Client locale 服务；槽位注册已带 `label` thunk，后续接入时只需把 `t()` 数据源换成宿主 locale。
5. **渲染外观未截图验证**
   已通过 `cordis_inspect_query`（Client Slots）确认 `main` 与 `sidebar.panellist` 的 occupant 均为 `active: true`（说明 `client.js` 已在浏览器里成功加载并注册），但本会话没有浏览器截图能力，**页面视觉外观（间距/主题色/明暗切换）未做像素级验收**，建议首次打开时人工确认。
6. **对话式录入是启发式解析（TODO chat-parser）**
   面板内的自然语言解析是确定性的 Host 侧规则（`lib/parse.js`：`#分类`、填充词剥离、按行/分号拆条、多标记剥离、`@文件` 引用），**不是模型理解**：复杂句式（「下周三之前把报告发给老板」这类含时间/对象语义的句子）只会被当作标题文本。需要真正的语义解析时，走智能体路径（`todo_time_log` 工具，模型自己理解后再结构化调用）；解析器已隔离为纯函数 `parseQuickAdd()`，替换点单一。
7. **文件引用是「工作区相对路径」，不带工作区身份（TODO file-scope）**
   `files: ["lib/store.js"]` 记录的是相对路径；如果你在多个工作区之间切换，同一相对路径在不同工作区可能指向不同文件。当前实现只用于展示/复制路径与分类派生，不解析真实文件，因此不会出错；若要跨工作区精确定位，需要给 Todo 增加 `workspaceRoot` 字段（v4）。
8. **数据文件位置**
   Host 进程通常没有 `DSH_PROFILE_DIR`（它是 profile 启动器的环境变量），因此默认落在 `~/.dsh/todo-time-log/todos.json`；如需按 profile 隔离，请显式配置 `dataFile`。
9. **看板 P1 已落地（七期）**
   「移到分类」（分类分组/泳道下改 `project`，带撤销 toast，作为 WCAG 2.5.7 的单指针替代）；泳道（状态 × 分类，可折叠、未完成泳道可快捷新建）；`/` 搜索、`n` 新建、`f` 筛选三个面板内快捷键；舒适/紧凑密度。指针拖拽仍暂缓（两列板上拖拽≈点完成，成本/收益不匹配），将来若要加，用 HTML5 DnD 且必须保留菜单与键盘路径。
10. **看板剩余 P2（需要继续扩模型）**
    已落地 `priority`（v4）与 `type`（v5，见 §2）；仍待评估：`dueAt`（与日历/甘特时间语义交叉，需先统一「按创建还是按截止」）、`order`（手动排序，需与排序互斥）、指针拖拽增强、多值 `tags`（若单值 type 不够用再考虑 v6）。注意 v5 对旧版插件是「不支持版本」（会归档重建），发布前确认没有旧 Host 共存。

---

## 7. 本机验证记录（2026-11-03，desktop profile；按阶段累积，最新一轮以「八期」相关行为准）

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
| 视觉外观（本次） | [`docs/preview/`](./docs/preview/README.md)：用真实 `client.js` + 宿主真实主题 token 渲染的 **18 张**静态预览（默认/完成 toast/对话/看板/甘特/日历/空/骨架/错误/暗色/窄屏 + 看板更多操作/按分类/窄屏/暗色/泳道/紧凑/移动）+ 改版前对照 | 真机需刷新页面后人工确认 |
| 六期看板静态审计 | `node --check lib/client.js`、`npm test` **49 + 99 + 47**、`npm run audit` **28 项**（i18n **216 键/语言**、24 tokens、177 类名）全通过 | PASS |
| 六期看板渲染验收 | 仓库外 jsdom + 真实 `client.js` + 宿主主题 token：**22 条**交互断言全通过（两列/计数、已完成默认 10 条 + 显示全部、每卡 checkbox/更多/`<time>`、更多操作展开、按分类分组 4 列 + 状态徽标、切回状态分组、看板状态筛选生效/重置、搜索 1 条命中/无结果/Escape 清空、勾选完成后跨列移动与计数）；同一渲染结果产出 `04` 与 `12`–`15` 预览 | PASS（渲染/结构）；真机交互需刷新后人工确认 |
| 七期 Host 契约（priority v4） | `node --check` 3 个 Host 模块通过；`npm test` **61 + 139 + 58** 全绿；v1/v2/v3→v4 迁移、priority 校验/排序/未设置置尾、工具 schema、quick-add 优先级均有断言覆盖 | PASS |
| 七期 A/B/C 静态审计 | `node --check lib/client.js`；`npm run audit` **28 项**（i18n **239 键/语言**、24 tokens、188 类名）；`npm test` **61 + 139 + 58** | PASS |
| 七期 A/B/C 渲染验收 | 同一套 jsdom harness 扩到 **42 条**断言：泳道（≥6 个、折叠/展开）、紧凑密度 class、移到分类写回 + toast + 撤销、`/`/`n`/`f` 快捷键、优先级徽标/卡片 select 写回 + 撤销、新建表单携带优先级、表格排序含优先级；产出 `04`、`12`–`18` 共 11 张看板预览 | PASS（渲染/结构）；真机交互需刷新后人工确认 |
| 八期 Host 契约（type v5） | `node --check` 3 个 Host 模块通过；`npm test` **79 + 174 + 66** 全绿；v1–v4→v5 迁移、type 校验/归一化/部分更新、quick-add 标记与表单回退均有断言覆盖 | PASS |
| 八期类型 UI + @ 菜单渲染验收 | jsdom harness **58 条**断言全绿（类型徽标、类型 select 写回 + 撤销、新建表单携带类型、类型筛选、搜索命中类型名、表格类型徽标；`/todo` 草稿的 `@` 菜单含「待办优先级 / 待办类型」候选，选中分别插入 `!high ` / `^bug `，分类候选行为不变）；`npm run audit` **28/28**（i18n **253 键/语言**、24 token、189 类名）；预览 `04`、`12`–`18` 已按类型徽标重拍 | PASS（渲染/结构）；真机需重启插件 + 刷新页面确认 |
| 九期 DSH 0.2.2-rc.1 兼容性（0.5.2） | 旧 `engines.dsh` 上界 `<0.2.2-0` 会排除预发布 `0.2.2-rc.1`（DSH preflight 用 `semver.satisfies(..., {includePrerelease:true})`），导致插件被禁用；已改为 `>=0.2.0-rc.2 <0.2.3-0` 并升 0.5.2。独立复核：Host 9 个集成点 **0 BREAK / 1 RISK(低) / 8 PASS**（真实 DSH JSON-Schema/工具管线探针 **47/47**）；Client **6/6 PASS**（117 槽目录含 `main`/`sidebar.panellist`、`inputTriggers` 契约 0.2.1→0.2.2 仅 i18n 差异、29/29 主题 token 有定义）；隔离 `DSH_HOME` 真实 0.2.2-rc.1 端到端 **27/27**（安装放行、路由/工具/命令注册、HTTP CRUD 25/25、重启持久化 6/6、client 注入）；反证旧范围被 install preflight 拒绝 + 启动 skip + 路由 404；运行中 desktop 重装 0.5.2 后 live 复验通过（`todo_time_log` 可调用、`/health` loaded 12 条、`main`/`sidebar.panellist` 槽位 active）。详见 [`docs/verification.md` §24](./docs/verification.md) | PASS（契约 + 真机端到端）；浏览器像素级 UI 与真实模型回合调用工具未覆盖 |

---

## 8. 发布 npm 版本

发布由 GitHub Actions 工作流 [`.github/workflows/publish.yml`](./.github/workflows/publish.yml) 自动完成：
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
完整步骤、版本策略、回滚与排错见 [`docs/publishing.md`](./docs/publishing.md)。

[![Publish to npm](https://github.com/FantasyStarry/dsh-todo-time-log/actions/workflows/publish.yml/badge.svg)](https://github.com/FantasyStarry/dsh-todo-time-log/actions/workflows/publish.yml)
