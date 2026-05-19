/* js/api.js — مشترك بين جميع صفحات الفرونت إند */
 
const API_BASE = 'https://edra-backend-omega.vercel.app/api';
// غيّر الرابط أعلاه لرابط الـ backend الحقيقي بعد النشر
  
function getToken() { return localStorage.getItem('edra_token'); }
function getUser()  {
  try { return JSON.parse(localStorage.getItem('edra_user')); } catch { return null; }
}
function setSession(token, user) {
  localStorage.setItem('edra_token', token);
  localStorage.setItem('edra_user', JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem('edra_token');
  localStorage.removeItem('edra_user');
}
 
async function apiFetch(path, options = {}) {
  const token = getToken();
  const res   = await fetch(API_BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
 
  const data = await res.json();
 
  if (res.status === 401) {
    if (data.expired) {
      clearSession();
      window.location.href = '/pages/login.html';
    }
    throw Object.assign(new Error(data.error || 'غير مصرح'), { status: 401 });
  }
 
  if (!res.ok) throw Object.assign(new Error(data.error || 'خطأ'), { status: res.status, data });
  return data;
}
 
/* التحقق من الجلسة وتحويل حسب الدور */
function requireAuth(allowedRoles) {
  const user = getUser();
  const token = getToken();
  const base = window.location.pathname.includes('/edra-frontend') ? '/edra-frontend' : '';
  if (!user || !token) { window.location.href = base + '/pages/login.html'; return null; }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    redirectByRole(user.role);
    return null;
  }
  return user;
}
 
function redirectByRole(role) {
  const base = window.location.pathname.includes('/edra-frontend') ? '/edra-frontend' : '';
  const map = {
    superadmin: base + '/pages/superadmin.html',
    org_admin:  base + '/pages/dashboard.html',
    data_entry: base + '/pages/students.html',
  };
  window.location.href = map[role] || base + '/pages/login.html';
}
 
function logout() {
  clearSession();
  const base = window.location.pathname.includes('/edra-frontend') ? '/edra-frontend' : '';
  window.location.href = base + '/pages/login.html';
}
 
