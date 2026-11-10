# dsh.so 与 dshbase.com 审核型市场调研（task-2 / market-b）

> 调研时间：2026-11-06 10:20–10:50（Asia/Shanghai）
> 对象插件：`dsh-todo-time-log` v0.6.2（npm 最新版发布于 2026-11-03 08:57 +08，2026-11-06 01:40 更新 0.6.2）
> 仓库：https://github.com/FantasyStarry/dsh-todo-time-log（created 2026-11-03 07:45，pushed 2026-11-06 01:38，topic 含 `dsh-plugin`）
> 本文件只做只读调研结论；未执行任何 git push / PR / npm publish。

## 0. 一句话结论

| 站点 | 性质 | 规模（实测） | 我们的收录状态 | 加入方式 | 预计耗时 |
|---|---|---|---|---|---|
| **www.dsh.so** | 安装验证（L1–L5）+ 安全审计的索引市场，可作 dsh「自定义索引源」 | 市场索引 **10,970** 条；全量注册表 **28,597** 条；sitemap 57,154 页 | **未收录**（市场索引与全量注册表均 0 命中） | ① 加 `dsh-plugin` topic 自动抓取（滞后数天）；② `/submit/` 粘贴仓库/包名检查后提交，生成 issue 给维护者合并（**无需登录/账号**） | 自动 2–5 天；主动提交后 L4/L5 复核 1–3 天 |
| **dshbase.com** | 第三方插件目录（L1–L3/L4 CDP 自测），另有 `dshbase-catalog` 插件 | **20,035** 条（其中 verified 7,857） | **未收录**（search-index.json 20,035 条全查无 `todo-time-log` / `FantasyStarry`） | **不自动收录**：GitHub Issue 表单提交（ylwl1997/dshbase，plugin-submission.yml） | 提交 5 分钟；收录 1–2 天（维护者手工 ingest） |

**优先级建议：dsh.so 立刻主动提交（它是 dsh Discover 可直接消费的索引源，曝光价值最大）；dshbase 用 5 分钟开个 issue 顺带收。两者都不要等自动抓取。**

---

## 1. www.dsh.so —— 安装验证 + 安全审计市场

### 1.1 数据面（全部实测）

- 市场索引（任务指定的那个 JSON）：`https://cdn.dsh.so/market/index.json`
  - `format: 1`（**支持 format 1 自定义索引**，可直接加进 dsh「插件 → 发现 → 添加索引源」）
  - 体积 **8,031,109 字节**（7.66 MiB），**10,970** 个条目
  - 响应头：`Last-Modified: Fri, 06 Nov 2026 02:24:48 GMT`、`Cache-Control: public, max-age=300, s-maxage=3600, stale-while-revalidate=86400`（Cloudflare，**每天/每次部署重建，CDN 1 小时级刷新**）
  - 结构：`format / title{en,zh} / description{en,zh} / metadata{categories,labels,sortKeys} / plugins[]`
  - 每条：`name / title / description / author / repository.url / metadata{category,keywords,labels,sortKeys{stars,downloads}} / versions[]`；**每个插件只保留 1 个版本条目**（10,970 条目 = 10,970 个 version 对象，只记最新版 + publishTimestamp + source + engines.dsh）
  - 分类 10 个：agents / creator / dev / memory / notify / office / search / skin / tools / vision（实测分布：tools 1774、memory 1696、skin 1374、search 1171、office 595…）
  - labels 全集：`install-verified`、`risk-low`、`stars-*`、`star-gain-*`、`npm-total-*`、`npm-week-*`
  - **10,970/10,970 全部带 `install-verified` + `risk-low`**（这是硬过滤，不是标签装饰）
  - 版本时间戳范围 2026-08-13 → 2026-11-04；最近 7 天新增/更新的 version 记录 1,806 条，30 天 5,553 条 → 索引活跃
- 第二份精品索引：`https://cdn.dsh.so/market/top-rank.json`（901 KB，约 1,200 条，六榜前 200 合并去重）
- 全量注册表检索源：`https://cdn.dsh.so/plugins-index.json`
  - `count: 28,597`，`generated: 2026-11-05`，`generatedAt: 2026-11-05T02:06:51Z`
  - 6,084 条带 `source`（GitHub 仓库 URL），27,055 条带 `install` 命令
  - kind 分布：普通插件 22,513 / ecosystem-plugin 4,542 / ecosystem-app 1,542
- 站点自述口径（/verification/，data as of 2026-11-06）：带验证记录 28,158 个；L4 安装实测 pass 15,161 / fail 56；L5 运行实测 pass 9,616 / fail 2,454；stale 10,036 个；pass rate 79.3%
- 安全面（/security/）：静态扫描 25,102 个（pending 334）；风险分布 low 23,686 / medium 1,093 / high 305 / critical 18；动态模型审计 2,899 入队、2,294 有结论、2,294 生效（323 更严 / 790 更宽）
- SEO 体量：`https://www.dsh.so/sitemap.xml` 有 **57,154** 个 `<loc>`（每个插件一个 /artifact/<id>/ 落地页）

### 1.2 我们的收录状态：**未收录（双证据）**

1) 市场索引 `cdn.dsh.so/market/index.json`（10,970 条）：
   - 按 `name` 与全文检索 `todo-time-log` / `FantasyStarry` → **0 命中**
   - 同类竞品都在：`dsh-todo-list`、`dsh-todos`、`dsh-todo-float-ball`、`dsh-todo-reminder` 均存在（`dsh-todo-list` 条目：`versions[0].version=1.4.0`、labels `install-verified/risk-low/stars-1-4/npm-total-1k-10k/npm-week-10-100`）
   - 索引里 `todo` 相关插件 27 个、描述含 todo 的 55 个 —— **赛道已经很挤，但没有我们**
2) 全量注册表 `cdn.dsh.so/plugins-index.json`（28,597 条）：按 `id` / `alias` / `name` / `source` / `author` 检索 `dsh-todo-time-log`、`FantasyStarry` → **0 命中**
3) 单插件 API 也 404（证明不是"有记录但被过滤"）：
   - `https://www.dsh.so/artifact/dsh-todo-time-log.json` → 404
   - `https://www.dsh.so/plugin/dsh-todo-time-log.json` → 404
   - `https://www.dsh.so/data/install/dsh-todo-time-log.json` → 404
4) **反面证据（重要）**：同一作者的 `dsh-token-stats` **已收录**在注册表里：
   ```json
   {"id":"dsh-token-stats-2","alias":"@FantasyStarry/dsh-token-stats","kind":"ecosystem-plugin",
    "verification":{"level":5,"label":"L5 · Ecosystem plugin"},"security":{"status":"audited","riskLevel":"low"},
    "install":"dsh plugin --profile web add github:FantasyStarry/dsh-token-stats#v0.10.0"}
   ```
   → 说明"作者级抓取"是通的，我们缺的是**新仓库还没被这一轮爬取覆盖**。注意它**不在** market/index.json 里，因为它是 `ecosystem-plugin`（装得上但不挂载能力）。
   **风险提示：如果我们的 `dsh.bundle.patch` 在沙箱里挂载失败，会被归到 ecosystem-plugin，从而永远进不了 market/index.json（哪怕 L5 pass）。**

### 1.3 是否会自动按 `dsh-plugin` topic 收录？——**会，但慢，不能只等**

- 官方明确写了自动索引：`/submit/` 页原文 "adding the `dsh-plugin` or `dsh-pack` topic lets the registry auto-index your repository"。
- 但实测**抓取严重滞后**（用 GitHub API 取 topic:dsh-plugin 按创建日期倒序 100 个仓库，逐个去 28,597 条注册表里按仓库名/npm id 匹配）：

  | 仓库创建日 | 抽样数 | 已在 dsh.so 注册表 |
  |---|---|---|
  | 2026-10-25 ~ 10-31 | 93 | **92** |
  | 2026-11-01 | 26 | 21 |
  | 2026-11-02 | 24 | 18 |
  | 2026-11-03（我们这天） | 23 | **2** |
  | 2026-11-04 | 23 | **4** |
  | 2026-11-05 | 10 | **2** |

  即：10 月底的仓库基本 100% 覆盖，**11-03 之后断崖式掉到 ~10–20%** → 抓取批次的前沿在 **2026-11-02 前后**，我们（11-03 07:45 创建）正好卡在还没被扫到的一侧。
- 每日"新收录"量也极小（`/security-reports/daily/` 每日报告 = 当天首次被索引的插件数）：11-03 **0 个**、11-04 **4 个**、11-05 **0 个**。同时 GitHub 上 11-01 之后新建的 dsh-plugin 仓库有 **1,912** 个 → 自动抓取远远追不上新增速度。
- 结论：**topic 自动收录存在，但按当前速率不能依赖**；主动提交会把源码/包在提交时"重新抓取 + 重新扫描（不用缓存）"，是唯一可控的加速手段。

### 1.4 提交入口与表单工作方式

- 入口：**https://www.dsh.so/submit/**（中文：https://www.dsh.so/zh/submit/）
- 是否需要登录/邮箱：**不需要**。站点自述 "No accounts, payments, transactions, or ratings"（/about/），提交是匿名表单，无需注册、无需邮箱验证；限流为 **按 IP + 按仓库，每 10 分钟数次**。
- 表单流程（原文 "What happens next"）：
  1. 在输入框粘贴 **仓库地址**（`github.com/owner/repo` / `gitee.com/...` / `owner/repo`）**或 npm 包名**（`dsh-foo` / `@scope/dsh-foo` / npmjs.com 链接），渠道自动识别；
  2. 检查器拉取源码（npm 包走**已发布 tarball**）、校验格式、跑安全扫描（vet AST 分析 JS/TS + shell/PowerShell 下载执行模式；其他语言 dsh 启发式兜底），生成一份 schema 合规的收录条目预览；
  3. 点 **"Submit to dsh.so"** → 条目 + 扫描报告以 **issue 形式落到 dsh.so 后台**供人工审核；
  4. 维护者把 schema 合规的条目**合并**进注册表（人工 merge，不是即时生效）；
  5. 之后 L4/L5 安装验证流水线自动排队（见 1.5），通过后才会出现在 market/index.json。
- **重要口径**：提交只保证 "Declared（声明）兼容"；"Verified（已验证）"只能靠独立实测数据产生。我们这种 web-only 客户端插件，L5 要求 "dsh web 起得来 + HTTP 有响应 + 插件清单里 active"。
- 官方联系/社区：`hello@dsh.so`、Discord `https://discord.gg/6zxCeTNzfC`、DSH 官方 Discussions。
- ⚠️ 首页脚注里的 `https://github.com/ihuajiu/dsh-plugin-submissions` **已 404**（别按这个地址开 issue）；站内实际只有 `/submit/` 表单 + Discussions 报兼容性实测。

### 1.5 收录/取舍规则（硬性要求，逐条对照我们）

/submit/ "Acceptance criteria" 原文要求：

| 要求 | 我们的现状 | 判定 |
|---|---|---|
| DSH 兼容信号至少其一：`dsh` 字段 / cordis·agent.cordis manifest / `dsh.plugin.*` / topic `dsh-plugin` 或 `dsh-pack` | package.json 有 `dsh.bundle.patch` + `dsh.client`；topic 有 `dsh-plugin` | ✅ |
| README 带安装说明 | 仓库有 | ✅（建议再核对 "dsh plugin --profile web add dsh-todo-time-log" 字样） |
| 开源许可证 + SPDX 可识别 | MIT | ✅ |
| 插件 id 合规 `^[a-z0-9]+(-[a-z0-9]+)*$` | `dsh-todo-time-log` | ✅ |
| 源码可被扫描（JS/TS/脚本） | `lib/` 编译产物 + 源码 | ✅ |
| 安全扫描无阻断级发现（硬编码密钥、数据外传端点、破坏性操作、挖矿）；warning 级需人工复核 | 需实测（本地无密钥/无外传即安全） | ⚠️ 待验证 |
| （市场索引额外）L4/L5 安装验证通过 + 安全结论 **low** | 未测 | ⚠️ 待验证 |

### 1.6 复测频率 & 会不会掉出索引

- **L4/L5 判定是"版本作用域"的**：每条 verdict 绑定当时的 dsh 版本；dsh 升级后旧 verdict **保留为 stale（不会被覆盖/删除）**，并由 ladder sweep **自动重新排队**（/verification/ "Rules"）。
- **market/index.json 的取舍（2026-10-27 起）**：接受 **stale 的 L4/L5 pass**（"a pass recorded on an earlier dsh release counts too… only a real failure on the current version" 会取消收录）；"unknown / not tested" 不算失败。→ **不复测不会自动掉出**，只有"当前版本真实失败"才会掉。
- **安全侧每天复扫**：`/security-reports/daily/` 每日 01:10 北京时间（17:10 UTC）生成，"plugins first indexed that day"；周报归档在 `/security-reports/2026-W45/`。**风险结论升到 medium/high/critical 会立刻被 market/index.json 过滤掉（索引只收 risk-low）**——这是比"复测"更现实的掉出风险。
- 元数据（stars/forks/last commit）从 GitHub API 自动同步，不需要我们做事。

### 1.7 我们可直接执行的下一步（dsh.so）

1. **【10 分钟】主动提交**（推荐，能立刻进入人工审核队列）：
   打开 https://www.dsh.so/submit/ → 粘贴 `FantasyStarry/dsh-todo-time-log`（或 npm `dsh-todo-time-log`）→ 看检查器结果 → 点 Submit。
2. **【提交前 1 分钟自检】**：确认仓库 README 含安装命令、LICENSE=MIT 在根目录、npm 0.6.2 是当前要收录的版本（检查器扫的是 tarball，不是 workspace）。
3. **【提交后】等 L4/L5 流水线**：可轮询是否已进注册表/市场索引：
   ```powershell
   # 是否进入全量注册表（28,597 条）
   (Invoke-RestMethod https://cdn.dsh.so/plugins-index.json).plugins |
     Where-Object { $_.id -eq 'dsh-todo-time-log' -or $_.alias -like '*dsh-todo-time-log*' } |
     ConvertTo-Json -Depth 6
   # 是否进入安装验证市场索引（10,970 条，format 1）
   (Invoke-RestMethod https://cdn.dsh.so/market/index.json).plugins |
     Where-Object { $_.name -eq 'dsh-todo-time-log' } | ConvertTo-Json -Depth 6
   ```
4. **【防呆】确保是"插件"而不是"生态插件"**：本地跑一次 `dsh plugin --profile web add dsh-todo-time-log`，确认 `dsh web` 起来后插件清单里 active（L5 smoke 就是查这个）；否则会被标成 `L5 · Ecosystem plugin`，永不进 market/index.json。
5. 首次进索引后，如需人工修正（版本/描述/分类/风险申诉）：`hello@dsh.so` 或 /feedback/。

---

## 2. dshbase.com —— 第三方插件目录（手工收录为主）

### 2.1 数据面（实测）

- 首页 / 目录：https://dshbase.com/plugins/directory/
- 规模：**20,035** 条 listings / 15 个分类 / 20,026 个仓库；其中 **verified 7,857**、pending 10,666、listed（仅收录未测）1,512、**389 on npm**
- "Verified" 口径（/audit/）：L1 install（干净 profile + 固定 DSH 运行时）→ L2 load（profile 起得来、config dump 成功）→ L3 headless（无头问答跑通）；**web-only 插件必须过 L4 web CDP**（起 web profile + 浏览器 CDP 问答）才算 verified。当前 Web L4 verified 738 个 / 待 L4 0 个。
- 数据快照：目录页 / 审计页都写 **"Data current as of 2026-10-16"**（距调研日约 3 周）；分类分布 Developer 8129、UI & Skins 2901、AI Models 2157、Knowledge 1182…
- 数据来源自述："GitHub dsh-plugin topic + **dsh.so catalog** merge" → **与 dsh.so 有数据血缘，但不是同一家运营方**。
- 增长曲线（目录页 Growth，聚合成批导入）：08-12 8 个 → 08-15 1094 → 08-25 7788 → **10-09 7,819 → 10-14 18,501** → 当前 20,035。
- 另发一个 npm 插件 `dshbase-catalog`（latest 0.3.62，最后发布 2026-10-26，描述 "search, list, and get install commands for 1700+ plugins"），装了以后由 agent 在目录里搜/装插件。
- SEO 体量：`https://dshbase.com/sitemap.xml` 只有 **10 个** `<loc>`（单页目录 + 少量专题页）→ 单插件落地页基本没有被搜索引擎收录的入口。

### 2.2 我们的收录状态：**未收录（确定性证据）**

- 站点用 `/search-index.json` 做 ⌘K 全站搜索（11.9 MB，20,035 条 plugins）：**全文不含 `todo-time-log`、不含 `FantasyStarry`**（两者均 false）。
- 目录页 HTML（293 KB）同样 0 命中；`/plugins/dsh-todo-time-log/` 无对应页面。
- 对照：**同作者的 `dsh-token-stats` 在 dshbase 里（true）**——因为它在 10-16 批量快照之前就存在；我们 11-03 才建仓，**晚于快照**。
- 结论：**dshbase 不自动收录**（快照冻结在 10-16，之后的新插件只能靠人工 ingest）。而它的 search-index 又确实包含 11-05 新 ingest 的条目（`dsh-memory-sync`、`dsh-plugin-sessiongraph` 均 true）→ **索引是活的，缺的就是"我们被提交"这一步**。

### 2.3 收录方式（GitHub Issue 表单）

- 入口（目录页 "Submit your plugin →" 按钮的真实 href）：
  **https://github.com/ylwl1997/dshbase/issues/new?template=plugin-submission.yml**
- 仓库：`ylwl1997/dshbase`（created 2026-08-14，pushed 2026-11-05 23:38，1 star，open issues 7，非常活跃：几乎每天有 "chore: daily security scan"、"chore: daily plugin compat check"、以及社区提交 ingest 的 PR）
- 表单字段（.github/ISSUE_TEMPLATE/plugin-submission.yml 原文）：
  - `name` 插件名（npm 包名或仓库名）**必填**
  - `repo` GitHub 仓库完整地址 **必填**
  - `npm` npm 包名（可选）
  - `desc` 一句话功能描述 **必填**
  - `category` 分类下拉（15 选 1）**必填** —— 我们选 `Productivity（效率）`
  - `needs` 是否需要外部账号/服务 **必填** —— 我们选 `否，开箱即用`
  - `needs_desc` 选了"是"时填
  - `checklist`：仓库已加 `dsh-plugin` topic / 带 `dsh.bundle` 清单（cordis.patch.yml）/ 仓库有 LICENSE —— **我们三项全满足**
- 处理时效：维护者手工 ingest，且有 issue 自动回复/关闭流程，实例证据：11-05 04:06 一次合入 #237/#251/#252/#253 四个社区插件；11-05 23:33 合入 #262 `dsh-memory-sync` 并 bump #263 到 1.7.1 → **当天/次日入库**。
- 注意（可信度扣分项）：其 commit message 明确写 "New rows are **Verified on intake without a marketplace L1–L4 run**" → 手工进目录的条目会先给 `Verified`，不是真跑过 L1–L4；这也解释了 search-index 里 pending 10,666 / verified 7,857 的结构。

---

## 3. 两站对比与评估（规模 / 可信度 / 对 SEO 与曝光的作用）

| 维度 | dsh.so | dshbase.com |
|---|---|---|
| 收录总量 | 注册表 28,597；安装验证市场 10,970；精品榜 ~1,200 | 20,035（verified 7,857 / pending 10,666 / listed 1,512） |
| 数据新鲜度 | **高**：注册表生成 2026-11-05，market/index.json Last-Modified 2026-11-06，安全每日扫、周报归档 | **低**：目录/审计数据快照 2026-10-16（约 3 周），之后靠人工 ingest 增量 |
| 信任机制 | 公开 L1–L5 分级 + 每版本 verdict + stale 规则 + 静态扫描 + 模型动态审计（结论权威）+ 每日/周安全报告；索引硬过滤 install-verified + risk-low | 自测 L1–L3（web-only 加 L4 CDP）+ 三查（source/ecosystem/metadata）+ pending 透明列表；但手工 ingest 会"Verified on intake"，证据强度弱 |
| 分发/曝光通路 | **可被 dsh 直接消费**（format 1 索引源 → Plugins → Discover，两个索引可同时加）；每插件有 /artifact/ 落地页（sitemap 57,154 页）；另有 data API 8 个（CC BY 4.0、无 key、CORS）供 agent/工具拉取 | 目录页 + blog/教程引流；单页 SEO（sitemap 仅 10 条）；通过 `dshbase-catalog` npm 插件让 agent 在目录里检索安装（最后发布 2026-10-26） |
| 对"我们插件"的价值 | **主战场**：进 market/index.json = 在 DSH Discover 里可搜可装，是真正的安装转化入口；同时 L5 + risk-low 徽章是外部可引用的信任背书 | **补充库存**：多一个第三方目录站的反向链接/收录，5 分钟成本；SEO 收益有限 |
| 风险 | ① 自动抓取滞后（我们 11-03 建仓至今未收录）；② 若被判 ecosystem-plugin 则永不进市场索引；③ 安全动态审计若把风险抬到 medium+ 会被索引剔除；④ 提交限流、人工 merge 不可控 | ① 数据 3 周未刷新，收录后也可能长期无更新；② "verified on intake" 让徽章含金量低；③ 单点维护者（个人仓库）可持续性风险 |

---

## 4. 建议动作（按 ROI 排序）

1. **P0 · dsh.so 主动提交**（今天）：https://www.dsh.so/submit/ 粘贴 `FantasyStarry/dsh-todo-time-log`，检查器通过即 Submit。**不需要登录/邮箱**。预计 1–3 个工作日进注册表；L4/L5 通过且低风险后进入 market/index.json（10,970 条那个）。
2. **P0 · 提交前确认"能挂载"**：`dsh plugin --profile web add dsh-todo-time-log` → 起 `dsh web` → 插件清单 active。避免被打成 ecosystem-plugin 而进不了市场索引。
3. **P1 · dshbase 开 issue**（5 分钟）：https://github.com/ylwl1997/dshbase/issues/new?template=plugin-submission.yml ，填 name=`dsh-todo-time-log`、repo=`https://github.com/FantasyStarry/dsh-todo-time-log`、npm=`dsh-todo-time-log`、desc=一句话（中文即可）、category=`Productivity（效率）`、needs=`否，开箱即用`、checklist 三项全勾。预计 1–2 天入库（入库后它在目录页给 `dsh plugin add` 安装命令 + 反向链接）。
4. **P2 · 并行等自动抓取**：topic `dsh-plugin` 已在仓库上，无需再动；用 1.7 的第 3 条命令轮询即可。
5. **P3 · 收录后可做的增益**：dsh.so 的 /feedback/ 或 `hello@dsh.so` 申请分类纠正（我们要进 `tools`/效率类而不是 `memory`，参考同赛道 `dsh-todo-list` 被归到 memory，可申诉）；dshbase 收录后关注其 daily compat check 是否把我们的版本推进去。

---

## 5. 附：本次采集的关键命令与文件

```powershell
# dsh.so 市场索引（format 1，~8MB，10,970 条）
Invoke-WebRequest https://cdn.dsh.so/market/index.json -OutFile $env:TEMP\dshso-index.json
# dsh.so 全量注册表（28,597 条）
Invoke-WebRequest https://cdn.dsh.so/plugins-index.json -OutFile $env:TEMP\dshso-plugins-index.json
# dshbase 全站搜索数据（20,035 条）
Invoke-WebRequest https://dshbase.com/search-index.json -OutFile $env:TEMP\dshbase-search-index.json
# 我们的单插件探测（均为 404 = 未被收录）
# https://www.dsh.so/artifact/dsh-todo-time-log.json
# https://www.dsh.so/plugin/dsh-todo-time-log.json
# https://www.dsh.so/data/install/dsh-todo-time-log.json
```

关键页面清单：
- dsh.so 提交：https://www.dsh.so/submit/ ｜中文：https://www.dsh.so/zh/submit/
- dsh.so 收录标准：https://www.dsh.so/submit/ （Acceptance criteria）｜验证阶梯：https://www.dsh.so/verification/
- dsh.so 安全审计：https://www.dsh.so/security/ ｜数据 API：https://www.dsh.so/data/ ｜日/周报告：https://www.dsh.so/security-reports/
- dsh.so 自定义索引接入教程：https://www.dsh.so/news/dsh-plugin-market-index-guide/
- dshbase 目录：https://dshbase.com/plugins/directory/ ｜审计口径：https://dshbase.com/audit/ ｜提交：https://github.com/ylwl1997/dshbase/issues/new?template=plugin-submission.yml ｜邮箱：hello@dshbase.com
