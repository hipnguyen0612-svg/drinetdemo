import { supabase } from './supabase.js';
import { teacherDashboardPage, bindTeacherDashboard } from './teacher.js';

const SESSION_KEY = 'drinet-current-user';

export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

export function isAdmin() {
  return getCurrentUser()?.role === 'admin';
}

export async function initialiseAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
  return hydrateUser(session);
}

function getRoleLabel(role) {
  if (role === 'admin') return 'Quản trị viên';
  if (role === 'teacher') return 'Giáo viên';
  return 'Học viên';
}

function saveSessionUser(session) {
  const role = session.user.app_metadata?.role || session.user.user_metadata?.role || 'student';
  const user = {
    id: session.user.id,
    name: session.user.user_metadata?.full_name || session.user.email,
    email: session.user.email,
    phone: '',
    role,
    roleLabel: getRoleLabel(role),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
}

async function hydrateUser(session) {
  const fallbackRole = session.user.app_metadata?.role || session.user.user_metadata?.role || 'student';
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone, role')
      .eq('id', session.user.id)
      .maybeSingle();

    const role = profile?.role || fallbackRole;
    const user = {
      id: session.user.id,
      name: profile?.full_name || session.user.user_metadata?.full_name || session.user.email,
      email: session.user.email,
      phone: profile?.phone || '',
      role,
      roleLabel: getRoleLabel(role),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    return user;
  } catch (err) {
    console.warn('Lỗi khi tải profile chi tiết:', err);
    return saveSessionUser(session);
  }
}

export async function signInWithSupabase(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email).trim(),
    password,
  });
  if (error) throw error;
  saveSessionUser(data.session);
  const user = await hydrateUser(data.session);
  return user;
}

export async function signUpWithSupabase({ fullName, email, password }) {
  const { data, error } = await supabase.auth.signUp({
    email: String(email).trim(),
    password,
    options: {
      data: {
        full_name: String(fullName).trim(),
        role: 'student',
      },
    },
  });
  if (error) throw error;
  if (data.session) {
    saveSessionUser(data.session);
    await hydrateUser(data.session);
  }
  return data;
}

export async function signOutFromSupabase() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  localStorage.removeItem(SESSION_KEY);
}

export async function sendPasswordRecovery(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(String(email).trim(), {
    redirectTo: location.origin + location.pathname,
  });
  if (error) throw error;
}

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);

export function accountPage() {
  const user = getCurrentUser();
  if (!user) return loginPage();
  if (user.role === 'teacher') return teacherDashboardPage();
  return studentAccountPage(user);
}

export function studentAccountPage(user) {
  const adminBanner = user.role === 'admin'
    ? '<div class="teacher-status-banner approved" style="margin-bottom:20px">' +
        '<div>' +
          '<b>🛡️ Tài khoản Quản trị viên hệ thống</b>' +
          '<div style="font-size:13px;margin-top:2px;opacity:.9">Bạn có toàn quyền quản trị hệ thống, duyệt hồ sơ giáo viên và tiếp nhận tin nhắn.</div>' +
        '</div>' +
        '<a class="btn btn-primary btn-sm" href="#/admin">Vào trang Quản trị &rarr;</a>' +
      '</div>'
    : '';

  const studentRequestsSection = user.role === 'student'
    ? '<div class="panel" style="padding:24px;margin-bottom:24px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">' +
          '<div>' +
            '<h3 style="margin:0;color:var(--navy)">Yêu cầu tư vấn của bạn</h3>' +
            '<p style="margin:2px 0 0;font-size:13px;color:var(--muted)">Danh sách yêu cầu tìm giáo viên hoặc khóa học bạn đã gửi.</p>' +
          '</div>' +
          '<a class="btn btn-light btn-sm" href="#/dang-ky-hoc">Đăng ký yêu cầu mới &rarr;</a>' +
        '</div>' +
        '<div id="student-requests-container">' +
          '<div class="drinet-loading-state"><div class="drinet-spinner"></div><p class="drinet-loading-text">Đang tải lịch sử yêu cầu…</p></div>' +
        '</div>' +
      '</div>'
    : '';

  return '<section class="page-hero"><div class="container">' +
    '<span class="kicker" style="color:#83c7ff">TÀI KHOẢN DRINET</span>' +
    '<h1>Hồ sơ cá nhân</h1>' +
    '<p>Quản lý thông tin và bảo mật tài khoản của bạn.</p>' +
    '</div></section>' +
    '<main class="container section account-page">' +
    '<div class="account-summary panel">' +
      '<span class="account-avatar">' + escapeHtml(user.name.charAt(0).toUpperCase()) + '</span>' +
      '<div>' +
        '<h2>' + escapeHtml(user.name) + '</h2>' +
        '<p>' + escapeHtml(user.email) + '</p>' +
        '<span class="tag">' + escapeHtml(user.roleLabel) + '</span>' +
      '</div>' +
    '</div>' +
    adminBanner +
    studentRequestsSection +
    '<div class="account-grid">' +
      '<form id="profile-form" class="panel login-form">' +
        '<h2>Thông tin cá nhân</h2>' +
        '<p class="login-intro">Thông tin này được dùng để hỗ trợ các yêu cầu của bạn trên DriNet.</p>' +
        '<label>Họ và tên</label>' +
        '<input name="fullName" autocomplete="name" required value="' + escapeHtml(user.name) + '">' +
        '<label>Số điện thoại hoặc Zalo</label>' +
        '<input name="phone" type="tel" autocomplete="tel" value="' + escapeHtml(user.phone) + '" placeholder="09xxxxxxxx">' +
        '<button class="btn btn-primary" type="submit">Lưu thông tin</button>' +
        '<p id="profile-message" class="admin-message" aria-live="polite"></p>' +
      '</form>' +
      '<div class="account-security">' +
        '<form id="email-form" class="panel login-form">' +
          '<h2>Đổi email</h2>' +
          '<p class="login-intro">Email hiện tại: <b>' + escapeHtml(user.email) + '</b></p>' +
          '<label>Email mới</label>' +
          '<input name="email" type="email" autocomplete="email" required placeholder="email-moi@example.com">' +
          '<button class="btn btn-light" type="submit">Gửi yêu cầu đổi email</button>' +
          '<p id="email-message" class="admin-message" aria-live="polite"></p>' +
        '</form>' +
        '<form id="password-form" class="panel login-form">' +
          '<h2>Đổi mật khẩu</h2>' +
          '<label>Mật khẩu mới</label>' +
          '<input name="password" type="password" autocomplete="new-password" minlength="6" required placeholder="Tối thiểu 6 ký tự">' +
          '<label>Nhập lại mật khẩu mới</label>' +
          '<input name="confirmPassword" type="password" autocomplete="new-password" minlength="6" required placeholder="Nhập lại mật khẩu">' +
          '<button class="btn btn-light" type="submit">Cập nhật mật khẩu</button>' +
          '<p id="password-message" class="admin-message" aria-live="polite"></p>' +
        '</form>' +
        '<button id="account-sign-out" class="text-button" type="button" style="color:#b72626;font-size:14px;padding:8px 0">🚪 Đăng xuất khỏi hệ thống</button>' +
      '</div>' +
    '</div></main>';
}

export function bindAccountPage() {
  const user = getCurrentUser();
  if (!user) return;
  if (user.role === 'teacher') {
    bindTeacherDashboard();
    return;
  }
  bindStudentAccountPage(user);
}

export function bindStudentAccountPage(user) {
  const setMessage = (selector, text, isError = false) => {
    const message = document.querySelector(selector);
    if (message) {
      message.textContent = text;
      message.className = 'admin-message ' + (isError ? 'error' : 'success');
    }
  };

  document.querySelector('#profile-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const fullName = String(values.get('fullName')).trim();
    if (!fullName) {
      setMessage('#profile-message', 'Hãy nhập họ và tên.', true);
      return;
    }
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, phone: String(values.get('phone')).trim() || null })
        .eq('id', user.id);
      if (error) throw error;
      const updated = await initialiseAuth();
      const btnSpan = document.querySelector('.account-button span');
      if (btnSpan) btnSpan.textContent = updated.name;
      const summaryH2 = document.querySelector('.account-summary h2');
      if (summaryH2) summaryH2.textContent = updated.name;
      const summaryAvatar = document.querySelector('.account-avatar');
      if (summaryAvatar) summaryAvatar.textContent = updated.name.charAt(0).toUpperCase();
      setMessage('#profile-message', 'Đã lưu thông tin cá nhân.');
    } catch (error) {
      setMessage('#profile-message', error.message || 'Không thể lưu thông tin.', true);
    }
  });

  document.querySelector('#email-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email')).trim();
    try {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
      setMessage('#email-message', 'Yêu cầu đã được gửi. Hãy kiểm tra email để xác nhận địa chỉ mới.');
      event.currentTarget.reset();
    } catch (error) {
      setMessage('#email-message', error.message || 'Không thể đổi email.', true);
    }
  });

  document.querySelector('#password-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const password = String(values.get('password'));
    if (password !== String(values.get('confirmPassword'))) {
      setMessage('#password-message', 'Hai mật khẩu mới không khớp.', true);
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage('#password-message', 'Đã cập nhật mật khẩu.');
      event.currentTarget.reset();
    } catch (error) {
      setMessage('#password-message', error.message || 'Không thể cập nhật mật khẩu.', true);
    }
  });

  document.querySelector('#account-sign-out')?.addEventListener('click', async () => {
    await signOutFromSupabase();
    location.hash = '#/';
  });

  if (user.role === 'student') {
    loadStudentRequestsHistory(user.id);
  }
}

async function loadStudentRequestsHistory(userId) {
  const container = document.querySelector('#student-requests-container');
  if (!container) return;

  const statusLabels = {
    new: 'Mới gửi - Chờ liên hệ',
    contacted: 'Giáo viên đã liên hệ',
    matched: 'Đã kết nối',
    confirmed: 'Đã xác nhận học',
    closed: 'Đã học xong',
    cancelled: 'Đã hủy',
  };

  try {
    const { data: requests, error } = await supabase
      .from('student_requests')
      .select('*, teacher:requested_teacher_id(display_name), assigned:assigned_teacher_id(display_name)')
      .eq('student_profile_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!requests || !requests.length) {
      container.innerHTML = '<div style="text-align:center;padding:32px 16px;color:var(--muted)">' +
        '<p style="margin:0 0 12px;font-size:14px">Bạn chưa gửi yêu cầu tư vấn học lái nào.</p>' +
        '<a class="btn btn-light btn-sm" href="#/giao-vien">Tìm giáo viên ngay &rarr;</a>' +
        '</div>';
      return;
    }

    container.innerHTML = requests.map((req) => {
      const teacherName = req.teacher?.display_name || req.assigned?.display_name || 'DriNet tư vấn & điều phối giáo viên';
      const dateStr = new Date(req.created_at).toLocaleDateString('vi-VN');
      return '<div class="student-history-card">' +
        '<div class="student-history-header">' +
          '<b style="color:var(--navy)">Khóa học: ' + escapeHtml(req.license_goal || 'Lái xe') + ' · ' + escapeHtml(teacherName) + '</b>' +
          '<span class="tag status-' + req.status + '">' + (statusLabels[req.status] || req.status) + '</span>' +
        '</div>' +
        '<div class="student-history-meta">' +
          '<span>📍 Khu vực: <b>' + escapeHtml(req.preferred_area || 'Gia Lai') + '</b></span>' +
          (req.preferred_time ? '<span>⏰ Thời gian: <b>' + escapeHtml(req.preferred_time) + '</b></span>' : '') +
          '<span>📅 Ngày gửi: <b>' + dateStr + '</b></span>' +
        '</div>' +
      '</div>';
    }).join('');
  } catch (err) {
    console.error('Lỗi khi tải lịch sử yêu cầu của học viên:', err);
    container.innerHTML = '<p class="admin-message error">Không thể tải danh sách: ' + escapeHtml(err.message) + '</p>';
  }
}

export function loginPage() {
  return '<section class="page-hero"><div class="container">' +
    '<span class="kicker" style="color:#83c7ff">TÀI KHOẢN DRINET</span>' +
    '<h1 id="auth-hero-title">Đăng nhập</h1>' +
    '<p id="auth-hero-desc">Đăng nhập để quản lý tài khoản DriNet của bạn.</p>' +
    '</div></section>' +
    '<main class="container section"><div class="login-card panel">' +
    '<div id="auth-login-view">' +
      '<h2>Chào mừng đến DriNet</h2>' +
      '<p class="login-intro">Nhập email và mật khẩu của bạn để tiếp tục.</p>' +
      '<form id="login-form" class="login-form">' +
        '<label>Email</label>' +
        '<input name="email" type="email" autocomplete="username" required placeholder="name@example.com">' +
        '<label>Mật khẩu</label>' +
        '<input name="password" type="password" autocomplete="current-password" minlength="6" required placeholder="Nhập mật khẩu">' +
        '<button class="btn btn-primary" type="submit">Đăng nhập</button>' +
      '</form>' +
      '<div class="login-meta-actions">' +
        '<button id="password-recovery" class="text-button" type="button">Quên mật khẩu?</button>' +
        '<button id="btn-switch-to-signup" class="btn btn-green btn-sm" type="button">Chưa có tài khoản</button>' +
      '</div>' +
    '</div>' +
    '<div id="auth-signup-view" hidden>' +
      '<h2>Đăng ký tài khoản</h2>' +
      '<p class="login-intro">Tạo tài khoản học viên để bắt đầu hành trình học lái cùng DriNet.</p>' +
      '<form id="signup-form" class="login-form">' +
        '<label>Họ và tên</label>' +
        '<input name="fullName" autocomplete="name" required placeholder="Ví dụ: Nguyễn Văn A">' +
        '<label>Email</label>' +
        '<input name="email" type="email" autocomplete="email" required placeholder="name@example.com">' +
        '<label>Mật khẩu</label>' +
        '<input name="password" type="password" autocomplete="new-password" minlength="6" required placeholder="Tối thiểu 6 ký tự">' +
        '<button class="btn btn-primary" type="submit">Tạo tài khoản</button>' +
      '</form>' +
      '<div class="login-meta-actions" style="justify-content:flex-end;gap:8px">' +
        '<span style="font-size:13px;color:var(--muted)">Đã có tài khoản?</span>' +
        '<button id="btn-switch-to-login" class="btn btn-light btn-sm" type="button">Đăng nhập ngay</button>' +
      '</div>' +
    '</div>' +
    '<p id="login-message" class="admin-message" aria-live="polite"></p>' +
    '</div></main>';
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
    message.textContent = /invalid login credentials/i.test(text)
      ? 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại hoặc chọn “Quên mật khẩu?”.'
      : /email not confirmed/i.test(text)
      ? 'Email chưa được xác nhận. Hãy kiểm tra hộp thư của bạn rồi thử lại.'
      : text || 'Không thể thực hiện yêu cầu. Vui lòng thử lại.';
    message.className = 'admin-message error';
  };

  document.querySelector('#login-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const button = event.currentTarget.querySelector('button[type="submit"]');
    try {
      button.disabled = true;
      button.textContent = 'Đang đăng nhập…';
      const user = await signInWithSupabase(form.get('email'), form.get('password'));
      location.hash = user?.role === 'admin' ? '#/admin' : '#/ho-so';
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
      message.textContent = data.session
        ? 'Tạo tài khoản thành công. Bạn đã đăng nhập.'
        : 'Tạo tài khoản thành công. Hãy kiểm tra email để xác nhận trước khi đăng nhập.';
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
    if (!email) {
      message.textContent = 'Hãy nhập email ở form đăng nhập trước.';
      message.className = 'admin-message error';
      return;
    }
    try {
      await sendPasswordRecovery(email);
      message.textContent = 'Nếu email tồn tại, DriNet đã gửi hướng dẫn đặt lại mật khẩu. Hãy kiểm tra hộp thư.';
      message.className = 'admin-message success';
    } catch (error) {
      showError(error);
    }
  });
}
