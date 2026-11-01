"""Real Chromium smoke checks for the development app (no production debug hook).

Run against `npm run dev -- --host 0.0.0.0 --port 4321`:
  python tests/browser_smoke.py
Playwright's Python package and /usr/bin/chromium must be available.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE_URL = os.environ.get("GAME_URL", os.environ.get("FOOTBALL_TEST_URL", "http://127.0.0.1:4321"))
CHROMIUM_PATH = os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium")
ARTIFACTS = Path(__file__).resolve().parents[2] / "scratch"
ARTIFACTS.mkdir(parents=True, exist_ok=True)
checks = []
errors = []


def passed(name):
    checks.append(name)
    print(f"PASS {name}", flush=True)


def attach_errors(page):
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)


def ready(page):
    page.goto(BASE_URL)
    page.wait_for_function("!!window.__football && !!window.__football.engine")
    expect(page).to_have_title("Footba11 Heroes — Make the game yours.")


def arrange_owner(page, x=40, y=34):
    """Arrange ball possession, without replacing any real input/action handler."""
    return page.evaluate("""({x,y}) => {
      const e=window.__football.engine;
      e.state='IN_PLAY';e.restart=null;e.restartOrigin=null;e.offside=null;
      e.kickCooldown=0;e.keeperHold=null;e.accumulator=0;
      const p=e.controlledPlayer;
      e.players.forEach(q=>{q.vx=q.vy=0;q.timer=20;if(q.team===1){q.x=90+q.id%5;q.y=4+(q.id%6)*10;}});
      p.x=x;p.y=y;p.faceX=e.directions[0];p.faceY=0;
      Object.assign(e.ball,{x:x+.45*e.directions[0],y,z:.11,vx:0,vy:0,vz:0,owner:p.id,lastTouch:{team:0,playerId:p.id}});
      return p.id;
    }""", {"x": x, "y": y})


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=CHROMIUM_PATH, headless=True,
                                         args=["--no-sandbox", "--disable-dev-shm-usage"])
    desktop = browser.new_context(viewport={"width": 1440, "height": 1100}, reduced_motion="reduce")
    page = desktop.new_page()
    attach_errors(page)
    try:
        ready(page)
        page.screenshot(path=str(ARTIFACTS / "football-menu-desktop.png"), full_page=True)
        page.locator("#kickoff-button").click()
        page.wait_for_function("document.body.classList.contains('playing') && window.__football.engine.state==='IN_PLAY'")
        assert page.evaluate("window.__football.engine.players.length") == 22
        passed("Quick match kick-off starts 22-player match")
        page.wait_for_timeout(900)
        page.locator("#pitch-wrap").scroll_into_view_if_needed()
        page.screenshot(path=str(ARTIFACTS / "football-match-desktop.png"), full_page=True)

        page.locator("#pitch").focus()
        page.keyboard.press("Tab")
        assert page.evaluate("window.__football.engine.selectedTarget!==null && document.activeElement.id==='pitch'")
        page.keyboard.press("Shift+Tab")
        assert page.evaluate("document.activeElement.id!=='pitch'")
        page.locator("#pause-button").focus()
        page.keyboard.press("Tab")
        assert page.evaluate("document.activeElement.id==='fullscreen-button'")
        page.locator("#pitch").focus()
        passed("Pitch Tab selects a receiver, Shift+Tab escapes, and toolbar keyboard focus moves normally")

        arrange_owner(page)
        start_x = page.evaluate("window.__football.engine.controlledPlayer.x")
        page.keyboard.down("d")
        page.wait_for_timeout(400)
        page.keyboard.up("d")
        assert page.evaluate("window.__football.engine.controlledPlayer.x") > start_x + .5
        passed("Keyboard movement changes actual player position")

        arrange_owner(page)
        receiver_point = page.evaluate("""() => {
          const {engine:e,renderer:r}=window.__football;
          const p=e.players.find(p=>p.team===0&&p.id!==e.controlled&&p.role==='MID');
          p.x=59;p.y=42;p.vx=p.vy=0;
          const rect=r.canvas.getBoundingClientRect();
          return {id:p.id,x:rect.left+r.offsetX+p.x*r.scale,y:rect.top+r.offsetY+p.y*r.scale};
        }""")
        page.mouse.click(receiver_point["x"], receiver_point["y"])
        assert page.evaluate("window.__football.engine.selectedTarget") == receiver_point["id"]
        passes = page.evaluate("window.__football.engine.stats.passes[0]")
        page.keyboard.press("j", delay=80)
        assert page.evaluate("window.__football.engine.stats.passes[0]") == passes + 1
        assert page.evaluate("Math.hypot(window.__football.engine.ball.vx,window.__football.engine.ball.vy)") > 5
        passed("Click receiver and keyboard pass launch independent moving ball")

        arrange_owner(page, 78, 11)
        shots = page.evaluate("window.__football.engine.stats.shots[0]")
        page.keyboard.press("k", delay=80)
        assert page.evaluate("window.__football.engine.stats.shots[0]") == shots + 1
        low_speed = page.evaluate("Math.hypot(window.__football.engine.ball.vx,window.__football.engine.ball.vy)")
        passed("Wide-angle shooting dispatches a physical shot")
        arrange_owner(page, 40, 34)
        page.keyboard.down("k")
        page.wait_for_timeout(900)
        page.keyboard.up("k")
        high_speed = page.evaluate("Math.hypot(window.__football.engine.ball.vx,window.__football.engine.ball.vy)")
        assert high_speed > low_speed + 4
        passed("Holding the shoot key increases actual shot velocity")

        page.locator("#pause-button").click()
        page.wait_for_function("window.__football.engine.state==='PAUSED'")
        elapsed = page.evaluate("window.__football.engine.clock.elapsed")
        page.wait_for_timeout(650)
        assert page.evaluate("window.__football.engine.clock.elapsed") == elapsed
        page.locator("#pause-button").click()
        page.wait_for_function("window.__football.engine.state!=='PAUSED'")
        page.wait_for_timeout(250)
        assert page.evaluate("window.__football.engine.clock.elapsed") > elapsed
        passed("Pause freezes authoritative clock; resume advances it once")

        page.locator("#menu-button").click()
        page.locator("#edit-profile").click()
        page.locator("#player-name").fill("QA Defender")
        page.locator("#player-role").select_option("DEF")
        page.locator("#half-minutes").select_option("5")
        page.locator("#shirt-number").fill("10")
        page.locator("#kit-color").select_option("blue")
        page.locator("#settings-form button[type=submit]").click()
        page.locator('[data-mode="player"]').click()
        page.locator("#kickoff-button").click()
        role = page.evaluate("window.__football.engine.controlledPlayer.role")
        assert role == "DEF"
        assert page.evaluate("window.__football.engine.controlledPlayer.name") == "QA Defender"
        assert page.evaluate("window.__football.engine.clock.halfMinutes") == 5
        assert page.evaluate("window.__football.engine.kitColor") == "blue"
        assert page.evaluate("window.__football.engine.controlledPlayer.number") == 10
        assert page.evaluate("new Set(window.__football.engine.players.filter(p=>p.team===0).map(p=>p.number)).size") == 11
        controlled = page.evaluate("window.__football.engine.controlled")
        page.keyboard.press("q")
        assert page.evaluate("window.__football.engine.controlled") == controlled
        passed("Saved DEF career profile, kit, shirt and half length configure player mode; switch stays locked")

        # Main-menu save and a fresh page load must preserve an unfinished career.
        page.evaluate("""()=>{const e=window.__football.engine;e.score=[2,1];e.clock.elapsed=317.25;e.pause();}""")
        page.locator("#menu-button").click()
        assert page.evaluate("window.__football.save.suspended.score[0]") == 2
        page.reload()
        page.wait_for_function("!!window.__football")
        expect(page.locator("#kickoff-button")).to_contain_text("RESUME MATCH")
        page.locator("#kickoff-button").click()
        assert page.evaluate("window.__football.engine.options.mode") == "player"
        assert page.evaluate("window.__football.engine.score") == [2, 1]
        assert 317.25 <= page.evaluate("window.__football.engine.clock.elapsed") < 322
        assert page.evaluate("window.__football.engine.controlledPlayer.role") == "DEF"
        assert page.evaluate("window.__football.save.career.played") == 0
        passed("Main menu plus reload restores suspended career score, clock and chosen role without recording a result")

        # Reach full time through the real engine clock, then ensure RAF/menu cannot duplicate it.
        page.evaluate("""()=>{
          const e=window.__football.engine;e.state='IN_PLAY';e.restart=null;
          Object.assign(e.clock,{half:2,elapsed:2699.99,stoppedSeconds:0,addedSeconds:0,halfEnded:false,finished:false});
        }""")
        page.wait_for_function("window.__football.engine.state==='FULL_TIME'")
        page.wait_for_function("window.__football.save.career.played===1")
        page.wait_for_timeout(450)
        assert page.evaluate("window.__football.save.career.played") == 1
        page.locator("#menu-button").click()
        assert page.evaluate("window.__football.save.career.played") == 1
        assert page.evaluate("window.__football.save.career.won") == 1
        passed("Career full-time result commits exactly once through engine, render loop and main menu")

        page.locator('[data-mode="manager"]').click()
        page.locator("#kickoff-button").click()
        page.locator("#formation").select_option("3-5-2")
        page.locator("#tactic").select_option("wide")
        assert page.evaluate("window.__football.engine.options.mode") == "manager"
        assert page.evaluate("window.__football.engine.formation") == "3-5-2"
        assert page.evaluate("window.__football.engine.tactic") == "wide"
        assert page.evaluate("window.__football.engine.players.filter(p=>p.team===0&&p.role==='MID').length") == 5
        passed("Manager controls change real team formation, roles and tactical mode")

        mobile = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                                     is_mobile=True, has_touch=True, reduced_motion="reduce")
        m = mobile.new_page()
        attach_errors(m)
        ready(m)
        m.locator("#kickoff-button").tap()
        m.wait_for_function("window.__football.engine.state==='IN_PLAY'")
        assert m.evaluate("document.documentElement.scrollWidth<=window.innerWidth")
        pitch = m.locator("#pitch-wrap").bounding_box()
        assert pitch and pitch["x"] >= 0 and pitch["x"] + pitch["width"] <= 390
        assert m.evaluate("""()=>{const r=window.__football.renderer;return r.offsetX>=0&&r.offsetY>=0&&r.offsetX+105*r.scale<=r.width+.01&&r.offsetY+68*r.scale<=r.height+.01;}""")
        passed("390px mobile viewport has no horizontal overflow and shows full pitch including both wings")
        m.wait_for_timeout(900)
        m.locator("#pitch-wrap").scroll_into_view_if_needed()
        m.screenshot(path=str(ARTIFACTS / "football-match-mobile.png"), full_page=True)

        arrange_owner(m)
        m.locator("#joystick").scroll_into_view_if_needed()
        box = m.locator("#joystick").bounding_box()
        sx, sy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
        before_x = m.evaluate("window.__football.engine.controlledPlayer.x")
        cdp = mobile.new_cdp_session(m)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": sx, "y": sy, "id": 1}]})
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": sx + 28, "y": sy, "id": 1}]})
        m.wait_for_timeout(400)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        assert m.evaluate("window.__football.engine.controlledPlayer.x") > before_x + .4
        passed("Real touch-pointer joystick moves the controlled footballer")

        arrange_owner(m, 75, 12)
        before_shots = m.evaluate("window.__football.engine.stats.shots[0]")
        m.locator('[data-action="shoot"]').tap()
        assert m.evaluate("window.__football.engine.stats.shots[0]") == before_shots + 1
        passed("Mobile shoot touch button dispatches its actual gameplay action")

        assert not errors, f"Browser errors: {errors}"
        passed("No browser console errors or uncaught page exceptions")
        print(json.dumps({"passed": len(checks), "checks": checks, "artifacts": str(ARTIFACTS)}, ensure_ascii=False), flush=True)
        mobile.close()
    except Exception:
        page.screenshot(path=str(ARTIFACTS / "football-browser-failure.png"), full_page=True)
        print(json.dumps({"passed": checks, "browser_errors": errors}, ensure_ascii=False), flush=True)
        raise
    finally:
        desktop.close()
        browser.close()
