// Script.js - Fixed version for Firebase data loading

// Sample initial data (kept for potential first-time setup)
const initialPrepItems = [
    { id: 1, name: 'Chopped Onions', currentLevel: 2, targetLevel: 5, unit: 'containers', lastCheckedBy: 'Alex', lastCheckedTime: '2025-03-09 08:30', updateType: 'count' },
    { id: 2, name: 'Sliced Tomatoes', currentLevel: 1, targetLevel: 4, unit: 'containers', lastCheckedBy: 'Maria', lastCheckedTime: '2025-03-09 07:45', updateType: 'count' },
    { id: 3, name: 'Diced Chicken', currentLevel: 0, targetLevel: 3, unit: 'kg', lastCheckedBy: 'John', lastCheckedTime: '2025-03-08 19:20', updateType: 'count' },
    { id: 4, name: 'Mixed Salad', currentLevel: 3, targetLevel: 4, unit: 'kg', lastCheckedBy: 'Maria', lastCheckedTime: '2025-03-09 09:10', updateType: 'count' },
    { id: 5, name: 'Sauce Base', currentLevel: 1, targetLevel: 5, unit: 'liters', lastCheckedBy: 'John', lastCheckedTime: '2025-03-08 20:15', updateType: 'count' }
];

// Helper function to format dates consistently
function formatDate(dateString) {
    // Parse the date from string
    const date = new Date(dateString);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
        // Return original string if parsing fails
        return dateString;
    }
    
    // Define month names
    const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    
    // Get date components
    const day = date.getDate();
    const month = monthNames[date.getMonth()];
    
    // Format hours and minutes with leading zeros if needed
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    // Return formatted date string
    return `${day} ${month}, ${hours}:${minutes}`;
}

// Creates a fuchsia user button for modals (reuses existing style + toggleModalUserDropdown)
function createModalUserPicker() {
    const btn = document.createElement('button');
    btn.className = 'user-login-btn';
    btn.style.fontSize = '14px';
    btn.style.padding = '6px 14px';
    btn.innerHTML = `${currentStaff || 'Select user'} <span style="font-size:12px;">\u25BC</span>`;
    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleModalUserDropdown(btn);
    });
    return btn;
}

// App state
let prepItems = [...initialPrepItems];
let currentStaff = '';
let currentItemIndex = 0;
let openingItems = [];
let closingItems = [];
let openingStatus = {};
let closingStatus = {};
let currentDateKey = '';

// Toast notification for user switch
function showUserSwitchToast(name) {
    const existing = document.querySelector('.user-switch-toast');
    if (existing) existing.remove();

    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase();
    const toast = document.createElement('div');
    toast.className = 'user-switch-toast';
    toast.innerHTML = `<span class="toast-initials">${initials}</span><span class="toast-name">${name}</span>`;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
        toast.classList.add('hide');
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 1500);
}
let isChecking = false;
let tasks = [];

// Function to load staff members dynamically
function loadStaffMembers() {
    // Clear existing staff buttons
    const staffGrid = document.querySelector('.staff-grid');
    if (!staffGrid) {
        console.error('Staff grid not found');
        return;
    }
    
    staffGrid.innerHTML = '';
    
    // Show loading indicator
    staffGrid.innerHTML = '<div class="loading-staff">Loading staff members...</div>';
    
    // Check if Firebase is available
    if (window.firebaseDb && window.firebaseDb.loadStaffMembers) {
        // Load staff from Firebase
        window.firebaseDb.loadStaffMembers()
            .then(staffMembers => {
                window.staffMembers = staffMembers;
                if (staffMembers && staffMembers.length > 0) {

                    // Clear loading indicator
                    staffGrid.innerHTML = '';
                    
                    // Filter to only show active staff members
                    const activeStaff = staffMembers.filter(staff => staff.active);
                    
                    // Create button for each active staff member
                    activeStaff.forEach(staff => {
                        const button = document.createElement('button');
                        button.className = 'staff-button';
                        button.setAttribute('data-staff', staff.name);
                        button.textContent = staff.name;
                        
                        // Add click event
                        button.addEventListener('click', () => {
                            currentStaff = staff.name;
                            localStorage.setItem('currentStaff', staff.name);
                            showUserSwitchToast(staff.name);
                            showMainInterface();
                        });
                        
                        staffGrid.appendChild(button);
                    });
                    
                    // If no active staff, show message
                    if (activeStaff.length === 0) {
                        staffGrid.innerHTML = '<div class="loading-staff">No active staff members found. Please contact your administrator.</div>';
                    }
                } else {
                    // Fallback to hardcoded staff
                    createDefaultStaffButtons();
                }
            })
            .catch(error => {
                console.error('Error loading staff members:', error);
                // Fallback to hardcoded staff
                createDefaultStaffButtons();
            });
    } else {
        // Fallback to hardcoded staff
        createDefaultStaffButtons();
    }
}

// Function to create default staff buttons as fallback
function createDefaultStaffButtons() {
    const staffGrid = document.querySelector('.staff-grid');
    if (!staffGrid) return;
    
    // Clear existing content
    staffGrid.innerHTML = '';
    
    // Default staff list
    const defaultStaff = [
        "Serge Men", "Tatiana", "Nadine", "Nicolas", "Omar"
    ];
    
    // Create button for each staff member
    defaultStaff.forEach(staffName => {
        const button = document.createElement('button');
        button.className = 'staff-button';
        button.setAttribute('data-staff', staffName);
        button.textContent = staffName;
        
        // Add click event
        button.addEventListener('click', () => {
            currentStaff = staffName;
            localStorage.setItem('currentStaff', staffName);
            showMainInterface();
        });
        
        staffGrid.appendChild(button);
    });
}

// Add some CSS for the loading indicator
const staffLoadingStyle = document.createElement('style');
staffLoadingStyle.textContent = `
    .loading-staff {
        padding: 20px;
        text-align: center;
        color: var(--text-medium);
        background-color: var(--bg-medium);
        border-radius: 8px;
        margin: 10px 0;
        width: 100%;
    }
`;
document.head.appendChild(staffLoadingStyle);

// DOM elements
const staffSelectionScreen = document.getElementById('staff-selection');
const mainInterface = document.getElementById('main-interface');
const currentUserElement = document.getElementById('current-user');
const switchUserButton = document.getElementById('switch-user');
const navButtons = document.querySelectorAll('.nav-button');
const contentSections = document.querySelectorAll('.content-section');
const inventoryTableBody = document.getElementById('inventory-table-body');
const todoListContainer = document.getElementById('todo-list-container');
const totalItemsElement = document.getElementById('total-items');
const itemsNeededElement = document.getElementById('items-needed');
const startCheckButton = document.getElementById('start-check-btn');
const updateSingleBtn = document.getElementById('update-single-btn');
const prepCheckInterface = document.getElementById('prep-check-interface');
const dashboardSection = document.getElementById('dashboard-section');
const checkProgressElement = document.getElementById('check-progress');
const checkItemNameElement = document.getElementById('check-item-name');
const checkItemTargetElement = document.getElementById('check-item-target');
const currentLevelInput = document.getElementById('current-level-input');
const saveNextButton = document.getElementById('save-next-btn');
const cancelCheckButton = document.getElementById('cancel-check-btn');
const headerUserNameElement = document.getElementById('header-user-name');
const userLoginButton = document.getElementById('user-login-btn');

//SaveData function to ensure Firebase saves are completed properly
function saveData() {
    
        // Always save to local storage as backup
    localStorage.setItem('prepItems', JSON.stringify(prepItems));
    
    // Save to Firebase if available - now using batch updates for better consistency
    if (window.firebaseDb && window.firebaseDb.saveAllItems) {
        // Use batch update instead of individual items
        window.firebaseDb.saveAllItems(prepItems)
            .then(() => {
            })
            .catch(error => {
                console.error("Error saving to Firebase:", error);
                // Show an error notification
                showErrorNotification("Failed to save data to server. Please check your connection.");
            });
    } else if (window.firebaseDb && window.firebaseDb.saveItem) {
        // Fallback to individual updates if batch not available
        // Save each item individually with proper error handling
        const savePromises = prepItems.map(item => 
            window.firebaseDb.saveItem(item)
                .then(() => {})
                .catch(error => {
                    console.error(`Error saving item ${item.id}:`, error);
                    throw error; // Re-throw to be caught in Promise.all
                })
        );
        
        // Handle all promises together
        Promise.all(savePromises)
            .then(() => {
            })
            .catch(error => {
                console.error("Some items failed to save:", error);
                showErrorNotification("Some changes may not have been saved to the server.");
            });
    }
}


// Add a function to show error notifications
function showErrorNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'toast toast--error';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (document.body.contains(notification)) {
            document.body.removeChild(notification);
        }
    }, 5000);
}


// Modify the loadLocalData function to be more robust
function loadLocalData() {
    try {
        const saved = localStorage.getItem('prepItems');
        if (saved) {
            prepItems = JSON.parse(saved);
            
            // Sort by displayOrder after loading
            prepItems.sort((a, b) => {
                if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
                    return a.displayOrder - b.displayOrder;
                }
                if (a.displayOrder !== undefined && b.displayOrder === undefined) {
                    return -1;
                }
                if (a.displayOrder === undefined && b.displayOrder !== undefined) {
                    return 1;
                }
                return a.id - b.id;
            });
            
            updateInventoryTable();
            updateTodoList();
            updateStats();
            
        } else {
            // If no local data, use initial data
            prepItems = [...initialPrepItems];
            
            updateInventoryTable();
            updateTodoList();
            updateStats();
        }
    } catch (error) {
        console.error("Error loading from local storage:", error);
        // Fallback to initial data
        prepItems = [...initialPrepItems];
        
        updateInventoryTable();
        updateTodoList();
        updateStats();
    }
}

function initApp() {

    // Populate date badge
    const dateBadge = document.getElementById('date-badge');
    if (dateBadge) {
        const now = new Date();
        const days = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
        const months = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
        dateBadge.textContent = days[now.getDay()] + ' ' + now.getDate() + ' ' + months[now.getMonth()];
    }

    // Restore last user from localStorage, or default to Serge Men
    currentStaff = localStorage.getItem('currentStaff') || 'Serge Men';

    // Show main interface directly
    showMainInterface();
    
    // Load staff members in background
    loadStaffMembers();

    switchUserButton.addEventListener('click', () => {
        currentStaff = '';
        showStaffSelection();
    });

    if (userLoginButton) {
        userLoginButton.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleUserDropdown();
        });
        document.addEventListener('click', () => {
            const existing = document.getElementById('user-dropdown');
            if (existing) existing.remove();
        });
    }

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const sectionId = button.getAttribute('data-section');
            switchSection(sectionId, button);
        });
    });

    startCheckButton.addEventListener('click', startPrepCheck);
    updateSingleBtn.addEventListener('click', showSingleItemUpdateModal);
    saveNextButton.addEventListener('click', saveAndNext);
    cancelCheckButton.addEventListener('click', cancelPrepCheck);
    
    // Add CSS for clickable todo items
    const style = document.createElement('style');
    style.textContent = `
        .todo-item {
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .todo-item:active {
            background-color: #f5f5f5;
        }
    `;
    document.head.appendChild(style);
    
    // IMPROVED DATA LOADING SEQUENCE:
    
    // Show loading indicator
    showLoadingIndicator();
    
    
    // First, check if Firebase is available
    if (window.firebaseDb && typeof window.firebaseDb.loadItems === 'function') {
        
        // 1. First load fresh data from Firebase
        window.firebaseDb.loadItems()
            .then(firebaseItems => {
                
                if (firebaseItems && firebaseItems.length > 0) {
                    // Update prepItems with Firebase data
                    prepItems = firebaseItems;
                    
                    // IMPORTANT: Sort by displayOrder using the helper function
                    prepItems = sortItemsByDisplayOrder(prepItems);
                    
                    
                    // Save to local storage as backup
                    localStorage.setItem('prepItems', JSON.stringify(prepItems));
                    
                    // Update UI with the latest data
                    updateInventoryTable();
                    updateTodoList();
                    updateStats();
                    
                } else {
                    // Firebase returned empty — DB is genuinely empty, don't resurrect from cache
                    prepItems = [];
                    localStorage.setItem('prepItems', JSON.stringify(prepItems));
                    updateInventoryTable();
                    updateTodoList();
                    updateStats();
                }
                
                // Hide loading indicator regardless of data source
                hideLoadingIndicator();
            })
            .catch(error => {
                console.error('Error loading from Firebase:', error);
                // Fallback to local data if Firebase load fails
                loadLocalData();
                hideLoadingIndicator();
            });
        
        // 2. Set up real-time listeners for ongoing updates
        window.firebaseDb.onItemsChange((updatedItems) => {

            if (updatedItems) {
                // Update with whatever Firebase returns (including empty arrays)
                prepItems = updatedItems;

                // IMPORTANT: Sort by displayOrder using the helper function
                prepItems = sortItemsByDisplayOrder(prepItems);


                // Save to local storage
                localStorage.setItem('prepItems', JSON.stringify(prepItems));

                // Update UI
                updateInventoryTable();
                updateTodoList();
                updateStats();
            }
        });

        window.firebaseDb.onTasksChange(function(loadedTasks) {
            tasks = loadedTasks || [];
            updateTodoList();
        });

        // Checklist data loading
        currentDateKey = window.firebaseDb.getDateKey();
        window.firebaseDb.opening.onItemsChange(function(items) {
            openingItems = items;
            updateTodoList();
        });
        window.firebaseDb.closing.onItemsChange(function(items) {
            closingItems = items;
            updateTodoList();
        });
        window.firebaseDb.opening.onStatusChange(currentDateKey, function(status) {
            openingStatus = status;
            updateTodoList();
        });
        window.firebaseDb.closing.onStatusChange(currentDateKey, function(status) {
            closingStatus = status;
            updateTodoList();
        });
        // Checklist force display listeners
        window.checklistForceDisplay = {};
        window.firebaseDb.opening.onForceDisplayChange(function(val) {
            window.checklistForceDisplay.opening = val;
            updateTodoList();
        });
        window.firebaseDb.closing.onForceDisplayChange(function(val) {
            window.checklistForceDisplay.closing = val;
            updateTodoList();
        });
    } else {
        // If Firebase is not available, use local storage
        loadLocalData();
        hideLoadingIndicator();
    }
}

// Add CSS for "Can't Prep" tag
const cantPrepStyle = document.createElement('style');
cantPrepStyle.textContent = `
    .todo-tag.cant-prep {
        background-color: #fee2e2;
        color: #ef4444;
    }
`;
document.head.appendChild(cantPrepStyle);

// Add CSS for the new badge system
const badgeStyles = document.createElement('style');
badgeStyles.textContent = `
    .todo-tag.empty {
        background-color: #fee2e2;
        color: #ef4444;
    }
    .todo-tag.critical {
        background-color: #ffedd5;
        color: #f97316;
    }
    .todo-tag.low {
        background-color: #fef9c3;
        color: #ca8a04;
    }
    .todo-tag.getting-low {
        background-color: #f1f5f9;
        color: #64748b;
    }
    .todo-tag.cant-prep {
        background-color: #fee2e2;
        color: #ef4444;
    }
`;
document.head.appendChild(badgeStyles);

// Function to mark an item as "Can Prep Again"
function markItemAsCanPrepAgain(item) {
    // Find the item in the prepItems array
    const itemIndex = prepItems.findIndex(i => i.id === item.id);
    if (itemIndex !== -1) {
        // Get original reason for logging
        const originalReason = prepItems[itemIndex].cantPrepReason;
        
        // Reset the "can't prep" information
        prepItems[itemIndex].canPrep = true;
        prepItems[itemIndex].cantPrepReason = null;
        prepItems[itemIndex].cantPrepTime = null;
        prepItems[itemIndex].cantPrepBy = null;
        prepItems[itemIndex].cantPrepReasonText = null;
        
        // Save to Firebase
        saveData();
        
        // Log the activity if history system is available
        if (window.historySystem && typeof window.historySystem.logItemModification === 'function') {
            window.historySystem.logItemModification(
                prepItems[itemIndex],
                currentStaff,
                'canprepagain'
            ).catch(error => {
                console.error("Error logging can-prep-again activity:", error);
            });
        }
        
        // Update UI
        updateInventoryTable();
        updateTodoList();
        updateStats();
        SoundFX.complete();

        // Show success message
        const successMessage = document.createElement('div');
        successMessage.textContent = `${item.name} can now be prepped again`;
        successMessage.className = 'toast toast--success';
        document.body.appendChild(successMessage);
        
        setTimeout(() => {
            if (document.body.contains(successMessage)) {
                document.body.removeChild(successMessage);
            }
        }, 3000);
    }
}


// Create loading indicator functions
function showLoadingIndicator() {
    
    // Check if loading overlay already exists
    if (document.getElementById('loading-overlay')) {
        return;
    }
    
    // Create a loading overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'loading-overlay';
    loadingOverlay.style.position = 'fixed';
    loadingOverlay.style.top = '0';
    loadingOverlay.style.left = '0';
    loadingOverlay.style.width = '100%';
    loadingOverlay.style.height = '100%';
    loadingOverlay.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
    loadingOverlay.style.display = 'flex';
    loadingOverlay.style.justifyContent = 'center';
    loadingOverlay.style.alignItems = 'center';
    loadingOverlay.style.zIndex = '9999';
    
    // Create loading spinner
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    spinner.style.width = '50px';
    spinner.style.height = '50px';
    spinner.style.border = '5px solid #f3f3f3';
    spinner.style.borderTop = '5px solid #3498db';
    spinner.style.borderRadius = '50%';
    spinner.style.animation = 'spin 1s linear infinite';
    
    // Add keyframe animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
    
    // Add spinner to overlay
    loadingOverlay.appendChild(spinner);
    
    // Add loading text
    const loadingText = document.createElement('div');
    loadingText.textContent = 'Syncing data...';
    loadingText.style.marginLeft = '15px';
    loadingText.style.fontWeight = 'bold';
    loadingOverlay.appendChild(loadingText);
    
    // Add to body
    document.body.appendChild(loadingOverlay);
}

function hideLoadingIndicator() {
    
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        document.body.removeChild(loadingOverlay);
    }
}

// Save and next function (Firebase-integrated)
function saveAndNext() {
    // Get the value and explicitly check for undefined/null/empty
    const currentValue = currentLevelInput.value;

    // Check if a value has been set (including zero)
    if (currentValue === '' || isNaN(parseFloat(currentValue))) {
        alert('Please select a current level');
        return;
    }
    
    // Get the current item being checked
    const item = prepItems[currentItemIndex];
    
    // Store old value before updating
    const oldValue = item.currentLevel;
    const newValue = parseFloat(currentLevelInput.value);
    
    // IMPORTANT: Store the displayOrder before updating to ensure it's preserved
    const displayOrder = item.displayOrder;
    
    // Update prep item with new level
    item.currentLevel = newValue;
    item.lastCheckedBy = currentStaff;
    item.lastCheckedTime = new Date().toISOString();
    item.updateType = 'count'; // Mark as a count update
    
    // IMPORTANT: Ensure displayOrder is preserved after update
    item.displayOrder = displayOrder;
    
    // Save data to localStorage
    saveData();
    
    // Log the activity if history system is available
    if (window.historySystem && typeof window.historySystem.logQuantityChange === 'function') {
        window.historySystem.logQuantityChange(
            item.id,
            item.name,
            oldValue,
            newValue,
            item.unit,
            currentStaff,
            'count'
        ).catch(error => {
            console.error("Error logging activity:", error);
        });
    }
    
    // Update the to-do list in real-time
    updateTodoList();
    SoundFX.tap();

    // Move to next item or complete check
    if (currentItemIndex < prepItems.length - 1) {
        currentItemIndex++;
        showCurrentPrepItem();
    } else {
        completePrepCheck();
    }
}

// Quick Update Modal (modified to use Firebase)
function showQuickUpdateModal(item, context = 'default') {
    SoundFX.pop();
    if (!item.currentLevel && item.currentLevel !== 0) {
        console.warn('Warning: currentLevel is undefined or null');
    }

    // Create modal elements
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'modal-backdrop';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-box';

    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    const headerRow = document.createElement('div');
    headerRow.style.cssText = 'display:flex;align-items:center;gap:12px;';
    headerRow.appendChild(createModalUserPicker());
    const titleEl = document.createElement('h3');
    titleEl.style.margin = '0';
    titleEl.textContent = item.name;
    headerRow.appendChild(titleEl);
    modalHeader.appendChild(headerRow);
    const subtitleEl = document.createElement('p');
    subtitleEl.style.margin = '5px 0';
    subtitleEl.textContent = `Current: ${item.currentLevel} ${item.unit}`;
    modalHeader.appendChild(subtitleEl);

    // Create input group with hidden input
    const inputGroup = document.createElement('div');
    inputGroup.style.marginBottom = '15px';
    
    const label = document.createElement('label');
    label.textContent = 'New quantity:';
    label.style.display = 'block';
    label.style.marginBottom = '5px';
    label.style.fontWeight = 'bold';
    
    // Hidden input to store the value
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.id = 'modal-current-level';
    hiddenInput.value = item.currentLevel || 0;
    
    // Create touch-friendly slider control
    const touchInput = document.createElement('div');
    touchInput.className = 'touch-input-container';
    touchInput.innerHTML = `
        <div class="value-display">
            <span id="modal-current-value">${item.currentLevel || 0}</span>
        </div>
        
        <div class="control-row">
            <button class="control-button" id="modal-decrease">-</button>
            <button class="control-button" id="modal-increase">+</button>
        </div>
        
        <div class="slider-container">
            <div class="slider-track"></div>
            <div class="slider-progress" id="modal-progress"></div>
            <div class="slider-handle" id="modal-handle"></div>
            <div class="tick-marks" id="modal-ticks"></div>
        </div>
    `;
    
    // Add elements to input group in correct order
    inputGroup.appendChild(label);
    inputGroup.appendChild(hiddenInput);
    inputGroup.appendChild(touchInput);
    
    // Create update type toggle - only if context is 'single-item-update'
    let updateTypeContainer = null;
    let prepRadio = null;
    let countRadio = null;
    
    if (context === 'single-item-update') {
        updateTypeContainer = document.createElement('div');
        updateTypeContainer.style.marginBottom = '20px';
        updateTypeContainer.style.marginTop = '15px';
        
        const updateTypeLabel = document.createElement('div');
        updateTypeLabel.textContent = 'Update Type:';
        updateTypeLabel.style.fontWeight = 'bold';
        updateTypeLabel.style.marginBottom = '8px';
        
        const radioGroup = document.createElement('div');
        radioGroup.style.display = 'flex';
        radioGroup.style.gap = '10px';
        
        // Create "Prepped" radio button
        const prepLabel = document.createElement('label');
        prepLabel.style.display = 'flex';
        prepLabel.style.alignItems = 'center';
        prepLabel.style.padding = '8px 12px';
        prepLabel.style.border = '2px solid #4CAF50';
        prepLabel.style.borderRadius = '4px';
        prepLabel.style.cursor = 'pointer';
        prepLabel.style.fontWeight = '500';
        prepLabel.style.flex = '1';
        prepLabel.style.justifyContent = 'center';
        prepLabel.style.backgroundColor = '#e8f5e9';
        
        prepRadio = document.createElement('input');
        prepRadio.type = 'radio';
        prepRadio.name = 'update-type';
        prepRadio.value = 'prep';
        prepRadio.id = 'update-type-prep';
        prepRadio.style.marginRight = '8px';
        prepRadio.checked = true; // Default to Prepped
        
        prepLabel.appendChild(prepRadio);
        prepLabel.appendChild(document.createTextNode('Prepped'));
        
        // Create "Checked" radio button
        const countLabel = document.createElement('label');
        countLabel.style.display = 'flex';
        countLabel.style.alignItems = 'center';
        countLabel.style.padding = '8px 12px';
        countLabel.style.border = '2px solid #2196F3';
        countLabel.style.borderRadius = '4px';
        countLabel.style.cursor = 'pointer';
        countLabel.style.fontWeight = '500';
        countLabel.style.flex = '1';
        countLabel.style.justifyContent = 'center';
        countLabel.style.backgroundColor = '#e3f2fd';
        
        countRadio = document.createElement('input');
        countRadio.type = 'radio';
        countRadio.name = 'update-type';
        countRadio.value = 'count';
        countRadio.id = 'update-type-count';
        countRadio.style.marginRight = '8px';
        
        countLabel.appendChild(countRadio);
        countLabel.appendChild(document.createTextNode('Checked'));
        
        // Add radio buttons to group
        radioGroup.appendChild(prepLabel);
        radioGroup.appendChild(countLabel);
        
        // Add elements to the update type container
        updateTypeContainer.appendChild(updateTypeLabel);
        updateTypeContainer.appendChild(radioGroup);
        
        // Add style to make the selected option more obvious
        const updateTypeStyle = document.createElement('style');
        updateTypeStyle.textContent = `
            input[name="update-type"]:checked + span {
                font-weight: bold;
            }
        `;
        document.head.appendChild(updateTypeStyle);
        
        // Add event listeners to highlight the selected option
        prepRadio.addEventListener('change', function() {
            if (this.checked) {
                prepLabel.style.backgroundColor = '#e8f5e9';
                prepLabel.style.fontWeight = '600';
                countLabel.style.backgroundColor = '#e3f2fd';
                countLabel.style.fontWeight = '500';
            }
        });
        
        countRadio.addEventListener('change', function() {
            if (this.checked) {
                countLabel.style.backgroundColor = '#e3f2fd';
                countLabel.style.fontWeight = '600';
                prepLabel.style.backgroundColor = '#e8f5e9';
                prepLabel.style.fontWeight = '500';
            }
        });
    }
    
    // Create buttons
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'btn-group';

    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.className = 'btn btn--primary';

    let cantPrepButton;
    if (item.canPrep === false) {
        cantPrepButton = document.createElement('button');
        cantPrepButton.textContent = 'Can Prep Again';
        cantPrepButton.className = 'btn btn--primary';
    } else {
        cantPrepButton = document.createElement('button');
        cantPrepButton.textContent = 'Can\'t Prep';
        cantPrepButton.className = 'btn btn--danger';
    }

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.className = 'btn btn--secondary';
    
    // Add buttons in the order you want them to appear
    buttonGroup.appendChild(cancelButton);
    buttonGroup.appendChild(cantPrepButton);
    buttonGroup.appendChild(saveButton);
    
    // Add all elements to modal
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(inputGroup);
    if (updateTypeContainer) {
        modalContent.appendChild(updateTypeContainer);
    }
    modalContent.appendChild(buttonGroup);
    modalBackdrop.appendChild(modalContent);
    
    // Add modal to document
    document.body.appendChild(modalBackdrop);
    
    // Create a variable to hold the slider instance
    let modalSlider;
    
    // Initialize the slider for this modal after DOM is ready
    setTimeout(() => {
        const sliderContainer = modalContent.querySelector('.slider-container');
        if (!sliderContainer) {
            console.error('Slider container not found');
            return;
        }

        // Initialize with the current item's level
        const initialValue = parseFloat(item.currentLevel) || 0;

        modalSlider = createTouchSlider({
            containerId: sliderContainer,
            valueDisplayId: 'modal-current-value',
            handleId: 'modal-handle',
            progressId: 'modal-progress',
            ticksId: 'modal-ticks',
            decreaseId: 'modal-decrease',
            increaseId: 'modal-increase',
            hiddenInputId: 'modal-current-level',
            initialValue: initialValue
        });

        // Force an immediate update after creation
        if (modalSlider) {
            modalSlider.setValue(initialValue);
            // Update the display value immediately
            const displayElement = document.getElementById('modal-current-value');
            if (displayElement) {
                displayElement.textContent = initialValue < 3 ? 
                    initialValue.toFixed(2) : 
                    initialValue.toFixed(0);
            }
        }
    }, 100);
    
    // Function to close modal and clean up
    function closeModal() {
        // Destroy slider to clean up event listeners
        if (modalSlider) {
            modalSlider.destroy();
        }
        document.body.removeChild(modalBackdrop);
    }
    
    // Add event listeners
    cancelButton.addEventListener('click', closeModal);
    
    // Add conditional event listener for the Can't Prep/Can Prep Again button
    if (item.canPrep === false) {
        // Event listener for "Can Prep Again" button
        cantPrepButton.addEventListener('click', () => {
            closeModal();
            markItemAsCanPrepAgain(item);
        });
    } else {
        // Event listener for "Can't Prep" button
        cantPrepButton.addEventListener('click', () => {
            closeModal();
            
            showCantPrepReasonModal(item, (reason, reasonText) => {
                markItemAsCantPrep(item, reason, reasonText);
            });
        });
    }
    
    saveButton.addEventListener('click', () => {
        const newValue = parseFloat(hiddenInput.value);
        if (isNaN(newValue) || newValue < 0) {
            alert('Please enter a valid number');
            return;
        }
        
        // Find the item in the prepItems array
        const itemIndex = prepItems.findIndex(i => i.id === item.id);
        if (itemIndex !== -1) {
            // Store old value before updating
            const oldValue = prepItems[itemIndex].currentLevel;
            
            // Update the item
            prepItems[itemIndex].currentLevel = newValue;
            prepItems[itemIndex].lastCheckedBy = currentStaff;
            prepItems[itemIndex].lastCheckedTime = new Date().toISOString();
            
            // Set update type based on the context and radio selection
            if (context === 'single-item-update' && countRadio && countRadio.checked) {
                prepItems[itemIndex].updateType = 'count'; // Mark as count update
            } else {
                prepItems[itemIndex].updateType = 'prep'; // Mark as prep update (default)
            }
            
            // Save to localStorage
            saveData();
            
            // Log the activity if history system is available
            if (window.historySystem && typeof window.historySystem.logQuantityChange === 'function') {
                window.historySystem.logQuantityChange(
                    prepItems[itemIndex].id,
                    prepItems[itemIndex].name,
                    oldValue,
                    newValue,
                    prepItems[itemIndex].unit,
                    currentStaff,
                    prepItems[itemIndex].updateType // Use the selected update type
                ).catch(error => {
                    console.error("Error logging activity:", error);
                });
            }
            
            // Update UI
            updateInventoryTable();
            updateTodoList();
            updateStats();
            
            SoundFX.complete();

            // Show success message
            const successMessage = document.createElement('div');
            successMessage.textContent = `${item.name} updated to ${newValue} ${item.unit}`;
            successMessage.className = 'toast toast--success';
            document.body.appendChild(successMessage);
            
            setTimeout(() => {
                if (document.body.contains(successMessage)) {
                    document.body.removeChild(successMessage);
                }
            }, 3000);
        }
        
        // Close modal
        closeModal();
    });
    
    // Close modal if backdrop is clicked
    modalBackdrop.addEventListener('click', (event) => {
        if (event.target === modalBackdrop) {
            closeModal();
        }
    });
}

    // Function to show the Can't Prep reason selection modal
function showCantPrepReasonModal(item, afterSelectionCallback) {
    SoundFX.pop();
    // Create modal backdrop (stacked on top of prep check modal)
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'modal-backdrop modal-backdrop--stacked cant-prep-modal-backdrop';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-box cant-prep-modal-content';

    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    modalHeader.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <h3 style="margin: 0; color: #333;">Can't Prep: ${item.name}</h3>
        <span style="background-color: #ff8c04; color: white; padding: 4px 8px; border-radius: 4px; font-size: 14px; font-weight: 500;">${currentStaff}</span>
    </div>
    <p style="margin: 5px 0;">Select a reason why this item can't be prepped:</p>
    `;

    // Create reason selection options
    const reasonsContainer = document.createElement('div');
    reasonsContainer.style.marginBottom = '20px';

    // Missing Ingredients option
    const missingOption = document.createElement('div');
    missingOption.className = 'reason-option';
    missingOption.style.padding = '12px';
    missingOption.style.border = '1px solid #ddd';
    missingOption.style.borderRadius = '4px';
    missingOption.style.marginBottom = '10px';
    missingOption.style.cursor = 'pointer';
    missingOption.style.transition = 'background-color 0.2s';
    missingOption.innerHTML = `
        <label style="display: flex; align-items: center; cursor: pointer;">
            <input type="radio" name="cant-prep-reason" value="Missing Ingredients" style="margin-right: 10px;">
            <span style="font-weight: 500;">Missing Ingredients</span>
        </label>
    `;

    // Other Reason option
    const otherOption = document.createElement('div');
    otherOption.className = 'reason-option';
    otherOption.style.padding = '12px';
    otherOption.style.border = '1px solid #ddd';
    otherOption.style.borderRadius = '4px';
    otherOption.style.cursor = 'pointer';
    otherOption.style.transition = 'background-color 0.2s';
    otherOption.innerHTML = `
        <label style="display: flex; align-items: center; cursor: pointer;">
            <input type="radio" name="cant-prep-reason" value="Other" style="margin-right: 10px;">
            <span style="font-weight: 500;">Other Reason</span>
        </label>
    `;

    // Other reason text input (hidden initially)
    const otherReasonContainer = document.createElement('div');
    otherReasonContainer.id = 'other-reason-container';
    otherReasonContainer.style.marginTop = '10px';
    otherReasonContainer.style.display = 'none';

    const otherReasonInput = document.createElement('input');
    otherReasonInput.type = 'text';
    otherReasonInput.id = 'other-reason-input';
    otherReasonInput.placeholder = 'Please specify the reason...';
    otherReasonInput.style.width = '100%';
    otherReasonInput.style.padding = '10px';
    otherReasonInput.style.border = '1px solid #ddd';
    otherReasonInput.style.borderRadius = '4px';
    otherReasonInput.style.fontSize = '14px';

    otherReasonContainer.appendChild(otherReasonInput);

    // Add options to container
    reasonsContainer.appendChild(missingOption);
    reasonsContainer.appendChild(otherOption);
    reasonsContainer.appendChild(otherReasonContainer);

    // Create buttons
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'btn-group';

    const confirmButton = document.createElement('button');
    confirmButton.textContent = 'Confirm';
    confirmButton.className = 'btn btn--danger';

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.className = 'btn btn--secondary';

    buttonGroup.appendChild(cancelButton);
    buttonGroup.appendChild(confirmButton);

    // Add all elements to modal
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(reasonsContainer);
    modalContent.appendChild(buttonGroup);
    modalBackdrop.appendChild(modalContent);

    // Add modal to document
    document.body.appendChild(modalBackdrop);

    // Function to close modal
    function closeModal() {
        document.body.removeChild(modalBackdrop);
    }

    // Event listeners for styling the radio options
    const radioInputs = document.querySelectorAll('input[name="cant-prep-reason"]');
    radioInputs.forEach(input => {
        input.addEventListener('change', function() {
            // Reset all options
            document.querySelectorAll('.reason-option').forEach(option => {
                option.style.backgroundColor = 'white';
                option.style.borderColor = '#ddd';
            });
            
            // Highlight selected option
            this.closest('.reason-option').style.backgroundColor = '#f9f9f9';
            this.closest('.reason-option').style.borderColor = '#ef4444';
            
            // Show/hide other reason input
            otherReasonContainer.style.display = this.value === 'Other' ? 'block' : 'none';
        });
    });

    // Make the entire option div clickable (not just the radio button)
    document.querySelectorAll('.reason-option').forEach(option => {
        option.addEventListener('click', function() {
            const radio = this.querySelector('input[type="radio"]');
            radio.checked = true;
            
            // Manually trigger the change event
            const event = new Event('change');
            radio.dispatchEvent(event);
        });
    });

    // Add event listeners for buttons
    cancelButton.addEventListener('click', closeModal);

    confirmButton.addEventListener('click', () => {
        // Get selected reason
        const selectedRadio = document.querySelector('input[name="cant-prep-reason"]:checked');
        
        if (!selectedRadio) {
            alert('Please select a reason');
            return;
        }
        
        const reason = selectedRadio.value;
        let reasonText = null;
        
        // If "Other" is selected, get the specified reason text
        if (reason === 'Other') {
            reasonText = otherReasonInput.value.trim();
            if (!reasonText) {
                alert('Please specify the reason');
                return;
            }
        }
        
        // Call the callback with the selected reason
        if (typeof afterSelectionCallback === 'function') {
            afterSelectionCallback(reason, reasonText);
        }
        
        closeModal();
    });

    
    // Close modal if backdrop is clicked
    modalBackdrop.addEventListener('click', (event) => {
        if (event.target === modalBackdrop) {
            closeModal();
        }
    });
}

// Function to mark an item as "Can't Prep"
function markItemAsCantPrep(item, reason, reasonText = null) {
    // Find the item in the prepItems array
    const itemIndex = prepItems.findIndex(i => i.id === item.id);
    if (itemIndex !== -1) {
        // Update the item with "can't prep" information
        prepItems[itemIndex].canPrep = false;
        prepItems[itemIndex].cantPrepReason = reason;
        prepItems[itemIndex].cantPrepTime = new Date().toISOString();
        prepItems[itemIndex].cantPrepBy = currentStaff;
        prepItems[itemIndex].cantPrepReasonText = reasonText;
        
        // Save to Firebase
        saveData();
        
        // Log the activity if history system is available
        if (window.historySystem && typeof window.historySystem.logItemModification === 'function') {
            window.historySystem.logItemModification(
                prepItems[itemIndex],
                currentStaff,
                'cantprep'
            ).catch(error => {
                console.error("Error logging cant-prep activity:", error);
            });
        }
        
        // Update UI
        updateInventoryTable();
        updateTodoList();
        updateStats();
        
        // Show success message
        const successMessage = document.createElement('div');
        successMessage.textContent = `${item.name} marked as "Can't Prep" - ${reason}`;
        successMessage.className = 'toast toast--error';
        document.body.appendChild(successMessage);
        
        setTimeout(() => {
            if (document.body.contains(successMessage)) {
                document.body.removeChild(successMessage);
            }
        }, 3000);
    }
}

// Function to mark an item as "Can Prep Again"
function markItemAsCanPrepAgain(item) {
    // Find the item in the prepItems array
    const itemIndex = prepItems.findIndex(i => i.id === item.id);
    if (itemIndex !== -1) {
        // Get original reason for logging
        const originalReason = prepItems[itemIndex].cantPrepReason;
        
        // Reset the "can't prep" information
        prepItems[itemIndex].canPrep = true;
        prepItems[itemIndex].cantPrepReason = null;
        prepItems[itemIndex].cantPrepTime = null;
        prepItems[itemIndex].cantPrepBy = null;
        prepItems[itemIndex].cantPrepReasonText = null;
        
        // Save to Firebase
        saveData();
        
        // Log the activity if history system is available
        if (window.historySystem && typeof window.historySystem.logItemModification === 'function') {
            window.historySystem.logItemModification(
                prepItems[itemIndex],
                currentStaff,
                'canprepagain'
            ).catch(error => {
                console.error("Error logging can-prep-again activity:", error);
            });
        }
        
        // Update UI
        updateInventoryTable();
        updateTodoList();
        updateStats();
        SoundFX.complete();

        // Show success message
        const successMessage = document.createElement('div');
        successMessage.textContent = `${item.name} can now be prepped again`;
        successMessage.className = 'toast toast--success';
        document.body.appendChild(successMessage);
        
        setTimeout(() => {
            if (document.body.contains(successMessage)) {
                document.body.removeChild(successMessage);
            }
        }, 3000);
    }
}

function getTaskMissedCount(task) {
    if (!task.lastCompletedAt || task.type !== 'recurring') return 0;
    const daysSince = (Date.now() - new Date(task.lastCompletedAt).getTime()) / (1000 * 60 * 60 * 24);
    const missed = Math.floor(daysSince / task.frequencyDays) - 1;
    return Math.max(0, missed);
}

function isTaskDue(task) {
    if (!task.active) return false;
    if (task.forceDisplay) return true;
    // Schedule filtering
    if (task.scheduleDays && task.scheduleDays.length > 0) {
        var today = new Date().getDay();
        if (task.scheduleDays.indexOf(today) === -1) return false;
    }
    if (task.scheduleTime) {
        var now = new Date();
        var parts = task.scheduleTime.split(':');
        var scheduleMinutes = parseInt(parts[0]) * 60 + parseInt(parts[1]);
        var nowMinutes = now.getHours() * 60 + now.getMinutes();
        if (nowMinutes < scheduleMinutes) return false;
    }
    if (task.type === 'one-off') {
        return !task.lastCompletedAt;
    }
    if (task.type === 'scheduled') {
        if (!task.scheduledDate) return false;
        const now = new Date();
        const scheduled = new Date(task.scheduledDate + (task.scheduledTime ? 'T' + task.scheduledTime : 'T00:00'));
        return now >= scheduled && !task.lastCompletedAt;
    }
    if (task.type === 'recurring') {
        if (!task.lastCompletedAt) return true;
        const daysSince = (Date.now() - new Date(task.lastCompletedAt).getTime()) / (1000 * 60 * 60 * 24);
        return daysSince >= task.frequencyDays;
    }
    return false;
}

function getTaskDaysOverdue(task) {
    if (task.type === 'recurring') {
        if (!task.lastCompletedAt) return 0;
        const daysSince = (Date.now() - new Date(task.lastCompletedAt).getTime()) / (1000 * 60 * 60 * 24);
        const overdue = daysSince - task.frequencyDays;
        return Math.max(0, Math.floor(overdue));
    }
    if (task.type === 'scheduled' && task.scheduledDate) {
        const daysSince = (Date.now() - new Date(task.scheduledDate).getTime()) / (1000 * 60 * 60 * 24);
        return Math.max(0, Math.floor(daysSince));
    }
    return 0;
}

// --- Checklist helpers ---

function getChecklistProgress(items, status) {
    var total = items.length;
    if (total === 0) return { done: 0, total: 0, percent: 0 };
    var done = 0;
    items.forEach(function(item) {
        var s = status[item.id];
        if (s && (s.checked || s.cantComplete)) done++;
    });
    return { done: done, total: total, percent: Math.round((done / total) * 100) };
}

function getProgressColor(percent) {
    if (percent < 50) {
        var t = percent / 50;
        var r = 239 + Math.round((255 - 239) * t);
        var g = 68 + Math.round((152 - 68) * t);
        var b = 68 + Math.round((0 - 68) * t);
        return 'rgb(' + r + ',' + g + ',' + b + ')';
    } else {
        var t2 = (percent - 50) / 50;
        var r2 = 255 + Math.round((76 - 255) * t2);
        var g2 = 152 + Math.round((175 - 152) * t2);
        var b2 = Math.round(80 * t2);
        return 'rgb(' + r2 + ',' + g2 + ',' + b2 + ')';
    }
}

function isChecklistComplete(items, status) {
    if (items.length === 0) return true;
    return items.every(function(item) {
        var s = status[item.id];
        return s && (s.checked || s.cantComplete);
    });
}

function renderChecklistCard(type, items, status, container) {
    if (window.checklistForceDisplay?.[type] === true) { /* forced on, skip time checks */ }
    else if (window.checklistForceDisplay?.[type] === false) return;
    else if (type === 'closing' && new Date().getHours() < 22) return;
    if (isChecklistComplete(items, status)) return;
    if (items.length === 0) return;

    var progress = getChecklistProgress(items, status);
    var color = getProgressColor(progress.percent);
    var label = type === 'opening' ? 'OPENING' : 'CLOSING';

    var card = document.createElement('div');
    card.className = 'todo-item todo-item-checklist ' + type;

    card.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
            '<span class="todo-item-name">' + label + ' Checklist</span>' +
            '<span class="todo-tag ' + type + '">' + label + '</span>' +
        '</div>' +
        '<div class="checklist-progress">' +
            '<div class="checklist-progress-fill" style="width:' + progress.percent + '%;background:' + color + '"></div>' +
        '</div>' +
        '<div class="checklist-progress-text">' + progress.done + '/' + progress.total + '</div>';

    card.addEventListener('click', function() {
        showChecklistModal(type, type === 'opening' ? openingItems : closingItems, type === 'opening' ? openingStatus : closingStatus);
    });

    container.appendChild(card);
}

// --- Checklist modal ---

function showChecklistModal(type, items, status) {
    var dateKey = window.firebaseDb.getDateKey();
    var label = type === 'opening' ? 'Opening' : 'Closing';
    var helpers = type === 'opening' ? window.firebaseDb.opening : window.firebaseDb.closing;

    SoundFX.pop();

    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.maxWidth = '500px';
    box.style.maxHeight = '85vh';
    box.style.overflowY = 'auto';

    var progress = getChecklistProgress(items, status);

    box.innerHTML =
        '<h3 style="margin:0 0 4px">' + label + ' Checklist</h3>' +
        '<div class="checklist-progress" style="margin-bottom:12px">' +
            '<div class="checklist-progress-fill" id="modal-progress-fill" style="width:' + progress.percent + '%;background:' + getProgressColor(progress.percent) + '"></div>' +
        '</div>' +
        '<div id="modal-progress-text" class="checklist-progress-text" style="margin-bottom:16px">' + progress.done + '/' + progress.total + '</div>' +
        '<ul class="checklist-list" id="checklist-modal-list"></ul>';

    backdrop.appendChild(box);
    document.body.appendChild(backdrop);

    var listEl = document.getElementById('checklist-modal-list');
    items.forEach(function(item) {
        var row = createChecklistRow(item, status[item.id], dateKey, type, helpers);
        listEl.appendChild(row);
    });

    // Close on backdrop click
    backdrop.addEventListener('click', function(e) {
        if (e.target === backdrop) {
            backdrop.remove();
            helpers.offStatusChange(dateKey);
        }
    });

    // Real-time status listener for modal updates
    helpers.onStatusChange(dateKey, function(newStatus) {
        var prog = getChecklistProgress(items, newStatus);
        var fill = document.getElementById('modal-progress-fill');
        var text = document.getElementById('modal-progress-text');
        if (fill) {
            fill.style.width = prog.percent + '%';
            fill.style.background = getProgressColor(prog.percent);
        }
        if (text) text.textContent = prog.done + '/' + prog.total;

        items.forEach(function(item) {
            updateChecklistRow(item, newStatus[item.id]);
        });

        if (isChecklistComplete(items, newStatus)) {
            SoundFX.complete();
            showNotification(label + ' Complete', prog.total + '/' + prog.total, 'success');
            setTimeout(function() {
                backdrop.remove();
                helpers.offStatusChange(dateKey);
            }, 1500);
        }
    });
}

// --- Checklist row creation + interaction ---

function createChecklistRow(item, itemStatus, dateKey, type, helpers) {
    var row = document.createElement('li');
    row.className = 'checklist-row';
    row.setAttribute('data-item-id', item.id);

    var isChecked = itemStatus && itemStatus.checked;
    var isCant = itemStatus && itemStatus.cantComplete;

    if (isChecked) row.classList.add('checked');
    if (isCant) row.classList.add('cant-complete');

    var checkZone = document.createElement('div');
    checkZone.className = 'checklist-check-zone';
    if (isChecked) { checkZone.classList.add('checked'); checkZone.textContent = '\u2713'; }
    else if (isCant) { checkZone.classList.add('cant-complete'); checkZone.textContent = '\u2717'; }

    var nameDiv = document.createElement('div');
    nameDiv.style.cssText = 'flex:1;padding:0 12px';
    var nameSpan = document.createElement('div');
    nameSpan.className = 'checklist-item-name';
    nameSpan.textContent = item.name;
    nameDiv.appendChild(nameSpan);

    if (isChecked && itemStatus.checkedBy) {
        var meta = document.createElement('div');
        meta.className = 'checklist-item-meta';
        var time = new Date(itemStatus.checkedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        meta.textContent = itemStatus.checkedBy + ' ' + time;
        nameDiv.appendChild(meta);
    }
    if (isCant && itemStatus.reason) {
        var reasonText = document.createElement('div');
        reasonText.className = 'checklist-reason-text';
        reasonText.textContent = itemStatus.reason;
        nameDiv.appendChild(reasonText);
    }

    var cantBtn = document.createElement('button');
    cantBtn.className = 'checklist-cant-btn';
    cantBtn.textContent = '\u2717';
    cantBtn.title = "Can't complete";

    checkZone.addEventListener('click', function() {
        if (isChecked || isCant) {
            helpers.clearItemStatus(dateKey, item.id);
            logChecklistAction('checklist-unchecked', type, item);
        } else {
            helpers.setItemStatus(dateKey, item.id, {
                checked: true,
                checkedBy: currentStaff,
                checkedAt: new Date().toISOString()
            });
            SoundFX.tap();
            checkZone.classList.add('just-checked');
            setTimeout(function() { checkZone.classList.remove('just-checked'); }, 400);
            logChecklistAction('checklist-done', type, item);
        }
    });

    cantBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (isCant) {
            helpers.clearItemStatus(dateKey, item.id);
            logChecklistAction('checklist-unchecked', type, item);
            return;
        }
        showCantCompleteInput(item, dateKey, type, helpers, row);
    });

    row.appendChild(checkZone);
    row.appendChild(nameDiv);
    row.appendChild(cantBtn);
    return row;
}

function showCantCompleteInput(item, dateKey, type, helpers, row) {
    var existing = row.querySelector('.checklist-reason-input');
    if (existing) { existing.remove(); return; }

    var input = document.createElement('input');
    input.className = 'checklist-reason-input';
    input.placeholder = 'Pourquoi ?';
    input.type = 'text';
    row.appendChild(input);
    input.focus();

    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && input.value.trim()) {
            helpers.setItemStatus(dateKey, item.id, {
                cantComplete: true,
                reason: input.value.trim(),
                reportedBy: currentStaff,
                reportedAt: new Date().toISOString()
            });
            logChecklistAction('checklist-blocked', type, item, input.value.trim());
            input.remove();
        }
    });
}

function updateChecklistRow(item, itemStatus) {
    var row = document.querySelector('[data-item-id="' + item.id + '"]');
    if (!row) return;

    var checkZone = row.querySelector('.checklist-check-zone');
    var nameDiv = row.querySelector('.checklist-item-name').parentElement;
    var isChecked = itemStatus && itemStatus.checked;
    var isCant = itemStatus && itemStatus.cantComplete;

    row.className = 'checklist-row' + (isChecked ? ' checked' : '') + (isCant ? ' cant-complete' : '');
    checkZone.className = 'checklist-check-zone' + (isChecked ? ' checked' : '') + (isCant ? ' cant-complete' : '');
    checkZone.textContent = isChecked ? '\u2713' : (isCant ? '\u2717' : '');

    var oldMeta = nameDiv.querySelector('.checklist-item-meta');
    if (oldMeta) oldMeta.remove();
    var oldReason = nameDiv.querySelector('.checklist-reason-text');
    if (oldReason) oldReason.remove();

    if (isChecked && itemStatus.checkedBy) {
        var meta = document.createElement('div');
        meta.className = 'checklist-item-meta';
        var time = new Date(itemStatus.checkedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        meta.textContent = itemStatus.checkedBy + ' ' + time;
        nameDiv.appendChild(meta);
    }
    if (isCant && itemStatus.reason) {
        var reasonText = document.createElement('div');
        reasonText.className = 'checklist-reason-text';
        reasonText.textContent = itemStatus.reason;
        nameDiv.appendChild(reasonText);
    }
}

function logChecklistAction(actionType, type, item, reason) {
    var prefix = type === 'opening' ? '[Opening]' : '[Closing]';
    var log = {
        id: 'log_' + Date.now(),
        timestamp: new Date().toISOString(),
        user: currentStaff,
        itemName: prefix + ' ' + item.name,
        actionType: actionType
    };
    if (reason) log.details = reason;
    window.firebaseDb.saveActivityLog(log);
}

function updateTodoList() {
    const sortedItems = sortItemsByDisplayOrder(prepItems);

    const itemsMarkedAsCantPrep = sortedItems.filter(item => item.canPrep === false);
    const cantPrepCount = itemsMarkedAsCantPrep.length;


    // Build unified todo array
    const todoItems = [];

    sortedItems
        .filter(item => (item.currentLevel < item.targetLevel * 0.5) || (item.canPrep === false))
        .forEach(item => {
            const percentage = item.currentLevel / item.targetLevel;
            let priority;
            if (item.canPrep === false) {
                priority = 5;
            } else if (item.currentLevel === 0 || percentage <= 0.25) {
                priority = 2;
            } else {
                priority = 4;
            }
            todoItems.push({ _type: 'prep', _sortPriority: priority, _subSort: percentage, data: item });
        });

    tasks.filter(isTaskDue).forEach(task => {
        const missed = getTaskMissedCount(task);
        const overdue = getTaskDaysOverdue(task);
        const priority = (missed > 0 || overdue > 0) ? 1 : 3;
        todoItems.push({ _type: 'task', _sortPriority: priority, _subSort: -missed, data: task, missed, overdue });
    });

    todoItems.sort((a, b) => {
        if (a._sortPriority !== b._sortPriority) return a._sortPriority - b._sortPriority;
        return a._subSort - b._subSort;
    });

    todoListContainer.innerHTML = '';
    const tasksContainer = document.getElementById('todo-tasks-container');
    if (tasksContainer) tasksContainer.innerHTML = '';

    const taskItems = todoItems.filter(e => e._type === 'task');
    const prepItemsList = todoItems.filter(e => e._type === 'prep');

    // Update section labels
    const tasksLabel = document.getElementById('todo-tasks-label');
    const tasksCount = document.getElementById('todo-tasks-count');
    const prepsLabel = document.getElementById('todo-preps-label');
    const prepsCount = document.getElementById('todo-preps-count');

    if (tasksLabel) {
        tasksLabel.style.display = taskItems.length > 0 ? 'flex' : 'none';
        if (tasksCount) tasksCount.textContent = taskItems.length;
    }
    if (prepsLabel) {
        prepsLabel.style.display = prepItemsList.length > 0 ? 'flex' : 'none';
        if (prepsCount) prepsCount.textContent = prepItemsList.length;
    }

    // Render checklist cards at top of tasks container (before early return check)
    if (tasksContainer) {
        renderChecklistCard('opening', openingItems, openingStatus, tasksContainer);
        renderChecklistCard('closing', closingItems, closingStatus, tasksContainer);
    }

    var hasChecklists = tasksContainer && tasksContainer.children.length > 0;

    // Check if all actionable work is done (Can't Prep items don't count)
    const actionableItems = todoItems.filter(e => !(e._type === 'prep' && e.data.canPrep === false));
    const allActionableDone = actionableItems.length === 0 && !hasChecklists;

    if (allActionableDone) {
        todoListContainer.innerHTML = `
            <div class="celebration-card">
                <div class="celebration-confetti"></div>
                <div class="celebration-check">&#10003;</div>
                <div class="celebration-title">All done!</div>
                <div class="celebration-sub">Great job, everything is prepped</div>
            </div>`;
        if (!window._celebrationShown) {
            window._celebrationShown = true;
            setTimeout(() => SoundFX.celebration(), 300);
        }
        // Still render Can't Prep items below the celebration if any
        const cantPrepItems = todoItems.filter(e => e._type === 'prep' && e.data.canPrep === false);
        cantPrepItems.forEach(entry => renderPrepTodoItem(entry.data));
        generateStatusSummary(todoItems);
        return;
    }

    // Reset celebration flag when there's work to do
    window._celebrationShown = false;

    if (todoItems.length === 0 && !hasChecklists) {
        todoListContainer.innerHTML = '<div class="todo-empty">All items are at good levels!</div>';
        generateStatusSummary(todoItems);
        return;
    }

    // Render tasks into tasks container
    taskItems.forEach(entry => {
        renderTaskTodoItem(entry.data, entry.missed, entry.overdue, tasksContainer);
    });

    // Render preps into preps container
    prepItemsList.forEach(entry => {
        renderPrepTodoItem(entry.data);
    });

    generateStatusSummary(todoItems);
}

function generateStatusSummary(todoItems) {
    const container = document.getElementById('status-summary');
    const content = document.getElementById('summary-content');
    if (!container || !content) return;

    const overdueTasks = [];
    const pendingTasks = [];
    const emptyPreps = [];
    const criticalPreps = [];
    const cantPrepPreps = [];

    todoItems.forEach(entry => {
        const name = entry.data.name || entry.data.title || entry.data.id || 'Unknown';
        if (entry._type === 'task') {
            if (entry.missed > 0 || entry.overdue > 0) {
                overdueTasks.push({ name: name, days: entry.overdue });
            } else {
                pendingTasks.push(name);
            }
        } else {
            const item = entry.data;
            if (item.canPrep === false) {
                cantPrepPreps.push({ name: name, reason: item.cantPrepReason || 'Unknown' });
            } else if (item.currentLevel === 0) {
                emptyPreps.push(name);
            } else if (item.currentLevel / item.targetLevel <= 0.25) {
                criticalPreps.push(name);
            }
        }
    });

    const lines = [];

    if (overdueTasks.length > 0) {
        const tags = overdueTasks.map(t =>
            `<span class="summary-badge overdue">${t.name}</span> ${t.days} jour${t.days > 1 ? 's' : ''} late`
        );
        lines.push(`<p class="summary-line urgent">${joinList(tags)} — overdue ⚠️</p>`);
    }

    if (emptyPreps.length > 0) {
        const tags = emptyPreps.map(n => `<span class="summary-badge empty">${n}</span>`).join(' ');
        lines.push(`<p class="summary-line urgent">${tags} completely empty</p>`);
    }

    if (criticalPreps.length > 0) {
        const tags = criticalPreps.map(n => `<span class="summary-badge critical">${n}</span>`).join(' ');
        lines.push(`<p class="summary-line warning">${tags} critically low</p>`);
    }

    if (pendingTasks.length > 0) {
        const tags = pendingTasks.map(n => `<span class="summary-badge task">${n}</span>`).join(' ');
        lines.push(`<p class="summary-line info">${tags} still pending</p>`);
    }

    if (cantPrepPreps.length > 0) {
        const grouped = {};
        cantPrepPreps.forEach(t => {
            if (!grouped[t.reason]) grouped[t.reason] = [];
            grouped[t.reason].push(t.name);
        });
        const parts = Object.entries(grouped).map(([reason, names]) => {
            const tags = names.map(n => `<span class="summary-badge cant-prep">${n}</span>`).join(' ');
            return `${reason} — ${tags}`;
        });
        lines.push(`<p class="summary-line muted">Can't prep: ${parts.join(', ')}</p>`);
    }

    if (lines.length === 0) {
        container.style.display = 'none';
        return;
    }

    content.innerHTML = lines.join('');
    container.style.display = 'block';
}

function joinList(items) {
    if (items.length === 1) return items[0];
    if (items.length === 2) return items[0] + ' and ' + items[1];
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
}

function renderPrepTodoItem(item) {
    const percentage = item.currentLevel / item.targetLevel;
    let badgeClass, badgeText;
    if (item.canPrep === false) {
        badgeClass = 'cant-prep';
        badgeText = "Can't Prep";
    } else if (item.currentLevel === 0) {
        badgeClass = 'empty';
        badgeText = 'EMPTY';
    } else if (percentage <= 0.25) {
        badgeClass = 'critical';
        badgeText = 'CRITICAL';
    } else if (percentage <= 0.4) {
        badgeClass = 'low';
        badgeText = 'LOW';
    } else {
        badgeClass = 'getting-low';
        badgeText = 'GETTING LOW';
    }
    let timeDisplay = '';
    if (item.lastCheckedTime) {
        try {
            const date = new Date(item.lastCheckedTime);
            if (!isNaN(date.getTime())) {
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                timeDisplay = `${hours}:${minutes}`;
            }
        } catch (e) {}
    }
    const todoItem = document.createElement('div');
    todoItem.className = 'todo-item';
    if (item.canPrep === false) {
        todoItem.style.borderLeftColor = '#ef4444';
        todoItem.style.opacity = '0.7';
    } else if (percentage === 0) {
        todoItem.style.borderLeftColor = '#ef4444';
    } else if (percentage <= 0.25) {
        todoItem.style.borderLeftColor = '#f97316';
    } else if (percentage <= 0.4) {
        todoItem.style.borderLeftColor = '#ca8a04';
    } else {
        todoItem.style.borderLeftColor = '#64748b';
    }
    todoItem.innerHTML = `
        <div class="todo-item-name">${item.name}</div>
        <div class="todo-item-detail"><span style="font-weight: 700;">Need:</span> ${item.targetLevel - item.currentLevel} more</div>
        ${item.canPrep === false ? `
            <div class="cant-prep-info" style="margin-top: 8px; background-color: #fff1f1; padding: 8px; border-radius: 4px; font-size: 13px;">
                <div style="font-weight: 600; color: #ef4444;">Can't Prep: ${item.cantPrepReason}</div>
                ${item.cantPrepReasonText ? `<div style="margin-top: 4px;">Reason: ${item.cantPrepReasonText}</div>` : ''}
                <div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 12px; color: #666;">
                    <span>By: ${item.cantPrepBy || 'Unknown'}</span>
                    <span>${formatDate(item.cantPrepTime)}</span>
                </div>
            </div>
        ` : ''}
        <div class="todo-footer">
            <span class="todo-tag ${badgeClass}">${badgeText}</span>
            <span class="todo-tag todo-tag--outline">Last updated ${timeDisplay}</span>
        </div>
    `;
    todoItem.addEventListener('click', () => {
        showQuickUpdateModal(item);
    });
    todoListContainer.appendChild(todoItem);
}

function renderTaskTodoItem(task, missed, overdue, container) {
    const isOverdue = missed > 0 || overdue > 0;
    let freqText = '';
    if (task.type === 'recurring') {
        freqText = `Every ${task.frequencyDays} day${task.frequencyDays > 1 ? 's' : ''}`;
    } else if (task.type === 'scheduled') {
        freqText = task.scheduledDate + (task.scheduledTime ? ' ' + task.scheduledTime : '');
    } else {
        freqText = 'One-off';
    }
    const todoItem = document.createElement('div');
    todoItem.className = 'todo-item todo-item-task';
    todoItem.style.borderLeftColor = isOverdue ? '#ef4444' : '#3b82f6';
    todoItem.innerHTML = `
        <div class="todo-item-name">${task.title}</div>
        ${isOverdue ? '<div class="todo-item-detail">En retard (' + overdue + ' jour' + (overdue > 1 ? 's' : '') + ')</div>' : ''}
        <div class="todo-footer">
            <span class="todo-tag ${isOverdue ? 'overdue' : 'task'}">${isOverdue ? 'OVERDUE' : 'TASK'}</span>
        </div>
    `;
    todoItem.addEventListener('click', () => {
        showTaskModal(task);
    });
    (container || todoListContainer).appendChild(todoItem);
}

function showTaskModal(task) {
    SoundFX.pop();
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'modal-backdrop';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-box';

    let freqText = '';
    if (task.type === 'recurring') {
        freqText = `Every ${task.frequencyDays} day${task.frequencyDays > 1 ? 's' : ''}`;
    } else if (task.type === 'scheduled') {
        freqText = task.scheduledDate + (task.scheduledTime ? ' at ' + task.scheduledTime : '');
    } else {
        freqText = 'One-off task';
    }

    let lastDoneText = 'Never done';
    if (task.lastCompletedAt) {
        const d = new Date(task.lastCompletedAt);
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        lastDoneText = `By ${task.lastCompletedBy || '?'}, ${d.toLocaleDateString('fr-FR')} at ${hours}:${minutes}`;
    }

    // Build header row with title + user picker
    const headerRow = document.createElement('div');
    headerRow.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:12px;';
    headerRow.appendChild(createModalUserPicker());
    const titleEl = document.createElement('h3');
    titleEl.style.cssText = 'margin:0;color:#333;';
    titleEl.textContent = task.title;
    headerRow.appendChild(titleEl);
    modalContent.appendChild(headerRow);

    const infoHtml = `
        ${task.description ? `<p style="margin: 0 0 16px 0; color: #555; font-size: 14px; line-height: 1.5;">${task.description}</p>` : ''}
        <div style="margin-bottom: 16px; padding: 12px; background: #f7f9f5; border-radius: 6px; font-size: 14px;">
            <div style="margin-bottom: 6px;"><strong>Type:</strong> ${freqText}</div>
            <div><strong>Last done:</strong> ${lastDoneText}</div>
        </div>
        <div style="display: flex; gap: 10px;">
            <button id="task-done-btn" style="flex: 1; padding: 14px; background-color: #80b244; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">Marquer comme fait</button>
            <button id="task-close-btn" style="padding: 14px 20px; background-color: #e5e7eb; color: #333; border: none; border-radius: 8px; font-size: 16px; cursor: pointer;">Fermer</button>
        </div>
    `;
    const infoDiv = document.createElement('div');
    infoDiv.innerHTML = infoHtml;
    modalContent.appendChild(infoDiv);

    modalBackdrop.appendChild(modalContent);
    document.body.appendChild(modalBackdrop);

    modalBackdrop.addEventListener('click', function(e) {
        if (e.target === modalBackdrop) {
            document.body.removeChild(modalBackdrop);
        }
    });
    modalContent.querySelector('#task-close-btn').addEventListener('click', function() {
        document.body.removeChild(modalBackdrop);
    });
    modalContent.querySelector('#task-done-btn').addEventListener('click', function() {
        completeTask(task);
        SoundFX.complete();
        document.body.removeChild(modalBackdrop);
    });
}

function completeTask(task) {
    const now = new Date().toISOString();
    const staffName = currentStaff || 'Unknown';
    task.lastCompletedAt = now;
    task.lastCompletedBy = staffName;
    // Clear forceDisplay so completed task doesn't stay in todo list
    if (task.forceDisplay) {
        task.forceDisplay = false;
    }
    window.firebaseDb.saveTask(task);
    window.firebaseDb.saveActivityLog({
        timestamp: now,
        user: staffName,
        itemName: task.title,
        actionType: 'task-done'
    });
}

function showCurrentPrepItem() {
    const item = prepItems[currentItemIndex];
    checkProgressElement.textContent = `Item ${currentItemIndex + 1} of ${prepItems.length}`;

    const userBadge = document.getElementById('check-user-badge');
    if (userBadge) userBadge.textContent = currentStaff;

    checkItemNameElement.textContent = item.name;
    checkItemTargetElement.innerHTML = `Target: <strong>${item.targetLevel}</strong> ${item.unit}`;
    
    // Reset the slider to 0 using the slider API
    if (prepCheckSlider) {
        prepCheckSlider.setValue(0);
    } else {
        // Fallback if slider isn't initialized yet
        currentLevelInput.value = '0';
    }
}

// Global variable to store the slider instance for the main prep check
let prepCheckSlider;

// New implementation of initTouchInput using the reusable component
function initTouchInput() {
    // Check if the necessary elements exist
    if (document.getElementById('current-value') && document.getElementById('handle')) {
        // Initialize the main prep check slider if not already done
        if (!prepCheckSlider) {
            prepCheckSlider = createTouchSlider({
                containerId: document.querySelector('.slider-container'),
                valueDisplayId: 'current-value',
                handleId: 'handle',
                progressId: 'progress',
                ticksId: 'ticks',
                decreaseId: 'decrease',
                increaseId: 'increase',
                hiddenInputId: 'current-level-input',
                initialValue: 0
            });
        }
    }
}

// Reusable touch slider creation function
function createTouchSlider(options) {
    const {
        containerId,
        valueDisplayId,
        handleId,
        progressId,
        ticksId,
        decreaseId,
        increaseId,
        hiddenInputId,
        initialValue = 0,
        minValue = 0,
        maxValue = 20
    } = options;


    // DOM elements
    const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    const valueDisplay = document.getElementById(valueDisplayId);
    const handle = document.getElementById(handleId);
    const progress = document.getElementById(progressId);
    const ticksContainer = document.getElementById(ticksId);
    const decreaseBtn = document.getElementById(decreaseId);
    const increaseBtn = document.getElementById(increaseId);
    const hiddenInput = document.getElementById(hiddenInputId);

    if (!container || !valueDisplay || !handle || !progress || !ticksContainer) {
        console.error('Missing required elements for slider');
        return null;
    }

    // Generate values array with the right increments
    const values = [];
    for (let i = 0; i <= 12; i++) {
        values.push(i * 0.25); // 0 to 3 in 0.25 increments
    }
    for (let i = 4; i <= maxValue; i++) {
        values.push(i); // 4 to 20 in increments of 1
    }

    // Instance-specific state
    let currentValue = findClosestValue(parseFloat(initialValue) || 0, values);
    let isDragging = false;

    // Find closest value in values array
    function findClosestValue(value, valueArray) {
        // Find exact match first
        const exactIndex = valueArray.indexOf(value);
        if (exactIndex !== -1) return value;

        // Find closest value
        let closest = valueArray[0];
        let closestDiff = Math.abs(value - closest);

        for (const v of valueArray) {
            const diff = Math.abs(value - v);
            if (diff < closestDiff) {
                closestDiff = diff;
                closest = v;
            }
        }
        return closest;
    }

    // Update the slider display
    function updateSlider() {
        const valueIndex = values.indexOf(currentValue);
        const percentage = valueIndex / (values.length - 1) * 100;

        handle.style.left = `${percentage}%`;
        progress.style.width = `${percentage}%`;

        // Format display value (show 2 decimal places for values < 3)
        valueDisplay.textContent = currentValue < 3 ? currentValue.toFixed(2) : currentValue.toFixed(0);

        // Update hidden input if provided
        if (hiddenInput) {
            hiddenInput.value = currentValue;
            // Trigger change event
            const event = new Event('change');
            hiddenInput.dispatchEvent(event);
        }
    }

    // Create tick marks
    function createTicks() {
        // Clear existing ticks
        ticksContainer.innerHTML = '';

        values.forEach((val, index) => {
            const percentage = index / (values.length - 1) * 100;
            
            // Create tick mark
            const tick = document.createElement('div');
            tick.className = val % 1 === 0 ? 'tick major' : 'tick';
            tick.style.left = `${percentage}%`;
            ticksContainer.appendChild(tick);
            
            // Add labels for whole numbers (but not for every number to avoid crowding)
            if (val % 1 === 0 && (val <= 3 || val % 2 === 0)) {
                const label = document.createElement('div');
                label.className = 'tick-label';
                label.textContent = val;
                label.style.left = `${percentage}%`;
                ticksContainer.appendChild(label);
            }
        });
    }

    // Event handlers
    function startDragging(e) {
        isDragging = true;
        e.preventDefault();
    }

    function stopDragging() {
        isDragging = false;
    }

    function handleMove(event) {
        if (!isDragging) return;

        const containerRect = container.getBoundingClientRect();
        const clientX = event.type.includes('touch') ? 
            event.touches[0].clientX : event.clientX;
        let percentage = (clientX - containerRect.left) / containerRect.width;

        // Clamp percentage
        percentage = Math.max(0, Math.min(percentage, 1));

        // Find closest value
        const valueIndex = Math.round(percentage * (values.length - 1));
        currentValue = values[valueIndex];

        updateSlider();
        event.preventDefault();
    }

    function handleClick(event) {
        if (event.target === handle) return;

        const containerRect = container.getBoundingClientRect();
        const percentage = (event.clientX - containerRect.left) / containerRect.width;

        // Find closest value
        const valueIndex = Math.round(percentage * (values.length - 1));
        currentValue = values[valueIndex];

        updateSlider();
    }

    function decreaseValue() {
        const currentIndex = values.indexOf(currentValue);
        if (currentIndex > 0) {
            currentValue = values[currentIndex - 1];
            updateSlider();
        }
    }

    function increaseValue() {
        const currentIndex = values.indexOf(currentValue);
        if (currentIndex < values.length - 1) {
            currentValue = values[currentIndex + 1];
            updateSlider();
        }
    }
    
    // Set up event handlers
    handle.addEventListener('mousedown', startDragging);
    handle.addEventListener('touchstart', startDragging);
    
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('touchmove', handleMove, { passive: false });
    
    document.addEventListener('mouseup', stopDragging);
    document.addEventListener('touchend', stopDragging);
    
    container.addEventListener('click', handleClick);
    
    if (decreaseBtn) decreaseBtn.addEventListener('click', decreaseValue);
    if (increaseBtn) increaseBtn.addEventListener('click', increaseValue);
    
    // Initialize
    createTicks();
    updateSlider();
    
    // Return an API for external control
    return {
        setValue: function(value) {
            currentValue = findClosestValue(value, values);
            updateSlider();
        },
        getValue: function() {
            return currentValue;
        },
        destroy: function() {
            // Remove event listeners
            handle.removeEventListener('mousedown', startDragging);
            handle.removeEventListener('touchstart', startDragging);
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('touchmove', handleMove);
            document.removeEventListener('mouseup', stopDragging);
            document.removeEventListener('touchend', stopDragging);
            container.removeEventListener('click', handleClick);
            if (decreaseBtn) decreaseBtn.removeEventListener('click', decreaseValue);
            if (increaseBtn) increaseBtn.removeEventListener('click', increaseValue);
        }
    };
}

// Main initialization - this needs to be at the end of the file
document.addEventListener('DOMContentLoaded', function() {
    initApp();
    
    // Initialize the last check tracker - THIS CALL IS NOW MOVED TO INDEX.HTML
    // if (window.LastCheckTracker) {
    //     window.LastCheckTracker.init();
    // }
});

function updateStats() {
    const total = prepItems.length;
    const itemsNeeded = prepItems.filter(item => item.currentLevel < item.targetLevel * 0.5).length;

    itemsNeededElement.textContent = itemsNeeded;
    const totalEl = document.getElementById('total-items');
    if (totalEl) totalEl.textContent = total;

    // Update progress bar
    const progressBar = document.getElementById('prep-progress-bar');
    if (progressBar && total > 0) {
        const donePercent = ((total - itemsNeeded) / total) * 100;
        progressBar.style.width = donePercent + '%';
        if (donePercent > 80) progressBar.style.backgroundColor = 'var(--primary-light)';
        else if (donePercent > 50) progressBar.style.backgroundColor = 'var(--accent-orange)';
        else progressBar.style.backgroundColor = 'var(--accent-red)';
    }
}

// Function to show staff selection modal before starting prep check
function showPrepCheckStaffModal() {
    // Create modal backdrop
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'modal-backdrop';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-box';

    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    modalHeader.innerHTML = `
        <h3 style="margin: 0 0 8px 0; color: var(--primary-dark); font-size: 22px; text-align: center;">Who will perform this check?</h3>
        <p style="margin: 0; color: var(--text-medium); text-align: center; font-size: 14px;">Select staff member performing Prep-Check</p>
    `;

    const staffContainer = document.createElement('div');
    staffContainer.className = 'staff-container';
    staffContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-medium);">Loading staff members...</div>';
    
    // Create buttons
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'btn-group';

    const confirmButton = document.createElement('button');
    confirmButton.textContent = 'Continue →';
    confirmButton.disabled = true;
    confirmButton.className = 'btn btn--primary';
    confirmButton.style.opacity = '0.5';

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.className = 'btn btn--secondary';
    
    buttonGroup.appendChild(cancelButton);
    buttonGroup.appendChild(confirmButton);
    
    // Add elements to modal
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(staffContainer);
    modalContent.appendChild(buttonGroup);
    modalBackdrop.appendChild(modalContent);
    
    // Add modal to document
    document.body.appendChild(modalBackdrop);
    
    // Store the selected staff name
    let selectedStaffName = null;

    // Function to select a staff member
    function selectStaffMember(staffName) {
        selectedStaffName = staffName;
        
        // Update UI to show selection
        const staffButtons = staffContainer.querySelectorAll('.staff-select-button');
        staffButtons.forEach(button => {
            button.classList.toggle('selected', button.getAttribute('data-staff') === staffName);
        });
        
        // Enable the confirm button
        confirmButton.disabled = false;
        confirmButton.style.opacity = '1';
        confirmButton.style.cursor = 'pointer';
    }
    
    // Function to close the modal
    function closeModal() {
        document.body.removeChild(modalBackdrop);
    }
    
    // Function to load staff members
    function loadStaffForSelection() {
        // Clear existing content
        staffContainer.innerHTML = '';
        
        if (window.firebaseDb && window.firebaseDb.loadStaffMembers) {
            window.firebaseDb.loadStaffMembers()
                .then(staffMembers => {
                    if (staffMembers && staffMembers.length > 0) {
                        // Filter to only show active staff members
                        const activeStaff = staffMembers.filter(staff => staff.active);
                        
                        if (activeStaff.length > 0) {
                            // Create buttons for each active staff member
                            activeStaff.forEach(staff => {
                                const staffButton = document.createElement('div');
                                const isCurrentUser = staff.name === currentStaff;
                                staffButton.className = 'staff-select-button' + (isCurrentUser ? ' selected' : '');
                                staffButton.setAttribute('data-staff', staff.name);
                                const initials = staff.name.split(' ').map(w => w[0]).join('').toUpperCase();
                                staffButton.innerHTML = `
                                    <span class="staff-initial">${initials}</span>
                                    <span class="staff-name">${staff.name}</span>
                                    <span class="staff-check">✓</span>
                                `;
                                
                                // Add click event
                                staffButton.addEventListener('click', () => {
                                    selectStaffMember(staff.name);
                                });
                                
                                staffContainer.appendChild(staffButton);
                                
                                // If this is the current user, pre-select them
                                if (isCurrentUser) {
                                    selectStaffMember(staff.name);
                                }
                            });
                        } else {
                            staffContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-medium);">No active staff members found.</div>';
                        }
                    } else {
                        // Fallback to hardcoded staff
                        createDefaultStaffButtons();
                    }
                })
                .catch(error => {
                    console.error('Error loading staff members:', error);
                    // Fallback to hardcoded staff
                    createDefaultStaffButtons();
                });
        } else {
            // Fallback to hardcoded staff
            createDefaultStaffButtons();
        }
    }
    
    // Create default staff buttons as fallback
    function createDefaultStaffButtons() {
        // Clear existing content
        staffContainer.innerHTML = '';
        
        // Default staff list
        const defaultStaff = [
            "Serge Men", "Tatiana", "Nadine", "Nicolas", "Omar"
        ];
        
        // Create button for each staff member
        defaultStaff.forEach(staffName => {
            const staffButton = document.createElement('div');
            const isCurrentUser = staffName === currentStaff;
            staffButton.className = 'staff-select-button' + (isCurrentUser ? ' selected' : '');
            staffButton.setAttribute('data-staff', staffName);
            const initials = staffName.split(' ').map(w => w[0]).join('').toUpperCase();
            staffButton.innerHTML = `
                <span class="staff-initial">${initials}</span>
                <span class="staff-name">${staffName}</span>
                <span class="staff-check">✓</span>
            `;
            
            // Add click event
            staffButton.addEventListener('click', () => {
                selectStaffMember(staffName);
            });
            
            staffContainer.appendChild(staffButton);
            
            // If this is the current user, pre-select them
            if (isCurrentUser) {
                selectStaffMember(staffName);
            }
        });
    }
    
    // Add event listeners
    cancelButton.addEventListener('click', closeModal);
    
    confirmButton.addEventListener('click', () => {
        if (selectedStaffName) {
            // Update the current staff with the selected one
            currentStaff = selectedStaffName;
            localStorage.setItem('currentStaff', selectedStaffName);

            // Update UI to show selected staff
            if (currentUserElement) {
                currentUserElement.textContent = currentStaff;
            }
            if (headerUserNameElement) {
                headerUserNameElement.textContent = currentStaff;
            }
            
            // Close the modal
            closeModal();
            
            // Start the prep check with the selected staff
            startPrepCheckProcess();
        }
    });
    
    // Close modal if backdrop is clicked
    modalBackdrop.addEventListener('click', (event) => {
        if (event.target === modalBackdrop) {
            closeModal();
        }
    });
    
    // Load staff members
    loadStaffForSelection();
    
    return new Promise((resolve) => {
        // Resolve the promise when the modal is closed
        confirmButton.addEventListener('click', () => {
            resolve(true);
        });
        
        cancelButton.addEventListener('click', () => {
            resolve(false);
        });
        
        modalBackdrop.addEventListener('click', (event) => {
            if (event.target === modalBackdrop) {
                resolve(false);
            }
        });
    });
}

// Update existing startPrepCheck function to show staff selection first
function startPrepCheck() {
    // Show staff selection modal first
    showPrepCheckStaffModal()
        .then(confirmed => {
            if (confirmed) {
                // The actual prep check process will be started by the modal's confirm button
                // (it calls startPrepCheckProcess)
            }
        });
}

// Function that handles the actual prep check process (formerly startPrepCheck)
function startPrepCheckProcess() {
    isChecking = true;
    currentItemIndex = 0;
    
    
    // Sort items using our helper function
    prepItems = sortItemsByDisplayOrder(prepItems);
    
    
    dashboardSection.style.display = 'none';
    prepCheckInterface.style.display = 'block';
    showCurrentPrepItem();
        
    // Initialize the touch input for the current item
    initTouchInput();
}

// Add this helper function to your code
function sortItemsByDisplayOrder(items) {
    return [...items].sort((a, b) => {
        // First by displayOrder if both items have it
        if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
            return a.displayOrder - b.displayOrder;
        }
        
        // If one has displayOrder and the other doesn't, prioritize the one with displayOrder
        if (a.displayOrder !== undefined && b.displayOrder === undefined) {
            return -1;
        }
        if (a.displayOrder === undefined && b.displayOrder !== undefined) {
            return 1;
        }
        
        // Fallback to ID as the default order
        return a.id - b.id;
    });
}

// Also update the loadItemsFromFirebase function in db-editor.js
// to ensure consistent sorting when items are loaded from Firebase
function loadItemsFromFirebase() {
    if (window.firebaseDb) {
        window.firebaseDb.loadItems()
            .then(items => {
                if (items && items.length > 0) {
                    prepItems = items;
                    // Apply consistent sorting logic
                    prepItems.sort((a, b) => {
                        // First by displayOrder if both items have it
                        if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
                            return a.displayOrder - b.displayOrder;
                        }
                        
                        // If only one item has displayOrder, prioritize it
                        if (a.displayOrder !== undefined && b.displayOrder === undefined) {
                            return -1; // Items with display order come first
                        }
                        if (a.displayOrder === undefined && b.displayOrder !== undefined) {
                            return 1; // Items with display order come first
                        }
                        
                        // Fallback to ID as the default order
                        return a.id - b.id;
                    });
                    
                    // Update UI with sorted items
                    updateInventoryTable();
                    updateTodoList();
                    updateStats();
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

function completePrepCheck() {
    isChecking = false;
    prepCheckInterface.style.display = 'none';
    dashboardSection.style.display = 'block';
    
    // Record the complete check
    if (window.LastCheckTracker) {
        window.LastCheckTracker.recordCompleteCheck(currentStaff);
    }
    
    // Update UI with new data
    updateInventoryTable();
    updateTodoList();
    updateStats();
}

function cancelPrepCheck() {
    isChecking = false;
    prepCheckInterface.style.display = 'none';
    dashboardSection.style.display = 'block';
}

function showMainInterface() {
    staffSelectionScreen.style.display = 'none';
    mainInterface.style.display = 'flex';

    currentUserElement.textContent = currentStaff;
    
    // Update the header user name too
    if (headerUserNameElement) {
        headerUserNameElement.textContent = currentStaff;
    }
    
    // Default to dashboard section
    switchSection('dashboard', document.querySelector('[data-section="dashboard"]'));
}

function showStaffSelection() {
    mainInterface.style.display = 'none';
    staffSelectionScreen.style.display = 'flex';
}

function toggleUserDropdown() {
    const existing = document.getElementById('user-dropdown');
    if (existing) { existing.remove(); return; }

    const btn = document.getElementById('user-login-btn');
    const rect = btn.getBoundingClientRect();

    const dropdown = document.createElement('div');
    dropdown.id = 'user-dropdown';
    dropdown.style.top = (rect.bottom + 6) + 'px';
    dropdown.style.left = rect.left + 'px';

    const staffList = window.staffMembers || [];
    staffList.forEach(member => {
        if (!member.active) return;
        const item = document.createElement('div');
        item.textContent = member.name;
        item.className = 'dropdown-item' + (member.name === currentStaff ? ' active' : '');
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            currentStaff = member.name;
            localStorage.setItem('currentStaff', member.name);
            showUserSwitchToast(member.name);
            showMainInterface();
            dropdown.remove();
        });
        dropdown.appendChild(item);
    });

    document.body.appendChild(dropdown);
    requestAnimationFrame(() => dropdown.classList.add('show'));
}

function toggleModalUserDropdown(btn) {
    const existing = document.getElementById('modal-user-dropdown');
    if (existing) { existing.remove(); return; }

    const rect = btn.getBoundingClientRect();
    const dropdown = document.createElement('div');
    dropdown.id = 'modal-user-dropdown';
    dropdown.className = 'user-dropdown-menu';
    dropdown.style.cssText = `
        position: fixed; top: ${rect.bottom + 6}px; left: ${rect.left}px;
        background: white; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        padding: 4px 0; z-index: 10001; min-width: 200px; border: 1px solid var(--border-light);
        opacity: 0; transform: translateY(-8px); transition: opacity 0.2s ease, transform 0.2s ease;
    `;

    const staffList = window.staffMembers || [];
    staffList.forEach(member => {
        if (!member.active) return;
        const item = document.createElement('div');
        item.textContent = member.name;
        item.className = 'dropdown-item' + (member.name === currentStaff ? ' active' : '');
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            currentStaff = member.name;
            localStorage.setItem('currentStaff', member.name);
            showUserSwitchToast(member.name);
            btn.innerHTML = `${member.name} <span style="font-size: 12px;">▼</span>`;
            dropdown.remove();
        });
        dropdown.appendChild(item);
    });

    document.body.appendChild(dropdown);
    requestAnimationFrame(() => {
        dropdown.style.opacity = '1';
        dropdown.style.transform = 'translateY(0)';
    });

    // Close on click outside
    const closeHandler = (e) => {
        if (!dropdown.contains(e.target) && e.target !== btn) {
            dropdown.remove();
            document.removeEventListener('click', closeHandler);
        }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

function switchSection(sectionId, buttonElement) {
    SoundFX.tap();
    // Update active nav button
    navButtons.forEach(btn => btn.classList.remove('active'));
    buttonElement.classList.add('active');
    
    // Show selected section, hide others
    contentSections.forEach(section => {
        section.style.display = 'none';
    });
    document.getElementById(`${sectionId}-section`).style.display = 'block';
    
    // Refresh data when switching to specific sections
    if (sectionId === 'inventory') {
        updateInventoryTable();
    } else if (sectionId === 'dashboard') {
        updateStats();
        updateTodoList();
    }
}

function updateInventoryTable() {
    inventoryTableBody.innerHTML = '';
    
    // Create a copy of the prepItems array to avoid modifying the original
    const sortedItems = [...prepItems];
    
    // Sort items by lastCheckedTime (most recent first) with robust date parsing
    sortedItems.sort((a, b) => {
        // Try to parse dates in various formats
        let dateA, dateB;
        
        try {
            // First try direct Date constructor
            dateA = new Date(a.lastCheckedTime);
            dateB = new Date(b.lastCheckedTime);
            
            // Check if dates are valid
            if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
                throw new Error('Invalid date');
            }
        } catch (e) {
            // Fallback: try to parse manually (assuming format: YYYY-MM-DD HH:MM or similar)
            try {
                const partsA = a.lastCheckedTime.split(/[- :]/);
                const partsB = b.lastCheckedTime.split(/[- :]/);
                
                dateA = new Date(
                    parseInt(partsA[0]), 
                    parseInt(partsA[1]) - 1, 
                    parseInt(partsA[2]), 
                    parseInt(partsA[3] || 0), 
                    parseInt(partsA[4] || 0)
                );
                
                dateB = new Date(
                    parseInt(partsB[0]), 
                    parseInt(partsB[1]) - 1, 
                    parseInt(partsB[2]), 
                    parseInt(partsB[3] || 0), 
                    parseInt(partsB[4] || 0)
                );
            } catch (err) {
                // If all parsing fails, use string comparison as last resort
                return b.lastCheckedTime.localeCompare(a.lastCheckedTime);
            }
        }
        
        // Sort in descending order (most recent first)
        return dateB - dateA;
    });
    
    // Create table rows for each item
    sortedItems.forEach(item => {
        const row = document.createElement('tr');
        
        // Calculate how recent the check was
        let isRecent = false;
        try {
            const checkDate = new Date(item.lastCheckedTime);
            const now = new Date();
            const diffTime = Math.abs(now - checkDate);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            // Add highlight class for recently checked items (within the last day)
            isRecent = (diffDays < 1);
        } catch (e) {
            // If date parsing fails, don't highlight
        }
        
        // Apply different background colors based on update type
        if (isRecent) {
            if (item.updateType === 'prep') {
                row.classList.add('prep-updated');
            } else {
                row.classList.add('count-updated');
            }
        }
        
        // Format the date using our formatDate function
        const formattedDate = formatDate(item.lastCheckedTime);
        
        const pct = item.targetLevel > 0 ? item.currentLevel / item.targetLevel : 1;
        const sc = pct <= 0.25 ? 'stock-critical' : pct <= 0.5 ? 'stock-low' : pct < 1 ? 'stock-ok' : 'stock-full';

        row.innerHTML = `
            <td class="item-name-cell">${item.name}</td>
            <td class="${sc}">${item.currentLevel} ${item.unit}</td>
            <td>${item.targetLevel} ${item.unit}</td>
            <td>${formattedDate}</td>
            <td>${item.lastCheckedBy || '<span class="text-muted">—</span>'}</td>
        `;
        
        // Make the entire row clickable
        row.style.cursor = 'pointer'; // Add pointer cursor to indicate clickable
        row.addEventListener('click', () => {
            showQuickUpdateModal(item);
        });
        
        inventoryTableBody.appendChild(row);
    });
}

// Add CSS for the stats grid layout
const statsGridStyle = document.createElement('style');
statsGridStyle.textContent = `
    .stats-grid {
        display: flex;
        gap: 15px;
        margin-bottom: 20px;
    }
    .stat-card {
        flex: 1;
        padding: 15px;
        border-radius: 8px;
        background-color: var(--bg-light);
    }
    .stat-label {
        color: var(--text-medium);
        margin-bottom: 5px;
    }
    .stat-value {
        font-size: 24px;
        font-weight: bold;
        color: var(--text-dark);
    }
`;
document.head.appendChild(statsGridStyle);

// Add the function to show the single item update modal
function showSingleItemUpdateModal() {
    SoundFX.pop();
    // Create modal backdrop
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'modal-backdrop';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-box';
    modalContent.style.maxWidth = '500px';

    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    const headerDiv = document.createElement('div');
    headerDiv.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 12px;';
    headerDiv.innerHTML = `<h2 style="margin: 0; color: var(--text-dark); font-size: 1.5rem; text-align: center;">Select item to update</h2>`;

    const userBtn = document.createElement('button');
    userBtn.className = 'user-login-btn';
    userBtn.innerHTML = `${currentStaff} <span style="font-size: 12px;">▼</span>`;
    userBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleModalUserDropdown(userBtn);
    });
    headerDiv.appendChild(userBtn);
    modalHeader.appendChild(headerDiv);
    
    // Create items container
    const itemsContainer = document.createElement('div');
    itemsContainer.style.display = 'flex';
    itemsContainer.style.flexDirection = 'column';
    itemsContainer.style.gap = '10px';
    
    // Sort prep items alphabetically by name
    const sortedItems = [...prepItems].sort((a, b) => a.name.localeCompare(b.name));
    
    // Create a button for each prep item
    sortedItems.forEach(item => {
        const itemButton = document.createElement('div');
        itemButton.className = 'prep-item-button';
        itemButton.style.padding = '15px';
        itemButton.style.backgroundColor = 'var(--bg-light)';
        itemButton.style.borderRadius = '6px';
        itemButton.style.cursor = 'pointer';
        itemButton.style.transition = 'background-color 0.2s';
        itemButton.style.display = 'flex';
        itemButton.style.justifyContent = 'space-between';
        itemButton.style.alignItems = 'center';
        
        // Calculate level percentage
        const percentage = item.targetLevel > 0 
            ? Math.round((item.currentLevel / item.targetLevel) * 100) 
            : 100;
        
        // Determine status color based on percentage
        let statusColor;
        let statusText;
        
        if (item.canPrep === false) {
            statusColor = '#ef4444';
            statusText = "Can't Prep";
        } else if (percentage <= 0) {
            statusColor = '#ef4444';
            statusText = 'Empty';
        } else if (percentage < 25) {
            statusColor = '#f97316';
            statusText = 'Critical';
        } else if (percentage < 50) {
            statusColor = '#ca8a04';
            statusText = 'Low';
        } else {
            // Change to green color for percentages above 50%
            statusColor = '#4CAF50';
            statusText = `${percentage}%`;
        }
        
        itemButton.innerHTML = `
            <div>
                <div style="font-weight: 500; color: var(--text-dark); font-size: 16px;">${item.name}</div>
                <div style="margin-top: 4px;">
                    <span style="font-weight: 700; font-size: 15px; color: var(--text-dark);">${item.currentLevel} / ${item.targetLevel}</span>
                    <span style="font-size: 12px; color: #999; margin-left: 4px;">${item.unit}</span>
                </div>
            </div>
            <div style="background-color: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">
                ${statusText}
            </div>
        `;
        
        // Add hover effect
        itemButton.addEventListener('mouseover', () => {
            itemButton.style.backgroundColor = 'var(--bg-medium)';
        });
        
        itemButton.addEventListener('mouseout', () => {
            itemButton.style.backgroundColor = 'var(--bg-light)';
        });
        
        // Add click event
        itemButton.addEventListener('click', () => {
            document.body.removeChild(modalBackdrop);
            showQuickUpdateModal(item, 'single-item-update');
        });
        
        itemsContainer.appendChild(itemButton);
    });
    
    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'btn-group';
    buttonContainer.style.justifyContent = 'flex-end';

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.className = 'btn btn--secondary';
    cancelButton.style.flex = 'none';
    
    // Add cancel button event
    cancelButton.addEventListener('click', () => {
        document.body.removeChild(modalBackdrop);
    });
    
    // Assemble modal
    buttonContainer.appendChild(cancelButton);
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(itemsContainer);
    modalContent.appendChild(buttonContainer);
    modalBackdrop.appendChild(modalContent);
    
    // Add modal to document
    document.body.appendChild(modalBackdrop);
    
    // Close modal when clicking on backdrop
    modalBackdrop.addEventListener('click', (event) => {
        if (event.target === modalBackdrop) {
            document.body.removeChild(modalBackdrop);
        }
    });
}
