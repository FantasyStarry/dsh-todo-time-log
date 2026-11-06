/** 表格视图（含行渲染）。 */
import { EMPTY_TIME, formatDurationShort, formatTime, groupTodosByProject, normalizeFiles, normalizeProject, projectLabel } from '../helpers.js';
import { t } from '../i18n.js';
import { h } from '../runtime.js';
import { TABLE_COLUMNS } from '../styles.js';
import { EmptyPlaceholder, ProjectBadge } from '../widgets.js';

export function createTableView(deps) {
  const { busyId, cancelEdit, confirmId, detailIdOf, direction, editingId, editingPriority, editingType, emptyActionKey, expandedIds, filter, handleDelete, handleEmptyAction, handleHeaderSort, listStatus, nowMs, priorityBadge, prioritySelectControl, projectInput, renderDetailContent, renderFileChips, renderRowCheck, saveEdit, setConfirmId, setEditingPriority, setEditingType, setTableActionsId, sortBy, startEdit, statusBadge, tableActionsId, titleInput, toggleExpanded, typeBadge, typeSelectControl, visibleTodos } = deps;

  const pushTableRow = (rows, todo, index) => {
    const completed = todo.status === 'completed';
    const isEditing = editingId === todo.id;
    const expanded = expandedIds[todo.id] === true;
    const actionsOpen = tableActionsId === todo.id;
    const isConfirming = confirmId === todo.id;
    const detailId = detailIdOf(todo);
    const menuId = `ttl-row-menu-${String(todo.id).replace(/[^A-Za-z0-9_-]/g, '-')}`;
    const duration = formatDurationShort(todo.createdAt, completed ? todo.completedAt : nowMs);
    const titleCell = isEditing
      ? h('td', { className: 'ttl-td ttl-td-title' }, titleInput(todo))
      : h(
          'td',
          { className: 'ttl-td ttl-td-title' },
          h(
            'div',
            { className: 'ttl-title-cell' },
            h(
              'button',
              {
                type: 'button',
                className: 'ttl-table-title-button',
                title: todo.title === '' ? t('list.empty') : todo.title,
                'aria-expanded': expanded ? 'true' : 'false',
                'aria-controls': detailId,
                onClick: () => toggleExpanded(todo),
              },
              todo.title === '' ? t('list.empty') : todo.title
            ),
            normalizeFiles(todo.files).length > 0 ? renderFileChips(todo, { max: 1, compact: true }) : null
          )
        );
    rows.push(
      h(
        'tr',
        {
          key: todo.id,
          className: 'ttl-table-row',
          'data-status': todo.status,
          // 入场错位：只给前 7 行加延迟（12ms 一步），长列表不用等。
          style: { animationDelay: `${Math.min(index || 0, 6) * 12}ms` },
          onKeyDown: (event) => {
            if (!event || event.key !== 'Escape') return;
            if (isConfirming || actionsOpen) {
              event.preventDefault();
              event.stopPropagation();
              setConfirmId(null);
              setTableActionsId(null);
            }
          },
        },
        h('td', { className: 'ttl-td ttl-td-check' }, renderRowCheck(todo)),
        titleCell,
        h(
          'td',
          { className: 'ttl-td ttl-td-project' },
          isEditing ? projectInput(todo) : h(ProjectBadge, { project: normalizeProject(todo.project) })
        ),
        h(
          'td',
          { className: 'ttl-td ttl-td-status' },
          isEditing
            ? h(
                'span',
                { className: 'ttl-edit-status' },
                prioritySelectControl(editingPriority, setEditingPriority, busyId === todo.id),
                typeSelectControl(editingType, setEditingType, busyId === todo.id)
              )
            : h('span', { className: 'ttl-badge-row' }, statusBadge(todo), typeBadge(todo), priorityBadge(todo))
        ),
        h('td', { className: 'ttl-td ttl-td-time' }, formatTime(todo.createdAt)),
        // 完成时间列双行：第一行时刻，第二行「用时 / 进行中」——时间账本的核心指标。
        h(
          'td',
          { className: 'ttl-td ttl-td-time' },
          h('span', { className: 'ttl-time-primary' }, completed ? formatTime(todo.completedAt) : EMPTY_TIME),
          duration === EMPTY_TIME
            ? null
            : h(
                'span',
                { className: 'ttl-time-duration', 'data-status': todo.status },
                t(completed ? 'table.spent' : 'table.elapsed', { duration })
              )
        ),
        h(
          'td',
          { className: 'ttl-td ttl-td-actions' },
          isEditing
            ? h(
                'span',
                { className: 'ttl-row-edit-actions' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'ttl-link',
                    disabled: busyId === todo.id,
                    onClick: () => {
                      void saveEdit(todo);
                    },
                  },
                  t('row.save')
                ),
                h(
                  'button',
                  { type: 'button', className: 'ttl-link', disabled: busyId === todo.id, onClick: cancelEdit },
                  t('row.cancel')
                )
              )
            : h(
                'div',
                { className: 'ttl-table-more' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'ttl-row-more',
                    'aria-expanded': actionsOpen ? 'true' : 'false',
                    'aria-controls': actionsOpen ? menuId : undefined,
                    'aria-label': t('table.moreAria', { title: todo.title === '' ? t('list.empty') : todo.title }),
                    title: t('table.more'),
                    disabled: busyId === todo.id,
                    onClick: () => {
                      setConfirmId(null);
                      setTableActionsId(actionsOpen ? null : todo.id);
                    },
                  },
                  '⋯'
                ),
                actionsOpen
                  ? h(
                      'div',
                      { id: menuId, className: 'ttl-row-menu', role: 'group', 'aria-label': t('table.more') },
                      isConfirming
                        ? [
                            h(
                              'button',
                              {
                                key: 'confirm',
                                type: 'button',
                                className: 'ttl-row-menu-item ttl-row-menu-item-danger',
                                disabled: busyId === todo.id,
                                onClick: () => {
                                  void handleDelete(todo);
                                },
                              },
                              t('row.confirmDelete')
                            ),
                            h(
                              'button',
                              {
                                key: 'cancel',
                                type: 'button',
                                className: 'ttl-row-menu-item',
                                onClick: () => setConfirmId(null),
                              },
                              t('row.cancel')
                            ),
                          ]
                        : [
                            h(
                              'button',
                              {
                                key: 'detail',
                                type: 'button',
                                className: 'ttl-row-menu-item',
                                'aria-expanded': expanded ? 'true' : 'false',
                                'aria-controls': detailId,
                                onClick: () => {
                                  setTableActionsId(null);
                                  toggleExpanded(todo);
                                },
                              },
                              t('table.detail')
                            ),
                            h(
                              'button',
                              {
                                key: 'edit',
                                type: 'button',
                                className: 'ttl-row-menu-item',
                                disabled: busyId === todo.id,
                                onClick: () => {
                                  setTableActionsId(null);
                                  startEdit(todo);
                                },
                              },
                              t('row.edit')
                            ),
                            h(
                              'button',
                              {
                                key: 'delete',
                                type: 'button',
                                className: 'ttl-row-menu-item ttl-row-menu-item-danger',
                                disabled: busyId === todo.id,
                                onClick: () => setConfirmId(todo.id),
                              },
                              t('row.delete')
                            ),
                          ]
                    )
                  : null
              )
        )
      )
    );
    if (expanded) {
      rows.push(
        h(
          'tr',
          { key: `${todo.id}-detail`, className: 'ttl-table-detail-row' },
          h(
            'td',
            { className: 'ttl-td', colSpan: TABLE_COLUMNS.length },
            h(
              'div',
              {
                id: detailId,
                className: 'ttl-row-detail',
                role: 'region',
                'aria-label': t('detail.aria'),
              },
              renderDetailContent(todo)
            )
          )
        )
      );
    }
  };

  const renderTableView = () => {
    if (visibleTodos.length === 0) {
      return h(EmptyPlaceholder, {
        filter,
        actionKey: emptyActionKey,
        onAction: handleEmptyAction,
      });
    }
    const rows = [];
    if (sortBy === 'project') {
      for (const group of groupTodosByProject(visibleTodos, direction)) {
        rows.push(
          h(
            'tr',
            { key: `table-group-${group.project}`, className: 'ttl-table-group-row' },
            h(
              'td',
              { className: 'ttl-td', colSpan: TABLE_COLUMNS.length },
              t('group.header', { project: projectLabel(group.project), count: group.items.length })
            )
          )
        );
        for (const [index, todo] of group.items.entries()) pushTableRow(rows, todo, index);
      }
    } else {
      for (const [index, todo] of visibleTodos.entries()) pushTableRow(rows, todo, index);
    }
    return h(
      'div',
      { className: 'ttl-table-wrap' },
      h(
        'table',
        {
          className: 'ttl-table',
          'aria-label': t('table.aria'),
          'aria-busy': listStatus === 'loading' ? 'true' : 'false',
        },
        h(
          'colgroup',
          null,
          TABLE_COLUMNS.map((column) => h('col', { key: column.key, className: `ttl-col ttl-col-${column.key}` }))
        ),
        h(
          'thead',
          null,
          h(
            'tr',
            null,
            TABLE_COLUMNS.map((column) => {
              const active = column.sortBy !== null && sortBy === column.sortBy;
              const ariaSort = active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none';
              return h(
                'th',
                {
                  key: column.key,
                  scope: 'col',
                  className:
                    (column.sortBy === null ? 'ttl-th' : 'ttl-th ttl-th-sortable') +
                    (column.align === 'right' ? ' ttl-th-right' : '') +
                    ` ttl-th-${column.key}`,
                  'aria-sort': column.sortBy === null ? undefined : ariaSort,
                },
                column.srOnly === true
                  ? h('span', { className: 'ttl-sr-only' }, t(column.labelKey))
                  : column.sortBy === null
                  ? h('span', null, t(column.labelKey))
                  : h(
                      'button',
                      {
                        type: 'button',
                        className: active ? 'ttl-th-button ttl-th-button-active' : 'ttl-th-button',
                        title: t('table.sortTitle'),
                        'aria-label': t('table.sortAria', { column: t(column.labelKey) }),
                        onClick: () => handleHeaderSort(column.sortBy),
                      },
                      t(column.labelKey),
                      active
                        ? h('span', { className: 'ttl-th-arrow', 'aria-hidden': 'true' }, direction === 'asc' ? '▲' : '▼')
                        : null
                    )
              );
            })
          )
        ),
        h('tbody', null, rows)
      )
    );
  };

  return renderTableView;
}
