/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { GameMode } from '../game/types.ts';
import { Users, Play, Crosshair, Hammer, Shield } from 'lucide-react';

interface TitleScreenProps {
  onStartGame: (mode: GameMode, playerName: string, roomCode: string) => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ onStartGame }) => {
  const [playerName, setPlayerName] = useState('FortnitePro');
  const [roomCode, setRoomCode] = useState('island_alpha');
  const [selectedMode, setSelectedMode] = useState<GameMode>('battle_royale');

  useEffect(() => {
    // Autostart check
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      onStartGame('battle_royale', playerName, roomCode);
    }

    const handleKey = (e: KeyboardEvent) => {
      // If user presses Enter while on title screen and not typing in an input
      if (e.code === 'Enter' && (document.activeElement?.tagName !== 'INPUT')) {
        onStartGame(selectedMode, playerName, roomCode);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedMode, playerName, roomCode, onStartGame]);

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-between items-center p-8 bg-gradient-to-b from-slate-950/70 via-transparent to-slate-950/90 select-none text-white font-sans pointer-events-auto">
      {/* Top Header / Brand */}
      <div className="flex flex-col items-center mt-6">
        {/* Fortnite Stylized Slanted Title Lockup */}
        <div className="relative transform -rotate-1 hover:rotate-0 transition-transform duration-300">
          <h1 className="text-7xl md:text-8xl font-black italic tracking-tighter uppercase text-amber-400 drop-shadow-[0_8px_0_rgba(0,0,0,0.9)] stroke-black">
            FORTNITE
          </h1>
          <div className="absolute -bottom-3 right-0 bg-cyan-500 text-slate-950 font-black text-xs md:text-sm uppercase tracking-widest px-3 py-1 rounded shadow-lg transform rotate-2">
            3D HTML EDITION
          </div>
        </div>
        <p className="text-slate-300 font-bold text-sm tracking-wide mt-4 drop-shadow">
          Real-Time Building · 16-Player Battle Royale · Golden Chests · Storm Eye
        </p>
      </div>

      {/* Center Setup Card */}
      <div className="flex flex-col items-center w-full max-w-xl bg-slate-900/95 border-2 border-slate-700/80 p-6 md:p-8 rounded-2xl shadow-2xl backdrop-blur-none">
        {/* Game Mode Cards */}
        <div className="grid grid-cols-3 gap-3 w-full mb-6">
          <button
            type="button"
            onClick={() => setSelectedMode('battle_royale')}
            className={`flex flex-col items-center p-3 rounded-xl border-2 transition cursor-pointer text-center ${
              selectedMode === 'battle_royale'
                ? 'border-amber-400 bg-amber-500/20 text-white shadow-lg shadow-amber-500/10'
                : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
            }`}
          >
            <Shield className="w-6 h-6 mb-1 text-amber-400" />
            <span className="font-black text-xs uppercase">Battle Royale</span>
            <span className="text-[10px] text-slate-400 mt-0.5">16 Players · Storm</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedMode('build_fight')}
            className={`flex flex-col items-center p-3 rounded-xl border-2 transition cursor-pointer text-center ${
              selectedMode === 'build_fight'
                ? 'border-cyan-400 bg-cyan-500/20 text-white shadow-lg shadow-cyan-500/10'
                : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
            }`}
          >
            <Crosshair className="w-6 h-6 mb-1 text-cyan-400" />
            <span className="font-black text-xs uppercase">1v1 Build Arena</span>
            <span className="text-[10px] text-slate-400 mt-0.5">Fast Duel</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedMode('free_build')}
            className={`flex flex-col items-center p-3 rounded-xl border-2 transition cursor-pointer text-center ${
              selectedMode === 'free_build'
                ? 'border-emerald-400 bg-emerald-500/20 text-white shadow-lg shadow-emerald-500/10'
                : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
            }`}
          >
            <Hammer className="w-6 h-6 mb-1 text-emerald-400" />
            <span className="font-black text-xs uppercase">Free Build</span>
            <span className="text-[10px] text-slate-400 mt-0.5">Unlimited Mats</span>
          </button>
        </div>

        {/* Player Name and Room Code inputs */}
        <div className="grid grid-cols-2 gap-4 w-full mb-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-black uppercase text-slate-400 tracking-wider">
              Player Name
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-amber-400"
              placeholder="Your Gamertag"
              maxLength={16}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-cyan-400" /> Room / Lobby Code
            </label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-cyan-400"
              placeholder="island_alpha"
              maxLength={20}
            />
          </div>
        </div>

        {/* Big Start Button */}
        <button
          type="button"
          data-start="true"
          onClick={() => onStartGame(selectedMode, playerName, roomCode)}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-2xl uppercase tracking-wider shadow-2xl shadow-amber-500/30 transform hover:-translate-y-0.5 active:translate-y-0 transition cursor-pointer"
        >
          <Play className="w-7 h-7 fill-current" />
          Drop Into Match
        </button>
        <span className="text-xs text-slate-400 font-semibold mt-2">Press Enter or Space to Drop</span>
      </div>

      {/* Bottom Controls Cheat Sheet */}
      <div className="text-xs text-slate-400 font-medium tracking-wide bg-slate-950/80 px-4 py-2 rounded-full border border-slate-800">
        WASD Move · Space Jump · Mouse Look & Aim · Left Click Shoot / Build · Q Build Mode · 1-5 Weapons
      </div>
    </div>
  );
};
