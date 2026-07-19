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
        backdrop.className = 'modal-backdrop pin-gate';
        if (!opts.dismissable) {
            // Opaque backdrop: hide the admin page content until unlocked
            backdrop.classList.add('pin-gate--opaque');
        }

        var box = document.createElement('div');
        box.className = 'modal-box pin-box';

        var title = document.createElement('h3');
        title.textContent = 'Enter PIN';
        title.className = 'pin-title';

        var display = document.createElement('div');
        display.className = 'pin-display';
        display.textContent = ' ';

        var error = document.createElement('div');
        error.className = 'pin-error';

        var grid = document.createElement('div');
        grid.className = 'pin-grid';


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
                btn.className = 'pin-key';
                btn.addEventListener('click', function() { addDigit(String(digit)); });
                grid.appendChild(btn);
            })(i);
        }

        var clearBtn = document.createElement('button');
        clearBtn.textContent = 'C';
        clearBtn.className = 'pin-key pin-key--clear';
        clearBtn.addEventListener('click', function() {
            enteredPin = '';
            error.textContent = '';
            updateDisplay();
        });
        grid.appendChild(clearBtn);

        var zeroBtn = document.createElement('button');
        zeroBtn.textContent = '0';
        zeroBtn.className = 'pin-key';
        zeroBtn.addEventListener('click', function() { addDigit('0'); });
        grid.appendChild(zeroBtn);

        var enterBtn = document.createElement('button');
        enterBtn.textContent = '✓';
        enterBtn.className = 'pin-key pin-key--enter';
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
            backBtn.className = 'pin-back';
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
