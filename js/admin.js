import { supabase } from './supabase.js';
import { loadTeachers } from './data.js';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function adminPage() {
  return `<section class="page-hero"><div class="container"><span class="kicker" style="color:#83c7ff">QUẢN TRỊ NỘI BỘ</span><h1>Xét duyệt hồ sơ giáo viên</h1><p>Duyệt hồ sơ để giáo viên xuất hiện công khai trên DriNet.</p></div></section><main class="container section admin-page"><div class="admin-note"><b>Dữ liệu trực tiếp:</b> Các quyết định dưới đây được lưu vào Supabase và có hiệu lực ngay.</div><section class="panel admin-list-panel"><div class="admin-list-heading"><div><h2>Hồ sơ chờ xét duyệt</h2><p id="admin-teacher-count">Đang tải…</p></div><button id="refresh-applications" class="btn btn-light" type="button">Tải lại</button></div><div id="admin-teacher-list" class="admin-teacher-list"></div><p id="admin-form-message" class="admin-message" aria-live="polite"></p></section></main>`;
}

async function renderApplications() {
  const list = document.querySelector('#admin-teacher-list');
  const count = document.querySelector('#admin-teacher-count');
  const { data, error } = await supabase.from('teachers').select('id, display_name, area, licenses, experience_years, price_per_lesson, center_name, bio, status, created_at').in('status', ['pending', 'needs_revision']).order('created_at', { ascending: true });
  if (error) throw error;
  count.textContent = `${data.length} hồ sơ cần xử lý`;
  list.innerHTML = data.length ? data.map((teacher) => `<article class="admin-teacher-row"><div><h3>${escapeHtml(teacher.display_name)}</h3><p>${escapeHtml(teacher.area)} · ${escapeHtml(teacher.licenses.join(', '))} · ${teacher.experience_years} năm kinh nghiệm</p><small>${escapeHtml(teacher.center_name || 'Giáo viên độc lập')} · ${teacher.price_per_lesson ? Number(teacher.price_per_lesson).toLocaleString('vi-VN') + 'đ/buổi' : 'Chưa cung cấp học phí'}</small>${teacher.bio ? `<p>${escapeHtml(teacher.bio)}</p>` : ''}</div><div class="admin-row-actions"><button class="admin-edit" data-approve="${teacher.id}" type="button">Duyệt</button><button class="admin-delete" data-reject="${teacher.id}" type="button">Yêu cầu bổ sung</button></div></article>`).join('') : '<p class="login-intro">Không có hồ sơ nào đang chờ xét duyệt.</p>';
}

export function bindAdminPage() {
  const message = document.querySelector('#admin-form-message');
  const load = async () => { try { await renderApplications(); } catch (error) { message.textContent = error.message || 'Không thể tải hồ sơ.'; message.className = 'admin-message error'; } };
  load();
  document.querySelector('#refresh-applications')?.addEventListener('click', load);
  document.querySelector('#admin-teacher-list')?.addEventListener('click', async (event) => {
    const approve = event.target.closest('[data-approve]');
    const reject = event.target.closest('[data-reject]');
    try {
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
}
