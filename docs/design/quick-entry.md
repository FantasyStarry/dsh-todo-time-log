# 快速入口：主输入框旁的「待办」胶囊

> 2026-11-10。本文是十四期「随时勾掉待办」的设计基线：为什么要有第二个入口、它和面板的分工、状态与边界。与 [操作逻辑](operation-logic.md)、[动效规范](motion.md) 配套。

## 一句话

**聊天时不用离开主界面：输入框下方常驻一枚「待办」胶囊，点开就是进行中清单，勾一下即完成（带撤销），也能在清单里直接记一条。**

## 为什么要有它

面板是「看全量、做整理」的地方，但它占掉整个主视图。真实使用中最高频的动作不是整理，而是「这件事刚做完，顺手勾掉」。为了这个动作切走主视图、找到那一行、勾掉、再切回来，成本远高于动作本身。

因此新增一个**快捷镜像**：它不是第二个面板，只做三件事 —— 看进行中、勾掉、记一条。

| 动作 | 面板（唯一完整入口） | 快速入口 |
| --- | --- | --- |
| 记录 | composer + `#分类 @文件 !优先级 ^类型` | 一行输入 + Enter，同一套 Host 解析（`/quick-add`） |
| 完成 | 行首勾选圈（撤销 toast） | 清单行勾选圈（卡片内撤销提示） |
| 查看 | 四视图 / 搜索 / 排序 / 筛选 | 只列「未完成」，按创建时间升序 |
| 编辑 / 删除 / 改分类 / 改优先级 / 类型 / 导入导出 | 面板 | 不做（`打开完整面板` 一跳） |

## 位置与槽位

| 半 | 槽位 | 作用 |
| --- | --- | --- |
| trigger | `conversation.composer.dock` | 输入框下方的常驻胶囊（`order: 40`），随会话常驻；agent 执行中 activity 展开时仍然可见 |
| overlay | `conversation.input.overlay` | 展开的清单卡片，锚在 composer 卡片上沿之上（`position: absolute; bottom: calc(100% + 8px)`），与宿主 `@` 菜单同一套做法，不会被 docked composer 裁切 |

不放进 `conversation.input.left`：那一行在 activity 展开时会被 `hidden` 掉，正好错过「刚跑完一轮想勾掉」的时刻。

## 状态

```text
关闭 --点胶囊--> 打开（首帧用缓存，同时静默刷新）
 打开 --Esc / × / 再点胶囊--> 关闭（无退出动画）
 打开 --勾选--> 行即时移除 + 卡片内提示「已完成 · 用时 X [撤销]」
 打开 --输入 + Enter--> /quick-add，成功后刷新列表（多条/跳过/错误合并提示）
```

- 数据：`POST /list {filter:'pending', sortBy:'createdAt', direction:'asc'}`；`POST /complete` / `POST /uncomplete` / `POST /quick-add`，与面板同一 Host 实现，不新增接口。
- 胶囊计数 = 未完成条数；0 条时候选文案退化为「展开待办清单」，胶囊仍在（还能用它记一条）。
- 刷新：挂载时拉一次；打开时静默刷新；之后每 60s 静默刷新一次（多窗口 / 面板里改完能跟上）；「进行中 X」每 30s 走一次本地时钟，不发请求。
- 提示：默认 6s 自动消失；成功类带「撤销」，`role="status"`，错误 `role="alert"`。提示绝对定位在卡片底部，不推动列表。

## 只读 / 只做完成

清单里每行只有「勾选圈 + 标题 + 分类点 + 进行时长」。编辑、删除、改优先级、改类型都留在面板：快捷入口一旦长出第二类操作，就会变成「缩小版面板」，重复操作逻辑文档里反对的入口摊平。

## 动效

- 卡片入场：淡入 + 上移 6px，160ms（`--ttl-ease-out`）。
- 新行：淡入 180ms（`--ttl-dur-base`，与面板表格行同一参数）。
- 勾掉后的行即时消失：不做离场动画（与面板「删除 / 过滤移除即时消失」一致）。因此清单里**没有**对勾 0.55→1 的弹簧动画——那一拍只存在于面板的勾选圈；这里为了不产生「删掉了吗」的歧义，行直接离场。
- `prefers-reduced-motion: reduce` 下全部关闭（`QUICK_CSS_TEXT` 自带一份兜底，不依赖面板 `.ttl-root` 的作用域）。

## 无障碍

- 胶囊：真 `button`，`aria-haspopup="dialog"` + `aria-expanded`，`aria-label` 带条数。
- 卡片：`role="dialog"` + `aria-label`；打开时焦点进新建输入框；`Esc` 关闭并把焦点还给胶囊。
- 每行勾选圈复用 `CheckButton`（`role="checkbox"`，`aria-label` = 「完成待办：标题」）。
- 关闭按钮有 `aria-label`；「打开完整面板」是文本按钮。

## 明确不做

- 不做已完成列表 / 历史（面板有）；不做筛选排序（清单恒为「未完成 + 创建时间升序」）。
- 不做行内编辑、删除、改分类；不做拖拽。
- 不监听 document 做「点外部关闭」（客户端产物只允许一处只读 `document.activeElement`，见 `test/client-audit.mjs`）：关闭 = 再点胶囊 / `Esc` / ×。

## 实现落点

| 文件 | 职责 |
| --- | --- |
| `src/client/quick.js` | 模块级 store（数据 + 开关 + 提示）、`QuickTrigger`、`QuickOverlay`、技能注册 `registerQuickEntry` |
| `src/client/app.js` | 注册 `conversation.composer.dock` 与 `conversation.input.overlay` 两个槽位 |
| `src/client/styles.js` | `QUICK_CSS_TEXT` + `QuickStyleSheet`（复用面板的勾选圈 / 分类点视觉，只用主题 token） |
| `src/client/i18n.js` | `quick.*` 文案（zh / en 成对） |
| `test/ui/quick.test.mjs` | jsdom 真实渲染：计数、展开、勾掉 + 撤销、快速新建、空态 / 错误 / 重试、Esc、打开面板 |
| `test/client-audit.mjs` | 两个新槽位注册 + 类名前缀 / token / i18n 成对的静态门禁 |

## 验收

`npm run verify` 全绿；UI 行为以 `test/ui/quick.test.mjs` 为准；视觉以 `.tools/preview/` 生成的 composer 外壳截图为准（真机需刷新页面后人工确认）。
