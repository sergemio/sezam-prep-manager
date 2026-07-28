// Shared user/staff session — the ONE source of truth for "who is logged in".
// Loaded by index.html (Prep Manager) and ic-inventory.html (I&C) BEFORE their
// module scripts, so both behave identically: same persisted identity, same
// switch toast, same default list. Replaces the per-module copies that had
// drifted (I&C never persisted the user and never showed the switch toast).
//
// window.UserSession:
//   .get()               -> current staff name ('' if none)
//   .set(name, opts)     -> set + persist + notify labels + toast (opts.toast:false to skip)
//   .restore()           -> load persisted name, notify labels, NO toast (boot path)
//   .clear()             -> reset to '' (a "switch user" logout — no toast)
//   .subscribe(cb)       -> cb(name) called on every change (keep a local mirror in sync)
//   .showSwitchToast(name)
//   .DEFAULT_STAFF, .STORAGE_KEY
//
// The .user-switch-toast CSS already lives in styles.css, which BOTH pages load.
(function (global) {
  'use strict';

  var STORAGE_KEY = 'currentStaff';
  // Fallback list only used if Firebase is unreachable. 'Serge M' matches the
  // Firebase staffMembers record (id 1) — the canonical spelling.
  var DEFAULT_STAFF = ['Serge M', 'Tatiana', 'Nadine', 'Nicolas', 'Omar'];

  var current = '';
  var subscribers = [];

  function setLabel(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val; // guarded: db-editor may not have these
  }

  function notify() {
    setLabel('current-user', current);
    setLabel('header-user-name', current);
    for (var i = 0; i < subscribers.length; i++) {
      try { subscribers[i](current); } catch (e) { /* one bad subscriber must not break the rest */ }
    }
  }

  function get() { return current; }

  function set(name, opts) {
    opts = opts || {};
    current = name || '';
    if (current) {
      try { localStorage.setItem(STORAGE_KEY, current); } catch (e) {}
    }
    notify();
    if (current && opts.toast !== false) showSwitchToast(current);
    return current;
  }

  function restore() {
    var saved = '';
    try { saved = localStorage.getItem(STORAGE_KEY) || ''; } catch (e) {}
    current = saved;
    notify();
    return current;
  }

  function clear() {
    // A "switch user" reset (logout) — deliberately silent (PM never toasted this either).
    current = '';
    notify();
  }

  function subscribe(cb) {
    if (typeof cb === 'function') {
      subscribers.push(cb);
      try { cb(current); } catch (e) {} // fire once with the current value
    }
  }

  // The ONE staff loader (was duplicated in both modules with drifting branches).
  // Fetches active staff names from Firebase; falls back to DEFAULT_STAFF on ANY
  // miss — no firebaseDb, empty result, no active member, or error. Always
  // resolves to a non-empty string[] so callers never special-case failure.
  // Side effect: caches the raw records on window.staffMembers (dropdowns read it).
  function loadStaff() {
    var db = window.firebaseDb;
    if (!(db && db.loadStaffMembers)) return Promise.resolve(DEFAULT_STAFF.slice());
    return db.loadStaffMembers().then(function (rows) {
      window.staffMembers = rows || [];
      var active = (rows || [])
        .filter(function (s) { return s && s.active; })
        .map(function (s) { return s.name; });
      return active.length ? active : DEFAULT_STAFF.slice();
    }).catch(function (e) {
      console.error('Error loading staff members:', e);
      return DEFAULT_STAFF.slice();
    });
  }

  // Centered magenta pill dropping from the top — the single implementation of
  // the user-switch confirmation, shared by both modules.
  function showSwitchToast(name) {
    if (!name) return;
    var existing = document.querySelector('.user-switch-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'user-switch-toast';
    toast.innerHTML = '<span class="toast-initials">' + initials(name) + '</span>' +
                      '<span class="toast-name">' + name + '</span>';
    document.body.appendChild(toast);

    requestAnimationFrame(function () { toast.classList.add('show'); });

    setTimeout(function () {
      toast.classList.add('hide');
      toast.classList.remove('show');
      setTimeout(function () { if (toast.parentNode) toast.remove(); }, 300);
    }, 1500);
  }

  global.UserSession = {
    get: get,
    set: set,
    restore: restore,
    clear: clear,
    subscribe: subscribe,
    loadStaff: loadStaff,
    showSwitchToast: showSwitchToast,
    DEFAULT_STAFF: DEFAULT_STAFF,
    STORAGE_KEY: STORAGE_KEY
  };
})(window);
