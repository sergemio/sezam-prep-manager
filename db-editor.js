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
                sortPrepItems();
                renderItemsTable();
            }
        });
    }
    
    // Initialize staff management
    initStaffManagement();

    // Initialize tasks management
    initTasksManagement();

    // Initialize checklists management
    initChecklistsManagement();
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
                            <td colspan="8" class="empty-state-cell">
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

// Format date for display
function formatCheckDate(isoString) {
    if (!isoString) return '<span class="text-muted">Never</span>';
    try {
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return isoString;
        const now = new Date();
        const diffH = Math.floor((now - d) / 3600000);
        if (diffH < 1) return 'Just now';
        if (diffH < 24) return diffH + 'h ago';
        const day = d.getDate();
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return day + ' ' + months[d.getMonth()] + ', ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    } catch(e) { return isoString; }
}

// Stock level color class
function stockClass(current, target) {
    if (target <= 0) return '';
    const pct = current / target;
    if (pct <= 0.25) return 'stock-critical';
    if (pct <= 0.5) return 'stock-low';
    if (pct < 1) return 'stock-ok';
    return 'stock-full';
}

// Render the items table
function renderItemsTable() {
    itemsTableBody.innerHTML = '';

    prepItems.forEach((item, index) => {
        const row = document.createElement('tr');
        row.setAttribute('data-id', item.id);
        row.style.cursor = 'pointer';

        const sc = stockClass(item.currentLevel, item.targetLevel);

        row.innerHTML = `
            <td class="drag-cell"><span class="drag-handle" title="Drag to reorder">☰</span></td>
            <td class="item-name-cell">${item.name}</td>
            <td class="${sc}">${item.currentLevel} ${item.unit}</td>
            <td>${item.targetLevel} ${item.unit}</td>
            <td>${formatCheckDate(item.lastCheckedTime)}</td>
            <td>${item.lastCheckedBy || '<span class="text-muted">—</span>'}</td>
    `;

        itemsTableBody.appendChild(row);

        // Click anywhere on row to edit (except drag handle)
        row.addEventListener('click', function(e) {
            if (e.target.closest('.drag-handle')) return;
            showEditForm(parseInt(this.getAttribute('data-id')));
        });
    });

    initDragAndDrop(itemsTableBody, prepItems, 'prep');
}

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
                                <td colspan="4" class="empty-state-cell">
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
        row.setAttribute('data-id', staff.id);
        row.style.cursor = 'pointer';

        const activeStatus = staff.active ?
            '<span class="status-active">Active</span>' :
            '<span class="status-inactive">Inactive</span>';

        row.innerHTML = `
            <td class="item-name-cell">${staff.name}</td>
            <td>${activeStatus}</td>
        `;

        staffTableBody.appendChild(row);

        row.addEventListener('click', function() {
            showEditStaffForm(parseInt(this.getAttribute('data-id')));
        });
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

// === TASKS MANAGEMENT ===
let allTasks = [];
let isAddingTask = false;
let currentEditingTaskId = null;

const tasksTableBody = document.getElementById('tasks-table-body');
const addTaskButton = document.getElementById('add-task-button');
const taskEditForm = document.getElementById('task-edit-form');
const taskFormTitle = document.getElementById('task-form-title');
const taskTitleInput = document.getElementById('task-title-input');
const taskDescriptionInput = document.getElementById('task-description-input');
const taskTypeInput = document.getElementById('task-type-input');
const taskFrequencyInput = document.getElementById('task-frequency-input');
const taskFrequencyGroup = document.getElementById('task-frequency-group');
const taskScheduledGroup = document.getElementById('task-scheduled-group');
const taskDateInput = document.getElementById('task-date-input');
const taskTimeInput = document.getElementById('task-time-input');
const taskActiveInput = document.getElementById('task-active-input');
const saveTaskButton = document.getElementById('save-task');
const cancelTaskEditButton = document.getElementById('cancel-task-edit');
const deleteTaskButton = document.getElementById('delete-task');

function updateTaskTypeFields() {
    const type = taskTypeInput.value;
    taskFrequencyGroup.classList.toggle('hidden', type !== 'recurring');
    taskScheduledGroup.classList.toggle('hidden', type !== 'scheduled');
}

function renderTasksTable() {
    tasksTableBody.innerHTML = '';
    if (allTasks.length === 0) {
        tasksTableBody.innerHTML = '<tr><td colspan="5" class="empty-state-cell">No tasks defined yet</td></tr>';
        return;
    }
    allTasks.forEach(task => {
        const row = document.createElement('tr');
        row.setAttribute('data-task-id', task.id);
        row.style.cursor = 'pointer';

        let freqDisplay = '';
        if (task.type === 'recurring') {
            freqDisplay = `Every ${task.frequencyDays} day${task.frequencyDays > 1 ? 's' : ''}`;
        } else if (task.type === 'scheduled') {
            freqDisplay = task.scheduledDate + (task.scheduledTime ? ' ' + task.scheduledTime : '');
        } else {
            freqDisplay = '\u2014';
        }

        let lastDone = '<span class="text-muted">Never</span>';
        if (task.lastCompletedAt) {
            lastDone = formatCheckDate(task.lastCompletedAt) + ' by ' + (task.lastCompletedBy || '?');
        }

        row.innerHTML = `
            <td class="item-name-cell">${task.title || task.name || 'Untitled'}</td>
            <td>${task.type}</td>
            <td>${freqDisplay}</td>
            <td><span class="${task.active ? 'status-active' : 'status-inactive'}">${task.active ? 'Active' : 'Inactive'}</span></td>
            <td>${lastDone}</td>
        `;
        tasksTableBody.appendChild(row);
        row.addEventListener('click', function() {
            showEditTaskForm(this.getAttribute('data-task-id'));
        });
    });
}

function showAddTaskForm() {
    isAddingTask = true;
    currentEditingTaskId = null;
    taskFormTitle.textContent = 'Add New Task';
    taskTitleInput.value = '';
    taskDescriptionInput.value = '';
    taskTypeInput.value = 'recurring';
    taskFrequencyInput.value = 1;
    taskDateInput.value = '';
    taskTimeInput.value = '';
    taskActiveInput.checked = true;
    document.querySelectorAll('.day-toggle').forEach(function(btn) { btn.classList.remove('active'); });
    document.getElementById('task-schedule-time').value = '';
    updateTaskTypeFields();
    deleteTaskButton.classList.add('hidden');
    document.body.style.overflow = 'hidden';
    taskEditForm.classList.remove('hidden');
}

function showEditTaskForm(taskId) {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;
    isAddingTask = false;
    currentEditingTaskId = taskId;
    taskFormTitle.textContent = 'Edit Task: ' + task.title;
    taskTitleInput.value = task.title;
    taskDescriptionInput.value = task.description || '';
    taskTypeInput.value = task.type;
    taskFrequencyInput.value = task.frequencyDays || 1;
    taskDateInput.value = task.scheduledDate || '';
    taskTimeInput.value = task.scheduledTime || '';
    taskActiveInput.checked = task.active;
    document.querySelectorAll('.day-toggle').forEach(function(btn) {
        btn.classList.remove('active');
        if (task.scheduleDays && task.scheduleDays.indexOf(parseInt(btn.getAttribute('data-day'))) !== -1) {
            btn.classList.add('active');
        }
    });
    document.getElementById('task-schedule-time').value = task.scheduleTime || '';
    updateTaskTypeFields();
    deleteTaskButton.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    taskEditForm.classList.remove('hidden');
}

function cancelTaskEdit() {
    taskEditForm.classList.add('hidden');
    document.body.style.overflow = 'auto';
    isAddingTask = false;
    currentEditingTaskId = null;
}

function saveTask() {
    const title = taskTitleInput.value.trim();
    if (!title) {
        showErrorMessage('Title is required');
        return;
    }
    const type = taskTypeInput.value;
    const task = {
        id: currentEditingTaskId || 'task_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
        title: title,
        name: title,
        description: taskDescriptionInput.value.trim(),
        type: type,
        active: taskActiveInput.checked,
        createdAt: isAddingTask ? new Date().toISOString() : (allTasks.find(t => t.id === currentEditingTaskId)?.createdAt || new Date().toISOString()),
        createdBy: isAddingTask ? 'admin' : (allTasks.find(t => t.id === currentEditingTaskId)?.createdBy || 'admin')
    };
    if (type === 'recurring') {
        task.frequencyDays = parseInt(taskFrequencyInput.value) || 1;
    }
    if (type === 'scheduled') {
        task.scheduledDate = taskDateInput.value;
        task.scheduledTime = taskTimeInput.value || null;
    }
    var selectedDays = [];
    document.querySelectorAll('.day-toggle.active').forEach(function(btn) {
        selectedDays.push(parseInt(btn.getAttribute('data-day')));
    });
    task.scheduleDays = selectedDays.length > 0 ? selectedDays : null;
    task.scheduleTime = document.getElementById('task-schedule-time').value || null;
    // Preserve completion state on edit
    if (!isAddingTask) {
        const existing = allTasks.find(t => t.id === currentEditingTaskId);
        if (existing) {
            task.lastCompletedAt = existing.lastCompletedAt || null;
            task.lastCompletedBy = existing.lastCompletedBy || null;
        }
    }
    window.firebaseDb.saveTask(task).then(() => {
        showSuccessMessage(isAddingTask ? 'Task created' : 'Task updated');
        cancelTaskEdit();
    });
}

function deleteTask() {
    if (!currentEditingTaskId) return;
    if (!confirm('Delete this task?')) return;
    window.firebaseDb.deleteTasks(currentEditingTaskId).then(() => {
        showSuccessMessage('Task deleted');
        cancelTaskEdit();
    });
}

// Tasks listeners
if (addTaskButton) addTaskButton.addEventListener('click', showAddTaskForm);
if (saveTaskButton) saveTaskButton.addEventListener('click', saveTask);
if (cancelTaskEditButton) cancelTaskEditButton.addEventListener('click', cancelTaskEdit);
if (deleteTaskButton) deleteTaskButton.addEventListener('click', deleteTask);
if (taskTypeInput) taskTypeInput.addEventListener('change', updateTaskTypeFields);

// Click outside modal to close
if (taskEditForm) {
    taskEditForm.addEventListener('click', function(e) {
        if (e.target === taskEditForm) cancelTaskEdit();
    });
}

function initTasksManagement() {
    if (window.firebaseDb) {
        window.firebaseDb.onTasksChange(function(tasks) {
            allTasks = tasks || [];
            renderTasksTable();
        });
    }
    // Day toggle click handlers
    document.querySelectorAll('.day-toggle').forEach(function(btn) {
        btn.addEventListener('click', function() {
            btn.classList.toggle('active');
        });
    });
}

function initChecklistsManagement() {
    if (!window.firebaseDb) return;

    var openingItemsList = [];
    var closingItemsList = [];
    var editingChecklistItem = null; // { type, item, helpers }

    // Toggle sections
    function setupToggle(toggleId, contentId, countId) {
        var toggle = document.getElementById(toggleId);
        var content = document.getElementById(contentId);
        if (!toggle || !content) return;
        toggle.addEventListener('click', function(e) {
            if (e.target.closest('.add-new-button')) return; // don't toggle when clicking Add
            var arrow = toggle.querySelector('.toggle-arrow');
            if (content.style.display === 'none') {
                content.style.display = 'block';
                if (arrow) arrow.textContent = '▼';
            } else {
                content.style.display = 'none';
                if (arrow) arrow.textContent = '▶';
            }
        });
    }
    setupToggle('opening-toggle', 'opening-content', 'opening-count');
    setupToggle('closing-toggle', 'closing-content', 'closing-count');

    // Edit modal elements
    var editModal = document.getElementById('checklist-edit-modal');
    var editNameInput = document.getElementById('checklist-item-name-input');
    var editTitle = document.getElementById('checklist-edit-title');
    var saveBtn = document.getElementById('save-checklist-item');
    var cancelBtn = document.getElementById('cancel-checklist-edit');

    if (cancelBtn) cancelBtn.addEventListener('click', closeEditModal);
    if (editModal) editModal.addEventListener('click', function(e) {
        if (e.target === editModal) closeEditModal();
    });

    function showEditModal(title, currentName) {
        if (!editModal) return;
        editTitle.textContent = title;
        editNameInput.value = currentName;
        editModal.classList.remove('hidden');
        editNameInput.focus();
    }
    function closeEditModal() {
        if (editModal) editModal.classList.add('hidden');
        editingChecklistItem = null;
    }

    window.firebaseDb.opening.onItemsChange(function(items) {
        openingItemsList = items;
        renderChecklistTable('opening-items-body', items, 'opening');
        var count = document.getElementById('opening-count');
        if (count) count.textContent = '(' + items.length + ')';
    });
    window.firebaseDb.closing.onItemsChange(function(items) {
        closingItemsList = items;
        renderChecklistTable('closing-items-body', items, 'closing');
        var count = document.getElementById('closing-count');
        if (count) count.textContent = '(' + items.length + ')';
    });

    function renderChecklistTable(tbodyId, items, type) {
        var oldTbody = document.getElementById(tbodyId);
        if (!oldTbody) return;
        // Clone and replace to avoid duplicate event listeners on re-render
        var tbody = oldTbody.cloneNode(false);
        oldTbody.parentNode.replaceChild(tbody, oldTbody);

        items.forEach(function(item) {
            var tr = document.createElement('tr');
            tr.setAttribute('data-id', item.id);
            tr.innerHTML =
                '<td class="drag-handle" style="cursor:grab;text-align:center">☰</td>' +
                '<td>' + item.name + '</td>' +
                '<td class="actions-cell">' +
                    '<button class="btn btn-sm" data-action="edit" data-type="' + type + '" data-id="' + item.id + '">Edit</button> ' +
                    '<button class="btn btn-sm" style="color:#ef4444" data-action="delete" data-type="' + type + '" data-id="' + item.id + '">Del</button>' +
                '</td>';
            tbody.appendChild(tr);
        });

        // Wire button events via delegation
        tbody.addEventListener('click', function(e) {
            var btn = e.target.closest('[data-action]');
            if (!btn) return;
            var action = btn.getAttribute('data-action');
            var btnType = btn.getAttribute('data-type');
            var id = btn.getAttribute('data-id');
            if (action === 'edit') editChecklistItem(btnType, id);
            if (action === 'delete') deleteChecklistItem(btnType, id);
        });

        // Wire drag & drop
        if (typeof initDragAndDrop === 'function') {
            initDragAndDrop(tbody, items, 'checklist-' + type);
        }
    }

    function editChecklistItem(type, itemId) {
        var helpers = type === 'opening' ? window.firebaseDb.opening : window.firebaseDb.closing;
        var items = type === 'opening' ? openingItemsList : closingItemsList;
        var item = items.find(function(i) { return i.id === itemId; });
        if (!item) return;
        editingChecklistItem = { type: type, item: item, helpers: helpers };
        showEditModal('Modifier — ' + (type === 'opening' ? 'Opening' : 'Closing'), item.name);
    }

    function deleteChecklistItem(type, itemId) {
        if (!confirm('Supprimer cet item ?')) return;
        var helpers = type === 'opening' ? window.firebaseDb.opening : window.firebaseDb.closing;
        helpers.deleteItem(itemId);
    }

    document.getElementById('add-opening-item').addEventListener('click', function() {
        editingChecklistItem = {
            type: 'opening',
            item: null,
            helpers: window.firebaseDb.opening,
            isNew: true,
            order: openingItemsList.length + 1
        };
        showEditModal('Ajouter — Opening', '');
    });
    document.getElementById('add-closing-item').addEventListener('click', function() {
        editingChecklistItem = {
            type: 'closing',
            item: null,
            helpers: window.firebaseDb.closing,
            isNew: true,
            order: closingItemsList.length + 1
        };
        showEditModal('Ajouter — Closing', '');
    });

    // Update save to handle both edit and add
    if (saveBtn) {
        saveBtn.removeEventListener('click', saveBtn._handler);
        saveBtn._handler = function() {
            if (!editingChecklistItem || !editNameInput.value.trim()) return;
            if (editingChecklistItem.isNew) {
                var prefix = editingChecklistItem.type === 'opening' ? 'op_' : 'cl_';
                var newItem = {
                    id: prefix + Date.now(),
                    name: editNameInput.value.trim(),
                    order: editingChecklistItem.order
                };
                editingChecklistItem.helpers.saveItem(newItem);
            } else {
                editingChecklistItem.item.name = editNameInput.value.trim();
                editingChecklistItem.helpers.saveItem(editingChecklistItem.item);
            }
            closeEditModal();
        };
        saveBtn.addEventListener('click', saveBtn._handler);
    }
}