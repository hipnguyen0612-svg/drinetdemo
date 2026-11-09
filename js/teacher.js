import { supabase } from './supabase.js';
import { getCurrentUser, signOutFromSupabase, initialiseAuth } from './auth.js';
import { openTeacherSupportModal } from './components.js';
import { escapeHtml } from './utils.js';

const renderSpinner = (text = 'Đang tải dữ liệu, vui lòng chờ…') =>
  '<div class="drinet-loading-state"><div class="drinet-spinner"></div><p class="drinet-loading-text">' + escapeHtml(text) + '</p></div>';

const requestStatusLabels = {
  new: 'Mới gửi',
  contacted: 'Đã liên hệ',
  matched: 'Đã kết nối',
  confirmed: 'Đã xác nhận học',
  closed: 'Đã học xong',
  cancelled: 'Đã hủy',
};

let currentTab = 'students';
let activeTeacher = null;

export function teacherDashboardPage() {
  const user = getCurrentUser();
  if (!user) return '';

  return `
    <section class="page-hero">
      <div class="container">
        <span class="kicker" style="color:#83c7ff">KHÔNG GIAN GIÁO VIÊN DRINET</span>
        <h1>Bảng quản lý Giáo viên</h1>
        <p>Tiếp nhận học viên, cập nhật thông tin giảng dạy và theo dõi đánh giá.</p>
      </div>
    </section>

    <main class="container section teacher-dashboard">
      <div id="teacher-profile-header">
        ${renderSpinner('Đang đồng bộ hồ sơ giáo viên…')}
      </div>

      <div class="admin-tabs" id="teacher-nav-tabs">
        <button class="admin-tab active" data-tab="students" type="button">
          👥 Học viên của tôi <span id="teacher-badge-students" class="admin-badge">…</span>
        </button>
        <button class="admin-tab" data-tab="profile" type="button">
          📝 Thông tin giảng dạy
        </button>
        <button class="admin-tab" data-tab="reviews" type="button">
          ⭐ Đánh giá học viên <span id="teacher-badge-reviews" class="admin-badge">…</span>
        </button>
        <button class="admin-tab" data-tab="security" type="button">
          🔒 Tài khoản & Bảo mật
        </button>
      </div>

      <div class="panel" style="padding:24px" id="teacher-main-panel">
        <div id="teacher-tab-content">
          ${renderSpinner('Đang tải danh sách học viên…')}
        </div>
      </div>
    </main>
  `;
}

export async function bindTeacherDashboard() {
  const user = getCurrentUser();
  if (!user) return;

  const headerContainer = document.querySelector('#teacher-profile-header');
  const contentContainer = document.querySelector('#teacher-tab-content');
  const tabsContainer = document.querySelector('#teacher-nav-tabs');

  try {
    const { data: teacher, error } = await supabase
      .from('teachers')
      .select('*')
      .eq('profile_id', user.id)
      .maybeSingle();

    if (error) throw error;

    if (!teacher) {
      if (headerContainer) {
        headerContainer.innerHTML = `
          <div class="panel" style="padding:28px;text-align:center;margin-bottom:24px">
            <h2 style="color:var(--navy);margin:0 0 8px">Chưa tìm thấy hồ sơ giảng dạy</h2>
            <p style="color:var(--muted);max-width:540px;margin:auto 0 20px">
              Tài khoản của bạn đã được cấp quyền Giáo viên nhưng chưa hoàn tất liên kết thông tin giảng dạy trên hệ thống.
            </p>
            <a class="btn btn-primary" href="#/dang-ky-giao-vien">Gửi thông tin hồ sơ giáo viên &rarr;</a>
          </div>
        `;
      }
      if (tabsContainer) tabsContainer.hidden = true;
      if (contentContainer) {
        contentContainer.innerHTML = renderSecurityTab(user);
        bindSecurityTab(user);
      }
      return;
    }

    activeTeacher = teacher;
    renderHeader(teacher, user);
    setupTabs();
    switchTab('students');
  } catch (err) {
    console.error('Lỗi khi tải thông tin giáo viên:', err);
    if (headerContainer) {
      headerContainer.innerHTML = `
        <div class="panel" style="padding:24px;color:#c73535">
          Không thể tải thông tin giáo viên: ${escapeHtml(err.message || 'Lỗi không xác định.')}
        </div>
      `;
    }
  }
}

function renderHeader(teacher, user) {
  const header = document.querySelector('#teacher-profile-header');
  if (!header) return;

  let statusBannerHtml = '';
  if (teacher.status === 'approved') {
    statusBannerHtml = `
      <div class="teacher-status-banner approved">
        <div>
          <b>✓ Hồ sơ đã được xác minh & đang hoạt động công khai</b>
          <div style="font-size:13px;margin-top:2px;opacity:.9">
            Hồ sơ của bạn hiện đang hiển thị trên danh sách tìm giáo viên tại Gia Lai của DriNet.
          </div>
        </div>
        <a class="btn btn-light" href="#/giao-vien/${encodeURIComponent(teacher.slug)}" target="_blank" style="padding:8px 14px;font-size:13px">
          👁️ Xem trang công khai &rarr;
        </a>
      </div>
    `;
  } else if (teacher.status === 'pending') {
    statusBannerHtml = `
      <div class="teacher-status-banner pending">
        <div>
          <b>⏳ Hồ sơ đang chờ Ban quản trị DriNet phê duyệt</b>
          <div style="font-size:13px;margin-top:2px;opacity:.9">
            Chúng tôi đang kiểm tra thông tin và chứng chỉ giảng dạy của bạn. Trong lúc chờ duyệt, bạn vẫn có thể cập nhật thông tin và mức học phí.
          </div>
        </div>
      </div>
    `;
  } else if (teacher.status === 'needs_revision') {
    statusBannerHtml = `
      <div class="teacher-status-banner needs_revision">
        <div>
          <b>⚠️ Hồ sơ cần bổ sung thông tin theo yêu cầu của Quản trị viên</b>
          <div style="font-size:13px;margin-top:4px">
            <b>Lý do:</b> ${escapeHtml(teacher.rejection_reason || 'Vui lòng kiểm tra và cập nhật lại thông tin giảng dạy.')}
          </div>
        </div>
        <button class="btn btn-primary" id="btn-goto-profile-edit" type="button" style="padding:8px 14px;font-size:13px">
          Cập nhật thông tin ngay &rarr;
        </button>
      </div>
    `;
  }

  const avatarChar = (teacher.display_name || user.name || 'G').charAt(0).toUpperCase();
  const isAccepting = teacher.is_accepting_students !== false;

  const availabilityCardHtml = teacher.status === 'approved' ? `
    <div class="teacher-availability-card ${isAccepting ? 'accepting' : 'paused'}">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <span class="status-dot ${isAccepting ? 'online' : 'paused'}"></span>
        <div>
          <div style="font-weight:700;font-size:14.5px;color:var(--navy)">
            ${isAccepting ? '🟢 Đang nhận học viên mới qua DriNet' : '🔴 Đang tạm ngừng nhận dạy'}
          </div>
          <div style="font-size:12.5px;color:var(--muted)">
            ${isAccepting ? 'Hồ sơ đang hiển thị sẵn sàng nhận học viên mới trên hệ thống.' : `Tạm ngừng nhận học viên mới trên trang công khai.${teacher.pause_reason ? ` (Lý do: ${escapeHtml(teacher.pause_reason)})` : ''}`}
          </div>
        </div>
      </div>
      <button class="btn btn-sm ${isAccepting ? 'btn-light' : 'btn-primary'}" id="btn-toggle-availability" type="button" style="padding:6px 14px;font-size:12.5px">
        ${isAccepting ? '⏸️ Tạm ngừng nhận học viên' : '▶️ Bật nhận học viên trở lại'}
      </button>
    </div>
  ` : '';

  header.innerHTML = `
    <div class="panel teacher-header-card">
      <div class="teacher-header-profile">
        <span class="teacher-avatar">${escapeHtml(avatarChar)}</span>
        <div class="teacher-header-info">
          <h2>
            ${escapeHtml(teacher.display_name || user.name)}
            <span class="tag status-${teacher.status}">
              ${teacher.status === 'approved' ? '✓ Đã xác minh' : (teacher.status === 'pending' ? 'Chờ duyệt' : 'Cần bổ sung')}
            </span>
          </h2>
          <p>${escapeHtml(user.email)} · ${escapeHtml(teacher.center_name || 'Giáo viên độc lập')}</p>
        </div>
      </div>
    </div>

    ${statusBannerHtml}

    ${availabilityCardHtml}

    <div class="teacher-stats-grid">
      <div class="teacher-stat-card">
        <span class="teacher-stat-label">Học viên tiếp nhận</span>
        <span class="teacher-stat-value" id="stat-students-count">—</span>
        <span class="teacher-stat-sub" id="stat-students-sub">Đang đồng bộ…</span>
      </div>
      <div class="teacher-stat-card">
        <span class="teacher-stat-label">Đánh giá trung bình</span>
        <span class="teacher-stat-value">★ ${Number(teacher.rating || 0).toFixed(1)}</span>
        <span class="teacher-stat-sub">${teacher.review_count || 0} lượt đánh giá</span>
      </div>
      <div class="teacher-stat-card">
        <span class="teacher-stat-label">Trạng thái nhận học</span>
        <span class="teacher-stat-value" style="font-size:19px;color:${isAccepting ? 'var(--green)' : '#dc2626'}">${isAccepting ? 'Đang mở nhận' : 'Tạm ngừng'}</span>
        <span class="teacher-stat-sub">${isAccepting ? 'Sẵn sàng nhận học viên mới' : 'Đang tạm dừng nhận lớp mới'}</span>
      </div>
      <div class="teacher-stat-card">
        <span class="teacher-stat-label">Khu vực & Hạng bằng</span>
        <span class="teacher-stat-value" style="font-size:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${escapeHtml(teacher.area || 'Gia Lai')}
        </span>
        <span class="teacher-stat-sub">
          ${Array.isArray(teacher.licenses) ? teacher.licenses.join(', ') : (teacher.licenses || 'Hạng B')}
        </span>
      </div>
    </div>
  `;

  document.querySelector('#btn-goto-profile-edit')?.addEventListener('click', () => switchTab('profile'));

  document.querySelector('#btn-toggle-availability')?.addEventListener('click', async () => {
    const btn = document.querySelector('#btn-toggle-availability');
    btn.disabled = true;
    if (isAccepting) {
      const reason = prompt('Nhập lý do tạm ngừng nhận học viên (ví dụ: Đã đủ học viên khóa này, nghỉ phép...):', teacher.pause_reason || 'Đã đủ học viên khóa này');
      if (reason === null) {
        btn.disabled = false;
        return;
      }
      try {
        await supabase.rpc('toggle_teacher_accepting_students', { p_is_accepting: false, p_pause_reason: reason.trim() });
        activeTeacher.is_accepting_students = false;
        activeTeacher.pause_reason = reason.trim();
        renderHeader(activeTeacher, getCurrentUser());
      } catch (err) {
        alert('Lỗi cập nhật: ' + err.message);
        btn.disabled = false;
      }
    } else {
      if (!confirm('Bạn có muốn mở nhận học viên mới trở lại trên DriNet?')) {
        btn.disabled = false;
        return;
      }
      try {
        await supabase.rpc('toggle_teacher_accepting_students', { p_is_accepting: true, p_pause_reason: null });
        activeTeacher.is_accepting_students = true;
        activeTeacher.pause_reason = null;
        renderHeader(activeTeacher, getCurrentUser());
      } catch (err) {
        alert('Lỗi cập nhật: ' + err.message);
        btn.disabled = false;
      }
    }
  });
}

function setupTabs() {
  const tabs = document.querySelectorAll('#teacher-nav-tabs .admin-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      if (target && target !== currentTab) {
        switchTab(target);
      }
    });
  });
}

function switchTab(tabName) {
  currentTab = tabName;
  const tabs = document.querySelectorAll('#teacher-nav-tabs .admin-tab');
  tabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  const content = document.querySelector('#teacher-tab-content');
  if (!content) return;

  if (tabName === 'students') {
    renderStudentsTab();
  } else if (tabName === 'profile') {
    renderProfileTab();
  } else if (tabName === 'reviews') {
    renderReviewsTab();
  } else if (tabName === 'security') {
    content.innerHTML = renderSecurityTab(getCurrentUser());
    bindSecurityTab(getCurrentUser());
  }
}

async function renderStudentsTab() {
  const content = document.querySelector('#teacher-tab-content');
  if (!content || !activeTeacher) return;

  content.innerHTML = renderSpinner('Đang tải danh sách học viên đăng ký…');

  try {
    let requests = [];
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_teacher_student_requests', {
      p_teacher_id: activeTeacher.id,
    });
    if (!rpcErr && rpcData) {
      requests = rpcData;
    } else {
      if (rpcErr) {
        console.warn('Lưu ý RPC get_teacher_student_requests:', rpcErr);
      }
      // Dự phòng nếu RPC chưa có
      const { data: tblData, error: tblErr } = await supabase
        .from('student_requests')
        .select('*')
        .or(`requested_teacher_id.eq.${activeTeacher.id},assigned_teacher_id.eq.${activeTeacher.id}`)
        .order('created_at', { ascending: false });
      if (tblErr) throw tblErr;
      requests = tblData || [];
    }

    const reqIds = (requests || []).map((r) => r.id);
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

    const total = requests ? requests.length : 0;
    const newCount = (requests || []).filter((r) => r.status === 'new' || r.status === 'matched').length;

    const badge = document.querySelector('#teacher-badge-students');
    if (badge) badge.textContent = newCount > 0 ? `${newCount} mới` : `${total}`;

    const statCount = document.querySelector('#stat-students-count');
    const statSub = document.querySelector('#stat-students-sub');
    if (statCount) statCount.textContent = total;
    if (statSub) statSub.textContent = newCount > 0 ? `${newCount} học viên mới / được điều phối cần liên hệ` : 'Tất cả đã được xử lý';

    if (!requests || !requests.length) {
      content.innerHTML = `
        <div style="text-align:center;padding:52px 20px;color:var(--muted)">
          <div style="font-size:44px;margin-bottom:12px">📋</div>
          <h3 style="color:var(--navy);margin:0 0 8px;font-size:18px">Chưa có học viên nào đăng ký học với bạn</h3>
          <p style="font-size:14px;max-width:520px;margin:auto;line-height:1.6">
            Khi học viên bấm <b>"Yêu cầu tư vấn với giáo viên này"</b> trên trang hồ sơ của bạn hoặc khi DriNet hỗ trợ kết nối, thông tin liên hệ và nhu cầu học sẽ xuất hiện tại đây.
          </p>
        </div>
      `;
      return;
    }

    content.innerHTML = `
      <div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div>
          <h3 style="margin:0;color:var(--navy)">Học viên đã liên hệ (${total})</h3>
          <p style="margin:2px 0 0;font-size:13px;color:var(--muted)">Nhấp nút Gọi hoặc Zalo để chủ động kết nối nhanh với học viên.</p>
        </div>
        <p id="student-action-msg" class="admin-message" style="margin:0" aria-live="polite"></p>
      </div>

      <div class="teacher-requests-list">
        ${requests.map((req) => {
          const dateStr = new Date(req.created_at).toLocaleDateString('vi-VN');
          const cleanPhone = (req.phone || '').replace(/[^0-9]/g, '');
          const isDirect = req.requested_teacher_id === activeTeacher.id;
          const isAssigned = req.assigned_teacher_id === activeTeacher.id && !isDirect;
          const sourceBadge = isAssigned
            ? '<span style="background:#f3e8ff;color:#7e22ce;padding:2px 7px;border-radius:6px;font-size:11px;font-weight:700;margin-left:4px">🎯 DriNet điều phối</span>'
            : (isDirect ? '<span style="background:#e0f2fe;color:#0369a1;padding:2px 7px;border-radius:6px;font-size:11px;font-weight:700;margin-left:4px">⭐ Học viên chọn bạn</span>' : '');

          const canContact = req.status === 'new' || req.status === 'matched';
          const canConfirm = req.status === 'new' || req.status === 'matched' || req.status === 'contacted';
          const canClose = req.status === 'confirmed';
          const noticeHtml = isDirect
            ? `<div style="margin:8px 0 10px;padding:9px 12px;background:#f0f9ff;border-left:3px solid var(--blue);border-radius:6px;font-size:12.5px;color:#0369a1">
                📢 <b>Học viên đã chủ động chọn bạn:</b> Yêu cầu gửi trực tiếp đến bạn mà không cần qua quản trị viên. Hãy bấm <b>Gọi điện</b> hoặc <b>Nhắn Zalo</b> ngay bên dưới để liên hệ tư vấn lịch học cho học viên!
              </div>`
            : (isAssigned
                ? `<div style="margin:8px 0 10px;padding:9px 12px;background:#faf5ff;border-left:3px solid #9333ea;border-radius:6px;font-size:12.5px;color:#7e22ce">
                    🎯 <b>DriNet điều phối:</b> Học viên đăng ký nhờ DriNet tư vấn và đã được Quản trị viên bàn giao cho bạn. Hãy liên hệ hỗ trợ học viên sớm nhất.
                  </div>`
                : '');

          const logs = lessonLogsMap.get(req.id) || [];
          const totalLessons = req.total_lessons_completed || logs.length;
          const isDepositPaid = req.deposit_status === 'paid';
          const isDepositPending = req.deposit_status === 'pending_approval';
          const isEligible = req.learning_status === 'eligible_for_exam';
          const isGraduated = req.learning_status === 'graduated';
          const isTeacherAccepted = req.teacher_accepted === true;
          const isContactUnlocked = isDepositPaid && isTeacherAccepted;

          const phoneDisplay = isContactUnlocked ? escapeHtml(req.phone || '') : '<span style="color:#d97706;font-weight:700">🔒 0987*** (Mở sau khi có cọc & nhận lớp)</span>';
          const emailDisplay = isContactUnlocked ? escapeHtml(req.email || '') : '<span style="color:#d97706;font-weight:700">🔒 Đã bảo mật</span>';

          return `
            <div class="admin-item-card" data-req-id="${req.id}">
              <div class="admin-item-main">
                <h3>
                  ${escapeHtml(req.full_name)}
                  ${sourceBadge}
                  <span class="tag status-${req.status}">${requestStatusLabels[req.status] || req.status}</span>
                </h3>
                <div class="admin-item-meta">
                  <span>📞 Số điện thoại: <b>${phoneDisplay}</b></span>
                  <span>✉️ Email: <b>${emailDisplay}</b></span>
                  <span>🚗 Hạng muốn học: <b>${escapeHtml(req.license_goal || 'Chưa rõ')}</b></span>
                  <span>📍 Khu vực: <b>${escapeHtml(req.preferred_area || 'Gia Lai')}</b></span>
                  ${req.preferred_time ? `<span>⏰ Thời gian học: <b>${escapeHtml(req.preferred_time)}</b></span>` : ''}
                  <span>📅 Ngày gửi: <b>${dateStr}</b></span>
                </div>
                ${req.notes ? `<div class="admin-item-body"><b>Ghi chú:</b> ${escapeHtml(req.notes)}</div>` : ''}
                ${noticeHtml}

                ${!isContactUnlocked ? `
                  <div class="contact-locked-box" style="margin-top:12px">
                    <div style="font-weight:700;display:flex;align-items:center;gap:6px">
                      <span>🔒 Thông tin liên hệ (SĐT, Zalo, Email) đang được bảo mật</span>
                    </div>
                    <p style="margin:4px 0 8px;font-size:12.5px;color:#78350f">
                      Nhằm đảm bảo quy trình cọc qua DriNet và quyền lợi đôi bên, hệ thống sẽ mở khóa SĐT và Zalo khi học viên đã nộp 3.000.000đ cọc và thầy/cô bấm "Tiếp nhận học viên".
                    </p>
                    ${!isDepositPaid ? `
                      <div style="font-size:12px;color:#92400e;display:flex;align-items:center;gap:6px">
                        <span>⏳ <b>Trạng thái cọc:</b> Học viên chưa nộp 3.000.000đ cọc (Ban Quản trị DriNet đang đôn đốc và theo dõi).</span>
                      </div>
                    ` : `
                      <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:10px 14px;border-radius:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
                        <span style="color:#15803d;font-weight:700;font-size:12.5px">💰 Học viên đã nộp đủ 3.000.000đ cọc! Thầy/cô vui lòng bấm tiếp nhận để mở khóa liên hệ:</span>
                        <div style="display:flex;gap:8px;flex-wrap:wrap">
                          <button class="btn btn-sm btn-primary" data-accept-student="${req.id}" data-name="${escapeHtml(req.full_name)}" type="button" style="background:#16a34a;border-color:#16a34a;padding:5px 12px;font-size:12px">
                            🤝 Tiếp nhận học viên ngay
                          </button>
                          <button class="btn btn-sm btn-light" data-decline-student="${req.id}" data-name="${escapeHtml(req.full_name)}" type="button" style="color:#dc2626;padding:5px 10px;font-size:12px">
                            ❌ Báo bận / Không nhận
                          </button>
                        </div>
                      </div>
                    `}
                  </div>
                ` : ''}

                <div style="margin-top:12px;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px">
                  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px">
                    <div style="font-size:13px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                      <b>Cọc 3.000.000đ:</b>
                      ${isDepositPaid
                        ? '<span style="background:#e6fcf5;color:#0ca678;padding:3px 9px;border-radius:6px;font-size:12px;font-weight:700">💰 Đã nộp 3.000.000đ cọc</span>'
                        : (isDepositPending
                            ? '<span style="background:#fff9db;color:#f59f00;padding:3px 9px;border-radius:6px;font-size:12px;font-weight:700">⏳ Học viên báo đã chuyển cọc</span>'
                            : '<span style="background:#f1f5f9;color:#64748b;padding:3px 9px;border-radius:6px;font-size:12px">Chưa nộp 3tr cọc</span>')}
                    </div>
                  </div>

                  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;border-top:1px dashed #cbd5e1;padding-top:8px">
                    <div style="font-size:13px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                      <b>Tiến độ học:</b>
                      <span style="background:#e0f2fe;color:#0369a1;padding:3px 9px;border-radius:6px;font-size:12px;font-weight:700">Đã dạy: ${totalLessons} buổi</span>
                      ${isEligible ? '<span style="background:#dcfce7;color:#15803d;padding:3px 9px;border-radius:6px;font-size:12px;font-weight:800">🎓 ĐỦ ĐIỀU KIỆN THI</span>' : ''}
                      ${isGraduated ? '<span style="background:#e0e7ff;color:#4338ca;padding:3px 9px;border-radius:6px;font-size:12px;font-weight:800">✓ HOÀN THÀNH KHÓA</span>' : ''}
                    </div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap">
                      ${isContactUnlocked ? `
                      <button class="btn btn-sm btn-primary" data-add-lesson="${req.id}" data-name="${escapeHtml(req.full_name)}" data-next-num="${totalLessons + 1}" type="button" style="padding:5px 11px;font-size:12px">
                        ➕ Cập nhật buổi dạy
                      </button>
                      ` : ''}
                      ${logs.length > 0 ? `<button class="btn btn-sm btn-light" data-view-lessons="${req.id}" data-name="${escapeHtml(req.full_name)}" type="button" style="padding:5px 10px;font-size:12px">📋 Nhật ký (${logs.length})</button>` : ''}
                      ${!isEligible && !isGraduated ? `<button class="btn btn-sm btn-success" data-mark-eligible="${req.id}" data-name="${escapeHtml(req.full_name)}" type="button" style="background:#10b981;color:#fff;border-color:#10b981;padding:5px 10px;font-size:12px">🎓 Đủ điều kiện thi</button>` : ''}
                    </div>
                  </div>
                </div>

                ${isContactUnlocked ? `
                  <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center">
                    <span style="background:#dcfce7;color:#15803d;padding:3px 9px;border-radius:6px;font-size:11.5px;font-weight:700">✓ Đã tiếp nhận học viên</span>
                    ${cleanPhone ? `
                      <a class="admin-btn btn-call" href="tel:${escapeHtml(cleanPhone)}">📞 Gọi điện (${escapeHtml(req.phone)})</a>
                      <a class="admin-btn btn-zalo" href="https://zalo.me/${encodeURIComponent(cleanPhone)}" target="_blank" rel="noopener">💬 Nhắn tin Zalo</a>
                    ` : ''}
                  </div>
                ` : ''}
                </div>
              </div>
              <div class="admin-btn-group">
                ${canContact ? `<button class="admin-btn admin-btn-primary" data-teacher-action="contacted" data-id="${req.id}" type="button">Đã liên hệ</button>` : ''}
                ${canConfirm ? `<button class="admin-btn admin-btn-success" data-teacher-action="confirmed" data-id="${req.id}" type="button">Xác nhận học</button>` : ''}
                ${canClose ? `<button class="admin-btn admin-btn-success" data-teacher-action="closed" data-id="${req.id}" type="button">✓ Học xong</button>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    content.querySelectorAll('[data-teacher-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.teacherAction;
        const id = btn.dataset.id;
        const msg = document.querySelector('#student-action-msg');
        btn.disabled = true;
        try {
          const { error: updateError } = await supabase
            .from('student_requests')
            .update({ status: action, updated_at: new Date().toISOString() })
            .eq('id', id);

          if (updateError) throw updateError;
          if (msg) {
            msg.textContent = action === 'contacted' ? 'Đã cập nhật: Đã liên hệ học viên.' : (action === 'confirmed' ? 'Đã xác nhận học viên vào lớp.' : 'Đã ghi nhận học viên hoàn thành khóa học.');
            msg.className = 'admin-message success';
          }
          await renderStudentsTab();
        } catch (err) {
          if (msg) {
            msg.textContent = err.message || 'Không thể cập nhật trạng thái.';
            msg.className = 'admin-message error';
          }
          btn.disabled = false;
        }
      });
    });

    // Tiếp nhận học viên (Sau khi cọc)
    content.querySelectorAll('[data-accept-student]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.acceptStudent;
        const name = btn.dataset.name || 'học viên này';
        if (!confirm(`Xác nhận tiếp nhận học viên "${name}" vào danh sách đào tạo? Hệ thống sẽ mở khóa số điện thoại và Zalo để bạn liên hệ.`)) return;
        btn.disabled = true;
        try {
          const { error: accErr } = await supabase.rpc('accept_student_request', { p_request_id: id });
          if (accErr) throw accErr;
          const msg = document.querySelector('#student-action-msg');
          if (msg) {
            msg.textContent = `Đã tiếp nhận học viên "${name}". Thông tin liên hệ đã được mở khóa!`;
            msg.className = 'admin-message success';
          }
          await renderStudentsTab();
        } catch (err) {
          alert('Lỗi tiếp nhận học viên: ' + err.message);
          btn.disabled = false;
        }
      });
    });

    // Báo bận / Không nhận học viên
    content.querySelectorAll('[data-decline-student]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.declineStudent;
        const name = btn.dataset.name || 'học viên này';
        const reason = prompt(`Nhập lý do bạn không thể nhận học viên "${name}" (Hệ thống sẽ chuyển lại Ban Quản trị DriNet để điều phối giáo viên khác):`, 'Lịch đào tạo đã kín trong tuần này');
        if (reason === null) return;
        btn.disabled = true;
        try {
          const { error: decErr } = await supabase.rpc('decline_student_request', {
            p_request_id: id,
            p_reason: reason.trim() || 'Giáo viên báo bận',
          });
          if (decErr) throw decErr;
          const msg = document.querySelector('#student-action-msg');
          if (msg) {
            msg.textContent = `Đã chuyển trả yêu cầu của "${name}" về Ban Quản trị DriNet để điều phối giáo viên khác.`;
            msg.className = 'admin-message success';
          }
          await renderStudentsTab();
        } catch (err) {
          alert('Không thể thực hiện: ' + err.message);
          btn.disabled = false;
        }
      });
    });

    // Xác nhận Đủ điều kiện thi sát hạch
    content.querySelectorAll('[data-mark-eligible]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.markEligible;
        const name = btn.dataset.name || 'học viên này';
        if (!confirm(`Xác nhận học viên "${name}" đã hoàn thành đầy đủ bài học và ĐỦ ĐIỀU KIỆN THI SÁT HẠCH LÁI XE?`)) return;
        btn.disabled = true;
        try {
          const { error: elErr } = await supabase
            .from('student_requests')
            .update({
              learning_status: 'eligible_for_exam',
              status: 'confirmed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', id);
          if (elErr) throw elErr;
          const msg = document.querySelector('#student-action-msg');
          if (msg) {
            msg.textContent = `Đã xác nhận học viên "${name}" đủ điều kiện dự thi sát hạch!`;
            msg.className = 'admin-message success';
          }
          await renderStudentsTab();
        } catch (err) {
          alert('Không thể cập nhật: ' + err.message);
          btn.disabled = false;
        }
      });
    });

    // Cập nhật buổi dạy (Modal)
    content.querySelectorAll('[data-add-lesson]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const reqId = btn.dataset.addLesson;
        const studentName = btn.dataset.name || 'Học viên';
        const nextNum = Number(btn.dataset.nextNum) || 1;
        openAddLessonModal(reqId, studentName, nextNum);
      });
    });

    // Xem nhật ký buổi dạy (Modal)
    content.querySelectorAll('[data-view-lessons]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const reqId = btn.dataset.viewLessons;
        const studentName = btn.dataset.name || 'Học viên';
        const logs = lessonLogsMap.get(reqId) || [];
        openViewLessonsModal(reqId, studentName, logs);
      });
    });
  } catch (err) {
    console.error('Lỗi khi tải yêu cầu học viên:', err);
    content.innerHTML = `<p class="admin-message error">Không thể tải học viên: ${escapeHtml(err.message)}</p>`;
  }
}

function openAddLessonModal(reqId, studentName, nextNum) {
  const existingModal = document.querySelector('#add-lesson-modal');
  if (existingModal) existingModal.remove();

  const today = new Date().toISOString().split('T')[0];
  const modalHtml = `
    <div id="add-lesson-modal" class="modal-backdrop">
      <div class="modal-dialog">
        <div class="modal-header">
          <div>
            <h3>➕ Cập nhật buổi dạy</h3>
            <p class="modal-subtitle">Ghi nhận tiến trình thực hành cho học viên <b>${escapeHtml(studentName)}</b></p>
          </div>
          <button class="modal-close-btn" type="button">&times;</button>
        </div>
        <form id="add-lesson-form">
          <div class="form-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
            <div>
              <label style="font-size:12.5px;font-weight:700">Buổi số *</label>
              <input name="lessonNumber" type="number" min="1" required value="${nextNum}" style="width:100%;padding:8px;border-radius:7px;border:1px solid #cbd5e1">
            </div>
            <div>
              <label style="font-size:12.5px;font-weight:700">Thời lượng (giờ) *</label>
              <input name="durationHours" type="number" step="0.5" min="0.5" max="10" required value="2.0" style="width:100%;padding:8px;border-radius:7px;border:1px solid #cbd5e1">
            </div>
            <div style="grid-column:1/-1">
              <label style="font-size:12.5px;font-weight:700">Ngày học *</label>
              <input name="lessonDate" type="date" required value="${today}" style="width:100%;padding:8px;border-radius:7px;border:1px solid #cbd5e1">
            </div>
            <div style="grid-column:1/-1">
              <label style="font-size:12.5px;font-weight:700">Nội dung bài học *</label>
              <textarea id="lesson-content-input" name="content" rows="3" required placeholder="Ví dụ: Làm quen xe, vào số nguội & số nóng, chạy sa hình cơ bản..." style="width:100%;padding:8px;border-radius:7px;border:1px solid #cbd5e1;font-size:13.5px"></textarea>
              <div class="chip-group">
                <button class="chip-btn" type="button" data-chip="Làm quen xe & thao tác số nguội/nóng">Làm quen xe & số</button>
                <button class="chip-btn" type="button" data-chip="11 bài thi sa hình cơ bản">11 bài sa hình</button>
                <button class="chip-btn" type="button" data-chip="Luyện bài dốc cầu (dừng & khởi hành ngang dốc)">Dốc cầu</button>
                <button class="chip-btn" type="button" data-chip="Ghép xe dọc vào nơi đỗ (lùi chuồng)">Ghép xe dọc</button>
                <button class="chip-btn" type="button" data-chip="Ghép xe ngang nơi đỗ">Ghép xe ngang</button>
                <button class="chip-btn" type="button" data-chip="Thực hành lái xe đường trường DAT">Đường trường DAT</button>
              </div>
            </div>
            <div style="grid-column:1/-1">
              <label style="font-size:12.5px;font-weight:700">Nhận xét của giáo viên về học viên</label>
              <textarea name="feedback" rows="2" placeholder="Ví dụ: Học viên tiếp thu nhanh, tay lái vững, cần chú ý quan sát gương chiếu hậu..." style="width:100%;padding:8px;border-radius:7px;border:1px solid #cbd5e1;font-size:13.5px"></textarea>
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px">
            <button class="btn btn-light" type="button" id="btn-cancel-lesson">Hủy</button>
            <button class="btn btn-primary" type="submit" id="btn-save-lesson">Lưu buổi học</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modalEl = document.querySelector('#add-lesson-modal');
  const closeBtn = modalEl.querySelector('.modal-close-btn');
  const cancelBtn = modalEl.querySelector('#btn-cancel-lesson');
  const form = modalEl.querySelector('#add-lesson-form');
  const contentInput = modalEl.querySelector('#lesson-content-input');

  const closeModal = () => modalEl.remove();
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  modalEl.querySelectorAll('.chip-btn').forEach((chip) => {
    chip.addEventListener('click', () => {
      const text = chip.dataset.chip;
      if (contentInput.value) {
        contentInput.value += ', ' + text;
      } else {
        contentInput.value = text;
      }
      contentInput.focus();
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = form.querySelector('#btn-save-lesson');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Đang lưu…';

    const values = new FormData(form);
    const payload = {
      student_request_id: reqId,
      teacher_id: activeTeacher.id,
      lesson_number: Number(values.get('lessonNumber')) || nextNum,
      lesson_date: values.get('lessonDate'),
      duration_hours: Number(values.get('durationHours')) || 2.0,
      content: String(values.get('content')).trim(),
      teacher_feedback: String(values.get('feedback')).trim() || null,
    };

    try {
      const { error: insErr } = await supabase.from('lesson_logs').insert(payload);
      if (insErr) throw insErr;

      await supabase
        .from('student_requests')
        .update({
          total_lessons_completed: nextNum,
          learning_status: 'learning',
          status: 'confirmed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', reqId);

      closeModal();
      await renderStudentsTab();
    } catch (err) {
      alert('Không thể lưu buổi dạy: ' + err.message);
      saveBtn.disabled = false;
      saveBtn.textContent = 'Lưu buổi học';
    }
  });
}

function openViewLessonsModal(reqId, studentName, logs) {
  const existingModal = document.querySelector('#view-lessons-modal');
  if (existingModal) existingModal.remove();

  const modalHtml = `
    <div id="view-lessons-modal" class="modal-backdrop">
      <div class="modal-dialog">
        <div class="modal-header">
          <div>
            <h3>📋 Nhật ký đào tạo</h3>
            <p class="modal-subtitle">Các buổi thực hành đã ghi nhận cho <b>${escapeHtml(studentName)}</b></p>
          </div>
          <button class="modal-close-btn" type="button">&times;</button>
        </div>
        <div class="lesson-log-list" style="max-height:60vh;overflow-y:auto;padding-right:4px">
          ${logs.map((log) => `
            <div class="lesson-log-item">
              <div style="flex:1">
                <div class="lesson-log-header">
                  <span class="lesson-badge">Buổi ${log.lesson_number}</span>
                  <span class="lesson-date">📅 ${new Date(log.lesson_date).toLocaleDateString('vi-VN')} (${log.duration_hours} giờ)</span>
                </div>
                <div class="lesson-content-text"><b>Nội dung:</b> ${escapeHtml(log.content)}</div>
                ${log.teacher_feedback ? `<div class="lesson-feedback-text">💬 <b>Nhận xét:</b> ${escapeHtml(log.teacher_feedback)}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:16px">
          <button class="btn btn-light modal-close-action" type="button">Đóng</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modalEl = document.querySelector('#view-lessons-modal');
  const closeBtn = modalEl.querySelector('.modal-close-btn');
  const closeActionBtn = modalEl.querySelector('.modal-close-action');
  const closeModal = () => modalEl.remove();
  closeBtn.addEventListener('click', closeModal);
  closeActionBtn.addEventListener('click', closeModal);
}

function renderProfileTab() {
  const content = document.querySelector('#teacher-tab-content');
  if (!content || !activeTeacher) return;

  const t = activeTeacher;
  const licenseStr = Array.isArray(t.licenses) ? t.licenses.join(', ') : (t.licenses || '');

  content.innerHTML = `
    <div style="margin-bottom:20px">
      <h3 style="margin:0 0 6px;color:var(--navy)">Cập nhật thông tin giảng dạy</h3>
      <p style="margin:0;font-size:13px;color:var(--muted)">
        Thông tin này được hiển thị công khai tới tất cả học viên đang tìm giáo viên tại Gia Lai.
      </p>
    </div>

    <form id="teacher-profile-edit-form" class="admin-edit-form">
      <div class="form-grid">
        <div>
          <label>Họ và tên hiển thị *</label>
          <input name="displayName" required value="${escapeHtml(t.display_name || '')}" placeholder="Ví dụ: Thầy Nguyễn Văn A">
        </div>
        <div>
          <label>Khu vực giảng dạy chính *</label>
          <input name="area" required value="${escapeHtml(t.area || '')}" placeholder="Ví dụ: TP. Pleiku, Đak Đoa, Chư Sê…">
        </div>
        <div>
          <label>Hạng bằng nhận giảng dạy *</label>
          <input name="licenses" required value="${escapeHtml(licenseStr)}" placeholder="Ví dụ: Hạng B, C1, B số tự động">
        </div>
        <div>
          <label>Số năm kinh nghiệm dạy lái</label>
          <input name="experienceYears" type="number" min="0" max="60" value="${t.experience_years ?? 0}">
        </div>
        <div>
          <label>Tên trung tâm liên kết (nếu có)</label>
          <input name="centerName" value="${escapeHtml(t.center_name || '')}" placeholder="Ví dụ: Trung tâm Đào tạo Lái xe Gia Lai">
        </div>
        <div class="full" style="background:#f8fafc;padding:16px;border-radius:10px;border:1px solid #e2e8f0;margin-top:10px">
          <div style="font-weight:700;color:var(--navy);font-size:14px;margin-bottom:8px">
            ⚙️ Cài đặt nhận học viên mới
          </div>
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-weight:600;font-size:13.5px">
            <input type="checkbox" id="profile-accepting-input" name="isAcceptingStudents" value="true" ${t.is_accepting_students !== false ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--blue)">
            <span>Đang sẵn sàng nhận thêm học viên mới qua hệ thống DriNet</span>
          </label>
          <div id="pause-reason-wrapper" style="margin-top:10px;${t.is_accepting_students !== false ? 'display:none;' : ''}">
            <label style="font-size:12.5px;color:var(--muted)">Lý do tạm ngừng nhận (hiển thị khi học viên xem hồ sơ)</label>
            <input name="pauseReason" value="${escapeHtml(t.pause_reason || '')}" placeholder="Ví dụ: Đã đủ học viên khóa này, nghỉ phép, bận việc riêng…">
          </div>
        </div>

        <div class="full">
          <label>Giới thiệu bản thân & cam kết đào tạo</label>
          <textarea name="bio" rows="4" placeholder="Chia sẻ về phong cách giảng dạy, xe tập lái (xe mới, máy lạnh...), hỗ trợ đưa đón hoặc tỷ lệ đỗ…">${escapeHtml(t.bio || '')}</textarea>
        </div>
      </div>

      <div class="admin-form-actions" style="margin-top:20px">
        <button class="btn btn-primary" type="submit">Lưu thông tin giảng dạy</button>
      </div>
      <p id="teacher-edit-msg" class="admin-message" aria-live="polite"></p>
    </form>
  `;

  const form = document.querySelector('#teacher-profile-edit-form');
  const acceptingInput = form?.querySelector('#profile-accepting-input');
  const pauseWrapper = form?.querySelector('#pause-reason-wrapper');
  acceptingInput?.addEventListener('change', () => {
    if (pauseWrapper) pauseWrapper.style.display = acceptingInput.checked ? 'none' : 'block';
  });
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const msg = document.querySelector('#teacher-edit-msg');
    const values = new FormData(form);

    const displayName = String(values.get('displayName') || '').trim();
    const area = String(values.get('area') || '').trim();
    const rawLicenses = String(values.get('licenses') || '').trim();
    const experienceYears = Number(values.get('experienceYears')) || 0;
    const centerName = String(values.get('centerName') || '').trim() || null;
    const bio = String(values.get('bio') || '').trim() || null;
    const isAccepting = values.get('isAcceptingStudents') === 'true';
    const pauseReason = !isAccepting ? String(values.get('pauseReason') || '').trim() || null : null;

    if (!displayName || !area || !rawLicenses) {
      if (msg) {
        msg.textContent = 'Vui lòng điền đủ họ tên, khu vực và hạng bằng giảng dạy.';
        msg.className = 'admin-message error';
      }
      return;
    }

    const licenses = rawLicenses.split(',').map((item) => item.trim()).filter(Boolean);
    const pricePerLesson = activeTeacher.price_per_lesson ?? null;

    btn.disabled = true;
    btn.textContent = 'Đang lưu…';

    try {
      const { error: updateError } = await supabase
        .from('teachers')
        .update({
          display_name: displayName,
          area,
          licenses,
          experience_years: experienceYears,
          price_per_lesson: pricePerLesson,
          center_name: centerName,
          bio,
          is_accepting_students: isAccepting,
          pause_reason: pauseReason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeTeacher.id);

      if (updateError) throw updateError;

      activeTeacher.display_name = displayName;
      activeTeacher.area = area;
      activeTeacher.licenses = licenses;
      activeTeacher.experience_years = experienceYears;
      activeTeacher.price_per_lesson = pricePerLesson;
      activeTeacher.center_name = centerName;
      activeTeacher.bio = bio;
      activeTeacher.is_accepting_students = isAccepting;
      activeTeacher.pause_reason = pauseReason;

      const user = getCurrentUser();
      if (user && user.id) {
        await supabase.from('profiles').update({ full_name: displayName }).eq('id', user.id);
        await initialiseAuth();
        const btnSpan = document.querySelector('.account-button span');
        if (btnSpan) btnSpan.textContent = displayName;
      }

      renderHeader(activeTeacher, getCurrentUser());

      if (msg) {
        msg.textContent = 'Đã cập nhật thông tin giảng dạy thành công!';
        msg.className = 'admin-message success';
      }
    } catch (err) {
      if (msg) {
        msg.textContent = err.message || 'Không thể lưu thay đổi.';
        msg.className = 'admin-message error';
      }
    } finally {
      btn.disabled = false;
      btn.textContent = 'Lưu thông tin giảng dạy';
    }
  });
}

async function renderReviewsTab() {
  const content = document.querySelector('#teacher-tab-content');
  if (!content || !activeTeacher) return;

  content.innerHTML = renderSpinner('Đang tải danh sách đánh giá…');

  try {
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('teacher_id', activeTeacher.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const total = reviews ? reviews.length : 0;
    const badge = document.querySelector('#teacher-badge-reviews');
    if (badge) badge.textContent = total;

    if (!reviews || !reviews.length) {
      content.innerHTML = `
        <div style="text-align:center;padding:52px 20px;color:var(--muted)">
          <div style="font-size:44px;margin-bottom:12px">⭐</div>
          <h3 style="color:var(--navy);margin:0 0 8px;font-size:18px">Chưa có đánh giá nào từ học viên</h3>
          <p style="font-size:14px;max-width:480px;margin:auto;line-height:1.6">
            Sau khi học viên hoàn thành khóa đào tạo và gửi phản hồi, những lời nhận xét sẽ được hiển thị tại đây sau khi Ban quản trị DriNet kiểm duyệt.
          </p>
        </div>
      `;
      return;
    }

    content.innerHTML = `
      <div style="margin-bottom:16px">
        <h3 style="margin:0;color:var(--navy)">Đánh giá của học viên (${total})</h3>
        <p style="margin:2px 0 0;font-size:13px;color:var(--muted)">Tổng hợp các đánh giá, phản hồi về quá trình hướng dẫn lái xe của bạn.</p>
      </div>

      <div class="teacher-reviews-list">
        ${reviews.map((rev) => {
          const dateStr = new Date(rev.created_at).toLocaleDateString('vi-VN');
          const isApproved = rev.status === 'approved';
          return `
            <div class="admin-item-card" style="padding:16px 0">
              <div class="admin-item-main">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
                  <h3 style="margin:0">${escapeHtml(rev.student_name)}</h3>
                  <span style="color:#f59e0b;font-size:15px;letter-spacing:1px">
                    ${'★'.repeat(rev.rating)}${'☆'.repeat(5 - rev.rating)}
                  </span>
                  <span class="tag ${isApproved ? 'status-approved' : 'status-pending'}">
                    ${isApproved ? '✓ Đã duyệt công khai' : '⏳ Chờ duyệt'}
                  </span>
                </div>
                <div class="admin-item-meta">
                  <span>📅 Ngày gửi: <b>${dateStr}</b></span>
                </div>
                <div class="admin-item-body" style="border-left-color:var(--orange)">
                  ${escapeHtml(rev.comment)}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch (err) {
    console.error('Lỗi khi tải đánh giá:', err);
    content.innerHTML = `<p class="admin-message error">Không thể tải đánh giá: ${escapeHtml(err.message)}</p>`;
  }
}

function renderSecurityTab(user) {
  return `
    <div style="margin-bottom:20px">
      <h3 style="margin:0 0 6px;color:var(--navy)">Tài khoản & Bảo mật</h3>
      <p style="margin:0;font-size:13px;color:var(--muted)">Quản lý mật khẩu và số điện thoại liên kết với tài khoản của bạn.</p>
    </div>

    <div class="account-grid">
      <form id="teacher-phone-form" class="login-form" style="border:1px solid var(--line);padding:20px;border-radius:12px;background:#f8fafc">
        <h4 style="margin:0 0 8px;color:var(--navy)">Số điện thoại liên hệ</h4>
        <label>Số điện thoại hoặc Zalo</label>
        <input name="phone" type="tel" autocomplete="tel" value="${escapeHtml(user.phone || '')}" placeholder="09xxxxxxxx">
        <button class="btn btn-primary" type="submit" style="margin-top:12px">Lưu số điện thoại</button>
        <p id="teacher-phone-msg" class="admin-message" aria-live="polite"></p>
      </form>

      <div class="account-security">
        <form id="teacher-password-form" class="login-form" style="border:1px solid var(--line);padding:20px;border-radius:12px;background:#f8fafc">
          <h4 style="margin:0 0 8px;color:var(--navy)">Đổi mật khẩu</h4>
          <label>Mật khẩu mới</label>
          <input name="password" type="password" autocomplete="new-password" minlength="6" required placeholder="Tối thiểu 6 ký tự">
          <label>Nhập lại mật khẩu</label>
          <input name="confirmPassword" type="password" autocomplete="new-password" minlength="6" required placeholder="Nhập lại mật khẩu mới">
          <button class="btn btn-light" type="submit" style="margin-top:12px">Cập nhật mật khẩu</button>
          <p id="teacher-pw-msg" class="admin-message" aria-live="polite"></p>
        </form>

        <button id="teacher-sign-out" class="text-button" type="button" style="color:#b72626;font-size:14px;padding:8px 0">
          🚪 Đăng xuất khỏi hệ thống
        </button>
      </div>
    </div>

    <div style="margin-top:24px;background:#f0f7ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div>
        <h4 style="margin:0 0 4px;color:var(--navy);font-size:15px">🛠️ Gặp sự cố cần Ban Quản trị hỗ trợ?</h4>
        <p style="margin:0;font-size:13px;color:var(--muted)">Báo cáo lỗi hiển thị, sự cố học viên hoặc yêu cầu kỹ thuật trực tiếp đến Admin.</p>
      </div>
      <button class="btn btn-primary btn-sm" id="btn-security-support" type="button">Báo cáo sự cố cho Admin &rarr;</button>
    </div>
  `;
}

function bindSecurityTab(user) {
  const phoneForm = document.querySelector('#teacher-phone-form');
  document.querySelector('#btn-security-support')?.addEventListener('click', () => openTeacherSupportModal());

  phoneForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = String(new FormData(phoneForm).get('phone') || '').trim();
    const msg = document.querySelector('#teacher-phone-msg');
    try {
      const { error } = await supabase.from('profiles').update({ phone }).eq('id', user.id);
      if (error) throw error;
      await initialiseAuth();
      if (msg) {
        msg.textContent = 'Đã lưu số điện thoại liên hệ.';
        msg.className = 'admin-message success';
      }
    } catch (err) {
      if (msg) {
        msg.textContent = err.message || 'Không thể lưu số điện thoại.';
        msg.className = 'admin-message error';
      }
    }
  });

  const pwForm = document.querySelector('#teacher-password-form');
  pwForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = new FormData(pwForm);
    const password = String(values.get('password') || '');
    const confirmPassword = String(values.get('confirmPassword') || '');
    const msg = document.querySelector('#teacher-pw-msg');

    if (password !== confirmPassword) {
      if (msg) {
        msg.textContent = 'Mật khẩu xác nhận không khớp.';
        msg.className = 'admin-message error';
      }
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      pwForm.reset();
      if (msg) {
        msg.textContent = 'Đã cập nhật mật khẩu mới thành công!';
        msg.className = 'admin-message success';
      }
    } catch (err) {
      if (msg) {
        msg.textContent = err.message || 'Không thể cập nhật mật khẩu.';
        msg.className = 'admin-message error';
      }
    }
  });

  document.querySelector('#teacher-sign-out')?.addEventListener('click', async () => {
    await signOutFromSupabase();
    location.hash = '#/';
  });
}
