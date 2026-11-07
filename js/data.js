import { supabase } from './supabase.js';

let remoteTeachers = [];
export function formatTeacher(teacher) {
  const image = teacher.avatar_path || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=700&q=80';
  return {
    id: teacher.id,
    slug: teacher.slug,
    name: teacher.display_name,
    area: teacher.area,
    licenses: Array.isArray(teacher.licenses) ? teacher.licenses.join(', ') : (teacher.licenses || ''),
    exp: `${teacher.experience_years} năm kinh nghiệm`,
    price: teacher.price_per_lesson ? `${Number(teacher.price_per_lesson).toLocaleString('vi-VN')}đ / buổi` : 'Liên hệ',
    rating: Number(teacher.rating || 0).toFixed(1),
    reviews: teacher.review_count || 0,
    img: image,
    center: teacher.center_name || 'Độc lập',
    bio: teacher.bio || '',
    status: teacher.status,
  };
}

export function getTeachers() {
  return remoteTeachers;
}

export async function loadTeachers() {
  const { data, error } = await supabase.from('teachers').select('*').eq('status', 'approved').order('rating', { ascending: false });
  if (error) throw error;
  remoteTeachers = (data || []).map(formatTeacher);
  return remoteTeachers;
}
