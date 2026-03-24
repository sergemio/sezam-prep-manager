# I&C Manager UI Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the I&C Manager visually consistent with the Prep Manager dashboard redesign done today.

**Architecture:** CSS-only changes where possible, minimal JS tweaks. The I&C Manager uses its own `ic-inventory-styles.css` and shares `styles.css`. The blue nav bar stays as differentiator.

**Tech Stack:** Vanilla CSS, vanilla JS, Firebase Realtime DB (no changes)

---

## UI Style Guide (established today on Prep Manager)

| Element | Style |
|---------|-------|
| **Border radius** | 16px cards, 12px buttons, 9999px pills/badges |
| **Shadows** | `0 2px 8px rgba(0,0,0,0.06)` light, `0 3px 12px rgba(0,0,0,0.08)` medium |
| **Stat cards** | Gradient bg `linear-gradient(135deg, #f7f9f5 0%, #eef4e4 100%)`, value 36-48px bold, label 12-13px uppercase |
| **Section labels** | 13px, 700 weight, uppercase, letter-spacing 1px, color `var(--text-light)` |
| **Buttons** | `.btn` classes: `--primary` (green), `--secondary` (grey), `--danger` (red), `--brand` (fuchsia) |
| **Modals** | `.modal-backdrop` + `.modal-box` (24px padding, 12px radius, 450px max-width) |
| **Toasts** | `.toast` + `--success` / `--error` classes |
| **Badges** | Pill shape (9999px radius), outlined or filled |
| **Font sizes** | Titles 28px, card values 36-48px, body 15-16px, labels 12-13px |
| **Inline styles** | NEVER in JS — use CSS classes |
| **Sounds** | `SoundFX.complete()` on completion, `.pop()` on modal open, `.tap()` on navigation |

## Differences Found: I&C Manager vs Prep Manager

| Area | I&C Manager (current) | Should be |
|------|----------------------|-----------|
| **Dashboard cards** | `.card` with `.card-title` h2, flat stat cards | Gradient stat cards like dashboard, no wrapping `.card` |
| **"Current Status" stats** | Small `.stat-value`, no gradient, basic layout | Large values (36px+), gradient bg, uppercase labels |
| **Section header** | `h1.section-title` + basic `.user-login-btn` text | Same style as Prep Manager header (Overview + fuchsia button with shine) |
| **"Start Full Count" button** | Old `.action-button` class | `.btn .btn--primary` |
| **Location filter buttons** | Basic rounded 6px | 12px radius, pill-style to match badges |
| **Inventory table** | Works fine visually | Minor: table header 8px radius top corners |
| **History page** | Same issues as Prep Manager history (fixed there) | Already shares `history-styles.css` — should inherit fixes |
| **Modals (count check)** | Likely inline styles (from original code) | `.modal-backdrop` + `.modal-box` classes |
| **Toasts/notifications** | Likely inline styles | `.toast` classes |
| **Sounds** | None | Wire `SoundFX` to count completion, modal opens, navigation |
| **User login button** | "Logged as: User" text style | Fuchsia button with shine + dropdown like Prep Manager |

---

### Task 1: Dashboard Header & Stat Cards

**Files:**
- Modify: `ic-inventory.html:82-102` (dashboard section HTML)
- Modify: `ic-inventory-styles.css` (add dashboard-specific styles)

- [ ] **Step 1: Update dashboard header HTML**

Replace the `section-header` div with centered title + fuchsia user button matching Prep Manager.

```html
<div class="section-header" style="display: flex; justify-content: space-between; align-items: center;">
    <h1 class="section-title">I&C Dashboard</h1>
    <!-- user button stays, will be styled in Task 5 -->
</div>
```

- [ ] **Step 2: Replace stat cards with gradient style**

Replace the flat `.card > .stats-grid > .stat-card` structure with standalone gradient cards matching Prep Manager dashboard.

- [ ] **Step 3: Update "Start Full Count" button to use `.btn .btn--primary`**

Replace `class="action-button"` with `class="btn btn--primary"`.

- [ ] **Step 4: Verify dashboard renders correctly**

Open `ic-inventory.html` locally, check stat cards have gradient, button is green rounded.

- [ ] **Step 5: Commit**

```bash
git add ic-inventory.html ic-inventory-styles.css
git commit -m "feat(ic): modernize dashboard — gradient stat cards, btn classes"
```

---

### Task 2: Location Filter Buttons

**Files:**
- Modify: `ic-inventory-styles.css:9-24` (location button styles)

- [ ] **Step 1: Update location button styles**

Change border-radius from 6px to 9999px (pill), adjust padding, add transition.

```css
.location-button {
    background-color: #f5f5f0;
    color: var(--text-dark);
    border: none;
    padding: 8px 18px;
    border-radius: 9999px;
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
    transition: all 0.2s;
}

.location-button.active {
    background-color: var(--primary-medium);
    color: white;
}

.location-button:hover:not(.active) {
    background-color: #eceee6;
}
```

- [ ] **Step 2: Verify filters look correct on Dashboard and Inventory tabs**

- [ ] **Step 3: Commit**

```bash
git add ic-inventory-styles.css
git commit -m "feat(ic): pill-style location filter buttons"
```

---

### Task 3: Card Wrappers & Section Labels

**Files:**
- Modify: `ic-inventory.html` (remove wrapping `.card` divs where unnecessary, update card-titles to uppercase labels)
- Modify: `ic-inventory-styles.css` (add `.ic-section-label` style)

- [ ] **Step 1: Replace h2.card-title with uppercase section labels**

The "Current Status", "Location Filter", "Start Full Count" titles should be 13px uppercase labels, not h2 headings inside cards.

- [ ] **Step 2: Verify layout**

- [ ] **Step 3: Commit**

```bash
git add ic-inventory.html ic-inventory-styles.css
git commit -m "feat(ic): replace card-title headings with section labels"
```

---

### Task 4: I&C Modals & Toasts — Migrate Inline Styles

**Files:**
- Modify: `ic-inventory-app.js` (the main JS for I&C)
- Verify: modals use `.modal-backdrop` + `.modal-box`, toasts use `.toast` classes

- [ ] **Step 1: Scan ic-inventory-app.js for inline modal/toast styles**

```bash
grep -n "style\.\|cssText" ic-inventory-app.js | head -40
```

- [ ] **Step 2: Replace modal inline styles with `.modal-backdrop` + `.modal-box` classes**

Same pattern as script.js migration done today.

- [ ] **Step 3: Replace toast inline styles with `.toast .toast--success` / `.toast--error`**

- [ ] **Step 4: Verify count check modal opens and works**

- [ ] **Step 5: Verify toast appears after saving a count**

- [ ] **Step 6: Commit**

```bash
git add ic-inventory-app.js
git commit -m "feat(ic): migrate modal and toast inline styles to CSS classes"
```

---

### Task 5: User Button — Fuchsia with Shine + Dropdown

**Files:**
- Modify: `ic-inventory.html:85-87` (user button markup)
- Modify: `ic-inventory-app.js` (add dropdown toggle)

- [ ] **Step 1: Update user button HTML**

Replace `Logged as: <span>` with the same `.user-login-btn` structure as Prep Manager.

- [ ] **Step 2: Wire dropdown (reuse `toggleModalUserDropdown` pattern or add inline)**

- [ ] **Step 3: Verify button has shine effect and dropdown works**

- [ ] **Step 4: Commit**

```bash
git add ic-inventory.html ic-inventory-app.js
git commit -m "feat(ic): fuchsia user button with shine and dropdown"
```

---

### Task 6: Wire Sound Effects

**Files:**
- Modify: `ic-inventory.html` (add `<script src="sounds.js">`)
- Modify: `ic-inventory-app.js` (add SoundFX calls)

- [ ] **Step 1: Add sounds.js script tag before ic-inventory-app.js**

- [ ] **Step 2: Wire `SoundFX.complete()` to count save/completion**

- [ ] **Step 3: Wire `SoundFX.pop()` to modal opens**

- [ ] **Step 4: Wire `SoundFX.tap()` to navigation switches**

- [ ] **Step 5: Verify sounds play on count completion**

- [ ] **Step 6: Commit**

```bash
git add ic-inventory.html ic-inventory-app.js
git commit -m "feat(ic): wire sound effects — complete, pop, tap"
```

---

### Task 7: Final Consistency Check

- [ ] **Step 1: Side-by-side comparison**

Open Prep Manager and I&C Manager, verify:
- Same border-radius on cards (16px)
- Same button styles
- Same stat card gradients
- Same modal look
- Same toast appearance
- Sounds work on both

- [ ] **Step 2: Mobile/tablet check**

Verify nothing breaks at smaller viewport (the tablet at the restaurant).

- [ ] **Step 3: Final commit if any tweaks needed**

- [ ] **Step 4: Update changelog**

Add session entry to `memory/prep-manager/changelog.md`.
