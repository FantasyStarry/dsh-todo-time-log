/** 通用小组件、徽标、甘特图、项目选择器与对话录入面板。 */
import { GANTT_LABEL_WIDTH, GANTT_TRACK_WIDTH, chooseTickStep, fileBaseName, formatTickLabel, formatTime, groupByProject, isRecord, normalizeFiles, normalizeProject, projectLabel, toMillis } from './helpers.js';
import { t } from './i18n.js';
import { React, h } from './runtime.js';
import { GANTT_RANGES, PROJECT_CUSTOM } from './styles.js';



/** 简单占位块（看板/日历空态复用）。 */
export function TextPlaceholder(props) {
  const titleKey = props && props.titleKey ? props.titleKey : 'list.empty';
  const hintKey = props && props.hintKey ? props.hintKey : '';
  const actionKey = props && typeof props.actionKey === 'string' ? props.actionKey : '';
  const onAction = props && typeof props.onAction === 'function' ? props.onAction : null;
  const titleVars = props && isRecord(props.titleVars) ? props.titleVars : undefined;
  return h(
    'div',
    { className: 'ttl-placeholder', role: 'status' },
    h('p', { className: 'ttl-placeholder-title' }, t(titleKey, titleVars)),
    hintKey !== '' ? h('p', { className: 'ttl-placeholder-hint' }, t(hintKey)) : null,
    onAction === null || actionKey === ''
      ? null
      : h(
          'div',
          { className: 'ttl-placeholder-action' },
          h('button', { type: 'button', className: 'ttl-button ttl-button-outline', onClick: onAction }, t(actionKey))
        )
  );
}

/** 侧边栏图标：跟随宿主 currentColor；size 由宿主传入。 */
export function Icon(props) {
  const size = props && Number.isFinite(props.size) ? props.size : 16;
  return h(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.3,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
      focusable: 'false',
      style: { display: 'block' },
    },
    h('circle', { cx: 8, cy: 8, r: 6 }),
    h('path', { d: 'M8 4.6V8l2.4 1.4' }),
    h('path', { d: 'M2.6 8h1' }),
    h('path', { d: 'M8 2.6v1' })
  );
}

/** 加载骨架屏。 */    /** 瞬时提示图标：成功 / 失败 / 中性。 */
export function ToastIcon(props) {
  const kind = props && props.kind === 'success' ? 'success' : props && props.kind === 'error' ? 'error' : 'info';
  const base = {
    width: 14,
    height: 14,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
    focusable: 'false',
  };
  if (kind === 'success') {
    return h('svg', base, h('circle', { cx: 8, cy: 8, r: 6.2 }), h('path', { d: 'M5.3 8.2l1.9 1.9 3.6-3.9' }));
  }
  if (kind === 'error') {
    return h('svg', base, h('circle', { cx: 8, cy: 8, r: 6.2 }), h('path', { d: 'M8 4.7v4' }), h('path', { d: 'M8 11.2h.01' }));
  }
  return h('svg', base, h('circle', { cx: 8, cy: 8, r: 6.2 }), h('path', { d: 'M8 7.4v3.4' }), h('path', { d: 'M8 4.9h.01' }));
}

/** 加载骨架屏：行高与列宽对齐真实表格，加载完成时布局不跳动。 */
export function LoadingPlaceholder() {
  const bar = (small) =>
    h('div', {
      className: small === true ? 'ttl-skeleton-bar ttl-skeleton-bar-small' : 'ttl-skeleton-bar',
    });
  const headBar = (width) => h('div', { className: 'ttl-skeleton-bar ttl-skeleton-bar-small', style: { width } });
  const rows = [0, 1, 2, 3].map((index) =>
    h(
      'div',
      { key: index, className: 'ttl-skeleton-row' },
      bar(),
      bar(),
      bar(true),
      bar(true),
      bar(true),
      bar(true)
    )
  );
  return h(
    'div',
    { className: 'ttl-skeleton', role: 'status', 'aria-live': 'polite' },
    h('span', { className: 'ttl-sr-only' }, t('list.loading')),
    h('div', { className: 'ttl-skeleton-head' }, headBar('18%'), headBar('8%')),
    rows
  );
}

/** 空列表：说明原因 + 一个可执行的下一步。 */
export function EmptyPlaceholder(props) {
  const filter = props && typeof props.filter === 'string' ? props.filter : 'all';
  let titleKey = 'list.empty';
  let hintKey = 'list.emptyHint';
  if (filter === 'pending') {
    titleKey = 'list.emptyPending';
    hintKey = 'list.emptyPendingHint';
  } else if (filter === 'completed') {
    titleKey = 'list.emptyCompleted';
    hintKey = 'list.emptyCompletedHint';
  }
  const onAction = props && typeof props.onAction === 'function' ? props.onAction : null;
  const actionKey = props && typeof props.actionKey === 'string' ? props.actionKey : 'list.emptyAction';
  return h(
    'div',
    { className: 'ttl-placeholder', role: 'status' },
    h('p', { className: 'ttl-placeholder-title' }, t(titleKey)),
    h('p', { className: 'ttl-placeholder-hint' }, t(hintKey)),
    onAction === null
      ? null
      : h(
          'div',
          { className: 'ttl-placeholder-action' },
          h('button', { type: 'button', className: 'ttl-button ttl-button-outline', onClick: onAction }, t(actionKey))
        )
  );
}


export function ErrorPlaceholder(props) {
  const message = props && typeof props.message === 'string' ? props.message : '';
  return h(
    'div',
    { className: 'ttl-placeholder ttl-placeholder-error', role: 'alert' },
    h('p', { className: 'ttl-placeholder-title' }, t('list.error')),
    message !== '' ? h('p', { className: 'ttl-placeholder-hint' }, message) : null,
    h(
      'div',
      { className: 'ttl-placeholder-action' },
      h(
        'button',
        { type: 'button', className: 'ttl-button ttl-button-outline', onClick: props && props.onRetry },
        t('list.retry')
      )
    )
  );
}

/** 分类徽标；未分类用弱化样式。 */
export function ProjectBadge(props) {
  const project = normalizeProject(props && props.project);
  const className = project === '' ? 'ttl-badge ttl-badge-project ttl-badge-project-none' : 'ttl-badge ttl-badge-project';
  return h('span', { className, title: projectLabel(project) }, projectLabel(project));
}

/**
 * 甘特图视图：纯展示，数据由父级 /list（filter=all、sortBy=createdAt、
 * direction=asc、带 project 筛选）提供。非法/缺失时间一律跳过或按 now 兜底。
 */
export function GanttView(props) {
  const todos = props && Array.isArray(props.todos) ? props.todos : [];
  const range = props && typeof props.range === 'string' ? props.range : 'all';
  const nowMs = Date.now();
  let rangeDays = 0;
  for (const option of GANTT_RANGES) {
    if (option.value === range) rangeDays = option.days;
  }
  const windowStart = rangeDays > 0 ? nowMs - rangeDays * 86400e3 : null;

  const entries = [];
  for (const todo of todos) {
    if (todo === null || todo === undefined) continue;
    const start = toMillis(todo.createdAt);
    if (start === null) continue; // 创建时间不可解析：无法定位，跳过该条
    const completed = todo.status === 'completed';
    let end = completed ? toMillis(todo.completedAt) : nowMs;
    if (end === null || end < start) end = nowMs > start ? nowMs : start; // 非法完成时间按 now 兜底
    if (windowStart !== null && (end < windowStart || start > nowMs)) continue;
    entries.push({ todo, start, end, ongoing: !completed });
  }

  if (entries.length === 0) {
    return h(TextPlaceholder, {
      titleKey: 'gantt.empty',
      hintKey: 'gantt.emptyHint',
      actionKey: props && typeof props.emptyActionKey === 'string' ? props.emptyActionKey : 'list.emptyAction',
      onAction: props && typeof props.onEmptyAction === 'function' ? props.onEmptyAction : null,
    });
  }

  let min = Infinity;
  let max = -Infinity;
  for (const entry of entries) {
    if (entry.start < min) min = entry.start;
    if (entry.end > max) max = entry.end;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return h(TextPlaceholder, {
      titleKey: 'gantt.empty',
      hintKey: 'gantt.emptyHint',
      actionKey: props && typeof props.emptyActionKey === 'string' ? props.emptyActionKey : 'list.emptyAction',
      onAction: props && typeof props.onEmptyAction === 'function' ? props.onEmptyAction : null,
    });
  }

  let span = max - min;
  if (span <= 0) {
    min -= 1800000;
    max += 1800000;
    span = max - min;
  }
  const padding = span * 0.05;
  min -= padding;
  max += padding;
  span = max - min;

  const toX = (ms) => ((ms - min) / span) * GANTT_TRACK_WIDTH;
  const nowInDomain = nowMs >= min && nowMs <= max;
  const nowX = nowInDomain ? toX(nowMs) : 0;
  const step = chooseTickStep(span);
  const ticks = [];
  let tick = Math.ceil(min / step) * step;
  let guard = 0;
  while (tick <= max && guard < 200) {
    ticks.push(tick);
    tick += step;
    guard += 1;
  }

  const barAria = (entry) => {
    const todo = entry.todo;
    const endLabel = entry.ongoing
      ? t('gantt.ongoing')
      : t('gantt.barEndCompleted', { time: formatTime(todo.completedAt) });
    return t('gantt.barAria', {
      project: projectLabel(normalizeProject(todo.project)),
      title: todo.title === '' ? t('list.empty') : todo.title,
      start: formatTime(todo.createdAt),
      end: endLabel,
    });
  };

  const bodyWidth = GANTT_LABEL_WIDTH + GANTT_TRACK_WIDTH;
  const groups = groupByProject(entries, (entry) => entry.todo.project);
  const ganttDetailIdOf = (todo) => `ttl-gantt-detail-${String(todo.id).replace(/[^A-Za-z0-9_-]/g, '-')}`;
  const isExpanded = (todo) => Boolean(props && props.expandedIds && props.expandedIds[todo.id] === true);
  const toggleRow = (todo) => {
    if (todo === null || todo === undefined) return;
    if (props && typeof props.onToggleExpanded === 'function') props.onToggleExpanded(todo);
  };

  return h(
    'div',
    { className: 'ttl-gantt' },
    h(
      'div',
      { className: 'ttl-gantt-scroll', role: 'region', 'aria-label': t('gantt.aria'), tabIndex: 0 },
      h(
        'div',
        { className: 'ttl-gantt-body', style: { width: `${bodyWidth}px` } },
        nowInDomain
          ? h('div', {
              className: 'ttl-gantt-now-line',
              style: { left: `${GANTT_LABEL_WIDTH + nowX}px` },
              'aria-hidden': 'true',
            })
          : null,
        h(
          'div',
          { className: 'ttl-gantt-head' },
          h('div', { className: 'ttl-gantt-head-label' }, t('gantt.axis')),
          h(
            'div',
            { className: 'ttl-gantt-head-track', style: { width: `${GANTT_TRACK_WIDTH}px` } },
            ticks.map((ms) =>
              h(
                'span',
                {
                  key: `head-${ms}`,
                  className: 'ttl-gantt-tick-label',
                  style: { left: `${toX(ms)}px` },
                },
                formatTickLabel(ms, span)
              )
            ),
            nowInDomain
              ? h('span', { className: 'ttl-gantt-now-label', style: { left: `${nowX}px` } }, t('gantt.now'))
              : null
          )
        ),
        groups.map((group) =>
          h(
            'div',
            { key: `gantt-group-${group.project}`, className: 'ttl-gantt-group' },
            h(
              'div',
              { className: 'ttl-gantt-group-head' },
              h(
                'div',
                { className: 'ttl-gantt-head-label ttl-gantt-group-label' },
                t('group.header', { project: projectLabel(group.project), count: group.items.length })
              ),
              h('div', { className: 'ttl-gantt-group-track', style: { width: `${GANTT_TRACK_WIDTH}px` } })
            ),
            group.items.map((entry) => {
              const aria = barAria(entry);
              const todo = entry.todo;
              const expanded = isExpanded(todo);
              const editing = Boolean(props && props.editingId === todo.id);
              const detailId = ganttDetailIdOf(todo);
              const row = h(
                'div',
                {
                  key: todo.id,
                  className: expanded ? 'ttl-gantt-row ttl-gantt-row-expanded' : 'ttl-gantt-row',
                  'data-status': todo.status,
                  onClick: () => toggleRow(todo),
                },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'ttl-gantt-row-label',
                    'aria-expanded': expanded ? 'true' : 'false',
                    'aria-controls': detailId,
                    'aria-label': t('detail.toggleAria', {
                      action: expanded ? t('detail.collapse') : t('detail.expand'),
                      title: todo.title,
                    }),
                    title: expanded ? t('detail.collapse') : t('detail.expand'),
                    onClick: (event) => {
                      if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
                      toggleRow(todo);
                    },
                  },
                  h('span', { className: 'ttl-gantt-dot', 'data-status': todo.status, 'aria-hidden': 'true' }),
                  h(
                    'span',
                    { className: 'ttl-gantt-title', title: todo.title },
                    todo.title === '' ? t('list.empty') : todo.title
                  ),
                  h(ProjectBadge, { project: todo.project })
                ),
                h(
                  'div',
                  { className: 'ttl-gantt-track', style: { width: `${GANTT_TRACK_WIDTH}px` } },
                  ticks.map((ms) =>
                    h('span', {
                      key: `grid-${ms}`,
                      className: 'ttl-gantt-grid',
                      style: { left: `${toX(ms)}px` },
                      'aria-hidden': 'true',
                    })
                  ),
                  h(
                    'div',
                    {
                      className: entry.ongoing
                        ? 'ttl-gantt-bar ttl-gantt-bar-ongoing'
                        : 'ttl-gantt-bar ttl-gantt-bar-completed',
                      style: {
                        left: `${((entry.start - min) / span) * 100}%`,
                        width: `${Math.max(((entry.end - entry.start) / span) * 100, 0.4)}%`,
                      },
                      role: 'img',
                      'aria-label': aria,
                      title: aria,
                    },
                    entry.ongoing
                      ? h('span', { className: 'ttl-gantt-bar-flag' }, t('gantt.ongoing'))
                      : null
                  )
                )
              );
              if (!expanded) return row;
              const detail = h(
                'div',
                {
                  key: `${todo.id}-detail`,
                  id: detailId,
                  className: 'ttl-gantt-row-detail',
                  role: 'region',
                  'aria-label': t('detail.aria'),
                },
                h(
                  'div',
                  { className: 'ttl-gantt-row-detail-inner' },
                  props && typeof props.renderDetailContent === 'function'
                    ? props.renderDetailContent(todo)
                    : null,
                  editing && props && typeof props.renderEditFields === 'function'
                    ? props.renderEditFields(todo)
                    : null,
                  h(
                    'div',
                    { className: 'ttl-gantt-row-detail-actions' },
                    props && typeof props.renderActions === 'function' ? props.renderActions(todo) : null
                  )
                )
              );
              return [row, detail];
            })
          )
        )
      )
    )
  );
}

/** 文件 chip：点击复制完整路径（父级传入 onCopy；剪贴板不可用时静默降级）。 */
export function FileChip(props) {
  const path = typeof (props && props.path) === 'string' ? props.path : '';
  if (path === '') return null;
  const label = props && typeof props.label === 'string' && props.label !== '' ? props.label : fileBaseName(path);
  return h(
    'button',
    {
      type: 'button',
      className: props && props.compact === true ? 'ttl-file-chip ttl-file-chip-compact' : 'ttl-file-chip',
      title: t('files.copyTitle', { path }),
      'aria-label': t('files.copyTitle', { path }),
      onClick: (event) => {
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        if (props && typeof props.onCopy === 'function') props.onCopy(path);
      },
    },
    h('span', { className: 'ttl-file-chip-icon', 'aria-hidden': 'true' }, '📎'),
    h('span', { className: 'ttl-file-chip-name' }, label)
  );
}

/**
 * 分类选择器：未分类 → optgroup(已用/工作区/文件夹) → 自定义…。
 * 受控组件：custom=true 时显示自定义文本输入与「返回列表」按钮。
 * 老数据里不在建议中的 project 会以临时 option 保留显示，不丢值。
 */
export function ProjectPicker(props) {
  const value = normalizeProject(props && props.value);
  const options = props && Array.isArray(props.options) ? props.options : [];
  const custom = Boolean(props && props.custom);
  const disabled = Boolean(props && props.disabled);
  const groups = { used: [], workspace: [], folder: [] };
  for (const item of options) {
    if (item && groups[item.source] !== undefined && item.name !== '') groups[item.source].push(item);
  }
  const known = options.some((item) => item && item.name === value);
  const showTemporary = !custom && value !== '' && !known;

  if (custom) {
    return h(
      'div',
      { className: 'ttl-project-picker ttl-project-picker-custom' },
      h('input', {
        className: 'ttl-input ttl-project-input',
        type: 'text',
        value,
        placeholder: t('projects.customPlaceholder'),
        'aria-label': t('project.label'),
        disabled,
        onChange: (event) => {
          if (props && typeof props.onChange === 'function') props.onChange(event.target.value);
        },
        onKeyDown: (event) => {
          if (props && typeof props.onInputKeyDown === 'function') props.onInputKeyDown(event);
        },
      }),
      h(
        'button',
        {
          type: 'button',
          className: 'ttl-link ttl-project-back',
          disabled,
          onClick: () => {
            if (props && typeof props.onBackToList === 'function') props.onBackToList();
          },
        },
        t('projects.backToList')
      )
    );
  }

  const renderGroup = (source, labelKey) => {
    const items = groups[source];
    if (items.length === 0) return null;
    return h(
      'optgroup',
      { key: source, label: t(labelKey) },
      items.map((item) =>
        h(
          'option',
          { key: `${source}:${item.name}`, value: item.name, title: item.name },
          source === 'used' ? t('projects.countOption', { name: item.name, count: item.count }) : item.name
        )
      )
    );
  };

  return h(
    'div',
    { className: 'ttl-project-picker' },
    h(
      'select',
      {
        className: 'ttl-project-select',
        value,
        'aria-label': t('project.label'),
        disabled,
        onChange: (event) => {
          const next = event.target.value;
          if (next === PROJECT_CUSTOM) {
            if (props && typeof props.onCustom === 'function') props.onCustom();
            return;
          }
          if (props && typeof props.onChange === 'function') props.onChange(next);
        },
      },
      h('option', { value: '' }, t('project.none')),
      showTemporary ? h('option', { key: 'temporary', value }, value) : null,
      renderGroup('used', 'projects.groupUsed'),
      renderGroup('workspace', 'projects.groupWorkspace'),
      renderGroup('folder', 'projects.groupFolder'),
      h('option', { value: PROJECT_CUSTOM }, t('projects.custom'))
    )
  );
}

/** 补全下拉的列表/三态内容（对话面板与顶部新建框共用）。 */
export function SuggestionItems(props) {
  const kind = props && props.kind === 'project' ? 'project' : 'file';
  const suggestions = props && Array.isArray(props.suggestions) ? props.suggestions : [];
  const active = props && typeof props.active === 'number' && props.active >= 0 ? props.active : 0;
  if (props && props.loading) {
    return h(
      'div',
      { className: 'ttl-file-suggest-status' },
      t(kind === 'project' ? 'chat.projectsLoading' : 'chat.filesLoading')
    );
  }
  if (props && props.error) {
    return h(
      'div',
      { className: 'ttl-file-suggest-status ttl-file-suggest-status-error' },
      t(kind === 'project' ? 'chat.projectsError' : 'chat.filesError')
    );
  }
  if (suggestions.length === 0) {
    return h('div', { className: 'ttl-file-suggest-status' }, t(kind === 'project' ? 'chat.projectsEmpty' : 'chat.filesEmpty'));
  }
  return suggestions.map((value, index) =>
    h(
      'div',
      {
        key: value,
        className:
          index === active ? 'ttl-file-suggest-item ttl-file-suggest-item-active' : 'ttl-file-suggest-item',
        role: 'option',
        'aria-selected': index === active ? 'true' : 'false',
        onMouseDown: (event) => {
          if (event && typeof event.preventDefault === 'function') event.preventDefault();
        },
        onClick: () => {
          if (props && typeof props.onSelect === 'function') props.onSelect(value);
        },
      },
      h('span', { className: 'ttl-file-suggest-name' }, kind === 'project' ? value : fileBaseName(value)),
      kind === 'project' ? null : h('span', { className: 'ttl-file-suggest-path' }, value)
    )
  );
}

/** 补全下拉容器：listbox + 键盘提示（对话面板与顶部新建框共用）。 */
export function SuggestionDropdown(props) {
  const kind = props && props.kind === 'project' ? 'project' : 'file';
  return h(
    'div',
    {
      className: 'ttl-file-suggest',
      role: 'listbox',
      'aria-label': t(kind === 'project' ? 'chat.projectsAria' : 'chat.filesAria'),
    },
    h('div', { className: 'ttl-file-suggest-hint' }, t('chat.filesHint')),
    h(SuggestionItems, props)
  );
}

/** 对话录入面板：受控组件，消息与请求状态由 TodoPanel 管理。 */
export function ChatPanel(props) {
  const open = Boolean(props && props.open);
  const busy = Boolean(props && props.busy);
  const messages = props && Array.isArray(props.messages) ? props.messages : [];
  const input = props && typeof props.input === 'string' ? props.input : '';
  const suggestions = props && Array.isArray(props.suggestions) ? props.suggestions : [];
  const suggestionsOpen = Boolean(props && props.suggestionsOpen);
  const suggestionsLoading = Boolean(props && props.suggestionsLoading);
  const suggestionsError = Boolean(props && props.suggestionsError);
  const suggestionsActive =
    props && typeof props.suggestionsActive === 'number' && props.suggestionsActive >= 0 ? props.suggestionsActive : 0;
  const suggestionsKind = props && props.suggestionsKind === 'project' ? 'project' : 'file';
  const workspaces = props && Array.isArray(props.workspaces) ? props.workspaces : [];
  const workspace = props && typeof props.workspace === 'string' ? props.workspace : '';
  const selectedWorkspace = workspaces.find((item) => item && item.path === workspace) || null;
  const logRef = React.useRef(null);
  const blurTimerRef = React.useRef(null);

  const clearBlurTimer = () => {
    if (blurTimerRef.current !== null) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
  };

  React.useEffect(() => {
    const node = logRef.current;
    if (node !== null && node !== undefined && typeof node.scrollTop === 'number') {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages.length, open]);

  // 卸载时清理失焦关闭下拉的定时器，避免卸载后 setState。
  React.useEffect(
    () => () => {
      clearBlurTimer();
    },
    []
  );

  const closeSuggest = () => {
    if (props && typeof props.onSuggestClose === 'function') props.onSuggestClose();
  };

  const handleKeyDown = (event) => {
    if (!event) return;
    const composing = event.isComposing === true || (event.nativeEvent && event.nativeEvent.isComposing === true);
    if (suggestionsOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (props && typeof props.onSuggestMove === 'function') props.onSuggestMove(1);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (props && typeof props.onSuggestMove === 'function') props.onSuggestMove(-1);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSuggest();
        return;
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && composing !== true) {
        event.preventDefault();
        if (suggestions.length > 0 && props && typeof props.onSuggestSelect === 'function') {
          props.onSuggestSelect(suggestions[suggestionsActive]);
        } else {
          closeSuggest();
        }
        return;
      }
    }
    if (event.key === 'Enter' && event.shiftKey !== true && composing !== true) {
      event.preventDefault();
      if (props && typeof props.onSend === 'function') props.onSend();
    }
  };

  const bubbles = messages.map((message) => {
    const record = isRecord(message) ? message : {};
    const role = record.role === 'user' ? 'user' : 'assistant';
    let text = typeof record.text === 'string' ? record.text : '';
    if (role === 'assistant' && record.welcome === true) text = t('chat.welcome');
    const pendingUndoCount =
      role === 'assistant' && Array.isArray(record.undoFailed) && record.undoFailed.length > 0
        ? record.undoFailed.length
        : null;
    const successes = Array.isArray(record.successes) ? record.successes : [];
    const canUndo = role === 'assistant' && successes.length > 0 && record.undone !== true;
    const retryUndo = canUndo && pendingUndoCount !== null;
    const successFiles = [];
    if (role === 'assistant') {
      for (const todo of successes) {
        if (!isRecord(todo)) continue;
        for (const path of normalizeFiles(todo.files)) {
          successFiles.push({ path, key: `${typeof todo.id === 'string' ? todo.id : ''}:${path}` });
        }
      }
    }
    const key = record.id === undefined ? `msg-${role}-${text.slice(0, 24)}` : record.id;
    return h(
      'div',
      { key, className: `ttl-chat-line ttl-chat-line-${role}` },
      h(
        'div',
        { className: `ttl-chat-bubble ttl-chat-bubble-${role}` },
        h('div', { className: 'ttl-chat-text' }, text),
        successFiles.length > 0
          ? h(
              'div',
              { className: 'ttl-chat-files' },
              successFiles.map((item) =>
                h(FileChip, { key: item.key, path: item.path, compact: true, onCopy: props && props.onCopyFile })
              )
            )
          : null,
        canUndo
          ? h(
              'button',
              {
                type: 'button',
                className: 'ttl-chat-undo',
                disabled: busy,
                'aria-label': retryUndo
                  ? t('chat.undoRetryAria', { count: pendingUndoCount })
                  : t('chat.undoAria', { count: successes.length }),
                onClick: () => {
                  if (props && typeof props.onUndo === 'function') props.onUndo(record);
                },
              },
              retryUndo ? t('chat.undoRetry') : t('chat.undo')
            )
          : null
      )
    );
  });

  return h(
    'section',
    { id: props && typeof props.id === 'string' ? props.id : undefined, className: 'ttl-chat', 'aria-label': t('chat.ariaLabel') },
    h(
      'div',
      { className: 'ttl-chat-headrow' },
      h(
        'button',
        {
          type: 'button',
          className: 'ttl-chat-head',
          'aria-expanded': open ? 'true' : 'false',
          'aria-controls': 'ttl-chat-body',
          title: open ? t('chat.collapse') : t('chat.expand'),
          onClick: () => {
            if (props && typeof props.onToggle === 'function') props.onToggle();
          },
        },
        h('span', { className: 'ttl-chat-head-title' }, t('chat.title')),
        h('span', { className: 'ttl-chat-head-hint' }, open ? t('chat.collapse') : t('chat.expand')),
        h(
          'svg',
          {
            width: 12,
            height: 12,
            viewBox: '0 0 16 16',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.6,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            'aria-hidden': 'true',
            focusable: 'false',
            className: open ? 'ttl-chat-chevron ttl-chat-chevron-open' : 'ttl-chat-chevron',
            style: { display: 'block', flex: 'none' },
          },
          h('path', { d: 'M6 4l4 4-4 4' })
        )
      ),
      workspaces.length > 0
        ? h(
            'label',
            { className: 'ttl-chat-workspace' },
            h('span', { className: 'ttl-chat-workspace-label' }, t('chat.workspaceLabel')),
            h(
              'select',
              {
                className: 'ttl-chat-workspace-select',
                value: workspace,
                'aria-label': t('chat.workspaceAria'),
                title: selectedWorkspace === null ? '' : selectedWorkspace.path,
                onChange: (event) => {
                  if (props && typeof props.onWorkspaceChange === 'function') {
                    props.onWorkspaceChange(event.target.value);
                  }
                },
              },
              workspaces.map((item) =>
                h(
                  'option',
                  { key: item.path, value: item.path, title: item.path },
                  item.title === '' ? item.path : item.title
                )
              )
            )
          )
        : null
    ),
    open
      ? h(
          'div',
          { id: 'ttl-chat-body', className: 'ttl-chat-body' },
          h(
            'div',
            {
              ref: logRef,
              className: 'ttl-chat-log',
              role: 'log',
              'aria-live': 'polite',
              'aria-label': t('chat.logAria'),
            },
            bubbles
          ),
          h(
            'div',
            { className: 'ttl-chat-compose' },
            suggestionsOpen
              ? h(SuggestionDropdown, {
                  kind: suggestionsKind,
                  loading: suggestionsLoading,
                  error: suggestionsError,
                  suggestions,
                  active: suggestionsActive,
                  onSelect: (value) => {
                    if (props && typeof props.onSuggestSelect === 'function') props.onSuggestSelect(value);
                  },
                })
              : null,
            h('textarea', {
              className: 'ttl-input ttl-chat-input',
              rows: 2,
              value: input,
              placeholder: t('chat.placeholder'),
              'aria-label': t('chat.placeholder'),
              disabled: busy,
              onChange: (event) => {
                if (props && typeof props.onChange === 'function') {
                  props.onChange(event.target.value, event.target.selectionStart);
                }
              },
              onKeyDown: handleKeyDown,
              onBlur: () => {
                clearBlurTimer();
                blurTimerRef.current = setTimeout(() => {
                  blurTimerRef.current = null;
                  closeSuggest();
                }, 120);
              },
              onFocus: () => {
                clearBlurTimer();
              },
            }),
            h(
              'button',
              {
                type: 'button',
                className: 'ttl-button ttl-button-primary ttl-chat-send',
                disabled: busy || input.trim() === '',
                onClick: () => {
                  if (props && typeof props.onSend === 'function') props.onSend();
                },
              },
              busy ? t('chat.sending') : t('chat.send')
            )
          )
        )
      : null
  );
}
