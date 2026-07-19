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

  global.levelColor = levelColor;
  global.levelTextColor = levelTextColor;
  global.confirmDialog = confirmDialog;
})(window);
