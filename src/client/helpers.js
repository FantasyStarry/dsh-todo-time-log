/** 基础工具：时间格式化、Host 接口调用、数据规整、日历/看板/甘特时间轴计算。 */
import { t } from './i18n.js';
import { CALENDAR_CELLS } from './styles.js';



/** Host 接口前缀（统一在前面补成绝对路径，避免 SPA 子路由把相对路径解析错）。 */
export const API_PREFIX = 'api/dsh-todo-time-log';
export const TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
export const EMPTY_TIME = '-';

/** 补零。 */
export function pad2(value) {
  return value < 10 ? `0${value}` : String(value);
}

/** 任意时间值 → 毫秒；空值 / 非法值返回 null。 */
export function toMillis(value) {
  if (value === null || value === undefined || value === '') return null;
  let ms;
  if (typeof value === 'number') ms = value;
  else if (typeof value === 'string') ms = Date.parse(value);
  else if (value instanceof Date) ms = value.getTime();
  else return null;
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : ms;
}

/** 本地时间 YYYY-MM-DD HH:mm:ss；null / 非法值显示 '-'。 */
export function formatTime(value) {
  const ms = toMillis(value);
  if (ms === null) return EMPTY_TIME;
  const date = new Date(ms);
  return (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ` +
    `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
  );
}

/** 人类可读用时；仅当创建时间与完成时间都可解析时返回时长，否则 '-'。 */
export function formatDuration(createdAt, completedAt) {
  const start = toMillis(createdAt);
  const end = toMillis(completedAt);
  if (start === null || end === null) return EMPTY_TIME;
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  if (seconds < 60) return t('detail.durationSeconds', { n: seconds });
  if (seconds < 3600) return t('detail.durationMinutes', { n: Math.floor(seconds / 60) });
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes > 0
      ? t('detail.durationHoursMinutes', { h: hours, m: minutes })
      : t('detail.durationHours', { h: hours });
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return hours > 0
    ? t('detail.durationDaysHours', { d: days, h: hours })
    : t('detail.durationDays', { d: days });
}

/** 卡片用的短时长（比详情里的「1 小时 45 分钟」更紧凑）；无法解析返回 '-'。 */
export function formatDurationShort(createdAt, completedAt) {
  const start = toMillis(createdAt);
  const end = toMillis(completedAt);
  if (start === null || end === null) return EMPTY_TIME;
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  if (seconds < 60) return t('board.durLessMinute');
  if (seconds < 3600) return t('board.durMinutes', { n: Math.floor(seconds / 60) });
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes > 0 ? t('board.durHoursMinutes', { h: hours, m: minutes }) : t('board.durHours', { h: hours });
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return hours > 0 ? t('board.durDaysHours', { d: days, h: hours }) : t('board.durDays', { d: days });
}

/** 搜索归一化：去首尾空白并转小写；非字符串返回空串。 */
export function normalizeSearch(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/** 客户端搜索匹配：标题 / 分类 / 文件路径（大小写不敏感）。 */
export function todoMatchesSearch(todo, query) {
  if (query === '') return true;
  if (!isRecord(todo)) return false;
  const parts = [typeof todo.title === 'string' ? todo.title : '', projectLabel(normalizeProject(todo.project))];
  const type = normalizeType(todo.type);
  if (type !== '') parts.push(t(`type.${type}`));
  const priority = normalizePriority(todo.priority);
  if (priority !== '') parts.push(t(`priority.${priority}`));
  for (const file of normalizeFiles(todo.files)) parts.push(file);
  return parts.join('\n').toLowerCase().includes(query);
}

/** 构造带 code 的 Error，供提示条读取 message。 */
export function apiError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/** 安全读取 error.message。 */
export function messageOf(error) {
  if (error && typeof error.message === 'string' && error.message !== '') return error.message;
  if (typeof error === 'string' && error !== '') return error;
  return t('notice.unknownError');
}

export function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function toCount(value, fallback) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return Math.floor(number);
}

export function apiUrl(path) {
  const suffix = path.charAt(0) === '/' ? path : `/${path}`;
  return `/${API_PREFIX}${suffix}`;
}

/**
 * 统一的 HTTP 调用：POST + JSON。
 * 处理网络错误、非 2xx、非 JSON 响应与 `{ok:false}` 业务错误，
 * 全部抛出带可读 message 的 Error。
 * @param {string} path - 接口路径，如 '/list'。
 * @param {object} [body] - 请求体。
 * @returns {Promise<any>} 响应里的 value。
 */
export async function request(path, body) {
  const url = apiUrl(path);
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(body === undefined ? {} : body),
    });
  } catch (cause) {
    throw apiError('network_error', t('notice.networkError', { message: messageOf(cause) }));
  }

  const status = response && typeof response.status === 'number' ? response.status : 0;
  const ok = Boolean(response && response.ok);
  let payload = null;
  let parseFailed = false;
  try {
    payload = await response.json();
  } catch (cause) {
    parseFailed = true;
  }

  if (!ok) {
    const serverError = isRecord(payload) ? payload.error : null;
    const code = isRecord(serverError) && typeof serverError.code === 'string' ? serverError.code : `http_${status}`;
    const message =
      isRecord(serverError) && typeof serverError.message === 'string' && serverError.message !== ''
        ? serverError.message
        : t('notice.httpError', { status });
    throw apiError(code, message);
  }

  if (parseFailed || !isRecord(payload)) {
    throw apiError('invalid_response', t('notice.invalidResponse'));
  }

  if (payload.ok !== true) {
    const serverError = isRecord(payload.error) ? payload.error : null;
    const code = serverError && typeof serverError.code === 'string' ? serverError.code : 'unknown_error';
    const message =
      serverError && typeof serverError.message === 'string' && serverError.message !== ''
        ? serverError.message
        : t('notice.serverError');
    throw apiError(code, message);
  }

  return payload.value;
}

/** 把接口返回的待办规整成稳定结构；无法识别的条目返回 null。 */
export function normalizeTodo(raw) {
  if (!isRecord(raw)) return null;
  const rawId = raw.id;
  if (rawId === null || rawId === undefined || String(rawId) === '') return null;
  const status = raw.status === 'completed' ? 'completed' : 'pending';
  const title = typeof raw.title === 'string' ? raw.title : raw.title === null || raw.title === undefined ? '' : String(raw.title);
  return {
    id: String(rawId),
    title,
    project: normalizeProject(raw.project),
    files: normalizeFiles(raw.files),
    priority: normalizePriority(raw.priority),
    type: normalizeType(raw.type),
    status,
    createdAt: raw.createdAt === undefined ? null : raw.createdAt,
    completedAt: raw.completedAt === undefined ? null : raw.completedAt,
    updatedAt: raw.updatedAt === undefined ? null : raw.updatedAt,
  };
}

/** 文件路径规整：只保留非空字符串、去重、最多 20 个（与 Host 上限一致）。 */
export function normalizeFiles(raw) {
  if (!Array.isArray(raw)) return [];
  const result = [];
  const seen = new Set();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const path = item.trim();
    if (path === '' || seen.has(path)) continue;
    seen.add(path);
    result.push(path);
    if (result.length >= 20) break;
  }
  return result;
}

/** 补全候选文件列表规整（/files 返回值）。 */
export function normalizeFileSuggestions(raw) {
  if (!Array.isArray(raw)) return [];
  const result = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const path = item.trim();
    if (path === '') continue;
    result.push(path);
  }
  return result;
}

/** quick-add 的 skipped 规整：{line, reason}。 */
export function normalizeChatSkipped(raw) {
  if (!Array.isArray(raw)) return [];
  const result = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    result.push({
      line: typeof item.line === 'string' ? item.line : item.line === undefined || item.line === null ? '' : String(item.line),
      reason: typeof item.reason === 'string' ? item.reason : item.reason === undefined || item.reason === null ? '' : String(item.reason),
    });
  }
  return result;
}

/** quick-add 的 errors 规整：{title, code, message}。 */
export function normalizeChatErrors(raw) {
  if (!Array.isArray(raw)) return [];
  const result = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    result.push({
      title: typeof item.title === 'string' ? item.title : '',
      code: typeof item.code === 'string' ? item.code : '',
      message: typeof item.message === 'string' ? item.message : '',
    });
  }
  return result;
}

/** 文件路径的 basename（兼容 / 与 \\）。 */
export function fileBaseName(path) {
  const text = typeof path === 'string' ? path : '';
  const parts = text.split(/[\\/]/);
  return parts.length > 0 ? parts[parts.length - 1] || text : text;
}

/**
 * 检测光标前的 @ 文件 token：返回 {start,end,query}，其中 start 是 '@' 的下标；
 * 光标与最近的 @ 之间出现空白则不算 token。无法检测时返回 null。
 */
/** 检测光标前最近的指定标记 token（@ 文件 / # 分类）。 */
export function findTagToken(text, caret, marker) {
  const source = typeof text === 'string' ? text : '';
  const tag = typeof marker === 'string' && marker !== '' ? marker[0] : '';
  if (tag === '') return null;
  const position =
    typeof caret === 'number' && Number.isFinite(caret) ? Math.max(0, Math.min(caret, source.length)) : source.length;
  const before = source.slice(0, position);
  const atIndex = before.lastIndexOf(tag);
  if (atIndex < 0) return null;
  const query = before.slice(atIndex + 1);
  if (/\s/.test(query)) return null;
  return { start: atIndex, end: position, query };
}

/**
 * 检测光标前的 @ 文件 token：返回 {start,end,query}，其中 start 是 '@' 的下标；
 * 光标与最近的 @ 之间出现空白则不算 token。无法检测时返回 null。
 */
export function findAtToken(text, caret) {
  return findTagToken(text, caret, '@');
}

/** 检测光标前的 # 分类 token。 */
export function findHashToken(text, caret) {
  return findTagToken(text, caret, '#');
}

/** 插入 @ 引用的文本：含空白或 # 的路径使用引号形式（Host 支持 @"..."）。 */
export function formatFileReference(path) {
  const text = typeof path === 'string' ? path : '';
  return /[\s#]/.test(text) ? `@"${text}" ` : `@${text} `;
}

/** 插入 # 分类的文本：名称含空白时使用 [名称] 形式（# 遇到空格会断）。 */
export function formatProjectTag(name) {
  const text = typeof name === 'string' ? name : '';
  return /\s/.test(text) ? `[${text}] ` : `#${text} `;
}

/** 文本是否含 Host 可解析的标记（有则顶部框提交走 /quick-add）。 */
export function hasTagMarkup(value) {
  const text = typeof value === 'string' ? value : '';
  // 字符类里的 `[` 无需转义；去掉多余转义后语义与旧实现完全一致。
  return /[#@[\]\n；;]|(?:项目|分类)\s*[：:]/.test(text);
}

/** @ 补全缓存键：workspace + query，避免跨工作区串数据。 */
export function fileCacheKey(workspace, query) {
  const workspaceText = typeof workspace === 'string' ? workspace : '';
  const queryText = typeof query === 'string' ? query : '';
  return `${workspaceText}\u0000${queryText}`;
}

/** # 分类补全缓存键：workspace + 'project'（与文件缓存分开）。 */
export function projectCacheKey(workspace) {
  const workspaceText = typeof workspace === 'string' ? workspace : '';
  return `${workspaceText}\u0000project`;
}

/** /projects 建议规整：{name, source:'used'|'workspace'|'folder', count}。 */
export function normalizeProjectSuggestions(raw) {
  if (!Array.isArray(raw)) return [];
  const result = [];
  const seen = new Set();
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const name = normalizeProjectInput(typeof item.name === 'string' ? item.name : '');
    if (name === '' || name.length > 40) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const source = item.source === 'used' || item.source === 'workspace' || item.source === 'folder' ? item.source : 'folder';
    result.push({ name, source, count: toCount(item.count, 0) });
  }
  return result;
}

/** 工作区列表规整：{path,title,source}，path 必填。 */
export function normalizeWorkspaces(raw) {
  if (!Array.isArray(raw)) return [];
  const result = [];
  const seen = new Set();
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const path = typeof item.path === 'string' ? item.path.trim() : '';
    if (path === '' || seen.has(path)) continue;
    seen.add(path);
    result.push({
      path,
      title: typeof item.title === 'string' && item.title !== '' ? item.title : path,
      source: typeof item.source === 'string' ? item.source : '',
    });
  }
  return result;
}

export function normalizeTodos(raw) {
  if (!Array.isArray(raw)) return [];
  const result = [];
  for (const item of raw) {
    const todo = normalizeTodo(item);
    if (todo !== null) result.push(todo);
  }
  return result;
}

/** 统计优先用 Host 返回值，异常时按当前列表兜底。 */
export function normalizeStats(raw, todos) {
  const list = Array.isArray(todos) ? todos : [];
  let pending = 0;
  for (const todo of list) {
    if (todo.status !== 'completed') pending += 1;
  }
  const computed = { total: list.length, pending, completed: list.length - pending };
  const source = isRecord(raw) ? raw : {};
  return {
    total: toCount(source.total, computed.total),
    pending: toCount(source.pending, computed.pending),
    completed: toCount(source.completed, computed.completed),
  };
}

/** 取出接口 notices（兼容字符串与 {message} 对象），拼成一行提示。 */
export function extractNotices(value) {
  if (!isRecord(value) || !Array.isArray(value.notices)) return '';
  const parts = [];
  for (const notice of value.notices) {
    if (typeof notice === 'string' && notice !== '') parts.push(notice);
    else if (isRecord(notice) && typeof notice.message === 'string' && notice.message !== '') parts.push(notice.message);
  }
  return parts.join(t('notice.join'));
}

/** 统一取「这次操作之后要展示的提示」。 */
export function notifyText(value, fallbackKey) {
  const text = extractNotices(value);
  if (text !== '') return text;
  return fallbackKey ? t(fallbackKey) : '';
}

/** 分类字段规整：只有字符串才算分类，其它值按未分类处理。 */
export function normalizeProject(value) {
  return typeof value === 'string' ? value : '';
}

/** 优先级字段规整：只接受 high/medium/low，其它值按未设置处理。 */
export function normalizePriority(value) {
  return value === 'high' || value === 'medium' || value === 'low' ? value : '';
}

/** 类型字段规整：只接受 bug/feature/improvement/question/chore/other，其它值按未设置处理。 */
export function normalizeType(value) {
  return value === 'bug' ||
    value === 'feature' ||
    value === 'improvement' ||
    value === 'question' ||
    value === 'chore' ||
    value === 'other'
    ? value
    : '';
}

/** 与服务端 normalizeProjectName 一致：去控制字符、折叠连续空白、trim。 */
export function normalizeProjectInput(value) {
  if (typeof value !== 'string') return '';
  // 去控制字符就是这个归一化函数的实现本身，不是笔误（与 Host 侧 normalizeProjectName 一致）。
  // eslint-disable-next-line no-control-regex -- 控制字符范围是需求本身
  const controlChars = /[\u0000-\u001f\u007f]/g;
  return value
    .replace(controlChars, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 与服务端 validateTitle 一致：折叠连续空白并 trim。 */
export function normalizeTitleInput(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

/** 展示用分类名（未分类走 i18n）。 */
export function projectLabel(project) {
  const name = normalizeProject(project);
  return name === '' ? t('project.none') : name;
}

/** 分类排序：按名称，未分类始终最后。 */
export function compareProjectNames(left, right) {
  if (left === right) return 0;
  if (left === '') return 1;
  if (right === '') return -1;
  try {
    return String(left).localeCompare(String(right), 'zh');
  } catch (error) {
    return String(left) < String(right) ? -1 : 1;
  }
}

/** 分类条目规整：优先用 Host 的 projects，缺失时从当前 todos 推导。 */
export function normalizeProjects(raw, todos) {
  const entries = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!isRecord(item)) continue;
      entries.push({
        name: normalizeProject(item.name),
        count: toCount(item.count, 0),
        pending: toCount(item.pending, 0),
        completed: toCount(item.completed, 0),
      });
    }
  }
  if (entries.length > 0) {
    entries.sort((left, right) => compareProjectNames(left.name, right.name));
    return entries;
  }
  const map = new Map();
  for (const todo of Array.isArray(todos) ? todos : []) {
    const name = normalizeProject(todo && todo.project);
    const entry = map.get(name) || { name, count: 0, pending: 0, completed: 0 };
    entry.count += 1;
    if (todo.status === 'completed') entry.completed += 1;
    else entry.pending += 1;
    map.set(name, entry);
  }
  return [...map.values()].sort((left, right) => compareProjectNames(left.name, right.name));
}

/** 按分类分组（组内保持传入顺序，组按名称排序、未分类最后）。 */
export function groupByProject(items, getProject) {
  const map = new Map();
  const groups = [];
  const list = Array.isArray(items) ? items : [];
  for (const item of list) {
    let project;
    try {
      project = normalizeProject(getProject(item));
    } catch (error) {
      project = '';
    }
    if (!map.has(project)) {
      const memberList = [];
      map.set(project, memberList);
      groups.push({ project, items: memberList });
    }
    map.get(project).push(item);
  }
  groups.sort((left, right) => compareProjectNames(left.project, right.project));
  return groups;
}

/**
 * 列表分组：未分类始终最后；direction 同时作用于组顺序与组内 createdAt 排序
 * （组内默认按 createdAt，与 Host 的 createdAt 排序语义一致）。
 */
export function groupTodosByProject(todos, direction) {
  const descending = direction === 'desc';
  const groups = groupByProject(todos, (todo) => todo && todo.project);
  if (descending) {
    groups.sort((left, right) => {
      if (left.project === '' && right.project !== '') return 1;
      if (right.project === '' && left.project !== '') return -1;
      return -compareProjectNames(left.project, right.project);
    });
  }
  const compareCreatedAt = (left, right) => {
    const a = toMillis(left && left.createdAt);
    const b = toMillis(right && right.createdAt);
    if (a === null && b === null) return 0;
    if (a === null) return 1; // 非法时间始终最后
    if (b === null) return -1;
    return descending ? b - a : a - b;
  };
  for (const group of groups) group.items.sort(compareCreatedAt);
  return groups;
}

/** 刷新后裁剪展开/选中类 id 映射：只保留仍出现在列表里的 id。 */
export function pruneIdMap(current, todos) {
  if (current === null || typeof current !== 'object') return current;
  const keys = Object.keys(current);
  if (keys.length === 0) return current;
  const alive = new Set((Array.isArray(todos) ? todos : []).map((todo) => todo.id));
  let changed = false;
  const next = {};
  for (const key of keys) {
    if (alive.has(key)) next[key] = true;
    else changed = true;
  }
  return changed ? next : current;
}

/** 本地 HH:mm:ss；非法值返回 '-'。 */
export function formatClock(value) {
  const ms = toMillis(value);
  if (ms === null) return EMPTY_TIME;
  const date = new Date(ms);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

/** 本地日期键 YYYY-MM-DD；非法毫秒返回 ''。 */
export function dateKeyOf(ms) {
  if (!Number.isFinite(ms)) return '';
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** 某月 42 个日历格（周一起始，含前后月补格）。 */
export function buildCalendarCells(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // 周一 = 0
  const start = new Date(year, month, 1 - offset);
  const todayKey = dateKeyOf(Date.now());
  const cells = [];
  for (let index = 0; index < CALENDAR_CELLS; index += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const ms = date.getTime();
    const key = dateKeyOf(ms);
    cells.push({
      ms,
      key,
      day: date.getDate(),
      inMonth: date.getFullYear() === year && date.getMonth() === month,
      isToday: key === todayKey,
    });
  }
  return cells;
}

/** 日历落格用的日期键：按创建/完成时间，非法返回 ''。 */
export function calendarDayKey(todo, basis) {
  if (!isRecord(todo)) return '';
  const ms = toMillis(basis === 'completedAt' ? todo.completedAt : todo.createdAt);
  return ms === null ? '' : dateKeyOf(ms);
}

/**
 * 看板列：状态（默认）或分类（名称升序、未分类最后）。
 * `status`/`dot` 用于列头状态点；`project` 只在按分类分组时存在（列内快捷新建要预填分类）。
 */
export function boardColumns(todos, groupBy) {
  if (groupBy === 'project') {
    return groupByProject(todos, (todo) => todo && todo.project).map((group) => ({
      key: `project:${group.project}`,
      label: projectLabel(group.project),
      items: group.items,
      project: group.project,
      status: '',
      dot: '',
    }));
  }
  const pending = [];
  const completed = [];
  for (const todo of Array.isArray(todos) ? todos : []) {
    if (todo.status === 'completed') completed.push(todo);
    else pending.push(todo);
  }
  const toLanes = (items) =>
    groupByProject(items, (todo) => todo && todo.project).map((group) => ({
      key: `lane:${group.project}`,
      project: group.project,
      label: projectLabel(group.project),
      items: group.items,
    }));
  const swimlane = groupBy === 'status-project';
  return [
    {
      key: 'status:pending',
      label: t('row.pending'),
      items: pending,
      project: undefined,
      status: 'pending',
      dot: 'pending',
      lanes: swimlane ? toLanes(pending) : undefined,
    },
    {
      key: 'status:completed',
      label: t('row.completed'),
      items: completed,
      project: undefined,
      status: 'completed',
      dot: 'completed',
      lanes: swimlane ? toLanes(completed) : undefined,
    },
  ];
}

export const GANTT_LABEL_WIDTH = 220;
export const GANTT_TRACK_WIDTH = 900;
export const GANTT_STEPS = [
  60e3, 2 * 60e3, 5 * 60e3, 10 * 60e3, 15 * 60e3, 30 * 60e3,
  3600e3, 2 * 3600e3, 3 * 3600e3, 6 * 3600e3, 12 * 3600e3,
  86400e3, 2 * 86400e3, 3 * 86400e3, 7 * 86400e3, 14 * 86400e3, 30 * 86400e3, 90 * 86400e3, 180 * 86400e3, 365 * 86400e3,
];

/** 目标 6-10 个刻度：取让刻度数不超过 10 的最小步长。 */
export function chooseTickStep(span) {
  for (const step of GANTT_STEPS) {
    if (span / step <= 10) return step;
  }
  return GANTT_STEPS[GANTT_STEPS.length - 1];
}

/** 刻度标签：MM-DD HH:mm；跨度超过 30 天用 MM-DD。 */
export function formatTickLabel(ms, span) {
  const date = new Date(ms);
  const monthDay = `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  if (span > 30 * 86400e3) return monthDay;
  return `${monthDay} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}
