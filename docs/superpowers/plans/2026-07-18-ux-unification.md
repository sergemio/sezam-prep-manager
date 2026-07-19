# UX/UI Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the three pages (Prep Manager, I&C Manager, DB Editor + History) one visual language — one palette, one type scale, one button/modal/table/level-bar/tag system — without changing behaviour or shrinking any touch target.

**Architecture:** Additive token layer in the shared `:root` first (zero visual change), then a mechanical palette-to-variable sweep, then author/extend the component classes, then de-inline the JavaScript **one page at a time** with a local+tablet test gate between each. Every page loads `styles.css` first, so tokens and classes cascade everywhere.

**Tech Stack:** Vanilla CSS custom properties, vanilla JS, Firebase Realtime DB (untouched). Verification via local `http.server` + Playwright (Python sync API) + Serge's manual tablet check.

## Global Constraints

- **No `git commit` / `git push` without Serge's explicit OK** (his FONDAMENTAL rule). Commit steps below are **checkpoints**: stage, show the diff, ask. **One grouped push at the very end**, after his OK. Nothing reaches the `main` remote before that.
- **No touch-target shrinking.** Every current button/input/tap size moves **verbatim** into its class. Big = kitchen-tablet ergonomics, not a defect.
- **Preserve intentional patterns:** `SoundFX` (complete/pop/tap), gradient stat cards, the fuchsia `.btn--brand` user button + announcement banner, the blue nav differentiator, and the PIN gate **logic** (`pin-guard.js` — restyle only).
- **Behaviour, Firebase, and the data model are untouched.** This is the visual layer only.
- **Test gate between every Phase-3 page:** serve locally → test on PC → test on the tablet at the LAN IP → only then next page.
- **Playwright data-safety (non-negotiable, from `feedback_never-delete-db-data-without-asking`):** prefer **read-only** checks (load page, assert computed styles / elements / no console errors). Do **not** write to prod Firebase in a verification unless unavoidable; if a write happens, capture the record **key at creation** and delete it **by that exact key** afterwards. Never delete prod data by guessed filter. Never claim "clean" without an exhaustive check. Test item name if ever needed: `ZZ_TEST_CLAUDE_DELETE_ME`.
- **Deferred, non-blocking** (decide mid-flight, test on real data before locking): level-bar continuous-vs-stepped (Task 6 defaults to **continuous = current behaviour**); modal radius 16 vs 12 (plan uses 16); fate of fuchsia (kept for now).

---

## Testing approach (shared — referenced by every task, DRY)

**Serve locally** (once, kept running in a background shell):
```bash
cd c:/Users/serge/Claude/topics/sezam-prep-manager && python -m http.server 8958
```
Pages: `http://127.0.0.1:8958/index.html`, `.../ic-inventory.html`, `.../db-editor.html`. LAN for tablet: `http://<PC-LAN-IP>:8958/...`.

**Playwright harness** (`docs/superpowers/_uxtests/harness.py`, created in Task 1). Data loads only after staff selection, so the helper clicks a `.staff-button` first when a page needs data:
```python
from playwright.sync_api import sync_playwright
BASE = "http://127.0.0.1:8958"

def open_page(pw, path, pick_staff=False):
    b = pw.chromium.launch()
    pg = b.new_page()
    errors = []
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(f"{BASE}/{path}", wait_until="networkidle")
    if pick_staff:
        btn = pg.query_selector(".staff-button")
        if btn: btn.click(); pg.wait_for_timeout(1200)
    return b, pg, errors

def css(pg, selector, prop):
    return pg.eval_on_selector(selector, f"el => getComputedStyle(el).{prop}")
```

**Baseline snapshot** (Task 1, before any change): capture computed styles of key elements per page into `docs/superpowers/_uxtests/baseline.json`, so Phase-0/2 tasks can assert **zero visual change** and later phases can assert **intended** changes. `_uxtests/` is a scratch dir — not shipped, git-ignored or deleted before the final push.

Each task's verification = (a) Playwright: target page loads with **no console errors**, key elements present, computed styles match the task's expectation; (b) for phases that change appearance, a human/tablet look; (c) behavioural smoke (buttons open their flow, delete still confirms).

---

## Task 1: Phase 0 — Token layer + test baseline

**Files:**
- Modify: `styles.css:8-27` (extend the existing `:root`)
- Create: `docs/superpowers/_uxtests/harness.py`, `docs/superpowers/_uxtests/baseline.json`

**Produces:** all `--color-*`, `--fs-*`, `--fw-*`, `--r-*`, `--shadow-*`, `--space-*`, `--z-*` tokens consumed by every later task.

- [ ] **Step 1: Capture the baseline BEFORE editing.** Create `harness.py` (code above). Then script a snapshot of key elements on all 3 pages (e.g. `.btn--primary` bg/padding/border-radius, `.section-title` font-size, `.card` border-radius, a `.data`/`overview-table th` font-size, body background) into `baseline.json`. Run it, confirm it wrote non-empty JSON.

- [ ] **Step 2: Append the token block to the existing `:root`** (do NOT remove any existing token). Insert after `styles.css:26` (`--border-light`), before the closing `}`:

```css
    /* ---- semantic colour roles (green identity kept) ---- */
    --color-primary:#577c2b; --color-primary-hover:#496a24; --on-primary:#fff;
    --accent-green:#80b244;
    --success:var(--accent-green); --success-surface:#e8f5e9;
    --danger:#ef4444; --danger-strong:#dc2626; --danger-surface:#fee2e2;
    --warning:#f97316; --warning-text:#d97706; --warning-surface:#ffedd5;
    --info:#3b82f6; --info-surface:#e3f2fd;
    --brand-accent:#c2185b;
    /* ---- surfaces ---- */
    --bg-app:#e8e8e0; --surface:#ffffff; --surface-muted:#f5f5f0;
    /* ---- type scale (px); weights numeric only ---- */
    --fs-eyebrow:12px; --fs-caption:13px; --fs-body:15px; --fs-body-lg:16px;
    --fs-title:20px; --fs-modal:22px; --fs-section:28px; --fs-page:32px;
    --fs-stat:42px; --fs-stat-lg:48px;
    --fw-medium:500; --fw-semibold:600; --fw-bold:700; --fw-black:800;
    /* ---- radius · shadow · spacing (4px grid) ---- */
    --r-control:8px; --r-card:16px; --r-pill:9999px; --r-circle:50%;
    --shadow-card:0 2px 8px rgba(0,0,0,.06);
    --shadow-modal:0 8px 24px rgba(0,0,0,.15); --scrim:rgba(0,0,0,.5);
    --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px;
    --space-5:20px; --space-6:24px; --space-7:32px; --space-8:40px;
    /* ---- z-index ladder ---- */
    --z-overlay:100; --z-modal:1000; --z-modal-stacked:1100;
    --z-dropdown:1200; --z-toast:1300; --z-gate:2000;
```

- [ ] **Step 3: Re-run the baseline snapshot into a second file** `after0.json`. Verify: every value equals `baseline.json` (tokens are defined but unreferenced → **zero visual change**). Also assert `getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() === '#577c2b'` on each page (proves the cascade reaches all 3).

- [ ] **Step 4: No console errors** on all 3 pages (harness `errors == []`).

- [ ] **Step 5: Checkpoint (ask Serge before committing).** `git add styles.css docs/superpowers/` then, on OK: `git commit -m "feat(ui): add design-token layer to :root (additive, no visual change)"`.

---

## Task 2: Phase 1a — Quick wins (8 one-liners)

**Files:** Modify `styles.css`, `db-editor.html`.

**Consumes:** tokens from Task 1.

- [ ] **Step 1: Fix the dangling font var.** At `styles.css:364` (`.user-switch-toast`), replace `font-family: var(--font-main);` with `font-family: inherit;` (the `*` selector already sets the stack). Grep first to confirm the exact line: `grep -n "var(--font-main)" styles.css`.

- [ ] **Step 2: Uppercase the odd tag.** Find `.todo-tag.urgent` (`grep -n "todo-tag.urgent" styles.css`) and add `text-transform: uppercase;` so it matches its `.low/.task/.overdue` siblings.

- [ ] **Step 3: Promote card radius.** At `.card { ... }` (`styles.css:410`), change `border-radius: 12px;` → `border-radius: var(--r-card);` (16px). NOTE: there is a **second** `.card` at `styles.css:1369` — leave it for Task 12's reconciliation; just record it here.

- [ ] **Step 4: Delete the duplicated table CSS in HTML.** In `db-editor.html`, delete the `<style>`-block `.db-table` rules that duplicate `styles.css` (`grep -n "db-table" db-editor.html`). Zero visual change (the `styles.css` copy remains).

- [ ] **Step 5: Collapse off-white surfaces.** In `styles.css` only, replace the off-white cluster `#fafaf6`, `#f8f8f4`, `#f5f5ef`, `#f5f5f5`, `#f9f9f9`, `#f1f1f1` → `var(--surface-muted)`. Grep each (`grep -ni "#fafaf6\|#f8f8f4\|#f5f5ef\|#f9f9f9\|#f1f1f1" styles.css`) and replace case-by-case (skip any inside a gradient where it's deliberate — inspect each hit).

- [ ] **Step 6: Merge the two `.modal-backdrop` rules.** `styles.css:1350` (animation only) + `:1817` (positioning). Move the `animation` declaration into the `:1817` block and delete the `:1350` block. Keep `.modal-backdrop--stacked` (`:1830`) intact (used by `script.js:994`).

- [ ] **Step 7: Verify.** Re-run snapshot → `after1a.json`. Expected diffs vs baseline: `.card` border-radius `12px → 16px` only; everything else unchanged. No console errors on all 3 pages. Eyeball the To-Do panel (urgent tag now caps) and the DB editor table (unchanged).

- [ ] **Step 8: Checkpoint (ask).** On OK: `git commit -m "fix(ui): 8 quick wins — font var, card radius, dup CSS, surface collapse, modal-backdrop merge"`.

---

## Task 3: Phase 1b — Palette collapse (CSS files)

**Files:** Modify `styles.css`, `ic-inventory-styles.css`, `history-styles.css`.

**Consumes:** semantic colour tokens from Task 1. **This task DOES change appearance** (the point: one green, one red, one blue).

- [ ] **Step 1: Enumerate raw hex.** `grep -nEi "#[0-9a-f]{3,6}" styles.css ic-inventory-styles.css history-styles.css > /tmp/hex.txt` (use the scratchpad path on Windows). Classify each by role using this mapping:

| Found | → Token |
|-------|---------|
| `#4CAF50` on a **button/CTA** | `var(--color-primary)` |
| `#4CAF50` as a **success** mark | `var(--success)` |
| `#8cc845/#80b244` greens (non-primitive uses) | keep primitive vars; new success uses → `var(--success)` |
| reds `#f44336 #ff5252 #901818 #a12020 #c62828` | `var(--danger)`; red **text on light** → `var(--danger-strong)` |
| ambers/olive `#ca8a04 #8a6e00 #984c0c #92600a` | `var(--warning)` / text `var(--warning-text)` |
| blues `#2196F3 #3498db #2563eb` | `var(--info)` |
| body bg `#e8e8e0` (3 sites) | `var(--bg-app)` |
| `#333/#555/#777` text | `var(--text-dark/-medium/-light)` |

- [ ] **Step 2: Apply replacements**, one hit at a time, **inspecting context** (never blanket-replace — e.g. a hex inside a `linear-gradient` for a stat card is intentional, leave it). Leave the fuchsia `#c2185b/#ad1457` as-is (or `var(--brand-accent)`).

- [ ] **Step 3: Verify.** Snapshot → `after1b.json`. Assert the primary button computed `background-color` is now `rgb(87, 124, 43)` (`#577c2b`) on Prep. Assert no element still computes the retired greens/reds. No console errors. **Human look** on all 3 pages: greens/reds/blues read consistent.

- [ ] **Step 4: Checkpoint (ask).** On OK: `git commit -m "refactor(ui): collapse palette to semantic tokens in CSS"`.

---

## Task 4: Phase 1c — Palette collapse (JS inline hex)

**Files:** Modify `script.js`, `ic-inventory-app.js`, `db-editor.js`, `db-editor-ic.js`.

**Consumes:** tokens from Task 1. CSS custom properties **resolve inside inline style strings**, so `style="color: var(--danger)"` works in injected markup.

- [ ] **Step 1: Enumerate.** `grep -nEi "#[0-9a-f]{3,6}" script.js ic-inventory-app.js db-editor.js db-editor-ic.js`. Expect ~96 hits. Apply the **same mapping table as Task 3**.

- [ ] **Step 2: Replace inside template literals**, e.g. `background-color: #4CAF50` → `background-color: var(--color-primary)` inside `innerHTML`/`cssText` strings. Keep the level-bar HSL (`hsl(${hue}...)`) untouched — Task 6 owns it. Inspect each; skip computed/gradient intentional colours.

- [ ] **Step 3: Verify.** Load all 3 pages with `pick_staff=True`. No console errors. Trigger one success path visually (e.g. open a modal that shows a green button) and confirm the green is `#577c2b`/`#80b244`, not `#4CAF50`. Assert via `pg.eval_on_selector` on a JS-injected element that its colour resolves to the token value.

- [ ] **Step 4: Checkpoint (ask).** On OK: `git commit -m "refactor(ui): collapse palette to tokens in injected JS markup"`.

---

## Task 5: Phase 2a — Author/extend component classes (CSS only, additive)

**Files:** Modify `styles.css` (append a `/* === UNIFIED COMPONENTS === */` section near the existing `.btn`/`.modal-box` block ~line 1867).

**Consumes:** Task 1 tokens. **Produces:** classes `.data-table`, `.modal-title`, `.tag` (+ modifiers), `.level-bar` (+ `.level-bar-fill`, `.level-bar-text`), `.empty-state`, `.group-header`, `.form-control`; and confirms `.btn*` already covers primary/secondary/danger/brand/lg. **No markup uses them yet → zero visual change.**

- [ ] **Step 1: Verify `.btn` + modal modifiers.** Read `styles.css:1867-1905` and `:1848`. Ensure `.btn` has an explicit `font-size: var(--fs-body-lg)` and `border-radius: var(--r-control)`; add `.btn--lg { padding:16px 34px; }` if absent. Add `.modal-box--narrow { max-width:340px; }` (only `--wide` exists today; `confirmDialog` needs `--narrow`). Do NOT touch `.btn--brand` (fuchsia, kept).

- [ ] **Step 2: Add `.modal-title`:**
```css
.modal-title { font-size: var(--fs-modal); font-weight: var(--fw-bold); color: var(--primary-dark); margin: 0 0 var(--space-2); }
```

- [ ] **Step 3: Add `.data-table` (zebra + sticky uppercase headers):**
```css
.data-table { width:100%; border-collapse:collapse; }
.data-table th { font-size:var(--fs-eyebrow); font-weight:var(--fw-bold); text-transform:uppercase; letter-spacing:1px; color:var(--text-light); background:var(--bg-medium); text-align:left; padding:var(--space-3) var(--space-4); position:sticky; top:0; }
.data-table td { padding:var(--space-3) var(--space-4); font-size:var(--fs-caption); color:var(--text-dark); border:0; }
.data-table tbody tr:nth-child(even) { background:var(--surface-muted); }
.data-table tbody tr:hover { background:var(--bg-light); }
```

- [ ] **Step 4: Add `.level-bar` component** (28px bar + centred %, the most legible variant):
```css
.level-bar { position:relative; height:28px; background:#e8e8e0; border-radius:var(--r-control); overflow:hidden; }
.level-bar-fill { position:absolute; inset:0 auto 0 0; border-radius:var(--r-control); }
.level-bar-text { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:var(--fs-caption); font-weight:var(--fw-bold); }
.level-bar--mini { height:5px; border-radius:var(--r-pill); }
```

- [ ] **Step 5: Add `.tag` pill (colour-only modifiers):**
```css
.tag { display:inline-flex; align-items:center; gap:5px; font-size:var(--fs-eyebrow); font-weight:var(--fw-bold); padding:var(--space-1) var(--space-3); border-radius:var(--r-pill); }
.tag--provider { background:var(--accent-yellow); color:#6b5900; }
.tag--location { background:var(--bg-medium); color:var(--primary-dark); }
.tag--status-low { background:var(--danger-surface); color:var(--danger-strong); text-transform:uppercase; letter-spacing:.8px; }
.tag--status-ok { background:var(--success-surface); color:var(--primary-dark); text-transform:uppercase; letter-spacing:.8px; }
.tag--info { background:var(--info-surface); color:#1c66b0; }
```

- [ ] **Step 6: Add `.empty-state`, `.group-header`, `.form-control`:**
```css
.empty-state { padding:var(--space-6); text-align:center; color:var(--text-medium); font-size:var(--fs-body); }
.group-header { font-size:var(--fs-caption); font-weight:var(--fw-bold); text-transform:uppercase; letter-spacing:1px; color:var(--primary-dark); background:var(--bg-medium); padding:var(--space-3) var(--space-4); border-radius:var(--r-control); margin:var(--space-5) 0 var(--space-2); }
.form-control { width:100%; padding:var(--space-3) var(--space-4); border:1.5px solid var(--border-light); border-radius:var(--r-control); font-size:var(--fs-body-lg); box-sizing:border-box; }
.form-control:focus { outline:none; border-color:var(--primary-dark); }
```

- [ ] **Step 7: Verify additive.** Snapshot → `after2a.json`; every existing element unchanged vs `after1b`. In DevTools/Playwright confirm the new selectors exist in `document.styleSheets` but match no rendered element yet. No console errors.

- [ ] **Step 8: Checkpoint (ask).** On OK: `git commit -m "feat(ui): author unified component classes (data-table, modal-title, tag, level-bar, empty-state, group-header, form-control)"`.

---

## Task 6: Phase 2b — Shared JS helpers (`levelColor`, `confirmDialog`)

**Files:** Create `ui-helpers.js`; Modify each HTML page to load it **after** `firebase-config.js` and before the page app script.

**Produces:**
- `window.levelColor(pct) → string` — the ONE colour function. **Uses the exact current formula** (continuous), so behaviour is preserved:
```js
function levelColor(pct){ const p=Math.min(Math.max(pct,0),100); const hue=p*1.2; const sat=70, light=45; return `hsl(${hue}, ${sat}%, ${light}%)`; }
```
- `window.confirmDialog({title, message, confirmText='Delete', danger=true}) → Promise<boolean>` — mounts `.modal-backdrop > .modal-box.modal-box--narrow` with `.modal-title` + `.btn--secondary`/`.btn--danger`, resolves on click. Replaces `history.js`'s custom box and the native `confirm()` calls (wired in Tasks 9–10).

- [ ] **Step 1: Create `ui-helpers.js`** with `levelColor` (exact formula above — copy the `sat`/`light` values from `ic-inventory-app.js:385-386` verbatim after reading them, so the output is byte-identical to today) and `confirmDialog` (full implementation, ~35 lines: build nodes, append to `body`, wire buttons, `SoundFX.pop?.()` on open, resolve/remove on choice, backdrop-click = cancel, Esc = cancel).

- [ ] **Step 2: Load it** — add `<script src="ui-helpers.js"></script>` to `index.html`, `ic-inventory.html`, `db-editor.html` before their app scripts. (History runs inside pages that already include it.)

- [ ] **Step 3: Verify `levelColor` parity.** Playwright: `pg.evaluate("levelColor(0)")`, `(45)`, `(50)`, `(100)` and assert they equal the current inline formula's output at those points (compute expected in the test). Confirm `typeof window.confirmDialog === 'function'` on all 3 pages. No console errors. Nothing visually changes yet.

- [ ] **Step 4: Checkpoint (ask).** On OK: `git commit -m "feat(ui): shared ui-helpers.js (canonical levelColor + confirmDialog)"`.

---

## Task 7: Phase 3a — De-inline the Prep page

**Files:** Modify `index.html`, `script.js`. **TEST GATE page (local + tablet).**

**Consumes:** all component classes (Task 5) + helpers (Task 6).

- [ ] **Step 1: Enumerate inline sites.** `grep -nE "style=\"|\.style\.|cssText" script.js` and `grep -n "style=" index.html`. Build a checklist of each site.

- [ ] **Step 2: Replace inline styling with classes**, site by site, per this mapping (repeat the pattern for every hit):
  - inline-styled buttons / `.action-button*` / `.submit-button` → `.btn .btn--primary|--secondary|--danger` (keep any existing `.btn--brand`).
  - inline modal container styles → `.modal-backdrop` + `.modal-box` (+ `--wide/--narrow`); inline `<h2>/<h3>` title styles → `<h2 class="modal-title">`.
  - inline table styling / the Preps table → `.data-table` (markup: `<table class="data-table">`).
  - inline level bars / bare coloured numbers → `.level-bar` markup with `style="width:${pct}%; background:${levelColor(pct)}"` on `.level-bar-fill` (width + colour are the only surviving inline values — legitimately computed).
  - inline badges → `.tag .tag--*`.
  - "no items" text → `.empty-state`. Section bands → `.group-header`.
  Keep genuinely-computed inline values only: level-bar `width`/`background`, and dropdown `top/left` from `getBoundingClientRect`.

- [ ] **Step 3: Preserve.** Do not touch `SoundFX` calls, the gradient stat-card markup, or the fuchsia user button. Touch-size padding now lives in `.btn` — confirm it equals the old inline padding (read both, match).

- [ ] **Step 4: Verify — behaviour + look.** Playwright (`pick_staff=True`): no console errors; the primary count button is `.btn.btn--primary` with `background rgb(87,124,43)`; a modal opens with `.modal-title` at `22px`; the Preps table is `.data-table` (zebra: even rows `var(--surface-muted)`); delete flow still shows a confirm; `SoundFX` still fires (spy on `window.SoundFX`). **Then serve on LAN and have Serge test on the tablet.**

- [ ] **Step 5: Checkpoint (ask, after tablet OK).** `git commit -m "refactor(ui): de-inline Prep page onto unified components"`.

---

## Task 8: Phase 3b — De-inline the I&C page (largest)

**Files:** Modify `ic-inventory.html`, `ic-inventory-app.js`. **TEST GATE page.**

- [ ] **Step 1: Enumerate** (~249 sites): `grep -nE "style=\"|\.style\.|cssText" ic-inventory-app.js`.

- [ ] **Step 2: Remove the second toast.** Delete the inline toast builder in `ic-inventory-app.js` (`grep -n "toast\|showError\|showSuccess\|notification" ic-inventory-app.js`) and route all its callers through `showSuccessMessage()/showErrorMessage()` from `notifications.js` (add `<script src="notifications.js">` to `ic-inventory.html` if not already loaded).

- [ ] **Step 3: Migrate the add/edit forms** (`showAddNewItemModal`, `showEditItemDetailsModal`) from inline styles to `.modal-box`, `.modal-title`, `.form-control`, `.btn*` — these were partly done in the prior batch (`modal-box modal-box--wide`); finish removing the residual inline field styles.

- [ ] **Step 4: Overview table → `.data-table`.** Replace `.overview-table` markup/class with `.data-table` (keep the sortable-header JS + sticky behaviour; the new `th` is already sticky). Count-preview list keeps its bespoke grid but its `.count-preview-bar` → `.level-bar--mini` with `levelColor()`.

- [ ] **Step 5: Badges & bands** → `.tag--location/--provider`, `.group-header`, `.empty-state`.

- [ ] **Step 6: Verify — behaviour + look.** Playwright (`pick_staff=True`): no console errors; dashboard, count card, overview all render; "Add New Item" modal opens with `.modal-title`; a success action shows the **shared** notification (not the old Material toast); overview is `.data-table` with zebra; level bars use `levelColor`. **Tablet test with Serge.**

- [ ] **Step 7: Checkpoint (ask, after tablet OK).** `git commit -m "refactor(ui): de-inline I&C page, remove 2nd toast, unify tables/forms"`.

---

## Task 9: Phase 3c — De-inline the DB editor

**Files:** Modify `db-editor.html`, `db-editor.js`, `db-editor-ic.js`. **TEST GATE page.**

- [ ] **Step 1: Delete the inline `<style>` block** in `db-editor.html` that duplicates shared rules (the `.db-table` part was removed in Task 2; remove the rest that now lives in `styles.css`, keeping only genuinely page-specific rules).

- [ ] **Step 2: Buttons** → `.btn*`. Drop the one-off blue `.edit-button`; edit actions become `.btn--secondary` (or a `.tag--info` "Edit" pill for inline row actions).

- [ ] **Step 3: Replace the 4 native `confirm()` calls** with `await confirmDialog({title, message})`. Grep: `grep -n "confirm(" db-editor.js db-editor-ic.js`. Make the callers `async` where needed.

- [ ] **Step 4: Tables** → `.data-table`.

- [ ] **Step 5: Verify.** Playwright: no console errors; delete an item/staff/task flow now shows the branded `confirmDialog` (assert `.modal-box--narrow` appears, `.btn--danger` present) and **cancel actually cancels** (assert row still present after cancel — read-only, no real delete). Tables render as `.data-table`. **Tablet test.**

- [ ] **Step 6: Checkpoint (ask, after tablet OK).** `git commit -m "refactor(ui): de-inline DB editor, confirmDialog for deletes, data-table"`.

---

## Task 10: Phase 3d — History page

**Files:** Modify `history.js` (and `history-styles.css` if residual inline). **TEST GATE page.**

- [ ] **Step 1: Replace `history.js`'s custom delete box** with `confirmDialog()`. Grep the current box (`grep -n "modal\|confirm\|delete" history.js`).

- [ ] **Step 2: Any inline-styled history rows/badges** → `.tag`, `.group-header`, `.empty-state`, `.data-table` (if the log list is tabular).

- [ ] **Step 3: Verify.** Playwright on the history view: loads, no console errors, log entries render, delete shows `confirmDialog`, cancel keeps the entry (read-only). **Tablet test.**

- [ ] **Step 4: Checkpoint (ask, after tablet OK).** `git commit -m "refactor(ui): history uses confirmDialog + unified list styling"`.

---

## Task 11: Phase 3e — Restyle the PIN pad (highest risk)

**Files:** Modify `pin-guard.js` (**logic untouched — presentation only**). **TEST GATE page.**

- [ ] **Step 1: Read `pin-guard.js` fully** (6.2KB). Identify every inline style / injected `<style>` and the deliberate z-index override (it uses `z=20000` / a 320px box — this is intentional; map it to `var(--z-gate)` = 2000 **only if** nothing else must sit above it; otherwise keep the intent and just tokenize the value). Confirm the digit-entry, validation, and unlock logic is left byte-for-byte.

- [ ] **Step 2: Move keypad styles into classes** in `styles.css` (`.pin-gate`, `.pin-pad`, `.pin-key`, `.pin-display`) using tokens; reduce `pin-guard.js` to `classList`/`dataset` toggles. Keypad key size stays exactly as today (touch).

- [ ] **Step 3: Verify — behaviour is critical.** Playwright: the PIN gate **still appears and still gates**; typing the correct PIN unlocks; wrong PIN rejects; the gate sits above all other content (z-order). Assert key tap-target size unchanged vs baseline. No console errors. **Tablet test with Serge — do not proceed without it.**

- [ ] **Step 4: Checkpoint (ask, after tablet OK).** `git commit -m "refactor(ui): PIN pad styling moved to classes (logic unchanged)"`.

---

## Task 12: Phase 4 — Cleanup, reconcile, final push

**Files:** Modify `styles.css`, `ic-inventory-styles.css`; delete `docs/superpowers/_uxtests/`; update `memory/prep-manager/changelog.md` + `memory/changelog.md`.

- [ ] **Step 1: Delete retired systems** now that nothing references them (grep each across all files to confirm 0 refs first): `.action-button`, `.action-button--primary/--secondary`, `.secondary-button`, `.submit-button`, the CSS `.toast/.toast--success/.toast--error` block (if `notifications.js` `.notification-*` is the survivor — verify), any leftover `.provider-chip`/`.edit-button`.

- [ ] **Step 2: Reconcile the duplicate `.card`** (`styles.css:410` vs `:1369`) and confirm the single `.modal-backdrop` from Task 2 — one authoritative rule each.

- [ ] **Step 3: Full-app regression pass** (the spec's checklist) on all 3 pages via Playwright + a final tablet run with Serge: PIN gates, Save & Next writes (Serge confirms on tablet — no test write to prod), all deletes confirm, drag-reorder works, level colours map correctly (diff `levelColor` output vs baseline for a spread of real item %s), stacked modals layer, sticky headers behave, tap sizes intact, SoundFX/gradient/fuchsia intact, zero console errors.

- [ ] **Step 4: Remove scratch.** `git rm -r docs/superpowers/_uxtests` (never shipped).

- [ ] **Step 5: Update changelogs** — one dated entry in `memory/prep-manager/changelog.md` (the unification, phases, files) + one global line in `memory/changelog.md`.

- [ ] **Step 6: FINAL GROUPED PUSH — only on Serge's explicit OK.** Show the full diff summary, get his go, then `git push`. This bundles the whole unification (and, if Serge wants, the prior uncommitted UX batch already in the working tree — confirm scope with him first).

---

## Self-review notes (coverage vs spec)

- Palette collapse → Tasks 3–4; type scale + tokens → Task 1; buttons → Task 5+7; modals/`confirmDialog` → Task 6,9,10; data-table (zebra) → Task 5,7,8,9; level-bar single fn → Task 6 + all Phase-3; tags → Task 5 + Phase-3; toast consolidation → Task 8+12; inline-JS de-inlining → Tasks 7–11; PIN → Task 11; quick wins → Task 2; retire old systems → Task 12. All spec sections covered.
- Preserved items (touch sizes, SoundFX, gradient, fuchsia, PIN logic) asserted in each relevant task's verify step.
- Deferred items: level-bar defaults to continuous (Task 6); modal radius 16 (Task 5); fuchsia kept (Task 1 `--brand-accent`). None block execution.
