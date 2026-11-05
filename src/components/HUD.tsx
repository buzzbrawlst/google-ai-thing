/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  BuildType,
  DamageNumber,
  KillFeedEntry,
  MaterialType,
  PlayerStats,
  WeaponDef,
} from '../game/types.ts';
import { StormCircle } from '../game/rules.ts';
import { soundEngine } from '../game/audio.ts';
import { Volume2, VolumeX, Shield, Heart, Axe, Layers } from 'lucide-react';

interface HUDProps {
  stats: PlayerStats;
  inventory: WeaponDef[];
  activeSlot: number;
  storm: StormCircle;
  isBuildingMode: boolean;
  buildType: BuildType;
  buildMaterial: MaterialType;
  killFeed: KillFeedEntry[];
  damageNumbers: DamageNumber[];
  hitmarker: { isHeadshot: boolean; timestamp: number } | null;
  useProgress: number | null;
  onSelectSlot: (idx: number) => void;
  onToggleBuildMode: () => void;
  onSelectBuildType: (type: BuildType) => void;
  onSelectMaterial: (mat: MaterialType) => void;
  onTogglePause: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  stats,
  inventory,
  activeSlot,
  storm,
  isBuildingMode,
  buildType,
  buildMaterial,
  killFeed,
  damageNumbers,
  hitmarker,
  useProgress,
  onSelectSlot,
  onToggleBuildMode,
  onSelectBuildType,
  onSelectMaterial,
  onTogglePause,
}) => {
  const [isMuted, setIsMuted] = useState(soundEngine.getMuted());
  const activeWeapon = inventory[activeSlot];

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const muted = soundEngine.toggleMute();
    setIsMuted(muted);
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary':
        return 'border-amber-400 bg-amber-500/20 text-amber-300';
      case 'epic':
        return 'border-purple-500 bg-purple-500/20 text-purple-300';
      case 'rare':
        return 'border-blue-500 bg-blue-500/20 text-blue-300';
      case 'uncommon':
        return 'border-emerald-500 bg-emerald-500/20 text-emerald-300';
      default:
        return 'border-slate-500 bg-slate-500/20 text-slate-300';
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none select-none z-20 flex flex-col justify-between p-4 overflow-hidden font-sans">
      {/* Top Bar: Match Info, Storm Banner & Minimap */}
      <div className="flex items-start justify-between w-full">
        {/* Left: Killfeed & Alive Counter */}
        <div className="flex flex-col gap-2">
          {/* Alive & Kills Pill */}
          <div className="flex items-center gap-4 bg-slate-900/90 border border-slate-700/80 px-4 py-2 rounded-lg text-white shadow-lg backdrop-blur-none">
            <div className="flex items-center gap-1.5 font-black text-sm tracking-wide">
              <span className="text-slate-400">ALIVE:</span>
              <span className="text-emerald-400 text-base">{stats.placement}</span>
            </div>
            <div className="h-4 w-px bg-slate-700" />
            <div className="flex items-center gap-1.5 font-black text-sm tracking-wide">
              <span className="text-slate-400">ELIMS:</span>
              <span className="text-amber-400 text-base">{stats.kills}</span>
            </div>
          </div>

          {/* Killfeed entries */}
          <div className="flex flex-col gap-1.5 max-w-sm mt-1">
            {killFeed.slice(-4).map((entry) => (
              <div
                key={entry.id}
                className="bg-slate-950/85 border-l-4 border-amber-500 px-3 py-1 text-xs text-white rounded-r shadow animate-fade-in flex items-center gap-1.5"
              >
                <span className="font-bold text-amber-300">{entry.killer}</span>
                <span className="text-slate-400">eliminated</span>
                <span className="font-semibold text-slate-200">{entry.victim}</span>
                <span className="text-slate-400 text-[10px]">({entry.weapon} {entry.distance}m)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Center: Storm Countdown */}
        <div className="flex flex-col items-center">
          <div className="bg-slate-900/95 border-2 border-purple-500/80 px-5 py-2 rounded-lg shadow-xl flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-xs uppercase font-extrabold tracking-wider text-purple-300">
              {storm.isShrinking ? 'Storm Eye Shrinking' : 'Storm Shrinks In'}
            </span>
            <span className="text-lg font-black text-white tabular-nums">
              {Math.max(0, Math.floor(storm.timeRemainingInPhase))}s
            </span>
          </div>
        </div>

        {/* Top Right: Minimap & Sound / Pause buttons */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={handleToggleMute}
              className="p-2 bg-slate-900/90 border border-slate-700 text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Toggle Audio (M)"
            >
              {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
            </button>
            <button
              onClick={onTogglePause}
              className="px-3 py-2 bg-slate-900/90 border border-slate-700 text-white font-bold text-xs rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Pause (Esc)"
            >
              MENU [ESC]
            </button>
          </div>

          {/* Minimap radar */}
          <div className="relative w-36 h-36 bg-slate-950/90 border-2 border-slate-700 rounded-xl overflow-hidden shadow-2xl flex items-center justify-center">
            {/* Outer storm boundary */}
            <div
              className="absolute rounded-full border border-purple-500/80 bg-purple-500/10 transition-all duration-300"
              style={{
                width: `${Math.min(100, (storm.radius / 170) * 100)}%`,
                height: `${Math.min(100, (storm.radius / 170) * 100)}%`,
              }}
            />
            {/* Safe zone target circle */}
            <div
              className="absolute rounded-full border border-white/80 border-dashed"
              style={{
                width: `${Math.min(100, (storm.targetRadius / 170) * 100)}%`,
                height: `${Math.min(100, (storm.targetRadius / 170) * 100)}%`,
              }}
            />
            {/* Player marker triangle */}
            <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[10px] border-b-amber-400 z-10" />
            <div className="absolute bottom-1 left-2 text-[9px] font-bold text-slate-400 uppercase">
              Eye: Phase {storm.phase}
            </div>
          </div>
        </div>
      </div>

      {/* Center: Reticle & Hitmarker */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* Dynamic Crosshair */}
        <div className="relative w-8 h-8 flex items-center justify-center">
          <div className="absolute w-1 h-3 -top-3 bg-white/90 shadow" />
          <div className="absolute w-1 h-3 -bottom-3 bg-white/90 shadow" />
          <div className="absolute h-1 w-3 -left-3 bg-white/90 shadow" />
          <div className="absolute h-1 w-3 -right-3 bg-white/90 shadow" />
          <div className="w-1.5 h-1.5 rounded-full bg-white/80" />

          {/* Hitmarker X tick */}
          {hitmarker && Date.now() - hitmarker.timestamp < 150 && (
            <div className={`absolute w-6 h-6 border-2 rotate-45 animate-ping ${hitmarker.isHeadshot ? 'border-amber-400' : 'border-white'}`} />
          )}
        </div>

        {/* Floating Damage Numbers */}
        {damageNumbers.map((dmg) => (
          <div
            key={dmg.id}
            className={`absolute font-black text-2xl drop-shadow-md animate-bounce ${
              dmg.color === 'yellow' ? 'text-amber-400' : dmg.color === 'blue' ? 'text-cyan-400' : 'text-white'
            }`}
            style={{
              transform: 'translateY(-40px)',
            }}
          >
            {dmg.text}
          </div>
        ))}

        {/* Consumable Use Progress Bar */}
        {useProgress !== null && (
          <div className="absolute -bottom-16 flex flex-col items-center gap-1.5 bg-slate-950/90 border border-slate-700 px-6 py-2.5 rounded-xl shadow-2xl">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Using Consumable...</span>
            <div className="w-48 h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
              <div
                className="h-full bg-cyan-400 transition-all duration-75 ease-linear"
                style={{ width: `${Math.round(useProgress * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar: Health, Shields, Inventory & Materials */}
      <div className="flex items-end justify-between w-full">
        {/* Bottom Left: Health & Shield Bars */}
        <div className="flex flex-col gap-2 w-72">
          {/* Shield Bar (Blue) */}
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between items-center text-xs font-black text-cyan-300 px-1">
              <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> SHIELD</span>
              <span className="tabular-nums">{stats.shield} / 100</span>
            </div>
            <div className="h-4 bg-slate-900 border-2 border-slate-700 rounded-md overflow-hidden relative shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-200"
                style={{ width: `${stats.shield}%` }}
              />
            </div>
          </div>

          {/* Health Bar (Green) */}
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between items-center text-xs font-black text-emerald-300 px-1">
              <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> HEALTH</span>
              <span className="tabular-nums">{stats.health} / 100</span>
            </div>
            <div className="h-5 bg-slate-900 border-2 border-slate-700 rounded-md overflow-hidden relative shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-200"
                style={{ width: `${stats.health}%` }}
              />
            </div>
          </div>

          {/* Controls Quick Hint */}
          <div className="text-[11px] font-semibold text-slate-300/80 bg-slate-900/60 px-2 py-1 rounded border border-slate-800 mt-1">
            WASD Move · Space Jump · Q Build Mode · E Interact Chest · R Reload
          </div>
        </div>

        {/* Bottom Center: Building Mode Dock */}
        <div className="flex flex-col items-center gap-2">
          {isBuildingMode && (
            <div className="flex items-center gap-2 bg-slate-900/95 border-2 border-cyan-500/80 p-2 rounded-xl shadow-2xl pointer-events-auto">
              {(['wall', 'floor', 'ramp', 'cone'] as BuildType[]).map((type, idx) => {
                const keys = ['F1/Z', 'F2/X', 'F3/C', 'F4/V'];
                const isSelected = buildType === type;
                return (
                  <button
                    key={type}
                    onClick={() => onSelectBuildType(type)}
                    className={`flex flex-col items-center justify-center w-16 h-16 rounded-lg border-2 transition cursor-pointer font-bold ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-500/25 text-white shadow-lg shadow-cyan-500/20'
                        : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <span className="text-[11px] uppercase tracking-wider">{type}</span>
                    <span className="text-[10px] text-cyan-300 font-extrabold mt-1">[{keys[idx]}]</span>
                  </button>
                );
              })}

              <div className="h-10 w-px bg-slate-700 mx-1" />

              {/* Material Selector */}
              <div className="flex items-center gap-1">
                {(['wood', 'stone', 'metal'] as MaterialType[]).map((mat) => (
                  <button
                    key={mat}
                    onClick={() => onSelectMaterial(mat)}
                    className={`px-2 py-1 rounded text-[11px] uppercase font-bold border transition cursor-pointer ${
                      buildMaterial === mat
                        ? 'border-amber-400 bg-amber-500/30 text-amber-300'
                        : 'border-slate-700 bg-slate-800 text-slate-400'
                    }`}
                  >
                    {mat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Toggle Build Mode Button */}
          <button
            onClick={onToggleBuildMode}
            className={`px-4 py-1.5 rounded-lg border-2 font-black text-xs uppercase tracking-wider transition pointer-events-auto cursor-pointer shadow-lg ${
              isBuildingMode
                ? 'border-cyan-400 bg-cyan-600 text-white'
                : 'border-slate-700 bg-slate-900/90 text-slate-300 hover:border-slate-500'
            }`}
          >
            {isBuildingMode ? 'Build Mode Active [Q]' : 'Enter Build Mode [Q]'}
          </button>
        </div>

        {/* Bottom Right: Materials & Weapons Hotbar */}
        <div className="flex flex-col items-end gap-3">
          {/* Materials Pill Counter */}
          <div className="flex items-center gap-3 bg-slate-900/95 border border-slate-700/80 px-4 py-2 rounded-xl text-white shadow-xl">
            <div className="flex items-center gap-1.5 font-bold text-sm">
              <span className="w-3 h-3 rounded-full bg-amber-700" />
              <span className="text-slate-300 text-xs">WOOD</span>
              <span className="text-amber-400 font-black tabular-nums">{stats.wood}</span>
            </div>
            <div className="h-4 w-px bg-slate-700" />
            <div className="flex items-center gap-1.5 font-bold text-sm">
              <span className="w-3 h-3 rounded-full bg-slate-500" />
              <span className="text-slate-300 text-xs">STONE</span>
              <span className="text-slate-200 font-black tabular-nums">{stats.stone}</span>
            </div>
            <div className="h-4 w-px bg-slate-700" />
            <div className="flex items-center gap-1.5 font-bold text-sm">
              <span className="w-3 h-3 rounded-full bg-cyan-700" />
              <span className="text-slate-300 text-xs">METAL</span>
              <span className="text-cyan-300 font-black tabular-nums">{stats.metal}</span>
            </div>
          </div>

          {/* Weapons Hotbar */}
          <div className="flex items-center gap-2 pointer-events-auto">
            {inventory.map((weapon, idx) => {
              const isSelected = activeSlot === idx && !isBuildingMode;
              return (
                <button
                  key={weapon.id}
                  onClick={() => onSelectSlot(idx)}
                  className={`relative flex flex-col justify-between w-20 h-22 p-2 rounded-xl border-2 transition-all cursor-pointer shadow-xl ${
                    getRarityColor(weapon.rarity)
                  } ${
                    isSelected
                      ? 'ring-4 ring-white ring-offset-2 ring-offset-slate-950 scale-105'
                      : 'opacity-85 hover:opacity-100'
                  }`}
                >
                  {/* Slot Number */}
                  <div className="flex justify-between items-center w-full">
                    <span className="text-[11px] font-black bg-slate-950/80 px-1.5 py-0.5 rounded text-white">
                      {idx + 1}
                    </span>
                    <span className="text-[9px] uppercase font-bold tracking-wider opacity-80">
                      {weapon.rarity}
                    </span>
                  </div>

                  {/* Weapon Name */}
                  <div className="font-extrabold text-[11px] leading-tight text-white text-left my-auto">
                    {weapon.name}
                  </div>

                  {/* Ammo or count */}
                  <div className="flex justify-end items-center w-full">
                    {weapon.type === 'pickaxe' ? (
                      <Axe className="w-4 h-4 text-slate-300" />
                    ) : weapon.type === 'minishield' || weapon.type === 'medkit' ? (
                      <span className="text-xs font-black text-cyan-300">x{weapon.currentClip}</span>
                    ) : (
                      <span className="text-xs font-black text-white tabular-nums">
                        {weapon.currentClip} <span className="text-[10px] text-slate-400">/{weapon.reserveAmmo}</span>
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
