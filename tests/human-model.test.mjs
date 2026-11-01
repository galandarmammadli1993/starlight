import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHuman,updateHuman}from '../src/game/human-model.mjs';
import {PitchRenderer}from '../src/game/renderer.mjs';
const kit={shirt:'#e4fff3',trim:'#26c68b',shorts:'#14362e'};
function figure(id=2){return createHuman({id,team:0,number:10},kit);}
function size(object){object.updateMatrixWorld(true);return new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());}

test('authored adult footballer is 1.8 metres with natural head-to-height proportions',()=>{
 const model=figure();const body=size(model.group),head=size(model.head);
 assert.ok(body.y>1.72&&body.y<1.86,`height ${body.y}`);
 assert.ok(body.y/head.y>7&&body.y/head.y<8.2,`head ratio ${body.y/head.y}`);
 assert.ok(body.x>.48&&body.x<.75);
});
test('players have articulated knees, ankles, elbows and a shaped neck/jaw',()=>{
 const m=figure();assert.equal(m.limbs.length,2);
 for(const l of m.limbs){assert.equal(l.knee.parent,l.hip);assert.equal(l.ankle.parent,l.knee);assert.equal(l.elbow.parent,l.shoulder);assert.ok(l.knee.position.y<-.4);}
 assert.ok(m.head.geometry.attributes.position.count>500,'face shape includes ears, nose and jaw rather than one sphere');
});
test('anatomical jersey surfaces face outwards rather than rendering inside out',()=>{
 const m=figure(),g=m.torso.geometry,p=g.attributes.position,n=g.attributes.normal;
 let outward=0;
 for(let i=0;i<p.count;i++){if(p.getY(i)>1.1&&p.getY(i)<1.4)outward+=p.getX(i)*n.getX(i)+p.getZ(i)*n.getZ(i);}
 assert.ok(outward>3);
});
test('running bends the knees and elbows independently instead of swinging rigid sticks',()=>{
 const m=figure();updateHuman(m,{id:2,vx:7,vy:0},.125,{});
 assert.ok(m.limbs.some(l=>Math.abs(l.knee.rotation.x)>.2));
 assert.ok(m.limbs.every(l=>l.elbow.rotation.x>.6));
 assert.notEqual(m.limbs[0].hip.rotation.x,m.limbs[1].hip.rotation.x);
});
test('waiting and blocked pass calls raise only the requesting player hand',()=>{
 for(const status of ['waiting','blocked']){const m=figure();updateHuman(m,{id:2,vx:0,vy:0},1,{getPassCallStatus:()=>({status,playerId:2})});assert.ok(m.limbs.find(l=>l.side===1).shoulder.rotation.x>2.5);}
 const m=figure();updateHuman(m,{id:2,vx:0,vy:0},1,{getPassCallStatus:()=>({status:'waiting',playerId:9})});assert.ok(m.limbs.every(l=>Math.abs(l.shoulder.rotation.x)<.1));
});
test('throwing, passing and tackling poses move articulated joints and stay finite',()=>{
 for(const animation of ['idle','throw','shoot','pass','cross','tackle']){
  const m=figure();for(let i=0;i<50;i++)updateHuman(m,{id:2,vx:8,vy:2,animation,animationTime:.3},i/10,{});
  m.group.updateMatrixWorld(true);m.group.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite),animation));assert.ok(size(m.group).y<2.4);
 }
});
test('22 figures reuse authored geometry to keep mobile memory bounded',()=>{
 const figures=Array.from({length:22},(_,i)=>figure(i));
 assert.ok(figures.every(m=>m.torso.geometry===figures[0].torso.geometry));
 const meshes=[];figures[0].group.traverse(o=>{if(o.isMesh)meshes.push(o);});assert.ok(meshes.length<=32,`meshes ${meshes.length}`);
});
test('close camera enlarges the player while preserving a near-sideline angle',()=>{
 const r=Object.create(PitchRenderer.prototype);Object.assign(r,{width:960,height:620,camera:new THREE.PerspectiveCamera(43,960/620,.1,420),cameraTarget:new THREE.Vector3(52.5,0,34)});
 const engine={state:'IN_PLAY',options:{mode:'player'},players:[{id:6,x:52.5,y:34}],controlled:6,ball:{x:55,y:35}};
 r._updateCamera(engine,.016,true);const far=Math.abs(r.worldToScreen(52.5,34,1.8).y-r.worldToScreen(52.5,34,0).y);
 engine.cameraMode='close';r._updateCamera(engine,.016,true);const near=Math.abs(r.worldToScreen(52.5,34,1.8).y-r.worldToScreen(52.5,34,0).y);
 assert.ok(near>far*1.4,`${near}/${far}`);assert.ok(r.camera.position.z>r.cameraTarget.z);assert.ok(r.camera.position.y<r.camera.position.z-r.cameraTarget.z);
});


test('sock clothing remains outside the underlying calf skin at every covered ring',()=>{
 const m=figure(),limb=m.limbs[0];
 const skin=new THREE.Mesh(limb.calf.geometry,new THREE.MeshBasicMaterial());skin.updateMatrixWorld(true);
 const pos=limb.sock.geometry.attributes.position,ray=new THREE.Raycaster();let checks=0;
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),radius=Math.hypot(x,z);if(radius<.03)continue;
  const direction=new THREE.Vector3(x,0,z).normalize();ray.set(new THREE.Vector3(direction.x,y,direction.z),direction.clone().negate());
  const hit=ray.intersectObject(skin,false)[0];if(!hit)continue;
  assert.ok(radius-Math.hypot(hit.point.x,hit.point.z)>.004,'clothing must clear skin geometry and avoid visible holes');checks++;
 }
 assert.ok(checks>=32);
});
