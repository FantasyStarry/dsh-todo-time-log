# DSH 插件市场调研：dshmarket.com 与 dshmp.com 收录机制

> 调研对象：`dsh-todo-time-log` v0.6.2（npm 0.6.2，2026-11-06T01:40:15Z 发布）
> 调研时间：2026-11-06 10:20–10:40（Asia/Shanghai）= 2026-11-06 02:20–02:40 UTC
> 范围：只读调研。未执行 git push / PR / npm publish，未修改仓库源码。

## 0. 结论速览

| 平台 | 规模（2026-11-06 快照） | 收录方式 | 我们是否已被收录 | 需要做什么 | 预计耗时 |
| --- | --- | --- | --- | --- | --- |
| **dshmarket.com**（dsh-market 插件 + awesome-dsh-plugin 目录） | 全量目录 **9111** 条；format-1 索引 **4569** 条（npm 可安装子集）；官网文案 8879 | **人工 PR**（向 awesome-dsh-plugin 仓库加 1 个 YAML 文件），**不读 npm keyword 自动收录** | ❌ **未收录**（三处证据均为 0 命中） | 提交 1 个 YAML 的 PR；合并后 1 天内站点/索引自动重建 | 准备 0.5–1 h；合并中位约 1.7 h（近期 30 个已合并 PR），总计约 0.5–2 天 |
| **dshmp.com** | **9647** 条，其中 **9552** 条 Verified、6489 条含 Web UI、7320 条含公开源码；每日 02:00 UTC 刷新 | **npm keyword `dsh-plugin` 每日抓取 + `dsh.bundle` manifest 自动校验**，无表单、无账号、无人工审核 | ✅ **已收录并 Verified**（v0.6.2，发布后当天 02:11 UTC 即入索引）；官方 publish check 判定 **QUALIFIED** | **无需操作**；保持 keywords 与 `repository` 字段即可随版本自动更新 | 已完成 |

**一句话建议**：dshmp.com 侧已经“自动完成”，唯一要动手的是 dshmarket（awesome-dsh-plugin）这条人工 PR。它同时也是 DSH 内可用的 format-1 索引源，价值最高。

---

## 1. dshmarket.com（DSH 可视化插件市场）

### 1.1 是什么 / 规模

- 站点：<https://dshmarket.com>（市场 UI，插件 npm 包 `dshmarket`，最新 1.73.12）。
- 目录数据源：<https://awesome-dsh-plugin.com>，GitHub 仓库 <https://github.com/awesome-dsh-plugin/awesome-dsh-plugin>（22.8k stars，main 分支，2026-11-05 仍在更新）。
- 规模实测（同一时点抓取）：
  - 官网首页文案：**“Browse and search 8879 community plugins”**。
  - 目录包 `dsh-plugin-catalog@2026.1105.15517` 的 npm 描述：**“The DeepSeek Harness plugin catalog (8879 entries)”**，该版本 2026-11-05 构建（共 122 个版本，按日重建）。
  - 市场实际读取的 `plugins.json`（<https://awesome-dsh-plugin.com/plugins.json>）：**9111 条**，metadata 写明 `updated: 2026-11-05`，23 个分类。
  - 作为 DSH 索引源的 `index.json`（format 1）：**4569 条**。
  - 观察：`plugins.json` 中带 npm 映射的条目为 **4565 条**，与 `index.json` 的 4569 条基本吻合 → format-1 索引只收 npm 可安装条目，GitHub-only 条目不进索引（文档未明说，属实测推断）。8879/9111/4569 的差异来自“官网文案 / 每日构建时点 / npm 子集”三个口径。
- 市场插件安装（若要在 DSH GUI 里直接逛市场）：`dsh plugin --profile web add dshmarket`，重启后在 **Plugins → Plugin Market**（dsh 0.2.1+；旧版在 Settings → Plugin Market）。

### 1.2 索引地址 & 如何在 DSH 里添加为索引源

官方推荐（dsh 0.2.1+）：

1. 打开 **Plugins → Discover → Index sources**；
2. 添加 `https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json`（format 1，走 jsDelivr，加载快；实测 200，3,101,899 字节）；
3. 之后 Discover 标签页与 `plugin_market` 智能体工具搜索的即同一批插件。

备用同一文档（GitHub Pages，部分网络下可能超过宿主给索引源的 15 秒预算，故列为备用）：

- `https://awesome-dsh-plugin.com/index.json`
- `https://dshmarket.com/index.json`（与 jsDelivr 内容一致，实测 200，3,101,892 字节）

### 1.3 收录机制：人工 PR，不是“npm keyword 自动收录”

- dsh-market README 明确：“**This repo is the market app, not the catalog.** The plugin list comes from the curated awesome-dsh-plugin registry — to get your plugin listed in the market, open a PR **there**（一个条目；站点与市场会自动跟进，通常 1 天内）”；并声明安装源被限制在 curated registry 内。
- 目录数据在 awesome-dsh-plugin 仓库的 `data/plugins/` 下，**一个插件一个 YAML 文件**，文件名 `<owner>__<repo>.yml`；两个 README 由脚本生成，**禁止手改 README**。
- 没有“提交表单 / 站内提交入口 / npm keyword 自动扫描”通道；维护者也会主动收录知名插件，但这不是公开提交通道。
- 站点/市场/索引的刷新链：PR 合并 → CI 在 main 重新生成 README 与站点 → 每日 CI 刷新 `plugins.json`（含 star/download 等富化字段）→ `dsh-plugin-catalog` npm 包按日重建 `index.json`（最新版本号即日期，如 `2026.1105.15517`）。npm 映射（downloads、`npm` 字段）是**自动**从 registry 采集的：包的 `repository` 必须指回被收录仓库，否则不关联。

### 1.4 我们的收录状态：❌ 未收录（证据）

| 检查项 | 结果 |
| --- | --- |
| `https://awesome-dsh-plugin.com/plugins.json`（9111 条）全文搜 `dsh-todo-time-log` / `FantasyStarry` | **0 命中** |
| `dsh-plugin-catalog@2026.1105.15517` 包内 `index.json`（4569 条，format 1）搜 `dsh-todo-time-log` | **0 命中** |
| `https://dshmarket.com/index.json`（与上同一文档） | **0 命中** |
| 目录包最新构建日期 | 2026-11-05；我们 0.6.2 发布于 2026-11-06T01:40Z，即使现在合并 PR，也要等下一次每日构建才会出现在 `index.json` 里 |

**缺什么**：只缺一条目录条目（见 1.7 的 YAML 草稿）以及对应 PR。插件本体的硬性条件我们已满足（见 1.5）。

**最新进展（Lead 已提交）**：PR <https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/12489> — *Add FantasyStarry/dsh-todo-time-log (workflow)*，2026-11-06T02:35:08Z 创建，当前 **open / 非 draft / mergeable=true / mergeable_state=unstable（CI 仍在跑）**，changed_files=1，无标签。即：条目用 `workflow` 分类（报告 1.7 建议 `tools`，分类不会被拒，维护者可改）。后续只等 CI + 维护者 review，按 1.6 的耗时预期（中位约 1.7 h）当天大致可合并。

### 1.5 收录硬性要求 & 我们逐条对照

来源：<https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md>（26 KB，中文版同文件）。CI gate 依次检查：条目数 ≤3 → `dsh.bundle` → 仓库年龄 ≥1 天 → awesome-lint + 站点构建；CI 只是前置条件，合并前维护者会阅读源码核对描述。

| 要求 | 我们的现状 | 判定 |
| --- | --- | --- |
| 仓库 `package.json` 声明 `dsh.bundle`（只声明 `dsh.client` 会被拒） | npm 0.6.2 的 `dsh` = `{"bundle":{"patch":"./cordis.patch.yml"},"client":{"platform":"web","immediately":true}}` | ✅ |
| 仓库有真实可用代码（非占位/纯 README） | 完整实现 + 9 个测试文件 + 构建脚本；v0.6.2 已发 npm | ✅ |
| 仓库创建满 1 天 | 创建于 2026-11-03T07:45:20Z，现在 2026-11-06，约 3 天 | ✅ |
| 仓库加 `dsh-plugin` topic | topics 含 `dsh`、`dsh-plugin`、`dsh-plugins`、`deepseek-harness` 等 16 个 | ✅ |
| 描述准确、无营销词、与代码一致 | 需按下方草稿写（现 README 文案偏营销，PR 描述要收敛） | ⚠️ 起草时注意 |
| 选贴合实际的 category | 建议 `tools`（工具与能力）；备选 `ui`（面板）/ `workflow`（自动化）。不含 `productivity` 这一分类 | ⚠️ 二选一即可，选不准维护者会改、不会打回 |
| 一个 PR 最多 3 条 | 只提交 1 条 | ✅ |
| 不要手工改 README（由脚本生成） | 计划只加 `data/plugins/FantasyStarry__dsh-todo-time-log.yml` | ✅ |
| npm 发布（可选，不影响收录） | 已发布 `dsh-todo-time-log@0.6.2`，且 `repository` 指回 GitHub 仓库 → 自动关联 npm 下载量 | ✅ 加分项 |
| `peerDependencies` 预发布范围（"推荐"项，非 CI 门槛） | 现为 `>=0.2.0-rc.2 <0.2.3-0`，按 contributing.md 的 semver 说明，`0.2.1-rc.x` / `0.2.2-rc.x` 这类预发布**可能被静默排除**（而 README 声称在 0.2.2-rc.1 验证过）；`peerDependenciesMeta.optional` 让影响降为警告级 | ⚠️ 建议 Lead 评估（见 §4） |
| 可选加分：`icon:`（GitHub 托管位图）、`screenshots.json`（1–8 张）、Release tarball | 有 `icon.svg`（SVG 不被接受，可不上传）；可后续在仓库根加 `screenshots.json` | 可选，不阻塞 |

### 1.6 加入流程、耗时、风险

流程（全程只有 1 个文件 + 1 个 PR）：

1. fork / clone `awesome-dsh-plugin/awesome-dsh-plugin`；
2. 新建 `data/plugins/FantasyStarry__dsh-todo-time-log.yml`（内容见 1.7）；
3. 提交 PR 到 `main`，标题如 `Add FantasyStarry/dsh-todo-time-log`；
4. Submission gate（CI）自动跑：条目数、`dsh.bundle`、仓库年龄、awesome-lint；
5. 维护者读仓库核对描述 → 合并；
6. 合并后 CI 自动重建 README/站点；`plugins.json` 每日刷新；`dsh-plugin-catalog` 每日重建 → dshmarket 与 Discover 索引最迟次日可见。

耗时实测（GitHub API 近 30 个已合并 PR，created→closed）：**中位 1.74 小时**，最快 0.4 h，最慢 7.7 h；仓库累计已合并 PR 10,142 个，合并节奏很快。加上合并后的每日构建，**总计约 0.5–2 天**。

风险：

- **描述夸大**是主要打回原因（会被打 `held: author` 标签，改好同一分支再推即可，不是拒绝）；
- **手工改 README / 动别人条目**会被 gate 点名，且历史上造成大量 PR 冲突——只加自己的 YAML；
- 分类不贴切只会被维护者改；重复条目按“谁更好”而非先来后到；
- 收录 ≠ 安全审计；dsh-market 安装源白名单会以该目录为准，收录后我们才可能出现在其“一键安装”列表。

### 1.7 可直接执行的下一步（供 Lead 执行，本会话不 push）

YAML 草稿（描述只陈述功能、句末带句号，中文可留空由维护者补）：

```yaml
url: https://github.com/FantasyStarry/dsh-todo-time-log
name: FantasyStarry/dsh-todo-time-log
category: tools
description:
  en: Todo plugin for DeepSeek Harness that records each item's creation and completion time, with table, kanban, gantt and calendar views for real elapsed time.
  zh: DeepSeek Harness 待办插件：自动记录每条待办的创建与完成时间，用表格 / 看板 / 甘特图 / 日历四种视图呈现真实耗时。
```

命令清单：

```sh
gh repo fork awesome-dsh-plugin/awesome-dsh-plugin --clone
cd awesome-dsh-plugin
git checkout -b add-fantasystarry-dsh-todo-time-log
# 写入上面的 data/plugins/FantasyStarry__dsh-todo-time-log.yml
git add data/plugins/FantasyStarry__dsh-todo-time-log.yml
git commit -m "Add FantasyStarry/dsh-todo-time-log"
git push -u origin add-fantasystarry-dsh-todo-time-log
gh pr create --repo awesome-dsh-plugin/awesome-dsh-plugin \
  --title "Add FantasyStarry/dsh-todo-time-log" \
  --body "Todo plugin with creation/completion timestamps and table, kanban, gantt and calendar views. Declares dsh.bundle (cordis.patch.yml) and is published as dsh-todo-time-log@0.6.2 with repository pointing back here."
```

提交前自检（可选，确认 npm 侧 manifest 仍是 bundle）：

```sh
npm view dsh-todo-time-log dsh --json
curl -s https://dshmp.com/en/guides/publish/check?pkg=dsh-todo-time-log | grep -o "QUALIFIED"
```

合并后验证（预计次日生效）：

```sh
curl -s https://awesome-dsh-plugin.com/plugins.json | grep -c dsh-todo-time-log   # 期望 1
curl -s https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json | grep -c dsh-todo-time-log  # 期望 1
```

---

## 2. dshmp.com（按 manifest 验证的目录）

### 2.1 是什么 / 规模

- 站点：<https://dshmp.com>（独立社区目录，非官方，作者 @oNddleo）。
- 规模实测：**9647** 个插件（`/plugins` 与 `/api/plugins` 的 `total` 均为 9647）；首页统计：**9552 Verified**、**6489 含 Web UI**、**7320 含公开源码**。
- 数据更新：每日 **02:00 UTC** 刷新（目录 API 指南原文）。

### 2.2 收录机制：npm keyword 每日抓取 + `dsh.bundle` 校验（全自动）

- 官方发布指南 <https://dshmp.com/en/guides/publishing/publish-a-plugin>：“Publish to npm with the `dsh-plugin` keyword. The catalog reads the npm registry daily, so a new release appears within a day of publishing — there is no submission form and nothing to wait for a human to approve.”
- 判定门槛（<https://dshmp.com/en/guides/verified-listings>）：**当且仅当** `package.json` 声明 `dsh.bundle`（如 `{"dsh":{"bundle":{"patch":"./cordis.patch.yml"}}}`）才收录；星标/topic 不参与收录，只在收录后做 GitHub/Gitee 富化；官方 `@deepseek-ai` 包也不例外。
- 版本/元数据跟随 npm：发新版就是普通 `npm publish`，目录自动取 latest；npm 上 deprecate 会被标记归档并从默认列表隐藏，permalink 保留。
- 无需账号/认领：npm 包名归属即列表归属，改 `description/keywords/repository` 次日同步。

### 2.3 我们的收录状态：✅ 已收录（Verified）— 证据

- API：`https://dshmp.com/api/plugins?q=dsh-todo-time-log` →

```json
{"total":1,"plugins":[{"slug":"dsh-todo-time-log","npmName":"dsh-todo-time-log",
"version":"0.6.2","license":"MIT","hasWebUi":true,
"publishedAt":"2026-11-06T01:40:15.336Z","updatedAt":"2026-11-06T02:11:52.201Z"}]}
```

  即 0.6.2 发布（01:40Z）后，在当日 02:00 UTC 的每日同步中约 02:11Z 完成收录/富化。
- 详情页：<https://dshmp.com/plugins/dsh-todo-time-log> 显示 **dsh-todo-time-log · Verified · v0.6.2 · MIT · Web UI**，安装命令 `dsh plugin add dsh-todo-time-log`，README、tags、source（github/fantasystarry）齐全。
- **官方 publish check 直接跑过**：<https://dshmp.com/en/guides/publish/check?pkg=dsh-todo-time-log> 返回（抓取原文）：

> **Qualifies. This package will appear in the catalog.**
> dsh-todo-time-log v0.6.2 **QUALIFIED**
> Validation Checklist: package.json declares `dsh.bundle`.
> The catalog refreshes daily at 02:00 UTC, so a newly published package appears within a day.

  （check 表单参数是 `?pkg=`；该检查等价于索引器规则，对活 npm 包运行。结论：通过，无需任何动作。）
- 注意：API 返回的 `tags` 去掉了 `dsh`、`dsh-plugin` 这类通用 keyword（展示层过滤），不影响收录；真正的抓取依赖 npm 上的 `dsh-plugin` keyword，请勿从 package.json 移除。

### 2.4 能否作为 DSH 的“索引源”

**不能（没有 format-1 索引）**：`/index.json`、`/plugins.json`、`/api/index.json` 均 404；唯一机器接口是只读 JSON API：

```
GET https://dshmp.com/api/plugins?q=&category=&author=&web=1&sort=stars|recent|name&page=1&per_page=50
```

返回 `total/page/perPage/pages/plugins[]`（含 `slug/npmName/version/hasWebUi/tags/publishedAt/updatedAt` 等）。它适合做自定义看板/工具，但**不是** DSH Discover 可加载的 format-1 索引。要在 DSH 内浏览，只能开网站或用 API；作为“插件源”进 DSH 的只有 dshmarket 的 `dsh-plugin-catalog/index.json`。

### 2.5 维护/更新

- 无需操作：发新版即自动更新；不维护/被 deprecate 会自动隐藏。
- 收录后仍建议保持：npm keywords 含 `dsh-plugin`、`package.json` 的 `repository` 指回 GitHub（否则富化/星标关联会丢）、`dsh.bundle` 不删。

---

## 3. 对比与建议

| 维度 | dshmarket.com | dshmp.com |
| --- | --- | --- |
| 规模 | 9111 条全量 / 4569 条 npm format-1 | 9647 条（9552 Verified） |
| 收录 | 人工 PR（awesome-dsh-plugin，1 个 YAML） | 自动：npm keyword + `dsh.bundle`，每日 02:00 UTC |
| 人工审核 | 有（读源码核对描述） | 无 |
| 我们的状态 | ❌ 未收录 | ✅ 已收录（Verified，v0.6.2） |
| DSH 内可作索引源 | ✅ format 1（Discover → Index sources） | ❌ 仅 JSON API |
| 更新延迟 | 合并后 1 天内（当日构建） | ≤1 天（当日 02:00 UTC） |
| 价值 | 更高：dsh-market 客户端一键安装 + 宿主 Discover 搜索 + 官网 | 曝光/信任背书（Verified 徽章、API 可被第三方工具消费） |

**建议**：把 dshmarket PR 作为唯一待办（1 个文件，中位 ~1.7 h 合并）；dshmp 已自动完成，无需申请。dshmarket 收录后，我们同时出现在“市场 UI + format-1 索引源 + 官网”，收益最大。

---

## 4. 风险与注意事项

1. **dshmarket 描述必须与代码一致**：描述中的数字、命令、API 名称都会被维护者对着源码核；我们 PR 描述只用“记录创建/完成时间、四种视图”这类可验证事实，不写“最好用”。
2. **不要手工编辑 awesome-dsh-plugin 的 README**（由 `data/plugins/*.yml` 生成），只提交自己的 YAML，避免与生成行冲突。
3. **分类**：`tools` 最贴合（工具与能力）；若更想突出面板 UI 可选 `ui`，靠工作流自动化可选 `workflow`。选不准不会被拒。
4. **`peerDependencies` 预发布范围（建议核对，非收录门槛）**：现为 `"@deepseek-ai/dsh": ">=0.2.0-rc.2 <0.2.3-0"`。按 contributing.md §peerDependencies 的说明，node-semver 只有在范围里存在“同 major.minor.patch 且带预发布标签”的比较符时才会放行该预发布版本；因此 `0.2.1-rc.x`、`0.2.2-rc.x` 这类宿主预发布**可能被静默排除**（与我们 README 中“已在 0.2.2-rc.1 真机验证”矛盾）。由于 `peerDependenciesMeta` 标记为 optional，影响主要是安装期 warning 而非硬失败；如需修，可改成显式预发布分支，例如 `>=0.2.0-rc.2 <0.2.3-0 || >=0.2.2-rc.1 <0.2.3-0`（具体分支按要支持的宿主版本定，属仓库源码改动，按任务约束留给 Lead 决定，本报告不改代码）。
5. **dshmp 收录是“清单验证”不是安全审计**，两站均如此；我们的 README/描述不要宣称“已审计”。
6. 两站数据都有每日构建时差（数百条量级的口径漂移），引用数字时以抓取时间为准。

---

## 5. 证据与复现命令（2026-11-06 快照）

- dshmarket 首页规模与索引源说明：<https://dshmarket.com/>
- 市场目录数据（9111）：<https://awesome-dsh-plugin.com/plugins.json>
- format-1 索引（4569）：<https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json>、<https://dshmarket.com/index.json>、<https://awesome-dsh-plugin.com/index.json>
- 索引包版本：<https://registry.npmjs.org/dsh-plugin-catalog>（latest 2026.1105.15517，122 个版本）
- 投稿规则：<https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md>
- 市场仓库说明（“提交去 awesome 仓库”）：<https://github.com/dsh-market/dsh-market>
- dshmp 发布指南：<https://dshmp.com/en/guides/publishing/publish-a-plugin>
- dshmp 收录判定：<https://dshmp.com/en/guides/verified-listings>
- dshmp 目录 API：<https://dshmp.com/en/guides/reference/catalog-api>
- dshmp publish check：<https://dshmp.com/en/guides/publish/check?pkg=dsh-todo-time-log>
- 我们的 npm 包：<https://registry.npmjs.org/dsh-todo-time-log>（latest 0.6.2；7 个版本；`dsh.bundle.patch` 存在）
- 我们的仓库：<https://github.com/FantasyStarry/dsh-todo-time-log>（created 2026-11-03T07:45:20Z；topics 含 dsh-plugin；MIT）

复现命令：

```sh
# dshmarket 侧
curl -s https://awesome-dsh-plugin.com/plugins.json | grep -c dsh-todo-time-log        # 0
curl -s https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json | grep -c dsh-todo-time-log  # 0
# dshmp 侧
curl -s "https://dshmp.com/api/plugins?q=dsh-todo-time-log"                            # total 1, v0.6.2
curl -s "https://dshmp.com/en/guides/publish/check?pkg=dsh-todo-time-log" | grep -o QUALIFIED  # QUALIFIED
```
