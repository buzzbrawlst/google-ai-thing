/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { GameState, PlayerStats } from '../game/types.ts';
import { Trophy, Skull, Play, RotateCcw, Home } from 'lucide-react';

interface OutcomeModalsProps {
  gameState: GameState;
  stats: PlayerStats;
  placement: number;
  onResume: () => void;
  onRestart: () => void;
  onReturnToTitle: () => void;
}

export const OutcomeModals: React.FC<OutcomeModalsProps> = ({
  gameState,
  stats,
  placement,
  onResume,
  onRestart,
  onReturnToTitle,
}) => {
  if (gameState !== 'victory' && gameState !== 'gameover' && gameState !== 'paused') {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-none font-sans select-none pointer-events-auto">
      {/* Victory Royale Modal */}
      {gameState === 'victory' && (
        <div className="flex flex-col items-center max-w-lg w-full bg-slate-900 border-4 border-amber-400 p-8 rounded-2xl shadow-[0_0_50px_rgba(251,191,36,0.3)] animate-scale-in text-white text-center">
          {/* Iconic Fortnite Victory Banner */}
          <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 px-8 py-3 rounded-xl shadow-2xl transform -rotate-2 mb-6">
            <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter uppercase">
              #1 VICTORY ROYALE
            </h2>
          </div>

          <div className="flex items-center gap-2 text-amber-400 mb-6">
            <Trophy className="w-8 h-8 fill-current animate-bounce" />
            <span className="font-extrabold text-lg uppercase tracking-widest">Champion of the Island</span>
          </div>

          {/* Stats Breakdown */}
          <div className="grid grid-cols-2 gap-3 w-full mb-8 text-left">
            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl">
              <span className="text-[11px] text-slate-400 font-bold uppercase block">Eliminations</span>
              <span className="text-2xl font-black text-amber-400 tabular-nums">{stats.kills}</span>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl">
              <span className="text-[11px] text-slate-400 font-bold uppercase block">Damage Dealt</span>
              <span className="text-2xl font-black text-cyan-400 tabular-nums">{stats.damageDealt}</span>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl">
              <span className="text-[11px] text-slate-400 font-bold uppercase block">Structures Built</span>
              <span className="text-2xl font-black text-emerald-400 tabular-nums">{stats.structuresBuilt}</span>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl">
              <span className="text-[11px] text-slate-400 font-bold uppercase block">Accuracy</span>
              <span className="text-2xl font-black text-slate-200 tabular-nums">{stats.accuracy}%</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 w-full">
            <button
              type="button"
              data-start="true"
              onClick={onRestart}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-lg uppercase tracking-wider rounded-xl shadow-xl transition cursor-pointer"
            >
              <RotateCcw className="w-5 h-5" /> Play Again
            </button>
            <button
              type="button"
              onClick={onReturnToTitle}
              className="px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm uppercase tracking-wider rounded-xl border border-slate-700 transition cursor-pointer flex items-center gap-2"
            >
              <Home className="w-4 h-4" /> Lobby
            </button>
          </div>
        </div>
      )}

      {/* Game Over / Eliminated Modal */}
      {gameState === 'gameover' && (
        <div className="flex flex-col items-center max-w-md w-full bg-slate-900 border-2 border-red-500/80 p-8 rounded-2xl shadow-2xl text-white text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4 border border-red-500/40">
            <Skull className="w-8 h-8 text-red-400" />
          </div>

          <h2 className="text-4xl font-black italic tracking-tighter uppercase text-red-500 mb-1">
            ELIMINATED
          </h2>
          <span className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">
            Placed #{placement}
          </span>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 w-full mb-8 text-left">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 font-bold uppercase block">Eliminations</span>
              <span className="text-2xl font-black text-amber-400 tabular-nums">{stats.kills}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 font-bold uppercase block">Damage Dealt</span>
              <span className="text-2xl font-black text-cyan-400 tabular-nums">{stats.damageDealt}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 w-full">
            <button
              type="button"
              data-start="true"
              onClick={onRestart}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-base uppercase tracking-wider rounded-xl shadow-xl transition cursor-pointer"
            >
              <RotateCcw className="w-5 h-5" /> Ready Up Again
            </button>
            <button
              type="button"
              onClick={onReturnToTitle}
              className="px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm uppercase tracking-wider rounded-xl border border-slate-700 transition cursor-pointer flex items-center gap-2"
            >
              <Home className="w-4 h-4" /> Lobby
            </button>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {gameState === 'paused' && (
        <div className="flex flex-col items-center max-w-sm w-full bg-slate-900 border-2 border-slate-700 p-8 rounded-2xl shadow-2xl text-white text-center">
          <h2 className="text-3xl font-black italic tracking-tighter uppercase text-amber-400 mb-6">
            GAME PAUSED
          </h2>

          <div className="flex flex-col gap-3 w-full">
            <button
              type="button"
              onClick={onResume}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-base uppercase tracking-wider rounded-xl shadow-lg transition cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" /> Resume Match
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm uppercase tracking-wider rounded-xl border border-slate-700 transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> Restart
            </button>
            <button
              type="button"
              onClick={onReturnToTitle}
              className="w-full flex items-center justify-center gap-2 py-3 bg-slate-950 hover:bg-slate-800 text-slate-400 font-bold text-sm uppercase tracking-wider rounded-xl border border-slate-800 transition cursor-pointer"
            >
              <Home className="w-4 h-4" /> Exit to Title
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
