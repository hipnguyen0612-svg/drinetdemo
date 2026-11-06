const SESSION_KEY = 'drinet-current-user';

export const demoAccounts = [
  { id: 'admin', name: 'Quản trị viên DriNet', role: 'admin', roleLabel: 'Quản trị viên', email: 'admin@drinet.vn', password: 'drinet123' },
  { id: 'teacher', name: 'Nguyễn Minh Đức', role: 'teacher', roleLabel: 'Giáo viên', email: 'duc@drinet.vn', password: 'drinet123' },
  { id: 'student', name: 'Nguyễn Hoàng Anh', role: 'student', roleLabel: 'Học viên', email: 'anh@drinet.vn', password: 'drinet123' },
];

export function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}

export function signIn(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const account = demoAccounts.find((item) => item.email === normalizedEmail && item.password === password);
  if (!account) return false;

  const { password: _, ...sessionUser } = account;
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
  return true;
}

export function signOut() { localStorage.removeItem(SESSION_KEY); }
export function isAdmin() { return getCurrentUser()?.role === 'admin'; }

export function loginPage() {
  const currentUser = getCurrentUser();
  return `<section class="page-hero"><div class="container"><span class="kicker" style="color:#83c7ff">TÀI KHOẢN DRINET</span><h1>Đăng nhập</h1><p>Đăng nhập để sử dụng các chức năng theo vai trò của bạn.</p></div></section><main class="container section"><div class="login-card panel">${currentUser ? `<h2>Bạn đang đăng nhập</h2><p class="login-intro">${currentUser.name} · ${currentUser.roleLabel}</p><div class="login-actions"><button id="sign-out" class="btn btn-light" type="button">Đăng xuất</button>${currentUser.role === 'admin' ? '<a class="btn btn-primary" href="#/admin">Vào trang quản trị</a>' : '<a class="btn btn-primary" href="#/">Về trang chủ</a>'}</div>` : `<h2>Chào mừng trở lại</h2><p class="login-intro">Vui lòng nhập tài khoản và mật khẩu để đăng nhập.</p><form id="login-form" class="login-form"><label for="login-email">Tài khoản hoặc email</label><input id="login-email" name="email" type="email" autocomplete="username" placeholder="name@example.com" required><label for="login-password">Mật khẩu</label><input id="login-password" name="password" type="password" autocomplete="current-password" placeholder="Nhập mật khẩu" required><button class="btn btn-primary" type="submit">Đăng nhập</button></form><p id="login-message" class="admin-message" aria-live="polite"></p>`}</div></main>`;
}

export function bindLoginPage() {
  document.querySelector('#login-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const message = document.querySelector('#login-message');
    if (!signIn(form.get('email'), form.get('password'))) {
      message.textContent = 'Tài khoản hoặc mật khẩu không đúng.';
      message.className = 'admin-message error';
      return;
    }
    location.hash = getCurrentUser()?.role === 'admin' ? '#/admin' : '#/';
  });
  document.querySelector('#sign-out')?.addEventListener('click', () => { signOut(); location.hash = '#/'; });
}