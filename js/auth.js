const SESSION_KEY = 'drinet-current-user';

export const demoAccounts = [
  { id: 'admin', name: 'Quản trị viên DriNet', role: 'admin', roleLabel: 'Quản trị viên', email: 'admin@drinet.vn' },
  { id: 'teacher', name: 'Nguyễn Minh Đức', role: 'teacher', roleLabel: 'Giáo viên', email: 'duc@drinet.vn' },
  { id: 'student', name: 'Nguyễn Hoàng Anh', role: 'student', roleLabel: 'Học viên', email: 'anh@drinet.vn' },
];

export function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}

export function signIn(accountId) {
  const account = demoAccounts.find((item) => item.id === accountId);
  if (!account) return false;
  localStorage.setItem(SESSION_KEY, JSON.stringify(account));
  return true;
}

export function signOut() { localStorage.removeItem(SESSION_KEY); }
export function isAdmin() { return getCurrentUser()?.role === 'admin'; }

export function loginPage() {
  const currentUser = getCurrentUser();
  return `<section class="page-hero"><div class="container"><span class="kicker" style="color:#83c7ff">TÀI KHOẢN DRINET</span><h1>Đăng nhập và chuyển tài khoản</h1><p>Chọn một tài khoản mẫu để trải nghiệm các vai trò trên nền tảng.</p></div></section><main class="container section"><div class="login-card panel"><h2>${currentUser ? `Bạn đang đăng nhập với vai trò ${currentUser.roleLabel}` : 'Chọn tài khoản đăng nhập'}</h2><p class="login-intro">Phiên bản demo không yêu cầu mật khẩu. Tài khoản quản trị có quyền vào trang quản lý giáo viên.</p><div class="account-options">${demoAccounts.map((account) => `<button class="account-option ${currentUser?.id === account.id ? 'selected' : ''}" type="button" data-account-id="${account.id}"><span class="account-avatar">${account.name.charAt(0)}</span><span><b>${account.name}</b><small>${account.roleLabel} · ${account.email}</small></span><span class="account-action">${currentUser?.id === account.id ? 'Đang dùng' : 'Chọn'}</span></button>`).join('')}</div><div class="login-actions">${currentUser ? '<button id="sign-out" class="btn btn-light" type="button">Đăng xuất</button>' : '<a class="btn btn-light" href="#/">Quay về trang chủ</a>'}${currentUser?.role === 'admin' ? '<a class="btn btn-primary" href="#/admin">Vào trang quản trị</a>' : ''}</div><p id="login-message" class="admin-message" aria-live="polite"></p></div></main>`;
}

export function bindLoginPage() {
  document.querySelector('.account-options')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-account-id]');
    if (!button || !signIn(button.dataset.accountId)) return;
    location.hash = button.dataset.accountId === 'admin' ? '#/admin' : '#/';
  });
  document.querySelector('#sign-out')?.addEventListener('click', () => { signOut(); location.hash = '#/'; });
}