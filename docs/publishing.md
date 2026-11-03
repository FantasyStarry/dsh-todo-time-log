# 发布流程（npm）

本仓库通过 GitHub Actions 发布 npm 包 **dsh-todo-time-log**（unscoped、公开）。
工作流：[.github/workflows/publish.yml](../.github/workflows/publish.yml)。

## 0. 重要背景：npm 2026 起不允许 token 直接发布

GitHub Changelog《Restricting npm bypass-2FA granular access tokens》：

- **2026-07-31 起**：bypass-2FA 的 granular token 不能再做账号/安全类操作（建删 token、改包权限、改 maintainers、改 Trusted Publisher 配置等）。
- **直接发布（npm publish）也已被限制**，会报 `EOTP: This operation requires a one-time password`；官方计划 **2027-01 完全移除**。
- 这类 token 之后的发布能力只剩：**读取私有包 + 提交 staged publish**，由维护者用 2FA 在网页批准。

因此本仓库的发布路径是：

| 场景 | 做法 | 需要人做什么 |
| --- | --- | --- |
| **首次建包** | 工作流 `mode=stage` → `npm stage publish`（token，无需 2FA） | npmjs.com 点 **Approve**（2FA） |
| **日常发版** | push tag `v*` → OIDC 可信发布 `npm publish` | 无 |
| 备选日常 | 工作流 `mode=stage` + 网页 Approve | 每次点一次 Approve |

**本机不需要 `npm login` / `npm publish`**；唯一必须人工做的是 npm 账号授权（建 token、点 Approve、配 Trusted Publisher），都在浏览器里完成。

## 1. 触发方式与流水线

| 触发 | 行为 |
| --- | --- |
| push tag `v*.*.*` | 校验 tag ↔ 版本 → check/test/audit → 打包预演 → `npm publish --provenance`（OIDC）→ 创建 GitHub Release |
| `workflow_dispatch` + `mode=dry-run`（默认） | 只做 `npm publish --dry-run` |
| `workflow_dispatch` + `mode=stage` | `npm stage publish` 提交待审批（可创建尚不存在的新包；用 NPM_TOKEN，不需要 2FA） |
| `workflow_dispatch` + `mode=publish` | OIDC 直接发布（**必须已配好 Trusted Publisher 并允许 npm publish**） |

工作流的防呆：

- tag 必须等于 `v` + `package.json` 版本；
- `npm view name@version` 已存在则跳过发布（可安全重跑）；
- 有 `NPM_TOKEN` secret 时自动写 `.npmrc`（只对 stage 有用）；
- `.npmrc`、`test/`、`docs/`、`.github/` 都不进发布包（受 `files` 白名单约束）。

## 2. 首次发布（只动浏览器，不走本地 CLI）

### 2.1 创建 granular token

npmjs.com → 头像 → **Access Tokens** → **Generate New Token** → **Granular Access Token**：

| 项 | 值 |
| --- | --- |
| Token name | `dsh-todo-time-log stage` |
| Expiration | 7 天（用完即删） |
| Packages and scopes | **All packages** → Read and write（包还不存在，无法只勾它） |
| Bypass 2FA | 勾不勾都可以：**它已经不能直接发布**，staged publish 不需要 2FA；勾了也不影响 |

> 注意：2026-07-31 后，勾了 Bypass 2FA 也不能再直接 publish，只能 stage；这正是要改用 stage 的原因。

### 2.2 存成仓库 secret

GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret：Name `NPM_TOKEN`。

```bash
# 若本机已装 gh 并已登录（PATH 需是新终端）
gh secret set NPM_TOKEN --repo FantasyStarry/dsh-todo-time-log
```

### 2.3 跑工作流提交 staged publish

Actions → **Publish to npm** → **Run workflow** → `mode` 选 **stage** → Run。

成功后日志最后会提示：打开 `https://www.npmjs.com/package/dsh-todo-time-log`。

### 2.4 在 npmjs.com 批准

包页 → **Staged Packages** 标签（或在账号设置里找 staged packages）→ 选中 `0.5.0` → **Approve**（需 2FA）。
批准后 `0.5.0` 才真正上架；在那之前 registry 上只有一个 `0.0.0-stage` 占位版本。

确认：`npm view dsh-todo-time-log version` 返回 `0.5.0`。

### 2.5 切到 OIDC 并删除 token

1. npmjs.com → 包页 → **Settings** → **Trusted publishing** → GitHub Actions：
   - Organization or user：`FantasyStarry`
   - Repository：`dsh-todo-time-log`
   - Workflow filename：`publish.yml`（完全一致，含后缀）
   - Environment：留空
   - **Allowed actions：勾选允许 `npm publish`**（默认可能只允许 stage；不勾的话 tag 发布会被拒）
2. GitHub 删除 `NPM_TOKEN` secret；npm 上回收 token。
3. 建议开启 npmjs.com → 包 Settings → Publishing access → **Require 2FA and disallow tokens**。

> Trusted Publisher 配置有 **48 小时验证窗口**：配置后 48 小时内要有一次成功发布来绑定仓库身份，否则配置过期作废。

## 3. 日常发版（全自动）

```bash
npm version patch -m "chore: release v%s"   # 0.5.0 → 0.5.1；也可 minor / major
git push origin main --follow-tags
```

tag 推送后：OIDC 发布（带 provenance）→ 自动建 Release。确认 `npm view dsh-todo-time-log version`。

如果 Trusted Publisher 只允许 stage（没勾 npm publish），则用 `mode=stage` + 网页 Approve 代替。

## 4. 手动触发 / 预演

Actions → **Publish to npm** → **Run workflow**：

- `dry-run`：完整校验 + `npm publish --dry-run`；
- `stage`：提交待审批（首次建包用这个）；
- `publish`：OIDC 直接发布（版本已存在会自动跳过）。

## 5. 版本策略

- `0.x`：破坏性变更走 minor（0.5 → 0.6），修复/小功能走 patch；`1.0.0` 后严格 SemVer。
- tag 必须等于 `v` + `package.json` 版本；不要复用已发布过的版本号。

## 6. 回滚 / 撤销

```bash
# 72 小时内可整版撤回（之后该版本号不能再用）
npm unpublish dsh-todo-time-log@0.5.1

# 超过 72 小时：标记弃用 + 尽快发修复版
npm deprecate dsh-todo-time-log@0.5.1 "此版本存在 XXX 问题，请升级到 0.5.2"
```

## 7. 常见问题

| 现象 | 原因 / 处理 |
| --- | --- |
| `EOTP: This operation requires a one-time password` | bypass-2FA token 已不能直接 publish → 改用 `mode=stage` + 网页 Approve；日常发布用 OIDC |
| `E403` / 提示 staged publishing | 新包必须走 staged 流程 → `mode=stage` |
| `404 Not Found - PUT` | 包还不存在（先 stage + Approve）或 Trusted Publisher 的 owner/repo/workflow 名不一致 |
| `ENEEDAUTH` | 既没 `NPM_TOKEN`，job 又缺 `id-token: write` |
| `E409` / cannot publish over existing version | 版本号已存在 → 改版本号 |
| Trusted Publisher 过期 | 配置后 48 小时内没有成功发布 → 删除配置重建 |
| provenance 失败 | 仓库必须 public；job 必须有 `id-token: write`；`repository` 字段要匹配 |
| tag 与版本不一致 | 删错 tag 重打：`git push origin :v0.5.1`、`git tag -d v0.5.1` |
| `gh: command not found`（刚装完） | 新开终端刷新 PATH；或用完整路径 `C:\Program Files\GitHub CLI\gh.exe` |

## 8. 备选：一直用 staged publish

不想配 Trusted Publisher 也可以长期用 `mode=stage` + 网页 Approve：安全（每次人工 2FA）但每个版本都要点一次。

## 9. 本仓库实测记录（2026-11-03）

| 步骤 | 结果 |
| --- | --- |
| 首发用 token 直接 `npm publish` | ❌ `EOTP`：npm 2026-07 起限制 bypass-2FA token 直接发布 |
| `mode=stage`（stage id `e4babed3-…`） | ✅ 提交成功，registry 出现占位版本 `0.0.0-stage` |
| npm 页面自动审核（Validating） | ✅ 约 5 分钟通过，网页 Approve（2FA）后 `0.5.0` 上架 |
| Trusted Publisher（勾 Allow npm publish） | ✅ tag `v0.5.1` 推送 → OIDC 直接发布成功，带 provenance 证明 |
| 删除 `NPM_TOKEN` secret | ✅ 完成，后续发布会打印「未设置 NPM_TOKEN，使用 OIDC 可信发布」 |

两个实测坑：

- npm 发布后日志会显示 “Your package is being processed and may take a few minutes to become available”，
  **版本要过 1–2 分钟才出现在 registry**；`npm view` 还有缓存，短时间内查不到别以为失败了，
  直接查 `https://registry.npmjs.org/<pkg>/<version>` 更准。
- `0.0.0-stage` 占位版本会永久留在 version 列表里（无实际内容），不影响安装与 `latest`。

