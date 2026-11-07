export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

export function slugify(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function submitForm(e, message) { e.preventDefault(); const result = e.currentTarget.querySelector('.form-success'); if (result) { result.textContent = '✓ ' + message; result.classList.add('show'); } const btn = e.currentTarget.querySelector('button[type="submit"],button:not([type])'); if (btn) { btn.disabled = true; btn.textContent = 'Đã gửi'; } }