# 发布流程（npm）

本仓库通过 GitHub Actions 自动发布 npm 包 **dsh-todo-time-log**（unscoped、公开）。
工作流：[.github/workflows/publish.yml](../.github/workflows/publish.yml)。
日常发布使用 **npm 可信发布（Trusted Publishing / OIDC）**，仓库里不需要长期保存任何 npm token。

## 0. 结论：能不能跳过本地 `npm login` + `npm publish`？

**能。** 首发和日常发布都可以在 Actions 里跑完，本机不需要 `npm login`/`npm publish`。
唯一无法省掉的是**一次性的 npm 账号授权**（在浏览器里做，1 分钟）：

| 需要人做的事 | 在哪做 | 为什么不能自动化 |
| --- | --- | --- |
| 生成 granular access token（勾 Bypass 2FA） | npmjs.com（浏览器） | 这是账号身份授权，CI 不能给自己发权限 |
| 把 token 存为仓库 secret `NPM_TOKEN` | GitHub 仓库设置（或 `gh secret set`） | 同上 |
| 首次发布后：配置 Trusted Publisher、删掉 token | npmjs.com + GitHub 设置 | 同上（一次即可，之后全自动） |

> 为什么首发不能纯 OIDC：Trusted Publisher 是绑定在**已存在**的包上的，
> 而新包名的创建本身需要一次人工授权（npm 2026-10 起新包也可以走 `npm stage publish` 创建，但仍需 token 或本地会话）。

## 1. 触发方式与流水线

| 触发 | 行为 |
| --- | --- |
| push tag `v*.*.*` | 校验 tag ↔ 版本 → check/test/audit → 打包预演 → `npm publish --provenance`（OIDC）→ 创建 GitHub Release |
| `workflow_dispatch` + `mode=dry-run`（默认） | 只做 `npm publish --dry-run`，不写 registry |
| `workflow_dispatch` + `mode=publish` | 直接发布当前版本（有 `NPM_TOKEN` 用令牌，没有则 OIDC）——**首次建包用这个** |
| `workflow_dispatch` + `mode=stage` | `npm stage publish` 提交待审批（可创建尚不存在的新包；需 npm ≥ 11.15） |

工作流同时做这些防呆：

- tag 必须等于 `v` + `package.json` 版本，否则第一步失败；
- 用 `npm view name@version` 检查是否已发布，已存在则跳过 publish（可安全重跑）；
- 存在 `NPM_TOKEN` secret 时自动写入 `.npmrc` 使用令牌，不存在则走 OIDC；
- `.npmrc` 与 `test/`、`docs/`、`.github/` 都不会进发布包（受 `package.json` 的 `files` 白名单约束）。

## 2. 首次发布（只用浏览器，不走本地 CLI）

### 2.1 创建 token

npmjs.com → 头像 → **Access Tokens** → **Generate New Token** → **Granular Access Token**：

| 项 | 值 |
| --- | --- |
| Token name | `dsh-todo-time-log bootstrap` |
| Expiration | 7 天（够用，记得删） |
| Packages and scopes | **All packages** → Read and write（包还不存在，无法只勾它） |
| **Bypass 2FA** | **勾选**（否则 CI 发布会要求 OTP） |

复制 token（只显示一次）。

### 2.2 存成仓库 secret

GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret：
Name `NPM_TOKEN`，Value 粘贴 token。或用 CLI：

```bash
gh secret set NPM_TOKEN --repo FantasyStarry/dsh-todo-time-log
```

### 2.3 跑工作流建包

Actions → **Publish to npm** → **Run workflow** → `mode` 选 **publish** → Run。
它会跑完全部测试，然后发布 `0.5.0`。

- 成功：`npm view dsh-todo-time-log version` 返回 `0.5.0`，进入第 2.4 步。
- 失败并提示新包必须走 staged publishing（npm 新策略）：改跑 `mode=stage`，
  然后 npmjs.com → 包页 → **Staged Packages** → **Approve**（需 2FA）。效果相同。

### 2.4 收尾（一次性，之后全自动）

1. npmjs.com → 包页 `dsh-todo-time-log` → **Settings** → **Trusted publishing** → GitHub Actions：
   - Organization or user：`FantasyStarry`
   - Repository：`dsh-todo-time-log`
   - Workflow filename：`publish.yml`（必须完全一致，含后缀、区分大小写）
   - Environment：留空
2. **48 小时内**要有一次成功发布来"验证"这个配置，否则配置过期作废（npm 2026-10 新规则）。
   若配置后暂时没有新版本，可以先跑一次 `mode=publish`（该版本已存在会自动跳过，不算验证），
   所以更稳妥的做法是：配好后等到下一个版本（`v0.5.1`）发布时完成验证。
3. 删除 `NPM_TOKEN` secret（GitHub 设置里删），并收回 npm token。
4. 建议开启 npmjs.com → 包 Settings → Publishing access → **Require 2FA and disallow tokens**。

## 3. 日常发版（全自动）

```bash
npm version patch -m "chore: release v%s"   # 0.5.0 → 0.5.1；也可 minor / major
git push origin main --follow-tags
```

tag 推送后：Actions 跑校验 → OIDC 发布（带 provenance）→ 自动建 Release。
确认：`npm view dsh-todo-time-log version`。

## 4. 手动触发 / 预演

Actions → **Publish to npm** → **Run workflow**：

- `dry-run`：完整校验 + `npm publish --dry-run`，只打印将发布的文件；
- `publish`：直接发布当前版本（版本已存在自动跳过）；
- `stage`：提交待审批，npmjs.com 的 Staged Packages 里 Approve 后生效。

## 5. 版本策略

- `0.x`：破坏性变更走 minor（0.5 → 0.6），修复/小功能走 patch；到 `1.0.0` 后严格 SemVer。
- tag 必须等于 `v` + `package.json` 版本。
- 不要复用已发布过的版本号。

## 6. 回滚 / 撤销

```bash
# 72 小时内可整版撤回（之后该版本号也不能再用）
npm unpublish dsh-todo-time-log@0.5.1

# 超过 72 小时：标记弃用 + 尽快发修复版
npm deprecate dsh-todo-time-log@0.5.1 "此版本存在 XXX 问题，请升级到 0.5.2"
```

## 7. 常见问题

| 现象 | 原因 / 处理 |
| --- | --- |
| `404 Not Found - PUT` | 包还不存在（走 2.3 的 bootstrap）或 Trusted Publisher 的 owner/repo/workflow 名不一致 |
| 发布时报需要 2FA / OTP | 用的 token 没勾 **Bypass 2FA**；或本机 `npm publish` 未通过 OTP |
| `ENEEDAUTH` | 既没有 `NPM_TOKEN`，job 又缺 `id-token: write` |
| `E409` / cannot publish over existing version | 版本号已存在 → 改版本号，不要重发同一号 |
| 新包直接被拒绝、提示 staged publishing | 用 `mode=stage` + npmjs.com 点 Approve |
| Trusted Publisher 显示过期/无效 | 配置后 48 小时内没有成功发布 → 删除配置重建 |
| provenance 生成失败 | 仓库必须 public；job 必须有 `id-token: write`；`repository` 字段与真实仓库一致 |
| 工作流报 tag 与版本不一致 | 删掉错误 tag 重打：`git push origin :v0.5.1`、`git tag -d v0.5.1` |

## 8. 备选：长期 NPM_TOKEN（不推荐）

若不想配 Trusted Publisher，可以一直用 token 发布（工作流已支持：有 `NPM_TOKEN` 就用它）。
代价：没有 OIDC 的短期凭证安全性，token 过期/泄露都要人工处理，需要定期轮换。
