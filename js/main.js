import { getTeachers, loadTeachers } from './data.js';
import { adminPage, bindAdminPage } from './admin.js';
import { accountPage, bindAccountPage, bindLoginPage, getCurrentUser, initialiseAuth, isAdmin, loginPage } from './auth.js';
import { nav, footer, bindNavigationEvents } from './components.js';
import { home, teacherList, profile, formPage, reviewPage, about, contact, terms, bindStudentRegistration, bindTeacherApplication, bindTeacherFilters, bindReviewPage, bindContactPage, bindTeacherProfile } from './pages.js';
import { submitForm } from './utils.js';

const app = document.querySelector('#app');

// Forms are rendered from page templates, which use inline submit handlers.
// Expose only this small UI helper intentionally for those templates.
window.submitForm = submitForm;

const routes = {
  '/': home,
  '/giao-vien': teacherList,
  '/dang-ky-hoc': () => formPage('student'),
  '/dang-ky-giao-vien': () => formPage('teacher'),
  '/danh-gia': reviewPage,
  '/ve-chung-toi': about,
  '/lien-he': contact,
  '/dieu-khoan': terms,
  '/dang-nhap': loginPage,
  '/dang-ky': loginPage,
  '/ho-so': accountPage,
  '/giao-vien-dashboard': accountPage,
  '/admin': adminPage,
};

function getPage(path) {
  if ((path === '/admin' && !isAdmin()) || ((path === '/ho-so' || path === '/giao-vien-dashboard') && !getCurrentUser())) return loginPage;
  if (path.startsWith('/giao-vien/')) {
    const slug = decodeURIComponent(path.split('/').pop());
    return () => {
      const teachers = getTeachers();
      return profile(teachers.find((teacher) => teacher.slug === slug) || null);
    };
  }

  return routes[path] || home;
}

async function render() {
  const rawRoute = location.hash.slice(1) || '/';
  const [path] = rawRoute.split('?');

  if (path === '/' || path === '/giao-vien' || path.startsWith('/giao-vien/') || path === '/dang-ky-hoc') {
    try {
      await loadTeachers();
    } catch (error) {
      console.warn('Không thể đồng bộ danh sách giáo viên:', error);
    }
  }

  const page = getPage(path);

  app.innerHTML = nav() + page() + footer();
  bindNavigationEvents();
  if (path === '/giao-vien') bindTeacherFilters();
  if (path === '/dang-ky-hoc') bindStudentRegistration();
  if (path === '/dang-ky-giao-vien') bindTeacherApplication();
  if (path === '/danh-gia') bindReviewPage();
  if (path === '/lien-he') bindContactPage();
  if (path.startsWith('/giao-vien/')) {
    const slug = decodeURIComponent(path.split('/').pop());
    const teacher = getTeachers().find((t) => t.slug === slug);
    if (teacher) bindTeacherProfile(teacher);
  }
  if (path === '/admin' && isAdmin()) bindAdminPage();
  if (path === '/dang-nhap' || path === '/dang-ky' || (path === '/admin' && !isAdmin()) || ((path === '/ho-so' || path === '/giao-vien-dashboard') && !getCurrentUser())) bindLoginPage();
  if ((path === '/ho-so' || path === '/giao-vien-dashboard') && getCurrentUser()) bindAccountPage();
  window.scrollTo({ top: 0, behavior: 'instant' });
  document.title = path === '/' ? 'DriNet — Kết nối đúng người dạy' : `DriNet | ${path.split('/').pop()}`;
}

window.addEventListener('hashchange', render);
async function initialiseApp() {
  try {
    await Promise.all([initialiseAuth(), loadTeachers()]);
  } catch (error) {
    console.error('Không thể đồng bộ dữ liệu DriNet từ Supabase.', error);
  }
  render();
}

initialiseApp();