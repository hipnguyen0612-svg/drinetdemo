import { teachers } from './data.js';
import { nav, footer } from './components.js';
import { home, teacherList, profile, formPage, reviewPage, about, contact, terms, bindTeacherFilters } from './pages.js';
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
};

function getPage(path) {
  if (path.startsWith('/giao-vien/')) {
    const slug = decodeURIComponent(path.split('/').pop());
    return () => profile(teachers.find((teacher) => teacher.slug === slug) || teachers[0]);
  }

  return routes[path] || home;
}

function render() {
  const rawRoute = location.hash.slice(1) || '/';
  const [path] = rawRoute.split('?');
  const page = getPage(path);

  app.innerHTML = nav() + page() + footer();
  if (path === '/giao-vien') bindTeacherFilters();
  window.scrollTo({ top: 0, behavior: 'instant' });
  document.title = path === '/' ? 'DriNet — Kết nối đúng người dạy' : `DriNet | ${path.split('/').pop()}`;
}

window.addEventListener('hashchange', render);
render();