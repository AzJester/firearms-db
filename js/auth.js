// =====================================================
// Auth gate — login screen, session restore, first-run import, sign out.
// Loaded last, after app.js (bootApp) and cloud-sync.js (CloudSync).
// =====================================================
(function () {
  const sb = window.sbClient;
  const overlay = document.getElementById('authOverlay');
  const appRoot = document.getElementById('appRoot');
  const form = document.getElementById('authForm');
  const emailEl = document.getElementById('authEmail');
  const pwEl = document.getElementById('authPassword');
  const errEl = document.getElementById('authError');
  const submitBtn = document.getElementById('authSubmit');
  let booted = false;

  function showError(msg) {
    errEl.textContent = msg || '';
    errEl.style.display = msg ? 'block' : 'none';
  }
  function busy(on) {
    submitBtn.disabled = on;
    submitBtn.textContent = on ? 'Signing in…' : 'Sign In';
  }

  async function startApp(session) {
    CloudSync.uid = session.user.id;
    overlay.style.display = 'none';
    appRoot.style.display = '';
    document.getElementById('authedEmail').textContent = session.user.email || '';
    if (!booted) {
      booted = true;
      await window.bootApp();          // loads local cache + pulls from cloud + renders
      maybeOfferImport();
    }
  }

  // If there is no cloud data yet AND nothing locally, offer a one-time import.
  function maybeOfferImport() {
    const empty = (db.firearms.length + db.ammo.length + db.accessories.length) === 0;
    if (!CloudSync.hasCloudData && empty) {
      document.getElementById('firstRunPanel').style.display = 'flex';
    }
  }

  // ---- login form ----
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      showError('');
      busy(true);
      try {
        const { data, error } = await sb.auth.signInWithPassword({
          email: emailEl.value.trim(),
          password: pwEl.value
        });
        if (error) { showError(error.message); busy(false); return; }
        await startApp(data.session);
      } catch (err) {
        showError(err.message || 'Sign in failed.');
        busy(false);
      }
    });
  }

  // ---- first-run import wiring ----
  const importInput = document.getElementById('firstRunFile');
  if (importInput) {
    importInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const status = document.getElementById('firstRunStatus');
      status.textContent = 'Reading file…';
      try {
        const res = await CloudSync.restoreFromFile(file);
        status.textContent = '';
        document.getElementById('firstRunPanel').style.display = 'none';
        alert('Imported & synced to the cloud:\n' +
              res.firearms + ' firearms, ' + res.ammo + ' ammo, ' +
              res.accessories + ' accessories, ' + res.images + ' photos.');
      } catch (err) {
        status.textContent = 'Import failed: ' + err.message;
      }
      e.target.value = '';
    });
  }
  const skipBtn = document.getElementById('firstRunSkip');
  if (skipBtn) skipBtn.addEventListener('click', () => {
    document.getElementById('firstRunPanel').style.display = 'none';
  });

  // ---- sign out (exposed for the toolbar button) ----
  window.Auth = {
    async signOut() {
      if (!confirm('Sign out of this device? Your data stays safe in the cloud.')) return;
      try { if (CloudSync.ready) await CloudSync.syncNow(); } catch (_) {}
      await sb.auth.signOut();
      location.reload();
    }
  };

  // ---- on load: resume an existing session if present ----
  (async function () {
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session) { await startApp(session); }
      else { overlay.style.display = 'flex'; }
    } catch (e) {
      overlay.style.display = 'flex';
    }
  })();
})();
