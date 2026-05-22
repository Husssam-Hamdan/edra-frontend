/* js/api.js — مشترك بين جميع الصفحات */

const API_BASE = 'https://edra-backend-omega.vercel.app/api';

function getToken() { return localStorage.getItem('edra_token'); }
function getUser()  { try { return JSON.parse(localStorage.getItem('edra_user')); } catch { return null; } }
function setSession(token, user) {
  localStorage.setItem('edra_token', token);
  localStorage.setItem('edra_user', JSON.stringify(user));
  localStorage.setItem('edra_login_time', Date.now().toString());
}
function clearSession() {
  localStorage.removeItem('edra_token');
  localStorage.removeItem('edra_user');
  localStorage.removeItem('edra_login_time');
}

/* ── رسالة انتهاء الجلسة ── */
function showSessionExpired() {
  // أزل أي رسالة قديمة
  document.getElementById('__session_expired_msg')?.remove();
  const base = window.location.pathname.includes('/edra-frontend') ? '/edra-frontend' : '';
  const div = document.createElement('div');
  div.id = '__session_expired_msg';
  div.style.cssText = `
    position:fixed;inset:0;background:rgba(13,17,23,.92);
    display:flex;align-items:center;justify-content:center;
    z-index:99999;backdrop-filter:blur(8px);
  `;
  div.innerHTML = `
    <div style="background:#161b22;border:1px solid #30363d;border-radius:14px;padding:36px 32px;text-align:center;width:min(400px,92vw);box-shadow:0 20px 60px rgba(0,0,0,.5)">
      <div style="font-size:2.5rem;margin-bottom:12px">⏰</div>
      <h2 style="color:#e6edf3;margin-bottom:8px;font-size:1.2rem">انتهت صلاحية الجلسة</h2>
      <p style="color:#8b949e;font-size:.9rem;margin-bottom:24px;line-height:1.6">
        لأسباب أمنية تنتهي الجلسة بعد 8 ساعات.<br>سجّل دخولك مجدداً للمتابعة.
      </p>
      <button onclick="window.location.href='${base}/pages/login.html'"
        style="background:#2f81f7;color:#fff;border:none;border-radius:8px;padding:11px 28px;font-size:.95rem;cursor:pointer;font-family:inherit;font-weight:600">
        تسجيل الدخول
      </button>
    </div>`;
  document.body.appendChild(div);
}

/* ── طلب API أساسي ── */
async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(API_BASE + path, {
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
    if (data.expired || data.error?.includes('انتهت')) {
      clearSession();
      showSessionExpired();
    }
    throw Object.assign(new Error(data.error || 'غير مصرح'), { status: 401 });
  }

  if (res.status === 403 && data.disabled) {
    clearSession();
    const base = window.location.pathname.includes('/edra-frontend') ? '/edra-frontend' : '';
    window.location.href = `${base}/pages/login.html?disabled=1`;
    throw new Error(data.error);
  }

  if (!res.ok) throw Object.assign(new Error(data.error || 'خطأ'), { status: res.status, data });
  return data;
}

/* ── رفع ملف إلى Cloudinary عبر الباكند ── */
async function uploadFile(file, folder = 'docs') {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);

    // ضغط الصور قبل الرفع
    if (file.type.startsWith('image/')) {
      compressImage(file, 1200, 0.82).then(compressed => {
        readAndUpload(compressed, file.name, folder, resolve, reject);
      }).catch(() => {
        readAndUpload(file, file.name, folder, resolve, reject);
      });
    } else {
      // PDF — رفع مباشر
      readAndUpload(file, file.name, folder, resolve, reject);
    }
  });
}

/* ضغط الصورة */
function compressImage(file, maxPx = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width > height) { height = Math.round(height * maxPx / width); width = maxPx; }
        else                { width  = Math.round(width  * maxPx / height); height = maxPx; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('فشل الضغط')), 'image/jpeg', quality);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function readAndUpload(fileOrBlob, originalName, folder, resolve, reject) {
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const result = await apiFetch('/upload', {
        method: 'POST',
        body: { data: e.target.result, fileName: originalName, folder },
      });
      resolve({ url: result.url, publicId: result.publicId, name: originalName });
    } catch(err) { reject(err); }
  };
  reader.onerror = reject;
  reader.readAsDataURL(fileOrBlob);
}

/* ── تحقق من الجلسة ── */
function requireAuth(allowedRoles) {
  const user  = getUser();
  const token = getToken();
  const base  = window.location.pathname.includes('/edra-frontend') ? '/edra-frontend' : '';

  if (!user || !token) {
    window.location.href = base + '/pages/login.html';
    return null;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    redirectByRole(user.role);
    return null;
  }
  return user;
}

function redirectByRole(role) {
  const base = window.location.pathname.includes('/edra-frontend') ? '/edra-frontend' : '';
  const map  = {
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
