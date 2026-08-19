# UX/UI Rules
> Last update: 2026-07-27

Référentiel de règles de design UI/UX. Sert à **auditer** n'importe quelle interface qu'on travaille (app mobile, webapp, dashboard) : on cite le numéro de règle (« infraction R5.3 »), on décrit l'écart, on propose l'update.

Compilé de deux sources : (I) concevoir une UI mobile from scratch, (II) les concepts UI/UX fondamentaux. Regroupé sans redondance, tous les principes conservés.

**Comment s'en servir :** pour chaque écran, passer les 8 familles en revue → lister les infractions → proposer un correctif concret.

---

## R1 — Structure & navigation

- **R1.1 — Un écran = une action.** Chaque page (hors accueil) a un but unique. Ne pas polluer un éditeur avec des suggestions ou des actions secondaires. Nouvelle action requise → nouvelle page.
- **R1.2 — Bottom sheet quand changer de page casserait le flux.** Panneau glissant depuis le bas (titre + recherche + Valider/Fermer), contenu de fond visible derrière. Réserver aux cas où perdre le contexte nuit.
- **R1.3 — Navigation ≤ 5 liens.** Barre inférieure flottante : 3-4 idéal, 5 max. Dynamique selon la page. Trop d'items → en faire une page d'accueil / dashboard (façon Notion).
- **R1.4 — Bouton d'action principal à friction minimale.** « + » qui ouvre un menu immédiat ou déploie directement le clavier / le champ. Un seul CTA dominant par écran.
- **R1.5 — Une section = un seul axe.** Sur mobile : soit ça s'empile verticalement, soit ça défile horizontalement (carrousel). Jamais les deux dans une même section → chaos.
- **R1.6 — Choix unique sur mobile.** L'espace contraint force à afficher UN bloc principal à la fois (là où le desktop en montre 5 en parallèle). Accepter de choisir.
- **R1.7 — Layout équilibré.** Éviter l'asymétrie subie et les grandes zones mortes. Répartir : contenu en haut, compteurs/actions sur un côté, bas libéré pour un gros CTA ou une grande recherche.

## R2 — Hiérarchie visuelle & lisibilité

- **R2.1 — Hiérarchie = taille + position + couleur.** Sans hiérarchie, une carte ressemble à un tableau Excel.
- **R2.2 — Un point focal clair.** L'élément clé : grand, gras, en haut. Le secondaire (date, heure, méta) : plus petit, en dessous. Ne pas laisser le focal se fondre dans le reste.
- **R2.3 — Le contraste isole.** Grand vs petit, coloré vs neutre. Ex. un prix : en haut à droite, en couleur → l'œil y va.
- **R2.4 — Visuel > texte quand possible.** Deux points reliés pour un trajet plutôt que « de A à B ». Images/pictos pour la lecture rapide.
- **R2.5 — Un chiffre affiché doit être auto-explicite.** Un grand nombre isolé sans label sans ambiguïté = piège (« 2 » = fait ? restant ? sur combien ?). Le label lève le doute.

## R3 — Espacement & layout

- **R3.1 — Whitespace avant la grille.** Laisser respirer crée l'esthétique. La grille 12 colonnes est un guide, pas un dogme (vitale pour galeries/blogs responsive, optionnelle pour du sur-mesure).
- **R3.2 — Système 4/8 px.** Tous les espacements en multiples de 4 ou 8 → divisible, cohérent. ~32 px entre gros blocs ; resserré pour lier des éléments liés (titre + sous-titre).
- **R3.3 — Pas de double nesting.** Ne jamais imbriquer une carte dans une carte (padding + padding = espace grignoté). Séparer les éléments internes par du blanc, pas par de nouveaux conteneurs.
- **R3.4 — Cartes = regrouper là où le blanc manque.** La carte est un outil de regroupement, pas une décoration systématique.

## R4 — Typographie

- **R4.1 — Une seule police** sans-serif, et s'y tenir. Plusieurs typos = rarement justifié.
- **R4.2 — Assez grand sur mobile.** Police de base ~17 px (iOS) vs ~13 px (desktop). Les éléments sont souvent PLUS grands que sur desktop.
- **R4.3 — Titres serrés.** Grands titres : letter-spacing −2 à −3 %, line-height 110-120 % → aspect pro (le réglage par défaut paraît amateur).
- **R4.4 — Échelle limitée.** ≤ 6 tailles de police sur un site ; dashboard dense → max ~24 px.

## R5 — Couleur & dark mode

- **R5.1 — Une couleur de base**, déclinée en rampe : éclaircir → fonds subtils, assombrir → textes.
- **R5.2 — Couleur = sens, pas déco.** Bleu = confiance, **rouge = danger/urgence**, **jaune/ambre = avertissement**, **vert = succès**. N'utiliser une couleur sémantique que pour ce qu'elle signifie.
- **R5.3 — Ne pas colorer « danger » ce qui n'est pas dangereux.** Une info neutre (timestamp, compteur) en rouge = fausse alerte. Neutre si informatif ; ambre si « attention/périmé » ; rouge réservé au vrai problème.
- **R5.4 — Dark mode : profondeur sans ombre.** Les ombres sont invisibles sur fond sombre → une carte superposée doit être d'un gris **plus clair** que le fond pour signifier l'élévation.
- **R5.5 — Dark mode : adoucir.** Bordures blanches → baisser l'opacité. Chips/badges vifs → désaturer + assombrir le fond, MAIS éclaircir le texte dedans (lisibilité). Oser des fonds violet/rouge/vert très sombres.

## R6 — Composants, signifiants & états

- **R6.1 — Signifiants : guider sans notice.** Encadré/regroupé = lié ; fond ou contour appuyé = actif ; grisé = désactivé. L'interface montre elle-même comment elle marche.
- **R6.2 — 4 briques seulement** : cartes, texte/liens, images, inputs. Pas besoin de plus.
- **R6.3 — Boutons : 4 états dessinés** minimum — défaut / hover / actif (pressé) / désactivé (+ loading avec spinner si besoin).
- **R6.4 — Inputs : états focus + erreur.** Focus au clic ; erreur = bordure rouge + message explicatif dessous ; avertissement pour erreurs non bloquantes.
- **R6.5 — Icônes calées sur le texte.** Taille icône = line-height du texte accompagnant (ex. 24/24 px). Souvent insérées trop grandes.
- **R6.6 — Proportions de bouton.** Ghost button = pas de fond jusqu'au hover. Bouton standard : padding gauche/droite ≈ 2× le padding haut/bas.
- **R6.7 — Épuration dynamique.** Les actions apparaissent/disparaissent au bon moment : mode édition → la nav principale s'efface au profit des outils ; sélection → seulement Valider/Annuler. L'animation entrée/sortie fait partie du design.
- **R6.8 — Cohérence des formats.** Un seul format de date/heure dans tout l'écran, un vocabulaire constant, pas de valeurs bizarres non expliquées (ex. « 1.1 de plus »). Éviter le mélange de langues non intentionnel.

## R7 — Interactions & animation (mobile)

- **R7.1 — Swipe retour** : l'arrière-plan se décale ~35 % à gauche puis se réanime vers la droite pendant le glissement.
- **R7.2 — Bottom sheet animé** : léger dézoom du fond à l'apparition, re-zoom à la fermeture.
- **R7.3 — Swipe vers le haut** pour ouvrir la recherche (pattern Slack / Apple).
- **R7.4 — Long press = clic droit** : flouter le reste, grossir légèrement l'élément, afficher les actions (prévisualisation sur iOS).
- **R7.5 — Ergonomie physique d'abord.** Cibles tactiles ≥ 44 px. Les « gros doigts » priment sur le « faire rentrer plus ».

## R8 — États vides, feedback & médias

- **R8.1 — Rien de statique : chaque action a un retour.** Un clic sans réaction visible = doute.
- **R8.2 — Micro-interactions.** Chip animé « Copié ! » glissant depuis un bord → confirme l'action + touche ludique.
- **R8.3 — Écran d'accueil vide** : ne pas afficher des cartes vides. Simplifier à l'extrême, mettre en avant le « + » + une infobulle d'explication.
- **R8.4 — Recherche infructueuse** : illustration travaillée + « aucun résultat » + suggestion de faute de frappe + **un bouton de sortie visible** (jamais de cul-de-sac).
- **R8.5 — Overlays sur images** : pas de texte blanc brut ni d'assombrissement uniforme. Dégradé linéaire (0 % → sombre vers le texte) ; premium = progressive blur par-dessus le dégradé.

---

## Journal des audits
_(à remplir au fil des analyses : date · écran · infractions relevées · suites données)_

- 2026-07-27 · **Landing Prep Manager (Dashboard/Overview)** — audit initial. Voir conversation ; principales infractions : R5.3 (carte Last Sync en rouge), R1.7/R3.1 (grande zone morte), R2.5 (« 2 / 41 » ambigu), R6.8 (formats date + « 1.1 more »).
