// Add this debugging function at the top of your ic-inventory.js file
function debugLog(message, data) {
  }

// Extract all unique locations and sublocations from items
function extractLocationsAndSublocations() {
    allLocations = new Set(['All']);
    allSublocations = new Map();
    
    icItems.forEach(item => {
        if (item.location) {
            allLocations.add(item.location);
            
            // Initialize sublocation set for this location if needed
            if (!allSublocations.has(item.location)) {
                allSublocations.set(item.location, new Set());
            }
            
            // Add sublocation to the set for this location
            if (item.sublocation) {
                allSublocations.get(item.location).add(item.sublocation);
            }
        }
    });
    
}

// Update location filter buttons
function updateLocationFilters() {
    // Dashboard location filter
    if (dashboardLocationFilter) {
        dashboardLocationFilter.innerHTML = '';
        
        [...allLocations].sort().forEach(location => {
            const button = document.createElement('button');
            button.className = 'location-button';
            if (location === currentLocation) {
                button.classList.add('active');
            }
            button.textContent = location;
            button.setAttribute('data-location', location);
            
            button.addEventListener('click', () => {
                // Update current location
                currentLocation = location;
                
                // Update active state on buttons
                document.querySelectorAll('.location-button').forEach(btn => {
                    if (btn.getAttribute('data-location') === location) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
                
                // Update inventory tables and low stock list
                updateInventoryTables();
                updateLowStockList();
            });
            
            dashboardLocationFilter.appendChild(button);
        });
    }
    
    // Inventory location filter
    if (inventoryLocationFilter) {
        inventoryLocationFilter.innerHTML = '';
        
        [...allLocations].sort().forEach(location => {
            const button = document.createElement('button');
            button.className = 'location-button';
            if (location === currentLocation) {
                button.classList.add('active');
            }
            button.textContent = location;
            button.setAttribute('data-location', location);
            
            button.addEventListener('click', () => {
                // Update current location
                currentLocation = location;
                
                // Update active state on buttons
                document.querySelectorAll('.location-button').forEach(btn => {
                    if (btn.getAttribute('data-location') === location) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
                
                // Update inventory tables and low stock list
                updateInventoryTables();
                updateLowStockList();
            });
            
            inventoryLocationFilter.appendChild(button);
        });
    }
}

// Update inventory tables
function updateInventoryTables() {
    if (!inventoryContent) return;
    
    // Clear current content
    inventoryContent.innerHTML = '';
    
    // Filter items by selected location
    const filteredItems = currentLocation === 'All' 
        ? icItems 
        : icItems.filter(item => item.location === currentLocation);
    
    // Group items by sublocation within the location
    const itemsBySubLocation = {};
    
    filteredItems.forEach(item => {
        const sublocation = item.sublocation || 'General';
        if (!itemsBySubLocation[sublocation]) {
            itemsBySubLocation[sublocation] = [];
        }
        itemsBySubLocation[sublocation].push(item);
    });
    
    // If no items found for this location
    if (Object.keys(itemsBySubLocation).length === 0) {
        inventoryContent.innerHTML = `
            <div style="text-align: center; padding: 30px; color: var(--text-medium);">
                <p>No items found for this location.</p>
                <button class="action-button" id="add-item-to-location">Add Item to ${currentLocation}</button>
            </div>
        `;
        
        // Add event listener to the add item button
        const addItemButton = document.getElementById('add-item-to-location');
        if (addItemButton) {
            addItemButton.addEventListener('click', showAddNewItemModal);
        }
        
        return;
    }
    
    // Sort sublocations alphabetically
    const sortedSubLocations = Object.keys(itemsBySubLocation).sort();
    
    // Create a table for each sublocation
    sortedSubLocations.forEach(sublocation => {
        const items = itemsBySubLocation[sublocation];
        
        // Create a sublocation header
        const subLocationHeader = document.createElement('div');
        subLocationHeader.className = 'sublocation-header';
        subLocationHeader.textContent = sublocation;
        
        // Create table
        const table = document.createElement('table');
        table.className = 'inventory-table';
        
        // Create table header
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>Item</th>
                <th>Current</th>
                <th>Target</th>
                <th>Last Checked</th>
                <th>Providers</th>
                <th>Actions</th>
            </tr>
        `;
        
        // Create table body
        const tbody = document.createElement('tbody');
        
        // Sort items by displayOrder or name
        items.sort((a, b) => {
            // First by displayOrder if available
            if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
                return a.displayOrder - b.displayOrder;
            }
            // Then by name
            return a.name.localeCompare(b.name);
        });
        
        // Add items to table body
        items.forEach(item => {
            const row = document.createElement('tr');
            
            // Format providers display
            let providersHtml = '';
            if (item.providers && item.providers.length > 0) {
                providersHtml = item.providers
                    .map(provider => `<span class="provider-badge">${provider}</span>`)
                    .join(' ');
            } else {
                providersHtml = '<span style="color: var(--text-light); font-style: italic;">None</span>';
            }
            
            // Format last checked time
            const formattedTime = formatDate(item.lastCheckedTime || 'Never');
            
            // Calculate percentage of current vs target
            const percentage = item.targetLevel > 0 
                ? (item.currentLevel / item.targetLevel * 100).toFixed(0) 
                : 0;
            
            // Choose color based on percentage
            let percentageColor = 'var(--primary-dark)';
            if (percentage < 25) {
                percentageColor = 'var(--accent-red)';
            } else if (percentage < 50) {
                percentageColor = 'var(--accent-orange)';
            }
            
            row.innerHTML = `
                <td>${item.name}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span>${item.currentLevel} ${item.unit}</span>
                        <span style="font-size: 12px; font-weight: bold; color: ${percentageColor};">${percentage}%</span>
                    </div>
                </td>
                <td>${item.targetLevel} ${item.unit}</td>
                <td>${formattedTime} by ${item.lastCheckedBy || 'Unknown'}</td>
                <td>${providersHtml}</td>
                <td>
                    <button class="edit-button" data-id="${item.id}">Update</button>
                </td>
            `;
            
            tbody.appendChild(row);
            
            // Add event listener to edit button
            const editButton = row.querySelector('.edit-button');
            if (editButton) {
                editButton.addEventListener('click', () => {
                    showQuickUpdateModal(item);
                });
            }
        });
        
        // Assemble the table
        table.appendChild(thead);
        table.appendChild(tbody);
        
        // Add sublocation header and table to the inventory content
        inventoryContent.appendChild(subLocationHeader);
        inventoryContent.appendChild(table);
        
        // Add some margin between tables
        const spacer = document.createElement('div');
        spacer.style.height = '20px';
        inventoryContent.appendChild(spacer);
    });
    
    // Add a button to add new items at the end
    const addButtonContainer = document.createElement('div');
    addButtonContainer.style.textAlign = 'center';
    addButtonContainer.style.marginTop = '20px';
    
    const addButton = document.createElement('button');
    addButton.className = 'action-button';
    addButton.innerHTML = `<i class="fas fa-plus"></i> Add New Item to ${currentLocation}`;
    addButton.addEventListener('click', showAddNewItemModal);
    
    addButtonContainer.appendChild(addButton);
    inventoryContent.appendChild(addButtonContainer);
}

// Update low stock list
function updateLowStockList() {
    if (!lowStockContainer) return;
    
    lowStockContainer.innerHTML = '';
    
    // Filter items that are below 50% of target and match current location if not "All"
    const lowStockItems = icItems.filter(item => {
        const isLowStock = item.currentLevel < item.targetLevel * 0.5;
        return isLowStock && (currentLocation === 'All' || item.location === currentLocation);
    }).sort((a, b) => {
        // Sort by percentage of target (lowest first)
        const percentA = a.currentLevel / a.targetLevel;
        const percentB = b.currentLevel / b.targetLevel;
        return percentA - percentB;
    });
    
    if (lowStockItems.length === 0) {
        lowStockContainer.innerHTML = '<div class="todo-empty">All items are at good levels!</div>';
        return;
    }
    
    lowStockItems.forEach(item => {
        // Format just the time (hours and minutes)
        let timeDisplay = '';
        if (item.lastCheckedTime) {
            try {
                const date = new Date(item.lastCheckedTime);
                if (!isNaN(date.getTime())) {
                    // Format just the hours and minutes
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    timeDisplay = `${hours}:${minutes}`;
                }
            } catch (e) {
                console.error("Error formatting date:", e);
            }
        }
        
        const todoItem = document.createElement('div');
        todoItem.className = 'todo-item';
        
        // Format providers
        let providersHtml = '';
        if (item.providers && item.providers.length > 0) {
            providersHtml = `
                <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px;">
                    ${item.providers.map(provider => 
                        `<span class="provider-badge">${provider}</span>`
                    ).join('')}
                </div>
            `;
        }
        
        todoItem.innerHTML = `
        <div class="todo-item-name">${item.name}</div>
        <div class="todo-item-detail">
            <span style="color: var(--text-medium); font-weight: 500;">${item.location}</span>
            ${item.sublocation ? `<span style="color: var(--text-light); font-size: 12px;"> › ${item.sublocation}</span>` : ''}
        </div>
        <div class="todo-item-detail">Current: ${item.currentLevel}</div>
        <div class="todo-item-detail"><span style="font-weight: 700;">Need:</span> ${(item.targetLevel - item.currentLevel).toFixed(1)} more</div>
        ${providersHtml}
        <div class="todo-footer">
            <span class="todo-tag ${item.currentLevel === 0 ? 'urgent' : 'low'}">
                ${item.currentLevel === 0 ? 'Out of Stock' : 'Low Stock'}
            </span>
            <span class="todo-item-detail todo-timestamp">${timeDisplay}</span>
        </div>
    `;
        
        // Make the entire card clickable
        todoItem.addEventListener('click', () => {
            showQuickUpdateModal(item);
        });
        
        lowStockContainer.appendChild(todoItem);
    });
}

// Update stats on dashboard
function updateStats() {
    if (!totalItemsElement || !itemsBelowFiftyElement) return;
    
    // Total items
    totalItemsElement.textContent = icItems.length;
    
    // Items below 50% of target
    const belowFifty = icItems.filter(item => item.currentLevel < item.targetLevel * 0.5).length;
    itemsBelowFiftyElement.textContent = belowFifty;
}

// Show the modal for adding a new item
function showAddNewItemModal() {
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
    modalContent.style.borderRadius = '5px';
    modalContent.style.width = '90%';
    modalContent.style.maxWidth = '500px';
    modalContent.style.maxHeight = '90vh';
    modalContent.style.overflowY = 'auto';
    
    // Create modal header
    const modalHeader = document.createElement('div');
    modalHeader.style.marginBottom = '20px';
    modalHeader.innerHTML = `
        <h3 style="margin: 0; color: var(--primary-dark); font-size: 22px;">Add New I&C Item</h3>
        <p style="margin: 8px 0 0 0; color: var(--text-medium);">
            Create a new ingredients & consumables tracking item
        </p>
    `;
    
    // Create form fields
    const formFields = document.createElement('div');
    formFields.style.display = 'grid';
    formFields.style.gap = '15px';
    
    // Generate a new ID (max ID + 1)
    const newId = icItems.length > 0 
        ? Math.max(...icItems.map(item => item.id)) + 1 
        : 1;
    
    // Helper function to create a form group
    function createFormGroup(id, label, type = 'text', value = '', required = true, placeholder = '') {
        const group = document.createElement('div');
        group.style.display = 'flex';
        group.style.flexDirection = 'column';
        group.style.gap = '5px';
        
        const labelEl = document.createElement('label');
        labelEl.htmlFor = id;
        labelEl.textContent = label;
        labelEl.style.fontWeight = '500';
        
        const input = document.createElement('input');
        input.type = type;
        input.id = id;
        input.value = value;
        input.required = required;
        input.placeholder = placeholder;
        input.style.padding = '10px';
        input.style.borderRadius = '4px';
        input.style.border = '1px solid var(--border-light)';
        
        group.appendChild(labelEl);
        group.appendChild(input);
        
        return group;
    }
    
    // Helper function to create a select group
    function createSelectGroup(id, label, options, value = '', required = true) {
        const group = document.createElement('div');
        group.style.display = 'flex';
        group.style.flexDirection = 'column';
        group.style.gap = '5px';
        
        const labelEl = document.createElement('label');
        labelEl.htmlFor = id;
        labelEl.textContent = label;
        labelEl.style.fontWeight = '500';
        
        const select = document.createElement('select');
        select.id = id;
        select.required = required;
        select.style.padding = '10px';
        select.style.borderRadius = '4px';
        select.style.border = '1px solid var(--border-light)';
        
        // Add options
        options.forEach(option => {
            const optionEl = document.createElement('option');
            optionEl.value = option;
            optionEl.textContent = option;
            
            if (option === value) {
                optionEl.selected = true;
            }
            
            select.appendChild(optionEl);
        });
        
        group.appendChild(labelEl);
        group.appendChild(select);
        
        return group;
    }
    
    // ID field (hidden)
    const idField = document.createElement('input');
    idField.type = 'hidden';
    idField.id = 'new-item-id';
    idField.value = newId;
    formFields.appendChild(idField);
    
    // Name field
    formFields.appendChild(createFormGroup('new-item-name', 'Item Name *', 'text', '', true, 'Enter item name'));
    
    // Current level field
    formFields.appendChild(createFormGroup('new-item-current', 'Current Level *', 'number', '0', true, '0'));
    
    // Target level field
    formFields.appendChild(createFormGroup('new-item-target', 'Target Level *', 'number', '1', true, '1'));
    
    // Unit field
    formFields.appendChild(createFormGroup('new-item-unit', 'Unit *', 'text', 'units', true, 'units, bottles, kg, etc.'));
    
    // Location field - with both dropdown of existing and option to create new
    const locationGroup = document.createElement('div');
    locationGroup.style.display = 'flex';
    locationGroup.style.flexDirection = 'column';
    locationGroup.style.gap = '5px';
    
    const locationLabel = document.createElement('label');
    locationLabel.htmlFor = 'new-item-location';
    locationLabel.textContent = 'Location *';
    locationLabel.style.fontWeight = '500';
    
    const locationSelect = document.createElement('select');
    locationSelect.id = 'new-item-location';
    locationSelect.required = true;
    locationSelect.style.padding = '10px';
    locationSelect.style.borderRadius = '4px';
    locationSelect.style.border = '1px solid var(--border-light)';
    
    // First option is to create a new location
    const newLocationOption = document.createElement('option');
    newLocationOption.value = 'new';
    newLocationOption.textContent = '+ Add New Location';
    locationSelect.appendChild(newLocationOption);
    
    // Add existing locations
    [...allLocations].filter(loc => loc !== 'All').sort().forEach(location => {
        const option = document.createElement('option');
        option.value = location;
        option.textContent = location;
        
        // Preselect current location if not "All"
        if (location === currentLocation && currentLocation !== 'All') {
            option.selected = true;
        }
        
        locationSelect.appendChild(option);
    });
    
    // New location input (hidden initially)
    const newLocationInput = document.createElement('input');
    newLocationInput.type = 'text';
    newLocationInput.id = 'new-location-input';
    newLocationInput.placeholder = 'Enter new location name';
    newLocationInput.style.padding = '10px';
    newLocationInput.style.borderRadius = '4px';
    newLocationInput.style.border = '1px solid var(--border-light)';
    newLocationInput.style.marginTop = '8px';
    newLocationInput.style.display = 'none';
    
    // Show/hide new location input based on selection
    locationSelect.addEventListener('change', () => {
        if (locationSelect.value === 'new') {
            newLocationInput.style.display = 'block';
            newLocationInput.required = true;
            
            // Also update sublocation options
            updateSublocationSelect(null);
        } else {
            newLocationInput.style.display = 'none';
            newLocationInput.required = false;
            
            // Update sublocation options for the selected location
            updateSublocationSelect(locationSelect.value);
        }
    });
    
    locationGroup.appendChild(locationLabel);
    locationGroup.appendChild(locationSelect);
    locationGroup.appendChild(newLocationInput);
    
    formFields.appendChild(locationGroup);
    
    // Sublocation field - with both dropdown of existing and option to create new
    const sublocationGroup = document.createElement('div');
    sublocationGroup.style.display = 'flex';
    sublocationGroup.style.flexDirection = 'column';
    sublocationGroup.style.gap = '5px';
    
    const sublocationLabel = document.createElement('label');
    sublocationLabel.htmlFor = 'new-item-sublocation';
    sublocationLabel.textContent = 'Sublocation';
    sublocationLabel.style.fontWeight = '500';
    
    const sublocationSelect = document.createElement('select');
    sublocationSelect.id = 'new-item-sublocation';
    sublocationSelect.style.padding = '10px';
    sublocationSelect.style.borderRadius = '4px';
    sublocationSelect.style.border = '1px solid var(--border-light)';
    
    // Function to update sublocation options based on selected location
    function updateSublocationSelect(location) {
        sublocationSelect.innerHTML = '';
        
        // First option is for no sublocation
        const noSublocationOption = document.createElement('option');
        noSublocationOption.value = '';
        noSublocationOption.textContent = 'General (No Sublocation)';
        sublocationSelect.appendChild(noSublocationOption);
        
        // Next option is to create a new sublocation
        const newSublocationOption = document.createElement('option');
        newSublocationOption.value = 'new';
        newSublocationOption.textContent = '+ Add New Sublocation';
        sublocationSelect.appendChild(newSublocationOption);
        
        // Add existing sublocations for selected location
        if (location && allSublocations.has(location)) {
            [...allSublocations.get(location)].sort().forEach(sublocation => {
                const option = document.createElement('option');
                option.value = sublocation;
                option.textContent = sublocation;
                sublocationSelect.appendChild(option);
            });
        }
        
        // Update the display of new sublocation input
        if (sublocationSelect.value === 'new') {
            newSublocationInput.style.display = 'block';
        } else {
            newSublocationInput.style.display = 'none';
        }
    }
    
    // New sublocation input (hidden initially)
    const newSublocationInput = document.createElement('input');
    newSublocationInput.type = 'text';
    newSublocationInput.id = 'new-sublocation-input';
    newSublocationInput.placeholder = 'Enter new sublocation name';
    newSublocationInput.style.padding = '10px';
    newSublocationInput.style.borderRadius = '4px';
    newSublocationInput.style.border = '1px solid var(--border-light)';
    newSublocationInput.style.marginTop = '8px';
    newSublocationInput.style.display = 'none';
    
    // Show/hide new sublocation input based on selection
    sublocationSelect.addEventListener('change', () => {
        if (sublocationSelect.value === 'new') {
            newSublocationInput.style.display = 'block';
            newSublocationInput.required = true;
        } else {
            newSublocationInput.style.display = 'none';
            newSublocationInput.required = false;
        }
    });
    
    sublocationGroup.appendChild(sublocationLabel);
    sublocationGroup.appendChild(sublocationSelect);
    sublocationGroup.appendChild(newSublocationInput);
    
    formFields.appendChild(sublocationGroup);
    
    // Initialize sublocation options
    updateSublocationSelect(currentLocation !== 'All' ? currentLocation : null);
    
    // Providers section
    const providersGroup = document.createElement('div');
    providersGroup.style.display = 'flex';
    providersGroup.style.flexDirection = 'column';
    providersGroup.style.gap = '5px';
    providersGroup.style.marginTop = '10px';
    
    const providersLabel = document.createElement('label');
    providersLabel.textContent = 'Providers';
    providersLabel.style.fontWeight = '500';
    
    const providersChips = document.createElement('div');
    providersChips.className = 'provider-chips';
    providersChips.id = 'providers-chips';
    
    const addProviderInput = document.createElement('div');
    addProviderInput.className = 'add-provider-input';
    
    const providerInput = document.createElement('input');
    providerInput.type = 'text';
    providerInput.id = 'provider-input';
    providerInput.placeholder = 'Add a provider';
    
    const addProviderButton = document.createElement('button');
    addProviderButton.textContent = 'Add';
    addProviderButton.type = 'button';
    
    // Current providers array
    const providers = [];
    
    // Function to add a provider
    function addProvider() {
        const providerName = providerInput.value.trim();
        if (providerName && !providers.includes(providerName)) {
            providers.push(providerName);
            updateProviderChips();
            providerInput.value = '';
        }
    }
    
    // Function to update provider chips display
    function updateProviderChips() {
        providersChips.innerHTML = '';
        
        providers.forEach(provider => {
            const chip = document.createElement('div');
            chip.className = 'provider-chip';
            
            const chipText = document.createElement('span');
            chipText.textContent = provider;
            
            const removeButton = document.createElement('button');
            removeButton.className = 'remove-provider';
            removeButton.textContent = '×';
            removeButton.addEventListener('click', () => {
                const index = providers.indexOf(provider);
                if (index !== -1) {
                    providers.splice(index, 1);
                    updateProviderChips();
                }
            });
            
            chip.appendChild(chipText);
            chip.appendChild(removeButton);
            providersChips.appendChild(chip);
        });
    }
    
    // Add event listeners
    addProviderButton.addEventListener('click', addProvider);
    providerInput.addEventListener('keypress', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            addProvider();
        }
    });
    
    addProviderInput.appendChild(providerInput);
    addProviderInput.appendChild(addProviderButton);
    
    providersGroup.appendChild(providersLabel);
    providersGroup.appendChild(providersChips);
    providersGroup.appendChild(addProviderInput);
    
    formFields.appendChild(providersGroup);
    
    // Create buttons
    const buttonGroup = document.createElement('div');
    buttonGroup.style.display = 'flex';
    buttonGroup.style.justifyContent = 'space-between';
    buttonGroup.style.marginTop = '20px';
    buttonGroup.style.gap = '10px';
    
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save Item';
    saveButton.className = 'action-button';
    saveButton.style.flex = '1';
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.className = 'secondary-button';
    cancelButton.style.flex = '1';
    
    buttonGroup.appendChild(cancelButton);
    buttonGroup.appendChild(saveButton);
    
    // Add all elements to modal
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(formFields);
    modalContent.appendChild(buttonGroup);
    modalBackdrop.appendChild(modalContent);
    
    // Add to document
    document.body.appendChild(modalBackdrop);
    
    // Function to close modal
    function closeModal() {
        document.body.removeChild(modalBackdrop);
    }
    
    // Save data function to ensure Firebase saves are completed properly
    function saveData() {
        // Always save to local storage as backup
        localStorage.setItem('icItems', JSON.stringify(icItems));
        
        // Save to Firebase if available
        if (window.firebaseDb && window.firebaseDb.saveAllIcItems) {
            // Use batch update for better consistency
            window.firebaseDb.saveAllIcItems(icItems)
                .then(() => {
                })
                .catch(error => {
                    console.error("Error saving to Firebase:", error);
                    // Show an error notification
                    showErrorMessage("Failed to save data to server. Please check your connection.");
                });
        } else if (window.firebaseDb && window.firebaseDb.saveIcItem) {
            // Fallback to individual updates if batch not available
            
            // Save the newest item (most recently added)
            const latestItem = icItems[icItems.length - 1];
            
            window.firebaseDb.saveIcItem(latestItem)
                .then(() => {
                })
                .catch(error => {
                    console.error(`Error saving item ${latestItem.id}:`, error);
                    showErrorMessage("Failed to save item to the server.");
                });
        }
    }
    
    // Function to log activity changes
    function logActivityChange(item, oldValue, newValue, actionType) {
        if (window.firebaseDb && typeof window.firebaseDb.saveIcActivityLog === 'function') {
            const activity = {
                timestamp: new Date().toISOString(),
                user: currentStaff,
                itemId: item.id,
                itemName: item.name,
                location: item.location,
                sublocation: item.sublocation,
                actionType: actionType,
                oldValue: oldValue,
                newValue: newValue,
                unit: item.unit
            };
            
            window.firebaseDb.saveIcActivityLog(activity)
                .then(() => {
                })
                .catch(error => {
                    console.error("Error logging activity:", error);
                });
        }
    }
    
    // Function to show error message
    function showErrorMessage(message) {
        const notification = document.createElement('div');
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.right = '20px';
        notification.style.padding = '15px';
        notification.style.backgroundColor = '#ef4444';
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
    
    // Function to show success message
    function showSuccessMessage(message) {
        const notification = document.createElement('div');
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.right = '20px';
        notification.style.padding = '15px';
        notification.style.backgroundColor = '#4CAF50';
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
        }, 3000);
    }
    
    // Save button event
    saveButton.addEventListener('click', () => {
        // Validate form fields
        const name = document.getElementById('new-item-name').value.trim();
        const currentLevel = parseFloat(document.getElementById('new-item-current').value);
        const targetLevel = parseFloat(document.getElementById('new-item-target').value);
        const unit = document.getElementById('new-item-unit').value.trim();
        
        // Get location
        let location;
        if (locationSelect.value === 'new') {
            location = newLocationInput.value.trim();
        } else {
            location = locationSelect.value;
        }
        
        // Get sublocation
        let sublocation = '';
        if (sublocationSelect.value === 'new') {
            sublocation = newSublocationInput.value.trim();
        } else if (sublocationSelect.value !== '') {
            sublocation = sublocationSelect.value;
        }
        
        // Validation
        if (!name) {
            alert('Please enter an item name');
            return;
        }
        
        if (isNaN(currentLevel) || currentLevel < 0) {
            alert('Current level must be a valid number (0 or greater)');
            return;
        }
        
        if (isNaN(targetLevel) || targetLevel <= 0) {
            alert('Target level must be a valid number (greater than 0)');
            return;
        }
        
        if (!unit) {
            alert('Please enter a unit');
            return;
        }
        
        if (!location) {
            alert('Please select or enter a location');
            return;
        }
        
        // Create new item object
        const newItem = {
            id: parseInt(document.getElementById('new-item-id').value),
            name: name,
            currentLevel: currentLevel,
            targetLevel: targetLevel,
            unit: unit,
            location: location,
            sublocation: sublocation,
            providers: providers,
            lastCheckedTime: new Date().toISOString(),
            lastCheckedBy: currentStaff,
            displayOrder: icItems.length > 0 ? Math.max(...icItems.map(item => item.displayOrder || 0)) + 1 : 1
        };
        
        // Add to icItems array
        icItems.push(newItem);
        
        // Save to Firebase and local storage
        saveData();
        
        // Log the activity
        logActivityChange(newItem, null, newItem.currentLevel, 'add');
        
        // Extract locations and update UI
        extractLocationsAndSublocations();
        updateLocationFilters();
        updateInventoryTables();
        updateLowStockList();
        updateStats();
        
        // Show success message
        showSuccessMessage(`New item "${name}" added successfully`);
        
        // Close modal
        closeModal();
    });
    
    // Cancel button event
    cancelButton.addEventListener('click', closeModal);
    
    // Close on backdrop click
    modalBackdrop.addEventListener('click', (event) => {
        if (event.target === modalBackdrop) {
            closeModal();
        }
    });
}

// Show quick update modal for an item
function showQuickUpdateModal(item) {
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
    modalContent.style.borderRadius = '5px';
    modalContent.style.width = '90%';
    modalContent.style.maxWidth = '450px';
    
    // Create modal header
    const modalHeader = document.createElement('div');
    modalHeader.style.marginBottom = '15px';
    modalHeader.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <h3 style="margin: 0; color: #333;">Update ${item.name}</h3>
        <span style="background-color: var(--accent-orange); color: white; padding: 4px 8px; border-radius: 4px; font-size: 14px; font-weight: 500;">${currentStaff}</span>
     </div>
     <div style="display: flex; align-items: center; gap: 8px; margin: 5px 0;">
        <div>Current: ${item.currentLevel} ${item.unit}</div>
        <div style="margin: 0 4px;">|</div>
        <div>Target: ${item.targetLevel} ${item.unit}</div>
     </div>
     <div style="display: flex; gap: 4px; align-items: center; margin-top: 4px;">
        <span style="font-weight: 500; color: var(--text-medium);">${item.location}</span>
        ${item.sublocation ? `<span style="color: var(--text-light); font-size: 14px;">› ${item.sublocation}</span>` : ''}
     </div>
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
    hiddenInput.value = item.currentLevel;
    
    // Create touch-friendly slider control
    const touchInput = document.createElement('div');
    touchInput.className = 'touch-input-container';
    touchInput.innerHTML = `
        <div class="value-display">
            <span id="modal-current-value">${item.currentLevel}</span>
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
    
    inputGroup.appendChild(label);
    inputGroup.appendChild(hiddenInput);
    inputGroup.appendChild(touchInput);
    
    // Providers section
    let providersHtml = '';
    if (item.providers && item.providers.length > 0) {
        providersHtml = `
            <div class="modal-providers">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Providers:</label>
                <div>
                    ${item.providers.map(provider => 
                        `<span class="provider-badge">${provider}</span>`
                    ).join(' ')}
                </div>
            </div>
        `;
    }
    
    // Create buttons
    const buttonGroup = document.createElement('div');
    buttonGroup.style.display = 'flex';
    buttonGroup.style.justifyContent = 'space-between';
    buttonGroup.style.marginTop = '20px';
    buttonGroup.style.gap = '10px';
    
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.style.padding = '10px 20px';
    saveButton.style.backgroundColor = '#4CAF50';
    saveButton.style.color = 'white';
    saveButton.style.border = 'none';
    saveButton.style.borderRadius = '4px';
    saveButton.style.cursor = 'pointer';
    saveButton.style.fontWeight = 'bold';
    saveButton.style.flex = '1';
    
    const editButton = document.createElement('button');
    editButton.textContent = 'Edit Details';
    editButton.style.padding = '10px 20px';
    editButton.style.backgroundColor = '#3b82f6';
    editButton.style.color = 'white';
    editButton.style.border = 'none';
    editButton.style.borderRadius = '4px';
    editButton.style.cursor = 'pointer';
    editButton.style.fontWeight = 'bold';
    editButton.style.flex = '1';
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.padding = '10px 20px';
    cancelButton.style.backgroundColor = '#f1f1f1';
    cancelButton.style.color = '#333';
    cancelButton.style.border = 'none';
    cancelButton.style.borderRadius = '4px';
    cancelButton.style.cursor = 'pointer';
    cancelButton.style.flex = '1';
    
    // Add buttons in order
    buttonGroup.appendChild(cancelButton);
    buttonGroup.appendChild(editButton);
    buttonGroup.appendChild(saveButton);
    
    // Add all elements to modal
    modalContent.appendChild(modalHeader);
    if (providersHtml) {
        const providersElement = document.createElement('div');
        providersElement.innerHTML = providersHtml;
        modalContent.appendChild(providersElement);
    }
    modalContent.appendChild(inputGroup);
    modalContent.appendChild(buttonGroup);
    modalBackdrop.appendChild(modalContent);
    
    // Add modal to document
    document.body.appendChild(modalBackdrop);
    
    // Create a variable to hold the slider instance
    let modalSlider;
    
    // Initialize the slider for this modal
    // This needs to happen after the elements are added to the DOM
    setTimeout(() => {
        modalSlider = createTouchSlider({
            containerId: modalContent.querySelector('.slider-container'),
            valueDisplayId: 'modal-current-value',
            handleId: 'modal-handle',
            progressId: 'modal-progress',
            ticksId: 'modal-ticks',
            decreaseId: 'modal-decrease',
            increaseId: 'modal-increase',
            hiddenInputId: 'modal-current-level',
            initialValue: item.currentLevel
        });
    }, 0);
    
    // Function to close modal and clean up
    function closeModal() {
        // Destroy slider to clean up event listeners
        if (modalSlider) {
            modalSlider.destroy();
        }
        document.body.removeChild(modalBackdrop);
    }
    
    // Save data function for Firebase
    function saveData() {
        // Always save to local storage as backup
        localStorage.setItem('icItems', JSON.stringify(icItems));
        
        // Save to Firebase if available
        if (window.firebaseDb && window.firebaseDb.saveAllIcItems) {
            // Use batch update for better consistency
            window.firebaseDb.saveAllIcItems(icItems)
                .then(() => {
                })
                .catch(error => {
                    console.error("Error saving to Firebase:", error);
                    // Show an error notification
                    showErrorMessage("Failed to save data to server. Please check your connection.");
                });
        } else if (window.firebaseDb && window.firebaseDb.saveIcItem) {
            // Find the updated item
            const updatedItem = icItems.find(i => i.id === item.id);
            
            if (updatedItem) {
                window.firebaseDb.saveIcItem(updatedItem)
                    .then(() => {
                    })
                    .catch(error => {
                        console.error(`Error saving item ${updatedItem.id}:`, error);
                        showErrorMessage("Failed to save item to the server.");
                    });
            }
        }
    }
    
    // Add event listeners
    cancelButton.addEventListener('click', closeModal);
    
    editButton.addEventListener('click', () => {
        closeModal();
        showEditItemDetailsModal(item);
    });
    
    saveButton.addEventListener('click', () => {
        const newValue = parseFloat(hiddenInput.value);
        if (isNaN(newValue) || newValue < 0) {
            alert('Please enter a valid number');
            return;
        }
        
        // Find the item in the icItems array
        const itemIndex = icItems.findIndex(i => i.id === item.id);
        if (itemIndex !== -1) {
            // Store old value before updating
            const oldValue = icItems[itemIndex].currentLevel;
            
            // Update the item
            icItems[itemIndex].currentLevel = newValue;
            icItems[itemIndex].lastCheckedBy = currentStaff;
            icItems[itemIndex].lastCheckedTime = new Date().toISOString();
            
            // Save to localStorage and Firebase
            saveData();
            
            // Log the activity
            logActivityChange(icItems[itemIndex], oldValue, newValue, 'count');
            
            // Update UI
            updateInventoryTables();
            updateLowStockList();
            updateStats();
            
            // Show success message
            showSuccessMessage(`${item.name} updated to ${newValue} ${item.unit}`);
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

// Reusable touch slider creation function
function createTouchSlider(options) {
    const {
        containerId, // Container element ID or element
        valueDisplayId, // Element to display current value
        handleId, // Slider handle element
        progressId, // Progress bar element
        ticksId, // Ticks container element
        decreaseId, // Decrease button ID
        increaseId, // Increase button ID
        hiddenInputId, // Hidden input to store value
        initialValue = 0, // Starting value
        minValue = 0, // Minimum value
        maxValue = 20 // Maximum value
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
    let currentValue = findClosestValue(initialValue, values);
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

// Function to show the main interface after selecting a staff member
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

// Show the staff selection screen
function showStaffSelection() {
    mainInterface.style.display = 'none';
    staffSelectionScreen.style.display = 'flex';
}

// Switch between content sections
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
        updateInventoryTables();
    } else if (sectionId === 'dashboard') {
        updateStats();
        updateLowStockList();
    } else if (sectionId === 'history') {
        loadAndDisplayIcHistory();
    }
}

// Global variable to store the slider instance for the full count
let countSlider;

// Global variable to store the queue of items to count
let countQueue = [];

// Global variable for the current level input element
let currentLevelInput;

// Debugging function
function debugLog(message, data) {
  }
  
  function startFullCount() {
    debugLog("Starting full count process");
    
    // Make sure icItems is defined and has items
    if (!window.icItems || window.icItems.length === 0) {
      debugLog("No items found in icItems array", window.icItems);
      alert('No items to count. Please add some items first.');
      return;
    }
    
    // Show staff selection modal first
    showStaffSelectionModal()
      .then(confirmed => {
        if (confirmed) {
          // Actually start the full count process
          startFullCountProcess();
        }
      });
  }
  
  function startFullCountProcess() {
    debugLog("Starting full count process with items:", window.icItems.length);
    
    // Group items by location
    const itemsByLocation = {};
    
    // Filter by current location if not "All"
    const itemsToCount = currentLocation !== 'All' ? 
      window.icItems.filter(item => item.location === currentLocation) :
      window.icItems;
    
    debugLog("Items to count after location filter:", itemsToCount.length);
    
    // Group items by location and sublocation
    itemsToCount.forEach(item => {
      const location = item.location || 'Unspecified';
      
      if (!itemsByLocation[location]) {
        itemsByLocation[location] = [];
      }
      
      itemsByLocation[location].push(item);
    });
    
    // Sort items within each location by displayOrder then name
    Object.keys(itemsByLocation).forEach(location => {
      itemsByLocation[location].sort((a, b) => {
        // First by displayOrder if available
        if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
          return a.displayOrder - b.displayOrder;
        }
        
        // Then by sublocation
        if (a.sublocation !== b.sublocation) {
          return a.sublocation?.localeCompare(b.sublocation || '');
        }
        
        // Finally by name
        return a.name.localeCompare(b.name);
      });
    });
    
    // Set up the global count queue
    window.countQueue = [];
    
    // Get the locations in alphabetical order
    const sortedLocations = Object.keys(itemsByLocation).sort();
    
    // Build the count queue
    sortedLocations.forEach(location => {
      // Add all items for this location
      window.countQueue.push(...itemsByLocation[location]);
    });
    
    debugLog("Count queue built with items:", window.countQueue.length);
    
    if (window.countQueue.length === 0) {
      alert('No items to count in the selected location.');
      return;
    }
    
    // Initialize the current level input reference - IMPORTANT STEP
    window.currentLevelInput = document.getElementById('current-level-input');
    debugLog("Current level input found:", !!window.currentLevelInput);
    
    // Initialize counting variables
    window.isCounting = true;
    window.currentItemIndex = 0;
    
    // Make sure UI elements exist
    const checkProgressElement = document.getElementById('check-progress');
    const checkItemNameElement = document.getElementById('check-item-name');
    const checkItemTargetElement = document.getElementById('check-item-target');
    const currentLocationElement = document.getElementById('current-location');
    
    if (!checkProgressElement || !checkItemNameElement || !checkItemTargetElement || !currentLocationElement) {
      debugLog("Missing UI elements for count interface");
      alert('Error: UI elements not found. Please refresh the page and try again.');
      return;
    }
    
    // Show the first item
    showCurrentCountItem(window.countQueue);
    
    // Hide dashboard, show count interface
    const dashboardSection = document.getElementById('dashboard-section');
    const countInterface = document.getElementById('count-interface');
    
    if (dashboardSection) dashboardSection.style.display = 'none';
    if (countInterface) countInterface.style.display = 'block';
    
    // Initialize the slider
    if (!window.countSlider) {
      window.countSlider = createTouchSlider({
        containerId: document.querySelector('#count-interface .slider-container'),
        valueDisplayId: 'current-value',
        handleId: 'handle',
        progressId: 'progress',
        ticksId: 'ticks',
        decreaseId: 'decrease',
        increaseId: 'increase',
        hiddenInputId: 'current-level-input',
        initialValue: window.countQueue[0].currentLevel
      });
    } else {
      window.countSlider.setValue(window.countQueue[0].currentLevel);
    }
    
    // Setup save and next button
    const saveNextBtn = document.getElementById('save-next-btn');
    if (saveNextBtn) {
      saveNextBtn.onclick = saveAndNext;
    }
    
    // Setup cancel button
    const cancelCountBtn = document.getElementById('cancel-count-btn');
    if (cancelCountBtn) {
      cancelCountBtn.onclick = cancelFullCount;
    }
  }

// Show the current item in the count interface
function showCurrentCountItem(countQueue) {
    if (!countQueue || countQueue.length === 0 || window.currentItemIndex === undefined) {
      console.error("Invalid count queue or item index");
      return;
    }
    
    debugLog("Showing item at index " + window.currentItemIndex + " of " + countQueue.length);
    
    const item = countQueue[window.currentItemIndex];
    if (!item) {
      console.error("Item not found at index", window.currentItemIndex);
      return;
    }
    
    debugLog("Current item:", item);
    
    // Get UI elements
    const checkProgressElement = document.getElementById('check-progress');
    const checkItemNameElement = document.getElementById('check-item-name');
    const checkItemTargetElement = document.getElementById('check-item-target');
    const currentLocationElement = document.getElementById('current-location');
    const currentValueElement = document.getElementById('current-value');
    
    // Update location header if this is a new location
    if (window.currentItemIndex === 0 || 
        countQueue[window.currentItemIndex].location !== countQueue[window.currentItemIndex - 1].location) {
      
      currentLocationElement.textContent = item.location || 'Unspecified';
    }
    
    // Update progress indicator
    checkProgressElement.textContent = `Item ${window.currentItemIndex + 1} of ${countQueue.length}`;
    
    // Update item name
    let nameDisplay = item.name || 'Unnamed Item';
    if (item.sublocation) {
      nameDisplay += ` <span style="font-size: 16px; color: var(--text-medium);">(${item.sublocation})</span>`;
    }
    
    // Update the item name element to include the user indicator
    checkItemNameElement.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <span>${nameDisplay}</span>
        <span class="user-indicator">${currentStaff || 'Unknown'}</span>
      </div>
    `;
    
    // Update target display
    checkItemTargetElement.textContent = `Target: ${item.targetLevel || 0} ${item.unit || 'units'}`;
    
    // Update slider value
    if (window.countSlider) {
      window.countSlider.setValue(item.currentLevel || 0);
    } else if (window.currentLevelInput) {
      // Fallback if slider isn't initialized yet
      window.currentLevelInput.value = (item.currentLevel || 0).toString();
      
      // Also update the displayed value
      if (currentValueElement) {
        currentValueElement.textContent = (item.currentLevel || 0).toString();
      }
    }
  }

// Save the current item and move to the next one
function saveAndNext() {
    debugLog("Save and Next clicked");
    
    // Make sure currentLevelInput is defined before trying to access its value
    if (!window.currentLevelInput) {
      console.error("Current level input element not found!");
      window.currentLevelInput = document.getElementById('current-level-input');
      
      if (!window.currentLevelInput) {
        alert("Error: Input element not found. Please try again.");
        return;
      }
    }
    
    // Use the global countQueue
    if (!window.countQueue || window.countQueue.length === 0) {
      console.error("Count queue not properly initialized");
      alert("Error: Count data not initialized properly. Please try again.");
      return;
    }
    
    if (window.currentItemIndex === undefined || window.currentItemIndex < 0) {
      console.error("Current item index not properly initialized");
      alert("Error: Count index not initialized properly. Please try again.");
      return;
    }
    
    // Get the value with a safety check
    const currentValue = window.currentLevelInput.value || '';
    debugLog("Current value from input:", currentValue);
  
    // Check if a value has been set (including zero)
    if (currentValue === '' || isNaN(parseFloat(currentValue))) {
      alert('Please select a current level');
      return;
    }
    
    // Get the current item being checked
    const item = window.countQueue[window.currentItemIndex];
    if (!item) {
      console.error("Current item not found in queue");
      alert("Error: Item not found. Please try again.");
      return;
    }
    
    // Store old value before updating
    const oldValue = item.currentLevel;
    const newValue = parseFloat(window.currentLevelInput.value);
    
    // Find the item in the icItems array and update it
    const itemIndex = window.icItems.findIndex(i => i.id === item.id);
    if (itemIndex !== -1) {
      // Update prep item with new level
      window.icItems[itemIndex].currentLevel = newValue;
      window.icItems[itemIndex].lastCheckedBy = currentStaff;
      window.icItems[itemIndex].lastCheckedTime = new Date().toISOString();
      
      // Save data
      saveData();
      
      // Log the activity
      logActivityChange(window.icItems[itemIndex], oldValue, newValue, 'count');
    }
    
    // Update the low stock list in real-time
    updateLowStockList();
    updateStats();
    
    // Move to next item or complete check
    if (window.currentItemIndex < window.countQueue.length - 1) {
      window.currentItemIndex++;
      showCurrentCountItem(window.countQueue);
    } else {
      completeFullCount();
    }
  }

// Save data to Firebase and localStorage
function saveData(specificItem = null) {
    // Always save to local storage as backup
    localStorage.setItem('icItems', JSON.stringify(icItems));
    
    // Save to Firebase if available
    if (window.firebaseDb && window.firebaseDb.saveAllIcItems) {
        // Use batch update for better consistency
        window.firebaseDb.saveAllIcItems(icItems)
            .then(() => {
            })
            .catch(error => {
                console.error("Error saving to Firebase:", error);
                // Show an error notification
                showErrorMessage("Failed to save data to server. Please check your connection.");
            });
    } else if (window.firebaseDb && window.firebaseDb.saveIcItem) {
        // Fallback to individual updates if batch not available
        
        // If a specific item was provided, save it
        if (specificItem) {
            window.firebaseDb.saveIcItem(specificItem)
                .then(() => {
                })
                .catch(error => {
                    console.error(`Error saving item ${specificItem.id}:`, error);
                    showErrorMessage("Failed to save item to the server.");
                });
        } 
        // Otherwise, save the most recently updated item (last in the array)
        else if (icItems.length > 0) {
            const latestItem = icItems[icItems.length - 1];
            
            window.firebaseDb.saveIcItem(latestItem)
                .then(() => {
                })
                .catch(error => {
                    console.error(`Error saving latest item ${latestItem.id}:`, error);
                    showErrorMessage("Failed to save item to the server.");
                });
        }
    }
}

// Get the value and explicitly check for undefined/null/empty
const currentValue = currentLevelInput && currentLevelInput.value ? currentLevelInput.value : '';

// Complete the full count process
function completeFullCount() {
isCounting = false;
countInterface.style.display = 'none';
dashboardSection.style.display = 'block';

// Update UI
updateInventoryTables();
updateLowStockList();
updateStats();

// Show completion message
showSuccessMessage('Full count completed successfully');
}

// Cancel the full count process
function cancelFullCount() {
if (confirm('Cancel the count? Any saved items will remain updated.')) {
    isCounting = false;
    countInterface.style.display = 'none';
    dashboardSection.style.display = 'block';
    
    // Update UI just in case some items were updated
    updateInventoryTables();
    updateLowStockList();
    updateStats();
}
}

// Show the staff selection modal for full count
function showStaffSelectionModal() {
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
    <h3 style="margin: 0 0 12px 0; color: var(--primary-dark); font-size: 22px;">Who will perform this count?</h3>
    <p style="margin: 0; color: var(--text-medium);">
        Please select the staff member who will be performing this I&C count.
    </p>
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
                    createDefaultStaffForSelection();
                }
            })
            .catch(error => {
                console.error('Error loading staff members:', error);
                // Fallback to hardcoded staff
                createDefaultStaffForSelection();
            });
    } else {
        // Fallback to hardcoded staff
        createDefaultStaffForSelection();
    }
}

// Create default staff buttons as fallback
function createDefaultStaffForSelection() {
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

// Return a promise that resolves when a selection is made
return new Promise((resolve) => {
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

// Function to show edit item details modal
function showEditItemDetailsModal(item) {
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
modalContent.style.borderRadius = '5px';
modalContent.style.width = '90%';
modalContent.style.maxWidth = '500px';
modalContent.style.maxHeight = '90vh';
modalContent.style.overflowY = 'auto';

// Create modal header
const modalHeader = document.createElement('div');
modalHeader.style.marginBottom = '20px';
modalHeader.innerHTML = `
    <h3 style="margin: 0; color: var(--primary-dark); font-size: 22px;">Edit ${item.name}</h3>
    <p style="margin: 8px 0 0 0; color: var(--text-medium);">
        Update details for this I&C item
    </p>
`;

// Create form fields
const formFields = document.createElement('div');
formFields.style.display = 'grid';
formFields.style.gap = '15px';

// Helper function to create a form group
function createFormGroup(id, label, type = 'text', value = '', required = true, placeholder = '') {
    const group = document.createElement('div');
    group.style.display = 'flex';
    group.style.flexDirection = 'column';
    group.style.gap = '5px';
    
    const labelEl = document.createElement('label');
    labelEl.htmlFor = id;
    labelEl.textContent = label;
    labelEl.style.fontWeight = '500';
    
    const input = document.createElement('input');
    input.type = type;
    input.id = id;
    input.value = value;
    input.required = required;
    input.placeholder = placeholder;
    input.style.padding = '10px';
    input.style.borderRadius = '4px';
    input.style.border = '1px solid var(--border-light)';
    
    group.appendChild(labelEl);
    group.appendChild(input);
    
    return group;
}

// Helper function to create a select group
function createSelectGroup(id, label, options, value = '', required = true) {
    const group = document.createElement('div');
    group.style.display = 'flex';
    group.style.flexDirection = 'column';
    group.style.gap = '5px';
    
    const labelEl = document.createElement('label');
    labelEl.htmlFor = id;
    labelEl.textContent = label;
    labelEl.style.fontWeight = '500';
    
    const select = document.createElement('select');
    select.id = id;
    select.required = required;
    select.style.padding = '10px';
    select.style.borderRadius = '4px';
    select.style.border = '1px solid var(--border-light)';
    
    // Add options
    options.forEach(option => {
        const optionEl = document.createElement('option');
        optionEl.value = option;
        optionEl.textContent = option;
        
        if (option === value) {
            optionEl.selected = true;
        }
        
        select.appendChild(optionEl);
    });
    
    group.appendChild(labelEl);
    group.appendChild(select);
    
    return group;
}

// ID field (hidden)
const idField = document.createElement('input');
idField.type = 'hidden';
idField.id = 'edit-item-id';
idField.value = item.id;
formFields.appendChild(idField);

// Name field
formFields.appendChild(createFormGroup('edit-item-name', 'Item Name *', 'text', item.name, true, 'Enter item name'));

// Current level field
formFields.appendChild(createFormGroup('edit-item-current', 'Current Level *', 'number', item.currentLevel, true, '0'));

// Target level field
formFields.appendChild(createFormGroup('edit-item-target', 'Target Level *', 'number', item.targetLevel, true, '1'));

// Unit field
formFields.appendChild(createFormGroup('edit-item-unit', 'Unit *', 'text', item.unit, true, 'units, bottles, kg, etc.'));

// Display order field
formFields.appendChild(createFormGroup('edit-item-display-order', 'Display Order', 'number', item.displayOrder || item.id, false, 'Order for display'));

// Location field - with both dropdown of existing and option to create new
const locationGroup = document.createElement('div');
locationGroup.style.display = 'flex';
locationGroup.style.flexDirection = 'column';
locationGroup.style.gap = '5px';

const locationLabel = document.createElement('label');
locationLabel.htmlFor = 'edit-item-location';
locationLabel.textContent = 'Location *';
locationLabel.style.fontWeight = '500';

const locationSelect = document.createElement('select');
locationSelect.id = 'edit-item-location';
locationSelect.required = true;
locationSelect.style.padding = '10px';
locationSelect.style.borderRadius = '4px';
locationSelect.style.border = '1px solid var(--border-light)';

// First option is to create a new location
const newLocationOption = document.createElement('option');
newLocationOption.value = 'new';
newLocationOption.textContent = '+ Add New Location';
locationSelect.appendChild(newLocationOption);

// Add existing locations
[...allLocations].filter(loc => loc !== 'All').sort().forEach(location => {
    const option = document.createElement('option');
    option.value = location;
    option.textContent = location;
    
    // Preselect current location
    if (location === item.location) {
        option.selected = true;
    }
    
    locationSelect.appendChild(option);
});

// New location input (hidden initially)
const newLocationInput = document.createElement('input');
newLocationInput.type = 'text';
newLocationInput.id = 'edit-location-input';
newLocationInput.placeholder = 'Enter new location name';
newLocationInput.style.padding = '10px';
newLocationInput.style.borderRadius = '4px';
newLocationInput.style.border = '1px solid var(--border-light)';
newLocationInput.style.marginTop = '8px';
newLocationInput.style.display = 'none';

// Show/hide new location input based on selection
locationSelect.addEventListener('change', () => {
    if (locationSelect.value === 'new') {
        newLocationInput.style.display = 'block';
        newLocationInput.required = true;
        
        // Also update sublocation options
        updateSublocationSelect(null);
    } else {
        newLocationInput.style.display = 'none';
        newLocationInput.required = false;
        
        // Update sublocation options for the selected location
        updateSublocationSelect(locationSelect.value);
    }
});

locationGroup.appendChild(locationLabel);
locationGroup.appendChild(locationSelect);
locationGroup.appendChild(newLocationInput);

formFields.appendChild(locationGroup);

// Sublocation field - with both dropdown of existing and option to create new
const sublocationGroup = document.createElement('div');
sublocationGroup.style.display = 'flex';
sublocationGroup.style.flexDirection = 'column';
sublocationGroup.style.gap = '5px';

const sublocationLabel = document.createElement('label');
sublocationLabel.htmlFor = 'edit-item-sublocation';
sublocationLabel.textContent = 'Sublocation';
sublocationLabel.style.fontWeight = '500';

const sublocationSelect = document.createElement('select');
sublocationSelect.id = 'edit-item-sublocation';
sublocationSelect.style.padding = '10px';
sublocationSelect.style.borderRadius = '4px';
sublocationSelect.style.border = '1px solid var(--border-light)';

// Function to update sublocation options based on selected location
function updateSublocationSelect(location) {
    sublocationSelect.innerHTML = '';
    
    // First option is for no sublocation
    const noSublocationOption = document.createElement('option');
    noSublocationOption.value = '';
    noSublocationOption.textContent = 'General (No Sublocation)';
    sublocationSelect.appendChild(noSublocationOption);
    
    // Next option is to create a new sublocation
    const newSublocationOption = document.createElement('option');
    newSublocationOption.value = 'new';
    newSublocationOption.textContent = '+ Add New Sublocation';
    sublocationSelect.appendChild(newSublocationOption);
    
    // Add existing sublocations for selected location
    if (location && allSublocations.has(location)) {
        [...allSublocations.get(location)].sort().forEach(sublocation => {
            const option = document.createElement('option');
            option.value = sublocation;
            option.textContent = sublocation;
            
            // Preselect current sublocation
            if (sublocation === item.sublocation) {
                option.selected = true;
            }
            
            sublocationSelect.appendChild(option);
        });
    }
    
    // Update the display of new sublocation input
    if (sublocationSelect.value === 'new') {
        newSublocationInput.style.display = 'block';
    } else {
        newSublocationInput.style.display = 'none';
    }
}

// New sublocation input (hidden initially)
const newSublocationInput = document.createElement('input');
newSublocationInput.type = 'text';
newSublocationInput.id = 'edit-sublocation-input';
newSublocationInput.placeholder = 'Enter new sublocation name';
newSublocationInput.style.padding = '10px';
newSublocationInput.style.borderRadius = '4px';
newSublocationInput.style.border = '1px solid var(--border-light)';
newSublocationInput.style.marginTop = '8px';
newSublocationInput.style.display = 'none';

// Show/hide new sublocation input based on selection
sublocationSelect.addEventListener('change', () => {
    if (sublocationSelect.value === 'new') {
        newSublocationInput.style.display = 'block';
        newSublocationInput.required = true;
    } else {
        newSublocationInput.style.display = 'none';
        newSublocationInput.required = false;
    }
});

sublocationGroup.appendChild(sublocationLabel);
sublocationGroup.appendChild(sublocationSelect);
sublocationGroup.appendChild(newSublocationInput);

formFields.appendChild(sublocationGroup);

// Initialize sublocation options
updateSublocationSelect(item.location);

// Providers section
const providersGroup = document.createElement('div');
providersGroup.style.display = 'flex';
providersGroup.style.flexDirection = 'column';
providersGroup.style.gap = '5px';
providersGroup.style.marginTop = '10px';

const providersLabel = document.createElement('label');
providersLabel.textContent = 'Providers';
providersLabel.style.fontWeight = '500';

const providersChips = document.createElement('div');
providersChips.className = 'provider-chips';
providersChips.id = 'edit-providers-chips';

const addProviderInput = document.createElement('div');
addProviderInput.className = 'add-provider-input';

const providerInput = document.createElement('input');
providerInput.type = 'text';
providerInput.id = 'edit-provider-input';
providerInput.placeholder = 'Add a provider';

const addProviderButton = document.createElement('button');
addProviderButton.textContent = 'Add';
addProviderButton.type = 'button';

// Current providers array
const providers = [...(item.providers || [])];

// Function to add a provider
function addProvider() {
    const providerName = providerInput.value.trim();
    if (providerName && !providers.includes(providerName)) {
        providers.push(providerName);
        updateProviderChips();
        providerInput.value = '';
    }
}

// Function to update provider chips display
function updateProviderChips() {
    providersChips.innerHTML = '';
    
    providers.forEach(provider => {
        const chip = document.createElement('div');
        chip.className = 'provider-chip';
        
        const chipText = document.createElement('span');
        chipText.textContent = provider;
        
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-provider';
        removeButton.textContent = '×';
        removeButton.addEventListener('click', () => {
            const index = providers.indexOf(provider);
            if (index !== -1) {
                providers.splice(index, 1);
                updateProviderChips();
            }
        });
        
        chip.appendChild(chipText);
        chip.appendChild(removeButton);
        providersChips.appendChild(chip);
    });
}

// Add event listeners
addProviderButton.addEventListener('click', addProvider);
providerInput.addEventListener('keypress', event => {
    if (event.key === 'Enter') {
        event.preventDefault();
        addProvider();
    }
});

addProviderInput.appendChild(providerInput);
addProviderInput.appendChild(addProviderButton);

providersGroup.appendChild(providersLabel);
providersGroup.appendChild(providersChips);
providersGroup.appendChild(addProviderInput);

formFields.appendChild(providersGroup);

// Initialize provider chips
updateProviderChips();

// Create buttons
const buttonGroup = document.createElement('div');
buttonGroup.style.display = 'flex';
buttonGroup.style.justifyContent = 'space-between';
buttonGroup.style.marginTop = '20px';
buttonGroup.style.gap = '10px';

const saveButton = document.createElement('button');
saveButton.textContent = 'Save Changes';
saveButton.className = 'action-button';
saveButton.style.flex = '1';

const deleteButton = document.createElement('button');
deleteButton.textContent = 'Delete Item';
deleteButton.style.padding = '10px 20px';
deleteButton.style.backgroundColor = '#ef4444';
deleteButton.style.color = 'white';
deleteButton.style.border = 'none';
deleteButton.style.borderRadius = '4px';
deleteButton.style.cursor = 'pointer';
deleteButton.style.fontWeight = 'bold';
deleteButton.style.flex = '1';

const cancelButton = document.createElement('button');
cancelButton.textContent = 'Cancel';
    cancelButton.className = 'secondary-button';
    cancelButton.style.flex = '1';
    
    buttonGroup.appendChild(cancelButton);
    buttonGroup.appendChild(deleteButton);
    buttonGroup.appendChild(saveButton);
    
    // Add all elements to modal
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(formFields);
    modalContent.appendChild(buttonGroup);
    modalBackdrop.appendChild(modalContent);
    
    // Add to document
    document.body.appendChild(modalBackdrop);
    
    // Function to close modal
    function closeModal() {
        document.body.removeChild(modalBackdrop);
    }
    
    // Function to save data to Firebase and localStorage
    function saveData() {
        // Always save to local storage as backup
        localStorage.setItem('icItems', JSON.stringify(icItems));
        
        // Save to Firebase if available
        if (window.firebaseDb && window.firebaseDb.saveAllIcItems) {
            // Use batch update for better consistency
            window.firebaseDb.saveAllIcItems(icItems)
                .then(() => {
                })
                .catch(error => {
                    console.error("Error saving to Firebase:", error);
                    // Show an error notification
                    showErrorMessage("Failed to save data to server. Please check your connection.");
                });
        }
    }
    
    // Save button event handler
    saveButton.addEventListener('click', () => {
        // Validate form fields
        const name = document.getElementById('edit-item-name').value.trim();
        const currentLevel = parseFloat(document.getElementById('edit-item-current').value);
        const targetLevel = parseFloat(document.getElementById('edit-item-target').value);
        const unit = document.getElementById('edit-item-unit').value.trim();
        const displayOrder = parseInt(document.getElementById('edit-item-display-order').value) || item.id;
        
        // Get location
        let location;
        if (locationSelect.value === 'new') {
            location = newLocationInput.value.trim();
        } else {
            location = locationSelect.value;
        }
        
        // Get sublocation
        let sublocation = '';
        if (sublocationSelect.value === 'new') {
            sublocation = newSublocationInput.value.trim();
        } else if (sublocationSelect.value !== '') {
            sublocation = sublocationSelect.value;
        }
        
        // Validation
        if (!name) {
            alert('Please enter an item name');
            return;
        }
        
        if (isNaN(currentLevel) || currentLevel < 0) {
            alert('Current level must be a valid number (0 or greater)');
            return;
        }
        
        if (isNaN(targetLevel) || targetLevel <= 0) {
            alert('Target level must be a valid number (greater than 0)');
            return;
        }
        
        if (!unit) {
            alert('Please enter a unit');
            return;
        }
        
        if (!location) {
            alert('Please select or enter a location');
            return;
        }
        
        // Find the item in the icItems array
        const itemIndex = icItems.findIndex(i => i.id === item.id);
        if (itemIndex !== -1) {
            // Store old values before updating
            const oldItem = {...icItems[itemIndex]};
            
            // Update the item
            icItems[itemIndex].name = name;
            icItems[itemIndex].currentLevel = currentLevel;
            icItems[itemIndex].targetLevel = targetLevel;
            icItems[itemIndex].unit = unit;
            icItems[itemIndex].location = location;
            icItems[itemIndex].sublocation = sublocation;
            icItems[itemIndex].providers = providers;
            icItems[itemIndex].displayOrder = displayOrder;
            icItems[itemIndex].lastCheckedBy = currentStaff;
            icItems[itemIndex].lastCheckedTime = new Date().toISOString();
            
            // Save to Firebase and local storage
            saveData();
            
            // Log the activity if quantity changed
            if (oldItem.currentLevel !== currentLevel) {
                logActivityChange(icItems[itemIndex], oldItem.currentLevel, currentLevel, 'edit');
            }
            
            // Extract locations and update UI
            extractLocationsAndSublocations();
            updateLocationFilters();
            updateInventoryTables();
            updateLowStockList();
            updateStats();
            
            // Show success message
            showSuccessMessage(`Item "${name}" updated successfully`);
        }
        
        // Close modal
        closeModal();
    });
    
    // Delete button event handler
    deleteButton.addEventListener('click', () => {
        if (confirm(`Are you sure you want to delete "${item.name}"? This cannot be undone.`)) {
            // Find the item in the icItems array
            const itemIndex = icItems.findIndex(i => i.id === item.id);
            if (itemIndex !== -1) {
                // Store item for logging
                const deletedItem = {...icItems[itemIndex]};
                
                // Remove the item
                icItems.splice(itemIndex, 1);
                
                // Save to Firebase and local storage
                saveData();
                
                // If Firebase has a specific delete function, use it
                if (window.firebaseDb && window.firebaseDb.deleteIcItem) {
                    window.firebaseDb.deleteIcItem(item.id)
                        .then(() => {
                        })
                        .catch(error => {
                            console.error(`Error deleting I&C item ${item.id}:`, error);
                        });
                }
                
                // Log the deletion
                logActivityChange(deletedItem, deletedItem.currentLevel, null, 'delete');
                
                // Extract locations and update UI
                extractLocationsAndSublocations();
                updateLocationFilters();
                updateInventoryTables();
                updateLowStockList();
                updateStats();
                
                // Show success message
                showSuccessMessage(`Item "${item.name}" deleted successfully`);
            }
            
            // Close modal
            closeModal();
        }
    });
    
    // Cancel button event handler
    cancelButton.addEventListener('click', closeModal);
    
    // Close on backdrop click
    modalBackdrop.addEventListener('click', (event) => {
        if (event.target === modalBackdrop) {
            closeModal();
        }
    });
}

// Load and display I&C history
function loadAndDisplayIcHistory() {
    
    // Get container elements
    const historyContent = document.getElementById('history-content');
    const analyticsContainer = document.getElementById('history-analytics');
    
    if (!historyContent) {
        console.error("History content container not found");
        return;
    }
    
    // Show loading state
    historyContent.innerHTML = '<div class="empty-state"><p>Loading I&C activity logs...</p></div>';
    
    // Check if Firebase has history functions
    if (window.firebaseDb && typeof window.firebaseDb.loadIcActivityLogs === 'function') {
        window.firebaseDb.loadIcActivityLogs()
            .then(logs => {
                
                if (!logs || logs.length === 0) {
                    historyContent.innerHTML = `
                        <div class="empty-state">
                            <p>No I&C activity logs found. Try making some changes to items.</p>
                        </div>
                    `;
                    if (analyticsContainer) {
                        analyticsContainer.innerHTML = '<p>No activity data available for analytics.</p>';
                    }
                    return;
                }
                
                // Calculate date 15 days ago
                const fifteenDaysAgo = new Date();
                fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
                
                // Filter logs to only include last 15 days
                const recentLogs = logs.filter(log => {
                    const logDate = new Date(log.timestamp);
                    return logDate >= fifteenDaysAgo;
                });
                
                // If no recent logs, show empty state
                if (recentLogs.length === 0) {
                    historyContent.innerHTML = `
                        <div class="empty-state">
                            <p>No I&C activity logs found in the last 15 days. Try making some changes to items.</p>
                        </div>
                    `;
                    if (analyticsContainer) {
                        analyticsContainer.innerHTML = '<p>No recent activity data available for analytics.</p>';
                    }
                    return;
                }
                
                // Display logs
                const sortedLogs = [...recentLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                
                // Create HTML
                let html = '';
                let currentDate = '';
                
                sortedLogs.forEach(log => {
                    // Format date
                    const date = new Date(log.timestamp);
                    const dateString = date.toDateString();
                    
                    // Add date header if new date
                    if (dateString !== currentDate) {
                        currentDate = dateString;
                        const formattedDate = date.toLocaleDateString(undefined, { 
                            weekday: 'long',
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric'
                        });
                        
                        html += `<div class="date-header">${formattedDate}</div>`;
                    }
                    
                    // Format time
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    const timeString = `${hours}:${minutes}`;
                    
                    // Format action
                    let actionText = '';
                    let changeText = '';
                    
                    switch(log.actionType) {
                        case 'count':
                            actionText = 'counted';
                            changeText = `${log.oldValue} → ${log.newValue} ${log.unit}`;
                            break;
                        case 'add':
                            actionText = 'added';
                            changeText = `Initial: ${log.newValue} ${log.unit}`;
                            break;
                        case 'edit':
                            actionText = 'edited';
                            changeText = `${log.oldValue} → ${log.newValue} ${log.unit}`;
                            break;
                        case 'delete':
                            actionText = 'deleted';
                            changeText = `Was: ${log.oldValue} ${log.unit}`;
                            break;
                        default:
                            actionText = 'updated';
                            changeText = `${log.oldValue} → ${log.newValue} ${log.unit}`;
                    }
                    
                    // Add location info if available
                    let locationInfo = '';
                    if (log.location) {
                        locationInfo = `<span style="margin-left: 8px; color: var(--text-light);">[${log.location}${log.sublocation ? ` › ${log.sublocation}` : ''}]</span>`;
                    }
                    
                    // Add log item
                    html += `
                        <div class="log-item action-${log.actionType}">
                            <div class="log-time">${timeString}</div>
                            <div class="log-user">${log.user}</div>
                            <div class="log-action">
                                <span class="action-label">${actionText}</span>
                                <span class="item-name">${log.itemName}</span>
                                ${locationInfo}
                            </div>
                            <div class="log-change">${changeText}</div>
                        </div>
                    `;
                });
                
                // Set HTML
                historyContent.innerHTML = html;
                
                // Update analytics
                if (analyticsContainer) {
                    // Simple analytics (using filtered recent logs)
                    const totalLogs = recentLogs.length;
                    const countCount = recentLogs.filter(log => log.actionType === 'count').length;
                    const editCount = recentLogs.filter(log => log.actionType === 'edit').length;
                    
                    // Count by location
                    const locationCounts = {};
                    recentLogs.forEach(log => {
                        if (log.location) {
                            locationCounts[log.location] = (locationCounts[log.location] || 0) + 1;
                        }
                    });
                    
                    // Top locations
                    const topLocations = Object.entries(locationCounts)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5);
                    
                    // Item counts
                    const itemCounts = {};
                    recentLogs.forEach(log => {
                        if (log.itemName) {
                            itemCounts[log.itemName] = (itemCounts[log.itemName] || 0) + 1;
                        }
                    });
                    
                    // Top items
                    const topItems = Object.entries(itemCounts)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5);
                    
                    // Create HTML
                    analyticsContainer.innerHTML = `
                        <div class="analytics-summary">
                            <div class="analytics-card">
                                <div class="analytics-value">${totalLogs}</div>
                                <div class="analytics-label">Total Activities (15 days)</div>
                            </div>
                            <div class="analytics-card">
                                <div class="analytics-value">${countCount}</div>
                                <div class="analytics-label">Count Updates</div>
                            </div>
                            <div class="analytics-card">
                                <div class="analytics-value">${editCount}</div>
                                <div class="analytics-label">Edit Updates</div>
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
                            <div class="analytics-top-items">
                                <h3>Most Updated Items</h3>
                                <ul class="top-items-list">
                                    ${topItems.map(([item, count]) => `
                                        <li>
                                            <span class="item-name">${item}</span>
                                            <span class="item-count">${count} updates</span>
                                        </li>
                                    `).join('')}
                                </ul>
                            </div>
                            
                            <div class="analytics-top-items">
                                <h3>Most Active Locations</h3>
                                <ul class="top-items-list">
                                    ${topLocations.map(([location, count]) => `
                                        <li>
                                            <span class="item-name">${location}</span>
                                            <span class="item-count">${count} updates</span>
                                        </li>
                                    `).join('')}
                                </ul>
                            </div>
                        </div>
                    `;
                }
            })
            .catch(error => {
                console.error("Error loading I&C logs:", error);
                historyContent.innerHTML = `
                    <div class="empty-state">
                        <p>Error loading I&C activity logs: ${error.message}</p>
                    </div>
                `;
            });
    } else {
        historyContent.innerHTML = `
            <div class="empty-state">
                <p>I&C activity history tracking is not available.</p>
            </div>
        `;
        
        if (analyticsContainer) {
            analyticsContainer.innerHTML = '<p>I&C activity analytics are not available.</p>';
        }
    }

    // Add this initialization code to run when the page loads
document.addEventListener('DOMContentLoaded', function() {
    debugLog("DOM fully loaded - initializing inventory manager");
    
    // Initialize global variables if not already defined
    window.icItems = window.icItems || [];
    window.countQueue = [];
    window.currentItemIndex = 0;
    
    // Set up the start count button handler
    const startCountBtn = document.getElementById('start-count-btn');
    if (startCountBtn) {
      debugLog("Found start count button, attaching handler");
      startCountBtn.onclick = startFullCount;
    }
    
    // Set up save next button handler
    const saveNextBtn = document.getElementById('save-next-btn');
    if (saveNextBtn) {
      debugLog("Found save next button, attaching handler");
      saveNextBtn.onclick = saveAndNext;
    }
    
    // Set up cancel button handler
    const cancelCountBtn = document.getElementById('cancel-count-btn');
    if (cancelCountBtn) {
      debugLog("Found cancel button, attaching handler");
      cancelCountBtn.onclick = cancelFullCount;
    }
    
    // Initialize currentLevelInput reference
    window.currentLevelInput = document.getElementById('current-level-input');
    debugLog("Current level input initialized:", !!window.currentLevelInput);
    
    // Load items from Firebase when it's available
    if (window.firebaseDb && typeof window.firebaseDb.loadIcItems === 'function') {
      debugLog("Loading items from Firebase");
      window.firebaseDb.loadIcItems()
        .then(items => {
          window.icItems = items;
          debugLog("Loaded items from Firebase:", items.length);
          
          // After items are loaded, extract locations and update UI
          extractLocationsAndSublocations();
          updateLocationFilters();
          updateInventoryTables();
          updateLowStockList();
          updateStats();
        })
        .catch(error => {
          console.error("Error loading items from Firebase:", error);
        });
    }
  });

}