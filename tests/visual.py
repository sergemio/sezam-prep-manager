"""Non-regression VISUELLE — filet du chantier CSS.

Photographie chaque ecran de l'app (PM, I&C, DB editor) en deux tailles, puis
compare a une reference. Sert a prouver qu'un changement CSS annonce comme
"invisible" l'est reellement, plutot que de le supposer.

    python tests/visual.py --baseline    # cree la reference (avant travaux)
    python tests/visual.py               # compare a la reference
    python tests/visual.py --update      # accepte les ecarts comme nouvelle ref

Sortie : un tableau ecran par ecran avec le % de pixels differents, et un PNG
de diff (zones changees en rouge) pour chaque ecart, dans tests/visual/diff/.

Firebase est STUBBE en ecriture (meme blob que smoke.py) : aucune ecriture en
base. Les donnees LUES viennent de la vraie base, donc un ecart peut aussi
venir d'un changement de donnees -- d'ou le PNG de diff, a regarder avant de
conclure a une regression CSS.
"""
import argparse
import os
import sys

from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8971"
HERE = os.path.dirname(os.path.abspath(__file__))
REF = os.path.join(HERE, "visual", "ref")
CUR = os.path.join(HERE, "visual", "cur")
DIFF = os.path.join(HERE, "visual", "diff")

# Meme stub d'ecriture que smoke.py : aucune ecriture Firebase depuis les tests.
STUB = """() => {
  const db = window.firebaseDb || {};
  ['saveItem','saveItemFields','saveAllItems','saveIcItem','saveIcItemFields',
   'saveAllIcItems','saveIcActivityLog',
   'deleteIcItem','saveTask','saveAllStaffMembers','deleteIcActivityLogs',
   'saveActivityLog','saveTeamMessage','deleteTeamMessage',
   'saveDeliveryIssue','deleteDeliveryIssue'].forEach(function (fn) {
    if (typeof db[fn] === 'function') db[fn] = function () { return Promise.resolve(); };
  });
  if (typeof db.loadDeliveryIssues === 'function')
    db.loadDeliveryIssues = function () { return Promise.resolve([]); };
}"""

# Fige tout ce qui bouge : sans ca, une transition en cours suffit a faire
# echouer la comparaison et le filet devient du bruit.
FREEZE = """
  *, *::before, *::after {
    animation-duration: 0s !important; animation-delay: 0s !important;
    transition-duration: 0s !important; transition-delay: 0s !important;
    caret-color: transparent !important;
  }
"""

# Les horodatages RELATIFS ("2h ago", "Yesterday") changent entre deux captures
# et, sur la largeur iPad, un libelle plus long provoque un retour a la ligne qui
# decale toute la page : un ecart de 6 % sans une seule regression CSS. On fige
# donc ces textes avant chaque capture. Sans ca le harnais crie au loup, et un
# filet auquel on ne croit plus ne sert a rien.
NORMALISE = r"""() => {
  const RE = /(\d+\s*(?:h|m|min|mins|d|days?|hours?)\s+ago|just now|yesterday|today|à l'instant)/gi;
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const hits = [];
  let n; while ((n = walk.nextNode())) if (RE.test(n.nodeValue)) hits.push(n);
  hits.forEach(t => { t.nodeValue = t.nodeValue.replace(RE, 'X ago'); });
  return hits.length;
}"""

VIEWPORTS = [("pc", 1280, 900), ("ipad", 820, 1180)]


def nav(pg, section):
    pg.evaluate(
        "(s) => { const b=[...document.querySelectorAll('.nav-button')]"
        ".find(x=>x.getAttribute('data-section')===s); if(b) b.click(); }", section)
    pg.wait_for_timeout(500)


def open_first_item(pg, table_sel):
    pg.evaluate("(s) => { const el=document.querySelector(s); if(el) el.click(); }", table_sel)
    pg.wait_for_timeout(700)


def clear_noise(pg):
    """Toasts seulement — surgissent quand ils veulent et polluent n'importe
    quelle capture. Ne touche PAS aux modales : certaines captures les visent."""
    pg.evaluate("""() => { document.querySelectorAll('.app-notification,.user-switch-toast')
        .forEach(e => e.remove()); }""")


def clear_overlays(pg):
    """Remet la page a nu entre deux ecrans : modales, menu, toasts."""
    pg.evaluate("""() => {
        document.querySelectorAll('.modal-backdrop,#user-dropdown,.app-notification,.user-switch-toast')
            .forEach(e => e.remove()); }""")
    pg.wait_for_timeout(200)


def shots(pg, tag, out, _unused=None):
    """Rend la fonction de capture. Le nettoyage des surcouches et le figeage des
    horodatages sont faits DANS snap() : les oublier ailleurs rendait le harnais
    non deterministe (toast « Sync Complete » attrape au vol, « 2h ago »)."""
    def snap(name):
        clear_noise(pg)
        pg.evaluate(NORMALISE)
        pg.wait_for_timeout(250)
        pg.screenshot(path=os.path.join(out, f"{tag}__{name}.png"), full_page=False)
    return snap


def capture(out):
    os.makedirs(out, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for label, w, h in VIEWPORTS:
            # ---------- Prep Manager ----------
            pg = browser.new_page(viewport={"width": w, "height": h})
            pg.add_style_tag = pg.add_style_tag  # noqa
            pg.goto(BASE + "/index.html", wait_until="networkidle")
            pg.wait_for_timeout(1200)
            # Vider la cle AVANT le rechargement ne suffit pas : le module la
            # relit et reaffiche le dashboard. On force l'ecran de connexion via
            # la session partagee, sinon la capture "gate" montrait le dashboard.
            pg.evaluate("""() => { localStorage.removeItem('currentStaff');
                if (window.UserSession) UserSession.clear();
                if (typeof showStaffSelection === 'function') showStaffSelection(); }""")
            pg.wait_for_timeout(1200)
            pg.add_style_tag(content=FREEZE)
            snap = shots(pg, f"pm-{label}", out)
            snap("gate")

            pg.evaluate("() => localStorage.setItem('currentStaff','Serge M')")
            pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2000)
            pg.add_style_tag(content=FREEZE)
            pg.evaluate(STUB)
            clear_overlays(pg)
            for sec in ("dashboard", "preps", "history", "inventory"):
                nav(pg, sec); clear_overlays(pg); snap("sec-" + sec)

            nav(pg, "dashboard")
            pg.evaluate("() => { if (prepItems && prepItems.length) showQuickUpdateModal(prepItems[0]); }")
            pg.wait_for_timeout(800); snap("modal-quick")
            clear_overlays(pg)

            # Accolades obligatoires : une fleche a corps d'expression RENVOIE la
            # promesse de pick(), que Playwright attend -- et elle ne se resout
            # jamais tant que personne n'a clique. Le harnais restait fige.
            pg.evaluate("() => { UserSession.pick({title:'Who will perform this check?', subtitle:'Select staff member performing Prep-Check'}); }")
            pg.wait_for_timeout(800); snap("modal-picker")
            clear_overlays(pg)

            pg.evaluate("() => { if (typeof startPrepCheckProcess==='function') startPrepCheckProcess(); }")
            pg.wait_for_timeout(900); snap("prep-check")
            pg.close()

            # ---------- I&C ----------
            pg = browser.new_page(viewport={"width": w, "height": h})
            pg.goto(BASE + "/ic-inventory.html", wait_until="networkidle")
            pg.wait_for_timeout(1200)
            pg.evaluate("() => localStorage.setItem('currentStaff','Serge M')")
            pg.reload(wait_until="networkidle"); pg.wait_for_timeout(2000)
            pg.add_style_tag(content=FREEZE)
            pg.evaluate(STUB)
            snap = shots(pg, f"ic-{label}", out)
            clear_overlays(pg)
            for sec in ("dashboard", "overview", "history"):
                nav(pg, sec); clear_overlays(pg); snap("sec-" + sec)

            nav(pg, "overview")
            open_first_item(pg, ".overview-table .level-bar-container")
            snap("modal-order")
            pg.evaluate("() => { const t=document.querySelector('.qu-tab[data-tab=\"stock\"]'); if(t) t.click(); }")
            pg.wait_for_timeout(400); snap("modal-stock")
            clear_overlays(pg)

            pg.evaluate("() => { const b=document.getElementById('start-count-btn'); if(b) b.click(); }")
            pg.wait_for_timeout(900); snap("full-count")
            pg.evaluate("() => { const b=document.getElementById('cancel-count-btn'); if(b) b.click(); }")
            pg.wait_for_timeout(400)

            # ecran de reception (3 articles en attente, en memoire seulement)
            pg.evaluate("""() => { (window.icItems||[]).slice(0,3).forEach((it,i) => {
                it.pendingQty = i+1; it.pendingAt = new Date().toISOString(); it.pendingProvider='Metro'; }); }""")
            nav(pg, "overview"); clear_overlays(pg); snap("pending-banner")
            pg.evaluate("() => { const b=document.querySelector('.pending-banner__btn'); if(b) b.click(); }")
            pg.wait_for_timeout(800); snap("modal-reception")
            pg.close()

            # ---------- DB editor ----------
            pg = browser.new_page(viewport={"width": w, "height": h})
            pg.goto(BASE + "/db-editor.html", wait_until="networkidle")
            pg.wait_for_timeout(2000)
            pg.add_style_tag(content=FREEZE)
            snap = shots(pg, f"db-{label}", out)
            clear_overlays(pg); snap("main")
            pg.close()
        browser.close()


def compare():
    os.makedirs(DIFF, exist_ok=True)
    names = sorted(f for f in os.listdir(REF) if f.endswith(".png"))
    if not names:
        print("Pas de reference. Lancer : python tests/visual.py --baseline")
        return 1
    worst, rows = 0.0, []
    for n in names:
        a_p, b_p = os.path.join(REF, n), os.path.join(CUR, n)
        if not os.path.exists(b_p):
            rows.append((n, None, "MANQUANT")); continue
        a, b = Image.open(a_p).convert("RGB"), Image.open(b_p).convert("RGB")
        if a.size != b.size:
            rows.append((n, None, f"TAILLE {a.size} -> {b.size}")); continue
        diff = ImageChops.difference(a, b)
        bbox = diff.getbbox()
        if bbox is None:
            rows.append((n, 0.0, "identique")); continue
        # % de pixels non nuls
        mask = diff.convert("L").point(lambda v: 255 if v > 8 else 0)
        changed = sum(mask.histogram()[255:])
        pct = 100.0 * changed / (a.size[0] * a.size[1])
        worst = max(worst, pct)
        red = Image.new("RGB", a.size, (255, 0, 0))
        out = Image.composite(red, b, mask)
        out.save(os.path.join(DIFF, n))
        rows.append((n, pct, f"diff -> tests/visual/diff/{n}"))

    print("\n=== Non-regression visuelle ===")
    for n, pct, note in rows:
        p = "     -" if pct is None else f"{pct:8.3f}%"
        flag = "OK  " if (pct == 0.0) else ("... " if pct is not None and pct < 0.05 else "DIFF")
        print(f"  {flag} {p}  {n:38} {note if pct != 0.0 else ''}")
    n_diff = sum(1 for _, p, _ in rows if p != 0.0)
    print(f"\n{len(rows) - n_diff}/{len(rows)} ecrans identiques au pixel pres"
          f"{'' if not n_diff else f' — {n_diff} a inspecter (pire ecart {worst:.3f}%)'}")
    return 0 if n_diff == 0 else 2


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--baseline", action="store_true", help="cree la reference")
    ap.add_argument("--update", action="store_true", help="remplace la reference par l'etat courant")
    args = ap.parse_args()

    if args.baseline or args.update:
        target = REF
        if os.path.isdir(target):
            for f in os.listdir(target):
                os.remove(os.path.join(target, f))
        capture(target)
        print(f"Reference ecrite : {len(os.listdir(target))} captures dans {target}")
        sys.exit(0)

    if os.path.isdir(CUR):
        for f in os.listdir(CUR):
            os.remove(os.path.join(CUR, f))
    capture(CUR)
    sys.exit(compare())
