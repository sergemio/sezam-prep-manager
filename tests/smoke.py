#!/usr/bin/env python3
"""
Sezam Prep Manager — smoke test harness.

WHAT IT DOES
  Drives the three pages (Prep Manager, I&C Inventory, DB Editor) in a headless
  browser and checks the behaviours most likely to break when the code changes:
  0 console errors, identity/login, shared helpers, navigation, toasts, every
  modal opening AND closing (button / backdrop / Escape), and the save flows.

SAFETY — READS/WRITES
  The app talks to the SHARED production Firebase. To never touch live restaurant
  data, this harness STUBS every firebaseDb.save*/delete* method (see STUB) so
  writes are captured in-memory, not persisted. Login/switch only touch
  localStorage. => safe to run anytime, even during service.

HOW TO RUN
  1. Serve the app locally:   python -m http.server 8971 --bind 0.0.0.0
  2. Install once:            pip install playwright && playwright install chromium
  3. Run:                     python tests/smoke.py
  Exit code 0 = all passed, 1 = at least one failure (CI-friendly).
  Override the URL:           BASE=http://127.0.0.1:8971 python tests/smoke.py
"""
import os
import sys
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "http://127.0.0.1:8971")

# Replace every Firebase write with a capturing no-op so nothing hits prod.
STUB = """() => {
  window.__saveCalls = [];
  const rec = (fn, a) => window.__saveCalls.push({fn: fn, args: a});
  const db = window.firebaseDb || {};
  ['saveItem','saveItemFields','saveAllItems','saveIcItem','saveIcItemFields',
   'saveAllIcItems','saveIcActivityLog','updatePaths',
   'deleteIcItem','saveTask','saveAllStaffMembers','deleteIcActivityLogs',
   'saveActivityLog','saveTeamMessage','deleteTeamMessage',
   'saveDeliveryIssue','deleteDeliveryIssue'].forEach(function (fn) {
    if (typeof db[fn] === 'function') db[fn] = function () { rec(fn, [].slice.call(arguments)); return Promise.resolve(); };
  });
  // Claims are READ from prod (harmless), but tests need a deterministic list.
  if (typeof db.loadDeliveryIssues === 'function')
    db.loadDeliveryIssues = function () { return Promise.resolve(window.__fakeClaims || []); };
  if (window.historySystem) {
    ['logQuantityChange','logItemModification','logActivity'].forEach(function (fn) {
      if (typeof window.historySystem[fn] === 'function')
        window.historySystem[fn] = function () { rec(fn, [].slice.call(arguments)); return Promise.resolve(); };
    });
  }
  return true;
}"""

results = []  # (id, ok, detail)
def rec(tid, ok, detail=""):
    results.append((tid, bool(ok), detail))
def safe(tid, fn, detail=""):
    try:
        rec(tid, fn(), detail)
    except Exception as e:
        rec(tid, False, "EXC: " + str(e).splitlines()[0])

def mcount(pg):
    return pg.evaluate("() => document.querySelectorAll('.modal-backdrop').length")
def clear_modals(pg):
    pg.evaluate("() => document.querySelectorAll('.modal-backdrop').forEach(m => m.remove())")

def make_page(browser, errs, dialogs):
    pg = browser.new_page(viewport={"width": 1280, "height": 900})
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    pg.on("dialog", lambda d: (dialogs.append(d.type + ":" + d.message[:40]), d.dismiss()))
    return pg


def run_pm(browser):
    errs, dialogs = [], []
    pg = make_page(browser, errs, dialogs)
    pg.goto(BASE + "/index.html", wait_until="networkidle")
    pg.wait_for_timeout(1600)
    pg.evaluate(STUB)

    # B. identity (localStorage only)
    safe("PM/boot-default-user", lambda: pg.evaluate(
        "() => UserSession.get()==='Serge M' && localStorage.getItem('currentStaff')==='Serge M'"))
    # switch via staff selection
    pg.evaluate("() => { UserSession.clear(); if (typeof showStaffSelection==='function') showStaffSelection(); }")
    pg.wait_for_timeout(300)
    pg.evaluate("() => { const b=[...document.querySelectorAll('.staff-button')].filter(x=>x.offsetParent)[1]; if(b) b.click(); }")
    pg.wait_for_timeout(500)
    safe("PM/switch-user-persists+labels", lambda: pg.evaluate(
        "() => { const u=UserSession.get(); return !!u && localStorage.getItem('currentStaff')===u && (document.getElementById('header-user-name')||{}).textContent===u; }"))
    safe("PM/switch-shows-toast", lambda: pg.evaluate("() => !!document.querySelector('.user-switch-toast')"))
    # dropdown
    pg.evaluate("() => { const d=document.getElementById('user-dropdown'); if(d) d.remove(); toggleUserDropdown(); }")
    pg.wait_for_timeout(200)
    safe("PM/user-dropdown-picks", lambda: (
        pg.evaluate("() => document.querySelectorAll('#user-dropdown .dropdown-item').length") > 0
        and (pg.evaluate("() => { const it=document.querySelector('#user-dropdown .dropdown-item'); if(it) it.click(); return true; }"))
        and pg.wait_for_timeout(250) is None
        and pg.evaluate("() => (document.getElementById('header-user-name')||{}).textContent===UserSession.get()")))

    # C. helpers
    safe("helpers/formatDate", lambda: pg.evaluate("() => formatDate('2025-03-09 14:30')==='9 Mar, 14:30'"))
    safe("helpers/initials", lambda: pg.evaluate("() => initials('Serge M')==='SM' && initials('Tatiana')==='T' && initials('A B C')==='AB'"))
    safe("helpers/byDisplayOrder", lambda: pg.evaluate(
        "() => { const a=[{id:2},{id:1,displayOrder:5},{id:3,displayOrder:1}].sort(byDisplayOrder); return a[0].displayOrder===1 && a[1].displayOrder===5 && a[2].id===2; }"))

    # D. navigation
    safe("PM/nav-sections", lambda: all(":block" in s for s in pg.evaluate(
        "() => { const o=[]; document.querySelectorAll('.nav-button').forEach(b=>{ const s=b.getAttribute('data-section'); if(s){ b.click(); const el=document.getElementById(s+'-section'); if(el) o.push(s+':'+getComputedStyle(el).display); } }); return o; }")))

    # E. toasts
    pg.evaluate("() => showNotification('t','','success')")
    pg.wait_for_timeout(150)
    safe("toasts/canonical-shows", lambda: pg.evaluate("() => !!document.querySelector('.app-notification')"))
    safe("toasts/no-legacy-toast", lambda: pg.evaluate("() => document.querySelectorAll('.toast').length===0"))

    # F. modals open + close (Escape and backdrop). PM builders are global.
    def open_close(trigger, slider=False):
        clear_modals(pg)
        pg.evaluate(trigger); pg.wait_for_timeout(500)
        opened = mcount(pg)
        has_slider = pg.evaluate("() => !!document.querySelector('.slider-container')") if slider else None
        pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        closed_esc = mcount(pg)
        pg.evaluate(trigger); pg.wait_for_timeout(400)
        pg.mouse.click(6, 6); pg.wait_for_timeout(300)
        closed_bd = mcount(pg)
        return opened >= 1 and closed_esc == 0 and closed_bd == 0 and (has_slider in (None, True))
    safe("PM/modal-quick-update", lambda: open_close("() => { if(prepItems.length) showQuickUpdateModal(prepItems[0]); }", slider=True))
    safe("PM/modal-cant-prep", lambda: open_close("() => { if(prepItems.length) showCantPrepReasonModal(prepItems[0], ()=>{}); }"))
    safe("PM/modal-single-update", lambda: open_close("() => showSingleItemUpdateModal()"))
    def prep_staff():
        clear_modals(pg)
        pg.evaluate("() => startPrepCheck()"); pg.wait_for_timeout(600)
        ok = mcount(pg) >= 1 and pg.evaluate("() => document.querySelectorAll('.staff-select-button').length") > 0
        pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        return ok and mcount(pg) == 0
    safe("PM/modal-prepcheck-staff", prep_staff)

    # Le zebrage vit dans le socle commun (styles.css) et non plus en double.
    # Ce check echoue si quelqu'un le redeplace dans une feuille chargee AVANT
    # le survol : a specificite egale, c'est l'ordre source qui tranche.
    def zebra_shared():
        d = pg.evaluate("""() => {
            const t = document.createElement('table');
            t.className = 'db-table';
            t.innerHTML = '<tbody><tr><td>a</td></tr><tr><td>b</td></tr></tbody>';
            document.body.appendChild(t);
            const rows = t.querySelectorAll('tbody tr');
            const bg = e => getComputedStyle(e).backgroundColor;
            const r = { odd: bg(rows[0]), even: bg(rows[1]),
                        muted: getComputedStyle(document.documentElement)
                                 .getPropertyValue('--surface-muted').trim() };
            t.remove(); return r; }""")
        # #f5f5f0 -> rgb(245, 245, 240)
        return d["even"] == "rgb(245, 245, 240)" and d["odd"] != d["even"]
    safe("shared/table-zebra", zebra_shared)

    # History wording is shared (describeLog). The I&C renderer had its own copy
    # and printed an order as "modified · 0 → 1 bag" — an arrow, i.e. the grammar
    # of a stock move, for an action that never touches the stock.
    def describe_log():
        d = pg.evaluate("""() => {
            const u='bag';
            const order  = describeLog({actionType:'order',  oldValue:0, newValue:1, unit:u, stock:4});
            const cancel = describeLog({actionType:'order',  oldValue:1, newValue:0, unit:u, stock:4});
            const recv   = describeLog({actionType:'receive', oldValue:4, newValue:7, unit:u, receivedQty:3});
            const miss   = describeLog({actionType:'not-delivered', oldValue:3, newValue:2, unit:u, missingQty:1});
            const count  = describeLog({actionType:'count', oldValue:1, newValue:2, unit:u});
            const prep   = describeLog({actionType:'prep',  oldValue:1, newValue:2, unit:u});
            return {order, cancel, recv, miss, count,
                    countPM: describeLog({actionType:'count', oldValue:1, newValue:2, unit:u}, {count:'checked'}),
                    prepIsNull: prep === null}; }""")
        arrow = lambda x: "→" in x["change"]
        return (d["order"]["label"] == "ordered" and not arrow(d["order"])
                and "stays 4" in d["order"]["change"]
                and d["cancel"]["label"] == "order cancelled" and not arrow(d["cancel"])
                and d["recv"]["label"] == "received" and arrow(d["recv"])      # stock DID move
                and d["miss"]["label"] == "not delivered" and not arrow(d["miss"])
                and d["count"]["label"] == "counted" and d["countPM"]["label"] == "checked"
                and d["prepIsNull"])                                          # prep stays module-local
    safe("shared/describeLog-semantics", describe_log)

    # Shared staff picker (UserSession.pick): one tap on a name sets the session
    # and resolves it — no separate confirm step, no per-module copy.
    def picker_one_tap():
        clear_modals(pg)
        pg.evaluate("() => { window.__picked = null; UserSession.pick({title:'T'}).then(n => window.__picked = n); }")
        pg.wait_for_timeout(700)
        shape = pg.evaluate("""() => ({
            n: document.querySelectorAll('.staff-select-button').length,
            marked: document.querySelectorAll('.staff-select-button.selected').length,
            avatar: !!document.querySelector('.staff-select-button .staff-initial'),
            inline: [...document.querySelectorAll('.staff-select-button')].some(b => b.getAttribute('style')),
            buttons: [...document.querySelectorAll('.btn-group button')].map(b => b.textContent.trim()) })""")
        pg.evaluate("""() => { const b=[...document.querySelectorAll('.staff-select-button')]
            .find(x => x.getAttribute('data-staff') !== UserSession.get()); if (b) b.click(); }""")
        pg.wait_for_timeout(500)
        picked = pg.evaluate("() => window.__picked")
        closed = mcount(pg) == 0
        session = pg.evaluate("() => UserSession.get()")
        pg.evaluate("() => UserSession.set('Serge M', {toast:false})")
        clear_modals(pg)
        return (shape["n"] > 1 and shape["avatar"] and not shape["inline"]
                and shape["buttons"] == ["Cancel"]          # no "Continue" step left
                and bool(picked) and picked == session and closed)
    safe("shared/staff-picker-one-tap", picker_one_tap)

    # The user dropdown must still list everyone when Firebase is unreachable.
    # The three old copies read window.staffMembers directly, which is only set
    # when Firebase answers — an outage left the menu empty and you could no
    # longer switch user at all.
    def dropdown_survives_outage():
        pg.evaluate("() => { const d=document.getElementById('user-dropdown'); if(d) d.remove(); }")
        names = pg.evaluate("""() => { const saved = window.staffMembers;
            window.staffMembers = undefined;                 // simulate the outage
            const n = UserSession.staffNames().length;
            window.staffMembers = saved; return n; }""")
        opened = pg.evaluate("""() => {
            const b = document.getElementById('user-login-btn') || document.querySelector('.nav-button');
            const m = UserSession.dropdown(b);
            const rows = m ? m.querySelectorAll('.dropdown-item').length : 0;
            const inline = m ? !!m.getAttribute('style') && m.getAttribute('style').indexOf('box-shadow') !== -1 : true;
            if (m) m.remove();
            return { rows, inline }; }""")
        return names > 0 and opened["rows"] > 0 and not opened["inline"]
    safe("shared/dropdown-survives-firebase-outage", dropdown_survives_outage)

    # Opening twice must toggle, not stack a second panel on the page.
    def dropdown_toggles():
        pg.evaluate("() => { const d=document.getElementById('user-dropdown'); if(d) d.remove(); }")
        d = pg.evaluate("""() => {
            const b = document.getElementById('user-login-btn') || document.querySelector('.nav-button');
            UserSession.dropdown(b);
            const after1 = document.querySelectorAll('#user-dropdown').length;
            UserSession.dropdown(b);
            const after2 = document.querySelectorAll('#user-dropdown').length;
            return { after1, after2 }; }""")
        return d["after1"] == 1 and d["after2"] == 0

    safe("shared/dropdown-toggles", dropdown_toggles)

    # The login gate is the shared component in both modules: real buttons, no
    # loading text left behind, no styles written inline in JS.
    def gate_shared():
        d = pg.evaluate("""() => {
            const grid = document.createElement('div');
            document.body.appendChild(grid);
            return UserSession.renderGate(grid, () => {}).then(() => {
                const btns = [...grid.querySelectorAll('.staff-button')];
                const r = { n: btns.length,
                            inline: btns.some(b => b.getAttribute('style')),
                            loading: grid.textContent.indexOf('Loading') !== -1 };
                grid.remove(); return r; }); }""")
        return d["n"] > 1 and not d["inline"] and not d["loading"]
    safe("shared/staff-gate-rendered", gate_shared)

    # Cancel / Escape must resolve '' rather than leaving the caller hanging.
    def picker_cancel():
        clear_modals(pg)
        pg.evaluate("() => { window.__picked = 'UNSET'; UserSession.pick({title:'T'}).then(n => window.__picked = n); }")
        pg.wait_for_timeout(600)
        pg.keyboard.press("Escape"); pg.wait_for_timeout(400)
        return pg.evaluate("() => window.__picked") == "" and mcount(pg) == 0
    safe("shared/staff-picker-cancel", picker_cancel)

    # G. save flows (stubbed)
    def g_quick():
        clear_modals(pg)
        pg.evaluate("() => { window.__saveCalls=[]; showQuickUpdateModal(prepItems[0]); }")
        pg.wait_for_timeout(700)  # let the slider's deferred init run before we save
        pg.evaluate("""() => { const h=document.getElementById('modal-current-level'); if(h) h.value='3';
            const box=document.querySelector('.modal-box'); const s=[...box.querySelectorAll('button')].find(b=>b.textContent.trim()==='Save'); if(s) s.click(); }""")
        pg.wait_for_timeout(500)
        d = pg.evaluate("() => { const c=(window.__saveCalls||[]).find(x=>x.fn==='saveItem'); return c?{cl:c.args[0].currentLevel,by:c.args[0].lastCheckedBy}:null; }")
        clear_modals(pg)
        return bool(d) and d["cl"] == 3 and bool(d["by"])
    safe("PM/save-quick-update", g_quick)
    def g_cantprep():
        pg.evaluate("() => { window.__saveCalls=[]; markItemAsCantPrep(prepItems[0], 'Missing Ingredients'); }")
        pg.wait_for_timeout(400)
        d = pg.evaluate("() => { const c=(window.__saveCalls||[]).find(x=>x.fn==='saveItem'); return c?{cp:c.args[0].canPrep,r:c.args[0].cantPrepReason}:null; }")
        return bool(d) and d["cp"] is False and d["r"] == "Missing Ingredients"
    safe("PM/save-cant-prep", g_cantprep)

    # H. task-appear chime: a NEW due task rings exactly once; a no-op re-render
    # stays silent; already-due tasks at baseline never ring.
    def g_taskbeep():
        pg.evaluate("() => { window.__beeps=0; SoundFX.taskAppear=()=>{window.__beeps++;}; updateTodoList(); }")
        base = pg.evaluate("() => window.__beeps")
        pg.evaluate("""() => { tasks.push({id:'__smoke_task',name:'SMOKE',type:'recurring',
            frequencyDays:1,active:true,forceDisplay:true}); updateTodoList(); }""")
        after_new = pg.evaluate("() => window.__beeps")
        pg.evaluate("() => updateTodoList()")
        after_repeat = pg.evaluate("() => window.__beeps")
        pg.evaluate("() => { tasks = tasks.filter(t => t.id !== '__smoke_task'); updateTodoList(); }")
        return base == 0 and after_new == 1 and after_repeat == 1
    safe("PM/task-appear-chime", g_taskbeep)

    # I. team message: injecté -> panneau brillant + bips ; Received -> log+calme ; Completed -> log+retrait
    def g_teammsg():
        pg.evaluate("""() => {
            window.__msgBeeps = 0;
            if (typeof SoundFX !== 'undefined') SoundFX.messageAlert = () => { window.__msgBeeps++; };
            window.__saveCalls = [];
            teamMessages = [{ id:'__smoke_msg', text:'CLEAN THE FRIDGE', sentBy:'admin',
                sentAt:'2026-01-01T10:00:00.000Z', receivedBy:null, receivedAt:null,
                completedBy:null, completedAt:null }];
            renderTeamMessages();
        }""")
        pg.wait_for_timeout(250)
        r = pg.evaluate("""() => { const c=document.getElementById('team-messages-container');
            return { glow: !!c.querySelector('.team-message.is-new'),
                     text: (c.querySelector('.team-message-text')||{}).textContent||'',
                     recv: !!c.querySelector('.team-message-btn--received'),
                     comp: !!c.querySelector('.team-message-btn--completed'),
                     beeps: window.__msgBeeps }; }""")
        ok_render = r["glow"] and "CLEAN THE FRIDGE" in r["text"] and r["recv"] and r["comp"] and r["beeps"] >= 1
        pg.evaluate("() => { markMessageReceived('__smoke_msg'); renderTeamMessages(); }")
        pg.wait_for_timeout(100)
        rv = pg.evaluate("""() => { const c=(window.__saveCalls||[]);
            const s=c.find(x=>x.fn==='saveTeamMessage');
            return { saved: !!(s && s.args[0].receivedBy),
                     logged: !!c.find(x=>x.fn==='saveActivityLog' && x.args[0].actionType==='message-received'),
                     calm: !document.querySelector('.team-message.is-new') && !document.querySelector('.team-message-btn--received') }; }""")
        ok_recv = rv["saved"] and rv["logged"] and rv["calm"]
        pg.evaluate("() => markMessageCompleted('__smoke_msg')")
        pg.wait_for_timeout(100)
        cp = pg.evaluate("""() => { const c=(window.__saveCalls||[]);
            return { logged: !!c.find(x=>x.fn==='saveActivityLog' && x.args[0].actionType==='message-done'),
                     deleted: !!c.find(x=>x.fn==='deleteTeamMessage') }; }""")
        pg.evaluate("() => { teamMessages = []; renderTeamMessages(); }")
        return ok_render and ok_recv and cp["logged"] and cp["deleted"]
    safe("PM/team-message-flow", g_teammsg)

    rec("PM/no-native-dialogs", len(dialogs) == 0, str(dialogs))
    rec("PM/0-console-errors", len(errs) == 0, (str(errs[:3]) if errs else ""))
    pg.close()


def run_ic(browser):
    errs, dialogs = [], []
    pg = make_page(browser, errs, dialogs)
    pg.goto(BASE + "/ic-inventory.html", wait_until="networkidle")
    pg.wait_for_timeout(1500)
    # fresh gate
    pg.evaluate("() => localStorage.clear()")
    pg.reload(wait_until="networkidle"); pg.wait_for_timeout(1400)
    pg.evaluate(STUB)
    gate = pg.evaluate("() => document.querySelectorAll('.staff-button').length")
    pg.evaluate("() => { const g=[...document.querySelectorAll('.staff-button')].filter(x=>x.offsetParent)[0]; if(g) g.click(); }")
    pg.wait_for_timeout(1200)
    rec("IC/gate-login-persists", gate > 0 and pg.evaluate(
        "() => !!UserSession.get() && localStorage.getItem('currentStaff')===UserSession.get()"), "gateBtns=" + str(gate))
    safe("IC/formatDate-matches-PM", lambda: pg.evaluate("() => formatDate('2025-03-09 14:30')==='9 Mar, 14:30'"))
    safe("IC/nav-sections", lambda: all(":block" in s for s in pg.evaluate(
        "() => { const o=[]; document.querySelectorAll('.nav-button').forEach(b=>{ const s=b.getAttribute('data-section'); if(s){ b.click(); const el=document.getElementById(s+'-section'); if(el) o.push(s+':'+getComputedStyle(el).display); } }); return o; }")))

    # IC builders are nested in the IIFE -> trigger via UI clicks.
    pg.evaluate("() => { const n=[...document.querySelectorAll('.nav-button')].find(b=>b.getAttribute('data-section')==='overview'); if(n)n.click(); }")
    pg.wait_for_timeout(500)
    safe("IC/level-bar-colored", lambda: 'rgb' in (pg.evaluate(
        "() => { const f=document.querySelector('.overview-table .level-bar-fill'); return f?(f.style.backgroundColor||getComputedStyle(f).backgroundColor):'none'; }") or ''))

    def oc_click(js, slider=False):
        clear_modals(pg)
        pg.evaluate(js); pg.wait_for_timeout(600)
        opened = mcount(pg)
        hs = pg.evaluate("() => !!document.querySelector('.slider-container')") if slider else None
        pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        closed = mcount(pg)
        return opened >= 1 and closed == 0 and (hs in (None, True))
    safe("IC/modal-add-new", lambda: oc_click("() => { const b=document.getElementById('overview-add-item-btn'); if(b) b.click(); }"))
    safe("IC/modal-quick-update", lambda: oc_click("() => { const el=document.querySelector('.overview-table .level-bar-container'); if(el) el.click(); }", slider=True))

    # I&C must render the SAME shared picker as the Prep Manager — same markup,
    # no locally-built copy (the old one styled its buttons inline, in JS).
    def count_staff():
        clear_modals(pg)
        pg.evaluate("() => UserSession.clear()")
        pg.evaluate("() => document.getElementById('start-count-btn').click()")
        pg.wait_for_timeout(900)
        shape = pg.evaluate("""() => ({
            n: document.querySelectorAll('.staff-select-button').length,
            avatar: !!document.querySelector('.staff-select-button .staff-initial'),
            inline: [...document.querySelectorAll('.staff-select-button')].some(b => b.getAttribute('style')),
            buttons: [...document.querySelectorAll('.btn-group button')].map(b => b.textContent.trim()) })""")
        ok = (mcount(pg) >= 1 and shape["n"] > 1 and shape["avatar"]
              and not shape["inline"] and shape["buttons"] == ["Cancel"])
        pg.mouse.click(6, 6); pg.wait_for_timeout(300)
        ok = ok and mcount(pg) == 0
        pg.evaluate("() => UserSession.set('Serge M', {toast:false})")
        return ok
    safe("IC/modal-count-staff", count_staff)

    # Zebrage du tableau I&C + jetons de severite resolus. Une var() mal orthographiee
    # ne casse rien de visible en test fonctionnel : elle rend juste la couleur
    # transparente. Ce check l'attrape.
    def ic_table_and_tokens():
        pg.evaluate("""() => { const n=[...document.querySelectorAll('.nav-button')]
            .find(b=>b.getAttribute('data-section')==='overview'); if(n) n.click(); }""")
        pg.wait_for_timeout(600)
        d = pg.evaluate("""() => {
            const rows = [...document.querySelectorAll('.overview-table tbody tr')];
            const cs = getComputedStyle(document.documentElement);
            const tok = n => cs.getPropertyValue(n).trim();
            return { even: rows[1] ? getComputedStyle(rows[1]).backgroundColor : '',
                     odd:  rows[0] ? getComputedStyle(rows[0]).backgroundColor : '',
                     missing: ['--sev-critical','--sev-warn','--sev-neutral',
                               '--table-border','--table-hover','--table-row-border',
                               '--surface-alt','--surface-track','--danger-tint']
                              .filter(n => !tok(n)) }; }""")
        return (d["even"] == "rgb(245, 245, 240)" and d["odd"] != d["even"]
                and d["missing"] == [])
    safe("IC/table-zebra-and-tokens", ic_table_and_tokens)

    # Full count screen: preps-style card — progress fill, user badge, location
    # line, then Cancel returns to the dashboard.
    def count_screen():
        clear_modals(pg)
        pg.evaluate("() => document.getElementById('start-count-btn').click()")
        pg.wait_for_timeout(700)
        d = pg.evaluate("""() => {
            const ci = document.getElementById('count-interface');
            if (!ci || getComputedStyle(ci).display === 'none') return null;
            return {
                fill: (document.getElementById('count-progress-fill')||{style:{}}).style.width || '',
                badge: (document.getElementById('check-progress')||{}).textContent || '',
                user: (document.getElementById('count-user-badge')||{}).textContent || '',
                name: (document.getElementById('check-item-name')||{}).textContent || '',
                loc: (document.getElementById('count-item-location')||{}).textContent || ''
            }; }""")
        pg.evaluate("() => { const b=document.getElementById('cancel-count-btn'); if(b) b.click(); }")
        pg.wait_for_timeout(300)
        back = pg.evaluate("() => getComputedStyle(document.getElementById('count-interface')).display==='none'")
        return (bool(d) and d["fill"].endswith("%") and d["badge"].startswith("Item 1 of")
                and bool(d["user"]) and bool(d["name"]) and d["loc"].startswith("\U0001F4CD") and back)
    safe("IC/count-screen-layout", count_screen)

    # validation -> branded toast (not native alert)
    def validation_toast():
        clear_modals(pg)
        pg.evaluate("() => { const b=document.getElementById('overview-add-item-btn'); if(b) b.click(); }")
        pg.wait_for_timeout(500)
        pg.evaluate("() => { const box=document.querySelector('.modal-box'); const s=[...box.querySelectorAll('button')].find(b=>b.textContent.trim()==='Save Item'); if(s) s.click(); }")
        pg.wait_for_timeout(500)
        ok = pg.evaluate("() => !!document.querySelector('.app-notification')")
        clear_modals(pg)
        return ok
    safe("IC/validation-branded-toast", validation_toast)

    # save flow (stubbed): quick-update via level bar
    def ic_save():
        clear_modals(pg)
        pg.evaluate("() => { window.__saveCalls=[]; const el=document.querySelector('.overview-table .level-bar-container'); if(el) el.click(); }")
        pg.wait_for_timeout(600)
        pg.evaluate("() => { const t=document.querySelector('.qu-tab[data-tab=\"stock\"]'); if(t) t.click(); }")
        pg.evaluate("() => { const h=document.getElementById('modal-current-level'); if(h) h.value='2'; const sv=document.getElementById('modal-save'); if(sv) sv.click(); }")
        pg.wait_for_timeout(600)
        n = pg.evaluate("() => (window.__saveCalls||[]).filter(c=>c.fn==='saveIcItem').length")
        clear_modals(pg)
        return n >= 1
    safe("IC/save-quick-update", ic_save)

    # --- Ordered / Received -------------------------------------------------
    OPEN_QU = "() => { const el=document.querySelector('.overview-table .level-bar-container'); if(el) el.click(); }"
    PANES = """() => ({
        stock: document.getElementById('qu-pane-stock').style.display !== 'none',
        order: document.getElementById('qu-pane-order').style.display !== 'none' })"""

    def pick_tab(tab):
        pg.evaluate("(t) => { const b=document.querySelector('.qu-tab[data-tab=\"'+t+'\"]'); if(b) b.click(); }", tab)
        pg.wait_for_timeout(200)

    # Exactly one intent visible at a time (stock slider vs order stepper), and the
    # chosen tab sticks across modal opens — both ways, so the assertion does not
    # depend on which tab an earlier test happened to leave selected.
    def ic_order_tab_separation():
        clear_modals(pg)
        seen = []
        for tab in ("stock", "order"):
            pg.evaluate(OPEN_QU); pg.wait_for_timeout(600)
            pick_tab(tab)
            picked = pg.evaluate(PANES)
            pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
            pg.evaluate(OPEN_QU); pg.wait_for_timeout(600)
            reopened = pg.evaluate(PANES)          # sticky
            pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
            other = "order" if tab == "stock" else "stock"
            seen.append(picked[tab] and not picked[other]
                        and reopened[tab] and not reopened[other])
        clear_modals(pg)
        return all(seen)
    safe("IC/order-tab-separation", ic_order_tab_separation)

    # The whole point of the feature: ordering records what is on the way and must
    # NOT credit the stock. A regression here silently reintroduces the phantom
    # deliveries it was built to prevent.
    def ic_order_sets_pending():
        clear_modals(pg)
        pg.evaluate("() => { window.__saveCalls=[]; const el=document.querySelector('.overview-table .level-bar-container'); if(el) el.click(); }")
        pg.wait_for_timeout(600)
        before = pg.evaluate("() => { const h=document.getElementById('modal-current-level'); return h?parseFloat(h.value):null; }")
        pick_tab("order")
        pg.evaluate("() => { const b=document.getElementById('order-plus'); if(b) b.click(); }")
        pg.wait_for_timeout(250)
        pg.evaluate("() => { const s=document.getElementById('order-save'); if(s) s.click(); }")
        pg.wait_for_timeout(700)
        saved = pg.evaluate(
            "() => { const c=[...(window.__saveCalls||[])].reverse().find(x=>x.fn==='saveIcItem');"
            " return c?{pending:c.args[0].pendingQty, level:c.args[0].currentLevel, at:!!c.args[0].pendingAt}:null; }")
        logged = pg.evaluate(
            "() => (window.__saveCalls||[]).some(c=>c.fn==='saveIcActivityLog' && c.args[0].actionType==='order')")
        clear_modals(pg)
        return (bool(saved) and saved["pending"] > 0 and saved["at"]
                and (before is None or saved["level"] == before) and logged)
    safe("IC/order-sets-pending", ic_order_sets_pending)

    # Annuler une commande doit effacer la DATE et le FOURNISSEUR, pas seulement
    # la quantite. Trouve dans la vraie base le 03/08 : un article annule gardait
    # pendingAt='...18:25' + pendingProvider='Metro', soit « commande chez Metro »
    # sur un article que personne n'a commande.
    def ic_cancel_clears_pending():
        clear_modals(pg)
        pg.evaluate("""() => { const it=(window.icItems||[])[0];
            it.pendingQty = 2; it.pendingAt = new Date().toISOString(); it.pendingProvider = 'Metro';
            const n=[...document.querySelectorAll('.nav-button')].find(b=>b.getAttribute('data-section')==='overview');
            if (n) n.click(); }""")
        pg.wait_for_timeout(500)
        pg.evaluate("() => { window.__saveCalls=[]; }")
        pg.evaluate(OPEN_QU); pg.wait_for_timeout(700)
        pick_tab("order")
        # ramene la quantite a 0 puis enregistre
        pg.evaluate("""() => { const i=document.getElementById('order-level');
            i.value = 0; i.dispatchEvent(new Event('change'));
            const s=document.getElementById('order-save'); if(s) s.click(); }""")
        pg.wait_for_timeout(700)
        saved = pg.evaluate("""() => { const c=[...(window.__saveCalls||[])].reverse()
            .find(x=>x.fn==='saveIcItem'); return c ? {
                qty: c.args[0].pendingQty, at: c.args[0].pendingAt,
                prov: c.args[0].pendingProvider, level: c.args[0].currentLevel } : null; }""")
        clear_modals(pg)
        return (bool(saved) and saved["qty"] == 0
                and saved["at"] is None and saved["prov"] is None)
    safe("IC/cancel-clears-pending-date", ic_cancel_clears_pending)

    # Seed one pending item in memory, then drive the reception screen.
    def seed_pending(qty=3):
        clear_modals(pg)
        return pg.evaluate("""(q) => {
            const it = (window.icItems||[])[0];
            if (!it) return null;
            it.pendingQty = q; it.pendingAt = new Date().toISOString(); it.pendingProvider = 'Metro';
            const n=[...document.querySelectorAll('.nav-button')].find(b=>b.getAttribute('data-section')==='overview');
            if (n) n.click();
            return { name: it.name, level: it.currentLevel };
        }""", qty)

    def open_reception():
        pg.evaluate("() => { const b=document.querySelector('.pending-banner__btn'); if(b) b.click(); }")
        pg.wait_for_timeout(600)

    def ic_pending_badge():
        seeded = seed_pending()
        pg.wait_for_timeout(500)
        badge = pg.evaluate(
            "() => { const b=document.querySelector('.overview-table .pending-badge'); return b?b.textContent.trim():''; }")
        banner = pg.evaluate("() => { const b=document.querySelector('#overview-section .pending-banner'); return !!b && b.style.display!=='none'; }")
        return bool(seeded) and "+3" in badge and banner
    safe("IC/pending-badge", ic_pending_badge)

    def ic_receive_all():
        seeded = seed_pending()
        if not seeded:
            return False
        pg.wait_for_timeout(400)
        pg.evaluate("() => { window.__saveCalls=[]; }")
        open_reception()
        pg.evaluate("() => { const b=document.getElementById('receive-all'); if(b) b.click(); }")
        pg.wait_for_timeout(800)
        saved = pg.evaluate("""() => {
            const c=(window.__saveCalls||[]).find(x=>x.fn==='updatePaths');
            if(!c) return null;
            const u=c.args[0]||{};
            const itemKey=Object.keys(u).find(k=>k.indexOf('icItems/')===0);
            const it=itemKey?u[itemKey]:null;
            return it?{level:it.currentLevel, pending:it.pendingQty,
                       claims:Object.keys(u).filter(k=>k.indexOf('deliveryIssues/')===0).length}:null; }""")
        logged = pg.evaluate(
            "() => (window.__saveCalls||[]).some(c=>c.fn==='saveIcActivityLog' && c.args[0].actionType==='receive')")
        clear_modals(pg)
        return (bool(saved) and saved["pending"] == 0
                and saved["level"] == seeded["level"] + 3 and logged and saved["claims"] == 0)
    safe("IC/receive-all", ic_receive_all)

    # Short delivery: one tap on "−" leaves 1 missing -> claim entry + not-delivered log.
    def ic_receive_partial():
        seeded = seed_pending()
        if not seeded:
            return False
        pg.wait_for_timeout(400)
        pg.evaluate("() => { window.__saveCalls=[]; }")
        open_reception()
        pg.evaluate("() => { const m=document.querySelector('.receive-step[data-d=\"-1\"]'); if(m) m.click(); }")
        pg.wait_for_timeout(300)
        pg.evaluate("() => { const b=document.getElementById('receive-all'); if(b) b.click(); }")
        pg.wait_for_timeout(800)
        # Le litige DOIT voyager dans la MEME ecriture que le stock : un avoir
        # fournisseur perdu pendant que le stock dit "livre" ne se retrouve jamais.
        d = pg.evaluate("""() => {
            const c=(window.__saveCalls||[]).find(x=>x.fn==='updatePaths');
            if(!c) return null;
            const u=c.args[0]||{};
            const ik=Object.keys(u).find(k=>k.indexOf('icItems/')===0);
            const ck=Object.keys(u).find(k=>k.indexOf('deliveryIssues/')===0);
            if(!ik||!ck) return {atomic:false};
            const i=u[ck];
            return {atomic:true, level:u[ik].currentLevel, missing:i.missingQty,
                    ordered:i.orderedQty, received:i.receivedQty, id:!!i.id}; }""")
        nd = pg.evaluate(
            "() => (window.__saveCalls||[]).some(c=>c.fn==='saveIcActivityLog' && c.args[0].actionType==='not-delivered')")
        clear_modals(pg)
        return (bool(d) and d.get("atomic") and d["missing"] == 1 and d["ordered"] == 3
                and d["received"] == 2 and d["id"] and nd
                and d["level"] == seeded["level"] + 2)
    safe("IC/receive-partial-creates-issue", ic_receive_partial)

    # Bloc L — le manquant se calcule NET de ce qui est deja en route. Sans ca le
    # dashboard affichait "10 to order" sur un article dont 3 arrivaient, et la meme
    # livraison etait commandee deux fois.
    def ic_shortfall_nets_pending():
        d = pg.evaluate("""() => {
            const f = window.__icShortfall;
            if (typeof f !== 'function') return null;
            return {
                noPending: f({currentLevel: 0, targetLevel: 10}),
                withPending: f({currentLevel: 0, targetLevel: 10, pendingQty: 3}),
                covered: f({currentLevel: 2, targetLevel: 10, pendingQty: 8}),
                never_negative: f({currentLevel: 5, targetLevel: 2, pendingQty: 4})
            }; }""")
        return (bool(d) and d["noPending"] == 10 and d["withPending"] == 7
                and d["covered"] == 0 and d["never_negative"] == 0)
    safe("IC/shortfall-nets-pending", ic_shortfall_nets_pending)

    # Rejouer une reception (2 ecrans portent la banniere, la tablette peut dormir)
    # ne doit rien reecrire : sinon second litige et commande fraiche ecrasee.
    def ic_receive_replay_blocked():
        seeded = seed_pending()
        if not seeded:
            return False
        pg.wait_for_timeout(400)
        open_reception()
        # Un AUTRE terminal enregistre la livraison pendant que ce modal reste ouvert :
        # en memoire le pending retombe a 0, mais le brouillon affiche encore 3.
        pg.evaluate("""() => {
            const it=(window.icItems||[]).find(i=>(parseFloat(i.pendingQty)||0)>0);
            if(it){ it.pendingQty=0; it.pendingAt=null; it.pendingProvider=null; }
        }""")
        pg.evaluate("() => { window.__saveCalls=[]; }")
        clicked = pg.evaluate("""() => {
            const b=document.getElementById('receive-all');
            if (!b) return false;
            b.click();
            return true; }""")
        pg.wait_for_timeout(700)
        wrote = pg.evaluate("() => (window.__saveCalls||[]).some(c=>c.fn==='updatePaths')")
        clear_modals(pg)
        # Le bouton devait exister (sinon le test ne prouve rien) ET rien ne doit partir.
        return bool(clicked) and not wrote
    safe("IC/receive-replay-blocked", ic_receive_replay_blocked)

    # Unites deja plurielles en base ("sauce bottles", "units") : ne pas re-pluraliser.
    def ic_pluralize_plural_units():
        d = pg.evaluate("""() => ({
            bottles: pluralizeUnit('bottles', 3),
            units: pluralizeUnit('units', 2),
            bag: pluralizeUnit('bag', 3),
            box: pluralizeUnit('box', 2),
            one: pluralizeUnit('bag', 1),
            kg: pluralizeUnit('kg', 5)
        })""")
        return (bool(d) and d["bottles"] == "bottles" and d["units"] == "units"
                and d["bag"] == "bags" and d["box"] == "boxes"
                and d["one"] == "bag" and d["kg"] == "kg")
    safe("shared/pluralize-keeps-plural-units", ic_pluralize_plural_units)

    # The claims card is the readable side of deliveryIssues: without it the
    # missing quantities pile up in the database and nobody ever sees them.
    def ic_claims_card():
        seeded = seed_pending()
        if not seeded:
            return False
        pg.wait_for_timeout(400)
        pg.evaluate("""() => { window.__fakeClaims = [{id:'issue_test', itemId:1, itemName:'Mayonnaise',
            unit:'bottle', provider:'Metro', orderedQty:3, receivedQty:0, missingQty:3,
            reportedAt:new Date().toISOString(), resolved:false}]; }""")
        open_reception()
        pg.evaluate("() => { const m=document.querySelector('.receive-step[data-d=\"-1\"]'); if(m) m.click(); }")
        pg.wait_for_timeout(250)
        pg.evaluate("() => { const b=document.getElementById('receive-all'); if(b) b.click(); }")
        pg.wait_for_timeout(900)
        card = pg.evaluate("""() => { const c=document.getElementById('claims-card');
            return c ? {shown: c.style.display!=='none', text: c.textContent} : null; }""")
        settled = pg.evaluate("""() => { const b=document.querySelector('.claim-row__settle'); if(!b) return false;
            b.click(); return true; }""")
        pg.wait_for_timeout(500)
        gone = pg.evaluate("() => { const c=document.getElementById('claims-card'); return !c || c.style.display==='none'; }")
        pg.evaluate("() => { window.__fakeClaims = []; }")
        clear_modals(pg)
        return (bool(card) and card["shown"] and "Mayonnaise" in card["text"]
                and "1 open claim" in card["text"] and settled and gone)
    safe("IC/claims-card-and-settle", ic_claims_card)

    # A purchase is a whole number of packages. Shelf stock can be 0.8 bag; an
    # order of 0.8 bag cannot exist, and stepping from it used to yield 0.7.
    def ic_order_whole_units():
        clear_modals(pg)
        pg.evaluate("""() => { (window.icItems||[]).forEach(it => {
            it.currentLevel = 0.8; it.targetLevel = 2; it.pendingQty = 0; });
            const n=[...document.querySelectorAll('.nav-button')].find(b=>b.getAttribute('data-section')==='overview');
            if (n) n.click(); }""")
        pg.wait_for_timeout(500)
        pg.evaluate(OPEN_QU); pg.wait_for_timeout(700)
        pick_tab("order")
        # Read the RAW slider value too, not just the label: the label is rounded
        # for display, so checking it alone would pass over a slider quietly
        # running on a 0.5 scale (what a stale cached slider.js produced).
        read = """() => ({ qty: document.getElementById('order-qty').textContent.trim(),
                           raw: document.getElementById('order-level').value,
                           ticks: [...document.querySelectorAll('#order-ticks .tick-label')].map(t=>t.textContent),
                           status: document.getElementById('order-status').textContent.trim(),
                           cls: document.getElementById('order-status').className,
                           slider: !!document.querySelector('#qu-pane-order .slider-handle') })"""
        start = pg.evaluate(read)
        pg.evaluate("() => { const b=document.getElementById('order-plus'); if(b) b.click(); }")
        pg.wait_for_timeout(250)
        up = pg.evaluate(read)
        pg.evaluate("() => { const b=document.getElementById('order-minus'); if(b) b.click(); const c=document.getElementById('order-minus'); if(c) c.click(); }")
        pg.wait_for_timeout(300)
        down = pg.evaluate(read)
        clear_modals(pg)
        whole = lambda s: str(s).isdigit()
        steps = [start, up, down]
        # every tick is labelled with a consecutive whole number: 0,1,2,...
        ticks_ok = start["ticks"] == [str(i) for i in range(len(start["ticks"]))] and len(start["ticks"]) > 2
        return (start["slider"] and ticks_ok
                and all(whole(s["qty"]) and whole(s["raw"]) for s in steps)
                and int(up["qty"]) == int(start["qty"]) + 1
                and int(down["qty"]) == int(start["qty"]) - 1
                and "order-status--over" in up["cls"]
                and "order-status--under" in down["cls"]
                and up["status"] == "OVER TARGET" and down["status"] == "UNDER TARGET")
    safe("IC/order-whole-units-and-status", ic_order_whole_units)

    # The count card is a sibling of the sections: navigating away mid-count used
    # to strand it at the bottom of History.
    def ic_count_hidden_on_nav():
        clear_modals(pg)
        pg.evaluate("() => document.getElementById('start-count-btn').click()")
        pg.wait_for_timeout(700)
        during = pg.evaluate("() => getComputedStyle(document.getElementById('count-interface')).display")
        pg.evaluate("() => { const n=[...document.querySelectorAll('.nav-button')].find(b=>b.getAttribute('data-section')==='history'); if(n) n.click(); }")
        pg.wait_for_timeout(600)
        after = pg.evaluate("() => getComputedStyle(document.getElementById('count-interface')).display")
        pg.evaluate("() => { const n=[...document.querySelectorAll('.nav-button')].find(b=>b.getAttribute('data-section')==='dashboard'); if(n) n.click(); }")
        pg.wait_for_timeout(500)
        back = pg.evaluate("() => getComputedStyle(document.getElementById('dashboard-section')).display")
        return during != "none" and after == "none" and back != "none"
    safe("IC/count-hidden-on-nav", ic_count_hidden_on_nav)

    # The I&C history page must render an order through the shared wording, not
    # fall through to "modified" with a stock arrow (what Serge saw on 03/08).
    def ic_history_order_line():
        clear_modals(pg)
        pg.evaluate("""() => { const n=[...document.querySelectorAll('.nav-button')]
            .find(b=>b.getAttribute('data-section')==='history'); if(n) n.click(); }""")
        pg.wait_for_timeout(900)
        ok = pg.evaluate("""() => {
            if (typeof describeLog !== 'function') return null;
            const d = describeLog({actionType:'order', oldValue:0, newValue:1, unit:'bag', stock:4});
            return d && d.label === 'ordered' && d.change.indexOf('\\u2192') === -1; }""")
        return ok is True
    safe("IC/history-order-not-modified", ic_history_order_line)

    rec("IC/no-native-dialogs", len(dialogs) == 0, str(dialogs))
    rec("IC/0-console-errors", len(errs) == 0, (str(errs[:3]) if errs else ""))
    pg.close()


def run_db(browser):
    errs, dialogs = [], []
    pg = make_page(browser, errs, dialogs)
    pg.goto(BASE + "/db-editor.html", wait_until="networkidle")
    pg.wait_for_timeout(1600)
    safe("DB/byDisplayOrder-loaded", lambda: pg.evaluate("() => typeof window.byDisplayOrder==='function'"))
    safe("DB/formatCheckDate-delegates", lambda: (lambda v: isinstance(v, str) and "ERR" not in v)(
        pg.evaluate("() => { try { return formatCheckDate('2025-03-09T14:30:00'); } catch(e){ return 'ERR'; } }")))

    # team broadcast: "Send" crée un message (stubbé) avec le texte + un id
    pg.evaluate(STUB)
    def db_send():
        pg.evaluate("""() => { window.__saveCalls=[]; const i=document.getElementById('team-message-input');
            i.value='Test broadcast'; document.getElementById('team-message-send').click(); }""")
        pg.wait_for_timeout(200)
        d = pg.evaluate("() => { const c=(window.__saveCalls||[]).find(x=>x.fn==='saveTeamMessage'); return c?{text:c.args[0].text,hasId:!!c.args[0].id}:null; }")
        return bool(d) and d["text"] == "Test broadcast" and d["hasId"]
    safe("DB/team-message-send", db_send)

    # --- Bloc J : editer depuis le DB Editor ne doit JAMAIS toucher aux champs que ce
    # formulaire ne connait pas. Avant le correctif, l'objet etait reconstruit puis
    # set() : canPrep / cantPrep* et pendingQty disparaissaient de la base sans un mot.
    def db_prep_edit_patch():
        d = pg.evaluate("""() => {
            const it = prepItems[0];
            if (!it) return null;
            window.__saveCalls = [];
            showEditForm(it.id);
            const t = document.getElementById('item-target');
            t.value = String((parseFloat(t.value) || 0) + 1);
            saveItem();
            const c = (window.__saveCalls || []).find(x => x.fn === 'saveItemFields');
            if (!c) return { fn: (window.__saveCalls[0] || {}).fn || 'none' };
            return { fn: 'saveItemFields', keys: Object.keys(c.args[1]).sort(), id: c.args[0] };
        }""")
        if not d or d.get("fn") != "saveItemFields":
            return False
        forbidden = {"canPrep", "updateType", "cantPrepBy", "cantPrepReason",
                     "cantPrepTime", "currentLevel", "lastCheckedTime", "lastCheckedBy"}
        return not (forbidden & set(d["keys"])) and "targetLevel" in d["keys"]
    safe("DB/prep-edit-sends-patch-only", db_prep_edit_patch)

    # Le stock n'est envoye QUE s'il a ete tape : le formulaire est une photo prise a
    # l'ouverture, le renvoyer tel quel annulerait un comptage fait sur la tablette.
    def db_prep_stock_touched():
        d = pg.evaluate("""() => {
            const it = prepItems[0];
            if (!it) return null;
            window.__saveCalls = [];
            showEditForm(it.id);
            const c = document.getElementById('item-current');
            c.value = String((parseFloat(c.value) || 0) + 3);
            c.dispatchEvent(new Event('input', { bubbles: true }));
            saveItem();
            const call = (window.__saveCalls || []).find(x => x.fn === 'saveItemFields');
            return call ? { sent: call.args[1].currentLevel } : null;
        }""")
        return bool(d) and d["sent"] is not None
    safe("DB/prep-edit-sends-touched-stock", db_prep_stock_touched)

    def db_ic_edit_keeps_pending():
        d = pg.evaluate("""() => {
            const it = icItems[0];
            if (!it) return null;
            window.__saveCalls = [];
            showEditIcForm(it.id);
            const t = document.getElementById('ic-target');
            t.value = String((parseFloat(t.value) || 0) + 1);
            saveIcItem();
            const c = (window.__saveCalls || []).find(x => x.fn === 'saveIcItemFields');
            if (!c) return { fn: (window.__saveCalls[0] || {}).fn || 'none' };
            return { fn: 'saveIcItemFields', keys: Object.keys(c.args[1]).sort() };
        }""")
        if not d or d.get("fn") != "saveIcItemFields":
            return False
        forbidden = {"pendingQty", "pendingAt", "pendingProvider", "sublocation",
                     "currentLevel", "lastCheckedTime", "lastCheckedBy"}
        return not (forbidden & set(d["keys"])) and "targetLevel" in d["keys"]
    safe("DB/ic-edit-preserves-pending", db_ic_edit_keeps_pending)

    rec("DB/0-console-errors", len(errs) == 0, (str(errs[:3]) if errs else ""))
    pg.close()


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            run_pm(browser)
            run_ic(browser)
            run_db(browser)
        finally:
            browser.close()

    print("\n=== Sezam Prep Manager - smoke test ===")
    passed = sum(1 for _, ok, _ in results if ok)
    for tid, ok, detail in results:
        line = "  " + ("PASS" if ok else "FAIL") + "  " + tid.ljust(32)
        if detail:
            line += " " + detail
        print(line)
    print("\n" + str(passed) + "/" + str(len(results)) + " passed")
    sys.exit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    main()
