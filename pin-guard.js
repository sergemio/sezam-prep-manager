// PIN Guard — protects DB Editor access with a numeric code stored in Firebase
// Two modes:
//  1. Link mode (index/ic-inventory): intercepts clicks on links to db-editor.html
//  2. Page mode (db-editor.html itself): blocks the page on load until the PIN
//     is entered — typing the URL directly no longer bypasses the guard
(function() {
    var UNLOCK_KEY = 'dbEditorUnlocked';
    var isDbEditorPage = /db-editor\.html$/i.test(window.location.pathname);

    // Mode 1 — intercept link clicks (no-op on db-editor itself)
    document.addEventListener('click', function(e) {
        var link = e.target.closest('a[href="db-editor.html"]');
        if (!link) return;
        e.preventDefault();
        if (sessionStorage.getItem(UNLOCK_KEY) === '1') {
            window.location.href = 'db-editor.html';
            return;
        }
        showPinModal({
            dismissable: true,
            onSuccess: function() {
                sessionStorage.setItem(UNLOCK_KEY, '1');
                window.location.href = 'db-editor.html';
            }
        });
    });

    // Mode 2 — guard the db-editor page itself on load
    if (isDbEditorPage && sessionStorage.getItem(UNLOCK_KEY) !== '1') {
        showPinModal({
            dismissable: false,
            onSuccess: function() {
                sessionStorage.setItem(UNLOCK_KEY, '1');
            },
            onCancel: function() {
                window.location.href = 'index.html';
            }
        });
    }

    function showPinModal(opts) {
        var enteredPin = '';

        var backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        backdrop.style.zIndex = '20000';
        if (!opts.dismissable) {
            // Opaque backdrop: hide the admin page content until unlocked
            backdrop.style.background = 'rgba(30,30,30,0.97)';
        }

        var box = document.createElement('div');
        box.className = 'modal-box';
        box.style.cssText = 'max-width:320px;padding:24px;text-align:center;';

        var title = document.createElement('h3');
        title.textContent = 'Enter PIN';
        title.style.cssText = 'margin:0 0 16px;color:#333;';

        var display = document.createElement('div');
        display.style.cssText = 'font-size:32px;letter-spacing:12px;height:48px;line-height:48px;background:#f5f5f5;border-radius:8px;margin-bottom:16px;font-weight:700;color:#333;';
        display.textContent = ' ';

        var error = document.createElement('div');
        error.style.cssText = 'color:#dc2626;font-size:13px;height:20px;margin-bottom:8px;';

        var grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;';

        var btnStyle = 'padding:16px;font-size:22px;font-weight:600;border:1px solid #ddd;border-radius:8px;background:#fff;cursor:pointer;';

        function updateDisplay() {
            display.textContent = enteredPin.replace(/./g, '●') || ' ';
        }

        function addDigit(d) {
            if (enteredPin.length >= 8) return;
            enteredPin += d;
            error.textContent = '';
            updateDisplay();
        }

        for (var i = 1; i <= 9; i++) {
            (function(digit) {
                var btn = document.createElement('button');
                btn.textContent = digit;
                btn.style.cssText = btnStyle;
                btn.addEventListener('click', function() { addDigit(String(digit)); });
                grid.appendChild(btn);
            })(i);
        }

        var clearBtn = document.createElement('button');
        clearBtn.textContent = 'C';
        clearBtn.style.cssText = 'padding:16px;font-size:18px;font-weight:600;border:1px solid #ddd;border-radius:8px;background:#f5f5f5;cursor:pointer;color:#999;';
        clearBtn.addEventListener('click', function() {
            enteredPin = '';
            error.textContent = '';
            updateDisplay();
        });
        grid.appendChild(clearBtn);

        var zeroBtn = document.createElement('button');
        zeroBtn.textContent = '0';
        zeroBtn.style.cssText = btnStyle;
        zeroBtn.addEventListener('click', function() { addDigit('0'); });
        grid.appendChild(zeroBtn);

        var enterBtn = document.createElement('button');
        enterBtn.textContent = '✓';
        enterBtn.style.cssText = 'padding:16px;font-size:22px;font-weight:600;border:none;border-radius:8px;background:#80b244;color:#fff;cursor:pointer;';
        enterBtn.addEventListener('click', validatePin);
        grid.appendChild(enterBtn);

        function validatePin() {
            if (!window.firebaseDb) {
                error.textContent = 'Firebase not ready';
                return;
            }
            var dbRef = window.firebaseDb.ref('settings/dbEditorCode');
            window.firebaseDb.get(dbRef).then(function(snapshot) {
                var correctPin = snapshot.exists() ? String(snapshot.val()) : null;
                if (!correctPin || enteredPin === correctPin) {
                    // No PIN set — allow access
                    backdrop.remove();
                    opts.onSuccess();
                } else {
                    enteredPin = '';
                    updateDisplay();
                    error.textContent = 'Wrong PIN';
                }
            });
        }

        box.appendChild(title);
        box.appendChild(display);
        box.appendChild(error);
        box.appendChild(grid);

        if (!opts.dismissable && opts.onCancel) {
            var backBtn = document.createElement('button');
            backBtn.textContent = '← Back to dashboard';
            backBtn.style.cssText = 'margin-top:16px;padding:8px 16px;font-size:14px;border:none;background:none;color:#80b244;cursor:pointer;text-decoration:underline;';
            backBtn.addEventListener('click', opts.onCancel);
            box.appendChild(backBtn);
        }

        backdrop.appendChild(box);
        document.body.appendChild(backdrop);

        backdrop.addEventListener('click', function(e) {
            if (opts.dismissable && e.target === backdrop) backdrop.remove();
        });
    }
})();
