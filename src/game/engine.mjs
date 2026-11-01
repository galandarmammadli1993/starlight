import { FIELD, detectBoundary, createOffsideSnapshot, offsideInvolvement, MatchClock, evaluateFoul, goalkeeperHandControl, restartDelaySanction } from './rules.mjs';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const length = (x,y) => Math.hypot(x,y);
const distance = (a,b) => length(a.x-b.x,a.y-b.y);
const other = team => 1-team;
const ACTIVE_RESTARTS = new Set(['KICK_OFF_SETUP','THROW_IN_SETUP','GOAL_KICK_SETUP','CORNER_KICK_SETUP','FREE_KICK_SETUP','PENALTY_SETUP','OFFSIDE_RESTART']);
const FORMATIONS = {'4-3-3':[4,3,3],'4-4-2':[4,4,2],'4-2-3-1':[4,5,1],'3-5-2':[3,5,2]};
const NAMES = ['Ward','Silva','Stone','Reid','Alba','Cole','Rivera','Park','Santos','Morgan','Blake'];

/** One authoritative, deterministic, fixed-step match simulation. Distances are metres, times seconds. */
export class MatchEngine {
  constructor(options={}) {
    this.options = {halfMinutes:12,mode:'quick',position:'MID',formation:'4-3-3',difficulty:'normal',...options};
    this.directions=[1,-1]; this.score=[0,0]; this.clock=new MatchClock(this.options.halfMinutes);
    this.players=[]; this.formation=this.options.formation; this.tactic='balanced'; this.controlled=6;
    this.state='PRE_MATCH'; this.previousState=null; this.stateAge=0; this.time=0; this.accumulator=0;
    this.stats={shots:[0,0],passes:[0,0],completed:[0,0],possession:[0,0],corners:[0,0],fouls:[0,0],offsides:[0,0]};
    this.eventLog=[]; this.notification='Welcome to Footba11 Heroes'; this.restart=null; this.selectedTarget=null;
    this.offside=null; this.restartOrigin=null; this.lastBoundary=null; this.lastDecision='Kick-off';
    this.substitutions=0; this.input={x:0,y:0,sprint:false,press:false,shield:false}; this.sequence=0;
    this.ball={x:52.5,y:34,z:FIELD.ballRadius,vx:0,vy:0,vz:0,owner:null,lastTouch:{team:0,playerId:9}};
    for(let team=0;team<2;team++) for(let i=0;i<11;i++) this.players.push({id:team*11+i,team,number:i+1,name:NAMES[(i+team*3)%11],role:i===0?'GK':'MID',x:0,y:0,vx:0,vy:0,homeX:0,homeY:0,stamina:100,sentOff:false,yellow:0,timer:.2+i*.07,faceX:team? -1:1,faceY:0,animation:'idle',animationTime:0,substituted:false});
    this._assignFormation();
    if(this.options.mode==='player') this.controlled=this.players.find(p=>p.team===0 && p.role===this.options.position)?.id??6;
    this.careerPlayer=this.controlled; this._setupRestart({type:'KICK_OFF',team:0,x:52.5,y:34});
  }
  _log(type,message,data={}) { this.notification=message; this.lastDecision=message; this.eventLog.unshift({id:++this.sequence,time:this.clock.display,type,message,...data}); if(this.eventLog.length>80)this.eventLog.pop(); }
  _state(state){this.state=state;this.stateAge=0;}
  _assignFormation(){
    for(let team=0;team<2;team++) {
      const teamFormation=team===0?this.formation:'4-3-3';
      const counts=FORMATIONS[teamFormation]??FORMATIONS['4-3-3'];
      let index=1; const keeper=this.players[team*11]; keeper.homeX=this.directions[team]===1?3:102; keeper.homeY=34;
      for(let line=0;line<3;line++) for(let j=0;j<counts[line];j++){
        const p=this.players[team*11+index++]; p.role=['DEF','MID','FWD'][line];
        const base=[24,43,67][line]; p.homeX=this.directions[team]===1?base:105-base;
        p.homeY=counts[line]===1?34:8+j*(52/(counts[line]-1));
        if(teamFormation==='4-2-3-1'&&line===1) {p.homeX=this.directions[team]===1?(j<2?37:57):(j<2?68:48);p.homeY=j<2?24+j*20:10+(j-2)*24;}
      }
    }
    // Formation changes move the career player's tactical slot, not their saved identity.
    if(this.options.mode==='player'&&this.careerPlayer!==undefined){
      const player=this.players[this.careerPlayer],slot=this.players.find(p=>p.team===0&&p.role===this.options.position&&p.id!==player?.id&&!p.sentOff);
      if(player&&player.role!==this.options.position&&slot){for(const key of ['role','homeX','homeY']){const value=player[key];player[key]=slot[key];slot[key]=value;}}
    }
  }
  setFormation(formation){if(!FORMATIONS[formation])return false;this.formation=formation;this._assignFormation();this._log('TACTIC',`Formation: ${formation}`);return true;}
  setTactic(tactic){if(!['balanced','press','wide','counter'].includes(tactic))return false;this.tactic=tactic;this._log('TACTIC',`Tactic: ${tactic}`);return true;}
  substitute(id=this.controlled){const p=this.players.find(p=>p.id===id&&p.team===0);if(!p||p.sentOff||p.substituted||this.substitutions>=5||(this.state==='PAUSED'?this.previousState:this.state)==='IN_PLAY')return false;p.stamina=100;p.substituted=true;p.name='Academy '+(this.substitutions+1);this.substitutions++;this._log('SUBSTITUTION',`${p.name} enters for #${p.number}`);return true;}
  selectTarget(id){const p=this.players.find(p=>p.id===id);if(p&&p.team===0&&!p.sentOff&&p.id!==this.controlled){this.selectedTarget=id;return true;}return false;}
  pause(){if(this.state==='PAUSED')return;this.previousState=this.state;this.pausedStateAge=this.stateAge;this._state('PAUSED');}
  resume(){if(this.state==='PAUSED'){const age=this.pausedStateAge??0;this._state(this.previousState??'IN_PLAY');this.stateAge=age;this.pausedStateAge=null;}}
  continueMatch(){
    if(this.state==='PAUSED'){this.resume();return;}
    if(this.state==='HALF_TIME'){this.clock.nextHalf();this.directions=this.directions.map(d=>-d);this._assignFormation();this._setupRestart({type:'KICK_OFF',team:1,x:52.5,y:34});return;}
    if(ACTIVE_RESTARTS.has(this.state))this._takeRestart('pass',.6);
  }
  get controlledPlayer(){return this.players.find(p=>p.id===this.controlled);}
  get possessionTeam(){return this.ball.owner!==null?this.players[this.ball.owner]?.team:this.ball.lastTouch?.team;}
  get offsideLine(){return this.offside?.line??null;}
  get offsideSnapshot(){return this.offside;}
  get matchMinute(){return Math.floor((this.clock.elapsed+(this.clock.half===2?2700:0))/60);}
  step(dt,input={}){
    if(!Number.isFinite(dt)||dt<=0||this.state==='PAUSED'||this.state==='FULL_TIME'||this.state==='HALF_TIME')return;
    this.input={x:0,y:0,sprint:false,press:false,shield:false,...input};
    const isStopped=this.state!=='IN_PLAY';
    const clockEvent=this.clock.tick(dt,false,isStopped);
    if(clockEvent){
      if(this.state==='PENALTY_SETUP'||this.penaltyInProgress||this.pendingRestart?.type==='PENALTY'&&this.state==='OUT_OF_PLAY')this.deferredClockEvent=clockEvent;
      else{this._endPeriod(clockEvent);return;}
    }
    // Physics uses an accumulator, never frame-dependent per-frame increments.
    this.accumulator+=Math.min(dt,2);
    while(this.accumulator>=1/60){this._fixedStep(1/60);this.accumulator-=1/60;}
  }
  _endPeriod(event){this.ball.vx=this.ball.vy=this.ball.vz=0;this.ball.owner=null;this.restart=null;this.pendingRestart=null;this.keeperHold=null;this.penaltyInProgress=false;this.deferredClockEvent=null;this._state(event);this._log(event,event==='HALF_TIME'?'Half-time · switch ends':'Full-time');}
  _fixedStep(dt){
    this.time+=dt;this.stateAge+=dt;
    for(const p of this.players){p.animationTime=Math.max(0,p.animationTime-dt);if(!p.animationTime)p.animation='run';}
    if(this.state==='OUT_OF_PLAY'){if(this.stateAge>.85)this._setupRestart(this.pendingRestart);return;}
    if(this.state==='GOAL_CELEBRATION'){if(this.stateAge>2.6)this._setupRestart(this.pendingRestart);return;}
    if(ACTIVE_RESTARTS.has(this.state)){
      if(this.state==='PENALTY_SETUP'&&this.restart.team===1&&this.options.mode==='quick'){const keeper=this.players[0];keeper.x=this.directions[0]===1?0:105;keeper.y=clamp(keeper.y+(this.input.y??0)*6*dt,30.4,37.6);}
      if(this.restart?.team===1||this.options.mode==='manager') {if(this.stateAge>1.7)this._takeRestart(this.restart.type==='CORNER_KICK'?'cross':'pass',.65);}
      else if(['THROW_IN','GOAL_KICK'].includes(this.restart?.type)&&this.stateAge>15){
        if(!this.delayWarned){this.delayWarned=true;this._log('DELAY','Referee: restart delayed · five-second countdown');}
        const sanction=restartDelaySanction({...this.restart,seconds:this.stateAge-15,refereeCounting:this.delayWarned,directions:this.directions});
        if(sanction){this._log('DELAY','Restart delay sanction');this._setupRestart(sanction);}
      }
      return;
    }
    if(this.state!=='IN_PLAY')return;
    this.stats.possession[this.possessionTeam??0]+=dt;
    this.kickCooldown=Math.max(0,(this.kickCooldown??0)-dt);
    this._movePlayers(dt);
    this._moveBall(dt);
    if(this.state==='IN_PLAY')this._touches(dt);
    if(this.deferredClockEvent&&this.penaltyInProgress&&this.ball.owner===null&&length(this.ball.vx,this.ball.vy)<.05&&this.ball.z<=FIELD.ballRadius+.01)this._endPeriod(this.deferredClockEvent);
    if(this.state==='IN_PLAY')this._thinkAI(dt);
    if(this.state==='IN_PLAY')this._defendAI(dt);
    if(this.keeperHold!==null&&this.keeperHold!==undefined){
      this.keeperTime+=dt;
      const keeper=this.players[this.keeperHold];
      const sanction=goalkeeperHandControl(this.keeperTime,keeper.team,this.ball.y,this.directions);
      if(sanction){this._log('KEEPER_DELAY','Goalkeeper held the ball over eight seconds · corner');this._stop(sanction);}
    }
  }
  _nearest(team,point,excludeKeeper=true){let best=null,min=Infinity;for(const p of this.players){if(p.team!==team||p.sentOff||(excludeKeeper&&p.role==='GK'))continue;const d=distance(p,point);if(d<min){min=d;best=p;}}return best;}
  _movePlayers(dt){
    const owner=this.ball.owner!==null?this.players[this.ball.owner]:null;
    const chasers=[this._nearest(0,this.ball),this._nearest(1,this.ball)];
    const pressureSupport=this.tactic==='press'&&this.possessionTeam!==0?this.players.filter(p=>p.team===0&&!p.sentOff&&p.role==='MID'&&p.id!==chasers[0]?.id).sort((a,b)=>distance(a,this.ball)-distance(b,this.ball))[0]:null;
    for(const p of this.players){
      if(p.sentOff){p.x=p.team?109:-4;p.y=73;continue;}
      let mx=0,my=0,sprint=false;
      if(p.id===this.controlled&&this.options.mode!=='manager'){
        mx=this.input.x;my=this.input.y;sprint=this.input.sprint;
        if(this.input.press&&owner&&owner.team!==p.team){const d=distance(p,owner)||1;mx=(owner.x-p.x)/d;my=(owner.y-p.y)/d;sprint=true;}
      }else{
        let tx=p.homeX,ty=p.homeY;
        const dir=this.directions[p.team],ownBall=(owner?.team??this.ball.lastTouch?.team)===p.team,ballProgress=(this.ball.x-52.5)*dir;
        if(p.role==='GK'){
          tx=dir===1?3:102;ty=clamp(34+(this.ball.y-34)*.27,29,39);
          if(!owner&&distance(p,this.ball)<12&&this.ball.z<3){tx=this.ball.x;ty=this.ball.y;}
          if(this.ball.owner===p.id){tx=p.x;ty=p.y;}
        }else{
          const shift=(ownBall?9:-6)+clamp(ballProgress*.22,-10,12);
          tx=clamp(p.homeX+shift*dir,7,98);
          ty=clamp(p.homeY+(this.ball.y-34)*.14,4,64);
          if(p.role==='FWD'&&ownBall){tx=clamp(this.ball.x+dir*15,8,97);if(Math.abs(p.homeY-34)>12)ty=p.homeY;}
          if(p.role==='DEF'&&ownBall&&(p.homeY<12||p.homeY>56)&&this.tactic==='wide')tx=clamp(tx+dir*16,5,100);
          if(this.tactic==='wide'&&p.team===0&&Math.abs(p.homeY-34)>12)ty=p.homeY<34?5:63;
          if(this.tactic==='counter'&&p.team===0&&p.role==='FWD')tx=clamp(tx+dir*8,5,100);
          if(chasers[p.team]?.id===p.id&&(!ownBall||!owner)) {tx=this.ball.x;ty=this.ball.y;sprint=true;}
          if(pressureSupport?.id===p.id&&distance(p,this.ball)<24){tx=this.ball.x+this.directions[p.team]*2;ty=this.ball.y;sprint=true;}
          // Supporting players offer diagonals without every player converging on the ball.
          if(ownBall&&owner&&owner.id!==p.id&&distance(p,owner)<6){ty+=p.homeY<34?-4:4;tx-=dir*3;}
          if(!ownBall&&owner&&p.role==='DEF'&&Math.abs(p.y-owner.y)<14){const recovery=clamp(owner.x-dir*7,7,98);tx=dir===1?Math.min(tx,recovery):Math.max(tx,recovery);}
        }
        if(owner?.id===p.id){
          sprint=true;
          tx=p.x+this.directions[p.team]*14;
          ty=p.y+(34-p.y)*.09;
          if(p.role==='FWD'&&Math.abs(p.homeY-34)>12&&Math.abs(p.x-(dir===1?105:0))>22)ty=p.homeY;
        }
        const d=length(tx-p.x,ty-p.y);if(d>.7){mx=(tx-p.x)/d;my=(ty-p.y)/d;}
      }
      const mag=length(mx,my);if(mag>1){mx/=mag;my/=mag;}
      const speed=(sprint?8.1:5.3)*(p.stamina<20?.82:1);
      const response=Math.min(1,dt*(mag>0?9:7));
      p.vx+=(mx*speed-p.vx)*response;p.vy+=(my*speed-p.vy)*response;
      p.x=clamp(p.x+p.vx*dt,-1.5,106.5);p.y=clamp(p.y+p.vy*dt,-1.5,69.5);
      if(length(p.vx,p.vy)>.3){const v=length(p.vx,p.vy);p.faceX=p.vx/v;p.faceY=p.vy/v;}
      p.stamina=clamp(p.stamina+dt*(sprint&&mag>.1?-.35:.14),0,100);
    }
    // Soft body contacts; never constrain the ball to the field boundary.
    for(let i=0;i<this.players.length;i++)for(let j=i+1;j<this.players.length;j++){
      const a=this.players[i],b=this.players[j];if(a.sentOff||b.sentOff)continue;let dx=b.x-a.x,dy=b.y-a.y,d=length(dx,dy);
      if(d>0&&d<.7){const push=(.7-d)*.25;a.x-=dx/d*push;a.y-=dy/d*push;b.x+=dx/d*push;b.y+=dy/d*push;}
    }
  }
  _moveBall(dt){
    const b=this.ball,prev={x:b.x,y:b.y,z:b.z};
    const owner=b.owner!==null?this.players[b.owner]:null;
    if(owner&&!owner.sentOff){
      if(this.keeperHold===owner.id){b.x=owner.x+.35*this.directions[owner.team];b.y=owner.y;b.z=1.1;b.vx=b.vy=b.vz=0;return;}
      if(distance(owner,b)>3.2||b.z>1.3){b.owner=null;}
      else if((this.dribbleTimer??0)<=0){
        const running=length(owner.vx,owner.vy)>.2;
        const tx=owner.x+(running?owner.faceX*.9:this.directions[owner.team]*.45),ty=owner.y+(running?owner.faceY*.9:0);
        b.vx=owner.vx+(tx-b.x)*5;b.vy=owner.vy+(ty-b.y)*5;b.vz=0;this.dribbleTimer=.13;
      }
    }
    this.dribbleTimer=(this.dribbleTimer??0)-dt;
    b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;
    if(b.z>FIELD.ballRadius||b.vz>0)b.vz-=9.81*dt;
    if(b.z<FIELD.ballRadius){b.z=FIELD.ballRadius;b.vz=Math.abs(b.vz)>.9?-b.vz*.38:0;}
    const speed=length(b.vx,b.vy),friction=b.z<=FIELD.ballRadius+.01?2.8:.12;
    if(speed>0){const next=Math.max(0,speed-friction*dt);b.vx*=next/speed;b.vy*=next/speed;}
    // Physical goal-frame rebounds are evaluated before goal-line decisions.
    for(const gx of [0,105]){
      if((prev.x-gx)*(b.x-gx)<=0&&Math.abs(b.x-prev.x)>.0001){
        const t=(gx-prev.x)/(b.x-prev.x),y=prev.y+(b.y-prev.y)*t,z=prev.z+(b.z-prev.z)*t;
        const atPost=Math.abs(Math.abs(y-34)-FIELD.goalWidth/2)<.18&&z<FIELD.goalHeight+.12;
        const atBar=Math.abs(z-FIELD.goalHeight)<.17&&Math.abs(y-34)<FIELD.goalWidth/2;
        if(atPost||atBar){b.x=gx+(prev.x>gx?.2:-.2);b.vx*=-.68;if(atBar)b.vz*=-.6;else b.vy+=(y>34?2:-2);b.owner=null;this._log('FRAME','Off the goal frame!');return;}
      }
    }
    const event=detectBoundary(prev,b,b.lastTouch,this.directions,this.restartOrigin);
    if(event){this.lastBoundary=event;this._stop(event);}
  }
  _touches(){
    if(this.ball.owner!==null)return;
    const b=this.ball;
    const candidates=this.players.filter(p=>!p.sentOff&&distance(p,b)<(p.role==='GK'?1.7:1.05)&&b.z<(p.role==='GK'?2.9:2.5)).sort((a,c)=>distance(a,b)-distance(c,b));
    for(const p of candidates){
      if(this.kickCooldown>0&&p.id===this.lastKicker)continue;
      if(this.restartOrigin?.untouched&&p.id===this.lastKicker){this._log('DOUBLE_TOUCH','Illegal second touch · indirect free kick');this._stop({type:'INDIRECT_FREE_KICK',team:other(p.team),x:p.x,y:p.y});return;}
      if(offsideInvolvement(this.offside,p.id,'PLAY')){this.stats.offsides[p.team]++;this._log('OFFSIDE','Offside · indirect free kick');this._stop({type:'INDIRECT_FREE_KICK',team:other(p.team),x:p.x,y:p.y,offside:true});return;}
      const ownPenalty=this.directions[p.team]===1?p.x<16.5:p.x>88.5;
      const teammateKick=b.lastTouch?.team===p.team&&this.restartOrigin?.type!=='OPPONENT';
      if(p.role==='GK'&&ownPenalty&&Math.abs(p.y-34)<20.16&&!teammateKick){
        this._receive(p,true);this._log('SAVE',`${p.team===0?'Baku Athletic':'Coast United'} goalkeeper catches`);return;
      }
      if(b.z>1.35){
        this.restartOrigin=null; // This player's legal touch ends a direct-restart exception.
        if(p.role==='FWD'&&Math.abs(p.x-(this.directions[p.team]===1?105:0))<21){this._kick(p,'shoot',.65,null,true);this._log('HEADER','Header toward goal');}
        else{this._kick(p,'clear',.6);this._log('CLEARANCE','Aerial clearance');}return;
      }
      // Fast shots may ricochet from a defender instead of becoming a perfect first touch.
      const velocity=length(b.vx,b.vy);
      if(velocity>23&&p.role==='DEF'&&b.lastTouch?.team!==p.team){
        b.vx=b.vx*.28;b.vy=b.vy*.6+(p.y>34?7:-7);b.vz=1.8;b.lastTouch={team:p.team,playerId:p.id};this.restartOrigin=null;this.lastKicker=p.id;this.kickCooldown=.2;this._log('BLOCK','Defender blocks the shot');return;
      }
      this._receive(p);return;
    }
  }
  _receive(p,keeper=false){
    const previous=this.ball.lastTouch;this.ball.owner=p.id;this.ball.lastTouch={team:p.team,playerId:p.id};
    if(previous?.team===p.team&&previous.playerId!==p.id)this.stats.completed[p.team]++;
    if(previous?.team!==p.team&&!keeper)this.offside=null; // Deliberately controlling an opponent's pass resets Law 11.
    if(this.restartOrigin&&previous?.playerId!==p.id)this.restartOrigin=null;
    this.ball.vx=p.vx;this.ball.vy=p.vy;this.ball.vz=0;this.ball.z=keeper?1.1:FIELD.ballRadius;
    if(keeper){this.keeperHold=p.id;this.keeperTime=0;}
    else{this.keeperHold=null;this.keeperTime=0;}
    p.timer=.38;
    if(this.penaltyInProgress){this.penaltyInProgress=false;if(this.deferredClockEvent){this._endPeriod(this.deferredClockEvent);return;}}
    if(p.team===0&&this.options.mode==='quick'&&p.role!=='GK')this.controlled=p.id;
  }
  _thinkAI(dt){
    const owner=this.ball.owner!==null?this.players[this.ball.owner]:null;if(!owner)return;
    if(owner.id===this.controlled&&this.options.mode!=='manager')return;
    owner.timer-=dt;if(owner.timer>0)return;
    owner.timer=.7;
    if(this.keeperHold===owner.id){if(this.keeperTime>1.5)this._kick(owner,'pass',.65);return;}
    const goalX=this.directions[owner.team]===1?105:0,goalDistance=length(goalX-owner.x,34-owner.y);
    const opponent=this._nearest(other(owner.team),owner);
    if(goalDistance<34&&Math.abs(owner.y-34)<24){this._kick(owner,'shoot',.65);return;}
    if(Math.abs(owner.y-34)>20&&Math.abs(goalX-owner.x)<43){this._kick(owner,'cross',.65);return;}
    if((opponent&&distance(opponent,owner)<2.5)||owner.timer===.7&&this.time-(owner.lastPassTime??0)>3.8){this._kick(owner,'pass',.6);owner.lastPassTime=this.time;}
  }
  _defendAI(dt){
    const owner=this.ball.owner!==null?this.players[this.ball.owner]:null;if(!owner||this.keeperHold===owner.id)return;
    const defender=this._nearest(other(owner.team),owner);if(!defender||defender.id===this.controlled&&this.options.mode!=='manager')return;
    defender.challengeWait=Math.max(0,(defender.challengeWait??0)-dt);
    if(distance(defender,owner)<1.25&&distance(defender,this.ball)<1.05&&length(defender.vx-owner.vx,defender.vy-owner.vy)<8&&defender.challengeWait===0){defender.challengeWait=1.2;this._tackle(defender);}
  }
  _chooseTarget(p,kind){
    if(this.oneTwoRunner!==undefined&&this.oneTwoRunner!==null&&p.id!==this.oneTwoRunner){const runner=this.players[this.oneTwoRunner];if(runner&&!runner.sentOff&&runner.team===p.team)return runner;}
    if(p.team===0&&this.selectedTarget!==null){const explicit=this.players[this.selectedTarget];if(explicit&&!explicit.sentOff&&explicit.id!==p.id&&explicit.team===p.team)return explicit;}
    const dir=this.directions[p.team];let best=null,score=-Infinity;
    for(const mate of this.players){if(mate.team!==p.team||mate.sentOff||mate.id===p.id||mate.role==='GK')continue;const d=distance(p,mate);if(d<3)continue;
      let value=(mate.x-p.x)*dir*1.15-Math.abs(d-(kind==='cross'?27:16))*.65;
      const marker=this._nearest(other(p.team),mate);value+=Math.min(marker?distance(marker,mate):10,10)*1.5;
      if(kind==='cross')value-=Math.abs(mate.y-34)*.85;
      // Reward open lanes and permit backward or diagonal support instead of nearest-player snapping.
      for(const def of this.players){if(def.team===p.team||def.sentOff)continue;const dx=mate.x-p.x,dy=mate.y-p.y,t=((def.x-p.x)*dx+(def.y-p.y)*dy)/(d*d);if(t>.1&&t<.9&&length(def.x-p.x-t*dx,def.y-p.y-t*dy)<2)value-=14;}
      if(value>score){score=value;best=mate;}
    }return best;
  }
  _kick(p,kind,power=.65,aim=null,header=false){
    const b=this.ball;if(!p||p.sentOff)return false;
    const dir=this.directions[p.team];power=clamp(power,.15,1);
    const target=this._chooseTarget(p,kind);let tx,ty;
    if(aim){tx=aim.x;ty=aim.y;}
    else if(kind==='shoot'){tx=dir===1?106:-1;ty=34+Math.sin(++this.sequence*2.3)*Math.max(.3,(1-power)*4);}
    else if(kind==='cross'&&!(p.team===0&&this.selectedTarget!==null)){tx=(dir===1?105:0)-dir*13;ty=34+Math.sin(this.sequence)*5;}
    else if(kind==='clear'){tx=p.x+dir*45;ty=clamp(p.y+(p.y>34?12:-12),2,66);}
    else if(target){tx=target.x+target.vx*(kind==='through'?1.3:.25);ty=target.y+target.vy*(kind==='through'?1.3:.25);if(kind==='through')tx+=dir*5;}
    else{tx=p.x+dir*18;ty=p.y;}
    const dx=tx-b.x,dy=ty-b.y,d=Math.max(.1,length(dx,dy));
    let speed=kind==='shoot'?22+power*16:kind==='clear'?25+power*10:kind==='cross'?18+power*12:13+power*13;
    if(kind==='through')speed+=3;
    b.vx=dx/d*speed;b.vy=dy/d*speed;
    b.vz=kind==='cross'?6+power*5:kind==='clear'?7:kind==='shoot'?(header?2:power>0.82?5.2:1.2):0;
    if(kind==='cross'&&d<20)b.vz=4.2;
    b.owner=null;b.lastTouch={team:p.team,playerId:p.id};this.lastKicker=p.id;this.kickCooldown=.25;this.keeperHold=null;
    p.animation=kind==='cross'?'cross':kind==='shoot'?'shoot':'pass';p.animationTime=.35;
    this.offside=createOffsideSnapshot(this.players,b,p.team,this.directions,this.restartOrigin?.untouched?this.restartOrigin.type:'OPEN_PLAY');
    if(kind==='shoot'){this.stats.shots[p.team]++;this._log('SHOT','Shot toward goal');}
    else{this.stats.passes[p.team]++;if(p.id===this.controlled)this._log('PASS',kind==='cross'?'Cross into the area':kind==='through'?'Through ball':kind==='clear'?'Ball cleared':'Pass played');}
    if(this.oneTwoRunner!==undefined&&this.oneTwoRunner!==null&&this.oneTwoRunner!==p.id){const runner=this.players[this.oneTwoRunner];if(runner?.team===p.team){this.selectedTarget=runner.id;this.oneTwoRunner=null;}}
    return true;
  }
  action(kind,power=.65,aim=null){
    if(kind==='switch'){if(this.options.mode==='player')return false;const nearest=this._nearest(0,this.ball);if(nearest){this.controlled=nearest.id;return true;}return false;}
    if(kind==='restart'){this.continueMatch();return true;}
    if(this.state==='PAUSED'||this.state==='HALF_TIME'||this.state==='FULL_TIME')return false;
    if(ACTIVE_RESTARTS.has(this.state)){if(this.restart?.team===0)return this._takeRestart(kind,power,aim);return false;}
    if(this.state!=='IN_PLAY')return false;
    const p=this.controlledPlayer;
    if(kind==='tackle'||kind==='press'){return this._tackle(p);}
    if(kind==='skill'){
      if(this.ball.owner===p.id){this.ball.vx+=-p.faceY*4;this.ball.vy+=p.faceX*4;p.animation='skill';p.animationTime=.4;this._log('SKILL','Close-control feint');return true;}return false;
    }
    if(this.ball.owner!==p?.id){
      if(this.options.mode==='player'&&['pass','through','cross','oneTwo'].includes(kind)){
        const owner=this.ball.owner!==null?this.players[this.ball.owner]:null;if(owner?.team===0){this.selectedTarget=p.id;this._kick(owner,'pass',power,aim);return true;}
      }
      return false;
    }
    if(kind==='oneTwo'){this.oneTwoRunner=p.id;const result=this._kick(p,'pass',power,aim);p.vx=this.directions[p.team]*7.5;return result;}
    return this._kick(p,kind,power,aim);
  }
  _tackle(p){
    if(!p)return false;const target=this.ball.owner!==null?this.players[this.ball.owner]:null;
    if(!target||target.team===p.team||distance(p,target)>2.1)return false;
    p.animation='tackle';p.animationTime=.45;
    const rel=length(p.vx-target.vx,p.vy-target.vy),ballDistance=distance(p,this.ball);
    if(ballDistance<1.1&&rel<8){this.ball.owner=null;this.ball.vx=this.directions[p.team]*6;this.ball.vy=(target.y-p.y)*3;this.ball.lastTouch={team:p.team,playerId:p.id};this.offside=null;this._log('TACKLE','Clean tackle');return true;}
    this.stats.fouls[p.team]++;
    const decision=evaluateFoul({kind:'TACKLE',contact:true,severity:rel>11?'EXCESSIVE':rel>6?'RECKLESS':'CARELESS',team:p.team,x:target.x,y:target.y,yellowCards:p.yellow,directions:this.directions});
    if(!decision)return false;
    if(decision.card==='RED'||decision.card==='SECOND_YELLOW')p.sentOff=true;
    if(decision.card==='YELLOW'||decision.card==='SECOND_YELLOW')p.yellow++;
    this._log('FOUL',`${decision.card?decision.card.replaceAll('_',' ')+' · ':''}${decision.type==='PENALTY'?'Penalty':'Direct free kick'}`);
    const dir=this.directions[p.team];
    this._stop({...decision,x:decision.type==='PENALTY'?(dir===1?11:94):target.x,y:decision.type==='PENALTY'?34:target.y});
    if(p.sentOff&&p.team===0&&this.options.mode==='quick'){const next=this._nearest(0,this.ball);if(next)this.controlled=next.id;}
    if(this.players.filter(q=>q.team===p.team&&!q.sentOff).length<7){this._state('FULL_TIME');this._log('ABANDONED','Match abandoned · fewer than seven players');}
    return true;
  }
  _stop(event){
    if(this.state!=='IN_PLAY')return;
    this.ball.owner=null;this.keeperHold=null;this.offside=null;this.penaltyInProgress=false;
    if(event.type==='GOAL'){
      this.score[event.team]++;this._log('GOAL',`${event.team===0?'Baku Athletic':'Coast United'} score!`);
      if(this.deferredClockEvent){this._endPeriod(this.deferredClockEvent);return;}
      this.pendingRestart={type:'KICK_OFF',team:other(event.team),x:52.5,y:34};this._state('GOAL_CELEBRATION');
    }else{
      if(this.deferredClockEvent){this._endPeriod(this.deferredClockEvent);return;}
      if(event.type==='CORNER_KICK')this.stats.corners[event.team]++;
      this.pendingRestart=event;this._log(event.type,event.offside?'Offside · indirect free kick':event.type.replaceAll('_',' ').toLowerCase());this._state('OUT_OF_PLAY');
    }
  }
  _setupRestart(event){
    if(!event)return;
    const r={...event,x:clamp(event.x,0,105),y:clamp(event.y,0,68)};
    this.restart=r;this.delayWarned=false;this.offside=null;this.keeperHold=null;this.selectedTarget=null;
    const states={KICK_OFF:'KICK_OFF_SETUP',THROW_IN:'THROW_IN_SETUP',CORNER_KICK:'CORNER_KICK_SETUP',GOAL_KICK:'GOAL_KICK_SETUP',FREE_KICK:'FREE_KICK_SETUP',DIRECT_FREE_KICK:'FREE_KICK_SETUP',INDIRECT_FREE_KICK:'OFFSIDE_RESTART',PENALTY:'PENALTY_SETUP'};
    this._state(states[r.type]??'FREE_KICK_SETUP');
    const dir=this.directions[r.team];
    if(r.type==='KICK_OFF'){
      for(const p of this.players){if(p.sentOff)continue;p.x=p.homeX;p.y=p.homeY;p.vx=p.vy=0;const ownDir=this.directions[p.team];p.x=ownDir===1?Math.min(p.x,50.5):Math.max(p.x,54.5);if(p.team!==r.team&&distance(p,{x:52.5,y:34})<9.5)p.x=52.5-ownDir*10;}
    }
    let taker;
    if(r.type==='GOAL_KICK')taker=this.players[r.team*11];
    else if(r.type==='KICK_OFF'||r.type==='PENALTY')taker=this.players.find(p=>p.team===r.team&&p.role==='FWD'&&!p.sentOff);
    else taker=this._nearest(r.team,r);
    if(!taker)taker=this._nearest(r.team,r,false);r.takerId=taker?.id;
    for(const p of this.players){
      p.vx=p.vy=0;
      if(p.sentOff||p.id===taker?.id)continue;
      if(r.type==='CORNER_KICK'){
        if(p.role==='FWD'||p.role==='DEF'){const attackX=dir===1?95:10;p.x=clamp(attackX+(p.team===r.team?0:-dir*2)+(p.number%3-1)*3,2,103);p.y=25+(p.number%5)*4;}
      }
      if(r.type==='GOAL_KICK'&&p.team!==r.team){p.x=dir===1?Math.max(p.x,18):Math.min(p.x,87);}
      const minDist=r.type==='THROW_IN'?2:r.type==='KICK_OFF'?9.15:r.type==='PENALTY'?9.15:9.15;
      if(p.team!==r.team&&distance(p,r)<minDist&&p.role!=='GK'){
        const dx=p.x-r.x,dy=p.y-r.y,d=length(dx,dy)||1;p.x=clamp(r.x+dx/d*(minDist+.3),1,104);p.y=clamp(r.y+dy/d*(minDist+.3),1,67);
      }
      if(r.type==='PENALTY'&&p.role!=='GK'){p.x=dir===1?Math.min(p.x,84):Math.max(p.x,21);}
    }
    if(r.type==='PENALTY'){const keeper=this.players[other(r.team)*11];keeper.x=this.directions[keeper.team]===1?0:105;keeper.y=34;keeper.vx=keeper.vy=0;if(r.team===1&&this.options.mode==='quick')this.controlled=keeper.id;}
    if(taker){taker.x=r.x-dir*.55;taker.y=r.y;taker.faceX=dir;taker.faceY=0;if(r.type==='THROW_IN'){taker.x=r.x;taker.y=r.y;taker.animation='throw';taker.animationTime=100;}if(r.team===0&&this.options.mode!=='player'&&this.options.mode!=='manager')this.controlled=taker.id;}
    this.ball={x:r.x,y:r.y,z:FIELD.ballRadius,vx:0,vy:0,vz:0,owner:null,lastTouch:{team:r.team,playerId:taker?.id??null}};
    this.restartOrigin={type:r.type,team:r.team,untouched:true};
    this.notification=`${r.type.replaceAll('_',' ')} · ${r.team===0?'Baku Athletic':'Coast United'}${r.team===0?' · choose pass, cross or shot':''}`;
  }
  _takeRestart(kind='pass',power=.65,aim=null){
    if(!this.restart)return false;const r=this.restart,taker=this.players[r.takerId];if(!taker)return false;
    if(r.type==='KICK_OFF'){
      // A kick-off must clearly move. The player is allowed to pass backwards.
      const receiver=this.players.find(p=>p.team===r.team&&p.id!==taker.id&&p.role==='MID'&&!p.sentOff);
      if(!aim&&receiver)aim={x:receiver.x,y:receiver.y};kind='pass';
    }
    if(r.type==='PENALTY'){kind='shoot';this.penaltyInProgress=true;}
    this._state('IN_PLAY');this.ball.owner=taker.id;
    this._kick(taker,['shoot','cross','clear','through'].includes(kind)?kind:'pass',power,aim);
    if(r.type==='THROW_IN'){
      this.ball.z=1.9;this.ball.vz=kind==='cross'?6.2:4.1;const speed=kind==='cross'?16:10+power*7;
      const current=length(this.ball.vx,this.ball.vy)||1;this.ball.vx=this.ball.vx/current*speed;this.ball.vy=this.ball.vy/current*speed;
      // A default throw points inward even when no explicitly selected recipient exists.
      if(!aim&&Math.abs(this.ball.vy)<2)this.ball.vy=r.y<34?4:-4;
      taker.animation='throw';taker.animationTime=.65;
    }
    this.restart=null;this._log('RESTART',`${r.type.replaceAll('_',' ').toLowerCase()} taken`);return true;
  }
}
