/** 常量（筛选/排序/视图枚举）与 CSS 文本、样式表组件。 */
import { h } from './runtime.js';



export const FILTERS = [
  { value: 'all', labelKey: 'filter.all' },
  { value: 'pending', labelKey: 'filter.pending' },
  { value: 'completed', labelKey: 'filter.completed' },
];
export const PRIORITIES = [
  { value: '', labelKey: 'priority.none' },
  { value: 'high', labelKey: 'priority.high' },
  { value: 'medium', labelKey: 'priority.medium' },
  { value: 'low', labelKey: 'priority.low' },
];
export const TYPES = [
  { value: '', labelKey: 'type.none' },
  { value: 'bug', labelKey: 'type.bug' },
  { value: 'feature', labelKey: 'type.feature' },
  { value: 'improvement', labelKey: 'type.improvement' },
  { value: 'question', labelKey: 'type.question' },
  { value: 'chore', labelKey: 'type.chore' },
  { value: 'other', labelKey: 'type.other' },
];
export const DIRECTIONS = [
  { value: 'asc', labelKey: 'direction.asc' },
  { value: 'desc', labelKey: 'direction.desc' },
];
export const VIEWS = [
  { value: 'table', labelKey: 'view.table' },
  { value: 'board', labelKey: 'view.board' },
  { value: 'gantt', labelKey: 'view.gantt' },
  { value: 'calendar', labelKey: 'view.calendar' },
];
export const BOARD_GROUPS = [
  { value: 'status', labelKey: 'board.groupStatus' },
  { value: 'project', labelKey: 'board.groupProject' },
  { value: 'status-project', labelKey: 'board.groupStatusProject' },
];
/** 看板密度：舒适（默认）/ 紧凑（标题 1 行、隐藏文件 chip 与分类名）。 */
export const BOARD_DENSITIES = [
  { value: 'comfortable', labelKey: 'board.densityComfortable' },
  { value: 'compact', labelKey: 'board.densityCompact' },
];
/** 导入冲突处理：合并（默认）/ 仅新增 / 覆盖全部。 */
export const TRANSFER_MODES = [
  { value: 'merge', labelKey: 'transfer.modeMerge', hintKey: 'transfer.modeMergeHint' },
  { value: 'add', labelKey: 'transfer.modeAdd', hintKey: 'transfer.modeAddHint' },
  { value: 'replace', labelKey: 'transfer.modeReplace', hintKey: 'transfer.modeReplaceHint' },
];
/** 「已完成」列默认收纳的最近条数；超过后折叠为「显示全部」。 */
export const BOARD_COMPLETED_LIMIT = 10;
export const CALENDAR_BASES = [
  { value: 'createdAt', labelKey: 'calendar.basisCreated' },
  { value: 'completedAt', labelKey: 'calendar.basisCompleted' },
];
export const CALENDAR_WEEKDAY_KEYS = [
  'calendar.weekdayMon',
  'calendar.weekdayTue',
  'calendar.weekdayWed',
  'calendar.weekdayThu',
  'calendar.weekdayFri',
  'calendar.weekdaySat',
  'calendar.weekdaySun',
];
/** 表格列：sortBy 为 null 时该列不可排序（勾选/状态/操作）；srOnly 列只给读屏保留标签。 */
export const TABLE_COLUMNS = [
  { key: 'check', labelKey: 'row.complete', sortBy: null, srOnly: true },
  { key: 'title', labelKey: 'table.title', sortBy: 'title' },
  { key: 'project', labelKey: 'table.project', sortBy: 'project' },
  { key: 'status', labelKey: 'table.status', sortBy: null },
  { key: 'createdAt', labelKey: 'table.createdAt', sortBy: 'createdAt', align: 'right' },
  { key: 'completedAt', labelKey: 'table.completedAt', sortBy: 'completedAt', align: 'right' },
  { key: 'actions', labelKey: 'table.actions', sortBy: null, align: 'right' },
];
export const CALENDAR_CELLS = 42;
export const CALENDAR_MAX_ITEMS = 3;

/**
 * 每个视图需要的 /list 查询参数：表格用工具栏状态，其它视图取全量并在客户端
 * 分组/落格（分类筛选始终透传）。
 */
export function queryForView(view, filter, sortBy, direction) {
  if (view === 'gantt') return { filter: 'all', sortBy: 'createdAt', direction: 'asc' };
  // 看板的分组/落列在客户端完成，但状态筛选仍然生效（与表格同一状态源，避免「筛选静默失效」）。
  if (view === 'board') return { filter, sortBy: 'createdAt', direction: 'desc' };
  if (view === 'calendar') return { filter: 'all', sortBy: 'createdAt', direction: 'asc' };
  return { filter, sortBy, direction };
}

export const GANTT_RANGES = [
  { value: 'today', labelKey: 'gantt.rangeToday', days: 1 },
  { value: '7d', labelKey: 'gantt.range7d', days: 7 },
  { value: '30d', labelKey: 'gantt.range30d', days: 30 },
  { value: 'all', labelKey: 'gantt.rangeAll', days: 0 },
];
/** 分类筛选里代表「全部」的哨兵值；'' 保留给「未分类」。 */
export const PROJECT_FILTER_ALL = '__ttl_all_projects__';
/** 「自定义分类…」哨兵值（原生 select 里的特殊选项）。 */
export const PROJECT_CUSTOM = '__ttl_custom_project__';
/** 看板「移到分类」里代表未分类的哨兵值（'' 留给 select 占位项）。 */
export const BOARD_MOVE_UNCATEGORIZED = '__ttl_board_uncategorized__';
/** 类型筛选里代表「全部类型」的哨兵值；'' 保留给「未设置」。 */
export const TYPE_FILTER_ALL = '__ttl_all_types__';

export const CSS_TEXT = `.ttl-root {
  position: relative;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base);
  /* 与宿主 UI 同一套字体栈（真机继承宿主 body 字体）：显式声明后，静态预览与真机一致，
     也不会被祖先样式改掉。 */
  font-family: var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif);
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  /* 动效令牌：短、克制、只服务状态变化（入场 / 浮层 / 勾选）。 */
  --ttl-ease-out: cubic-bezier(0.22, 0.61, 0.36, 1);
  --ttl-ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1);
  --ttl-dur-fast: 120ms;
  --ttl-dur-base: 180ms;
}
.ttl-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  scrollbar-gutter: stable;
}
.ttl-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 clamp(20px, 3vw, 40px) 48px;
}
.ttl-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
  padding-top: 24px;
  margin-bottom: 16px;
}
.ttl-heading-text { min-width: 0; }
.ttl-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
}
.ttl-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
.ttl-heading-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.ttl-ghost-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 30px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--dsw-radius-sm);
  background: none;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 13px;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}
.ttl-ghost-button:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.ttl-ghost-button[aria-expanded='true'] {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.ttl-ghost-button-icon { transition: transform 0.15s; }

/* 新建待办：整页唯一的主操作区。外层 16 = 内层 8 + 内边距 8。 */
.ttl-composer {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 20px;
  padding: 8px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-lg);
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: var(--dsw-shadow-lv1);
  transition: border-color 0.15s, box-shadow 0.15s;
  animation: ttl-fade-in 160ms var(--ttl-ease-out);
}
.ttl-composer:hover { border-color: var(--dsw-alias-border-l3); }
.ttl-composer:focus-within {
  border-color: color-mix(in srgb, var(--dsw-alias-state-business-primary) 55%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, transparent);
}
.ttl-composer-input {
  flex: 1 1 220px;
  min-width: 0;
  height: 36px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--dsw-radius-sm);
  background: none;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 14px;
}
.ttl-composer-input:focus { outline: none; }
.ttl-composer-input::placeholder { color: var(--dsw-alias-label-caption); }
.ttl-composer .ttl-project-select {
  height: 32px;
  border-color: transparent;
  background: var(--dsw-alias-bg-module-platform);
}
.ttl-composer .ttl-project-select:hover {
  border-color: var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-primary);
}
.ttl-composer .ttl-button-primary { height: 36px; padding: 0 18px; }
/* 「批量」是捕获区的模式切换，不是第二个主操作：保持 ghost 层级。 */
.ttl-composer-batch { height: 32px; padding: 0 8px; }
.ttl-create-suggest {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 6;
  width: min(420px, 100%);
}
.ttl-create-suggest .ttl-file-suggest {
  position: static;
  right: auto;
  bottom: auto;
  max-height: 236px;
}
.ttl-input {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  transition: border-color 0.15s;
}
.ttl-input:hover { border-color: var(--dsw-alias-border-l2); }
.ttl-input:focus {
  outline: none;
  border-color: var(--dsw-alias-state-business-primary);
}
.ttl-input::placeholder { color: var(--dsw-alias-label-caption); }
.ttl-button {
  flex: none;
  border: 0;
  border-radius: var(--dsw-radius-sm);
  font: inherit;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s, transform var(--ttl-dur-fast) var(--ttl-ease-out);
}
.ttl-button:active:not(:disabled) { transform: scale(0.98); }
.ttl-button-primary {
  height: 34px;
  padding: 0 16px;
  background: var(--dsw-alias-button-primary-fill);
  color: var(--dsw-alias-label-primary-foreground);
  font-weight: 500;
}
.ttl-button-primary:hover { background: var(--dsw-alias-button-primary-hover); }
.ttl-button-outline {
  height: 30px;
  padding: 0 12px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  background: none;
  color: var(--dsw-alias-label-secondary);
}
.ttl-button-outline:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.ttl-button:disabled { opacity: 0.5; cursor: not-allowed; }
.ttl-button:focus-visible,
.ttl-ghost-button:focus-visible,
.ttl-seg-item:focus-visible,
.ttl-link:focus-visible,
.ttl-toast-action:focus-visible,
.ttl-toast-close:focus-visible,
.ttl-select select:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 2px;
}

/* 数据区：视图/筛选控制与列表同属一张卡片，成为唯一的数据容器。 */
.ttl-data {
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-lg);
  background: var(--dsw-alias-bg-base);
  box-shadow: var(--dsw-shadow-lv1);
  overflow: hidden;
}
.ttl-data > .ttl-toolbar {
  padding: 8px 12px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
}
.ttl-data .ttl-gantt,
.ttl-data .ttl-calendar,
.ttl-data .ttl-table-wrap {
  border: 0;
  border-radius: 0;
}
.ttl-data .ttl-list > .ttl-board { padding: 12px 12px 16px; }
/* 工具栏固定两行：第一行视图 + 搜索；第二行视图专属控件 + 全局筛选。 */
.ttl-toolbar {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}
.ttl-toolbar-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
}
.ttl-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.ttl-seg {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-bg-module-platform);
}
.ttl-seg-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 13px;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color var(--ttl-dur-fast) var(--ttl-ease-out),
    color var(--ttl-dur-fast) var(--ttl-ease-out),
    box-shadow var(--ttl-dur-fast) var(--ttl-ease-out);
}
.ttl-seg-item:hover { color: var(--dsw-alias-label-primary); }
.ttl-seg-item[aria-pressed='true'] {
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font-weight: 500;
  box-shadow: var(--dsw-shadow-lv1);
}
.ttl-seg-count {
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  animation: ttl-count-pop 200ms var(--ttl-ease-out);
}
.ttl-seg-item[aria-pressed='true'] .ttl-seg-count { color: var(--dsw-alias-label-secondary); }
.ttl-select {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary);
}
.ttl-select select {
  height: 28px;
  padding: 0 6px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.ttl-refreshing {
  min-width: 52px;
  font-size: 12px;
  line-height: 20px;
  color: var(--dsw-alias-label-tertiary);
  text-align: right;
}
.ttl-list { display: block; }

/* 瞬时提示：绝对定位在面板底部，出现/消失都不改变布局高度。 */
.ttl-toast-host {
  position: absolute;
  left: 50%;
  bottom: 44px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: max-content;
  max-width: min(420px, calc(100% - 32px));
  transform: translateX(-50%);
  pointer-events: none;
}
.ttl-toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  padding: 8px 8px 8px 12px;
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-toast-bg);
  color: var(--dsw-alias-toast-label);
  font-size: 13px;
  line-height: 20px;
  box-shadow: var(--dsw-shadow-lv3);
  animation: ttl-toast-in 160ms ease-out;
}
.ttl-toast-icon { display: inline-flex; flex: none; }
.ttl-toast-icon[data-kind='success'] { color: var(--dsw-alias-state-success-secondary); }
.ttl-toast-icon[data-kind='error'] { color: var(--dsw-alias-state-error-secondary); }
.ttl-toast-text { min-width: 0; overflow-wrap: anywhere; }
.ttl-toast-action {
  flex: none;
  height: 24px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: color-mix(in srgb, var(--dsw-alias-toast-label) 16%, transparent);
  color: var(--dsw-alias-toast-label);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}
.ttl-toast-action:hover { background: color-mix(in srgb, var(--dsw-alias-toast-label) 26%, transparent); }
.ttl-toast-close {
  flex: none;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: none;
  color: color-mix(in srgb, var(--dsw-alias-toast-label) 70%, transparent);
  font: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}
.ttl-toast-close:hover {
  background: color-mix(in srgb, var(--dsw-alias-toast-label) 16%, transparent);
  color: var(--dsw-alias-toast-label);
}
@keyframes ttl-toast-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}

.ttl-rows {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.ttl-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border-radius: 12px;
}
.ttl-row:hover { background: var(--dsw-alias-interactive-bg-hover); }
.ttl-row-inner {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.ttl-detail-toggle {
  flex: none;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--dsw-alias-label-tertiary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.ttl-detail-toggle:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.ttl-detail-toggle:disabled { opacity: 0.5; cursor: not-allowed; }
.ttl-detail-toggle:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 2px;
}
.ttl-detail-toggle svg { transition: transform 0.15s; }
.ttl-detail-toggle-expanded svg { transform: rotate(90deg); }
.ttl-row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ttl-row-titleline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.ttl-row-title {
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  line-height: 23px;
  overflow-wrap: anywhere;
}
.ttl-row[data-status='completed'] .ttl-row-title { color: var(--dsw-alias-label-tertiary); }.ttl-badge {
  display: inline-flex;
  align-items: center;
  flex: none;
  height: 18px;
  padding: 0 7px;
  border: 0;
  border-radius: 9999px;
  background: color-mix(in srgb, var(--dsw-alias-label-secondary) 9%, transparent);
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}
.ttl-badge-completed {
  background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 14%, transparent);
  color: var(--dsw-alias-state-success-primary);
}
/* 状态：胶囊 + 状态点（颜色沿用胶囊文字色）。 */
.ttl-status-badge::before {
  content: '';
  flex: none;
  width: 5px;
  height: 5px;
  margin-right: 4px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.9;
}
.ttl-badge-row { display: inline-flex; flex-wrap: nowrap; align-items: center; gap: 4px; }
/* 类型：小号圆角矩形标签（与状态胶囊区分层级）。 */
.ttl-badge.ttl-type-badge {
  border-radius: 5px;
  padding: 0 6px;
  font-size: 10.5px;
  letter-spacing: 0.02em;
}
/* 优先级：箭头 + 文字，不再用第二个彩色胶囊，避免「标签汤」。 */
.ttl-badge.ttl-priority-badge {
  gap: 3px;
  padding: 0;
  background: none;
  font-weight: 500;
}
.ttl-priority-arrow { font-size: 11px; line-height: 1; }
.ttl-badge.ttl-priority-badge.ttl-priority-high { background: none; color: var(--dsw-alias-state-error-primary); }
.ttl-badge.ttl-priority-badge.ttl-priority-medium { background: none; color: var(--dsw-alias-state-warn-label); }
.ttl-badge.ttl-priority-badge.ttl-priority-low { background: none; color: var(--dsw-alias-label-tertiary); }
.ttl-priority-select select { min-width: 64px; }
.ttl-type-select select { min-width: 76px; }
.ttl-badge.ttl-type-bug {
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent);
  color: var(--dsw-alias-state-error-primary);
}
.ttl-badge.ttl-type-feature {
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, transparent);
  color: var(--dsw-alias-state-business-primary);
}
.ttl-badge.ttl-type-improvement {
  background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent);
  color: var(--dsw-alias-state-success-primary);
}
.ttl-badge.ttl-type-question {
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 14%, transparent);
  color: var(--dsw-alias-state-warn-primary);
}
.ttl-badge.ttl-type-chore,
.ttl-badge.ttl-type-other {
  background: color-mix(in srgb, var(--dsw-alias-label-secondary) 9%, transparent);
  color: var(--dsw-alias-label-secondary);
}

.ttl-row-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 14px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}
.ttl-time-label {
  margin-right: 4px;
  color: var(--dsw-alias-label-secondary);
}
.ttl-row-detail {
  margin: 0 2px 2px;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 20px;
  animation: ttl-fade-down 160ms var(--ttl-ease-out);
}
.ttl-detail-list {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 2px 10px;
  margin: 0;
}
.ttl-detail-label {
  color: var(--dsw-alias-label-tertiary);
  white-space: nowrap;
}
.ttl-detail-value {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}
.ttl-detail-id {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  overflow-wrap: anywhere;
}
.ttl-row-actions {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
}
.ttl-link {
  padding: 2px 3px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
  cursor: pointer;
}
.ttl-link:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.ttl-link:disabled { opacity: 0.5; cursor: not-allowed; }
.ttl-link-danger { color: var(--dsw-alias-state-error-primary); }
/* 表格「完成时间」列双行：时刻 + 用时 / 进行中。 */
.ttl-td-time .ttl-time-primary { display: block; line-height: 18px; }
.ttl-time-duration {
  display: block;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
  /* 完成后这一行才出现，淡入让「用时」自然接手。 */
  animation: ttl-fade-in 160ms var(--ttl-ease-out);
}
/* 表格行尾「⋯」与行内菜单：与看板卡片同一套动作模型。 */
.ttl-row-more {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}
.ttl-row-more:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.ttl-row-more:disabled { opacity: 0.5; cursor: not-allowed; }
/* 表格行尾：⋯ 在上，展开后的动作在下，整列右对齐且不撑破操作列。 */
.ttl-table-more {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}
.ttl-row-menu {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0;
  animation: ttl-fade-down var(--ttl-dur-fast) var(--ttl-ease-out);
}
.ttl-row-menu-item {
  padding: 1px 2px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
  cursor: pointer;
}
.ttl-row-menu-item:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.ttl-row-menu-item:disabled { opacity: 0.5; cursor: not-allowed; }
.ttl-row-menu-item-danger { color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 78%, transparent); }
.ttl-row-menu-item-danger:hover { color: var(--dsw-alias-state-error-primary); }
.ttl-row-edit-actions { display: inline-flex; align-items: center; justify-content: flex-end; gap: 6px; }
/* 行内编辑时状态列改为两个紧凑选择器（可见标签隐藏，aria-label 仍在）。 */
.ttl-edit-status { display: flex; align-items: center; gap: 4px; }
.ttl-edit-status .ttl-select > span { display: none; }
.ttl-edit-status .ttl-select select { max-width: 78px; font-size: 12px; }
.ttl-edit-input {
  flex: 1;
  height: 30px;
  min-width: 120px;
  font-size: 13px;
}.ttl-placeholder {
  min-height: 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  text-align: center;
  color: var(--dsw-alias-label-tertiary);
  font-size: 13px;
  line-height: 20px;
  animation: ttl-fade-in var(--ttl-dur-base) var(--ttl-ease-out);
}

.ttl-placeholder-title {
  margin: 0 0 4px;
  color: var(--dsw-alias-label-secondary);
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
}
.ttl-placeholder-hint {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 20px;
}
.ttl-placeholder-error .ttl-placeholder-title { color: var(--dsw-alias-state-error-primary); }
.ttl-placeholder-action { margin-top: 14px; }
.ttl-error-detail {
  margin: 8px 0 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
}.ttl-skeleton {
  display: flex;
  flex-direction: column;
}
.ttl-skeleton-head {
  display: flex;
  align-items: center;
  gap: 24px;
  height: 36px;
  padding: 0 12px;
  background: var(--dsw-alias-bg-module-platform);
}
.ttl-skeleton-row {
  display: grid;
  /* 与 .ttl-table 的列宽同口径（标题吃剩余，状态列固定），骨架屏不跳列。 */
  grid-template-columns: 20px minmax(0, 1fr) 72px 132px 100px 100px 92px;
  align-items: center;
  gap: 12px;
  height: 42px;
  padding: 0 12px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l1);
}
.ttl-skeleton-row .ttl-skeleton-bar { width: 100%; }
.ttl-skeleton-bar {
  height: 10px;
  border-radius: 5px;
  background: var(--dsw-alias-bg-skeleton);
  animation: ttl-pulse 1.4s ease-in-out infinite;
}
.ttl-skeleton-bar-small { height: 8px; }
.ttl-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
@keyframes ttl-pulse {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 1; }
}

.ttl-project-input { flex: 0 0 168px; }
.ttl-edit-project { flex: 0 0 120px; min-width: 90px; }
.ttl-project-picker { display: flex; flex: 0 1 190px; align-items: center; gap: 6px; min-width: 0; }
.ttl-project-picker-custom { flex: 0 1 250px; }
.ttl-project-picker .ttl-project-input { flex: 1; min-width: 0; }
.ttl-project-select {
  flex: 1;
  min-width: 0;
  height: 36px;
  padding: 0 6px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.ttl-project-back { flex: none; font-size: 12px; white-space: nowrap; }
.ttl-td .ttl-project-picker { flex: 0 1 190px; }
.ttl-board-edit .ttl-project-picker { flex: 1 1 100%; }
.ttl-calendar-entry-edit .ttl-project-picker { flex: 1 1 100%; }
.ttl-gantt-row-edit .ttl-project-picker { flex: 0 1 220px; }.ttl-badge-project {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  padding: 0;
  background: none;
  color: var(--dsw-alias-label-secondary);
  font-weight: 400;
}
.ttl-project-dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dsw-alias-label-tertiary);
}
.ttl-badge-project[data-tone='business'] .ttl-project-dot { background: var(--dsw-alias-state-business-primary); }
.ttl-badge-project[data-tone='done'] .ttl-project-dot { background: var(--dsw-alias-state-done-primary); }
.ttl-badge-project[data-tone='success'] .ttl-project-dot { background: var(--dsw-alias-state-success-primary); }
.ttl-badge-project[data-tone='warn'] .ttl-project-dot { background: var(--dsw-alias-state-warn-primary); }
.ttl-badge-project[data-tone='error'] .ttl-project-dot { background: var(--dsw-alias-state-error-primary); }
.ttl-badge-project[data-tone='idle'] .ttl-project-dot { background: var(--dsw-alias-label-caption); }
.ttl-project-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ttl-badge-project-none { color: var(--dsw-alias-label-caption); }

.ttl-list-group {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px 0 2px;
  padding: 0 8px;
  list-style: none;
}
.ttl-list-group-label {
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  overflow-wrap: anywhere;
}
.ttl-gantt {
  --ttl-gantt-label-width: 200px;
  --ttl-gantt-duration-width: 84px;
  position: relative;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  overflow: hidden;
  background: var(--dsw-alias-bg-base);
}
.ttl-gantt-scroll { overflow-x: auto; overflow-y: hidden; }
.ttl-gantt-scroll:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: -2px;
}
.ttl-gantt-body {
  position: relative;
  min-width: calc(var(--ttl-gantt-label-width) + var(--ttl-gantt-duration-width) + 240px);
}
/* 「现在」竖线：覆盖层左右避开标签列与用时列，线本身按轨道百分比定位。 */
.ttl-gantt-now-layer {
  position: absolute;
  top: 0;
  bottom: 0;
  left: var(--ttl-gantt-label-width);
  right: var(--ttl-gantt-duration-width);
  z-index: 2;
  pointer-events: none;
}
.ttl-gantt-now-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--dsw-alias-state-error-primary);
}
.ttl-gantt-head {
  display: flex;
  align-items: stretch;
  height: 30px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
}
.ttl-gantt-head-label,
.ttl-gantt-head-duration {
  position: sticky;
  flex: none;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 1;
}
.ttl-gantt-head-label {
  left: 0;
  z-index: 4;
  width: var(--ttl-gantt-label-width);
  padding: 0 10px;
}
.ttl-gantt-head-duration {
  right: 0;
  z-index: 4;
  justify-content: flex-end;
  width: var(--ttl-gantt-duration-width);
  padding: 0 10px;
  border-left: 0.5px solid var(--dsw-alias-border-l1);
}
.ttl-gantt-head-track {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
}
.ttl-gantt-tick-label {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
  pointer-events: none;
}
/* 首个刻度贴住轨道左缘：改为左对齐，避免被固定标签列盖住半截。 */
.ttl-gantt-tick-label-start { transform: translate(0, -50%); }
.ttl-gantt-now-label {
  position: absolute;
  top: 50%;
  right: 2px;
  transform: translateY(-50%);
  padding: 0 4px;
  border-radius: 3px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-state-error-primary);
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
  z-index: 5;
}
.ttl-gantt-group-head {
  display: flex;
  align-items: stretch;
  height: 30px;
  background: var(--dsw-alias-bg-module-platform);
  border-bottom: 0.5px solid var(--dsw-alias-border-l1);
}
.ttl-gantt-group-toggle {
  display: flex;
  align-items: stretch;
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.ttl-gantt-group-toggle:hover { background: var(--dsw-alias-interactive-bg-hover); }
.ttl-gantt-group-toggle:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: -2px;
}
.ttl-gantt-group-name {
  position: sticky;
  left: 0;
  z-index: 3;
  flex: none;
  width: var(--ttl-gantt-label-width);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  font-weight: 500;
  overflow: hidden;
}
.ttl-gantt-group-toggle:hover .ttl-gantt-group-name { background: var(--dsw-alias-interactive-bg-hover); }
.ttl-gantt-group-project {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ttl-gantt-group-count {
  flex: none;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  font-weight: 400;
}
.ttl-gantt-group-summary {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 16px 0 10px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
}
.ttl-gantt-group-sep { color: var(--dsw-alias-label-tertiary); }
.ttl-gantt-group-duration {
  position: sticky;
  right: 0;
  z-index: 3;
  flex: none;
  width: var(--ttl-gantt-duration-width);
  box-sizing: border-box;
  background: var(--dsw-alias-bg-module-platform);
  border-left: 0.5px solid var(--dsw-alias-border-l1);
}
.ttl-gantt-group-toggle:hover .ttl-gantt-group-duration { background: var(--dsw-alias-interactive-bg-hover); }
.ttl-gantt-row {
  display: flex;
  align-items: stretch;
  height: 30px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l1);
  cursor: pointer;
}
.ttl-gantt-row:hover { background: var(--dsw-alias-interactive-bg-hover); }
.ttl-gantt-row-label {
  position: sticky;
  left: 0;
  z-index: 3;
  flex: none;
  width: var(--ttl-gantt-label-width);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 100%;
  padding: 0 8px;
  border: 0;
  background: var(--dsw-alias-bg-base);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
}
.ttl-gantt-row:hover .ttl-gantt-row-label { background: var(--dsw-alias-interactive-bg-hover); }
.ttl-gantt-row-label:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: -2px;
}
.ttl-gantt-caret {
  position: relative;
  flex: none;
  width: 12px;
  height: 12px;
  color: var(--dsw-alias-label-tertiary);
}
.ttl-gantt-caret::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 3px;
  width: 4px;
  height: 4px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(-45deg);
  transition: transform var(--ttl-dur-fast) var(--ttl-ease-out);
}
.ttl-gantt-caret[data-expanded='true']::before { transform: rotate(45deg); }
.ttl-gantt-row-label .ttl-gantt-caret { margin-left: auto; opacity: 0.75; }
.ttl-gantt-dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--dsw-alias-state-warn-primary);
}
.ttl-gantt-dot[data-status='completed'] { background: var(--dsw-alias-state-success-primary); }
.ttl-gantt-title {
  flex: 1;
  min-width: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ttl-gantt-track {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
}
.ttl-gantt-grid {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--dsw-alias-border-l1);
}
/* 条形按百分比定位；min-width 保证极短任务仍可点/可看，溢出部分被用时列盖住。 */
.ttl-gantt-bar {
  position: absolute;
  top: 7px;
  height: 16px;
  min-width: 4px;
  border-radius: 8px;
  /* 时间条从左向右「画」出来，呼应创建 → 完成的时间方向。 */
  animation: ttl-bar-draw 420ms var(--ttl-ease-out) both;
}
.ttl-gantt-bar-completed { background: var(--dsw-alias-state-success-secondary); }
.ttl-gantt-bar-ongoing {
  background: var(--dsw-alias-state-business-primary);
  border-right: 2px dashed var(--dsw-alias-label-primary-foreground);
  box-sizing: border-box;
}
.ttl-gantt-duration-cell {
  position: sticky;
  right: 0;
  z-index: 4;
  flex: none;
  width: var(--ttl-gantt-duration-width);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  padding: 0 10px;
  border-left: 0.5px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.ttl-gantt-row:hover .ttl-gantt-duration-cell { background: var(--dsw-alias-interactive-bg-hover); }
.ttl-gantt-duration-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ttl-gantt-duration-ongoing { color: var(--dsw-alias-state-business-primary); }
.ttl-gantt-duration-dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dsw-alias-state-business-primary);
}
.ttl-gantt-row-detail {
  padding: 8px 10px 8px calc(var(--ttl-gantt-label-width) + 10px);
  border-bottom: 0.5px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-module-platform);
}
.ttl-gantt-row-detail-inner { max-width: 890px; }
.ttl-gantt-row-edit {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}
.ttl-gantt-row-edit .ttl-input { min-width: 140px; }
.ttl-gantt-row-detail-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 2px;
  margin-top: 4px;
}
.ttl-gantt-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 14px;
  padding: 7px 10px;
  border-top: 0.5px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 16px;
}
.ttl-gantt-legend { display: inline-flex; align-items: center; gap: 5px; }
.ttl-gantt-legend-swatch {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--dsw-alias-state-success-secondary);
}
.ttl-gantt-legend-swatch[data-kind='ongoing'] { background: var(--dsw-alias-state-business-primary); }
.ttl-gantt-legend-swatch[data-kind='now'] {
  width: 2px;
  height: 12px;
  border-radius: 1px;
  background: var(--dsw-alias-state-error-primary);
}
.ttl-gantt-footer-summary { margin-left: auto; }
@media (max-width: 720px) {
  .ttl-gantt {
    --ttl-gantt-label-width: 168px;
    --ttl-gantt-duration-width: 84px;
  }
}
@media (max-width: 560px) {
  .ttl-gantt {
    --ttl-gantt-label-width: 148px;
    --ttl-gantt-duration-width: 76px;
  }
}
/* 设置卡：页头「设置」入口展开的一张卡（与「对话录入」卡片同一种形态）。 */
.ttl-settings {
  margin-bottom: 16px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-layer-1);
  overflow: hidden;
  animation: ttl-fade-in 160ms var(--ttl-ease-out);
}
.ttl-settings-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
}
.ttl-settings-title { color: var(--dsw-alias-label-primary); font-weight: 500; }
.ttl-settings-hint { margin-left: auto; color: var(--dsw-alias-label-tertiary); font-size: 12px; }
.ttl-settings-body { padding: 0 12px 10px; }
.ttl-pref-row { display: flex; align-items: center; gap: 24px; padding: 2px 0 4px; }
.ttl-pref-text {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ttl-pref-title {
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}
.ttl-pref-desc {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}
.ttl-pref-error {
  color: var(--dsw-alias-state-error-primary);
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
}
.ttl-pref-switch {
  position: relative;
  flex: none;
  width: 36px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: var(--dsw-alias-border-l4);
  cursor: pointer;
  transition: background-color 150ms var(--ttl-ease-out);
}
.ttl-pref-switch[data-checked='true'] { background: var(--dsw-alias-state-business-primary); }
.ttl-pref-switch:disabled { opacity: 0.5; cursor: default; }
.ttl-pref-switch:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 2px;
}
.ttl-pref-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--dsw-alias-bg-base);
  box-shadow: var(--dsw-shadow-lv1);
  transform: translateX(0);
  transition: transform 150ms var(--ttl-ease-out);
}
.ttl-pref-switch[data-checked='true'] .ttl-pref-knob { transform: translateX(16px); }

.ttl-chat {
  margin-bottom: 16px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-layer-1);
  overflow: hidden;
  animation: ttl-fade-in 160ms var(--ttl-ease-out);
}

.ttl-chat-headrow {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 12px;
}
.ttl-chat-headrow .ttl-chat-head { flex: 1; min-width: 0; }
.ttl-chat-workspace { display: inline-flex; flex: none; align-items: center; gap: 4px; }
.ttl-chat-workspace-label { color: var(--dsw-alias-label-tertiary); font-size: 11px; white-space: nowrap; }
.ttl-chat-workspace-select {
  max-width: 180px;
  height: 24px;
  padding: 0 4px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: 6px;
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.ttl-chat-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 0;
  background: none;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.ttl-chat-head:hover { background: var(--dsw-alias-interactive-bg-hover); }
.ttl-chat-head:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 2px;
}
.ttl-chat-head-title { color: var(--dsw-alias-label-primary); font-weight: 500; }
.ttl-chat-head-hint { margin-left: auto; color: var(--dsw-alias-label-tertiary); font-size: 12px; }
.ttl-chat-chevron { transition: transform 0.15s; }
.ttl-chat-chevron-open { transform: rotate(90deg); }
.ttl-chat-body { padding: 0 12px 12px; }
.ttl-chat-log {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 260px;
  overflow-y: auto;
  padding: 4px 0 8px;
}
.ttl-chat-line { display: flex; }
.ttl-chat-line-user { justify-content: flex-end; }
.ttl-chat-line-assistant { justify-content: flex-start; }
.ttl-chat-bubble {
  max-width: 86%;
  padding: 6px 10px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 20px;
  overflow-wrap: anywhere;
}
.ttl-chat-bubble-user {
  background: var(--dsw-alias-button-primary-fill);
  color: var(--dsw-alias-label-primary-foreground);
}
.ttl-chat-bubble-assistant {
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-secondary);
}
.ttl-chat-text { white-space: pre-wrap; }
.ttl-chat-undo {
  margin-top: 4px;
  height: 24px;
  padding: 0 8px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: 8px;
  background: none;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.ttl-chat-undo:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.ttl-chat-compose { position: relative; display: flex; align-items: flex-end; gap: 8px; }
.ttl-chat-input {
  flex: 1;
  min-width: 0;
  height: auto;
  min-height: 36px;
  padding: 8px 10px;
  resize: vertical;
  font-size: 13px;
  line-height: 20px;
}
.ttl-chat-send { height: 36px; }.ttl-table-wrap {
  overflow-x: auto;
}
.ttl-table {
  width: 100%;
  /* 固定列宽：列宽只由 col 决定，不随标题长短跳动（否则长标题会挤扁状态列，徽标被迫换行）。 */
  table-layout: fixed;
  min-width: 860px;
  border-collapse: collapse;
  font-size: 13px;
}
/* 列宽口径：标题吃掉剩余宽度，其余列固定，保证「状态」列永远放得下一行徽标。 */
.ttl-col-check { width: 40px; }
.ttl-col-project { width: 104px; }
.ttl-col-status { width: 160px; }
.ttl-col-createdAt { width: 126px; }
.ttl-col-completedAt { width: 126px; }
.ttl-col-actions { width: 118px; }
.ttl-th {
  height: 34px;
  padding: 0 12px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  letter-spacing: 0.02em;
  text-align: left;
  white-space: nowrap;
}
.ttl-th-check { width: 40px; padding: 0 4px 0 12px; }
.ttl-th-right { text-align: right; }
.ttl-th-sortable { padding: 0; }
.ttl-th-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  height: 34px;
  padding: 0 12px;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-size: 11px;
  letter-spacing: 0.02em;
  line-height: 16px;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}
.ttl-th-right .ttl-th-button { justify-content: flex-end; }
.ttl-th-button:hover { color: var(--dsw-alias-label-primary); }
.ttl-th-button-active { color: var(--dsw-alias-label-primary); }
.ttl-th-arrow { color: var(--dsw-alias-label-tertiary); font-size: 9px; line-height: 1; }
.ttl-table-row {
  border-bottom: 0.5px solid var(--dsw-alias-border-l1);
  transition: background 0.12s ease-out;
  /* 新行 / 切视图时淡入；animation-delay 由行索引注入，形成轻错位。 */
  animation: ttl-fade-in var(--ttl-dur-base) var(--ttl-ease-out) both;
}
.ttl-table-row:hover { background: var(--dsw-alias-interactive-bg-hover); }
.ttl-table tbody tr:last-child { border-bottom: 0; }
.ttl-table-group-row .ttl-td {
  padding: 10px 12px 4px;
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  font-weight: 500;
}
.ttl-td {
  padding: 11px 12px;
  color: var(--dsw-alias-label-primary);
  vertical-align: middle;
  line-height: 20px;
}
.ttl-td-check { width: 40px; padding: 11px 4px 11px 12px; }
.ttl-td-title { max-width: none; }
.ttl-td-time {
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 20px;
  white-space: nowrap;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.ttl-td-actions { text-align: right; white-space: nowrap; }
/* 操作区默认压低，行 hover / 键盘聚焦时再提亮，避免整张表被按钮占满注意力。 */
.ttl-td-actions .ttl-link { color: var(--dsw-alias-label-tertiary); }
.ttl-td-actions .ttl-link:hover { color: var(--dsw-alias-label-primary); }
.ttl-table-row:hover .ttl-td-actions .ttl-link,
.ttl-table-row:focus-within .ttl-td-actions .ttl-link { color: var(--dsw-alias-label-secondary); }
.ttl-td-actions .ttl-link.ttl-link-danger { color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 72%, transparent); }
.ttl-table-row:hover .ttl-td-actions .ttl-link.ttl-link-danger,
.ttl-td-actions .ttl-link.ttl-link-danger:hover { color: var(--dsw-alias-state-error-primary); }
.ttl-table-title-button {
  display: -webkit-box;
  width: 100%;
  max-width: 100%;
  padding: 0;
  border: 0;
  background: none;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  text-align: left;
  overflow: hidden;
  overflow-wrap: anywhere;
  /* 最多两行：长标题截断为省略号，完整文案在 title 与「详情」里可见，行高保持稳定。 */
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  cursor: pointer;
}
.ttl-table-title-button:hover { color: var(--dsw-alias-state-business-primary); }
.ttl-table-row[data-status='completed'] .ttl-table-title-button { color: var(--dsw-alias-label-secondary); }
.ttl-table-detail-row .ttl-td { padding: 0 12px 10px; }

.ttl-board {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding-bottom: 4px;
  overflow-x: auto;
  scroll-snap-type: x proximity;
}
.ttl-board:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: -2px; border-radius: var(--dsw-radius-md); }
.ttl-board-column {
  display: flex;
  flex: 0 0 clamp(240px, 30vw, 360px);
  flex-direction: column;
  min-width: 0;
  max-width: 360px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-bg-module-platform);
  scroll-snap-align: start;
}
.ttl-board-column-head {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  padding-left: 10px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 12px 12px 0 0;
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}
.ttl-board-column-title { display: flex; flex: 1 1 auto; align-items: center; gap: 6px; min-width: 0; margin: 0; color: inherit; font: inherit; }
.ttl-board-column-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ttl-board-dot { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-label-tertiary); }
.ttl-board-dot[data-status='pending'] { background: var(--dsw-alias-label-secondary); }
.ttl-board-dot[data-status='completed'] { background: var(--dsw-alias-state-success-primary); }
.ttl-board-dot[data-status='project'] { width: 5px; height: 5px; }
.ttl-board-column-count { flex: none; color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums; }
.ttl-board-add {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}
.ttl-board-add:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.ttl-board-add:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; }
.ttl-board-column-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 56vh;
  padding: 8px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.ttl-board-column-body:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: -2px; border-radius: 0 0 12px 12px; }
.ttl-board-list { display: flex; flex-direction: column; gap: 8px; }
.ttl-board-lanes { display: flex; flex-direction: column; gap: 12px; }
.ttl-board-lane { display: flex; flex-direction: column; gap: 6px; }
.ttl-board-lane-head { display: flex; align-items: center; gap: 4px; padding: 0 2px 4px; border-bottom: 0.5px solid var(--dsw-alias-border-l1); }
.ttl-board-lane-toggle { display: inline-flex; flex: 1 1 auto; align-items: center; gap: 6px; min-width: 0; height: 24px; padding: 0 2px; border: 0; border-radius: 6px; background: none; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; line-height: 1; text-align: left; cursor: pointer; }
.ttl-board-lane-toggle:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.ttl-board-lane-toggle:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; }
.ttl-board-lane-caret { flex: none; color: var(--dsw-alias-label-tertiary); font-size: 10px; }
.ttl-board-lane-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ttl-board-lane-count { flex: none; color: var(--dsw-alias-label-tertiary); font-size: 11px; font-variant-numeric: tabular-nums; }
.ttl-board-move { display: inline-flex; align-items: center; gap: 4px; }
.ttl-board-action-label { color: var(--dsw-alias-label-tertiary); font-size: 11px; white-space: nowrap; }
.ttl-board-move-select { height: 24px; max-width: 150px; padding: 0 4px; border: 0.5px solid var(--dsw-alias-border-l3); border-radius: 6px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; cursor: pointer; }
.ttl-board-move-select:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; }
.ttl-board-compact .ttl-board-card { gap: 2px; padding: 6px 28px 6px 32px; }
.ttl-board-compact .ttl-board-check { top: 6px; left: 6px; width: 18px; height: 18px; }
.ttl-board-compact .ttl-board-more { top: 4px; right: 2px; }
.ttl-board-compact .ttl-board-card-title { -webkit-line-clamp: 1; }
.ttl-board-compact .ttl-board-card-files { display: none; }
.ttl-board-compact .ttl-board-project-name { display: none; }
.ttl-board-compact .ttl-board-column-body,
.ttl-board-compact .ttl-board-list { gap: 6px; }
.ttl-board-compact .ttl-board-lanes { gap: 8px; }
.ttl-board-column-empty { margin: 0; padding: 12px 4px; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; text-align: center; }
.ttl-board-showmore { align-self: stretch; flex: none; height: 26px; border: 0; border-radius: 6px; background: none; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; cursor: pointer; }
.ttl-board-showmore:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.ttl-board-showmore:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; }
.ttl-board-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 9px 32px 9px 36px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-bg-base);
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.16s var(--ttl-ease-out);
  animation: ttl-rise-in 200ms var(--ttl-ease-out) backwards;
}
.ttl-board-card:hover {
  border-color: var(--dsw-alias-border-l3);
  box-shadow: var(--dsw-shadow-lv1);
  transform: translateY(-1px);
}
.ttl-board-card-editing { padding: 9px 10px; }
.ttl-board-card-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.ttl-board-card-title {
  display: -webkit-box;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  overflow-wrap: anywhere;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.ttl-board-card[data-status='completed'] .ttl-board-card-title { color: var(--dsw-alias-label-secondary); }
.ttl-board-card-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 10px;
  min-width: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}
.ttl-board-project { display: inline-flex; align-items: center; gap: 4px; min-width: 0; max-width: 100%; }
.ttl-board-project-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* 勾选圈：表格行首与看板卡片共用（看板只额外负责定位）。 */
.ttl-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1.5px solid var(--dsw-alias-border-l4);
  border-radius: 50%;
  background: none;
  color: transparent;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}
.ttl-check:hover { border-color: var(--dsw-alias-state-success-primary); }
.ttl-check[data-checked='true'] {
  border-color: var(--dsw-alias-state-success-primary);
  background: var(--dsw-alias-state-success-primary);
  color: var(--dsw-alias-label-primary-foreground);
}
.ttl-check:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 2px; }
.ttl-check:disabled { opacity: 0.5; cursor: not-allowed; }
/* 勾选：对勾从 0.55 弹到 1；只在状态切换时过渡，首屏不会逐个弹。 */
.ttl-check svg {
  transform: scale(0.55);
  transform-origin: 50% 50%;
  transition: transform 200ms var(--ttl-ease-spring);
}
.ttl-check[data-checked='true'] svg { transform: scale(1); }
.ttl-board-check { position: absolute; top: 8px; left: 8px; }
.ttl-board-more {
  position: absolute;
  top: 6px;
  right: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.ttl-board-more:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.ttl-board-more:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; }
.ttl-board-card-actions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
.ttl-board-action { height: 24px; padding: 0 8px; border: 0; border-radius: 6px; background: none; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; line-height: 1; cursor: pointer; }
.ttl-board-action:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.ttl-board-action:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; }
.ttl-board-action-danger { color: var(--dsw-alias-state-error-primary); }
.ttl-board-confirm { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-top: 2px; padding-top: 6px; border-top: 0.5px solid var(--dsw-alias-border-l1); }
.ttl-board-confirm-text { flex: 1 1 100%; margin: 0; color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 16px; }
.ttl-board-confirm-delete { height: 24px; padding: 0 8px; border: 0; border-radius: 6px; background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent); color: var(--dsw-alias-state-error-primary); font: inherit; font-size: 12px; cursor: pointer; }
.ttl-board-confirm-cancel { height: 24px; padding: 0 8px; border: 0; border-radius: 6px; background: none; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; cursor: pointer; }
.ttl-board-confirm-delete:focus-visible, .ttl-board-confirm-cancel:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; }
.ttl-board-edit { display: flex; flex-direction: column; gap: 6px; }
.ttl-board-edit .ttl-input { width: 100%; min-width: 0; }
.ttl-search { position: relative; display: inline-flex; align-items: center; gap: 6px; }
.ttl-search input {
  width: 180px;
  max-width: 100%;
  height: 28px;
  padding: 0 8px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
}
.ttl-search input::placeholder { color: var(--dsw-alias-label-caption); }
.ttl-search input:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; }
.ttl-search-count { color: var(--dsw-alias-label-tertiary); font-size: 11px; white-space: nowrap; font-variant-numeric: tabular-nums; }
.ttl-calendar {
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  overflow: hidden;
}
.ttl-calendar-head {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
}
.ttl-calendar-title {
  margin: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
}
.ttl-calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-module-platform);
}
.ttl-calendar-weekday {
  padding: 6px 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 16px;
  text-align: center;
}
.ttl-calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
.ttl-calendar-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 84px;
  padding: 4px 6px;
  border: 0;
  border-right: 0.5px solid var(--dsw-alias-border-l1);
  border-bottom: 0.5px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  text-align: left;
  overflow: hidden;
  cursor: pointer;
}
.ttl-calendar-cell:nth-child(7n) { border-right: 0; }
.ttl-calendar-cell:hover { background: var(--dsw-alias-interactive-bg-hover); }
.ttl-calendar-cell-outside { background: var(--dsw-alias-bg-module-platform); }
.ttl-calendar-cell-outside .ttl-calendar-daynum { color: var(--dsw-alias-label-tertiary); }
.ttl-calendar-cell-today .ttl-calendar-daynum {
  color: var(--dsw-alias-state-business-primary);
  font-weight: 600;
}
.ttl-calendar-cell-selected {
  background: var(--dsw-alias-interactive-bg-hover);
  box-shadow: inset 0 0 0 1px var(--dsw-alias-state-business-primary);
}
.ttl-calendar-daynum {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}
.ttl-calendar-items { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.ttl-calendar-item {
  display: block;
  padding: 0 4px;
  border-radius: 4px;
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ttl-calendar-item-completed {
  color: var(--dsw-alias-label-tertiary);
  text-decoration: line-through;
}
.ttl-calendar-more {
  padding: 0 4px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 10px;
  line-height: 14px;
}
.ttl-calendar-month-empty {
  margin: 0;
  padding: 10px 12px;
  border-top: 0.5px solid var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
}
.ttl-calendar-panel { padding: 10px 12px; border-top: 0.5px solid var(--dsw-alias-border-l2); }
.ttl-calendar-panel-title {
  margin: 0 0 8px;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}
.ttl-calendar-day-empty { margin: 0; color: var(--dsw-alias-label-tertiary); font-size: 12px; }
.ttl-calendar-day-list { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
.ttl-calendar-entry {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  padding: 6px 8px;
  border-radius: 8px;
  background: var(--dsw-alias-bg-module-platform);
  animation: ttl-fade-in var(--ttl-dur-base) var(--ttl-ease-out) both;
}
.ttl-calendar-entry-main {
  display: flex;
  flex: 1 1 240px;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.ttl-calendar-entry-title {
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 20px;
  overflow-wrap: anywhere;
}
.ttl-calendar-entry-badges { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.ttl-calendar-entry-meta {
  display: flex;
  flex: 1 1 100%;
  flex-wrap: wrap;
  order: 3;
  gap: 2px 12px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}
.ttl-calendar-entry-actions { display: flex; flex: none; flex-wrap: wrap; justify-content: flex-end; gap: 2px; margin-left: auto; }
.ttl-calendar-entry-edit { display: flex; flex: 1 1 100%; flex-wrap: wrap; align-items: center; gap: 6px; }
.ttl-calendar-entry-edit .ttl-input { min-width: 140px; }
.ttl-calendar-nav-button { height: 28px; padding: 0 10px; font-size: 12px; }
.ttl-chat-files { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.ttl-file-suggest {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% + 6px);
  z-index: 6;
  max-height: 236px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: var(--dsw-alias-bg-base);
  box-shadow: 0 4px 16px var(--dsw-alias-bg-mask-1);
  overflow-y: auto;
}
.ttl-file-suggest-hint {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 4px 10px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-tertiary);
  font-size: 10px;
  line-height: 16px;
}
.ttl-file-suggest-status {
  padding: 8px 10px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}
.ttl-file-suggest-status-error { color: var(--dsw-alias-state-error-primary); }
.ttl-file-suggest-item { display: flex; flex-direction: column; gap: 1px; padding: 5px 10px; cursor: pointer; }
.ttl-file-suggest-item:hover,
.ttl-file-suggest-item-active { background: var(--dsw-alias-interactive-bg-hover); }
.ttl-file-suggest-name { color: var(--dsw-alias-label-primary); font-size: 12px; line-height: 18px; }
.ttl-file-suggest-path {
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 16px;
  overflow-wrap: anywhere;
}
.ttl-file-chips { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px; max-width: 100%; }
.ttl-file-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  max-width: 180px;
  height: 20px;
  padding: 0 6px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: 6px;
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11px;
  line-height: 18px;
  cursor: pointer;
}
.ttl-file-chip:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.ttl-file-chip-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ttl-file-chip-icon { font-size: 10px; line-height: 1; }
.ttl-file-more { color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 20px; }
.ttl-title-cell { display: flex; flex-direction: column; align-items: stretch; gap: 3px; min-width: 0; }
.ttl-board-card-files { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
.ttl-calendar-entry-files { display: flex; flex: 1 1 100%; flex-wrap: wrap; gap: 4px; }
.ttl-detail-files { display: flex; flex-wrap: wrap; gap: 4px; }

/* 导入 / 导出：轻量浮层对话框，内容超高时只滚动对话框主体。 */
.ttl-download-anchor {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
.ttl-overlay {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--dsw-alias-bg-mask-1);
  animation: ttl-fade-in 140ms ease-out;
}
.ttl-dialog {
  display: flex;
  flex-direction: column;
  width: min(560px, 100%);
  max-height: 100%;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-lg);
  background: var(--dsw-alias-bg-base);
  box-shadow: var(--dsw-shadow-lv3);
  overflow: hidden;
  animation: ttl-dialog-in 200ms var(--ttl-ease-out) both;
}
.ttl-dialog-head {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l1);
}
.ttl-dialog-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
  color: var(--dsw-alias-label-primary);
}
.ttl-dialog-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: var(--dsw-radius-sm);
  background: none;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
.ttl-dialog-close:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.ttl-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 16px;
  overflow-y: auto;
}
.ttl-dialog-footer {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 0.5px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
}
.ttl-transfer-section { display: flex; flex-direction: column; gap: 8px; }
.ttl-transfer-heading {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  color: var(--dsw-alias-label-primary);
}
.ttl-transfer-hint { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
.ttl-dialog-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.ttl-dialog-actions-end { justify-content: flex-end; padding-top: 4px; }
.ttl-transfer-file {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
}
.ttl-file-input { display: none; }
.ttl-transfer-error {
  margin: 0;
  padding: 8px 10px;
  border-radius: var(--dsw-radius-sm);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent);
  color: var(--dsw-alias-state-error-primary);
  font-size: 12px;
  line-height: 18px;
}
.ttl-transfer-preview {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-layer-1);
}
.ttl-transfer-preview-title { font-size: 12px; font-weight: 600; line-height: 18px; color: var(--dsw-alias-label-primary); }
.ttl-transfer-counts { display: flex; flex-wrap: wrap; gap: 6px; }
.ttl-transfer-count {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}
.ttl-transfer-rows { margin: 0; font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-tertiary); }
.ttl-transfer-invalid {
  margin: 0;
  padding-left: 16px;
  color: var(--dsw-alias-state-error-primary);
  font-size: 11px;
  line-height: 17px;
}
.ttl-transfer-mode { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.ttl-transfer-mode select {
  height: 28px;
  padding: 0 6px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.ttl-transfer-mode-hint { margin: 0; font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-tertiary); }
.ttl-transfer-empty { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
.ttl-overlay .ttl-button { height: 28px; font-size: 12px; }
@media (max-width: 560px) {
  .ttl-overlay { align-items: flex-start; padding: 12px; }
}
/* ===== 动效关键帧：短、克制，只服务状态变化 ===== */
@keyframes ttl-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes ttl-rise-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}
@keyframes ttl-fade-down {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: none; }
}
@keyframes ttl-dialog-in {
  from { opacity: 0; transform: translateY(10px) scale(0.985); }
  to { opacity: 1; transform: none; }
}
@keyframes ttl-count-pop {
  from { opacity: 0.4; transform: translateY(-2px) scale(0.92); }
  to { opacity: 1; transform: none; }
}
@keyframes ttl-bar-draw {
  from { clip-path: inset(0 100% 0 0); }
  to { clip-path: inset(0 0 0 0); }
}

@media (prefers-reduced-motion: reduce) {
  .ttl-root *,
  .ttl-root *::before,
  .ttl-root *::after {
    animation: none !important;
    transition: none !important;
  }
}
@media (max-width: 720px) {
  .ttl-detail-list { grid-template-columns: auto minmax(0, 1fr); }
}
@media (max-width: 560px) {
  .ttl-page { padding: 0 16px 32px; }
  .ttl-toolbar { align-items: flex-start; }
  .ttl-row-inner { flex-direction: column; }
  .ttl-row-actions { width: 100%; justify-content: flex-start; }
  .ttl-project-input { flex: 1 1 100%; }
  .ttl-project-picker { flex: 1 1 100%; }
  .ttl-chat-bubble { max-width: 100%; }
  .ttl-calendar-cell { min-height: 64px; padding: 2px 4px; }
  /* 窄面板：看板单列堆叠，避免「横向 + 纵向」双轴滚动。 */
  .ttl-board { flex-direction: column; align-items: stretch; overflow-x: visible; scroll-snap-type: none; }
  .ttl-board-column { flex: none; width: 100%; max-width: none; }
  .ttl-board-column-body { max-height: none; overflow: visible; }
  .ttl-search { width: 100%; }
  .ttl-search input { width: 100%; }
}
`;

/** 组件内 <style> 元素：卸载时由 React 自动移除。 */
export function StyleSheet() {
  return h('style', { 'data-dsh-todo-time-log': 'styles' }, CSS_TEXT);
}

/**
 * 快速入口（主输入框下方胶囊 + 上方清单）的 CSS。
 *
 * 单独一份而不是塞进 CSS_TEXT：面板未挂载时（用户正在聊天）也要完整可用；
 * 类名一律 `ttl-quick-*`，不依赖面板的 `.ttl-check` / badge 样式，避免两套样式互相影响。
 * 圆角同心：卡片 12 = 行 8 + 内边距 4；只用主题 token，明暗主题都成立。
 */
export const QUICK_CSS_TEXT = `.ttl-quick-trigger {
  --ttl-ease-out: cubic-bezier(0.22, 0.61, 0.36, 1);
  --ttl-ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1);
  --ttl-dur-fast: 120ms;
  --ttl-dur-base: 180ms;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 8px;
  border: 0;
  border-radius: 999px;
  background: none;
  color: var(--dsw-alias-label-tertiary);
  font-family: var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif);
  font-size: 13px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color var(--ttl-dur-fast) var(--ttl-ease-out),
    color var(--ttl-dur-fast) var(--ttl-ease-out), transform var(--ttl-dur-fast) var(--ttl-ease-out);
}
.ttl-quick-trigger:hover,
.ttl-quick-trigger[data-open='true'] {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-secondary);
}
.ttl-quick-trigger:active { transform: scale(0.98); }
.ttl-quick-trigger:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 2px;
}
.ttl-quick-icon { flex: none; }
.ttl-quick-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  box-sizing: border-box;
  border-radius: 999px;
  background: var(--dsw-alias-state-business-primary);
  color: var(--dsw-alias-label-primary-foreground);
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
}

.ttl-quick-panel {
  --ttl-ease-out: cubic-bezier(0.22, 0.61, 0.36, 1);
  --ttl-ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1);
  --ttl-dur-fast: 120ms;
  --ttl-dur-base: 180ms;
  position: absolute;
  left: 0;
  bottom: calc(100% + 8px);
  z-index: 120;
  display: flex;
  flex-direction: column;
  width: min(420px, 100%);
  max-width: calc(100vw - 32px);
  max-height: min(60vh, 460px);
  box-sizing: border-box;
  overflow: hidden;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-lg);
  background: var(--dsw-specific-menu);
  /* 菜单底色是半透明的（--dsw-menu-surface-fill 带 alpha），必须像宿主菜单 / 会话待办面板
     一样加同一层模糊，否则清单背后的聊天文字会透出来。 */
  backdrop-filter: var(--dsw-menu-backdrop-filter);
  color: var(--dsw-alias-label-primary);
  font-family: var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif);
  font-size: 13px;
  line-height: 1.5;
  box-shadow: var(--dsw-elevation-prominent);
  animation: ttl-quick-in 160ms var(--ttl-ease-out);
}
.ttl-quick-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
  padding: 8px 6px 4px 12px;
}
.ttl-quick-head-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--dsw-alias-label-primary);
  font-weight: 600;
}
.ttl-quick-head-count {
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  font-weight: 400;
  white-space: nowrap;
}
.ttl-quick-close {
  flex: none;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  margin-left: auto;
  padding: 0;
  border: 0;
  border-radius: var(--dsw-radius-sm);
  background: none;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.ttl-quick-close:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.ttl-quick-close:focus-visible,
.ttl-quick-link:focus-visible,
.ttl-quick-retry:focus-visible,
.ttl-quick-check:focus-visible,
.ttl-quick-add-action:focus-visible,
.ttl-quick-notice-action:focus-visible,
.ttl-quick-notice-close:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 2px;
}
.ttl-quick-add {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
  padding: 4px 8px 8px 12px;
}
.ttl-quick-add-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 28px;
  box-sizing: border-box;
  padding: 0 8px;
  border: 0;
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  outline: none;
  transition: box-shadow var(--ttl-dur-fast) var(--ttl-ease-out);
}
.ttl-quick-add-input:focus {
  box-shadow: 0 0 0 1px var(--dsw-alias-state-business-primary);
}
.ttl-quick-add-input::placeholder { color: var(--dsw-alias-label-caption); }
.ttl-quick-add-action {
  flex: none;
  height: 28px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition: background-color var(--ttl-dur-fast) var(--ttl-ease-out),
    color var(--ttl-dur-fast) var(--ttl-ease-out);
}
.ttl-quick-add-action:hover:not(:disabled) {
  background: var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-primary);
}
.ttl-quick-add-action:disabled { opacity: 0.45; cursor: default; }
.ttl-quick-list {
  flex: 1 1 auto;
  min-height: 0;
  max-height: 240px;
  margin: 0;
  padding: 0 4px 4px;
  overflow-y: auto;
  list-style: none;
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
}

.ttl-quick-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--dsw-radius-md);
  transition: background-color var(--ttl-dur-fast) var(--ttl-ease-out);
  animation: ttl-quick-row-in var(--ttl-dur-base) var(--ttl-ease-out);
}
.ttl-quick-row:hover { background: var(--dsw-alias-interactive-bg-hover); }
.ttl-quick-check {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-top: 1px;
  padding: 0;
  border: 1.5px solid var(--dsw-alias-border-l4);
  border-radius: 50%;
  background: none;
  color: transparent;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}
.ttl-quick-check:hover:not(:disabled) {
  border-color: var(--dsw-alias-state-success-primary);
  color: var(--dsw-alias-state-success-primary);
}
.ttl-quick-check:disabled { opacity: 0.45; cursor: default; }
.ttl-quick-check svg { transform: scale(0.85); }
.ttl-quick-body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.ttl-quick-row-title {
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ttl-quick-row-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}
.ttl-quick-elapsed { flex: none; font-variant-numeric: tabular-nums; }
.ttl-quick-project {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
}
.ttl-quick-project-dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dsw-alias-label-tertiary);
}
.ttl-quick-project[data-tone='business'] .ttl-quick-project-dot { background: var(--dsw-alias-state-business-primary); }
.ttl-quick-project[data-tone='done'] .ttl-quick-project-dot { background: var(--dsw-alias-state-done-primary); }
.ttl-quick-project[data-tone='success'] .ttl-quick-project-dot { background: var(--dsw-alias-state-success-primary); }
.ttl-quick-project[data-tone='warn'] .ttl-quick-project-dot { background: var(--dsw-alias-state-warn-primary); }
.ttl-quick-project[data-tone='error'] .ttl-quick-project-dot { background: var(--dsw-alias-state-error-primary); }
.ttl-quick-project-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ttl-quick-skeleton {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px 12px 10px;
}
.ttl-quick-skeleton-row {
  height: 26px;
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-bg-skeleton);
  animation: ttl-quick-breathe 1.4s ease-in-out infinite;
}
.ttl-quick-state {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 4px 12px 12px;
}
.ttl-quick-state-title {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  font-weight: 500;
}
.ttl-quick-state-hint {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}
.ttl-quick-retry {
  margin-top: 4px;
  height: 24px;
  padding: 0 8px;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-sm);
  background: none;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.ttl-quick-retry:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.ttl-quick-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex: none;
  padding: 6px 12px 8px;
  border-top: 0.5px solid var(--dsw-alias-border-l1);
}
.ttl-quick-link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--dsw-alias-state-business-primary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.ttl-quick-link:hover { text-decoration: underline; }
.ttl-quick-hint {
  color: var(--dsw-alias-label-caption);
  font-size: 11px;
  white-space: nowrap;
}

.ttl-quick-notice {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 40px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 6px 6px 10px;
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-toast-bg);
  color: var(--dsw-alias-toast-label);
  font-size: 12px;
  line-height: 18px;
  box-shadow: var(--dsw-shadow-lv3);
  animation: ttl-quick-notice-in 160ms var(--ttl-ease-out);
}
.ttl-quick-notice-icon { flex: none; display: inline-flex; }
.ttl-quick-notice[data-kind='success'] .ttl-quick-notice-icon { color: var(--dsw-alias-state-success-secondary); }
.ttl-quick-notice[data-kind='error'] .ttl-quick-notice-icon { color: var(--dsw-alias-state-error-secondary); }
.ttl-quick-notice-text { min-width: 0; overflow-wrap: anywhere; }
.ttl-quick-notice-action,
.ttl-quick-notice-close {
  flex: none;
  height: 22px;
  padding: 0 7px;
  border: 0;
  border-radius: 6px;
  background: color-mix(in srgb, var(--dsw-alias-toast-label) 16%, transparent);
  color: var(--dsw-alias-toast-label);
  font: inherit;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
}
.ttl-quick-notice-action { margin-left: auto; }
.ttl-quick-notice-close {
  width: 22px;
  padding: 0;
  background: none;
  color: color-mix(in srgb, var(--dsw-alias-toast-label) 70%, transparent);
  font-size: 13px;
}
.ttl-quick-notice-action:hover { background: color-mix(in srgb, var(--dsw-alias-toast-label) 26%, transparent); }
.ttl-quick-notice-close:hover {
  background: color-mix(in srgb, var(--dsw-alias-toast-label) 16%, transparent);
  color: var(--dsw-alias-toast-label);
}

@keyframes ttl-quick-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}
@keyframes ttl-quick-row-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes ttl-quick-notice-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: none; }
}
@keyframes ttl-quick-breathe {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@media (prefers-reduced-motion: reduce) {
  .ttl-quick-trigger,
  .ttl-quick-trigger *,
  .ttl-quick-trigger *::before,
  .ttl-quick-trigger *::after,
  .ttl-quick-panel,
  .ttl-quick-panel *,
  .ttl-quick-panel *::before,
  .ttl-quick-panel *::after {
    animation: none !important;
    transition: none !important;
  }
}
`;

/** 快速入口的样式表：与面板的 StyleSheet 相互独立（互不依赖挂载顺序）。 */
export function QuickStyleSheet() {
  return h('style', { 'data-dsh-todo-time-log': 'quick-styles' }, QUICK_CSS_TEXT);
}
