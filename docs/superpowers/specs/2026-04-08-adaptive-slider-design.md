# Adaptive Slider — Design Spec
> Date: 2026-04-08
> Topic: Prep Manager — quantity slider

## Problem

The current touch slider in the prep check modal is hardcoded: range 0→20 with 0.25 increments from 0 to 3, then 1-unit increments from 3 to 20. This creates three problems:

1. **Too granular for small items** that are prepped in multiples. Jébne cheese has target=1 GN1/3 but staff often prepare 2 or 3 backup containers. Current 0.25 step means estimating "1 bac + a bit left" forces a choice between 1.0 and 1.25 — not enough resolution for "about 10% left in the top container".
2. **Mostly unused range for small items**. Bacon prep target=1: 80% of the slider (3→20) is dead zone.
3. **Not enough range for large items**. Dry Mix target=25 can't even reach its target because the slider maxes out at 20.
4. **No context.** Staff sees `Current: 1 GN1/3` and a nameless slider. No visual cue of where the target is.

## Solution

Adapt slider range AND step based on the item's `targetLevel`. Add a visual target marker.

### Range + step rules

| Target | Slider range | Step |
|---|---|---|
| **≤ 3** | 0 → `max(3, target × 2)` | 0.1 |
| **4 – 5** | 0 → target × 2 | 0.5 |
| **> 5** | 0 → `ceil(target × 1.5)` | 1 (integers only) |

**Rationale:**
- **≤ 3 with step 0.1**: small prep items are often estimated visually ("about 10% left in the container"). Step 0.1 gives enough resolution for additive counting like "1 full backup + 0.1 in the working container = 1.1". Minimum range of 3 handles the common case of 2–3 backup containers for target=1 items like Jébne cheese.
- **4–5 with step 0.5**: medium items where half-units still make sense (e.g., Tomato Slice target=4, you might have 2.5 containers).
- **> 5 integers only**: high-volume items (Ayran 18 bottles, Dry Mix 25 boxes) where counting in halves is absurd. Nobody says "17.5 bottles of Ayran".

### Concrete examples

| Item | Target | Unit | New slider | Step |
|---|---|---|---|---|
| Bacon prep | 1 | GN1/9 | 0–3 | 0.1 |
| Jébne cheese | 1 | GN1/3 | 0–3 | 0.1 |
| Crackers | 2 | GN1/3 | 0–4 | 0.1 |
| Tomato Slice | 4 | GN1/3 | 0–8 | 0.5 |
| Garlic-Mayo sauce | 5 | bottle | 0–10 | 0.5 |
| Ayran BOTTLES | 18 | bottle | 0–27 | 1 |
| Dry Mix | 25 | box | 0–38 | 1 |

### Visual target marker

Add a vertical line or subtle highlight on the slider track at the position corresponding to `targetLevel`. Color: brand green (`--primary-light`). Purpose: staff sees instantly if the current value is below, at, or above target, without reading numbers.

### Context info in the modal

Below the item name, show a one-line summary:

```
Jébne cheese
Target: 1 GN1/3  •  Current: 1.1 GN1/3
```

This replaces the current bare `Current: 1 GN1/3` line and gives the staff the "what should it be" context.

## Architecture

### Where to change

All logic lives in `createTouchSlider()` at `script.js:2100`. Currently the function hardcodes `minValue = 0, maxValue = 20` and a fixed values array. We'll:

1. **Accept `targetLevel` as an option** on `createTouchSlider()`.
2. **Compute range + step from targetLevel** in a new helper `computeSliderConfig(target)`.
3. **Replace the hardcoded values array** with a generated one based on computed range + step.
4. **Render the target marker** as a new DOM element inside `.slider-container`, absolutely positioned at `(target / range) * 100%` of the track.

### Where the slider is invoked

- **Prep check flow**: `initTouchInput()` (line ~2079) — needs to pass the current item's target on each item transition (the slider already gets reset per item via `prepCheckSlider.setValue(0)`).
- **Quick Edit modal**: `modalSlider = createTouchSlider(...)` at line ~933 — same treatment.

For the prep check flow, we need to **re-configure the existing slider** (not just reset the value) when moving to the next item, since different items will have different ranges. We'll add a `reconfigure(newTarget)` method to the slider instance that rebuilds the values array and updates the target marker position.

### Context info injection

The modal HTML currently renders `Current: ${item.currentLevel} ${item.unit}` in a fixed location. We'll update that line to show both target and current in a single pill/line, applied in both the prep check interface and the quick edit modal.

## Data flow

```
User opens prep check (or quick edit)
  ↓
script.js reads prepItem.targetLevel
  ↓
createTouchSlider({ targetLevel, ... })
  ↓
computeSliderConfig(targetLevel) → { min, max, step, values[] }
  ↓
Slider renders:
  - values array used for snap-to-nearest
  - track width based on max
  - target marker positioned at (target/max) × 100%
  ↓
User drags handle → handle snaps to nearest value in values[]
  ↓
Save writes new value to Firebase
```

## Backwards compatibility

- The `createTouchSlider()` function gains one new optional parameter (`targetLevel`). If not provided, it falls back to the old behavior (range 0–20, step 0.25 up to 3, then 1). This ensures the quick edit modal keeps working if we miss a call site.
- No Firebase schema change. `targetLevel` already exists on every prep item.

## Edge cases

- **Item with no targetLevel or targetLevel = 0**: fall back to old default (0–20, mixed steps). Should not happen in practice but defensive.
- **Current value above slider max**: happens if someone mass-prepped well beyond target. Clamp to max on display, but keep the real value stored. Staff can drag to max then press `+` button if needed? Or: expand max dynamically if `currentLevel > computed max`. **Decision: expand max to `ceil(currentLevel × 1.2)` if it exceeds the computed max**, so the slider always includes the current value.
- **Step 0.1 rounding**: JavaScript floats give `0.1 + 0.2 = 0.30000000000000004`. Use `Math.round(value * 10) / 10` when generating the values array and on every update.

## Testing

Manual verification checklist (no automated tests in this codebase):

1. **Small item, no extra**: open Jébne cheese (target=1), slider should be 0–3 with 0.1 steps. Target marker at 33% of track. Drag to 1.1 → value shows 1.1.
2. **Small item, backup inventory**: set Jébne cheese to 2.5. Slider still reaches 3, handle at 83%.
3. **Medium item**: open Tomato Slice (target=4), slider 0–8 with 0.5 steps. Target marker at 50%.
4. **Large item**: open Dry Mix (target=25), slider 0–38 with integer steps only. Target marker at ~66%. Drag to 17 → value shows 17, not 17.5.
5. **Current > max**: set Dry Mix to 50 via DB editor, reopen: slider should expand to accommodate (max ≈ 60).
6. **Target info line**: for every item, below the name, shows `Target: X unit • Current: Y unit`.
7. **Save then re-open**: values persist correctly through Firebase round-trip.
8. **Quick edit modal**: same behavior as prep check modal for all the above.

## Files to change

- `C:\Users\serge\Claude\topics\sezam-prep-manager\script.js`
  - `createTouchSlider()` (~line 2100): accept `targetLevel` option, add `computeSliderConfig()` helper, generate dynamic values array, render target marker
  - `initTouchInput()` (~line 2079): pass current item's target
  - Modal setup code (~line 933): pass target from item
  - Prep check item transition: call `reconfigure(newTarget)` on the existing slider instance
  - Modal HTML rendering: replace `Current: X unit` with `Target: X unit • Current: Y unit`
- `C:\Users\serge\Claude\topics\sezam-prep-manager\styles.css`
  - Add `.slider-target-marker` style (vertical line, brand green, 2px wide, full track height)
  - Minor: adjust ticks container to accommodate varying densities

## What does NOT change

- Firebase schema
- Any other modal (staff select, can't prep, etc.)
- Prep completion / saving logic
- TODO bar logic (still `currentLevel < targetLevel * 0.5`)
- Celebration feature
- LastCheckTracker
- Checklists
