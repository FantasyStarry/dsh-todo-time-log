/** 插件模块对象：main / sidebar 槽位注册、快速入口偏好与 @ 来源注册。 */
import { createPanel } from './panel.js';
import { createQuickEntryPreference, setQuickEntryPreference } from './prefs.js';
import { createQuickEntry } from './quick.js';
import { createTodoProjectSource, registerTodoProjectSource } from './sources.js';
import { Icon } from './widgets.js';

/** 集成失败只 warn：任何一处槽位缺失都不该拖垮面板本体。 */
function warn(label, error) {
  try {
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn(`[dsh-todo-time-log] ${label} setup failed:`, error);
    }
  } catch (ignored) {
    // 忽略日志失败
  }
}

export function createModule() {
  const Panel = createPanel();

  return {
    inject: ['slots'],
    apply(ctx) {
      // 主面板：keyed 槽，key 与侧边栏 id 相同，点击侧栏图标即打开本面板。
      ctx.slots.inject('main', () =>
        ctx.slots.register(
          {
            name: 'main',
            key: 'dsh-todo-time-log',
          },
          Panel
        )
      );
      // 侧边栏入口：id 会作为 main 槽的 key；label 为固定中文标题。
      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: 'dsh-todo-time-log',
            order: 30,
            label: () => '待办时间日志',
          },
          Icon
        )
      );
      // 主输入框旁：dock 里的「待办」胶囊 + composer overlay 里的清单卡片。
      // 只做「看进行中 / 勾掉 / 记一条」，编辑等完整操作仍在面板。
      // 默认开；面板页头「设置」里的开关关掉后两个槽位一起卸载（偏好存在 Host）。
      // 偏好控制器放在面板可见的模块级单例里，面板的「设置」卡直接订阅它。
      try {
        const quickEntry = createQuickEntry(ctx);
        const quickPreference = createQuickEntryPreference(quickEntry);
        setQuickEntryPreference(quickPreference);
        void quickPreference.load();
      } catch (error) {
        warn('quick entry', error);
      }
      // 主输入框/@ 菜单：注册「待办分类」来源（选中写入 #分类 文本）。
      try {
        registerTodoProjectSource(ctx, createTodoProjectSource(ctx));
      } catch (error) {
        warn('input trigger source', error);
      }
    },
  };
}
