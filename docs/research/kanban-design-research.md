# 看板设计调研：给 `dsh-todo-time-log` 的可落地改进建议

> 范围：只针对插件面板的「看板」视图（`docs/preview/04-board.png`），以及为支撑看板而必须改动的共享 UI / 数据契约。
> 约束：零依赖（只用宿主注入的 React，`React.createElement`，无 JSX / 无 UI 组件库 / 无图标库）、颜色只用 `--dsw-alias-*`、类名 `ttl-` 前缀、i18n zh/en 成对 key、浏览器端不查询 DOM、无障碍与键盘可用为硬要求。
> 抓取时间：2026-11-03。下文所有外链均在当日实际抓取成功（HTTP 200）；产品行为以对应版本文档为准。基于代码与常识、没有直接来源的判断，均显式标注「推断」。

---

## 0. 结论先行

1. **看板现在的主要问题不是"缺拖拽"，而是"卡片和列头的信息层级浪费了空间"**：每张卡重复列已表达的状态徽标、把创建/完成时间精确到秒平铺、三个文字按钮常驻；一屏能读到的卡片数被这些噪声压低了。
2. **先补"读"和"找"：卡片摘要化、列头统计、空态说明、搜索/筛选**。这些是零模型改动的纯前端收益，应排 P0/P1。
3. **拖拽不值得作为第一优先级**。产品只有"未完成 / 已完成"两列时，拖拽 = 点一下「完成」，收益极低、无障碍成本极高；而 WCAG 2.2 明确要求任何拖拽都必须有单指针替代，键盘等价还不算替代。正确顺序是：先做「更多 → 移动到」菜单 + 键盘移动，再决定要不要把指针拖拽作为增强。
4. **两个现有字段（status、project）就够撑起"泳道"**：行 = 分类、列 = 状态，可折叠；不需要新数据模型。真正值得评估扩模型的只有 `priority`（排序/聚焦价值最高）与 `dueAt`（与日历/甘特语义交叉，成本更高）；`tags` 不建议加（与 project 重叠）。
5. **WIP 限制在当前产品里是伪需求**：WIP 服务于多阶段工作流与团队吞吐，个人待办的两列板没有"阶段约束"可限制。已完成列真正的问题是"无限增长"，做法应是**折叠 / 只看前 N 条**，不是 WIP。

---

## 1. 调研方法与可信度

- 一手产品文档：Linear（board / display options / filters）、Notion（board view）、GitHub Projects（board layout / 字段与分组）、Trello（快捷键）、Asana（board view）、Jira（board 配置）、Atlassian Design System（Lozenge / Pragmatic drag and drop）。
- 标准与无障碍：W3C WCAG 2.2 Understanding 文档（2.5.7 拖拽、1.4.10 重排、2.5.8 目标尺寸、1.4.1 颜色、4.1.3 状态消息）、WAI-ARIA APG（键盘接口）、MDN（`aria-grabbed` 已废弃、`prefers-reduced-motion`）。
- 可用性研究：Nielsen Norman Group（渐进披露、空态设计）。
- **未纳入正文的产品**：Height、ClickUp、Plane、Focalboard。调研中未能稳定抓到它们的一手官方文档（Focalboard 的旧帮助页已 404；Plane 第三方镜像不可信），为避免编造链接，正文不引用；它们的常见能力（多视图、泳道、自定义字段）与上述产品重合，不影响结论。

---

## 2. 现状基线（代码事实，便于对照建议）

| 项 | 现状 | 位置 |
| --- | --- | --- |
| 分列 | `boardColumns()` 纯函数：`status` → 未完成/已完成；`project` → 名称升序、未分类最后 | `lib/client.js:994` |
| 卡片 | 标题 2 行截断（`-webkit-line-clamp: 2`）、分类徽标 + **状态徽标**、创建/完成时间（`YYYY-MM-DD HH:mm:ss`）、最多 2 个文件 chip、3 个常驻文字按钮「完成/编辑/删除」 | `lib/client.js:4623`、CSS `lib/client.js:2225` |
| 列头 | 只有名称 + 计数；无状态点、无列菜单、无折叠 | `lib/client.js:4685` |
| 列体 | `max-height: 56vh` 内部纵向滚动；外层 `.ttl-board` 横向滚动 → 两轴嵌套，且滚动容器不可聚焦 | CSS `lib/client.js:2180`、`:2210` |
| 语义 | 容器 `role="list"`，列 `role="listitem"`，卡片 `<article aria-label>`；无 heading 关联、无 roving tabindex、每卡 3 个 tab stop | `lib/client.js:4680` |
| 数据 | 文件 `version: 3`；字段 `id/title/project/files/status/createdAt/completedAt/updatedAt`；排序字段 `createdAt/completedAt/updatedAt/title/project` | `lib/store.js:17`、`:52` |
| 静态门禁 | i18n 键成对且无未用；无 hex/rgb；类名 `ttl-`；仅 `require('react')`；仅允许一次 `document.activeElement` 只读访问；禁止 `querySelectorAll/getElementById/innerHTML/setAttribute` | `test/client-audit.mjs` |

这些门禁决定了方案必须用 **React 状态 + ref + onBlur/keydown** 实现菜单、焦点与键盘，而不能用 document 级监听或 DOM 查询（见附录 A）。

---

## 一、可直接借鉴的 15 个模式

### 模式 1｜卡片是索引，不是详情页

- **是什么**：卡片只承载"识别 + 判断"所需的最少信息（标题、少量属性），完整内容与全部属性放进详情；卡片不放大段描述。
- **谁在用**：Linear 明确"卡片不显示描述，属性多时只显示放得下的；悬停按 `Space` 预览（peek）或打开详情"；Notion 允许配置卡片正面的属性可见性与顺序、卡片尺寸（小/中/大）；GitHub Projects 用字段显隐控制卡片信息。
- **为什么好**：看板的价值是"一屏扫完、发现异常"，不是逐条阅读。每多一行元信息，列内可同时看到的卡片就少一张。NN/g 的渐进披露研究也指出初始层只该放核心信息，次级信息按需展开。
- **对我们的具体做法**：
  - 卡片固定三段：**标题（2 行）→ 一行元信息（分类点 + 相对时间/截止信息）→ 可选 1 行文件 chip**。
  - **删掉状态徽标**（列头已表达状态，属重复编码）；分类徽标从"胶囊"降级为"小圆点 + 文本"。
  - 创建时间从每卡常驻改为：未完成卡显示"创建于 3 天前"（相对时间），已完成卡显示"完成于昨天"；绝对时间放 `aria-label` / 详情 / `title`，不再占版面。
- **来源**：[Linear — Board layout](https://linear.app/docs/board-layout)、[Notion — Board view](https://www.notion.com/help/boards)、[GitHub — Customizing the board layout](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-board-layout)、[NN/g — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)

### 模式 2｜卡片操作：一个主操作 + 一个「更多」菜单

- **是什么**：卡片默认只暴露最高频的单一操作（完成/勾选），编辑、删除、移动等收进可聚焦的溢出菜单；菜单点击/键盘触发，**不以 hover 为唯一入口**。
- **谁在用**：Trello 用 `E` 打开快速编辑、卡片背面承载完整操作；GitHub 进入卡片详情面板后编辑 Status 字段来完成移动；Linear 卡片通过选中 + 命令菜单操作。三家都把"低频破坏性操作"从卡片正面移走。
- **为什么好**：当前每卡 3 个文字按钮 = 每卡 3 个 tab stop、每列 N 张卡就有 3N 个焦点停靠点；删除按钮红色常驻还会持续抢注意力。收敛后卡片正面只剩一个 24×24 以上的完成控件，读起来快、键盘也不再"马拉松"。
- **对我们的具体做法**：
  - 主操作：左侧或右上角一个 **checkbox 样式的完成/取消完成按钮**（≥24×24，含 `aria-label`「完成：{标题}」）。已完成卡显示已勾选态。
  - 次要操作：右上「更多」按钮（`⋯`，内联 SVG 或文本，`aria-haspopup="true"`、`aria-expanded`、`aria-controls`），菜单项为「编辑 / 删除 /（可选）移动到…」；删除仍二次确认。
  - 菜单用 React 状态 + 容器 `onBlur`（判断 `relatedTarget` 不在菜单内）+ `Escape` 关闭；**不要**加 document 监听（静态门禁只允许一次 `document.activeElement`）。
- **来源**：[Trello — Keyboard shortcuts](https://trello.com/shortcuts)、[GitHub Projects 无障碍附录](https://github.com/open-source-accessibility/Open-Source-Assistive-Technology-Hackathon/blob/main/learning-room/docs/appendix-i-github-projects.md)、[NN/g — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)、[WCAG 2.5.8 Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

### 模式 3｜列头 = 字段值 + 统计，而不是一条装饰线

- **是什么**：列头承载"这列是什么 + 有多少 + 是否超限 + 列级操作"。计数不是装饰，它要跟当前筛选口径一致。
- **谁在用**：GitHub Projects 在列顶显示卡片数与列上限，超出时高亮；Linear 在组旁显示 issue 数或估算总和并可点击切换；Notion 列头右侧灰字默认显示卡片数，还能切换成计数/求和/日期区间等计算；Jira 的 board 配置把 workflow 状态映射到列并管理卡片字段与颜色。
- **为什么好**：有计数才能判断"未完成堆了 30 条"这种分布问题；有唯一口径才不会出现"计数 4、列表 0 行"的信任崩塌（README §3.9 已明确这条规则，看板列头应沿用）。
- **对我们的具体做法**：
  - 列头结构：`状态点 + 名称 + 计数`（`aria-label` 用整句：「未完成，共 3 条」），项目列沿用项目名 + 计数。
  - 计数取"当前筛选后该列条数"，与工具栏筛选/分类筛选同源；空列显示 `0`，不要隐藏。
  - 加列菜单（`⋯`）：折叠/展开、隐藏（「已完成」列），可选"只看未完成"。WIP 上限**暂不加**（见模式 4 与反模式 A3）。
  - 列头 `position: sticky; top: 0`，长列滚动时始终可见。
- **来源**：[GitHub — Customizing the board layout](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-board-layout)、[Linear — Display options](https://linear.app/docs/display-options)、[Notion — Board view](https://www.notion.com/help/boards)、[Jira — Configure a company-managed board](https://support.atlassian.com/jira-software-cloud/docs/configure-a-company-managed-board/)

### 模式 4｜列是字段的投影：拖入列 = 改字段，不引入"列 ID"

- **是什么**：列不是独立容器，而是某个字段值（status / project / priority…）的投影；把卡片移进列，等于把该字段改成列的值。
- **谁在用**：GitHub Projects 的 column field 可指定任意 single-select / iteration 字段，"拖到 Done 列，Status 就变成 Done"；Linear 的 board 按 Status / Project / Priority / Cycle / Label 等分组，"在分组之间拖拽会自动采用该分组的属性"。
- **为什么好**：只有一份真相，不会出现"列位置"和"字段值"打架；切换分组方式时数据不动，只换投影。我们的 `boardColumns()` 已经是这个模型，应保持并在新功能里复用（移动 = 调既有的 `update` 接口改 status/project）。
- **对我们的具体做法**：
  - 保持 `boardColumns(todos, groupBy)` 纯函数；分组选项从两项扩到三项：`状态`、`分类`、**`状态 × 分类`（泳道，见模式 6）**。
  - 「移动到…」只改字段：状态分组下 = `status`；分类分组下 = `project`（**需要确认文案**：「移到分类『工作』」属于改数据，不是纯视图操作，建议二次确认或 toast 可撤销）。
  - 不要为看板引入 `columnId`、`boardOrder` 之类的新概念；未来手动排序也只加一个 `order` 字段。
- **来源**：[GitHub — Changing the layout of a view](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/changing-the-layout-of-a-view)、[GitHub — Customizing the board layout](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-board-layout)、[Linear — Board layout](https://linear.app/docs/board-layout)

### 模式 5｜排序与手动排序互斥，且只有一个状态源

- **是什么**：当视图按某字段排序时，禁止/隐藏手动重排；"手动排序"本身是排序选项之一，选中它才允许拖动/置顶。
- **谁在用**：GitHub 明确写了"当 board 被排序时，不能在列内手动重排，但仍可跨列移动"；Linear 的 board 默认 manual ordering，列表与看板共享同一套 ordering，不能各自独立排序。
- **为什么好**：否则用户拖动后卡片"弹回原位"，会认为功能坏了；两套排序状态源（工具栏 + 列内顺序）也会让"当前到底按什么排"无法解释。
- **对我们的具体做法**：
  - 现有工具栏 `sortBy` 继续作为唯一排序源。**当 `sortBy` 不是"手动"时，隐藏/禁用列内的置顶、置底、拖动**。
  - 若未来加 `order` 字段：排序选项新增「手动」，只有此时显示拖动/置顶；切换回其他排序不丢 `order` 值。
  - 看板头部用一行弱化文案说明当前排序（如「按创建时间 · 最新在前」），或直接在列头菜单里显示勾选态。
- **来源**：[GitHub — Customizing the board layout](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-board-layout)、[Linear — Display options](https://linear.app/docs/display-options)

### 模式 6｜泳道：行 = 分类，列 = 状态（复用现有两个字段）

- **是什么**：在列分组之上再加一个维度做行分组，形成泳道；泳道可折叠，用于"按项目看推进"而不是"按项目拆列"。
- **谁在用**：Linear 的 board 支持 sub-grouping，把分组铺成行（swimlanes），`T` 折叠/展开泳道；GitHub 用自定义字段做横向分组（horizontal sections）；Notion 支持 sub-groups；Jira 在 board 配置里可选 Swimlanes 依据。
- **为什么好**：当前"按分类分列"在分类多时会横向爆炸（每列 240–380px，5 个分类就要横向滚很久），且列的语义从"阶段"变成"项目"，看图的人会误读。泳道把"阶段"稳定在列、"项目"放到行，既保留阶段感又不会无限加列。
- **对我们的具体做法**：
  - 分组选项加第三项「状态 × 分类」：两列固定（未完成/已完成），每列内部按项目分泳道；泳道头 sticky 且可折叠（React state，`aria-expanded`）。
  - 泳道头显示项目名 + 该泳道在该列的计数；未分类泳道固定最后（与现有 `groupByProject` 规则一致）。
  - 窄屏（<560px）时泳道退化为"项目小节"：先按状态分两段，段内再按项目分组，避免二维滚动。
  - 纯前端，不动数据模型；`boardColumns` 的输出结构从一维列改为"列 → 泳道 → 卡片"即可。
- **来源**：[Linear — Board layout](https://linear.app/docs/board-layout)、[Linear — Display options](https://linear.app/docs/display-options)、[GitHub — Customizing the board layout](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-board-layout)、[Notion — Board view](https://www.notion.com/help/boards)、[Jira — Configure a company-managed board](https://support.atlassian.com/jira-software-cloud/docs/configure-a-company-managed-board/)

### 模式 7｜完成列收纳：折叠 / 只看前 N 条，而不是无限流

- **是什么**：对"会无限增长"的完成列做收纳：默认折叠、只显示最近 N 条、或把 Done 隐藏起来但仍可拖入。
- **谁在用**：Notion 建议"Done 列太挤就隐藏它（Hide group / 归档）"；Linear 支持隐藏列，隐藏列会排到最右，且"不用展开也能把 issue 拖进隐藏列"。
- **为什么好**：看板的注意力预算应给未完成项；已完成是"日志/证据"，不是当前工作面。我们的产品本身就叫「待办时间日志」，完成记录有价值，但不该与待办争夺同一屏。
- **对我们的具体做法**：
  - 「已完成」列默认显示最近 10 条 + 「显示全部（N）」，或整列默认折叠成一行摘要（`已完成 · 12`），点击展开。
  - 折叠状态只存在 React state（刷新丢失可接受）；列头 `aria-expanded` + 明确的按钮名称（「展开已完成列」）。
  - 不做拖入隐藏列（没有拖拽），改为「取消完成」即可回到未完成列。
- **来源**：[Notion — Board view](https://www.notion.com/help/boards)、[Linear — Board layout](https://linear.app/docs/board-layout)

### 模式 8｜列级快速添加：`+` 在列头，自动带入该列字段值

- **是什么**：每列头部一个 `+`，点开就地输入，创建即落在该列（并自动带上该列的字段值）。
- **谁在用**：Linear 的 board 每列顶部有 `+`，创建的 issue 直接属于该列；Trello 用 `N` 在当前选中卡片后/空列表里新建卡片；GitHub 从视图底部 `+ Add item` 添加。
- **为什么好**：现在的新建入口在页面顶部，必须"输入 → 选分类 → 添加"三步；列级添加把"我在这个分类下想到一件事"压缩成一次输入 + Enter，摩擦接近零。
- **对我们的具体做法**：
  - 状态分组：只有「未完成」列显示 `+`（往已完成列新建没有意义）；分类分组：每列 `+` 自动把该分类写入新建的 `project`；泳道模式：泳道头 `+` 带入该泳道项目。
  - 交互：点击 `+` → 列内展开 input（`autoFocus`）→ `Enter` 创建、`Escape` 取消；创建中禁用，失败用现有 toast；创建成功后保持输入框打开以支持连续录入（Esc 退出）。
  - 复用现有 `POST /create` / `handleCreate`，不改接口；新增 i18n key 需 zh/en 成对且全部被使用（静态门禁会检查未使用 key）。
- **来源**：[Linear — Board layout](https://linear.app/docs/board-layout)、[Trello — Keyboard shortcuts](https://trello.com/shortcuts)

### 模式 9｜搜索与筛选：视图状态，不是数据操作

- **是什么**：在工具栏提供文本搜索（标题/分类/文件）+ 结构化筛选，结果计数与"清空筛选"入口可见；搜索与筛选属于视图状态，切视图不丢。
- **谁在用**：Linear 用 `F` 打开筛选、支持按属性与内容筛选；Trello 用 `F` 打开卡片筛选器，标题命中即高亮；GitHub 用过滤查询 + Slice by 字段值；Notion 用 filter/sort 组合成视图。
- **为什么好**：当待办从 10 条涨到 100 条，找到"上周那条 About 页面的"比"看清板"更常用。我们目前只有状态/分类筛选，没有文本搜索——这是当前最明显的查找缺口。
- **对我们的具体做法**：
  - 工具栏新增搜索框（`type="search"`、`aria-label`、防抖 150ms），客户端匹配 `title` / `project` / `files`（与现有 `filter`/`project` 组合，AND 关系）。
  - 输入框旁显示「匹配 N 条」；无结果时空态写明「没有匹配「foo」的待办」+「清除搜索」按钮（NN/g：空态必须能解释状态并给出出口）。
  - 搜索状态作为顶层 state，与 filter/sort/project 同级，切视图保留；`Escape` 清空并保留焦点。
  - 纯前端，不动数据；若未来数据量很大（>1000）再考虑服务端搜索，当前 `/list` 全量返回已足够。
- **来源**：[Linear — Filters](https://linear.app/docs/filters)、[Trello — Keyboard shortcuts](https://trello.com/shortcuts)、[GitHub — Customizing the board layout](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-board-layout)、[NN/g — Empty states](https://www.nngroup.com/articles/empty-state-interface-design/)

### 模式 10｜拖拽必须有"单指针 + 键盘"等价物，且 `aria-grabbed` 不能再用

- **是什么**：拖拽只作为效率增强；同一功能必须能用"点击/触摸的菜单操作"完成，并额外提供键盘路径。WAI-ARIA 的 `aria-grabbed`/`aria-dropeffect` 已被废弃，不应再用于表达"抓取"。
- **谁在用**：WCAG 2.5.7 的示例直接写了看板："用户可以拖拽卡片换列，也可以点选卡片后用箭头按钮移动"；Trello 提供方向键选卡、`,`/`.` 移到相邻列表底部、`<`/`>` 移到顶部；GitHub 的看板键盘路径是"打开卡片 → 编辑 Status 字段"；Linear 提供 `Option/Alt+Shift+↑/↓` 把选中 issue 移到列顶/列底。Atlassian 的 Pragmatic drag and drop 也把"辅助技术控件"作为独立可选层，而不是拖拽本身的一部分。
- **为什么好**：WCAG 2.2 AA 的 2.5.7 要求"任何拖拽功能都能用不拖拽的单指针方式完成"，且它**与键盘要求是两条独立标准**——只做键盘等价并不满足 2.5.7。`aria-grabbed` 废弃意味着不能用旧 ARIA 模式"假装"可访问。
- **对我们的具体做法**：
  - **不把指针拖拽排进 P0/P1**。当前两列状态板里拖拽 ≈ 点「完成」，收益接近零。
  - 先做「更多 → 移动到…」菜单：状态分组下就是「移到已完成 / 移到未完成」（按钮可点 = 单指针替代），分类分组下是「移到分类…」（选择器，复用项目选择器）。
  - 键盘：卡片 `Enter` 打开该菜单，方向键选择，`Enter` 执行；移动完成后用 `role="status"` 的视觉隐藏 live region 播报「已移到已完成」，焦点留在卡片上（不抢焦点）。
  - 若将来做指针拖拽：用 HTML5 DnD（`draggable` + `onDragStart/onDragOver/onDrop`）即可满足"无第三方库"，但**必须保留菜单与键盘路径**，且拖拽手柄/整卡目标 ≥24×24；绝不做 hover-only 拖拽手柄。
- **来源**：[WCAG 2.5.7 Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)、[WCAG 4.1.3 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)、[Trello — Keyboard shortcuts](https://trello.com/shortcuts)、[GitHub Projects 无障碍附录](https://github.com/open-source-accessibility/Open-Source-Assistive-Technology-Hackathon/blob/main/learning-room/docs/appendix-i-github-projects.md)、[MDN — aria-grabbed](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-grabbed)、[Atlassian — Pragmatic drag and drop](https://atlassian.design/components/pragmatic-drag-and-drop/about)

### 模式 11｜卡片级焦点模型：方向键移动、单键快捷操作

- **是什么**：一列卡片作为一个复合控件管理焦点（roving tabindex 或单一活动项），方向键在卡片间移动，`Enter` 打开/操作，单键快捷键执行高频动作；Tab 只在"列/板"级别停靠。
- **谁在用**：Trello：方向键 / `J` `K` 在卡片间选择，`Enter` 打开卡片，`E` 快速编辑，`N` 新建，`F` 筛选，`/` 聚焦搜索；Linear：`X` 选择、`Shift X` 多选、`T` 折叠泳道；W3C APG 的键盘接口实践推荐用 roving tabindex 管理复合控件内部焦点，并强调快捷键不能替代可达性。
- **为什么好**：当前每张卡 3 个 tab stop，50 张卡 = 150 次 Tab；方向键模型把"扫一遍列"从 150 次按键降到 50 次以内，也让"移动/编辑"有了稳定的操作起点。
- **对我们的具体做法**：
  - 每列一个 `focusedId` state；卡片 `tabIndex` 为 `id === focusedId ? 0 : -1`；`↑/↓` 在列内移动焦点，`Home/End` 到列首/列尾，`←/→` 在列间跳转（列本身也可作为停靠点）。
  - `Enter` 打开卡片操作菜单（或展开卡片操作区），`Space` 不绑完成（避免与滚动冲突），用 `C` 或菜单完成；`E` 编辑、`Delete` 不直接删（防止误删，必须走菜单确认）。
  - 焦点移动后用 ref 调 `.focus()`，并用 `scrollIntoView({ block: 'nearest', inline: 'nearest' })`（ref 调用，不查询 DOM）。
  - 焦点环用现有 focus-visible token 样式，宽度 ≥2px、与选中态区分（APG：focus 与 selection 必须视觉可区分）。
- **来源**：[Trello — Keyboard shortcuts](https://trello.com/shortcuts)、[Linear — Board layout](https://linear.app/docs/board-layout)、[W3C APG — Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)

### 模式 12｜滚动与窄屏：单轴优先、明确的横向提示、避免嵌套滚动陷阱

- **是什么**：看板横向滚列、纵向滚页面（或列内滚），二选一作为主轴；窄屏提供可读的替代布局，而不是让用户在两个方向里迷路。
- **谁在用**：Linear 提示 `Shift + 滚轮` 横向滚动、拖空白处横滚；Trello 同样支持 `Shift + Scroll` 横向滚动；WCAG 1.4.10 要求内容在 320 CSS px 宽下不需要二维滚动即可阅读（数据表格/网格等需要二维理解的区域可例外，但区域内文本仍应可读）。
- **为什么好**：`dsh-todo-time-log` 跑在可变宽的中央面板里；`max-height: 56vh` 的列内滚动叠在外层横向滚动上，会出现"滚轮到底滚哪"的困惑，键盘用户还无法聚焦滚动容器。窄面板下 2 列 × 240px 已经吃满宽度。
- **对我们的具体做法**：
  - 列宽 `clamp(240px, 30vw, 340px)`；板面 `overflow-x: auto` + `scroll-snap-type: x proximity`，列 `scroll-snap-align: start`；横向滚动容器 `tabIndex=0`、`role="region"`、`aria-label`（键盘可滚动，WCAG 2.1.1）。
  - 两种高度模式（视图选项，React state）：「列内滚动」（现状，适合多列长列）与「随页面滚动」（列体不限高，适合窄屏/单列）。默认保持现状以减少回归。
  - 窄屏（<560px）切换为**单列堆叠**：列头 sticky，每列下方卡片顺序排列，去掉横向滚动；或至少提供「列切换」分段控件。窄屏不隐藏任何功能，只改变呈现。
  - 卡片获得焦点/被移动后调用 `scrollIntoView`，避免焦点在视口外。
- **来源**：[WCAG 1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)、[Linear — Board layout](https://linear.app/docs/board-layout)、[Trello — Keyboard shortcuts](https://trello.com/shortcuts)

### 模式 13｜语义化状态色：颜色只是辅助，文字/形状必须独立成立

- **是什么**：状态/优先级用有限的语义色（成功、信息、警告、危险、中性），并且始终配文字或形状；不把"颜色"当作唯一编码。
- **谁在用**：Atlassian Design System 的 Lozenge 按 `default / success / information / warning / danger` 语义着色，并明确"lozenge 用于状态快速识别，标签分类用 Tag"；WCAG 1.4.1 要求颜色不能是传达信息、指示动作或区分元素的唯一视觉手段。
- **为什么好**：宿主主题明暗切换、色觉差异、低对比显示器都会让"纯色点"失效；而我们的产品已经有"状态徽标 + 文本"的基础，不应在改版里退化成纯色条。
- **对我们的具体做法**：
  - 颜色 token 映射（只用现有变量 + `color-mix()`）：未完成 = `--dsw-alias-label-secondary` 点 + 中性浅底；已完成 = `--dsw-alias-state-success-secondary` 底 + `--dsw-alias-state-success-primary` 点/文字；未来优先级 = `state-error-primary`（P0）、`state-warn-primary`（P1）、`label-tertiary`（P2），**始终带 P0/P1/P2 文本**。
  - 项目不分配任意颜色（token 没有无限色板，且颜色编码项目会与状态色打架）；项目只用"点 + 名称"。
  - 徽标文字对比度：正文 ≥4.5:1，非文本指示（点/边框）≥3:1；暗色主题需逐项目检（现有预览 `10-dark.png` 可作基线）。
- **来源**：[Atlassian Design System — Lozenge](https://atlassian.design/components/lozenge/lozenge/examples)、[WCAG 1.4.1 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)

### 模式 14｜空态三分：真没数据 / 筛选无匹配 / 单列为空

- **是什么**：空态不是一句"暂无数据"，而要说明"为什么空、能做什么"，并提供直接出口。
- **谁在用**：NN/g 的空态三准则——传达系统状态、提供学习线索、给出直达关键任务的路径；并特别指出"加载中却显示 No records"会严重损害信任。
- **为什么好**：当前列空只显示「暂无待办」，用户无法判断是筛选导致还是确实没有；面板级空态虽有按钮，但列级空态没有出口。产品有四视图 + 多筛选，空态歧义会被放大。
- **对我们的具体做法**：
  - 全板空：沿用现有 `TextPlaceholder`（标题 + 新建出口）。
  - 筛选/搜索无匹配：文案「没有符合当前筛选的待办」+「清除筛选」按钮（已有 `emptyActionKey` 机制可扩展）。
  - 单列为空：未完成列「暂无未完成待办」+ 可选「新建」；已完成列「还没有已完成待办」（不提供"完成一条"的奇怪出口）；项目列「这个分类下没有待办」+「在此分类新建」。
  - 骨架屏与空态严格分开：加载中不渲染空态文案（现有骨架屏已满足，列级扩展时保持）。
- **来源**：[NN/g — Designing Empty States in Complex Applications](https://www.nngroup.com/articles/empty-state-interface-design/)

### 模式 15｜密度可调 + 克制动效（尊重 reduced motion）

- **是什么**：提供"紧凑/舒适"两档密度；动效只用于状态变化的反馈，时长 120–200ms，且在 `prefers-reduced-motion: reduce` 下关闭。
- **谁在用**：Notion 支持小/中/大卡片尺寸；Linear 用 display properties 控制卡片上显示哪些属性；GitHub 用字段显隐控制信息量。MDN 的 `prefers-reduced-motion` 说明浏览器会暴露用户"减少非必要动效"的系统偏好，作者应据此移除/替换缩放、平移类动画。
- **为什么好**：中央面板可能被拖得很窄（需要紧凑），也可能全宽（可以舒适）；同一套密度无法同时最优。动效上，看板的重排/折叠如果做位移动画，容易触发前庭不适，收益却很小。
- **对我们的具体做法**：
  - 视图选项加「紧凑 / 舒适」：紧凑 = 标题 1 行、隐藏时间与文件 chip、卡片内边距 8→6；舒适 = 现状 + 模式 1 的相对时间。密度存 React state，与筛选一样跨视图保留。
  - 动效只做 opacity（新增卡片淡入、菜单淡入），**不做列宽/位置过渡**；折叠用即时显隐 + 淡入，避免 `max-height` 过渡造成的抖动（推断：长列表下更明显）。
  - 统一包在 `@media (prefers-reduced-motion: reduce) { .ttl-board * { animation: none !important; transition: none !important; } }` 或在各规则里覆盖，沿用现有 toast 的 reduce 约定。
- **来源**：[Notion — Board view](https://www.notion.com/help/boards)、[Linear — Display options](https://linear.app/docs/display-options)、[MDN — prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)

---

## 二、差距清单：优秀看板有、我们目前没有

### A. 信息层级与视觉

| # | 差距 | 现状证据 | 影响 |
| --- | --- | --- | --- |
| A1 | 卡片无主次：状态徽标与列重复，三个操作按钮平铺 | `renderBoardCard`：`ProjectBadge + statusBadge + 时间 + files + renderActionButtons` | 单卡更高，列内可见卡片少 1–2 张 |
| A2 | 秒级双时间戳常驻，信息价值/成本比低 | `formatTime(createdAt)` + `formatTime(completedAt)` | 窄列换行、"完成 -" 反复出现 |
| A3 | 卡片没有"按需展开"的详情/操作层 | `renderActionButtons(todo, { showDetail: false })` | 所有操作始终占位，无法渐进披露 |
| A4 | 文件 chip 固定最多 2 个且不可折叠 | `renderFileChips(todo, { max: 2 })` | 小列里挤占标题空间 |

### B. 列头与分组

| # | 差距 | 现状证据 | 影响 |
| --- | --- | --- | --- |
| B1 | 列头只有名称 + 计数，无状态点、无列菜单、无折叠 | 列头仅 `title + count` | 无法收纳已完成、无法快速折叠 |
| B2 | 分组只有单层（状态或分类二选一） | `BOARD_GROUPS` 两项 | 项目多时列横向爆炸；看不懂"阶段 × 项目" |
| B3 | 分类多时列宽 240–380 + 横向滚动，无"项目聚焦"捷径 | CSS `.ttl-board-column` | 找某个项目的卡要横滚多次 |
| B4 | 无列级快速添加 | 只有页面顶部 composer | 新建摩擦高，分类/泳道上下文丢失 |

### C. 查找、排序与移动

| # | 差距 | 现状证据 | 影响 |
| --- | --- | --- | --- |
| C1 | 无文本搜索（标题/分类/文件） | 工具栏仅 filter + sort + project | 待办变多后只能靠滚 |
| C2 | 无手动排序/置顶，排序只有 4 个字段 | `SORTS` + `SORT_FIELDS` | 无法表达"这条我接下来先做" |
| C3 | 无跨列移动入口（除完成/取消完成） | 状态只有 toggle；分类分组下不能改 project | "按分类看板"下无法移动卡片 |
| C4 | 无 WIP/列上限概念 | — | 影响低（见反模式 A3，不建议直接补） |

### D. 键盘、无障碍与窄屏

| # | 差距 | 现状证据 | 影响 |
| --- | --- | --- | --- |
| D1 | 每卡 3 个 tab stop，无方向键/roving focus | 每卡渲染 3 个按钮 | 键盘用户成本 O(3N) |
| D2 | 列结构不是 heading + list，`role=list/listitem` 嵌套语义不清 | `role="list"` 容器 + `listitem` 列 + `article` 卡 | 屏幕阅读器难建立"列 → 卡片"层级 |
| D3 | 列体滚动容器不可聚焦 | `.ttl-board-column-body` 无 `tabIndex`/`role` | 键盘无法滚动长列（WCAG 2.1.1） |
| D4 | 无"移动"类操作，因而也没有 live region 播报 | 只有 toast（完成后） | 状态变化对读屏不完整 |
| D5 | 窄屏只有横向滚动，无堆叠/列切换 | 列 min-width 240 + flex | 320px 宽下体验差（WCAG 1.4.10 风险） |
| D6 | 无密度档位；卡片在窄列里信息过密 | 固定布局 | 面板变窄时更差 |

### E. 数据模型（当前没有的能力）

| # | 差距 | 说明 | 是否值得补 |
| --- | --- | --- | --- |
| E1 | 无 `priority` | 无法在列内表达"先做哪个"，排序/视觉聚焦缺一个维度 | 值得（P2，先评估） |
| E2 | 无 `dueAt` | 看板看不到逾期/临期；但与日历/甘特的时间语义交叉 | 谨慎（P2） |
| E3 | 无 `tags` | 与 `project` + `files` 重叠，个人待办场景收益低 | 不建议 |
| E4 | 无 `order` | 手动排序无法持久化；置顶/置底做不了 | 需要时再加（P2） |
| E5 | 无自定义工作流状态（只有 pending/completed） | 产品语义就是"待办 + 时间日志" | 不建议扩展 |

---

## 三、P0 / P1 / P2 建议

> 成本口径（推断，含实现 + i18n + 测试 + 静态门禁回归）：S ≤ 0.5 人日，M 1–2 人日，L ≥ 3 人日。
> 可行性：**✅ 纯前端**（只改 `lib/client.js`）/ **⚠️ 复用现有接口**（`/create`、`/update`、`/list`）/ **🧱 需数据模型 v4**（`lib/store.js` + `lib/index.js` 契约 + 工具 schema + README + 测试）。

### P0（先做；高影响、低成本、零模型改动）

| # | 建议 | 影响 | 成本 | 可行性 | 验收要点 |
| --- | --- | --- | --- | --- | --- |
| P0-1 | **卡片摘要化**：去掉状态徽标；分类降级为"点 + 文本"；时间改为相对时间（创建 3 天前 / 完成于昨天），绝对时间进 `aria-label`；文件 chip 超过 1 行时折叠为「+N」 | 高 | S–M | ✅ | 240px 列宽下卡片高度明显下降；读屏仍能听到完整时间 |
| P0-2 | **操作收敛**：完成变成 24×24 以上的 checkbox 式按钮（含 `aria-label`）；编辑/删除收进「更多」菜单；删除保留二次确认；菜单可点击、可键盘、可 Esc 关闭，不依赖 hover | 高 | M | ✅ | Tab 到卡片后最多 2 个停靠点；删除不会被一键误触；触屏可用 |
| P0-3 | **列头增强**：状态点 + 名称 + 计数（`aria-label` 整句）+ 列菜单（折叠/展开「已完成」）；已完成默认显示最近 10 条 + 「显示全部」 | 中–高 | M | ✅ | 计数与筛选同源；折叠状态有 `aria-expanded`；空列显示 0 |
| P0-4 | **空态三分**：全板空 / 筛选无匹配 / 单列为空，各自文案 + 出口；加载骨架不显示空态 | 中 | S | ✅ | 三种情况文案不同且均有下一步；i18n 键成对 |
| P0-5 | **键盘与语义结构**：列用 heading + list，卡片成为单一 focusable（roving tabindex + 方向键），列体滚动容器 `tabIndex=0` + `role=region` + `aria-label`；焦点环 ≥2px 且与选中态区分 | 高 | M–L | ✅ | Tab 不再逐卡逐按钮；方向键可遍历列；读屏能报「未完成，列表，3 项」 |
| P0-6 | **窄屏适配**：列宽 `clamp()` + `scroll-snap`；<560px 切换单列堆叠（列头 sticky）；横向滚动容器可键盘聚焦 | 高 | M | ✅ | 320px 宽不出现横向滚动才能读卡片；面板变宽自动回到多列 |
| P0-7 | **状态色 token 化审查**：语义点/底只用现有 alias token + `color-mix`；对比度 4.5:1 / 3:1；暗色逐项目检 | 中 | S | ✅ | 无 hex/rgb（门禁）；`10-dark.png` 同款场景可读 |

### P1（紧接着做；中等成本，提升效率与一致性）

| # | 建议 | 影响 | 成本 | 可行性 | 数据模型 |
| --- | --- | --- | --- | --- | --- |
| P1-1 | **搜索框**（标题/分类/文件，防抖 150ms）+ 匹配计数 + 无结果空态 + `Escape` 清空；状态与现有筛选同级、跨视图保留 | 高 | M | ✅ | 无 |
| P1-2 | **列级快速添加**：未完成列/项目列 `+`，列内输入，Enter 创建并带入 `project`；复用 `/create` | 高 | M | ⚠️ 现有接口 | 无 |
| P1-3 | **「移动到…」菜单**：状态分组下切换 status；分类分组下改 project（二次确认或可撤销 toast）；为将来拖拽提供单指针等价物 | 高 | M | ⚠️ `/update` | 无 |
| P1-4 | **快捷键层**：`/` 聚焦搜索、`E` 编辑、`N` 新建、`F` 切筛选；方向键/`Home`/`End` 列内导航（依赖 P0-5） | 中 | M | ✅ | 无 |
| P1-5 | **泳道（状态 × 分类）**：两列固定、行 = 项目、可折叠、sticky 行头；窄屏退化为分组小节 | 中–高 | M–L | ✅ | 无（复用 status/project） |
| P1-6 | **密度切换（紧凑/舒适）**：视图级 state，跨视图保留；紧凑隐藏时间/文件 chip | 中 | S–M | ✅ | 无 |

> P1-3 的语义提醒：分类分组下"移到另一列"本质是**改数据**（`project` 变了），必须让用户预期一致（菜单文案写「移到分类『x』」而不是「移动」）；状态分组下改 status 则可以复用现有完成/取消完成为路径。

### P2（需要模型/契约变更或收益待验证；先做设计评审再排期）

| # | 建议 | 影响 | 成本 | 可行性 | 数据模型改动 |
| --- | --- | --- | --- | --- | --- |
| P2-1 | **`priority` 字段**（枚举 `P0/P1/P2` 或 `high/medium/low`，空 = 未设）：卡片小徽标 + 列内排序 + 筛选 + 快捷添加语法（如 `!p1`）；**始终带文本**，色只用 warn/error token | 高 | L | 🧱 | `store.js` 版本 3→4、`normalizeTodo` 补默认值、`SORT_FIELDS` 加 `priority`、`/create`/`/update`/工具 schema、`/list` 排序、README §3.6、`parse.js`、表单控件、i18n、测试 |
| P2-2 | **`dueAt` 字段**：卡片显示"今天/逾期 N 天"；看板排序与筛选；与日历/甘特的时间语义统一（需产品决策：日历按创建还是按截止） | 中–高 | L | 🧱 | 同上 + 四视图语义确认 + 时区/日期边界（当前时间工具在 `lib/time.js`） |
| P2-3 | **`order` 字段**（手动排序）：仅当 `sortBy='manual'` 时可拖动/置顶；稀疏排序 + 重排兜底；移动 = 写 order | 中 | L | 🧱 | `store.js` 版本升级、`order` 校验/迁移、`SORT_FIELDS`、`/list` 排序、README 契约、测试（排序稳定性） |
| P2-4 | **指针拖拽**（仅增强）：HTML5 DnD，拖入列 = 改字段；必须有 P1-3 菜单与键盘路径兜底；手柄 ≥24×24；完成时 live region 播报 | 中 | L | ✅（但高风险） | 无（改字段走现有接口） |
| P2-5 | **列配置持久化**（隐藏列/折叠/密度/排序偏好）：当前插件未导出 `Config` schema（README §6），浏览器端持久化渠道需先确认 | 低 | M | ⚠️ 需宿主能力确认 | 无（偏好不是 todo 数据） |
| P2-6 | **列上限 / WIP**：仅当未来引入"多工作流阶段列"才有意义；建议**现在不做**（见反模式 A3） | 低 | M | 🧱 | 需列配置模型 |

### 数据模型扩展的判断（结论）

- **优先级 > 截止时间 > 手动排序 > 泳道**（泳道不需要模型，所以直接做）。优先级是唯一能同时改善"列内顺序"和"视觉聚焦"的字段；截止时间价值高但与日历/甘特强耦合，应先统一时间语义；手动排序只在用户明确抱怨"顺序总变"时才值得加 `order`。
- **不建议 `tags`**：`project` 已承担分类，`files` 已承担上下文；再加 tags 会让卡片、筛选、快捷添加、工具契约同时变复杂，而个人待办场景的收益不成比例。
- **不建议把 status 扩成自定义工作流列**：这会推翻"待办 + 时间日志"的产品语义，牵连 `store`、`/list` 的 `pending/completed` 统计、日历/甘特、`/todo` 命令与工具契约；看板的"阶段感"用泳道 + 完成列收纳即可满足。
- 任何模型变更都必须：文件 `version` 递增 + 旧文件迁移（缺失字段补默认）+ `/list` 排序字段生效 + 工具 schema/README 契约同步 + `test/client-audit.mjs` 与 store 测试通过。**只加 UI 不加契约，会导致 MCP/命令行用户看不到同一套语义。**

### 落地检查表（每个改动都过一遍）

- [ ] 只用 `React.createElement`；无新依赖；仅 `require('react')`。
- [ ] 颜色只用 `--dsw-alias-*` + `color-mix()`；无 hex/rgb/hsl（静态门禁硬性检查）。
- [ ] 新类名 `ttl-` 前缀；不新增全局选择器。
- [ ] i18n zh/en **成对**，占位符 `{x}` 一致，无未使用 key（门禁会失败）。
- [ ] 不查询 DOM：焦点用 ref + `.focus()`；菜单关闭用 `onBlur`/`Escape`/遮罩，不加 document 监听。
- [ ] 键盘可达：所有鼠标操作有键盘路径；焦点可见；`aria-expanded`/`aria-controls`/`aria-label` 正确。
- [ ] 动效尊重 `prefers-reduced-motion`；不因操作移动焦点（除非用户主动导航）。
- [ ] 状态变化（完成、移动、搜索无结果、列折叠）有 `role="status"` 播报或可见文案。
- [ ] 窄屏（320px 等效）与暗色主题目检；空态/加载/错误三态不混淆。
- [ ] 跑 `node test/client-audit.mjs` 与现有 smoke/parse 测试，确认无回归。

---

## 四、反模式 / 不该抄的东西

| # | 反模式 | 为什么不该抄 | 正确做法 |
| --- | --- | --- | --- |
| A1 | **Pointer-only 拖拽**（拖拽是唯一路径），或只用 `aria-grabbed` 表达状态 | WCAG 2.2 AA 2.5.7 明确要求单指针非拖拽替代；`aria-grabbed`/`aria-dropeffect` 已废弃 | 先做菜单移动 + 键盘移动，拖拽仅作增强（模式 10） |
| A2 | **把表格全部列塞进卡片**（负责人、标签、子任务、备注、多时间戳） | 卡片变成"迷你详情页"，扫读价值消失；NN/g 的渐进披露原则反对初始层堆满次级信息 | 卡片只留标题 + 1 行元信息；详情/菜单按需展开（模式 1、2） |
| A3 | **给两列状态板加 WIP 限制** | WIP 约束的是"多阶段工作流的在制品"，个人待办只有未完成/已完成，没有可约束的中间阶段；硬上限还会把"记录想法"变成被拒绝的操作 | 不抄 WIP；已完成列用折叠/只看最近 N 条（模式 7）。若未来做多阶段，再参考 GitHub 的**非阻断式**列上限（只显示 `3/5` 并在超出时高亮，不阻止添加） |
| A4 | **颜色编码过载**：每项目一色 + 每优先级一色 + 每文件类型一色 + 每状态一色 | 宿主 token 没有无限色板；颜色一多就没有语义，且违反"颜色不是唯一手段"；暗色下对比度难保证 | 状态/优先级用有限语义色 + 文本；项目只用中性点 + 名称（模式 13） |
| A5 | **仅 hover 显示操作/拖拽手柄** | 触屏、键盘、语音用户无法触发；WCAG 2.5.8 要求目标 ≥24×24 或有足够间距 | 操作常驻或点击展开；hover 只能作为"额外提示"，不能是唯一入口（模式 2） |
| A6 | **排序与手动排序并存且互相覆盖** | 用户拖动后卡片弹回，或排序按钮"看起来没生效"；GitHub 专门用文档说明二者互斥 | 单一排序状态源；非手动排序时禁用重排（模式 5） |
| A7 | **展开/收起用 `max-height` 大过渡、列宽/位置位移动画** | 长列表下抖动、掉帧；位移动画可能触发前庭不适；`prefers-reduced-motion` 用户被强制观看 | 只做 opacity 淡入；即时显隐；reduce 下全关（模式 15） |
| A8 | **空态只写"暂无数据"、加载中显示"No records"** | NN/g 指出这会让用户无法判断是加载、出错还是筛选错，严重损害信任 | 空态三分 + 加载骨架独立（模式 14） |
| A9 | **把 status 扩成自定义工作流列** | 推翻产品语义，牵连 store/统计/日历/甘特/命令/工具契约；成本与收益不匹配（推断） | 保持两状态；用泳道表达项目维度（模式 6、E5） |
| A10 | **用 `title` 属性作为唯一信息补充**（截断标题、时间、徽标含义都靠 tooltip） | 触屏、键盘、读屏用户拿不到；WCAG 1.4.10 的"截断内容需有机制展开"也不满足 | 可聚焦的展开/详情；`aria-label` 提供完整语义（模式 1） |
| A11 | **整卡点击 + 内部按钮 + 拖拽三种交互叠在同一区域** | 点击目标互相抢占，误触率高；嵌套交互对读屏是灾难（推断） | 卡片主体只负责"选中/打开"，操作走独立按钮/菜单（模式 2、11） |

---

## 五、参考来源汇总

> 全部链接于 2026-11-03 抓取验证（HTTP 200）。产品文档描述的是对应产品当时的行为；设计结论中的「对我们的做法」为本文作者的综合判断。

### 产品文档

1. [Linear — Board layout](https://linear.app/docs/board-layout)（列、泳道、键盘移动、隐藏列、卡片不显示描述、peek）
2. [Linear — Display options](https://linear.app/docs/display-options)（分组/子分组、手动排序、计数/估算、属性显隐）
3. [Linear — Filters](https://linear.app/docs/filters)（`F` 筛选、快捷筛选、条件组合）
4. [Notion — Board view](https://www.notion.com/help/boards)（按属性分组、子分组、列计数/计算、卡片尺寸、属性可见性、隐藏列）
5. [GitHub — Changing the layout of a view](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/changing-the-layout-of-a-view)（table/board/roadmap 三种布局）
6. [GitHub — Customizing the board layout](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-board-layout)（column field、列上限、字段显隐、Slice by、排序时禁止手动重排、横向分组、字段求和）
7. [Trello — Keyboard shortcuts](https://trello.com/shortcuts)（方向键/J/K 选卡、`,`/`.`/`<`/`>` 移列、`E` 快编、`N` 新建、`F` 筛选、`Shift+滚轮` 横滚）
8. [Asana — Manage your workflow with Lists, Boards, Calendar, and Timeline View](https://asana.com/inside-asana/manage-workflow-project-views)（board 列即阶段、跨视图切换）
9. [Jira — Configure a company-managed board](https://support.atlassian.com/jira-software-cloud/docs/configure-a-company-managed-board/)（列映射 workflow 状态、泳道、quick filters、卡片字段与颜色）

### 设计系统

10. [Atlassian Design System — Lozenge](https://atlassian.design/components/lozenge/lozenge/examples)（default/success/information/warning/danger 语义状态）
11. [Atlassian Design System — Pragmatic drag and drop](https://atlassian.design/components/pragmatic-drag-and-drop/about)（拖拽与"可选辅助技术控件"分层，headless、无设计系统依赖）

### 无障碍与标准

12. [W3C WCAG 2.2 — Understanding SC 2.5.7 Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)（看板拖拽必须有单指针替代；键盘与单指针是两条独立要求）
13. [W3C WCAG 2.2 — Understanding SC 1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)（320 CSS px；截断内容需可展开机制；表格/网格例外范围）
14. [W3C WCAG 2.2 — Understanding SC 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)（24×24 或足够间距）
15. [W3C WCAG 2.2 — Understanding SC 1.4.1 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)（颜色不能是唯一手段）
16. [W3C WCAG 2.2 — Understanding SC 4.1.3 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)（不抢焦点的状态播报）
17. [W3C WAI-ARIA APG — Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)（roving tabindex、focus 与 selection 区分、快捷键不能替代可达性）
18. [MDN — `aria-grabbed`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-grabbed)（属性已废弃，等待新的 WAI-ARIA 机制）
19. [MDN — `prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)（减少非必要动效的系统偏好）

### 可用性研究

20. [NN/g — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)（初始只放核心信息；最多两级披露）
21. [NN/g — Designing Empty States in Complex Applications: 3 Guidelines](https://www.nngroup.com/articles/empty-state-interface-design/)（系统状态、学习线索、直达出口；加载中不得显示"无数据"）

### 社区/教学资料（可信度低于一手文档，仅作旁证）

22. [GitHub Projects 无障碍附录（Open Source Assistive Technology Hackathon）](https://github.com/open-source-accessibility/Open-Source-Assistive-Technology-Hackathon/blob/main/learning-room/docs/appendix-i-github-projects.md)（GitHub 看板键盘路径：打开卡片 → 编辑 Status；拖拽对键盘不可用）

---

## 附录 A：在零依赖 React 插件里的实现要点

这些是实现上面 P0/P1 建议时最容易踩坑的地方，按当前静态门禁给出可落地方案。

1. **菜单/弹层（不能用 document 监听）**
   - 用 `useState` 存 `openMenuId`；触发器 `aria-haspopup="true"`、`aria-expanded`、`aria-controls`。
   - 关闭路径：容器 `onBlur` 检查 `event.relatedTarget` 是否仍在容器内；`Escape` 在菜单容器 `onKeyDown` 处理；焦点回到触发按钮（ref）。
   - 不用 `document.addEventListener`（门禁只允许一次 `document.activeElement` 只读访问）。

2. **Roving tabindex（方向键卡片导航）**
   - 每列一个 `focusedId`；卡片 `tabIndex = id === focusedId ? 0 : -1`。
   - `onKeyDown` 用当前列的 `items` 数组算 next/prev，`setFocusedId` 后 `useEffect` 里通过 `cardRefs.current[nextId].focus()`。
   - 跨列用 `←/→` 跳到相邻列的第一个（或上次聚焦）卡片；列容器自身也 `tabIndex=0`，保证只有卡片列也能进。

3. **live region 播报**
   - 面板根部（与 `.ttl-toast-host` 同级）加一个视觉隐藏的 `<div role="status" aria-live="polite" aria-atomic="true">`，内容由 state 驱动，如「已移动到已完成」「已复制路径」。
   - 与现有 toast 分工：toast 是带撤销的可见反馈；live region 是给读屏的补充，**不要**把同一条消息既放 toast 又放 assertive 区域（会打断）。

4. **滚动容器可聚焦**
   - `.ttl-board-column-body` 加 `tabIndex=0`、`role="region"`、`aria-label`（如「未完成列，3 条，可滚动」）；`.ttl-board` 横向容器同理。
   - 焦点进入时用 `:focus-visible` 显示 ring，不要给 `outline: none`。

5. **窄屏断点**
   - 容器查询不可用（宿主环境未知），用 `@media (max-width: 560px)` 即可，因为中央面板宽度近似视口宽；如需更稳，可用宿主提供的容器尺寸（当前没有）→ 退化为媒体查询（推断足够）。
   - 紧凑模式用 `.ttl-board-compact` 容器类切换，避免每条规则写两遍。

6. **i18n 新增 key 草案**（必须 zh/en 成对、占位符一致、且全部被引用）：
   - `board.columnAria`（「{name}，共 {count} 条」）、`board.more`、`board.moveTo`、`board.moveToStatus`、`board.moveToProject`、`board.movedStatus`、`board.collapseGroup`、`board.expandGroup`、`board.showAll`、`board.showRecent`、`board.quickAdd`、`board.quickAddPlaceholder`、`board.searchPlaceholder`、`board.searchCount`、`board.noMatch`、`board.clearSearch`、`board.density`、`board.densityCompact`、`board.densityComfortable`、`board.timeCreatedAgo`、`board.timeCompletedAgo`、`board.emptyColumnPending`、`board.emptyColumnCompleted`、`board.emptyColumnProject`、`board.swimlaneAria`。
   - 能复用现有 key 的优先复用（`row.pending`、`row.completed`、`board.emptyColumn`），避免重复文案。

7. **测试与预览**
   - 改完跑 `node test/client-audit.mjs`（会检查 hex、类名前缀、i18n 成对/未使用、DOM 查询）。
   - 用 `docs/preview/` 的静态渲染流程补一张新看板截图（窄屏 + 暗色各一张），与 `04-board.png`、`10-dark.png`、`11-narrow.png` 对照验收。

## 附录 B：明确未采用 / 未验证的内容

- **WIP 硬限制**：GitHub 的列上限是"非阻断"的（只显示与高亮，不阻止添加）。即使未来做多阶段列，也建议抄"提示"而不是"阻断"。当前两列板不做。
- **Height / ClickUp / Plane / Focalboard**：未找到可稳定引用的一手文档，正文未引用其具体行为；它们常见的"多视图 + 泳道 + 自定义字段"能力与本文引用产品重叠，不影响结论。
- **Material Design 3 Cards 页面**：调研中抓取失败（404/timeout），未引用；卡片信息层级结论由 Linear / Notion / GitHub 的一手文档与 NN/g 支撑。
- **"卡片高度降低会提升扫读效率"的量化收益**：基于 NN/g 渐进披露原则与产品文档的定性推断，未做用户测试；建议上线后用面板内曝光/点击数据验证。**推断。**
- **动效时长 120–200ms、密度档位具体数值**：按宿主现有 token 与常见桌面应用节奏给出的建议值，**推断**，需视觉验收。
