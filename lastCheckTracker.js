// Last Check Tracker - Isolated feature for tracking last complete prep check

const LastCheckTracker = {
    // State
    state: {
        lastCheckTimestamp: null,
        staffName: '',
        isFullCheck: false,
        updateInterval: null
    },

    // Time thresholds in hours
    thresholds: {
        green: 3,    // 0-3 hours: green
        yellow: 5,   // 3-5 hours: yellow
        orange: 8    // 5-8 hours: orange
                     // 8+ hours: red
    },

    // Color codes
    colors: {
        green: '#22c55e',
        yellow: '#ca8a04',
        orange: '#f97316',
        red: '#ef4444'
    },

    // Error handling helper
    handleError(error, context, showNotification = true) {
        console.error(`LastCheckTracker Error (${context}):`, error);
        
        if (showNotification) {
            this.showNotification(
                'Error syncing check time',
                'Using last known data',
                'error'
            );
        }
    },

    // Notification helper
    showNotification(title, message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `check-tracker-notification ${type}`;
        notification.innerHTML = `
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        `;
        
        // Add styles if not already added
        if (!document.getElementById('check-tracker-notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'check-tracker-notification-styles';
            styles.textContent = `
                .check-tracker-notification {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    padding: 15px 20px;
                    border-radius: 8px;
                    background: white;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    z-index: 1000;
                    animation: slideIn 0.3s ease-out;
                }
                .check-tracker-notification.error {
                    border-left: 4px solid #ef4444;
                }
                .check-tracker-notification.warning {
                    border-left: 4px solid #f97316;
                }
                .check-tracker-notification.success {
                    border-left: 4px solid #22c55e;
                }
                .notification-title {
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                @keyframes slideIn {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(notification);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (document.body.contains(notification)) {
                notification.style.animation = 'slideOut 0.3s ease-in';
                setTimeout(() => {
                    if (document.body.contains(notification)) {
                        document.body.removeChild(notification);
                    }
                }, 300);
            }
        }, 5000);
    },

    // Initialize the tracker with error handling
    async init() {
        try {
            this.createStatusElement();
            console.log("[LCT] Initializing. Checking Firebase availability...");
            
            if (window.firebaseDb && typeof window.firebaseDb.ref === 'function') {
                console.log("[LCT] Firebase is available. Attempting to load initial data.");
            const loadDataPromise = this.loadLastCheckData();
            const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('[LCT] Firebase loading timeout after 10s')), 10000)
            );
            
            await Promise.race([loadDataPromise, timeoutPromise]);
            
            this.startPeriodicUpdate();
            this.updateDisplay();

                console.log("[LCT] Setting up Firebase listener for /lastCompleteCheck.");
                const lastCheckRef = window.firebaseDb.ref('lastCompleteCheck');
                window.firebaseDb.onValue(lastCheckRef, 
                    (snapshot) => {
                        try {
                            const data = snapshot.val();
                            console.log("[LCT] Firebase listener: Data received:", data);
                            if (data) {
                                this.state.lastCheckTimestamp = new Date(data.timestamp);
                                this.state.staffName = data.staffName;
                                this.state.isFullCheck = data.isFullCheck;
                                this.updateDisplay();
                                this.saveToLocalStorage(); // Keep localStorage in sync
                                console.log("[LCT] Firebase listener: State updated and saved to localStorage.");
                            } else {
                                console.log("[LCT] Firebase listener: No data received or data is null.");
                            }
                        } catch (error) {
                            this.handleError(error, 'Firebase listener value processing');
                        }
                    },
                    (error) => {
                        this.handleError(error, 'Firebase listener setup (on failure)');
                    }
                );
            } else {
                console.warn("[LCT] Firebase (window.firebaseDb.ref) not available at init. Falling back to localStorage.");
                this.loadFromLocalStorage();
                this.updateDisplay(); // Update display with localStorage data
                this.startPeriodicUpdate(); // Still start periodic updates for local time
            }
        } catch (error) {
            this.handleError(error, 'Initialization');
            console.warn("[LCT] Error during init, attempting to load from localStorage as final fallback.");
            // Still try to show something using localStorage
            this.loadFromLocalStorage();
            this.updateDisplay();
        }
    },

    // Create the status element in the DOM
    createStatusElement() {
        const statsGrid = document.querySelector('.stats-grid');
        if (!statsGrid) return;

        const statusCard = document.createElement('div');
        statusCard.className = 'stat-card last-check-status';
        statusCard.innerHTML = `
            <div class="stat-label">Last Full Check</div>
            <div class="stat-value" id="last-check-time">Never</div>
        `;
        statsGrid.appendChild(statusCard);

        // Add styles
        const styleSheet = document.createElement('style');
        styleSheet.textContent = `
            .last-check-status {
                transition: background-color 0.3s ease;
                flex: 1;
            }
            .last-check-status .stat-value {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
        `;
        document.head.appendChild(styleSheet);
    },

    // Load data with enhanced error handling
    async loadLastCheckData() {
        try {
            console.log("[LCT] loadLastCheckData: Attempting to load from Firebase.");
            if (!window.firebaseDb || typeof window.firebaseDb.ref !== 'function' || typeof window.firebaseDb.get !== 'function') {
                throw new Error('[LCT] Firebase (window.firebaseDb.ref or window.firebaseDb.get) not available for loading.');
            }

            const dbRef = window.firebaseDb.ref('lastCompleteCheck'); // Get the reference
            const snapshot = await window.firebaseDb.get(dbRef); // Pass reference to window.firebaseDb.get
            const data = snapshot.val();
            console.log("[LCT] loadLastCheckData: Data from Firebase:", data);
            
            if (data) {
                // Validate timestamp
                const timestamp = new Date(data.timestamp);
                if (isNaN(timestamp.getTime())) {
                    throw new Error('Invalid timestamp in Firebase data');
                }

                this.state.lastCheckTimestamp = timestamp;
                this.state.staffName = data.staffName || 'Unknown';
                this.state.isFullCheck = Boolean(data.isFullCheck);
                this.saveToLocalStorage();
                
                this.showNotification(
                    'Sync Complete',
                    'Check times synchronized with server',
                    'success'
                );
            }
        } catch (error) {
            this.handleError(error, 'Loading data');
            // Try localStorage as fallback
            this.loadFromLocalStorage();
        }
    },

    // Save with enhanced error handling
    async saveLastCheckData() {
        const dataToSave = {
            timestamp: this.state.lastCheckTimestamp.toISOString(),
            staffName: this.state.staffName,
            isFullCheck: this.state.isFullCheck
        };
        console.log("[LCT] saveLastCheckData: Attempting to save to Firebase:", dataToSave);

        try {
            if (!window.firebaseDb || typeof window.firebaseDb.ref !== 'function' || typeof window.firebaseDb.set !== 'function') {
                throw new Error('[LCT] Firebase (window.firebaseDb.ref or window.firebaseDb.set) not available for saving.');
            }

            // Use window.firebaseDb.set with the reference and data
            await window.firebaseDb.set(window.firebaseDb.ref('lastCompleteCheck'), dataToSave);
            this.saveToLocalStorage(); // Keep localStorage in sync
            console.log("[LCT] saveLastCheckData: Successfully saved to Firebase and localStorage.");
            
            this.showNotification(
                'Check Time Saved',
                'Successfully updated on server',
                'success'
            );
        } catch (error) {
            this.handleError(error, 'Saving data');
            // Still save to localStorage
            this.saveToLocalStorage();
            
            this.showNotification(
                'Offline Mode',
                'Changes saved locally, will sync when online',
                'warning'
            );
        }
    },

    // Save to localStorage
    saveToLocalStorage() {
        const dataToSave = {
            timestamp: this.state.lastCheckTimestamp ? this.state.lastCheckTimestamp.toISOString() : null,
            staffName: this.state.staffName,
            isFullCheck: this.state.isFullCheck
        };
        console.log("[LCT] saveToLocalStorage: Saving data:", dataToSave);
        localStorage.setItem('lastCompleteCheckData', JSON.stringify(dataToSave));
    },

    // Load from localStorage
    loadFromLocalStorage() {
        console.log("[LCT] loadFromLocalStorage: Attempting to load.");
        const storedData = localStorage.getItem('lastCompleteCheckData');
        if (storedData) {
            try {
                const data = JSON.parse(storedData);
                console.log("[LCT] loadFromLocalStorage: Data found:", data);
                if (data.timestamp) {
            this.state.lastCheckTimestamp = new Date(data.timestamp);
                } else {
                    this.state.lastCheckTimestamp = null; // Handle case where timestamp might be null
                }
                this.state.staffName = data.staffName || '';
                this.state.isFullCheck = data.isFullCheck || false;
                console.log("[LCT] loadFromLocalStorage: State updated.");
                return true;
            } catch (error) {
                console.error("[LCT] loadFromLocalStorage: Error parsing data:", error, storedData);
                localStorage.removeItem('lastCompleteCheckData'); // Clear corrupted data
                return false;
            }
        }
        console.log("[LCT] loadFromLocalStorage: No data found.");
        return false;
    },

    // Record check with validation
    async recordCompleteCheck(staffName) {
        console.log(`[LCT] recordCompleteCheck: Called for staff: ${staffName}`);
        try {
            if (!staffName) {
                throw new Error('Staff name is required');
            }

            this.state.lastCheckTimestamp = new Date();
            this.state.staffName = staffName;
            this.state.isFullCheck = true;
            
            await this.saveLastCheckData();
            this.updateDisplay();
        } catch (error) {
            this.handleError(error, 'Recording check');
        }
    },

    // Calculate hours since last check
    getHoursSinceLastCheck() {
        if (!this.state.lastCheckTimestamp) return Infinity;
        
        const now = new Date();
        const diff = now - this.state.lastCheckTimestamp;
        return diff / (1000 * 60 * 60); // Convert milliseconds to hours
    },

    // Get status color based on hours elapsed
    getStatusColor(hours) {
        if (hours < this.thresholds.green) return this.colors.green;
        if (hours < this.thresholds.yellow) return this.colors.yellow;
        if (hours < this.thresholds.orange) return this.colors.orange;
        return this.colors.red;
    },

    // Format the time display (make it more compact)
    formatTimeDisplay(hours) {
        if (!this.state.lastCheckTimestamp) return 'Never';
        
        if (hours < 1) {
            const minutes = Math.round(hours * 60);
            return `${minutes}m ago`;
        }
        
        const roundedHours = Math.round(hours * 10) / 10;
        return `${roundedHours}h ago`;
    },

    // Update the display
    updateDisplay() {
        const statusElement = document.getElementById('last-check-time');
        if (!statusElement) return;

        const hours = this.getHoursSinceLastCheck();
        const color = this.getStatusColor(hours);
        const timeText = this.formatTimeDisplay(hours);

        statusElement.textContent = timeText;
        statusElement.closest('.stat-card').style.backgroundColor = color;
        // Add text color adjustment for better contrast
        statusElement.closest('.stat-card').style.color = hours >= this.thresholds.orange ? '#fff' : '#000';
    },

    // Start periodic updates
    startPeriodicUpdate() {
        // Clear any existing interval
        if (this.state.updateInterval) {
            clearInterval(this.state.updateInterval);
        }

        // Update every 3 minutes
        this.state.updateInterval = setInterval(() => {
            this.updateDisplay();
        }, 3 * 60 * 1000); // 3 minutes in milliseconds
    },

    // Enhanced destroy method
    destroy() {
        try {
            if (window.firebaseDb) {
                window.firebaseDb.ref('lastCompleteCheck').off();
            }
            if (this.state.updateInterval) {
                clearInterval(this.state.updateInterval);
            }
        } catch (error) {
            this.handleError(error, 'Cleanup', false);
        }
    }
};

// Export for use in main script
window.LastCheckTracker = LastCheckTracker; 