/**
 * `/settings` 与 `/settings/update` 的 HTTP 端到端测试：真实 Node HTTP 服务 +
 * `createHttpHandler(store, { settingsStore })`，并校验偏好文件与数据文件同目录。
 *
 * 运行：node --test test/http-settings.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TodoStore } from '../lib/store.js';
import { createHttpHandler, ROUTE_PREFIX } from '../lib/index.js';
import { createSettingsStore, resolveSettingsFile } from '../lib/settings.js';

const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ttl-http-settings-'));
const dataFile = path.join(dir, 'todos.json');
const settingsFile = resolveSettingsFile(dataFile);
const store = new TodoStore({ dataFile });
await store.load();
const settingsStore = createSettingsStore({ file: settingsFile });
const server = http.createServer(createHttpHandler(store, { settingsStore }));
const serverWithout = http.createServer(createHttpHandler(store));
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
await new Promise((resolve) => serverWithout.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const bareOrigin = `http://127.0.0.1:${serverWithout.address().port}`;

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await new Promise((resolve) => serverWithout.close(resolve));
  await store.dispose().catch(() => {});
  await fsp.rm(dir, { recursive: true, force: true });
});

async function post(base, action, body) {
  const response = await fetch(`${base}${ROUTE_PREFIX}/${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  return { status: response.status, body: await response.json() };
}

test('偏好文件与数据文件同目录、同主名', () => {
  assert.equal(settingsFile, path.join(dir, 'todos.settings.json'));
});

test('GET /settings 走 health 的 GET 分支 → 405（偏好只支持 POST）', async () => {
  const response = await fetch(`${origin}${ROUTE_PREFIX}/settings`);
  assert.equal(response.status, 405);
});

test('POST /settings 默认值：没有偏好文件时快捷入口默认开', async () => {
  const read = await post(origin, 'settings', {});
  assert.equal(read.status, 200);
  assert.equal(read.body.ok, true);
  assert.deepEqual(read.body.value, { quickEntry: true });
});

test('POST /settings/update 写入 false 并落盘到 todos.settings.json', async () => {
  const updated = await post(origin, 'settings/update', { quickEntry: false });
  assert.equal(updated.status, 200);
  assert.deepEqual(updated.body.value, { quickEntry: false });
  const envelope = JSON.parse(await fsp.readFile(settingsFile, 'utf8'));
  assert.deepEqual(envelope.settings, { quickEntry: false });
  const read = await post(origin, 'settings', {});
  assert.deepEqual(read.body.value, { quickEntry: false });
});

test('POST /settings/update 非法类型 → 400 SETTINGS_INVALID 且不改动磁盘', async () => {
  const before = await fsp.readFile(settingsFile, 'utf8');
  const bad = await post(origin, 'settings/update', { quickEntry: 'off' });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, 'SETTINGS_INVALID');
  assert.equal(await fsp.readFile(settingsFile, 'utf8'), before);
});

test('POST /settings/update 重新打开写回 true', async () => {
  const updated = await post(origin, 'settings/update', { quickEntry: true });
  assert.equal(updated.status, 200);
  assert.deepEqual(updated.body.value, { quickEntry: true });
});

test('未知设置键被忽略、已知键照常写入', async () => {
  const updated = await post(origin, 'settings/update', { quickEntry: false, theme: 'dark' });
  assert.equal(updated.status, 200);
  assert.deepEqual(updated.body.value, { quickEntry: false });
  await post(origin, 'settings/update', { quickEntry: true });
});

test('宿主没有设置存储时 /settings 返回 501 SETTINGS_UNAVAILABLE', async () => {
  const read = await post(bareOrigin, 'settings', {});
  assert.equal(read.status, 501);
  assert.equal(read.body.error.code, 'SETTINGS_UNAVAILABLE');
  const write = await post(bareOrigin, 'settings/update', { quickEntry: false });
  assert.equal(write.status, 501);
});

test('设置路由不影响待办路由（/health 与 /create 仍正常）', async () => {
  const health = await fetch(`${origin}${ROUTE_PREFIX}/health`);
  assert.equal(health.status, 200);
  const created = await post(origin, 'create', { title: '设置功能不打扰待办' });
  assert.equal(created.status, 200);
  assert.equal(created.body.value.todo.title, '设置功能不打扰待办');
});
