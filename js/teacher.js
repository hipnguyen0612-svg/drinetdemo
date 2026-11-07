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
          📝 Thông tin giảng dạy & Học phí
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
        <span class="teacher-stat-label">Học phí niêm yết</span>
        <span class="teacher-stat-value" style="font-size:19px">
          ${teacher.price_per_lesson ? Number(teacher.price_per_lesson).toLocaleString('vi-VN') + 'đ' : 'Thỏa thuận'}
        </span>
        <span class="teacher-stat-sub">${teacher.price_per_lesson ? 'mỗi buổi học' : 'chưa đặt giá'}</span>
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
    const { data: requests, error } = await supabase
      .from('student_requests')
      .select('*')
      .or(`requested_teacher_id.eq.${activeTeacher.id},assigned_teacher_id.eq.${activeTeacher.id}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const total = requests ? requests.length : 0;
    const newCount = (requests || []).filter((r) => r.status === 'new').length;

    const badge = document.querySelector('#teacher-badge-students');
    if (badge) badge.textContent = newCount > 0 ? `${newCount} mới` : `${total}`;

    const statCount = document.querySelector('#stat-students-count');
    const statSub = document.querySelector('#stat-students-sub');
    if (statCount) statCount.textContent = total;
    if (statSub) statSub.textContent = newCount > 0 ? `${newCount} học viên mới chưa liên hệ` : 'Tất cả đã được xử lý';

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
          const canContact = req.status === 'new';
          const canConfirm = req.status === 'new' || req.status === 'contacted';
          const canClose = req.status === 'confirmed';

          return `
            <div class="admin-item-card" data-req-id="${req.id}">
              <div class="admin-item-main">
                <h3>
                  ${escapeHtml(req.full_name)}
                  <span class="tag status-${req.status}">${requestStatusLabels[req.status] || req.status}</span>
                </h3>
                <div class="admin-item-meta">
                  <span>📞 Số điện thoại: <b>${escapeHtml(req.phone)}</b></span>
                  ${req.email ? `<span>✉️ Email: <b>${escapeHtml(req.email)}</b></span>` : ''}
                  <span>🚗 Hạng muốn học: <b>${escapeHtml(req.license_goal || 'Chưa rõ')}</b></span>
                  <span>📍 Khu vực: <b>${escapeHtml(req.preferred_area || 'Gia Lai')}</b></span>
                  ${req.preferred_time ? `<span>⏰ Thời gian học: <b>${escapeHtml(req.preferred_time)}</b></span>` : ''}
                  <span>📅 Ngày gửi: <b>${dateStr}</b></span>
                </div>
                ${req.notes ? `<div class="admin-item-body"><b>Ghi chú:</b> ${escapeHtml(req.notes)}</div>` : ''}
                <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
                  <a class="admin-btn btn-call" href="tel:${escapeHtml(cleanPhone)}">📞 Gọi điện ngay</a>
                  <a class="admin-btn btn-zalo" href="https://zalo.me/${encodeURIComponent(cleanPhone)}" target="_blank" rel="noopener">💬 Nhắn tin Zalo</a>
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
  } catch (err) {
    console.error('Lỗi khi tải yêu cầu học viên:', err);
    content.innerHTML = `<p class="admin-message error">Không thể tải học viên: ${escapeHtml(err.message)}</p>`;
  }
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
          <label>Học phí tham khảo (đ/buổi)</label>
          <input name="pricePerLesson" type="number" min="0" step="10000" value="${t.price_per_lesson ?? ''}" placeholder="Ví dụ: 300000">
          <small style="color:var(--muted);font-size:11px;display:block;margin-top:3px">Để trống nếu muốn học viên liên hệ thỏa thuận</small>
        </div>
        <div>
          <label>Tên trung tâm liên kết (nếu có)</label>
          <input name="centerName" value="${escapeHtml(t.center_name || '')}" placeholder="Ví dụ: Trung tâm Đào tạo Lái xe Gia Lai">
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
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const msg = document.querySelector('#teacher-edit-msg');
    const values = new FormData(form);

    const displayName = String(values.get('displayName') || '').trim();
    const area = String(values.get('area') || '').trim();
    const rawLicenses = String(values.get('licenses') || '').trim();
    const experienceYears = Number(values.get('experienceYears')) || 0;
    const rawPrice = values.get('pricePerLesson');
    const centerName = String(values.get('centerName') || '').trim() || null;
    const bio = String(values.get('bio') || '').trim() || null;

    if (!displayName || !area || !rawLicenses) {
      if (msg) {
        msg.textContent = 'Vui lòng điền đủ họ tên, khu vực và hạng bằng giảng dạy.';
        msg.className = 'admin-message error';
      }
      return;
    }

    const licenses = rawLicenses.split(',').map((item) => item.trim()).filter(Boolean);
    const pricePerLesson = rawPrice ? Number(rawPrice) : null;

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