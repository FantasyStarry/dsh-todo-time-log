/**
 * 主输入框旁的「待办」快速入口。
 *
 * 两个槽位共用一份模块级 store：
 * - `conversation.composer.dock`   常驻胶囊（QuickTrigger）：显示未完成条数，点开清单；
 * - `conversation.input.overlay`   清单卡片（QuickOverlay）：锚在 composer 卡片上沿之上。
 *
 * 只做三件事：看进行中、勾掉（带撤销）、记一条。编辑 / 删除 / 改属性都留在面板。
 * 数据全部走既有 Host 接口（/list、/complete、/uncomplete、/quick-add、/delete），
 * 不新增后端，也不复制面板的交互模型。
 */
import {
  extractNotices,
  formatDurationShort,
  messageOf,
  normalizeChatErrors,
  normalizeChatSkipped,
  normalizeTodo,
  normalizeTodos,
  notifyText,
  projectLabel,
  projectTone,
  request,
} from './helpers.js';
import { t } from './i18n.js';
import { QuickStyleSheet } from './styles.js';
import { React, h } from './runtime.js';
import { CheckIcon, ToastIcon } from './widgets.js';

/** 侧边栏 / main 槽用的 key，也是「打开完整面板」要切到的面板 id。 */
const PANEL_ID = 'dsh-todo-time-log';
/** 胶囊与卡片共用：未完成条数的静默刷新间隔（多窗口 / 面板里改完能跟上）。 */
const POLL_MS = 60e3;
/** 「进行中 X」只走本地时钟，不额外发请求。 */
const CLOCK_MS = 30e3;
/** 提示停留：与面板 toast 同一口径（带撤销的也按 6s）。 */
const NOTICE_MS = 6000;

/**
 * 模块级 store：数据、开关与提示都在这里，两个槽位组件通过
 * useSyncExternalStore 订阅同一份快照。
 * @param {object} ctx - 客户端插件上下文（用于 layout.selectPanel）。
 */
function createQuickStore(ctx) {
  let state = {
    open: false,
    status: 'idle',
    error: '',
    todos: [],
    pending: 0,
    notice: null,
    busyId: '',
    adding: false,
  };
  const listeners = new Set();
  let inFlight = null;
  let noticeSeq = 0;
  let noticeTimer = null;
  let triggerEl = null;

  const getSnapshot = () => state;

  const subscribe = (listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const emit = (patch) => {
    state = Object.assign({}, state, patch);
    for (const listener of Array.from(listeners)) listener();
  };

  const clearNoticeTimer = () => {
    if (noticeTimer !== null) {
      clearTimeout(noticeTimer);
      noticeTimer = null;
    }
  };

  /** 显示卡片内提示；相同 id 的旧定时器不会清掉新提示。 */
  const showNotice = (kind, text, undo) => {
    if (typeof text !== 'string' || text === '') return;
    clearNoticeTimer();
    noticeSeq += 1;
    const id = noticeSeq;
    emit({ notice: { id, kind, text, undo: typeof undo === 'function' ? undo : null } });
    noticeTimer = setTimeout(() => {
      noticeTimer = null;
      if (state.notice !== null && state.notice.id === id) emit({ notice: null });
    }, NOTICE_MS);
  };

  const dismissNotice = () => {
    clearNoticeTimer();
    emit({ notice: null });
  };

  const focusTrigger = () => {
    if (triggerEl === null) return;
    try {
      if (typeof triggerEl.focus === 'function') triggerEl.focus();
    } catch (ignored) {
      // 宿主卸载中的元素 focus 会抛错，忽略即可。
    }
  };

  /** 拉取进行中清单；quiet=true 时不清空已有列表、失败也不弹错误提示。 */
  const load = (options) => {
    const quiet = Boolean(options && options.quiet);
    if (inFlight !== null) return inFlight;
    if (!quiet && state.todos.length === 0) emit({ status: 'loading', error: '' });
    inFlight = request('/list', { filter: 'pending', sortBy: 'createdAt', direction: 'asc' })
      .then((value) => {
        const todos = normalizeTodos(value && value.todos);
        emit({ todos, pending: todos.length, status: 'ready', error: '' });
      })
      .catch((error) => {
        const message = messageOf(error);
        emit({
          status: state.todos.length > 0 ? 'ready' : 'error',
          error: state.todos.length > 0 ? '' : message,
        });
        if (!quiet) showNotice('error', message);
      })
      .then(
        () => {
          inFlight = null;
        },
        () => {
          inFlight = null;
        }
      );
    return inFlight;
  };

  /** 勾掉一条：成功后从列表移除，并给「撤销」（等价于 uncomplete）。 */
  const complete = (todo) => {
    const id = todo && typeof todo.id === 'string' ? todo.id : '';
    if (id === '' || state.busyId !== '') return Promise.resolve();
    emit({ busyId: id });
    return request('/complete', { id })
      .then((value) => {
        const remaining = state.todos.filter((item) => item.id !== id);
        emit({ todos: remaining, pending: remaining.length, busyId: '' });
        const duration = formatDurationShort(todo.createdAt, Date.now());
        const text = extractNotices(value) || t('quick.completed', { duration });
        showNotice('success', text, () => uncomplete(id));
      })
      .catch((error) => {
        emit({ busyId: '' });
        showNotice('error', messageOf(error));
      });
  };

  /** 撤销完成 / 取消完成：写回后重新拉取列表。 */
  const uncomplete = (id) => {
    const target = typeof id === 'string' ? id : '';
    if (target === '' || state.busyId !== '') return Promise.resolve();
    emit({ busyId: target });
    return request('/uncomplete', { id: target })
      .then((value) => {
        emit({ busyId: '' });
        showNotice('success', notifyText(value, 'notice.uncompleted'));
        return load({ quiet: true });
      })
      .catch((error) => {
        emit({ busyId: '' });
        showNotice('error', messageOf(error));
      });
  };

  /** 快速新建：解析在 Host（/quick-add），成功后刷新列表并允许撤销（逐个 /delete）。 */
  const add = (text) => {
    const raw = typeof text === 'string' ? text : '';
    if (state.adding) return Promise.resolve(false);
    if (raw.trim() === '') return Promise.resolve(false);
    emit({ adding: true });
    return request('/quick-add', { text: raw })
      .then((value) => {
        const created = Array.isArray(value && value.created)
          ? value.created.map(normalizeTodo).filter((item) => item !== null)
          : [];
        const skipped = normalizeChatSkipped(value && value.skipped);
        const errors = normalizeChatErrors(value && value.errors);
        emit({ adding: false });
        if (created.length > 0) {
          showNotice('success', t('notice.quickAddCreated', { count: created.length }), () => undoAdd(created));
          return load({ quiet: true }).then(() => true);
        }
        if (errors.length > 0) {
          const first = errors[0];
          showNotice('error', t('notice.quickAddError', { title: first.title, message: first.message }));
          return false;
        }
        if (skipped.length > 0) {
          const first = skipped[0];
          showNotice('info', t('notice.quickAddSkipped', { line: first.line, reason: first.reason }));
          return false;
        }
        showNotice('info', t('notice.quickAddEmpty'));
        return false;
      })
      .catch((error) => {
        emit({ adding: false });
        showNotice('error', messageOf(error));
        return false;
      });
  };

  /** 撤销本次快速新建：和对话录入的撤销同一条路径（逐个 /delete）。 */
  const undoAdd = (created) => {
    const ids = created.map((item) => (item && typeof item.id === 'string' ? item.id : '')).filter((id) => id !== '');
    if (ids.length === 0) return Promise.resolve();
    let chain = Promise.resolve();
    for (const id of ids) {
      chain = chain.then(() =>
        request('/delete', { id }).catch(() => {
          // 单条删除失败保留在列表里，整体撤销仍然继续。
        })
      );
    }
    return chain.then(() => {
      showNotice('success', t('chat.undone', { count: ids.length }));
      return load({ quiet: true });
    });
  };

  const open = () => {
    emit({ open: true });
    void load({ quiet: true });
  };

  const close = () => {
    emit({ open: false });
    dismissNotice();
    focusTrigger();
  };

  const toggle = () => {
    if (state.open) close();
    else open();
  };

  const setTrigger = (element) => {
    triggerEl = element;
  };

  /** 卸载时收尾：清掉提示定时器，避免模块级 store 留住事件循环。 */
  const dispose = () => {
    clearNoticeTimer();
    triggerEl = null;
  };

  const openPanel = () => {
    emit({ open: false });
    dismissNotice();
    try {
      const layout = typeof ctx.get === 'function' ? ctx.get('layout') : null;
      if (layout && typeof layout.selectPanel === 'function') layout.selectPanel(PANEL_ID);
    } catch (ignored) {
      // 宿主没有布局服务时保持当前视图，不因为亮入口失败而报错。
    }
  };

  return {
    getSnapshot,
    subscribe,
    load,
    complete,
    uncomplete,
    add,
    open,
    close,
    toggle,
    setTrigger,
    openPanel,
    dismissNotice,
    dispose,
  };
}

/** 清单图标：三条对勾 + 三条线（跟随 currentColor）。 */
function QuickIcon(props) {
  const size = props && Number.isFinite(props.size) ? props.size : 16;
  return h(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.4,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
      focusable: 'false',
      className: 'ttl-quick-icon',
    },
    h('path', { d: 'M6.2 4.4h6.6' }),
    h('path', { d: 'M6.2 8h6.6' }),
    h('path', { d: 'M6.2 11.6h6.6' }),
    h('path', { d: 'M3.1 4.1l.9 1 1.5-1.8' }),
    h('path', { d: 'M3.1 7.7l.9 1 1.5-1.8' }),
    h('path', { d: 'M3.1 11.3l.9 1 1.5-1.8' })
  );
}

/** 勾选圈：只用于快速入口，避免依赖面板 CSS（面板未挂载时也要完整可用）。 */
function QuickCheck(props) {
  const disabled = Boolean(props && props.disabled);
  const label = props && typeof props.label === 'string' ? props.label : '';
  const onClick = props && typeof props.onClick === 'function' ? props.onClick : undefined;
  return h(
    'button',
    {
      type: 'button',
      className: 'ttl-quick-check',
      role: 'checkbox',
      'aria-checked': 'false',
      'aria-label': label,
      title: label,
      disabled,
      onClick,
    },
    h(CheckIcon, { checked: false })
  );
}

/** 行内分类点 + 名称（不依赖面板的 badge 样式，避免两套 CSS 互相影响）。 */
function QuickProject(props) {
  const project = props && typeof props.project === 'string' ? props.project : '';
  if (project === '') return null;
  const name = projectLabel(project);
  return h(
    'span',
    { className: 'ttl-quick-project', 'data-tone': projectTone(project), title: name },
    h('span', { className: 'ttl-quick-project-dot', 'aria-hidden': 'true' }),
    h('span', { className: 'ttl-quick-project-name' }, name)
  );
}

/** 一行待办：勾选圈 + 标题 + 元信息（进行时长 / 分类），只有「完成」一个动作。 */
function QuickRow(props) {
  const todo = props && props.todo ? props.todo : null;
  if (todo === null) return null;
  const now = props && Number.isFinite(props.now) ? props.now : Date.now();
  const disabled = Boolean(props && props.disabled);
  const onComplete = props && typeof props.onComplete === 'function' ? props.onComplete : null;
  const title = typeof todo.title === 'string' ? todo.title : '';
  const elapsed = formatDurationShort(todo.createdAt, now);
  const label = t('row.toggleAria', { action: t('row.complete'), title });
  return h(
    'div',
    { className: 'ttl-quick-row', role: 'listitem' },
    h(QuickCheck, { disabled, label, onClick: onComplete === null ? undefined : () => onComplete(todo) }),
    h(
      'div',
      { className: 'ttl-quick-body' },
      h('div', { className: 'ttl-quick-row-title', title }, title),
      h(
        'div',
        { className: 'ttl-quick-row-meta' },
        h('span', { className: 'ttl-quick-elapsed' }, t('board.elapsed', { duration: elapsed })),
        h(QuickProject, { project: todo.project })
      )
    )
  );
}

/** 清单主体：加载骨架 / 空态 / 错误（重试）/ 列表，四态齐全。 */
function QuickList(props) {
  const state = props && props.state ? props.state : {};
  const now = props && Number.isFinite(props.now) ? props.now : Date.now();
  const onRetry = props && typeof props.onRetry === 'function' ? props.onRetry : null;
  const onComplete = props && typeof props.onComplete === 'function' ? props.onComplete : null;
  if (state.status === 'loading') {
    return h(
      'div',
      { className: 'ttl-quick-skeleton', role: 'status', 'aria-label': t('list.loading') },
      h('div', { className: 'ttl-quick-skeleton-row' }),
      h('div', { className: 'ttl-quick-skeleton-row' })
    );
  }
  if (state.status === 'error') {
    return h(
      'div',
      { className: 'ttl-quick-state', role: 'alert' },
      h('p', { className: 'ttl-quick-state-title' }, t('list.error')),
      state.error !== '' ? h('p', { className: 'ttl-quick-state-hint' }, state.error) : null,
      h(
        'button',
        { type: 'button', className: 'ttl-quick-retry', onClick: onRetry === null ? undefined : onRetry },
        t('list.retry')
      )
    );
  }
  if (!Array.isArray(state.todos) || state.todos.length === 0) {
    return h(
      'div',
      { className: 'ttl-quick-state' },
      h('p', { className: 'ttl-quick-state-title' }, t('quick.empty')),
      h('p', { className: 'ttl-quick-state-hint' }, t('quick.emptyHint'))
    );
  }
  return h(
    'div',
    { className: 'ttl-quick-list', role: 'list' },
    state.todos.map((todo) =>
      h(QuickRow, {
        key: typeof todo.id === 'string' ? todo.id : String(todo.title),
        todo,
        now,
        disabled: state.busyId !== '',
        onComplete,
      })
    )
  );
}

/** 卡片内提示：绝对定位在卡片底部，出现/消失都不推动列表。 */
function QuickNotice(props) {
  const notice = props && props.notice ? props.notice : null;
  if (notice === null) return null;
  const dismiss = props && typeof props.onDismiss === 'function' ? props.onDismiss : null;
  const kind = notice.kind === 'success' || notice.kind === 'error' ? notice.kind : 'info';
  return h(
    'div',
    {
      className: 'ttl-quick-notice',
      'data-kind': kind,
      role: kind === 'error' ? 'alert' : 'status',
    },
    h('span', { className: 'ttl-quick-notice-icon' }, h(ToastIcon, { kind })),
    h('span', { className: 'ttl-quick-notice-text' }, notice.text),
    typeof notice.undo === 'function'
      ? h(
          'button',
          {
            type: 'button',
            className: 'ttl-quick-notice-action',
            onClick: () => {
              if (dismiss !== null) dismiss();
              void notice.undo();
            },
          },
          t('chat.undo')
        )
      : null,
    dismiss === null
      ? null
      : h(
          'button',
          {
            type: 'button',
            className: 'ttl-quick-notice-close',
            'aria-label': t('quick.close'),
            onClick: dismiss,
          },
          '×'
        )
  );
}

/**
 * 快速入口：胶囊进 composer dock、清单进 composer overlay。
 *
 * 不在 apply 时直接挂载，而是返回 `mount` / `unmount`：偏好开关（设置 → 通用）
 * 决定要不要挂；开关关闭时两个槽位一起卸载，胶囊、清单与 60s 轮询全部停止。
 * 两个槽位在旧宿主上可能不存在，注册失败只 warn，不影响面板本体。
 *
 * @param {object} ctx - 客户端插件上下文。
 * @returns {{
 *   mount: () => boolean,
 *   unmount: () => boolean,
 *   isMounted: () => boolean,
 *   Trigger: Function,
 *   Overlay: Function,
 * }} 便于偏好开关与测试直接驱动。
 */
export function createQuickEntry(ctx) {
  const store = createQuickStore(ctx);
  /** @type {Array<() => void>} */
  let disposers = [];
  const warn = (slot, error) => {
    try {
      if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn(`[dsh-todo-time-log] ${slot} slot setup failed:`, error);
      }
    } catch (ignored) {
      // 忽略日志失败。
    }
  };

  /** 常驻胶囊：未完成条数 + 展开状态。 */
  function QuickTrigger() {
    const state = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    const buttonRef = React.useRef(null);
    React.useEffect(() => {
      store.setTrigger(buttonRef.current);
      void store.load({ quiet: store.getSnapshot().status === 'ready' });
      const timer = setInterval(() => {
        void store.load({ quiet: true });
      }, POLL_MS);
      return () => {
        clearInterval(timer);
        store.setTrigger(null);
        store.dispose();
      };
    }, []);
    const count = state.pending;
    const label = count > 0 ? t('quick.openAria', { count }) : t('quick.openAriaEmpty');
    return h(
      React.Fragment,
      null,
      h(QuickStyleSheet),
      h(
        'button',
        {
          ref: buttonRef,
          type: 'button',
          className: 'ttl-quick-trigger',
          'data-open': state.open ? 'true' : 'false',
          'aria-haspopup': 'dialog',
          'aria-expanded': state.open ? 'true' : 'false',
          'aria-label': label,
          title: label,
          onClick: () => store.toggle(),
          onKeyDown: (event) => {
            if (event.key === 'Escape' && state.open) {
              event.preventDefault();
              store.close();
            }
          },
        },
        h(QuickIcon),
        h('span', { className: 'ttl-quick-label' }, t('quick.title')),
        count > 0 ? h('span', { className: 'ttl-quick-count', 'aria-hidden': 'true' }, String(count)) : null
      )
    );
  }

  /** 展开的清单卡片：只在打开时挂载，关闭即时卸载（不做退出动画）。 */
  function QuickOverlay() {
    const state = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    const [draft, setDraft] = React.useState('');
    const [now, setNow] = React.useState(() => Date.now());
    const inputRef = React.useRef(null);
    const open = state.open;

    React.useEffect(() => {
      if (!open) return undefined;
      setNow(Date.now());
      void store.load({ quiet: true });
      const focusTimer = setTimeout(() => {
        const element = inputRef.current;
        if (element !== null && typeof element.focus === 'function') element.focus();
      }, 0);
      const clock = setInterval(() => setNow(Date.now()), CLOCK_MS);
      return () => {
        clearTimeout(focusTimer);
        clearInterval(clock);
      };
    }, [open]);

    if (!open) return null;

    const submit = (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      const text = draft;
      if (text.trim() === '' || state.adding) return;
      // 只在成功后清空草稿：解析失败（标题超长 / 只有填充词）时保留原文，便于就地改。
      void store.add(text).then((ok) => {
        if (ok) setDraft('');
      });
    };

    return h(
      React.Fragment,
      null,
      h(QuickStyleSheet),
      h(
        'div',
        {
          className: 'ttl-quick-panel',
          role: 'dialog',
          'aria-label': t('quick.title'),
          'aria-modal': 'false',
          'data-dsh-todo-time-log': 'quick',
          onKeyDown: (event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              store.close();
            }
          },
        },
        h(
          'div',
          { className: 'ttl-quick-head' },
          h(
            'span',
            { className: 'ttl-quick-head-title' },
            h(QuickIcon, { size: 14 }),
            h('span', null, t('quick.title')),
            h('span', { className: 'ttl-quick-head-count' }, t('quick.pendingCount', { count: state.pending }))
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'ttl-quick-close',
              'aria-label': t('quick.close'),
              title: t('quick.close'),
              onClick: () => store.close(),
            },
            '×'
          )
        ),
        h(
          'form',
          { className: 'ttl-quick-add', onSubmit: submit },
          h('input', {
            ref: inputRef,
            className: 'ttl-quick-add-input',
            type: 'text',
            value: draft,
            maxLength: 400,
            placeholder: t('quick.addPlaceholder'),
            'aria-label': t('quick.addAria'),
            disabled: state.adding,
            onChange: (event) => setDraft(event.target.value),
          }),
          h(
            'button',
            {
              type: 'submit',
              className: 'ttl-quick-add-action',
              disabled: state.adding || draft.trim() === '',
            },
            state.adding ? t('create.actionBusy') : t('create.action')
          )
        ),
        h(QuickList, {
          state,
          now,
          onRetry: () => {
            void store.load({ quiet: false });
          },
          onComplete: (todo) => {
            void store.complete(todo);
          },
        }),
        h(
          'div',
          { className: 'ttl-quick-foot' },
          h(
            'button',
            { type: 'button', className: 'ttl-quick-link', onClick: () => store.openPanel() },
            t('quick.openPanel')
          ),
          h('span', { className: 'ttl-quick-hint' }, t('quick.hint'))
        ),
        h(QuickNotice, { notice: state.notice, onDismiss: () => store.dismissNotice() })
      )
    );
  }

  /**
   * 挂载两个槽位（幂等）：偏好开关从「开」切回「开」、或设置还没读到时重复调用都安全。
   * @returns {boolean} 本次是否真的新挂了槽位。
   */
  function mount() {
    if (disposers.length > 0) return false;
    const next = [];
    try {
      next.push(
        ctx.slots.inject('conversation.composer.dock', () =>
          ctx.slots.register({ name: 'conversation.composer.dock', id: PANEL_ID, order: 40 }, QuickTrigger)
        )
      );
    } catch (error) {
      warn('conversation.composer.dock', error);
    }
    try {
      next.push(
        ctx.slots.inject('conversation.input.overlay', () =>
          ctx.slots.register({ name: 'conversation.input.overlay', id: PANEL_ID, order: 40 }, QuickOverlay)
        )
      );
    } catch (error) {
      warn('conversation.input.overlay', error);
    }
    disposers = next.filter((dispose) => typeof dispose === 'function');
    return true;
  }

  /** 卸载两个槽位：开关关闭时调用，胶囊与清单一起消失、轮询也随组件卸载停止。 */
  function unmount() {
    if (disposers.length === 0) return false;
    const pending = disposers;
    disposers = [];
    for (const dispose of pending) {
      try {
        dispose();
      } catch (ignored) {
        // 已随作用域销毁的注册器再 dispose 会抛错，忽略即可。
      }
    }
    return true;
  }

  const isMounted = () => disposers.length > 0;

  return { mount, unmount, isMounted, Trigger: QuickTrigger, Overlay: QuickOverlay };
}
