import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TodoStore, normalizeTodo, sortTodos, filterTodos, computeStats, validatePriority, validateType, validateEstimate, MAX_ESTIMATE_MINUTES } from '../lib/store.js';
import { formatLocalDateTime, toIsoString, parseTimestamp } from '../lib/time.js';
import { executeTodoAction, resolveDataFile, decorateTodo, createTodoTool, buildProjectSuggestions, runQuickAdd, resolveCommandAttachmentFiles, renderTodoResult } from '../lib/index.js';

// Registers each assertion as an independent `node:test` test so failures
// are reported under the original descriptive name. Conditions and detail
// snapshots are evaluated eagerly, which keeps the sequential shared-state
// semantics of this file unchanged.
function check(name, condition, detail) {
  const message = detail === undefined
    ? undefined
    : typeof detail === 'string' ? detail : inspect(detail, { depth: 4, breakLength: 160 });
  test(name, () => {
    assert.ok(Boolean(condition), message);
  });
}

const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ttl-smoke-'));
const dataFile = path.join(dir, 'todos.json');
let clock = Date.parse('2026-11-03T00:00:00.000Z');
const store = new TodoStore({ dataFile, now: () => clock });

await store.load();

// create
const created = await store.create({ title: '  写   插件  ' });
check('create ok', created.ok === true, created);
check('title collapsed', created.todo?.title === '写 插件', created.todo?.title);
check('createdAt ISO', toIsoString(created.todo?.createdAt) === created.todo?.createdAt);
check('completedAt null', created.todo?.completedAt === null);
check('pending status', created.todo?.status === 'pending');

// empty title
const empty = await store.create({ title: '   ' });
check('empty title rejected', empty.ok === false && empty.code === 'TITLE_REQUIRED', empty);

// complete
clock += 60_000;
const done = await store.complete(created.todo.id);
check('complete ok', done.ok === true);
check('completedAt set', done.todo.completedAt !== null);
check('status completed', done.todo.status === 'completed');

// duplicate complete
const again = await store.complete(created.todo.id);
check('duplicate complete rejected', again.ok === false && again.code === 'ALREADY_COMPLETED', again);

// uncomplete
const reopened = await store.uncomplete(created.todo.id);
check('uncomplete clears completedAt', reopened.ok === true && reopened.todo.completedAt === null);
const twice = await store.uncomplete(created.todo.id);
check('duplicate uncomplete rejected', twice.ok === false && twice.code === 'ALREADY_PENDING', twice);

// update
const updated = await store.update(created.todo.id, { title: '新标题' });
check('update ok', updated.ok === true && updated.todo.title === '新标题');

// complete with at earlier than createdAt
clock += 60_000;
const clamped = await store.complete(created.todo.id, { at: '2000-01-01T00:00:00.000Z' });
check('earlier completion clamped', clamped.ok === true && clamped.todo.completedAt === created.todo.createdAt, clamped);
check('clamp notice', (clamped.notices ?? []).some((n) => n.includes('早于创建时间')), clamped.notices);

// list filter/sort
clock += 60_000;
const second = await store.create({ title: 'b 任务' });
clock += 60_000;
const third = await store.create({ title: 'a 任务' });
const all = await store.list({ filter: 'all', sortBy: 'createdAt', direction: 'desc' });
check('list total 3', all.stats.total === 3, all.stats);
check('desc newest first', all.todos[0].id === third.todo.id, all.todos.map((t) => t.title));
const asc = await store.list({ filter: 'all', sortBy: 'createdAt', direction: 'asc' });
check('asc oldest first', asc.todos[0].id === created.todo.id);
const pending = await store.list({ filter: 'pending' });
check('pending filter', pending.todos.length === 2 && pending.stats.completed === 1, pending.stats);
const completedList = await store.list({ filter: 'completed' });
check('completed filter', completedList.todos.length === 1);
const byCompleted = await store.list({ sortBy: 'completedAt', direction: 'asc' });
check('completedAt nulls last', byCompleted.todos[byCompleted.todos.length - 1].completedAt === null);

// get / not found / delete
const missing = await store.get('nope');
check('get missing 404 code', missing.ok === false && missing.code === 'NOT_FOUND');
const removed = await store.remove(second.todo.id);
check('delete ok', removed.ok === true && removed.deleted === second.todo.id);
check('delete again not found', (await store.remove(second.todo.id)).ok === false);

// time formatting
check('format null dash', formatLocalDateTime(null) === '-');
check('format invalid dash', formatLocalDateTime('not-a-date') === '-');
const formatted = formatLocalDateTime('2026-11-03T00:00:00.000Z');
check('format shape', /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(formatted), formatted);

// persistence + reload
const reloadedStore = new TodoStore({ dataFile });
await reloadedStore.load();
const reloaded = await reloadedStore.list({});
check('persisted count', reloaded.stats.total === 2, reloaded.stats);

// corrupted file handling
const corruptFile = path.join(dir, 'corrupt.json');
await fsp.writeFile(corruptFile, '{ not json', 'utf8');
const corruptStore = new TodoStore({ dataFile: corruptFile });
const corruptLoad = await corruptStore.load();
check('corrupt file recovers empty', (await corruptStore.list({})).stats.total === 0);
check('corrupt notice present', (corruptLoad.notices ?? []).some((n) => n.includes('合法 JSON')), corruptLoad.notices);
const leftovers = (await fsp.readdir(dir)).filter((f) => f.includes('corrupt'));
check('corrupt file archived', leftovers.length > 0, leftovers);

// record repair: missing createdAt / completedAt before createdAt / bad status
const repaired = normalizeTodo(
  { id: '', title: '修复样本', status: 'completed', completedAt: '1999-01-01T00:00:00.000Z' },
  { now: clock },
);
check('repair keeps record', repaired.todo !== null, repaired);
check('repair fills id', typeof repaired.todo?.id === 'string' && repaired.todo.id.length > 0);
check('repair createdAt fallback', toIsoString(repaired.todo?.createdAt) === new Date(clock).toISOString());
check('repair completedAt clamped', repaired.todo?.completedAt === repaired.todo?.createdAt);
check('repair notices', repaired.notices.length >= 2, repaired.notices);

// pure helpers
check('filterTodos invalid filter returns all', filterTodos([{ status: 'pending' }], 'x').length === 1);
check('sortTodos stable for equal keys', sortTodos([
  { id: 'a', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'b', createdAt: '2026-01-01T00:00:00.000Z' },
], { sortBy: 'createdAt' }).map((t) => t.id).join('') === 'ab');
check('computeStats', JSON.stringify(computeStats([
  { status: 'pending' }, { status: 'completed' }, { status: 'pending' },
])) === JSON.stringify({ total: 3, pending: 2, completed: 1, archived: 0 }));
check(
  'computeStats keeps shelved todos out of total',
  JSON.stringify(computeStats([
    { status: 'pending' }, { status: 'pending', archivedAt: '2026-01-01T00:00:00.000Z' },
  ])) === JSON.stringify({ total: 1, pending: 1, completed: 0, archived: 1 }),
  computeStats([
    { status: 'pending' }, { status: 'pending', archivedAt: '2026-01-01T00:00:00.000Z' },
  ]),
);
check('parseTimestamp invalid', parseTimestamp('x') === null);

// repair notices are delivered to the reader exactly once
const corrupt2 = path.join(dir, 'corrupt2.json');
await fsp.writeFile(corrupt2, 'nope', 'utf8');
const noticeStore = new TodoStore({ dataFile: corrupt2 });
await noticeStore.load();
const firstList = await noticeStore.list({});
const secondList = await noticeStore.list({});
check(
  'repair notice delivered once',
  firstList.notices.length === 1 && secondList.notices.length === 0,
  [firstList.notices, secondList.notices],
);
check('repair history kept for diagnostics', noticeStore.describe().loadNotices.length === 1);
await noticeStore.dispose();

// valid JSON with the wrong shape is archived too (not silently overwritten)
const shapeFile = path.join(dir, 'shape.json');
await fsp.writeFile(shapeFile, JSON.stringify({ nope: 'not a todo envelope' }), 'utf8');
const shapeStore = new TodoStore({ dataFile: shapeFile });
await shapeStore.load();
const shapeList = await shapeStore.list({});
const shapeArchived = (await fsp.readdir(dir)).some((f) => f.startsWith('shape.json.corrupt-shape-'));
check('shape-invalid file archived', shapeArchived, await fsp.readdir(dir));
check('shape notice', shapeList.notices.some((n) => n.includes('结构异常')), shapeList.notices);
await shapeStore.dispose();

// duplicate ids are split apart, and the repair is reported
const dupFile = path.join(dir, 'dup.json');
await fsp.writeFile(dupFile, JSON.stringify({
  version: 1,
  todos: [
    { id: 'same', title: 'A', status: 'pending', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'same', title: 'B', status: 'pending', createdAt: '2026-01-02T00:00:00.000Z' },
  ],
}), 'utf8');
const dupStore = new TodoStore({ dataFile: dupFile });
await dupStore.load();
const dupList = await dupStore.list({});
check('duplicate ids split', dupList.stats.total === 2 && new Set(dupList.todos.map((t) => t.id)).size === 2,
  dupList.todos.map((t) => t.id));
check('duplicate id notice', dupList.notices.some((n) => n.includes('重复 id')), dupList.notices);
await dupStore.dispose();

// project categories (v2) + envelope migration
const projectFile = path.join(dir, 'projects.json');
const projectStore = new TodoStore({ dataFile: projectFile, now: () => clock });
await projectStore.load();
const projectCreate = await projectStore.create({ title: '带分类的任务', project: '  工作  ' });
check('project normalized on create', projectCreate.ok === true && projectCreate.todo.project === '工作', projectCreate.todo);
const projectCreateEmpty = await projectStore.create({ title: '无分类任务' });
check('project defaults to empty', projectCreateEmpty.todo.project === '');
const projectTooLong = await projectStore.create({ title: 'x', project: 'a'.repeat(41) });
check('project too long rejected', projectTooLong.ok === false && projectTooLong.code === 'PROJECT_TOO_LONG', projectTooLong);
const projectWrongType = await projectStore.create({ title: 'x', project: 42 });
check('project wrong type rejected', projectWrongType.ok === false && projectWrongType.code === 'PROJECT_INVALID', projectWrongType);
const lifeCreate = await projectStore.create({ title: '生活任务', project: '生活' });
const byProject = await projectStore.list({ project: '工作' });
check('list filters by project', byProject.todos.length === 1 && byProject.todos[0].id === projectCreate.todo.id, byProject.todos);
check(
  'projects summary ordered with uncategorized last',
  byProject.projects.length === 3
    && byProject.projects[0].name === '工作'
    && byProject.projects.at(-1).name === ''
    && byProject.projects[0].pending === 1,
  byProject.projects,
);
check('filter uncategorized only', (await projectStore.list({ project: '' })).todos.every((t) => t.project === ''), (await projectStore.list({ project: '' })).todos);
check('no project filter lists all', (await projectStore.list({})).stats.total === 3);
const sortedByProject = await projectStore.list({ sortBy: 'project' });
check('project sort keeps uncategorized last', sortedByProject.todos.at(-1).project === '', sortedByProject.todos.map((t) => t.project));
const projectUpdate = await projectStore.update(projectCreateEmpty.todo.id, { project: '学习' });
check(
  'update project only keeps title',
  projectUpdate.ok === true && projectUpdate.todo.project === '学习' && projectUpdate.todo.title === '无分类任务',
  projectUpdate,
);
const lifeUpdate = await projectStore.update(lifeCreate.todo.id, { title: '生活任务（改名）' });
check('update title only keeps project', lifeUpdate.todo.project === '生活', lifeUpdate);
const badListFilter = await projectStore.list({ project: 42 });
check('list rejects non-string project filter', badListFilter.ok === false && badListFilter.code === 'PROJECT_INVALID', badListFilter);
const noopUpdate = await projectStore.update(lifeCreate.todo.id, {});
check('empty update is a no-op', noopUpdate.ok === true && noopUpdate.unchanged === true, noopUpdate);
// workspace file references (v3)
const withFile = await projectStore.create({ title: '带文件的任务', files: ['src/auth/login.ts'] });
check('file reference stored', withFile.ok === true && withFile.todo.files[0] === 'src/auth/login.ts', withFile.todo);
check('project derived from file directory', withFile.todo.project === 'src/auth', withFile.todo.project);
const explicitProject = await projectStore.create({ title: '显式分类优先', project: '工作', files: ['src/b.ts'] });
check('explicit project wins over derivation', explicitProject.todo.project === '工作', explicitProject.todo.project);
const absoluteFile = await projectStore.create({ title: 'x', files: ['/etc/passwd'] });
check('absolute file path rejected', absoluteFile.ok === false && absoluteFile.code === 'FILES_INVALID', absoluteFile);
const traversalFile = await projectStore.create({ title: 'x', files: ['../secret'] });
check('traversal file path rejected', traversalFile.ok === false && traversalFile.code === 'FILES_INVALID', traversalFile);
const tooManyFiles = await projectStore.create({
  title: 'x',
  files: Array.from({ length: 21 }, (_, index) => `f${index}.ts`),
});
check('too many files rejected', tooManyFiles.ok === false && tooManyFiles.code === 'TOO_MANY_FILES', tooManyFiles);
const fileUpdate = await projectStore.update(withFile.todo.id, { files: ['src/auth/logout.ts'] });
check(
  'update files keeps derived project',
  fileUpdate.ok === true && fileUpdate.todo.files[0] === 'src/auth/logout.ts' && fileUpdate.todo.project === 'src/auth',
  fileUpdate.todo,
);
const clearedFiles = await projectStore.update(withFile.todo.id, { files: [] });
check(
  'clearing files keeps the existing project',
  clearedFiles.ok === true && clearedFiles.todo.files.length === 0 && clearedFiles.todo.project === 'src/auth',
  clearedFiles.todo,
);
const loadDerived = normalizeTodo(
  { id: 'derived', title: '旧记录带文件但无分类', files: ['src/x.js'], status: 'pending', createdAt: '2026-01-01T00:00:00.000Z' },
  { now: clock },
);
check('load derives project from files', loadDerived.todo.project === 'src' && loadDerived.todo.files[0] === 'src/x.js', loadDerived.todo);
const explicitEmpty = normalizeTodo(
  { id: 'explicit-empty', title: '显式未分类', project: '', files: ['src/x.js'], status: 'pending', createdAt: '2026-01-01T00:00:00.000Z' },
  { now: clock },
);
check(
  'explicit empty project survives reload',
  explicitEmpty.todo.project === '' && explicitEmpty.todo.files[0] === 'src/x.js',
  explicitEmpty.todo,
);
await projectStore.dispose();

// v1 envelope migrates to v2 on the next write
const v1File = path.join(dir, 'v1.json');
await fsp.writeFile(v1File, JSON.stringify({
  version: 1,
  todos: [{
    id: 'legacy',
    title: '旧数据',
    status: 'completed',
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-02T00:00:00.000Z',
  }],
}), 'utf8');
const v1Store = new TodoStore({ dataFile: v1File });
await v1Store.load();
const v1List = await v1Store.list({});
check('v1 record loads with empty project', v1List.todos.length === 1 && v1List.todos[0].project === '', v1List.todos);
check('v1 migration notice', v1List.notices.some((n) => n.includes('版本 1')), v1List.notices);
await v1Store.create({ title: '触发写盘' });
const v1Raw = JSON.parse(await fsp.readFile(v1File, 'utf8'));
check(
  'v1 persisted as version 6',
  v1Raw.version === 6 && v1Raw.todos[0].project === '' && Array.isArray(v1Raw.todos[0].files)
    && v1Raw.todos[0].priority === '' && v1Raw.todos[0].type === ''
    && v1Raw.todos[0].archivedAt === null && v1Raw.todos[0].estimateMinutes === null,
  v1Raw,
);
await v1Store.dispose();

// v2 envelope (project, no files) migrates to v5
const v2File = path.join(dir, 'v2.json');
await fsp.writeFile(v2File, JSON.stringify({
  version: 2,
  todos: [{
    id: 'legacy-v2',
    title: '二期数据',
    project: '工作',
    status: 'pending',
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: null,
  }],
}), 'utf8');
const v2Store = new TodoStore({ dataFile: v2File });
await v2Store.load();
const v2List = await v2Store.list({});
check('v2 record gains empty files', Array.isArray(v2List.todos[0].files) && v2List.todos[0].files.length === 0, v2List.todos);
check('v2 migration notice', v2List.notices.some((n) => n.includes('版本 2')), v2List.notices);
await v2Store.create({ title: '触发写盘' });
const v2Raw = JSON.parse(await fsp.readFile(v2File, 'utf8'));
check('v2 persisted as version 6', v2Raw.version === 6 && v2Raw.todos[0].priority === '' && v2Raw.todos[0].type === '', v2Raw);
await v2Store.dispose();

// v3 envelope (no priority/type) migrates to v5: loading never rewrites, next write does
const v3File = path.join(dir, 'v3.json');
const v3Payload = JSON.stringify({
  version: 3,
  todos: [{
    id: 'legacy-v3',
    title: '三期数据',
    project: '工作',
    files: ['src/a.ts'],
    status: 'pending',
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
  }],
});
await fsp.writeFile(v3File, v3Payload, 'utf8');
const v3Store = new TodoStore({ dataFile: v3File, now: () => clock });
await v3Store.load();
const v3List = await v3Store.list({});
check(
  'v3 record loads with empty priority and type',
  v3List.todos.length === 1 && v3List.todos[0].priority === '' && v3List.todos[0].type === '',
  v3List.todos,
);
check('v3 migration notice', v3List.notices.some((n) => n.includes('版本 3')), v3List.notices);
check('v3 load does not rewrite the file', (await fsp.readFile(v3File, 'utf8')) === v3Payload);
await v3Store.create({ title: '触发写盘' });
const v3Raw = JSON.parse(await fsp.readFile(v3File, 'utf8'));
check(
  'v3 persisted as version 6',
  v3Raw.version === 6 && v3Raw.todos.find((todo) => todo.id === 'legacy-v3')?.priority === ''
    && v3Raw.todos.find((todo) => todo.id === 'legacy-v3')?.type === '',
  v3Raw.version,
);
await v3Store.dispose();

// v4 envelope (priority, no type) migrates to v5: loading never rewrites, next write does
const v4File = path.join(dir, 'v4.json');
const v4Payload = JSON.stringify({
  version: 4,
  todos: [{
    id: 'legacy-v4',
    title: '四期数据',
    project: '工作',
    files: ['src/a.ts'],
    status: 'completed',
    priority: 'high',
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  }],
});
await fsp.writeFile(v4File, v4Payload, 'utf8');
const v4Store = new TodoStore({ dataFile: v4File, now: () => clock });
await v4Store.load();
const v4List = await v4Store.list({});
check(
  'v4 record keeps priority and gains empty type',
  v4List.todos.length === 1 && v4List.todos[0].priority === 'high' && v4List.todos[0].type === '',
  v4List.todos,
);
check('v4 migration notice', v4List.notices.some((n) => n.includes('版本 4')), v4List.notices);
check('v4 load does not rewrite the file', (await fsp.readFile(v4File, 'utf8')) === v4Payload);
await v4Store.create({ title: '触发写盘' });
const v4Raw = JSON.parse(await fsp.readFile(v4File, 'utf8'));
check(
  'v4 persisted as version 6',
  v4Raw.version === 6 && v4Raw.todos.find((todo) => todo.id === 'legacy-v4')?.type === ''
    && v4Raw.todos.find((todo) => todo.id === 'legacy-v4')?.priority === 'high',
  v4Raw.version,
);
await v4Store.dispose();

// priority field (v4): validation, normalization, sorting, update semantics
const priorityFile = path.join(dir, 'priority.json');
const priorityStore = new TodoStore({ dataFile: priorityFile, now: () => clock });
await priorityStore.load();
check('priority defaults when omitted', validatePriority(undefined).priority === '' && validatePriority(null).priority === '');
check(
  'priority validates canonical values',
  ['high', 'medium', 'low', ''].every((value) => {
    const result = validatePriority(value);
    return result.ok === true && result.priority === value;
  }),
);
check('priority trims surrounding whitespace', validatePriority(' high ').priority === 'high');
check('priority rejects unknown value', validatePriority('urgent').ok === false && validatePriority('urgent').code === 'PRIORITY_INVALID');
check('priority rejects non-string', validatePriority(42).code === 'PRIORITY_INVALID');
const prioHigh = await priorityStore.create({ title: '高优先级', priority: 'high' });
const prioLow = await priorityStore.create({ title: '低优先级', priority: 'low' });
const prioUnset = await priorityStore.create({ title: '无优先级' });
const prioMedium = await priorityStore.create({ title: '中优先级', priority: 'medium' });
check('create stores priority', prioHigh.todo.priority === 'high' && prioLow.todo.priority === 'low', prioHigh.todo);
check('create defaults priority to empty', prioUnset.todo.priority === '', prioUnset.todo);
const prioBad = await priorityStore.create({ title: 'x', priority: 'urgent' });
check('create rejects invalid priority', prioBad.ok === false && prioBad.code === 'PRIORITY_INVALID', prioBad);
check('create rejects non-string priority', (await priorityStore.create({ title: 'x', priority: 42 })).code === 'PRIORITY_INVALID');
const priorityRaw = JSON.parse(await fsp.readFile(priorityFile, 'utf8'));
check(
  'priority persisted in the v6 envelope',
  priorityRaw.version === 6 && priorityRaw.todos.find((todo) => todo.id === prioHigh.todo.id)?.priority === 'high',
  priorityRaw.version,
);
const priorityDesc = await priorityStore.list({ sortBy: 'priority' });
check(
  'priority desc high>medium>low>unset',
  priorityDesc.todos.map((todo) => todo.priority).join('|') === 'high|medium|low|',
  priorityDesc.todos.map((todo) => todo.priority),
);
const priorityAsc = await priorityStore.list({ sortBy: 'priority', direction: 'asc' });
check(
  'priority asc keeps unset last',
  priorityAsc.todos.map((todo) => todo.priority).join('|') === 'low|medium|high|',
  priorityAsc.todos.map((todo) => todo.priority),
);
const prioritySample = [
  { id: 'u', priority: '', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'h', priority: 'high', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'l', priority: 'low', createdAt: '2026-01-01T00:00:00.000Z' },
];
check('sortTodos priority desc unset last', sortTodos(prioritySample, { sortBy: 'priority' }).at(-1).id === 'u');
check('sortTodos priority asc unset last', sortTodos(prioritySample, { sortBy: 'priority', direction: 'asc' }).at(-1).id === 'u');
check('sortTodos priority asc low first', sortTodos(prioritySample, { sortBy: 'priority', direction: 'asc' })[0].id === 'l');
const prioUpdate = await priorityStore.update(prioUnset.todo.id, { priority: 'high' });
check('update sets priority', prioUpdate.ok === true && prioUpdate.todo.priority === 'high', prioUpdate.todo);
const prioTitleOnly = await priorityStore.update(prioUnset.todo.id, { title: '无优先级（改名）' });
check(
  'update title keeps priority',
  prioTitleOnly.todo.priority === 'high' && prioTitleOnly.todo.title === '无优先级（改名）',
  prioTitleOnly.todo,
);
const prioClear = await priorityStore.update(prioUnset.todo.id, { priority: '' });
check('update empty string clears priority', prioClear.ok === true && prioClear.todo.priority === '', prioClear.todo);
const prioBadUpdate = await priorityStore.update(prioHigh.todo.id, { priority: 'urgent' });
check('update rejects invalid priority', prioBadUpdate.ok === false && prioBadUpdate.code === 'PRIORITY_INVALID', prioBadUpdate);
const prioNoop = await priorityStore.update(prioHigh.todo.id, { priority: 'high' });
check('update same priority is a no-op', prioNoop.ok === true && prioNoop.unchanged === true, prioNoop);
const prioKept = await priorityStore.update(prioMedium.todo.id, { priority: undefined });
check('update undefined priority keeps value', prioKept.todo.priority === 'medium', prioKept.todo);
const normalizedPriority = normalizeTodo(
  { id: 'p1', title: '合法优先级', priority: 'medium', status: 'pending', createdAt: '2026-01-01T00:00:00.000Z' },
  { now: clock },
);
check('normalizeTodo keeps valid priority', normalizedPriority.todo.priority === 'medium', normalizedPriority.todo);
const missingPriority = normalizeTodo(
  { id: 'p2', title: '缺优先级', status: 'pending', createdAt: '2026-01-01T00:00:00.000Z' },
  { now: clock },
);
check(
  'normalizeTodo defaults missing priority silently',
  missingPriority.todo.priority === '' && !missingPriority.notices.some((n) => n.includes('优先级')),
  missingPriority.notices,
);
const invalidPriority = normalizeTodo(
  { id: 'p3', title: '非法优先级', priority: 'urgent', status: 'pending', createdAt: '2026-01-01T00:00:00.000Z' },
  { now: clock },
);
check(
  'normalizeTodo repairs invalid priority with a notice',
  invalidPriority.todo.priority === '' && invalidPriority.notices.some((n) => n.includes('优先级')),
  invalidPriority.notices,
);
await priorityStore.dispose();

// an invalid persisted priority is repaired once and reported on the next list only
const repairPriorityFile = path.join(dir, 'priority-repair.json');
await fsp.writeFile(repairPriorityFile, JSON.stringify({
  version: 4,
  todos: [{
    id: 'bad-priority',
    title: '优先级非法',
    priority: 'urgent',
    status: 'pending',
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
  }],
}), 'utf8');
const repairPriorityStore = new TodoStore({ dataFile: repairPriorityFile });
await repairPriorityStore.load();
const repairPriorityFirst = await repairPriorityStore.list({});
const repairPrioritySecond = await repairPriorityStore.list({});
check(
  'invalid priority repair notice delivered once',
  repairPriorityFirst.notices.some((n) => n.includes('优先级'))
    && !repairPrioritySecond.notices.some((n) => n.includes('优先级')),
  [repairPriorityFirst.notices, repairPrioritySecond.notices],
);
check('invalid priority normalized on load', repairPriorityFirst.todos[0].priority === '', repairPriorityFirst.todos[0]);
await repairPriorityStore.dispose();

// type field (v5): validation, normalization, partial update, invalid repair
const typeFile = path.join(dir, 'type.json');
const typeStore = new TodoStore({ dataFile: typeFile, now: () => clock });
await typeStore.load();
check('type defaults when omitted', validateType(undefined).type === '' && validateType(null).type === '');
check(
  'type validates canonical values',
  ['bug', 'feature', 'improvement', 'question', 'chore', 'other', ''].every((value) => {
    const result = validateType(value);
    return result.ok === true && result.type === value;
  }),
);
check('type trims surrounding whitespace', validateType(' bug ').type === 'bug');
check('type rejects unknown value', validateType('epic').ok === false && validateType('epic').code === 'TYPE_INVALID');
check('type rejects non-string', validateType(42).code === 'TYPE_INVALID');
const typeBug = await typeStore.create({ title: '缺陷任务', type: 'bug' });
const typeFeature = await typeStore.create({ title: '功能任务', type: 'feature' });
const typeUnset = await typeStore.create({ title: '无类型任务' });
check('create stores type', typeBug.todo.type === 'bug' && typeFeature.todo.type === 'feature', typeBug.todo);
check('create defaults type to empty', typeUnset.todo.type === '', typeUnset.todo);
const typeBad = await typeStore.create({ title: 'x', type: 'epic' });
check('create rejects invalid type', typeBad.ok === false && typeBad.code === 'TYPE_INVALID', typeBad);
check('create rejects non-string type', (await typeStore.create({ title: 'x', type: 42 })).code === 'TYPE_INVALID');
const typeRaw = JSON.parse(await fsp.readFile(typeFile, 'utf8'));
check(
  'type persisted in the v6 envelope',
  typeRaw.version === 6 && typeRaw.todos.find((todo) => todo.id === typeBug.todo.id)?.type === 'bug',
  typeRaw.version,
);
const typeUpdate = await typeStore.update(typeUnset.todo.id, { type: 'question' });
check('update sets type', typeUpdate.ok === true && typeUpdate.todo.type === 'question', typeUpdate.todo);
const typeTitleOnly = await typeStore.update(typeUnset.todo.id, { title: '无类型任务（改名）' });
check(
  'update title keeps type',
  typeTitleOnly.todo.type === 'question' && typeTitleOnly.todo.title === '无类型任务（改名）',
  typeTitleOnly.todo,
);
const typeClear = await typeStore.update(typeUnset.todo.id, { type: '' });
check('update empty string clears type', typeClear.ok === true && typeClear.todo.type === '', typeClear.todo);
const typeKept = await typeStore.update(typeBug.todo.id, { type: undefined });
check('update undefined type keeps value', typeKept.todo.type === 'bug', typeKept.todo);
const typeBadUpdate = await typeStore.update(typeBug.todo.id, { type: 'epic' });
check('update rejects invalid type', typeBadUpdate.ok === false && typeBadUpdate.code === 'TYPE_INVALID', typeBadUpdate);
const typeNoop = await typeStore.update(typeBug.todo.id, { type: 'bug' });
check('update same type is a no-op', typeNoop.ok === true && typeNoop.unchanged === true, typeNoop);
const normalizedType = normalizeTodo(
  { id: 't1', title: '合法类型', type: 'chore', status: 'pending', createdAt: '2026-01-01T00:00:00.000Z' },
  { now: clock },
);
check('normalizeTodo keeps valid type', normalizedType.todo.type === 'chore', normalizedType.todo);
const missingType = normalizeTodo(
  { id: 't2', title: '缺类型', status: 'pending', createdAt: '2026-01-01T00:00:00.000Z' },
  { now: clock },
);
check(
  'normalizeTodo defaults missing type silently',
  missingType.todo.type === '' && !missingType.notices.some((n) => n.includes('类型')),
  missingType.notices,
);
const invalidType = normalizeTodo(
  { id: 't3', title: '非法类型', type: 'epic', status: 'pending', createdAt: '2026-01-01T00:00:00.000Z' },
  { now: clock },
);
check(
  'normalizeTodo repairs invalid type with a notice',
  invalidType.todo.type === '' && invalidType.notices.some((n) => n.includes('类型')),
  invalidType.notices,
);
await typeStore.dispose();

// an invalid persisted type is repaired once and reported on the next list only
const repairTypeFile = path.join(dir, 'type-repair.json');
await fsp.writeFile(repairTypeFile, JSON.stringify({
  version: 5,
  todos: [{
    id: 'bad-type',
    title: '类型非法',
    type: 'epic',
    status: 'pending',
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
  }],
}), 'utf8');
const repairTypeStore = new TodoStore({ dataFile: repairTypeFile });
await repairTypeStore.load();
const repairTypeFirst = await repairTypeStore.list({});
const repairTypeSecond = await repairTypeStore.list({});
check(
  'invalid type repair notice delivered once',
  repairTypeFirst.notices.some((n) => n.includes('类型'))
    && !repairTypeSecond.notices.some((n) => n.includes('类型')),
  [repairTypeFirst.notices, repairTypeSecond.notices],
);
check('invalid type normalized on load', repairTypeFirst.todos[0].type === '', repairTypeFirst.todos[0]);
await repairTypeStore.dispose();

// ---- v6: 搁置 (archivedAt) + 预计用时 (estimateMinutes) ----

// validateEstimate: undefined/null = 未填, an integer 1..1440 only
check(
  'estimate defaults to null when omitted',
  validateEstimate(undefined).estimateMinutes === null && validateEstimate(null).estimateMinutes === null,
);
check(
  'estimate accepts integers in range',
  [1, 30, MAX_ESTIMATE_MINUTES].every((value) => {
    const result = validateEstimate(value);
    return result.ok === true && result.estimateMinutes === value;
  }),
);
check('estimate accepts numeric strings', validateEstimate('45').estimateMinutes === 45);
check('estimate rejects zero', validateEstimate(0).ok === false && validateEstimate(0).code === 'ESTIMATE_INVALID');
check(
  'estimate rejects out-of-range values',
  validateEstimate(MAX_ESTIMATE_MINUTES + 1).code === 'ESTIMATE_INVALID',
  validateEstimate(MAX_ESTIMATE_MINUTES + 1),
);
check('estimate rejects fractions', validateEstimate(1.5).code === 'ESTIMATE_INVALID');
check('estimate rejects non-numeric strings', validateEstimate('半小时').code === 'ESTIMATE_INVALID');
check('estimate rejects non-number types', validateEstimate({}).code === 'ESTIMATE_INVALID');

// v5 data gains the two new fields and is persisted as v6 on the next write
const v5File = path.join(dir, 'v5.json');
const v5Payload = JSON.stringify({
  version: 5,
  todos: [{
    id: 'legacy-v5',
    title: '五期数据',
    project: '工作',
    files: ['src/a.ts'],
    status: 'pending',
    priority: 'high',
    type: 'bug',
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
  }],
});
await fsp.writeFile(v5File, v5Payload, 'utf8');
const v5Store = new TodoStore({ dataFile: v5File, now: () => clock });
await v5Store.load();
const v5List = await v5Store.list({});
check(
  'v5 record loads with null archivedAt and estimateMinutes',
  v5List.todos.length === 1
    && v5List.todos[0].archivedAt === null
    && v5List.todos[0].estimateMinutes === null,
  v5List.todos,
);
check(
  'v5 migration notice mentions the shelved and estimate fields',
  v5List.notices.some((n) => n.includes('版本 5') && n.includes('搁置与预计用时')),
  v5List.notices,
);
check('v5 load does not rewrite the file', (await fsp.readFile(v5File, 'utf8')) === v5Payload);
await v5Store.create({ title: '触发写盘' });
const v5Raw = JSON.parse(await fsp.readFile(v5File, 'utf8'));
check(
  'v5 persisted as version 6 with the new fields',
  v5Raw.version === 6
    && v5Raw.todos.find((todo) => todo.id === 'legacy-v5')?.archivedAt === null
    && v5Raw.todos.find((todo) => todo.id === 'legacy-v5')?.estimateMinutes === null,
  v5Raw.version,
);
await v5Store.dispose();

// a v6 file round-trips both new fields unchanged
const v6File = path.join(dir, 'v6.json');
await fsp.writeFile(v6File, JSON.stringify({
  version: 6,
  todos: [{
    id: 'v6-archived',
    title: '六期搁置数据',
    project: '工作',
    files: [],
    status: 'pending',
    priority: '',
    type: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: null,
    archivedAt: '2026-01-02T00:00:00.000Z',
    estimateMinutes: 90,
    updatedAt: '2026-01-02T00:00:00.000Z',
  }],
}), 'utf8');
const v6Store = new TodoStore({ dataFile: v6File, now: () => clock });
await v6Store.load();
const v6List = await v6Store.list({ filter: 'archived' });
check(
  'v6 record keeps archivedAt and estimateMinutes',
  v6List.todos.length === 1
    && v6List.todos[0].archivedAt === '2026-01-02T00:00:00.000Z'
    && v6List.todos[0].estimateMinutes === 90,
  v6List.todos,
);
await v6Store.dispose();

// repairs: completed record carrying archivedAt, and an invalid estimate
const repairedCompleted = normalizeTodo(
  {
    id: 'fix-archived',
    title: '已完成却带搁置时间',
    status: 'completed',
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-02T00:00:00.000Z',
    archivedAt: '2026-01-02T00:00:00.000Z',
  },
  { now: clock },
);
check(
  'completed record with archivedAt is repaired',
  repairedCompleted.todo.archivedAt === null
    && repairedCompleted.notices.some((n) => n.includes('搁置时间')),
  repairedCompleted,
);
const invalidEstimate = normalizeTodo(
  { id: 'fix-estimate', title: '预计用时非法', estimateMinutes: 5000, createdAt: '2026-01-01T00:00:00.000Z' },
  { now: clock },
);
check(
  'invalid estimate is cleared with a notice',
  invalidEstimate.todo.estimateMinutes === null
    && invalidEstimate.notices.some((n) => n.includes('预计用时')),
  invalidEstimate,
);
const missingEstimate = normalizeTodo(
  { id: 'no-estimate', title: '没有预计用时', createdAt: '2026-01-01T00:00:00.000Z' },
  { now: clock },
);
check(
  'missing estimate is null without a notice',
  missingEstimate.todo.estimateMinutes === null
    && !missingEstimate.notices.some((n) => n.includes('预计用时')),
  missingEstimate.notices,
);

// dirty persisted v6 fields are repaired once and reported once
const repairV6File = path.join(dir, 'v6-repair.json');
await fsp.writeFile(repairV6File, JSON.stringify({
  version: 6,
  todos: [{
    id: 'bad-v6',
    title: '脏数据',
    status: 'completed',
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-02T00:00:00.000Z',
    archivedAt: '2026-01-03T00:00:00.000Z',
    estimateMinutes: 0,
    updatedAt: '2026-01-02T00:00:00.000Z',
  }],
}), 'utf8');
const repairV6Store = new TodoStore({ dataFile: repairV6File });
await repairV6Store.load();
const repairV6First = await repairV6Store.list({});
const repairV6Second = await repairV6Store.list({});
check(
  'v6 dirty fields are repaired on load',
  repairV6First.todos[0].archivedAt === null && repairV6First.todos[0].estimateMinutes === null,
  repairV6First.todos[0],
);
check(
  'v6 repair notices are delivered once',
  repairV6First.notices.some((n) => n.includes('搁置时间'))
    && repairV6First.notices.some((n) => n.includes('预计用时'))
    && !repairV6Second.notices.some((n) => n.includes('搁置时间')),
  [repairV6First.notices, repairV6Second.notices],
);
await repairV6Store.dispose();

// estimate field on create/update
const estimateStore = new TodoStore({ dataFile: path.join(dir, 'estimate.json'), now: () => clock });
await estimateStore.load();
const estimateCreated = await estimateStore.create({ title: '预计 30 分', estimateMinutes: 30 });
check('create stores estimate', estimateCreated.ok === true && estimateCreated.todo.estimateMinutes === 30, estimateCreated.todo);
const estimateDefault = await estimateStore.create({ title: '没填预计' });
check('create defaults estimate to null', estimateDefault.todo.estimateMinutes === null, estimateDefault.todo);
const estimateBad = await estimateStore.create({ title: 'x', estimateMinutes: 0 });
check('create rejects invalid estimate', estimateBad.ok === false && estimateBad.code === 'ESTIMATE_INVALID', estimateBad);
const estimateUpdated = await estimateStore.update(estimateDefault.todo.id, { estimateMinutes: 45 });
check('update sets estimate', estimateUpdated.ok === true && estimateUpdated.todo.estimateMinutes === 45, estimateUpdated.todo);
const estimateKept = await estimateStore.update(estimateDefault.todo.id, { title: '没填预计（改名）' });
check(
  'update title keeps estimate',
  estimateKept.todo.estimateMinutes === 45 && estimateKept.todo.title === '没填预计（改名）',
  estimateKept.todo,
);
const estimateBadUpdate = await estimateStore.update(estimateDefault.todo.id, { estimateMinutes: 5000 });
check('update rejects invalid estimate', estimateBadUpdate.ok === false && estimateBadUpdate.code === 'ESTIMATE_INVALID', estimateBadUpdate);
const estimateCleared = await estimateStore.update(estimateDefault.todo.id, { estimateMinutes: null });
check('update null clears estimate', estimateCleared.ok === true && estimateCleared.todo.estimateMinutes === null, estimateCleared.todo);
const estimateSame = await estimateStore.update(estimateCreated.todo.id, { estimateMinutes: 30 });
check('update same estimate is a no-op', estimateSame.ok === true && estimateSame.unchanged === true, estimateSame);
await estimateStore.dispose();

// 搁置 / 取回: archive leaves the active list, unarchive brings it back
const archiveFile = path.join(dir, 'archive.json');
const archiveStore = new TodoStore({ dataFile: archiveFile, now: () => clock });
await archiveStore.load();
const archivable = await archiveStore.create({ title: '要搁置的任务', project: '工作' });
clock += 60_000;
const archived = await archiveStore.archive(archivable.todo.id);
check('archive ok', archived.ok === true && archived.todo.archivedAt !== null, archived);
check(
  'archive keeps the todo pending and unfinished',
  archived.todo.status === 'pending' && archived.todo.completedAt === null,
  archived.todo,
);
const archivedTwice = await archiveStore.archive(archivable.todo.id);
check('duplicate archive rejected', archivedTwice.ok === false && archivedTwice.code === 'ALREADY_ARCHIVED', archivedTwice);
const archivedRaw = JSON.parse(await fsp.readFile(archiveFile, 'utf8'));
check(
  'archive persists archivedAt in the v6 envelope',
  archivedRaw.version === 6 && archivedRaw.todos[0].archivedAt !== null,
  archivedRaw,
);
const archivedList = await archiveStore.list({ filter: 'archived' });
check(
  'archived filter lists the shelved todo',
  archivedList.todos.length === 1 && archivedList.todos[0].id === archivable.todo.id,
  archivedList.todos,
);
const activeList = await archiveStore.list({ filter: 'all' });
check('all filter hides shelved todos', activeList.todos.length === 0, activeList.todos);
check(
  'all filter stats count archived separately',
  activeList.stats.total === 0 && activeList.stats.archived === 1,
  activeList.stats,
);
check('pending filter hides shelved todos', (await archiveStore.list({ filter: 'pending' })).todos.length === 0);
check('completed filter hides shelved todos', (await archiveStore.list({ filter: 'completed' })).todos.length === 0);
// projects[] 的 count/pending/completed 仍是活跃口径（搁置项不算「这一屏能看到的」），
// 但每个分类额外带 archived 分项 —— 否则带分类筛选时客户端只能把搁置计数硬编码成 0。
check(
  'projects summary counts only active todos',
  activeList.projects.length === 1 && activeList.projects[0].count === 0 && activeList.projects[0].archived === 1,
  activeList.projects,
);
const unarchived = await archiveStore.unarchive(archivable.todo.id);
check('unarchive clears archivedAt', unarchived.ok === true && unarchived.todo.archivedAt === null, unarchived);
const unarchiveTwice = await archiveStore.unarchive(archivable.todo.id);
check('unarchive when not shelved rejected', unarchiveTwice.ok === false && unarchiveTwice.code === 'NOT_ARCHIVED', unarchiveTwice);
const archiveCompletedTodo = await archiveStore.create({ title: '已完成的任务' });
await archiveStore.complete(archiveCompletedTodo.todo.id);
const archiveCompleted = await archiveStore.archive(archiveCompletedTodo.todo.id);
check('archive a completed todo rejected', archiveCompleted.ok === false && archiveCompleted.code === 'ARCHIVE_INVALID', archiveCompleted);
const unarchiveCompleted = await archiveStore.unarchive(archiveCompletedTodo.todo.id);
check('unarchive a completed todo rejected', unarchiveCompleted.ok === false && unarchiveCompleted.code === 'ARCHIVE_INVALID', unarchiveCompleted);
check('archive unknown id is not found', (await archiveStore.archive('nope')).code === 'NOT_FOUND');
check('unarchive unknown id is not found', (await archiveStore.unarchive('nope')).code === 'NOT_FOUND');

// completing a shelved todo clears archivedAt and reports it
clock += 60_000;
const shelvedAgain = await archiveStore.archive(archivable.todo.id);
check('archive works again after unarchive', shelvedAgain.ok === true && shelvedAgain.todo.archivedAt !== null, shelvedAgain);
const shelvedCompleted = await archiveStore.complete(archivable.todo.id);
check(
  'completing a shelved todo clears archivedAt',
  shelvedCompleted.ok === true
    && shelvedCompleted.todo.archivedAt === null
    && shelvedCompleted.todo.completedAt !== null,
  shelvedCompleted,
);
check(
  'completing a shelved todo reports it',
  (shelvedCompleted.notices ?? []).some((n) => n.includes('已从搁置清单完成')),
  shelvedCompleted.notices,
);
// uncomplete must not resurrect the shelved state
const reopenedArchived = await archiveStore.uncomplete(archivable.todo.id);
check(
  'uncomplete does not restore archivedAt',
  reopenedArchived.ok === true && reopenedArchived.todo.archivedAt === null,
  reopenedArchived.todo,
);
// update is not a back door into the shelved state
const attemptedArchiveUpdate = await archiveStore.update(
  archiveCompletedTodo.todo.id,
  { archivedAt: '2026-01-01T00:00:00.000Z' },
);
check(
  'update ignores archivedAt',
  attemptedArchiveUpdate.ok === true && attemptedArchiveUpdate.todo.archivedAt === null,
  attemptedArchiveUpdate.todo,
);
await archiveStore.dispose();

// sortBy estimateMinutes: 未填 always last, both directions
const estimateSortStore = new TodoStore({ dataFile: path.join(dir, 'estimate-sort.json'), now: () => clock });
await estimateSortStore.load();
const estShort = await estimateSortStore.create({ title: '短的', estimateMinutes: 15 });
const estLong = await estimateSortStore.create({ title: '长的', estimateMinutes: 120 });
await estimateSortStore.create({ title: '没填的' });
const estAsc = await estimateSortStore.list({ sortBy: 'estimateMinutes', direction: 'asc' });
check(
  'estimate ascending sorts by minutes with 未填 last',
  estAsc.todos.map((todo) => todo.estimateMinutes).join('|') === '15|120|',
  estAsc.todos.map((todo) => todo.estimateMinutes),
);
check('estimate sort keeps the short todo first', estAsc.todos[0].id === estShort.todo.id, estAsc.todos.map((todo) => todo.title));
const estDesc = await estimateSortStore.list({ sortBy: 'estimateMinutes', direction: 'desc' });
check(
  'estimate descending keeps 未填 last',
  estDesc.todos.map((todo) => todo.estimateMinutes).join('|') === '120|15|',
  estDesc.todos.map((todo) => todo.estimateMinutes),
);
check('estimate sort keeps the long todo first descending', estDesc.todos[0].id === estLong.todo.id, estDesc.todos.map((todo) => todo.title));
check('list echoes estimateMinutes sortBy', estDesc.sortBy === 'estimateMinutes', estDesc.sortBy);
check('list echoes archived filter', (await estimateSortStore.list({ filter: 'archived' })).filter === 'archived');
check(
  'sortTodos estimate null last both directions',
  sortTodos([
    { id: 'a', createdAt: '2026-01-01T00:00:00.000Z', estimateMinutes: null },
    { id: 'b', createdAt: '2026-01-01T00:00:00.000Z', estimateMinutes: 30 },
  ], { sortBy: 'estimateMinutes' }).at(-1).id === 'a'
    && sortTodos([
      { id: 'a', createdAt: '2026-01-01T00:00:00.000Z', estimateMinutes: null },
      { id: 'b', createdAt: '2026-01-01T00:00:00.000Z', estimateMinutes: 30 },
    ], { sortBy: 'estimateMinutes', direction: 'asc' }).at(-1).id === 'a',
);
await estimateSortStore.dispose();

// renderer: shelved count in the list header, estimate on a single todo
const renderedList = renderTodoResult('list', {
  ok: true,
  todos: [],
  stats: { total: 2, pending: 1, completed: 1, archived: 3 },
  projects: [],
  filter: 'all',
  sortBy: 'createdAt',
  direction: 'desc',
});
check('render list header counts shelved todos', renderedList.includes('另搁置 3 条'), renderedList);
const renderedSingle = renderTodoResult('get', {
  ok: true,
  todo: {
    id: 'ttl_render1',
    title: '带预计的任务',
    project: '',
    files: [],
    status: 'pending',
    priority: '',
    type: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: null,
    archivedAt: null,
    estimateMinutes: 30,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
});
check('render single todo appends the estimate', renderedSingle.includes('｜预计 30 分'), renderedSingle);
const renderedNoEstimate = renderTodoResult('get', {
  ok: true,
  todo: {
    id: 'ttl_render2',
    title: '没填预计的任务',
    project: '',
    files: [],
    status: 'pending',
    priority: '',
    type: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: null,
    archivedAt: null,
    estimateMinutes: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
});
check('render single todo hides a missing estimate', !renderedNoEstimate.includes('｜预计'), renderedNoEstimate);
const decoratedEstimate = decorateTodo({ ...estimateCreated.todo, estimateMinutes: 45, completedAt: null });
check(
  'decorate adds an estimate label',
  decoratedEstimate.estimateLabel === '预计 45 分' && decoratedEstimate.archivedAtLocal === '-',
  decoratedEstimate,
);
const decoratedNoEstimate = decorateTodo({ ...estimateCreated.todo, estimateMinutes: null, completedAt: null });
check('decorate hides a missing estimate', decoratedNoEstimate.estimateLabel === '', decoratedNoEstimate);

// shared action layer: archive / unarchive / estimateMinutes
const v6ActionStore = new TodoStore({ dataFile: path.join(dir, 'v6-actions.json'), now: () => clock });
await v6ActionStore.load();
const actionEstimate = await executeTodoAction(v6ActionStore, 'create', { title: '通过 action 带预计', estimateMinutes: 20 });
check('action create passes estimate', actionEstimate.ok === true && actionEstimate.todo.estimateMinutes === 20, actionEstimate.todo);
const actionArchived = await executeTodoAction(v6ActionStore, 'archive', { id: actionEstimate.todo.id });
check('action archive', actionArchived.ok === true && actionArchived.todo.archivedAt !== null, actionArchived);
const actionArchivedList = await executeTodoAction(v6ActionStore, 'list', { filter: 'archived' });
check(
  'action list archived filter',
  actionArchivedList.ok === true
    && actionArchivedList.filter === 'archived'
    && actionArchivedList.stats.archived === 1
    && actionArchivedList.stats.total === 0,
  actionArchivedList.stats,
);
const actionUnarchived = await executeTodoAction(v6ActionStore, 'unarchive', { id: actionEstimate.todo.id });
check('action unarchive', actionUnarchived.ok === true && actionUnarchived.todo.archivedAt === null, actionUnarchived);
const actionEstimateUpdate = await executeTodoAction(v6ActionStore, 'update', { id: actionEstimate.todo.id, estimateMinutes: 90 });
check('action update passes estimate', actionEstimateUpdate.ok === true && actionEstimateUpdate.todo.estimateMinutes === 90, actionEstimateUpdate.todo);
const actionEstimateBad = await executeTodoAction(v6ActionStore, 'create', { title: 'x', estimateMinutes: 0 });
check('action invalid estimate rejected', actionEstimateBad.ok === false && actionEstimateBad.code === 'ESTIMATE_INVALID', actionEstimateBad);
const actionMarkerEstimate = await executeTodoAction(v6ActionStore, 'create', { title: '写周报 ~30m', estimateMinutes: 45 });
check(
  'action create lets the marker beat the picker estimate',
  actionMarkerEstimate.todo.estimateMinutes === 30 && actionMarkerEstimate.todo.title === '写周报',
  actionMarkerEstimate.todo,
);
const actionQuickEstimate = await executeTodoAction(v6ActionStore, 'list', { sortBy: 'estimateMinutes', direction: 'asc' });
check(
  'action list supports sortBy=estimateMinutes',
  actionQuickEstimate.ok === true && actionQuickEstimate.sortBy === 'estimateMinutes',
  actionQuickEstimate.sortBy,
);
await v6ActionStore.dispose();


// unsupported envelope versions are archived, never guessed at
const futureFile = path.join(dir, 'future.json');
await fsp.writeFile(futureFile, JSON.stringify({ version: 99, todos: [] }), 'utf8');
const futureStore = new TodoStore({ dataFile: futureFile });
await futureStore.load();
const futureList = await futureStore.list({});
check('unsupported version archived', (await fsp.readdir(dir)).some((f) => f.startsWith('future.json.corrupt-version-99')), await fsp.readdir(dir));
check('unsupported version notice', futureList.notices.some((n) => n.includes('不受支持')), futureList.notices);
await futureStore.dispose();

// shared action layer (the same one the HTTP route and the tool call)
const actionStore = new TodoStore({ dataFile: path.join(dir, 'actions.json'), now: () => clock });
await actionStore.load();
const actionCreate = await executeTodoAction(actionStore, 'create', { title: '通过 action 创建' });
check('action create', actionCreate.ok === true, actionCreate);
const actionList = await executeTodoAction(actionStore, 'list', { filter: 'pending', sortBy: 'createdAt', direction: 'asc' });
check('action list', actionList.ok === true && actionList.stats.total === 1, actionList.stats);
const actionPriority = await executeTodoAction(actionStore, 'create', { title: '通过 action 带优先级', priority: 'high' });
check('action create passes priority', actionPriority.ok === true && actionPriority.todo.priority === 'high', actionPriority);
const actionPriorityList = await executeTodoAction(actionStore, 'list', { sortBy: 'priority' });
check(
  'action list supports sortBy=priority',
  actionPriorityList.ok === true && actionPriorityList.sortBy === 'priority'
    && actionPriorityList.todos[0].id === actionPriority.todo.id,
  actionPriorityList.todos,
);
const actionPriorityUpdate = await executeTodoAction(actionStore, 'update', { id: actionCreate.todo.id, priority: 'low' });
check('action update passes priority', actionPriorityUpdate.ok === true && actionPriorityUpdate.todo.priority === 'low', actionPriorityUpdate);
const actionPriorityBad = await executeTodoAction(actionStore, 'create', { title: 'x', priority: 'urgent' });
check('action invalid priority rejected', actionPriorityBad.ok === false && actionPriorityBad.code === 'PRIORITY_INVALID', actionPriorityBad);
const actionType = await executeTodoAction(actionStore, 'create', { title: '通过 action 带类型', type: 'bug' });
check('action create passes type', actionType.ok === true && actionType.todo.type === 'bug', actionType);
const actionTypeUpdate = await executeTodoAction(actionStore, 'update', { id: actionType.todo.id, type: '' });
check('action update passes type', actionTypeUpdate.ok === true && actionTypeUpdate.todo.type === '', actionTypeUpdate);
const actionTypeBad = await executeTodoAction(actionStore, 'create', { title: 'x', type: 'epic' });
check('action invalid type rejected', actionTypeBad.ok === false && actionTypeBad.code === 'TYPE_INVALID', actionTypeBad);
const actionBad = await executeTodoAction(actionStore, 'nope', {});
check('action unknown rejected', actionBad.ok === false && actionBad.code === 'BAD_REQUEST');
const decorated = decorateTodo(actionList.todos[0]);
check('decorate adds local fields', typeof decorated.createdAtLocal === 'string' && decorated.completedAtLocal === '-', decorated);
const decoratedPriority = decorateTodo({ ...actionPriority.todo, completedAt: null });
check('decorate high priority label', decoratedPriority.priorityLabel === '高', decoratedPriority);
const decoratedNoPriority = decorateTodo({ ...actionCreate.todo, priority: '', completedAt: null });
check('decorate unset priority label empty', decoratedNoPriority.priorityLabel === '', decoratedNoPriority);
const decoratedType = decorateTodo({ ...actionType.todo, type: 'bug', completedAt: null });
check('decorate type label', decoratedType.typeLabel === '缺陷', decoratedType);
const decoratedNoType = decorateTodo({ ...actionCreate.todo, type: '', completedAt: null });
check('decorate unset type label empty', decoratedNoType.typeLabel === '', decoratedNoType);

// tool quick_add path (same parser as /quick-add and /todo)
const toolStore = new TodoStore({ dataFile: path.join(dir, 'tool.json'), now: () => clock });
await toolStore.load();
const tool = createTodoTool(toolStore, null, () => '');
const toolQuick = await tool.execute({ action: 'quick_add', text: '新任务 写周报 #工作 @lib/store.js' });
check('tool quick_add ok', toolQuick.ok === true && toolQuick.created?.length === 1, toolQuick);
check('tool quick_add project', toolQuick.created?.[0]?.project === '工作', toolQuick.created?.[0]?.project);
check('tool quick_add files', toolQuick.created?.[0]?.files?.[0] === 'lib/store.js', toolQuick.created?.[0]?.files);
const toolQuickEmpty = await tool.execute({ action: 'quick_add', text: '   ' });
check('tool quick_add empty input rejected', toolQuickEmpty.ok === false && toolQuickEmpty.error?.code === 'BAD_REQUEST', toolQuickEmpty);
const toolQuickPriority = await tool.execute({ action: 'quick_add', text: '新任务 修 bug !high #工作' });
check('tool quick_add priority', toolQuickPriority.created?.[0]?.priority === 'high', toolQuickPriority.created?.[0]);
check('tool quick_add priority label', toolQuickPriority.created?.[0]?.priorityLabel === '高', toolQuickPriority.created?.[0]);
const toolQuickType = await tool.execute({ action: 'quick_add', text: '新任务 修 bug ^bug #工作' });
check('tool quick_add type', toolQuickType.created?.[0]?.type === 'bug', toolQuickType.created?.[0]);
check('tool quick_add type label', toolQuickType.created?.[0]?.typeLabel === '缺陷', toolQuickType.created?.[0]);
const toolQuickTypeFallback = await tool.execute({ action: 'quick_add', text: '写周报 #工作', type: 'feature' });
check('tool quick_add form type fallback', toolQuickTypeFallback.created?.[0]?.type === 'feature', toolQuickTypeFallback.created?.[0]);
// 回归：工具侧 quick_add 曾漏传 estimateMinutes 兜底值（HTTP /quick-add 有、工具没有），
// 参数在同一个 properties 层里却静默失效，模型会误以为写进去了。
const toolQuickEstimate = await tool.execute({ action: 'quick_add', text: '写周报 #工作', estimateMinutes: 45 });
check('tool quick_add estimate fallback', toolQuickEstimate.created?.[0]?.estimateMinutes === 45, toolQuickEstimate.created?.[0]);
const toolQuickEstimateMarker = await tool.execute({ action: 'quick_add', text: '写周报 ~20m #工作', estimateMinutes: 45 });
check('tool quick_add marker beats fallback', toolQuickEstimateMarker.created?.[0]?.estimateMinutes === 20, toolQuickEstimateMarker.created?.[0]);
const renderedTool = tool.output.render({ action: 'quick_add' }, toolQuick);
check('tool quick_add renders text', Array.isArray(renderedTool) && renderedTool[0].text.includes('写周报'), renderedTool);
await toolStore.dispose();

// project suggestions: used > workspace > folder, de-duplicated case-insensitively
const suggestions = buildProjectSuggestions({
  used: [{ name: '工作', count: 3 }, { name: 'lib', count: 1 }],
  workspaces: [{ title: 'dsh-todo-time-log' }, { title: '工作' }, { title: 'File_Manager_Legacy' }],
  folders: ['lib', 'src', 'test', 'a'.repeat(41)],
});
check('suggestions used first by count', suggestions[0].name === '工作' && suggestions[0].source === 'used', suggestions);
check('suggestions include workspaces', suggestions.some((item) => item.name === 'File_Manager_Legacy' && item.source === 'workspace'), suggestions);
check('suggestions include folders', suggestions.some((item) => item.name === 'src' && item.source === 'folder'), suggestions);
check('suggestions de-duplicate case-insensitively', suggestions.filter((item) => item.name.toLowerCase() === '工作').length === 1, suggestions);
check('suggestions skip over-long names', !suggestions.some((item) => item.name.length > 40), suggestions.map((item) => item.name));
check('suggestions keep merged usage count', suggestions.find((item) => item.name === '工作')?.count === 3, suggestions);

// command attachments are mapped onto workspace paths and merged into created todos
const attachmentStore = new TodoStore({ dataFile: path.join(dir, 'attachments.json'), now: () => clock });
await attachmentStore.load();
const fakeIndex = {
  knownFileSet: async () => new Set(['lib/store.js', 'docs/My File.md']),
  listDirectories: async () => [],
  list: async () => ({ root: '/x', files: [], total: 0, truncated: false }),
};
const attachmentFiles = await resolveCommandAttachmentFiles(
  { attachments: [
    { type: 'file', attachment: { name: 'lib/store.js' } },
    { type: 'file', attachment: { name: 'My File.md' } },
    { type: 'image', attachment: { name: 'shot.png' } },
  ] },
  fakeIndex,
  '/x',
);
check('attachment paths resolved', attachmentFiles.join('|') === 'lib/store.js|docs/My File.md', attachmentFiles);
const noIndexFiles = await resolveCommandAttachmentFiles({ attachments: [{ type: 'file', attachment: { name: 'a.ts' } }] }, null, '/x');
check('attachments need a file index', noIndexFiles.length === 0);
const quickWithFiles = await runQuickAdd(
  attachmentStore,
  fakeIndex,
  '写周报',
  '/x',
  ['lib/store.js'],
);
check('quick add merges attachment files', quickWithFiles.ok === true && quickWithFiles.created[0].files[0] === 'lib/store.js', quickWithFiles);
check('quick add derives project from attachment', quickWithFiles.created[0].project === 'lib', quickWithFiles.created[0]);
const quickFallbackPriority = await runQuickAdd(attachmentStore, fakeIndex, '写周报', '/x', [], 'medium');
check(
  'quick add form priority fallback',
  quickFallbackPriority.ok === true && quickFallbackPriority.created[0].priority === 'medium',
  quickFallbackPriority.created[0],
);
const quickMarkerPriority = await runQuickAdd(attachmentStore, fakeIndex, '写周报 !low', '/x', [], 'medium');
check(
  'quick add marker beats form priority',
  quickMarkerPriority.ok === true && quickMarkerPriority.created[0].priority === 'low',
  quickMarkerPriority.created[0],
);
const quickFallbackType = await runQuickAdd(attachmentStore, fakeIndex, '写周报', '/x', [], '', 'bug');
check(
  'quick add form type fallback',
  quickFallbackType.ok === true && quickFallbackType.created[0].type === 'bug',
  quickFallbackType.created[0],
);
const quickMarkerType = await runQuickAdd(attachmentStore, fakeIndex, '写周报 ^feature', '/x', [], '', 'bug');
check(
  'quick add marker beats form type',
  quickMarkerType.ok === true && quickMarkerType.created[0].type === 'feature',
  quickMarkerType.created[0],
);
await attachmentStore.dispose();

// resolveDataFile precedence
const oldEnv = process.env.DSH_PROFILE_DIR;
process.env.DSH_PROFILE_DIR = dir;
check('dataFile default under profile', resolveDataFile({}) === path.join(dir, 'todo-time-log', 'todos.json'));
check('dataFile relative config', resolveDataFile({ dataFile: 'x/y.json' }) === path.join(dir, 'x', 'y.json'));
check('dataFile absolute config', resolveDataFile({ dataFile: path.join(dir, 'abs.json') }) === path.join(dir, 'abs.json'));
if (oldEnv === undefined) delete process.env.DSH_PROFILE_DIR; else process.env.DSH_PROFILE_DIR = oldEnv;

await store.dispose();
await reloadedStore.dispose();
await corruptStore.dispose();
await actionStore.dispose();
await fsp.rm(dir, { recursive: true, force: true });
