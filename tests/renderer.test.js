import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneToWorld, worldToScene } from '../renderer.js';

const world = { width: 1600, height: 900 };

test('world coordinates map to a centered WebGL ground plane', () => {
  assert.deepEqual(worldToScene(800, 450, world), { x: 0, z: 0 });
  assert.deepEqual(worldToScene(0, 0, world), { x: -800, z: -450 });
});

test('scene ground coordinates map back to gameplay coordinates', () => {
  for (const point of [[0, 0], [240, 680], [1600, 900]]) {
    const scene = worldToScene(point[0], point[1], world);
    assert.deepEqual(sceneToWorld(scene.x, scene.z, world), { x: point[0], y: point[1] });
  }
});
