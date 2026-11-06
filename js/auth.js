import { supabase } from './supabase.js';

const SESSION_KEY = 'drinet-current-user';

export function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}

export function isAdmin() { return getCurrentUser()?.role === 'admin'; }

export async function initialiseAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { localStorage.removeItem(SESSION_KEY); return null; }
  const { data: profile, error } = await supabase.from('profiles').select('full_name, role').eq('id', session.user.id).single();
  if (error) throw error;
  const user = { id: session.user.id, name: profile.full_name || session.user.email, email: session.user.email, role: profile.role, roleLabel: profile.role === 'admin' ? 'Quản trị viên' : profile.role === 'teacher' ? 'Giáo viên' : 'Học viên' };
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
}

export async function signInWithSupabase(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email: String(email).trim(), password });
  if (error) throw error;
  return initialiseAuth();
}

export async function signUpWithSupabase({ fullName, email, password }) {
  const { data, error } = await supabase.auth.signUp({ email: String(email).trim(), password, options: { data: { full_name: String(fullName).trim() } } });
  if (error) throw error;
  if (data.session) await initialiseAuth();
  return data;
}

export async function signOutFromSupabase() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  localStorage.removeItem(SESSION_KEY);
}

export async function sendPasswordRecovery(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(String(email).trim(), { redirectTo: `${location.origin}${location.pathname}` });
  if (error) throw error;
}

export function loginPage() {
  const currentUser = getCurrentUser();
  const signedOut = `<h2>Chào mừng đến DriNet</h2><p class="login-intro">Đăng nhập hoặc tạo tài khoản để quản lý nhu cầu học và gửi hồ sơ giáo viên.</p><form id="login-form" class="login-form"><label>Email</label><input name="email" type="email" autocomplete="username" required><label>Mật khẩu</label><input name="password" type="password" autocomplete="current-password" minlength="6" required><button class="btn btn-primary" type="submit">Đăng nhập</button></form><button id="password-recovery" class="text-button" type="button">Quên mật khẩu?</button><hr class="form-divider"><h3>Tạo tài khoản học viên</h3><form id="signup-form" class="login-form"><label>Họ và tên</label><input name="fullName" autocomplete="name" required><label>Email</label><input name="email" type="email" autocomplete="email" required><label>Mật khẩu</label><input name="password" type="password" autocomplete="new-password" minlength="6" required><button class="btn btn-light" type="submit">Tạo tài khoản</button></form><p id="login-message" class="admin-message" aria-live="polite"></p>`;
  const signedIn = `<h2>Bạn đang đăng nhập</h2><p class="login-intro">${currentUser.name} · ${currentUser.roleLabel}</p><div class="login-actions"><button id="sign-out" class="btn btn-light" type="button">Đăng xuất</button>${currentUser.role === 'admin' ? '<a class="btn btn-primary" href="#/admin">Vào trang quản trị</a>' : '<a class="btn btn-primary" href="#/">Về trang chủ</a>'}</div>`;
  return `<section class="page-hero"><div class="container"><span class="kicker" style="color:#83c7ff">TÀI KHOẢN DRINET</span><h1>Đăng nhập</h1><p>Tài khoản bảo vệ bởi Supabase Auth.</p></div></section><main class="container section"><div class="login-card panel">${currentUser ? signedIn : signedOut}</div></main>`;
}

export function bindLoginPage() {
  const message = document.querySelector('#login-message');
  const showError = (error) => {
    const text = String(error?.message || '');
    message.textContent = /invalid login credentials/i.test(text) ? 'Email hoặc mật khẩu không đúng. Tài khoản demo cũ không còn sử dụng được; hãy dùng tài khoản Supabase thật hoặc chọn “Quên mật khẩu?”.' : /email not confirmed/i.test(text) ? 'Email chưa được xác nhận. Hãy kiểm tra hộp thư của bạn rồi thử lại.' : text || 'Không thể thực hiện yêu cầu. Vui lòng thử lại.';
    message.className = 'admin-message error';
  };
  document.querySelector('#login-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await signInWithSupabase(form.get('email'), form.get('password'));
      location.hash = getCurrentUser()?.role === 'admin' ? '#/admin' : '#/';
    } catch (error) {
      showError(error);
    }
  });
  document.querySelector('#signup-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const data = await signUpWithSupabase(Object.fromEntries(new FormData(event.currentTarget)));
      message.textContent = data.session ? 'Tạo tài khoản thành công. Bạn đã đăng nhập.' : 'Tạo tài khoản thành công. Hãy kiểm tra email để xác nhận trước khi đăng nhập.';
      message.className = 'admin-message success';
      if (data.session) location.hash = '#/';
    } catch (error) { showError(error); }
  });
  document.querySelector('#password-recovery')?.addEventListener('click', async () => {
    const email = document.querySelector('#login-form [name="email"]')?.value;
    if (!email) { message.textContent = 'Hãy nhập email ở form đăng nhập trước.'; message.className = 'admin-message error'; return; }
    try { await sendPasswordRecovery(email); message.textContent = 'Nếu email tồn tại, DriNet đã gửi hướng dẫn đặt lại mật khẩu. Hãy kiểm tra hộp thư.'; message.className = 'admin-message success'; } catch (error) { showError(error); }
  });
  document.querySelector('#sign-out')?.addEventListener('click', async () => { await signOutFromSupabase(); location.hash = '#/'; });
}