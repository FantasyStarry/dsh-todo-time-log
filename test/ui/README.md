# test/ui — UI 渲染验收 harness

把原先在仓库外的「待办时间日志」UI 渲染验收搬进仓库，CI 可复现。

## 用法

```bash
node --test test/ui/panel.test.mjs     # 只跑 UI harness
npm test                               # 连同 parse/http/smoke 等一起跑
```

依赖：`jsdom@26`、`react@18.3`、`react-dom@18.3`（均为 devDependencies，已随 `npm install` 安装）。

## 它做什么

在 jsdom 里构造 `window/document` 并赋给 `globalThis`，设置
`window.__ModuleLoader__.load(...)` 捕获 `lib/client.js` 的模块表，
用真实 React 调用 `factory(require)` → `apply(ctx)`，从 `main` 槽取到 `Panel`
后用 `createRoot` + `act` 真实渲染；`globalThis.fetch` 全量 mock，按 URL 后缀返回
`{ ok: true, value }` 信封。每次用例独立挂载/卸载，结束时还原全局并关闭 jsdom。

## 能验证什么

- 页头标题/副标题（含 `/list` 返回的 `timeFormat`）、新建输入框、四视图分段、筛选计数；
- 表格视图渲染 2 行待办、时间列格式、`未完成`/`已完成` 徽标；
- `/list` 空列表的空态文案与下一步按钮；
- `/list` 失败的 `role=alert` 错误态、错误文案、`重试` 按钮及点击后恢复；
- 点击「看板」后 `.ttl-board` 与按状态分列（未完成/已完成）的看板卡片；
- mock 调用记录（`/list` 为 POST、切视图会重新拉取等）用于核对请求契约。

## 不能验证什么

- jsdom 没有布局/绘制/滚动：不校验尺寸、对齐、溢出、响应式断点，也不产生真实截图；
- 不加载真实 CSS（`<style>` 注入但不参与断言），视觉回归需 Playwright 截图对比；
- 不发真实 HTTP/不连 Host：接口成功/失败态靠 mock 构造，Host 路由与存储由 `test/http.test.mjs` 覆盖；
- 只合成 click 事件，键盘/拖拽/剪贴板等交互未覆盖；
- Playwright 截图回归是可选项，本轮未接入。
