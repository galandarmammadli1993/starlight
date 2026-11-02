"""Chromium regressions for the 3D sideline game and independent careers.

Run with the development server on port 4321. GAME_URL (including Astro base)
can override the target; CHROMIUM_PATH overrides /usr/bin/chromium.
The development inspection hook only arranges deterministic football fixtures;
all tested actions still pass through real keyboard, pointer and DOM handlers.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE_URL = os.environ.get("GAME_URL", os.environ.get("FOOTBALL_TEST_URL", "http://127.0.0.1:4321/starlight/"))
CHROMIUM_PATH = os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium")
ARTIFACTS = Path(__file__).resolve().parents[2] / "scratch"
ARTIFACTS.mkdir(parents=True, exist_ok=True)
checks, errors = [], []


def passed(name):
    checks.append(name)
    print(f"PASS {name}", flush=True)


def attach_errors(page):
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)


def ready(page):
    response = page.goto(BASE_URL, wait_until="networkidle")
    assert response.status == 200
    page.wait_for_function("!!window.__football && !!window.__football.engine")
    expect(page).to_have_title("Footba11 Heroes — Make the game yours.")
    page.wait_for_function("window.__football.renderer.playerModels.size===22")


def start_quick(page):
    page.locator("#kickoff-button").click()
    page.wait_for_function("document.body.classList.contains('playing') && window.__football.engine.state==='IN_PLAY'")
    page.locator("#pitch").focus()


def arrange_owner(page, x=40, y=34):
    """Arrange possession; keep the engine's one authoritative ball object."""
    return page.evaluate("""({x,y}) => {
      const e=window.__football.engine;
      e.state='IN_PLAY';e.restart=null;e.pendingRestart=null;e.restartOrigin=null;e.offside=null;
      e.kickCooldown=0;e.keeperHold=null;e.accumulator=0;e.penaltyInProgress=false;e.deferredClockEvent=null;
      const p=e.controlledPlayer;
      e.players.forEach(q=>{q.vx=q.vy=0;q.timer=20;if(q.team===1){q.x=90+q.id%5;q.y=4+(q.id%6)*10;}});
      p.x=x;p.y=y;p.faceX=e.directions[0];p.faceY=0;
      Object.assign(e.ball,{x:x+.45*e.directions[0],y,z:.11,vx:0,vy:0,vz:0,owner:p.id,lastTouch:{team:0,playerId:p.id}});
      return p.id;
    }""", {"x": x, "y": y})


def one_ball(page):
    return page.evaluate("""()=>{
      const r=window.__football.renderer, balls=[];
      r.scene.traverse(o=>{if(o.userData.kind==='match-ball')balls.push(o);});
      return balls.length===1&&balls[0]===r.ballMesh&&r.ballMesh.visible;
    }""")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=CHROMIUM_PATH, headless=True,
        args=["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader"])
    desktop = browser.new_context(viewport={"width": 1440, "height": 1100}, reduced_motion="reduce")
    page = desktop.new_page()
    attach_errors(page)
    mobile = None
    try:
        ready(page)
        assert page.locator("#pitch").get_attribute("data-renderer") == "threejs-sideview"
        assert one_ball(page)
        angle = page.evaluate("""()=>{const r=window.__football.renderer,c=r.camera.position,t=r.cameraTarget;return Math.atan2(c.y-t.y,Math.hypot(c.x-t.x,c.z-t.z))*180/Math.PI;}""")
        assert 15 < angle < 45, angle
        roundtrip = page.evaluate("""()=>{const r=window.__football.renderer,q=r.worldToScreen(50,25),rect=r.canvas.getBoundingClientRect();return r.screenToWorld(q.x+rect.left,q.y+rect.top);}""")
        assert abs(roundtrip["x"]-50) < .01 and abs(roundtrip["y"]-25) < .01
        passed("Real WebGL sideline camera has standing 22-player models, one ball and correct pointer raycast")
        start_quick(page)
        assert page.evaluate("window.__football.engine.players.length") == 22
        page.wait_for_timeout(500)
        page.screenshot(path=str(ARTIFACTS / "new-sideview-play.png"), full_page=True)
        passed("Quick match starts the real 22-player game")

        page.locator("#pitch").focus()
        page.keyboard.press("Tab")
        assert page.evaluate("window.__football.engine.selectedTarget!==null && document.activeElement.id==='pitch'")
        page.keyboard.press("Shift+Tab")
        assert page.evaluate("document.activeElement.id!=='pitch'")
        page.locator("#pause-button").focus()
        page.keyboard.press("Tab")
        assert page.evaluate("document.activeElement.id==='camera-toggle'")
        page.keyboard.press("Tab")
        assert page.evaluate("document.activeElement.id==='fullscreen-button'")
        page.locator("#pitch").focus()
        passed("Receiver shortcut is scoped to pitch; keyboard focus can leave it")

        arrange_owner(page)
        start_x = page.evaluate("window.__football.engine.controlledPlayer.x")
        page.keyboard.down("d")
        page.wait_for_function("window.__football.engine.controlledPlayer.x>" + str(start_x + .5))
        page.keyboard.up("d")
        passed("Keyboard movement changes actual player position")

        arrange_owner(page)
        receiver_point = page.evaluate("""() => {
          const {engine:e,renderer:r}=window.__football;
          const p=e.players.find(p=>p.team===0&&p.id!==e.controlled&&p.role==='MID');
          p.x=59;p.y=42;p.vx=p.vy=0;
          const rect=r.canvas.getBoundingClientRect(),q=r.worldToScreen(p.x,p.y);
          return {id:p.id,x:rect.left+q.x,y:rect.top+q.y};
        }""")
        page.mouse.click(receiver_point["x"], receiver_point["y"])
        assert page.evaluate("window.__football.engine.selectedTarget") == receiver_point["id"]
        passes = page.evaluate("window.__football.engine.stats.passes[0]")
        page.keyboard.press("j", delay=80)
        assert page.evaluate("window.__football.engine.stats.passes[0]") == passes + 1
        assert page.evaluate("Math.hypot(window.__football.engine.ball.vx,window.__football.engine.ball.vy)") > 5
        assert one_ball(page)
        passed("3D teammate picking and keyboard pass launch the single independent ball")

        arrange_owner(page, 78, 11)
        # Observe the actual launch in the same browser event, before a slow
        # software-WebGL driver round trip lets defenders/physics alter velocity.
        page.evaluate("""() => {
          window.__shotLaunches=[];
          document.addEventListener('keyup',event=>{
            if(event.code!=='KeyK')return;
            const e=window.__football.engine;
            window.__shotLaunches.push({speed:Math.hypot(e.ball.vx,e.ball.vy),shots:e.stats.shots[0]});
          });
        }""")
        shots = page.evaluate("window.__football.engine.stats.shots[0]")
        page.keyboard.press("k", delay=80)
        assert page.evaluate("window.__football.engine.stats.shots[0]") == shots + 1
        low_speed = page.evaluate("window.__shotLaunches.at(-1).speed")
        arrange_owner(page)
        page.keyboard.down("k")
        page.wait_for_timeout(900)
        page.keyboard.up("k")
        high_speed = page.evaluate("window.__shotLaunches.at(-1).speed")
        assert high_speed > low_speed + 4, (low_speed, high_speed)
        assert one_ball(page)
        passed("Wide-angle shots work and held shoot input increases real ball speed")

        page.locator("#pause-button").click()
        page.wait_for_function("window.__football.engine.state==='PAUSED'")
        elapsed = page.evaluate("window.__football.engine.clock.elapsed")
        page.wait_for_timeout(400)
        assert page.evaluate("window.__football.engine.clock.elapsed") == elapsed
        page.locator("#pause-button").click()
        page.wait_for_function("window.__football.engine.clock.elapsed>" + str(elapsed))
        passed("Pause freezes clock; resume advances one authoritative simulation")

        page.evaluate("""()=>{const e=window.__football.engine;window.__qaBall=e.ball;e._setupRestart({type:'THROW_IN',team:0,x:35,y:0});}""")
        page.wait_for_timeout(150)
        assert one_ball(page)
        assert page.evaluate("window.__qaBall===window.__football.engine.ball")
        page.keyboard.press("j")
        page.wait_for_function("window.__football.engine.state==='IN_PLAY'")
        assert one_ball(page)
        passed("Throw-in setup and physical restart retain exactly one ball object and one rendered ball")

        page.locator("#menu-button").click()
        page.locator("#edit-profile").click()
        page.locator("#player-name").fill("QA Defender")
        page.locator("#player-role").select_option("DEF")
        page.locator("#half-minutes").select_option("5")
        page.locator("#shirt-number").fill("10")
        page.locator("#kit-color").select_option("blue")
        page.locator("#settings-form button[type=submit]").click()
        page.locator('[data-mode="player"]').click()
        expect(page.locator("#career-hub")).to_be_visible()
        expect(page.locator(".match-layout")).to_be_hidden()
        before = page.evaluate("structuredClone(window.__football.save.careers.player)")
        page.locator('[data-career-action="train_passing"]').click()
        after = page.evaluate("structuredClone(window.__football.save.careers.player)")
        assert after["day"] == before["day"] + 1
        assert after["skills"]["passing"] == before["skills"]["passing"] + 2
        assert after["energy"] == before["energy"] - 18
        page.locator('[data-career-action="rest"]').click()
        assert page.evaluate("window.__football.save.careers.player.energy") > after["energy"]
        page.screenshot(path=str(ARTIFACTS / "new-career-player.png"), full_page=True)
        passed("Player career has its own life dashboard; training/rest change day, skill and energy")

        page.locator("#career-play").click()
        page.wait_for_function("document.body.classList.contains('playing')")
        assert page.evaluate("window.__football.engine.controlledPlayer.role") == "DEF"
        assert page.evaluate("window.__football.engine.controlledPlayer.name") == "QA Defender"
        assert page.evaluate("window.__football.engine.clock.halfMinutes") == 5
        assert page.evaluate("window.__football.engine.kitColor") == "blue"
        assert page.evaluate("new Set(window.__football.engine.players.filter(p=>p.team===0).map(p=>p.number)).size") == 11
        expect(page.locator("#tactical-management")).to_be_hidden()
        expect(page.locator("#player-match-summary")).to_be_visible()
        controlled = page.evaluate("window.__football.engine.controlled")
        page.locator("#pitch").focus()
        page.keyboard.press("q")
        assert page.evaluate("window.__football.engine.controlled") == controlled
        assert page.evaluate("window.__football.engine.options.playerAttributes.passing") == after["skills"]["passing"]
        passed("Player match locks customized identity/role and trained attributes; coach controls are hidden")

        page.evaluate("""()=>{const e=window.__football.engine;e.score=[2,1];e.clock.elapsed=317.25;e.pause();}""")
        page.locator("#menu-button").click()
        assert page.evaluate("window.__football.save.suspendedByMode.player.score[0]") == 2
        player_before_manager = page.evaluate("JSON.stringify(window.__football.save.careers.player)")
        page.locator('[data-mode="manager"]').click()
        expect(page.locator("#manager-dashboard")).to_be_visible()
        expect(page.locator("#career-hub")).to_be_hidden()
        budget = page.evaluate("window.__football.save.careers.manager.budget")
        page.locator('[data-tab="market"]').click()
        page.locator('[data-command="scouting"]').click()
        assert page.evaluate("window.__football.save.careers.manager.budget") == budget - 1200
        assert page.evaluate("window.__football.save.careers.manager.scoutingReports") == 1
        assert page.evaluate("window.__football.save.careers.manager.world.scoutReports[0].playerIds.length") == 4
        assert page.evaluate("JSON.stringify(window.__football.save.careers.player)") == player_before_manager
        page.locator('[data-tab="office"]').click()
        page.locator('[data-plan="training_focus"]').select_option("attack")
        assert page.evaluate("window.__football.save.careers.manager.world.plan.trainingFocus") == "attack"
        page.screenshot(path=str(ARTIFACTS / "new-career-manager.png"), full_page=True)
        passed("Manager office has separate budget/scouting/training decisions that do not change player life")

        page.locator('#manager-dashboard [data-play]').click()
        expect(page.locator("#team-talk-dialog")).to_be_visible()
        page.locator('[data-talk-style="calm"]').click()
        expect(page.locator("#team-talk-result")).not_to_be_empty()
        assert page.evaluate("window.__football.save.careers.manager.world.psychology.talkKeys.some(key=>key.endsWith(':pre_match'))")
        page.locator("#team-talk-continue").click()
        page.wait_for_function("document.body.classList.contains('playing')")
        expect(page.locator("#touch-controls")).to_be_hidden()
        expect(page.locator("#manager-controls")).to_be_visible()
        expect(page.locator("#target-button")).to_be_hidden()
        page.locator("#formation").select_option("3-5-2")
        page.locator('[data-manager-tactic="press"]').click()
        assert page.evaluate("window.__football.engine.formation") == "3-5-2"
        assert page.evaluate("window.__football.engine.tactic") == "press"
        assert page.evaluate("window.__football.engine.players.filter(p=>p.team===0&&p.role==='MID').length") == 5
        page.evaluate("""()=>{const e=window.__football.engine;e.__qaActionCount=0;const action=e.action.bind(e);e.action=(...args)=>{e.__qaActionCount++;return action(...args)};}""")
        page.locator("#pitch").focus()
        page.keyboard.down("d")
        page.keyboard.press("j")
        page.keyboard.press("k")
        page.keyboard.press("q")
        page.wait_for_timeout(300)
        assert page.evaluate("window.__football.engine.__qaActionCount") == 0
        assert page.evaluate("window.__football.engine.input.x") == 0
        page.keyboard.up("d")
        passed("Manager controls tactics and formation while direct player controls stay disabled")

        page.evaluate("""()=>{const e=window.__football.engine;e.score=[0,3];e.clock.elapsed=112;e.pause();}""")
        page.locator("#menu-button").click()
        assert page.evaluate("window.__football.save.suspendedByMode.player.score") == [2,1]
        assert page.evaluate("window.__football.save.suspendedByMode.manager.score") == [0,3]
        page.reload(wait_until="networkidle")
        page.wait_for_function("!!window.__football")
        page.locator('[data-mode="player"]').click()
        expect(page.locator("#career-play")).to_contain_text("RESUME YOUR MATCH")
        page.locator("#career-play").click()
        assert page.evaluate("window.__football.engine.score") == [2,1]
        assert 317.25 <= page.evaluate("window.__football.engine.clock.elapsed") < 325
        assert page.evaluate("window.__football.engine.controlledPlayer.role") == "DEF"
        assert page.evaluate("window.__football.save.careers.manager.budget") == budget - 1200
        assert page.evaluate("window.__football.save.career.played") == 0
        passed("Player and manager keep independent suspended matches through mode switches and page reload")

        page.evaluate("""()=>{
          const e=window.__football.engine;e.state='IN_PLAY';e.restart=null;e.pendingRestart=null;e.penaltyInProgress=false;e.deferredClockEvent=null;
          Object.assign(e.clock,{half:2,elapsed:2699.99,stoppedSeconds:0,addedSeconds:0,halfEnded:false,finished:false});
        }""")
        page.wait_for_function("window.__football.engine.state==='FULL_TIME'")
        page.wait_for_function("window.__football.save.careers.player.appearances===1")
        page.wait_for_timeout(300)
        page.locator("#menu-button").click()
        assert page.evaluate("window.__football.save.careers.player.appearances") == 1
        assert page.evaluate("window.__football.save.careers.manager.record.played") == 0
        assert page.evaluate("window.__football.save.suspendedByMode.player") is None
        assert page.evaluate("window.__football.save.suspendedByMode.manager.score") == [0,3]
        passed("Full-time player result commits once to own career without erasing manager progress")

        mobile = browser.new_context(viewport={"width":390,"height":844},device_scale_factor=2,
                                    is_mobile=True,has_touch=True,reduced_motion="reduce")
        m = mobile.new_page()
        attach_errors(m)
        ready(m)
        start_quick(m)
        assert m.evaluate("document.documentElement.scrollWidth<=window.innerWidth")
        pitch = m.locator("#pitch-wrap").bounding_box()
        assert pitch and pitch["x"] >= 0 and pitch["x"]+pitch["width"] <= 390
        assert m.locator("#pitch").get_attribute("data-renderer") == "threejs-sideview"
        assert one_ball(m)
        m.screenshot(path=str(ARTIFACTS / "new-mobile.png"), full_page=True)
        passed("390px mobile layout has no overflow and renders the genuine sideview scene with one ball")

        arrange_owner(m)
        m.locator("#joystick").scroll_into_view_if_needed()
        box=m.locator("#joystick").bounding_box()
        sx,sy=box["x"]+box["width"]/2,box["y"]+box["height"]/2
        before_x=m.evaluate("window.__football.engine.controlledPlayer.x")
        cdp=mobile.new_cdp_session(m)
        cdp.send("Input.dispatchTouchEvent",{"type":"touchStart","touchPoints":[{"x":sx,"y":sy,"id":1}]})
        cdp.send("Input.dispatchTouchEvent",{"type":"touchMove","touchPoints":[{"x":sx+28,"y":sy,"id":1}]})
        m.wait_for_function("window.__football.engine.controlledPlayer.x>"+str(before_x+.4))
        cdp.send("Input.dispatchTouchEvent",{"type":"touchEnd","touchPoints":[]})
        arrange_owner(m,75,12)
        before_shots=m.evaluate("window.__football.engine.stats.shots[0]")
        m.locator('[data-action="shoot"]').tap()
        assert m.evaluate("window.__football.engine.stats.shots[0]") == before_shots+1
        assert one_ball(m)
        passed("Real touch joystick and shoot button control gameplay without creating extra balls")

        assert not errors, f"Browser errors: {errors}"
        passed("No browser console errors or uncaught page exceptions")
        print(json.dumps({"passed":len(checks),"checks":checks,"artifacts":str(ARTIFACTS)},ensure_ascii=False),flush=True)
    except Exception:
        page.screenshot(path=str(ARTIFACTS / "football-browser-failure.png"),full_page=True)
        print(json.dumps({"passed":checks,"browser_errors":errors},ensure_ascii=False),flush=True)
        raise
    finally:
        if mobile:
            mobile.close()
        desktop.close()
        browser.close()
