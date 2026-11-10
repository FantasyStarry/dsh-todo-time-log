# DSH 插件源申报总览（2026-11-06）

> 目标：找出「插件数量多」的 DSH 插件源，并把 dsh-todo-time-log v0.6.2 申请加入。
> 依据：market-a / market-b / market-c 三份调研报告（同目录）。

## 一、已提交 / 已收录（按体量）

| 源 | 体量 | 加入方式 | 状态 |
|---|---|---|---|
| **dsh.so**（信任注册表） | 注册表 28,597；市场索引 10,970（format 1） | 匿名提交表单：校验格式 + 安全扫描 + 生成 schema 条目 | ✅ **已提交**（issue #455，待维护者合并；检查全通过） |
| **dshbase.com** | 20,035 条 | GitHub issue 表单 | ✅ **已收录**（issue #270 关闭，维护者确认 https://dshbase.com/plugins/dsh-todo-time-log/；快照 2026-10-16，分批入库） |
| **imsai-sh/awesome-deepseek-harness-plugins**（deepseek1024.com） | 13,962 条 | PR 单个 JSON，过静态审查自动合并 | ✅ **PR #834 已合并**（catalog-sync 成功，条目文件已在 main） |
| **awesome-dsh-plugin/awesome-dsh-plugin**（awesome-dsh-plugin.com → dsh-plugin-catalog → dshmarket） | 9,111 条收录；catalog 8,879；format-1 索引 4,565 | PR 新增 `data/plugins/<owner>__<repo>.yml` | ⏳ **PR #12489**：CI ✅（check / Submission gate），mergeable=CLEAN，等维护者合并（近期中位 1.7h） |
| **billLiao/awesome-dsh-plugin** | ≥21,000 条（每小时同步） | GitHub topic `dsh-plugin` 自动收集 | ✅ **已自动收录**（categories/tools-capabilities.md） |
| **beancookie/awesome-dsh-plugin** | 188★ / 504 条 | PR 在中英 README 各加一行（分类内字母序） | ⏳ **PR #268** 已开，待审 |
| **dshplugin.dev** | 1,136 条（人工审核） | 提交表单（Turnstile 人机校验；无账号） | ⏳ **已提交**：publicId `sub_2dd4db60-8b44-4d83-a9f7-13faa10c303a`，status=pending，无 SLA |
| **dshmp.com** | 只读 npm API | npm keyword `dsh-plugin` 自动收录（每日 02:00 UTC） | ✅ **已自动收录且 Verified**（v0.6.2） |

## 二、随上述动作自动生效

- **dshmarket（dsh 内置可视化插件市场）**：数据源 = awesome-dsh-plugin 的 catalog，等 #12489 合并后出现。
- **DSH-Plugin-Hub**：每 6h 同步 GitHub Search API，topic 已具备，自动纳入。
- **npm 侧**：dsh-todo-time-log@0.6.2 已发布，keywords 含 dsh-plugin，dsh.bundle 完整。

## 三、未投 / 不可投

| 源 | 原因 |
|---|---|
| bruc3van/awesome-dsh-plugin（497★，约 1,575 条） | 自荐区要求 stars > 10，当前 ⭐1；先攒 star |
| dongsheng123132/awesome-dsh-plugins-1（353 条） | 可投（`plugins/<分类>.md` 加一行），量级小，未做 |
| fuyiyun666/awesome-dsh-plugin-2 | beancookie 的 0★ 镜像，优先原版（已投 #268） |
| shutongX/dsh-plugins-index、vlln/plugin-registry | 自有 format-1 索引，不开放第三方 |
| Anil-matcha、Victor-770 | 低活跃 / 仓库 404 |

## 四、可直接加进 DSH「发现」页的索引源（format 1）

- `https://cdn.dsh.so/market/index.json` —— 10,970 条，安装验证 + 安全审计（低风险）
- `https://cdn.dsh.so/market/top-rank.json` —— 精选榜单切片
- `https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json` —— awesome-dsh-plugin 全量可安装子集
- 用法：插件 → 实验性插件 → 开启「自定义插件索引」→ 发现 → 添加索引源。

## 五、待办与风险

1. #12489 合并后验证：`curl https://awesome-dsh-plugin.com/plugins.json | grep dsh-todo-time-log`，并等每日 CI 重建 catalog/index。
2. dsh.so 为人工 merge，issue #455 在私有仓库（外部不可见），保持关注即可。
3. dshplugin.dev 无 SLA（天级～数周）；被拒可用 contact@dshplugin.dev 申诉（附 publicId + 证据）。
4. dshbase 页面数据快照较旧，刷新以维护者分批 ingest 为准。
5. peerDependencies `>=0.2.0-rc.2 <0.2.3-0` 在 semver 预发布规则下可能不匹配 0.2.1-rc.x/0.2.2-rc.x 宿主（optional peer，通常仅 warning）。
