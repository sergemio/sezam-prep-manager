// Simple direct history system

// Wait for document to be ready
document.addEventListener('DOMContentLoaded', function() {
    
    // Function to directly load and display logs
    function loadAndDisplayLogs() {
        
        if (!window.firebaseDb || typeof window.firebaseDb.loadActivityLogs !== 'function') {
            console.error("Firebase loadActivityLogs not available");
            return;
        }
        
        // Get containers
        const historyContent = document.getElementById('history-content');
        const analyticsContainer = document.getElementById('history-analytics');
        
        if (!historyContent) {
            console.error("History content container not found");
            return;
        }
        
        // Show loading
        historyContent.innerHTML = '<div class="empty-state"><p>Loading activity logs...</p></div>';
        
        // Load logs directly
        window.firebaseDb.loadActivityLogs()
            .then(logs => {
                
                if (!logs || logs.length === 0) {
                    historyContent.innerHTML = `
                        <div class="empty-state">
                            <p>No activity logs found. Try making some changes to items.</p>
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
                
                // Clean up older logs
                cleanupOldLogs(logs, fifteenDaysAgo);
                
                // If no recent logs, show empty state
                if (recentLogs.length === 0) {
                    historyContent.innerHTML = `
                        <div class="empty-state">
                            <p>No activity logs found in the last 15 days. Try making some changes to items.</p>
                        </div>
                    `;
                    if (analyticsContainer) {
                        analyticsContainer.innerHTML = '<p>No recent activity data available for analytics.</p>';
                    }
                    return;
                }
                
                // Display logs grouped by date then by action type
                const sortedLogs = [...recentLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                // Group logs by date, then by category
                const dayGroups = {};
                sortedLogs.forEach(log => {
                    const date = new Date(log.timestamp);
                    const dateKey = date.toDateString();
                    if (!dayGroups[dateKey]) {
                        dayGroups[dateKey] = { date, prepped: [], checked: [], other: [] };
                    }
                    if (log.actionType === 'count') {
                        dayGroups[dateKey].checked.push(log);
                    } else if (['prep', 'cantprep', 'canprepagain'].includes(log.actionType)) {
                        dayGroups[dateKey].prepped.push(log);
                    } else {
                        dayGroups[dateKey].other.push(log);
                    }
                });

                // Helper: format a single log item HTML
                function formatLogItem(log) {
                    const logKey = log.key || extractLogKeyFromTimestamp(log.timestamp);
                    const date = new Date(log.timestamp);
                    const timeString = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                    let actionText = '', changeText = '';
                    switch(log.actionType) {
                        case 'count': actionText = 'checked'; changeText = `${log.oldValue} → ${log.newValue} ${log.unit}`; break;
                        case 'prep': actionText = 'prepped'; changeText = `${log.oldValue} → ${log.newValue} ${log.unit}`; break;
                        case 'add': actionText = 'added'; changeText = `Initial: ${log.newValue} ${log.unit}`; break;
                        case 'edit': actionText = 'edited'; changeText = `${log.oldValue} → ${log.newValue} ${log.unit}`; break;
                        case 'delete': actionText = 'deleted'; changeText = `Was: ${log.oldValue} ${log.unit}`; break;
                        case 'cantprep': actionText = 'Can\'t Prep'; changeText = log.reasonText ? `${log.reason}: ${log.reasonText}` : log.reason || 'Reason not specified'; break;
                        case 'canprepagain': actionText = 'Available'; changeText = 'Can now be prepped'; break;
                        case 'test': actionText = 'test'; changeText = `${log.oldValue} → ${log.newValue} ${log.unit}`; break;
                        case 'task-done': actionText = 'completed task'; changeText = ''; break;
                        default: actionText = 'updated'; changeText = `${log.oldValue} → ${log.newValue} ${log.unit}`;
                    }
                    return `<div class="log-item action-${log.actionType}" data-log-key="${logKey}">
                        <div class="log-time">${timeString}</div>
                        <div class="log-user">${log.user}</div>
                        <div class="log-action"><span class="action-label">${actionText}</span><span class="item-name">${log.itemName}</span></div>
                        <div class="log-change">${changeText}</div>
                        <div class="log-delete-icon">&#x2715;</div>
                    </div>`;
                }

                // Build HTML with collapsible groups
                let html = '';
                const groupMeta = [
                    { key: 'prepped', label: 'Prepped', open: false, cssClass: 'group-prepped' },
                    { key: 'checked', label: 'Checked', open: false, cssClass: 'group-checked' },
                    { key: 'other', label: 'Other', open: false, cssClass: 'group-other' }
                ];

                Object.values(dayGroups).forEach(day => {
                    const formattedDate = day.date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                    html += `<div class="day-card">`;
                    html += `<div class="date-header">${formattedDate}</div>`;

                    groupMeta.forEach(g => {
                        const logs = day[g.key];
                        if (logs.length === 0) return;
                        const openAttr = g.open ? ' open' : '';
                        html += `<details class="log-group ${g.cssClass}"${openAttr}>`;
                        html += `<summary class="log-group-header"><span class="log-group-chevron"></span>${g.label} <span class="log-group-count">(${logs.length})</span></summary>`;
                        html += `<div class="log-group-content">`;
                        logs.forEach(log => { html += formatLogItem(log); });
                        html += `</div></details>`;
                    });

                    html += `</div>`;
                });

                // Set HTML
                historyContent.innerHTML = html;
                
                // Add click event listeners for delete functionality
                addDeleteFunctionalityToLogs();
                
                // Update analytics
                if (analyticsContainer) {
                    // Simple analytics (using filtered recent logs)
                    const totalLogs = recentLogs.length;
                    const prepCount = recentLogs.filter(log => log.actionType === 'prep').length;
                    const countCount = recentLogs.filter(log => log.actionType === 'count').length;
                    
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
                                <div class="analytics-value">${prepCount}</div>
                                <div class="analytics-label">Prep Updates</div>
                            </div>
                            <div class="analytics-card">
                                <div class="analytics-value">${countCount}</div>
                                <div class="analytics-label">Count Updates</div>
                            </div>
                        </div>
                        
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
                    `;
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
    
    // Add CSS for delete functionality
    function addDeleteStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .log-item {
                position: relative;
                padding-right: 40px; /* Make space for delete icon */
            }
            .log-delete-icon {
                position: absolute;
                right: 10px;
                top: 50%;
                transform: translateY(-50%);
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #999;
                font-weight: bold;
                cursor: pointer;
                border-radius: 50%;
                opacity: 0.3;
                transition: all 0.2s ease;
            }
            .log-item:hover .log-delete-icon {
                opacity: 1;
                background-color: #f1f1f1;
            }
            .log-delete-icon:hover {
                background-color: #ff5252;
                color: white;
                opacity: 1;
            }
            .delete-confirmation {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
            }
            .delete-confirmation-box {
                background-color: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                max-width: 90%;
                width: 400px;
                text-align: center;
            }
            .delete-confirmation-box h3 {
                margin-top: 0;
                color: #333;
            }
            .delete-confirmation-box p {
                margin-bottom: 20px;
                color: #666;
            }
            .delete-confirmation-buttons {
                display: flex;
                justify-content: center;
                gap: 10px;
            }
            .delete-confirm-btn {
                background-color: #ff5252;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 500;
            }
            .delete-cancel-btn {
                background-color: #f1f1f1;
                color: #333;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 500;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Extract a unique log key from timestamp - used when log.key isn't available
    function extractLogKeyFromTimestamp(timestamp) {
        if (!timestamp) return 'unknown_log';
        // Convert timestamp to a key format (similar to Firebase's auto-generated format)
        // Use the timestamp's milliseconds as part of the key
        const date = new Date(timestamp);
        return `log_${date.getTime()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Add delete functionality to log items
    function addDeleteFunctionalityToLogs() {
        const logItems = document.querySelectorAll('.log-item');
        
        logItems.forEach(item => {
            const deleteIcon = item.querySelector('.log-delete-icon');
            const logKey = item.getAttribute('data-log-key');
            
            if (deleteIcon && logKey) {
                deleteIcon.addEventListener('click', function(e) {
                    e.stopPropagation(); // Prevent event from bubbling
                    showDeleteConfirmation(logKey, item);
                });
            }
        });
    }
    
    // Show delete confirmation dialog
    function showDeleteConfirmation(logKey, logElement) {
        // Create confirmation dialog
        const confirmationDialog = document.createElement('div');
        confirmationDialog.className = 'delete-confirmation';
        
        confirmationDialog.innerHTML = `
            <div class="delete-confirmation-box">
                <h3>Delete Log Entry</h3>
                <p>Are you sure you want to delete this activity log? This action cannot be undone.</p>
                <div class="delete-confirmation-buttons">
                    <button class="delete-cancel-btn">Cancel</button>
                    <button class="delete-confirm-btn">Delete</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(confirmationDialog);
        
        // Handle button clicks
        const cancelBtn = confirmationDialog.querySelector('.delete-cancel-btn');
        const confirmBtn = confirmationDialog.querySelector('.delete-confirm-btn');
        
        const handleDelete = () => {
            deleteLogEntry(logKey, logElement);
            document.body.removeChild(confirmationDialog);
        };
        
        const handleCancel = () => {
            document.body.removeChild(confirmationDialog);
        };
        
        cancelBtn.addEventListener('click', handleCancel);
        confirmBtn.addEventListener('click', handleDelete);
        
        // Add keyboard support
        confirmationDialog.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleDelete();
            } else if (e.key === 'Escape') {
                handleCancel();
            }
        });
        
        // Close when clicking outside the box
        confirmationDialog.addEventListener('click', function(e) {
            if (e.target === confirmationDialog) {
                handleCancel();
            }
        });
        
        // Focus the dialog to enable keyboard events
        confirmationDialog.setAttribute('tabindex', '-1');
        confirmationDialog.focus();
    }
    
    // Delete a log entry from Firebase
    function deleteLogEntry(logKey, logElement) {
        if (!window.firebaseDb || typeof window.firebaseDb.deleteActivityLog !== 'function') {
            console.error("Delete function not available");
            showErrorMessage("Delete function not available");
            return;
        }
        
        // Show loading state
        logElement.style.opacity = "0.5";
        
        window.firebaseDb.deleteActivityLog(logKey)
            .then(() => {
                // Remove the log item from the UI with animation
                logElement.style.height = logElement.offsetHeight + 'px';
                logElement.style.overflow = 'hidden';
                logElement.style.transition = 'all 0.3s ease-out';
                
                setTimeout(() => {
                    logElement.style.height = '0';
                    logElement.style.padding = '0';
                    logElement.style.margin = '0';
                    
                    setTimeout(() => {
                        if (logElement.parentNode) {
                            logElement.parentNode.removeChild(logElement);
                        }
                        
                        // Show success notification
                        showSuccessMessage("Log entry deleted successfully");
                        
                        // Check if we need to update analytics
                        const historyContent = document.getElementById('history-content');
                        const remainingItems = historyContent.querySelectorAll('.log-item');
                        
                        if (remainingItems.length === 0) {
                            // If no items left, reload to show empty state
                            loadAndDisplayLogs();
                        }
                    }, 300);
                }, 10);
            })
            .catch(error => {
                console.error(`Error deleting log: ${error}`);
                // Reset opacity
                logElement.style.opacity = "1";
                // Show error notification
                showErrorMessage("Failed to delete log entry");
            });
    }
    
    // showNotification is now in notifications.js
    
    // Delete logs older than 15 days
    function cleanupOldLogs(logs, cutoffDate) {
        // Only proceed if deleteActivityLog is available
        if (!window.firebaseDb || typeof window.firebaseDb.deleteActivityLog !== 'function') {
            return Promise.resolve();
        }
        
        // Find logs older than the cutoff date
        const oldLogs = logs.filter(log => {
            const logDate = new Date(log.timestamp);
            return logDate < cutoffDate;
        });
        
        if (oldLogs.length === 0) {
            return Promise.resolve();
        }
        
        
        // Extract log keys - this depends on how keys are stored
        // If the logs have an explicit 'key' property, use that
        const deletePromises = [];
        
        oldLogs.forEach(log => {
            if (log.key) {
                // If the log object has its key stored
                deletePromises.push(window.firebaseDb.deleteActivityLog(log.key));
            } else {
                // Try to delete using our best guess of the key format
                const logKey = extractLogKeyFromTimestamp(log.timestamp);
                if (logKey && logKey !== 'unknown_log') {
                    deletePromises.push(window.firebaseDb.deleteActivityLog(logKey));
                } else {
                }
            }
        });
        
        if (deletePromises.length === 0) {
            return Promise.resolve();
        }
        
        return Promise.all(deletePromises)
            .then(() => {
            })
            .catch(error => {
                console.error("Error deleting old logs:", error);
            });
    }
    
    // Setup navigation event listener
    function setupHistoryNavigation() {
        const historyButton = document.querySelector('.nav-button[data-section="history"]');
        if (historyButton) {
            const originalClick = historyButton.onclick;
            
            historyButton.addEventListener('click', function() {
                setTimeout(loadAndDisplayLogs, 100);
            });
        }
    }
    
    // Initialize CSS styles for delete functionality
    addDeleteStyles();
    
    // Initialize history
    setupHistoryNavigation();
    
    // If history section is already visible, load logs
    const historySection = document.getElementById('history-section');
    if (historySection && historySection.style.display !== 'none') {
        setTimeout(loadAndDisplayLogs, 500);
    }
    
    // Also expose for manual testing
    window.loadHistoryLogs = loadAndDisplayLogs;
});

// Keep API compatible with existing code
window.historySystem = {
    init: function() { },
    logQuantityChange: function(itemId, itemName, oldValue, newValue, unit, user, actionType) {
        
        const activity = {
            timestamp: new Date().toISOString(),
            user: user,
            itemId: itemId,
            itemName: itemName,
            actionType: actionType,
            oldValue: oldValue,
            newValue: newValue,
            unit: unit
        };
        
        if (window.firebaseDb && typeof window.firebaseDb.saveActivityLog === 'function') {
            return window.firebaseDb.saveActivityLog(activity);
        }
        
        return Promise.resolve();
    },
    logItemModification: function(item, user, actionType, oldItem) {
        
        let activity = {
            timestamp: new Date().toISOString(),
            user: user,
            itemId: item.id,
            itemName: item.name,
            actionType: actionType,
            unit: item.unit // Keep unit for potential future use or consistency
        };

        if (actionType === 'cantprep') {
            activity.reason = item.cantPrepReason;
            activity.reasonText = item.cantPrepReasonText;
            // For 'cantprep', oldValue and newValue might not be directly relevant in the same way.
            // We're logging the *state* of not being able to prep.
            activity.oldValue = null; 
            activity.newValue = null;
        } else if (actionType === 'canprepagain') {
            // For 'canprepagain', the key info is the item becoming available.
            activity.oldValue = null;
            activity.newValue = null;
        } else {
            // Default handling for other modification types like 'edit', 'delete'
            activity.oldValue = oldItem ? oldItem.currentLevel : null;
            activity.newValue = actionType === 'delete' ? null : item.currentLevel;
        }
        
        if (window.firebaseDb && typeof window.firebaseDb.saveActivityLog === 'function') {
            return window.firebaseDb.saveActivityLog(activity);
        }
        
        return Promise.resolve();
    },
    renderActivityLogs: function() { },
    loadActivityLogs: function() { 
        if (window.firebaseDb && typeof window.firebaseDb.loadActivityLogs === 'function') {
            return window.firebaseDb.loadActivityLogs();
        }
        return Promise.resolve([]);
    }
};