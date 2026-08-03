document.addEventListener('DOMContentLoaded', function() {
    
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
    const checkProgressElement = document.getElementById('check-progress');
    const checkItemNameElement = document.getElementById('check-item-name');
    const checkItemTargetElement = document.getElementById('check-item-target');
    const currentLevelInput = document.getElementById('current-level-input');
    const currentValueDisplay = document.getElementById('current-value');
    
    // Dashboard elements
    const totalItemsElement = document.getElementById('total-items');
    const itemsBelowFiftyElement = document.getElementById('items-below-fifty');
    const dashboardLocationFilter = document.getElementById('dashboard-location-filter');
    const lowStockContainer = document.getElementById('low-stock-container');
    const lowStockTitle = document.getElementById('low-stock-title');
    const countCardLabel = document.getElementById('count-card-label');
    const countPreviewList = document.getElementById('count-preview-list');
    
    // Application state
    let currentStaff = '';
    // Keep this local mirror in sync with the shared session (single source of truth).
    if (window.UserSession) UserSession.subscribe(function (n) { currentStaff = n; });
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
    
    // The login gate is UserSession.renderGate (user.js) — this module used to
    // build its own grid, with the loading line styled inline in JS.
    function loadStaffMembers() {
        UserSession.renderGate(staffGrid, showMainInterface);
    }

    // Reveal the app once someone is identified. renderGate/dropdown have already
    // set the session by the time this runs.
    function showMainInterface() {
        if (staffSelection) staffSelection.style.display = 'none';
        if (mainInterface) mainInterface.style.display = 'flex';

        // Load items
        loadItems();
    }
    
    // Load inventory items from Firebase
    function loadItems() {
        
        if (window.firebaseDb && window.firebaseDb.loadIcItems) {
            window.firebaseDb.loadIcItems()
                .then(items => {
                    window.icItems = items;
                    
                    // Extract locations and sublocations
                    extractLocationsAndSublocations();
                    
                    // Update UI
                    updateLocationFilters();
                    updateDashboardLists();
                    updateStats();
                    
                    // Set up real-time updates
                    setupRealtimeUpdates();

                    // Open supplier claims (ordered, never delivered)
                    refreshDeliveryIssues();
                    
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
        
    }
    
    // Update location filter buttons — every filter row is built identically,
    // so they share one builder instead of a copy per row
    function updateLocationFilters() {
        const filterRows = [
            dashboardLocationFilter,
            document.getElementById('overview-location-filter')
        ];
        const locations = [...allLocations].sort();

        filterRows.forEach(row => {
            if (!row) return;
            row.innerHTML = '';

            locations.forEach(location => {
                const button = document.createElement('button');
                button.className = 'location-button';
                if (location === currentLocation) {
                    button.classList.add('active');
                }
                button.textContent = location;
                button.setAttribute('data-location', location);
                button.addEventListener('click', () => changeLocation(location));
                row.appendChild(button);
            });
        });
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
        updateDashboardLists();
        
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
    
    // formatDate is now the shared helper in ui-helpers.js ("9 Mar, 14:30").

    // fmtQty: drop a trailing ".0" on whole counts ("8.0" -> "8"), keep real
    // fractions ("1.1" stays "1.1"). pluralizeUnit now lives in ui-helpers.js —
    // the history wording needs it too, and one copy per module is how the
    // renderers drifted in the first place.
    function fmtQty(n) {
        return Number((Number(n) || 0).toFixed(1)).toString();
    }

    // Log activity changes to Firebase
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
                .catch(error => {
                    console.error("Error logging activity:", error);
                });
        }
    }

    // saveData is built from the shared makeSaver (ui-helpers.js). Writes only
    // the changed item when passed one (concurrent-safe); else the whole array.
    const saveData = makeSaver({
        key: 'icItems',
        getItems: function () { return window.icItems; },
        one: 'saveIcItem',
        all: 'saveAllIcItems',
        onError: function (msg) {
            if (typeof showMessage === 'function') showMessage(msg, 'error');
        }
    });

    // ---------------------------------------------------------------------
    // Ordered / Received (stock vs on the way)
    //
    // An item carries TWO distinct quantities:
    //   currentLevel = what is physically on the shelf
    //   pendingQty   = what has been ordered and has not arrived yet
    // Merging them (the old reflex: "2 in stock + 3 ordered -> I type 5") makes
    // the stock lie for a whole week as soon as a delivery is missed. Ordering
    // therefore never touches currentLevel; only a count or a reception does.
    // An item without pendingQty behaves exactly as before -> no migration.
    // ---------------------------------------------------------------------

    function pendingQtyOf(item) {
        return parseFloat(item && item.pendingQty) || 0;
    }

    function pendingItems() {
        return (window.icItems || []).filter(it => pendingQtyOf(it) > 0);
    }

    // Single logging entry point for the order/receive events: same shape as
    // logActivityChange, plus optional extra fields, and always a .catch.
    function logIcEvent(item, actionType, oldValue, newValue, extra) {
        if (!window.firebaseDb || typeof window.firebaseDb.saveIcActivityLog !== 'function') {
            return Promise.resolve();
        }
        const activity = Object.assign({
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
        }, extra || {});

        return window.firebaseDb.saveIcActivityLog(activity)
            .catch(error => {
                console.error('Error logging ' + actionType + ':', error);
                showMessage('Saved, but the activity log failed', 'warning');
            });
    }

    // "N items on the way" + the button that opens the reception screen.
    // Rendered into every .pending-banner (dashboard + overview) so the reminder
    // is visible wherever Serge happens to be.
    function renderPendingBanners() {
        const banners = document.querySelectorAll('.pending-banner');
        if (!banners.length) return;

        const waiting = pendingItems();
        banners.forEach(el => {
            if (waiting.length === 0) {
                el.style.display = 'none';
                el.innerHTML = '';
                return;
            }
            el.style.display = '';
            el.innerHTML = `
                <span class="pending-banner__text">
                    🚚 <strong>${waiting.length}</strong> ${waiting.length > 1 ? 'items' : 'item'} on the way
                </span>
                <button type="button" class="btn btn--primary pending-banner__btn">Receive delivery</button>
            `;
            const btn = el.querySelector('.pending-banner__btn');
            if (btn) btn.addEventListener('click', showReceptionModal);
        });
    }

    // Reception screen: every line pre-filled with received = ordered, so the
    // nominal case (everything arrived) is ONE button. Only exceptions are typed.
    // What is missing goes to deliveryIssues -> the supplier claim list writes itself.
    function showReceptionModal() {
        const waiting = pendingItems();
        if (waiting.length === 0) {
            showMessage('Nothing on the way right now', 'info');
            return;
        }
        SoundFX.pop();

        // The step follows what was ORDERED, not the shelf granularity: a delivery
        // arrives in the units that were ordered, so 3 bags steps 3 → 2 → 1 → 0
        // even when the item itself is counted in halves.
        const draft = waiting.map(it => {
            const ordered = pendingQtyOf(it);
            const isFraction = Math.abs(ordered - Math.round(ordered)) > 1e-9;
            return { item: it, ordered: ordered, received: ordered, step: isFraction ? 0.5 : 1 };
        });

        const { box: content, close: closeModal } = openModal({ boxClass: 'modal-box--wide' });

        content.innerHTML = `
            <div style="margin-bottom: 15px;">
                <h3 style="margin: 0; color: var(--primary-dark); font-size: 22px;">🚚 Receive delivery</h3>
                <p style="margin: 8px 0 0 0; color: var(--text-medium); font-size: 14px;">
                    Everything is pre-filled as fully received — adjust only what is missing.
                </p>
            </div>
            <div class="receive-list" id="receive-list"></div>
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button type="button" id="receive-cancel" class="btn btn--secondary">Cancel</button>
                <button type="button" id="receive-all" class="btn btn--primary" style="flex: 2;">✓ Validate reception</button>
            </div>
        `;

        const list = content.querySelector('#receive-list');

        function renderRows() {
            list.innerHTML = '';
            draft.forEach((row, i) => {
                const missing = Math.round((row.ordered - row.received) * 100) / 100;
                const el = document.createElement('div');
                el.className = 'receive-row' + (missing > 0 ? ' receive-row--short' : '');
                el.innerHTML = `
                    <div class="receive-row__main">
                        <span class="receive-row__mark">${missing > 0 ? '⚠' : '✓'}</span>
                        <span class="receive-row__name">${row.item.name}</span>
                    </div>
                    <div class="receive-row__qty">
                        <button type="button" class="receive-step" data-i="${i}" data-d="-1" aria-label="one less">−</button>
                        <span class="receive-row__val">${fmtQty(row.received)}</span>
                        <span class="receive-row__of">/ ${fmtQty(row.ordered)} ${row.item.unit}</span>
                        <button type="button" class="receive-step" data-i="${i}" data-d="1" aria-label="one more">+</button>
                    </div>
                    ${missing > 0
                        ? `<div class="receive-row__missing">${fmtQty(missing)} ${pluralizeUnit(row.item.unit, missing)} missing → claim</div>`
                        : ''}
                `;
                list.appendChild(el);
            });

            list.querySelectorAll('.receive-step').forEach(btn => {
                btn.addEventListener('click', () => {
                    const row = draft[parseInt(btn.dataset.i, 10)];
                    const delta = parseInt(btn.dataset.d, 10) * row.step;
                    // Received can never be negative, nor exceed what was ordered:
                    // an over-delivery is a different event, not a reception.
                    row.received = Math.min(row.ordered, Math.max(0, row.received + delta));
                    SoundFX.pop();
                    renderRows();
                });
            });
        }
        renderRows();

        content.querySelector('#receive-cancel').addEventListener('click', () => closeModal());

        content.querySelector('#receive-all').addEventListener('click', () => {
            const btn = content.querySelector('#receive-all');
            btn.disabled = true;
            applyReception(draft)
                .then(missingCount => {
                    SoundFX.complete();
                    showMessage(
                        missingCount > 0
                            ? `Delivery recorded — ${missingCount} line${missingCount > 1 ? 's' : ''} short, added to the claim list`
                            : 'Delivery recorded — everything received',
                        missingCount > 0 ? 'warning' : 'success'
                    );
                    closeModal();
                })
                .catch(error => {
                    console.error('Error recording reception:', error);
                    showMessage('Error recording the delivery — nothing was lost, try again', 'error');
                    btn.disabled = false;
                });
        });
    }

    // Writes the reception: stock += received, pending cleared, one log per line,
    // and a deliveryIssues entry for every short line. Resolves with how many
    // lines came up short.
    //
    // The stock write goes through saveAllIcItems (a single multi-path update) so
    // the whole delivery lands atomically — a half-written reception would leave
    // some items credited and others still "on the way". saveData() is bypassed
    // on purpose here: it swallows its own errors and returns nothing, which would
    // let a failed write report success. Local state is rolled back if it fails.
    function applyReception(draft) {
        const snapshot = draft.map(row => ({
            row: row,
            before: {
                currentLevel: row.item.currentLevel,
                pendingQty: row.item.pendingQty,
                pendingAt: row.item.pendingAt,
                pendingProvider: row.item.pendingProvider,
                lastCheckedBy: row.item.lastCheckedBy,
                lastCheckedTime: row.item.lastCheckedTime
            }
        }));

        const now = new Date().toISOString();
        const touched = [];
        const shortLines = [];

        draft.forEach(row => {
            const item = row.item;
            const stockBefore = parseFloat(item.currentLevel) || 0;
            const missing = Math.round((row.ordered - row.received) * 100) / 100;

            row.stockBefore = stockBefore;
            row.orderedAt = item.pendingAt || '';
            row.provider = item.pendingProvider || '';
            row.missing = missing;

            item.currentLevel = Math.round((stockBefore + row.received) * 100) / 100;
            item.pendingQty = 0;
            item.pendingAt = null;
            item.pendingProvider = null;
            item.lastCheckedBy = currentStaff;
            item.lastCheckedTime = now;

            touched.push(item);
            if (missing > 0) shortLines.push(row);
        });

        const db = window.firebaseDb;
        const stockWrite = (db && typeof db.saveAllIcItems === 'function')
            ? db.saveAllIcItems(touched)
            : Promise.resolve();

        return stockWrite
            .then(() => {
                try { localStorage.setItem('icItems', JSON.stringify(window.icItems || [])); } catch (e) {}

                // Logs and claim entries are secondary: each swallows its own error
                // with a warning toast so a failed log never rolls back a good stock.
                draft.forEach(row => {
                    logIcEvent(row.item, 'receive', row.stockBefore, row.item.currentLevel, {
                        orderedQty: row.ordered,
                        receivedQty: row.received
                    });
                });

                shortLines.forEach(row => {
                    logIcEvent(row.item, 'not-delivered', row.ordered, row.received, {
                        missingQty: row.missing,
                        provider: row.provider
                    });

                    if (!db || typeof db.saveDeliveryIssue !== 'function') return;
                    const issue = {
                        id: 'issue_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
                        itemId: row.item.id,
                        itemName: row.item.name,
                        unit: row.item.unit || '',
                        provider: row.provider,
                        orderedQty: row.ordered,
                        receivedQty: row.received,
                        missingQty: row.missing,
                        orderedAt: row.orderedAt,
                        reportedAt: now,
                        reportedBy: currentStaff,
                        resolved: false
                    };
                    db.saveDeliveryIssue(issue).catch(error => {
                        console.error('Error saving delivery issue:', error);
                        showMessage('Stock updated, but the claim entry failed for ' + row.item.name, 'warning');
                    });
                });

                updateDashboardLists();
                updateStats();
                if (typeof updateOverviewTable === 'function') updateOverviewTable();
                renderPendingBanners();
                // Re-read so the claims card shows what this delivery just added.
                if (shortLines.length > 0) refreshDeliveryIssues();
                return shortLines.length;
            })
            .catch(error => {
                // Put the items back exactly as they were: the UI must never show a
                // reception that did not reach the server.
                snapshot.forEach(s => Object.assign(s.row.item, s.before));
                throw error;
            });
    }

    // --- Supplier claims --------------------------------------------------
    // Every short line recorded at reception lands in deliveryIssues. This card
    // is the readable side of it: the list to raise with the supplier, and the
    // "settled" button once it has been credited or redelivered.
    let openClaims = [];

    function refreshDeliveryIssues() {
        if (!window.firebaseDb || typeof window.firebaseDb.loadDeliveryIssues !== 'function') {
            return Promise.resolve([]);
        }
        return window.firebaseDb.loadDeliveryIssues()
            .then(list => {
                openClaims = (list || []).filter(i => i && !i.resolved);
                renderClaimsCard();
                return openClaims;
            })
            .catch(error => {
                console.error('Error loading delivery issues:', error);
                return [];
            });
    }

    function claimsAsText() {
        return openClaims.map(c => {
            const when = c.orderedAt ? ' (ordered ' + formatDate(c.orderedAt) + ')' : '';
            return `- ${c.itemName}: ordered ${fmtQty(c.orderedQty)}, received ${fmtQty(c.receivedQty)}, missing ${fmtQty(c.missingQty)}${when}`;
        }).join('\n');
    }

    function renderClaimsCard() {
        const card = document.getElementById('claims-card');
        if (!card) return;

        if (openClaims.length === 0) {
            card.style.display = 'none';
            card.innerHTML = '';
            return;
        }

        card.style.display = '';
        card.innerHTML = `
            <div class="claims-card__head">
                <span class="claims-card__title">⚠️ ${openClaims.length} open claim${openClaims.length > 1 ? 's' : ''} with suppliers</span>
                <button type="button" class="btn btn--secondary claims-card__copy" id="claims-copy">Copy list</button>
            </div>
            <div class="claims-card__list">
                ${openClaims.map(c => `
                    <div class="claim-row">
                        <span class="claim-row__name">${c.itemName}</span>
                        <span class="claim-row__detail">
                            missing <strong>${fmtQty(c.missingQty)} ${pluralizeUnit(c.unit || '', c.missingQty)}</strong>
                            of ${fmtQty(c.orderedQty)}${c.provider ? ' · ' + c.provider : ''}
                            · ${formatDate(c.reportedAt)}
                        </span>
                        <button type="button" class="btn btn--secondary claim-row__settle" data-id="${c.id}">Settled</button>
                    </div>
                `).join('')}
            </div>
        `;

        const copyBtn = card.querySelector('#claims-copy');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const text = claimsAsText();
                // navigator.clipboard needs a secure context; over plain HTTP on the
                // tablet it rejects, so fall back to showing the text to copy by hand.
                const fallback = () => showMessage('Copy manually:\n' + text, 'info');
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text)
                        .then(() => showMessage('Claim list copied', 'success'))
                        .catch(fallback);
                } else {
                    fallback();
                }
            });
        }

        card.querySelectorAll('.claim-row__settle').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const claim = openClaims.find(c => c.id === id);
                if (!claim) return;
                btn.disabled = true;

                const settled = Object.assign({}, claim, {
                    resolved: true,
                    resolvedAt: new Date().toISOString(),
                    resolvedBy: currentStaff
                });
                window.firebaseDb.saveDeliveryIssue(settled)
                    .then(() => {
                        openClaims = openClaims.filter(c => c.id !== id);
                        renderClaimsCard();
                        SoundFX.complete();
                        showMessage('Claim marked as settled', 'success');
                    })
                    .catch(error => {
                        console.error('Error settling claim:', error);
                        showMessage('Could not update the claim — try again', 'error');
                        btn.disabled = false;
                    });
            });
        });
    }

    // Last tab used in the quick-update modal ('stock' | 'order'). Defaults to
    // Order — opening an item from the overview almost always means "I'm buying
    // this" — and is sticky, so a correction run stays on Stock once chosen.
    let quickModalTab = 'order';

    // Active category (badge) filters for the overview list
    let activeCategoryFilters = new Set();

    // Render the clickable category-filter chips above the overview table.
    function renderCategoryFilterBar() {
        const bar = document.getElementById('category-filter-bar');
        if (!bar) return;
        bar.innerHTML = '';
        ['nature', 'etat', 'nonalim'].forEach(grp => {
            IC_CATEGORIES[grp].forEach(cat => {
                const on = activeCategoryFilters.has(cat);
                const chip = document.createElement('span');
                chip.textContent = cat;
                // Touch target >=44px (padding + min-height override categoryStyle's compact base)
                chip.style.cssText = categoryStyle(cat, on) + 'cursor:pointer;min-height:44px;padding:7px 15px;font-size:14px;';
                chip.addEventListener('click', () => {
                    if (activeCategoryFilters.has(cat)) activeCategoryFilters.delete(cat);
                    else activeCategoryFilters.add(cat);
                    updateOverviewTable();
                });
                bar.appendChild(chip);
            });
        });
        if (activeCategoryFilters.size > 0) {
            const clear = document.createElement('span');
            clear.textContent = '✕ clear all';
            clear.style.cssText = 'cursor:pointer;color:var(--sev-critical);font-size:13px;margin-left:6px;padding:10px 8px;display:inline-flex;align-items:center;min-height:44px;';
            clear.addEventListener('click', () => { activeCategoryFilters.clear(); updateOverviewTable(); });
            bar.appendChild(clear);
        }
    }

    // Update overview table
    function updateOverviewTable() {
        renderPendingBanners();

        const overviewTableBody = document.getElementById('overview-table-body');
        if (!overviewTableBody) return;
        
        // Clear existing content
        overviewTableBody.innerHTML = '';
        
        // Filter items by current location
        let filteredItems = window.icItems.filter(item => 
            currentLocation === 'All' || item.location === currentLocation
        );
        
        // Apply search filter if search term exists (accent-insensitive)
        const searchTerm = deburr(document.getElementById('overview-search')?.value || '').trim();
        if (searchTerm) {
            filteredItems = filteredItems.filter(item => {
                const itemName = deburr(item.name || '');
                const categories = deburr((item.categories || []).join(' '));
                const location = deburr(item.location || '');

                return itemName.includes(searchTerm) ||
                       categories.includes(searchTerm) ||
                       location.includes(searchTerm);
            });
        }

        // Apply category (badge) filter — item matches if it carries ANY active tag
        renderCategoryFilterBar();
        if (activeCategoryFilters.size > 0) {
            filteredItems = filteredItems.filter(item =>
                (item.categories || []).some(c => activeCategoryFilters.has(c))
            );
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
            
            // Check for data issues
            if (isNaN(item.currentLevel) || isNaN(item.targetLevel)) {
                console.warn(`Data issue with ${item.name}: currentLevel=${item.currentLevel}, targetLevel=${item.targetLevel}`);
            }
            
            // Apply the 0-5% display rule: show minimum 5% for visual visibility
            let displayPercentage = percentage;
            if (percentage >= 0 && percentage <= 5) {
                displayPercentage = 5; // Show 5% minimum for 0-5% items
            }
            
            // Smooth level colour + matching text colour (shared ui-helpers).
            const levelBarColor = levelColor(percentage);
            const levelBarTextColor = levelTextColor(percentage);
            
            row.innerHTML = `
                <td class="item-name" style="cursor: pointer;" title="Double-click to edit item details">${item.name}</td>
                <td class="current-value">${item.currentLevel}${pendingQtyOf(item) > 0
                    ? ` <span class="pending-badge" title="${fmtQty(pendingQtyOf(item))} ${item.unit} ordered, not received yet">+${fmtQty(pendingQtyOf(item))} 🚚</span>`
                    : ''}</td>
                <td class="level-bar-container">
                    <div class="level-bar">
                        <div class="level-bar-fill" style="width: ${displayPercentage}%; background-color: ${levelBarColor};"></div>
                        <div class="level-bar-text" style="color: ${levelBarTextColor};">${Math.round(percentage)}%</div>
                    </div>
                </td>
                <td class="target-value">${item.targetLevel}</td>
                <td class="categories-value">${categoryBadgesHTML(item.categories) || '<span style="color:#999">—</span>'}</td>
                <td class="last-modified">${formatDate(item.lastCheckedTime)}</td>
            `;
            
            const levelBarFill = row.querySelector('.level-bar-fill');
            if (levelBarFill) {
                levelBarFill.setAttribute('style', `width: ${displayPercentage}%; background-color: ${levelBarColor}; height: 100%; border-radius: 4px;`);
                
                // Debug: Check if styles were applied
                if (item.name === 'Viande Meat [Ground beef] Frozen 1KG') {
                    
                    // Check if there are any CSS rules affecting this element
                    const computedStyle = window.getComputedStyle(levelBarFill);
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
                        showMessage('Update functionality not available. Please refresh the page and try again.', 'error');
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
                
                // Test: Add a simple test to verify the level bar element exists
                setTimeout(() => {
                    const testFill = row.querySelector('.level-bar-fill');
                    if (testFill) {
                    } else {
                    }
                }, 100);
            }
            
            overviewTableBody.appendChild(row);
        });
    }
    
    // Show edit item modal for double-clicked item names
    function showEditItemModal(item) {
        SoundFX.pop();
        const { backdrop: modalBackdrop, box: modalContent, close: closeModal } = openModal({ boxClass: 'modal-box--wide' });

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
        
        // Categories field (multi-badge)
        const sublocationGroup = document.createElement('div');
        sublocationGroup.style.display = 'flex';
        sublocationGroup.style.flexDirection = 'column';
        sublocationGroup.style.gap = '8px';

        const sublocationLabel = document.createElement('label');
        sublocationLabel.textContent = 'Categories';
        sublocationLabel.style.fontWeight = '600';
        sublocationLabel.style.color = 'var(--text-dark)';

        const categoriesBox = document.createElement('div');
        const catEditor = buildCategoryChipEditor(categoriesBox, item.categories || []);

        sublocationGroup.appendChild(sublocationLabel);
        sublocationGroup.appendChild(categoriesBox);

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

        // Focus on name input
        setTimeout(() => {
            nameInput.focus();
            nameInput.select();
        }, 100);
        
        // Save function
        function saveChanges() {
            const newName = nameInput.value.trim();
            const newTarget = parseFloat(targetInput.value);
            const newCategories = catEditor.get();
            
            // Validation
            if (!newName) {
                showMessage('Item name cannot be empty', 'error');
                nameInput.focus();
                return;
            }
            
            if (isNaN(newTarget) || newTarget < 0) {
                showMessage('Target level must be a valid positive number', 'error');
                targetInput.focus();
                return;
            }
            
            // Check for duplicate names (excluding current item)
            const duplicateName = icItems.find(i => i.id !== item.id && i.name.toLowerCase() === newName.toLowerCase());
            if (duplicateName) {
                showMessage(`An item with the name "${newName}" already exists`, 'error');
                nameInput.focus();
                return;
            }
            
            // Update the item
            const itemIndex = icItems.findIndex(i => i.id === item.id);
            if (itemIndex !== -1) {
                icItems[itemIndex].name = newName;
                icItems[itemIndex].targetLevel = newTarget;
                icItems[itemIndex].categories = newCategories;
                icItems[itemIndex].lastCheckedTime = new Date().toISOString();
                
                // Save to local storage
                localStorage.setItem('icItems', JSON.stringify(icItems));

                // Save to Firebase if available — only the edited item, a full-array
                // write would overwrite concurrent edits from other devices
                if (window.firebaseDb && window.firebaseDb.saveIcItem) {
                    window.firebaseDb.saveIcItem(icItems[itemIndex])
                        .then(() => {
                        })
                        .catch(error => {
                            console.error("Error saving to Firebase:", error);
                        });
                }
                
                // Update the Overview table
                updateOverviewTable();
                
                SoundFX.complete();
                // Show success message (only if function exists)
                if (typeof showSuccessMessage === 'function') {
                    showSuccessMessage(`Item "${newName}" updated successfully`);
                }
                
                // Close modal
                closeModal();
                
            }
        }
        
        // Add event listeners
        cancelButton.addEventListener('click', () => {
            closeModal();
        });
        saveButton.addEventListener('click', () => {
            saveChanges();
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
    
    // Both dashboard lists are driven by the same location filter, so they always refresh together
    function updateDashboardLists() {
        updateLowStockList();
        updateCountCard();
        renderPendingBanners();
    }

    // Lists the exact items the count button is about to walk through. Uses the same
    // location filter as startFullCountProcess, so label, list and button always agree.
    function updateCountCard() {
        const isAll = currentLocation === 'All';
        const items = isAll
            ? window.icItems
            : window.icItems.filter(item => item.location === currentLocation);

        if (countCardLabel) {
            countCardLabel.textContent = `${isAll ? 'Full' : currentLocation} Count · ${items.length} item${items.length === 1 ? '' : 's'}`;
        }
        if (startCountBtn) {
            startCountBtn.textContent = isAll ? 'Start Full Count' : `Start ${currentLocation} Count`;
        }

        if (!countPreviewList) return;
        countPreviewList.innerHTML = '';

        if (items.length === 0) {
            countPreviewList.innerHTML = '<div class="count-preview-empty">No items in this location.</div>';
            return;
        }

        // Group by location (physical zone). Categories are a filter facet, not
        // a grouping axis (multi-valued), so they are not used to group here.
        const groups = new Map();
        items.forEach(item => {
            const key = item.location || 'General';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(item);
        });

        const fragment = document.createDocumentFragment();

        [...groups.keys()].sort().forEach(groupName => {
            const heading = document.createElement('div');
            heading.className = 'count-preview-group';
            heading.textContent = `${groupName} · ${groups.get(groupName).length}`;
            fragment.appendChild(heading);

            groups.get(groupName)
                .slice()
                .sort((a, b) => String(a.name).localeCompare(String(b.name)))
                .forEach(item => {
                    const current = Number(item.currentLevel) || 0;
                    const target = Number(item.targetLevel) || 0;
                    const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;

                    // Same colour ramp and 5% minimum width as the Overview level bars
                    const width = percentage <= 5 ? 5 : percentage;

                    const cell = document.createElement('div');
                    cell.className = 'count-preview-item';
                    cell.title = `${item.name} — ${current}/${target} ${item.unit || ''}`.trim();
                    cell.innerHTML = `
                        <div class="count-preview-name"></div>
                        <div class="count-preview-bar">
                            <div class="count-preview-bar-fill" style="width: ${width}%; background-color: ${levelColor(percentage)};"></div>
                        </div>
                    `;
                    // textContent, not innerHTML: item names are free text typed in the DB editor
                    cell.querySelector('.count-preview-name').textContent = item.name;
                    fragment.appendChild(cell);
                });
        });

        countPreviewList.appendChild(fragment);
        sizeCountPreviewList();
    }

    // Let the list fill the space down to the bottom of the screen, but no further:
    // it scrolls internally so the page itself never grows with the item count
    function sizeCountPreviewList() {
        if (!countPreviewList) return;
        const listTop = countPreviewList.getBoundingClientRect().top + window.scrollY;
        const cardBottomPadding = 34;
        const available = window.innerHeight - listTop - cardBottomPadding;
        countPreviewList.style.maxHeight = Math.max(150, Math.min(available, 560)) + 'px';
    }

    window.addEventListener('resize', sizeCountPreviewList);

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

        // Title with a live count badge (matches the Prep Manager "LOW PREPS 4" pattern)
        if (lowStockTitle) {
            const base = currentLocation === 'All' ? 'Low Stock Items' : `Low Stock · ${currentLocation}`;
            lowStockTitle.innerHTML = `${base} <span class="todo-count-badge">${lowStockItems.length}</span>`;
        }
        
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
            
            const _need = item.targetLevel - item.currentLevel;
            const _needColor = item.currentLevel === 0 ? 'var(--danger-strong)' : 'var(--sev-warn)';
            todoItem.innerHTML = `
                <div class="todo-item-name">${item.name}</div>
                <div class="todo-item-detail">
                    <span style="color: var(--text-medium); font-weight: 500;">${item.location}</span>
                </div>
                ${item.categories && item.categories.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin:6px 0;">${categoryBadgesHTML(item.categories)}</div>` : ''}
                <div class="todo-item-detail" style="color:var(--text-light);font-size:13px;">Current: ${fmtQty(item.currentLevel)} ${pluralizeUnit(item.unit, item.currentLevel)}</div>
                <div class="todo-need"><span class="todo-need-num" style="color:${_needColor};">${fmtQty(_need)}</span><span class="todo-need-lbl">${pluralizeUnit(item.unit, _need)} to order</span></div>
                ${providersHtml}
                <div class="todo-footer">
                    ${statusBadgeHTML(item.currentLevel === 0 ? 'out' : 'low')}
                    <span class="todo-updated">Updated ${timeDisplay}</span>
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

        // Items below 50% of target — colour the count amber when actionable (>0)
        // so it stands out from the neutral totals next to it.
        const belowFifty = window.icItems.filter(item => item.currentLevel < item.targetLevel * 0.5).length;
        itemsBelowFiftyElement.textContent = belowFifty;
        itemsBelowFiftyElement.style.color = belowFifty > 0 ? 'var(--sev-warn)' : '';

        updateLastInventoryStat();
    }

    // "Last full inventory" = the OLDEST item check across the whole set. The inventory
    // is only as up-to-date as its stalest item, so this is the date since which
    // everything has been counted. A full count refreshes every item and moves it to
    // today; a single edit or a partial (per-location) count leaves older items untouched,
    // so it never falsely resets. Purely derived from existing data — no DB writes.
    // Pure (no DOM/clock side effects) so it can be unit-tested; exposed as
    // window.__icComputeLastInventory below.
    function computeLastInventoryDisplay(items, nowMs) {
        const dated = (items || [])
            .map(it => ({ t: Date.parse(it.lastCheckedTime), by: it.lastCheckedBy }))
            .filter(x => !isNaN(x.t));

        if (dated.length === 0) {
            return { rel: 'Never', sub: '', cls: 'is-stale' };
        }

        const oldest = dated.reduce((a, b) => (b.t < a.t ? b : a));
        const days = Math.floor((nowMs - oldest.t) / 86400000);

        let rel;
        if (days <= 0) rel = 'Today';
        else if (days === 1) rel = 'Yesterday';
        else if (days <= 7) rel = `${days} days ago`;
        else if (days < 14) rel = 'Over a week ago';
        else rel = `Over ${Math.floor(days / 7)} weeks ago`;

        const abs = new Date(oldest.t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const sub = oldest.by ? `${abs} · by ${oldest.by}` : abs;

        // Weekly cadence: fresh within a week, aging up to ~10 days, stale beyond
        const cls = days <= 7 ? 'is-fresh' : days <= 10 ? 'is-aging' : 'is-stale';

        return { rel, sub, cls };
    }

    function updateLastInventoryStat() {
        const dateEl = document.getElementById('last-inventory-date');
        const byEl = document.getElementById('last-inventory-by');
        const cardEl = document.getElementById('last-inventory-card');
        if (!dateEl || !byEl || !cardEl) return;

        const { rel, sub, cls } = computeLastInventoryDisplay(window.icItems, Date.now());
        dateEl.textContent = rel;
        byEl.textContent = sub;
        cardEl.classList.remove('is-fresh', 'is-aging', 'is-stale');
        cardEl.classList.add(cls);
    }

    // Exposed for tests: pure, read-only, no side effects.
    window.__icComputeLastInventory = computeLastInventoryDisplay;
    
    // Set up event listeners for navigation
    function setupNavigation() {
        // Switch user
        if (switchUserBtn) {
            switchUserBtn.addEventListener('click', () => {
                if (window.UserSession) UserSession.clear(); else currentStaff = '';
                if (staffSelection) staffSelection.style.display = 'flex';
                if (mainInterface) mainInterface.style.display = 'none';
            });
        }
        
        // User login button (header) — the shared dropdown (user.js). The copy
        // that lived here styled its panel inline and read window.staffMembers
        // directly, so it was empty whenever Firebase was unreachable.
        if (userLoginBtn) {
            userLoginBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                UserSession.dropdown(userLoginBtn);
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
        // The count card is a sibling of the sections, not one of them, so nothing
        // in activateSection hides it: leaving mid-count used to strand it at the
        // bottom of History or the dashboard. Leaving the section leaves the count.
        if (countInterface && countInterface.style.display !== 'none') {
            countInterface.style.display = 'none';
            if (dashboardSection) dashboardSection.style.display = '';
        }

        activateSection(sectionId, buttonElement, {
            navButtons, contentSections,
            onSection: (id) => {
                if (id === 'dashboard') { updateStats(); updateDashboardLists(); }
                else if (id === 'history') loadAndDisplayHistory();
                else if (id === 'overview') {
                    // Store original order when first loading Overview
                    if (originalItemOrder.length === 0 && window.icItems && window.icItems.length > 0) {
                        originalItemOrder = [...window.icItems];
                    }
                    updateOverviewTable();
                }
            }
        });
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
    
    // Set up the Overview toolbar (search + add item). Focus styling is CSS-only.
    function setupSearch() {
        const searchInput = document.getElementById('overview-search');
        const clearBtn = document.getElementById('overview-search-clear');
        const toggleClear = () => {
            if (clearBtn) clearBtn.style.display = (searchInput && searchInput.value) ? 'block' : 'none';
        };
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                toggleClear();
                updateOverviewTable();
            });
        }
        if (clearBtn && searchInput) {
            clearBtn.addEventListener('click', () => {
                searchInput.value = '';
                toggleClear();
                updateOverviewTable();
                searchInput.focus();
            });
        }

        const addItemBtn = document.getElementById('overview-add-item-btn');
        if (addItemBtn) {
            addItemBtn.addEventListener('click', showAddNewItemModal);
        }
    }
    
    // Set up real-time updates from Firebase
    function setupRealtimeUpdates() {
        if (window.firebaseDb && window.firebaseDb.onIcItemsChange) {
            window.firebaseDb.onIcItemsChange((updatedItems) => {
                window.icItems = updatedItems;
                
                // Extract locations and sublocations
                extractLocationsAndSublocations();
                
                // Update UI
                updateLocationFilters();
                updateDashboardLists();
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

        // The badge is the handover point: whoever takes over the count taps it
        // and picks their name, so lastCheckedBy stays honest mid-run.
        const userBadge = document.getElementById('count-user-badge');
        if (userBadge) {
            userBadge.addEventListener('click', () => {
                UserSession.pick({ title: 'Who is counting now?' })
                    .then(name => { if (name) userBadge.textContent = name; });
            });
        }
    }
    
    // Start the full count process
    function startFullCount() {
        if (!window.icItems || window.icItems.length === 0) {
            showMessage("No items to count. Please add items first.", 'error');
            return;
        }
        
        // Show staff selection or use current staff
        if (!currentStaff) {
            UserSession.pick({
                title: 'Who will perform this count?',
                subtitle: 'Select staff member performing the I&C full count'
            }).then(name => { if (name) startFullCountProcess(); });
        } else {
            startFullCountProcess();
        }
    }
    
    // Function to continue with full count process
    function startFullCountProcess() {
        
        // Filter by current location if not "All"
        countQueue = currentLocation !== 'All' 
            ? window.icItems.filter(item => item.location === currentLocation)
            : [...window.icItems];
            
        
        if (countQueue.length === 0) {
            showMessage('No items to count in the selected location.', 'error');
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

        // Fill the progress bar to mirror "Item X of N" — same pattern as the
        // preps check screen, so staff see their position in the run.
        const progressFill = document.getElementById('count-progress-fill');
        if (progressFill) {
            progressFill.style.width = `${((currentItemIndex + 1) / countQueue.length) * 100}%`;
        }

        // Update progress indicator
        if (checkProgressElement) {
            checkProgressElement.textContent = `Item ${currentItemIndex + 1} of ${countQueue.length}`;
        }

        // Who is counting
        const userBadge = document.getElementById('count-user-badge');
        if (userBadge) {
            userBadge.textContent = currentStaff || '';
        }

        // Item name — the hero of the screen
        if (checkItemNameElement) {
            checkItemNameElement.textContent = item.name;
        }

        // Where to look: location, plus sublocation when it adds information
        const locationLine = document.getElementById('count-item-location');
        if (locationLine) {
            const sub = item.sublocation && item.sublocation !== item.location ? ` — ${item.sublocation}` : '';
            locationLine.textContent = `📍 ${item.location || 'All'}${sub}`;
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
        
        // Reconfigure slider for this item's target level
        if (window.countSlider) {
            if (typeof window.countSlider.reconfigure === 'function') {
                window.countSlider.reconfigure(item.targetLevel, item.currentLevel);
            } else {
                window.countSlider.setValue(item.currentLevel);
            }
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
            showMessage("Please enter a valid number", 'error');
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
                    SoundFX.tap();

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
                            .catch(error => console.error("Error logging activity:", error));
                    }
                })
                .catch(error => {
                    console.error("Error saving item:", error);
                    showMessage("Error saving item. Please try again.", 'error');
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
        updateDashboardLists();
        updateStats();
        
        // Show success message
        showMessage("Full count completed successfully", "success");
    }
    
    // Cancel full count
    function cancelFullCount() {
        if (dashboardSection) dashboardSection.style.display = 'block';
        if (countInterface) countInterface.style.display = 'none';
    }
    
    // Touch slider functionality — delegates to shared slider.js
    function initTouchSlider() {
        if (window.countSlider) return; // already initialised
        const firstItem = countQueue[0] || null;
        window.countSlider = window.createTouchSlider({
            containerId: document.querySelector('.slider-container'),
            valueDisplayId: 'current-value',
            handleId: 'handle',
            progressId: 'progress',
            ticksId: 'ticks',
            decreaseId: 'decrease',
            increaseId: 'increase',
            hiddenInputId: 'current-level-input',
            initialValue: firstItem ? (parseFloat(firstItem.currentLevel) || 0) : 0,
            targetLevel: firstItem ? (parseFloat(firstItem.targetLevel) || 0) : 0
        });
    }
    

    // Show quick update modal for an item
    function showQuickUpdateModal(item) {
        SoundFX.pop();

        // Ordering state, kept separate from the stock slider. A purchase is a WHOLE
        // number of packages — you can hold 0.8 bag on the shelf but you cannot order
        // 0.8 bag at Metro — so the order scale is integers whatever the shelf
        // granularity. Default = the whole order landing closest to target, so buying
        // on target is a single tap on "Record order".
        const stockNow = parseFloat(item.currentLevel) || 0;
        const targetNow = parseFloat(item.targetLevel) || 0;
        const shortBy = Math.max(0, Math.round((targetNow - stockNow) * 100) / 100);
        const alreadyPending = pendingQtyOf(item);
        const suggestedOrder = Math.round(shortBy);
        let orderQty = alreadyPending > 0 ? Math.round(alreadyPending) : suggestedOrder;
        const orderMax = Math.max(4, Math.ceil(targetNow), orderQty + 2);
        // Slider cleanup centralised in onClose so EVERY close path (buttons,
        // backdrop-click, Escape) destroys the slider — no leaks.
        const { backdrop: modal, box: content, close: closeModal } = openModal({
            onClose: () => {
                if (modalSlider && typeof modalSlider.destroy === 'function') modalSlider.destroy();
                if (orderSlider && typeof orderSlider.destroy === 'function') orderSlider.destroy();
            }
        });

        // Item details
        content.innerHTML = `
            <div style="margin-bottom: 15px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                    <h3 style="margin: 0; color: #333;">${item.name}</h3>
                    <span style="background-color: var(--accent-orange); color: white; padding: 4px 8px; border-radius: 4px; font-size: 14px; font-weight: 500;">${currentStaff}</span>
                </div>
                <p style="margin: 5px 0; color: #666; font-size: 14px;"><strong>Target: ${item.targetLevel} ${item.unit}</strong> &nbsp;•&nbsp; Current: ${item.currentLevel} ${item.unit}${
                    shortBy > 0 ? ` &nbsp;•&nbsp; <span style="color: var(--accent-orange); font-weight: 600;">short by ${fmtQty(shortBy)}</span>` : ''
                }</p>
            </div>

            <!-- One intent at a time: the Stock pane edits currentLevel, the Order
                 pane edits pendingQty. Both steppers visible at once caused users
                 to "add" an order with the stock slider — the phantom-stock bug. -->
            <div class="qu-tabs" role="tablist">
                <button type="button" class="qu-tab" data-tab="stock" role="tab">📦 Stock</button>
                <button type="button" class="qu-tab" data-tab="order" role="tab">🚚 Order${
                    alreadyPending > 0 ? ` <span class="qu-tab__badge">${fmtQty(alreadyPending)}</span>` : ''
                }</button>
            </div>

            <div id="qu-pane-stock">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Stock on shelf:</label>
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

                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button id="modal-cancel" class="btn btn--secondary qu-cancel">Cancel</button>
                    <button id="modal-edit-details" class="btn btn--info">Edit Details</button>
                    <button id="modal-save" class="btn btn--primary">Save</button>
                </div>
            </div>

            <div id="qu-pane-order" style="display: none;">
                <div class="order-block">
                    <div class="order-block__title">🚚 ${alreadyPending > 0 ? 'On the way' : 'I ordered'}</div>
                    <div class="order-block__row">
                        <button type="button" class="order-step" id="order-minus" aria-label="one less">−</button>
                        <span class="order-qty" id="order-qty">${orderQty}</span>
                        <span class="order-unit" id="order-unit">${pluralizeUnit(item.unit, orderQty)}</span>
                        <button type="button" class="order-step" id="order-plus" aria-label="one more">+</button>
                        <span class="order-status" id="order-status"></span>
                    </div>

                    <input type="hidden" id="order-level" value="${orderQty}">
                    <div class="slider-container order-slider">
                        <div class="slider-track"></div>
                        <div class="slider-progress" id="order-progress"></div>
                        <div class="slider-handle" id="order-handle"></div>
                        <div class="tick-marks" id="order-ticks"></div>
                    </div>

                    <div class="order-hint" id="order-hint"></div>
                    <button type="button" id="order-save" class="btn btn--primary order-save">
                        ${alreadyPending > 0 ? 'Update order' : 'Record order'}
                    </button>
                </div>

                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button type="button" class="btn btn--secondary qu-cancel">Cancel</button>
                </div>
            </div>
        `;

        // --- Tab switching ----------------------------------------------------
        const tabButtons = content.querySelectorAll('.qu-tab');
        const stockPane = content.querySelector('#qu-pane-stock');
        const orderPane = content.querySelector('#qu-pane-order');

        function activateTab(tab) {
            quickModalTab = tab;
            tabButtons.forEach(b => b.classList.toggle('qu-tab--active', b.dataset.tab === tab));
            stockPane.style.display = tab === 'stock' ? '' : 'none';
            orderPane.style.display = tab === 'order' ? '' : 'none';
        }
        tabButtons.forEach(b => b.addEventListener('click', () => {
            if (b.dataset.tab !== quickModalTab) SoundFX.pop();
            activateTab(b.dataset.tab);
        }));
        activateTab(quickModalTab); // sticky choice from earlier in the session

        // --- Ordering block wiring -------------------------------------------
        const orderQtyEl = content.querySelector('#order-qty');
        const orderUnitEl = content.querySelector('#order-unit');
        const orderStatusEl = content.querySelector('#order-status');
        const orderHintEl = content.querySelector('#order-hint');
        const orderSaveBtn = content.querySelector('#order-save');
        const orderLevelInput = content.querySelector('#order-level');

        function renderOrderHint() {
            orderQtyEl.textContent = orderQty;
            orderUnitEl.textContent = pluralizeUnit(item.unit, orderQty);

            // Status badge: where this order lands relative to target. Whole
            // packages rarely land exactly on a fractional target, so the badge
            // gives the direction and the line below gives the number.
            const landing = Math.round((stockNow + orderQty) * 100) / 100;
            const delta = Math.round((landing - targetNow) * 100) / 100;
            const state = delta === 0 ? 'on' : (delta < 0 ? 'under' : 'over');
            orderStatusEl.textContent =
                state === 'on' ? 'ON TARGET' : (state === 'under' ? 'UNDER TARGET' : 'OVER TARGET');
            orderStatusEl.className = 'order-status order-status--' + state;

            const landingText = orderQty === 0
                ? 'nothing on the way'
                : `after delivery: ${fmtQty(landing)} / ${fmtQty(targetNow)} ${pluralizeUnit(item.unit, landing)}`;
            const showReset = orderQty !== suggestedOrder;
            orderHintEl.innerHTML = landingText +
                (showReset ? ' &nbsp;<a href="#" id="order-reset" class="order-reset">↩ reset</a>' : '');

            const reset = orderHintEl.querySelector('#order-reset');
            if (reset) {
                reset.addEventListener('click', e => {
                    e.preventDefault();
                    setOrderQty(suggestedOrder);
                });
            }
        }

        // The order slider owns the value; −/+ are wired to it by createTouchSlider.
        // Everything else goes through setOrderQty so the two can never disagree.
        let orderSlider = null;

        function syncOrderFromInput() {
            const raw = parseFloat(orderLevelInput.value) || 0;
            const whole = Math.max(0, Math.round(raw));
            orderQty = whole;
            // The order scale is integer-only. If anything ever feeds a fraction in
            // (a stale slider.js served from cache did exactly that), snap the
            // handle instead of printing "5" over a handle sitting at 4.5 — a
            // display that disagrees with the value is how phantom stock starts.
            if (orderSlider && Math.abs(raw - whole) > 1e-9) orderSlider.setValue(whole);
            renderOrderHint();
        }

        function setOrderQty(v) {
            const next = Math.max(0, Math.min(orderMax, Math.round(v)));
            if (orderSlider) {
                orderSlider.setValue(next); // writes the input -> fires syncOrderFromInput
            } else {
                orderQty = next;
                orderLevelInput.value = next;
                renderOrderHint();
            }
        }

        orderLevelInput.addEventListener('change', syncOrderFromInput);
        renderOrderHint();

        orderSaveBtn.addEventListener('click', () => {
            const previous = alreadyPending;
            if (orderQty === previous) {
                showMessage('Nothing changed', 'info');
                return;
            }
            orderSaveBtn.disabled = true;
            const rollback = {
                pendingQty: item.pendingQty,
                pendingAt: item.pendingAt,
                pendingProvider: item.pendingProvider
            };

            // Ordering never touches currentLevel — that is the whole point.
            // Cancelling (qty 0) must clear the DATE and the SUPPLIER too, not
            // just the quantity: leaving them behind reads as "ordered from Metro
            // on the 3rd" on an item nobody ordered. null deletes the key in
            // Firebase rather than storing an empty string.
            item.pendingQty = orderQty;
            item.pendingAt = orderQty > 0 ? new Date().toISOString() : null;
            item.pendingProvider = orderQty > 0
                ? ((item.providers && item.providers[0]) || '')
                : null;

            const db = window.firebaseDb;
            const write = (db && typeof db.saveIcItem === 'function')
                ? db.saveIcItem(item)
                : Promise.resolve();

            write
                .then(() => {
                    try { localStorage.setItem('icItems', JSON.stringify(window.icItems || [])); } catch (e) {}
                    // `stock` lets the history line state what did NOT move — the
                    // whole point being that ordering never touches currentLevel.
                    logIcEvent(item, 'order', previous, orderQty, {
                        provider: item.pendingProvider,
                        stock: item.currentLevel
                    });
                    SoundFX.complete();
                    showMessage(
                        orderQty === 0
                            ? `Order cleared for ${item.name}`
                            : `${fmtQty(orderQty)} ${pluralizeUnit(item.unit, orderQty)} of ${item.name} on the way`,
                        'success'
                    );
                    updateDashboardLists();
                    updateStats();
                    if (typeof updateOverviewTable === 'function') updateOverviewTable();
                    closeModal();
                })
                .catch(error => {
                    console.error('Error saving order:', error);
                    Object.assign(item, rollback);
                    showMessage('Error saving the order — try again', 'error');
                    orderSaveBtn.disabled = false;
                });
        });
        
        // Set up event handlers
        const saveBtn = content.querySelector('#modal-save');
        
        // Create touch slider for this modal
        let modalSlider;
        
        // Initialize both sliders after the modal is added to DOM
        setTimeout(() => {
            modalSlider = window.createTouchSlider({
                containerId: content.querySelector('#qu-pane-stock .slider-container'),
                valueDisplayId: 'modal-current-value',
                handleId: 'modal-handle',
                progressId: 'modal-progress',
                ticksId: 'modal-ticks',
                decreaseId: 'modal-decrease',
                increaseId: 'modal-increase',
                hiddenInputId: 'modal-current-level',
                initialValue: parseFloat(item.currentLevel) || 0,
                targetLevel: parseFloat(item.targetLevel) || 0
            });

            // Order scale: whole packages only, 0..orderMax. The green marker sits
            // on the suggested quantity (the one that lands closest to target).
            const orderValues = [];
            for (let i = 0; i <= orderMax; i++) orderValues.push(i);
            orderSlider = window.createTouchSlider({
                containerId: content.querySelector('#qu-pane-order .slider-container'),
                valueDisplayId: 'order-qty',
                handleId: 'order-handle',
                progressId: 'order-progress',
                ticksId: 'order-ticks',
                decreaseId: 'order-minus',
                increaseId: 'order-plus',
                hiddenInputId: 'order-level',
                initialValue: orderQty,
                targetLevel: suggestedOrder,
                // Short scale -> label every package, so "2" is readable as a
                // quantity rather than a position between two ticks.
                config: {
                    min: 0, max: orderMax, step: 1, values: orderValues,
                    labelEvery: orderMax <= 8 ? 1 : 0
                }
            });
        }, 0);
        
        // Cancel buttons (one per pane)
        content.querySelectorAll('.qu-cancel').forEach(b => b.addEventListener('click', () => closeModal()));

        // Edit Details button
        const editDetailsBtn = content.querySelector('#modal-edit-details');
        if (editDetailsBtn) {
            editDetailsBtn.addEventListener('click', () => {
                closeModal();
                showEditItemDetailsModal(item);
            });
        }

        // Save button
        saveBtn.addEventListener('click', () => {
            const valueInput = content.querySelector('#modal-current-level');
            const newValue = parseFloat(valueInput.value);
            
            if (isNaN(newValue)) {
                showMessage("Please enter a valid number", 'error');
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
                        SoundFX.complete();

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
                        updateDashboardLists();
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
            closeModal();
        });
    }
    
    // Show the modal for adding a new item
    function showAddNewItemModal() {
        const { backdrop: modalBackdrop, box: modalContent, close: closeModal } = openModal({ boxClass: 'modal-box--wide' });

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
        const newId = window.icItems.length > 0
            ? Math.max(...window.icItems.map(item => item.id)) + 1
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
            } else {
                newLocationInput.style.display = 'none';
                newLocationInput.required = false;
            }
        });

        locationGroup.appendChild(locationLabel);
        locationGroup.appendChild(locationSelect);
        locationGroup.appendChild(newLocationInput);

        formFields.appendChild(locationGroup);

        // Categories field (multi-badge, closed vocabulary)
        const sublocationGroup = document.createElement('div');
        sublocationGroup.style.display = 'flex';
        sublocationGroup.style.flexDirection = 'column';
        sublocationGroup.style.gap = '5px';

        const sublocationLabel = document.createElement('label');
        sublocationLabel.textContent = 'Categories';
        sublocationLabel.style.fontWeight = '500';

        const categoriesBox = document.createElement('div');
        const catEditorAdd = buildCategoryChipEditor(categoriesBox, []);

        sublocationGroup.appendChild(sublocationLabel);
        sublocationGroup.appendChild(categoriesBox);

        formFields.appendChild(sublocationGroup);

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
                removeButton.textContent = '\u00d7';
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

            // Get categories (multi-badge)
            const categories = catEditorAdd.get();

            // Validation
            if (!name) {
                showMessage('Please enter an item name', 'error');
                return;
            }

            if (isNaN(currentLevel) || currentLevel < 0) {
                showMessage('Current level must be a valid number (0 or greater)', 'error');
                return;
            }

            if (isNaN(targetLevel) || targetLevel <= 0) {
                showMessage('Target level must be a valid number (greater than 0)', 'error');
                return;
            }

            if (!unit) {
                showMessage('Please enter a unit', 'error');
                return;
            }

            if (!location) {
                showMessage('Please select or enter a location', 'error');
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
                categories: categories,
                providers: providers,
                lastCheckedTime: new Date().toISOString(),
                lastCheckedBy: currentStaff,
                displayOrder: window.icItems.length > 0 ? Math.max(...window.icItems.map(item => item.displayOrder || 0)) + 1 : 1
            };

            // Add to icItems array
            window.icItems.push(newItem);

            // Save to Firebase and local storage
            saveData(newItem);

            // Log the activity
            logActivityChange(newItem, null, newItem.currentLevel, 'add');

            // Extract locations and update UI
            extractLocationsAndSublocations();
            updateLocationFilters();
            updateDashboardLists();
            updateStats();

            // Show success message
            showMessage(`New item "${name}" added successfully`, "success");

            // Close modal
            closeModal();
        });

        // Cancel button event
        cancelButton.addEventListener('click', closeModal);
    }

    // Show edit item details modal (full edit: name, levels, unit, location, sublocation, providers, delete)
    function showEditItemDetailsModal(item) {
        const { backdrop: modalBackdrop, box: modalContent, close: closeModal } = openModal({ boxClass: 'modal-box--wide' });

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
            } else {
                newLocationInput.style.display = 'none';
                newLocationInput.required = false;
            }
        });

        locationGroup.appendChild(locationLabel);
        locationGroup.appendChild(locationSelect);
        locationGroup.appendChild(newLocationInput);

        formFields.appendChild(locationGroup);

        // Categories field (multi-badge, closed vocabulary)
        const sublocationGroup = document.createElement('div');
        sublocationGroup.style.display = 'flex';
        sublocationGroup.style.flexDirection = 'column';
        sublocationGroup.style.gap = '5px';

        const sublocationLabel = document.createElement('label');
        sublocationLabel.textContent = 'Categories';
        sublocationLabel.style.fontWeight = '500';

        const categoriesBox = document.createElement('div');
        const catEditorEdit = buildCategoryChipEditor(categoriesBox, item.categories || []);

        sublocationGroup.appendChild(sublocationLabel);
        sublocationGroup.appendChild(categoriesBox);

        formFields.appendChild(sublocationGroup);

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
                removeButton.textContent = '\u00d7';
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
        deleteButton.style.backgroundColor = 'var(--danger)';
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

            // Get categories (multi-badge)
            const categories = catEditorEdit.get();

            // Validation
            if (!name) {
                showMessage('Please enter an item name', 'error');
                return;
            }

            if (isNaN(currentLevel) || currentLevel < 0) {
                showMessage('Current level must be a valid number (0 or greater)', 'error');
                return;
            }

            if (isNaN(targetLevel) || targetLevel <= 0) {
                showMessage('Target level must be a valid number (greater than 0)', 'error');
                return;
            }

            if (!unit) {
                showMessage('Please enter a unit', 'error');
                return;
            }

            if (!location) {
                showMessage('Please select or enter a location', 'error');
                return;
            }

            // Find the item in the icItems array
            const itemIndex = window.icItems.findIndex(i => i.id === item.id);
            if (itemIndex !== -1) {
                // Store old values before updating
                const oldItem = {...window.icItems[itemIndex]};

                // Update the item
                window.icItems[itemIndex].name = name;
                window.icItems[itemIndex].currentLevel = currentLevel;
                window.icItems[itemIndex].targetLevel = targetLevel;
                window.icItems[itemIndex].unit = unit;
                window.icItems[itemIndex].location = location;
                window.icItems[itemIndex].categories = categories;
                window.icItems[itemIndex].providers = providers;
                window.icItems[itemIndex].displayOrder = displayOrder;
                window.icItems[itemIndex].lastCheckedBy = currentStaff;
                window.icItems[itemIndex].lastCheckedTime = new Date().toISOString();

                // Save to Firebase and local storage
                saveData(window.icItems[itemIndex]);

                // Log the activity if quantity changed
                if (oldItem.currentLevel !== currentLevel) {
                    logActivityChange(window.icItems[itemIndex], oldItem.currentLevel, currentLevel, 'edit');
                }

                // Extract locations and update UI
                extractLocationsAndSublocations();
                updateLocationFilters();
                updateDashboardLists();
                updateStats();

                // Show success message
                showMessage(`Item "${name}" updated successfully`, "success");
            }

            // Close modal
            closeModal();
        });

        // Delete button event handler
        deleteButton.addEventListener('click', () => {
            confirmDialog({
                title: 'Delete item?',
                message: `Delete "${item.name}"? This cannot be undone.`,
                confirmText: 'Delete',
                danger: true
            }).then(ok => {
                if (!ok) return;
                // Find the item in the icItems array
                const itemIndex = window.icItems.findIndex(i => i.id === item.id);
                if (itemIndex !== -1) {
                    // Store item for logging
                    const deletedItem = {...window.icItems[itemIndex]};

                    // Remove the item
                    window.icItems.splice(itemIndex, 1);

                    // Local backup only — the DB write is the targeted delete below,
                    // not a full-array rewrite
                    localStorage.setItem('icItems', JSON.stringify(window.icItems));

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
                    updateDashboardLists();
                    updateStats();

                    // Show success message
                    showMessage(`Item "${item.name}" deleted successfully`, "success");
                }

                // Close modal
                closeModal();
            });
        });

        // Cancel button event handler
        cancelButton.addEventListener('click', closeModal);
    }

    // Check and purge old I&C activity logs (older than 2 months)
    function checkAndPurgeOldHistory() {
        // Check if we've already done purge check this session
        if (sessionStorage.getItem('icPurgeCheckDone')) {
            return;
        }
        
        // Check if Firebase is available
        if (!window.firebaseDb || !window.firebaseDb.loadIcActivityLogs) {
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

        // Shared modal scaffold: backdrop + box + close paths (backdrop-click, Escape)
        const { box, close } = openModal({ boxClass: 'modal-box--wide' });
        box.appendChild(modalHeader);
        box.appendChild(infoSection);
        box.appendChild(buttonGroup);

        skipButton.addEventListener('click', close);
        purgeButton.addEventListener('click', () => {
            purgeOldRecords(oldLogs);
            close();
        });
    }
    
    // Purge old records from Firebase
    function purgeOldRecords(oldLogs) {
        if (!window.firebaseDb || !window.firebaseDb.deleteIcActivityLogs) {
            console.error('Firebase delete function not available');
            return;
        }
        
        
        // Show loading state
        const loadingMessage = showMessage('Cleaning up old records...', 'info');
        
        // Delete old records
        const deletePromises = oldLogs.map(log => {
            // The log should have a key property from Firebase
            if (log.key) {
                return window.firebaseDb.deleteIcActivityLogs(log.key);
            } else {
                console.warn('Log missing key:', log);
                return Promise.resolve(); // Skip this log
            }
        });
        
        
        Promise.all(deletePromises)
            .then(() => {
                
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
                        
                        // Wording lives in describeLog (ui-helpers.js), shared with
                        // the preps history — this switch had its own copy and
                        // never learned the ordering actions.
                        const described = describeLog(log) ||
                            { label: 'modified', change: `${log.oldValue} → ${log.newValue} ${log.unit}` };
                        const actionText = described.label;
                        const changeText = described.change;

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
        // Routed to the shared notification system (notifications.js) so I&C and
        // Prep use one toast. type: success | error | warning | info.
        var t = (type === "error" || type === "success" || type === "warning") ? type : "info";
        if (typeof showNotification === "function") {
            showNotification(message, "", t);
        }
    }
    
    // Initialize application
    function init() {
        // Restore a persisted user (shared with Prep Manager via localStorage
        // 'currentStaff') and skip the gate — I&C no longer re-asks "who are you?"
        // on every reload, and counts are attributed to the right person.
        var restoredStaff = window.UserSession ? UserSession.restore() : '';
        if (restoredStaff) {
            if (staffSelection) staffSelection.style.display = 'none';
            if (mainInterface) mainInterface.style.display = 'flex';
            loadItems();
        }

        // Load staff members (populates the gate grid for a later "switch user")
        loadStaffMembers();

        // Set up navigation
        setupNavigation();

        // Set up full count
        setupFullCount();
    }
    
    // Start the application
    init();
});
