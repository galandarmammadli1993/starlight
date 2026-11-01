"""Real-browser checks for explicit pass calls and articulated human presentation.

Run with the dev server: python tests/offball_browser.py
The development hook only arranges positions; actions use the actual DOM/keys.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE_URL = os.environ.get("GAME_URL", "http://127.0.0.1:4321/starlight/")
CHROMIUM_PATH = os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium")
ARTIFACTS = Path(__file__).resolve().parents[2] / "scratch"
ARTIFACTS.mkdir(parents=True, exist_ok=True)
checks, errors = [], []


def passed(name):
    checks.append(name)
    print(f"PASS {name}", flush=True)


def ready(page):
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    response = page.goto(BASE_URL, wait_until="networkidle")
    assert response.status == 200
    page.wait_for_function("!!window.__football && window.__football.renderer.playerModels.size===22")


def start_player(page):
    page.locator('[data-mode="player"]').click()
    page.locator("#career-play").click()
    page.wait_for_function("window.__football.engine.state==='IN_PLAY'")
    page.locator("#pitch").focus()


def arrange_call(page, situation="open"):
    return page.evaluate("""situation => {
      const e=window.__football.engine;
      e.state='IN_PLAY';e.previousState=null;e.restart=null;e.pendingRestart=null;
      e.restartOrigin=null;e.offside=null;e.keeperHold=null;e.accumulator=0;
      e.penaltyInProgress=false;e.deferredClockEvent=null;e.passRequest=null;
      e.passCall=null;e.lastPassCallAt=-Infinity;e.kickCooldown=0;e.selectedTarget=null;
      e.players.forEach(p=>{p.vx=p.vy=0;p.timer=20;p.sentOff=false;p.substituted=false;
        p.x=p.team===0?8+(p.id%3)*2:78+(p.id%5);p.y=4+(p.id%10)*6;
      });
      const receiver=e.controlledPlayer;
      receiver.x=situation==='offside'?88:situation==='blocked'?60:45;receiver.y=34;receiver.faceX=1;receiver.faceY=0;
      // A deep goalkeeper distribution leaves time for real browser input before pressure closes the gap.
      const owner=e.players[0];
      owner.x=situation==='offside'?60:15;owner.y=34;
      owner.faceX=1;owner.faceY=0;owner.timer=20;
      e.players[11].x=102;e.players[11].y=34;
      if(situation==='blocked'){e.players[11].x=38;e.players[11].y=34;}
      if(situation==='offside')e.players.filter(p=>p.team===1&&p.role!=='GK').forEach(p=>p.x=75);
      Object.assign(e.ball,{x:owner.x+.45,y:34,z:.11,vx:0,vy:0,vz:0,owner:owner.id,lastTouch:{team:0,playerId:owner.id}});
      window.__offballFixture={receiver:receiver.id,owner:owner.id,startX:e.ball.x,startY:e.ball.y};
      window.__qaCallPhases=[];window.__qaCallTitles=[];
      if(!window.__qaCallMonitor){
        window.__qaCallMonitor=setInterval(()=>{const e=window.__football.engine,s=e.getPassCallStatus();
          const last=window.__qaCallPhases.at(-1),model=window.__football.renderer.playerModels.get(e.controlled);
          const raised=(model?.limbs.find(l=>l.side===1)?.shoulder.rotation.x??0)>2;
          if(!last||last.status!==s.status||last.raised!==raised){const p=e.controlledPlayer;window.__qaCallPhases.push({status:s.status,reason:s.reason,owner:e.ball.owner,raised,speed:Math.hypot(e.ball.vx,e.ball.vy),distance:Math.hypot(e.ball.x-p.x,e.ball.y-p.y)});}
        },16);
        new MutationObserver(()=>window.__qaCallTitles.push(document.querySelector('#offball-title').textContent))
          .observe(document.querySelector('#offball-title'),{childList:true,characterData:true,subtree:true});
      }
      return window.__offballFixture;
    }""", situation)


def status(page):
    return page.evaluate("window.__football.engine.getPassCallStatus()")


def one_ball(page):
    return page.evaluate("""()=>{const r=window.__football.renderer,found=[];
      r.scene.traverse(o=>{if(o.userData.kind==='match-ball')found.push(o);});
      return found.length===1&&found[0]===r.ballMesh; }""")


with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=CHROMIUM_PATH, headless=True,
        args=["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader"])
    desktop=browser.new_context(viewport={"width":1440,"height":1100}, reduced_motion="reduce")
    page=desktop.new_page()
    mobile=None
    try:
        ready(page)
        start_player(page)
        assert page.locator("#pitch").get_attribute("data-renderer")=="threejs-sideview"
        assert page.evaluate("[...window.__football.renderer.playerModels.values()].every(m=>m.group.userData.kind==='articulated-footballer'&&m.limbs.every(l=>l.knee&&l.elbow))")
        assert one_ball(page)
        passed("Player match uses articulated human figures with knees/elbows and one authoritative ball")

        fixture=arrange_call(page)
        expect(page.locator("#call-ball-button")).to_be_enabled()
        page.locator("#pitch").focus()
        page.keyboard.press("r")
        assert status(page)["status"] in ["waiting","passed"], status(page)
        expect(page.locator("#call-ball-button")).to_be_disabled()
        page.wait_for_function("window.__qaCallPhases.some(p=>p.status==='passed')")
        transit=page.evaluate("window.__qaCallPhases.find(p=>p.status==='passed')")
        assert transit["owner"] is None and transit["speed"]>5 and transit["distance"]>1,transit
        page.wait_for_function("window.__qaCallTitles.includes('ÖTÜRMƏ SƏNƏ GƏLİR')")
        page.wait_for_function("window.__football.engine.ball.owner===window.__offballFixture.receiver")
        page.wait_for_function("window.__qaCallTitles.includes('TOPU ALDIN')")
        expect(page.locator("#call-ball-button")).to_be_disabled()
        assert one_ball(page)
        passed("R sends an explicit request; UI disables duplicate calls, shows passing and actual physical receipt")

        arrange_call(page,"blocked")
        expect(page.locator("#call-ball-button")).to_be_enabled()
        page.locator("#call-ball-button").click()
        page.screenshot(path=str(ARTIFACTS/"offball-blocked.png"), full_page=True)
        page.wait_for_function("window.__qaCallTitles.includes('ÖTÜRMƏ YOLU BAĞLIDIR')")
        page.wait_for_function("window.__qaCallPhases.some(p=>p.status==='blocked'&&p.reason==='lane'&&p.owner===window.__offballFixture.owner&&p.raised)")
        # Start a fresh live request after screenshot capture; captures may span several real seconds.
        page.locator("#pitch").focus()
        arrange_call(page,"blocked")
        page.keyboard.press("r")
        page.keyboard.down("w")
        page.wait_for_function("window.__football.engine.controlledPlayer.y<29")
        page.keyboard.up("w")
        page.wait_for_function("window.__qaCallPhases.some(p=>p.status==='passed')")
        passed("Blocked-lane feedback and raised hand are visible; moving into space opens the physical pass")

        arrange_call(page,"offside")
        expect(page.locator("#call-ball-button")).to_be_enabled()
        page.locator("#call-ball-button").click()
        page.wait_for_function("window.__qaCallTitles.includes('OFSAYDDAN ÇIX')")
        page.wait_for_function("window.__qaCallPhases.some(p=>p.status==='blocked'&&p.reason==='offside'&&p.owner===window.__offballFixture.owner)")
        passed("Offside request is explained and never forces an illegal pass")

        arrange_call(page)
        page.evaluate("""()=>{const e=window.__football.engine,p=e.players[17];p.x=35;p.y=34;
          Object.assign(e.ball,{owner:p.id,x:35.45,y:34,lastTouch:{team:1,playerId:p.id}});} """)
        expect(page.locator("#offball-title")).to_have_text("TOP RƏQİBDƏDİR")
        expect(page.locator("#call-ball-button")).to_be_disabled()
        page.evaluate("""()=>{const e=window.__football.engine;Object.assign(e.ball,{owner:null,x:52,y:45,vx:0,vy:0,lastTouch:{team:1,playerId:17}});} """)
        expect(page.locator("#offball-title")).to_have_text("TOP SƏRBƏSTDİR")
        expect(page.locator("#call-ball-button")).to_be_disabled()
        passed("Opponent possession and a loose ball each give clear instructions with unavailable call disabled")

        arrange_call(page)
        camera=page.evaluate("window.__football.engine.cameraMode")
        page.locator("#camera-toggle").click()
        assert page.evaluate("window.__football.engine.cameraMode")!=camera
        page.locator("#camera-toggle").click()
        assert page.evaluate("window.__football.engine.cameraMode")==camera
        assert one_ball(page)
        page.screenshot(path=str(ARTIFACTS/"offball-desktop.png"),full_page=True)
        passed("Close/broadcast view toggle changes camera mode without duplicating the match ball")

        page.locator("#menu-button").click()
        page.locator('[data-mode="quick"]').click()
        page.locator("#kickoff-button").click()
        page.wait_for_function("window.__football.engine.state==='IN_PLAY'")
        arrange_call(page)
        page.locator("#pitch").focus();page.keyboard.press("r")
        assert status(page)["status"] in ["waiting","passed"], status(page)
        passed("Explicit R request also works in quick-match control")

        page.locator("#menu-button").click()
        page.locator('[data-mode="manager"]').click()
        page.locator("#career-play").click()
        expect(page.locator("#offball-panel")).to_be_hidden()
        assert page.evaluate("window.__football.engine.action('call')") is False
        passed("Manager has no player pass-call UI or direct request action")

        mobile=browser.new_context(viewport={"width":390,"height":844},device_scale_factor=1,
            is_mobile=True,has_touch=True,reduced_motion="reduce")
        phone=mobile.new_page();ready(phone);start_player(phone)
        arrange_call(phone,"blocked")
        expect(phone.locator("#call-ball-button")).to_be_enabled()
        button=phone.locator("#call-ball-button")
        box=button.bounding_box();assert box["height"]>=44 and box["width"]>=44
        assert phone.evaluate("document.documentElement.scrollWidth<=window.innerWidth+1")
        button.tap()
        expect(phone.locator("#offball-title")).to_have_text("ÖTÜRMƏ YOLU BAĞLIDIR")
        expect(button).to_be_disabled()
        phone.screenshot(path=str(ARTIFACTS/"offball-mobile.png"),full_page=True)
        assert one_ball(phone)
        passed("390px touch UI has a readable tappable 44px+ call button, correct feedback and no overflow")

        assert not errors,errors
        passed("No browser console errors or uncaught runtime exceptions")
        print(f"PASS all {len(checks)} off-ball browser checks",flush=True)
    finally:
        if mobile:mobile.close()
        desktop.close();browser.close()
