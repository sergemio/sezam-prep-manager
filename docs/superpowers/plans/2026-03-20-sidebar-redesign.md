# Sidebar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the sidebar navigation across all 3 HTML pages (index, db-editor, ic-inventory) to be cleaner, icon-based, with proper grouping and consistent naming.

**Architecture:** The sidebar HTML is duplicated in 3 files (index.html, db-editor.html, ic-inventory.html) with shared CSS in styles.css. Each page has its own nav items but shares the same `.nav-panel` structure. Changes must be applied to all 3 pages while respecting each page's specific nav items.

**Tech Stack:** HTML, CSS (vanilla), inline SVG icons (no external dependency)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `index.html` (lines 36-57) | Modify | Main app sidebar: rename items, add icons, restructure groups |
| `db-editor.html` (lines 107-122) | Modify | DB Editor sidebar: align with new structure |
| `ic-inventory.html` (lines 29-52) | Modify | I&C Manager sidebar: align with new structure |
| `styles.css` (lines 89-194) | Modify | Sidebar CSS: icon layout, group separator, active state, user section |

## Shared SVG Icons

Use simple inline SVGs (16x16) to avoid external dependencies. Define once in each nav item as `<svg>` inside the button/link.

Icons mapping:
- Dashboard → grid icon (4 squares)
- Preps → pot/cooking icon
- Tasks → checklist icon
- History → clock icon
- Inventory → box icon
- DB Editor → gear icon
- Back / Prep Manager → arrow-left icon

---

### Task 1: Rename nav items + add icon markup in index.html

**Files:**
- Modify: `index.html:45-51`

- [ ] **Step 1: Update the nav-buttons block**

Replace lines 45-51 with:

```html
<div class="nav-buttons">
    <button class="nav-button active" data-section="dashboard">
        <svg class="nav-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M1 1h6v6H1V1zm8 0h6v6H9V1zM1 9h6v6H1V9zm8 0h6v6H9V9z"/></svg>
        Dashboard
    </button>
    <button class="nav-button" data-section="inventory">
        <svg class="nav-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L2 4v2h12V4L8 1zM2 7v7h12V7H2zm3 2h6v1H5V9z"/></svg>
        Preps
    </button>
    <button class="nav-button" data-section="history">
        <svg class="nav-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 12.5a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11zM8.5 4H7v5l4 2.5.75-1.23-3.25-1.97V4z"/></svg>
        History
    </button>
    <a href="ic-inventory.html" class="nav-button">
        <svg class="nav-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2h12v3H2V2zm0 4h12v8H2V6zm2 2v1h8V8H4zm0 2.5v1h5v-1H4z"/></svg>
        Inventory
    </a>
    <a href="db-editor.html" class="nav-button nav-admin">
        <svg class="nav-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a2.5 2.5 0 0 0-.5 4.95V7H5a2 2 0 0 0-2 2v1.05A2.5 2.5 0 1 0 5 12.95V11h6v1.95a2.5 2.5 0 1 0 2-2.9V9a2 2 0 0 0-2-2H8.5V4.95A2.5 2.5 0 0 0 8 0z"/></svg>
        DB Editor
    </a>
</div>
```

- [ ] **Step 2: Update user-info block**

Replace lines 53-57 with:

```html
<div class="user-info">
    <div class="user-label">USER:</div>
    <div class="user-name" id="current-user">Serge Men</div>
    <button class="switch-user-btn" id="switch-user">SWITCH</button>
</div>
```

- [ ] **Step 3: Verify — open index.html in browser**

Check:
- All 5 nav items visible with icons (Dashboard, Preps, History, Inventory, DB Editor)
- "Dashboard" is active (green highlight)
- DB Editor is visually separated from the rest
- USER section at bottom shows name + SWITCH button
- Clicking each nav item still works (Dashboard, Preps, History switch sections)
- "Inventory" and "DB Editor" links navigate to correct pages

---

### Task 2: Align db-editor.html sidebar

**Files:**
- Modify: `db-editor.html:107-122`

- [ ] **Step 1: Update db-editor sidebar**

Replace lines 107-122 with:

```html
<div class="nav-panel">
    <div class="logo-container">
        <a href="index.html" style="cursor: pointer;">
            <img src="logo.png" alt="Company Logo" class="company-logo">
        </a>
    </div>
    <div class="nav-title">DB EDITOR</div>

    <div class="nav-buttons">
        <a href="index.html" class="nav-button">
            <svg class="nav-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M10 1L3 8l7 7V11h5V5h-5V1z"/></svg>
            Back to App
        </a>
    </div>

    <div class="user-info">
        <div class="user-label">Admin Mode</div>
    </div>
</div>
```

- [ ] **Step 2: Verify — open db-editor.html**

Check:
- "Back to App" has arrow icon
- Link navigates back to index.html
- Layout not broken (no phantom column bug regression)

---

### Task 3: Align ic-inventory.html sidebar

**Files:**
- Modify: `ic-inventory.html:29-52`

- [ ] **Step 1: Update ic-inventory sidebar**

Replace lines 29-52 with:

```html
<div class="nav-panel">
    <div class="logo-container">
        <a href="index.html" style="cursor: pointer;">
            <img src="logo.png" alt="Company Logo" class="company-logo">
        </a>
    </div>

    <div class="nav-title">I&C MANAGER</div>

    <div class="nav-buttons">
        <button class="nav-button active" data-section="dashboard">
            <svg class="nav-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M1 1h6v6H1V1zm8 0h6v6H9V1zM1 9h6v6H1V9zm8 0h6v6H9V9z"/></svg>
            Dashboard
        </button>
        <button class="nav-button" data-section="inventory">
            <svg class="nav-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2h12v3H2V2zm0 4h12v8H2V6zm2 2v1h8V8H4zm0 2.5v1h5v-1H4z"/></svg>
            Inventory
        </button>
        <button class="nav-button" data-section="history">
            <svg class="nav-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 12.5a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11zM8.5 4H7v5l4 2.5.75-1.23-3.25-1.97V4z"/></svg>
            History
        </button>
        <button class="nav-button" data-section="overview">
            <svg class="nav-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M1 3h14v1H1V3zm0 3h14v1H1V6zm0 3h10v1H1V9zm0 3h12v1H1v-1z"/></svg>
            Overview
        </button>
        <a href="index.html" class="nav-button nav-admin">
            <svg class="nav-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M10 1L3 8l7 7V11h5V5h-5V1z"/></svg>
            Prep Manager
        </a>
        <a href="db-editor.html" class="nav-button nav-admin">
            <svg class="nav-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a2.5 2.5 0 0 0-.5 4.95V7H5a2 2 0 0 0-2 2v1.05A2.5 2.5 0 1 0 5 12.95V11h6v1.95a2.5 2.5 0 1 0 2-2.9V9a2 2 0 0 0-2-2H8.5V4.95A2.5 2.5 0 0 0 8 0z"/></svg>
            DB Editor
        </a>
    </div>

    <div class="user-info">
        <div class="user-label">USER:</div>
        <div class="user-name" id="current-user"></div>
        <button class="switch-user-btn" id="switch-user">SWITCH</button>
    </div>
</div>
```

- [ ] **Step 2: Verify — open ic-inventory.html**

Check:
- All nav items have icons
- Dashboard active by default
- "Prep Manager" and "DB Editor" separated as admin links
- Switching sections still works
- USER section matches index.html style

---

### Task 4: Update sidebar CSS (icons, grouping, active state, user section)

**Files:**
- Modify: `styles.css:89-194`

- [ ] **Step 1: Add .nav-icon styles**

After `.nav-button` rule (after line 137), add:

```css
.nav-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    opacity: 0.85;
}
```

- [ ] **Step 2: Update .nav-button to flex layout for icon+text**

Change `.nav-button` (line 127) to include:

```css
.nav-button {
    background: none;
    border: none;
    color: white;
    text-align: left;
    padding: 12px 14px;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s, transform 0.1s;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 15px;
    text-decoration: none;
}
```

- [ ] **Step 3: Update .nav-button.active for rounder, subtler look**

```css
.nav-button.active {
    background-color: rgba(255, 255, 255, 0.18);
    color: white;
    font-weight: 600;
    box-shadow: none;
}

.nav-button.active .nav-icon {
    opacity: 1;
}
```

- [ ] **Step 4: Add .nav-admin separator**

Replace the existing DB Editor divider rule (lines 150-157) with:

```css
.nav-admin {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.nav-admin + .nav-admin {
    margin-top: 0;
    padding-top: 0;
    border-top: none;
}
```

- [ ] **Step 5: Update .switch-user-btn to solid green**

```css
.switch-user-btn {
    background-color: var(--primary-light);
    border: none;
    color: var(--primary-dark);
    cursor: pointer;
    font-size: 13px;
    font-weight: 700;
    padding: 8px 10px;
    text-align: center;
    border-radius: 6px;
    width: 100%;
    transition: opacity 0.2s;
    letter-spacing: 0.5px;
}

.switch-user-btn:hover {
    opacity: 0.85;
}
```

- [ ] **Step 6: Update .user-label**

```css
.user-label {
    color: white;
    opacity: 0.6;
    margin-bottom: 4px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
}
```

- [ ] **Step 7: Verify styles on all 3 pages**

Open each page and check:
- Icons aligned with text, proper spacing
- Active state is subtle white overlay (not bright green)
- Admin links (DB Editor, Prep Manager) have top border separator
- SWITCH button is solid green
- USER: label is small caps
- No layout breakage on any page

---

### Task 5: Verify nav functionality (JS handlers)

**Files:**
- Read: `script.js` (nav click handler)
- Read: `ic-inventory-app.js` (nav click handler)

- [ ] **Step 1: Verify all data-section values match existing section IDs**

In index.html:
- `dashboard` → `#dashboard-section` ✓
- `inventory` → `#inventory-section` ✓
- `history` → `#history-section` ✓

Note: Tasks nav button NOT included — tasks are displayed in the to-do panel, not as a separate section. If a dedicated Tasks section is added later, the nav button can be added then.

In ic-inventory.html:
- `dashboard` → `#dashboard-section` ✓
- `inventory` → `#inventory-section` ✓
- `history` → `#history-section` ✓
- `overview` → `#overview-section` ✓

- [ ] **Step 4: Check mobile responsive CSS**

Lines ~996-1050 in styles.css have mobile overrides for `.nav-panel`. Verify the new `.nav-icon` and flex layout don't break mobile.

- [ ] **Step 5: Commit**

```bash
git add index.html db-editor.html ic-inventory.html styles.css
git commit -m "feat: redesign sidebar nav — icons, renamed items, consistent grouping across 3 pages"
```

---

## Verification Checklist (final)

- [ ] index.html: all nav items clickable, sections switch correctly
- [ ] index.html: DB Editor + Inventory links navigate to correct pages
- [ ] db-editor.html: "Back to App" navigates to index.html
- [ ] db-editor.html: table layout not broken (no phantom column)
- [ ] ic-inventory.html: all nav items clickable, sections switch
- [ ] ic-inventory.html: "Prep Manager" + "DB Editor" links work
- [ ] Mobile: sidebar collapses/stacks properly on small screens
- [ ] No JS console errors on any page
