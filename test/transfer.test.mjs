/**
 * Pure import/export formatting tests (`lib/transfer.js`).
 *
 * No file system, no Host: every case is a string in, string/structure out.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import {
  buildExportCsv,
  buildExportJson,
  exportTodoData,
  parseImportText,
} from '../lib/transfer.js';
import { STORE_VERSION } from '../lib/store.js';

function check(name, condition, detail) {
  const message = detail === undefined
    ? undefined
    : typeof detail === 'string' ? detail : inspect(detail, { depth: 4, breakLength: 160 });
  test(name, () => {
    assert.ok(Boolean(condition), message);
  });
}

const NOW = Date.parse('2026-11-06T00:00:00.000Z');
const COMPLETED = {
  id: 'ttl_demo0001',
  title: '写周报, "含引号"',
  project: '工作',
  files: ['src/a.ts', 'docs/b.md'],
  status: 'completed',
  priority: 'high',
  type: 'chore',
  createdAt: '2026-11-05T01:00:00.000Z',
  completedAt: '2026-11-05T02:30:00.000Z',
  archivedAt: null,
  estimateMinutes: 45,
  updatedAt: '2026-11-05T02:30:00.000Z',
};
const PENDING = {
  id: 'ttl_demo0002',
  title: '待办 B',
  project: '',
  files: [],
  status: 'pending',
  priority: '',
  type: '',
  createdAt: '2026-11-05T03:00:00.000Z',
  completedAt: null,
  archivedAt: '2026-11-05T04:00:00.000Z',
  estimateMinutes: null,
  updatedAt: '2026-11-05T04:00:00.000Z',
};
const TODOS = [COMPLETED, PENDING];

// ---- JSON export ----------------------------------------------------------

const jsonText = buildExportJson(TODOS, { now: NOW });
const jsonEnvelope = JSON.parse(jsonText);
check('JSON envelope version is the store version', jsonEnvelope.version === STORE_VERSION, jsonEnvelope.version);
check('JSON envelope counts todos', jsonEnvelope.count === 2 && jsonEnvelope.todos.length === 2);
check('JSON export keeps ids', jsonEnvelope.todos[0].id === COMPLETED.id);
check('JSON export keeps completion time', jsonEnvelope.todos[0].completedAt === COMPLETED.completedAt);
check('JSON export has exporter metadata', jsonEnvelope.exporter?.name === 'dsh-todo-time-log');
check('JSON export ends with a newline', jsonText.endsWith('\n'));
check('JSON export version is 6', jsonEnvelope.version === 6, jsonEnvelope.version);
check(
  'JSON export writes both v6 fields',
  jsonEnvelope.todos[0].estimateMinutes === 45
    && jsonEnvelope.todos[0].archivedAt === null
    && jsonEnvelope.todos[1].archivedAt === '2026-11-05T04:00:00.000Z'
    && jsonEnvelope.todos[1].estimateMinutes === null,
  jsonEnvelope.todos,
);

const jsonRoundTrip = parseImportText(jsonText);
check('JSON round-trip parses', jsonRoundTrip.ok === true, jsonRoundTrip);
check('JSON round-trip keeps both records', jsonRoundTrip.records.length === 2, jsonRoundTrip.records);
check(
  'JSON round-trip keeps status',
  jsonRoundTrip.records.find((todo) => todo.id === COMPLETED.id)?.status === 'completed',
);
check(
  'JSON round-trip keeps files',
  jsonRoundTrip.records.find((todo) => todo.id === COMPLETED.id)?.files.length === 2,
);
check(
  'JSON round-trip keeps estimateMinutes',
  jsonRoundTrip.records.find((todo) => todo.id === COMPLETED.id)?.estimateMinutes === 45,
  jsonRoundTrip.records.find((todo) => todo.id === COMPLETED.id),
);
check(
  'JSON round-trip keeps archivedAt',
  jsonRoundTrip.records.find((todo) => todo.id === PENDING.id)?.archivedAt === '2026-11-05T04:00:00.000Z',
  jsonRoundTrip.records.find((todo) => todo.id === PENDING.id),
);

// ---- CSV export -----------------------------------------------------------

const csvText = buildExportCsv(TODOS);
check('CSV starts with a BOM', csvText.startsWith('\uFEFF'));
check('CSV uses CRLF', csvText.includes('\r\n'));
check('CSV has a Chinese header row', csvText.split('\r\n')[0].includes('标题'));
check('CSV quotes fields containing a comma', csvText.includes('"写周报, ""含引号"""'), csvText.slice(0, 200));
check('CSV joins files with a semicolon', csvText.includes('src/a.ts;docs/b.md'));
check('CSV exposes a duration column', csvText.split('\r\n')[0].includes('耗时(分钟)'));
check('CSV appends the estimate column after the duration', /耗时\(分钟\),预计\(分钟\),搁置时间/.test(csvText.split('\r\n')[0]), csvText.split('\r\n')[0]);
check('CSV writes the estimate value', csvText.split('\r\n')[1].split(',').includes('45'), csvText.split('\r\n')[1]);

const csvRoundTrip = parseImportText(csvText);
check('CSV round-trip parses', csvRoundTrip.ok === true, csvRoundTrip);
check('CSV round-trip keeps ids', csvRoundTrip.records.length === 2 && csvRoundTrip.records[0].id === COMPLETED.id);
check(
  'CSV round-trip restores escaped title',
  csvRoundTrip.records[0].title === '写周报, "含引号"',
  csvRoundTrip.records[0].title,
);
check(
  'CSV round-trip restores completion status and time',
  csvRoundTrip.records[0].status === 'completed'
    && csvRoundTrip.records[0].completedAt === COMPLETED.completedAt,
  csvRoundTrip.records[0],
);
check('CSV round-trip restores files', csvRoundTrip.records[0].files.join('|') === 'src/a.ts|docs/b.md');
check('CSV round-trip keeps unset priority empty', csvRoundTrip.records[1].priority === '');
check(
  'CSV round-trip keeps estimateMinutes',
  csvRoundTrip.records[0].estimateMinutes === 45,
  csvRoundTrip.records[0],
);
check(
  'CSV round-trip keeps archivedAt',
  csvRoundTrip.records[1].archivedAt === '2026-11-05T04:00:00.000Z',
  csvRoundTrip.records[1],
);
check('CSV round-trip keeps a missing estimate null', csvRoundTrip.records[1].estimateMinutes === null, csvRoundTrip.records[1]);

// local naive timestamps are interpreted in local time
const localCsv = [
  '\uFEFF标题,分类,状态,创建时间',
  '本地时间任务,工作,已完成,2026-11-05 17:30:00',
].join('\r\n');
const localParsed = parseImportText(localCsv);
const expectedLocalIso = new Date(2026, 10, 5, 17, 30, 0).toISOString();
check(
  'CSV naive timestamp is local time',
  localParsed.ok === true && localParsed.records[0].createdAt === expectedLocalIso,
  localParsed.records?.[0],
);

// Chinese aliases + unknown columns are tolerated
const aliasCsv = [
  '\uFEFF编号,标题,分类,文件,状态,优先级,类型,创建时间,完成时间,更新时间,备注',
  'ttl_alias1,别名任务,生活,a.ts;b.ts,未完成,高,缺陷,2026-11-01 09:00:00,,2026-11-01 09:00:00,忽略我',
].join('\r\n');
const aliasParsed = parseImportText(aliasCsv);
check(
  'CSV Chinese aliases map onto fields',
  aliasParsed.ok === true
    && aliasParsed.records[0].project === '生活'
    && aliasParsed.records[0].priority === 'high'
    && aliasParsed.records[0].type === 'bug'
    && aliasParsed.records[0].files.length === 2,
  aliasParsed.records?.[0],
);

// a CSV without the v6 columns imports with null (missing column = null)
const legacyCsv = [
  '\uFEFFID,标题,分类,文件,状态,优先级,类型,创建时间,完成时间,更新时间,耗时(分钟)',
  'ttl_legacy1,旧表任务,工作,,已完成,高,缺陷,2026-11-01 09:00:00,2026-11-02 09:00:00,2026-11-02 09:00:00,120',
].join('\r\n');
const legacyCsvParsed = parseImportText(legacyCsv);
check(
  'CSV without the v6 columns imports as null',
  legacyCsvParsed.ok === true
    && legacyCsvParsed.records[0].archivedAt === null
    && legacyCsvParsed.records[0].estimateMinutes === null,
  legacyCsvParsed.records?.[0],
);
check(
  'CSV without the v6 columns needs no repair notice',
  !(legacyCsvParsed.notices ?? []).some((notice) => notice.includes('修复')),
  legacyCsvParsed.notices,
);

// v6 CSV header aliases: estimate / 预计 / 预计用时 and archivedAt / 搁置时间
const v6AliasRows = [
  '\uFEFF标题,预计,搁置时间',
  '别名预计任务,90,2026-11-02 09:00:00',
].join('\r\n');
const v6AliasParsed = parseImportText(v6AliasRows);
check(
  'CSV estimate aliases are recognised',
  v6AliasParsed.ok === true
    && v6AliasParsed.records[0].estimateMinutes === 90
    && v6AliasParsed.records[0].archivedAt !== null,
  v6AliasParsed.records?.[0],
);
const v6EnglishAlias = parseImportText('\uFEFFtitle,estimate,archivedAt\r\n英文列名,30,');
check(
  'CSV English v6 aliases are recognised',
  v6EnglishAlias.ok === true
    && v6EnglishAlias.records[0].estimateMinutes === 30
    && v6EnglishAlias.records[0].archivedAt === null,
  v6EnglishAlias.records?.[0],
);
const v6FieldNameAlias = parseImportText('\uFEFF标题,预计用时\r\n预计用时列,15');
check(
  'CSV 预计用时 alias is recognised',
  v6FieldNameAlias.ok === true && v6FieldNameAlias.records[0].estimateMinutes === 15,
  v6FieldNameAlias.records?.[0],
);
const invalidEstimateCell = parseImportText('\uFEFF标题,预计(分钟)\r\n非法预计,5000');
check(
  'CSV out-of-range estimate is repaired to null',
  invalidEstimateCell.ok === true && invalidEstimateCell.records[0].estimateMinutes === null,
  invalidEstimateCell.records?.[0],
);

// ---- legacy / alternative JSON shapes ------------------------------------

const v1 = JSON.stringify({
  version: 1,
  todos: [{ id: 'ttl_v1', title: '老版本', status: 'pending', createdAt: '2026-01-01T00:00:00.000Z' }],
});
const v1Parsed = parseImportText(v1);
check(
  'v1 envelope migrates to current defaults',
  v1Parsed.ok === true
    && v1Parsed.records[0].project === ''
    && v1Parsed.records[0].priority === ''
    && v1Parsed.records[0].type === ''
    && v1Parsed.records[0].files.length === 0,
  v1Parsed.records?.[0],
);

const v5Json = parseImportText(JSON.stringify({
  version: 5,
  todos: [{
    id: 'ttl_v5',
    title: '五期数据',
    project: '工作',
    files: [],
    status: 'pending',
    priority: 'high',
    type: 'bug',
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
  }],
}));
check(
  'v5 envelope imports with null v6 fields',
  v5Json.ok === true
    && v5Json.records[0].estimateMinutes === null
    && v5Json.records[0].archivedAt === null
    && v5Json.records[0].priority === 'high'
    && v5Json.records[0].type === 'bug',
  v5Json.records?.[0],
);

const bareArray = parseImportText(JSON.stringify([{ id: 'ttl_bare', title: '裸数组' }]));
check('bare Todo[] is accepted', bareArray.ok === true && bareArray.records[0].id === 'ttl_bare');

const chineseJson = parseImportText(JSON.stringify([{
  title: '中文状态',
  status: '已完成',
  priority: '中',
  type: '新功能',
  createdAt: '2026-10-01 08:00:00',
}]));
check(
  'JSON values accept Chinese aliases',
  chineseJson.ok === true
    && chineseJson.records[0].status === 'completed'
    && chineseJson.records[0].priority === 'medium'
    && chineseJson.records[0].type === 'feature',
  chineseJson.records?.[0],
);

// ---- invalid / edge cases ------------------------------------------------

const empty = parseImportText('   ');
check('empty text is rejected', empty.ok === false && empty.code === 'IMPORT_EMPTY', empty);

const broken = parseImportText('{oops');
check('broken JSON is rejected', broken.ok === false && broken.code === 'IMPORT_INVALID', broken);

const unsupportedVersion = parseImportText(JSON.stringify({ version: 99, todos: [] }));
check(
  'unsupported version is rejected',
  unsupportedVersion.ok === false && unsupportedVersion.code === 'IMPORT_VERSION_UNSUPPORTED',
  unsupportedVersion,
);

const missingTitleColumn = parseImportText('分类,状态\r\n工作,已完成');
check(
  'CSV without a title column is rejected',
  missingTitleColumn.ok === false && missingTitleColumn.code === 'IMPORT_INVALID',
  missingTitleColumn,
);

const invalidFormat = parseImportText('[]', { format: 'xlsx' });
check(
  'unknown explicit format is rejected',
  invalidFormat.ok === false && invalidFormat.code === 'IMPORT_FORMAT_UNSUPPORTED',
  invalidFormat,
);

let generated = 0;
const noId = parseImportText(JSON.stringify([{ title: '没有 id' }]), {
  makeId: () => {
    generated += 1;
    return `ttl_generated_${generated}`;
  },
});
check('missing id is generated', noId.ok === true && noId.records[0].id.startsWith('ttl_generated_'), noId.records?.[0]);

const mixed = parseImportText(JSON.stringify([
  { id: 'ttl_ok', title: '有效' },
  { id: 'ttl_bad', title: '' },
  { id: 'ttl_bad2', title: '   ' },
  'not-an-object',
]));
check('invalid rows are counted', mixed.ok === true && mixed.invalidCount === 3, mixed.invalidCount);
check('invalid rows carry file row numbers', mixed.invalid[0]?.row === 2, mixed.invalid);
check('valid rows still import', mixed.records.length === 1 && mixed.records[0].id === 'ttl_ok');

const duplicate = parseImportText(JSON.stringify([
  { id: 'ttl_dup', title: '旧', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'ttl_dup', title: '新', updatedAt: '2026-02-01T00:00:00.000Z' },
]));
check(
  'duplicate ids keep the newer record',
  duplicate.ok === true && duplicate.records.length === 1 && duplicate.records[0].title === '新',
  duplicate.records,
);

// ---- descriptor -----------------------------------------------------------

const jsonExport = exportTodoData(TODOS, { format: 'json', now: NOW });
check('json export descriptor', /^todos-\d{8}-\d{4}\.json$/.test(jsonExport.filename), jsonExport.filename);
check('json export mime', jsonExport.mime.startsWith('application/json'));
const csvExport = exportTodoData(TODOS, { format: 'csv', now: NOW });
check('csv export descriptor', /^todos-\d{8}-\d{4}\.csv$/.test(csvExport.filename), csvExport.filename);
check('csv export mime', csvExport.mime.startsWith('text/csv'));
check('unknown export format falls back to json', exportTodoData(TODOS, { format: 'xml' }).format === 'json');
