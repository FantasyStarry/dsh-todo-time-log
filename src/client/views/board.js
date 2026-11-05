/** 看板视图（列 / 泳道 / 卡片）。 */
import { EMPTY_TIME, boardColumns, formatDurationShort, formatTime, normalizeFiles, normalizePriority, normalizeProject, normalizeType, projectLabel, toMillis } from '../helpers.js';
import { t } from '../i18n.js';
import { h } from '../runtime.js';
import { BOARD_COMPLETED_LIMIT, BOARD_MOVE_UNCATEGORIZED, PRIORITIES, TYPES } from '../styles.js';
import { TextPlaceholder } from '../widgets.js';

export function createBoardView(deps) {
  const { boardActionsId, boardGroupBy, boardLaneCollapsed, boardShowAllCompleted, busyId, confirmId, density, editingId, editingPriority, editingType, emptyActionKey, emptyColumnKey, handleColumnAdd, handleDelete, handleEmptyAction, handleLaneAdd, handleMoveProject, handleSetPriority, handleSetType, handleToggle, isBusy, nowMs, priorityBadge, prioritySelectControl, projectInput, projectSuggestions, renderFileChips, setBoardActionsId, setBoardLaneCollapsed, setBoardShowAllCompleted, setConfirmId, setEditingPriority, setEditingType, startEdit, statusBadge, titleInput, typeBadge, typeSelectControl, visibleTodos } = deps;

  /** 卡片上的一行时长：未完成 = 创建→现在；已完成 = 创建→完成。 */
  const renderBoardDuration = (todo) => {
    const completed = todo.status === 'completed';
    const createdMs = toMillis(todo.createdAt);
    const endValue = completed ? todo.completedAt : new Date(nowMs);
    const endMs = toMillis(endValue);
    if (createdMs === null || endMs === null) return null;
    const duration = formatDurationShort(todo.createdAt, endValue);
    if (duration === EMPTY_TIME) return null;
    const label = completed
      ? t('board.spentAria', {
          created: formatTime(todo.createdAt),
          completed: formatTime(todo.completedAt),
          duration,
        })
      : t('board.elapsedAria', { created: formatTime(todo.createdAt), duration });
    return h(
      'span',
      { className: 'ttl-board-duration' },
      h(
        'time',
        { dateTime: new Date(createdMs).toISOString(), 'aria-label': label, title: label },
        t(completed ? 'board.spent' : 'board.elapsed', { duration })
      )
    );
  };

  const boardCheckIcon = (completed) =>
    h(
      'svg',
      {
        width: 12,
        height: 12,
        viewBox: '0 0 16 16',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        focusable: 'false',
      },
      completed ? h('path', { d: 'M3.5 8.5l3 3 6-6.5' }) : null
    );

  const renderBoardCard = (todo) => {
    const isEditing = editingId === todo.id;
    const isConfirming = confirmId === todo.id;
    const actionsOpen = boardActionsId === todo.id;
    const completed = todo.status === 'completed';
    const title = todo.title === '' ? t('board.untitled') : todo.title;
    const project = normalizeProject(todo.project);
    const files = normalizeFiles(todo.files);
    const duration = renderBoardDuration(todo);
    const showProject = boardGroupBy === 'status';
    const showStatus = boardGroupBy === 'project';
    const canMoveProject = boardGroupBy === 'project' || boardGroupBy === 'status-project';
    const moveTargets = canMoveProject ? projectSuggestions.filter((item) => item.name !== '').slice(0, 40) : [];
    const actionsId = `ttl-board-actions-${String(todo.id).replace(/[^A-Za-z0-9_-]/g, '-')}`;
    return h(
      'article',
      {
        key: todo.id,
        className: isEditing ? 'ttl-board-card ttl-board-card-editing' : 'ttl-board-card',
        'data-status': todo.status,
        role: 'listitem',
        onKeyDown: (event) => {
          if (!event || event.key !== 'Escape') return;
          if (actionsOpen || isConfirming) {
            event.stopPropagation();
            setBoardActionsId(null);
            setConfirmId(null);
          }
        },
      },
      isEditing
        ? h(
            'div',
            { className: 'ttl-board-edit' },
            titleInput(todo),
            projectInput(todo),
            prioritySelectControl(editingPriority, setEditingPriority, busyId === todo.id),
            typeSelectControl(editingType, setEditingType, busyId === todo.id)
          )
        : [
            h(
              'button',
              {
                key: 'check',
                type: 'button',
                className: 'ttl-board-check',
                role: 'checkbox',
                'aria-checked': completed ? 'true' : 'false',
                'aria-label': t('board.checkAria', { title }),
                'data-checked': completed ? 'true' : 'false',
                disabled: isBusy,
                onClick: () => {
                  void handleToggle(todo);
                },
              },
              boardCheckIcon(completed)
            ),
            h(
              'div',
              { key: 'main', className: 'ttl-board-card-main' },
              h('div', { className: 'ttl-board-card-title', title }, title),
              h(
                'div',
                { className: 'ttl-board-card-meta' },
                typeBadge(todo),
                priorityBadge(todo),
                showProject
                  ? h(
                      'span',
                      { className: 'ttl-board-project', title: projectLabel(project) },
                      h('span', {
                        className: 'ttl-board-dot',
                        'data-status': 'project',
                        'aria-hidden': 'true',
                      }),
                      h('span', { className: 'ttl-board-project-name' }, projectLabel(project))
                    )
                  : null,
                showStatus ? statusBadge(todo) : null,
                duration
              ),
              files.length > 0
                ? h('div', { className: 'ttl-board-card-files' }, renderFileChips(todo, { max: 1, compact: true }))
                : null
            ),
            h(
              'button',
              {
                key: 'more',
                type: 'button',
                className: 'ttl-board-more',
                'aria-expanded': actionsOpen ? 'true' : 'false',
                'aria-controls': actionsOpen ? actionsId : undefined,
                'aria-label': t('board.moreAria', { title }),
                title: t('board.more'),
                onClick: () => setBoardActionsId(actionsOpen ? null : todo.id),
              },
              '⋯'
            ),
            actionsOpen
              ? h(
                  'div',
                  {
                    key: 'actions',
                    id: actionsId,
                    className: 'ttl-board-card-actions',
                    role: 'group',
                    'aria-label': t('board.more'),
                  },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'ttl-board-action',
                      onClick: () => {
                        setBoardActionsId(null);
                        startEdit(todo);
                      },
                    },
                    t('row.edit')
                  ),
                  h(
                    'label',
                    { key: 'priority', className: 'ttl-board-move' },
                    h('span', { className: 'ttl-board-action-label' }, t('priority.label')),
                    h(
                      'select',
                      {
                        className: 'ttl-board-move-select',
                        value: normalizePriority(todo.priority),
                        'aria-label': t('priority.label'),
                        disabled: isBusy,
                        onChange: (event) => {
                          void handleSetPriority(todo, event.target.value);
                        },
                      },
                      PRIORITIES.map((entry) =>
                        h('option', { key: entry.value === '' ? 'none' : entry.value, value: entry.value }, t(entry.labelKey))
                      )
                    )
                  ),
                  h(
                    'label',
                    { key: 'type', className: 'ttl-board-move' },
                    h('span', { className: 'ttl-board-action-label' }, t('type.label')),
                    h(
                      'select',
                      {
                        className: 'ttl-board-move-select',
                        value: normalizeType(todo.type),
                        'aria-label': t('type.label'),
                        disabled: isBusy,
                        onChange: (event) => {
                          void handleSetType(todo, event.target.value);
                        },
                      },
                      TYPES.map((entry) =>
                        h('option', { key: entry.value === '' ? 'none' : entry.value, value: entry.value }, t(entry.labelKey))
                      )
                    )
                  ),
                  canMoveProject
                    ? h(
                        'label',
                        { key: 'move', className: 'ttl-board-move' },
                        h(
                          'select',
                          {
                            className: 'ttl-board-move-select',
                            'aria-label': t('board.moveToProject'),
                            disabled: isBusy,
                            onChange: (event) => {
                              const value = event.target.value;
                              if (value === '') return;
                              void handleMoveProject(todo, value === BOARD_MOVE_UNCATEGORIZED ? '' : value);
                            },
                          },
                          h('option', { value: '' }, t('board.moveToPlaceholder')),
                          h('option', { value: BOARD_MOVE_UNCATEGORIZED }, t('project.none')),
                          moveTargets.map((item) => h('option', { key: item.name, value: item.name }, item.name))
                        )
                      )
                    : null,
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'ttl-board-action ttl-board-action-danger',
                      onClick: () => {
                        setBoardActionsId(null);
                        setConfirmId(todo.id);
                      },
                    },
                    t('row.delete')
                  )
                )
              : null,
            isConfirming
              ? h(
                  'div',
                  { key: 'confirm', className: 'ttl-board-confirm', role: 'group', 'aria-label': t('row.confirmDelete') },
                  h('p', { className: 'ttl-board-confirm-text' }, t('board.deleteConfirm')),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'ttl-board-confirm-delete',
                      disabled: isBusy,
                      onClick: () => {
                        void handleDelete(todo);
                      },
                    },
                    t('row.confirmDelete')
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'ttl-board-confirm-cancel',
                      disabled: isBusy,
                      onClick: () => setConfirmId(null),
                    },
                    t('row.cancel')
                  )
                )
              : null,
          ]
    );
  };

  /** 泳道（状态 × 分类）：行头 = 分类 + 计数 + 折叠；未完成泳道带「＋」。 */
  const renderBoardLane = (column, lane) => {
    const laneKey = `${column.key}|${lane.key}`;
    const collapsed = boardLaneCollapsed[laneKey] === true;
    const actionLabel = t(collapsed ? 'detail.expand' : 'detail.collapse');
    const toggleAria = t('board.laneToggleAria', { action: actionLabel, name: lane.label });
    return h(
      'div',
      {
        key: lane.key,
        className: 'ttl-board-lane',
        role: 'group',
        'aria-label': t('board.laneAria', { name: lane.label, count: lane.items.length }),
      },
      h(
        'div',
        { className: 'ttl-board-lane-head' },
        h(
          'button',
          {
            type: 'button',
            className: 'ttl-board-lane-toggle',
            'aria-expanded': collapsed ? 'false' : 'true',
            'aria-label': toggleAria,
            title: toggleAria,
            onClick: () =>
              setBoardLaneCollapsed((current) => {
                const next = { ...current };
                if (next[laneKey] === true) delete next[laneKey];
                else next[laneKey] = true;
                return next;
              }),
          },
          h('span', { className: 'ttl-board-lane-caret', 'aria-hidden': 'true' }, collapsed ? '▸' : '▾'),
          h('span', { className: 'ttl-board-lane-name' }, lane.label),
          h('span', { className: 'ttl-board-lane-count' }, String(lane.items.length))
        ),
        column.status === 'pending'
          ? h(
              'button',
              {
                type: 'button',
                className: 'ttl-board-add',
                'aria-label': t('board.addToLane', { project: lane.label }),
                title: t('board.addToLane', { project: lane.label }),
                onClick: () => handleLaneAdd(lane),
              },
              '+'
            )
          : null
      ),
      collapsed
        ? null
        : h('div', { className: 'ttl-board-list', role: 'list' }, lane.items.map(renderBoardCard))
    );
  };

  const renderBoardColumn = (column) => {
    const total = column.items.length;
    const isCompletedColumn = column.status === 'completed';
    const lanes = Array.isArray(column.lanes) ? column.lanes : null;
    const orderedItems =
      !lanes && isCompletedColumn && total > 1
        ? column.items.slice().sort((left, right) => (toMillis(right.completedAt) || 0) - (toMillis(left.completedAt) || 0))
        : column.items;
    const visibleItems =
      !lanes && isCompletedColumn && !boardShowAllCompleted
        ? orderedItems.slice(0, BOARD_COMPLETED_LIMIT)
        : orderedItems;
    const hiddenCount = total - visibleItems.length;
    const canAdd = column.project !== undefined || column.status === 'pending';
    return h(
      'div',
      {
        key: column.key,
        className: 'ttl-board-column',
        role: 'group',
        'aria-label': t('board.columnAria', { name: column.label, count: total }),
        'data-group': column.key,
      },
      h(
        'header',
        { className: 'ttl-board-column-head' },
        h(
          'h2',
          { className: 'ttl-board-column-title' },
          column.dot !== ''
            ? h('span', { className: 'ttl-board-dot', 'data-status': column.dot, 'aria-hidden': 'true' })
            : null,
          h('span', { className: 'ttl-board-column-name' }, column.label)
        ),
        h('span', { className: 'ttl-board-column-count', 'aria-hidden': 'true' }, String(total)),
        canAdd
          ? h(
              'button',
              {
                type: 'button',
                className: 'ttl-board-add',
                'aria-label': t('board.addToColumn', { name: column.label }),
                title: t('board.addToColumn', { name: column.label }),
                onClick: () => handleColumnAdd(column),
              },
              '+'
            )
          : null
      ),
      h(
        'div',
        {
          className: 'ttl-board-column-body',
          role: 'group',
          tabIndex: 0,
          'aria-label': t('board.columnBodyAria', { name: column.label, count: total }),
        },
        lanes
          ? lanes.length === 0
            ? h('p', { className: 'ttl-board-column-empty' }, t(emptyColumnKey(column)))
            : h('div', { className: 'ttl-board-lanes' }, lanes.map((lane) => renderBoardLane(column, lane)))
          : visibleItems.length === 0
            ? h('p', { className: 'ttl-board-column-empty' }, t(emptyColumnKey(column)))
            : h('div', { className: 'ttl-board-list', role: 'list' }, visibleItems.map(renderBoardCard)),
        !lanes && hiddenCount > 0
          ? h(
              'button',
              {
                type: 'button',
                className: 'ttl-board-showmore',
                onClick: () => setBoardShowAllCompleted(true),
              },
              t('board.showAll', { count: total })
            )
          : null,
        !lanes && isCompletedColumn && boardShowAllCompleted && total > BOARD_COMPLETED_LIMIT
          ? h(
              'button',
              {
                type: 'button',
                className: 'ttl-board-showmore',
                onClick: () => setBoardShowAllCompleted(false),
              },
              t('board.showRecent', { count: BOARD_COMPLETED_LIMIT })
            )
          : null
      )
    );
  };

  const renderBoardView = () => {
    if (visibleTodos.length === 0) {
      return h(TextPlaceholder, {
        titleKey: 'board.empty',
        actionKey: emptyActionKey,
        onAction: handleEmptyAction,
      });
    }
    const columns = boardColumns(visibleTodos, boardGroupBy);
    return h(
      'div',
      {
        className: density === 'compact' ? 'ttl-board ttl-board-compact' : 'ttl-board',
        role: 'region',
        'aria-label': t('board.aria'),
        tabIndex: 0,
      },
      columns.map(renderBoardColumn)
    );
  };

  return renderBoardView;
}
