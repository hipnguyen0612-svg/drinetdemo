import { supabase } from './supabase.js';
import { loadTeachers } from './data.js';
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
  matched: 'Đã ghép giáo viên',
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
  resolved: 'Đã xử lý',
};

const renderSpinner = (text = 'Vui lòng chờ trong giây lát…') =>
  '<div class="drinet-loading-state"><div class="drinet-spinner"></div><p class="drinet-loading-text">' + escapeHtml(text) + '</p></div>';

let currentTab = 'teachers';

export function adminPage() {
  return '<section class="page-hero"><div class="container"><span class="kicker" style="color:#83c7ff">QUẢN TRỊ NỘI BỘ</span><h1>Hệ thống quản trị DriNet</h1><p>Quản lý giáo viên, theo dõi yêu cầu tư vấn học lái, kiểm duyệt đánh giá và phản hồi học viên.</p></div></section><main class="container section admin-page"><div class="admin-tabs"><button class="admin-tab active" data-tab="teachers" type="button">Hồ sơ giáo viên <span id="badge-teachers" class="admin-badge">…</span></button><button class="admin-tab" data-tab="requests" type="button">Yêu cầu tư vấn <span id="badge-requests" class="admin-badge">…</span></button><button class="admin-tab" data-tab="reviews" type="button">Đánh giá học viên <span id="badge-reviews" class="admin-badge">…</span></button><button class="admin-tab" data-tab="contacts" type="button">Tin nhắn liên hệ <span id="badge-contacts" class="admin-badge">…</span></button></div><section class="panel admin-list-panel"><div class="admin-list-heading"><div><h2 id="admin-panel-title">Quản lý hồ sơ giáo viên</h2><p id="admin-panel-desc">Xem, chỉnh sửa và xét duyệt thông tin giáo viên.</p></div><button id="refresh-admin-data" class="btn btn-light" type="button">Tải lại dữ liệu</button></div><div id="admin-tab-content" class="admin-teacher-list"></div><p id="admin-form-message" class="admin-message" aria-live="polite"></p></section><section id="admin-edit-panel" class="panel admin-edit-panel" hidden></section></main>';
}

async function updateBadges() {
  try {
    const [
      { count: teachersCount },
      { count: newRequestsCount },
      { count: pendingReviewsCount },
      { count: newContactsCount },
    ] = await Promise.all([
      supabase.from('teachers').select('*', { count: 'exact', head: true }),
      supabase.from('student_requests').select('*', { count: 'exact', head: true }).eq('status', 'new'),
      supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('contact_messages').select('*', { count: 'exact', head: true }).eq('status', 'new'),
    ]);

    const bTeachers = document.querySelector('#badge-teachers');
    const bRequests = document.querySelector('#badge-requests');
    const bReviews = document.querySelector('#badge-reviews');
    const bContacts = document.querySelector('#badge-contacts');

    if (bTeachers) bTeachers.textContent = teachersCount ?? 0;
    if (bRequests) bRequests.textContent = newRequestsCount ?? 0;
    if (bReviews) bReviews.textContent = pendingReviewsCount ?? 0;
    if (bContacts) bContacts.textContent = newContactsCount ?? 0;
  } catch (err) {
    console.warn('Không thể cập nhật số lượng admin badge:', err);
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

    const priceLabel = teacher.price_per_lesson
      ? Number(teacher.price_per_lesson).toLocaleString('vi-VN') + 'đ/buổi'
      : 'Chưa cập nhật học phí';

    return '<article class="admin-item-card"><div class="admin-item-main"><h3>' +
      escapeHtml(teacher.display_name) +
      ' <span class="admin-status status-' + teacher.status + '">' + (teacherStatusLabel[teacher.status] || teacher.status) + '</span></h3>' +
      '<div class="admin-item-meta"><span>Khu vực:</span> <b>' + escapeHtml(teacher.area) + '</b>' +
      '<span>Hạng bằng:</span> <b>' + escapeHtml((teacher.licenses || []).join(', ')) + '</b>' +
      '<span>Kinh nghiệm:</span> <b>' + teacher.experience_years + ' năm</b>' +
      '<span>Học phí:</span> <b>' + priceLabel + '</b>' +
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
  if (title) title.textContent = 'Yêu cầu tư vấn học lái';
  if (desc) desc.textContent = 'Danh sách học viên gửi nhu cầu tư vấn hoặc chọn giáo viên cụ thể.';

  container.innerHTML = renderSpinner('Đang tải danh sách yêu cầu, vui lòng chờ…');

  const [
    { data: requests, error },
    { data: teachers },
  ] = await Promise.all([
    supabase.from('student_requests').select('*').order('created_at', { ascending: false }),
    supabase.from('teachers').select('id, display_name, area'),
  ]);

  if (error) throw error;

  const teacherMap = new Map((teachers || []).map((t) => [t.id, t.display_name + ' (' + t.area + ')']));

  if (!requests || !requests.length) {
    container.innerHTML = '<p class="login-intro">Chưa có yêu cầu tư vấn học lái nào.</p>';
    return;
  }

  container.innerHTML = requests.map((req) => {
    const teacherName = req.requested_teacher_id
      ? teacherMap.get(req.requested_teacher_id) || 'Giáo viên đã chọn'
      : 'DriNet tư vấn giáo viên phù hợp';

    const dateStr = new Date(req.created_at).toLocaleString('vi-VN');

    return '<article class="admin-item-card"><div class="admin-item-main"><h3>' +
      escapeHtml(req.full_name) +
      ' <span class="admin-status status-' + req.status + '">' + (requestStatusLabel[req.status] || req.status) + '</span></h3>' +
      '<div class="admin-item-meta"><span>Số điện thoại/Zalo:</span> <b>' + escapeHtml(req.phone) + '</b>' +
      (req.email ? '<span>Email:</span> <b>' + escapeHtml(req.email) + '</b>' : '') +
      '<span>Hạng bằng:</span> <b>' + escapeHtml(req.license_goal) + '</b>' +
      '<span>Giấy phép học viên:</span> <b>' + (req.has_learner_permit ? 'Đã có' : 'Chưa có') + '</b></div>' +
      '<div class="admin-item-meta"><span>Khu vực thuận tiện:</span> <b>' + escapeHtml(req.preferred_area) + '</b>' +
      '<span>Thời gian học:</span> <b>' + escapeHtml(req.preferred_time || 'Linh hoạt') + '</b>' +
      '<span>Nguyện vọng:</span> <b>' + escapeHtml(teacherName) + '</b>' +
      '<span>Thời gian gửi:</span> <small>' + dateStr + '</small></div>' +
      (req.notes ? '<p class="admin-item-body">' + escapeHtml(req.notes) + '</p>' : '') +
      (req.admin_note ? '<p style="font-size:12px;color:var(--muted);margin:4px 0">Ghi chú nội bộ: ' + escapeHtml(req.admin_note) + '</p>' : '') +
      '</div><div class="admin-btn-group">' +
      (req.status === 'new' ? '<button class="admin-btn admin-btn-primary" data-req-action="contacted" data-id="' + req.id + '" type="button">Đã liên hệ</button>' : '') +
      (['new', 'contacted'].includes(req.status) ? '<button class="admin-btn admin-btn-success" data-req-action="confirmed" data-id="' + req.id + '" type="button">Xác nhận học</button>' : '') +
      (['new', 'contacted'].includes(req.status) ? '<button class="admin-btn admin-btn-danger" data-req-action="cancelled" data-id="' + req.id + '" type="button">Hủy yêu cầu</button>' : '') +
      (req.status === 'confirmed' ? '<button class="admin-btn admin-btn-primary" data-req-action="closed" data-id="' + req.id + '" type="button">Học xong</button>' : '') +
      (['confirmed', 'closed', 'cancelled'].includes(req.status) ? '<button class="admin-btn admin-btn-danger" data-req-delete="' + req.id + '" data-name="' + escapeHtml(req.full_name) + '" type="button">🗑 Xóa</button>' : '') +
      '</div></article>';
  }).join('');
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
  if (title) title.textContent = 'Tin nhắn liên hệ';
  if (desc) desc.textContent = 'Theo dõi và xử lý các tin nhắn từ biểu mẫu liên hệ DriNet.';

  container.innerHTML = renderSpinner('Đang tải tin nhắn liên hệ, vui lòng chờ…');

  const { data: contacts, error } = await supabase
    .from('contact_messages')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  if (!contacts || !contacts.length) {
    container.innerHTML = '<p class="login-intro">Chưa có tin nhắn liên hệ nào.</p>';
    return;
  }

  container.innerHTML = contacts.map((c) => {
    const dateStr = new Date(c.created_at).toLocaleString('vi-VN');

    return '<article class="admin-item-card"><div class="admin-item-main"><h3>' +
      escapeHtml(c.full_name) +
      ' <span class="admin-status status-' + c.status + '">' + (contactStatusLabel[c.status] || c.status) + '</span></h3>' +
      '<div class="admin-item-meta"><span>Thông tin liên hệ:</span> <b>' + escapeHtml(c.contact_info) + '</b>' +
      '<span>Thời gian gửi:</span> <small>' + dateStr + '</small></div>' +
      '<p class="admin-item-body">' + escapeHtml(c.content) + '</p>' +
      '</div><div class="admin-btn-group">' +
      (c.status === 'new' ? '<button class="admin-btn admin-btn-primary" data-contact-action="read" data-id="' + c.id + '" type="button">Đã xem</button>' : '') +
      (c.status !== 'resolved' ? '<button class="admin-btn admin-btn-success" data-contact-action="resolved" data-id="' + c.id + '" type="button">Đã xử lý</button>' : '') +
      '</div></article>';
  }).join('');
}

function renderEditForm(teacher) {
  const panel = document.querySelector('#admin-edit-panel');
  if (!panel) return;
  panel.hidden = false;
  panel.innerHTML = '<div class="admin-list-heading"><div><h2>Chỉnh sửa hồ sơ giáo viên</h2><p>Cập nhật thông tin hiển thị công khai. Trạng thái hồ sơ và đánh giá không bị thay đổi.</p></div><button id="close-admin-edit" class="btn btn-light" type="button">Đóng</button></div><form id="admin-edit-form" class="admin-edit-form" data-teacher-id="' + teacher.id + '"><div class="form-grid"><div><label>Họ tên hoặc tên trung tâm</label><input name="displayName" required value="' + escapeHtml(teacher.display_name) + '"></div><div><label>Khu vực hoạt động</label><input name="area" required value="' + escapeHtml(teacher.area) + '"></div><div><label>Hạng bằng giảng dạy</label><input name="licenses" required placeholder="Ví dụ: Hạng B, C1" value="' + escapeHtml((teacher.licenses || []).join(', ')) + '"></div><div><label>Số năm kinh nghiệm</label><input name="experienceYears" type="number" min="0" max="60" required value="' + (teacher.experience_years ?? 0) + '"></div><div><label>Học phí tham khảo (đ/buổi)</label><input name="price" type="number" min="0" value="' + (teacher.price_per_lesson ?? '') + '"></div><div><label>Tên trung tâm (nếu có)</label><input name="centerName" value="' + escapeHtml(teacher.center_name || '') + '"></div><div class="full"><label>Giới thiệu</label><textarea name="bio" rows="4" placeholder="Giới thiệu ngắn về giáo viên hoặc trung tâm">' + escapeHtml(teacher.bio || '') + '</textarea></div></div><div class="admin-form-actions"><button class="btn btn-primary" type="submit">Lưu thay đổi</button><button id="cancel-admin-edit" class="btn btn-light" type="button">Hủy</button></div><p id="admin-edit-message" class="admin-message" aria-live="polite"></p></form>';
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

    try {
      if (viewDoc) {
        event.preventDefault();
        const path = viewDoc.dataset.viewDoc;
        const { data, error } = await supabase.storage.from('teacher-documents').createSignedUrl(path, 3600);
        if (error) throw error;
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
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
        const reason = prompt('Nhập lý do cần giáo viên bổ sung hồ sơ:');
        if (reason === null) return;
        const { error } = await supabase.rpc('reject_teacher_application', { target_teacher_id: rejectBtn.dataset.rejectTeacher, reason });
        if (error) throw error;
        message.textContent = 'Đã gửi yêu cầu bổ sung cho giáo viên.';
        message.className = 'admin-message success';
        await Promise.all([loadCurrentTab(), loadTeachers()]);
        return;
      }

      if (reqBtn) {
        const action = reqBtn.dataset.reqAction;
        const id = reqBtn.dataset.id;
        if (action === 'cancelled' && !confirm('Bạn có chắc chắn muốn hủy yêu cầu này?')) return;
        const { error } = await supabase.from('student_requests').update({ status: action }).eq('id', id);
        if (error) throw error;
        message.textContent = action === 'closed' ? 'Đã cập nhật: Học viên đã học xong.' : 'Đã cập nhật trạng thái yêu cầu học lái.';
        message.className = 'admin-message success';
        await loadCurrentTab();
        return;
      }

      if (reqDeleteBtn) {
        const id = reqDeleteBtn.dataset.reqDelete;
        const name = reqDeleteBtn.dataset.name || 'yêu cầu này';
        if (!confirm('Bạn có chắc chắn muốn xóa vĩnh viễn thông tin của "' + name + '"?')) return;
        const { error } = await supabase.from('student_requests').delete().eq('id', id);
        if (error) throw error;
        message.textContent = 'Đã xóa thông tin của "' + name + '" khỏi hệ thống.';
        message.className = 'admin-message success';
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
        message.textContent = 'Đã cập nhật trạng thái tin nhắn liên hệ.';
        message.className = 'admin-message success';
        await loadCurrentTab();
        return;
      }
    } catch (err) {
      message.textContent = err.message || 'Thao tác không thành công.';
      message.className = 'admin-message error';
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
