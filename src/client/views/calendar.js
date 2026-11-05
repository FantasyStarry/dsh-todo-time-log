/** 日历视图（6x7 月历格）。 */
import { EMPTY_TIME, buildCalendarCells, calendarDayKey, formatTime, normalizeFiles, normalizeProject, toMillis } from '../helpers.js';
import { t } from '../i18n.js';
import { h } from '../runtime.js';
import { CALENDAR_MAX_ITEMS, CALENDAR_WEEKDAY_KEYS } from '../styles.js';
import { ProjectBadge, TextPlaceholder } from '../widgets.js';

export function createCalendarView(deps) {
  const { calendarBasis, calendarMonth, calendarSelectedDay, calendarYear, editingId, emptyActionKey, handleEmptyAction, projectInput, renderActionButtons, renderFileChips, setCalendarSelectedDay, statusBadge, titleInput, visibleTodos } = deps;

  const renderCalendarView = () => {
    if (visibleTodos.length === 0) {
      return h(TextPlaceholder, {
        titleKey: 'calendar.empty',
        actionKey: emptyActionKey,
        onAction: handleEmptyAction,
      });
    }
    const cells = buildCalendarCells(calendarYear, calendarMonth);
    const entriesByDay = {};
    for (const todo of visibleTodos) {
      const key = calendarDayKey(todo, calendarBasis);
      if (key === '') continue; // 非法/缺失时间跳过该条
      if (!entriesByDay[key]) entriesByDay[key] = [];
      entriesByDay[key].push(todo);
    }
    const timeField = calendarBasis === 'completedAt' ? 'completedAt' : 'createdAt';
    for (const key of Object.keys(entriesByDay)) {
      entriesByDay[key].sort((left, right) => {
        const a = toMillis(left[timeField]);
        const b = toMillis(right[timeField]);
        if (a === null && b === null) return 0;
        if (a === null) return 1;
        if (b === null) return -1;
        return a - b;
      });
    }
    const monthHasEntries = cells.some(
      (cell) => cell.inMonth && (entriesByDay[cell.key] || []).length > 0
    );
    const selectedEntries = calendarSelectedDay === null ? [] : entriesByDay[calendarSelectedDay] || [];

    const renderCell = (cell) => {
      const items = entriesByDay[cell.key] || [];
      const visible = items.slice(0, CALENDAR_MAX_ITEMS);
      const hidden = items.length - visible.length;
      const selected = calendarSelectedDay === cell.key;
      let className = 'ttl-calendar-cell';
      if (!cell.inMonth) className += ' ttl-calendar-cell-outside';
      if (cell.isToday) className += ' ttl-calendar-cell-today';
      if (selected) className += ' ttl-calendar-cell-selected';
      return h(
        'button',
        {
          key: cell.key,
          type: 'button',
          className,
          'aria-pressed': selected ? 'true' : 'false',
          'aria-label': t('calendar.dayAria', { date: cell.key, count: items.length }),
          onClick: () => setCalendarSelectedDay(cell.key),
        },
        h('span', { className: 'ttl-calendar-daynum', 'aria-hidden': 'true' }, String(cell.day)),
        h(
          'span',
          { className: 'ttl-calendar-items', 'aria-hidden': 'true' },
          visible.map((todo) =>
            h(
              'span',
              {
                key: todo.id,
                className:
                  todo.status === 'completed' ? 'ttl-calendar-item ttl-calendar-item-completed' : 'ttl-calendar-item',
                title: todo.title === '' ? t('list.empty') : todo.title,
              },
              todo.title === '' ? t('list.empty') : todo.title
            )
          ),
          hidden > 0 ? h('span', { className: 'ttl-calendar-more' }, t('calendar.more', { count: hidden })) : null
        )
      );
    };

    const renderDayItem = (todo) => {
      const completed = todo.status === 'completed';
      const isEditing = editingId === todo.id;
      return h(
        'li',
        { key: todo.id, className: 'ttl-calendar-entry', 'data-status': todo.status },
        isEditing
          ? h('div', { className: 'ttl-calendar-entry-edit' }, titleInput(todo), projectInput(todo))
          : h(
              'div',
              { className: 'ttl-calendar-entry-main' },
              h(
                'span',
                { className: 'ttl-calendar-entry-title', title: todo.title === '' ? t('list.empty') : todo.title },
                todo.title === '' ? t('list.empty') : todo.title
              ),
              h('span', { className: 'ttl-calendar-entry-badges' }, h(ProjectBadge, { project: normalizeProject(todo.project) }), statusBadge(todo))
            ),
        h(
          'div',
          { className: 'ttl-calendar-entry-meta' },
          h('span', null, h('span', { className: 'ttl-time-label' }, t('list.created')), formatTime(todo.createdAt)),
          h(
            'span',
            null,
            h('span', { className: 'ttl-time-label' }, t('list.completed')),
            completed ? formatTime(todo.completedAt) : EMPTY_TIME
          )
        ),
        normalizeFiles(todo.files).length > 0
          ? h('div', { className: 'ttl-calendar-entry-files' }, renderFileChips(todo))
          : null,
        h('div', { className: 'ttl-calendar-entry-actions' }, renderActionButtons(todo, { showDetail: false }))
      );
    };

    return h(
      'section',
      { className: 'ttl-calendar', 'aria-label': t('calendar.aria') },
      h(
        'div',
        { className: 'ttl-calendar-head' },
        h('h2', { className: 'ttl-calendar-title' }, t('calendar.monthTitle', { year: calendarYear, month: calendarMonth + 1 }))
      ),
      h(
        'div',
        { className: 'ttl-calendar-weekdays' },
        CALENDAR_WEEKDAY_KEYS.map((key) => h('span', { key, className: 'ttl-calendar-weekday' }, t(key)))
      ),
      h('div', { className: 'ttl-calendar-grid' }, cells.map(renderCell)),
      monthHasEntries ? null : h('p', { className: 'ttl-calendar-month-empty' }, t('calendar.monthEmpty')),
      calendarSelectedDay === null
        ? null
        : h(
            'div',
            { className: 'ttl-calendar-panel' },
            h(
              'h3',
              { className: 'ttl-calendar-panel-title' },
              t('calendar.dayTitle', { date: calendarSelectedDay, count: selectedEntries.length })
            ),
            selectedEntries.length === 0
              ? h('p', { className: 'ttl-calendar-day-empty' }, t('calendar.dayEmpty'))
              : h('ul', { className: 'ttl-calendar-day-list' }, selectedEntries.map(renderDayItem))
          )
    );
  };

  return renderCalendarView;
}
