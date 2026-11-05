/**
 * Host half of 「待办时间日志」 (dsh-todo-time-log).
 *
 * Responsibilities:
 *   1. Own exactly one TodoStore instance (see `store.js`) for the plugin data file.
 *   2. Expose the same operations through two callers, per the Harness rule
 *      "one operation, two callers":
 *        - the Web UI, over `POST /api/dsh-todo-time-log/*` (registered on `webServer`);
 *        - the agent, through the single `todo_time_log` tool (registered on `tools`).
 *      Both call `executeTodoAction()`, so the two paths cannot drift.
 *   3. Read repair/exception notices produced by the store and pass them through.
 *
 * The module is plain Node ESM with no `@deepseek-ai/*` imports, so it loads the
 * same way from the workspace bundle and from an installed package.
 */

import os from 'node:os';
import path from 'node:path';
import {
  TodoStore,
  TODO_STATUS,
  FILTERS,
  SORT_FIELDS,
  PRIORITIES,
  TYPES,
  MAX_FILES,
  MAX_PROJECT_LENGTH,
  normalizeFilePath,
  normalizeProjectName,
} from './store.js';
import { formatLocalDateTime, TIME_FORMAT, EMPTY_TIME } from './time.js';
import { parseQuickAdd, parseQuickAddLine, hasQuickAddMarkers } from './parse.js';
import { createFileIndex } from './files.js';

/**
 * A todo record exactly as `store.js` persists it (see the data-model comment
 * at the top of that module). `project` is `''` for 未分类, `priority`/`type`
 * are `''` when unset, and `completedAt` is non-null exactly while completed.
 *
 * @typedef {object} Todo
 * @property {string} id
 * @property {string} title
 * @property {string} project
 * @property {string[]} files
 * @property {'pending' | 'completed'} status
 * @property {string} priority
 * @property {string} type
 * @property {string} createdAt
 * @property {string | null} completedAt
 * @property {string} updatedAt
 */

/**
 * Display-only fields `decorateTodo()` adds on top of a stored todo.
 *
 * @typedef {object} DecoratedFields
 * @property {string} projectLabel
 * @property {string} priorityLabel
 * @property {string} typeLabel
 * @property {number} fileCount
 * @property {string[]} fileNames
 * @property {string} createdAtLocal
 * @property {string} completedAtLocal
 * @property {string} updatedAtLocal
 * @property {string} statusLabel
 */

/** @typedef {Todo & DecoratedFields} DecoratedTodo */

/**
 * One row of the per-category summary (`store.computeProjects()`).
 *
 * @typedef {object} ProjectGroup
 * @property {string} name
 * @property {number} count
 * @property {number} pending
 * @property {number} completed
 */

/**
 * List statistics (`store.computeStats()`).
 *
 * @typedef {object} TodoStats
 * @property {number} total
 * @property {number} pending
 * @property {number} completed
 */

/**
 * A quick-add line that produced no title and was therefore not created.
 *
 * @typedef {object} SkippedLine
 * @property {string} line
 * @property {string} reason
 */

/**
 * One quick-add line that the store rejected.
 *
 * @typedef {object} QuickAddError
 * @property {string} title
 * @property {string} [code]
 * @property {string} [message]
 */

/**
 * The union of every field `executeTodoAction()` understands. Every action reads
 * only the fields it documents; all are optional because both the HTTP body and
 * the tool arguments are untrusted JSON (a missing field must fall back to the
 * store default rather than throw).
 *
 * @typedef {object} TodoActionPayload
 * @property {string} [action]           tool: list / get / create / …
 * @property {string} [id]
 * @property {string} [title]
 * @property {string | null} [project]   '' = 未分类; null = not supplied
 * @property {string[] | null} [files]
 * @property {string | null} [priority]
 * @property {string | null} [type]
 * @property {string} [text]             quick_add: raw natural language
 * @property {string} [filter]           list: all / pending / completed
 * @property {string} [sortBy]           list: createdAt / completedAt / …
 * @property {string} [direction]        list: asc / desc
 * @property {string | number} [at]      complete: explicit completion time
 * @property {string} [workspace]        /files, /projects, /quick-add root
 */

/**
 * Result envelope of `executeTodoAction()`. Success and failure share one shape
 * because both the HTTP route and the tool render either branch; every payload
 * field is optional and present only for the action that produced it.
 *
 * @typedef {object} TodoResult
 * @property {boolean} ok
 * @property {string} [code]
 * @property {string} [message]
 * @property {string[]} [notices]
 * @property {Todo[]} [todos]
 * @property {TodoStats} [stats]
 * @property {ProjectGroup[]} [projects]
 * @property {string} [filter]
 * @property {string} [sortBy]
 * @property {string} [direction]
 * @property {string | null} [project]
 * @property {string} [timeFormat]
 * @property {Todo} [todo]
 * @property {string} [deleted]
 * @property {Todo[]} [created]
 * @property {SkippedLine[]} [skipped]
 * @property {QuickAddError[]} [errors]
 * @property {number} [parsed]
 * @property {number} [count]
 * @property {string} [dataFile]
 * @property {boolean} [persisted]
 * @property {{ code?: string, message?: string }} [error]
 */

/**
 * Result of `runQuickAdd()`: a result envelope whose payload is the quick-add
 * outcome instead of a single todo.
 *
 * @typedef {object} QuickAddResult
 * @property {boolean} ok
 * @property {string} [code]
 * @property {string} [message]
 * @property {Todo[]} [created]
 * @property {SkippedLine[]} [skipped]
 * @property {QuickAddError[]} [errors]
 * @property {number} [parsed]
 * @property {string | null} [workspaceRoot]
 */

/**
 * The cached workspace file index returned by `createFileIndex()`.
 *
 * @typedef {object} FileIndex
 * @property {(request?: { root?: string, query?: string, limit?: number }) => Promise<{ root: string, files: string[], total: number, truncated: boolean }>} list
 * @property {(request?: { root?: string, limit?: number }) => Promise<string[]>} listDirectories
 * @property {(explicitRoot?: string) => Promise<Set<string>>} knownFileSet
 * @property {() => void} invalidate
 */

/**
 * Row config accepted by `apply()` (see `cordis.patch.yml`).
 *
 * @typedef {object} PluginConfig
 * @property {string} [dataFile]
 * @property {string} [workspaceRoot]
 */

/**
 * The subset of the Cordis plugin context this module touches. Every member is
 * optional so the plugin still loads on a build that lacks one of the services.
 *
 * @typedef {object} PluginContext
 * @property {(name: string) => any} [get]
 * @property {(callback: Function) => any} [effect]
 * @property {(names: string[], callback: Function) => void} [inject]
 * @property {(name: string) => any} [logger]
 * @property {{ register: Function }} [webServer]
 * @property {{ register: Function }} [tools]
 * @property {{ register: Function }} [commands]
 */

/**
 * A slash-command invocation as passed by the Harness.
 *
 * @typedef {object} CommandInvocation
 * @property {string} [rawInput]
 * @property {Array<{ type?: string, attachment?: { name?: string } }>} [attachments]
 */

/**
 * Options of `createHttpHandler()`: every collaborator is injectable so the
 * route can be tested without a live profile.
 *
 * @typedef {object} HttpHandlerOptions
 * @property {FileIndex | null} [fileIndex]
 * @property {() => string} [getWorkspaceRoot]
 * @property {string} [workspaceRoot]
 * @property {() => Array<{ path: string, title: string, source: string }>} [listWorkspaces]
 */

export const name = 'dsh-todo-time-log';

/**
 * Declared dependencies. Both are always present in a Web profile; declaring
 * them here keeps the plugin `pending` (rather than crashing) in a profile
 * without a Web server or the tool registry.
 *
 * NOTE (cordis-version): the Loader accepts a plain array of service names. An
 * object form like `{ optional: [...] }` is read as a dependency literally named
 * "optional" by the current build, which is why the array form is used.
 */
export const inject = ['webServer', 'tools'];

export const ROUTE_PREFIX = '/api/dsh-todo-time-log';
export const TOOL_NAME = 'todo_time_log';
/** CRUD actions shared by the HTTP route and the agent tool. */
export const CRUD_ACTIONS = Object.freeze([
  'list',
  'get',
  'create',
  'complete',
  'uncomplete',
  'update',
  'delete',
  'health',
]);

/**
 * Tool-facing action list. `quick_add` is the only addition: it takes raw
 * natural language and reuses the same parser as the UI panel and `/todo`.
 */
export const ACTIONS = Object.freeze([...CRUD_ACTIONS, 'quick_add']);

export const QUICK_ADD_PATH = '/quick-add';
export const FILES_PATH = '/files';
export const COMMAND_NAME = 'todo';

/**
 * Row config defaults.
 *
 * TODO(config-schema): this Harness build rejected a plain JSON-Schema object
 * exported as `Config` (the row reported `status: "unsupported"`, and activation
 * failed with `Cannot read properties of undefined (reading 'validate')`), so the
 * schema export is deliberately omitted. `apply()` still reads the row config
 * (`cordis.patch.yml` → `config: { dataFile: ... }`) defensively, and the
 * environment variable `DSH_TODO_TIME_LOG_DATA` covers the same knob.
 *
 * To restore a configuration page, export whatever schema form the target build
 * expects, e.g.:
 *   import { z } from 'zod';
 *   export const Config = z.object({ dataFile: z.string().default('') });
 * and add the package dependency. Nothing else in this plugin needs to change.
 */
export const DEFAULT_CONFIG = Object.freeze({
  dataFile: '',
  workspaceRoot: '',
});

const MAX_BODY_BYTES = 1024 * 1024;

/** Tool/HTTP-facing priority enum: '' = 未设置 (default). */
export const PRIORITY_VALUES = Object.freeze(['', ...PRIORITIES]);
/** Chinese display labels for `decorateTodo().priorityLabel`. */
export const PRIORITY_LABELS = Object.freeze({ high: '高', medium: '中', low: '低' });
/** Tool/HTTP-facing type enum: '' = 未设置 (default). */
export const TYPE_VALUES = Object.freeze(['', ...TYPES]);
/** Chinese display labels for `decorateTodo().typeLabel`. */
export const TYPE_LABELS = Object.freeze({
  bug: '缺陷',
  feature: '新功能',
  improvement: '改进',
  question: '疑问',
  chore: '杂项',
  other: '其他',
});

function defaultBaseDir() {
  const profileDir = process.env.DSH_PROFILE_DIR;
  if (typeof profileDir === 'string' && profileDir.trim() !== '') return profileDir;
  return path.join(os.homedir(), '.dsh');
}

/**
 * Resolve the data file: row config > env override > profile-scoped default.
 *
 * @param {PluginConfig} [config]
 * @returns {string}
 */
export function resolveDataFile(config = {}) {
  const configured = typeof config?.dataFile === 'string' ? config.dataFile.trim() : '';
  if (configured !== '') {
    return path.isAbsolute(configured) ? configured : path.resolve(defaultBaseDir(), configured);
  }
  const fromEnv = process.env.DSH_TODO_TIME_LOG_DATA;
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') return path.resolve(fromEnv.trim());
  return path.join(defaultBaseDir(), 'todo-time-log', 'todos.json');
}

/**
 * Candidate workspaces for `@file` references, best first:
 *   1. the row config / environment override
 *   2. the working directory of the newest live Session (the conversation the
 *      user is looking at)
 *   3. the durable workspace registry, exact process directory first, then the
 *      most recently updated entry
 *   4. the process directory
 *
 * The panel is not Session-bound, so this list is also what `/workspaces`
 * exposes and what `/files` accepts an explicit `workspace` from: a client can
 * only ask for a root that is already a known workspace.
 *
 * @param {PluginContext} ctx
 * @param {PluginConfig} [config]
 * @returns {Array<{ path: string, title: string, source: string }>}
 */
export function listWorkspaceCandidates(ctx, config = {}) {
  const seen = new Map();
  const push = (candidatePath, title, source) => {
    if (typeof candidatePath !== 'string' || candidatePath.trim() === '') return;
    let resolved;
    try {
      resolved = path.resolve(candidatePath);
    } catch {
      return;
    }
    if (seen.has(resolved)) return;
    seen.set(resolved, {
      path: resolved,
      title: typeof title === 'string' && title.trim() !== '' ? title : path.basename(resolved),
      source,
    });
  };

  const configured = typeof config?.workspaceRoot === 'string' ? config.workspaceRoot.trim() : '';
  if (configured !== '') {
    push(
      path.isAbsolute(configured) ? configured : path.resolve(defaultBaseDir(), configured),
      path.basename(configured),
      'config',
    );
  }

  try {
    const sessions = typeof ctx?.get === 'function' ? ctx.get('sessions') : undefined;
    if (sessions && typeof sessions.list === 'function') {
      // "The workspace the user is looking at" is the live Session with the most
      // recent event, not the newest one by creation time: this conversation can
      // be older than a later conversation in another workspace. Subagent
      // Sessions are skipped because they inherit a parent's directory.
      const lastEventTime = (session) => {
        try {
          const seq = typeof session?.seq === 'number' ? session.seq : 0;
          const last = session.eventAt(seq) ?? (seq > 0 ? session.eventAt(seq - 1) : undefined);
          if (last && typeof last.time === 'number') return last.time;
        } catch {
          /* fall through */
        }
        const createdAt = session?.header?.createdAt;
        return typeof createdAt === 'number' ? createdAt : 0;
      };
      const ranked = sessions.list()
        .filter((session) => session?.header?.origin !== 'subagent')
        .sort((left, right) => lastEventTime(right) - lastEventTime(left));
      for (const session of ranked) {
        const cwd = session?.header?.cwd;
        if (typeof cwd === 'string' && cwd !== '') push(cwd, path.basename(cwd), 'session');
      }
    }
  } catch {
    /* optional service */
  }

  try {
    const registry = typeof ctx?.get === 'function' ? ctx.get('workspaceRegistry') : undefined;
    if (registry && typeof registry.list === 'function') {
      const workspaces = registry.list();
      if (Array.isArray(workspaces) && workspaces.length > 0) {
        const cwd = process.cwd();
        const exact = workspaces.find((workspace) => workspace && workspace.path === cwd);
        if (exact) push(exact.path, exact.title, 'workspace');
        const ordered = workspaces
          .filter((workspace) => workspace && typeof workspace.path === 'string' && workspace.path !== '')
          .sort((left, right) => String(right.updatedAt ?? '').localeCompare(String(left.updatedAt ?? '')));
        for (const workspace of ordered) push(workspace.path, workspace.title, 'workspace');
      }
    }
  } catch {
    /* optional service */
  }

  if (seen.size === 0) push(process.cwd(), path.basename(process.cwd()), 'process');
  return [...seen.values()];
}

/**
 * The active workspace root: the first candidate.
 *
 * @param {PluginContext} ctx
 * @param {PluginConfig} [config]
 * @returns {string}
 */
export function resolveWorkspaceRoot(ctx, config = {}) {
  const candidates = listWorkspaceCandidates(ctx, config);
  return candidates[0]?.path ?? process.cwd();
}

/**
 * @param {PluginContext} ctx
 * @returns {{ debug: Function, info: Function, warn: Function, error: Function }}
 */
function createLogger(ctx) {
  const prefix = '[dsh-todo-time-log]';
  let sink = null;
  try {
    if (typeof ctx?.logger === 'function') sink = ctx.logger('dsh-todo-time-log');
  } catch {
    sink = null;
  }
  const emit = (level) => (...args) => {
    const target = sink && typeof sink[level] === 'function' ? sink : globalThis.console;
    const fn = typeof target?.[level] === 'function' ? target[level].bind(target) : console.log;
    fn(prefix, ...args);
  };
  return { debug: emit('debug'), info: emit('info'), warn: emit('warn'), error: emit('error') };
}

/**
 * The failure half of the result envelope.
 *
 * @param {string} code
 * @param {string} message
 * @returns {{ ok: false, code: string, message: string }}
 */
function failure(code, message) {
  return { ok: false, code, message };
}

/**
 * The single implementation of every operation. Both the HTTP route and the
 * agent tool call this; it never throws for expected user errors.
 *
 * @param {TodoStore} store
 * @param {string} action
 * @param {TodoActionPayload} [payload]
 * @returns {Promise<TodoResult>}
 */
export async function executeTodoAction(store, action, payload = {}) {
  /** @type {TodoActionPayload} */
  const body = payload && typeof payload === 'object' ? payload : {};
  switch (action) {
    case 'list': {
      const result = await store.list({
        filter: body.filter,
        sortBy: body.sortBy,
        direction: body.direction,
        project: body.project,
      });
      if (result.ok !== true) return result;
      return { ...result, timeFormat: TIME_FORMAT };
    }
    case 'get':
      return store.get(body.id);
    case 'create': {
      // Markers are accepted here too, so typing `写周报 #工作 @lib/a.ts` into the
      // plain form (or passing it through a tool call) cannot end up as title text.
      const rawTitle = typeof body.title === 'string' ? body.title : '';
      if (!hasQuickAddMarkers(rawTitle)) {
        return store.create({
          title: body.title,
          project: body.project,
          files: body.files,
          priority: body.priority,
          type: body.type,
        });
      }
      const parsed = parseQuickAddLine(rawTitle);
      // Markers written in the title are the most specific intent, so they win
      // over the form's picker; without a marker the picker value is used as-is.
      // Priority: explicit marker > a real picker value > (nothing, so the store
      // may still derive a category from the referenced files). An empty picker
      // means 未分类, which must not block file-based derivation.
      let project;
      if (parsed.project !== '') project = parsed.project;
      else if (body.project !== undefined && body.project !== null && body.project !== '') project = body.project;
      else project = undefined;
      // Same precedence for priority and type: a marker beats the picker.
      const priority = parsed.priority !== '' ? parsed.priority : body.priority;
      const type = parsed.type !== '' ? parsed.type : body.type;
      const files = parsed.files.length > 0
        ? parsed.files
        : (Array.isArray(body.files) && body.files.length > 0 ? body.files : undefined);
      return store.create({
        title: parsed.title === '' ? rawTitle : parsed.title,
        project,
        files,
        priority,
        type,
      });
    }
    case 'complete':
      return store.complete(body.id, { at: body.at });
    case 'uncomplete':
      return store.uncomplete(body.id);
    case 'update':
      // Each field is optional: pass `undefined` through so the store keeps the
      // current value instead of clearing it.
      return store.update(body.id, {
        title: body.title,
        project: body.project,
        files: body.files,
        priority: body.priority,
        type: body.type,
      });
    case 'delete':
      return store.remove(body.id);
    case 'health':
      return { ok: true, ...store.describe() };
    default:
      return failure('BAD_REQUEST', `未知操作：${String(action)}；可用操作：${ACTIONS.join(', ')}`);
  }
}

/**
 * Add the display-formatted local times a model-facing result needs.
 *
 * @param {Todo} todo
 * @returns {DecoratedTodo}
 */
export function decorateTodo(todo) {
  const files = Array.isArray(todo.files) ? todo.files : [];
  const priority = todo.priority ?? '';
  const type = todo.type ?? '';
  return {
    ...todo,
    project: todo.project ?? '',
    projectLabel: todo.project ? todo.project : '未分类',
    priority,
    priorityLabel: PRIORITY_LABELS[priority] ?? '',
    type,
    typeLabel: TYPE_LABELS[type] ?? '',
    files,
    fileCount: files.length,
    fileNames: files.map((file) => file.split('/').pop() ?? file),
    createdAtLocal: formatLocalDateTime(todo.createdAt),
    completedAtLocal: formatLocalDateTime(todo.completedAt, { dash: EMPTY_TIME }),
    updatedAtLocal: formatLocalDateTime(todo.updatedAt, { dash: EMPTY_TIME }),
    statusLabel: todo.status === TODO_STATUS.COMPLETED ? '已完成' : '未完成',
  };
}

/**
 * `【高】` / `【中】` / `【低】`; '' when no priority is set.
 *
 * @param {Todo} todo
 * @returns {string}
 */
function priorityTag(todo) {
  const label = PRIORITY_LABELS[todo?.priority] ?? '';
  return label === '' ? '' : `【${label}】`;
}

/**
 * `[分类] `; '' when the todo is uncategorized.
 *
 * @param {Todo} todo
 * @returns {string}
 */
function projectTag(todo) {
  return todo.project ? `[${todo.project}] ` : '';
}

/**
 * `｜文件 a、b`; '' when the todo references no file.
 *
 * @param {Todo} todo
 * @returns {string}
 */
function fileSuffix(todo) {
  const files = Array.isArray(todo.files) ? todo.files : [];
  if (files.length === 0) return '';
  return `｜文件 ${files.join('、')}`;
}

/**
 * Merge the three project/category suggestion sources into one ordered list for
 * the pickers (create form, inline edit, `#` autocomplete):
 *
 *   1. `used`       — categories already on todos, most used first
 *   2. `workspace`  — the registered workspaces (the projects in the sidebar)
 *   3. `folder`     — top-level folders of the selected workspace
 *
 * Names are de-duplicated case-insensitively and must fit the stored project
 * limit, so a suggestion is always immediately acceptable as a category.
 *
 * @param {{
 *   used?: Array<{ name: string, count?: number }>,
 *   workspaces?: Array<{ title?: string }>,
 *   folders?: string[],
 *   limit?: number,
 * }} [options]
 * @returns {Array<{ name: string, source: string, count: number }>}
 */
export function buildProjectSuggestions(options = {}) {
  const { used = [], workspaces = [], folders = [], limit = 80 } = options;
  const seen = new Map();
  const add = (name, source, count) => {
    const normalized = normalizeProjectName(name);
    if (normalized === '' || normalized.length > MAX_PROJECT_LENGTH) return;
    const key = normalized.toLocaleLowerCase();
    const existing = seen.get(key);
    if (existing) {
      if (typeof count === 'number' && count > 0) existing.count = (existing.count ?? 0) + count;
      return;
    }
    seen.set(key, { name: normalized, source, count: typeof count === 'number' ? count : 0 });
  };

  const orderedUsed = [...used]
    .filter((entry) => entry && typeof entry.name === 'string' && entry.name !== '')
    .sort((left, right) => (right.count ?? 0) - (left.count ?? 0));
  for (const entry of orderedUsed) add(entry.name, 'used', entry.count);
  for (const workspace of workspaces) add(workspace?.title, 'workspace');
  for (const folder of folders) add(folder, 'folder');

  return [...seen.values()].slice(0, limit);
}

/**
 * One implementation of 「自然语言 → 待办」, shared by:
 *   - POST /quick-add (the UI chat panel)
 *   - the `/todo` slash command
 *   - the agent tool's `quick_add` action
 *
 * `extraPriority` is the form-picker value: a `!high`-style marker in a line
 * always wins, otherwise the picker value applies to every created todo.
 * `extraType` follows the same fallback rule for `^bug`-style type markers.
 *
 * @param {TodoStore} store
 * @param {FileIndex | null} fileIndex
 * @param {string} text
 * @param {string} [workspaceRoot]
 * @param {string[]} [extraFiles]
 * @param {string} [extraPriority]
 * @param {string} [extraType]
 * @returns {Promise<QuickAddResult>}
 */
export async function runQuickAdd(store, fileIndex, text, workspaceRoot = '', extraFiles = [], extraPriority = '', extraType = '') {
  const raw = typeof text === 'string' ? text : '';
  if (raw.trim() === '') {
    return failure('BAD_REQUEST', '请提供待办内容，例如：新任务 写周报 #工作 @src/a.ts');
  }
  // Form-picker fallback: an explicit `!high` / `^bug` marker in the text always
  // wins, mirroring how `#分类` markers win over `body.project`.
  const fallbackPriority = typeof extraPriority === 'string' ? extraPriority : '';
  const fallbackType = typeof extraType === 'string' ? extraType : '';
  let knownFiles = new Set();
  if (fileIndex) {
    try {
      knownFiles = await fileIndex.knownFileSet(workspaceRoot);
    } catch {
      knownFiles = new Set();
    }
  }
  const { items, skipped } = parseQuickAdd(raw, { knownFiles });
  const inherited = Array.isArray(extraFiles)
    ? extraFiles.map((file) => normalizeFilePath(file)).filter((file) => file !== '')
    : [];
  /** @type {Todo[]} */
  const created = [];
  /** @type {QuickAddError[]} */
  const errors = [];
  for (const item of items) {
    const mergedFiles = [...new Set([...(item.files ?? []), ...inherited])].slice(0, MAX_FILES);
    /** @type {TodoResult} */
    const result = await store.create({
      title: item.title,
      project: item.project === '' ? undefined : item.project,
      files: mergedFiles,
      priority: (item.priority ?? '') !== '' ? item.priority : fallbackPriority,
      type: (item.type ?? '') !== '' ? item.type : fallbackType,
    });
    if (result.ok === true) created.push(result.todo);
    else errors.push({ title: item.title, code: result.code, message: result.message });
  }
  return {
    ok: true,
    created,
    skipped,
    errors,
    parsed: items.length,
    workspaceRoot: fileIndex ? undefined : null,
  };
}

/**
 * Map the slash command's file attachments onto workspace-relative paths, so
 * `/todo 写周报` with a file attached (or `@`-mentioned through the composer)
 * records a usable reference. A name that is already a relative path wins;
 * otherwise the first indexed file with the same basename is used.
 *
 * @param {CommandInvocation} invocation
 * @param {FileIndex | null} fileIndex
 * @param {string} workspaceRoot
 * @returns {Promise<string[]>}
 */
export async function resolveCommandAttachmentFiles(invocation, fileIndex, workspaceRoot) {
  const blocks = Array.isArray(invocation?.attachments) ? invocation.attachments : [];
  const names = blocks
    .filter((block) => block && block.type === 'file' && block.attachment && typeof block.attachment.name === 'string')
    .map((block) => block.attachment.name);
  if (names.length === 0 || !fileIndex) return [];
  let known = new Set();
  try {
    known = await fileIndex.knownFileSet(workspaceRoot);
  } catch {
    known = new Set();
  }
  const resolved = [];
  for (const name of names) {
    const normalized = normalizeFilePath(name);
    if (normalized !== '' && known.has(normalized)) {
      if (!resolved.includes(normalized)) resolved.push(normalized);
      continue;
    }
    const base = String(name).split(/[\\/]/).pop() ?? '';
    const match = [...known].find((file) => (file.split('/').pop() ?? '') === base);
    if (match && !resolved.includes(match)) resolved.push(match);
  }
  return resolved.slice(0, MAX_FILES);
}

const STATUS_LABEL = { pending: '未完成', completed: '已完成' };

/**
 * Render one result envelope as the model-facing text.
 *
 * @param {string} action
 * @param {TodoResult} value
 * @returns {string}
 */
export function renderTodoResult(action, value) {
  if (!value || value.ok !== true) {
    const code = value?.code ?? value?.error?.code ?? 'INTERNAL';
    const message = value?.message ?? value?.error?.message ?? '未知错误';
    return `操作失败（${code}）：${message}`;
  }
  const notices = Array.isArray(value.notices) && value.notices.length > 0
    ? `\n提示：${value.notices.join('；')}`
    : '';
  if (action === 'list') {
    const lines = [
      `待办时间日志（共 ${value.stats.total} 条：未完成 ${value.stats.pending} / 已完成 ${value.stats.completed}）`
      + `，筛选=${value.filter}，排序=${value.sortBy} ${value.direction}，时间格式 ${TIME_FORMAT}`,
    ];
    if (value.todos.length === 0) {
      lines.push('（没有符合条件的待办）');
    }
    if (Array.isArray(value.projects) && value.projects.length > 0) {
      lines.push(
        '分类：' + value.projects
          .map((group) => `${group.name === '' ? '未分类' : group.name}(${group.count})`)
          .join(' / '),
      );
    }
    for (const todo of value.todos) {
      const status = STATUS_LABEL[todo.status] ?? todo.status;
      const completed = todo.completedAt === null
        ? EMPTY_TIME
        : formatLocalDateTime(todo.completedAt);
      lines.push(
        `- [${status}] ${priorityTag(todo)}${projectTag(todo)}${todo.title}｜创建 ${formatLocalDateTime(todo.createdAt)}｜完成 ${completed}${fileSuffix(todo)}｜id ${todo.id}`,
      );
    }
    return lines.join('\n') + notices;
  }
  if (action === 'delete') {
    return `已删除待办 ${value.deleted}${notices}`;
  }
  if (action === 'quick_add') {
    const lines = [];
    const created = Array.isArray(value.created) ? value.created : [];
    lines.push(`已添加 ${created.length} 条待办：`);
    for (const todo of created) {
      const status = STATUS_LABEL[todo.status] ?? todo.status;
      const files = Array.isArray(todo.files) && todo.files.length > 0
        ? `｜文件 ${todo.files.join('、')}`
        : '';
      lines.push(
        `- [${status}] ${priorityTag(todo)}${projectTag(todo)}${todo.title}｜创建 ${formatLocalDateTime(todo.createdAt)}${files}｜id ${todo.id}`,
      );
    }
    for (const skip of Array.isArray(value.skipped) ? value.skipped : []) {
      lines.push(`- 跳过「${skip.line}」（${skip.reason === 'NO_CONTENT' ? '没有可用的标题内容' : skip.reason}）`);
    }
    for (const error of Array.isArray(value.errors) ? value.errors : []) {
      lines.push(`- 失败「${error.title}」（${error.code}）：${error.message}`);
    }
    if (created.length === 0) {
      return '没有解析出可添加的待办。示例：新任务 写周报 #工作 @src/auth/login.ts；买牛奶 @生活';
    }
    return lines.join('\n');
  }
  if (action === 'health') {
    return `待办时间日志运行中：${value.count} 条待办，数据文件 ${value.dataFile}${notices}`;
  }
  if (value.todo) {
    const todo = value.todo;
    const status = STATUS_LABEL[todo.status] ?? todo.status;
    const completed = todo.completedAt === null
      ? EMPTY_TIME
      : formatLocalDateTime(todo.completedAt);
    return (
      `[${status}] ${priorityTag(todo)}${projectTag(todo)}${todo.title}｜创建 ${formatLocalDateTime(todo.createdAt)}`
      + `｜完成 ${completed}${fileSuffix(todo)}｜id ${todo.id}`
      + notices
    );
  }
  return JSON.stringify(value) + notices;
}

/**
 * Build the single agent tool definition shared by every action.
 *
 * @param {TodoStore} store
 * @param {FileIndex | null} [fileIndex]
 * @param {() => string} [getWorkspaceRoot]
 * @returns {object}
 */
export function createTodoTool(store, fileIndex = null, getWorkspaceRoot = () => '') {
  return {
    name: TOOL_NAME,
    description:
      '待办时间日志：查看、新增、完成、取消完成、编辑、删除待办，并返回每个待办的创建时间与完成时间'
      + '（本地时间 YYYY-MM-DD HH:mm:ss；未完成时完成时间为 "-"）。'
      + '支持项目分类（project，留空为「未分类」）、优先级（priority：high/medium/low，空串为未设置）、'
      + '类型（type：bug/feature/improvement/question/chore/other，空串为未设置）'
      + '与工作区文件引用（files，工作区相对路径数组）：'
      + 'create/update 可带 project、priority、type 与 files，list 可用 project 过滤；只给 files 不给 project 时，'
      + '分类自动取第一个文件所在目录。'
      + '用户说「新任务/加个待办/记一下 …」这类自然语言时，优先用 action=quick_add 并把原话放进 text，'
      + '它会按 #分类、@文件、!high/!medium/!low（或 !高/!中/!低）、^bug/^feature/…（或 ^缺陷/^新功能/…、类型：bug）规则解析（与界面「对话录入」同一实现）。'
      + 'action=list 支持 filter(全部/未完成/已完成)、sortBy(createdAt/completedAt/updatedAt/title/project/priority)、direction(asc/desc)。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['action'],
      properties: {
        action: {
          type: 'string',
          enum: ACTIONS.slice(),
          description: 'list=列表，get=单条详情，create=新建，quick_add=用自然语言批量新建，complete=标记完成，uncomplete=取消完成，update=编辑标题/分类/类型/文件/优先级，delete=删除，health=运行状态',
        },
        id: { type: 'string', description: '待办 id；get/complete/uncomplete/update/delete 必填' },
        title: { type: 'string', description: '待办标题（1-200 字符）；create 必填，update 可选（只改分类/优先级/类型时可省略）' },
        project: {
          type: 'string',
          description: '项目分类（0-40 字符）；create/update 可选，留空表示未分类；list 时用于按分类过滤（传空串表示只看未分类）',
        },
        priority: {
          type: 'string',
          enum: PRIORITY_VALUES.slice(),
          description: '优先级：high（高）/medium（中）/low（低），空串表示未设置（默认）；create/update 可选，update 传空串可显式清除',
        },
        type: {
          type: 'string',
          enum: TYPE_VALUES.slice(),
          description: '类型：bug（缺陷）/feature（新功能）/improvement（改进）/question（疑问）/chore（杂项）/other（其他），空串表示未设置（默认）；create/update 可选，update 传空串可显式清除',
        },
        files: {
          type: 'array',
          items: { type: 'string' },
          description: `工作区相对文件路径（最多 ${MAX_FILES} 个，例如 "src/auth/login.ts"）；create/update 可选。只给 files 不给 project 时，分类自动取第一个文件所在目录`,
        },
        text: {
          type: 'string',
          description: 'quick_add 专用：自然语言原话，例如「新任务 写周报 #工作 !high ^feature @src/auth/login.ts；买牛奶 @生活」；换行或；分隔多条，#分类、@文件、@分类、!high/!medium/!low（或 !高/!中/!低）、^bug/^feature/…（或 ^缺陷/^新功能/…、类型：bug）自动识别',
        },
        filter: {
          type: 'string',
          enum: FILTERS.slice(),
          description: 'list 筛选：all（默认）/pending/completed',
        },
        sortBy: {
          type: 'string',
          enum: SORT_FIELDS.slice(),
          description: 'list 排序字段，默认 createdAt；project 会按分类名分组（未分类最后）；priority 按 high>medium>low 排序（未设置最后，升降序都如此）',
        },
        direction: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'list 排序方向，默认 desc（新的在前）',
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          action: { type: 'string' },
          stats: {
            type: 'object',
            properties: {
              total: { type: 'integer' },
              pending: { type: 'integer' },
              completed: { type: 'integer' },
            },
          },
          projects: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                count: { type: 'integer' },
                pending: { type: 'integer' },
                completed: { type: 'integer' },
              },
            },
          },
          todos: { type: 'array', items: { type: 'object' } },
          todo: { type: 'object' },
          deleted: { type: 'string' },
          created: { type: 'array', items: { type: 'object' } },
          skipped: {
            type: 'array',
            items: {
              type: 'object',
              properties: { line: { type: 'string' }, reason: { type: 'string' } },
            },
          },
          errors: { type: 'array', items: { type: 'object' } },
          notices: { type: 'array', items: { type: 'string' } },
          code: { type: 'string' },
          message: { type: 'string' },
        },
      },
      render(args, value) {
        const action = typeof args?.action === 'string' ? args.action : 'list';
        return [{ type: 'text', text: renderTodoResult(action, value) }];
      },
    },
    /**
     * @param {TodoActionPayload} [rawArgs]
     * @returns {Promise<TodoResult & { action: string }>}
     */
    async execute(rawArgs) {
      /** @type {TodoActionPayload} */
      const args = rawArgs && typeof rawArgs === 'object' ? rawArgs : {};
      const action = typeof args.action === 'string' ? args.action : '';
      try {
        if (action === 'quick_add') {
          const quick = await runQuickAdd(store, fileIndex, args.text ?? args.title ?? '', getWorkspaceRoot(), [], args.priority, args.type);
          if (quick.ok !== true) {
            return { action, ok: false, error: { code: quick.code, message: quick.message } };
          }
          return {
            action,
            ok: true,
            parsed: quick.parsed,
            created: quick.created.map(decorateTodo),
            skipped: quick.skipped,
            errors: quick.errors,
          };
        }
        const result = await executeTodoAction(store, action, args);
        if (result.ok === true && Array.isArray(result.todos)) {
          return { action, ...result, todos: result.todos.map(decorateTodo) };
        }
        if (result.ok === true && result.todo) {
          return { action, ...result, todo: decorateTodo(result.todo) };
        }
        if (result.ok === true) return { action, ...result };
        return { action, ok: false, error: { code: result.code, message: result.message } };
      } catch (error) {
        return {
          action,
          ok: false,
          error: { code: 'INTERNAL', message: error?.message ?? String(error) },
        };
      }
    },
  };
}

/**
 * Map a result code onto the HTTP status the panel expects.
 *
 * @param {string} [code]
 * @returns {number}
 */
function httpStatusForCode(code) {
  switch (code) {
    case 'BAD_REQUEST':
    case 'TITLE_REQUIRED':
    case 'TITLE_TOO_LONG':
    case 'PROJECT_INVALID':
    case 'PROJECT_TOO_LONG':
    case 'PRIORITY_INVALID':
    case 'TYPE_INVALID':
    case 'FILES_INVALID':
    case 'TOO_MANY_FILES':
      return 400;
    case 'NOT_FOUND':
      return 404;
    case 'ALREADY_COMPLETED':
    case 'ALREADY_PENDING':
    case 'TOO_MANY_TODOS':
      return 409;
    case 'PERSIST_FAILED':
      return 500;
    default:
      return 500;
  }
}

/**
 * Send one JSON envelope and end the response.
 *
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {any} payload  a JSON-serialisable response envelope
 * @returns {void}
 */
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(body);
}

/**
 * Read and parse a JSON request body (an empty body means `{}`).
 *
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<Record<string, any>>}
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('请求体过大'), { code: 'BAD_REQUEST' }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      const text = Buffer.concat(chunks).toString('utf8').trim();
      if (text === '') {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(text);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          reject(Object.assign(new Error('请求体必须是 JSON 对象'), { code: 'BAD_REQUEST' }));
          return;
        }
        resolve(parsed);
      } catch {
        reject(Object.assign(new Error('请求体不是合法 JSON'), { code: 'BAD_REQUEST' }));
      }
    });
    req.on('error', reject);
  });
}

/**
 * HTTP front door for the Web UI. Mounted as a `prefix` route, so every request
 * whose path starts with ROUTE_PREFIX lands here; the suffix selects the action.
 *
 * @param {TodoStore} store
 * @param {HttpHandlerOptions} [options]
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>}
 */
export function createHttpHandler(store, options = {}) {
  const fileIndex = options.fileIndex ?? null;
  const getWorkspaceRoot = typeof options.getWorkspaceRoot === 'function'
    ? options.getWorkspaceRoot
    : () => (typeof options.workspaceRoot === 'string' ? options.workspaceRoot : '');
  const listWorkspaces = typeof options.listWorkspaces === 'function'
    ? options.listWorkspaces
    : () => [{ path: getWorkspaceRoot(), title: '', source: 'default' }];
  const resolveRequestRoot = (requested) => {
    const candidates = listWorkspaces();
    if (typeof requested !== 'string' || requested.trim() === '') {
      return { root: candidates[0]?.path ?? getWorkspaceRoot(), candidates, error: null };
    }
    let resolvedRequested;
    try {
      resolvedRequested = path.resolve(requested.trim());
    } catch {
      return { root: '', candidates, error: '无效的工作区路径' };
    }
    const normalizeForCompare = (value) => (process.platform === 'win32' ? value.toLowerCase() : value);
    const match = candidates.find(
      (candidate) => normalizeForCompare(path.resolve(candidate.path)) === normalizeForCompare(resolvedRequested),
    );
    if (!match) return { root: '', candidates, error: `未知的工作区：${requested}` };
    return { root: match.path, candidates, error: null };
  };
  return async function handler(req, res) {
    let url;
    try {
      url = new URL(req.url ?? '/', 'http://127.0.0.1');
    } catch {
      sendJson(res, 400, { ok: false, error: { code: 'BAD_REQUEST', message: '无效的请求路径' } });
      return;
    }
    let suffix = url.pathname.startsWith(ROUTE_PREFIX)
      ? url.pathname.slice(ROUTE_PREFIX.length)
      : url.pathname;
    if (suffix === '' || suffix === '/') suffix = '/health';

    const method = (req.method ?? 'GET').toUpperCase();
    try {
      if (method === 'GET' || method === 'HEAD') {
        if (suffix === '/health') {
          const health = await executeTodoAction(store, 'health');
          sendJson(res, 200, {
          ok: true,
          value: { ...health, routePrefix: ROUTE_PREFIX, workspaceRoot: getWorkspaceRoot() },
        });
          return;
        }
        sendJson(res, 405, {
          ok: false,
          error: { code: 'METHOD_NOT_ALLOWED', message: '该接口仅支持 POST' },
        });
        return;
      }
      if (method !== 'POST') {
        sendJson(res, 405, {
          ok: false,
          error: { code: 'METHOD_NOT_ALLOWED', message: '该接口仅支持 POST' },
        });
        return;
      }

      const action = suffix.replace(/^\/+/, '');
      if (action === '' || action === 'health') {
        const health = await executeTodoAction(store, 'health');
        sendJson(res, 200, {
          ok: true,
          value: { ...health, routePrefix: ROUTE_PREFIX, workspaceRoot: getWorkspaceRoot() },
        });
        return;
      }
      const EXTRA_PATHS = ['quick-add', 'quick_add', 'files', 'workspaces', 'projects'];
      if (!CRUD_ACTIONS.includes(action) && !EXTRA_PATHS.includes(action)) {
        sendJson(res, 404, {
          ok: false,
          error: {
            code: 'NOT_FOUND',
            message: `未知接口：${action}；可用接口：${[...CRUD_ACTIONS, 'quick-add', 'files'].join(', ')}`,
          },
        });
        return;
      }

      const body = await readJsonBody(req);

      if (action === 'workspaces') {
        const candidates = listWorkspaces();
        sendJson(res, 200, {
          ok: true,
          value: {
            active: candidates[0]?.path ?? getWorkspaceRoot(),
            workspaces: candidates.map((candidate) => ({
              path: candidate.path,
              title: candidate.title,
              source: candidate.source,
            })),
          },
        });
        return;
      }

      if (action === 'projects') {
        const selected = resolveRequestRoot(body.workspace);
        if (selected.error !== null) {
          sendJson(res, 400, { ok: false, error: { code: 'WORKSPACE_UNKNOWN', message: selected.error } });
          return;
        }
        const summary = await store.projectSummary();
        let folders = [];
        if (fileIndex !== null) {
          try {
            folders = await fileIndex.listDirectories({ root: selected.root });
          } catch {
            folders = [];
          }
        }
        sendJson(res, 200, {
          ok: true,
          value: {
            workspace: selected.root,
            suggestions: buildProjectSuggestions({
              used: summary.projects ?? [],
              workspaces: listWorkspaces(),
              folders,
            }),
          },
        });
        return;
      }

      if (action === 'quick-add' || action === 'quick_add') {
        const selected = resolveRequestRoot(body.workspace);
        if (selected.error !== null) {
          sendJson(res, 400, { ok: false, error: { code: 'WORKSPACE_UNKNOWN', message: selected.error } });
          return;
        }
        const quick = await runQuickAdd(store, fileIndex, body.text ?? '', selected.root, [], body.priority, body.type);
        if (quick.ok !== true) {
          sendJson(res, httpStatusForCode(quick.code), {
            ok: false,
            error: { code: quick.code, message: quick.message },
          });
          return;
        }
        sendJson(res, 200, {
          ok: true,
          value: {
            parsed: quick.parsed,
            created: quick.created.map(decorateTodo),
            skipped: quick.skipped,
            errors: quick.errors,
          },
        });
        return;
      }
      if (action === 'files') {
        if (fileIndex === null) {
          sendJson(res, 501, {
            ok: false,
            error: { code: 'FILES_UNAVAILABLE', message: '当前环境没有可用的文件服务，无法枚举工作区文件' },
          });
          return;
        }
        const selected = resolveRequestRoot(body.workspace);
        if (selected.error !== null) {
          sendJson(res, 400, { ok: false, error: { code: 'WORKSPACE_UNKNOWN', message: selected.error } });
          return;
        }
        let listing;
        try {
          listing = await fileIndex.list({ ...body, root: selected.root });
        } catch (error) {
          // No `fs` service (or a failing backend) means the feature is simply
          // unavailable here; the panel shows its "no suggestions" state.
          sendJson(res, 501, {
            ok: false,
            error: {
              code: 'FILES_UNAVAILABLE',
              message: `当前环境无法枚举工作区文件：${error?.message ?? String(error)}`,
            },
          });
          return;
        }
        sendJson(res, 200, { ok: true, value: listing });
        return;
      }
      const result = await executeTodoAction(store, action, body);
      if (result.ok === false) {
        sendJson(res, httpStatusForCode(result.code), {
          ok: false,
          error: { code: result.code, message: result.message },
        });
        return;
      }
      const { ok: _ok, ...value } = result;
      sendJson(res, 200, { ok: true, value });
    } catch (error) {
      const code = error?.code === 'BAD_REQUEST' ? 'BAD_REQUEST' : 'INTERNAL';
      const message = error?.message ?? String(error);
      sendJson(res, code === 'BAD_REQUEST' ? 400 : 500, { ok: false, error: { code, message } });
    }
  };
}

/**
 * Mount `setup` against the given services.
 *
 * TODO(cordis-version): `ctx.inject(names, callback)` is the documented way to
 * observe an optional service (and its later removal). The direct fallback keeps
 * the plugin working on a Cordis build without it, at the cost of not observing
 * a service mounted after activation.
 *
 * @param {PluginContext} ctx
 * @param {string[]} dependencies
 * @param {(scope: PluginContext) => void} setup
 */
function mountOn(ctx, dependencies, setup) {
  if (typeof ctx.inject === 'function') {
    ctx.inject(dependencies, (scope) => {
      setup(scope);
    });
    return;
  }
  if (dependencies.every((dependency) => typeof ctx.get === 'function' && ctx.get(dependency) !== undefined)) {
    setup(ctx);
  }
}

/**
 * Mount the plugin against the given services.
 *
 * @param {PluginContext} ctx
 * @param {PluginConfig} [config]
 */
export function apply(ctx, config = {}) {
  const logger = createLogger(ctx);
  const dataFile = resolveDataFile(config);
  const store = new TodoStore({ dataFile, logger });
  // Resolved lazily: the workspace registry can still be bootstrapping at
  // activation time, and the panel should follow the workspace the user has open.
  const getWorkspaceRoot = () => resolveWorkspaceRoot(ctx, config);
  logger.info(`data file: ${dataFile}`);
  logger.info(`workspace root: ${getWorkspaceRoot()}`);

  /**
   * File index over the Harness `fs` service. The service is read lazily so a
   * profile without `fs` still loads the plugin (the UI then gets a 501 from
   * /files instead of a broken panel).
   */
  const fileIndex = createFileIndex({
    getRoot: getWorkspaceRoot,
    fsService: {
      resolve: (targetPath, options) => {
        const fsService = ctx.get('fs');
        if (!fsService) throw new Error('fs service unavailable');
        return fsService.resolve(targetPath, options);
      },
      listDir: (target, signal) => {
        const fsService = ctx.get('fs');
        if (!fsService) throw new Error('fs service unavailable');
        return fsService.listDir(target, signal);
      },
    },
    logger,
  });

  ctx.effect(() => {
    store.load().then(
      (result) => {
        for (const notice of result.notices ?? []) logger.warn(notice);
        logger.info(`loaded ${store.size} todo(s)`);
      },
      (error) => logger.error('load failed', error),
    );
    return () => {
      store.dispose().catch(() => {});
    };
  });

  mountOn(ctx, ['webServer'], (scope) => {
    scope.effect(() => scope.webServer.register({
      kind: 'prefix',
      path: ROUTE_PREFIX,
      handler: createHttpHandler(store, {
      fileIndex,
      getWorkspaceRoot,
      listWorkspaces: () => listWorkspaceCandidates(ctx, config),
    }),
    }));
    logger.info(`routes mounted at ${ROUTE_PREFIX}`);
  });

  mountOn(ctx, ['tools'], (scope) => {
    scope.effect(() => scope.tools.register(createTodoTool(store, fileIndex, getWorkspaceRoot)));
    logger.info(`tool registered: ${TOOL_NAME}`);
  });

  mountOn(ctx, ['commands'], (scope) => {
    scope.effect(() => scope.commands.register({
      name: COMMAND_NAME,
      description: '添加待办到「待办时间日志」：/todo 修复登录 #工作 !high ^bug @src/auth/login.ts（换行或；分隔多条）',
      input: {
        hint: '待办内容：可写 #分类、!high/!medium/!low（或 !高/!中/!低）标记优先级、^bug/^feature/…（或 ^缺陷/^新功能/…、类型：bug）标记类型、文件路径（如 lib/store.js），也可直接附加文件；多条用换行或；分隔',
        attachments: true,
      },
      handler: async (invocation) => {
        const rawInput = String(invocation?.rawInput ?? '');
        // The host normally strips the command name; tolerate a full `/todo ...`
        // line in case a future transport passes it through unchanged.
        const text = rawInput.replace(/^\s*\/todo\s+/i, '');
        const attachmentFiles = await resolveCommandAttachmentFiles(invocation, fileIndex, getWorkspaceRoot());
        const quick = await runQuickAdd(store, fileIndex, text, getWorkspaceRoot(), attachmentFiles);
        if (quick.ok !== true) return { kind: 'error', text: quick.message };
        if (quick.created.length === 0) {
          const reason = quick.skipped[0]?.reason ?? 'NO_CONTENT';
          return { kind: 'error', text: `没有解析出待办内容（${reason}）。示例：/todo 写周报 #工作 @src/auth/login.ts` };
        }
        const lines = quick.created.map((todo) => {
          const project = todo.project ? `[${todo.project}] ` : '';
          const files = todo.files.length > 0 ? ` ｜文件 ${todo.files.join('、')}` : '';
          return `· ${priorityTag(todo)}${project}${todo.title}（创建 ${formatLocalDateTime(todo.createdAt)}）${files}`;
        });
        const failures = quick.errors.map((error) => `· 失败：${error.title}（${error.message}）`);
        const skipped = quick.skipped.map((skip) => `· 跳过：${skip.line}`);
        const summary = [`已添加 ${quick.created.length} 条待办`, ...lines, ...failures, ...skipped].join('\n');
        return { kind: 'success', text: summary };
      },
    }));
    logger.info(`command registered: /${COMMAND_NAME}`);
  });
}
