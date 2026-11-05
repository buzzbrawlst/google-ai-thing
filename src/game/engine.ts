/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import {
  BuildType,
  DamageNumber,
  GameMode,
  GameState,
  KillFeedEntry,
  MaterialType,
  PlayerStats,
  WeaponDef,
  WeaponType,
  BuiltStructure,
} from './types.ts';
import {
  applyDamageToPlayer,
  calculateDamage,
  canBuild,
  GRID_SIZE,
  isOutsideStorm,
  MATERIAL_STATS,
  snapToBuildGrid,
  StormCircle,
  updateStormCircle,
  WALL_HEIGHT,
} from './rules.ts';
import { soundEngine } from './audio.ts';
import {
  createBuildingMesh,
  createCharacterMesh,
  createWeaponMesh,
} from './procedural.ts';
import {
  createIslandTerrain,
  createOceanMesh,
  createStormMesh,
  getTerrainHeight,
  populateIsland,
  WorldObject,
} from './world.ts';
import { MultiplayerManager } from './multiplayer.ts';

// Reusable scratch vectors to avoid GC in animation loop
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();

export interface EngineCallbacks {
  onStatsUpdate: (stats: PlayerStats) => void;
  onInventoryUpdate: (weapons: WeaponDef[], activeIndex: number) => void;
  onStormUpdate: (storm: StormCircle) => void;
  onBuildModeUpdate: (isBuilding: boolean, type: BuildType, material: MaterialType) => void;
  onKillFeed: (entry: KillFeedEntry) => void;
  onDamageNumber: (dmg: DamageNumber) => void;
  onGameStateChange: (state: GameState, placement?: number) => void;
  onHitmarker: (isHeadshot: boolean) => void;
  onUseProgress: (progress: number | null) => void;
}

export interface BotAgent {
  id: string;
  name: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotationY: number;
  health: number;
  shield: number;
  meshGroup: THREE.Group;
  parts: ReturnType<typeof createCharacterMesh>['parts'];
  weaponMesh?: THREE.Group;
  isGliding: boolean;
  state: 'dropping' | 'looting' | 'patrolling' | 'fighting';
  target?: THREE.Vector3;
  targetEnemy?: { position: THREE.Vector3; id: string };
  shootCooldown: number;
  buildCooldown: number;
  stuckTimer: number;
  isDead: boolean;
}

export class GameEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean = false;
  private frameId: number = 0;
  private lastTime: number = performance.now();
  private totalTime: number = 0;

  // Game state
  public gameState: GameState = 'title';
  public gameMode: GameMode = 'battle_royale';
  public multiplayer: MultiplayerManager;

  // Player physics and orientation
  private playerPos = new THREE.Vector3(0, 45, 0);
  private playerVel = new THREE.Vector3();
  private playerYaw: number = 0;
  private playerPitch: number = 0;
  private isGrounded: boolean = false;
  private isGliding: boolean = false;
  private isAiming: boolean = false;
  private isCrouching: boolean = false;
  private isSprinting: boolean = false;

  // Player Character Mesh
  private playerMeshGroup!: THREE.Group;
  private playerParts!: ReturnType<typeof createCharacterMesh>['parts'];
  private currentWeaponMesh?: THREE.Group;

  // Player Stats
  public stats: PlayerStats = {
    health: 100,
    shield: 100,
    wood: 180,
    stone: 80,
    metal: 40,
    kills: 0,
    accuracy: 100,
    damageDealt: 0,
    structuresBuilt: 0,
    placement: 1,
  };

  private shotsFired: number = 0;
  private shotsHit: number = 0;

  // Inventory
  public inventory: WeaponDef[] = [];
  public activeSlot: number = 0;
  private fireTimer: number = 0;
  private reloadTimer: number = 0;
  private isUsingConsumable: boolean = false;
  private consumableTimer: number = 0;

  // Building System
  public isBuildingMode: boolean = false;
  public currentBuildType: BuildType = 'wall';
  public currentBuildMaterial: MaterialType = 'wood';
  private hologramMesh?: THREE.Group;
  private builtStructures: Map<string, { mesh: THREE.Group; data: BuiltStructure }> = new Map();

  // World and Environment
  private islandMesh!: THREE.Mesh;
  private stormMesh!: THREE.Mesh;
  private worldObjects: WorldObject[] = [];
  public storm: StormCircle = {
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
  };
  private stormTickTimer: number = 0;

  // Bots
  private bots: BotAgent[] = [];
  private totalPlayersAlive: number = 16;

  // Input
  private keys: Record<string, boolean> = {};
  private isMouseDown: boolean = false;
  private isRightMouseDown: boolean = false;
  private isPointerLocked: boolean = false;

  constructor(container: HTMLElement, callbacks: EngineCallbacks, playerName: string = 'Player') {
    this.container = container;
    this.callbacks = callbacks;
    this.multiplayer = new MultiplayerManager(playerName);

    this.initDefaultInventory();
    this.initThree();
    this.initWorld();
    this.initPlayer();
    this.initHologram();
    this.initEventListeners();
    this.initMultiplayerHooks();

    // Start render loop
    this.startLoop();
  }

  private initDefaultInventory() {
    this.inventory = [
      {
        id: 'pickaxe',
        name: 'Tactical Pickaxe',
        type: 'pickaxe',
        rarity: 'common',
        damage: 20,
        fireRate: 1.8,
        clipSize: 1,
        currentClip: 1,
        reserveAmmo: 0,
        reloadTime: 0,
        range: 3.5,
        spread: 0,
        color: '#94a3b8',
      },
      {
        id: 'ar-starting',
        name: 'Assault Rifle',
        type: 'ar',
        rarity: 'rare',
        damage: 32,
        fireRate: 5.5,
        clipSize: 30,
        currentClip: 30,
        reserveAmmo: 90,
        reloadTime: 2.2,
        range: 100,
        spread: 0.02,
        color: '#3b82f6',
      },
      {
        id: 'shotgun-starting',
        name: 'Pump Shotgun',
        type: 'shotgun',
        rarity: 'uncommon',
        damage: 85,
        fireRate: 0.8,
        clipSize: 5,
        currentClip: 5,
        reserveAmmo: 25,
        reloadTime: 3.8,
        range: 22,
        spread: 0.055,
        pellets: 10,
        color: '#22c55e',
      },
      {
        id: 'minis-starting',
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
      },
    ];
    this.activeSlot = 1; // Default to AR
  }

  private initThree() {
    // Detect software WebGL as instructed by threejs skill
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x70c0e8); // Vibrant Fortnite sky
    this.scene.fog = new THREE.FogExp2(0x70c0e8, 0.0045);

    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 800);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    // Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x9ae6b4, 0x1e3a8a, 0.7);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff3d6, 1.4);
    dirLight.position.set(60, 100, 40);
    dirLight.castShadow = !this.isSoftwareGl;
    if (dirLight.castShadow) {
      dirLight.shadow.mapSize.width = 1024;
      dirLight.shadow.mapSize.height = 1024;
      dirLight.shadow.camera.near = 10;
      dirLight.shadow.camera.far = 250;
      dirLight.shadow.camera.left = -60;
      dirLight.shadow.camera.right = 60;
      dirLight.shadow.camera.top = 60;
      dirLight.shadow.camera.bottom = -60;
      dirLight.shadow.bias = -0.0005;
      dirLight.shadow.normalBias = 0.02;
    }
    this.scene.add(dirLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    this.scene.add(ambientLight);
  }

  private initWorld() {
    this.islandMesh = createIslandTerrain();
    this.scene.add(this.islandMesh);

    const ocean = createOceanMesh();
    this.scene.add(ocean);

    this.stormMesh = createStormMesh();
    this.scene.add(this.stormMesh);

    // Procedural Stylized Low-Poly Clouds in the Sky
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      flatShading: true,
    });
    for (let c = 0; c < 16; c++) {
      const cloudGroup = new THREE.Group();
      const numPuffs = 3 + Math.floor(Math.random() * 3);
      for (let p = 0; p < numPuffs; p++) {
        const puffGeo = new THREE.DodecahedronGeometry(5 + Math.random() * 3, 1);
        const puff = new THREE.Mesh(puffGeo, cloudMat);
        puff.position.set(p * 5 - 5, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 4);
        cloudGroup.add(puff);
      }
      const cloudAngle = (c / 16) * Math.PI * 2 + Math.random() * 0.3;
      const cloudDist = 40 + Math.random() * 90;
      cloudGroup.position.set(
        Math.cos(cloudAngle) * cloudDist,
        70 + (c % 4) * 8,
        Math.sin(cloudAngle) * cloudDist
      );
      cloudGroup.scale.set(1.4, 0.7, 1.2);
      this.scene.add(cloudGroup);
    }

    const { objects } = populateIsland(this.scene);
    this.worldObjects = objects;
  }

  private initPlayer() {
    const { group, parts } = createCharacterMesh(false);
    this.playerMeshGroup = group;
    this.playerParts = parts;
    this.scene.add(this.playerMeshGroup);

    this.updateEquippedWeaponMesh();
  }

  private initHologram() {
    this.hologramMesh = createBuildingMesh(this.currentBuildType, this.currentBuildMaterial, true, true);
    this.hologramMesh.visible = false;
    this.scene.add(this.hologramMesh);
  }

  private updateHologramAppearance() {
    if (this.hologramMesh) {
      this.scene.remove(this.hologramMesh);
    }
    const hasMats = canBuild(this.stats.wood, this.stats.stone, this.stats.metal, this.currentBuildMaterial);
    this.hologramMesh = createBuildingMesh(this.currentBuildType, this.currentBuildMaterial, true, hasMats);
    this.hologramMesh.visible = this.isBuildingMode && this.gameState === 'playing';
    this.scene.add(this.hologramMesh);
  }

  public updateEquippedWeaponMesh() {
    if (this.currentWeaponMesh) {
      this.playerParts.handSlot.remove(this.currentWeaponMesh);
    }
    const currentWeapon = this.inventory[this.activeSlot];
    if (currentWeapon) {
      this.currentWeaponMesh = createWeaponMesh(currentWeapon.type);
      this.currentWeaponMesh.rotation.y = Math.PI;
      this.currentWeaponMesh.position.set(0, 0, 0.2);
      this.playerParts.handSlot.add(this.currentWeaponMesh);
    }
    this.callbacks.onInventoryUpdate([...this.inventory], this.activeSlot);
  }

  private initMultiplayerHooks() {
    this.multiplayer.onRemoteBuild = (struct) => {
      this.placeStructureMesh(struct, false);
    };

    this.multiplayer.onRemoteShoot = (data) => {
      this.spawnBulletTracer(new THREE.Vector3(...data.origin), new THREE.Vector3(...data.direction), data.weaponType);
    };

    this.multiplayer.onRemoteChestOpen = (chestId) => {
      const obj = this.worldObjects.find((o) => o.id === chestId);
      if (obj && obj.lid) {
        obj.lid.rotation.x = -Math.PI / 3;
      }
    };

    this.multiplayer.onRemoteElimination = (data) => {
      this.callbacks.onKillFeed({
        id: `feed-${Date.now()}-${Math.random()}`,
        killer: data.killer,
        victim: data.victim,
        weapon: data.weapon,
        distance: data.distance,
        time: Date.now(),
      });
      this.totalPlayersAlive = Math.max(1, this.totalPlayersAlive - 1);
      this.checkVictoryOrLoss();
    };
  }

  public startMatch(mode: GameMode = 'battle_royale', roomCode: string = 'island_1') {
    this.gameMode = mode;
    this.multiplayer.joinRoom(roomCode);

    // Drop from Battle Bus high in sky
    const startX = (Math.random() - 0.5) * 80;
    const startZ = (Math.random() - 0.5) * 80;
    this.playerPos.set(startX, 65, startZ);
    this.playerVel.set(0, -5, 0);
    this.isGliding = true;
    this.playerParts.glider.visible = true;

    soundEngine.playGliderDeploy();

    this.gameState = 'playing';
    document.body.dataset.state = 'playing';
    this.callbacks.onGameStateChange('playing');

    // Spawn AI Bots
    this.spawnBots(15);
    this.totalPlayersAlive = this.bots.length + 1;

    this.callbacks.onStatsUpdate({ ...this.stats, placement: this.totalPlayersAlive });
  }

  private spawnBots(count: number) {
    // Clear existing bots
    this.bots.forEach((b) => this.scene.remove(b.meshGroup));
    this.bots = [];

    const botNames = [
      'Ninja_X',
      'MythicSlayer',
      'BoxFightKing',
      'DefaultJonesy',
      'ViperSniper',
      'TiltedSweat',
      'LootGoblin',
      'BushCamper',
      'SpeedyBuilder',
      'StormChaser',
      'PixelWarrior',
      'ShadowAgent',
      'OmegaRacer',
      'FalconScout',
      'FrostBite',
    ];

    for (let i = 0; i < count; i++) {
      const { group, parts } = createCharacterMesh(true);
      const angle = (i / count) * Math.PI * 2;
      const radius = 30 + Math.random() * 60;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = 45 + Math.random() * 20;

      group.position.set(x, y, z);
      parts.glider.visible = true;
      this.scene.add(group);

      const weapon = createWeaponMesh(i % 2 === 0 ? 'ar' : 'shotgun');
      parts.handSlot.add(weapon);

      this.bots.push({
        id: `bot-${i}`,
        name: botNames[i % botNames.length],
        position: new THREE.Vector3(x, y, z),
        velocity: new THREE.Vector3(0, -6, 0),
        rotationY: Math.random() * Math.PI * 2,
        health: 100,
        shield: 50,
        meshGroup: group,
        parts,
        weaponMesh: weapon,
        isGliding: true,
        state: 'dropping',
        shootCooldown: 1 + Math.random(),
        buildCooldown: 2,
        stuckTimer: 0,
        isDead: false,
      });
    }
  }

  private initEventListeners() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      // Handle Instant Mode & Slot Switches
      if (e.code === 'KeyQ') {
        this.toggleBuildMode();
      } else if (e.code === 'Digit1') {
        this.selectSlot(0);
      } else if (e.code === 'Digit2') {
        this.selectSlot(1);
      } else if (e.code === 'Digit3') {
        this.selectSlot(2);
      } else if (e.code === 'Digit4') {
        this.selectSlot(3);
      } else if (e.code === 'Digit5') {
        this.selectSlot(4);
      } else if (e.code === 'KeyR') {
        this.reloadCurrentWeapon();
      } else if (e.code === 'KeyE') {
        this.interactWithChest();
      } else if (e.code === 'KeyF' || e.code === 'KeyZ') {
        // Wall build hotkey
        this.isBuildingMode = true;
        this.currentBuildType = 'wall';
        this.updateHologramAppearance();
        this.callbacks.onBuildModeUpdate(true, 'wall', this.currentBuildMaterial);
      } else if (e.code === 'KeyX') {
        // Floor build hotkey
        this.isBuildingMode = true;
        this.currentBuildType = 'floor';
        this.updateHologramAppearance();
        this.callbacks.onBuildModeUpdate(true, 'floor', this.currentBuildMaterial);
      } else if (e.code === 'KeyC' && this.isBuildingMode) {
        // Ramp build hotkey
        this.currentBuildType = 'ramp';
        this.updateHologramAppearance();
        this.callbacks.onBuildModeUpdate(true, 'ramp', this.currentBuildMaterial);
      } else if (e.code === 'KeyV') {
        // Cone/Roof build hotkey
        this.isBuildingMode = true;
        this.currentBuildType = 'cone';
        this.updateHologramAppearance();
        this.callbacks.onBuildModeUpdate(true, 'cone', this.currentBuildMaterial);
      } else if (e.code === 'KeyT') {
        // Cycle material: wood -> stone -> metal
        if (this.currentBuildMaterial === 'wood') this.currentBuildMaterial = 'stone';
        else if (this.currentBuildMaterial === 'stone') this.currentBuildMaterial = 'metal';
        else this.currentBuildMaterial = 'wood';
        this.updateHologramAppearance();
        this.callbacks.onBuildModeUpdate(this.isBuildingMode, this.currentBuildType, this.currentBuildMaterial);
      } else if (e.code === 'Escape' || e.code === 'KeyP') {
        this.togglePause();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'KeyC' && !this.isBuildingMode) {
        this.isCrouching = false;
      }
    });

    window.addEventListener('blur', () => {
      this.keys = {};
      this.isMouseDown = false;
      this.isRightMouseDown = false;
    });

    const canvas = this.renderer.domElement;
    canvas.addEventListener('click', () => {
      if (this.gameState === 'playing' && !this.isPointerLocked) {
        canvas.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === canvas;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isPointerLocked || this.gameState !== 'playing') return;

      const sensitivity = 0.0022;
      this.playerYaw -= e.movementX * sensitivity;
      this.playerPitch -= e.movementY * sensitivity;

      // Clamp vertical pitch (-85 to +85 degrees)
      const maxPitch = (Math.PI / 2) - 0.08;
      this.playerPitch = Math.max(-maxPitch, Math.min(maxPitch, this.playerPitch));
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isMouseDown = true;
        if (this.isBuildingMode) {
          this.executeBuildPlacement();
        }
      } else if (e.button === 2) {
        this.isRightMouseDown = true;
        this.isAiming = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isMouseDown = false;
        if (this.isUsingConsumable) {
          this.isUsingConsumable = false;
          this.consumableTimer = 0;
          this.callbacks.onUseProgress(null);
        }
      } else if (e.button === 2) {
        this.isRightMouseDown = false;
        this.isAiming = false;
      }
    });

    // Prevent context menu on right click
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // Window resize observer
    window.addEventListener('resize', () => {
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
  }

  public toggleBuildMode() {
    this.isBuildingMode = !this.isBuildingMode;
    this.updateHologramAppearance();
    this.callbacks.onBuildModeUpdate(this.isBuildingMode, this.currentBuildType, this.currentBuildMaterial);
  }

  public selectSlot(idx: number) {
    if (idx >= 0 && idx < this.inventory.length) {
      this.activeSlot = idx;
      this.isBuildingMode = false;
      this.updateHologramAppearance();
      this.updateEquippedWeaponMesh();
      this.callbacks.onBuildModeUpdate(false, this.currentBuildType, this.currentBuildMaterial);
    }
  }

  public togglePause() {
    if (this.gameState === 'playing') {
      this.gameState = 'paused';
      document.body.dataset.state = 'paused';
      document.exitPointerLock?.();
      this.callbacks.onGameStateChange('paused');
    } else if (this.gameState === 'paused') {
      this.gameState = 'playing';
      document.body.dataset.state = 'playing';
      this.callbacks.onGameStateChange('playing');
    }
  }

  // --- Building Placement ---

  private executeBuildPlacement() {
    if (!this.isBuildingMode) return;

    if (!canBuild(this.stats.wood, this.stats.stone, this.stats.metal, this.currentBuildMaterial)) {
      return;
    }

    // Forward direction from player yaw
    _forward.set(Math.sin(this.playerYaw), 0, Math.cos(this.playerYaw)).normalize();

    const snapped = snapToBuildGrid(
      [this.playerPos.x, this.playerPos.y, this.playerPos.z],
      [_forward.x, _forward.y, _forward.z],
      this.currentBuildType
    );

    const key = `${snapped.position[0].toFixed(1)}_${snapped.position[1].toFixed(1)}_${snapped.position[2].toFixed(1)}`;
    if (this.builtStructures.has(key)) return;

    // Deduct materials
    const cost = MATERIAL_STATS[this.currentBuildMaterial].cost;
    if (this.currentBuildMaterial === 'wood') this.stats.wood -= cost;
    else if (this.currentBuildMaterial === 'stone') this.stats.stone -= cost;
    else if (this.currentBuildMaterial === 'metal') this.stats.metal -= cost;

    this.stats.structuresBuilt += 1;
    this.callbacks.onStatsUpdate({ ...this.stats });

    const structureData: BuiltStructure = {
      id: `build-${Date.now()}-${Math.random()}`,
      type: this.currentBuildType,
      material: this.currentBuildMaterial,
      position: snapped.position,
      rotationY: snapped.rotationY,
      health: MATERIAL_STATS[this.currentBuildMaterial].maxHp,
      maxHealth: MATERIAL_STATS[this.currentBuildMaterial].maxHp,
      ownerId: this.multiplayer.localPlayerId,
    };

    this.placeStructureMesh(structureData, true);
    soundEngine.playBuildPlace();

    // Broadcast build to other players
    this.multiplayer.broadcast({
      type: 'BUILD',
      structure: structureData,
    });
  }

  private placeStructureMesh(data: BuiltStructure, isLocal: boolean) {
    const key = `${data.position[0].toFixed(1)}_${data.position[1].toFixed(1)}_${data.position[2].toFixed(1)}`;
    if (this.builtStructures.has(key)) return;

    const mesh = createBuildingMesh(data.type, data.material, false, true);
    mesh.position.set(...data.position);
    mesh.rotation.y = data.rotationY;
    this.scene.add(mesh);

    this.builtStructures.set(key, { mesh, data });
  }

  // --- Weapons & Combat ---

  private handleWeaponFiring(dt: number) {
    if (this.isBuildingMode) return;
    const weapon = this.inventory[this.activeSlot];
    if (!weapon) return;

    this.fireTimer -= dt;

    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const needed = weapon.clipSize - weapon.currentClip;
        const toAdd = Math.min(needed, weapon.reserveAmmo);
        weapon.currentClip += toAdd;
        weapon.reserveAmmo -= toAdd;
        this.callbacks.onInventoryUpdate([...this.inventory], this.activeSlot);
      }
      return;
    }

    if (weapon.type === 'minishield' || weapon.type === 'medkit') {
      if (this.isMouseDown) {
        if (!this.isUsingConsumable) {
          this.isUsingConsumable = true;
          this.consumableTimer = 0;
          soundEngine.playPotionDrink();
        }
        this.consumableTimer += dt;
        const progress = Math.min(1, this.consumableTimer / (weapon.useTime || 2));
        this.callbacks.onUseProgress(progress);

        if (this.consumableTimer >= (weapon.useTime || 2)) {
          // Apply consumable heal
          if (weapon.healType === 'shield') {
            const maxAllowed = weapon.type === 'minishield' ? 50 : 100;
            if (this.stats.shield < maxAllowed) {
              this.stats.shield = Math.min(maxAllowed, this.stats.shield + (weapon.healAmount || 25));
            }
          } else {
            this.stats.health = Math.min(100, this.stats.health + (weapon.healAmount || 100));
          }
          weapon.currentClip -= 1;
          this.callbacks.onStatsUpdate({ ...this.stats });
          this.callbacks.onUseProgress(null);
          this.isUsingConsumable = false;
          this.consumableTimer = 0;

          if (weapon.currentClip <= 0) {
            this.inventory.splice(this.activeSlot, 1);
            this.selectSlot(Math.max(0, this.activeSlot - 1));
          } else {
            this.callbacks.onInventoryUpdate([...this.inventory], this.activeSlot);
          }
        }
      }
      return;
    }

    // Firing weapons
    if (this.isMouseDown && this.fireTimer <= 0) {
      if (weapon.currentClip <= 0) {
        this.reloadCurrentWeapon();
        return;
      }

      this.fireTimer = 1 / weapon.fireRate;
      weapon.currentClip -= 1;
      this.shotsFired += 1;
      this.callbacks.onInventoryUpdate([...this.inventory], this.activeSlot);

      // Play Sound
      if (weapon.type === 'ar') soundEngine.playAssaultRifle();
      else if (weapon.type === 'shotgun') soundEngine.playPumpShotgun();
      else if (weapon.type === 'sniper') soundEngine.playSniper();
      else if (weapon.type === 'pickaxe') soundEngine.playPickaxeSwing();

      this.executeFireRaycast(weapon);
    }
  }

  private reloadCurrentWeapon() {
    const weapon = this.inventory[this.activeSlot];
    if (!weapon || weapon.reloadTime <= 0) return;
    if (weapon.currentClip >= weapon.clipSize || weapon.reserveAmmo <= 0) return;

    this.reloadTimer = weapon.reloadTime;
    soundEngine.playReload();
  }

  private executeFireRaycast(weapon: WeaponDef) {
    // Camera aim direction
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);

    // Apply bloom / spread
    const spread = this.isAiming ? weapon.spread * 0.4 : weapon.spread;
    const rayDir = forward.clone();
    rayDir.x += (Math.random() - 0.5) * spread;
    rayDir.y += (Math.random() - 0.5) * spread;
    rayDir.z += (Math.random() - 0.5) * spread;
    rayDir.normalize();

    const origin = this.playerPos.clone();
    origin.y += 1.4;

    this.spawnBulletTracer(origin, rayDir, weapon.type);

    // Broadcast shoot event
    this.multiplayer.broadcast({
      type: 'SHOOT',
      playerId: this.multiplayer.localPlayerId,
      origin: [origin.x, origin.y, origin.z],
      direction: [rayDir.x, rayDir.y, rayDir.z],
      weaponType: weapon.type,
    });

    // Check hit against Bots
    let closestHitDist = weapon.range;
    let hitBot: BotAgent | null = null;
    let isHead = false;

    for (const bot of this.bots) {
      if (bot.isDead) continue;
      const botCenter = bot.position.clone();
      botCenter.y += 1.2;

      const toBot = botCenter.clone().sub(origin);
      const proj = toBot.dot(rayDir);
      if (proj > 0 && proj < closestHitDist) {
        const perpDist = toBot.sub(rayDir.clone().multiplyScalar(proj)).length();
        if (perpDist < 0.75) {
          closestHitDist = proj;
          hitBot = bot;
          isHead = perpDist < 0.35 && (bot.position.y + 1.8 - (origin.y + rayDir.y * proj)) < 0.4;
        }
      }
    }

    if (hitBot) {
      this.shotsHit += 1;
      const { damage } = calculateDamage(
        weapon.damage,
        isHead,
        closestHitDist,
        weapon.range,
        weapon.type === 'shotgun'
      );

      const res = applyDamageToPlayer(hitBot.health, hitBot.shield, damage);
      hitBot.health = res.newHealth;
      hitBot.shield = res.newShield;

      this.stats.damageDealt += damage;
      this.callbacks.onHitmarker(isHead);
      soundEngine.playHitmarker(isHead);
      if (res.damageDealtToShield > 0 && hitBot.shield <= 0) {
        soundEngine.playShieldBreak();
      }

      // Damage number popup
      const hitPos = origin.clone().add(rayDir.clone().multiplyScalar(closestHitDist));
      this.callbacks.onDamageNumber({
        id: `dmg-${Date.now()}-${Math.random()}`,
        text: `${damage}`,
        position: [hitPos.x, hitPos.y + 0.5, hitPos.z],
        color: isHead ? 'yellow' : (res.damageDealtToShield > 0 ? 'blue' : 'white'),
        createdAt: Date.now(),
      });

      if (res.isEliminated) {
        this.eliminateBot(hitBot, weapon.name, closestHitDist);
      } else {
        // Trigger bot defense: bot builds wall when attacked!
        hitBot.state = 'fighting';
        hitBot.targetEnemy = { position: this.playerPos, id: 'player' };
        if (hitBot.buildCooldown <= 0) {
          this.botBuildWall(hitBot);
          hitBot.buildCooldown = 3;
        }
      }
    }

    // Check hit against harvestable objects (Trees & Rocks) if pickaxe
    if (weapon.type === 'pickaxe') {
      for (const obj of this.worldObjects) {
        if (obj.health <= 0) continue;
        const dist = obj.group.position.distanceTo(origin);
        if (dist < 4.0) {
          obj.health -= 50;
          soundEngine.playPickaxeHit(Math.random() > 0.5);

          if (obj.woodValue > 0) this.stats.wood += 15;
          if (obj.stoneValue > 0) this.stats.stone += 15;
          this.callbacks.onStatsUpdate({ ...this.stats });

          if (obj.health <= 0) {
            this.scene.remove(obj.group);
          }
          break;
        }
      }
    }

    this.stats.accuracy = this.shotsFired > 0 ? Math.round((this.shotsHit / this.shotsFired) * 100) : 100;
    this.callbacks.onStatsUpdate({ ...this.stats });
  }

  private botBuildWall(bot: BotAgent) {
    const forward = new THREE.Vector3(Math.sin(bot.rotationY), 0, Math.cos(bot.rotationY));
    const snapped = snapToBuildGrid(
      [bot.position.x, bot.position.y, bot.position.z],
      [forward.x, forward.y, forward.z],
      'wall'
    );
    const structData: BuiltStructure = {
      id: `bot-wall-${Date.now()}`,
      type: 'wall',
      material: 'wood',
      position: snapped.position,
      rotationY: snapped.rotationY,
      health: 150,
      maxHealth: 150,
      ownerId: bot.id,
    };
    this.placeStructureMesh(structData, false);
    soundEngine.playBuildPlace();
  }

  private eliminateBot(bot: BotAgent, weaponName: string, distance: number) {
    bot.isDead = true;
    this.scene.remove(bot.meshGroup);
    this.stats.kills += 1;
    this.totalPlayersAlive = Math.max(1, this.totalPlayersAlive - 1);

    soundEngine.playEliminationFanfare();

    const feedEntry: KillFeedEntry = {
      id: `kill-${Date.now()}`,
      killer: this.multiplayer.localPlayerName,
      victim: bot.name,
      weapon: weaponName,
      distance: Math.round(distance),
      time: Date.now(),
    };
    this.callbacks.onKillFeed(feedEntry);
    this.multiplayer.broadcast({
      type: 'ELIMINATE',
      killer: this.multiplayer.localPlayerName,
      victim: bot.name,
      weapon: weaponName,
      distance: Math.round(distance),
    });

    this.callbacks.onStatsUpdate({ ...this.stats, placement: this.totalPlayersAlive });
    this.checkVictoryOrLoss();
  }

  private spawnBulletTracer(from: THREE.Vector3, dir: THREE.Vector3, type: WeaponType) {
    const length = type === 'sniper' ? 120 : type === 'shotgun' ? 25 : 60;
    const to = from.clone().add(dir.clone().multiplyScalar(length));

    const points = [from, to];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: type === 'sniper' ? 0xffffff : 0xffdd44,
      linewidth: 2,
    });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);

    window.setTimeout(() => {
      this.scene.remove(line);
      geo.dispose();
      mat.dispose();
    }, 45);
  }

  private interactWithChest() {
    for (const obj of this.worldObjects) {
      if (obj.type === 'chest' && obj.chestData && !obj.chestData.opened) {
        const dist = this.playerPos.distanceTo(obj.group.position);
        if (dist < 4.5) {
          obj.chestData.opened = true;
          if (obj.lid) {
            obj.lid.rotation.x = -Math.PI / 3;
          }
          soundEngine.playChestOpen();

          // Add loot into inventory
          if (obj.chestData.loot) {
            obj.chestData.loot.forEach((item) => {
              if (this.inventory.length < 5) {
                this.inventory.push(item);
              }
            });
            this.callbacks.onInventoryUpdate([...this.inventory], this.activeSlot);
          }

          // Grant bonus materials
          this.stats.wood += 30;
          this.stats.stone += 20;
          this.callbacks.onStatsUpdate({ ...this.stats });

          this.multiplayer.broadcast({
            type: 'CHEST_OPEN',
            chestId: obj.id,
            playerId: this.multiplayer.localPlayerId,
          });
          break;
        }
      }
    }
  }

  // --- Storm & Bot AI Update Loop ---

  private updateStorm(dt: number) {
    this.storm = updateStormCircle(this.storm, dt);

    // Update 3D storm mesh scale & position
    this.stormMesh.scale.set(this.storm.radius, 1, this.storm.radius);
    this.stormMesh.position.set(this.storm.centerX, 45, this.storm.centerZ);

    this.callbacks.onStormUpdate(this.storm);

    // Check storm damage on player
    this.stormTickTimer += dt;
    if (this.stormTickTimer >= 1.0) {
      this.stormTickTimer = 0;
      if (isOutsideStorm(this.playerPos.x, this.playerPos.z, this.storm)) {
        // Direct damage to health (storm bypasses shields!)
        this.stats.health = Math.max(0, this.stats.health - this.storm.dps);
        this.callbacks.onStatsUpdate({ ...this.stats });

        if (this.stats.health <= 0) {
          this.onPlayerDefeat();
        }
      }
    }
  }

  private updateBots(dt: number) {
    for (const bot of this.bots) {
      if (bot.isDead) continue;

      const groundY = getTerrainHeight(bot.position.x, bot.position.z);

      if (bot.isGliding) {
        bot.velocity.y = -6;
        bot.position.addScaledVector(bot.velocity, dt);

        if (bot.position.y <= groundY + 0.1) {
          bot.position.y = groundY;
          bot.velocity.set(0, 0, 0);
          bot.isGliding = false;
          bot.parts.glider.visible = false;
          bot.state = 'patrolling';
        }
        bot.meshGroup.position.copy(bot.position);
        continue;
      }

      // Check distance to player
      const distToPlayer = bot.position.distanceTo(this.playerPos);

      // Bot combat logic
      if (distToPlayer < 35 && !this.isGrounded === false && this.stats.health > 0) {
        bot.state = 'fighting';
        // Face player
        const toPlayer = _v1.subVectors(this.playerPos, bot.position).normalize();
        bot.rotationY = Math.atan2(toPlayer.x, toPlayer.z);

        bot.shootCooldown -= dt;
        if (bot.shootCooldown <= 0) {
          bot.shootCooldown = 1.2 + Math.random() * 0.8;
          // Bot fires shot towards player with slight spread
          const fireDir = toPlayer.clone();
          fireDir.x += (Math.random() - 0.5) * 0.08;
          fireDir.y += (Math.random() - 0.5) * 0.08;
          fireDir.z += (Math.random() - 0.5) * 0.08;
          fireDir.normalize();

          const origin = bot.position.clone();
          origin.y += 1.4;
          this.spawnBulletTracer(origin, fireDir, 'ar');
          soundEngine.playAssaultRifle();

          // Bot hit calculation
          const hitChance = Math.max(0.2, 0.65 - distToPlayer * 0.015);
          if (Math.random() < hitChance) {
            const dmg = Math.round(18 + Math.random() * 12);
            const res = applyDamageToPlayer(this.stats.health, this.stats.shield, dmg);
            this.stats.health = res.newHealth;
            this.stats.shield = res.newShield;
            this.callbacks.onStatsUpdate({ ...this.stats });

            if (res.damageDealtToShield > 0 && this.stats.shield <= 0) {
              soundEngine.playShieldBreak();
            }

            if (res.isEliminated) {
              this.onPlayerDefeat();
            }
          }
        }
      } else {
        // Move towards storm center
        const toCenter = _v2.set(this.storm.centerX - bot.position.x, 0, this.storm.centerZ - bot.position.z).normalize();
        bot.rotationY = Math.atan2(toCenter.x, toCenter.z);
        bot.position.addScaledVector(toCenter, 3.5 * dt);
        bot.position.y = groundY;
      }

      bot.meshGroup.position.copy(bot.position);
      bot.meshGroup.rotation.y = bot.rotationY;
    }
  }

  private onPlayerDefeat() {
    this.gameState = 'gameover';
    document.body.dataset.state = 'gameover';
    document.exitPointerLock?.();
    this.callbacks.onGameStateChange('gameover', this.totalPlayersAlive);
  }

  private checkVictoryOrLoss() {
    if (this.totalPlayersAlive <= 1 && this.stats.health > 0) {
      this.gameState = 'victory';
      document.body.dataset.state = 'gameover';
      document.exitPointerLock?.();
      soundEngine.playVictoryRoyale();
      this.callbacks.onGameStateChange('victory', 1);
    }
  }

  // --- Main Render & Physics Tick Loop ---

  private startLoop() {
    const tick = () => {
      const now = performance.now();
      const dt = Math.min((now - this.lastTime) / 1000, 0.05);
      this.lastTime = now;
      this.totalTime += dt;

      if (this.gameState === 'playing') {
        this.updatePlayerPhysics(dt);
        this.handleWeaponFiring(dt);
        this.updateStorm(dt);
        this.updateBots(dt);
        this.updateCamera();
        this.updateHologramTransform();
        this.multiplayer.pruneStalePlayers();

        // Broadcast player state periodically
        this.multiplayer.broadcastPlayerState({
          position: [this.playerPos.x, this.playerPos.y, this.playerPos.z],
          rotationY: this.playerYaw,
          health: this.stats.health,
          shield: this.stats.shield,
          currentWeapon: this.inventory[this.activeSlot]?.type || 'pickaxe',
          isGliding: this.isGliding,
          isShooting: this.isMouseDown,
        });
      } else if (this.gameState === 'title') {
        // Cinematic camera sweep around central island landmark
        const time = this.totalTime * 0.2;
        this.camera.position.set(Math.sin(time) * 45, 18, Math.cos(time) * 45);
        this.camera.lookAt(0, 8, 0);
      }

      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 60);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updatePlayerPhysics(dt: number) {
    // Movement input vectors
    _forward.set(Math.sin(this.playerYaw), 0, Math.cos(this.playerYaw));
    _right.set(Math.cos(this.playerYaw), 0, -Math.sin(this.playerYaw));

    const moveDir = _v1.set(0, 0, 0);
    if (this.keys['KeyW']) moveDir.add(_forward);
    if (this.keys['KeyS']) moveDir.sub(_forward);
    if (this.keys['KeyD']) moveDir.sub(_right);
    if (this.keys['KeyA']) moveDir.add(_right);

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
    }

    this.isSprinting = !!this.keys['ShiftLeft'] || !!this.keys['ShiftRight'];
    let moveSpeed = 6.5;
    if (this.isSprinting) moveSpeed = 10.0;
    if (this.isAiming) moveSpeed = 3.5;
    if (this.isGliding) moveSpeed = 14.0;

    // Horizontal acceleration
    this.playerVel.x = moveDir.x * moveSpeed;
    this.playerVel.z = moveDir.z * moveSpeed;

    // Vertical Gravity
    const gravity = this.isGliding ? -6.0 : -22.0;
    this.playerVel.y += gravity * dt;

    // Jump
    if (this.keys['Space'] && this.isGrounded && !this.isGliding) {
      this.playerVel.y = 9.0;
      this.isGrounded = false;
      soundEngine.playJump();
    }

    // Apply Velocity
    this.playerPos.x += this.playerVel.x * dt;
    this.playerPos.z += this.playerVel.z * dt;
    this.playerPos.y += this.playerVel.y * dt;

    // Ground & Building Collision
    const terrainY = getTerrainHeight(this.playerPos.x, this.playerPos.z);
    let highestFloor = terrainY;

    // Check collision on built ramps and floors
    this.builtStructures.forEach(({ data }) => {
      const [bx, by, bz] = data.position;
      const dx = Math.abs(this.playerPos.x - bx);
      const dz = Math.abs(this.playerPos.z - bz);

      if (dx < 2.0 && dz < 2.0) {
        if (data.type === 'floor') {
          if (this.playerPos.y >= by - 0.2 && this.playerPos.y <= by + 1.2) {
            highestFloor = Math.max(highestFloor, by);
          }
        } else if (data.type === 'ramp') {
          // Ramp slope height
          const relZ = (this.playerPos.z - bz);
          const rampY = by + (relZ / 4.0) * WALL_HEIGHT;
          if (this.playerPos.y >= rampY - 0.4 && this.playerPos.y <= rampY + 1.5) {
            highestFloor = Math.max(highestFloor, rampY);
          }
        }
      }
    });

    if (this.playerPos.y <= highestFloor) {
      this.playerPos.y = highestFloor;
      this.playerVel.y = 0;
      this.isGrounded = true;
      if (this.isGliding) {
        this.isGliding = false;
        this.playerParts.glider.visible = false;
      }
    } else {
      this.isGrounded = false;
    }

    // Update Player Mesh
    this.playerMeshGroup.position.copy(this.playerPos);
    this.playerMeshGroup.rotation.y = this.playerYaw;

    // Animate run bobbing
    if (this.isGrounded && moveDir.lengthSq() > 0) {
      const bob = Math.sin(this.totalTime * 14) * 0.12;
      this.playerParts.torso.position.y = 1.35 + Math.abs(bob);
      this.playerParts.leftLeg.rotation.x = bob * 3;
      this.playerParts.rightLeg.rotation.x = -bob * 3;
    } else {
      this.playerParts.torso.position.y = 1.35;
      this.playerParts.leftLeg.rotation.x = 0;
      this.playerParts.rightLeg.rotation.x = 0;
    }
  }

  private updateCamera() {
    // Over-the-shoulder third person camera offset
    const targetFov = this.isAiming ? (this.inventory[this.activeSlot]?.zoomFov || 45) : 75;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 12, 0.016);
    this.camera.updateProjectionMatrix();

    const shoulderOffsetX = this.isGliding ? 0.0 : 0.7;
    const heightOffset = this.isGliding ? 2.2 : 1.6;
    const distance = this.isGliding ? 5.2 : (this.isAiming ? 1.8 : 3.4);

    _forward.set(
      Math.sin(this.playerYaw) * Math.cos(this.playerPitch),
      Math.sin(this.playerPitch),
      Math.cos(this.playerYaw) * Math.cos(this.playerPitch)
    ).normalize();

    _right.set(Math.cos(this.playerYaw), 0, -Math.sin(this.playerYaw)).normalize();

    // Desired camera position
    _camPos.copy(this.playerPos);
    _camPos.y += heightOffset;
    _camPos.addScaledVector(_right, shoulderOffsetX);
    _camPos.addScaledVector(_forward, -distance);

    // Camera wall collision pull-in
    const headPos = _v3.copy(this.playerPos).add(new THREE.Vector3(0, heightOffset, 0));
    const camDir = _camPos.clone().sub(headPos);
    const maxDist = camDir.length();
    camDir.normalize();

    _raycaster.set(headPos, camDir);
    _raycaster.far = maxDist;

    this.camera.position.copy(_camPos);

    // Look target slightly above player head
    const lookTarget = this.playerPos.clone();
    lookTarget.y += heightOffset + 0.1;
    lookTarget.addScaledVector(_forward, 25);
    this.camera.lookAt(lookTarget);
  }

  private updateHologramTransform() {
    if (!this.isBuildingMode || !this.hologramMesh) return;

    _forward.set(Math.sin(this.playerYaw), 0, Math.cos(this.playerYaw)).normalize();

    const snapped = snapToBuildGrid(
      [this.playerPos.x, this.playerPos.y, this.playerPos.z],
      [_forward.x, _forward.y, _forward.z],
      this.currentBuildType
    );

    this.hologramMesh.position.set(...snapped.position);
    this.hologramMesh.rotation.y = snapped.rotationY;
    this.hologramMesh.visible = true;
  }

  public dispose() {
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.multiplayer.leaveRoom();
    this.renderer.dispose();
  }
}
