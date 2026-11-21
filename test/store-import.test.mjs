/**
 * Store-level import/restore tests: merge modes, backups, restore safety and
 * the MAX_TODOS guard. Exercised against real files in a temp directory.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MAX_TODOS, TodoStore } from '../lib/store.js';
import { exportTodoData, parseImportText } from '../lib/transfer.js';

function check(name, condition, detail) {
  const message = detail === undefined
    ? undefined
    : typeof detail === 'string' ? detail : inspect(detail, { depth: 4, breakLength: 160 });
  test(name, () => {
    assert.ok(Boolean(condition), message);
  });
}

const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ttl-import-'));
const sourceFile = path.join(dir, 'source.json');
const targetFile = path.join(dir, 'target.json');
const targetBase = path.basename(targetFile);
let clock = Date.parse('2026-11-06T00:00:00.000Z');
const now = () => clock;

const source = new TodoStore({ dataFile: sourceFile, now });
await source.load();
const sourceA = await source.create({ title: '任务 A', project: '工作', priority: 'high', estimateMinutes: 45 });
clock += 60_000;
const sourceB = await source.create({ title: '任务 B', type: 'bug' });
clock += 60_000;
await source.complete(sourceB.todo.id);
clock += 60_000;
// A third record stays 未完成 but 搁置, so the import must round-trip both v6 fields.
const sourceC = await source.create({ title: '任务 C（搁置）', estimateMinutes: 15 });
clock += 60_000;
await source.archive(sourceC.todo.id);
// `list('all')` hides 搁置 items, so a whole-dataset export uses `snapshot()`.
const sourceTodos = (await source.snapshot()).todos;
check('snapshot includes the shelved todo', sourceTodos.length === 3, sourceTodos.map((todo) => todo.title));
const sourceJson = exportTodoData(sourceTodos, { format: 'json', now: clock });
const parsed = parseImportText(sourceJson.content);

const target = new TodoStore({ dataFile: targetFile, now });
await target.load();

async function fileExists(file) {
  try {
    await fsp.stat(file);
    return true;
  } catch {
    return false;
  }
}

// ---- dry run --------------------------------------------------------------

const dry = await target.importTodos(parsed.records, { mode: 'merge', dryRun: true });
check('dry run ok', dry.ok === true && dry.dryRun === true, dry);
check('dry run counts additions', dry.summary?.added === 3 && dry.summary?.changed === true, dry.summary);
check('dry run does not mutate memory', target.size === 0, target.size);
check('dry run does not write the data file', (await fileExists(targetFile)) === false);

// ---- merge ----------------------------------------------------------------

const applied = await target.importTodos(parsed.records, { mode: 'merge' });
check('merge import ok', applied.ok === true && applied.persisted === true, applied);
check('merge import summary', applied.summary?.added === 3, applied.summary);
check('merge import writes records', target.size === 3, target.size);
check('first import has no backup (no file yet)', applied.backup === null, applied.backup);
check('import notice mentions counts', (applied.notices ?? []).some((line) => line.includes('新增 3 条')), applied.notices);

const again = await target.importTodos(parsed.records, { mode: 'merge' });
check('re-import is a no-op', again.summary?.changed === false && again.summary?.skipped === 3, again.summary);
check('re-import keeps the file', target.size === 3);

// ---- v6 fields survive export -> import --------------------------------

const importedA = await target.get(sourceA.todo.id);
check('import keeps estimateMinutes', importedA.todo?.estimateMinutes === 45, importedA.todo);
const importedC = await target.get(sourceC.todo.id);
check(
  'import keeps the shelved state',
  importedC.todo?.archivedAt !== null && importedC.todo?.archivedAt !== undefined,
  importedC.todo,
);
check(
  'imported shelved todo stays out of the active list',
  (await target.list({ filter: 'all' })).todos.every((todo) => todo.id !== sourceC.todo.id),
);
const archivedOnly = await target.list({ filter: 'archived' });
check(
  'imported shelved todo shows in the archived filter',
  archivedOnly.todos.some((todo) => todo.id === sourceC.todo.id) && archivedOnly.stats.archived === 1,
  archivedOnly.stats,
);

// ---- merge: newer wins, older is skipped ---------------------------------

const baseRecord = parsed.records.find((todo) => todo.id === sourceA.todo.id);
const newer = {
  ...baseRecord,
  title: '任务 A（更新）',
  updatedAt: new Date(clock + 5 * 60_000).toISOString(),
};
const mergedNewer = await target.importTodos([newer], { mode: 'merge' });
const mergedNewerTodo = await target.get(sourceA.todo.id);
check('newer record replaces the existing one', mergedNewer.summary?.updated === 1, mergedNewer.summary);
check('newer title is stored', mergedNewerTodo.todo?.title === '任务 A（更新）', mergedNewerTodo.todo?.title);

const older = {
  ...baseRecord,
  title: '任务 A（旧）',
  updatedAt: new Date(clock - 5 * 60_000).toISOString(),
};
const mergedOlder = await target.importTodos([older], { mode: 'merge' });
const stillNewer = await target.get(sourceA.todo.id);
check('older record is skipped', mergedOlder.summary?.skipped === 1, mergedOlder.summary);
check('skipped record keeps the newer title', stillNewer.todo?.title === '任务 A（更新）');

// ---- add-only -------------------------------------------------------------

const addOnly = await target.importTodos([{ ...older, updatedAt: newer.updatedAt }], { mode: 'add' });
check('add mode skips existing ids', addOnly.summary?.skipped === 1 && addOnly.summary?.added === 0, addOnly.summary);
check('add mode leaves the record unchanged', (await target.get(sourceA.todo.id)).todo?.title === '任务 A（更新）');

// ---- replace + backup + restore ------------------------------------------

const replaceWith = parsed.records.filter((todo) => todo.id === sourceB.todo.id);
const replaced = await target.importTodos(replaceWith, { mode: 'replace' });
check('replace import ok', replaced.ok === true, replaced);
check('replace removes the other records', replaced.summary?.removed === 2 && replaced.summary?.total === 1, replaced.summary);
check('replace creates a backup', typeof replaced.backup === 'string' && replaced.backup.startsWith(`${targetBase}.bak-`), replaced.backup);
check('backup file exists on disk', await fileExists(path.join(dir, replaced.backup)), replaced.backup);
check('replace leaves one record', target.size === 1, target.size);

const restored = await target.restoreBackup(replaced.backup);
check('restore ok', restored.ok === true && restored.restored === 3, restored);
check('restore brings both records back', target.size === 3, target.size);
check('restore creates a safety backup', typeof restored.backup === 'string' && restored.backup.startsWith(`${targetBase}.bak-`), restored.backup);
check('restore notice', (restored.notices ?? []).some((line) => line.includes('已从备份恢复 3 条')), restored.notices);
check(
  'restore brings the v6 fields back',
  (await target.get(sourceA.todo.id)).todo?.estimateMinutes === 45
    && (await target.get(sourceC.todo.id)).todo?.archivedAt !== null,
  (await target.list({ filter: 'archived' })).todos,
);

// ---- refresh sees another instance's write -------------------------------

const reader = new TodoStore({ dataFile: targetFile, now });
await reader.load();
check('reader started from the same three records', reader.size === 3, reader.size);
clock += 60_000;
const added = await target.create({ title: '任务 C' });
check('target created a third record', added.ok === true);
await reader.refresh();
check('refresh merges the other instance write', reader.size === 4, reader.size);
const readerList = await reader.list({});
check('refreshed list contains the new record', readerList.todos.some((todo) => todo.title === '任务 C'));

// ---- restore validation ---------------------------------------------------

const emptyName = await target.restoreBackup('');
check('empty backup name rejected', emptyName.ok === false && emptyName.code === 'BACKUP_INVALID', emptyName);
const traversal = await target.restoreBackup('../todos.json');
check('path traversal rejected', traversal.ok === false && traversal.code === 'BACKUP_INVALID', traversal);
const wrongPrefix = await target.restoreBackup('source.json.bak-x');
check('foreign backup prefix rejected', wrongPrefix.ok === false && wrongPrefix.code === 'BACKUP_INVALID', wrongPrefix);
const missing = await target.restoreBackup(`${targetBase}.bak-20260101-000000-000`);
check('missing backup rejected', missing.ok === false && missing.code === 'BACKUP_INVALID', missing);

const corruptName = `${targetBase}.bak-corrupt-test`;
await fsp.writeFile(path.join(dir, corruptName), '{oops', 'utf8');
const corrupt = await target.restoreBackup(corruptName);
check('corrupt backup rejected', corrupt.ok === false && corrupt.code === 'BACKUP_INVALID', corrupt);

// ---- limits ---------------------------------------------------------------

const tooMany = await target.importTodos(
  Array.from({ length: MAX_TODOS + 1 }, (_, index) => ({
    ...parsed.records[0],
    id: `ttl_overflow_${index}`,
  })),
  { mode: 'merge', dryRun: true },
);
check('oversized import rejected', tooMany.ok === false && tooMany.code === 'TOO_MANY_TODOS', tooMany);

// ---- cleanup --------------------------------------------------------------

await source.dispose();
await target.dispose();
await reader.dispose();
await fsp.rm(dir, { recursive: true, force: true });
