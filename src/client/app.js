/** 插件模块对象：main / sidebar 槽位注册与 @ 来源注册。 */
import { createPanel } from './panel.js';
import { createTodoProjectSource, registerTodoProjectSource } from './sources.js';
import { Icon } from './widgets.js';

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
      // 主输入框/@ 菜单：注册「待办分类」来源（选中写入 #分类 文本）。
      try {
        registerTodoProjectSource(ctx, createTodoProjectSource(ctx));
      } catch (error) {
        try {
          if (typeof console !== 'undefined' && typeof console.warn === 'function') {
            console.warn('[dsh-todo-time-log] input trigger source setup failed:', error);
          }
        } catch (ignored) {
          // 忽略日志失败
        }
      }
    },
  };
}
