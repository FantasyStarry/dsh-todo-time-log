/**
 * Natural-language quick-add parsing for 「待办时间日志」 (dsh-todo-time-log).
 *
 * One parser serves both callers of the same operation:
 *   - the Web UI's 「对话录入」 panel (POST /quick-add)
 *   - the Harness slash command `/todo` (registered on `ctx.commands`)
 *
 * Grammar (deterministic, no model involved):
 *   line break / '；' / ';'      -> separate todos
 *   #name, @name, [name], 项目：name, 分类：name
 *                               -> project/category (first value wins, every
 *                                  marker is stripped from the title)
 *   @path/sub/file  or @file.ts or a known workspace file
 *                               -> workspace file reference; the store derives
 *                                  the project from the file's directory when no
 *                                  explicit project was given
 *   leading fillers             -> stripped repeatedly
 *                                  (帮我/请/新增/新建/添加/记一下/新任务/待办：/todo: ...)
 *   !high / !medium / !low (aliases !h / !m / !l, Chinese !高 / !中 / !低)
 *                               -> priority high/medium/low (leftmost value
 *                                  wins, every marker is stripped from the title)
 *   ^bug / ^feature / ^improvement / ^question / ^chore / ^other
 *   (Chinese ^缺陷 / ^新功能 / ^改进 / ^疑问 / ^杂项 / ^其他, or 类型：bug / type:bug)
 *                               -> type (leftmost value wins, every marker is
 *                                  stripped; an unknown ^value is not a marker)
 *   预计用时 (estimate, minutes; leftmost valid marker wins, every valid marker
 *   is stripped and an invalid one stays in the title as ordinary text):
 *                                 ~30m  ~30分  ~30分钟  ~2h  ~2时  ~2小时  ~90min
 *                                 预计30分  预计：2小时  预计用时 45 分钟
 *                               -> m|min|分|分钟 keep the number, h|时|小时
 *                                  multiply by 60 (a decimal such as `~1.5h` is
 *                                  rounded to whole minutes); a value outside
 *                                  1..MAX_ESTIMATE_MINUTES is not a marker
 *   surrounding punctuation     -> trimmed
 *
 * Everything not consumed above is the title. Lines whose title ends up empty
 * are reported as `skipped` instead of creating an empty todo.
 */

import { MAX_ESTIMATE_MINUTES } from './store.js';

export const FILLER_PREFIXES = Object.freeze([
  '帮我',
  '帮忙',
  '请',
  '麻烦你',
  '麻烦',
  '新增',
  '新建',
  '添加',
  '加一个',
  '加个',
  '记一下',
  '记一条',
  '记一个',
  '记录',
  '待办',
  '新任务',
  '任务',
  '提醒我',
  'todo',
  'task',
  'remind me to',
  'add',
]);

const FILLER_PATTERN = new RegExp(
  `^(?:${FILLER_PREFIXES.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s*[:：]?\\s*`,
  'i',
);

const TITLE_EDGE_PUNCTUATION = /^[\s，,。.、；;：:！!？?~～\-—]+|[\s，,。.、；;：:！!？?~～\-—]+$/g;

const KNOWN_FILE_EXTENSION = /\.[a-zA-Z0-9]{1,8}$/;

/** `!high`-style priority marker aliases, normalized to the stored values. */
const PRIORITY_MARKERS = Object.freeze({
  high: 'high', h: 'high', 高: 'high',
  medium: 'medium', m: 'medium', 中: 'medium',
  low: 'low', l: 'low', 低: 'low',
});

/**
 * `!high` / `!h` / `!高` … as a token: preceded by whitespace or the line start
 * and followed by whitespace, edge punctuation or the line end, so `!important`
 * is never treated as a marker.
 */
const PRIORITY_MARKER_PATTERN = /(^|\s)!(high|medium|low|h|m|l|高|中|低)(?=\s|[，,。.、；;：:！!？?~～]|$)/gi;

/** True when `text` contains a priority marker token. */
export function hasPriorityMarker(text) {
  if (typeof text !== 'string' || text === '') return false;
  PRIORITY_MARKER_PATTERN.lastIndex = 0;
  return PRIORITY_MARKER_PATTERN.test(text);
}

/** `^bug`-style type marker aliases (English words + Chinese display names). */
const TYPE_MARKERS = Object.freeze({
  bug: 'bug', 缺陷: 'bug',
  feature: 'feature', 新功能: 'feature',
  improvement: 'improvement', 改进: 'improvement',
  question: 'question', 疑问: 'question',
  chore: 'chore', 杂项: 'chore',
  other: 'other', 其他: 'other',
});

/**
 * `^bug` / `^缺陷` … as a token: preceded by whitespace or the line start and
 * followed by whitespace, edge punctuation or the line end. An unknown value
 * such as `^foo` is deliberately not a marker and stays part of the title.
 */
const TYPE_MARKER_PATTERN = /(^|\s)\^(bug|feature|improvement|question|chore|other|缺陷|新功能|改进|疑问|杂项|其他)(?=\s|[，,。.、；;：:！!？?~～]|$)/gi;

/**
 * `类型：bug` / `type:bug` (also `类型：缺陷` …). Only a recognized value becomes
 * a marker; an unknown value is left untouched in the title. The English form
 * requires a token boundary so `prototype:bug` is not misread.
 */
const TYPE_EXPLICIT_PATTERN = /(?:类型\s*[:：]\s*([^\s，,。.、；;：:]+))|(?:(^|\s)type\s*[:：]\s*([^\s，,。.、；;：:]+))/gi;

/** Canonical type for a marker/explicit value, or '' when unrecognized. */
function canonicalType(token) {
  const normalized = String(token ?? '').trim().toLowerCase();
  return TYPE_MARKERS[normalized] ?? '';
}

/** True when `text` contains a recognized type marker. */
export function hasTypeMarker(text) {
  if (typeof text !== 'string' || text === '') return false;
  TYPE_MARKER_PATTERN.lastIndex = 0;
  if (TYPE_MARKER_PATTERN.test(text)) return true;
  for (const match of text.matchAll(TYPE_EXPLICIT_PATTERN)) {
    if (canonicalType(match[1] ?? match[3]) !== '') return true;
  }
  return false;
}

/**
 * `~30m` / `~2小时` / `~90min` as a token: preceded by whitespace or the line
 * start and followed by whitespace, edge punctuation or the line end. The unit
 * alternation is ordered longest-first so `30分钟` is not read as `30分` + `钟`.
 */
const ESTIMATE_TILDE_PATTERN = /(^|\s)~(\d+(?:\.\d+)?)\s*(分钟|分|min|m|小时|时|h)(?=\s|[，,。.、；;：:！!？?]|$)/gi;

/**
 * `预计30分` / `预计：2小时` / `预计用时 45 分钟`. A value that is not a number
 * followed by a known unit is not a marker, so `预计下周上线` stays a title.
 *
 * The leading `(^|\s)` boundary matters just as much as it does for the `~`
 * form: without it `上周预计30分` would be parsed as title 「上周」+ a 30-minute
 * estimate, silently rewriting an ordinary title. Group 1 is that boundary, so
 * the amount/unit groups line up with the tilde pattern.
 */
const ESTIMATE_EXPLICIT_PATTERN = /(^|\s)(?:预计用时|预计)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(分钟|分|min|m|小时|时|h)(?=\s|[，,。.、；;：:！!？?]|$)/gi;

/** Unit → minutes multiplier for an estimate marker. */
const ESTIMATE_UNIT_FACTOR = Object.freeze({
  m: 1,
  min: 1,
  分: 1,
  分钟: 1,
  h: 60,
  时: 60,
  小时: 60,
});

/**
 * The two estimate marker shapes, as `[pattern, amountGroup, unitGroup]`: the
 * tilde form keeps its leading boundary as group 1, hence the different groups.
 *
 * @type {ReadonlyArray<[RegExp, number, number]>}
 */
const ESTIMATE_TOKEN_PATTERNS = Object.freeze([
  [ESTIMATE_TILDE_PATTERN, 2, 3],
  [ESTIMATE_EXPLICIT_PATTERN, 2, 3],
]);

/**
 * Minutes for one `<amount><unit>` estimate token, or null when the value is not
 * a usable estimate (non-numeric, or outside `1..MAX_ESTIMATE_MINUTES`).
 * A decimal amount is rounded to whole minutes, so `~1.5h` is 90.
 */
function estimateMinutesOf(amount, unit) {
  const factor = ESTIMATE_UNIT_FACTOR[String(unit ?? '').toLowerCase()] ?? 0;
  if (factor === 0) return null;
  const minutes = Math.round(Number(amount) * factor);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > MAX_ESTIMATE_MINUTES) return null;
  return minutes;
}

/**
 * Collect the estimate marker (`~30m` / `预计：2小时` …).
 * Leftmost valid marker wins, exactly like the priority/type markers; every
 * valid marker is stripped from the text that becomes the title, while an
 * out-of-range value is left untouched as ordinary title text.
 */
function collectEstimate(line) {
  const candidates = [];
  for (const [pattern, amountIndex, unitIndex] of ESTIMATE_TOKEN_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of line.matchAll(pattern)) {
      const value = estimateMinutesOf(match[amountIndex], match[unitIndex]);
      if (value === null) continue;
      candidates.push({
        index: (match.index ?? 0) + String(match[1] ?? '').length,
        value,
        text: match[0],
      });
    }
  }
  candidates.sort((left, right) => left.index - right.index);
  const estimateMinutes = candidates.length > 0 ? candidates[0].value : null;
  return { estimateMinutes, rest: stripByOffsets(line, candidates) };
}

/** True when `text` contains a usable estimate marker (`~30m` / `预计 2 小时`). */
export function hasEstimateMarker(text) {
  if (typeof text !== 'string' || text === '') return false;
  for (const [pattern, amountIndex, unitIndex] of ESTIMATE_TOKEN_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      if (estimateMinutesOf(match[amountIndex], match[unitIndex]) !== null) return true;
    }
  }
  return false;
}

/**
 * Strip already-collected marker candidates out of `line` by **offset**, from the
 * end backwards, instead of `String.replace(text, ' ')`.
 *
 * `replace` rewrites the first occurrence of that substring, which is the wrong
 * spot whenever the same marker text appears twice: `写周报 ~30m中 复盘 ~30m`
 * would strip the second `~30m` and leave the first one in the title. Slicing by
 * the recorded match offsets is exact and cannot collide. Overlapping candidates
 * (a rare self-overlap) are dropped in favour of the leftmost one.
 *
 * @param {string} line
 * @param {{ index: number, text: string }[]} candidates
 * @returns {string}
 */
function stripByOffsets(line, candidates) {
  const spans = [];
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate.index) || typeof candidate.text !== 'string' || candidate.text === '') continue;
    spans.push({ start: candidate.index, end: candidate.index + candidate.text.length });
  }
  spans.sort((left, right) => right.start - left.start);
  let rest = line;
  let ceiling = Infinity;
  for (const span of spans) {
    if (span.end > ceiling) continue;
    rest = `${rest.slice(0, span.start)} ${rest.slice(span.end)}`;
    ceiling = span.start;
  }
  return rest;
}

/** Strip repeated filler words from the start of a line. */
export function stripFillers(text) {
  let current = String(text ?? '');
  for (let i = 0; i < 8; i += 1) {
    const next = current.replace(FILLER_PATTERN, '');
    if (next === current) break;
    current = next;
  }
  return current;
}

/**
 * True when a raw string carries quick-add markers, so a plain `POST /create`
 * (form submit, tool call, curl) can be parsed the same way as the chat panel:
 * a leading `#`/`@` token, a `[category]`, `项目：`/`分类：`, a line break or `；`.
 *
 * `C#学习` is deliberately NOT a marker: `#`/`@` must start the string or follow
 * whitespace.
 */
export function hasQuickAddMarkers(text) {
  if (typeof text !== 'string' || text === '') return false;
  if (hasPriorityMarker(text)) return true;
  if (hasTypeMarker(text)) return true;
  if (hasEstimateMarker(text)) return true;
  return /(^|\s)[#@]|\[[^[\]]*\]|(?:项目|分类)\s*[:：]|[\r\n]|；|;/.test(text);
}

/** True when an `@token` should be read as a workspace file instead of a category. */
export function looksLikeFilePath(token, knownFiles) {
  if (typeof token !== 'string' || token === '') return false;
  if (token.includes('/') || token.includes('\\')) return true;
  if (KNOWN_FILE_EXTENSION.test(token)) return true;
  if (knownFiles instanceof Set) {
    const normalized = token.replace(/\\/g, '/');
    if (knownFiles.has(normalized) || knownFiles.has(`./${normalized}`)) return true;
  }
  return false;
}

/** Normalize and validate one workspace-relative file path; '' when unusable. */
export function normalizeFilePath(input) {
  if (typeof input !== 'string') return '';
  let value = input.trim().replace(/\\/g, '/');
  if (value === '') return '';
  if (value.startsWith('//')) return ''; // UNC path
  if (/^[a-zA-Z]:/.test(value)) return ''; // drive-absolute or drive-relative path
  if (value.startsWith('/')) return ''; // posix-absolute path
  while (value.startsWith('./')) value = value.slice(2);
  value = value.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  if (value === '' || value === '.') return '';
  const segments = value.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) return '';
  if (value.length > 300) return '';
  if (/[\u0000-\u001f\u007f]/.test(value)) return '';
  return value;
}

function collectFiles(line, knownFiles) {
  const files = [];
  let rest = line;
  // Quoted form first: `@"dir/My File.ts"` is always a file reference, even when
  // the path contains spaces.
  const quotedPattern = /(^|\s)@"([^"]+)"/g;
  for (const match of [...line.matchAll(quotedPattern)]) {
    const normalized = normalizeFilePath(match[2]);
    if (normalized !== '' && !files.includes(normalized)) files.push(normalized);
    rest = rest.replace(match[0], ' ');
  }
  const pattern = /(^|\s)@([^\s@]+)/g;
  for (const match of [...rest.matchAll(pattern)]) {
    const token = match[2];
    if (!looksLikeFilePath(token, knownFiles)) continue;
    const normalized = normalizeFilePath(token);
    if (normalized !== '' && !files.includes(normalized)) files.push(normalized);
    rest = rest.replace(match[0], ' ');
  }

  // Bare workspace paths are accepted too (no `@` needed), which is what makes
  // `/todo 写周报 lib/store.js` pleasant in the slash-command input: that input
  // has no `@` completion, so users can just type the path. Only an exact match
  // against the workspace index is treated as a file, so ordinary words and
  // titles are never swallowed.
  if (knownFiles instanceof Set && knownFiles.size > 0) {
    const kept = [];
    for (const token of rest.split(/\s+/)) {
      if (token === '') continue;
      const normalized = normalizeFilePath(token);
      if (normalized !== '' && knownFiles.has(normalized)) {
        if (!files.includes(normalized)) files.push(normalized);
        continue;
      }
      kept.push(token);
    }
    rest = kept.join(' ');
  }

  return { files, rest };
}

function collectProject(line) {
  // Leftmost marker wins: predictable for users and matches how the panel used
  // to behave (`买牛奶 @生活 @工作` -> 生活).
  const candidates = [];
  const patterns = [
    { pattern: /(?:项目|分类)\s*[:：]\s*([^\s，,；;]+)/g, valueIndex: 1 },
    { pattern: /\[([^[\]]*)\]/g, valueIndex: 1 },
    { pattern: /#([^\s#，,；;]+)/g, valueIndex: 1 },
    { pattern: /(^|\s)@([^\s@]+)/g, valueIndex: 2 },
  ];
  for (const { pattern, valueIndex } of patterns) {
    for (const match of line.matchAll(pattern)) {
      candidates.push({
        index: match.index ?? 0,
        value: String(match[valueIndex] ?? '').trim(),
        text: match[0],
      });
    }
  }
  candidates.sort((left, right) => left.index - right.index);
  const project = candidates.find((candidate) => candidate.value !== '')?.value ?? '';
  let rest = line;
  for (const candidate of candidates) {
    rest = rest.replace(candidate.text, ' ');
  }
  return { project, rest };
}

/**
 * Collect the priority marker (`!high` etc.).
 * Leftmost non-empty value wins, exactly like the project markers; every marker
 * occurrence is stripped from the text that becomes the title.
 */
function collectPriority(line) {
  PRIORITY_MARKER_PATTERN.lastIndex = 0;
  const candidates = [];
  for (const match of line.matchAll(PRIORITY_MARKER_PATTERN)) {
    const marker = String(match[2] ?? '').toLowerCase();
    candidates.push({
      index: (match.index ?? 0) + String(match[1] ?? '').length,
      value: PRIORITY_MARKERS[marker] ?? '',
      text: match[0],
    });
  }
  candidates.sort((left, right) => left.index - right.index);
  const priority = candidates.find((candidate) => candidate.value !== '')?.value ?? '';
  return { priority, rest: stripByOffsets(line, candidates) };
}

/**
 * Collect the type marker (`^bug` / `类型：bug` …).
 * Leftmost recognized value wins, exactly like the project/priority markers;
 * every recognized marker is stripped from the text that becomes the title.
 */
function collectType(line) {
  TYPE_MARKER_PATTERN.lastIndex = 0;
  const candidates = [];
  for (const match of line.matchAll(TYPE_MARKER_PATTERN)) {
    const value = canonicalType(match[2]);
    if (value === '') continue;
    candidates.push({
      index: (match.index ?? 0) + String(match[1] ?? '').length,
      value,
      text: match[0],
    });
  }
  for (const match of line.matchAll(TYPE_EXPLICIT_PATTERN)) {
    const value = canonicalType(match[1] ?? match[3]);
    if (value === '') continue;
    const leading = match[1] !== undefined ? 0 : String(match[2] ?? '').length;
    candidates.push({ index: (match.index ?? 0) + leading, value, text: match[0] });
  }
  candidates.sort((left, right) => left.index - right.index);
  const type = candidates.find((candidate) => candidate.value !== '')?.value ?? '';
  return { type, rest: stripByOffsets(line, candidates) };
}

function cleanTitle(text) {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .replace(TITLE_EDGE_PUNCTUATION, '')
    .trim();
}

/**
 * Parse one quick-add line.
 * @returns {{ title: string, project: string, files: string[], priority: string, type: string, estimateMinutes: number | null, line: string }}
 */
export function parseQuickAddLine(line, options = {}) {
  const knownFiles = options.knownFiles instanceof Set ? options.knownFiles : new Set();
  const original = String(line ?? '').trim();
  const filesResult = collectFiles(original, knownFiles);
  const projectResult = collectProject(filesResult.rest);
  const priorityResult = collectPriority(projectResult.rest);
  const typeResult = collectType(priorityResult.rest);
  const estimateResult = collectEstimate(typeResult.rest);
  const stripped = stripFillers(estimateResult.rest);
  const title = cleanTitle(stripped);
  return {
    title,
    project: projectResult.project,
    files: filesResult.files,
    priority: priorityResult.priority,
    type: typeResult.type,
    estimateMinutes: estimateResult.estimateMinutes,
    line: original,
  };
}

/**
 * Parse multi-line quick-add input.
 * @returns {{ items: Array<{title: string, project: string, files: string[], priority: string, type: string, estimateMinutes: number | null}>, skipped: Array<{line: string, reason: string}> }}
 */
export function parseQuickAdd(text, options = {}) {
  const raw = typeof text === 'string' ? text : '';
  const chunks = raw.split(/\r?\n|；|;/).map((chunk) => chunk.trim()).filter((chunk) => chunk !== '');
  const items = [];
  const skipped = [];
  for (const chunk of chunks) {
    const parsed = parseQuickAddLine(chunk, options);
    if (parsed.title === '') {
      skipped.push({ line: chunk, reason: 'NO_CONTENT' });
      continue;
    }
    items.push({
      title: parsed.title,
      project: parsed.project,
      files: parsed.files,
      priority: parsed.priority,
      type: parsed.type,
      estimateMinutes: parsed.estimateMinutes,
    });
  }
  return { items, skipped };
}
