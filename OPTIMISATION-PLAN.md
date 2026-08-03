# Plan d'action — Optimisation (hygiène/taille/robustesse du code)
> Last update: 2026-07-27
> ⚠️ « Optimisation » pour Serge = **taille du code, hygiène, non-redondance, lisibilité, robustesse** — PAS la vitesse UX. Robustesse d'abord (outil de travail). Voir mémoire [[feedback_perf-means-code-hygiene]].

**Méthode (règle) :** tout en LOCAL, testé (Playwright + screenshot) **entre chaque phase**, **un module à la fois**, **jamais big-bang**. **Push seulement sur « go push » explicite de Serge.** Serveur local : `python -m http.server 8971` (PC http://127.0.0.1:8971, tablette 192.168.1.41).

---

## ✅ AVANCEMENT (session 2026-07-27) — décisions verrouillées : format date « 9 Mar, 14:30 » (EN), périmètre 0→5 complet, Phase 4 OUI. Push : sur « go push » seulement.
- **PHASE 0 FAITE** : 4 CSS mortes retirées (`.todo-tag.urgent`, `.move-button`, `tr.drag-placeholder td`, `.overview-table .sublocation-value`). Accolades OK, PM+I&C 0 erreur.
- **PHASE 1 FAITE** : dans `ui-helpers.js` → `formatDate` unifié (day-first « 9 Mar, 14:30 », bug ordre I&C corrigé), `makeSaver(opts)` (2 saveData → 1), `initials(name)` (×6 → 1, cap 2 lettres). Testé 0 erreur, helpers vérifiés au runtime.
- **PHASE 2 FAITE** : `UserSession.loadStaff()` = loader unique pour les 4 sites (PM grid, I&C grid, PM prep-check modal, I&C count modal). PM routé 100% via UserSession (subscriber mirror ajouté ; boot/switch/dropdowns×2/confirm modal) → plus AUCUNE écriture manuelle `currentStaff`/localStorage. Dropdowns PM dédupliqués (`appendStaffItems`). Bug **« Serge Men » → « Serge M »** corrigé (fallback I&C modal). `showUserSwitchToast` mort retiré. Testé exhaustivement (boot/login/switch/reload/dropdown/2 modals, PM+I&C) 0 erreur.
- **PHASE 3 FAITE (hygiène seule)** : Serge a choisi hygiène-seule, unification visuelle DIFFÉRÉE (moins de risque de régression). Retiré les stubs morts jamais branchés `.data-table` + `.tag`. Live tables/boutons inchangés. 0 erreur, aucun markup touché.
- **PHASE 4 FAITE (cœur sûr)** : audit-first. Doublons de valeur → source unique par ALIAS sans toucher aucun usage : `--color-primary: var(--primary-dark)`, `--accent-green: var(--primary-medium)`. Vérifié au runtime (résolvent #577c2b / #80b244 à l'identique). 0 pixel changé.
- **PHASE 5 FAITE** : détecteur dead-CSS conservateur (substring + garde prefix). `.summary-line.*` (3 règles) mortes → retirées. Tous les `.action-*` re-confirmés LIVE (`action-${log.actionType}` dans history.js:116 ET ic-inventory-app.js:2991) → GARDÉS. Accolades OK (styles 311/311, ic 69/69, history 65/65). 3 pages (PM/I&C/DB) 0 erreur, screenshot PM = intact.

## 🔵 DIFFÉRÉ (sessions dédiées, screenshot-diff par écran — décidé le 2026-07-27/28)
- **Unification visuelle (ex-Phase 3 complète)** : brancher un `.data-table`/`.tag`/`.btn` unique → tables + badges + boutons IDENTIQUES sur PM/I&C/DB. = changement d'apparence, risque de régression. À faire quand Serge le demande explicitement.
- **Élimination couche historique (ex-Phase 4 complète)** : renommer tous les usages vers 1 nom canonique par rôle + balayage hardcodes→tokens (~15 ombres/hex). Large et risqué (intention zéro-visuel mais surface large). Session dédiée.
- **Hors-scope repéré** : `db-editor.js:551` seed `{ name: "Serge Men" }` (page DB Editor, ne charge pas user.js ; le live Firebase a « Serge M »). Non touché — à corriger si Serge veut.

## ⚠️ STATUT : tout LOCAL, RIEN poussé. Prêt à push sur « go push ».

---

# ROUND 2 — Plan d'unification cross-module (audit 2026-07-28, 3 agents lecture seule)

Objectif Serge : code le plus clean possible, compréhensible, robuste, sans lignes superflues/redondantes qui sont des points de casse/conflit. Attaquer étape par étape, du plus fort impact/plus faible risque au plus risqué.

## VAGUE A — ✅ FAITE (2026-07-28, testée nav PM+I&C + db-editor, 0 erreur)
- A1 : `byDisplayOrder` dans ui-helpers, branché aux **4 sites exacts** (script.js inline+`sortItemsByDisplayOrder`, db-editor.js `sortPrepItems`, db-editor-ic.js `sortIcItems`). **Count-queue I&C (ic:1453) EXCLU** (fallback final = `name`, pas `id` → comportement préservé).
- A2 : `activateSection` dans ui-helpers (shell nav partagé) ; les 2 `switchSection` = wrappers minces + dispatch propre.
- A3 : seed db-editor « Serge Men » → « Serge M ».

## VAGUE A — Logique pure, ZÉRO risque visuel (à faire en premier) [détail]
- **A1. `byDisplayOrder(a,b)` → ui-helpers.js** : le comparateur `displayOrder` (items avec displayOrder d'abord, sinon id) est ré-implémenté dans **5 fichiers** (script.js `sortItemsByDisplayOrder` L1803 + copie inline L148-157 qui duplique son PROPRE helper ; ic `sortItems` L786/1454 ; db-editor.js L41 ; db-editor-ic.js L27). Extraire le tie-breaker commun. **~40 l., risque BAS, pas d'UI.** Corrige aussi l'auto-duplication de script.js.
- **A2. `switchSection` shell → partagé** : shell IDENTIQUE ligne à ligne dans les 2 modules (SoundFX.tap → navButtons remove active → add active → hide sections → show section). Seul le dispatch de refresh par section diffère (`inventory/dashboard/history/overview`). Factoriser le shell, passer `{navButtons, contentSections, onSection:{sectionId→cb}}`. **~20 l., risque BAS-MED, pas de régression visuelle (logique nav).** Meilleur ratio des paires homonymes.
- **A3. db-editor `"Serge Men"` → `"Serge M"`** (db-editor.js L550-556) : seed Firebase (pas fallback runtime) — si la collection staff est vidée, db-editor ré-écrit « Serge Men » qui ne matche plus le canonique « Serge M » (UserSession). **~1 l., risque BAS, data-integrity.**
- **A4. (option) `countBelowHalf(items)`** : mini-helper `currentLevel < targetLevel*0.5`, commun à updateStats des 2 modules. ~1 l. Marginal.

## VAGUE B — ✅ FAITE (2026-07-28, testée, 0 erreur). Serge a choisi « tout unifier sur le canonique ».
- `showErrorNotification` supprimé + les **3 toasts inline** PM (`X updated`, `Can't Prep`, `can prep again`) → `showNotification` (notifications.js). Système `.toast` entièrement retiré (JS ~24 l. + CSS ~17 l. + commentaire de section). **PM et I&C partagent enfin UN seul style de toast** (le canonique `.app-notification`). Testé : toast canonique s'affiche, plus aucun `.toast`, 0 erreur, accolades 308/308.

## VAGUE B — Notifications (petit, low-med, léger visuel) [détail original]
- **B1. Retirer `showErrorNotification` (script.js L124-136) → `showNotification` de notifications.js** (canonique ; `showMessage` d'I&C l'enveloppe déjà). Vrai jumeau (2e teardown à la main). **~12 l., 2 sites, risque BAS-MED** (change le style des toasts d'erreur PM vers le style canonique = unification voulue). `showSwitchToast` (user.js) = distinct, GARDÉ.

## VAGUE C — ✅ FAITE (2026-07-28, 11 modals migrés, testés open/close Escape+backdrop, 0 erreur)
- `openModal({ body?, boxClass?, onClose? }) -> {backdrop, box, close}` créé dans ui-helpers (backdrop + box + close idempotent + clic-hors + **Escape** partout). Pas de son ni boutons auto.
- **11 modals migrés** (script.js ×5 : showQuickUpdateModal[slider→onClose destroy], showCantPrepReasonModal[backdrop empilé via classList.add], showTaskModal, showPrepCheckStaffModal[Promise→resolveFn+settle idempotent], showSingleItemUpdateModal ; ic ×6 : showPurgeModal, showEditItemModal, showStaffSelectionModal[Promise], showQuickUpdateModal[slider], showAddNewItemModal, showEditItemDetailsModal). Aucun code manuel `modal-backdrop`/`closeModal` résiduel. Slider cleanup centralisé dans onClose (toutes fermetures). Migration par ALIAS (corps des modals inchangé). Testé : les 11 ouvrent + ferment (Escape + clic-hors), staff modals peuplés, 0 erreur, screenshot PM intact.
- **Bilan lignes session** : script.js 2466→2047 (−419), ic 3240→2988 (−252), styles.css 2213→1999 (−214) ; ui-helpers grossit (helpers partagés).

## VAGUE C — Scaffolding modal (PLUS GROS IMPACT, med, visuel → STAGÉ) [détail original]
- **C1. `openModal({title, bodyEl, buttons, onClose}) → {close, box, backdrop}` dans ui-helpers** (modelé sur `confirmDialog` existant L29). **11 modals hand-built** (script.js: 497,849,1474,1639,2094 ; ic: 506,1348,1647,1827,2239,2750) répètent backdrop+box+closeModal+clic-hors-modal. Absorbe aussi les **7 `closeModal`** (script 740/947/1701 ; ic 678/2138/2563/2815) + les handlers backdrop-click. **~90-130 l. récupérables, risque MED (régression visuelle possible).**
  - ⚠️ à cadrer : exposer `onClose` pour le cas slider (`modalSlider.destroy()` avant removeChild, script.js:740-746) ; ajouter Escape-to-close partout (aujourd'hui 0 modal ne gère Escape → amélioration mais changement de comportement) ; nettoie les `console.log` debug d'ic:678.
  - **Migrer modal par modal + screenshot par modal.**

## VAGUE D — ✅ FAITE (2026-07-28, testée, 0 erreur, 0 dialogue natif)
- D1 : **20 `alert()` I&C → `showMessage(msg,'error')`** (toast non-bloquant) + le `confirm()` de suppression → `confirmDialog` async (`.then(ok=>{ if(!ok) return; … })`). DB Editor n'en avait aucun. Testé : validation → toast « Please enter an item name », delete → confirmDialog brandé, **zéro dialogue natif**.
- D2 : `formatCheckDate` (db-editor) délègue sa branche absolue à `formatDate` partagé (garde « Never »/« Just now »/« Nh ago »). → « 9 Mar, 14:30 ».
- D3 : I&C level-bar (×2 : overview + count-preview) → `levelColor(percentage)`/`levelTextColor(percentage)` partagés (formule byte-identique, 0 changement visuel — bar rgb(46,158,46) vérifiée).
- D4 : db-editor logs `user: window.currentUser||'admin'` (jamais assigné) → `localStorage.getItem('currentStaff')||'admin'` = le dernier user PM/I&C (origine partagée), pas une constante 'admin'.

## VAGUE D — Cohérence (optionnel, plus bas) [détail original]
- **D1. `alert()`/`confirm()` natifs → `confirmDialog`** (ic ~20 sites, db-editor 3) : cohérence UX + retire des dialogues bloquants. Pas du dedup pur.
- **D2. db-editor `formatCheckDate` (L212-226) → délègue la branche absolue à `formatDate`** ; garde le relatif « Nh ago »/« Never » local. **~8 l., low-med.**
- **D3. `levelColor` réutilisé dans ic (L368 inline)** + dé-dup du rendu level-bar intra-ic + retirer console.logs (392-396). Mineur, intra-fichier, touche l'UI.
- **D4. db-editor `window.currentUser`→'admin' (L960)** : jamais assigné (logs = 'admin'). Charger user.js le corrigerait, MAIS sémantique admin peut-être voulue. Optionnel.

## À NE PAS FAIRE (risque > gain, confirmé par l'audit)
- **`saveAndNext`** (script 428-486 / ic 1536-1603) : squelette commun mais persistance **sync (saveData) vs async (Firebase .then)** + schémas de log différents → mélanger = source classique de bugs. Risque HAUT.
- **`showQuickUpdateModal`** (script 354 l. impératif DOM / ic 178 l. innerHTML) : stratégies DOM opposées, features PM en plus → non factorable sans réécriture. Risque HAUT.
- **`updateStats` complet** : sorties DOM genuinement différentes (barre progress 3 seuils PM vs recolor amber + last-inventory ic). Garder séparé (sauf A4).

## Total récupérable estimé : ~180-220 lignes + 7 closeModal + handlers, sans les items « à ne pas faire ».
## Séquence reco : A (sûr) → B → C (stagé, screenshots) → D (option). Chaque vague testée Playwright + screenshot, un module à la fois, rien poussé sans « go push ».

## ⚠️ Déjà fait (NE PAS refaire)
- **Unification user/staff** : module partagé `user.js` (`window.UserSession` : get/set/restore/clear/subscribe/showSwitchToast + DEFAULT_STAFF + clé localStorage `currentStaff`). Chargé sur index.html + ic-inventory.html avant leurs modules. I&C migré (toast+persist+restore). PM migré en LÉGER (toast délègue à UserSession, 2 chemins manquants comblés, listes par défaut alignées « Serge M »). **PM garde encore sa logique currentStaff/localStorage locale** — pas encore 100 % routé (c'est la Phase 2 ci-dessous).
- **Dead CSS** : 18 règles 100 % mortes retirées (−2947 o). Script conservateur (ne touche pas les sélecteurs mixtes vivante+morte).
- Tout est LOCAL, **rien poussé**. Beaucoup de travail non poussé (Batchs 1-3 UX, magenta, summary compteurs, filtres regroupés, bulle user, sons, « Can't prep », unification user, nettoyage CSS).

## 🔴 Fait établi crucial (anti-régression)
- **Les classes `.action-*` de `history-styles.css` sont LIVE** : `history.js:116` construit `class="log-item action-${log.actionType}"` (action-count/prep/edit/delete/cantprep/checklist-done/checklist-blocked). **NE JAMAIS les supprimer** (faux positif de la détection dead-code par mot entier).

---

## PHASE 0 — Finir le dead CSS (immédiat, sûr, vérifié)
Retirer ces **4 règles vraiment mortes** (0 occurrence en HTML/JS, vérifié) :
- `styles.css` : `.todo-tag.urgent` (~L913) · `.move-button` (~L1286, + éventuels `:hover/:active`) · `tr.drag-placeholder td` (~L1378)
- `ic-inventory-styles.css` : `.overview-table .sublocation-value` (~L423)
→ Vérifier accolades équilibrées + Playwright 0 erreur après.

## PHASE 1 — JS jumeaux (faible risque) → `ui-helpers.js`
- **`formatDate` ×2 (rendus DIVERGENTS)** : script.js ~L13-39 (« 9 Mar, HH:MM ») vs ic-inventory-app.js ~L246-264 (« Mar 9, HH:MM »). → 1 seule dans ui-helpers. **DÉCISION SERGE EN ATTENTE : format = « 9 mars, 14:30 » (proposé) ?** Corrige un vrai bug d'incohérence.
- **`saveData` ×2 (jumeaux)** : script.js ~L221-267 vs ic ~L307-329 (diffèrent juste par clé + fn Firebase). → helper paramétré `makeSaveData(key, saveOne, saveAll)`.
- **Calcul d'initiales** (`name.split(' ').map(w=>w[0])…`) répété ~6× → helper (UserSession le fait déjà dans showSwitchToast ; exposer/réutiliser).
- Gain ~60-80 l. Tester : dates affichées, save d'un item (PM + I&C).

## PHASE 2 — Finir l'unification user/staff (robustesse++, gros dédup)
- **`loadStaffMembers` ×2** (fetch Firebase + fallback) : script.js ~L83-146, ic ~L54-91 → dans `UserSession.loadStaff()` (1 impl, les 2 modules l'appellent).
- ✅ **FAIT (03/08/2026) — 3 dropdowns user → `UserSession.dropdown(anchor, onPick)`** + **2 écrans de connexion → `UserSession.renderGate(grid, onPick)`** (`user.js`). **Bug de robustesse corrigé au passage** : les 3 dropdowns lisaient `window.staffMembers` directement, or `loadStaff()` ne le renseigne QUE dans la branche Firebase — Firebase injoignable = menu VIDE, plus moyen de changer d'utilisateur. Mesuré : ancien code 0 nom, nouveau 9. Nouveau cache `cachedNames` alimenté par TOUTES les branches + `UserSession.staffNames()` (synchrone, jamais vide). Aussi : z-index unifié (était 9999 vs 10001), panneau stylé en CSS et non plus en `cssText`, règle `.loading-staff` sortie du `<style>` injecté dans `<head>` depuis `script.js`. Checks smoke : `shared/dropdown-survives-firebase-outage`, `shared/dropdown-toggles`, `shared/staff-gate-rendered`.
- ✅ **FAIT (03/08/2026) — 2 rendus d'historique → `describeLog(log, overrides)`** dans `ui-helpers.js`. Trouvé parce que le bug s'est produit : IC affichait une commande en « modified · 0 → 1 bag ». Règle posée : **la flèche = mouvement de stock uniquement**. `pluralizeUnit` remonté au passage (il était enfermé dans le module IC alors que l'historique en a besoin). Check smoke : `shared/describeLog-semantics` + `IC/history-order-not-modified`.
- ✅ **FAIT (03/08/2026) — 2 `showStaffSelectionModal` → `UserSession.pick({title, subtitle})`** dans `user.js`. Les deux copies supprimées (−4 980 car. dans script.js, −2 692 dans ic-inventory-app.js). La version I&C stylait ses boutons en JS avec `#80b244` **écrit en dur** (= `--primary-medium`) : un changement de thème l'aurait sautée. Comportement retenu : **1 tap = choisi** (l'étape « Continue » du prep-check n'apportait rien), look `.staff-select-button` (initiales + nom + coche), utilisateur courant marqué. `startPrepCheck` ne dépend plus d'une modale qui appelait `startPrepCheckProcess` elle-même. Checks smoke : `shared/staff-picker-identical` + les 2 existants.
- **Router PM 100 % via `UserSession.set`** (supprimer les maj de labels éparpillées à ~6 endroits → source unique via `UserSession.notify`). Aligner le défaut boot.
- Gain ~200-250 l., robustesse (source de vérité unique). Tester : login/switch/count des DEUX modules + attribution `lastCheckedBy`.

## PHASE 3 — Composants CSS (risque moyen, visible)

> 🛡️ **Prérequis posé le 03/08 : `tests/visual.py`** — photographie les 34 écrans (PM, I&C, DB editor × PC + iPad) et compare au pixel près, avec un PNG de diff (zones changées en rouge) par écart. C'est ce qui rend ce chantier faisable sans deviner. Le harnais fige les transitions et **normalise les horodatages relatifs** : sans ça, « 1h ago » → « 2h ago » provoquait sur iPad un retour à la ligne qui décalait toute la page, soit 6 % d'écart pour zéro régression.

- ⚠️ **Le compte de 4 systèmes de tableaux était FAUX** (audit du 03/08). Réalité : `.data-table` a **0 règle et 0 usage** (déjà supprimé), et **aucun tableau ne porte `.inventory-table` seul** — les 5 l'ont toujours en paire `class="inventory-table db-table"`. Il y a donc **2 familles** (`.inventory-table.db-table` × 5 tables, `.overview-table` × 1) plus un modificateur vestigial. ✅ **FAIT** : le zébrage, écrit deux fois à l'identique, est passé dans un socle commun (`styles.css`, « Socle commun des tableaux ») ; les 4 valeurs en dur de `.db-table` (`#e8e8e0`, `#888`, `#f0f4e8`, `#f0f0ec`) sont devenues des jetons `--table-*`. **Bug corrigé** : `.inventory-table tr:hover { filter: brightness(.95) }` touchait AUSSI la ligne d'en-tête (le `filter:none` de `.db-table` est limité au tbody) → survoler les titres de colonnes les assombrissait ; la règle est maintenant portée sur `tbody`. Les en-têtes verts I&C et les colonnes triables restent propres à `.overview-table` : ce sont des différences voulues, pas de la dérive.
- **≥4 boutons verts primaires** (`.btn--primary`, `.action-button--primary`, `.submit-button`, `.staff-button`) + ≥3 secondaires → 1 base `.btn` + modificateurs.
- **Prolifération de badges** (`todo-tag`, `summary-badge`, `location-badge`, `provider-badge`, `prep-check-badge`…) → consolider (le `.tag` unifié existait, a été retiré car mort — le refaire proprement et le brancher).
- Gain CSS −10-15 %. Tester chaque écran au screenshot (PM dashboard/preps/history/run-check, I&C dashboard/overview/count/history, DB editor, modals).

### Décisions de Serge (03/08/2026, 21h50) — ne pas rouvrir sans nouvelle demande
- **Ambres fusionnés** sur `#8a6100` (`--sev-warn`). Le jeton `--sev-warn-ic` est supprimé. Une seule teinte « attention » dans les deux modules.
- **Table Preps : on ne touche pas.** Le zébré y reste invisible car les 41 lignes portent `.prep-updated`/`.count-updated` en `!important` — c'est voulu, le code couleur vert/jaune porte du sens (préparé vs compté) et reste lisible à distance sur tablette. Le zébré s'applique à l'I&C overview et au DB Editor.
- **Interface entièrement en anglais**, cohérence avec l'existant (`Save`, `Start Full Count`…). Pas de franglais, pas de traduction partielle.

## PHASE 4 — Fusion des tokens CSS (risque ÉLEVÉ, en dernier, « zéro changement visuel »)
- Les **2 couches `:root`** cohabitent (styles.css L8-53) : palette historique (`--primary-dark`, `--accent-red`, `--accent-orange`…) + bloc « UNIFICATION 2026-07-18 » (`--color-primary`, `--danger`, `--warning`…) qui RE-déclare les mêmes couleurs. Ex doublons : `--primary-dark`=`--color-primary`=#577c2b ; `--primary-medium`=`--accent-green`=`--success`=#80b244.
- → Fusionner en **1 variable par rôle**, remplacer les hardcodes (hex, ~15 ombres, rayons) par tokens, supprimer les alias. Bannir la couche slate Tailwind, bleu Facebook #3b5998, saumon `--accent-red`.
- **EXCEPTIONS de design à préserver** (ne pas « corriger ») : sidebar verte PM vs slate I&C = voulu (procurement) ; gradient LAST SYNC ; **pastille user MAGENTA `#c2185b`** = identité équipier (voulu). Voir changelog 27/07 « 3 exceptions ».
- Diff screenshot sur TOUS les écrans avant/après. **Peut être décidé « on ne le fait pas »** selon appétit au risque de Serge.

## PHASE 5 — Balayage final
- Dead CSS restant (dans @media / sélecteurs mixtes), hardcodes → tokens, commentaires/flags obsolètes (« additive, no visual change until markup adopts them », échelle z-index « aspirational »…).

---

## Séquence recommandée
**0 → 1 → 2** d'abord (sûr + robustesse max, ~300 l. en moins, 1 bug date corrigé, 0 visuel). Puis **3** (visible, screenshots). Puis **4** (le plus risqué, en dernier, optionnel). Puis **5**.

## Décisions en attente de Serge
1. **Format de date** (Phase 1) : « 9 mars, 14:30 » OK ?
2. **Périmètre** : dérouler 0→5 en séquence, ou s'arrêter après une phase donnée ?
3. **Phase 4 (tokens)** : on la fait ou on la skip (risque/récompense) ?

## Fichiers concernés
`user.js`, `ui-helpers.js`, `script.js` (2466 l.), `ic-inventory-app.js` (3240 l.), `history.js`, `db-editor-ic.js`, `styles.css` (2213 l.), `ic-inventory-styles.css`, `history-styles.css`, `index.html`, `ic-inventory.html`, `db-editor.html`.

## Changelog
Documenter chaque phase dans `M/prep-manager/changelog.md` (+ global `M/changelog.md`). Point de revert au moment du push.
