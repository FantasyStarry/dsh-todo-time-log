// Static audit of lib/client.js: i18n parity, forbidden APIs, theme tokens, view wiring.
import { readFileSync } from 'node:fs';

const src = readFileSync('lib/client.js', 'utf8');
const failures = [];
const check = (name, ok, detail) => {
  if (!ok) failures.push({ name, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ' :: ' + JSON.stringify(detail).slice(0, 300)}`);
};

// --- locate and evaluate the I18N object literal -------------------------
const marker = 'const I18N = ';
const start = src.indexOf(marker);
check('I18N object found', start >= 0);
const literalStart = start + marker.length;
let depth = 0;
let inString = null;
let escaped = false;
let end = -1;
for (let i = literalStart; i < src.length; i += 1) {
  const c = src[i];
  if (inString) {
    if (escaped) escaped = false;
    else if (c === '\\') escaped = true;
    else if (c === inString) inString = null;
    continue;
  }
  if (c === "'" || c === '"' || c === '`') inString = c;
  else if (c === '{' || c === '[') depth += 1;
  else if (c === '}' || c === ']') {
    depth -= 1;
    if (depth === 0) {
      end = i + 1;
      break;
    }
  }
}
check('I18N literal terminated', end > 0);
const literal = src.slice(literalStart, end);
const I18N = new Function(`return (${literal});`)();

const languages = Object.keys(I18N);
check('languages are zh+en', languages.length === 2 && languages.includes('zh') && languages.includes('en'), languages);
const zhKeys = Object.keys(I18N.zh);
const enKeys = Object.keys(I18N.en);
check('zh/en key counts equal', zhKeys.length === enKeys.length, { zh: zhKeys.length, en: enKeys.length });
check('no key missing in en', zhKeys.every((k) => k in I18N.en), zhKeys.filter((k) => !(k in I18N.en)));
check('no key missing in zh', enKeys.every((k) => k in I18N.zh), enKeys.filter((k) => !(k in I18N.zh)));

const placeholderDiff = [];
const placeholders = (text) => (String(text).match(/\{[a-zA-Z0-9_]+\}/g) ?? []).sort().join(',');
for (const key of zhKeys) {
  if (placeholders(I18N.zh[key]) !== placeholders(I18N.en[key])) {
    placeholderDiff.push({ key, zh: placeholders(I18N.zh[key]), en: placeholders(I18N.en[key]) });
  }
}
check('placeholders match between languages', placeholderDiff.length === 0, placeholderDiff);

// Keys are referenced both as t('key') literals and as data (`labelKey: 'key'`
// resolved through t(option.labelKey)), so "used" means the literal appears
// anywhere outside the I18N dictionary itself.
const usageSource = src.slice(0, literalStart) + src.slice(end);
const literalCalls = new Set([...src.matchAll(/\bt\(\s*'([^']+)'/g)].map((m) => m[1]));
const undeclared = [...literalCalls].filter((k) => !(k in I18N.zh));
const unused = zhKeys.filter((k) => !usageSource.includes(`'${k}'`) && !usageSource.includes(`"${k}"`));
check('no undeclared key used', undeclared.length === 0, undeclared);
check('no unused declared key', unused.length === 0, unused);

// --- forbidden / required API surface -----------------------------------
check("only require('react')", [...src.matchAll(/require\(([^)]*)\)/g)].every((m) => m[1].trim() === "'react'"));
// One documented exception: the @ menu source may read the active composer text to
// decide whether it belongs to a `/todo` command line. It must be a read-only
// `document.activeElement` lookup, confined to a single helper, with no writes.
const documentAccesses = [...src.matchAll(/\bdocument\./g)];
check(
  'only the documented read-only document access',
  documentAccesses.length === 1
    && /document\.activeElement/.test(src)
    && !/document\.(?!activeElement)/.test(src),
  documentAccesses.length,
);
check('single composer draft reader', (src.match(/document\.activeElement/g) ?? []).length === 1);
check('no direct DOM query', !/querySelectorAll|getElementById|appendChild|innerHTML|setAttribute/.test(src));
check('no DOM writes', !/\.(?:textContent|innerText)\s*=[^=]/.test(src));
check('no hardcoded hex colors', !/#[0-9a-fA-F]{3,8}\b/.test(src));
check('no rgb()/hsl() colors', !/\brgba?\(|\bhsla?\(/.test(src));

const tokens = [...new Set([...src.matchAll(/var\((--dsw-alias-[a-z0-9-]+)\)/g)].map((m) => m[1]))];
check('uses theme alias tokens', tokens.length >= 18, tokens.length);
const classNames = [...new Set([...src.matchAll(/className:\s*'([^']+)'/g)].flatMap((m) => m[1].split(/\s+/)))];
const badClass = classNames.filter((name) => name !== '' && !name.startsWith('ttl-'));
check('all class names use ttl- prefix', badClass.length === 0, badClass.slice(0, 10));

// --- four views present --------------------------------------------------
for (const view of ['table', 'board', 'gantt', 'calendar']) {
  check(`view "${view}" wired`, new RegExp(`'${view}'`).test(src));
}
check(
  'renderers defined',
  /const renderTableView\s*=/.test(src)
    && /const pushTableRow\s*=/.test(src)
    && /const renderBoardView\s*=/.test(src)
    && /const renderCalendarView\s*=/.test(src)
    && /function boardColumns\(/.test(src)
    && /function buildCalendarCells\(/.test(src)
    && /function GanttView\(/.test(src),
);
check('calendar uses a 6x7 grid', /42/.test(src) && /function buildCalendarCells|const buildCalendarCells/.test(src));

// module format + slot registration
check('module loader wrapper', /window\.__ModuleLoader__\.load\(\{/.test(src));
check("factory declares id 'dsh-todo-time-log'", /id:\s*'dsh-todo-time-log'/.test(src));
check('registers main slot', /slots\.inject\('main'/.test(src));
check('registers sidebar.panellist slot', /slots\.inject\('sidebar\.panellist'/.test(src));

console.log(`\ni18n keys per language: ${zhKeys.length}; alias tokens: ${tokens.length}; class names: ${classNames.length}`);
if (failures.length > 0) {
  console.error(`\n${failures.length} audit failure(s)`);
  process.exit(1);
}
console.log('\nclient.js static audit: all checks passed');
