<p align="center">
  <a href="https://www.npmjs.com/package/dsh-todo-time-log">
    <img src="https://github.com/FantasyStarry/dsh-todo-time-log/raw/main/docs/images/banner.png" alt="待办时间日志 · dsh-todo-time-log" width="100%">
  </a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-todo-time-log"><img alt="npm version" src="https://img.shields.io/npm/v/dsh-todo-time-log?color=4f46e5&label=npm"></a>
  <a href="https://www.npmjs.com/package/dsh-todo-time-log"><img alt="npm downloads" src="https://img.shields.io/npm/dm/dsh-todo-time-log?color=4f46e5"></a>
  <a href="https://github.com/FantasyStarry/dsh-todo-time-log/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/FantasyStarry/dsh-todo-time-log/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/FantasyStarry/dsh-todo-time-log/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <img alt="DSH" src="https://img.shields.io/badge/DSH-0.2.x-4f46e5.svg">
  <img alt="node" src="https://img.shields.io/badge/node-%E2%89%A5%2020-3c873a.svg">
</p>

<h1 align="center">待办时间日志 · dsh-todo-time-log</h1>

<p align="center">
  <b>待办清单，也是一本时间账本。</b><br>
  一个 <a href="https://github.com/deepseek-ai">DeepSeek Harness</a>（dsh）插件：管理待办的同时，<b>自动记下每条待办的创建时间与完成时间</b>，<br>
  用表格 / 看板 / 甘特图 / 日历四种视角，一眼看清「这件事做了多久」。
</p>

## 为什么是它

大多数待办工具回答「还有什么没做」。这个插件还想回答另一个问题：**「这件事花了多久？」**

- 🕒 **时间是一等公民** —— 创建时刻、完成时刻、两者之间的真实耗时全部自动记录；甘特图里一根条，就是一条待办从创建到完成的完整生命周期。
- ⚡ **随手就能记** —— 面板表单、一句话对话、`/todo` 命令、让智能体直接调用工具、输入框下方胶囊，五个入口共用同一套解析规则，结果完全一致。
- 🔒 **数据在你自己的机器上** —— 本地 JSON 文件，不联网、不上传；原子写入 + 跨进程写入保护，文件损坏会自动备份并重建。

---

## 界面速览

四种视图共用同一张数据卡片，切换视图不会丢掉当前的筛选与排序。

<p align="center">
  <img src="https://github.com/FantasyStarry/dsh-todo-time-log/raw/main/docs/images/hero.png" alt="表格视图：创建时间与完成时间一目了然" width="100%">
  <br>
  <sub><b>表格视图</b>：「创建时间 / 完成时间」两列是主角，完成时间未产生时显示 <code>-</code></sub>
</p>

<p align="center">
  <img src="https://github.com/FantasyStarry/dsh-todo-time-log/raw/main/docs/images/board.png" alt="看板视图" width="49%">
  <img src="https://github.com/FantasyStarry/dsh-todo-time-log/raw/main/docs/images/board-swimlanes.png" alt="状态 × 分类泳道" width="49%">
  <br>
  <sub><b>看板</b>：按状态分列，卡片带优先级、类型与用时</sub>
  &nbsp;&nbsp;&nbsp;
  <sub><b>泳道</b>：状态 × 分类分组，泳道可折叠、可在内新建</sub>
</p>

<p align="center">
  <img src="https://github.com/FantasyStarry/dsh-todo-time-log/raw/main/docs/images/gantt.png" alt="甘特图视图" width="100%">
  <br>
  <sub><b>甘特图</b>：自适应时间轴 + 右侧「用时」列，一根条 = 创建 → 完成 / 现在；分类分组可折叠并聚合，范围支持今天 / 近 7 天 / 近 30 天 / 全部</sub>
</p>

<p align="center">
  <img src="https://github.com/FantasyStarry/dsh-todo-time-log/raw/main/docs/images/calendar.png" alt="日历视图" width="49%">
  <img src="https://github.com/FantasyStarry/dsh-todo-time-log/raw/main/docs/images/dark.png" alt="暗色主题" width="49%">
  <br>
  <sub><b>日历</b>：按创建或完成时间落格，点某天处理当天全部条目</sub>
  &nbsp;&nbsp;&nbsp;
  <sub><b>暗色主题</b>：颜色全部走宿主主题 token，随系统明暗自动切换</sub>
</p>

<p align="center">
  <img src="https://github.com/FantasyStarry/dsh-todo-time-log/raw/main/docs/images/quick-entry.png" alt="快速入口：主输入框下方的「待办」胶囊与展开的清单卡片" width="100%">
  <br>
  <sub><b>快速入口</b>：聊天时不用离开主界面 —— 输入框下方常驻「待办」胶囊（数字是未完成条数），点开就是进行中清单；勾一下即完成，一行输入记一条</sub>
</p>

<p align="center">
  <img src="https://github.com/FantasyStarry/dsh-todo-time-log/raw/main/docs/images/quick-entry-dark.png" alt="快速入口（暗色主题）" width="58%">
  <img src="https://github.com/FantasyStarry/dsh-todo-time-log/raw/main/docs/images/quick-entry-narrow.png" alt="快速入口（窄屏）" width="38%">
  <br>
  <sub><b>暗色主题</b>：胶囊与清单的颜色全部走宿主主题 token</sub>
  &nbsp;&nbsp;&nbsp;
  <sub><b>窄屏</b>：清单贴住输入框上沿弹出，不被裁切</sub>
</p>

<p align="center">
  <img src="https://github.com/FantasyStarry/dsh-todo-time-log/raw/main/docs/images/settings-quick-entry.png" alt="待办面板页头「设置」里的快速入口开关（开）" width="49%">
  <img src="https://github.com/FantasyStarry/dsh-todo-time-log/raw/main/docs/images/settings-quick-entry-off.png" alt="把同一个开关关掉后的状态" width="49%">
  <br>
  <sub><b>开关（默认开）</b>：不想在输入框下方看到这枚胶囊，就在<strong>待办面板页头 → 设置</strong>里关掉</sub>
  &nbsp;&nbsp;&nbsp;
  <sub><b>关掉</b>：胶囊与清单一起消失，面板与 <code>/todo</code> 命令不受影响</sub>
</p>

> 快速入口、对话录入与完成反馈的交互过程见下方「操作示范」（静态示意图）。配图由仓库里的真实 `client.js` + 宿主真实主题 token 静态渲染，不是真机截图；生成方式见 [`docs/images/README.md`](https://github.com/FantasyStarry/dsh-todo-time-log/blob/main/docs/images/README.md)。

---

## 操作示范

### ① 新建一条待办

<p align="center"><img src="https://github.com/FantasyStarry/dsh-todo-time-log/raw/main/docs/images/demo-create.png" alt="新建待办操作示范" width="100%"></p>

1. 在顶部输入框写标题，顺手可以打 `#工作` 指定分类、`@lib/store.js` 引用工作区文件。
2. 分类、优先级（高 / 中 / 低）、类型（缺陷 / 新功能 / 改进 …）都能直接点选。
3. 按 Enter 或点「添加」。带标记时由 Host 统一解析，**标题里不会残留 `#分类` / `@文件`**。

### ② 完成 → 自动记录 → 可撤销

<p align="center"><img src="https://github.com/FantasyStarry/dsh-todo-time-log/raw/main/docs/images/demo-complete.png" alt="完成与撤销操作示范" width="100%"></p>

1. 点行首的勾选圈（看板里是卡片上的勾选框），完成时刻自动写入。
2. 底部浮出 toast，「撤销」可以一键退回未完成状态。
3. 表格的「完成时间」列立即出现时间；页面高度不变，视线不被打断。

### ③ 一句话记多条

<p align="center"><img src="https://github.com/FantasyStarry/dsh-todo-time-log/raw/main/docs/images/demo-quickadd.png" alt="对话式快速录入操作示范" width="100%"></p>

1. 点新建框右侧的「批量」进入批量录入，先确认工作区 —— `@` 文件补全按工作区隔离。
2. 一句话可以写多条，支持 `#分类`、`@文件`、`!优先级`、`^类型`。
3. 发送后逐条回执；不满意可以整批撤销。

### ④ 看板上的日常操作

<p align="center"><img src="https://github.com/FantasyStarry/dsh-todo-time-log/raw/main/docs/images/demo-board.png" alt="看板操作示范" width="100%"></p>

1. 顶部四个分段切换视图：表格 / 看板 / 甘特图 / 日历。
2. 看板支持分组（状态 / 分类 / 状态×分类泳道）、密度、搜索与筛选。
3. 卡片「⋯」里可以移到分类、改优先级 / 类型、编辑、删除。
4. 已完成列默认只显示最近 10 条，可展开查看全部。

### ⑤ 聊天里随手勾掉待办

1. 主输入框下方常驻一枚「待办」胶囊，右侧数字就是未完成条数；点一下，进行中清单在输入框**上方**弹出（只列未完成，按创建时间升序，带已进行时长）。
2. 点行首勾选圈即完成：这一行立刻消失，卡片底部提示「已完成 · 用时 X」并带「撤销」；点撤销就回到未完成。
3. 清单里也能直接记一条：一行文字按 Enter 即可，`#分类 !优先级 ^类型` 同样可用；刚记的那条也能「撤销」（等于删掉）。
4. 这里只做「看进行中 / 勾掉 / 记一条」；编辑、删除、改分类 / 优先级 / 类型仍在面板 —— 点清单底部「打开完整面板」一跳即到。

> 胶囊跟着会话输入框走：新会话首屏（还没有会话）或切到本插件面板时它不出现 —— 那是宿主槽位边界，不是插件没装上（见 [`docs/limitations.md`](https://github.com/FantasyStarry/dsh-todo-time-log/blob/main/docs/limitations.md)）。

---

## 特性一览

| 能力 | 说明 |
| --- | --- |
| 🕒 创建 / 完成时间 | 全自动记录，本地时间 `YYYY-MM-DD HH:mm:ss`，未完成显示 `-`；表格的完成时间列直接给出「用时 / 进行中」两行，重复完成、重复取消都会给出明确提示 |
| 🗂 四视图 | 表格 / 看板 / 甘特图 / 日历，同一份数据四种视角；切换视图保留筛选与排序，排序统一走表头 |
| 🧭 行内操作 | 勾选圈完成、点标题展开详情、行尾「⋯」编辑 / 删除；删除二次确认后仍可用 toast 撤销 |
| ⚡ 快速入口 | 主输入框下方常驻「待办」胶囊（显示未完成条数），点开是进行中清单：勾一下即完成（卡片内带「撤销」），一行输入 + Enter 直接记一条；只做「看进行中 / 勾掉 / 记一条」，编辑删除仍在面板。**默认开，可在待办面板页头「设置」里关掉**（关掉后胶囊、清单与 60s 轮询一起停，面板与 `/todo` 不受影响） |
| 📊 甘特图 | 纯前端计算（不新增接口）：轨道自适应不再裁切，右侧「用时」列常显（进行中带已进行时长）；条形 = 创建 → 完成 / 现在，分类分组可折叠并聚合；今天 / 近 7 天 / 近 30 天 / 全部四档范围按自然日对齐 |
| 🏷 分类 · 优先级 · 类型 | 项目分类（可从「已用分类 / 工作区 / 文件夹」建议里选）、高 / 中 / 低优先级、缺陷 / 新功能 / 改进 / 疑问 / 杂项 / 其他 |
| 📎 `@工作区文件` | 把待办关联到代码文件；只给文件、不给分类时，自动取文件所在目录作为分类 |
| ✍️ 五种录入 | 面板表单、对话式一句话（`新任务 写周报 #工作`）、`/todo` 斜杠命令、智能体工具 `todo_time_log`、主输入框下方胶囊里一行输入 |
| 🤖 智能体工具 | 智能体可 `list / get / create / complete / uncomplete / update / delete / health`，与 UI 共用同一实现 |
| 📦 导入 / 导出 | 页头「数据」：JSON 无损备份、CSV 给 Excel 统计；导入先预览再写入，支持合并 / 仅新增 / 覆盖全部，自动备份并可直接撤销 |
| 🔒 本地数据 | `<DSH_PROFILE_DIR 或 ~/.dsh>/todo-time-log/todos.json`；临时文件 + rename 原子替换、写入串行化、跨进程文件锁 |
| ✨ 动效 | 列表入场错位、勾选回弹、详情 / 菜单展开、对话框淡入、快速入口清单上浮淡入、甘特条「画」出来、筛选计数弹一下；只用 transform / opacity / clip-path，时长 120–200ms |
| 🌗 主题与无障碍 | 全部颜色走 `--dsw-alias-*` token，明暗主题自适应；`aria-live`、`aria-sort`、键盘操作；`prefers-reduced-motion` 下全部动画与过渡关闭 |
| ⌨️ 面板快捷键 | `/` 聚焦搜索、`n` 聚焦新建、`f` 循环切换筛选 |

---

## 安装

**要求**：DeepSeek Harness `>= 0.2.0-rc.2 < 0.2.3-0`（`engines.dsh` 声明，已在 **0.2.2-rc.1** 真机验证），Node.js ≥ 20。

### 方式一：插件管理器

在 DSH 的**插件管理（Plugin Manager）**里安装 bundle，包名填：

```text
dsh-todo-time-log
```

也可以直接让当前会话的智能体执行：

```text
plugin_manager action=install_bundle target=dsh-todo-time-log
```

安装成功后：左侧导航出现「待办时间日志」入口，中央面板可打开；Plugin Manager 中能看到中文名称、描述与图标。

> 安装会执行包安装（pnpm）、写入 `dsh.bundle.patch` 声明的 Host 行并启用 bundle；返回 `application: "applied"` 才算真正生效。Host 半改动需要关闭再开启插件（或重启桌面端）才会加载新模块，Client 半（`dsh.client.immediately`）随下一次页面刷新加载。

### 方式二：本地开发安装（link 方式）

```text
plugin_manager action=install_bundle target=<本地仓库绝对路径>
```

修改 `lib/*.js` 后需在 Plugin Manager 里关闭再开启该插件（或重启桌面端）才会加载新的 Host 模块；UI 改动刷新页面即可。

> 卸载：`plugin_manager action=remove_bundle target=dsh-todo-time-log`。数据文件会保留，手动删除 `todos.json` 即可清空。

### 配置

| 来源 | 优先级 | 示例 |
| --- | --- | --- |
| `cordis.patch.yml` 行配置 `config.dataFile` | 最高 | `config: { dataFile: 'D:/data/todos.json' }` |
| 环境变量 `DSH_TODO_TIME_LOG_DATA` | 中 | `DSH_TODO_TIME_LOG_DATA=D:\data\todos.json` |
| 默认 | 最低 | `<DSH_PROFILE_DIR 或 ~/.dsh>/todo-time-log/todos.json` |

相对路径解析到配置目录下。当前构建未导出 `Config` schema，插件详情页没有配置表单，请用上面两种外部方式配置（原因见 [`docs/limitations.md`](https://github.com/FantasyStarry/dsh-todo-time-log/blob/main/docs/limitations.md)）。

---

## 用法

### 五种录入方式

| 入口 | 怎么用 | 适合 |
| --- | --- | --- |
| 面板表单 | 顶部输入框 + 分类 / 优先级 / 类型选择器，Enter 创建 | 手动逐条记录 |
| 对话式录入 | 新建框右侧「批量」，一句话写多条，逐条回执 + 撤销 | 一次记一堆 |
| `/todo` 命令 | Harness 主输入框：`/todo 写周报 #工作 lib/store.js` | 不离开对话流 |
| 智能体工具 | 让模型调用 `todo_time_log`（`create` / `complete` / `list` …） | 让 AI 代记、代查 |
| 快速入口胶囊 | 主输入框下方「待办」胶囊 → 清单里一行输入 + Enter（`#分类 !优先级 ^类型` 可用） | 聊天时顺手记一条 |

> 快速入口与面板的分工：它只做「看进行中 / 勾掉 / 记一条」，是面板的**快捷镜像**而不是第二个面板；编辑、删除、改分类 / 优先级 / 类型仍在面板（清单底部「打开完整面板」一跳即到）。清单里一行输入走的是与对话录入同一条 `/quick-add`，标记解析不会出现两套规则；勾掉同样带「撤销」，与面板走同一个 `uncomplete`。
>
> 不用它也不影响别的：开关就在待办面板里 —— 打开面板，点页头右侧的「设置」，卡片里的「主输入框下方的待办快捷入口」开关**默认开**；关掉后胶囊、清单与 60s 轮询一起停，重新打开立即恢复，面板 / `/todo` 命令 / 待办数据都不受影响。偏好存在 Host 侧的 `<数据文件同目录>/todos.settings.json`，所以同一实例的浏览器共享同一个开关状态（A 浏览器关掉，B 浏览器刷新后也不显示）。

### 快捷标记（各处输入通用）

```text
新任务 写周报 #工作 @src/auth/login.ts
修复登录缺陷 #工作 !high ^bug
买牛奶 @生活；回邮件 [工作]
项目：学习 整理笔记，读完第三章
```

| 标记 | 写法 | 说明 |
| --- | --- | --- |
| 分类 | `#工作` / `@生活` / `[工作]` / `项目：工作` / `分类：工作` | 取最左的非空值，并从标题里剥离 |
| 优先级 | `!high` / `!medium` / `!low`（`!h` `!m` `!l`、`!高` `!中` `!低`） | 未写则回退到表单选择器 |
| 类型 | `^bug` / `^feature` / `^improvement` / `^question` / `^chore` / `^other`（中文 `^缺陷` / `^新功能` …，也支持 `类型：bug` / `type:bug`） | 未知值保留原文 |
| 文件 | `@路径/文件`、`@"docs/My File.md"` | 记为工作区相对路径；没有显式分类时自动取文件所在目录 |
| 多条 | 换行、`；`、`;` 分隔 | 只有填充词的行会被跳过，不会创建空待办 |

> 解析实现只有一份（`lib/parse.js` 的 `parseQuickAdd()`），面板（含主输入框下方快速入口胶囊里的那一行）、`/todo` 命令与工具 `quick_add` 共用，不存在两边规则漂移。

### 智能体工具 / HTTP

```text
todo_time_log { "action": "create", "title": "修复登录", "priority": "high", "type": "bug" }
todo_time_log { "action": "list", "filter": "pending", "sortBy": "priority", "direction": "asc" }
todo_time_log { "action": "complete", "id": "ttl_…" }
```

```bash
# 需要携带 DSH 登录态（未登录 401、跨站/不可信来源 403）
curl -s http://127.0.0.1:<port>/api/dsh-todo-time-log/health
```

HTTP 接口与智能体工具共用同一个业务实现（`executeTodoAction`），因此不存在「UI 能做的工具做不到」的情况；接口经宿主认证，未登录返回 401、跨站/不可信来源返回 403。

### 导入 / 导出

面板右上角「数据」打开对话框：

| 能力 | 说明 |
| --- | --- |
| 导出 JSON | 无损信封（`version: 5` + 全部字段 + 时间戳），可原样回导；导出前会先合并其他窗口刚写入的数据 |
| 导出 CSV | UTF-8 BOM + CRLF，Excel 直接打开；时间为本地 `YYYY-MM-DD HH:mm:ss`（秒级，毫秒级无损请用 JSON），`文件` 用 `;` 分隔，额外一列只读的 `耗时(分钟)` |
| 导入 JSON | 支持本插件信封 v1–v5、裸 `Todo[]` 数组；旧版本字段自动迁移 |
| 导入 CSV | 中英文表头别名（标题/title、分类/project、状态/status、优先级/priority、类型/type、创建时间/createdAt …），中文值「已完成 / 高 / 缺陷」也能识别 |
| 两段式导入 | 选文件后先 `dryRun` 预览「新增 / 更新 / 跳过 / 移除 / 非法行」，确认后才写盘 |
| 冲突策略 | **合并**（默认，同 ID 取 `updatedAt` 较新）/ **仅新增**（同 ID 跳过）/ **覆盖全部**（先自动备份再整体替换） |
| 自动备份 + 撤销 | 每次真正写入前生成 `<dataFile>.bak-<时间戳>`；导入结果的 toast 带「撤销」，恢复前还会再备份一次当前状态 |

限制：单次导入最多 5000 条（与列表上限一致），导入请求体上限 8 MiB；备份文件保留在同一目录，可手动删除或恢复。

---

## 数据与安全

- **本地优先**：数据只存在本地 JSON 文件，不联网、不上传、不触发模型调用。
- **写入可靠**：临时文件 + rename 原子替换；全部写操作串行化；跨进程写入用文件锁 + mtime 合并，避免多窗口互相覆盖。
- **损坏自愈**：JSON 损坏 / 结构异常 / 版本不支持会分别归档备份，然后重建空列表并给出提示；修复与异常提示只投递一次，不刷屏。
- **导入可回退**：导入 / 覆盖前自动写入 `<dataFile>.bak-<时间戳>` 备份；撤销只允许恢复同目录下本插件生成的 `.bak-*` 文件，路径穿越与任意文件读取都会被拒绝。
- **版本迁移**：v1 → v5 全部自动迁移，下一次写入即落盘新版本。
- **接口边界**：`/files`、`/quick-add` 只接受 `/workspaces` 返回的候选工作区；文件引用只接受工作区相对路径，绝对路径、盘符、`..` 一律拒绝。

## 兼容性

| 项 | 值 |
| --- | --- |
| 插件 ID / 包名 | `dsh-todo-time-log`（dsh 不加命名空间前缀，与官方插件一致；短别名 `todo-time-log` / `ttl`） |
| DSH | `>=0.2.0-rc.2 <0.2.3-0`（已实测 0.2.2-rc.1） |
| Node.js | ≥ 20 |
| 数据版本 | `version: 5`（旧版本自动迁移） |
| HTTP 接口 | `POST /api/dsh-todo-time-log/*`（经宿主认证：无登录态 401、跨站/不可信来源 403） |
| 安装位置 | 中央面板 `main` + 侧边栏 `sidebar.panellist` + 主输入框 `conversation.composer.dock`（「待办」胶囊）/ `conversation.input.overlay`（展开的清单）；快速入口开关在面板页头「设置」卡里，不占宿主槽位 |

> **兼容性门禁**：DSH 在 profile 启动时按已安装版本的 `engines.dsh` 做 preflight，不满足的插件会被禁用，并在 Plugin Manager 里显示 `incompatible-version`。升级 DSH 后若遇到该提示，安装声明范围覆盖新版本的插件版本即可。

## 开发

```bash
npm install
npm run build      # esbuild：src/client/ → lib/client.js
npm test           # 497 个用例：解析 / 数据层 / HTTP（含宿主认证）/ 设置偏好 / UI 渲染 / 并发写入
npm run verify     # check + lint + typecheck + build + test + audit（发布前必跑）
```

- Client 源码在 `src/client/`（ES 模块），构建产物 `lib/client.js` 是单文件模块表，**不要手改**。
- CI 跑 Node 20 / 22 / 24 × Ubuntu / Windows，并在 Linux job 校验构建产物与源码同步。
- 详细说明：[`docs/development.md`](https://github.com/FantasyStarry/dsh-todo-time-log/blob/main/docs/development.md)。

## 文档

| 文档 | 内容 |
| --- | --- |
| [`docs/architecture.md`](https://github.com/FantasyStarry/dsh-todo-time-log/blob/main/docs/architecture.md) | 目录结构、数据模型、Host / Client 架构、四视图与界面层级、toast 实现 |
| [`docs/development.md`](https://github.com/FantasyStarry/dsh-todo-time-log/blob/main/docs/development.md) | 测试矩阵、手工验证清单、发布流程 |
| [`docs/limitations.md`](https://github.com/FantasyStarry/dsh-todo-time-log/blob/main/docs/limitations.md) | 已知限制与 TODO（配置 schema、时区、启发式解析等） |
| [`docs/verification.md`](https://github.com/FantasyStarry/dsh-todo-time-log/blob/main/docs/verification.md) | 独立第三方 QA 验证报告（PASS / FAIL / 盲区） |
| [`docs/verification-log.md`](https://github.com/FantasyStarry/dsh-todo-time-log/blob/main/docs/verification-log.md) | 本机分阶段验证记录（含九期 DSH 0.2.2 兼容性证据） |
| [`docs/publishing.md`](https://github.com/FantasyStarry/dsh-todo-time-log/blob/main/docs/publishing.md) | npm 发布流程、OIDC 可信发布、排错 |
| [`docs/preview/`](https://github.com/FantasyStarry/dsh-todo-time-log/blob/main/docs/preview/README.md) | 更多渲染预览（空态 / 骨架屏 / 错误态 / 各种看板状态） |

## License

[MIT](https://github.com/FantasyStarry/dsh-todo-time-log/blob/main/LICENSE) © FantasyStarry

---

**In English** — A todo plugin for [DeepSeek Harness](https://github.com/deepseek-ai) that records and shows each todo's **created and completed time**. Four views (table / board / Gantt / calendar) where every Gantt bar is the real created→completed lifetime; project categories, priority, type, `@workspace-file` references, a `/todo` slash command with natural-language capture, a `todo_time_log` agent tool, and a quick-entry pill under the composer to add or tick off pending todos without leaving the chat (it can be switched off from the Preferences card in the panel header; the preference lives on the Host and is shared by every browser). All data stays in a local JSON file.
