/** 导入 / 导出对话框（纯展示组件）与浏览器端文件读取、下载辅助。 */
import { isRecord } from './helpers.js';
import { t } from './i18n.js';
import { h } from './runtime.js';
import { TRANSFER_MODES } from './styles.js';

/**
 * 触发浏览器下载。不直接操作 document：调用方在本组件外渲染一个隐藏的
 * <a download>，通过 ref 点击它（见 panel.js 的 ttl-download-anchor）。
 *
 * @param {unknown} content
 * @param {unknown} filename
 * @param {unknown} mime
 * @returns {{ url: string, name: string }}
 */
export function makeDownload(content, filename, mime) {
  const text = typeof content === 'string' ? content : '';
  const name = typeof filename === 'string' && filename !== '' ? filename : 'todos.json';
  const type = typeof mime === 'string' && mime !== '' ? mime : 'application/octet-stream';
  try {
    if (
      typeof Blob !== 'undefined'
      && typeof URL !== 'undefined'
      && typeof URL.createObjectURL === 'function'
    ) {
      return { url: URL.createObjectURL(new Blob([text], { type })), name };
    }
  } catch {
    /* fall through to the data URL form */
  }
  return { url: `data:${type},${encodeURIComponent(text)}`, name };
}

/**
 * 读取用户选择的文件为文本。优先用 File.text()，旧浏览器回退 FileReader。
 *
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileText(file) {
  if (file && typeof file.text === 'function') {
    return file.text().then((text) => String(text ?? ''));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsText(file, 'utf-8');
  });
}

function countChip(labelKey, count) {
  const value = Number(count);
  return h(
    'span',
    { className: 'ttl-transfer-count', key: labelKey },
    t(labelKey, { count: Number.isFinite(value) && value > 0 ? Math.floor(value) : 0 }),
  );
}

/**
 * 数据（导入 / 导出）对话框。
 *
 * @param {object} props
 * @returns {import('react').ReactElement | null}
 */
export function TransferDialog(props) {
  const {
    open,
    busy,
    applying,
    fileName,
    mode,
    preview,
    error,
    fileInputRef,
    onClose,
    onExport,
    onPickFile,
    onFileChange,
    onModeChange,
    onConfirm,
  } = props;
  if (open !== true) return null;

  const record = isRecord(preview) ? preview : null;
  const summary = record !== null && isRecord(record.summary) ? record.summary : null;
  const invalid = record !== null && Array.isArray(record.invalid) ? record.invalid.slice(0, 5) : [];
  const invalidCount = record !== null && typeof record.invalidCount === 'number' ? record.invalidCount : 0;
  const rowCount = record !== null && typeof record.rowCount === 'number' ? record.rowCount : 0;
  const activeMode = TRANSFER_MODES.find((option) => option.value === mode) ?? TRANSFER_MODES[0];
  const canConfirm = summary !== null && busy !== true && applying !== true;

  const backdrop = (event) => {
    if (event && event.target === event.currentTarget) onClose();
  };

  return h(
    'div',
    { className: 'ttl-overlay', role: 'presentation', onMouseDown: backdrop },
    h(
      'div',
      {
        className: 'ttl-dialog',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'ttl-transfer-title',
        onKeyDown: (event) => {
          if (event && event.key === 'Escape') {
            event.stopPropagation();
            onClose();
          }
        },
      },
      h(
        'div',
        { className: 'ttl-dialog-head' },
        h('h2', { id: 'ttl-transfer-title', className: 'ttl-dialog-title' }, t('transfer.title')),
        h(
          'button',
          {
            type: 'button',
            className: 'ttl-dialog-close',
            onClick: onClose,
            disabled: busy === true,
            'aria-label': t('transfer.close'),
            autoFocus: true,
          },
          '×',
        ),
      ),
      h(
        'div',
        { className: 'ttl-dialog-body' },
        // 导出
        h(
          'section',
          { className: 'ttl-transfer-section' },
          h('h3', { className: 'ttl-transfer-heading' }, t('transfer.exportTitle')),
          h('p', { className: 'ttl-transfer-hint' }, t('transfer.exportHint')),
          h(
            'div',
            { className: 'ttl-dialog-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'ttl-button ttl-button-outline',
                disabled: busy === true,
                onClick: () => onExport('json'),
              },
              t('transfer.exportJson'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'ttl-button ttl-button-outline',
                disabled: busy === true,
                onClick: () => onExport('csv'),
              },
              t('transfer.exportCsv'),
            ),
          ),
        ),
        // 导入
        h(
          'section',
          { className: 'ttl-transfer-section' },
          h('h3', { className: 'ttl-transfer-heading' }, t('transfer.importTitle')),
          h('p', { className: 'ttl-transfer-hint' }, t('transfer.importHint')),
          h(
            'div',
            { className: 'ttl-dialog-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'ttl-button ttl-button-outline',
                disabled: busy === true,
                onClick: onPickFile,
              },
              t('transfer.chooseFile'),
            ),
            h(
              'span',
              { className: 'ttl-transfer-file', title: typeof fileName === 'string' ? fileName : '' },
              typeof fileName === 'string' && fileName !== '' ? fileName : t('transfer.noFile'),
            ),
          ),
          h('input', {
            ref: fileInputRef,
            className: 'ttl-file-input',
            type: 'file',
            accept: '.json,.csv,application/json,text/csv',
            tabIndex: -1,
            'aria-label': t('transfer.chooseFile'),
            onChange: onFileChange,
          }),
          typeof error === 'string' && error !== ''
            ? h('p', { className: 'ttl-transfer-error', role: 'alert' }, error)
            : null,
          summary !== null
            ? h(
                'div',
                { className: 'ttl-transfer-preview' },
                h('div', { className: 'ttl-transfer-preview-title' }, t('transfer.previewTitle')),
                h(
                  'div',
                  { className: 'ttl-transfer-counts' },
                  countChip('transfer.previewAdded', summary.added),
                  countChip('transfer.previewUpdated', summary.updated),
                  countChip('transfer.previewSkipped', summary.skipped),
                  Number(summary.removed) > 0
                    ? countChip('transfer.previewRemoved', summary.removed)
                    : null,
                  countChip('transfer.previewTotal', summary.total),
                ),
                rowCount > 0 || invalidCount > 0
                  ? h(
                      'p',
                      { className: 'ttl-transfer-rows' },
                      t('transfer.previewRows', { count: rowCount }),
                      invalidCount > 0
                        ? ` · ${t('transfer.previewInvalid', { count: invalidCount })}`
                        : '',
                    )
                  : null,
                invalid.length > 0
                  ? h(
                      'ul',
                      { className: 'ttl-transfer-invalid' },
                      invalid.map((item, index) => h(
                        'li',
                        { key: `invalid-${index}` },
                        t('transfer.rowError', {
                          row: isRecord(item) ? Number(item.row) || 0 : 0,
                          message: isRecord(item) && typeof item.message === 'string'
                            ? item.message
                            : '',
                        }),
                      )),
                    )
                  : null,
                h(
                  'div',
                  { className: 'ttl-transfer-mode' },
                  h('span', { className: 'ttl-transfer-mode-label' }, t('transfer.modeLabel')),
                  h(
                    'select',
                    {
                      value: typeof mode === 'string' ? mode : 'merge',
                      disabled: busy === true,
                      'aria-label': t('transfer.modeLabel'),
                      onChange: (event) => onModeChange(event.target.value),
                    },
                    TRANSFER_MODES.map((option) => h(
                      'option',
                      { key: option.value, value: option.value },
                      t(option.labelKey),
                    )),
                  ),
                ),
                h('p', { className: 'ttl-transfer-mode-hint' }, t(activeMode.hintKey)),
              )
            : h(
                'p',
                { className: 'ttl-transfer-empty' },
                busy === true ? t('transfer.reading') : t('transfer.noPreview'),
              ),
        ),
      ),
      h(
        'div',
        { className: 'ttl-dialog-footer' },
        h(
          'button',
          {
            type: 'button',
            className: 'ttl-button ttl-button-primary',
            disabled: canConfirm !== true,
            onClick: onConfirm,
          },
          applying === true ? t('transfer.importing') : t('transfer.confirm'),
        ),
      ),
    ),
  );
}
