# DSH 插件目录 / awesome 列表调研（dshplugin.dev + GitHub 收录流程）

> 调研人：market-c ｜ 日期：2026-11-06 ｜ 对象：dsh-todo-time-log v0.6.2（repo: FantasyStarry/dsh-todo-time-log）
> 方法：web_fetch 抓取各站页面 / 仓库 README 与 CONTRIBUTING / GitHub API；大文件通过 ungh.cc 镜像读取（raw.githubusercontent.com 在本会话被上游 404，已换镜像）。
> 结论一句话：**dshplugin.dev 是唯一需要"人工提交+人工审核"的大站，我们还没收录；GitHub 上体量最大的是 billLiao（已自动收录我们）与 imsai-sh/dsh-1024 目录（13,962 个，我们未收录，需 PR 一个 JSON 文件）；其余 awesome 列表多为手工 PR、数量级 350–600。**

---

## 0. 先确认的事实

- 我们的仓库**已带 `dsh-plugin` topic**（GitHub API `/repos/FantasyStarry/dsh-todo-time-log/topics` 返回：ai-agent, calendar, deepseek, deepseek-harness, dsh, dsh-plugin, dsh-plugins, gantt, harness, kanban, plugins, productivity, time-log, time-tracking, todo, todo-list）。
- 同作者另一个仓库 `FantasyStarry/dsh-token-stats` **已被 dshplugin.dev 收录**，而我们没有被收录 —— 说明"有 topic"不等于"被收录"，dshplugin.dev 的收录受人工审核与质量门控约束。
- npm：`dsh-todo-time-log@0.6.2` 正常可查（registry 200，latest=0.6.2）；`keywords:dsh-plugin` 搜索共 **12,741** 条结果，我们不在前 250 条（搜索排序按热度，非收录与否的判据）。

---

## 1. dshplugin.dev（重点）

### 数据
| 项 | 值 |
|---|---|
| 收录量 | **1,136** 个项目（首页）/ 242,534 GitHub stars / "32 updated today" |
| 性质 | 独立社区目录，**非 DeepSeek 官方**，不背书 |
| 更新频率 | 元数据定期重爬（stars / language / license / 更新时间 / 安装命令）；站点自称"Regularly refreshed" |
| 数据来源 | 公开 GitHub 仓库 + npm 包元数据 + 发布者页面；**GitHub `dsh-plugin` topic 可被自动发现**，但发现只是生成"私有候选" |
| 是否支持自定义索引 format 1 | **否**（它是网站，不是 DSH 索引源；format 1 索引见 §4） |
| 我们是否收录 | **否**。证据：`https://dshplugin.dev/?q=todo-time-log` → "0 results"；`?q=FantasyStarry` → 仅 1 条 `FantasyStarry/dsh-token-stats` |

### 收录条件（Editorial Policy，2026-08-17）
- 公开仓库、与 DSH 相关、有足够"源码证据"可评估；
- 发现（topic/npm/社区合集）只产生**私有候选**，人工审核通过后才进入 validation；validation 检查 identity、内容、license、安装证据；
- 只有"已验证、可评分"的候选能进入受控发布队列；**提交≠收录，也不承诺时间**；
- 质量清单（决定"开发者愿不愿意点进去"）：一句话价值、可复制的安装命令（profile + CLI）、可见证据（截图/演示/真实输出）、风险声明（权限/外部服务/兼容性）。

### 加入流程
1. 打开 **https://dshplugin.dev/submit**（页面：SUBMIT FOR REVIEW）；
2. 表单必填：**公开仓库根 URL**（"One repository URL is enough to start"）；
3. **邮箱为可选**（页面说明："Used only if the reviewer needs clarification. It is never sent to analytics."）——不填也能提交，但审核需要澄清时无法联系；
4. 可选：一句使用场景（helps review faster）；
5. 无需账号；提交后进入人工审核队列（"Every submission waits for an editorial decision"）；
6. 通过 → 爬虫以私有候选导入 → 校验身份/内容/license/安装证据 → 质量门控 → 发布（"No auto-publish"）；
7. 通过后可加反向徽章：`[![My plugin listed on dshplugin.dev](https://dshplugin.dev/badges/<slug>.svg)](https://dshplugin.dev/plugins/<slug>)`；slut 取自详情页 canonical URL；
8. 纠错/申诉：`contact@dshplugin.dev`（附 submission reference + 公开证据）。

### 审阅周期
- **官方未公布 SLA**；Terms 与 Submit 页均写明"submission is a request for review, not a promise of approval, publication or timing"。
- 合理预期：人工队列，**天级到数周**；无自动收录通道，topic 到位也不会自动上架（我们与 dsh-token-stats 的对比即证据）。

### 预计耗时 / 风险
- 提交动作 2–5 分钟；审核不可控，**风险=被拒或长期排期**；描述/安装命令/截图质量直接影响通过率。
- 建议：先把 README 的"一句话价值 + 安装命令 + 截图 + 风险/权限说明"补齐再提交（当前 README 已有截图与安装说明，基本达标）。

---

## 2. GitHub awesome / 索引仓库逐个核查

| 仓库 | Star | 最近推送 | 收录量 | 我们是否已列出 | 提交方式 | PR 目标文件 | 硬性要求 |
|---|---|---|---|---|---|---|---|
| **billLiao/awesome-dsh-plugin** | 16 | 2026-11-02（文件级每小时 Sync，最新 2026-11-06T08:01） | ≥21,000（分类计数：tools 6,156 / ui 7,301 / workflow 4,735 / weakly-related 1,585 / themes 603 / awesome-lists 528 / models 121 / dev-runtime 76 / fun 23；memory、notifications、security、sessions 4 个文件抓取超时未计） | **是** ✅ | PR 或 Issue（有 plugin-submission.yml 模板） | `categories/<category>.md`（本次落在 `categories/tools-capabilities.md`） | 仓库带 `dsh-plugin` topic；声明 `dsh.bundle` manifest；条目格式 `- [owner/repo](url) — 描述` |
| **fuyiyun666/awesome-dsh-plugin-2** | 0 | 2026-11-03（创建于 2026-11-03，很新） | 504 | 否 | PR（有 pull_request_template.md） | **同时**改 `README.md`（中文）与 `README.en.md`（英文），对应分类各加一行 | `package.json` 必须有 **`dsh.bundle`**（只有 `dsh.client` 装不上）；仓库带 `dsh-plugin` topic；推荐发 npm、官方 `@deepseek-ai/*` 用 peerDependencies |
| **beancookie/awesome-dsh-plugin**（同类原版） | 187 | 2026-11-03 | 504（结构与 fuyiyun666 文件列表几乎逐字节一致） | 否 | 同上 | `README.md` + `README.en.md` | 同上（`dsh.bundle` + topic） |
| **dongsheng123132/awesome-dsh-plugins-1** | 0 | 2026-11-03（创建 2026-11-03） | 353+（14 类，`plugins/*.md` + `INDEX.md` + `data/`，有 sync.yml 自动同步 CI） | 否 | PR（有 add-plugin.yml issue 模板） | `plugins/<分类>.md`（我们应放 tools / workflow-automation / context-memory 之一） | 真 DSH 插件，可 `dsh plugin add` 或 `.dsh-plugin`/`dsh.plugin.json` 安装；公开 repo、有 README、有可运行代码；条目 `- [插件名](https://github.com/owner/repo) — 一句话描述` |
| **shutongX/dsh-plugins-index** | 0 | 2026-10-30 | 4–5 个（仅本人插件），format 1 `index.json` | 否（且**不开放第三方**） | 不适用（自有索引，Action 每日刷新） | — | 校验器 `@deepseek-ai/dsh-plugin-market-index`；作为"自建 format 1 索引"的参考实现 |
| **vlln/plugin-registry** | 59 | 2026-11-03 | 9–10 个（自有 @vlln/* + omdsh-dev），format 1 `index.json` | 否（**不开放第三方**） | 不适用 | — | 同上；README 给的是"把索引源加进 DSH 发现页"的用法 |

### 其他搜索到的目录（体量更大，值得跟进）
| 来源 | 规模 | 我们是否已列出 | 收录方式 / 状态 |
|---|---|---|---|
| **imsai-sh/awesome-deepseek-harness-plugins**（deepseek1024.com） | **13,962**（README 2026-11-06，topic 自动发现 + PR） | **否**（`catalog/plugins/fantasystarry--dsh-todo-time-log.json` → 404；README 内无命中） | PR **只加一个文件** `catalog/plugins/<owner>--<repo>.json`（id=`owner/repo`，category 取 `catalog/categories.json`，必须双语 description，`added`=提交日期，**不得改其他路径**）；有 PULL_REQUEST_TEMPLATE + plugin-review.yml / catalog-sync.yml。要求 `package.json` 有非空 `dsh.bundle.patch` 且 patch 文件已提交；发布到 npm 才会显示安装命令（未发布的仍可 browse-only 收录） |
| **bruc3van/awesome-dsh-plugin**（safer-dsh-market 数据源） | 497★，catalog 约 1,575 文件 / 每日抓 topic + 人工复核 | 否（`catalog/utilities.md`、`MARKET.md`、`data/curated.json`、`data/review/pending.md` 均无命中） | 收录标准：公开 + `dsh-plugin` topic + **必须有 GitHub description** + 必须是真插件（不是目录站）。**作者自荐区要求 stars > 10**（我们 ⭐1 会被 CI 拒绝），PR 追加到 `SHOWCASE.md` 中英两个列表末尾，最多 30 条 FIFO |
| **usertianziyang/DSH-Plugin-Hub** | 1★，React 站，GitHub Search API 每 6h 同步，`public/plugins.json` 19MB | 大概率自动包含（数据文件过大未逐条验证） | 无需 PR，自动同步 |
| **Anil-matcha/awesome-dsh-plugin** | 15★，最后推送 2026-09-17，单 README 82KB | 否 | 低活跃，价值有限 |
| **dshbase.com** | **20,035** 插件（GitHub topic + dsh.so 合并，更新于 2026-10-16；7,857 已验证 L1–L4） | 未确认 | 有自己的目录插件 `dshbase-catalog`；实测型验证站，适合作为"验证背书"渠道 |
| **dsh.so** | 独立信任/发现注册表，L1–L5 实测 + 安全扫描；提供自定义索引源 `https://cdn.dsh.so/market/index.json`、`top-rank.json` | 未确认 | 通过其索引源接入 DSH，不是 PR 式收录 |
| Victor-770/dsh-plugin-directory | — | — | **404（仓库已删除或改名）** |

---

## 3. 关键洞察

1. **topic 是必要不充分条件**：`dsh-plugin` topic 只保证"能被抓取"。dshplugin.dev 人工审核、bruc3van 要求 stars>10 与 description、imsai 要求 `dsh.bundle.patch` 与单一 JSON 文件，各有额外门槛。
2. **自动 vs 手工两条赛道**：billLiao 是自动同步（我们已进，且条目带 ⭐1 与完整中文描述）；其余 13k/504/353 级目录都要 PR。
3. **两个"自有索引"仓库（shutongX、vlln）不接外部插件**，但示范了 format 1 `index.json`：DSH → 插件 → 实验性插件 → 开启「自定义插件市场/索引」→ 发现 → 添加索引源。**我们也可以自建 format 1 索引**，无需任何审核；校验器 `@deepseek-ai/dsh-plugin-market-index`。
4. **镜像仓库**：fuyiyun666/awesome-dsh-plugin-2 与 beancookie/awesome-dsh-plugin 内容几乎相同（后者 187★ 为原版，前者 0★ 新建于 2026-11-03）——PR 应优先投原版，或两边都投。
5. **数量级参考**：dshplugin.dev 1,136（严选）＜ dongsheng 353 ＜ fuyiyun/beancookie 504 ＜ imsai 13,962 ＜ billLiao ≥21k ＜ dshbase 20,035（含合并）→ 真正"插件数量多"的入口是 **imsai/deepseek1024、billLiao、bruc3van、dshbase/dsh.so**。

---

## 4. 是否支持"自定义索引 format 1"

- dshplugin.dev：**不支持**（纯网站）。
- GitHub 上确有 format 1 索引生态：shutongX/dsh-plugins-index、vlln/plugin-registry、dsh.so（`/market/index.json` + `top-rank.json`）。格式由 `@deepseek-ai/dsh-plugin-market-index` 校验，DSH 端在「插件 → 实验性插件 → 更多 → 开启自定义插件市场 → 发现 → 添加索引源」使用。
- 对我们的意义：可以先自建 `index.json`（我们只有一个包，最小索引即可），再把该 URL 提交给聚合方；比逐个 PR 更可控，且是官方支持的"自带市场"路径。

---

## 5. 可直接执行的下一步（按性价比排序）

1. **dshplugin.dev 提交（最高价值，1 次表单）**
   - 打开 https://dshplugin.dev/submit
   - 仓库 URL 填 `https://github.com/FantasyStarry/dsh-todo-time-log`
   - 邮箱建议填（仅审核澄清用，不进分析）；使用场景一句话：如"待办管理同时自动记录创建/完成时间，四视图（表格/看板/甘特/日历）呈现真实耗时"
   - 提交前自查其质量清单：一句话价值 / 安装命令（`dsh plugin --profile web add dsh-todo-time-log` 之类）/ 截图 / 权限与兼容性 → 目前 README 已具备
   - 预期：无 SLA，天级～数周；被拒可用 contact@dshplugin.dev 申诉
2. **imsai-sh / deepseek1024（13,962，最大目录）**
   - 新建文件 `catalog/plugins/fantasystarry--dsh-todo-time-log.json`，内容照抄 CONTRIBUTING 的仓库级示例（id=`FantasyStarry/dsh-todo-time-log`、category 从 `catalog/categories.json` 选 tools 或 workflow、en/zh 双语描述、added=提交日）
   - 只提交这一个文件，不改 README/scripts/workflows → 开 PR
3. **dongsheng123132/awesome-dsh-plugins-1（353+）**
   - 在 `plugins/tools.md` 或 `plugins/workflow-automation.md` 末尾加一行：`- [dsh-todo-time-log](https://github.com/FantasyStarry/dsh-todo-time-log) — 待办 + 创建/完成时间自动记录，四视图（表格/看板/甘特/日历）呈现真实耗时`
   - 开 PR（可引用其 add-plugin.yml 模板）
4. **beancookie/awesome-dsh-plugin（187★，原版）与 fuyiyun666/awesome-dsh-plugin-2（镜像）**
   - 在 `README.md` 与 `README.en.md` 对应分类（工具/效率）**各加一行**；确认 `package.json` 有 `dsh.bundle`（我们已有 `dsh.bundle.patch`，需确认字段名就是 `dsh.bundle`）
5. **bruc3van/awesome-dsh-plugin（497★）**：暂不投自荐（需 stars>10，我们 ⭐1）；先把 star 做上去，再 PR `SHOWCASE.md`
6. **billLiao**：已在列；如判断分类应属 workflow，可提 Issue 让其调整（数据每小时自动同步，条目会被保留/刷新）
7. **可选**：自建 format 1 `index.json`（参考 shutongX 的最小结构），托管到 GitHub Pages 或 raw，作为"自定义索引源"分发；同时提交给 dsh.so / dshbase 类聚合站

---

## 6. 风险与注意

- **审核不可控**：dshplugin.dev / bruc3van / imsai 都是人工或半人工门控，拒收无明确理由，时间不可预期。
- **自动同步可能覆盖手工改动**：billLiao、dongsheng、imsai 的 README/INDEX 由机器人生成，**不要手改生成文件**，只改源文件（billLiao: categories/*.md；imsai: catalog/plugins/*.json；dongsheng: plugins/*.md）。
- **分类选错会被维护者挪动**：todo/时间记录类可归 tools、workflow-automation 或 context-memory，优先 tools。
- **镜像站低价值**：fuyiyun666 为 0★ 镜像，合并 PR 的收益低；优先原版 beancookie。
- **数据时效**：dshbase 数据更新于 2026-10-16、dshplugin.dev 的 dsh-token-stats 显示 "Updated 2mo ago"，说明各站抓取节奏差异大，收录后不应期待秒级同步。
- 本会话中 raw.githubusercontent.com / jsdelivr / githack 均返回 404（上游限制），全部改用 GitHub 页面渲染与 ungh.cc 镜像读取；若后续需要精确文件内容，建议用 `gh api` 或本地克隆。

---

## 附录：证据摘录

- dshplugin.dev 搜索：`?q=todo-time-log` → "Results for 'todo-time-log' 0 results"；`?q=FantasyStarry` → 1 result（FantasyStarry/dsh-token-stats）。
- billLiao 条目原文（categories/tools-capabilities.md）：
  `- [FantasyStarry/dsh-todo-time-log](https://github.com/FantasyStarry/dsh-todo-time-log) ⭐1 — DeepSeek Harness 待办插件：自动记录每条待办的创建与完成时间，用表格 / 看板 / 甘特图 / 日历四视图呈现真实耗时；支持分类、优先级、类型、@工作区文件与 todo_time_log 智能体工具。`
- dshplugin.dev /submit 关键句："No account — One repository URL is enough to start." / "Human review — Every submission waits for an editorial decision." / "No auto-publish — Approval creates a private candidate first."
- dshplugin.dev 邮箱说明："Used only if the reviewer needs clarification. It is never sent to analytics."
- Terms："A submission is a request for review, not a promise of approval, publication or timing."
- GitHub topics API 返回含 `dsh-plugin`：已确认（见 §0）。
