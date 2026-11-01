import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PitchRenderer } from '../src/game/renderer.mjs';

function projection(width = 960, height = 620) {
  const r = Object.create(PitchRenderer.prototype);
  Object.assign(r, {
    width, height,
    canvas: { getBoundingClientRect: () => ({ left: 71, top: 89, width, height }) },
    camera: new THREE.PerspectiveCamera(43, width / height, .1, 420),
    cameraTarget: new THREE.Vector3(52.5, 0, 34),
    pointer: new THREE.Vector2(), raycaster: new THREE.Raycaster(),
    ground: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), worldPoint: new THREE.Vector3(),
  });
  r._updateCamera({ state: 'IN_PLAY', options: { mode: 'quick' }, ball: { x: 60, y: 25 } }, .016, true);
  return r;
}

for (const [w, h] of [[960, 620], [360, 288], [844, 390]]) {
  test(`3D sideline picking round-trips pitch coordinates at ${w}x${h}`, () => {
    const renderer = projection(w, h);
    for (const [x, y] of [[52.5, 34], [28, 12], [75, 55], [44, 44]]) {
      const screen = renderer.worldToScreen(x, y);
      const world = renderer.screenToWorld(screen.x + 71, screen.y + 89);
      assert.ok(Math.abs(world.x - x) < 1e-6);
      assert.ok(Math.abs(world.y - y) < 1e-6);
    }
  });
}

test('camera uses a low side-line angle with upright height projection', () => {
  const r = projection();
  const dy = r.camera.position.y - r.cameraTarget.y;
  const dz = r.camera.position.z - r.cameraTarget.z;
  const degrees = Math.atan2(dy, dz) * 180 / Math.PI;
  assert.ok(degrees > 20 && degrees < 35);
  const foot = r.worldToScreen(52.5, 34, 0), head = r.worldToScreen(52.5, 34, 2);
  assert.ok(head.y < foot.y - 5, 'player height must project vertically on screen');
});

test('camera tracking follows attacks to both ends while remaining at the near sideline', () => {
  const r = projection();
  const view = x => r._updateCamera({ state: 'IN_PLAY', options: { mode: 'quick' }, ball: { x, y: 40 } }, .016, true);
  view(5); const left = r.cameraTarget.x;
  view(100); assert.ok(r.cameraTarget.x > left + 40);
  assert.ok(r.camera.position.z > r.cameraTarget.z);
});

test('preview and manager camera retain a wide full-match centre', () => {
  const r = projection();
  r._updateCamera({ state: 'IN_PLAY', options: { mode: 'manager' }, ball: { x: 3, y: 2 } }, .016, true);
  assert.equal(r.cameraTarget.x, 52.5);
  assert.equal(r.cameraTarget.z, 30);
});

test('compatibility view has invertible side-view picking too', () => {
  const r = projection(390, 300); r.fallback = true;
  const point = r.worldToScreen(70, 60);
  const world = r.screenToWorld(point.x + 71, point.y + 89);
  assert.ok(Math.abs(world.x - 70) < 1e-8);
  assert.ok(Math.abs(world.y - 60) < 1e-8);
});
