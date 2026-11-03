/**
 * Time helpers for 「待办时间日志」 (dsh-todo-time-log).
 *
 * Display convention (product requirement):
 *   - local time, format `YYYY-MM-DD HH:mm:ss`
 *   - any missing / unparsable value renders as `-`
 *
 * Storage convention: timestamps are persisted as ISO-8601 UTC strings
 * (`new Date().toISOString()`), so they stay unambiguous across time zones and
 * across DST changes. Formatting happens at the edge (UI / tool output).
 *
 * NOTE (portability): `formatLocalDateTime` intentionally uses the Host / browser
 * local time zone. An explicit IANA zone is deliberately NOT supported yet: it
 * would need `Intl.DateTimeFormat` parts, which the renderer format does not
 * exercise. See `TODO(time-zone)` below for the adapter point.
 */

export const TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
export const EMPTY_TIME = '-';

/** Milliseconds since epoch for a timestamp-ish value, or null when unusable. */
export function parseTimestamp(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const text = value.trim();
    if (text === '') return null;
    const ms = Date.parse(text);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

export function isValidTimestamp(value) {
  return parseTimestamp(value) !== null;
}

/** Canonical ISO-8601 UTC string, or null when the input is unusable. */
export function toIsoString(value) {
  const ms = parseTimestamp(value);
  return ms === null ? null : new Date(ms).toISOString();
}

/** ISO string for "now"; accepts an injectable clock for tests. */
export function nowIso(now = Date.now()) {
  const ms = typeof now === 'number' ? now : parseTimestamp(now);
  return new Date(ms === null ? Date.now() : ms).toISOString();
}

function pad2(n) {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Format one timestamp for display: local time `YYYY-MM-DD HH:mm:ss`.
 * Empty / invalid values return `dash` (`-` by default).
 */
export function formatLocalDateTime(value, options = {}) {
  const { dash = EMPTY_TIME } = options;
  const ms = parseTimestamp(value);
  if (ms === null) return dash;
  const d = new Date(ms);
  // TODO(time-zone): swap this block for an Intl.DateTimeFormat(...).formatToParts
  // implementation if an explicit `timeZone` config is ever required.
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  );
}

/**
 * Compare two timestamps for sorting. Unusable values always sort last,
 * independent of direction, so "未完成" rows never scatter through the list.
 */
export function compareTimestamps(a, b) {
  const ma = parseTimestamp(a);
  const mb = parseTimestamp(b);
  if (ma === null && mb === null) return 0;
  if (ma === null) return 1;
  if (mb === null) return -1;
  return ma - mb;
}

/** Seconds elapsed between two timestamps, or null when either is unusable. */
export function secondsBetween(from, to) {
  const a = parseTimestamp(from);
  const b = parseTimestamp(to);
  if (a === null || b === null) return null;
  return Math.max(0, Math.round((b - a) / 1000));
}
