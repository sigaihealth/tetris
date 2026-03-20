import './styles.css';

import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import Tetris2D from './tetris2d/Tetris2D.js';

import { GameState, WELL_PRESETS } from './game/GameState.js';
import type { GameEvent, Axis } from './game/GameState.js';
import { InputHandler } from './game/Input.js';
import type { Action } from './game/Input.js';
import { SceneManager } from './renderer/SceneManager.js';
import { WellRenderer } from './renderer/WellRenderer.js';
import { CameraController } from './renderer/CameraController.js';
import { Effects } from './renderer/Effects.js';
import { AudioEngine } from './audio/AudioEngine.js';
import { SoundEffects } from './audio/SoundEffects.js';
import { MusicGenerator } from './audio/MusicGenerator.js';
import { HUD } from './ui/HUD.js';
import { MenuScreen } from './ui/MenuScreen.js';
import type { WellSize } from './ui/MenuScreen.js';
import { Leaderboard } from './ui/Leaderboard.js';

type AppState = 'menu' | 'playing' | 'paused' | 'gameover' | 'playing2d';

class App {
  private state: AppState = 'menu';

  // Core systems
  private sceneManager: SceneManager;
  private effects: Effects;
  private audioEngine: AudioEngine;
  private sfx: SoundEffects;
  private music: MusicGenerator;
  private hud: HUD;
  private input: InputHandler;
  private menu: MenuScreen;

  // Per-game systems (created on startGame)
  private game: GameState | null = null;
  private wellRenderer: WellRenderer | null = null;
  private cameraController: CameraController | null = null;
  private leaderboard: Leaderboard | null = null;
  private currentSize: WellSize = 'medium';

  // 2D mode
  private canvas: HTMLCanvasElement;
  private tetris2dRoot: HTMLElement;
  private reactRoot: Root | null = null;

  // Timing
  private lastTime = 0;
  private gravityAccum = 0;

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

    // Create 2D container
    this.tetris2dRoot = document.createElement('div');
    this.tetris2dRoot.id = 'tetris-2d-root';
    this.tetris2dRoot.style.display = 'none';
    document.body.appendChild(this.tetris2dRoot);

    // Renderer
    this.sceneManager = new SceneManager(this.canvas);
    this.effects = new Effects(this.sceneManager.scene);

    // Audio
    this.audioEngine = new AudioEngine();
    this.sfx = new SoundEffects(this.audioEngine);
    this.music = new MusicGenerator(this.audioEngine);

    // UI
    this.hud = new HUD();
    this.input = new InputHandler();

    this.menu = new MenuScreen({
      onStart: (size: WellSize) => this.startGame(size),
      onStart2D: () => this.start2D(),
      onResume: () => this.unpause(),
      onRestart: () => this.startGame(this.currentSize),
      onQuit: () => this.quitToMenu(),
      onSfxVolume: (v: number) => { this.audioEngine.sfxVolume = v; },
      onMusicVolume: (v: number) => { this.audioEngine.musicVolume = v; },
    });

    // Initial state
    this.hud.hide();
    this.menu.showStartScreen();

    // Event listeners
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));

    // Start render loop
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  private startGame(size: WellSize): void {
    this.saveHighScore();
    this.audioEngine.resume();
    this.currentSize = size;

    const config = WELL_PRESETS[size];
    this.game = new GameState(config);
    this.leaderboard = new Leaderboard(size);

    // Dispose old renderer if present
    if (this.wellRenderer) {
      this.wellRenderer.dispose();
    }
    this.wellRenderer = new WellRenderer(
      this.sceneManager.scene,
      config.width,
      config.depth,
      config.height,
    );
    this.cameraController = new CameraController(
      this.sceneManager.camera,
      config.width,
      config.depth,
      config.height,
    );

    this.game.start();
    this.music.stop();
    this.music.start();

    this.menu.hide();
    this.hud.show();
    this.hud.update(0, 1, 0);

    this.gravityAccum = 0;
    this.input.reset();
    this.state = 'playing';
  }

  private start2D(): void {
    this.state = 'playing2d';
    this.menu.hide();
    this.hud.hide();

    // Hide the Three.js canvas
    this.canvas.style.display = 'none';

    // Show the 2D container and mount React
    this.tetris2dRoot.style.display = '';
    this.reactRoot = createRoot(this.tetris2dRoot);
    this.reactRoot.render(createElement(Tetris2D));
  }

  private quit2D(): void {
    // Unmount React
    if (this.reactRoot) {
      this.reactRoot.unmount();
      this.reactRoot = null;
    }

    // Hide 2D, show 3D canvas
    this.tetris2dRoot.style.display = 'none';
    this.canvas.style.display = '';

    this.state = 'menu';
    this.menu.showStartScreen();
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.repeat) return;

    // In 2D mode, only handle Escape to quit back to main menu
    if (this.state === 'playing2d') {
      if (e.key === 'Escape') {
        this.quit2D();
      }
      return;
    }

    const action = this.input.getAction(e.code);

    // Prevent browser defaults for game keys (space scrolls, arrows scroll)
    if (action) {
      e.preventDefault();
    }

    if (action === 'mute') {
      this.audioEngine.toggleMute();
      return;
    }

    if (action === 'pause') {
      if (this.state === 'playing') {
        this.pause();
      } else if (this.state === 'paused') {
        this.unpause();
      }
      return;
    }

    if (this.state === 'playing') {
      const actions = this.input.processKeyDown(e.code, performance.now());
      for (const a of actions) {
        this.handleAction(a);
      }
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.input.processKeyUp(e.code, performance.now());
  }

  private pause(): void {
    this.state = 'paused';
    this.music.stop();
    this.menu.showPauseScreen();
  }

  private unpause(): void {
    this.state = 'playing';
    this.music.start();
    this.menu.hide();
    this.input.reset();
  }

  private quitToMenu(): void {
    this.saveHighScore();
    this.state = 'menu';
    this.music.stop();
    if (this.wellRenderer) {
      this.wellRenderer.dispose();
      this.wellRenderer = null;
    }
    this.effects.dispose();
    this.hud.hide();
    this.game = null;
    this.menu.showStartScreen();
  }

  private handleAction(action: Action): void {
    if (!this.game) return;

    switch (action) {
      case 'move_left':
        if (this.game.tryMove(-1, 0, 0)) this.sfx.move();
        break;
      case 'move_right':
        if (this.game.tryMove(1, 0, 0)) this.sfx.move();
        break;
      case 'move_forward':
        if (this.game.tryMove(0, 0, -1)) this.sfx.move();
        break;
      case 'move_back':
        if (this.game.tryMove(0, 0, 1)) this.sfx.move();
        break;
      case 'rotate_x_pos':
        if (this.game.tryRotate('x' as Axis)) this.sfx.rotate();
        break;
      case 'rotate_x_neg':
        // Rotate 3 times for equivalent -90 degrees
        if (this.rotateNeg('x' as Axis)) this.sfx.rotate();
        break;
      case 'rotate_y_pos':
        if (this.game.tryRotate('y' as Axis)) this.sfx.rotate();
        break;
      case 'rotate_y_neg':
        if (this.rotateNeg('y' as Axis)) this.sfx.rotate();
        break;
      case 'rotate_z_pos':
        if (this.game.tryRotate('z' as Axis)) this.sfx.rotate();
        break;
      case 'rotate_z_neg':
        if (this.rotateNeg('z' as Axis)) this.sfx.rotate();
        break;
      case 'soft_drop':
        if (this.game.softDrop()) this.sfx.softDrop();
        break;
      case 'hard_drop':
        this.game.hardDrop();
        this.sfx.hardDrop();
        break;
      case 'camera_left':
        this.cameraController?.orbitLeft();
        break;
      case 'camera_right':
        this.cameraController?.orbitRight();
        break;
      // pause and mute handled in onKeyDown
      default:
        break;
    }
  }

  private rotateNeg(axis: Axis): boolean {
    if (!this.game) return false;
    // Rotate 3 times for equivalent -90 degrees
    const success = this.game.tryRotate(axis)
      && this.game.tryRotate(axis)
      && this.game.tryRotate(axis);
    return success;
  }

  private processEvents(): void {
    if (!this.game) return;
    const events: GameEvent[] = this.game.flushEvents();

    for (const event of events) {
      switch (event.type) {
        case 'planes_cleared':
          this.sfx.planeClear(event.count);
          // Trigger effects for each cleared plane
          for (const y of event.y) {
            this.effects.planeClearEffect(
              this.game.config.width,
              this.game.config.depth,
              y,
              1, // default color for effect
            );
          }
          break;
        case 'combo':
          this.sfx.combo(event.multiplier);
          this.hud.showCombo(event.multiplier);
          break;
        case 'level_up':
          this.sfx.levelUp();
          this.music.setLevel(event.level);
          break;
        case 'game_over':
          this.sfx.gameOver();
          this.music.stop();
          this.effects.gameOverEffect(
            this.game.config.width,
            this.game.config.depth,
            this.game.config.height,
          );
          this.state = 'gameover';
          setTimeout(() => this.showGameOver(), 2000);
          break;
      }
    }
  }

  private showGameOver(): void {
    if (!this.game || !this.leaderboard) return;

    this.hud.hide();
    const score = this.game.score;
    const level = this.game.level;
    const planes = this.game.planesCleared;
    const timeMs = this.game.elapsedMs;
    const isHighScore = this.leaderboard.isHighScore(score);

    this.menu.showGameOver(score, level, planes, timeMs, isHighScore);

    // Flag pending save so high score is saved when user clicks play again or quit
    if (isHighScore) {
      this.pendingSave = true;
    }
  }

  private pendingSave = false;

  private saveHighScore(): void {
    if (!this.pendingSave || !this.game || !this.leaderboard) return;
    const name = this.menu.getNameInput();
    this.leaderboard.addScore({
      name,
      score: this.game.score,
      level: this.game.level,
      wellSize: this.currentSize,
    });
    this.pendingSave = false;
  }

  private loop(time: number): void {
    const dt = Math.min((time - this.lastTime) / 1000, 0.1); // cap at 100ms
    this.lastTime = time;

    if (this.state === 'playing' && this.game) {
      // Process DAS input repeats
      const dasActions = this.input.tick(performance.now());
      for (const a of dasActions) {
        this.handleAction(a);
      }

      // Gravity
      this.gravityAccum += dt * 1000;
      while (this.gravityAccum >= this.game.fallInterval) {
        this.gravityAccum -= this.game.fallInterval;
        this.game.tick();
      }

      // Process game events
      this.processEvents();

      // Update renderer
      if (this.wellRenderer) {
        this.wellRenderer.updateWell(this.game.well);
        this.wellRenderer.updateActivePiece(this.game.activePiece);
        this.wellRenderer.updateGhost(this.game.activePiece, this.game.ghostPosition());
      }

      // Update HUD
      this.hud.update(this.game.score, this.game.level, this.game.planesCleared);
    }

    // Always update camera and effects
    if (this.cameraController) {
      this.cameraController.update(dt);
    }
    this.effects.update(dt, this.sceneManager.camera);

    // Render
    this.sceneManager.render();

    requestAnimationFrame((t) => this.loop(t));
  }
}

// Boot the app
new App();
