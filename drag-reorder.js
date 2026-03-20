// Drag & drop reorder for table rows (works on desktop + touch)
// Usage: initDragAndDrop(tbodyElement, itemsArray, type)
//   type = 'prep' or 'ic' — determines which Firebase save to use

function initDragAndDrop(tbody, items, type) {
    let dragRow = null;
    let placeholder = null;
    let touchStartY = 0;
    let touchCurrentRow = null;

    // --- Desktop drag events ---
    tbody.addEventListener('dragstart', function(e) {
        const row = e.target.closest('tr');
        if (!row) return;
        dragRow = row;
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', ''); // required for Firefox
    });

    tbody.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const targetRow = e.target.closest('tr');
        if (!targetRow || targetRow === dragRow) return;

        const rect = targetRow.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        if (e.clientY < midY) {
            tbody.insertBefore(dragRow, targetRow);
        } else {
            tbody.insertBefore(dragRow, targetRow.nextSibling);
        }
    });

    tbody.addEventListener('dragend', function() {
        if (dragRow) {
            dragRow.classList.remove('dragging');
            saveNewOrder(tbody, items, type);
            dragRow = null;
        }
    });

    // --- Touch events (mobile/tablet) ---
    tbody.addEventListener('touchstart', function(e) {
        const handle = e.target.closest('.drag-handle');
        if (!handle) return;

        const row = handle.closest('tr');
        if (!row) return;

        e.preventDefault();
        dragRow = row;
        touchStartY = e.touches[0].clientY;
        row.classList.add('dragging');

        // Create placeholder
        placeholder = document.createElement('tr');
        placeholder.className = 'drag-placeholder';
        placeholder.innerHTML = '<td colspan="' + row.cells.length + '">&nbsp;</td>';
    }, { passive: false });

    tbody.addEventListener('touchmove', function(e) {
        if (!dragRow) return;
        e.preventDefault();

        const touchY = e.touches[0].clientY;
        const rows = Array.from(tbody.querySelectorAll('tr:not(.dragging):not(.drag-placeholder)'));

        // Float the dragged row
        dragRow.style.position = 'relative';
        dragRow.style.zIndex = '1000';
        dragRow.style.transform = 'translateY(' + (touchY - touchStartY) + 'px)';
        dragRow.style.opacity = '0.9';
        dragRow.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';

        // Find insert position
        for (const row of rows) {
            const rect = row.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            if (touchY < midY) {
                tbody.insertBefore(dragRow, row);
                touchStartY = touchY;
                dragRow.style.transform = '';
                break;
            }
        }
    }, { passive: false });

    tbody.addEventListener('touchend', function() {
        if (!dragRow) return;

        dragRow.classList.remove('dragging');
        dragRow.style.position = '';
        dragRow.style.zIndex = '';
        dragRow.style.transform = '';
        dragRow.style.opacity = '';
        dragRow.style.boxShadow = '';

        if (placeholder && placeholder.parentNode) {
            placeholder.remove();
        }

        saveNewOrder(tbody, items, type);
        dragRow = null;
        placeholder = null;
    });
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
