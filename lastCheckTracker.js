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
            showNotification(
                'Error syncing check time',
                'Using last known data',
                'error'
            );
        }
    },

    // Uses global showNotification from notifications.js

    // Initialize the tracker with error handling
    async init() {
        try {
            this.createStatusElement();
            
            if (window.firebaseDb && typeof window.firebaseDb.ref === 'function') {
            const loadDataPromise = this.loadLastCheckData();
            const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('[LCT] Firebase loading timeout after 10s')), 10000)
            );
            
            await Promise.race([loadDataPromise, timeoutPromise]);
            
            this.startPeriodicUpdate();
            this.updateDisplay();

                const lastCheckRef = window.firebaseDb.ref('lastCompleteCheck');
                window.firebaseDb.onValue(lastCheckRef, 
                    (snapshot) => {
                        try {
                            const data = snapshot.val();
                            if (data) {
                                this.state.lastCheckTimestamp = new Date(data.timestamp);
                                this.state.staffName = data.staffName;
                                this.state.isFullCheck = data.isFullCheck;
                                this.updateDisplay();
                                this.saveToLocalStorage(); // Keep localStorage in sync
                            } else {
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

    // Status element already exists in HTML (#last-check-card with #last-check-value and #last-check-by)
    createStatusElement() {
        // No-op: using existing HTML elements
    },

    // Load data with enhanced error handling
    async loadLastCheckData() {
        try {
            if (!window.firebaseDb || typeof window.firebaseDb.ref !== 'function' || typeof window.firebaseDb.get !== 'function') {
                throw new Error('[LCT] Firebase (window.firebaseDb.ref or window.firebaseDb.get) not available for loading.');
            }

            const dbRef = window.firebaseDb.ref('lastCompleteCheck'); // Get the reference
            const snapshot = await window.firebaseDb.get(dbRef); // Pass reference to window.firebaseDb.get
            const data = snapshot.val();
            
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
                
                showNotification(
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

        try {
            if (!window.firebaseDb || typeof window.firebaseDb.ref !== 'function' || typeof window.firebaseDb.set !== 'function') {
                throw new Error('[LCT] Firebase (window.firebaseDb.ref or window.firebaseDb.set) not available for saving.');
            }

            // Use window.firebaseDb.set with the reference and data
            await window.firebaseDb.set(window.firebaseDb.ref('lastCompleteCheck'), dataToSave);
            this.saveToLocalStorage(); // Keep localStorage in sync
            
            showNotification(
                'Check Time Saved',
                'Successfully updated on server',
                'success'
            );
        } catch (error) {
            this.handleError(error, 'Saving data');
            // Still save to localStorage
            this.saveToLocalStorage();
            
            showNotification(
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
        localStorage.setItem('lastCompleteCheckData', JSON.stringify(dataToSave));
    },

    // Load from localStorage
    loadFromLocalStorage() {
        const storedData = localStorage.getItem('lastCompleteCheckData');
        if (storedData) {
            try {
                const data = JSON.parse(storedData);
                if (data.timestamp) {
            this.state.lastCheckTimestamp = new Date(data.timestamp);
                } else {
                    this.state.lastCheckTimestamp = null; // Handle case where timestamp might be null
                }
                this.state.staffName = data.staffName || '';
                this.state.isFullCheck = data.isFullCheck || false;
                return true;
            } catch (error) {
                console.error("[LCT] loadFromLocalStorage: Error parsing data:", error, storedData);
                localStorage.removeItem('lastCompleteCheckData'); // Clear corrupted data
                return false;
            }
        }
        return false;
    },

    // Record check with validation
    async recordCompleteCheck(staffName) {
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
        const valueEl = document.getElementById('last-check-value');
        const byEl = document.getElementById('last-check-by');
        const cardEl = document.getElementById('last-check-card');
        if (!valueEl) return;

        const hours = this.getHoursSinceLastCheck();
        const timeText = this.formatTimeDisplay(hours);

        valueEl.textContent = timeText;
        if (byEl) {
            byEl.textContent = this.state.lastCheckTimestamp && this.state.staffName
                ? 'by ' + this.state.staffName
                : '';
        }
        // Pastel background that shifts as time passes (stays readable)
        if (cardEl && this.state.lastCheckTimestamp) {
            cardEl.style.borderLeft = '';
            cardEl.style.background = this.getPastelBackground(hours);
        }
    },

    // Interpolate pastel background through green → yellow → orange → red
    getPastelBackground(hours) {
        // Pastel color stops (light enough to keep text readable)
        const stops = [
            { h: 0,  c1: [230, 247, 238], c2: [212, 240, 224] }, // green  #e6f7ee → #d4f0e0
            { h: 3,  c1: [254, 249, 219], c2: [253, 243, 192] }, // yellow #fef9db → #fdf3c0
            { h: 5,  c1: [255, 237, 213], c2: [254, 223, 186] }, // orange #ffedd5 → #fedfba
            { h: 8,  c1: [254, 226, 226], c2: [252, 207, 207] }  // red    #fee2e2 → #fccfcf
        ];
        // Clamp to last stop if beyond
        let lo = stops[0], hi = stops[stops.length - 1];
        for (let i = 0; i < stops.length - 1; i++) {
            if (hours >= stops[i].h && hours < stops[i + 1].h) {
                lo = stops[i]; hi = stops[i + 1]; break;
            }
            if (hours >= stops[stops.length - 1].h) { lo = hi = stops[stops.length - 1]; }
        }
        const range = hi.h - lo.h;
        const t = range === 0 ? 0 : Math.min(1, Math.max(0, (hours - lo.h) / range));
        const lerp = (a, b) => Math.round(a + (b - a) * t);
        const c1 = [lerp(lo.c1[0], hi.c1[0]), lerp(lo.c1[1], hi.c1[1]), lerp(lo.c1[2], hi.c1[2])];
        const c2 = [lerp(lo.c2[0], hi.c2[0]), lerp(lo.c2[1], hi.c2[1]), lerp(lo.c2[2], hi.c2[2])];
        return `linear-gradient(135deg, rgb(${c1.join(',')}) 0%, rgb(${c2.join(',')}) 100%)`;
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