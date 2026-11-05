/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type WeaponRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type WeaponType = 'pickaxe' | 'ar' | 'shotgun' | 'sniper' | 'minishield' | 'medkit';

export interface WeaponDef {
  id: string;
  name: string;
  type: WeaponType;
  rarity: WeaponRarity;
  damage: number;
  fireRate: number; // shots per sec
  clipSize: number;
  currentClip: number;
  reserveAmmo: number;
  reloadTime: number; // seconds
  range: number;
  spread: number; // bloom
  pellets?: number;
  zoomFov?: number;
  healAmount?: number;
  healType?: 'shield' | 'health';
  useTime?: number; // seconds
  color: string;
}

export type BuildType = 'wall' | 'ramp' | 'floor' | 'cone';
export type MaterialType = 'wood' | 'stone' | 'metal';

export interface BuiltStructure {
  id: string;
  type: BuildType;
  material: MaterialType;
  position: [number, number, number];
  rotationY: number;
  health: number;
  maxHealth: number;
  ownerId: string;
}

export interface ChestData {
  id: string;
  position: [number, number, number];
  rotationY: number;
  opened: boolean;
  loot?: WeaponDef[];
}

export interface DamageNumber {
  id: string;
  text: string;
  position: [number, number, number];
  color: 'yellow' | 'blue' | 'white';
  createdAt: number;
}

export interface KillFeedEntry {
  id: string;
  killer: string;
  victim: string;
  weapon: string;
  distance: number;
  time: number;
}

export type GameMode = 'battle_royale' | 'build_fight' | 'free_build';
export type GameState = 'title' | 'bus' | 'playing' | 'paused' | 'gameover' | 'victory';

export interface PlayerStats {
  health: number;
  shield: number;
  wood: number;
  stone: number;
  metal: number;
  kills: number;
  accuracy: number;
  damageDealt: number;
  structuresBuilt: number;
  placement: number;
}
