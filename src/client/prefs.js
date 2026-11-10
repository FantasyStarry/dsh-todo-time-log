/**
 * 「设置 → 通用」里的快速入口开关。
 *
 * 偏好持久在 Host 侧（`<数据文件>.settings.json`，见 `lib/settings.js`），
 * 所以同一实例的每个已认证浏览器读到的是同一个值 —— 在 A 浏览器关掉，B 刷新后也不显示。
 *
 * 组件本身不缓存偏好：首屏由 `load()` 读一次并决定是否 `mount()` 快速入口；
 * 开关只负责写回并把结果应用到槽位上。
 */
import { messageOf, request } from './helpers.js';
import { t } from './i18n.js';
import { React, h } from './runtime.js';
import { PrefStyleSheet } from './styles.js';

/**
 * @typedef {ReturnType<typeof import('./quick.js').createQuickEntry>} QuickEntry
 */

/**
 * 建立快速入口的偏好控制器与设置行组件。
 *
 * @param {QuickEntry} entry - 快速入口的挂载控制器。
 * @returns {{
 *   Row: Function,
 *   load: () => Promise<boolean>,
 *   setEnabled: (next: boolean) => Promise<boolean>,
 *   getSnapshot: () => object,
 *   subscribe: (listener: () => void) => () => void,
 * }} 控制器（`load` 在 apply 时调用一次）与设置行组件。
 */
export function createQuickEntryPreference(entry) {
  let state = {
    status: 'loading',
    enabled: true,
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
   * 读取偏好并应用；读不到时按默认「开」处理（fail-open），把原因留在设置行里。
   * @returns {Promise<boolean>} 实际生效的值。
   */
  const load = () => {
    emit({ status: 'loading', readError: '', writeError: '' });
    return request('/settings', {})
      .then((value) => {
        const enabled = value && typeof value.quickEntry === 'boolean' ? value.quickEntry : true;
        emit({ status: 'ready', enabled });
        applyPreference(enabled);
        return enabled;
      })
      .catch((error) => {
        const message = messageOf(error);
        emit({ status: 'ready', enabled: true, readError: message });
        applyPreference(true);
        return true;
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

  /**
   * 设置行：标题 + 说明 + 右侧开关。行长什么样由自己决定（宿主只负责堆叠），
   * 因此这里复用宿主 General 行的排版口径（14/22 标题、12/18 说明、底部 0.5px 分隔）。
   */
  function QuickEntryRow() {
    const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    const label = t('pref.quickTitle');
    const loading = snapshot.status === 'loading';
    return h(
      React.Fragment,
      null,
      h(PrefStyleSheet),
      h(
        'div',
        { className: 'ttl-pref-row' },
        h(
          'div',
          { className: 'ttl-pref-text' },
          h('div', { className: 'ttl-pref-title' }, label),
          h('div', { className: 'ttl-pref-desc' }, t('pref.quickDesc')),
          snapshot.readError !== ''
            ? h(
                'div',
                { className: 'ttl-pref-error', role: 'alert' },
                t('pref.readFailed', { message: snapshot.readError })
              )
            : null,
          snapshot.writeError !== ''
            ? h(
                'div',
                { className: 'ttl-pref-error', role: 'alert' },
                t('pref.saveFailed', { message: snapshot.writeError })
              )
            : null
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'ttl-pref-switch',
            role: 'switch',
            'aria-checked': snapshot.enabled ? 'true' : 'false',
            'aria-label': label,
            'aria-busy': snapshot.busy ? 'true' : 'false',
            'data-checked': snapshot.enabled ? 'true' : 'false',
            disabled: loading || snapshot.busy,
            onClick: () => {
              void setEnabled(!snapshot.enabled);
            },
          },
          h('span', { className: 'ttl-pref-knob', 'aria-hidden': 'true' })
        )
      )
    );
  }

  return { Row: QuickEntryRow, load, setEnabled, getSnapshot, subscribe };
}
