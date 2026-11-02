"""Player career regression through real decisions, hero controls and coach substitutions.
Uses the DEV hook only to arrange deterministic football situations.
"""
import os,json
from playwright.sync_api import sync_playwright,expect
URL=os.environ.get('GAME_URL','http://127.0.0.1:4321/starlight/')
checks=[]
def passed(s):checks.append(s);print('PASS',s,flush=True)
def tab(page,name):page.locator(f'[data-player-tab="{name}"]').click()
def state(page,expr):return page.evaluate(expr)
def finish(page,minutes=45.5,goals=1):
 page.evaluate("""({minutes,goals})=>{const e=__football.engine,s=e.managerStats[e.heroPersistentId];s.minutes=minutes;s.goals=goals;s.assists=1;s.completedPasses=12;s.passes=14;e.score=[2,1];e.clock.half=2;e.clock.elapsed=2700;e.clock.finished=true;e.state='FULL_TIME';}""",{'minutes':minutes,'goals':goals})
 page.wait_for_function("__football.engine.resultRecorded===true")
 page.locator('#kickoff-button').click();expect(page.locator('#player-dashboard')).to_be_visible()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(URL);page.wait_for_function('!!window.__football');page.locator('button[data-mode="manager"]').click()
 manager=state(page,'structuredClone(__football.save.careers.manager)')
 page.locator('button[data-mode="player"]').click();expect(page.locator('#player-dashboard')).to_be_visible()
 assert page.locator('[data-player-tab]').count()==8
 passed('independent player career dashboard and eight functional sections')
 tab(page,'events');page.locator('[data-player-command="resolve_event"]').first.click();expect(page.locator('.plr-feedback')).not_to_be_empty()
 assert state(page,"__football.save.careers.player.journey.life.events.some(e=>e.status==='resolved')")
 tab(page,'life');page.locator('[data-player-command="purchase"][data-payload*=pet_cat]').click()
 boots=page.locator('[data-player-form="appearance"]').filter(has=page.locator('input[value="boots"]'))
 boots.locator('select').select_option('red');boots.locator('button').click()
 hair=page.locator('[data-player-form="appearance"]').filter(has=page.locator('input[value="hair"]'))
 hair.locator('select').select_option('long');hair.locator('button').click()
 assert state(page,"__football.save.careers.player.journey.life.possessions.includes('pet_cat')")
 passed('actual event consequences, personal purchases and saved appearance')
 page.locator('[data-player-play]').click();page.wait_for_function("__football.engine.state==='IN_PLAY'")
 assert state(page,'__football.engine.controlledPlayer.persistentId===__football.engine.heroPersistentId')
 assert state(page,"__football.renderer.playerModels.get(__football.engine.careerPlayer).boots[0].material.color.getHexString()")=='cd433e'
 passed('only the named hero is controlled and purchased boots appear on its 3D body')
 page.evaluate("""()=>{const e=__football.engine,hero=e.controlledPlayer;e.restart=null;e.pendingRestart=null;e.offside=null;e.kickCooldown=0;e.keeperHold=null;e.state='IN_PLAY';e.players.forEach(q=>{q.timer=20;if(q.team===1){q.x=5;q.y=5;}});hero.x=80;hero.y=34;Object.assign(e.ball,{owner:hero.id,x:80.45,y:34,z:.11,vx:0,vy:0,vz:0,lastTouch:{team:0,playerId:hero.id}});const step=e.step;e.__qaAimHold=true;e.step=function(...a){if(!this.__qaAimHold)return step.apply(this,a);};const release=event=>{if(event.target===document.querySelector('#pitch')){e.__qaAimHold=false;document.removeEventListener('pointerup',release,true);}};document.addEventListener('pointerup',release,true);}""")
 page.wait_for_timeout(350);page.locator('#aim-shot-button').click();page.locator('#shot-spin').focus();page.keyboard.press('End');page.locator('#shot-contact').focus();page.keyboard.press('Home')
 page.wait_for_function('__football.renderer.worldToScreen(95,33).visible')
 points=state(page,"(()=>{const r=__football.renderer,b=document.querySelector('#pitch').getBoundingClientRect(),a=r.worldToScreen(80,34),z=r.worldToScreen(95,33);return {ax:b.left+a.x,ay:b.top+a.y,bx:b.left+z.x,by:b.top+z.y};})()")
 page.mouse.move(points['ax'],points['ay']);page.mouse.down();page.mouse.move(points['bx'],points['by'],steps=8);page.mouse.up()
 assert state(page,'__football.engine.stats.shots[0]')>=1
 assert state(page,'Math.abs(__football.engine.ball.spin)')>0
 assert state(page,'__football.engine.playerMatchReport.hero.shots')>=1
 passed('drag aiming creates a genuine powered curved shot and individual shot statistic')
 finish(page)
 assert state(page,'__football.save.careers.player.appearances')==1
 assert state(page,'__football.save.careers.player.goals')==1
 assert state(page,'__football.save.careers.player.journey.round')==1
 tab(page,'training');points_before=state(page,'__football.save.careers.player.journey.skillPoints')
 page.locator('[data-player-command="spend_skill"]').first.click();assert state(page,'__football.save.careers.player.journey.skillPoints')==points_before-1
 passed('actual personal report advances the league and earns spendable development points')
 page.evaluate("""()=>{const p=__football.save.careers.player,j=p.journey,f=j.fixtures.find(f=>!f.played&&(f.homeClubId===j.clubId||f.awayClubId===j.clubId));p.day=j.seasonStartDay+f.day;j.day=p.day;p.energy=65;j.form=45;j.life.coachTrust=15;}""")
 page.locator('button[data-mode="player"]').click();page.locator('[data-player-play]').click();page.wait_for_function("__football.engine.playerCareerStatus==='bench'")
 assert state(page,'__football.engine.controlled')==-1
 assert state(page,"__football.engine.action('shoot')") is False
 expect(page.locator('#touch-controls')).to_be_hidden();expect(page.locator('#player-coach-copy')).to_contain_text('Ehtiyatdasan')
 page.locator('#save-button').click();page.locator('#menu-button').click();page.reload();page.wait_for_function('!!window.__football')
 page.locator('[data-player-play]').click();assert state(page,'__football.engine.controlled')==-1
 passed('bench watching forbids teammate control and survives save/reload/resume')
 page.evaluate("""()=>{const e=__football.engine;e.clock.half=2;e.clock.elapsed=20*60;e.clock.halfEnded=false;e.state='IN_PLAY';e.restart=null;e.pendingRestart=null;Object.assign(e.ball,{owner:null,x:52,y:.05,z:.11,vx:0,vy:-15,vz:0,lastTouch:{team:1,playerId:17}});}""")
 page.wait_for_function("__football.engine.playerCareerStatus==='playing'")
 assert state(page,'__football.engine.controlledPlayer.persistentId===__football.engine.heroPersistentId')
 assert state(page,'__football.engine.substitutions')==1
 passed('coach introduces the real benched hero at a physical stoppage')
 page.evaluate("""()=>{const e=__football.engine;e.clock.half=2;e.clock.elapsed=30*60;e.controlledPlayer.stamina=10;e.state='IN_PLAY';e.restart=null;e.pendingRestart=null;Object.assign(e.ball,{owner:null,x:52,y:.05,z:.11,vx:0,vy:-15,vz:0,lastTouch:{team:1,playerId:17}});}""")
 page.wait_for_function("__football.engine.playerCareerStatus==='substituted'")
 assert state(page,'__football.engine.controlled')==-1
 assert state(page,"__football.engine.action('pass')") is False
 expect(page.locator('#player-coach-copy')).to_contain_text('əvəzlədi')
 passed('fatigue withdrawal removes hero control and keeps its individual ledger')
 finish(page,25.5,0)
 assert state(page,'__football.save.careers.player.appearances')==2
 assert state(page,'__football.save.careers.player.journey.careerStats.minutes')==71
 tab(page,'club');old_club=state(page,'__football.save.careers.player.journey.clubId')
 page.locator('[data-player-command="request_transfer"]').click();page.locator('[data-player-command="accept_offer"]').first.click()
 assert state(page,'__football.save.careers.player.journey.clubId')!=old_club
 assert state(page,'__football.save.careers.player.salary')>700
 passed('player-facing offer changes the actual club, hero roster and weekly salary')
 assert state(page,'structuredClone(__football.save.careers.manager)')==manager
 passed('player choices and results leave manager career untouched')
 for width in [390,768]:
  page.set_viewport_size({'width':width,'height':900})
  for name in ['overview','training','club','relationships','events','life','legacy','league']:
   tab(page,name);assert state(page,'document.documentElement.scrollWidth<=innerWidth+1')
 passed('all career sections fit mobile and tablet widths')
 assert not errors,errors;passed('no uncaught runtime errors')
 print(json.dumps({'checks':len(checks),'errors':errors}),flush=True);b.close()
