# 发布流程（npm）

本仓库通过 GitHub Actions 自动发布 npm 包 **dsh-todo-time-log**（unscoped、公开）。
工作流文件：[.github/workflows/publish.yml](../.github/workflows/publish.yml)。
鉴权使用 **npm 可信发布（Trusted Publishing / OIDC）**，仓库里不需要保存任何 npm token。

## 0. 触发方式与流水线

| 触发 | 行为 |
| --- | --- |
| push tag `v*.*.*` | 校验 tag ↔ `package.json` 版本 → check/test/audit → 打包预演 → npm public（provenance）→ 创建 GitHub Release |
| `workflow_dispatch`（dry_run=true，默认） | 只跑校验并执行 `npm publish --dry-run`，不发布 |
| `workflow_dispatch`（dry_run=false） | 不走 tag 直接发布当前版本（应急用） |

工作流步骤顺序：

1. `npm run check` — 六个 lib 文件语法检查
2. `npm test` — 解析 / 冒烟 / HTTP 三段测试
3. `npm run audit` — client.js 静态审计 28 项
4. `npm pack --dry-run` — 预览发布内容（受 `package.json` 的 `files` 白名单约束）
5. 查询 npm 是否已存在同版本：**已存在则跳过发布**（幂等，便于重跑与补发 Release）
6. `npm publish --provenance` — 可信发布，npm 页面生成 Provenance 徽章
7. `gh release create` — 以 tag 名创建 Release，自动生成 release notes

发布内容 = `package.json` 的 `files` + `package.json` 本身：`lib/*.js`、`cordis.patch.yml`、`locale/*.json`、`icon.svg`、`README.md`。`test/`、`docs/`、`.github/` 不会进包。

## 1. 一次性准备

按顺序完成，**第 3 步不能跳过**（Trusted Publisher 只能绑定"已存在"的包）。

### 1.1 确认包可发布

- `package.json` 不能有 `"private": true`（本仓库已移除）。
- 包名 `dsh-todo-time-log` 未被占用（当前 registry 上不存在，可直接使用）。

### 1.2 首次 bootstrap 发布（本机手动）

```bash
npm login                    # 浏览器登录，账号需开启 2FA
npm pack --dry-run           # 预览将发布的文件
npm publish                  # 发布当前版本，例如 0.5.0
```

unscoped 包默认就是 public，不需要 `--access public`。
发布后确认：`npm view dsh-todo-time-log version` 能返回 `0.5.0`。

> 若以后改成 scoped 包名（如 `@fantasystarry/dsh-todo-time-log`），需要 `publish` 时加 `--access public`，
> 并在 npm 上重新配置 Trusted Publisher。

### 1.3 配置 Trusted Publisher（关键）

npmjs.com → 包页面 `dsh-todo-time-log` → **Settings** → **Trusted publishing** → 添加 GitHub Actions：

| 字段 | 值 |
| --- | --- |
| Organization or user | `FantasyStarry` |
| Repository | `dsh-todo-time-log` |
| Workflow filename | `publish.yml`（必须与文件名完全一致，含 `.yml`，区分大小写） |
| Environment | 留空（除非给 job 配了 `environment`） |

保存后，工作流里的 `npm publish` 会用 `id-token: write` 换取短期凭证，无需 `NPM_TOKEN`。
如果仓库 Secrets 里曾经存过 `NPM_TOKEN`，可以删掉。

### 1.4 可选：给发布加人工审批

在 GitHub 仓库 Settings → Environments 新建 `npm-publish`（可加 Required reviewers），
然后给 workflow 的 job 加上 `environment: npm-publish`，同时 npm 侧 Environment 字段填同名值。

## 2. 日常发版

```bash
# 1) 改版本并打 tag（npm version 会自动 commit + tag）
npm version patch -m "chore: release v%s"    # 0.5.0 → 0.5.1；也可用 minor / major
# 2) 推送 commit 与 tag（--follow-tags 只推 annotated tag）
git push origin main --follow-tags
```

推送 tag 后到 Actions 页面确认 `Publish to npm` 变绿，然后：

```bash
npm view dsh-todo-time-log version     # 应为新版本
npm view dsh-todo-time-log dist.tarball
```

## 3. 手动触发 / 预演

Actions → **Publish to npm** → **Run workflow**：

- `dry_run = true`（默认）：完整校验 + `npm publish --dry-run`，只打印将要发布的文件，不写 registry。
- `dry_run = false`：不依赖 tag，直接发布当前 `package.json` 版本（版本已存在时会自动跳过）。

## 4. 版本策略

- 目前 `0.x`：破坏性变更走 minor（0.5 → 0.6），修复/小功能走 patch。
- 到 `1.0.0` 后严格遵循 SemVer。
- **tag 必须等于 `v` + `package.json` 版本**，否则工作流第一步就失败（防呆）。
- 不要复用已发布过的版本号；也不要"本地 `npm publish` 了但忘了打 tag"。

## 5. 回滚 / 撤销

```bash
# 发布 72 小时内可整版撤回（之后版本号也不能再用）
npm unpublish dsh-todo-time-log@0.5.1

# 超过 72 小时：标记弃用并尽快发修复版
npm deprecate dsh-todo-time-log@0.5.1 "此版本存在 XXX 问题，请升级到 0.5.2"
```

## 6. 备选方案：NPM_TOKEN（不推荐）

如果暂时无法配置 Trusted Publisher，可退回长期 token：

1. npmjs.com → Access Tokens → Generate New Token → **Granular Access Token**：
   - Packages: 仅 `dsh-todo-time-log`，权限 Read and write
   - 勾选 **Bypass 2FA**（否则 CI 无法发布）
2. GitHub 仓库 Settings → Secrets and variables → Actions → 新建 `NPM_TOKEN`。
3. 工作流 publish 步骤加环境变量，并在 `setup-node` 里加 `registry-url: https://registry.npmjs.org`：

```yaml
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          registry-url: https://registry.npmjs.org
      - name: 发布到 npm
        run: npm publish --provenance
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

降级点：没有 OIDC 的"短期凭证"安全性，token 有泄露与轮换成本；provenance 仍可用（需要 `id-token: write`）。

## 7. 常见问题

| 现象 | 原因 / 处理 |
| --- | --- |
| `404 Not Found - PUT` | Trusted Publisher 没配，或 owner / repo / workflow 文件名与 npm 上不一致 |
| `ENEEDAUTH` | 工作流缺 `id-token: write`；或用了 token 但 `NPM_TOKEN` 未配 / 已过期 |
| `E409` / `cannot publish over existing version` | 版本号已存在 → 改版本号重发，不要删除重发同一号 |
| provenance 生成失败 | 仓库必须 public；job 必须 `id-token: write`；`repository` 字段与真实仓库一致 |
| 工作流报 tag 与版本不一致 | 先把错误 tag 删掉重打：`git push origin :v0.5.1`、`git tag -d v0.5.1` |
| `npm publish` 本地报 `provenance` 相关错误 | 本机发布不要带 `--provenance`（本地无 OIDC） |
| npm 版本过低报可信发布不支持 | 需要 npm ≥ 11.5.1；工作流用 Node 24 已满足 |

## 8. 首次发布与 tag 的关系（重要）

先 `npm publish` bootstrap 出 `0.5.0`，再配 Trusted Publisher。
之后给 `0.5.0` 补打 `v0.5.0` tag 也安全：工作流检测到该版本已存在会自动跳过 `npm publish`，
只创建 GitHub Release。真正的"自动发布"从下一个版本开始（如 `v0.5.1`）。
