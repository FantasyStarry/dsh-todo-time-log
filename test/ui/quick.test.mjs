/**
 * 快速入口验收 harness：在 jsdom 里真实挂载 lib/client.js 构建产物，同时挂
 * `conversation.composer.dock` 的胶囊与 `conversation.input.overlay` 的清单卡片。
 *
 * 覆盖：计数 / 展开与关闭 / 勾掉完成 + 撤销 / 快速新建 / 空态 / 错误态与重试 /
 * Esc 关闭 / 「打开完整面板」调用 layout.selectPanel。
 * 网络层全 mock（globalThis.fetch），不发真实 HTTP。
 *
 * 运行：node --test test/ui/quick.test.mjs
 */
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { after, before, test } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

/** 构建产物：lib/client.js（浏览器模块，ESM 求值时调用 window.__ModuleLoader__.load）。 */
const CLIENT_ENTRY = fileURLToPath(new URL('../../lib/client.js', import.meta.url));
const BASE_URL = 'http://127.0.0.1:57951/';
const NOW = Date.now();

// react-dom 必须在 jsdom 全局装好之后再动态 import：它模块求值时用 `canUseDOM`
// 决定走真实的 input 事件还是 IE propertychange 兜底；先 import 会让 React 的
// onChange 退化成 attachEvent 路径（jsdom 没有该 API），输入事件就收不到了。
let createRoot = null;
let act = null;

const TODO_A = {
  id: 'todo-a',
  title: '写周报',
  project: '工作',
  files: [],
  priority: 'high',
  type: 'chore',
  status: 'pending',
  createdAt: new Date(NOW - 12 * 60e3).toISOString(),
  completedAt: null,
  updatedAt: new Date(NOW - 12 * 60e3).toISOString(),
};
const TODO_B = {
  id: 'todo-b',
  title: '修甘特图刻度',
  project: '',
  files: [],
  priority: '',
  type: 'bug',
  status: 'pending',
  createdAt: new Date(NOW - 90 * 60e3).toISOString(),
  completedAt: null,
  updatedAt: new Date(NOW - 90 * 60e3).toISOString(),
};

let dom = null;
let savedGlobals = {};
let importSeq = 0;

//#region jsdom 环境（与 test/ui/panel.test.mjs 同一套做法）
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
  if (!window.navigator.clipboard) {
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => {}, readText: async () => '' },
    });
  }
}

function overrideGlobal(key, value) {
  savedGlobals[key] = Object.getOwnPropertyDescriptor(globalThis, key) ?? null;
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    enumerable: true,
    value,
  });
}

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
    localStorage: window.localStorage,
    ResizeObserver: window.ResizeObserver,
    getComputedStyle: (element, pseudo) => window.getComputedStyle(element, pseudo),
    requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
    cancelAnimationFrame: (id) => window.cancelAnimationFrame(id),
    matchMedia: (query) => window.matchMedia(query),
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

/** 可变数据源：/list 只返回未完成项，与 Host 契约一致。 */
function createWorld() {
  const world = {
    todos: [{ ...TODO_A }, { ...TODO_B }],
    failList: false,
    calls: [],
    listCount: 0,
  };
  world.pending = () => world.todos.filter((todo) => todo.status === 'pending');
  world.handler = (action, body) => {
    if (action === 'list') {
      world.listCount += 1;
      if (world.failList) return failReply(500, 'INTERNAL', '数据文件读取失败');
      const todos = world.pending();
      return okReply({
        todos,
        stats: { total: world.todos.length, pending: todos.length, completed: world.todos.length - todos.length },
        projects: [],
        filter: 'pending',
        sortBy: 'createdAt',
        direction: 'asc',
        notices: [],
        timeFormat: 'YYYY-MM-DD HH:mm:ss',
      });
    }
    if (action === 'complete') {
      const target = world.todos.find((todo) => todo.id === body.id);
      if (!target) return failReply(404, 'NOT_FOUND', '待办不存在');
      target.status = 'completed';
      target.completedAt = new Date().toISOString();
      return okReply({ todo: target });
    }
    if (action === 'uncomplete') {
      const target = world.todos.find((todo) => todo.id === body.id);
      if (!target) return failReply(404, 'NOT_FOUND', '待办不存在');
      target.status = 'pending';
      target.completedAt = null;
      return okReply({ todo: target });
    }
    if (action === 'quick-add') {
      const created = {
        id: 'todo-created',
        title: String(body.text || '').trim() || '新待办',
        project: '',
        files: [],
        priority: '',
        type: '',
        status: 'pending',
        createdAt: new Date().toISOString(),
        completedAt: null,
        updatedAt: new Date().toISOString(),
      };
      world.todos.push(created);
      return okReply({ created: [created], skipped: [], errors: [] });
    }
    if (action === 'delete') {
      world.todos = world.todos.filter((todo) => todo.id !== body.id);
      return okReply({ id: body.id });
    }
    return okReply({});
  };
  return world;
}

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
    calls.push({ action, body });
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

/** 执行 apply(ctx)，从两个 slot 捕获快速入口组件；layout 服务用 spy 记录面板跳转。 */
async function captureQuick() {
  const module = await loadClientModule();
  const registered = [];
  const injected = [];
  const layout = { selected: [], selectPanel(id) {
    this.selected.push(id);
  } };
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
    get(name) {
      return name === 'layout' ? layout : undefined;
    },
  };
  await module.apply(ctx);
  const trigger = registered.find((entry) => entry.definition && entry.definition.name === 'conversation.composer.dock');
  const overlay = registered.find((entry) => entry.definition && entry.definition.name === 'conversation.input.overlay');
  assert.ok(trigger, 'apply(ctx) 应向 conversation.composer.dock 注册胶囊');
  assert.ok(overlay, 'apply(ctx) 应向 conversation.input.overlay 注册清单卡片');
  assert.equal(trigger.definition.id, 'dsh-todo-time-log');
  assert.equal(overlay.definition.id, 'dsh-todo-time-log');
  assert.ok(injected.includes('conversation.composer.dock'));
  assert.ok(injected.includes('conversation.input.overlay'));
  return { Trigger: trigger.component, Overlay: overlay.component, layout, registered };
}

async function settle(rounds = 4) {
  for (let index = 0; index < rounds; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function mountQuick(world) {
  const { Trigger, Overlay, layout } = await captureQuick();
  const fetchMock = installFetch(world.handler);
  const container = globalThis.document.createElement('div');
  globalThis.document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      React.createElement(React.Fragment, null, React.createElement(Trigger), React.createElement(Overlay))
    );
  });
  await settle();
  const api = {
    world,
    layout,
    container,
    calls: fetchMock.calls,
    trigger: () => container.querySelector('.ttl-quick-trigger'),
    panel: () => container.querySelector('.ttl-quick-panel'),
    async click(element) {
      assert.ok(element, '【harness】待点击的元素不存在');
      await act(async () => {
        element.dispatchEvent(new globalThis.window.MouseEvent('click', { bubbles: true, cancelable: true }));
      });
      await settle();
    },
    async type(input, value) {
      const setter = Object.getOwnPropertyDescriptor(globalThis.window.HTMLInputElement.prototype, 'value').set;
      await act(async () => {
        setter.call(input, value);
        input.dispatchEvent(new globalThis.window.Event('input', { bubbles: true }));
      });
      await settle(1);
    },
    async submit(element) {
      await act(async () => {
        element.dispatchEvent(new globalThis.window.Event('submit', { bubbles: true, cancelable: true }));
      });
      await settle();
    },
    async keydown(element, key) {
      await act(async () => {
        element.dispatchEvent(
          new globalThis.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
        );
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
  return api;
}

async function withQuick(world, run) {
  const mounted = await mountQuick(world);
  try {
    return await run(mounted);
  } finally {
    await mounted.unmount();
  }
}
//#endregion

//#region 断言工具
const textOf = (node) => (node && node.textContent ? node.textContent.trim() : '');
const rows = (root) => [...root.querySelectorAll('.ttl-quick-row')];
const rowTitle = (row) => textOf(row.querySelector('.ttl-quick-row-title'));
const findButton = (root, text) =>
  [...root.querySelectorAll('button')].find((button) => textOf(button) === text) || null;
//#endregion

before(async () => {
  installDom();
  // 见文件头说明：先装好 jsdom，再加载 react-dom。
  const client = await import('react-dom/client');
  const testUtils = await import('react-dom/test-utils');
  createRoot = client.createRoot;
  act = typeof React.act === 'function' ? React.act : testUtils.act;
});

after(() => {
  restoreDom();
});

test('a. 胶囊显示未完成条数，初始不渲染清单卡片', async () => {
  await withQuick(createWorld(), async ({ trigger }) => {
    assert.ok(trigger(), '应渲染 .ttl-quick-trigger');
    assert.equal(textOf(trigger()), '待办2');
    assert.equal(trigger().getAttribute('aria-haspopup'), 'dialog');
    assert.equal(trigger().getAttribute('aria-expanded'), 'false');
    assert.equal(trigger().getAttribute('aria-label'), '2 条进行中，展开待办清单');
    assert.equal(textOf(trigger().querySelector('.ttl-quick-count')), '2');
  });
});

test('b. 点胶囊展开清单：进行中两行、用时、勾选圈与底部入口', async () => {
  await withQuick(createWorld(), async ({ trigger, panel, click }) => {
    await click(trigger());
    const card = panel();
    assert.ok(card, '点胶囊后应渲染清单卡片');
    assert.equal(card.getAttribute('role'), 'dialog');
    assert.equal(card.getAttribute('aria-label'), '待办');
    assert.equal(trigger().getAttribute('aria-expanded'), 'true');
    assert.equal(textOf(card.querySelector('.ttl-quick-head-count')), '进行中 2');

    const items = rows(card);
    assert.equal(items.length, 2);
    assert.deepEqual(items.map(rowTitle), ['写周报', '修甘特图刻度']);
    assert.ok(textOf(items[0]).includes('已进行 12 分'), `第一行元信息应含已进行时长：${textOf(items[0])}`);
    assert.ok(textOf(items[0]).includes('工作'));
    const check = items[0].querySelector('.ttl-quick-check');
    assert.equal(check.getAttribute('role'), 'checkbox');
    assert.equal(check.getAttribute('aria-label'), '完成待办：写周报');
    assert.equal(findButton(card, '打开完整面板') !== null, true);
    assert.equal(textOf(card.querySelector('.ttl-quick-hint')), '勾选即完成');
  });
});

test('c. 勾选完成 + 撤销：调用 /complete、行即时移除、撤销走 /uncomplete 并刷新', async () => {
  const world = createWorld();
  await withQuick(world, async ({ trigger, panel, click, calls }) => {
    await click(trigger());
    const first = rows(panel())[0];
    await click(first.querySelector('.ttl-quick-check'));

    assert.ok(
      calls.some((call) => call.action === 'complete' && call.body.id === 'todo-a'),
      '/complete 应收到被勾掉的 id'
    );
    assert.deepEqual(rows(panel()).map(rowTitle), ['修甘特图刻度']);
    assert.equal(textOf(panel().querySelector('.ttl-quick-head-count')), '进行中 1');
    assert.equal(textOf(trigger()), '待办1');

    const notice = panel().querySelector('.ttl-quick-notice');
    assert.ok(notice, '完成后应出现卡片内提示');
    assert.equal(notice.getAttribute('role'), 'status');
    assert.ok(textOf(notice).includes('已完成'), `提示文案：${textOf(notice)}`);
    assert.ok(textOf(notice).includes('用时'), '提示里应带用时');

    const undo = findButton(notice, '撤销');
    assert.ok(undo, '提示应带撤销按钮');
    await click(undo);
    assert.ok(
      calls.some((call) => call.action === 'uncomplete' && call.body.id === 'todo-a'),
      '撤销应调用 /uncomplete'
    );
    assert.deepEqual(rows(panel()).map(rowTitle), ['写周报', '修甘特图刻度']);
  });
});

test('d. 快速新建：Enter 提交 /quick-add，成功后刷新列表并带撤销', async () => {
  const world = createWorld();
  await withQuick(world, async ({ trigger, panel, click, type, submit, calls }) => {
    await click(trigger());
    const input = panel().querySelector('.ttl-quick-add-input');
    assert.ok(input, '卡片里应有快速新建输入框');
    assert.equal(input.getAttribute('aria-label'), '快速新建待办');
    assert.equal(findButton(panel(), '添加').disabled, true, '空输入时添加按钮禁用');

    await type(input, '买牛奶 #生活');
    await submit(panel().querySelector('.ttl-quick-add'));
    assert.ok(
      calls.some((call) => call.action === 'quick-add' && call.body.text === '买牛奶 #生活'),
      '/quick-add 应收到原始文本'
    );
    assert.deepEqual(rows(panel()).map(rowTitle), ['写周报', '修甘特图刻度', '买牛奶 #生活']);
    const notice = panel().querySelector('.ttl-quick-notice');
    assert.ok(textOf(notice).includes('已添加 1 条待办'), `提示文案：${textOf(notice)}`);

    await click(findButton(notice, '撤销'));
    assert.ok(
      calls.some((call) => call.action === 'delete' && call.body.id === 'todo-created'),
      '新建撤销应删除刚创建的条目'
    );
    assert.deepEqual(rows(panel()).map(rowTitle), ['写周报', '修甘特图刻度']);
  });
});

test('e. 空态：没有未完成时胶囊不带计数、清单给出出口', async () => {
  const world = createWorld();
  world.todos = [];
  await withQuick(world, async ({ trigger, panel, click }) => {
    assert.equal(textOf(trigger()), '待办');
    assert.equal(trigger().getAttribute('aria-label'), '展开待办清单');
    assert.equal(trigger().querySelector('.ttl-quick-count'), null);
    await click(trigger());
    assert.equal(textOf(panel().querySelector('.ttl-quick-state-title')), '没有进行中的待办');
    assert.equal(panel().querySelector('.ttl-quick-list'), null);
  });
});

test('f. 错误态与重试：/list 失败给出错误与重试，重试后恢复列表', async () => {
  const world = createWorld();
  world.failList = true;
  await withQuick(world, async ({ trigger, panel, click }) => {
    await click(trigger());
    const alert = panel().querySelector('.ttl-quick-state[role="alert"]');
    assert.ok(alert, '失败时应渲染错误态');
    assert.equal(textOf(alert.querySelector('.ttl-quick-state-title')), '加载失败');
    assert.ok(textOf(alert).includes('数据文件读取失败'));

    world.failList = false;
    await click(findButton(alert, '重试'));
    assert.deepEqual(rows(panel()).map(rowTitle), ['写周报', '修甘特图刻度']);
  });
});

test('g. Esc 关闭：焦点还给胶囊（aria-expanded 回落）', async () => {
  await withQuick(createWorld(), async ({ trigger, panel, click, keydown }) => {
    await click(trigger());
    assert.ok(panel());
    await keydown(panel(), 'Escape');
    assert.equal(panel(), null);
    assert.equal(trigger().getAttribute('aria-expanded'), 'false');
  });
});

test('h. 打开完整面板：调用 layout.selectPanel(dsh-todo-time-log) 并关闭卡片', async () => {
  await withQuick(createWorld(), async ({ trigger, panel, click, layout }) => {
    await click(trigger());
    await click(findButton(panel(), '打开完整面板'));
    assert.deepEqual(layout.selected, ['dsh-todo-time-log']);
    assert.equal(panel(), null);
  });
});
