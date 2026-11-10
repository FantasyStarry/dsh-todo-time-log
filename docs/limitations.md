# 已知限制与 TODO（不确定处及适配层）

> 本文档是 [README](../README.md) 的扩展说明，列出当前构建里不确定的地方、已知限制与待办（TODO）；排查兼容性问题时请对照阅读。

[← 返回 README](../README.md) · [架构与关键代码](./architecture.md) · [开发与测试](./development.md) · [验证记录](./verification-log.md)

---

1. **`Config` schema 形态（TODO config-schema）**
   本构建把「导出普通 JSON Schema 对象」视为非法：行状态曾为 `status: "unsupported"`，激活报 `Cannot read properties of undefined (reading 'validate')`。当前**不导出 `Config`**（`lib/index.js` 导出 `DEFAULT_CONFIG` 常量用于文档化默认值），`Config.listConfigs` 对该行报告 `status: "absent"`，`apply()` 仍防御式读取 `config.dataFile`。
   适配层：把 `DEFAULT_CONFIG` 处注释里的 zod 片段复原并加 `zod` 依赖即可恢复配置表单，插件其余代码无需改动。
2. **`inject` 的对象形式（TODO cordis-inject）**
   `export const inject = { optional: [...] }` 会被当前 Loader 当作依赖名为 `optional` 的服务，导致行永久 `pending`。已改为数组形式 `inject = ['webServer', 'tools']`（缺服务时保持 pending 而非崩溃）。`mountOn()` 仍保留 `ctx.inject([...], cb)` 优先、`ctx.get()` 兜底的适配逻辑。
3. **时区（TODO time-zone）**
   展示固定使用 Host/浏览器本地时区。若将来需要「指定 IANA 时区展示」，只需替换 `lib/time.js` 的 `formatLocalDateTime()` 内部实现（`TODO(time-zone)` 已标注），存储格式无需变更。
4. **Client 文案与 locale 服务（TODO client-locale）**
   UI 文案集中在 `src/client/i18n.js` 的 `I18N` 字典（构建后进入 `lib/client.js`；zh 默认 / en 兜底），暂未接入宿主 Client locale 服务；槽位注册已带 `label` thunk，后续接入时只需把 `t()` 数据源换成宿主 locale。
5. **渲染外观未截图验证**
   已通过 `cordis_inspect_query`（Client Slots）确认 `main` 与 `sidebar.panellist` 的 occupant 均为 `active: true`（说明 `client.js` 已在浏览器里成功加载并注册），但本会话没有浏览器截图能力，**页面视觉外观（间距/主题色/明暗切换）未做像素级验收**，建议首次打开时人工确认。
6. **对话式录入是启发式解析（TODO chat-parser）**
   面板内的自然语言解析是确定性的 Host 侧规则（`lib/parse.js`：`#分类`、填充词剥离、按行/分号拆条、多标记剥离、`@文件` 引用），**不是模型理解**：复杂句式（「下周三之前把报告发给老板」这类含时间/对象语义的句子）只会被当作标题文本。需要真正的语义解析时，走智能体路径（`todo_time_log` 工具，模型自己理解后再结构化调用）；解析器已隔离为纯函数 `parseQuickAdd()`，替换点单一。
7. **文件引用是「工作区相对路径」，不带工作区身份（TODO file-scope）**
   `files: ["lib/store.js"]` 记录的是相对路径；如果你在多个工作区之间切换，同一相对路径在不同工作区可能指向不同文件。当前实现只用于展示/复制路径与分类派生，不解析真实文件，因此不会出错；若要跨工作区精确定位，需要给 Todo 增加 `workspaceRoot` 字段（v4）。
8. **数据文件位置**
   Host 进程通常没有 `DSH_PROFILE_DIR`（它是 profile 启动器的环境变量），因此默认落在 `~/.dsh/todo-time-log/todos.json`；如需按 profile 隔离，请显式配置 `dataFile`。
9. **看板 P1 已落地（七期）**
   「移到分类」（分类分组/泳道下改 `project`，带撤销 toast，作为 WCAG 2.5.7 的单指针替代）；泳道（状态 × 分类，可折叠、未完成泳道可快捷新建）；`/` 搜索、`n` 新建、`f` 筛选三个面板内快捷键；舒适/紧凑密度。指针拖拽仍暂缓（两列板上拖拽≈点完成，成本/收益不匹配），将来若要加，用 HTML5 DnD 且必须保留菜单与键盘路径。
10. **看板剩余 P2（需要继续扩模型）**
    已落地 `priority`（v4）与 `type`（v5，见 [§2 数据模型](./architecture.md#数据模型)）；仍待评估：`dueAt`（与日历/甘特时间语义交叉，需先统一「按创建还是按截止」）、`order`（手动排序，需与排序互斥）、指针拖拽增强、多值 `tags`（若单值 type 不够用再考虑 v6）。注意 v5 对旧版插件是「不支持版本」（会归档重建），发布前确认没有旧 Host 共存。
11. **导入 / 导出的边界（九期）**
    - 导出固定为**全部待办**，暂不支持「只导出当前筛选」；CSV 的 `耗时(分钟)` 是派生列，导入时忽略。
    - CSV 时间按**本地时区**解释（JSON 仍是无歧义的 ISO-8601 UTC）；CSV 时间只到**秒**，回导会丢掉毫秒（真实数据实测：JSON 逐字段一致，CSV 除毫秒外一致），需要完全无损请用 JSON。
    - 手工编辑 CSV 后回导，id 列留空会被当作新记录，因此重复导入同一份无 id 的 CSV 会产生重复项。
    - CSV 不做电子表格公式注入防护：标题以 `= + - @` 开头时 Excel 会按公式解释；导出文件来自本机自己的数据，若需分享给他人请先检查这些单元格。
    - 单次导入 ≤ 5000 条、请求体 ≤ 8 MiB，整份文件在内存中解析（没有流式导入）；`<dataFile>.bak-*` 备份不会自动清理。
    - 导入 / 导出 / 恢复是 UI 专用路由，尚未注册到 `todo_time_log` 工具；多窗口同时写入时建议只在一个窗口执行「覆盖全部」。
12. **快速入口与开关的边界（十四 / 十五 / 十六期）**
    - 只列**未完成**条目（按创建时间升序），不提供筛选 / 排序 / 已完成 / 编辑 / 删除；这些动作留在面板（「打开完整面板」一跳）。
    - 关闭方式 = 再点胶囊 / `Esc` / `×`：客户端产物只允许一处只读 `document.activeElement`（见 `test/client-audit.mjs`），因此**不监听文档做「点外部关闭」**。
    - `/list` 返回的数据修复提示（创建时间缺失、完成时间早于创建时间等）只在面板展示，快速入口不重复播报。
    - 依赖宿主 `conversation.composer.dock` 与 `conversation.input.overlay` 两个槽位：旧版 DSH 上注册失败只 warn，面板与 `/todo` 命令不受影响（胶囊不出现）。
    - 胶囊/清单只在「有会话的 composer」里出现：新会话 Hero 态、以及切到本插件面板（composer 不渲染）时不可见。
    - **开关只覆盖快速入口本身**（胶囊 + 清单，位置在待办面板页头 → 「设置」卡里）：关掉不影响面板、`/todo` 命令与待办数据，也不提供「按会话 / 按浏览器」的独立偏好 —— 偏好只有 `quickEntry` 一个键，存在 Host 侧 `todos.settings.json`，同一实例的所有已认证浏览器共享。
    - 偏好文件损坏 / 不可读时按**默认开**工作并记一条 warn，下一次切换开关会覆盖它；读取偏好失败（`/settings` 返回 404 / 501、网络错误等）按 fail-open 处理（仍显示胶囊，面板设置卡里给出原因），所以「设置里读不到」不会让入口凭空消失。
    - 开关在插件**自己的面板**里（页头 → 「设置」卡），随面板版本走、不占宿主槽位；面板没打开时看不到开关，但偏好与快速入口照常工作。
    - Host 没有设置存储（`/settings` 501）或路由缺失时，开关读不到 → fail-open（默认开）并在卡片里显示原因；此时切换开关也会失败并按「写失败不翻转」处理。
    - `/settings`、`/settings/update` 属于 **Host 半**：改完（含升级到带开关的版本）需要**关闭再开启插件或重启桌面端**才会加载，仅刷新页面只更新 Client 半（面板页头的设置卡是 Client 半，刷新即生效）。
