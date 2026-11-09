import { supabase } from './supabase.js';
import { loadTeachers } from './data.js';
import { showConfirm, showPrompt, showAlert, showToast } from './dialog.js';
import { escapeHtml } from './utils.js';

const teacherStatusLabel = {
  pending: 'Chờ xét duyệt',
  needs_revision: 'Cần bổ sung',
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
  suspended: 'Tạm ngưng',
};

const requestStatusLabel = {
  new: 'Mới tiếp nhận',
  contacted: 'Đã liên hệ',
  matched: 'Đã điều phối giáo viên',
  confirmed: 'Đã xác nhận học',
  cancelled: 'Đã hủy',
  closed: 'Đã học xong',
};

const reviewStatusLabel = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
};

const contactStatusLabel = {
  new: 'Tin nhắn mới',
  read: 'Đã xem',
  resolved: 'Đã xử lý / Đã trả lời',
};

const teacherSupportStatusLabel = {
  new: 'Chờ hỗ trợ',
  read: 'Đang xử lý',
  resolved: 'Đã giải quyết',
};

const renderSpinner = (text = 'Vui lòng chờ trong giây lát…') =>
  '<div class="drinet-loading-state"><div class="drinet-spinner"></div><p class="drinet-loading-text">' + escapeHtml(text) + '</p></div>';

let currentTab = 'teachers';
let currentRequestsFilter = 'all'; // 'all' | 'leads' | 'messages'

export function isTeacherSupportMessage(msg) {
  if (!msg) return false;
  const content = String(msg.content || '');
  const name = String(msg.full_name || '');
  return content.includes('[BÁO CÁO SỰ CỐ') || name.includes('[Giáo viên]') || content.includes('BÁO CÁO SỰ CỐ - GIÁO VIÊN');
}

function parseTeacherReport(msg) {
  const content = String(msg.content || '');
  const lines = content.split('\n');
  let issueType = '';
  let priority = '';
  let teacherInfo = '';
  let phone = '';
  let details = '';

  const detailsIndex = content.indexOf('Nội dung chi tiết:');
  if (detailsIndex !== -1) {
    details = content.slice(detailsIndex + 'Nội dung chi tiết:'.length).trim();
  } else {
    details = content.replace(/\[BÁO CÁO SỰ CỐ - GIÁO VIÊN\]\s*/i, '').trim();
  }

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('Loại sự cố:')) issueType = trimmed.replace('Loại sự cố:', '').trim();
    else if (trimmed.startsWith('Loại:')) issueType = trimmed.replace('Loại:', '').trim();
    else if (trimmed.startsWith('Mức độ:')) priority = trimmed.replace('Mức độ:', '').trim();
    else if (trimmed.startsWith('Giáo viên:')) teacherInfo = trimmed.replace('Giáo viên:', '').trim();
    else if (trimmed.startsWith('SĐT/Zalo liên hệ:')) phone = trimmed.replace('SĐT/Zalo liên hệ:', '').trim();
  });

  if (!phone) {
    const phoneMatch = String(msg.contact_info || '').match(/(\d{9,11})/);
    if (phoneMatch) phone = phoneMatch[1];
  }

  return {
    issueType: issueType || 'Sự cố chung',
    priority: priority || 'Bình thường',
    teacherInfo: teacherInfo || msg.full_name.replace('[Giáo viên]', '').trim(),
    phone: phone || '',
    details: details || content,
  };
}

export function adminPage() {
  return '<section class="page-hero"><div class="container"><span class="kicker" style="color:#83c7ff">QUẢN TRỊ NỘI BỘ</span><h1>Hệ thống quản trị DriNet</h1><p>Quản lý giáo viên, tiếp nhận yêu cầu học lái & tin nhắn học viên, hỗ trợ sự cố giáo viên.</p></div></section><main class="container section admin-page"><div class="admin-tabs"><button class="admin-tab active" data-tab="teachers" type="button">Hồ sơ giáo viên <span id="badge-teachers" class="admin-badge">…</span></button><button class="admin-tab" data-tab="requests" type="button">Yêu cầu tư vấn & Học viên <span id="badge-requests" class="admin-badge">…</span></button><button class="admin-tab" data-tab="reviews" type="button">Đánh giá học viên <span id="badge-reviews" class="admin-badge">…</span></button><button class="admin-tab" data-tab="contacts" type="button">Hỗ trợ giáo viên <span id="badge-contacts" class="admin-badge">…</span></button></div><section class="panel admin-list-panel"><div class="admin-list-heading"><div><h2 id="admin-panel-title">Quản lý hồ sơ giáo viên</h2><p id="admin-panel-desc">Xem, chỉnh sửa và xét duyệt thông tin giáo viên.</p></div><button id="refresh-admin-data" class="btn btn-light" type="button">Tải lại dữ liệu</button></div><div id="admin-tab-content" class="admin-teacher-list"></div><p id="admin-form-message" class="admin-message" aria-live="polite"></p></section><section id="admin-edit-panel" class="panel admin-edit-panel" hidden></section></main>';
}

async function updateBadges() {
  try {
    const [
      teachersRes,
      requestsRes,
      reviewsRes,
      contactsRes,
    ] = await Promise.all([
      supabase.from('teachers').select('*', { count: 'exact', head: true }),
      supabase.from('student_requests').select('*', { count: 'exact', head: true }).eq('status', 'new'),
      supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('contact_messages').select('full_name, content, status'),
    ]);

    const allContacts = contactsRes?.data || [];
    const newTeacherReports = (allContacts || []).filter((c) => isTeacherSupportMessage(c) && c.status === 'new').length;
    const newStudentContacts = (allContacts || []).filter((c) => !isTeacherSupportMessage(c) && c.status === 'new').length;

    const bTeachers = document.querySelector('#badge-teachers');
    const bRequests = document.querySelector('#badge-requests');
    const bReviews = document.querySelector('#badge-reviews');
    const bContacts = document.querySelector('#badge-contacts');

    if (bTeachers) bTeachers.textContent = teachersRes?.count ?? 0;
    if (bRequests) bRequests.textContent = (requestsRes?.count ?? 0) + newStudentContacts;
    if (bReviews) bReviews.textContent = reviewsRes?.count ?? 0;
    if (bContacts) bContacts.textContent = newTeacherReports;
  } catch (err) {
    console.warn('Không thể cập nhật số lượng admin badge:', err);
    ['badge-teachers', 'badge-requests', 'badge-reviews', 'badge-contacts'].forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.textContent === '…') el.textContent = '0';
    });
  }
}

async function renderTeachersTab() {
  const container = document.querySelector('#admin-tab-content');
  const title = document.querySelector('#admin-panel-title');
  const desc = document.querySelector('#admin-panel-desc');
  if (title) title.textContent = 'Hồ sơ giáo viên';
  if (desc) desc.textContent = 'Xét duyệt, quản trị hồ sơ và cập nhật thông tin hiển thị công khai.';

  container.innerHTML = renderSpinner('Đang tải hồ sơ giáo viên, vui lòng chờ…');

  const [
    { data: teachers, error: teachersError },
    { data: accounts, error: accountsError },
    { data: docs, error: docsError },
  ] = await Promise.all([
    supabase.from('teachers').select('*').order('created_at', { ascending: false }),
    supabase.rpc('get_admin_teacher_accounts'),
    supabase.from('teacher_documents').select('id, teacher_id, storage_path, original_filename, document_type, uploaded_at'),
  ]);

  if (teachersError) throw teachersError;
  if (accountsError) console.warn('Không thể truy vấn tài khoản email:', accountsError);

  const emailByTeacherId = new Map((accounts || []).map((acc) => [acc.teacher_id, acc.email]));
  const docsByTeacherId = new Map();
  (docs || []).forEach((doc) => {
    if (!docsByTeacherId.has(doc.teacher_id)) docsByTeacherId.set(doc.teacher_id, []);
    docsByTeacherId.get(doc.teacher_id).push(doc);
  });

  if (!teachers || !teachers.length) {
    container.innerHTML = '<p class="login-intro">Chưa có hồ sơ giáo viên nào.</p>';
    return;
  }

  container.innerHTML = teachers.map((teacher) => {
    const email = emailByTeacherId.get(teacher.id) || 'Chưa liên kết email';
    const teacherDocs = docsByTeacherId.get(teacher.id) || [];
    const docsHtml = teacherDocs.length
      ? teacherDocs.map((d) => '<a class="admin-doc-link" href="#" data-view-doc="' + escapeHtml(d.storage_path) + '">📄 Xem chứng chỉ: ' + escapeHtml(d.original_filename) + '</a>').join(' ')
      : '';

    return '<article class="admin-item-card"><div class="admin-item-main"><h3>' +
      escapeHtml(teacher.display_name) +
      ' <span class="admin-status status-' + teacher.status + '">' + (teacherStatusLabel[teacher.status] || teacher.status) + '</span></h3>' +
      '<div style="margin-bottom:6px">' + (teacher.is_accepting_students !== false ? '<span style="background:#e6fcf5;color:#0ca678;padding:2px 7px;border-radius:6px;font-size:11px;font-weight:700">🟢 Đang nhận học viên</span>' : '<span style="background:#fee2e2;color:#b91c1c;padding:2px 7px;border-radius:6px;font-size:11px;font-weight:700">🔴 Tạm ngừng nhận dạy</span>' + (teacher.pause_reason ? ' <small style="color:var(--muted)">(' + escapeHtml(teacher.pause_reason) + ')</small>' : '')) + '</div>' +
      '<div class="admin-item-meta"><span>Khu vực:</span> <b>' + escapeHtml(teacher.area) + '</b>' +
      '<span>Hạng bằng:</span> <b>' + escapeHtml((teacher.licenses || []).join(', ')) + '</b>' +
      '<span>Kinh nghiệm:</span> <b>' + teacher.experience_years + ' năm</b>' +
      '<span>Đơn vị:</span> <b>' + escapeHtml(teacher.center_name || 'Độc lập') + '</b></div>' +
      '<div class="admin-item-meta"><span>Tài khoản liên kết:</span> <b class="admin-account-email">' + escapeHtml(email) + '</b>' +
      '<span>Đánh giá:</span> <b>★ ' + Number(teacher.rating || 0).toFixed(1) + ' (' + (teacher.review_count || 0) + ' lượt)</b></div>' +
      (teacher.bio ? '<p class="admin-item-body">' + escapeHtml(teacher.bio) + '</p>' : '') +
      (docsHtml ? '<div>' + docsHtml + '</div>' : '') +
      '</div><div class="admin-btn-group">' +
      '<button class="admin-btn admin-btn-primary" data-edit-teacher="' + teacher.id + '" type="button">Chỉnh sửa</button>' +
      (['pending', 'needs_revision'].includes(teacher.status) ? '<button class="admin-btn admin-btn-success" data-approve-teacher="' + teacher.id + '" type="button">Duyệt hồ sơ</button><button class="admin-btn admin-btn-danger" data-reject-teacher="' + teacher.id + '" type="button">Yêu cầu bổ sung</button>' : '') +
      '</div></article>';
  }).join('');
}

async function renderRequestsTab() {
  const container = document.querySelector('#admin-tab-content');
  const title = document.querySelector('#admin-panel-title');
  const desc = document.querySelector('#admin-panel-desc');
  if (title) title.textContent = 'Yêu cầu tư vấn & Tin nhắn học viên';
  if (desc) desc.textContent = 'Quản lý yêu cầu đăng ký học lái và các câu hỏi, tin nhắn gửi từ học viên bên ngoài.';

  container.innerHTML = renderSpinner('Đang tải danh sách yêu cầu & tin nhắn học viên, vui lòng chờ…');

  const [
    { data: requests, error: requestsError },
    { data: teachers },
    { data: contacts, error: contactsError },
  ] = await Promise.all([
    supabase.from('student_requests').select('*').order('created_at', { ascending: false }),
    supabase.from('teachers').select('id, display_name, area, status, is_accepting_students').order('display_name'),
    supabase.from('contact_messages').select('*').order('created_at', { ascending: false }),
  ]);

  if (requestsError) throw requestsError;
  if (contactsError) throw contactsError;

  const teacherMap = new Map((teachers || []).map((t) => [t.id, t.display_name + ' (' + t.area + ')']));
  const studentContacts = (contacts || []).filter((c) => !isTeacherSupportMessage(c));

  const leadItems = (requests || []).map((r) => {
    const isDirect = Boolean(r.requested_teacher_id && !r.wants_consultation);
    const isNeedDispatch = !isDirect && !r.assigned_teacher_id;
    const isDispatched = !isDirect && Boolean(r.assigned_teacher_id);
    return {
      ...r,
      _itemType: 'request',
      _category: isDirect ? 'direct' : (isNeedDispatch ? 'need_dispatch' : 'dispatched'),
    };
  });
  const contactItems = studentContacts.map((c) => ({ ...c, _itemType: 'contact', _category: 'message' }));

  const needDispatchCount = leadItems.filter((i) => i._category === 'need_dispatch' && i.status === 'new').length;
  const totalNeedDispatch = leadItems.filter((i) => i._category === 'need_dispatch').length;
  const directCount = leadItems.filter((i) => i._category === 'direct').length;
  const dispatchedCount = leadItems.filter((i) => i._category === 'dispatched').length;
  const messagesCount = contactItems.length;
  const totalCount = leadItems.length + messagesCount;

  let itemsToRender = [];
  if (currentRequestsFilter === 'need_dispatch') {
    itemsToRender = leadItems.filter((i) => i._category === 'need_dispatch');
  } else if (currentRequestsFilter === 'direct') {
    itemsToRender = leadItems.filter((i) => i._category === 'direct');
  } else if (currentRequestsFilter === 'dispatched') {
    itemsToRender = leadItems.filter((i) => i._category === 'dispatched');
  } else if (currentRequestsFilter === 'messages') {
    itemsToRender = contactItems;
  } else {
    itemsToRender = [...leadItems, ...contactItems].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  const subFilterHtml = `
    <div style="display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap;align-items:center">
      <span style="font-size:13px;font-weight:700;color:var(--muted);margin-right:4px">Lọc hồ sơ:</span>
      <button class="btn btn-sm ${currentRequestsFilter === 'all' ? 'btn-primary' : 'btn-light'}" data-req-filter="all" type="button">Tất cả (${totalCount})</button>
      <button class="btn btn-sm ${currentRequestsFilter === 'need_dispatch' ? 'btn-primary' : 'btn-light'}" data-req-filter="need_dispatch" type="button" style="${needDispatchCount > 0 && currentRequestsFilter !== 'need_dispatch' ? 'background:#fef3c7;color:#b45309;border-color:#fde68a;font-weight:700' : ''}">
        🎯 Cần DriNet điều phối (${totalNeedDispatch}${needDispatchCount > 0 ? ` - ${needDispatchCount} mới` : ''})
      </button>
      <button class="btn btn-sm ${currentRequestsFilter === 'direct' ? 'btn-primary' : 'btn-light'}" data-req-filter="direct" type="button">
        ⭐ Học viên tự chọn GV (${directCount})
      </button>
      <button class="btn btn-sm ${currentRequestsFilter === 'dispatched' ? 'btn-primary' : 'btn-light'}" data-req-filter="dispatched" type="button">
        ✓ Đã điều phối (${dispatchedCount})
      </button>
      <button class="btn btn-sm ${currentRequestsFilter === 'messages' ? 'btn-primary' : 'btn-light'}" data-req-filter="messages" type="button">
        💬 Tin nhắn liên hệ (${messagesCount})
      </button>
    </div>
  `;

  if (!itemsToRender.length) {
    container.innerHTML = subFilterHtml + '<p class="login-intro">Không có dữ liệu nào trong danh mục được chọn.</p>';
    return;
  }

  const itemsHtml = itemsToRender.map((item) => {
    const dateStr = new Date(item.created_at).toLocaleString('vi-VN');

    if (item._itemType === 'request') {
      const isDirect = item._category === 'direct';
      const isNeedDispatch = item._category === 'need_dispatch';
      const isDispatched = item._category === 'dispatched';
      const requestedTeacherName = item.requested_teacher_id
        ? teacherMap.get(item.requested_teacher_id) || 'Giáo viên đã chọn'
        : 'Học viên nhờ DriNet tư vấn';
      const assignedTeacherName = item.assigned_teacher_id
        ? teacherMap.get(item.assigned_teacher_id) || 'Giáo viên đã điều phối'
        : null;
      const cleanPhone = String(item.phone || '').replace(/\D/g, '');

      let routingHtml = '';
      if (isDirect) {
        routingHtml = `
          <div style="margin-top:12px;padding:12px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:9px;font-size:13px;color:#166534">
            <div style="font-weight:700;display:flex;align-items:center;gap:6px">
              <span>⭐ Học viên chọn thẳng: <b>${escapeHtml(requestedTeacherName)}</b></span>
            </div>
            <div style="font-size:12px;margin-top:3px;color:#15803d">
              Hồ sơ đã chuyển thẳng đến Dashboard của giáo viên để giáo viên chủ động gọi/Zalo liên hệ (không cần Quản trị viên điều phối).
            </div>
            <details style="margin-top:8px;font-size:12px">
              <summary style="cursor:pointer;color:var(--muted);font-weight:600">🔄 Điều phối lại sang giáo viên khác (nếu cần)</summary>
              <div style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap">
                <select id="assign-select-${item.id}" style="padding:6px 10px;border-radius:7px;border:1px solid #cbd5e1;font-size:12.5px;min-width:210px;max-width:320px;background:#fff">
                  <option value="">-- Giữ nguyên giáo viên học viên chọn --</option>
                  ${(teachers || []).map((t) => {
                    const isSelected = item.assigned_teacher_id === t.id;
                    const statusNote = t.status === 'approved' ? '' : ' [Chưa duyệt]';
                    const pausedNote = t.is_accepting_students === false ? ' [🔴 Tạm ngừng]' : '';
                    return `<option value="${t.id}" ${isSelected ? 'selected' : ''}>${escapeHtml(t.display_name)} (${escapeHtml(t.area)})${statusNote}${pausedNote}</option>`;
                  }).join('')}
                </select>
                <button class="btn btn-sm btn-primary" data-dispatch-req="${item.id}" type="button" style="padding:6px 14px;font-size:12px">
                  Lưu thay đổi
                </button>
              </div>
            </details>
          </div>
        `;
      } else if (isNeedDispatch) {
        routingHtml = `
          <div style="margin-top:12px;padding:12px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:9px">
            <div style="font-size:13px;font-weight:700;color:#92400e;margin-bottom:8px">
              ⚠️ <b>Cần Quản trị viên điều phối:</b> Học viên chưa chọn giáo viên cụ thể. Vui lòng chọn giáo viên phù hợp tại khu vực "${escapeHtml(item.preferred_area || 'Gia Lai')}" để bàn giao:
            </div>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <select id="assign-select-${item.id}" style="padding:6px 10px;border-radius:7px;border:1px solid #cbd5e1;font-size:13px;min-width:220px;max-width:340px;background:#fff">
                <option value="">-- Chọn giáo viên điều phối --</option>
                ${(teachers || []).map((t) => {
                  const isSelected = item.assigned_teacher_id === t.id;
                  const statusNote = t.status === 'approved' ? '' : ' [Chưa duyệt]';
                  const pausedNote = t.is_accepting_students === false ? ' [🔴 Tạm ngừng]' : '';
                  return `<option value="${t.id}" ${isSelected ? 'selected' : ''}>${escapeHtml(t.display_name)} (${escapeHtml(t.area)})${statusNote}${pausedNote}</option>`;
                }).join('')}
              </select>
              <button class="btn btn-sm btn-primary" data-dispatch-req="${item.id}" type="button" style="padding:6px 14px;font-size:12.5px">
                🚀 Lưu điều phối
              </button>
            </div>
          </div>
        `;
      } else {
        routingHtml = `
          <div style="margin-top:12px;padding:12px 14px;background:#faf5ff;border:1px solid #e9d5ff;border-radius:9px;font-size:13px;color:#6b21a8">
            <div style="font-weight:700">
              🎯 Đã điều phối cho giáo viên: <b>${escapeHtml(assignedTeacherName)}</b>
            </div>
            <div style="font-size:12px;margin-top:3px;color:#7e22ce">
              Giáo viên đã nhận được hồ sơ trên Dashboard để chủ động liên hệ học viên.
            </div>
            <details style="margin-top:8px;font-size:12px">
              <summary style="cursor:pointer;color:var(--muted);font-weight:600">🔄 Thay đổi giáo viên điều phối</summary>
              <div style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap">
                <select id="assign-select-${item.id}" style="padding:6px 10px;border-radius:7px;border:1px solid #cbd5e1;font-size:12.5px;min-width:210px;max-width:320px;background:#fff">
                  <option value="">-- Hủy điều phối (đưa về chờ) --</option>
                  ${(teachers || []).map((t) => {
                    const isSelected = item.assigned_teacher_id === t.id;
                    const statusNote = t.status === 'approved' ? '' : ' [Chưa duyệt]';
                    const pausedNote = t.is_accepting_students === false ? ' [🔴 Tạm ngừng]' : '';
                    return `<option value="${t.id}" ${isSelected ? 'selected' : ''}>${escapeHtml(t.display_name)} (${escapeHtml(t.area)})${statusNote}${pausedNote}</option>`;
                  }).join('')}
                </select>
                <button class="btn btn-sm btn-primary" data-dispatch-req="${item.id}" type="button" style="padding:6px 14px;font-size:12px">
                  Cập nhật
                </button>
              </div>
            </details>
          </div>
        `;
      }

      const categoryBadge = isDirect
        ? '<span style="background:#e0f2fe;color:#0369a1;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700">⭐ Học viên tự chọn GV</span>'
        : (isNeedDispatch
            ? '<span style="background:#fef3c7;color:#b45309;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700">🎯 Nhờ DriNet tư vấn</span> <span style="background:#fee2e2;color:#b91c1c;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700">⚠️ Chờ điều phối</span>'
            : '<span style="background:#f3e8ff;color:#7e22ce;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700">✓ Đã điều phối</span>');

      const isDepositPaid = item.deposit_status === 'paid';
      const isDepositPending = item.deposit_status === 'pending_approval';
      const isEligible = item.learning_status === 'eligible_for_exam';
      const isGraduated = item.learning_status === 'graduated';
      const isAccepted = item.teacher_accepted === true;
      const acceptedBadge = isAccepted ? '<span style="background:#dcfce7;color:#15803d;padding:2px 7px;border-radius:6px;font-size:11px;font-weight:700">🤝 GV đã tiếp nhận</span>' : (isDepositPaid ? '<span style="background:#fef3c7;color:#b45309;padding:2px 7px;border-radius:6px;font-size:11px;font-weight:700">⏳ Chờ GV tiếp nhận</span>' : '');
      const depositBadge = isDepositPaid
        ? '<span style="background:#e6fcf5;color:#0ca678;padding:2px 7px;border-radius:6px;font-size:11px;font-weight:700">💰 Đã nộp 3tr cọc</span>'
        : (isDepositPending
            ? '<span style="background:#fff9db;color:#f59f00;padding:2px 7px;border-radius:6px;font-size:11px;font-weight:700">⏳ Chờ duyệt 3tr cọc</span>'
            : '<span style="background:#f1f5f9;color:#64748b;padding:2px 7px;border-radius:6px;font-size:11px">Chưa nộp 3tr cọc</span>');

      return '<article class="admin-item-card"><div class="admin-item-main"><h3>' +
        escapeHtml(item.full_name) + ' ' + categoryBadge +
        ' ' + depositBadge +
        ' ' + acceptedBadge +
        (isEligible ? ' <span style="background:#dcfce7;color:#15803d;padding:2px 7px;border-radius:6px;font-size:11px;font-weight:800">🎓 Đủ điều kiện thi</span>' : '') +
        (isGraduated ? ' <span style="background:#e0e7ff;color:#4338ca;padding:2px 7px;border-radius:6px;font-size:11px;font-weight:800">✓ Tốt nghiệp</span>' : '') +
        ' <span class="admin-status status-' + item.status + '">' + (requestStatusLabel[item.status] || item.status) + '</span></h3>' +
        '<div class="admin-item-meta"><span>Số điện thoại/Zalo:</span> <b>' + escapeHtml(item.phone) + '</b>' +
        (cleanPhone ? ' <a href="tel:' + cleanPhone + '" style="color:var(--blue);font-weight:700;font-size:12px;margin-left:4px">📞 Gọi</a>' : '') +
        (item.email ? '<span>Email:</span> <b>' + escapeHtml(item.email) + '</b>' : '') +
        '<span>Hạng bằng:</span> <b>' + escapeHtml(item.license_goal) + '</b>' +
        '<span>Giấy phép học viên:</span> <b>' + (item.has_learner_permit ? 'Đã có' : 'Chưa có') + '</b></div>' +
        '<div class="admin-item-meta"><span>Khu vực thuận tiện:</span> <b>' + escapeHtml(item.preferred_area) + '</b>' +
        (item.preferred_time ? '<span>Thời gian học:</span> <b>' + escapeHtml(item.preferred_time) + '</b>' : '') +
        '<span>Thời gian gửi:</span> <small>' + dateStr + '</small></div>' +
        (item.total_lessons_completed > 0 ? '<div class="admin-item-meta" style="margin-top:4px"><span style="background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:6px;font-size:11.5px;font-weight:700">🚗 Tiến độ: Đã học ' + item.total_lessons_completed + ' buổi thực hành</span></div>' : '') +
        (item.notes ? '<p class="admin-item-body"><b>Ghi chú nhu cầu:</b> ' + escapeHtml(item.notes) + '</p>' : '') +
        routingHtml +
        (item.admin_note ? '<p style="font-size:12px;color:var(--muted);margin:4px 0">Ghi chú nội bộ: ' + escapeHtml(item.admin_note) + '</p>' : '') +
        '</div><div class="admin-btn-group">' +
        (!isDepositPaid ? '<button class="admin-btn admin-btn-success" data-admin-confirm-deposit="' + item.id + '" data-name="' + escapeHtml(item.full_name) + '" type="button" style="font-size:11.5px">💰 Xác nhận nhận 3tr cọc</button>' : '') +
        (item.status === 'new' ? '<button class="admin-btn admin-btn-primary" data-req-action="contacted" data-id="' + item.id + '" type="button">Đã liên hệ</button>' : '') +
        (['new', 'contacted', 'matched'].includes(item.status) ? '<button class="admin-btn admin-btn-success" data-req-action="confirmed" data-id="' + item.id + '" type="button">Xác nhận học</button>' : '') +
        (['new', 'contacted', 'matched'].includes(item.status) ? '<button class="admin-btn admin-btn-danger" data-req-action="cancelled" data-id="' + item.id + '" type="button">Hủy yêu cầu</button>' : '') +
        (item.status === 'confirmed' ? '<button class="admin-btn admin-btn-primary" data-req-action="closed" data-id="' + item.id + '" type="button">Học xong</button>' : '') +
        (['confirmed', 'closed', 'cancelled'].includes(item.status) ? '<button class="admin-btn admin-btn-danger" data-req-delete="' + item.id + '" data-name="' + escapeHtml(item.full_name) + '" type="button">🗑 Xóa</button>' : '') +
        '</div></article>';
    }

    // item._itemType === 'contact' (học viên/khách liên hệ bên ngoài)
    const phoneMatch = String(item.contact_info || '').match(/(\d{9,11})/);
    const cleanPhone = phoneMatch ? phoneMatch[1] : '';

    return '<article class="admin-item-card"><div class="admin-item-main"><h3>' +
      escapeHtml(item.full_name) +
      ' <span style="background:#e0e7ff;color:#4338ca;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700">💬 Tin nhắn học viên</span>' +
      ' <span class="admin-status status-' + item.status + '">' + (contactStatusLabel[item.status] || item.status) + '</span></h3>' +
      '<div class="admin-item-meta"><span>Thông tin liên hệ:</span> <b>' + escapeHtml(item.contact_info) + '</b>' +
      (cleanPhone ? ' <a href="tel:' + cleanPhone + '" style="color:var(--blue);font-weight:700;font-size:12px;margin-left:4px">📞 Gọi</a>' : '') +
      '<span>Thời gian gửi:</span> <small>' + dateStr + '</small></div>' +
      '<p class="admin-item-body">' + escapeHtml(item.content) + '</p>' +
      '</div><div class="admin-btn-group">' +
      (item.status === 'new' ? '<button class="admin-btn admin-btn-primary" data-contact-action="read" data-id="' + item.id + '" type="button">Đã xem</button>' : '') +
      (item.status !== 'resolved' ? '<button class="admin-btn admin-btn-success" data-contact-action="resolved" data-id="' + item.id + '" type="button">Đã xử lý / Trả lời</button>' : '') +
      '<button class="admin-btn admin-btn-primary" data-convert-contact="' + item.id + '" type="button" title="Chuyển tin nhắn thành hồ sơ học lái để điều phối giáo viên">➕ Tạo hồ sơ học lái</button>' +
      '<button class="admin-btn admin-btn-danger" data-contact-delete="' + item.id + '" data-name="' + escapeHtml(item.full_name) + '" type="button">🗑 Xóa</button>' +
      '</div></article>';
  }).join('');

  container.innerHTML = subFilterHtml + itemsHtml;
}

async function renderReviewsTab() {
  const container = document.querySelector('#admin-tab-content');
  const title = document.querySelector('#admin-panel-title');
  const desc = document.querySelector('#admin-panel-desc');
  if (title) title.textContent = 'Kiểm duyệt đánh giá học viên';
  if (desc) desc.textContent = 'Duyệt các đánh giá hợp lệ để hiển thị công khai trên hồ sơ giáo viên.';

  container.innerHTML = renderSpinner('Đang tải danh sách đánh giá, vui lòng chờ…');

  const { data: reviews, error } = await supabase
    .from('reviews')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  if (!reviews || !reviews.length) {
    container.innerHTML = '<p class="login-intro">Chưa có đánh giá nào được gửi lên.</p>';
    return;
  }

  container.innerHTML = reviews.map((rev) => {
    const dateStr = new Date(rev.created_at).toLocaleString('vi-VN');
    const stars = '★'.repeat(rev.rating) + '☆'.repeat(5 - rev.rating);

    return '<article class="admin-item-card"><div class="admin-item-main"><h3>' +
      escapeHtml(rev.student_name) +
      ' · <span style="color:#f59e0b">' + stars + '</span> <span class="admin-status status-' + rev.status + '">' + (reviewStatusLabel[rev.status] || rev.status) + '</span></h3>' +
      '<div class="admin-item-meta"><span>Giáo viên:</span> <b>' + escapeHtml(rev.teacher_name || 'Chưa gắn') + '</b>' +
      '<span>Mã GD/SĐT:</span> <b>' + escapeHtml(rev.phone_or_code) + '</b>' +
      '<span>Gửi lúc:</span> <small>' + dateStr + '</small></div>' +
      '<p class="admin-item-body">' + escapeHtml(rev.comment) + '</p>' +
      '</div><div class="admin-btn-group">' +
      (rev.status === 'pending' ? '<button class="admin-btn admin-btn-success" data-review-action="approved" data-id="' + rev.id + '" type="button">Duyệt công khai</button><button class="admin-btn admin-btn-danger" data-review-action="rejected" data-id="' + rev.id + '" type="button">Từ chối</button>' : '') +
      (rev.status === 'approved' ? '<button class="admin-btn admin-btn-danger" data-review-action="rejected" data-id="' + rev.id + '" type="button">Gỡ bỏ</button>' : '') +
      (rev.status === 'rejected' ? '<button class="admin-btn admin-btn-success" data-review-action="approved" data-id="' + rev.id + '" type="button">Duyệt lại</button>' : '') +
      '</div></article>';
  }).join('');
}

async function renderContactsTab() {
  const container = document.querySelector('#admin-tab-content');
  const title = document.querySelector('#admin-panel-title');
  const desc = document.querySelector('#admin-panel-desc');
  if (title) title.textContent = 'Yêu cầu hỗ trợ & Sự cố từ giáo viên';
  if (desc) desc.textContent = 'Tiếp nhận, xử lý sự cố kỹ thuật và các vấn đề phản ánh do giáo viên gửi đến Ban Quản trị.';

  container.innerHTML = renderSpinner('Đang tải danh sách yêu cầu hỗ trợ từ giáo viên, vui lòng chờ…');

  const { data: contacts, error } = await supabase
    .from('contact_messages')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const teacherMessages = (contacts || []).filter(isTeacherSupportMessage);

  if (!teacherMessages.length) {
    container.innerHTML = '<p class="login-intro">Hiện chưa có yêu cầu hỗ trợ nào từ phía giáo viên.</p>';
    return;
  }

  container.innerHTML = teacherMessages.map((c) => {
    const dateStr = new Date(c.created_at).toLocaleString('vi-VN');
    const report = parseTeacherReport(c);

    let priorityBadge = '<span style="background:#e0f2fe;color:#0369a1;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700">🟢 Bình thường</span>';
    if (report.priority.includes('Khẩn cấp')) {
      priorityBadge = '<span style="background:#fee2e2;color:#b91c1c;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700">🔴 Khẩn cấp</span>';
    } else if (report.priority.includes('gấp')) {
      priorityBadge = '<span style="background:#fef3c7;color:#b45309;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700">🟡 Cần gấp trong ngày</span>';
    }

    const cleanPhone = String(report.phone || '').replace(/\D/g, '');

    return '<article class="admin-item-card"><div class="admin-item-main"><h3>' +
      '👨‍🏫 ' + escapeHtml(report.teacherInfo || c.full_name) +
      ' <span style="background:#ede9fe;color:#6d28d9;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700">Giáo viên</span> ' +
      priorityBadge +
      ' <span class="admin-status status-' + c.status + '">' + (teacherSupportStatusLabel[c.status] || c.status) + '</span></h3>' +
      '<div class="admin-item-meta">' +
      '<span>Loại sự cố:</span> <b>' + escapeHtml(report.issueType) + '</b>' +
      '<span>Liên hệ lại:</span> <b>' + escapeHtml(report.phone || 'Chưa cung cấp') + '</b>' +
      (cleanPhone ? ' <a href="tel:' + cleanPhone + '" style="color:var(--blue);font-weight:700;font-size:12px;margin-left:4px">📞 Gọi giáo viên</a>' : '') +
      '<span>Thời gian gửi:</span> <small>' + dateStr + '</small></div>' +
      '<div class="admin-item-meta"><span>Chi tiết tài khoản/email:</span> <b>' + escapeHtml(c.contact_info) + '</b></div>' +
      '<div class="admin-item-body" style="border-left-color:var(--orange)"><b>Nội dung sự cố:</b><br>' + escapeHtml(report.details).replace(/\n/g, '<br>') + '</div>' +
      '</div><div class="admin-btn-group">' +
      (c.status === 'new' ? '<button class="admin-btn admin-btn-primary" data-contact-action="read" data-id="' + c.id + '" type="button">Đang xử lý</button>' : '') +
      (c.status !== 'resolved' ? '<button class="admin-btn admin-btn-success" data-contact-action="resolved" data-id="' + c.id + '" type="button">✓ Đã giải quyết</button>' : '') +
      '<button class="admin-btn admin-btn-danger" data-contact-delete="' + c.id + '" data-name="' + escapeHtml(c.full_name) + '" type="button">🗑 Xóa</button>' +
      '</div></article>';
  }).join('');
}

function renderEditForm(teacher) {
  const panel = document.querySelector('#admin-edit-panel');
  if (!panel) return;
  panel.hidden = false;
  panel.innerHTML = '<div class="admin-list-heading"><div><h2>Chỉnh sửa hồ sơ giáo viên</h2><p>Cập nhật thông tin hiển thị công khai. Trạng thái hồ sơ và đánh giá không bị thay đổi.</p></div><button id="close-admin-edit" class="btn btn-light" type="button">Đóng</button></div><form id="admin-edit-form" class="admin-edit-form" data-teacher-id="' + teacher.id + '"><div class="form-grid"><div><label>Họ tên hoặc tên trung tâm</label><input name="displayName" required value="' + escapeHtml(teacher.display_name) + '"></div><div><label>Khu vực hoạt động</label><input name="area" required value="' + escapeHtml(teacher.area) + '"></div><div><label>Hạng bằng giảng dạy</label><input name="licenses" required placeholder="Ví dụ: Hạng B, C1" value="' + escapeHtml((teacher.licenses || []).join(', ')) + '"></div><div><label>Số năm kinh nghiệm</label><input name="experienceYears" type="number" min="0" max="60" required value="' + (teacher.experience_years ?? 0) + '"></div><div><label>Tên trung tâm (nếu có)</label><input name="centerName" value="' + escapeHtml(teacher.center_name || '') + '"></div><div class="full"><label>Giới thiệu</label><textarea name="bio" rows="4" placeholder="Giới thiệu ngắn về giáo viên hoặc trung tâm">' + escapeHtml(teacher.bio || '') + '</textarea></div></div><div class="admin-form-actions"><button class="btn btn-primary" type="submit">Lưu thay đổi</button><button id="cancel-admin-edit" class="btn btn-light" type="button">Hủy</button></div><p id="admin-edit-message" class="admin-message" aria-live="polite"></p></form>';
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function bindAdminPage() {
  const message = document.querySelector('#admin-form-message');
  const editPanel = document.querySelector('#admin-edit-panel');
  const tabContainer = document.querySelector('#admin-tab-content');

  const closeEdit = () => {
    if (editPanel) {
      editPanel.hidden = true;
      editPanel.innerHTML = '';
    }
  };

  const loadCurrentTab = async () => {
    try {
      if (message) { message.textContent = ''; message.className = 'admin-message'; }
      await updateBadges();
      if (currentTab === 'teachers') await renderTeachersTab();
      else if (currentTab === 'requests') await renderRequestsTab();
      else if (currentTab === 'reviews') await renderReviewsTab();
      else if (currentTab === 'contacts') await renderContactsTab();
    } catch (err) {
      if (message) {
        message.textContent = err.message || 'Không thể tải dữ liệu.';
        message.className = 'admin-message error';
      }
    }
  };

  loadCurrentTab();

  // Tab Switcher
  document.querySelectorAll('.admin-tab').forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach((b) => b.classList.remove('active'));
      tabBtn.classList.add('active');
      currentTab = tabBtn.dataset.tab;
      closeEdit();
      loadCurrentTab();
    });
  });

  // Refresh Button
  document.querySelector('#refresh-admin-data')?.addEventListener('click', loadCurrentTab);

  // Actions within Tab Content
  tabContainer?.addEventListener('click', async (event) => {
    const editBtn = event.target.closest('[data-edit-teacher]');
    const approveBtn = event.target.closest('[data-approve-teacher]');
    const rejectBtn = event.target.closest('[data-reject-teacher]');
    const viewDoc = event.target.closest('[data-view-doc]');
    const reqBtn = event.target.closest('[data-req-action]');
    const revBtn = event.target.closest('[data-review-action]');
    const contactBtn = event.target.closest('[data-contact-action]');
    const reqDeleteBtn = event.target.closest('[data-req-delete]');
    const contactDeleteBtn = event.target.closest('[data-contact-delete]');
    const filterBtn = event.target.closest('[data-req-filter]');
    const dispatchBtn = event.target.closest('[data-dispatch-req]');
    const convertBtn = event.target.closest('[data-convert-contact]');

    try {
      if (viewDoc) {
        event.preventDefault();
        const path = viewDoc.dataset.viewDoc;
        const { data, error } = await supabase.storage.from('teacher-documents').createSignedUrl(path, 3600);
        if (error) throw error;
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      if (filterBtn) {
        currentRequestsFilter = filterBtn.dataset.reqFilter;
        await renderRequestsTab();
        return;
      }

      if (dispatchBtn) {
        const id = dispatchBtn.dataset.dispatchReq;
        const select = document.querySelector(`#assign-select-${id}`);
        const selectedTeacherId = select ? select.value : '';
        const selectedOptionText = select && select.selectedIndex >= 0 ? select.options[select.selectedIndex].text : '';

        const updatePayload = {
          assigned_teacher_id: selectedTeacherId || null,
          updated_at: new Date().toISOString(),
        };

        if (selectedTeacherId) {
          const { data: curReq } = await supabase.from('student_requests').select('status').eq('id', id).single();
          if (curReq && curReq.status === 'new') {
            updatePayload.status = 'matched';
          }
        } else {
          const { data: curReq } = await supabase.from('student_requests').select('status').eq('id', id).single();
          if (curReq && curReq.status === 'matched') {
            updatePayload.status = 'new';
          }
        }

        const { error } = await supabase.from('student_requests').update(updatePayload).eq('id', id);
        if (error) throw error;

        if (selectedTeacherId) {
          message.textContent = `Đã điều phối thành công học viên cho "${selectedOptionText}". Giáo viên này sẽ thấy học viên trong danh sách "Học viên của tôi".`;
        } else {
          message.textContent = 'Đã hủy điều phối giáo viên cho yêu cầu này.';
        }
        message.className = 'admin-message success';
        await loadCurrentTab();
        return;
      }

      if (convertBtn) {
        const id = convertBtn.dataset.convertContact;
        const { data: contact, error: fetchErr } = await supabase.from('contact_messages').select('*').eq('id', id).single();
        if (fetchErr) throw fetchErr;
        if (!contact) return;

        const phoneMatch = String(contact.contact_info || '').match(/(\d{9,11})/);
        const cleanPhone = phoneMatch ? phoneMatch[1] : (contact.contact_info || '');

        const newReqPayload = {
          full_name: contact.full_name,
          phone: cleanPhone || 'Chưa rõ SĐT',
          email: String(contact.contact_info || '').includes('@') ? contact.contact_info : null,
          license_goal: 'Tư vấn theo tin nhắn',
          preferred_area: 'Gia Lai',
          notes: 'Chuyển từ tin nhắn liên hệ:\n' + (contact.content || ''),
          wants_consultation: true,
          status: 'new',
          source: 'contact_message',
        };

        const { error: insErr } = await supabase.from('student_requests').insert(newReqPayload);
        if (insErr) throw insErr;

        await supabase.from('contact_messages').update({ status: 'resolved' }).eq('id', id);

        currentRequestsFilter = 'need_dispatch';
        message.textContent = `Đã tạo hồ sơ học lái từ tin nhắn của "${contact.full_name}". Bây giờ bạn có thể chọn giáo viên để điều phối ngay!`;
        message.className = 'admin-message success';
        await loadCurrentTab();
        return;
      }

      if (editBtn) {
        const { data, error } = await supabase.from('teachers').select('*').eq('id', editBtn.dataset.editTeacher).single();
        if (error) throw error;
        renderEditForm(data);
        return;
      }

      if (approveBtn) {
        const { error } = await supabase.rpc('approve_teacher_application', { target_teacher_id: approveBtn.dataset.approveTeacher });
        if (error) throw error;
        message.textContent = 'Đã duyệt hồ sơ; giáo viên hiện hiển thị công khai trên DriNet.';
        message.className = 'admin-message success';
        await Promise.all([loadCurrentTab(), loadTeachers()]);
        return;
      }

      if (rejectBtn) {
        const reason = await showPrompt({
          title: 'Yêu cầu bổ sung hồ sơ giáo viên',
          message: 'Nhập lý do hoặc nội dung cần giáo viên hoàn thiện / bổ sung lại hồ sơ:',
          placeholder: 'Ví dụ: Cần cập nhật ảnh chụp bằng lái rõ nét hơn, bổ sung kinh nghiệm...',
          confirmText: 'Gửi yêu cầu',
          confirmType: 'warning',
          icon: '📝',
          required: true,
        });
        if (reason === null) return;
        const { error } = await supabase.rpc('reject_teacher_application', { target_teacher_id: rejectBtn.dataset.rejectTeacher, reason });
        if (error) throw error;
        message.textContent = 'Đã gửi yêu cầu bổ sung cho giáo viên.';
        message.className = 'admin-message success';
        showToast('Đã gửi yêu cầu bổ sung cho giáo viên.', 'info');
        await Promise.all([loadCurrentTab(), loadTeachers()]);
        return;
      }

      const adminDepBtn = target.closest('[data-admin-confirm-deposit]');
      if (adminDepBtn) {
        const id = adminDepBtn.dataset.adminConfirmDeposit;
        const name = adminDepBtn.dataset.name || 'học viên này';
        const ok = await showConfirm({
          title: 'Xác nhận thu tiền cọc',
          message: `Quản trị viên xác nhận đã nhận đủ 3.000.000đ tiền cọc từ "${name}"?\\n\\nSau khi xác nhận, giáo viên nhận dạy sẽ được thông báo để bấm tiếp nhận học viên.`,
          confirmText: 'Xác nhận đã nhận cọc',
          confirmType: 'success',
          icon: '💰',
        });
        if (!ok) return;
        adminDepBtn.disabled = true;
        const { error } = await supabase.from('student_requests').update({
          deposit_status: 'paid',
          deposit_paid_at: new Date().toISOString(),
          learning_status: 'schedule_pending',
        }).eq('id', id);
        if (error) throw error;
        message.textContent = 'Đã xác nhận 3.000.000đ tiền cọc từ "' + name + '".';
        message.className = 'admin-message success';
        showToast('Đã xác nhận 3.000.000đ tiền cọc từ ' + name, 'success');
        await loadCurrentTab();
        return;
      }

      if (reqBtn) {
        const action = reqBtn.dataset.reqAction;
        const id = reqBtn.dataset.id;
        if (action === 'cancelled') {
          const ok = await showConfirm({
            title: 'Hủy yêu cầu học lái',
            message: 'Bạn có chắc chắn muốn hủy yêu cầu tư vấn học lái này?',
            confirmText: 'Hủy yêu cầu',
            confirmType: 'danger',
            icon: '⚠️',
          });
          if (!ok) return;
        }
        const { error } = await supabase.from('student_requests').update({ status: action }).eq('id', id);
        if (error) throw error;
        message.textContent = action === 'closed' ? 'Đã cập nhật: Học viên đã học xong.' : 'Đã cập nhật trạng thái yêu cầu học lái.';
        message.className = 'admin-message success';
        showToast(message.textContent, 'success');
        await loadCurrentTab();
        return;
      }

      if (reqDeleteBtn) {
        const id = reqDeleteBtn.dataset.reqDelete;
        const name = reqDeleteBtn.dataset.name || 'yêu cầu này';
        const ok = await showConfirm({
          title: 'Xóa vĩnh viễn yêu cầu',
          message: `Bạn có chắc chắn muốn xóa vĩnh viễn thông tin của "${name}"?\\n\\nThao tác này không thể hoàn tác.`,
          confirmText: 'Xóa vĩnh viễn',
          confirmType: 'danger',
          icon: '🗑️',
        });
        if (!ok) return;
        const { error } = await supabase.from('student_requests').delete().eq('id', id);
        if (error) throw error;
        message.textContent = 'Đã xóa thông tin của "' + name + '" khỏi hệ thống.';
        message.className = 'admin-message success';
        showToast('Đã xóa thông tin của ' + name, 'info');
        await loadCurrentTab();
        return;
      }

      if (revBtn) {
        const action = revBtn.dataset.reviewAction;
        const id = revBtn.dataset.id;
        const { error } = await supabase.from('reviews').update({ status: action }).eq('id', id);
        if (error) throw error;
        message.textContent = action === 'approved' ? 'Đã duyệt đánh giá công khai.' : 'Đã cập nhật trạng thái đánh giá.';
        message.className = 'admin-message success';
        await loadCurrentTab();
        return;
      }

      if (contactBtn) {
        const action = contactBtn.dataset.contactAction;
        const id = contactBtn.dataset.id;
        const { error } = await supabase.from('contact_messages').update({ status: action }).eq('id', id);
        if (error) throw error;
        message.textContent = 'Đã cập nhật trạng thái tin nhắn thành công.';
        message.className = 'admin-message success';
        await loadCurrentTab();
        return;
      }

      if (contactDeleteBtn) {
        const id = contactDeleteBtn.dataset.contactDelete;
        const name = contactDeleteBtn.dataset.name || 'tin nhắn này';
        const ok = await showConfirm({
          title: 'Xóa tin nhắn liên hệ',
          message: `Bạn có chắc chắn muốn xóa tin nhắn của "${name}"?`,
          confirmText: 'Xóa tin nhắn',
          confirmType: 'danger',
          icon: '🗑️',
        });
        if (!ok) return;
        const { error } = await supabase.from('contact_messages').delete().eq('id', id);
        if (error) throw error;
        message.textContent = 'Đã xóa tin nhắn thành công.';
        message.className = 'admin-message success';
        showToast('Đã xóa tin nhắn thành công.', 'info');
        await loadCurrentTab();
        return;
      }
    } catch (err) {
      message.textContent = err.message || 'Thao tác không thành công.';
      message.className = 'admin-message error';
      showToast(err.message || 'Thao tác không thành công.', 'error');
    }
  });

  // Edit Panel Events
  editPanel?.addEventListener('click', (event) => {
    if (event.target.closest('#close-admin-edit, #cancel-admin-edit')) closeEdit();
  });

  editPanel?.addEventListener('submit', async (event) => {
    if (event.target.id !== 'admin-edit-form') return;
    event.preventDefault();
    const form = event.target;
    const values = new FormData(form);
    const licenses = String(values.get('licenses') || '').split(',').map((item) => item.trim()).filter(Boolean);
    const editMessage = document.querySelector('#admin-edit-message');
    if (!licenses.length) {
      if (editMessage) {
        editMessage.textContent = 'Hãy nhập ít nhất một hạng bằng giảng dạy.';
        editMessage.className = 'admin-message error';
      }
      return;
    }
    const payload = {
      display_name: String(values.get('displayName')).trim(),
      area: String(values.get('area')).trim(),
      licenses,
      experience_years: Number(values.get('experienceYears')) || 0,
      price_per_lesson: String(values.get('price')).trim() ? Number(values.get('price')) : null,
      center_name: String(values.get('centerName')).trim() || null,
      bio: String(values.get('bio')).trim() || null,
    };

    try {
      const { error } = await supabase.from('teachers').update(payload).eq('id', form.dataset.teacherId);
      if (error) throw error;
      message.textContent = 'Đã cập nhật thông tin giáo viên thành công.';
      message.className = 'admin-message success';
      closeEdit();
      await Promise.all([loadCurrentTab(), loadTeachers()]);
    } catch (err) {
      if (editMessage) {
        editMessage.textContent = err.message || 'Không thể lưu thay đổi.';
        editMessage.className = 'admin-message error';
      }
    }
  });
}


