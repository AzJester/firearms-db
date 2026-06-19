// =====================================================
// LOCAL EDITION RUNTIME
// =====================================================
// This file replaces the cloud stack (config.js + supabase-client.js +
// cloud-sync.js + auth.js) used by the online edition. In this build there is
// no account, no login, and no network sync: everything you enter is stored
// only in this browser/app via IndexedDB and never leaves your device.
//
// app.js is shared, unmodified, with the online edition. It already persists
// every change to IndexedDB on its own (saveToLocalStorage), and only *also*
// pushes to the cloud when CloudSync.ready is true — so by providing an inert
// CloudSync below, the exact same app runs fully offline and local-only.

(function () {
  'use strict';

  // ---- Inert cloud layer -------------------------------------------------
  // app.js guards every cloud call with `window.CloudSync && CloudSync.<x>`.
  //  - uid is null  => bootApp() skips the cloud pull entirely
  //  - ready false  => saveToLocalStorage() never schedules a network push
  window.CloudSync = {
    uid: null,
    ready: false,
    hasCloudData: false,
    pull: async function () {},
    push: async function () {},
    schedulePush: function () {},
    syncNow: function () {
      if (window.toast) toast('This is the local edition — your data is saved on this device. There is no cloud to sync to.', 'info', 5000);
    }
  };

  // Auth has no meaning offline; keep a stub so any stray reference is safe.
  window.Auth = { signOut: function () {} };

  // ---- Cloud-only features that remain referenced in shared code ----------
  // Read-only share links require the server, so make them a friendly no-op.
  window.openShareModal = function () {
    if (window.toast) toast('Share links are an online-edition feature. To share a copy locally, use Tools → Export (Excel/JSON) or “Save to File”.', 'info', 6000);
  };
  window.changeCloudPassword = function () {};

  // ---- About dialog ------------------------------------------------------
  window.openAbout = function () {
    var m = document.getElementById('aboutModal');
    if (m) m.classList.add('open');
  };
  window.closeAbout = function () {
    var m = document.getElementById('aboutModal');
    if (m) m.classList.remove('open');
  };

  // ---- First-run sample data --------------------------------------------
  var ONBOARDED_KEY = 'fdb_local_onboarded';
  function newId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 6); }
  function today(offsetDays) {
    var d = new Date();
    if (offsetDays) d.setDate(d.getDate() - offsetDays);
    return d.toISOString().slice(0, 10);
  }

  // A few realistic, fictional entries so a new buyer sees a populated app.
  // No real serial numbers — placeholders the user is meant to overwrite.
  function sampleFirearms() {
    return [
      {
        id: newId(), make: 'Smith & Wesson', model: 'M&P15 Sport II', serial: 'SAMPLE-0001',
        caliber: '5.56 NATO', type: 'Rifle', barrel: '16"', condition: 'Excellent',
        price: 749.99, dateAcquired: today(420), status: 'Active',
        tags: ['range', 'AR-15'], images: [], isNFA: false,
        notes: '<p>Sample entry — edit or delete me. Great first AR platform.</p>'
      },
      {
        id: newId(), make: 'Glock', model: '19 Gen 5', serial: 'SAMPLE-0002',
        caliber: '9mm', type: 'Pistol', barrel: '4.02"', condition: 'New',
        price: 539.0, dateAcquired: today(180), status: 'Active',
        tags: ['carry'], images: [], isNFA: false,
        notes: '<p>Sample entry — daily carry pistol.</p>'
      },
      {
        id: newId(), make: 'Ruger', model: '10/22 Carbine', serial: 'SAMPLE-0003',
        caliber: '22 LR', type: 'Rifle', barrel: '18.5"', condition: 'Good',
        price: 329.0, dateAcquired: today(900), status: 'Active',
        tags: ['plinking', 'rimfire'], images: [], isNFA: false,
        notes: '<p>Sample entry — classic rimfire plinker.</p>'
      }
    ];
  }

  window.loadSampleData = async function () {
    sampleFirearms().forEach(function (f) { db.firearms.push(f); });
    if (Array.isArray(db.ammo)) {
      db.ammo.push({
        id: newId(), brand: 'Federal American Eagle', caliber: '5.56 NATO',
        quantity: 400, purchaseDate: today(120), pricePerRound: 0.42,
        location: 'Safe — ammo can A', lowStock: 100, notes: ''
      });
    }
    localStorage.setItem(ONBOARDED_KEY, '1');
    hideFirstRun();
    await saveData();
    if (typeof render === 'function') render();
    if (window.toast) toast('Loaded sample data. Edit or delete it any time — it’s just to show you around.', 'success', 5000);
  };

  function hideFirstRun() {
    var fr = document.getElementById('localFirstRun');
    if (fr) fr.style.display = 'none';
  }
  window.dismissFirstRun = function () {
    localStorage.setItem(ONBOARDED_KEY, '1');
    hideFirstRun();
  };

  // ---- Local full-backup restore ----------------------------------------
  // The online edition restored backups through the cloud; here we load a
  // backup file (as written by "Backup Now" / "Save to File") straight back
  // into this device's IndexedDB. Symmetric, fully offline.
  async function restoreLocalBackup(file) {
    var parsed;
    try { parsed = JSON.parse(await file.text()); }
    catch (e) { if (window.toast) toast('That file isn’t a valid backup (.json).', 'error'); return; }
    if (!parsed || typeof parsed !== 'object') { if (window.toast) toast('That file isn’t a recognized backup.', 'error'); return; }

    var ok = (typeof confirmDialog === 'function')
      ? await confirmDialog('Replace your ENTIRE current collection with “' + file.name + '”? This overwrites everything currently stored on this device. (Tip: use “Save to File” first if you want a safety copy.)',
          { title: 'Restore from file', okText: 'Replace everything', danger: true })
      : confirm('Replace your entire collection with ' + file.name + '?');
    if (!ok) return;

    try {
      db.firearms = parsed.firearms || [];
      db.ammo = parsed.ammo || [];
      db.accessories = parsed.accessories || [];
      db.wishlist = parsed.wishlist || [];
      db.dealers = parsed.dealers || [];
      db.valueHistory = parsed.valueHistory || [];
      db.auditTrail = parsed.auditTrail || [];
      db.settings = parsed.settings || {};
      db.firearms.forEach(function (f) { if (!f.tags) f.tags = []; });

      var imgs = parsed.images || {};
      imagesDb = {};
      for (var k in imgs) {
        if (!Object.prototype.hasOwnProperty.call(imgs, k)) continue;
        imagesDb[k] = imgs[k];
        try { await idbPut(k, imgs[k]); } catch (e) { /* keep in-memory copy */ }
      }

      await saveData();
      if (typeof buildThumbnails === 'function') buildThumbnails();
      if (typeof render === 'function') render();
      if (window.toast) toast('Restored ' + db.firearms.length + ' firearms from backup.', 'success', 5000);
    } catch (e) {
      if (window.toast) toast('Restore failed: ' + e.message, 'error', 6000);
    }
  }
  window.restoreLocalBackup = restoreLocalBackup;

  // ---- App passcode: optional lock + at-rest encryption -----------------
  // Off by default. When set, the on-device saved state is encrypted with a
  // key derived from the passcode (reusing app.js's PBKDF2 + AES-GCM helpers),
  // and the app shows a lock screen on launch. There is no recovery — the
  // passcode IS the encryption key.
  var LL_ON = 'fdb_lock_on';        // "1" when a passcode is set
  var LL_VER = 'fdb_lock_verifier'; // encrypted token used to verify the passcode
  var LL_TOKEN = 'firearms-vault-lock-ok';

  var LocalLock = {
    key: null,                      // holds the passcode string while unlocked
    active: function () { return localStorage.getItem(LL_ON) === '1'; },
    encryptState: async function (obj) {
      return { __enc: true, payload: await encryptData(JSON.stringify(obj), this.key) };
    },
    decryptState: async function (env) {
      return JSON.parse(await decryptData(env.payload, this.key));
    }
  };
  window.LocalLock = LocalLock;

  function refreshPasscodeUI() {
    var on = LocalLock.active();
    var state = document.getElementById('passcodeState');
    if (state) state.textContent = on ? 'Currently ON — the app is locked on open.' : 'Currently off.';
    var setW = document.getElementById('passcodeSetWrap');
    var remW = document.getElementById('passcodeRemoveWrap');
    if (setW) setW.style.display = on ? 'none' : '';
    if (remW) remW.style.display = on ? '' : 'none';
  }
  window.refreshPasscodeUI = refreshPasscodeUI;

  window.enableLocalPasscode = async function () {
    var a = document.getElementById('passNew'), b = document.getElementById('passConfirm');
    var pc = ((a && a.value) || '').trim(), pc2 = ((b && b.value) || '').trim();
    if (pc.length < 4) { if (window.toast) toast('Passcode must be at least 4 characters.', 'error'); return; }
    if (pc !== pc2) { if (window.toast) toast('Passcodes do not match.', 'error'); return; }
    try {
      var verifier = await encryptData(LL_TOKEN, pc);
      localStorage.setItem(LL_VER, JSON.stringify(verifier));
      localStorage.setItem(LL_ON, '1');
      LocalLock.key = pc;
      await saveData();             // re-saves on-device state, now encrypted
      if (a) a.value = ''; if (b) b.value = '';
      refreshPasscodeUI();
      if (window.toast) toast('App passcode enabled — you’ll be asked for it each time the app opens.', 'success', 5000);
    } catch (e) {
      if (window.toast) toast('Could not enable passcode: ' + e.message, 'error', 6000);
    }
  };

  window.disableLocalPasscode = async function () {
    var go = (typeof confirmDialog === 'function')
      ? await confirmDialog('Remove the app passcode? Your records will be stored unencrypted on this device and the app will open without a lock.', { title: 'Remove passcode', okText: 'Remove', danger: true })
      : confirm('Remove the app passcode?');
    if (!go) return;
    localStorage.removeItem(LL_ON);
    localStorage.removeItem(LL_VER);
    try { await saveData(); }       // LocalLock.active() now false => stores plaintext
    catch (e) { /* ignore */ }
    LocalLock.key = null;
    refreshPasscodeUI();
    if (window.toast) toast('App passcode removed.', 'success');
  };

  async function verifyPasscode(pc) {
    if (!pc) return false;
    var raw = localStorage.getItem(LL_VER);
    if (!raw) return true;          // enabled without a verifier — let decryption be the gate
    try { return (await decryptData(JSON.parse(raw), pc)) === LL_TOKEN; }
    catch (e) { return false; }
  }

  function showLockScreen(onUnlock) {
    var ov = document.createElement('div');
    ov.id = 'lockScreen';
    ov.className = 'auth-overlay';
    ov.innerHTML =
      '<div class="auth-card">' +
        '<div class="auth-logo">🔒</div>' +
        '<h1>Locked</h1>' +
        '<p class="auth-sub">Enter your passcode to open your collection.</p>' +
        '<form id="lockForm" autocomplete="off">' +
          '<label for="lockInput">Passcode</label>' +
          '<input id="lockInput" type="password" autocomplete="current-password">' +
          '<div id="lockErr" class="auth-error" style="display:none;"></div>' +
          '<button class="btn btn-primary auth-submit" type="submit">Unlock</button>' +
        '</form>' +
        '<p class="auth-foot">Stored only on this device. If you forget the passcode, the data can’t be recovered.</p>' +
      '</div>';
    document.body.appendChild(ov);
    var input = ov.querySelector('#lockInput');
    var err = ov.querySelector('#lockErr');
    if (input) setTimeout(function () { input.focus(); }, 30);
    ov.querySelector('#lockForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var pc = (input && input.value) || '';
      if (!(await verifyPasscode(pc))) {
        if (err) { err.textContent = 'Incorrect passcode. Try again.'; err.style.display = 'block'; }
        if (input) { input.value = ''; input.focus(); }
        return;
      }
      LocalLock.key = pc;
      ov.remove();
      onUnlock();
    });
  }

  // ---- Boot --------------------------------------------------------------
  async function startApp() {
    var appRoot = document.getElementById('appRoot');
    if (appRoot) appRoot.style.display = '';

    if (typeof window.bootApp === 'function') {
      try { await window.bootApp(); }
      catch (e) { console.error('bootApp failed', e); }
    }

    // Re-label the status bar for a local, no-account build.
    var dot = document.getElementById('statusDot');
    if (dot) dot.className = 'file-status-dot connected';
    var st = document.getElementById('fileStatusText');
    if (st) st.textContent = LocalLock.active() ? 'Locked · saved on this device' : 'Saved on this device';

    // Wire "Restore from File" to the local restore (the cloud build did this
    // in auth.js, which this edition doesn't load).
    var rf = document.getElementById('restoreFile');
    if (rf) rf.addEventListener('change', function (e) {
      var f = e.target.files[0];
      e.target.value = '';
      if (f) restoreLocalBackup(f);
    });

    refreshPasscodeUI();

    // Offer sample data on the first run with an empty collection (never when a
    // passcode is set — that user already has data).
    try {
      var empty = (db.firearms.length + db.ammo.length + db.accessories.length) === 0;
      if (empty && !LocalLock.active() && !localStorage.getItem(ONBOARDED_KEY)) {
        var fr = document.getElementById('localFirstRun');
        if (fr) fr.style.display = 'flex';
      }
    } catch (e) { /* db not ready — skip onboarding */ }
  }

  function boot() {
    if (LocalLock.active()) showLockScreen(startApp); // gate first; load after unlock
    else startApp();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
