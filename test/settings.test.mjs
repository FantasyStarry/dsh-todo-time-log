/**
 * Preferences store（`lib/settings.js`）单元测试：纯函数规整、路径推导、
 * 原子写/读、损坏兜底与并发写入。
 *
 * 运行：node --test test/settings.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_SETTINGS,
  SETTINGS_VERSION,
  createSettingsStore,
  normalizeSettings,
  normalizeSettingsPatch,
  resolveSettingsFile,
} from '../lib/settings.js';

const silentLogger = { warn() {}, error() {} };

async function makeTempDir(t) {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ttl-settings-'));
  t.after(() => fsp.rm(dir, { recursive: true, force: true }));
  return dir;
}

test('默认偏好：快捷入口默认开', () => {
  assert.deepEqual(DEFAULT_SETTINGS, { quickEntry: true });
});

test('resolveSettingsFile 与数据文件同目录、同主名', () => {
  assert.equal(
    resolveSettingsFile(path.join('C:', 'data', 'todos.json')),
    path.join('C:', 'data', 'todos.settings.json')
  );
  assert.equal(
    resolveSettingsFile(path.join('C:', 'data', 'custom-data.json')),
    path.join('C:', 'data', 'custom-data.settings.json')
  );
  assert.equal(
    resolveSettingsFile(path.join('C:', 'data', 'todos')),
    path.join('C:', 'data', 'todos.settings.json')
  );
});

test('normalizeSettings：缺失/非法类型回落到默认开', () => {
  assert.deepEqual(normalizeSettings(undefined), { quickEntry: true });
  assert.deepEqual(normalizeSettings(null), { quickEntry: true });
  assert.deepEqual(normalizeSettings('off'), { quickEntry: true });
  assert.deepEqual(normalizeSettings([]), { quickEntry: true });
  assert.deepEqual(normalizeSettings({ quickEntry: 'no' }), { quickEntry: true });
});

test('normalizeSettings：接受扁平与信封两种形态', () => {
  assert.deepEqual(normalizeSettings({ quickEntry: false }), { quickEntry: false });
  assert.deepEqual(normalizeSettings({ version: 1, settings: { quickEntry: false } }), { quickEntry: false });
  assert.deepEqual(normalizeSettings({ version: 99, settings: { quickEntry: 'x' } }), { quickEntry: true });
});

test('normalizeSettingsPatch：只收已知键、类型必须是布尔', () => {
  assert.deepEqual(normalizeSettingsPatch({ quickEntry: false }), { ok: true, patch: { quickEntry: false } });
  assert.deepEqual(normalizeSettingsPatch({ quickEntry: false, unknown: 1 }), {
    ok: true,
    patch: { quickEntry: false },
  });
  assert.deepEqual(normalizeSettingsPatch({}), { ok: true, patch: {} });
  assert.equal(normalizeSettingsPatch({ quickEntry: 'false' }).ok, false);
  assert.equal(normalizeSettingsPatch({ quickEntry: 'false' }).code, 'SETTINGS_INVALID');
  assert.equal(normalizeSettingsPatch(null).code, 'SETTINGS_INVALID');
  assert.equal(normalizeSettingsPatch('x').code, 'SETTINGS_INVALID');
});

test('createSettingsStore：文件不存在时读默认值，且不写盘', async (t) => {
  const dir = await makeTempDir(t);
  const file = path.join(dir, 'todos.settings.json');
  const store = createSettingsStore({ file, logger: silentLogger });
  assert.deepEqual(await store.read(), { quickEntry: true });
  await assert.rejects(fsp.stat(file));
});

test('createSettingsStore：update 落盘为带版本的信封，read 能读回', async (t) => {
  const dir = await makeTempDir(t);
  const file = path.join(dir, 'todos.settings.json');
  const store = createSettingsStore({ file, logger: silentLogger });
  const updated = await store.update({ quickEntry: false });
  assert.equal(updated.ok, true);
  assert.deepEqual(updated.settings, { quickEntry: false });
  const envelope = JSON.parse(await fsp.readFile(file, 'utf8'));
  assert.equal(envelope.version, SETTINGS_VERSION);
  assert.equal(typeof envelope.updatedAt, 'string');
  assert.deepEqual(envelope.settings, { quickEntry: false });
  assert.deepEqual(await store.read(), { quickEntry: false });
});

test('createSettingsStore：新实例从磁盘读到同一偏好（跨浏览器语义）', async (t) => {
  const dir = await makeTempDir(t);
  const file = path.join(dir, 'todos.settings.json');
  await createSettingsStore({ file, logger: silentLogger }).update({ quickEntry: false });
  const second = createSettingsStore({ file, logger: silentLogger });
  assert.deepEqual(await second.read(), { quickEntry: false });
});

test('createSettingsStore：非法补丁不写盘且返回错误码', async (t) => {
  const dir = await makeTempDir(t);
  const file = path.join(dir, 'todos.settings.json');
  const store = createSettingsStore({ file, logger: silentLogger });
  const result = await store.update({ quickEntry: 'off' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'SETTINGS_INVALID');
  await assert.rejects(fsp.stat(file));
});

test('createSettingsStore：空补丁是无害 no-op', async (t) => {
  const dir = await makeTempDir(t);
  const file = path.join(dir, 'todos.settings.json');
  const store = createSettingsStore({ file, logger: silentLogger });
  const result = await store.update({});
  assert.equal(result.ok, true);
  await assert.rejects(fsp.stat(file));
});

test('createSettingsStore：损坏 JSON 回落默认值并记 warn，下一次写入覆盖它', async (t) => {
  const dir = await makeTempDir(t);
  const file = path.join(dir, 'todos.settings.json');
  const warnings = [];
  await fsp.writeFile(file, '{oops', 'utf8');
  const store = createSettingsStore({
    file,
    logger: { warn: (message) => warnings.push(String(message)), error() {} },
  });
  assert.deepEqual(await store.read(), { quickEntry: true });
  assert.equal(warnings.length, 1);
  const updated = await store.update({ quickEntry: false });
  assert.equal(updated.ok, true);
  assert.deepEqual(JSON.parse(await fsp.readFile(file, 'utf8')).settings, { quickEntry: false });
});

test('createSettingsStore：并发写入串行化，last-write-wins（30 轮确定性）', async (t) => {
  const dir = await makeTempDir(t);
  const file = path.join(dir, 'todos.settings.json');
  const store = createSettingsStore({ file, logger: silentLogger });
  // 调用顺序 = 入队顺序，因此最后落盘/缓存的一定是最后一次调用的值。
  // 首轮会真的读文件（cache 未命中），历史上这里暴露过「await 之后才排队」的竞态。
  for (let round = 0; round < 30; round += 1) {
    const results = await Promise.all([
      store.update({ quickEntry: false }),
      store.update({ quickEntry: true }),
      store.update({ quickEntry: false }),
    ]);
    assert.equal(results.every((result) => result.ok === true), true, `第 ${round + 1} 轮写入失败`);
    const envelope = JSON.parse(await fsp.readFile(file, 'utf8'));
    assert.equal(envelope.settings.quickEntry, false, `第 ${round + 1} 轮磁盘不是最后的值`);
    assert.deepEqual(await store.read(), { quickEntry: false }, `第 ${round + 1} 轮缓存不是最后的值`);
  }
});

test('createSettingsStore：并发交替读写后磁盘与缓存一致', async (t) => {
  const dir = await makeTempDir(t);
  const file = path.join(dir, 'todos.settings.json');
  const store = createSettingsStore({ file, logger: silentLogger });
  const writes = [true, false, true, false, true].map((value) => store.update({ quickEntry: value }));
  const reads = [store.read(), store.read()];
  await Promise.all([...writes, ...reads]);
  const envelope = JSON.parse(await fsp.readFile(file, 'utf8'));
  assert.equal(envelope.settings.quickEntry, true);
  assert.deepEqual(await store.read(), { quickEntry: true });
});

test('createSettingsStore：写入失败返回 SETTINGS_WRITE_FAILED（目标路径被目录占用）', async (t) => {
  const dir = await makeTempDir(t);
  const file = path.join(dir, 'todos.settings.json');
  // 先占住目标路径，rename 会失败；覆盖写也会失败。
  await fsp.mkdir(file);
  const store = createSettingsStore({ file, logger: silentLogger });
  const result = await store.update({ quickEntry: false });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'SETTINGS_WRITE_FAILED');
  assert.equal(store.describe().lastPersistError === '', false);
});

test('createSettingsStore：describe 暴露文件路径与最近一次写入错误', async (t) => {
  const dir = await makeTempDir(t);
  const file = path.join(dir, 'todos.settings.json');
  const store = createSettingsStore({ file, logger: silentLogger });
  const described = store.describe();
  assert.equal(described.file, file);
  assert.equal(described.lastPersistError, '');
  await store.update({ quickEntry: true });
  assert.equal(store.describe().lastPersistError, '');
});
