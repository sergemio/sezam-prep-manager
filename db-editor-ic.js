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
// --- Smart dropdown helpers ---

function setupSmartDropdown(selectId, newInputId, getOptions, allowEmpty) {
    var select = document.getElementById(selectId);
    var newInput = document.getElementById(newInputId);
    if (!select || !newInput) return;

    select.addEventListener('change', function() {
        if (this.value === '__new__') {
            newInput.style.display = 'block';
            newInput.focus();
        } else {
            newInput.style.display = 'none';
            newInput.value = '';
        }
    });
}

function populateDropdown(selectId, newInputId, options, currentValue, allowEmpty) {
    var select = document.getElementById(selectId);
    var newInput = document.getElementById(newInputId);
    if (!select) return;
    select.innerHTML = '';
    if (allowEmpty) {
        var emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '— None —';
        select.appendChild(emptyOpt);
    }
    options.forEach(function(val) {
        var opt = document.createElement('option');
        opt.value = val;
        opt.textContent = val;
        select.appendChild(opt);
    });
    // Add "+ New..." option
    var newOpt = document.createElement('option');
    newOpt.value = '__new__';
    newOpt.textContent = '+ New...';
    select.appendChild(newOpt);
    // Set current value
    if (currentValue && options.indexOf(currentValue) === -1 && currentValue !== '') {
        // Value exists but not in options yet — add it
        var extraOpt = document.createElement('option');
        extraOpt.value = currentValue;
        extraOpt.textContent = currentValue;
        select.insertBefore(extraOpt, select.lastChild);
    }
    select.value = currentValue || '';
    if (newInput) { newInput.style.display = 'none'; newInput.value = ''; }
}

function getDropdownValue(selectId, newInputId) {
    var select = document.getElementById(selectId);
    var newInput = document.getElementById(newInputId);
    if (select && select.value === '__new__' && newInput) {
        return newInput.value.trim();
    }
    return select ? select.value : '';
}

// --- Providers multi-select ---
var selectedProviders = [];

function setupProvidersDropdown() {
    var select = document.getElementById('ic-providers-select');
    var newInput = document.getElementById('ic-providers-new');
    if (!select) return;

    select.addEventListener('change', function() {
        if (this.value === '__new__') {
            newInput.style.display = 'block';
            newInput.focus();
            this.value = '';
        } else if (this.value) {
            addProvider(this.value);
            this.value = '';
        }
    });

    newInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            var val = this.value.trim();
            if (val) {
                addProvider(val);
                this.value = '';
                this.style.display = 'none';
            }
        }
    });
}

function populateProvidersDropdown(currentProviders) {
    selectedProviders = currentProviders || [];
    var allProviders = [...new Set(icItems.flatMap(function(i) { return i.providers || []; }))].sort();
    var select = document.getElementById('ic-providers-select');
    var newInput = document.getElementById('ic-providers-new');
    if (!select) return;
    select.innerHTML = '<option value="">+ Add provider...</option>';
    allProviders.forEach(function(p) {
        var opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        select.appendChild(opt);
    });
    var newOpt = document.createElement('option');
    newOpt.value = '__new__';
    newOpt.textContent = '+ New provider...';
    select.appendChild(newOpt);
    if (newInput) { newInput.style.display = 'none'; newInput.value = ''; }
    renderProviderChips();
}

function addProvider(name) {
    if (selectedProviders.indexOf(name) === -1) {
        selectedProviders.push(name);
        renderProviderChips();
    }
}

function removeProvider(name) {
    selectedProviders = selectedProviders.filter(function(p) { return p !== name; });
    renderProviderChips();
}

function renderProviderChips() {
    var container = document.getElementById('ic-providers-list');
    if (!container) return;
    container.innerHTML = '';
    selectedProviders.forEach(function(p) {
        var chip = document.createElement('span');
        chip.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#e8f5e9;border:1px solid #a5d6a7;border-radius:9999px;font-size:13px;';
        chip.innerHTML = p + ' <span style="cursor:pointer;color:#999;font-weight:bold;">&times;</span>';
        chip.querySelector('span').addEventListener('click', function() { removeProvider(p); });
        container.appendChild(chip);
    });
    // Sync hidden input
    var hidden = document.getElementById('ic-providers');
    if (hidden) hidden.value = selectedProviders.join(', ');
}

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
    
    // Smart dropdown setup
    setupSmartDropdown('ic-unit', 'ic-unit-new', () => [...new Set(icItems.map(i => i.unit).filter(Boolean))].sort());
    setupSmartDropdown('ic-location', 'ic-location-new', () => [...new Set(icItems.map(i => i.location).filter(Boolean))].sort());
    setupSmartDropdown('ic-sublocation', 'ic-sublocation-new', () => [...new Set(icItems.map(i => i.sublocation).filter(Boolean))].sort(), true);
    setupProvidersDropdown();

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
    if (updatedIcItems) {
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
        row.style.cursor = 'pointer';

        const sc = typeof stockClass === 'function' ? stockClass(item.currentLevel, item.targetLevel) : '';

        row.innerHTML = `
            <td class="drag-cell"><span class="drag-handle" title="Drag to reorder">☰</span></td>
            <td class="item-name-cell">${item.name}</td>
            <td class="${sc}">${item.currentLevel} ${item.unit}</td>
            <td>${item.targetLevel} ${item.unit}</td>
            <td>${item.location || '<span class="text-muted">—</span>'}</td>
            <td>${typeof formatCheckDate === 'function' ? formatCheckDate(item.lastCheckedTime) : (item.lastCheckedTime ? new Date(item.lastCheckedTime).toLocaleString() : 'Never')}</td>
        `;

        icTableBody.appendChild(row);

        row.addEventListener('click', function(e) {
            if (e.target.closest('.drag-handle')) return;
            showEditIcForm(parseInt(this.getAttribute('data-id')));
        });
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
    populateDropdown('ic-unit', 'ic-unit-new', [...new Set(icItems.map(i => i.unit).filter(Boolean))].sort(), 'units');
    populateDropdown('ic-location', 'ic-location-new', [...new Set(icItems.map(i => i.location).filter(Boolean))].sort(), '');
    populateDropdown('ic-sublocation', 'ic-sublocation-new', [...new Set(icItems.map(i => i.sublocation).filter(Boolean))].sort(), '', true);
    icDisplayOrderInput.value = newId;
    populateProvidersDropdown([]);
    
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
    populateDropdown('ic-unit', 'ic-unit-new', [...new Set(icItems.map(i => i.unit).filter(Boolean))].sort(), item.unit);
    populateDropdown('ic-location', 'ic-location-new', [...new Set(icItems.map(i => i.location).filter(Boolean))].sort(), item.location || '');
    populateDropdown('ic-sublocation', 'ic-sublocation-new', [...new Set(icItems.map(i => i.sublocation).filter(Boolean))].sort(), item.sublocation || '', true);
    icDisplayOrderInput.value = item.displayOrder || item.id;
    populateProvidersDropdown(item.providers ? [...item.providers] : []);
    
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
    
    // Get providers from chip list
    const providers = [...selectedProviders];

    // Create updated item object
    const updatedItem = {
id: parseInt(icIdInput.value),
name: icNameInput.value.trim(),
currentLevel: parseFloat(icCurrentInput.value),
targetLevel: parseFloat(icTargetInput.value),
unit: getDropdownValue('ic-unit', 'ic-unit-new'),
location: getDropdownValue('ic-location', 'ic-location-new'),
sublocation: getDropdownValue('ic-sublocation', 'ic-sublocation-new') || null,
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
    
    if (!getDropdownValue('ic-unit', 'ic-unit-new')) {
showErrorMessage('Please select or enter a unit.');
return false;
    }

    if (!getDropdownValue('ic-location', 'ic-location-new')) {
showErrorMessage('Please select or enter a location.');
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
