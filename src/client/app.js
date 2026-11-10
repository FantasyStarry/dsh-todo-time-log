/** 插件模块对象：main / sidebar / 快速入口槽位注册、偏好开关与 @ 来源注册。 */
import { createPanel } from './panel.js';
import { createQuickEntryPreference } from './prefs.js';
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
      // 默认开；「设置 → 通用」里的开关关掉后两个槽位一起卸载（偏好存在 Host）。
      try {
        const quickEntry = createQuickEntry(ctx);
        const quickPreference = createQuickEntryPreference(quickEntry);
        // 设置行单独 try：旧宿主没有这个槽位时也要继续读偏好并挂载快速入口。
        try {
          ctx.slots.inject('settings.general.item', () =>
            ctx.slots.register(
              {
                name: 'settings.general.item',
                id: 'dsh-todo-time-log',
                order: 40,
              },
              quickPreference.Row
            )
          );
        } catch (error) {
          warn('settings.general.item', error);
        }
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
