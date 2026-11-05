/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BuiltStructure, BuildType, MaterialType, WeaponType } from './types.ts';

export interface NetworkPlayerState {
  id: string;
  name: string;
  position: [number, number, number];
  rotationY: number;
  health: number;
  shield: number;
  currentWeapon: WeaponType;
  isGliding: boolean;
  isShooting: boolean;
  lastUpdated: number;
}

export type NetworkMessage =
  | { type: 'JOIN'; player: NetworkPlayerState }
  | { type: 'LEAVE'; playerId: string }
  | { type: 'UPDATE'; player: NetworkPlayerState }
  | { type: 'BUILD'; structure: BuiltStructure }
  | { type: 'SHOOT'; playerId: string; origin: [number, number, number]; direction: [number, number, number]; weaponType: WeaponType }
  | { type: 'CHEST_OPEN'; chestId: string; playerId: string }
  | { type: 'ELIMINATE'; killer: string; victim: string; weapon: string; distance: number };

export class MultiplayerManager {
  private channel: BroadcastChannel | null = null;
  public localPlayerId: string;
  public localPlayerName: string;
  public remotePlayers: Map<string, NetworkPlayerState> = new Map();
  public onRemoteBuild?: (structure: BuiltStructure) => void;
  public onRemoteShoot?: (data: { playerId: string; origin: [number, number, number]; direction: [number, number, number]; weaponType: WeaponType }) => void;
  public onRemoteChestOpen?: (chestId: string) => void;
  public onRemoteElimination?: (data: { killer: string; victim: string; weapon: string; distance: number }) => void;
  public onPlayersChange?: (players: NetworkPlayerState[]) => void;

  constructor(playerName: string = 'Player') {
    this.localPlayerId = 'p_' + Math.random().toString(36).substring(2, 9);
    this.localPlayerName = playerName;
  }

  public joinRoom(roomCode: string = 'battle_royale_lobby') {
    if (this.channel) {
      this.channel.close();
    }
    try {
      this.channel = new BroadcastChannel(`fortnite_room_${roomCode}`);
      this.channel.onmessage = (e: MessageEvent<NetworkMessage>) => {
        this.handleMessage(e.data);
      };
    } catch {
      // BroadcastChannel fallback if restricted
    }
  }

  public leaveRoom() {
    if (this.channel) {
      this.broadcast({ type: 'LEAVE', playerId: this.localPlayerId });
      this.channel.close();
      this.channel = null;
    }
    this.remotePlayers.clear();
  }

  public broadcast(msg: NetworkMessage) {
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch {}
    }
  }

  public broadcastPlayerState(state: Omit<NetworkPlayerState, 'id' | 'name' | 'lastUpdated'>) {
    const fullState: NetworkPlayerState = {
      ...state,
      id: this.localPlayerId,
      name: this.localPlayerName,
      lastUpdated: Date.now(),
    };
    this.broadcast({
      type: 'UPDATE',
      player: fullState,
    });
  }

  private handleMessage(msg: NetworkMessage) {
    if (!msg) return;

    if (msg.type === 'UPDATE') {
      if (msg.player.id === this.localPlayerId) return;
      this.remotePlayers.set(msg.player.id, msg.player);
      this.onPlayersChange?.(Array.from(this.remotePlayers.values()));
    } else if (msg.type === 'LEAVE') {
      this.remotePlayers.delete(msg.playerId);
      this.onPlayersChange?.(Array.from(this.remotePlayers.values()));
    } else if (msg.type === 'BUILD') {
      this.onRemoteBuild?.(msg.structure);
    } else if (msg.type === 'SHOOT') {
      if (msg.playerId === this.localPlayerId) return;
      this.onRemoteShoot?.(msg);
    } else if (msg.type === 'CHEST_OPEN') {
      this.onRemoteChestOpen?.(msg.chestId);
    } else if (msg.type === 'ELIMINATE') {
      this.onRemoteElimination?.(msg);
    }
  }

  /**
   * Cleanup stale players who disconnected
   */
  public pruneStalePlayers() {
    const now = Date.now();
    let changed = false;
    this.remotePlayers.forEach((player, id) => {
      if (now - player.lastUpdated > 10000) {
        this.remotePlayers.delete(id);
        changed = true;
      }
    });
    if (changed) {
      this.onPlayersChange?.(Array.from(this.remotePlayers.values()));
    }
  }
}
