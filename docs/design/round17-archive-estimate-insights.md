# 十七期：搁置 · 预估用时 · 回顾（数据模型 v6）

> 2026-11-18。本轮依据一份外部痛点调研（待办工具的 18 条真实抱怨）落三条主线：
> 1. **给膨胀的清单一个体面的出口** —— 「搁置」态替代「删除 / 硬扛」二选一（对应调研 P1 / P11 / P13 / P14）；
> 2. **把时间做得更严谨** —— 加「预计用时」并能对照实际跨度，让「这件事花了多久」可被检验（对应 P5 / P6 / P17）；
> 3. **让完成看得见** —— 新增「回顾」视图，把「本周干了什么、哪类最耗时间、放得最久的是哪几条」摊开（对应 P2 / P12 / P17）。
>
> 明确不做（调研反面清单）：团队协作、子任务树、AI 排期、系统推送、云同步、红色逾期。
> 产品纪律：**本轮不引入任何红色 overdue 语义**，搁置与陈放一律用中性词（「放了 N 天」），不用「逾期」。

---

## 1. 数据模型 v6

信封 `version: 6`。v1–v5 载入时在内存中迁移，下一次写入落 v6；不支持版本仍归档重建。

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
  "archivedAt": null,
  "estimateMinutes": null,
  "updatedAt": "2026-11-03T00:37:49.000Z"
}
```

| 新字段 | 类型 | 约束 | 语义 |
| --- | --- | --- | --- |
| `archivedAt` | ISO-8601 UTC string \| null | 默认 `null`；**只有 `status: 'pending'` 可以非 null** | 搁置时刻。非 null = 该条在「搁置清单」里：不算完成、不算删除、不进统计与四视图 |
| `estimateMinutes` | number \| null | 默认 `null`；整数 `1..1440` | 预计用时（分钟）。`null` = 未填，任何界面都不得把它显示成 0 |

不变量：

1. `archivedAt !== null` ⇒ `status === 'pending'` 且 `completedAt === null`。
2. 对已搁置项执行 `complete` ⇒ 自动清空 `archivedAt` 并正常完成，返回提示「已从搁置清单完成」。
3. `uncomplete` 不恢复 `archivedAt`（回到普通的未完成状态）。
4. 载入时若「已完成却带 `archivedAt`」⇒ 清空 `archivedAt` 并记一条修复提示。
5. `estimateMinutes` 与 `status` 无关；非法值载入时清为 `null` 并记提示。

---

## 2. Host 契约（`lib/store.js` / `lib/index.js` / `lib/parse.js` / `lib/transfer.js`）

### 2.1 常量

```js
export const STORE_VERSION = 6;
export const SUPPORTED_STORE_VERSIONS = Object.freeze([1, 2, 3, 4, 5, 6]);
export const MAX_ESTIMATE_MINUTES = 1440;      // 24 小时
/** list 筛选值；'all' 只含未搁置项（pending + completed）。 */
export const FILTERS = Object.freeze(['all', 'pending', 'completed', 'archived']);
```

`SORT_FIELDS` 增加 `'estimateMinutes'`（升序=少的在前；`null` 恒排最后，与 `completedAt` 空值规则一致）。

### 2.2 校验

| 函数 | 规则 | 错误码 |
| --- | --- | --- |
| `validateEstimate(input)` | `undefined`/`null` → `{ ok: true, estimateMinutes: null }`；number 或纯数字字符串；必须为整数且 `1..1440` | `ESTIMATE_INVALID` |
| `validateArchiveState`（内部） | 由 action 决定，见 2.3 | `ARCHIVE_INVALID` |

新增 `ERROR_CODES`：`ESTIMATE_INVALID`、`ARCHIVE_INVALID`、`ALREADY_ARCHIVED`、`NOT_ARCHIVED`。

### 2.3 store 方法

```js
async archive(id)    // pending 且未搁置 → archivedAt = now
                     // completed          → { ok:false, code:'ARCHIVE_INVALID', message:'已完成的待办不需要搁置' }
                     // 已搁置              → { ok:false, code:'ALREADY_ARCHIVED', message:'该待办已在搁置清单里' }
async unarchive(id)  // 已搁置 → archivedAt = null
                     // 未搁置 → { ok:false, code:'NOT_ARCHIVED', message:'该待办不在搁置清单里' }
                     // completed（历史脏数据） → { ok:false, code:'ARCHIVE_INVALID', message:'已完成的待办不在搁置清单里' }
```

`create(input)` / `update(id, input)` 接受 `estimateMinutes`；`update` 传 `null` 表示清空、传 `undefined` 表示不改（与 `project`/`type` 的「部分更新」约定一致）。
`update` **不接受** `archivedAt`（搁置只能走 archive / unarchive），传了就忽略。

### 2.4 `/list`

- 新增可选参数 `filter: 'archived'`。
- `'all'` = 未搁置的 pending + completed（**不含**搁置项）。
- `'pending'` / `'completed'` = 未搁置项中按状态过滤（搁置项永远不会出现在这两个筛选里）。
- 返回的 `stats` 扩为四元：

```js
stats: { total, pending, completed, archived }
// total = pending + completed（活跃条目，不含搁置）
// archived = 搁置条数
```

- `projects[]` 只统计活跃条目（与 `'all'` 的可见集合一致）。
- 排序、`notices`、`timeFormat` 等其余行为不变。

### 2.5 工具 `todo_time_log`

- `ACTIONS` / `CRUD_ACTIONS` 增加 `archive` / `unarchive`。
- `create` / `update` 增加 `estimateMinutes`（integer 1–1440，`null` 表示未填）。
- `list.filter` 枚举加 `archived`；`list.sortBy` 枚举加 `estimateMinutes`。
- `output.schema.stats` 加 `archived`。
- `renderTodoResult`：单条渲染行尾追加 `｜预计 30 分`（有值时）；`list` 首行改为
  `待办时间日志（共 X 条：未完成 a / 已完成 b，另搁置 c 条）`。

### 2.6 导入 / 导出（`lib/transfer.js`）

- JSON 信封 `version: 6`，两个新字段原样往返。
- CSV **追加两列**：`预计(分钟)`、`搁置时间`（在 `耗时(分钟)` 之后）。导入时按表头别名识别（`estimate`、`预计`、`预计用时`、`archivedAt`、`搁置时间`）。空值 → `null`。
- 旧的 v1–v5 JSON 与不含新列的 CSV 仍可导入（缺列即 `null`）。

### 2.7 自然语言解析（`lib/parse.js`）

新增「预计用时」标记（与 `#分类` / `!优先级` / `^类型` 同级，命中后从标题里剥离）：

```
~30m  ~30分  ~30分钟  ~2h  ~2时  ~2小时  ~90min
预计30分  预计：2小时  预计用时 45 分钟
```

- `m|min|分|分钟` → 原值分钟；`h|时|小时` → ×60；`1.5h` 允许小数（四舍五入到整数分钟）。
- 超出 `1..1440` 的值**不当作标记**（留在标题里，不报错）。
- 同一行出现多个标记时**最左优先**，其余标记照样剥离（与优先级标记一致）。
- `parseQuickAddLine()` 返回值增加 `estimateMinutes: number | null`（缺省 `null`）。
- `~/预计` 标记不参与「是否含标记」判断以外的任何逻辑。

---

## 3. Client 契约（`src/client/`）

### 3.1 视图

`VIEWS` 增加第五项：

```js
{ value: 'insights', labelKey: 'view.insights' }
```

`queryForView('insights', …)` 返回 `{ filter: 'all', sortBy: 'createdAt', direction: 'asc' }`（与日历一致：回顾自己按需取数）。

> 参考实现背景：`/list` 的 `'all'` 已天然排除搁置项，所以**看板 / 甘特 / 日历不需要为搁置做任何改动**，搁置项不会出现。

搁置筛选（`filter === 'archived'`）下：**只有表格视图有意义**，另外三个视图按钮设为 `disabled` 并带 `title`（文案 `archive.viewTableOnly`），当前视图若不在表格则自动切回表格。

### 3.2 回顾视图（新文件 `src/client/views/insights.js`）

```js
export function createInsightsView(deps) {
  // deps 里的可用字段见 panel.js 的 viewDeps；本视图只用：
  //   todos           —— 活跃条目（/list filter:'all' 的结果，已排除搁置）
  //   nowMs           —— 每分钟推进的「现在」
  //   insightsScope   —— 'week' | 'month' | 'all'
  //   setInsightsScope(scope)
  //   includeArchivedCount —— stats.archived（仅用于一行说明文字，可为 0）
  // 返回 (renderInsightsView: () => ReactElement)
}
```

内容（全部前端派生，**不新增任何接口**）：

1. 范围分段：近 7 天 / 近 30 天 / 全部（`INSIGHTS_SCOPES` 常量放 `styles.js`）。
2. 三张数字卡：完成条数、总跨度、平均跨度（只统计范围内**已完成**条目）。
3. 预估卡：填了预计的条数 / 平均偏差（`(跨度-预计)/预计`，正=超预计）；一条都没填时显示「还没有填过预计用时」。
4. 按分类 / 按类型的跨度汇总列表（条数 + 总跨度，按总跨度降序，最多各 6 行）。
5. 「放得最久的」清单：范围内**未完成**条目按 `createdAt` 升序取前 5，每行显示「放了 N 天」+ 标题 + 分类徽标。中性配色，**不得使用红色 / 危险色**。

### 3.3 表格 / 详情（`views/table.js`、`detail.js`）

- 完成时间列：已有两行（时刻 + `用时 X` / `进行中 X`）之后，**当 `estimateMinutes` 有值时**追加第三行小字：
  - 已完成：`预计 2 时 · 超出 8%` / `预计 2 时 · 省下 12%` / 偏差 <5% 时只显示 `预计 2 时`；
  - 未完成：`预计 2 时`（不显示偏差）。
  - 幅度 <5% 的判定阈值常量放 `helpers.js`（`estimateDeviation()`，见 3.5）。
- 行尾「⋯」菜单：在「编辑」之后插入「搁置」（未搁置）/「取回」（已搁置）项；已完成项不显示搁置项。
- 搁置行（只在 `filter === 'archived'` 下出现）：行加 `data-archived="true"`，标题旁显示 `row.archivedBadge` 小标签。
- 详情 `dl`：在「用时」之后加「预计用时」行（`未填` 时也显示，保持字段一致）；已完成且有预计时追加「执行偏差」行。

### 3.4 新建 / 编辑表单（`panel.js`）

- 顶部新建框右侧、优先级/类型选择器旁新增「预计用时」选择器：`不填` / `15 分钟` / `30 分钟` / `1 小时` / `2 小时` / `半天（4 小时）` / `自定义…`。
  自定义用原生 `<input type="number" min="1" max="1440">`（单位分钟），非法值在行内提示 `estimate.invalid` 且不提交。
- 行内编辑（表格 / 甘特里 `renderEditFields`）同样加这个选择器。
- 提交时 `estimateMinutes` 为 `null`（不填）或整数。

### 3.5 `helpers.js` 新增纯函数（**由 lead 实现，其他 agent 只调用**）

```js
export function normalizeEstimate(value)            // → number | null
export const ESTIMATE_PRESETS = [ {value:null,…}, {value:15,…}, … ]  // 放 styles.js
export function formatEstimate(minutes)             // 30 → '30 分钟'，90 → '1 小时 30 分'，null → '-'
export function estimateDeviation(estimateMinutes, spanMs)  // → { percent, kind:'over'|'under'|'even' } | null
export function ageInDays(createdAt, nowMs)         // → 整数天（向下取整，最小 0）
export function formatAge(createdAt, nowMs)         // 今天 / N 小时前 / N 天
```

`estimateDeviation` 的阈值：`|percent| < 5` → `kind: 'even'`。

### 3.6 快速入口（`quick.js`）

进行中清单每行右侧、在已进行时长之后，追加中性灰字「放了 N 天」（`formatAge`）。**不得**用红色或「逾期」措辞。

### 3.7 i18n

全部新 key 由 lead 预置在 `src/client/i18n.js`（zh + en 成对、占位符一致）。UI agent **只能使用已存在的 key**；确需新增，在完成报告里列出缺口，由 lead 补。

### 3.8 样式

全部新类名由 lead 预置在 `src/client/styles.js`（`ttl-` 前缀、只用 `--dsw-alias-*` token、不写十六进制/rgb）。UI agent **只能使用已存在的类名**；确需新增，在完成报告中列出缺口，由 lead 补。

---

## 4. 明确不做（本轮）

| 不做 | 原因 |
| --- | --- |
| 红色 overdue / 截止日期 | 产品纪律：本插件记录而非催促；调研显示红色 overdue 是弃用首因 |
| 系统推送 / 闹钟 | 宿主无通知通道；且「更快捕获」被证伪 |
| 团队协作 / 云同步 | 与「本地 JSON、不联网」的卖点直接冲突 |
| 子任务树 / 依赖图 | Todoist 创始人已因使用率过低砍掉多级子任务；成本与收益不匹配 |
| AI 自动排期 | 宿主无日历数据；且会剥夺掌控感、加剧焦虑 |
| 计时器（开始/暂停） | 与「一条待办 = 一次真实投入」的工作流冲突；本轮先用「预计 vs 跨度」把口径讲清楚 |
| 移除 `archivedAt` 的硬上限 | 搁置项也计入 `MAX_TODOS`，避免无限增长 |
