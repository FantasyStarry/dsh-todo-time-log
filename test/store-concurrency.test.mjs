/**
 * Cross-process concurrency tests for `TodoStore`.
 *
 * Two independent instances pointing at the same data file must merge each
 * other's records instead of silently overwriting them (last-write-wins), the
 * `.lock` protocol must recover from a stale lock, and concurrent writes must
 * never leave a corrupt JSON file behind.
 *
 * Run: node --test test/store-concurrency.test.mjs
 */
import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { TodoStore } from '../lib/store.js';

/** Temp dir + store factory that disposes every store and removes the dir. */
async function makeTempFixture(t) {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ttl-store-concurrency-'));
  const stores = [];
  t.after(async () => {
    for (const store of stores) {
      await store.dispose().catch(() => {});
    }
    await fsp.rm(dir, { recursive: true, force: true });
  });
  return {
    dir,
    dataFile: path.join(dir, 'todos.json'),
    makeStore(options = {}) {
      const store = new TodoStore({ dataFile: path.join(dir, 'todos.json'), ...options });
      stores.push(store);
      return store;
    },
  };
}

async function readTodos(dataFile) {
  const text = await fsp.readFile(dataFile, 'utf8');
  const parsed = JSON.parse(text); // must be valid JSON, never a torn write
  assert.equal(parsed.version, 5);
  assert.ok(Array.isArray(parsed.todos));
  return parsed.todos;
}

function sortedIds(rows) {
  return rows.map((row) => row.id).sort();
}

async function assertLockReleased(dataFile) {
  await assert.rejects(fsp.stat(`${dataFile}.lock`), (error) => error.code === 'ENOENT');
}

test('交错写入：后写实例合并先写实例的记录', async (t) => {
  const { dataFile, makeStore } = await makeTempFixture(t);
  const storeA = makeStore();
  const storeB = makeStore();
  await storeA.load();
  await storeB.load();

  const createdA = await storeA.create({ title: 'A 的待办' });
  assert.equal(createdA.ok, true);
  assert.equal(createdA.persisted, true);

  // B 的已知磁盘状态里没有 A 的记录：写盘前必须先感知并合并。
  const createdB = await storeB.create({ title: 'B 的待办' });
  assert.equal(createdB.ok, true);
  assert.equal(createdB.persisted, true);

  const expected = [createdA.todo.id, createdB.todo.id].sort();
  const bView = await storeB.list();
  assert.deepEqual(sortedIds(bView.todos), expected);
  assert.ok(
    bView.notices.some((notice) => notice.includes('已合并')),
    `expected a merge notice, got ${JSON.stringify(bView.notices)}`,
  );

  // 磁盘上两边都在（不是 last-write-wins）。
  assert.deepEqual(sortedIds(await readTodos(dataFile)), expected);

  // A 的下一次写入同样应合并 B 的记录。
  const createdA2 = await storeA.create({ title: 'A 的第二条' });
  assert.equal(createdA2.ok, true);
  const aView = await storeA.list();
  assert.deepEqual(
    sortedIds(aView.todos),
    [createdA.todo.id, createdB.todo.id, createdA2.todo.id].sort(),
  );
  assert.deepEqual(
    sortedIds(await readTodos(dataFile)),
    [createdA.todo.id, createdB.todo.id, createdA2.todo.id].sort(),
  );
  await assertLockReleased(dataFile);
});

test('Promise.all 并发写入不损坏 JSON 且不丢记录', async (t) => {
  const { dataFile, makeStore } = await makeTempFixture(t);
  const storeA = makeStore({ lockTimeoutMs: 3000 });
  const storeB = makeStore({ lockTimeoutMs: 3000 });
  await storeA.load();
  await storeB.load();

  const operations = [];
  for (let index = 0; index < 5; index += 1) {
    operations.push(storeA.create({ title: `A-${index}` }));
    operations.push(storeB.create({ title: `B-${index}` }));
  }
  const results = await Promise.all(operations);
  for (const result of results) {
    assert.equal(result.ok, true, result.message);
    assert.equal(result.persisted, true, result.notices);
  }

  const rows = await readTodos(dataFile);
  assert.equal(rows.length, 10);
  assert.equal(new Set(rows.map((row) => row.id)).size, 10);
  const titles = new Set(rows.map((row) => row.title));
  for (let index = 0; index < 5; index += 1) {
    assert.ok(titles.has(`A-${index}`), `missing A-${index}: ${JSON.stringify([...titles])}`);
    assert.ok(titles.has(`B-${index}`), `missing B-${index}: ${JSON.stringify([...titles])}`);
  }
  await assertLockReleased(dataFile);
});

test('陈旧锁文件会被清理并成功写入', async (t) => {
  const { dataFile, makeStore } = await makeTempFixture(t);
  const lockPath = `${dataFile}.lock`;
  const staleAt = new Date(Date.now() - 11_000);
  await fsp.writeFile(lockPath, 'stale lock from a crashed writer\n', 'utf8');
  await fsp.utimes(lockPath, staleAt, staleAt);

  const store = makeStore();
  await store.load();
  const created = await store.create({ title: '清理陈旧锁后的写入' });
  assert.equal(created.ok, true);
  assert.equal(created.persisted, true);

  const rows = await readTodos(dataFile);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, '清理陈旧锁后的写入');
  await assertLockReleased(dataFile);
});

test('同一 id 合并时 updatedAt 较新的记录胜出', async (t) => {
  const { dataFile, makeStore } = await makeTempFixture(t);
  const clockA = { value: Date.parse('2026-01-01T00:00:00.000Z') };
  const clockB = { value: Date.parse('2026-01-01T00:00:00.000Z') };

  const storeA = makeStore({ now: () => clockA.value });
  await storeA.load();
  const created = await storeA.create({ title: '原始标题' });
  const id = created.todo.id;

  const storeB = makeStore({ now: () => clockB.value });
  await storeB.load(); // B 拿到旧快照

  // A 用更新的时钟改标题并写盘。
  clockA.value += 60_000;
  const aUpdated = await storeA.update(id, { title: 'A 的新标题' });
  assert.equal(aUpdated.ok, true);

  // B 的时钟更旧：不能覆盖磁盘上更新的同 id 记录。
  clockB.value += 30_000;
  const bUpdated = await storeB.update(id, { title: 'B 的旧改动' });
  assert.equal(bUpdated.ok, true);
  assert.equal(bUpdated.todo.title, 'A 的新标题');

  const rows = await readTodos(dataFile);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, id);
  assert.equal(rows[0].title, 'A 的新标题');
});

test('本实例删除的 id 不会被其他实例的旧快照合并回来', async (t) => {
  const { dataFile, makeStore } = await makeTempFixture(t);
  const storeA = makeStore();
  await storeA.load();
  const created = await storeA.create({ title: '将被删除' });
  const id = created.todo.id;

  const storeB = makeStore();
  await storeB.load(); // B 持有该条记录的旧快照

  const removed = await storeA.remove(id);
  assert.equal(removed.ok, true);

  // B 用旧快照写回（模拟另一个实例尚未感知这次删除）。
  const bUpdated = await storeB.update(id, { title: 'B 又改了一次' });
  assert.equal(bUpdated.ok, true);
  assert.equal((await readTodos(dataFile)).some((row) => row.id === id), true);

  // A 再写时 tombstone 阻止它回到内存，最终磁盘上也不会复活。
  const fresh = await storeA.create({ title: 'A 的新待办' });
  assert.equal(fresh.ok, true);
  const aView = await storeA.list();
  assert.equal(aView.todos.some((todo) => todo.id === id), false);
  const rows = await readTodos(dataFile);
  assert.equal(rows.some((row) => row.id === id), false);
  assert.equal(rows.length, 1);
});

test('写入前发现磁盘损坏时不崩溃、不合并、也不重复归档', async (t) => {
  const { dir, dataFile, makeStore } = await makeTempFixture(t);
  const store = makeStore();
  await store.load(); // 文件不存在
  await fsp.writeFile(dataFile, '{ 坏掉的 JSON', 'utf8');

  const created = await store.create({ title: '损坏后照常写入' });
  assert.equal(created.ok, true);
  assert.equal(created.persisted, true);

  const rows = await readTodos(dataFile); // 必须可解析，且坏文件没有被合并进来
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, '损坏后照常写入');

  const view = await store.list();
  assert.ok(
    view.notices.some((notice) => notice.includes('未合并')),
    `expected a conservative skip notice, got ${JSON.stringify(view.notices)}`,
  );
  const archives = (await fsp.readdir(dir)).filter((name) => name.includes('.corrupt-'));
  assert.deepEqual(archives, [], 'merge path must not archive the file a second time');
});

test('加载时归档损坏文件只发生一次', async (t) => {
  const { dir, dataFile, makeStore } = await makeTempFixture(t);
  await fsp.writeFile(dataFile, 'not json at all', 'utf8');
  const store = makeStore();
  await store.load();

  const archivePrefix = `${path.basename(dataFile)}.corrupt-`;
  assert.equal((await fsp.readdir(dir)).filter((name) => name.startsWith(archivePrefix)).length, 1);

  const created = await store.create({ title: '重建后的第一条' });
  assert.equal(created.ok, true);
  assert.equal(created.persisted, true);
  assert.equal(
    (await fsp.readdir(dir)).filter((name) => name.startsWith(archivePrefix)).length,
    1,
    'the write path must not archive the already-archived file again',
  );
});

test('锁被占用时写入失败但内存生效，锁释放后下次写入补齐', async (t) => {
  const { dataFile, makeStore } = await makeTempFixture(t);
  const store = makeStore({ lockTimeoutMs: 150 });
  await store.load();
  const lockPath = `${dataFile}.lock`;
  await fsp.writeFile(lockPath, 'held by the test\n', 'utf8');

  const created = await store.create({ title: '拿不到锁的写入' });
  assert.equal(created.ok, true);
  assert.equal(created.persisted, false);
  assert.ok(
    created.notices.some((notice) => notice.includes('写入磁盘失败')),
    `expected a persist-failure notice, got ${JSON.stringify(created.notices)}`,
  );
  assert.equal((await store.list()).stats.total, 1);

  // 锁被释放后，现有语义要求内存中的改动由下一次写入补齐。
  await fsp.rm(lockPath, { force: true });
  const updated = await store.update(created.todo.id, { title: '拿到锁后写入' });
  assert.equal(updated.ok, true);
  assert.equal(updated.persisted, true);

  const rows = await readTodos(dataFile);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, '拿到锁后写入');
  await assertLockReleased(dataFile);
});
