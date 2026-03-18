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

// Initialize I&C items management
function initIcItemsManagement() {
    console.log('I&C Items Management initialized');
    
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
            // Sort by displayOrder/ID first, then location, then sublocation
            icItems.sort((a, b) => {
                // First by displayOrder if both items have it
                if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
                    return a.displayOrder - b.displayOrder;
                }
                
                // Otherwise use ID as fallback for order
                if (a.displayOrder !== undefined && b.displayOrder === undefined) {
                    return -1; // Items with display order come first
                }
                if (a.displayOrder === undefined && b.displayOrder !== undefined) {
                    return 1; // Items with display order come first
                }
                
                // If neither has displayOrder, sort by ID
                if (a.id !== b.id) {
                    return a.id - b.id;
                }
                
                // Then by location
                if (a.location !== b.location) {
                    return a.location.localeCompare(b.location);
                }
                
                // Then by sublocation
                if ((a.sublocation || '') !== (b.sublocation || '')) {
                    return (a.sublocation || '').localeCompare(b.sublocation || '');
                }
                
                return 0;
            });
            renderIcItemsTable();
        } else {
            // Show empty state
            icTableBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 20px;">
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
    
    icItems.forEach(item => {
const row = document.createElement('tr');

// Format providers for display
let providersDisplay = '';
if (item.providers && item.providers.length > 0) {
    providersDisplay = item.providers.join(', ');
} else {
    providersDisplay = '<span style="color: #888;">None</span>';
}

// Format sublocation for display
let sublocationDisplay = item.sublocation || '<span style="color: #888;">General</span>';

row.innerHTML = `
    <td>${item.displayOrder || item.id}</td>
    <td>${item.name}</td>
    <td>${item.currentLevel} ${item.unit}</td>
    <td>${item.targetLevel} ${item.unit}</td>
    <td>${item.location}</td>
    <td>${sublocationDisplay}</td>
    <td>${providersDisplay}</td>
    <td>${item.lastCheckedTime ? new Date(item.lastCheckedTime).toLocaleString() : 'Never'}</td>
    <td>
        <div style="display: flex; gap: 5px; justify-content: flex-end;">
            <button class="edit-button" data-id="${item.id}">Edit</button>
            <button class="move-up-button" data-id="${item.id}" title="Move Up" style="width: 36px; height: 36px; background-color: var(--primary-medium); color: white; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">&uarr;</button>
            <button class="move-down-button" data-id="${item.id}" title="Move Down" style="width: 36px; height: 36px; background-color: var(--primary-medium); color: white; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">&darr;</button>
        </div>
    </td>
`;

icTableBody.appendChild(row);

// Add event listener for this row's edit button immediately
const editButton = row.querySelector('.edit-button');
if (editButton) {
    editButton.addEventListener('click', function() {
        const itemId = parseInt(this.getAttribute('data-id'));
        console.log('Edit button clicked for I&C item ID:', itemId);
        showEditIcForm(itemId);
    });
}

// Add event listeners for move up/down buttons
const moveUpButton = row.querySelector('.move-up-button');
if (moveUpButton) {
    moveUpButton.addEventListener('click', function() {
        const itemId = parseInt(this.getAttribute('data-id'));
        moveIcItemUp(itemId);
    });
}

const moveDownButton = row.querySelector('.move-down-button');
if (moveDownButton) {
    moveDownButton.addEventListener('click', function() {
        const itemId = parseInt(this.getAttribute('data-id'));
        moveIcItemDown(itemId);
    });
}
    });
}

// Function to move an I&C item up in the display order within its location/sublocation
function moveIcItemUp(itemId) {
    // Find the current item's index in the array
    const currentIndex = icItems.findIndex(item => item.id === itemId);
    if (currentIndex <= 0) {
// Already at the top, can't move up
return;
    }
    
    // Get the current item
    const currentItem = icItems[currentIndex];
    
    // Find the item above it that has the same location and sublocation
    let aboveIndex = -1;
    for (let i = currentIndex - 1; i >= 0; i--) {
if (icItems[i].location === currentItem.location && 
    (icItems[i].sublocation || '') === (currentItem.sublocation || '')) {
    aboveIndex = i;
    break;
}
    }
    
    if (aboveIndex === -1) {
// No item above with same location/sublocation, can't move up
return;
    }
    
    const aboveItem = icItems[aboveIndex];
    
    // Make sure both items have displayOrder set
    if (currentItem.displayOrder === undefined) {
currentItem.displayOrder = currentItem.id;
    }
    if (aboveItem.displayOrder === undefined) {
aboveItem.displayOrder = aboveItem.id;
    }
    
    // Swap the displayOrder values
    const tempOrder = currentItem.displayOrder;
    currentItem.displayOrder = aboveItem.displayOrder;
    aboveItem.displayOrder = tempOrder;
    
    // Save both items to Firebase
    if (window.firebaseDb && window.firebaseDb.saveAllIcItems) {
// Update Firebase
window.firebaseDb.saveAllIcItems([currentItem, aboveItem])
    .then(() => {
        // Re-sort the array
        icItems.sort((a, b) => {
            // First by location
            if (a.location !== b.location) {
                return a.location.localeCompare(b.location);
            }
            
            // Then by sublocation
            if ((a.sublocation || '') !== (b.sublocation || '')) {
                return (a.sublocation || '').localeCompare(b.sublocation || '');
            }
            
            // Then by displayOrder
            if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
                return a.displayOrder - b.displayOrder;
            }
            
            // Fallback to ID
            return a.id - b.id;
        });
        
        // Re-render the table to show the new order
        renderIcItemsTable();
        showSuccessMessage('I&C item moved up in order.');
    })
    .catch(error => {
        console.error('Error saving I&C items:', error);
        showErrorMessage('Failed to change I&C item order.');
    });
    } else {
// Re-sort and re-render locally if Firebase not available
icItems.sort((a, b) => {
    // First by location
    if (a.location !== b.location) {
        return a.location.localeCompare(b.location);
    }
    
    // Then by sublocation
    if ((a.sublocation || '') !== (b.sublocation || '')) {
        return (a.sublocation || '').localeCompare(b.sublocation || '');
    }
    
    // Then by displayOrder
    if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
        return a.displayOrder - b.displayOrder;
    }
    
    // Fallback to ID
    return a.id - b.id;
});

renderIcItemsTable();
    }
}

// Function to move an I&C item down in the display order within its location/sublocation
function moveIcItemDown(itemId) {
    // Find the current item's index in the array
    const currentIndex = icItems.findIndex(item => item.id === itemId);
    if (currentIndex < 0 || currentIndex >= icItems.length - 1) {
// Already at the bottom, can't move down
return;
    }
    
    // Get the current item
    const currentItem = icItems[currentIndex];
    
    // Find the item below it that has the same location and sublocation
    let belowIndex = -1;
    for (let i = currentIndex + 1; i < icItems.length; i++) {
if (icItems[i].location === currentItem.location && 
    (icItems[i].sublocation || '') === (currentItem.sublocation || '')) {
    belowIndex = i;
    break;
}
    }
    
    if (belowIndex === -1) {
// No item below with same location/sublocation, can't move down
return;
    }
    
    const belowItem = icItems[belowIndex];
    
    // Make sure both items have displayOrder set
    if (currentItem.displayOrder === undefined) {
currentItem.displayOrder = currentItem.id;
    }
    if (belowItem.displayOrder === undefined) {
belowItem.displayOrder = belowItem.id;
    }
    
    // Swap the displayOrder values
    const tempOrder = currentItem.displayOrder;
    currentItem.displayOrder = belowItem.displayOrder;
    belowItem.displayOrder = tempOrder;
    
    // Save both items to Firebase
    if (window.firebaseDb && window.firebaseDb.saveAllIcItems) {
// Update Firebase
window.firebaseDb.saveAllIcItems([currentItem, belowItem])
    .then(() => {
        // Re-sort the array
        icItems.sort((a, b) => {
            // First by location
            if (a.location !== b.location) {
                return a.location.localeCompare(b.location);
            }
            
            // Then by sublocation
            if ((a.sublocation || '') !== (b.sublocation || '')) {
                return (a.sublocation || '').localeCompare(b.sublocation || '');
            }
            
            // Then by displayOrder
            if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
                return a.displayOrder - b.displayOrder;
            }
            
            // Fallback to ID
            return a.id - b.id;
        });
        
        // Re-render the table to show the new order
        renderIcItemsTable();
        showSuccessMessage('I&C item moved down in order.');
    })
    .catch(error => {
        console.error('Error saving I&C items:', error);
        showErrorMessage('Failed to change I&C item order.');
    });
    } else {
// Re-sort and re-render locally if Firebase not available
icItems.sort((a, b) => {
    // First by location
    if (a.location !== b.location) {
        return a.location.localeCompare(b.location);
    }
    
    // Then by sublocation
    if ((a.sublocation || '') !== (b.sublocation || '')) {
        return (a.sublocation || '').localeCompare(b.sublocation || '');
    }
    
    // Then by displayOrder
    if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
        return a.displayOrder - b.displayOrder;
    }
    
    // Fallback to ID
    return a.id - b.id;
});

renderIcItemsTable();
    }
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
    
    console.log("Showing edit form for I&C item:", item);
    
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
