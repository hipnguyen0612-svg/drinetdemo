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
            '<h3 style="margin:0;color:var(--navy)">Khóa học lái xe của bạn</h3>' +
            '<p style="margin:2px 0 0;font-size:13px;color:var(--muted)">Theo dõi giáo viên phụ trách, tiến trình nộp 3tr cọc và nhật ký từng buổi dạy.</p>' +
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
          '<p class="login-intro" style="margin-bottom:10px">💡 <i>Nếu bạn vừa nhận mật khẩu tạm thời khi đăng ký, hãy đổi mật khẩu mới tại đây để bảo mật tài khoản.</i></p>' +
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
    loadStudentRequestsHistory(user);
  }
}

async function loadStudentRequestsHistory(user) {
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
      .select('*, teacher:requested_teacher_id(id, display_name, area, licenses, experience_years, bio, center_name), assigned:assigned_teacher_id(id, display_name, area, licenses, experience_years, bio, center_name)')
      .or(`student_profile_id.eq.${user.id},email.eq.${user.email}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!requests || !requests.length) {
      container.innerHTML = '<div style="text-align:center;padding:32px 16px;color:var(--muted)">' +
        '<p style="margin:0 0 12px;font-size:14px">Bạn chưa gửi yêu cầu tư vấn học lái nào.</p>' +
        '<a class="btn btn-light btn-sm" href="#/giao-vien">Tìm giáo viên ngay &rarr;</a>' +
        '</div>';
      return;
    }

    const reqIds = requests.map((r) => r.id);
    const lessonLogsMap = new Map();
    if (reqIds.length > 0) {
      const { data: logs } = await supabase
        .from('lesson_logs')
        .select('*')
        .in('student_request_id', reqIds)
        .order('lesson_number', { ascending: true });
      (logs || []).forEach((log) => {
        if (!lessonLogsMap.has(log.student_request_id)) {
          lessonLogsMap.set(log.student_request_id, []);
        }
        lessonLogsMap.get(log.student_request_id).push(log);
      });
    }

    container.innerHTML = requests.map((req) => {
      const activeTeacher = req.teacher || req.assigned;
      const isDirect = Boolean(req.requested_teacher_id);
      const teacherTitle = activeTeacher ? activeTeacher.display_name : 'DriNet đang kết nối giáo viên';
      const teacherBadge = isDirect
        ? '<span style="background:#e0f2fe;color:#0369a1;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700">⭐ Bạn đã chọn trực tiếp</span>'
        : (req.assigned_teacher_id
            ? '<span style="background:#f3e8ff;color:#7e22ce;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700">🎯 DriNet điều phối</span>'
            : '<span style="background:#fef3c7;color:#b45309;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700">⏳ Chờ điều phối</span>');

      const isDepositPaid = req.deposit_status === 'paid';
      const isDepositPending = req.deposit_status === 'pending_approval';
      const cleanPhone = String(req.phone || '').replace(/\D/g, '');
      const logs = lessonLogsMap.get(req.id) || [];
      const totalLessons = req.total_lessons_completed || logs.length;
      const isEligible = req.learning_status === 'eligible_for_exam';
      const isGraduated = req.learning_status === 'graduated';

      const qrUrl = 'https://img.vietqr.io/image/MB-0901234567-compact2.png?amount=3000000&addInfo=' + encodeURIComponent('COC ' + cleanPhone + ' ' + (req.full_name || 'HocVien'));

      let depositContentHtml = '';
      if (isDepositPaid) {
        depositContentHtml = '<div style="margin-top:8px;padding:12px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:13px;color:#166534">' +
          '<b>✓ Đã xác nhận hoàn tất nộp cọc 3.000.000đ.</b>' +
          '<div style="font-size:12px;margin-top:2px;color:#15803d">Khoản tiền cọc đã được ghi nhận vào hồ sơ và sẽ trừ trực tiếp vào tổng học phí khóa đào tạo của bạn.</div>' +
          '</div>';
      } else if (isDepositPending) {
        depositContentHtml = '<div style="margin-top:8px;padding:12px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:13px;color:#92400e">' +
          '<b>⏳ Đã ghi nhận thông báo chuyển cọc của bạn.</b>' +
          '<div style="font-size:12px;margin-top:2px;color:#b45309">Ban Quản trị DriNet và giáo viên đang đối soát. Trạng thái sẽ được cập nhật ngay sau khi tiền cọc nổi.</div>' +
          '</div>';
      } else {
        depositContentHtml = '<div class="deposit-box">' +
          '<div class="deposit-qr"><img src="' + qrUrl + '" alt="QR nộp cọc 3tr DriNet"></div>' +
          '<div class="deposit-info">' +
            '<table>' +
              '<tr><td>Số tiền cọc:</td><td><b style="color:#b91c1c;font-size:15px">3.000.000 đ</b></td></tr>' +
              '<tr><td>Ngân hàng:</td><td>MB Bank (Ngân hàng Quân Đội)</td></tr>' +
              '<tr><td>Số tài khoản:</td><td><b style="color:var(--navy);font-size:14px">0901234567</b></td></tr>' +
              '<tr><td>Chủ tài khoản:</td><td>DRINET VIETNAM</td></tr>' +
              '<tr><td>Nội dung CK:</td><td><b style="color:var(--blue)">COC ' + escapeHtml(cleanPhone) + ' ' + escapeHtml(req.full_name) + '</b></td></tr>' +
            '</table>' +
            '<div style="margin-top:10px">' +
              '<button class="btn btn-sm btn-primary" data-notify-deposit="' + req.id + '" type="button">✓ Tôi đã chuyển khoản cọc 3.000.000đ</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      }

      let scheduleContentHtml = '';
      if (isDepositPaid) {
        scheduleContentHtml = '<div style="font-size:13.5px;color:var(--navy);margin-top:4px">' +
          '🎉 <b>Đã kích hoạt bước trao đổi lịch học!</b> Thầy/cô ' + escapeHtml(teacherTitle) + ' sẽ gọi điện hoặc nhắn Zalo cho bạn để thống nhất lịch học buổi 1. Bạn cũng có thể bấm nút Gọi hoặc Nhắn tin Zalo để chốt thời gian sớm nhất.' +
          '<div style="font-size:12px;color:var(--muted);margin-top:6px"><i>(Tính năng đặt và chốt lịch trực tiếp trên website đang được DriNet nâng cấp và sẽ ra mắt sớm!)</i></div>' +
          '</div>';
      } else {
        scheduleContentHtml = '<div style="font-size:13px;color:var(--muted);margin-top:4px">' +
          '🔒 Cần hoàn tất bước nộp cọc 3.000.000đ ở Bước 2 để kích hoạt xếp lịch học buổi 1 với giáo viên.' +
          '</div>';
      }

      let lessonsListHtml = '';
      if (logs.length > 0) {
        lessonsListHtml = '<div class="lesson-log-list">' +
          logs.map((log) => {
            const logDate = new Date(log.lesson_date).toLocaleDateString('vi-VN');
            return '<div class="lesson-log-item">' +
              '<div>' +
                '<div class="lesson-log-header">' +
                  '<span class="lesson-badge">Buổi ' + log.lesson_number + '</span>' +
                  '<span class="lesson-date">📅 ' + logDate + ' (' + log.duration_hours + ' giờ)</span>' +
                '</div>' +
                '<div class="lesson-content-text"><b>Nội dung:</b> ' + escapeHtml(log.content) + '</div>' +
                (log.teacher_feedback ? '<div class="lesson-feedback-text">💬 <b>Nhận xét của giáo viên:</b> ' + escapeHtml(log.teacher_feedback) + '</div>' : '') +
              '</div>' +
            '</div>';
          }).join('') +
          '</div>';
      } else {
        lessonsListHtml = '<p style="margin:8px 0 0;font-size:13px;color:var(--muted)">' +
          'Chưa có buổi học thực hành nào được ghi nhận. Sau khi đi học buổi 1, giáo viên sẽ cập nhật nội dung bài học và đánh giá tiến độ của bạn tại đây.' +
          '</p>';
      }

      let examContentHtml = '';
      if (isEligible) {
        examContentHtml = '<div style="margin-top:8px;padding:14px;background:#ecfdf5;border:2px solid #6ee7b7;border-radius:10px;color:#065f46">' +
          '<h4 style="margin:0 0 6px;font-size:16px;color:#047857">🎉 CHÚC MỪNG BẠN ĐÃ ĐỦ ĐIỀU KIỆN THI SÁT HẠCH!</h4>' +
          '<p style="margin:0;font-size:13.5px;line-height:1.5">' +
            'Giáo viên và hệ thống DriNet xác nhận bạn đã hoàn thành đầy đủ các bài tập sa hình, đường trường và kỹ năng lái xe an toàn. Hãy giữ tâm lý tự tin và đón nhận thông báo lịch thi sát hạch chính thức nhé!' +
          '</p>' +
          '</div>';
      } else if (isGraduated) {
        examContentHtml = '<div style="margin-top:8px;padding:14px;background:#e0e7ff;border:1px solid #c7d2fe;border-radius:10px;color:#3730a3">' +
          '<h4 style="margin:0 0 4px;font-size:16px">🎓 ĐÃ TỐT NGHIỆP KHÓA ĐÀO TẠO LÁI XE!</h4>' +
          '<p style="margin:0;font-size:13px">Bạn đã hoàn thành xuất sắc toàn bộ khóa học cùng DriNet.</p>' +
          '</div>';
      } else {
        examContentHtml = '<p style="margin:4px 0 0;font-size:13px;color:var(--muted)">' +
          'Giáo viên sẽ đánh giá và xác nhận đủ điều kiện khi bạn hoàn thành đầy đủ các bài sa hình, đường trường và giờ học quy định.' +
          '</p>';
      }

      return '<div class="course-progress-card">' +
        '<div class="course-teacher-header">' +
          '<div class="course-teacher-info">' +
            '<div class="course-teacher-avatar">' + escapeHtml((teacherTitle.charAt(0) || 'D').toUpperCase()) + '</div>' +
            '<div class="course-teacher-details">' +
              '<h4>' + escapeHtml(teacherTitle) + ' ' + teacherBadge + '</h4>' +
              '<p>Khóa học: <b>' + escapeHtml(req.license_goal || 'Lái xe') + '</b> · Khu vực: <b>' + escapeHtml(req.preferred_area || 'Gia Lai') + '</b></p>' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<span class="tag status-' + req.status + '">' + (statusLabels[req.status] || req.status) + '</span>' +
          '</div>' +
        '</div>' +

        '<div class="course-stepper">' +
          // Step 1
          '<div class="step-item completed">' +
            '<div class="step-number">✓</div>' +
            '<div class="step-body">' +
              '<div class="step-title"><span>Bước 1: Chọn giáo viên & Chốt hồ sơ</span><span class="tag status-confirmed">Đã xong</span></div>' +
              '<p class="step-desc">Hồ sơ đã được gửi đến thầy/cô ' + escapeHtml(teacherTitle) + ' thành công.</p>' +
            '</div>' +
          '</div>' +
          // Step 2
          '<div class="step-item ' + (isDepositPaid ? 'completed' : 'active') + '">' +
            '<div class="step-number">' + (isDepositPaid ? '✓' : '2') + '</div>' +
            '<div class="step-body">' +
              '<div class="step-title"><span>Bước 2: Nộp 3.000.000đ tiền cọc</span>' + (isDepositPaid ? '<span class="tag status-approved">Đã nộp cọc</span>' : '<span class="tag status-new">Chờ nộp cọc</span>') + '</div>' +
              depositContentHtml +
            '</div>' +
          '</div>' +
          // Step 3
          '<div class="step-item ' + (isDepositPaid ? 'active' : '') + '">' +
            '<div class="step-number">3</div>' +
            '<div class="step-body">' +
              '<div class="step-title"><span>Bước 3: Trao đổi thời gian & Lên lịch học</span></div>' +
              scheduleContentHtml +
            '</div>' +
          '</div>' +
          // Step 4
          '<div class="step-item ' + (totalLessons > 0 ? (isEligible ? 'completed' : 'active') : '') + '">' +
            '<div class="step-number">' + (isEligible ? '✓' : '4') + '</div>' +
            '<div class="step-body">' +
              '<div class="step-title"><span>Bước 4: Tiến trình các buổi học thực hành</span><span class="tag" style="background:#e0f2fe;color:#0369a1">Đã học: ' + totalLessons + ' buổi</span></div>' +
              lessonsListHtml +
            '</div>' +
          '</div>' +
          // Step 5
          '<div class="step-item ' + (isEligible || isGraduated ? 'completed' : '') + '">' +
            '<div class="step-number">' + (isEligible || isGraduated ? '✓' : '5') + '</div>' +
            '<div class="step-body">' +
              '<div class="step-title"><span>Bước 5: Hoàn thành khóa học & Đủ điều kiện thi sát hạch</span></div>' +
              examContentHtml +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  } catch (err) {
    console.error('Lỗi khi tải lịch sử yêu cầu của học viên:', err);
    container.innerHTML = '<p class="admin-message error">Không thể tải danh sách: ' + escapeHtml(err.message) + '</p>';
  }

  container.querySelectorAll('[data-notify-deposit]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const reqId = btn.dataset.notifyDeposit;
      btn.disabled = true;
      btn.textContent = 'Đang ghi nhận…';
      try {
        await supabase.from('student_requests').update({ deposit_status: 'pending_approval' }).eq('id', reqId);
        await loadStudentRequestsHistory(user);
      } catch (err) {
        alert('Không thể cập nhật: ' + err.message);
        btn.disabled = false;
      }
    });
  });
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

