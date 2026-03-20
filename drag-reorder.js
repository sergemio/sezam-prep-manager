// Drag & drop reorder for table rows (works on desktop + touch)
// Usage: initDragAndDrop(tbodyElement, itemsArray, type)
//   type = 'prep' or 'ic' — determines which Firebase save to use

function initDragAndDrop(tbody, items, type) {
    let dragSrcIndex = null;

    // --- Desktop: mousedown on handle starts tracking ---
    tbody.addEventListener('mousedown', function(e) {
        const handle = e.target.closest('.drag-handle');
        if (!handle) return;
        const row = handle.closest('tr');
        if (!row) return;
        dragSrcIndex = getRowIndex(tbody, row);
    });

    tbody.addEventListener('dragstart', function(e) {
        const row = e.target.closest('tr');
        if (!row) return;
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', row.getAttribute('data-id'));
    });

    tbody.addEventListener('dragover', function(e) {
        e.preventDefault();
    });

    tbody.addEventListener('drop', function(e) {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');
        const draggedRow = tbody.querySelector('tr[data-id="' + draggedId + '"]');
        if (!draggedRow) return;

        // Find which row we dropped on
        const targetRow = getDropTarget(tbody, e.clientY, draggedRow);
        if (targetRow && targetRow !== draggedRow) {
            const targetRect = targetRow.getBoundingClientRect();
            const midY = targetRect.top + targetRect.height / 2;
            if (e.clientY < midY) {
                tbody.insertBefore(draggedRow, targetRow);
            } else {
                tbody.insertBefore(draggedRow, targetRow.nextSibling);
            }
        }

        draggedRow.classList.remove('dragging');
        saveNewOrder(tbody, items, type);
    });

    tbody.addEventListener('dragend', function(e) {
        const row = e.target.closest('tr');
        if (row) row.classList.remove('dragging');
    });

    // --- Touch events (mobile/tablet) ---
    let touchDragRow = null;
    let touchStartY = 0;
    let touchClone = null;

    tbody.addEventListener('touchstart', function(e) {
        const handle = e.target.closest('.drag-handle');
        if (!handle) return;
        const row = handle.closest('tr');
        if (!row) return;

        e.preventDefault();
        touchDragRow = row;
        touchStartY = e.touches[0].clientY;
        row.classList.add('dragging');
    }, { passive: false });

    tbody.addEventListener('touchmove', function(e) {
        if (!touchDragRow) return;
        e.preventDefault();

        const touchY = e.touches[0].clientY;
        const rows = Array.from(tbody.querySelectorAll('tr:not(.dragging)'));

        for (const row of rows) {
            const rect = row.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            if (touchY < midY) {
                tbody.insertBefore(touchDragRow, row);
                break;
            }
            if (row === rows[rows.length - 1] && touchY >= midY) {
                tbody.appendChild(touchDragRow);
            }
        }
    }, { passive: false });

    tbody.addEventListener('touchend', function() {
        if (!touchDragRow) return;
        touchDragRow.classList.remove('dragging');
        saveNewOrder(tbody, items, type);
        touchDragRow = null;
    });
}

function getRowIndex(tbody, row) {
    return Array.from(tbody.children).indexOf(row);
}

function getDropTarget(tbody, clientY, draggedRow) {
    const rows = Array.from(tbody.querySelectorAll('tr:not(.dragging)'));
    for (const row of rows) {
        const rect = row.getBoundingClientRect();
        if (clientY >= rect.top && clientY <= rect.bottom) {
            return row;
        }
    }
    return rows[rows.length - 1];
}

function saveNewOrder(tbody, items, type) {
    // Read new order from DOM
    const rows = Array.from(tbody.querySelectorAll('tr:not(.drag-placeholder)'));
    const newOrder = rows.map(r => r.getAttribute('data-id'));

    // Reassign displayOrder based on new position (use == for type-flexible match)
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
