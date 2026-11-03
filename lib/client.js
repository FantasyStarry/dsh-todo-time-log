/**
 * 「待办时间日志」 (dsh-todo-time-log) — Web 端 UI。
 *
 * 浏览器模块表格式：由 Harness Web 的模块加载器按需执行本懒工厂。
 * 只依赖模块表里的 `react`，没有 JSX / 构建步骤 / 其它运行时依赖。
 *
 * 所有数据都走 Host HTTP 接口（前缀 api/dsh-todo-time-log，全部 POST + JSON）：
 *   请求：{ filter?, sortBy?, direction? } 等
 *   成功：{ ok: true, value: ... }
 *   失败：{ ok: false, error: { code, message } }
 *
 * 面板注册：
 *   - main 槽（keyed 槽，key = 'dsh-todo-time-log'）→ Panel
 *   - sidebar.panellist 槽（id = 'dsh-todo-time-log'）→ Icon
 *   点击侧边栏图标后，宿主布局用该 id 作为 main 槽的 key 打开面板。
 */
window.__ModuleLoader__.load({
  id: 'dsh-todo-time-log',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    //#region i18n
    /** 全部可见文案集中在此。zh 为默认，en 为兜底；缺失的 key 原样显示。 */
    const I18N = {
      zh: {
        'app.title': '待办时间日志',
        'app.subtitle': '本地时间 {format} · 自动记录创建与完成时间',
        'create.aria': '新建待办',
        'create.placeholder': '输入待办；可写 #分类 @文件，Enter 创建',
        'create.action': '添加',
        'create.actionBusy': '添加中…',
        'filter.label': '筛选',
        'filter.all': '全部',
        'filter.pending': '未完成',
        'filter.completed': '已完成',
        'sort.label': '排序',
        'sort.createdAt': '创建时间',
        'sort.completedAt': '完成时间',
        'direction.asc': '升序',
        'direction.desc': '降序',
        'direction.toggleAria': '切换排序方向（当前：{direction}）',
        'list.loading': '加载中…',
        'list.refreshing': '更新中…',
        'list.error': '加载失败',
        'list.retry': '重试',
        'list.empty': '还没有待办',
        'list.emptyHint': '在上方输入内容来创建第一条待办。',
        'list.emptyAction': '新建第一条待办',
        'list.clearFilterAction': '查看全部待办',
        'list.emptyPending': '没有未完成的待办',
        'list.emptyPendingHint': '所有待办都已完成，保持这个状态。',
        'list.emptyCompleted': '还没有已完成的待办',
        'list.emptyCompletedHint': '完成一条待办后，这里会记录完成时间。',
        'list.created': '创建',
        'list.completed': '完成',
        'row.pending': '未完成',
        'row.completed': '已完成',
        'row.complete': '完成',
        'row.uncomplete': '取消完成',
        'row.edit': '编辑',
        'row.delete': '删除',
        'row.confirmDelete': '确认删除',
        'row.confirmDeleteAria': '确认删除待办：{title}',
        'row.cancel': '取消',
        'row.save': '保存',
        'row.editAria': '编辑待办标题',
        'row.editInputAria': '待办标题',
        'row.toggleAria': '{action}待办：{title}',
        'detail.aria': '待办详情',
        'detail.expand': '展开详情',
        'detail.collapse': '收起详情',
        'detail.toggleAria': '{action}：{title}',
        'detail.status': '状态',
        'detail.created': '创建时间',
        'detail.completed': '完成时间',
        'detail.updated': '更新时间',
        'detail.duration': '用时',
        'detail.id': 'ID',
        'detail.durationSeconds': '{n} 秒',
        'detail.durationMinutes': '{n} 分钟',
        'detail.durationHours': '{h} 小时',
        'detail.durationHoursMinutes': '{h} 小时 {m} 分钟',
        'detail.durationDays': '{d} 天',
        'detail.durationDaysHours': '{d} 天 {h} 小时',
        'detail.project': '分类',
        'detail.files': '文件',
        'project.all': '全部分类',
        'project.none': '未分类',
        'project.label': '分类',
        'project.filterLabel': '分类筛选',
        'project.count': '{name}（{count}）',
        'projects.custom': '自定义…',
        'projects.backToList': '返回列表',
        'projects.customPlaceholder': '自定义分类（0-40 字符）',
        'projects.groupUsed': '已用',
        'projects.groupWorkspace': '工作区',
        'projects.groupFolder': '文件夹',
        'projects.countOption': '{name}（{count}）',
        'group.header': '{project} · {count} 条',
        'sort.updatedAt': '更新时间',
        'sort.project': '分类',
        'sort.priority': '优先级',
        'priority.label': '优先级',
        'priority.none': '未设置',
        'priority.high': '高',
        'priority.medium': '中',
        'priority.low': '低',
        'priority.updated': '已更新优先级',
        'type.label': '类型',
        'type.all': '全部类型',
        'type.none': '未设置',
        'type.bug': '缺陷',
        'type.feature': '新功能',
        'type.improvement': '改进',
        'type.question': '疑问',
        'type.chore': '杂项',
        'type.other': '其他',
        'type.updated': '已更新类型',
        'type.filterLabel': '类型筛选',
        'view.aria': '视图切换',
        'view.table': '表格',
        'view.board': '看板',
        'view.gantt': '甘特图',
        'view.calendar': '日历',
        'gantt.aria': '甘特图：按分类分组的待办时间线',
        'gantt.axis': '时间轴',
        'gantt.now': '现在',
        'gantt.ongoing': '进行中',
        'gantt.rangeLabel': '范围',
        'gantt.rangeAll': '全部',
        'gantt.range7d': '近 7 天',
        'gantt.range30d': '近 30 天',
        'gantt.empty': '当前范围内没有可展示的待办',
        'gantt.emptyHint': '调整范围或分类筛选，或者先添加一条待办。',
        'gantt.barAria': '分类 {project}，标题 {title}，创建 {start}，{end}',
        'gantt.barEndCompleted': '完成 {time}',
        'table.title': '标题',
        'table.project': '分类',
        'table.status': '状态',
        'table.createdAt': '创建时间',
        'table.completedAt': '完成时间',
        'table.actions': '操作',
        'table.detail': '详情',
        'table.sortAria': '按 {column} 排序',
        'table.sortTitle': '点击切换排序字段与方向',
        'table.aria': '待办表格',
        'board.groupBy': '分组',
        'board.groupStatus': '状态',
        'board.groupProject': '分类',
        'board.empty': '当前筛选下没有待办',
        'board.aria': '待办看板',
        'board.columnAria': '「{name}」列，共 {count} 条待办',
        'board.columnBodyAria': '「{name}」列内容，共 {count} 条',
        'board.addToColumn': '在「{name}」列新建待办',
        'board.more': '更多操作',
        'board.moreAria': '「{title}」的更多操作',
        'board.checkAria': '待办：{title}',
        'board.untitled': '无标题',
        'board.elapsed': '已进行 {duration}',
        'board.spent': '用时 {duration}',
        'board.elapsedAria': '创建于 {created}，已进行 {duration}',
        'board.spentAria': '创建于 {created}，完成于 {completed}，用时 {duration}',
        'board.deleteConfirm': '删除后无法恢复。',
        'board.showAll': '显示全部（{count}）',
        'board.showRecent': '只看最近 {count} 条',
        'board.emptyColumnPending': '暂无未完成待办',
        'board.emptyColumnCompleted': '还没有已完成待办',
        'board.emptyColumnProject': '这个分类下没有待办',
        'board.emptyColumnFiltered': '没有符合筛选的待办',
        'board.search': '搜索待办',
        'board.searchPlaceholder': '搜索标题 / 分类 / 文件',
        'board.searchCount': '{count} 条匹配',
        'board.searchEmpty': '没有匹配「{query}」的待办',
        'board.searchEmptyHint': '换一个关键词，或清除搜索查看全部。',
        'board.searchClear': '清除搜索',
        'board.groupStatusProject': '状态 × 分类',
        'board.moveToProject': '移到分类',
        'board.moveToPlaceholder': '移到分类…',
        'board.moved': '已移到「{project}」',
        'board.addToLane': '在「{project}」泳道新建待办',
        'board.laneToggleAria': '{action}「{name}」泳道',
        'board.laneAria': '「{name}」泳道，共 {count} 条',
        'board.density': '密度',
        'board.densityComfortable': '舒适',
        'board.densityCompact': '紧凑',
        'board.durLessMinute': '不到 1 分',
        'board.durMinutes': '{n} 分',
        'board.durHours': '{h} 小时',
        'board.durHoursMinutes': '{h} 时 {m} 分',
        'board.durDays': '{d} 天',
        'board.durDaysHours': '{d} 天 {h} 时',
        'calendar.basisLabel': '落格依据',
        'calendar.basisCreated': '按创建时间',
        'calendar.basisCompleted': '按完成时间',
        'calendar.prevMonth': '上一月',
        'calendar.nextMonth': '下一月',
        'calendar.today': '今天',
        'calendar.aria': '待办日历',
        'calendar.monthTitle': '{year} 年 {month} 月',
        'calendar.weekdayMon': '一',
        'calendar.weekdayTue': '二',
        'calendar.weekdayWed': '三',
        'calendar.weekdayThu': '四',
        'calendar.weekdayFri': '五',
        'calendar.weekdaySat': '六',
        'calendar.weekdaySun': '日',
        'calendar.dayAria': '{date}，{count} 条待办',
        'calendar.more': '+{count}',
        'calendar.dayTitle': '{date} 的待办（{count}）',
        'calendar.dayEmpty': '当天没有待办',
        'calendar.monthEmpty': '本月暂无待办',
        'calendar.empty': '当前筛选下没有可展示的待办',
        'chat.title': '对话录入',
        'chat.ariaLabel': '对话录入面板',
        'chat.logAria': '对话记录',
        'chat.workspaceLabel': '工作区',
        'chat.workspaceAria': '选择对话录入使用的工作区',
        'chat.projectsAria': '分类补全',
        'chat.projectsLoading': '正在加载分类建议…',
        'chat.projectsEmpty': '没有匹配的分类',
        'chat.projectsError': '分类建议加载失败',
        'command.groupTodoProjects': '待办分类',
        'command.groupTodoPriorities': '待办优先级',
        'command.groupTodoTypes': '待办类型',
        'command.sourceMarker': '插入 {marker}',
        'command.sourceUsed': '已用 {count} 次',
        'command.sourceWorkspace': '工作区',
        'chat.expand': '展开对话录入',
        'chat.collapse': '收起对话录入',
        'chat.welcome': '用一句话快速添加待办（解析在 Host 完成）。\n支持多条（换行或「；」分隔），可用 #项目、@项目、[项目]、项目：名称 指定分类。\n直接说：新任务 写周报 #工作 @src/a.ts\n@ 引用工作区文件，会自动把项目设为该文件所在目录。\n也可以在主输入框用 /todo 命令，或让我调用 todo_time_log 工具。',
        'chat.placeholder': '输入待办，Enter 发送，Shift+Enter 换行；@ 引用工作区文件',
        'chat.send': '发送',
        'chat.sending': '录入中…',
        'chat.noInput': '没有识别到可录入的待办。\n示例：新任务 写周报 #工作 @src/a.ts；新任务 买牛奶',
        'chat.success': '成功添加 {count} 条待办：',
        'chat.successLine': '[{project}] {title} · 创建 {time}',
        'chat.quickAddFailed': '对话录入失败：{message}',
        'chat.skippedHeader': '跳过 {count} 条：',
        'chat.skippedLine': '{line}（{reason}）',
        'chat.errorsHeader': '失败 {count} 条：',
        'chat.errorsLine': '{title}：{code} {message}',
        'chat.filesLoading': '正在搜索工作区文件…',
        'chat.filesEmpty': '没有匹配的文件',
        'chat.filesError': '文件搜索失败',
        'chat.filesAria': '工作区文件补全',
        'chat.filesHint': '↑↓ 选择 · Enter/Tab 插入 · Esc 关闭',
        'chat.undo': '撤销',
        'chat.undoAria': '撤销本次添加的 {count} 条待办',
        'chat.undoRetry': '重试撤销',
        'chat.undoRetryAria': '重试撤销剩余的 {count} 条待办',
        'chat.undone': '已撤销 {count} 条。',
        'chat.undonePartial': '已撤销 {removed} 条，{failed} 条失败：{detail}',
        'files.aria': '文件引用',
        'files.more': '+{count}',
        'files.copyTitle': '复制路径：{path}',
        'files.copied': '已复制路径：{path}',
        'notice.titleRequired': '待办标题不能为空。',
        'notice.projectTooLong': '分类不能超过 40 个字符。',
        'notice.created': '已创建待办。',
        'notice.updated': '已更新待办。',
        'notice.deleted': '已删除待办。',
        'notice.completed': '已标记为完成。',
        'notice.uncompleted': '已取消完成。',
        'notice.quickAddCreated': '已添加 {count} 条待办',
        'notice.quickAddSkipped': '跳过「{line}」：{reason}',
        'notice.quickAddError': '「{title}」：{message}',
        'notice.quickAddEmpty': '没有识别到可录入的待办',
        'notice.join': '；',
        'notice.unknownError': '请求失败，请稍后重试。',
        'notice.networkError': '网络请求失败：{message}',
        'notice.invalidResponse': '服务器返回了无法解析的数据。',
        'notice.httpError': '请求失败（HTTP {status}）。',
        'notice.serverError': '服务器返回了错误。',
        'toast.undo': '撤销',
        'toast.dismiss': '关闭提示',
        'error.panel': '待办时间日志面板出现异常',
        'error.panelHint': '请关闭后重新打开面板；如果问题持续存在，请检查插件日志。',
        'error.detail': '详情：{message}',
      },
      en: {
        'app.title': 'Todo Time Log',
        'app.subtitle': 'Local time {format} · records created and completed timestamps',
        'create.aria': 'New todo',
        'create.placeholder': 'Type a todo; #project @file supported, Enter to create',
        'create.action': 'Add',
        'create.actionBusy': 'Adding…',
        'filter.label': 'Filter',
        'filter.all': 'All',
        'filter.pending': 'Pending',
        'filter.completed': 'Completed',
        'sort.label': 'Sort',
        'sort.createdAt': 'Created',
        'sort.completedAt': 'Completed',
        'direction.asc': 'Ascending',
        'direction.desc': 'Descending',
        'direction.toggleAria': 'Switch sort direction (currently {direction})',
        'list.loading': 'Loading…',
        'list.refreshing': 'Refreshing…',
        'list.error': 'Failed to load',
        'list.retry': 'Retry',
        'list.empty': 'No todos yet',
        'list.emptyHint': 'Create your first todo in the field above.',
        'list.emptyAction': 'Create the first todo',
        'list.clearFilterAction': 'Show all todos',
        'list.emptyPending': 'No pending todos',
        'list.emptyPendingHint': 'Everything is done. Nice.',
        'list.emptyCompleted': 'No completed todos yet',
        'list.emptyCompletedHint': 'Completion time is recorded once you finish one.',
        'list.created': 'Created',
        'list.completed': 'Completed',
        'row.pending': 'Pending',
        'row.completed': 'Completed',
        'row.complete': 'Complete',
        'row.uncomplete': 'Mark pending',
        'row.edit': 'Edit',
        'row.delete': 'Delete',
        'row.confirmDelete': 'Delete now',
        'row.confirmDeleteAria': 'Confirm deleting todo: {title}',
        'row.cancel': 'Cancel',
        'row.save': 'Save',
        'row.editAria': 'Edit todo title',
        'row.editInputAria': 'Todo title',
        'row.toggleAria': '{action} todo: {title}',
        'detail.aria': 'Todo details',
        'detail.expand': 'Expand details',
        'detail.collapse': 'Collapse details',
        'detail.toggleAria': '{action}: {title}',
        'detail.status': 'Status',
        'detail.created': 'Created',
        'detail.completed': 'Completed',
        'detail.updated': 'Updated',
        'detail.duration': 'Duration',
        'detail.id': 'ID',
        'detail.durationSeconds': '{n} sec',
        'detail.durationMinutes': '{n} min',
        'detail.durationHours': '{h} h',
        'detail.durationHoursMinutes': '{h} h {m} min',
        'detail.durationDays': '{d} d',
        'detail.durationDaysHours': '{d} d {h} h',
        'detail.project': 'Project',
        'detail.files': 'Files',
        'project.all': 'All projects',
        'project.none': 'Uncategorized',
        'project.label': 'Project',
        'project.filterLabel': 'Filter by project',
        'project.count': '{name} ({count})',
        'projects.custom': 'Custom…',
        'projects.backToList': 'Back to list',
        'projects.customPlaceholder': 'Custom project (0-40 chars)',
        'projects.groupUsed': 'Used',
        'projects.groupWorkspace': 'Workspaces',
        'projects.groupFolder': 'Folders',
        'projects.countOption': '{name} ({count})',
        'group.header': '{project} · {count} item(s)',
        'sort.updatedAt': 'Updated',
        'sort.project': 'Project',
        'sort.priority': 'Priority',
        'priority.label': 'Priority',
        'priority.none': 'None',
        'priority.high': 'High',
        'priority.medium': 'Medium',
        'priority.low': 'Low',
        'priority.updated': 'Priority updated',
        'type.label': 'Type',
        'type.all': 'All types',
        'type.none': 'None',
        'type.bug': 'Bug',
        'type.feature': 'Feature',
        'type.improvement': 'Improvement',
        'type.question': 'Question',
        'type.chore': 'Chore',
        'type.other': 'Other',
        'type.updated': 'Type updated',
        'type.filterLabel': 'Type filter',
        'view.aria': 'View switch',
        'view.table': 'Table',
        'view.board': 'Board',
        'view.gantt': 'Gantt',
        'view.calendar': 'Calendar',
        'gantt.aria': 'Gantt chart: todo timeline grouped by project',
        'gantt.axis': 'Timeline',
        'gantt.now': 'Now',
        'gantt.ongoing': 'In progress',
        'gantt.rangeLabel': 'Range',
        'gantt.rangeAll': 'All',
        'gantt.range7d': 'Last 7 days',
        'gantt.range30d': 'Last 30 days',
        'gantt.empty': 'No todos in this range',
        'gantt.emptyHint': 'Adjust the range or project filter, or add a todo first.',
        'gantt.barAria': 'Project {project}, title {title}, created {start}, {end}',
        'gantt.barEndCompleted': 'completed {time}',
        'table.title': 'Title',
        'table.project': 'Project',
        'table.status': 'Status',
        'table.createdAt': 'Created',
        'table.completedAt': 'Completed',
        'table.actions': 'Actions',
        'table.detail': 'Details',
        'table.sortAria': 'Sort by {column}',
        'table.sortTitle': 'Click to switch sort field and direction',
        'table.aria': 'Todo table',
        'board.groupBy': 'Group by',
        'board.groupStatus': 'Status',
        'board.groupProject': 'Project',
        'board.empty': 'No todos under the current filter',
        'board.aria': 'Todo board',
        'board.columnAria': '{name} column, {count} items',
        'board.columnBodyAria': '{name} column content, {count} items',
        'board.addToColumn': 'Add a todo to {name}',
        'board.more': 'More actions',
        'board.moreAria': 'More actions for {title}',
        'board.checkAria': 'Todo: {title}',
        'board.untitled': 'Untitled',
        'board.elapsed': 'Open {duration}',
        'board.spent': 'Took {duration}',
        'board.elapsedAria': 'Created {created}, open for {duration}',
        'board.spentAria': 'Created {created}, completed {completed}, took {duration}',
        'board.deleteConfirm': 'This cannot be undone.',
        'board.showAll': 'Show all ({count})',
        'board.showRecent': 'Show latest {count}',
        'board.emptyColumnPending': 'No open todos',
        'board.emptyColumnCompleted': 'No completed todos yet',
        'board.emptyColumnProject': 'No todos in this project',
        'board.emptyColumnFiltered': 'No todos match the filter',
        'board.search': 'Search todos',
        'board.searchPlaceholder': 'Search title, project, or file',
        'board.searchCount': '{count} matches',
        'board.searchEmpty': 'No todos match “{query}”',
        'board.searchEmptyHint': 'Try another keyword, or clear the search.',
        'board.searchClear': 'Clear search',
        'board.groupStatusProject': 'Status × project',
        'board.moveToProject': 'Move to project',
        'board.moveToPlaceholder': 'Move to project…',
        'board.moved': 'Moved to {project}',
        'board.addToLane': 'Add a todo to {project}',
        'board.laneToggleAria': '{action} {name} lane',
        'board.laneAria': '{name} lane, {count} items',
        'board.density': 'Density',
        'board.densityComfortable': 'Comfortable',
        'board.densityCompact': 'Compact',
        'board.durLessMinute': '<1 min',
        'board.durMinutes': '{n} min',
        'board.durHours': '{h} h',
        'board.durHoursMinutes': '{h} h {m} m',
        'board.durDays': '{d} d',
        'board.durDaysHours': '{d} d {h} h',
        'calendar.basisLabel': 'Date basis',
        'calendar.basisCreated': 'By created',
        'calendar.basisCompleted': 'By completed',
        'calendar.prevMonth': 'Previous month',
        'calendar.nextMonth': 'Next month',
        'calendar.today': 'Today',
        'calendar.aria': 'Todo calendar',
        'calendar.monthTitle': '{month}/{year}',
        'calendar.weekdayMon': 'Mon',
        'calendar.weekdayTue': 'Tue',
        'calendar.weekdayWed': 'Wed',
        'calendar.weekdayThu': 'Thu',
        'calendar.weekdayFri': 'Fri',
        'calendar.weekdaySat': 'Sat',
        'calendar.weekdaySun': 'Sun',
        'calendar.dayAria': '{date}, {count} todo(s)',
        'calendar.more': '+{count}',
        'calendar.dayTitle': 'Todos on {date} ({count})',
        'calendar.dayEmpty': 'No todos on this day',
        'calendar.monthEmpty': 'No todos this month',
        'calendar.empty': 'No todos under the current filter',
        'chat.title': 'Conversational entry',
        'chat.ariaLabel': 'Conversational entry panel',
        'chat.logAria': 'Conversation',
        'chat.workspaceLabel': 'Workspace',
        'chat.workspaceAria': 'Choose the workspace used for conversational entry',
        'chat.projectsAria': 'Project suggestions',
        'chat.projectsLoading': 'Loading project suggestions…',
        'chat.projectsEmpty': 'No matching projects',
        'chat.projectsError': 'Project suggestions failed',
        'command.groupTodoProjects': 'Todo projects',
        'command.groupTodoPriorities': 'Todo priorities',
        'command.groupTodoTypes': 'Todo types',
        'command.sourceMarker': 'Insert {marker}',
        'command.sourceUsed': 'Used {count} time(s)',
        'command.sourceWorkspace': 'Workspace',
        'chat.expand': 'Expand conversational entry',
        'chat.collapse': 'Collapse conversational entry',
        'chat.welcome': 'Add todos in one sentence (parsing happens on the Host).\nMultiple entries are supported (newline or ";"); #project, @project, [project], project: name set the category.\nSay: new task write report #work @src/a.ts\nAn @ file reference also derives the project from the file directory.\nYou can also use the /todo command in the main composer, or ask the agent to call todo_time_log.',
        'chat.placeholder': 'Type a todo; Enter to send, Shift+Enter for newline; @ references workspace files',
        'chat.send': 'Send',
        'chat.sending': 'Adding…',
        'chat.noInput': 'No todo recognized.\nExample: new task write report #work @src/a.ts; new task buy milk',
        'chat.success': 'Added {count} todo(s):',
        'chat.successLine': '[{project}] {title} · created {time}',
        'chat.quickAddFailed': 'Conversational entry failed: {message}',
        'chat.skippedHeader': 'Skipped {count}:',
        'chat.skippedLine': '{line} ({reason})',
        'chat.errorsHeader': 'Failed {count}:',
        'chat.errorsLine': '{title}: {code} {message}',
        'chat.filesLoading': 'Searching workspace files…',
        'chat.filesEmpty': 'No matching files',
        'chat.filesError': 'File search failed',
        'chat.filesAria': 'Workspace file suggestions',
        'chat.filesHint': '↑↓ select · Enter/Tab insert · Esc close',
        'chat.undo': 'Undo',
        'chat.undoAria': 'Undo the {count} todo(s) just added',
        'chat.undoRetry': 'Retry undo',
        'chat.undoRetryAria': 'Retry undoing the remaining {count} todo(s)',
        'chat.undone': 'Undid {count}.',
        'chat.undonePartial': 'Undid {removed}, {failed} failed: {detail}',
        'files.aria': 'File references',
        'files.more': '+{count}',
        'files.copyTitle': 'Copy path: {path}',
        'files.copied': 'Copied path: {path}',
        'notice.titleRequired': 'A todo title is required.',
        'notice.projectTooLong': 'A project name cannot exceed 40 characters.',
        'notice.created': 'Todo created.',
        'notice.updated': 'Todo updated.',
        'notice.deleted': 'Todo deleted.',
        'notice.completed': 'Marked as completed.',
        'notice.uncompleted': 'Marked as pending.',
        'notice.quickAddCreated': 'Added {count} todo(s)',
        'notice.quickAddSkipped': 'Skipped "{line}": {reason}',
        'notice.quickAddError': '"{title}": {message}',
        'notice.quickAddEmpty': 'No todo recognized',
        'notice.join': '; ',
        'notice.unknownError': 'The request failed. Please try again later.',
        'notice.networkError': 'Network request failed: {message}',
        'notice.invalidResponse': 'The server returned an unreadable response.',
        'notice.httpError': 'Request failed (HTTP {status}).',
        'notice.serverError': 'The server returned an error.',
        'toast.undo': 'Undo',
        'toast.dismiss': 'Dismiss message',
        'error.panel': 'The todo time log panel crashed',
        'error.panelHint': 'Close and reopen the panel; check the plugin logs if it keeps happening.',
        'error.detail': 'Details: {message}',
      },
    };

    const DEFAULT_LOCALE = 'zh';

    /**
     * 极简翻译：默认 zh，en 兜底，最后原样返回 key。
     * @param {string} key - 字典键。
     * @param {object} [vars] - `{name}` 占位符替换值。
     * @returns {string} 文案。
     */
    function t(key, vars) {
      const primary = I18N[DEFAULT_LOCALE] || {};
      const fallback = I18N.en || {};
      let template = primary[key];
      if (typeof template !== 'string') template = fallback[key];
      if (typeof template !== 'string') template = key;
      if (!vars) return template;
      return template.replace(/\{(\w+)\}/g, (match, name) => {
        const value = vars[name];
        return value === undefined || value === null ? match : String(value);
      });
    }
    //#endregion

    //#region 基础工具
    /** Host 接口前缀（统一在前面补成绝对路径，避免 SPA 子路由把相对路径解析错）。 */
    const API_PREFIX = 'api/dsh-todo-time-log';
    const TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
    const EMPTY_TIME = '-';

    /** 补零。 */
    function pad2(value) {
      return value < 10 ? `0${value}` : String(value);
    }

    /** 任意时间值 → 毫秒；空值 / 非法值返回 null。 */
    function toMillis(value) {
      if (value === null || value === undefined || value === '') return null;
      let ms;
      if (typeof value === 'number') ms = value;
      else if (typeof value === 'string') ms = Date.parse(value);
      else if (value instanceof Date) ms = value.getTime();
      else return null;
      if (!Number.isFinite(ms)) return null;
      const date = new Date(ms);
      return Number.isNaN(date.getTime()) ? null : ms;
    }

    /** 本地时间 YYYY-MM-DD HH:mm:ss；null / 非法值显示 '-'。 */
    function formatTime(value) {
      const ms = toMillis(value);
      if (ms === null) return EMPTY_TIME;
      const date = new Date(ms);
      return (
        `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ` +
        `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
      );
    }

    /** 人类可读用时；仅当创建时间与完成时间都可解析时返回时长，否则 '-'。 */
    function formatDuration(createdAt, completedAt) {
      const start = toMillis(createdAt);
      const end = toMillis(completedAt);
      if (start === null || end === null) return EMPTY_TIME;
      const seconds = Math.max(0, Math.round((end - start) / 1000));
      if (seconds < 60) return t('detail.durationSeconds', { n: seconds });
      if (seconds < 3600) return t('detail.durationMinutes', { n: Math.floor(seconds / 60) });
      if (seconds < 86400) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return minutes > 0
          ? t('detail.durationHoursMinutes', { h: hours, m: minutes })
          : t('detail.durationHours', { h: hours });
      }
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      return hours > 0
        ? t('detail.durationDaysHours', { d: days, h: hours })
        : t('detail.durationDays', { d: days });
    }

    /** 卡片用的短时长（比详情里的「1 小时 45 分钟」更紧凑）；无法解析返回 '-'。 */
    function formatDurationShort(createdAt, completedAt) {
      const start = toMillis(createdAt);
      const end = toMillis(completedAt);
      if (start === null || end === null) return EMPTY_TIME;
      const seconds = Math.max(0, Math.round((end - start) / 1000));
      if (seconds < 60) return t('board.durLessMinute');
      if (seconds < 3600) return t('board.durMinutes', { n: Math.floor(seconds / 60) });
      if (seconds < 86400) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return minutes > 0 ? t('board.durHoursMinutes', { h: hours, m: minutes }) : t('board.durHours', { h: hours });
      }
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      return hours > 0 ? t('board.durDaysHours', { d: days, h: hours }) : t('board.durDays', { d: days });
    }

    /** 搜索归一化：去首尾空白并转小写；非字符串返回空串。 */
    function normalizeSearch(value) {
      return typeof value === 'string' ? value.trim().toLowerCase() : '';
    }

    /** 客户端搜索匹配：标题 / 分类 / 文件路径（大小写不敏感）。 */
    function todoMatchesSearch(todo, query) {
      if (query === '') return true;
      if (!isRecord(todo)) return false;
      const parts = [typeof todo.title === 'string' ? todo.title : '', projectLabel(normalizeProject(todo.project))];
      const type = normalizeType(todo.type);
      if (type !== '') parts.push(t(`type.${type}`));
      const priority = normalizePriority(todo.priority);
      if (priority !== '') parts.push(t(`priority.${priority}`));
      for (const file of normalizeFiles(todo.files)) parts.push(file);
      return parts.join('\n').toLowerCase().includes(query);
    }

    /** 构造带 code 的 Error，供提示条读取 message。 */
    function apiError(code, message) {
      const error = new Error(message);
      error.code = code;
      return error;
    }

    /** 安全读取 error.message。 */
    function messageOf(error) {
      if (error && typeof error.message === 'string' && error.message !== '') return error.message;
      if (typeof error === 'string' && error !== '') return error;
      return t('notice.unknownError');
    }

    function isRecord(value) {
      return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    function toCount(value, fallback) {
      const number = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(number) || number < 0) return fallback;
      return Math.floor(number);
    }

    function apiUrl(path) {
      const suffix = path.charAt(0) === '/' ? path : `/${path}`;
      return `/${API_PREFIX}${suffix}`;
    }

    /**
     * 统一的 HTTP 调用：POST + JSON。
     * 处理网络错误、非 2xx、非 JSON 响应与 `{ok:false}` 业务错误，
     * 全部抛出带可读 message 的 Error。
     * @param {string} path - 接口路径，如 '/list'。
     * @param {object} [body] - 请求体。
     * @returns {Promise<any>} 响应里的 value。
     */
    async function request(path, body) {
      const url = apiUrl(path);
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify(body === undefined ? {} : body),
        });
      } catch (cause) {
        throw apiError('network_error', t('notice.networkError', { message: messageOf(cause) }));
      }

      const status = response && typeof response.status === 'number' ? response.status : 0;
      const ok = Boolean(response && response.ok);
      let payload = null;
      let parseFailed = false;
      try {
        payload = await response.json();
      } catch (cause) {
        parseFailed = true;
      }

      if (!ok) {
        const serverError = isRecord(payload) ? payload.error : null;
        const code = isRecord(serverError) && typeof serverError.code === 'string' ? serverError.code : `http_${status}`;
        const message =
          isRecord(serverError) && typeof serverError.message === 'string' && serverError.message !== ''
            ? serverError.message
            : t('notice.httpError', { status });
        throw apiError(code, message);
      }

      if (parseFailed || !isRecord(payload)) {
        throw apiError('invalid_response', t('notice.invalidResponse'));
      }

      if (payload.ok !== true) {
        const serverError = isRecord(payload.error) ? payload.error : null;
        const code = serverError && typeof serverError.code === 'string' ? serverError.code : 'unknown_error';
        const message =
          serverError && typeof serverError.message === 'string' && serverError.message !== ''
            ? serverError.message
            : t('notice.serverError');
        throw apiError(code, message);
      }

      return payload.value;
    }

    /** 把接口返回的待办规整成稳定结构；无法识别的条目返回 null。 */
    function normalizeTodo(raw) {
      if (!isRecord(raw)) return null;
      const rawId = raw.id;
      if (rawId === null || rawId === undefined || String(rawId) === '') return null;
      const status = raw.status === 'completed' ? 'completed' : 'pending';
      const title = typeof raw.title === 'string' ? raw.title : raw.title === null || raw.title === undefined ? '' : String(raw.title);
      return {
        id: String(rawId),
        title,
        project: normalizeProject(raw.project),
        files: normalizeFiles(raw.files),
        priority: normalizePriority(raw.priority),
        type: normalizeType(raw.type),
        status,
        createdAt: raw.createdAt === undefined ? null : raw.createdAt,
        completedAt: raw.completedAt === undefined ? null : raw.completedAt,
        updatedAt: raw.updatedAt === undefined ? null : raw.updatedAt,
      };
    }

    /** 文件路径规整：只保留非空字符串、去重、最多 20 个（与 Host 上限一致）。 */
    function normalizeFiles(raw) {
      if (!Array.isArray(raw)) return [];
      const result = [];
      const seen = new Set();
      for (const item of raw) {
        if (typeof item !== 'string') continue;
        const path = item.trim();
        if (path === '' || seen.has(path)) continue;
        seen.add(path);
        result.push(path);
        if (result.length >= 20) break;
      }
      return result;
    }

    /** 补全候选文件列表规整（/files 返回值）。 */
    function normalizeFileSuggestions(raw) {
      if (!Array.isArray(raw)) return [];
      const result = [];
      for (const item of raw) {
        if (typeof item !== 'string') continue;
        const path = item.trim();
        if (path === '') continue;
        result.push(path);
      }
      return result;
    }

    /** quick-add 的 skipped 规整：{line, reason}。 */
    function normalizeChatSkipped(raw) {
      if (!Array.isArray(raw)) return [];
      const result = [];
      for (const item of raw) {
        if (!isRecord(item)) continue;
        result.push({
          line: typeof item.line === 'string' ? item.line : item.line === undefined || item.line === null ? '' : String(item.line),
          reason: typeof item.reason === 'string' ? item.reason : item.reason === undefined || item.reason === null ? '' : String(item.reason),
        });
      }
      return result;
    }

    /** quick-add 的 errors 规整：{title, code, message}。 */
    function normalizeChatErrors(raw) {
      if (!Array.isArray(raw)) return [];
      const result = [];
      for (const item of raw) {
        if (!isRecord(item)) continue;
        result.push({
          title: typeof item.title === 'string' ? item.title : '',
          code: typeof item.code === 'string' ? item.code : '',
          message: typeof item.message === 'string' ? item.message : '',
        });
      }
      return result;
    }

    /** 文件路径的 basename（兼容 / 与 \\）。 */
    function fileBaseName(path) {
      const text = typeof path === 'string' ? path : '';
      const parts = text.split(/[\\/]/);
      return parts.length > 0 ? parts[parts.length - 1] || text : text;
    }

    /**
     * 检测光标前的 @ 文件 token：返回 {start,end,query}，其中 start 是 '@' 的下标；
     * 光标与最近的 @ 之间出现空白则不算 token。无法检测时返回 null。
     */
    /** 检测光标前最近的指定标记 token（@ 文件 / # 分类）。 */
    function findTagToken(text, caret, marker) {
      const source = typeof text === 'string' ? text : '';
      const tag = typeof marker === 'string' && marker !== '' ? marker[0] : '';
      if (tag === '') return null;
      const position =
        typeof caret === 'number' && Number.isFinite(caret) ? Math.max(0, Math.min(caret, source.length)) : source.length;
      const before = source.slice(0, position);
      const atIndex = before.lastIndexOf(tag);
      if (atIndex < 0) return null;
      const query = before.slice(atIndex + 1);
      if (/\s/.test(query)) return null;
      return { start: atIndex, end: position, query };
    }

    /**
     * 检测光标前的 @ 文件 token：返回 {start,end,query}，其中 start 是 '@' 的下标；
     * 光标与最近的 @ 之间出现空白则不算 token。无法检测时返回 null。
     */
    function findAtToken(text, caret) {
      return findTagToken(text, caret, '@');
    }

    /** 检测光标前的 # 分类 token。 */
    function findHashToken(text, caret) {
      return findTagToken(text, caret, '#');
    }

    /** 插入 @ 引用的文本：含空白或 # 的路径使用引号形式（Host 支持 @"..."）。 */
    function formatFileReference(path) {
      const text = typeof path === 'string' ? path : '';
      return /[\s#]/.test(text) ? `@"${text}" ` : `@${text} `;
    }

    /** 插入 # 分类的文本：名称含空白时使用 [名称] 形式（# 遇到空格会断）。 */
    function formatProjectTag(name) {
      const text = typeof name === 'string' ? name : '';
      return /\s/.test(text) ? `[${text}] ` : `#${text} `;
    }

    /** 文本是否含 Host 可解析的标记（有则顶部框提交走 /quick-add）。 */
    function hasTagMarkup(value) {
      const text = typeof value === 'string' ? value : '';
      return /[#@\[\]\n；;]|(?:项目|分类)\s*[：:]/.test(text);
    }

    /** @ 补全缓存键：workspace + query，避免跨工作区串数据。 */
    function fileCacheKey(workspace, query) {
      const workspaceText = typeof workspace === 'string' ? workspace : '';
      const queryText = typeof query === 'string' ? query : '';
      return `${workspaceText}\u0000${queryText}`;
    }

    /** # 分类补全缓存键：workspace + 'project'（与文件缓存分开）。 */
    function projectCacheKey(workspace) {
      const workspaceText = typeof workspace === 'string' ? workspace : '';
      return `${workspaceText}\u0000project`;
    }

    /** /projects 建议规整：{name, source:'used'|'workspace'|'folder', count}。 */
    function normalizeProjectSuggestions(raw) {
      if (!Array.isArray(raw)) return [];
      const result = [];
      const seen = new Set();
      for (const item of raw) {
        if (!isRecord(item)) continue;
        const name = normalizeProjectInput(typeof item.name === 'string' ? item.name : '');
        if (name === '' || name.length > 40) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const source = item.source === 'used' || item.source === 'workspace' || item.source === 'folder' ? item.source : 'folder';
        result.push({ name, source, count: toCount(item.count, 0) });
      }
      return result;
    }

    /** 工作区列表规整：{path,title,source}，path 必填。 */
    function normalizeWorkspaces(raw) {
      if (!Array.isArray(raw)) return [];
      const result = [];
      const seen = new Set();
      for (const item of raw) {
        if (!isRecord(item)) continue;
        const path = typeof item.path === 'string' ? item.path.trim() : '';
        if (path === '' || seen.has(path)) continue;
        seen.add(path);
        result.push({
          path,
          title: typeof item.title === 'string' && item.title !== '' ? item.title : path,
          source: typeof item.source === 'string' ? item.source : '',
        });
      }
      return result;
    }

    function normalizeTodos(raw) {
      if (!Array.isArray(raw)) return [];
      const result = [];
      for (const item of raw) {
        const todo = normalizeTodo(item);
        if (todo !== null) result.push(todo);
      }
      return result;
    }

    /** 统计优先用 Host 返回值，异常时按当前列表兜底。 */
    function normalizeStats(raw, todos) {
      const list = Array.isArray(todos) ? todos : [];
      let pending = 0;
      for (const todo of list) {
        if (todo.status !== 'completed') pending += 1;
      }
      const computed = { total: list.length, pending, completed: list.length - pending };
      const source = isRecord(raw) ? raw : {};
      return {
        total: toCount(source.total, computed.total),
        pending: toCount(source.pending, computed.pending),
        completed: toCount(source.completed, computed.completed),
      };
    }

    /** 取出接口 notices（兼容字符串与 {message} 对象），拼成一行提示。 */
    function extractNotices(value) {
      if (!isRecord(value) || !Array.isArray(value.notices)) return '';
      const parts = [];
      for (const notice of value.notices) {
        if (typeof notice === 'string' && notice !== '') parts.push(notice);
        else if (isRecord(notice) && typeof notice.message === 'string' && notice.message !== '') parts.push(notice.message);
      }
      return parts.join(t('notice.join'));
    }

    /** 统一取「这次操作之后要展示的提示」。 */
    function notifyText(value, fallbackKey) {
      const text = extractNotices(value);
      if (text !== '') return text;
      return fallbackKey ? t(fallbackKey) : '';
    }

    /** 分类字段规整：只有字符串才算分类，其它值按未分类处理。 */
    function normalizeProject(value) {
      return typeof value === 'string' ? value : '';
    }

    /** 优先级字段规整：只接受 high/medium/low，其它值按未设置处理。 */
    function normalizePriority(value) {
      return value === 'high' || value === 'medium' || value === 'low' ? value : '';
    }

    /** 类型字段规整：只接受 bug/feature/improvement/question/chore/other，其它值按未设置处理。 */
    function normalizeType(value) {
      return value === 'bug' ||
        value === 'feature' ||
        value === 'improvement' ||
        value === 'question' ||
        value === 'chore' ||
        value === 'other'
        ? value
        : '';
    }

    /** 与服务端 normalizeProjectName 一致：去控制字符、折叠连续空白、trim。 */
    function normalizeProjectInput(value) {
      if (typeof value !== 'string') return '';
      return value
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    /** 与服务端 validateTitle 一致：折叠连续空白并 trim。 */
    function normalizeTitleInput(value) {
      if (typeof value !== 'string') return '';
      return value.replace(/\s+/g, ' ').trim();
    }

    /** 展示用分类名（未分类走 i18n）。 */
    function projectLabel(project) {
      const name = normalizeProject(project);
      return name === '' ? t('project.none') : name;
    }

    /** 分类排序：按名称，未分类始终最后。 */
    function compareProjectNames(left, right) {
      if (left === right) return 0;
      if (left === '') return 1;
      if (right === '') return -1;
      try {
        return String(left).localeCompare(String(right), 'zh');
      } catch (error) {
        return String(left) < String(right) ? -1 : 1;
      }
    }

    /** 分类条目规整：优先用 Host 的 projects，缺失时从当前 todos 推导。 */
    function normalizeProjects(raw, todos) {
      const entries = [];
      if (Array.isArray(raw)) {
        for (const item of raw) {
          if (!isRecord(item)) continue;
          entries.push({
            name: normalizeProject(item.name),
            count: toCount(item.count, 0),
            pending: toCount(item.pending, 0),
            completed: toCount(item.completed, 0),
          });
        }
      }
      if (entries.length > 0) {
        entries.sort((left, right) => compareProjectNames(left.name, right.name));
        return entries;
      }
      const map = new Map();
      for (const todo of Array.isArray(todos) ? todos : []) {
        const name = normalizeProject(todo && todo.project);
        const entry = map.get(name) || { name, count: 0, pending: 0, completed: 0 };
        entry.count += 1;
        if (todo.status === 'completed') entry.completed += 1;
        else entry.pending += 1;
        map.set(name, entry);
      }
      return [...map.values()].sort((left, right) => compareProjectNames(left.name, right.name));
    }

    /** 按分类分组（组内保持传入顺序，组按名称排序、未分类最后）。 */
    function groupByProject(items, getProject) {
      const map = new Map();
      const groups = [];
      const list = Array.isArray(items) ? items : [];
      for (const item of list) {
        let project;
        try {
          project = normalizeProject(getProject(item));
        } catch (error) {
          project = '';
        }
        if (!map.has(project)) {
          const memberList = [];
          map.set(project, memberList);
          groups.push({ project, items: memberList });
        }
        map.get(project).push(item);
      }
      groups.sort((left, right) => compareProjectNames(left.project, right.project));
      return groups;
    }

    /**
     * 列表分组：未分类始终最后；direction 同时作用于组顺序与组内 createdAt 排序
     * （组内默认按 createdAt，与 Host 的 createdAt 排序语义一致）。
     */
    function groupTodosByProject(todos, direction) {
      const descending = direction === 'desc';
      const groups = groupByProject(todos, (todo) => todo && todo.project);
      if (descending) {
        groups.sort((left, right) => {
          if (left.project === '' && right.project !== '') return 1;
          if (right.project === '' && left.project !== '') return -1;
          return -compareProjectNames(left.project, right.project);
        });
      }
      const compareCreatedAt = (left, right) => {
        const a = toMillis(left && left.createdAt);
        const b = toMillis(right && right.createdAt);
        if (a === null && b === null) return 0;
        if (a === null) return 1; // 非法时间始终最后
        if (b === null) return -1;
        return descending ? b - a : a - b;
      };
      for (const group of groups) group.items.sort(compareCreatedAt);
      return groups;
    }

    /** 刷新后裁剪展开/选中类 id 映射：只保留仍出现在列表里的 id。 */
    function pruneIdMap(current, todos) {
      if (current === null || typeof current !== 'object') return current;
      const keys = Object.keys(current);
      if (keys.length === 0) return current;
      const alive = new Set((Array.isArray(todos) ? todos : []).map((todo) => todo.id));
      let changed = false;
      const next = {};
      for (const key of keys) {
        if (alive.has(key)) next[key] = true;
        else changed = true;
      }
      return changed ? next : current;
    }

    /** 本地 HH:mm:ss；非法值返回 '-'。 */
    function formatClock(value) {
      const ms = toMillis(value);
      if (ms === null) return EMPTY_TIME;
      const date = new Date(ms);
      return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
    }

    /** 本地日期键 YYYY-MM-DD；非法毫秒返回 ''。 */
    function dateKeyOf(ms) {
      if (!Number.isFinite(ms)) return '';
      const date = new Date(ms);
      return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
    }

    /** 某月 42 个日历格（周一起始，含前后月补格）。 */
    function buildCalendarCells(year, month) {
      const first = new Date(year, month, 1);
      const offset = (first.getDay() + 6) % 7; // 周一 = 0
      const start = new Date(year, month, 1 - offset);
      const todayKey = dateKeyOf(Date.now());
      const cells = [];
      for (let index = 0; index < CALENDAR_CELLS; index += 1) {
        const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
        const ms = date.getTime();
        const key = dateKeyOf(ms);
        cells.push({
          ms,
          key,
          day: date.getDate(),
          inMonth: date.getFullYear() === year && date.getMonth() === month,
          isToday: key === todayKey,
        });
      }
      return cells;
    }

    /** 日历落格用的日期键：按创建/完成时间，非法返回 ''。 */
    function calendarDayKey(todo, basis) {
      if (!isRecord(todo)) return '';
      const ms = toMillis(basis === 'completedAt' ? todo.completedAt : todo.createdAt);
      return ms === null ? '' : dateKeyOf(ms);
    }

    /**
     * 看板列：状态（默认）或分类（名称升序、未分类最后）。
     * `status`/`dot` 用于列头状态点；`project` 只在按分类分组时存在（列内快捷新建要预填分类）。
     */
    function boardColumns(todos, groupBy) {
      if (groupBy === 'project') {
        return groupByProject(todos, (todo) => todo && todo.project).map((group) => ({
          key: `project:${group.project}`,
          label: projectLabel(group.project),
          items: group.items,
          project: group.project,
          status: '',
          dot: '',
        }));
      }
      const pending = [];
      const completed = [];
      for (const todo of Array.isArray(todos) ? todos : []) {
        if (todo.status === 'completed') completed.push(todo);
        else pending.push(todo);
      }
      const toLanes = (items) =>
        groupByProject(items, (todo) => todo && todo.project).map((group) => ({
          key: `lane:${group.project}`,
          project: group.project,
          label: projectLabel(group.project),
          items: group.items,
        }));
      const swimlane = groupBy === 'status-project';
      return [
        {
          key: 'status:pending',
          label: t('row.pending'),
          items: pending,
          project: undefined,
          status: 'pending',
          dot: 'pending',
          lanes: swimlane ? toLanes(pending) : undefined,
        },
        {
          key: 'status:completed',
          label: t('row.completed'),
          items: completed,
          project: undefined,
          status: 'completed',
          dot: 'completed',
          lanes: swimlane ? toLanes(completed) : undefined,
        },
      ];
    }

    /** 简单占位块（看板/日历空态复用）。 */
    function TextPlaceholder(props) {
      const titleKey = props && props.titleKey ? props.titleKey : 'list.empty';
      const hintKey = props && props.hintKey ? props.hintKey : '';
      const actionKey = props && typeof props.actionKey === 'string' ? props.actionKey : '';
      const onAction = props && typeof props.onAction === 'function' ? props.onAction : null;
      const titleVars = props && isRecord(props.titleVars) ? props.titleVars : undefined;
      return h(
        'div',
        { className: 'ttl-placeholder', role: 'status' },
        h('p', { className: 'ttl-placeholder-title' }, t(titleKey, titleVars)),
        hintKey !== '' ? h('p', { className: 'ttl-placeholder-hint' }, t(hintKey)) : null,
        onAction === null || actionKey === ''
          ? null
          : h(
              'div',
              { className: 'ttl-placeholder-action' },
              h('button', { type: 'button', className: 'ttl-button ttl-button-outline', onClick: onAction }, t(actionKey))
            )
      );
    }

    //#region 甘特图时间轴计算
    const GANTT_LABEL_WIDTH = 220;
    const GANTT_TRACK_WIDTH = 900;
    const GANTT_STEPS = [
      60e3, 2 * 60e3, 5 * 60e3, 10 * 60e3, 15 * 60e3, 30 * 60e3,
      3600e3, 2 * 3600e3, 3 * 3600e3, 6 * 3600e3, 12 * 3600e3,
      86400e3, 2 * 86400e3, 3 * 86400e3, 7 * 86400e3, 14 * 86400e3, 30 * 86400e3, 90 * 86400e3, 180 * 86400e3, 365 * 86400e3,
    ];

    /** 目标 6-10 个刻度：取让刻度数不超过 10 的最小步长。 */
    function chooseTickStep(span) {
      for (const step of GANTT_STEPS) {
        if (span / step <= 10) return step;
      }
      return GANTT_STEPS[GANTT_STEPS.length - 1];
    }

    /** 刻度标签：MM-DD HH:mm；跨度超过 30 天用 MM-DD。 */
    function formatTickLabel(ms, span) {
      const date = new Date(ms);
      const monthDay = `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
      if (span > 30 * 86400e3) return monthDay;
      return `${monthDay} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
    }
    //#endregion
    //#endregion

    //#region 常量与样式
    const FILTERS = [
      { value: 'all', labelKey: 'filter.all' },
      { value: 'pending', labelKey: 'filter.pending' },
      { value: 'completed', labelKey: 'filter.completed' },
    ];
    const SORTS = [
      { value: 'createdAt', labelKey: 'sort.createdAt' },
      { value: 'completedAt', labelKey: 'sort.completedAt' },
      { value: 'updatedAt', labelKey: 'sort.updatedAt' },
      { value: 'project', labelKey: 'sort.project' },
      { value: 'priority', labelKey: 'sort.priority' },
    ];
    const PRIORITIES = [
      { value: '', labelKey: 'priority.none' },
      { value: 'high', labelKey: 'priority.high' },
      { value: 'medium', labelKey: 'priority.medium' },
      { value: 'low', labelKey: 'priority.low' },
    ];
    const TYPES = [
      { value: '', labelKey: 'type.none' },
      { value: 'bug', labelKey: 'type.bug' },
      { value: 'feature', labelKey: 'type.feature' },
      { value: 'improvement', labelKey: 'type.improvement' },
      { value: 'question', labelKey: 'type.question' },
      { value: 'chore', labelKey: 'type.chore' },
      { value: 'other', labelKey: 'type.other' },
    ];
    const DIRECTIONS = [
      { value: 'asc', labelKey: 'direction.asc' },
      { value: 'desc', labelKey: 'direction.desc' },
    ];
    const VIEWS = [
      { value: 'table', labelKey: 'view.table' },
      { value: 'board', labelKey: 'view.board' },
      { value: 'gantt', labelKey: 'view.gantt' },
      { value: 'calendar', labelKey: 'view.calendar' },
    ];
    const BOARD_GROUPS = [
      { value: 'status', labelKey: 'board.groupStatus' },
      { value: 'project', labelKey: 'board.groupProject' },
      { value: 'status-project', labelKey: 'board.groupStatusProject' },
    ];
    /** 看板密度：舒适（默认）/ 紧凑（标题 1 行、隐藏文件 chip 与分类名）。 */
    const BOARD_DENSITIES = [
      { value: 'comfortable', labelKey: 'board.densityComfortable' },
      { value: 'compact', labelKey: 'board.densityCompact' },
    ];
    /** 「已完成」列默认收纳的最近条数；超过后折叠为「显示全部」。 */
    const BOARD_COMPLETED_LIMIT = 10;
    const CALENDAR_BASES = [
      { value: 'createdAt', labelKey: 'calendar.basisCreated' },
      { value: 'completedAt', labelKey: 'calendar.basisCompleted' },
    ];
    const CALENDAR_WEEKDAY_KEYS = [
      'calendar.weekdayMon',
      'calendar.weekdayTue',
      'calendar.weekdayWed',
      'calendar.weekdayThu',
      'calendar.weekdayFri',
      'calendar.weekdaySat',
      'calendar.weekdaySun',
    ];
    /** 表格列：sortBy 为 null 时该列不可排序（状态/操作）。 */
    const TABLE_COLUMNS = [
      { key: 'title', labelKey: 'table.title', sortBy: 'title' },
      { key: 'project', labelKey: 'table.project', sortBy: 'project' },
      { key: 'status', labelKey: 'table.status', sortBy: null },
      { key: 'createdAt', labelKey: 'table.createdAt', sortBy: 'createdAt', align: 'right' },
      { key: 'completedAt', labelKey: 'table.completedAt', sortBy: 'completedAt', align: 'right' },
      { key: 'actions', labelKey: 'table.actions', sortBy: null, align: 'right' },
    ];
    const CALENDAR_CELLS = 42;
    const CALENDAR_MAX_ITEMS = 3;

    /**
     * 每个视图需要的 /list 查询参数：表格用工具栏状态，其它视图取全量并在客户端
     * 分组/落格（分类筛选始终透传）。
     */
    function queryForView(view, filter, sortBy, direction) {
      if (view === 'gantt') return { filter: 'all', sortBy: 'createdAt', direction: 'asc' };
      // 看板的分组/落列在客户端完成，但状态筛选仍然生效（与表格同一状态源，避免「筛选静默失效」）。
      if (view === 'board') return { filter, sortBy: 'createdAt', direction: 'desc' };
      if (view === 'calendar') return { filter: 'all', sortBy: 'createdAt', direction: 'asc' };
      return { filter, sortBy, direction };
    }

    const GANTT_RANGES = [
      { value: 'all', labelKey: 'gantt.rangeAll', days: 0 },
      { value: '7d', labelKey: 'gantt.range7d', days: 7 },
      { value: '30d', labelKey: 'gantt.range30d', days: 30 },
    ];
    /** 分类筛选里代表「全部」的哨兵值；'' 保留给「未分类」。 */
    const PROJECT_FILTER_ALL = '__ttl_all_projects__';
    /** 「自定义分类…」哨兵值（原生 select 里的特殊选项）。 */
    const PROJECT_CUSTOM = '__ttl_custom_project__';
    /** 看板「移到分类」里代表未分类的哨兵值（'' 留给 select 占位项）。 */
    const BOARD_MOVE_UNCATEGORIZED = '__ttl_board_uncategorized__';
    /** 类型筛选里代表「全部类型」的哨兵值；'' 保留给「未设置」。 */
    const TYPE_FILTER_ALL = '__ttl_all_types__';

    const CSS_TEXT = `.ttl-root {
  position: relative;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base);
  font-size: 14px;
  line-height: 1.6;
}
.ttl-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  scrollbar-gutter: stable;
}
.ttl-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 clamp(20px, 3vw, 40px) 48px;
}
.ttl-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
  padding-top: 24px;
  margin-bottom: 16px;
}
.ttl-heading-text { min-width: 0; }
.ttl-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
}
.ttl-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
.ttl-heading-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.ttl-ghost-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 30px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--dsw-radius-sm);
  background: none;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 13px;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}
.ttl-ghost-button:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.ttl-ghost-button[aria-expanded='true'] {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.ttl-ghost-button-icon { transition: transform 0.15s; }

/* 新建待办：整页唯一的主操作区。外层 16 = 内层 8 + 内边距 8。 */
.ttl-composer {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 20px;
  padding: 8px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-lg);
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: var(--dsw-shadow-lv1);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.ttl-composer:hover { border-color: var(--dsw-alias-border-l3); }
.ttl-composer:focus-within {
  border-color: color-mix(in srgb, var(--dsw-alias-state-business-primary) 55%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, transparent);
}
.ttl-composer-input {
  flex: 1 1 220px;
  min-width: 0;
  height: 36px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--dsw-radius-sm);
  background: none;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 14px;
}
.ttl-composer-input:focus { outline: none; }
.ttl-composer-input::placeholder { color: var(--dsw-alias-label-caption); }
.ttl-composer .ttl-project-select {
  height: 32px;
  border-color: transparent;
  background: var(--dsw-alias-bg-module-platform);
}
.ttl-composer .ttl-project-select:hover {
  border-color: var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-primary);
}
.ttl-composer .ttl-button-primary { height: 36px; padding: 0 18px; }
.ttl-create-suggest {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 6;
  width: min(420px, 100%);
}
.ttl-create-suggest .ttl-file-suggest {
  position: static;
  right: auto;
  bottom: auto;
  max-height: 236px;
}
.ttl-input {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  transition: border-color 0.15s;
}
.ttl-input:hover { border-color: var(--dsw-alias-border-l2); }
.ttl-input:focus {
  outline: none;
  border-color: var(--dsw-alias-state-business-primary);
}
.ttl-input::placeholder { color: var(--dsw-alias-label-caption); }
.ttl-button {
  flex: none;
  border: 0;
  border-radius: var(--dsw-radius-sm);
  font: inherit;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.ttl-button-primary {
  height: 34px;
  padding: 0 16px;
  background: var(--dsw-alias-button-primary-fill);
  color: var(--dsw-alias-label-primary-foreground);
  font-weight: 500;
}
.ttl-button-primary:hover { background: var(--dsw-alias-button-primary-hover); }
.ttl-button-outline {
  height: 30px;
  padding: 0 12px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  background: none;
  color: var(--dsw-alias-label-secondary);
}
.ttl-button-outline:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.ttl-button:disabled { opacity: 0.5; cursor: not-allowed; }
.ttl-button:focus-visible,
.ttl-ghost-button:focus-visible,
.ttl-seg-item:focus-visible,
.ttl-link:focus-visible,
.ttl-sort-dir:focus-visible,
.ttl-toast-action:focus-visible,
.ttl-toast-close:focus-visible,
.ttl-select select:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 2px;
}

/* 数据区：视图/筛选控制与列表同属一张卡片，成为唯一的数据容器。 */
.ttl-data {
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-base);
  overflow: hidden;
}
.ttl-data > .ttl-toolbar {
  padding: 8px 12px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
}
.ttl-data .ttl-gantt,
.ttl-data .ttl-calendar,
.ttl-data .ttl-table-wrap {
  border: 0;
  border-radius: 0;
}
.ttl-data .ttl-list > .ttl-board { padding: 12px 12px 16px; }
.ttl-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
}
.ttl-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.ttl-seg {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-bg-module-platform);
}
.ttl-seg-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 13px;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}
.ttl-seg-item:hover { color: var(--dsw-alias-label-primary); }
.ttl-seg-item[aria-pressed='true'] {
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font-weight: 500;
  box-shadow: var(--dsw-shadow-lv1);
}
.ttl-seg-count {
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.ttl-seg-item[aria-pressed='true'] .ttl-seg-count { color: var(--dsw-alias-label-secondary); }
.ttl-select {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary);
}
.ttl-select select {
  height: 28px;
  padding: 0 6px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.ttl-sort-dir {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-sm);
  background: none;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
}
.ttl-sort-dir:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.ttl-refreshing {
  min-width: 52px;
  font-size: 12px;
  line-height: 20px;
  color: var(--dsw-alias-label-tertiary);
  text-align: right;
}
.ttl-list { display: block; }

/* 瞬时提示：绝对定位在面板底部，出现/消失都不改变布局高度。 */
.ttl-toast-host {
  position: absolute;
  left: 50%;
  bottom: 44px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: max-content;
  max-width: min(420px, calc(100% - 32px));
  transform: translateX(-50%);
  pointer-events: none;
}
.ttl-toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  padding: 8px 8px 8px 12px;
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-toast-bg);
  color: var(--dsw-alias-toast-label);
  font-size: 13px;
  line-height: 20px;
  box-shadow: var(--dsw-shadow-lv3);
  animation: ttl-toast-in 160ms ease-out;
}
.ttl-toast-icon { display: inline-flex; flex: none; }
.ttl-toast-icon[data-kind='success'] { color: var(--dsw-alias-state-success-secondary); }
.ttl-toast-icon[data-kind='error'] { color: var(--dsw-alias-state-error-secondary); }
.ttl-toast-text { min-width: 0; overflow-wrap: anywhere; }
.ttl-toast-action {
  flex: none;
  height: 24px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: color-mix(in srgb, var(--dsw-alias-toast-label) 16%, transparent);
  color: var(--dsw-alias-toast-label);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}
.ttl-toast-action:hover { background: color-mix(in srgb, var(--dsw-alias-toast-label) 26%, transparent); }
.ttl-toast-close {
  flex: none;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: none;
  color: color-mix(in srgb, var(--dsw-alias-toast-label) 70%, transparent);
  font: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}
.ttl-toast-close:hover {
  background: color-mix(in srgb, var(--dsw-alias-toast-label) 16%, transparent);
  color: var(--dsw-alias-toast-label);
}
@keyframes ttl-toast-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}

.ttl-rows {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.ttl-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border-radius: 12px;
}
.ttl-row:hover { background: var(--dsw-alias-interactive-bg-hover); }
.ttl-row-inner {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.ttl-detail-toggle {
  flex: none;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--dsw-alias-label-tertiary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.ttl-detail-toggle:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.ttl-detail-toggle:disabled { opacity: 0.5; cursor: not-allowed; }
.ttl-detail-toggle:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 2px;
}
.ttl-detail-toggle svg { transition: transform 0.15s; }
.ttl-detail-toggle-expanded svg { transform: rotate(90deg); }
.ttl-row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ttl-row-titleline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.ttl-row-title {
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  line-height: 23px;
  overflow-wrap: anywhere;
}
.ttl-row[data-status='completed'] .ttl-row-title { color: var(--dsw-alias-label-tertiary); }.ttl-badge {
  display: inline-flex;
  align-items: center;
  flex: none;
  height: 20px;
  padding: 0 8px;
  border: 0;
  border-radius: 9999px;
  background: color-mix(in srgb, var(--dsw-alias-label-secondary) 9%, transparent);
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}
.ttl-badge-completed {
  background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 14%, transparent);
  color: var(--dsw-alias-state-success-primary);
}
.ttl-badge-row { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.ttl-badge.ttl-priority-high {
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 14%, transparent);
  color: var(--dsw-alias-state-error-primary);
}
.ttl-badge.ttl-priority-medium {
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 16%, transparent);
  color: var(--dsw-alias-state-warn-primary);
}
.ttl-badge.ttl-priority-low {
  background: color-mix(in srgb, var(--dsw-alias-label-secondary) 9%, transparent);
  color: var(--dsw-alias-label-secondary);
}
.ttl-priority-select select { min-width: 64px; }
.ttl-type-select select { min-width: 76px; }
.ttl-badge.ttl-type-bug {
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent);
  color: var(--dsw-alias-state-error-primary);
}
.ttl-badge.ttl-type-feature {
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, transparent);
  color: var(--dsw-alias-state-business-primary);
}
.ttl-badge.ttl-type-improvement {
  background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent);
  color: var(--dsw-alias-state-success-primary);
}
.ttl-badge.ttl-type-question {
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 14%, transparent);
  color: var(--dsw-alias-state-warn-primary);
}
.ttl-badge.ttl-type-chore,
.ttl-badge.ttl-type-other {
  background: color-mix(in srgb, var(--dsw-alias-label-secondary) 9%, transparent);
  color: var(--dsw-alias-label-secondary);
}

.ttl-row-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 14px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}
.ttl-time-label {
  margin-right: 4px;
  color: var(--dsw-alias-label-secondary);
}
.ttl-row-detail {
  margin: 0 2px 2px;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 20px;
}
.ttl-detail-list {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 2px 10px;
  margin: 0;
}
.ttl-detail-label {
  color: var(--dsw-alias-label-tertiary);
  white-space: nowrap;
}
.ttl-detail-value {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}
.ttl-detail-id {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  overflow-wrap: anywhere;
}
.ttl-row-actions {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
}
.ttl-link {
  padding: 2px 6px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
  cursor: pointer;
}
.ttl-link:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.ttl-link:disabled { opacity: 0.5; cursor: not-allowed; }
.ttl-link-danger { color: var(--dsw-alias-state-error-primary); }
.ttl-edit-input {
  flex: 1;
  height: 30px;
  min-width: 120px;
  font-size: 13px;
}.ttl-placeholder {
  min-height: 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  text-align: center;
  color: var(--dsw-alias-label-tertiary);
  font-size: 13px;
  line-height: 20px;
}

.ttl-placeholder-title {
  margin: 0 0 4px;
  color: var(--dsw-alias-label-secondary);
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
}
.ttl-placeholder-hint {
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 20px;
}
.ttl-placeholder-error .ttl-placeholder-title { color: var(--dsw-alias-state-error-primary); }
.ttl-placeholder-action { margin-top: 14px; }
.ttl-error-detail {
  margin: 8px 0 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
}.ttl-skeleton {
  display: flex;
  flex-direction: column;
}
.ttl-skeleton-head {
  display: flex;
  align-items: center;
  gap: 24px;
  height: 36px;
  padding: 0 12px;
  background: var(--dsw-alias-bg-module-platform);
}
.ttl-skeleton-row {
  display: grid;
  grid-template-columns: 32fr 14fr 8fr 12fr 12fr 10fr;
  align-items: center;
  gap: 24px;
  height: 44px;
  padding: 0 12px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l1);
}
.ttl-skeleton-row .ttl-skeleton-bar { width: 100%; }
.ttl-skeleton-bar {
  height: 10px;
  border-radius: 5px;
  background: var(--dsw-alias-bg-skeleton);
  animation: ttl-pulse 1.4s ease-in-out infinite;
}
.ttl-skeleton-bar-small { height: 8px; }
.ttl-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
@keyframes ttl-pulse {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 1; }
}

.ttl-project-input { flex: 0 0 168px; }
.ttl-edit-project { flex: 0 0 120px; min-width: 90px; }
.ttl-project-picker { display: flex; flex: 0 1 190px; align-items: center; gap: 6px; min-width: 0; }
.ttl-project-picker-custom { flex: 0 1 250px; }
.ttl-project-picker .ttl-project-input { flex: 1; min-width: 0; }
.ttl-project-select {
  flex: 1;
  min-width: 0;
  height: 36px;
  padding: 0 6px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.ttl-project-back { flex: none; font-size: 12px; white-space: nowrap; }
.ttl-td .ttl-project-picker { flex: 0 1 190px; }
.ttl-board-edit .ttl-project-picker { flex: 1 1 100%; }
.ttl-calendar-entry-edit .ttl-project-picker { flex: 1 1 100%; }
.ttl-gantt-row-edit .ttl-project-picker { flex: 0 1 220px; }.ttl-badge-project {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0;
  background: none;
  color: var(--dsw-alias-label-tertiary);
  font-weight: 400;
}
.ttl-badge-project-none { color: var(--dsw-alias-label-caption); }

.ttl-list-group {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px 0 2px;
  padding: 0 8px;
  list-style: none;
}
.ttl-list-group-label {
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  overflow-wrap: anywhere;
}
.ttl-gantt {
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  overflow: hidden;
}
.ttl-gantt-scroll { overflow-x: auto; overflow-y: hidden; }
.ttl-gantt-scroll:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: -2px;
}
.ttl-gantt-body { position: relative; }
.ttl-gantt-now-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--dsw-alias-state-error-primary);
  pointer-events: none;
  z-index: 1;
}
.ttl-gantt-head {
  display: flex;
  align-items: stretch;
  height: 30px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
}
.ttl-gantt-head-label {
  position: sticky;
  left: 0;
  z-index: 3;
  flex: none;
  width: 220px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  padding: 0 8px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 1;
}
.ttl-gantt-head-track { position: relative; flex: none; }
.ttl-gantt-tick-label {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
}
.ttl-gantt-now-label {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  padding: 0 2px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-state-error-primary);
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
}
.ttl-gantt-group-head {
  display: flex;
  align-items: center;
  height: 28px;
  background: var(--dsw-alias-bg-module-platform);
  border-bottom: 0.5px solid var(--dsw-alias-border-l1);
}
.ttl-gantt-group-label {
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-secondary);
  font-weight: 500;
}
.ttl-gantt-group-track { flex: none; }
.ttl-gantt-row {
  display: flex;
  align-items: center;
  height: 30px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l1);
  cursor: pointer;
}
.ttl-gantt-row:hover { background: var(--dsw-alias-interactive-bg-hover); }
.ttl-gantt-row-label {
  position: sticky;
  left: 0;
  z-index: 2;
  flex: none;
  width: 220px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  border: 0;
  background: var(--dsw-alias-bg-base);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
}
.ttl-gantt-row-label:hover { background: var(--dsw-alias-interactive-bg-hover); }
.ttl-gantt-row-label:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: -2px;
}
.ttl-gantt-row-detail {
  padding: 8px 10px 8px 230px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-module-platform);
}
.ttl-gantt-row-detail-inner { max-width: 890px; }
.ttl-gantt-row-edit {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}
.ttl-gantt-row-edit .ttl-input { min-width: 140px; }
.ttl-gantt-row-detail-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 2px;
  margin-top: 4px;
}
.ttl-gantt-dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--dsw-alias-state-warn-primary);
}
.ttl-gantt-dot[data-status='completed'] { background: var(--dsw-alias-state-success-primary); }
.ttl-gantt-title {
  flex: 1;
  min-width: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ttl-gantt-track { position: relative; flex: none; height: 100%; }
.ttl-gantt-grid {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--dsw-alias-border-l1);
}
.ttl-gantt-bar {
  position: absolute;
  top: 7px;
  height: 16px;
  border-radius: 8px;
  overflow: hidden;
}
.ttl-gantt-bar-completed { background: var(--dsw-alias-state-success-secondary); }
.ttl-gantt-bar-ongoing {
  background: var(--dsw-alias-state-business-primary);
  border-right: 2px dashed var(--dsw-alias-label-primary-foreground);
  box-sizing: border-box;
}
.ttl-gantt-bar-flag {
  position: absolute;
  right: 4px;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  color: var(--dsw-alias-label-primary-foreground);
  font-size: 10px;
  line-height: 1;
  white-space: nowrap;
}.ttl-chat {
  margin-bottom: 16px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-layer-1);
  overflow: hidden;
}

.ttl-chat-headrow {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 12px;
}
.ttl-chat-headrow .ttl-chat-head { flex: 1; min-width: 0; }
.ttl-chat-workspace { display: inline-flex; flex: none; align-items: center; gap: 4px; }
.ttl-chat-workspace-label { color: var(--dsw-alias-label-tertiary); font-size: 11px; white-space: nowrap; }
.ttl-chat-workspace-select {
  max-width: 180px;
  height: 24px;
  padding: 0 4px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: 6px;
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.ttl-chat-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 0;
  background: none;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.ttl-chat-head:hover { background: var(--dsw-alias-interactive-bg-hover); }
.ttl-chat-head:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 2px;
}
.ttl-chat-head-title { color: var(--dsw-alias-label-primary); font-weight: 500; }
.ttl-chat-head-hint { margin-left: auto; color: var(--dsw-alias-label-tertiary); font-size: 12px; }
.ttl-chat-chevron { transition: transform 0.15s; }
.ttl-chat-chevron-open { transform: rotate(90deg); }
.ttl-chat-body { padding: 0 12px 12px; }
.ttl-chat-log {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 260px;
  overflow-y: auto;
  padding: 4px 0 8px;
}
.ttl-chat-line { display: flex; }
.ttl-chat-line-user { justify-content: flex-end; }
.ttl-chat-line-assistant { justify-content: flex-start; }
.ttl-chat-bubble {
  max-width: 86%;
  padding: 6px 10px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 20px;
  overflow-wrap: anywhere;
}
.ttl-chat-bubble-user {
  background: var(--dsw-alias-button-primary-fill);
  color: var(--dsw-alias-label-primary-foreground);
}
.ttl-chat-bubble-assistant {
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-secondary);
}
.ttl-chat-text { white-space: pre-wrap; }
.ttl-chat-undo {
  margin-top: 4px;
  height: 24px;
  padding: 0 8px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: 8px;
  background: none;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.ttl-chat-undo:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.ttl-chat-compose { position: relative; display: flex; align-items: flex-end; gap: 8px; }
.ttl-chat-input {
  flex: 1;
  min-width: 0;
  height: auto;
  min-height: 36px;
  padding: 8px 10px;
  resize: vertical;
  font-size: 13px;
  line-height: 20px;
}
.ttl-chat-send { height: 36px; }.ttl-table-wrap {
  overflow-x: auto;
}
.ttl-table {
  width: 100%;
  min-width: 700px;
  border-collapse: collapse;
  font-size: 13px;
}
.ttl-th {
  height: 36px;
  padding: 0 12px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  text-align: left;
  white-space: nowrap;
}
.ttl-th-right { text-align: right; }
.ttl-th-sortable { padding: 0; }
.ttl-th-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  height: 36px;
  padding: 0 12px;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}
.ttl-th-right .ttl-th-button { justify-content: flex-end; }
.ttl-th-button:hover { color: var(--dsw-alias-label-primary); }
.ttl-th-button-active { color: var(--dsw-alias-label-primary); }
.ttl-th-arrow { color: var(--dsw-alias-label-tertiary); font-size: 9px; line-height: 1; }
.ttl-table-row { border-bottom: 0.5px solid var(--dsw-alias-border-l1); }
.ttl-table-row:hover { background: var(--dsw-alias-interactive-bg-hover); }
.ttl-table tbody tr:last-child { border-bottom: 0; }
.ttl-table-group-row .ttl-td {
  padding: 10px 12px 4px;
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  font-weight: 500;
}
.ttl-td {
  padding: 11px 12px;
  color: var(--dsw-alias-label-primary);
  vertical-align: middle;
  line-height: 20px;
}
.ttl-td-title { max-width: 360px; }
.ttl-td-time {
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 20px;
  white-space: nowrap;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.ttl-td-actions { text-align: right; white-space: nowrap; }
.ttl-table-title-button {
  max-width: 100%;
  padding: 0;
  border: 0;
  background: none;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  text-align: left;
  overflow-wrap: anywhere;
  cursor: pointer;
}
.ttl-table-title-button:hover { color: var(--dsw-alias-state-business-primary); }
.ttl-table-detail-row .ttl-td { padding: 0 12px 10px; }

.ttl-board {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding-bottom: 4px;
  overflow-x: auto;
  scroll-snap-type: x proximity;
}
.ttl-board:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: -2px; border-radius: var(--dsw-radius-md); }
.ttl-board-column {
  display: flex;
  flex: 0 0 clamp(240px, 30vw, 360px);
  flex-direction: column;
  min-width: 0;
  max-width: 360px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-bg-module-platform);
  scroll-snap-align: start;
}
.ttl-board-column-head {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  padding-left: 10px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 12px 12px 0 0;
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}
.ttl-board-column-title { display: flex; flex: 1 1 auto; align-items: center; gap: 6px; min-width: 0; margin: 0; color: inherit; font: inherit; }
.ttl-board-column-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ttl-board-dot { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-label-tertiary); }
.ttl-board-dot[data-status='pending'] { background: var(--dsw-alias-label-secondary); }
.ttl-board-dot[data-status='completed'] { background: var(--dsw-alias-state-success-primary); }
.ttl-board-dot[data-status='project'] { width: 5px; height: 5px; }
.ttl-board-column-count { flex: none; color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums; }
.ttl-board-add {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}
.ttl-board-add:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.ttl-board-add:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; }
.ttl-board-column-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 56vh;
  padding: 8px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.ttl-board-column-body:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: -2px; border-radius: 0 0 12px 12px; }
.ttl-board-list { display: flex; flex-direction: column; gap: 8px; }
.ttl-board-lanes { display: flex; flex-direction: column; gap: 12px; }
.ttl-board-lane { display: flex; flex-direction: column; gap: 6px; }
.ttl-board-lane-head { display: flex; align-items: center; gap: 4px; padding: 0 2px 4px; border-bottom: 0.5px solid var(--dsw-alias-border-l1); }
.ttl-board-lane-toggle { display: inline-flex; flex: 1 1 auto; align-items: center; gap: 6px; min-width: 0; height: 24px; padding: 0 2px; border: 0; border-radius: 6px; background: none; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; line-height: 1; text-align: left; cursor: pointer; }
.ttl-board-lane-toggle:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.ttl-board-lane-toggle:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; }
.ttl-board-lane-caret { flex: none; color: var(--dsw-alias-label-tertiary); font-size: 10px; }
.ttl-board-lane-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ttl-board-lane-count { flex: none; color: var(--dsw-alias-label-tertiary); font-size: 11px; font-variant-numeric: tabular-nums; }
.ttl-board-move { display: inline-flex; align-items: center; gap: 4px; }
.ttl-board-action-label { color: var(--dsw-alias-label-tertiary); font-size: 11px; white-space: nowrap; }
.ttl-board-move-select { height: 24px; max-width: 150px; padding: 0 4px; border: 0.5px solid var(--dsw-alias-border-l3); border-radius: 6px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; cursor: pointer; }
.ttl-board-move-select:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; }
.ttl-board-compact .ttl-board-card { gap: 2px; padding: 6px 28px 6px 32px; }
.ttl-board-compact .ttl-board-check { top: 6px; left: 6px; width: 22px; height: 22px; }
.ttl-board-compact .ttl-board-more { top: 4px; right: 2px; }
.ttl-board-compact .ttl-board-card-title { -webkit-line-clamp: 1; }
.ttl-board-compact .ttl-board-card-files { display: none; }
.ttl-board-compact .ttl-board-project-name { display: none; }
.ttl-board-compact .ttl-board-column-body,
.ttl-board-compact .ttl-board-list { gap: 6px; }
.ttl-board-compact .ttl-board-lanes { gap: 8px; }
.ttl-board-column-empty { margin: 0; padding: 12px 4px; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; text-align: center; }
.ttl-board-showmore { align-self: stretch; flex: none; height: 26px; border: 0; border-radius: 6px; background: none; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; cursor: pointer; }
.ttl-board-showmore:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.ttl-board-showmore:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; }
.ttl-board-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 9px 32px 9px 36px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: var(--dsw-alias-bg-base);
}
.ttl-board-card-editing { padding: 9px 10px; }
.ttl-board-card-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.ttl-board-card-title {
  display: -webkit-box;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  overflow-wrap: anywhere;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.ttl-board-card[data-status='completed'] .ttl-board-card-title { color: var(--dsw-alias-label-secondary); }
.ttl-board-card-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 10px;
  min-width: 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}
.ttl-board-project { display: inline-flex; align-items: center; gap: 4px; min-width: 0; max-width: 100%; }
.ttl-board-project-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ttl-board-check {
  position: absolute;
  top: 8px;
  left: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1.5px solid var(--dsw-alias-border-l3);
  border-radius: 50%;
  background: none;
  color: transparent;
  cursor: pointer;
}
.ttl-board-check:hover { border-color: var(--dsw-alias-state-success-primary); }
.ttl-board-check[data-checked='true'] {
  border-color: var(--dsw-alias-state-success-primary);
  background: var(--dsw-alias-state-success-primary);
  color: var(--dsw-alias-label-primary-foreground);
}
.ttl-board-check:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 2px; }
.ttl-board-check:disabled { opacity: 0.5; cursor: not-allowed; }
.ttl-board-more {
  position: absolute;
  top: 6px;
  right: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.ttl-board-more:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.ttl-board-more:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; }
.ttl-board-card-actions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
.ttl-board-action { height: 24px; padding: 0 8px; border: 0; border-radius: 6px; background: none; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; line-height: 1; cursor: pointer; }
.ttl-board-action:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.ttl-board-action:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; }
.ttl-board-action-danger { color: var(--dsw-alias-state-error-primary); }
.ttl-board-confirm { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-top: 2px; padding-top: 6px; border-top: 0.5px solid var(--dsw-alias-border-l1); }
.ttl-board-confirm-text { flex: 1 1 100%; margin: 0; color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 16px; }
.ttl-board-confirm-delete { height: 24px; padding: 0 8px; border: 0; border-radius: 6px; background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent); color: var(--dsw-alias-state-error-primary); font: inherit; font-size: 12px; cursor: pointer; }
.ttl-board-confirm-cancel { height: 24px; padding: 0 8px; border: 0; border-radius: 6px; background: none; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; cursor: pointer; }
.ttl-board-confirm-delete:focus-visible, .ttl-board-confirm-cancel:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; }
.ttl-board-edit { display: flex; flex-direction: column; gap: 6px; }
.ttl-board-edit .ttl-input { width: 100%; min-width: 0; }
.ttl-search { position: relative; display: inline-flex; align-items: center; gap: 6px; }
.ttl-search input {
  width: 180px;
  max-width: 100%;
  height: 28px;
  padding: 0 8px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
}
.ttl-search input::placeholder { color: var(--dsw-alias-label-caption); }
.ttl-search input:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; }
.ttl-search-count { color: var(--dsw-alias-label-tertiary); font-size: 11px; white-space: nowrap; font-variant-numeric: tabular-nums; }
.ttl-calendar {
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  overflow: hidden;
}
.ttl-calendar-head {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
}
.ttl-calendar-title {
  margin: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
}
.ttl-calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-module-platform);
}
.ttl-calendar-weekday {
  padding: 6px 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 16px;
  text-align: center;
}
.ttl-calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
.ttl-calendar-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 84px;
  padding: 4px 6px;
  border: 0;
  border-right: 0.5px solid var(--dsw-alias-border-l1);
  border-bottom: 0.5px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  text-align: left;
  overflow: hidden;
  cursor: pointer;
}
.ttl-calendar-cell:nth-child(7n) { border-right: 0; }
.ttl-calendar-cell:hover { background: var(--dsw-alias-interactive-bg-hover); }
.ttl-calendar-cell-outside { background: var(--dsw-alias-bg-module-platform); }
.ttl-calendar-cell-outside .ttl-calendar-daynum { color: var(--dsw-alias-label-tertiary); }
.ttl-calendar-cell-today .ttl-calendar-daynum {
  color: var(--dsw-alias-state-business-primary);
  font-weight: 600;
}
.ttl-calendar-cell-selected {
  background: var(--dsw-alias-interactive-bg-hover);
  box-shadow: inset 0 0 0 1px var(--dsw-alias-state-business-primary);
}
.ttl-calendar-daynum {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}
.ttl-calendar-items { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.ttl-calendar-item {
  display: block;
  padding: 0 4px;
  border-radius: 4px;
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ttl-calendar-item-completed {
  color: var(--dsw-alias-label-tertiary);
  text-decoration: line-through;
}
.ttl-calendar-more {
  padding: 0 4px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 10px;
  line-height: 14px;
}
.ttl-calendar-month-empty {
  margin: 0;
  padding: 10px 12px;
  border-top: 0.5px solid var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
}
.ttl-calendar-panel { padding: 10px 12px; border-top: 0.5px solid var(--dsw-alias-border-l2); }
.ttl-calendar-panel-title {
  margin: 0 0 8px;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}
.ttl-calendar-day-empty { margin: 0; color: var(--dsw-alias-label-tertiary); font-size: 12px; }
.ttl-calendar-day-list { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
.ttl-calendar-entry {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  padding: 6px 8px;
  border-radius: 8px;
  background: var(--dsw-alias-bg-module-platform);
}
.ttl-calendar-entry-main {
  display: flex;
  flex: 1 1 240px;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.ttl-calendar-entry-title {
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 20px;
  overflow-wrap: anywhere;
}
.ttl-calendar-entry-badges { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.ttl-calendar-entry-meta {
  display: flex;
  flex: 1 1 100%;
  flex-wrap: wrap;
  order: 3;
  gap: 2px 12px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}
.ttl-calendar-entry-actions { display: flex; flex: none; flex-wrap: wrap; justify-content: flex-end; gap: 2px; margin-left: auto; }
.ttl-calendar-entry-edit { display: flex; flex: 1 1 100%; flex-wrap: wrap; align-items: center; gap: 6px; }
.ttl-calendar-entry-edit .ttl-input { min-width: 140px; }
.ttl-calendar-nav-button { height: 28px; padding: 0 10px; font-size: 12px; }
.ttl-chat-files { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.ttl-file-suggest {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% + 6px);
  z-index: 6;
  max-height: 236px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: var(--dsw-alias-bg-base);
  box-shadow: 0 4px 16px var(--dsw-alias-bg-mask-1);
  overflow-y: auto;
}
.ttl-file-suggest-hint {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 4px 10px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-tertiary);
  font-size: 10px;
  line-height: 16px;
}
.ttl-file-suggest-status {
  padding: 8px 10px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}
.ttl-file-suggest-status-error { color: var(--dsw-alias-state-error-primary); }
.ttl-file-suggest-item { display: flex; flex-direction: column; gap: 1px; padding: 5px 10px; cursor: pointer; }
.ttl-file-suggest-item:hover,
.ttl-file-suggest-item-active { background: var(--dsw-alias-interactive-bg-hover); }
.ttl-file-suggest-name { color: var(--dsw-alias-label-primary); font-size: 12px; line-height: 18px; }
.ttl-file-suggest-path {
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 16px;
  overflow-wrap: anywhere;
}
.ttl-file-chips { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px; max-width: 100%; }
.ttl-file-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  max-width: 180px;
  height: 20px;
  padding: 0 6px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: 6px;
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11px;
  line-height: 18px;
  cursor: pointer;
}
.ttl-file-chip:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.ttl-file-chip-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ttl-file-chip-icon { font-size: 10px; line-height: 1; }
.ttl-file-more { color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 20px; }
.ttl-title-cell { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; min-width: 0; }
.ttl-board-card-files { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
.ttl-calendar-entry-files { display: flex; flex: 1 1 100%; flex-wrap: wrap; gap: 4px; }
.ttl-detail-files { display: flex; flex-wrap: wrap; gap: 4px; }
@media (prefers-reduced-motion: reduce) {
  .ttl-input,
  .ttl-button,
  .ttl-ghost-button,
  .ttl-detail-toggle svg,
  .ttl-chat-chevron,
  .ttl-ghost-button-icon { transition: none; }
  .ttl-skeleton-bar { animation: none; }
  .ttl-toast { animation: none; }
}
@media (max-width: 720px) {
  .ttl-detail-list { grid-template-columns: auto minmax(0, 1fr); }
}
@media (max-width: 560px) {
  .ttl-page { padding: 0 16px 32px; }
  .ttl-toolbar { align-items: flex-start; }
  .ttl-row-inner { flex-direction: column; }
  .ttl-row-actions { width: 100%; justify-content: flex-start; }
  .ttl-project-input { flex: 1 1 100%; }
  .ttl-project-picker { flex: 1 1 100%; }
  .ttl-chat-bubble { max-width: 100%; }
  .ttl-calendar-cell { min-height: 64px; padding: 2px 4px; }
  /* 窄面板：看板单列堆叠，避免「横向 + 纵向」双轴滚动。 */
  .ttl-board { flex-direction: column; align-items: stretch; overflow-x: visible; scroll-snap-type: none; }
  .ttl-board-column { flex: none; width: 100%; max-width: none; }
  .ttl-board-column-body { max-height: none; overflow: visible; }
  .ttl-search { width: 100%; }
  .ttl-search input { width: 100%; }
}
`;

    /** 组件内 <style> 元素：卸载时由 React 自动移除。 */
    function StyleSheet() {
      return h('style', { 'data-dsh-todo-time-log': 'styles' }, CSS_TEXT);
    }
    //#endregion

    //#region 小组件
    /** 侧边栏图标：跟随宿主 currentColor；size 由宿主传入。 */
    function Icon(props) {
      const size = props && Number.isFinite(props.size) ? props.size : 16;
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 16 16',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.3,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
          style: { display: 'block' },
        },
        h('circle', { cx: 8, cy: 8, r: 6 }),
        h('path', { d: 'M8 4.6V8l2.4 1.4' }),
        h('path', { d: 'M2.6 8h1' }),
        h('path', { d: 'M8 2.6v1' })
      );
    }

    /** 加载骨架屏。 */    /** 瞬时提示图标：成功 / 失败 / 中性。 */
    function ToastIcon(props) {
      const kind = props && props.kind === 'success' ? 'success' : props && props.kind === 'error' ? 'error' : 'info';
      const base = {
        width: 14,
        height: 14,
        viewBox: '0 0 16 16',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.4,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        focusable: 'false',
      };
      if (kind === 'success') {
        return h('svg', base, h('circle', { cx: 8, cy: 8, r: 6.2 }), h('path', { d: 'M5.3 8.2l1.9 1.9 3.6-3.9' }));
      }
      if (kind === 'error') {
        return h('svg', base, h('circle', { cx: 8, cy: 8, r: 6.2 }), h('path', { d: 'M8 4.7v4' }), h('path', { d: 'M8 11.2h.01' }));
      }
      return h('svg', base, h('circle', { cx: 8, cy: 8, r: 6.2 }), h('path', { d: 'M8 7.4v3.4' }), h('path', { d: 'M8 4.9h.01' }));
    }

    /** 加载骨架屏：行高与列宽对齐真实表格，加载完成时布局不跳动。 */
    function LoadingPlaceholder() {
      const bar = (small) =>
        h('div', {
          className: small === true ? 'ttl-skeleton-bar ttl-skeleton-bar-small' : 'ttl-skeleton-bar',
        });
      const headBar = (width) => h('div', { className: 'ttl-skeleton-bar ttl-skeleton-bar-small', style: { width } });
      const rows = [0, 1, 2, 3].map((index) =>
        h(
          'div',
          { key: index, className: 'ttl-skeleton-row' },
          bar(),
          bar(),
          bar(true),
          bar(true),
          bar(true),
          bar(true)
        )
      );
      return h(
        'div',
        { className: 'ttl-skeleton', role: 'status', 'aria-live': 'polite' },
        h('span', { className: 'ttl-sr-only' }, t('list.loading')),
        h('div', { className: 'ttl-skeleton-head' }, headBar('18%'), headBar('8%')),
        rows
      );
    }

    /** 空列表：说明原因 + 一个可执行的下一步。 */
    function EmptyPlaceholder(props) {
      const filter = props && typeof props.filter === 'string' ? props.filter : 'all';
      let titleKey = 'list.empty';
      let hintKey = 'list.emptyHint';
      if (filter === 'pending') {
        titleKey = 'list.emptyPending';
        hintKey = 'list.emptyPendingHint';
      } else if (filter === 'completed') {
        titleKey = 'list.emptyCompleted';
        hintKey = 'list.emptyCompletedHint';
      }
      const onAction = props && typeof props.onAction === 'function' ? props.onAction : null;
      const actionKey = props && typeof props.actionKey === 'string' ? props.actionKey : 'list.emptyAction';
      return h(
        'div',
        { className: 'ttl-placeholder', role: 'status' },
        h('p', { className: 'ttl-placeholder-title' }, t(titleKey)),
        h('p', { className: 'ttl-placeholder-hint' }, t(hintKey)),
        onAction === null
          ? null
          : h(
              'div',
              { className: 'ttl-placeholder-action' },
              h('button', { type: 'button', className: 'ttl-button ttl-button-outline', onClick: onAction }, t(actionKey))
            )
      );
    }


    function ErrorPlaceholder(props) {
      const message = props && typeof props.message === 'string' ? props.message : '';
      return h(
        'div',
        { className: 'ttl-placeholder ttl-placeholder-error', role: 'alert' },
        h('p', { className: 'ttl-placeholder-title' }, t('list.error')),
        message !== '' ? h('p', { className: 'ttl-placeholder-hint' }, message) : null,
        h(
          'div',
          { className: 'ttl-placeholder-action' },
          h(
            'button',
            { type: 'button', className: 'ttl-button ttl-button-outline', onClick: props && props.onRetry },
            t('list.retry')
          )
        )
      );
    }
    //#endregion

    //#region 二期组件：分类徽标 / 甘特图 / 对话录入
    /** 分类徽标；未分类用弱化样式。 */
    function ProjectBadge(props) {
      const project = normalizeProject(props && props.project);
      const className = project === '' ? 'ttl-badge ttl-badge-project ttl-badge-project-none' : 'ttl-badge ttl-badge-project';
      return h('span', { className, title: projectLabel(project) }, projectLabel(project));
    }

    /**
     * 甘特图视图：纯展示，数据由父级 /list（filter=all、sortBy=createdAt、
     * direction=asc、带 project 筛选）提供。非法/缺失时间一律跳过或按 now 兜底。
     */
    function GanttView(props) {
      const todos = props && Array.isArray(props.todos) ? props.todos : [];
      const range = props && typeof props.range === 'string' ? props.range : 'all';
      const nowMs = Date.now();
      let rangeDays = 0;
      for (const option of GANTT_RANGES) {
        if (option.value === range) rangeDays = option.days;
      }
      const windowStart = rangeDays > 0 ? nowMs - rangeDays * 86400e3 : null;

      const entries = [];
      for (const todo of todos) {
        if (todo === null || todo === undefined) continue;
        const start = toMillis(todo.createdAt);
        if (start === null) continue; // 创建时间不可解析：无法定位，跳过该条
        const completed = todo.status === 'completed';
        let end = completed ? toMillis(todo.completedAt) : nowMs;
        if (end === null || end < start) end = nowMs > start ? nowMs : start; // 非法完成时间按 now 兜底
        if (windowStart !== null && (end < windowStart || start > nowMs)) continue;
        entries.push({ todo, start, end, ongoing: !completed });
      }

      if (entries.length === 0) {
        return h(TextPlaceholder, {
          titleKey: 'gantt.empty',
          hintKey: 'gantt.emptyHint',
          actionKey: props && typeof props.emptyActionKey === 'string' ? props.emptyActionKey : 'list.emptyAction',
          onAction: props && typeof props.onEmptyAction === 'function' ? props.onEmptyAction : null,
        });
      }

      let min = Infinity;
      let max = -Infinity;
      for (const entry of entries) {
        if (entry.start < min) min = entry.start;
        if (entry.end > max) max = entry.end;
      }
      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return h(TextPlaceholder, {
          titleKey: 'gantt.empty',
          hintKey: 'gantt.emptyHint',
          actionKey: props && typeof props.emptyActionKey === 'string' ? props.emptyActionKey : 'list.emptyAction',
          onAction: props && typeof props.onEmptyAction === 'function' ? props.onEmptyAction : null,
        });
      }

      let span = max - min;
      if (span <= 0) {
        min -= 1800000;
        max += 1800000;
        span = max - min;
      }
      const padding = span * 0.05;
      min -= padding;
      max += padding;
      span = max - min;

      const toX = (ms) => ((ms - min) / span) * GANTT_TRACK_WIDTH;
      const nowInDomain = nowMs >= min && nowMs <= max;
      const nowX = nowInDomain ? toX(nowMs) : 0;
      const step = chooseTickStep(span);
      const ticks = [];
      let tick = Math.ceil(min / step) * step;
      let guard = 0;
      while (tick <= max && guard < 200) {
        ticks.push(tick);
        tick += step;
        guard += 1;
      }

      const barAria = (entry) => {
        const todo = entry.todo;
        const endLabel = entry.ongoing
          ? t('gantt.ongoing')
          : t('gantt.barEndCompleted', { time: formatTime(todo.completedAt) });
        return t('gantt.barAria', {
          project: projectLabel(normalizeProject(todo.project)),
          title: todo.title === '' ? t('list.empty') : todo.title,
          start: formatTime(todo.createdAt),
          end: endLabel,
        });
      };

      const bodyWidth = GANTT_LABEL_WIDTH + GANTT_TRACK_WIDTH;
      const groups = groupByProject(entries, (entry) => entry.todo.project);
      const ganttDetailIdOf = (todo) => `ttl-gantt-detail-${String(todo.id).replace(/[^A-Za-z0-9_-]/g, '-')}`;
      const isExpanded = (todo) => Boolean(props && props.expandedIds && props.expandedIds[todo.id] === true);
      const toggleRow = (todo) => {
        if (todo === null || todo === undefined) return;
        if (props && typeof props.onToggleExpanded === 'function') props.onToggleExpanded(todo);
      };

      return h(
        'div',
        { className: 'ttl-gantt' },
        h(
          'div',
          { className: 'ttl-gantt-scroll', role: 'region', 'aria-label': t('gantt.aria'), tabIndex: 0 },
          h(
            'div',
            { className: 'ttl-gantt-body', style: { width: `${bodyWidth}px` } },
            nowInDomain
              ? h('div', {
                  className: 'ttl-gantt-now-line',
                  style: { left: `${GANTT_LABEL_WIDTH + nowX}px` },
                  'aria-hidden': 'true',
                })
              : null,
            h(
              'div',
              { className: 'ttl-gantt-head' },
              h('div', { className: 'ttl-gantt-head-label' }, t('gantt.axis')),
              h(
                'div',
                { className: 'ttl-gantt-head-track', style: { width: `${GANTT_TRACK_WIDTH}px` } },
                ticks.map((ms) =>
                  h(
                    'span',
                    {
                      key: `head-${ms}`,
                      className: 'ttl-gantt-tick-label',
                      style: { left: `${toX(ms)}px` },
                    },
                    formatTickLabel(ms, span)
                  )
                ),
                nowInDomain
                  ? h('span', { className: 'ttl-gantt-now-label', style: { left: `${nowX}px` } }, t('gantt.now'))
                  : null
              )
            ),
            groups.map((group) =>
              h(
                'div',
                { key: `gantt-group-${group.project}`, className: 'ttl-gantt-group' },
                h(
                  'div',
                  { className: 'ttl-gantt-group-head' },
                  h(
                    'div',
                    { className: 'ttl-gantt-head-label ttl-gantt-group-label' },
                    t('group.header', { project: projectLabel(group.project), count: group.items.length })
                  ),
                  h('div', { className: 'ttl-gantt-group-track', style: { width: `${GANTT_TRACK_WIDTH}px` } })
                ),
                group.items.map((entry) => {
                  const aria = barAria(entry);
                  const todo = entry.todo;
                  const expanded = isExpanded(todo);
                  const editing = Boolean(props && props.editingId === todo.id);
                  const detailId = ganttDetailIdOf(todo);
                  const row = h(
                    'div',
                    {
                      key: todo.id,
                      className: expanded ? 'ttl-gantt-row ttl-gantt-row-expanded' : 'ttl-gantt-row',
                      'data-status': todo.status,
                      onClick: () => toggleRow(todo),
                    },
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'ttl-gantt-row-label',
                        'aria-expanded': expanded ? 'true' : 'false',
                        'aria-controls': detailId,
                        'aria-label': t('detail.toggleAria', {
                          action: expanded ? t('detail.collapse') : t('detail.expand'),
                          title: todo.title,
                        }),
                        title: expanded ? t('detail.collapse') : t('detail.expand'),
                        onClick: (event) => {
                          if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
                          toggleRow(todo);
                        },
                      },
                      h('span', { className: 'ttl-gantt-dot', 'data-status': todo.status, 'aria-hidden': 'true' }),
                      h(
                        'span',
                        { className: 'ttl-gantt-title', title: todo.title },
                        todo.title === '' ? t('list.empty') : todo.title
                      ),
                      h(ProjectBadge, { project: todo.project })
                    ),
                    h(
                      'div',
                      { className: 'ttl-gantt-track', style: { width: `${GANTT_TRACK_WIDTH}px` } },
                      ticks.map((ms) =>
                        h('span', {
                          key: `grid-${ms}`,
                          className: 'ttl-gantt-grid',
                          style: { left: `${toX(ms)}px` },
                          'aria-hidden': 'true',
                        })
                      ),
                      h(
                        'div',
                        {
                          className: entry.ongoing
                            ? 'ttl-gantt-bar ttl-gantt-bar-ongoing'
                            : 'ttl-gantt-bar ttl-gantt-bar-completed',
                          style: {
                            left: `${((entry.start - min) / span) * 100}%`,
                            width: `${Math.max(((entry.end - entry.start) / span) * 100, 0.4)}%`,
                          },
                          role: 'img',
                          'aria-label': aria,
                          title: aria,
                        },
                        entry.ongoing
                          ? h('span', { className: 'ttl-gantt-bar-flag' }, t('gantt.ongoing'))
                          : null
                      )
                    )
                  );
                  if (!expanded) return row;
                  const detail = h(
                    'div',
                    {
                      key: `${todo.id}-detail`,
                      id: detailId,
                      className: 'ttl-gantt-row-detail',
                      role: 'region',
                      'aria-label': t('detail.aria'),
                    },
                    h(
                      'div',
                      { className: 'ttl-gantt-row-detail-inner' },
                      props && typeof props.renderDetailContent === 'function'
                        ? props.renderDetailContent(todo)
                        : null,
                      editing && props && typeof props.renderEditFields === 'function'
                        ? props.renderEditFields(todo)
                        : null,
                      h(
                        'div',
                        { className: 'ttl-gantt-row-detail-actions' },
                        props && typeof props.renderActions === 'function' ? props.renderActions(todo) : null
                      )
                    )
                  );
                  return [row, detail];
                })
              )
            )
          )
        )
      );
    }

    /** 文件 chip：点击复制完整路径（父级传入 onCopy；剪贴板不可用时静默降级）。 */
    function FileChip(props) {
      const path = typeof (props && props.path) === 'string' ? props.path : '';
      if (path === '') return null;
      const label = props && typeof props.label === 'string' && props.label !== '' ? props.label : fileBaseName(path);
      return h(
        'button',
        {
          type: 'button',
          className: props && props.compact === true ? 'ttl-file-chip ttl-file-chip-compact' : 'ttl-file-chip',
          title: t('files.copyTitle', { path }),
          'aria-label': t('files.copyTitle', { path }),
          onClick: (event) => {
            if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
            if (props && typeof props.onCopy === 'function') props.onCopy(path);
          },
        },
        h('span', { className: 'ttl-file-chip-icon', 'aria-hidden': 'true' }, '📎'),
        h('span', { className: 'ttl-file-chip-name' }, label)
      );
    }

    /**
     * 分类选择器：未分类 → optgroup(已用/工作区/文件夹) → 自定义…。
     * 受控组件：custom=true 时显示自定义文本输入与「返回列表」按钮。
     * 老数据里不在建议中的 project 会以临时 option 保留显示，不丢值。
     */
    function ProjectPicker(props) {
      const value = normalizeProject(props && props.value);
      const options = props && Array.isArray(props.options) ? props.options : [];
      const custom = Boolean(props && props.custom);
      const disabled = Boolean(props && props.disabled);
      const groups = { used: [], workspace: [], folder: [] };
      for (const item of options) {
        if (item && groups[item.source] !== undefined && item.name !== '') groups[item.source].push(item);
      }
      const known = options.some((item) => item && item.name === value);
      const showTemporary = !custom && value !== '' && !known;

      if (custom) {
        return h(
          'div',
          { className: 'ttl-project-picker ttl-project-picker-custom' },
          h('input', {
            className: 'ttl-input ttl-project-input',
            type: 'text',
            value,
            placeholder: t('projects.customPlaceholder'),
            'aria-label': t('project.label'),
            disabled,
            onChange: (event) => {
              if (props && typeof props.onChange === 'function') props.onChange(event.target.value);
            },
            onKeyDown: (event) => {
              if (props && typeof props.onInputKeyDown === 'function') props.onInputKeyDown(event);
            },
          }),
          h(
            'button',
            {
              type: 'button',
              className: 'ttl-link ttl-project-back',
              disabled,
              onClick: () => {
                if (props && typeof props.onBackToList === 'function') props.onBackToList();
              },
            },
            t('projects.backToList')
          )
        );
      }

      const renderGroup = (source, labelKey) => {
        const items = groups[source];
        if (items.length === 0) return null;
        return h(
          'optgroup',
          { key: source, label: t(labelKey) },
          items.map((item) =>
            h(
              'option',
              { key: `${source}:${item.name}`, value: item.name, title: item.name },
              source === 'used' ? t('projects.countOption', { name: item.name, count: item.count }) : item.name
            )
          )
        );
      };

      return h(
        'div',
        { className: 'ttl-project-picker' },
        h(
          'select',
          {
            className: 'ttl-project-select',
            value,
            'aria-label': t('project.label'),
            disabled,
            onChange: (event) => {
              const next = event.target.value;
              if (next === PROJECT_CUSTOM) {
                if (props && typeof props.onCustom === 'function') props.onCustom();
                return;
              }
              if (props && typeof props.onChange === 'function') props.onChange(next);
            },
          },
          h('option', { value: '' }, t('project.none')),
          showTemporary ? h('option', { key: 'temporary', value }, value) : null,
          renderGroup('used', 'projects.groupUsed'),
          renderGroup('workspace', 'projects.groupWorkspace'),
          renderGroup('folder', 'projects.groupFolder'),
          h('option', { value: PROJECT_CUSTOM }, t('projects.custom'))
        )
      );
    }

    /** 补全下拉的列表/三态内容（对话面板与顶部新建框共用）。 */
    function SuggestionItems(props) {
      const kind = props && props.kind === 'project' ? 'project' : 'file';
      const suggestions = props && Array.isArray(props.suggestions) ? props.suggestions : [];
      const active = props && typeof props.active === 'number' && props.active >= 0 ? props.active : 0;
      if (props && props.loading) {
        return h(
          'div',
          { className: 'ttl-file-suggest-status' },
          t(kind === 'project' ? 'chat.projectsLoading' : 'chat.filesLoading')
        );
      }
      if (props && props.error) {
        return h(
          'div',
          { className: 'ttl-file-suggest-status ttl-file-suggest-status-error' },
          t(kind === 'project' ? 'chat.projectsError' : 'chat.filesError')
        );
      }
      if (suggestions.length === 0) {
        return h('div', { className: 'ttl-file-suggest-status' }, t(kind === 'project' ? 'chat.projectsEmpty' : 'chat.filesEmpty'));
      }
      return suggestions.map((value, index) =>
        h(
          'div',
          {
            key: value,
            className:
              index === active ? 'ttl-file-suggest-item ttl-file-suggest-item-active' : 'ttl-file-suggest-item',
            role: 'option',
            'aria-selected': index === active ? 'true' : 'false',
            onMouseDown: (event) => {
              if (event && typeof event.preventDefault === 'function') event.preventDefault();
            },
            onClick: () => {
              if (props && typeof props.onSelect === 'function') props.onSelect(value);
            },
          },
          h('span', { className: 'ttl-file-suggest-name' }, kind === 'project' ? value : fileBaseName(value)),
          kind === 'project' ? null : h('span', { className: 'ttl-file-suggest-path' }, value)
        )
      );
    }

    /** 补全下拉容器：listbox + 键盘提示（对话面板与顶部新建框共用）。 */
    function SuggestionDropdown(props) {
      const kind = props && props.kind === 'project' ? 'project' : 'file';
      return h(
        'div',
        {
          className: 'ttl-file-suggest',
          role: 'listbox',
          'aria-label': t(kind === 'project' ? 'chat.projectsAria' : 'chat.filesAria'),
        },
        h('div', { className: 'ttl-file-suggest-hint' }, t('chat.filesHint')),
        h(SuggestionItems, props)
      );
    }

    /** 对话录入面板：受控组件，消息与请求状态由 TodoPanel 管理。 */
    function ChatPanel(props) {
      const open = Boolean(props && props.open);
      const busy = Boolean(props && props.busy);
      const messages = props && Array.isArray(props.messages) ? props.messages : [];
      const input = props && typeof props.input === 'string' ? props.input : '';
      const suggestions = props && Array.isArray(props.suggestions) ? props.suggestions : [];
      const suggestionsOpen = Boolean(props && props.suggestionsOpen);
      const suggestionsLoading = Boolean(props && props.suggestionsLoading);
      const suggestionsError = Boolean(props && props.suggestionsError);
      const suggestionsActive =
        props && typeof props.suggestionsActive === 'number' && props.suggestionsActive >= 0 ? props.suggestionsActive : 0;
      const suggestionsKind = props && props.suggestionsKind === 'project' ? 'project' : 'file';
      const workspaces = props && Array.isArray(props.workspaces) ? props.workspaces : [];
      const workspace = props && typeof props.workspace === 'string' ? props.workspace : '';
      const selectedWorkspace = workspaces.find((item) => item && item.path === workspace) || null;
      const logRef = React.useRef(null);
      const blurTimerRef = React.useRef(null);

      const clearBlurTimer = () => {
        if (blurTimerRef.current !== null) {
          clearTimeout(blurTimerRef.current);
          blurTimerRef.current = null;
        }
      };

      React.useEffect(() => {
        const node = logRef.current;
        if (node !== null && node !== undefined && typeof node.scrollTop === 'number') {
          node.scrollTop = node.scrollHeight;
        }
      }, [messages.length, open]);

      // 卸载时清理失焦关闭下拉的定时器，避免卸载后 setState。
      React.useEffect(
        () => () => {
          clearBlurTimer();
        },
        []
      );

      const closeSuggest = () => {
        if (props && typeof props.onSuggestClose === 'function') props.onSuggestClose();
      };

      const handleKeyDown = (event) => {
        if (!event) return;
        const composing = event.isComposing === true || (event.nativeEvent && event.nativeEvent.isComposing === true);
        if (suggestionsOpen) {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (props && typeof props.onSuggestMove === 'function') props.onSuggestMove(1);
            return;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (props && typeof props.onSuggestMove === 'function') props.onSuggestMove(-1);
            return;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            closeSuggest();
            return;
          }
          if ((event.key === 'Enter' || event.key === 'Tab') && composing !== true) {
            event.preventDefault();
            if (suggestions.length > 0 && props && typeof props.onSuggestSelect === 'function') {
              props.onSuggestSelect(suggestions[suggestionsActive]);
            } else {
              closeSuggest();
            }
            return;
          }
        }
        if (event.key === 'Enter' && event.shiftKey !== true && composing !== true) {
          event.preventDefault();
          if (props && typeof props.onSend === 'function') props.onSend();
        }
      };

      const bubbles = messages.map((message) => {
        const record = isRecord(message) ? message : {};
        const role = record.role === 'user' ? 'user' : 'assistant';
        let text = typeof record.text === 'string' ? record.text : '';
        if (role === 'assistant' && record.welcome === true) text = t('chat.welcome');
        const pendingUndoCount =
          role === 'assistant' && Array.isArray(record.undoFailed) && record.undoFailed.length > 0
            ? record.undoFailed.length
            : null;
        const successes = Array.isArray(record.successes) ? record.successes : [];
        const canUndo = role === 'assistant' && successes.length > 0 && record.undone !== true;
        const retryUndo = canUndo && pendingUndoCount !== null;
        const successFiles = [];
        if (role === 'assistant') {
          for (const todo of successes) {
            if (!isRecord(todo)) continue;
            for (const path of normalizeFiles(todo.files)) {
              successFiles.push({ path, key: `${typeof todo.id === 'string' ? todo.id : ''}:${path}` });
            }
          }
        }
        const key = record.id === undefined ? `msg-${role}-${text.slice(0, 24)}` : record.id;
        return h(
          'div',
          { key, className: `ttl-chat-line ttl-chat-line-${role}` },
          h(
            'div',
            { className: `ttl-chat-bubble ttl-chat-bubble-${role}` },
            h('div', { className: 'ttl-chat-text' }, text),
            successFiles.length > 0
              ? h(
                  'div',
                  { className: 'ttl-chat-files' },
                  successFiles.map((item) =>
                    h(FileChip, { key: item.key, path: item.path, compact: true, onCopy: props && props.onCopyFile })
                  )
                )
              : null,
            canUndo
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'ttl-chat-undo',
                    disabled: busy,
                    'aria-label': retryUndo
                      ? t('chat.undoRetryAria', { count: pendingUndoCount })
                      : t('chat.undoAria', { count: successes.length }),
                    onClick: () => {
                      if (props && typeof props.onUndo === 'function') props.onUndo(record);
                    },
                  },
                  retryUndo ? t('chat.undoRetry') : t('chat.undo')
                )
              : null
          )
        );
      });

      return h(
        'section',
        { id: props && typeof props.id === 'string' ? props.id : undefined, className: 'ttl-chat', 'aria-label': t('chat.ariaLabel') },
        h(
          'div',
          { className: 'ttl-chat-headrow' },
          h(
            'button',
            {
              type: 'button',
              className: 'ttl-chat-head',
              'aria-expanded': open ? 'true' : 'false',
              'aria-controls': 'ttl-chat-body',
              title: open ? t('chat.collapse') : t('chat.expand'),
              onClick: () => {
                if (props && typeof props.onToggle === 'function') props.onToggle();
              },
            },
            h('span', { className: 'ttl-chat-head-title' }, t('chat.title')),
            h('span', { className: 'ttl-chat-head-hint' }, open ? t('chat.collapse') : t('chat.expand')),
            h(
              'svg',
              {
                width: 12,
                height: 12,
                viewBox: '0 0 16 16',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 1.6,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
                'aria-hidden': 'true',
                focusable: 'false',
                className: open ? 'ttl-chat-chevron ttl-chat-chevron-open' : 'ttl-chat-chevron',
                style: { display: 'block', flex: 'none' },
              },
              h('path', { d: 'M6 4l4 4-4 4' })
            )
          ),
          workspaces.length > 0
            ? h(
                'label',
                { className: 'ttl-chat-workspace' },
                h('span', { className: 'ttl-chat-workspace-label' }, t('chat.workspaceLabel')),
                h(
                  'select',
                  {
                    className: 'ttl-chat-workspace-select',
                    value: workspace,
                    'aria-label': t('chat.workspaceAria'),
                    title: selectedWorkspace === null ? '' : selectedWorkspace.path,
                    onChange: (event) => {
                      if (props && typeof props.onWorkspaceChange === 'function') {
                        props.onWorkspaceChange(event.target.value);
                      }
                    },
                  },
                  workspaces.map((item) =>
                    h(
                      'option',
                      { key: item.path, value: item.path, title: item.path },
                      item.title === '' ? item.path : item.title
                    )
                  )
                )
              )
            : null
        ),
        open
          ? h(
              'div',
              { id: 'ttl-chat-body', className: 'ttl-chat-body' },
              h(
                'div',
                {
                  ref: logRef,
                  className: 'ttl-chat-log',
                  role: 'log',
                  'aria-live': 'polite',
                  'aria-label': t('chat.logAria'),
                },
                bubbles
              ),
              h(
                'div',
                { className: 'ttl-chat-compose' },
                suggestionsOpen
                  ? h(SuggestionDropdown, {
                      kind: suggestionsKind,
                      loading: suggestionsLoading,
                      error: suggestionsError,
                      suggestions,
                      active: suggestionsActive,
                      onSelect: (value) => {
                        if (props && typeof props.onSuggestSelect === 'function') props.onSuggestSelect(value);
                      },
                    })
                  : null,
                h('textarea', {
                  className: 'ttl-input ttl-chat-input',
                  rows: 2,
                  value: input,
                  placeholder: t('chat.placeholder'),
                  'aria-label': t('chat.placeholder'),
                  disabled: busy,
                  onChange: (event) => {
                    if (props && typeof props.onChange === 'function') {
                      props.onChange(event.target.value, event.target.selectionStart);
                    }
                  },
                  onKeyDown: handleKeyDown,
                  onBlur: () => {
                    clearBlurTimer();
                    blurTimerRef.current = setTimeout(() => {
                      blurTimerRef.current = null;
                      closeSuggest();
                    }, 120);
                  },
                  onFocus: () => {
                    clearBlurTimer();
                  },
                }),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'ttl-button ttl-button-primary ttl-chat-send',
                    disabled: busy || input.trim() === '',
                    onClick: () => {
                      if (props && typeof props.onSend === 'function') props.onSend();
                    },
                  },
                  busy ? t('chat.sending') : t('chat.send')
                )
              )
            )
          : null
      );
    }
    //#endregion

    //#region 面板
    /** 面板主体。所有请求与交互状态都在这里，接口异常不会抛到槽位。 */
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

      // 看板里「已进行 X」随时间推进：只在本视图下每 60 秒更新一次「现在」。
      React.useEffect(() => {
        if (view !== 'board') return undefined;
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

      const handleDelete = async (todo) => {
        if (todo === null || todo === undefined || busyId !== null) return;
        setBusyId(todo.id);
        try {
          await request('/delete', { id: todo.id });
          if (!mountedRef.current) return;
          setConfirmId(null);
          showNotice('success', t('notice.deleted'));
          void fetchProjectSuggestions(workspaceRef.current, true);
          await reload(true);
        } catch (error) {
          showNotice('error', messageOf(error));
        } finally {
          if (mountedRef.current) setBusyId(null);
        }
      };

      //#region 对话式录入
      const pushMessage = (message) => {
        messageSeq.current += 1;
        const id = messageSeq.current;
        setMessages((current) => current.concat([Object.assign({}, message, { id })]));
      };

      //#region @ 文件补全（/files）
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
      //#endregion
      //#endregion

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
      //#endregion

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

      // —— 表格 / 看板 / 日历共用的行内操作与编辑控件 ——
      const detailIdOf = (todo) => `ttl-detail-${String(todo.id).replace(/[^A-Za-z0-9_-]/g, '-')}`;

      const statusBadge = (todo) =>
        h(
          'span',
          { className: todo.status === 'completed' ? 'ttl-badge ttl-badge-completed' : 'ttl-badge' },
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

      const renderDetailContent = (todo) => {
        const completed = todo.status === 'completed';
        return h(
          'dl',
          { className: 'ttl-detail-list' },
          h('dt', { className: 'ttl-detail-label' }, t('detail.status')),
          h('dd', { className: 'ttl-detail-value' }, t(completed ? 'row.completed' : 'row.pending')),
          h('dt', { className: 'ttl-detail-label' }, t('priority.label')),
          h(
            'dd',
            { className: 'ttl-detail-value' },
            normalizePriority(todo.priority) === ''
              ? t('priority.none')
              : t(`priority.${normalizePriority(todo.priority)}`)
          ),
          h('dt', { className: 'ttl-detail-label' }, t('type.label')),
          h(
            'dd',
            { className: 'ttl-detail-value' },
            normalizeType(todo.type) === '' ? t('type.none') : t(`type.${normalizeType(todo.type)}`)
          ),
          h('dt', { className: 'ttl-detail-label' }, t('detail.project')),
          h('dd', { className: 'ttl-detail-value' }, projectLabel(normalizeProject(todo.project))),
          normalizeFiles(todo.files).length > 0
            ? h('dt', { key: 'detail-files-label', className: 'ttl-detail-label' }, t('detail.files'))
            : null,
          normalizeFiles(todo.files).length > 0
            ? h('dd', { key: 'detail-files-value', className: 'ttl-detail-value ttl-detail-files' }, renderFileChips(todo))
            : null,
          h('dt', { className: 'ttl-detail-label' }, t('detail.created')),
          h('dd', { className: 'ttl-detail-value' }, formatTime(todo.createdAt)),
          h('dt', { className: 'ttl-detail-label' }, t('detail.completed')),
          h('dd', { className: 'ttl-detail-value' }, completed ? formatTime(todo.completedAt) : EMPTY_TIME),
          h('dt', { className: 'ttl-detail-label' }, t('detail.updated')),
          h('dd', { className: 'ttl-detail-value' }, formatTime(todo.updatedAt)),
          h('dt', { className: 'ttl-detail-label' }, t('detail.duration')),
          h(
            'dd',
            { className: 'ttl-detail-value' },
            completed ? formatDuration(todo.createdAt, todo.completedAt) : EMPTY_TIME
          ),
          h('dt', { className: 'ttl-detail-label' }, t('detail.id')),
          h('dd', { className: 'ttl-detail-value' }, h('span', { className: 'ttl-detail-id' }, todo.id))
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

      //#region 表格视图
      const pushTableRow = (rows, todo) => {
        const completed = todo.status === 'completed';
        const isEditing = editingId === todo.id;
        const expanded = expandedIds[todo.id] === true;
        const detailId = detailIdOf(todo);
        const titleCell = isEditing
          ? h('td', { className: 'ttl-td ttl-td-title' }, titleInput(todo))
          : h(
              'td',
              { className: 'ttl-td ttl-td-title' },
              h(
                'div',
                { className: 'ttl-title-cell' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'ttl-table-title-button',
                    title: todo.title === '' ? t('list.empty') : todo.title,
                    'aria-expanded': expanded ? 'true' : 'false',
                    'aria-controls': detailId,
                    onClick: () => toggleExpanded(todo),
                  },
                  todo.title === '' ? t('list.empty') : todo.title
                ),
                normalizeFiles(todo.files).length > 0 ? renderFileChips(todo, { max: 1, compact: true }) : null
              )
            );
        rows.push(
          h(
            'tr',
            {
              key: todo.id,
              className: 'ttl-table-row',
              'data-status': todo.status,
              onKeyDown: (event) => {
                if (event.key === 'Escape' && confirmId === todo.id) {
                  event.preventDefault();
                  event.stopPropagation();
                  setConfirmId(null);
                }
              },
            },
            titleCell,
            h(
              'td',
              { className: 'ttl-td ttl-td-project' },
              isEditing ? projectInput(todo) : h(ProjectBadge, { project: normalizeProject(todo.project) })
            ),
            h(
              'td',
              { className: 'ttl-td ttl-td-status' },
              h('span', { className: 'ttl-badge-row' }, statusBadge(todo), typeBadge(todo), priorityBadge(todo))
            ),
            h('td', { className: 'ttl-td ttl-td-time' }, formatTime(todo.createdAt)),
            h('td', { className: 'ttl-td ttl-td-time' }, completed ? formatTime(todo.completedAt) : EMPTY_TIME),
            h('td', { className: 'ttl-td ttl-td-actions' }, renderActionButtons(todo, { showDetail: true }))
          )
        );
        if (expanded) {
          rows.push(
            h(
              'tr',
              { key: `${todo.id}-detail`, className: 'ttl-table-detail-row' },
              h(
                'td',
                { className: 'ttl-td', colSpan: TABLE_COLUMNS.length },
                h(
                  'div',
                  {
                    id: detailId,
                    className: 'ttl-row-detail',
                    role: 'region',
                    'aria-label': t('detail.aria'),
                  },
                  renderDetailContent(todo)
                )
              )
            )
          );
        }
      };

      const renderTableView = () => {
        if (visibleTodos.length === 0) {
          return h(EmptyPlaceholder, {
            filter,
            actionKey: emptyActionKey,
            onAction: handleEmptyAction,
          });
        }
        const rows = [];
        if (sortBy === 'project') {
          for (const group of groupTodosByProject(visibleTodos, direction)) {
            rows.push(
              h(
                'tr',
                { key: `table-group-${group.project}`, className: 'ttl-table-group-row' },
                h(
                  'td',
                  { className: 'ttl-td', colSpan: TABLE_COLUMNS.length },
                  t('group.header', { project: projectLabel(group.project), count: group.items.length })
                )
              )
            );
            for (const todo of group.items) pushTableRow(rows, todo);
          }
        } else {
          for (const todo of visibleTodos) pushTableRow(rows, todo);
        }
        return h(
          'div',
          { className: 'ttl-table-wrap' },
          h(
            'table',
            {
              className: 'ttl-table',
              'aria-label': t('table.aria'),
              'aria-busy': listStatus === 'loading' ? 'true' : 'false',
            },
            h(
              'thead',
              null,
              h(
                'tr',
                null,
                TABLE_COLUMNS.map((column) => {
                  const active = column.sortBy !== null && sortBy === column.sortBy;
                  const ariaSort = active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none';
                  return h(
                    'th',
                    {
                      key: column.key,
                      scope: 'col',
                      className:
                        (column.sortBy === null ? 'ttl-th' : 'ttl-th ttl-th-sortable') +
                        (column.align === 'right' ? ' ttl-th-right' : ''),
                      'aria-sort': column.sortBy === null ? undefined : ariaSort,
                    },
                    column.sortBy === null
                      ? h('span', null, t(column.labelKey))
                      : h(
                          'button',
                          {
                            type: 'button',
                            className: active ? 'ttl-th-button ttl-th-button-active' : 'ttl-th-button',
                            title: t('table.sortTitle'),
                            'aria-label': t('table.sortAria', { column: t(column.labelKey) }),
                            onClick: () => handleHeaderSort(column.sortBy),
                          },
                          t(column.labelKey),
                          active
                            ? h('span', { className: 'ttl-th-arrow', 'aria-hidden': 'true' }, direction === 'asc' ? '▲' : '▼')
                            : null
                        )
                  );
                })
              )
            ),
            h('tbody', null, rows)
          )
        );
      };
      //#endregion

      //#region 看板视图
      /** 卡片上的一行时长：未完成 = 创建→现在；已完成 = 创建→完成。 */
      const renderBoardDuration = (todo) => {
        const completed = todo.status === 'completed';
        const createdMs = toMillis(todo.createdAt);
        const endValue = completed ? todo.completedAt : new Date(nowMs);
        const endMs = toMillis(endValue);
        if (createdMs === null || endMs === null) return null;
        const duration = formatDurationShort(todo.createdAt, endValue);
        if (duration === EMPTY_TIME) return null;
        const label = completed
          ? t('board.spentAria', {
              created: formatTime(todo.createdAt),
              completed: formatTime(todo.completedAt),
              duration,
            })
          : t('board.elapsedAria', { created: formatTime(todo.createdAt), duration });
        return h(
          'span',
          { className: 'ttl-board-duration' },
          h(
            'time',
            { dateTime: new Date(createdMs).toISOString(), 'aria-label': label, title: label },
            t(completed ? 'board.spent' : 'board.elapsed', { duration })
          )
        );
      };

      const boardCheckIcon = (completed) =>
        h(
          'svg',
          {
            width: 12,
            height: 12,
            viewBox: '0 0 16 16',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            'aria-hidden': 'true',
            focusable: 'false',
          },
          completed ? h('path', { d: 'M3.5 8.5l3 3 6-6.5' }) : null
        );

      const renderBoardCard = (todo) => {
        const isEditing = editingId === todo.id;
        const isConfirming = confirmId === todo.id;
        const actionsOpen = boardActionsId === todo.id;
        const completed = todo.status === 'completed';
        const title = todo.title === '' ? t('board.untitled') : todo.title;
        const project = normalizeProject(todo.project);
        const files = normalizeFiles(todo.files);
        const duration = renderBoardDuration(todo);
        const showProject = boardGroupBy === 'status';
        const showStatus = boardGroupBy === 'project';
        const canMoveProject = boardGroupBy === 'project' || boardGroupBy === 'status-project';
        const moveTargets = canMoveProject ? projectSuggestions.filter((item) => item.name !== '').slice(0, 40) : [];
        const actionsId = `ttl-board-actions-${String(todo.id).replace(/[^A-Za-z0-9_-]/g, '-')}`;
        return h(
          'article',
          {
            key: todo.id,
            className: isEditing ? 'ttl-board-card ttl-board-card-editing' : 'ttl-board-card',
            'data-status': todo.status,
            role: 'listitem',
            onKeyDown: (event) => {
              if (!event || event.key !== 'Escape') return;
              if (actionsOpen || isConfirming) {
                event.stopPropagation();
                setBoardActionsId(null);
                setConfirmId(null);
              }
            },
          },
          isEditing
            ? h(
                'div',
                { className: 'ttl-board-edit' },
                titleInput(todo),
                projectInput(todo),
                prioritySelectControl(editingPriority, setEditingPriority, busyId === todo.id),
                typeSelectControl(editingType, setEditingType, busyId === todo.id)
              )
            : [
                h(
                  'button',
                  {
                    key: 'check',
                    type: 'button',
                    className: 'ttl-board-check',
                    role: 'checkbox',
                    'aria-checked': completed ? 'true' : 'false',
                    'aria-label': t('board.checkAria', { title }),
                    'data-checked': completed ? 'true' : 'false',
                    disabled: isBusy,
                    onClick: () => {
                      void handleToggle(todo);
                    },
                  },
                  boardCheckIcon(completed)
                ),
                h(
                  'div',
                  { key: 'main', className: 'ttl-board-card-main' },
                  h('div', { className: 'ttl-board-card-title', title }, title),
                  h(
                    'div',
                    { className: 'ttl-board-card-meta' },
                    typeBadge(todo),
                    priorityBadge(todo),
                    showProject
                      ? h(
                          'span',
                          { className: 'ttl-board-project', title: projectLabel(project) },
                          h('span', {
                            className: 'ttl-board-dot',
                            'data-status': 'project',
                            'aria-hidden': 'true',
                          }),
                          h('span', { className: 'ttl-board-project-name' }, projectLabel(project))
                        )
                      : null,
                    showStatus ? statusBadge(todo) : null,
                    duration
                  ),
                  files.length > 0
                    ? h('div', { className: 'ttl-board-card-files' }, renderFileChips(todo, { max: 1, compact: true }))
                    : null
                ),
                h(
                  'button',
                  {
                    key: 'more',
                    type: 'button',
                    className: 'ttl-board-more',
                    'aria-expanded': actionsOpen ? 'true' : 'false',
                    'aria-controls': actionsOpen ? actionsId : undefined,
                    'aria-label': t('board.moreAria', { title }),
                    title: t('board.more'),
                    onClick: () => setBoardActionsId(actionsOpen ? null : todo.id),
                  },
                  '⋯'
                ),
                actionsOpen
                  ? h(
                      'div',
                      {
                        key: 'actions',
                        id: actionsId,
                        className: 'ttl-board-card-actions',
                        role: 'group',
                        'aria-label': t('board.more'),
                      },
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'ttl-board-action',
                          onClick: () => {
                            setBoardActionsId(null);
                            startEdit(todo);
                          },
                        },
                        t('row.edit')
                      ),
                      h(
                        'label',
                        { key: 'priority', className: 'ttl-board-move' },
                        h('span', { className: 'ttl-board-action-label' }, t('priority.label')),
                        h(
                          'select',
                          {
                            className: 'ttl-board-move-select',
                            value: normalizePriority(todo.priority),
                            'aria-label': t('priority.label'),
                            disabled: isBusy,
                            onChange: (event) => {
                              void handleSetPriority(todo, event.target.value);
                            },
                          },
                          PRIORITIES.map((entry) =>
                            h('option', { key: entry.value === '' ? 'none' : entry.value, value: entry.value }, t(entry.labelKey))
                          )
                        )
                      ),
                      h(
                        'label',
                        { key: 'type', className: 'ttl-board-move' },
                        h('span', { className: 'ttl-board-action-label' }, t('type.label')),
                        h(
                          'select',
                          {
                            className: 'ttl-board-move-select',
                            value: normalizeType(todo.type),
                            'aria-label': t('type.label'),
                            disabled: isBusy,
                            onChange: (event) => {
                              void handleSetType(todo, event.target.value);
                            },
                          },
                          TYPES.map((entry) =>
                            h('option', { key: entry.value === '' ? 'none' : entry.value, value: entry.value }, t(entry.labelKey))
                          )
                        )
                      ),
                      canMoveProject
                        ? h(
                            'label',
                            { key: 'move', className: 'ttl-board-move' },
                            h(
                              'select',
                              {
                                className: 'ttl-board-move-select',
                                'aria-label': t('board.moveToProject'),
                                disabled: isBusy,
                                onChange: (event) => {
                                  const value = event.target.value;
                                  if (value === '') return;
                                  void handleMoveProject(todo, value === BOARD_MOVE_UNCATEGORIZED ? '' : value);
                                },
                              },
                              h('option', { value: '' }, t('board.moveToPlaceholder')),
                              h('option', { value: BOARD_MOVE_UNCATEGORIZED }, t('project.none')),
                              moveTargets.map((item) => h('option', { key: item.name, value: item.name }, item.name))
                            )
                          )
                        : null,
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'ttl-board-action ttl-board-action-danger',
                          onClick: () => {
                            setBoardActionsId(null);
                            setConfirmId(todo.id);
                          },
                        },
                        t('row.delete')
                      )
                    )
                  : null,
                isConfirming
                  ? h(
                      'div',
                      { key: 'confirm', className: 'ttl-board-confirm', role: 'group', 'aria-label': t('row.confirmDelete') },
                      h('p', { className: 'ttl-board-confirm-text' }, t('board.deleteConfirm')),
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'ttl-board-confirm-delete',
                          disabled: isBusy,
                          onClick: () => {
                            void handleDelete(todo);
                          },
                        },
                        t('row.confirmDelete')
                      ),
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'ttl-board-confirm-cancel',
                          disabled: isBusy,
                          onClick: () => setConfirmId(null),
                        },
                        t('row.cancel')
                      )
                    )
                  : null,
              ]
        );
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

      /** 泳道（状态 × 分类）：行头 = 分类 + 计数 + 折叠；未完成泳道带「＋」。 */
      const renderBoardLane = (column, lane) => {
        const laneKey = `${column.key}|${lane.key}`;
        const collapsed = boardLaneCollapsed[laneKey] === true;
        const actionLabel = t(collapsed ? 'detail.expand' : 'detail.collapse');
        const toggleAria = t('board.laneToggleAria', { action: actionLabel, name: lane.label });
        return h(
          'div',
          {
            key: lane.key,
            className: 'ttl-board-lane',
            role: 'group',
            'aria-label': t('board.laneAria', { name: lane.label, count: lane.items.length }),
          },
          h(
            'div',
            { className: 'ttl-board-lane-head' },
            h(
              'button',
              {
                type: 'button',
                className: 'ttl-board-lane-toggle',
                'aria-expanded': collapsed ? 'false' : 'true',
                'aria-label': toggleAria,
                title: toggleAria,
                onClick: () =>
                  setBoardLaneCollapsed((current) => {
                    const next = { ...current };
                    if (next[laneKey] === true) delete next[laneKey];
                    else next[laneKey] = true;
                    return next;
                  }),
              },
              h('span', { className: 'ttl-board-lane-caret', 'aria-hidden': 'true' }, collapsed ? '▸' : '▾'),
              h('span', { className: 'ttl-board-lane-name' }, lane.label),
              h('span', { className: 'ttl-board-lane-count' }, String(lane.items.length))
            ),
            column.status === 'pending'
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'ttl-board-add',
                    'aria-label': t('board.addToLane', { project: lane.label }),
                    title: t('board.addToLane', { project: lane.label }),
                    onClick: () => handleLaneAdd(lane),
                  },
                  '+'
                )
              : null
          ),
          collapsed
            ? null
            : h('div', { className: 'ttl-board-list', role: 'list' }, lane.items.map(renderBoardCard))
        );
      };

      const renderBoardColumn = (column) => {
        const total = column.items.length;
        const isCompletedColumn = column.status === 'completed';
        const lanes = Array.isArray(column.lanes) ? column.lanes : null;
        const orderedItems =
          !lanes && isCompletedColumn && total > 1
            ? column.items.slice().sort((left, right) => (toMillis(right.completedAt) || 0) - (toMillis(left.completedAt) || 0))
            : column.items;
        const visibleItems =
          !lanes && isCompletedColumn && !boardShowAllCompleted
            ? orderedItems.slice(0, BOARD_COMPLETED_LIMIT)
            : orderedItems;
        const hiddenCount = total - visibleItems.length;
        const canAdd = column.project !== undefined || column.status === 'pending';
        return h(
          'div',
          {
            key: column.key,
            className: 'ttl-board-column',
            role: 'group',
            'aria-label': t('board.columnAria', { name: column.label, count: total }),
            'data-group': column.key,
          },
          h(
            'header',
            { className: 'ttl-board-column-head' },
            h(
              'h2',
              { className: 'ttl-board-column-title' },
              column.dot !== ''
                ? h('span', { className: 'ttl-board-dot', 'data-status': column.dot, 'aria-hidden': 'true' })
                : null,
              h('span', { className: 'ttl-board-column-name' }, column.label)
            ),
            h('span', { className: 'ttl-board-column-count', 'aria-hidden': 'true' }, String(total)),
            canAdd
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'ttl-board-add',
                    'aria-label': t('board.addToColumn', { name: column.label }),
                    title: t('board.addToColumn', { name: column.label }),
                    onClick: () => handleColumnAdd(column),
                  },
                  '+'
                )
              : null
          ),
          h(
            'div',
            {
              className: 'ttl-board-column-body',
              role: 'group',
              tabIndex: 0,
              'aria-label': t('board.columnBodyAria', { name: column.label, count: total }),
            },
            lanes
              ? lanes.length === 0
                ? h('p', { className: 'ttl-board-column-empty' }, t(emptyColumnKey(column)))
                : h('div', { className: 'ttl-board-lanes' }, lanes.map((lane) => renderBoardLane(column, lane)))
              : visibleItems.length === 0
                ? h('p', { className: 'ttl-board-column-empty' }, t(emptyColumnKey(column)))
                : h('div', { className: 'ttl-board-list', role: 'list' }, visibleItems.map(renderBoardCard)),
            !lanes && hiddenCount > 0
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'ttl-board-showmore',
                    onClick: () => setBoardShowAllCompleted(true),
                  },
                  t('board.showAll', { count: total })
                )
              : null,
            !lanes && isCompletedColumn && boardShowAllCompleted && total > BOARD_COMPLETED_LIMIT
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'ttl-board-showmore',
                    onClick: () => setBoardShowAllCompleted(false),
                  },
                  t('board.showRecent', { count: BOARD_COMPLETED_LIMIT })
                )
              : null
          )
        );
      };

      const renderBoardView = () => {
        if (visibleTodos.length === 0) {
          return h(TextPlaceholder, {
            titleKey: 'board.empty',
            actionKey: emptyActionKey,
            onAction: handleEmptyAction,
          });
        }
        const columns = boardColumns(visibleTodos, boardGroupBy);
        return h(
          'div',
          {
            className: density === 'compact' ? 'ttl-board ttl-board-compact' : 'ttl-board',
            role: 'region',
            'aria-label': t('board.aria'),
            tabIndex: 0,
          },
          columns.map(renderBoardColumn)
        );
      };
      //#endregion

      //#region 日历视图
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

      const renderCalendarView = () => {
        if (visibleTodos.length === 0) {
          return h(TextPlaceholder, {
            titleKey: 'calendar.empty',
            actionKey: emptyActionKey,
            onAction: handleEmptyAction,
          });
        }
        const cells = buildCalendarCells(calendarYear, calendarMonth);
        const entriesByDay = {};
        for (const todo of visibleTodos) {
          const key = calendarDayKey(todo, calendarBasis);
          if (key === '') continue; // 非法/缺失时间跳过该条
          if (!entriesByDay[key]) entriesByDay[key] = [];
          entriesByDay[key].push(todo);
        }
        const timeField = calendarBasis === 'completedAt' ? 'completedAt' : 'createdAt';
        for (const key of Object.keys(entriesByDay)) {
          entriesByDay[key].sort((left, right) => {
            const a = toMillis(left[timeField]);
            const b = toMillis(right[timeField]);
            if (a === null && b === null) return 0;
            if (a === null) return 1;
            if (b === null) return -1;
            return a - b;
          });
        }
        const monthHasEntries = cells.some(
          (cell) => cell.inMonth && (entriesByDay[cell.key] || []).length > 0
        );
        const selectedEntries = calendarSelectedDay === null ? [] : entriesByDay[calendarSelectedDay] || [];

        const renderCell = (cell) => {
          const items = entriesByDay[cell.key] || [];
          const visible = items.slice(0, CALENDAR_MAX_ITEMS);
          const hidden = items.length - visible.length;
          const selected = calendarSelectedDay === cell.key;
          let className = 'ttl-calendar-cell';
          if (!cell.inMonth) className += ' ttl-calendar-cell-outside';
          if (cell.isToday) className += ' ttl-calendar-cell-today';
          if (selected) className += ' ttl-calendar-cell-selected';
          return h(
            'button',
            {
              key: cell.key,
              type: 'button',
              className,
              'aria-pressed': selected ? 'true' : 'false',
              'aria-label': t('calendar.dayAria', { date: cell.key, count: items.length }),
              onClick: () => setCalendarSelectedDay(cell.key),
            },
            h('span', { className: 'ttl-calendar-daynum', 'aria-hidden': 'true' }, String(cell.day)),
            h(
              'span',
              { className: 'ttl-calendar-items', 'aria-hidden': 'true' },
              visible.map((todo) =>
                h(
                  'span',
                  {
                    key: todo.id,
                    className:
                      todo.status === 'completed' ? 'ttl-calendar-item ttl-calendar-item-completed' : 'ttl-calendar-item',
                    title: todo.title === '' ? t('list.empty') : todo.title,
                  },
                  todo.title === '' ? t('list.empty') : todo.title
                )
              ),
              hidden > 0 ? h('span', { className: 'ttl-calendar-more' }, t('calendar.more', { count: hidden })) : null
            )
          );
        };

        const renderDayItem = (todo) => {
          const completed = todo.status === 'completed';
          const isEditing = editingId === todo.id;
          return h(
            'li',
            { key: todo.id, className: 'ttl-calendar-entry', 'data-status': todo.status },
            isEditing
              ? h('div', { className: 'ttl-calendar-entry-edit' }, titleInput(todo), projectInput(todo))
              : h(
                  'div',
                  { className: 'ttl-calendar-entry-main' },
                  h(
                    'span',
                    { className: 'ttl-calendar-entry-title', title: todo.title === '' ? t('list.empty') : todo.title },
                    todo.title === '' ? t('list.empty') : todo.title
                  ),
                  h('span', { className: 'ttl-calendar-entry-badges' }, h(ProjectBadge, { project: normalizeProject(todo.project) }), statusBadge(todo))
                ),
            h(
              'div',
              { className: 'ttl-calendar-entry-meta' },
              h('span', null, h('span', { className: 'ttl-time-label' }, t('list.created')), formatTime(todo.createdAt)),
              h(
                'span',
                null,
                h('span', { className: 'ttl-time-label' }, t('list.completed')),
                completed ? formatTime(todo.completedAt) : EMPTY_TIME
              )
            ),
            normalizeFiles(todo.files).length > 0
              ? h('div', { className: 'ttl-calendar-entry-files' }, renderFileChips(todo))
              : null,
            h('div', { className: 'ttl-calendar-entry-actions' }, renderActionButtons(todo, { showDetail: false }))
          );
        };

        return h(
          'section',
          { className: 'ttl-calendar', 'aria-label': t('calendar.aria') },
          h(
            'div',
            { className: 'ttl-calendar-head' },
            h('h2', { className: 'ttl-calendar-title' }, t('calendar.monthTitle', { year: calendarYear, month: calendarMonth + 1 }))
          ),
          h(
            'div',
            { className: 'ttl-calendar-weekdays' },
            CALENDAR_WEEKDAY_KEYS.map((key) => h('span', { key, className: 'ttl-calendar-weekday' }, t(key)))
          ),
          h('div', { className: 'ttl-calendar-grid' }, cells.map(renderCell)),
          monthHasEntries ? null : h('p', { className: 'ttl-calendar-month-empty' }, t('calendar.monthEmpty')),
          calendarSelectedDay === null
            ? null
            : h(
                'div',
                { className: 'ttl-calendar-panel' },
                h(
                  'h3',
                  { className: 'ttl-calendar-panel-title' },
                  t('calendar.dayTitle', { date: calendarSelectedDay, count: selectedEntries.length })
                ),
                selectedEntries.length === 0
                  ? h('p', { className: 'ttl-calendar-day-empty' }, t('calendar.dayEmpty'))
                  : h('ul', { className: 'ttl-calendar-day-list' }, selectedEntries.map(renderDayItem))
              )
        );
      };
      //#endregion

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
        listBody = h(GanttView, {
          todos: visibleTodos,
          range,
          emptyActionKey,
          onEmptyAction: handleEmptyAction,
          expandedIds: ganttExpandedIds,
          onToggleExpanded: toggleGanttExpanded,
          editingId,
          renderDetailContent,
          renderEditFields: (todo) =>
            h(
              'div',
              { className: 'ttl-gantt-row-edit' },
              titleInput(todo),
              projectInput(todo),
              prioritySelectControl(editingPriority, setEditingPriority, busyId === todo.id),
              typeSelectControl(editingType, setEditingType, busyId === todo.id)
            ),
          renderActions: (todo) => renderActionButtons(todo, { showDetail: false }),
        });
      } else if (view === 'board') {
        listBody = renderBoardView();
      } else if (view === 'calendar') {
        listBody = renderCalendarView();
      } else {
        listBody = renderTableView();
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
            h('span', { className: 'ttl-seg-count' }, String(filterCounts[entry.value] || 0))
          )
        )
      );

      const sortSelect = h(
        'label',
        { className: 'ttl-select' },
        h('span', null, t('sort.label')),
        h(
          'select',
          {
            value: sortBy,
            'aria-label': t('sort.label'),
            onChange: (event) => setSortBy(event.target.value),
          },
          SORTS.map((entry) =>
            h('option', { key: entry.value, value: entry.value }, t(entry.labelKey))
          )
        )
      );

      const directionLabel = t(direction === 'asc' ? 'direction.asc' : 'direction.desc');
      const directionToggle = h(
        'button',
        {
          type: 'button',
          className: 'ttl-sort-dir',
          'aria-label': t('direction.toggleAria', { direction: directionLabel }),
          title: t('direction.toggleAria', { direction: directionLabel }),
          onClick: () => setDirection(direction === 'asc' ? 'desc' : 'asc'),
        },
        h('span', { 'aria-hidden': 'true' }, direction === 'asc' ? '↑' : '↓')
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
                    'aria-expanded': chatOpen ? 'true' : 'false',
                    'aria-controls': chatOpen ? 'ttl-chat-panel' : undefined,
                    'aria-label': chatOpen ? t('chat.collapse') : t('chat.expand'),
                    title: chatOpen ? t('chat.collapse') : t('chat.expand'),
                    onClick: () => setChatOpen((value) => !value),
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
                    h('path', { d: chatOpen ? 'M4 10l4-4 4 4' : 'M4 6l4 4-4 4' })
                  ),
                  t('chat.title')
                )
              )
            ),
            // 新建待办：整页唯一的主操作区。
            h(
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
                  type: 'submit',
                  className: 'ttl-button ttl-button-primary',
                  disabled: creating || newTitle.trim() === '',
                },
                creating ? t('create.actionBusy') : t('create.action')
              )
            ),
            // 对话录入：按需展开的次要录入方式，默认收起，不与新建抢注意力。
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
                  onToggle: () => setChatOpen((value) => !value),
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
              : null,
            // 数据区：视图切换与列表同属一张卡片。
            h(
              'div',
              { className: 'ttl-data' },
              h(
                'div',
                { className: 'ttl-toolbar' },
                h(
                  'div',
                  { className: 'ttl-group' },
                  viewToggle,
                  view === 'table'
                    ? filterTabs
                    : view === 'board'
                      ? h(React.Fragment, null, boardGroupSelect, densitySelect, filterTabs)
                      : view === 'gantt'
                        ? rangeSelect
                        : calendarBasisSelect
                ),
                h(
                  'div',
                  { className: 'ttl-group' },
                  searchInput,
                  projectFilterSelect,
                  typeFilterSelect,
                  view === 'table' ? sortSelect : null,
                  view === 'table' ? directionToggle : null,
                  view === 'calendar' ? calendarNav : null,
                  h(
                    'span',
                    { className: 'ttl-refreshing', 'aria-live': 'polite' },
                    refreshing && listStatus !== 'loading' ? t('list.refreshing') : ''
                  )
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
        )
      );
    }


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
    //#endregion

    //#region @ 输入触发来源（待办分类）
    /** 读取 session 对应的工作区路径；拿不到返回 ''（不抛错）。 */
    function sessionWorkspaceOf(ctx, session) {
      try {
        if (session && typeof session === 'object' && typeof session.cwd === 'string' && session.cwd !== '') {
          return session.cwd;
        }
        if (!ctx || typeof ctx.get !== 'function') return '';
        const sessions = ctx.get('sessions');
        const list = sessions && sessions.list;
        if (!list || typeof list.getSnapshot !== 'function') return '';
        const snapshot = list.getSnapshot();
        const byId = snapshot && snapshot.byId;
        const sessionId = session && session.sessionId;
        if (byId === null || byId === undefined || sessionId === undefined) return '';
        const summary = byId[sessionId];
        return summary && typeof summary.cwd === 'string' ? summary.cwd : '';
      } catch (error) {
        return '';
      }
    }

    /**
     * 只读读取主输入框草稿文本（唯一 DOM 读取点）。
     * 平台不提供命令态信息，只能 best-effort 用当前 contenteditable 文本判断
     * 是否处于 `/todo` 草稿；任何异常都返回 ''（不影响菜单与其它来源）。
     */
    function readComposerDraftText() {
      try {
        if (typeof document === 'undefined') return '';
        const active = document.activeElement;
        if (!active) return '';
        const host = active.isContentEditable
          ? active
          : active.closest
            ? active.closest('[contenteditable="true"]')
            : null;
        if (!host) return '';
        return String(host.textContent === null || host.textContent === undefined ? '' : host.textContent);
      } catch (error) {
        return '';
      }
    }

    /** 草稿门控：草稿必须以 `/todo` 开头（后接空白或结束）；普通消息不显示该 @ 分组。 */
    const TODO_DRAFT_GATE = /^\s*\/todo(?:\s|$)/i;

    /**
     * 注册到平台输入触发流水线的「待办分类」来源（trigger '@'）。
     * 候选来自 /projects（带当前 session 工作区），选中后由 onPick 返回
     * `#分类 `（含空白用 `[名称] `）文本，让 `/todo 写周报 @` → `#lib `。
     * 仅在 `/todo` 草稿里返回候选；普通消息的 @ 菜单不出现该分组。
     *
     * 这里是主输入框的 @ 菜单，只列「已用分类 / 工作区」两类；工作区里的
     * 文件夹（docs、lib、test…）对 `#分类` 是噪音，不在这份候选里出现
     * （面板自己的分类选择器仍然保留文件夹来源）。
     */
    function createTodoProjectSource(ctx) {
      return {
        trigger: '@',
        name: 'dsh-todo-time-log.projects',
        // First group in the `@` menu: the platform renders every registered
        // source (files/sessions included, which a plugin cannot remove), so at
        // least keep the todo-category group on top and Enter-selectable.
        order: -100,
        // Group titles are suppressed: every row already carries a `section`,
        // and while the first candidates are still loading the platform would
        // otherwise print the raw source id (which is not an i18n key).
        showGroupTitle: false,
        async candidates(session, requestInfo) {
          // 门控：非 /todo 草稿直接返回空候选，且不发起 /projects 请求。
          const draft = readComposerDraftText();
          if (!TODO_DRAFT_GATE.test(draft)) return [];
          const info = requestInfo && typeof requestInfo === 'object' ? requestInfo : {};
          const query = typeof info.query === 'string' ? info.query : '';
          const signal = info.signal;
          try {
            if (signal && signal.aborted === true) return [];
            const workspace = sessionWorkspaceOf(ctx, session);
            const body = {};
            if (workspace !== '') body.workspace = workspace;
            const value = await request('/projects', body);
            if (signal && signal.aborted === true) return [];
            const suggestions = normalizeProjectSuggestions(value && value.suggestions);
            const needle = query.toLowerCase();
            const rows = [];
            for (const item of suggestions) {
              // @ 菜单只保留「已用分类 / 工作区」，跳过工作区文件夹。
              if (item.source === 'folder') continue;
              if (needle !== '' && item.name.toLowerCase().indexOf(needle) === -1) continue;
              rows.push({
                name: item.name,
                label: item.name,
                description:
                  item.source === 'used'
                    ? t('command.sourceUsed', { count: item.count })
                    : t('command.sourceWorkspace'),
                section: t('command.groupTodoProjects'),
                value: item.name,
              });
              if (rows.length >= 8) break;
            }
            // 优先级 / 类型：选中后插入 `!high ` / `^bug `，避免完全手打标记。
            for (const entry of PRIORITIES) {
              if (entry.value === '') continue;
              const marker = `!${entry.value}`;
              const label = t(entry.labelKey);
              if (needle !== '' && label.toLowerCase().indexOf(needle) === -1 && marker.indexOf(needle) === -1) continue;
              rows.push({
                name: `__ttl_priority__:${entry.value}`,
                label,
                description: t('command.sourceMarker', { marker }),
                section: t('command.groupTodoPriorities'),
                value: `__ttl_priority__:${entry.value}`,
              });
            }
            for (const entry of TYPES) {
              if (entry.value === '') continue;
              const marker = `^${entry.value}`;
              const label = t(entry.labelKey);
              if (needle !== '' && label.toLowerCase().indexOf(needle) === -1 && marker.indexOf(needle) === -1) continue;
              rows.push({
                name: `__ttl_type__:${entry.value}`,
                label,
                description: t('command.sourceMarker', { marker }),
                section: t('command.groupTodoTypes'),
                value: `__ttl_type__:${entry.value}`,
              });
            }
            return rows;
          } catch (error) {
            // 请求失败/中止时静默返回空候选，不影响面板与其它 @ 来源。
            return [];
          }
        },
        onPick(payload) {
          const pick = payload && typeof payload === 'object' ? payload : {};
          const candidate = pick.candidate && typeof pick.candidate === 'object' ? pick.candidate : {};
          const raw =
            typeof candidate.value === 'string' && candidate.value !== ''
              ? candidate.value
              : typeof candidate.name === 'string'
                ? candidate.name
                : '';
          if (raw === '') return { text: '' };
          // 优先级 / 类型候选项：编码在 value 里，选中后插入标记文本。
          if (raw.indexOf('__ttl_priority__:') === 0) {
            const value = raw.slice('__ttl_priority__:'.length);
            const known = PRIORITIES.some((entry) => entry.value === value && value !== '');
            return { text: known ? `!${value} ` : '' };
          }
          if (raw.indexOf('__ttl_type__:') === 0) {
            const value = raw.slice('__ttl_type__:'.length);
            const known = TYPES.some((entry) => entry.value === value && value !== '');
            return { text: known ? `^${value} ` : '' };
          }
          // 只返回文本（不要 insert），避免被平台当成引用/附件 chip。
          return { text: formatProjectTag(raw) };
        },
      };
    }

    /** 注册输入触发来源：优先 ctx.inject，退化为 ctx.get；注册失败只 warn，不破坏面板。 */
    function registerTodoProjectSource(ctx, source) {
      const warn = (error) => {
        try {
          if (typeof console !== 'undefined' && typeof console.warn === 'function') {
            console.warn('[dsh-todo-time-log] input trigger source registration failed:', error);
          }
        } catch (ignored) {
          // 忽略日志失败
        }
      };
      try {
        if (ctx && typeof ctx.inject === 'function') {
          try {
            ctx.inject(['inputTriggers'], (scope) => {
              try {
                scope.effect(() => scope.inputTriggers.registerSource(source));
              } catch (error) {
                warn(error);
              }
            });
          } catch (error) {
            warn(error);
          }
          return;
        }
        if (ctx && typeof ctx.get === 'function') {
          const service = ctx.get('inputTriggers');
          if (service && typeof service.registerSource === 'function' && typeof ctx.effect === 'function') {
            ctx.effect(() => service.registerSource(source));
          }
        }
      } catch (error) {
        warn(error);
      }
    }
    //#endregion

    return {
      inject: ['slots'],
      apply(ctx) {
        // 主面板：keyed 槽，key 与侧边栏 id 相同，点击侧栏图标即打开本面板。
        ctx.slots.inject('main', () =>
          ctx.slots.register(
            {
              name: 'main',
              key: 'dsh-todo-time-log',
            },
            Panel
          )
        );
        // 侧边栏入口：id 会作为 main 槽的 key；label 为固定中文标题。
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: 'dsh-todo-time-log',
              order: 30,
              label: () => '待办时间日志',
            },
            Icon
          )
        );
        // 主输入框/@ 菜单：注册「待办分类」来源（选中写入 #分类 文本）。
        try {
          registerTodoProjectSource(ctx, createTodoProjectSource(ctx));
        } catch (error) {
          try {
            if (typeof console !== 'undefined' && typeof console.warn === 'function') {
              console.warn('[dsh-todo-time-log] input trigger source setup failed:', error);
            }
          } catch (ignored) {
            // 忽略日志失败
          }
        }
      },
    };
  },
});
