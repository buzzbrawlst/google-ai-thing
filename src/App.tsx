/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from './game/engine.ts';
import {
  BuildType,
  DamageNumber,
  GameMode,
  GameState,
  KillFeedEntry,
  MaterialType,
  PlayerStats,
  WeaponDef,
} from './game/types.ts';
import { StormCircle } from './game/rules.ts';
import { HUD } from './components/HUD.tsx';
import { TitleScreen } from './components/TitleScreen.tsx';
import { OutcomeModals } from './components/OutcomeModals.tsx';

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [gameState, setGameState] = useState<GameState>('title');
  const [placement, setPlacement] = useState<number>(16);

  const [stats, setStats] = useState<PlayerStats>({
    health: 100,
    shield: 100,
    wood: 180,
    stone: 80,
    metal: 40,
    kills: 0,
    accuracy: 100,
    damageDealt: 0,
    structuresBuilt: 0,
    placement: 16,
  });

  const [inventory, setInventory] = useState<WeaponDef[]>([]);
  const [activeSlot, setActiveSlot] = useState<number>(1);

  const [storm, setStorm] = useState<StormCircle>({
    centerX: 0,
    centerZ: 0,
    radius: 170,
    targetCenterX: 0,
    targetCenterZ: 0,
    targetRadius: 90,
    phase: 1,
    timeRemainingInPhase: 45,
    isShrinking: false,
    dps: 1,
  });

  const [isBuildingMode, setIsBuildingMode] = useState<boolean>(false);
  const [buildType, setBuildType] = useState<BuildType>('wall');
  const [buildMaterial, setBuildMaterial] = useState<MaterialType>('wood');

  const [killFeed, setKillFeed] = useState<KillFeedEntry[]>([]);
  const [damageNumbers, setDamageNumbers] = useState<DamageNumber[]>([]);
  const [hitmarker, setHitmarker] = useState<{ isHeadshot: boolean; timestamp: number } | null>(null);
  const [useProgress, setUseProgress] = useState<number | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Initialize 3D Engine once
    const engine = new GameEngine(
      mountRef.current,
      {
        onStatsUpdate: (newStats) => setStats(newStats),
        onInventoryUpdate: (weapons, slot) => {
          setInventory(weapons);
          setActiveSlot(slot);
        },
        onStormUpdate: (newStorm) => setStorm({ ...newStorm }),
        onBuildModeUpdate: (isBuilding, type, mat) => {
          setIsBuildingMode(isBuilding);
          setBuildType(type);
          setBuildMaterial(mat);
        },
        onKillFeed: (entry) => {
          setKillFeed((prev) => [...prev.slice(-6), entry]);
        },
        onDamageNumber: (dmg) => {
          setDamageNumbers((prev) => [...prev.slice(-8), dmg]);
          window.setTimeout(() => {
            setDamageNumbers((prev) => prev.filter((d) => d.id !== dmg.id));
          }, 850);
        },
        onGameStateChange: (state, place) => {
          setGameState(state);
          if (place !== undefined) setPlacement(place);
        },
        onHitmarker: (isHeadshot) => {
          setHitmarker({ isHeadshot, timestamp: Date.now() });
        },
        onUseProgress: (progress) => {
          setUseProgress(progress);
        },
      },
      'FortnitePlayer'
    );

    engineRef.current = engine;
    setInventory(engine.inventory);
    setActiveSlot(engine.activeSlot);

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleStartGame = useCallback((mode: GameMode, playerName: string, roomCode: string) => {
    if (engineRef.current) {
      engineRef.current.multiplayer.localPlayerName = playerName;
      engineRef.current.startMatch(mode, roomCode);
    }
  }, []);

  const handleSelectSlot = useCallback((idx: number) => {
    engineRef.current?.selectSlot(idx);
  }, []);

  const handleToggleBuildMode = useCallback(() => {
    engineRef.current?.toggleBuildMode();
  }, []);

  const handleSelectBuildType = useCallback((type: BuildType) => {
    if (engineRef.current) {
      engineRef.current.currentBuildType = type;
      engineRef.current.isBuildingMode = true;
      setBuildType(type);
      setIsBuildingMode(true);
    }
  }, []);

  const handleSelectMaterial = useCallback((mat: MaterialType) => {
    if (engineRef.current) {
      engineRef.current.currentBuildMaterial = mat;
      setBuildMaterial(mat);
    }
  }, []);

  const handleTogglePause = useCallback(() => {
    engineRef.current?.togglePause();
  }, []);

  const handleResume = useCallback(() => {
    engineRef.current?.togglePause();
  }, []);

  const handleRestart = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.startMatch(engineRef.current.gameMode);
    }
  }, []);

  const handleReturnToTitle = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.gameState = 'title';
      document.body.dataset.state = 'title';
      setGameState('title');
    }
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans">
      {/* 3D WebGL Canvas Mount Container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* Title / Lobby Screen */}
      {gameState === 'title' && (
        <TitleScreen onStartGame={handleStartGame} />
      )}

      {/* In-Game Active HUD */}
      {gameState === 'playing' && (
        <HUD
          stats={stats}
          inventory={inventory}
          activeSlot={activeSlot}
          storm={storm}
          isBuildingMode={isBuildingMode}
          buildType={buildType}
          buildMaterial={buildMaterial}
          killFeed={killFeed}
          damageNumbers={damageNumbers}
          hitmarker={hitmarker}
          useProgress={useProgress}
          onSelectSlot={handleSelectSlot}
          onToggleBuildMode={handleToggleBuildMode}
          onSelectBuildType={handleSelectBuildType}
          onSelectMaterial={handleSelectMaterial}
          onTogglePause={handleTogglePause}
        />
      )}

      {/* Outcome Modals: Victory Royale / Eliminated / Paused */}
      <OutcomeModals
        gameState={gameState}
        stats={stats}
        placement={placement}
        onResume={handleResume}
        onRestart={handleRestart}
        onReturnToTitle={handleReturnToTitle}
      />
    </div>
  );
}
