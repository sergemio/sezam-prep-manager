document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded - initializing I&C Manager");
    
    // Core UI elements
    const staffSelection = document.getElementById('staff-selection');
    const mainInterface = document.getElementById('main-interface');
    const staffGrid = document.querySelector('.staff-grid');
    const currentUserElement = document.getElementById('current-user');
    const headerUserName = document.getElementById('header-user-name');
    const switchUserBtn = document.getElementById('switch-user');
    const userLoginBtn = document.getElementById('user-login-btn');
    const navButtons = document.querySelectorAll('.nav-button');
    const contentSections = document.querySelectorAll('.content-section');
    
    // Count interface elements
    const startCountBtn = document.getElementById('start-count-btn');
    const dashboardSection = document.getElementById('dashboard-section');
    const countInterface = document.getElementById('count-interface');
    const saveNextBtn = document.getElementById('save-next-btn');
    const cancelCountBtn = document.getElementById('cancel-count-btn');
    const currentLocationElement = document.getElementById('current-location');
    const checkProgressElement = document.getElementById('check-progress');
    const checkItemNameElement = document.getElementById('check-item-name');
    const checkItemTargetElement = document.getElementById('check-item-target');
    const currentLevelInput = document.getElementById('current-level-input');
    const currentValueDisplay = document.getElementById('current-value');
    
    // Dashboard elements
    const totalItemsElement = document.getElementById('total-items');
    const itemsBelowFiftyElement = document.getElementById('items-below-fifty');
    const dashboardLocationFilter = document.getElementById('dashboard-location-filter');
    const inventoryLocationFilter = document.getElementById('inventory-location-filter');
    const inventoryContent = document.getElementById('inventory-content');
    const lowStockContainer = document.getElementById('low-stock-container');
    
    // Application state
    let currentStaff = '';
    let currentLocation = 'All';
    let allLocations = new Set(['All']);
    let allSublocations = new Map();
    
    // Full count state
    let countQueue = [];
    let currentItemIndex = 0;
    let countSlider;
    
    // Sorting state
    let currentSortColumn = null;
    let currentSortDirection = null; // 'asc', 'desc', or null for original order
    let originalItemOrder = []; // Store original order for reset
    
    // Load staff members from Firebase, fallback to defaults if needed
    function loadStaffMembers() {
        console.log("Loading staff members");
        
        if (staffGrid) {
            staffGrid.innerHTML = '<div style="text-align: center; padding: 15px;">Loading staff...</div>';
            
            // Try to load from Firebase
            if (window.firebaseDb && window.firebaseDb.loadStaffMembers) {
                window.firebaseDb.loadStaffMembers()
                    .then(staffMembers => {
                        if (staffMembers && staffMembers.length > 0) {
                            // Filter to only active staff members
                            const activeStaff = staffMembers.filter(staff => staff.active);
                            
                            if (activeStaff.length > 0) {
                                staffGrid.innerHTML = '';
                                
                                // Create button for each staff member
                                activeStaff.forEach(staff => {
                                    createStaffButton(staff.name);
                                });
                            } else {
                                createDefaultStaffButtons();
                            }
                        } else {
                            createDefaultStaffButtons();
                        }
                    })
                    .catch(error => {
                        console.error("Error loading staff:", error);
                        createDefaultStaffButtons();
                    });
            } else {
                createDefaultStaffButtons();
            }
        }
    }
    
    // Create staff button
    function createStaffButton(name) {
        const button = document.createElement('button');
        button.className = 'staff-button';
        button.setAttribute('data-staff', name);
        button.textContent = name;
        
        button.addEventListener('click', function() {
            selectStaff(name);
        });
        
        staffGrid.appendChild(button);
    }
    
    // Create default staff buttons if Firebase fails
    function createDefaultStaffButtons() {
        console.log("Creating default staff buttons");
        staffGrid.innerHTML = '';
        
        const defaultStaff = ["Serge Men", "Tatiana", "Nadine", "Nicolas", "Omar"];
        defaultStaff.forEach(name => {
            createStaffButton(name);
        });
    }
    
    // Select staff and show main interface
    function selectStaff(name) {
        currentStaff = name;
        
        // Update UI
        if (currentUserElement) currentUserElement.textContent = name;
        if (headerUserName) headerUserName.textContent = name;
        
        // Show main interface
        if (staffSelection) staffSelection.style.display = 'none';
        if (mainInterface) mainInterface.style.display = 'flex';
        
        // Load items
        loadItems();
    }
    
    // Load inventory items from Firebase
    function loadItems() {
        console.log("Loading inventory items");
        
        if (window.firebaseDb && window.firebaseDb.loadIcItems) {
            window.firebaseDb.loadIcItems()
                .then(items => {
                    console.log("Items loaded:", items.length);
                    window.icItems = items;
                    
                    // Extract locations and sublocations
                    extractLocationsAndSublocations();
                    
                    // Update UI
                    updateLocationFilters();
                    updateInventoryTables();
                    updateLowStockList();
                    updateStats();
                    
                    // Set up real-time updates
                    setupRealtimeUpdates();
                    
                    // Check for old history records to purge (only once per session)
                    setTimeout(() => {
                        checkAndPurgeOldHistory();
                    }, 1000); // Small delay to ensure Firebase is fully initialized
                })
                .catch(error => {
                    console.error("Error loading items:", error);
                });
        }
    }
    
    // Extract all unique locations and sublocations from items
    function extractLocationsAndSublocations() {
        allLocations = new Set(['All']);
        allSublocations = new Map();
        
        window.icItems.forEach(item => {
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
        
        console.log('Locations:', [...allLocations]);
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
                    changeLocation(location);
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
                    changeLocation(location);
                });
                
                inventoryLocationFilter.appendChild(button);
            });
        }
        
        // Overview location filter
        const overviewLocationFilter = document.getElementById('overview-location-filter');
        if (overviewLocationFilter) {
            overviewLocationFilter.innerHTML = '';
            
            [...allLocations].sort().forEach(location => {
                const button = document.createElement('button');
                button.className = 'location-button';
                if (location === currentLocation) {
                    button.classList.add('active');
                }
                button.textContent = location;
                button.setAttribute('data-location', location);
                
                button.addEventListener('click', () => {
                    changeLocation(location);
                });
                
                overviewLocationFilter.appendChild(button);
            });
        }
    }
    
    // Change current location
    function changeLocation(location) {
        currentLocation = location;
        
        // Update active state of buttons
        document.querySelectorAll('.location-button').forEach(btn => {
            if (btn.getAttribute('data-location') === location) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Update UI
        updateInventoryTables();
        updateLowStockList();
        
        // Update Overview table if Overview section is active
        const overviewSection = document.getElementById('overview-section');
        if (overviewSection && overviewSection.style.display !== 'none') {
            updateOverviewTable();
        }
        
        // Store original order for new location if not already stored
        if (originalItemOrder.length === 0 && window.icItems && window.icItems.length > 0) {
            originalItemOrder = [...window.icItems];
        }
    }
    
    // Update inventory tables based on current location
    function updateInventoryTables() {
        if (!inventoryContent) return;
        
        inventoryContent.innerHTML = '';
        
        // Filter items by selected location
        const filteredItems = currentLocation === 'All' 
            ? window.icItems 
            : window.icItems.filter(item => item.location === currentLocation);
        
        // Group items by sublocation within the location
        const itemsBySubLocation = {};
        
        filteredItems.forEach(item => {
            const sublocation = item.sublocation || 'General';
            if (!itemsBySubLocation[sublocation]) {
                itemsBySubLocation[sublocation] = [];
            }
            itemsBySubLocation[sublocation].push(item);
        });
        
        // Show message if no items for this location
        if (Object.keys(itemsBySubLocation).length === 0) {
            inventoryContent.innerHTML = `
                <div style="text-align: center; padding: 30px; color: var(--text-medium);">
                    <p>No items found for this location.</p>
                    <button class="action-button" id="add-item-to-location">Add Item to ${currentLocation}</button>
                </div>
            `;
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
            table.className = 'inventory-table db-table';

            // Create table header
            const thead = document.createElement('thead');
            thead.innerHTML = `
                <tr>
                    <th>Item</th>
                    <th>Current</th>
                    <th>Target</th>
                    <th>Last Checked</th>
                    <th>By</th>
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
                const lastChecked = formatDate(item.lastCheckedTime || 'Never');
                
                // Calculate percentage
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
                
                const sc = percentage < 25 ? 'stock-critical' : percentage < 50 ? 'stock-low' : percentage < 100 ? 'stock-ok' : 'stock-full';

                row.innerHTML = `
                    <td class="item-name-cell">${item.name}</td>
                    <td class="${sc}">${item.currentLevel} ${item.unit}</td>
                    <td>${item.targetLevel} ${item.unit}</td>
                    <td>${lastChecked}</td>
                    <td>${item.lastCheckedBy || '<span class="text-muted">—</span>'}</td>
                `;

                row.style.cursor = 'pointer';
                tbody.appendChild(row);

                row.addEventListener('click', () => {
                    showQuickUpdateModal(item);
                });
            });
            
            // Assemble the table
            table.appendChild(thead);
            table.appendChild(tbody);
            
            // Add sublocation header and table to the inventory content
            inventoryContent.appendChild(subLocationHeader);
            inventoryContent.appendChild(table);
            
            // Add spacing between tables
            const spacer = document.createElement('div');
            spacer.style.height = '20px';
            inventoryContent.appendChild(spacer);
        });
    }
    
    // Format date nicely
    function formatDate(dateString) {
        if (!dateString || dateString === 'Never') return 'Never';
        
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString;
            
            // Format as "Jan 15, 14:30"
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = months[date.getMonth()];
            const day = date.getDate();
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${month} ${day}, ${hours}:${minutes}`;
        } catch (e) {
            console.error("Error formatting date:", e);
            return dateString;
        }
    }
    
    // Update overview table
    function updateOverviewTable() {
        const overviewTableBody = document.getElementById('overview-table-body');
        if (!overviewTableBody) return;
        
        // Clear existing content
        overviewTableBody.innerHTML = '';
        
        // Filter items by current location
        let filteredItems = window.icItems.filter(item => 
            currentLocation === 'All' || item.location === currentLocation
        );
        
        // Apply search filter if search term exists
        const searchTerm = document.getElementById('overview-search')?.value?.toLowerCase().trim();
        if (searchTerm) {
            filteredItems = filteredItems.filter(item => {
                const itemName = (item.name || '').toLowerCase();
                const sublocation = (item.sublocation || '').toLowerCase();
                const location = (item.location || '').toLowerCase();
                
                return itemName.includes(searchTerm) || 
                       sublocation.includes(searchTerm) || 
                       location.includes(searchTerm);
            });
        }
        
        // Apply sorting if active
        if (currentSortColumn && currentSortDirection) {
            filteredItems = sortItems(filteredItems, currentSortColumn, currentSortDirection);
        } else if (originalItemOrder.length > 0) {
            // Restore original order
            filteredItems = restoreOriginalOrder(filteredItems);
        }
        
        if (filteredItems.length === 0) {
            overviewTableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-light);">
                        ${searchTerm ? `No items found matching "${searchTerm}"` : 'No items found for the selected location.'}
                    </td>
                </tr>
            `;
            return;
        }
        
        // Create table rows for each item
        filteredItems.forEach(item => {
            const row = document.createElement('tr');
            
            // Calculate percentage for level bar
            const percentage = Math.min((item.currentLevel / item.targetLevel) * 100, 100);
            
            // Debug logging
            console.log(`Item: ${item.name}, Current: ${item.currentLevel} (${typeof item.currentLevel}), Target: ${item.targetLevel} (${typeof item.targetLevel}), Percentage: ${percentage}%`);
            
            // Check for data issues
            if (isNaN(item.currentLevel) || isNaN(item.targetLevel)) {
                console.warn(`Data issue with ${item.name}: currentLevel=${item.currentLevel}, targetLevel=${item.targetLevel}`);
            }
            
            // Apply the 0-5% display rule: show minimum 5% for visual visibility
            let displayPercentage = percentage;
            if (percentage >= 0 && percentage <= 5) {
                displayPercentage = 5; // Show 5% minimum for 0-5% items
            }
            
            // Determine level bar color based on 10% increments for maximum visibility
            let levelBarColor;
            if (percentage === 0) {
                levelBarColor = 'var(--progress-0)'; // Dark Red (0%)
            } else if (percentage <= 10) {
                levelBarColor = 'var(--progress-10)'; // Red (1-10%)
            } else if (percentage <= 20) {
                levelBarColor = 'var(--progress-30)'; // Deep Orange (11-20%)
            } else if (percentage <= 30) {
                levelBarColor = 'var(--progress-30)'; // Orange (21-30%)
            } else if (percentage <= 40) {
                levelBarColor = 'var(--progress-40)'; // Amber (31-40%)
            } else if (percentage <= 50) {
                levelBarColor = 'var(--progress-50)'; // Yellow (41-50%)
            } else if (percentage <= 60) {
                levelBarColor = 'var(--progress-60)'; // Lime (51-60%)
            } else if (percentage <= 70) {
                levelBarColor = 'var(--progress-70)'; // Light Green (61-70%)
            } else if (percentage <= 80) {
                levelBarColor = 'var(--progress-80)'; // Green (71-80%)
            } else if (percentage <= 90) {
                levelBarColor = 'var(--progress-90)'; // Dark Green (81-90%)
            } else {
                levelBarColor = 'var(--progress-100)'; // Very Dark Green (91-100%)
            }
            
            row.innerHTML = `
                <td class="item-name" style="cursor: pointer;" title="Double-click to edit item details">${item.name}</td>
                <td class="current-value">${item.currentLevel}</td>
                <td class="level-bar-container">
                    <div class="level-bar">
                        <div class="level-bar-fill" style="width: ${displayPercentage}%; background-color: ${levelBarColor};"></div>
                        <div class="level-bar-text">${Math.round(percentage)}%</div>
                    </div>
                </td>
                <td class="target-value">${item.targetLevel}</td>
                <td class="sublocation-value">${item.sublocation || 'N/A'}</td>
                <td class="last-modified">${formatDate(item.lastCheckedTime)}</td>
            `;
            
            // Create progress bar using displayPercentage for visual width, but keep original percentage for text
            const levelBarFill = row.querySelector('.level-bar-fill');
            if (levelBarFill) {
                // Nuclear approach: Set styles and force them to stick
                levelBarFill.style.setProperty('width', `${displayPercentage}%`, 'important');
                levelBarFill.style.setProperty('max-width', `${displayPercentage}%`, 'important');
                levelBarFill.style.setProperty('min-width', `${displayPercentage}%`, 'important');
                levelBarFill.style.setProperty('background-color', levelBarColor, 'important');
                
                // Force the browser to apply the styles
                levelBarFill.offsetHeight;
                
                // Additional nuclear approach: Set inline styles directly
                levelBarFill.setAttribute('style', `width: ${displayPercentage}% !important; max-width: ${displayPercentage}% !important; min-width: ${displayPercentage}% !important; background-color: ${levelBarColor} !important; height: 100%; border-radius: 14px;`);
                
                // Force another reflow
                levelBarFill.offsetHeight;
                
                // Debug: Check if styles were applied
                if (item.name === 'Viande Meat [Ground beef] Frozen 1KG') {
                    console.log('Debug - After nuclear approach:');
                    console.log('  - Inline width:', levelBarFill.style.width);
                    console.log('  - Inline backgroundColor:', levelBarFill.style.backgroundColor);
                    console.log('  - Computed width:', window.getComputedStyle(levelBarFill).width);
                    console.log('  - Computed backgroundColor:', window.getComputedStyle(levelBarFill).backgroundColor);
                    console.log('  - getAttribute style:', levelBarFill.getAttribute('style'));
                    
                    // Check if there are any CSS rules affecting this element
                    const computedStyle = window.getComputedStyle(levelBarFill);
                    console.log('  - All computed styles that might affect width:');
                    console.log('    - width:', computedStyle.width);
                    console.log('    - maxWidth:', computedStyle.maxWidth);
                    console.log('    - minWidth:', computedStyle.minWidth);
                    console.log('    - boxSizing:', computedStyle.boxSizing);
                    console.log('    - display:', computedStyle.display);
                    console.log('    - position:', computedStyle.position);
                }
            }
            
                            // Add click functionality to the entire level bar container for quick updates
            const levelBarContainer = row.querySelector('.level-bar-container');
            if (levelBarContainer) {
                levelBarContainer.style.cursor = 'pointer';
                
                // Create informative tooltip with percentage range
                let percentageRange;
                if (percentage === 0) {
                    percentageRange = '0% (Critical)';
                } else if (percentage <= 5) {
                    percentageRange = '1-5% (Critical)';
                } else if (percentage <= 10) {
                    percentageRange = '6-10%';
                } else if (percentage <= 20) {
                    percentageRange = '11-20%';
                } else if (percentage <= 30) {
                    percentageRange = '21-30%';
                } else if (percentage <= 40) {
                    percentageRange = '31-40%';
                } else if (percentage <= 50) {
                    percentageRange = '41-50%';
                } else if (percentage <= 60) {
                    percentageRange = '51-60%';
                } else if (percentage <= 70) {
                    percentageRange = '61-70%';
                } else if (percentage <= 80) {
                    percentageRange = '71-80%';
                } else if (percentage <= 90) {
                    percentageRange = '81-90%';
                } else {
                    percentageRange = '91-100%';
                }
                
                levelBarContainer.title = `Click to update ${item.name} level (${percentageRange} - ${Math.round(percentage)}%)`;
                
                
                
                levelBarContainer.addEventListener('click', () => {
                    // Add visual feedback
                    levelBarContainer.style.transform = 'scale(0.98)';
                    levelBarContainer.style.opacity = '0.8';
                    
                    // Open the quick update modal for this item
                    if (typeof showQuickUpdateModal === 'function') {
                        showQuickUpdateModal(item);
                    } else {
                        console.error('showQuickUpdateModal function not found');
                        // Show user-friendly error message
                        alert('Update functionality not available. Please refresh the page and try again.');
                    }
                    
                    // Reset visual feedback after a short delay
                    setTimeout(() => {
                        levelBarContainer.style.transform = '';
                        levelBarContainer.style.opacity = '';
                    }, 150);
                });
            }
            
            // Add double-click functionality to item name for editing details
            const itemNameCell = row.querySelector('.item-name');
            if (itemNameCell) {
                itemNameCell.addEventListener('dblclick', () => {
                    showEditItemModal(item);
                });
            }
            
            // Debug: Add a test row to verify level bar works
            if (item.name === 'Viande Meat [Ground beef] Frozen 1KG') {
                console.log('Debug - Viande Meat row HTML:', row.innerHTML);
                console.log('Debug - Viande Meat percentage:', percentage);
                console.log('Debug - Viande Meat levelBarColor:', levelBarColor);
                console.log('Debug - Viande Meat inline style:', row.querySelector('.level-bar-fill').getAttribute('style'));
                
                // Test: Add a simple test to verify the level bar element exists
                setTimeout(() => {
                    const testFill = row.querySelector('.level-bar-fill');
                    if (testFill) {
                        console.log('Debug - Found level bar fill element:', testFill);
                        console.log('Debug - Computed width:', window.getComputedStyle(testFill).width);
                        console.log('Debug - Computed background-color:', window.getComputedStyle(testFill).backgroundColor);
                        console.log('Debug - Inline style attribute:', testFill.getAttribute('style'));
                    } else {
                        console.log('Debug - Level bar fill element NOT found!');
                    }
                }, 100);
            }
            
            overviewTableBody.appendChild(row);
        });
    }
    
    // Show edit item modal for double-clicked item names
    function showEditItemModal(item) {
        const modalBackdrop = document.createElement('div');
        modalBackdrop.className = 'modal-backdrop';

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-box';
        modalContent.style.maxWidth = '500px';

        const modalHeader = document.createElement('div');
        modalHeader.className = 'modal-header';
        modalHeader.innerHTML = `
            <h3 style="margin: 0; color: var(--primary-dark); font-size: 22px;">Edit Item Details</h3>
        `;
        
        // Create form fields
        const formFields = document.createElement('div');
        formFields.style.display = 'grid';
        formFields.style.gap = '20px';
        
        // Item Name field
        const nameGroup = document.createElement('div');
        nameGroup.style.display = 'flex';
        nameGroup.style.flexDirection = 'column';
        nameGroup.style.gap = '8px';
        
        const nameLabel = document.createElement('label');
        nameLabel.htmlFor = 'edit-item-name';
        nameLabel.textContent = 'Item Name *';
        nameLabel.style.fontWeight = '600';
        nameLabel.style.color = 'var(--text-dark)';
        
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.id = 'edit-item-name';
        nameInput.value = item.name;
        nameInput.required = true;
        nameInput.style.padding = '12px';
        nameInput.style.borderRadius = '6px';
        nameInput.style.border = '2px solid var(--border-light)';
        nameInput.style.fontSize = '16px';
        nameInput.style.transition = 'border-color 0.2s ease';
        
        nameInput.addEventListener('focus', () => {
            nameInput.style.borderColor = 'var(--primary-dark)';
        });
        
        nameInput.addEventListener('blur', () => {
            nameInput.style.borderColor = 'var(--border-light)';
        });
        
        nameGroup.appendChild(nameLabel);
        nameGroup.appendChild(nameInput);
        
        // Target Level field
        const targetGroup = document.createElement('div');
        targetGroup.style.display = 'flex';
        targetGroup.style.flexDirection = 'column';
        targetGroup.style.gap = '8px';
        
        const targetLabel = document.createElement('label');
        targetLabel.htmlFor = 'edit-target-level';
        targetLabel.textContent = 'Target Level *';
        targetLabel.style.fontWeight = '600';
        targetLabel.style.color = 'var(--text-dark)';
        
        const targetInput = document.createElement('input');
        targetInput.type = 'number';
        targetInput.id = 'edit-target-level';
        targetInput.value = item.targetLevel;
        targetInput.required = true;
        targetInput.step = '0.01';
        targetInput.min = '0';
        targetInput.style.padding = '12px';
        targetInput.style.borderRadius = '6px';
        targetInput.style.border = '2px solid var(--border-light)';
        targetInput.style.fontSize = '16px';
        targetInput.style.transition = 'border-color 0.2s ease';
        
        targetInput.addEventListener('focus', () => {
            targetInput.style.borderColor = 'var(--primary-dark)';
        });
        
        targetInput.addEventListener('blur', () => {
            targetInput.style.borderColor = 'var(--border-light)';
        });
        
        targetGroup.appendChild(targetLabel);
        targetGroup.appendChild(targetInput);
        
        // Sublocation field
        const sublocationGroup = document.createElement('div');
        sublocationGroup.style.display = 'flex';
        sublocationGroup.style.flexDirection = 'column';
        sublocationGroup.style.gap = '8px';
        
        const sublocationLabel = document.createElement('label');
        sublocationLabel.htmlFor = 'edit-sublocation';
        sublocationLabel.textContent = 'Sublocation';
        sublocationLabel.style.fontWeight = '600';
        sublocationLabel.style.color = 'var(--text-dark)';
        
        const sublocationInput = document.createElement('input');
        sublocationInput.type = 'text';
        sublocationInput.id = 'edit-sublocation';
        sublocationInput.value = item.sublocation || '';
        sublocationInput.placeholder = 'Enter sublocation (optional)';
        sublocationInput.style.padding = '12px';
        sublocationInput.style.borderRadius = '6px';
        sublocationInput.style.border = '2px solid var(--border-light)';
        sublocationInput.style.fontSize = '16px';
        sublocationInput.style.transition = 'border-color 0.2s ease';
        
        sublocationInput.addEventListener('focus', () => {
            sublocationInput.style.borderColor = 'var(--primary-dark)';
        });
        
        sublocationInput.addEventListener('blur', () => {
            sublocationInput.style.borderColor = 'var(--border-light)';
        });
        
        sublocationGroup.appendChild(sublocationLabel);
        sublocationGroup.appendChild(sublocationInput);
        
        // Add fields to form
        formFields.appendChild(nameGroup);
        formFields.appendChild(targetGroup);
        formFields.appendChild(sublocationGroup);
        
        // Create buttons
        const buttonGroup = document.createElement('div');
        buttonGroup.style.display = 'flex';
        buttonGroup.style.justifyContent = 'flex-end';
        buttonGroup.style.gap = '12px';
        buttonGroup.style.marginTop = '24px';
        
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.style.padding = '12px 24px';
        cancelButton.style.backgroundColor = 'var(--bg-medium)';
        cancelButton.style.color = 'var(--text-dark)';
        cancelButton.style.border = 'none';
        cancelButton.style.borderRadius = '6px';
        cancelButton.style.cursor = 'pointer';
        cancelButton.style.fontWeight = '500';
        cancelButton.style.transition = 'background-color 0.2s ease';
        
        cancelButton.addEventListener('mouseenter', () => {
            cancelButton.style.backgroundColor = 'var(--border-light)';
        });
        
        cancelButton.addEventListener('mouseleave', () => {
            cancelButton.style.backgroundColor = 'var(--bg-medium)';
        });
        
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save Changes';
        saveButton.style.padding = '12px 24px';
        saveButton.style.backgroundColor = 'var(--primary-dark)';
        saveButton.style.color = 'white';
        saveButton.style.border = 'none';
        saveButton.style.borderRadius = '6px';
        saveButton.style.cursor = 'pointer';
        saveButton.style.fontWeight = '600';
        saveButton.style.transition = 'background-color 0.2s ease';
        
        saveButton.addEventListener('mouseenter', () => {
            saveButton.style.backgroundColor = 'var(--primary-light)';
        });
        
        saveButton.addEventListener('mouseleave', () => {
            saveButton.style.backgroundColor = 'var(--primary-dark)';
        });
        
        buttonGroup.appendChild(cancelButton);
        buttonGroup.appendChild(saveButton);
        
        // Add all elements to modal
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(formFields);
        modalContent.appendChild(buttonGroup);
        modalBackdrop.appendChild(modalContent);
        
        // Add modal to document
        document.body.appendChild(modalBackdrop);
        
        // Focus on name input
        setTimeout(() => {
            nameInput.focus();
            nameInput.select();
        }, 100);
        
        // Function to close modal and clean up
        function closeModal() {
            console.log('closeModal function called');
            if (document.body.contains(modalBackdrop)) {
                document.body.removeChild(modalBackdrop);
                console.log('Modal backdrop removed from DOM');
            } else {
                console.log('Modal backdrop not found in DOM');
            }
        }
        
        // Save function
        function saveChanges() {
            const newName = nameInput.value.trim();
            const newTarget = parseFloat(targetInput.value);
            const newSublocation = sublocationInput.value.trim();
            
            // Validation
            if (!newName) {
                alert('Item name cannot be empty');
                nameInput.focus();
                return;
            }
            
            if (isNaN(newTarget) || newTarget < 0) {
                alert('Target level must be a valid positive number');
                targetInput.focus();
                return;
            }
            
            // Check for duplicate names (excluding current item)
            const duplicateName = icItems.find(i => i.id !== item.id && i.name.toLowerCase() === newName.toLowerCase());
            if (duplicateName) {
                alert(`An item with the name "${newName}" already exists`);
                nameInput.focus();
                return;
            }
            
            // Update the item
            const itemIndex = icItems.findIndex(i => i.id === item.id);
            if (itemIndex !== -1) {
                icItems[itemIndex].name = newName;
                icItems[itemIndex].targetLevel = newTarget;
                icItems[itemIndex].sublocation = newSublocation || null; // Set to null if empty
                icItems[itemIndex].lastCheckedTime = new Date().toISOString();
                
                // Save to local storage
                localStorage.setItem('icItems', JSON.stringify(icItems));
                
                // Save to Firebase if available
                if (window.firebaseDb && window.firebaseDb.saveAllIcItems) {
                    window.firebaseDb.saveAllIcItems(icItems)
                        .then(() => {
                            console.log("Item updated in Firebase successfully");
                        })
                        .catch(error => {
                            console.error("Error saving to Firebase:", error);
                        });
                }
                
                // Update the Overview table
                updateOverviewTable();
                
                // Show success message (only if function exists)
                if (typeof showSuccessMessage === 'function') {
                    showSuccessMessage(`Item "${newName}" updated successfully`);
                }
                
                // Close modal
                closeModal();
                
                console.log('Modal should be closed now');
            }
        }
        
        // Add event listeners
        cancelButton.addEventListener('click', () => {
            console.log('Cancel button clicked');
            closeModal();
        });
        saveButton.addEventListener('click', () => {
            console.log('Save button clicked');
            saveChanges();
        });
        
        // Close on backdrop click
        modalBackdrop.addEventListener('click', (event) => {
            if (event.target === modalBackdrop) {
                closeModal();
            }
        });
        
        // Handle Enter key on inputs - all save directly
        nameInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                saveChanges();
            }
        });
        
        targetInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                saveChanges();
            }
        });
        
        sublocationInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                saveChanges();
            }
        });
    }
    
    // Sorting functions
    function sortItems(items, column, direction) {
        const sortedItems = [...items];
        
        switch (column) {
            case 'name':
                sortedItems.sort((a, b) => {
                    const result = a.name.localeCompare(b.name);
                    return direction === 'asc' ? result : -result;
                });
                break;
                
            case 'current':
                sortedItems.sort((a, b) => {
                    const result = a.currentLevel - b.currentLevel;
                    return direction === 'asc' ? result : -result;
                });
                break;
                
            case 'level':
                sortedItems.sort((a, b) => {
                    const percentA = (a.currentLevel / a.targetLevel) * 100;
                    const percentB = (b.currentLevel / b.targetLevel) * 100;
                    const result = percentA - percentB;
                    return direction === 'asc' ? result : -result;
                });
                break;
                
            case 'target':
                sortedItems.sort((a, b) => {
                    const result = a.targetLevel - b.targetLevel;
                    return direction === 'asc' ? result : -result;
                });
                break;
                
            case 'sublocation':
                sortedItems.sort((a, b) => {
                    const sublocationA = (a.sublocation || 'N/A').toLowerCase();
                    const sublocationB = (b.sublocation || 'N/A').toLowerCase();
                    const result = sublocationA.localeCompare(sublocationB);
                    return direction === 'asc' ? result : -result;
                });
                break;
                
            case 'modified':
                sortedItems.sort((a, b) => {
                    const dateA = new Date(a.lastCheckedTime || 0);
                    const dateB = new Date(b.lastCheckedTime || 0);
                    const result = dateA - dateB;
                    return direction === 'asc' ? result : -result;
                });
                break;
        }
        
        return sortedItems;
    }
    
    function restoreOriginalOrder(items) {
        if (originalItemOrder.length === 0) return items;
        
        // Create a map of item names to their original positions
        const originalPositions = new Map();
        originalItemOrder.forEach((item, index) => {
            originalPositions.set(item.name, index);
        });
        
        // Sort items by their original positions
        return items.sort((a, b) => {
            const posA = originalPositions.get(a.name) || 0;
            const posB = originalPositions.get(b.name) || 0;
            return posA - posB;
        });
    }
    
    function handleSortClick(column) {
        // Remove active class from all headers
        document.querySelectorAll('.overview-table .sortable').forEach(header => {
            header.classList.remove('active', 'asc', 'desc');
        });
        
        const header = document.querySelector(`[data-sort="${column}"]`);
        if (!header) return;
        
        // Determine new sort direction
        let newDirection;
        if (currentSortColumn !== column) {
            // New column: start with ascending
            newDirection = 'asc';
        } else {
            // Same column: cycle through directions
            if (currentSortDirection === 'asc') {
                newDirection = 'desc';
            } else if (currentSortDirection === 'desc') {
                newDirection = null; // Return to original order
            } else {
                newDirection = 'asc';
            }
        }
        
        // Update sort state
        currentSortColumn = newDirection ? column : null;
        currentSortDirection = newDirection;
        
        // Update header appearance
        if (newDirection) {
            header.classList.add('active', newDirection);
        }
        
        // Store original order if this is the first sort
        if (originalItemOrder.length === 0) {
            originalItemOrder = [...window.icItems];
        }
        
        // Refresh the table
        updateOverviewTable();
    }
    
    // Update low stock list
    function updateLowStockList() {
        if (!lowStockContainer) return;
        
        lowStockContainer.innerHTML = '';
        
        // Filter items that are below 50% of target and match current location
        const lowStockItems = window.icItems.filter(item => {
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
            // Format time (hours and minutes)
            let timeDisplay = '';
            if (item.lastCheckedTime) {
                try {
                    const date = new Date(item.lastCheckedTime);
                    if (!isNaN(date.getTime())) {
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
                <div class="todo-item-detail">Current: ${item.currentLevel} ${item.unit}</div>
                <div class="todo-item-detail"><span style="font-weight: 700;">Need:</span> ${(item.targetLevel - item.currentLevel).toFixed(1)} ${item.unit} more</div>
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
        totalItemsElement.textContent = window.icItems.length;
        
        // Items below 50% of target
        const belowFifty = window.icItems.filter(item => item.currentLevel < item.targetLevel * 0.5).length;
        itemsBelowFiftyElement.textContent = belowFifty;
    }
    
    // Set up event listeners for navigation
    function setupNavigation() {
        // Switch user
        if (switchUserBtn) {
            switchUserBtn.addEventListener('click', () => {
                currentStaff = '';
                if (staffSelection) staffSelection.style.display = 'flex';
                if (mainInterface) mainInterface.style.display = 'none';
            });
        }
        
        // User login button (header)
        if (userLoginBtn) {
            userLoginBtn.addEventListener('click', () => {
                currentStaff = '';
                if (staffSelection) staffSelection.style.display = 'flex';
                if (mainInterface) mainInterface.style.display = 'none';
            });
        }
        
        // Navigation buttons
        navButtons.forEach(button => {
            button.addEventListener('click', () => {
                const sectionId = button.getAttribute('data-section');
                switchSection(sectionId, button);
            });
        });
        
        // Set up sortable table headers
        setupSortableHeaders();
        
        // Set up search functionality
        setupSearch();
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
            loadAndDisplayHistory();
        } else if (sectionId === 'overview') {
            // Store original order when first loading Overview
            if (originalItemOrder.length === 0 && window.icItems && window.icItems.length > 0) {
                originalItemOrder = [...window.icItems];
            }
            updateOverviewTable();
        }
    }
    
    // Set up sortable table headers
    function setupSortableHeaders() {
        // Add click event listeners to all sortable headers
        document.addEventListener('click', (event) => {
            const header = event.target.closest('.sortable');
            if (header) {
                const column = header.getAttribute('data-sort');
                if (column) {
                    handleSortClick(column);
                }
            }
        });
    }
    
    // Set up search functionality
    function setupSearch() {
        const searchInput = document.getElementById('overview-search');
        if (searchInput) {
            // Add input event listener for real-time search
            searchInput.addEventListener('input', () => {
                updateOverviewTable();
            });
            
            // Add focus styles
            searchInput.addEventListener('focus', () => {
                searchInput.style.borderColor = 'var(--primary-dark)';
            });
            
            searchInput.addEventListener('blur', () => {
                searchInput.style.borderColor = 'var(--border-light)';
            });
        }
    }
    
    // Set up real-time updates from Firebase
    function setupRealtimeUpdates() {
        if (window.firebaseDb && window.firebaseDb.onIcItemsChange) {
            window.firebaseDb.onIcItemsChange((updatedItems) => {
                console.log("Real-time update received:", updatedItems.length);
                window.icItems = updatedItems;
                
                // Extract locations and sublocations
                extractLocationsAndSublocations();
                
                // Update UI
                updateLocationFilters();
                updateInventoryTables();
                updateLowStockList();
                updateStats();
                
                // Update Overview table if Overview section is active
                const overviewSection = document.getElementById('overview-section');
                if (overviewSection && overviewSection.style.display !== 'none') {
                    updateOverviewTable();
                }
                
                // Update original order if it's empty
                if (originalItemOrder.length === 0 && updatedItems.length > 0) {
                    originalItemOrder = [...updatedItems];
                }
            });
        }
    }
    
    // Full Count functionality
    function setupFullCount() {
        if (startCountBtn) {
            startCountBtn.addEventListener('click', startFullCount);
        }
        
        if (saveNextBtn) {
            saveNextBtn.addEventListener('click', saveAndNext);
        }
        
        if (cancelCountBtn) {
            cancelCountBtn.addEventListener('click', cancelFullCount);
        }
    }
    
    // Start the full count process
    function startFullCount() {
        if (!window.icItems || window.icItems.length === 0) {
            alert("No items to count. Please add items first.");
            return;
        }
        
        // Show staff selection or use current staff
        if (!currentStaff) {
            showStaffSelectionModal().then(staff => {
                if (staff) {
                    currentStaff = staff;
                    if (currentUserElement) currentUserElement.textContent = staff;
                    if (headerUserName) headerUserName.textContent = staff;
                    startFullCountProcess();
                }
            });
        } else {
            startFullCountProcess();
        }
    }
    
    // Show staff selection modal
    function showStaffSelectionModal() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-backdrop';

            const content = document.createElement('div');
            content.className = 'modal-box';

            const title = document.createElement('h3');
            title.textContent = 'Select Staff for Count';
            title.style.marginBottom = '20px';
            title.style.textAlign = 'center';
            
            // Staff container
            const staffContainer = document.createElement('div');
            
            // Load staff members
            if (window.firebaseDb && window.firebaseDb.loadStaffMembers) {
                window.firebaseDb.loadStaffMembers()
                    .then(staffMembers => {
                        // Filter active staff
                        const activeStaff = staffMembers.filter(staff => staff.active);
                        
                        if (activeStaff.length > 0) {
                            activeStaff.forEach(staff => {
                                addStaffButton(staff.name);
                            });
                        } else {
                            addDefaultStaffButtons();
                        }
                    })
                    .catch(error => {
                        console.error("Error loading staff:", error);
                        addDefaultStaffButtons();
                    });
            } else {
                addDefaultStaffButtons();
            }
            
            // Function to add staff button
            function addStaffButton(name) {
                const btn = document.createElement('button');
                btn.textContent = name;
                btn.style.display = 'block';
                btn.style.width = '100%';
                btn.style.padding = '10px';
                btn.style.margin = '10px 0';
                btn.style.border = 'none';
                btn.style.borderRadius = '5px';
                btn.style.backgroundColor = '#80b244';
                btn.style.color = 'white';
                btn.style.cursor = 'pointer';
                
                btn.onclick = function() {
                    document.body.removeChild(modal);
                    resolve(name);
                };
                
                staffContainer.appendChild(btn);
            }
            
            // Add default staff buttons
            function addDefaultStaffButtons() {
                const defaultStaff = ["Serge Men", "Tatiana", "Nadine", "Nicolas", "Omar"];
                defaultStaff.forEach(name => {
                    addStaffButton(name);
                });
            }
            
            // Cancel button
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.style.display = 'block';
            cancelBtn.style.width = '100%';
            cancelBtn.style.padding = '10px';
            cancelBtn.style.margin = '20px 0 0 0';
            cancelBtn.style.border = 'none';
            cancelBtn.style.borderRadius = '5px';
            cancelBtn.style.backgroundColor = '#f1f1f1';
            cancelBtn.style.color = '#333';
            cancelBtn.style.cursor = 'pointer';
            
            cancelBtn.onclick = function() {
                document.body.removeChild(modal);
                resolve(null);
            };
            
            // Assemble modal
            content.appendChild(title);
            content.appendChild(staffContainer);
            content.appendChild(cancelBtn);
            modal.appendChild(content);
            
            // Close on outside click
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                    resolve(null);
                }
            });
            
            // Add to document
            document.body.appendChild(modal);
        });
    }
    
    // Function to continue with full count process
    function startFullCountProcess() {
        console.log("Starting full count process with", window.icItems.length, "items");
        
        // Filter by current location if not "All"
        countQueue = currentLocation !== 'All' 
            ? window.icItems.filter(item => item.location === currentLocation)
            : [...window.icItems];
            
        console.log("Items to count after filtering:", countQueue.length);
        
        if (countQueue.length === 0) {
            alert('No items to count in the selected location.');
            return;
        }
        
        // Sort items
        countQueue.sort((a, b) => {
            // First by location
            if (a.location !== b.location) {
                return a.location.localeCompare(b.location);
            }
            
            // Then by sublocation
            if (a.sublocation !== b.sublocation) {
                const subA = a.sublocation || '';
                const subB = b.sublocation || '';
                return subA.localeCompare(subB);
            }
            
            // Then by display order
            if (a.displayOrder !== undefined && b.displayOrder !== undefined) {
                return a.displayOrder - b.displayOrder;
            }
            
            // Finally by name
            return a.name.localeCompare(b.name);
        });
        
        currentItemIndex = 0;
        
        // Initialize inputs
        currentLevelInput.value = countQueue[0]?.currentLevel || '0';
        if (currentValueDisplay) {
            currentValueDisplay.textContent = countQueue[0]?.currentLevel || '0';
        }
        
        // Show first item
        showCurrentCountItem();
        
        // Show count interface
        if (dashboardSection) dashboardSection.style.display = 'none';
        if (countInterface) countInterface.style.display = 'block';
        
        // Initialize slider
        initTouchSlider();
    }
    
    // Show current count item
    function showCurrentCountItem() {
        if (countQueue.length === 0 || currentItemIndex >= countQueue.length) {
            console.error("Invalid count index or empty queue");
            return;
        }
        
        const item = countQueue[currentItemIndex];
        console.log("Showing item:", item);
        
        // Update location header
        if (currentLocationElement) {
            currentLocationElement.textContent = item.location || 'All';
        }
        
        // Update progress indicator
        if (checkProgressElement) {
            checkProgressElement.textContent = `Item ${currentItemIndex + 1} of ${countQueue.length}`;
        }
        
        // Update item name
        if (checkItemNameElement) {
            checkItemNameElement.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <span>${item.name}</span>
                    <span class="user-indicator">${currentStaff}</span>
                </div>
            `;
        }
        
        // Update target
        if (checkItemTargetElement) {
            checkItemTargetElement.textContent = `Target: ${item.targetLevel} ${item.unit}`;
        }
        
        // Update value
        if (currentLevelInput) {
            currentLevelInput.value = item.currentLevel;
        }
        
        if (currentValueDisplay) {
            currentValueDisplay.textContent = item.currentLevel;
        }
        
        // Update slider if it exists
        if (window.countSlider) {
            window.countSlider.setValue(item.currentLevel);
        }
    }
    
    // Save current item and move to next
    function saveAndNext() {
        if (countQueue.length === 0 || currentItemIndex >= countQueue.length) {
            console.error("Invalid count index or empty queue");
            return;
        }
        
        // Get current value
        const value = currentLevelInput.value;
        const numValue = parseFloat(value);
        
        if (isNaN(numValue)) {
            alert("Please enter a valid number");
            return;
        }
        
        // Get current item
        const item = countQueue[currentItemIndex];
        
        // Save old value for activity log
        const oldValue = item.currentLevel;
        
        // Update item
        item.currentLevel = numValue;
        item.lastCheckedBy = currentStaff;
        item.lastCheckedTime = new Date().toISOString();
        
        // Save to Firebase
        if (window.firebaseDb && window.firebaseDb.saveIcItem) {
            window.firebaseDb.saveIcItem(item)
                .then(() => {
                    console.log("Item saved successfully");
                    
                    // Log activity
                    if (window.firebaseDb.saveIcActivityLog) {
                        const activity = {
                            timestamp: new Date().toISOString(),
                            user: currentStaff,
                            itemId: item.id,
                            itemName: item.name,
                            location: item.location,
                            sublocation: item.sublocation,
                            actionType: 'count',
                            oldValue: oldValue,
                            newValue: numValue,
                            unit: item.unit
                        };
                        
                        window.firebaseDb.saveIcActivityLog(activity)
                            .then(() => console.log("Activity logged"))
                            .catch(error => console.error("Error logging activity:", error));
                    }
                })
                .catch(error => {
                    console.error("Error saving item:", error);
                    alert("Error saving item. Please try again.");
                });
        }
        
        // Move to next item or complete
        currentItemIndex++;
        
        if (currentItemIndex < countQueue.length) {
            showCurrentCountItem();
        } else {
            // All items processed
            completeFullCount();
        }
    }
    
    // Complete full count
    function completeFullCount() {
        if (dashboardSection) dashboardSection.style.display = 'block';
        if (countInterface) countInterface.style.display = 'none';
        
        // Update UI
        updateInventoryTables();
        updateLowStockList();
        updateStats();
        
        // Show success message
        showMessage("Full count completed successfully", "success");
    }
    
    // Cancel full count
    function cancelFullCount() {
        if (dashboardSection) dashboardSection.style.display = 'block';
        if (countInterface) countInterface.style.display = 'none';
    }
    
    // Touch slider functionality
    function initTouchSlider() {
        // Create slider if not exists
        if (!window.countSlider) {
            const container = document.querySelector('.slider-container');
            const handle = document.getElementById('handle');
            const progress = document.getElementById('progress');
            const ticks = document.getElementById('ticks');
            
            if (!container || !handle || !progress || !ticks) {
                console.error("Missing slider elements");
                return;
            }
            
            // Initialize slider
            window.countSlider = {
                // Generate values array
                values: generateValues(),
                currentValue: parseFloat(currentLevelInput.value) || 0,
                
                // Initialize
                init: function() {
                    this.createTicks();
                    this.updateDisplay();
                    this.setupEvents();
                },
                
                // Create tick marks
                createTicks: function() {
                    ticks.innerHTML = '';
                    
                    this.values.forEach((val, index) => {
                        const percentage = index / (this.values.length - 1) * 100;
                        
                        const tick = document.createElement('div');
                        tick.className = val % 1 === 0 ? 'tick major' : 'tick';
                        tick.style.left = percentage + '%';
                        ticks.appendChild(tick);
                        
                        // Add labels for whole numbers
                        if (val % 1 === 0 && (val <= 3 || val % 2 === 0)) {
                            const label = document.createElement('div');
                            label.className = 'tick-label';
                            label.textContent = val;
                            label.style.left = percentage + '%';
                            ticks.appendChild(label);
                        }
                    });
                },
                
                // Update slider display
                updateDisplay: function() {
                    const valueIndex = this.values.indexOf(this.currentValue);
                    const percentage = valueIndex / (this.values.length - 1) * 100;
                    
                    handle.style.left = percentage + '%';
                    progress.style.width = percentage + '%';
                    
                    // Update text displays
                    currentLevelInput.value = this.currentValue;
                    currentValueDisplay.textContent = this.currentValue < 3 ? 
                        this.currentValue.toFixed(2) : this.currentValue.toFixed(0);
                },
                
                // Set value
                setValue: function(value) {
                    this.currentValue = this.findClosestValue(value);
                    this.updateDisplay();
                },
                
                // Find closest value in values array
                findClosestValue: function(value) {
                    const exactMatch = this.values.indexOf(value);
                    if (exactMatch !== -1) return value;
                    
                    // Find closest
                    let closest = this.values[0];
                    let minDiff = Math.abs(value - closest);
                    
                    for (const v of this.values) {
                        const diff = Math.abs(value - v);
                        if (diff < minDiff) {
                            minDiff = diff;
                            closest = v;
                        }
                    }
                    
                    return closest;
                },
                
                // Set up event handlers
                setupEvents: function() {
                    // Decrease button
                    const decreaseBtn = document.getElementById('decrease');
                    if (decreaseBtn) {
                        decreaseBtn.addEventListener('click', () => {
                            const index = this.values.indexOf(this.currentValue);
                            if (index > 0) {
                                this.setValue(this.values[index - 1]);
                            }
                        });
                    }
                    
                    // Increase button
                    const increaseBtn = document.getElementById('increase');
                    if (increaseBtn) {
                        increaseBtn.addEventListener('click', () => {
                            const index = this.values.indexOf(this.currentValue);
                            if (index < this.values.length - 1) {
                                this.setValue(this.values[index + 1]);
                            }
                        });
                    }
                    
                    // Slider click
                    container.addEventListener('click', (e) => {
                        if (e.target === handle) return;
                        
                        const rect = container.getBoundingClientRect();
                        const percentage = (e.clientX - rect.left) / rect.width;
                        const index = Math.round(percentage * (this.values.length - 1));
                        
                        this.setValue(this.values[index]);
                    });
                    
                    // Drag functionality
                    let isDragging = false;
                    
                    handle.addEventListener('mousedown', startDrag);
                    handle.addEventListener('touchstart', startDrag);
                    
                    document.addEventListener('mousemove', onDrag);
                    document.addEventListener('touchmove', onDrag);
                    
                    document.addEventListener('mouseup', endDrag);
                    document.addEventListener('touchend', endDrag);
                    
                    function startDrag(e) {
                        e.preventDefault();
                        isDragging = true;
                    }
                    
                    const that = this;
                    function onDrag(e) {
                        if (!isDragging) return;
                        
                        const rect = container.getBoundingClientRect();
                        const clientX = e.type.includes('touch') ? 
                            e.touches[0].clientX : e.clientX;
                        
                        const percentage = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
                        const index = Math.round(percentage * (that.values.length - 1));
                        
                        that.setValue(that.values[index]);
                        
                        e.preventDefault();
                    }
                    
                    function endDrag() {
                        isDragging = false;
                    }
                }
            };
            
            // Initialize slider
            window.countSlider.init();
        }
    }
    
    // Generate values array for slider
    function generateValues() {
        const values = [];
        
        // 0 to 3 in 0.25 increments
        for (let i = 0; i <= 12; i++) {
            values.push(i * 0.25);
        }
        
        // 4 to 20 in increments of 1
        for (let i = 4; i <= 20; i++) {
            values.push(i);
        }
        
        return values;
    }
    
    // Show quick update modal for an item
    function showQuickUpdateModal(item) {
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';

        const content = document.createElement('div');
        content.className = 'modal-box';
        
        // Item details
        content.innerHTML = `
            <div style="margin-bottom: 15px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                    <h3 style="margin: 0; color: #333;">${item.name}</h3>
                    <span style="background-color: var(--accent-orange); color: white; padding: 4px 8px; border-radius: 4px; font-size: 14px; font-weight: 500;">${currentStaff}</span>
                </div>
                <p style="margin: 5px 0;">Current: ${item.currentLevel} ${item.unit} | Target: ${item.targetLevel} ${item.unit}</p>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">New quantity:</label>
                <input type="hidden" id="modal-current-level" value="${item.currentLevel}">
                
                <div class="touch-input-container">
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
                </div>
            </div>
            
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button id="modal-cancel" style="flex: 1; padding: 10px; background: #f1f1f1; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
                <button id="modal-save" style="flex: 1; padding: 10px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Save</button>
            </div>
        `;
        
        // Add modal to document
        document.body.appendChild(modal);
        
        // Set up event handlers
        const cancelBtn = content.querySelector('#modal-cancel');
        const saveBtn = content.querySelector('#modal-save');
        
        // Create touch slider for this modal
        let modalSlider;
        
        // Initialize the slider after the modal is added to DOM
        setTimeout(() => {
            if (typeof createTouchSlider === 'function') {
                modalSlider = createTouchSlider({
                    containerId: content.querySelector('.slider-container'),
                    valueDisplayId: 'modal-current-value',
                    handleId: 'modal-handle',
                    progressId: 'modal-progress',
                    ticksId: 'modal-ticks',
                    decreaseId: 'modal-decrease',
                    increaseId: 'modal-increase',
                    hiddenInputId: 'modal-current-level',
                    initialValue: item.currentLevel
                });
            } else {
                console.error('createTouchSlider function not found');
            }
        }, 0);
        
        // Cancel button
        cancelBtn.addEventListener('click', () => {
            // Clean up slider if it exists
            if (modalSlider && typeof modalSlider.destroy === 'function') {
                modalSlider.destroy();
            }
            document.body.removeChild(modal);
        });
        
        // Save button
        saveBtn.addEventListener('click', () => {
            const valueInput = content.querySelector('#modal-current-level');
            const newValue = parseFloat(valueInput.value);
            
            if (isNaN(newValue)) {
                alert("Please enter a valid number");
                return;
            }
            
            // Save old value for activity log
            const oldValue = item.currentLevel;
            
            // Update item
            item.currentLevel = newValue;
            item.lastCheckedBy = currentStaff;
            item.lastCheckedTime = new Date().toISOString();
            
            // Save to Firebase
            if (window.firebaseDb && window.firebaseDb.saveIcItem) {
                window.firebaseDb.saveIcItem(item)
                    .then(() => {
                        console.log("Item saved successfully");
                        
                        // Log activity
                        if (window.firebaseDb.saveIcActivityLog) {
                            const activity = {
                                timestamp: new Date().toISOString(),
                                user: currentStaff,
                                itemId: item.id,
                                itemName: item.name,
                                location: item.location,
                                sublocation: item.sublocation,
                                actionType: 'update',
                                oldValue: oldValue,
                                newValue: newValue,
                                unit: item.unit
                            };
                            
                            window.firebaseDb.saveIcActivityLog(activity);
                        }
                        
                        // Update UI
                        updateInventoryTables();
                        updateLowStockList();
                        updateStats();
                        
                        // Update Overview table if it's active
                        if (typeof updateOverviewTable === 'function') {
                            updateOverviewTable();
                        }
                        
                        // Show success message
                        showMessage(`${item.name} updated to ${newValue} ${item.unit}`, "success");
                    })
                    .catch(error => {
                        console.error("Error saving item:", error);
                        showMessage("Error saving item", "error");
                    });
            }
            
            // Clean up slider if it exists
            if (modalSlider && typeof modalSlider.destroy === 'function') {
                modalSlider.destroy();
            }
            
            // Close modal
            document.body.removeChild(modal);
        });
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                // Clean up slider if it exists
                if (modalSlider && typeof modalSlider.destroy === 'function') {
                    modalSlider.destroy();
                }
                document.body.removeChild(modal);
            }
        });
        
        // Add content to modal
        modal.appendChild(content);
    }
    
    // Check and purge old I&C activity logs (older than 2 months)
    function checkAndPurgeOldHistory() {
        // Check if we've already done purge check this session
        if (sessionStorage.getItem('icPurgeCheckDone')) {
            return;
        }
        
        // Check if Firebase is available
        if (!window.firebaseDb || !window.firebaseDb.loadIcActivityLogs) {
            console.log('Firebase not available for purge check');
            return;
        }
        
        // Load activity logs to check for old records
        window.firebaseDb.loadIcActivityLogs()
            .then(logs => {
                if (!logs || logs.length === 0) {
                    return;
                }
                
                const twoMonthsAgo = new Date();
                twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
                
                // Filter logs older than 2 months
                const oldLogs = logs.filter(log => {
                    const logDate = new Date(log.timestamp);
                    return logDate < twoMonthsAgo;
                });
                
                // If there are old logs, show purge modal
                if (oldLogs.length > 0) {
                    showPurgeModal(oldLogs);
                }
            })
            .catch(error => {
                console.error('Error checking for old logs:', error);
            });
    }
    
    // Show purge confirmation modal
    function showPurgeModal(oldLogs) {
        const modalBackdrop = document.createElement('div');
        modalBackdrop.className = 'modal-backdrop';

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-box';
        modalContent.style.maxWidth = '500px';

        // Calculate date range for display
        const twoMonthsAgo = new Date();
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
        const dateRange = twoMonthsAgo.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long' 
        });
        
        // Create modal header
        const modalHeader = document.createElement('div');
        modalHeader.style.marginBottom = '20px';
        modalHeader.innerHTML = `
            <h3 style="margin: 0; color: var(--primary-dark); font-size: 22px;">Database Cleanup Available</h3>
            <p style="margin: 8px 0 0 0; color: var(--text-medium);">
                Found ${oldLogs.length} inventory history records older than ${dateRange}
            </p>
        `;
        
        // Create info section
        const infoSection = document.createElement('div');
        infoSection.style.marginBottom = '20px';
        infoSection.style.padding = '16px';
        infoSection.style.backgroundColor = 'var(--bg-light)';
        infoSection.style.borderRadius = '6px';
        infoSection.style.borderLeft = '4px solid var(--accent-blue)';
        infoSection.innerHTML = `
            <p style="margin: 0; color: var(--text-medium); font-size: 14px;">
                <strong>Benefits of cleanup:</strong><br>
                • Free up database space<br>
                • Improve app performance<br>
                • Reduce Firebase costs<br>
                • Keep only relevant recent data
            </p>
        `;
        
        // Create buttons
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'btn-group';

        const skipButton = document.createElement('button');
        skipButton.textContent = 'Skip for Now';
        skipButton.className = 'btn btn--secondary';

        const purgeButton = document.createElement('button');
        purgeButton.textContent = `Clean Up ${oldLogs.length} Records`;
        purgeButton.className = 'btn btn--danger';

        buttonGroup.appendChild(skipButton);
        buttonGroup.appendChild(purgeButton);
        
        // Add all elements to modal
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(infoSection);
        modalContent.appendChild(buttonGroup);
        modalBackdrop.appendChild(modalContent);
        
        // Add modal to document
        document.body.appendChild(modalBackdrop);
        
        // Function to close modal and clean up
        function closeModal() {
            document.body.removeChild(modalBackdrop);
        }
        
        // Skip button - just close modal
        skipButton.addEventListener('click', () => {
            closeModal();
        });
        
        // Purge button - delete old records
        purgeButton.addEventListener('click', () => {
            purgeOldRecords(oldLogs);
            closeModal();
        });
        
        // Close on backdrop click
        modalBackdrop.addEventListener('click', (event) => {
            if (event.target === modalBackdrop) {
                closeModal();
            }
        });
    }
    
    // Purge old records from Firebase
    function purgeOldRecords(oldLogs) {
        if (!window.firebaseDb || !window.firebaseDb.deleteIcActivityLogs) {
            console.error('Firebase delete function not available');
            return;
        }
        
        console.log('Starting purge of', oldLogs.length, 'old records');
        console.log('Sample log structure:', oldLogs[0]);
        
        // Show loading state
        const loadingMessage = showMessage('Cleaning up old records...', 'info');
        
        // Delete old records
        const deletePromises = oldLogs.map(log => {
            // The log should have a key property from Firebase
            if (log.key) {
                console.log('Deleting log with key:', log.key);
                return window.firebaseDb.deleteIcActivityLogs(log.key);
            } else {
                console.warn('Log missing key:', log);
                return Promise.resolve(); // Skip this log
            }
        });
        
        console.log('Created', deletePromises.length, 'delete promises');
        
        Promise.all(deletePromises)
            .then(() => {
                console.log('All delete operations completed successfully');
                
                // Remove loading message
                if (loadingMessage) {
                    loadingMessage.remove();
                }
                
                // Show success message
                showMessage(`Successfully cleaned up ${oldLogs.length} old records!`, 'success');
                
                // Mark purge as done for this session
                sessionStorage.setItem('icPurgeCheckDone', 'true');
                
                // Refresh history if it's currently displayed
                if (typeof loadAndDisplayHistory === 'function') {
                    loadAndDisplayHistory();
                }
            })
            .catch(error => {
                console.error('Error purging old records:', error);
                console.error('Error details:', error.message, error.stack);
                
                // Remove loading message
                if (loadingMessage) {
                    loadingMessage.remove();
                }
                
                // Show error message
                showMessage('Error cleaning up old records. Please try again.', 'error');
            });
    }
    
    // Load and display history
    function loadAndDisplayHistory() {
        const historyContent = document.getElementById('history-content');
        const analyticsContainer = document.getElementById('history-analytics');
        
        if (!historyContent) return;
        
        historyContent.innerHTML = '<div class="empty-state"><p>Loading activity logs...</p></div>';
        
        if (window.firebaseDb && window.firebaseDb.loadIcActivityLogs) {
            window.firebaseDb.loadIcActivityLogs()
                .then(logs => {
                    if (!logs || logs.length === 0) {
                        historyContent.innerHTML = `
                            <div class="empty-state">
                                <p>No activity logs found.</p>
                            </div>
                        `;
                        return;
                    }
                    
                    // Sort logs by date (newest first)
                    const sortedLogs = logs.sort((a, b) => 
                        new Date(b.timestamp) - new Date(a.timestamp)
                    );
                    
                    // Display logs
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
                            case 'update':
                                actionText = 'updated';
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
                                actionText = 'modified';
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
                    
                    // Update history content
                    historyContent.innerHTML = html;
                    
                    // Update analytics
                    if (analyticsContainer) {
                        updateHistoryAnalytics(logs);
                    }
                })
                .catch(error => {
                    console.error("Error loading logs:", error);
                    historyContent.innerHTML = `
                        <div class="empty-state">
                            <p>Error loading activity logs: ${error.message}</p>
                        </div>
                    `;
                });
        }
    }
    
    // Update history analytics
    function updateHistoryAnalytics(logs) {
        const analyticsContainer = document.getElementById('history-analytics');
        if (!analyticsContainer) return;
        
        // Calculate metrics
        const totalLogs = logs.length;
        const countCount = logs.filter(log => log.actionType === 'count').length;
        const updateCount = logs.filter(log => log.actionType === 'update').length;
        
        // Count by location
        const locationCounts = {};
        logs.forEach(log => {
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
        logs.forEach(log => {
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
                    <div class="analytics-label">Total Activities</div>
                </div>
                <div class="analytics-card">
                    <div class="analytics-value">${countCount}</div>
                    <div class="analytics-label">Count Updates</div>
                </div>
                <div class="analytics-card">
                    <div class="analytics-value">${updateCount}</div>
                    <div class="analytics-label">Manual Updates</div>
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
    
    // Show message toast
    function showMessage(message, type = "info") {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.right = '20px';
        toast.style.padding = '12px 20px';
        toast.style.borderRadius = '4px';
        toast.style.zIndex = '2000';
        
        // Set colors based on type
        if (type === "success") {
            toast.style.backgroundColor = '#4CAF50';
            toast.style.color = 'white';
        } else if (type === "error") {
            toast.style.backgroundColor = '#f44336';
            toast.style.color = 'white';
        } else {
            toast.style.backgroundColor = '#2196F3';
            toast.style.color = 'white';
        }
        
        document.body.appendChild(toast);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 3000);
    }
    
    // Initialize application
    function init() {
        // Load staff members
        loadStaffMembers();
        
        // Set up navigation
        setupNavigation();
        
        // Set up full count
        setupFullCount();
    }
    
    // Start the application
    init();
});
