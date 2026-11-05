/** 浏览器模块入口：window.__ModuleLoader__.load({ id, factory })。 */
import { setReact } from './runtime.js';
import { createModule } from './app.js';

window.__ModuleLoader__.load({
  id: 'dsh-todo-time-log',
  factory(require) {
    setReact(require('react'));
    return createModule();
  },
});
