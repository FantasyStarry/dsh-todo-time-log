/** 甘特视图的容器元素（GanttView 本身在 widgets.js）。 */
import { h } from '../runtime.js';
import { GanttView } from '../widgets.js';

export function renderGanttView(deps) {
  const { busyId, editingId, editingPriority, editingType, emptyActionKey, ganttExpandedIds, handleEmptyAction, prioritySelectControl, projectInput, range, renderActionButtons, renderDetailContent, setEditingPriority, setEditingType, titleInput, toggleGanttExpanded, typeSelectControl, visibleTodos } = deps;

  return h(GanttView, {
    todos: visibleTodos,
    range,
    emptyActionKey,
    onEmptyAction: handleEmptyAction,
    expandedIds: ganttExpandedIds,
    onToggleExpanded: toggleGanttExpanded,
    editingId,
    renderDetailContent,
    renderEditFields: (todo) =>
      h(
        'div',
        { className: 'ttl-gantt-row-edit' },
        titleInput(todo),
        projectInput(todo),
        prioritySelectControl(editingPriority, setEditingPriority, busyId === todo.id),
        typeSelectControl(editingType, setEditingType, busyId === todo.id)
      ),
    renderActions: (todo) => renderActionButtons(todo, { showDetail: false }),
  });
}
