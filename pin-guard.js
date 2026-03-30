// PIN Guard — protects DB Editor access with a numeric code stored in Firebase
(function() {
    document.addEventListener('click', function(e) {
        var link = e.target.closest('a[href="db-editor.html"]');
        if (!link) return;
        e.preventDefault();
        showPinModal();
    });

    function showPinModal() {
        var enteredPin = '';

        var backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        backdrop.style.zIndex = '20000';

        var box = document.createElement('div');
        box.className = 'modal-box';
        box.style.cssText = 'max-width:320px;padding:24px;text-align:center;';

        var title = document.createElement('h3');
        title.textContent = 'Enter PIN';
        title.style.cssText = 'margin:0 0 16px;color:#333;';

        var display = document.createElement('div');
        display.style.cssText = 'font-size:32px;letter-spacing:12px;height:48px;line-height:48px;background:#f5f5f5;border-radius:8px;margin-bottom:16px;font-weight:700;color:#333;';
        display.textContent = '\u00A0';

        var error = document.createElement('div');
        error.style.cssText = 'color:#dc2626;font-size:13px;height:20px;margin-bottom:8px;';

        var grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;';

        var btnStyle = 'padding:16px;font-size:22px;font-weight:600;border:1px solid #ddd;border-radius:8px;background:#fff;cursor:pointer;';

        function updateDisplay() {
            display.textContent = enteredPin.replace(/./g, '\u25CF') || '\u00A0';
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
        enterBtn.textContent = '\u2713';
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
                if (!correctPin) {
                    // No PIN set — allow access
                    backdrop.remove();
                    window.location.href = 'db-editor.html';
                    return;
                }
                if (enteredPin === correctPin) {
                    backdrop.remove();
                    window.location.href = 'db-editor.html';
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
        backdrop.appendChild(box);
        document.body.appendChild(backdrop);

        backdrop.addEventListener('click', function(e) {
            if (e.target === backdrop) backdrop.remove();
        });
    }
})();
