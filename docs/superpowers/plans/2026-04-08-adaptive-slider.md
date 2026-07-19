# Adaptive Slider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded 0–20 slider with an adaptive one whose range and step are computed from each item's `targetLevel`, plus a visual target marker and a richer header ("Target: X • Current: Y").

**Architecture:** All logic stays in [script.js](../../../script.js) inside `createTouchSlider()`. We add a pure helper `computeSliderConfig(target, current)` that returns `{ min, max, step, values[] }`. `createTouchSlider()` accepts a new `targetLevel` option and uses the helper to generate values. A `reconfigure(newTarget, newCurrent)` method lets the existing prep-check slider rebuild itself for each item without being destroyed. The target marker is a DOM element injected into the slider container, positioned at `(target / max) * 100%`.

**Tech Stack:** Vanilla JS, no build step, no tests framework. Manual verification via `python3 -m http.server` at each step.

**Testing approach:** No automated tests in this codebase. Each task ends with a **manual verification** step — reload the browser, check specific behavior, confirm before committing. This matches how existing features in this repo are validated.

---

## File Structure

**Modified files:**
- [script.js](../../../script.js) — all slider logic, helper function, modal header text, prep-check transition
- [styles.css](../../../styles.css) — `.slider-target-marker` styles

**No files created, no files deleted.**

---

## Task 1: Add `computeSliderConfig()` helper (pure function, no wiring yet)

**Files:**
- Modify: `C:\Users\serge\Claude\topics\sezam-prep-manager\script.js` (insert just before `createTouchSlider()` around line 2099)

- [ ] **Step 1: Add the helper function**

Insert this block immediately before the line `// Reusable touch slider creation function` (around line 2099):

```javascript
// Compute slider range and step from an item's target level.
// Rules (from spec 2026-04-08-adaptive-slider-design.md):
//   target <= 3     -> max = max(3, target*2), step 0.1
//   target 4 or 5   -> max = target*2, step 0.5
//   target > 5      -> max = ceil(target*1.5), step 1 (integers only)
// If current > computed max, expand max to ceil(current * 1.2) so the
// slider always includes the stored value.
function computeSliderConfig(targetLevel, currentLevel) {
    const target = parseFloat(targetLevel) || 0;
    const current = parseFloat(currentLevel) || 0;

    let max, step;
    if (target <= 0) {
        // Defensive fallback matching legacy behaviour
        max = 20;
        step = null; // null = use legacy mixed steps
    } else if (target <= 3) {
        max = Math.max(3, target * 2);
        step = 0.1;
    } else if (target <= 5) {
        max = target * 2;
        step = 0.5;
    } else {
        max = Math.ceil(target * 1.5);
        step = 1;
    }

    // Expand max if current value exceeds it
    if (current > max) {
        max = Math.ceil(current * 1.2);
    }

    // Generate values array
    const values = [];
    if (step === null) {
        // Legacy fallback: 0..3 by 0.25, then integers
        for (let i = 0; i <= 12; i++) values.push(i * 0.25);
        for (let i = 4; i <= max; i++) values.push(i);
    } else if (step === 1) {
        for (let i = 0; i <= max; i++) values.push(i);
    } else {
        // Use integer arithmetic to avoid float drift (0.1 + 0.2 problem)
        const stepInt = Math.round(step * 10); // 1 for 0.1, 5 for 0.5
        const maxInt = Math.round(max * 10);
        for (let i = 0; i <= maxInt; i += stepInt) {
            values.push(Math.round(i) / 10);
        }
    }

    return { min: 0, max: max, step: step, values: values };
}
```

- [ ] **Step 2: Manually verify the helper in the browser console**

Start the server:
```bash
cd "C:/Users/serge/Claude/topics/sezam-prep-manager" && python3 -m http.server 8080
```

Open http://localhost:8080, open DevTools console, paste:
```javascript
console.log(computeSliderConfig(1, 0));   // expect max:3, step:0.1, values starts 0,0.1,0.2...
console.log(computeSliderConfig(2, 0));   // expect max:4, step:0.1
console.log(computeSliderConfig(4, 0));   // expect max:8, step:0.5
console.log(computeSliderConfig(18, 0));  // expect max:27, step:1, integer values
console.log(computeSliderConfig(25, 0));  // expect max:38, step:1
console.log(computeSliderConfig(1, 2.5)); // current=2.5 still fits in max=3
console.log(computeSliderConfig(1, 5));   // current=5 > max=3, expect max:6
console.log(computeSliderConfig(0, 0));   // defensive: max:20, step:null (legacy)
```

Expected: each call returns the expected `max`, `step`, and a `values` array starting at 0. For `step=0.1` cases, verify no float drift (e.g. `values[3] === 0.3`, not `0.30000000000000004`).

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/serge/Claude/topics/sezam-prep-manager" && git add script.js && git commit -m "feat(slider): add computeSliderConfig() helper

Pure function that maps an item's target level to slider range and
step. Not wired up to createTouchSlider yet — next commit.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Wire `computeSliderConfig()` into `createTouchSlider()`

**Files:**
- Modify: `C:\Users\serge\Claude\topics\sezam-prep-manager\script.js` around line 2100 (inside `createTouchSlider`)

- [ ] **Step 1: Accept `targetLevel` option and replace hardcoded values array**

Find this block in `createTouchSlider` (around line 2101):

```javascript
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
```

Replace with:

```javascript
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
        targetLevel = 0
    } = options;
```

Then find this block (around line 2131):

```javascript
    // Generate values array with the right increments
    const values = [];
    for (let i = 0; i <= 12; i++) {
        values.push(i * 0.25); // 0 to 3 in 0.25 increments
    }
    for (let i = 4; i <= maxValue; i++) {
        values.push(i); // 4 to 20 in increments of 1
    }
```

Replace with:

```javascript
    // Adaptive range and step based on target level
    let sliderConfig = computeSliderConfig(targetLevel, initialValue);
    let values = sliderConfig.values;
    let currentTarget = parseFloat(targetLevel) || 0;
```

Note the `let` (not `const`) because Task 4 will mutate `values` and `currentTarget` in `reconfigure()`.

- [ ] **Step 2: Update the value display formatter**

Find this line (around line 2173):

```javascript
        valueDisplay.textContent = currentValue < 3 ? currentValue.toFixed(2) : currentValue.toFixed(0);
```

Replace with:

```javascript
        // Show 1 decimal for small-item mode (step 0.1), integers otherwise
        if (sliderConfig.step === 0.1) {
            valueDisplay.textContent = currentValue.toFixed(1);
        } else if (sliderConfig.step === 0.5) {
            valueDisplay.textContent = currentValue.toFixed(1);
        } else {
            valueDisplay.textContent = currentValue.toFixed(0);
        }
```

- [ ] **Step 3: Update tick labelling for adaptive ranges**

Find this block (around line 2199):

```javascript
            // Add labels for whole numbers (but not for every number to avoid crowding)
            if (val % 1 === 0 && (val <= 3 || val % 2 === 0)) {
                const label = document.createElement('div');
                label.className = 'tick-label';
                label.textContent = val;
                label.style.left = `${percentage}%`;
                ticksContainer.appendChild(label);
            }
```

Replace with:

```javascript
            // Label strategy: show labels at reasonable intervals so the
            // slider doesn't become a mess of numbers for large ranges.
            const max = sliderConfig.max;
            let labelInterval;
            if (max <= 4) labelInterval = 1;
            else if (max <= 10) labelInterval = 2;
            else if (max <= 20) labelInterval = 5;
            else labelInterval = 10;

            if (val % 1 === 0 && val % labelInterval === 0) {
                const label = document.createElement('div');
                label.className = 'tick-label';
                label.textContent = val;
                label.style.left = `${percentage}%`;
                ticksContainer.appendChild(label);
            }
```

- [ ] **Step 4: Manually verify with the quick-edit modal**

Still running the local server from Task 1. Reload http://localhost:8080 (hard reload: Ctrl+Shift+R).

Open the dashboard → click "Quick Edit" → pick a small-target item (e.g. **Jébne cheese**, target=1). The modal opens but since the calling code doesn't yet pass `targetLevel`, the slider should fall through the `target <= 0` branch and behave **exactly like before** (0–20, mixed steps). Confirm nothing is broken.

Expected: slider looks identical to before, saves work normally.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/serge/Claude/topics/sezam-prep-manager" && git add script.js && git commit -m "feat(slider): accept targetLevel option in createTouchSlider

When targetLevel > 0, the slider uses computeSliderConfig() to build
its range and step. When targetLevel == 0 (no caller passes it yet),
falls back to legacy behaviour so nothing breaks.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Pass `targetLevel` from the Quick Edit modal

**Files:**
- Modify: `C:\Users\serge\Claude\topics\sezam-prep-manager\script.js` around line 933 (modal slider setup)

- [ ] **Step 1: Pass targetLevel to createTouchSlider in the quick edit modal**

Find this block (around line 933):

```javascript
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
```

Replace with:

```javascript
        modalSlider = createTouchSlider({
            containerId: sliderContainer,
            valueDisplayId: 'modal-current-value',
            handleId: 'modal-handle',
            progressId: 'modal-progress',
            ticksId: 'modal-ticks',
            decreaseId: 'modal-decrease',
            increaseId: 'modal-increase',
            hiddenInputId: 'modal-current-level',
            initialValue: initialValue,
            targetLevel: parseFloat(item.targetLevel) || 0
        });
```

- [ ] **Step 2: Remove the old display-value clamp just below**

Find this block (around line 946):

```javascript
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
```

Replace with:

```javascript
        // Force an immediate update after creation
        if (modalSlider) {
            modalSlider.setValue(initialValue);
            // updateSlider() inside setValue will pick the correct format
        }
```

- [ ] **Step 3: Manually verify several items of different sizes**

Hard reload the app. Click "Quick Edit" in the dashboard header, then test each of these items:

| Item | Expected slider range | Expected step | Expected label interval |
|---|---|---|---|
| **Jébne cheese** (target=1) | 0–3 | 0.1 | every 1 (0,1,2,3) |
| **Crackers** (target=2) | 0–4 | 0.1 | every 1 (0,1,2,3,4) |
| **Tomato Slice** (target=4) | 0–8 | 0.5 | every 2 (0,2,4,6,8) |
| **Garlic-Mayo sauce** (target=5) | 0–10 | 0.5 | every 2 (0,2,4,6,8,10) |
| **Ayran BOTTLES** (target=18) | 0–27 | 1 | every 5 (0,5,10,15,20,25) |
| **Dry Mix** (target=25) | 0–38 | 1 | every 10 (0,10,20,30) |

For each: drag the handle, check that it snaps correctly, click +/− buttons, confirm the displayed value has the right format (1 decimal for 0.1/0.5 steps, integer for 1-step).

**Do not save any value** during this verification — you don't want to accidentally change real inventory data. Cancel after each test.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/serge/Claude/topics/sezam-prep-manager" && git add script.js && git commit -m "feat(slider): use adaptive range in Quick Edit modal

Pass the item's targetLevel so the slider sizes itself to the item.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Add `reconfigure()` method + wire it into the prep-check flow

**Files:**
- Modify: `C:\Users\serge\Claude\topics\sezam-prep-manager\script.js` — slider public API (around line 2287), `initTouchInput()` (line 2079), `showCurrentPrepItem()` (line 2056)

- [ ] **Step 1: Add `reconfigure()` to the returned slider API**

Find the returned API block (around line 2287):

```javascript
    // Return an API for external control
    return {
        setValue: function(value) {
            currentValue = findClosestValue(value, values);
            updateSlider();
        },
        getValue: function() {
            return currentValue;
        },
```

Replace with:

```javascript
    // Return an API for external control
    return {
        setValue: function(value) {
            currentValue = findClosestValue(value, values);
            updateSlider();
        },
        getValue: function() {
            return currentValue;
        },
        reconfigure: function(newTarget, newInitial) {
            currentTarget = parseFloat(newTarget) || 0;
            sliderConfig = computeSliderConfig(currentTarget, newInitial);
            values = sliderConfig.values;
            currentValue = findClosestValue(parseFloat(newInitial) || 0, values);
            createTicks();      // rebuild ticks for the new range
            updateSlider();     // reposition handle
            renderTargetMarker(); // reposition target marker (added in Task 5)
        },
```

Note: `renderTargetMarker()` doesn't exist yet — it will be added in Task 5. Calling a not-yet-defined function is fine because `reconfigure()` is not called until the prep check starts.

Wait — to be safe, guard the call:

```javascript
        reconfigure: function(newTarget, newInitial) {
            currentTarget = parseFloat(newTarget) || 0;
            sliderConfig = computeSliderConfig(currentTarget, newInitial);
            values = sliderConfig.values;
            currentValue = findClosestValue(parseFloat(newInitial) || 0, values);
            createTicks();
            updateSlider();
            if (typeof renderTargetMarker === 'function') renderTargetMarker();
        },
```

- [ ] **Step 2: Pass initial target in `initTouchInput()`**

Find this block (around line 2083):

```javascript
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
```

Replace with:

```javascript
        // Initialize the main prep check slider if not already done
        if (!prepCheckSlider) {
            // Use the first prep item's target as the initial configuration
            const firstItem = (typeof prepItems !== 'undefined' && prepItems.length) ? prepItems[0] : null;
            prepCheckSlider = createTouchSlider({
                containerId: document.querySelector('.slider-container'),
                valueDisplayId: 'current-value',
                handleId: 'handle',
                progressId: 'progress',
                ticksId: 'ticks',
                decreaseId: 'decrease',
                increaseId: 'increase',
                hiddenInputId: 'current-level-input',
                initialValue: 0,
                targetLevel: firstItem ? (parseFloat(firstItem.targetLevel) || 0) : 0
            });
        }
```

- [ ] **Step 3: Call `reconfigure()` on each item transition**

Find this block in `showCurrentPrepItem()` (around line 2066):

```javascript
    // Reset the slider to 0 using the slider API
    if (prepCheckSlider) {
        prepCheckSlider.setValue(0);
    } else {
        // Fallback if slider isn't initialized yet
        currentLevelInput.value = '0';
    }
```

Replace with:

```javascript
    // Reconfigure the slider for this item's target level
    if (prepCheckSlider) {
        prepCheckSlider.reconfigure(item.targetLevel, 0);
    } else {
        // Fallback if slider isn't initialized yet
        currentLevelInput.value = '0';
    }
```

- [ ] **Step 4: Manually verify the prep check flow**

Hard reload. Click "Run Check" → confirm the staff selection → go through at least 5 items of **different sizes**:
- A small target=1 item (Jébne, Bacon)
- A target=2 item (Crackers)
- A medium target=4 item (Tomato Slice)
- A large target=18 item (Ayran)
- A very large target=25 item (Dry Mix)

For each:
- Slider range matches the table from Task 3
- Ticks rebuilt correctly (no old ticks from the previous item)
- Handle starts at 0
- `+` / `−` buttons walk through the right step

**Cancel the prep check at the end** so no real data is saved.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/serge/Claude/topics/sezam-prep-manager" && git add script.js && git commit -m "feat(slider): reconfigure() rebuilds range per prep item

The main prep-check slider is created once but now reconfigures
itself for each item's target as the user steps through the check.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Visual target marker on the slider track

**Files:**
- Modify: `C:\Users\serge\Claude\topics\sezam-prep-manager\script.js` (add `renderTargetMarker` helper inside `createTouchSlider`)
- Modify: `C:\Users\serge\Claude\topics\sezam-prep-manager\styles.css` (new `.slider-target-marker` class)

- [ ] **Step 1: Add the CSS for the marker**

Find the end of the slider-related CSS in `styles.css`. Search for `.slider-container` and add the marker rules right after its block. If unsure, append these rules at the bottom of the file:

```css
.slider-target-marker {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--primary-light, #8cc845);
    border-radius: 2px;
    pointer-events: none;
    z-index: 2;
    box-shadow: 0 0 0 1px rgba(87, 124, 43, 0.3);
}
.slider-target-marker::after {
    content: '';
    position: absolute;
    top: -4px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 6px solid var(--primary-dark, #577c2b);
}
```

- [ ] **Step 2: Add `renderTargetMarker()` inside `createTouchSlider()`**

In `script.js`, find the `createTicks()` function inside `createTouchSlider` (around line 2185). Immediately after its closing brace, add:

```javascript
    // Marker element reused across reconfigures
    let targetMarkerEl = null;
    function renderTargetMarker() {
        if (!currentTarget || currentTarget <= 0) {
            if (targetMarkerEl) targetMarkerEl.style.display = 'none';
            return;
        }
        if (!targetMarkerEl) {
            targetMarkerEl = document.createElement('div');
            targetMarkerEl.className = 'slider-target-marker';
            // Insert into the container (track parent)
            container.appendChild(targetMarkerEl);
        }
        targetMarkerEl.style.display = '';
        const pct = Math.min(100, Math.max(0, (currentTarget / sliderConfig.max) * 100));
        targetMarkerEl.style.left = `calc(${pct}% - 1.5px)`;
        targetMarkerEl.title = 'Target: ' + currentTarget;
    }
```

- [ ] **Step 3: Call `renderTargetMarker()` after initial `createTicks()`**

Find this block (around line 2283):

```javascript
    // Initialize
    createTicks();
    updateSlider();
```

Replace with:

```javascript
    // Initialize
    createTicks();
    renderTargetMarker();
    updateSlider();
```

- [ ] **Step 4: Make sure the slider container is `position: relative`**

Still in `styles.css`, search for `.slider-container`. Check that it has `position: relative`. If not, add it:

```css
.slider-container {
    /* ...existing rules... */
    position: relative;
}
```

If you see `position: relative` already, skip this step.

- [ ] **Step 5: Manually verify the marker position**

Hard reload. Open Quick Edit on:
- **Jébne cheese** (target=1, max=3) → marker at 33% of track ✓
- **Tomato Slice** (target=4, max=8) → marker at 50% ✓
- **Ayran** (target=18, max=27) → marker at ~66% ✓

Then run a prep check and walk through a few items. The marker should **move** to the new target position each time you advance to the next item (this is `reconfigure()` calling `renderTargetMarker()` via the guarded `if typeof renderTargetMarker === 'function'`).

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/serge/Claude/topics/sezam-prep-manager" && git add script.js styles.css && git commit -m "feat(slider): visual target marker on the track

Small green marker with a downward triangle shows where the item's
target level sits on the slider. Repositions on each reconfigure().

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Rewrite the modal header to show Target + Current

**Files:**
- Modify: `C:\Users\serge\Claude\topics\sezam-prep-manager\script.js` around line 729 (Quick Edit modal subtitle)

- [ ] **Step 1: Update the Quick Edit modal subtitle**

Find this block (around line 729):

```javascript
    const subtitleEl = document.createElement('p');
    subtitleEl.style.margin = '5px 0';
    subtitleEl.textContent = `Current: ${item.currentLevel} ${item.unit}`;
    modalHeader.appendChild(subtitleEl);
```

Replace with:

```javascript
    const subtitleEl = document.createElement('p');
    subtitleEl.style.margin = '5px 0';
    subtitleEl.style.color = '#666';
    subtitleEl.style.fontSize = '14px';
    const targetStr = `Target: ${item.targetLevel} ${item.unit}`;
    const currentStr = `Current: ${item.currentLevel} ${item.unit}`;
    subtitleEl.innerHTML = `<strong>${targetStr}</strong> &nbsp;•&nbsp; ${currentStr}`;
    modalHeader.appendChild(subtitleEl);
```

- [ ] **Step 2: The prep check interface already shows Target**

Verify in [index.html](../../../index.html) line 189 that the prep-check interface has `<div class="prep-check-target" id="check-item-target">...</div>` — this is already updated in `showCurrentPrepItem()` at line 2064 with `Target: <strong>${item.targetLevel}</strong> ${item.unit}`. **No change needed for the prep check flow.**

- [ ] **Step 3: Manually verify the new header**

Hard reload. Quick Edit any item — the header should now read:
`**Target: 1 GN1/3** • Current: 0.5 GN1/3`

with Target in bold.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/serge/Claude/topics/sezam-prep-manager" && git add script.js && git commit -m "feat(slider): show Target + Current in Quick Edit modal header

Gives staff context for what the prep level should be, not just
what it currently is.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: End-to-end regression test (manual)

**Files:** none — verification only.

- [ ] **Step 1: Full regression run**

Hard reload. Walk through every piece of the prep manager that touches the slider:

1. **Quick Edit, small item** (Jébne cheese)
   - Header: `Target: 1 GN1/3 • Current: ...`
   - Slider: 0–3, step 0.1, target marker at 33%
   - Drag to 1.1, save. Reopen: slider should come back at 1.1.
   - (**Reset the value to its original level before closing** — don't leave your test value in production data.)

2. **Quick Edit, large item** (Dry Mix)
   - Header shows `Target: 25 box`
   - Slider: 0–38, integer step, target marker at ~66%
   - +/− buttons walk by 1
   - Cancel without saving.

3. **Run Check flow**
   - Start a prep check (use your own staff name)
   - Step through 3-4 items of varying sizes
   - Observe the slider reconfiguring each time
   - Observe the target marker moving
   - **Cancel the check at the end** — you don't want to persist the 0s.

4. **Celebration feature still works**
   - After confirming all items are at acceptable levels (or during a full prep check where you save real values), verify the celebration card still fires when the TODO is empty.

5. **Can't Prep flow**
   - Click "Can't Prep" on an item during prep check / quick edit — should still show the reason modal as before.

6. **LAST SYNC card still updates**
   - After a completed prep check, the LAST SYNC card should show "0m ago" and pastel green.

- [ ] **Step 2: Confirm with Serge before pushing**

Open the app in the browser and show it to Serge. Walk through the same items above. Wait for his approval before pushing.

- [ ] **Step 3: Push all commits to GitHub**

Only after Serge's approval:

```bash
cd "C:/Users/serge/Claude/topics/sezam-prep-manager" && git push
```

- [ ] **Step 4: Update the prep-manager changelog**

Add an entry to [C:\Users\serge\.claude\projects\C--Users-serge-Claude\memory\prep-manager\changelog.md](../../../../../.claude/projects/C--Users-serge-Claude/memory/prep-manager/changelog.md) under session 8 (or start session 9 if session 8 has been considered complete) documenting:

- The spec path: `topics/sezam-prep-manager/docs/superpowers/specs/2026-04-08-adaptive-slider-design.md`
- The plan path: `topics/sezam-prep-manager/docs/superpowers/plans/2026-04-08-adaptive-slider.md`
- The commits from this session
- Key decisions: range/step rules, target marker

Also add a one-liner to [M/changelog.md](../../../../../.claude/projects/C--Users-serge-Claude/memory/changelog.md).

---

## Rollback Plan

If anything goes badly wrong at any task:

```bash
cd "C:/Users/serge/Claude/topics/sezam-prep-manager" && git log --oneline -10
# Identify the last-good commit
git reset --hard <commit-hash>
```

Because we haven't pushed between tasks, rolling back is purely local. Nothing reaches GitHub Pages until Task 7 Step 3.

---

## Self-Review

**1. Spec coverage:**
- Range + step rules (spec section "Range + step rules") → Task 1 (helper) + Task 2 (wiring)
- Visual target marker (spec section "Visual target marker") → Task 5
- Context info "Target: X • Current: Y" (spec section "Context info in the modal") → Task 6
- Per-item reconfigure during prep check (spec "Where the slider is invoked") → Task 4
- Quick Edit modal integration (spec "Where the slider is invoked") → Task 3
- Edge case "current > max" (spec "Edge cases") → Task 1 (helper handles it)
- Edge case float rounding (spec "Edge cases") → Task 1 (integer arithmetic for 0.1 step)
- Edge case no target / target=0 (spec "Edge cases") → Task 1 (legacy fallback branch)
- Testing checklist (spec "Testing") → Task 7

All spec requirements have a corresponding task. ✓

**2. Placeholder scan:** No TBD, no "add error handling", all code blocks present. ✓

**3. Type consistency:** `reconfigure(newTarget, newInitial)` used consistently in Task 4 step 1 (definition) and Task 4 step 3 (call site: `prepCheckSlider.reconfigure(item.targetLevel, 0)`). `computeSliderConfig(targetLevel, currentLevel)` signature consistent across Task 1 (definition), Task 2 (call from createTouchSlider), Task 4 (call from reconfigure). ✓

**4. Scope check:** Single focused feature, one subsystem (the slider). No decomposition needed. ✓
