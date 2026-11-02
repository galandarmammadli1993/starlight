import { MatchEngine } from './engine.mjs';
import { PitchRenderer } from './renderer.mjs';
import { loadSave, saveData, captureMatch, restoreMatch, recordResult, exportSave, importSave } from './storage.mjs';
import { ensureCareers, getCareerView, getPlayerAttributes, getManagerAttributes, careerAction, setTrainingFocus, setManagerPlan } from './career.mjs';

import { renderManagerDashboard } from './manager-ui.mjs';
import { ensureManagerSimulation, managerDecision, managerMatchOptions, refreshManagerPsychology } from './manager-session.mjs';
import { renderPlayerDashboard } from './player-ui.mjs';
import { ensurePlayerSimulation, playerDecision, playerMatchOptions, beginPlayerSession } from './player-session.mjs';
import { advanceSimulation } from './game-loop.mjs';

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
let managerSpeed = 1;
let talkContinue = null;
let pendingSubSlot = null;
let playerWatchSpeed=1;
let shotAimActive=false;
let shotDrag=null;
const keys = new Set();
const charges = new Map();
const input = { x:0, y:0, sprint:false, press:false, shield:false };
let joy = {x:0,y:0};
let touchSprint = false;
let touchPress = false;
const canvas = $('pitch');
const renderer = new PitchRenderer(canvas);

function currentPlayer(){return ensureCareers(save).player;}
function currentManager() { return ensureCareers(save).manager; }
function options() {
  const base = { halfMinutes:save.profile.halfMinutes, position:save.profile.position, formation:save.profile.formation, mode };
  if(mode==='manager') {
    const prepared=managerMatchOptions(currentManager());
    if(prepared.ok)return {...base,...prepared.options};
    return {...base,formation:currentManager().formation};
  }
  if(mode==='player'){const prepared=playerMatchOptions(currentPlayer(),save.profile);if(prepared.ok)return {...base,...prepared.options};}
  return {...base,...(mode==='player'?{playerAttributes:getPlayerAttributes(save)}:{})};
}
function updateManagerMental() {
  const world=ensureManagerSimulation(currentManager());
  refreshManagerPsychology(world);
  if(started&&mode==='manager')engine.updateManagerMentalState(world.players.filter(p=>p.clubId===world.userClubId));
}
function executeManagerCommand(action,payload={}) {
  if(suspendedFor('manager')&&!started&&!['tactic','coach_style'].includes(action))return {ok:false,message:'Davam edən matç var. Əvvəlcə “Matça keç” ilə onu tamamla.'};
  const result=managerDecision(currentManager(),action,payload);
  if(result.ok){updateManagerMental();const saved=persist(started);renderCareer();if(!saved)toast('Dəyişiklik tətbiq edildi, yaddaşa yazılmadı. “Yaddaşı çıxar” ilə surət götür.');}
  else toast(result.message);
  return result;
}
function exportProgress() {
  persist();const data=exportSave(save);
  if(!data){toast('Yaddaş faylı hazırlana bilmədi.');return;}
  const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='footba11-heroes-save.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function executePlayerCommand(action,payload={}) {
  if(suspendedFor('player'))return {ok:false,message:'Saxlanmış matç davam edir. Əvvəlcə onu tamamla.'};
  const result=playerDecision(currentPlayer(),save.profile,action,payload);
  if(result.ok&&action==='appearance'&&payload.field==='jerseyNumber')save.profile.shirtNumber=Number(payload.value);
  if(result.ok){const ok=persist(false);profileUI();renderCareer();if(!ok)toast('Dəyişiklik yaddaşa yazılmadı. Yaddaş faylını çıxar.');}
  else toast(result.message);
  return result;
}
function requestPlayerPlay(){
  if(suspendedFor('player')){launchMatch();return;}
  const prepared=playerMatchOptions(currentPlayer(),save.profile);
  if(!prepared.ok){toast(prepared.message);return;}
  const result=beginPlayerSession(currentPlayer(),save.profile);
  if(!result.ok){toast(result.message);return;}
  launchMatch();persist();
}
function playerCanControl(){return mode!=='player'||!engine.hasPlayerCareerRoster||engine.playerCareerStatus==='playing';}

function requestManagerPlay() {
  if(suspendedFor('manager')){launchMatch();return;}
  const prepared=managerMatchOptions(currentManager());
  if(!prepared.ok){toast(prepared.message);return;}
  showManagerTalk('pre_match',()=>{
    const result=managerDecision(currentManager(),'begin_match',{fixtureId:prepared.fixture.id});
    if(!result.ok){toast(result.message);return;}
    launchMatch();
  });
}
function showManagerTalk(phase,after=null) {
  if(document.querySelector('dialog[open]'))return;
  const manager=currentManager(),world=ensureManagerSimulation(manager);
  const fixtureId=started?engine.options.managerFixtureId:managerMatchOptions(manager).fixture?.id;
  if(!fixtureId){toast('Danışıq üçün matç tapılmadı.');return;}
  const title={pre_match:'Oyundan əvvəl soyunub-geyinmə otağı',half_time:'Fasilə çıxışı',post_match:'Oyundan sonra komanda ilə söhbət'}[phase];
  $('team-talk-title').textContent=title;
  $('team-talk-context').textContent=started?`${engine.score.join(' – ')} · Hər futbolçu yaşına, xarakterinə və sənə etimadına uyğun reaksiya verir.`:'Üslubunu seç. Gənclər, təcrübəlilər və ulduzlar eyni sözləri fərqli qəbul edir.';
  $('team-talk-result').replaceChildren();
  const already=world.psychology.talkKeys.includes(`${fixtureId}:${phase}`);
  const choices=[['calm','Sakit danış','Gərginliyi azalt, fikri oyuna yönəlt.'],['supportive','Dəstək ver','Özünəinamı qaldır, gəncləri sakitləşdir.'],['inspire','Ruhlandır','İddialı oyunçulara məqsədi xatırlat.'],['tactical','Taktikanı izah et','Tapşırıqları dəqiqləşdir, diqqəti topla.'],['demanding','Tələbkar ol','Peşəkarları səfərbər et; etimadı zəif olanları sıxa bilər.'],['angry','Sərt və əsəbi danış','Qorxu və narazılıq yarada bilər; vəziyyət və münasibət həlledicidir.']];
  $('team-talk-choices').replaceChildren();
  for(const [style,label,description] of choices){
    const button=document.createElement('button');button.type='button';button.dataset.talkStyle=style;button.disabled=already;
    const b=document.createElement('b');b.textContent=label;const small=document.createElement('small');small.textContent=description;button.append(b,small);
    button.addEventListener('click',()=>{
      const result=managerDecision(currentManager(),'team_talk',{phase,style,context:{fixtureId,score:started?[...engine.score]:[0,0]}});
      updateManagerMental();const saved=persist(started);
      $('team-talk-result').replaceChildren();
      const message=document.createElement('p');message.textContent=result.message; $('team-talk-result').append(message);
      const effects=document.createElement('ul');for(const effect of (result.effects??[]).slice(0,12)){const item=document.createElement('li');item.textContent=effect;effects.append(item);}$('team-talk-result').append(effects);
      if(result.ok)$('team-talk-choices').querySelectorAll('button').forEach(b=>b.disabled=true);
      if(!saved)toast('Çıxış tətbiq edildi, yaddaşa yazılmadı. Yaddaşın surətini çıxar.');
    });
    $('team-talk-choices').append(button);
  }
  if(already)$('team-talk-result').textContent='Bu mərhələdə çıxış artıq edilib. Təsiri saxlanılır.';
  const defaultStyle=world.psychology.policies.coachStyle;
  const defaultLabel=choices.find(([style])=>style===defaultStyle)?.[1]??'Dəstək ver';
  $('team-talk-context').append(document.createTextNode(` Seçim etmədən davam etsən, saxladığın “${defaultLabel}” üslubu tətbiq ediləcək.`));
  talkContinue=()=>{
    const current=ensureManagerSimulation(currentManager());
    if(!current.psychology.talkKeys.includes(`${fixtureId}:${phase}`)){
      managerDecision(currentManager(),'team_talk',{phase,context:{fixtureId,score:started?[...engine.score]:[0,0]}});
      updateManagerMental();persist(started);
    }
    after?.();
  };
  $('team-talk-continue').textContent=phase==='pre_match'?'Meydana çıx →':phase==='half_time'?'İkinci hissəyə başla →':'Bağla';
  $('team-talk-dialog').showModal();
}
function showSubstitution(slot) {
  const effective=engine.state==='PAUSED'?engine.previousState:engine.state;
  if(!started||!engine.hasPersistentRoster)return;
  if(effective==='IN_PLAY'||['PRE_MATCH','FULL_TIME','GOAL_CELEBRATION'].includes(effective)){toast('Top dayananda və ya fasilədə əvəzetmə et.');return;}
  if(engine.substitutions>=5){toast('Beş əvəzetmə limitinə çatmısan.');return;}
  const player=engine.players[slot];pendingSubSlot=slot;
  $('substitution-context').textContent=`${engine.clock.display} · ${player.name}. Səbəb və danışıq üslubu onun reaksiyasını dəyişəcək.`;
  $('bench-player').replaceChildren();
  for(const p of engine.bench){const option=document.createElement('option');option.value=p.persistentId??p.id;option.textContent=`#${p.number} ${p.name} · ${p.role} · hazırlıq ${Math.round(p.fitness)}`;$('bench-player').append(option);}
  if(!engine.bench.length){toast('Uyğun ehtiyat oyunçusu qalmayıb.');return;}
  openDialog('substitution-dialog');
}

function suspendedFor(selectedMode=mode){return save.suspendedByMode[selectedMode];}
function storeSuspended(snapshot){save.suspendedByMode[mode]=snapshot;save.suspended=snapshot;}
function makeMatch() {
  const next = new MatchEngine(options());
  next.cameraMode=mode==='player'?'close':'broadcast';
  if(mode==='manager')next.setTactic(getCareerView(save,'manager').tactic);
  next.matchId = next.options.playerFixtureId?`player-live-${next.options.playerFixtureId}`:next.options.managerFixtureId ? `live-${next.options.managerFixtureId}` : (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
  all('button[data-mode]').forEach(button=>button.classList.toggle('selected',button.dataset.mode===mode));
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
function startMatch() { if(mode==='player'){requestPlayerPlay();return;}if(mode==='manager'){requestManagerPlay();return;}launchMatch(); }
function launchMatch() {
  const saved=suspendedFor()?restoreMatch(suspendedFor()):null;
  engine=saved??makeMatch();
  engine.cameraMode??=mode==='player'?'close':'broadcast';
  engine.kitColor=save.profile.kitColor;
  engine.debug=import.meta.env.DEV && new URLSearchParams(location.search).has('debug');
  started=true;
  finishedSaved=null;
  document.body.classList.add('playing');
  updateModeLayout();
  $('page-heading').textContent=mode==='player'?'Your career. Your moment.':mode==='manager'?'From the touchline.':'Matchday is here.';
  $('match-context').textContent=mode==='manager'?`BAŞ MƏŞQÇİ / ${(engine.options.playerUserIsHome??engine.options.managerUserIsHome)===false?'SƏFƏR MATÇI':'BAKU PARK'}`:mode==='player'?`FUTBOLÇU KARYERASI / ${engine.options.playerClubName??'BAKU PARK'}`:'EXHIBITION / BAKU PARK';
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
  let saved=true;
  if(started) {
    if(engine.state==='FULL_TIME') { recordResult(save,engine); storeSuspended(null); }
    else { engine.pause(); storeSuspended(captureMatch(engine)); }
    saved=persist(false);
  }
  started=false;shotAimActive=false;shotDrag=null;$('shot-aim-guide').hidden=true;$('aim-shot-button').setAttribute('aria-pressed','false'); keys.clear();charges.clear();joy={x:0,y:0};touchSprint=touchPress=false;
  document.body.classList.remove('playing');
  $('page-heading').textContent='Let’s play football.';
  $('match-context').textContent='EXHIBITION / BAKU PARK';
  $('pause-button').disabled=true;
  $('match-message').classList.remove('visible');
  chooseMode(mode);
  renderer.resize();
  return saved;
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
  const personal=ensureCareers(save).player;
  if(personal.journey&&!personal.journey.positions.includes($('player-role').value)){toast('Bu mövqeni əvvəlcə futbolçu karyerasının məşq bölməsində inkişaf xalı ilə aç.');return;}
  if(personal.journey){personal.journey.activePosition=$('player-role').value;ensurePlayerSimulation(personal,save.profile).life.appearance.jerseyNumber=Number($('shirt-number').value);}
  save.profile={...save.profile,name:$('player-name').value.trim()||'Alex Hero',position:$('player-role').value,shirtNumber:Number($('shirt-number').value),halfMinutes:Number($('half-minutes').value),kitColor:$('kit-color').value};
  if(engine)engine.kitColor=save.profile.kitColor;
  profileUI();persist();$('settings-dialog').close();
  if(!started)chooseMode(mode);
  toast('Profile saved. Match length applies to your next match.');
});
all('button[data-mode]').forEach(button=>button.addEventListener('click',()=>chooseMode(button.dataset.mode)));
all('[data-nav]').forEach(button=>button.addEventListener('click',()=>{
  const value=button.dataset.nav;
  if(value==='settings'){openDialog('settings-dialog');return;}
  if(value==='club'){openDialog('club-dialog');return;}
  chooseMode(value==='play'?'quick':value);
}));
$('save-button').addEventListener('click',()=>toast(persist()?'Your profile and match are saved on this device.':'Browser storage is unavailable. Your game is still playable.'));
$('menu-button').addEventListener('click',()=>{const ok=returnMenu();toast(ok?'Gedişat saxlanıldı. Karyera və matç buradadır.':'Yaddaşa yazılmadı. Karyeradan yaddaş faylını çıxar.');});
$('pause-button').addEventListener('click',togglePause);
$('kickoff-button').addEventListener('click',()=>{
  if(!started){startMatch();return;}
  if(engine.state==='FULL_TIME'){if(mode==='manager'||mode==='player'){returnMenu();return;}storeSuspended(null);started=false;startMatch();return;}
  if(engine.state==='HALF_TIME'&&mode==='manager'){showManagerTalk('half_time',()=>{engine.continueMatch();lastFrame=0;updateUI();});return;}
  engine.continueMatch();lastFrame=0;updateUI();
});
$('fullscreen-button').addEventListener('click',async()=>{
  try { if(document.fullscreenElement)await document.exitFullscreen();else await $('pitch-wrap').closest('.match-card').requestFullscreen(); }
  catch {toast('Full screen is not supported in this browser.');}
});
$('camera-toggle').addEventListener('click',()=>{
  engine.cameraMode=engine.cameraMode==='close'?'broadcast':'close';
  $('camera-toggle').setAttribute('aria-pressed',String(engine.cameraMode==='close'));
  $('camera-toggle').textContent=engine.cameraMode==='close'?'Geniş baxış':'Yaxın baxış';
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
  $('career-hub').hidden=true;
  $('player-dashboard').hidden=!(careerMenu&&mode==='player');
  $('manager-dashboard').hidden=!(careerMenu&&mode==='manager');
  $('home-intro').hidden=mode!=='quick';
  $('match-heading-row').hidden=careerMenu;
  document.querySelector('.match-layout').hidden=careerMenu;
  $('touch-controls').hidden=mode==='manager';
  $('offball-panel').hidden=!started||mode==='manager';
  $('manager-controls').hidden=mode!=='manager';
  $('target-button').hidden=mode==='manager';
  $('tactical-management').hidden=mode==='player';
  $('player-match-summary').hidden=mode!=='player';
  document.querySelector('[data-panel="tactics"]').textContent=mode==='player'?'MY PLAYER':'TACTICS';
  document.querySelectorAll('[data-action="switch"]').forEach(button=>button.hidden=mode==='player');
  $('formation').disabled=$('tactic').disabled=mode==='player';
  $('page-heading').textContent=started?(mode==='manager'?'From the touchline.':mode==='player'?'Your career. Your moment.':'Matchday is here.'):(mode==='player'?'The life of a footballer.':mode==='manager'?'Your club. Your decisions.':'Let’s play football.');
  document.querySelector('.match-bottom>span').textContent=mode==='manager'?'Choose your approach, manage the squad and watch your plan unfold.':mode==='player'?'W A S D Hərəkət · R Top istə · J Ötür · K Vur':'W A S D Move · J Pass · K Shoot · X One-two';
}
function renderCareer(){
  if(mode==='quick')return;
  if(mode==='manager'){
    const manager=currentManager(),world=ensureManagerSimulation(manager);
    renderManagerDashboard($('manager-dashboard'),{manager,world,onCommand:executeManagerCommand,onPlay:requestManagerPlay,onSimulate:()=>{const result=executeManagerCommand('simulate');if(result.ok)toast(result.message);},onExport:exportProgress,onImport:()=>$('import-save-file').click()});
    return;
  }
  const player=currentPlayer(),journey=ensurePlayerSimulation(player,save.profile);
  playerMatchOptions(player,save.profile);
  renderPlayerDashboard($('player-dashboard'),{player,journey,profile:save.profile,hasSuspended:!!suspendedFor('player'),onCommand:executePlayerCommand,onPlay:requestPlayerPlay,onSimulate:()=>{const result=executePlayerCommand('simulate');if(result.ok)toast(result.message);},onExport:exportProgress,onImport:()=>$('import-save-file').click()});
}
$('career-play').addEventListener('click',startMatch);
$('career-resume').addEventListener('click',()=>{storeSuspended(null);persist(false);startMatch();});
all('[data-manager-tactic]').forEach(button=>button.addEventListener('click',()=>{if(mode!=='manager')return;engine.setTactic(button.dataset.managerTactic);setManagerPlan(save,{tactic:button.dataset.managerTactic});persist();updateUI();}));
$('manager-squad').addEventListener('click',()=>{document.querySelector('[data-panel="tactics"]').click();document.querySelector('.match-panel').scrollIntoView({behavior:'smooth',block:'nearest'});});
$('manager-speed').addEventListener('change',()=>{managerSpeed=Number($('manager-speed').value);});
$('manager-talk-button').addEventListener('click',()=>{
  if(mode!=='manager'||!started)return;
  const state=engine.state==='PAUSED'?engine.previousState:engine.state;
  if(state==='HALF_TIME')showManagerTalk('half_time',()=>{if(engine.state==='PAUSED')engine.resume();engine.continueMatch();lastFrame=0;updateUI();});
  else if(state==='FULL_TIME')showManagerTalk('post_match');
  else toast('Komanda çıxışı fasilədə və oyundan sonra mümkündür. Taktiki əmrləri indi dəyişə bilərsən.');
});
$('team-talk-continue').addEventListener('click',()=>{
  const after=talkContinue;talkContinue=null;$('team-talk-dialog').close();after?.();
});
$('confirm-substitution').addEventListener('click',()=>{
  if(pendingSubSlot===null)return;
  const outgoing=engine.players[pendingSubSlot]?.persistentId,incoming=$('bench-player').value;
  const reason=$('substitution-reason').value,style=$('substitution-style').value,minute=engine.matchMinute;
  if(!engine.substitute(pendingSubSlot,incoming,reason)){toast('Əvəzetmə yalnız top dayananda mümkündür. Beş dəyişiklik və qırmızı kart qaydaları qüvvədədir.');return;}
  engine.substitutionEvents.at(-1).style=style;
  const result=managerDecision(currentManager(),'substitution',{outgoingId:outgoing,incomingId:incoming,minute,reason,style,context:{fixtureId:engine.options.managerFixtureId}});
  updateManagerMental();lastLineupSignature='';const saved=persist();
  pendingSubSlot=null;$('substitution-dialog').close();updateUI();toast(saved?result.message:'Əvəzetmə edildi, yaddaşa yazılmadı. Yaddaşın surətini çıxar.');
});
$('import-save-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  if(file.size>8*1024*1024){toast('Yaddaş faylı çox böyükdür.');return;}
  const imported=importSave(await file.text());
  if(!imported){toast('Bu fayl etibarlı Footba11 Heroes yaddaşı deyil.');return;}
  if(!saveData(imported)){toast('Yaddaş qəbul edildi, amma brauzerə yazıla bilmir. Mövcud oyun saxlanıldı.');return;}
  const importedMode=mode==='player'?'player':'manager';save=imported;started=false;document.body.classList.remove('playing');profileUI();chooseMode(importedMode);toast('Karyeralar və saxlanmış matçlar fayldan bərpa edildi.');
});
all('[data-panel]').forEach(button=>button.addEventListener('click',()=>{
  all('[data-panel]').forEach(b=>b.classList.toggle('active',b===button));
  ['tactics','stats','events'].forEach(name=>$(`panel-${name}`).hidden=name!==button.dataset.panel);
  updateUI();
}));

function cycleTarget() {
  if(!playerCanControl()||mode==='manager')return;
  const players=engine.players.filter(p=>p.team===0&&!p.sentOff&&p.id!==engine.controlled);
  const current=players.findIndex(p=>p.id===engine.selectedTarget);
  const target=players[(current+1)%players.length];
  if(target){engine.selectTarget(target.id);toast(`Receiver: #${target.number} ${target.name}`);}
}
$('target-button').addEventListener('click',cycleTarget);
$('player-watch-speed').addEventListener('change',()=>{playerWatchSpeed=Number($('player-watch-speed').value);});
$('aim-shot-button').addEventListener('click',()=>{
  if(!started||mode!=='player'||!playerCanControl())return;
  shotAimActive=!shotAimActive;$('aim-shot-button').setAttribute('aria-pressed',String(shotAimActive));
  $('shot-aim-settings').hidden=!shotAimActive;
  if(shotAimActive)toast('Top səndəykən meydanda hədəfə doğru sürüşdür. Uzun sürüşdürmə zərbənin gücünü artırır.');
});
canvas.addEventListener('pointerdown',event=>{
  if(!started||mode==='manager'||!playerCanControl())return;
  if(shotAimActive&&mode==='player'){
    if(engine.ball.owner!==engine.careerPlayer){toast('Nişan almaq üçün top səndə olmalıdır.');return;}
    shotDrag={x:event.clientX,y:event.clientY,pointerId:event.pointerId};canvas.setPointerCapture(event.pointerId);event.preventDefault();return;
  }
  const point=renderer.screenToWorld(event.clientX,event.clientY);
  if(!point||point.x<0||point.x>105||point.y<0||point.y>68)return;
  const target=engine.players.filter(p=>p.team===0&&!p.sentOff&&p.id!==engine.controlled).sort((a,b)=>Math.hypot(a.x-point.x,a.y-point.y)-Math.hypot(b.x-point.x,b.y-point.y))[0];
  if(target&&Math.hypot(target.x-point.x,target.y-point.y)<4)engine.selectTarget(target.id);
  canvas.focus({preventScroll:true});
});
canvas.addEventListener('pointermove',event=>{
  if(!shotDrag||event.pointerId!==shotDrag.pointerId)return;
  const bounds=canvas.getBoundingClientRect(),guide=$('shot-aim-guide');
  const dx=event.clientX-shotDrag.x,dy=event.clientY-shotDrag.y;
  guide.hidden=false;guide.style.left=`${shotDrag.x-bounds.left}px`;guide.style.top=`${shotDrag.y-bounds.top}px`;
  guide.style.width=`${Math.hypot(dx,dy)}px`;guide.style.transform=`rotate(${Math.atan2(dy,dx)}rad)`;
});
canvas.addEventListener('pointerup',event=>{
  if(!shotDrag||event.pointerId!==shotDrag.pointerId)return;
  const drag=shotDrag;shotDrag=null;$('shot-aim-guide').hidden=true;
  const distance=Math.hypot(event.clientX-drag.x,event.clientY-drag.y),aim=renderer.screenToWorld(event.clientX,event.clientY);
  if(distance<10||!aim)return;
  if(engine.ball.owner!==engine.careerPlayer){toast('Zərbə anında top səndə olmalıdır.');return;}
  fire('shoot',Math.min(1,Math.max(.25,distance/180)),{x:aim.x,y:aim.y,spin:Number($('shot-spin').value),contactY:Number($('shot-contact').value)});
});
canvas.addEventListener('pointercancel',()=>{shotDrag=null;$('shot-aim-guide').hidden=true;});
function isDefending(){return started&&engine.state==='IN_PLAY'&&engine.possessionTeam===1;}
function canAskTeammate(){const owner=engine.ball.owner;return started&&engine.state==='IN_PLAY'&&owner!==null&&owner!==engine.controlled&&engine.players[owner]?.team===0;}
function fire(kind,power=.6,explicitAim=null) {
  if(!started||mode==='manager'||!playerCanControl()||engine.state==='PAUSED'||document.querySelector('dialog[open]'))return;
  if(isDefending())kind=({pass:'press',through:mode==='player'?'tackle':'switch',cross:'clear',shoot:'tackle'})[kind]??kind;
  if(kind==='pass'&&canAskTeammate())kind='call';
  if(kind==='press')return;
  let aim=explicitAim;
  if(!aim&&engine.restart&&engine.restart.type!=='KICK_OFF'&&Math.hypot(input.x,input.y)>.1){
    const d=Math.hypot(input.x,input.y),b=engine.ball;
    aim=kind==='shoot'?{x:engine.directions[0]===1?106:-1,y:34+input.y*2.6}:{x:b.x+input.x/d*25,y:b.y+input.y/d*25};
  }
  const success=engine.action(kind,power,aim);
  if(success&&kind==='shoot'){shotAimActive=false;$('aim-shot-button').setAttribute('aria-pressed','false');$('shot-aim-guide').hidden=true;}
  if(kind==='call')updateUI();
  if(!success&&kind==='call')toast(engine.getPassCallStatus?.().message??'Boş yerə çıxıb yenidən topu istə.');
  if(!success&&kind!=='switch'&&kind!=='call'&&engine.state==='IN_PLAY'){
    const owner=engine.ball.owner!==null?engine.players[engine.ball.owner]:null;
    if(owner?.team!==0)toast('Win the ball first. Move closer, press or tackle.');
  }
  updateUI();
}
$('call-ball-button').addEventListener('click',()=>fire('call'));
const actionKeys={KeyR:'call',KeyJ:'pass',Space:'pass',KeyK:'shoot',KeyL:'cross',KeyU:'through',KeyF:'tackle',KeyQ:'switch',KeyX:'oneTwo',KeyZ:'skill',KeyC:'clear'};
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
    if(['switch','tackle','skill','call'].includes(actionKeys[event.code]))fire(actionKeys[event.code]);
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
    sub.addEventListener('click',()=>{if(mode==='manager'&&engine.hasPersistentRoster){showSubstitution(player.id);return;}if(engine.substitute(player.id)){lastLineupSignature='';persist();updateUI();toast('Substitution made. Fresh legs on the pitch.');}else toast('Substitutions are available during stoppages. Maximum five.');});
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
function renderOffBall(){
  if(!started||mode==='manager')return;
  const call=engine.getPassCallStatus?.()??{status:'idle',enabled:canAskTeammate(),message:''};
  const titles={idle:'Boş yerə çıx, sonra topu istə',waiting:'ÖTÜRMƏ İSTƏNDİ',blocked:call.reason==='offside'?'OFSAYDDAN ÇIX':'ÖTÜRMƏ YOLU BAĞLIDIR',passed:'ÖTÜRMƏ SƏNƏ GƏLİR',received:'TOPU ALDIN',own_ball:'TOP SƏNDƏDİR',opponent:'TOP RƏQİBDƏDİR',loose:'TOP SƏRBƏSTDİR',expired:'Yenidən top istəyə bilərsən',unavailable:'Oyunun davamını gözlə'};
  const descriptions={idle:'1. Boş yerə çıx  →  2. TOP İSTƏ / R  →  3. Ötürməyə hazır ol',waiting:'Əlini qaldırdın. Müdafiəçidən uzaqlaş və ötürmə yolunu aç.',blocked:'Müdafiəçidən uzaqlaş. Yol açılarsa komanda yoldaşın ötürəcək.',passed:'Topun yoluna çıx. İlk toxunuşa hazır ol.',received:'J: ötürmə · K: zərbə · L: kross · Shift: sürətli qaçış',own_ball:'J: ötürmə · K: zərbə · L: kross · Shift: sürətli qaçış',opponent:'J ilə pres et, F ilə müdaxilə et. Komandan topu alanda ötürmə istəyə bilərsən.',loose:'Topa doğru hərəkət et. Topu almaq üçün ona yaxınlaş.',expired:'Yeni boşluq tap və TOP İSTƏ / R ilə yenidən çağır.',unavailable:'Fasilə və ya restart bitdikdən sonra top istəyə bilərsən.'};
  $('offball-panel').dataset.state=call.status;
  const key=`${call.status}/${call.message}/${call.reason}`;
  if($('offball-title').dataset.key!==key){
    $('offball-title').dataset.key=key;
    $('offball-title').textContent=titles[call.status]??titles.idle;
    $('offball-description').textContent=call.message||descriptions[call.status]||descriptions.idle;
    $('offball-eyebrow').textContent=['waiting','blocked'].includes(call.status)?'İSTƏYİN KOMANDA YOLDAŞINA ÇATDI':'TOPSUZ OYUN KÖMƏKÇİSİ';
  }
  $('call-ball-button').disabled=!call.enabled;
  const label=['waiting','blocked'].includes(call.status)?'İSTƏK AKTİVDİR':call.status==='passed'?'TOP YOLDADIR':'TOP İSTƏ';
  const buttonCopy=$('call-ball-button').lastElementChild;
  if(buttonCopy.dataset.label!==label){buttonCopy.dataset.label=label;buttonCopy.innerHTML=`${label} <kbd>R</kbd>`;}
  const pending=['waiting','blocked'].includes(call.status);
  $('request-meter').hidden=!pending;
  if(pending)$('request-meter-fill').style.width=`${Math.max(0,Math.min(100,((call.expires??engine.time)-engine.time)/3*100))}%`;
}
function updateUI(){
  if(!engine)return;
  const hasHero=started&&mode==='player'&&engine.hasPlayerCareerRoster;
  const active=playerCanControl(),playerStatus=engine.playerCareerStatus;
  $('player-coach-status').hidden=!(started&&mode==='player');
  $('player-coach-copy').textContent=hasHero&&!active?({bench:`Ehtiyatdasan. Məşqçi ${engine.playerCoachEntryMinute??60}-cı dəqiqədən sonra top dayananda səni meydana buraxa bilər.`,omitted:'Bu matçın heyətində deyilsən. Komandanı izləyirsən; digər futbolçuları idarə edə bilməzsən.',substituted:`Məşqçi səni əvəzlədi. Səbəb: ${engine.playerCoachSubstitutionReason??'taktiki qərar'}. Şəxsi dəqiqələrin hesabatda saxlanılır.`,sent_off:'Qırmızı kart aldın. Bu matçda artıq meydana qayıda bilməzsən.'}[playerStatus]??'Məşqçinin qərarını gözləyirsən.'):'Yalnız öz futbolçunu idarə edirsən. TOP İSTƏ / R ilə ötürmə istə; NİŞANLA VƏ VUR ilə hədəf seç.';
  $('player-watch-label').hidden=active;
  $('aim-shot-button').hidden=!active;
  $('aim-shot-button').disabled=!active||engine.ball.owner!==engine.careerPlayer;
  $('touch-controls').hidden=mode==='manager'||(mode==='player'&&!active);
  $('offball-panel').hidden=!started||mode==='manager'||(mode==='player'&&!active);
  $('shot-aim-settings').hidden=!(started&&mode==='player'&&active&&shotAimActive);
  $('home-team-name').textContent=engine.options.playerClubName??engine.options.managerUserName??'BAKU ATHLETIC';
  $('away-team-name').textContent=engine.options.playerOpponentName??engine.options.managerOpponentName??'COAST UNITED';
  for(const [selector,name] of [['.home-crest',$('home-team-name').textContent],['.away-crest',$('away-team-name').textContent]])document.querySelector(selector).firstChild.nodeValue=name.split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
  $('user-venue-label').textContent=(engine.options.playerUserIsHome??engine.options.managerUserIsHome)===false?'SƏFƏR':'EV';
  $('opponent-venue-label').textContent=`${(engine.options.playerUserIsHome??engine.options.managerUserIsHome)===false?'EV':'SƏFƏR'} · 4-3-3`;
  const talkState=engine.state==='PAUSED'?engine.previousState:engine.state;
  $('manager-talk-button').textContent=talkState==='HALF_TIME'?'FASİLƏ ÇIXIŞI':talkState==='FULL_TIME'?'OYUNDAN SONRA DANIŞ':'ÇIXIŞ ET';
  $('manager-talk-button').disabled=!['HALF_TIME','FULL_TIME'].includes(talkState);
  $('manager-talk-summary').hidden=!(started&&mode==='manager'&&['HALF_TIME','FULL_TIME'].includes(talkState));
  if(!$('manager-talk-summary').hidden)$('manager-talk-summary').textContent=talkState==='HALF_TIME'?'Fasilədir. “FASİLƏ ÇIXIŞI” ilə üslubunu seç, “HEYƏT ⇄” ilə əvəzetmə et.':'Matç bitdi. Komanda ilə danışa və karyera qərargahına qayıda bilərsən.';
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
  $('controlled-label').textContent=started?(mode==='manager'?'MANAGER VIEW':mode==='player'&&!active?'MƏŞQÇİNİN QƏRARI':`#${p?.number??''} ${(p?.name??'').toUpperCase()}`):'BAKU ATHLETIC';
  $('action-hint').textContent=mode==='manager'?'Your tactics. Their movement.':engine.restart?`${engine.restart.type.replaceAll('_',' ')} · restart`:engine.selectedTarget!==null?`TARGET #${engine.players[engine.selectedTarget]?.number}`:mode==='player'?'R / TOP İSTƏ · yalnız öz oyunçun':'Click a teammate to choose a receiver';
  if(mode==='player'){
    const own=active?engine.players[engine.careerPlayer]:null,report=engine.hasPlayerCareerRoster?engine.playerMatchReport?.hero:null,summary=$('player-match-summary');
    const key=`${own?.name}/${own?.role}/${Math.round(own?.stamina??0)}/${report?.goals??engine.playerGoals?.[engine.careerPlayer]??0}/${playerStatus}/${Math.floor(report?.minutes??0)}`;
    if(summary.dataset.key!==key){
      summary.dataset.key=key;summary.replaceChildren();
      const heading=document.createElement('h3');heading.textContent=save.profile.name;
      const role=document.createElement('p');role.className='panel-note';role.textContent=active?`${own?.role} · #${own?.number}`:'Məşqçinin qərarını və komandanı izləyirsən.';
      const stats=document.createElement('div');stats.className='player-match-stat';stats.textContent=`${Math.round(report?.minutes??0)}′ · ${report?.goals??engine.playerGoals?.[engine.careerPlayer]??0} qol · ${report?.assists??0} assist · Reytinq ${(report?.rating??6).toFixed(1)}`;
      const readiness=document.createElement('p');readiness.className='panel-note';readiness.textContent=active?`Enerji ${Math.round(own?.stamina??0)}%. Mövqe tut, komandanın tapşırığını yerinə yetir.`:'Meydanı izləmə sürətini artıraraq növbəti fürsətə keçə bilərsən.';
      summary.append(heading,role,stats,readiness);
    }
  }
  const defending=isDefending();
  const controlLabels={pass:[defending?'PRES':canAskTeammate()?'TOP İSTƏ':'ÖTÜR','J'],through:[defending?(mode==='player'?'MÜDAXİLƏ':'DƏYİŞ'):'ARA ÖTÜRMƏ','U'],cross:[defending?'UZAQLAŞDIR':'KROSS','L'],shoot:[defending?'MÜDAXİLƏ':'VUR','K']};
  for(const [action,[label,key]] of Object.entries(controlLabels)){const b=document.querySelector(`[data-action="${action}"]`);if(b.dataset.label!==label){b.innerHTML=`${label} <kbd>${key}</kbd>`;b.dataset.label=label;}}
  if(started){
    const show=['PAUSED','HALF_TIME','FULL_TIME'].includes(engine.state);$('match-overlay').hidden=!show;
    if(show){
      const paused=engine.state==='PAUSED',half=engine.state==='HALF_TIME';
      $('overlay-eyebrow').textContent=paused?'TAKE A BREATHER':half?'A GAME OF TWO HALVES':'THE FINAL WHISTLE';
      $('overlay-title').textContent=paused?'We’ll hold the play.':half?'Half-time. Reset. Go again.':`${engine.score[0]} – ${engine.score[1]} · ${engine.score[0]===engine.score[1]?'Honours even.':engine.score[0]>engine.score[1]?'Your moment. Your win.':'Another lesson. Another match.'}`;
      $('overlay-description').textContent=paused?'Your clock is paused. Ready when you are.':half?'Teams switch ends. Change tactics or make a substitution.':'Your career result has been saved on this device.';
      if(engine.state==='FULL_TIME'&&mode==='quick')$('overlay-description').textContent='Exhibition complete. Ready for another match?';
      $('kickoff-button').innerHTML=`${paused?'RESUME MATCH':half?(mode==='manager'?'FASİLƏ ÇIXIŞI → İKİNCİ HİSSƏ':'SECOND HALF'):(mode==='manager'||mode==='player'?'KARYERA QƏRARGAHINA QAYIT':'PLAY AGAIN')} <span>→</span>`;
    }
    if(engine.notification!==lastNotification){lastNotification=engine.notification;$('match-message').textContent=lastNotification;messageUntil=performance.now()+3500;}
    $('match-message').classList.toggle('visible',!show&&performance.now()<messageUntil);
  }
  $('camera-toggle').setAttribute('aria-pressed',String(engine.cameraMode==='close'));
  $('camera-toggle').textContent=engine.cameraMode==='close'?'Geniş baxış':'Yaxın baxış';
  renderOffBall();renderLineup();if(!$('panel-stats').hidden)renderStats();renderFeed();
}

function frame(timestamp){
  const dt=lastFrame?(timestamp-lastFrame)/1000:0;lastFrame=timestamp;
  const kx=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
  const ky=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0);
  input.x=kx||joy.x;input.y=ky||joy.y;input.sprint=touchSprint||keys.has('ShiftLeft')||keys.has('ShiftRight');
  input.press=touchPress||(isDefending()&&(keys.has('KeyJ')||keys.has('Space')));input.shield=keys.has('KeyZ');
  if(started){
    advanceSimulation(engine,dt,input,mode==='manager'?managerSpeed:mode==='player'&&!playerCanControl()?playerWatchSpeed:1);autoSaveAge+=Math.min(dt,5);
    if(engine.state==='FULL_TIME'&&finishedSaved!==engine.matchId){recordResult(save,engine);storeSuspended(null);finishedSaved=engine.matchId;persist(false);}
    if(autoSaveAge>15){autoSaveAge=0;persist();}
  }
  renderer.render(engine,Math.min(dt,.1));
  if(timestamp-lastUI>150){lastUI=timestamp;updateUI();}
  requestAnimationFrame(frame);
}
window.addEventListener('pagehide',()=>persist());
profileUI();chooseMode(save.suspended?.options?.mode??'quick');requestAnimationFrame(frame);
if(save.recoveredFromBackup)toast('Əsas yaddaş zədələndiyi üçün əvvəlki sağlam surət bərpa edildi.');

// Inspectable only in local development; production has no public debug control.
if(import.meta.env.DEV)window.__football={get engine(){return engine;},get save(){return save;},playerDecision:(action,payload)=>executePlayerCommand(action,payload),managerDecision:(action,payload)=>executeManagerCommand(action,payload),startMatch,returnMenu,fire,renderer};
