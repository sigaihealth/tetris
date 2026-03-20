import { Well } from './Well.js';
import { PieceState, PIECE_COLORS } from './Piece.js';
import type { PieceType, Axis, Vec3 } from './Piece.js';
import { PieceGenerator } from './PieceGenerator.js';

export interface GameConfig { width: number; depth: number; height: number; }

export type GameEvent =
  | { type: 'piece_moved' }
  | { type: 'piece_rotated' }
  | { type: 'piece_locked' }
  | { type: 'planes_cleared'; count: number; y: number[] }
  | { type: 'hard_drop'; distance: number }
  | { type: 'soft_drop' }
  | { type: 'level_up'; level: number }
  | { type: 'game_over' }
  | { type: 'combo'; multiplier: number };

export const WELL_PRESETS = {
  small: { width: 4, depth: 4, height: 10 },
  medium: { width: 5, depth: 5, height: 12 },
  large: { width: 6, depth: 6, height: 15 },
} as const;

// Re-export for convenience
export type { Vec3, PieceType, Axis };
export { PIECE_COLORS };

export class GameState {
  readonly well: Well;
  readonly config: GameConfig;
  private generator: PieceGenerator;
  private _activePiece: PieceState | null = null;
  private _score = 0;
  private _level = 1;
  private _planesCleared = 0;
  private _isGameOver = false;
  private _comboCount = 0;
  private _events: GameEvent[] = [];
  private _startTime = 0;
  private _elapsedMs = 0;

  constructor(config: GameConfig) {
    this.config = config;
    this.well = new Well(config.width, config.depth, config.height);
    this.generator = new PieceGenerator();
  }

  get activePiece(): PieceState | null { return this._activePiece; }
  get score(): number { return this._score; }
  get level(): number { return this._level; }
  get planesCleared(): number { return this._planesCleared; }
  get isGameOver(): boolean { return this._isGameOver; }
  get elapsedMs(): number { return this._elapsedMs; }
  get nextPieces(): PieceType[] { return this.generator.peek(3); }

  get fallInterval(): number {
    if (this._level <= 10) return Math.max(1000 - (this._level - 1) * 80, 200);
    return Math.max(200 - (this._level - 10) * 10, 100);
  }

  flushEvents(): GameEvent[] {
    const events = this._events;
    this._events = [];
    return events;
  }

  start(): void {
    this.well.reset();
    this._score = 0; this._level = 1; this._planesCleared = 0;
    this._isGameOver = false; this._comboCount = 0;
    this._startTime = Date.now();
    this.generator.reset();
    this.spawnPiece();
  }

  private spawnPiece(): void {
    const type = this.generator.next();
    this._activePiece = PieceState.spawn(type, this.config.width, this.config.depth, this.config.height);
    if (this.collides(this._activePiece)) {
      this._isGameOver = true;
      this._events.push({ type: 'game_over' });
    }
  }

  private collides(piece: PieceState): boolean {
    for (const [x, y, z] of piece.worldCubes()) {
      if (!this.well.inBounds(x, y, z)) return true;
      if (this.well.isOccupied(x, y, z)) return true;
    }
    return false;
  }

  tryMove(dx: number, dy: number, dz: number): boolean {
    if (!this._activePiece || this._isGameOver) return false;
    const moved = this._activePiece.moved(dx, dy, dz);
    if (this.collides(moved)) return false;
    this._activePiece = moved;
    this._events.push({ type: 'piece_moved' });
    return true;
  }

  tryRotate(axis: Axis): boolean {
    if (!this._activePiece || this._isGameOver) return false;
    const rotated = this._activePiece.rotated(axis);
    if (!this.collides(rotated)) {
      this._activePiece = rotated;
      this._events.push({ type: 'piece_rotated' });
      return true;
    }
    const kicks: Vec3[] = [
      [1,0,0], [-1,0,0], [0,0,1], [0,0,-1],
      [0,1,0], [0,-1,0], [2,0,0], [-2,0,0], [0,0,2], [0,0,-2],
    ];
    for (const [dx, dy, dz] of kicks) {
      const kicked = rotated.moved(dx, dy, dz);
      if (!this.collides(kicked)) {
        this._activePiece = kicked;
        this._events.push({ type: 'piece_rotated' });
        return true;
      }
    }
    return false;
  }

  tick(): void {
    if (!this._activePiece || this._isGameOver) return;
    this._elapsedMs = Date.now() - this._startTime;
    const dropped = this._activePiece.moved(0, -1, 0);
    if (this.collides(dropped)) { this.lockPiece(); }
    else { this._activePiece = dropped; }
  }

  softDrop(): boolean {
    if (!this._activePiece || this._isGameOver) return false;
    const dropped = this._activePiece.moved(0, -1, 0);
    if (this.collides(dropped)) return false;
    this._activePiece = dropped;
    this._score += 1;
    this._events.push({ type: 'soft_drop' });
    return true;
  }

  hardDrop(): void {
    if (!this._activePiece || this._isGameOver) return;
    let distance = 0;
    let current = this._activePiece;
    while (true) {
      const dropped = current.moved(0, -1, 0);
      if (this.collides(dropped)) break;
      current = dropped;
      distance++;
    }
    this._activePiece = current;
    this._score += distance * 2;
    this._events.push({ type: 'hard_drop', distance });
    this.lockPiece();
  }

  private lockPiece(): void {
    if (!this._activePiece) return;
    const colorId = this._activePiece.colorId;
    for (const [x, y, z] of this._activePiece.worldCubes()) {
      if (this.well.inBounds(x, y, z)) this.well.setCell(x, y, z, colorId);
    }
    this._events.push({ type: 'piece_locked' });

    const clearedPlanes: number[] = [];
    for (let y = this.config.height - 1; y >= 0; y--) {
      if (this.well.isPlaneComplete(y)) clearedPlanes.push(y);
    }

    const cleared = this.well.clearCompletePlanes();
    if (cleared > 0) {
      this._comboCount++;
      this.addPlanesCleared(cleared);
      const comboMultiplier = 1 + (this._comboCount - 1) * 0.5;
      let baseScore: number;
      switch (cleared) {
        case 1: baseScore = 100; break;
        case 2: baseScore = 300; break;
        case 3: baseScore = 500; break;
        default: baseScore = 800; break;
      }
      this._score += Math.floor(baseScore * this._level * comboMultiplier);
      this._events.push({ type: 'planes_cleared', count: cleared, y: clearedPlanes });
      if (this._comboCount > 1) this._events.push({ type: 'combo', multiplier: comboMultiplier });
    } else { this._comboCount = 0; }

    this.spawnPiece();
  }

  addPlanesCleared(count: number): void {
    this._planesCleared += count;
    const newLevel = Math.floor(this._planesCleared / 10) + 1;
    if (newLevel > this._level) {
      this._level = newLevel;
      this._events.push({ type: 'level_up', level: this._level });
    }
  }

  ghostPosition(): Vec3 | null {
    if (!this._activePiece) return null;
    let ghost = this._activePiece;
    while (true) {
      const dropped = ghost.moved(0, -1, 0);
      if (this.collides(dropped)) break;
      ghost = dropped;
    }
    return ghost.position;
  }
}
