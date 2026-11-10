/**
 * 快速入口的偏好控制器（「待办面板 → 设置」里的开关背后的状态）。
 *
 * 偏好持久在 Host 侧（`<数据文件>.settings.json`，见 `lib/settings.js`），
 * 所以同一实例的每个已认证浏览器读到的是同一个值 —— 在 A 浏览器关掉，B 刷新后也不显示。
 *
 * 这里只做状态与写入，不做界面：开关长在待办面板的「设置」卡里（`panel.js`），
 * 首屏由 `app.js` 读一次偏好并决定要不要 `mount()` 快速入口。
 */
import { messageOf, request } from './helpers.js';

/**
 * @typedef {ReturnType<typeof import('./quick.js').createQuickEntry>} QuickEntry
 */

/** 读数失败时的默认值：入口默认开（fail-open）。 */
const DEFAULT_ENABLED = true;

/**
 * 当前插件实例的控制器（`apply()` 里创建一次）。面板通过 getter 取，
 * 避免把控制器一层层透传进 `createPanel()`。
 * @type {ReturnType<typeof createQuickEntryPreference> | null}
 */
let current = null;

/** @param {ReturnType<typeof createQuickEntryPreference> | null} preference */
export function setQuickEntryPreference(preference) {
  current = preference;
}

/** @returns {ReturnType<typeof createQuickEntryPreference> | null} */
export function getQuickEntryPreference() {
  return current;
}

/**
 * 建立快速入口的偏好控制器。
 *
 * @param {QuickEntry} entry - 快速入口的挂载控制器。
 * @returns {{
 *   load: () => Promise<boolean>,
 *   setEnabled: (next: boolean) => Promise<boolean>,
 *   getSnapshot: () => { status: string, enabled: boolean, busy: boolean, readError: string, writeError: string },
 *   subscribe: (listener: () => void) => () => void,
 * }} 控制器（`load` 在 apply 时调用一次，面板只订阅快照）。
 */
export function createQuickEntryPreference(entry) {
  let state = {
    status: 'loading',
    enabled: DEFAULT_ENABLED,
    busy: false,
    readError: '',
    writeError: '',
  };
  const listeners = new Set();

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

  /** 把偏好应用到快速入口：开 → 挂载，关 → 卸载（幂等）。 */
  const applyPreference = (enabled) => {
    if (enabled) entry.mount();
    else entry.unmount();
  };

  /**
   * 读取偏好并应用；读不到时按默认「开」处理（fail-open），把原因留在面板设置卡里。
   * @returns {Promise<boolean>} 实际生效的值。
   */
  const load = () => {
    emit({ status: 'loading', readError: '', writeError: '' });
    return request('/settings', {})
      .then((value) => {
        const enabled = value && typeof value.quickEntry === 'boolean' ? value.quickEntry : DEFAULT_ENABLED;
        emit({ status: 'ready', enabled });
        applyPreference(enabled);
        return enabled;
      })
      .catch((error) => {
        const message = messageOf(error);
        emit({ status: 'ready', enabled: DEFAULT_ENABLED, readError: message });
        applyPreference(DEFAULT_ENABLED);
        return DEFAULT_ENABLED;
      });
  };

  /**
   * 写回偏好并立即应用；失败时保持原值并显示原因（不乐观翻转，避免出现
   * 「开关显示关了但胶囊还在」的两套状态）。
   * @param {boolean} next
   * @returns {Promise<boolean>} 是否写入成功。
   */
  const setEnabled = (next) => {
    if (state.busy) return Promise.resolve(false);
    const wanted = next === true;
    emit({ busy: true, writeError: '' });
    return request('/settings/update', { quickEntry: wanted })
      .then((value) => {
        const enabled = value && typeof value.quickEntry === 'boolean' ? value.quickEntry : wanted;
        emit({ busy: false, enabled });
        applyPreference(enabled);
        return true;
      })
      .catch((error) => {
        emit({ busy: false, writeError: messageOf(error) });
        return false;
      });
  };

  return { load, setEnabled, getSnapshot, subscribe };
}
