/**
 * TutorsLink Firebase App
 * Handles: Auth (Email/Password, Google, Discord stub), role-aware UI,
 * and Cloud Function stubs for application submission, chat, and demo booking.
 *
 * Dependencies (loaded via CDN in HTML before this script):
 *   firebase-config.js  — defines window.FIREBASE_CONFIG
 *
 * Firebase SDK is loaded from the CDN URLs below; no build step required.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  Firebase SDK — loaded dynamically so pages work even without       */
  /*  a real config (stub/graceful-degradation mode).                   */
  /* ------------------------------------------------------------------ */
  var FB_SDK_BASE = 'https://www.gstatic.com/firebasejs/10.12.2/';

  var _app    = null;
  var _auth   = null;
  var _db     = null;      /* Firestore */
  var _fns    = null;      /* Functions */
  var _ready  = false;

  /* Resolved when SDK is loaded and app is initialised */
  var _readyCallbacks = [];
  function onReady(fn) {
    if (_ready) { fn(); } else { _readyCallbacks.push(fn); }
  }
  function _fireReady() {
    _ready = true;
    _readyCallbacks.forEach(function (fn) { fn(); });
    _readyCallbacks = [];
  }

  /* ------------------------------------------------------------------ */
  /*  SDK loader                                                         */
  /* ------------------------------------------------------------------ */
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.type = 'module';
      s.src  = src;
      s.onload  = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function initFirebase() {
    /* If no config or placeholder config, run in stub mode */
    var cfg = window.FIREBASE_CONFIG || {};
    if (!cfg.apiKey || cfg.apiKey.startsWith('REPLACE')) {
      console.warn('[TutorsLink] Firebase config not set — running in stub mode.');
      _fireReady();
      return;
    }

    /* Use Firebase SDK v10 as ES modules via CDN */
    var initScript = document.createElement('script');
    initScript.type = 'module';
    initScript.textContent = [
      "import { initializeApp }       from '" + FB_SDK_BASE + "firebase-app.js';",
      "import { getAnalytics }        from '" + FB_SDK_BASE + "firebase-analytics.js';",
      "import { getAuth, onAuthStateChanged, signInWithEmailAndPassword,",
      "         createUserWithEmailAndPassword, signInWithPopup,",
      "         GoogleAuthProvider, signOut }",
      "  from '" + FB_SDK_BASE + "firebase-auth.js';",
      "import { getFirestore, collection, addDoc, serverTimestamp, getDocs, query, where, orderBy, doc, updateDoc, deleteDoc }",
      "  from '" + FB_SDK_BASE + "firebase-firestore.js';",
      "import { getFunctions, httpsCallable }",
      "  from '" + FB_SDK_BASE + "firebase-functions.js';",
      "",
      "var cfg = " + JSON.stringify(cfg) + ";",
      "var app   = initializeApp(cfg);",
      "if (cfg.measurementId) { getAnalytics(app); }",
      "var auth  = getAuth(app);",
      "var db    = getFirestore(app);",
      "var fns   = getFunctions(app);",
      "",
      "/* Expose internals to IIFE scope */",
      "window.__TLFirebase = {",
      "  auth, db, fns,",
      "  GoogleAuthProvider,",
      "  signInWithEmailAndPassword,",
      "  createUserWithEmailAndPassword,",
      "  signInWithPopup,",
      "  signOut,",
      "  onAuthStateChanged,",
      "  collection, addDoc, serverTimestamp, getDocs, query, where, orderBy,",
      "  doc, updateDoc, deleteDoc,",
      "  httpsCallable",
      "};",
      "document.dispatchEvent(new Event('tl:firebase-ready'));"
    ].join('\n');

    document.head.appendChild(initScript);

    document.addEventListener('tl:firebase-ready', function () {
      var tlf = window.__TLFirebase;
      _auth = tlf.auth;
      _db   = tlf.db;
      _fns  = tlf.fns;

      /* Auth state listener */
      tlf.onAuthStateChanged(_auth, function (user) {
        handleAuthStateChange(user);
      });

      _fireReady();
    }, { once: true });
  }

  /* ------------------------------------------------------------------ */
  /*  Auth state & role-aware UI                                        */
  /* ------------------------------------------------------------------ */
  var ROLES = { GUEST: 'guest', STUDENT: 'student', TUTOR: 'tutor', STAFF: 'staff' };
  var currentUser = null;
  var currentRole = ROLES.GUEST;

  var _roleListeners = [];
  function onRoleChange(fn) {
    _roleListeners.push(fn);
  }

  var ADMIN_EMAIL = 'tutorslink001@gmail.com';

  function handleAuthStateChange(user) {
    currentUser = user;
    if (!user) {
      currentRole = ROLES.GUEST;
      updateRoleUI(ROLES.GUEST, null);
      return;
    }

    /* Read role from custom claims (set via Firebase Admin SDK in Cloud Functions) */
    user.getIdTokenResult(true).then(function (result) {
      var claims = result.claims;
      if (claims.staff || (user.email && user.email.toLowerCase() === ADMIN_EMAIL)) {
        currentRole = ROLES.STAFF;
      } else if (claims.tutor) {
        currentRole = ROLES.TUTOR;
      } else {
        currentRole = ROLES.STUDENT;
      }
      updateRoleUI(currentRole, user);
    }).catch(function () {
      /* Fallback: still grant staff to admin email */
      currentRole = (user.email && user.email.toLowerCase() === ADMIN_EMAIL)
        ? ROLES.STAFF
        : ROLES.STUDENT;
      updateRoleUI(currentRole, user);
    });
  }

  function updateRoleUI(role, user) {
    var authBtn    = document.getElementById('tl-auth-btn');
    var authStatus = document.getElementById('tl-auth-status');
    var profileBtn = document.getElementById('tl-profile-btn');

    if (authBtn) {
      if (role === ROLES.GUEST) {
        authBtn.textContent = 'Sign In';
        authBtn.setAttribute('data-action', 'open-auth');
        authBtn.hidden = false;
      } else {
        authBtn.hidden = true;
      }
    }

    if (profileBtn) {
      if (role === ROLES.GUEST) {
        profileBtn.hidden = true;
      } else {
        var initial = user ? (user.displayName || user.email || '?').charAt(0).toUpperCase() : '?';
        profileBtn.textContent = initial;
        profileBtn.hidden = false;

        var nameEl = document.getElementById('tl-profile-name');
        var roleEl = document.getElementById('tl-profile-role');
        if (nameEl) { nameEl.textContent = user ? (user.displayName || user.email || '') : ''; }
        if (roleEl) { roleEl.textContent = role.charAt(0).toUpperCase() + role.slice(1); }
      }
    }

    if (authStatus) {
      if (role === ROLES.GUEST) {
        authStatus.textContent = '';
        authStatus.hidden = true;
      } else {
        var label = role.charAt(0).toUpperCase() + role.slice(1);
        authStatus.textContent = (user ? escHtml(user.displayName || user.email) : '') + ' (' + label + ')';
        authStatus.hidden = false;
      }
    }

    /* Show/hide role-specific elements */
    document.querySelectorAll('[data-role]').forEach(function (el) {
      var allowed = el.getAttribute('data-role').split(',').map(function (r) { return r.trim(); });
      el.style.display = (allowed.indexOf(role) !== -1 || allowed.indexOf('*') !== -1) ? '' : 'none';
    });

    /* Notify role change listeners */
    _roleListeners.forEach(function (fn) { fn(role, user); });
  }

  /* ------------------------------------------------------------------ */
  /*  Auth modal                                                         */
  /* ------------------------------------------------------------------ */
  function buildAuthModal() {
    if (document.getElementById('tl-auth-modal-overlay')) return;

    var overlay = document.createElement('div');
    overlay.id        = 'tl-auth-modal-overlay';
    overlay.className = 'tl-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'tl-auth-modal-title');

    overlay.innerHTML = [
      '<div class="tl-modal" style="max-width:420px;">',
      '  <button class="tl-modal__close" id="tl-auth-modal-close" aria-label="Close sign-in dialog">&#10005;</button>',
      '  <h2 class="tl-section__title" id="tl-auth-modal-title" style="text-align:center;margin-bottom:1.5rem;">Sign In to TutorsLink</h2>',
      '',
      '  <!-- Tab switcher -->',
      '  <div class="tl-auth-tabs" style="display:flex;gap:0.5rem;margin-bottom:1.5rem;">',
      '    <button class="tl-auth-tab active" data-tab="signin" style="flex:1;">Sign In</button>',
      '    <button class="tl-auth-tab" data-tab="signup" style="flex:1;">Create Account</button>',
      '  </div>',
      '',
      '  <!-- Email / Password form -->',
      '  <form id="tl-auth-email-form" novalidate>',
      '    <div class="tl-form-group" style="margin-bottom:0.75rem;">',
      '      <label for="tl-auth-email">Email <span class="required">*</span></label>',
      '      <input type="email" id="tl-auth-email" name="email" placeholder="you@example.com" required autocomplete="email" />',
      '    </div>',
      '    <div class="tl-form-group" style="margin-bottom:1.25rem;">',
      '      <label for="tl-auth-password">Password <span class="required">*</span></label>',
      '      <input type="password" id="tl-auth-password" name="password" placeholder="••••••••" required autocomplete="current-password" />',
      '    </div>',
      '    <div id="tl-auth-error" style="color:var(--color-pink);font-size:0.85rem;margin-bottom:0.75rem;display:none;"></div>',
      '    <button type="submit" id="tl-auth-submit" class="btn btn-primary" style="width:100%;justify-content:center;">Sign In</button>',
      '  </form>',
      '',
      '  <div style="display:flex;align-items:center;gap:0.75rem;margin:1.25rem 0;">',
      '    <hr style="flex:1;border:none;border-top:1px solid var(--color-border);" />',
      '    <span style="color:var(--color-text-muted);font-size:0.82rem;">or continue with</span>',
      '    <hr style="flex:1;border:none;border-top:1px solid var(--color-border);" />',
      '  </div>',
      '',
      '  <!-- Social sign-in buttons -->',
      '  <div style="display:flex;flex-direction:column;gap:0.6rem;">',
      '    <button class="btn btn-outline" id="tl-auth-google" style="width:100%;justify-content:center;gap:0.6rem;">',
      '      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.2l6.8-6.8C35.8 2.5 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 6.9-10.1 6.9-17z"/><path fill="#FBBC05" d="M10.6 28.6A14.6 14.6 0 0 1 9.5 24c0-1.6.3-3.1.8-4.6l-7.9-6.1A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.3 0 11.6-2.1 15.5-5.6l-7.5-5.8c-2.1 1.4-4.8 2.3-8 2.3-6.2 0-11.5-4.2-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>',
      '      Continue with Google',
      '    </button>',
      '    <button class="btn btn-outline" id="tl-auth-discord" style="width:100%;justify-content:center;gap:0.6rem;opacity:0.7;" disabled title="Discord login coming soon">',
      '      <svg width="18" height="14" viewBox="0 0 71 55" aria-hidden="true" fill="#5865F2"><path d="M60.1 4.9A58.6 58.6 0 0 0 45.5.7a40.7 40.7 0 0 0-1.8 3.7 54.1 54.1 0 0 0-16.3 0A39 39 0 0 0 25.6.7 58.5 58.5 0 0 0 10.9 4.9C1.6 18.8-.9 32.3.3 45.6a59.2 59.2 0 0 0 18 9.1 44 44 0 0 0 3.8-6.2 38.5 38.5 0 0 1-6-2.9l1.5-1.1a42.3 42.3 0 0 0 36 0l1.5 1.1a38.4 38.4 0 0 1-6 2.9 43.7 43.7 0 0 0 3.8 6.2 58.9 58.9 0 0 0 18-9.1C72.2 30 69.1 16.6 60.1 4.9zM23.7 37.3c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.5 0 6.4 3.2 6.4 7.2s-2.9 7.2-6.4 7.2zm23.5 0c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.5 0 6.4 3.2 6.4 7.2s-2.9 7.2-6.4 7.2z"/></svg>',
      '      Discord (Coming Soon)',
      '    </button>',
      '  </div>',
      '</div>',
      '</div>'
    ].join('\n');

    document.body.appendChild(overlay);

    /* Wire close */
    document.getElementById('tl-auth-modal-close').addEventListener('click', closeAuthModal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeAuthModal();
    });

    /* ESC key closes auth modal */
    document.addEventListener('keydown', function onAuthEsc(e) {
      if (e.key === 'Escape') closeAuthModal();
    });

    /* Tab switching */
    overlay.querySelectorAll('.tl-auth-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        overlay.querySelectorAll('.tl-auth-tab').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        var isSignup = (tab.dataset.tab === 'signup');
        document.getElementById('tl-auth-submit').textContent = isSignup ? 'Create Account' : 'Sign In';
        var pwdInput = document.getElementById('tl-auth-password');
        pwdInput.setAttribute('autocomplete', isSignup ? 'new-password' : 'current-password');
        document.getElementById('tl-auth-error').style.display = 'none';
      });
    });

    /* Email/Password form submit */
    document.getElementById('tl-auth-email-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var email    = document.getElementById('tl-auth-email').value.trim();
      var password = document.getElementById('tl-auth-password').value;
      var errEl    = document.getElementById('tl-auth-error');
      var isSignup = (document.querySelector('.tl-auth-tab.active').dataset.tab === 'signup');

      errEl.style.display = 'none';
      if (!email || !password) { showAuthError('Please fill in all fields.'); return; }

      var tlf = window.__TLFirebase;
      if (!tlf) { showAuthError('Auth not available — please check Firebase config.'); return; }

      var action = isSignup
        ? tlf.createUserWithEmailAndPassword(_auth, email, password)
        : tlf.signInWithEmailAndPassword(_auth, email, password);

      action
        .then(function () { closeAuthModal(); showToast('✅ Signed in successfully!', 'success'); })
        .catch(function (err) { showAuthError(friendlyAuthError(err.code)); });
    });

    /* Google sign-in */
    document.getElementById('tl-auth-google').addEventListener('click', function () {
      var tlf = window.__TLFirebase;
      if (!tlf) { showAuthError('Auth not available — please check Firebase config.'); return; }
      var provider = new tlf.GoogleAuthProvider();
      tlf.signInWithPopup(_auth, provider)
        .then(function () { closeAuthModal(); showToast('✅ Signed in with Google!', 'success'); })
        .catch(function (err) { showAuthError(friendlyAuthError(err.code)); });
    });
  }

  function openAuthModal() {
    buildAuthModal();
    var overlay = document.getElementById('tl-auth-modal-overlay');
    if (overlay) overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeAuthModal() {
    var overlay = document.getElementById('tl-auth-modal-overlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  function showAuthError(msg) {
    var errEl = document.getElementById('tl-auth-error');
    if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
  }

  function friendlyAuthError(code) {
    var map = {
      'auth/invalid-email':            'Invalid email address.',
      'auth/user-not-found':           'No account found with that email.',
      'auth/wrong-password':           'Incorrect password.',
      'auth/email-already-in-use':     'An account with that email already exists.',
      'auth/weak-password':            'Password must be at least 6 characters.',
      'auth/too-many-requests':        'Too many attempts. Please try again later.',
      'auth/popup-closed-by-user':     'Sign-in popup was closed.',
      'auth/network-request-failed':   'Network error — please check your connection.'
    };
    return map[code] || 'An error occurred. Please try again.';
  }

  /* ------------------------------------------------------------------ */
  /*  Cloud Function wrappers (stub if Firebase not configured)         */
  /* ------------------------------------------------------------------ */

  /**
   * Submit a tutor application to Firestore / Cloud Function.
   * @param {Object} data  Form data fields
   * @returns {Promise}
   */
function submitTutorApplication(data) {
  var tlf = window.__TLFirebase;
  if (tlf && _db) {
    // Instead of calling a function, we save directly to the 'tutorApplications' collection
    return tlf.addDoc(tlf.collection(_db, 'tutorApplications'), {
      ...data,
      submittedAt: tlf.serverTimestamp(),
      status: 'pending'
    });
  }
  console.info('[Stub] submitTutorApplication', data);
  return Promise.resolve();
}

  /**
   * Send a support chat message to Firestore / Cloud Function.
   * @param {string} message   User message text
   * @param {string} sessionId Chat session ID
   * @returns {Promise}
   */
  function createSupportChatMessage(message, sessionId) {
    var tlf = window.__TLFirebase;
    if (tlf && _fns) {
      var fn = tlf.httpsCallable(_fns, 'createSupportChatMessage');
      return fn({ message: message, sessionId: sessionId });
    }
    console.info('[TutorsLink stub] createSupportChatMessage', { message: message, sessionId: sessionId });
    return Promise.resolve({ data: { success: true, stub: true } });
  }

  /**
   * Book a demo class with a tutor.
   * @param {number|string} tutorId  Tutor ID
   * @param {Object}        meta     Optional additional metadata
   * @returns {Promise}
   */
  function bookDemoClass(tutorId, meta) {
    var tlf = window.__TLFirebase;
    if (tlf && _fns) {
      var fn = tlf.httpsCallable(_fns, 'bookDemoClass');
      return fn({ tutorId: tutorId, meta: meta || {} });
    }
    console.info('[TutorsLink stub] bookDemoClass', { tutorId: tutorId, meta: meta });
    return Promise.resolve({ data: { success: true, stub: true } });
  }

  /* ------------------------------------------------------------------ */
  /*  Staff: list pending tutor applications                            */
  /* ------------------------------------------------------------------ */
  function listPendingApplications() {
    var tlf = window.__TLFirebase;
    if (tlf && _db) {
      var q = tlf.query(
        tlf.collection(_db, 'tutorApplications'),
        tlf.where('status', '==', 'pending'),
        tlf.orderBy('submittedAt', 'desc')
      );
      return tlf.getDocs(q).then(function (snap) {
        var results = [];
        snap.forEach(function (doc) {
          results.push(Object.assign({ id: doc.id }, doc.data()));
        });
        return results;
      });
    }
    console.info('[TutorsLink stub] listPendingApplications');
    return Promise.resolve([]);
  }

  /**
   * Approve a tutor application (staff only).
   * @param {string} uid            The applicant's Firebase UID
   * @param {string} applicationId  The Firestore application document ID
   * @returns {Promise}
   */
  function approveTutorApplication(uid, applicationId) {
    var tlf = window.__TLFirebase;
    if (tlf && _fns) {
      var fn = tlf.httpsCallable(_fns, 'approveTutorApplication');
      return fn({ uid: uid, applicationId: applicationId });
    }
    console.info('[TutorsLink stub] approveTutorApplication', { uid: uid, applicationId: applicationId });
    return Promise.resolve({ data: { success: true, stub: true } });
  }

  /* ------------------------------------------------------------------ */
  /*  Ads: list, create, update, archive                                */
  /* ------------------------------------------------------------------ */

  /**
   * List ads from Firestore.
   * @param {boolean} [includeArchived=false]  When true, returns all ads regardless of status.
   * @returns {Promise<Array>}
   */
  function listAds(includeArchived) {
    var tlf = window.__TLFirebase;
    if (tlf && _db) {
      var q = includeArchived
        ? tlf.query(tlf.collection(_db, 'ads'), tlf.orderBy('createdAt', 'desc'))
        : tlf.query(
            tlf.collection(_db, 'ads'),
            tlf.where('status', '==', 'active'),
            tlf.orderBy('createdAt', 'desc')
          );
      return tlf.getDocs(q).then(function (snap) {
        var results = [];
        snap.forEach(function (d) {
          results.push(Object.assign({ id: d.id }, d.data()));
        });
        return results;
      });
    }
    console.info('[TutorsLink stub] listAds');
    return Promise.resolve([]);
  }

  /**
   * Create a new ad (staff only).
   * @param {{title: string, body: string}} data
   * @returns {Promise}
   */
  function createAd(data) {
    var tlf = window.__TLFirebase;
    if (tlf && _db) {
      return tlf.addDoc(tlf.collection(_db, 'ads'), {
        title:     String(data.title  || '').trim(),
        body:      String(data.body   || '').trim(),
        source:    'website',
        status:    'active',
        createdBy: currentUser ? currentUser.uid : null,
        createdAt: tlf.serverTimestamp(),
        updatedAt: tlf.serverTimestamp()
      });
    }
    console.info('[TutorsLink stub] createAd', data);
    return Promise.resolve({ id: 'stub-' + Date.now() });
  }

  /**
   * Update an existing ad (staff only).
   * @param {string} id   Firestore document ID
   * @param {{title?: string, body?: string, status?: string}} data
   * @returns {Promise}
   */
  function updateAd(id, data) {
    var tlf = window.__TLFirebase;
    if (tlf && _db) {
      var patch = { updatedAt: tlf.serverTimestamp() };
      if (data.title  !== undefined) { patch.title  = String(data.title).trim(); }
      if (data.body   !== undefined) { patch.body   = String(data.body).trim();  }
      if (data.status !== undefined) { patch.status = String(data.status);       }
      return tlf.updateDoc(tlf.doc(_db, 'ads', id), patch);
    }
    console.info('[TutorsLink stub] updateAd', id, data);
    return Promise.resolve();
  }

  /**
   * Archive an ad (soft-delete, staff only).
   * @param {string} id  Firestore document ID
   * @returns {Promise}
   */
  function archiveAd(id) {
    var tlf = window.__TLFirebase;
    if (tlf && _db) {
      return tlf.updateDoc(tlf.doc(_db, 'ads', id), {
        status:    'archived',
        updatedAt: tlf.serverTimestamp()
      });
    }
    console.info('[TutorsLink stub] archiveAd', id);
    return Promise.resolve();
  }

  /* ------------------------------------------------------------------ */
  /*  Toast helper                                                       */
  /* ------------------------------------------------------------------ */
  function showToast(msg, type) {
    var toast = document.getElementById('tl-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className   = 'tl-toast tl-toast--' + (type || 'success') + ' show';
    setTimeout(function () { toast.classList.remove('show'); }, 4000);
  }

  /* ------------------------------------------------------------------ */
  /*  Utility                                                            */
  /* ------------------------------------------------------------------ */
  function escHtml(str) {
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

  /* ------------------------------------------------------------------ */
  /*  Inject auth button into nav (if not already present in HTML)      */
  /* ------------------------------------------------------------------ */
  function injectNavAuthButton() {
    var cta = document.querySelector('.tl-nav__cta');
    if (!cta || document.getElementById('tl-auth-btn')) return;

    var btn = document.createElement('button');
    btn.id        = 'tl-auth-btn';
    btn.className = 'btn btn-outline';
    btn.style.cssText = 'font-size:0.82rem;padding:0.4rem 1rem;';
    btn.textContent = 'Sign In';
    btn.setAttribute('data-action', 'open-auth');
    btn.setAttribute('aria-label', 'Sign in to TutorsLink');

    /* Profile icon — visible when signed in */
    var profileBtn = document.createElement('button');
    profileBtn.id        = 'tl-profile-btn';
    profileBtn.className = 'tl-profile-icon';
    profileBtn.hidden    = true;
    profileBtn.setAttribute('aria-label', 'Your profile');
    profileBtn.setAttribute('title', 'Your profile');
    profileBtn.textContent = '?';

    /* Dropdown menu for profile actions */
    var dropdown = document.createElement('div');
    dropdown.id        = 'tl-profile-dropdown';
    dropdown.className = 'tl-profile-dropdown';
    dropdown.hidden    = true;
    dropdown.innerHTML = [
      '<div class="tl-profile-dropdown__name" id="tl-profile-name"></div>',
      '<div class="tl-profile-dropdown__role" id="tl-profile-role"></div>',
      '<hr class="tl-profile-dropdown__divider" />',
      '<button class="tl-profile-dropdown__item" id="tl-profile-signout">Sign Out</button>'
    ].join('');

    var profileWrap = document.createElement('div');
    profileWrap.style.cssText = 'position:relative;display:inline-flex;align-items:center;';
    profileWrap.appendChild(profileBtn);
    profileWrap.appendChild(dropdown);

    var status = document.createElement('span');
    status.id     = 'tl-auth-status';
    status.hidden = true;
    status.style.cssText = 'font-size:0.78rem;color:var(--color-text-muted);white-space:nowrap;';

    cta.insertBefore(status, cta.firstChild);
    cta.insertBefore(profileWrap, cta.firstChild);
    cta.insertBefore(btn,    cta.firstChild);

    btn.addEventListener('click', function () {
      if (btn.getAttribute('data-action') === 'sign-out') {
        _doSignOut();
      } else {
        openAuthModal();
      }
    });

    profileBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      dropdown.hidden = !dropdown.hidden;
    });

    /* Close dropdown when clicking outside — use capture to catch all clicks */
    document.addEventListener('click', function onDocClick(e) {
      if (!profileWrap.contains(e.target)) {
        dropdown.hidden = true;
      }
    }, true);

    dropdown.addEventListener('click', function (e) {
      if (e.target && e.target.id === 'tl-profile-signout') {
        _doSignOut();
        dropdown.hidden = true;
      }
    });
  }

  function _doSignOut() {
    var tlf = window.__TLFirebase;
    if (tlf && _auth) {
      tlf.signOut(_auth).then(function () {
        showToast('You have been signed out.', 'success');
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Auth tab button styling (minimal inline styles)                   */
  /* ------------------------------------------------------------------ */
  function injectAuthTabStyles() {
    if (document.getElementById('tl-auth-tab-style')) return;
    var style = document.createElement('style');
    style.id   = 'tl-auth-tab-style';
    style.textContent = [
      '.tl-auth-tab{background:rgba(255,255,255,0.04);border:1px solid var(--color-border);',
      'color:var(--color-text-muted);border-radius:8px;padding:0.5rem 1rem;cursor:pointer;',
      'font-size:0.88rem;font-weight:600;transition:all var(--transition);}',
      '.tl-auth-tab:hover{border-color:var(--color-yellow);color:var(--color-yellow);}',
      '.tl-auth-tab.active{background:var(--color-yellow);color:#000;border-color:var(--color-yellow);}',
      '.tl-profile-icon{width:34px;height:34px;border-radius:50%;background:var(--color-yellow);',
      'color:#000;font-weight:700;font-size:0.95rem;border:none;cursor:pointer;',
      'display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
      '.tl-profile-icon:hover{opacity:0.85;}',
      '.tl-profile-dropdown{position:absolute;top:calc(100% + 8px);right:0;',
      'background:var(--color-surface);border:1px solid var(--color-border);',
      'border-radius:10px;padding:0.75rem;min-width:180px;z-index:9999;',
      'box-shadow:0 8px 24px rgba(0,0,0,0.4);}',
      '.tl-profile-dropdown__name{font-weight:600;font-size:0.88rem;color:var(--color-text);',
      'word-break:break-all;margin-bottom:0.2rem;}',
      '.tl-profile-dropdown__role{font-size:0.78rem;color:var(--color-yellow);margin-bottom:0.5rem;}',
      '.tl-profile-dropdown__divider{border:none;border-top:1px solid var(--color-border);margin:0.5rem 0;}',
      '.tl-profile-dropdown__item{background:none;border:none;color:var(--color-text-muted);',
      'font-size:0.85rem;cursor:pointer;padding:0.3rem 0;width:100%;text-align:left;}',
      '.tl-profile-dropdown__item:hover{color:var(--color-yellow);}'
    ].join('');
    document.head.appendChild(style);
  }

  /* ------------------------------------------------------------------ */
  /*  Init                                                               */
  /* ------------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', function () {
    injectAuthTabStyles();
    injectNavAuthButton();

    /* Load Firebase config script if it exists, then init */
    var cfgScript = document.createElement('script');
    cfgScript.src = 'assets/js/firebase-config.js';
    cfgScript.onload  = function () { initFirebase(); };
    cfgScript.onerror = function () {
      console.warn('[TutorsLink] firebase-config.js not found — running in stub mode.');
      _fireReady();
    };
    document.head.appendChild(cfgScript);
  });

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */
  window.TLFunctions = {
    submitTutorApplication: submitTutorApplication,
    createSupportChatMessage: createSupportChatMessage,
    bookDemoClass: bookDemoClass,
    approveTutorApplication: approveTutorApplication,
    listPendingApplications: listPendingApplications,
    listAds: listAds,
    createAd: createAd,
    updateAd: updateAd,
    archiveAd: archiveAd,
    openAuthModal: openAuthModal,
    closeAuthModal: closeAuthModal,
    showToast: showToast,
    onReady: onReady,
    onRoleChange: onRoleChange,
    getUser: function () { return currentUser; },
    getRole: function () { return currentRole; }
  };

}());
