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

// App state
let prepItems = [...initialPrepItems];
let currentStaff = '';
let currentItemIndex = 0;
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
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.padding = '15px';
    notification.style.backgroundColor = '#f44336';
    notification.style.color = 'white';
    notification.style.borderRadius = '5px';
    notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    notification.style.zIndex = '1000';
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
    
    // Set Serge Men as the default user
    currentStaff = 'Serge Men';
    
    // Show main interface directly
    showMainInterface();
    
    // Load staff members in background
    loadStaffMembers();

    switchUserButton.addEventListener('click', () => {
        currentStaff = '';
        showStaffSelection();
    });

    if (userLoginButton) {
        userLoginButton.addEventListener('click', () => {
            currentStaff = '';
            showStaffSelection();
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
                    // If Firebase returns empty, try loading from localStorage as fallback
                    loadLocalData();
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

            if (updatedItems && updatedItems.length > 0) {
                // Only update if we have valid data
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
        
        // Show success message
        const successMessage = document.createElement('div');
        successMessage.textContent = `${item.name} can now be prepped again`;
        successMessage.style.position = 'fixed';
        successMessage.style.bottom = '20px';
        successMessage.style.right = '20px';
        successMessage.style.padding = '10px';
        successMessage.style.backgroundColor = '#4CAF50';
        successMessage.style.color = 'white';
        successMessage.style.borderRadius = '5px';
        successMessage.style.zIndex = '1000';
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
    
    if (!item.currentLevel && item.currentLevel !== 0) {
        console.warn('Warning: currentLevel is undefined or null');
    }

    // Create modal elements with fixed positioning
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'modal-backdrop';
    modalBackdrop.style.position = 'fixed';
    modalBackdrop.style.top = '0';
    modalBackdrop.style.left = '0';
    modalBackdrop.style.width = '100%';
    modalBackdrop.style.height = '100%';
    modalBackdrop.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modalBackdrop.style.display = 'flex';
    modalBackdrop.style.justifyContent = 'center';
    modalBackdrop.style.alignItems = 'center';
    modalBackdrop.style.zIndex = '9999';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.position = 'relative';
    modalContent.style.backgroundColor = 'white';
    modalContent.style.padding = '20px';
    modalContent.style.borderRadius = '8px';
    modalContent.style.maxWidth = '90%';
    modalContent.style.width = '400px';
    modalContent.style.maxHeight = '90vh';
    modalContent.style.overflowY = 'auto';
    modalContent.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
    
    // Create header
    const modalHeader = document.createElement('div');
    modalHeader.style.marginBottom = '15px';
    modalHeader.innerHTML = `
        <h3 style="margin: 0;">${item.name}</h3>
        <p style="margin: 5px 0;">Current: ${item.currentLevel} ${item.unit}</p>
    `;

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
    buttonGroup.style.display = 'flex';
    buttonGroup.style.justifyContent = 'space-between';
    buttonGroup.style.marginTop = '20px';
    buttonGroup.style.gap = '10px'; // Add gap for better spacing
    
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.style.padding = '10px 20px';
    saveButton.style.backgroundColor = '#4CAF50';
    saveButton.style.color = 'white';
    saveButton.style.border = 'none';
    saveButton.style.borderRadius = '4px';
    saveButton.style.cursor = 'pointer';
    saveButton.style.fontWeight = 'bold';
    saveButton.style.flex = '1'; // Make buttons take equal space
    
    // Create Can't Prep/Can Prep Again button based on current status
    let cantPrepButton;

    if (item.canPrep === false) {
        // If the item is already marked as "can't prep", show "Can Prep Again" button
        cantPrepButton = document.createElement('button');
        cantPrepButton.textContent = 'Can Prep Again';
        cantPrepButton.style.padding = '10px 20px';
        cantPrepButton.style.backgroundColor = '#4CAF50'; // Green color
        cantPrepButton.style.color = 'white';
        cantPrepButton.style.border = 'none';
        cantPrepButton.style.borderRadius = '4px';
        cantPrepButton.style.cursor = 'pointer';
        cantPrepButton.style.fontWeight = 'bold';
        cantPrepButton.style.flex = '1'; // Make buttons take equal space
    } else {
        // Otherwise, show the regular "Can't Prep" button
        cantPrepButton = document.createElement('button');
        cantPrepButton.textContent = 'Can\'t Prep';
        cantPrepButton.style.padding = '10px 20px';
        cantPrepButton.style.backgroundColor = '#ef4444'; // Red color
        cantPrepButton.style.color = 'white';
        cantPrepButton.style.border = 'none';
        cantPrepButton.style.borderRadius = '4px';
        cantPrepButton.style.cursor = 'pointer';
        cantPrepButton.style.fontWeight = 'bold';
        cantPrepButton.style.flex = '1'; // Make buttons take equal space
    }
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.padding = '10px 20px';
    cancelButton.style.backgroundColor = '#f1f1f1';
    cancelButton.style.color = '#333';
    cancelButton.style.border = 'none';
    cancelButton.style.borderRadius = '4px';
    cancelButton.style.cursor = 'pointer';
    cancelButton.style.flex = '1'; // Make buttons take equal space
    
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
            
            // Show success message
            const successMessage = document.createElement('div');
            successMessage.textContent = `${item.name} updated to ${newValue} ${item.unit}`;
            successMessage.style.position = 'fixed';
            successMessage.style.bottom = '20px';
            successMessage.style.right = '20px';
            successMessage.style.padding = '10px';
            successMessage.style.backgroundColor = '#4CAF50';
            successMessage.style.color = 'white';
            successMessage.style.borderRadius = '5px';
            successMessage.style.zIndex = '1000';
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
    // Create modal backdrop
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'cant-prep-modal-backdrop';
    modalBackdrop.style.position = 'fixed';
    modalBackdrop.style.top = '0';
    modalBackdrop.style.left = '0';
    modalBackdrop.style.width = '100%';
    modalBackdrop.style.height = '100%';
    modalBackdrop.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modalBackdrop.style.display = 'flex';
    modalBackdrop.style.justifyContent = 'center';
    modalBackdrop.style.alignItems = 'center';
    modalBackdrop.style.zIndex = '1002'; // Higher than the previous modal

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'cant-prep-modal-content';
    modalContent.style.backgroundColor = 'white';
    modalContent.style.padding = '20px';
    modalContent.style.borderRadius = '5px';
    modalContent.style.width = '90%';
    modalContent.style.maxWidth = '450px';

    // Create modal header
    const modalHeader = document.createElement('div');
    modalHeader.style.marginBottom = '15px';
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
    buttonGroup.style.display = 'flex';
    buttonGroup.style.justifyContent = 'space-between';
    buttonGroup.style.marginTop = '20px';
    buttonGroup.style.gap = '10px';

    const confirmButton = document.createElement('button');
    confirmButton.textContent = 'Confirm';
    confirmButton.style.padding = '10px 20px';
    confirmButton.style.backgroundColor = '#ef4444';
    confirmButton.style.color = 'white';
    confirmButton.style.border = 'none';
    confirmButton.style.borderRadius = '4px';
    confirmButton.style.cursor = 'pointer';
    confirmButton.style.fontWeight = 'bold';
    confirmButton.style.flex = '1';

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.padding = '10px 20px';
    cancelButton.style.backgroundColor = '#f1f1f1';
    cancelButton.style.color = '#333';
    cancelButton.style.border = 'none';
    cancelButton.style.borderRadius = '4px';
    cancelButton.style.cursor = 'pointer';
    cancelButton.style.flex = '1';

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
        successMessage.style.position = 'fixed';
        successMessage.style.bottom = '20px';
        successMessage.style.right = '20px';
        successMessage.style.padding = '10px';
        successMessage.style.backgroundColor = '#ef4444';
        successMessage.style.color = 'white';
        successMessage.style.borderRadius = '5px';
        successMessage.style.zIndex = '1000';
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
        
        // Show success message
        const successMessage = document.createElement('div');
        successMessage.textContent = `${item.name} can now be prepped again`;
        successMessage.style.position = 'fixed';
        successMessage.style.bottom = '20px';
        successMessage.style.right = '20px';
        successMessage.style.padding = '10px';
        successMessage.style.backgroundColor = '#4CAF50';
        successMessage.style.color = 'white';
        successMessage.style.borderRadius = '5px';
        successMessage.style.zIndex = '1000';
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

function updateTodoList() {
    const sortedItems = sortItemsByDisplayOrder(prepItems);

    const itemsMarkedAsCantPrep = sortedItems.filter(item => item.canPrep === false);
    const cantPrepCount = itemsMarkedAsCantPrep.length;

    const todoTitleElement = document.querySelector('.todo-panel .todo-title');
    if (todoTitleElement) {
        let cantPrepBadge = todoTitleElement.querySelector('.cant-prep-badge');
        if (!cantPrepBadge) {
            cantPrepBadge = document.createElement('span');
            cantPrepBadge.className = 'cant-prep-badge';
            todoTitleElement.appendChild(cantPrepBadge);
        }
        if (cantPrepCount > 0) {
            cantPrepBadge.textContent = cantPrepCount;
            cantPrepBadge.style.display = 'inline-block';
        } else {
            cantPrepBadge.style.display = 'none';
        }
    }

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

    if (todoItems.length === 0) {
        todoListContainer.innerHTML = '<div class="todo-empty">All items are at good levels!</div>';
        return;
    }

    todoItems.forEach(entry => {
        if (entry._type === 'prep') {
            renderPrepTodoItem(entry.data);
        } else {
            renderTaskTodoItem(entry.data, entry.missed, entry.overdue);
        }
    });
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
        <div class="todo-item-detail">Current: ${item.currentLevel}</div>
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
            <span class="todo-item-detail todo-timestamp">${timeDisplay}</span>
        </div>
    `;
    todoItem.addEventListener('click', () => {
        showQuickUpdateModal(item);
    });
    todoListContainer.appendChild(todoItem);
}

function renderTaskTodoItem(task, missed, overdue) {
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
        <div class="todo-item-detail">${freqText}${isOverdue ? ' \u2022 En retard (' + overdue + ' jour' + (overdue > 1 ? 's' : '') + ')' : ''}</div>
        <div class="todo-footer">
            <span class="todo-tag ${isOverdue ? 'overdue' : 'task'}">${isOverdue ? 'OVERDUE' : 'TASK'}</span>
        </div>
    `;
    todoItem.addEventListener('click', () => {
        showTaskModal(task);
    });
    todoListContainer.appendChild(todoItem);
}

function showTaskModal(task) {
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'modal-backdrop';
    modalBackdrop.style.position = 'fixed';
    modalBackdrop.style.top = '0';
    modalBackdrop.style.left = '0';
    modalBackdrop.style.width = '100%';
    modalBackdrop.style.height = '100%';
    modalBackdrop.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modalBackdrop.style.display = 'flex';
    modalBackdrop.style.justifyContent = 'center';
    modalBackdrop.style.alignItems = 'center';
    modalBackdrop.style.zIndex = '9999';

    const modalContent = document.createElement('div');
    modalContent.style.position = 'relative';
    modalContent.style.backgroundColor = 'white';
    modalContent.style.padding = '24px';
    modalContent.style.borderRadius = '8px';
    modalContent.style.maxWidth = '90%';
    modalContent.style.width = '420px';
    modalContent.style.maxHeight = '90vh';
    modalContent.style.overflowY = 'auto';
    modalContent.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';

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

    modalContent.innerHTML = `
        <h3 style="margin: 0 0 12px 0; color: #333;">${task.title}</h3>
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
        document.body.removeChild(modalBackdrop);
    });
}

function completeTask(task) {
    const now = new Date().toISOString();
    const staffName = currentStaff || 'Unknown';
    task.lastCompletedAt = now;
    task.lastCompletedBy = staffName;
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
    
    // Update the item name element to include the user indicator
    checkItemNameElement.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
            <span>${item.name}</span>
            <span class="user-indicator">${currentStaff}</span>
        </div>
    `;
    
    checkItemTargetElement.textContent = `Target: ${item.targetLevel} ${item.unit}`;
    
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
    totalItemsElement.textContent = prepItems.length;
    
    const itemsNeeded = prepItems.filter(item => item.currentLevel < item.targetLevel * 0.5).length;
    itemsNeededElement.textContent = itemsNeeded;
}

// Function to show staff selection modal before starting prep check
function showPrepCheckStaffModal() {
    // Create modal backdrop
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'modal-backdrop';
    modalBackdrop.style.position = 'fixed';
    modalBackdrop.style.top = '0';
    modalBackdrop.style.left = '0';
    modalBackdrop.style.width = '100%';
    modalBackdrop.style.height = '100%';
    modalBackdrop.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modalBackdrop.style.display = 'flex';
    modalBackdrop.style.justifyContent = 'center';
    modalBackdrop.style.alignItems = 'center';
    modalBackdrop.style.zIndex = '1001';
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.backgroundColor = 'white';
    modalContent.style.padding = '24px';
    modalContent.style.borderRadius = '12px';
    modalContent.style.width = '90%';
    modalContent.style.maxWidth = '450px';
    modalContent.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
    
    // Create modal header
    const modalHeader = document.createElement('div');
    modalHeader.style.marginBottom = '20px';
    modalHeader.innerHTML = `
        <h3 style="margin: 0 0 12px 0; color: var(--primary-dark); font-size: 22px;">Who will perform this check?</h3>
        <p style="margin: 0; color: var(--text-medium);">Select staff member performing Prep-Check</p>
    `;
    
    // Create staff selection container
    const staffContainer = document.createElement('div');
    staffContainer.style.marginBottom = '24px';
    staffContainer.style.maxHeight = '300px';
    staffContainer.style.overflowY = 'auto';
    
    // Create a loading indicator initially
    staffContainer.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--text-medium);">
            <div>Loading staff members...</div>
        </div>
    `;
    
    // Create buttons
    const buttonGroup = document.createElement('div');
    buttonGroup.style.display = 'flex';
    buttonGroup.style.justifyContent = 'space-between';
    buttonGroup.style.gap = '12px';
    
    const confirmButton = document.createElement('button');
    confirmButton.textContent = 'Continue';
    confirmButton.disabled = true; // Disabled until a staff member is selected
    confirmButton.style.padding = '12px 24px';
    confirmButton.style.backgroundColor = 'var(--primary-medium)';
    confirmButton.style.color = 'white';
    confirmButton.style.border = 'none';
    confirmButton.style.borderRadius = '8px';
    confirmButton.style.fontWeight = '600';
    confirmButton.style.cursor = 'pointer';
    confirmButton.style.flex = '1';
    confirmButton.style.opacity = '0.7'; // Looks disabled initially
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.padding = '12px 24px';
    cancelButton.style.backgroundColor = '#f1f1f1';
    cancelButton.style.color = '#333';
    cancelButton.style.border = 'none';
    cancelButton.style.borderRadius = '8px';
    cancelButton.style.cursor = 'pointer';
    cancelButton.style.flex = '1';
    
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
            if (button.getAttribute('data-staff') === staffName) {
                button.classList.add('selected');
                button.style.borderColor = 'var(--primary-medium)';
                button.style.backgroundColor = 'var(--bg-medium)';
            } else {
                button.classList.remove('selected');
                button.style.borderColor = '#ddd';
                button.style.backgroundColor = 'white';
            }
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
                                staffButton.className = 'staff-select-button';
                                staffButton.setAttribute('data-staff', staff.name);
                                
                                // Highlight the current user
                                const isCurrentUser = staff.name === currentStaff;
                                
                                // Style the button
                                staffButton.style.padding = '14px';
                                staffButton.style.marginBottom = '10px';
                                staffButton.style.border = `2px solid ${isCurrentUser ? 'var(--primary-medium)' : '#ddd'}`;
                                staffButton.style.borderRadius = '8px';
                                staffButton.style.cursor = 'pointer';
                                staffButton.style.display = 'flex';
                                staffButton.style.alignItems = 'center';
                                staffButton.style.justifyContent = 'space-between';
                                staffButton.style.backgroundColor = isCurrentUser ? 'var(--bg-medium)' : 'white';
                                staffButton.style.transition = 'all 0.2s';
                                
                                staffButton.innerHTML = `
                                    <div style="font-weight: 500; color: var(--text-dark);">${staff.name}</div>
                                    ${isCurrentUser ? '<div style="color: var(--primary-dark); font-size: 14px; background-color: var(--accent-yellow); padding: 4px 8px; border-radius: 4px;">Current user</div>' : ''}
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
                            staffContainer.innerHTML = `
                                <div style="text-align: center; padding: 20px; color: var(--text-medium);">
                                    <div>No active staff members found.</div>
                                </div>
                            `;
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
            staffButton.className = 'staff-select-button';
            staffButton.setAttribute('data-staff', staffName);
            
            // Highlight the current user
            const isCurrentUser = staffName === currentStaff;
            
            // Style the button
            staffButton.style.padding = '14px';
            staffButton.style.marginBottom = '10px';
            staffButton.style.border = `2px solid ${isCurrentUser ? 'var(--primary-medium)' : '#ddd'}`;
            staffButton.style.borderRadius = '8px';
            staffButton.style.cursor = 'pointer';
            staffButton.style.display = 'flex';
            staffButton.style.alignItems = 'center';
            staffButton.style.justifyContent = 'space-between';
            staffButton.style.backgroundColor = isCurrentUser ? 'var(--bg-medium)' : 'white';
            
            staffButton.innerHTML = `
                <div style="font-weight: 500; color: var(--text-dark);">${staffName}</div>
                ${isCurrentUser ? '<div style="color: var(--primary-dark); font-size: 14px; background-color: var(--accent-yellow); padding: 4px 8px; border-radius: 4px;">Current user</div>' : ''}
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

function switchSection(sectionId, buttonElement) {
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
        
        row.innerHTML = `
            <td>${item.name}</td>
            <td>${item.currentLevel} ${item.unit}</td>
            <td>${item.targetLevel} ${item.unit}</td>
            <td>${formattedDate}</td>
            <td>${item.lastCheckedBy}</td>
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
    // Create modal backdrop
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'modal-backdrop';
    modalBackdrop.style.position = 'fixed';
    modalBackdrop.style.top = '0';
    modalBackdrop.style.left = '0';
    modalBackdrop.style.width = '100%';
    modalBackdrop.style.height = '100%';
    modalBackdrop.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modalBackdrop.style.display = 'flex';
    modalBackdrop.style.justifyContent = 'center';
    modalBackdrop.style.alignItems = 'center';
    modalBackdrop.style.zIndex = '1001';
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.backgroundColor = 'white';
    modalContent.style.padding = '20px';
    modalContent.style.borderRadius = '8px';
    modalContent.style.width = '90%';
    modalContent.style.maxWidth = '500px';
    modalContent.style.maxHeight = '80vh';
    modalContent.style.overflowY = 'auto';
    
    // Create modal header
    const modalHeader = document.createElement('div');
    modalHeader.style.marginBottom = '20px';
    modalHeader.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
            <h2 style="margin: 0; color: var(--text-dark); font-size: 1.5rem;">Select item to update</h2>
            <span style="background-color: #2196F3; color: white; padding: 4px 8px; border-radius: 4px; font-size: 14px;">${currentStaff}</span>
        </div>
    `;
    
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
                <div style="color: var(--text-medium); font-size: 14px; margin-top: 4px;">
                    ${item.currentLevel} / ${item.targetLevel} ${item.unit}
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
    buttonContainer.style.marginTop = '20px';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    
    // Create cancel button
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.padding = '10px 20px';
    cancelButton.style.backgroundColor = '#f1f1f1';
    cancelButton.style.color = '#333';
    cancelButton.style.border = 'none';
    cancelButton.style.borderRadius = '4px';
    cancelButton.style.cursor = 'pointer';
    cancelButton.style.fontWeight = '500';
    
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
