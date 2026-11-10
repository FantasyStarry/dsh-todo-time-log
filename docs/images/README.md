# docs/images — README 演示图

这里的 PNG **不是真机截图**，而是用仓库里真实的构建产物 `lib/client.js`（React 面板）加宿主
`@deepseek-ai/dsh-client-ui-theme` 的真实主题 token（`--dsw-*` 变量与深浅色两套调色板），在
jsdom 里挂载、`act()` 里触发交互进入目标状态后，再用无头 Chrome 静态渲染出来的演示图。
它用于 README 展示界面结构与状态，**真机外观请在刷新页面后人工确认一次**。

- 生成器：`.tools/preview/`（`render.mjs` + `annotate.js` + `trim.py`，该目录已被 `.gitignore` 忽略，不随仓库提交）；
  十四期的三张 `quick-entry*.png` 由另一份脚本 `.tools/quick-preview/render-quick.mjs` 生成（只读参考 `render.mjs`，
  外壳改用宿主**真实**的 composer 类名与 CSS：`GRgSLq_*`（InputBar）+ `A6Bq1a_*`（ContextMeter），从
  `.refs-ui/dsh-client-ui-conversation/lib/client.js` 里抽出），几何数字用 `.tools/quick-preview/probe.mjs` 在
  无头 Chrome 里读 `getComputedStyle` / `getBoundingClientRect` 复核；
  十五期的两张 `settings-quick-entry*.png` 由 `.tools/quick-preview/render-settings.mjs` 生成，外壳用宿主**真实**的设置页
  CSS（`SettingsRoot` / `GeneralSection` / `DeveloperToolsRow` / `CurrentVersionRow` 四段，从 DSH 安装包的 `app.asar`
  里用 `.tools/asar.cjs` 抽出到 `.tools/refs-settings/`），几何用 `.tools/quick-preview/probe-settings.mjs` 复核；
- 数据：11 条固定中文演示数据（4 个分类、优先级/类型/文件引用齐全），时间相对生成时刻计算；
- 截图：无头 Chrome、DSF=2；除 `gantt`（1240 CSS 宽，需完整放下 1120px 时间轴）、
  `narrow`（560 视口，命中组件 `@media (max-width:560px)` 的单列堆叠断点）外，面板均为 940 CSS 宽；
  看板类四张按 880 CSS 宽渲染（两列铺满数据卡片）；图片底部保留 24 CSS px 留白；
- 字体：面板显式声明 `font-family: var(--dsw-font-family, …)`，静态预览与真机走同一套宿主字体栈
  （此前预览页没有字体声明、回落到浏览器默认字体，数字字宽与真机差约 3%）；
- 表格：`table-layout: fixed` + `<colgroup>` 固定列宽 —— 勾选列 40px、分类 104px、状态 160px
  （三枚徽标永远同一行）、创建/完成时间各 126px、操作 118px，标题列吃剩余宽度；标题最多两行截断，长标题不再把行高撑到 130px；
- 视觉语言（对齐参考设计）：行首完成勾选圈、分类色点（名称哈希到宿主状态色，明暗主题各自取色）、
  类型用**小号矩形标签**、状态用**带点的胶囊**、优先级改**箭头 + 文字**（↑高 / ↗中 / ↓低），
  数据卡片圆角 + 浅阴影、行内操作默认降亮、hover/键盘聚焦再提亮；
- 另有排查用的 `app-width` 场景（980 CSS、DSF=1、`--real` 读 `~/.dsh/todo-time-log/todos.json`），
  产物只落在 `.tools/preview/out/`，用于和真机截图逐行对照；
- 操作标注：在渲染页里按 `getBoundingClientRect()` 实时定位 ①②③④ 圆形编号徽章，底部图例条与面板等宽；
- 为排版清晰，渲染页对少量 CSS 做了覆盖（甘特页放开页面最大宽度、把「进行中」标签移到条尾外侧、看板列宽铺满数据卡片；`demo-quickadd` 在页面里隐藏下方数据卡片以便聚焦对话区），**组件源码未改**；像素级真机外观请以实际页面为准；
- 单张 PNG 均 ≤500KB。
- README 正文引用 15 张（banner / hero / board / calendar / gantt / dark / board-swimlanes / 4 张 demo-* /
  3 张 quick-entry* / `settings-quick-entry`）；`settings-quick-entry-off.png`、`chat-quickadd.png`、
  `complete-toast.png`、`narrow.png` 作为备用图保留在本目录，未放进 README 正文。

**关于 `quick-entry*.png`（十四期 快速入口）**：从下往上是「胶囊 + 上下文占用胶囊」在同一 dock 行、
composer 卡片、浮在卡片上沿之上的待办清单卡片（间距 8px）。卡片与胶囊来自仓库真实构建产物
`lib/client.js` 的两个槽位组件；卡片上方的**会话气泡是假对话**（只为说明清单浮在消息之上、不被裁切），
不是宿主组件；输入框里的 `+` / 模型名 / 模式 / 发送按钮是按宿主类名与几何画的静态占位，
`32%` 上下文胶囊同理。

- `quick-entry.png`：浅色、916×640 CSS（DSF 2）、清单展开 3 条进行中；
- `quick-entry-dark.png`：暗色（`body[data-ds-dark-theme]`）、同尺寸同数据，用于核对暗色对比度与卡片边界；
- `quick-entry-narrow.png`：640×680 CSS，清单宽 420 居中偏左、composer 卡片 608 宽（左右各 16px 留白）不越界。

**关于 `settings-quick-entry*.png`（十五期 快速入口开关）**：设置对话框（800 宽、左导航 188、内容列 564）的骨架与
每行排版用的是宿主**真实 CSS**；中间那一行「主输入框下方的待办快捷入口」是仓库真实构建产物里的
`settings.general.item` 组件（React 在 jsdom 里真实挂载后取出 HTML）；上下相邻行（外观 / 显示代码工作视图 / 当前版本）
用的是宿主同一套行样式与宿主 locale 文案，但**它们的控件是占位**（36×20 开关、分段控件按宿主 token 画），导航图标也是按分区
画的同风格占位。为了让画面不被大片留白占满，渲染页把面板高度改成跟随内容（宿主是固定 800×800），**组件源码未改**。

- `settings-quick-entry.png`：开关「开」——蓝色轨道、圆点在右，与上方「显示代码工作视图」的开关右边缘完全对齐；
- `settings-quick-entry-off.png`：开关「关」——灰色轨道、圆点在左（关掉后主输入框下方的「待办」胶囊不再挂载）。

| 文件 | 像素 | 大小 | 内容 |
| --- | --- | --- | --- |
| `banner.png` | 2400×540 | 221.7 KB | 顶部横幅：内联 `icon.svg` + 标题「待办时间日志」+ 副标题 + 四视图 / 时间线甘特 / 分类·优先级·类型 / 本地 JSON 四个特性 chip |
| `hero.png` | 1992×2096 | 319.9 KB | 默认表格视图：页头、新建待办行、固定两行工具栏（视图/搜索 + 状态/分类/类型筛选）、11 行表格（行首勾选圈、分类色点、状态胶囊 + 类型小标签 + 优先级箭头、文件 chip 挂在标题下、完成时间列双行「时刻 + 用时/进行中」、行尾 ⋯） |
| `board.png` | 1872×1866 | 267.2 KB | 看板「按状态」两列：未完成 6 张、已完成 5 张，卡片含优先级/类型徽标、文件 chip、已进行/用时 |
| `board-swimlanes.png` | 1872×2089 | 267.4 KB | 看板「状态 × 分类」泳道：两列共 6 条泳道（未完成：工作 / 学习 / 未分类；已完成：产品 / 工作 / 生活），未分类排最后，泳道可折叠 |
| `gantt.png` | 2592×1683 | 187.4 KB | 甘特图（近 7 天）：按分类分组、时间刻度、创建→完成的绿色条、未完成延伸到「现在」的蓝色条 +「进行中」、红色「现在」竖线 |
| `calendar.png` | 1992×2701 | 248.8 KB | 日历月视图：今天（11-05）高亮，格子最多 3 条 +「+1」，下方为当天 4 条待办列表 |
| `chat-quickadd.png` | 1992×2507 | 384.9 KB | 备用图：顶部「批量」模式（与单条录入共用同一捕获区）：工作区切换、已发送的用户气泡、「成功添加 2 条待办…撤销」回执气泡、输入框中保留示例文本 |
| `complete-toast.png` | 1992×2096 | 324.3 KB | 备用图：点行首勾选圈完成后的底部 toast（成功图标 + 已标记为完成。 + 撤销 + 关闭），页面不位移，该行完成时间已写入 |
| `dark.png` | 1856×1820 | 268.0 KB | 暗色主题（`data-ds-dark-theme`）下的看板视图，状态点 / 勾选 / 次级文本对比度 |
| `narrow.png` | 1120×2860 | 249.5 KB | 备用图：窄面板（560 视口）响应式，看板单列堆叠、工具栏与新建表单换行 |
| `demo-create.png` | 1992×2336 | 356.8 KB | 标注示范：① 输入框 ② 分类选择 ③ 优先级与类型 ④ 添加/Enter，输入框已聚焦并填「写周报 #工作」 |
| `demo-complete.png` | 1992×2284 | 368.6 KB | 标注示范：① 点行首勾选圈 ② 底部 toast 可撤销、页面不位移 ③ 完成时间与用时自动写入该行 |
| `demo-quickadd.png` | 1992×1432 | 222.4 KB | 标注示范（聚焦到批量录入卡片）：① 切换工作区 ② 一句话多条 + `#分类 @文件 !优先级 ^类型` ③ 回执气泡可一键撤销；由新建框右侧「批量」进入 |
| `demo-board.png` | 1872×2445 | 335.5 KB | 标注示范：① 四视图分段 ② 分组/密度/搜索/筛选 ③ 卡片「⋯」含移到分类、优先级、类型、编辑、删除 ④ 已完成列默认 10 条可显示全部 |
| `quick-entry.png` | 1832×1280 | 150.5 KB | 十四期快速入口（浅色 916×640）：输入框下方「待办 3」胶囊与 `32%` 上下文胶囊同排，卡片上沿之上浮出清单（新建一行 + 3 条进行中 + 打开完整面板 / 勾选即完成） |
| `quick-entry-dark.png` | 1832×1280 | 151.5 KB | 同上，暗色主题（`body[data-ds-dark-theme]`）：卡片底色 `rgba(48,49,54,.64)` + 磨砂，核对暗色对比度与卡片边界 |
| `quick-entry-narrow.png` | 1280×1360 | 143.6 KB | 同上，640 CSS 宽：清单 420 宽不越界、composer 卡片 608 宽（左右各 16px 留白） |
| `settings-quick-entry.png` | 1960×1120 | 122.0 KB | 十五期：设置 → 通用里的「主输入框下方的待办快捷入口」一行，开关为**开**（轨道 36×20、圆点在右，与宿主相邻行开关右对齐） |
| `settings-quick-entry-off.png` | 1960×1120 | 121.8 KB | 同上，开关为**关**（灰轨道、圆点在左）；关掉后主输入框下方的「待办」胶囊不再挂载 |

如需重新生成：`node .tools/preview/render.mjs`（全部）或 `node .tools/preview/render.mjs hero board`（指定场景）；
十四期三张：`node .tools/quick-preview/render-quick.mjs`（全部）或 `node .tools/quick-preview/render-quick.mjs quick-entry-dark`（指定场景），
量几何用 `node .tools/quick-preview/probe.mjs quick-entry 916 640`；
十五期两张：`node .tools/quick-preview/render-settings.mjs`，量几何用
`node .tools/quick-preview/probe-settings.mjs settings-quick-entry 980 560`。
