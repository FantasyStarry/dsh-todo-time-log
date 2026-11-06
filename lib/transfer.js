/**
 * Import / export formatting for 「待办时间日志」 (dsh-todo-time-log).
 *
 * Export is lossless for the native JSON envelope and human-friendly for CSV.
 * Import accepts every shape this plugin can produce plus a hand-written
 * `Todo[]`:
 *
 *   - native JSON envelope v1-v5 (`{ version, todos }`) — the same versions the
 *     store itself migrates on load;
 *   - a bare `Todo[]` array;
 *   - CSV with a header row (Chinese and English column aliases).
 *
 * Everything here is pure: no file system, no dsh imports. The Host HTTP route
 * parses the uploaded text, then hands the normalized records to
 * `TodoStore.importTodos()`, which owns merging, backups and persistence.
 *
 * CSV conventions (documented in README):
 *   - UTF-8 with BOM, CRLF line endings, RFC 4180 quoting;
 *   - timestamps are local `YYYY-MM-DD HH:mm:ss` (JSON keeps ISO-8601 UTC);
 *   - `files` uses `;` between workspace-relative paths;
 *   - `耗时(分钟)` is derived on export and ignored on import.
 */

import {
  MAX_TODOS,
  STORE_VERSION,
  extractStoreRows,
  makeTodoId,
  normalizeTodo,
} from './store.js';
import { formatLocalDateTime, nowIso, parseTimestamp, secondsBetween } from './time.js';

/** Formats accepted by `exportTodoData()`. */
export const EXPORT_FORMATS = Object.freeze(['json', 'csv']);
/** Formats accepted by `parseImportText()`. */
export const IMPORT_FORMATS = Object.freeze(['json', 'csv']);/** How many invalid rows an import result describes in detail. */
export const MAX_INVALID_DETAILS = 20;

const CSV_BOM = '\uFEFF';
const CSV_HEADER = Object.freeze([
  'ID',
  '标题',
  '分类',
  '文件',
  '状态',
  '优先级',
  '类型',
  '创建时间',
  '完成时间',
  '更新时间',
  '耗时(分钟)',
]);

/** CSV display labels; the import aliases below accept both languages. */
const PRIORITY_CSV = Object.freeze({ high: '高', medium: '中', low: '低' });
const TYPE_CSV = Object.freeze({
  bug: '缺陷',
  feature: '新功能',
  improvement: '改进',
  question: '疑问',
  chore: '杂项',
  other: '其他',
});

const HEADER_ALIASES = Object.freeze({
  id: ['id', '编号', '标识'],
  title: ['title', '标题', '待办', '任务', '内容'],
  project: ['project', '分类', '项目', '类别'],
  files: ['files', 'file', '文件', '文件引用', '关联文件'],
  status: ['status', '状态'],
  priority: ['priority', '优先级'],
  type: ['type', '类型'],
  createdAt: ['createdat', 'created_at', 'created', '创建时间', '创建'],
  completedAt: ['completedat', 'completed_at', 'completed', '完成时间', '完成'],
  updatedAt: ['updatedat', 'updated_at', 'updated', '更新时间', '更新'],
});

const COMPLETED_STATUS_ALIASES = new Set([
  'completed', 'complete', 'done', 'closed', 'true', '1', '是',
  '已完成', '完成', '已办', '已结束',
]);
const PENDING_STATUS_ALIASES = new Set([
  'pending', 'todo', 'open', 'false', '0', '否', '未完成', '待办', '未开始',
]);
const PRIORITY_ALIASES = Object.freeze({
  high: 'high', 高: 'high', 紧急: 'high',
  medium: 'medium', 中: 'medium', 普通: 'medium',
  low: 'low', 低: 'low', 次要: 'low',
  '': '', 未设置: '', 无: '',
});
const TYPE_ALIASES = Object.freeze({
  bug: 'bug', 缺陷: 'bug', 故障: 'bug',
  feature: 'feature', 新功能: 'feature', 功能: 'feature',
  improvement: 'improvement', 改进: 'improvement', 优化: 'improvement',
  question: 'question', 疑问: 'question', 问题: 'question',
  chore: 'chore', 杂项: 'chore', 事务: 'chore',
  other: 'other', 其他: 'other',
  '': '', 未设置: '',
});

const NAIVE_DATETIME = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/;

/** Local-time `YYYYMMDD-HHmm`, used in export file names. */
function filenameStamp(now) {
  const date = new Date(now);
  const pad = (value) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-`
    + `${pad(date.getHours())}${pad(date.getMinutes())}`
  );
}

/** Escape one CSV field (RFC 4180): quote when it contains `,` `"` CR or LF. */
function escapeCsvField(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Local display timestamp, or '' for an empty/invalid value. */
function csvTimestamp(value) {
  return formatLocalDateTime(value, { dash: '' });
}

/** Completed duration in whole minutes; '' while pending. */
function durationMinutes(todo) {
  if (todo.status !== 'completed' || todo.completedAt === null || todo.completedAt === undefined) {
    return '';
  }
  const seconds = secondsBetween(todo.createdAt, todo.completedAt);
  return seconds === null ? '' : String(Math.round(seconds / 60));
}

/**
 * Build the native JSON document. Extra top-level fields (`exportedAt`,
 * `exporter`, `count`) are ignored by every importer, including this plugin's.
 *
 * @param {object[]} todos
 * @param {{ now?: number }} [options]
 * @returns {string}
 */
export function buildExportJson(todos, options = {}) {
  const now = typeof options.now === 'number' ? options.now : Date.now();
  const envelope = {
    version: STORE_VERSION,
    updatedAt: nowIso(now),
    exportedAt: nowIso(now),
    exporter: { name: 'dsh-todo-time-log' },
    count: todos.length,
    todos: todos.map((todo) => ({
      id: todo.id,
      title: todo.title,
      project: todo.project ?? '',
      files: Array.isArray(todo.files) ? todo.files.slice() : [],
      status: todo.status === 'completed' ? 'completed' : 'pending',
      priority: todo.priority ?? '',
      type: todo.type ?? '',
      createdAt: todo.createdAt,
      completedAt: todo.completedAt ?? null,
      updatedAt: todo.updatedAt,
    })),
  };
  return `${JSON.stringify(envelope, null, 2)}\n`;
}

/**
 * Build the CSV document (BOM + header + one row per todo).
 *
 * @param {object[]} todos
 * @returns {string}
 */
export function buildExportCsv(todos) {
  const lines = [CSV_HEADER.map(escapeCsvField).join(',')];
  for (const todo of todos) {
    lines.push([
      todo.id,
      todo.title,
      todo.project ?? '',
      Array.isArray(todo.files) ? todo.files.join(';') : '',
      todo.status === 'completed' ? '已完成' : '未完成',
      PRIORITY_CSV[todo.priority] ?? '',
      TYPE_CSV[todo.type] ?? '',
      csvTimestamp(todo.createdAt),
      csvTimestamp(todo.completedAt),
      csvTimestamp(todo.updatedAt),
      durationMinutes(todo),
    ].map(escapeCsvField).join(','));
  }
  return `${CSV_BOM}${lines.join('\r\n')}\r\n`;
}

/**
 * Serialize todos for download. `format` must be one of `EXPORT_FORMATS`; an
 * unknown value falls back to JSON (the route validates it first).
 *
 * @param {object[]} todos
 * @param {{ format?: string, now?: number }} [options]
 * @returns {{ format: string, mime: string, filename: string, count: number, content: string }}
 */
export function exportTodoData(todos, options = {}) {
  const source = Array.isArray(todos) ? todos : [];
  const now = typeof options.now === 'number' ? options.now : Date.now();
  const format = options.format === 'csv' ? 'csv' : 'json';
  const stamp = filenameStamp(now);
  if (format === 'csv') {
    return {
      format,
      mime: 'text/csv;charset=utf-8',
      filename: `todos-${stamp}.csv`,
      count: source.length,
      content: buildExportCsv(source),
    };
  }
  return {
    format,
    mime: 'application/json;charset=utf-8',
    filename: `todos-${stamp}.json`,
    count: source.length,
    content: buildExportJson(source, { now }),
  };
}

/** Parse a naive local `YYYY-MM-DD HH:mm[:ss]` or any `Date.parse`-able value. */
function importTimestamp(value) {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : undefined;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? new Date(value).toISOString() : undefined;
  }
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (text === '') return undefined;
  const match = NAIVE_DATETIME.exec(text);
  if (match !== null) {
    const date = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4] ?? 0),
      Number(match[5] ?? 0),
      Number(match[6] ?? 0),
    );
    return Number.isFinite(date.getTime()) ? date.toISOString() : text;
  }
  const ms = parseTimestamp(text);
  return ms === null ? text : new Date(ms).toISOString();
}

/** Map a status cell (English or Chinese) onto the stored enum. */
function importStatus(value, completedAt) {
  const text = String(value ?? '').trim().toLowerCase();
  if (COMPLETED_STATUS_ALIASES.has(text)) return 'completed';
  if (PENDING_STATUS_ALIASES.has(text)) {
    if (text === '' && completedAt !== null && completedAt !== undefined && completedAt !== '') {
      return 'completed';
    }
    return 'pending';
  }
  return String(value ?? '').trim();
}

/** Map a priority cell (English or Chinese) onto the stored enum. */
function importPriority(value) {
  const text = String(value ?? '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(PRIORITY_ALIASES, text)
    ? PRIORITY_ALIASES[text]
    : String(value ?? '').trim();
}

/** Map a type cell (English or Chinese) onto the stored enum. */
function importType(value) {
  const text = String(value ?? '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(TYPE_ALIASES, text)
    ? TYPE_ALIASES[text]
    : String(value ?? '').trim();
}

/** Split a `files` cell (`;` or full-width `；`); arrays pass through. */
function importFiles(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || value.trim() === '') return [];
  return value.split(/[;；]/).map((file) => file.trim()).filter((file) => file !== '');
}

/** Coerce one JSON row into the shape `normalizeTodo()` expects. */
function prepareJsonRow(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const row = { ...raw };
  row.files = importFiles(row.files);
  row.status = importStatus(row.status, row.completedAt);
  row.priority = importPriority(row.priority);
  row.type = importType(row.type);
  row.createdAt = importTimestamp(row.createdAt);
  row.updatedAt = importTimestamp(row.updatedAt);
  if (row.completedAt === null || row.completedAt === undefined || row.completedAt === '') {
    row.completedAt = null;
  } else {
    row.completedAt = importTimestamp(row.completedAt);
  }
  return row;
}

/** Index a CSV header row onto the field names above. */
function mapCsvHeader(cells) {
  const index = new Map();
  cells.forEach((cell, position) => {
    const header = String(cell ?? '').replace(/^\uFEFF/, '').trim().toLowerCase();
    if (header === '') return;
    for (const field of Object.keys(HEADER_ALIASES)) {
      if (HEADER_ALIASES[field].includes(header) && !index.has(field)) {
        index.set(field, position);
      }
    }
  });
  return index;
}

/**
 * RFC 4180-compatible CSV reader: quoted fields, doubled quotes and embedded
 * CR/LF inside quotes. Returns an array of rows (arrays of cell strings).
 */
function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (char === '\r' || char === '\n') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      else if (row.length === 1 && row[0] === '') {
        // blank line: ignore
      }
      row = [];
      continue;
    }
    field += char;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }
  return rows;
}

/** Detect JSON vs CSV from the first non-space character. */
function detectFormat(text) {
  const head = text.replace(/^\uFEFF/, '').trimStart();
  return head.startsWith('{') || head.startsWith('[') ? 'json' : 'csv';
}

/** Normalize a caller-provided format hint (`json`, `.csv`, MIME type). */
function normalizeFormat(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase().replace(/^\./, '');
  if (text === 'json' || text === 'application/json' || text === 'text/json') return 'json';
  if (text === 'csv' || text === 'text/csv' || text === 'application/csv') return 'csv';
  return null;
}

/**
 * Normalize parsed rows and fold duplicate ids (newest `updatedAt` wins).
 * Row numbers in `invalid` are file row numbers (CSV: 1 = header).
 */
function normalizeRows(rows, options) {
  const { now, makeId, rowBase } = options;
  const byId = new Map();
  const invalid = [];
  const notices = [];
  let invalidCount = 0;
  let repaired = 0;
  let duplicates = 0;
  rows.forEach((row, position) => {
    const rowNumber = rowBase + position;
    const normalized = normalizeTodo(row, { now, makeId });
    if (normalized.todo === null) {
      invalidCount += 1;
      if (invalid.length < MAX_INVALID_DETAILS) {
        invalid.push({
          row: rowNumber,
          message: normalized.notices[0] ?? '记录格式非法',
        });
      }
      return;
    }
    const todo = normalized.todo;
    const meaningful = normalized.notices.filter((notice) => !notice.includes('缺少 id'));
    if (meaningful.length > 0) repaired += 1;
    const existing = byId.get(todo.id);
    if (existing === undefined) {
      byId.set(todo.id, todo);
      return;
    }
    duplicates += 1;
    const existingMs = parseTimestamp(existing.updatedAt);
    const incomingMs = parseTimestamp(todo.updatedAt);
    if (incomingMs !== null && (existingMs === null || incomingMs > existingMs)) {
      byId.set(todo.id, todo);
    }
  });
  if (repaired > 0) notices.push(`已修复 ${repaired} 条记录的字段格式`);
  if (duplicates > 0) notices.push(`文件内有 ${duplicates} 条重复 id 的记录，已保留更新时间较新的一条`);
  if (invalidCount > 0) notices.push(`已跳过 ${invalidCount} 行无法识别的记录`);
  return { records: [...byId.values()], invalid, invalidCount, notices };
}

function parseJsonImport(text, options) {
  let parsed;
  try {
    parsed = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    return { ok: false, code: 'IMPORT_INVALID', message: 'JSON 解析失败：文件不是合法 JSON' };
  }
  const extracted = extractStoreRows(parsed);
  if (extracted.ok !== true) {
    if (extracted.code === 'VERSION_UNSUPPORTED') {
      return { ok: false, code: 'IMPORT_VERSION_UNSUPPORTED', message: extracted.message };
    }
    return { ok: false, code: 'IMPORT_INVALID', message: `JSON 结构异常：${extracted.message}` };
  }
  const rows = extracted.rows.map(prepareJsonRow);
  const normalized = normalizeRows(rows, {
    now: options.now,
    makeId: options.makeId,
    rowBase: 1,
  });
  if (normalized.records.length === 0) {
    return {
      ok: false,
      code: 'IMPORT_INVALID',
      message: '文件里没有可导入的待办（标题为空或记录格式非法）',
    };
  }
  if (normalized.records.length > MAX_TODOS) {
    return {
      ok: false,
      code: 'IMPORT_TOO_MANY',
      message: `单次导入不能超过 ${MAX_TODOS} 条待办`,
    };
  }
  const notices = normalized.notices.slice();
  if (normalized.invalidCount > 0) {
    notices.push(`共读取 ${rows.length} 行，有效 ${normalized.records.length} 条`);
  }
  return {
    ok: true,
    format: 'json',
    records: normalized.records,
    invalid: normalized.invalid,
    invalidCount: normalized.invalidCount,
    rowCount: rows.length,
    notices,
  };
}

function parseCsvImport(text, options) {
  const rows = parseCsvRows(text.replace(/^\uFEFF/, ''));
  if (rows.length === 0) {
    return { ok: false, code: 'IMPORT_EMPTY', message: 'CSV 文件是空的' };
  }
  const header = mapCsvHeader(rows[0]);
  if (!header.has('title')) {
    return {
      ok: false,
      code: 'IMPORT_INVALID',
      message: 'CSV 缺少「标题」列（可识别的列名：标题/title、分类/project、状态/status 等）',
    };
  }
  const get = (row, field) => {
    const position = header.get(field);
    if (position === undefined) return undefined;
    const cell = row[position];
    return typeof cell === 'string' ? cell.trim() : '';
  };
  const dataRows = rows.slice(1).filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''));
  const prepared = dataRows.map((row) => ({
    id: get(row, 'id'),
    title: get(row, 'title'),
    project: get(row, 'project'),
    files: importFiles(get(row, 'files') ?? ''),
    status: get(row, 'status') ?? '',
    priority: get(row, 'priority'),
    type: get(row, 'type'),
    createdAt: get(row, 'createdAt'),
    completedAt: get(row, 'completedAt'),
    updatedAt: get(row, 'updatedAt'),
  }));
  const normalized = normalizeRows(prepared.map(prepareJsonRow), {
    now: options.now,
    makeId: options.makeId,
    rowBase: 2,
  });
  if (normalized.records.length === 0) {
    return {
      ok: false,
      code: 'IMPORT_INVALID',
      message: 'CSV 里没有可导入的待办（标题为空或记录格式非法）',
    };
  }
  if (normalized.records.length > MAX_TODOS) {
    return {
      ok: false,
      code: 'IMPORT_TOO_MANY',
      message: `单次导入不能超过 ${MAX_TODOS} 条待办`,
    };
  }
  const notices = normalized.notices.slice();
  if (normalized.invalidCount > 0) {
    notices.push(`共读取 ${dataRows.length} 行，有效 ${normalized.records.length} 条`);
  }
  return {
    ok: true,
    format: 'csv',
    records: normalized.records,
    invalid: normalized.invalid,
    invalidCount: normalized.invalidCount,
    rowCount: dataRows.length,
    notices,
  };
}

/**
 * Parse an uploaded file into normalized records.
 *
 * @param {string} text
 * @param {{ format?: string, now?: number, makeId?: () => string }} [options]
 * @returns {object}
 */
export function parseImportText(text, options = {}) {
  if (typeof text !== 'string' || text.trim() === '') {
    return { ok: false, code: 'IMPORT_EMPTY', message: '导入内容为空' };
  }
  const now = typeof options.now === 'number' ? options.now : Date.now();
  const makeId = typeof options.makeId === 'function' ? options.makeId : makeTodoId;
  const requested = options.format === undefined || options.format === null || options.format === ''
    ? null
    : options.format;
  const requestedFormat = requested === null ? null : normalizeFormat(requested);
  if (requested !== null && requestedFormat === null) {
    return { ok: false, code: 'IMPORT_FORMAT_UNSUPPORTED', message: '只支持 JSON 或 CSV 文件' };
  }
  const format = requestedFormat ?? detectFormat(text);
  const parsed = format === 'json'
    ? parseJsonImport(text, { now, makeId })
    : parseCsvImport(text, { now, makeId });
  return parsed;
}
