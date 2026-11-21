/**
 * 回顾视图（十七期）：范围内「完成了多少 / 一共花了多久 / 估得准不准 / 什么最占时间」。
 *
 * 纯派生渲染：数据就是 `/list filter:'all'` 的活跃条目（已排除搁置项），
 * 「现在」由面板每分钟推进（nowMs），范围来自面板工具栏的 `insightsScope`。
 * 不查询 DOM、不注册监听、不发请求，也不做任何写操作。
 * 文案一律中性（「放了 N 天」），不使用红色 / 逾期语义。
 */
import {
  EMPTY_TIME,
  estimateDeviation,
  formatAge,
  formatSpanMs,
  insightsRangeStart,
  normalizeEstimate,
  normalizeProject,
  normalizeType,
  projectLabel,
  toMillis,
} from '../helpers.js';
import { t } from '../i18n.js';
import { h } from '../runtime.js';
import { ProjectBadge } from '../widgets.js';

/** 两个跨度排行面板各自最多显示的行数。 */
const MAX_BAR_ROWS = 6;
/** 「放得最久的」最多显示的条数。 */
const MAX_OLDEST_ROWS = 5;

/**
 * 一条已完成待办的真实跨度（完成 - 创建，毫秒）。
 * 时间缺失或完成早于创建（时钟回拨）时返回 null：宁可不算，也不伪造数字。
 *
 * @param {object} todo
 * @returns {number | null}
 */
function spanMsOf(todo) {
  const completedMs = toMillis(todo.completedAt);
  if (completedMs === null) return null;
  const createdMs = toMillis(todo.createdAt);
  if (createdMs === null || completedMs < createdMs) return null;
  return completedMs - createdMs;
}

/**
 * 按分组聚合跨度：条数 + 总跨度，按总跨度降序（并列时条数多的在前，再按名称稳定排序）。
 * 只保留前 MAX_BAR_ROWS 行；排序后首行即为最大值，柱条宽度以它为 100%。
 *
 * @param {{ todo: object, spanMs: number | null }[]} entries
 * @param {(todo: object) => string} keyOf
 * @param {(key: string) => string} labelOf
 * @returns {{ key: string, label: string, count: number, spanMs: number }[]}
 */
function aggregateSpans(entries, keyOf, labelOf) {
  const buckets = new Map();
  for (const entry of entries) {
    const key = keyOf(entry.todo);
    const spanMs = entry.spanMs === null ? 0 : entry.spanMs;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count += 1;
      bucket.spanMs += spanMs;
      continue;
    }
    buckets.set(key, { key, label: labelOf(key), count: 1, spanMs });
  }
  return [...buckets.values()]
    .sort(
      (left, right) =>
        right.spanMs - left.spanMs ||
        right.count - left.count ||
        (left.label < right.label ? -1 : left.label > right.label ? 1 : 0)
    )
    .slice(0, MAX_BAR_ROWS);
}

/** 按范围统计的回顾视图；返回 render 函数，由面板在每次渲染时调用。 */
export function createInsightsView(deps) {
  // 范围分段（`insightsScope` 的切换控件）由面板工具栏统一提供，与本项目
  // 「第二行 = 当前视图专属控件」的约定一致；本视图只读取范围值做派生。
  // `visibleTodos`（不是全量 `todos`）：与看板 / 甘特 / 日历同一口径，
  // 搜索与类型筛选在回顾视图同样生效，不出现「筛选静默失效」。
  const { includeArchivedCount, insightsScope, nowMs, visibleTodos: todos } = deps;

  /** 数字卡：标签 / 数值 / 说明三层。 */
  const renderCard = (key, label, value, hint) =>
    h(
      'div',
      { key, className: 'ttl-insights-card' },
      h('span', { className: 'ttl-insights-card-label' }, label),
      h('span', { className: 'ttl-insights-card-value' }, value),
      h('span', { className: 'ttl-insights-card-hint' }, hint)
    );

  const renderPanel = (titleKey, body) =>
    h(
      'section',
      { className: 'ttl-insights-panel' },
      h('h3', { className: 'ttl-insights-panel-title' }, t(titleKey)),
      body
    );

  /** 跨度排行：每行「名称 / 条数 · 总跨度 / 占比柱条」。 */
  const renderBars = (rows) => {
    if (rows.length === 0) return h('p', { className: 'ttl-insights-note' }, t('insights.barsEmpty'));
    const maxSpanMs = rows[0].spanMs > 0 ? rows[0].spanMs : 1;
    return h(
      'ul',
      { className: 'ttl-insights-bars' },
      rows.map((row) =>
        h(
          'li',
          { key: `bar:${row.key}`, className: 'ttl-insights-bar' },
          h('span', { className: 'ttl-insights-bar-label', title: row.label }, row.label),
          h(
            'span',
            { className: 'ttl-insights-bar-value' },
            t('insights.rowValue', { count: row.count, duration: formatSpanMs(row.spanMs) })
          ),
          h(
            'span',
            { className: 'ttl-insights-bar-track', 'aria-hidden': 'true' },
            h('span', {
              className: 'ttl-insights-bar-fill',
              style: { width: `${Math.round((row.spanMs / maxSpanMs) * 100)}%` },
            })
          )
        )
      )
    );
  };

  const renderOldest = (rows) => {
    if (rows.length === 0) return h('p', { className: 'ttl-insights-note' }, t('insights.oldestEmpty'));
    return h(
      'ul',
      { className: 'ttl-insights-list' },
      rows.map((todo) => {
        const title = todo.title === '' ? t('board.untitled') : todo.title;
        return h(
          'li',
          { key: todo.id, className: 'ttl-insights-row' },
          h('span', { className: 'ttl-insights-row-age' }, t('insights.ageValue', { age: formatAge(todo.createdAt, nowMs) })),
          h('span', { className: 'ttl-insights-row-title', title }, title),
          h(ProjectBadge, { project: normalizeProject(todo.project) })
        );
      })
    );
  };

  const renderInsightsView = () => {
    if (todos.length === 0) {
      return h(
        'section',
        { className: 'ttl-insights', role: 'region', 'aria-label': t('insights.aria') },
        h(
          'div',
          { className: 'ttl-insights-empty' },
          h('div', null, t('insights.empty')),
          h('div', null, t('insights.emptyHint'))
        ),
        // 活跃条目为空但还有搁置项时也要说一句：这正是用户最容易以为「数据没了」的时刻。
        includeArchivedCount > 0
          ? h('p', { className: 'ttl-insights-note' }, t('insights.archivedNote', { count: includeArchivedCount }))
          : null
      );
    }

    // ── 范围过滤：范围内已完成条目（按 completedAt 判定归属） ──────────────
    const fromMs = insightsRangeStart(insightsScope, nowMs);
    const completed = [];
    let totalSpanMs = 0;
    for (const todo of todos) {
      if (todo.status !== 'completed') continue;
      const completedMs = toMillis(todo.completedAt);
      if (completedMs === null) continue;
      if (fromMs !== null && completedMs < fromMs) continue;
      const spanMs = spanMsOf(todo);
      if (spanMs !== null) totalSpanMs += spanMs;
      completed.push({ todo, spanMs });
    }
    const completedCount = completed.length;

    // ── 预估对照：只统计「填了预计且跨度可信」的条目，取平均偏差百分比 ──────
    const percents = [];
    for (const entry of completed) {
      const estimate = normalizeEstimate(entry.todo.estimateMinutes);
      if (estimate === null || entry.spanMs === null) continue;
      const deviation = estimateDeviation(estimate, entry.spanMs);
      if (deviation !== null) percents.push(deviation.percent);
    }
    const avgPercent =
      percents.length === 0
        ? null
        : Math.round(percents.reduce((sum, value) => sum + value, 0) / percents.length);
    const percentText = avgPercent === null ? EMPTY_TIME : `${avgPercent > 0 ? '+' : ''}${avgPercent}%`;

    const projectRows = aggregateSpans(
      completed,
      (todo) => normalizeProject(todo.project),
      (key) => projectLabel(key)
    );
    const typeRows = aggregateSpans(
      completed,
      (todo) => normalizeType(todo.type),
      // 用模板字符串拼 key：静态审计把「t 后面紧跟单/双引号的残缺 key」判为未声明，
      // 因此这里绝不能写成前缀加号拼接。
      (key) => (key === '' ? t('type.none') : t(`type.${key}`))
    );

    // ── 放得最久的：范围内未完成条目按创建时间升序取前 N 条 ────────────────
    const oldest = todos
      .filter((todo) => todo.status !== 'completed')
      .map((todo) => ({ todo, createdMs: toMillis(todo.createdAt) }))
      .filter((entry) => entry.createdMs !== null && (fromMs === null || entry.createdMs >= fromMs))
      .sort((left, right) => left.createdMs - right.createdMs)
      .slice(0, MAX_OLDEST_ROWS)
      .map((entry) => entry.todo);

    return h(
      'section',
      { className: 'ttl-insights', role: 'region', 'aria-label': t('insights.aria') },
      h(
        'div',
        { className: 'ttl-insights-grid' },
        renderCard('completed', t('insights.completed'), String(completedCount), t('insights.completedHint')),
        renderCard('totalSpan', t('insights.totalSpan'), formatSpanMs(totalSpanMs), t('insights.spanHint')),
        renderCard(
          'avgSpan',
          t('insights.avgSpan'),
          completedCount === 0 ? EMPTY_TIME : formatSpanMs(totalSpanMs / completedCount),
          t('insights.spanHint')
        ),
        renderCard(
          'estimate',
          t('insights.estimateTitle'),
          percents.length === 0 ? EMPTY_TIME : t('insights.estimateAvg', { percent: percentText }),
          percents.length === 0 ? t('insights.estimateNone') : t('insights.estimateCount', { count: percents.length })
        )
      ),
      h(
        'div',
        { className: 'ttl-insights-columns' },
        renderPanel('insights.byProject', renderBars(projectRows)),
        renderPanel('insights.byType', renderBars(typeRows))
      ),
      renderPanel('insights.oldest', renderOldest(oldest)),
      includeArchivedCount > 0
        ? h('p', { className: 'ttl-insights-note' }, t('insights.archivedNote', { count: includeArchivedCount }))
        : null
    );
  };

  return renderInsightsView;
}
