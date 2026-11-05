/**
 * End-to-end HTTP test for the Web UI routes.
 *
 * Mounts the real `createHttpHandler()` on a throwaway Node HTTP server and
 * speaks to it exactly like the browser half does, so the route prefix, method
 * handling, JSON envelope and error mapping are all exercised.
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

const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ttl-http-'));
const store = new TodoStore({ dataFile: path.join(dir, 'todos.json') });
await store.load();

const server = http.createServer(createHttpHandler(store));
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const origin = `http://127.0.0.1:${port}`;

async function post(action, body) {
  const response = await fetch(`${origin}${ROUTE_PREFIX}/${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  return { status: response.status, body: await response.json() };
}

try {
  // health over GET
  const health = await fetch(`${origin}${ROUTE_PREFIX}/health`);
  const healthBody = await health.json();
  check('health 200', health.status === 200, health.status);
  check('health ok envelope', healthBody.ok === true && typeof healthBody.value.dataFile === 'string', healthBody);

  // prefix root also answers health
  const root = await fetch(`${origin}${ROUTE_PREFIX}`);
  check('empty suffix -> health', (await root.json()).ok === true);

  // create
  const created = await post('create', { title: 'HTTP 新建' });
  check('create 200', created.status === 200, created.status);
  check('create value.todo', created.body.ok === true && created.body.value.todo.title === 'HTTP 新建', created.body);
  const todoId = created.body.value?.todo?.id;

  // validation failure
  const badTitle = await post('create', { title: '  ' });
  check('empty title 400', badTitle.status === 400, badTitle.status);
  check('empty title code', badTitle.body.error?.code === 'TITLE_REQUIRED', badTitle.body);

  // malformed JSON body
  const malformed = await fetch(`${origin}${ROUTE_PREFIX}/create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{oops',
  });
  check('malformed json 400', malformed.status === 400, malformed.status);

  // list
  const listed = await post('list', { filter: 'pending', sortBy: 'createdAt', direction: 'asc' });
  check('list 200', listed.status === 200 && listed.body.ok === true, listed.body);
  check('list has stats', listed.body.value?.stats?.total === 1, listed.body.value?.stats);

  // complete + duplicate
  const completed = await post('complete', { id: todoId });
  check('complete 200', completed.status === 200 && completed.body.value.todo.completedAt !== null, completed.body);
  const duplicate = await post('complete', { id: todoId });
  check('duplicate complete 409', duplicate.status === 409, duplicate.status);
  check('duplicate complete code', duplicate.body.error?.code === 'ALREADY_COMPLETED', duplicate.body);

  // uncomplete
  const reopened = await post('uncomplete', { id: todoId });
  check('uncomplete clears completedAt', reopened.body.value?.todo?.completedAt === null, reopened.body);

  // update
  const renamed = await post('update', { id: todoId, title: '改名' });
  check('update 200', renamed.body.value?.todo?.title === '改名', renamed.body);

  // missing id / unknown id
  const notFound = await post('complete', { id: 'missing' });
  check('unknown id 404', notFound.status === 404 && notFound.body.error?.code === 'NOT_FOUND', notFound.body);

  // unknown action
  const unknown = await post('bogus', {});
  check('unknown action 404', unknown.status === 404, unknown.status);

  // wrong method
  const wrongMethod = await fetch(`${origin}${ROUTE_PREFIX}/create`, { method: 'DELETE' });
  check('wrong method 405', wrongMethod.status === 405, wrongMethod.status);

  // project categories (v2 contract)
  const tagged = await post('create', { title: '分类任务', project: '工作' });
  check('create with project', tagged.body.value?.todo?.project === '工作', tagged.body);
  const taggedId = tagged.body.value?.todo?.id;
  const projectList = await post('list', { project: '工作' });
  check(
    'list returns projects summary',
    Array.isArray(projectList.body.value?.projects)
      && projectList.body.value.projects.some((group) => group.name === '工作' && group.pending === 1),
    projectList.body.value,
  );
  check('list filters by project', projectList.body.value?.todos?.length === 1, projectList.body.value?.todos);
  const projectOnlyUpdate = await post('update', { id: taggedId, project: '生活' });
  check(
    'update project only keeps title',
    projectOnlyUpdate.body.value?.todo?.project === '生活'
      && projectOnlyUpdate.body.value?.todo?.title === '分类任务',
    projectOnlyUpdate.body,
  );
  const invalidProject = await post('create', { title: 'x', project: { nested: true } });
  check('invalid project type 400', invalidProject.status === 400, invalidProject.status);
  check('invalid project code', invalidProject.body.error?.code === 'PROJECT_INVALID', invalidProject.body);
  // quick-add (natural language, parsed by the Host)
  const quick = await post('quick-add', {
    text: '新任务 写周报 #工作 @src/auth/login.ts；买牛奶 @生活',
  });
  check('quick-add 200', quick.status === 200 && quick.body.ok === true, quick.body);
  check('quick-add created two', quick.body.value?.created?.length === 2, quick.body.value);
  const firstCreated = quick.body.value?.created?.[0];
  const secondCreated = quick.body.value?.created?.[1];
  check('quick-add project', firstCreated?.project === '工作' && secondCreated?.project === '生活', [firstCreated?.project, secondCreated?.project]);
  check('quick-add file reference', firstCreated?.files?.[0] === 'src/auth/login.ts', firstCreated?.files);
  for (const todo of [firstCreated, secondCreated]) {
    if (todo) await post('delete', { id: todo.id });
  }

  // quick-add: the form-picker priority is a fallback; a text marker wins
  const quickPriority = await post('quick-add', {
    text: '写周报 #工作\n买牛奶 !low',
    priority: 'high',
  });
  const quickPriorityCreated = quickPriority.body.value?.created ?? [];
  check('quick-add form priority fallback', quickPriorityCreated[0]?.priority === 'high', quickPriorityCreated);
  check('quick-add marker beats form priority', quickPriorityCreated[1]?.priority === 'low', quickPriorityCreated);
  for (const todo of quickPriorityCreated) await post('delete', { id: todo.id });

  // create with files derives the project from the file directory
  const withFile = await post('create', { title: '文件任务', files: ['src/auth/login.ts'] });
  check('create with files derives project', withFile.body.value?.todo?.project === 'src/auth', withFile.body);
  const fileId = withFile.body.value?.todo?.id;
  const badFiles = await post('create', { title: 'x', files: ['/etc/passwd'] });
  check('invalid file path 400', badFiles.status === 400 && badFiles.body.error?.code === 'FILES_INVALID', badFiles.body);
  const updatedFiles = await post('update', { id: fileId, files: [] });
  check('update files to empty', updatedFiles.body.value?.todo?.files?.length === 0, updatedFiles.body);
  await post('delete', { id: fileId });

  // project suggestions (used categories; workspace/folder sources need services)
  const projectsResponse = await post('projects', {});
  check('projects 200', projectsResponse.status === 200 && projectsResponse.body.ok === true, projectsResponse.body);
  const suggestions = projectsResponse.body.value?.suggestions ?? [];
  check(
    'projects include already-used categories',
    Array.isArray(suggestions) && suggestions.some((item) => item.source === 'used'),
    suggestions,
  );

  // /files without an fs-backed index (this harness passes no fileIndex)
  const filesResponse = await post('files', { query: 'src' });
  check('files endpoint degrades to 501', filesResponse.status === 501, filesResponse.status);
  check('files endpoint error code', filesResponse.body.error?.code === 'FILES_UNAVAILABLE', filesResponse.body);

  const invalidListFilter = await post('list', { project: { nested: true } });
  check('list invalid project filter 400', invalidListFilter.status === 400, invalidListFilter.status);
  check('list invalid project filter code', invalidListFilter.body.error?.code === 'PROJECT_INVALID', invalidListFilter.body);
  await post('delete', { id: taggedId });

  // priority (v4 contract)
  const highPriority = await post('create', { title: '高优先级任务', priority: 'high' });
  check('create with priority', highPriority.body.value?.todo?.priority === 'high', highPriority.body);
  const highPriorityId = highPriority.body.value?.todo?.id;
  const invalidPriority = await post('create', { title: 'x', priority: 'urgent' });
  check('invalid priority 400', invalidPriority.status === 400, invalidPriority.status);
  check('invalid priority code', invalidPriority.body.error?.code === 'PRIORITY_INVALID', invalidPriority.body);
  const lowPriority = await post('create', { title: '低优先级任务', priority: 'low' });
  const unsetPriority = await post('create', { title: '无优先级任务' });
  check('priority defaults to empty', unsetPriority.body.value?.todo?.priority === '', unsetPriority.body.value?.todo);
  const prioritySorted = await post('list', { sortBy: 'priority' });
  check('sortBy priority accepted', prioritySorted.body.value?.sortBy === 'priority', prioritySorted.body.value);
  check(
    'sortBy priority puts unset last',
    prioritySorted.body.value?.todos?.at(-1)?.priority === ''
      && prioritySorted.body.value?.todos?.[0]?.priority === 'high',
    prioritySorted.body.value?.todos?.map((todo) => todo.priority),
  );
  const priorityOnlyUpdate = await post('update', { id: highPriorityId, priority: '' });
  check(
    'update priority only keeps title',
    priorityOnlyUpdate.body.value?.todo?.priority === ''
      && priorityOnlyUpdate.body.value?.todo?.title === '高优先级任务',
    priorityOnlyUpdate.body,
  );
  const updatePriorityAgain = await post('update', { id: highPriorityId, priority: 'medium' });
  check('update priority value', updatePriorityAgain.body.value?.todo?.priority === 'medium', updatePriorityAgain.body);
  const markerPriority = await post('create', { title: '修 bug !high #lib' });
  check(
    'create strips priority marker',
    markerPriority.body.value?.todo?.priority === 'high' && markerPriority.body.value?.todo?.title === '修 bug',
    markerPriority.body.value?.todo,
  );
  for (const todo of [highPriority, lowPriority, unsetPriority, markerPriority]) {
    if (todo.body?.value?.todo?.id) await post('delete', { id: todo.body.value.todo.id });
  }

  // type (v5 contract)
  const bugTask = await post('create', { title: '缺陷任务', type: 'bug' });
  check('create with type', bugTask.body.value?.todo?.type === 'bug', bugTask.body);
  const bugTaskId = bugTask.body.value?.todo?.id;
  const invalidType = await post('create', { title: 'x', type: 'epic' });
  check('invalid type 400', invalidType.status === 400, invalidType.status);
  check('invalid type code', invalidType.body.error?.code === 'TYPE_INVALID', invalidType.body);
  const typeOnlyUpdate = await post('update', { id: bugTaskId, type: 'question' });
  check(
    'update type only keeps title',
    typeOnlyUpdate.body.value?.todo?.type === 'question'
      && typeOnlyUpdate.body.value?.todo?.title === '缺陷任务',
    typeOnlyUpdate.body,
  );
  const clearedType = await post('update', { id: bugTaskId, type: '' });
  check('update clears type', clearedType.body.value?.todo?.type === '', clearedType.body);
  const markerType = await post('create', { title: '修 bug ^bug #lib' });
  check(
    'create strips type marker',
    markerType.body.value?.todo?.type === 'bug' && markerType.body.value?.todo?.title === '修 bug',
    markerType.body.value?.todo,
  );
  await post('delete', { id: markerType.body.value?.todo?.id });
  const quickType = await post('quick-add', { text: '修登录 ^bug\n写文档', type: 'feature' });
  const quickTypeCreated = quickType.body.value?.created ?? [];
  check('quick-add type marker', quickTypeCreated[0]?.type === 'bug', quickTypeCreated);
  check('quick-add form type fallback', quickTypeCreated[1]?.type === 'feature', quickTypeCreated);
  for (const todo of quickTypeCreated) await post('delete', { id: todo.id });
  await post('delete', { id: bugTaskId });

  // markers in a plain /create title are parsed instead of polluting the title
  const markerCreate = await post('create', { title: '测试 #lib', project: '' });
  check('create strips #marker from title', markerCreate.body.value?.todo?.title === '测试', markerCreate.body.value?.todo);
  check('create uses marker as project', markerCreate.body.value?.todo?.project === 'lib', markerCreate.body.value?.todo);
  const markerFile = await post('create', { title: '@lib/store.js 写文档', project: '' });
  check('create extracts @file', markerFile.body.value?.todo?.files?.[0] === 'lib/store.js', markerFile.body.value?.todo);
  check('create derives project from file', markerFile.body.value?.todo?.project === 'lib', markerFile.body.value?.todo);
  const plainCreate = await post('create', { title: '普通标题', project: '工作' });
  check('plain title keeps picker project', plainCreate.body.value?.todo?.title === '普通标题' && plainCreate.body.value?.todo?.project === '工作', plainCreate.body.value?.todo);
  const cHash = await post('create', { title: 'C#学习' });
  check('C#学习 is not treated as a marker', cHash.body.value?.todo?.title === 'C#学习', cHash.body.value?.todo);
  for (const todo of [markerCreate, markerFile, plainCreate, cHash]) {
    if (todo.body?.value?.todo?.id) await post('delete', { id: todo.body.value.todo.id });
  }

  // markers in a plain /create title are parsed instead of polluting the title
  // delete
  const deleted = await post('delete', { id: todoId });
  check('delete 200', deleted.body.value?.deleted === todoId, deleted.body);
  check('delete again 404', (await post('delete', { id: todoId })).status === 404);

  // non-JSON object body
  const arrayBody = await fetch(`${origin}${ROUTE_PREFIX}/list`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '[1,2,3]',
  });
  check('array body 400', arrayBody.status === 400, arrayBody.status);

  // persisted after all of it
  const reloaded = new TodoStore({ dataFile: path.join(dir, 'todos.json') });
  await reloaded.load();
  const reloadedList = await reloaded.list({});
  check('persisted state readable', reloadedList.stats.total === 0, reloadedList.stats);
  await reloaded.dispose();

  // ---- host admission (connection.requestRejection) ----
  // The production wiring passes `authorize`; every route must be refused
  // before it reads or writes anything when the host rejects the caller.
  async function withAuthorize(authorize, run) {
    const guarded = http.createServer(createHttpHandler(store, { authorize }));
    await new Promise((resolve) => guarded.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${guarded.address().port}${ROUTE_PREFIX}`;
    try {
      await run(base);
    } finally {
      await new Promise((resolve) => guarded.close(resolve));
    }
  }

  await withAuthorize(() => 401, async (base) => {
    for (const [method, action] of [['GET', 'health'], ['POST', 'list'], ['POST', 'create']]) {
      const response = await fetch(`${base}/${action}`, {
        method,
        ...(method === 'POST'
          ? { headers: { 'content-type': 'application/json' }, body: '{"title":"绕过"}' }
          : {}),
      });
      const body = await response.json();
      check(`unauthenticated ${method} /${action} -> 401`, response.status === 401, response.status);
      check(`unauthenticated ${method} /${action} envelope`, body.ok === false && body.error?.code === 'UNAUTHORIZED', body);
    }
  });

  await withAuthorize(() => 403, async (base) => {
    const response = await fetch(`${base}/health`);
    const body = await response.json();
    check('untrusted origin -> 403', response.status === 403, response.status);
    check('untrusted origin code', body.error?.code === 'FORBIDDEN', body);
  });

  // A throwing admission check must reject rather than fall through.
  await withAuthorize(() => { throw new Error('connection unavailable'); }, async (base) => {
    const response = await fetch(`${base}/list`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    check('failing admission -> 403', response.status === 403, response.status);
  });

  // Admitted callers keep the normal contract.
  await withAuthorize(() => undefined, async (base) => {
    const response = await fetch(`${base}/health`);
    check('admitted caller -> 200', response.status === 200, response.status);
  });

  // Rejected requests must not have written anything.
  const untouched = new TodoStore({ dataFile: path.join(dir, 'todos.json') });
  await untouched.load();
  check('rejected requests wrote nothing', untouched.size === 0, untouched.size);
  await untouched.dispose();
} finally {
  await new Promise((resolve) => server.close(resolve));
  await store.dispose();
  await fsp.rm(dir, { recursive: true, force: true });
}
