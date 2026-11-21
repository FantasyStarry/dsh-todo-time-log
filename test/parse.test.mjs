/**
 * Unit tests for the natural-language quick-add parser (lib/parse.js) and the
 * project/file derivation rules in lib/store.js.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { parseQuickAdd, parseQuickAddLine, normalizeFilePath, looksLikeFilePath, stripFillers, hasQuickAddMarkers, hasPriorityMarker, hasTypeMarker, hasEstimateMarker } from '../lib/parse.js';
import { deriveProjectFromFiles, validateFiles } from '../lib/store.js';

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

const parse1 = parseQuickAddLine('新任务 写周报 #工作 @src/auth/login.ts');
check('filler 新任务 stripped', parse1.title === '写周报', parse1);
check('hash project', parse1.project === '工作', parse1.project);
check('file reference', parse1.files.length === 1 && parse1.files[0] === 'src/auth/login.ts', parse1.files);

const parse2 = parseQuickAddLine('帮我记一下 买牛奶 @生活');
check('filler 帮我记一下 stripped', parse2.title === '买牛奶', parse2.title);
check('at project when not a file', parse2.project === '生活' && parse2.files.length === 0, parse2);

const quoted = parseQuickAddLine('@"docs/My File.md" 写说明 #文档');
check('quoted path with spaces', quoted.files[0] === 'docs/My File.md', quoted);
check('quoted path title/project', quoted.title === '写说明' && quoted.project === '文档', quoted);

const multi = parseQuickAdd('写周报 #工作；买牛奶 @生活\n回邮件 [工作] @src/mail/inbox.ts');
check('multi items', multi.items.length === 3, multi.items);
check('multi projects', multi.items.map((item) => item.project).join('|') === '工作|生活|工作', multi.items);
check('multi files', multi.items[2].files[0] === 'src/mail/inbox.ts', multi.items[2]);

const known = new Set(['README.md', 'src/a.ts']);
const bare = parseQuickAddLine('@README.md 更新文档', { knownFiles: known });
check('bare known file recognised', bare.files.length === 1 && bare.files[0] === 'README.md', bare);
check('bare file title cleaned', bare.title === '更新文档', bare.title);

const bareKnown = parseQuickAddLine('写周报 #工作 lib/store.js', { knownFiles: new Set([...known, 'lib/store.js']) });
check('bare known path becomes file ref', bareKnown.files[0] === 'lib/store.js', bareKnown);
check('bare path title cleaned', bareKnown.title === '写周报' && bareKnown.project === '工作', bareKnown);

const bareWord = parseQuickAddLine('普通标题 lib 不是文件', { knownFiles: known });
check('ordinary words are not file refs', bareWord.files.length === 0 && bareWord.title === '普通标题 lib 不是文件', bareWord);

const ext = parseQuickAddLine('@package.json 改依赖');
check('extension heuristic recognises file', ext.files[0] === 'package.json', ext);

const explicitProject = parseQuickAddLine('项目：学习 整理笔记');
check('explicit project form', explicitProject.project === '学习' && explicitProject.title === '整理笔记', explicitProject);

const bracketed = parseQuickAddLine('[] 空分类测试');
check('empty bracket removed without project', bracketed.project === '' && bracketed.title === '空分类测试', bracketed);

const multiMarkers = parseQuickAddLine('买牛奶 @生活 @工作 [杂事]');
check('all markers stripped, first project wins', multiMarkers.project === '生活' && multiMarkers.title === '买牛奶', multiMarkers);

const onlyFiller = parseQuickAdd('帮我记一下');
check('filler-only input yields no items', onlyFiller.items.length === 0 && onlyFiller.skipped[0].reason === 'NO_CONTENT', onlyFiller);

const empties = parseQuickAdd('\n\n；;');
check('blank input yields nothing', empties.items.length === 0 && empties.skipped.length === 0, empties);

const punctuation = parseQuickAddLine('，写周报。');
check('edge punctuation trimmed', punctuation.title === '写周报', punctuation.title);

check('stripFillers repeated', stripFillers('帮我 新增 待办： 写文档') === '写文档', stripFillers('帮我 新增 待办： 写文档'));
check('looksLikeFilePath slash', looksLikeFilePath('src/a.ts', null) === true);
check('looksLikeFilePath extension', looksLikeFilePath('a.ts', null) === true);
check('looksLikeFilePath plain word', looksLikeFilePath('工作', null) === false);
check('normalizeFilePath posix', normalizeFilePath('src//a.ts') === 'src/a.ts');
check('normalizeFilePath windows separators', normalizeFilePath('src\\\\a.ts') === 'src/a.ts');
check('normalizeFilePath rejects traversal', normalizeFilePath('../a.ts') === '');
check('normalizeFilePath rejects absolute', normalizeFilePath('/a.ts') === '');
check('normalizeFilePath rejects drive-relative', normalizeFilePath('C:') === '');

check('derive project from nested file', deriveProjectFromFiles(['src/auth/login.ts']) === 'src/auth');
check('derive project from root file', deriveProjectFromFiles(['README.md']) === 'README.md');
check('derive project empty', deriveProjectFromFiles([]) === '');
check(
  'derive project long directory falls back to last segment',
  deriveProjectFromFiles(['packages/some-really-long-project-name/src/deep/nested/file.ts']).length <= 40,
  deriveProjectFromFiles(['packages/some-really-long-project-name/src/deep/nested/file.ts']),
);

const validFiles = validateFiles(['src/a.ts', 'src//b.ts', './src/c.ts', 'src/a.ts']);
check('validateFiles normalizes and dedupes', validFiles.ok && validFiles.files.join('|') === 'src/a.ts|src/b.ts|src/c.ts', validFiles);
check('validateFiles rejects absolute', validateFiles(['/etc/passwd']).ok === false);
check('validateFiles rejects traversal', validateFiles(['../x']).ok === false);
check('validateFiles rejects non-array', validateFiles('src/a.ts').ok === false);
check('validateFiles allows undefined', validateFiles(undefined).ok === true && validateFiles(undefined).files.length === 0);
check('validateFiles caps at 20', validateFiles(Array.from({ length: 21 }, (_, i) => `f${i}.ts`)).ok === false);

check('hasQuickAddMarkers #category', hasQuickAddMarkers('写周报 #工作') === true);
check('hasQuickAddMarkers @file', hasQuickAddMarkers('@lib/a.ts 写文档') === true);
check('hasQuickAddMarkers bracket', hasQuickAddMarkers('[工作] 回邮件') === true);
check('hasQuickAddMarkers project colon', hasQuickAddMarkers('项目：工作 写周报') === true);
check('hasQuickAddMarkers semicolon', hasQuickAddMarkers('买牛奶；回邮件') === true);
check('hasQuickAddMarkers plain title', hasQuickAddMarkers('普通标题') === false);
check('hasQuickAddMarkers C#学习 is not a marker', hasQuickAddMarkers('C#学习') === false);
check('hasQuickAddMarkers non-string', hasQuickAddMarkers(undefined) === false);

// priority markers: !high / !medium / !low, aliases !h / !m / !l, Chinese !高 / !中 / !低
check('parse without marker has empty priority', parse1.priority === '', parse1);
const priorityAliases = ['!h', '!high', '!高', '!m', '!medium', '!中', '!l', '!low', '!低'];
const parsedAliases = priorityAliases.map((marker) => parseQuickAddLine(`写周报 ${marker}`));
check(
  'priority aliases normalized',
  parsedAliases.map((parsed) => parsed.priority).join('|') === 'high|high|high|medium|medium|medium|low|low|low',
  parsedAliases.map((parsed) => parsed.priority),
);
check('priority markers stripped from titles', parsedAliases.every((parsed) => parsed.title === '写周报'), parsedAliases.map((parsed) => parsed.title));
const priorityFirst = parseQuickAddLine('!high 修登录 bug #工作');
check(
  'leading priority marker parsed and stripped',
  priorityFirst.priority === 'high' && priorityFirst.title === '修登录 bug' && priorityFirst.project === '工作',
  priorityFirst,
);
const priorityLeftmost = parseQuickAddLine('!low 写周报 !high');
check('leftmost priority marker wins', priorityLeftmost.priority === 'low' && priorityLeftmost.title === '写周报', priorityLeftmost);
const priorityMulti = parseQuickAdd('写周报 !high；买牛奶 !low\n回邮件 !中');
check(
  'priority parsed per quick-add item',
  priorityMulti.items.map((item) => item.priority).join('|') === 'high|low|medium',
  priorityMulti.items,
);
const priorityWithFile = parseQuickAddLine('@src/a.ts 写文档 !medium');
check(
  'priority coexists with file and title',
  priorityWithFile.priority === 'medium' && priorityWithFile.files[0] === 'src/a.ts' && priorityWithFile.title === '写文档',
  priorityWithFile,
);
check('hasPriorityMarker true', hasPriorityMarker('写周报 !high') === true);
check('hasPriorityMarker false for plain text', hasPriorityMarker('普通标题') === false);
check('!important is not a priority marker', hasPriorityMarker('!important 上线检查') === false);
check('!important keeps priority empty', parseQuickAddLine('!important 上线检查').priority === '');
check('hasQuickAddMarkers recognises priority marker', hasQuickAddMarkers('写周报 !high') === true);

// type markers: ^bug / ^feature / ^improvement / ^question / ^chore / ^other,
// Chinese ^缺陷/^新功能/^改进/^疑问/^杂项/^其他, and 类型：bug / type:bug
const TYPE_NAMES = ['bug', 'feature', 'improvement', 'question', 'chore', 'other'];
check('parse without marker has empty type', parse1.type === '', parse1);
const parsedTypes = TYPE_NAMES.map((name) => parseQuickAddLine(`写周报 ^${name}`));
check(
  'type markers parsed',
  parsedTypes.map((parsed) => parsed.type).join('|') === TYPE_NAMES.join('|'),
  parsedTypes.map((parsed) => parsed.type),
);
check('type markers stripped from titles', parsedTypes.every((parsed) => parsed.title === '写周报'), parsedTypes.map((parsed) => parsed.title));
const parsedChineseTypes = ['^缺陷', '^新功能', '^改进', '^疑问', '^杂项', '^其他']
  .map((marker) => parseQuickAddLine(`写周报 ${marker}`));
check(
  'Chinese type aliases normalized',
  parsedChineseTypes.map((parsed) => parsed.type).join('|') === TYPE_NAMES.join('|'),
  parsedChineseTypes.map((parsed) => parsed.type),
);
const parsedExplicitTypes = ['类型：bug', 'type:bug', '类型: 新功能', 'type: improvement']
  .map((marker) => parseQuickAddLine(`写周报 ${marker}`));
check(
  'explicit type forms parsed',
  parsedExplicitTypes.map((parsed) => parsed.type).join('|') === 'bug|bug|feature|improvement',
  parsedExplicitTypes.map((parsed) => parsed.type),
);
check('explicit type forms stripped from titles', parsedExplicitTypes.every((parsed) => parsed.title === '写周报'), parsedExplicitTypes.map((parsed) => parsed.title));
const leadingType = parseQuickAddLine('^bug 修复登录 #工作');
check(
  'leading type marker parsed and stripped',
  leadingType.type === 'bug' && leadingType.title === '修复登录' && leadingType.project === '工作',
  leadingType,
);
const leftmostType = parseQuickAddLine('^chore 写周报 ^bug');
check('leftmost type marker wins', leftmostType.type === 'chore' && leftmostType.title === '写周报', leftmostType);
const unknownCaretType = parseQuickAddLine('^foo 写周报');
check(
  'unknown ^value is not a type marker and stays in the title',
  unknownCaretType.type === '' && unknownCaretType.title === '^foo 写周报',
  unknownCaretType,
);
const unknownExplicitType = parseQuickAddLine('类型：epic 写周报');
check(
  'unknown explicit type value stays in the title',
  unknownExplicitType.type === '' && unknownExplicitType.title === '类型：epic 写周报',
  unknownExplicitType,
);
const multiType = parseQuickAdd('修复登录 ^bug；加缓存 ^feature\n问个问题 ^question');
check(
  'type parsed per quick-add item',
  multiType.items.map((item) => item.type).join('|') === 'bug|feature|question',
  multiType.items,
);
const combinedMarkers = parseQuickAddLine('修复登录 !high ^bug #工作 @src/auth/login.ts');
check(
  'type coexists with priority, project and files',
  combinedMarkers.type === 'bug' && combinedMarkers.priority === 'high'
    && combinedMarkers.project === '工作' && combinedMarkers.files[0] === 'src/auth/login.ts'
    && combinedMarkers.title === '修复登录',
  combinedMarkers,
);
check('hasTypeMarker true', hasTypeMarker('写周报 ^bug') === true);
check('hasTypeMarker false for plain text', hasTypeMarker('普通标题') === false);
check('hasTypeMarker false for unknown ^value', hasTypeMarker('^foo 写周报') === false);
check('hasTypeMarker false for prototype:bug', hasTypeMarker('prototype:bug 修复') === false);
check('^buggy is not a type marker', hasTypeMarker('^buggy 任务') === false);
check('hasQuickAddMarkers recognises type marker', hasQuickAddMarkers('写周报 ^bug') === true);

// estimate markers (v6): ~30m / ~2h / 预计：2小时 …
check('parse without estimate marker is null', parse1.estimateMinutes === null, parse1);
const estimateTilde = ['~30m', '~30分', '~30分钟', '~90min', '~2h', '~2时', '~2小时']
  .map((marker) => parseQuickAddLine(`写周报 ${marker}`));
check(
  'tilde estimate markers parsed',
  estimateTilde.map((parsed) => parsed.estimateMinutes).join('|') === '30|30|30|90|120|120|120',
  estimateTilde.map((parsed) => parsed.estimateMinutes),
);
check(
  'tilde estimate markers stripped from titles',
  estimateTilde.every((parsed) => parsed.title === '写周报'),
  estimateTilde.map((parsed) => parsed.title),
);
const estimateDecimal = parseQuickAddLine('写周报 ~1.5h');
check(
  'decimal hour estimate rounds to whole minutes',
  estimateDecimal.estimateMinutes === 90 && estimateDecimal.title === '写周报',
  estimateDecimal,
);
const estimateExplicit = ['预计30分', '预计：2小时', '预计用时 45 分钟', '预计: 30 分钟']
  .map((marker) => parseQuickAddLine(`写周报 ${marker}`));
check(
  'explicit estimate forms parsed',
  estimateExplicit.map((parsed) => parsed.estimateMinutes).join('|') === '30|120|45|30',
  estimateExplicit.map((parsed) => parsed.estimateMinutes),
);
check(
  'explicit estimate forms stripped from titles',
  estimateExplicit.every((parsed) => parsed.title === '写周报'),
  estimateExplicit.map((parsed) => parsed.title),
);
const estimateLimited = parseQuickAddLine('写周报 ~1440m');
check('estimate upper bound accepted', estimateLimited.estimateMinutes === 1440, estimateLimited);
const estimateTooLong = parseQuickAddLine('写周报 ~1441m');
check(
  'out-of-range estimate is not a marker and stays in the title',
  estimateTooLong.estimateMinutes === null && estimateTooLong.title === '写周报 ~1441m',
  estimateTooLong,
);
const estimateZero = parseQuickAddLine('写周报 ~0m');
check(
  'zero estimate is not a marker and stays in the title',
  estimateZero.estimateMinutes === null && estimateZero.title === '写周报 ~0m',
  estimateZero,
);
const estimateLeftmost = parseQuickAddLine('~30m 写周报 ~2h');
check(
  'leftmost estimate marker wins',
  estimateLeftmost.estimateMinutes === 30 && estimateLeftmost.title === '写周报',
  estimateLeftmost,
);
const estimateMulti = parseQuickAdd('写周报 ~30m；买牛奶 ~1h\n回邮件 预计：45分钟');
check(
  'estimate parsed per quick-add item',
  estimateMulti.items.map((item) => item.estimateMinutes).join('|') === '30|60|45',
  estimateMulti.items,
);
const estimateWithEverything = parseQuickAddLine('修复登录 ~45m !high ^bug #工作 @src/auth/login.ts');
check(
  'estimate coexists with priority, type, project and files',
  estimateWithEverything.estimateMinutes === 45
    && estimateWithEverything.priority === 'high'
    && estimateWithEverything.type === 'bug'
    && estimateWithEverything.project === '工作'
    && estimateWithEverything.files[0] === 'src/auth/login.ts'
    && estimateWithEverything.title === '修复登录',
  estimateWithEverything,
);
check('预计 without a number+unit is not a marker', hasEstimateMarker('预计下周上线') === false);
check('预计下周上线 keeps the whole title', parseQuickAddLine('预计下周上线').title === '预计下周上线');
check('~abc is not an estimate marker', hasEstimateMarker('写周报 ~abc') === false);
check('hasEstimateMarker true', hasEstimateMarker('写周报 ~30m') === true);
check('hasEstimateMarker true for explicit form', hasEstimateMarker('写周报 预计：2小时') === true);
check('hasEstimateMarker false for out-of-range value', hasEstimateMarker('写周报 ~1441m') === false);
check('hasQuickAddMarkers recognises estimate marker', hasQuickAddMarkers('写周报 ~30m') === true);
check('hasQuickAddMarkers ignores out-of-range estimate', hasQuickAddMarkers('写周报 ~1441m') === false);

test('预计用时：显式「预计」形态需要前边界，不静默改写普通标题', () => {
  // 「上周预计30分」里的「预计30分」不是标记：没有前边界就该整句留在标题里。
  // 回归：加边界前会被解析成标题「上周」+ 30 分钟，普通标题被吃掉。
  for (const line of ['上周预计30分', '需要预计30分钟', 'A预计30分']) {
    const parsed = parseQuickAddLine(line);
    assert.equal(parsed.estimateMinutes, null, `${line} 不应产生预计用时`);
    assert.equal(parsed.title, line, `${line} 的标题应原样保留`);
  }
  // 有边界时正常识别
  assert.equal(parseQuickAddLine('写周报 预计30分').estimateMinutes, 30);
  assert.equal(parseQuickAddLine('写周报 预计30分').title, '写周报');
  assert.equal(parseQuickAddLine('写周报 预计：2小时').estimateMinutes, 120);
  assert.equal(parseQuickAddLine('写周报 预计用时 45 分钟').estimateMinutes, 45);
});

test('标记剥离按偏移：同一标记文本出现两次时不留残余', () => {
  // 回归：原先用 String.replace(text, ' ') 只替换第一次出现的子串，
  // 命中位置错位导致有效标记残留在标题里。四种标记共用同一条剥离路径。
  // 「~30m中」不是有效标记（后面紧跟汉字，没有 token 边界），应作为标题文本保留；
  // 真正要断言的是此后那个「~30m」被按偏移正确剥离，而不是把前一个删掉。
  const estimate = parseQuickAddLine('写周报 ~30m中 复盘 ~30m');
  assert.equal(estimate.estimateMinutes, 30);
  assert.equal(estimate.title, '写周报 ~30m中 复盘', `有效标记应被剥离、非标记应保留：${estimate.title}`);

  const priority = parseQuickAddLine('写周报 !highx 复盘 !high');
  assert.equal(priority.priority, 'high');
  assert.equal(priority.title, '写周报 !highx 复盘', `非标记应保留：${priority.title}`);

  const type = parseQuickAddLine('修 bug ^bugx 再 ^bug 复盘');
  assert.equal(type.type, 'bug');
  assert.equal(type.title, '修 bug ^bugx 再 复盘', `非标记应保留：${type.title}`);

  // 两个都是有效标记时，两处都该剥离，且取最左的值
  assert.equal(parseQuickAddLine('写周报 ~2h 复盘 ~30m').title, '写周报 复盘');
  assert.equal(parseQuickAddLine('写周报 !high 复盘 !low').title, '写周报 复盘');
  assert.equal(parseQuickAddLine('修 bug ^bug 再 ^feature 复盘').title, '修 bug 再 复盘');
});
