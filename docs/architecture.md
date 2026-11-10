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
│   ├── app.js              # 模块对象：main / sidebar 槽位、快速入口偏好单例与 @ 来源注册
│   ├── panel.js            # 面板主体：状态 / 请求 / 交互（不含四个视图实现），页头「设置」卡也在这里
│   ├── quick.js            # 主输入框旁的快速入口：胶囊（composer.dock）+ 清单卡片（input.overlay），可 mount / unmount
│   ├── prefs.js            # 快速入口偏好控制器（读 / 写 / 应用）+ 模块级单例；不含 UI（开关在面板设置卡里）
│   ├── views/              # table / board / gantt / calendar 四视图
│   ├── widgets.js          # 小组件 / 图标 / 对话录入等
│   ├── detail.js           # 详情区
│   ├── helpers.js          # 时间 / 格式化 / 甘特几何等纯函数
│   ├── i18n.js             # zh / en 文案字典
│   ├── styles.js           # CSS（--dsw-alias-* 主题 token）
│   ├── transfer.js         # 导入 / 导出对话框 + 文件读取 / 下载辅助
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
│   ├── transfer.js         # ★ 导入 / 导出格式：JSON 信封 + CSV 读写（纯函数）
│   ├── settings.js         # ★ Client 偏好：`<dataFile>.settings.json`（信封 v1 + 原子写 + 读改写整体入队）
│   └── client.js           # 构建产物（勿手改；由 src/client/ 打包生成，仍是单文件模块表）
├── test/
│   ├── parse.test.mjs      # 自然语言解析 / 文件路径 / 分类派生（79 用例，node:test）
│   ├── smoke.test.mjs      # 数据层 / 时间 / 修复 / 分类 / 文件 / 迁移 / 持久化（174 用例）
│   ├── http.test.mjs       # 真实 HTTP 路由端到端（77 用例，含宿主认证 401/403）
│   ├── settings.test.mjs   # Client 偏好存储：路径 / 归一化 / 信封落盘 / 损坏回落 / 并发 last-write-wins（15 用例）
│   ├── http-settings.test.mjs # /settings 与 /settings/update 端到端：默认值 / 400 / 501（9 用例）
│   ├── transfer.test.mjs   # 导出 / 导入格式：JSON v1–v5、CSV 转义、别名、非法行
│   ├── store-import.test.mjs # 导入合并策略 / 备份 / 撤销 / 数量上限
│   ├── http-transfer.test.mjs # /export、/import、/restore 端到端
│   ├── store-concurrency.test.mjs  # 跨进程写入：mtime 合并 + 文件锁（8 用例）
│   ├── ui/                 # jsdom + 真实 React 渲染 lib/client.js 的验收 harness（22 用例）
│   │   ├── panel.test.mjs  # 面板：页头 / 新建框 / 四视图 / 空态 / 错误 / 数据对话框 / 行尾菜单 / 对话录入（10 用例）
│   │   └── quick.test.mjs  # 快速入口 + 面板设置卡：计数 / 展开 / 勾掉 + 撤销 / 快速新建 / 空态 / 错误 / Esc / 开关卸载与恢复（12 用例）
│   ├── live-utf8.py        # 对运行中实例的真实 UTF-8 往返检查（需 DSH_WEB_URL）
│   ├── live-projects.py    # 对运行中实例的分类/迁移/筛选真实往返检查
│   └── client-audit.mjs    # client.js 静态审计（i18n 成对/死键、require、token、四视图、快速入口两槽位 + 面板设置入口/设置卡与偏好路由）
├── docs/
│   ├── architecture.md     # 架构与关键代码：目录结构 / 数据模型 / 双调用方入口 / 四视图（本文档）
│   ├── development.md      # 测试（自动化 + 手工验证清单）与 npm 发布流程
│   ├── limitations.md      # 已知限制与 TODO（12 条，含不确定处与适配层）
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

业务备份（与损坏归档分开）：导入 / 覆盖 / 恢复前，在写锁内把当前数据文件复制为 `<dataFile>.bak-YYYYMMDD-HHmmss-SSS`，供「撤销」与手动恢复使用；该文件与数据文件同目录，不进版本库、不自动清理。

### 2.2.1 导入 / 导出

| 层 | 实现 | 说明 |
| --- | --- | --- |
| 格式 | `lib/transfer.js`（纯函数） | JSON 信封（与磁盘同版本 + `exportedAt` / `exporter` 元信息）、CSV（BOM + CRLF + 本地时间）、从 JSON v1–v5 / 裸 `Todo[]` / CSV 解析为规范化记录 |
| 导出 | `POST /export` → `store.refresh()` → `store.list({filter:'all'})` → `exportTodoData()` | 先合并其他实例刚写入的数据，避免导出陈旧快照；JSON 与 CSV 都走同一函数 |
| 预览 | `POST /import { dryRun: true }` | 在写锁外先 `refresh()`，按所选策略计算 plan（新增/更新/跳过/移除），不写盘、不改内存 |
| 导入 | `POST /import` → 写锁内 `mergeIfDiskChanged` → `planImport` → 备份 → 一次性写盘 | `merge`（同 id `updatedAt` 新者胜）/ `add`（已存在即跳过）/ `replace`（整体替换） |
| 撤销 | `POST /restore { file }` | 只接受同目录 `<dataFile>.bak-*` 基名；恢复前再备份当前状态，因此撤销本身也可回退 |
| 上限 | 单次 ≤ 5000 条、请求体 ≤ 8 MiB | 超限分别返回 `TOO_MANY_TODOS` / `PAYLOAD_TOO_LARGE` |

导入记录同样逐条经过 `normalizeTodo()`：非法行被跳过并计数（最多回传 20 条明细与行号），合法行才会进入 plan；CSV 的 `耗时(分钟)` 只是导出的派生列，导入时忽略。

导入 / 导出 / 恢复是 **UI 专用**的 HTTP 路由，不注册到 `todo_time_log` 工具（工具与 CRUD 共用 `executeTodoAction` 的约定不变）。

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

两条路径都只是包壳：HTTP 把结果映射成 `{ok,value}` / `{ok,error}` 与状态码，工具把结果加上本地时间字段再交给 `output.render()` 生成文本。因此不存在「UI 能做的工具做不到」或两边行为漂移的问题（例外：`/export`、`/import`、`/restore` 是 UI 专用的数据传输路由，见 §2.2.1，未注册到工具）。

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
| 待办数量超上限（5000） | 返回 `TOO_MANY_TODOS`（HTTP 409）；导入后超限同样拒绝且不写盘 |
| 导入文件格式非法 / 版本不支持 / 没有有效行 | 返回 `IMPORT_INVALID` / `IMPORT_VERSION_UNSUPPORTED` / `IMPORT_EMPTY`（HTTP 400），不写盘 |
| 导入前备份失败 | 返回 `BACKUP_FAILED`（HTTP 500），导入取消，内存与磁盘都保持原状 |
| 恢复的备份文件名不合法 / 不存在 / 损坏 | 返回 `BACKUP_INVALID`（HTTP 400）；只允许同目录 `<dataFile>.bak-*` 基名，拒绝路径穿越 |

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
        const quickEntry = createQuickEntry(ctx);                        // 快速入口（可 mount / unmount）
        const pref = createQuickEntryPreference(quickEntry);             // 快速入口偏好控制器
        setQuickEntryPreference(pref);                                   // 放进模块级单例，面板「设置」卡订阅它
        void pref.load();                       // 读偏好：开 → quickEntry.mount()，关 → unmount()
        // createQuickEntry 内部再注册两个槽位（见 §3.10）：
        //   conversation.composer.dock   → 「待办」胶囊（常驻）
        //   conversation.input.overlay   → 展开的清单卡片（锚在 composer 上沿之上）
      },
    };
  },
});
```

侧边栏 list 槽的 id 与 `main` keyed 槽的 key 相同，宿主据此把点击事件路由到本面板（与官方 `dsh-context` 插件一致的模式）。面板样式只用 `--dsw-alias-*` 主题 token、类名统一 `ttl-` 前缀，随宿主明暗主题切换。

**快速入口的两处注册**（两处 `id` 都是 `dsh-todo-time-log`）：

| 槽位 | 组件 | 说明 |
| --- | --- | --- |
| `conversation.composer.dock` | `QuickTrigger`（`.ttl-quick-trigger`，`order: 40`） | 输入框下方的常驻「待办」胶囊，显示未完成条数；点击切换清单 |
| `conversation.input.overlay` | `QuickOverlay`（`.ttl-quick-panel`） | 展开的清单卡片，锚在 composer 卡片上沿之上（`position: absolute; bottom: calc(100% + 8px)`），与宿主 `@` 菜单同一套做法，不会被 docked composer 裁切 |

两个槽位都用 `ctx.slots.inject(...)` 包裹（宿主有该槽位才注入），注册失败只 `console.warn`、不影响面板本体 —— 与「缺服务保持 pending 而不是崩溃」的 Host 半约定一致。两个槽位不是直接注册，而是由 `createQuickEntry().mount()` / `unmount()` 按偏好决定挂载（幂等，见 §3.10 的「设置卡」小节）。**开关的 UI 不再是宿主槽位**（十六期删掉了 `settings.general.item` 注册）：它长在面板自己的页头「设置」卡里，见 §3.10。

**源码与产物**：上图的单文件模块表是构建产物 `lib/client.js`，源码在 `src/client/`（入口 / 面板 / 四视图 / 小组件 / i18n / 样式等 ES 模块）。`npm run build` 用 esbuild 打包回同一形态（IIFE、`charset=utf8`、不 minify、不打包 react），发布物与加载方式都不变；`lib/client.js` 不要手改。

### 3.5 甘特图视图（纯前端计算，不新增接口）

数据仍来自 `POST /list`（固定 `filter=all`、`sortBy=createdAt`、`direction=asc`，并带上当前分类筛选），客户端自己算几何：

| 规则 | 实现 |
| --- | --- |
| 条形区间 | `start = createdAt`，`end = completedAt ?? now`；条形按当前时间域裁剪，未完成条右缘虚线表示仍在进行 |
| 时间域 | 今天 / 近 7 天 / 近 30 天：本地自然日 00:00 → now；全部：`[min(start), max(end)]`；零跨度自动左右各扩展 30 分钟，避免除零 |
| 轨道 | 标签列 200px + 轨道 `flex` + 用时列 84px；条形/刻度/网格全部百分比定位，窄屏按 168/84、148/76 收窄，不再写死 900px |
| 刻度 | 跨度 ≥1.5 天只在整天步长里选，否则取分钟/小时步长，目标 6–10 个；天步长从本地 00:00 起算；标签：跨度 ≤1 天 `HH:mm`、整天 `MM-DD`（>300 天带年份）、天级跨度配小时步长时 `MM-DD HH:mm` |
| 「现在」线 | 时间域包含当前时刻时绘制竖线 + 标签；窗口范围固定在最右，红线与用时列边框错开 2px，靠近右端的刻度标签（>90%）隐藏避免重叠 |
| 用时列 | 所有行常显 `formatDurationShort`（48 分 / 2 天 3 时）；进行中为蓝色 + 蓝点，title 给「已进行 …」；`title` 悬浮提示保留完整创建/完成/用时 |
| 范围筛选 | 今天 / 近 7 天 / 近 30 天 / 全部：保留 `[start, end]` 与窗口相交的条目 |
| 分组 | 按项目分组；组头是 30px 折叠按钮，聚合「N 条 · 进行中 M · 已完成用时 X」；折叠状态存 panel state，跨视图保留 |
| 兜底 | `createdAt` 不可解析 → 跳过该条；`completedAt` 非法或早于 start → 按「现在」兜底 |
| 无障碍 | 条形 `role="img"` + `aria-label`（分类/标题/创建/完成或进行中/用时）+ `title` 悬浮提示 |
| 行内操作 | 左侧标签是 `<button>`（`aria-expanded`/`aria-controls`，dot + 标题 + 行尾 ›），点击标签或整行展开行内详情：分类/状态/创建/完成/用时/id + 完成/取消完成、编辑（标题+分类）、删除（二次确认）；展开状态按 id 记录并与表格视图独立 |

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
| **表格** | 表头「勾选 / 标题 / 分类 / 状态 / 创建时间 / 完成时间 / 操作」（`table-layout: fixed` + `<colgroup>` 固定列宽，窄屏横向滚动，长标题不会挤扁状态列）；行首勾选圈点一下即完成/取消完成；标题最多两行截断、点击展开详情行；分类 = 色点 + 名称；状态胶囊带状态点、类型小标签、优先级「箭头 + 文字」；`排序=分类` 时按分类分组（方向生效，未分类最后） | 筛选（全部/未完成/已完成）、排序字段、方向；点表头也可排序（与工具栏单一状态源，`th` 带 `aria-sort`） | 完成/取消完成（行首勾选圈）、编辑（标题+分类行内输入）、删除（二次确认）、详情 |
| **看板** | 列式看板：列头 = 状态点 + 名称 + 计数 + 「＋」列内新建；卡片 = 20×20 完成勾选圈 + 标题（2 行）+ 一行元信息（**类型小标签 / 优先级箭头 + 文字** / 分类色点 + 名称或状态徽标 + **已进行 / 用时**）+ 文件 chips（1 个 + N）+ 「⋯」更多操作（编辑 / 优先级 / 类型 / 移到分类 / 删除，删除二次确认）；已完成列默认最近 10 条 + 「显示全部/只看最近」；列宽 `clamp()` + 横向 scroll-snap，≤560px 单列堆叠；**状态 × 分类泳道**（两列固定、行 = 分类、可折叠、未完成泳道带「＋」）；**密度** 舒适/紧凑（紧凑 = 标题 1 行、隐藏文件 chip 与分类名）。**不做指针拖拽**：两列板上拖拽≈点完成；移动改走「⋯ → 移到分类」（单指针替代，WCAG 2.5.7） | 分组方式：**按状态**（默认）/ **按分类** / **状态 × 分类**（泳道）；密度（舒适/紧凑）；类型筛选；面板内快捷键：`/` 搜索、`n` 新建、`f` 循环筛选 | 完成/取消完成（checkbox）、编辑/删除（更多操作）、设优先级/类型、移到分类（带撤销 toast）、列头/泳道快捷新建、列内滚动、状态筛选 |
| **甘特图** | 时间轴条形 + 右侧「用时」列，见 §3.5；按分类分组，组头可折叠并聚合 | 时间范围（今天 / 近 7 天 / 近 30 天 / 全部） | 展开行内详情后可完成/编辑/删除 |
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

**四个可输入的地方**都支持同一套标记：

1. **顶部新建框**（「输入待办内容，按 Enter 创建」）：输入 `测试 #lib` 或 `@lib/store.js 写文档`，按 Enter 后自动拆出分类/文件，**标题里不会残留 `#lib`**；输入时敲 `#`/`@` 会弹出补全下拉。含标记时走 Host 的 `/quick-add`（多条/跳过/错误汇总进浮层提示 toast），不含标记时按当前选择器创建。
2. **对话录入面板**：同上，另有逐条气泡与撤销。
3. **Harness 主输入框的 `/todo` 命令**：`/todo 写周报 #工作 lib/store.js`，回执列出新建条目。
   - **分类 / 优先级 / 类型都可以点选**：**仅当草稿以 `/todo` 开头时**，在行里输入 `@` 会在平台的 `@` 菜单里追加三组候选——「待办分类」（已用分类 / 工作区；工作区文件夹如 `docs`、`lib`、`test` 属于目录噪音，不会出现）、「待办优先级」（高/中/低）、「待办类型」（缺陷/新功能/改进/疑问/杂项/其他）；选中后自动插入 `#分类 ` / `!high ` / `^bug `，不需要手打标记。普通消息里输入 `@` 不会出现这些分组。平台的触发字符写死为 `/` 和 `@`，**`#` 本身不会弹出菜单**（插件无法新增触发字符），所以点选入口是 `@`。平台菜单会同时展示它自己的文件/会话来源，插件无法移除它们（只能追加自己的分组）。
   - 命令输入框只支持「命令名补全 + 附件」，插件无法注入 `#`/`@` 的行内补全；因此 `/todo` 同时支持手打：`#分类`、**裸写工作区相对路径**（`lib/store.js`，不需要 `@`）、多条用换行或 `；` 分隔。
   - 该命令声明了 `input.attachments`，主输入框里附加/`@` 引用的文件会被接收，并按文件名在工作区索引里解析成相对路径记入 `files`。
   - 命令输入框由 Harness 提供，只支持「命令名补全 + 附件」，**插件无法在那里注入 `#`/`@` 补全**；因此 `/todo` 特意做成「不用补全也好用」：`#分类` 手打即可、**文件直接写工作区相对路径**（`lib/store.js`，不需要 `@`；写法含空格时用 `@"docs/My File.md"`）、多条用换行或 `；` 分隔。
   - 该命令声明了 `input.attachments`，所以在主输入框里**用 `@` 引用/附加的文件**会被接收：插件按文件名在工作区索引里解析成相对路径并记入 `files`。
   - 需要下拉选择/补全时用插件面板（分类选择器 + `#`/`@` 补全）。
4. **主输入框下方的快速入口胶囊**（聊天时，见 §3.10）：展开清单后一行输入 + Enter，走的也是 `POST /quick-add`，`#分类` / `!优先级` / `^类型` 的解析结果与面板一致；它的输入框是纯文本（没有 `#`/`@` 补全下拉，标记需手打）。

服务端兜底：即使调用方把带标记的文本直接发给 `POST /create`（例如旧版界面或工具调用），Host 也会自动解析拆分，不会把 `#分类`/`@文件`/`!优先级`/`^类型` 记进标题。分类优先级：标题里的显式标记 > 表单选择器 > （都不给时）由文件目录派生；优先级与类型同理：显式标记 > 表单选择器 > 未设置。

### 3.9 界面层级与完成反馈（视觉重构）

面板只有三层信息，按「第一眼该看什么」排序：

```text
① 页头        标题（20/600）+ 一行本地时间说明   ── 右侧是「设置」与「数据」两个 ghost 次要入口
② 新建待办    输入框 + 分类选择器 + 添加        ── 页面级唯一的主操作（实心按钮）
③ 数据卡片    视图分段 · 筛选分段（带计数）     ── 视图控制与列表同属一张卡片
               分类筛选 / 排序 / 方向 · 列表
```

规则（对应 `test/client-audit.mjs` 的静态门禁）：

- **一张卡片**：工具栏与表格/看板/甘特/日历同属 `.ttl-data`，四视图不再各自叠一层边框；`.ttl-data` 只保留 0.5px 微边框。
- **唯一主操作**：页面级 `.ttl-button-primary` 只有「添加」一个；其余按钮一律 ghost / outline / 文本链接（对话录入展开后，其卡片内的「发送」也是 primary —— 属于该卡片自己的操作区，不是页面级主操作）。
- **页头次要入口**：「设置」与「数据」都是 ghost 按钮；「设置」展开的是一张与「对话录入」同形态的卡片（只放偏好开关，不放表单），`Esc` / 再点「设置」收起（见 §3.10 的「设置卡」小节）。
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

### 3.10 快速入口（主输入框旁的「待办」胶囊 + 清单）

设计基线见 [`docs/design/quick-entry.md`](./design/quick-entry.md)。它**不是第二个面板**，只做三件事 —— 看进行中、勾掉（带撤销）、记一条；编辑 / 删除 / 改分类 / 改优先级 / 类型都留在面板。

**为什么不做成第二个面板**：面板占掉整个主视图，而最高频的动作是「这件事刚做完，顺手勾掉」，路径成本全在「切走主视图 → 找到那一行 → 勾掉 → 切回来」。做成第二个常驻面板会连带一套新的筛选/排序/列表实现（与面板重复），而快捷镜像只需要「一个未完成清单 + 一个输入行」。

| 半 | 槽位 | 挂载内容 | 说明 |
| --- | --- | --- | --- |
| trigger | `conversation.composer.dock` | `.ttl-quick-trigger` 胶囊（`order: 40`） | 常驻输入框下方；显示未完成条数，点击切换清单；agent 执行中 activity 展开时仍然可见 |
| overlay | `conversation.input.overlay` | `.ttl-quick-panel` 清单卡片 | 锚在 composer 卡片上沿之上（`position: absolute; bottom: calc(100% + 8px)`），与宿主 `@` 菜单同一套做法，不会被 docked composer 裁切 |

不放进 `conversation.input.left`：那一行在 activity 展开时会被 `hidden` 掉，正好错过「刚跑完一轮想勾掉」的时刻。

**store**（`src/client/quick.js` 的模块级 `createQuickStore(ctx)`，两个槽位组件用 `React.useSyncExternalStore` 订阅同一份快照）：

| 字段 | 作用 |
| --- | --- |
| `open` | 清单开关；胶囊与清单共享，点胶囊 / `Esc` / × 都改它 |
| `status` / `error` | `idle / loading / ready / error` 四态；错误态带「重试」 |
| `todos` / `pending` | 未完成清单（创建时间升序）与条数；胶囊计数就是 `pending` |
| `notice` | 卡片内提示 `{id, kind, text, undo}`，默认 6s 自动消失，绝对定位在卡片底部（不推动列表） |
| `busyId` / `adding` | 单条操作进行中态：防连点，期间勾选圈禁用 |

**数据契约**（待办数据不新增接口，全部复用既有 Host 路由；开关偏好另有两条 `/settings` 路由，见本节末尾）：

| 动作 | 调用 |
| --- | --- |
| 读清单 | `POST /list {filter:'pending', sortBy:'createdAt', direction:'asc'}` |
| 勾掉 | `POST /complete {id}` → 成功即本地移除该行并给「撤销」（`POST /uncomplete {id}` → 静默重拉列表） |
| 记一条 | `POST /quick-add {text}`（与对话录入同一条解析）→ 成功静默重拉；撤销 = 逐个 `POST /delete {id}` |
| 打开完整面板 | `ctx.get('layout').selectPanel('dsh-todo-time-log')`（与侧边栏 / `main` 槽同一 id），随后关闭清单 |

**刷新策略**：挂载时拉一次；打开时静默刷新（先渲染缓存再补最新，首帧不空白）；之后每 60s 静默刷新一次（多窗口 / 在面板里改完能跟上）；「进行中 X」每 30s 只走本地时钟，不发请求。静默刷新失败时保留已有列表、不弹错误提示 —— 网络抖动不该把清单清空。

**无障碍**：胶囊是真 `button`，`aria-haspopup="dialog"` + `aria-expanded`，`aria-label` 带条数（`{count} 条进行中，展开待办清单`，空态退化为 `展开待办清单`）；清单 `role="dialog"` + `aria-label`，打开后焦点进新建输入框，`Esc` 关闭并把焦点还回胶囊；每行勾选圈 `role="checkbox"` + `aria-label`「完成待办：标题」；提示成功 / 中性 `role="status"`、错误 `role="alert"`；「打开完整面板」是文本按钮。

**不监听 `document` 做「点外部关闭」**：客户端产物只允许一处只读 `document.activeElement`（`test/client-audit.mjs` 的 `single composer draft reader` / `no direct DOM query` 门禁），关闭路径收敛为「再点胶囊 / `Esc` / ×」三种显式操作，避免 document 级监听在宿主多面板环境里互相打架。

**样式**：`src/client/styles.js` 的 `QUICK_CSS_TEXT` + `QuickStyleSheet` 单独一份，不塞进面板 CSS —— 面板未挂载时（用户正在聊天）快速入口也要完整可用；类名一律 `ttl-quick-*`，不依赖面板的 `.ttl-check` / badge 样式，避免两套 CSS 互相影响；圆角同心（卡片 12 = 行 8 + 内边距 4），只用主题 token。

#### 设置卡（面板页头 → 「设置」，十六期）

不想看到这枚胶囊的人，就在**待办面板自己的页头**关掉它 —— 页头右侧有一个「设置」幽灵按钮（`.ttl-ghost-button ttl-settings-trigger`，`aria-controls="ttl-settings-panel"` + `aria-expanded`），点开在页头下方展开一张设置卡（`<section class="ttl-settings" id="ttl-settings-panel">`，与「对话录入」卡片同一种形态）：

- 卡头：标题「设置」+ 右侧提示「保存在本机，换浏览器也一样」（`settings.title` / `settings.hint`）；
- 卡体：一行「主输入框下方的待办快捷入口」+ 说明 + 右侧开关（36×20 轨道 + 16px 圆点，`.ttl-pref-switch` / `.ttl-pref-knob`，`role="switch"` + `aria-checked` + `aria-busy`，读取或写入中 `disabled`）；读取失败 / 保存失败的说明是 `role="alert"`；
- 收起：再点一次页头「设置」，或在面板空白处按 `Esc`（面板根节点 `handlePanelKeyDown` 处理；焦点在输入类控件里时不拦截）—— 依旧不注册 document 级监听。

**为什么不用宿主设置页 / 插件详情页**：用户的原话是「放系统设置太远」—— 为了关掉聊天输入框旁的一枚胶囊，要离开当前会话 → 进设置 → 找到插件那一行。三种位置对比：

| 方案 | 问题 |
| --- | --- |
| 宿主「设置 → 通用」一行（`settings.general.item`，十五期） | 离使用现场太远；而且它是宿主槽位，旧版宿主上可能不存在，注册失败只能 warn |
| 插件详情页配置表单 | 当前构建没有导出 `Config` schema，详情页本来就渲染不出表单（见 [limitations](./limitations.md)） |
| **面板页头 → 设置卡（现在）** | 与「对话录入」「数据」同一个页头位置、同一套卡片形态；开关和它控制的入口在同一个产品区域里，一眼能对上 |

**样式与生命周期**：设置卡与开关的 CSS 并入面板的 `CSS_TEXT`（`.ttl-settings*` / `.ttl-pref-*`），不再单独一份 `PREF_CSS_TEXT` / `PrefStyleSheet` —— 它只在面板里渲染、跟着面板的生命周期走，因此也自动落在 `.ttl-root` 的 `prefers-reduced-motion` 兜底范围内（150ms 轨道变色 + 圆点 `translateX(16px)`）。

**prefs 单例**：`createQuickEntryPreference()` 在 `apply()` 里建一次，用 `setQuickEntryPreference()` 放进模块级单例；面板用 `getQuickEntryPreference()` 取（不把控制器一层层透传进 `createPanel()`），每次快照变化用 `useSyncExternalStore` 订阅。没有单例时页头不渲染「设置」按钮（例如测试环境只挂了快速入口槽位）。

| 行为 | 实现 |
| --- | --- |
| 关闭 | `createQuickEntry().unmount()` 注销 `conversation.composer.dock` / `conversation.input.overlay` 两处注册 → 胶囊、清单与组件里的 60s 轮询一起消失，不再发 `/list` |
| 打开 | `mount()` 重新注册两个槽位（幂等：已挂载时重复调用直接返回 `false`，不会重复注册） |
| 首屏 | `apply()` 里先 `pref.load()` 读一次偏好；读到「关」就**根本不挂载**（不是挂载后隐藏），所以不会多打一次 `/list` |
| 不影响 | 面板、`/todo` 命令与待办数据完全不受影响 —— 只是不再注册那两个槽位 |

**偏好文件**：与待办数据同目录、同主名 —— `<dataFile>` → `<主名>.settings.json`（默认 `~/.dsh/todo-time-log/todos.settings.json`）。信封：

```json
{
  "version": 1,
  "updatedAt": "2026-11-10T04:00:00.000Z",
  "settings": { "quickEntry": true }
}
```

写入是「临时文件 + rename」（Windows 下 rename 被占用时回退为覆盖写）；**整段「读 → 合并 → 写」作为一个事务入队**（在调用时就同步排到同一条 Promise 链上，而不是 await 之后才排），所以并发多次切换按调用顺序落盘、最后一次调用生效（last-write-wins）；单次写失败只折成 `SETTINGS_WRITE_FAILED` 返回值，链不会保持 rejected、后续切换照常执行。文件不存在 = 默认值（`quickEntry: true`）；损坏 / 不可读时按默认值工作并记一条 warn，下一次写入直接覆盖它。`normalizeSettings()` 同时接受扁平 `{quickEntry}` 与信封两种形态（前向兼容），未知键丢弃。

**为什么偏好不塞进 `todos.json` 的 `version` 信封**：

- todos 信封的 `version` 是严格契约（旧版插件遇到不支持的版本会归档并重建），为一个 UI 偏好升版会把待办数据一起推到风险里；
- 待办由 UI 与智能体工具共用写，偏好只由浏览器写、每次打开页面读一次；分成两个文件，「写偏好」就永远不会扰动「写待办」（也就不会牵动导入导出的 `.bak-*` 备份与跨进程合并那一整套）。

**路由**（`lib/index.js`，与待办路由同一前缀 `/api/dsh-todo-time-log`，共用宿主认证）：

| 路由 | 作用 | 返回 / 错误 |
| --- | --- | --- |
| `POST /settings` | 读偏好 | `{ok:true, value:{quickEntry:boolean}}`；没有设置存储时 501 `SETTINGS_UNAVAILABLE`（其余方法回落 405） |
| `POST /settings/update` | 写偏好（body `{quickEntry:boolean}`） | `{ok:true, value:{quickEntry}}`；非对象 / 非布尔 400 `SETTINGS_INVALID`（整单拒绝，不改磁盘）；落盘失败 500 `SETTINGS_WRITE_FAILED`；无设置存储 501 `SETTINGS_UNAVAILABLE` |

已知键类型不对时整单拒绝而不是静默丢弃 —— 静默丢弃会把开关卡在用户没选中的状态。未知键被忽略（前向兼容）。

**fail-open 与错误展示**（`src/client/prefs.js`）：

- 读失败（网络 / 501 / 坏响应）→ 按默认「开」挂载，面板设置卡里用 `role="alert"` 显示「读取设置失败，暂按默认（开）处理：…」；
- 写失败 → **不乐观翻转**：开关保持原状态、胶囊保持原样，显示「保存失败，已保持原状态：…」，避免出现「开关显示关了但胶囊还在」的两套状态；
- 偏好存在 Host 侧，所以同一实例的每个已认证浏览器读到同一个值（A 浏览器关掉，B 浏览器刷新后也不显示）。
