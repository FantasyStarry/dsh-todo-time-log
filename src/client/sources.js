/** 主输入框 @ 菜单的「待办分类」触发来源。 */
import { formatProjectTag, normalizeProjectSuggestions, request } from './helpers.js';
import { t } from './i18n.js';
import { PRIORITIES, TYPES } from './styles.js';



/** 读取 session 对应的工作区路径；拿不到返回 ''（不抛错）。 */
export function sessionWorkspaceOf(ctx, session) {
  try {
    if (session && typeof session === 'object' && typeof session.cwd === 'string' && session.cwd !== '') {
      return session.cwd;
    }
    if (!ctx || typeof ctx.get !== 'function') return '';
    const sessions = ctx.get('sessions');
    const list = sessions && sessions.list;
    if (!list || typeof list.getSnapshot !== 'function') return '';
    const snapshot = list.getSnapshot();
    const byId = snapshot && snapshot.byId;
    const sessionId = session && session.sessionId;
    if (byId === null || byId === undefined || sessionId === undefined) return '';
    const summary = byId[sessionId];
    return summary && typeof summary.cwd === 'string' ? summary.cwd : '';
  } catch (error) {
    return '';
  }
}

/**
 * 只读读取主输入框草稿文本（唯一 DOM 读取点）。
 * 平台不提供命令态信息，只能 best-effort 用当前 contenteditable 文本判断
 * 是否处于 `/todo` 草稿；任何异常都返回 ''（不影响菜单与其它来源）。
 */
export function readComposerDraftText() {
  try {
    if (typeof document === 'undefined') return '';
    const active = document.activeElement;
    if (!active) return '';
    const host = active.isContentEditable
      ? active
      : active.closest
        ? active.closest('[contenteditable="true"]')
        : null;
    if (!host) return '';
    return String(host.textContent === null || host.textContent === undefined ? '' : host.textContent);
  } catch (error) {
    return '';
  }
}

/** 草稿门控：草稿必须以 `/todo` 开头（后接空白或结束）；普通消息不显示该 @ 分组。 */
export const TODO_DRAFT_GATE = /^\s*\/todo(?:\s|$)/i;

/**
 * 注册到平台输入触发流水线的「待办分类」来源（trigger '@'）。
 * 候选来自 /projects（带当前 session 工作区），选中后由 onPick 返回
 * `#分类 `（含空白用 `[名称] `）文本，让 `/todo 写周报 @` → `#lib `。
 * 仅在 `/todo` 草稿里返回候选；普通消息的 @ 菜单不出现该分组。
 *
 * 这里是主输入框的 @ 菜单，只列「已用分类 / 工作区」两类；工作区里的
 * 文件夹（docs、lib、test…）对 `#分类` 是噪音，不在这份候选里出现
 * （面板自己的分类选择器仍然保留文件夹来源）。
 */
export function createTodoProjectSource(ctx) {
  return {
    trigger: '@',
    name: 'dsh-todo-time-log.projects',
    // First group in the `@` menu: the platform renders every registered
    // source (files/sessions included, which a plugin cannot remove), so at
    // least keep the todo-category group on top and Enter-selectable.
    order: -100,
    // Group titles are suppressed: every row already carries a `section`,
    // and while the first candidates are still loading the platform would
    // otherwise print the raw source id (which is not an i18n key).
    showGroupTitle: false,
    async candidates(session, requestInfo) {
      // 门控：非 /todo 草稿直接返回空候选，且不发起 /projects 请求。
      const draft = readComposerDraftText();
      if (!TODO_DRAFT_GATE.test(draft)) return [];
      const info = requestInfo && typeof requestInfo === 'object' ? requestInfo : {};
      const query = typeof info.query === 'string' ? info.query : '';
      const signal = info.signal;
      try {
        if (signal && signal.aborted === true) return [];
        const workspace = sessionWorkspaceOf(ctx, session);
        const body = {};
        if (workspace !== '') body.workspace = workspace;
        const value = await request('/projects', body);
        if (signal && signal.aborted === true) return [];
        const suggestions = normalizeProjectSuggestions(value && value.suggestions);
        const needle = query.toLowerCase();
        const rows = [];
        for (const item of suggestions) {
          // @ 菜单只保留「已用分类 / 工作区」，跳过工作区文件夹。
          if (item.source === 'folder') continue;
          if (needle !== '' && item.name.toLowerCase().indexOf(needle) === -1) continue;
          rows.push({
            name: item.name,
            label: item.name,
            description:
              item.source === 'used'
                ? t('command.sourceUsed', { count: item.count })
                : t('command.sourceWorkspace'),
            section: t('command.groupTodoProjects'),
            value: item.name,
          });
          if (rows.length >= 8) break;
        }
        // 优先级 / 类型：选中后插入 `!high ` / `^bug `，避免完全手打标记。
        for (const entry of PRIORITIES) {
          if (entry.value === '') continue;
          const marker = `!${entry.value}`;
          const label = t(entry.labelKey);
          if (needle !== '' && label.toLowerCase().indexOf(needle) === -1 && marker.indexOf(needle) === -1) continue;
          rows.push({
            name: `__ttl_priority__:${entry.value}`,
            label,
            description: t('command.sourceMarker', { marker }),
            section: t('command.groupTodoPriorities'),
            value: `__ttl_priority__:${entry.value}`,
          });
        }
        for (const entry of TYPES) {
          if (entry.value === '') continue;
          const marker = `^${entry.value}`;
          const label = t(entry.labelKey);
          if (needle !== '' && label.toLowerCase().indexOf(needle) === -1 && marker.indexOf(needle) === -1) continue;
          rows.push({
            name: `__ttl_type__:${entry.value}`,
            label,
            description: t('command.sourceMarker', { marker }),
            section: t('command.groupTodoTypes'),
            value: `__ttl_type__:${entry.value}`,
          });
        }
        return rows;
      } catch (error) {
        // 请求失败/中止时静默返回空候选，不影响面板与其它 @ 来源。
        return [];
      }
    },
    onPick(payload) {
      const pick = payload && typeof payload === 'object' ? payload : {};
      const candidate = pick.candidate && typeof pick.candidate === 'object' ? pick.candidate : {};
      const raw =
        typeof candidate.value === 'string' && candidate.value !== ''
          ? candidate.value
          : typeof candidate.name === 'string'
            ? candidate.name
            : '';
      if (raw === '') return { text: '' };
      // 优先级 / 类型候选项：编码在 value 里，选中后插入标记文本。
      if (raw.indexOf('__ttl_priority__:') === 0) {
        const value = raw.slice('__ttl_priority__:'.length);
        const known = PRIORITIES.some((entry) => entry.value === value && value !== '');
        return { text: known ? `!${value} ` : '' };
      }
      if (raw.indexOf('__ttl_type__:') === 0) {
        const value = raw.slice('__ttl_type__:'.length);
        const known = TYPES.some((entry) => entry.value === value && value !== '');
        return { text: known ? `^${value} ` : '' };
      }
      // 只返回文本（不要 insert），避免被平台当成引用/附件 chip。
      return { text: formatProjectTag(raw) };
    },
  };
}

/** 注册输入触发来源：优先 ctx.inject，退化为 ctx.get；注册失败只 warn，不破坏面板。 */
export function registerTodoProjectSource(ctx, source) {
  const warn = (error) => {
    try {
      if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn('[dsh-todo-time-log] input trigger source registration failed:', error);
      }
    } catch (ignored) {
      // 忽略日志失败
    }
  };
  try {
    if (ctx && typeof ctx.inject === 'function') {
      try {
        ctx.inject(['inputTriggers'], (scope) => {
          try {
            scope.effect(() => scope.inputTriggers.registerSource(source));
          } catch (error) {
            warn(error);
          }
        });
      } catch (error) {
        warn(error);
      }
      return;
    }
    if (ctx && typeof ctx.get === 'function') {
      const service = ctx.get('inputTriggers');
      if (service && typeof service.registerSource === 'function' && typeof ctx.effect === 'function') {
        ctx.effect(() => service.registerSource(source));
      }
    }
  } catch (error) {
    warn(error);
  }
}
