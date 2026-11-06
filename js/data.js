export const teachers = [
  { slug: 'nguyen-minh-duc', name: 'Nguyễn Minh Đức', exp: '9 năm kinh nghiệm', licenses: 'Hạng B, C1', area: 'TP. Pleiku', price: '350.000đ / buổi', rating: '4.9', reviews: 28, img: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=700&q=80', center: 'Trung tâm Đào tạo Lái xe Pleiku', bio: 'Thầy Đức theo đuổi phương pháp hướng dẫn bình tĩnh, sát thực tế và phù hợp với nhịp học của từng học viên.' },
  { slug: 'tran-thi-lan', name: 'Trần Thị Lan', exp: '7 năm kinh nghiệm', licenses: 'Hạng B', area: 'Chư Sê', price: '320.000đ / buổi', rating: '4.8', reviews: 19, img: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=700&q=80', center: 'Độc lập', bio: 'Cô Lan có lịch học linh hoạt, đặc biệt phù hợp với học viên muốn học cuối tuần.' },
  { slug: 'le-quang-huy', name: 'Lê Quang Huy', exp: '11 năm kinh nghiệm', licenses: 'Hạng B, C1', area: 'TP. Pleiku', price: '380.000đ / buổi', rating: '5.0', reviews: 34, img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=700&q=80', center: 'Trung tâm Gia Lai Auto', bio: 'Thầy Huy chú trọng kỹ năng lái xe an toàn và tâm lý vững vàng khi tham gia giao thông.' },
];

const STORAGE_KEY = 'drinet-admin-teachers';

function readAdminTeachers() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch { return []; }
}

function saveAdminTeachers(entries) { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }

export function getTeachers() {
  const entries = readAdminTeachers();
  const overrides = new Map(entries.filter((teacher) => teacher.isOverride).map((teacher) => [teacher.slug, teacher]));
  const baseTeachers = teachers.map((teacher) => overrides.has(teacher.slug) ? { ...teacher, ...overrides.get(teacher.slug), isAdminEntry: false } : teacher);
  const customTeachers = entries.filter((teacher) => !teacher.isOverride && !teachers.some((base) => base.slug === teacher.slug));
  return [...baseTeachers, ...customTeachers];
}

export function addTeacher(teacher) {
  const entries = readAdminTeachers();
  entries.push({ ...teacher, isAdminEntry: true });
  saveAdminTeachers(entries);
}

export function updateTeacher(teacher) {
  const entries = readAdminTeachers();
  const index = entries.findIndex((entry) => entry.slug === teacher.slug);
  const isDefaultTeacher = teachers.some((base) => base.slug === teacher.slug);
  const updated = isDefaultTeacher ? { ...teacher, isOverride: true } : { ...teacher, isAdminEntry: true };
  if (index >= 0) entries[index] = updated;
  else entries.push(updated);
  saveAdminTeachers(entries);
}

export function removeAdminTeacher(slug) {
  saveAdminTeachers(readAdminTeachers().filter((teacher) => teacher.slug !== slug));
}

export function clearAdminTeachers() { localStorage.removeItem(STORAGE_KEY); }