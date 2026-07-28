// Shared UI helpers (2026-07-18) — unified level colour + confirm dialog.
// Defined globally; wired page-by-page in Phase 3. No behaviour changes on load.
(function (global) {
  'use strict';

  // The ONE stock-level colour function. Byte-identical to the existing inline
  // formula (was duplicated in ic-inventory-app.js) so behaviour is preserved:
  //   red(0%) -> orange(25%) -> yellow(50%) -> green(100%)
  function levelColor(pct) {
    var p = Math.min(Math.max(Number(pct) || 0, 0), 100);
    var hue = Math.min(p, 100) * 1.2; // 0=red, 60=yellow, 120=green
    var sat = p < 50 ? 80 : 55;
    var light = p < 50 ? 48 : 40;
    return 'hsl(' + hue + ', ' + sat + '%, ' + light + '%)';
  }

  // Matching text colour for a filled level bar (unchanged from current logic).
  function levelTextColor(pct) {
    return (Number(pct) || 0) > 55 ? 'white' : '#333';
  }

  // Lowercase + strip diacritics, so a search for "congele" matches "Congelé".
  function deburr(s) {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  // confirmDialog({title, message, confirmText, cancelText, danger}) -> Promise<boolean>
  // One branded confirm replacing native confirm() and history.js's custom box.
  function confirmDialog(opts) {
    opts = opts || {};
    var title = opts.title || 'Are you sure?';
    var message = opts.message || '';
    var confirmText = opts.confirmText || 'Delete';
    var cancelText = opts.cancelText || 'Cancel';
    var danger = opts.danger !== false; // default danger

    return new Promise(function (resolve) {
      var backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';

      var box = document.createElement('div');
      box.className = 'modal-box modal-box--narrow';

      var heading = document.createElement('h2');
      heading.className = 'modal-title';
      heading.textContent = title;
      box.appendChild(heading);

      if (message) {
        var msg = document.createElement('p');
        msg.textContent = message;
        msg.style.cssText = 'margin:0 0 20px; color: var(--text-medium); font-size: var(--fs-body);';
        box.appendChild(msg);
      }

      var foot = document.createElement('div');
      foot.style.cssText = 'display:flex; gap:12px; justify-content:flex-end;';

      var cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn--secondary';
      cancelBtn.textContent = cancelText;

      var okBtn = document.createElement('button');
      okBtn.className = 'btn ' + (danger ? 'btn--danger' : 'btn--primary');
      okBtn.textContent = confirmText;

      foot.appendChild(cancelBtn);
      foot.appendChild(okBtn);
      box.appendChild(foot);
      backdrop.appendChild(box);
      document.body.appendChild(backdrop);

      if (global.SoundFX && global.SoundFX.pop) {
        try { global.SoundFX.pop(); } catch (e) {}
      }

      function close(result) {
        backdrop.remove();
        document.removeEventListener('keydown', onKey);
        resolve(result);
      }
      function onKey(e) {
        if (e.key === 'Escape') close(false);
        else if (e.key === 'Enter') close(true);
      }
      cancelBtn.addEventListener('click', function () { close(false); });
      okBtn.addEventListener('click', function () { close(true); });
      backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(false); });
      document.addEventListener('keydown', onKey);
      okBtn.focus();
    });
  }

  // openModal — the ONE modal scaffold (was hand-built ~11× across both modules).
  // Creates the `.modal-backdrop` + `.modal-box`, mounts optional body content,
  // and wires the universal close paths: click on the backdrop, and Escape.
  // Returns {backdrop, box, close}. `close()` is idempotent; `onClose` runs just
  // before teardown (use it for the slider-destroy case). Deliberately does NOT
  // play a sound or add buttons — each caller builds its own body/footer.
  //   openModal({ body?, boxClass?, onClose? }) -> { backdrop, box, close }
  function openModal(opts) {
    opts = opts || {};
    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    var box = document.createElement('div');
    box.className = 'modal-box' + (opts.boxClass ? ' ' + opts.boxClass : '');
    if (opts.body instanceof Node) box.appendChild(opts.body);
    else if (typeof opts.body === 'string') box.innerHTML = opts.body;
    backdrop.appendChild(box);
    document.body.appendChild(backdrop);

    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      if (typeof opts.onClose === 'function') { try { opts.onClose(); } catch (e) {} }
      document.removeEventListener('keydown', onKey);
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', onKey);

    return { backdrop: backdrop, box: box, close: close };
  }

  // ---------------------------------------------------------------------------
  // I&C categories — the ONE closed vocabulary (multi-tag field `categories[]`).
  // Replaces the old free-text `sublocation`. Nature + état + non-alimentaire,
  // stored flat in one array (e.g. bœuf congelé = ["Viande","Congelé"]).
  // Editing this list is the only way to add/rename a tag → no more drift.
  var IC_CATEGORIES = {
    nature:  ['Viande', 'Fromage', 'Fruit&Légume', 'Boisson', 'Épice', 'Sauce/Condiment', 'Épicerie sèche', 'Pain/Pâte'],
    etat:    ['Congelé', 'Frais', 'Sec/Ambiant'],
    nonalim: ['Packaging', 'Consommable/Papeterie', 'Entretien/Hygiène']
  };
  IC_CATEGORIES.all = IC_CATEGORIES.nature.concat(IC_CATEGORIES.etat, IC_CATEGORIES.nonalim);

  function categoryGroup(cat) {
    if (IC_CATEGORIES.etat.indexOf(cat) !== -1) return 'etat';
    if (IC_CATEGORIES.nonalim.indexOf(cat) !== -1) return 'nonalim';
    return 'nature';
  }

  // Light-theme pill colours {bg, border, text}. État tags get distinct hues
  // (they double as storage filters); nature = green; non-alim = purple.
  function categoryColors(cat) {
    switch (cat) {
      case 'Congelé':     return { bg: '#e3f0fb', border: '#90caf9', text: '#1565c0' };
      case 'Frais':       return { bg: '#e0f2f1', border: '#80cbc4', text: '#00796b' };
      case 'Sec/Ambiant': return { bg: '#f3ecdd', border: '#e0cfa6', text: '#8a6d2f' };
    }
    if (categoryGroup(cat) === 'nonalim') return { bg: '#ede7f6', border: '#b39ddb', text: '#5e35b1' };
    return { bg: '#e8f5e9', border: '#a5d6a7', text: '#2e7d32' }; // nature
  }

  // Inline style for one pill. `on` toggles selected vs muted (for the editor).
  function categoryStyle(cat, on) {
    var c = categoryColors(cat);
    var base = 'display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:9999px;font-size:13px;line-height:1.3;white-space:nowrap;';
    if (on === false) return base + 'background:transparent;border:1px solid #d0d5db;color:#9aa3ad;cursor:pointer;';
    return base + 'background:' + c.bg + ';border:1px solid ' + c.border + ';color:' + c.text + ';';
  }

  // Reusable interactive category editor: fills `container` with togglable
  // chips (the whole closed vocabulary) and returns { get() } → selected tags.
  // Used by the in-app add/edit modals so the chip logic lives in one place.
  function buildCategoryChipEditor(container, initial) {
    var selected = (initial || []).filter(function (c) { return IC_CATEGORIES.all.indexOf(c) !== -1; });
    container.style.display = 'flex';
    container.style.flexWrap = 'wrap';
    container.style.gap = '6px';
    function draw() {
      container.innerHTML = '';
      ['nature', 'etat', 'nonalim'].forEach(function (grp) {
        IC_CATEGORIES[grp].forEach(function (cat) {
          var on = selected.indexOf(cat) !== -1;
          var chip = document.createElement('span');
          chip.textContent = cat;
          // Touch target >=44px (override categoryStyle's compact base padding)
          chip.style.cssText = categoryStyle(cat, on) + 'cursor:pointer;min-height:44px;padding:7px 15px;font-size:14px;';
          chip.addEventListener('click', function () {
            var i = selected.indexOf(cat);
            if (i === -1) selected.push(cat); else selected.splice(i, 1);
            draw();
          });
          container.appendChild(chip);
        });
      });
    }
    draw();
    return { get: function () { return selected.slice(); } };
  }

  // ---------------------------------------------------------------------------
  // Unified STATUS vocabulary (Batch 2) — the ONE set of stock/prep states,
  // shared by both modules so "stock à zéro" reads the same everywhere.
  //   out     = red    (rupture réelle : replaces EMPTY / OUT OF STOCK)
  //   low     = amber  (sous seuil : replaces LOW / CRITICAL / GETTING LOW)
  //   blocked = red    (prep bloquée : replaces Can't Prep)
  // Colour = severity only (red = problème, amber = attention). The label
  // distinguishes OUT from Blocked.
  var IC_STATUS = {
    out:     { label: 'OUT',     bg: '#fdeaea', border: '#f3b1b1', text: '#c0392b' },
    low:     { label: 'LOW',     bg: '#fdf1d6', border: '#eecf83', text: '#8a6100' },
    blocked: { label: "Can't prep", bg: '#fdeaea', border: '#f3b1b1', text: '#c0392b' }
  };

  function statusBadgeHTML(kind) {
    var s = IC_STATUS[kind];
    if (!s) return '';
    return '<span style="display:inline-block;font-size:12px;font-weight:800;letter-spacing:.3px;' +
      'text-transform:uppercase;padding:3px 11px;border-radius:9999px;background:' + s.bg +
      ';border:1px solid ' + s.border + ';color:' + s.text + ';">' + s.label + '</span>';
  }

  // Read-only badge row for display on cards / tables.
  function categoryBadgesHTML(cats) {
    if (!cats || !cats.length) return '';
    return cats.map(function (c) {
      return '<span style="' + categoryStyle(c, true) + 'padding:2px 9px;font-size:12px;">' + c + '</span>';
    }).join(' ');
  }

  // The ONE date formatter: "9 Mar, 14:30" (day-first, English month).
  // Was duplicated and DIVERGENT — PM rendered "9 Mar", I&C "Mar 9" for the
  // same timestamp. Day-first wins (matches PM). 'Never'/empty -> "Never".
  function formatDate(dateString) {
    if (!dateString || dateString === 'Never') return 'Never';
    var date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var hh = String(date.getHours()).padStart(2, '0');
    var mm = String(date.getMinutes()).padStart(2, '0');
    return date.getDate() + ' ' + months[date.getMonth()] + ', ' + hh + ':' + mm;
  }

  // Initials from a name: "Serge M" -> "SM", "Tatiana" -> "T". Max 2 letters.
  // Was inlined (name.split(' ').map(w=>w[0])...) in ~6 places.
  function initials(name) {
    return (name || '').trim().split(/\s+/).filter(Boolean)
      .map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase();
  }

  // makeSaver — ONE persistence routine for both modules (was twin saveData).
  // Writes a localStorage backup, then either the single changed item
  // (concurrent-safe: a full-array write from one device silently overwrites
  // edits made on another) or the whole array. opts abstracts the only real
  // differences between the copies:
  //   key      localStorage key ('prepItems' | 'icItems')
  //   getItems () -> live array (prepItems | window.icItems)
  //   one/all  method names on window.firebaseDb, resolved at CALL time
  //            because firebaseDb loads asynchronously as a module
  //   onError  (message) -> void  (showErrorNotification | showMessage-wrapper)
  function makeSaver(opts) {
    return function saveData(specificItem) {
      var items = opts.getItems() || [];
      try { localStorage.setItem(opts.key, JSON.stringify(items)); } catch (e) {}
      var db = window.firebaseDb;
      var report = opts.onError || function () {};
      if (specificItem && db && db[opts.one]) {
        db[opts.one](specificItem).catch(function (e) {
          console.error('Error saving item:', e);
          report('Failed to save data to server. Please check your connection.');
        });
        return;
      }
      if (db && db[opts.all]) {
        db[opts.all](items).catch(function (e) {
          console.error('Error saving to Firebase:', e);
          report('Failed to save data to server. Please check your connection.');
        });
      }
    };
  }

  // Stable order comparator (was re-implemented in 5 sort sites): items WITH a
  // displayOrder sort first, ascending; those without fall back to ascending id.
  // Pass straight to Array.sort, or use as the tie-breaker after location/etc.
  function byDisplayOrder(a, b) {
    var aHas = a.displayOrder !== undefined, bHas = b.displayOrder !== undefined;
    if (aHas && bHas) return a.displayOrder - b.displayOrder;
    if (aHas) return -1;
    if (bHas) return 1;
    return a.id - b.id;
  }

  // Shared section switcher (the shell was identical in both modules): tap sound,
  // move the .active nav highlight, show only `${sectionId}-section`, then run an
  // optional per-section refresh. nav/sections are passed in because each module
  // closes over its own NodeLists; onSection(id) carries the module-specific tail.
  function activateSection(sectionId, buttonElement, opts) {
    opts = opts || {};
    if (typeof SoundFX !== 'undefined') SoundFX.tap();
    (opts.navButtons || []).forEach(function (btn) { btn.classList.remove('active'); });
    if (buttonElement) buttonElement.classList.add('active');
    (opts.contentSections || []).forEach(function (s) { s.style.display = 'none'; });
    var target = document.getElementById(sectionId + '-section');
    if (target) target.style.display = 'block';
    if (typeof opts.onSection === 'function') opts.onSection(sectionId);
  }

  global.makeSaver = makeSaver;
  global.byDisplayOrder = byDisplayOrder;
  global.activateSection = activateSection;
  global.openModal = openModal;
  global.formatDate = formatDate;
  global.initials = initials;
  global.levelColor = levelColor;
  global.levelTextColor = levelTextColor;
  global.deburr = deburr;
  global.confirmDialog = confirmDialog;
  global.IC_CATEGORIES = IC_CATEGORIES;
  global.categoryGroup = categoryGroup;
  global.categoryColors = categoryColors;
  global.categoryStyle = categoryStyle;
  global.categoryBadgesHTML = categoryBadgesHTML;
  global.buildCategoryChipEditor = buildCategoryChipEditor;
  global.IC_STATUS = IC_STATUS;
  global.statusBadgeHTML = statusBadgeHTML;
})(window);
