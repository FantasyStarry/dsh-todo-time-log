/**
 * Plugin preferences for the Client half, persisted next to the todo data file.
 *
 * Why a separate file instead of a field in `todos.json`:
 * - the todo envelope's `version` is a strict contract (older builds archive and
 *   rebuild unsupported versions), so a UI preference must not force a version
 *   bump or risk the todo data;
 * - preferences are written by the browser and read on every page load, while
 *   todos are written by both the UI and the agent tool — keeping them apart
 *   means a preference write can never disturb a todo write.
 *
 * Shape on disk (same directory as the data file, `<data>.settings.json`):
 *
 *   { "version": 1, "updatedAt": "2026-11-10T04:00:00.000Z", "settings": { "quickEntry": true } }
 *
 * The module is plain Node ESM (no `@deepseek-ai/*` imports) and every exported
 * pure function is unit-testable without touching the disk.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';

/** Current on-disk settings envelope version. */
export const SETTINGS_VERSION = 1;

/** Preference defaults: the quick entry is on unless the user turns it off. */
export const DEFAULT_SETTINGS = Object.freeze({ quickEntry: true });

/** Keys a client may write; everything else is ignored (forward compatible). */
export const SETTINGS_KEYS = Object.freeze(Object.keys(DEFAULT_SETTINGS));

/**
 * Resolve the settings file for a data file: `…/todos.json` → `…/todos.settings.json`.
 *
 * @param {string} dataFile - Absolute todo data file path.
 * @returns {string} Absolute settings file path.
 */
export function resolveSettingsFile(dataFile) {
  const dir = dirname(dataFile);
  const name = basename(dataFile);
  const ext = extname(name);
  const stem = ext === '' ? name : name.slice(0, -ext.length);
  return join(dir, `${stem}.settings.json`);
}

/**
 * Coerce an untrusted settings payload into the known preference shape.
 * Unknown keys are dropped; a wrong type falls back to the default so a corrupt
 * file never crashes the page (the client shows the default state instead).
 *
 * @param {unknown} raw
 * @returns {{ quickEntry: boolean }}
 */
export function normalizeSettings(raw) {
  const source = isRecord(raw) ? (isRecord(raw.settings) ? raw.settings : raw) : {};
  return {
    quickEntry: typeof source.quickEntry === 'boolean' ? source.quickEntry : DEFAULT_SETTINGS.quickEntry,
  };
}

/**
 * Validate a client patch. Only known keys are written; a present-but-wrong-type
 * field is rejected instead of silently ignored (that would freeze the switch
 * in a state the user did not choose).
 *
 * @param {unknown} raw
 * @returns {{ ok: true, patch: Record<string, boolean> } | { ok: false, code: string, message: string }}
 */
export function normalizeSettingsPatch(raw) {
  if (!isRecord(raw)) {
    return { ok: false, code: 'SETTINGS_INVALID', message: '设置补丁必须是对象' };
  }
  /** @type {Record<string, boolean>} */
  const patch = {};
  for (const key of SETTINGS_KEYS) {
    if (!(key in raw)) continue;
    const value = raw[key];
    if (typeof value !== 'boolean') {
      return { ok: false, code: 'SETTINGS_INVALID', message: `设置项 ${key} 必须是布尔值` };
    }
    patch[key] = value;
  }
  return { ok: true, patch };
}

/**
 * Create the settings store used by the HTTP routes.
 *
 * Reads are cached after the first successful load (preferences are tiny); a
 * missing file means "defaults". Writes are serialized on one promise chain and
 * land through a temporary file + rename so a crash cannot leave half JSON.
 *
 * @param {object} options
 * @param {string} options.file - Settings file path.
 * @param {{ warn?: (...args: any[]) => void, error?: (...args: any[]) => void }} [options.logger]
 * @returns {{
 *   file: string,
 *   read: () => Promise<{ quickEntry: boolean }>,
 *   update: (patch: unknown) => Promise<{ ok: boolean, settings?: { quickEntry: boolean }, code?: string, message?: string }>,
 *   describe: () => { file: string, lastPersistError: string },
 * }}
 */
export function createSettingsStore(options) {
  const file = options.file;
  const logger = options.logger ?? {};
  const warn = typeof logger.warn === 'function' ? logger.warn : () => {};
  const fail = typeof logger.error === 'function' ? logger.error : () => {};
  let cache = null;
  /** @type {Promise<any>} */
  let chain = Promise.resolve();
  let lastPersistError = '';

  const read = async () => {
    if (cache !== null) return { ...cache };
    try {
      const text = await readFile(file, 'utf8');
      cache = normalizeSettings(JSON.parse(text));
    } catch (error) {
      if (error && error.code !== 'ENOENT') {
        // 损坏 / 权限问题：不阻塞页面，按默认值工作，下一次写入会覆盖它。
        lastPersistError = error instanceof Error ? error.message : String(error);
        warn(`[dsh-todo-time-log] settings read failed (${file}): ${lastPersistError}`);
      }
      cache = { ...DEFAULT_SETTINGS };
    }
    return { ...cache };
  };

  /**
   * Serialize the whole read-modify-write transaction on the chain.
   *
   * The enqueue must happen synchronously at call time: if the queue position
   * were chosen after an `await`, concurrent callers would be ordered by I/O
   * completion instead of call order and the last write could carry an older
   * value. Each `run` converts write failures into `SETTINGS_WRITE_FAILED`, so
   * the chain never stays rejected and later updates still run.
   *
   * @param {unknown} patch
   * @returns {Promise<{ ok: boolean, settings?: { quickEntry: boolean }, code?: string, message?: string }>}
   */
  const update = (patch) => {
    const validated = normalizeSettingsPatch(patch);
    if (validated.ok !== true) return Promise.resolve(validated);
    const run = async () => {
      const current = await read();
      if (Object.keys(validated.patch).length === 0) {
        return { ok: true, settings: { ...current } };
      }
      const next = { ...current, ...validated.patch };
      try {
        await mkdir(dirname(file), { recursive: true });
        const body = `${JSON.stringify(
          { version: SETTINGS_VERSION, updatedAt: new Date().toISOString(), settings: next },
          null,
          2,
        )}\n`;
        const temp = `${file}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        try {
          await writeFile(temp, body, 'utf8');
          await rename(temp, file);
        } catch (error) {
          // Windows 下 rename 可能被占用；退化为直接覆盖写。
          try {
            await writeFile(file, body, 'utf8');
          } catch (fallbackError) {
            throw error ?? fallbackError;
          }
        }
      } catch (error) {
        lastPersistError = error instanceof Error ? error.message : String(error);
        fail('[dsh-todo-time-log] settings write failed', error);
        return { ok: false, code: 'SETTINGS_WRITE_FAILED', message: `写入设置失败：${lastPersistError}` };
      }
      cache = next;
      lastPersistError = '';
      return { ok: true, settings: { ...next } };
    };
    chain = chain.then(run, run);
    return chain;
  };

  const describe = () => ({ file, lastPersistError });

  return { file, read, update, describe };
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
