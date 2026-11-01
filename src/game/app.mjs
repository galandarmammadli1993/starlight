import { MatchEngine } from './engine.mjs';
import { PitchRenderer } from './renderer.mjs';
import { loadSave, saveData, captureMatch, restoreMatch, recordResult } from './storage.mjs';

const $ = id => document.getElementById(id);
const all = query => [...document.querySelectorAll(query)];
let save = loadSave();
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

function options() { return { halfMinutes:save.profile.halfMinutes, position:save.profile.position, formation:save.profile.formation, mode }; }
function makeMatch() {
  const next = new MatchEngine(options());
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
  if(includeMatch && started && engine.state!=='FULL_TIME') save.suspended=captureMatch(engine);
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
  $('kickoff-button').innerHTML=save.suspended?.options?.mode===mode?'RESUME MATCH <span>→</span>':'KICK OFF <span>→</span>';
  $('match-overlay').hidden=false;
  updateUI();
}
function startMatch() {
  const saved=save.suspended?.options?.mode===mode?restoreMatch(save.suspended):null;
  engine=saved??makeMatch();
  engine.kitColor=save.profile.kitColor;
  engine.debug=import.meta.env.DEV && new URLSearchParams(location.search).has('debug');
  started=true;
  finishedSaved=null;
  document.body.classList.add('playing');
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
    if(engine.state==='FULL_TIME') { recordResult(save,engine); save.suspended=null; }
    else { engine.pause(); save.suspended=captureMatch(engine); }
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
  if(engine.state==='FULL_TIME'){save.suspended=null;started=false;startMatch();return;}
  engine.continueMatch();lastFrame=0;updateUI();
});
$('fullscreen-button').addEventListener('click',async()=>{
  try { if(document.fullscreenElement)await document.exitFullscreen();else await $('pitch-wrap').closest('.match-card').requestFullscreen(); }
  catch {toast('Full screen is not supported in this browser.');}
});
document.addEventListener('fullscreenchange',()=>renderer.resize());
$('formation').addEventListener('change',event=>{
  save.profile.formation=event.target.value;engine.setFormation(event.target.value);lastLineupSignature='';persist();updateUI();
});
$('tactic').addEventListener('change',event=>{engine.setTactic(event.target.value);updateUI();});
const descriptions={balanced:'Keep your shape. Move the ball. Find the opening.',wide:'Stretch the pitch. Send full-backs forward and deliver from either wing.',press:'Close down the ball carrier. Force errors higher up the pitch.',counter:'Stay compact, then release your forwards into space.'};
all('[data-panel]').forEach(button=>button.addEventListener('click',()=>{
  all('[data-panel]').forEach(b=>b.classList.toggle('active',b===button));
  ['tactics','stats','events'].forEach(name=>$(`panel-${name}`).hidden=name!==button.dataset.panel);
  updateUI();
}));

function cycleTarget() {
  const players=engine.players.filter(p=>p.team===0&&!p.sentOff&&p.id!==engine.controlled);
  const current=players.findIndex(p=>p.id===engine.selectedTarget);
  const target=players[(current+1)%players.length];
  if(target){engine.selectTarget(target.id);toast(`Receiver: #${target.number} ${target.name}`);}
}
$('target-button').addEventListener('click',cycleTarget);
canvas.addEventListener('pointerdown',event=>{
  if(!started)return;
  const point=renderer.screenToWorld(event.clientX,event.clientY);
  const target=engine.players.filter(p=>p.team===0&&!p.sentOff&&p.id!==engine.controlled).sort((a,b)=>Math.hypot(a.x-point.x,a.y-point.y)-Math.hypot(b.x-point.x,b.y-point.y))[0];
  if(target&&Math.hypot(target.x-point.x,target.y-point.y)<4)engine.selectTarget(target.id);
  canvas.focus({preventScroll:true});
});
function isDefending(){return started&&engine.state==='IN_PLAY'&&engine.possessionTeam===1;}
function fire(kind,power=.6) {
  if(!started||engine.state==='PAUSED'||document.querySelector('dialog[open]'))return;
  if(isDefending())kind=({pass:'press',through:'switch',cross:'clear',shoot:'tackle'})[kind]??kind;
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
  $('pause-button').textContent=engine.state==='PAUSED'?'▶':'II';$('pause-button').setAttribute('aria-label',engine.state==='PAUSED'?'Resume match':'Pause match');
  const p=engine.controlledPlayer;
  $('controlled-label').textContent=started?(mode==='manager'?'MANAGER VIEW':`#${p?.number??''} ${(p?.name??'').toUpperCase()}`):'BAKU ATHLETIC';
  $('action-hint').textContent=engine.restart?`${engine.restart.type.replaceAll('_',' ')} · aim + pass / cross`:mode==='manager'?'Your tactics. Their movement.':engine.selectedTarget!==null?`TARGET #${engine.players[engine.selectedTarget]?.number}`:'Click a teammate to choose a receiver';
  const defending=isDefending();
  const controlLabels={pass:[defending?'PRESS':'PASS','J'],through:[defending?'SWITCH':'THROUGH','U'],cross:[defending?'CLEAR':'CROSS','L'],shoot:[defending?'TACKLE':'SHOOT','K']};
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
    if(engine.state==='FULL_TIME'&&finishedSaved!==engine.matchId){recordResult(save,engine);save.suspended=null;finishedSaved=engine.matchId;persist(false);}
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
