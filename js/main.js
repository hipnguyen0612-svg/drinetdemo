import { getTeachers, loadTeachers } from './data.js';
import { adminPage, bindAdminPage } from './admin.js';
import { accountPage, bindAccountPage, bindLoginPage, getCurrentUser, initialiseAuth, isAdmin, loginPage } from './auth.js';
import { nav, footer } from './components.js';
import { home, teacherList, profile, formPage, reviewPage, about, contact, terms, bindStudentRegistration, bindTeacherApplication, bindTeacherFilters } from './pages.js';
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
  '/ho-so': accountPage,
  '/admin': adminPage,
};

function getPage(path) {
  if (path === '/dang-nhap' && getCurrentUser()) return accountPage;
  if ((path === '/admin' && !isAdmin()) || (path === '/ho-so' && !getCurrentUser())) return loginPage;
  if (path.startsWith('/giao-vien/')) {
    const slug = decodeURIComponent(path.split('/').pop());
    return () => { const teachers = getTeachers(); return profile(teachers.find((teacher) => teacher.slug === slug) || teachers[0]); };
  }

  return routes[path] || home;
}

async function render() {
  const rawRoute = location.hash.slice(1) || '/';
  const [path] = rawRoute.split('?');
  const page = getPage(path);

  app.innerHTML = nav() + page() + footer();
  if (path === '/giao-vien') bindTeacherFilters();
  if (path === '/dang-ky-hoc') bindStudentRegistration();
  if (path === '/dang-ky-giao-vien') bindTeacherApplication();
  if (path === '/admin' && isAdmin()) bindAdminPage();
  if ((path === '/dang-nhap' && !getCurrentUser()) || (path === '/admin' && !isAdmin()) || (path === '/ho-so' && !getCurrentUser())) bindLoginPage();
  if ((path === '/ho-so' || path === '/dang-nhap') && getCurrentUser()) bindAccountPage();
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