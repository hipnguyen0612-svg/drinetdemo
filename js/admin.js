import { addTeacher, clearAdminTeachers, getTeachers, removeAdminTeacher, teachers, updateTeacher } from './data.js';

const fallbackImage = 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=700&q=80';
const MAX_IMAGE_SIZE = 1.5 * 1024 * 1024;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&gt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const slugify = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function teacherForm() {
  return `<form id="admin-teacher-form" class="panel admin-form"><input type="hidden" name="slug"><input type="hidden" name="existingImage"><h2 id="admin-form-title">Thêm giáo viên</h2><p id="admin-form-description">Những trường có dấu * là bắt buộc.</p><div class="form-grid"><div><label>Họ và tên *</label><input name="name" required maxlength="80" placeholder="Ví dụ: Phạm Quốc An"></div><div><label>Khu vực *</label><select name="area" required><option value="">Chọn khu vực</option><option>TP. Pleiku</option><option>Chư Sê</option></select></div><div><label>Kinh nghiệm (năm) *</label><input name="experience" required type="number" min="0" max="60" placeholder="Ví dụ: 8"></div><div><label>Học phí mỗi buổi (VNĐ) *</label><input name="price" required type="number" min="0" step="10000" placeholder="Ví dụ: 350000"></div><div class="full"><label>Hạng bằng có thể dạy *</label><div class="license-options"><label><input name="licenses" type="checkbox" value="Hạng B" checked> Hạng B</label><label><input name="licenses" type="checkbox" value="C1"> C1</label></div></div><div class="full"><label for="teacher-image">Ảnh đại diện</label><input id="teacher-image" name="imageFile" type="file" accept="image/png,image/jpeg,image/webp"><small class="admin-image-help">Chọn ảnh JPG, PNG hoặc WebP, tối đa 1,5 MB. Nếu không chọn ảnh mới sẽ dùng ảnh hiện có hoặc ảnh mặc định.</small><div id="teacher-image-preview" class="admin-image-preview" hidden><img alt="Xem trước ảnh đại diện"><button id="remove-selected-image" type="button">Bỏ ảnh đã chọn</button></div></div><div><label>Trung tâm / đơn vị</label><input name="center" maxlength="100" placeholder="Ví dụ: Độc lập"></div><div class="full"><label>Giới thiệu ngắn</label><textarea name="bio" rows="4" maxlength="400" placeholder="Mô tả phong cách và kinh nghiệm giảng dạy"></textarea></div><div class="full admin-form-actions"><button id="admin-submit" class="btn btn-primary" type="submit">Thêm giáo viên</button><button id="cancel-edit" class="btn btn-light" type="button" hidden>Hủy chỉnh sửa</button></div></div><p id="admin-form-message" class="admin-message" aria-live="polite"></p></form>`;
}

export function adminPage() {
  return `<section class="page-hero"><div class="container"><span class="kicker" style="color:#83c7ff">QUẢN TRỊ NỘI BỘ</span><h1>Quản lý giáo viên</h1><p>Thêm, chỉnh sửa và quản lý hồ sơ giáo viên hiển thị trên trang tìm kiếm.</p></div></section><main class="container section admin-page"><div class="admin-note"><b>Lưu ý:</b> Dữ liệu và ảnh tải lên được lưu trên trình duyệt hiện tại, chưa đồng bộ máy chủ.</div><div class="admin-layout">${teacherForm()}<section class="panel admin-list-panel"><div class="admin-list-heading"><div><h2>Danh sách giáo viên</h2><p id="admin-teacher-count"></p></div><button id="clear-admin-teachers" class="btn btn-light" type="button">Xóa dữ liệu cục bộ</button></div><div id="admin-teacher-list" class="admin-teacher-list"></div></section></div></main>`;
}

function renderTeacherList() {
  const list = document.querySelector('#admin-teacher-list');
  const count = document.querySelector('#admin-teacher-count');
  if (!list || !count) return;
  const defaultSlugs = new Set(teachers.map((teacher) => teacher.slug));
  const entries = getTeachers();
  count.textContent = `${entries.length} hồ sơ đang hiển thị`;
  list.innerHTML = entries.map((teacher) => `<article class="admin-teacher-row"><img src="${escapeHtml(teacher.img)}" alt="${escapeHtml(teacher.name)}"><div><h3>${escapeHtml(teacher.name)}</h3><p>${escapeHtml(teacher.area)} · ${escapeHtml(teacher.licenses)} · ${escapeHtml(teacher.exp)}</p><small>${defaultSlugs.has(teacher.slug) ? 'Dữ liệu mặc định' : 'Được thêm từ trang quản trị'}</small></div><div class="admin-row-actions"><button class="admin-edit" type="button" data-slug="${escapeHtml(teacher.slug)}">Chỉnh sửa</button>${teacher.isAdminEntry ? `<button class="admin-delete" type="button" data-slug="${escapeHtml(teacher.slug)}">Xóa</button>` : ''}</div></article>`).join('');
}

function setPreview(image, visible = Boolean(image)) {
  const preview = document.querySelector('#teacher-image-preview');
  const previewImage = preview?.querySelector('img');
  if (!preview || !previewImage) return;
  preview.hidden = !visible;
  if (visible) previewImage.src = image;
}

function resetForm(message = '') {
  const form = document.querySelector('#admin-teacher-form');
  if (!form) return;
  form.reset();
  form.elements.slug.value = '';
  form.elements.existingImage.value = '';
  document.querySelector('#admin-form-title').textContent = 'Thêm giáo viên';
  document.querySelector('#admin-form-description').textContent = 'Những trường có dấu * là bắt buộc.';
  document.querySelector('#admin-submit').textContent = 'Thêm giáo viên';
  document.querySelector('#cancel-edit').hidden = true;
  setPreview('', false);
  const feedback = document.querySelector('#admin-form-message');
  feedback.textContent = message;
  feedback.className = message ? 'admin-message success' : 'admin-message';
}

function startEdit(slug) {
  const teacher = getTeachers().find((entry) => entry.slug === slug);
  const form = document.querySelector('#admin-teacher-form');
  if (!teacher || !form) return;
  form.elements.slug.value = teacher.slug;
  form.elements.name.value = teacher.name;
  form.elements.area.value = teacher.area;
  form.elements.experience.value = String(teacher.exp).match(/\d+/)?.[0] || '';
  form.elements.price.value = String(teacher.price).replace(/\D/g, '');
  form.elements.center.value = teacher.center || '';
  form.elements.bio.value = teacher.bio || '';
  form.elements.existingImage.value = teacher.img || '';
  form.querySelectorAll('[name="licenses"]').forEach((input) => { input.checked = teacher.licenses.split(',').map((item) => item.trim()).includes(input.value); });
  document.querySelector('#admin-form-title').textContent = `Chỉnh sửa: ${teacher.name}`;
  document.querySelector('#admin-form-description').textContent = 'Điểm đánh giá và số lượt đánh giá được giữ nguyên khi cập nhật hồ sơ.';
  document.querySelector('#admin-submit').textContent = 'Lưu thay đổi';
  document.querySelector('#cancel-edit').hidden = false;
  document.querySelector('#admin-form-message').textContent = '';
  setPreview(teacher.img);
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || (file instanceof File && file.size === 0 && !file.type)) return resolve('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return reject(new Error('Vui lòng chọn ảnh JPG, PNG hoặc WebP.'));
    if (file.size > MAX_IMAGE_SIZE) return reject(new Error('Ảnh vượt quá dung lượng 1,5 MB.'));
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh.'));
    reader.readAsDataURL(file);
  });
}

export function bindAdminPage() {
  const form = document.querySelector('#admin-teacher-form');
  const message = document.querySelector('#admin-form-message');
  renderTeacherList();

  form?.querySelector('[name="imageFile"]')?.addEventListener('change', async (event) => {
    try {
      const image = await readImage(event.target.files[0]);
      setPreview(image, Boolean(image));
      message.textContent = '';
    } catch (error) {
      event.target.value = '';
      message.textContent = error.message;
      message.className = 'admin-message error';
    }
  });

  document.querySelector('#remove-selected-image')?.addEventListener('click', () => {
    form.elements.imageFile.value = '';
    form.elements.existingImage.value = '';
    setPreview('', false);
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const licenses = data.getAll('licenses');
    if (!licenses.length) { message.textContent = 'Vui lòng chọn ít nhất một hạng bằng.'; message.className = 'admin-message error'; return; }
    const name = data.get('name').trim();
    const existingSlug = data.get('slug');
    const baseSlug = slugify(name) || 'giao-vien';
    const usedSlugs = new Set(getTeachers().map((teacher) => teacher.slug).filter((slug) => slug !== existingSlug));
    let slug = existingSlug || baseSlug;
    let suffix = 2;
    while (usedSlugs.has(slug)) slug = `${baseSlug}-${suffix++}`;
    try {
      const uploadedImage = await readImage(data.get('imageFile'));
      const previous = existingSlug ? getTeachers().find((teacher) => teacher.slug === existingSlug) : null;
      const teacher = { slug, name, area: data.get('area'), licenses: licenses.join(', '), exp: `${data.get('experience')} năm kinh nghiệm`, price: `${Number(data.get('price')).toLocaleString('vi-VN')}đ / buổi`, rating: previous?.rating || '5.0', reviews: previous?.reviews || 0, img: uploadedImage || data.get('existingImage') || fallbackImage, center: data.get('center').trim() || 'Độc lập', bio: data.get('bio').trim() || 'Giáo viên mới trên nền tảng DriNet.' };
      if (existingSlug) updateTeacher(teacher); else addTeacher(teacher);
      resetForm(existingSlug ? `Đã cập nhật hồ sơ của ${name}.` : `Đã thêm hồ sơ của ${name}.`);
      renderTeacherList();
    } catch (error) {
      message.textContent = error.message || 'Không thể lưu hồ sơ. Vui lòng thử lại.';
      message.className = 'admin-message error';
    }
  });

  document.querySelector('#cancel-edit')?.addEventListener('click', () => resetForm());
  document.querySelector('#admin-teacher-list')?.addEventListener('click', (event) => {
    const editButton = event.target.closest('.admin-edit');
    if (editButton) { startEdit(editButton.dataset.slug); return; }
    const deleteButton = event.target.closest('.admin-delete');
    if (!deleteButton || !confirm('Xóa hồ sơ giáo viên này?')) return;
    removeAdminTeacher(deleteButton.dataset.slug);
    resetForm();
    renderTeacherList();
  });
  document.querySelector('#clear-admin-teachers')?.addEventListener('click', () => {
    if (!confirm('Xóa toàn bộ dữ liệu giáo viên đã thêm hoặc chỉnh sửa cục bộ?')) return;
    clearAdminTeachers();
    resetForm('Đã xóa dữ liệu cục bộ và khôi phục dữ liệu mặc định.');
    renderTeacherList();
  });
}