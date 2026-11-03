/**
 * Read-only workspace file index for 「待办时间日志」 (dsh-todo-time-log).
 *
 * Powers the UI's `@` autocomplete (POST /files) and lets the quick-add parser
 * recognize a bare `@README.md` as a file reference. Enumeration goes through the
 * Harness `fs` service (the composed, sandbox-aware filesystem) instead of raw
 * Node fs, and is bounded in depth and entry count so one request can never walk
 * a whole drive:
 *
 *   depth    <= 4
 *   entries  <= 2000 candidates, then `truncated: true`
 *   skipped  node_modules/.git/dist/... and any dot-directory
 *   cache    <= 20s per root, invalidated explicitly after a write if needed
 *
 * The root is fixed by the Host (configured `workspaceRoot` or the Session
 * working directory). Clients cannot ask for an arbitrary path, so a browser
 * cannot use this endpoint to browse the machine.
 */

export const IGNORED_DIRECTORIES = Object.freeze([
  'node_modules',
  '.git',
  '.hg',
  '.svn',
  'dist',
  'build',
  'out',
  'coverage',
  'target',
  '.next',
  '.nuxt',
  '.output',
  '.venv',
  'venv',
  '__pycache__',
  '.idea',
  '.vscode',
  '.turbo',
  '.cache',
]);

const IGNORED_SET = new Set(IGNORED_DIRECTORIES);
export const MAX_FILE_INDEX_DEPTH = 4;
export const MAX_FILE_INDEX_ENTRIES = 2000;
export const FILE_INDEX_TTL_MS = 20_000;

function joinRelative(base, name) {
  return base === '' ? name : `${base}/${name}`;
}

/**
 * @param {object} options
 * @param {() => string} options.getRoot  returns the absolute workspace root
 * @param {{ resolve: Function, listDir: Function }} options.fsService  Harness `fs`
 * @param {{ warn?: Function, error?: Function } | null} [options.logger]
 * @param {() => number} [options.now]
 */
export function createFileIndex(options) {
  const { getRoot, fsService, logger = null, now = () => Date.now() } = options;
  let cache = null;

  function invalidate() {
    cache = null;
  }

  async function build(explicitRoot) {
    const root = typeof explicitRoot === 'string' && explicitRoot !== '' ? explicitRoot : getRoot();
    if (!cache || cache.root !== root || now() - cache.at >= FILE_INDEX_TTL_MS) {
      cache = { root, files: [], truncated: false, at: now() };
      const rootTarget = await fsService.resolve(root);
      const queue = [{ target: rootTarget, relative: '', depth: 0 }];
      const files = [];
      let truncated = false;
      while (queue.length > 0) {
        if (files.length >= MAX_FILE_INDEX_ENTRIES) {
          truncated = true;
          break;
        }
        const item = queue.shift();
        let entries;
        try {
          entries = await fsService.listDir(item.target);
        } catch (error) {
          logger?.warn?.(`todo-time-log: listDir failed for ${item.relative || '.'}: ${error?.message ?? error}`);
          continue;
        }
        for (const entry of entries) {
          if (entry.type === 'directory') {
            const name = entry.name;
            if (name.startsWith('.') || IGNORED_SET.has(name)) continue;
            if (item.depth + 1 > MAX_FILE_INDEX_DEPTH) {
              truncated = true;
              continue;
            }
            queue.push({ target: entry.target, relative: joinRelative(item.relative, name), depth: item.depth + 1 });
            continue;
          }
          if (entry.type !== 'file') continue;
          files.push(joinRelative(item.relative, entry.name));
          if (files.length >= MAX_FILE_INDEX_ENTRIES) {
            truncated = true;
            break;
          }
        }
      }
      files.sort((left, right) => left.localeCompare(right));
      cache = { root, files, truncated, at: now() };
    }
    return cache;
  }

  /** @returns {Promise<{root: string, files: string[], total: number, truncated: boolean}>} */
  async function list(request = {}) {
    const query = typeof request.query === 'string' ? request.query.trim().toLowerCase() : '';
    const requestedLimit = Number(request.limit);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(200, Math.trunc(requestedLimit))) : 30;
    const built = await build(request.root);
    const matched = query === ''
      ? built.files
      : built.files.filter((file) => file.toLowerCase().includes(query));
    return {
      root: built.root,
      files: matched.slice(0, limit),
      total: matched.length,
      truncated: built.truncated || matched.length > limit,
    };
  }

  /**
   * Top-level directories of a workspace, used as project/category suggestions
   * (`lib`, `src`, `packages`, ...). Hidden and well-known build/vendor
   * directories are skipped, and the result is capped so the picker stays short.
   */
  async function listDirectories(request = {}) {
    const explicitRoot = typeof request.root === 'string' ? request.root : undefined;
    const requestedLimit = Number(request.limit);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(100, Math.trunc(requestedLimit))) : 40;
    const root = typeof explicitRoot === 'string' && explicitRoot !== '' ? explicitRoot : getRoot();
    const target = await fsService.resolve(root);
    const entries = await fsService.listDir(target);
    return entries
      .filter((entry) => entry.type === 'directory')
      .map((entry) => entry.name)
      .filter((name) => !name.startsWith('.') && !IGNORED_SET.has(name))
      .sort((left, right) => left.localeCompare(right))
      .slice(0, limit);
  }

  /** Known file set for the parser (cached enumeration; empty on failure). */
  async function knownFileSet(explicitRoot) {
    try {
      const built = await build(explicitRoot);
      return new Set(built.files);
    } catch (error) {
      logger?.warn?.(`todo-time-log: file index unavailable: ${error?.message ?? error}`);
      return new Set();
    }
  }

  return { list, listDirectories, knownFileSet, invalidate };
}
