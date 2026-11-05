/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  snapToBuildGrid,
  calculateDamage,
  applyDamageToPlayer,
  canBuild,
  isOutsideStorm,
  updateStormCircle,
  GRID_SIZE,
  WALL_HEIGHT
} from './rules.ts';

test('grid snapping aligns to grid increments', () => {
  const playerPos: [number, number, number] = [3.2, 0, 7.8];
  const aimDir: [number, number, number] = [0, 0, 1]; // facing Z positive

  const snapped = snapToBuildGrid(playerPos, aimDir, 'wall');
  assert.ok(snapped.position[0] !== undefined);
  assert.ok(snapped.position[1] !== undefined);
  assert.ok(snapped.position[2] !== undefined);
  // Y coordinate should be halfway up the wall
  assert.equal(snapped.position[1], WALL_HEIGHT / 2);
});

test('calculateDamage handles normal hits and headshots', () => {
  const bodyShot = calculateDamage(30, false, 10, 100, false);
  assert.equal(bodyShot.damage, 30);
  assert.equal(bodyShot.isHeadshot, false);

  const headShot = calculateDamage(30, true, 10, 100, false);
  assert.equal(headShot.damage, 45); // 1.5x multiplier
  assert.equal(headShot.isHeadshot, true);

  const shotgunHeadshot = calculateDamage(80, true, 5, 25, true);
  assert.equal(shotgunHeadshot.damage, 140); // 1.75x multiplier
});

test('applyDamageToPlayer damages shield before health', () => {
  // 100 HP, 50 Shield, takes 40 damage
  const res1 = applyDamageToPlayer(100, 50, 40);
  assert.equal(res1.newShield, 10);
  assert.equal(res1.newHealth, 100);
  assert.equal(res1.damageDealtToShield, 40);
  assert.equal(res1.damageDealtToHealth, 0);
  assert.equal(res1.isEliminated, false);

  // Remaining 10 shield + takes 30 damage -> 10 to shield, 20 to health
  const res2 = applyDamageToPlayer(100, 10, 30);
  assert.equal(res2.newShield, 0);
  assert.equal(res2.newHealth, 80);
  assert.equal(res2.damageDealtToShield, 10);
  assert.equal(res2.damageDealtToHealth, 20);

  // Fatal damage
  const res3 = applyDamageToPlayer(20, 0, 50);
  assert.equal(res3.newHealth, 0);
  assert.equal(res3.isEliminated, true);
});

test('canBuild checks material cost threshold', () => {
  assert.equal(canBuild(9, 0, 0, 'wood'), false);
  assert.equal(canBuild(10, 0, 0, 'wood'), true);
  assert.equal(canBuild(5, 20, 0, 'stone'), true);
  assert.equal(canBuild(0, 0, 8, 'metal'), false);
});

test('storm circle detection works correctly', () => {
  const storm = {
    centerX: 0,
    centerZ: 0,
    radius: 100,
    targetCenterX: 0,
    targetCenterZ: 0,
    targetRadius: 50,
    phase: 1,
    timeRemainingInPhase: 30,
    isShrinking: false,
    dps: 1,
  };

  assert.equal(isOutsideStorm(50, 50, storm), false); // dist ~70.7 < 100
  assert.equal(isOutsideStorm(120, 0, storm), true); // dist 120 > 100

  // Update storm when shrinking
  storm.isShrinking = true;
  const nextStorm = updateStormCircle(storm, 5, 2);
  assert.equal(nextStorm.radius, 90); // 100 - (5 * 2)
});
