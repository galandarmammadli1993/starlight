/** Original, articulated athletic figure. Metres, front=-Z; no external assets. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const geometryCache=new Map();
const SKIN=['#c98e62','#976044','#dfb08a','#734b37','#c99772'];
const HAIR=['#251e1b','#161b1c','#342722','#76563b'];
const BOOTS={black:'#17232a',white:'#eef1e9',red:'#cd433e',gold:'#d0ac4d'};
function cached(key,make){if(!geometryCache.has(key))geometryCache.set(key,make());return geometryCache.get(key);}
function ellipsoid(rx,ry,rz,x=0,y=0,z=0){return new THREE.SphereGeometry(1,16,12).scale(rx,ry,rz).translate(x,y,z);}
function combine(parts){for(const g of parts)g.deleteAttribute('uv');const result=mergeGeometries(parts,false);for(const g of parts)g.dispose();return result;}
/** Smooth elliptical cross sections give shoulders, waist and muscle volume. */
function loft(rings,segments=16){
  const pos=[],indices=[],ascending=rings.at(-1)[0]>rings[0][0];
  for(const [y,rx,rz,cz=0]of rings)for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2;pos.push(Math.cos(a)*rx,y,Math.sin(a)*rz+cz);}
  for(let row=0;row<rings.length-1;row++)for(let col=0;col<segments;col++){const a=row*segments+col,b=row*segments+(col+1)%segments,c=(row+1)*segments+col,d=(row+1)*segments+(col+1)%segments;indices.push(...(ascending?[a,c,b,b,c,d]:[a,b,c,b,d,c]));}
  for(const [ring,invert]of [[0,!ascending],[rings.length-1,ascending]]){const center=pos.length/3;pos.push(0,rings[ring][0],rings[ring][3]||0);for(let i=0;i<segments;i++){const a=ring*segments+i,b=ring*segments+(i+1)%segments;indices.push(...(invert?[center,b,a]:[center,a,b]));}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function mesh(g,mat,parent,x=0,y=0,z=0){const m=new THREE.Mesh(g,mat);m.position.set(x,y,z);parent.add(m);return m;}
function pivot(name,parent,x,y,z=0){const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;}
function bodyGeometries(){
  return cached('anatomical-body',()=>({
    torso:loft([[.99,.135,.092],[1.06,.15,.102],[1.21,.178,.113],[1.34,.216,.119],[1.43,.237,.105],[1.47,.187,.09],[1.49,.067,.063]]),
    pelvis:loft([[.87,.171,.103],[.94,.17,.103],[1.01,.142,.097]]),
    neck:loft([[1.46,.058,.055],[1.57,.052,.051]]),
    head:combine([ellipsoid(.091,.123,.09,0,1.674,-.004),ellipsoid(.066,.05,.074,0,1.608,-.017),ellipsoid(.021,.027,.031,0,1.665,-.087),ellipsoid(.018,.033,.012,-.091,1.669,0),ellipsoid(.018,.033,.012,.091,1.669,0)]),
    hair:new THREE.SphereGeometry(1,16,9,0,Math.PI*2,0,Math.PI*.57).scale(.094,.13,.094).translate(0,1.681,.002),
    beard:combine([ellipsoid(.067,.041,.013,0,1.611,-.075),ellipsoid(.029,.028,.014,-.057,1.637,-.061),ellipsoid(.029,.028,.014,.057,1.637,-.061)]),
    eyes:combine([ellipsoid(.011,.005,.005,-.032,1.695,-.084),ellipsoid(.011,.005,.005,.032,1.695,-.084)]),
    collar:new THREE.TorusGeometry(.061,.008,6,20).rotateX(Math.PI/2).translate(0,1.488,0),
    thigh:loft([[0,.085,.083],[-.09,.096,.083],[-.28,.078,.069],[-.42,.058,.06]]),
    shorts:loft([[.015,.108,.105],[-.19,.103,.103],[-.235,.096,.095]]),
    calf:loft([[.012,.058,.058],[-.095,.064,.063],[-.2,.061,.059],[-.34,.039,.042],[-.41,.035,.039]]),
    sock:loft([[-.12,.073,.072],[-.22,.067,.067],[-.34,.049,.053],[-.415,.046,.049]]),
    boot:combine([ellipsoid(.049,.04,.115,0,-.442,-.043),ellipsoid(.044,.051,.055,0,-.417,.008)]),
    sole:ellipsoid(.051,.012,.12,0,-.474,-.044),
    sleeve:loft([[.025,.071,.074],[-.06,.08,.074],[-.145,.065,.064]]),
    upperArm:loft([[-.09,.059,.06],[-.19,.056,.057],[-.295,.043,.046]]),
    forearm:combine([loft([[.018,.043,.046],[-.09,.048,.045],[-.23,.03,.033],[-.26,.028,.03]]),ellipsoid(.036,.065,.022,0,-.29,-.005)]),
    knee:ellipsoid(.06,.064,.061),
  }));
}
/** Dependencies allow the pitch renderer to reuse its material and label cache. */
export function createHuman(player,kit,{material,label,shadow}={}){
  const mat=material??(color=>new THREE.MeshStandardMaterial({color,roughness:.9}));
  const g=bodyGeometries(),group=new THREE.Group();group.name=`athlete-${player.id}`;
  group.userData.kind='articulated-footballer';group.userData.authoredHeight=1.8;
  const athleticBuild=1+((player.id*7)%5-2)*.018;
  group.scale.set(athleticBuild,1+((player.id*3)%5-2)*.009,athleticBuild);
  const shirt=player.role==='GK'?(player.team===0?'#ad8edf':'#72afcf'):player.role==='REF'?'#eddf5d':kit.shirt;
  const shorts=player.role==='REF'?'#25343b':kit.shorts;
  const skin=player.role==='REF'?'#bd8d66':SKIN[player.id%SKIN.length];
  const shirtMat=mat(shirt),shortsMat=mat(shorts),skinMat=mat(skin);
  const torsoRoot=pivot('spine',group,0,0),torso=mesh(g.torso,shirtMat,torsoRoot),waist=mesh(g.pelvis,shortsMat,group);
  mesh(g.neck,skinMat,torsoRoot);const head=mesh(g.head,skinMat,torsoRoot);
  const hair=mesh(g.hair,mat(HAIR[player.id%HAIR.length]),torsoRoot),beard=mesh(g.beard,mat(HAIR[player.id%HAIR.length]),torsoRoot);beard.visible=false;mesh(g.eyes,mat('#2b2521'),torsoRoot);
  const collar=mesh(g.collar,mat(kit.trim),torsoRoot);
  const shirtParts=[torso],shortParts=[waist],limbs=[],boots=[];
  for(const side of [-1,1]){
    const hip=pivot(`hip-${side}`,group,side*.101,.952);
    mesh(g.thigh,skinMat,hip);shortParts.push(mesh(g.shorts,shortsMat,hip));
    const knee=pivot(`knee-${side}`,hip,0,-.422);mesh(g.knee,skinMat,knee);
    const calf=mesh(g.calf,skinMat,knee);const sock=mesh(g.sock,shirtMat,knee);shirtParts.push(sock);
    const ankle=pivot(`ankle-${side}`,knee,0,0);boots.push(mesh(g.boot,mat('#17232a'),ankle));mesh(g.sole,mat('#c2c8c4'),ankle);
    const shoulder=pivot(`shoulder-${side}`,torsoRoot,side*.233,1.422);
    shirtParts.push(mesh(g.sleeve,shirtMat,shoulder));mesh(g.upperArm,skinMat,shoulder);
    const elbow=pivot(`elbow-${side}`,shoulder,0,-.293);mesh(g.forearm,skinMat,elbow);
    limbs.push({side,hip,knee,ankle,shoulder,elbow,calf,sock,leg:hip,arm:shoulder});
  }
  const numberLabel=label?.(player.number);if(numberLabel){numberLabel.position.y=2.16;group.add(numberLabel);}
  const footShadow=shadow?.(.45,.28,.22);
  const skinParts=[];group.traverse(part=>{if(part.isMesh&&part.material===skinMat)skinParts.push(part);});
  const model={group,torso,waist,head,collar,hair,beard,boots,skinParts,material:mat,shirtParts,shortParts,torsoRoot,limbs,label:numberLabel,shadow:footShadow,number:player.number,kit:shirt};
  applyAppearance(model,player);return model;
}

function applyAppearance(model,player){
  const appearance=player.appearance??{},hair=['short','shaved','long'].includes(appearance.hair)?appearance.hair:'short';
  const beard=appearance.beard==='short',boot=BOOTS[appearance.boots]??BOOTS.black;
  const skin=SKIN[Number.isInteger(appearance.skin)&&appearance.skin>=0&&appearance.skin<SKIN.length?appearance.skin:player.id%SKIN.length];
  const key=`${hair}/${beard}/${boot}/${skin}`;if(key===model.appearanceKey)return;
  model.appearanceKey=key;model.hair.visible=hair!=='shaved';model.hair.scale.y=hair==='long'?1.08:1;model.hair.position.y=hair==='long'?-.128:0;
  model.beard.visible=beard;
  for(const part of model.boots)part.material=model.material(boot);
  for(const part of model.skinParts)part.material=model.material(skin);
}

/** Multi-joint gait with knee flexion, planted-foot recovery and action poses. */
export function updateHuman(model,player,time,engine={}){
  applyAppearance(model,player);
  const speed=Math.hypot(player.vx||0,player.vy||0),run=clamp(speed/7.5,0,1),moving=clamp(speed/.65,0,1);
  const phase=time*(speed>5?12.5:9)+player.id*1.6;
  model.group.position.y=Math.abs(Math.sin(phase*2))*.018*run;
  model.torsoRoot.rotation.x=-.06*run;
  model.torsoRoot.rotation.z=Math.sin(phase)*.015*moving;
  const call=engine.getPassCallStatus?.()??engine.passCall??engine.callFeedback;
  const calling=(engine.passRequest?.playerId===player.id)||(call?.playerId===player.id&&['requesting','waiting','blocked','requested','accepted','pending'].includes(String(call.status).toLowerCase()));
  for(const limb of model.limbs){
    const stride=Math.sin(phase+(limb.side<0?Math.PI:0));
    limb.hip.rotation.set(stride*(.25+run*.4)*moving,0,0);
    limb.knee.rotation.set(-(.06+Math.max(0,-stride)*(.28+run*.95))*moving,0,0);
    limb.ankle.rotation.x=-(limb.hip.rotation.x+limb.knee.rotation.x)*.16;
    limb.shoulder.rotation.set(-stride*(.17+run*.3)*moving,0,-limb.side*.09);
    limb.elbow.rotation.set(.18+run*.65,0,0);
    if(calling&&limb.side===1){limb.shoulder.rotation.x=2.62;limb.shoulder.rotation.z=-.2;limb.elbow.rotation.x=.18;}
    if(player.animation==='throw'&&player.animationTime>0){limb.shoulder.rotation.x=2.85;limb.shoulder.rotation.z=-limb.side*.13;limb.elbow.rotation.x=.38;}
    if(['shoot','pass','cross'].includes(player.animation)&&player.animationTime>0&&limb.side===1){limb.hip.rotation.x=.92;limb.knee.rotation.x=-.17;limb.ankle.rotation.x=-.2;model.torsoRoot.rotation.x=.07;}
    if(player.animation==='tackle'&&player.animationTime>0){limb.hip.rotation.x=limb.side===1?1.25:-.48;limb.knee.rotation.x=limb.side===1?-.12:-.85;model.torsoRoot.rotation.x=-.19;}
  }
  return model;
}
