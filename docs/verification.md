# 独立验证报告：dsh-todo-time-log（待办时间日志）

- 验证者：verifier（独立 QA；Team Lead：lead）
- 时间：2026-11-03 08:38–08:52（Asia/Shanghai）
- 环境：Windows；Node v26.13.0；dsh 桌面端，desktop profile；运行中的 Web GUI `http://127.0.0.1:52283`；工作目录 `D:\code\dsh-todo-time-log`
- 只读约束：未修改任何实现文件（`lib/`、`package.json`、`cordis.patch.yml`、`locale/`、`icon.svg`、`test/`）；唯一写入的本仓库文件是本文档
- 测试数据：已全部清理。最终数据文件 `C:\Users\LeoMa\.dsh\todo-time-log\todos.json` 内容为 `{"version":1,"todos":[]}`，`list` 的 `total = 0`，目录下无残留 `.tmp` 文件
- 验证期间实现文件有两次更新（`store.js` 08:38:27、`client.js` 08:40:05），Host 随后被 Lead 重载（toggle off→on）。**所有静态检查、npm test、store 探针、真实 HTTP 全流程均已在更新后的代码/重载后的实例上重跑**；下文的结论对应最终状态

## 结论

- **可交付（有保留）**：6 项验证中 5 项 PASS、1 项 PARTIAL（Client 槽位实时注册未复现）；**没有 FAIL 项**。
- 未闭环 2 处：
  1. **Client 槽位实时注册无法在本会话独立复现**（`cordis_inspect_query` client 通道 ≥10 次全部 10s 超时，含 Builtin/Theme；Lead 说其侧刚刚可查通，但我未亲眼看到 occupant）。仅以静态注册代码符合宿主 API 佐证。
  2. **页面真实渲染外观未验收**（无浏览器控制/截图能力，按规则不做 mock 或截图替代）。
- 低严重度代码观察 4 条（不影响主流程，未改动代码）：损坏结构非 JSON 解析失败时不备份、重复 id 修复无提示、删除落盘失败返回 500 但内存已删、UI 排序不含 title。

## 1. 静态检查 — PASS

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| `node --check lib/time.js lib/store.js lib/index.js lib/client.js` | PASS | 四个文件依次通过，输出 `ALL OK`（最终代码，Node v26.13.0） |
| `npm test`（`test/smoke.mjs` + `test/http.mjs`） | PASS | `49/49 checks passed` + `22/22 HTTP checks passed`，退出码 0 |

说明：`npm test` 与 `node --check` 在 Lead 更新 `store.js`/`client.js` 之后重跑，结果同上。

## 2. 代码审查 — PASS（4 条低严重度观察）

逐项核对要点：

| 审查点 | 结果 | 证据（位置） |
| --- | --- | --- |
| 数据模型字段 `id/title/status/createdAt/completedAt/updatedAt` | PASS | `lib/store.js` 顶部注释 + `create()`；落盘实测每条记录六字段齐全（见 §3） |
| 时间格式与空值 `-` | PASS | `lib/time.js:64-75` 输出本地 `YYYY-MM-DD HH:mm:ss`；`null`/空串/非法 → `-`。实测 `formatLocalDateTime('2026-11-03T00:00:00.000Z') === '2026-11-03 08:00:00'`（Asia/Shanghai） |
| 排序（`completedAt` 空值稳定排最后） | PASS | `sortTodos`：空 key 恒排最后、与升降序无关（`store.js:185-201`）。实测 `sortBy=completedAt` 升/降序中未完成项均在末尾 |
| 筛选三态 | PASS | `filterTodos`（all/pending/completed）+ 非法值回退 `all`；HTTP 实测计数 3/1 正确 |
| 创建时间缺失 | PASS | `normalizeTodo` 用当前时间补齐并给提示（`store.js:126-134`），探针实测 |
| 完成时间早于创建时间 | PASS | 修正为创建时间并提示（`store.js:142-144`），探针实测 |
| 已完成但无完成时间 | PASS | 回退为创建时间并提示（`store.js:139-141`） |
| 重复完成 / 重复取消完成 | PASS | 不写盘，返回 `ALREADY_COMPLETED` / `ALREADY_PENDING`，HTTP 映射 409；实测两次重复 complete 均 409 且未覆盖原 `completedAt` |
| 非法/超长标题 | PASS | 空白/非字符串 → `TITLE_REQUIRED`、>200 → `TITLE_TOO_LONG`，HTTP 400；实测 |
| 损坏 JSON 备份重建 | PASS | 仅 JSON 解析失败时 rename 为 `.corrupt-json-<ts>` 后重建空列表（`store.js:310-319`）；实测归档文件字节与原文件一致、列表为空且有提示 |
| 原子写与并发写链 | PASS | 临时文件 + rename + 失败回退覆盖写（`store.js:211-229`）；全部写操作串行在一条 Promise 链上（`#persist`）。实测 20 个并发 create：落盘 JSON 合法、恰好 20 条、id 唯一、无 `.tmp` 残留 |
| 写盘失败兜底 | PASS | 内存变更保留、返回 `persisted:false` + 中文提示，`lastPersistError` 由 `/health` 暴露；探针实测（dataFile 指向目录触发失败） |
| HTTP 错误码映射 | PASS | `BAD_REQUEST/TITLE_*`→400、`NOT_FOUND`→404、`ALREADY_*/TOO_MANY`→409、`PERSIST_FAILED`→500（`lib/index.js:290-307`）；400/404/405/409 实测，500 仅静态审查 |
| 客户端只依赖 `react` | PASS | `lib/client.js` 中 `require(` 仅 1 处：`require('react')`；无 `@deepseek-ai/*`、无 `import`、无构建产物依赖 |
| 使用 `--dsw-alias-*` token | PASS | 19 个 token 全部在宿主主题定义（`app.asar/dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js`）中存在；`CSS_TEXT` 内无硬编码颜色（0 处 hex/rgb） |
| 无 `document.body`/DOM 越界 | PASS | 全文件无 `document.*`、`querySelector`、`appendChild`、`createPortal`；仅 `window.__ModuleLoader__.load` 入口，样式以 React `<style>` 元素渲染（宿主允许） |

### 2.1 低严重度观察（仅记录，未改代码）

1. **LOW — 结构异常的数据文件不备份**（`store.js:321-325`）：合法 JSON 但 `todos` 不是数组时直接重建为空列表，不归档原文件；下一次写入会用空列表覆盖原内容，存在静默数据丢失可能（JSON 解析失败的情况才有备份）。建议同类处理也走归档。
2. **LOW — 重复 id 的修复是静默的**（`store.js:338-340`）：载入时若两条记录 id 相同会重新生成 id，但未 push notice；与 `normalizeTodo` 注释“Every repair is reported through notices”不完全一致。
3. **LOW — 删除时落盘失败返回 500，但内存已删除**（`store.js:498-513`）：`remove()` 先把记录从内存删除再持久化，失败返回 `PERSIST_FAILED`（HTTP 500），UI 会提示失败但刷新后该条已消失；磁盘与内存短暂不一致，下次成功写入会修正。
4. **LOW/INFO — UI 排序不含 `title`**：`lib/client.js` 的 `SORTS` 仅 `createdAt/completedAt`，而智能体工具支持 `sortBy=title`；产品需求未明确要求按标题排序，README 也按时间字段描述，故记为观察而非缺陷。
5. INFO：客户端文案为内置 `I18N`（zh 默认），未接入宿主 Client locale 服务；侧边栏 `label` 硬编码为中文 `待办时间日志`（README §6.4 已列为 TODO）。
6. INFO：行内详情按钮的 `aria-controls` 在收起状态仍指向未渲染的 `detail` 元素 id（a11y 细节）；`.ttl-time` 类无对应 CSS 规则（无样式的包装 span，无害）。

## 3. 运行时检查（真实 HTTP） — PASS

目标：`http://127.0.0.1:52283/api/dsh-todo-time-log`；中文 JSON 用 Node `fetch`（UTF-8）发送，未用 curl 传中文。

- `GET /health` → **200**，`{"ok":true,"value":{...,"dataFile":"C:\\Users\\LeoMa\\.dsh\\todo-time-log\\todos.json","loaded":true,"count":0,...,"routePrefix":"/api/dsh-todo-time-log"}}`；`POST /`（空前缀）同样返回 health。
- 全流程 54/54 断言通过（重载前 53/53，重载后 54/54）：
  - create（中文 + emoji 标题原样回读）→ 200；`status=pending`、`completedAt=null`、`createdAt` 为合法 ISO、`updatedAt===createdAt`
  - list → 200，含 `timeFormat:"YYYY-MM-DD HH:mm:ss"`、`stats.total=1`
  - get 命中 → 200；未知 id → 404 `NOT_FOUND`
  - complete → 200，`status=completed`、`completedAt` 合法；**重复 complete → 409 `ALREADY_COMPLETED`**（两次均 409，未覆盖完成时间），错误 message 中时间为本地格式 `YYYY-MM-DD HH:mm:ss`（重载后）
  - uncomplete → 200，`completedAt=null`、`status=pending`；**重复 uncomplete → 409 `ALREADY_PENDING`**
  - update → 200 且标题变更；空标题 → 400 `TITLE_REQUIRED`；未知 id → 404
  - 非法 JSON body（`{oops`）→ **400**；数组 body → 400；未知 action → 404；`GET /list` 与 `DELETE /create` → 405
  - 排序/筛选：`createdAt desc` 顺序正确；`filter=pending/completed` 计数正确；`completedAt` 升/降序未完成项均在末尾；非法 filter/sort/direction 回退默认值
  - 并发：8 个并行 create 全部 200 且 id 唯一
- 清理：逐条删除本次创建的所有待办（并发删除也全部 200），最终 `list.total=0`、`todos=[]`；数据文件 `todos: []`，无 `.tmp` 残留。**未留下测试数据**。

## 4. 平台注册 — PARTIAL

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| Host entry 已安装且 active | PASS | `plugin_manager list_plugins`：`entryId=include:dsh-todo-time-log`、`moduleName=dsh-todo-time-log`、`enabled=true`、`fiberPhase=active`、`patchId=dsh-todo-time-log`；重载前后各查一次均为 active |
| Agent 工具 `todo_time_log` | PASS | host `Tool.listTools` 返回该工具：`required:["action"]`、`additionalProperties:false`、action 枚举 8 项（list/get/create/complete/uncomplete/update/delete/health）、id/title/filter/sortBy/direction 参数与枚举合理，description 与行为一致（源码中 `output.schema`/`render` 亦存在） |
| Config schema | PASS（记录实际状态） | host `Config.listConfigs name=dsh-todo-time-log` → `status: "absent"`，`packageDir=C:\Users\LeoMa\.dsh\profiles\desktop\node_modules\dsh-todo-time-log`。**注意**：Lead 预期为 `unsupported`，实际为 `absent`；`absent` 表示该 entry 没有导出的 Config schema，与源码“故意不导出 Config”及 README §6.1 的已知 TODO 一致，不是新故障 |
| Client `main`／`sidebar.panellist` occupant | **NOT VERIFIED（本会话）** | `cordis_inspect_query`（client `Slots.listSubTree` root=`main` 与 root=`sidebar.panellist`）连续 ≥10 次（中间间隔 15–22s）全部返回 `Client inspect query ... timed out after 10000ms. Open or reconnect the Harness page, then retry.`；同通道 `client/Builtin.listBuiltins` 与 `client/Theme.listTokens` 同样超时。`cordis_inspect_list` 仍能看到 client 侧 Provider 清单（说明链路已配置），但本会话没有收到页面响应。Lead 报告其侧查询成功，我**没有亲眼看到** occupant，故不据此宣称通过 |

补充静态佐证（不能替代实时检查）：`lib/client.js` 末尾注册形式与宿主自带插件一致——`name:'main', key:'dsh-todo-time-log'`（keyed 槽，注册选项名 `key`）、`name:'sidebar.panellist', id:'dsh-todo-time-log', order:30, label:()=>'待办时间日志'`；对比 `@deepseek-ai/dsh-client-ui-schedule`、`-plugin-manager` 的 `main` keyed + `sidebar.panellist` id/order/label 注册，字段与语义一致；`package.json` 的 `dsh.client = {platform:'web', immediately:true}` 与官方模板一致。

## 5. 显示资源 — PASS

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| `locale/en.json`、`locale/zh.json` 的 `meta.title/description` | PASS | 非模板文案且准确：zh「待办时间日志 / 查看待办事项，并自动记录、清晰展示每个待办的创建时间与完成时间（本地时间 YYYY-MM-DD HH:mm:ss），支持筛选、排序与智能体工具操作。」；en「Todo Time Log / Lists todos and records when each one was created and completed…」 |
| `icon.svg` 合法且 <256KiB | PASS | 1,157 B（1.13 KiB）；用 Python `xml.etree` 解析成功，根元素为 SVG 命名空间、`viewBox="0 0 64 64"`、含 `xmlns`；原创图形（列表 + 时钟/对勾），无外部引用 |
| `package.json` 的 `exports`/`files` 覆盖 | PASS | exports：`.`→`lib/index.js`、`./client`→`lib/client.js`、`./locale/*.json`、`./icon`→`icon.svg`；files：`lib/index.js`/`store.js`/`time.js`/`client.js`、`cordis.patch.yml`、`locale/*.json`、`icon.svg`、`README.md`，上述文件全部存在（README.md 在验证开始之后才出现，mtime 08:38:54，非本验证创建）。安装方式为本地目录 link（`profiles/desktop/node_modules/dsh-todo-time-log` 是指向本仓库的 symlink），运行时读取的就是当前源码 |

未覆盖：Plugin Manager 里图标的**实际渲染像素**、中英文显示名在 UI 中的最终呈现（无浏览器控制）。

## 6. 需求覆盖对照表

| # | 需求 | 结果 | 证据 |
| --- | --- | --- | --- |
| 1 | 列表字段 | PASS | 列表行展示标题、状态徽标、创建时间、完成时间；统计（全部/未完成/已完成）；单条详情另含 id/updatedAt（`client.js` `renderRow`；HTTP `list` 返回完整记录） |
| 2 | 创建时间自动记录 | PASS | `create()` 写入 `createdAt`/`updatedAt`（ISO UTC）；HTTP 实测；载入缺失时按当前时间修复并提示 |
| 3 | 完成时间自动记录 + 取消完成清空 | PASS | `complete()` 写 `completedAt`；`uncomplete()` 置 `null`；HTTP 实测（complete 后有值、uncomplete 后为 null） |
| 4 | 列表/详情时间展示 + 未完成时 `-` | PASS | 列表行「创建/完成」两列；行内「展开详情」显示状态/创建/完成/更新时间/用时/id；未完成时完成时间与用时均为 `-`；`formatTime(null/空/非法)` → `-` |
| 5 | 排序 + 筛选 | PASS | 筛选 all/pending/completed；排序 createdAt/completedAt × asc/desc；`completedAt` 空值恒排最后；HTTP 实测全部通过；工具额外支持 `sortBy=title` |
| 6 | 时间格式与空值 | PASS | 展示固定本地 `YYYY-MM-DD HH:mm:ss`（实测 UTC→+08:00 换算正确），空值 `-`；存储为 ISO UTC，跨时区无歧义 |
| 7 | 持久化字段 | PASS | 落盘信封 `{version,updatedAt,todos[]}`，每条含 `id/title/status/createdAt/completedAt/updatedAt`；实测读回 JSON 校验通过；损坏 JSON 备份 `.corrupt-json-<ts>` 后重建（LOW：结构异常不备份，见 §2.1） |
| 8 | 异常处理 | PASS | 创建时间缺失/完成时间早于创建/已完成无完成时间/未完成带完成时间/重复完成/重复取消/空标题/超长标题/不存在/JSON 损坏/写盘失败均有明确兜底与提示；均有探针或 HTTP 证据（LOW：重复 id 修复无提示） |
| UI-1 | 新建 | PASS（静态+HTTP） | 输入框 + 添加按钮/Enter 提交；空标题前端拦截并提示；创建中禁用；HTTP 路径实测 |
| UI-2 | 标记完成 / 取消完成 | PASS（静态+HTTP） | 行内按钮按状态切换 complete/uncomplete；busy 时禁用；HTTP 路径实测 |
| UI-3 | 编辑 | PASS（静态） | 行内输入框，Enter 保存、Esc 取消、空标题拦截；与 `update` 接口对接 |
| UI-4 | 删除 | PASS（静态+HTTP） | 行内二次确认（确认删除/取消），删除走 `delete` 接口；HTTP 路径实测 |
| UI-5 | 时间不过度突出但清晰 | PARTIAL（静态） | 时间用 12px、`label-tertiary` 色、`tabular-nums`，作为标题下的次级信息；无实际截图，无法确认最终对比度/间距 |
| UI-6 | 简洁列表 | PARTIAL（静态） | 单列行式列表、行悬停高亮、无多余装饰；同样未做视觉验收 |

「列表/详情」需求已由行内可展开详情（新增于 08:40 的 `client.js`）覆盖；未提供独立详情页/路由。

## 7. 未覆盖的验证盲区

1. **真实页面视觉未验收**：无浏览器控制/截图能力，无法确认实际渲染、间距、明暗主题切换、焦点样式、控制台是否有槽位错误；仅做静态样式与结构审查。
2. **Client 槽位实时注册未复现**：本会话 client inspect 通道持续超时（见 §4），因此“`main` occupant key/active、`sidebar.panellist` id/order/active”只有源码与宿主 API 对照，没有我自己的运行时证据；Lead 的“active=true”是 Lead 的记录，不是我的独立证据。
3. **智能体工具未直接调用**：本会话没有可直接调用的 `todo_time_log` 调用面；只验证了工具 schema 与“HTTP 与工具共用同一 `executeTodoAction`”的源码事实。
4. **主题 token 只做静态校验**：19 个 `--dsw-alias-*` 在宿主主题定义文件中存在，未读取运行时计算后的 CSS 变量值。
5. **500 / 大请求等边界**：`PERSIST_FAILED`(500) 未在真实服务器上触发（用 store 探针模拟写盘失败）；1 MiB 请求体上限、5000 条上限未做运行时压测。
6. **Host 重载时序**：重载恰好发生在验证中段，HTTP 全流程已在重载后重跑；但重载瞬间的请求丢失/恢复行为未测。
7. Web GUI 首页需要 token，按要求未尝试登录/截图；因此无法确认页面里是否真的存在该面板。

## 8. 关键证据速查

```text
node --check lib/time.js lib/store.js lib/index.js lib/client.js   → 全部通过
npm test                                                            → 49/49 + 22/22
GET  /api/dsh-todo-time-log/health                                  → 200，dataFile=C:\Users\LeoMa\.dsh\todo-time-log\todos.json，count=0
POST /api/dsh-todo-time-log/{create,list,get,complete,uncomplete,update,delete}
                                                                    → 54/54 断言通过（含 409/404/400/405）
store 边界探针（临时目录，35 项）                                     → 35/35（修复、损坏 JSON 归档、并发写、写盘失败兜底）
plugin_manager list_plugins                                          → include:dsh-todo-time-log enabled=true fiberPhase=active
host Tool.listTools                                                  → todo_time_log schema 存在且参数合理
host Config.listConfigs name=dsh-todo-time-log                       → status "absent"（无 Config schema，已知 TODO）
client Slots.listSubTree root=main / sidebar.panellist               → 10s timeout（≥10 次；Builtin/Theme 同样超时）→ NOT VERIFIED
icon.svg                                                             → 1,157 B，XML 解析成功，viewBox 0 0 64 64
```

验证脚本（临时目录，仅在测试中使用，已清理临时数据）：`%TEMP%\qa-http-flow.mjs`、`%TEMP%\qa-store-edges.mjs`、`%TEMP%\qa-asar-*.py`。

---

## 9. 报告后修复与 Lead 复核（追加，2026-11-03 08:55 之后）

本节由 Lead 追加，用于让本报告与最终交付一致。verifier 报告为只读快照，其第 5 节的 LOW 观察已按下述方式处理：

| verifier 观察 | 处理 | 复核 |
| --- | --- | --- |
| LOW-1 合法 JSON 但 `todos` 非数组时未归档就重建空列表 | 已修：改为先 `#archiveCorrupt('shape')` 再重建，并提示「数据文件结构异常，已备份原文件并重建为空列表」 | `test/smoke.mjs` 新增 `shape-invalid file archived` / `shape notice` 断言通过 |
| LOW-2 重复 id 重建时无 notice | 已修：新增提示「存在重复 id 的待办记录，已为后者重新生成 id」 | 新增 `duplicate ids split` / `duplicate id notice` 断言通过 |
| LOW-3 `remove()` 落盘失败返回 500 但内存已删除 | 已修：改为与其它写操作一致——返回 `ok: true` + `notices` 警告 + `persisted: false`（下次写入会重试），不再返回自相矛盾的 500 | `test/http.mjs` 删除用例仍通过；`npm test` = 53/53 + 22/22 |
| LOW-4 / INFO UI 排序不含 title、未接 Client locale 服务、侧栏 label 硬编码中文 | 保留并在 README §6 的 TODO 中登记（属可接受范围） | — |

补充的 Lead 侧独立证据（verifier 未拿到的那项）：

- `cordis_inspect_query`（client / Slots / listSubTree）在 08:45 与 08:52 两次成功返回：
  - `main`：occupant `{ registrant: "Gb", key: "dsh-todo-time-log", active: true }`
  - `sidebar.panellist`：occupant `{ registrant: "Gb", id: "dsh-todo-time-log", order: 30, active: true }`
  - 结论：`lib/client.js` 已在浏览器里成功加载并完成两个槽位注册；**渲染外观仍未截图验收**。
- Host 已按最终源码重载（toggle off→on，`application: "applied"`，`fiberPhase: active`）；重载后：
  - `python test/live-utf8.py` 全通过（含中文标题往返）；
  - 重复 complete 的 409 文案为本地时间格式「完成时间 2026-11-03 08:42:42」；
  - 工具 `todo_time_log` 直接调用 `action=health` 返回「0 条待办，数据文件 C:\Users\LeoMa\.dsh\todo-time-log\todos.json」；
  - 数据文件最终为 `todos: []`，无测试残留、无 `.tmp`。

---

## 10. 二期复核（甘特图 / 项目分类 / 对话式录入）

- 复核者：verifier（独立 QA）；复核时间：2026-11-03 09:16–09:22（Asia/Shanghai）
- 范围：`lib/store.js` v2、`lib/index.js`（工具/Host 契约）、`lib/client.js`（2898 行）、README 与测试（`test/` 只读）
- 只读约束：未修改任何实现文件；本次唯一写入仍是本文件；所有测试数据在临时目录或真机用例内自建自清
- **现场基线**：复核开始时真机曾读到 1 条 Lead 演示待办（标题「甘特图与分类功能联调」、project=`演示`），随后 Lead 已删除；本报告统一以 `total = 0` 为基线执行断言，清理后最终 `total = 0`、`projects = []`
- **Host 状态**：Lead 已用最终源码重载，`plugin_manager`：`include:dsh-todo-time-log` `enabled=true`、`fiberPhase=active`；`GET /health` 返回 `version: 2`、`count: 0`，`loadNotices` 含「数据已从版本 1 迁移到版本 2（新增项目分类字段）」

### 10.1 结论

- **可交付（有保留）**：本轮复核 **无 FAIL**；Host v2、迁移、HTTP 契约、存储边界、客户端纯逻辑（解析/甘特几何/i18n/token）均有可重复证据。
- **PARTIAL / NOT VERIFIED（2 项，均为验证条件限制，非实现缺陷）**：
  1. **浏览器 UI 外观与真实交互未验证**（无浏览器控制/截图能力）：甘特图、分类 UI、对话面板的实际渲染、明暗主题、点击流程均未看到。
  2. **页面未刷新 → 新版 `client.js` 未在浏览器加载**：本次只改了本地 link 目录中的 `lib/client.js`（mtime 09:15:26），浏览器端模块在页面启动时加载；因此本会话的 Client Slots 结果（若可查）也只能反映旧 bundle，不能作为二期证据。交付前提：**用户刷新页面后**才会加载新的 `client.js`。本会话 `cordis_inspect_query` 的 Client 通道仍 10s 超时（重试 1 次），未取得二期 occupant 证据。
- **INFO/LOW 观察 10 条**（均不阻塞交付，未改代码）：见 §10.6。

### 10.2 静态检查与 README 一致性 — PASS

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| `node --check lib/time.js lib/store.js lib/index.js lib/client.js` | PASS | 四文件全部通过（Node v26.13.0） |
| `npm test` | PASS | **70/70** checks + **28/28** HTTP checks |
| README 与实现一致性 | PASS | §2 数据模型（`project`、`''`=未分类、0–40 字符、控制字符/空白归一化）、§2.2 v1→v2 迁移与三类归档（`corrupt-json`/`corrupt-shape`/`corrupt-version-<n>`）、§3.5 甘特规则、§3.6 project 契约与部分更新、§3.7 对话语法、§5 测试断言数（70/28）均与代码/实测一致 |
| README 小缺口（INFO） | — | §5.3 的「UI 手测清单」仍是阶段一清单，未覆盖甘特图/分类/对话；§7 的 Client Slots 记录是刷新前旧 bundle 的结论 |

### 10.3 Host v2 真机 HTTP — PASS（46/46）

所有请求经 `urllib` 以 UTF-8 JSON 发送；用例只创建并删除自己的 id。

- **health**：200；`version=2`；`dataFile=C:\Users\LeoMa\.dsh\todo-time-log\todos.json`；基线 `total=0`。
- **create**：带 `project=工作` / `生活` / 省略 / 40 字分类 → 全部 200，响应 `todo.project` 正确回显；省略时 `project=""`。
- **/list 汇总与回显**：`projects` 含 `工作(1)/生活(1)/未分类(1)/40字(1)`，计数正确且未分类排最后；顶层 `project` 默认 `null`；筛选 `project=工作`、`project=""`（只看未分类）、`project=" 工作 "`（归一化）、不存在的分类（0 条）、`project`+`filter=pending` 组合全部正确；`projects` 始终按全量统计。
- **排序**：`sortBy=project` 升/降序未分类恒居尾；`sortBy=updatedAt` 可用，且「最近更新在前」排序正确；`sortBy=title` 仍可用（回归）。
- **update 部分更新**：只传 `project` → 标题不变；只传 `title` → 分类不变且 `updatedAt` 刷新；同值重复传 → `ok:true` + `unchanged:true` 且 `updatedAt` 不变；`project=""` → 归入未分类；`project=" \u0000工作\t\n "` → `工作`；全空白 → `""`；不带任何字段 → `unchanged`。
- **校验**：create/update 传非字符串 → **400 PROJECT_INVALID**；41 字分类 → **400 PROJECT_TOO_LONG**（40 字通过）。
- **状态机**：complete/uncomplete 在 v2 下正常（完成后 `completedAt` 有值并可按未分类+已完成筛选，取消后清空）。
- **清理**：逐条删除本轮创建的 id，最终 `total=0`、`projects=[]`；未触碰他人数据。

### 10.4 迁移与边界（临时目录驱动 `lib/store.js`）— PASS（52/52）

- **v1 信封**：加载成功、记录数不变、`project=""`；提示「数据已从版本 1 迁移到版本 2（新增项目分类字段）」且只投递一次；**加载本身不改写文件**（仍 `version:1`），下一次写入落盘 `version:2` 且迁移记录带 `project` 字段。
- **不支持版本**：`version:99` → 归档为 `.corrupt-version-99-<ts>`（归档字节与原文件完全一致）、空列表、提示「版本 99 不受支持」。
- **project 修复**：41 字 → `""` + 不分类提示；非字符串（数字）→ `""`；内部/首尾控制字符 → 替换为空格并折叠（`工\u0000作` → `工 作`）；全空白/纯控制字符 → `""`（`validateProject` 实测）。
- **校验函数**：40 字通过、41 字 `PROJECT_TOO_LONG`、非字符串 `PROJECT_INVALID`、`undefined/null` → `""`。
- **排序/统计**：`sortTodos project` 升/降序未分类最后，非空分类方向正确反转，重复分类内按 id 稳定；`computeProjects` 计数/未完成/已完成正确、未分类最后；`filterTodos` 三态正确。
- **甘特数据一致性**：`completedAt < createdAt` → 修正为 `createdAt`；已完成但无完成时间 → 回退 `createdAt`；非法 ISO → 修复为可用时间；全量记录排序后 `createdAt` 非递减、`formatLocalDateTime` 不抛错；`completedAt` 排序时未完成项在末尾；**乱序/损坏数据不崩**。
- **其它**：旧版裸数组信封可加载并在下次写入升级 v2；合法 JSON 但 `todos` 非数组 → 归档 `.corrupt-shape-<ts>` 后重建（阶段一 LOW-1 已修，实测归档字节保留）。
- **阶段一 LOW-3 复核**：`remove()` 在落盘失败时现在返回 `ok:true` + 中文 notice + `persisted:false`（不再返回自相矛盾的 500），内存删除保留、下次写入重试；`duplicate id` 现在带 notice（阶段一 LOW-2 已修，实测）。

### 10.5 Client 静态审查（无浏览器）— PASS（纯逻辑探针 53/53）

> 方法：在 Node 沙箱里求值真实 `lib/client.js` 的模块工厂（`window.__ModuleLoader__` + React stub），直接调用 `parseChatText` / `extractChatProject` / `GanttView` / i18n 等纯逻辑；不改仓库文件，不模拟 DOM。

| 检查点 | 结果 | 证据/说明 |
| --- | --- | --- |
| 仅依赖 `react` | PASS | 文件内 `require(` 仅 1 处 `require('react')`；无 `import`、无 `@deepseek-ai/*` |
| 无 DOM/body 越界 | PASS | 无 `document.*`、`querySelector`、`appendChild`、`createPortal`；仅 `window.__ModuleLoader__.load`；样式以 React `<style>` 元素渲染；聊天滚动只用 React ref 的 `scrollTop` |
| 主题 token | PASS | CSS 使用 21 个 `--dsw-alias-*`；全部在宿主安装包中有定义（21/21）；`CSS_TEXT` 内硬编码颜色 0 处 |
| i18n 成对 | PASS | zh 121 键 + en 121 键 = **242 个键值对**，两语言键集合完全一致；所有静态 `t('…')` 引用键均存在。**注**：若 Lead 的「242 key」指每语言 242 键，则实际是每语言 121；按总数 242 理解则一致 |
| 甘特图区间 | PASS | `start=createdAt`，`end=completedAt/now`；`end===null` 或 `end<start` 时按 now/start 兜底（探针：完成早于创建、非法完成时间） |
| 零跨度 span<=0 | PASS | 左右各扩 30 分钟后重新计算，`span>0`；探针：单条零跨度仍渲染条形 |
| 条形百分比 NaN/负值 | PASS | `left=((start-min)/span)*100`（min 含 5% padding，故非负）、`width=max(...,0.4)%`；探针在零跨度/混合数据下 `left/width` 均可解析、有限、非负 |
| 非法时间兜底 | PASS | `createdAt` 不可解析 → 跳过该条；全部不可解析 → 占位而不是崩溃 |
| 「现在」线 | PASS | 仅当 `now` 落在时间域内才渲染竖线+标签；位置有限 |
| 刻度 | PASS | `chooseTickStep` 对 1ms–10 年跨度均 ≤11 个刻度；>30 天标签为 `MM-DD`，否则 `MM-DD HH:mm` |
| 范围筛选 | PASS | `all/7d/30d`；7d 会过滤 60 天前完成的条；**INFO**：仅过滤条目、不裁剪时间域，60 天前创建且仍在进行的条会把 7d 视图时间域拉回 60 天（与 README 语义一致） |
| 甘特分组 | PASS | 按项目分组、未分类最后；组内保持 `createdAt asc` |
| 对话解析（必测样例） | PASS | `帮我记一下 写周报 #工作；买牛奶 @生活` → 2 条（写周报/工作、买牛奶/生活）；`项目：工作 写周报` → 写周报/工作；`[] 空分类` → 不产生分类（标题保留 `[]`）；`只有填充词`（如「帮我记一下」）→ 0 条且 `skipped=1`；另测 `@`、`[工作]`、`分类:生活`、换行、`待办/请/麻烦/todo:` 填充词、非字符串输入，全部不崩 |
| 对话发送 | PASS（静态） | 逐条 `for..of await /create`；成功/失败分别汇总为助手气泡；`title` 空跳过；`project` 仅非空时发送；发送中禁用输入 |
| 撤销路径 | PASS（静态） | 每条成功 id 逐个 `request('/delete', {id})`（client.js:2226-2247）；完成后消息标记 `undone` 且不再显示撤销按钮；**LOW**：部分删除失败仍标记 undone，不能重试失败条目 |
| 视图切换/契约 | PASS（静态） | 甘特强制 `filter=all&sortBy=createdAt&direction=asc` + 当前 `project`（client.js:2010-2014、2019-2021）；列表视图才显示 filter/sort/direction，甘特视图显示 range 选择 |
| 项目分类 UI | PASS（静态） | 新建表单 project 输入 + `<datalist>` 已有分类（2753）；工具栏筛选 select（全部/未分类/各分类计数，2656）；行内编辑同时改 title+project（2107）；`sortBy=project` 时列表按分类分组（2559）；行内分类徽标与详情分类 |
| 类名覆盖 | PASS | 98 个使用中的 `ttl-*` 类均有布局来源；仅 `.ttl-gantt-group`/`.ttl-time`/`.ttl-view-toggle` 无独立规则（由父类/子类布局承接），`.ttl-sort-dir` 为死 CSS（无功能影响） |

### 10.6 低严重度观察（INFO/LOW，未改代码）

1. **LOW（UI 一致性）**：`sortBy=project` 时列表由客户端 `groupTodosByProject` 固定升序重排（组内按 Host 的 project 排序 + id tiebreak），**切换 asc/desc 没有可见效果**（client.js:2559-2578、581-583）。若保留方向选择，建议在分组视图内也应用方向或隐藏该控件。
2. **LOW（对话撤销）**：部分 `/delete` 失败时仍把消息标记为 `undone` 并只汇报成功条数，失败条目无法再次撤销（client.js:2226-2247）。
3. **INFO（甘特范围）**：范围筛选只过滤条目、不裁剪时间域（见 §10.5），超长进行中待办会拉长 7d/30d 视图。
4. **INFO（对话解析）**：只移除第一个分类标记，`买牛奶 @生活 @工作` 标题会残留 `@工作`；`#/@/项目：` 的分类名不支持空格（`[名 称]` 支持）；`[]` 不视为分类且保留在标题。解析器为启发式，README §6.6 已声明。
5. **INFO**：行内编辑的客户端预检按原始长度 `>40` 拒绝，可能拒绝服务端归一化后会 ≤40 的输入（如大量空格），属偏保守的 UX（client.js:2096-2100）。
6. **INFO（i18n 文案）**：en 的 `group.header` 为 `{project} · {count}`（缺计数量词），zh 为 `{project} · {count} 条`；en `chat.welcome` 仍含中文语法关键词 `项目：name`（作为语法示例可接受）。
7. **INFO（死 CSS/空类）**：`.ttl-sort-dir` 已无引用；`.ttl-view-toggle`、`.ttl-time` 无独立规则（由父类布局承接）。
8. **INFO（HTTP 边界）**：`/list` 的 `project` 过滤参数不做类型校验，传数字等非字符串会被当成 `""`（只看未分类）而非 400（`create`/`update` 会正确 400）。
9. **INFO（a11y）**：折叠状态下 `aria-controls` 指向未渲染的 `ttl-chat-body`；与阶段一行详情按钮同类问题。
10. **INFO（显示元数据）**：`locale/*.json` 的 `meta.description` 仍是阶段一文案，未提及甘特图/分类/对话；显示名与图标不受影响。

### 10.7 未覆盖的验证盲区

1. **浏览器 UI 外观与真实交互**（甘特图渲染、分类筛选/编辑、对话面板、撤销按钮点击、明暗主题、控制台）未验证：无浏览器控制/截图能力，且未用 mock 页面代替。
2. **新版 `client.js` 尚未在页面加载**：页面未刷新，Client 端实时状态（occupant、`active`）无法作为二期证据；本会话 Client Inspect 通道仍 10s 超时。
3. **智能体工具未直接调用**：只验证了 Host 重载后 `Tool.listTools` 的 `todo_time_log` schema（含 `project`、`sortBy` 增加 `updatedAt/project`）；工具执行路径与 HTTP 共用 `executeTodoAction`（源码事实），未在会话里实际执行工具。
4. **大数据/性能**：5000 条上限、长列表甘特渲染性能、会话气泡长历史未压测。
5. **迁移只在临时目录验证**：真实数据文件已为 v2/空列表，未在真机 v1 文件上演练（避免改动真实数据）。

### 10.8 本轮证据命令（可复跑，均在临时目录）

```text
node --check lib/time.js lib/store.js lib/index.js lib/client.js      → 4/4 通过
npm test                                                              → 70/70 + 28/28
python %TEMP%\qa-phase2-http.py                                       → 46/46（分类/筛选/排序/部分更新/400/清理 total=0）
python %TEMP%\qa-phase2-extra.py                                      → 6/6（updatedAt 排序、title 排序、project 边界）
node   %TEMP%\qa-phase2-store.mjs                                     → 52/52（v1→v2、v99 归档、project 修复、乱序甘特数据、shape 归档）
node   %TEMP%\qa-phase2-client.mjs                                    → 53/53（解析/GanttView 几何/i18n/分组）
curl -s http://127.0.0.1:52283/api/dsh-todo-time-log/health           → version 2, count 0
curl -s -X POST .../list                                              → total 0, projects []
```

**本轮复核结束状态**：真机 `total = 0`、`projects = []`、无测试残留；Host active、数据模型 v2。客户端二期功能的「可见结果」仍待用户刷新页面后人工确认（或具备浏览器控制能力时补验）。

---

## 11. 二期观察的收口与 Lead 复核（追加）

QA 第 10.6 节的 LOW/INFO 观察已按下述方式处理，本节用于让报告与最终交付一致：

| QA 观察 | 处理 | 复核 |
| --- | --- | --- |
| LOW-1 `sortBy=project` 时 asc/desc 无可见效果 | 已修（client.js `groupTodosByProject(todos, direction)`）：组顺序随方向、未分类始终最后，组内按 createdAt + 方向排序；甘特图仍固定 asc | ui-dev shim 用例：desc 组序 `['B','A','未分类']`、asc 相反且未分类在尾 |
| LOW-2 对话撤销部分失败仍标记 undone | 已修：全成才 `undone`；部分失败保留 `undoFailed` 并显示「重试撤销」，重试只重删失败 id | ui-dev shim：1 成功 1 失败 → 未标记 undone、文案「已撤销 1 条，1 条失败」、重试后全部成功 |
| INFO 多分类标记残留 | 已修：扫描全部 `#`/`@`/`[..]`/`项目：`/`分类：`，首个非空作分类、全部从标题删除（重叠区间合并），`[]` 删除且不产生分类 | shim：`买牛奶 @生活 @工作`、`[] 写周报 [项目C] #工作`、`项目：X 分类：Y 回邮件` 均正确 |
| INFO en `group.header` 缺量词 | 已修：`'{project} · {count} item(s)'`；en 全量 124 条扫描仅保留允许的中文语法示例 | 静态核对 |
| INFO 行内编辑按原始长度预拒绝 | 已修：`normalizeProjectInput`/`normalizeTitleInput` 先归一化再判长度与变化，并去掉项目输入 `maxLength` | shim：归一化后 39/40 字可提交，41 字本地拒绝 |
| INFO `/list` 分类过滤参数不做类型校验 | 已修（Host `store.list`）：非字符串分类过滤返回 `PROJECT_INVALID`（HTTP 400） | 真机重载后 `/list {"project": 42}` → `400 PROJECT_INVALID`；正常 `/list` 仍 200 |
| INFO locale `meta.description` 未含二期能力 | 已修：zh/en 描述加入甘特图、项目分类、对话式录入、`todo_time_log` | 静态核对 |

Lead 最终复核（本轮）：

```text
node --check lib/time.js lib/store.js lib/index.js lib/client.js  → 4/4 通过
npm test                                                          → 71/71 + 30/30
工作区 lib/client.js 与 profile 安装副本                            → 字节级一致（106,150 B）
真机 /health                                                       → version 2，count 0
真机 /list {"project":42}                                          → 400 PROJECT_INVALID
真机 /list                                                         → total 0，projects []
python test/live-projects.py                                       → 全通过
智能体工具 todo_time_log（create project=验收 → list → delete）      → 分类标签与「分类：验收(1)」正确
```

**仍未验证**：浏览器刷新后的真实渲染与交互（甘特图视觉、分类筛选手感、对话面板/撤销点击、明暗主题、控制台报错）。这是本轮唯一的 PARTIAL，原因是本会话没有浏览器控制与截图能力。

---

## 12. 三期复核（四视图 + 甘特行内操作）

- 复核者：verifier（独立 QA）；复核时间：2026-11-03 09:38–09:45（Asia/Shanghai）
- 范围：`lib/client.js`（3948 行，四视图 + 甘特行内操作）、`npm run audit`（`test/client-audit.mjs`）、Host 真机 API 回归；`lib/`、`test/`、`locale/`、`icon.svg` 等实现文件只读
- 只读约束：未修改任何实现文件；本次唯一写入仍是本文件；真机测试数据自建自清
- **页面状态**：本轮浏览器页面**未刷新**，所以页面里仍是上一版 `client.js`；新版客户端代码的可见效果必须在刷新页面后才成立（交付前提，见 §12.6）
- **Host 状态**：`include:dsh-todo-time-log` `enabled=true`、`fiberPhase=active`；`GET /health` → `version: 2`、`count: 0`；`lib/index.js` mtime 仍 09:08（本轮未改），`lib/store.js` 为 09:22（二期收口对 `/list` 分类过滤类型校验的修改，见 §11，本轮已回归）

### 12.1 结论

- **可交付（有保留）**：**无产品 FAIL**。四视图框架、日历本地时区/42 格/落格依据、看板分组与计数、表头排序单一状态源、甘特行内操作与表格展开独立、i18n 163 键成对无死键、依赖/主题/类名前缀等均通过独立探针或静态核对。
- **PARTIAL / NOT VERIFIED（2 项，均为验证条件限制）**：
  1. **浏览器 UI 外观与真实交互未验证**（无浏览器控制/截图）：四视图实际渲染、看板列宽/列内滚动、日历格高/补格弱化、甘特行内详情、明暗主题、点击流程均未看到。
  2. **新版 `client.js` 需刷新页面才加载**：页面未刷新，Client 端实时状态不能作为三期证据；本会话 `cordis_inspect_query`（client / Slots）仍 10s 超时（1 次），未取得 occupant。
- **1 条文档/口径偏差（非产品缺陷，见 §12.5）**：`npm run audit` 实际执行 **26** 项断言（全部 PASS），而 README/任务描述/Lead 记录写的是 **27 项**。

### 12.2 静态与脚本 — PASS

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| `npm run check`（4 个 lib 文件） | PASS | 4/4 通过，无 stderr |
| `npm test` | PASS | **71/71** + **30/30** |
| `npm run audit` | PASS（26/26） | 26 条 `PASS`，退出码 0；摘要：`i18n keys per language: 163; alias tokens: 21; class names: 125` |
| 工作区 ↔ profile 安装副本 | PASS | `lib/client.js`、`lib/index.js`、`lib/store.js`、`lib/time.js`、`package.json`、`locale/{zh,en}.json`、`icon.svg` 共 8 个文件 `cmp` 全部字节一致 |
| README 与实现一致性 | PASS（2 处记录偏差） | 四视图/取数策略/日历规则/看板/表头排序/甘特行内操作/i18n 163/测试 71+30 与实现一致；偏差：audit「27 项」实际 26；§7 的「ui-dev shim 169 条断言」为 Lead 侧记录，本轮无法独立复现 |

### 12.3 Client 审查（无浏览器，Node 沙箱真实求值）— PASS（77/77）

方法：在 Node 沙箱求值真实 `lib/client.js` 的模块工厂（`window.__ModuleLoader__` + React stub），直接调用 `queryForView` / `buildCalendarCells` / `calendarDayKey` / `boardColumns` / `groupTodosByProject` / `GanttView` / i18n / `parseChatText` 等；不改仓库文件、不模拟 DOM。

| 检查点 | 结果 | 证据 |
| --- | --- | --- |
| 视图框架 | PASS | `VIEWS` 四值顺序 table/board/gantt/calendar；默认 `useState('table')`；`queryForView`：table 透传 filter/sortBy/direction，board=`all/createdAt/desc`，gantt=`all/createdAt/asc`，calendar=`all/createdAt/asc`；分类筛选在所有视图均透传（`loadList(..., projectFilter)`）；切换视图不重置 filter/sortBy/direction/projectFilter |
| 表格 | PASS（静态） | 6 列表头（标题/分类/状态/创建/完成/操作）；可排序列 `aria-sort`（none/ascending/descending）；表头 `handleHeaderSort` 与工具栏 select 共用 `sortBy`/`direction` 同一状态（无第二份排序状态）；窄屏 `.ttl-table-wrap{overflow-x:auto}` + `.ttl-table{min-width:760px}`；`sortBy=project` 用 `groupTodosByProject(todos, direction)`，方向生效且未分类最后（二期 LOW-1 已修，见下） |
| 看板 | PASS | `boardColumns` 状态分组=未完成/已完成两列（空列有占位文案）；分类分组=按名称排序、未分类最后；列头计数=该列条目数；空数据=整板空态；列体 `max-height:56vh; overflow-y:auto`；卡片含分类/状态徽标、创建/完成时间、完成/编辑/删除 |
| 日历 | PASS（核心） | 42 格、周一起始；以 2026-11 验证：首格 `2026-10-26`（周一）、当月 30 格 `2026-11-01..30`、补格 12 格（末格 `2026-12-06`）；2024-02 闰月 29 格且周一对齐；`dateKeyOf` 用本地 getter：本地 `2026-11-03 00:30` → `2026-11-03`，同刻 UTC 日期为 `2026-11-02`（证明非 UTC 落格）；按 `completedAt` 落格时未完成条目（completedAt=null）返回 `''` 被跳过；非法时间返回 `''`；每格最多 3 条 + `+N`；上/下月与「今天」跳转函数存在 |
| 甘特行内操作 | PASS | 行标签为 `<button>`，带 `aria-expanded`/`aria-controls`（折叠 false/展开 true）；展开后渲染 `role="region"` 的 row detail（id `ttl-gantt-detail-*`），内含共享 `renderDetailContent` 与 `renderActions`；编辑态由父级传入 `renderEditFields`（内部用共享 `titleInput`/`projectInput`）；**条形仍是 `div role="img"`，无 onClick、非按钮语义**；行本身可点击展开（鼠标），键盘走标签按钮；甘特展开状态 `ganttExpandedIds` 与表格 `expandedIds` 是两份独立 state，id 前缀也不同（`ttl-gantt-detail-` vs `ttl-detail-`），刷新时各自裁剪 |
| 分组方向（二期收口复核） | PASS | `groupTodosByProject(todos,'asc')` → `工作,生活,未分类`；desc → 组序反转且未分类最后；组内按 createdAt 升/降；非法 createdAt 组内置尾 |
| 对话解析（二期收口复核） | PASS | `买牛奶 @生活 @工作` → 分类 生活、标题 买牛奶（全部标记删除）；`[] 写周报 [项目C] #工作` → 分类 项目C、标题 写周报（空 `[]` 删除）；`项目：X 分类：Y 回邮件` → 分类 X、标题 回邮件；二期必测样例仍通过；填充词-only 跳过 |
| 撤销路径（二期收口复核，静态） | PASS | 部分失败时保留 `undoFailed`、只有全成才置 `undone`，重试只重发失败 id 的 `/delete`；本轮无浏览器交互验证 |
| i18n | PASS | **163 键/语言**（共 326 键值对），zh/en 键集合一致、占位符成对一致；独立扫描（排除 I18N 字典本体）无死键、无未声明 `t()` 键 |
| 通用约束 | PASS | `require(` 仅 1 次且为 `'react'`；无 `document.*`/DOM 查询；CSS 无硬编码颜色；21 个 `--dsw-alias-*` 在宿主安装包中全部有定义；类名统一 `ttl-` 前缀 |
| 防御性 | PASS | 空数组/`null`/非数组 todos 不抛错；非法时间跳过；1000 字标题 + 未知 range 的 GanttView 不抛错；缺字段的看板条目安全；未知 view 回退表格查询 |

### 12.4 真机 API 回归 — PASS（20/20）

`/health` 200（version 2, count 0）；create 带/不带 project（回显正确）；`/list` 返回 `projects`（未分类最后）与顶层 `project` 回显；`project=工作` / `project=""` 筛选；update 只改分类/只改标题；complete/uncomplete；`/list {"project":42}` → **400 PROJECT_INVALID**（二期收口修改仍生效）；`project:null` 视为不筛选；未知 id → 404；清理后 `total=0`、`projects=[]`、health count=0。**未留下测试数据**。

### 12.5 文档/口径偏差与 INFO 观察（未改代码）

1. **LOW（文档/口径，非产品缺陷）**：`npm run audit` 实际执行 **26** 项断言（全部 PASS）：脚本有 23 个 `check()` 调用点，其中四视图那项在 `for` 循环里展开为 4 条 → 22 + 4 = 26。README §5（2 处）与 §7、任务描述均写「27 项」。建议把 README 与脚本注释统一为 26（或补一条真实断言到 27）。
2. **INFO**：audit 是静态门禁，存在已知盲区（不影响本次结论）：className 仅扫描 `className: '…'` 单引号形式（未覆盖模板字符串/变量类名）；「无死键」用「键名子串是否出现在源码」判断（注释内出现也算）；hex 颜色扫描覆盖整个文件（未来注释里出现 `#xxx` 会误报）。本轮已用独立 shim 覆盖 i18n/类名/token。
3. **INFO**：6 个使用中的 `ttl-` 类没有独立 CSS 规则（`ttl-gantt-row-expanded`、`ttl-board-column-title`、`ttl-td-project`、`ttl-td-status`、`ttl-calendar-nav`、`ttl-view-toggle`，外加 wrapper `ttl-gantt-group`）；它们由父类/语义钩子承接，未发现布局缺口，但「展开行高亮」等若期望视觉效果则缺样式（外观未验证）。
4. **INFO（a11y）**：甘特行标签的 `aria-controls` 在折叠状态指向未渲染的 detail id（表格标题按钮同款）；甘特整行鼠标可点但行本身无 `role`/`tabIndex`，键盘用户走标签按钮。
5. **INFO（日历文案边界）**：`monthHasEntries` 只统计本月格；若只有前后月补格有条目，仍会显示「本月没有条目」提示（补格里同时有条目），属文案边界。
6. **INFO（看板空列语义）**：状态分组固定两列（空列有占位）；分类分组只生成有数据的分类列（不生成零条目分类列），与 README 描述一致。
7. **INFO**：视图切换保留筛选/排序状态，但看板/甘特/日历取数固定 `filter=all`（状态筛选只在表格生效）——README §3.7 已明确该策略。

### 12.6 未覆盖的验证盲区

1. **浏览器 UI 外观与真实交互**：四视图渲染、看板列宽/滚动、日历格高/补格弱化、甘特行内详情、明暗主题、控制台报错均未验证（无浏览器控制/截图；未用 mock 页面替代）。
2. **新 `client.js` 未加载到页面**：页面未刷新；Client Inspect 通道本轮仍超时，无法取得三期 occupant；刷新后需人工目测清单见 README §5.4。
3. **真实点击流程**：表头排序、视图切换、看板卡片操作、日历翻月/选中日、甘特行展开/编辑/删除均只有静态与纯逻辑证据，没有真实点击验证。
4. **shim 覆盖边界**：表格/看板/日历的渲染函数是 `TodoPanel` 内的闭包（依赖 hooks state），无法在沙箱直接调用；本次用其纯逻辑 helper + 源码核对代替。
5. **大数据/性能**：5000 条看板列、42 格多条目日历、甘特长列表性能未压测。
6. **智能体工具**：本轮未直接调用 `todo_time_log`（Host schema 未变；API 回归已覆盖同一 `executeTodoAction` 路径）。

### 12.7 本轮证据命令

```text
npm run check                                                     → 4/4
npm test                                                          → 71/71 + 30/30
npm run audit                                                     → 26 PASS（163 键/语言、21 token、125 类名）
node %TEMP%\qa-phase3-client.mjs                                  → 77/77（四视图/日历本地时区/看板/甘特行内/i18n/解析）
python %TEMP%\qa-phase3-live.py                                   → 20/20（health/create/list/update/complete/delete/清理 total=0）
cmp 工作区 ↔ profile 安装副本（8 文件）                            → 全部一致
plugin_manager list_plugins                                       → include:dsh-todo-time-log active
```

**本轮结束状态**：真机 `total = 0`、`projects = []`、health `version=2/count=0`；Host active；三期客户端代码已就绪，**刷新页面后**才可见，外观与真实交互仍待人工确认。

---

## 13. 三期收口（追加，Lead）

§12.5 的唯一文档偏差已修复，其余 INFO 项按「不影响功能、外观待人工确认」保留：

| 项 | 处理 |
| --- | --- |
| README/任务写「audit 27 项」，实际 26 项 | 已修：README §5（2 处）与 §7 均改为 26 项；脚本本身未改（26 条断言即实际调用点展开结果） |
| §7「ui-dev shim 169 条断言」被当作 QA 证据 | 已修：README §7 明确标注为「实现方自测」，并补充独立 QA 在 Node 沙箱真实求值的 77 条断言 |
| INFO 6 个 `ttl-` 类无独立 CSS 规则（含 `ttl-gantt-row-expanded`） | 保留：由父/子类布局承接，无布局缺口；「展开行高亮」属视觉效果，待刷新页面后按实际观感再定 |
| INFO 甘特折叠态 `aria-controls` 指向未渲染节点；甘特整行可鼠标点但无 role/tabIndex | 保留：键盘用户走标签按钮，与表格标题按钮一致的模式 |
| INFO 日历 `monthEmpty` 只按本月格判断 | 保留：语义为「本月没有条目」，前后月补格有数据属正常 |
| INFO audit 脚本静态盲区（单引号 className / 死键子串 / hex 全文件扫描） | 保留并已知：已由 QA 的沙箱求值补位，脚本仅作轻量门禁 |

Lead 最终回归（本轮）：

```text
npm run check                       → 4/4 通过
npm test                            → 71/71 + 30/30
npm run audit                       → 26 项全通过（i18n 163 键/语言、21 token、125 类名）
python test/live-utf8.py            → 全通过
python test/live-projects.py        → 全通过
GET  /health                        → version 2，count 0
真机 /list                          → total 0，projects []
工作区 lib/client.js ↔ profile 安装副本 → 字节一致（141,254 B / 3,948 行）
```

**交付前提**：浏览器端 `client.js` 在页面启动时加载，改动后需要**刷新一次 Harness 页面**；四视图与甘特行内操作的视觉/交互仍属人工验收项。

---

## 14. 四期复核（@文件引用 / 对话 quick-add / 数据模型 v3）

- 复核者：verifier（独立 QA）；复核时间：2026-11-03 10:33–10:55（Asia/Shanghai）
- 范围：`lib/store.js`（v3）、`lib/index.js`（/files、/quick-add、/workspaces、/todo 命令、工具 quick_add）、新增 `lib/parse.js` / `lib/files.js`、`lib/client.js`（4323 行，@ 补全 + 文件 chips + quick-add）；实现文件只读
- 页面状态：浏览器页面**未刷新**，页面内仍是上一版 `client.js`；四期客户端效果需刷新后才成立（交付前提）
- **Host 状态**：`include:dsh-todo-time-log` `enabled=true`、`fiberPhase=active`；`GET /health` → `version: 3`、`count: 1`、`workspaceRoot = D:\code\File_Manager_Legacy`
- **现场基线说明（与任务描述不一致，不是我造成的）**：任务称「当前 total 应为 0」，实际基线有 1 条 **Lead 的**待办 `修复看板`（project=`工作`，files=`["lib/client.js"]`，id `ttl_mw02ofbg0ahbbuxu`）。按「不要删除 Lead 的数据」的要求我**未删除**它；我的用例自建自清，最终 total 回到基线 **1**。若要求最终为 0，请 Lead 清理该条。
- **工作区根现场差异**：任务称根为 `D:\code\dsh-todo-time-log`，实际 `/workspaces` active 是 `D:\code\File_Manager_Legacy`（最近活跃 live session 的 cwd 排第一）；本仓库仍是候选之一（source=session），带 `workspace` 参数访问 `/files` 时命中 `lib/store.js`。这是「跟随最近活跃会话」设计的现场表现，非缺陷。

### 14.1 结论

- **可交付（有保留）**：核心四期能力（v3 模型/迁移、files 校验与派生、parse 统一解析、/files、/quick-add、/workspaces、工具 quick_add、@ 补全、文件 chips、四视图回归）均通过真机与独立探针；**无破坏性 FAIL 阻塞交付**。
- **FAIL（1 条，中）**：`project: ''` 的显式「未分类」不持久——create/update 当次生效，但**重载后** `normalizeTodo` 会从 `files` 重新派生分类（见 §14.6 FAIL-1）。
- **PARTIAL / NOT VERIFIED（4 条）**：浏览器 UI 外观与真实交互未验证（无浏览器控制）；页面未刷新导致新 client.js 未加载、Client Inspect 仍 10s 超时；`/todo` 命令只做静态契约核对，未实际执行；`/files` 的「无 fs 时 501」只在 handler 直接注入 `fileIndex:null` 时成立，真实 apply 路径下 fs 故障会返回 500（见 §14.6）。
- **LOW/INFO 观察 12 条**（包括含空格文件路径的 @ 引用不可解析、mixed 非法 files 静默丢弃、README 残留旧的客户端解析章节等，见 §14.7）。

### 14.2 静态与脚本 — PASS

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| `npm run check` | PASS（但只覆盖 4 个文件） | 脚本仍是 `time/store/index/client` 四个；新增 `parse.js`/`files.js` **不在** check 中（LOW，见 §14.7-7） |
| 手工 `node --check` 全部 6 个 lib 文件 | PASS | `time/store/index/client/parse/files` 6/6 通过 |
| `npm test` | PASS | **35/35**（parse）+ **88/88**（smoke）+ **39/39**（http） |
| `npm run audit` | PASS | **26/26** PASS，退出码 0；摘要 `i18n keys per language: 175; alias tokens: 22; class names: 139` |
| 工作区 ↔ profile 安装副本 | PASS | client/index/store/time/parse/files/package.json/locale×2/icon 共 10 个文件 `cmp` 字节一致 |
| README 与实现一致性 | PARTIAL（见 §14.6/§14.7） | 数据模型 v3、迁移、files 约束、派生规则、/workspaces 顺序、测试数 35/88/39、audit 26、@补全参数（150ms/12 条/↑↓/Enter/Tab/Esc）均一致；但 §3.8 残留旧的「客户端规则解析」重复章节、`npm run check` 注释过时、§7 混有阶段三历史行 |

### 14.3 Host 代码审查与边界 — PASS（111/111 独立探针）

方法：临时目录直接驱动 `store.js` / `parse.js` / `files.js` / `index.js`（fake fs、fake sessions/registry、内嵌 HTTP server），不碰真实数据文件。

- **files 校验**：`undefined/null` → `[]`；非数组 → `FILES_INVALID`；POSIX 归一化、`./` 去掉、重复斜杠折叠、去重；绝对路径/盘符/UNC/`..`/控制字符/超 300 字符/非字符串 → 丢弃；全部无效 → `FILES_INVALID`（HTTP 400）；混合有效+无效 → 保留有效项（丢弃项在 create/update 无提示，见 §14.7-2）；20 个通过、21 个 → `TOO_MANY_FILES`（400）。边界：`normalizeFilePath('C:')` 返回 `'C:'`（盘符后无斜杠未被拦截，见 §14.7-3）。
- **分类派生**：仅 files → 首个文件目录（`lib/a.js`→`lib`、`src/auth/login.ts`→`src/auth`、根文件 `README.md`→`README.md`、超长目录回退末段 ≤40）；显式非空 project 优先；**显式空 project 当次 create/update 优先**（当次返回 `project:''`）；但重载后失败，见 FAIL-1。
- **迁移与修复**：v1→v3 与 v2→v3 各自提示一次；加载不改写文件，下一次写入落盘 `version:3`；v1 记录补 `project:''`/`files:[]`，v2 保留 project 并补 `files:[]`；version 99 归档 `.corrupt-version-99-*` 且字节保留；v3 记录缺 project 但有 files → 派生 + 提示；非法/非数组 files → 清空 + 提示；缺 id/重复 id/非法状态/时间修复沿用旧逻辑并通过。
- **parse.js 边界**：换行/`；`/`;` 拆条；`#`/`@`/`[]`/`项目：`/`分类：` 最左非空优先且全部从标题剥离（`[]` 也删除）；`@路径`/`@file.ts`/knownFiles 命中 → files，否则 `@名称` → 分类；填充词循环剥离（含「新任务/任务/提醒我/todo/task/add」）；首尾标点剥离；纯标记/纯填充词 → `skipped NO_CONTENT`；空输入 → 0 items；超长标题由 store 报 `TITLE_TOO_LONG`。
- **files.js 索引（fake fs）**：只读 `resolve/listDir`；忽略 `node_modules/.git/dist/` 与点目录；目录深度 ≤4，超过即停止并置 `truncated`；文件上限 2000（截断）；20s TTL 缓存 + root 切换失效；query 大小写不敏感子串 + limit 1..200 + `truncated`（匹配数超过 limit 或索引截断）；`knownFileSet` 失败返回空集合不抛错。
- **workspace 根解析**：config > 按最后事件时间排序的 live session（排除 `origin==='subagent'`）> registry（cwd 精确优先、再 updatedAt 降序）> `process.cwd()`；`/workspaces` 返回 active + 候选（path/title/source）；`/files`/`/quick-add` 的 `workspace` 只接受候选路径，未知 → **400 WORKSPACE_UNKNOWN**；`/files` 未知 workspace 在 fileIndex 存在时正确 400。
- **契约**：`/quick-add` 返回 `{parsed, created, skipped, errors}`；HTTP 状态映射 `FILES_INVALID/TOO_MANY_FILES/WORKSPACE_UNKNOWN` → 400、空 text → 400；工具 `quick_add` 与 `/todo` 命令共用 `runQuickAdd`；工具 schema 含 `action=quick_add`、`files`、`text`；`createTodoTool(store, fileIndex, getWorkspaceRoot)` 注入修复已验证（`quick_add` 不再 INTERNAL）。
- **`/files` 无 fs**：handler 直接注入 `fileIndex:null` → 501 `FILES_UNAVAILABLE`；但 apply 路径始终注入包装器，fs 故障返回 **500 INTERNAL**（见 §14.6 PARTIAL-3）。

### 14.4 真机回归 — PASS（41/41）

- `/health` 200 + `version 3` + `workspaceRoot`；`/workspaces` 200，active=候选首项，本仓库在候选中；`/files`（workspace=本仓库）`query=lib/s` 命中 `lib/store.js`，`limit=1` 时 `truncated=true`，默认根=active workspace（当前 `File_Manager_Legacy`）。
- `create` 带 files → project 派生 `lib`；显式 `工作` 优先；显式 `project:''` 当次为 `''`；`/list` 回显 files/projects；`update` 只改 files 保持 project、显式空 project 当次生效、同值 `unchanged`、非法 files → 400；`complete/uncomplete` 正常。
- `/quick-add`「新任务 写周报 #工作 @lib/store.js；修复甘特图 @lib/client.js；#只有分类」→ parsed=2/created=2/skipped=1，首条 `[工作]/写周报/files=[lib/store.js]`，第二条 `lib/修复甘特图/files=[lib/client.js]`；空 text → 400；未知 workspace → 400；纯标记 → 200+skipped。
- 错误用例：绝对路径 files→400 FILES_INVALID、21 files→400 TOO_MANY_FILES、非数组 files→400。
- **清理**：只删除本轮创建的 id；Lead 的 `修复看板` 原样保留；最终 total=1（=基线）、health count=1、projects 不变。

### 14.5 Client 静态复核 — PASS（88/88，无浏览器）

方法：Node 沙箱真实求值 `lib/client.js` 工厂（React stub），直接调用 `findAtToken` / `normalizeFiles` / `FileChip` / `ChatPanel` / 四视图 helper；只读源码，不改仓库。

| 检查点 | 结果 | 证据 |
| --- | --- | --- |
| i18n | PASS | **175 键/语言**（350 键值对），zh/en 键集合一致、占位符成对；独立扫描（排除字典本体）无死键、无未声明 `t()`；files/chips/suggest/quick-add 新键齐全 |
| 通用约束 | PASS | 仅 1 处 `require('react')`；无 `document.*`/DOM 查询/`innerHTML`/portal；无硬编码颜色；22 个 `--dsw-alias-*` 全部在宿主包中有定义；类名 `ttl-` 前缀 |
| @ token 检测 | PASS | `hello @lib/s` → start/end/query 正确；裸 `@`、`a@b`、caret 越界/NaN/非字符串安全；`@` 后有空白/换行 → null（关闭补全）；caret 在 `@` 前 → null |
| @ 补全下拉 | PASS | loading/error/empty 三态文案；listbox + option + `aria-selected`；↑↓ 循环、Enter/Tab 选择、Esc 关闭；点击选项选择；`/files` 拉取 `limit=200` 后 slice 12、150ms 防抖、缓存上限 100、选中插入 `@path `；面板打开时预热空 query |
| 文件 chip | PASS | `FileChip` 为 `<button>`，class `ttl-file-chip(-compact)`，aria/title 含复制路径，点击 `stopPropagation` 并复制；空 path → null；label 覆盖；0 files 不渲染容器；表格 max 1 compact、看板 max 2、日历/详情不限、`+N` 用 `files.more` |
| quick-add 气泡 | PASS | 客户端不再本地解析，只 POST `/quick-add`；created/skipped/errors 三段文案与网络失败 `chat.quickAddFailed`；成功气泡带文件 chips；撤销按钮仅在有 successes 时出现，点击回传消息；部分失败显示「重试撤销」；无内容/0 创建无 chip/undo |
| 四视图回归 | PASS | VIEWS 四值、默认 table、queryForView 映射不变；日历 42 格周一起始/本地时区/完成时间 basis 排除未完成；看板分类列顺序与计数；表格 project 分组方向；甘特条形 `div role=img` 非按钮 + 标签 button aria-expanded |
| 防御性 | PASS | normalizeFiles 0/1/N、去重、trim、上限 20、非法项过滤；suggestions/skipped/errors 规整；findAtToken 空/非法输入安全 |

### 14.6 FAIL / PARTIAL 清单

**FAIL-1（中）显式空 project 不持久：重载后会被 files 派生覆盖**

- 复现（临时目录，真实 `lib/store.js`）：
  1. `create({ title:'显式空分类', project:'', files:['lib/a.js'] })` → 当次 `todo.project === ''`（符合「显式空优先」）；
  2. `dispose()` 后新建 `TodoStore` 指向同一文件并 `load()`；
  3. 该记录 `project` 变为 **`lib`**，并出现提示「缺少项目分类，已按文件目录归类为『lib』」。
- 根因：`store.js` `normalizeTodo()` 第 249-251 行把「`project === ''` 且 files 非空」一律视为缺分类并派生；但 v3 记录里 `''` 恰恰是用户显式选择的「未分类」，无法与「字段缺失」区分（v3 落盘永远带 project 字段）。
- 影响：用户用 API/UI 显式选择「未分类」并挂文件，下次 Host 重载/重启后分类被悄悄改成文件目录；与任务验收点「含显式空 project 优先于派生」冲突。
- 建议（未改代码）：仅在 `raw.project === undefined`（字段缺失，含 v1/v2 老记录）时派生；v3 记录保留显式 `''`。或持久化一个显式标记。
- 证据：本轮 Host 探针 111/111 中该项以「KNOWN DEFECT … actual === 'lib'」记录并通过；真机当次 API 行为正确（41/41 用例中的 explicit-empty 项）。

**PARTIAL-1** 浏览器 UI 外观与真实交互未验证（无浏览器控制/截图）：@ 下拉视觉、文件 chip 布局、quick-add 气泡、看板/日历/甘特外的四期元素均未看到；客户端代码需**刷新页面**才加载。
**PARTIAL-2** `/todo` 斜杠命令：静态核对 `apply()` 用 `mountOn(ctx, ['commands'])` 注册 `{name:'todo', description, input, handler}`，与 commands 服务 `CommandDefinition`/`CommandInvocation.rawInput`/`CommandResult kind` 契约一致；但本会话**无法实际执行**该命令（无命令调用面），注册是否成功未取到运行时证据。
**PARTIAL-3** 「无 fs 时 501」：`createHttpHandler(store,{fileIndex:null})` 时确实 501；但 `apply()` 永远传入 `createFileIndex` 包装器，`ctx.get('fs')` 缺失时 `/files` 走外层 catch → **500 INTERNAL**，与 README §5.1 的「`/files` 无文件服务时 501」描述不完全一致（当前 profile fs 存在，无用户影响）。
**PARTIAL-4** 现场与任务描述不一致（非代码缺陷）：基线 total=1（Lead 的 `修复看板`）、active workspace root=`D:\code\File_Manager_Legacy`；本仓库作为候选带 `workspace` 参数可正常访问。已在 §14 开头注明。

### 14.7 LOW / INFO 观察（未改代码）

1. **含空格的文件路径无法用 @ 引用（LOW 缺陷）**：客户端 `findAtToken` 遇到空白即判为无 token；Host parser `@([^\s@]+)` 同样在空格处断开。选中含空格路径的建议（如 `My File.ts`）会插入 `@My File.ts `，Host 解析为项目 `My`、标题 `File.ts`、files=[]（实测 `parseQuickAddLine('@My File.ts')`）。Windows 工作区常见空格路径，建议插入时支持引号/转义或 parser 支持 `@"path with space"`。
2. **mixed 非法 files 静默丢弃（INFO）**：`create/update` 传 `['lib/a.js','/abs/b.js']` → 保留有效项、丢弃无效项，但结果 `notices` 为空（load 路径会提示「已丢弃 N 个非法的文件引用」）；建议 create/update 也把 `validateFiles().dropped` 转成 notice。
3. **`normalizeFilePath('C:') === 'C:'`（INFO 边界）**：盘符后无斜杠未被 `^[a-zA-Z]:\/` 拦截，会作为奇怪相对名入库；影响极小。
4. **文件索引深度语义（INFO）**：目录深度 ≤4；文件可出现在 5 段相对路径；超过深度即 `truncated=true`。README 写「深度 ≤ 4」略含糊。
5. **@ 补全缓存按 query 而非 workspace（INFO）**：`filesCacheRef` 键只有 query；若活动工作区在面板打开期间变化，可能短暂显示旧根的文件（100 条后整体清空）。
6. **补全插入使用旧 token（INFO）**：`suggestTokenRef` 只在 input change 时更新；用户仅移动光标后选择建议，可能按旧位置替换。
7. **README 残留旧章节/过时说明（LOW 文档）**：§3.8 第 256 行已声明「UI 不再本地解析」，但 279-294 行仍保留「客户端规则解析/逐条 /create/取第一个匹配」的重复旧文案；§5.1 注释仍写「四个 lib 文件」而实际 6 个、`npm run check` 未纳入 parse/files；§7 仍有阶段三的 163 键/77 断言历史行（与 175 行并存，属历史记录）。
8. **`/files` 无 fileIndex 时先 501、后 workspace 校验（INFO 顺序）**：`fileIndex===null` 分支在 `resolveRequestRoot` 之前，故这种配置下未知 workspace 也返回 501 而非 WORKSPACE_UNKNOWN（真实 apply 不会走到）。
9. **`resolveRequestRoot` 用 `path.resolve` 字符串精确比较（INFO）**：Windows 大小写/短路径差异可能把合法候选判为未知（当前候选均一致，不影响）。
10. **部分类无独立 CSS 规则（INFO）**：`ttl-file-chip-compact`、`ttl-gantt-group`、`ttl-td-project`、`ttl-td-status`、`ttl-board-column-title`、`ttl-view-toggle`、`ttl-calendar-nav`、`ttl-title-cell` 由父类/语义承接；未发现布局缺口（外观未验证）。
11. **ChatPanel onBlur 定时器（INFO）**：`setTimeout(closeSuggest, 120)` 未在卸载时清理（组件卸载后 setState 会被 React 忽略；仅潜在噪音）。
12. **工作区跟随「最近活跃 live session」的体验（INFO）**：当前 active 是 `File_Manager_Legacy` 而非用户正在看的本仓库会话；面板不绑定 Session，若多窗口并存可能指向另一个工作区（README §3.8 已描述该规则，属设计取舍）。

### 14.8 未覆盖的验证盲区

1. 浏览器 UI 外观与真实交互：@ 补全下拉、文件 chip、quick-add 气泡/撤销、四视图视觉、明暗主题、控制台——全部未验证（无浏览器控制/截图，未用 mock 代替）。
2. 新 `client.js` 未加载到页面（页面未刷新）；Client Inspect 仍 10s 超时，无法取得四期 occupant。
3. `/todo` 命令实际执行未验证（无法从本会话调用 slash command）；只有静态契约核对。
4. 智能体工具 `quick_add` 未在真实 agent 调用中执行（已核验 Tool schema 含 `quick_add`/`files`/`text`，并在临时 store 上直接调用 `createTodoTool().execute({action:'quick_add'})` 通过）。
5. 无 fs 的真实 profile 行为未验证（当前 fs 存在）；仅用 fake/absent 注入模拟。
6. 大工作区索引性能/截断边界（2000 条、深度 4、20s 缓存）只在 fake fs 上验证；真实大仓库未压测。
7. 迁移只在临时目录验证（真实数据文件已是 v3，未在真机 v2 文件上演练）。
8. 既有 Lead 数据（1 条）在多视图下的文件 chip 展示未与真机交互验证（静态兼容性通过）。

### 14.9 本轮证据命令

```text
npm run check                                                     → 4 个文件（parse/files 未纳入，手工 6/6 通过）
npm test                                                          → 35/35 + 88/88 + 39/39
npm run audit                                                     → 26/26（175 键/语言、22 token、139 类名）
node %TEMP%\qa-phase4-host.mjs                                    → 111/111（含 KNOWN DEFECT 断言：显式空 project 重载被派生）
node %TEMP%\qa-phase4-client.mjs                                  → 88/88（@ token/补全/FileChip/ChatPanel/四视图回归/i18n）
python %TEMP%\qa-phase4-live.py                                   → 41/41（真机 v3，自建自清，保留 Lead 数据）
cmp 工作区 ↔ profile 安装副本（10 文件）                            → 全部一致
GET /health                                                       → version 3, count 1, workspaceRoot D:\code\File_Manager_Legacy
POST /workspaces                                                  → active=File_Manager_Legacy；候选含 D:\code\dsh-todo-time-log
```

**本轮结束状态**：真机 `version=3`、`count=1`（Lead 的 `修复看板`，未动）、`total=1` 回到基线；Host active；四期客户端代码已就绪，**刷新页面后**才可见，外观/真实交互与 `/todo` 命令执行仍待人工确认。

---

## 15. 四期收口复验（FAIL-1 修复 / 工作区选择 / 引号路径）

- 复核者：verifier（独立 QA）；复核时间：2026-11-03 10:46–11:05（Asia/Shanghai）
- 范围：四期收口项（store.js FAIL-1 修复、parse.js 引号路径、index.js 工作区参数/错误映射、client.js 工作区选择器/引号插入/blur 清理、check 脚本、README），实现文件只读
- Host：`version: 3`、plugin active；真机基线 `total = 0`（已无上一轮 Lead 残留数据）
- 页面状态：浏览器**未刷新**，新版 `client.js`（4497 行）未加载；客户端改动只做静态/shim 复核
- **active workspace 现场是动态的**：复核开始时 `/health` 的 `workspaceRoot = D:\code\dsh-todo-time-log`，随后漂移到 `D:\code\feiyu-archive`（「最近活跃 live session」变化所致）。本仓库始终在 `/workspaces` 候选中，`workspace=repo` 显式指定时 `/files` 正常；这正是本轮新增工作区选择器要解决的问题，非缺陷。

### 15.1 结论

- **可交付（有保留）**：四期收口四项（FAIL-1、工作区漂移、含空格引号路径、上一轮 LOW）**全部 PASS**；回归全部通过；**无 FAIL**。
- **PARTIAL / NOT VERIFIED（与上轮相同的验证条件限制）**：
  1. 浏览器 UI 外观与真实交互未验证（无浏览器控制/截图）；工作区选择器、引号插入、@ 下拉的实际手感未看到。
  2. **需刷新页面**才加载新版 `client.js`；Client Inspect 仍 10s 超时（本轮 1 次），未取得 occupant 证据。
  3. `/todo` 命令仍**未实际执行**（无斜杠命令调用面），只做静态契约核对。
- **残留 LOW/INFO（不阻塞）**：README 第 311 行仍写「四个 lib 文件」（实际 6 个）；README §7 混有阶段三/四历史行（163/175 键、35+88+39）；audit 实际为 **26** 项（Lead 备注「27 项？以实际为准」，实际 26）；mixed 非法 files 在 create/update 仍静默丢弃（上轮 INFO 未改）。

### 15.2 收口项 1：FAIL-1「显式空 project 重载被派生」— PASS（已修复）

独立复现（临时目录、真实 `lib/store.js`，不碰真机数据）：

| 场景 | 结果 |
| --- | --- |
| `create({title:'显式空分类', project:'', files:['lib/a.js']})` → `dispose()` → 新 store `load()` | **`project` 仍为 `''`**，且**无**「已按文件目录归类」notice（修复前为 `lib`） |
| 同上记录的数据文件 | `version: 3`，该条 `project: ''`、`files: ['lib/a.js']` 完整保留 |
| 显式非空 `project:'工作'` + files | 重载后仍 `工作` |
| 仅 files（无 project 字段） | 重载后仍派生 `lib`（预期行为） |
| v2 老记录缺 `project` 字段 + files | 仍派生（`src/x.ts` → `src`）并给 notice（向后兼容） |
| v3 记录 `project` 字段缺失（手改数据）+ files | 仍派生 `docs`（预期） |

代码核对：`normalizeTodo()` 现仅在 `project === '' && files.length > 0 && (raw.project === undefined || raw.project === null)` 时派生（store.js:245-258）；显式 `''` 不再被覆盖。Host 独立探针 **32/32** 通过（含上述全部断言）。

### 15.3 收口项 2：工作区漂移（/workspaces + workspace 白名单 + 客户端选择器）— PASS

- **Host**：`POST /workspaces` 返回 `active` + 候选 `{path,title,source}`；`/files`、`/quick-add` 的 `workspace` 只接受候选路径，未知 → **400 WORKSPACE_UNKNOWN**；`resolveRequestRoot` 在 Windows 下用 `toLowerCase` 大小写不敏感比较（探针：`/ROOT` 命中 `/root` → 200；repo 大写路径命中候选而非 400）。
- **`/files` 错误映射**：`fileIndex.list` 抛错（无 fs/坏后端）→ **501 FILES_UNAVAILABLE**（探针：failing fs → 501；`fileIndex:null` → 501）。
- **真机**：`/workspaces` 返回候选且 active=health root；`/files {"query":"lib/s","workspace":"D:\\code\\dsh-todo-time-log"}` → 200 且命中 `lib/store.js`；大写 repo 路径同样命中（大小写不敏感）；未知 workspace → 400。
- **Client 静态（shim）**：`ChatPanel` 渲染工作区 `<select>`（含 label、`aria-label`、当前值、选中项 title、每个候选一个 option、change → `onWorkspaceChange`；候选为空时不渲染）；`/files` 与 `/quick-add` 请求体在选中时带 `workspace`；补全缓存 key = `workspace + query`（`fileCacheKey`）；切换工作区清空建议并重新预热；`/workspaces` 在面板打开时加载，失败静默降级（不带 workspace，由 Host 默认）；默认选中 active，缺失回退候选首项。
- **动态 active 说明**：真机 active 从 repo 漂到 `feiyu-archive` 是「最近活跃 live session」规则导致（§14 已描述），repo 仍在候选内，显式 `workspace` 可正确指向本仓库——选择器即为此而加。

### 15.4 收口项 3：含空格/`#` 路径的引号引用 — PASS

- **Host parse.js**：新增 `@"..."` 引号形式，优先于普通 `@token`；`@"docs/My File.md"` → files=`['docs/My File.md']`、标题正确、可同时带 `#分类`；`@"docs/a#b.md"`（路径含 `#`）→ 文件；纯引号路径无标题 → `skipped NO_CONTENT`；未闭合引号不崩（回退普通解析）；不带引号的 `@lib/a.ts` 行为不变；`@生活` 仍是分类。
- **Client**：`formatFileReference(path)` 对含空白或 `#` 的路径输出 `@"..."`（否则 `@path`）；`selectFileSuggest` 已改用该函数插入。
- **真机**：`/quick-add` 输入 `新任务 写文档 @"docs/My File.md"；@"lib/store.js" 引用` → parsed=2/created=2，首条 `files=['docs/My File.md']`、project 派生 `docs`，第二条 `files=['lib/store.js']`。

### 15.5 收口项 4：上一轮 LOW 逐条复核 — PASS（1 条残留文档）

| 上轮 LOW | 结果 | 证据 |
| --- | --- | --- |
| `npm run check` 覆盖 parse.js/files.js | **已修** | check 脚本现为 6 个文件（time/parse/files/store/index/client），`npm run check` 通过 |
| `normalizeFilePath('C:')` 拒绝 | **已修** | `'C:'`/`'C:\\x'`/`'c:/x'` → `''`；create files `['C:']` → 400 FILES_INVALID（真机 + 探针） |
| `/files` fileIndex 抛错映射 501 | **已修** | 抛错/无 fs → 501 FILES_UNAVAILABLE（探针两条） |
| Windows 大小写不敏感比较 | **已修** | win32 `toLowerCase` 比较；`/ROOT`→`/root` 200、repo 大写真机 200 |
| README §3.8 残留旧客户端解析章节 | **已修** | 仅保留「Host 侧 parseQuickAdd」一段；`parseChatText` TODO 已改为 Host 侧 `parseQuickAdd()` |
| 残留文档小问题 | **仍在**（LOW） | README 第 311 行仍写「四个 lib 文件的 node --check」（实为 6 个）；§7 仍有阶段三/四历史行（163/175 键、35+88+39），与最新 38+89+39/177 并存 |

### 15.6 回归 — PASS

| 检查 | 结果 |
| --- | --- |
| `npm run check`（6 文件） | PASS |
| `npm test` | **38/38** parser + **89/89** smoke + **39/39** HTTP |
| `npm run audit` | **26/26** PASS（i18n **177** 键/语言、22 tokens、143 类名；Lead 备注的「27 项」以实际 26 为准） |
| 工作区 ↔ profile 安装副本 | 10 个文件（client/index/store/time/parse/files/package.json/locale×2/icon）`cmp` 字节一致 |
| 真机快速回归 | **22/22**：/health v3 + root；/workspaces；/files（默认 root=active、workspace=repo 命中 store.js、大写路径 200、未知 400）；/quick-add 未知 workspace 400；create files 派生/显式空/`C:` 400；update files 保持 project；list 回显 files；引号路径 quick-add；mixed files 200；**自建自清 final total=0、health count=0** |
| Client 沙箱（本轮新增 shim） | **38/38**：i18n 177 成对无死键、只 require react、无 document/DOM、无硬编码颜色；含空格/`#` 引号插入；工作区选择器渲染/回调/空列表；缓存 key 含 workspace；/files 与 /quick-add 带 workspace；切换清空+重预热；blur timer 卸载清理与 focus 清理；四视图关键回归（默认 table、queryForView、42 格日历、看板未分类最后、甘特 bar 非按钮） |

### 15.7 PARTIAL / NOT VERIFIED（与上轮一致）

1. **浏览器 UI 外观与真实交互未验证**（无浏览器控制/截图）：工作区选择器、引号插入后的输入框表现、@ 下拉、chips、quick-add 气泡未看到。
2. **需刷新页面**才加载新版 `client.js`；Client Inspect 本轮仍 10s 超时，未取得 occupant。
3. **`/todo` 命令未实际执行**：仅静态核对注册契约（commands.register definition/rawInput/CommandResult）与共用 `runQuickAdd`；无斜杠命令调用面。
4. **active workspace 是动态值**：真机 active 在复核期间由 repo 漂到 `feiyu-archive`（最近活跃 live session），非缺陷；显式 `workspace=repo` 已实测正确。

### 15.8 本轮证据命令

```text
npm run check                                             → 6 文件通过（含 parse/files）
npm test                                                  → 38/38 + 89/89 + 39/39
npm run audit                                             → 26/26（177 键/语言、22 tokens、143 类名）
node %TEMP%\qa-phase5-host.mjs                            → 32/32（FAIL-1 修复/C: 拒绝/引号解析/501 映射/大小写不敏感）
node %TEMP%\qa-phase5-client.mjs                          → 38/38（工作区选择器/引号插入/缓存 key/blur 清理/i18n 177/四视图回归）
python %TEMP%\qa-phase5-live.py                           → 22/22（真机 v3，自建自清，final total=0）
cmp 工作区 ↔ profile 安装副本（10 文件）                    → 全部一致
GET /health                                               → version 3, count 0；workspaceRoot 动态（复核期间 repo → feiyu-archive）
```

**本轮结束状态**：真机 `version=3`、`count=0`、`total=0`（无残留数据）；上一轮 FAIL-1 已修复并独立复现通过；工作区选择/白名单、引号路径、5 条 LOW 修复均复核通过；仍待人工刷新页面确认 UI 外观/交互与 `/todo` 命令实际效果。

---

## 16. 最终收口（Lead，四期结束）

§15 的两条残留文档 LOW 已修：README §5.1 的 `npm run check` 说明改为「六个 lib 文件」；§7 的阶段性记录已标注为「按阶段累积，最新以四期为准」，并把四期静态审计行更新为 `38 + 89 + 39` / `audit 26` / i18n 177 键 / 143 类名 / check 覆盖 6 文件。

最终交付状态（Lead 最后一轮自测）：

```text
npm run check  → 6 个 lib 文件（time/parse/files/store/index/client）通过
npm test       → 38/38（parse）+ 89/89（store/修复/分类/文件/迁移）+ 39/39（HTTP）
npm run audit  → 26/26（i18n 177 键/语言成对无死键、22 个 --dsw-alias-* token、143 个 ttl- 类名）
真机 /health   → version 3，count 0
真机 /list     → total 0，projects []
真机 /files    → 按 workspace 返回仓库文件（默认 active 动态跟随最近活跃会话，可在面板切换）
真机 quick-add → 「新任务 写周报 #工作 @lib/store.js；修复甘特图 @lib/client.js」显式分类优先、仅 @文件 派生 lib
数据文件       → { version: 3, updatedAt, todos: [] }，无测试残留、无 .tmp
profile 安装   → 符号链接指向工作区，10 个文件字节一致
```

四期交付能力：工作区文件引用（`files`，`@` 补全 + 自动派生项目 + 显式「未分类」可持久化 + 含空格路径引号形式）、对话 quick-add（面板 / `/todo` 命令 / 工具 `quick_add` 共用 Host 解析器）、工作区选择器（`/workspaces` + `workspace` 白名单）。

仍待人工确认（无浏览器控制能力）：刷新页面后的 @ 下拉、文件 chips、工作区选择器视觉与交互，以及 `/todo` 斜杠命令的实际执行回执。

---

## 17. 五期复核（项目分类点选 + `#` 补全）

- 复核者：verifier（独立 QA）；复核时间：2026-11-03 11:00–11:20（Asia/Shanghai）
- 范围：五期新增/改动（`POST /projects`、`buildProjectSuggestions()`、`TodoStore.projectSummary()`、`createFileIndex.listDirectories()`、client `ProjectPicker` + `#` 补全 + 建议刷新/降级），实现文件只读
- Host：`version: 3`、active；真机基线 `total = 0`
- 页面状态：浏览器**未刷新**，新版 `client.js`（4832 行）未加载；客户端本轮只做静态 + shim 复核
- **active workspace 仍是动态值**：本轮 `/health` 的 `workspaceRoot = D:\code\feiyu-archive`（最近活跃 live session）；本仓库在 `/workspaces` 候选中，带 `workspace` 参数时 `/projects` 正常指向 repo。

### 17.1 结论

- **可交付（有保留）**：五期 Host 接口、建议合并规则、`projectSummary`/`listDirectories`、`ProjectPicker` 与 `#` 补全的静态行为、i18n 187 成对无死键、四视图回归均 PASS；**本轮无 FAIL**。
- **PARTIAL / NOT VERIFIED（验证条件限制，与前几轮一致）**：
  1. 浏览器 UI 外观与真实交互未验证（无浏览器控制/截图）：`ProjectPicker` 下拉、optgroup、自定义切换、`#` 补全下拉的实际观感未看到。
  2. **需刷新页面**才加载新版 `client.js`；Client Inspect 仍 10s 超时（本轮 1 次），未取得 occupant。
  3. `/todo` 命令仍未实际执行（无斜杠命令调用面），只做静态契约核对。
- **LOW/INFO 观察 6 条**（见 §17.6，均不阻塞）。

### 17.2 Host 边界 — PASS（23/23 独立探针）

| 检查点 | 结果 | 证据 |
| --- | --- | --- |
| `buildProjectSuggestions` 合并顺序 | PASS | `used`（按 count 降序）→ `workspace` → `folder`；实测 `工作(5),生活(2),dsh-todo-time-log,docs,lib,WORK` |
| source 标注 | PASS | used/workspace/folder 分别标注；used 保留 count，workspace/folder count=0 |
| 大小写不敏感去重 + 合并次数 | PASS | `[{Work,2},{work,3}]` → 单条 `work`，count=5（第一次出现的大小写保留） |
| 名称过滤/归一化 | PASS | 空名/纯空白过滤；控制字符归一化（`工\u0000作` → `工 作`）；>40 字符过滤 |
| limit | PASS | 默认上限 80（100 条输入截到 80）；可传自定义 limit |
| `projectSummary()` | PASS | 计数正确（工作=2、生活=1、lib=1、未分类=1）；未分类最后；pending/completed 分项正确 |
| `listDirectories()` | PASS | 只返回顶层目录、跳过 `.git`/`node_modules`/`dist` 等与点目录、按名称排序；`limit` 生效；root 不可用时 reject（由 `/projects` 捕获降级） |
| `/projects` 正常路径 | PASS | 200；`workspace` 回显选中根；suggestions 同时含 used、全部 workspace 名与 folder；used 排在 workspace/folder 前 |
| `/projects` workspace 白名单 | PASS | 未知 → **400 WORKSPACE_UNKNOWN**；大小写不敏感匹配（`/ROOT`→`/root`）；不传 workspace 用 active |
| `/projects` 无 fs 降级 | PASS | fileIndex 抛错 / fileIndex=null → **仍 200**，suggestions 保留 used+workspace、仅缺 folder（不报 500） |

### 17.3 真机回归 — PASS（21/21）

- `/health` v3、基线 `total=0`；`/workspaces` 含 repo 候选。
- `POST /projects {workspace: 本仓库}` → 200 + workspace 回显；suggestions 形状 `{name, source, count}`；**含全部 4 个工作区名**（`dsh-todo-time-log`/`feiyu-archive`/`File_Manager_Legacy`/`default-workspace`）与 **4 个顶层文件夹**（`docs`/`lib`/`locale`/`test`）；无重复（大小写不敏感）、≤80。
- 用建议项创建：`create {project:'lib'}` → `/list` projects `lib=1`；再 `POST /projects` → used 首项为 `lib(count=1)`（排最前）；`update` 到 `docs` → `/list` projects `docs=1` 且 `lib` 消失；`delete` 成功。
- 错误用例：未知 workspace → 400 WORKSPACE_UNKNOWN；不传 workspace 的默认 active 200；大写 workspace 路径 200（大小写不敏感）。
- **自建自清**：最终 `total=0`、health `count=0`，无残留数据。

### 17.4 Client 静态复核 — PASS（49/49，无浏览器）

方法：Node 沙箱真实求值 `lib/client.js` 工厂（React stub），直接调用 `ProjectPicker` / `ChatPanel` / `findHashToken` / `formatProjectTag` / 建议规整与缓存函数，并核对源码接线。

| 检查点 | 结果 | 证据 |
| --- | --- | --- |
| i18n | PASS | **187 键/语言**（zh/en 键集合一致、占位符成对、独立扫描无死键/未声明键）；`projects.*` 与 `chat.projects*` 新键齐全 |
| 通用约束 | PASS | 仅 1 处 `require('react')`；无 `document.*`/DOM 查询；无硬编码颜色；四视图回归（VIEWS/默认 table/queryForView/42 格日历本地时区/看板未分类最后） |
| `ProjectPicker` 渲染 | PASS | 默认值 `''` 选中「未分类」；optgroup 顺序 **已用 → 工作区 → 文件夹**；已用项显示 `{name}（count）`；末项「自定义…」；禁用态传递 |
| 老数据回填 | PASS | 当前值不在建议中时插入临时 option 并保持选中；空建议时降级为「未分类 + 自定义…」两项 |
| 自定义切换 | PASS | 自定义模式显示文本框（placeholder/aria 正确）+「返回列表」按钮；`select` 选自定义触发 `onCustom`，返回触发 `onBackToList`，普通选择触发 `onChange` |
| 新建与四视图共用 | PASS | 创建表单使用 `ProjectPicker`；四视图行内编辑共用 `projectInput`（同一 `ProjectPicker` + `editingProjectCustom` 状态） |
| `#` token 检测 | PASS | `findHashToken` 基本 case、裸 `#`、空白后关闭、无标记返回 null；`findAtToken` 独立仍正常 |
| `#`/`@` 互斥 | PASS | 源码为「取 start 更大（更靠近光标）的 token」；两者分别驱动 project/file 补全 |
| 插入格式 | PASS | `#名称 `；含空白插入 `[名称] `（`formatProjectTag`）；文件仍为 `@path`/`@"path"`；`selectSuggestion` 按 kind 选择格式化函数 |
| `#` 补全行为 | PASS | 150ms 防抖、命中过滤、≤12 条；缓存 key = workspace + `project`（与文件缓存分离）；三态文案 `chat.projectsLoading/Error/Empty`；listbox aria=`chat.projectsAria`、option aria-selected、↑↓/Enter/Tab/Esc 与点击选择均正常 |
| 建议刷新时机 | PASS | 面板挂载、创建成功、行内编辑成功、删除成功、切换工作区、对话 quick-add 成功后均调用 `fetchProjectSuggestions`（`force` 清缓存）；失败静默降级为空建议（选择器仍有未分类/自定义） |
| 失败降级 | PASS | `/projects` 请求 catch → `setProjectSuggestions([])`；picker 空建议渲染不崩 |

### 17.5 回归 — PASS

| 检查 | 结果 |
| --- | --- |
| `npm run check`（6 文件） | PASS |
| `npm test` | **38/38** parser + **95/95** smoke + **41/41** HTTP |
| `npm run audit` | **26/26**（i18n **187** 键/语言、22 tokens、146 类名；「27 项」以实际 26 为准） |
| 工作区 ↔ profile 安装副本 | 10 个文件 `cmp` 字节一致（client/index/store/time/parse/files/package.json/locale×2/icon） |
| 真机（本轮） | **21/21**，最终 `total=0`、health `count=0` |
| Client 沙箱（本轮） | **49/49** |
| Host 探针（本轮） | **23/23** |

### 17.6 PARTIAL / NOT VERIFIED 与 LOW/INFO

**PARTIAL / NOT VERIFIED**
1. 浏览器 UI 外观与真实交互未验证（无浏览器控制/截图）：`ProjectPicker` 下拉视觉、optgroup 分组、自定义切换、`#` 补全下拉与插入后的输入框表现均未看到。
2. 需刷新页面才加载新版 `client.js`（4832 行）；Client Inspect 本轮仍 10s 超时，未取得 occupant。
3. `/todo` 命令未实际执行（无斜杠命令调用面），仅静态契约核对。
4. active workspace 为动态值（本轮 `feiyu-archive`）；repo 是候选，带 `workspace` 参数访问 `/projects` 已实测正确（非缺陷）。

**LOW / INFO（未改代码）**
1. `buildProjectSuggestions` 本身不负责过滤隐藏/忽略目录——它信任调用方传入的 folders；真实 `/projects` 路径经 `listDirectories()` 已过滤，但若未来直接调用该函数需注意（INFO）。
2. `projectSummary()` 会返回「未分类」`name:''` 条目（计数包含未分类）；`buildProjectSuggestions` 与客户端 `normalizeProjectSuggestions` 都会过滤空名，故 picker 不显示它（INFO）。
3. 分类去重大小写不敏感、count 会合并，但 `computeProjects`/统计按原始大小写分组；若同时存在 `Work`/`work`，picker 只显示一条合并计数而 stats/项目筛选仍分两条（边角 INFO）。
4. `PROJECT_CUSTOM = '__ttl_custom_project__'` 哨兵值理论上可与用户自定义分类同名冲突（极低概率 INFO）。
5. `formatProjectTag` 只对含空白的分类使用 `[名称]`，不转义 `[`/`]`/`#`；含这些字符的分类名经 `#` 补全插入后可能被 parser 误切（边角 INFO；自定义输入仍可用）。
6. README §7 已新增五期行（`/projects` 4 工作区 + docs/lib/locale/test、已用排前）与实测一致；但仍残留历史行（阶段三 i18n 163、阶段四 177）且未写本轮 187（属历史记录，LOW 文档）。

### 17.7 本轮证据命令

```text
npm run check                                              → 6 文件通过
npm test                                                   → 38/38 + 95/95 + 41/41
npm run audit                                              → 26/26（187 键/语言、22 tokens、146 类名）
node %TEMP%\qa-phase6-host.mjs                             → 23/23（合并/去重/超长/limit/projectSummary/listDirectories//projects 白名单与无 fs 降级）
node %TEMP%\qa-phase6-client.mjs                           → 49/49（ProjectPicker/# 补全/互斥/插入/刷新/降级/i18n 187/四视图回归）
python %TEMP%\qa-phase6-live.py                            → 21/21（真机 /projects → create lib → update docs → delete，自建自清 total=0）
cmp 工作区 ↔ profile 安装副本（10 文件）                     → 全部一致
```

**本轮结束状态**：真机 `version=3`、`count=0`、`total=0`（无残留）；`/projects` 合并/白名单/无 fs 降级与 `ProjectPicker`/`#` 补全静态逻辑均复核通过；仍待人工刷新页面确认 UI 外观/交互与 `/todo` 命令实际效果。

---

## 18. 五期收口（Lead）

§17 无需修复的 LOW/INFO 均按「边角且不阻塞」保留，文档数字已更新到当前状态：

- README §7 的四期静态审计行更新为最新数字（`38 + 95 + 41`、i18n **187** 键/语言、146 类名），并新增「五期分类点选」实测行。
- 保留的 INFO：`buildProjectSuggestions` 信任调用方传入的 folders（真实 `/projects` 路径已过滤）；`projectSummary` 含空名「未分类」条目（选择器会过滤）；分类去重大小写不敏感但统计按原始大小写分组；`PROJECT_CUSTOM` 哨兵值极低概率冲突；`formatProjectTag` 不转义 `[`/`]`/`#`（含这类字符的分类建议走自定义输入）。

五期交付能力：`POST /projects` 与三类建议来源（已用分类 / 工作区名 / 顶层文件夹）；`ProjectPicker`（新建表单 + 四视图行内编辑共用，支持「自定义…」回落文本框，老数据 off-list 分类回填）；对话 `#` 分类补全（与 `@` 互斥，含空格插入 `[名称]`）；建议刷新时机与失败降级。

Lead 最终回归：

```text
npm run check  → 6 个 lib 文件通过
npm test       → 38/38 + 95/95 + 41/41
npm run audit  → 26/26（i18n 187 键/语言成对无死键、22 token、146 类名）
真机 /projects → 200，4 个工作区名 + docs/lib/locale/test
真机 create    → project=建议项 生效；update 到另一建议项生效；未知 workspace 400
真机 /list     → total 0（测试数据已清理）
数据文件       → { version: 3, updatedAt, todos: [] }
profile 安装   → 符号链接指向工作区，10 文件字节一致
```

仍待人工确认（无浏览器控制）：刷新页面后的 `ProjectPicker` 外观/optgroup/自定义切换、`#` 补全下拉、以及 `/todo` 命令实际回执。

---

## 19. 用户实测问题修正：顶部新建框的 `#`（Lead + ui-dev）

**用户反馈**：截图显示分类选择器正常，但在顶部「输入待办内容，按 Enter 创建」输入框里输入 `#` 没有补全/分类效果，`#` 被当成标题文本（产生了标题「测试 #好像没用」）。

**结论**：不是需要重启 Harness，也不是安装问题——`#`/`@` 补全当时只做在「对话录入」面板；顶部框没有标记语义。

**修正（两层）**：
1. Host 兜底（`lib/index.js` + `lib/parse.js`）：`POST /create` 收到含标记的标题时用同一解析器拆分（`hasQuickAddMarkers()` 判定 `(^|\s)[#@]`、`[..]`、`项目：`、`分类：`、换行/`；`），标题里不再残留标记；优先级 = 标题显式标记 > 表单选择器 > （空）由 `files` 目录派生。`C#学习` 这类不跟空白的 `#` 不会被误判。**该层已重载生效，旧界面立即受益。**
2. Client 补全（`lib/client.js`）：顶部框复用对话面板的补全下拉（`#`→`/projects` 分类、`@`→`/files` 文件、互斥取近光标者、裸 token 也弹、↑↓/Enter/Tab/Esc、含空格分类插 `[名称]`、含空格文件插 `@"路径"`）；含标记提交走 `/quick-add`，结果进顶部提示条；无标记仍走 `/create`。**该层需刷新页面加载。**

**验证**：
- Lead 真机（用户数据 1 条，全程未改动）：`测试 #lib` → `{title:'测试', project:'lib'}`；`@lib/store.js 写文档` → `{title:'写文档', files:['lib/store.js'], project:'lib'}`；`写周报 @lib/parse.js #工作` → 显式 `工作` 优先且保留文件；`C#学习` → 原样保留。
- 测试：`npm test` = **46 + 95 + 47**（新增 `hasQuickAddMarkers` 与 `/create` 标记拆分用例）；ui-dev shim **290** 条（顶部框补全/提交分流/互不干扰）；`npm run audit` 26 项（i18n **191** 键/语言成对无死键、22 token、147 类名）。
- 仍未验证：刷新页面后顶部框下拉的实际观感（无浏览器控制能力）。

---

## 20. `/todo` 命令（主输入框）能力补强（Lead）

**用户反馈**：不是插件面板顶部框，而是**主输入框里用 `/todo` 命令**时输入 `#` 没有补全。

**平台事实（查 app.asar 内 `dsh-client-ui-commands/lib/client.js`）**：斜杠命令输入由 Harness 提供，`CommandInputDescriptor` 只有 `hint` 与 `attachments`；命令名之外没有第三方补全注入点，因此 `#`/`@` 在该输入框内不可能有插件补全。命令提交时 `execute(session, line + args, attachments)` 会把整行与附件交给 Host（`input.attachments !== true` 时附件会被拒绝并提示「不接受附件」）。

**因此改为「不依赖补全也好用」**：
1. `#分类`、`[分类]`、`项目：` 手打照常解析；多条用换行/`；`。
2. **文件直接写工作区相对路径**（无需 `@`）：`lib/store.js` → 识别为文件引用；只按工作区索引精确匹配，普通词不会被吞。含空格路径用 `@"docs/My File.md"`。
3. 命令声明 `input.attachments: true`：主输入框里 `@` 引用/附加的文件会被接收，`resolveCommandAttachmentFiles()` 按文件名在工作区索引里解析成相对路径并合并进 `files`（解析不到则忽略）。
4. `rawInput` 容错：若宿主把完整 `/todo ...` 行传进来，会先剥掉命令前缀。

**验证**：`npm test` = **49 + 99 + 47**（新增：裸路径识别、普通词不误判、附件名→路径解析、`runQuickAdd` 合并附件文件）；真机（新端口 62125）：`quick-add {text:'写周报 #lib lib/store.js'}` → `{title:写周报, project:lib, files:['lib/store.js']}`；用户数据前后 1 条未变。
**未验证**：`/todo` 在真实输入框中的回执文本（本会话无斜杠命令执行入口），需用户实测确认。

---

## 21. `@` 菜单「待办分类」来源（Lead + ui-dev）

**用户诉求**：在主输入框的 `/todo` 命令行里点选分类，而不是手打。

**平台事实（读 app.asar 源码确认）**：`dsh-client-ui-input-trigger` 的触发字符写死为 `/` 与 `@`（`~/`、`@` 两条检测分支），插件只能注册「来源」、不能新增触发字符；命令被 claim 后仅跳过 `/` 检测，`@` 仍会触发（`slash/input-insert-text` 也可用于命令态）。因此「打 `#` 弹菜单」在平台层面不可实现。

**落地方式**：在插件客户端 `apply()` 里向 `inputTriggers` 注册 `trigger: '@'` 的来源「待办分类」（`dsh-todo-time-log.projects`，order 50）：
- `candidates`：按 session cwd（拿不到则省略 workspace）请求 `POST /projects`，按 `@` 后文本过滤 ≤12 条，行内标注「已用 N 次 / 工作区 / 文件夹」；aborted/失败返回空。
- `onPick`：返回 `{ text }`（普通名 `#lib `，含空格 `[我的 分类] `），仅插入文本、不生成引用 chip。
- 注册：`ctx.inject(['inputTriggers'])` 优先，`ctx.get` 兜底，异常只 warn，不影响面板。

**验证**：`npm test` = 49 + 99 + 47；`npm run audit` 26 项（i18n **195** 键/语言成对无死键、22 token、147 类名）；ui-dev shim **311** 条（source 契约、候选过滤、onPick 文本、注册兜底与异常吞掉）；真机 `/projects` 正常。
**未验证（需人工）**：平台 `@` 菜单的真实渲染与交互、`/todo 写周报 @` → 选「待办分类 → lib」→ 变成 `/todo 写周报 #lib ` 的实际效果（本会话无浏览器控制与斜杠命令执行入口）。

### 21.1 独立复核（verifier，2026-11-03 11:37–11:55）

- 复核者：verifier（独立 QA）；范围：`lib/client.js` 的 `createTodoProjectSource()` / `registerTodoProjectSource()` / `apply()`、i18n 195、既有功能回归；实现文件只读
- 方式：Node 沙箱真实求值 `lib/client.js` 工厂（React stub）+ mock `inputTriggers.registerSource` / mock `fetch` / mock `ctx`；另外读取平台 `app.asar` 内 `dsh-client-ui-input-trigger/lib/client.js` 核对来源契约
- 真机：`http://127.0.0.1:62125/api/dsh-todo-time-log`（新端口），用户数据 1 条保持不动

**结论：可交付（有保留）——本轮无 FAIL。**

> **必须重申的平台事实**：
> 1. **平台 `@` 菜单的真实渲染与交互无法在本会话验证**（无浏览器控制/截图，且页面未刷新）；需要用户刷新页面后在主输入框输入 `/todo 写周报 @` 实测「待办分类 → lib → 变成 `#lib `」的完整体验。
> 2. **`#` 触发菜单是平台不具备的能力**：平台 `detectTrigger` 把触发字符写死为 `/` 与 `@`（`~/` 与 `@` 两条检测分支），插件只能注册来源、不能新增触发字符。因此本方案「借 `@` 菜单选分类、插入 `#分类`」是在平台约束下的正确做法，不是绕过需求的缺陷。

#### A. 静态与脚本 — PASS

| 检查 | 结果 |
| --- | --- |
| `npm run check`（6 个 lib 文件） | PASS |
| `npm test` | **49/49** parser + **99/99** smoke + **47/47** HTTP |
| `npm run audit` | 26/26 PASS（i18n **195** 键/语言、22 tokens、147 类名） |
| 工作区 ↔ profile 安装副本 | 10 个文件 `cmp` 字节一致（client/index/store/time/parse/files/package.json/locale×2/icon） |
| 通用约束 | 仅 1 处 `require('react')`；无 `document.*`/DOM 查询；无硬编码颜色；i18n 195 键成对、占位符一致、独立扫描无死键 |

#### B. 平台契约核对（读 app.asar，作为 source 形状的依据）— PASS

- `inputTriggers.registerSource(src)`：`(trigger, name)` 必须唯一，重复抛错，返回 disposer；来源按 `order` 升序参与菜单（`live.sources.filter(trigger).sort((a,b)=>(a.order??0)-(b.order??0))`）。
- `showGroupTitle` 仅特殊处理 `false`（省略标题）；默认/`true` 时，若候选项都带 `section` 则不显示组标题，否则显示 `t(source.name)`。
- `candidates(projection, { query, quoted, position, drilled, signal })`；平台传入的 `projection` 只有 `{ sessionId }`（**不含 cwd**）。
- 候选行渲染字段：`label ?? name`、`description`、`section`、`drill`；`onPick({ candidate, session, position, via, action, span })` 的返回值经 `execute()`：`{ claim }` → 进入命令；`{ text }` → `slash/input-insert-text` 插入文本。
- `execute()` **不识别 `insert` 字段**；插件只返回 `{ text }`，不会生成引用 chip —— 与实现一致。

#### C. source 契约（mock registerSource + mock fetch，独立 47/47 探针中的相关部分）— PASS

| 检查点 | 结果 | 证据 |
| --- | --- | --- |
| trigger/name/order/showGroupTitle | PASS | `trigger:'@'`、`name:'dsh-todo-time-log.projects'`（命名空间化）、`order:50`、`showGroupTitle:true`；`candidates`/`onPick` 均为函数 |
| candidates 取工作区 | PASS | `session.cwd` 存在 → 请求体带该 workspace；`session.cwd` 缺失但 `ctx.get('sessions').list.getSnapshot().byId[sessionId].cwd` 存在 → 用快照 cwd；都缺失 → **省略 workspace 仍正常请求并返回候选** |
| 请求与行字段 | PASS | 调用 `POST /projects`（带/不带 workspace）；行含 `name/label/description/section/value`；`value=name`；`section=command.groupTodoProjects` |
| description 文案 | PASS | used → `command.sourceUsed{count}`；workspace → `command.sourceWorkspace`；folder → `command.sourceFolder`（i18n 键均存在） |
| query 过滤 | PASS | 大小写不敏感子串过滤；无匹配返回 `[]` |
| 上限 | PASS | 20 条候选输入 → 只返回 **12** 条（≤12） |
| aborted | PASS | 请求前 `signal.aborted` → `[]` 且**不发起 fetch**；请求 resolve 后 signal 变 aborted → `[]`；未 aborted 的 signal 正常返回 |
| 失败降级 | PASS | fetch 抛错 / 非 2xx → 均返回 `[]`（不抛、不影响其它 `@` 来源） |
| onPick 文本 | PASS | `#lib `（普通名）；`[我的 分类] `（含空格）；`candidate` 为空/null → `{text:''}`；**返回值无 `insert`/`continue` 字段** |

#### D. 注册路径与 apply 安全性 — PASS

| 检查点 | 结果 | 证据 |
| --- | --- | --- |
| `ctx.inject(['inputTriggers'])` 优先 | PASS | 同时提供 inject/get 时走 inject，`registerSource` 恰好调用 1 次；apply 不抛 |
| `ctx.get` 兜底 | PASS | 删除 `ctx.inject` 后走 get 分支，仍注册成功 |
| `registerSource` 抛错被吞 | PASS | apply 不抛；console.warn 出现「input trigger source registration failed」 |
| `ctx.inject` 抛错被吞 | PASS | apply 不抛，`registerSource` 调用 0 次 |
| 重复注册（平台第二次抛 duplicate） | PASS | 连续 apply 两次 → 第二次异常被吞，apply 不抛 |
| apply 末尾调用 | PASS | 源码 `try { registerTodoProjectSource(ctx, createTodoProjectSource(ctx)); } catch {...warn...}`；即使注册失败面板逻辑不受影响（slots 注册先完成） |

#### E. 既有功能回归（shim，47/47）— PASS

- 四视图：`VIEWS` 四值、默认 table、`queryForView` 映射不变；`ProjectPicker`、`ChatPanel`、`formatProjectTag('我的 分类')='[我的 分类] '`、`formatFileReference('docs/My File.md')='@"docs/My File.md" '`、`findHashToken`/`findAtToken` 全部仍正常。
- i18n 195 键/语言成对、占位符一致、无死键；`command.sourceUsed/sourceWorkspace/sourceFolder/groupTodoProjects` 均存在。

#### F. 真机 — PASS

- `/health`：`version: 3`、`count: 1`（用户数据）；`workspaceRoot = D:\code\feiyu-archive`（动态，下面说明）。
- `/workspaces` → 候选含本仓库；`POST /projects {workspace: D:\code\dsh-todo-time-log}` → **200**，8 条建议：4 个工作区名（`dsh-todo-time-log`/`feiyu-archive`/`File_Manager_Legacy`/`default-workspace`）+ 4 个顶层文件夹（`docs`/`lib`/`locale`/`test`），sources 覆盖 `used/workspace/folder`。
- 未知 workspace → **400 WORKSPACE_UNKNOWN**。
- **用户数据未被触碰**：复核前后 `/list` 均为 total=1（唯一记录 `测试 # 好像没用`，project=`dsh-todo-time-log`）；本轮**未创建/删除任何待办**。

#### G. PARTIAL / NOT VERIFIED 与 INFO

**PARTIAL / NOT VERIFIED**
1. **平台 `@` 菜单的真实渲染与交互无法在本会话验证**（无浏览器控制/截图）：`/todo 写周报 @` 弹出「待办分类」分组、点击后插入 `#lib ` 的完整链路未实际看到；需用户刷新页面后手测。
2. **`#` 触发菜单是平台不具备的能力**（平台硬编码 `/`、`@` 触发字符）；需求只能通过 `@` 来源实现，属平台限制而非实现缺陷。
3. 新版 `client.js`（5131 行，CRLF）需**刷新页面**才加载；本会话 Client Inspect 仍不可用（此前轮次均 10s 超时），未取得 occupant。
4. `/todo` 命令本身未实际执行（无斜杠命令调用面），`/todo ... @` 的端到端回执需人工确认。

**INFO / LOW（不阻塞）**
1. 来源设置了 `showGroupTitle:true`，且所有候选行都带 `section`，因此 ready 后不显示组标题；但**加载中（pending、items 为空）**平台会渲染组标题 `t(source.name)`，而 `dsh-todo-time-log.projects` 不是 i18n 键，可能短暂显示原始 source id（纯视觉、本会话无法验证；若在意可把 `showGroupTitle` 设为 false）。
2. 平台传入的 session projection 只有 `{sessionId}`；插件靠客户端 sessions 快照 `byId[sessionId].cwd` 取工作区。`SessionSummary.cwd` 在类型中是可选的——若快照缺 cwd，会退化为「不带 workspace」→ Host 使用 active workspace（可能不是会话所在目录）。属于「无 cwd 仍可用」的预期降级，但与用户预期的工作区可能不一致。
3. candidates 没有插件内防抖（平台每次 query 变化会调用）；`/projects` 本身轻量（内存 + 目录列表），风险低。
4. `order:50` 只决定本来源在 `@` 菜单中的相对顺序；与其他插件来源的相对位置由各自 order 决定（当前无冲突证据）。
5. `client.js` 本轮改为 CRLF 行尾（5131 行），`node --check`/审计无影响；仅影响全文件 diff 观感。

---

## 22. 最终收口（Lead，本轮结束）

按 §21.1-G 的 INFO，把 `@` 来源的 `showGroupTitle` 从 `true` 改为 `false`：候选行已全部带 `section`，改成 false 后既不会重复渲染组标题，也避免「加载中」阶段把未翻译的 source id（`dsh-todo-time-log.projects`）显示出来。改后 `node --check`、`npm run audit`（26 项，i18n 195 键/语言成对）、`npm test`（49 + 99 + 47）全部通过，工作区↔profile 10 文件字节一致。

本轮交付的最终形态（分类点选的三条路径）：

| 场景 | 操作 | 依赖 |
| --- | --- | --- |
| 插件面板（新建/行内编辑） | 分类下拉：未分类 / 已用（带次数）/ 工作区 / 文件夹 / 自定义… | 面板内 `ProjectPicker`，无平台限制 |
| 插件面板对话录入 / 顶部新建框 | 输入 `#` 弹分类补全、`@` 弹文件补全 | 面板内自绘下拉 |
| **Harness 主输入框（含 `/todo` 行）** | 输入 `@` → 菜单出现「待办分类」分组 → 选中后插入 `#分类 ` | 平台 `inputTriggers` 自定义来源 |
| 平台限制（不可实现） | 在 `/todo` 行里输入 `#` 弹菜单 | 平台触发字符硬编码为 `/` 与 `@`，插件无法新增 |

仍待人工确认（无浏览器控制能力）：刷新页面后 `/todo 写周报 @` 的菜单渲染、选中后文本替换为 `#lib ` 的实际表现，以及 `/todo` 提交回执。

---

## 23. `@` 来源按 `/todo` 门控（Lead + ui-dev）

**用户反馈**：普通聊天输入 `@` 时也会出现「待办分类」分组，干扰平台自带的文件/会话引用；希望只在 `/todo` 命令行里出现（最好只显示我们的内容）。

**平台约束（asar 源码）**：`inputTriggers` 只把 `{sessionId}` 交给 source，不暴露「当前是否命令态/claim」，也没有 claim 相关回调；source 只能看到 query/position。因此按命令态做门控只有一条可行路径：**读取输入框当前草稿文本**。

**实现（lib/client.js 5163 行）**：
- `readComposerDraftText()`：全插件唯一的只读 DOM 访问点（`document.activeElement` → `isContentEditable`/`closest('[contenteditable="true"]')` → `textContent`），所有异常返回 `''`，无写入。
- `TODO_DRAFT_GATE = /^\s*\/todo(?:\s|$)/i`：`candidates` 一进来先读草稿，不匹配立即 `return []`（**不发 `/projects` 请求**）。
- `showGroupTitle:false` 保持；onPick/注册逻辑不变。

**审计规则同步**：`test/client-audit.mjs` 从「禁止任何 document 访问」改为「允许且仅允许一处 `document.activeElement` 只读访问、单读点、禁止 DOM 写入」，其余 DOM 访问仍禁止。

**验证**：`npm run check` 6 文件通过；`npm test` = 49 + 99 + 47；`npm run audit` 全通过（i18n 195 键/语言成对、22 token、147 类名、DOM 规则）；ui-dev shim **325** 条（`/todo …`/`/TODO …`/`/todo @` 通过并恰好 1 次请求；`@`、`写周报 @`、空串、`/todos`、`/todo2 …` 返回 [] 且 0 请求；document/activeElement/textContent 异常安全返回）。
**未验证（需人工）**：真实平台 `@` 菜单中的分组显隐与选中效果（无浏览器控制），需刷新页面后手测。**另需说明**：「只显示我们的分组」在平台层面不可行——菜单是所有已注册来源的并集，插件只能追加或隐藏自己的分组，无法移除平台的文件/会话来源。

---

## 24. 九期复核：DSH 0.2.2-rc.1 兼容性（0.5.2）

**复核时间**：2026-11-05 08:45–09:15（Asia/Shanghai）。**角色**：Lead + 3 名独立 verifier（Host 契约 / Client 契约 / 真机运行时），三份独立报告互不依赖；Lead 负责元数据修复、文档整合与最终回归。

**问题**：DSH 升级到 0.2.2-rc.1 后，插件 0.5.1 被 profile 启动 preflight 判定 incompatible 并禁用（`plugin_manager` 中 `error.code = incompatible-version`、`rows` 为空），日志为：

```text
Plugin dsh-todo-time-log@0.5.1 is incompatible with dsh 0.2.2-rc.1:
requirements {"engines.dsh":">=0.2.0-rc.2 <0.2.2-0"}
```

**根因（读 DSH 0.2.2-rc.1 源码 `dsh-app-boot/lib/index.js:1094-1144`）**：兼容性判定是 `semver.satisfies(runtimeVersion, range, { includePrerelease: true })`。预发布语义下 `0.2.2-rc.1 > 0.2.2-0`，所以旧上界 `<0.2.2-0` 把 `0.2.2-rc.1` 排除在外；旧范围对 `0.2.1-rc.5` 及更早为 true、对 0.2.2 全系列为 false。

**修复（仅元数据，未改代码）**：

| 文件 | 变更 |
| --- | --- |
| `package.json` | `version` 0.5.1 → **0.5.2**；`engines.dsh` 与 `peerDependencies["@deepseek-ai/dsh"]` 改为 **`>=0.2.0-rc.2 <0.2.3-0`**（纳入 0.2.2 预发布/正式版，仍排除 0.2.3 预发布） |
| `package-lock.json` | 根版本同步 0.5.2（含 `engines.dsh` / peer 声明） |
| `README.md` | 顶部兼容性行、§4 安装门禁说明、§7 九期记录、§8 tag 示例 |

真实 semver 7.8.6 判定矩阵（`includePrerelease: true`）：旧范围 `0.2.2-rc.1=false`；新范围 `0.2.1-rc.5 / 0.2.2-alpha.3 / 0.2.2-rc.1 / 0.2.2 = true`，`0.2.3-0 / 0.2.3-rc.1 / 0.3.0 = false`；当前 manifest `unmetRequirements = {}`。

### 24.1 Host 契约审计 — 0 BREAK / 1 RISK(低) / 8 PASS

- 9 个集成点逐一用「运行中 0.2.2-rc.1 的 `cordis_inspect` host/Service **实时契约** + `.tools/dsh-0.2.2` 解包源码」双向核对：`ctx.inject/effect/logger`、`webServer.register`（仍是 Node `(req,res)` 的 prefix 路由，匹配 `path===prefix || startsWith(prefix+'/')`）、`tools.register`（ToolDefinition 旧字段未改名/未收紧，新增回调均可选）、`commands.register`（`rawInput`/`attachments`/`{kind:'success'|'error', text}` 兼容）、`sessions.list()/eventAt/header.{cwd,origin,createdAt}`、`workspaceRegistry.list()`、`fs.resolve/listDir`。
- 0.2.2 点名的三项破坏性变更（`tools.resolve/executable` 与提示词组装接口、Session Projection 异步注册、Cordis Timer 返回值）本插件 grep 零命中，均未使用。
- **执行级探针**：用真实 DSH 的 `assertSupportedJsonSchema` / `validateJsonSchemaValue` / `snapshotJsonValue` 跑插件真实 Host 代码，**47/47** 通过（10 个 action 返回值全部 lossless JSON 且过 output schema、`render` 返回合法 text block；HTTP handler 200/404/405/400 均被真实路由接受）。
- **唯一 RISK（低，非阻断）**：0.2.2 源码已把 `Session.eventAt()` 等同步 Session 读标 `@deprecated`（仍完整可用；插件有 `header.createdAt` 兜底，最坏只退化「最近活跃会话」排序）。后续可在 DSH 正式移除同步读时再整改。

### 24.2 Client 契约审计 — 6/6 PASS / 0 RISK / 0 BREAK

- `__ModuleLoader__.load({id, factory(require)})`、`{inject, apply}` 模块对象、`require('react')` seed 在 0.2.2 不变（`dsh-client-modules`；`react` 仍在 frontend static seed 表）。
- `main`（keyed，注册参数仅 `key`）与 `sidebar.panellist`（list，`id/order/label`）在 0.2.2 SlotMap（117 槽）中存在；与官方 `schedule` / `plugin-manager` 的注册逐字同构。
- `inputTriggers.registerSource` / `candidates(session,{query,signal})` / `onPick({candidate})→{text}` / `order` / `showGroupTitle` / `section`：0.2.1-rc.5 → 0.2.2 逐行 diff 仅新增 6 语言 i18n 字典 + 1 行 CSS，契约零变化。
- 客户端 `sessions.list.getSnapshot().byId[id].cwd` 仍被 0.2.2 官方 `ui-reference` 同型使用；插件 29 个主题 token 在 0.2.2 theme CSS 中 **29/29** 有定义。
- Lead 补充实时核对（client inspect）：`main` / `sidebar.panellist` 槽 available 且参数结构与插件注册一致；当前页面 occupants 暂无本插件（因运行中的 desktop 尚需重装/重启，属预期）。
- 构建产物：`npm run build` 前后 SHA256 均为 `C9829229…FDDE64`（232659 B）→ 字节级可复现且与 `src/client` 同步；`npm run audit` 28/28、`test/ui/panel.test.mjs` 4/4、`tsc` / `node --check` 通过。

### 24.3 真实 0.2.2-rc.1 端到端（隔离 DSH_HOME）— 27/27 PASS

- 环境：dsh CLI 0.2.2-rc.1；隔离 `DSH_HOME=.tools/verify/home`（真实 desktop profile 未重启、未改动）；`dsh plugin --profile verify add link:D:/code/dsh-todo-time-log` **exit 0**（0.5.2 被接受）。
- 启动无门禁拒绝（stderr 无 `incompatible` / `disabling profile plugin`）；插件 5 条 logger.info 实测：`routes mounted at /api/dsh-todo-time-log`、`tool registered: todo_time_log`、`command registered: /todo`、`data file`、`workspace root`；宿主内注册表探测 `tools.knownNames` 含 `todo_time_log`、commands 含 `todo`。
- **HTTP E2E 25/25**：health 200、中文 create（project/priority/type/files）、list+projects、complete、重复 complete 409 `ALREADY_COMPLETED`、uncomplete、update、delete、未知 id 404、坏 JSON 400；数据文件 JSON 合法、中文原样、`createdAt` 为 ISO-8601 UTC（本地时间由 409 消息 `完成时间 2026-11-05 09:00:34` 对 `01:00:34Z` 实测证明）。
- **整机重启后持久化 6/6**：重启后 list 仍含数据，中文与时间字段保持。
- **Client 注入**：`GET /` 的 `__DSH_BOOT__` 含插件条目（`{"id":"dsh-todo-time-log","url":"plugins/??dsh-todo-time-log/client.js&rev=..."}`），该 client 产物 GET 200（232735 B）且含 `__ModuleLoader__`。
- **反证**：复制同一插件、仅回退 3 个版本字段（version / engines.dsh / peer）：`dsh plugin add` 被 install preflight 拒绝（exit 1，`nothing was installed`）；在隔离 profile 手工 junction 该副本后启动，stderr 出现 `skipping profile bundle "dsh-todo-time-log": ... incompatible with dsh 0.2.2-rc.1`，插件路由全 404（与未知路由基线一致）、index 不含插件条目。→ **新范围放行 / 旧范围拒绝的因果成立**。

### 24.4 最终回归与结论

- `npm run verify`（0.5.2）：check / eslint / tsc / build / **331 tests** / audit **28/28** 全通过；`lib/client.js` 与 `src/client` 同步。
- **结论：0.5.2 与 DSH 0.2.2-rc.1 兼容，可在 desktop profile 重装启用；代码无需为 0.2.2 改动。**
- 未验证：浏览器像素级 UI 与真实模型回合调用 `todo_time_log`（隔离 profile 无模型凭据；工具注册由宿主内注册表探测证明，业务路径由 HTTP E2E 全量覆盖）。
- 遗留（非本仓库）：同 profile 的 `dsh-ops@0.4.4` 也声明旧上界 `<0.2.2-0`，会被 0.2.2-rc.1 同样禁用，需其作者发布兼容版本；`Session.eventAt` 的 deprecated 去留见 §24.1 RISK。
- 本轮三份独立验证原始报告（仅本地、被 `.gitignore` 的 `.tools/` 忽略）：`.tools/audit/host-0.2.2.md`、`.tools/audit/client-0.2.2.md`、`.tools/verify/0.2.2-report.md`；原始日志在 `.tools/verify/logs/`。

### 24.5 真实 desktop profile 重装与 live 复验（Lead，09:15–09:25）

按 README §4 的流程在运行中的 desktop profile 上执行「卸载后重新安装兼容版本」：

1. `plugin_manager action=remove_bundle target=dsh-todo-time-log` → `application: applied`；
2. `plugin_manager action=install_bundle target=link:D:/code/dsh-todo-time-log` → `application: applied`、`bundle: dsh-todo-time-log`、`version: 0.5.2`、`warnings: []`，HMR 直接热加载（**无需重启 DSH、无需刷新页面**）；pnpm 对 link 依赖的 peer 提示（`The linked in dependency will not resolve the peer dependencies`）属正常提示——DSH 在包清单存在 `engines.dsh` 时以它单独判定、忽略 peer，不影响加载。
3. **Host live**：运行中会话收到动态工具 schema 更新，`todo_time_log` 可实际调用；`action=list` 返回用户既有 12 条待办（中文标题、分类、优先级、本地时间格式均正常，数据文件 `C:\Users\LeoMa\.dsh\todo-time-log\todos.json` 为原有数据，未被改动）。
4. **HTTP live**：`GET http://127.0.0.1:51204/api/dsh-todo-time-log/health` → `ok: true`、`loaded: true`、`count: 12`；`POST /list` → 12 条 + `stats`/`projects`/`timeFormat` 正常。
5. **Client live**（client inspect 实时）：`main` 槽新增 occupant `key=dsh-todo-time-log, active=true`；`sidebar.panellist` 槽新增 `id=dsh-todo-time-log, order=30, active=true` → Client 半亦热加载成功。
6. **plugin_manager** 不再对本插件报 `incompatible-version`；同一 profile 中仍报该错的是**另一个仓库**的 `dsh-ops@0.4.4`（同样声明旧上界，需其作者发布新版本）。

**至此用户报告的 incompatible 问题已在当前 DSH 0.2.2-rc.1 上闭环消除，插件恢复可用。** 发布到 npm（0.5.2）需另行打 tag 推送，由仓库 Actions 的 OIDC 流程完成。

---

## 25. 十期：插件市场收录准备 —— 宿主认证加固（0.6.0）

**背景**：准备把插件提交到社区插件市场（[开放插件市场 dshopen.org](https://dshopen.org)，索引格式 1）。其[贡献指南](https://github.com/polang233/dsh-plugin-index/blob/main/.github/CONTRIBUTING.md)把「**通过 `webServer` 注册的本机接口没有接入宿主认证**」列为最常见退回原因：

> 插件通过 `webServer` 注册的接口，请用 `connection.requestRejection(req)` 做准入；拿不到 `connection` 或抛错时直接拒绝，不要退回到只检查 Host、Origin 或回环地址。

本插件此前正好命中这一条：`/api/dsh-todo-time-log/*` 可读写待办文件、枚举工作区目录与 live 会话，但未做宿主认证。**已在提交前修复**：

| 项 | 内容 |
| --- | --- |
| 实现 | `createHttpHandler(store, { authorize })`：handler 在解析路由**之前**调用 `authorize(req)`；返回 `401/403` 即拒绝并回统一 JSON 错误（`UNAUTHORIZED` / `FORBIDDEN`），返回 falsy 才继续 |
| 生产接线 | `apply()` 里 `authorize` 读取 `ctx.get('connection')`；服务缺失或抛错一律按 `403` 拒绝（不退化为只查 Host/Origin） |
| 封装 | 直接构造 handler 的单元测试不传 `authorize`，行为不变；生产路径必然传入 |

**验证**：

| 证据 | 结果 |
| --- | --- |
| `node --test test/http.test.mjs`（新增 11 条） | **77/77**：无 cookie 的 `GET /health`、`POST /list`、`POST /create` → **401 `UNAUTHORIZED`**；不可信来源 → **403 `FORBIDDEN`**；`authorize` 抛错 → **403**；放行时 → 200；**被拒请求未写入任何数据** |
| 真实 DSH 0.2.2-rc.1（隔离 `DSH_HOME`，端口 51962） | **8/8**：无 cookie 请求 401；`GET /?token=` 换到登录 cookie（303）；带 cookie 的 `GET /health` 200、`POST /create` 200（中文原样）、`POST /list` 命中、`POST /delete` 200；带 cookie 但伪造 `Origin: https://evil.example` → **403** |
| `npm run verify`（0.6.0） | check / eslint / tsc / build / **342 tests** / audit 28/28 全通过 |

**兼容性影响**：HTTP 契约由「匿名可用」变为「须经宿主认证」。浏览器内的面板请求同源自动携带 cookie，无需改动；脚本直接调接口需先 `GET /?token=<启动 URL 里的 token>` 取 cookie。属安全加固，故版本升 **0.6.0**。

---

## 26. 十四期：主输入框旁的「待办」快速入口（0.7.0）

**背景**：面板是「看全量、做整理」的地方，但真实使用里最高频的动作不是整理，而是「这件事刚做完，顺手勾掉」。为了这个动作切走主视图、找到那一行、勾掉、再切回来，成本远高于动作本身。十四期新增一个**快捷镜像**（设计基线 [`docs/design/quick-entry.md`](./design/quick-entry.md)）：主输入框下方常驻一枚「待办」胶囊，点开就是进行中清单，勾一下即完成（带撤销），也能在清单里直接记一条。

- trigger → `conversation.composer.dock`（`order: 40`，与宿主上下文占用胶囊同一行）；
- overlay → `conversation.input.overlay`（`position: absolute; bottom: calc(100% + 8px)`，与宿主 `@` 菜单同一套锚定做法，不会被 docked composer 裁切）；
- 数据只走既有 Host 接口：`/list`、`/complete`、`/uncomplete`、`/quick-add`、`/delete`，**不新增后端**；
- 编辑 / 删除 / 改分类优先级类型 / 导入导出都留在面板，「打开完整面板」一跳。

### 26.1 验证口径

本节是**独立复核**，不是实现方自测：门禁（`npm run verify`）+ 自己写的断言脚本（不复用 `test/` 下的用例）+ 真实浏览器的几何探针 + 真实渲染出图。

| 层 | 工具 | 产物 |
| --- | --- | --- |
| 门禁 | `npm run verify`（check / lint / typecheck / build / test / audit） | 见 26.2 |
| 独立断言 | `.tools/verify/quick-independent.mjs`（jsdom 里真实挂载 `lib/client.js` 的两个槽位组件，`fetch` 全量 mock） | **53 条** |
| 视觉 + 几何 | `.tools/quick-preview/render-quick.mjs`（真实组件 + 宿主真实 InputBar / ContextMeter CSS + 主题 token）+ `.tools/quick-preview/probe.mjs`（Chrome 里读 `getComputedStyle` / `getBoundingClientRect`） | 3 张图 + 硬数字 |

### 26.2 结果

| 项 | 证据 | 结论 |
| --- | --- | --- |
| 构建与门禁 | `npm run verify` exit 0：`node --check` 7 个 lib 文件、eslint、tsc 通过；build **320,793 B / 8,663 行**；`npm test` **469 passed / 0 failed**；audit **33 项全 PASS**（i18n **310** 键/语言成对无死键、**28** 个 alias token、**278** 个 `ttl-` 类名、新增 `registers conversation.composer.dock slot` / `registers conversation.input.overlay slot` / `quick entry trigger styled` / `quick entry panel styled` / `quick entry reuses host routes`） | PASS |
| 槽位注册（静态） | 产物里两处 `ctx.slots.register({ name: "conversation.composer.dock" / "conversation.input.overlay", id: PANEL_ID, order: 40 }, QuickTrigger / QuickOverlay)` 都在，且各自包在 `ctx.slots.inject(...)` 里（旧宿主没有该槽时不抛错，只 `console.warn`） | PASS |
| CSS 口径（静态） | `QUICK_CSS_TEXT` 内 **0** 处 hex / `rgb()`/`hsl()` / 具名色；**30** 个 CSS 变量全部是 `--dsw-*`（27 个主题 token）或本地 `--ttl-*`（3 个时长/缓动变量）；27 个 `--dsw-*` 在宿主 `dsh-client-ui-theme` 里**全部有定义**（没有静默回落到空值）；35 个类名全部 `ttl-quick-` 前缀，与面板 `CSS_TEXT` **零交叉** | PASS |
| 行为（独立 34 条） | 胶囊计数与 `aria-label`（`3 条进行中，展开待办清单` / 空态 `展开待办清单`）、展开 `role="dialog"` + `aria-modal="false"`、清单按创建时间升序、行内 `role="checkbox"` + `aria-label="完成待办：<标题>"`、勾掉发 `/complete` 且行**即时移除** + 计数同步 + 提示 `已完成 · 用时 3 小时` 带撤销、撤销发 `/uncomplete` 且行回到原位置、`/quick-add` **文本原样透传**（body 只有 `text` 一个字段）且成功后刷新列表 + 撤销逐个 `/delete`、空态、`/list` 500 时 `role="alert"` 错误态 + 原因 + 重试恢复、Esc 关闭并把焦点还给胶囊、`打开完整面板` → `layout.selectPanel('dsh-todo-time-log')` 并关闭卡片、提交中 input `disabled` + 按钮「添加中…」且连按不重复发请求、跳过时**保留草稿**、卸载清掉 6s 提示定时器 | PASS |
| 两套样式共存 | 同一 `document` 里同时挂载面板 `main` 槽与快速入口：`style[data-dsh-todo-time-log="styles"]` 与 `="quick-styles"` 同时存在；面板样式表里没有任何 `ttl-quick` 规则；胶囊计算值仍是 `display:inline-flex` / `border-radius:999px` / `height:24px` / `font-size:13px` | PASS |
| 视觉（3 张图） | `docs/images/quick-entry.png` / `quick-entry-dark.png` / `quick-entry-narrow.png`。与输入框关系、留白、圆角阴影、与上下文占用胶囊的关系、暗色对比度逐项看图确认 | PASS（渲染） |

浏览器实测几何（`probe.mjs`，视口 = 场景尺寸）：

| 指标 | 916×640 浅色 | 916×640 暗色 | 640×680 窄屏 |
| --- | --- | --- | --- |
| 清单卡片 → composer 卡片上沿间距 | **8px** | 8px | **8px** |
| 清单卡片左边缘 / composer 卡片左边缘 | 16 / 16（同列对齐） | 同 | 16 / 16 |
| 清单卡片宽 / 圆角 | 420 / 16px | 420 / 16 | **420**（视口 640，右侧留白 16px 不越界） |
| 胶囊与上下文占用胶囊间距（同一 dock 行） | **12px** | 12px | 12px |
| 清单列表是否滚动（3 行） | `scrollHeight 156 == clientHeight 156`，不滚动 | 同 | 同 |
| 卡片底色 / 磨砂 | `rgba(252,253,254,0.7)` + `blur(40px) saturate(1.5)` | `rgba(48,49,54,0.64)` + 同款磨砂 | 同浅色 |

### 26.3 发现的问题

| 编号 | 严重度 | 现象 | 定位 | 状态 |
| --- | --- | --- | --- | --- |
| F1 | 中（视觉） | 清单卡片底下的聊天文字**清晰透出**，底栏（打开完整面板 / 勾选即完成）被背景文字「压住」 | `--dsw-specific-menu` 实为 `--dsw-menu-surface-fill` = `#fcfdfeb3` / `#303136a3`（带 alpha 的菜单材质）；宿主自己的菜单（如 ContextMeter 面板）都会再叠一层 `backdrop-filter: var(--dsw-menu-backdrop-filter)`（`blur(40px) saturate(150%)`），`.ttl-quick-panel` 原先只用了底色没配磨砂 | **已修**（Lead 在 `.ttl-quick-panel` 补 `backdrop-filter`）。复核：探针读到 `backdropFilter: blur(40px) saturate(1.5)`；诊断图（故意让消息文字压在卡片背后）确认背景变为模糊而非可读 |
| F2 | 无（验证工具） | 第一次出图时 composer 卡片右侧贴到画面边缘、没有 16px 留白 | 无头 Chrome 的 `--window-size=W,H` ≠ 排版视口：实测 `innerWidth = W-16`、`innerHeight = H-95`。外壳按 916 排版但视口只有 900，卡片右边缘被视口切掉 | **已修**（出图脚本开 `W+16 / H+95` 的窗口再裁掉多余边）；修后左右各 16px 对称 |
| O1 | 提示 | 第三行元信息与底栏分隔线之间 **10px**（列表 `padding-bottom: 4` + 底栏 `padding-top: 6`），三行时观感偏紧 | 设计取值，非缺陷 | 记录，未改 |
| O2 | 提示 | 视口很矮（<~444px）时卡片按 `max-height: min(60vh, 460px)` 收缩、列表内部滚动（545px 视口实测列表出现 7px 滚动） | 预期行为（`max-height` + `overflow-y: auto`） | 记录，未改 |

### 26.4 盲区与 NOT VERIFIED

- **真机槽位混排**：dock 里还有宿主自己的 occupant（上下文占用胶囊等）与面板的 `sidebar.panellist`，真实顺序/换行/窄屏折行只见外壳模拟，未在真机确认。
- **真实点击与焦点**：jsdom 能覆盖 `click` / `submit` / `keydown` 与 `document.activeElement`，但真机浏览器里的焦点环、输入法、Esc 冒泡顺序未验证。
- **与 `@` 菜单的层级**：卡片 `z-index: 120`，宿主菜单面板是 `1100`。推断 `@` 菜单会盖住卡片（合理），但两者同时打开时的观感未验证。
- **60s 轮询 / 30s 本地时钟**：多窗口或面板里改完后能否跟上，只有单进程 mock 覆盖。
- **`prefers-reduced-motion`**：只做了静态核对（`animation/transition: none !important` 覆盖 `.ttl-quick-trigger` / `.ttl-quick-panel` 及其后代），未在真机开系统「减少动态效果」确认。
- **英文界面**：`quick.*` 文案 zh/en 成对由 audit 保证，但英文下窄屏折行未截图。
- **构建产物加载时机**：与既往各期一致，**页面需刷新（必要时 Ctrl+Shift+R）才会加载新的 `lib/client.js`**。

### 26.5 复现方式

```bash
npm run verify                                   # 门禁：check / lint / typecheck / build / 469 用例 / audit 33 项
node .tools/verify/quick-independent.mjs         # 独立断言 53 条（静态 19 + 行为 34）
node .tools/quick-preview/render-quick.mjs       # 出 3 张图到 docs/images/（诊断图用 diagnostic-behind-text）
node .tools/quick-preview/probe.mjs quick-entry 916 640       # 量几何（也可 dark / narrow）
```

> `.tools/` 已被 `.gitignore` 忽略、不随仓库提交；预览外壳用宿主真实的 `GRgSLq_*`（InputBar）与 `A6Bq1a_*`（ContextMeter）类名搭建，卡片与胶囊本身来自仓库真实构建产物；图上方的会话气泡是**假对话**（只为说明卡片浮在消息之上），不是宿主组件。

### 26.6 结论

**PASS（逻辑 / 静态 / 渲染）**：两个槽位注册、四条状态（关闭 / 打开 / 勾掉+撤销 / 新建）与错误态、键盘与焦点归还、两套样式互不污染、明暗与 640 窄屏的几何关系均有独立证据；发现并修复的半透明材质缺陷（F1）已复核。

**真机需刷新页面后人工确认**：槽位与宿主其它 occupant 的混排、真实点击/焦点手感、英文界面折行、以及 `@` 菜单与卡片同时打开时的层级观感。

---

## 27. 十五期：快速入口的开关（0.7.0）

**背景**：十四期把「待办」胶囊常驻在主输入框下方，但没有任何开关——不想要它的人只能忍。十五期给它加了一个宿主原生的偏好入口：**设置 → 通用**里的一行（`settings.general.item`，id `dsh-todo-time-log`，`order: 40`，在宿主自己的 `developer-tools`(15) 与 `current-version`(100) 之间）。默认开；关掉立刻卸载两个快速入口槽位（胶囊 + 清单，60s 轮询也随之停止），重新打开恢复。

- **偏好存在 Host 侧**（浏览器与会话无关）：`<数据文件同目录>/todos.settings.json`，信封 `{ version: 1, updatedAt, settings: { quickEntry } }`。与 `todos.json` 分开的理由：`todos.json` 的 `version` 是严格契约（旧版本会归档重建），UI 偏好不该逼着它升版本；且偏好由浏览器写、待办由 UI 与 agent 工具写，分开后一次偏好写入不可能动到待办数据。
- **路由**：`POST /settings`（读，缺失即默认 `true`）、`POST /settings/update`（写，只收已知键、类型必须是布尔）。错误码映射：`SETTINGS_INVALID`→400、`SETTINGS_WRITE_FAILED`→500、`SETTINGS_UNAVAILABLE`→501（宿主没给 settings store 的旧环境）。
- **客户端语义**：读失败 **fail-open**（按默认开挂载，原因显示在设置行内）；写失败 **不乐观翻转**（开关保持原状态 + 行内提示），避免出现「开关显示关了但胶囊还在」的两套状态。

### 27.1 验证口径

本节是**独立复核**，不复用 `test/` 下的用例：门禁 + 自己写的 Host/HTTP 断言 + 自己写的 jsdom 客户端断言（槽位是「会真的挂载组件」的假宿主）+ 真实浏览器几何探针。

| 层 | 工具 | 产物 |
| --- | --- | --- |
| 门禁 | `npm run verify`（check / lint / typecheck / build / test / audit） | 见 27.2 |
| Host + HTTP | `.tools/verify/settings-host.mjs`（真实文件 I/O + 真实 `http.createServer(createHttpHandler(...))`） | **27 条** |
| Client | `.tools/verify/settings-client.mjs`（jsdom 求值 `lib/client.js`，`slots.register` 会用 React 真挂载、disposer 会真卸载） | **10 条** |
| 视觉 + 几何 | `.tools/quick-preview/render-settings.mjs` + `.tools/quick-preview/probe-settings.mjs` | 2 张图 + 硬数字 |

### 27.2 结果

| 项 | 证据 | 结论 |
| --- | --- | --- |
| 构建与门禁 | `npm run verify` exit 0：`node --check` **8** 个 lib 文件、eslint、tsc 通过；build **328,239 B / 8,898 行**；`npm test` **497 passed / 0 failed**；audit **36 项全 PASS**（i18n **314** 键/语言、**28** 个 alias token、**285** 个 `ttl-` 类名；新增 `registers settings.general.item slot` / `preference switch styled` / `preference uses host settings routes`） | PASS |
| 偏好文件位置 | `resolveSettingsFile('…/todos.json')` → `…/todos.settings.json`（同目录同主名，无扩展名与多段扩展名都不误吃） | PASS |
| 默认与容错 | 文件缺失 → `{quickEntry:true}` 且**不创建文件**；损坏 JSON → 回落默认 + 一次 warn + 下次写入覆盖；非法类型（`'off'`/`0`/`null`）不写盘且返回 `SETTINGS_INVALID`；空补丁是无害 no-op | PASS |
| 写入与原子性 | 落盘为带 `version`/`updatedAt` 的信封；写完目录里没有任何 `.tmp-*` 残留；新实例能从磁盘读回；写入失败（目标被目录占用）返回 `SETTINGS_WRITE_FAILED` 且 `describe().lastPersistError` 有内容 | PASS |
| 并发（**修复后**） | 30 个冷缓存 store × 3 个同时发起的 `update(false/true/false)`，每轮磁盘与缓存都必须是「最后发起」的值 | PASS（见 27.3 F1） |
| 真实 HTTP | `POST /settings` 默认 true 且不建文件；`/settings/update {quickEntry:false}` → 200 + 落盘 + 读回一致；非法类型 → 400 且磁盘字节不变；未知键被忽略；`GET /settings` → 405 `METHOD_NOT_ALLOWED`；无 settingsStore → 两条路由都 501；`/health` 仍 200、未知路由仍 404；偏好写入不动 `todos.json` | PASS |
| 客户端行为（jsdom） | 挂载后行渲染出标题/说明/`role="switch"`（`aria-checked`/`data-checked`/`aria-label` 齐全、默认 `true`）；点开关发 `/settings/update {quickEntry:false}` → **dock 与 overlay 两个槽位都归零、胶囊从 DOM 消失**；再点恢复并重新 `/list`；关掉后 60s 轮询的 Timeout 回落到基线、重开再起；偏好为关时首屏不挂、从设置里打开才出现；读失败 fail-open + 行内 `role="alert"`；写失败不翻转 + 行内提示；写入中 `disabled` + `aria-busy`，连点不重复发请求 | PASS |
| 样式隔离 | `pref-styles` 与 `quick-styles` 两张样式表同时存在且互不含对方的类名；`.ttl-pref-row` 计算值 `display:flex` + 16px 上下内边距 | PASS |
| 静态 | 产物里有 `settings.general.item`（id/order 正确）与两条 settings 路由；`.ttl-pref-*` 内 **0** 处 hex/rgb/具名色，CSS 变量全是 `--dsw-*`/`--ttl-*`；`lib/index.js` 三处错误码映射齐全；`package.json` 的 check / files / test 都登记了新文件 | PASS |

### 27.3 发现的问题

| 编号 | 严重度 | 现象 | 定位 | 状态 |
| --- | --- | --- | --- | --- |
| F1 | 中（并发） | `npm run verify` **间歇失败**：`createSettingsStore：并发写入串行化…` 期望最终 `false` 实得 `true`（我连跑 5 次命中 1 次） | `lib/settings.js` 的 `update()` 在 `await read()` **之后**才 `chain = chain.then(write)`，入队顺序取决于 I/O 完成顺序而非调用顺序；`cache = next` 同样在 await 之后，可能被更早的调用覆盖回去。两个浏览器标签页同时拨开关即可触发 | **已修**（Lead 改成「整个 read-modify-write 事务在调用点同步入队」，写失败在事务内转成 `SETTINGS_WRITE_FAILED`）。复核：独立脚本 30 轮冷缓存并发全绿；仓库新增的 30 轮确定性用例连跑 6 次通过 |
| O1 | 提示（视觉） | 设置行的说明文字比宿主相邻行**更淡**：我们的 `rgb(129,133,140)`（`--dsw-alias-label-tertiary`）vs 宿主 General 行的 `rgb(97,102,107)`（`--dsw-alias-label-secondary`） | `PREF_CSS_TEXT` 的 `.ttl-pref-desc` 取色比宿主行低一档 | **已修**（Lead 复核后把 `.ttl-pref-desc` 改成 `--dsw-alias-label-secondary`，与宿主 `DeveloperToolsRow` 一致；两张图已按新样式重出） |
| O2 | 提示（视觉） | 标题行高 **22px**，宿主 General 行的标题是 **20px**（`DeveloperToolsRow.module.css`）；CSS 注释写的是「对齐宿主 14/22」 | `.ttl-pref-title { line-height: 22px }` | **已修**（`.ttl-pref-title` 改 `line-height: 20px`，CSS 注释同步为「14/20」） |
| O3 | 提示（视觉） | 文本与开关之间的留白 **56px**（行 `gap: 8px` + `.ttl-pref-text { padding-right: 48px }`），宿主同形行是 `gap: 24px`；文字列因此比宿主窄 32px | `PREF_CSS_TEXT` 的 `.ttl-pref-text` | **已修**（去掉 `padding-right: 48px`，行 `gap` 改 24px，与宿主 `DeveloperToolsRow` 同节奏；文字列恢复与宿主同宽） |
| O4 | 提示（预览） | 预览里导航图标、相邻宿主行（外观的分段控件、显示代码工作视图的开关）、遮罩下的背景都是**按宿主规格画的占位**，不是宿主组件；面板高度按内容自适应（宿主是固定 800×800） | 出图脚本的取舍 | 记录（已在 `docs/images/README.md` 说明） |

浏览器实测几何（`.tools/quick-preview/probe-settings.mjs`，视口 980×560）：面板 **800**、左侧导航列 **188**、内容列 **612**（`padding: 0 24px 24px`，可用 **564**）；我们的开关 **36×20**，右边缘 **866**，与宿主同形行（显示代码工作视图）的开关**完全对齐**；行 `padding: 16px 0` + `border-bottom: 0.5px` + `gap: 24px`，标题 14/20、说明 12/18 且取 `label-secondary`（O1–O3 修复后与宿主 `DeveloperToolsRow` 同一套参数）；截图 1960×1120（DSF 2），无裁切。

### 27.4 盲区与 NOT VERIFIED

- **设置页本身由宿主渲染**：本机只能验证我们那一行的组件与开关语义，验证不了宿主如何把这行放进 `settings.general.item` 列表、导航高亮、面板开合与焦点管理。
- **真机 GUI 点击**：没有浏览器控制能力，全部交互都在 jsdom 里用真实组件 + mock fetch 驱动；真机的开关手感、`focus-visible` 焦点环、触屏与键盘（Space/Enter）操作未验证。
- **真实宿主 Switch 组件**：客户端产物只允许 `require('react')`，拿不到宿主 primitives 的 Switch，所以我们的开关是自绘的；「36×20 与宿主同规格」来自宿主 CSS 的排版参数与预览肉眼对照，没有拿到 primitives 的源码级取值。
- **多标签页即时同步**：偏好存在 Host 侧，另一个标签页要刷新才会看到；没有做跨标签页实时广播（设计上也不做）。
- **`todos.settings.json` 的手工损坏恢复**：损坏会回落默认并在下次写入覆盖，但没有做「把损坏文件归档」——偏好的值可由 UI 重新设置，故未归档。
- **构建产物加载时机**：与既往各期一致，**Host 半需重启插件、Client 半需刷新页面**才会生效。

### 27.5 复现方式

```bash
npm run verify                                    # 门禁：497 用例 / audit 36 项
node .tools/verify/settings-host.mjs              # Host 偏好层 + 真实 HTTP 27 条
node .tools/verify/settings-client.mjs            # 设置行 jsdom 行为 10 条
node .tools/quick-preview/render-settings.mjs     # 出 2 张图到 docs/images/
node .tools/quick-preview/probe-settings.mjs settings-quick-entry 980 560   # 量几何
```

> 出图前需要宿主设置页 CSS：`.tools/refs-settings/`（用 `node .tools/asar.cjs "<DSH>/resources/app.asar" extract "dsh/node_modules/@deepseek-ai/dsh-client-ui-settings-general" .tools/refs-settings` 抽出，`.tools/` 不随仓库提交）。

### 27.6 结论

**PASS（逻辑 / 契约 / 渲染）**：偏好文件的默认值、容错、原子写、并发与两条 HTTP 路由的错误码全部有独立证据；客户端「开/关 → 卸载/恢复」是**真实挂载与卸载**验证的（不是只数注册次数），fail-open 与「写失败不翻转」也都覆盖。发现并修复的并发竞态（F1）已复核；3 条视觉差异（O1–O3）已按宿主 `DeveloperToolsRow` 口径修掉，两张预览图按新样式重出。

**真机需重启插件 + 刷新页面后人工确认**：设置页里这一行的位置与观感、开关手感与焦点环、以及关掉后主输入框下方确实不再出现「待办」胶囊。

---

## 28. 十六期：开关搬回面板的「设置」卡（0.7.0）

**背景**：十五期把快速入口的开关放进了宿主「设置 → 通用」（`settings.general.item`），用户反馈它不在自己该在的地方——这是**本插件**的偏好，却要去系统设置里找。十六期把入口搬回插件自己的界面：**待办面板页头右侧「设置」按钮 → 页头下方展开的设置卡 → 卡里的「主输入框下方的待办快捷入口」开关**。

**只搬入口，不动地基**：Host 偏好层（`lib/settings.js`、`todos.settings.json` 信封、`POST /settings`、`POST /settings/update`、fail-open、写失败不翻转、并发 last-write-wins）**一行没改**；改的是「这个开关画在哪」。

| 层 | 十五期 | 十六期 |
| --- | --- | --- |
| 开关位置 | 宿主设置页（`settings.general.item`，order 40） | 待办面板页头「设置」→ `.ttl-settings` 卡 |
| 客户端注册 | `main` / `sidebar.panellist` / `conversation.composer.dock` / `conversation.input.overlay` / `settings.general.item` | 只有 `main` / `sidebar.panellist` + 偏好开关时的两个快速入口槽位（`settings.general.item` 已删，产物里搜不到该字符串） |
| 样式 | 独立 `PREF_CSS_TEXT`（`pref-styles`） | 并入面板 `CSS_TEXT`，卡片形态与「对话录入」卡一致（0.5px 边框 + `radius-md` + `bg-layer-1`），reduced-motion 由 `.ttl-root *` 兜底 |
| `prefs.js` | 控制器 + 设置行组件 `Row` | 只剩控制器 + 单例 `set/getQuickEntryPreference`（面板通过单例订阅快照，不再层层透传） |
| Host 偏好层 | — | **未变**（同一批路由、同一份文件、同一套并发与容错语义） |

### 28.1 验证口径

独立复核，不复用 `test/` 下的用例：门禁 + Host/HTTP 断言 + 面板 jsdom 断言（假槽位会**真的挂载组件**）+ 真实浏览器几何探针。

| 层 | 工具 | 产物 |
| --- | --- | --- |
| 门禁 | `npm run verify` | 见 28.2 |
| Host + HTTP + 静态 | `.tools/verify/settings-host.mjs` | **28 条** |
| Client（面板） | `.tools/verify/settings-client.mjs` | **11 条** |
| 视觉 + 几何 | `.tools/quick-preview/render-panel-settings.mjs` + `probe-settings.mjs` | 2 张图 + 硬数字 |

### 28.2 结果

| 项 | 证据 | 结论 |
| --- | --- | --- |
| 构建与门禁 | `npm run verify` exit 0：check **8** 个 lib 文件、eslint、tsc 通过；build **331,480 B / 8,947 行**；`npm test` **497 passed / 0 failed**；audit **37 项全 PASS**（i18n **317** 键/语言、**28** 个 alias token、**291** 个 `ttl-` 类名；新增 `panel settings entry wired` / `settings card styled`，`registers settings.general.item slot` 已移除） | PASS |
| 宿主槽位已删 | 产物里**搜不到** `settings.general.item`；`apply(ctx)` 只注册 `main` 与 `sidebar.panellist`，并在默认开时把两个快速入口槽位挂上 | PASS |
| 页头入口 | `.ttl-settings-trigger` 是真 `button`，`aria-controls="ttl-settings-panel"`、`aria-expanded` 随开关翻转；展开时按钮呈「按下」底色（`.ttl-ghost-button[aria-expanded='true']`） | PASS |
| 设置卡 | 点开渲染 `<section class="ttl-settings" id="ttl-settings-panel">`：标题「设置」+ 右侧提示「保存在本机，换浏览器也一样」+ 一行（行标题 / 行说明 / `role="switch"`）；默认收起 | PASS |
| 开关语义 | 点开关发 `/settings/update {quickEntry:false}` → dock 与 overlay **两个槽位都归零、胶囊从 DOM 消失**（卡片保持在展开态）；再点写回 `true` 并恢复，恢复后重新拉 `/list` | PASS |
| 轮询 | 关掉后 60s 轮询的 Timeout 数**回落到基线**；重新打开再起 | PASS |
| 首屏为关 | 偏好为关时首屏不挂胶囊；从设置卡打开后立即出现 | PASS |
| 读失败 | fail-open（按开挂载、开关显示开）+ 卡内 `role="alert"`「读取设置失败，暂按默认（开）处理：<原因>」 | PASS |
| 写失败 | 开关**不翻转**、胶囊保留 + 卡内 `role="alert"`「保存失败，已保持原状态：<原因>」 | PASS |
| 防连点 | 写入中开关 `disabled` + `aria-busy="true"`，连点两次只发**一个**请求 | PASS |
| Esc | 在卡片上按 Esc：卡片卸载、`aria-expanded` 回落 `false`；再点仍能打开 | PASS |
| Host 偏好层（未变） | `todos.settings.json` 默认值/损坏兜底/非法补丁不写盘/空补丁 no-op/原子写无临时文件/写入失败码/**30 轮冷缓存并发 last-write-wins**；真实 HTTP：默认 true、写 false 落盘读回、非法类型 400、未知键忽略、GET 405、无 store 501、不遮蔽 `/health`、偏好写入不动 `todos.json` | PASS |
| 样式口径 | 设置卡样式在面板 `CSS_TEXT` 内：**0** 处 hex/rgb/具名色，12 个 CSS 变量全是 `--dsw-*`/`--ttl-*`；卡片 0.5px 边框 + `radius-md` + `bg-layer-1`；开关 36×20；`.ttl-root *` 的 `prefers-reduced-motion` 兜底 | PASS |

浏览器实测几何（`probe-settings.mjs`，视口 996×700，内容区 940）：

| 指标 | 实测 |
| --- | --- |
| 设置卡与「新建卡」「数据卡」的水平位置 | 三者 **left 57.9 / right 933.1 / width 875.3**，完全同宽对齐 |
| 设置卡与页头的间距 | **16px**（页头 bottom 100 → 卡片 top 116） |
| 设置卡 | 高 94.8，圆角 **12px**，0.5px 边框，`bg-layer-1` 底 |
| 开关 | **36×20**（左侧 884.1 → 右缘 920.1）；右缘距卡片内右沿 **13px**（12 内边距 + 1 边框）；开态圆点左移 18px |
| 行排版 | `gap: 24px`；行标题 13px/500/行高 20；行说明 12px/18 secondary；卡片提示 12px tertiary |
| 裁切 | 卡片完全落在 `#root` 内（`cardInsideRoot: true`） |

### 28.3 发现的问题

| 编号 | 严重度 | 现象 | 定位 | 状态 |
| --- | --- | --- | --- | --- |
| — | — | 本轮**没有发现缺陷**：11 条面板行为断言、28 条 Host/HTTP/静态断言、2 张图逐项对照均通过 | — | — |
| O1 | 提示（预览） | 截图是「面板单独渲染」，**看不到主输入框下方的「待办」胶囊**（那是宿主 composer 的槽位，不在面板里）；卡片左侧与右侧内缩差 ~5px 是面板滚动容器的 scrollbar gutter（所有卡片一致，真机同样存在） | 预览取舍 | 记录（`docs/images/README.md` 已注明壳的边界） |
| O2 | 提示（文案） | 卡片右上提示对普通用户偏技术化（原「偏好保存在 Host，所有浏览器共享」） | `settings.hint` | **已修**（Lead 改成「保存在本机，换浏览器也一样」，「Host」这类实现词不露出给用户） |

> 十五期的 3 条视觉观察（O1 说明色偏淡 / O2 标题行高 / O3 文本与开关留白）在十六期**随样式并入面板自然收敛**：说明改回 `label-secondary`、行 `gap` 改为 24px、标题回到面板的 13/20 口径。

### 28.4 盲区与 NOT VERIFIED

- **真机 GUI**：没有浏览器控制能力，交互全部在 jsdom 里用真实组件 + mock fetch 驱动；真机的展开动画、`focus-visible` 焦点环、触屏/键盘（Space/Enter 切开关）未验证。
- **宿主 composer 与面板同屏**：`dock` 里的胶囊与面板不是同一个视图，本机无法在同一张真机截图里同时验证「面板里关掉 → 回到聊天，胶囊消失」。
- **多标签页即时同步**：偏好存 Host 侧，另一个标签页要刷新才看到（设计上不做实时广播）。
- **设置卡与其它浮层的层级**：面板内还有「数据」对话框等浮层，未见同屏冲突，但未做组合验证。
- **构建产物加载时机**：Host 半需重启插件、Client 半需刷新页面。

### 28.5 复现方式

```bash
npm run verify                                          # 门禁：497 用例 / audit 37 项
node .tools/verify/settings-host.mjs                    # Host 偏好层 + HTTP + 静态 28 条
node .tools/verify/settings-client.mjs                  # 面板页头设置卡 jsdom 11 条
node .tools/quick-preview/render-panel-settings.mjs     # 重出 docs/images/settings-quick-entry*.png
node .tools/quick-preview/probe-settings.mjs settings-quick-entry 996 700   # 量几何
```

### 28.6 结论

**PASS（逻辑 / 契约 / 渲染）**：入口从宿主设置页搬回面板后，开关的读、写、fail-open、写失败不翻转、防连点、Esc 收起、首屏未挂与恢复都仍是**真实挂载/卸载**验证过的；Host 偏好层一行未动且重跑一遍仍全绿；设置卡与面板其它卡片同宽、同圆角、同边框，36×20 开关右对齐。本轮无新增缺陷。

**真机需重启插件 + 刷新页面后人工确认**：面板页头「设置」按钮的位置与展开动画、开关手感与焦点环、以及关掉后回到聊天界面时主输入框下方的「待办」胶囊确实不再出现。