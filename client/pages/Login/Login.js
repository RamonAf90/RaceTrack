// Handles login via POST /api/login and redirects to the correct route.
// Expects IDs: loginForm, role, accessKey, errorMsg, (optional) loginSubmit.

(function () {
  'use strict';

  const form  = document.getElementById('loginForm');
  const roleEl = document.getElementById('role');
  const keyEl  = document.getElementById('accessKey');
  const errEl  = document.getElementById('errorMsg');
  const btn    = document.getElementById('loginSubmit');

  if (!form || !roleEl || !keyEl) {
    console.error('[Login] Missing form elements.');
    return;
  }

  const qs = new URLSearchParams(location.search);
  const nextDest = qs.get('next'); // e.g. /front-desk

  const showError = (msg) => {
    if (errEl) {
      errEl.textContent = msg || 'Invalid key, please try again.';
      errEl.classList.remove('hidden');
    } else {
      alert(msg || 'Invalid key, please try again.');
    }
  };
  const clearError = () => { if (errEl) { errEl.classList.add('hidden'); errEl.textContent = ''; } };
  const setLoading = (on) => { if (btn) btn.disabled = !!on; };

  const routeForRole = (role) => {
    switch ((role || '').toLowerCase()) {
      case 'receptionist': return '/front-desk';
      case 'observer':     return '/lap-line-tracker';
      case 'safety':       return '/race-control';
      default:             return '/home';
    }
  };

  // remember last role (optional)
  try {
    const last = localStorage.getItem('rt_last_role');
    if (last && ['receptionist','observer','safety'].includes(last)) roleEl.value = last;
  } catch {}

  roleEl.addEventListener('change', () => {
    clearError();
    try { localStorage.setItem('rt_last_role', roleEl.value); } catch {}
  });
  keyEl.addEventListener('input', clearError);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const role = (roleEl.value || '').trim().toLowerCase();
    const key  = (keyEl.value  || '').trim();

    if (!['receptionist','observer','safety'].includes(role)) {
      showError('Please select a valid role.');
      return;
    }
    if (!key) {
      showError('Access key is required.');
      keyEl.focus();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, key }), // <-- FIX: send "key", not "accessKey"
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data && data.ok === true) { // <-- FIX: check "ok"
        // Prefer ?next=..., else role route, else /home
        const dest = nextDest || routeForRole(role) || '/home';
        window.location.replace(dest);
        return;
      }

      showError(data?.error || 'Invalid key, please try again.');
      keyEl.select();
    } catch (err) {
      console.error('[Login] error:', err);
      showError('Server error. Please try again.');
    } finally {
      setLoading(false);
    }
  });
})();