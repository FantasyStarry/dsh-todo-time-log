/** 表格视图（含行渲染）。 */
import { EMPTY_TIME, formatTime, groupTodosByProject, normalizeFiles, normalizeProject, projectLabel } from '../helpers.js';
import { t } from '../i18n.js';
import { h } from '../runtime.js';
import { TABLE_COLUMNS } from '../styles.js';
import { EmptyPlaceholder, ProjectBadge } from '../widgets.js';

export function createTableView(deps) {
  const { confirmId, detailIdOf, direction, editingId, emptyActionKey, expandedIds, filter, handleEmptyAction, handleHeaderSort, listStatus, priorityBadge, projectInput, renderActionButtons, renderDetailContent, renderFileChips, renderRowCheck, setConfirmId, sortBy, statusBadge, titleInput, toggleExpanded, typeBadge, visibleTodos } = deps;

  const pushTableRow = (rows, todo) => {
    const completed = todo.status === 'completed';
    const isEditing = editingId === todo.id;
    const expanded = expandedIds[todo.id] === true;
    const detailId = detailIdOf(todo);
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
          onKeyDown: (event) => {
            if (event.key === 'Escape' && confirmId === todo.id) {
              event.preventDefault();
              event.stopPropagation();
              setConfirmId(null);
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
          h('span', { className: 'ttl-badge-row' }, statusBadge(todo), typeBadge(todo), priorityBadge(todo))
        ),
        h('td', { className: 'ttl-td ttl-td-time' }, formatTime(todo.createdAt)),
        h('td', { className: 'ttl-td ttl-td-time' }, completed ? formatTime(todo.completedAt) : EMPTY_TIME),
        h('td', { className: 'ttl-td ttl-td-actions' }, renderActionButtons(todo, { showDetail: true, showToggle: false }))
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
        for (const todo of group.items) pushTableRow(rows, todo);
      }
    } else {
      for (const todo of visibleTodos) pushTableRow(rows, todo);
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
