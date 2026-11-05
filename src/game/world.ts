/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { ChestData, WeaponDef } from './types.ts';
import { createBoulderMesh, createChestMesh, createPineTreeMesh } from './procedural.ts';

export const ISLAND_RADIUS = 160;

/**
 * Procedural analytical terrain height function
 */
export function getTerrainHeight(x: number, z: number): number {
  const dist = Math.hypot(x, z);

  // Deep ocean falloff past island radius
  if (dist > ISLAND_RADIUS + 20) {
    return -12;
  }
  if (dist > ISLAND_RADIUS - 15) {
    const edgeT = (dist - (ISLAND_RADIUS - 15)) / 35;
    return (1 - edgeT) * 1.5 - edgeT * 12;
  }

  // Multi-octave rolling hills
  const h1 = Math.sin(x * 0.02) * Math.cos(z * 0.02) * 4.5;
  const h2 = Math.sin(x * 0.05 + 1.2) * Math.cos(z * 0.04 - 0.8) * 2.2;
  const h3 = Math.cos((x + z) * 0.015) * 3.0;

  // Central plateau landmark
  const centerDist = Math.hypot(x, z);
  const plateau = Math.max(0, 1 - centerDist / 45) * 4.0;

  return Math.max(0.5, h1 + h2 + h3 + plateau);
}

/**
 * Builds the island mesh with vertex-colored grass & dirt
 */
export function createIslandTerrain(): THREE.Mesh {
  const segments = 90;
  const size = ISLAND_RADIUS * 2.4;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const posAttr = geo.attributes.position;
  const colors: number[] = [];

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const y = getTerrainHeight(x, z);
    posAttr.setY(i, y);

    // Procedural vertex coloring: lush Fortnite green, dirt brown on hills/slopes, sandy beach on coasts
    if (y < 1.0) {
      // Sandy coast
      colors.push(0.85, 0.78, 0.58);
    } else if (y > 7.0) {
      // Rocky hilltops
      colors.push(0.52, 0.58, 0.48);
    } else {
      // Vibrant stylized Fortnite green
      const noise = (Math.sin(x * 0.2) + Math.cos(z * 0.2)) * 0.05;
      colors.push(0.32 + noise, 0.65 + noise, 0.28);
    }
  }

  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.05,
    flatShading: true,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Surrounding ocean plane
 */
export function createOceanMesh(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(800, 800, 16, 16);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x1e6f9f,
    roughness: 0.15,
    metalness: 0.2,
    transparent: true,
    opacity: 0.85,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -0.5;
  return mesh;
}

/**
 * Creates the iconic translucent purple Fortnite storm cylinder
 */
export function createStormMesh(): THREE.Mesh {
  // Unit cylinder that scales with storm radius
  const geo = new THREE.CylinderGeometry(1, 1, 90, 48, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xa855f7,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 45;
  return mesh;
}

export interface WorldObject {
  id: string;
  type: 'tree' | 'rock' | 'chest';
  group: THREE.Group;
  health: number;
  maxHealth: number;
  woodValue: number;
  stoneValue: number;
  chestData?: ChestData;
  lid?: THREE.Group;
}

/**
 * Populates island with trees, rocks, and golden loot chests
 */
export function populateIsland(scene: THREE.Scene): {
  objects: WorldObject[];
  chests: ChestData[];
} {
  const objects: WorldObject[] = [];
  const chests: ChestData[] = [];

  // Deterministic seed locations
  const chestCoords: [number, number][] = [
    [0, 0], // Center plateau
    [18, -12],
    [-22, 16],
    [35, 30],
    [-40, -25],
    [50, -40],
    [-55, 45],
    [10, 60],
    [-15, -65],
    [70, 15],
    [-75, -10],
    [30, -80],
    [-35, 80],
    [85, 55],
    [-85, -60],
  ];

  chestCoords.forEach((coord, idx) => {
    const [x, z] = coord;
    const y = getTerrainHeight(x, z);
    const { group, lid } = createChestMesh();
    group.position.set(x, y, z);
    group.rotation.y = (idx * 1.3) % (Math.PI * 2);

    // Glowing golden chest point light
    const chestLight = new THREE.PointLight(0xffb703, 1.5, 8);
    chestLight.position.set(0, 0.8, 0);
    group.add(chestLight);

    scene.add(group);

    const chestData: ChestData = {
      id: `chest-${idx}`,
      position: [x, y, z],
      rotationY: group.rotation.y,
      opened: false,
      loot: generateChestLoot(),
    };
    chests.push(chestData);

    objects.push({
      id: chestData.id,
      type: 'chest',
      group,
      health: 100,
      maxHealth: 100,
      woodValue: 0,
      stoneValue: 0,
      chestData,
      lid,
    });
  });

  // Trees (Pine groves)
  for (let i = 0; i < 75; i++) {
    const angle = (i * 0.42) + Math.sin(i);
    const radius = 15 + (i * 1.8) % (ISLAND_RADIUS - 25);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = getTerrainHeight(x, z);

    if (y > 0.8) {
      const tree = createPineTreeMesh();
      const scale = 0.85 + Math.random() * 0.35;
      tree.scale.set(scale, scale, scale);
      tree.position.set(x, y, z);
      tree.rotation.y = Math.random() * Math.PI * 2;
      scene.add(tree);

      objects.push({
        id: `tree-${i}`,
        type: 'tree',
        group: tree,
        health: 200,
        maxHealth: 200,
        woodValue: 25,
        stoneValue: 0,
      });
    }
  }

  // Boulders (Stone harvesting)
  for (let i = 0; i < 40; i++) {
    const angle = (i * 0.73) + Math.cos(i);
    const radius = 20 + (i * 3.1) % (ISLAND_RADIUS - 30);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = getTerrainHeight(x, z);

    if (y > 0.8) {
      const boulder = createBoulderMesh();
      const scale = 0.8 + Math.random() * 0.4;
      boulder.scale.set(scale, scale, scale);
      boulder.position.set(x, y, z);
      boulder.rotation.y = Math.random() * Math.PI * 2;
      scene.add(boulder);

      objects.push({
        id: `rock-${i}`,
        type: 'rock',
        group: boulder,
        health: 300,
        maxHealth: 300,
        woodValue: 0,
        stoneValue: 35,
      });
    }
  }

  return { objects, chests };
}

/**
 * Generates random high tier loot when a golden chest is popped
 */
export function generateChestLoot(): WeaponDef[] {
  const loot: WeaponDef[] = [];

  // Always guarantees 1 high-tier weapon
  const roll = Math.random();
  if (roll < 0.45) {
    // Legendary or Epic AR
    loot.push({
      id: `ar-${Date.now()}`,
      name: 'Legendary SCAR',
      type: 'ar',
      rarity: 'legendary',
      damage: 36,
      fireRate: 5.5,
      clipSize: 30,
      currentClip: 30,
      reserveAmmo: 90,
      reloadTime: 2.1,
      range: 120,
      spread: 0.015,
      color: '#eab308',
    });
  } else if (roll < 0.8) {
    // Pump Shotgun
    loot.push({
      id: `shotgun-${Date.now()}`,
      name: 'Pump Shotgun',
      type: 'shotgun',
      rarity: 'epic',
      damage: 95,
      fireRate: 0.8,
      clipSize: 5,
      currentClip: 5,
      reserveAmmo: 20,
      reloadTime: 3.5,
      range: 25,
      spread: 0.05,
      pellets: 10,
      color: '#a855f7',
    });
  } else {
    // Bolt-Action Sniper
    loot.push({
      id: `sniper-${Date.now()}`,
      name: 'Bolt Sniper',
      type: 'sniper',
      rarity: 'rare',
      damage: 105,
      fireRate: 0.35,
      clipSize: 1,
      currentClip: 1,
      reserveAmmo: 8,
      reloadTime: 2.8,
      range: 250,
      spread: 0.002,
      zoomFov: 25,
      color: '#3b82f6',
    });
  }

  // Plus shields / consumables
  loot.push({
    id: `minishield-${Date.now()}`,
    name: 'Mini Shield Potion',
    type: 'minishield',
    rarity: 'uncommon',
    damage: 0,
    fireRate: 1,
    clipSize: 3,
    currentClip: 3,
    reserveAmmo: 0,
    reloadTime: 0,
    range: 0,
    spread: 0,
    healAmount: 25,
    healType: 'shield',
    useTime: 2.0,
    color: '#22c55e',
  });

  return loot;
}
