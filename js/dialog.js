import { escapeHtml } from './utils.js';

// Toast notification container
let toastContainer = null;
function getToastContainer() {
  if (!toastContainer || !document.body.contains(toastContainer)) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'custom-toast-container';
    toastContainer.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

/**
 * Hiển thị thông báo Toast nổi trên màn hình
 * @param {string} message 
 * @param {'info' | 'success' | 'error' | 'warning'} type 
 * @param {number} duration 
 */
export function showToast(message, type = 'info', duration = 3500) {
  const container = getToastContainer();
  const toast = document.createElement('div');
  toast.className = `custom-toast toast-${type}`;

  const iconMap = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };
  const icon = iconMap[type] || '🔔';

  toast.innerHTML = `
    <span class="custom-toast-icon">${icon}</span>
    <div class="custom-toast-body">${escapeHtml(message)}</div>
    <button class="custom-toast-close" type="button" aria-label="Đóng">&times;</button>
  `;

  const closeToast = () => {
    toast.classList.add('toast-leaving');
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 200);
  };

  toast.querySelector('.custom-toast-close').addEventListener('click', closeToast);
  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(closeToast, duration);
  }
}

/**
 * Hiển thị hộp thoại xác nhận thay thế window.confirm()
 * @param {Object} options 
 * @returns {Promise<boolean>}
 */
export function showConfirm({
  title = 'Xác nhận thao tác',
  message = '',
  confirmText = 'Xác nhận',
  cancelText = 'Hủy bỏ',
  confirmType = 'primary', // 'primary' | 'success' | 'danger' | 'warning'
  icon = null,
} = {}) {
  return new Promise((resolve) => {
    const existing = document.querySelector('#custom-dialog-backdrop');
    if (existing) existing.remove();

    const defaultIconMap = {
      primary: '❓',
      success: '🤝',
      danger: '⚠️',
      warning: '⚠️',
    };
    const iconDisplay = icon || defaultIconMap[confirmType] || '❓';

    const btnColorMap = {
      primary: 'background:#0284c7;color:#fff;border-color:#0284c7',
      success: 'background:#16a34a;color:#fff;border-color:#16a34a',
      danger: 'background:#dc2626;color:#fff;border-color:#dc2626',
      warning: 'background:#d97706;color:#fff;border-color:#d97706',
    };
    const actionBtnStyle = btnColorMap[confirmType] || btnColorMap.primary;

    const backdrop = document.createElement('div');
    backdrop.id = 'custom-dialog-backdrop';
    backdrop.className = 'custom-dialog-backdrop';
    backdrop.innerHTML = `
      <div class="custom-dialog-card" role="dialog" aria-modal="true">
        <div class="custom-dialog-icon-badge badge-${confirmType}">${iconDisplay}</div>
        <h3 class="custom-dialog-title">${escapeHtml(title)}</h3>
        <div class="custom-dialog-message">${escapeHtml(message).replace(/\r?\n|\\n/g, '<br>')}</div>
        <div class="custom-dialog-actions">
          <button class="btn btn-light" type="button" id="custom-dialog-cancel">${escapeHtml(cancelText)}</button>
          <button class="btn" type="button" id="custom-dialog-confirm" style="${actionBtnStyle}">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    const confirmBtn = backdrop.querySelector('#custom-dialog-confirm');
    const cancelBtn = backdrop.querySelector('#custom-dialog-cancel');

    const cleanup = (result) => {
      window.removeEventListener('keydown', onKeyDown);
      backdrop.classList.add('dialog-leaving');
      setTimeout(() => backdrop.remove(), 180);
      resolve(result);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        cleanup(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    confirmBtn.addEventListener('click', () => cleanup(true));
    cancelBtn.addEventListener('click', () => cleanup(false));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) cleanup(false);
    });

    confirmBtn.focus();
  });
}

/**
 * Hiển thị hộp thoại nhập thông tin thay thế window.prompt()
 * @param {Object} options 
 * @returns {Promise<string | null>}
 */
export function showPrompt({
  title = 'Nhập thông tin',
  message = '',
  placeholder = '',
  defaultValue = '',
  confirmText = 'Xác nhận',
  cancelText = 'Hủy bỏ',
  confirmType = 'primary',
  icon = '✏️',
  multiline = false,
  required = false,
} = {}) {
  return new Promise((resolve) => {
    const existing = document.querySelector('#custom-dialog-backdrop');
    if (existing) existing.remove();

    const btnColorMap = {
      primary: 'background:#0284c7;color:#fff;border-color:#0284c7',
      success: 'background:#16a34a;color:#fff;border-color:#16a34a',
      danger: 'background:#dc2626;color:#fff;border-color:#dc2626',
      warning: 'background:#d97706;color:#fff;border-color:#d97706',
    };
    const actionBtnStyle = btnColorMap[confirmType] || btnColorMap.primary;

    const inputHtml = multiline
      ? `<textarea id="custom-dialog-input" class="custom-dialog-input" rows="3" placeholder="${escapeHtml(placeholder)}">${escapeHtml(defaultValue)}</textarea>`
      : `<input type="text" id="custom-dialog-input" class="custom-dialog-input" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(defaultValue)}">`;

    const backdrop = document.createElement('div');
    backdrop.id = 'custom-dialog-backdrop';
    backdrop.className = 'custom-dialog-backdrop';
    backdrop.innerHTML = `
      <div class="custom-dialog-card" role="dialog" aria-modal="true">
        <div class="custom-dialog-icon-badge badge-${confirmType}">${icon}</div>
        <h3 class="custom-dialog-title">${escapeHtml(title)}</h3>
        ${message ? `<div class="custom-dialog-message">${escapeHtml(message).replace(/\r?\n|\\n/g, '<br>')}</div>` : ''}
        <form id="custom-dialog-form" style="margin:0">
          ${inputHtml}
          <div class="custom-dialog-actions">
            <button class="btn btn-light" type="button" id="custom-dialog-cancel">${escapeHtml(cancelText)}</button>
            <button class="btn" type="submit" id="custom-dialog-confirm" style="${actionBtnStyle}">${escapeHtml(confirmText)}</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(backdrop);

    const input = backdrop.querySelector('#custom-dialog-input');
    const form = backdrop.querySelector('#custom-dialog-form');
    const cancelBtn = backdrop.querySelector('#custom-dialog-cancel');

    const cleanup = (value) => {
      window.removeEventListener('keydown', onKeyDown);
      backdrop.classList.add('dialog-leaving');
      setTimeout(() => backdrop.remove(), 180);
      resolve(value);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        cleanup(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    cancelBtn.addEventListener('click', () => cleanup(null));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = input.value;
      if (required && !val.trim()) {
        input.focus();
        return;
      }
      cleanup(val);
    });

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) cleanup(null);
    });

    input.focus();
    if (input.select) input.select();
  });
}

/**
 * Hiển thị hộp thoại thông báo thay thế window.alert()
 * @param {Object} options 
 * @returns {Promise<void>}
 */
export function showAlert({
  title = 'Thông báo',
  message = '',
  confirmText = 'Đã hiểu',
  type = 'info', // 'info' | 'error' | 'success' | 'warning'
  icon = null,
} = {}) {
  return new Promise((resolve) => {
    const existing = document.querySelector('#custom-dialog-backdrop');
    if (existing) existing.remove();

    const defaultIconMap = {
      info: 'ℹ️',
      error: '❌',
      success: '🎉',
      warning: '⚠️',
    };
    const iconDisplay = icon || defaultIconMap[type] || 'ℹ️';

    const btnColorMap = {
      info: 'background:#0284c7;color:#fff;border-color:#0284c7',
      error: 'background:#dc2626;color:#fff;border-color:#dc2626',
      success: 'background:#16a34a;color:#fff;border-color:#16a34a',
      warning: 'background:#d97706;color:#fff;border-color:#d97706',
    };
    const actionBtnStyle = btnColorMap[type] || btnColorMap.info;

    const backdrop = document.createElement('div');
    backdrop.id = 'custom-dialog-backdrop';
    backdrop.className = 'custom-dialog-backdrop';
    backdrop.innerHTML = `
      <div class="custom-dialog-card" role="dialog" aria-modal="true">
        <div class="custom-dialog-icon-badge badge-${type}">${iconDisplay}</div>
        <h3 class="custom-dialog-title">${escapeHtml(title)}</h3>
        <div class="custom-dialog-message">${escapeHtml(message).replace(/\r?\n|\\n/g, '<br>')}</div>
        <div class="custom-dialog-actions" style="justify-content:center">
          <button class="btn" type="button" id="custom-dialog-ok" style="${actionBtnStyle};min-width:120px">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    const okBtn = backdrop.querySelector('#custom-dialog-ok');
    const cleanup = () => {
      window.removeEventListener('keydown', onKeyDown);
      backdrop.classList.add('dialog-leaving');
      setTimeout(() => backdrop.remove(), 180);
      resolve();
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        cleanup();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    okBtn.addEventListener('click', cleanup);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) cleanup();
    });

    okBtn.focus();
  });
}