# Sezam Prep Manager — Architecture

> Last update: 2026-07-28 · **À lire en premier avant toute modif.** Carte du code + formes de données + pièges.
> ⚠️ **App EN PROD LIVE au resto** : jamais de `git push` sans OK explicite ; les tests DOIVENT stubber Firebase.

Vanilla JS, **pas de build**. Les scripts app sont **classiques (portée globale)** ; seul `firebase-config.js` est un **module ES** (il `import`e le SDK Firebase) et expose `window.firebaseDb`. L'ordre de chargement compte (`firebase-config` → helpers → app). Firebase RTDB + GitHub Pages.

## Les 3 pages

| Page | HTML | Logique | CSS propre |
|---|---|---|---|
| **Prep Manager** (PM) | `index.html` | `script.js` | `styles.css` (base) |
| **I&C Inventory** (IC) | `ic-inventory.html` | `ic-inventory-app.js` | `ic-inventory-styles.css` |
| **DB Editor** (admin) | `db-editor.html` | `db-editor.js` + `db-editor-ic.js` | — |

## Fichiers partagés

| Fichier | Rôle | Chargé par |
|---|---|---|
| `firebase-config.js` | CRUD Firebase + helpers de logs ; **définit les nodes** | les 3 |
| `ui-helpers.js` | Helpers UI sur `window` : `formatDate`, `initials`, `makeSaver`, `byDisplayOrder`, `activateSection`, `openModal`, `levelColor`/`levelTextColor`, `confirmDialog` | les 3 |
| `user.js` | `window.UserSession` : identité/staff (get/set/subscribe/loadStaff) **+ `pick()` = LE sélecteur de personnel des 2 modules** | PM, IC (**pas** DB) |
| `notifications.js` | `showNotification()` — toast canonique | les 3 |
| `pin-guard.js` | Verrou PIN (accès admin) | les 3 |
| `sounds.js` | `SoundFX` (Web Audio, aucun fichier son) | PM, IC |
| `slider.js` | Composant slider de niveau | PM, IC |
| `history.js` | Rendu du journal d'activité | PM, DB |
| `lastCheckTracker.js` | Suivi « LAST SYNC » (dernier check complet) | PM |
| `drag-reorder.js` | Réordonnancement par drag | DB |
| `history-styles.css` | Styles du journal (classes `.action-*`) | les 3 |
| `sw.js` | **no-op** (service worker vide) | — |

## Modèle de données (Firebase RTDB = source unique des shapes)

**Nodes** : `prepItems`, `icItems`, `tasks`, `staffMembers`, `activityLogs` (PM), `icActivityLogs` (IC), `teamMessages`, `deliveryIssues`.

```
prepItem   { id:int, name, unit, currentLevel:num, targetLevel:num, displayOrder:int,
             lastCheckedBy, lastCheckedTime:ISO, updateType,
             canPrep:bool, cantPrepReason, cantPrepReasonText, cantPrepBy, cantPrepTime }

icItem     { id:int, name, unit, currentLevel:num, targetLevel:num, displayOrder:int,
             location, sublocation, categories:[], providers:[], lastCheckedBy, lastCheckedTime:ISO,
             pendingQty:num, pendingAt:ISO, pendingProvider }   // « en route » — voir ci-dessous

deliveryIssue { id:'issue_…', itemId, itemName, provider, orderedQty, receivedQty,
                missingQty, orderedAt:ISO, reportedAt:ISO, reportedBy, resolved:bool }

task       { id:'task_…', name, active:bool, forceDisplay:bool,
             type:'recurring'|'scheduled'|'one-off',
             recurring → frequencyDays:int ;  scheduled → scheduledDate, scheduledTime ;
             option d'affichage → scheduleDays:[0-6], scheduleTime:'HH:MM',
             lastCompletedAt:ISO, lastCompletedBy }         // « fait » = completeTask() met à jour lastCompletedAt

log        { id:'log_…'/'iclog_…', actionType, itemId, itemName, oldValue, newValue, unit,
             user, timestamp:ISO,  PM:+reason/reasonText,  IC:+location/sublocation }
             // actionType PM: count|prep|task-done|cantprep|canprepagain|force-display-on/off|checklist-*(legacy)
             // actionType IC: count|update|delete|edit|add|order|receive|not-delivered
```

**Stock vs « en route »** (`ic-inventory-app.js`) : `currentLevel` = ce qui est physiquement là, `pendingQty` = commandé pas encore arrivé. **Commander n'incrémente JAMAIS `currentLevel`** — seuls un comptage ou une réception le font. Les fusionner (« 2 en stock + 3 commandés → je tape 5 ») rend le stock faux dès qu'une livraison manque. Un article sans `pendingQty` se comporte comme avant (aucune migration). La réception écrit en **une seule opération atomique** (`saveAllIcItems` sur les seuls articles touchés) avec rollback mémoire si l'écriture échoue ; ce qui manque part dans `deliveryIssues` → la liste de réclamation fournisseur s'écrit toute seule.

**`pendingQty` est toujours un ENTIER** : le stock se compte en fractions (0,8 sac entamé), un achat non — on ne commande pas 0,8 sac chez Metro. Le slider de commande reçoit donc une échelle explicite via l'option `config` de `createTouchSlider` (`{min, max, step, values, labelEvery}`), qui court-circuite `computeSliderConfig` (piloté par la target, avec des pas de 0,1/0,5).

## Pièges (⚠ lire avant de modifier)

- **Fonctions PM = globales** (appelables directement). **Fonctions IC = imbriquées dans une IIFE** → PAS globales, se déclenchent via clic UI (important pour les tests).
- **`.action-${log.actionType}`** construit les classes CSS depuis la donnée de log stockée → un grep ne montre PAS ces références. **Ne pas supprimer les `.action-*`** (vérifiées contre l'historique prod : `.action-prep` = 212 entrées réelles, etc.).
- **`sw.js` est vide** → un « bug de cache » après déploiement = cache navigateur, pas le SW. Hard refresh (Ctrl+Shift+R).
- **`#count-interface` n'est PAS une `.content-section`** — c'est un frère. `activateSection` ne le masque donc pas : `switchSection` doit le refermer explicitement, sinon quitter un comptage en cours laisse la carte collée en bas de l'écran suivant.
- **`.tick-marks` du slider est positionné hors du conteneur** (`bottom: -30/-34px`) : le parent ne réserve aucune place, la marge basse du `.slider-container` doit couvrir les graduations + les chiffres, sinon ils débordent du panneau. Et comme `.slider-container` est en `width: 100%`, toute marge latérale le fait **déborder** au lieu de le rentrer → passer en `width: auto` si on veut l'inset.
- **`SoundFX`** est un `const` top-level (pas sur `window`) → appeler `SoundFX.x()`, garder `typeof SoundFX !== 'undefined'`.
- **DB Editor ne charge pas `user.js`** → il lit `localStorage['currentStaff']` directement (fallback `'admin'`).
- **Un seul libellé de journal : `describeLog(log, overrides)`** (`ui-helpers.js`). PM et IC avaient chacun leur `switch(log.actionType)` ; celui d'IC n'a jamais appris `order`/`receive`/`not-delivered` et les affichait « modified · 0 → 1 bag ». **Règle sémantique : la flèche `X → Y` est la grammaire d'un MOUVEMENT DE STOCK** — elle n'apparaît que sur `count`/`update`/`receive`. Commander ne touche pas le stock, donc pas de flèche (c'est ce qui faisait lire « commandé 1 sac » comme « le stock est passé de 0 à 1 »). Les types propres aux preps (`prep`, `cantprep`, `checklist-*`…) restent dans `history.js` : `describeLog` rend `null` pour eux.
- **Les 3 surfaces « taper un nom » vivent TOUTES dans `user.js`** — ne jamais en recréer une dans un module :
  - `UserSession.renderGate(grid, onPick)` → écran de connexion (`.staff-grid` / `.staff-button`)
  - `UserSession.dropdown(anchor, onPick)` → menu déroulant sous le nom en en-tête (`.dropdown-item`) ; se referme tout seul (re-clic, clic extérieur)
  - `UserSession.pick({title, subtitle})` → modale de choix, rend une Promise (`''` si annulé) ; un tap = choisi
  Chacune posait sa propre copie (5 au total) et elles avaient divergé : markup différent, couleurs et panneaux stylés en dur dans le JS (`#80b244` = `--primary-medium`, donc insensible à un changement de thème), z-index 9999 vs 10001.
- **⚠️ Ne JAMAIS lire `window.staffMembers` pour afficher une liste de personnel** — il n'est renseigné que si Firebase répond. C'est ce qui rendait les 3 dropdowns **vides pendant une panne Firebase** (mesuré : 0 nom au lieu de 9), sans qu'on puisse encore changer d'utilisateur. Utiliser `UserSession.staffNames()` (synchrone, jamais vide) ou `loadStaff()` (asynchrone). Le cache est alimenté par toutes les branches, y compris les repli.
- **Tâches vs bouton RUN CHECK** : découplés. Lancer un prep check n'auto-complète PAS la tâche « Run PREP CHECK » (c'est un rappel manuel). Voir `isTaskDue`/`completeTask` dans `script.js`.
- **Bip d'apparition de tâche** : `SoundFX.taskAppear()` déclenché par le diff des tâches dues dans `updateTodoList()` (rien de temporisé — ça suit le redraw).
- **🚨 Nouveau nœud Firebase = règle à ajouter, sinon échec SILENCIEUX.** Les règles n'ont **pas de permission racine** → tout nœud absent de `database.rules.json` est refusé (`Permission denied`) et l'écriture échoue sans rien afficher. Workflow : ajouter le bloc dans `database.rules.json` **puis** `firebase deploy --only database --project sezam-prep-manager`. Le fichier local est la source de vérité (le CLI ne sait PAS relire les règles distantes). Toujours assortir les écritures d'un `.catch` qui affiche un toast d'échec.

## Lancer / tester

```bash
python -m http.server 8971 --bind 0.0.0.0      # PC http://127.0.0.1:8971 · tablette http://192.168.1.41:8971
python tests/smoke.py                          # checks fonctionnels, Firebase stubbé, exit 0/1 — AVANT chaque push
python tests/visual.py --baseline              # photographie les 34 écrans = référence (AVANT un chantier CSS)
python tests/visual.py                         # compare à la référence, écrit un PNG de diff par écart
```
**Règle** : toute nouvelle fonctionnalité → un check dans `tests/smoke.py` (le filet grandit avec l'app).

**Chantier CSS → `tests/visual.py` d'abord.** Il prouve qu'un changement annoncé « invisible » l'est vraiment, au pixel près, sur les 34 écrans (PM, I&C, DB editor × PC + iPad). Les zones changées sortent en rouge dans `tests/visual/diff/` : **toujours regarder le PNG avant de conclure à une régression**, l'écart peut venir des données lues en base et non du CSS.
- Le harnais **fige** les transitions et **normalise les horodatages relatifs** (« 2h ago » → « X ago »). Sans ça il criait au loup : sur la largeur iPad, un libellé plus long provoquait un retour à la ligne qui décalait toute la page — 6 % d'écart sans une seule régression.
- Piège Playwright : `pg.evaluate("() => UserSession.pick(...)")` **attend la promesse**, qui ne se résout jamais tant que personne n'a cliqué. Toujours des accolades : `"() => { UserSession.pick(...); }"`.
