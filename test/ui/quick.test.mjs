/**
 * 快速入口 + 偏好开关的 UI 验收 harness：在 jsdom 里真实挂载 lib/client.js 构建产物，
 * 用一个极小的 slot 运行时把注册的组件渲染出来，因此「设置里关掉开关 → 胶囊卸载」
 * 走的是真实链路（register → dispose → 组件 unmount），不是测试里手动拆组件。
 *
 * 覆盖：
 * - 胶囊计数 / 展开 / 勾掉 + 撤销 / 快速新建 + 撤销 / 空态 / 错误重试 / Esc / 打开完整面板；
 * - 设置 → 通用的开关：默认开、关掉后胶囊与清单一起卸载、再打开恢复；
 * - 偏好为关时首屏不挂载；读取失败 fail-open；写入失败不翻转并给出错误。
 *
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

/** slot 运行时里要渲染的槽位：整个面板（设置卡在页头）+ 两个快速入口槽位。 */
const RENDERED_SLOTS = ['main', 'conversation.composer.dock', 'conversation.input.overlay'];

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

/** 可变数据源：/list 只返回未完成项；/settings 读写同一份偏好。 */
function createWorld() {
  const world = {
    todos: [{ ...TODO_A }, { ...TODO_B }],
    quickEntry: true,
    failList: false,
    failSettingsRead: false,
    failSettingsWrite: false,
    calls: [],
  };
  world.pending = () => world.todos.filter((todo) => todo.status === 'pending');
  world.handler = (action, body) => {
    if (action === 'settings') {
      if (world.failSettingsRead) return failReply(500, 'INTERNAL', '设置读取失败');
      return okReply({ quickEntry: world.quickEntry });
    }
    if (action === 'settings/update') {
      if (world.failSettingsWrite) return failReply(500, 'SETTINGS_WRITE_FAILED', '写入设置失败');
      if (typeof body.quickEntry === 'boolean') world.quickEntry = body.quickEntry;
      return okReply({ quickEntry: world.quickEntry });
    }
    if (action === 'list') {
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
    // 取路由前缀之后的部分：/settings/update 这类两段路径必须完整保留。
    const prefix = '/api/dsh-todo-time-log/';
    const prefixIndex = pathname.indexOf(prefix);
    const segments = pathname.split('/').filter((segment) => segment !== '');
    const action =
      prefixIndex >= 0
        ? pathname.slice(prefixIndex + prefix.length)
        : segments.length > 0
          ? segments[segments.length - 1]
          : '';
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

//#region 模块加载与模拟 slot 运行时
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

/**
 * 极小的 slot 运行时：`inject` 立即执行回调并返回注册器的 disposer，
 * `register` 收集组件；注册/注销都会通知订阅者，因此「关掉开关 → 组件真的被卸载」
 * 在 DOM 上一眼可见。
 */
function createFakeSlots(layout) {
  let entries = [];
  const listeners = new Set();
  const emit = () => {
    entries = entries.slice();
    for (const listener of Array.from(listeners)) listener();
  };
  const ctx = {
    slots: {
      inject(name, callback) {
        const disposer = callback();
        return () => {
          if (typeof disposer === 'function') disposer();
        };
      },
      register(definition, component) {
        const entry = { definition, component };
        entries.push(entry);
        emit();
        return () => {
          const index = entries.indexOf(entry);
          if (index >= 0) {
            entries.splice(index, 1);
            emit();
          }
        };
      },
    },
    get(name) {
      return name === 'layout' ? layout : undefined;
    },
  };
  return {
    ctx,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => entries,
    active(name) {
      return entries.filter((entry) => entry.definition && entry.definition.name === name);
    },
  };
}
//#endregion

//#region 渲染
async function settle(rounds = 4) {
  for (let index = 0; index < rounds; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

/** 把 slot 运行时里注册的组件画出来（按注册顺序；main / sidebar 跳过）。 */
function SlotHost(props) {
  const entries = React.useSyncExternalStore(props.runtime.subscribe, props.runtime.getSnapshot, props.runtime.getSnapshot);
  return React.createElement(
    React.Fragment,
    null,
    entries.map((entry, index) => {
      const name = entry.definition && entry.definition.name;
      if (!RENDERED_SLOTS.includes(name)) return null;
      const identity = entry.definition.id || entry.definition.key || String(index);
      return React.createElement(entry.component, { key: `${name}:${identity}` });
    })
  );
}

async function mountApp(world) {
  const fetchMock = installFetch(world.handler);
  const module = await loadClientModule();
  const layout = {
    selected: [],
    selectPanel(id) {
      this.selected.push(id);
    },
  };
  const runtime = createFakeSlots(layout);
  await module.apply(runtime.ctx);

  const container = globalThis.document.createElement('div');
  globalThis.document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(React.createElement(SlotHost, { runtime }));
  });
  // 等 /settings 读取完成、快速入口挂载与 slot 重新渲染。
  await settle();

  const api = {
    world,
    layout,
    runtime,
    container,
    calls: fetchMock.calls,
    trigger: () => container.querySelector('.ttl-quick-trigger'),
    panel: () => container.querySelector('.ttl-quick-panel'),
    settingsTrigger: () => container.querySelector('.ttl-settings-trigger'),
    settingsCard: () => container.querySelector('#ttl-settings-panel'),
    settingsSwitch: () => container.querySelector('.ttl-pref-switch'),
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

async function withApp(world, run) {
  const mounted = await mountApp(world);
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
  await withApp(createWorld(), async ({ trigger }) => {
    assert.ok(trigger(), '应渲染 .ttl-quick-trigger');
    assert.equal(textOf(trigger()), '待办2');
    assert.equal(trigger().getAttribute('aria-haspopup'), 'dialog');
    assert.equal(trigger().getAttribute('aria-expanded'), 'false');
    assert.equal(trigger().getAttribute('aria-label'), '2 条进行中，展开待办清单');
    assert.equal(textOf(trigger().querySelector('.ttl-quick-count')), '2');
  });
});

test('b. 点胶囊展开清单：进行中两行、用时、勾选圈与底部入口', async () => {
  await withApp(createWorld(), async ({ trigger, panel, click }) => {
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
  await withApp(world, async ({ trigger, panel, click, calls }) => {
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
  await withApp(world, async ({ trigger, panel, click, type, submit, calls }) => {
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
  await withApp(world, async ({ trigger, panel, click }) => {
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
  await withApp(world, async ({ trigger, panel, click }) => {
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
  await withApp(createWorld(), async ({ trigger, panel, click, keydown }) => {
    await click(trigger());
    assert.ok(panel());
    await keydown(panel(), 'Escape');
    assert.equal(panel(), null);
    assert.equal(trigger().getAttribute('aria-expanded'), 'false');
  });
});

test('h. 打开完整面板：调用 layout.selectPanel(dsh-todo-time-log) 并关闭卡片', async () => {
  await withApp(createWorld(), async ({ trigger, panel, click, layout }) => {
    await click(trigger());
    await click(findButton(panel(), '打开完整面板'));
    assert.deepEqual(layout.selected, ['dsh-todo-time-log']);
    assert.equal(panel(), null);
  });
});

test('i. 面板页头「设置」：默认收起，点开是设置卡；关掉后胶囊与清单一起卸载，再打开恢复', async () => {
  await withApp(createWorld(), async ({ trigger, panel, settingsTrigger, settingsCard, settingsSwitch, click, calls, runtime }) => {
    const openButton = settingsTrigger();
    assert.ok(openButton, '页头应有「设置」入口');
    assert.equal(openButton.getAttribute('aria-expanded'), 'false');
    assert.equal(settingsCard(), null, '默认收起');

    await click(openButton);
    assert.ok(settingsCard(), '点开后出现设置卡');
    assert.equal(openButton.getAttribute('aria-expanded'), 'true');
    assert.equal(textOf(settingsCard().querySelector('.ttl-settings-title')), '设置');
    assert.ok(textOf(settingsCard().querySelector('.ttl-settings-hint')).includes('本机'));
    assert.equal(textOf(settingsCard().querySelector('.ttl-pref-title')), '主输入框下方的待办快捷入口');

    const toggle = settingsSwitch();
    assert.equal(toggle.getAttribute('role'), 'switch');
    assert.equal(toggle.getAttribute('aria-checked'), 'true');
    assert.equal(toggle.getAttribute('aria-label'), '主输入框下方的待办快捷入口');

    await click(toggle);
    assert.ok(
      calls.some((call) => call.action === 'settings/update' && call.body.quickEntry === false),
      '关掉应写 /settings/update {quickEntry:false}'
    );
    assert.equal(trigger(), null, '关掉后胶囊应消失');
    assert.equal(panel(), null);
    assert.equal(runtime.active('conversation.composer.dock').length, 0);
    assert.equal(runtime.active('conversation.input.overlay').length, 0);
    assert.equal(settingsSwitch().getAttribute('aria-checked'), 'false');

    await click(settingsSwitch());
    assert.ok(
      calls.some((call) => call.action === 'settings/update' && call.body.quickEntry === true),
      '重新打开应写回 true'
    );
    assert.ok(trigger(), '重新打开后胶囊回来');
    assert.equal(textOf(trigger()), '待办2');
  });
});

test('j. 偏好为关时首屏不挂载胶囊，从面板设置里打开后才出现', async () => {
  const world = createWorld();
  world.quickEntry = false;
  await withApp(world, async ({ trigger, panel, settingsTrigger, settingsSwitch, click, runtime }) => {
    assert.equal(trigger(), null, '偏好为关时不应挂载胶囊');
    assert.equal(panel(), null);
    assert.equal(runtime.active('conversation.composer.dock').length, 0);

    await click(settingsTrigger());
    assert.equal(settingsSwitch().getAttribute('aria-checked'), 'false');
    await click(settingsSwitch());
    assert.ok(trigger(), '从面板设置里打开后胶囊出现');
    assert.equal(panel(), null);
  });
});

test('k. 读取偏好失败：按默认开挂载，设置卡里给出原因（fail-open）', async () => {
  const world = createWorld();
  world.failSettingsRead = true;
  await withApp(world, async ({ trigger, settingsTrigger, settingsCard, click }) => {
    assert.ok(trigger(), '读取失败时仍按默认开挂载');
    await click(settingsTrigger());
    const alert = settingsCard().querySelector('.ttl-pref-error[role="alert"]');
    assert.ok(alert, '设置卡应显示读取失败原因');
    assert.ok(textOf(alert).includes('读取设置失败'));
    assert.ok(textOf(alert).includes('设置读取失败'));
  });
});

test('l. 写入偏好失败：开关不翻转、胶囊保留，并在设置卡里显示保存失败原因', async () => {
  const world = createWorld();
  world.failSettingsWrite = true;
  await withApp(world, async ({ trigger, settingsTrigger, settingsCard, settingsSwitch, click }) => {
    await click(settingsTrigger());
    assert.equal(settingsSwitch().getAttribute('aria-checked'), 'true');
    await click(settingsSwitch());
    assert.equal(settingsSwitch().getAttribute('aria-checked'), 'true', '写入失败时保持原值');
    assert.ok(trigger(), '写入失败时胶囊不应消失');
    const alert = settingsCard().querySelector('.ttl-pref-error[role="alert"]');
    assert.ok(alert, '设置卡应显示保存失败原因');
    assert.ok(textOf(alert).includes('保存失败'));
  });
});