// DB Editor JavaScript

// Global variables
let prepItems = [];
let currentEditingId = null;
let isAdding = false;

// DOM Elements
let itemsTableBody;
let editForm;
let formTitle;
let itemIdInput;
let itemNameInput;
let itemCurrentInput;
let itemTargetInput;
let itemUnitInput;
let saveItemButton;
let cancelEditButton;
let deleteItemButton;
let addNewItemButton;
let itemDisplayOrderInput;

// Global variables for staff management
let staffMembers = [];
let currentEditingStaffId = null;
let isAddingStaff = false;

// DOM Elements for staff management
let staffTableBody;
let staffEditForm;
let staffFormTitle;
let staffIdInput;
let staffNameInput;
let staffActiveInput;
let saveStaffButton;
let cancelStaffEditButton;
let deleteStaffButton;
let addNewStaffButton;

// Shared sort function for prep items
function sortPrepItems() {
    prepItems.sort((a, b) => {
        if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
            return a.displayOrder - b.displayOrder;
        }
        return a.id - b.id;
    });
}

// Move a prep item up or down in display order
function moveItem(itemId, direction) {
    const currentIndex = prepItems.findIndex(item => item.id === itemId);
    const swapIndex = currentIndex + direction; // -1 for up, +1 for down

    if (currentIndex < 0 || swapIndex < 0 || swapIndex >= prepItems.length) return;

    const currentItem = prepItems[currentIndex];
    const swapItem = prepItems[swapIndex];

    if (currentItem.displayOrder === undefined) currentItem.displayOrder = currentItem.id;
    if (swapItem.displayOrder === undefined) swapItem.displayOrder = swapItem.id;

    // Swap displayOrder values
    const temp = currentItem.displayOrder;
    currentItem.displayOrder = swapItem.displayOrder;
    swapItem.displayOrder = temp;

    const dirLabel = direction === -1 ? 'up' : 'down';

    if (window.firebaseDb) {
        window.firebaseDb.saveAllItems([currentItem, swapItem])
            .then(() => {
                sortPrepItems();
                renderItemsTable();
                showSuccessMessage(`Item moved ${dirLabel} in order.`);
            })
            .catch(error => {
                console.error('Error saving items:', error);
                showErrorMessage('Failed to change item order.');
            });
    } else {
        sortPrepItems();
        renderItemsTable();
    }
}

// Initialize the tab navigation system
function initTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabSections = document.querySelectorAll('.tab-section');
    
    if (!tabButtons.length || !tabSections.length) {
        console.error('Tab navigation elements not found!');
        return;
    }
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            tabButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to the clicked button
            this.classList.add('active');
            
            // Get the target section ID
            const targetId = this.getAttribute('data-target');
            
            // Hide all sections
            tabSections.forEach(section => section.classList.remove('active'));
            
            // Show the target section
            document.getElementById(targetId).classList.add('active');
        });
    });
}

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    initApp();
    initTabNavigation();
});

function initApp() {
    
    // Get DOM elements
    itemsTableBody = document.getElementById('items-table-body');
    editForm = document.getElementById('edit-form');
    formTitle = document.getElementById('form-title');
    itemIdInput = document.getElementById('item-id');
    itemNameInput = document.getElementById('item-name');
    itemCurrentInput = document.getElementById('item-current');
    itemTargetInput = document.getElementById('item-target');
    itemUnitInput = document.getElementById('item-unit');
    saveItemButton = document.getElementById('save-item');
    cancelEditButton = document.getElementById('cancel-edit');
    deleteItemButton = document.getElementById('delete-item');
    addNewItemButton = document.getElementById('add-new-item');
    itemDisplayOrderInput = document.getElementById('item-display-order');
    
    // Check if elements exist
    if (!itemsTableBody || !editForm || !addNewItemButton) {
        console.error('Required DOM elements not found!');
        return;
    }
    
    // Load data from Firebase
    loadItemsFromFirebase();
    
    // Set up event listeners
    addNewItemButton.addEventListener('click', showAddNewForm);
    saveItemButton.addEventListener('click', saveItem);
    cancelEditButton.addEventListener('click', cancelEdit);
    deleteItemButton.addEventListener('click', confirmDeleteItem);
    
    // Close modal when clicking outside form
    editForm.addEventListener('click', function(e) {
        if (e.target === editForm) {
            cancelEdit();
        }
    });
    
    // Set up real-time updates
    if (window.firebaseDb) {
        window.firebaseDb.onItemsChange((updatedItems) => {
            if (updatedItems && updatedItems.length > 0) {
                prepItems = updatedItems;
                renderItemsTable();
            }
        });
    }
    
    // Initialize staff management
    initStaffManagement();
}

// Load items from Firebase
function loadItemsFromFirebase() {
    if (window.firebaseDb) {
        window.firebaseDb.loadItems()
            .then(items => {
                if (items && items.length > 0) {
                    prepItems = items;
                    sortPrepItems();
                    renderItemsTable();
                } else {
                    // Show empty state
                    itemsTableBody.innerHTML = `
                        <tr>
                            <td colspan="8" style="text-align: center; padding: 20px;">
                                No items found in database. Add your first item to get started.
                            </td>
                        </tr>
                    `;
                }
            })
            .catch(error => {
                console.error('Error loading items:', error);
                showErrorMessage('Failed to load items from database.');
            });
    } else {
        showErrorMessage('Firebase database not initialized.');
    }
}

// Render the items table
function renderItemsTable() {
    itemsTableBody.innerHTML = '';
    
    prepItems.forEach(item => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${item.displayOrder || item.id}</td>
            <td>${item.name}</td>
            <td>${item.currentLevel} ${item.unit}</td>
            <td>${item.targetLevel} ${item.unit}</td>
            <td>${item.unit}</td>
            <td>${item.lastCheckedTime || 'Never'}</td>
            <td>${item.lastCheckedBy || 'N/A'}</td>
            <td>
                <div style="display: flex; gap: 5px; justify-content: flex-end;">
                    <button class="edit-button" data-id="${item.id}">Edit</button>
                    <button class="move-up-button" data-id="${item.id}" title="Move Up" style="width: 36px; height: 36px; background-color: var(--primary-medium); color: white; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">&uarr;</button>
                    <button class="move-down-button" data-id="${item.id}" title="Move Down" style="width: 36px; height: 36px; background-color: var(--primary-medium); color: white; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">&darr;</button>
                </div>
            </td>
    `;
        
        itemsTableBody.appendChild(row);
        
        // Add event listener for this row's edit button immediately
        const editButton = row.querySelector('.edit-button');
        if (editButton) {
            editButton.addEventListener('click', function() {
                const itemId = parseInt(this.getAttribute('data-id'));
                showEditForm(itemId);
            });
        }
        
        // Add event listeners for move up/down buttons
        const moveUpButton = row.querySelector('.move-up-button');
        if (moveUpButton) {
            moveUpButton.addEventListener('click', function() {
                const itemId = parseInt(this.getAttribute('data-id'));
                moveItemUp(itemId);
            });
        }

        const moveDownButton = row.querySelector('.move-down-button');
        if (moveDownButton) {
            moveDownButton.addEventListener('click', function() {
                const itemId = parseInt(this.getAttribute('data-id'));
                moveItemDown(itemId);
            });
        }
    });
}

function moveItemUp(itemId) { moveItem(itemId, -1); }
function moveItemDown(itemId) { moveItem(itemId, 1); }

// Show the form for adding a new item
function showAddNewForm() {
    isAdding = true;
    currentEditingId = null;
    formTitle.textContent = 'Add New Item';
    
    // Generate a new ID (max ID + 1)
    const newId = prepItems.length > 0 
        ? Math.max(...prepItems.map(item => item.id)) + 1 
        : 1;
    
    // Clear and set default form values
    itemIdInput.value = newId;
    itemNameInput.value = '';
    itemCurrentInput.value = '0';
    itemTargetInput.value = '1';
    itemUnitInput.value = 'containers';
    itemDisplayOrderInput.value = newId; // Initially set display order to match ID
    
    // Hide delete button for new items
    deleteItemButton.classList.add('hidden');
    
    // Prevent scrolling on the body
    document.body.style.overflow = 'hidden';
    
    // Show the form
    editForm.classList.remove('hidden');
}

// Show the edit form for an existing item
function showEditForm(itemId) {
    const item = prepItems.find(item => item.id === itemId);
    if (!item) {
        console.error("Item not found:", itemId);
        return;
    }
    
    
    isAdding = false;
    currentEditingId = itemId;
    formTitle.textContent = `Edit Item: ${item.name}`;
    
    // Fill form with item data
    itemIdInput.value = item.id;
    itemNameInput.value = item.name;
    itemCurrentInput.value = item.currentLevel;
    itemTargetInput.value = item.targetLevel;
    itemUnitInput.value = item.unit;
    itemDisplayOrderInput.value = item.displayOrder || item.id; // Use ID as fallback if displayOrder doesn't exist yet
    
    // Show delete button for existing items
    deleteItemButton.classList.remove('hidden');
    
    // Prevent scrolling on the body
    document.body.style.overflow = 'hidden';
    
    // Show the form
    editForm.classList.remove('hidden');
}

// Save the current item (add or edit)
function saveItem() {
    // Validate form
    if (!validateForm()) return;
    
    // Create updated item object
    const updatedItem = {
        id: parseInt(itemIdInput.value),
        name: itemNameInput.value.trim(),
        currentLevel: parseFloat(itemCurrentInput.value),
        targetLevel: parseFloat(itemTargetInput.value),
        unit: itemUnitInput.value.trim(),
        displayOrder: parseInt(itemDisplayOrderInput.value),
        lastCheckedTime: new Date().toISOString(),
        lastCheckedBy: 'Admin (DB Editor)'
    };
    
    let actionType = 'edit';
    let oldItem = null;
    
    if (isAdding) {
        // Make sure ID doesn't already exist
        if (prepItems.some(item => item.id === updatedItem.id)) {
            showErrorMessage('An item with this ID already exists. Please use a different ID.');
            return;
        }
        
        // Add new item
        prepItems.push(updatedItem);
        actionType = 'add';
    } else {
        // Update existing item
        const index = prepItems.findIndex(item => item.id === currentEditingId);
        if (index !== -1) {
            // Store old item information for logging
            oldItem = {...prepItems[index]};
            
            // Preserve original last checked info if we're just editing configuration
            if (prepItems[index].lastCheckedTime) {
                updatedItem.lastCheckedTime = prepItems[index].lastCheckedTime;
            }
            if (prepItems[index].lastCheckedBy) {
                updatedItem.lastCheckedBy = prepItems[index].lastCheckedBy;
            }
            
            prepItems[index] = updatedItem;
        }
    }
    
    // Save to Firebase
    if (window.firebaseDb) {
        window.firebaseDb.saveItem(updatedItem)
            .then(() => {
                // Log the activity if history system is available
                if (window.historySystem && typeof window.historySystem.logItemModification === 'function') {
                    window.historySystem.logItemModification(
                        updatedItem,
                        'Admin (DB Editor)',
                        actionType,
                        oldItem
                    ).catch(error => {
                        console.error("Error logging activity:", error);
                    });
                }
                
                showSuccessMessage(isAdding ? 'Item added successfully.' : 'Item updated successfully.');
                renderItemsTable();
                cancelEdit(); // Hide the form
            })
            .catch(error => {
                console.error('Error saving item:', error);
                showErrorMessage('Failed to save item to database.');
            });
    }
}

// Validate the form before saving
function validateForm() {
    if (!itemNameInput.value.trim()) {
        showErrorMessage('Please enter an item name.');
        return false;
    }
    
    if (isNaN(itemCurrentInput.value) || parseFloat(itemCurrentInput.value) < 0) {
        showErrorMessage('Please enter a valid current level (must be 0 or greater).');
        return false;
    }
    
    if (isNaN(itemTargetInput.value) || parseFloat(itemTargetInput.value) <= 0) {
        showErrorMessage('Please enter a valid target level (must be greater than 0).');
        return false;
    }
    
    if (!itemUnitInput.value.trim()) {
        showErrorMessage('Please enter a unit (e.g., containers, kg, liters).');
        return false;
    }
    
    return true;
}

// Confirm before deleting an item
function confirmDeleteItem() {
    const item = prepItems.find(item => item.id === currentEditingId);
    if (!item) return;
    
    const confirmDelete = confirm(`Are you sure you want to delete "${item.name}"? This cannot be undone.`);
    
    if (confirmDelete) {
        deleteItem(currentEditingId);
    }
}

// Delete an item from the database
function deleteItem(itemId) {
    // Find the item before deleting it (for logging)
    const item = prepItems.find(item => item.id === itemId);
    
    if (window.firebaseDb) {
        window.firebaseDb.deleteItem(itemId)
            .then(() => {
                // Log the deletion if history system is available
                if (window.historySystem && typeof window.historySystem.logItemModification === 'function' && item) {
                    window.historySystem.logItemModification(
                        item,
                        'Admin (DB Editor)',
                        'delete'
                    ).catch(error => {
                        console.error("Error logging deletion:", error);
                    });
                }
                
                // Remove from local array
                prepItems = prepItems.filter(item => item.id !== itemId);
                showSuccessMessage('Item deleted successfully.');
                renderItemsTable();
                cancelEdit(); // Hide the form
            })
            .catch(error => {
                console.error('Error deleting item:', error);
                showErrorMessage('Failed to delete item from database.');
            });
    }
}

// Cancel editing and hide the form
function cancelEdit() {
    editForm.classList.add('hidden');
    
    // Enable scrolling on the body again
    document.body.style.overflow = 'auto';
    
    isAdding = false;
    currentEditingId = null;
}

// showSuccessMessage and showErrorMessage are now in notifications.js

// Staff Management Functions
// Initialize staff management
function initStaffManagement() {
    
    // Get DOM elements
    staffTableBody = document.getElementById('staff-table-body');
    staffEditForm = document.getElementById('staff-edit-form');
    staffFormTitle = document.getElementById('staff-form-title');
    staffIdInput = document.getElementById('staff-id');
    staffNameInput = document.getElementById('staff-name');
    staffActiveInput = document.getElementById('staff-active');
    saveStaffButton = document.getElementById('save-staff');
    cancelStaffEditButton = document.getElementById('cancel-staff-edit');
    deleteStaffButton = document.getElementById('delete-staff');
    addNewStaffButton = document.getElementById('add-new-staff');
    
    // Check if elements exist
    if (!staffTableBody || !staffEditForm || !addNewStaffButton) {
        console.error('Required staff management DOM elements not found!');
        return;
    }
    
    // Load data from Firebase
    loadStaffFromFirebase();
    
    // Set up event listeners
    addNewStaffButton.addEventListener('click', showAddNewStaffForm);
    saveStaffButton.addEventListener('click', saveStaffMember);
    cancelStaffEditButton.addEventListener('click', cancelStaffEdit);
    deleteStaffButton.addEventListener('click', confirmDeleteStaff);
    
    // Close modal when clicking outside form
    staffEditForm.addEventListener('click', function(e) {
        if (e.target === staffEditForm) {
            cancelStaffEdit();
        }
    });
    
    // Set up real-time updates
    if (window.firebaseDb && window.firebaseDb.onStaffChange) {
        window.firebaseDb.onStaffChange((updatedStaff) => {
            if (updatedStaff && updatedStaff.length > 0) {
                staffMembers = updatedStaff;
                renderStaffTable();
            }
        });
    }
}

// Load staff from Firebase
function loadStaffFromFirebase() {
    if (window.firebaseDb && window.firebaseDb.loadStaffMembers) {
        window.firebaseDb.loadStaffMembers()
            .then(staff => {
                if (staff && staff.length > 0) {
                    staffMembers = staff;
                    // Sort by ID for consistent display
                    staffMembers.sort((a, b) => a.id - b.id);
                    renderStaffTable();
                } else {
                    
                    // Create initial staff from the hardcoded list in index.html
                    const initialStaff = [
                        { id: 1, name: "Serge Men", active: true },
                        { id: 2, name: "Tatiana", active: true },
                        { id: 3, name: "Nadine", active: true },
                        { id: 4, name: "Nicolas", active: true },
                        { id: 5, name: "Omar", active: true }
                    ];
                    
                    // Save initial staff to Firebase
                    if (window.firebaseDb.saveAllStaffMembers) {
                        window.firebaseDb.saveAllStaffMembers(initialStaff)
                            .then(() => {
                                staffMembers = initialStaff;
                                renderStaffTable();
                                showSuccessMessage('Initial staff members created.');
                            })
                            .catch(error => {
                                console.error('Error saving initial staff:', error);
                                showErrorMessage('Failed to create initial staff members.');
                                
                                // Still display the hardcoded staff
                                staffMembers = initialStaff;
                                renderStaffTable();
                            });
                    } else {
                        // Show empty state
                        staffTableBody.innerHTML = `
                            <tr>
                                <td colspan="4" style="text-align: center; padding: 20px;">
                                    No staff members found in database. Add your first staff member to get started.
                                </td>
                            </tr>
                        `;
                    }
                }
            })
            .catch(error => {
                console.error('Error loading staff:', error);
                showErrorMessage('Failed to load staff members from database.');
            });
    } else {
        showErrorMessage('Firebase database functions for staff not available.');
    }
}

// Render the staff table
function renderStaffTable() {
    staffTableBody.innerHTML = '';
    
    staffMembers.forEach(staff => {
        const row = document.createElement('tr');
        
        const activeStatus = staff.active ? 
            '<span style="color: green; font-weight: bold;">Yes</span>' : 
            '<span style="color: red;">No</span>';
        
        row.innerHTML = `
            <td>${staff.id}</td>
            <td>${staff.name}</td>
            <td>${activeStatus}</td>
            <td>
                <button class="edit-button" data-id="${staff.id}">Edit</button>
            </td>
        `;
        
        staffTableBody.appendChild(row);
        
        // Add event listener for this row's edit button immediately
        const editButton = row.querySelector('.edit-button');
        if (editButton) {
            editButton.addEventListener('click', function() {
                const staffId = parseInt(this.getAttribute('data-id'));
                showEditStaffForm(staffId);
            });
        }
    });
}

// Show the form for adding a new staff member
function showAddNewStaffForm() {
    isAddingStaff = true;
    currentEditingStaffId = null;
    staffFormTitle.textContent = 'Add New Staff Member';
    
    // Generate a new ID (max ID + 1)
    const newId = staffMembers.length > 0 
        ? Math.max(...staffMembers.map(staff => staff.id)) + 1 
        : 1;
    
    // Clear and set default form values
    staffIdInput.value = newId;
    staffNameInput.value = '';
    staffActiveInput.value = 'true';
    
    // Hide delete button for new staff
    deleteStaffButton.classList.add('hidden');
    
    // Prevent scrolling on the body
    document.body.style.overflow = 'hidden';
    
    // Show the form
    staffEditForm.classList.remove('hidden');
}

// Show the edit form for an existing staff member
function showEditStaffForm(staffId) {
    const staff = staffMembers.find(s => s.id === staffId);
    if (!staff) {
        console.error("Staff member not found:", staffId);
        return;
    }
    
    
    isAddingStaff = false;
    currentEditingStaffId = staffId;
    staffFormTitle.textContent = `Edit Staff Member: ${staff.name}`;
    
    // Fill form with staff data
    staffIdInput.value = staff.id;
    staffNameInput.value = staff.name;
    staffActiveInput.value = staff.active.toString();
    
    // Show delete button for existing staff
    deleteStaffButton.classList.remove('hidden');
    
    // Prevent scrolling on the body
    document.body.style.overflow = 'hidden';
    
    // Show the form
    staffEditForm.classList.remove('hidden');
}

// Save the current staff member (add or edit)
function saveStaffMember() {
    // Validate form
    if (!validateStaffForm()) return;
    
    // Create updated staff object
    const updatedStaff = {
        id: parseInt(staffIdInput.value),
        name: staffNameInput.value.trim(),
        active: staffActiveInput.value === 'true'
    };
    
    if (isAddingStaff) {
        // Make sure ID doesn't already exist
        if (staffMembers.some(staff => staff.id === updatedStaff.id)) {
            showErrorMessage('A staff member with this ID already exists. Please use a different ID.');
            return;
        }
        
        // Add new staff
        staffMembers.push(updatedStaff);
    } else {
        // Update existing staff
        const index = staffMembers.findIndex(staff => staff.id === currentEditingStaffId);
        if (index !== -1) {
            staffMembers[index] = updatedStaff;
        }
    }
    
    // Save to Firebase
    if (window.firebaseDb && window.firebaseDb.saveStaffMember) {
        window.firebaseDb.saveStaffMember(updatedStaff)
            .then(() => {
                showSuccessMessage(isAddingStaff ? 'Staff member added successfully.' : 'Staff member updated successfully.');
                renderStaffTable();
                cancelStaffEdit(); // Hide the form
            })
            .catch(error => {
                console.error('Error saving staff member:', error);
                showErrorMessage('Failed to save staff member to database.');
            });
    }
}

// Validate the staff form before saving
function validateStaffForm() {
    if (!staffNameInput.value.trim()) {
        showErrorMessage('Please enter a staff member name.');
        return false;
    }
    
    return true;
}

// Confirm before deleting a staff member
function confirmDeleteStaff() {
    const staff = staffMembers.find(staff => staff.id === currentEditingStaffId);
    if (!staff) return;
    
    const confirmDelete = confirm(`Are you sure you want to delete "${staff.name}"? This cannot be undone.`);
    
    if (confirmDelete) {
        deleteStaffMember(currentEditingStaffId);
    }
}

// Delete a staff member from the database
function deleteStaffMember(staffId) {
    if (window.firebaseDb && window.firebaseDb.deleteStaffMember) {
        window.firebaseDb.deleteStaffMember(staffId)
            .then(() => {
                // Remove from local array
                staffMembers = staffMembers.filter(staff => staff.id !== staffId);
                showSuccessMessage('Staff member deleted successfully.');
                renderStaffTable();
                cancelStaffEdit(); // Hide the form
            })
            .catch(error => {
                console.error('Error deleting staff member:', error);
                showErrorMessage('Failed to delete staff member from database.');
            });
    }
}

// Cancel editing and hide the form
function cancelStaffEdit() {
    staffEditForm.classList.add('hidden');
    
    // Enable scrolling on the body again
    document.body.style.overflow = 'auto';
    
    isAddingStaff = false;
    currentEditingStaffId = null;
}