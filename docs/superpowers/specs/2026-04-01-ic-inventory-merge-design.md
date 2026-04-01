# IC Inventory File Merge — Design Spec

**Date:** 2026-04-01
**Status:** Draft
**Scope:** Merge `ic-inventory.js` + `ic-inventory-app.js` into a single unified file

## Problem

Two JS files (`ic-inventory.js` — 2986 lines, `ic-inventory-app.js` — 2475 lines) are loaded on the same page (`ic-inventory.html`). They share 8 duplicated functions, conflicting event handlers, and 4 separate `saveData` definitions. The app works today because `ic-inventory-app.js` loads last and silently overrides the duplicates, but any edit risks breaking the fragile load-order dependency.

## Approach

**Approach A — app.js is the base, graft missing functions from ic-inventory.js.**

`ic-inventory-app.js` is the newer, more complete file (DOMContentLoaded wrapper, proper scoping, `window.icItems` pattern). We keep it as the base and migrate into it the functions that only exist in `ic-inventory.js`.

## Impact Analysis

### Files touched
| File | Action |
|------|--------|
| `ic-inventory-app.js` | Modified — receives migrated functions |
| `ic-inventory.js` | Deleted |
| `ic-inventory.html` | Modified — remove `<script src="ic-inventory.js">` line |

### No cross-file dependencies
- Only `ic-inventory.html` loads these two files. No other HTML page references them.
- `script.js` (Prep Manager) has its own independent copies of `showQuickUpdateModal` and `createTouchSlider`. No dependency on the IC files.

## Functions to Migrate (ic-inventory.js → ic-inventory-app.js)

These functions exist ONLY in `ic-inventory.js` and are still needed:

| Function | Lines (ic-inventory.js) | Notes |
|----------|------------------------|-------|
| `showAddNewItemModal()` | 352-913 | Full modal for adding new IC items. No equivalent in app.js. |
| `showEditItemDetailsModal(item)` | 2109-2534 | Detailed edit modal (name, location, sublocation, providers, target). Different from app.js `showEditItemModal` which only edits name/target/sublocation. |
| `createTouchSlider(options)` | 1187-1394 | Reusable slider widget. Used by both `showQuickUpdateModal` and full count. App.js has `initTouchSlider` (line 1675) but it's not the same — need to verify which is actually called. |
| `logActivityChange(item, old, new, type)` | 790-812 | Activity logging to Firebase. May exist inline in app.js — check. |

## Functions Already Duplicated (keep app.js version, discard ic-inventory.js version)

| Function | ic-inventory.js | ic-inventory-app.js | Winner |
|----------|----------------|---------------------|--------|
| `extractLocationsAndSublocations` | L6 | L167 | app.js (uses `window.icItems`) |
| `updateLocationFilters` | L29 | L191 | app.js (includes overview filter) |
| `updateInventoryTables` | L102 | L287 | app.js (uses `window.icItems`) |
| `updateLowStockList` | L260 | L1073 | app.js |
| `updateStats` | L340 | L1152 | app.js |
| `showQuickUpdateModal` | L916 | L1861 | app.js — but verify slider init works |
| `switchSection` | L1419 | L1239 | app.js (has SoundFX + overview support) |
| `debugLog` | L2, L1451 | N/A | Discard (empty function) |
| `startFullCount` | L1454 | L1348 | app.js |
| `startFullCountProcess` | L1474 | L1477 | app.js |
| `showCurrentCountItem` | L1596 | L1535 | app.js |
| `saveAndNext` | L1661 | L1585 | app.js |
| `completeFullCount` | L1786 | L1655 | app.js |
| `cancelFullCount` | L1801 | L1669 | app.js |
| `showStaffSelectionModal` | L1815 | L1370 | app.js |
| `showMainInterface` | L1397 | N/A | Discard (not used by app.js flow) |
| `showStaffSelection` | L1413 | N/A | Discard (not used by app.js flow) |

## saveData Consolidation

**Current state:** 4 definitions in `ic-inventory.js` (lines 758, 1102, 1739, 2534), each slightly different.

**Target:** One single `saveData(specificItem)` function inside the DOMContentLoaded closure.

Behavior:
1. Save to `localStorage` as backup
2. If `window.firebaseDb.saveAllIcItems` exists → batch save all items
3. Else if `specificItem` provided → save that specific item via `saveIcItem`
4. Else → save last item in array (fallback for add operations)
5. On error → `showErrorMessage()`

All modal save handlers will call this single function.

## Slider Reconciliation

`ic-inventory.js` has `createTouchSlider(options)` — a clean, reusable factory that returns `{setValue, getValue, destroy}`.

`ic-inventory-app.js` has `initTouchSlider()` (L1675) + `generateValues()` (L1844) — a more coupled version tied to the full-count interface.

**Decision:** Migrate `createTouchSlider` from `ic-inventory.js` into the unified file. Update `showQuickUpdateModal` in app.js to use it (it likely already references it). Replace `initTouchSlider` with calls to `createTouchSlider` where possible.

## Structure of Unified File

```
ic-inventory-app.js
├── DOMContentLoaded wrapper
│   ├── 1. DOM references
│   ├── 2. App state variables
│   ├── 3. Utility functions (formatDate, createTouchSlider, saveData, logActivityChange)
│   ├── 4. Staff management (loadStaffMembers, createStaffButton, selectStaff)
│   ├── 5. Data loading (loadItems, setupRealtimeUpdates)
│   ├── 6. Location & filters (extractLocations, updateLocationFilters, changeLocation)
│   ├── 7. UI rendering (updateInventoryTables, updateLowStockList, updateStats, updateOverviewTable)
│   ├── 8. Modals
│   │   ├── showQuickUpdateModal (from app.js)
│   │   ├── showAddNewItemModal (from ic-inventory.js — migrated)
│   │   ├── showEditItemModal (from app.js — overview double-click)
│   │   ├── showEditItemDetailsModal (from ic-inventory.js — migrated)
│   │   └── showStaffSelectionModal
│   ├── 9. Full Count (startFullCount → showCurrentCountItem → saveAndNext → completeFullCount)
│   ├── 10. History & Purge (loadAndDisplayHistory, checkAndPurgeOldHistory)
│   ├── 11. Navigation, sorting, search (setupNavigation, switchSection, setupSortableHeaders, setupSearch)
│   └── 12. init() — entry point
```

## Migration Checklist

For each migrated function:
1. Copy function into unified file at the correct section
2. Replace any reference to bare `icItems` with `window.icItems`
3. Replace any reference to bare `currentStaff` with the closure variable
4. Replace inline `saveData` calls with the unified `saveData` function
5. Verify all DOM element references exist (element IDs, class names)
6. Remove the function from `ic-inventory.js` (file will be deleted entirely at the end)

## Testing Plan

1. **Backup** both original files before any changes
2. After merge, open `ic-inventory.html` locally and test:
   - [ ] Staff selection → main interface loads
   - [ ] Dashboard shows stats + low stock items
   - [ ] Location filter works across all sections
   - [ ] Inventory section shows items grouped by sublocation
   - [ ] Click item row → Quick Update modal opens, slider works, save works
   - [ ] "Add New Item" modal opens, all fields work, save creates item
   - [ ] "Edit Details" modal opens (from Quick Update), save updates item
   - [ ] Overview table loads, sorting works, search works, level bar click opens modal
   - [ ] Double-click item name in overview → Edit Item modal
   - [ ] Full Count: start → navigate items → save & next → complete
   - [ ] History section loads activity logs
   - [ ] Switch user works
   - [ ] Navigation between all 4 sections works
3. Verify no console errors
4. Verify Firebase saves work (check RTDB after a test update)

## Rollback

If anything breaks: restore `ic-inventory.js` and `ic-inventory-app.js` from backup, restore the `<script>` tag in HTML. Instant rollback, zero data risk (both versions share the same Firebase DB).
