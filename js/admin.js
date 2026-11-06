import { supabase } from './supabase.js';
import { loadTeachers } from './data.js';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const statusLabel = { pending: 'Chờ xét duyệt', needs_revision: 'Cần bổ sung', approved: 'Đã duyệt', rejected: 'Đã từ chối', suspended: 'Tạm ngưng' };

export function adminPage() {
  return `<section class="page-hero"><div class="container"><span class="kicker" style="color:#83c7ff">QUẢN TRỊ NỘI BỘ</span><h1>Quản lý hồ sơ giáo viên</h1><p>Xem, chỉnh sửa và xét duyệt thông tin giáo viên trên DriNet.</p></div></section><main class="container section admin-page"><section class="panel admin-list-panel"><div class="admin-list-heading"><div><h2>Hồ sơ giáo viên</h2><p id="admin-teacher-count">Đang tải…</p></div><button id="refresh-applications" class="btn btn-light" type="button">Tải lại</button></div><div id="admin-teacher-list" class="admin-teacher-list"></div><p id="admin-form-message" class="admin-message" aria-live="polite"></p></section><section id="admin-edit-panel" class="panel admin-edit-panel" hidden></section></main>`;
}

async function renderApplications() {
  const list = document.querySelector('#admin-teacher-list');
  const count = document.querySelector('#admin-teacher-count');
  const { data, error } = await supabase.from('teachers').select('id, display_name, area, licenses, experience_years, price_per_lesson, center_name, bio, status, created_at').order('created_at', { ascending: false });
  if (error) throw error;
  count.textContent = `${data.length} hồ sơ giáo viên`;
  list.innerHTML = data.length ? data.map((teacher) => `<article class="admin-teacher-row"><div><h3>${escapeHtml(teacher.display_name)} <span class="admin-status status-${teacher.status}">${statusLabel[teacher.status] || teacher.status}</span></h3><p>${escapeHtml(teacher.area)} · ${escapeHtml((teacher.licenses || []).join(', '))} · ${teacher.experience_years} năm kinh nghiệm</p><small>${escapeHtml(teacher.center_name || 'Giáo viên độc lập')} · ${teacher.price_per_lesson ? Number(teacher.price_per_lesson).toLocaleString('vi-VN') + 'đ/buổi' : 'Chưa cung cấp học phí'}</small>${teacher.bio ? `<p>${escapeHtml(teacher.bio)}</p>` : ''}</div><div class="admin-row-actions"><button class="admin-edit" data-edit="${teacher.id}" type="button">Chỉnh sửa</button>${['pending', 'needs_revision'].includes(teacher.status) ? `<button class="admin-edit" data-approve="${teacher.id}" type="button">Duyệt</button><button class="admin-delete" data-reject="${teacher.id}" type="button">Yêu cầu bổ sung</button>` : ''}</div></article>`).join('') : '<p class="login-intro">Chưa có hồ sơ giáo viên.</p>';
}

function renderEditForm(teacher) {
  const panel = document.querySelector('#admin-edit-panel');
  panel.hidden = false;
  panel.innerHTML = `<div class="admin-list-heading"><div><h2>Chỉnh sửa hồ sơ giáo viên</h2><p>Cập nhật thông tin hiển thị công khai. Trạng thái hồ sơ và đánh giá không bị thay đổi.</p></div><button id="close-admin-edit" class="btn btn-light" type="button">Đóng</button></div><form id="admin-edit-form" class="admin-edit-form" data-teacher-id="${teacher.id}"><div class="form-grid"><div><label>Họ tên hoặc tên trung tâm</label><input name="displayName" required value="${escapeHtml(teacher.display_name)}"></div><div><label>Khu vực hoạt động</label><input name="area" required value="${escapeHtml(teacher.area)}"></div><div><label>Hạng bằng giảng dạy</label><input name="licenses" required placeholder="Ví dụ: Hạng B, C1" value="${escapeHtml((teacher.licenses || []).join(', '))}"></div><div><label>Số năm kinh nghiệm</label><input name="experienceYears" type="number" min="0" max="60" required value="${teacher.experience_years}"></div><div><label>Học phí tham khảo (đ/buổi)</label><input name="price" type="number" min="0" value="${teacher.price_per_lesson ?? ''}"></div><div><label>Tên trung tâm (nếu có)</label><input name="centerName" value="${escapeHtml(teacher.center_name)}"></div><div class="full"><label>Giới thiệu</label><textarea name="bio" rows="4" placeholder="Giới thiệu ngắn về giáo viên hoặc trung tâm">${escapeHtml(teacher.bio)}</textarea></div></div><div class="admin-form-actions"><button class="btn btn-primary" type="submit">Lưu thay đổi</button><button id="cancel-admin-edit" class="btn btn-light" type="button">Hủy</button></div><p id="admin-edit-message" class="admin-message" aria-live="polite"></p></form>`;
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function bindAdminPage() {
  const message = document.querySelector('#admin-form-message');
  const editPanel = document.querySelector('#admin-edit-panel');
  const closeEdit = () => { editPanel.hidden = true; editPanel.innerHTML = ''; };
  const load = async () => { try { await renderApplications(); } catch (error) { message.textContent = error.message || 'Không thể tải hồ sơ.'; message.className = 'admin-message error'; } };
  load();
  document.querySelector('#refresh-applications')?.addEventListener('click', load);
  document.querySelector('#admin-teacher-list')?.addEventListener('click', async (event) => {
    const edit = event.target.closest('[data-edit]');
    const approve = event.target.closest('[data-approve]');
    const reject = event.target.closest('[data-reject]');
    try {
      if (edit) {
        const { data, error } = await supabase.from('teachers').select('id, display_name, area, licenses, experience_years, price_per_lesson, center_name, bio').eq('id', edit.dataset.edit).single();
        if (error) throw error;
        renderEditForm(data);
        return;
      }
      if (approve) {
        const { error } = await supabase.rpc('approve_teacher_application', { target_teacher_id: approve.dataset.approve });
        if (error) throw error;
        message.textContent = 'Đã duyệt hồ sơ; giáo viên hiện hiển thị công khai.';
      }
      if (reject) {
        const reason = prompt('Nhập nội dung cần giáo viên bổ sung:');
        if (reason === null) return;
        const { error } = await supabase.rpc('reject_teacher_application', { target_teacher_id: reject.dataset.reject, reason });
        if (error) throw error;
        message.textContent = 'Đã gửi yêu cầu bổ sung cho giáo viên.';
      }
      message.className = 'admin-message success';
      await Promise.all([load(), loadTeachers()]);
    } catch (error) { message.textContent = error.message || 'Không thể cập nhật hồ sơ.'; message.className = 'admin-message error'; }
  });
  editPanel?.addEventListener('click', (event) => { if (event.target.closest('#close-admin-edit, #cancel-admin-edit')) closeEdit(); });
  editPanel?.addEventListener('submit', async (event) => {
    if (event.target.id !== 'admin-edit-form') return;
    event.preventDefault();
    const form = event.target;
    const values = new FormData(form);
    const licenses = String(values.get('licenses')).split(',').map((item) => item.trim()).filter(Boolean);
    const editMessage = document.querySelector('#admin-edit-message');
    if (!licenses.length) { editMessage.textContent = 'Hãy nhập ít nhất một hạng bằng.'; editMessage.className = 'admin-message error'; return; }
    const payload = { display_name: String(values.get('displayName')).trim(), area: String(values.get('area')).trim(), licenses, experience_years: Number(values.get('experienceYears')), price_per_lesson: String(values.get('price')).trim() ? Number(values.get('price')) : null, center_name: String(values.get('centerName')).trim() || null, bio: String(values.get('bio')).trim() || null };
    try {
      const { error } = await supabase.from('teachers').update(payload).eq('id', form.dataset.teacherId);
      if (error) throw error;
      message.textContent = 'Đã cập nhật thông tin giáo viên.'; message.className = 'admin-message success';
      closeEdit();
      await Promise.all([load(), loadTeachers()]);
    } catch (error) { editMessage.textContent = error.message || 'Không thể lưu thay đổi.'; editMessage.className = 'admin-message error'; }
  });
}