// Drag & drop reorder for table rows (mouse + touch)
// No HTML5 drag API — pure mouse/touch events for reliability with <tr> elements

function initDragAndDrop(tbody, items, type) {
    let dragRow = null;
    let startY = 0;
    let rowHeight = 0;

    function onPointerDown(e) {
        const handle = e.target.closest('.drag-handle');
        if (!handle) return;
        const row = handle.closest('tr');
        if (!row) return;

        e.preventDefault();
        dragRow = row;
        rowHeight = row.getBoundingClientRect().height;
        startY = (e.touches ? e.touches[0] : e).clientY;

        dragRow.classList.add('dragging');
        document.body.style.userSelect = 'none';
    }

    function onPointerMove(e) {
        if (!dragRow) return;
        e.preventDefault();

        const clientY = (e.touches ? e.touches[0] : e).clientY;
        const rows = Array.from(tbody.querySelectorAll('tr:not(.dragging)'));

        // Find the row we're hovering over
        for (const row of rows) {
            const rect = row.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;

            if (clientY < midY) {
                tbody.insertBefore(dragRow, row);
                return;
            }
        }
        // If past all rows, move to end
        tbody.appendChild(dragRow);
    }

    function onPointerUp() {
        if (!dragRow) return;

        dragRow.classList.remove('dragging');
        document.body.style.userSelect = '';

        saveNewOrder(tbody, items, type);
        dragRow = null;
    }

    // Mouse events
    tbody.addEventListener('mousedown', onPointerDown);
    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('mouseup', onPointerUp);

    // Touch events
    tbody.addEventListener('touchstart', onPointerDown, { passive: false });
    document.addEventListener('touchmove', onPointerMove, { passive: false });
    document.addEventListener('touchend', onPointerUp);

    // Disable native drag on rows (prevents browser interference)
    tbody.addEventListener('dragstart', function(e) { e.preventDefault(); });
}

function saveNewOrder(tbody, items, type) {
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const newOrder = rows.map(r => r.getAttribute('data-id'));

    const updatedItems = [];
    newOrder.forEach((itemId, index) => {
        const item = items.find(i => String(i.id) === String(itemId));
        if (item) {
            item.displayOrder = index + 1;
            updatedItems.push(item);
        }
    });

    if (updatedItems.length === 0) return;

    // Update order numbers in the DOM
    rows.forEach((row, index) => {
        const firstCell = row.querySelector('td:first-child');
        if (firstCell) {
            const handle = firstCell.querySelector('.drag-handle');
            firstCell.innerHTML = '';
            if (handle) firstCell.appendChild(handle);
            firstCell.appendChild(document.createTextNode(' ' + (index + 1)));
        }
    });

    // Sort the source array
    items.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    // Save to Firebase
    if (window.firebaseDb) {
        const saveFn = type === 'ic' ? window.firebaseDb.saveAllIcItems : window.firebaseDb.saveAllItems;
        saveFn(updatedItems)
            .then(() => {
                if (typeof showSuccessMessage === 'function') {
                    showSuccessMessage('Order updated.');
                }
            })
            .catch(error => {
                console.error('Error saving order:', error);
                if (typeof showErrorMessage === 'function') {
                    showErrorMessage('Failed to save new order.');
                }
            });
    }
}
