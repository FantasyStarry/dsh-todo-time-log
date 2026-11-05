/**
 * Data model + persistence for 「待办时间日志」 (dsh-todo-time-log).
 *
 * Todo record (persisted, JSON):
 *   {
 *     id:          string,   // stable opaque id, e.g. "ttl_m0k2x9a1b7"
 *     title:       string,   // 1..200 chars after whitespace collapsing
 *     project:     string,   // project/category name; '' = 未分类 (uncategorized)
 *     files:       string[], // workspace-relative file references ('' files = none)
 *     status:      'pending' | 'completed',
 *     priority:    '' | 'high' | 'medium' | 'low', // '' = 未设置 (default)
 *     type:        '' | 'bug' | 'feature' | 'improvement' | 'question' | 'chore' | 'other',
 *                                                 // '' = 未设置 (default)
 *     createdAt:   string,   // ISO-8601 UTC, always present (repaired when missing)
 *     completedAt: string | null, // ISO-8601 UTC; null exactly while pending
 *     updatedAt:   string    // ISO-8601 UTC, last modification
 *   }
 *
 * On-disk envelope:
 *   { "version": 5, "updatedAt": "<ISO>", "todos": [Todo, ...] }
 *
 * Older envelopes migrate in memory on load and are persisted as v5 on the next
 * write: v1 (no `project`), v2 (no `files`), v3 (no `priority`) and v4 (no
 * `type`). Unsupported versions are archived instead of being guessed at.
 *
 * Result envelope shared by every mutating method:
 *   success -> { ok: true, ...payload, notices: string[] }
 *   failure -> { ok: false, code: string, message: string }
 *
 * `notices` carries human-readable Chinese repair/notification text for the
 * product's exception-handling requirement (missing createdAt, completion
 * earlier than creation, repeated completion, ...). A notice never hides data.
 *
 * This module has no dsh dependency on purpose: it is plain Node ESM, so the
 * unit tests can drive it directly and a future storage adapter can reuse it.
 */

import { createHash } from 'node:crypto';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import {
  formatLocalDateTime,
  nowIso,
  parseTimestamp,
  toIsoString,
} from './time.js';

export const STORE_VERSION = 5;
/** Envelope versions this build can load: v1 lacks `project`, v2 lacks `files`, v3 lacks `priority`, v4 lacks `type`. */
export const SUPPORTED_STORE_VERSIONS = Object.freeze([1, 2, 3, 4, 5]);
export const TODO_STATUS = Object.freeze({
  PENDING: 'pending',
  COMPLETED: 'completed',
});
/** Priority values in display order (highest first); `''` = 未设置. */
export const PRIORITIES = Object.freeze(['high', 'medium', 'low']);
export const PRIORITY_UNSET = '';
/** Higher wins: used by `sortBy: 'priority'` (high > medium > low > 未设置). */
const PRIORITY_RANK = Object.freeze({ high: 3, medium: 2, low: 1 });
/** Type values; `''` = 未设置 (未分类的类型). */
export const TYPES = Object.freeze(['bug', 'feature', 'improvement', 'question', 'chore', 'other']);
export const TYPE_UNSET = '';
export const FILTERS = Object.freeze(['all', 'pending', 'completed']);
export const SORT_FIELDS = Object.freeze(['createdAt', 'completedAt', 'updatedAt', 'title', 'project', 'priority']);
export const MAX_TITLE_LENGTH = 200;
export const MAX_PROJECT_LENGTH = 40;
export const MAX_FILES = 20;
export const MAX_FILE_PATH_LENGTH = 300;
export const UNCATEGORIZED_PROJECT = '';
export const MAX_TODOS = 5000;

export const ERROR_CODES = Object.freeze({
  TITLE_REQUIRED: 'TITLE_REQUIRED',
  TITLE_TOO_LONG: 'TITLE_TOO_LONG',
  PROJECT_INVALID: 'PROJECT_INVALID',
  PROJECT_TOO_LONG: 'PROJECT_TOO_LONG',
  PRIORITY_INVALID: 'PRIORITY_INVALID',
  TYPE_INVALID: 'TYPE_INVALID',
  FILES_INVALID: 'FILES_INVALID',
  TOO_MANY_FILES: 'TOO_MANY_FILES',
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_COMPLETED: 'ALREADY_COMPLETED',
  ALREADY_PENDING: 'ALREADY_PENDING',
  TOO_MANY_TODOS: 'TOO_MANY_TODOS',
  PERSIST_FAILED: 'PERSIST_FAILED',
  BAD_REQUEST: 'BAD_REQUEST',
});

function failure(code, message) {
  return { ok: false, code, message };
}

let idCounter = 0;

/** Stable, collision-resistant id; depends only on time + randomness. */
export function makeTodoId(seed = Date.now()) {
  idCounter = (idCounter + 1) % 0xffff;
  const time = Math.max(0, Math.floor(seed)).toString(36);
  const salt = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
  const counter = idCounter.toString(36).padStart(2, '0');
  return `ttl_${time}${counter}${salt}`;
}

function collapseWhitespace(text) {
  return text.replace(/\s+/g, ' ').trim();
}

/** Validate and normalize a user-supplied title. */
export function validateTitle(input) {
  if (typeof input !== 'string') {
    return failure(ERROR_CODES.TITLE_REQUIRED, '标题不能为空');
  }
  const title = collapseWhitespace(input);
  if (title === '') {
    return failure(ERROR_CODES.TITLE_REQUIRED, '标题不能为空');
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return failure(
      ERROR_CODES.TITLE_TOO_LONG,
      `标题不能超过 ${MAX_TITLE_LENGTH} 个字符（当前 ${title.length}）`,
    );
  }
  return { ok: true, title };
}

/**
 * Normalize a project/category name: strip control characters, collapse
 * whitespace, trim. `''` means 未分类 (uncategorized).
 */
export function normalizeProjectName(input) {
  if (typeof input !== 'string') return UNCATEGORIZED_PROJECT;
  return input
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Validate a user-supplied project name; missing value means 未分类. */
export function validateProject(input) {
  if (input === undefined || input === null) return { ok: true, project: UNCATEGORIZED_PROJECT };
  if (typeof input !== 'string') {
    return failure(ERROR_CODES.PROJECT_INVALID, '项目分类必须是字符串');
  }
  const project = normalizeProjectName(input);
  if (project.length > MAX_PROJECT_LENGTH) {
    return failure(
      ERROR_CODES.PROJECT_TOO_LONG,
      `项目分类不能超过 ${MAX_PROJECT_LENGTH} 个字符（当前 ${project.length}）`,
    );
  }
  return { ok: true, project };
}

/**
 * Validate and normalize a priority value. `''` means 未设置 and is the default;
 * only the four documented values are accepted, so a typo cannot silently
 * become a different priority.
 */
export function validatePriority(input) {
  if (input === undefined || input === null) return { ok: true, priority: PRIORITY_UNSET };
  if (typeof input !== 'string') {
    return failure(ERROR_CODES.PRIORITY_INVALID, '优先级必须是字符串：high（高）/medium（中）/low（低），空串表示未设置');
  }
  const priority = input.trim();
  if (priority === PRIORITY_UNSET || PRIORITIES.includes(priority)) {
    return { ok: true, priority };
  }
  return failure(
    ERROR_CODES.PRIORITY_INVALID,
    `优先级「${priority}」非法；可选值：high（高）、medium（中）、low（低），空串表示未设置`,
  );
}

/**
 * Validate and normalize a type value. `''` means 未设置 and is the default; only
 * the six documented values are accepted, so a typo cannot silently become a
 * different type.
 */
export function validateType(input) {
  if (input === undefined || input === null) return { ok: true, type: TYPE_UNSET };
  if (typeof input !== 'string') {
    return failure(
      ERROR_CODES.TYPE_INVALID,
      '类型必须是字符串：bug（缺陷）/feature（新功能）/improvement（改进）/question（疑问）/chore（杂项）/other（其他），空串表示未设置',
    );
  }
  const type = input.trim();
  if (type === TYPE_UNSET || TYPES.includes(type)) {
    return { ok: true, type };
  }
  return failure(
    ERROR_CODES.TYPE_INVALID,
    `类型「${type}」非法；可选值：bug（缺陷）、feature（新功能）、improvement（改进）、question（疑问）、chore（杂项）、other（其他），空串表示未设置`,
  );
}

/**
 * Normalize one workspace-relative file path to POSIX form, or '' when usable
 * references only are allowed: absolute paths, drive letters, UNC paths and
 * traversal segments are rejected rather than silently rewritten.
 */
export function normalizeFilePath(input) {
  if (typeof input !== 'string') return '';
  let value = input.trim().replace(/\\/g, '/');
  if (value === '') return '';
  if (value.startsWith('//')) return '';
  if (/^[a-zA-Z]:/.test(value)) return '';
  if (value.startsWith('/')) return '';
  while (value.startsWith('./')) value = value.slice(2);
  value = value.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  if (value === '' || value === '.') return '';
  const segments = value.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) return '';
  if (value.length > MAX_FILE_PATH_LENGTH) return '';
  if (/[\u0000-\u001f\u007f]/.test(value)) return '';
  return value;
}

/** Validate a `files` input array (undefined/null means "no references"). */
export function validateFiles(input) {
  if (input === undefined || input === null) return { ok: true, files: [], dropped: [] };
  if (!Array.isArray(input)) {
    return failure(ERROR_CODES.FILES_INVALID, '文件引用必须是工作区相对路径数组');
  }
  const files = [];
  const dropped = [];
  for (const entry of input) {
    const normalized = normalizeFilePath(entry);
    if (normalized === '') {
      dropped.push(String(entry));
      continue;
    }
    if (!files.includes(normalized)) files.push(normalized);
  }
  if (files.length > MAX_FILES) {
    return failure(ERROR_CODES.TOO_MANY_FILES, `最多引用 ${MAX_FILES} 个文件（当前 ${files.length}）`);
  }
  if (files.length === 0 && dropped.length > 0) {
    return failure(
      ERROR_CODES.FILES_INVALID,
      `文件引用无效（需要工作区相对路径，不能是绝对路径或包含 ..）：${dropped[0]}`,
    );
  }
  return { ok: true, files, dropped };
}

/**
 * Derive a project/category from referenced files so `@path/to/file` marks the
 * project without an explicit `#分类`: the first file's directory, or the file
 * name itself for a root-level file. Long directories fall back to their last
 * segment to stay inside MAX_PROJECT_LENGTH.
 */
export function deriveProjectFromFiles(files) {
  if (!Array.isArray(files) || files.length === 0) return UNCATEGORIZED_PROJECT;
  const segments = String(files[0]).split('/');
  const candidate = segments.length > 1
    ? segments.slice(0, -1).join('/')
    : segments[0];
  if (candidate.length <= MAX_PROJECT_LENGTH) return candidate;
  const tail = candidate.split('/').pop() ?? candidate;
  return tail.slice(0, MAX_PROJECT_LENGTH);
}

/**
 * Repair one persisted record into a valid Todo, or reject it.
 * Every repair is reported through `notices`; nothing is silently invented
 * except the fields the product explicitly allows to be defaulted.
 */
export function normalizeTodo(raw, options = {}) {
  const { now = Date.now(), makeId = makeTodoId } = options;
  const notices = [];
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { todo: null, notices: ['已丢弃一条格式非法的待办记录'] };
  }

  const status = raw.status === TODO_STATUS.COMPLETED
    ? TODO_STATUS.COMPLETED
    : TODO_STATUS.PENDING;
  if (raw.status !== undefined && raw.status !== status) {
    notices.push(`待办状态「${String(raw.status)}」非法，已按未完成处理`);
  }

  let id = typeof raw.id === 'string' ? raw.id.trim() : '';
  if (id === '') {
    id = makeId();
    notices.push('待办缺少 id，已重新生成');
  }

  const titleResult = validateTitle(raw.title);
  if (!titleResult.ok) {
    return { todo: null, notices: ['已丢弃一条标题非法的待办记录'] };
  }

  const filesResult = validateFiles(raw.files);
  const files = filesResult.ok ? filesResult.files : [];
  if (!filesResult.ok) {
    notices.push(`${filesResult.message}，已清空文件引用`);
  } else if (filesResult.dropped.length > 0) {
    notices.push(`已丢弃 ${filesResult.dropped.length} 个非法的文件引用`);
  }

  const projectResult = validateProject(raw.project);
  let project = projectResult.ok ? projectResult.project : UNCATEGORIZED_PROJECT;
  if (!projectResult.ok) {
    notices.push(`${projectResult.message}，已归入未分类`);
  } else if (
    project === UNCATEGORIZED_PROJECT
    && files.length > 0
    // Only derive when the field is genuinely absent: an explicit `project: ''`
    // means the user chose 未分类 and must survive a reload unchanged.
    && (raw.project === undefined || raw.project === null)
  ) {
    project = deriveProjectFromFiles(files);
    notices.push(`缺少项目分类，已按文件目录归类为「${project}」`);
  }

  const priorityResult = validatePriority(raw.priority);
  const priority = priorityResult.ok ? priorityResult.priority : PRIORITY_UNSET;
  if (!priorityResult.ok) {
    notices.push(`${priorityResult.message}，已按未设置处理`);
  }

  const typeResult = validateType(raw.type);
  const type = typeResult.ok ? typeResult.type : TYPE_UNSET;
  if (!typeResult.ok) {
    notices.push(`${typeResult.message}，已按未设置处理`);
  }

  const nowMs = typeof now === 'number' ? now : (parseTimestamp(now) ?? Date.now());
  const rawCreatedAtMs = parseTimestamp(raw.createdAt);
  // Effective creation time: the repaired fallback participates in the
  // completedAt consistency checks below, so a repaired record can never keep a
  // completion time that precedes its own creation time.
  const createdAtMs = rawCreatedAtMs === null ? nowMs : rawCreatedAtMs;
  const createdAt = toIsoString(createdAtMs);
  if (rawCreatedAtMs === null) {
    notices.push('创建时间缺失或非法，已按当前时间补齐');
  }

  let completedAt = null;
  if (status === TODO_STATUS.COMPLETED) {
    const completedMs = parseTimestamp(raw.completedAt);
    if (completedMs === null) {
      completedAt = createdAt;
      notices.push('完成时间缺失，已回退为创建时间');
    } else if (completedMs < createdAtMs) {
      completedAt = createdAt;
      notices.push('完成时间早于创建时间，已修正为创建时间');
    } else {
      completedAt = toIsoString(completedMs);
    }
  } else if (raw.completedAt !== null && raw.completedAt !== undefined) {
    notices.push('未完成状态的待办带有完成时间，已清空完成时间');
  }

  const updatedAtMs = parseTimestamp(raw.updatedAt);
  const updatedAt = updatedAtMs === null
    ? (completedAt ?? createdAt)
    : toIsoString(updatedAtMs);

  return {
    todo: { id, title: titleResult.title, project, files, status, priority, type, createdAt, completedAt, updatedAt },
    notices,
  };
}

/** Pure filter: 'all' | 'pending' | 'completed'. */
export function filterTodos(todos, filter = 'all') {
  if (filter === TODO_STATUS.PENDING) {
    return todos.filter((todo) => todo.status === TODO_STATUS.PENDING);
  }
  if (filter === TODO_STATUS.COMPLETED) {
    return todos.filter((todo) => todo.status === TODO_STATUS.COMPLETED);
  }
  return todos.slice();
}

function sortKeyOf(todo, sortBy) {
  if (sortBy === 'title') return todo.title.toLocaleLowerCase();
  if (sortBy === 'updatedAt') return parseTimestamp(todo.updatedAt);
  if (sortBy === 'completedAt') return parseTimestamp(todo.completedAt);
  return parseTimestamp(todo.createdAt);
}

/**
 * Pure sort. `completedAt`/`createdAt` sort by absolute time; unparsable values
 * (i.e. pending todos by `completedAt`) always land last so the list stays
 * readable in both directions. `priority` sorts high > medium > low, and
 * 未设置 (`''`) always lands last regardless of direction, matching the
 * `completedAt` empty-value rule.
 */
export function sortTodos(todos, options = {}) {
  const sortBy = SORT_FIELDS.includes(options.sortBy) ? options.sortBy : 'createdAt';
  const direction = options.direction === 'asc' ? 'asc' : 'desc';
  const factor = direction === 'asc' ? 1 : -1;
  return todos.slice().sort((left, right) => {
    const byId = () => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
    if (sortBy === 'priority') {
      const pa = PRIORITY_RANK[left.priority] ?? 0;
      const pb = PRIORITY_RANK[right.priority] ?? 0;
      const aUnset = pa === 0;
      const bUnset = pb === 0;
      if (aUnset || bUnset) {
        if (aUnset && bUnset) return byId();
        return aUnset ? 1 : -1; // 未设置 always last, both directions
      }
      if (pa !== pb) return pa < pb ? -factor : factor;
      return byId();
    }
    if (sortBy === 'project') {
      const pa = left.project ?? UNCATEGORIZED_PROJECT;
      const pb = right.project ?? UNCATEGORIZED_PROJECT;
      if (pa === UNCATEGORIZED_PROJECT || pb === UNCATEGORIZED_PROJECT) {
        if (pa === pb) return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
        return pa === UNCATEGORIZED_PROJECT ? 1 : -1; // 未分类 always last
      }
      const cmp = pa.localeCompare(pb, 'zh-Hans-CN') * factor;
      return cmp !== 0 ? cmp : left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    }
    const a = sortKeyOf(left, sortBy);
    const b = sortKeyOf(right, sortBy);
    const aEmpty = a === null || a === undefined;
    const bEmpty = b === null || b === undefined;
    if (aEmpty && bEmpty) return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    if (a < b) return -factor;
    if (a > b) return factor;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}

/**
 * Per-project summary over the whole list (never over the filtered view, so the
 * category picker keeps every category visible). `''` (未分类) sorts last.
 */
export function computeProjects(todos) {
  const map = new Map();
  for (const todo of todos) {
    const name = todo.project ?? UNCATEGORIZED_PROJECT;
    const entry = map.get(name) ?? { name, count: 0, pending: 0, completed: 0 };
    entry.count += 1;
    if (todo.status === TODO_STATUS.PENDING) entry.pending += 1;
    else entry.completed += 1;
    map.set(name, entry);
  }
  return [...map.values()].sort((a, b) => {
    if (a.name === UNCATEGORIZED_PROJECT) return b.name === UNCATEGORIZED_PROJECT ? 0 : 1;
    if (b.name === UNCATEGORIZED_PROJECT) return -1;
    return a.name.localeCompare(b.name, 'zh-Hans-CN');
  });
}

export function computeStats(todos) {
  let pending = 0;
  for (const todo of todos) {
    if (todo.status === TODO_STATUS.PENDING) pending += 1;
  }
  return { total: todos.length, pending, completed: todos.length - pending };
}

/** Default bound for acquiring the cross-process write lock. */
const DEFAULT_LOCK_TIMEOUT_MS = 2000;
/** A lock file older than this is treated as left behind by a crashed writer. */
const DEFAULT_STALE_LOCK_MS = 10_000;
const LOCK_RETRY_MIN_MS = 20;
const LOCK_RETRY_MAX_MS = 50;

/** SHA-256 of a persisted payload; distinguishes a real rewrite from a `touch`. */
function hashText(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Monotonic-ish backoff used while another writer owns the lock. */
function lockRetryDelay() {
  return LOCK_RETRY_MIN_MS
    + Math.floor(Math.random() * (LOCK_RETRY_MAX_MS - LOCK_RETRY_MIN_MS + 1));
}

async function writeFileAtomic(file, text) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tmp, text, 'utf8');
  try {
    await fsp.rename(tmp, file);
    return;
  } catch {
    // Windows can refuse to replace a file that another handle still owns.
    try {
      await fsp.rm(file, { force: true });
      await fsp.rename(tmp, file);
      return;
    } catch {
      await fsp.writeFile(file, text, 'utf8');
      await fsp.rm(tmp, { force: true }).catch(() => {});
    }
  }
}

/**
 * The single owner of todo state for one data file.
 *
 * Concurrency: mutations are synchronous on the in-memory map and then
 * serialized through one write chain, so the persisted file always reflects a
 * complete, ordered sequence of operations. Cross-process writers are guarded
 * by a `<dataFile>.lock` file: every write acquires the lock, re-reads the file
 * when its mtime/size/hash changed underneath us, merges the foreign records
 * (newest `updatedAt` wins for the same id, locally deleted ids stay deleted
 * via tombstones) and only then replaces the file. A failed write keeps the
 * in-memory change and is retried by the next write; the failure is surfaced
 * as a notice and in `describe()`.
 *
 * `lockTimeoutMs` / `staleLockMs` are optional tuning knobs for tests; the
 * defaults are the production values (about 2s to acquire a lock, a lock file
 * older than 10s is considered stale).
 */
export class TodoStore {
  #todos = new Map();
  #loadPromise = null;
  #persistChain = Promise.resolve();
  #loadNotices = [];
  #pendingNotices = [];
  #lastPersistError = null;
  #lockHandle = null;
  /** Ids deleted by this instance; never resurrected by a disk merge. */
  #tombstones = new Set();
  /** Known on-disk state: mtime/size/hash, or nulls when the file is absent. */
  #knownMtimeMs = null;
  #knownSize = null;
  #knownHash = null;
  #diskStateKnown = false;

  constructor(options = {}) {
    const { dataFile } = options;
    if (typeof dataFile !== 'string' || dataFile.trim() === '') {
      throw new TypeError('TodoStore requires a non-empty `dataFile`');
    }
    this.dataFile = path.resolve(dataFile);
    this.now = typeof options.now === 'function' ? options.now : () => Date.now();
    this.logger = options.logger ?? null;
    this.disposed = false;
    this.lockTimeoutMs = Number.isFinite(options.lockTimeoutMs) && options.lockTimeoutMs > 0
      ? options.lockTimeoutMs
      : DEFAULT_LOCK_TIMEOUT_MS;
    this.staleLockMs = Number.isFinite(options.staleLockMs) && options.staleLockMs > 0
      ? options.staleLockMs
      : DEFAULT_STALE_LOCK_MS;
  }

  get loaded() {
    return this.#loadPromise !== null;
  }

  get size() {
    return this.#todos.size;
  }

  #warn(message) {
    if (this.logger && typeof this.logger.warn === 'function') {
      this.logger.warn(message);
    }
  }

  /**
   * Record one repair/exception notice: kept once in the diagnostic history and
   * queued once for delivery to the next `list()` caller, so a repair is shown
   * to the user exactly once instead of on every refresh.
   */
  #note(message) {
    if (!this.#loadNotices.includes(message)) {
      this.#loadNotices.push(message);
      this.#pendingNotices.push(message);
    }
  }

  #takePendingNotices() {
    const notices = this.#pendingNotices.slice();
    this.#pendingNotices.length = 0;
    return notices;
  }

  /**
   * Queue one event notice (a merge from another instance, for example):
   * unlike `#note`, the same message is delivered again on every occurrence,
   * while the diagnostic history still keeps it once.
   */
  #noteEvent(message) {
    if (!this.#loadNotices.includes(message)) {
      this.#loadNotices.push(message);
    }
    this.#pendingNotices.push(message);
  }

  async load() {
    if (this.#loadPromise === null) {
      this.#loadPromise = this.#load();
    }
    return this.#loadPromise;
  }

  async #load() {
    // Stat before reading: if another writer replaces the file between the two
    // calls we only ever see an older mtime, so the next write detects the
    // change and re-reads instead of missing a foreign update.
    let stat = null;
    try {
      stat = await fsp.stat(this.dataFile);
    } catch {
      /* missing or unreadable: the read below reports it */
    }
    let text;
    try {
      text = await fsp.readFile(this.dataFile, 'utf8');
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        this.#forgetDiskState();
      } else {
        this.#note(`读取数据文件失败：${error.message}`);
        this.#warn(`todo-time-log: read failed: ${error.message}`);
      }
      return { ok: true, notices: this.#loadNotices.slice() };
    }
    this.#adoptDiskState(stat, text);

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      await this.#archiveCorrupt('json');
      this.#forgetDiskState();
      this.#note('数据文件不是合法 JSON，已备份原文件并重建为空列表');
      this.#warn(`todo-time-log: corrupt data file: ${error.message}`);
      return { ok: true, notices: this.#loadNotices.slice() };
    }

    const envelopeVersion = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed.version
      : undefined;
    if (typeof envelopeVersion === 'number' && !SUPPORTED_STORE_VERSIONS.includes(envelopeVersion)) {
      await this.#archiveCorrupt(`version-${envelopeVersion}`);
      this.#forgetDiskState();
      this.#note(`数据文件版本 ${envelopeVersion} 不受支持，已备份原文件并重建为空列表`);
      return { ok: true, notices: this.#loadNotices.slice() };
    }
    if (envelopeVersion === 1) {
      this.#note('数据已从版本 1 迁移到版本 5（新增项目分类、文件引用、优先级与类型字段）');
    } else if (envelopeVersion === 2) {
      this.#note('数据已从版本 2 迁移到版本 5（新增工作区文件引用、优先级与类型字段）');
    } else if (envelopeVersion === 3) {
      this.#note('数据已从版本 3 迁移到版本 5（新增优先级与类型字段）');
    } else if (envelopeVersion === 4) {
      this.#note('数据已从版本 4 迁移到版本 5（新增类型字段）');
    }

    const rows = Array.isArray(parsed) ? parsed : (parsed && parsed.todos);
    if (!Array.isArray(rows)) {
      // Valid JSON, wrong shape: archive before the next write replaces it,
      // otherwise a recognisable-but-misplaced list would be lost silently.
      await this.#archiveCorrupt('shape');
      this.#forgetDiskState();
      this.#note('数据文件结构异常，已备份原文件并重建为空列表');
      return { ok: true, notices: this.#loadNotices.slice() };
    }

    const seen = new Set();
    let dropped = 0;
    for (const row of rows) {
      const { todo, notices } = normalizeTodo(row, { now: this.now() });
      for (const notice of notices) {
        this.#note(notice);
      }
      if (todo === null) {
        dropped += 1;
        continue;
      }
      if (seen.has(todo.id)) {
        todo.id = makeTodoId(this.now());
        this.#note('存在重复 id 的待办记录，已为后者重新生成 id');
      }
      seen.add(todo.id);
      this.#todos.set(todo.id, todo);
    }
    if (dropped > 0) {
      this.#note(`已丢弃 ${dropped} 条非法待办记录`);
    }
    return { ok: true, notices: this.#loadNotices.slice() };
  }

  async #ensureLoaded() {
    await this.load();
  }

  async #archiveCorrupt(reason) {
    const archived = `${this.dataFile}.corrupt-${reason}-${Date.now()}`;
    try {
      await fsp.rename(this.dataFile, archived);
      this.#warn(`todo-time-log: archived corrupt data file to ${archived}`);
    } catch {
      try {
        await fsp.rm(this.dataFile, { force: true });
      } catch {
        /* best effort: an unreadable file will be overwritten on the next write */
      }
    }
  }

  /** Adopt the on-disk state we just read or wrote as the merge baseline. */
  #adoptDiskState(stat, text) {
    this.#knownMtimeMs = stat ? stat.mtimeMs : null;
    this.#knownSize = stat ? stat.size : null;
    this.#knownHash = hashText(text);
    this.#diskStateKnown = true;
  }

  /** The data file is known to be absent (never written or archived as corrupt). */
  #forgetDiskState() {
    this.#knownMtimeMs = null;
    this.#knownSize = null;
    this.#knownHash = null;
    this.#diskStateKnown = true;
  }

  /**
   * Acquire the per-file writer lock. `wx` (create-exclusive) guarantees a
   * single creator; a lock file older than `staleLockMs` is assumed to belong
   * to a crashed writer and is cleaned up once, then the acquisition retries.
   */
  async #acquireLock() {
    const lockPath = `${this.dataFile}.lock`;
    await fsp.mkdir(path.dirname(this.dataFile), { recursive: true });
    const deadline = Date.now() + this.lockTimeoutMs;
    let staleLockCleaned = false;
    for (;;) {
      try {
        const handle = await fsp.open(lockPath, 'wx');
        try {
          await handle.writeFile(`${process.pid} ${new Date().toISOString()}\n`, 'utf8');
        } catch {
          /* the lock's existence is what matters, not its content */
        }
        this.#lockHandle = handle;
        return;
      } catch (error) {
        if (!error || error.code !== 'EEXIST') {
          throw new Error(`无法创建数据文件锁：${error?.message ?? String(error)}`);
        }
      }
      if (!staleLockCleaned) {
        try {
          const lockStat = await fsp.stat(lockPath);
          if (Date.now() - lockStat.mtimeMs > this.staleLockMs) {
            staleLockCleaned = true;
            this.#warn(`todo-time-log: removing stale lock file ${lockPath}`);
            await fsp.rm(lockPath, { force: true });
            continue;
          }
        } catch (statError) {
          if (statError && statError.code === 'ENOENT') {
            continue; // released between the failed open and the stat
          }
        }
      }
      if (Date.now() >= deadline) {
        throw new Error(`获取数据文件锁超时（${this.lockTimeoutMs}ms）：${lockPath}`);
      }
      await delay(lockRetryDelay());
    }
  }

  async #releaseLock() {
    const handle = this.#lockHandle;
    this.#lockHandle = null;
    if (handle === null) return;
    try {
      await handle.close();
    } catch {
      /* an already-closed handle must not mask the write result */
    }
    try {
      await fsp.rm(`${this.dataFile}.lock`, { force: true });
    } catch (error) {
      this.#warn(`todo-time-log: could not remove lock file: ${error.message}`);
    }
  }

  /**
   * Merge records another instance wrote since our last known state. Runs while
   * holding the write lock, so the snapshot serialized afterwards is the union
   * of both instances' state.
   *
   * Corrupt data is never archived here (`load` already archived it once) and
   * never merged: the caller still writes its own snapshot, which matches the
   * previous overwrite-on-next-write behavior.
   */
  async #mergeIfDiskChanged() {
    if (!this.#diskStateKnown) return;
    let stat;
    try {
      stat = await fsp.stat(this.dataFile);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        this.#forgetDiskState();
        return;
      }
      this.#note(`无法检查数据文件是否被其他实例修改，本次未合并：${error.message}`);
      return;
    }
    if (stat.mtimeMs === this.#knownMtimeMs && stat.size === this.#knownSize) {
      return;
    }

    let text;
    try {
      text = await fsp.readFile(this.dataFile, 'utf8');
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        this.#forgetDiskState();
        return;
      }
      this.#note(`检测到其他实例的写入，但重新读取数据文件失败，本次未合并：${error.message}`);
      return;
    }
    if (hashText(text) === this.#knownHash) {
      // Content unchanged (e.g. an mtime-only touch): adopt the new stat.
      this.#adoptDiskState(stat, text);
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      this.#note('检测到其他实例的写入，但磁盘数据不是合法 JSON，本次未合并（保留现有数据并照常写入）');
      return;
    }
    const envelopeVersion = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed.version
      : undefined;
    if (typeof envelopeVersion === 'number' && !SUPPORTED_STORE_VERSIONS.includes(envelopeVersion)) {
      this.#note(`检测到其他实例的写入，但磁盘数据版本 ${envelopeVersion} 不受支持，本次未合并（保留现有数据并照常写入）`);
      return;
    }
    const rows = Array.isArray(parsed) ? parsed : (parsed && parsed.todos);
    if (!Array.isArray(rows)) {
      this.#note('检测到其他实例的写入，但磁盘数据结构异常，本次未合并（保留现有数据并照常写入）');
      return;
    }

    let added = 0;
    let replaced = 0;
    let dropped = 0;
    let overflow = 0;
    const seen = new Set();
    for (const row of rows) {
      const { todo } = normalizeTodo(row, { now: this.now() });
      if (todo === null || seen.has(todo.id)) {
        dropped += 1;
        continue;
      }
      seen.add(todo.id);
      if (this.#tombstones.has(todo.id)) continue;
      const mine = this.#todos.get(todo.id);
      if (!mine) {
        if (this.#todos.size >= MAX_TODOS) {
          overflow += 1;
          continue;
        }
        this.#todos.set(todo.id, todo);
        added += 1;
        continue;
      }
      const mineMs = parseTimestamp(mine.updatedAt);
      const diskMs = parseTimestamp(todo.updatedAt);
      if (diskMs !== null && (mineMs === null || diskMs > mineMs)) {
        this.#todos.set(todo.id, todo);
        replaced += 1;
      }
    }
    const merged = added + replaced;
    if (merged > 0) {
      this.#noteEvent(overflow > 0
        ? `检测到其他实例的写入，已合并 ${merged} 条（另有 ${overflow} 条超出数量上限未合并）`
        : `检测到其他实例的写入，已合并 ${merged} 条`);
    }
    if (dropped > 0) {
      this.#note(`合并其他实例的数据时丢弃 ${dropped} 条非法待办记录`);
    }
  }

  serialize() {
    return JSON.stringify(
      {
        version: STORE_VERSION,
        updatedAt: nowIso(this.now()),
        todos: [...this.#todos.values()],
      },
      null,
      2,
    );
  }

  #persist() {
    const write = async () => {
      await this.#acquireLock();
      try {
        await this.#mergeIfDiskChanged();
        const text = this.serialize();
        await writeFileAtomic(this.dataFile, text);
        let stat = null;
        try {
          stat = await fsp.stat(this.dataFile);
        } catch {
          /* unknown mtime: the next write re-reads and the hash skips the merge */
        }
        this.#adoptDiskState(stat, text);
        this.#lastPersistError = null;
      } finally {
        await this.#releaseLock();
      }
    };
    this.#persistChain = this.#persistChain.then(write, write);
    return this.#persistChain;
  }

  async #commit(todo, notices) {
    const next = [...notices];
    try {
      await this.#persist();
    } catch (error) {
      this.#lastPersistError = error?.message ?? String(error);
      next.push(`数据已更新但写入磁盘失败，将在下次写入时重试：${this.#lastPersistError}`);
      this.#warn(`todo-time-log: persist failed: ${this.#lastPersistError}`);
    }
    // A merge may have replaced this record with a newer foreign version while
    // the write was in flight, so report what actually lives in memory now.
    const current = this.#todos.get(todo.id) ?? todo;
    return { ok: true, todo: current, notices: next, persisted: this.#lastPersistError === null };
  }

  async list(options = {}) {
    await this.#ensureLoaded();
    const all = [...this.#todos.values()];
    const filter = FILTERS.includes(options.filter) ? options.filter : 'all';
    const sortBy = SORT_FIELDS.includes(options.sortBy) ? options.sortBy : 'createdAt';
    const direction = options.direction === 'asc' ? 'asc' : 'desc';
    // undefined/null = every project; '' = only 未分类; anything else must be a string.
    const hasProjectFilter = options.project !== undefined && options.project !== null;
    if (hasProjectFilter && typeof options.project !== 'string') {
      return failure(ERROR_CODES.PROJECT_INVALID, '项目分类过滤参数必须是字符串');
    }
    const projectFiltered = hasProjectFilter
      ? all.filter((todo) => (todo.project ?? UNCATEGORIZED_PROJECT) === normalizeProjectName(options.project))
      : all;
    const filtered = filterTodos(projectFiltered, filter);
    return {
      ok: true,
      todos: sortTodos(filtered, { sortBy, direction }),
      stats: computeStats(all),
      projects: computeProjects(all),
      filter,
      sortBy,
      direction,
      project: hasProjectFilter ? normalizeProjectName(options.project) : null,
      notices: this.#takePendingNotices(),
    };
  }

  /** Project/category summary over all todos, for the project picker. */
  async projectSummary() {
    await this.#ensureLoaded();
    return { ok: true, projects: computeProjects([...this.#todos.values()]) };
  }

  async get(id) {
    await this.#ensureLoaded();
    const todo = typeof id === 'string' ? this.#todos.get(id.trim()) : undefined;
    if (!todo) return failure(ERROR_CODES.NOT_FOUND, `待办不存在：${String(id)}`);
    return { ok: true, todo };
  }

  async create(input = {}) {
    await this.#ensureLoaded();
    const checked = validateTitle(input.title);
    if (!checked.ok) return checked;
    const filesCheck = validateFiles(input.files);
    if (!filesCheck.ok) return filesCheck;
    const projectCheck = validateProject(input.project);
    if (!projectCheck.ok) return projectCheck;
    const priorityCheck = validatePriority(input.priority);
    if (!priorityCheck.ok) return priorityCheck;
    const typeCheck = validateType(input.type);
    if (!typeCheck.ok) return typeCheck;
    const hasProject = input.project !== undefined && input.project !== null;
    const project = hasProject || filesCheck.files.length === 0
      ? projectCheck.project
      : deriveProjectFromFiles(filesCheck.files);
    if (this.#todos.size >= MAX_TODOS) {
      return failure(ERROR_CODES.TOO_MANY_TODOS, `待办数量已达上限 ${MAX_TODOS}`);
    }
    const createdAt = nowIso(this.now());
    const todo = {
      id: makeTodoId(this.now()),
      title: checked.title,
      project,
      files: filesCheck.files,
      status: TODO_STATUS.PENDING,
      priority: priorityCheck.priority,
      type: typeCheck.type,
      createdAt,
      completedAt: null,
      updatedAt: createdAt,
    };
    this.#tombstones.delete(todo.id);
    this.#todos.set(todo.id, todo);
    return this.#commit(todo, []);
  }

  async complete(id, options = {}) {
    await this.#ensureLoaded();
    const todo = typeof id === 'string' ? this.#todos.get(id.trim()) : undefined;
    if (!todo) return failure(ERROR_CODES.NOT_FOUND, `待办不存在：${String(id)}`);
    if (todo.status === TODO_STATUS.COMPLETED) {
      return failure(
        ERROR_CODES.ALREADY_COMPLETED,
        `该待办已完成（完成时间 ${formatLocalDateTime(todo.completedAt)}），无需重复操作`,
      );
    }
    const notices = [];
    const createdAtMs = parseTimestamp(todo.createdAt);
    let completedMs = parseTimestamp(options.at);
    if (completedMs === null) completedMs = this.now();
    if (createdAtMs !== null && completedMs < createdAtMs) {
      completedMs = createdAtMs;
      notices.push('完成时间早于创建时间，已修正为创建时间');
    }
    todo.status = TODO_STATUS.COMPLETED;
    todo.completedAt = toIsoString(completedMs);
    todo.updatedAt = nowIso(this.now());
    return this.#commit(todo, notices);
  }

  async uncomplete(id) {
    await this.#ensureLoaded();
    const todo = typeof id === 'string' ? this.#todos.get(id.trim()) : undefined;
    if (!todo) return failure(ERROR_CODES.NOT_FOUND, `待办不存在：${String(id)}`);
    if (todo.status === TODO_STATUS.PENDING) {
      return failure(ERROR_CODES.ALREADY_PENDING, '该待办尚未完成，无需取消完成');
    }
    todo.status = TODO_STATUS.PENDING;
    todo.completedAt = null;
    todo.updatedAt = nowIso(this.now());
    return this.#commit(todo, ['已取消完成，并清空完成时间']);
  }

  async update(id, input = {}) {
    await this.#ensureLoaded();
    const todo = typeof id === 'string' ? this.#todos.get(id.trim()) : undefined;
    if (!todo) return failure(ERROR_CODES.NOT_FOUND, `待办不存在：${String(id)}`);
    let changed = false;
    if (input.title !== undefined) {
      const checked = validateTitle(input.title);
      if (!checked.ok) return checked;
      if (checked.title !== todo.title) {
        todo.title = checked.title;
        changed = true;
      }
    }
    if (input.project !== undefined) {
      const projectCheck = validateProject(input.project);
      if (!projectCheck.ok) return projectCheck;
      if (projectCheck.project !== (todo.project ?? UNCATEGORIZED_PROJECT)) {
        todo.project = projectCheck.project;
        changed = true;
      }
    }
    if (input.files !== undefined) {
      const filesCheck = validateFiles(input.files);
      if (!filesCheck.ok) return filesCheck;
      const current = Array.isArray(todo.files) ? todo.files : [];
      const sameLength = current.length === filesCheck.files.length;
      if (!sameLength || current.some((file, index) => file !== filesCheck.files[index])) {
        todo.files = filesCheck.files;
        changed = true;
      }
    }
    if (input.priority !== undefined) {
      const priorityCheck = validatePriority(input.priority);
      if (!priorityCheck.ok) return priorityCheck;
      if (priorityCheck.priority !== (todo.priority ?? PRIORITY_UNSET)) {
        todo.priority = priorityCheck.priority;
        changed = true;
      }
    }
    if (input.type !== undefined) {
      const typeCheck = validateType(input.type);
      if (!typeCheck.ok) return typeCheck;
      if (typeCheck.type !== (todo.type ?? TYPE_UNSET)) {
        todo.type = typeCheck.type;
        changed = true;
      }
    }
    if (!changed) {
      return { ok: true, todo, notices: ['内容未变化，未做修改'], persisted: true, unchanged: true };
    }
    todo.updatedAt = nowIso(this.now());
    return this.#commit(todo, []);
  }

  async remove(id) {
    await this.#ensureLoaded();
    const key = typeof id === 'string' ? id.trim() : '';
    if (!this.#todos.has(key)) {
      return failure(ERROR_CODES.NOT_FOUND, `待办不存在：${String(id)}`);
    }
    this.#todos.delete(key);
    // Remember the deletion so a disk snapshot written by a stale peer cannot
    // merge this id back into memory (the next write also drops it on disk).
    this.#tombstones.add(key);
    const notices = [];
    try {
      await this.#persist();
    } catch (error) {
      // The deletion already holds in memory and the next write persists the
      // whole snapshot, so this is a retryable warning rather than a failed
      // operation — returning an error here would contradict what the UI sees.
      this.#lastPersistError = error?.message ?? String(error);
      notices.push(`删除已生效，但写入磁盘失败，将在下次写入时重试：${this.#lastPersistError}`);
      this.#warn(`todo-time-log: persist failed: ${this.#lastPersistError}`);
    }
    return { ok: true, deleted: key, notices, persisted: this.#lastPersistError === null };
  }

  describe() {
    return {
      dataFile: this.dataFile,
      loaded: this.loaded,
      count: this.#todos.size,
      lastPersistError: this.#lastPersistError,
      loadNotices: this.#loadNotices.slice(),
      version: STORE_VERSION,
      filesWithRefs: [...this.#todos.values()].filter((todo) => (todo.files ?? []).length > 0).length,
    };
  }

  async dispose() {
    this.disposed = true;
    try {
      await this.#persistChain;
    } catch {
      /* last write already reported */
    }
  }
}
