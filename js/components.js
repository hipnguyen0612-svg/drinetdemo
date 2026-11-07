import { getCurrentUser } from './auth.js';
import { supabase } from './supabase.js';
import { escapeHtml } from './utils.js';

export function openTeacherSupportModal(defaultCategory = '') {
  const modal = document.querySelector('#teacher-support-modal');
  if (!modal) return;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  if (defaultCategory) {
    const select = modal.querySelector('select[name="issueType"]');
    if (select) select.value = defaultCategory;
  }
  const textarea = modal.querySelector('textarea[name="content"]');
  if (textarea) textarea.focus();
}

export function closeTeacherSupportModal() {
  const modal = document.querySelector('#teacher-support-modal');
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = '';
}

function renderTeacherSupportModal(user) {
  return `<div id="teacher-support-modal" class="modal-backdrop" hidden><div class="modal-dialog"><div class="modal-header"><div><h3>🛠️ Hỗ trợ sự cố & Báo cáo Admin</h3><p class="modal-subtitle">Gửi yêu cầu trực tiếp đến Quản trị viên hệ thống DriNet</p></div><button class="modal-close-btn" id="btn-close-support-modal" type="button" aria-label="Đóng">&times;</button></div><form id="teacher-support-form" class="teacher-support-form"><div class="support-teacher-badge"><b>👨‍🏫 Giáo viên: ${escapeHtml(user?.name || '')}</b> (${escapeHtml(user?.email || '')})<div style="font-size:12px;color:var(--muted);margin-top:2px">Quản trị viên sẽ nhận được thông báo ngay và ưu tiên liên hệ xử lý cho thầy/cô.</div></div><div class="form-grid"><div><label>Loại sự cố / Vấn đề *</label><select name="issueType" required><option value="Sự cố tài khoản / Không cập nhật được hồ sơ">Sự cố tài khoản / Hồ sơ giảng dạy</option><option value="Sự cố liên hệ học viên / Học viên sai thông tin">Sự cố liên hệ học viên / Sai thông tin</option><option value="Lỗi kỹ thuật website / Hiển thị sai">Lỗi kỹ thuật website / Hiển thị sai</option><option value="Thắc mắc về quy định / Học phí / Trung tâm">Thắc mắc quy định / Học phí</option><option value="Khác (Cần hỗ trợ khẩn cấp)">Khác (Cần hỗ trợ khẩn cấp)</option></select></div><div><label>Mức độ ưu tiên *</label><select name="priority" required><option value="Bình thường">Bình thường</option><option value="Cần gấp trong ngày">Cần gấp trong ngày</option><option value="Khẩn cấp">Khẩn cấp</option></select></div><div class="full"><label>Số điện thoại hoặc Zalo liên hệ lại *</label><input name="contactPhone" required type="tel" value="${escapeHtml(user?.phone || '')}" placeholder="09xxxxxxxx"></div><div class="full"><label>Mô tả chi tiết sự cố / Yêu cầu gửi Admin *</label><textarea name="content" required rows="4" placeholder="Mô tả cụ thể sự cố thầy/cô đang gặp phải để Quản trị viên hỗ trợ kịp thời..."></textarea></div><div class="full"><button class="btn btn-primary" style="width:100%" type="submit">Gửi báo cáo sự cố cho Admin &rarr;</button><p id="support-modal-message" class="admin-message" style="margin-top:10px" aria-live="polite"></p></div></div></form></div></div>`;
}

export function bindNavigationEvents() {
  document.querySelector('#btn-open-teacher-support')?.addEventListener('click', () => openTeacherSupportModal());
  document.querySelector('#mobile-btn-teacher-support')?.addEventListener('click', () => {
    document.querySelector('#links')?.classList.remove('open');
    openTeacherSupportModal();
  });
  document.querySelector('#btn-close-support-modal')?.addEventListener('click', () => closeTeacherSupportModal());

  const modal = document.querySelector('#teacher-support-modal');
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeTeacherSupportModal();
  });

  document.querySelector('#teacher-support-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleSupportSubmit(e.currentTarget);
  });
}

async function handleSupportSubmit(form) {
  const user = getCurrentUser();
  const submitBtn = form.querySelector('button[type="submit"]');
  const msg = document.querySelector('#support-modal-message');
  const formData = new FormData(form);

  const issueType = String(formData.get('issueType') || '').trim();
  const priority = String(formData.get('priority') || 'Bình thường').trim();
  const contactPhone = String(formData.get('contactPhone') || '').trim();
  const content = String(formData.get('content') || '').trim();

  if (!content) {
    if (msg) {
      msg.textContent = 'Vui lòng mô tả chi tiết sự cố bạn đang gặp phải.';
      msg.className = 'admin-message error';
    }
    return;
  }

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang gửi cho Ban Quản trị…';
    }

    const payload = {
      full_name: `[Giáo viên] ${user?.name || 'Giáo viên DriNet'}`,
      contact_info: `${contactPhone || 'Chưa có SĐT'} · Email: ${user?.email || 'N/A'} (Ưu tiên: ${priority})`,
      content: `[BÁO CÁO SỰ CỐ - GIÁO VIÊN]\nLoại sự cố: ${issueType}\nMức độ: ${priority}\nGiáo viên: ${user?.name || ''} (${user?.email || ''})\nSĐT/Zalo liên hệ: ${contactPhone || 'N/A'}\n\nNội dung chi tiết:\n${content}`,
      status: 'new',
    };

    const { error } = await supabase.from('contact_messages').insert(payload);
    if (error) throw error;

    if (msg) {
      msg.textContent = '✓ Đã gửi báo cáo sự cố thành công! Ban Quản trị DriNet đã nhận được và sẽ ưu tiên hỗ trợ bạn sớm nhất.';
      msg.className = 'admin-message success';
    }
    form.reset();

    setTimeout(() => {
      closeTeacherSupportModal();
      if (msg) {
        msg.textContent = '';
        msg.className = 'admin-message';
      }
    }, 2000);
  } catch (err) {
    console.error('Lỗi khi gửi báo cáo sự cố:', err);
    if (msg) {
      msg.textContent = err.message || 'Không thể gửi báo cáo. Vui lòng thử lại hoặc gọi hotline 08 66 78 88 99.';
      msg.className = 'admin-message error';
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Gửi báo cáo sự cố cho Admin →';
    }
  }
}

export function nav() {
  const user = getCurrentUser();
  const isTeacher = user?.role === 'teacher';
  const isAdmin = user?.role === 'admin';

  const accountAction = user
    ? `<a class="btn btn-light account-button" href="#/ho-so" aria-label="Mở hồ sơ tài khoản" title="${escapeHtml(user.name)}"><span>${escapeHtml(user.name)}</span><small>${escapeHtml(user.roleLabel)}</small></a>`
    : '<a class="btn btn-light" href="#/dang-nhap">Đăng nhập</a>';

  const accountLink = user
    ? `<a class="mobile-account-link" href="#/ho-so">${isTeacher ? 'Trang giáo viên' : 'Hồ sơ tài khoản'}</a>`
    : '';
  const adminLink = isAdmin ? '<a class="admin-nav-link" href="#/admin">Quản trị</a>' : '';
  const teacherJoinMobile = (isTeacher || isAdmin) ? '' : '<a class="mobile-teacher-join" href="#/dang-ky-giao-vien">Tham gia DriNet</a>';
  const teacherJoinDesktop = (isTeacher || isAdmin) ? '' : '<a class="btn btn-light teacher-join" href="#/dang-ky-giao-vien">Tham gia DriNet</a>';

  const teacherSupportMobile = isTeacher
    ? '<a class="mobile-teacher-support" href="javascript:void(0)" id="mobile-btn-teacher-support">🛠️ Hỗ trợ sự cố</a>'
    : '';

  let primaryAction = '<a class="btn btn-primary" href="#/dang-ky-hoc">Đăng ký tư vấn</a>';
  if (isTeacher) {
    primaryAction = '<button class="btn btn-primary teacher-support-btn" id="btn-open-teacher-support" type="button" title="Gửi báo cáo sự cố trực tiếp cho Ban Quản trị">🛠️ Hỗ trợ sự cố</button>';
  } else if (isAdmin) {
    primaryAction = '<a class="btn btn-primary" href="#/admin">Quản trị</a>';
  }

  const supportModalHtml = isTeacher ? renderTeacherSupportModal(user) : '';

  return `<div class="topbar"><div class="container"><span>📍 Nền tảng kết nối giáo viên dạy lái tại Gia Lai</span><span>Hỗ trợ: 08 66 78 88 99</span></div></div><nav class="nav container"><a class="brand" href="#/"><span class="brand-mark">D</span><span>DriNet<small>Driving Network</small></span></a><div class="links" id="links"><a href="#/giao-vien">Tìm giáo viên</a><a href="#/danh-gia">Đánh giá</a><a href="#/ve-chung-toi">Về DriNet</a><a href="#/lien-he">Liên hệ</a>${accountLink}${teacherJoinMobile}${teacherSupportMobile}${adminLink}</div><div class="nav-actions">${accountAction}${teacherJoinDesktop}${primaryAction}</div><button class="menu" onclick="document.querySelector('#links').classList.toggle('open')">☰</button></nav>${supportModalHtml}`;
}
export function footer(){return `<a class="quick" href="#/lien-he">💬 Liên hệ nhanh</a><footer class="footer"><div class="container footer-grid"><div><a class="brand" href="#/"><span class="brand-mark">D</span><span>DriNet<small>Driving Network</small></span></a><p>Kết nối đúng người dạy – Vững tay lái trên mọi hành trình.</p><p>DriNet là nền tảng kết nối, không trực tiếp tổ chức đào tạo lái xe.</p></div><div><h4>Khám phá</h4><div class="footer-links"><a href="#/giao-vien">Tìm giáo viên</a><a href="#/dang-ky-hoc">Đăng ký tư vấn</a><a href="#/dang-ky-giao-vien">Tham gia DriNet</a><a href="#/danh-gia">Gửi đánh giá</a></div></div><div><h4>Thông tin</h4><div class="footer-links"><a href="#/ve-chung-toi">Về DriNet</a><a href="#/lien-he">Liên hệ</a><a href="#/dieu-khoan">Điều khoản & bảo mật</a></div></div></div><div class="container copyright">© 2026 DriNet. Hồ sơ giáo viên đã duyệt được đồng bộ từ hệ thống DriNet.</div></footer>`}
export function teacherCard(t){return `<article class="teacher-card"><img src="${escapeHtml(t.img)}" alt="${escapeHtml(t.name)}" loading="lazy"><div class="teacher-info"><span class="tag">&#10003; Đã xác minh</span><div class="teacher-title"><h3>${escapeHtml(t.name)}</h3><span class="rating">&#9733; ${escapeHtml(t.rating)} (${escapeHtml(t.reviews)})</span></div><p>${escapeHtml(t.exp)} · ${escapeHtml(t.area)}</p><div class="teacher-meta"><span class="chip">${escapeHtml(t.licenses)}</span><span class="chip">&#128205; ${escapeHtml(t.area)}</span></div><div class="price">${escapeHtml(t.price)} <small>tham khảo</small></div><a class="btn btn-light" style="width:100%" href="#/giao-vien/${encodeURIComponent(t.slug)}">Xem hồ sơ &rarr;</a></div></article>`}
