import { MatchEngine } from './engine.mjs';
import { PitchRenderer } from './renderer.mjs';
import { loadSave, saveData, captureMatch, restoreMatch, recordResult } from './storage.mjs';
import { ensureCareers, getCareerView, getPlayerAttributes, getManagerAttributes, careerAction, setTrainingFocus, setManagerPlan } from './career.mjs';

const $ = id => document.getElementById(id);
const all = query => [...document.querySelectorAll(query)];
let save = loadSave();
ensureCareers(save);
save.suspendedByMode ??= {quick:null,player:null,manager:null};
if(save.suspended && !save.suspendedByMode[save.suspended.options.mode])save.suspendedByMode[save.suspended.options.mode]=save.suspended;
let mode = 'quick';
let engine;
let started = false;
let lastFrame = 0;
let lastUI = 0;
let lastNotification = '';
let messageUntil = 0;
let toastTimer;
let autoSaveAge = 0;
let finishedSaved = null;
let dialogResume = false;
let lastLineupSignature = '';
let lastEventSequence = -1;
const keys = new Set();
const charges = new Map();
const input = { x:0, y:0, sprint:false, press:false, shield:false };
let joy = {x:0,y:0};
let touchSprint = false;
let touchPress = false;
const canvas = $('pitch');
const renderer = new PitchRenderer(canvas);

function options() { return { halfMinutes:save.profile.halfMinutes, position:save.profile.position, formation:mode==='manager'?getCareerView(save,'manager').formation:save.profile.formation, mode,
  ...(mode==='player'?{playerAttributes:getPlayerAttributes(save)}:mode==='manager'?{teamAttributes:getManagerAttributes(save)}:{}) }; }
function suspendedFor(selectedMode=mode){return save.suspendedByMode[selectedMode];}
function storeSuspended(snapshot){save.suspendedByMode[mode]=snapshot;save.suspended=snapshot;}
function makeMatch() {
  const next = new MatchEngine(options());
  if(mode==='manager')next.setTactic(getCareerView(save,'manager').tactic);
  next.matchId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  next.kitColor = save.profile.kitColor;
  if(mode==='player') {
    const player = next.players.find(p=>p.id===next.careerPlayer);
    if(player) {
      const previousNumber=player.number;
      const other=next.players.find(p=>p.team===0&&p.id!==player.id&&p.number===save.profile.shirtNumber);
      if(other)other.number=previousNumber;
      player.name=save.profile.name;player.number=save.profile.shirtNumber;
    }
  }
  next.debug = import.meta.env.DEV && new URLSearchParams(location.search).has('debug');
  return next;
}

function toast(text) {
  $('toast').textContent=text;
  $('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3200);
}
function persist(includeMatch=true) {
  if(includeMatch && started && engine.state!=='FULL_TIME') storeSuspended(captureMatch(engine));
  const ok=saveData(save);
  $('save-label').textContent=ok?'Saved on device':'Save unavailable';
  return ok;
}
function profileUI() {
  $('profile-name').replaceChildren(document.createTextNode(save.profile.name));
  const small=document.createElement('small'); small.textContent='LOCAL PROFILE'; $('profile-name').append(small);
  $('avatar').textContent=save.profile.name.split(/\s+/).map(s=>s[0]).slice(0,2).join('').toUpperCase();
  $('half-minutes').value=String(save.profile.halfMinutes);
  $('player-name').value=save.profile.name;
  $('player-role').value=save.profile.position;
  $('shirt-number').value=String(save.profile.shirtNumber);
  $('kit-color').value=save.profile.kitColor;
  $('formation').value=save.profile.formation;
  $('overlay-note').textContent=`${save.profile.halfMinutes} MIN / HALF · KEYBOARD + TOUCH`;
}
function chooseMode(next) {
  if(started) returnMenu();
  mode=next;
  engine=makeMatch();
  lastLineupSignature=''; lastEventSequence=-1;
  all('[data-mode]').forEach(button=>button.classList.toggle('selected',button.dataset.mode===mode));
  all('[data-nav]').forEach(button=>button.classList.toggle('active',button.dataset.nav===(mode==='quick'?'play':mode)));
  $('overlay-title').textContent=mode==='player'?'Your name. Your legacy.':mode==='manager'?'Build your winning eleven.':'Your pitch. Your moment.';
  $('overlay-description').textContent=mode==='player'?`Play as ${save.profile.name} · ${save.profile.position}. Your team moves with you.`:mode==='manager'?'Set the shape. Make the changes. Your team does the playing.':'A full 11 v 11 match. Build it your way.';
  $('kickoff-button').innerHTML=suspendedFor()?'RESUME MATCH <span>→</span>':'KICK OFF <span>→</span>';
  $('match-overlay').hidden=false;
  document.body.dataset.mode=mode;
  renderCareer();
  updateModeLayout();
  updateUI();
}
function startMatch() {
  const saved=suspendedFor()?restoreMatch(suspendedFor()):null;
  engine=saved??makeMatch();
  engine.kitColor=save.profile.kitColor;
  engine.debug=import.meta.env.DEV && new URLSearchParams(location.search).has('debug');
  started=true;
  finishedSaved=null;
  document.body.classList.add('playing');
  updateModeLayout();
  $('page-heading').textContent=mode==='player'?'Your career. Your moment.':mode==='manager'?'From the touchline.':'Matchday is here.';
  $('match-context').textContent=`${mode==='quick'?'EXHIBITION':mode==='player'?'PLAYER CAREER':'MANAGER CAREER'} / BAKU PARK`;
  $('pause-button').disabled=false;
  if(saved) {
    if(engine.state==='PAUSED') engine.resume();
    toast('Saved match restored. Welcome back.');
  } else { engine.continueMatch(); toast(mode==='manager'?'Your team is playing. Use tactics to shape the match.':'Find your teammates. Use J to pass, K to shoot.'); }
  lastNotification='';lastLineupSignature='';lastEventSequence=-1;lastFrame=0;
  renderer.resize();
  canvas.focus({preventScroll:true});
  updateUI();
}
function returnMenu() {
  if(started) {
    if(engine.state==='FULL_TIME') { recordResult(save,engine); storeSuspended(null); }
    else { engine.pause(); storeSuspended(captureMatch(engine)); }
    persist(false);
  }
  started=false; keys.clear();charges.clear();joy={x:0,y:0};touchSprint=touchPress=false;
  document.body.classList.remove('playing');
  $('page-heading').textContent='Let’s play football.';
  $('match-context').textContent='EXHIBITION / BAKU PARK';
  $('pause-button').disabled=true;
  $('match-message').classList.remove('visible');
  chooseMode(mode);
  renderer.resize();
}
function togglePause() {
  if(!started || ['FULL_TIME','HALF_TIME'].includes(engine.state)) return;
  if(engine.state==='PAUSED') engine.resume(); else { engine.pause(); persist(); }
  keys.clear();joy={x:0,y:0};touchSprint=touchPress=false;
  updateUI();
}
function openDialog(id) {
  if(document.querySelector('dialog[open]')) return;
  dialogResume=started&&engine.state!=='PAUSED'&&engine.state!=='FULL_TIME';
  if(dialogResume)engine.pause();
  keys.clear();joy={x:0,y:0};
  if(id==='club-dialog')renderClub();
  $(id).showModal();updateUI();
}
all('.close-dialog').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
all('dialog').forEach(dialog=>{
  dialog.addEventListener('close',()=>{if(dialogResume&&started)engine.resume();dialogResume=false;lastFrame=0;updateUI();});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
});
$('help-button').addEventListener('click',()=>openDialog('help-dialog'));
$('all-controls').addEventListener('click',()=>openDialog('help-dialog'));
$('edit-profile').addEventListener('click',()=>openDialog('settings-dialog'));
$('settings-form').addEventListener('submit',event=>{
  event.preventDefault();
  save.profile={...save.profile,name:$('player-name').value.trim()||'Alex Hero',position:$('player-role').value,shirtNumber:Number($('shirt-number').value),halfMinutes:Number($('half-minutes').value),kitColor:$('kit-color').value};
  if(engine)engine.kitColor=save.profile.kitColor;
  profileUI();persist();$('settings-dialog').close();
  if(!started)chooseMode(mode);
  toast('Profile saved. Match length applies to your next match.');
});
all('[data-mode]').forEach(button=>button.addEventListener('click',()=>chooseMode(button.dataset.mode)));
all('[data-nav]').forEach(button=>button.addEventListener('click',()=>{
  const value=button.dataset.nav;
  if(value==='settings'){openDialog('settings-dialog');return;}
  if(value==='club'){openDialog('club-dialog');return;}
  chooseMode(value==='play'?'quick':value);
}));
$('save-button').addEventListener('click',()=>toast(persist()?'Your profile and match are saved on this device.':'Browser storage is unavailable. Your game is still playable.'));
$('menu-button').addEventListener('click',()=>{returnMenu();toast('Progress saved. Your match will be here when you return.');});
$('pause-button').addEventListener('click',togglePause);
$('kickoff-button').addEventListener('click',()=>{
  if(!started){startMatch();return;}
  if(engine.state==='FULL_TIME'){storeSuspended(null);started=false;startMatch();return;}
  engine.continueMatch();lastFrame=0;updateUI();
});
$('fullscreen-button').addEventListener('click',async()=>{
  try { if(document.fullscreenElement)await document.exitFullscreen();else await $('pitch-wrap').closest('.match-card').requestFullscreen(); }
  catch {toast('Full screen is not supported in this browser.');}
});
document.addEventListener('fullscreenchange',()=>renderer.resize());
$('formation').addEventListener('change',event=>{
  if(mode==='manager')setManagerPlan(save,{formation:event.target.value});else save.profile.formation=event.target.value;
  engine.setFormation(event.target.value);lastLineupSignature='';persist();updateUI();
});
$('tactic').addEventListener('change',event=>{engine.setTactic(event.target.value);if(mode==='manager'){setManagerPlan(save,{tactic:event.target.value});persist();}updateUI();});
const descriptions={balanced:'Keep your shape. Move the ball. Find the opening.',wide:'Stretch the pitch. Send full-backs forward and deliver from either wing.',press:'Close down the ball carrier. Force errors higher up the pitch.',counter:'Stay compact, then release your forwards into space.'};
function updateModeLayout(){
  const careerMenu=!started&&mode!=='quick';
  $('career-hub').hidden=!careerMenu;
  $('home-intro').hidden=mode!=='quick';
  $('match-heading-row').hidden=careerMenu;
  document.querySelector('.match-layout').hidden=careerMenu;
  $('touch-controls').hidden=mode==='manager';
  $('manager-controls').hidden=mode!=='manager';
  $('target-button').hidden=mode==='manager';
  $('tactical-management').hidden=mode==='player';
  $('player-match-summary').hidden=mode!=='player';
  document.querySelector('[data-panel="tactics"]').textContent=mode==='player'?'MY PLAYER':'TACTICS';
  document.querySelectorAll('[data-action="switch"]').forEach(button=>button.hidden=mode==='player');
  $('formation').disabled=$('tactic').disabled=mode==='player';
  $('page-heading').textContent=started?(mode==='manager'?'From the touchline.':mode==='player'?'Your career. Your moment.':'Matchday is here.'):(mode==='player'?'The life of a footballer.':mode==='manager'?'Your club. Your decisions.':'Let’s play football.');
  document.querySelector('.match-bottom>span').textContent=mode==='manager'?'Choose your approach, manage the squad and watch your plan unfold.':mode==='player'?'W A S D Move · J Call / pass · K Shoot · You control only yourself':'W A S D Move · J Pass · K Shoot · X One-two';
}
const careerActions={
  player:[
    ['train_passing','01','Passing session','+2 Passing · −18 energy','Sharpen your touch and build better combinations.'],
    ['train_shooting','02','Finishing drills','+2 Shooting · −22 energy','Find the corners. Make the next chance count.'],
    ['train_fitness','03','Fitness training','+2 Pace · −24 energy','Build the engine behind your matchday runs.'],
    ['rest','04','Recovery day','+32 Energy · +2 fitness','Switch off, recover and return ready to play.'],
    ['community','05','Life off the pitch','+2 Reputation · −10 energy','Meet the fans. Build a life beyond the scoreline.'],
  ],
  manager:[
    ['team_training','01','Train the squad','€500 · preparation +1','Develop the team under your chosen training focus.'],
    ['rest_team','02','Give the team a day off','Free · +18 team fitness','A rested squad is ready for the next fixture.'],
    ['scouting','03','Commission scouting','€1,200 · report +1','Build your knowledge and board confidence.'],
    ['youth','04','Invest in the academy','€5,000 · academy +1','Improve the technical foundations of your team.'],
    ['recovery','05','Book recovery staff','€350 · +28 team fitness','Help the squad recover after demanding fixtures.'],
  ],
};
function renderCareer(){
  if(mode==='quick')return;
  const c=getCareerView(save,mode),player=mode==='player';
  $('career-eyebrow').textContent=player?'PLAYER CAREER / YOUR JOURNEY':'MANAGER CAREER / CLUB OFFICE';
  $('career-title').innerHTML=player?'ONE LIFE.<br />ONE LEGACY.':'THE CLUB.<br />YOUR CALL.';
  $('career-description').textContent=player?'Train, recover, build your reputation and live your own football story. On matchday, you play only as yourself.':'Choose the shape, develop the squad and balance the club’s resources. On matchday, manage from the touchline.';
  $('career-day').textContent=`WEEK ${c.week} / DAY ${c.day}`;
  $('career-identity').textContent=player?`${save.profile.name.toUpperCase()} · ${save.profile.position} · #${save.profile.shirtNumber}`:'BAKU ATHLETIC · FIRST TEAM MANAGER';
  $('career-shirt').textContent=save.profile.shirtNumber;
  $('career-portrait-caption').textContent=player?`${c.appearances} APPEARANCES · ${c.goals} PERSONAL GOALS`:'THE TEAM IS IN YOUR HANDS';
  $('career-actions-title').textContent=player?'OFF THE PITCH':'CLUB DECISIONS';
  const metrics=player?[['ENERGY',Math.round(c.energy),'Recover before your next game'],['FITNESS',Math.round(c.fitness),'Your match readiness'],['REPUTATION',Math.round(c.reputation),'Make your name'],['YOUR WALLET',`€${c.balance.toLocaleString()}`,`Weekly salary: €${c.salary}`]]:[['CLUB BUDGET',`€${c.budget.toLocaleString()}`,'Spend on the squad and its future'],['BOARD TRUST',Math.round(c.boardConfidence),'Results shape their confidence'],['TEAM MORALE',Math.round(c.teamMorale),'Keep the dressing room together'],['TEAM FITNESS',Math.round(c.teamFitness),'Manage the load']];
  const metricNodes=document.createDocumentFragment();
  for(const [label,value,note] of metrics){const card=document.createElement('div');card.className='career-metric';const l=document.createElement('span');l.textContent=label;const v=document.createElement('b');v.textContent=value;const n=document.createElement('small');n.textContent=note;card.append(l,v,n);metricNodes.append(card);}$('career-metrics').replaceChildren(metricNodes);
  const actions=document.createDocumentFragment();
  for(const [action,number,title,cost,description] of careerActions[mode]){
    const button=document.createElement('button');button.className='career-action';button.dataset.careerAction=action;
    const n=document.createElement('span');n.className='activity-number';n.textContent=number;
    const copy=document.createElement('span');const h=document.createElement('b');h.textContent=title;const p=document.createElement('small');p.textContent=description;const meta=document.createElement('em');meta.textContent=cost;copy.append(h,p,meta);
    const arrow=document.createElement('span');arrow.className='activity-arrow';arrow.textContent='→';button.append(n,copy,arrow);
    button.addEventListener('click',()=>{const result=careerAction(save,mode,action);persist(false);renderCareer();toast(result.message);});actions.append(button);
  }$('career-actions').replaceChildren(actions);
  if(player){
    const skills=document.createElement('div');skills.className='career-skill-grid';
    for(const [name,value] of Object.entries(c.skills)){const item=document.createElement('div');const label=document.createElement('span');label.textContent=name.toUpperCase();const val=document.createElement('b');val.textContent=Math.round(value);const bar=document.createElement('i');bar.style.setProperty('--level',`${value}%`);item.append(label,val,bar);skills.append(item);}
    $('career-note').replaceChildren(skills);const note=document.createElement('p');note.textContent='Each activity advances one day. Living costs are €20 per day. Energy and skills affect your own player in the next match.';$('career-note').append(note);
  }else{
    const label=document.createElement('label');label.textContent='TRAINING FOCUS';label.htmlFor='training-focus';const select=document.createElement('select');select.id='training-focus';
    for(const [value,title]of [['balanced','Balanced · passing'],['attack','Attacking · finishing'],['defence','Defensive · ball winning']]){const option=document.createElement('option');option.value=value;option.textContent=title;select.append(option);}select.value=c.trainingFocus;
    select.addEventListener('change',()=>{setTrainingFocus(save,select.value);persist(false);toast('Training focus saved for the next fixture.');});
    const note=document.createElement('p');note.textContent=`Academy level ${c.youthLevel}/10 · ${c.scoutingReports} scouting reports · ${c.record.won} wins from ${c.record.played} matches. Investments and training affect your team’s match attributes.`;
    $('career-note').replaceChildren(label,select,note);
  }
  $('career-match-description').textContent=player?`Your role: ${save.profile.position}. Control your own movement, call for passes and earn your place. The coach handles the rest of the team.`:'Your players handle the ball. You choose formation, tactics and substitutions from the touchline.';
  $('career-play').innerHTML=`${suspendedFor()?'RESUME YOUR MATCH':player?'PLAY AS YOURSELF':'MANAGE NEXT MATCH'} <span>→</span>`;
  $('career-resume').hidden=!suspendedFor();
  const log=document.createDocumentFragment();for(const activity of c.activityLog.slice(0,4)){const row=document.createElement('div');row.className='career-log';const day=document.createElement('span');day.textContent=`DAY ${activity.day}`;const message=document.createElement('p');message.textContent=activity.message;row.append(day,message);log.append(row);}
  if(!c.activityLog.length){const note=document.createElement('p');note.className='panel-note';note.textContent=player?'Your journey begins with the choices you make today.':'Set your training focus and prepare for your first match.';log.append(note);}$('career-activity').replaceChildren(log);
}
$('career-play').addEventListener('click',startMatch);
$('career-resume').addEventListener('click',()=>{storeSuspended(null);persist(false);startMatch();});
all('[data-manager-tactic]').forEach(button=>button.addEventListener('click',()=>{if(mode!=='manager')return;engine.setTactic(button.dataset.managerTactic);setManagerPlan(save,{tactic:button.dataset.managerTactic});persist();updateUI();}));
$('manager-squad').addEventListener('click',()=>{document.querySelector('[data-panel="tactics"]').click();document.querySelector('.match-panel').scrollIntoView({behavior:'smooth',block:'nearest'});});
all('[data-panel]').forEach(button=>button.addEventListener('click',()=>{
  all('[data-panel]').forEach(b=>b.classList.toggle('active',b===button));
  ['tactics','stats','events'].forEach(name=>$(`panel-${name}`).hidden=name!==button.dataset.panel);
  updateUI();
}));

function cycleTarget() {
  if(mode==='manager')return;
  const players=engine.players.filter(p=>p.team===0&&!p.sentOff&&p.id!==engine.controlled);
  const current=players.findIndex(p=>p.id===engine.selectedTarget);
  const target=players[(current+1)%players.length];
  if(target){engine.selectTarget(target.id);toast(`Receiver: #${target.number} ${target.name}`);}
}
$('target-button').addEventListener('click',cycleTarget);
canvas.addEventListener('pointerdown',event=>{
  if(!started||mode==='manager')return;
  const point=renderer.screenToWorld(event.clientX,event.clientY);
  if(!point||point.x<0||point.x>105||point.y<0||point.y>68)return;
  const target=engine.players.filter(p=>p.team===0&&!p.sentOff&&p.id!==engine.controlled).sort((a,b)=>Math.hypot(a.x-point.x,a.y-point.y)-Math.hypot(b.x-point.x,b.y-point.y))[0];
  if(target&&Math.hypot(target.x-point.x,target.y-point.y)<4)engine.selectTarget(target.id);
  canvas.focus({preventScroll:true});
});
function isDefending(){return started&&engine.state==='IN_PLAY'&&engine.possessionTeam===1;}
function fire(kind,power=.6) {
  if(!started||mode==='manager'||engine.state==='PAUSED'||document.querySelector('dialog[open]'))return;
  if(isDefending())kind=({pass:'press',through:mode==='player'?'tackle':'switch',cross:'clear',shoot:'tackle'})[kind]??kind;
  if(kind==='press')return;
  let aim=null;
  if(engine.restart&&engine.restart.type!=='KICK_OFF'&&Math.hypot(input.x,input.y)>.1){
    const d=Math.hypot(input.x,input.y),b=engine.ball;
    aim=kind==='shoot'?{x:engine.directions[0]===1?106:-1,y:34+input.y*2.6}:{x:b.x+input.x/d*25,y:b.y+input.y/d*25};
  }
  const success=engine.action(kind,power,aim);
  if(!success&&kind!=='switch'&&engine.state==='IN_PLAY'){
    const owner=engine.ball.owner!==null?engine.players[engine.ball.owner]:null;
    if(owner?.team!==0)toast('Win the ball first. Move closer, press or tackle.');
  }
  updateUI();
}
const actionKeys={KeyJ:'pass',Space:'pass',KeyK:'shoot',KeyL:'cross',KeyU:'through',KeyF:'tackle',KeyQ:'switch',KeyX:'oneTwo',KeyZ:'skill',KeyC:'clear'};
const movementKeys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight']);
document.addEventListener('keydown',event=>{
  if(event.target.matches('input,select,textarea')||document.querySelector('dialog[open]'))return;
  if(event.code==='Escape'||event.code==='KeyP'){if(started){event.preventDefault();if(!event.repeat)togglePause();}return;}
  if(event.code==='Slash'&&event.shiftKey){openDialog('help-dialog');return;}
  if(!started)return;
  if(event.code==='Tab'){
    if(event.target===canvas&&!event.shiftKey){event.preventDefault();if(!event.repeat)cycleTarget();}
    return;
  }
  if(movementKeys.has(event.code)||actionKeys[event.code])event.preventDefault();
  keys.add(event.code);
  if(actionKeys[event.code]&&!event.repeat){
    if(['switch','tackle','skill'].includes(actionKeys[event.code]))fire(actionKeys[event.code]);
    else charges.set(event.code,performance.now());
  }
});
document.addEventListener('keyup',event=>{
  keys.delete(event.code);
  if(charges.has(event.code)){const held=(performance.now()-charges.get(event.code))/1000;charges.delete(event.code);fire(actionKeys[event.code],Math.min(1,.45+held*.55));}
});
window.addEventListener('blur',()=>{keys.clear();charges.clear();joy={x:0,y:0};touchSprint=touchPress=false;if(started&&engine.state!=='PAUSED'&&!document.querySelector('dialog[open]')){engine.pause();persist();updateUI();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&started){engine.pause();persist();keys.clear();}lastFrame=0;});
const joystick=$('joystick');let joyPointer=null;
function moveJoy(event){const r=joystick.getBoundingClientRect();const dx=event.clientX-r.left-r.width/2,dy=event.clientY-r.top-r.height/2;const limit=r.width*.34,d=Math.hypot(dx,dy),scale=d>limit?limit/d:1;joy={x:dx*scale/limit,y:dy*scale/limit};$('joystick-stick').style.transform=`translate(${dx*scale}px,${dy*scale}px)`;}
joystick.addEventListener('pointerdown',event=>{event.preventDefault();joyPointer=event.pointerId;joystick.setPointerCapture(event.pointerId);moveJoy(event);});
joystick.addEventListener('pointermove',event=>{if(event.pointerId===joyPointer)moveJoy(event);});
function releaseJoy(){joyPointer=null;joy={x:0,y:0};$('joystick-stick').style.transform='';}
joystick.addEventListener('pointerup',releaseJoy);joystick.addEventListener('pointercancel',releaseJoy);joystick.addEventListener('lostpointercapture',releaseJoy);
all('[data-action]').forEach(button=>{
  let pressedAt=0;
  button.addEventListener('pointerdown',event=>{
    event.preventDefault();button.setPointerCapture(event.pointerId);pressedAt=performance.now();button.classList.add('charging');
    if(button.dataset.action==='pass'&&isDefending())touchPress=true;
  });
  button.addEventListener('pointerup',()=>{if(!pressedAt)return;const power=Math.min(1,.45+(performance.now()-pressedAt)/1800);pressedAt=0;button.classList.remove('charging');touchPress=false;fire(button.dataset.action,power);});
  button.addEventListener('pointercancel',()=>{pressedAt=0;touchPress=false;button.classList.remove('charging');});
});
all('[data-hold="sprint"]').forEach(button=>{
  button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);touchSprint=true;button.classList.add('charging');});
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>button.addEventListener(type,()=>{touchSprint=false;button.classList.remove('charging');}));
});

function renderLineup(){
  const signature=engine.players.filter(p=>p.team===0).map(p=>`${p.id}/${p.name}/${p.role}/${p.sentOff}/${p.yellow}/${Math.floor(p.stamina/10)}`).join('|');
  if(signature===lastLineupSignature)return;lastLineupSignature=signature;
  const fragment=document.createDocumentFragment();
  engine.players.filter(p=>p.team===0).forEach(player=>{
    const row=document.createElement('div');row.className='lineup-row';
    const number=document.createElement('span');number.className='lineup-number';number.textContent=player.number;
    const role=document.createElement('span');role.className='lineup-role';role.textContent=player.role;
    const name=document.createElement('span');name.className='lineup-player';name.textContent=`${player.name}${player.sentOff?' 🟥':player.yellow?' 🟨':''}`;
    const bar=document.createElement('span');bar.className='lineup-stamina';bar.title=`Stamina ${Math.round(player.stamina)}%`;
    const fill=document.createElement('i');fill.style.width=`${player.stamina}%`;bar.append(fill);
    const sub=document.createElement('button');sub.className='sub-button';sub.textContent='⇄';sub.title=`Substitute ${player.name} during a stoppage`;sub.setAttribute('aria-label',sub.title);sub.disabled=player.sentOff||player.substituted;
    sub.addEventListener('click',()=>{if(engine.substitute(player.id)){lastLineupSignature='';persist();updateUI();toast('Substitution made. Fresh legs on the pitch.');}else toast('Substitutions are available during stoppages. Maximum five.');});
    row.append(number,role,name,bar,sub);fragment.append(row);
  });$('lineup').replaceChildren(fragment);
  const mini=document.createDocumentFragment();
  engine.players.filter(p=>p.team===0&&!p.sentOff).forEach(player=>{const dot=document.createElement('span');dot.className='mini-player';dot.textContent=player.number;dot.style.left=`${player.homeY/68*100}%`;dot.style.top=`${100-(engine.directions[0]===1?player.homeX:105-player.homeX)/105*100}%`;mini.append(dot);});$('mini-pitch').replaceChildren(mini);
}
function renderStats(){
  const total=engine.stats.possession.reduce((a,b)=>a+b,0);const home=total?Math.round(engine.stats.possession[0]/total*100):50;
  const rows=[['POSSESSION',home,100-home,'%'],['SHOTS',...engine.stats.shots,''],['PASSES',...engine.stats.passes,''],['COMPLETED',...engine.stats.completed,''],['CORNERS',...engine.stats.corners,''],['FOULS',...engine.stats.fouls,''],['OFFSIDES',...engine.stats.offsides,'']];
  $('match-stats').innerHTML=rows.map(([label,a,b,suffix])=>`<div class="stat-row"><div><b>${a}${suffix}</b><span>${label}</span><b>${b}${suffix}</b></div><div class="stat-bar"><i style="flex:${a||.05}"></i><i style="flex:${b||.05}"></i></div></div>`).join('');
}
function renderFeed(){
  const seq=engine.eventLog[0]?.id??0;if(seq===lastEventSequence)return;lastEventSequence=seq;
  const fragment=document.createDocumentFragment();
  engine.eventLog.slice(0,25).forEach(event=>{const row=document.createElement('div');row.className='event';const time=document.createElement('time');time.textContent=`${event.time} · ${event.type.replaceAll('_',' ')}`;const text=document.createElement('span');text.textContent=event.message;row.append(time,text);fragment.append(row);});
  $('event-feed').replaceChildren(fragment);
}
function renderClub(){
  $('club-record').innerHTML=[['PLAYED',save.career.played],['WINS',save.career.won],['GOALS',save.career.goals]].map(([label,value])=>`<div><b>${value}</b><small>${label}</small></div>`).join('');
  const fragment=document.createDocumentFragment();save.career.results.slice(0,8).forEach(result=>{const row=document.createElement('div');row.className='history-row';const name=document.createElement('span');name.textContent=`${result.mode==='player'?'Player':'Manager'} career`;const score=document.createElement('b');score.textContent=`${result.score[0]} – ${result.score[1]} · ${result.result}`;row.append(name,score);fragment.append(row);});
  if(!fragment.childNodes.length){const p=document.createElement('p');p.className='panel-note';p.textContent='Complete your first career match to begin your record.';fragment.append(p);}$('career-history').replaceChildren(fragment);
}
function updateUI(){
  if(!engine)return;
  $('home-score').textContent=engine.score[0];$('away-score').textContent=engine.score[1];$('clock').textContent=engine.clock.display;
  $('half-label').textContent=!started?'PRE-MATCH':engine.state==='FULL_TIME'?'FULL TIME':engine.clock.half===1?'1ST HALF':'2ND HALF';
  $('pitch-status').textContent=!started?'KICK-OFF READY':engine.state.replaceAll('_',' ');
  $('formation-label').textContent=engine.formation;
  $('formation').value=engine.formation;$('tactic').value=engine.tactic;
  $('tactic-description').textContent=descriptions[engine.tactic];
  $('subs-count').textContent=`${engine.substitutions} / 5 SUBS`;
  all('[data-manager-tactic]').forEach(button=>button.classList.toggle('active',button.dataset.managerTactic===engine.tactic));
  $('pause-button').textContent=engine.state==='PAUSED'?'▶':'II';$('pause-button').setAttribute('aria-label',engine.state==='PAUSED'?'Resume match':'Pause match');
  const p=engine.controlledPlayer;
  $('controlled-label').textContent=started?(mode==='manager'?'MANAGER VIEW':`#${p?.number??''} ${(p?.name??'').toUpperCase()}`):'BAKU ATHLETIC';
  $('action-hint').textContent=mode==='manager'?'Your tactics. Their movement.':engine.restart?`${engine.restart.type.replaceAll('_',' ')} · restart`:engine.selectedTarget!==null?`TARGET #${engine.players[engine.selectedTarget]?.number}`:mode==='player'?'J to call for a pass · your own player only':'Click a teammate to choose a receiver';
  if(mode==='player'){
    const own=engine.players[engine.careerPlayer],summary=$('player-match-summary');
    const key=`${own?.name}/${own?.role}/${Math.round(own?.stamina??0)}/${engine.playerGoals?.[engine.careerPlayer]??0}`;
    if(summary.dataset.key!==key){summary.dataset.key=key;summary.replaceChildren();const heading=document.createElement('h3');heading.textContent=own?.name??save.profile.name;const role=document.createElement('p');role.className='panel-note';role.textContent=`YOUR POSITION: ${own?.role} · #${own?.number}`;const stamina=document.createElement('div');stamina.className='player-match-stat';stamina.textContent=`STAMINA ${Math.round(own?.stamina??0)}%`;const goals=document.createElement('div');goals.className='player-match-stat';goals.textContent=`PERSONAL GOALS ${engine.playerGoals?.[engine.careerPlayer]??0}`;const hint=document.createElement('p');hint.className='panel-note';hint.textContent='Your teammates and coach make their own decisions. Move into space and press J to ask for the ball. Your life choices shape your attributes.';summary.append(heading,role,stamina,goals,hint);}
  }
  const defending=isDefending();
  const controlLabels={pass:[defending?'PRESS':'PASS','J'],through:[defending?(mode==='player'?'TACKLE':'SWITCH'):'THROUGH','U'],cross:[defending?'CLEAR':'CROSS','L'],shoot:[defending?'TACKLE':'SHOOT','K']};
  for(const [action,[label,key]] of Object.entries(controlLabels)){const b=document.querySelector(`[data-action="${action}"]`);if(b.dataset.label!==label){b.innerHTML=`${label} <kbd>${key}</kbd>`;b.dataset.label=label;}}
  if(started){
    const show=['PAUSED','HALF_TIME','FULL_TIME'].includes(engine.state);$('match-overlay').hidden=!show;
    if(show){
      const paused=engine.state==='PAUSED',half=engine.state==='HALF_TIME';
      $('overlay-eyebrow').textContent=paused?'TAKE A BREATHER':half?'A GAME OF TWO HALVES':'THE FINAL WHISTLE';
      $('overlay-title').textContent=paused?'We’ll hold the play.':half?'Half-time. Reset. Go again.':`${engine.score[0]} – ${engine.score[1]} · ${engine.score[0]===engine.score[1]?'Honours even.':engine.score[0]>engine.score[1]?'Your moment. Your win.':'Another lesson. Another match.'}`;
      $('overlay-description').textContent=paused?'Your clock is paused. Ready when you are.':half?'Teams switch ends. Change tactics or make a substitution.':'Your career result has been saved on this device.';
      if(engine.state==='FULL_TIME'&&mode==='quick')$('overlay-description').textContent='Exhibition complete. Ready for another match?';
      $('kickoff-button').innerHTML=`${paused?'RESUME MATCH':half?'SECOND HALF':'PLAY AGAIN'} <span>→</span>`;
    }
    if(engine.notification!==lastNotification){lastNotification=engine.notification;$('match-message').textContent=lastNotification;messageUntil=performance.now()+3500;}
    $('match-message').classList.toggle('visible',!show&&performance.now()<messageUntil);
  }
  renderLineup();if(!$('panel-stats').hidden)renderStats();renderFeed();
}

function frame(timestamp){
  const dt=lastFrame?Math.min((timestamp-lastFrame)/1000,.25):0;lastFrame=timestamp;
  const kx=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
  const ky=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0);
  input.x=kx||joy.x;input.y=ky||joy.y;input.sprint=touchSprint||keys.has('ShiftLeft')||keys.has('ShiftRight');
  input.press=touchPress||(isDefending()&&(keys.has('KeyJ')||keys.has('Space')));input.shield=keys.has('KeyZ');
  if(started){
    engine.step(dt,input);autoSaveAge+=dt;
    if(engine.state==='FULL_TIME'&&finishedSaved!==engine.matchId){recordResult(save,engine);storeSuspended(null);finishedSaved=engine.matchId;persist(false);}
    if(autoSaveAge>15){autoSaveAge=0;persist();}
  }
  renderer.render(engine,dt);
  if(timestamp-lastUI>150){lastUI=timestamp;updateUI();}
  requestAnimationFrame(frame);
}
window.addEventListener('pagehide',()=>persist());
profileUI();chooseMode(save.suspended?.options?.mode??'quick');requestAnimationFrame(frame);

// Inspectable only in local development; production has no public debug control.
if(import.meta.env.DEV)window.__football={get engine(){return engine;},get save(){return save;},startMatch,returnMenu,fire,renderer};
