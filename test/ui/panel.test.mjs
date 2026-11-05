/**
 * UI 渲染验收 harness（进仓库版）：在 jsdom 里真实挂载 lib/client.js 构建产物，
 * 用真实 react@18.3 + react-dom@18.3 渲染「待办时间日志」面板，断言首屏 DOM。
 *
 * 覆盖：页头 / 新建输入框 / 四个视图分段 / 筛选计数 / 表格两行 / 空态 / 错误态与
 * 重试 / 看板视图切换 / 已完成徽标。网络层全 mock（mock globalThis.fetch），
 * 不发真实 HTTP 请求，也不依赖 Host、浏览器或截图。
 *
 * 运行：node --test test/ui/panel.test.mjs
 */
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { after, before, test } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { createRoot } from 'react-dom/client';
import * as ReactDOMTestUtils from 'react-dom/test-utils';

/** 构建产物：lib/client.js（浏览器模块，ESM 求值时会调用 window.__ModuleLoader__.load）。 */
const CLIENT_ENTRY = fileURLToPath(new URL('../../lib/client.js', import.meta.url));
const BASE_URL = 'http://127.0.0.1:57950/';
/** 故意与面板默认值不同：页头副标题用的是 /list 返回的 timeFormat。 */
const TIME_FORMAT = 'YYYY/MM/DD HH:mm:ss';
const CREATED_AT = '2026-11-03T09:05:00+08:00';
const COMPLETED_AT = '2026-11-03T10:30:00+08:00';
const TODO_PENDING = {
  id: 'todo-pending',
  title: '写周报',
  project: '工作',
  files: ['docs/report.md'],
  priority: 'high',
  type: 'chore',
  status: 'pending',
  createdAt: CREATED_AT,
  completedAt: null,
  updatedAt: CREATED_AT,
};
const TODO_COMPLETED = {
  id: 'todo-completed',
  title: '修复登录 Bug',
  project: '工作',
  files: [],
  priority: '',
  type: 'bug',
  status: 'completed',
  createdAt: CREATED_AT,
  completedAt: COMPLETED_AT,
  updatedAt: COMPLETED_AT,
};
const PROJECT_SUGGESTIONS = [
  { name: '工作', source: 'used', count: 2 },
  { name: 'docs', source: 'folder', count: 1 },
];

const act = typeof React.act === 'function' ? React.act : ReactDOMTestUtils.act;

let dom = null;
let savedGlobals = {};
let importSeq = 0;

//#region jsdom 环境
/** jsdom 缺失的浏览器 API 兜底；面板当前未依赖布局 API，这里防御未来改动。 */
function polyfillBrowserApis(window) {
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = (query) => ({
      matches: false,
      media: String(query || ''),
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    });
  }
  if (typeof window.ResizeObserver !== 'function') {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (typeof window.IntersectionObserver !== 'function') {
    window.IntersectionObserver = class IntersectionObserver {
      constructor() {
        this.root = null;
        this.rootMargin = '';
        this.thresholds = [];
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    };
  }
  if (!window.navigator.clipboard) {
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => {}, readText: async () => '' },
    });
  }
  if (typeof window.crypto === 'undefined') {
    window.crypto = globalThis.crypto;
  }
}

/**
 * 用一个 descriptor 覆盖 globalThis 上的属性并记下原来的 descriptor。
 * Node 26 的 globalThis.navigator 只有 getter（不可直接赋值），所以统一走
 * defineProperty；所有被覆盖的属性都是 configurable 的，after() 里可原样还原。
 */
function overrideGlobal(key, value) {
  savedGlobals[key] = Object.getOwnPropertyDescriptor(globalThis, key) ?? null;
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    enumerable: true,
    value,
  });
}

/** 把 jsdom 的 window/document 等装到 globalThis，并记录原值供 after() 还原。 */
function installDom() {
  dom = new JSDOM('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>', {
    url: BASE_URL,
    pretendToBeVisual: true,
  });
  const window = dom.window;
  polyfillBrowserApis(window);

  savedGlobals = {};
  const next = {
    window,
    document: window.document,
    navigator: window.navigator,
    HTMLElement: window.HTMLElement,
    HTMLInputElement: window.HTMLInputElement,
    Element: window.Element,
    Node: window.Node,
    Event: window.Event,
    MouseEvent: window.MouseEvent,
    KeyboardEvent: window.KeyboardEvent,
    CustomEvent: window.CustomEvent,
    MutationObserver: window.MutationObserver,
    SVGElement: window.SVGElement,
    localStorage: window.localStorage,
    sessionStorage: window.sessionStorage,
    ResizeObserver: window.ResizeObserver,
    IntersectionObserver: window.IntersectionObserver,
    getComputedStyle: (element, pseudo) => window.getComputedStyle(element, pseudo),
    requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
    cancelAnimationFrame: (id) => window.cancelAnimationFrame(id),
    matchMedia: (query) => window.matchMedia(query),
    // React 18 的 act 需要这个标记，否则每轮渲染会打印告警。
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  for (const [key, value] of Object.entries(next)) overrideGlobal(key, value);
}

function restoreDom() {
  for (const [key, descriptor] of Object.entries(savedGlobals)) {
    if (descriptor === null) delete globalThis[key];
    else Object.defineProperty(globalThis, key, descriptor);
  }
  savedGlobals = {};
  if (dom !== null) {
    dom.window.close();
    dom = null;
  }
}
//#endregion

//#region fetch mock
const okReply = (value) => ({ ok: true, status: 200, payload: { ok: true, value } });
const failReply = (status, code, message) => ({
  ok: false,
  status,
  payload: { ok: false, error: { code, message } },
});

/** /list 的成功响应：todos / stats / projects / timeFormat 与 Host 契约一致。 */
function listValue(body = {}) {
  const all = [TODO_PENDING, TODO_COMPLETED];
  const filter = body.filter === 'pending' || body.filter === 'completed' ? body.filter : 'all';
  const todos = filter === 'all' ? all : all.filter((todo) => todo.status === filter);
  return {
    todos,
    stats: { total: 2, pending: 1, completed: 1 },
    projects: [
      { name: '工作', count: 2, pending: 1, completed: 1 },
      { name: '', count: 0, pending: 0, completed: 0 },
    ],
    filter,
    sortBy: body.sortBy ?? 'createdAt',
    direction: body.direction ?? 'desc',
    project: body.project ?? null,
    notices: [],
    timeFormat: TIME_FORMAT,
  };
}

/** 默认 API 路由：/list、/projects、/workspaces 都是 {ok:true,value} 信封。 */
function defaultHandler(overrides = {}) {
  return (action) => {
    const override = overrides[action];
    if (typeof override === 'function') return override();
    if (overrides[action] !== undefined) return overrides[action];
    if (action === 'list') return okReply(listValue());
    if (action === 'projects') {
      return okReply({ workspace: '', suggestions: PROJECT_SUGGESTIONS });
    }
    if (action === 'workspaces') {
      return okReply({ active: '', workspaces: [{ path: '', title: '工作区', source: 'session' }] });
    }
    return okReply({});
  };
}

/** 安装 fetch mock；返回调用记录与还原函数。 */
function installFetch(handler) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = (input, init = {}) => {
    const href = typeof input === 'string' ? input : String(input && input.url ? input.url : input);
    const pathname = new URL(href, BASE_URL).pathname;
    const segments = pathname.split('/').filter((segment) => segment !== '');
    const action = segments.length > 0 ? segments[segments.length - 1] : '';
    let body = {};
    if (typeof init.body === 'string' && init.body !== '') {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = {};
      }
    }
    calls.push({ action, body, url: href, method: init.method });
    return Promise.resolve()
      .then(() => handler(action, body, calls))
      .then((reply) => ({
        ok: reply.ok !== false,
        status: typeof reply.status === 'number' ? reply.status : reply.ok === false ? 500 : 200,
        async json() {
          return reply.payload;
        },
      }));
  };
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}
//#endregion

//#region 模块加载与渲染
/**
 * 动态 import 构建产物：每次带唯一 query，避免 ESM 缓存导致 __ModuleLoader__.load
 * 不再执行。随后调用 factory(require) 得到模块表，require('react') 返回真实 react。
 */
async function loadClientModule() {
  let captured = null;
  globalThis.window.__ModuleLoader__ = {
    load(mod) {
      captured = mod;
    },
  };
  importSeq += 1;
  await import(`${pathToFileURL(CLIENT_ENTRY).href}?ui-harness=${importSeq}`);
  assert.ok(captured !== null, 'lib/client.js 应通过 window.__ModuleLoader__.load 注册模块');
  const module = captured.factory((name) => {
    if (name === 'react') return React;
    throw new Error(`【harness】意外的模块依赖：${name}`);
  });
  assert.equal(typeof module.apply, 'function', '客户端模块应暴露 apply(ctx)');
  return module;
}

/** 执行模块 apply(ctx)，从 main 槽捕获 Panel 组件（同时记录其它槽注册）。 */
async function capturePanel() {
  const module = await loadClientModule();
  const registered = [];
  const injected = [];
  const ctx = {
    slots: {
      inject(name, callback) {
        injected.push(name);
        callback();
      },
      register(definition, component) {
        registered.push({ definition, component });
        return { definition };
      },
    },
    // 输入触发来源用 ctx.inject / ctx.get 做可选集成；这里不提供，走静默降级分支。
    get() {
      return undefined;
    },
  };
  await module.apply(ctx);
  const mainSlot = registered.find((entry) => entry.definition && entry.definition.name === 'main');
  assert.ok(mainSlot, 'apply(ctx) 应向 main 槽注册面板组件');
  assert.equal(mainSlot.definition.key, 'dsh-todo-time-log');
  assert.equal(typeof mainSlot.component, 'function');
  return { Panel: mainSlot.component, registered, injected };
}

/** 让 React 把渲染、effect 与异步 fetch 的 setState 全部跑完。 */
async function settle(rounds = 4) {
  for (let index = 0; index < rounds; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function mountPanel(Panel, handler) {
  const fetchMock = installFetch(handler);
  const container = globalThis.document.createElement('div');
  globalThis.document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(React.createElement(Panel));
  });
  await settle();
  return {
    container,
    calls: fetchMock.calls,
    async click(element) {
      assert.ok(element, '【harness】待点击的元素不存在');
      await act(async () => {
        element.dispatchEvent(new globalThis.window.MouseEvent('click', { bubbles: true, cancelable: true }));
      });
      await settle();
    },
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
      fetchMock.restore();
    },
  };
}

/** 每个用例独立挂载/卸载，避免污染同进程其它测试。 */
async function withPanel(handler, run) {
  const { Panel } = await capturePanel();
  const mounted = await mountPanel(Panel, handler);
  try {
    return await run(mounted);
  } finally {
    await mounted.unmount();
  }
}
//#endregion

//#region 断言工具
const textOf = (node) => (node && node.textContent ? node.textContent.trim() : '');
const findButton = (root, text) =>
  [...root.querySelectorAll('button')].find((button) => textOf(button) === text) || null;
const textsOf = (nodes) => [...nodes].map(textOf);
const isTime = (text) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text);
//#endregion

before(() => {
  installDom();
});

after(() => {
  restoreDom();
});

test('a+b+f. 页头、新建框、四视图分段、筛选计数与两行表格（含已完成徽标）', async () => {
  await withPanel(defaultHandler(), async ({ container, calls }) => {
    // a. 页头：标题与「timeFormat 来自 /list」的副标题
    const root = container.querySelector('.ttl-root');
    assert.ok(root, '应渲染 .ttl-root 面板根节点');
    assert.equal(root.getAttribute('data-dsh-todo-time-log'), 'panel');
    assert.equal(textOf(container.querySelector('.ttl-title')), '待办时间日志');
    assert.ok(
      textOf(container.querySelector('.ttl-subtitle')).includes(TIME_FORMAT),
      '副标题应使用 /list 返回的 timeFormat'
    );

    // a. 新建待办输入框（整页唯一主操作）
    const input = container.querySelector('.ttl-composer-input');
    assert.ok(input, '应渲染新建待办输入框');
    assert.equal(input.getAttribute('placeholder'), '输入待办；可写 #分类 @文件，Enter 创建');
    assert.equal(input.getAttribute('aria-label'), '新建待办');

    // a. 四个视图分段
    const viewSeg = [...container.querySelectorAll('.ttl-seg')].find((seg) =>
      [...seg.querySelectorAll('button')].some((button) => textOf(button) === '看板')
    );
    assert.ok(viewSeg, '应渲染视图分段控件');
    assert.deepEqual(textsOf(viewSeg.querySelectorAll('button')), ['表格', '看板', '甘特图', '日历']);
    const activeView = viewSeg.querySelector('button[aria-pressed="true"]');
    assert.equal(textOf(activeView), '表格', '默认视图应为表格');

    // a. 筛选分段与计数（stats.total/pending/completed）
    assert.deepEqual(
      textsOf(container.querySelectorAll('.ttl-seg-count')),
      ['2', '1', '1'],
      '筛选计数应来自 /list 的 stats'
    );
    const filterLabels = [...container.querySelectorAll('.ttl-seg')]
      .filter((seg) => seg !== viewSeg)
      .flatMap((seg) => [...seg.querySelectorAll('button')].map((button) => textOf(button).replace(/\d+$/, '')));
    assert.deepEqual(filterLabels.slice(0, 3), ['全部', '未完成', '已完成']);

    // b. 表格视图两行待办
    const rows = [...container.querySelectorAll('.ttl-table-row')];
    assert.equal(rows.length, 2, '表格应渲染 2 行待办');
    assert.deepEqual(textsOf(container.querySelectorAll('.ttl-table-title-button')), ['写周报', '修复登录 Bug']);
    const timeCells = [...container.querySelectorAll('.ttl-td-time')].map(textOf);
    assert.ok(timeCells.some(isTime), '创建时间应格式化为 YYYY-MM-DD HH:mm:ss');

    // f. 状态徽标：未完成 / 已完成（含 ttl-badge-completed）
    const pendingRow = rows.find((row) => row.getAttribute('data-status') === 'pending');
    const completedRow = rows.find((row) => row.getAttribute('data-status') === 'completed');
    assert.ok(pendingRow && completedRow, '两行应分别为 pending 与 completed');
    assert.equal(textOf(pendingRow.querySelector('.ttl-td-status .ttl-badge')), '未完成');
    const completedBadge = completedRow.querySelector('.ttl-td-status .ttl-badge-completed');
    assert.ok(completedBadge, '已完成待办应带 ttl-badge-completed 徽标');
    assert.equal(textOf(completedBadge), '已完成');

    // 首次挂载的接口调用：/list + /projects（分类建议预取）
    assert.ok(calls.some((call) => call.action === 'list'), '挂载时应请求 /list');
    assert.equal(calls.find((call) => call.action === 'list').method, 'POST');
    assert.ok(calls.some((call) => call.action === 'projects'), '挂载时应预取 /projects');
  });
});

test('c. /list 返回空列表时渲染空态文案', async () => {
  const handler = (action) => {
    if (action === 'list') {
      return okReply({ todos: [], stats: { total: 0, pending: 0, completed: 0 }, projects: [], notices: [], timeFormat: TIME_FORMAT });
    }
    return defaultHandler()(action);
  };
  await withPanel(handler, async ({ container }) => {
    assert.equal(container.querySelectorAll('.ttl-table-row').length, 0, '空列表不应有表格行');
    assert.equal(textOf(container.querySelector('.ttl-placeholder-title')), '还没有待办');
    assert.equal(textOf(container.querySelector('.ttl-placeholder-hint')), '在上方输入内容来创建第一条待办。');
    assert.equal(findButton(container, '新建第一条待办') !== null, true, '空态应给出下一步按钮');
    assert.deepEqual(textsOf(container.querySelectorAll('.ttl-seg-count')), ['0', '0', '0']);
  });
});

test('d. /list 返回错误时渲染错误提示与重试按钮，重试后恢复', async () => {
  let failing = true;
  const handler = (action) => {
    if (action !== 'list') return defaultHandler()(action);
    return failing ? failReply(500, 'INTERNAL', '存储文件损坏') : okReply(listValue());
  };
  await withPanel(handler, async ({ container, click }) => {
    const errorBox = container.querySelector('.ttl-placeholder-error');
    assert.ok(errorBox, '失败时应有 .ttl-placeholder-error');
    assert.equal(errorBox.getAttribute('role'), 'alert');
    assert.equal(textOf(errorBox.querySelector('.ttl-placeholder-title')), '加载失败');
    assert.equal(textOf(errorBox.querySelector('.ttl-placeholder-hint')), '存储文件损坏');
    const retry = findButton(errorBox, '重试');
    assert.ok(retry, '错误态应提供「重试」按钮');
    // 错误同时进入瞬时提示（toast，role=alert）
    assert.ok(container.querySelector('.ttl-toast[role="alert"]'), '错误应弹出 role=alert 的提示');

    failing = false;
    await click(retry);
    assert.equal(container.querySelectorAll('.ttl-table-row').length, 2, '重试成功后应恢复表格');
    assert.equal(container.querySelector('.ttl-placeholder-error'), null);
  });
});

test('e. 点击「看板」分段后切换到看板视图并出现看板列', async () => {
  await withPanel(defaultHandler(), async ({ container, click, calls }) => {
    const boardButton = findButton(container, '看板');
    assert.ok(boardButton, '应存在「看板」视图分段按钮');
    await click(boardButton);

    assert.equal(boardButton.getAttribute('aria-pressed'), 'true', '看板分段应选中');
    const board = container.querySelector('.ttl-board');
    assert.ok(board, '切换后应渲染 .ttl-board 容器');
    const columns = [...container.querySelectorAll('.ttl-board-column')];
    assert.equal(columns.length, 2, '按状态分列应为 2 列');
    assert.deepEqual(
      columns.map((column) => textOf(column.querySelector('.ttl-board-column-name'))),
      ['未完成', '已完成']
    );
    assert.equal(container.querySelectorAll('.ttl-board-card').length, 2, '看板应展示两张卡片');
    assert.equal(container.querySelector('.ttl-table-row'), null, '看板视图不应残留表格行');
    // 切换视图会按看板查询参数重新拉取 /list
    assert.ok(calls.filter((call) => call.action === 'list').length >= 2, '切换视图应重新请求 /list');
  });
});
