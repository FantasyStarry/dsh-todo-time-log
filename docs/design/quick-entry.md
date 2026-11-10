# 快速入口：主输入框旁的「待办」胶囊

> 2026-11-10。本文是十四期「随时勾掉待办」的设计基线：为什么要有第二个入口、它和面板的分工、状态与边界。与 [操作逻辑](operation-logic.md)、[动效规范](motion.md) 配套。

## 一句话

**聊天时不用离开主界面：输入框下方常驻一枚「待办」胶囊，点开就是进行中清单，勾一下即完成（带撤销），也能在清单里直接记一条。不想看到它的人可以在待办面板页头「设置」里关掉（默认开）。**

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

开关的 UI **不属于 composer 槽位**：它在**待办面板页头 → 「设置」**里（十六期，见下节「开关」）。

## 开关（待办面板页头 → 设置，十五 / 十六期）

默认**开**。开关长在插件自己的面板里：页头右侧「设置」按钮展开一张设置卡，卡里就是这一行（十六期从宿主「设置 → 通用」搬回来，理由见下）。关掉 = **不挂载**，不是「挂载后隐藏」：

- `createQuickEntry()` 返回 `mount()` / `unmount()`，偏好决定调哪个；关闭后**不注册** `conversation.composer.dock` / `conversation.input.overlay`，组件不挂载，因此也**不会拉 `/list`**、60s 轮询不存在；
- 首屏：`apply()` 里先读一次偏好，读到「关」就根本不挂载（不会先闪一下再消失）；在设置卡里重开时立即挂载，计数与清单照常工作；
- 开关只覆盖快捷入口本身：面板、`/todo` 命令与待办数据都不受影响（那两个槽位不注册而已）。

**为什么在面板里而不是系统设置**：用户的原话是「放系统设置太远」—— 关掉一个聊天输入框旁的胶囊不该要求离开会话、进设置、找插件那一行。放在面板页头后，开关与它控制的对象在同一个产品区域，顺手就能找到；插件详情页也走不通 —— 当前构建没有导出 `Config` schema，详情页渲染不出配置表单。

偏好存在 Host 侧（`<dataFile>` 同目录同主名的 `todos.settings.json`，信封 `{version:1, updatedAt, settings:{quickEntry}}`），所以同一实例的每个已认证浏览器共享同一个值；不塞进 `todos.json` 的 `version` 信封，因为那是严格契约（旧版插件遇不支持的版本会归档重建），且「写偏好」不该扰动「写待办」。

容错口径：读失败 **fail-open**（按默认开挂载，并在设置卡里用 `role="alert"` 显示原因）；写失败**不乐观翻转**（开关保持原状态、胶囊保留，显示保存失败原因）；偏好文件损坏时回落默认值并记 warn，下一次写入覆盖它。

## 状态

```text
关闭 --点胶囊--> 打开（首帧用缓存，同时静默刷新）
 打开 --Esc / × / 再点胶囊--> 关闭（无退出动画）
 打开 --勾选--> 行即时移除 + 卡片内提示「已完成 · 用时 X [撤销]」
 打开 --输入 + Enter--> /quick-add，成功后刷新列表（多条/跳过/错误合并提示）

（偏好=关）--在面板设置卡里打开--> 挂载两个槽位（默认就是这一步）
挂载中 --在面板设置卡里关掉--> 卸载两个槽位：胶囊、清单、60s 轮询一起停（不拉 /list）
```

- 数据：`POST /list {filter:'pending', sortBy:'createdAt', direction:'asc'}`；`POST /complete` / `POST /uncomplete` / `POST /quick-add`，与面板同一 Host 实现，待办侧不新增接口（开关偏好另有 `/settings` 与 `/settings/update` 两条，见上节）。
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
- 设置卡与开关的动效在面板 CSS 里：卡片淡入 160ms、开关 150ms 轨道变色 + 圆点位移；它们跟着 `.ttl-root` 的 reduced-motion 兜底走（不在 `QUICK_CSS_TEXT` 里）。

## 无障碍

- 胶囊：真 `button`，`aria-haspopup="dialog"` + `aria-expanded`，`aria-label` 带条数。
- 卡片：`role="dialog"` + `aria-label`；打开时焦点进新建输入框；`Esc` 关闭并把焦点还给胶囊。
- 每行勾选圈复用 `CheckButton`（`role="checkbox"`，`aria-label` = 「完成待办：标题」）。
- 关闭按钮有 `aria-label`；「打开完整面板」是文本按钮。
- 设置入口与设置卡（在面板页头，十六期）：入口是 ghost `button` + `aria-controls="ttl-settings-panel"` + `aria-expanded`；卡片是 `<section>` + `aria-label="设置"`，`Esc` 收起（面板根节点的键盘处理，焦点在输入类控件里时不拦截）。卡里的开关是 `button` + `role="switch"` + `aria-checked`，`aria-label` 就是「主输入框下方的待办快捷入口」；读取 / 写入期间 `aria-busy="true"` + `disabled`（防止连点写出两个值）；读取失败与保存失败的说明都是 `role="alert"`。

## 明确不做

- 不做已完成列表 / 历史（面板有）；不做筛选排序（清单恒为「未完成 + 创建时间升序」）。
- 不做行内编辑、删除、改分类；不做拖拽。
- 不监听 document 做「点外部关闭」（客户端产物只允许一处只读 `document.activeElement`，见 `test/client-audit.mjs`）：关闭 = 再点胶囊 / `Esc` / ×。
- 开关不做「按会话 / 按浏览器」的独立偏好（偏好只有 `quickEntry` 一个键，存在 Host、全实例共享），也不做「临时隐藏」之类的第二套状态。
- 开关不放进宿主系统设置页（`settings.general.item` 槽位，十五期试过、十六期移走）：离使用现场太远，且旧版宿主上该槽位可能不存在。

## 实现落点

| 文件 | 职责 |
| --- | --- |
| `src/client/quick.js` | 模块级 store（数据 + 开关 + 提示）、`QuickTrigger`、`QuickOverlay`、`createQuickEntry()` 返回 `mount` / `unmount` / `isMounted` |
| `src/client/prefs.js` | 偏好控制器（`load` / `setEnabled` / `getSnapshot` / `subscribe`，读失败 fail-open、写失败不翻转）+ 模块级单例 `setQuickEntryPreference` / `getQuickEntryPreference`；**不含 UI** |
| `src/client/panel.js` | 页头「设置」按钮 + 设置卡（标题 / Host 提示 / 开关行 / 错误提示）、`Esc` 收起；通过单例订阅偏好 |
| `src/client/app.js` | 建控制器、放进单例、`load()`；实际的两个 composer 槽位由 `mount()` 注册；不再注册宿主设置槽位 |
| `src/client/styles.js` | `QUICK_CSS_TEXT` + `QuickStyleSheet`（快速入口）；设置卡与开关的 `.ttl-settings*` / `.ttl-pref-*` 并入面板 `CSS_TEXT`（跟着 `.ttl-root` 的 reduced-motion 兜底走） |
| `src/client/i18n.js` | `quick.*`、`settings.*`（标题 / 入口 / Host 提示）与 `pref.*`（行标题 / 说明 / 读取失败 / 保存失败）文案，zh / en 成对 |
| `lib/settings.js` | 偏好文件：`resolveSettingsFile()`、`normalizeSettings()`、`normalizeSettingsPatch()`、`createSettingsStore()`（信封 v1、原子写；读改写整体入队，并发 last-write-wins） |
| `lib/index.js` | `/settings` 与 `/settings/update` 路由、`apply()` 里接线（`settingsStore` 缺省时 501） |
| `test/settings.test.mjs` / `test/http-settings.test.mjs` | 偏好存储（含并发 last-write-wins）与两条路由的用例（15 + 9） |
| `test/ui/quick.test.mjs` | jsdom 渲染：计数、展开、勾掉 + 撤销、快速新建、空态 / 错误 / 重试、Esc、打开面板、**面板设置卡开关的卸载 / 恢复 / fail-open**（12 例） |
| `test/client-audit.mjs` | 快速入口两槽位 + 面板设置入口 / 设置卡 + 类名前缀 / token / i18n 成对的静态门禁 |

## 验收

`npm run verify` 全绿；UI 行为以 `test/ui/quick.test.mjs` 为准；视觉以 `.tools/preview/` 生成的 composer 外壳截图为准（真机需刷新页面后人工确认）。
