/** 待办详情内容（dl 列表），供四个视图复用。 */
import { EMPTY_TIME, estimateDeviation, formatDuration, formatEstimate, formatTime, normalizeEstimate, normalizeFiles, normalizePriority, normalizeProject, normalizeType, projectLabel, toMillis } from './helpers.js';
import { t } from './i18n.js';
import { h } from './runtime.js';

export function createDetailContent(deps) {
  const { renderFileChips } = deps;

  const renderDetailContent = (todo) => {
    const completed = todo.status === 'completed';
    // 进行中的待办给出「已进行 X」，让详情与看板/表格的用时口径一致。
    let durationText = EMPTY_TIME;
    if (completed) {
      durationText = formatDuration(todo.createdAt, todo.completedAt);
    } else {
      const elapsed = formatDuration(todo.createdAt, Date.now());
      if (elapsed !== EMPTY_TIME) durationText = t('table.elapsed', { duration: elapsed });
    }
    // 预计用时始终显示（未填为 '-'，保持字段一致）；执行偏差只对「已完成且有预计且有跨度」出现。
    const estimate = normalizeEstimate(todo.estimateMinutes);
    const startMs = toMillis(todo.createdAt);
    const endMs = toMillis(todo.completedAt);
    const deviation =
      completed && estimate !== null && startMs !== null && endMs !== null
        ? estimateDeviation(estimate, endMs - startMs)
        : null;
    let deviationText = null;
    if (deviation !== null) {
      if (deviation.kind === 'even') {
        deviationText = t('detail.deviationEven');
      } else if (deviation.kind === 'over') {
        deviationText = t('estimate.over', { percent: Math.abs(deviation.percent) });
      } else if (deviation.kind === 'under') {
        deviationText = t('estimate.under', { percent: Math.abs(deviation.percent) });
      }
    }
    return h(
      'dl',
      { className: 'ttl-detail-list' },
      h('dt', { className: 'ttl-detail-label' }, t('detail.status')),
      h('dd', { className: 'ttl-detail-value' }, t(completed ? 'row.completed' : 'row.pending')),
      h('dt', { className: 'ttl-detail-label' }, t('priority.label')),
      h(
        'dd',
        { className: 'ttl-detail-value' },
        normalizePriority(todo.priority) === ''
          ? t('priority.none')
          : t(`priority.${normalizePriority(todo.priority)}`)
      ),
      h('dt', { className: 'ttl-detail-label' }, t('type.label')),
      h(
        'dd',
        { className: 'ttl-detail-value' },
        normalizeType(todo.type) === '' ? t('type.none') : t(`type.${normalizeType(todo.type)}`)
      ),
      h('dt', { className: 'ttl-detail-label' }, t('detail.project')),
      h('dd', { className: 'ttl-detail-value' }, projectLabel(normalizeProject(todo.project))),
      normalizeFiles(todo.files).length > 0
        ? h('dt', { key: 'detail-files-label', className: 'ttl-detail-label' }, t('detail.files'))
        : null,
      normalizeFiles(todo.files).length > 0
        ? h('dd', { key: 'detail-files-value', className: 'ttl-detail-value ttl-detail-files' }, renderFileChips(todo))
        : null,
      h('dt', { className: 'ttl-detail-label' }, t('detail.created')),
      h('dd', { className: 'ttl-detail-value' }, formatTime(todo.createdAt)),
      h('dt', { className: 'ttl-detail-label' }, t('detail.completed')),
      h('dd', { className: 'ttl-detail-value' }, completed ? formatTime(todo.completedAt) : EMPTY_TIME),
      h('dt', { className: 'ttl-detail-label' }, t('detail.updated')),
      h('dd', { className: 'ttl-detail-value' }, formatTime(todo.updatedAt)),
      h('dt', { className: 'ttl-detail-label' }, t('detail.duration')),
      h('dd', { className: 'ttl-detail-value' }, durationText),
      h('dt', { className: 'ttl-detail-label' }, t('detail.estimate')),
      h('dd', { className: 'ttl-detail-value' }, formatEstimate(todo.estimateMinutes)),
      deviationText === null ? null : h('dt', { className: 'ttl-detail-label' }, t('detail.deviation')),
      deviationText === null ? null : h('dd', { className: 'ttl-detail-value' }, deviationText),
      h('dt', { className: 'ttl-detail-label' }, t('detail.id')),
      h('dd', { className: 'ttl-detail-value' }, h('span', { className: 'ttl-detail-id' }, todo.id))
    );
  };

  return renderDetailContent;
}
