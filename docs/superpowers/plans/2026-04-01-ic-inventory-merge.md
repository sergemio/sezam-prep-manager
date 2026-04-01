# IC Inventory File Merge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge `ic-inventory.js` and `ic-inventory-app.js` into a single unified file, eliminating 8 duplicated functions, 4 conflicting `saveData` definitions, and handler conflicts.

**Architecture:** `ic-inventory-app.js` (the newer, properly scoped file) is the base. We migrate 4 functions that only exist in `ic-inventory.js` into it, adapt them to the closure scope, then delete `ic-inventory.js` and remove its script tag from the HTML.

**Tech Stack:** Vanilla JS, Firebase Realtime Database, no build system.

---

### Task 1: Backup Original Files

**Files:**
- Create: `backup-ic-merge/ic-inventory.js.bak`
- Create: `backup-ic-merge/ic-inventory-app.js.bak`
- Create: `backup-ic-merge/ic-inventory.html.bak`

- [ ] **Step 1: Create backup directory and copy files**

```bash
cd C:/Users/serge/Claude/topics/sezam-prep-manager
mkdir -p backup-ic-merge
cp ic-inventory.js backup-ic-merge/ic-inventory.js.bak
cp ic-inventory-app.js backup-ic-merge/ic-inventory-app.js.bak
cp ic-inventory.html backup-ic-merge/ic-inventory.html.bak
```

- [ ] **Step 2: Verify backups exist**

Run: `ls -la backup-ic-merge/`
Expected: 3 files, sizes matching originals (~90KB, ~75KB, ~9KB)

- [ ] **Step 3: Commit backups**

```bash
git add backup-ic-merge/
git commit -m "backup: save original IC files before merge"
```

---

### Task 2: Add `createTouchSlider` to `ic-inventory-app.js`

This reusable slider factory only exists in `ic-inventory.js` (lines 1187-1394). The app.js `showQuickUpdateModal` already calls it at line 1921: `createTouchSlider({...})`. Currently it resolves because `ic-inventory.js` defines it globally. After we remove that file, it must live inside the DOMContentLoaded closure.

**Files:**
- Modify: `ic-inventory-app.js` — insert after `generateValues()` function (around line 1858)

- [ ] **Step 1: Insert `createTouchSlider` into `ic-inventory-app.js`**

Insert the following function after the `generateValues()` function (line 1858), before `showQuickUpdateModal` (line 1861). The function is copied verbatim from `ic-inventory.js` lines 1187-1394, indented to match the DOMContentLoaded closure (4 spaces):

```javascript
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

        const values = [];
        for (let i = 0; i <= 12; i++) {
            values.push(i * 0.25);
        }
        for (let i = 4; i <= maxValue; i++) {
            values.push(i);
        }

        let currentValue = findClosestValue(initialValue, values);
        let isDragging = false;

        function findClosestValue(value, valueArray) {
            const exactIndex = valueArray.indexOf(value);
            if (exactIndex !== -1) return value;

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

        function updateSlider() {
            const valueIndex = values.indexOf(currentValue);
            const percentage = valueIndex / (values.length - 1) * 100;

            handle.style.left = `${percentage}%`;
            progress.style.width = `${percentage}%`;

            valueDisplay.textContent = currentValue < 3 ? currentValue.toFixed(2) : currentValue.toFixed(0);

            if (hiddenInput) {
                hiddenInput.value = currentValue;
                const event = new Event('change');
                hiddenInput.dispatchEvent(event);
            }
        }

        function createTicks() {
            ticksContainer.innerHTML = '';

            values.forEach((val, index) => {
                const percentage = index / (values.length - 1) * 100;

                const tick = document.createElement('div');
                tick.className = val % 1 === 0 ? 'tick major' : 'tick';
                tick.style.left = `${percentage}%`;
                ticksContainer.appendChild(tick);

                if (val % 1 === 0 && (val <= 3 || val % 2 === 0)) {
                    const label = document.createElement('div');
                    label.className = 'tick-label';
                    label.textContent = val;
                    label.style.left = `${percentage}%`;
                    ticksContainer.appendChild(label);
                }
            });
        }

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

            percentage = Math.max(0, Math.min(percentage, 1));

            const valueIndex = Math.round(percentage * (values.length - 1));
            currentValue = values[valueIndex];

            updateSlider();
            event.preventDefault();
        }

        function handleClick(event) {
            if (event.target === handle) return;

            const containerRect = container.getBoundingClientRect();
            const percentage = (event.clientX - containerRect.left) / containerRect.width;

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

        handle.addEventListener('mousedown', startDragging);
        handle.addEventListener('touchstart', startDragging);

        document.addEventListener('mousemove', handleMove);
        document.addEventListener('touchmove', handleMove, { passive: false });

        document.addEventListener('mouseup', stopDragging);
        document.addEventListener('touchend', stopDragging);

        container.addEventListener('click', handleClick);

        if (decreaseBtn) decreaseBtn.addEventListener('click', decreaseValue);
        if (increaseBtn) increaseBtn.addEventListener('click', increaseValue);

        createTicks();
        updateSlider();

        return {
            setValue: function(value) {
                currentValue = findClosestValue(value, values);
                updateSlider();
            },
            getValue: function() {
                return currentValue;
            },
            destroy: function() {
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
```

- [ ] **Step 2: Remove the `typeof createTouchSlider` guard in `showQuickUpdateModal`**

In `showQuickUpdateModal` (around line 1920), replace:
```javascript
            if (typeof createTouchSlider === 'function') {
                modalSlider = createTouchSlider({
```
with:
```javascript
                modalSlider = createTouchSlider({
```

And remove the matching `else` block (lines ~1932-1934):
```javascript
            } else {
                console.error('createTouchSlider function not found');
            }
```

The closing `});` of the setTimeout stays. The function is now guaranteed to be in scope.

- [ ] **Step 3: Verify no syntax errors**

Run: `node --check ic-inventory-app.js`
Expected: No output (clean parse)

- [ ] **Step 4: Commit**

```bash
git add ic-inventory-app.js
git commit -m "feat(ic): add createTouchSlider to unified file"
```

---

### Task 3: Add `logActivityChange` helper to `ic-inventory-app.js`

This function exists in `ic-inventory.js` (lines 790-812) and is used by `showAddNewItemModal` and `showEditItemDetailsModal`. App.js does its logging inline, but the migrated modals expect this helper.

**Files:**
- Modify: `ic-inventory-app.js` — insert in the utilities section, after `formatDate` (around line 442)

- [ ] **Step 1: Insert `logActivityChange` function**

Insert after the `formatDate` function (around line 442), before `updateOverviewTable`:

```javascript
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
```

Note: `currentStaff` is already a closure variable in app.js (line 37). No adaptation needed.

- [ ] **Step 2: Verify no syntax errors**

Run: `node --check ic-inventory-app.js`
Expected: No output (clean parse)

- [ ] **Step 3: Commit**

```bash
git add ic-inventory-app.js
git commit -m "feat(ic): add logActivityChange helper"
```

---

### Task 4: Add unified `saveData` function to `ic-inventory-app.js`

The migrated modals (`showAddNewItemModal`, `showEditItemDetailsModal`) call `saveData()`. Currently they each define their own local version. We add one shared function.

**Files:**
- Modify: `ic-inventory-app.js` — insert after `logActivityChange`

- [ ] **Step 1: Insert `saveData` function**

Insert right after the `logActivityChange` function added in Task 3:

```javascript
    // Unified save function for all IC data
    function saveData(specificItem) {
        // Always save to localStorage as backup
        localStorage.setItem('icItems', JSON.stringify(window.icItems));

        // Save to Firebase if available
        if (window.firebaseDb && window.firebaseDb.saveAllIcItems) {
            window.firebaseDb.saveAllIcItems(window.icItems)
                .catch(error => {
                    console.error("Error saving to Firebase:", error);
                    if (typeof showMessage === 'function') {
                        showMessage("Failed to save data to server.", "error");
                    }
                });
        } else if (window.firebaseDb && window.firebaseDb.saveIcItem && specificItem) {
            window.firebaseDb.saveIcItem(specificItem)
                .catch(error => {
                    console.error("Error saving item:", error);
                    if (typeof showMessage === 'function') {
                        showMessage("Failed to save item to server.", "error");
                    }
                });
        }
    }
```

- [ ] **Step 2: Verify no syntax errors**

Run: `node --check ic-inventory-app.js`
Expected: No output (clean parse)

- [ ] **Step 3: Commit**

```bash
git add ic-inventory-app.js
git commit -m "feat(ic): add unified saveData function"
```

---

### Task 5: Migrate `showAddNewItemModal` to `ic-inventory-app.js`

This is the "Add New Item" modal from `ic-inventory.js` lines 352-913. No equivalent exists in app.js. It references `icItems`, `currentStaff`, `allLocations`, `allSublocations`, `currentLocation`, `extractLocationsAndSublocations`, `updateLocationFilters`, `updateInventoryTables`, `updateLowStockList`, `updateStats` — all already exist in the app.js closure. The only adaptations needed:
- Replace bare `icItems` → `window.icItems`
- Remove the local `saveData()` and `logActivityChange()` definitions (use the shared ones from Tasks 3-4)
- Replace `showSuccessMessage` → `showMessage(msg, "success")` (app.js uses `showMessage`)
- Replace `showErrorMessage` → `showMessage(msg, "error")`

**Files:**
- Modify: `ic-inventory-app.js` — insert in the Modals section, after `showQuickUpdateModal` (around line 2029)

- [ ] **Step 1: Copy `showAddNewItemModal` from `ic-inventory.js` lines 352-913 into app.js**

Insert after `showQuickUpdateModal` ends (around line 2029). The full function is ~560 lines. Key adaptations when copying:

1. Every bare `icItems` reference becomes `window.icItems` (occurs at lines 394, 878, 882, 891-895 of the original)
2. Remove the local `saveData` function definition (original lines 758-787) — the shared `saveData()` from Task 4 will be used
3. Remove the local `logActivityChange` function definition (original lines 790-812) — the shared one from Task 3 will be used
4. Replace `showSuccessMessage(...)` with `showMessage(..., "success")`
5. Replace `showErrorMessage(...)` with `showMessage(..., "error")`

The function signature stays identical: `function showAddNewItemModal() {`

- [ ] **Step 2: Verify the function is called somewhere**

Check that `showAddNewItemModal` is referenced in `updateInventoryTables` (the "Add Item to location" button). Search for `showAddNewItemModal` in the file. It should appear in:
- The function definition (new)
- Inside `updateInventoryTables` where the "Add Item" button's click handler calls it

If `updateInventoryTables` in app.js doesn't reference it (the old version in `ic-inventory.js` did at lines 136-137), add the event listener in the empty-state block and the add-button block of `updateInventoryTables`.

- [ ] **Step 3: Verify no syntax errors**

Run: `node --check ic-inventory-app.js`
Expected: No output (clean parse)

- [ ] **Step 4: Commit**

```bash
git add ic-inventory-app.js
git commit -m "feat(ic): migrate showAddNewItemModal to unified file"
```

---

### Task 6: Migrate `showEditItemDetailsModal` to `ic-inventory-app.js`

This is the detailed edit modal from `ic-inventory.js` lines 2109-2697. It's opened from the "Edit Details" button in `showQuickUpdateModal` (ic-inventory.js line 1138). App.js's `showQuickUpdateModal` does NOT have an "Edit Details" button — so we also need to check if this flow is needed or if `showEditItemModal` (app.js line 650) covers it.

Looking at the code: `showEditItemDetailsModal` allows editing name, current level, target, unit, display order, location, sublocation, providers, AND deleting items. `showEditItemModal` (app.js) only edits name, target, and sublocation. They serve different purposes — we need both.

However, app.js's `showQuickUpdateModal` doesn't have an "Edit Details" button that calls `showEditItemDetailsModal`. The old `ic-inventory.js` version of `showQuickUpdateModal` did (line 1138), but app.js replaced it. So currently `showEditItemDetailsModal` is only reachable via the OLD `showQuickUpdateModal` — which gets overridden.

**Decision:** Migrate `showEditItemDetailsModal` AND add the "Edit Details" button to app.js's `showQuickUpdateModal`, restoring the full edit capability.

**Files:**
- Modify: `ic-inventory-app.js`

- [ ] **Step 1: Copy `showEditItemDetailsModal` from `ic-inventory.js` lines 2109-2697 into app.js**

Insert after `showAddNewItemModal`. Key adaptations:

1. Every bare `icItems` → `window.icItems` (occurs at lines 2536, 2541, 2604, 2607, 2610-2618, 2648, 2651, 2654)
2. Every bare `allLocations` → stays as-is (it's in the closure scope from line 39)
3. Every bare `allSublocations` → stays as-is (closure scope from line 40)
4. Every bare `currentStaff` → stays as-is (closure scope from line 37)
5. Remove the local `saveData` definition (lines 2534-2550) — use shared `saveData()`
6. Replace `showSuccessMessage(...)` → `showMessage(..., "success")`
7. Replace `showErrorMessage(...)` → `showMessage(..., "error")`
8. Replace bare `logActivityChange(...)` — already migrated in Task 3, available in scope

- [ ] **Step 2: Add "Edit Details" button to `showQuickUpdateModal` in app.js**

In `showQuickUpdateModal` (around line 1902), the buttons section currently has Cancel and Save. Add an "Edit Details" button between them. Find the button HTML:

```javascript
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button id="modal-cancel" style="flex: 1; padding: 10px; background: #f1f1f1; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
                <button id="modal-save" style="flex: 1; padding: 10px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Save</button>
            </div>
```

Replace with:

```javascript
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button id="modal-cancel" style="flex: 1; padding: 10px; background: #f1f1f1; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
                <button id="modal-edit-details" style="flex: 1; padding: 10px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Edit Details</button>
                <button id="modal-save" style="flex: 1; padding: 10px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Save</button>
            </div>
```

Then after the cancel button event listener setup (around line 1938), add:

```javascript
        // Edit Details button
        const editDetailsBtn = content.querySelector('#modal-edit-details');
        if (editDetailsBtn) {
            editDetailsBtn.addEventListener('click', () => {
                if (modalSlider && typeof modalSlider.destroy === 'function') {
                    modalSlider.destroy();
                }
                document.body.removeChild(modal);
                showEditItemDetailsModal(item);
            });
        }
```

- [ ] **Step 3: Verify no syntax errors**

Run: `node --check ic-inventory-app.js`
Expected: No output (clean parse)

- [ ] **Step 4: Commit**

```bash
git add ic-inventory-app.js
git commit -m "feat(ic): migrate showEditItemDetailsModal + add Edit Details button"
```

---

### Task 7: Remove `ic-inventory.js` and update HTML

**Files:**
- Delete: `ic-inventory.js`
- Modify: `ic-inventory.html` — remove script tag on line 288

- [ ] **Step 1: Remove the script tag from `ic-inventory.html`**

In `ic-inventory.html`, delete line 288:
```html
    <script src="ic-inventory.js"></script>
```

Keep the surrounding lines intact. The result should be:

```html
    <!-- Shared utilities -->
    <script src="notifications.js"></script>
    
    <!-- Sound effects -->
    <script src="sounds.js"></script>
    <!-- Core application script -->
    <script src="ic-inventory-app.js"></script>
```

- [ ] **Step 2: Delete `ic-inventory.js`**

```bash
cd C:/Users/serge/Claude/topics/sezam-prep-manager
rm ic-inventory.js
```

- [ ] **Step 3: Verify `ic-inventory-app.js` still parses cleanly**

Run: `node --check ic-inventory-app.js`
Expected: No output (clean parse)

- [ ] **Step 4: Commit**

```bash
git add ic-inventory.html
git rm ic-inventory.js
git commit -m "refactor(ic): remove ic-inventory.js, single unified file"
```

---

### Task 8: Smoke Test — Manual Verification

Open `ic-inventory.html` in a browser (via the GitHub Pages dev URL or local server) and verify all functionality.

**Files:** None (testing only)

- [ ] **Step 1: Open the app and verify staff selection**

Open `ic-inventory.html` in a browser. Verify:
- Staff buttons load from Firebase
- Clicking a staff name shows the main interface
- The user name appears in the header

- [ ] **Step 2: Verify Dashboard**

- Stats show (Total Items, Items Below 50%)
- Low stock items appear in the right panel
- Location filter buttons work (click different locations, list updates)

- [ ] **Step 3: Verify Inventory section**

- Navigate to Inventory
- Items grouped by sublocation
- Click an item row → Quick Update modal opens
- Slider works (drag, +/- buttons, click on track)
- Save updates the value (check Firebase RTDB)
- "Edit Details" button opens the full edit modal
- Full edit modal: change name/target/location/providers, save works

- [ ] **Step 4: Verify Add New Item**

- In Inventory section, click "Add New Item" button
- Fill in all fields (name, levels, unit, location, sublocation, provider)
- Save → item appears in the list
- Verify item saved in Firebase RTDB

- [ ] **Step 5: Verify Overview section**

- Navigate to Overview
- Table loads with all items
- Search works
- Column sorting works (click headers)
- Click level bar → Quick Update modal
- Double-click item name → Edit Item modal

- [ ] **Step 6: Verify Full Count**

- Navigate to Dashboard
- Click "Start Full Count"
- Staff selection modal appears
- Navigate through items with Save & Next
- Complete the count

- [ ] **Step 7: Verify History section**

- Navigate to History
- Activity logs load
- Analytics summary shows

- [ ] **Step 8: Check browser console for errors**

Open DevTools (F12) → Console tab. Verify:
- No `ReferenceError` or `TypeError` errors
- No "function not found" errors
- No Firebase errors

- [ ] **Step 9: Final commit if all tests pass**

```bash
git add -A
git commit -m "test: verify IC merge — all smoke tests pass"
```

---

### Task 9: Cleanup

**Files:**
- Delete: `backup-ic-merge/` directory (after confirming everything works)

- [ ] **Step 1: Remove backup directory**

Only do this after Task 8 passes completely:

```bash
cd C:/Users/serge/Claude/topics/sezam-prep-manager
rm -rf backup-ic-merge/
git add -A
git commit -m "cleanup: remove IC merge backup files"
```
