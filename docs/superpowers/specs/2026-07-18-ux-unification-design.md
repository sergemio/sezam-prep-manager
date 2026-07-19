# Sezam Prep Manager — UX/UI Unification — Design Spec

**Date:** 2026-07-18
**Status:** Approved (visual direction validated by Serge via the design-system reference sheet, 2026-07-18)
**Scope:** Give the three pages (Prep Manager `index.html`, I&C Manager `ic-inventory.html`, Database Editor `db-editor.html` + shared History) **one** visual language — one palette, one type scale, one button / modal / table / level-bar / tag system — via an **additive token layer** followed by **page-by-page de-inlining**. No functional changes. Touch ergonomics preserved throughout.

> Supersedes the partial `2026-03-21-ui-consistency-ic-manager.md` guide (which was only partly carried out). Where the two differ, this spec wins — notably control radius is **8px** here (that guide aspired to 12px).

---

## Problem

The app works and runs in production, but its visual language drifted because it was assembled over time across three pages, by multiple tools/people. A full audit (7 dimensions, all files) found the **root cause is not "bad CSS" but that most appearance is authored inline in JavaScript**, so it bypasses the stylesheet and cannot be fixed centrally:

- **449** inline `.style` assignments, **68** `style="…"` strings, **17** `cssText` blocks, **9** injected `<style>` blocks, **96** hardcoded hex — living in the JS. The PIN pad and the I&C add/edit form are built with **zero** CSS classes.

What the user actually perceives (ranked):

1. **The #1 control is a different button on each page.** "Save & Next" / "Start": `#4CAF50`, 8px, ~13px text on Prep vs `#80b244`, 12px, 14px bold on I&C.
2. **Stock level is drawn 4 ways with contradictory colour thresholds.** 45% reads amber on one tab, grey-"ok" on another. In a kitchen colour = urgency → this is misleading, not cosmetic.
3. **The two core data tables look like different products.** 11px grey ALL-CAPS + zebra (Preps/DB) vs large dark normal-case sticky headers, no stripes (I&C).
4. **Success/error feedback shows two greens and two reds** via two separate toast systems.
5. **Modal titles jump** 18.7 / 20 / 22 / 24px, grey vs olive; "delete" is a branded card in one place, a raw browser `confirm()` in another.
6. **Cards change shape** (12 vs 16px), badges are a rectangle/pill/circle zoo, form fields differ per page.

Underlying token debt: no type scale (~20 near-duplicate sizes), no spacing/radius/shadow/z-index scales, `bold` keyword mixed with numeric weights, a dangling `var(--font-main)` (never defined) at `styles.css:364`.

---

## Decisions (validated 2026-07-18)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Primary CTA green | **`#577c2b`** (dark, passes WCAG AA on white text); `#80b244` becomes accent/hover/success |
| 2 | Accent strategy | **Green + one info blue `#3b82f6`**; red/orange reserved for status only |
| 3 | Table rows | **Zebra striping** + unified sticky uppercase headers |
| 4 | Rollout | **Page by page, test-gated** (local → tablet between each), one final grouped push |

**Deferred (non-blocking, to settle mid-implementation, tested on real data before locking):**
- **Level-bar colour:** keep the current continuous red→green interpolation, or move to discrete buckets? Either way, one shared function.
- **Modal radius:** 16px (matches cards, in the validated sheet) vs 12px.
- **Fuchsia brand accent** (`#c2185b`/`#ad1457`): keep as the deliberate identity colour of the user-button + announcement banner, or fold in / retire?

---

## Non-goals & preserved (explicit)

- **No touch-target shrinking.** Every current button/tap size moves **verbatim** into its class. "Big because it's a kitchen tablet" is ergonomics, not a defect.
- **PIN gate behaviour** (`pin-guard.js`) unchanged — restyled into classes, logic untouched (highest-risk file: 100% inline today).
- **Preserved intentional patterns** from the March guide: `SoundFX` (complete/pop/tap), gradient stat cards, the fuchsia user-button-with-shine + announcement banner, the blue nav differentiator.
- **No new features.** Auto-backup and the orphaned `checklists/` node are separate pending items, out of this scope.
- **Firebase / data model / behaviour untouched.** This is purely the visual layer.

---

## Token layer — Phase 0 (`:root` additions, zero visual change)

Added to the **existing** `:root` in `styles.css` (verified: all three HTML files load `styles.css` first, so tokens cascade to `ic-inventory-styles.css` and `history-styles.css`, both of which already consume `var()`). Every existing token name is kept — this is **purely additive**; nothing moves until call-sites are repointed.

```css
/* ---- semantic colour roles (green identity kept) ---- */
--color-primary:#577c2b;  --color-primary-hover:#496a24;  --on-primary:#fff;
--accent-green:#80b244;                 /* success, bars, tints */
--success:var(--accent-green);          --success-surface:#e8f5e9;
--danger:#ef4444;  --danger-strong:#dc2626;  --danger-surface:#fee2e2;
--warning:#f97316; --warning-text:#d97706;   --warning-surface:#ffedd5;
--info:#3b82f6;    --info-surface:#e3f2fd;
--brand-accent:#c2185b;                 /* RESERVED: user button + announcement (see deferred) */

/* ---- surfaces ---- */
--bg-app:#e8e8e0;  --surface:#ffffff;  --surface-muted:#f5f5f0;

/* ---- type scale (px) — weights numeric only, `bold` keyword banned ---- */
--fs-eyebrow:12px; --fs-caption:13px; --fs-body:15px; --fs-body-lg:16px;
--fs-title:20px; --fs-modal:22px; --fs-section:28px; --fs-page:32px;
--fs-stat:42px; --fs-stat-lg:48px;
--fw-medium:500; --fw-semibold:600; --fw-bold:700; --fw-black:800;

/* ---- radius · shadow · spacing (4px grid) ---- */
--r-control:8px; --r-card:16px; --r-pill:9999px; --r-circle:50%;
--shadow-card:0 2px 8px rgba(0,0,0,.06);
--shadow-modal:0 8px 24px rgba(0,0,0,.15);  --scrim:rgba(0,0,0,.5);
--space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px;
--space-5:20px; --space-6:24px; --space-7:32px; --space-8:40px;

/* ---- z-index ladder (replaces ad-hoc 1000..20000) ---- */
--z-overlay:100; --z-modal:1000; --z-modal-stacked:1100;
--z-dropdown:1200; --z-toast:1300; --z-gate:2000;
```

---

## Unified components (Phase 2 — defined in `styles.css`, no markup change yet)

**One button** — retires `.action-button` / `.secondary-button` / `.submit-button` / inline-JS buttons / db-editor's blue `.edit-button`:
```
.btn         font-size:16px; font-weight:600; border-radius:8px; padding:14px 28px; (touch-generous kept)
.btn--primary   bg --color-primary / --on-primary
.btn--secondary bg --surface, 1.5px --border-light
.btn--danger    bg --danger
.btn--lg        padding:16px 34px  (the biggest CTAs)
```

**One modal** — extend the already-good `.modal-backdrop` / `.modal-box` (merge the two duplicate `.modal-backdrop` blocks at `styles.css:1350` + `:1817` into one):
```
.modal-box       radius --r-card; padding --space-6; shadow --shadow-modal; max-width:450px
.modal-box--narrow 340px   .modal-box--wide 500px
.modal-title     22px/700/--primary-dark, always <h2>  (replaces every inline h2/h3 style)
confirmDialog()  JS helper on .modal-box--narrow + .btn--danger/--secondary
                 → replaces history.js's custom box AND all 4 native confirm() calls
```

**One data-table** — merge `db-table` + `overview-table`:
```
.data-table th   12px/700 UPPERCASE, --text-light on --bg-medium, sticky top
.data-table td   padding --space-3/--space-4; 14px
tbody tr:nth-child(even)  zebra --surface-muted     (Serge's choice)
tbody tr:hover   --bg-light  (never filter:brightness)
```
Delete the `db-table` block duplicated verbatim inside `db-editor.html`.

**One level component** — `.level-bar` (the 28px bar + centred %) reused in Preps / DB / count / dashboard, driven by **one** `levelColor(pct)` function (continuous-vs-stepped is the deferred detail; whichever, it is the single source and is diffed item-by-item against today's colours on real data before shipping).

**One tag** — `.tag` pill (`--r-pill`, 4px 12px, `--fs-caption`), colour-only modifiers `--provider` / `--location` / `--status` / `--info` / `--action`. Kills the orphan `.provider-chip` and inline chips.

**One `.empty-state`, one `.group-header`** (filled band), **one input style** for `.input-field` / `.form-control` / `#overview-search` (1.5px `--border-light`, `--r-control`, 16px, one focus ring).

**One toast** — route I&C through the shared `notifications.js`; delete the second toast in `ic-inventory-app.js`; collapse to `--success` / `--danger` / `--warning` / `--info`.

---

## Rollout — additive & reversible

| Phase | What | Visual change | Risk |
|-------|------|---------------|------|
| **0** | Token layer added to `:root` | none | ~0 |
| **1** | Palette collapse: raw hex → `var()` (CSS **and** JS inline — vars resolve in inline strings) | "one green, one red, one blue" | low |
| **2** | Author the component classes (no markup change) | none | ~0 |
| **3** | **De-inline, one page at a time:** Prep (`index.html`/`script.js`) → I&C (`ic-inventory.html`/`ic-inventory-app.js`, biggest: ~249 inline sites + 2nd toast + add/edit form) → DB editor (delete its inline `<style>`, drop blue edit-button, kill 4 native `confirm()`) → History (`history.js` custom delete box) | per page | **here** — isolated per page, gated |
| **4** | Delete retired systems (`.action-button` etc., 2nd toast, dup `.modal-backdrop`, db-editor inline `<style>`) | none | low |

**Test gate between every Phase-3 page** (Serge's standing rule): serve locally (`python -m http.server`), test on PC, then on the tablet at the LAN IP, and only then move to the next page. Commits accumulate; **one grouped push** at the end after Serge's explicit OK.

### Quick wins (folded into Phases 0–1, zero/near-zero risk)
1. Add the token block (unblocks everything).
2. Replace `#4CAF50/#4caf50` by usage — `→ --color-primary` where it's a button/CTA, `→ --success` (`#80b244`) where it's a success indicator — killing the second green wherever the two sit side by side.
3. Fix the undefined `var(--font-main)` at `styles.css:364`.
4. Uppercase `.todo-tag.urgent` to match its ALL-CAPS siblings.
5. Promote `.card` radius 12 → 16px (`styles.css:412`).
6. Delete the `db-table` CSS duplicated inside `db-editor.html`.
7. Merge the two `.modal-backdrop` rules into one.
8. Collapse the off-white cluster (`#fafaf6/#f8f8f4/#f5f5ef/#f5f5f5/#f9f9f9/#f1f1f1`) → `--surface-muted`.

---

## Regression checklist (behaviour-critical — must pass on tablet before push)

- [ ] PIN gate still gates and its keypad still enters digits (`pin-guard.js` — highest risk).
- [ ] "Save & Next" still writes counts to Firebase.
- [ ] All delete flows still confirm before deleting (item / staff / task / log).
- [ ] Drag-reorder handles still work.
- [ ] Level colours still map to the right severity for real items after `levelColor()` unification — **diff buckets item-by-item** (a threshold shift would mis-signal urgency).
- [ ] Stacked modals (cant-prep over prep-check) still layer correctly under the new z-index ladder.
- [ ] Sticky table headers behave on the tablet.
- [ ] Every tap target keeps its current size.
- [ ] `SoundFX` still fires (complete/pop/tap); gradient stat cards intact; fuchsia user button + announcement intact.
- [ ] No console errors on any page.

---

## Impact — files touched

| File | Phases | Action |
|------|--------|--------|
| `styles.css` | 0,1,2,4 | Add tokens; palette sweep; author component classes; delete retired rules |
| `ic-inventory-styles.css` | 1,3 | Palette sweep; repoint to shared components |
| `history-styles.css` | 1 | Palette sweep (mind the `#inventory-section` shared with `index.html`) |
| `index.html` / `script.js` | 3 | De-inline Prep page |
| `ic-inventory.html` / `ic-inventory-app.js` | 1,3,4 | De-inline I&C; remove 2nd toast |
| `db-editor.html` / `db-editor.js` / `db-editor-ic.js` | 1,3,4 | Delete inline `<style>`; drop edit-button; kill `confirm()` |
| `history.js` | 3 | Replace custom delete box with `confirmDialog()` |
| `pin-guard.js` | 3 | Restyle keypad into classes (logic untouched) |
| `notifications.js` | 4 | Becomes the single toast system |

The already-shared `.control-button` stepper is the reference — the one control reused identically across pages, proving the class-based approach.

---

## Rollback

Every phase is additive and reversible. Nothing is committed to `main` remote until the final grouped push. Per-page: `git checkout -- <file>` restores instantly (working tree only). Zero data risk — all pages share the same Firebase DB, untouched by this work.
