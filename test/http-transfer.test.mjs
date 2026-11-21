/**
 * HTTP tests for the import/export surface:
 *   POST /export  { format: 'json' | 'csv' }
 *   POST /import  { content, format?, mode?, dryRun? }
 *   POST /restore { file }
 *
 * Runs a real HTTP server around `createHttpHandler` and a throwaway data file,
 * mirroring the browser half exactly.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import http from 'node:http';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TodoStore } from '../lib/store.js';
import { createHttpHandler, ROUTE_PREFIX } from '../lib/index.js';

function check(name, condition, detail) {
  const message = detail === undefined
    ? undefined
    : typeof detail === 'string' ? detail : inspect(detail, { depth: 4, breakLength: 160 });
  test(name, () => {
    assert.ok(Boolean(condition), message);
  });
}

const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ttl-http-transfer-'));
const dataFile = path.join(dir, 'todos.json');
const store = new TodoStore({ dataFile });
await store.load();
const server = http.createServer(createHttpHandler(store));
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

async function post(action, body) {
  const response = await fetch(`${origin}${ROUTE_PREFIX}/${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  return { status: response.status, body: await response.json() };
}

try {
  await store.create({ title: '种子任务' });

  // ---- export -------------------------------------------------------------

  const exported = await post('export', { format: 'json' });
  check('export json 200', exported.status === 200 && exported.body.ok === true, exported);
  const exportValue = exported.body.value ?? {};
  check('export json count', exportValue.count === 1, exportValue.count);
  check('export json filename', /^todos-\d{8}-\d{4}\.json$/.test(exportValue.filename), exportValue.filename);
  check('export json mime', String(exportValue.mime).startsWith('application/json'));
  let exportedEnvelope = null;
  try {
    exportedEnvelope = JSON.parse(exportValue.content);
  } catch {
    exportedEnvelope = null;
  }
  check(
    'export json content is a store envelope',
    exportedEnvelope !== null && exportedEnvelope.version === 6 && exportedEnvelope.todos.length === 1,
    exportedEnvelope,
  );
  check(
    'export json includes the v6 fields',
    exportedEnvelope !== null
      && exportedEnvelope.todos[0].archivedAt === null
      && exportedEnvelope.todos[0].estimateMinutes === null,
    exportedEnvelope?.todos?.[0],
  );

  const exportedCsv = await post('export', { format: 'csv' });
  check('export csv 200', exportedCsv.status === 200 && exportedCsv.body.ok === true, exportedCsv);
  check('export csv has BOM and header', String(exportedCsv.body.value?.content).startsWith('\uFEFF' + 'ID,标题'), String(exportedCsv.body.value?.content).slice(0, 20));
  check('export csv filename', /\.csv$/.test(String(exportedCsv.body.value?.filename)), exportedCsv.body.value?.filename);
  check(
    'export csv has the v6 columns',
    String(exportedCsv.body.value?.content).split('\r\n')[0].includes('预计(分钟),搁置时间'),
    String(exportedCsv.body.value?.content).split('\r\n')[0],
  );

  const badFormat = await post('export', { format: 'xml' });
  check('export unknown format 400', badFormat.status === 400, badFormat.status);
  check('export unknown format code', badFormat.body.error?.code === 'EXPORT_FORMAT_UNSUPPORTED', badFormat.body);

  // ---- import: dry run ----------------------------------------------------

  const newRecord = {
    id: 'ttl_import1',
    title: '导入任务',
    project: '工作',
    files: ['src/a.ts'],
    status: 'pending',
    priority: 'high',
    type: 'feature',
    createdAt: '2026-11-01T00:00:00.000Z',
    completedAt: null,
    updatedAt: '2026-11-01T00:00:00.000Z',
  };
  const importText = JSON.stringify({ version: 5, todos: [newRecord] });

  const dryRun = await post('import', { content: importText, mode: 'merge', dryRun: true });
  check('import dry run 200', dryRun.status === 200 && dryRun.body.ok === true, dryRun);
  check('import dry run flag', dryRun.body.value?.dryRun === true && dryRun.body.value?.summary?.added === 1, dryRun.body.value);
  const afterDryList = await post('list', {});
  check('dry run writes nothing', afterDryList.body.value?.stats?.total === 1, afterDryList.body.value?.stats);

  // ---- import: apply ------------------------------------------------------

  const applied = await post('import', { content: importText, mode: 'merge' });
  check('import apply 200', applied.status === 200 && applied.body.ok === true, applied);
  check('import apply summary', applied.body.value?.summary?.added === 1, applied.body.value?.summary);
  check('import apply reports format', applied.body.value?.format === 'json', applied.body.value?.format);
  check(
    'import apply creates a backup',
    typeof applied.body.value?.backup === 'string'
      && applied.body.value.backup.startsWith('todos.json.bak-'),
    applied.body.value?.backup,
  );
  let backupExists = false;
  try {
    await fsp.stat(path.join(dir, applied.body.value.backup));
    backupExists = true;
  } catch {
    backupExists = false;
  }
  check('import backup exists on disk', backupExists);
  const afterApply = await post('list', {});
  check('import apply adds the record', afterApply.body.value?.stats?.total === 2, afterApply.body.value?.stats);

  const repeated = await post('import', { content: importText, mode: 'merge' });
  check('repeated import is skipped', repeated.body.value?.summary?.changed === false, repeated.body.value?.summary);
  check('repeated import has no backup', repeated.body.value?.backup === null, repeated.body.value?.backup);

  // ---- import: CSV --------------------------------------------------------

  const csvText = [
    '\uFEFF编号,标题,分类,状态,优先级,类型,创建时间,完成时间,更新时间',
    'ttl_csv1,CSV 任务,生活,已完成,低,改进,2026-10-01 09:00:00,2026-10-02 09:00:00,2026-10-02 09:00:00',
  ].join('\r\n');
  const csvImport = await post('import', { content: csvText, mode: 'merge' });
  check('CSV import 200', csvImport.status === 200 && csvImport.body.ok === true, csvImport);
  check('CSV import format', csvImport.body.value?.format === 'csv', csvImport.body.value?.format);
  const csvList = await post('list', {});
  const csvTodo = (csvList.body.value?.todos ?? []).find((todo) => todo.id === 'ttl_csv1');
  check(
    'CSV import maps Chinese values',
    csvTodo?.project === '生活' && csvTodo?.status === 'completed' && csvTodo?.priority === 'low' && csvTodo?.type === 'improvement',
    csvTodo,
  );

  // v6 fields survive an HTTP export -> import round trip.
  const v6Record = {
    id: 'ttl_import_v6',
    title: '六期导入任务',
    project: '工作',
    files: [],
    status: 'pending',
    priority: '',
    type: '',
    createdAt: '2026-11-02T00:00:00.000Z',
    completedAt: null,
    archivedAt: '2026-11-03T00:00:00.000Z',
    estimateMinutes: 90,
    updatedAt: '2026-11-03T00:00:00.000Z',
  };
  const v6Import = await post('import', {
    content: JSON.stringify({ version: 6, todos: [v6Record] }),
    mode: 'merge',
  });
  check('v6 envelope import 200', v6Import.status === 200 && v6Import.body.ok === true, v6Import);
  const v6List = await post('list', { filter: 'archived' });
  const v6Todo = (v6List.body.value?.todos ?? []).find((todo) => todo.id === 'ttl_import_v6');
  check(
    'imported v6 record keeps archivedAt and estimateMinutes',
    v6Todo?.archivedAt === '2026-11-03T00:00:00.000Z' && v6Todo?.estimateMinutes === 90,
    v6Todo,
  );
  // A shelved todo must not disappear from a download: /export snapshots the
  // whole dataset instead of reusing the active-list filter.
  const shelvedExportSeed = await store.create({ title: '导出用的搁置任务' });
  await store.archive(shelvedExportSeed.todo.id);
  const exportWithShelved = await post('export', { format: 'json' });
  const exportedWithShelved = JSON.parse(exportWithShelved.body.value.content);
  check(
    'export includes shelved todos',
    exportedWithShelved.todos.some((todo) => todo.id === shelvedExportSeed.todo.id && todo.archivedAt !== null),
    exportedWithShelved.todos.map((todo) => [todo.title, todo.archivedAt]),
  );
  check(
    'export count includes shelved todos',
    exportedWithShelved.count === exportedWithShelved.todos.length,
    [exportedWithShelved.count, exportedWithShelved.todos.length],
  );
  const exportCsvWithShelved = await post('export', { format: 'csv' });
  check(
    'CSV export includes shelved rows',
    String(exportCsvWithShelved.body.value?.content).includes('导出用的搁置任务'),
    String(exportCsvWithShelved.body.value?.content).split('\r\n').length,
  );
  // The exported CSV carries both new columns back through /import.
  const v6CsvExport = await post('export', { format: 'csv' });
  const v6CsvRoundTrip = await post('import', { content: v6CsvExport.body.value.content, mode: 'merge' });
  check('v6 CSV export re-imports', v6CsvRoundTrip.status === 200 && v6CsvRoundTrip.body.ok === true, v6CsvRoundTrip);
  const v6AfterRoundTrip = await post('list', { filter: 'archived' });
  const v6RoundTripTodo = (v6AfterRoundTrip.body.value?.todos ?? []).find((todo) => todo.id === 'ttl_import_v6');
  check(
    'CSV round trip keeps the v6 fields',
    v6RoundTripTodo?.estimateMinutes === 90 && v6RoundTripTodo?.archivedAt === '2026-11-03T00:00:00.000Z',
    v6RoundTripTodo,
  );

  // Unknown mode falls back to merge.
  const bogusMode = await post('import', { content: importText, mode: 'bogus' });
  check('unknown mode falls back to merge', bogusMode.body.value?.mode === 'merge', bogusMode.body.value?.mode);

  // ---- import: errors -----------------------------------------------------

  const empty = await post('import', { content: '   ' });
  check('empty import 400', empty.status === 400 && empty.body.error?.code === 'IMPORT_EMPTY', empty);
  const broken = await post('import', { content: '{oops' });
  check('broken import 400', broken.status === 400 && broken.body.error?.code === 'IMPORT_INVALID', broken);
  const version = await post('import', { content: JSON.stringify({ version: 99, todos: [] }) });
  check('unsupported version 400', version.status === 400 && version.body.error?.code === 'IMPORT_VERSION_UNSUPPORTED', version);

  // Import accepts up to 8 MiB; anything larger is a readable 413 (not a reset).
  const oversizedResponse = await fetch(`${origin}${ROUTE_PREFIX}/import`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: 'x'.repeat(9 * 1024 * 1024) }),
  });
  const oversizedBody = await oversizedResponse.json();
  check('oversized import 413', oversizedResponse.status === 413, oversizedResponse.status);
  check('oversized import code', oversizedBody.error?.code === 'PAYLOAD_TOO_LARGE', oversizedBody);

  // ---- restore ------------------------------------------------------------

  const restored = await post('restore', { file: applied.body.value.backup });
  check('restore 200', restored.status === 200 && restored.body.ok === true, restored);
  check('restore count', restored.body.value?.restored === 1, restored.body.value);
  const afterRestore = await post('list', {});
  check('restore rolls the import back', afterRestore.body.value?.stats?.total === 1, afterRestore.body.value?.stats);

  const traversal = await post('restore', { file: '../todos.json' });
  check('restore traversal 400', traversal.status === 400 && traversal.body.error?.code === 'BACKUP_INVALID', traversal);

  // Unknown action text mentions the new routes.
  const unknown = await post('bogus', {});
  check('unknown action lists export', String(unknown.body.error?.message ?? '').includes('export'), unknown.body.error?.message);
} finally {
  await new Promise((resolve) => server.close(resolve));
  await store.dispose();
  await fsp.rm(dir, { recursive: true, force: true });
}
