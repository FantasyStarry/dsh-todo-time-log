# 动效规范：短、克制、只服务状态变化

> 2026-11-06。与 [操作逻辑](operation-logic.md) 配套：操作逻辑决定「在哪里发生」，动效只负责「怎么被看见」。

## 三条原则

1. **只服务状态变化**：入场（新行 / 切视图）、确认（勾选、保存）、浮层（菜单、详情、对话框）、进度（甘特绘制）。不做装饰性循环动画。
2. **短**：120–200ms；列表错位 12ms 一步、最多 7 项（总延迟 ≤72ms）。超过 250ms 用户会感觉「卡」。
3. **只用合成友好的属性**：`transform` / `opacity` / `clip-path`。不动 `height`、`top`、`width`，避免重排。

## 动效清单

| 场景 | 效果 | 参数 |
| --- | --- | --- |
| 表格行 / 看板卡片入场 | 淡入（行）、上浮 6px（卡片） | 180 / 200ms，`animation-delay` 12ms×索引（≤6） |
| 勾选圈 | 对勾从 0.55 弹到 1 | 200ms `cubic-bezier(0.34, 1.4, 0.64, 1)` |
| 完成后的「用时」行 | 淡入 | 160ms |
| 行尾 ⋯ 菜单 / 详情展开 | 淡入 + 下移 4px | 120 / 160ms |
| 对话框 | 遮罩淡入 + 面板上浮 10px / 0.985 缩放 | 140 / 200ms |
| 甘特条 | 从左向右「画」出（`clip-path`） | 420ms |
| 筛选计数 | 数字更新时轻弹 | 200ms |
| 可切换控件 / 按钮 | 背景、颜色、阴影过渡；按下 0.98 | 120–150ms |
| Toast | 从下浮入 | 160ms（既有） |
| 骨架屏 | 呼吸 | 1.4s 循环（既有） |
| 快速入口：清单卡片入场 | 淡入 + 上移 6px（`ttl-quick-in`） | 160ms `cubic-bezier(0.22, 0.61, 0.36, 1)` |
| 快速入口：行入场 / 卡片内提示 | 行淡入（`ttl-quick-row-in`）；提示淡入 + 上移 4px（`ttl-quick-notice-in`） | 180ms / 160ms |
| 快速入口：勾选 | 行即时移除 + 卡片内提示「已完成 · 用时 X [撤销]」；清单里的勾选圈固定 `scale(0.85)`，不做对勾放大 | —（即时） |
| 设置卡 / 开关（面板页头「设置」） | 轨道 `background-color` 过渡 + 圆点 `translateX(0 → 16px)` | 150ms `cubic-bezier(0.22, 0.61, 0.36, 1)` |

> 快速入口的「勾选」只有状态结果，没有对勾回弹：面板那套 0.55→1 / 200ms spring 依赖 `data-checked` 切换，而清单里完成的行会立刻从列表移除。若以后要给快速入口补回弹，需要让该行在移除前保留一拍，这会与下面「退出动画不做」的既有约定冲突，请先改基线再动实现。

## 明确不做

- **退出动画**：删除 / 过滤移除都是即时消失。列表是数据视图，为离场动画保留 Ghost 行会让「删掉了吗」产生歧义。
- **循环 / 呼吸的装饰动画**（除了加载态与既有骨架屏）：常驻动画会把注意力从数据上拽走。
- **滚动视差、弹跳过冲**：勾选的回弹是唯一允许的过冲，幅度 ≤12%。

## 无障碍

`@media (prefers-reduced-motion: reduce)` 下对 `.ttl-root` 内所有元素强制 `animation: none; transition: none`，包含骨架屏与 Toast。

快速入口不在 `.ttl-root` 下（它挂在 composer 的槽位里），所以 `QUICK_CSS_TEXT` 自带一份同样的兜底，覆盖 `.ttl-quick-trigger` / `.ttl-quick-panel` 及其伪元素与后代 —— 两处成对存在，改一处要同步另一处。设置卡与开关在面板里（样式并入 `CSS_TEXT`、十六期起不再单独一份样式表），因此自动落在上面那条 `.ttl-root` 兜底里。

## 实现位置

| 文件 | 内容 |
| --- | --- |
| `src/client/styles.js` | 动效令牌（`--ttl-ease-*` / `--ttl-dur-*`）、全部 `@keyframes`、各组件动画挂载、`prefers-reduced-motion` 兜底 |
| `src/client/styles.js` 的 `QUICK_CSS_TEXT` + `QuickStyleSheet` | 快速入口专用：`ttl-quick-in` / `ttl-quick-row-in` / `ttl-quick-notice-in` / `ttl-quick-breathe` 四个 keyframes、胶囊 hover/active（0.98）过渡、`.ttl-quick-*` 的 reduced-motion 兜底 |
| `src/client/styles.js` 的 `CSS_TEXT`（`.ttl-settings*` / `.ttl-pref-*`） | 设置卡与开关：卡片淡入（复用 `ttl-fade-in`）、轨道变色 + 圆点位移（150ms）、焦点环；随 `.ttl-root` 一起吃 reduced-motion 兜底 |
| `src/client/views/table.js` / `views/board.js` | 行 / 卡片入场错位的 `animation-delay` |
| `src/client/quick.js` | 挂载时机决定动画频率：清单只在 `open` 时挂载（关闭即时卸载、无退出动画），所以 `ttl-quick-in` 每次展开只播一次；行按 `todo.id` 做 key，静默刷新时已有行不重挂载，只有新出现的行播 `ttl-quick-row-in` |

## 验收

`npm run verify` 全绿；动效不改变静态布局（`docs/images/` 的静态渲染在 `animation: none` 下与改版前一致）；真机刷新页面后人工确认一次体感。
