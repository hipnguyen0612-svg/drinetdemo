import { supabase } from './supabase.js';

const SESSION_KEY = 'drinet-current-user';

export function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}

export function isAdmin() { return getCurrentUser()?.role === 'admin'; }

export async function initialiseAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { localStorage.removeItem(SESSION_KEY); return null; }
  return hydrateUser(session);
}

async function hydrateUser(session) {
  const { data: profile } = await supabase.from('profiles').select('full_name, phone, role').eq('id', session.user.id).maybeSingle();
  const role = profile?.role || 'student';
  const user = { id: session.user.id, name: profile?.full_name || session.user.user_metadata?.full_name || session.user.email, email: session.user.email, phone: profile?.phone || '', role, roleLabel: role === 'admin' ? 'Quản trị viên' : role === 'teacher' ? 'Giáo viên' : 'Học viên' };
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
}

function saveSessionUser(session) {
  const user = { id: session.user.id, name: session.user.user_metadata?.full_name || session.user.email, email: session.user.email, phone: '', role: 'student', roleLabel: 'Học viên' };
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
}

export async function signInWithSupabase(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: String(email).trim(), password });
  if (error) throw error;
  const user = saveSessionUser(data.session);
  hydrateUser(data.session).catch(() => {});
  return user;
}

export async function signUpWithSupabase({ fullName, email, password }) {
  const { data, error } = await supabase.auth.signUp({ email: String(email).trim(), password, options: { data: { full_name: String(fullName).trim() } } });
  if (error) throw error;
  if (data.session) { saveSessionUser(data.session); hydrateUser(data.session).catch(() => {}); }
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

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function accountPage() {
  const user = getCurrentUser();
  if (!user) return loginPage();
  return `<section class="page-hero"><div class="container"><span class="kicker" style="color:#83c7ff">TÀI KHOẢN DRINET</span><h1>Hồ sơ cá nhân</h1><p>Quản lý thông tin và bảo mật tài khoản của bạn.</p></div></section><main class="container section account-page"><div class="account-summary panel"><span class="account-avatar">${escapeHtml(user.name.charAt(0).toUpperCase())}</span><div><h2>${escapeHtml(user.name)}</h2><p>${escapeHtml(user.email)}</p><span class="tag">${escapeHtml(user.roleLabel)}</span></div></div><div class="account-grid"><form id="profile-form" class="panel login-form"><h2>Thông tin cá nhân</h2><p class="login-intro">Thông tin này được dùng để hỗ trợ các yêu cầu của bạn trên DriNet.</p><label>Họ và tên</label><input name="fullName" autocomplete="name" required value="${escapeHtml(user.name)}"><label>Số điện thoại hoặc Zalo</label><input name="phone" type="tel" autocomplete="tel" value="${escapeHtml(user.phone)}"><button class="btn btn-primary" type="submit">Lưu thông tin</button><p id="profile-message" class="admin-message" aria-live="polite"></p></form><div class="account-security"><form id="email-form" class="panel login-form"><h2>Đổi email</h2><p class="login-intro">Email hiện tại: <b>${escapeHtml(user.email)}</b></p><label>Email mới</label><input name="email" type="email" autocomplete="email" required><button class="btn btn-light" type="submit">Gửi yêu cầu đổi email</button><p id="email-message" class="admin-message" aria-live="polite"></p></form><form id="password-form" class="panel login-form"><h2>Đổi mật khẩu</h2><label>Mật khẩu mới</label><input name="password" type="password" autocomplete="new-password" minlength="6" required><label>Nhập lại mật khẩu mới</label><input name="confirmPassword" type="password" autocomplete="new-password" minlength="6" required><button class="btn btn-light" type="submit">Cập nhật mật khẩu</button><p id="password-message" class="admin-message" aria-live="polite"></p></form><button id="account-sign-out" class="text-button" type="button">Đăng xuất khỏi tài khoản</button></div></div></main>`;
}

export function bindAccountPage() {
  const setMessage = (selector, text, isError = false) => { const message = document.querySelector(selector); message.textContent = text; message.className = `admin-message ${isError ? 'error' : 'success'}`; };
  document.querySelector('#profile-form')?.addEventListener('submit', async (event) => {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    const fullName = String(values.get('fullName')).trim();
    if (!fullName) { setMessage('#profile-message', 'Hãy nhập họ và tên.', true); return; }
    try { const { error } = await supabase.from('profiles').update({ full_name: fullName, phone: String(values.get('phone')).trim() || null }).eq('id', getCurrentUser().id); if (error) throw error; const user = await initialiseAuth(); document.querySelector('.account-button span').textContent = `Hồ sơ · ${user.name}`; document.querySelector('.account-summary h2').textContent = user.name; document.querySelector('.account-avatar').textContent = user.name.charAt(0).toUpperCase(); setMessage('#profile-message', 'Đã lưu thông tin cá nhân.'); } catch (error) { setMessage('#profile-message', error.message || 'Không thể lưu thông tin.', true); }
  });
  document.querySelector('#email-form')?.addEventListener('submit', async (event) => {
    event.preventDefault(); const email = String(new FormData(event.currentTarget).get('email')).trim();
    try { const { error } = await supabase.auth.updateUser({ email }); if (error) throw error; setMessage('#email-message', 'Yêu cầu đã được gửi. Hãy kiểm tra email để xác nhận địa chỉ mới.'); event.currentTarget.reset(); } catch (error) { setMessage('#email-message', error.message || 'Không thể đổi email.', true); }
  });
  document.querySelector('#password-form')?.addEventListener('submit', async (event) => {
    event.preventDefault(); const values = new FormData(event.currentTarget); const password = String(values.get('password'));
    if (password !== String(values.get('confirmPassword'))) { setMessage('#password-message', 'Hai mật khẩu mới không khớp.', true); return; }
    try { const { error } = await supabase.auth.updateUser({ password }); if (error) throw error; setMessage('#password-message', 'Đã cập nhật mật khẩu.'); event.currentTarget.reset(); } catch (error) { setMessage('#password-message', error.message || 'Không thể cập nhật mật khẩu.', true); }
  });
  document.querySelector('#account-sign-out')?.addEventListener('click', async () => { await signOutFromSupabase(); location.hash = '#/'; });
}


export function loginPage() {
  return `<section class="page-hero"><div class="container"><span class="kicker" style="color:#83c7ff">TÀI KHOẢN DRINET</span><h1 id="auth-hero-title">Đăng nhập</h1><p id="auth-hero-desc">Đăng nhập để quản lý tài khoản DriNet của bạn.</p></div></section><main class="container section"><div class="login-card panel"><div id="auth-login-view"><h2>Chào mừng đến DriNet</h2><p class="login-intro">Nhập email và mật khẩu của bạn để tiếp tục.</p><form id="login-form" class="login-form"><label>Email</label><input name="email" type="email" autocomplete="username" required placeholder="name@example.com"><label>Mật khẩu</label><input name="password" type="password" autocomplete="current-password" minlength="6" required placeholder="Nhập mật khẩu"><button class="btn btn-primary" type="submit">Đăng nhập</button></form><div class="login-meta-actions"><button id="password-recovery" class="text-button" type="button">Quên mật khẩu?</button><button id="btn-switch-to-signup" class="btn btn-green btn-sm" type="button">Chưa có tài khoản</button></div></div><div id="auth-signup-view" hidden><h2>Đăng ký tài khoản</h2><p class="login-intro">Tạo tài khoản học viên để bắt đầu hành trình học lái cùng DriNet.</p><form id="signup-form" class="login-form"><label>Họ và tên</label><input name="fullName" autocomplete="name" required placeholder="Ví dụ: Nguyễn Văn A"><label>Email</label><input name="email" type="email" autocomplete="email" required placeholder="name@example.com"><label>Mật khẩu</label><input name="password" type="password" autocomplete="new-password" minlength="6" required placeholder="Tối thiểu 6 ký tự"><button class="btn btn-primary" type="submit">Tạo tài khoản</button></form><div class="login-meta-actions" style="justify-content:flex-end;gap:8px"><span style="font-size:13px;color:var(--muted)">Đã có tài khoản?</span><button id="btn-switch-to-login" class="btn btn-light btn-sm" type="button">Đăng nhập ngay</button></div></div><p id="login-message" class="admin-message" aria-live="polite"></p></div></main>`;
}

export function bindLoginPage() {
  const message = document.querySelector('#login-message');
  const loginView = document.querySelector('#auth-login-view');
  const signupView = document.querySelector('#auth-signup-view');
  const heroTitle = document.querySelector('#auth-hero-title');
  const heroDesc = document.querySelector('#auth-hero-desc');
  const btnSwitchToSignup = document.querySelector('#btn-switch-to-signup');
  const btnSwitchToLogin = document.querySelector('#btn-switch-to-login');

  const setView = (mode) => {
    if (message) {
      message.textContent = '';
      message.className = 'admin-message';
    }
    if (mode === 'signup') {
      if (loginView) loginView.hidden = true;
      if (signupView) signupView.hidden = false;
      if (heroTitle) heroTitle.textContent = 'Đăng ký tài khoản';
      if (heroDesc) heroDesc.textContent = 'Tạo tài khoản học viên để bắt đầu hành trình học lái cùng DriNet.';
      document.querySelector('#signup-form [name="fullName"]')?.focus();
    } else {
      if (signupView) signupView.hidden = true;
      if (loginView) loginView.hidden = false;
      if (heroTitle) heroTitle.textContent = 'Đăng nhập';
      if (heroDesc) heroDesc.textContent = 'Đăng nhập để quản lý tài khoản DriNet của bạn.';
      document.querySelector('#login-form [name="email"]')?.focus();
    }
  };

  btnSwitchToSignup?.addEventListener('click', () => setView('signup'));
  btnSwitchToLogin?.addEventListener('click', () => setView('login'));

  if (location.hash.startsWith('#/dang-ky') || location.hash.includes('mode=signup')) {
    setView('signup');
  }

  const showError = (error) => {
    const text = String(error?.message || '');
    if (!message) return;
    message.textContent = /invalid login credentials/i.test(text) ? 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại hoặc chọn “Quên mật khẩu?”.' : /email not confirmed/i.test(text) ? 'Email chưa được xác nhận. Hãy kiểm tra hộp thư của bạn rồi thử lại.' : text || 'Không thể thực hiện yêu cầu. Vui lòng thử lại.';
    message.className = 'admin-message error';
  };
  document.querySelector('#login-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const button = event.currentTarget.querySelector('button[type="submit"]');
    try {
      button.disabled = true;
      button.textContent = 'Đang đăng nhập…';
      await signInWithSupabase(form.get('email'), form.get('password'));
      location.hash = '#/ho-so';
    } catch (error) {
      showError(error);
    } finally {
      button.disabled = false;
      button.textContent = 'Đăng nhập';
    }
  });
  document.querySelector('#signup-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    try {
      button.disabled = true;
      button.textContent = 'Đang tạo tài khoản…';
      const data = await signUpWithSupabase(Object.fromEntries(new FormData(event.currentTarget)));
      if (!message) return;
      message.textContent = data.session ? 'Tạo tài khoản thành công. Bạn đã đăng nhập.' : 'Tạo tài khoản thành công. Hãy kiểm tra email để xác nhận trước khi đăng nhập.';
      message.className = 'admin-message success';
      if (data.session) location.hash = '#/';
    } catch (error) {
      showError(error);
    } finally {
      button.disabled = false;
      button.textContent = 'Tạo tài khoản';
    }
  });
  document.querySelector('#password-recovery')?.addEventListener('click', async () => {
    const email = document.querySelector('#login-form [name="email"]')?.value;
    if (!message) return;
    if (!email) { message.textContent = 'Hãy nhập email ở form đăng nhập trước.'; message.className = 'admin-message error'; return; }
    try { await sendPasswordRecovery(email); message.textContent = 'Nếu email tồn tại, DriNet đã gửi hướng dẫn đặt lại mật khẩu. Hãy kiểm tra hộp thư.'; message.className = 'admin-message success'; } catch (error) { showError(error); }
  });
}
