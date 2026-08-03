# Audit de robustesse — findings vérifiés et plan de correction
> Last update: 2026-08-04

Audit mené le 03-04/08/2026 par trois agents en lecture seule (Firebase & concurrence,
robustesse fonctionnelle, homogénéité & légèreté), puis **contre-vérifié fichier par
fichier et contre la base de production** avant d'être retenu. Un second passage de
relecture a confirmé les 10 findings et ajouté 3 remarques opérationnelles.

**La découverte centrale : les défauts les plus graves sont ANTÉRIEURS à la vague
Commandé/Reçu (blocs A→H).** Ils tournent en production aujourd'hui.

---

## La cause racine — une seule, qui explique six failles

Le code enregistre toujours l'article **entier** (`set()` remplace le nœud), pendant que
les listeners temps réel **remplacent** les objets en mémoire à chaque écho Firebase.

Deux conséquences mécaniques :
1. **Tout écran écrase ce qu'il ne connaît pas.** Un formulaire qui ne porte pas un champ
   le supprime de la base en enregistrant.
2. **Tout objet capturé** (modal ouvert, file de comptage) devient un fantôme dès qu'un
   autre terminal écrit — et c'est ce fantôme périmé qui est réécrit en entier.

C'est exactement le scénario PC-bureau + tablette-cuisine en simultané.

---

## Findings CRITIQUES — perte de données silencieuse, en usage normal

### 1. Le DB Editor détruit des champs à chaque enregistrement — PRÉ-EXISTANT
`db-editor.js:352-361` et `db-editor-ic.js:402-421` reconstruisent l'article à partir des
seuls champs du formulaire, puis `set()`.

Mesuré en base le 04/08 : éditer un prep efface `canPrep` (34 articles), `updateType` (41),
`cantPrepBy`/`cantPrepReason`/`cantPrepTime` (8). **8 articles sont bloqués par la cuisine
en ce moment** : Tomato Slice, Kabis, Menthe, Iceberg CUTS, Jébné, Garlic-Mayo,
Tomato Cubes, BACKUP Garlic chicken. Corriger le `targetLevel` de l'un d'eux fait
disparaître le blocage sans un mot.

Côté I&C, le même code efface `pendingQty` : la feature de commande est effaçable par un
écran qui l'ignore. `sublocation` est explicitement préservé avec un commentaire — la
précaution n'a jamais été étendue aux autres champs.

### 2. Le Prep Check désigne l'article par sa POSITION — PRÉ-EXISTANT
`script.js:382` (sauvegarde) et `script.js:1528` (affichage) résolvent
`prepItems[currentItemIndex]`, dans un tableau que le listener remplace **et re-trie**
(`script.js:237-240`). Une suppression ou un réordonnancement pendant un comptage envoie
la valeur saisie sur l'article voisin. Le journal enregistre le mauvais nom aussi :
l'erreur est intraçable.

### 3. Un Full Count annule tout ce qui se fait pendant qu'il tourne — PRÉ-EXISTANT
`countQueue` capture des références d'objets au démarrage (`ic-inventory-app.js:1619-1621`)
et ne les rafraîchit jamais ; le listener les orpheline (`:1548`). Sur 102 articles un
comptage dure ~30 min : toute commande ou tout changement de cible fait pendant ce temps
sur un article encore à venir dans la file est écrasé à son passage.

---

## Findings MAJEURS

| # | Finding | Origine | Emplacement |
|---|---|---|---|
| 4 | `createCrudHelpers.save` ne filtre pas les `undefined` alors que la fonction jumelle le fait (levée **synchrone** de `set()` → `.catch` jamais attaché → comptage figé sans message) | révélé par A→H | `firebase-config.js:24` |
| 5 | Le dashboard ignore `pendingQty` → fait recommander en double, alors que l'Overview affiche le badge 🚚 | **introduit par A→H** | `ic-inventory-app.js:1295-1297`, `:1347` |
| 6 | Les `deliveryIssues` partent hors de la transaction atomique du stock → un litige perdu est un avoir fournisseur perdu (toast 3 s, aucune retentative, aucune trace) | **introduit par A→H** | `ic-inventory-app.js:462-487` |
| 7 | `pendingProvider` prend toujours `providers[0]` — **24 articles sur 102 ont 2 fournisseurs** → réclamation adressée au mauvais | **introduit par A→H** | `ic-inventory-app.js:2053-2055` |
| 8 | 10 écritures sans `.catch` + « deleted successfully » annoncé hors promesse | PRÉ-EXISTANT | `script.js:1428`, `db-editor.js:134`, `ic-inventory-app.js:3053` |
| 9 | Collision d'ids : `max(ids)+1` calculé à l'**ouverture** du formulaire, unicité testée sur le tableau local | PRÉ-EXISTANT | `ic-inventory-app.js:2238-2240` |
| 10 | `pluralizeUnit` re-pluralise les unités déjà plurielles → `bottleses` (2 preps + 83 lignes d'historique) | **introduit par A→H** | `ui-helpers.js:313-319` |

### Sécurité — hors périmètre, à arbitrer séparément
Le code PIN du DB Editor est dans un nœud **publiquement lisible** (vérifié : HTTP 200,
chaîne de 4 caractères, sans authentification). Si le nœud est vide, `pin-guard.js:120`
accorde l'accès **sans PIN**. Toute la base est en lecture/écriture ouvertes.

### Homogénéité — les « fourchettes »
Même opération, implémentations divergentes : 4 façons de calculer « il en manque
combien », 7 chemins d'enregistrement d'un article I&C (dont 2 sans journal et 3 qui
falsifient « Last full inventory »), 6 constructions du log I&C avec 3 politiques
d'erreur, 2 moteurs de rendu d'historique. `deleteTeamMessage` est protégé dans
`script.js:1521` et nu dans `db-editor.js:134`.

### Légèreté — ~440 lignes
Vérifiés : aucun `getItem('icItems')` n'existe (5 écritures mortes), `allSublocations`
écrit jamais lu, `isChecking` 3 assignations 0 lecture, 7 entrées de l'API Firebase sans
appelant. Non re-vérifiés (à confirmer au bloc O) : le chiffre de 440 lignes et la mesure
« 84 % / 260 lignes » de duplication des deux modals.

### Redimensionnés à la baisse après vérification
- `pluralizeUnit` : annoncé « 76 articles sur 103 » sur un **backup de mars** ; la base
  actuelle est en singulier minuscule → 2 preps + 83 lignes d'historique.
- Les backups JSON de 875 Ko **ne sont pas versionnés** (`.gitignore`). En revanche
  `screenshots/` (1,6 Mo) est non suivi **et** non ignoré → partirait au premier `git add -A`.
- La divergence de seuil sur `targetLevel = 0` : théorique, la création rejette la valeur.

---

## Plan de correction — blocs I→P

| Bloc | Contenu | Pourquoi |
|---|---|---|
| **I** ✅ | `saveFields(id, patch)` (écriture partielle) + strip des `undefined` dans `createCrudHelpers` | La fondation : neutralise **toute la classe** de failles d'écrasement |
| **J** ✅ | DB Editor : fusionner au lieu de reconstruire (preps + I&C) — stock envoyé **seulement s'il a été tapé** | Arrête la destruction de `canPrep` et `pendingQty` |
| **K** ✅ | Identité au lieu de position : `mergeById` dans les 2 listeners, Prep Check sur une file d'`id` figée | Arrête l'écriture sur le mauvais article |
| **L** ✅ | Cohérence commande : dashboard soustrait `pendingQty`, litige **dans** la transaction, réception idempotente, choix du fournisseur, `pluralizeUnit` | Répare ce que A→H a introduit |
| **M** | Politique d'erreur unique : `.catch` partout + toast global sur échec d'écriture | Plus aucun échec silencieux |
| **N** | `pluralizeUnit`, succès annoncé avant écriture, ids par transaction | Correctifs isolés |
| **O** | ~440 lignes mortes + fusion des deux modals | Légèreté |
| **P** | Les 9 trous de tests identifiés (échec d'écriture simulé, round-trip DB Editor, concurrence) | Non-régression |

### Trois contraintes opérationnelles (ajoutées au second passage)

1. **Fenêtre de cache au déploiement.** GitHub Pages sert `max-age=600` sur tout, HTML
   compris. Après le push des blocs I–K, un terminal qui n'a pas rechargé continue
   d'écrire à l'ancienne sémantique et **écrase ce que le nouveau code vient de protéger**.
   → **Recharger de force la tablette cuisine juste après le push** (Ctrl+Shift+R). Sans
   ça la protection est illusoire pendant des heures.

2. **Un seul push, commits séparés dedans.** A→H et I→K vivent dans le même arbre de
   travail ; pousser I–K « avant » exigerait de démêler 17 fichiers modifiés — risqué et
   sans bénéfice. Séquence retenue : un push unique, commits ordonnés A→H puis I→K.

3. **Granularité de revert : honnêteté sur la promesse.** Les blocs A→H ont été écrits en
   séquence **dans les mêmes fichiers** (`ic-inventory-app.js` porte A, B, C et H). Un
   découpage exact bloc par bloc exigerait un `git add -p` interactif, indisponible ici.
   Le découpage réel est **par domaine** (socle partagé / feature / CSS / tests / docs),
   ce qui donne une granularité utile mais **pas** un revert chirurgical par bloc.

---

## Décisions

- ✅ **`currentLevel` dans le DB Editor** — tranché par Serge le 04/08 : le champ **reste**,
  mais il n'est envoyé que si quelqu'un a **tapé dedans** (drapeau posé sur l'événement
  `input`). Ni retrait du champ, ni écrasement accidentel : la correction depuis le PC reste
  possible quand elle est intentionnelle. Implémenté au bloc J.
- **Sécurité de la base** (PIN public, règles ouvertes) : décision d'architecture, pas un
  correctif de code. **Toujours ouvert**, à traiter séparément.

## Consigne d'usage — levée après le push des blocs I/J

En attendant le déploiement, **ne pas éditer d'articles dans le DB Editor** : c'est lui qui
détruit les blocages cuisine à chaque enregistrement, et 8 preps sont bloqués. Le correctif
est écrit et testé, mais la production tourne encore sur l'ancien code.
