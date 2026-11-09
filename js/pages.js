import { getTeachers } from './data.js';
import { teacherCard } from './components.js';
import { getCurrentUser } from './auth.js';
import { escapeHtml, slugify } from './utils.js';
import { showAlert, showToast } from './dialog.js';
import { supabase } from './supabase.js';

export function bindTeacherFilters() {
  const areaFilter = document.querySelector('#filter-area');
  const licenseFilter = document.querySelector('#filter-license');
  const reviewFilter = document.querySelector('#filter-review');
  const applyButton = document.querySelector('#apply-teacher-filters');
  const resultsCount = document.querySelector('#teacher-results-count');
  const resultsGrid = document.querySelector('#teacher-results');
  const availTabs = document.querySelectorAll('#teacher-avail-tabs .avail-tab');

  if (!areaFilter || !licenseFilter || !reviewFilter || !resultsCount || !resultsGrid) return;

  let currentAvail = 'all';

  const applyFilters = () => {
    const all = getTeachers();
    const filteredTeachers = all.filter((teacher) => {
      const matchesArea = areaFilter.value === 'all' || teacher.area === areaFilter.value;
      const matchesLicense = licenseFilter.value === 'all' || (teacher.licenses || '').includes(licenseFilter.value);
      const matchesReviews = reviewFilter.value === 'all' || teacher.reviews > 0;
      const matchesAvail =
        currentAvail === 'all' ? true :
        currentAvail === 'active' ? (teacher.is_accepting_students !== false) :
        (teacher.is_accepting_students === false);
      return matchesArea && matchesLicense && matchesReviews && matchesAvail;
    });

    const sortedTeachers = [...filteredTeachers].sort((a, b) => {
      const aActive = a.is_accepting_students !== false ? 1 : 0;
      const bActive = b.is_accepting_students !== false ? 1 : 0;
      if (bActive !== aActive) return bActive - aActive;
      return Number(b.rating || 0) - Number(a.rating || 0);
    });

    const total = sortedTeachers.length;
    let desc = '';
    if (currentAvail === 'active') desc = ' đang sẵn sàng nhận học viên';
    else if (currentAvail === 'paused') desc = ' đang tạm ngừng nhận dạy';
    else desc = ' (Ưu tiên giáo viên sẵn sàng nhận học viên)';

    resultsCount.innerHTML = total
      ? 'Hiển thị <b>' + total + ' giáo viên' + desc + '</b> phù hợp'
      : 'Không tìm thấy giáo viên phù hợp với bộ lọc đã chọn.';
    resultsGrid.innerHTML = total
      ? sortedTeachers.map(teacherCard).join('')
      : '<div class="empty-results"><p style="margin:0 0 6px;font-weight:700;color:var(--navy)">Không tìm thấy giáo viên phù hợp</p><p style="margin:0;font-size:13.5px;color:var(--muted)">Hãy thử chuyển sang tab "Tất cả hồ sơ" hoặc chọn lại khu vực/hạng bằng.</p></div>';
  };

  availTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      availTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentAvail = tab.dataset.avail;
      applyFilters();
    });
  });

  applyButton?.addEventListener('click', applyFilters);
  [areaFilter, licenseFilter, reviewFilter].forEach((filter) => filter.addEventListener('change', applyFilters));
}

export function home() {
  const teachers = getTeachers();
  const activeCount = teachers.filter((t) => t.is_accepting_students !== false).length;
  const pausedCount = teachers.filter((t) => t.is_accepting_students === false).length;

  const sortedTeachers = [...teachers].sort((a, b) => {
    const aActive = a.is_accepting_students !== false ? 1 : 0;
    const bActive = b.is_accepting_students !== false ? 1 : 0;
    if (bActive !== aActive) return bActive - aActive;
    return Number(b.rating || 0) - Number(a.rating || 0);
  });
  const featuredTeachers = sortedTeachers.slice(0, 6);

  const teacherSectionHtml =
    '<section class="section container">' +
      '<div class="teacher-row" style="align-items:flex-end;margin-bottom:24px">' +
        '<div class="section-head" style="margin-bottom:0">' +
          '<span class="kicker">GIÁO VIÊN NỔI BẬT</span>' +
          '<h2>Đã xác minh, sẵn sàng đồng hành</h2>' +
          '<p style="color:var(--muted);font-size:14px;margin-top:6px">' +
            'Ưu tiên giáo viên đang sẵn sàng nhận học viên mới tại Gia Lai. ' +
            '<span style="display:inline-flex;align-items:center;gap:6px;margin-left:4px;font-weight:600">' +
              '<span style="color:#15803d;background:#dcfce7;padding:2px 8px;border-radius:12px;font-size:12px">🟢 ' + activeCount + ' đang nhận học viên</span>' +
              (pausedCount ? '<span style="color:#b91c1c;background:#fee2e2;padding:2px 8px;border-radius:12px;font-size:12px">🔴 ' + pausedCount + ' tạm ngừng nhận</span>' : '') +
            '</span>' +
          '</p>' +
        '</div>' +
        '<a class="btn btn-light" href="#/giao-vien" style="white-space:nowrap">Xem tất cả hồ sơ &rarr;</a>' +
      '</div>' +
      '<div class="teachers">' +
        (featuredTeachers.length
          ? featuredTeachers.map(teacherCard).join('')
          : '<p class="login-intro">Đang tải danh sách giáo viên…</p>') +
      '</div>' +
    '</section>' +
    '<section class="cta-band">' +
      '<div class="container">' +
        '<h2>Sẵn sàng bắt đầu hành trình học lái?</h2>' +
        '<p>Tìm người dạy phù hợp với lịch trình và nhu cầu của riêng bạn.</p>' +
        '<a class="btn btn-primary" href="#/giao-vien">Tìm giáo viên ngay &rarr;</a>' +
      '</div>' +
    '</section>';

  return '<section class="hero"><div class="container"><span class="eyebrow"><i></i> NỀN TẢNG KẾT NỐI TẠI GIA LAI</span><h1>Tìm giáo viên dạy lái minh bạch tại Gia Lai</h1><p>Xem hồ sơ, chọn giáo viên phù hợp và đọc đánh giá từ học viên trước khi chọn.</p><div class="actions"><a class="btn btn-primary" href="#/giao-vien">Tìm giáo viên</a><a class="btn btn-light" href="#/dang-ky-hoc">Đăng ký tư vấn miễn phí</a></div><div class="trustline"><span><b>100%</b>Hồ sơ được kiểm tra</span><span><b>Minh bạch</b>Thông tin giáo viên</span><span><b>An tâm</b>Đánh giá kiểm duyệt</span></div></div></section><section class="section container"><div class="section-head"><span class="kicker">VÌ SAO LÀ DRINET</span><h2>Chủ động chọn người đồng hành trên hành trình học lái</h2><p>Thông tin rõ ràng hơn để bạn đưa ra lựa chọn phù hợp hơn.</p></div><div class="grid3"><div class="benefit"><div class="icon">&#128203;</div><h3>Minh bạch thông tin</h3><p>Tìm hiểu kinh nghiệm, hạng bằng và phong cách dạy trước khi lựa chọn.</p></div><div class="benefit"><div class="icon">&#10003;</div><h3>Hồ sơ được kiểm tra</h3><p>Thông tin giáo viên được xác minh trước khi hiển thị trên nền tảng.</p></div><div class="benefit"><div class="icon">&#9733;</div><h3>Đánh giá từ học viên thật</h3><p>Chỉ hiển thị đánh giá đã được kiểm duyệt và đối chiếu.</p></div></div></section><section class="section process"><div class="container"><div class="section-head"><span class="kicker">CÁCH DRINET HOẠT ĐỘNG</span><h2>Đơn giản để bắt đầu, rõ ràng trong từng bước</h2></div><div class="steps"><div class="step"><span class="step-no">01</span><h3>Tìm kiếm</h3><p>Lọc theo khu vực, hạng bằng và đánh giá.</p></div><div class="step"><span class="step-no">02</span><h3>Xem hồ sơ</h3><p>Khám phá kinh nghiệm, chuyên môn, lịch trống.</p></div><div class="step"><span class="step-no">03</span><h3>Đăng ký tư vấn</h3><p>Gửi nhu cầu học chỉ trong vài phút.</p></div><div class="step"><span class="step-no">04</span><h3>Kết nối phù hợp</h3><p>DriNet hỗ trợ kết nối đúng giáo viên, sẵn sàng đồng hành.</p></div></div></div></section>' + teacherSectionHtml;
}

export function teacherList() {
  const teachers = getTeachers();
  const areas = [...new Set(teachers.map((t) => t.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
  const allLicenses = [...new Set(teachers.flatMap((t) => (t.licenses || '').split(',').map((item) => item.trim())).filter(Boolean))].sort();

  const activeCount = teachers.filter((t) => t.is_accepting_students !== false).length;
  const pausedCount = teachers.filter((t) => t.is_accepting_students === false).length;
  const totalCount = teachers.length;

  const sortedTeachers = [...teachers].sort((a, b) => {
    const aActive = a.is_accepting_students !== false ? 1 : 0;
    const bActive = b.is_accepting_students !== false ? 1 : 0;
    if (bActive !== aActive) return bActive - aActive;
    return Number(b.rating || 0) - Number(a.rating || 0);
  });
  const initialList = sortedTeachers;

  return '<section class="page-hero"><div class="container"><span class="kicker" style="color:#83c7ff">KHÁM PHÁ GIÁO VIÊN</span><h1>Tìm người dạy phù hợp với bạn</h1><p>Lọc và so sánh các giáo viên đã được DriNet xác minh tại Gia Lai.</p></div></section><main class="container section">' +
    '<div class="availability-tabs" id="teacher-avail-tabs">' +
      '<button type="button" class="avail-tab active" data-avail="all">Tất cả hồ sơ (' + totalCount + ')</button>' +
      '<button type="button" class="avail-tab" data-avail="active">🟢 Đang nhận học viên (' + activeCount + ')</button>' +
      '<button type="button" class="avail-tab" data-avail="paused">🔴 Tạm ngừng nhận (' + pausedCount + ')</button>' +
    '</div>' +
    '<div class="filters">' +
      '<div class="filter-group"><label>Khu vực</label><select id="filter-area"><option value="all">Tất cả khu vực</option>' + areas.map((area) => '<option value="' + escapeHtml(area) + '">' + escapeHtml(area) + '</option>').join('') + '</select></div>' +
      '<div class="filter-group"><label>Hạng bằng</label><select id="filter-license"><option value="all">Tất cả hạng bằng</option>' + allLicenses.map((lic) => '<option value="' + escapeHtml(lic) + '">' + escapeHtml(lic) + '</option>').join('') + '</select></div>' +
      '<div class="filter-group"><label>Đánh giá</label><select id="filter-review"><option value="all">Tất cả hồ sơ</option><option value="has-reviews">Có đánh giá</option></select></div>' +
      '<button id="apply-teacher-filters" class="btn btn-primary" type="button">Lọc kết quả</button>' +
    '</div>' +
    '<div class="notice">&#8505; DriNet ưu tiên hiển thị các giáo viên <b>sẵn sàng nhận học viên mới</b> để bạn trao đổi và sắp xếp lịch học nhanh nhất.</div>' +
    '<div class="teacher-row"><p id="teacher-results-count" style="font-size:14px;color:var(--muted)">Hiển thị <b>' + initialList.length + ' giáo viên (Ưu tiên giáo viên sẵn sàng nhận học viên)</b></p></div>' +
    '<div id="teacher-results" class="teachers">' + (initialList.length ? initialList.map(teacherCard).join('') : '<div class="empty-results">Chưa có giáo viên nào.</div>') + '</div></main>';
}

export function profile(t) {
  if (!t) {
    return '<main class="container section"><div class="panel" style="padding:32px;text-align:center"><h2>Không tìm thấy giáo viên</h2><p style="color:var(--muted);margin:8px 0 20px">Hồ sơ này không tồn tại hoặc chưa được phê duyệt.</p><a class="btn btn-primary" href="#/giao-vien">&larr; Quay lại danh sách giáo viên</a></div></main>';
  }

  const isPaused = !t.is_accepting_students;
  const statusTag = isPaused
    ? '<span class="tag tag-paused">🔴 Tạm ngừng nhận dạy</span>'
    : '<span class="tag tag-active">🟢 Đang sẵn sàng nhận học viên</span>';

  const pausedAlertHtml = isPaused ? `
    <div class="alert-paused" style="border-left:4px solid #ef4444;background:#fef2f2">
      <span style="font-size:26px">⏸️</span>
      <div>
        <b style="font-size:15.5px;color:#991b1b">Giáo viên hiện đang TẠM NGỪNG nhận học viên mới:</b>
        <p style="margin:4px 0 0;font-size:13.5px;color:#7f1d1d;line-height:1.5">
          Thầy/cô <b>${escapeHtml(t.name)}</b> hiện đang tập trung đào tạo học viên khóa hiện tại hoặc tạm nghỉ${t.pause_reason ? ` (Lý do: <i>${escapeHtml(t.pause_reason)}</i>)` : ''}.
          <br>DriNet tạm đóng chức năng nhận tư vấn trực tiếp với thầy/cô. Bạn có thể nhờ Ban Quản trị DriNet chọn giáo viên khác tại <b>${escapeHtml(t.area)}</b> hoặc tham khảo gợi ý giáo viên sẵn sàng bên dưới.
        </p>
      </div>
    </div>
  ` : '';

  const ctaBtnHtml = isPaused
    ? `<div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap;align-items:center">
         <button class="btn btn-light" disabled style="opacity:0.65;cursor:not-allowed;background:#f1f5f9;border-color:#cbd5e1;color:#64748b">🔴 Tạm ngừng nhận học viên</button>
         <a class="btn btn-primary" href="#/dang-ky-hoc?area=${encodeURIComponent(t.area)}">⚡ Nhờ DriNet chọn giáo viên khác tại ${escapeHtml(t.area)} &rarr;</a>
       </div>`
    : `<a class="btn btn-primary" href="#/dang-ky-hoc?teacher=${encodeURIComponent(t.slug)}" style="margin-top:18px">Yêu cầu tư vấn với giáo viên này &rarr;</a>`;

  const scheduleHtml = isPaused
    ? `<div class="panel">
         <h3>Lịch giảng dạy</h3>
         <div style="padding:24px 16px;text-align:center;background:#f8fafc;border-radius:10px;border:1px dashed #cbd5e1">
           <div style="font-size:28px;margin-bottom:8px">⏸️</div>
           <b style="color:var(--navy);display:block;margin-bottom:4px">Đang tạm ngưng nhận lịch học mới</b>
           <p style="margin:0;font-size:13px;color:var(--muted);line-height:1.5">
             Thầy/cô đang tạm ngưng xếp lịch cho học viên mới${t.pause_reason ? ` (${escapeHtml(t.pause_reason)})` : ''}. Lịch thực hành sẽ được mở lại sau khi kết thúc đợt học hiện tại.
           </p>
         </div>
       </div>`
    : `<div class="panel">
         <h3>Lịch trống trong tuần</h3>
         <div class="schedule">
           <span class="slot">T2 · Sáng</span>
           <span class="slot">T3 · Chiều</span>
           <span class="slot">T5 · Sáng</span>
           <span class="slot">T7 · Cả ngày</span>
         </div>
       </div>`;

  const allTeachers = getTeachers();
  const recommendedTeachers = isPaused
    ? allTeachers.filter((other) => other.id !== t.id && other.is_accepting_students !== false && other.area === t.area).slice(0, 3)
    : [];

  const recommendationsHtml = recommendedTeachers.length ? `
    <div class="panel" style="margin-top:24px;background:#f0fdf4;border:1px solid #bbf7d0">
      <h3 style="color:#166534;margin:0 0 12px;font-size:15.5px">💡 Gợi ý giáo viên sẵn sàng nhận học viên tại ${escapeHtml(t.area)}:</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:12px">
        ${recommendedTeachers.map((rec) => `
          <div style="background:#fff;border:1px solid #dcfce7;border-radius:10px;padding:12px;display:flex;align-items:center;gap:12px">
            <img src="${escapeHtml(rec.img)}" alt="${escapeHtml(rec.name)}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid #86efac">
            <div style="flex:1;min-width:0">
              <b style="color:var(--navy);font-size:14px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(rec.name)}</b>
              <span style="font-size:12px;color:var(--muted)">★ ${rec.rating} · ${escapeHtml(rec.licenses)}</span>
            </div>
            <a class="btn btn-primary btn-sm" href="#/dang-ky-hoc?teacher=${encodeURIComponent(rec.slug)}" style="padding:6px 10px;font-size:12px">Đăng ký &rarr;</a>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  return '<section class="page-hero"><div class="container"><a href="#/giao-vien" style="font-size:13px;color:#b9dcff">&larr; Quay lại danh sách giáo viên</a><h1>Hồ sơ giáo viên</h1></div></section><main class="container section">' +
    pausedAlertHtml +
    '<div class="profile"><aside class="profile-image"><img src="' + escapeHtml(t.img) + '" alt="' + escapeHtml(t.name) + '"></aside><div>' +
    statusTag +
    '<h1>' + escapeHtml(t.name) + '</h1><p style="color:var(--muted)">' + escapeHtml(t.bio) + '</p><div class="info-grid"><div class="info-item"><b>Kinh nghiệm</b>' + escapeHtml(t.exp) + '</div><div class="info-item"><b>Hạng giảng dạy</b>' + escapeHtml(t.licenses) + '</div><div class="info-item"><b>Khu vực hoạt động</b>' + escapeHtml(t.area) + '</div><div class="info-item"><b>Trung tâm liên kết</b>' + escapeHtml(t.center) + '</div></div>' +
    ctaBtnHtml +
    '</div></div>' +
    recommendationsHtml +
    '<div class="grid3" style="margin-top:40px;grid-template-columns:1fr 1fr">' +
    scheduleHtml +
    '<div class="panel"><h3>Đánh giá học viên <span class="rating">&#9733; ' + escapeHtml(t.rating) + ' · ' + escapeHtml(t.reviews) + ' lượt đánh giá</span></h3><div id="teacher-profile-reviews" class="reviews" data-teacher-id="' + escapeHtml(t.id) + '"><div class="drinet-loading-state" style="padding:20px;min-height:100px"><div class="drinet-spinner" style="width:28px;height:28px"></div><p class="drinet-loading-text">Đang tải đánh giá…</p></div></div></div></div></main>';
}

export async function bindTeacherProfile(teacher) {
  if (!teacher?.id) return;
  const container = document.querySelector('#teacher-profile-reviews');
  if (!container) return;
  try {
    const { data, error } = await supabase.from('reviews').select('student_name, rating, comment, created_at').eq('teacher_id', teacher.id).eq('status', 'approved').order('created_at', { ascending: false });
    if (error) throw error;
    if (data && data.length) {
      container.innerHTML = data.map((rev) => '<div class="review"><b>' + escapeHtml(rev.student_name) + ' · ' + '★'.repeat(rev.rating) + '☆'.repeat(5 - rev.rating) + '</b><p>' + escapeHtml(rev.comment) + '</p></div>').join('');
    } else {
      container.innerHTML = '<p style="color:var(--muted);font-size:14px">Đánh giá chung: <b>' + escapeHtml(teacher.rating) + ' / 5.0</b> (' + escapeHtml(teacher.reviews) + ' lượt đánh giá hoàn thành). Chưa có nhận xét chi tiết nào được công bố.</p>';
    }
  } catch {
    container.innerHTML = '<p style="color:var(--muted);font-size:14px">Đánh giá chung: <b>' + escapeHtml(teacher.rating) + ' / 5.0</b> (' + escapeHtml(teacher.reviews) + ' lượt đánh giá hoàn thành).</p>';
  }
}

function studentRegistrationPage() {
  const currentUser = getCurrentUser();
  const queryTeacher = new URLSearchParams(location.hash.split('?')[1] || '').get('teacher') || '';
  const queryArea = new URLSearchParams(location.hash.split('?')[1] || '').get('area') || '';
  const teachers = getTeachers();
  const areas = [...new Set(teachers.map((teacher) => teacher.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));

  const matchedTeacher = teachers.find((teacher) => teacher.slug === queryTeacher || teacher.name === queryTeacher);
  const isRequestedTeacherPaused = Boolean(matchedTeacher && !matchedTeacher.is_accepting_students);

  // If matched teacher is paused, DO NOT select them in form!
  const selectedTeacher = (matchedTeacher && matchedTeacher.is_accepting_students) ? matchedTeacher : null;
  const selectedArea = queryArea || selectedTeacher?.area || (isRequestedTeacherPaused ? matchedTeacher.area : '');

  const pausedWarningHtml = isRequestedTeacherPaused ? `
    <div class="form-paused-teacher-warning">
      <span style="font-size:24px">⚠️</span>
      <div>
        <b style="font-size:15px;color:#991b1b">Thông báo: Thầy/cô ${escapeHtml(matchedTeacher.name)} hiện đang tạm ngừng nhận học viên mới!</b>
        <p style="margin:4px 0 0;font-size:13px;color:#7f1d1d;line-height:1.5">
          Thầy/cô hiện đã đủ học viên hoặc đang tạm nghỉ${matchedTeacher.pause_reason ? ` (Lý do: <i>${escapeHtml(matchedTeacher.pause_reason)}</i>)` : ''}.
          <br>DriNet đã <b>tự động chuyển sang hình thức "Nhờ DriNet tư vấn & chọn giáo viên phù hợp"</b> để Ban Quản trị kết nối giáo viên tương đương tại khu vực <b>${escapeHtml(matchedTeacher.area)}</b> cho bạn.
        </p>
      </div>
    </div>
  ` : '';

  const teacherOptions = (area) => {
    const list = teachers.filter((teacher) => !area || teacher.area === area);
    const activeList = list.filter((t) => t.is_accepting_students !== false);
    const pausedList = list.filter((t) => t.is_accepting_students === false);

    let html = '<option value="consultation"' + (!selectedTeacher ? ' selected' : '') + '>🎯 Nhờ DriNet tư vấn & điều phối giáo viên phù hợp nhất</option>';

    if (activeList.length) {
      html += '<optgroup label="🟢 Giáo viên sẵn sàng nhận học viên">';
      html += activeList.map((t) => {
        const isSelected = selectedTeacher?.slug === t.slug;
        return '<option value="' + escapeHtml(t.slug) + '"' + (isSelected ? ' selected' : '') + '>' + escapeHtml(t.name) + ' · ' + escapeHtml(t.area) + ' (' + escapeHtml(t.licenses) + ')</option>';
      }).join('');
      html += '</optgroup>';
    }

    if (pausedList.length) {
      html += '<optgroup label="🔴 Tạm ngừng nhận học viên (Không khả dụng)">';
      html += pausedList.map((t) => {
        return '<option value="' + escapeHtml(t.slug) + '" disabled style="color:#94a3b8">[Tạm ngừng nhận] ' + escapeHtml(t.name) + ' · ' + escapeHtml(t.area) + (t.pause_reason ? ' (' + escapeHtml(t.pause_reason) + ')' : '') + '</option>';
      }).join('');
      html += '</optgroup>';
    }

    return html;
  };

  return '<section class="page-hero"><div class="container"><span class="kicker" style="color:#83c7ff">BẮT ĐẦU CÙNG DRINET</span><h1>Đăng ký tư vấn học lái</h1><p>Chỉ mất vài phút để DriNet hiểu nhu cầu và hỗ trợ bạn.</p></div></section><main class="container section"><form id="student-reg-form" class="panel form-card"><h3>Đăng ký tư vấn học lái</h3><div class="notice">&#128274; <b>Quy trình đào tạo minh bạch:</b> Chọn giáo viên &rarr; Chốt hồ sơ &rarr; Nộp 3.000.000đ cọc &rarr; Trao đổi lịch học với giáo viên &rarr; Bắt đầu buổi 1 và theo dõi nhật ký từng buổi dạy trên hệ thống.<br><span style="font-size:12.5px;color:#1e40af;margin-top:4px;display:inline-block">🎁 Hệ thống sẽ tự động cấp tài khoản học viên để bạn theo dõi tiến trình và nhật ký đào tạo.</span></div>' +
    pausedWarningHtml +
    '<div class="form-grid"><div><label>Họ và tên *</label><input name="name" required autocomplete="name" placeholder="Nguyễn Văn A" value="' + escapeHtml(currentUser?.name) + '"></div><div><label>Số điện thoại hoặc Zalo *</label><input name="phone" type="tel" required autocomplete="tel" placeholder="09xxxxxxxx" value="' + escapeHtml(currentUser?.phone) + '"></div><div><label>Email (Nhận tài khoản học viên) *</label><input name="email" type="email" required autocomplete="email" placeholder="hocvien@gmail.com" value="' + escapeHtml(currentUser?.email) + '"></div><div><label>Hạng bằng muốn học *</label><select name="licenseGoal" required><option value="">Chọn hạng bằng</option><option value="Hạng B">Hạng B</option><option value="Hạng C1">Hạng C1</option><option value="Khác">Khác</option></select></div><div><label>Đã có giấy phép học viên? *</label><select name="hasLearnerPermit" required><option value="">Chọn thông tin</option><option value="true">Có</option><option value="false">Chưa</option></select></div><div><label for="registration-area">Khu vực thuận tiện *</label><select id="registration-area" name="area" required><option value="">Chọn khu vực</option>' + areas.map((area) => '<option value="' + escapeHtml(area) + '"' + (area === selectedArea ? ' selected' : '') + '>' + escapeHtml(area) + '</option>').join('') + '</select></div><div><label>Khung giờ học ưa thích</label><select name="preferredTime"><option value="Sáng">Sáng</option><option value="Chiều">Chiều</option><option value="Tối">Tối</option><option value="Cuối tuần">Cuối tuần</option><option value="Linh hoạt">Linh hoạt</option></select></div><div class="full"><label for="registration-teacher">Nguyện vọng giáo viên</label><select id="registration-teacher" name="teacher">' + teacherOptions(selectedArea) + '</select><div id="registration-teacher-hint" class="field-hint" style="font-size:13px;color:var(--muted);margin-top:6px"></div></div><div class="full"><label>Ghi chú thêm về nhu cầu</label><textarea name="notes" rows="3" placeholder="Ví dụ: Chỉ rảnh cuối tuần, cần giáo viên kiên nhẫn, muốn học nhanh…"></textarea></div><div class="full check"><input id="terms-student" type="checkbox" required><label for="terms-student">Tôi đồng ý với <a href="#/dieu-khoan">Điều khoản sử dụng</a> và cho phép liên hệ tư vấn.</label></div></div><button class="btn btn-primary" type="submit">Gửi yêu cầu tư vấn &rarr;</button><div class="form-success" aria-live="polite"></div></form></main>';
}

export function bindStudentRegistration() {
  const form = document.querySelector('#student-reg-form');
  if (!form) return;
  const areaSelect = form.querySelector('#registration-area');
  const teacherSelect = form.querySelector('#registration-teacher');
  if (!areaSelect || !teacherSelect) return;
  const teachers = getTeachers();

  const renderTeacherOptions = () => {
    const selected = teacherSelect.value;
    const matched = teachers.filter((teacher) => !areaSelect.value || teacher.area === areaSelect.value);
    const activeMatched = matched.filter((t) => t.is_accepting_students !== false);
    const pausedMatched = matched.filter((t) => t.is_accepting_students === false);

    let html = '<option value="consultation">🎯 Nhờ DriNet tư vấn & điều phối giáo viên phù hợp nhất</option>';

    if (activeMatched.length) {
      html += '<optgroup label="🟢 Giáo viên sẵn sàng nhận học viên">';
      html += activeMatched.map((t) => {
        return '<option value="' + escapeHtml(t.slug) + '">' + escapeHtml(t.name) + ' · ' + escapeHtml(t.area) + ' (' + escapeHtml(t.licenses) + ')</option>';
      }).join('');
      html += '</optgroup>';
    }

    if (pausedMatched.length) {
      html += '<optgroup label="🔴 Tạm ngừng nhận học viên (Không khả dụng)">';
      html += pausedMatched.map((t) => {
        return '<option value="' + escapeHtml(t.slug) + '" disabled style="color:#94a3b8">[Tạm ngừng nhận] ' + escapeHtml(t.name) + ' · ' + escapeHtml(t.area) + (t.pause_reason ? ' (' + escapeHtml(t.pause_reason) + ')' : '') + '</option>';
      }).join('');
      html += '</optgroup>';
    }

    teacherSelect.innerHTML = html;
    if ([...teacherSelect.options].some((opt) => opt.value === selected && !opt.disabled)) {
      teacherSelect.value = selected;
    } else {
      teacherSelect.value = 'consultation';
    }
    updateTeacherHint();
  };

  const updateTeacherHint = () => {
    const hintEl = form.querySelector('#registration-teacher-hint');
    if (!hintEl) return;
    const teacherSlug = teacherSelect.value;
    if (!teacherSlug || teacherSlug === 'consultation') {
      hintEl.innerHTML = '🎯 <i>Hồ sơ sẽ được chuyển tới Ban Quản trị DriNet để tư vấn và kết nối giáo viên tốt nhất tại khu vực của bạn.</i>';
    } else {
      const t = teachers.find((teacher) => teacher.slug === teacherSlug);
      if (t && !t.is_accepting_students) {
        hintEl.innerHTML = '⚠️ <i>Thầy/cô <b>' + escapeHtml(t.name) + '</b> hiện đang <b>tạm ngừng nhận học viên mới</b>. Vui lòng chọn giáo viên khác hoặc chọn "Nhờ DriNet tư vấn" để DriNet hỗ trợ bạn.</i>';
      } else {
        hintEl.innerHTML = '⭐ <i>Yêu cầu sẽ được chuyển thẳng đến Dashboard của thầy/cô <b>' + escapeHtml(t?.name || 'giáo viên') + '</b> để chuẩn bị hồ sơ đào tạo.</i>';
      }
    }
  };
  areaSelect.addEventListener('change', renderTeacherOptions);
  teacherSelect.addEventListener('change', updateTeacherHint);
  updateTeacherHint();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = form.querySelector('.form-success');
    const submitBtn = form.querySelector('button[type="submit"]');
    const values = new FormData(form);
    const teacherSlug = values.get('teacher');
    let selectedTeacher = teacherSlug && teacherSlug !== 'consultation'
      ? teachers.find((teacher) => teacher.slug === teacherSlug)
      : null;

    // Strict check: if teacher is paused, prevent direct assignment
    if (selectedTeacher && !selectedTeacher.is_accepting_students) {
      showToast(`Thầy/cô ${selectedTeacher.name} hiện đang tạm ngừng nhận dạy. DriNet sẽ chuyển yêu cầu về Ban Quản trị để hỗ trợ bạn.`, 'warning');
      selectedTeacher = null;
    }

    let { data: { session } } = await supabase.auth.getSession();
    const fullName = String(values.get('name') || '').trim();
    const phone = String(values.get('phone') || '').trim();
    const email = String(values.get('email') || '').trim();
    const cleanPhone = phone.replace(/\D/g, '');
    const tempPassword = 'DriNet@' + (cleanPhone.slice(-4) || '2025');
    let isNewAccountCreated = false;

    // Nếu học viên chưa đăng nhập, tự động cấp tài khoản sẵn với mật khẩu tạm thời
    if (!session && email) {
      try {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password: tempPassword,
          options: {
            data: {
              full_name: fullName,
              phone: phone,
              role: 'student',
            },
          },
        });
        if (!signUpError && signUpData) {
          isNewAccountCreated = true;
          if (signUpData.session) session = signUpData.session;
        }
      } catch (authErr) {
        console.warn('Lưu ý cấp tài khoản:', authErr);
      }
    }

    const userNotes = String(values.get('notes') || '').trim();
    const queryTeacherParam = new URLSearchParams(location.hash.split('?')[1] || '').get('teacher') || '';
    const initTeacher = teachers.find((t) => t.slug === queryTeacherParam || t.name === queryTeacherParam);
    const pausedAuditNote = (initTeacher && !initTeacher.is_accepting_students)
      ? `[Lưu ý]: Học viên ban đầu quan tâm GV ${initTeacher.name} (${initTeacher.area}) hiện đang tạm ngừng nhận (${initTeacher.pause_reason || 'Đủ học viên'}).`
      : '';
    const combinedNotes = [pausedAuditNote, userNotes].filter(Boolean).join('\n') || null;

    const payload = {
      full_name: fullName,
      phone: phone,
      email: email || null,
      license_goal: String(values.get('licenseGoal') || '').trim(),
      has_learner_permit: values.get('hasLearnerPermit') === 'true',
      preferred_area: String(values.get('area') || '').trim(),
      preferred_time: String(values.get('preferredTime') || '').trim() || null,
      requested_teacher_id: selectedTeacher ? selectedTeacher.id : null,
      wants_consultation: !selectedTeacher,
      notes: combinedNotes,
      source: 'website',
      student_profile_id: session?.user?.id || null,
      deposit_status: 'unpaid',
      deposit_amount: 3000000,
      learning_status: 'awaiting_deposit',
      total_lessons_completed: 0,
    };

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang gửi…';
      const { error } = await supabase.from('student_requests').insert(payload);
      if (error) throw error;
      form.reset();
      if (selectedTeacher) {
        message.textContent = 'Đã gửi yêu cầu thành công! Thầy/cô ' + selectedTeacher.name + ' đã nhận được hồ sơ của bạn và sẽ chủ động gọi điện hoặc nhắn tin Zalo hỗ trợ bạn sớm nhất.';
      } else {
        message.textContent = 'Đã gửi yêu cầu thành công! Ban Quản trị DriNet đã nhận được yêu cầu và sẽ liên hệ tư vấn, điều phối giáo viên phù hợp nhất cho bạn.';
      }
      
      const teacherNote = selectedTeacher
        ? 'Thầy/cô <b>' + escapeHtml(selectedTeacher.name) + '</b> đã nhận được hồ sơ của bạn và sẽ chủ động gọi điện hoặc nhắn tin Zalo hỗ trợ bạn sớm nhất.'
        : 'Ban Quản trị DriNet đã nhận được yêu cầu và sẽ liên hệ tư vấn, điều phối giáo viên phù hợp nhất cho bạn.';

      const accountHtml = isNewAccountCreated
        ? '<div class="account-provisioned-card">' +
            '<h4>🎉 Đăng ký thành công & Đã cấp tài khoản học viên!</h4>' +
            '<p style="margin:4px 0 10px;font-size:13.5px;color:#166534">' +
              'Hệ thống DriNet đã cấp sẵn tài khoản để bạn theo dõi hồ sơ, nộp 3.000.000đ cọc và theo dõi nhật ký từng buổi dạy của giáo viên:' +
            '</p>' +
            '<div class="account-credentials-grid">' +
              '<span>📧 Email đăng nhập:</span> <b>' + escapeHtml(email) + '</b>' +
              '<span>🔑 Mật khẩu tạm thời:</span> <b>' + escapeHtml(tempPassword) + '</b>' +
            '</div>' +
            '<p style="margin:8px 0;font-size:12.5px;color:#15803d">' +
              '💡 <i>Bạn có thể đổi mật khẩu bất kỳ lúc nào trong mục Hồ sơ cá nhân sau khi đăng nhập.</i>' +
            '</p>' +
            '<div style="margin-top:12px">' +
              '<a class="btn btn-primary btn-sm" href="#/dang-nhap">👉 Đăng nhập để theo dõi khóa học &rarr;</a>' +
            '</div>' +
          '</div>'
        : '<p style="margin:8px 0 0;font-weight:600;color:var(--navy)">Bạn đã đăng nhập. Hãy truy cập <a href="#/ho-so" style="color:var(--blue)">Hồ sơ cá nhân</a> để xem tiến trình khóa học và hướng dẫn nộp cọc 3.000.000đ!</p>';

      message.innerHTML = '<div style="margin-bottom:12px;font-size:15px;line-height:1.5">' +
        '<b>✅ Gửi yêu cầu thành công!</b> ' + teacherNote +
        '</div>' + accountHtml;
      message.className = 'form-success show';
    } catch (error) {
      message.textContent = error.message || 'Không thể gửi yêu cầu. Vui lòng thử lại.';
      message.className = 'form-success show error';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Gửi yêu cầu tư vấn →';
    }
  });
}

function teacherApplicationPage() {
  const currentUser = getCurrentUser();
  return '<section class="page-hero"><div class="container"><span class="kicker" style="color:#83c7ff">BẮT ĐẦU CÙNG DRINET</span><h1>Đăng ký tham gia DriNet</h1><p>Mở rộng cơ hội tiếp cận học viên bằng một hồ sơ chuyên nghiệp, minh bạch.</p></div></section><main class="container section"><form id="teacher-app-form" class="panel form-card"><h3>Đăng ký tham gia DriNet</h3><div class="notice">&#128274; Tài liệu xác minh chỉ dành cho quản trị viên kiểm tra và tuyệt đối không hiển thị công khai trên website.</div><div class="form-grid"><div><label>Họ tên hoặc tên trung tâm *</label><input name="displayName" required value="' + escapeHtml(currentUser?.name) + '"></div><div><label>Số điện thoại *</label><input name="phone" type="tel" required value="' + escapeHtml(currentUser?.phone) + '"></div><div><label>Email *</label><input name="email" type="email" required value="' + escapeHtml(currentUser?.email) + '"></div><div><label>Loại hình *</label><select name="centerType" required><option value="">Chọn loại hình</option><option value="independent">Giáo viên độc lập</option><option value="center">Trung tâm đào tạo</option></select></div><div><label>Hạng bằng giảng dạy *</label><input name="licenses" required placeholder="Ví dụ: Hạng B, C1"></div><div><label>Số năm kinh nghiệm *</label><input name="experienceYears" type="number" min="0" max="60" required placeholder="Ví dụ: 5"></div><div><label>Khu vực hoạt động *</label><input name="area" required placeholder="Ví dụ: TP. Pleiku"></div><div class="full"><label>Scan bằng cấp & giấy phép (PDF hoặc ảnh) *</label><input name="certificateFile" type="file" required accept=".pdf,image/*"></div><div class="full"><label>Giới thiệu ngắn gọn</label><textarea name="bio" rows="3" placeholder="Phương pháp giảng dạy, các khung giờ rảnh có thể nhận học viên…"></textarea></div><div class="full check"><input id="terms-teacher" type="checkbox" required><label for="terms-teacher">Tôi cam kết thông tin cung cấp là chính xác và đồng ý với <a href="#/dieu-khoan" style="color:var(--blue)">Điều khoản sử dụng</a> của DriNet. *</label></div><div class="full"><button class="btn btn-primary" type="submit">Gửi đăng ký tham gia &rarr;</button></div></div><div class="form-success"></div></form></main>';
}

export function formPage(kind) {
  if (kind === 'student') return studentRegistrationPage();
  return teacherApplicationPage();
}

export function bindTeacherApplication() {
  const form = document.querySelector('#teacher-app-form');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = form.querySelector('.form-success');
    const submitBtn = form.querySelector('button[type="submit"]');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      await showAlert({
        title: 'Yêu cầu đăng nhập',
        message: 'Vui lòng đăng nhập tài khoản trước khi gửi hồ sơ giáo viên.',
        confirmText: 'Đăng nhập ngay',
        icon: '🔐',
      });
      location.hash = '#/dang-nhap';
      return;
    }

    const values = new FormData(form);
    const name = String(values.get('displayName') || '').trim();
    const licenses = String(values.get('licenses') || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => item === 'B' ? 'Hạng B' : item);
    const rawPrice = String(values.get('price') || '').replace(/[^0-9]/g, '');
    const centerType = values.get('centerType');
    const payload = {
      profile_id: session.user.id,
      slug: (slugify(name) || 'giao-vien') + '-' + session.user.id.slice(0, 8),
      display_name: name,
      area: String(values.get('area') || '').trim(),
      licenses,
      experience_years: Number(values.get('experienceYears')) || 0,
      price_per_lesson: rawPrice ? Number(rawPrice) : null,
      center_name: centerType === 'center' ? name : null,
      bio: String(values.get('bio') || '').trim() || null,
      status: 'pending',
    };

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang gửi hồ sơ…';
      const { data: existing, error: existingError } = await supabase.from('teachers').select('id, status').eq('profile_id', session.user.id).maybeSingle();
      if (existingError) throw existingError;

      let teacher;
      if (existing) {
        if (!['pending', 'needs_revision'].includes(existing.status)) throw new Error('Tài khoản này đã có hồ sơ đang được duyệt hoặc đã được phê duyệt.');
        const { data, error } = await supabase.from('teachers').update(payload).eq('id', existing.id).select('id').single();
        if (error) throw error;
        teacher = data;
      } else {
        const { data, error } = await supabase.from('teachers').insert(payload).select('id').single();
        if (error) throw error;
        teacher = data;
      }

      const fileInput = form.querySelector('input[type="file"]');
      const file = fileInput?.files?.[0];
      if (file) {
        const path = session.user.id + '/' + teacher.id + '/' + Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
        const { error: uploadError } = await supabase.storage.from('teacher-documents').upload(path, file, { contentType: file.type });
        if (uploadError) throw uploadError;
        const { error: documentError } = await supabase.from('teacher_documents').insert({ teacher_id: teacher.id, document_type: 'teaching_certificate', storage_path: path, original_filename: file.name, mime_type: file.type, file_size: file.size });
        if (documentError) throw documentError;
      }

      message.textContent = 'Đã gửi hồ sơ thành công. Ban quản trị DriNet sẽ xét duyệt và phản hồi cho bạn.';
      message.className = 'form-success show';
      form.reset();
    } catch (error) {
      message.textContent = error.message || 'Không thể gửi hồ sơ. Vui lòng thử lại.';
      message.className = 'form-success show error';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Gửi đăng ký tham gia →';
    }
  });
}

export function reviewPage() {
  const currentUser = getCurrentUser();
  const queryTeacher = new URLSearchParams(location.hash.split('?')[1] || '').get('teacher') || '';
  const teachers = getTeachers();
  const selectedTeacher = teachers.find((t) => t.slug === queryTeacher || t.name === queryTeacher);

  return '<section class="page-hero"><div class="container"><span class="kicker" style="color:#83c7ff">CHIA SẺ TRẢI NGHIỆM</span><h1>Gửi đánh giá của bạn</h1><p>Ý kiến trung thực của bạn giúp cộng đồng học viên đưa ra lựa chọn tốt hơn.</p></div></section><main class="container section"><form id="review-form" class="panel form-card"><div class="notice">&#8505; Đánh giá sẽ được quản trị viên kiểm duyệt đối chiếu trước khi công khai trên hồ sơ giáo viên.</div><div class="form-grid"><div><label>Họ và tên của bạn *</label><input name="studentName" required autocomplete="name" value="' + escapeHtml(currentUser?.name) + '"></div><div><label>Mã giao dịch hoặc số điện thoại đã học *</label><input name="phoneOrCode" required value="' + escapeHtml(currentUser?.phone) + '"></div><div><label>Giáo viên muốn đánh giá *</label><select name="teacherId" required><option value="">Chọn giáo viên</option>' + teachers.map((t) => '<option value="' + escapeHtml(t.id) + '"' + (selectedTeacher?.id === t.id ? ' selected' : '') + '>' + escapeHtml(t.name) + ' · ' + escapeHtml(t.area) + '</option>').join('') + '</select></div><div><label>Mức độ hài lòng *</label><select name="rating" required><option value="5">&#9733;&#9733;&#9733;&#9733;&#9733; - Rất hài lòng</option><option value="4">&#9733;&#9733;&#9733;&#9733;&#9734; - Hài lòng</option><option value="3">&#9733;&#9733;&#9733;&#9734;&#9734; - Bình thường</option><option value="2">&#9733;&#9733;&#9734;&#9734;&#9734; - Chưa hài lòng</option><option value="1">&#9733;&#9734;&#9734;&#9734;&#9734; - Rất không hài lòng</option></select></div><div class="full"><label>Nhận xét chi tiết về quá trình học *</label><textarea name="comment" required rows="4" placeholder="Chia sẻ cảm nhận về thái độ, phương pháp hướng dẫn, sự kiên nhẫn của giáo viên…"></textarea></div><div class="full"><button class="btn btn-primary" type="submit">Gửi đánh giá &rarr;</button></div></div><div class="form-success"></div></form></main>';
}

export function bindReviewPage() {
  const form = document.querySelector('#review-form');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const message = form.querySelector('.form-success');
    const values = new FormData(form);
    const teacherId = values.get('teacherId');
    const teachers = getTeachers();
    const teacher = teachers.find((t) => t.id === teacherId);
    const payload = {
      teacher_id: teacherId || null,
      teacher_name: teacher ? teacher.name : '',
      student_name: String(values.get('studentName') || '').trim(),
      phone_or_code: String(values.get('phoneOrCode') || '').trim(),
      rating: Number(values.get('rating')) || 5,
      comment: String(values.get('comment') || '').trim(),
      status: 'pending',
    };

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang gửi…';
      const { error } = await supabase.from('reviews').insert(payload);
      if (error) throw error;
      form.reset();
      message.textContent = 'Cảm ơn bạn đã gửi đánh giá! Ban quản trị DriNet sẽ kiểm duyệt trước khi công khai trên hồ sơ giáo viên.';
      message.className = 'form-success show';
    } catch (error) {
      message.textContent = error.message || 'Không thể gửi đánh giá. Vui lòng thử lại.';
      message.className = 'form-success show error';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Gửi đánh giá →';
    }
  });
}

export function contact() {
  const currentUser = getCurrentUser();
  return '<section class="page-hero"><div class="container"><span class="kicker" style="color:#83c7ff">LUÔN SẴN SÀNG HỖ TRỢ</span><h1>Liên hệ với DriNet</h1><p>Đội ngũ DriNet sẵn sàng lắng nghe và hỗ trợ bạn.</p></div></section><main class="container section"><div class="contact-grid"><div class="panel"><h3>Thông tin liên hệ</h3><div class="contact-item"><b>Zalo hỗ trợ</b><span>08 66 78 88 99</span></div><div class="contact-item"><b>Email</b><span>hello@drinet.vn</span></div><div class="contact-item"><b>Khu vực hoạt động</b><span>Gia Lai, Việt Nam</span></div><a class="btn btn-primary" style="margin-top:20px" href="https://zalo.me" target="_blank" rel="noopener">Nhắn Zalo ngay</a></div><form id="contact-form" class="panel"><h3>Gửi tin nhắn nhanh</h3><div class="form-grid"><div><label>Họ và tên *</label><input name="fullName" required autocomplete="name" value="' + escapeHtml(currentUser?.name) + '"></div><div><label>Số điện thoại hoặc email *</label><input name="contactInfo" required value="' + escapeHtml(currentUser?.phone || currentUser?.email) + '"></div><div class="full"><label>Nội dung cần hỗ trợ *</label><textarea name="content" required rows="5" placeholder="DriNet có thể hỗ trợ gì cho bạn?"></textarea></div><div class="full"><button class="btn btn-primary" type="submit">Gửi liên hệ &rarr;</button></div></div><div class="form-success"></div></form></div></main>';
}

export function bindContactPage() {
  const form = document.querySelector('#contact-form');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const message = form.querySelector('.form-success');
    const values = new FormData(form);
    const payload = {
      full_name: String(values.get('fullName') || '').trim(),
      contact_info: String(values.get('contactInfo') || '').trim(),
      content: String(values.get('content') || '').trim(),
      status: 'new',
    };

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang gửi…';
      const { error } = await supabase.from('contact_messages').insert(payload);
      if (error) throw error;
      form.reset();
      message.textContent = 'Cảm ơn bạn đã liên hệ! Đội ngũ DriNet sẽ phản hồi bạn trong thời gian sớm nhất.';
      message.className = 'form-success show';
    } catch (error) {
      message.textContent = error.message || 'Không thể gửi liên hệ. Vui lòng thử lại.';
      message.className = 'form-success show error';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Gửi liên hệ →';
    }
  });
}

export function about() {
  return '<section class="page-hero"><div class="container"><span class="kicker" style="color:#83c7ff">CÂU CHUYỆN DRINET</span><h1>Kết nối minh bạch cho hành trình vững tay lái</h1></div></section><main class="container section prose"><h2>Vì sao DriNet ra đời?</h2><p>Nhiều người có nhu cầu học lái xe nhưng gặp khó khăn trong việc tìm kiếm giáo viên uy tín, minh bạch về học phí và có phong cách giảng dạy phù hợp. Trong khi đó, những giáo viên chuyên môn tốt lại có thể hạn chế cơ hội quảng bá bản thân một cách công bằng.</p><p>DriNet được xây dựng để giải quyết khoảng cách này, tạo ra nền tảng kết nối trực tiếp giữa học viên với giáo viên và trung tâm đào tạo. Mọi lựa chọn bắt đầu từ thông tin rõ ràng và nhu cầu thực tế của người học.</p><h2>Giá trị chúng tôi theo đuổi</h2><div class="values">' + [['&#9672;', 'Minh bạch'], ['&#10003;', 'Uy tín'], ['&#9719;', 'Linh hoạt'], ['&#9022;', 'An toàn'], ['&harr;', 'Kết nối công bằng']].map((x) => '<div class="value"><div class="icon">' + x[0] + '</div><b>' + x[1] + '</b></div>').join('') + '</div><h2>Tầm nhìn</h2><p>Trở thành nền tảng kết nối học viên và giáo viên dạy lái đáng tin cậy, góp phần nâng cao chất lượng đào tạo và xây dựng văn hóa lái xe an toàn.</p></main>';
}

export function terms() {
  return '<section class="page-hero"><div class="container"><span class="kicker" style="color:#83c7ff">THÔNG TIN PHÁP LÝ</span><h1>Điều khoản & bảo mật</h1><p>Cập nhật lần cuối: tháng 11 năm 2026</p></div></section><main class="container section prose"><h2>Điều khoản sử dụng</h2><ul><li>DriNet là nền tảng kết nối, không trực tiếp thực hiện hoạt động đào tạo lái xe.</li><li>Học phí, lịch học và thỏa thuận đào tạo do giáo viên hoặc trung tâm quyết định.</li><li>Người dùng có trách nhiệm cung cấp thông tin chính xác, đầy đủ khi sử dụng nền tảng.</li><li>Đánh giá phải trung thực, tôn trọng và tuân thủ quy định của DriNet.</li></ul><h2>Chính sách bảo mật</h2><p>DriNet thu thập thông tin liên hệ, nhu cầu học và thông tin hồ sơ cần thiết để kết nối, xác minh và hỗ trợ người dùng. Dữ liệu được sử dụng đúng mục đích, bảo vệ bằng biện pháp phù hợp và lưu giữ trong thời gian cần thiết cho dịch vụ hoặc theo quy định pháp luật.</p><p>Bạn có quyền yêu cầu xem, chỉnh sửa hoặc xóa thông tin cá nhân của mình bằng cách liên hệ DriNet. Tài liệu xác minh của giáo viên/trung tâm chỉ phục vụ quản trị viên kiểm tra, tuyệt đối không hiển thị công khai.</p><h2>Quy định giao dịch</h2><p>DriNet khuyến khích người dùng thực hiện giao dịch thông qua quy trình của nền tảng để nhận được hỗ trợ khi phát sinh khiếu nại. Người dùng nên xác nhận rõ học phí, lịch học và nội dung dịch vụ trước khi bắt đầu.</p></main>';
}


