/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BuildType, MaterialType, WeaponDef, WeaponRarity } from './types.ts';

export const GRID_SIZE = 4.0;
export const WALL_HEIGHT = 3.5;

export const MATERIAL_STATS: Record<MaterialType, { maxHp: number; cost: number; color: number }> = {
  wood: { maxHp: 150, cost: 10, color: 0x8b5a2b },
  stone: { maxHp: 300, cost: 10, color: 0x808080 },
  metal: { maxHp: 500, cost: 10, color: 0x4a646c },
};

/**
 * Snaps continuous 3D world coordinates to the Fortnite building grid
 */
export function snapToBuildGrid(
  playerPos: [number, number, number],
  aimDir: [number, number, number],
  buildType: BuildType
): { position: [number, number, number]; rotationY: number } {
  const [px, py, pz] = playerPos;
  const [dx, , dz] = aimDir;

  // Determine primary aim direction on horizontal plane
  const angle = Math.atan2(dx, dz);
  // Quantize rotation to 4 cardinal directions: 0, Math.PI/2, Math.PI, -Math.PI/2
  const sector = Math.round(angle / (Math.PI / 2));
  const snapRotY = sector * (Math.PI / 2);

  // Forward unit vector in chosen cardinal direction
  const fwdX = Math.sin(snapRotY);
  const fwdZ = Math.cos(snapRotY);

  // Cell coords
  const cellX = Math.round(px / GRID_SIZE) * GRID_SIZE;
  const cellY = Math.round(py / WALL_HEIGHT) * WALL_HEIGHT;
  const cellZ = Math.round(pz / GRID_SIZE) * GRID_SIZE;

  let targetX = cellX;
  let targetY = cellY;
  let targetZ = cellZ;

  if (buildType === 'wall') {
    // Wall sits on the boundary between current cell and forward cell
    targetX = cellX + (fwdX * GRID_SIZE) / 2;
    targetZ = cellZ + (fwdZ * GRID_SIZE) / 2;
    targetY = cellY + WALL_HEIGHT / 2;
  } else if (buildType === 'ramp') {
    targetX = cellX + fwdX * GRID_SIZE * 0.75;
    targetZ = cellZ + fwdZ * GRID_SIZE * 0.75;
    targetY = cellY;
  } else if (buildType === 'floor') {
    targetX = cellX + fwdX * (GRID_SIZE / 2);
    targetZ = cellZ + fwdZ * (GRID_SIZE / 2);
    targetY = cellY;
  } else if (buildType === 'cone') {
    targetX = cellX + fwdX * (GRID_SIZE / 2);
    targetZ = cellZ + fwdZ * (GRID_SIZE / 2);
    targetY = cellY;
  }

  return {
    position: [targetX, targetY, targetZ],
    rotationY: snapRotY,
  };
}

/**
 * Calculates weapon damage based on hit location (headshot multiplier), range falloff, and shields
 */
export function calculateDamage(
  baseDamage: number,
  isHeadshot: boolean,
  distance: number,
  maxRange: number,
  isShotgun: boolean = false
): { damage: number; isHeadshot: boolean } {
  let multiplier = 1.0;
  if (isHeadshot) {
    multiplier = isShotgun ? 1.75 : 1.5;
  }

  // Linear falloff past 50% max range, down to 70% min damage
  const falloffStart = maxRange * 0.5;
  let rangeFactor = 1.0;
  if (distance > falloffStart) {
    const excess = Math.min(distance - falloffStart, maxRange - falloffStart);
    rangeFactor = 1.0 - (excess / (maxRange - falloffStart)) * 0.3;
  }

  const finalDamage = Math.max(1, Math.round(baseDamage * multiplier * rangeFactor));
  return {
    damage: finalDamage,
    isHeadshot,
  };
}

/**
 * Apply damage to player: shield absorbs first, remainder to health
 */
export function applyDamageToPlayer(
  currentHealth: number,
  currentShield: number,
  damage: number
): { newHealth: number; newShield: number; damageDealtToShield: number; damageDealtToHealth: number; isEliminated: boolean } {
  let shieldDmg = 0;
  let healthDmg = 0;

  if (currentShield > 0) {
    shieldDmg = Math.min(currentShield, damage);
    damage -= shieldDmg;
  }
  if (damage > 0) {
    healthDmg = Math.min(currentHealth, damage);
  }

  const newShield = Math.max(0, currentShield - shieldDmg);
  const newHealth = Math.max(0, currentHealth - healthDmg);

  return {
    newHealth,
    newShield,
    damageDealtToShield: shieldDmg,
    damageDealtToHealth: healthDmg,
    isEliminated: newHealth <= 0,
  };
}

/**
 * Checks if a player has enough materials to build a structure
 */
export function canBuild(
  currentWood: number,
  currentStone: number,
  currentMetal: number,
  material: MaterialType
): boolean {
  const cost = MATERIAL_STATS[material].cost;
  if (material === 'wood') return currentWood >= cost;
  if (material === 'stone') return currentStone >= cost;
  if (material === 'metal') return currentMetal >= cost;
  return false;
}

/**
 * Computes storm circle radius and center over elapsed match time
 */
export interface StormCircle {
  centerX: number;
  centerZ: number;
  radius: number;
  targetCenterX: number;
  targetCenterZ: number;
  targetRadius: number;
  phase: number;
  timeRemainingInPhase: number;
  isShrinking: boolean;
  dps: number;
}

export function updateStormCircle(
  current: StormCircle,
  dt: number,
  shrinkSpeed: number = 2.0
): StormCircle {
  const updated = { ...current };
  updated.timeRemainingInPhase -= dt;

  if (updated.isShrinking) {
    // Lerp radius towards target
    if (updated.radius > updated.targetRadius) {
      updated.radius = Math.max(updated.targetRadius, updated.radius - shrinkSpeed * dt);
    }
    // Lerp center towards target
    const dx = updated.targetCenterX - updated.centerX;
    const dz = updated.targetCenterZ - updated.centerZ;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.1) {
      const step = Math.min(dist, shrinkSpeed * 0.5 * dt);
      updated.centerX += (dx / dist) * step;
      updated.centerZ += (dz / dist) * step;
    }

    if (updated.timeRemainingInPhase <= 0 || updated.radius <= updated.targetRadius) {
      // Completed shrinking, advance to next wait phase
      updated.isShrinking = false;
      updated.phase += 1;
      updated.timeRemainingInPhase = 30; // 30s wait before next shrink
      updated.dps = Math.min(10, updated.phase * 2);
      // Pick next target circle inside current
      const maxOffset = Math.max(0, updated.radius * 0.35);
      const angle = Math.random() * Math.PI * 2;
      const offset = Math.random() * maxOffset;
      updated.targetCenterX = updated.centerX + Math.cos(angle) * offset;
      updated.targetCenterZ = updated.centerZ + Math.sin(angle) * offset;
      updated.targetRadius = Math.max(15, updated.radius * 0.55);
    }
  } else {
    // Waiting phase
    if (updated.timeRemainingInPhase <= 0) {
      updated.isShrinking = true;
      updated.timeRemainingInPhase = 45; // 45s shrink duration
    }
  }

  return updated;
}

/**
 * Checks if position is outside storm circle
 */
export function isOutsideStorm(x: number, z: number, storm: StormCircle): boolean {
  const dist = Math.hypot(x - storm.centerX, z - storm.centerZ);
  return dist > storm.radius;
}
