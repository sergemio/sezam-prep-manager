// I&C Items Management Functions

// Global variables for I&C items management
let icItems = [];
let currentEditingIcId = null;
let isAddingIc = false;

// DOM Elements for I&C items management
let icTableBody;
let icEditForm;
let icFormTitle;
let icIdInput;
let icNameInput;
let icCurrentInput;
let icTargetInput;
let icUnitInput;
let icLocationInput;
let icSublocationInput;
let icDisplayOrderInput;
let icProvidersInput;
let saveIcButton;
let cancelIcEditButton;
let deleteIcButton;
let addNewIcButton;

// Shared sort function for I&C items (by location, sublocation, then displayOrder)
function sortIcItems() {
    icItems.sort((a, b) => {
        if (a.location !== b.location) return a.location.localeCompare(b.location);
        if ((a.sublocation || '') !== (b.sublocation || '')) return (a.sublocation || '').localeCompare(b.sublocation || '');
        if (a.displayOrder !== undefined && b.displayOrder !== undefined) return a.displayOrder - b.displayOrder;
        if (a.displayOrder !== undefined) return -1;
        if (b.displayOrder !== undefined) return 1;
        return a.id - b.id;
    });
}

// Move an I&C item up or down within its location/sublocation
function moveIcItem(itemId, direction) {
    const currentIndex = icItems.findIndex(item => item.id === itemId);
    if (currentIndex < 0) return;

    const currentItem = icItems[currentIndex];

    // Find the neighbor in the same location/sublocation
    let swapIndex = -1;
    const step = direction; // -1 for up, +1 for down
    for (let i = currentIndex + step; i >= 0 && i < icItems.length; i += step) {
        if (icItems[i].location === currentItem.location &&
            (icItems[i].sublocation || '') === (currentItem.sublocation || '')) {
            swapIndex = i;
            break;
        }
    }
    if (swapIndex === -1) return;

    const swapItem = icItems[swapIndex];

    if (currentItem.displayOrder === undefined) currentItem.displayOrder = currentItem.id;
    if (swapItem.displayOrder === undefined) swapItem.displayOrder = swapItem.id;

    const temp = currentItem.displayOrder;
    currentItem.displayOrder = swapItem.displayOrder;
    swapItem.displayOrder = temp;

    const dirLabel = direction === -1 ? 'up' : 'down';

    if (window.firebaseDb && window.firebaseDb.saveAllIcItems) {
        window.firebaseDb.saveAllIcItems([currentItem, swapItem])
            .then(() => {
                sortIcItems();
                renderIcItemsTable();
                showSuccessMessage(`I&C item moved ${dirLabel} in order.`);
            })
            .catch(error => {
                console.error('Error saving I&C items:', error);
                showErrorMessage('Failed to change I&C item order.');
            });
    } else {
        sortIcItems();
        renderIcItemsTable();
    }
}

// Initialize I&C items management
function initIcItemsManagement() {
    
    // Get DOM elements
    icTableBody = document.getElementById('ic-table-body');
    icEditForm = document.getElementById('ic-edit-form');
    icFormTitle = document.getElementById('ic-form-title');
    icIdInput = document.getElementById('ic-id');
    icNameInput = document.getElementById('ic-name');
    icCurrentInput = document.getElementById('ic-current');
    icTargetInput = document.getElementById('ic-target');
    icUnitInput = document.getElementById('ic-unit');
    icLocationInput = document.getElementById('ic-location');
    icSublocationInput = document.getElementById('ic-sublocation');
    icDisplayOrderInput = document.getElementById('ic-display-order');
    icProvidersInput = document.getElementById('ic-providers');
    saveIcButton = document.getElementById('save-ic');
    cancelIcEditButton = document.getElementById('cancel-ic-edit');
    deleteIcButton = document.getElementById('delete-ic');
    addNewIcButton = document.getElementById('add-new-ic');
    
    // Check if elements exist
    if (!icTableBody || !icEditForm || !addNewIcButton) {
console.error('Required I&C management DOM elements not found!');
return;
    }
    
// Load data from Firebase
loadIcItemsFromFirebase();
    
    // Set up event listeners
    addNewIcButton.addEventListener('click', showAddNewIcForm);
    saveIcButton.addEventListener('click', saveIcItem);
    cancelIcEditButton.addEventListener('click', cancelIcEdit);
    deleteIcButton.addEventListener('click', confirmDeleteIcItem);
    
    // Close modal when clicking outside form
    icEditForm.addEventListener('click', function(e) {
if (e.target === icEditForm) {
    cancelIcEdit();
}
    });
    
    // Set up real-time updates
    if (window.firebaseDb && window.firebaseDb.onIcItemsChange) {
window.firebaseDb.onIcItemsChange((updatedIcItems) => {
    if (updatedIcItems && updatedIcItems.length > 0) {
        icItems = updatedIcItems;
        sortIcItems();
        renderIcItemsTable();
    }
});
    }
}

// Load I&C items from Firebase
function loadIcItemsFromFirebase() {
    if (window.firebaseDb && window.firebaseDb.loadIcItems) {
window.firebaseDb.loadIcItems()
    .then(items => {
        if (items && items.length > 0) {
            icItems = items;
            sortIcItems();
            renderIcItemsTable();
        } else {
            // Show empty state
            icTableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="empty-state-cell">
                        No I&C items found in database. Add your first item to get started.
                    </td>
                </tr>
            `;
        }
    })
    .catch(error => {
        console.error('Error loading I&C items:', error);
        showErrorMessage('Failed to load I&C items from database.');
    });
    } else {
showErrorMessage('Firebase database functions for I&C items not available.');
    }
}

// Render the I&C items table
function renderIcItemsTable() {
    icTableBody.innerHTML = '';
    
    icItems.forEach((item, index) => {
        const row = document.createElement('tr');
        row.setAttribute('data-id', item.id);

        let providersDisplay = '';
        if (item.providers && item.providers.length > 0) {
            providersDisplay = item.providers.join(', ');
        } else {
            providersDisplay = '<span class="text-muted">None</span>';
        }

        let sublocationDisplay = item.sublocation || '<span class="text-muted">General</span>';

        row.innerHTML = `
            <td><span class="drag-handle" title="Drag to reorder">☰</span> ${index + 1}</td>
            <td>${item.name}</td>
            <td>${item.currentLevel} ${item.unit}</td>
            <td>${item.targetLevel} ${item.unit}</td>
            <td>${item.location}</td>
            <td>${sublocationDisplay}</td>
            <td>${providersDisplay}</td>
            <td>${item.lastCheckedTime ? new Date(item.lastCheckedTime).toLocaleString() : 'Never'}</td>
            <td>
                <div class="actions-cell">
                    <button class="edit-button" data-id="${item.id}">Edit</button>
                </div>
            </td>
        `;

        icTableBody.appendChild(row);

        const editButton = row.querySelector('.edit-button');
        if (editButton) {
            editButton.addEventListener('click', function() {
                const itemId = parseInt(this.getAttribute('data-id'));
                showEditIcForm(itemId);
            });
        }
    });

    initDragAndDrop(icTableBody, icItems, 'ic');
}

// Show the form for adding a new I&C item
function showAddNewIcForm() {
    isAddingIc = true;
    currentEditingIcId = null;
    icFormTitle.textContent = 'Add New I&C Item';
    
    // Generate a new ID (max ID + 1)
    const newId = icItems.length > 0 
? Math.max(...icItems.map(item => item.id)) + 1 
: 1;
    
    // Clear and set default form values
    icIdInput.value = newId;
    icNameInput.value = '';
    icCurrentInput.value = '0';
    icTargetInput.value = '1';
    icUnitInput.value = 'units';
    icLocationInput.value = '';
    icSublocationInput.value = '';
    icDisplayOrderInput.value = newId; // Initially set display order to match ID
    icProvidersInput.value = ''; // Empty providers list
    
    // Hide delete button for new items
    deleteIcButton.classList.add('hidden');
    
    // Prevent scrolling on the body
    document.body.style.overflow = 'hidden';
    
    // Show the form
    icEditForm.classList.remove('hidden');
}

// Show the edit form for an existing I&C item
function showEditIcForm(itemId) {
    const item = icItems.find(item => item.id === itemId);
    if (!item) {
console.error("I&C item not found:", itemId);
return;
    }
    
    
    isAddingIc = false;
    currentEditingIcId = itemId;
    icFormTitle.textContent = `Edit I&C Item: ${item.name}`;
    
    // Fill form with item data
    icIdInput.value = item.id;
    icNameInput.value = item.name;
    icCurrentInput.value = item.currentLevel;
    icTargetInput.value = item.targetLevel;
    icUnitInput.value = item.unit;
    icLocationInput.value = item.location || '';
    icSublocationInput.value = item.sublocation || '';
    icDisplayOrderInput.value = item.displayOrder || item.id;
    
    // Format providers for form input
    if (item.providers && item.providers.length > 0) {
icProvidersInput.value = item.providers.join(', ');
    } else {
icProvidersInput.value = '';
    }
    
    // Show delete button for existing items
    deleteIcButton.classList.remove('hidden');
    
    // Prevent scrolling on the body
    document.body.style.overflow = 'hidden';
    
    // Show the form
    icEditForm.classList.remove('hidden');
}

// Save the current I&C item (add or edit)
function saveIcItem() {
    // Validate form
    if (!validateIcForm()) return;
    
    // Parse providers from comma-separated list
    const providersText = icProvidersInput.value.trim();
    const providers = providersText ? 
providersText.split(',').map(p => p.trim()).filter(p => p.length > 0) : 
[];
    
    // Create updated item object
    const updatedItem = {
id: parseInt(icIdInput.value),
name: icNameInput.value.trim(),
currentLevel: parseFloat(icCurrentInput.value),
targetLevel: parseFloat(icTargetInput.value),
unit: icUnitInput.value.trim(),
location: icLocationInput.value.trim(),
sublocation: icSublocationInput.value.trim() || null,
displayOrder: parseInt(icDisplayOrderInput.value),
providers: providers,
lastCheckedTime: new Date().toISOString(),
lastCheckedBy: 'Admin (DB Editor)'
    };
    
    let actionType = 'edit';
    let oldItem = null;
    
    if (isAddingIc) {
// Make sure ID doesn't already exist
if (icItems.some(item => item.id === updatedItem.id)) {
    showErrorMessage('An I&C item with this ID already exists. Please use a different ID.');
    return;
}

// Add new item
icItems.push(updatedItem);
actionType = 'add';
    } else {
// Update existing item
const index = icItems.findIndex(item => item.id === currentEditingIcId);
if (index !== -1) {
    // Store old item information for logging
    oldItem = {...icItems[index]};
    
    // Preserve original last checked info if we're just editing configuration
    if (icItems[index].lastCheckedTime) {
        updatedItem.lastCheckedTime = icItems[index].lastCheckedTime;
    }
    if (icItems[index].lastCheckedBy) {
        updatedItem.lastCheckedBy = icItems[index].lastCheckedBy;
    }
    
    icItems[index] = updatedItem;
}
    }
    
    // Save to Firebase
    if (window.firebaseDb && window.firebaseDb.saveIcItem) {
window.firebaseDb.saveIcItem(updatedItem)
    .then(() => {
        // Log the activity if history system is available
        if (window.firebaseDb.saveIcActivityLog) {
            const activity = {
                timestamp: new Date().toISOString(),
                user: 'Admin (DB Editor)',
                itemId: updatedItem.id,
                itemName: updatedItem.name,
                location: updatedItem.location,
                sublocation: updatedItem.sublocation,
                actionType: actionType,
                oldValue: oldItem ? oldItem.currentLevel : null,
                newValue: updatedItem.currentLevel,
                unit: updatedItem.unit
            };
            
            window.firebaseDb.saveIcActivityLog(activity)
                .catch(error => {
                    console.error("Error logging I&C activity:", error);
                });
        }
        
        showSuccessMessage(isAddingIc ? 'I&C item added successfully.' : 'I&C item updated successfully.');
        renderIcItemsTable();
        cancelIcEdit(); // Hide the form
    })
    .catch(error => {
        console.error('Error saving I&C item:', error);
        showErrorMessage('Failed to save I&C item to database.');
    });
    }
}

// Validate the I&C form before saving
function validateIcForm() {
    if (!icNameInput.value.trim()) {
showErrorMessage('Please enter an I&C item name.');
return false;
    }
    
    if (isNaN(icCurrentInput.value) || parseFloat(icCurrentInput.value) < 0) {
showErrorMessage('Please enter a valid current level (must be 0 or greater).');
return false;
    }
    
    if (isNaN(icTargetInput.value) || parseFloat(icTargetInput.value) <= 0) {
showErrorMessage('Please enter a valid target level (must be greater than 0).');
return false;
    }
    
    if (!icUnitInput.value.trim()) {
showErrorMessage('Please enter a unit (e.g., units, kg, liters).');
return false;
    }
    
    if (!icLocationInput.value.trim()) {
showErrorMessage('Please enter a location for the I&C item.');
return false;
    }
    
    return true;
}

// Confirm before deleting an I&C item
function confirmDeleteIcItem() {
    const item = icItems.find(item => item.id === currentEditingIcId);
    if (!item) return;
    
    const confirmDelete = confirm(`Are you sure you want to delete "${item.name}"? This cannot be undone.`);
    
    if (confirmDelete) {
deleteIcItem(currentEditingIcId);
    }
}

// Delete an I&C item from the database
function deleteIcItem(itemId) {
    // Find the item before deleting it (for logging)
    const item = icItems.find(item => item.id === itemId);
    
    if (window.firebaseDb && window.firebaseDb.deleteIcItem) {
window.firebaseDb.deleteIcItem(itemId)
    .then(() => {
        // Log the deletion if activity logging is available
        if (window.firebaseDb.saveIcActivityLog && item) {
            const activity = {
                timestamp: new Date().toISOString(),
                user: 'Admin (DB Editor)',
                itemId: item.id,
                itemName: item.name,
                location: item.location,
                sublocation: item.sublocation,
                actionType: 'delete',
                oldValue: item.currentLevel,
                newValue: null,
                unit: item.unit
            };
            
            window.firebaseDb.saveIcActivityLog(activity)
                .catch(error => {
                    console.error("Error logging I&C deletion:", error);
                });
        }
        
        // Remove from local array
        icItems = icItems.filter(item => item.id !== itemId);
        showSuccessMessage('I&C item deleted successfully.');
        renderIcItemsTable();
        cancelIcEdit(); // Hide the form
    })
    .catch(error => {
        console.error('Error deleting I&C item:', error);
        showErrorMessage('Failed to delete I&C item from database.');
    });
    }
}

// Cancel editing and hide the form
function cancelIcEdit() {
    icEditForm.classList.add('hidden');
    
    // Enable scrolling on the body again
    document.body.style.overflow = 'auto';
    
    isAddingIc = false;
    currentEditingIcId = null;
}

// Add the initialization call to the existing initApp function
document.addEventListener('DOMContentLoaded', function() {
    // Make sure this is called after the main app is initialized
    setTimeout(initIcItemsManagement, 100);
});
