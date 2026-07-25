'use strict';

// Login screen wiring. Works identically over IPC (Electron) and REST (preview);
// the only branch is how we advance to the main window afterwards.
(function () {
  const $ = (id) => document.getElementById(id);
  $('logo').innerHTML = window.icon('logo');
  $('userIcon').innerHTML = window.icon('user');
  $('lockIcon').innerHTML = window.icon('lock');

  const errBox = $('err');
  function showError(msg) { errBox.textContent = msg || ''; }

  async function doLogin() {
    showError('');
    const username = $('username').value.trim();
    const password = $('password').value;
    if (!username || !password) return showError('أدخل اسم المستخدم وكلمة المرور');
    try {
      const res = await window.api.auth.login(username, password);
      if (!res || !res.ok) return showError((res && res.error && res.error.message) || 'تعذّر تسجيل الدخول');
      if (window.api.isHttp) {
        try { sessionStorage.setItem('auth_user', JSON.stringify(res.data)); } catch (e) { /* ignore */ }
      }
      window.api.app.openMain();
    } catch (err) {
      showError(err.message || 'خطأ في الاتصال');
    }
  }

  async function doChangePassword() {
    showError('');
    const username = ($('username').value.trim()) || window.prompt('اسم المستخدم');
    if (!username) return;
    const oldPassword = window.prompt('كلمة المرور الحالية');
    if (oldPassword == null) return;
    const newPassword = window.prompt('كلمة المرور الجديدة (4 أحرف على الأقل)');
    if (newPassword == null) return;
    try {
      const res = await window.api.auth.changePassword({ username, oldPassword, newPassword });
      if (!res || !res.ok) return showError((res && res.error && res.error.message) || 'تعذّر تغيير كلمة المرور');
      showError('تم تغيير كلمة المرور بنجاح');
    } catch (err) {
      showError(err.message || 'خطأ في الاتصال');
    }
  }

  $('loginBtn').addEventListener('click', doLogin);
  $('changeBtn').addEventListener('click', doChangePassword);
  ['username', 'password'].forEach((id) =>
    $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); })
  );
  $('username').focus();
})();

