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
  ['saveItem','saveAllItems','saveIcItem','saveAllIcItems','saveIcActivityLog',
   'deleteIcItem','saveTask','saveAllStaffMembers','deleteIcActivityLogs',
   'saveActivityLog'].forEach(function (fn) {
    if (typeof db[fn] === 'function') db[fn] = function () { rec(fn, [].slice.call(arguments)); return Promise.resolve(); };
  });
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

    def count_staff():
        clear_modals(pg)
        pg.evaluate("() => UserSession.clear()")
        pg.evaluate("() => document.getElementById('start-count-btn').click()")
        pg.wait_for_timeout(900)
        ok = mcount(pg) >= 1 and pg.evaluate("() => document.querySelectorAll('.modal-box button').length") > 1
        pg.mouse.click(6, 6); pg.wait_for_timeout(300)
        ok = ok and mcount(pg) == 0
        pg.evaluate("() => UserSession.set('Serge M', {toast:false})")
        return ok
    safe("IC/modal-count-staff", count_staff)

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
        pg.evaluate("() => { const h=document.getElementById('modal-current-level'); if(h) h.value='2'; const sv=document.getElementById('modal-save'); if(sv) sv.click(); }")
        pg.wait_for_timeout(600)
        n = pg.evaluate("() => (window.__saveCalls||[]).filter(c=>c.fn==='saveIcItem').length")
        clear_modals(pg)
        return n >= 1
    safe("IC/save-quick-update", ic_save)

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
