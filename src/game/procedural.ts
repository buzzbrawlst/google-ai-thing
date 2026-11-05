/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { BuildType, MaterialType, WeaponType } from './types.ts';

// Shared PBR materials & geometries cache for high performance & zero GC
const sharedMaterials = {
  skin: new THREE.MeshStandardMaterial({ color: 0xdca882, roughness: 0.6 }),
  shirt: new THREE.MeshStandardMaterial({ color: 0x2b4263, roughness: 0.7 }),
  pants: new THREE.MeshStandardMaterial({ color: 0x36454f, roughness: 0.8 }),
  boots: new THREE.MeshStandardMaterial({ color: 0x1f1f1f, roughness: 0.5 }),
  vest: new THREE.MeshStandardMaterial({ color: 0x3e4d3a, roughness: 0.6 }),
  hair: new THREE.MeshStandardMaterial({ color: 0x964b00, roughness: 0.7 }),
  visor: new THREE.MeshStandardMaterial({ color: 0x00d2ff, roughness: 0.2, metalness: 0.8 }),
  backpack: new THREE.MeshStandardMaterial({ color: 0x7c4700, roughness: 0.8 }),

  // Enemy colors
  enemyShirt: new THREE.MeshStandardMaterial({ color: 0x8a2424, roughness: 0.7 }),
  enemyPants: new THREE.MeshStandardMaterial({ color: 0x242424, roughness: 0.8 }),

  // Environment materials
  trunk: new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 }),
  foliagePine: new THREE.MeshStandardMaterial({ color: 0x2e6f40, roughness: 0.8 }),
  foliageOak: new THREE.MeshStandardMaterial({ color: 0x488a38, roughness: 0.8 }),
  rock: new THREE.MeshStandardMaterial({ color: 0x7a7a7a, roughness: 0.85, metalness: 0.1 }),

  // Chest
  chestGold: new THREE.MeshStandardMaterial({ color: 0xdfa012, roughness: 0.3, metalness: 0.7 }),
  chestWood: new THREE.MeshStandardMaterial({ color: 0x4a2a12, roughness: 0.8 }),
  chestMetal: new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.8 }),

  // Weapons
  gunMetal: new THREE.MeshStandardMaterial({ color: 0x222629, roughness: 0.3, metalness: 0.8 }),
  gunWood: new THREE.MeshStandardMaterial({ color: 0x7c4700, roughness: 0.7 }),
  gunGold: new THREE.MeshStandardMaterial({ color: 0xe5a93c, roughness: 0.2, metalness: 0.9 }),
  gunGrip: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }),
  potionBottle: new THREE.MeshPhysicalMaterial({ color: 0x00e1ff, roughness: 0.1, transmission: 0.8, transparent: true, opacity: 0.85 }),

  // Building materials
  woodBuild: new THREE.MeshStandardMaterial({ color: 0x936037, roughness: 0.85 }),
  stoneBuild: new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 }),
  metalBuild: new THREE.MeshStandardMaterial({ color: 0x546e7a, roughness: 0.4, metalness: 0.7 }),

  // Blueprint holographic materials
  blueprintValid: new THREE.MeshBasicMaterial({
    color: 0x00bfff,
    wireframe: true,
    transparent: true,
    opacity: 0.7,
  }),
  blueprintInvalid: new THREE.MeshBasicMaterial({
    color: 0xff3333,
    wireframe: true,
    transparent: true,
    opacity: 0.6,
  }),
};

/**
 * Creates a stylized Fortnite character model (Group of 10+ sub-parts)
 */
export function createCharacterMesh(isEnemy: boolean = false): {
  group: THREE.Group;
  parts: {
    head: THREE.Object3D;
    torso: THREE.Object3D;
    leftArm: THREE.Object3D;
    rightArm: THREE.Object3D;
    leftLeg: THREE.Object3D;
    rightLeg: THREE.Object3D;
    handSlot: THREE.Object3D;
    glider: THREE.Group;
  };
} {
  const group = new THREE.Group();

  // Torso
  const torsoGeo = new THREE.BoxGeometry(0.65, 0.75, 0.35);
  const torso = new THREE.Mesh(torsoGeo, isEnemy ? sharedMaterials.enemyShirt : sharedMaterials.shirt);
  torso.position.y = 1.35;
  torso.castShadow = true;
  group.add(torso);

  // Tactical Vest
  const vestGeo = new THREE.BoxGeometry(0.7, 0.55, 0.4);
  const vest = new THREE.Mesh(vestGeo, sharedMaterials.vest);
  vest.position.set(0, 0.05, 0);
  vest.castShadow = true;
  torso.add(vest);

  // Backbling Backpack
  const backpackGeo = new THREE.BoxGeometry(0.4, 0.45, 0.22);
  const backpack = new THREE.Mesh(backpackGeo, sharedMaterials.backpack);
  backpack.position.set(0, 0.05, -0.28);
  torso.add(backpack);

  // Neck & Head
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.48, 0);
  torso.add(headPivot);

  const headGeo = new THREE.BoxGeometry(0.38, 0.42, 0.38);
  const head = new THREE.Mesh(headGeo, sharedMaterials.skin);
  head.position.y = 0.22;
  head.castShadow = true;
  headPivot.add(head);

  // Hair / Helmet
  const hairGeo = new THREE.BoxGeometry(0.42, 0.2, 0.42);
  const hair = new THREE.Mesh(hairGeo, sharedMaterials.hair);
  hair.position.y = 0.16;
  head.add(hair);

  // Goggles / Visor
  const visorGeo = new THREE.BoxGeometry(0.34, 0.1, 0.1);
  const visor = new THREE.Mesh(visorGeo, sharedMaterials.visor);
  visor.position.set(0, 0.04, 0.2);
  head.add(visor);

  // Left Arm (pivot at shoulder)
  const leftArm = new THREE.Group();
  leftArm.position.set(0.45, 0.3, 0);
  torso.add(leftArm);
  const armGeo = new THREE.BoxGeometry(0.2, 0.65, 0.2);
  const leftArmMesh = new THREE.Mesh(armGeo, isEnemy ? sharedMaterials.enemyShirt : sharedMaterials.shirt);
  leftArmMesh.position.y = -0.3;
  leftArmMesh.castShadow = true;
  leftArm.add(leftArmMesh);

  // Right Arm
  const rightArm = new THREE.Group();
  rightArm.position.set(-0.45, 0.3, 0);
  torso.add(rightArm);
  const rightArmMesh = new THREE.Mesh(armGeo, isEnemy ? sharedMaterials.enemyShirt : sharedMaterials.shirt);
  rightArmMesh.position.y = -0.3;
  rightArmMesh.castShadow = true;
  rightArm.add(rightArmMesh);

  // Hand slot for weapons
  const handSlot = new THREE.Group();
  handSlot.position.set(0, -0.6, 0.1);
  rightArm.add(handSlot);

  // Left Leg
  const leftLeg = new THREE.Group();
  leftLeg.position.set(0.2, 0.95, 0);
  group.add(leftLeg);
  const legGeo = new THREE.BoxGeometry(0.24, 0.85, 0.26);
  const leftLegMesh = new THREE.Mesh(legGeo, isEnemy ? sharedMaterials.enemyPants : sharedMaterials.pants);
  leftLegMesh.position.y = -0.42;
  leftLegMesh.castShadow = true;
  leftLeg.add(leftLegMesh);

  const bootGeo = new THREE.BoxGeometry(0.26, 0.25, 0.35);
  const leftBoot = new THREE.Mesh(bootGeo, sharedMaterials.boots);
  leftBoot.position.set(0, -0.75, 0.05);
  leftLeg.add(leftBoot);

  // Right Leg
  const rightLeg = new THREE.Group();
  rightLeg.position.set(-0.2, 0.95, 0);
  group.add(rightLeg);
  const rightLegMesh = new THREE.Mesh(legGeo, isEnemy ? sharedMaterials.enemyPants : sharedMaterials.pants);
  rightLegMesh.position.y = -0.42;
  rightLegMesh.castShadow = true;
  rightLeg.add(rightLegMesh);

  const rightBoot = new THREE.Mesh(bootGeo, sharedMaterials.boots);
  rightBoot.position.set(0, -0.75, 0.05);
  rightLeg.add(rightBoot);

  // Glider / Umbrella (toggled when skydiving)
  const glider = createGliderMesh();
  glider.position.set(0, 2.4, 0);
  glider.visible = false;
  group.add(glider);

  return {
    group,
    parts: {
      head: headPivot,
      torso,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      handSlot,
      glider,
    },
  };
}

/**
 * Creates the iconic Fortnite umbrella / glider
 */
export function createGliderMesh(): THREE.Group {
  const glider = new THREE.Group();

  // Streamlined Glider Wings / Canopy
  const canopyGeo = new THREE.ConeGeometry(1.3, 0.35, 8, 1, true);
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x2563eb,
    roughness: 0.4,
    side: THREE.DoubleSide,
  });
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.rotation.x = Math.PI;
  canopy.position.y = 0.55;
  glider.add(canopy);

  // Glider Accent Stripe
  const stripeGeo = new THREE.BoxGeometry(2.1, 0.04, 0.3);
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 });
  const stripe = new THREE.Mesh(stripeGeo, stripeMat);
  stripe.position.y = 0.45;
  glider.add(stripe);

  // Lightweight Frame Struts
  const shaftGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.2, 6);
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.position.y = -0.15;
  glider.add(shaft);

  // Dual grab handles
  const handleGeo = new THREE.BoxGeometry(0.5, 0.04, 0.06);
  const handle = new THREE.Mesh(handleGeo, shaftMat);
  handle.position.y = -0.75;
  glider.add(handle);

  return glider;
}

/**
 * Creates weapons for player hands and world pickups
 */
export function createWeaponMesh(type: WeaponType): THREE.Group {
  const weapon = new THREE.Group();

  if (type === 'pickaxe') {
    // Shaft
    const handleGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8);
    const handle = new THREE.Mesh(handleGeo, sharedMaterials.gunWood);
    handle.rotation.z = Math.PI / 6;
    weapon.add(handle);

    // Pickaxe head
    const headGeo = new THREE.BoxGeometry(0.1, 0.5, 0.15);
    const head = new THREE.Mesh(headGeo, sharedMaterials.gunMetal);
    head.position.set(0.25, 0.45, 0);
    head.rotation.z = -Math.PI / 3;
    weapon.add(head);

    const tipGeo = new THREE.ConeGeometry(0.08, 0.25, 4);
    const tip = new THREE.Mesh(tipGeo, sharedMaterials.gunGold);
    tip.position.set(0.45, 0.55, 0);
    tip.rotation.z = -Math.PI / 2.5;
    weapon.add(tip);
  } else if (type === 'ar') {
    // Assault Rifle
    const bodyGeo = new THREE.BoxGeometry(0.1, 0.18, 0.7);
    const body = new THREE.Mesh(bodyGeo, sharedMaterials.gunGold);
    weapon.add(body);

    const barrelGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8);
    const barrel = new THREE.Mesh(barrelGeo, sharedMaterials.gunMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.04, 0.5);
    weapon.add(barrel);

    const magGeo = new THREE.BoxGeometry(0.06, 0.25, 0.12);
    const mag = new THREE.Mesh(magGeo, sharedMaterials.gunMetal);
    mag.position.set(0, -0.15, 0.05);
    mag.rotation.x = 0.2;
    weapon.add(mag);

    const gripGeo = new THREE.BoxGeometry(0.06, 0.18, 0.08);
    const grip = new THREE.Mesh(gripGeo, sharedMaterials.gunGrip);
    grip.position.set(0, -0.12, -0.2);
    grip.rotation.x = -0.3;
    weapon.add(grip);
  } else if (type === 'shotgun') {
    // Pump Shotgun
    const bodyGeo = new THREE.BoxGeometry(0.1, 0.16, 0.65);
    const body = new THREE.Mesh(bodyGeo, sharedMaterials.gunMetal);
    weapon.add(body);

    const barrelGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8);
    const barrel = new THREE.Mesh(barrelGeo, sharedMaterials.gunMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.05, 0.5);
    weapon.add(barrel);

    const pumpGeo = new THREE.BoxGeometry(0.12, 0.1, 0.2);
    const pump = new THREE.Mesh(pumpGeo, sharedMaterials.gunWood);
    pump.position.set(0, 0, 0.35);
    weapon.add(pump);

    const stockGeo = new THREE.BoxGeometry(0.08, 0.15, 0.3);
    const stock = new THREE.Mesh(stockGeo, sharedMaterials.gunWood);
    stock.position.set(0, -0.05, -0.38);
    weapon.add(stock);
  } else if (type === 'sniper') {
    // Bolt Action Sniper
    const bodyGeo = new THREE.BoxGeometry(0.08, 0.14, 0.9);
    const body = new THREE.Mesh(bodyGeo, sharedMaterials.gunMetal);
    weapon.add(body);

    const barrelGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.8, 8);
    const barrel = new THREE.Mesh(barrelGeo, sharedMaterials.gunMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, 0.7);
    weapon.add(barrel);

    // Sniper Scope
    const scopeGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.35, 12);
    const scope = new THREE.Mesh(scopeGeo, sharedMaterials.gunMetal);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.14, 0.05);
    weapon.add(scope);
  } else if (type === 'minishield' || type === 'medkit') {
    // Mini Shield / Medkit
    if (type === 'minishield') {
      const bottleGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.3, 12);
      const bottle = new THREE.Mesh(bottleGeo, sharedMaterials.potionBottle);
      weapon.add(bottle);

      const corkGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8);
      const cork = new THREE.Mesh(corkGeo, sharedMaterials.gunWood);
      cork.position.y = 0.18;
      weapon.add(cork);
    } else {
      const boxGeo = new THREE.BoxGeometry(0.35, 0.25, 0.15);
      const box = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0xef4444 }));
      weapon.add(box);

      const crossGeo = new THREE.BoxGeometry(0.12, 0.12, 0.16);
      const cross = new THREE.Mesh(crossGeo, new THREE.MeshStandardMaterial({ color: 0xffffff }));
      weapon.add(cross);
    }
  }

  return weapon;
}

/**
 * Creates the signature Golden Fortnite Chest
 */
export function createChestMesh(): { group: THREE.Group; lid: THREE.Group } {
  const group = new THREE.Group();

  // Bottom Box
  const baseGeo = new THREE.BoxGeometry(1.2, 0.6, 0.8);
  const base = new THREE.Mesh(baseGeo, sharedMaterials.chestWood);
  base.position.y = 0.3;
  base.castShadow = true;
  group.add(base);

  // Metal Corner Straps
  const trimGeo = new THREE.BoxGeometry(1.24, 0.62, 0.12);
  const trim1 = new THREE.Mesh(trimGeo, sharedMaterials.chestGold);
  trim1.position.set(0, 0.3, 0.35);
  group.add(trim1);

  const trim2 = new THREE.Mesh(trimGeo, sharedMaterials.chestGold);
  trim2.position.set(0, 0.3, -0.35);
  group.add(trim2);

  // Lid pivot (attached at back upper edge)
  const lid = new THREE.Group();
  lid.position.set(0, 0.6, -0.4);
  group.add(lid);

  const lidGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.2, 12, 1, false, 0, Math.PI);
  const lidMesh = new THREE.Mesh(lidGeo, sharedMaterials.chestWood);
  lidMesh.rotation.z = Math.PI / 2;
  lidMesh.position.set(0, 0, 0.4);
  lidMesh.castShadow = true;
  lid.add(lidMesh);

  // Gold Lock Clasp
  const lockGeo = new THREE.BoxGeometry(0.16, 0.2, 0.08);
  const lock = new THREE.Mesh(lockGeo, sharedMaterials.chestGold);
  lock.position.set(0, -0.05, 0.82);
  lid.add(lock);

  // Soft contact shadow disc underneath
  const shadowGeo = new THREE.CircleGeometry(0.8, 16);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  group.add(shadow);

  return { group, lid };
}

/**
 * Creates modular Fortnite building structures (Wall, Ramp, Floor, Cone)
 */
export function createBuildingMesh(
  type: BuildType,
  material: MaterialType,
  isHologram: boolean = false,
  isValid: boolean = true
): THREE.Group {
  const group = new THREE.Group();
  const mat = isHologram
    ? (isValid ? sharedMaterials.blueprintValid : sharedMaterials.blueprintInvalid)
    : (material === 'stone' ? sharedMaterials.stoneBuild : material === 'metal' ? sharedMaterials.metalBuild : sharedMaterials.woodBuild);

  if (type === 'wall') {
    // 4m wide x 3.5m tall x 0.15m thick
    const wallGeo = new THREE.BoxGeometry(4.0, 3.5, 0.16);
    const wall = new THREE.Mesh(wallGeo, mat);
    wall.castShadow = !isHologram;
    wall.receiveShadow = !isHologram;
    group.add(wall);

    if (!isHologram) {
      // Wood cross-beams detail
      const beamGeo = new THREE.BoxGeometry(4.05, 0.25, 0.22);
      const beamTop = new THREE.Mesh(beamGeo, mat);
      beamTop.position.y = 1.6;
      group.add(beamTop);

      const beamBottom = new THREE.Mesh(beamGeo, mat);
      beamBottom.position.y = -1.6;
      group.add(beamBottom);
    }
  } else if (type === 'ramp') {
    // 45 degree ramp connecting (0,0,0) to (0, 3.5, 4.0)
    const rampLength = Math.hypot(4.0, 3.5);
    const rampAngle = Math.atan2(3.5, 4.0);
    const rampGeo = new THREE.BoxGeometry(4.0, 0.15, rampLength);
    const ramp = new THREE.Mesh(rampGeo, mat);
    ramp.rotation.x = rampAngle;
    ramp.position.set(0, 1.75, 0);
    ramp.castShadow = !isHologram;
    ramp.receiveShadow = !isHologram;
    group.add(ramp);
  } else if (type === 'floor') {
    // 4m x 4m flat floor
    const floorGeo = new THREE.BoxGeometry(4.0, 0.16, 4.0);
    const floor = new THREE.Mesh(floorGeo, mat);
    floor.castShadow = !isHologram;
    floor.receiveShadow = !isHologram;
    group.add(floor);
  } else if (type === 'cone') {
    // 4-sided pyramid roof
    const coneGeo = new THREE.ConeGeometry(2.8, 2.0, 4);
    const cone = new THREE.Mesh(coneGeo, mat);
    cone.position.y = 1.0;
    cone.rotation.y = Math.PI / 4;
    cone.castShadow = !isHologram;
    cone.receiveShadow = !isHologram;
    group.add(cone);
  }

  return group;
}

/**
 * Creates procedural pine tree
 */
export function createPineTreeMesh(): THREE.Group {
  const tree = new THREE.Group();

  // Trunk
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 3.0, 6);
  const trunk = new THREE.Mesh(trunkGeo, sharedMaterials.trunk);
  trunk.position.y = 1.5;
  trunk.castShadow = true;
  tree.add(trunk);

  // 3-tiered conical pine foliage
  const tiers = [
    { y: 3.2, r: 2.2, h: 2.5 },
    { y: 4.8, r: 1.7, h: 2.2 },
    { y: 6.2, r: 1.1, h: 1.8 },
  ];

  tiers.forEach((t) => {
    const folGeo = new THREE.ConeGeometry(t.r, t.h, 7);
    const foliage = new THREE.Mesh(folGeo, sharedMaterials.foliagePine);
    foliage.position.y = t.y;
    foliage.castShadow = true;
    tree.add(foliage);
  });

  return tree;
}

/**
 * Creates procedural boulder
 */
export function createBoulderMesh(): THREE.Group {
  const boulder = new THREE.Group();
  const geo = new THREE.DodecahedronGeometry(1.4, 1);
  const mesh = new THREE.Mesh(geo, sharedMaterials.rock);
  mesh.position.y = 1.1;
  mesh.scale.set(1.2, 0.9, 1.1);
  mesh.castShadow = true;
  boulder.add(mesh);
  return boulder;
}
