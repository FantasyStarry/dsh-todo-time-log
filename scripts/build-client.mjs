/**
 * 构建浏览器单文件产物 lib/client.js。
 *
 * 源码位于 src/client/（ES 模块），这里用 esbuild 打包回 Harness Web
 * 模块加载器要求的单文件形态：
 *
 *   window.__ModuleLoader__.load({ id: 'dsh-todo-time-log', factory(require) { ... } })
 *
 * 关键约束：
 * - format: iife —— 产物仍是一个可直接 <script> 执行的脚本；
 * - bundle: true —— 把 src/client/ 的模块内联成一个文件；
 * - platform: browser + external 不打包 react —— react 由 factory 的 require 注入；
 * - charset: utf8 —— 中文文案保持原样，不转义成 \uXXXX；
 * - minify: false —— 保持可读，便于排障与静态审计（test/client-audit.mjs）。
 *
 * 用法：node scripts/build-client.mjs（或 npm run build）
 */
import { build } from 'esbuild';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

const outfile = 'lib/client.js';

await build({
  entryPoints: ['src/client/index.js'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  charset: 'utf8',
  outfile,
  minify: false,
  legalComments: 'none',
  banner: {
    js: '/*! dsh-todo-time-log 客户端产物：由 npm run build 从 src/client/ 打包生成，请勿直接编辑。 */',
  },
  logLevel: 'warning',
});

const { size } = statSync(outfile);
const lines = readFileSync(outfile, 'utf8').split('\n').length;
console.log(`built ${outfile}: ${size} bytes (${(size / 1024).toFixed(1)} KiB, ${lines} lines)`);
