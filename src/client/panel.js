/** 面板主体 TodoPanel + 错误边界 + main 槽组件工厂。 */
import { createDetailContent } from './detail.js';
import { TIME_FORMAT, dateKeyOf, extractNotices, fileCacheKey, findAtToken, findHashToken, formatClock, formatFileReference, formatProjectTag, hasTagMarkup, isRecord, messageOf, normalizeChatErrors, normalizeChatSkipped, normalizeFileSuggestions, normalizeFiles, normalizePriority, normalizeProject, normalizeProjectInput, normalizeProjectSuggestions, normalizeProjects, normalizeSearch, normalizeStats, normalizeTitleInput, normalizeTodo, normalizeTodos, normalizeType, normalizeWorkspaces, notifyText, projectCacheKey, projectLabel, pruneIdMap, request, todoMatchesSearch } from './helpers.js';
import { t } from './i18n.js';
import { React, h } from './runtime.js';
import { BOARD_DENSITIES, BOARD_GROUPS, CALENDAR_BASES, FILTERS, GANTT_RANGES, PRIORITIES, PROJECT_FILTER_ALL, StyleSheet, TYPES, TYPE_FILTER_ALL, VIEWS, queryForView } from './styles.js';
import { createBoardView } from './views/board.js';
import { createCalendarView } from './views/calendar.js';
import { renderGanttView } from './views/gantt.js';
import { createTableView } from './views/table.js';
import { TransferDialog, makeDownload, readFileText } from './transfer.js';
import { ChatPanel, CheckButton, ErrorPlaceholder, FileChip, LoadingPlaceholder, ProjectPicker, SuggestionDropdown, TextPlaceholder, ToastIcon } from './widgets.js';

export /** 面板主体。所有请求与交互状态都在这里，接口异常不会抛到槽位。 */
function TodoPanel() {
  const [todos, setTodos] = React.useState([]);
  const [stats, setStats] = React.useState({ total: 0, pending: 0, completed: 0 });
  const [timeFormat, setTimeFormat] = React.useState(TIME_FORMAT);
  const [listStatus, setListStatus] = React.useState('loading');
  const [listError, setListError] = React.useState('');
  const [refreshing, setRefreshing] = React.useState(false);
  const [filter, setFilter] = React.useState('all');
  const [sortBy, setSortBy] = React.useState('createdAt');
  const [direction, setDirection] = React.useState('desc');
  const [newTitle, setNewTitle] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [busyId, setBusyId] = React.useState(null);
  const [editingId, setEditingId] = React.useState(null);
  const [editTitle, setEditTitle] = React.useState('');
  const [confirmId, setConfirmId] = React.useState(null);
  const [notice, setNotice] = React.useState(null);
  // 九期：导入 / 导出。对话框内先预览、确认后才写入；导入前 Host 会自动备份。
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [transferBusy, setTransferBusy] = React.useState(false);
  const [transferApplying, setTransferApplying] = React.useState(false);
  const [transferError, setTransferError] = React.useState('');
  const [transferFileName, setTransferFileName] = React.useState('');
  const [transferContent, setTransferContent] = React.useState('');
  const [transferMode, setTransferMode] = React.useState('merge');
  const [transferPreview, setTransferPreview] = React.useState(null);
  const [download, setDownload] = React.useState({ url: '', name: '' });
  // 展开的详情按 todo.id 记录；列表刷新时只保留仍存在的 id。
  const [expandedIds, setExpandedIds] = React.useState({});
  // 二期：视图 / 范围 / 分类筛选 / 分类列表 / 新建与编辑的分类输入 / 对话录入。
  const [view, setView] = React.useState('table');
  const [range, setRange] = React.useState('all');
  const [projectFilter, setProjectFilter] = React.useState(null);
  const [projects, setProjects] = React.useState([]);
  const [newProject, setNewProject] = React.useState('');
  const [editingProject, setEditingProject] = React.useState('');
  const [newPriority, setNewPriority] = React.useState('');
  const [editingPriority, setEditingPriority] = React.useState('');
  const [newType, setNewType] = React.useState('');
  const [editingType, setEditingType] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState(null);
  const [chatOpen, setChatOpen] = React.useState(false);
  const [chatInput, setChatInput] = React.useState('');
  const [chatBusy, setChatBusy] = React.useState(false);
  const [messages, setMessages] = React.useState(() => [{ id: 0, role: 'assistant', welcome: true }]);
  // 三期：看板分组方式 / 日历落格依据、当前月与选中日。
  const [boardGroupBy, setBoardGroupBy] = React.useState('status');
  // 六期：看板卡片「更多操作」展开项、已完成列收纳、工具栏搜索。
  const [boardActionsId, setBoardActionsId] = React.useState(null);
  // 表格行「⋯」菜单：同一时间只展开一行；确认删除也在这个菜单里完成。
  const [tableActionsId, setTableActionsId] = React.useState(null);
  const [boardShowAllCompleted, setBoardShowAllCompleted] = React.useState(false);
  const [search, setSearch] = React.useState('');
  // 七期：泳道折叠（键 = 列 key + 泳道 project）、密度、搜索框 ref（面板内快捷键）。
  const [boardLaneCollapsed, setBoardLaneCollapsed] = React.useState({});
  const [density, setDensity] = React.useState('comfortable');
  const searchRef = React.useRef(null);
  // 看板卡片上的「已进行 X」需要随时间推进；每 60s 刷新一次「现在」。
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const [calendarBasis, setCalendarBasis] = React.useState('createdAt');
  const [calendarYear, setCalendarYear] = React.useState(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = React.useState(() => new Date().getMonth());
  const [calendarSelectedDay, setCalendarSelectedDay] = React.useState(null);
  // 甘特图行内详情展开状态（与表格的 expandedIds 相互独立）。
  const [ganttExpandedIds, setGanttExpandedIds] = React.useState({});
  // 甘特图分类分组的折叠状态：key 用 project（'' 表示未分类），跨视图切换保留。
  const [ganttCollapsedProjects, setGanttCollapsedProjects] = React.useState({});
  // 四期：对话输入的 @ 文件补全状态（quick-add 由 Host 解析，本地不再解析文本）。
  const [fileSuggestions, setFileSuggestions] = React.useState([]);
  const [suggestOpen, setSuggestOpen] = React.useState(false);
  const [suggestLoading, setSuggestLoading] = React.useState(false);
  const [suggestError, setSuggestError] = React.useState(false);
  const [suggestActive, setSuggestActive] = React.useState(0);
  // 四期：对话录入使用的工作区（来自 /workspaces，失败时不传、用 Host 默认）。
  const [workspaces, setWorkspaces] = React.useState([]);
  const [workspace, setWorkspace] = React.useState('');
  // 五期：分类建议（/projects）与选择器的自定义模式、# 补全类型。
  const [projectSuggestions, setProjectSuggestions] = React.useState([]);
  const [newProjectCustom, setNewProjectCustom] = React.useState(false);
  const [editingProjectCustom, setEditingProjectCustom] = React.useState(false);
  const [suggestKind, setSuggestKind] = React.useState('file');
  /** 补全下拉当前服务的输入框：'chat' 对话面板 / 'create' 顶部新建框。 */
  const [suggestTarget, setSuggestTarget] = React.useState(null);

  const requestSeq = React.useRef(0);
  const mountedRef = React.useRef(true);
  const noticeSeq = React.useRef(0);
  const createInputRef = React.useRef(null);
  // 操作结束后的刷新必须读取「最新」筛选条件，而不是点击时闭包里的旧值。
  const filterRef = React.useRef(filter);
  const sortByRef = React.useRef(sortBy);
  const directionRef = React.useRef(direction);
  const viewRef = React.useRef(view);
  const projectFilterRef = React.useRef(projectFilter);
  const messageSeq = React.useRef(1);
  const filesCacheRef = React.useRef(new Map());
  const suggestSeqRef = React.useRef(0);
  const suggestTimerRef = React.useRef(null);
  const suggestTokenRef = React.useRef(null);
  const workspaceRef = React.useRef('');
  const projectCacheRef = React.useRef(new Map());
  const projectSeqRef = React.useRef(0);
  const suggestKindRef = React.useRef('file');
  const createBlurTimerRef = React.useRef(null);
  const transferInputRef = React.useRef(null);
  const downloadRef = React.useRef(null);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestSeq.current += 1;
    };
  }, []);

  /**
   * 瞬时提示（toast 浮层）：不占文档流，出现与消失都不会改变页面高度。
   * undo 可选，例如「完成」后的「撤销」。
   */
  const showNotice = React.useCallback((kind, text, undo) => {
    if (typeof text !== 'string' || text === '') return;
    const action = undo && typeof undo.onClick === 'function' ? { onClick: undo.onClick } : null;
    noticeSeq.current += 1;
    setNotice({ kind, text, id: noticeSeq.current, undo: action });
  }, []);

  const dismissNotice = React.useCallback(() => {
    setNotice(null);
  }, []);

  // toast 自动消失；用 id 防止旧定时器清掉新提示。带「撤销」时保留更久。
  React.useEffect(() => {
    if (notice === null) return undefined;
    const base = notice.kind === 'error' ? 6000 : 3500;
    const delay = notice.undo !== null && notice.undo !== undefined ? Math.max(base, 6000) : base;
    const timer = setTimeout(() => {
      setNotice((current) => (current !== null && current.id === notice.id ? null : current));
    }, delay);
    return () => clearTimeout(timer);
  }, [notice]);

  /**
   * 触发下载：隐藏的 <a download> 由 ref 点击，不在代码里直接操作 document。
   * 创建 blob URL 后延迟回收，避免浏览器还没开始读取就被 revoke。
   */
  React.useEffect(() => {
    if (download.url === '' || downloadRef.current === null) return undefined;
    downloadRef.current.click();
    const url = download.url;
    const timer = setTimeout(() => {
      try {
        if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
          URL.revokeObjectURL(url);
        }
      } catch {
        /* best effort */
      }
      if (mountedRef.current) setDownload({ url: '', name: '' });
    }, 2000);
    return () => clearTimeout(timer);
  }, [download]);

  /**
   * 拉取列表。seq 保证只有最后一次请求能写状态；quiet 用于操作后的静默刷新。
   */
  const loadList = React.useCallback(
    async (nextFilter, nextSortBy, nextDirection, nextProject, options) => {
      const quiet = Boolean(options && options.quiet);
      requestSeq.current += 1;
      const seq = requestSeq.current;
      if (mountedRef.current) {
        setRefreshing(true);
        setListError('');
        if (!quiet) setListStatus('loading');
      }
      try {
        const body = {
          filter: nextFilter,
          sortBy: nextSortBy,
          direction: nextDirection,
        };
        // 省略 = 全部分类；'' = 只看未分类（契约见 Host /list）。
        if (nextProject !== null && nextProject !== undefined) body.project = nextProject;
        const value = await request('/list', body);
        if (!mountedRef.current || seq !== requestSeq.current) return;
        const nextTodos = normalizeTodos(value && value.todos);
        setTodos(nextTodos);
        // 刷新后展开状态只保留仍出现在列表里的 id（已删除的条目自动丢弃）。
        setExpandedIds((current) => pruneIdMap(current, nextTodos));
        setGanttExpandedIds((current) => pruneIdMap(current, nextTodos));
        setStats(normalizeStats(value && value.stats, nextTodos));
        const nextProjects = normalizeProjects(value && value.projects, nextTodos);
        setProjects(nextProjects);
        // 当前筛选的分类已被删除/改名时回退到全部分类（会触发一次重新拉取）。
        const activeProject = projectFilterRef.current;
        if (
          activeProject !== null &&
          activeProject !== '' &&
          !nextProjects.some((item) => item.name === activeProject)
        ) {
          setProjectFilter(null);
        }
        if (value && typeof value.timeFormat === 'string' && value.timeFormat !== '') {
          setTimeFormat(value.timeFormat);
        }
        setListStatus('ready');
        setListError('');
        // 数据修复提示（创建时间缺失/完成时间早于创建时间等）与 create/complete
        // 共用同一个提示条状态；加载失败走 catch 分支的错误提示，两者不会混合。
        const repairNotices = extractNotices(value);
        if (repairNotices !== '') showNotice('info', repairNotices);
      } catch (error) {
        if (!mountedRef.current || seq !== requestSeq.current) return;
        const message = messageOf(error);
        setListStatus('error');
        setListError(message);
        showNotice('error', message);
      } finally {
        if (mountedRef.current && seq === requestSeq.current) setRefreshing(false);
      }
    },
    [showNotice]
  );

  // 视图 / 筛选 / 排序 / 分类变化时重新拉取；首次挂载也走这里。
  // 表格用工具栏状态；甘特/日历取全量（分类筛选仍透传），在客户端分组/落格；
  // 看板同样在客户端分列，但状态筛选照常透传（筛选状态对用户可见、不会静默失效）。
  React.useEffect(() => {
    filterRef.current = filter;
    sortByRef.current = sortBy;
    directionRef.current = direction;
    viewRef.current = view;
    projectFilterRef.current = projectFilter;
    const query = queryForView(view, filter, sortBy, direction);
    void loadList(query.filter, query.sortBy, query.direction, projectFilter);
  }, [view, filter, sortBy, direction, projectFilter, loadList]);

  // 看板/甘特里「已进行 X」随时间推进：只在这两个视图下每 60 秒更新一次「现在」。
  React.useEffect(() => {
    if (view !== 'board' && view !== 'gantt') return undefined;
    setNowMs(Date.now());
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 60e3);
    return () => {
      clearInterval(timer);
    };
  }, [view]);

  const reload = React.useCallback(
    (quiet) => {
      const query = queryForView(viewRef.current, filterRef.current, sortByRef.current, directionRef.current);
      return loadList(query.filter, query.sortBy, query.direction, projectFilterRef.current, {
        quiet: quiet !== false,
      });
    },
    [loadList]
  );

  /**
   * 拉取分类建议（/projects）：按 workspace 缓存；force=true 时绕过缓存。
   * 失败时静默降级为空建议（选择器仍保留未分类 + 自定义）。
   */
  const fetchProjectSuggestions = (workspacePath, force) => {
    const workspaceValue = typeof workspacePath === 'string' ? workspacePath : workspaceRef.current;
    const cache = projectCacheRef.current;
    const cacheKey = projectCacheKey(workspaceValue);
    if (force === true) cache.delete(cacheKey);
    else if (cache.has(cacheKey)) {
      setProjectSuggestions(cache.get(cacheKey));
      return Promise.resolve(cache.get(cacheKey));
    }
    projectSeqRef.current += 1;
    const seq = projectSeqRef.current;
    const body = {};
    if (workspaceValue !== '') body.workspace = workspaceValue;
    return request('/projects', body)
      .then((value) => {
        const suggestions = normalizeProjectSuggestions(value && value.suggestions);
        cache.set(cacheKey, suggestions);
        if (cache.size > 50) cache.clear();
        if (seq === projectSeqRef.current) setProjectSuggestions(suggestions);
        return suggestions;
      })
      .catch(() => {
        if (seq === projectSeqRef.current) setProjectSuggestions([]);
        return [];
      });
  };

  // 面板打开（挂载）时预取一次分类建议；工作区确定/切换时会再拉取。
  React.useEffect(() => {
    void fetchProjectSuggestions('');
  }, []);

  const isBusy = busyId !== null || creating;

  // 空态出口：当前有筛选/分类筛选时先清掉，否则聚焦新建输入框。
  const projectFiltered = projectFilter !== null && projectFilter !== undefined;
  const typeFiltered = typeFilter !== null && typeFilter !== undefined;
  const hasActiveFilter = filter !== 'all' || projectFiltered || typeFiltered;
  const emptyActionKey = hasActiveFilter ? 'list.clearFilterAction' : 'list.emptyAction';
  const handleEmptyAction = () => {
    if (hasActiveFilter) {
      // 一次点击清掉所有生效的筛选（状态更新会被 React 批处理成一次重新拉取）。
      if (filter !== 'all') setFilter('all');
      if (projectFiltered) setProjectFilter(null);
      if (typeFiltered) setTypeFilter(null);
      return;
    }
    if (createInputRef.current && typeof createInputRef.current.focus === 'function') {
      createInputRef.current.focus();
    }
  };

  const handleCreate = async (event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (creating) return;
    const rawTitle = newTitle;
    const title = rawTitle.trim();
    if (title === '') {
      showNotice('error', t('notice.titleRequired'));
      if (createInputRef.current && typeof createInputRef.current.focus === 'function') createInputRef.current.focus();
      return;
    }
    closeFileSuggest();
    setCreating(true);
    try {
      if (hasTagMarkup(rawTitle)) {
        // 含 #/@/[..]/项目：/分类：/换行/； → 交给 Host 统一解析。
        const body = { text: rawTitle };
        if (workspaceRef.current !== '') body.workspace = workspaceRef.current;
        // 显式 !优先级 / ^类型 标记优先；没有标记时用表单选择器（与服务端 parse > body 的规则一致）。
        if (newPriority !== '') body.priority = normalizePriority(newPriority);
        if (newType !== '') body.type = normalizeType(newType);
        const value = await request('/quick-add', body);
        if (!mountedRef.current) return;
        const created = Array.isArray(value && value.created)
          ? value.created.map(normalizeTodo).filter((todo) => todo !== null)
          : [];
        const skipped = normalizeChatSkipped(value && value.skipped);
        const errors = normalizeChatErrors(value && value.errors);
        const parts = [];
        if (created.length > 0) parts.push(t('notice.quickAddCreated', { count: created.length }));
        for (const item of skipped) parts.push(t('notice.quickAddSkipped', { line: item.line, reason: item.reason }));
        for (const item of errors) {
          parts.push(
            t('notice.quickAddError', {
              title: item.title === '' ? '?' : item.title,
              message: item.message === '' ? item.code : item.message,
            })
          );
        }
        if (parts.length === 0) parts.push(t('notice.quickAddEmpty'));
        showNotice(errors.length > 0 ? 'error' : 'success', parts.join(t('notice.join')));
        setNewTitle('');
        setNewProject('');
        setNewProjectCustom(false);
        if (createInputRef.current && typeof createInputRef.current.focus === 'function') createInputRef.current.focus();
        if (created.length > 0) void fetchProjectSuggestions(workspaceRef.current, true);
        await reload(true);
      } else {
        const body = { title };
        const project = normalizeProjectInput(newProject);
        if (project !== '') body.project = project;
        const priority = normalizePriority(newPriority);
        if (priority !== '') body.priority = priority;
        const type = normalizeType(newType);
        if (type !== '') body.type = type;
        const value = await request('/create', body);
        if (!mountedRef.current) return;
        setNewTitle('');
        setNewProject('');
        setNewProjectCustom(false);
        setNewPriority('');
        setNewType('');
        showNotice('success', notifyText(value, 'notice.created'));
        if (createInputRef.current && typeof createInputRef.current.focus === 'function') createInputRef.current.focus();
        void fetchProjectSuggestions(workspaceRef.current, true);
        await reload(true);
      }
    } catch (error) {
      showNotice('error', messageOf(error));
    } finally {
      if (mountedRef.current) setCreating(false);
    }
  };

  const handleToggle = async (todo) => {
    if (todo === null || todo === undefined || busyId !== null) return;
    const action = todo.status === 'completed' ? 'uncomplete' : 'complete';
    setBusyId(todo.id);
    try {
      const value = await request(`/${action}`, { id: todo.id });
      if (!mountedRef.current) return;
      if (action === 'complete') {
        showNotice('success', notifyText(value, 'notice.completed'), {
          onClick: () => {
            void handleToggle({ ...todo, status: 'completed' });
          },
        });
      } else {
        showNotice('info', notifyText(value, 'notice.uncompleted'));
      }
      await reload(true);
    } catch (error) {
      showNotice('error', messageOf(error));
    } finally {
      if (mountedRef.current) setBusyId(null);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditingProject('');
    setEditingProjectCustom(false);
    setEditingPriority('');
    setEditingType('');
  };

  const startEdit = (todo) => {
    if (busyId !== null || todo === null || todo === undefined) return;
    setConfirmId(null);
    setEditingId(todo.id);
    setEditTitle(typeof todo.title === 'string' ? todo.title : '');
    setEditingProject(normalizeProject(todo.project));
    setEditingProjectCustom(false);
    setEditingPriority(normalizePriority(todo.priority));
    setEditingType(normalizeType(todo.type));
  };

  const saveEdit = async (todo) => {
    if (todo === null || todo === undefined || busyId !== null) return;
    // 先做与服务端一致的归一化（折叠空白/去控制字符/trim），再校验长度与比较，
    // 避免把服务端归一化后会 <=40 的输入提前拒绝。
    const title = normalizeTitleInput(editTitle);
    if (title === '') {
      showNotice('error', t('notice.titleRequired'));
      return;
    }
    const project = normalizeProjectInput(editingProject);
    if (project.length > 40) {
      showNotice('error', t('notice.projectTooLong'));
      return;
    }
    const priority = normalizePriority(editingPriority);
    const type = normalizeType(editingType);
    if (
      title === todo.title &&
      project === normalizeProject(todo.project) &&
      priority === normalizePriority(todo.priority) &&
      type === normalizeType(todo.type)
    ) {
      cancelEdit();
      return;
    }
    setBusyId(todo.id);
    try {
      await request('/update', { id: todo.id, title, project, priority, type });
      if (!mountedRef.current) return;
      cancelEdit();
      showNotice('success', t('notice.updated'));
      void fetchProjectSuggestions(workspaceRef.current, true);
      await reload(true);
    } catch (error) {
      showNotice('error', messageOf(error));
    } finally {
      if (mountedRef.current) setBusyId(null);
    }
  };

  const handleEditKeyDown = (event, todo) => {
    if (!event) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      void saveEdit(todo);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancelEdit();
    }
  };

  /**
   * 撤销删除：把完整快照按裸 Todo[] 回灌 /import（merge），id、创建时间、
   * 完成时间原样保留，不需要 Host 新增接口；导入成功后 tombstone 也会被清掉。
   */
  const restoreDeleted = async (todo) => {
    if (todo === null || todo === undefined) return;
    try {
      const content = JSON.stringify([{
        id: todo.id,
        title: todo.title,
        project: todo.project,
        files: normalizeFiles(todo.files),
        status: todo.status,
        priority: todo.priority,
        type: todo.type,
        createdAt: todo.createdAt,
        completedAt: todo.completedAt,
        updatedAt: todo.updatedAt,
      }]);
      await request('/import', { content, mode: 'merge' });
      if (!mountedRef.current) return;
      showNotice('success', t('notice.restored'));
      void fetchProjectSuggestions(workspaceRef.current, true);
      await reload(true);
    } catch (error) {
      showNotice('error', messageOf(error));
    }
  };

  const handleDelete = async (todo) => {
    if (todo === null || todo === undefined || busyId !== null) return;
    setBusyId(todo.id);
    try {
      await request('/delete', { id: todo.id });
      if (!mountedRef.current) return;
      setConfirmId(null);
      setTableActionsId(null);
      showNotice('success', t('notice.deleted'), {
        onClick: () => {
          void restoreDeleted(todo);
        },
      });
      void fetchProjectSuggestions(workspaceRef.current, true);
      await reload(true);
    } catch (error) {
      showNotice('error', messageOf(error));
    } finally {
      if (mountedRef.current) setBusyId(null);
    }
  };

  const pushMessage = (message) => {
    messageSeq.current += 1;
    const id = messageSeq.current;
    setMessages((current) => current.concat([Object.assign({}, message, { id })]));
  };

  const clearSuggestTimer = () => {
    if (suggestTimerRef.current !== null) {
      clearTimeout(suggestTimerRef.current);
      suggestTimerRef.current = null;
    }
  };

  const closeFileSuggest = () => {
    clearSuggestTimer();
    suggestTokenRef.current = null;
    setSuggestOpen(false);
    setSuggestActive(0);
    setSuggestTarget(null);
  };

  const requestFiles = (query) => {
    const cache = filesCacheRef.current;
    const activeWorkspace = workspaceRef.current;
    const cacheKey = fileCacheKey(activeWorkspace, query);
    if (cache.has(cacheKey)) {
      setFileSuggestions(cache.get(cacheKey));
      setSuggestLoading(false);
      setSuggestError(false);
      return;
    }
    suggestSeqRef.current += 1;
    const seq = suggestSeqRef.current;
    setSuggestLoading(true);
    setSuggestError(false);
    const body = { query, limit: 200 };
    if (activeWorkspace !== '') body.workspace = activeWorkspace;
    request('/files', body)
      .then((value) => {
        if (seq !== suggestSeqRef.current) return;
        const files = normalizeFileSuggestions(value && value.files).slice(0, 12);
        cache.set(cacheKey, files);
        if (cache.size > 100) cache.clear();
        setFileSuggestions(files);
        setSuggestLoading(false);
      })
      .catch(() => {
        if (seq !== suggestSeqRef.current) return;
        setSuggestLoading(false);
        setSuggestError(true);
        setFileSuggestions([]);
      });
  };

  const scheduleFileRequest = (query) => {
    clearSuggestTimer();
    suggestTimerRef.current = setTimeout(() => {
      suggestTimerRef.current = null;
      requestFiles(query);
    }, 150);
  };

  const applyProjectMatches = (list, query) => {
    const needle = typeof query === 'string' ? query.toLowerCase() : '';
    const names = [];
    for (const item of Array.isArray(list) ? list : []) {
      if (!isRecord(item)) continue;
      const name = normalizeProject(item.name);
      if (name === '') continue;
      if (needle !== '' && name.toLowerCase().indexOf(needle) === -1) continue;
      names.push(name);
      if (names.length >= 12) break;
    }
    setFileSuggestions(names);
    setSuggestLoading(false);
    setSuggestError(false);
  };

  const requestProjectMatches = (query) => {
    const activeWorkspace = workspaceRef.current;
    const cacheKey = projectCacheKey(activeWorkspace);
    const cached = projectCacheRef.current.get(cacheKey);
    if (cached !== undefined) {
      applyProjectMatches(cached, query);
      return;
    }
    suggestSeqRef.current += 1;
    const seq = suggestSeqRef.current;
    setSuggestLoading(true);
    setSuggestError(false);
    const body = {};
    if (activeWorkspace !== '') body.workspace = activeWorkspace;
    request('/projects', body)
      .then((value) => {
        if (seq !== suggestSeqRef.current) return;
        const suggestions = normalizeProjectSuggestions(value && value.suggestions);
        projectCacheRef.current.set(cacheKey, suggestions);
        if (projectCacheRef.current.size > 50) projectCacheRef.current.clear();
        setProjectSuggestions(suggestions);
        applyProjectMatches(suggestions, query);
      })
      .catch(() => {
        if (seq !== suggestSeqRef.current) return;
        setSuggestLoading(false);
        setSuggestError(true);
        setFileSuggestions([]);
      });
  };

  const scheduleProjectRequest = (query) => {
    clearSuggestTimer();
    suggestTimerRef.current = setTimeout(() => {
      suggestTimerRef.current = null;
      requestProjectMatches(query);
    }, 150);
  };

  const handleTagInputChange = (value, caret, target) => {
    if (target === 'create') setNewTitle(value);
    else setChatInput(value);
    const atToken = findAtToken(value, caret);
    const hashToken = findHashToken(value, caret);
    let token = null;
    let kind = 'file';
    if (atToken !== null && hashToken !== null) {
      // @ 与 # 互斥：取离光标更近（下标更大）的那个。
      if (hashToken.start > atToken.start) {
        token = hashToken;
        kind = 'project';
      } else {
        token = atToken;
        kind = 'file';
      }
    } else if (hashToken !== null) {
      token = hashToken;
      kind = 'project';
    } else if (atToken !== null) {
      token = atToken;
      kind = 'file';
    }
    if (token === null) {
      if (suggestOpen && suggestTarget === target) closeFileSuggest();
      return;
    }
    suggestTokenRef.current = { start: token.start, end: token.end, query: token.query };
    suggestKindRef.current = kind;
    setSuggestKind(kind);
    setSuggestTarget(target);
    setSuggestOpen(true);
    setSuggestActive(0);
    if (kind === 'project') scheduleProjectRequest(token.query);
    else scheduleFileRequest(token.query);
  };

  const handleChatInputChange = (value, caret) => handleTagInputChange(value, caret, 'chat');
  const handleCreateTitleChange = (value, caret) => handleTagInputChange(value, caret, 'create');

  const handleCreateKeyDown = (event) => {
    if (!event) return;
    const composing = event.isComposing === true || (event.nativeEvent && event.nativeEvent.isComposing === true);
    if (suggestOpen && suggestTarget === 'create') {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveFileSuggest(1);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveFileSuggest(-1);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeFileSuggest();
        return;
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && composing !== true) {
        event.preventDefault();
        if (fileSuggestions.length > 0) selectCreateSuggestion(fileSuggestions[suggestActive]);
        else closeFileSuggest();
        return;
      }
    }
    // 其余情况保持表单默认行为（Enter 提交）。
  };

  const handleCreateBlur = () => {
    if (createBlurTimerRef.current !== null) {
      clearTimeout(createBlurTimerRef.current);
      createBlurTimerRef.current = null;
    }
    createBlurTimerRef.current = setTimeout(() => {
      createBlurTimerRef.current = null;
      if (suggestOpen && suggestTarget === 'create') closeFileSuggest();
    }, 120);
  };

  const handleCreateFocus = () => {
    if (createBlurTimerRef.current !== null) {
      clearTimeout(createBlurTimerRef.current);
      createBlurTimerRef.current = null;
    }
  };

  const moveFileSuggest = (delta) => {
    setSuggestActive((current) => {
      const length = fileSuggestions.length;
      if (length === 0) return 0;
      return (current + delta + length) % length;
    });
  };

  const applySuggestion = (target, item) => {
    const chosen = typeof item === 'string' ? item : '';
    const token = suggestTokenRef.current;
    if (chosen === '' || token === null) {
      closeFileSuggest();
      return;
    }
    const current = target === 'create' ? newTitle : chatInput;
    const setValue = target === 'create' ? setNewTitle : setChatInput;
    const start = Math.max(0, Math.min(token.start, current.length));
    const end = Math.max(start, Math.min(token.end, current.length));
    const insertion =
      suggestKindRef.current === 'project' ? formatProjectTag(chosen) : formatFileReference(chosen);
    setValue(`${current.slice(0, start)}${insertion}${current.slice(end)}`);
    closeFileSuggest();
  };

  const selectSuggestion = (item) => applySuggestion('chat', item);
  const selectCreateSuggestion = (item) => applySuggestion('create', item);

  const handleWorkspaceChange = (nextPath) => {
    const path = typeof nextPath === 'string' ? nextPath : '';
    workspaceRef.current = path;
    setWorkspace(path);
    // 切换工作区：清空当前建议、重拉分类建议，并重新预热空 query 的文件列表。
    clearSuggestTimer();
    suggestTokenRef.current = null;
    suggestKindRef.current = 'file';
    setSuggestKind('file');
    setFileSuggestions([]);
    setSuggestOpen(false);
    setSuggestActive(0);
    setSuggestLoading(false);
    setSuggestError(false);
    void fetchProjectSuggestions(path, true);
    if (chatOpen) requestFiles('');
  };

  const handleChatSend = async () => {
    if (chatBusy) return;
    const raw = chatInput;
    if (typeof raw !== 'string' || raw.trim() === '') {
      pushMessage({ role: 'assistant', text: t('chat.noInput') });
      return;
    }
    setChatBusy(true);
    setChatInput('');
    closeFileSuggest();
    pushMessage({ role: 'user', text: raw.trim() });
    try {
      // 解析全部在 Host：客户端只负责 POST /quick-add 并渲染 {created, skipped, errors}。
      const body = { text: raw };
      if (workspaceRef.current !== '') body.workspace = workspaceRef.current;
      const value = await request('/quick-add', body);
      const created = Array.isArray(value && value.created)
        ? value.created.map(normalizeTodo).filter((todo) => todo !== null)
        : [];
      const skipped = normalizeChatSkipped(value && value.skipped);
      const errors = normalizeChatErrors(value && value.errors);
      const lines = [];
      if (created.length > 0) {
        lines.push(t('chat.success', { count: created.length }));
        for (const todo of created) {
          lines.push(
            t('chat.successLine', {
              project: projectLabel(normalizeProject(todo.project)),
              title: todo.title,
              time: formatClock(todo.createdAt),
            })
          );
        }
      }
      if (skipped.length > 0) {
        lines.push(t('chat.skippedHeader', { count: skipped.length }));
        for (const item of skipped) {
          lines.push(t('chat.skippedLine', { line: item.line, reason: item.reason }));
        }
      }
      if (errors.length > 0) {
        lines.push(t('chat.errorsHeader', { count: errors.length }));
        for (const item of errors) {
          lines.push(t('chat.errorsLine', { title: item.title, code: item.code, message: item.message }));
        }
      }
      if (lines.length === 0) lines.push(t('chat.noInput'));
      pushMessage({
        role: 'assistant',
        text: lines.join('\n'),
        successes: created,
        undone: false,
      });
      if (mountedRef.current) setChatBusy(false);
      if (created.length > 0) void fetchProjectSuggestions(workspaceRef.current, true);
      await reload(true);
    } catch (error) {
      pushMessage({ role: 'assistant', text: t('chat.quickAddFailed', { message: messageOf(error) }) });
      if (mountedRef.current) setChatBusy(false);
    }
  };

  // 打开对话面板时加载工作区列表（默认 active），并预热一次空 query 的文件列表。
  React.useEffect(() => {
    if (!chatOpen) return undefined;
    let cancelled = false;
    request('/workspaces', {})
      .then((value) => {
        if (cancelled || !mountedRef.current) return;
        const list = normalizeWorkspaces(value && value.workspaces);
        if (list.length === 0) {
          workspaceRef.current = '';
          setWorkspace('');
          setWorkspaces([]);
          return;
        }
        const active = value && typeof value.active === 'string' ? value.active : '';
        const current = workspaceRef.current;
        const keep = current !== '' && list.some((item) => item.path === current);
        if (!keep) {
          const fallback = list.some((item) => item.path === active) ? active : list[0].path;
          workspaceRef.current = fallback;
          setWorkspace(fallback);
        }
        setWorkspaces(list);
        void fetchProjectSuggestions(workspaceRef.current);
        requestFiles('');
      })
      .catch(() => {
        // 静默降级：清空选择，请求不带 workspace，由 Host 使用默认工作区。
        if (cancelled || !mountedRef.current) return;
        workspaceRef.current = '';
        setWorkspace('');
        setWorkspaces([]);
        setProjectSuggestions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [chatOpen]);

  React.useEffect(
    () => () => {
      if (suggestTimerRef.current !== null) {
        clearTimeout(suggestTimerRef.current);
        suggestTimerRef.current = null;
      }
      if (createBlurTimerRef.current !== null) {
        clearTimeout(createBlurTimerRef.current);
        createBlurTimerRef.current = null;
      }
    },
    []
  );

  const handleChatUndo = async (message) => {
    if (!isRecord(message) || message.undone === true) return;
    // 部分失败后重试：只对上次失败的条目再发 /delete。
    const pending =
      Array.isArray(message.undoFailed) && message.undoFailed.length > 0
        ? message.undoFailed
        : message.successes;
    if (!Array.isArray(pending) || pending.length === 0) return;
    if (chatBusy) return;
    setChatBusy(true);
    let removed = 0;
    const failedTodos = [];
    const failedDetails = [];
    for (const todo of pending) {
      if (todo === null || todo === undefined || typeof todo.id !== 'string' || todo.id === '') {
        failedTodos.push(todo);
        failedDetails.push(t('notice.unknownError'));
        continue;
      }
      try {
        await request('/delete', { id: todo.id });
        removed += 1;
      } catch (error) {
        failedTodos.push(todo);
        failedDetails.push(`${todo.title || todo.id}：${messageOf(error)}`);
      }
    }
    const allRemoved = failedTodos.length === 0;
    setMessages((current) =>
      current.map((item) =>
        item.id === message.id
          ? Object.assign({}, item, {
              undone: allRemoved,
              undoFailed: allRemoved ? [] : failedTodos,
            })
          : item
      )
    );
    if (allRemoved) {
      pushMessage({ role: 'assistant', text: t('chat.undone', { count: removed }) });
    } else {
      pushMessage({
        role: 'assistant',
        text: t('chat.undonePartial', {
          removed,
          failed: failedTodos.length,
          detail: failedDetails.join(t('notice.join')),
        }),
      });
    }
    if (mountedRef.current) setChatBusy(false);
    await reload(true);
  };

  const toggleExpanded = (todo) => {
    if (todo === null || todo === undefined) return;
    setExpandedIds((current) => {
      const next = Object.assign({}, current);
      if (next[todo.id]) delete next[todo.id];
      else next[todo.id] = true;
      return next;
    });
  };

  const toggleGanttExpanded = (todo) => {
    if (todo === null || todo === undefined) return;
    setGanttExpandedIds((current) => {
      const next = Object.assign({}, current);
      if (next[todo.id]) delete next[todo.id];
      else next[todo.id] = true;
      return next;
    });
  };

  const toggleGanttGroup = (project) => {
    const key = typeof project === 'string' ? project : '';
    setGanttCollapsedProjects((current) => {
      const next = Object.assign({}, current);
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  };

  // —— 表格 / 看板 / 日历共用的行内操作与编辑控件 ——
  const detailIdOf = (todo) => `ttl-detail-${String(todo.id).replace(/[^A-Za-z0-9_-]/g, '-')}`;

  const statusBadge = (todo) =>
    h(
      'span',
      {
        className:
          todo.status === 'completed'
            ? 'ttl-badge ttl-status-badge ttl-badge-completed'
            : 'ttl-badge ttl-status-badge',
      },
      t(todo.status === 'completed' ? 'row.completed' : 'row.pending')
    );

  /** 优先级徽标：始终带文字（颜色只是辅助），未设置不渲染。 */
  const priorityBadge = (todo) => {
    const priority = normalizePriority(todo && todo.priority);
    if (priority === '') return null;
    return h(
      'span',
      {
        className: `ttl-badge ttl-priority-badge ttl-priority-${priority}`,
        'data-priority': priority,
      },
      h(
        'span',
        { className: 'ttl-priority-arrow', 'aria-hidden': 'true' },
        priority === 'high' ? '↑' : priority === 'medium' ? '↗' : '↓'
      ),
      t(`priority.${priority}`)
    );
  };

  /** 类型徽标：始终带文字（颜色只是辅助），未设置不渲染。 */
  const typeBadge = (todo) => {
    const type = normalizeType(todo && todo.type);
    if (type === '') return null;
    return h(
      'span',
      {
        className: `ttl-badge ttl-type-badge ttl-type-${type}`,
        'data-type': type,
      },
      t(`type.${type}`)
    );
  };

  /** 优先级选择器（新建表单 / 行内编辑 / 卡片快捷修改复用）。 */
  const prioritySelectControl = (value, onChange, disabled) =>
    h(
      'label',
      { className: 'ttl-select ttl-priority-select' },
      h('span', null, t('priority.label')),
      h(
        'select',
        {
          value: normalizePriority(value),
          'aria-label': t('priority.label'),
          disabled,
          onChange: (event) => onChange(event.target.value),
        },
        PRIORITIES.map((entry) =>
          h('option', { key: entry.value === '' ? 'none' : entry.value, value: entry.value }, t(entry.labelKey))
        )
      )
    );

  /** 类型选择器（新建表单 / 行内编辑 / 卡片快捷修改复用）。 */
  const typeSelectControl = (value, onChange, disabled) =>
    h(
      'label',
      { className: 'ttl-select ttl-type-select' },
      h('span', null, t('type.label')),
      h(
        'select',
        {
          value: normalizeType(value),
          'aria-label': t('type.label'),
          disabled,
          onChange: (event) => onChange(event.target.value),
        },
        TYPES.map((entry) =>
          h('option', { key: entry.value === '' ? 'none' : entry.value, value: entry.value }, t(entry.labelKey))
        )
      )
    );

  const titleInput = (todo) =>
    h('input', {
      className: 'ttl-input ttl-edit-input',
      type: 'text',
      value: editTitle,
      autoFocus: true,
      'aria-label': t('row.editInputAria'),
      disabled: busyId === todo.id,
      onChange: (event) => setEditTitle(event.target.value),
      onKeyDown: (event) => handleEditKeyDown(event, todo),
    });

  const projectInput = (todo) =>
    h(ProjectPicker, {
      value: editingProject,
      options: projectSuggestions,
      custom: editingProjectCustom,
      disabled: busyId === todo.id,
      onChange: (value) => setEditingProject(value),
      onCustom: () => setEditingProjectCustom(true),
      onBackToList: () => setEditingProjectCustom(false),
      onInputKeyDown: (event) => handleEditKeyDown(event, todo),
    });

  const detailToggleButton = (todo) => {
    const expanded = expandedIds[todo.id] === true;
    return h(
      'button',
      {
        key: 'detail-toggle',
        type: 'button',
        className: 'ttl-link',
        disabled: isBusy,
        'aria-expanded': expanded ? 'true' : 'false',
        'aria-controls': detailIdOf(todo),
        'aria-label': t('detail.toggleAria', {
          action: expanded ? t('detail.collapse') : t('detail.expand'),
          title: todo.title,
        }),
        onClick: () => toggleExpanded(todo),
      },
      expanded ? t('detail.collapse') : t('table.detail')
    );
  };

  const renderActionButtons = (todo, options) => {
    const opts = options || {};
    const isEditing = editingId === todo.id;
    const isConfirming = confirmId === todo.id;
    const completed = todo.status === 'completed';
    const toggleLabel = t(completed ? 'row.uncomplete' : 'row.complete');
    const buttons = [];
    if (isEditing) {
      buttons.push(
        h(
          'button',
          {
            key: 'save',
            type: 'button',
            className: 'ttl-link',
            disabled: isBusy,
            onClick: () => {
              void saveEdit(todo);
            },
          },
          t('row.save')
        )
      );
      buttons.push(
        h(
          'button',
          { key: 'cancel-edit', type: 'button', className: 'ttl-link', disabled: isBusy, onClick: cancelEdit },
          t('row.cancel')
        )
      );
      return buttons;
    }
    if (opts.showDetail === true) buttons.push(detailToggleButton(todo));
    // 表格行首已有勾选圈，操作区不再重复「完成 / 取消完成」。
    if (opts.showToggle !== false) {
      buttons.push(
        h(
          'button',
          {
            key: 'toggle',
            type: 'button',
            className: 'ttl-link',
            disabled: isBusy,
            'aria-label': t('row.toggleAria', { action: toggleLabel, title: todo.title }),
            onClick: () => {
              void handleToggle(todo);
            },
          },
          toggleLabel
        )
      );
    }
    buttons.push(
      h(
        'button',
        {
          key: 'edit',
          type: 'button',
          className: 'ttl-link',
          disabled: isBusy,
          'aria-label': t('row.editAria'),
          onClick: () => startEdit(todo),
        },
        t('row.edit')
      )
    );
    if (isConfirming) {
      buttons.push(
        h(
          'button',
          {
            key: 'confirm-delete',
            type: 'button',
            className: 'ttl-link ttl-link-danger',
            disabled: isBusy,
            'aria-label': t('row.confirmDeleteAria', { title: todo.title }),
            onClick: () => {
              void handleDelete(todo);
            },
          },
          t('row.confirmDelete')
        )
      );
      buttons.push(
        h(
          'button',
          { key: 'cancel-delete', type: 'button', className: 'ttl-link', disabled: isBusy, onClick: () => setConfirmId(null) },
          t('row.cancel')
        )
      );
    } else {
      buttons.push(
        h(
          'button',
          {
            key: 'delete',
            type: 'button',
            className: 'ttl-link ttl-link-danger',
            disabled: isBusy,
            onClick: () => {
              cancelEdit();
              setConfirmId(todo.id);
            },
          },
          t('row.delete')
        )
      );
    }
    return buttons;
  };

  /** 表格行首勾选圈：点一下标记完成 / 取消完成（与看板卡片同一交互与 toast）。 */
  const renderRowCheck = (todo) => {
    const completed = todo.status === 'completed';
    return h(CheckButton, {
      checked: completed,
      disabled: isBusy,
      label: t('board.checkAria', { title: todo.title === '' ? t('list.empty') : todo.title }),
      title: t(completed ? 'row.uncomplete' : 'row.complete'),
      className: 'ttl-row-check',
      onClick: () => {
        void handleToggle(todo);
      },
    });
  };

  /** 文件 chip 点击：navigator.clipboard 可用时复制并轻提示，否则静默降级。 */
  const copyFilePath = (path) => {
    try {
      if (typeof navigator === 'undefined' || navigator === null) return;
      const clipboard = navigator.clipboard;
      if (clipboard === null || clipboard === undefined || typeof clipboard.writeText !== 'function') return;
      const result = clipboard.writeText(path);
      if (result && typeof result.then === 'function') {
        result.then(
          () => {
            if (mountedRef.current) showNotice('info', t('files.copied', { path }));
          },
          () => {}
        );
      } else if (mountedRef.current) {
        showNotice('info', t('files.copied', { path }));
      }
    } catch (error) {
      // 剪贴板不可用（非安全上下文/无权限）时静默忽略。
    }
  };

  /** 文件 chips：max 控制展示数量，其余折叠为 +N；title 含全部路径。 */
  const renderFileChips = (todo, options) => {
    const files = normalizeFiles(todo && todo.files);
    if (files.length === 0) return null;
    const max = options && typeof options.max === 'number' && options.max > 0 ? options.max : files.length;
    const visible = files.slice(0, max);
    const hidden = files.length - visible.length;
    const compact = Boolean(options && options.compact);
    return h(
      'span',
      {
        className: compact ? 'ttl-file-chips ttl-file-chips-compact' : 'ttl-file-chips',
        title: files.join('\n'),
        'aria-label': t('files.aria'),
      },
      visible.map((path) => h(FileChip, { key: path, path, compact, onCopy: copyFilePath })),
      hidden > 0
        ? h('span', { className: 'ttl-file-more', title: files.slice(max).join('\n') }, t('files.more', { count: hidden }))
        : null
    );
  };

  // 表头点击：同一字段切换方向，不同字段切换字段并回到升序（与工具栏 select 同一状态源）。
  const handleHeaderSort = (field) => {
    if (typeof field !== 'string' || field === '') return;
    if (sortBy === field) setDirection(direction === 'asc' ? 'desc' : 'asc');
    else {
      setSortBy(field);
      setDirection('asc');
    }
  };

  /** 列空态文案：筛选生效时用中性文案，否则按列语义区分。 */
  const emptyColumnKey = (column) => {
    if (filter !== 'all') return 'board.emptyColumnFiltered';
    if (column.status === 'pending') return 'board.emptyColumnPending';
    if (column.status === 'completed') return 'board.emptyColumnCompleted';
    return 'board.emptyColumnProject';
  };

  /** 列头「＋」：分类列预填分类；状态列只聚焦顶部新建框（新建一定是未完成）。 */
  const handleColumnAdd = (column) => {
    if (column && typeof column.project === 'string') {
      setNewProject(column.project);
      setNewProjectCustom(false);
    }
    if (createInputRef.current && typeof createInputRef.current.focus === 'function') {
      createInputRef.current.focus();
    }
  };

  /** 泳道「＋」：预填该泳道分类后聚焦顶部新建框。 */
  const handleLaneAdd = (lane) => {
    if (lane && typeof lane.project === 'string') {
      setNewProject(lane.project);
      setNewProjectCustom(false);
    }
    if (createInputRef.current && typeof createInputRef.current.focus === 'function') {
      createInputRef.current.focus();
    }
  };

  /**
   * 面板内快捷键（只挂在根节点，避免 document 级监听）：
   * `/` 聚焦搜索、`n` 聚焦新建、`f` 循环切换筛选。
   */
  const handlePanelKeyDown = (event) => {
    if (!event || event.defaultPrevented) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    const tag = target && typeof target.tagName === 'string' ? target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || (target && target.isContentEditable === true)) return;
    if (event.key === '/') {
      event.preventDefault();
      if (searchRef.current && typeof searchRef.current.focus === 'function') searchRef.current.focus();
      return;
    }
    if (event.key === 'n' || event.key === 'N') {
      event.preventDefault();
      if (createInputRef.current && typeof createInputRef.current.focus === 'function') createInputRef.current.focus();
      return;
    }
    if (event.key === 'f' || event.key === 'F') {
      event.preventDefault();
      const index = FILTERS.findIndex((entry) => entry.value === filter);
      setFilter(FILTERS[(index + 1) % FILTERS.length].value);
    }
  };

  /**
   * 看板「移到分类」：本质是改数据（project），不是纯视图操作。
   * 走现有 /update（部分更新），成功后用 toast 提供撤销（改回原分类）。
   */
  const handleMoveProject = async (todo, project) => {
    if (todo === null || todo === undefined || busyId !== null) return;
    const nextProject = normalizeProject(project);
    const previousProject = normalizeProject(todo.project);
    if (nextProject === previousProject) {
      setBoardActionsId(null);
      return;
    }
    setBusyId(todo.id);
    try {
      await request('/update', { id: todo.id, project: nextProject });
      if (!mountedRef.current) return;
      setBoardActionsId(null);
      showNotice('success', t('board.moved', { project: projectLabel(nextProject) }), {
        onClick: () => {
          void handleMoveProject({ ...todo, project: nextProject }, previousProject);
        },
      });
      void fetchProjectSuggestions(workspaceRef.current, true);
      await reload(true);
    } catch (error) {
      showNotice('error', messageOf(error));
    } finally {
      if (mountedRef.current) setBusyId(null);
    }
  };

  /** 优先级是普通字段：卡片上的 select 直接改，失败由 toast 提示。 */
  const handleSetPriority = async (todo, value) => {
    if (todo === null || todo === undefined || busyId !== null) return;
    const nextPriority = normalizePriority(value);
    const previousPriority = normalizePriority(todo.priority);
    if (nextPriority === previousPriority) return;
    setBusyId(todo.id);
    try {
      await request('/update', { id: todo.id, priority: nextPriority });
      if (!mountedRef.current) return;
      showNotice('success', t('priority.updated'), {
        onClick: () => {
          void handleSetPriority({ ...todo, priority: nextPriority }, previousPriority);
        },
      });
      await reload(true);
    } catch (error) {
      showNotice('error', messageOf(error));
    } finally {
      if (mountedRef.current) setBusyId(null);
    }
  };

  /** 类型是普通字段：卡片上的 select 直接改，失败由 toast 提示。 */
  const handleSetType = async (todo, value) => {
    if (todo === null || todo === undefined || busyId !== null) return;
    const nextType = normalizeType(value);
    const previousType = normalizeType(todo.type);
    if (nextType === previousType) return;
    setBusyId(todo.id);
    try {
      await request('/update', { id: todo.id, type: nextType });
      if (!mountedRef.current) return;
      showNotice('success', t('type.updated'), {
        onClick: () => {
          void handleSetType({ ...todo, type: nextType }, previousType);
        },
      });
      await reload(true);
    } catch (error) {
      showNotice('error', messageOf(error));
    } finally {
      if (mountedRef.current) setBusyId(null);
    }
  };

  const openTransfer = () => {
    if (transferBusy) return;
    setTransferError('');
    setTransferPreview(null);
    setTransferFileName('');
    setTransferContent('');
    setTransferMode('merge');
    setTransferOpen(true);
  };

  const closeTransfer = () => {
    if (transferBusy) return;
    setTransferOpen(false);
  };

  /** 预览与正式导入共用 /import；dryRun 只算差异，不写盘。 */
  const runImportPreview = async (content, mode) => {
    setTransferBusy(true);
    setTransferError('');
    try {
      const value = await request('/import', { content, mode, dryRun: true });
      if (!mountedRef.current) return;
      setTransferPreview(value);
    } catch (error) {
      if (!mountedRef.current) return;
      setTransferPreview(null);
      setTransferError(messageOf(error));
    } finally {
      if (mountedRef.current) setTransferBusy(false);
    }
  };

  const handleTransferModeChange = (nextMode) => {
    if (transferBusy || transferContent === '') return;
    setTransferMode(nextMode);
    void runImportPreview(transferContent, nextMode);
  };

  const handleExport = async (format) => {
    if (transferBusy) return;
    setTransferBusy(true);
    setTransferError('');
    try {
      const value = await request('/export', { format });
      if (!mountedRef.current) return;
      setDownload(makeDownload(value.content, value.filename, value.mime));
      showNotice('success', t('transfer.exported', {
        count: Number(value.count) || 0,
        format: String(value.format || format).toUpperCase(),
      }));
      setTransferOpen(false);
    } catch (error) {
      if (!mountedRef.current) return;
      setTransferError(messageOf(error));
    } finally {
      if (mountedRef.current) setTransferBusy(false);
    }
  };

  const handlePickFile = () => {
    const input = transferInputRef.current;
    if (input && typeof input.click === 'function') input.click();
  };

  const handleImportFileChange = async (event) => {
    const target = event && event.target ? event.target : null;
    const files = target && target.files ? target.files : null;
    const file = files && files.length > 0 ? files[0] : null;
    // 允许再次选择同一个文件：清空 input 的值不会影响已经读到的 File。
    if (target) target.value = '';
    if (file === null) return;
    let content = '';
    try {
      content = await readFileText(file);
    } catch (error) {
      if (mountedRef.current) setTransferError(t('transfer.readError', { message: messageOf(error) }));
      return;
    }
    if (!mountedRef.current) return;
    if (content.trim() === '') {
      setTransferPreview(null);
      setTransferError(t('transfer.emptyFile'));
      return;
    }
    setTransferFileName(typeof file.name === 'string' ? file.name : '');
    setTransferContent(content);
    void runImportPreview(content, transferMode);
  };

  const handleRestoreBackup = async (backupFile) => {
    if (typeof backupFile !== 'string' || backupFile === '') return;
    try {
      const value = await request('/restore', { file: backupFile });
      if (!mountedRef.current) return;
      showNotice('success', notifyText(value, 'transfer.undone'));
      void fetchProjectSuggestions(workspaceRef.current, true);
      await reload(true);
    } catch (error) {
      showNotice('error', messageOf(error));
    }
  };

  const handleImportConfirm = async () => {
    if (transferBusy || transferContent === '') return;
    setTransferBusy(true);
    setTransferApplying(true);
    setTransferError('');
    try {
      const value = await request('/import', { content: transferContent, mode: transferMode });
      if (!mountedRef.current) return;
      setTransferOpen(false);
      setTransferPreview(null);
      setTransferContent('');
      setTransferFileName('');
      const backup = value && typeof value.backup === 'string' ? value.backup : '';
      showNotice('success', notifyText(value, 'transfer.imported'), backup === '' ? undefined : {
        onClick: () => {
          void handleRestoreBackup(backup);
        },
      });
      void fetchProjectSuggestions(workspaceRef.current, true);
      await reload(true);
    } catch (error) {
      if (!mountedRef.current) return;
      setTransferError(messageOf(error));
    } finally {
      if (mountedRef.current) {
        setTransferBusy(false);
        setTransferApplying(false);
      }
    }
  };

  const shiftCalendarMonth = (delta) => {
    const total = calendarYear * 12 + calendarMonth + delta;
    setCalendarYear(Math.floor(total / 12));
    setCalendarMonth(((total % 12) + 12) % 12);
    setCalendarSelectedDay(null);
  };

  const goToToday = () => {
    const now = new Date();
    setCalendarYear(now.getFullYear());
    setCalendarMonth(now.getMonth());
    setCalendarSelectedDay(dateKeyOf(now.getTime()));
  };

  // 搜索与类型筛选都是纯客户端过滤（/list 已返回当前视图所需的完整数据），与状态/分类筛选是 AND 关系。
  const searchQuery = normalizeSearch(search);
  const typeFilteredTodos =
    typeFilter === null || typeFilter === undefined
      ? todos
      : todos.filter((todo) => normalizeType(todo.type) === typeFilter);
  const visibleTodos =
    searchQuery === ''
      ? typeFilteredTodos
      : typeFilteredTodos.filter((todo) => todoMatchesSearch(todo, searchQuery));
  const clearSearch = () => setSearch('');
  // 视图实现位于 views/*：每次渲染把当前闭包交给视图工厂（取值来源与旧闭包一致）。
  const renderDetailContent = createDetailContent({ renderFileChips });
  const viewDeps = {
    boardActionsId,
    boardGroupBy,
    boardLaneCollapsed,
    boardShowAllCompleted,
    busyId,
    calendarBasis,
    calendarMonth,
    calendarSelectedDay,
    calendarYear,
    cancelEdit,
    confirmId,
    density,
    detailIdOf,
    direction,
    editingId,
    editingPriority,
    editingType,
    emptyActionKey,
    emptyColumnKey,
    expandedIds,
    filter,
    ganttCollapsedProjects,
    ganttExpandedIds,
    handleColumnAdd,
    handleDelete,
    handleEmptyAction,
    handleHeaderSort,
    handleLaneAdd,
    handleMoveProject,
    handleSetPriority,
    handleSetType,
    handleToggle,
    isBusy,
    listStatus,
    nowMs,
    priorityBadge,
    prioritySelectControl,
    projectInput,
    projectSuggestions,
    range,
    renderActionButtons,
    renderDetailContent,
    renderFileChips,
    renderRowCheck,
    saveEdit,
    setBoardActionsId,
    setBoardLaneCollapsed,
    setBoardShowAllCompleted,
    setCalendarSelectedDay,
    setConfirmId,
    setEditingPriority,
    setEditingType,
    setTableActionsId,
    sortBy,
    startEdit,
    statusBadge,
    tableActionsId,
    titleInput,
    toggleExpanded,
    toggleGanttExpanded,
    toggleGanttGroup,
    typeBadge,
    typeSelectControl,
    visibleTodos,
  };
  const renderTableView = createTableView(viewDeps);
  const renderBoardView = createBoardView(viewDeps);
  const renderCalendarView = createCalendarView(viewDeps);

  let listBody;
  if (listStatus === 'loading' && todos.length === 0) {
    listBody = h(LoadingPlaceholder);
  } else if (listStatus === 'error' && todos.length === 0) {
    listBody = h(ErrorPlaceholder, {
      message: listError,
      onRetry: () => {
        void reload(false);
      },
    });
  } else if (searchQuery !== '' && visibleTodos.length === 0 && todos.length > 0) {
    listBody = h(TextPlaceholder, {
      titleKey: 'board.searchEmpty',
      titleVars: { query: searchQuery },
      hintKey: 'board.searchEmptyHint',
      actionKey: 'board.searchClear',
      onAction: clearSearch,
    });
  } else if (typeFiltered && visibleTodos.length === 0 && todos.length > 0) {
    listBody = h(TextPlaceholder, {
      titleKey: 'board.emptyColumnFiltered',
      actionKey: 'list.clearFilterAction',
      onAction: handleEmptyAction,
    });
  } else if (view === 'gantt') {
    listBody = renderGanttView(viewDeps);
  } else if (view === 'board') {
    listBody = renderBoardView(viewDeps);
  } else if (view === 'calendar') {
    listBody = renderCalendarView(viewDeps);
  } else {
    listBody = renderTableView(viewDeps);
  }
  // 计数与筛选同口径：分类筛选生效时用该分类的统计（/list 的 projects 汇总
  // 始终按全量数据计算）；该分类一条待办都没有时 projects[] 里没有条目，
  // 此时计数必须是 0，不能回落到全局 stats，避免「计数 4、行数 0」的错位。
  const scopedProject = projectFiltered ? projects.find((item) => item.name === projectFilter) || null : null;
  const filterCounts = scopedProject
    ? { all: scopedProject.count, pending: scopedProject.pending, completed: scopedProject.completed }
    : projectFiltered
      ? { all: 0, pending: 0, completed: 0 }
      : { all: stats.total, pending: stats.pending, completed: stats.completed };
  const filterTabs = h(
    'div',
    { className: 'ttl-seg', role: 'group', 'aria-label': t('filter.label') },
    FILTERS.map((entry) =>
      h(
        'button',
        {
          key: entry.value,
          type: 'button',
          className: 'ttl-seg-item',
          'aria-pressed': filter === entry.value ? 'true' : 'false',
          onClick: () => setFilter(entry.value),
        },
        t(entry.labelKey),
        h('span', { key: filterCounts[entry.value] || 0, className: 'ttl-seg-count' }, String(filterCounts[entry.value] || 0))
      )
    )
  );

  const viewToggle = h(
    'div',
    { className: 'ttl-seg', role: 'group', 'aria-label': t('view.aria') },
    VIEWS.map((entry) =>
      h(
        'button',
        {
          key: entry.value,
          type: 'button',
          className: 'ttl-seg-item',
          'aria-pressed': view === entry.value ? 'true' : 'false',
          onClick: () => setView(entry.value),
        },
        t(entry.labelKey)
      )
    )
  );

  const projectFilterSelect = h(
    'label',
    { className: 'ttl-select' },
    h('span', null, t('project.filterLabel')),
    h(
      'select',
      {
        value: projectFilter === null ? PROJECT_FILTER_ALL : projectFilter,
        'aria-label': t('project.filterLabel'),
        onChange: (event) => {
          const next = event.target.value;
          setProjectFilter(next === PROJECT_FILTER_ALL ? null : next);
        },
      },
      h('option', { value: PROJECT_FILTER_ALL }, t('project.all')),
      h('option', { value: '' }, t('project.none')),
      projects
        .filter((item) => item.name !== '')
        .map((item) =>
          h(
            'option',
            { key: item.name, value: item.name },
            t('project.count', { name: item.name, count: item.count })
          )
        )
    )
  );


  const typeFilterSelect = h(
    'label',
    { className: 'ttl-select' },
    h('span', null, t('type.filterLabel')),
    h(
      'select',
      {
        value: typeFilter === null ? TYPE_FILTER_ALL : typeFilter,
        'aria-label': t('type.filterLabel'),
        onChange: (event) => {
          const next = event.target.value;
          setTypeFilter(next === TYPE_FILTER_ALL ? null : next);
        },
      },
      h('option', { value: TYPE_FILTER_ALL }, t('type.all')),
      h('option', { value: '' }, t('type.none')),
      TYPES.filter((entry) => entry.value !== '').map((entry) =>
        h('option', { key: entry.value, value: entry.value }, t(entry.labelKey))
      )
    )
  );

  const rangeSelect = h(
    'label',
    { className: 'ttl-select' },
    h('span', null, t('gantt.rangeLabel')),
    h(
      'select',
      {
        value: range,
        'aria-label': t('gantt.rangeLabel'),
        onChange: (event) => setRange(event.target.value),
      },
      GANTT_RANGES.map((entry) =>
        h('option', { key: entry.value, value: entry.value }, t(entry.labelKey))
      )
    )
  );

  const boardGroupSelect = h(
    'label',
    { className: 'ttl-select' },
    h('span', null, t('board.groupBy')),
    h(
      'select',
      {
        value: boardGroupBy,
        'aria-label': t('board.groupBy'),
        onChange: (event) => {
          setBoardGroupBy(event.target.value);
          setBoardActionsId(null);
        },
      },
      BOARD_GROUPS.map((entry) =>
        h('option', { key: entry.value, value: entry.value }, t(entry.labelKey))
      )
    )
  );

  const densitySelect = h(
    'label',
    { className: 'ttl-select' },
    h('span', null, t('board.density')),
    h(
      'select',
      {
        value: density,
        'aria-label': t('board.density'),
        onChange: (event) => setDensity(event.target.value),
      },
      BOARD_DENSITIES.map((entry) => h('option', { key: entry.value, value: entry.value }, t(entry.labelKey)))
    )
  );

  const searchInput = h(
    'label',
    { className: 'ttl-search' },
    h('input', {
      ref: searchRef,
      type: 'search',
      value: search,
      placeholder: t('board.searchPlaceholder'),
      'aria-label': t('board.search'),
      'aria-keyshortcuts': '/',
      title: t('board.search'),
      onChange: (event) => setSearch(event.target.value),
      onKeyDown: (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          setSearch('');
        }
      },
    }),
    searchQuery === ''
      ? null
      : h(
          'span',
          { className: 'ttl-search-count', 'aria-live': 'polite' },
          t('board.searchCount', { count: visibleTodos.length })
        )
  );

  const calendarBasisSelect = h(
    'label',
    { className: 'ttl-select' },
    h('span', null, t('calendar.basisLabel')),
    h(
      'select',
      {
        value: calendarBasis,
        'aria-label': t('calendar.basisLabel'),
        onChange: (event) => setCalendarBasis(event.target.value),
      },
      CALENDAR_BASES.map((entry) =>
        h('option', { key: entry.value, value: entry.value }, t(entry.labelKey))
      )
    )
  );

  const calendarNav = h(
    'div',
    { className: 'ttl-group ttl-calendar-nav' },
    h(
      'button',
      {
        type: 'button',
        className: 'ttl-button ttl-button-outline ttl-calendar-nav-button',
        'aria-label': t('calendar.prevMonth'),
        title: t('calendar.prevMonth'),
        onClick: () => shiftCalendarMonth(-1),
      },
      '‹'
    ),
    h(
      'button',
      { type: 'button', className: 'ttl-button ttl-button-outline ttl-calendar-nav-button', onClick: goToToday },
      t('calendar.today')
    ),
    h(
      'button',
      {
        type: 'button',
        className: 'ttl-button ttl-button-outline ttl-calendar-nav-button',
        'aria-label': t('calendar.nextMonth'),
        title: t('calendar.nextMonth'),
        onClick: () => shiftCalendarMonth(1),
      },
      '›'
    )
  );
  return h(
    'div',
    { className: 'ttl-root', 'data-dsh-todo-time-log': 'panel', onKeyDown: handlePanelKeyDown },
    h(StyleSheet),
    // 下载锚点：makeDownload() 生成 blob URL 后由 effect 通过 ref 点击。
    h('a', {
      ref: downloadRef,
      className: 'ttl-download-anchor',
      href: download.url === '' ? undefined : download.url,
      download: download.name === '' ? undefined : download.name,
      'aria-hidden': 'true',
      tabIndex: -1,
    }),
    h(
      'div',
      { className: 'ttl-scroll' },
      h(
        'div',
        { className: 'ttl-page' },
        // 页头：标题是唯一的一级信息，右侧只放一个次要入口。
        h(
          'header',
          { className: 'ttl-heading' },
          h(
            'div',
            { className: 'ttl-heading-text' },
            h('h1', { className: 'ttl-title' }, t('app.title')),
            h('p', { className: 'ttl-subtitle' }, t('app.subtitle', { format: timeFormat }))
          ),
          h(
            'div',
            { className: 'ttl-heading-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'ttl-ghost-button',
                'aria-haspopup': 'dialog',
                'aria-expanded': transferOpen ? 'true' : 'false',
                title: t('transfer.open'),
                onClick: openTransfer,
              },
              h(
                'svg',
                {
                  className: 'ttl-ghost-button-icon',
                  width: 12,
                  height: 12,
                  viewBox: '0 0 16 16',
                  fill: 'none',
                  stroke: 'currentColor',
                  strokeWidth: 1.4,
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                  'aria-hidden': 'true',
                  focusable: 'false',
                },
                h('path', { d: 'M8 2v7m0 0l3-3m-3 3L5 6M3 12v1.5a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5V12' })
              ),
              t('transfer.open')
            )
          )
        ),
        // 捕获区：单条与批量共用同一位置；批量展开时不在列表上方再叠一层。
        chatOpen
          ? h(ChatPanel, {
              id: 'ttl-chat-panel',
              open: true,
              busy: chatBusy,
              messages,
              input: chatInput,
              suggestions: fileSuggestions,
              suggestionsKind: suggestKind,
              workspaces,
              workspace,
              onWorkspaceChange: handleWorkspaceChange,
              suggestionsOpen: suggestOpen && suggestTarget === 'chat',
              suggestionsLoading: suggestLoading,
              suggestionsError: suggestError,
              suggestionsActive: suggestActive,
              onToggle: () => setChatOpen(false),
              onChange: (value, caret) => handleChatInputChange(value, caret),
              onSend: () => {
                void handleChatSend();
              },
              onUndo: (message) => {
                void handleChatUndo(message);
              },
              onSuggestMove: moveFileSuggest,
              onSuggestClose: closeFileSuggest,
              onSuggestSelect: selectSuggestion,
              onCopyFile: copyFilePath,
            })
          : h(
              'form',
              { className: 'ttl-composer', onSubmit: handleCreate, 'aria-label': t('create.aria') },
              h('input', {
                ref: createInputRef,
                className: 'ttl-composer-input',
                type: 'text',
                value: newTitle,
                placeholder: t('create.placeholder'),
                'aria-label': t('create.aria'),
                'aria-keyshortcuts': 'n',
                disabled: creating,
                onChange: (event) => handleCreateTitleChange(event.target.value, event.target.selectionStart),
                onKeyDown: handleCreateKeyDown,
                onBlur: handleCreateBlur,
                onFocus: handleCreateFocus,
              }),
              suggestOpen && suggestTarget === 'create'
                ? h(
                    'div',
                    { className: 'ttl-create-suggest' },
                    h(SuggestionDropdown, {
                      kind: suggestKind,
                      loading: suggestLoading,
                      error: suggestError,
                      suggestions: fileSuggestions,
                      active: suggestActive,
                      onSelect: selectCreateSuggestion,
                    })
                  )
                : null,
              h(ProjectPicker, {
                value: newProject,
                options: projectSuggestions,
                custom: newProjectCustom,
                disabled: creating,
                onChange: (value) => setNewProject(value),
                onCustom: () => setNewProjectCustom(true),
                onBackToList: () => setNewProjectCustom(false),
                onInputKeyDown: (event) => {
                  if (event && event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    setNewProjectCustom(false);
                  }
                },
              }),
              prioritySelectControl(newPriority, setNewPriority, creating),
              typeSelectControl(newType, setNewType, creating),
              h(
                'button',
                {
                  type: 'button',
                  className: 'ttl-ghost-button ttl-composer-batch',
                  title: t('create.batchTitle'),
                  'aria-expanded': 'false',
                  'aria-controls': 'ttl-chat-panel',
                  onClick: () => setChatOpen(true),
                },
                t('create.batch')
              ),
              h(
                'button',
                {
                  type: 'submit',
                  className: 'ttl-button ttl-button-primary',
                  disabled: creating || newTitle.trim() === '',
                },
                creating ? t('create.actionBusy') : t('create.action')
              )
            ),
        // 数据区：视图切换与列表同属一张卡片。
        h(
          'div',
          { className: 'ttl-data' },
          h(
            'div',
            { className: 'ttl-toolbar' },
            // 第一行固定：视图切换 + 搜索。切视图时控件位置不变。
            h(
              'div',
              { className: 'ttl-toolbar-row' },
              h('div', { className: 'ttl-group' }, viewToggle),
              h(
                'div',
                { className: 'ttl-group' },
                searchInput,
                h(
                  'span',
                  { className: 'ttl-refreshing', 'aria-live': 'polite' },
                  refreshing && listStatus !== 'loading' ? t('list.refreshing') : ''
                )
              )
            ),
            // 第二行：左侧是当前视图专属控件，右侧始终是分类 / 类型筛选。
            h(
              'div',
              { className: 'ttl-toolbar-row' },
              h(
                'div',
                { className: 'ttl-group' },
                view === 'table'
                  ? filterTabs
                  : view === 'board'
                    ? h(React.Fragment, null, boardGroupSelect, densitySelect, filterTabs)
                    : view === 'gantt'
                      ? rangeSelect
                      : h(React.Fragment, null, calendarBasisSelect, calendarNav)
              ),
              h('div', { className: 'ttl-group' }, projectFilterSelect, typeFilterSelect)
            )
          ),
          h('div', { className: 'ttl-list' }, listBody)
        )
      )
    ),
    // 瞬时提示：绝对定位浮层，出现/消失都不改变布局高度。
    h(
      'div',
      { className: 'ttl-toast-host', 'aria-live': 'polite', 'aria-atomic': 'false' },
      notice === null
        ? null
        : h(
            'div',
            { key: notice.id, className: 'ttl-toast', role: notice.kind === 'error' ? 'alert' : 'status' },
            h(
              'span',
              { className: 'ttl-toast-icon', 'data-kind': notice.kind, 'aria-hidden': 'true' },
              h(ToastIcon, { kind: notice.kind })
            ),
            h('span', { className: 'ttl-toast-text' }, notice.text),
            notice.undo
              ? h(
                  'button',
                  { type: 'button', className: 'ttl-toast-action', onClick: notice.undo.onClick },
                  t('toast.undo')
                )
              : null,
            h(
              'button',
              {
                type: 'button',
                className: 'ttl-toast-close',
                'aria-label': t('toast.dismiss'),
                title: t('toast.dismiss'),
                onClick: dismissNotice,
              },
              '×'
            )
          )
    ),
    h(TransferDialog, {
      open: transferOpen,
      busy: transferBusy,
      applying: transferApplying,
      // 有文件 / 预览 / 改动过策略时，遮罩与 Esc 不再直接关闭（防误丢导入内容）。
      dirty: transferFileName !== '' || transferContent !== '' || transferPreview !== null,
      fileName: transferFileName,
      mode: transferMode,
      preview: transferPreview,
      error: transferError,
      fileInputRef: transferInputRef,
      onClose: closeTransfer,
      onExport: handleExport,
      onPickFile: handlePickFile,
      onFileChange: handleImportFileChange,
      onModeChange: handleTransferModeChange,
      onConfirm: handleImportConfirm,
    })
  );
}

export function createPanel() {
  /** 错误边界：面板内部任何渲染异常都降级成可读文案，而不是让槽位崩溃。 */
  class PanelBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { failed: false, message: '' };
    }

    static getDerivedStateFromError(error) {
      return { failed: true, message: messageOf(error) };
    }

    componentDidCatch(error) {
      if (typeof console !== 'undefined' && typeof console.error === 'function') {
        console.error('[dsh-todo-time-log] panel crashed:', error);
      }
    }

    render() {
      if (!this.state.failed) return this.props.children;
      return h(
        'div',
        { className: 'ttl-root', 'data-dsh-todo-time-log': 'error' },
        h(StyleSheet),
        h(
          'div',
          { className: 'ttl-scroll' },
          h(
            'div',
            { className: 'ttl-page' },
            h(
              'div',
              { className: 'ttl-placeholder ttl-placeholder-error', role: 'alert' },
              h('p', { className: 'ttl-placeholder-title' }, t('error.panel')),
              h('p', { className: 'ttl-placeholder-hint' }, t('error.panelHint')),
              this.state.message !== ''
                ? h('p', { className: 'ttl-error-detail' }, t('error.detail', { message: this.state.message }))
                : null
            )
          )
        )
      );
    }
  }

  /** main 槽组件：错误边界 + 面板。 */
  function Panel() {
    return h(PanelBoundary, null, h(TodoPanel));
  }

  return Panel;
}
