(function () {
  'use strict';

  const protectedRouteRole = {
    '/front-desk': 'receptionist',
    '/race-control': 'safety',
    '/lap-line-tracker': 'observer',
  };

  let myRole = null;

  async function init() {
    try {
      const res = await fetch('/api/me', { credentials: 'same-origin' });
      const data = await res.json();
      myRole = data?.role || null;
    } catch {
      myRole = null;
    }
    // expose helper used by buttons
    window.goTo = (path) => {
      const need = protectedRouteRole[path];
      if (need && myRole !== need) {
        // bounce to login with return URL
        window.location.href = `/login?next=${encodeURIComponent(path)}`;
        return;
        }
      window.location.href = path;
    };
  }

  init();
})();