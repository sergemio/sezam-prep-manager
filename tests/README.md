# Tests — Sezam Prep Manager

> Last update: 2026-07-28

Un filet de sécurité à lancer **avant chaque push** : il pilote les 3 pages (Prep
Manager, I&C Inventory, DB Editor) dans un navigateur headless et vérifie ce qui
casse le plus souvent quand on touche au code.

## Sécurité (prod)

L'app parle à la **base Firebase de prod** (partagée avec le resto). Pour ne
JAMAIS toucher aux données réelles, le harnais **stubbe** toutes les écritures
Firebase (`firebaseDb.save*` / `delete*`) : les appels sont capturés en mémoire,
pas persistés. Le login/switch ne touche que `localStorage`.
→ **Sûr à lancer n'importe quand, même en plein service.**

## Lancer

```bash
# 1. Servir l'app en local
python -m http.server 8971 --bind 0.0.0.0

# 2. (une fois) installer Playwright
pip install playwright && playwright install chromium

# 3. Lancer les tests
python tests/smoke.py
```

Code de sortie : **0** = tout passe, **1** = au moins un échec (utilisable en CI).
URL personnalisable : `BASE=http://127.0.0.1:8971 python tests/smoke.py`

## Ce qui est couvert (32 checks)

- **0 erreur console** sur les 3 pages
- **Identité** : boot/défaut, switch user (persistance + labels + toast), dropdown, gate I&C
- **Helpers partagés** : `formatDate`, `initials`, `byDisplayOrder`
- **Navigation** entre sections (PM + I&C)
- **Toasts** : canonique s'affiche, plus aucun `.toast` legacy, aucun dialogue natif
- **Modals** : chaque modal ouvre ET ferme (bouton / clic-hors / Escape), sliders inclus
- **Sauvegardes** (stubbées) : quick-update, can't-prep (PM), quick-update (I&C) → la bonne fonction Firebase est appelée avec la bonne donnée
- **DB Editor** : helpers chargés, `formatCheckDate` délègue à `formatDate`

## Quand un test échoue

Le rapport indique quel check et un détail. Reproduis manuellement le scénario en
local avant de conclure — parfois c'est le test (timing, sélecteur) et non l'app.
Ajoute un nouveau `safe("id", lambda: ...)` dans `smoke.py` quand tu ajoutes une
fonctionnalité, pour que le filet grandisse avec l'app.
