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
| `user.js` | `window.UserSession` : identité/staff (get/set/subscribe/loadStaff) | PM, IC (**pas** DB) |
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

**Nodes** : `prepItems`, `icItems`, `tasks`, `staffMembers`, `activityLogs` (PM), `icActivityLogs` (IC).

```
prepItem   { id:int, name, unit, currentLevel:num, targetLevel:num, displayOrder:int,
             lastCheckedBy, lastCheckedTime:ISO, updateType,
             canPrep:bool, cantPrepReason, cantPrepReasonText, cantPrepBy, cantPrepTime }

icItem     { id:int, name, unit, currentLevel:num, targetLevel:num, displayOrder:int,
             location, sublocation, categories:[], providers:[], lastCheckedBy, lastCheckedTime:ISO }

task       { id:'task_…', name, active:bool, forceDisplay:bool,
             type:'recurring'|'scheduled'|'one-off',
             recurring → frequencyDays:int ;  scheduled → scheduledDate, scheduledTime ;
             option d'affichage → scheduleDays:[0-6], scheduleTime:'HH:MM',
             lastCompletedAt:ISO, lastCompletedBy }         // « fait » = completeTask() met à jour lastCompletedAt

log        { id:'log_…'/'iclog_…', actionType, itemId, itemName, oldValue, newValue, unit,
             user, timestamp:ISO,  PM:+reason/reasonText,  IC:+location/sublocation }
             // actionType PM: count|prep|task-done|cantprep|canprepagain|force-display-on/off|checklist-*(legacy)
             // actionType IC: count|update|delete|edit|add
```

## Pièges (⚠ lire avant de modifier)

- **Fonctions PM = globales** (appelables directement). **Fonctions IC = imbriquées dans une IIFE** → PAS globales, se déclenchent via clic UI (important pour les tests).
- **`.action-${log.actionType}`** construit les classes CSS depuis la donnée de log stockée → un grep ne montre PAS ces références. **Ne pas supprimer les `.action-*`** (vérifiées contre l'historique prod : `.action-prep` = 212 entrées réelles, etc.).
- **`sw.js` est vide** → un « bug de cache » après déploiement = cache navigateur, pas le SW. Hard refresh (Ctrl+Shift+R).
- **`SoundFX`** est un `const` top-level (pas sur `window`) → appeler `SoundFX.x()`, garder `typeof SoundFX !== 'undefined'`.
- **DB Editor ne charge pas `user.js`** → il lit `localStorage['currentStaff']` directement (fallback `'admin'`).
- **Tâches vs bouton RUN CHECK** : découplés. Lancer un prep check n'auto-complète PAS la tâche « Run PREP CHECK » (c'est un rappel manuel). Voir `isTaskDue`/`completeTask` dans `script.js`.
- **Bip d'apparition de tâche** : `SoundFX.taskAppear()` déclenché par le diff des tâches dues dans `updateTodoList()` (rien de temporisé — ça suit le redraw).
- **🚨 Nouveau nœud Firebase = règle à ajouter, sinon échec SILENCIEUX.** Les règles n'ont **pas de permission racine** → tout nœud absent de `database.rules.json` est refusé (`Permission denied`) et l'écriture échoue sans rien afficher. Workflow : ajouter le bloc dans `database.rules.json` **puis** `firebase deploy --only database --project sezam-prep-manager`. Le fichier local est la source de vérité (le CLI ne sait PAS relire les règles distantes). Toujours assortir les écritures d'un `.catch` qui affiche un toast d'échec.

## Lancer / tester

```bash
python -m http.server 8971 --bind 0.0.0.0      # PC http://127.0.0.1:8971 · tablette http://192.168.1.41:8971
python tests/smoke.py                          # 33 checks, Firebase stubbé, exit 0/1 — lancer AVANT chaque push
```
**Règle** : toute nouvelle fonctionnalité → un check dans `tests/smoke.py` (le filet grandit avec l'app).
