# Plan — Commandé / Reçu + Litiges (I&C)

> Last update: 2026-08-03 · Statut : **Phase 1 CODÉE en local (44/44 smoke), en attente du test PC + iPad de Serge puis du « go push »**

## Ajouts / corrections par rapport au plan initial (retours UX de Serge, 03/08)

1. **Carte « open claims »** sur le dashboard (lecture de `deliveryIssues` + bouton « Settled » + « Copy list »). Sans elle, les manquants s'accumulaient en base sans que personne ne les voie — la « liste pour Manon » n'existait pas vraiment.
2. **Onglets 📦 Stock / 🚚 Order** dans le modal quick-update. Les deux steppers visibles ensemble + le titre « New quantity » invitaient à saisir la commande avec le slider stock — exactement le bug fantôme, reproduit à la main. Un seul panneau visible à la fois. **Défaut = Order** (ouvrir un article depuis l'overview veut presque toujours dire « je l'achète »), sticky sur la session. Onglet Stock renommé « Stock on shelf ».
3. **Les quantités commandées sont des ENTIERS.** Le stock peut valoir 0,8 sac (sac entamé), pas une commande : on n'achète pas 0,8 sac chez Metro. Le pré-remplissage était `target − stock` = 1,2, et un tap sur « − » donnait 0,7 — impossible. Désormais échelle entière `0..orderMax`, défaut = l'entier qui atterrit au plus près de la target. `slider.js` accepte une option `config` (échelle explicite) + `labelEvery`.
4. **Slider sur la commande**, pas seulement −/+ (demande de Serge), avec le marqueur vert sur la quantité suggérée.
5. **Badge de statut** `ON TARGET` / `UNDER TARGET` / `OVER TARGET` sur la ligne du stepper, stylé comme un état (fond teinté, filet à gauche, non cliquable) et non comme un bouton. La ligne sous le slider donne le chiffre exact : « after delivery: 6 / 5 bags ».
6. **Écran Full Count** aligné sur la carte de check des preps : barre de progression, badge « Item X of N », badge utilisateur **cliquable pour changer d'utilisateur en cours de comptage** (⇄), nom de l'article en héros, ligne 📍 lieu — sous-lieu (masquée si identiques), gros contrôles tablette. Flux `saveAndNext` inchangé.
7. **Bug corrigé — graduations hors cadre** : `.tick-marks` est positionné en absolu *hors* du conteneur (`bottom: -34px`), donc le parent ne réservait aucune place : les chiffres débordaient de 6 px sous le panneau gris. Marge basse portée à 40 px. ⚠️ Piège : `.slider-container` est en `width: 100%`, donc une marge latérale le fait *déborder* au lieu de le rentrer → `width: auto` obligatoire avec des marges latérales.
8. **Bug corrigé — écran de comptage orphelin** : `#count-interface` est un frère des `.content-section`, pas l'une d'elles ; `activateSection` ne le masquait jamais. Quitter un comptage en cours laissait la carte « Mayonnaise » collée en bas du Dashboard ou de l'History. `switchSection` le referme désormais.

9 checks smoke ajoutés au total (44/44).

## ⚠️ Risque de déploiement — assets en cache

Aucun cache-busting dans le projet : `ic-inventory.html` charge `slider.js`, `ic-inventory-app.js`… **sans `?v=`**. Serge l'a rencontré en test local le 03/08 : `ic-inventory-app.js` était frais (bloc commande présent) mais `slider.js` venait du cache, donc l'option `config` était ignorée → le slider de commande retombait sur l'échelle du stock (0–10, pas de 0,5), affichait « 5 » avec la poignée à 4,5, et le badge se calculait sur 5.

- **Parade immédiate** : hard refresh (Ctrl+Shift+R), et sur l'iPad du resto après chaque déploiement touchant un `.js`.
- **Garde-fou codé** : `syncOrderFromInput` snappe la poignée à l'entier au lieu d'afficher un arrondi par-dessus une valeur fractionnaire — l'affichage ne peut plus mentir, même avec un slider périmé.
- **Test durci** : le check `IC/order-whole-units-and-status` lit la valeur BRUTE de l'input caché et vérifie que les graduations sont des entiers consécutifs. L'ancienne version ne lisait que le libellé affiché, que l'arrondi masquait — elle serait passée au vert sur ce bug.
- **Arbitrage cache-busting (03/08, avec Serge) : ON NE LE FAIT PAS — un `?v=` serait INOPÉRANT ici.**
  Faits vérifiés sur la prod (`curl -I`) : GitHub Pages sert `Cache-Control: max-age=600` sur **tout**, y compris `ic-inventory.html` et `index.html` (pas seulement les `.js`/`.css`).
  **Raison décisive** : les numéros `?v=` vivent DANS le HTML, et le HTML est lui-même caché 10 min. Pendant la fenêtre qu'on voulait couvrir, le navigateur ressort l'ancien HTML → les anciens numéros → l'ancien JS. Le système ne s'activerait qu'au rafraîchissement du HTML, c'est-à-dire au moment où les assets se rafraîchissent déjà seuls. Coût permanent, effet nul sur le cas visé.
  **Calibrage du risque** (ne pas le sous-estimer comme je l'ai fait d'abord) : la fenêtre court 10 min depuis le dernier chargement, pas depuis le déploiement — et elle tombe pile sur le moment de plus forte utilisation, juste après un push quand on va tester.
  **Donc, habitude à garder : hard refresh (Ctrl+Shift+R) quand on teste juste après un push — en LOCAL *et* sur l'iPad.** En local c'est pire encore : `python -m http.server` n'envoie aucun header de cache, le navigateur improvise et garde bien plus longtemps (c'est ce qui a piégé Serge le 03/08).
  Le seul cas réellement dangereux (affichage ≠ valeur réelle) est de toute façon verrouillé par le garde-fou dans `syncOrderFromInput` + le check smoke `IC/order-whole-units-and-status`.
> Origine : les 4 « commandes fantômes » du 26/07 (huile tournesol, mayonnaise, concentré tomate, acide citrique) — stock mis à jour à la commande, livraison jamais arrivée → stock faux toute la semaine + conso faussée.

## Principe

Aujourd'hui un seul chiffre mélange **présent** (2) et **espéré** (+3) → Serge écrit 5, qui devient un mensonge si la livraison rate.
Désormais : **stock** (physique, modifié seulement par comptage et réception) et **en route 🚚** (commandé) sont deux champs distincts.

## Modèle de données

**`icItems`** — 3 champs ajoutés (⚠️ PAS de nouveau nœud → aucune règle Firebase à changer ; le `.validate` existant utilise `hasChildren`, les champs supplémentaires passent) :
```
pendingQty:      number   // qté commandée en attente (absent/0 = rien en route)
pendingAt:       ISO      // date de la commande
pendingProvider: string   // "Metro" par défaut (liste depuis item.providers)
```

**`deliveryIssues`** — NOUVEAU nœud → 🚨 **règle obligatoire dans `database.rules.json` + `firebase deploy --only database --project sezam-prep-manager`**, sinon échec SILENCIEUX (leçon `teamMessages` du 29/07).
```
{ id, itemId, itemName, provider, orderedQty, receivedQty, missingQty,
  orderedAt:ISO, reportedAt:ISO, reportedBy, resolved:false }
```

**`icActivityLogs`** — 3 `actionType` ajoutés : `order`, `receive`, `not-delivered` (+ libellés dans `history.js` ; les classes `.action-*` se génèrent seules via `action-${actionType}`, prévoir le style ou laisser le défaut).

## UX

### A. Commande (Serge, PC, fenêtre Metro à côté) — modal quick-update existant
Bloc ajouté sous le slider :
```
Mayonnaise      Stock : 2  ·  Target : 5   → il en manque 3
🚚 J'en ai commandé :   [−]  3  [+]   (= on target)
[ Enregistrer la commande ]
```
- Champ **pré-rempli à `max(0, target − stock)`** → acheter on target = 1 seul tap.
- `−`/`+` pour under/over ; libellé dynamique : « on target » / « 1 sous la target » / « 1 au-dessus ».
- Stock déjà ≥ target → pré-rempli à 0. Pas fractionnaire → suivre le pas de l'article (0,5).
- Lien « ↩ on target » pour revenir à l'écart exact après ajustement.
- **Écrit `pendingQty`, ne touche PAS `currentLevel`.** Log `order`.
- Le slider habituel reste intact et fonctionne comme avant (feature à côté, pas à la place).

### B. Réception (le jour de la livraison, ~2 min)
Bandeau en haut de l'inventaire : `🚚 4 articles attendus — [Réceptionner]`.
Modal checklist, **toutes les lignes pré-cochées à reçu = commandé** :
```
✓ Huile tournesol   reçu 2 / 2
✓ Mayonnaise        reçu 3 / 3   ← taper la ligne pour ajuster (0, 1…)
[ ✓ TOUT VALIDER ]
```
- Tout arrivé → 1 bouton. Exception → taper la ligne concernée, puis TOUT VALIDER.
- Reçu → `currentLevel += reçu`, `pendingQty` effacé, log `receive`.
- Manquant → entrée dans `deliveryIssues` + log `not-delivered`. **La liste pour Manon (Metro) se génère toute seule.**

### C. Badge dans la table overview
`2 (+3 🚚)` sur les articles en attente. ~15 lignes CSS + rendu.

## Phasage

| Phase | Contenu | Touche |
|---|---|---|
| **1** | Commande + réception + litiges + badge + logs + règle Firebase + 4 checks smoke | `showQuickUpdateModal` (l.1548), table overview (l.287-390), nouveau modal réception, `firebase-config.js`, `history.js`, `ic-inventory-styles.css` |
| **2** | Comptage aveugle (champ vide, écart affiché après) + type `correction` | `showCurrentCountItem` (l.1388) UNIQUEMENT |
| **3** | Confirmation d'identité en début de série, snapshot hebdo, prix unitaires | plus tard |

## Garanties anti-régression / anti-destruction

1. **Tout est additif** : nouveaux champs, nouveau nœud, nouveaux `actionType`, nouvelles classes CSS nommées. Aucune donnée existante réécrite, aucun champ supprimé.
2. **Le flux de comptage de Tatiana n'est PAS touché en Phase 1** — vérifié : `startFullCount`/`showCurrentCountItem`/`saveAndNext` sont des fonctions distinctes de `showQuickUpdateModal`. Son dimanche ne change pas.
3. **Le slider quick-update reste intact** — on ajoute un bloc sous lui, on ne modifie pas son comportement.
4. **Rétrocompatible** : un article sans `pendingQty` se comporte exactement comme aujourd'hui (aucune migration de données nécessaire sur les 102 articles).
5. **Règle Firebase déployée AVANT le premier test d'écriture** sur `deliveryIssues`, sinon échec silencieux.
6. **`.catch` + toast d'échec** sur chaque écriture (règle acquise le 29/07 : aucune écriture muette).
7. **`python tests/smoke.py` doit rester au vert** (35/35 aujourd'hui → 39/39 avec les 4 nouveaux checks) avant tout push.
8. **Test local d'abord** (PC puis iPad via `http://192.168.1.41:8971`), **push seulement sur « go push » explicite** de Serge — l'app est en service au resto.

## Checks smoke à ajouter (Phase 1)

- `IC/order-sets-pending` : commander n'incrémente pas `currentLevel`, écrit `pendingQty` + log `order`
- `IC/receive-all` : « tout valider » → `currentLevel += pendingQty`, `pendingQty` effacé, log `receive`
- `IC/receive-partial-creates-issue` : reçu < commandé → entrée `deliveryIssues` avec le bon `missingQty`
- `IC/pending-badge` : le badge `+N 🚚` s'affiche sur l'article en attente
