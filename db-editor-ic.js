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
// Has the user actually typed in the stock field during THIS edit? The form is filled
// when it opens and never refreshed, so sending its stock back unconditionally would
// undo a count made on the tablet meanwhile. We only write the stock when it was
// deliberately edited here.
let icStockTouched = false;
let icTargetInput;
let icUnitInput;
let icLocationInput;
let selectedCategories = [];
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
        return byDisplayOrder(a, b); // shared tie-breaker
    });
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
        chip.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:var(--success-surface);border:1px solid #a5d6a7;border-radius:9999px;font-size:13px;';
        chip.innerHTML = p + ' <span style="cursor:pointer;color:#999;font-weight:bold;">&times;</span>';
        chip.querySelector('span').addEventListener('click', function() { removeProvider(p); });
        container.appendChild(chip);
    });
    // Sync hidden input
    var hidden = document.getElementById('ic-providers');
    if (hidden) hidden.value = selectedProviders.join(', ');
}

// ---- Categories (fixed vocabulary, multi-toggle) -------------------------
// Renders every tag from the closed IC_CATEGORIES list as a togglable chip.
function renderCategoryChips(current) {
    selectedCategories = (current || []).filter(function (c) { return IC_CATEGORIES.all.indexOf(c) !== -1; });
    var box = document.getElementById('ic-categories-chips');
    if (!box) return;
    box.innerHTML = '';
    ['nature', 'etat', 'nonalim'].forEach(function (grp) {
        IC_CATEGORIES[grp].forEach(function (cat) {
            var on = selectedCategories.indexOf(cat) !== -1;
            var chip = document.createElement('span');
            chip.textContent = cat;
            chip.style.cssText = categoryStyle(cat, on);
            chip.addEventListener('click', function () { toggleCategory(cat); });
            box.appendChild(chip);
        });
    });
    syncCategoriesHidden();
}

function toggleCategory(cat) {
    var i = selectedCategories.indexOf(cat);
    if (i === -1) selectedCategories.push(cat); else selectedCategories.splice(i, 1);
    renderCategoryChips(selectedCategories);
}

function syncCategoriesHidden() {
    var hidden = document.getElementById('ic-categories');
    if (hidden) hidden.value = selectedCategories.join(', ');
}

function initIcItemsManagement() {
    
    // Get DOM elements
    icTableBody = document.getElementById('ic-table-body');
    icEditForm = document.getElementById('ic-edit-form');
    icFormTitle = document.getElementById('ic-form-title');
    icIdInput = document.getElementById('ic-id');
    icNameInput = document.getElementById('ic-name');
    icCurrentInput = document.getElementById('ic-current');
    if (icCurrentInput) icCurrentInput.addEventListener('input', () => { icStockTouched = true; });
    icTargetInput = document.getElementById('ic-target');
    icUnitInput = document.getElementById('ic-unit');
    icLocationInput = document.getElementById('ic-location');
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
    icStockTouched = false;
    icTargetInput.value = '1';
    populateDropdown('ic-unit', 'ic-unit-new', [...new Set(icItems.map(i => i.unit).filter(Boolean))].sort(), 'unit');
    populateDropdown('ic-location', 'ic-location-new', [...new Set(icItems.map(i => i.location).filter(Boolean))].sort(), '');
    renderCategoryChips([]);
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
    icStockTouched = false;
    icTargetInput.value = item.targetLevel;
    populateDropdown('ic-unit', 'ic-unit-new', [...new Set(icItems.map(i => i.unit).filter(Boolean))].sort(), item.unit);
    populateDropdown('ic-location', 'ic-location-new', [...new Set(icItems.map(i => i.location).filter(Boolean))].sort(), item.location || '');
    renderCategoryChips(item.categories ? [...item.categories] : []);
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

    const itemId = parseInt(icIdInput.value);

    // ONLY the fields this form owns. Everything else in the record — pendingQty,
    // pendingAt, pendingProvider, sublocation, lastChecked* — belongs to other screens.
    // Rebuilding a whole object here and set()-ing it is what silently deleted pending
    // orders: set() replaces the node, so every field the form does not know about is
    // erased. This is sent as a PATCH instead.
    const config = {
        name: icNameInput.value.trim(),
        targetLevel: parseFloat(icTargetInput.value),
        unit: getDropdownValue('ic-unit', 'ic-unit-new'),
        location: getDropdownValue('ic-location', 'ic-location-new'),
        categories: [...selectedCategories],
        displayOrder: parseInt(icDisplayOrderInput.value),
        providers: providers
    };

    // The stock is a snapshot taken when the form opened and never refreshed. Sending it
    // back unconditionally would undo a count made on the tablet meanwhile, so it only
    // travels when someone actually typed in that field.
    if (icStockTouched) config.currentLevel = parseFloat(icCurrentInput.value);
    
    let actionType = 'edit';
    let oldItem = null;
    
    // firebase-config.js is a module, so it can still be loading. Bail out BEFORE
    // touching the local array: showing a save the database never received is worse
    // than refusing the save.
    if (!window.firebaseDb || !window.firebaseDb.saveIcItem || !window.firebaseDb.saveIcItemFields) {
        showErrorMessage('Database not ready — wait a moment and try again.');
        return;
    }

    let updatedItem;
    let write;

    if (isAddingIc) {
// Make sure ID doesn't already exist
if (icItems.some(item => item.id === itemId)) {
    showErrorMessage('An I&C item with this ID already exists. Please use a different ID.');
    return;
}

// A brand-new node has nothing to preserve, so it is written whole.
updatedItem = Object.assign({
    id: itemId,
    currentLevel: parseFloat(icCurrentInput.value),
    lastCheckedTime: new Date().toISOString(),
    lastCheckedBy: 'Admin (DB Editor)'
}, config);
icItems.push(updatedItem);
actionType = 'add';
// Creation transactionnelle : si un autre poste a pris ce numero entre l'ouverture du
// formulaire et maintenant, l'id glisse au suivant libre au lieu d'ecraser son article.
write = window.firebaseDb.createIcItemUnique(updatedItem, itemId)
    .then(function (created) { Object.assign(updatedItem, created); return created; });
    } else {
// Update existing item
const index = icItems.findIndex(item => item.id === currentEditingIcId);
if (index === -1) {
    showErrorMessage('I&C item not found — reload the page and try again.');
    return;
}
// Store old item information for logging
oldItem = {...icItems[index]};

// MERGE into the live object, never replace it: the local copy must keep the
// fields this form never saw, exactly like the database node does.
updatedItem = Object.assign(icItems[index], config);

// Renaming the id is the one case where a patch will not do — it targets a node
// that does not exist yet. Fall back to a full write, as before.
write = (itemId === currentEditingIcId)
    ? window.firebaseDb.saveIcItemFields(currentEditingIcId, config)
    : window.firebaseDb.saveIcItem(Object.assign({}, updatedItem, { id: itemId }));
    }

    write
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
async function confirmDeleteIcItem() {
    const item = icItems.find(item => item.id === currentEditingIcId);
    if (!item) return;

    const confirmDelete = await confirmDialog({ title: 'Delete item?', message: `"${item.name}" will be permanently deleted. This cannot be undone.`, confirmText: 'Delete' });

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
