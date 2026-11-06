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
    exportedEnvelope !== null && exportedEnvelope.version === 5 && exportedEnvelope.todos.length === 1,
    exportedEnvelope,
  );

  const exportedCsv = await post('export', { format: 'csv' });
  check('export csv 200', exportedCsv.status === 200 && exportedCsv.body.ok === true, exportedCsv);
  check('export csv has BOM and header', String(exportedCsv.body.value?.content).startsWith('\uFEFF' + 'ID,标题'), String(exportedCsv.body.value?.content).slice(0, 20));
  check('export csv filename', /\.csv$/.test(String(exportedCsv.body.value?.filename)), exportedCsv.body.value?.filename);

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
