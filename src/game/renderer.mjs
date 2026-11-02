/** Side-line 3D presentation. A single mesh renders the authoritative engine ball. */
import * as THREE from 'three';
import { FIELD } from './rules.mjs';
import { createHuman, updateHuman } from './human-model.mjs';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const KITS = {
  mint: { shirt: '#e4fff3', trim: '#26c68b', shorts: '#14362e' },
  blue: { shirt: '#7eb4fb', trim: '#ecf7ff', shorts: '#173868' },
  rose: { shirt: '#ed7288', trim: '#ffedea', shorts: '#4c273b' },
  away: { shirt: '#f8b447', trim: '#fff4d3', shorts: '#263048' },
};
const SKIN = ['#c98e62', '#9e674b', '#e1b18a', '#724b37', '#d5a47b'];
const TAU = Math.PI * 2;

export class PitchRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.width = 1; this.height = 1; this.time = 0;
    this.playerModels = new Map(); this.materials = new Map();
    this.target = new THREE.Vector3(52.5, 0, 34);
    this.cameraTarget = this.target.clone();
    this.raycaster = new THREE.Raycaster();
    this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.pointer = new THREE.Vector2();
    this.worldPoint = new THREE.Vector3();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#8a9da8');
    this.scene.fog = new THREE.Fog('#8a9da8', 140, 300);
    this.camera = new THREE.PerspectiveCamera(43, 1.5, .1, 420);
    this.camera.position.set(52.5, 48, 132);
    this.camera.lookAt(this.target);
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
      this.renderer.setClearColor('#8a9da8');
      this._createScene();
      canvas.dataset.renderer = 'threejs-sideview';
    } catch (error) {
      this.fallback = true;
      this.fallbackContext = canvas.getContext('2d');
      canvas.dataset.renderer = 'sideview-compatibility';
      const note = document.createElement('span');
      note.className = 'renderer-compatibility';
      note.textContent = 'Compatibility view · 3D acceleration unavailable';
      note.style.cssText = 'position:absolute;top:28px;left:12px;font-size:8px;color:#d8e6d9;pointer-events:none';
      canvas.parentElement?.append(note); this.compatibilityNote = note;
    }
    this.resize = this.resize.bind(this);
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(canvas.parentElement || canvas);
    this.resize();
  }

  _material(color) {
    if (!this.materials.has(color)) this.materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .86, metalness: 0 }));
    return this.materials.get(color);
  }
  _box(w, h, d, color, x = 0, y = 0, z = 0, parent = this.scene) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this._material(color));
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  _cylinder(radius, height, color, x, y, z, parent = this.scene) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 8), this._material(color));
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  _line(points, color = '#eef6e4', opacity = 1, parent = this.scene) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p)));
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }));
    parent.add(line); return line;
  }
  _createScene() {
    this.scene.add(new THREE.HemisphereLight('#e5f3ff', '#526747', 1.7));
    const sun = new THREE.DirectionalLight('#fff1ce', 2.5);
    sun.position.set(-25, 85, 50); this.scene.add(sun);
    const rim = new THREE.DirectionalLight('#b8dcff', 1.2);
    rim.position.set(100, 20, -40); this.scene.add(rim);
    this._box(280, 1, 230, '#586864', 52.5, -.7, 34);
    this._pitch(); this._stadium();
    this._goal(0, -1); this._goal(105, 1);
    this._cornerFlags();

    const ballTexture = this._ballTexture();
    this.ballMesh = new THREE.Mesh(new THREE.SphereGeometry(.32, 14, 10), new THREE.MeshStandardMaterial({ map: ballTexture, roughness: .65 }));
    this.ballMesh.name = 'authoritative-match-ball';
    this.ballMesh.userData.kind = 'match-ball';
    this.scene.add(this.ballMesh);
    this.ballShadow = this._shadow(.52, .34, .27);
    this.controlRing = new THREE.Mesh(new THREE.RingGeometry(.62, .72, 40), new THREE.MeshBasicMaterial({ color: '#83ffc5', transparent: true, opacity: .92, side: THREE.DoubleSide }));
    this.controlRing.rotation.x = -Math.PI / 2; this.controlRing.position.y = .06;
    this.scene.add(this.controlRing);
    this.targetRing = this.controlRing.clone();
    this.targetRing.material = new THREE.MeshBasicMaterial({ color: '#ffdf76', transparent: true, opacity: .85, side: THREE.DoubleSide });
    this.scene.add(this.targetRing);
    this.controlArrow = new THREE.Mesh(new THREE.ConeGeometry(.18, .3, 3), new THREE.MeshBasicMaterial({ color: '#8dffcb' }));
    this.controlArrow.rotation.z = Math.PI; this.scene.add(this.controlArrow);
    this.offsideLine = this._line([[0, .065, 0], [0, .065, 68]], '#f6b451', .85);
    this.offsideLine.visible = false;
    this.callOwnerRing = new THREE.Mesh(new THREE.RingGeometry(.7,.8,32),new THREE.MeshBasicMaterial({color:'#69d8ff',transparent:true,opacity:.9,side:THREE.DoubleSide}));
    this.callOwnerRing.rotation.x=-Math.PI/2;this.callOwnerRing.position.y=.075;this.callOwnerRing.visible=false;this.scene.add(this.callOwnerRing);
    this.callStatusSprite=null;this.callStatusKey='';
    this.referee = this._createHuman({ id: 99, role: 'REF', team: -1, number: '' }, KITS.mint);
    this.scene.add(this.referee.group);
  }

  _pitch() {
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 2048; textureCanvas.height = 1328;
    const c = textureCanvas.getContext('2d'), sx = 2048 / 105, sy = 1328 / 68;
    c.fillStyle = '#2b713e'; c.fillRect(0, 0, 2048, 1328);
    for (let i = 0; i < 14; i++) {
      c.fillStyle = i % 2 ? '#327944' : '#286a39';
      c.fillRect(i * 2048 / 14, 0, 2048 / 14 + 1, 1328);
    }
    // Deterministic fine grass, baked once rather than animated duplicates.
    for (let i = 0; i < 9500; i++) {
      const x = (i * 613) % 2048, y = (i * 379) % 1328;
      c.fillStyle = i % 2 ? '#ffffff08' : '#0829130b'; c.fillRect(x, y, 1, 3);
    }
    c.scale(sx, sy); c.strokeStyle = '#eef4d7'; c.fillStyle = '#eef4d7'; c.lineWidth = .13;
    c.strokeRect(.08, .08, 104.84, 67.84);
    c.beginPath(); c.moveTo(52.5, 0); c.lineTo(52.5, 68); c.stroke();
    c.beginPath(); c.arc(52.5, 34, 9.15, 0, TAU); c.stroke();
    const spot = (x, y) => { c.beginPath(); c.arc(x, y, .19, 0, TAU); c.fill(); };
    spot(52.5, 34);
    for (const side of [0, 1]) {
      c.strokeRect(side ? 88.5 : 0, 13.84, 16.5, 40.32);
      c.strokeRect(side ? 99.5 : 0, 24.84, 5.5, 18.32);
      spot(side ? 94 : 11, 34);
      const a = Math.acos(5.5 / 9.15);
      c.beginPath(); c.arc(side ? 94 : 11, 34, 9.15, side ? Math.PI - a : -a, side ? Math.PI + a : a); c.stroke();
    }
    for (const x of [0, 105]) for (const y of [0, 68]) {
      const start = y === 0 ? x === 0 ? 0 : Math.PI / 2 : x === 0 ? Math.PI * 1.5 : Math.PI;
      c.beginPath(); c.arc(x, y, 1, start, start + Math.PI / 2); c.stroke();
    }
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(105, 68), new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(52.5, .015, 34); this.scene.add(mesh);
    this._box(115, .1, 78, '#356e3d', 52.5, -.07, 34);
  }

  _stadium() {
    // Seating terraces are real 3D geometry behind both sidelines.
    const rows = 8;
    for (const z of [-9, 77]) for (let row = 0; row < rows; row++) {
      const direction = z < 0 ? -1 : 1;
      this._box(133, .75, 1.5, row % 2 ? '#293d4b' : '#344959', 52.5, 1.1 + row * .8, z + direction * row * 1.6);
    }
    for (const x of [-10, 115]) for (let row = 0; row < 6; row++) {
      this._box(1.5, .75, 82, '#344959', x + (x < 0 ? -row : row) * 1.6, 1.1 + row * .8, 34);
    }
    const crowdGeometry = new THREE.BoxGeometry(.38, .62, .32);
    const crowdMaterial = new THREE.MeshLambertMaterial({ color: '#ffffff' });
    const crowd = new THREE.InstancedMesh(crowdGeometry, crowdMaterial, 2200);
    const dummy = new THREE.Object3D(), colors = ['#bfcebd', '#dccfae', '#6f8b91', '#58776d', '#c8b484', '#d0dbce'];
    let index = 0;
    for (const side of [-1, 1]) for (let row = 0; row < rows; row++) for (let seat = 0; seat < 135; seat++) {
      const offset = ((seat * 7 + row * 3) % 5) * .07;
      dummy.position.set(-12 + seat * .97, 1.92 + row * .8 + offset, side < 0 ? -9 - row * 1.6 : 77 + row * 1.6);
      dummy.updateMatrix(); crowd.setMatrixAt(index, dummy.matrix);
      crowd.setColorAt(index, new THREE.Color(colors[(seat * 11 + row * 5) % colors.length])); index++;
    }
    crowd.count = index; crowd.instanceMatrix.needsUpdate = true; this.scene.add(crowd);
    for (const z of [-4.2, 72.2]) this._adBoard(52.5, z, z > 34);
    for (const [x, z] of [[-5, -14], [110, -14], [-5, 85], [110, 85]]) {
      this._cylinder(.28, 24, '#5b6974', x, 12, z);
      this._box(7, 2.2, .5, '#c9d5d8', x, 25, z);
      const light = this._box(6.3, 1.5, .1, '#ffffff', x, 25, z + .35);
      light.material = new THREE.MeshBasicMaterial({ color: '#fff4c9' });
    }
    // Modest roof frames and distant blocks ground the scene without paid assets.
    this._box(137, .5, 11, '#263846', 52.5, 11, -22);
    for (let i = 0; i < 15; i++) {
      const height = 9 + (i * 11 % 17);
      this._box(6 + i % 3, height, 8, i % 2 ? '#81919a' : '#8b9aa3', -30 + i * 13, height / 2, -61 - i % 3 * 7);
    }
  }

  _adBoard(x, z, reverse) {
    const canvas = document.createElement('canvas'); canvas.width = 2048; canvas.height = 96;
    const c = canvas.getContext('2d'); c.fillStyle = '#172f2d'; c.fillRect(0, 0, 2048, 96);
    c.font = '700 30px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
    ['FOOTBA11 HEROES', 'MAKE YOUR LEGACY', 'BAKU ATHLETIC', 'EVERY MATCH. A STORY.'].forEach((label, i) => {
      c.fillStyle = i % 2 ? '#d6e2db' : '#b8ef79'; c.fillText(label, 256 + i * 512, 48);
    });
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(110, 1.25), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
    board.position.set(x, .8, z); board.rotation.y = reverse ? Math.PI : 0; this.scene.add(board);
  }
  _goal(x, direction) {
    const top = 34 - FIELD.goalWidth / 2, bottom = 34 + FIELD.goalWidth / 2, height = FIELD.goalHeight, depth = 2.5;
    for (const z of [top, bottom]) this._cylinder(.075, height, '#fbfff3', x, height / 2, z);
    const bar = this._cylinder(.075, FIELD.goalWidth, '#fbfff3', x, height, 34); bar.rotation.x = Math.PI / 2;
    const points = [];
    const push = (a, b) => points.push(...a, ...b);
    const back = x + direction * depth;
    for (let z = top; z <= bottom + .01; z += .32) {
      push([back, .02, z], [back, height, z]); push([x, height, z], [back, height, z]);
    }
    for (let y = 0; y <= height + .01; y += .3) {
      push([back, y, top], [back, y, bottom]);
      push([x, y, top], [back, y, top]); push([x, y, bottom], [back, y, bottom]);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    this.scene.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: '#e2e8d5', transparent: true, opacity: .44 })));
  }
  _cornerFlags() {
    for (const x of [0, 105]) for (const z of [0, 68]) {
      this._cylinder(.025, 1.6, '#faf4d9', x, .8, z);
      this._box(.45, .3, .02, '#efc751', x + .2, 1.4, z);
    }
  }

  _shadow(w, h, opacity = .2) {
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: '#0b2918', transparent: true, opacity, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.scale.set(w, h, 1); shadow.position.y = .045;
    this.scene.add(shadow); return shadow;
  }
  _createHuman(player, kit) {
    return createHuman(player,kit,{
      material: color=>this._material(color),
      label: value=>this._label(value),
      shadow: (w,h,opacity)=>this._shadow(w,h,opacity),
    });
  }
  _label(value) {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 40;
    const c = canvas.getContext('2d'); c.font = '700 27px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 4; c.strokeStyle = '#102a27'; c.strokeText(String(value), 32, 21); c.fillStyle = '#f3fff1'; c.fillText(String(value), 32, 21);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.scale.set(.7, .4375, 1); return sprite;
  }
  _ballTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
    const c = canvas.getContext('2d'); c.fillStyle = '#fffaf0'; c.fillRect(0, 0, 256, 128);
    c.strokeStyle = '#677471'; c.lineWidth = 1;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) {
      const cx = x * 36 + (y % 2) * 18, cy = y * 40;
      c.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const px = cx + Math.cos(a) * 15, py = cy + Math.sin(a) * 15; i ? c.lineTo(px, py) : c.moveTo(px, py); }
      c.closePath(); if ((x + y) % 3 === 0) { c.fillStyle = '#22332f'; c.fill(); } c.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
  }

  resize() {
    const bounds = (this.canvas.parentElement || this.canvas).getBoundingClientRect();
    this.width = Math.max(1, bounds.width); this.height = Math.max(1, bounds.height || bounds.width * .65);
    this.dpr = Math.min(window.devicePixelRatio || 1, this.width < 650 ? 1.6 : 2);
    this.canvas.style.width = `${this.width}px`; this.canvas.style.height = `${this.height}px`;
    if (this.fallback) { this.canvas.width = Math.round(this.width * this.dpr); this.canvas.height = Math.round(this.height * this.dpr); }
    else { this.renderer.setPixelRatio(this.dpr); this.renderer.setSize(this.width, this.height, false); }
    this.camera.aspect = this.width / this.height; this.camera.updateProjectionMatrix();
    this._updateCamera(null, 1, true);
  }
  _updateCamera(engine, dt, instant = false) {
    const playing=engine&&!['PRE_MATCH','KICK_OFF_SETUP'].includes(engine.state);
    const ball=engine?.ball,player=engine?.players?.find(p=>p.id===engine.controlled&&!p.sentOff);
    const wide=!playing||(engine?.options?.mode==='manager'&&engine?.cameraMode!=='close');
    const close=!wide&&engine?.cameraMode==='close'&&player;
    const separation=player&&ball?Math.hypot(player.x-ball.x,player.y-ball.y):0;
    const tx=wide?52.5:close?clamp(player.x*.65+(ball?.x??player.x)*.35,14,91):clamp(52.5+((ball?.x??52.5)-52.5)*.58,24,81);
    const tz=wide?30:close?clamp(player.y*.65+(ball?.y??player.y)*.35,12,56):clamp(30+((ball?.y??34)-34)*.23,24,40);
    const blend=instant?1:1-Math.exp(-Math.max(dt||.016,.001)*3.3);
    this.cameraTarget.lerp(new THREE.Vector3(tx,0,tz),blend);
    const span=wide?151:close?clamp(48+separation*.8,48,100):this.width<650?94:113;
    const distance=Math.max(close?41:66,span/(2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2))*Math.max(.7,this.camera.aspect)));
    const elevation=close?.4:.48;
    this.camera.position.set(this.cameraTarget.x+(wide?0:3),distance*elevation,this.cameraTarget.z+distance*Math.sqrt(1-elevation*elevation));
    this.camera.lookAt(this.cameraTarget);this.camera.updateMatrixWorld();
  }
  worldToScreen(x, y, z = 0) {
    if (this.fallback) return this._compatProjection(x, y, z);
    const point = new THREE.Vector3(x, z, y).project(this.camera);
    return { x: (point.x + 1) * .5 * this.width, y: (1 - point.y) * .5 * this.height, visible: Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1 && point.z < 1 };
  }
  screenToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * this.width / (rect.width || 1), y = (clientY - rect.top) * this.height / (rect.height || 1);
    if (this.fallback) {
      const scale = this.width / 124;
      return { x: (x - this.width / 2) / scale + 52.5, y: (y - this.height * .55) / (scale * .44) + 34 };
    }
    this.pointer.set(x / this.width * 2 - 1, 1 - y / this.height * 2);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.ground, this.worldPoint);
    return hit ? { x: hit.x, y: hit.z } : null;
  }

  render(engine, delta = 0) {
    if (!engine || this.width < 2) return;
    if(engine.state!=='PAUSED')this.time += Math.min(delta || 0, .1);
    if (this.fallback) { this._renderCompatibility(engine); return; }
    this._updateCamera(engine, delta);
    for (const player of engine.players) {
      let model = this.playerModels.get(player.id);
      const kit = player.team === 0 ? KITS[engine.kitColor] || KITS.mint : KITS.away;
      if (!model) { model = this._createHuman(player, kit); this.playerModels.set(player.id, model); this.scene.add(model.group); }
      model.group.visible = !player.sentOff; model.shadow.visible = !player.sentOff;
      if (player.sentOff) continue;
      model.group.position.set(player.x, 0, player.y);
      const speed = Math.hypot(player.vx || 0, player.vy || 0);
      const angle = speed > .2 ? Math.atan2(-player.vx, -player.vy) : Math.atan2(-(player.faceX ?? engine.directions[player.team]), -(player.faceY || 0));
      model.group.rotation.y = angle;
      updateHuman(model,player,this.time,engine);
      model.shadow.position.set(player.x + .15, .045, player.y + .12);
      if (model.number !== player.number) { model.label.material.map.dispose(); model.label.material.dispose(); model.group.remove(model.label); model.label = this._label(player.number); model.label.position.y = 2.16; model.group.add(model.label); model.number = player.number; }
      model.label.visible = player.id === engine.controlled || player.id === engine.selectedTarget || (this.width > 650 && engine.cameraMode !== 'close');
      const shirt = player.role === 'GK' ? player.team === 0 ? '#ad8edf' : '#72afcf' : kit.shirt;
      for(const part of model.shirtParts)part.material=this._material(shirt);
      for(const part of model.shortParts)part.material=this._material(kit.shorts);
      model.collar.material=this._material(kit.trim);
    }
    const controlled = engine.players.find(p => p.id === engine.controlled && !p.sentOff);
    const canControl = engine.options?.mode !== 'manager';
    this.controlRing.visible = !!controlled && canControl;
    this.controlArrow.visible = !!controlled && canControl;
    if (controlled) { this.controlRing.position.set(controlled.x, .07, controlled.y); this.controlArrow.position.set(controlled.x, 2.65, controlled.y); }
    const selected = engine.players.find(p => p.id === engine.selectedTarget && !p.sentOff);
    this.targetRing.visible = !!selected && canControl;
    if (selected) this.targetRing.position.set(selected.x, .07, selected.y);
    const b = engine.ball;
    this.ballMesh.position.set(b.x, Math.max(.18, b.z || .11) + .14, b.y);
    this.ballMesh.rotation.z += (b.vx || 0) * delta * 1.8;
    this.ballMesh.rotation.x += (b.vy || 0) * delta * 1.8;
    this.ballShadow.position.set(b.x, .05, b.y);
    this.ballShadow.material.opacity = clamp(.25 - (b.z || 0) * .025, .04, .25);
    this.ballShadow.scale.set(.42 + (b.z || 0) * .025, .25 + (b.z || 0) * .025, 1);
    this.referee.group.position.set(clamp(b.x - 11, 12, 93), 0, clamp(b.y + 10, 8, 62));
    this.referee.group.rotation.y = -Math.PI / 2;
    this.referee.shadow.position.set(this.referee.group.position.x, .05, this.referee.group.position.z);
    this.referee.label.visible = false;
    this.offsideLine.visible = !!engine.debug && !!engine.offsideSnapshot;
    if (this.offsideLine.visible) this.offsideLine.position.x = engine.offsideSnapshot.line;
    this._renderCallStatus(engine,controlled);
    this.renderer.render(this.scene, this.camera);
    this._debug(engine);
  }
  _renderCallStatus(engine,controlled){
    const call=engine.getPassCallStatus?.()??engine.passCall;
    const ownPlayer=engine.options?.mode==='player'&&controlled;
    const labels={waiting:['ÖTÜRMƏ GÖZLƏNİR','#c4ef96'],blocked:['BOŞ YERƏ ÇIX','#f5cc79'],passed:['TOP SƏNƏ GƏLİR','#a6e2ff'],received:['TOP SƏNDƏ','#c4ef96']};
    const selected=ownPlayer&&call?(labels[call.status]??(call.enabled?['TOP İSTƏ · R','#c4ef96']:null)):null;
    if(!selected){if(this.callStatusSprite)this.callStatusSprite.visible=false;this.callOwnerRing.visible=false;return;}
    const [message,color]=selected,key=message+color;
    if(this.callStatusKey!==key){
      if(this.callStatusSprite){this.callStatusSprite.material.map.dispose();this.callStatusSprite.material.dispose();this.scene.remove(this.callStatusSprite);}
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=80;
      const c=canvas.getContext('2d');c.fillStyle='#14251eeb';c.beginPath();c.roundRect(3,3,506,74,14);c.fill();c.strokeStyle=color;c.lineWidth=3;c.stroke();c.fillStyle=color;c.font='700 28px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText(message,256,41);
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
      this.callStatusSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));this.callStatusSprite.scale.set(8,1.25,1);this.callStatusSprite.renderOrder=20;this.scene.add(this.callStatusSprite);this.callStatusKey=key;
    }
    this.callStatusSprite.visible=true;this.callStatusSprite.position.set(controlled.x,3.5,controlled.y);
    const owner=engine.players.find(p=>p.id===call.ownerId&&!p.sentOff);
    this.callOwnerRing.visible=!!owner&&['waiting','blocked'].includes(call.status);
    if(owner)this.callOwnerRing.position.set(owner.x,.075,owner.y);
  }
  _debug(engine) {
    if (!engine.debug) { if (this.debugNode) this.debugNode.hidden = true; return; }
    if (!this.debugNode) {
      this.debugNode = document.createElement('pre'); this.debugNode.style.cssText = 'position:absolute;left:10px;top:35px;padding:8px;background:#0b191ce0;color:#d3ffb7;font:9px monospace;pointer-events:none;max-width:90%;white-space:pre-wrap';
      this.canvas.parentElement.append(this.debugNode);
    }
    this.debugNode.hidden = false;
    const b = engine.ball;
    this.debugNode.textContent = `${engine.state} · ${engine.clock?.display}\nBALL ${b.x.toFixed(2)}, ${b.y.toFixed(2)}, ${b.z.toFixed(2)}\nVEL ${b.vx.toFixed(2)}, ${b.vy.toFixed(2)}, ${b.vz.toFixed(2)}\nTOUCH ${JSON.stringify(b.lastTouch)}\nRESTART ${engine.restart?.type || 'NONE'}\n3D BALL MESHES: 1`;
  }
  _compatProjection(x, y, z = 0) {
    const scale = this.width / 124;
    return { x: this.width / 2 + (x - 52.5) * scale, y: this.height * .55 + (y - 34) * scale * .44 - z * scale, visible: true };
  }
  _renderCompatibility(engine) {
    const c = this.fallbackContext; if (!c) return;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = '#869da5'; c.fillRect(0, 0, this.width, this.height);
    c.fillStyle = '#304d54'; c.fillRect(0, this.height * .15, this.width, this.height * .25);
    const a = this._compatProjection(0, 0), b = this._compatProjection(105, 68);
    c.fillStyle = '#3c8249'; c.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    c.strokeStyle = '#e4efcf'; c.lineWidth = 1; c.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    const mid = this._compatProjection(52.5, 34); c.beginPath(); c.moveTo(mid.x, a.y); c.lineTo(mid.x, b.y); c.ellipse(mid.x, mid.y, 9.15 * this.width / 124, 9.15 * this.width / 124 * .44, 0, 0, TAU); c.stroke();
    for (const p of [...engine.players].filter(p => !p.sentOff).sort((a, b) => a.y - b.y)) {
      const point = this._compatProjection(p.x, p.y), s = Math.max(4, this.width / 125);
      c.fillStyle = p.team === 0 ? KITS[engine.kitColor]?.shirt || KITS.mint.shirt : KITS.away.shirt; c.fillRect(point.x - s * .35, point.y - s * 1.5, s * .7, s * .9);
      c.fillStyle = SKIN[p.id % 5]; c.beginPath(); c.arc(point.x, point.y - s * 1.8, s * .28, 0, TAU); c.fill();
      c.strokeStyle = '#1e2d33'; c.lineWidth = s * .2; c.beginPath(); c.moveTo(point.x - s * .2, point.y - s * .6); c.lineTo(point.x - s * .25, point.y); c.moveTo(point.x + s * .2, point.y - s * .6); c.lineTo(point.x + s * .25, point.y); c.stroke();
      if (p.id === engine.controlled && engine.options?.mode !== 'manager') { c.strokeStyle = '#8dffcb'; c.beginPath(); c.ellipse(point.x, point.y, s, s * .35, 0, 0, TAU); c.stroke(); }
    }
    const ball = this._compatProjection(engine.ball.x, engine.ball.y, engine.ball.z);
    c.fillStyle = '#fcfff5'; c.beginPath(); c.arc(ball.x, ball.y, Math.max(2, this.width / 300), 0, TAU); c.fill();
  }
  destroy() {
    this.observer.disconnect(); this.compatibilityNote?.remove(); this.debugNode?.remove();
    this.scene.traverse(object => { object.geometry?.dispose(); if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) { material.map?.dispose(); material.dispose(); } });
    this.renderer?.dispose(); this.playerModels.clear();
  }
}
