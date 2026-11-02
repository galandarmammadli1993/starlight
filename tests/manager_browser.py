"""Manager career UI regression: actual commands; deterministic match fixtures via DEV hook.
Run against the Astro development server on port4321 (GAME_URL overrides).
"""
import os,json
from playwright.sync_api import sync_playwright, expect
URL=os.environ.get('GAME_URL','http://127.0.0.1:4321/starlight/')
checks=[]
def passed(s): checks.append(s);print('PASS',s,flush=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1440,'height':1000});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.goto(URL);page.wait_for_function('!!window.__football')
 page.locator('[data-mode="manager"]').click();expect(page.locator('#manager-dashboard')).to_be_visible()
 assert page.evaluate('__football.save.careers.manager.world.players.length')==176
 passed('manager dashboard creates persistent 8-club world')
 page.locator('#manager-dashboard [data-play]').first.click();expect(page.locator('#team-talk-dialog')).to_be_visible()
 page.locator('[data-talk-style="supportive"]').click();page.locator('#team-talk-continue').click()
 page.wait_for_function("__football.engine.state==='IN_PLAY'")
 assert page.evaluate('__football.engine.hasPersistentRoster && __football.engine.bench.length===7')
 assert page.evaluate('__football.save.careers.manager.world.psychology.talkKeys.length')==1
 passed('pre-match speech reaches real roster and starts scheduled fixture')
 assert page.locator('#away-team-name').inner_text()=='Sunrise Academy'
 assert page.locator('#user-venue-label').inner_text()=='SƏFƏR'
 passed('away fixture names and user score orientation agree')
 page.evaluate("""() => {const e=__football.engine;e.state='HALF_TIME';e.clock.half=1;e.clock.elapsed=2700;e.clock.halfEnded=true;for(const p of e.players)e.managerStats[p.persistentId].minutes=45;e.score=[0,1];}""")
 page.wait_for_timeout(350);page.locator('#manager-squad').click();page.locator('.sub-button').nth(9).click();expect(page.locator('#substitution-dialog')).to_be_visible()
 outgoing=page.evaluate('__football.engine.players[9].persistentId');incoming=page.locator('#bench-player').input_value()
 old_trust=page.evaluate('(id)=>__football.save.careers.manager.world.players.find(p=>p.id===id).trust',outgoing)
 page.locator('#substitution-reason').select_option('fatigue');page.locator('#confirm-substitution').click()
 expect(page.locator('#substitution-dialog')).not_to_be_visible()
 assert page.evaluate('__football.engine.players[9].persistentId')==incoming
 assert page.evaluate('(id)=>__football.save.careers.manager.world.players.find(p=>p.id===id).trust',outgoing)==min(100,old_trust+2)
 assert page.evaluate('__football.engine.substitutionEvents[0].minute')==45
 passed('real bench substitution preserves departed identity and psychological explanation')
 page.locator('#manager-talk-button').click();page.locator('[data-talk-style="tactical"]').click()
 assert page.evaluate('__football.save.careers.manager.world.psychology.talkKeys.length')==2
 page.locator('#team-talk-continue').click();page.wait_for_function('__football.engine.clock.half===2')
 passed('halftime speech applies once and second-half clock starts correctly')
 page.locator('#save-button').click();page.reload();page.wait_for_function('!!window.__football')
 assert page.evaluate('__football.save.suspendedByMode.manager.bench.length')==6
 assert page.evaluate('__football.save.suspendedByMode.manager.substitutionEvents[0].outgoingPersistentId')==outgoing
 page.locator('#manager-dashboard [data-play]').first.click();page.wait_for_function("__football.engine.state!=='PRE_MATCH'")
 assert page.evaluate('__football.engine.players[9].persistentId')==incoming
 assert page.evaluate('__football.engine.clock.half')==2
 passed('save/reload/resume retains substitute, bench, clock and speech history')
 page.evaluate("""() => {const e=__football.engine;e.clock.half=2;e.clock.elapsed=2700;e.clock.finished=true;e.state='FULL_TIME';e.score=[2,1];for(const p of e.players)e.managerStats[p.persistentId].minutes=p.id===9?45:90;}""")
 page.wait_for_function('__football.save.careers.manager.world.round===1')
 assert page.evaluate('__football.save.careers.manager.record.played')==1
 assert page.evaluate('__football.save.careers.manager.world.fixtures.filter(f=>f.played).length')==4
 assert page.evaluate('(id)=>__football.save.careers.manager.world.players.find(p=>p.id===id).statistics.minutes',outgoing)==45
 assert page.evaluate('(id)=>__football.save.careers.manager.world.players.find(p=>p.id===id).statistics.minutes',incoming)==45
 passed('full time records the round once with actual outgoing/incoming minutes')
 page.locator('#manager-talk-button').click();page.locator('[data-talk-style="calm"]').click();page.locator('#team-talk-continue').click()
 assert page.evaluate('__football.save.careers.manager.world.psychology.talkKeys.length')==3
 page.locator('#kickoff-button').click();expect(page.locator('#manager-dashboard')).to_be_visible()
 page.locator('#manager-dashboard [data-simulate]').first.click();page.wait_for_function('__football.save.careers.manager.world.round===2')
 assert page.evaluate('__football.save.careers.manager.record.played')==2
 assert page.evaluate('__football.save.careers.player.appearances===0 && __football.save.careers.player.day===1')
 passed('post-match talk and next fixture simulation preserve independent player life')
 page.locator('#manager-dashboard [data-tab="league"]').click();expect(page.locator('.mgr-workspace')).to_contain_text('Baku Athletic')
 passed('league dashboard exposes persisted results')
 assert errors==[],errors
 passed('no browser runtime errors')
 print(json.dumps({'checks':len(checks),'errors':errors}));browser.close()
