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
//   .staffNames()        -> string[] active staff, synchronous, NEVER empty
//   .pick({title, subtitle}) -> Promise<name|''> — THE staff picker modal, sets the session
//   .renderGate(grid, onPick) -> fills the login screen's .staff-grid
//   .dropdown(anchor, onPick) -> THE user dropdown under `anchor` (toggles/closes itself)
//   .showSwitchToast(name)
//
// The three "tap a name" surfaces (gate / dropdown / modal) all live here now.
//   .DEFAULT_STAFF, .STORAGE_KEY
//
// Requires ui-helpers.js (openModal, initials) — both pages load it BEFORE this file.
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
  // Last known active-staff names. Filled by EVERY loadStaff() branch, including
  // the fallbacks — the dropdowns used to read window.staffMembers directly,
  // which is only set when Firebase answers, so an outage left them empty and
  // you could no longer switch user at all.
  var cachedNames = [];

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
    if (!(db && db.loadStaffMembers)) return Promise.resolve(remember(DEFAULT_STAFF.slice()));
    return db.loadStaffMembers().then(function (rows) {
      window.staffMembers = rows || [];
      var active = (rows || [])
        .filter(function (s) { return s && s.active; })
        .map(function (s) { return s.name; });
      return remember(active.length ? active : DEFAULT_STAFF.slice());
    }).catch(function (e) {
      console.error('Error loading staff members:', e);
      return remember(DEFAULT_STAFF.slice());
    });
  }

  function remember(names) { cachedNames = names; return names; }

  // Synchronous read of the staff list, for callers that cannot await (the
  // dropdowns open on click). Never empty: falls back to DEFAULT_STAFF.
  function staffNames() {
    return cachedNames.length ? cachedNames.slice() : DEFAULT_STAFF.slice();
  }

  // The ONE staff picker. Both modules used to build their own: the prep-check
  // one with .staff-select-button markup, the I&C one with buttons styled inline
  // in JS (colours hardcoded, so a theme change would have skipped it). Same
  // question, same source, same destination — one component, one parameter.
  //
  // One tap = chosen (the I&C behaviour; the prep-check "select then Continue"
  // extra step bought nothing). The current user is marked so you can confirm at
  // a glance. Sets the session itself, and resolves to the chosen name, or ''
  // when the user backs out (Cancel, Escape, backdrop click).
  function pick(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var settled = false;
      var settle = function (name) { if (!settled) { settled = true; resolve(name || ''); } };
      var modal = window.openModal({ onClose: function () { settle(''); } });
      var box = modal.box;

      var header = document.createElement('div');
      header.className = 'modal-header';
      header.innerHTML =
        '<h3 class="staff-picker__title">' + (opts.title || 'Who is working?') + '</h3>' +
        (opts.subtitle ? '<p class="staff-picker__subtitle">' + opts.subtitle + '</p>' : '');

      var list = document.createElement('div');
      list.className = 'staff-container';
      list.innerHTML = '<div class="staff-picker__loading">Loading staff members…</div>';

      var actions = document.createElement('div');
      actions.className = 'btn-group';
      var cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'Cancel';
      cancel.className = 'btn btn--secondary staff-picker__cancel';
      cancel.addEventListener('click', function () { settle(''); modal.close(); });
      actions.appendChild(cancel);

      box.appendChild(header);
      box.appendChild(list);
      box.appendChild(actions);

      loadStaff().then(function (names) {
        list.innerHTML = '';
        if (!names.length) {
          list.innerHTML = '<div class="staff-picker__loading">No active staff members found.</div>';
          return;
        }
        names.forEach(function (name) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'staff-select-button' + (name === current ? ' selected' : '');
          btn.setAttribute('data-staff', name);
          btn.innerHTML =
            '<span class="staff-initial">' + initials(name) + '</span>' +
            '<span class="staff-name">' + name + '</span>' +
            '<span class="staff-check">✓</span>';
          btn.addEventListener('click', function () {
            set(name, opts.toast === false ? { toast: false } : undefined);
            settle(name);
            modal.close();
          });
          list.appendChild(btn);
        });
      });
    });
  }

  // THE login gate. Both modules built their own `.staff-grid` of `.staff-button`
  // (the I&C one styled its loading line inline in JS, the PM one carried a dead
  // "no active staff" branch — loadStaff never resolves empty).
  function renderGate(grid, onPick) {
    if (!grid) return Promise.resolve();
    grid.innerHTML = '<div class="loading-staff">Loading staff members…</div>';
    return loadStaff().then(function (names) {
      grid.innerHTML = '';
      names.forEach(function (name) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'staff-button';
        button.setAttribute('data-staff', name);
        button.textContent = name;
        button.addEventListener('click', function () {
          set(name);
          if (typeof onPick === 'function') onPick(name);
        });
        grid.appendChild(button);
      });
    });
  }

  // THE user dropdown, anchored under `anchor`. Was written three times (PM
  // header, PM modal, I&C header) with three z-indexes and two of them styling
  // the panel inline. Reads staffNames(), so it still lists everyone when
  // Firebase is down — the old copies read the raw cache and showed nothing.
  function dropdown(anchor, onPick) {
    var existing = document.getElementById('user-dropdown');
    if (existing) { existing.remove(); return null; }
    if (!anchor) return null;

    var rect = anchor.getBoundingClientRect();
    var menu = document.createElement('div');
    menu.id = 'user-dropdown';
    menu.className = 'user-dropdown-menu';
    menu.style.top = (rect.bottom + 6) + 'px';
    menu.style.left = rect.left + 'px';

    staffNames().forEach(function (name) {
      var item = document.createElement('div');
      item.textContent = name;
      item.className = 'dropdown-item' + (name === current ? ' active' : '');
      item.addEventListener('click', function (ev) {
        ev.stopPropagation();
        set(name);
        menu.remove();
        if (typeof onPick === 'function') onPick(name);
      });
      menu.appendChild(item);
    });

    document.body.appendChild(menu);
    requestAnimationFrame(function () { menu.classList.add('show'); });

    // Outside-click closes, and the listener removes itself — the old copies
    // each registered their own and one of them never cleaned it up.
    var closeHandler = function (ev) {
      if (!menu.contains(ev.target) && ev.target !== anchor && !anchor.contains(ev.target)) {
        menu.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(function () { document.addEventListener('click', closeHandler); }, 0);
    return menu;
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
    staffNames: staffNames,
    pick: pick,
    renderGate: renderGate,
    dropdown: dropdown,
    showSwitchToast: showSwitchToast,
    DEFAULT_STAFF: DEFAULT_STAFF,
    STORAGE_KEY: STORAGE_KEY
  };
})(window);
